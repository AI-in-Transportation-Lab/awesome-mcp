# MCP micro-benchmark and reference MAPE-K server

Executable artifact for our survey [*Model Context Protocols in Adaptive Transport Systems: A Survey*](https://arxiv.org/abs/2508.19239). It contains:

- a **serialization micro-benchmark** (JSON, orjson, MessagePack, CBOR, Protocol Buffers),
- a **transport micro-benchmark** (raw TCP, Zenoh, DDS, gRPC, JSON-RPC, MCP over stdio and Streamable HTTP),
- a **reference MAPE-K MCP server** and client, pinned to the official Python SDK 2.3.0,
- a **ROS 2 bridge** with a built-in simulator, and
- **reference results** from an Apple M4 Pro MacBook (three runs plus their aggregate).

> [!IMPORTANT]
> The benchmark is synthetic. Payloads are generated, everything runs on one host over loopback, and timings include the Python bindings. Treat the numbers as orders of magnitude only. They do not establish a timing class, a worst-case bound, or suitability for a physical control loop.

## Reference results

Median of three runs on an Apple M4 Pro (12 cores, 24 GB, macOS 26.5.2, Python 3.12.11, `mcp` 2.3.0). One round trip echoes a perception frame (M3, 50 detections), 500 timed iterations after 50 warm-up iterations per run. Source: [`results/macbook-m4-pro/aggregate.json`](results/macbook-m4-pro/aggregate.json).

| Path | Payload (B) | Median (ms) | p99 (ms) |
|---|---:|---:|---:|
| Raw TCP + MessagePack | 7,702 | 0.07 | 0.08 |
| Zenoh pub/sub | 3,445 | 0.09 | 0.17 |
| DDS (Cyclone) pub/sub | 3,445 | 0.11 | 0.19 |
| gRPC unary (Protobuf) | 3,445 | 0.15 | 0.21 |
| JSON-RPC 2.0 over stdio (no SDK) | 7,609 | 0.28 | 0.33 |
| MCP stdio `resources/read` (small object) | 126 | 0.58 | 0.65 |
| MCP stdio `tools/call` (SDK) | 7,609 | 1.01 | 1.24 |
| MCP Streamable HTTP `tools/call` (SDK) | 7,609 | 2.12 | 3.04 |

## Setup

Requires Python 3.11 or later.

```bash
cd benchmark
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 verify_artifact.py        # functional checks, exits non-zero on failure
```

`requirements.txt` pins MCP 2.3.0 and gives minimum versions for the checked-in generated gRPC and Protobuf bindings. `requirements-verified.txt` records a full environment that was verified.

## Scripts

| Script | Purpose | Command |
|---|---|---|
| `bench_serialization.py` | payload sizes and encode/decode times | `python3 bench_serialization.py --iters 2000 --rounds 5` |
| `bench_transport.py` | loopback round trips over eight paths; uses `mcp_echo_server.py`, `context.proto`, the Cyclone DDS and Zenoh bindings | `python3 bench_transport.py --iters 500 --warmup 50` |
| `bench_sdk_breakdown.py` | size-matched ablation of the SDK overhead | `python3 bench_sdk_breakdown.py` |
| `mcp_mapek_server.py`, `mcp_client_demo.py` | reference MAPE-K server and a client that runs one cycle; `--trace` prints every JSON-RPC message | `python3 mcp_client_demo.py --trace` |
| `ros2_mcp_bridge.py` | two-plane bridge for ROS 2 (runs against a simulator when ROS 2 is absent) | `python3 ros2_mcp_bridge.py` |
| `run_replication.sh` | three repetitions of every benchmark plus an aggregate | `./run_replication.sh my-machine` |
| `verify_artifact.py` | real stdio client/server checks | `python3 verify_artifact.py` |

## Results layout

The benchmark scripts write their latest output to `results/`, which is git-ignored. Only the reference runs are committed:

```text
results/
└── macbook-m4-pro/      three runs + aggregate.json (committed reference)
```

`./run_replication.sh <label>` writes to `results/<label>/` and aggregates there. It never touches `macbook-m4-pro/`.

## Verification and limits

`verify_artifact.py` exercises real stdio client/server exchanges: invalid plans, unknown targets, stale-plan rejection, apply and readback, replay rejection, the confirmation argument, prompt retrieval, subscribe/unsubscribe, filtered update notifications, and the bridge interface.

- The server registers legacy per-URI subscribe/unsubscribe handlers on the pinned SDK's low-level server and filters update notifications by connection and URI. Moving to another SDK revision requires rechecking those integration points. SDK 2.3.0 negotiates the 2025-11-25 protocol revision in the legacy `ClientSession` examples although it reports 2026-07-28 as its latest; the latter is not exercised.
- Sampling, elicitation, asynchronous tasks, and HTTP stream resumption are not demonstrated.
- The `confirm` argument can be set by the caller and is not authenticated human approval. The observation tool is not idempotent because it increments the application context version.
- Without ROS 2, `ros2_mcp_bridge.py` uses a synthetic feeder: parameter changes are local and `applied_to_ros` and `published` are false. A passing simulator-backed check is not a live ROS 2 integration test or a physical-system safety test.
- `measure_response_size.py` launches the sibling echo server and uses the same M3 payload as the serialization benchmark. The size-matched ablation builds valid JSON responses at the exact target byte length, accounting for request-ID length.
- The generated Protobuf files correspond to `context.proto`; they are not result tables.
- All payloads and the fallback bridge stream are synthetic. The network, SDK and middleware calls, and the elapsed-time measurements, are real. They do not model real traffic, contention, human approval, or deterministic control.
