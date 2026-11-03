#!/usr/bin/env python3
"""Verify/reproduce complete reward speech cuts without modifying original audio."""
import hashlib
import io
import json
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/audio/reward-voices-v1.json'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    manifest = json.loads(MANIFEST.read_text())
    source = ROOT / manifest['source']
    assert sha(source.read_bytes()) == manifest['sourceSHA256']
    with tempfile.TemporaryDirectory(prefix='reward-voices-') as directory:
        decoded = Path(directory) / 'master.wav'
        subprocess.run(['afconvert', str(source), str(decoded), '-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1'], check=True)
        with wave.open(str(decoded)) as audio:
            assert (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) == (48000, 1, 2)
            pcm = audio.readframes(audio.getnframes())
    previous = 0
    for clip in manifest['clips']:
        assert clip['startFrame'] == previous < clip['endFrame']
        previous = clip['endFrame']
        output = io.BytesIO()
        with wave.open(output, 'wb') as audio:
            audio.setparams((1, 2, 48000, 0, 'NONE', 'not compressed'))
            audio.writeframes(pcm[clip['startFrame']*2:clip['endFrame']*2])
        data = output.getvalue()
        assert sha(data) == clip['sha256']
        destination = ROOT / clip['source']
        if destination.exists():
            assert destination.read_bytes() == data, 'Existing clip differs; never overwrite.'
        else:
            destination.write_bytes(data)
    assert previous*2 == len(pcm) and len(manifest['clips']) == 12
    print('PASS12 complete clips; every decoded source frame retained byte-exact, no DSP.')

if __name__ == '__main__':
    main()
