# MCP micro-benchmark and reference MAPE-K server

Companion code for the survey *Model Context Protocols in Adaptive Transport Systems* (Section 7.3 and the reference model).

Requires Python 3.11 or later. Install the dependencies with `pip install -r requirements.txt`.
Tested on Linux x86-64 with Python 3.12. SDK 2.3.0 negotiates the 2025-11-25 revision (MCP-4) in the legacy ClientSession examples although it reports 2026-07-28 (MCP-5) as its latest. The latter revision is not exercised here.

| Script | Purpose | Command |
|---|---|---|
| `bench_serialization.py` | serialization table (payload sizes and encode/decode times) | `python3 bench_serialization.py --iters 2000 --rounds 5` |
| `bench_transport.py` | transport table (loopback round trips over eight paths); uses `mcp_echo_server.py`, `context.proto`, the Cyclone DDS and Zenoh bindings | `python3 bench_transport.py --iters 500 --warmup 50` |
| `bench_sdk_breakdown.py` | size-matched ablation of the SDK overhead | `python3 bench_sdk_breakdown.py` |
| `mcp_mapek_server.py`, `mcp_client_demo.py` | reference MAPE-K server (the version-pinned Execute code box) and a client that runs one cycle; `--trace` prints every JSON-RPC message | `python3 mcp_client_demo.py --trace` |
| `ros2_mcp_bridge.py` | two-plane bridge for ROS 2 (runs with a built-in simulator when ROS 2 is absent) | `python3 ros2_mcp_bridge.py` |
| `run_replication.sh` | three repetitions of both benchmarks and their aggregate | `./run_replication.sh` |

`results/` holds the original run behind the serialization and transport tables. `results_second_machine/` holds three runs on an Apple M4 Pro (macOS 26.5.2, Python 3.12.11, mcp 2.3.0) and `aggregate.json`.
`mcp_mapek_server.py` sends resource-update notifications; the first release called a method that does not exist in the SDK and silently sent none.
The benchmark is synthetic; it indicates orders of magnitude only.

## Verification and limits

Run `python3 verify_artifact.py` to exercise real stdio client/server exchanges. The checks include invalid plans, unknown targets, stale-plan rejection, successful apply/readback, replay rejection, the confirmation argument, prompt retrieval, subscribe/unsubscribe, filtered update notifications, and the bridge interface. Exit status is nonzero on failed assertions.

The corrected server registers legacy per-URI subscribe/unsubscribe handlers and filters update notifications by connection and URI. The client checks the advertised capability before subscribing. The functional checks verify subscription, delivery, and removal after unsubscribe. The handlers use the pinned SDK low-level server and per-client connection; moving to another SDK revision requires rechecking those integration points. Sampling, elicitation, asynchronous tasks, and HTTP stream resumption are not demonstrated. The `confirm` argument can be set by the caller and is not authenticated human approval. The observation tool is not idempotent because it increments the application context version.

Without ROS 2 installed, `ros2_mcp_bridge.py` uses its built-in synthetic feeder. In that mode parameter changes are local and `applied_to_ros` and `published` are false. A successful simulator-backed interface check is not a live ROS 2 integration test or a physical-system safety test.

`measure_response_size.py` now launches the sibling echo server and uses the same M3 payload as the serialization benchmark. The size-matched ablation constructs valid JSON responses at the exact target byte length, accounting for request-ID length.

`requirements.txt` pins MCP 2.3.0 and specifies the minimum versions required by the checked-in compiler-generated bindings. `requirements-verified.txt` records the complete environment used for this verification. The generated Protobuf files correspond to `context.proto`; they are not synthetic result tables.

All payloads and the fallback bridge stream are synthetic. The network/SDK/middleware calls and elapsed-time measurements are real. They do not model real traffic, network contention, human approval, or deterministic control. Re-running a benchmark changes `results/`; preserve the supplied historical files or run in a copy. Historical manuscript tables are not automatically replaced by a fresh verification run.

