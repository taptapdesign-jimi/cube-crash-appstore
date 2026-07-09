#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(root, filePath);
}

function collectMatches(files, pattern) {
  const matches = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({
          file: relative(file),
          line: index + 1,
          text: line.trim().slice(0, 180),
        });
      }
    });
  }
  return matches;
}

function printGroup(title, rows, limit = 20) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows.slice(0, limit)) {
    console.log(`  - ${row.file}:${row.line} ${row.text}`);
  }
  if (rows.length > limit) {
    console.log(`  ... ${rows.length - limit} more`);
  }
}

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run npm run build before release:bundle-audit.');
  process.exit(1);
}

const files = walk(distDir).filter((file) => /\.(js|html)$/i.test(file));
const isVendorFile = (file) => path.basename(file).startsWith('vendor-');
const appFiles = files.filter((file) => !isVendorFile(file));
const vendorFiles = files.filter(isVendorFile);

const consoleMatches = collectMatches(appFiles, /\bconsole\.(log|warn|error|info|debug)\s*\(/);
const vendorConsoleMatches = collectMatches(vendorFiles, /\bconsole\.(log|warn|error|info|debug)\s*\(/);
const debuggerMatches = collectMatches(files, /\bdebugger\b/);
const sourceMapMatches = collectMatches(files, /\/\/# sourceMappingURL=/);

console.log('=== Cube Crash Release Bundle Audit ===');
console.log(`Scanned files: ${files.length}`);

printGroup('BLOCKER: console calls in built bundle', consoleMatches);
printGroup('BLOCKER: debugger statements in built bundle', debuggerMatches);
printGroup('WARNING: vendor console calls in built bundle', vendorConsoleMatches);
printGroup('WARNING: source map comments in built bundle', sourceMapMatches);

if (consoleMatches.length || debuggerMatches.length) {
  console.log('\nrelease-bundle-audit: FAIL');
  process.exitCode = 1;
} else {
  console.log('\nrelease-bundle-audit: PASS');
}
