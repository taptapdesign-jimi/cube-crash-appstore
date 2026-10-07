import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = path.resolve(rootFlag >= 0 ? args[rootFlag + 1] : process.cwd());
const printBaseline = args.includes('--print-baseline');
const baselinePath = path.join(root, 'docs/engineering/feature-runtime-baseline.json');
const ownersPath = path.join(root, 'docs/engineering/feature-runtime-owners.json');
const sourceRoot = path.join(root, 'src');

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const recurringPatterns = [
  ['interval', /\b(?:window\.)?setInterval\s*\(/g],
  ['timeout', /\b(?:window\.)?setTimeout\s*\(/g],
  ['animation-frame', /\b(?:window\.)?requestAnimationFrame\s*\(/g],
  ['gsap-infinite', /\brepeat\s*:\s*-1\b/g],
  ['waapi-infinite', /\biterations\s*:\s*Infinity\b/g],
  ['css-infinite', /\banimation(?:-iteration-count)?\s*:[^;\n}]*\binfinite\b/g],
  ['ticker-callback', /\.ticker\.add\s*\(|\bTicker\.shared\.add\s*\(|\bgsap\.ticker\.add\s*\(/g],
  ['pixi-application', /\bnew\s+(?:PIXI\.)?Application\s*\(/g],
  ['audio-context', /\bnew\s+(?:window\.)?(?:AudioContext|webkitAudioContext)\s*\(/g],
  ['observer', /\bnew\s+(?:ResizeObserver|IntersectionObserver|MutationObserver)\s*\(/g],
];

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files.sort();
}

function normalizeSnippet(source, index) {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const lineEnd = source.indexOf('\n', index);
  return source
    .slice(lineStart, lineEnd < 0 ? source.length : lineEnd)
    .replace(/\/\/.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectRecurringWork(files) {
  const occurrences = new Map();
  for (const file of files) {
    const filePath = relative(file);
    if (/\/(?:__tests__|test-fixtures)\//.test(filePath) || /\.test\.[^.]+$/.test(filePath)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const [kind, pattern] of recurringPatterns) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
        const snippet = normalizeSnippet(source, match.index);
        const key = JSON.stringify([filePath, kind, snippet]);
        const current = occurrences.get(key) ?? { file: filePath, kind, snippet, count: 0 };
        current.count += 1;
        occurrences.set(key, current);
      }
    }
  }
  return [...occurrences.values()].sort((a, b) =>
    a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind) || a.snippet.localeCompare(b.snippet));
}

function isRuntimeSurface(file, source) {
  const base = path.basename(file);
  if (/(?:screen|modal|overlay|panel|sheet)[-.].*\.(?:ts|tsx|js|jsx)$|(?:screen|modal|overlay|panel|sheet)\.(?:ts|tsx|js|jsx)$/.test(base)) return true;
  return /(?:id|className)\s*=\s*['"`][^'"`]*(?:screen|modal|overlay|panel|sheet)|classList\.add\([^\n]*(?:screen|modal|overlay|panel|sheet)/i.test(source);
}

function collectSurfaces(files) {
  return files
    .filter(file => !/\/(?:__tests__|test-fixtures)\//.test(relative(file)))
    .filter(file => ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file)))
    .filter(file => isRuntimeSurface(file, fs.readFileSync(file, 'utf8')))
    .map(relative)
    .sort();
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is unreadable: ${error.message}`);
  }
}

function requireText(record, key, errors) {
  if (typeof record[key] !== 'string' || !record[key].trim()) errors.push(`${record.id ?? '<unknown>'}: missing ${key}`);
}

const files = collectFiles(sourceRoot);
const currentRecurringWork = collectRecurringWork(files);
const currentSurfaces = collectSurfaces(files);

if (printBaseline) {
  console.log(JSON.stringify({ version: 1, grandfatheredSurfaces: currentSurfaces, recurringWork: currentRecurringWork }, null, 2));
  process.exit(0);
}

try {
  const baseline = readJson(baselinePath, 'feature runtime baseline');
  const owners = readJson(ownersPath, 'feature runtime owners');
  const errors = [];
  const registeredSurfaces = new Set();
  const ids = new Set();

  if (!Array.isArray(owners.features)) errors.push('feature runtime owners must contain a features array');
  for (const record of owners.features ?? []) {
    if (typeof record.id !== 'string' || !record.id.trim()) errors.push('feature record has no id');
    else if (ids.has(record.id)) errors.push(`${record.id}: duplicate feature id`);
    else ids.add(record.id);
    for (const key of ['entryOwner', 'exitOwner', 'resourcePolicy', 'animationPolicy', 'audioPolicy', 'hapticPolicy', 'visibilityPolicy', 'physicalAcceptance']) {
      requireText(record, key, errors);
    }
    if (!Array.isArray(record.surfaces) || !record.surfaces.length) errors.push(`${record.id}: missing surfaces`);
    if (!Array.isArray(record.tests) || !record.tests.length) errors.push(`${record.id}: missing tests`);
    for (const file of [...(record.surfaces ?? []), ...(record.tests ?? [])]) {
      if (typeof file !== 'string' || !(file.startsWith('src/') || file.startsWith('native/')) || file.split('/').includes('..') || !fs.existsSync(path.join(root, file))) {
        errors.push(`${record.id}: missing source/test file ${String(file)}`);
      }
    }
    for (const surface of record.surfaces ?? []) registeredSurfaces.add(surface);
  }

  const grandfatheredSurfaces = new Set(baseline.grandfatheredSurfaces ?? []);
  for (const surface of currentSurfaces) {
    if (!grandfatheredSurfaces.has(surface) && !registeredSurfaces.has(surface)) {
      errors.push(`${surface}: new runtime surface lacks a feature ownership record`);
    }
  }

  const allowedRecurringWork = new Map((baseline.recurringWork ?? []).map(item => [
    JSON.stringify([item.file, item.kind, item.snippet]),
    item.count,
  ]));
  for (const item of currentRecurringWork) {
    const key = JSON.stringify([item.file, item.kind, item.snippet]);
    const allowed = allowedRecurringWork.get(key) ?? 0;
    if (item.count > allowed) {
      errors.push(`${item.file}: new ${item.kind} primitive (${item.snippet}) — use a bounded/shared lifecycle owner`);
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }
  console.log(`PASS feature runtime architecture: ${owners.features.length} owned feature group(s), ${currentSurfaces.length} known surfaces, no new raw recurring-work primitives.`);
  console.log('Scope: deterministic ownership/admission only. Sustained FPS, memory, heat, haptics and animation feel remain physical checks.');
} catch (error) {
  console.error(`FAIL feature runtime architecture: ${error.message}`);
  process.exit(1);
}
