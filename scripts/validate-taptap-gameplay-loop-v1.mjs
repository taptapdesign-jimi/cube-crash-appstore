import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const directory='assets/sound/soundtrack/taptap-gameplay-v1';
const report=JSON.parse(fs.readFileSync(`${directory}/analysis.json`));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=fs.readFileSync(report.source),output=fs.readFileSync(report.output);
assert.equal(hash(original),report.sourceSha256,'Original master changed');
assert.equal(hash(output),report.outputSha256,'Derived bytes differ from measured file');
let data;
for(let i=12;i+8<original.length;){const n=original.readUInt32LE(i+4);if(original.toString('ascii',i,i+4)==='data')data=original.subarray(i+8,i+8+n);i+=8+n+(n%2);}
assert.ok(data);
assert.equal(output.readUInt32LE(24),48000);assert.equal(output.readUInt16LE(22),2);assert.equal(output.readUInt16LE(34),24);
const frames=(output.length-44)/6,start=report.barFrames*2;
assert.equal(frames,report.barFrames*34);
const loop=fs.readFileSync(report.loopOutput);
assert.equal(hash(loop),report.loopSha256);
assert.deepEqual(loop.subarray(44),output.subarray(44+start*6));
const sample=(f,c)=>output.readIntLE(44+f*6+c*3,3)/8388607;
// The wrap is adjacent original PCM samples, not just an arbitrary zero crossing.
for(const c of [0,1]){
 assert.ok(Math.abs(sample(frames-1,c)-data.readInt16LE((start-1)*4+c*2)/32768*report.normalizationGain)<2/8388607);
 assert.ok(Math.abs(sample(start,c)-data.readInt16LE(start*4+c*2)/32768*report.normalizationGain)<2/8388607);
}
let peak=0,square=0,sum=0;
for(let f=0;f<frames;f++)for(const c of [0,1]){const s=sample(f,c);peak=Math.max(peak,Math.abs(s));square+=s*s;sum+=s;}
assert.ok(peak<10**(-3/20));assert.ok(Math.abs(sum/(frames*2))<.01);
assert.ok(report.headRmsDb>-45 && report.tailRmsDb>-45);
console.log(`PASS gameplay master hash, PCM format, ${frames} frames, original-adjacent loop seam, peak ${20*Math.log10(peak)}dBFS, RMS ${20*Math.log10(Math.sqrt(square/(frames*2)))}dBFS`);
