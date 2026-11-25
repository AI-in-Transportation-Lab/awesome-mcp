"""Measure the actual wire size of the MCP SDK's tools/call response to echo_frame (raw JSON-RPC over stdio)."""
import json, subprocess, sys, os
from bench_serialization import M3_FRAME
FRAME = M3_FRAME
p = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), 'mcp_echo_server.py')],
                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
def send(o): p.stdin.write(json.dumps(o, separators=(',', ':')).encode() + b'\n'); p.stdin.flush()
def recv(): return p.stdout.readline()
send({"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"m","version":"0"}}})
init = recv(); send({"jsonrpc":"2.0","method":"notifications/initialized"})
req = {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"echo_frame","arguments":{"frame":FRAME}}}
send(req); resp = recv()
r = json.loads(resp)['result']
req_b = len(json.dumps(req, separators=(',', ':')).encode())
print('request bytes (compact JSON-RPC):', req_b)
print('response bytes (as sent by SDK):', len(resp))
print('result keys:', list(r.keys()))
print('content[0].text bytes:', len(r['content'][0]['text'].encode()), '| structuredContent bytes:', len(json.dumps(r['structuredContent'], separators=(',', ':')).encode()))
print('text content is indented/pretty?', r['content'][0]['text'][:80].replace('\n','\\n'))
print('frame compact JSON bytes:', len(json.dumps(FRAME, separators=(',', ':')).encode()))
p.terminate()
p.wait(timeout=10)
