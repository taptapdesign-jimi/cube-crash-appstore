"""Verify a copied actual Native capture; this is not a synthetic producer."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("capture", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
raw = args.capture.read_bytes()
lines = raw.splitlines()
assert raw.endswith(b"\n"), "Incomplete final JSONL row"
assert 1 <= len(lines) <= 720, "Capture row bound"
assert all(len(line) <= 4096 for line in lines), "Capture line bound"
rows = [json.loads(line) for line in lines]
assert [row["sequence"] for row in rows] == list(range(1, len(rows) + 1))
assert all(row["schema"] == "native-diagnostics-v1" for row in rows)
assert all(row["webRuntime"] == "absent" for row in rows)
assert all(row["product"] == "com.taptapdesign.stacktosix.native" for row in rows)
assert all(row["persistenceAvailable"] is True for row in rows)
assert all(row["nativeThermalTelemetryEnabled"] is True for row in rows)
assert all(type(row["wall"]) is int for row in rows)
assert all(a["wall"] <= b["wall"] for a, b in zip(rows, rows[1:]))
assert rows[0]["reason"] == "telemetry-start"
background = next(i for i, row in enumerate(rows) if row["reason"] == "app-background")
resumed = next(i for i in range(background + 1, len(rows)) if rows[i]["reason"] == "app-active")
assert any(row["reason"] == "interval" for row in rows[:background]), "No actual pre-background interval"
assert not any(row["reason"] == "interval" for row in rows[background:resumed]), "Background interval work"
assert any(row["reason"] == "interval" for row in rows[resumed:]), "No actual resumed interval"
quiet_ms = rows[resumed]["wall"] - rows[background]["wall"]
assert quiet_ms >= 7500, "Actual background observation was too short"
result = {
    "captureSHA256": hashlib.sha256(raw).hexdigest(),
    "rows": len(rows), "reasons": [row["reason"] for row in rows],
    "backgroundQuietMilliseconds": quiet_ms,
    "noBackgroundIntervalRows": True,
    "performanceModeValues": sorted({row["performanceDiagnosticsEnabled"] for row in rows}),
    "scope": "Actual copied Simulator OS capture chronology; pair with terminal UI test and profile preservation evidence",
    "limits": ["Not physical iPhone thermal/battery/audio/touch acceptance", "Not presented GPU FPS"],
}
args.output.write_text(json.dumps(result, indent=2) + "\n")
print(f"PASS actual Native OS capture: {len(rows)} rows, {quiet_ms}ms background without intervals")
