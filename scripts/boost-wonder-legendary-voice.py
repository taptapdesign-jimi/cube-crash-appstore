"""Add exactly 2 dB to the current Wonder line without exceeding PCM/player peaks."""
from pathlib import Path
import array, hashlib, json, math, sys, wave
root=Path(__file__).resolve().parents[1]
base=root/'assets/sound/SPEECH/Jimbo voice compilation/journey-cards-v1'
source=base/'plus3db-v1/012-stage-06.wav'
destination=base/'wonder-extra2db-v1/012-stage-06.wav'
original=source.read_bytes()
old_cue_gain=0.72*10**(2/20)
new_cue_gain=1.0
factor=old_cue_gain*10**(2/20)/new_cue_gain
with wave.open(str(source),'rb') as reader:
    params=reader.getparams()
    assert params.sampwidth==2 and params.nchannels==1 and params.framerate==48000
    samples=array.array('h',reader.readframes(params.nframes))
if sys.byteorder!='little':samples.byteswap()
boosted=[round(v*factor) for v in samples]
assert min(boosted)>=-32768 and max(boosted)<=32767,'No clipping or limiting permitted'
result=array.array('h',boosted)
if sys.byteorder!='little':result.byteswap()
destination.parent.mkdir(exist_ok=True)
with wave.open(str(destination),'wb') as writer:
    writer.setparams(params);writer.writeframes(result.tobytes())
assert source.read_bytes()==original
rms=lambda values:math.sqrt(sum(v*v for v in values)/len(values))
delta=20*math.log10(rms(boosted)*new_cue_gain/(rms(samples)*old_cue_gain))
assert abs(delta-2)<0.001
report=dict(source=str(source.relative_to(root)),playback=str(destination.relative_to(root)),sourceSHA256=hashlib.sha256(original).hexdigest(),playbackSHA256=hashlib.sha256(destination.read_bytes()).hexdigest(),originalUnchanged=True,oldCueGain=old_cue_gain,newCueGain=new_cue_gain,pcmGainDb=20*math.log10(factor),effectiveIncreaseDb=delta,peakDbFS=20*math.log10(max(map(abs,boosted))/32768),frames=params.nframes,sampleRate=params.framerate,channels=params.nchannels,processing='Fixed gain and PCM16 rounding only; original preserved; no clipping, limiting, trim, resampling, pitch or rate change')
(root/'docs/audio/wonder-legendary-voice-extra2db-v1.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
