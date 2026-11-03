"""Byte-preserving sources; peak-matched PCM playback derivatives for Nala.
No resampling, compression, limiting, pitch/speed or duration changes.
"""
from pathlib import Path
import array
import hashlib
import json
import math
import sys
import wave

root=Path(__file__).resolve().parents[1]
folder=root/'assets/sound/SPEECH/Nala'
out=folder/'playback-v1';out.mkdir(exist_ok=True)
rows=[];target=round(32768*10**(-1/20))
for source in sorted(folder.glob('*.wav')):
    original=source.read_bytes()
    with wave.open(str(source),'rb') as reader:
        assert reader.getsampwidth()==2 and reader.getframerate()==48000 and reader.getnchannels()==2
        count=reader.getnframes();samples=array.array('h',reader.readframes(count))
    if sys.byteorder!='little':samples.byteswap()
    peak=max(map(abs,samples));assert peak>0
    gain=target/peak
    result=array.array('h',(round(v*gain) for v in samples))
    peak_out=max(map(abs,result));assert peak_out<=target
    destination=out/source.name
    if sys.byteorder!='little':result.byteswap()
    with wave.open(str(destination),'wb') as writer:
        writer.setnchannels(2);writer.setsampwidth(2);writer.setframerate(48000);writer.writeframes(result.tobytes())
    assert source.read_bytes()==original
    rows.append(dict(source=str(source.relative_to(root)),playback=str(destination.relative_to(root)),sourceSHA256=hashlib.sha256(original).hexdigest(),playbackSHA256=hashlib.sha256(destination.read_bytes()).hexdigest(),duration=count/48000,channels=2,sampleRate=48000,bits=16,gainDb=20*math.log10(gain),peakDbFS=20*math.log10(peak_out/32768)))
assert len(rows)==9
(root/'docs/audio/nala-vocal-playback-v1.json').write_text(json.dumps(dict(version=1,targetPeakDbFS=-1,originalsUnchanged=True,files=rows),indent=2)+'\n')
print('Prepared9peak-matched Nala derivatives; source bytes unchanged')
