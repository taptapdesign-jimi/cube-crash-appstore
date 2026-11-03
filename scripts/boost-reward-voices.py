"""Prepare the twelve approved reward speech playback copies at +3 dB."""
from pathlib import Path
import array
import hashlib
import json
import math
import sys
import wave

root = Path(__file__).resolve().parents[1]
base = root / 'assets/sound/card reveal/reward-voices-v1'
out = base / 'plus3db-v1'
out.mkdir(exist_ok=True)
rows = []
for clip in json.loads((root / 'docs/audio/reward-voices-v1.json').read_text())['clips']:
    name = Path(clip['source']).name
    source = base / name
    original = source.read_bytes()
    with wave.open(str(source), 'rb') as reader:
        params = reader.getparams()
        assert params.sampwidth == 2 and params.nchannels == 1 and params.framerate == 48000
        samples = array.array('h', reader.readframes(params.nframes))
    if sys.byteorder != 'little':
        samples.byteswap()
    boosted = [round(v * 10 ** (3 / 20)) for v in samples]
    assert min(boosted) >= -32768 and max(boosted) <= 32767, 'Clipping: do not limit silently'
    peak = max(map(abs, boosted))
    result = array.array('h', boosted)
    if sys.byteorder != 'little':
        result.byteswap()
    destination = out / name
    with wave.open(str(destination), 'wb') as writer:
        writer.setparams(params)
        writer.writeframes(result.tobytes())
    assert source.read_bytes() == original
    rows.append(dict(source=str(source.relative_to(root)), playback=str(destination.relative_to(root)), sourceSHA256=hashlib.sha256(original).hexdigest(), playbackSHA256=hashlib.sha256(destination.read_bytes()).hexdigest(), gainDb=3, peakDbFS=20 * math.log10(peak / 32768), frames=params.nframes, sampleRate=params.framerate, channels=params.nchannels))
(root / 'docs/audio/reward-voices-plus3db-v1.json').write_text(json.dumps(dict(originalsUnchanged=True, processing='Fixed +3 dB; PCM16 rounding only; no clipping, limiting, resampling, trim or rate change', files=rows), indent=2) + '\n')
print(json.dumps(rows, indent=2))
