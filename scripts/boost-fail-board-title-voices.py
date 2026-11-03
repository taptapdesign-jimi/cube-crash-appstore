#!/usr/bin/env python3
"""Derive +4 dB speech RMS with smooth offline peak protection; retain immutable v1.
Requires numpy and scipy. No runtime limiter, timing, pitch or transport change.
"""
import hashlib,json,math,wave
from pathlib import Path
import numpy as np
from scipy.ndimage import maximum_filter1d,minimum_filter1d,uniform_filter1d
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/sound/fail board/voices/titles-v2-plus4db'
GAIN_DB=4.0

def main():
    original=json.loads((ROOT/'docs/audio/fail-board-title-voices-v1.json').read_text())
    DEST.mkdir(parents=True,exist_ok=True);clips=[];ceiling=10**(-.1/20)
    for entry in original['clips']:
        source=ROOT/entry['source'];data=source.read_bytes()
        assert hashlib.sha256(data).hexdigest()==entry['sha256']
        with wave.open(str(source)) as w:
            assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,48000)
            x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
        # Offline lookahead: smooth 2ms gain windows anticipate transient peaks.
        # Expanding gain minima before smoothing guarantees the ceiling at each sample.
        envelope=maximum_filter1d(np.abs(x),size=241,mode='nearest')
        energy=np.sum(x*x);target=energy*10**(GAIN_DB/10)
        def render(factor):
            required=np.minimum(1,ceiling/np.maximum(envelope*factor,1e-12))
            safe=minimum_filter1d(required,size=97,mode='nearest')
            gain=uniform_filter1d(safe,size=97,mode='nearest')
            return x*factor*gain,gain
        low,high=1.0,8.0
        assert np.sum(render(high)[0]**2)>=target, entry["title"]
        for _ in range(30):
            mid=(low+high)/2
            if np.sum(render(mid)[0]**2)<target:low=mid
            else:high=mid
        y,gain=render((low+high)/2)
        assert np.max(np.abs(y))<=ceiling+1e-9
        pcm=np.rint(y*32768).astype('<i2')
        assert np.max(np.abs(pcm.astype(float)))<32767
        measured=10*math.log10(np.sum(pcm.astype(float)**2)/np.sum((x*32768)**2))
        assert abs(measured-GAIN_DB)<.001
        dest=DEST/source.name
        with wave.open(str(dest),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(pcm.tobytes())
        assert source.read_bytes()==data
        clips.append(dict(title=entry['title'],source=str(dest.relative_to(ROOT)),originalSource=entry['source'],originalSha256=entry['sha256'],gainDb=measured,peakDbFS=20*math.log10(np.max(np.abs(pcm.astype(float)))/32768),maxPeakReductionDb=-20*math.log10(float(np.min(gain))),sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
    (ROOT/'docs/audio/fail-board-title-voices-v2.json').write_text(json.dumps(dict(processing='Measured +4 dB RMS relative to immutable v1, within0.001dB. Smooth offline lookahead peak protection at-0.1dBFS; no hard clipping, runtime limiter, added silence, pitch or speed change. Existing cue gain retained.',clips=clips),indent=2,ensure_ascii=False)+'\n')
    # Historical derivative regeneration only; runtime reverted to v1 by user2026-11-01.
    print(f'PASS {len(clips)} clips +4dB RMS within0.001dB; maxpeak {max(c["peakDbFS"] for c in clips):.3f}dBFS; all v1 bytes preserved')
if __name__=='__main__':main()
