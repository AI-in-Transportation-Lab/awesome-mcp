#!/usr/bin/env python3
r"""
bench_transport.py
==================
Loopback round-trip latency benchmark for the TAAS survey revision (Section 7.3).

[v2] Changes w.r.t. the released version: (i) FRAME is the SAME object as M3 of bench_serialization.py (the released
version drew a second random frame: 7,575 B vs 7,609 B JSON); (ii) the table reports frame bytes AND the
full request/response bytes where measurable; (iii) the resources/read payload is measured, not hard-coded.

Each "transport" below carries the SAME logical payload (a 50-detection
cooperative-perception frame, ~7.6 kB as JSON / ~3.4 kB as Protobuf) from a
client to a server and back, and we record the request->response round-trip
time (RTT) on a single host.  The point is NOT to crown a winner, but to place
MCP's JSON-RPC exchange on the same axis as the binary middleware used in
robotics/V2X (DDS, gRPC, Zenoh) so that the paper's real-time discussion is
quantitative rather than purely architectural.

Transports
----------
  mcp-stdio       Official `mcp` Python SDK, stdio transport, tools/call
  mcp-shttp       Official `mcp` Python SDK, Streamable HTTP transport, tools/call
  mcp-stdio-res   Official SDK, stdio, resources/read of a ~120 B context object
  jsonrpc-stdio   Hand-rolled JSON-RPC 2.0 over newline-delimited stdio pipes
                  (no SDK, no schema validation) -> isolates SDK cost
  grpc-unary      gRPC unary call, Protobuf payload, localhost TCP
  dds-cyclone     Eclipse Cyclone DDS pub/sub ping-pong (two topics), default config (no explicit shared-memory setting)
  zenoh-pubsub    Eclipse Zenoh pub/sub ping-pong (peer mode, localhost)
  tcp-msgpack     Raw TCP, 4-byte length prefix + MessagePack (lower bound)

Outputs (./results): transport_results.json, transport_table.tex,
                     transport_latency.pdf/.png

Run:  python3 bench_transport.py [--iters 500] [--warmup 50]
Requires: mcp>=2, grpcio, cyclonedds, eclipse-zenoh, msgpack, uvicorn, httpx
Notes: DDS carries the Protobuf frame as an opaque sequence<uint8> (not a typed IDL struct); DDS/Zenoh are run in-process with two participants on one host; the
       measured RTT therefore includes two application-level hops (ping + pong),
       exactly like the request/response pairs of the other transports.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import socket
import statistics
import struct
import subprocess
import sys
import threading
import time
from typing import Callable, Dict, List

import msgpack

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "results")
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)

from bench_serialization import M3_FRAME, pb_build  # noqa: E402

FRAME = M3_FRAME
FRAME_JSON = json.dumps(FRAME, separators=(",", ":")).encode()
FRAME_PB = pb_build("M3", FRAME).SerializeToString()
RES_BYTES = len(json.dumps({"link_id": "RSU-23-RSU-24", "new_state": "degraded", "expected_latency_increase_ms": 30,
                            "timestamp": "2025-01-01T08:23:10Z"}).encode())  # same expression as mcp_echo_server.link_state()


def summarize(lat_us: List[float]) -> Dict[str, float]:
    s = sorted(lat_us)
    n = len(s)
    return {
        "n": n,
        "median_us": statistics.median(s),
        "p95_us": s[int(0.95 * n) - 1],
        "p99_us": s[int(0.99 * n) - 1],
        "min_us": s[0],
        "mean_us": statistics.fmean(s),
    }


def timed_loop(fn: Callable[[], None], iters: int, warmup: int) -> List[float]:
    for _ in range(warmup):
        fn()
    out = []
    for _ in range(iters):
        t0 = time.perf_counter()
        fn()
        out.append((time.perf_counter() - t0) * 1e6)
    return out


# --------------------------------------------------------------------------
# 1-3. MCP via the official SDK
# --------------------------------------------------------------------------
async def _mcp_stdio(iters: int, warmup: int):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(command=sys.executable, args=[os.path.join(HERE, "mcp_echo_server.py")])
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            proto = s.protocol_version
            for _ in range(warmup):
                await s.call_tool("echo_frame", {"frame": FRAME})
            lat = []
            for _ in range(iters):
                t0 = time.perf_counter()
                await s.call_tool("echo_frame", {"frame": FRAME})
                lat.append((time.perf_counter() - t0) * 1e6)
            res_lat = []
            for _ in range(warmup):
                await s.read_resource("context://link/23")
            for _ in range(iters):
                t0 = time.perf_counter()
                await s.read_resource("context://link/23")
                res_lat.append((time.perf_counter() - t0) * 1e6)
            return proto, lat, res_lat


def bench_mcp_stdio(iters, warmup):
    proto, lat, res_lat = asyncio.run(_mcp_stdio(iters, warmup))
    return {"mcp-stdio": summarize(lat) | {"protocol": proto, "payload_bytes": len(FRAME_JSON)},
            "mcp-stdio-res": summarize(res_lat) | {"protocol": proto, "payload_bytes": RES_BYTES}}


async def _mcp_shttp(iters: int, warmup: int, port: int):
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async with streamable_http_client(f"http://127.0.0.1:{port}/mcp") as streams:
        r, w = streams[0], streams[1]
        async with ClientSession(r, w) as s:
            await s.initialize()
            proto = s.protocol_version
            for _ in range(warmup):
                await s.call_tool("echo_frame", {"frame": FRAME})
            lat = []
            for _ in range(iters):
                t0 = time.perf_counter()
                await s.call_tool("echo_frame", {"frame": FRAME})
                lat.append((time.perf_counter() - t0) * 1e6)
            return proto, lat


def bench_mcp_shttp(iters, warmup, port=8765):
    srv = subprocess.Popen([sys.executable, os.path.join(HERE, "mcp_echo_server.py"), "--http", str(port)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(2.5)
        proto, lat = asyncio.run(_mcp_shttp(iters, warmup, port))
    finally:
        srv.terminate(); srv.wait(timeout=5)
    return {"mcp-shttp": summarize(lat) | {"protocol": proto, "payload_bytes": len(FRAME_JSON)}}


# --------------------------------------------------------------------------
# 4. Hand-rolled JSON-RPC 2.0 over stdio pipes (no SDK)
# --------------------------------------------------------------------------
_RAW_SERVER = r"""
import sys, json
for line in sys.stdin:
    req = json.loads(line)
    out = {"jsonrpc": "2.0", "id": req["id"], "result": req["params"]}
    sys.stdout.write(json.dumps(out, separators=(",", ":")) + "\n"); sys.stdout.flush()
"""


def bench_jsonrpc_stdio(iters, warmup):
    p = subprocess.Popen([sys.executable, "-c", _RAW_SERVER], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=False)
    i = [0]

    def once():
        i[0] += 1
        req = {"jsonrpc": "2.0", "id": i[0], "method": "tools/call", "params": {"name": "echo_frame", "arguments": {"frame": FRAME}}}
        p.stdin.write(json.dumps(req, separators=(",", ":")).encode() + b"\n"); p.stdin.flush()
        json.loads(p.stdout.readline())

    lat = timed_loop(once, iters, warmup)
    p.terminate()
    return {"jsonrpc-stdio": summarize(lat) | {"payload_bytes": len(FRAME_JSON)}}


# --------------------------------------------------------------------------
# 5. gRPC unary
# --------------------------------------------------------------------------
def bench_grpc(iters, warmup, port=50551):
    import grpc
    from concurrent import futures
    import context_pb2 as pb
    import context_pb2_grpc as pbg

    class Svc(pbg.ContextServiceServicer):
        def Echo(self, request, context):
            return request

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    pbg.add_ContextServiceServicer_to_server(Svc(), server)
    server.add_insecure_port(f"127.0.0.1:{port}")
    server.start()
    ch = grpc.insecure_channel(f"127.0.0.1:{port}")
    stub = pbg.ContextServiceStub(ch)
    msg = pb.PerceptionFrame.FromString(FRAME_PB)
    lat = timed_loop(lambda: stub.Echo(msg), iters, warmup)
    server.stop(0)
    return {"grpc-unary": summarize(lat) | {"payload_bytes": len(FRAME_PB)}}


# --------------------------------------------------------------------------
# 6. Cyclone DDS ping-pong (in-process, two participants)
# --------------------------------------------------------------------------
def bench_dds(iters, warmup):
    from cyclonedds.domain import DomainParticipant
    from cyclonedds.topic import Topic
    from cyclonedds.pub import DataWriter
    from cyclonedds.sub import DataReader
    from cyclonedds.core import Qos, Policy, Listener
    from cyclonedds.util import duration
    from dds_types import Frame

    qos = Qos(Policy.Reliability.Reliable(duration(seconds=1)), Policy.History.KeepLast(10))
    p1, p2 = DomainParticipant(), DomainParticipant()
    t_ping1, t_pong1 = Topic(p1, "aas_ping", Frame), Topic(p1, "aas_pong", Frame)
    t_ping2, t_pong2 = Topic(p2, "aas_ping", Frame), Topic(p2, "aas_pong", Frame)
    w_pong = DataWriter(p2, t_pong2, qos=qos)
    ev = threading.Event()
    got = [None]

    class PingListener(Listener):           # responder side: echo on the pong topic
        def on_data_available(self, reader):
            for s in reader.take(N=10):
                w_pong.write(Frame(seq=s.seq, payload=s.payload))

    class PongListener(Listener):           # requester side: wake the main thread
        def on_data_available(self, reader):
            for s in reader.take(N=10):
                got[0] = s.seq
                ev.set()

    r_ping = DataReader(p2, t_ping2, qos=qos, listener=PingListener())  # noqa: F841
    r_pong = DataReader(p1, t_pong1, qos=qos, listener=PongListener())  # noqa: F841
    w_ping = DataWriter(p1, t_ping1, qos=qos)
    payload = list(FRAME_PB)
    time.sleep(1.0)  # discovery
    seq = [0]

    def once():
        seq[0] += 1
        ev.clear()
        w_ping.write(Frame(seq=seq[0], payload=payload))
        ev.wait(2.0)

    lat = timed_loop(once, iters, warmup)
    return {"dds-cyclone": summarize(lat) | {"payload_bytes": len(FRAME_PB)}}


# --------------------------------------------------------------------------
# 7. Zenoh ping-pong (two sessions, peer mode on localhost)
# --------------------------------------------------------------------------
def bench_zenoh(iters, warmup):
    import zenoh
    c1, c2 = zenoh.Config(), zenoh.Config()
    # explicit IPv4 loopback endpoints (sandboxes without IPv6 cannot bind tcp/[::]:0)
    c1.insert_json5("listen/endpoints", '["tcp/127.0.0.1:7447"]')
    c1.insert_json5("scouting/multicast/enabled", "false")
    c2.insert_json5("connect/endpoints", '["tcp/127.0.0.1:7447"]')
    c2.insert_json5("listen/endpoints", '[]')
    c2.insert_json5("scouting/multicast/enabled", "false")
    s1 = zenoh.open(c1); s2 = zenoh.open(c2)
    pub_ping, pub_pong = s1.declare_publisher("aas/ping"), s2.declare_publisher("aas/pong")
    got = {}
    lock = threading.Event()

    def on_ping(sample):
        pub_pong.put(bytes(sample.payload))

    def on_pong(sample):
        got["b"] = bytes(sample.payload); lock.set()

    sub_ping = s2.declare_subscriber("aas/ping", on_ping)
    sub_pong = s1.declare_subscriber("aas/pong", on_pong)
    time.sleep(1.0)

    def once():
        lock.clear(); pub_ping.put(FRAME_PB); lock.wait(2.0)

    lat = timed_loop(once, iters, warmup)
    sub_ping.undeclare(); sub_pong.undeclare(); s1.close(); s2.close()
    return {"zenoh-pubsub": summarize(lat) | {"payload_bytes": len(FRAME_PB)}}


# --------------------------------------------------------------------------
# 8. Raw TCP + MessagePack (length-prefixed) lower bound
# --------------------------------------------------------------------------
def bench_tcp_msgpack(iters, warmup, port=50552):
    srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", port)); srv.listen(1)

    def serve():
        c, _ = srv.accept(); c.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        while True:
            hdr = c.recv(4, socket.MSG_WAITALL)
            if not hdr:
                break
            n = struct.unpack("!I", hdr)[0]
            body = c.recv(n, socket.MSG_WAITALL)
            c.sendall(hdr + body)

    th = threading.Thread(target=serve, daemon=True); th.start()
    cl = socket.create_connection(("127.0.0.1", port)); cl.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    body = msgpack.packb(FRAME, use_bin_type=True)

    def once():
        cl.sendall(struct.pack("!I", len(body)) + body)
        hdr = cl.recv(4, socket.MSG_WAITALL); n = struct.unpack("!I", hdr)[0]
        msgpack.unpackb(cl.recv(n, socket.MSG_WAITALL), raw=False)

    lat = timed_loop(once, iters, warmup)
    cl.close(); srv.close()
    return {"tcp-msgpack": summarize(lat) | {"payload_bytes": len(body)}}


ORDER = ["tcp-msgpack", "dds-cyclone", "zenoh-pubsub", "grpc-unary", "jsonrpc-stdio",
         "mcp-stdio-res", "mcp-stdio", "mcp-shttp"]
LABELS = {
    "tcp-msgpack": "raw TCP + MessagePack",
    "dds-cyclone": "DDS (Cyclone) pub/sub",
    "zenoh-pubsub": "Zenoh pub/sub",
    "grpc-unary": "gRPC unary (Protobuf)",
    "jsonrpc-stdio": "JSON-RPC 2.0 / stdio (no SDK)",
    "mcp-stdio-res": "MCP stdio resources/read (small)",
    "mcp-stdio": "MCP stdio tools/call (SDK)",
    "mcp-shttp": "MCP Streamable HTTP tools/call (SDK)",
}
CLASS = {
    "tcp-msgpack": "floor", "dds-cyclone": "binary middleware", "zenoh-pubsub": "binary middleware",
    "grpc-unary": "binary RPC", "jsonrpc-stdio": "text RPC", "mcp-stdio-res": "MCP",
    "mcp-stdio": "MCP", "mcp-shttp": "MCP",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=500)
    ap.add_argument("--warmup", type=int, default=50)
    ap.add_argument("--skip", default="", help="comma-separated transports to skip")
    args = ap.parse_args()
    skip = set(filter(None, args.skip.split(",")))

    results = {"meta": {"python": sys.version.split()[0], "platform": platform.platform(),
                        "iters": args.iters, "warmup": args.warmup,
                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")}, "transports": {}}
    benches = [("tcp-msgpack", bench_tcp_msgpack), ("grpc-unary", bench_grpc), ("jsonrpc-stdio", bench_jsonrpc_stdio),
               ("dds-cyclone", bench_dds), ("zenoh-pubsub", bench_zenoh),
               ("mcp-stdio", bench_mcp_stdio), ("mcp-shttp", bench_mcp_shttp)]
    for name, fn in benches:
        if name in skip:
            continue
        print(f"== {name} ...", flush=True)
        try:
            r = fn(args.iters, args.warmup)
            results["transports"].update(r)
            for k, v in r.items():
                print(f"   {k:14s} median {v['median_us']:8.1f} us  p95 {v['p95_us']:8.1f}  p99 {v['p99_us']:8.1f}")
        except Exception as e:  # keep going; report what failed
            print(f"   FAILED: {e!r}")
            results["transports"][name] = {"error": repr(e)}

    with open(os.path.join(OUT, "transport_results.json"), "w") as f:
        json.dump(results, f, indent=2)

    rows = []
    for k in ORDER:
        v = results["transports"].get(k)
        if not v or "error" in v:
            continue
        rows.append(f"{LABELS[k]} & {CLASS[k]} & {v['payload_bytes']:,} & {v['median_us']/1000:.2f} & "
                    f"{v['p95_us']/1000:.2f} & {v['p99_us']/1000:.2f} \\\\")
    head = ["\\begin{tabular}{llrrrr}", "\\toprule",
            "\\rowcolor{blue!6}\\textbf{Path} & \\textbf{Class} & \\textbf{Payload (B)} & \\textbf{Median (ms)} & "
            "\\textbf{p95 (ms)} & \\textbf{p99 (ms)} \\\\", "\\midrule"]
    tail = ["\\bottomrule", "\\end{tabular}"]
    with open(os.path.join(OUT, "transport_table.tex"), "w") as f:
        f.write("%% generated by bench_transport.py -- complete tabular, \\input it directly\n")
        f.write("\n".join(head + rows + tail) + "\n")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    keys = [k for k in ORDER if k in results["transports"] and "error" not in results["transports"][k]]
    med = [results["transports"][k]["median_us"] / 1000 for k in keys]
    p99 = [results["transports"][k]["p99_us"] / 1000 for k in keys]
    cols = {"floor": "#7f7f7f", "binary middleware": "#2e75b6", "binary RPC": "#9dc3e6", "text RPC": "#f4b183", "MCP": "#c55a11"}
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    y = range(len(keys))
    ax.barh(y, med, color=[cols[CLASS[k]] for k in keys], label="median")
    ax.scatter(p99, y, marker="|", s=200, color="black", label="p99", zorder=3)
    ax.set_yticks(list(y)); ax.set_yticklabels([LABELS[k] for k in keys], fontsize=8)
    ax.set_xscale("log"); ax.set_xlabel("round-trip latency on one host (ms, log scale)")
    ax.axvline(1.0, ls="--", color="red", lw=1); ax.text(1.05, -0.75, "1 ms", color="red", fontsize=8, va="center")
    ax.axvline(0.1, ls=":", color="red", lw=1); ax.text(0.105, -0.75, "100 µs", color="red", fontsize=8, va="center")
    ax.set_ylim(len(keys) - 0.4, -1.1)
    ax.grid(axis="x", alpha=.3, which="both")
    ax.legend(fontsize=8, frameon=False, loc="upper right", bbox_to_anchor=(1.0, 1.02))
    ax.set_title("Loopback round-trip of a 50-detection perception frame", fontsize=10)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "transport_latency.pdf")); fig.savefig(os.path.join(OUT, "transport_latency.png"), dpi=200)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
