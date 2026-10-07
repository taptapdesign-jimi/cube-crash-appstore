import fs from 'node:fs';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';
const folder=fileURLToPath(new URL('./',import.meta.url));
execFileSync(process.execPath,[folder+'export-bottom-decor-oracle.mjs'],{stdio:'inherit'});
const path=folder+'NativeJourneyBottomDecorSourceOracle.swift',json=fs.readFileSync(folder+'bottom-decor-oracle.json','utf8'),text=fs.readFileSync(path,'utf8');
const pattern=/private static let json = #"""\n[\s\S]*?\n"""#/;
if(!pattern.test(text))throw Error('Original fixture field missing');
fs.writeFileSync(path,text.replace(pattern,()=>`private static let json = #"""\n${json}\n"""#`));fs.unlinkSync(folder+'bottom-decor-oracle.json');
