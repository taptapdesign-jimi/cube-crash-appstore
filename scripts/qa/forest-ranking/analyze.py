#!/usr/bin/env python3
"""Analyze paired core experiments. Synthetic proportions are not player odds."""
import argparse
import collections
import csv
import hashlib
import json
import math
from pathlib import Path
import statistics

parser = argparse.ArgumentParser()
parser.add_argument('input', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
rows = [json.loads(line) for line in args.input.open()]
assert rows and len({(r['board'], r['seed'], r['policy']) for r in rows}) == len(rows)
assert all(r['validationErrors'] == 0 and r['traceMatched'] for r in rows)
assert all(r['outcome'] in ['complete', 'fail', 'bounded'] for r in rows)
assert all(r['final'] == min(999999, r['base'] + r['comboBonus'] + r['efficiency']) for r in rows)
groups = collections.defaultdict(list)
for r in rows:
    groups[r['board'], r['seed'], r['policy'].split('-')[1]].append(r)
for group in groups.values():
    assert len(group) == 4
    assert len({json.dumps(r['trace'], sort_keys=True) for r in group}) == 1
    assert len({(r['outcome'], r['actions'], r['drops'], r['movesLeft']) for r in group}) == 1
    for r in group:
        if r['policy'].startswith('continuous'):
            assert r['capOvershoots'] == 0

def median(values):
    return statistics.median(values) if values else None

def quantile(values, fraction):
    return sorted(values)[min(len(values)-1, max(0, math.ceil(len(values)*fraction)-1))] if values else None

summaries = []
for board in range(1, 11):
    for style in ['continuous', 'half', 'cap4', 'single']:
        selected = [r for r in rows if r['board'] == board and r['policy'].startswith(style+'-')]
        clean = [r for r in selected if r['outcome'] == 'complete']
        scores = [r['final'] for r in clean]
        summaries.append(dict(board=board, style=style, attempts=len(selected), completed=len(clean),
            completion_percent=round(100*len(clean)/len(selected), 1), median=median(scores),
            p10=quantile(scores, .1), p90=quantile(scores, .9),
            maximum=max(scores, default=None), peak_combo_median=median([r['peakCombo'] for r in clean]),
            base_median=median([r['base'] for r in clean]),
            combo_bonus_median=median([r['comboBonus'] for r in clean]),
            efficiency_median=median([r['efficiency'] for r in clean]),
            actions_median=median([r['actions'] for r in clean]),
            runs_above_nominal_combo_cap=sum(r['capOvershoots'] > 0 for r in selected)))

# Provisional anchors, fitted only on the first60%; remaining40% are untouched.
# Midpoints distinguish synthetic style medians, not a forced player percentile.
training_seed_limit = math.floor(max(r['seed'] for r in rows)*.6)
thresholds = []
for board in range(1, 11):
    train = [r for r in rows if r['board'] == board and r['seed'] <= training_seed_limit and r['outcome'] == 'complete']
    anchors = {style: median([r['final'] for r in train if r['policy'].startswith(style+'-')])
               for style in ['cap4', 'half', 'continuous']}
    if any(value is None for value in anchors.values()):
        thresholds.append(dict(board=board, status='insufficient_completed_training_runs', anchors=anchors))
        continue
    two = math.ceil((anchors['cap4']+anchors['half'])/2/500)*500
    three = max(two+500, math.ceil((anchors['half']+anchors['continuous'])/2/500)*500)
    validation = {}
    for style in ['continuous', 'half', 'cap4', 'single']:
        selected = [r for r in rows if r['board'] == board and r['seed'] > training_seed_limit and
                    r['outcome'] == 'complete' and r['policy'].startswith(style+'-')]
        counts = collections.Counter(3 if r['final'] >= three else 2 if r['final'] >= two else 1 for r in selected)
        validation[style] = dict(n=len(selected), stars=[counts[n] for n in [1, 2, 3]])
    thresholds.append(dict(board=board, status='experimental_not_production', two=two, three=three,
                           anchors=anchors, held_out=validation))

with (args.output/'summary.csv').open('w') as f:
    writer = csv.DictWriter(f, fieldnames=list(summaries[0]), lineterminator='\n')
    writer.writeheader(); writer.writerows(summaries)
with (args.output/'runs.csv').open('w') as f:
    fields = [key for key in rows[0] if key != 'trace']
    writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
    writer.writeheader(); writer.writerows({k: r[k] for k in fields} for r in rows)
representatives = []
for board in range(1, 11):
    selected = [r for r in rows if r['board'] == board and r['outcome'] == 'complete' and r['policy'].startswith('continuous')]
    if selected:
        representatives.append(max(selected, key=lambda r: r['final']))
(args.output/'representative-traces.json').write_text(json.dumps(representatives, indent=2)+'\n')
(args.output/'analysis.json').write_text(json.dumps(dict(
    verdict='PASS for paired synchronous-core experiment; NOT calibrated for production Source runtime',
    total_runs=len(rows), unique_opening_seeds=len({(r['board'], r['seed']) for r in rows}),
    training_seed_limit=training_seed_limit,
    action_paths=len(groups), outcomes=dict(collections.Counter(r['outcome'] for r in rows)),
    validation_errors=0, paired_trace_mismatches=0,
    raw_sha256=hashlib.sha256(args.input.read_bytes()).hexdigest(),
    summaries=summaries, candidate_thresholds=thresholds), indent=2)+'\n')
print(json.dumps(dict(runs=len(rows), outcomes=dict(collections.Counter(r['outcome'] for r in rows)),
                      checks='PASS', output=str(args.output))))
