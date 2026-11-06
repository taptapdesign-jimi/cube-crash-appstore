#!/usr/bin/env python3
"""Retain six Arcade lines; four older Settings takes were explicitly deleted."""
import hashlib
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/sound/SPEECH/settings slwo burn and pure cide voices.mp3'
SHA = '0fa497575067d3ac37ce46061954f0b83a15f5a1e7dbba57dc5dd13e606efbd2'
DEST = ROOT / 'assets/sound/SPEECH/settings-arcade-voices-v1'
LINES = [
    ('arena-modal-grill', 'sandwich', "Hey! That's my sandwich!"),
    ('arena-modal-grill', 'lunch', 'Come back with my lunch!'),
    ('arena-modal-grill', 'one-bite', 'One bite! Not all of it!'),
    ('arena-modal-grill', 'save-a-bite', 'Hey! Save me a bite!'),
    ('home-settings', 'little-tweak', 'One little tweak... perfect!'),
    ('home-settings', 'stacked-up', 'All stacked up!'),
    ('home-settings', 'nailed-it', 'Steady... nailed it!'),
    ('home-settings', 'just-right', 'Just right!'),
    ('arena-modal-slow', 'mind-my-tea', 'Whoa! Mind my tea!'),
    ('arena-modal-slow', 'reading-here', "Hey! I'm reading here!"),
]


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
    with tempfile.TemporaryDirectory(prefix='settings-arcade-voices-') as folder:
        pcm = Path(folder) / 'master.wav'
        subprocess.run(['afconvert', str(SOURCE), str(pcm), '-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1'], check=True)
        with wave.open(str(pcm)) as f:
            rate = f.getframerate()
            samples = np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').copy()
    # Local word timestamps plus measured quiet valleys; laughter belongs to
    # the preceding line. Do not split at the pauses within tweak/steady lines.
    boundaries = [0, 2.3825, 4.67, 7.4975, 9.9925, 13.05, 15.0275, 17.655, 19.4725, 21.915, len(samples) / rate]
    DEST.mkdir(parents=True, exist_ok=True)
    clips = []
    for index, (scene, slug, text) in enumerate(LINES):
        # User2026-11-05 explicitly removed the four old Settings cuts.
        if scene == "home-settings":
            continue
        start, end = boundaries[index:index + 2]
        chunk = samples[round(start * rate):round(end * rate)].copy()
        fade = round(.003 * rate)
        chunk[:fade] = np.rint(chunk[:fade] * np.linspace(0, 1, fade)).astype('<i2')
        chunk[-fade:] = np.rint(chunk[-fade:] * np.linspace(1, 0, fade)).astype('<i2')
        path = DEST / f'{index + 1:03d}-{slug}.wav'
        with wave.open(str(path), 'wb') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(rate)
            f.writeframes(chunk.tobytes())
        clips.append(dict(sceneId=scene, spokenText=text, source=str(path.relative_to(ROOT)), start=start, end=end,
                          duration=len(chunk) / rate, peakDbFS=float(20 * np.log10(max(1, np.max(np.abs(chunk.astype(float)))) / 32768)),
                          sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    old = 'assets/sound/SPEECH/Jimbo voice compilation/seperated jjimbo voices/'
    active = {
        'arena-grill': [c['source'] for c in clips if c['sceneId'] == 'arena-modal-grill'] + [old + name for name in ['0054-arena-grill-02.wav', '0056-arena-grill-04.wav', '0057-arena-grill-05.wav']],
        'arena-slow': [c['source'] for c in clips if c['sceneId'] == 'arena-modal-slow'] + [old + name for name in ['0061-arena-slow-01.wav', '0062-arena-slow-02.wav', '0063-arena-slow-03.wav']],
        'arena-modal-grill': [old + '0059-arena-modal-grill-02.wav'] + [c['source'] for c in clips if c['sceneId'] == 'arena-modal-grill'],
        'arena-modal-slow': [c['source'] for c in clips if c['sceneId'] == 'arena-modal-slow'],
    }
    report = dict(master=str(SOURCE.relative_to(ROOT)), masterSha256=SHA, format='48000Hz mono PCM16 WAV',
                  processing='Original level/pitch/speed; 3ms quiet-edge fades; laughter retained. Original MP3 and Arcade assets preserved; four Settings cuts explicitly deleted by user.',
                  alignment='Ten supplied lines in confirmed order; local word timestamps and measured quiet valleys.', clips=clips, activeSources=active)
    (DEST / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
    print(json.dumps(dict(clips=len(clips), duration=len(samples) / rate, maxPeakDbFS=max(c['peakDbFS'] for c in clips))))


if __name__ == '__main__':
    main()
