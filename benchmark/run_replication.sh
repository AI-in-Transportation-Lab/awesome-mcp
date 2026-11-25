#!/usr/bin/env bash
# Repeats both benchmarks three times on the current machine and aggregates the medians.
# Needs: pip install -r requirements.txt   (Python >= 3.11).
# Usage: ./run_replication.sh [label]    (default label: local)
# Results: results/<label>/   The committed reference runs are in results/macbook-m4-pro/.
set -e; cd "$(dirname "$0")"
LABEL="${1:-local}"; OUT="results/$LABEL"; mkdir -p "$OUT"
for i in 1 2 3; do
  python3 bench_serialization.py >/dev/null; cp results/serialization_results.json "$OUT/serialization_run$i.json"; cp results/serialization_extras.json "$OUT/serialization_extras_run$i.json"
  python3 bench_transport.py >/dev/null;     cp results/transport_results.json "$OUT/transport_run$i.json"
  python3 bench_sdk_breakdown.py >/dev/null; cp results/sdk_breakdown.json "$OUT/sdk_breakdown_run$i.json"
done
python3 aggregate_replication.py "$LABEL"
