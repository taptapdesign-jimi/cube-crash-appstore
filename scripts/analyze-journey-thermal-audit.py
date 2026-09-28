#!/usr/bin/env python3
"""Join stationary ABBA receipts to Instruments CPU samples.
No power/temperature inference: reports sampled CPU seconds per wall second.
Usage: script CONSOLE CPU_XML TOC_XML PID [PID ...]
"""
import collections
import datetime
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET


def analyze(console, cpu, toc, pids):
    events = []
    for line in Path(console).read_text().splitlines():
        if '[CC_THERMAL_ISOLATION] ' not in line:
            continue
        try:
            events.append(json.loads(line.split('[CC_THERMAL_ISOLATION] ', 1)[1]))
        except ValueError:
            continue
    start_date = ET.parse(toc).findtext('.//summary/start-date')
    epoch_ms = datetime.datetime.fromisoformat(start_date).timestamp() * 1000
    raw = Path(cpu).read_text()
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', raw)
    root = ET.fromstring(cleaned)
    ids = {node.get('id'): node for node in root.iter() if node.get('id')}
    columns = [col.findtext('mnemonic') for col in root.find('.//schema')]

    def resolve(node):
        return ids[node.get('ref')] if node.get('ref') else node

    samples = []
    all_times = []
    for row in root.findall('.//row'):
        at = epoch_ms + float(resolve(row[columns.index('time')]).text) / 1e6
        all_times.append(at)
        process = resolve(row[columns.index('process')])
        pid = process.find('pid')
        if pid is None or int(resolve(pid).text) not in pids:
            continue
        weight = float(resolve(row[columns.index('weight')]).text) / 1e9
        samples.append((at, process.get('fmt'), weight))
    if not all_times or not samples:
        raise ValueError('No samples for specified game processes')
    starts = {}
    results = collections.defaultdict(list)
    for event in events:
        key = (event.get('run'), event.get('phase'))
        if event.get('event') == 'measure-start':
            starts[key] = event
        if event.get('event') != 'measure-end' or key not in starts:
            continue
        begin = starts[key]['wall']
        end = event['wall']
        seconds = (end - begin) / 1000
        weights = collections.Counter()
        for at, process, weight in samples:
            if begin <= at < end:
                weights[process] += weight
        group = event['group']
        verified = not event['suppressed'] or (
            event.get('counts', {}).get(group, {}).get('suppressed', 0) > 0
            if group != 'journey-interim' else any(
                e.get('event') == 'owner-suspended' and e.get('group') == group
                and e.get('verified') and begin - 60000 <= e.get('wall', 0) <= begin
                for e in events))
        results[group].append({
            'phase': event['phase'], 'suppressed': event['suppressed'],
            'seconds': seconds, 'captureCovered': min(all_times) <= begin and max(all_times) >= end,
            'suppressionVerified': verified,
            'sampledCorePercent': {name: weight / seconds * 100 for name, weight in weights.items()},
            'totalSampledCorePercent': sum(weights.values()) / seconds * 100,
        })
    comparison = {}
    for group, rows in results.items():
        valid = len(rows) == 4 and [r['phase'] for r in rows] == [0, 1, 2, 3]
        valid = valid and all(r['captureCovered'] and r['suppressionVerified'] for r in rows)
        if not valid:
            comparison[group] = {'verdict': 'INCOMPLETE_OR_UNVERIFIED', 'windows': rows}
            continue
        a = (rows[0]['totalSampledCorePercent'] + rows[3]['totalSampledCorePercent']) / 2
        b = (rows[1]['totalSampledCorePercent'] + rows[2]['totalSampledCorePercent']) / 2
        drift = abs(rows[0]['totalSampledCorePercent'] - rows[3]['totalSampledCorePercent']) / max(a, 0.001)
        comparison[group] = {
            'verdict': 'BASELINE_DRIFT_REPEAT' if drift > 0.25 else 'COMPARABLE_CPU_WINDOWS',
            'enabledMean': a, 'suppressedMean': b, 'dropPercentagePoints': a - b,
            'relativeDropPercent': (a - b) / max(a, 0.001) * 100,
            'baselineDriftPercent': drift * 100, 'windows': rows,
        }
    return {'groups': comparison, 'selectedPids': sorted(pids),
            'invalidXmlControlsRemoved': len(raw) - len(cleaned),
            'scope': 'Sampled CPU workload of selected processes only. GPU-process CPU is not GPU hardware utilization or energy. Repeat the largest reversible effect before attribution. Audio is unchanged in this sequence.'}


if __name__ == '__main__':
    if len(sys.argv) < 5:
        raise SystemExit(__doc__)
    print(json.dumps(analyze(*sys.argv[1:4], {int(pid) for pid in sys.argv[4:]}), indent=2))
