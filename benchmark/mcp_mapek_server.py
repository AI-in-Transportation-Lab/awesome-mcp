#!/usr/bin/env python3
"""
mcp_mapek_server.py
===================
A runnable MCP server (official `mcp` SDK v2) that externalizes a MAPE-K
adaptation loop (Monitor–Analyze–Plan–Execute over shared Knowledge) for an
autonomous/adaptive system.  It is the reference implementation behind the
code box "MAPE-K knowledge and actions as MCP primitives" in Section 3 (reference model).

MAPE-K element      ->  MCP primitive
--------------------------------------------------------------------------
Knowledge (K)       ->  resources  (context://knowledge/...)  + subscriptions
Monitor (M)         ->  tool  ingest_observation(...)  + notifications/resources/updated
Analyze (A)         ->  tool  analyze()  (returns symptoms + uncertainty)
Plan (P)            ->  tool  plan(goal) (returns a candidate adaptation plan)
Execute (E)         ->  tool  execute(plan_id, confirm)   guarded by a safety envelope
Human-in-the-loop   ->  prompt  explain_adaptation        (for operator review)

The domain example is deliberately generic (a fleet of agents sharing a link /
corridor), so the same server can stand in for an RSU corridor (ITS), a
multi-robot cell (robotics), a production cell (manufacturing) or an edge-AI
fleet.  Nothing here touches a hard real-time loop: the server runs at the
supervisory tier and *publishes* decisions that a real-time executor applies.

Run:   python3 mcp_mapek_server.py            # stdio
       python3 mcp_mapek_server.py --http 8766  # Streamable HTTP
Test:  python3 mcp_client_demo.py
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
import weakref
from typing import Any

from mcp.server.mcpserver.context import Context
from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations, SubscribeRequestParams, UnsubscribeRequestParams

server = MCPServer(
    name="aas-mapek",
    version="0.2",
    instructions=(
        "Supervisory adaptation server. Read context://knowledge/* before planning; "
        "never call execute without a plan_id returned by plan()."
    ),
)

# ---------------------------------------------------------------------------
# Knowledge base (K): shared, versioned context state
# ---------------------------------------------------------------------------
KNOWLEDGE: dict[str, Any] = {
    "version": 1,
    "updated_at": time.time(),
    "links": {
        "RSU-23-RSU-24": {"state": "nominal", "latency_ms": 12.0, "loss": 0.001},
        "RSU-24-RSU-25": {"state": "nominal", "latency_ms": 14.0, "loss": 0.002},
    },
    "agents": {
        "veh-101": {"mode": "cooperative", "send_rate_hz": 10, "zone": "corridor-A"},
        "veh-102": {"mode": "cooperative", "send_rate_hz": 10, "zone": "corridor-A"},
        "robot-07": {"mode": "autonomous", "send_rate_hz": 20, "zone": "cell-3"},
    },
    "safety_envelope": {
        "min_send_rate_hz": 2,
        "max_send_rate_hz": 50,
        "frozen_zones": ["school-17"],          # adaptation forbidden here
        "require_confirmation_for": ["mode"],  # human confirmation needed to change mode
    },
}
PLANS: dict[str, dict[str, Any]] = {}


# Legacy subscriptions are explicit per-session URI sets. The high-level SDK
# does not install these legacy handlers automatically. The SDK version is pinned.
_SUBSCRIPTIONS = weakref.WeakKeyDictionary()
_RESOURCE_URIS = {"context://knowledge/links", "context://knowledge/agents", "context://knowledge/safety"}

async def _subscribe(request, params):
    if params.uri not in _RESOURCE_URIS:
        raise ValueError("unknown resource URI")
    _SUBSCRIPTIONS.setdefault(request.session._connection, set()).add(params.uri)
    return {}

async def _unsubscribe(request, params):
    _SUBSCRIPTIONS.get(request.session._connection, set()).discard(params.uri)
    return {}

server._lowlevel_server.add_request_handler("resources/subscribe", SubscribeRequestParams, _subscribe)
server._lowlevel_server.add_request_handler("resources/unsubscribe", UnsubscribeRequestParams, _unsubscribe)

async def _bump(ctx_uri: str | None = None, ctx: Context | None = None) -> None:
    KNOWLEDGE["version"] += 1
    KNOWLEDGE["updated_at"] = time.time()
    if ctx is not None and ctx_uri is not None:
        # Modern listeners use the SDK bus; legacy sessions receive only URIs
        # they subscribed to. Notification failures must remain observable.
        await ctx.notify_resource_updated(ctx_uri)
        for connection, uris in list(_SUBSCRIPTIONS.items()):
            if ctx_uri in uris:
                await connection.send_resource_updated(ctx_uri)


@server.resource("context://knowledge/links", mime_type="application/json",
                 description="Network/link state shared by all agents (Knowledge).")
def knowledge_links() -> str:
    return json.dumps({"version": KNOWLEDGE["version"], "links": KNOWLEDGE["links"]})


@server.resource("context://knowledge/agents", mime_type="application/json",
                 description="Current adaptation state (mode, send rate, zone) of each agent.")
def knowledge_agents() -> str:
    return json.dumps({"version": KNOWLEDGE["version"], "agents": KNOWLEDGE["agents"]})


@server.resource("context://knowledge/safety", mime_type="application/json",
                 description="Safety envelope that every plan must respect.")
def knowledge_safety() -> str:
    return json.dumps(KNOWLEDGE["safety_envelope"])


# ---------------------------------------------------------------------------
# Monitor (M): observations enter the loop through a tool call
# ---------------------------------------------------------------------------
@server.tool(description="Ingest a telemetry observation for a link (Monitor).",
             annotations=ToolAnnotations(readOnlyHint=False, idempotentHint=False))
async def ingest_observation(link_id: str, latency_ms: float, loss: float, ctx: Context) -> dict[str, Any]:
    link = KNOWLEDGE["links"].setdefault(link_id, {})
    link.update({"latency_ms": latency_ms, "loss": loss,
                 "state": "degraded" if (latency_ms > 30 or loss > 0.02) else "nominal"})
    await _bump("context://knowledge/links", ctx)
    return {"link_id": link_id, "state": link["state"], "version": KNOWLEDGE["version"]}


# ---------------------------------------------------------------------------
# Analyze (A): symptoms + uncertainty, no side effects
# ---------------------------------------------------------------------------
@server.tool(description="Analyze shared knowledge and return symptoms (Analyze).",
             annotations=ToolAnnotations(readOnlyHint=True))
def analyze() -> dict[str, Any]:
    symptoms = []
    for lid, l in KNOWLEDGE["links"].items():
        if l.get("state") == "degraded":
            affected = [a for a, s in KNOWLEDGE["agents"].items() if s["zone"] == "corridor-A"]
            symptoms.append({"type": "link_degraded", "link_id": lid, "latency_ms": l["latency_ms"],
                             "confidence": 0.9 if l["loss"] > 0.02 else 0.7, "affected_agents": affected})
    return {"version": KNOWLEDGE["version"], "symptoms": symptoms,
            "stale_s": round(time.time() - KNOWLEDGE["updated_at"], 3)}


# ---------------------------------------------------------------------------
# Plan (P): propose an adaptation, checked against the safety envelope
# ---------------------------------------------------------------------------
@server.tool(description="Create a candidate adaptation plan for a goal (Plan).")
def plan(goal: str, target_agents: list[str], new_send_rate_hz: int | None = None,
         new_mode: str | None = None) -> dict[str, Any]:
    env = KNOWLEDGE["safety_envelope"]
    violations: list[str] = []
    if new_send_rate_hz is not None and not (env["min_send_rate_hz"] <= new_send_rate_hz <= env["max_send_rate_hz"]):
        violations.append(f"send_rate {new_send_rate_hz} outside [{env['min_send_rate_hz']}, {env['max_send_rate_hz']}]")
    for a in target_agents:
        st = KNOWLEDGE["agents"].get(a)
        if st is None:
            violations.append(f"unknown agent {a}")
        elif st["zone"] in env["frozen_zones"]:
            violations.append(f"agent {a} is in frozen zone {st['zone']}")
    needs_confirmation = new_mode is not None and "mode" in env["require_confirmation_for"]
    pid = f"plan-{uuid.uuid4().hex[:8]}"
    p = {"plan_id": pid, "goal": goal, "targets": target_agents, "send_rate_hz": new_send_rate_hz,
         "mode": new_mode, "violations": violations, "needs_confirmation": needs_confirmation,
         "based_on_version": KNOWLEDGE["version"], "status": "rejected" if violations else "proposed"}
    PLANS[pid] = p
    return p


# ---------------------------------------------------------------------------
# Execute (E): apply a plan; optimistic concurrency on the knowledge version
# ---------------------------------------------------------------------------
@server.tool(description="Apply a proposed plan (Execute). Fails if knowledge changed since planning.",
             annotations=ToolAnnotations(destructiveHint=True))
async def execute(plan_id: str, ctx: Context, confirm: bool = False) -> dict[str, Any]:
    p = PLANS.get(plan_id)
    if p is None or p["status"] != "proposed":
        return {"plan_id": plan_id, "applied": False, "reason": "no such proposed plan"}
    if p["needs_confirmation"] and not confirm:
        return {"plan_id": plan_id, "applied": False, "reason": "human confirmation required (mode change)"}
    if p["based_on_version"] != KNOWLEDGE["version"]:
        return {"plan_id": plan_id, "applied": False,
                "reason": f"stale plan: based on v{p['based_on_version']}, knowledge is v{KNOWLEDGE['version']}"}
    for a in p["targets"]:
        if p["send_rate_hz"] is not None:
            KNOWLEDGE["agents"][a]["send_rate_hz"] = p["send_rate_hz"]
        if p["mode"] is not None:
            KNOWLEDGE["agents"][a]["mode"] = p["mode"]
    p["status"] = "applied"
    await _bump("context://knowledge/agents", ctx)
    return {"plan_id": plan_id, "applied": True, "version": KNOWLEDGE["version"]}


# ---------------------------------------------------------------------------
# Prompt: operator-facing explanation template (human-in-the-loop)
# ---------------------------------------------------------------------------
@server.prompt(description="Explain a plan to a human operator before confirmation.")
def explain_adaptation(plan_id: str) -> str:
    p = PLANS.get(plan_id, {})
    return (f"Summarise plan {plan_id} for an operator: goal='{p.get('goal')}', targets={p.get('targets')}, "
            f"send_rate={p.get('send_rate_hz')}, mode={p.get('mode')}, violations={p.get('violations')}. "
            "State the expected effect on safety, latency and coordination, and what to monitor afterwards.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", type=int, default=0)
    args = ap.parse_args()
    if args.http:
        import uvicorn
        uvicorn.run(server.streamable_http_app(), host="127.0.0.1", port=args.http, log_level="error")
    else:
        server.run("stdio")
