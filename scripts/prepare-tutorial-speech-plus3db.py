#!/usr/bin/env python3
"""Tutorial-only +3dB: PCM +1dB and existing cue +2dB, no player gain clamp."""
import hashlib,json,subprocess,tempfile,wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/sound/SPEECH/tutorial-voices-plus3db-v1'
def main():
    base=json.loads((ROOT/'assets/sound/SPEECH/tutorial-voices-v1/manifest.json').read_text())
    sources=base.get('baseSources',base['activeSources'])
    DEST.mkdir(exist_ok=True);clips=[];active={}
    for scene,paths in sources.items():
        source=ROOT/paths[0];before=hashlib.sha256(source.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory(prefix='tutorial-plus3db-') as folder:
            pcm=Path(folder)/'source.wav'
            subprocess.run(['afconvert',str(source),str(pcm),'-f','WAVE','-d','LEI16@48000','-c','1'],check=True)
            with wave.open(str(pcm)) as f:rate=f.getframerate();raw=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').copy()
        boosted=np.rint(raw.astype(float)*10**(1/20))
        assert abs(boosted).max()<32767,'Fixed gain must preserve PCM headroom'
        data=boosted.astype('<i2');out=DEST/(scene+'.wav')
        with wave.open(str(out),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(data.tobytes())
        assert before==hashlib.sha256(source.read_bytes()).hexdigest()
        playback=str(out.relative_to(ROOT));active[scene]=[playback]
        clips.append(dict(scene=scene,original=paths[0],originalSHA256=before,source=playback,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),duration=len(data)/rate,peakDBFS=float(20*np.log10(abs(data.astype(float)).max()/32768)),pcmGainDB=1,cueGain=0.72*10**(2/20),totalPlaybackGainDB=3))
    manifest=dict(sampleRate=48000,channels=1,format='PCM16',policy='PCM+1dB and cue+2dB relative to prior gain0.72; all other speech and Nala unchanged',activeSources=active,clips=clips)
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('PASS',len(clips),'tutorial-only +3dB files;peak max',max(c['peakDBFS'] for c in clips),'cue gain',manifest['clips'][0]['cueGain'])
if __name__=='__main__':main()
