"""Read-only reference integrity, Markdown link and optional built-app check."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote

parser = argparse.ArgumentParser()
parser.add_argument('--app', type=Path)
args = parser.parse_args()
library = Path(__file__).resolve().parents[1]
root = library.parent
manifest = json.loads((library / 'reference-manifest.json').read_text())
errors = []
for item in manifest['files']:
    for base, key in [(root, 'source'), (library, 'reference')]:
        path = base / item[key]
        if not path.is_file():
            errors.append(f'Missing: {path}')
        elif hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
            errors.append(f'Snapshot drift: {path}')
for md in library.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)', md.read_text()):
        target = unquote(target.strip('<>').split('#')[0])
        if target and '://' not in target and not (md.parent / target).exists():
            errors.append(f'Broken link in {md.name}: {target}')
if args.app:
    if not args.app.is_dir() or args.app.suffix != '.app':
        errors.append('--app must name an existing .app directory')
    else:
        markers = {'game design', 'STYLE_GUIDE.md', 'REFERENCE_INDEX.md', 'reference-manifest.json', 'verify_library.py'}
        for path in args.app.rglob('*'):
            if path.name in markers:
                errors.append(f'Design library leaked into app: {path}')
if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
print(f"PASS: {len(manifest['files'])} source/reference hashes and all guide links" + ('; final app has no design-library markers' if args.app else '; final app not checked'))
