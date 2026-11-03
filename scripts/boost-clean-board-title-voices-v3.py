#!/usr/bin/env python3
"""Playback-only +4dB copies with bounded lookahead peak protection; originals immutable."""
from pathlib import Path
import json,wave,hashlib,re
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
def main():
    manifest=json.loads((ROOT/'docs/audio/clean-board-title-voices-v3.json').read_text());clips=[]
    for c in manifest['clips']:
        source=ROOT/c['source'];assert hashlib.sha256(source.read_bytes()).hexdigest()==c['sha256']
        with wave.open(str(source)) as f:rate=f.getframerate();x=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
        y=x*10**(4/20);ceiling=10**(-0.3/20)
        # Anticipate peaks by5ms; instant attenuation,60ms recovery. No clipping.
        look=round(rate*.005);peak=np.abs(y);future=peak.copy()
        for offset in range(1,look+1):future[:-offset]=np.maximum(future[:-offset],peak[offset:])
        required=np.minimum(1,ceiling/np.maximum(future,1e-12));envelope=np.empty(len(y));gain=1.;release=np.exp(-1/(rate*.06))
        for i,target in enumerate(required):gain=min(target,1-(1-gain)*release);envelope[i]=gain
        pcm=np.rint(y*envelope*32767).astype('<i2');dest=source.parent/'+4db'/source.name;dest.parent.mkdir(exist_ok=True)
        with wave.open(str(dest),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
        clips.append(dict(title=c['title'],source=str(dest.relative_to(ROOT)),originalSource=c['source'],originalSha256=c['sha256'],gainDb=4,peakDbFS=float(20*np.log10(max(abs(pcm.astype(float)))/32768)),sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
    (ROOT/'docs/audio/clean-board-title-voices-v3-plus4db.json').write_text(json.dumps(dict(processing='+4dB playback gain;5ms lookahead/-0.3dBFS ceiling/60ms release only for peaks;originals unchanged',clips=clips),indent=2)+'\n')
    p=ROOT/'native/gameplay-results/NativeCleanBoardTitleVoice.swift';s=p.read_text().replace('clean-board-title-voices-v3.json','clean-board-title-voices-v3-plus4db.json')
    s=re.sub(r'clean booard title voice/(?:\+4db/)?', 'clean booard title voice/+4db/',s);p.write_text(s)
    p=ROOT/'docs/audio/audio-runtime-owners.json';d=json.loads(p.read_text())
    def walk(v):
        if isinstance(v,dict):
            if v.get('id')=='native-swift-authored-gameplay-sfx':
                v['sources']=[x for x in v['sources'] if '/clean booard title voice/' not in x]+['./'+c['source'] for c in clips]
                v['eventOwner']+=' User2026-10-31 Clean title voices +4dB playback derivatives with peak protection;original110cuts/master unchanged. Existing cue gain0.9064262964918004 and all transport/lifecycle gates unchanged;offline processing only,no runtime decoder/engine changes.'
            for x in v.values():walk(x)
        elif isinstance(v,list):
            for x in v:walk(x)
    walk(d);p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
    print('110 playback copies +4dB,peak ceiling -0.3dBFS;original SHA verified')
if __name__=='__main__':main()
