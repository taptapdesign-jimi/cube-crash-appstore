#!/usr/bin/env python3
"""Prepare an isolated QA copy; never builds, launches, or modifies source runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True, help='New directory under /tmp')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
out = Path(args.output).resolve()
if not out.is_relative_to(Path('/tmp').resolve()) or out.exists():
    parser.error('output must be a new directory under /tmp; existing copies are never overwritten')
out.mkdir(parents=True)
for folder in ('standalone', 'jimi-2026'):
    shutil.copytree(root / 'native' / folder, out / 'native' / folder,
                    ignore=shutil.ignore_patterns('xcuserdata', '.DS_Store'))
host = out / 'native/standalone/Stack to Six/GameViewController.swift'
source = host.read_text()
property_anchor = '    private var jimiHomeHub: JimiHomeHubController?'
creation_anchor = '            let controller = JimiHomeHubController(web: webView, resourceRoot: root)'
if source.count(property_anchor) != 1 or source.count(creation_anchor) != 1:
    raise RuntimeError('Host wiring anchors drifted; inspect the isolated copy before proceeding')
source = source.replace(property_anchor, property_anchor + '''
    #if DEBUG && targetEnvironment(simulator)
    private var forestBenchmarkProbe: JimiNativeRouteProbe?
    #endif''')
source = source.replace(creation_anchor, creation_anchor + '''
            #if DEBUG && targetEnvironment(simulator)
            if JimiNativeRouteProbe.enabled {
                let probe = JimiNativeRouteProbe()
                forestBenchmarkProbe = probe
                controller.onDiagnosticEvent = { [weak probe] event in
                    switch event {
                    case .start(let id, let label): probe?.start(label: label, requestID: id)
                    case .bridgeReady(let id): probe?.markBridgeReady(requestID: id)
                    case .motionStart(let id): probe?.markMotionStart(requestID: id)
                    case .finish(let id, let outcome): probe?.finish(requestID: id, outcome: outcome)
                    case .cancel(let reason): probe?.cancel(reason: reason)
                    }
                }
            }
            #endif''')
host.write_text(source)
shutil.copy2(root / 'scripts/qa/JimiNativeRouteProbe.swift', host.parent / 'JimiNativeRouteProbe.swift')
shutil.copy2(root / 'scripts/qa/JimiNativeForestBenchmarkUITests.swift',
             out / 'native/standalone/Stack to SixUITests/JimiNativeForestBenchmarkUITests.swift')
bundle = root / 'native/standalone/Stack to Six/Web.bundle'
files = sorted(p for p in bundle.rglob('*') if p.is_file())
tree = hashlib.sha256()
for path in files:
    relative = path.relative_to(bundle).as_posix()
    tree.update(relative.encode() + b'\0' + hashlib.sha256(path.read_bytes()).digest())
(out / 'benchmark-preparation.json').write_text(json.dumps({
    'source': str(root), 'project': str(out / 'native/standalone/Stack to Six.xcodeproj'),
    'payloadFileCount': len(files), 'payloadTreeSHA256': tree.hexdigest(),
    'changes': ['temporary host probe wiring', 'QA probe copy', 'QA UI benchmark copy'],
    'measurement': 'native callback cadence, not presented FPS',
}, indent=2) + '\n')
print(out / 'native/standalone/Stack to Six.xcodeproj')
