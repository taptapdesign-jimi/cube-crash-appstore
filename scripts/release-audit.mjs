#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC_DIRS = ['src'];
const REQUIRED_DOCS = [
  'docs/release/APP_STORE_READINESS_CHECKLIST.md',
  'docs/release/RELEASE_READINESS_CENTER.md',
];

const BLOCKER_PATTERNS = [
  {
    label: 'Git conflict marker',
    pattern: /^(<<<<<<<|=======|>>>>>>>) /m,
    paths: ['src', 'docs', 'package.json', 'vite.config.js', 'capacitor.config.ts'],
  },
  {
    label: 'Debugger statement',
    pattern: /\bdebugger\b/,
    paths: ['src'],
  },
  {
    label: 'Temporary Journey detail diagnostic prefix',
    pattern: /JourneyDetailCloseDiag|BoardDetailReturnDiag|ModalStatsReturnDiag/,
    paths: ['src'],
  },
  {
    label: 'Stale cleanup marker',
    pattern: /\b(REMOVED|DEPRECATED|DEAD CODE|temporary idle checker)\b/,
    paths: ['src'],
  },
];

const WARNING_PATTERNS = [
  {
    label: 'Direct console usage in src',
    pattern: /console\.(log|warn|error|debug|info)\s*\(/,
    paths: ['src'],
  },
  {
    label: 'Loose TODO marker',
    pattern: /\bTODO\b/i,
    paths: ['src', 'docs'],
  },
];

function walk(targetPath) {
  const absolute = path.join(root, targetPath);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage' || entry.name === '.git') {
      continue;
    }
    files.push(...walk(path.join(targetPath, entry.name)));
  }
  return files;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function relative(filePath) {
  return path.relative(root, filePath);
}

function collectMatches(rule) {
  const matches = [];
  const files = rule.paths.flatMap((targetPath) => walk(targetPath));

  for (const file of files) {
    const text = readText(file);
    if (!text) continue;

    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
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

function checkRequiredDocs() {
  return REQUIRED_DOCS.filter((docPath) => !fs.existsSync(path.join(root, docPath)));
}

function checkCapacitorProductionConfig() {
  const configPath = path.join(root, 'capacitor.config.ts');
  const text = readText(configPath);
  if (!text) return ['capacitor.config.ts missing or unreadable'];

  const issues = [];
  if (/server:\s*\{[\s\S]*url:/m.test(text) && !/CAPACITOR_USE_DEV_SERVER/.test(text)) {
    issues.push('capacitor.config.ts has a server.url without an environment guard');
  }
  return issues;
}

function checkViteProductionLoggingConfig() {
  const configPath = path.join(root, 'vite.config.js');
  const text = readText(configPath);
  if (!text) return ['vite.config.js missing or unreadable'];

  const issues = [];
  if (!/drop_console:\s*true/.test(text)) {
    issues.push('vite.config.js must enable terser compress.drop_console for production builds');
  }
  if (!/drop_debugger:\s*true/.test(text)) {
    issues.push('vite.config.js must enable terser compress.drop_debugger for production builds');
  }
  if (!/minify:\s*['"]terser['"]/.test(text)) {
    issues.push('vite.config.js must use terser minification so drop_console/drop_debugger are honored');
  }
  return issues;
}

function printGroup(title, rows, limit = 20) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows.slice(0, limit)) {
    if (typeof row === 'string') {
      console.log(`  - ${row}`);
    } else {
      console.log(`  - ${row.file}:${row.line} ${row.text}`);
    }
  }
  if (rows.length > limit) {
    console.log(`  ... ${rows.length - limit} more`);
  }
}

const blockers = [];
const warnings = [];

for (const rule of BLOCKER_PATTERNS) {
  const matches = collectMatches(rule);
  if (matches.length) blockers.push({ label: rule.label, matches });
}

for (const rule of WARNING_PATTERNS) {
  const matches = collectMatches(rule);
  if (matches.length) warnings.push({ label: rule.label, matches });
}

const missingDocs = checkRequiredDocs();
if (missingDocs.length) blockers.push({ label: 'Missing required release docs', matches: missingDocs });

const capacitorIssues = checkCapacitorProductionConfig();
if (capacitorIssues.length) blockers.push({ label: 'Capacitor production config risk', matches: capacitorIssues });

const viteLoggingIssues = checkViteProductionLoggingConfig();
if (viteLoggingIssues.length) blockers.push({ label: 'Production logging config risk', matches: viteLoggingIssues });

console.log('=== Cube Crash Release Audit ===');
console.log(`Source directories: ${SRC_DIRS.join(', ')}`);

for (const group of blockers) printGroup(`BLOCKER: ${group.label}`, group.matches);
for (const group of warnings) printGroup(`WARNING: ${group.label}`, group.matches, 12);

if (!blockers.length) {
  console.log('\nrelease-audit: PASS');
} else {
  console.log('\nrelease-audit: FAIL');
  process.exitCode = 1;
}
