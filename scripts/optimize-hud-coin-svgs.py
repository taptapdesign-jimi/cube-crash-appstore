#!/usr/bin/env python3
"""User-authorized optimization of these six coins only; retain source masters outside app resources."""
import base64
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/hud/animation coin'
MASTERS = ROOT / 'game design/source-masters/hud-coins'
MASTERS.mkdir(parents=True, exist_ok=True)
ET.register_namespace('', 'http://www.w3.org/2000/svg')
rows = []
encoded = {}
for target in sorted(SOURCE.glob('coin-*.svg')):
    master = MASTERS / target.name
    if not master.exists():
        master.write_bytes(target.read_bytes())
    original = master.read_bytes()
    root = ET.fromstring(original)
    images = [(parent, child) for parent in root.iter() for child in parent if child.tag.endswith('}image')]
    assert len(images) == 120
    for index, (parent, image) in enumerate(images):
        if index % 4:
            parent.remove(image)
            continue
        source = image.get('href')
        if source not in encoded:
            raster = Image.open(io.BytesIO(base64.b64decode(source.split(',')[1])))
            data = io.BytesIO()
            raster.resize((192, 192), Image.Resampling.LANCZOS).save(data, 'WEBP', quality=90, method=4)
            encoded[source] = 'data:image/webp;base64,' + base64.b64encode(data.getvalue()).decode()
        image.set('href', encoded[source])
        animation = next(iter(image))
        frame = index // 4
        values = ['1' if i % 30 == frame else '0' for i in range(31)]
        animation.set('values', ';'.join(values))
        animation.set('keyTimes', ';'.join(format(i / 30, '.8f') for i in range(31)))
    output = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    target.write_bytes(output)
    rows.append({'file': target.name, 'originalBytes': len(original), 'optimizedBytes': len(output),
                 'originalSHA256': hashlib.sha256(original).hexdigest(),
                 'optimizedSHA256': hashlib.sha256(output).hexdigest()})
report = {'fps': 60, 'embeddedFramePixels': 192, 'webpQuality': 90, 'originalsDevelopmentOnly': str(MASTERS.relative_to(ROOT)), 'files': rows}
(MASTERS / 'optimization.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
