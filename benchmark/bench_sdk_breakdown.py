#!/usr/bin/env python3
"""
bench_sdk_breakdown.py  [v2, new]
=================================
Measures SDK-path overhead and a response-size ablation (Section 7.3).
The ablation does not isolate parsing, validation, dispatch, or runtime scheduling.

 A. Wire sizes: request, response (SDK), content-text vs structuredContent split.
 B. Size-matched ablation: a hand-rolled JSON-RPC stdio server that returns a response of EXACTLY the SDK's size
    (24 kB). If RTT stays near the 7.6 kB hand-rolled figure, size is not the cause.
 C. Raw-protocol client against the SDK echo server (no SDK client cost): RTT of tools/call.
 D. Server-side cProfile of the SDK echo server over N calls: share of time in pydantic, json, anyio, and the rest.
Outputs: results/sdk_breakdown.json
"""
from __future__ import annotations
import json, os, subprocess, sys, time, statistics, pstats, tempfile

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "results"); os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)
from bench_serialization import M3_FRAME
FRAME = M3_FRAME
N, WARM = 500, 50

def jl(o): return json.dumps(o, separators=(",", ":")).encode() + b"\n"

def raw_client(cmd, env=None):
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
    def rt(o):
        p.stdin.write(jl(o)); p.stdin.flush(); return p.stdout.readline()
    return p, rt

def handshake(rt, p):
    rt({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "bd", "version": "0"}}})
    p.stdin.write(jl({"jsonrpc": "2.0", "method": "notifications/initialized"})); p.stdin.flush()

def summarize(l):
    s = sorted(l); n = len(s)
    return {"median_us": statistics.median(s), "p95_us": s[int(.95 * n) - 1], "p99_us": s[int(.99 * n) - 1]}

def call_loop(rt, n, warm):
    i = [1]
    def once():
        i[0] += 1
        t0 = time.perf_counter()
        r = rt({"jsonrpc": "2.0", "id": i[0], "method": "tools/call", "params": {"name": "echo_frame", "arguments": {"frame": FRAME}}})
        return (time.perf_counter() - t0) * 1e6, r
    for _ in range(warm): once()
    lat, last = [], b""
    for _ in range(n):
        d, last = once(); lat.append(d)
    return lat, last

res = {}
# --- A + C: SDK echo server, raw client
p, rt = raw_client([sys.executable, os.path.join(HERE, "mcp_echo_server.py")]); handshake(rt, p)
lat, last = call_loop(rt, N, WARM); p.terminate()
r = json.loads(last)["result"]
req_bytes = len(jl({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "echo_frame", "arguments": {"frame": FRAME}}})) - 1
res["A_sizes"] = {"frame_json_bytes": len(json.dumps(FRAME, separators=(",", ":")).encode()), "request_bytes": req_bytes,
                  "response_bytes": len(last) - 1, "content_text_bytes": len(r["content"][0]["text"].encode()),
                  "structured_content_bytes": len(json.dumps(r["structuredContent"], separators=(",", ":")).encode())}
res["C_sdk_server_raw_client"] = summarize(lat)

# --- B: hand-rolled server returning a response of the SDK's exact size
SIZED = r'''
import sys, json
TARGET = int(sys.argv[1])
for line in sys.stdin:
    req = json.loads(line)
    result = {"jsonrpc": "2.0", "id": req["id"], "result": {"pad": ""}}
    empty = json.dumps(result, separators=(",", ":"))
    result["result"]["pad"] = "x" * (TARGET - len(empty.encode()))
    response = json.dumps(result, separators=(",", ":"))
    assert len(response.encode()) == TARGET
    sys.stdout.write(response + "\n"); sys.stdout.flush()
'''
p, rt = raw_client([sys.executable, "-c", SIZED, str(res["A_sizes"]["response_bytes"])])
lat, last = call_loop(rt, N, WARM); p.terminate()
res["B_handrolled_size_matched"] = summarize(lat) | {"response_bytes": len(last) - 1}

# hand-rolled echo at the natural 7.6 kB size (same as bench_transport jsonrpc-stdio)
ECHO = r'''
import sys, json
for line in sys.stdin:
    req = json.loads(line)
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req["id"], "result": req["params"]}, separators=(",", ":")) + "\n"); sys.stdout.flush()
'''
p, rt = raw_client([sys.executable, "-c", ECHO])
lat, last = call_loop(rt, N, WARM); p.terminate()
res["B_handrolled_echo_natural"] = summarize(lat) | {"response_bytes": len(last) - 1}

# --- D: server-side profile of the SDK echo server
prof_path = os.path.join(OUT, "echo_server.prof")
WRAP = f'''
import cProfile, runpy, sys
sys.argv = ["mcp_echo_server.py"]
pr = cProfile.Profile(); pr.enable()
try:
    runpy.run_path({os.path.join(HERE, "mcp_echo_server.py")!r}, run_name="__main__")
finally:
    pr.disable(); pr.dump_stats({prof_path!r})
'''
p, rt = raw_client([sys.executable, "-c", WRAP]); handshake(rt, p)
call_loop(rt, N, WARM)
p.stdin.close(); p.wait(timeout=20)
st = pstats.Stats(prof_path); tot = st.total_tt
import re
buckets = {}
for (fn, ln, name), (cc, nc, tt, ct, callers) in st.stats.items():
    m = re.search(r"site-packages/([^/]+)", fn)
    if m: key = m.group(1)
    elif fn.startswith("~") or fn.startswith("<"): key = "python builtins"
    elif "/lib/python" in fn: key = "stdlib:" + os.path.basename(fn).replace(".py", "")
    else: key = "bench"
    buckets[key] = buckets.get(key, 0.0) + tt
grouped = {"mcp SDK": 0.0, "pydantic": 0.0, "jsonschema/referencing": 0.0, "anyio/asyncio": 0.0, "json (stdlib/orjson)": 0.0, "other": 0.0}
for k, v in buckets.items():
    kl = k.lower()
    if kl == "mcp": grouped["mcp SDK"] += v
    elif kl.startswith("pydantic"): grouped["pydantic"] += v
    elif kl.startswith(("jsonschema", "referencing", "rpds")): grouped["jsonschema/referencing"] += v
    elif kl.startswith(("anyio", "stdlib:asyncio", "stdlib:selectors")) or "asyncio" in kl: grouped["anyio/asyncio"] += v
    elif "json" in kl: grouped["json (stdlib/orjson)"] += v
    else: grouped["other"] += v
res["D_server_profile_tottime_share"] = {k: v / tot for k, v in grouped.items()} | {"total_s": tot, "calls": N + WARM}
res["D_server_profile_top_packages"] = dict(sorted(((k, v / tot) for k, v in buckets.items()), key=lambda kv: -kv[1])[:8])
top = sorted(st.stats.items(), key=lambda kv: kv[1][3], reverse=True)[:0]
with open(os.path.join(OUT, "sdk_breakdown.json"), "w") as f: json.dump(res, f, indent=2)
print(json.dumps(res, indent=1))
