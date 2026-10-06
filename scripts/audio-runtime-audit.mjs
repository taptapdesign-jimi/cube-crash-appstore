import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : process.cwd());
const printBaseline = args.includes('--print-baseline');
const sourceRoot = path.join(root, 'src');
const baselinePath = path.join(root, 'docs/audio/audio-runtime-baseline.json');
const ownersPath = path.join(root, 'docs/audio/audio-runtime-owners.json');
const registryPath = path.join(root, 'src/modules/gameplay-sound-owner-registry.ts');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const rawPatterns = [
  ['audio-element', /\bnew\s+Audio\s*\(/g],
  ['audio-context', /\bnew\s+(?:window\.)?(?:AudioContext|webkitAudioContext)\s*\(/g],
  ['buffer-source', /\.createBufferSource\s*\(/g],
  ['decode', /\.decodeAudioData\s*\(/g],
  ['audio-interval', /\b(?:window\.)?setInterval\s*\(/g],
  ['audio-frame', /\b(?:window\.)?requestAnimationFrame\s*\(/g],
];

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...collectFiles(absolute));
    else if (sourceExtensions.has(path.extname(entry.name))) result.push(absolute);
  }
  return result.sort();
}

function productionFiles() {
  return collectFiles(sourceRoot).filter(file => {
    const filePath = relative(file);
    return !/\/(?:__tests__|test-fixtures)\//.test(filePath) && !/\.test\.[^.]+$/.test(filePath);
  });
}

function lineSnippet(source, index) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end < 0 ? source.length : end).replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim();
}

function isAudioOwner(file, source) {
  return /(?:sound|audio|soundtrack)[-.].*\.(?:ts|tsx|js|jsx)$|(?:sound|audio|soundtrack)\.(?:ts|tsx|js|jsx)$/.test(path.basename(file))
    || /playDecodedGameplaySound|new\s+Audio\s*\(|AudioContext|\.play\(\)/.test(source);
}

function collectState(files) {
  const owners = [];
  const assetReferences = [];
  const raw = new Map();
  for (const file of files) {
    const filePath = relative(file);
    const source = fs.readFileSync(file, 'utf8');
    if (isAudioOwner(file, source)) owners.push(filePath);
    for (const match of source.matchAll(/["'`](\.\/assets\/sound\/[^"'`$]*)["'`]/g)) {
      assetReferences.push({ file: filePath, source: match[1] });
    }
    if (!isAudioOwner(file, source)) continue;
    for (const [kind, pattern] of rawPatterns) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
        const snippet = lineSnippet(source, match.index);
        const key = JSON.stringify([filePath, kind, snippet]);
        const item = raw.get(key) ?? { file: filePath, kind, snippet, count: 0 };
        item.count += 1;
        raw.set(key, item);
      }
    }
  }
  return {
    grandfatheredOwners: owners.sort(),
    assetReferences: assetReferences.sort((a, b) => a.file.localeCompare(b.file) || a.source.localeCompare(b.source)),
    rawAudioPrimitives: [...raw.values()].sort((a, b) => a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind) || a.snippet.localeCompare(b.snippet)),
  };
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`${label} is unreadable: ${error.message}`); }
}

function textField(record, key, errors) {
  if (typeof record[key] !== 'string' || !record[key].trim()) errors.push(`${record.id ?? '<unknown>'}: missing ${key}`);
}

const state = collectState(productionFiles());
if (printBaseline) {
  console.log(JSON.stringify({ version: 1, ...state }, null, 2));
  process.exit(0);
}

try {
  const baseline = readJson(baselinePath, 'audio runtime baseline');
  const manifest = readJson(ownersPath, 'audio runtime owners');
  const registrySource = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';
  const errors = [];
  const registeredOwners = new Set();
  const registeredAssets = new Set();
  const ids = new Set();

  if (!Array.isArray(manifest.owners)) errors.push('audio runtime owners must contain an owners array');
  const transports = manifest.transportOwners ?? [];
  for (const record of [...(manifest.owners ?? []), ...transports]) {
    if (typeof record.id !== 'string' || !record.id.trim()) errors.push('audio owner has no id');
    else if (ids.has(record.id)) errors.push(`${record.id}: duplicate audio owner id`);
    else ids.add(record.id);
    for (const key of ['ownerFile', 'family', 'eventOwner', 'transport', 'voicePolicy', 'preloadPolicy', 'settingsPolicy', 'interruptionPolicy', 'stopExport', 'physicalAcceptance']) textField(record, key, errors);
    if (!Array.isArray(record.sources) || !record.sources.length) errors.push(`${record.id}: missing sources`);
    if (!Array.isArray(record.tests) || !record.tests.length) errors.push(`${record.id}: missing tests`);
    if (typeof record.ownerFile === 'string') {
      registeredOwners.add(record.ownerFile);
      if (!fs.existsSync(path.join(root, record.ownerFile))) errors.push(`${record.id}: missing ownerFile ${record.ownerFile}`);
      else {
        const ownerSource = fs.readFileSync(path.join(root, record.ownerFile), 'utf8');
        const escapedStop = String(record.stopExport ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!escapedStop || !new RegExp(`export\\s+(?:function|const)\\s+${escapedStop}\\b`).test(ownerSource)) errors.push(`${record.id}: stopExport is not exported by ownerFile`);
      }
    }
    for (const source of record.sources ?? []) {
      if (typeof source !== 'string' || !source.startsWith('./assets/sound/')) errors.push(`${record.id}: invalid sound source ${String(source)}`);
      else registeredAssets.add(JSON.stringify([record.ownerFile, source]));
    }
    for (const test of record.tests ?? []) {
      if (typeof test !== 'string' || !test.startsWith('src/') || !fs.existsSync(path.join(root, test))) errors.push(`${record.id}: missing test ${String(test)}`);
    }
    if (transports.includes(record)) {
      // Music transports inherit Music OFF and disposal from their existing
      // soundtrack owner. Registering them in Sounds OFF would mute music.
      if (record.globalRegistryRequired !== false || record.lifecycleOwnerFile !== 'src/modules/soundtrack-manager.ts') {
        errors.push(`${record.id}: soundtrack transport must retain the canonical music lifecycle owner`);
      }
      const lifecycleSource = fs.readFileSync(path.join(root, 'src/modules/soundtrack-manager.ts'), 'utf8');
      if (!lifecycleSource.includes('voice.dispose') && !lifecycleSource.includes('voice as MainThemeVoiceLike).dispose')) {
        errors.push(`${record.id}: canonical soundtrack disposal is missing`);
      }
    } else if (record.globalRegistryRequired !== true) errors.push(`${record.id}: globalRegistryRequired must be true for a feature SFX owner`);
    if (record.globalRegistryRequired === true && typeof record.ownerFile === 'string' && typeof record.stopExport === 'string') {
      const moduleRef = `./${path.basename(record.ownerFile).replace(/\.ts$/, '.js')}`;
      if (!registrySource.includes(moduleRef) || !registrySource.includes(`owner.${record.stopExport}`)) errors.push(`${record.id}: owner full stop is missing from gameplay-sound-owner-registry`);
    }
  }

  const grandfatheredOwners = new Set(baseline.grandfatheredOwners ?? []);
  for (const owner of state.grandfatheredOwners) {
    if (!grandfatheredOwners.has(owner) && !registeredOwners.has(owner)) errors.push(`${owner}: new audio owner lacks an audio ownership record`);
  }
  const grandfatheredAssets = new Set((baseline.assetReferences ?? []).map(item => JSON.stringify([item.file, item.source])));
  for (const item of state.assetReferences) {
    const key = JSON.stringify([item.file, item.source]);
    if (!grandfatheredAssets.has(key) && !registeredAssets.has(key)) errors.push(`${item.file}: new sound source ${item.source} lacks an audio ownership record`);
  }
  const allowedRaw = new Map((baseline.rawAudioPrimitives ?? []).map(item => [JSON.stringify([item.file, item.kind, item.snippet]), item.count]));
  for (const item of state.rawAudioPrimitives) {
    const allowed = allowedRaw.get(JSON.stringify([item.file, item.kind, item.snippet])) ?? 0;
    if (item.count > allowed) errors.push(`${item.file}: new raw ${item.kind} primitive (${item.snippet}) — use the shared audio transport/lifecycle owner`);
  }

  if (errors.length) {
    errors.forEach(error => console.error(`FAIL ${error}`));
    process.exit(1);
  }
  console.log(`PASS audio runtime architecture: ${manifest.owners.length} registered exemplar/future owner(s), ${state.grandfatheredOwners.length} known audio surfaces, no unregistered source or raw transport growth.`);
  console.log('Scope: ownership/admission only. Speaker mix, route continuity, decode cost and thermal behavior remain physical checks.');
} catch (error) {
  console.error(`FAIL audio runtime architecture: ${error.message}`);
  process.exit(1);
}
