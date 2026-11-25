#!/usr/bin/env python3
r"""
bench_serialization.py
======================
Serialization micro-benchmark for the TAAS survey revision (Section 7.3).

[v2] Same measurement logic as the released version; additions: (i) M3_FRAME is the single frame object shared with
bench_transport.py, (ii) bench_extras() quantifies three caveats of the main table (Protobuf message-build cost,
base64-in-JSON grid, float32 vs float64 content).  Main table/figures are unchanged in structure.

Compares the payload size and encode/decode cost of representative
context objects when encoded as

  * JSON  (stdlib, compact separators)   -- the encoding MCP/JSON-RPC mandates
  * orjson (fast JSON, same wire bytes)  -- shows how much is encoder, not format
  * MessagePack                           -- schema-less binary
  * CBOR (RFC 8949)                        -- schema-less binary
  * Protocol Buffers (proto3)              -- schema-based binary (gRPC, ROS 2 bridges)

Four message classes are used, mirroring the JSON-RPC examples in the paper:

  M1 route_request            small supervisory request       (~0.3 kB JSON)
  M2 link_state_notification  small event/notification         (~0.2 kB JSON)
  M3 perception_frame         50 detections, cooperative perception (~7.6 kB JSON)
  M4 occupancy_grid           100x100 int8 grid                (~25.9 kB JSON as an int list)

Outputs (in ./results):
  serialization_results.json      raw numbers
  serialization_table.tex         LaTeX tabular rows (\input in the manuscript)
  serialization_sizes.pdf/.png    figure: payload size by format
  serialization_times.pdf/.png    figure: encode+decode time by format

Run:  python3 bench_serialization.py [--iters 2000] [--rounds 5]
Requires: msgpack, cbor2, orjson, protobuf (and context_pb2.py from context.proto)
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import platform
import random
import statistics
import sys
import time
from typing import Any, Callable, Dict, Tuple

import cbor2
import msgpack
import orjson

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import context_pb2 as pb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "results")
os.makedirs(OUT, exist_ok=True)

random.seed(7)

# --------------------------------------------------------------------------
# Representative context objects (Python dicts == JSON-RPC "params"/"result")
# --------------------------------------------------------------------------

def make_route_request() -> Dict[str, Any]:
    return {
        "request_id": "req-route-1",
        "origin": {"lat": 29.8851, "lon": -97.9405},
        "destination": {"lat": 29.8893, "lon": -97.9421},
        "constraints": {
            "max_travel_time_s": 600,
            "avoid_links": ["RSU-23-RSU-24"],
            "priority": "safety",
        },
    }


def make_link_state() -> Dict[str, Any]:
    return {
        "link_id": "RSU-23-RSU-24",
        "new_state": "degraded",
        "expected_latency_increase_ms": 30,
        "timestamp": "2025-01-01T08:23:10Z",
    }


def make_perception_frame(n: int = 50) -> Dict[str, Any]:
    dets = []
    for i in range(n):
        dets.append({
            "id": i,
            "cls": random.choice(["car", "truck", "pedestrian", "cyclist", "bus"]),
            "x": round(random.uniform(-80, 80), 3),
            "y": round(random.uniform(-80, 80), 3),
            "z": round(random.uniform(-2, 4), 3),
            "vx": round(random.uniform(-20, 20), 3),
            "vy": round(random.uniform(-20, 20), 3),
            "cov": [round(random.uniform(0, 1), 4) for _ in range(6)],
            "confidence": round(random.uniform(0.3, 1.0), 3),
        })
    return {
        "source_id": "RSU-23",
        "frame_id": "map",
        "stamp_s": 1735719790.123,
        "context_version": "net-topology:v3.2",
        "detections": dets,
    }


def make_occupancy_grid(w: int = 100, h: int = 100) -> Dict[str, Any]:
    cells = [random.choice([0, 0, 0, 100, -1]) for _ in range(w * h)]
    return {
        "frame_id": "map",
        "stamp_s": 1735719790.123,
        "width": w,
        "height": h,
        "resolution_m": 0.5,
        "cells": cells,  # JSON: list of ints; binary formats: bytes
    }


M3_FRAME = make_perception_frame(50)

MESSAGES: Dict[str, Dict[str, Any]] = {
    "M1 route_request": make_route_request(),
    "M2 link_state_notification": make_link_state(),
    "M3 perception_frame (50 det.)": M3_FRAME,
    "M4 occupancy_grid (100x100)": make_occupancy_grid(),
}

# --------------------------------------------------------------------------
# Encoders / decoders
# --------------------------------------------------------------------------

def _to_binary_friendly(obj: Dict[str, Any]) -> Dict[str, Any]:
    """For schema-less binary formats, carry the int8 grid as bytes."""
    if "cells" in obj and isinstance(obj["cells"], list):
        o = dict(obj)
        o["cells"] = bytes((c + 256) % 256 for c in obj["cells"])
        return o
    return obj


def json_enc(o): return json.dumps(o, separators=(",", ":")).encode()
def json_dec(b): return json.loads(b)
def orjson_enc(o): return orjson.dumps(o)
def orjson_dec(b): return orjson.loads(b)
def msgpack_enc(o): return msgpack.packb(o, use_bin_type=True)
def msgpack_dec(b): return msgpack.unpackb(b, raw=False)
def cbor_enc(o): return cbor2.dumps(o)
def cbor_dec(b): return cbor2.loads(b)


def pb_build(name: str, o: Dict[str, Any]):
    if name.startswith("M1"):
        m = pb.RoutePlanRequest(request_id=o["request_id"])
        m.origin.lat, m.origin.lon = o["origin"]["lat"], o["origin"]["lon"]
        m.destination.lat, m.destination.lon = o["destination"]["lat"], o["destination"]["lon"]
        m.constraints.max_travel_time_s = o["constraints"]["max_travel_time_s"]
        m.constraints.avoid_links.extend(o["constraints"]["avoid_links"])
        m.constraints.priority = o["constraints"]["priority"]
        return m
    if name.startswith("M2"):
        return pb.LinkStateChanged(**o)
    if name.startswith("M3"):
        m = pb.PerceptionFrame(source_id=o["source_id"], frame_id=o["frame_id"],
                               stamp_s=o["stamp_s"], context_version=o["context_version"])
        for d in o["detections"]:
            dd = m.detections.add()
            dd.id, dd.cls = d["id"], d["cls"]
            dd.x, dd.y, dd.z, dd.vx, dd.vy = d["x"], d["y"], d["z"], d["vx"], d["vy"]
            dd.cov.extend(d["cov"])
            dd.confidence = d["confidence"]
        return m
    if name.startswith("M4"):
        return pb.OccupancyGrid(frame_id=o["frame_id"], stamp_s=o["stamp_s"], width=o["width"],
                                height=o["height"], resolution_m=o["resolution_m"],
                                cells=bytes((c + 256) % 256 for c in o["cells"]))
    raise ValueError(name)


PB_TYPES = {"M1": pb.RoutePlanRequest, "M2": pb.LinkStateChanged,
            "M3": pb.PerceptionFrame, "M4": pb.OccupancyGrid}

FORMATS = ["JSON (stdlib)", "JSON (orjson)", "MessagePack", "CBOR", "Protobuf"]


def bench_one(name: str, obj: Dict[str, Any], iters: int, rounds: int) -> Dict[str, Dict[str, float]]:
    pbmsg = pb_build(name, obj)
    pbtype = PB_TYPES[name[:2]]
    bobj = _to_binary_friendly(obj)  # same content; int8 grid carried as bytes (outside timed loop)
    cases: Dict[str, Tuple[Callable, Callable, Any]] = {
        "JSON (stdlib)": (json_enc, json_dec, obj),
        "JSON (orjson)": (orjson_enc, orjson_dec, obj),
        "MessagePack": (msgpack_enc, msgpack_dec, bobj),
        "CBOR": (cbor_enc, cbor_dec, bobj),
        "Protobuf": (lambda m: m.SerializeToString(), lambda b: pbtype.FromString(b), pbmsg),
    }
    res = {}
    for fmt, (enc, dec, src) in cases.items():
        wire = enc(src)
        enc_med, dec_med = [], []
        for _ in range(rounds):
            t0 = time.perf_counter()
            for _ in range(iters):
                enc(src)
            t1 = time.perf_counter()
            for _ in range(iters):
                dec(wire)
            t2 = time.perf_counter()
            enc_med.append((t1 - t0) / iters * 1e6)
            dec_med.append((t2 - t1) / iters * 1e6)
        res[fmt] = {
            "bytes": len(wire),
            "gzip_bytes": len(gzip.compress(wire, 6)),
            "encode_us": statistics.median(enc_med),
            "decode_us": statistics.median(dec_med),
        }
    return res



def bench_extras(iters: int, rounds: int) -> Dict[str, Any]:
    """Quantify caveats of the main table. All numbers are per object, median of `rounds` rounds."""
    import base64
    def timeit(fn, arg):
        meds = []
        for _ in range(rounds):
            t0 = time.perf_counter()
            for _ in range(iters):
                fn(arg)
            meds.append((time.perf_counter() - t0) / iters * 1e6)
        return statistics.median(meds)
    out: Dict[str, Any] = {}
    # (1) Protobuf cost when the application holds a Python dict (build + serialize), vs the message-already-built figure
    for name, obj in MESSAGES.items():
        pbmsg = pb_build(name, obj)
        out[name] = {
            "pb_serialize_only_us": timeit(lambda m: m.SerializeToString(), pbmsg),
            "pb_build_plus_serialize_us": timeit(lambda o: pb_build(name, o).SerializeToString(), obj),
            "json_stdlib_encode_us": timeit(json_enc, obj),
        }
    # (2) M4 with the grid as a base64 string (the idiom MCP uses for binary content) instead of an int list
    g = MESSAGES["M4 occupancy_grid (100x100)"]
    b64 = dict(g); b64["cells"] = base64.b64encode(bytes((c + 256) % 256 for c in g["cells"])).decode()
    wire = json_enc(b64)
    out["M4_json_base64"] = {"bytes": len(wire), "ratio_vs_json_intlist": len(wire) / len(json_enc(g)),
                             "encode_us": timeit(json_enc, b64), "decode_us": timeit(json_dec, wire),
                             "orjson_encode_us": timeit(orjson_enc, b64), "orjson_decode_us": timeit(orjson_dec, wire)}
    # (3) float32 round-trip error of the Protobuf M3 frame relative to the float64 JSON content
    m = pb_build("M3", M3_FRAME); back = pb.PerceptionFrame.FromString(m.SerializeToString())
    err = max(abs(a.x - d["x"]) for a, d in zip(back.detections, M3_FRAME["detections"]))
    out["M3_float32_max_abs_error_x_m"] = err
    return out

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=2000)
    ap.add_argument("--rounds", type=int, default=5)
    args = ap.parse_args()

    results = {"meta": {
        "python": sys.version.split()[0], "platform": platform.platform(),
        "cpu": platform.processor() or "n/a", "iters": args.iters, "rounds": args.rounds,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }, "messages": {}}

    for name, obj in MESSAGES.items():
        print(f"== {name}")
        r = bench_one(name, obj, args.iters, args.rounds)
        results["messages"][name] = r
        for fmt in FORMATS:
            v = r[fmt]
            print(f"  {fmt:15s} {v['bytes']:7d} B  (gz {v['gzip_bytes']:6d})  "
                  f"enc {v['encode_us']:8.1f} us  dec {v['decode_us']:8.1f} us")

    with open(os.path.join(OUT, "serialization_results.json"), "w") as f:
        json.dump(results, f, indent=2)
    extras = bench_extras(args.iters, args.rounds)
    with open(os.path.join(OUT, "serialization_extras.json"), "w") as f:
        json.dump(extras, f, indent=2)
    print("extras:", json.dumps(extras, indent=1)[:1500])

    # ---------------- LaTeX table ----------------
    lines = []
    for name, r in results["messages"].items():
        base = r["JSON (stdlib)"]["bytes"]
        first = True
        for fmt in FORMATS:
            v = r[fmt]
            ratio = v["bytes"] / base
            lab = name.replace("_", "\\_").replace("x", "$\\times$") if first else ""
            lines.append(f"{lab} & {fmt} & {v['bytes']:,} & {ratio:.2f} & {v['gzip_bytes']:,} & "
                         f"{v['encode_us']:.1f} & {v['decode_us']:.1f} \\\\")
            first = False
        lines.append("\\midrule")
    lines = lines[:-1]
    head = ["\\begin{tabular}{llrrrrr}", "\\toprule",
            "\\rowcolor{blue!6}\\textbf{Object} & \\textbf{Encoding} & \\textbf{Bytes} & \\textbf{Ratio} & "
            "\\textbf{gzip bytes} & \\textbf{Encode (µs)} & \\textbf{Decode (µs)} \\\\", "\\midrule"]
    tail = ["\\bottomrule", "\\end{tabular}"]
    with open(os.path.join(OUT, "serialization_table.tex"), "w") as f:
        f.write("%% generated by bench_serialization.py -- complete tabular, \\input it directly\n")
        f.write("\n".join(head + lines + tail) + "\n")

    # ---------------- Figures ----------------
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    names = list(results["messages"].keys())
    short = ["M1 route req.", "M2 link event", "M3 perception (50)", "M4 grid 100x100"]
    x = np.arange(len(names)); w = 0.16
    colors = ["#1f4e79", "#2e75b6", "#9dc3e6", "#7f7f7f", "#c55a11"]

    fig, ax = plt.subplots(figsize=(7.2, 3.1))
    for i, fmt in enumerate(FORMATS):
        vals = [results["messages"][n][fmt]["bytes"] for n in names]
        ax.bar(x + (i - 2) * w, vals, w, label=fmt, color=colors[i])
    ax.set_yscale("log"); ax.set_ylabel("payload size (bytes, log)")
    ax.set_xticks(x); ax.set_xticklabels(short, fontsize=9)
    ax.grid(axis="y", alpha=.3, which="both"); ax.legend(fontsize=8, ncol=3, frameon=False)
    ax.set_title("Wire size of representative context objects by encoding", fontsize=10)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "serialization_sizes.pdf")); fig.savefig(os.path.join(OUT, "serialization_sizes.png"), dpi=200)

    fig, ax = plt.subplots(figsize=(7.2, 3.1))
    for i, fmt in enumerate(FORMATS):
        vals = [results["messages"][n][fmt]["encode_us"] + results["messages"][n][fmt]["decode_us"] for n in names]
        ax.bar(x + (i - 2) * w, vals, w, label=fmt, color=colors[i])
    ax.set_yscale("log"); ax.set_ylabel("encode + decode time (µs, log)")
    ax.set_xticks(x); ax.set_xticklabels(short, fontsize=9)
    ax.grid(axis="y", alpha=.3, which="both"); ax.legend(fontsize=8, ncol=3, frameon=False)
    ax.set_title("Serialization cost (single core, Python bindings)", fontsize=10)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "serialization_times.pdf")); fig.savefig(os.path.join(OUT, "serialization_times.png"), dpi=200)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
