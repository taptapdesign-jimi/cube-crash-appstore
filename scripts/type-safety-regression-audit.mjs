import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'src');
const baselinePath = path.join(root, 'scripts', 'ts-nocheck-baseline.json');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(absolutePath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
if (!Array.isArray(baseline) || baseline.some((entry) => typeof entry !== 'string')) {
  throw new Error('ts-nocheck baseline must be a JSON array of source paths');
}

const sortedBaseline = [...new Set(baseline)].sort();
if (JSON.stringify(baseline) !== JSON.stringify(sortedBaseline)) {
  throw new Error('ts-nocheck baseline must be sorted and contain no duplicates');
}

const files = await collectSourceFiles(sourceRoot);
const actual = [];
for (const absolutePath of files) {
  const source = await readFile(absolutePath, 'utf8');
  if (/^\s*\/\/\s*@ts-nocheck\b/m.test(source)) {
    actual.push(path.relative(root, absolutePath).split(path.sep).join('/'));
  }
}
actual.sort();

const baselineSet = new Set(sortedBaseline);
const actualSet = new Set(actual);
const added = actual.filter((entry) => !baselineSet.has(entry));
const removed = sortedBaseline.filter((entry) => !actualSet.has(entry));

if (added.length || removed.length) {
  console.error('FAIL: @ts-nocheck baseline changed.');
  if (added.length) {
    console.error('\nNew directives are forbidden without an explicit baseline decision:');
    for (const entry of added) console.error(`  + ${entry}`);
  }
  if (removed.length) {
    console.error('\nType debt was removed; delete these stale baseline entries:');
    for (const entry of removed) console.error(`  - ${entry}`);
  }
  process.exit(1);
}

console.log(`PASS: no new @ts-nocheck directives (${actual.length} grandfathered source files).`);
