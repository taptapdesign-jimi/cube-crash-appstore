#!/usr/bin/env python3
"""Five replacement Settings takes; preserve the new master and its laughter."""
import hashlib
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/sound/SPEECH/settings voices.mp3'
SHA = 'ba571304b14d2d386f2a6003a88ec986711b3c5dcef5e4676553e320f9090893'
DEST = ROOT / 'assets/sound/SPEECH/settings-voices-v2'
LINES = [
    ('little-tweak', 'One little tweak... perfect!'),
    ('stacked-up', 'All stacked up!'),
    ('nailed-it', 'Steady... nailed it!'),
    ('just-right', 'Juuuust right!'),
    ('set-it-up', "Let's set it up!"),
]


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
    with tempfile.TemporaryDirectory(prefix='settings-voices-v2-') as folder:
        pcm = Path(folder) / 'master.wav'
        subprocess.run(['afconvert', str(SOURCE), str(pcm), '-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1'], check=True)
        with wave.open(str(pcm)) as f:
            rate = f.getframerate()
            samples = np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').copy()
    # Boundaries are measured quiet-valley midpoints. Leading laughter belongs
    # to the following line, unlike the preceding sandwich/tea master.
    boundaries = [0, 3.2575, 5.48, 7.905, 10.105, len(samples) / rate]
    DEST.mkdir(parents=True, exist_ok=True)
    clips = []
    for index, (slug, text) in enumerate(LINES):
        start, end = boundaries[index:index + 2]
        chunk = samples[round(start * rate):round(end * rate)].copy()
        fade = round(.003 * rate)
        chunk[:fade] = np.rint(chunk[:fade] * np.linspace(0, 1, fade)).astype('<i2')
        chunk[-fade:] = np.rint(chunk[-fade:] * np.linspace(1, 0, fade)).astype('<i2')
        path = DEST / f'{index + 1:03d}-{slug}.wav'
        with wave.open(str(path), 'wb') as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate); f.writeframes(chunk.tobytes())
        clips.append(dict(sceneId='home-settings', spokenText=text, source=str(path.relative_to(ROOT)),
                          start=start, end=end, duration=len(chunk) / rate,
                          peakDbFS=float(20 * np.log10(max(1, np.max(np.abs(chunk.astype(float)))) / 32768)),
                          sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    report = dict(master=str(SOURCE.relative_to(ROOT)), masterSha256=SHA, format='48000Hz mono PCM16 WAV',
                  processing='Original level/pitch/speed; all leading laughter retained; 3ms quiet-edge fades.',
                  alignment='Five supplied lines in order; local word timestamps and measured quiet valleys.',
                  clips=clips, activeSources={'home-settings': [c['source'] for c in clips]})
    (DEST / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
    print(json.dumps(dict(clips=len(clips), duration=len(samples) / rate, maxPeakDbFS=max(c['peakDbFS'] for c in clips))))


if __name__ == '__main__':
    main()
