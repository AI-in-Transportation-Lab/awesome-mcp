#!/usr/bin/env python3
"""
mcp_client_demo.py
==================
Exercises mcp_mapek_server.py over stdio and prints a compact trace of one
Monitor -> Analyze -> Plan -> Execute cycle, including the capability
negotiation performed in `initialize`.  Use `--trace` to dump every JSON-RPC
message that crosses the pipe (useful to see exactly what MCP puts on the wire).

Run:  python3 mcp_client_demo.py [--trace]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

HERE = os.path.dirname(os.path.abspath(__file__))


def pretty(x) -> str:
    try:
        return json.dumps(x, indent=None, separators=(",", ":"))[:300]
    except TypeError:
        return str(x)[:300]


async def run(trace: bool) -> None:
    params = StdioServerParameters(command=sys.executable, args=[os.path.join(HERE, "mcp_mapek_server.py")])
    updates: list[str] = []

    async def on_message(msg):  # back-channel notifications (resources/updated etc.)
        if trace:
            print("  <- notification/other:", pretty(getattr(msg, "model_dump", lambda **k: msg)(exclude_none=True)))
        m = getattr(msg, "root", msg)
        if getattr(m, "method", "") == "notifications/resources/updated":
            updates.append(m.params.uri)

    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w, message_handler=on_message) as s:
            init = await s.initialize()
            print("1. initialize  -> protocol", s.protocol_version,
                  "| server", init.server_info.name, init.server_info.version)
            print("   server capabilities:", pretty(init.capabilities.model_dump(exclude_none=True)))

            tools = await s.list_tools()
            print("2. tools/list  ->", [t.name for t in tools.tools])
            res = await s.list_resources()
            print("   resources/list ->", [str(x.uri) for x in res.resources])

            if init.capabilities.resources and init.capabilities.resources.subscribe:
                await s.subscribe_resource("context://knowledge/links")
                await s.subscribe_resource("context://knowledge/agents")
                print("3. resources/subscribe context://knowledge/links -> ok")
            else:
                print("3. resources/subscribe not advertised; skipped (notifications below do not prove subscription support)")

            # ---- Monitor
            out = await s.call_tool("ingest_observation",
                                    {"link_id": "RSU-23-RSU-24", "latency_ms": 42.0, "loss": 0.03})
            print("4. M ingest_observation ->", pretty(out.structured_content))

            # ---- Analyze
            out = await s.call_tool("analyze", {})
            print("5. A analyze ->", pretty(out.structured_content))

            # ---- Plan (a bad plan first: violates the envelope)
            out = await s.call_tool("plan", {"goal": "shed load on degraded link",
                                             "target_agents": ["veh-101", "veh-102"], "new_send_rate_hz": 1})
            print("6. P plan (rate=1 Hz) ->", out.structured_content["status"], out.structured_content["violations"])
            out = await s.call_tool("plan", {"goal": "shed load on degraded link",
                                             "target_agents": ["veh-101", "veh-102"], "new_send_rate_hz": 4})
            plan = out.structured_content
            print("   P plan (rate=4 Hz) ->", plan["status"], plan["plan_id"])

            # ---- Execute
            out = await s.call_tool("execute", {"plan_id": plan["plan_id"]})
            print("7. E execute ->", pretty(out.structured_content))

            # ---- Knowledge read-back
            k = await s.read_resource("context://knowledge/agents")
            print("8. resources/read agents ->", k.contents[0].text[:160], "...")

            # ---- Prompt for the operator
            p = await s.get_prompt("explain_adaptation", {"plan_id": plan["plan_id"]})
            print("9. prompts/get explain_adaptation ->", p.messages[0].content.text[:120], "...")
            await asyncio.sleep(0.1)
            print("   resources/updated notifications received:", updates)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--trace", action="store_true")
    asyncio.run(run(ap.parse_args().trace))
