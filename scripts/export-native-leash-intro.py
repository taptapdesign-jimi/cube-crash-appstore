"""Repack approved-for-integration Studio pixels as independent Native WebP frames.

Usage: python3 scripts/export-native-leash-intro.py /path/to/Jimbo-i-Nala-bistro.webp
Requires Pillow. Originals are read-only; no resize, quantization or timing edit.
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = "6f69150663184cb16befd09f5a648999a8fca0d0fddcd09663e6aa47df02be47"


def chunk(tag, payload):
    return tag + struct.pack("<I", len(payload)) + payload + b"\0" * (len(payload) % 2)


def u24(value):
    return value.to_bytes(3, "little")


def main():
    source = Path(sys.argv[1])
    assert hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_SHA
    image = Image.open(source)
    width, height = image.size
    frames, delays = [], []
    for index in range(image.n_frames):
        image.seek(index)
        frames.append(image.convert("RGBA"))
        delays.append(image.info["duration"])
    body = chunk(b"VP8X", b"\x12\0\0\0" + u24(width - 1) + u24(height - 1))
    body += chunk(b"ANIM", b"\0" * 6)
    for frame, delay in zip(frames, delays):
        encoded = io.BytesIO()
        frame.save(encoded, format="WEBP", lossless=True, exact=True, method=6)
        raw = encoded.getvalue()
        offset, payload = 12, b""
        while offset < len(raw):
            size = struct.unpack_from("<I", raw, offset + 4)[0]
            end = offset + 8 + size + size % 2
            if raw[offset:offset + 4] in (b"VP8L", b"VP8 ", b"ALPH"):
                payload += raw[offset:end]
            offset = end
        header = u24(0) * 2 + u24(width - 1) + u24(height - 1) + u24(delay) + b"\x02"
        body += chunk(b"ANMF", header + payload)
    output = b"RIFF" + struct.pack("<I", len(body) + 4) + b"WEBP" + body
    decoded = Image.open(io.BytesIO(output))
    assert decoded.n_frames == len(frames)
    for index, (frame, delay) in enumerate(zip(frames, delays)):
        decoded.seek(index)
        actual = decoded.convert("RGBA")
        assert actual.getchannel("A").tobytes() == frame.getchannel("A").tobytes()
        for background in ("black", "white"):
            a, b = Image.new("RGB", frame.size, background), Image.new("RGB", frame.size, background)
            a.paste(actual, mask=actual.getchannel("A")); b.paste(frame, mask=frame.getchannel("A"))
            assert a.tobytes() == b.tobytes()
        assert decoded.info["duration"] == delay
    folder = ROOT / "assets/logo addons/native"
    folder.mkdir(exist_ok=True)
    (folder / "lik-lajna-v1.webp").write_bytes(output)
    frames[0].save(folder / "lik-lajna-v1.png")
    record = dict(source="Studio revision-12-clear/Jimbo-i-Nala-bistro.webp", sourceSHA256=SOURCE_SHA,
                  outputSHA256=hashlib.sha256(output).hexdigest(), bytes=len(output), width=width,
                  height=height, frames=len(frames), durationMs=sum(delays), frameDurationsMs=delays,
                  decodedRGBABytes=width * height * 4 * len(frames),
                  alphaAndBlackWhiteCompositesExact=True, independentFullCanvasFrames=True)
    (ROOT / "docs/engineering/native-leash-intro-v1.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record))


if __name__ == "__main__":
    main()
