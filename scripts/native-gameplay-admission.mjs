import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const errors = [];
function swiftFiles(folder) {
  const directory = path.join(root,folder);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry => entry.isDirectory()
    ? swiftFiles(`${folder}/${entry.name}`) : entry.name.endsWith('.swift') ? [`${folder}/${entry.name}`] : []);
}
const runtimeFolders = fs.readdirSync(path.join(root,'native'),{withFileTypes:true})
  .filter(entry => entry.isDirectory() && entry.name.startsWith('gameplay-') && !entry.name.endsWith('-tests'))
  .map(entry => ['gameplay-core','gameplay-state'].includes(entry.name) ? `native/${entry.name}/Sources` : `native/${entry.name}`);
const files = runtimeFolders.flatMap(swiftFiles);
for (const file of files) {
  if (file === 'native/gameplay-app/NativeHybridExport.swift') continue; // isolated one-time profile migration; retired before gameplay
  const code = read(file).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/[^\n]*$/gm,'');
  if (/\bimport\s+WebKit\b|\bWKWebView\b|\bevaluateJavaScript\s*\(|\bcallAsyncJavaScript\s*\(/.test(code)) errors.push(`${file}: native gameplay dependency on web runtime`);
}
const sourceIDs = [...read('src/modules/special-dice-registry.ts').matchAll(/^\s+id: '([^']+)'/gm)].map(match => match[1]).sort();
const nativeIDs = [...read('native/gameplay-core/Sources/StackToSixGameplay/NativeSpecialDiceRegistry.swift').matchAll(/Variant\("([^"]+)"/g)].map(match => match[1]).sort();
if (JSON.stringify(sourceIDs) !== JSON.stringify(nativeIDs)) errors.push('Native Special registry identity differs from canonical registry');
const sourcePerformance = JSON.parse(read('docs/engineering/special-dice-performance-owners.json'));
const nativePerformance = JSON.parse(read('docs/engineering/native-special-dice-performance-owners.json')).variants;
for (const id of sourceIDs) {
  const record = nativePerformance[id];
  if (!record) {errors.push(`${id}: missing native performance owner`);continue;}
  if (record.archetype !== sourcePerformance[id]?.archetype) errors.push(`${id}: native performance archetype mismatch`);
  for (const key of ['warmupPolicy','cleanupPolicy','hudDepthPolicy','physicalAcceptance']) if (!record[key]?.trim()) errors.push(`${id}: missing native ${key}`);
  for (const file of [record.idleOwner,record.finaleOwner,...record.tests ?? []]) if (!file?.startsWith('native/') || !fs.existsSync(path.join(root,file))) errors.push(`${id}: missing native performance owner/test ${file}`);
}
for (const id of Object.keys(nativePerformance)) if (!sourceIDs.includes(id)) errors.push(`${id}: stale native performance owner`);
const project = read('native/standalone/Stack to Six.xcodeproj/project.pbxproj');
if (!project.includes('com.taptapdesign.stacktosix.native')) errors.push('Separate Native target identity missing');
for (const product of ['StackToSixGameplay','StackToSixNativeState']) if (!project.includes(`productName = ${product}`)) errors.push(`Native target does not link ${product}`);
const owners = JSON.parse(read('docs/engineering/feature-runtime-owners.json'));
if (!owners.features.some(record => record.id === 'native-swift-gameplay-migration')) errors.push('Native gameplay feature owner missing');
const audio = JSON.parse(read('docs/audio/audio-runtime-owners.json'));
if (!audio.nativeOwners?.some(record => record.id === 'native-swift-soundtrack-route')) errors.push('Native music lifecycle owner missing');
const archetypes = JSON.parse(read('docs/engineering/special-dice-archetype-owners.json'));
for (const id of ['wild-star','wild-juice','wild-magnet','wild-tnt']) {
  const record = archetypes.nativeOwners?.find(owner => owner.id === id);
  if (!record) {errors.push(`Missing Native archetype owner ${id}`); continue;}
  for (const key of ['transactionOwner','endgameOwner','saveOwner','inputOwner','audioOwner']) if (!record[key]) errors.push(`${id}: missing ${key}`);
  for (const file of [record.mergeOwner,...record.tests ?? []]) if (!file || !fs.existsSync(path.join(root,file))) errors.push(`${id}: missing Native owner/test ${file}`);
}
if (errors.length) {errors.forEach(error => console.error(`FAIL ${error}`));process.exitCode = 1;}
else console.log(`PASS native admission: gameplay/runtime Swift sources have no web runtime calls; one isolated migration exporter is declared separately. ${nativeIDs.length} Special identities and separate target/package ownership match. This does not close gameplay/visual parity or physical acceptance.`);
