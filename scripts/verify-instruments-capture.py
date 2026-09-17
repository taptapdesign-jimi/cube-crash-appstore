#!/usr/bin/env python3
"""Validate exported Instruments samples before claiming CPU/power coverage.

Usage: python3 scripts/verify-instruments-capture.py CAPTURE_DIRECTORY
Export time-profile to cpu.xml and the named power tables to their .xml files.
This reads saved exports only; it never starts, stops or changes the device.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def inspect(directory):
    tables = {}
    for filename, metric in (
        ("cpu.xml", "weight"),
        ("ProcessSubsystemPowerImpact.xml", "cpu-impact"),
        ("SystemPowerLevel.xml", "power-usage"),
    ):
        try:
            root = ET.parse(directory / filename).getroot()
            ids = {e.get("id"): e for e in root.iter() if e.get("id")}
            columns = [e.findtext("mnemonic") for e in root.find(".//schema")]
            index = columns.index(metric)
            rows = list(root.iter("row"))
            numeric = 0
            for row in rows:
                cell = row[index]
                cell = ids[cell.get("ref")] if cell.get("ref") else cell
                if cell.tag != "sentinel":
                    try:
                        float(cell.text)
                        numeric += 1
                    except (TypeError, ValueError):
                        pass
            tables[filename] = {"rows": len(rows), "numericSamples": numeric}
        except (OSError, ET.ParseError, TypeError, ValueError, KeyError, IndexError) as error:
            tables[filename] = {"rows": 0, "numericSamples": 0, "error": str(error)}
    usable = all(table["numericSamples"] > 0 for table in tables.values())
    return {"verdict": "PASS" if usable else "FAIL", "tables": tables,
            "scope": "Sample presence only; process identity, time coverage, units and comparable conditions still require review."}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: verify-instruments-capture.py CAPTURE_DIRECTORY")
    result = inspect(Path(sys.argv[1]))
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["verdict"] == "PASS" else 1)
