#!/usr/bin/env python3
"""Prepare only the supplied final tutorial line; preserve its complete duration."""
import hashlib, json, math, subprocess, tempfile, wave
from pathlib import Path
from array import array
root=Path(__file__).resolve().parents[1]
source=root/'assets/sound/SPEECH/have fun.mp3'
dest=root/'assets/sound/SPEECH/tutorial-farewell-v1'
dest.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='tutorial-farewell-') as tmp:
    pcm=Path(tmp)/'voice.wav'
    subprocess.run(['afconvert',str(source),str(pcm),'-f','WAVE','-d','LEI16@48000','-c','1'],check=True)
    with wave.open(str(pcm)) as f:samples=array('h',f.readframes(f.getnframes()))
boosted=array('h',(round(v*10**(1/20)) for v in samples))
assert max(map(abs,boosted))<32767, 'Fixed +1dB PCM gain lacks headroom'
output=dest/'tutorial-farewell.wav'
with wave.open(str(output),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(boosted.tobytes())
manifest=dict(source=str(source.relative_to(root)),sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),text='That’s it, you’re ready! Have fun!',output=str(output.relative_to(root)),outputSHA256=hashlib.sha256(output.read_bytes()).hexdigest(),duration=len(samples)/48000,sampleRate=48000,channels=1,pcmGainDB=1,cueGainDB=2,peakDBFS=20*math.log10(max(map(abs,boosted))/32768),processing='Full recording; no trim, normalization, pitch or rate change. Shared tutorial +3dB policy.')
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
