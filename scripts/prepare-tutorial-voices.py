#!/usr/bin/env python3
"""Versioned tutorial cuts; local PCM conversion, no source/gain/rate changes."""
import hashlib,json,subprocess,tempfile,wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/sound/SPEECH/tutorial voices.mp3'
DEST=ROOT/'assets/sound/SPEECH/tutorial-voices-v1'
LINES=[('objective',"Let's clear the board."),('stack','Drag to stack.'),('merge','Merge the dice to make six.'),('special-bar','A little surprise awaits.'),('delivery','A helper is on its way.'),('special',"Let's try this Special."),('play-faster','Play faster.'),('score-higher','Score higher.'),('clear-board','Clear the board.'),('have-fun','Have fun!')]
# Quiet valleys checked against the waveform, not ASR word starts (which lag
# initial consonants by as much as 280ms in this recording).
VALLEYS=[0,1.65,3.30,5.30,7.25,9.15,10.98,12.32,13.72,15.13,None]
def main():
    source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert source_hash=='3badd8feae3498da9bccbf50ec1bc680d2f32a8fd717b5ae0289ef695265f409', 'Source changed; recheck phrase boundaries first'
    with tempfile.TemporaryDirectory(prefix='tutorial-voices-') as tmp:
        pcm=Path(tmp)/'master.wav'
        subprocess.run(['afconvert',str(SOURCE),str(pcm),'-f','WAVE','-d','LEI16@48000','-c','1'],check=True)
        with wave.open(str(pcm)) as f: rate=f.getframerate();samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').copy()
    DEST.mkdir(exist_ok=True);clips=[];cuts=[]
    def save(name,text,start,end):
        data=samples[start:end].astype(np.float64)
        fade=min(round(.003*rate),len(data)//2)
        data[:fade]*=np.linspace(0,1,fade);data[-fade:]*=np.linspace(1,0,fade)
        data=np.rint(data).astype('<i2');file=DEST/(name+'.wav')
        with wave.open(str(file),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(data.tobytes())
        unit=data.astype(float)/32768
        clips.append(dict(id=name,text=text,source=str(file.relative_to(ROOT)),start=start/rate,end=end/rate,duration=len(data)/rate,peakDBFS=float(20*np.log10(max(abs(unit).max(),1e-12))),rmsDBFS=float(20*np.log10(max(np.sqrt(np.mean(unit**2)),1e-12))),dc=float(unit.mean()),sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
    for i,(name,text) in enumerate(LINES):
        lo=round(VALLEYS[i]*rate);hi=round(VALLEYS[i+1]*rate) if VALLEYS[i+1] else len(samples)
        block=480;chunk=samples[lo:hi].astype(float)/32768
        energy=np.array([np.sqrt(np.mean(chunk[j:j+block]**2)) for j in range(0,len(chunk),block)])
        active=np.flatnonzero(energy>10**(-48/20));assert len(active)
        start=max(lo,lo+int(active[0])*block-round(.04*rate))
        end=min(hi,lo+(int(active[-1])+1)*block+round(.08*rate))
        cuts.append((start,end))
        # User retired the old merge cut; never regenerate it from the combined master.
        if name != 'merge':save(f'{i+1:03}-{name}',text,start,end)
    save('011-combo','Play faster. Score higher.',cuts[6][0],cuts[7][1])
    save('012-completion','Clear the board. Have fun!',cuts[8][0],cuts[9][1])
    active={f'tutorial-{name}':['assets/sound/SPEECH/merge to make six voice.mp3' if name=='merge' else str((DEST/f'{i+1:03}-{name}.wav').relative_to(ROOT))] for i,(name,_) in enumerate(LINES[:6])}
    active['tutorial-special-bar']=['assets/sound/SPEECH/special bar voice.mp3']
    active.update({'tutorial-collection':['assets/sound/SPEECH/collection-little-helpers.wav'],'tutorial-combo':[str((DEST/'011-combo.wav').relative_to(ROOT))],'tutorial-completion':[str((DEST/'012-completion.wav').relative_to(ROOT))]})
    manifest=dict(master=str(SOURCE.relative_to(ROOT)),masterSHA256=source_hash,sampleRate=rate,channels=1,format='PCM16',edgeFadeMilliseconds=3,normalization='none',clips=clips,activeSources=active,collectionNote='Master has no separate collection line; reuse approved Let’s get to know these little helpers! recording.')
    manifest['baseSources']=active
    manifest['activeSources']={scene:['assets/sound/SPEECH/tutorial-voices-plus3db-v1/'+scene+'.wav'] for scene in active}
    manifest['playbackGainOverride']='tutorial-voices-plus3db-v1/manifest.json'
    override=ROOT/'assets/sound/SPEECH/special bar voice.mp3'
    override_hash=hashlib.sha256(override.read_bytes()).hexdigest()
    assert override_hash=='994005181319b153a709cbe130f0a8855d6573843577bb178d2c6265692c8fd8'
    manifest['specialBarOverride']=dict(master=str(override.relative_to(ROOT)),masterSHA256=override_hash,text='Each stack and merge fills the bar.',duration=2.50775,normalization='none; original MP3 played directly')
    merge=ROOT/active['tutorial-merge'][0]
    manifest['mergeOverride']=dict(master=str(merge.relative_to(ROOT)),masterSHA256=hashlib.sha256(merge.read_bytes()).hexdigest(),text='Merge the dice to make six.',normalization='none; playback derivative uses the shared tutorial +3dB policy',retiredCutDeleted=True)
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
    print(json.dumps({'masterSHA256':source_hash,'clips':[{k:c[k] for k in ['id','start','end','duration','peakDBFS']} for c in clips]},indent=2))
if __name__=='__main__':main()
