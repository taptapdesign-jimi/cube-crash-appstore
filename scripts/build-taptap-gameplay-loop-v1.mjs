// Reproducible, lossless derivative. Never modifies the supplied master.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const source = 'assets/sound/soundtrack/TapTapDesign-Stacktosixtheme.wav';
const directory = 'assets/sound/soundtrack/taptap-gameplay-v1';
const output = `${directory}/taptap-gameplay-intro-loop.wav`;
const loopOutput = `${directory}/taptap-gameplay-loop.wav`;
const bytes = fs.readFileSync(source);
let format, data;
for (let offset=12; offset+8<=bytes.length;) {
  const size=bytes.readUInt32LE(offset+4), start=offset+8;
  if (bytes.toString('ascii',offset,offset+4)==='fmt ') format=bytes.subarray(start,start+size);
  if (bytes.toString('ascii',offset,offset+4)==='data') data=bytes.subarray(start,start+size);
  offset=start+size+(size%2);
}
if (!format || !data || format.readUInt16LE(0)!==1 || format.readUInt16LE(2)!==2 || format.readUInt32LE(4)!==48000 || format.readUInt16LE(14)!==16) throw Error('Expected 48kHz stereo PCM16 master');
const rate=48000, bpm=118.08; // Estimated from multi-beat onset autocorrelation, not score metadata.
const barFrames=Math.round(60/bpm*4*rate), introFrames=barFrames*2, loopFrames=barFrames*32;
if (data.length/4<loopFrames+introFrames) throw Error('Master too short');
const frames=introFrames+loopFrames, audio=new Float64Array(frames*2);
for (let frame=0; frame<frames; frame++) {
  for (let channel=0; channel<2; channel++) {
    // First two bars play once; retain the next 30 bars chronologically.
    let sample=data.readInt16LE(frame*4+channel*2)/32768;
    if (frame>=loopFrames) {
      // Two-bar phrase-aligned return into the original opening. A complementary
      // cosine envelope avoids the +3dB swell of equal-power correlated music.
      const i=frame-loopFrames, t=i/(introFrames-1), head=(1-Math.cos(Math.PI*t))/2;
      sample=sample*(1-head)+data.readInt16LE(i*4+channel*2)/32768*head;
    }
    // Soft one-time 80ms entrance; never fade out or fade in on a loop wrap.
    if(frame<3840) sample*=0.5-0.5*Math.cos(Math.PI*frame/3839);
    audio[frame*2+channel]=sample;
  }
}
let peak=0,sum=0,squares=0;
for(const value of audio){peak=Math.max(peak,Math.abs(value));sum+=value;squares+=value*value;}
const gain=Math.min(1,10**(-3/20)/peak);
const result=Buffer.alloc(44+frames*6);
result.write('RIFF');result.writeUInt32LE(result.length-8,4);result.write('WAVEfmt ',8);
result.writeUInt32LE(16,16);result.writeUInt16LE(1,20);result.writeUInt16LE(2,22);
result.writeUInt32LE(rate,24);result.writeUInt32LE(rate*6,28);result.writeUInt16LE(6,32);result.writeUInt16LE(24,34);
result.write('data',36);result.writeUInt32LE(frames*6,40);
for(let i=0;i<audio.length;i++) result.writeIntLE(Math.round(audio[i]*gain*8388607),44+i*3,3);
const loopBytes=Buffer.concat([result.subarray(0,44),result.subarray(44+introFrames*6)]);
loopBytes.writeUInt32LE(loopBytes.length-8,4);loopBytes.writeUInt32LE(loopBytes.length-44,40);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const rms=(begin,end)=>{let s=0;for(let i=begin*2;i<end*2;i++)s+=audio[i]**2;return 20*Math.log10(Math.sqrt(s/((end-begin)*2))*gain);};
const report={source,sourceSha256:hash(bytes),output,outputSha256:hash(result),loopOutput,loopSha256:hash(loopBytes),sampleRate:rate,channels:2,bitDepth:24,estimatedBpm:bpm,barFrames,loopBars:32,crossfadeBars:2,introSeconds:introFrames/rate,loopStartSeconds:introFrames/rate,loopEndSeconds:frames/rate,loopDurationSeconds:loopFrames/rate,peakDb:20*Math.log10(peak*gain),rmsDb:20*Math.log10(Math.sqrt(squares/audio.length)*gain),dcOffset:sum/audio.length*gain,normalizationGain:gain,seamJump:Math.max(...[0,1].map(c=>Math.abs(audio[(frames-1)*2+c]-audio[introFrames*2+c])*gain)),headRmsDb:rms(introFrames,introFrames+2400),tailRmsDb:rms(frames-2400,frames)};
if(report.peakDb>-.1 || report.seamJump>.05 || Math.abs(report.dcOffset)>.01 || Math.min(report.headRmsDb,report.tailRmsDb)<-45) throw Error(`Unsafe loop: ${JSON.stringify(report)}`);
fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(output,result);fs.writeFileSync(loopOutput,loopBytes);
fs.writeFileSync(path.join(directory,'analysis.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(directory,'README.md'),`# TapTapDesign gameplay theme v1\n\nSource: \`${source}\` (unchanged). Rebuild: \`node scripts/build-taptap-gameplay-loop-v1.mjs\`.\n\nTwo-bar original opening with an 80ms soft entrance, followed by a 32-bar circular loop. The last two bars blend back into the original opening on a complementary cosine curve; the source's final cadence/fade is excluded. Original pitch, stereo and speed are preserved. Tempo estimate: ${bpm} BPM.\n\nNative starts at zero and repeats from ${report.loopStartSeconds}s to ${report.loopEndSeconds}s using the existing sample-clock file transport. No recurring crossfade or second simultaneous gameplay layer. The separate \`taptap-gameplay-loop.wav\` is the same loop region without the one-time intro and can repeat from file start.\n\nAutomated sample/level checks are recorded in analysis.json. Musical seam and speaker mix require listening acceptance.\n`);
console.log(JSON.stringify(report,null,2));
