#!/usr/bin/env python3
"""Analyze same-build QA route callbacks; never equate these with presented FPS."""
import argparse,json,re,statistics
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('folder',type=Path);args=parser.parse_args()
results=[]
for cohort in ('off1','on1','on2','off2'):
 console=(args.folder/f'{cohort}-console.log').read_text();ui=(args.folder/f'{cohort}-ui.log').read_text()
 if '** TEST EXECUTE SUCCEEDED **' not in ui:raise SystemExit(f'{cohort}: UI cohort did not pass')
 rows=[json.loads(line.split('[JIMI_NATIVE_ROUTE] ',1)[1]) for line in console.splitlines() if '[JIMI_NATIVE_ROUTE] ' in line]
 entries=[r for r in rows if r['label']=='hub->world:world-1']
 backs=[r for r in rows if r['label'] in ('world->hub','world-return-to-native-hub:incoming-only')]
 if len(entries)!=4 or len(backs)!=4:raise SystemExit(f'{cohort}: incomplete route rows')
 markers={(int(t),direction):float(time) for time,t,direction in re.findall(r'\[FOREST_BENCHMARK\] ([0-9.]+) trial=(\d+) (Hub-to-Forest|Forest-to-Hub)',ui)}
 for direction,group in [('Hub-to-Forest',entries),('Forest-to-Hub',backs)]:
  for trial,row in enumerate(group):
   assert row['outcome'] in ('native-forest-input-ready','web-world-input-ready','native-input-ready')
   assert len(row['callbackIntervalsMs'])==row['callbackIntervalCount']
   latency=1000*(row['endedUnixTime']-markers[trial,direction]);assert 0<latency<10000
   results.append({'cohort':cohort,'mode':'web' if cohort.startswith('off') else 'native','direction':direction,'trial':trial,'requestId':row['requestId'],'actionToReadyMs':latency,'row':row})
def percentile(values,p):
 values=sorted(values);return values[max(0,min(len(values)-1,int(__import__('math').ceil(len(values)*p))-1))]
summary=[]
for mode in ('web','native'):
 for direction in ('Hub-to-Forest','Forest-to-Hub'):
  for state in ('first-entry','warm'):
   subset=[r for r in results if r['mode']==mode and r['direction']==direction and (r['trial']==0)==(state=='first-entry')]
   intervals=[v for r in subset for v in r['row']['callbackIntervalsMs']]
   first_callbacks=[r['row']['firstCallbackLatencyMs'] for r in subset if r['row']['firstCallbackLatencyMs'] is not None]
   summary.append({'mode':mode,'direction':direction,'state':state,'routes':len(subset),'actionToReadyMedianMs':statistics.median(r['actionToReadyMs'] for r in subset),'callbackWindowComparable':direction=='Hub-to-Forest','callbackCount':len(intervals),'callbackP95Ms':percentile(intervals,.95),'callbackWorstMs':max(intervals),'callbackOver25':sum(v>25 for v in intervals),'callbackOver50':sum(v>50 for v in intervals),'firstCallbackLatencyMedianMs':statistics.median(first_callbacks),'firstCallbackLatencyWorstMs':max(first_callbacks)})
report={'measurement':'CADisplayLink callback entry cadence, not presented FPS','limitations':['Simulator and XCTest/observer overhead','style reference v10 is separate from same-current-build web timing control','Back internal callback windows differ; compare actionToReady only, not pooled Back interval distributions'],'summary':summary,'routes':results}
(args.folder/'benchmark-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(summary,indent=2))
