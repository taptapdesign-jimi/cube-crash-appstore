#!/usr/bin/env python3
"""Pack rendered transparent SVG frames into a lossless WebP grid.

The packer first applies the runtime crop/resize, then removes transparent
canvas shared by every frame. The resulting fixed-size cells keep runtime
math cheap while avoiding atlas memory for pixels that can never be visible.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image


def parse_box(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in value.split(','))
    if len(parts) != 4:
        raise argparse.ArgumentTypeError('crop must be x,y,width,height')
    return parts


def parse_size(value: str) -> tuple[int, int]:
    parts = tuple(int(part) for part in value.split(','))
    if len(parts) != 2:
        raise argparse.ArgumentTypeError('size must be width,height')
    return parts


parser = argparse.ArgumentParser()
parser.add_argument('input_directory', type=Path)
parser.add_argument('output_path', type=Path)
parser.add_argument('--crop', type=parse_box)
parser.add_argument('--size', type=parse_size)
parser.add_argument('--padding', type=int, default=2)
parser.add_argument('--max-texture-size', type=int, default=4096)
parser.add_argument('--frames', type=int)
args = parser.parse_args()

paths = sorted(args.input_directory.glob('frame-*.png'))
if args.frames is not None:
    paths = paths[:max(1, args.frames)]
if not paths:
    raise SystemExit(f'No frame PNGs in {args.input_directory}')

frames: list[Image.Image] = []
for path in paths:
    image = Image.open(path).convert('RGBA')
    if args.crop:
        x, y, width, height = args.crop
        image = image.crop((x, y, x + width, y + height))
    if args.size and image.size != args.size:
        image = image.resize(args.size, Image.Resampling.LANCZOS)
    frames.append(image)

source_width, source_height = frames[0].size
union = None
for image in frames:
    alpha_box = image.getchannel('A').getbbox()
    if not alpha_box:
        continue
    if union is None:
        union = alpha_box
    else:
        union = (
            min(union[0], alpha_box[0]),
            min(union[1], alpha_box[1]),
            max(union[2], alpha_box[2]),
            max(union[3], alpha_box[3]),
        )
if union is None:
    union = (0, 0, 1, 1)

padding = max(0, args.padding)
left = max(0, union[0] - padding)
top = max(0, union[1] - padding)
right = min(source_width, union[2] + padding)
bottom = min(source_height, union[3] + padding)
cell_width = right - left
cell_height = bottom - top
columns = min(len(frames), max(1, args.max_texture_size // cell_width))
rows = math.ceil(len(frames) / columns)
if rows * cell_height > args.max_texture_size:
    raise SystemExit(
        f'Atlas {columns * cell_width}x{rows * cell_height} exceeds '
        f'{args.max_texture_size}; split pages or lower output size'
    )

atlas = Image.new('RGBA', (columns * cell_width, rows * cell_height), (0, 0, 0, 0))
for index, image in enumerate(frames):
    cell = image.crop((left, top, right, bottom))
    atlas.alpha_composite(cell, ((index % columns) * cell_width, (index // columns) * cell_height))

args.output_path.parent.mkdir(parents=True, exist_ok=True)
atlas.save(args.output_path, 'WEBP', lossless=True, method=6, exact=True)
print(json.dumps({
    'frames': len(frames),
    'sourceWidth': source_width,
    'sourceHeight': source_height,
    'cropX': left,
    'cropY': top,
    'cellWidth': cell_width,
    'cellHeight': cell_height,
    'columns': columns,
    'rows': rows,
    'atlasWidth': atlas.width,
    'atlasHeight': atlas.height,
    'decodedBytes': atlas.width * atlas.height * 4,
    'output': str(args.output_path),
}, separators=(',', ':')))
