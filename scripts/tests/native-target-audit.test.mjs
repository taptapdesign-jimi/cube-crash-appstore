import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { auditNativeSource, auditNativeDependencies, runNativeAudit } from '../stack-to-six-native-target-audit.mjs';

const root=process.cwd(), standalone=path.join(root,'native/standalone');
function plist(file) {
  const value=spawnSync('/usr/bin/plutil',['-convert','json','-o','-',file],{encoding:'utf8'});
  assert.equal(value.status,0);return JSON.parse(value.stdout);
}
const source={
  project:plist(path.join(standalone,'Stack to Six.xcodeproj/project.pbxproj')),
  scheme:fs.readFileSync(path.join(standalone,'Stack to Six.xcodeproj/xcshareddata/xcschemes/Stack to Six.xcscheme'),'utf8'),
  storyboard:fs.readFileSync(path.join(standalone,'Stack to Six/Base.lproj/Main.storyboard'),'utf8'),
  controller:fs.readFileSync(path.join(root,'native/gameplay-app/NativeStandaloneViewController.swift'),'utf8'),
  info:plist(path.join(standalone,'Info.plist')),
  privacy:plist(path.join(standalone,'Stack to Six/PrivacyInfo.xcprivacy')),
};
function copy(){return structuredClone(source);}
function app(x) {
  const objects=x.project.objects;
  return objects[objects[x.project.rootObject].targets.find(id=>objects[id].productType==='com.apple.product-type.application')];
}
test('audits the actual Native target without a dist or PWA bundle prerequisite',()=>{
  assert.deepEqual(auditNativeSource(source),[]);
  assert.deepEqual(runNativeAudit(root,['--source-only']),[]);
});
test('rejects wrong Release identity even when Debug remains Native',()=>{
  const x=copy(),o=x.project.objects;
  for(const id of o[app(x).buildConfigurationList].buildConfigurations) {
    if(o[id].name==='Release')o[id].buildSettings.PRODUCT_BUNDLE_IDENTIFIER='com.taptapdesign.stacktosix.Stack-to-Six';
  }
  assert(auditNativeSource(x).some(message=>message.startsWith('Release must use')));
});
test('rejects an archived web controller included in the actual app target',()=>{
  const x=copy(),o=x.project.objects;
  const group=app(x).fileSystemSynchronizedGroups.map(id=>o[id]).find(g=>g.path==='Stack to Six');
  for(const id of group.exceptions)o[id].membershipExceptions=o[id].membershipExceptions.filter(name=>name!=='GameViewController.swift');
  assert(auditNativeSource(x).some(message=>message.includes('Archived web controller')));
});
test('a test-target exception cannot exclude Web.bundle from the application',()=>{
  const x=copy(),o=x.project.objects;
  const group=app(x).fileSystemSynchronizedGroups.map(id=>o[id]).find(g=>g.path==='Stack to Six');
  for(const id of group.exceptions)o[id].target='another-test-target';
  assert(auditNativeSource(x).some(message=>message.includes('Web.bundle')));
});
test('rejects web storyboard startup, wrong shared scheme and missing app composition',()=>{
  const x=copy();x.storyboard=x.storyboard.replace('customClass="NativeStandaloneViewController"','customClass="GameViewController"');
  assert(auditNativeSource(x).some(message=>message.includes('Storyboard initial')));
  const y=copy();y.scheme=y.scheme.replaceAll(/BlueprintIdentifier = "[^"]+"/g,'BlueprintIdentifier = "other"');
  assert(auditNativeSource(y).some(message=>message.includes('Shared scheme')));
  const z=copy();app(z).fileSystemSynchronizedGroups=app(z).fileSystemSynchronizedGroups.filter(id=>z.project.objects[id].path!=='../gameplay-app');
  assert(auditNativeSource(z).some(message=>message.includes('Native app composition')));
});
test('rejects a Native root importing WebKit or booting a web bundle',()=>{
  for(const addition of ['\nimport WebKit','\nimport JavaScriptCore','\nlet runtime = WKWebView()','\nlet bundle = "Web.bundle"']) {
    const x=copy();x.controller+=addition;
    assert(auditNativeSource(x).some(message=>message.includes('boot a web runtime')));
  }
});
test('checks actual host/framework dependencies while accepting Native system frameworks',()=>{
  assert.deepEqual(auditNativeDependencies('/System/Library/Frameworks/UIKit.framework/UIKit\n/System/Library/Frameworks/Foundation.framework/Foundation'),[]);
  for(const framework of ['WebKit','JavaScriptCore']) {
    assert.equal(auditNativeDependencies(`/System/Library/Frameworks/${framework}.framework/Versions/A/${framework}`).length,1);
    assert.equal(auditNativeDependencies(`/usr/lib/swift/libswift${framework}.dylib`).length,1);
  }
});
test('refuses an incomplete or unknown CLI option instead of silently skipping it',()=>{
  assert.throws(()=>runNativeAudit(root,['--built-app']),/requires an app path/);
  assert.throws(()=>runNativeAudit(root,['--built-app','--source-only']),/requires an app path/);
  assert.throws(()=>runNativeAudit(root,['--sync']),/Unknown argument/);
});
