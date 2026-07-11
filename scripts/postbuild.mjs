#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const assetsDir = path.join(root, 'assets');
const distAssetsDir = path.join(distDir, 'assets');

const nativeWebBundles = [
  '/Users/user/Stack to Six/Stack to Six/Web.bundle',
];

function copyDirectoryContents(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function syncDirectory(sourceDir, destinationDir) {
  if (!fs.existsSync(destinationDir)) return false;

  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(destinationDir, { recursive: true });
  copyDirectoryContents(sourceDir, destinationDir);
  return true;
}

copyDirectoryContents(assetsDir, distAssetsDir);

if (process.env.SKIP_NATIVE_BUNDLE_SYNC === 'true') {
  console.log('postbuild: skipped native Web.bundle sync');
  process.exit(0);
}

for (const bundleDir of nativeWebBundles) {
  if (syncDirectory(distDir, bundleDir)) {
    console.log(`postbuild: synced ${path.relative(path.dirname(bundleDir), bundleDir)} from dist`);
  }
}
