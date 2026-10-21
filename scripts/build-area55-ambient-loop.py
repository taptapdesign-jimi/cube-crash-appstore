"""Derive the explicitly requested Native Area55 loop; never overwrite originals."""
from pathlib import Path
import array
import hashlib
import json
import math
import wave

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/sound/worlds/Area55'
source = folder / 'ambient area 55.wav'
target = folder / 'area55-ambient-loop-v1.wav'
with wave.open(str(source)) as src:
    channels, width, rate, frames = src.getparams()[:4]
    assert (channels, width, rate) == (2, 2, 48000)
    original = array.array('h', src.readframes(frames))
# Exclude the supplied intro fade and diminishing outro. Circular overlap keeps
# source time/pitch intact; complementary raised-cosine weights cannot add gain.
start, end, overlap = 1.5, 12.5, 1.5
part = original[round(start * rate) * channels:round(end * rate) * channels]
n = round(overlap * rate)
body = part[n * channels:-n * channels]
for frame in range(n):
    head_weight = (1 - math.cos(math.pi * frame / (n - 1))) / 2
    for channel in range(channels):
        tail = part[len(part) - n * channels + frame * channels + channel]
        head = part[frame * channels + channel]
        body.append(round(tail * (1 - head_weight) + head * head_weight))
with wave.open(str(target), 'wb') as out:
    out.setparams((channels, width, rate, len(body) // channels, 'NONE', 'not compressed'))
    out.writeframes(body.tobytes())
seam = [abs(body[channel] - body[-channels + channel]) for channel in range(channels)]
steps = sorted(abs(body[i] - body[i - channels]) for i in range(channels, len(body)))
report = dict(source=source.name, sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
              output=target.name, outputSHA256=hashlib.sha256(target.read_bytes()).hexdigest(),
              sampleRate=rate, channels=channels, bits=16, sourceDuration=frames/rate,
              trimStart=start, trimEnd=end, overlapSeconds=overlap,
              method='Circular complementary raised-cosine crossfade, original speed/pitch, no normalization.',
              duration=len(body)/channels/rate, peakDBFS=20*math.log10(max(map(abs,body))/32768),
              rmsDBFS=20*math.log10(math.sqrt(sum(x*x for x in body)/len(body))/32768),
              dc=sum(body)/len(body)/32768, seamStepPCM=seam,
              interiorStep99PercentilePCM=steps[int(len(steps)*.99)])
assert max(seam) <= report['interiorStep99PercentilePCM']
(folder / 'area55-ambient-loop-v1.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
