#!/usr/bin/env python3
"""Split user-confirmed ordered 110-phrase master; source bytes remain unchanged."""
import hashlib,json,re,subprocess,tempfile,wave,unicodedata
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/sound/Clean board/voice/clean board voices.mp3'
EXPECTED_SOURCE_SHA256='caf77eaa03055b48fd84f1b2e606b94fcd64a5c7b7d60ca6207eb61e98818d41'
DEST=ROOT/'assets/sound/Clean board/voice/clean booard title voice'
def main():
    titles=json.loads(re.search(r'clean:\[String\]=(\[[^\n]+\])',(ROOT/'native/gameplay-results/NativeResultHeadlines.swift').read_text())[1]);assert len(titles)==110
    source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert source_hash==EXPECTED_SOURCE_SHA256,"New master requires new alignment review"
    with tempfile.TemporaryDirectory(prefix='clean-title-v3-') as folder:
        pcm=Path(folder)/'master.wav'
        subprocess.run(['afconvert',str(SOURCE),str(pcm),'-f','WAVE','-d','LEI16@48000','-c','1'],check=True)
        with wave.open(str(pcm)) as f:rate=f.getframerate();x=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').copy()
    hop=240;v=np.sqrt(np.mean((x[:len(x)//hop*hop].astype(float)/32768).reshape(-1,hop)**2,axis=1))
    active=np.flatnonzero(v>10**(-40/20));gaps=[(int(a),int(b)) for a,b in zip(active[:-1],active[1:]) if b-a>=40]
    assert len(gaps)==109,f'Expected109 phrase gaps,got{len(gaps)};manual alignment required'
    # Midpoints remain in inter-phrase quiet; preserve all intra-phrase syllables.
    boundaries=[0]+[round((a+b)*hop/2) for a,b in gaps]+[len(x)]
    DEST.mkdir(exist_ok=True,parents=True);clips=[]
    for i,title in enumerate(titles):
        start,end=boundaries[i:i+2];chunk=x[start:end].copy()
        assert .25<len(chunk)/rate<2.5,(i,title,len(chunk)/rate)
        fade=min(144,len(chunk)//10)
        chunk[:fade]=np.rint(chunk[:fade]*np.linspace(0,1,fade)).astype('<i2');chunk[-fade:]=np.rint(chunk[-fade:]*np.linspace(1,0,fade)).astype('<i2')
        slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',title).encode('ascii','ignore').decode().lower()).strip('-')
        path=DEST/f'{i+1:03d}-{slug}.wav'
        with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(chunk.tobytes())
        clips.append(dict(title=title,source=str(path.relative_to(ROOT)),start=start/rate,end=end/rate,duration=len(chunk)/rate,peakDbFS=float(20*np.log10(max(1,np.max(np.abs(chunk.astype(float))))/32768)),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
    report=dict(master=str(SOURCE.relative_to(ROOT)),masterSha256=source_hash,format='48000Hz mono PCM16 WAV',processing='Decode only; no gain/normalization/pitch/rate change; 3ms edge fades in inter-phrase silence.',alignment='User-confirmed title order;109 >=200ms quiet gaps at -40dBFS5msRMS;cuts at gap midpoints.',clips=clips)
    (ROOT/'docs/audio/clean-board-title-voices-v3.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    p=ROOT/'native/gameplay-results/NativeCleanBoardTitleVoice.swift';s=p.read_text();a=s.index('    static let entries:');b=s.index('    static func cue',a)
    entries='    static let entries:[Entry] = [\n'+''.join('        Entry(title:'+json.dumps(c['title'],ensure_ascii=False)+',source:'+json.dumps(c['source'],ensure_ascii=False)+'),\n' for c in clips)+'    ]\n'
    s=s[:a]+entries+s[b:];s=s.replace('clean-board-title-voices-v2.json','clean-board-title-voices-v3.json');p.write_text(s)
    print(json.dumps(dict(clips=len(clips),duration=len(x)/rate,minDuration=min(c['duration'] for c in clips),maxDuration=max(c['duration'] for c in clips),maxPeakDbFS=max(c['peakDbFS'] for c in clips))))
if __name__=='__main__':main()
