#!/usr/bin/env python3
"""
ros2_mcp_bridge.py
==================
Illustrative bridge between a ROS 2 / DDS data plane and an MCP supervisory
plane (the application-domain discussion (two-plane pattern)).  The bridge embodies the paper's main
real-time recommendation:

   * the hard/firm real-time loop (perception -> planning -> control) stays on
     DDS topics with their native QoS (deadline, lifespan, history);
   * MCP exposes only *summaries* of that state (down-sampled, versioned,
     uncertainty-tagged) as resources, and accepts *supervisory* decisions as
     tools that are translated into ROS 2 parameters/goals - never into
     per-cycle actuator commands.

The file is written so that it imports (and the MCP side runs) even without a
ROS 2 installation: when `rclpy` is missing, a tiny in-process simulator feeds
the same summariser.  With ROS 2 present, run it inside a sourced workspace:

    ros2 run <pkg> ros2_mcp_bridge   (or)   python3 ros2_mcp_bridge.py

MCP surface
-----------
  resource  context://ros/objects/summary   latest object-list summary (JSON)
  resource  context://ros/health            topic rates, staleness, dropped msgs
  tool      set_supervisory_param(name, value)   -> ROS 2 parameter update
  tool      request_replan(reason)               -> publishes a replan trigger

Message types used on the ROS 2 side are deliberately generic (std_msgs,
geometry_msgs, vision_msgs if available) so the sketch stays portable.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import threading
import time
from collections import deque
from typing import Any

from mcp.server.mcpserver import MCPServer

# --------------------------------------------------------------------------
# Optional ROS 2 import
# --------------------------------------------------------------------------
try:  # pragma: no cover - exercised only inside a ROS 2 environment
    import rclpy
    from rclpy.node import Node
    from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy, DurabilityPolicy
    from std_msgs.msg import String
    HAVE_ROS = True
except Exception:  # noqa: BLE001
    HAVE_ROS = False


# --------------------------------------------------------------------------
# Summariser: turns a high-rate object stream into a low-rate context object
# --------------------------------------------------------------------------
class ObjectSummariser:
    """Keeps a sliding window of detections and produces a compact summary.

    The summary is what crosses the MCP boundary; the raw stream never does.
    """

    def __init__(self, window_s: float = 1.0) -> None:
        self.window_s = window_s
        self.buf: deque[tuple[float, list[dict[str, Any]]]] = deque()
        self.msgs = 0
        self.version = 0
        self.lock = threading.Lock()

    def push(self, stamp: float, objects: list[dict[str, Any]]) -> None:
        with self.lock:
            self.buf.append((stamp, objects))
            self.msgs += 1
            self.version += 1
            while self.buf and stamp - self.buf[0][0] > self.window_s:
                self.buf.popleft()

    def summary(self) -> dict[str, Any]:
        with self.lock:
            now = time.time()
            if not self.buf:
                return {"version": self.version, "stale_s": None, "objects": [], "n_frames": 0}
            last_stamp, last_objs = self.buf[-1]
            by_cls: dict[str, int] = {}
            nearest = None
            for o in last_objs:
                by_cls[o["cls"]] = by_cls.get(o["cls"], 0) + 1
                d = math.hypot(o["x"], o["y"])
                if nearest is None or d < nearest["range_m"]:
                    nearest = {"id": o["id"], "cls": o["cls"], "range_m": round(d, 2),
                               "confidence": o.get("confidence", 1.0)}
            return {
                "version": self.version,
                "stamp_s": last_stamp,
                "stale_s": round(now - last_stamp, 3),
                "n_frames": len(self.buf),
                "rate_hz": round(len(self.buf) / self.window_s, 1),
                "counts_by_class": by_cls,
                "nearest": nearest,
                "min_confidence": min((o.get("confidence", 1.0) for o in last_objs), default=None),
            }


SUMMARISER = ObjectSummariser()
HEALTH: dict[str, Any] = {"topic": "/perception/objects", "dropped": 0, "params": {}}


# --------------------------------------------------------------------------
# ROS 2 side (data plane)
# --------------------------------------------------------------------------
if HAVE_ROS:

    class BridgeNode(Node):  # pragma: no cover
        def __init__(self) -> None:
            super().__init__("mcp_bridge")
            # Sensor-data QoS: best effort, shallow history -> no back-pressure on the RT loop
            qos = QoSProfile(reliability=ReliabilityPolicy.BEST_EFFORT,
                             history=HistoryPolicy.KEEP_LAST, depth=5,
                             durability=DurabilityPolicy.VOLATILE)
            self.sub = self.create_subscription(String, "/perception/objects_json", self.on_objects, qos)
            self.pub_replan = self.create_publisher(String, "/supervisor/replan", 10)
            self.declare_parameter("send_rate_hz", 10)
            self.declare_parameter("mode", "cooperative")

        def on_objects(self, msg: String) -> None:
            # In a real deployment this would be vision_msgs/Detection3DArray; JSON keeps the sketch generic.
            data = json.loads(msg.data)
            SUMMARISER.push(data.get("stamp_s", time.time()), data.get("objects", []))

        def set_param(self, name: str, value: Any):
            from rclpy.parameter import Parameter
            return self.set_parameters([Parameter(name, value=value)])

        def replan(self, reason: str) -> None:
            self.pub_replan.publish(String(data=json.dumps({"reason": reason, "t": time.time()})))

    NODE: BridgeNode | None = None
else:
    NODE = None


def simulate_stream(rate_hz: float = 20.0) -> None:
    """Fallback feeder used when ROS 2 is unavailable (keeps the MCP side testable)."""
    i = 0
    while True:
        i += 1
        objs = [{"id": k, "cls": random.choice(["car", "pedestrian", "robot"]),
                 "x": random.uniform(-40, 40), "y": random.uniform(-40, 40),
                 "confidence": round(random.uniform(0.5, 1.0), 2)} for k in range(random.randint(3, 12))]
        SUMMARISER.push(time.time(), objs)
        time.sleep(1.0 / rate_hz)


# --------------------------------------------------------------------------
# MCP side (supervisory plane)
# --------------------------------------------------------------------------
server = MCPServer(name="ros2-mcp-bridge", version="0.1",
                   instructions="Summaries only; do not expect per-frame data through MCP.")


@server.resource("context://ros/objects/summary", mime_type="application/json",
                 description="Down-sampled summary of /perception/objects (last 1 s window).")
def objects_summary() -> str:
    return json.dumps(SUMMARISER.summary())


@server.resource("context://ros/health", mime_type="application/json",
                 description="Bridge health: message counts, staleness, current supervisory parameters.")
def health() -> str:
    h = dict(HEALTH)
    h["messages_seen"] = SUMMARISER.msgs
    h["stale_s"] = SUMMARISER.summary().get("stale_s")
    return json.dumps(h)


@server.tool(description="Set a supervisory ROS 2 parameter (e.g., send_rate_hz, mode). Not a control command.")
def set_supervisory_param(name: str, value: str) -> dict[str, Any]:
    allowed = {"send_rate_hz": int, "mode": str}
    if name not in allowed:
        return {"ok": False, "reason": f"parameter {name} is not exposed to the supervisory plane"}
    try:
        cast = allowed[name](value)
    except (ValueError, TypeError):
        return {"ok": False, "reason": f"invalid value for {name}"}
    if name == "send_rate_hz" and cast <= 0:
        return {"ok": False, "reason": "send_rate_hz must be positive"}
    if NODE is not None:
        results = NODE.set_param(name, cast)
        if not all(result.successful for result in results):
            return {"ok": False, "reason": "; ".join(result.reason for result in results if not result.successful)}
    HEALTH["params"][name] = cast
    return {"ok": True, "name": name, "value": cast, "applied_to_ros": NODE is not None}


@server.tool(description="Ask the planner to re-plan; the planner itself runs on the ROS 2 side.")
def request_replan(reason: str) -> dict[str, Any]:
    if NODE is not None:
        NODE.replan(reason)
    return {"ok": True, "reason": reason, "published": NODE is not None, "t": time.time()}


def main() -> None:
    global NODE
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", type=int, default=0)
    args = ap.parse_args()

    if HAVE_ROS:  # pragma: no cover
        rclpy.init()
        NODE = BridgeNode()
        threading.Thread(target=rclpy.spin, args=(NODE,), daemon=True).start()
    else:
        threading.Thread(target=simulate_stream, daemon=True).start()

    if args.http:
        import uvicorn
        uvicorn.run(server.streamable_http_app(), host="127.0.0.1", port=args.http, log_level="error")
    else:
        server.run("stdio")


if __name__ == "__main__":
    main()
