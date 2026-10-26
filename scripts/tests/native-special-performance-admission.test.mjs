import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
const audit=path.resolve('scripts/special-dice-performance-audit.mjs');
const sourceTests=['animated-dice-hud-foreground','special-idle-registry-cleanup','special-dice-idle-visibility','special-sound-warmup','juice-finale-textures','gameplay-render-suspension'].map(n=>`src/modules/__tests__/${n}.test.ts`);
function fixture(change=()=>{}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'native-performance-admission-'));
 const write=(name,body)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),body);};
 const entry={archetype:'wild-star',idleOwner:'src/idle.ts',finaleOwner:'src/finale.ts',warmupPolicy:'borrow originals',cleanupPolicy:'retire exact generation',hudDepthPolicy:'shared-animated-dice-hud-foreground',tests:[...sourceTests],nativeBlastOwner:'native/ui/Wave.swift: actual owner',nativeBlastPolicy:'interrupt before pickup and retire on generation',nativeTests:['native/standalone/AppTests/WaveTests.swift']};
 write('src/modules/special-dice-registry.ts',"const SPECIAL_DICE_VARIANTS = {star: {archetype: 'wild-star'}};");
 write('src/idle.ts','mountAnimatedDiceAboveHud();');write('src/finale.ts','');
 for(const file of sourceTests)write(file,'');
 write('native/ui/Wave.swift','final class Wave {}');
 write('native/standalone/AppTests/WaveTests.swift','final class WaveTests: XCTestCase { func testInterrupt() {} }');
 try {
  change(entry,{write,remove:file=>fs.rmSync(path.join(root,file))});
  write('docs/engineering/special-dice-performance-owners.json',JSON.stringify({star:entry}));
  const result=spawnSync(process.execPath,[audit],{cwd:root,encoding:'utf8'});
  return {status:result.status,output:result.stdout+result.stderr};
 } finally {fs.rmSync(root,{recursive:true,force:true});}
}
test('retains Source-only admission',()=>assert.equal(fixture(e=>{delete e.nativeBlastOwner;delete e.nativeBlastPolicy;delete e.nativeTests;}).status,0));
test('accepts separately registered real Native XCTest files',()=>assert.equal(fixture().status,0));
test('rejects absent Native owner',()=>assert.match(fixture((e,f)=>f.remove('native/ui/Wave.swift')).output,/FAIL.*missing Native blast owner/));
test('rejects absent Native tests',()=>assert.match(fixture(e=>e.nativeTests=[]).output,/FAIL.*missing Native regression tests/));
test('rejects a Swift file without XCTest cases',()=>assert.match(fixture((e,f)=>f.write(e.nativeTests[0],'final class Empty {}')).output,/FAIL.*Native test has no XCTest cases/));
test('Native receipts cannot replace mandatory Source regressions',()=>assert.match(fixture(e=>e.tests=e.tests.slice(1)).output,/FAIL.*missing shared foreground geometry regression/));
test('Native paths cannot be placed in the Source test namespace',()=>assert.match(fixture(e=>e.tests.push(e.nativeTests[0])).output,/FAIL.*missing test native/));
test('Native admission blocks a variant that drops the shared restore lifecycle suite',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
  import fs from 'node:fs';
  const original=fs.readFileSync.bind(fs);
  fs.readFileSync=(file,...args)=>{
   const data=original(file,...args);
   if(String(file).endsWith('/docs/engineering/native-special-dice-performance-owners.json')) {
    const manifest=JSON.parse(data);
    manifest.variants.spaceship.tests=manifest.variants.spaceship.tests.filter(file=>!file.endsWith('/NativeSourceRegularResumeConstructionTests.swift'));
    return JSON.stringify(manifest);
   }
   return data;
  };
  await import('./scripts/native-gameplay-admission.mjs');
 `],{cwd:path.resolve('.'),encoding:'utf8'});
 assert.equal(result.status,1,result.stdout+result.stderr);
 assert.match(result.stderr,/spaceship: missing shared Native restore\/idle regression/);
});
