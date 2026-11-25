import json, statistics as st, os
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results_second_machine")
tr = [json.load(open(f"{H}/transport_run{i}.json"))["transports"] for i in (1, 2, 3)]
ser = [json.load(open(f"{H}/serialization_run{i}.json"))["messages"] for i in (1, 2, 3)]
ext = [json.load(open(f"{H}/serialization_extras_run{i}.json")) for i in (1, 2, 3)]
sdk = [json.load(open(f"{H}/sdk_breakdown_run{i}.json")) for i in (1, 2, 3)]
out = {"machine": "Apple M4 Pro, 12 cores, 24 GB, macOS 26.5.2, Python 3.12.11, mcp 2.3.0", "runs": 3}
def agg(vals): return {"median": st.median(vals), "min": min(vals), "max": max(vals)}
order = ["tcp-msgpack", "zenoh-pubsub", "dds-cyclone", "grpc-unary", "jsonrpc-stdio", "mcp-stdio-res", "mcp-stdio", "mcp-shttp"]
out["transport_us"] = {k: {m: agg([r[k][m] for r in tr]) for m in ("median_us", "p95_us", "p99_us")} | {"payload_bytes": tr[0][k]["payload_bytes"]} for k in order}
out["serialization_sum_us"] = {n: {f: agg([r[n][f]["encode_us"] + r[n][f]["decode_us"] for r in ser]) | {"bytes": ser[0][n][f]["bytes"]} for f in ser[0][n]} for n in ser[0]}
out["extras"] = {"M3_pb_serialize_only_us": agg([e["M3 perception_frame (50 det.)"]["pb_serialize_only_us"] for e in ext]),
                 "M3_pb_build_plus_serialize_us": agg([e["M3 perception_frame (50 det.)"]["pb_build_plus_serialize_us"] for e in ext]),
                 "M3_json_encode_us": agg([e["M3 perception_frame (50 det.)"]["json_stdlib_encode_us"] for e in ext]),
                 "M4_pb_build_plus_serialize_us": agg([e["M4 occupancy_grid (100x100)"]["pb_build_plus_serialize_us"] for e in ext]),
                 "M4_json_encode_us": agg([e["M4 occupancy_grid (100x100)"]["json_stdlib_encode_us"] for e in ext]),
                 "M4_base64_bytes": ext[0]["M4_json_base64"]["bytes"],
                 "M4_base64_enc_plus_dec_us": agg([e["M4_json_base64"]["encode_us"] + e["M4_json_base64"]["decode_us"] for e in ext]),
                 "M3_float32_max_abs_error_x_m": ext[0]["M3_float32_max_abs_error_x_m"]}
out["sdk_breakdown_us"] = {k: agg([s[k]["median_us"] for s in sdk]) for k in ("C_sdk_server_raw_client", "B_handrolled_size_matched", "B_handrolled_echo_natural")} | {"response_bytes_sdk": sdk[0]["A_sizes"]["response_bytes"], "text_content_bytes": sdk[0]["A_sizes"]["content_text_bytes"], "structured_bytes": sdk[0]["A_sizes"]["structured_content_bytes"], "request_bytes": sdk[0]["A_sizes"]["request_bytes"]}
json.dump(out, open(os.path.join(H, "aggregate.json"), "w"), indent=1)
print(out["machine"])
print("TRANSPORT (median of 3 runs; [min-max]) us")
for k in order:
    m = out["transport_us"][k]["median_us"]; p = out["transport_us"][k]["p99_us"]
    print(f"  {k:14s} med {m['median']:8.1f} [{m['min']:7.1f}-{m['max']:7.1f}]  p99 {p['median']:8.1f} [{p['min']:7.1f}-{p['max']:7.1f}]  payload {out['transport_us'][k]['payload_bytes']}")
print("SERIALIZATION enc+dec (median of 3) us")
for n, d in out["serialization_sum_us"].items():
    print(" ", n, {f: round(v["median"], 2) for f, v in d.items()})
print("EXTRAS"); [print(" ", k, v) for k, v in out["extras"].items()]
print("SDK BREAKDOWN"); [print(" ", k, v) for k, v in out["sdk_breakdown_us"].items()]
