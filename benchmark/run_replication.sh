#!/usr/bin/env bash
# Repeats both benchmarks three times on the current machine and aggregates the medians.
# Needs: pip install -r requirements.txt   (Python >= 3.11).  Results: results_second_machine/
set -e; cd "$(dirname "$0")"; mkdir -p results_second_machine
for i in 1 2 3; do
  python3 bench_serialization.py >/dev/null; cp results/serialization_results.json results_second_machine/serialization_run$i.json; cp results/serialization_extras.json results_second_machine/serialization_extras_run$i.json
  python3 bench_transport.py >/dev/null;     cp results/transport_results.json results_second_machine/transport_run$i.json
  python3 bench_sdk_breakdown.py >/dev/null; cp results/sdk_breakdown.json results_second_machine/sdk_breakdown_run$i.json
done
python3 aggregate_replication.py
