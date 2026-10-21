#!/usr/bin/env python3
"""Build an isolated offline Swift probe; never operate on app/device/save data."""
import argparse
from pathlib import Path
import os
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--seeds', type=int, default=100)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if not 1 <= args.seeds <= 10000:
    parser.error('seeds must be 1..10000')
if args.output.exists():
    parser.error('output exists; choose a new output file')
root = Path(__file__).resolve().parents[3]
args.output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='forest-ranking-') as work:
    package = Path(work)
    sources = package / 'Sources/RankingProbe'
    sources.mkdir(parents=True)
    dependencies = ','.join(f'.package(path:"{root}/native/{name}")' for name in ['gameplay-core', 'gameplay-state'])
    (package / 'Package.swift').write_text('''// swift-tools-version: 6.0
import PackageDescription
let package=Package(name:"RankingProbe",platforms:[.macOS(.v13)],dependencies:[DEPENDENCIES],targets:[.executableTarget(name:"RankingProbe",dependencies:[.product(name:"StackToSixGameplay",package:"gameplay-core"),.product(name:"StackToSixNativeState",package:"gameplay-state")])])
'''.replace('DEPENDENCIES', dependencies))
    for source in [Path(__file__).with_name('main.swift'), root / 'native/gameplay-ui/NativeSourceInitialBoardRecipe.swift']:
        shutil.copy2(source, sources / source.name)
    env = dict(os.environ, CLANG_MODULE_CACHE_PATH=str(package / 'clang-cache'))
    command = ['swift', 'run', '--disable-sandbox', '--cache-path', str(package / 'cache'),
               '--package-path', work, '-c', 'release', 'RankingProbe', str(args.seeds)]
    with args.output.open('x') as output:
        subprocess.run(command, env=env, stdout=output, check=True, cwd=root)
