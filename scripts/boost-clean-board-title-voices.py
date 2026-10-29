#!/usr/bin/env python3
"""Create the +3 dB Native playback pack without changing the approved v1 clips."""
import array
import hashlib
import json
import math
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAIN_DB = 3
FACTOR = 10 ** (GAIN_DB / 20)
BASE = ROOT / 'assets/sound/Clean board/voice/titles-v1'
DEST = ROOT / 'assets/sound/Clean board/voice/titles-v2-plus3db'

def main():
    original = json.loads((ROOT / 'docs/audio/clean-board-title-voices-v1.json').read_text())
    clips = []
    DEST.mkdir(parents=True, exist_ok=True)
    for entry in original['clips']:
        source = ROOT / entry['source']
        data = source.read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], source
        with wave.open(str(source)) as wav:
            assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, 48000)
            pcm = array.array('h', wav.readframes(wav.getnframes()))
        if sys.byteorder != 'little': pcm.byteswap()
        boosted = array.array('h')
        for sample in pcm:
            value = round(sample * FACTOR)
            assert -32768 < value < 32768, 'Refuse clipping; do not silently limit the voice'
            boosted.append(value)
        peak = max(map(abs, boosted)) / 32768
        measured = 20 * math.log10(math.sqrt(sum(x*x for x in boosted) / sum(x*x for x in pcm)))
        assert abs(measured - GAIN_DB) < 0.001
        if sys.byteorder != 'little': boosted.byteswap()
        target = DEST / source.name
        with wave.open(str(target), 'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(48000)
            wav.writeframes(boosted.tobytes())
        assert source.read_bytes() == data
        clips.append({'title': entry['title'], 'source': str(target.relative_to(ROOT)),
                      'originalSource': entry['source'], 'originalSha256': entry['sha256'],
                      'gainDb': measured, 'peakDbFS': 20 * math.log10(peak),
                      'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    (ROOT / 'docs/audio/clean-board-title-voices-v2.json').write_text(json.dumps({
        'processing': 'Uniform +3 dB relative to immutable v1 PCM; no limiter, trim, pitch or speed change. Existing Native cue gain 0.9064262964918004 retained.',
        'clips': clips}, indent=2, ensure_ascii=False) + '\n')
    catalog = ROOT / 'native/gameplay-results/NativeCleanBoardTitleVoice.swift'
    text = catalog.read_text().replace('clean-board-title-voices-v1.json', 'clean-board-title-voices-v2.json')
    text = text.replace('/titles-v1/', '/titles-v2-plus3db/')
    catalog.write_text(text)
    print(f'PASS {len(clips)} voices +3 dB within 0.001 dB; no clipped samples; all v1 hashes preserved.')

if __name__ == '__main__': main()
