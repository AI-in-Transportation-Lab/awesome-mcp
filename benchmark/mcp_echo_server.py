#!/usr/bin/env python3
"""
mcp_echo_server.py
==================
Minimal MCP server (official `mcp` Python SDK, v2.x) used by bench_transport.py.

It exposes one tool and one resource:

  tool     echo_frame(frame)   -> returns the frame unchanged (structured output)
  resource context://link/23   -> a small link-state context object

Run as a subprocess over stdio (default) or as a Streamable HTTP server:

  python3 mcp_echo_server.py                 # stdio transport
  python3 mcp_echo_server.py --http 8765     # Streamable HTTP on 127.0.0.1:8765/mcp
"""
from __future__ import annotations

import argparse
import json
from typing import Any

from mcp.server.mcpserver import MCPServer

server = MCPServer(name="aas-echo", version="0.1", log_level="ERROR")


@server.tool(description="Echo a perception frame back to the caller (benchmark helper).")
def echo_frame(frame: dict[str, Any]) -> dict[str, Any]:
    return frame


@server.resource("context://link/23", mime_type="application/json",
                 description="Link-state context object for RSU-23-RSU-24.")
def link_state() -> str:
    return json.dumps({
        "link_id": "RSU-23-RSU-24", "new_state": "degraded",
        "expected_latency_increase_ms": 30, "timestamp": "2025-01-01T08:23:10Z",
    })


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", type=int, default=0, help="port for Streamable HTTP (0 = stdio)")
    args = ap.parse_args()
    if args.http:
        import uvicorn
        uvicorn.run(server.streamable_http_app(), host="127.0.0.1", port=args.http, log_level="error")
    else:
        server.run("stdio")
