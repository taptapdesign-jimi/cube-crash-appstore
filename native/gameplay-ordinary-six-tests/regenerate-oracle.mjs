import fs from 'node:fs';
import {fileURLToPath}from'node:url';
import {execFileSync}from'node:child_process';
const folder=fileURLToPath(new URL('./',import.meta.url));
for(const file of ['export-patterns.mjs','export-oracle.mjs','export-hero.mjs']) {
  execFileSync(process.execPath,[folder+file],{stdio:'inherit'});
}
const destination=folder+'NativeRegularSixSourceOracle.swift';
let text=fs.readFileSync(destination,'utf8');
for(const [field,file]of [['json','ordinary-source-oracle.json'],['heroJSON','ordinary-hero-oracle.json']]) {
  const value=fs.readFileSync(folder+file,'utf8');
  const pattern=new RegExp('private static let '+field+' = #"""\\n[\\s\\S]*?\\n"""#');
  if(!pattern.test(text))throw Error('Missing generated fixture field '+field);
  text=text.replace(pattern,()=>`private static let ${field} = #"""\n${value}\n"""#`);
}
fs.writeFileSync(destination,text);
for(const file of ['ordinary-source-oracle.json','ordinary-hero-oracle.json'])fs.unlinkSync(folder+file);
console.log('Native fixture refreshed only from preserved TS owners + actual GSAP.');
