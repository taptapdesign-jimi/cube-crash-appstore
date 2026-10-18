#!/usr/bin/env python3
"""Bake supplied SVGs at display cadence. Originals remain byte-exact.
Requires local Chrome, Node and Pillow. No runtime browser or SVG decode.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/hud/animation coin'
OUTPUT = ROOT / 'assets/hud/native-coin-animation'
NAMES = ['coin-upright-0', 'coin-left-35', 'coin-right-35',
         'coin-back-forth-diagonal-15', 'coin-back-forth-left-50', 'coin-back-forth-right-50']
CELL, COLUMNS, FPS = 128, 10, 60
OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = {'cell': CELL, 'columns': COLUMNS, 'fps': FPS, 'variants': []}
with tempfile.TemporaryDirectory(prefix='native-hud-coins-') as directory:
    for name in NAMES:
        source = SOURCE / (name + '.svg')
        duration = 2 if 'back-forth' in name else 0.5
        frames = Path(directory) / name
        subprocess.run(['node', str(ROOT / 'scripts/render-animated-svg-frames.mjs'),
                        str(source), str(frames), str(CELL), str(CELL), str(FPS), str(duration)], check=True)
        images = sorted(frames.glob('frame-*.png'))
        assert len(images) == round(FPS * duration)
        sheet = Image.new('RGBA', (CELL * COLUMNS, CELL * ((len(images) + COLUMNS - 1) // COLUMNS)))
        for index, file in enumerate(images):
            with Image.open(file) as image:
                assert image.size == (CELL, CELL)
                sheet.paste(image, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
        sheet.save(OUTPUT / (name + '.webp'), 'WEBP', quality=94, method=4)
        manifest['variants'].append({'name': name, 'frames': len(images), 'duration': duration,
                                    'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest()})
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
