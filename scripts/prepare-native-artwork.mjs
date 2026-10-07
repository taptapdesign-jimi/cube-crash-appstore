import { cp, mkdir, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Explicit separate Native destination. Never run the PWA postbuild/sync owner.
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'assets');
const destination = path.join(root, 'native/standalone/Stack to Six/NativeAssets.bundle/assets');
await mkdir(destination, { recursive: true });
// APFS clones keep the byte-identical development package from duplicating
// physical source storage. There is no source asset transformation.
await cp(source, destination, { recursive: true, force: true, mode: constants.COPYFILE_FICLONE });
async function inventory(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await inventory(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}
const originals = await inventory(source);
const copied = await inventory(destination);
if (JSON.stringify(originals) !== JSON.stringify(copied)) throw new Error('Native artwork inventory differs from source');
for (const file of originals) {
  const hash = async directory => createHash('sha256').update(await readFile(path.join(directory, file))).digest('hex');
  if (await hash(source) !== await hash(destination)) throw new Error(`Native artwork bytes differ: ${file}`);
}
console.log(`PASS: ${originals.length} original asset files byte-exact in NativeAssets.bundle; no web entry/scripts copied.`);
