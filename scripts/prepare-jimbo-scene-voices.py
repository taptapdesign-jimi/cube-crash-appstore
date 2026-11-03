#!/usr/bin/env python3
"""Reproduce/verify the user-recorded Studio batch without replacing originals.

Requires numpy only for authoring; the app has no dependency on this script.
The recorded, reviewed boundaries and scene IDs live in the adjacent manifest.
Existing clips are verified byte-exact and never overwritten.
"""
import hashlib,io,json,subprocess,tempfile,wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'assets/sound/SPEECH/Jimbo voice compilation/seperated jjimbo voices'
def digest(data):return hashlib.sha256(data).hexdigest()
def main():
    manifest=json.loads((FOLDER/'manifest.json').read_text())
    source=ROOT/manifest['source']
    assert digest(source.read_bytes())==manifest['sourceSHA256'],'Master changed: requires new content alignment.'
    with tempfile.TemporaryDirectory(prefix='jimbo-scene-reproduce-') as directory:
        path=Path(directory)/'master.wav'
        subprocess.run(['afconvert',str(source),str(path),'-f','WAVE','-d','LEI16@48000','-c','1'],check=True)
        with wave.open(str(path)) as f:
            assert f.getframerate()==48000 and f.getnchannels()==1 and f.getsampwidth()==2
            pcm=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').copy()
    previous=0;ids=set()
    for clip in manifest['clips']:
        assert clip['startFrame']==previous and clip['endFrame']>previous
        assert clip['lineId'] not in ids;ids.add(clip['lineId']);previous=clip['endFrame']
        chunk=pcm[clip['startFrame']:clip['endFrame']].copy();fade=min(144,len(chunk)//10)
        chunk[:fade]=np.rint(chunk[:fade]*np.linspace(0,1,fade)).astype('<i2')
        chunk[-fade:]=np.rint(chunk[-fade:]*np.linspace(1,0,fade)).astype('<i2')
        output=io.BytesIO()
        with wave.open(output,'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(48000);f.writeframes(chunk.tobytes())
        data=output.getvalue();assert digest(data)==clip['sha256'],clip['file']
        destination=FOLDER/clip['file'];assert destination.parent==FOLDER
        if destination.exists():assert destination.read_bytes()==data,'Existing clip changed; not overwritten.'
        else:destination.write_bytes(data)
    assert previous==len(pcm) and len(ids)==147
    print('PASS147clips/40scenes: exact source hash,all frames covered,all WAV hashes reproducible.')
if __name__=='__main__':main()
