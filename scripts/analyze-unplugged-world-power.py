#!/usr/bin/env python3
"""Compare validated static/animated windows with exported SYSTEM power.
Usage: ... CONSOLE_OR_NATIVE_JSONL TOC_XML SystemPowerLevel.xml
Units are percent of full battery per hour, never CPU percentage or watts.
"""
import json
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path


def analyze(log, toc, power):
    events = []
    for line in Path(log).read_text().splitlines():
        try:
            if line.startswith('{'):
                line = json.loads(line).get('message', '')
            if '[CC_THERMAL_ISOLATION] ' not in line:
                continue
            row = json.loads(line.split('[CC_THERMAL_ISOLATION] ', 1)[1])
            if row.get('protocol') == 'unplugged-static-animated-static':
                events.append(row)
        except (ValueError, TypeError):
            continue
    runs = {row.get('run') for row in events if row.get('event') == 'start'}
    if len(runs) != 1:
        raise ValueError('Select exactly one test run')
    run = next(iter(runs))
    events = [row for row in events if row.get('run') == run]
    if not any(row.get('event') == 'stop' and row.get('complete') for row in events):
        raise ValueError('Incomplete or interrupted test')
    epoch = datetime.fromisoformat(ET.parse(toc).findtext('.//start-date')).timestamp() * 1000
    root = ET.parse(power).getroot()
    ids = {node.get('id'): node for node in root.iter() if node.get('id')}
    schema = root.find('.//schema')
    columns = [col.findtext('mnemonic') for col in schema]
    units = {col.findtext('mnemonic'): col.findtext('engineering-type') for col in schema}
    if units.get('power-usage') != 'percent-per-hour':
        raise ValueError('Unexpected power units')
    samples = []
    for row in root.iter('row'):
        values = {}
        for column, cell in zip(columns, row):
            cell = ids[cell.get('ref')] if cell.get('ref') else cell
            try:
                values[column] = float(cell.text)
            except (ValueError, TypeError):
                pass
        if all(key in values for key in ('start', 'duration', 'power-usage')):
            start = epoch + values['start'] / 1e6
            samples.append((start, start + values['duration'] / 1e6, values))
    windows = []
    for phase in range(4):
        starts = [row for row in events if row.get('phase') == phase and row.get('event') == 'measure-start']
        ends = [row for row in events if row.get('phase') == phase and row.get('event') == 'measure-end']
        if len(starts) != 1 or len(ends) != 1:
            raise ValueError('Missing/duplicate phase receipts')
        begin, end = starts[0], ends[0]
        static = phase in (0, 3)
        if begin.get('suppressed') != static or end.get('suppressed') != static:
            raise ValueError('Wrong phase order')
        if static and end.get('staticSampledVerified') is not True:
            raise ValueError('Static scene was not verified')
        for event in (begin, end):
            native = event.get('native', {})
            if native.get('batteryState') != 1 or not native.get('persistenceAvailable'):
                raise ValueError('Unplugged persistence not verified')
        if static:
            counts = end.get('counts', {})
            for owner in ('ambient', 'journey-units'):
                if counts.get(owner, {}).get('suppressed', 0) <= 0:
                    raise ValueError('Missing owner suppression receipt: ' + owner)
        duration = end['wall'] - begin['wall']
        if duration < 160000:
            raise ValueError('Truncated measurement window')
        weighted = coverage = 0
        brightness = []
        covered_until = begin['wall']
        largest_gap = 0
        for start, finish, values in sorted(samples, key=lambda sample: sample[0]):
            overlap = min(finish, end['wall']) - max(start, begin['wall'])
            if overlap <= 0:
                continue
            largest_gap = max(largest_gap, max(0, start - covered_until))
            covered_until = max(covered_until, min(finish, end['wall']))
            coverage += overlap
            weighted += overlap * values['power-usage']
            if 'display-brightness' in values:
                brightness.append(values['display-brightness'])
        largest_gap = max(largest_gap, end['wall'] - covered_until)
        if coverage < duration * .95 or largest_gap > 5000:
            raise ValueError('Insufficient system power coverage')
        if not brightness or max(brightness) - min(brightness) > 2:
            raise ValueError('Missing or changing display brightness')
        windows.append({'phase': phase, 'static': static, 'batteryPercentPerHour': weighted / coverage,
                        'coverage': coverage / duration, 'brightnessMin': min(brightness), 'brightnessMax': max(brightness),
                        'thermalStart': begin['native']['thermalState'], 'thermalEnd': end['native']['thermalState']})
    if max(row['brightnessMax'] for row in windows) - min(row['brightnessMin'] for row in windows) > 2:
        raise ValueError('Brightness differs between phases')
    static = (windows[0]['batteryPercentPerHour'] + windows[3]['batteryPercentPerHour']) / 2
    animated = (windows[1]['batteryPercentPerHour'] + windows[2]['batteryPercentPerHour']) / 2
    drift = abs(windows[0]['batteryPercentPerHour'] - windows[3]['batteryPercentPerHour']) / max(static, .001)
    return {'verdict': 'REPEAT_BASELINE_DRIFT' if drift > .2 else 'VALID_COMPARISON', 'windows': windows,
            'staticMean': static, 'animatedMean': animated, 'animatedMinusStatic': animated - static,
            'staticBaselineDriftFraction': drift,
            'scope': 'Whole-device power with instrumentation. Thermal lags workload. Not exact temperature, GPU utilization, app-only watts, or proof of a single offending owner.'}


if __name__ == '__main__':
    try:
        print(json.dumps(analyze(*sys.argv[1:]), indent=2))
    except (ValueError, TypeError, OSError, ET.ParseError, KeyError) as error:
        print(json.dumps({'verdict': 'INVALID', 'reason': str(error)}))
        sys.exit(1)
