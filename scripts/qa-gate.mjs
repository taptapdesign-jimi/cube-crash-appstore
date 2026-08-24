import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'fast';
if (!['fast', 'full'].includes(mode)) {
  console.error('Usage: node scripts/qa-gate.mjs <fast|full>');
  process.exit(2);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;
const buildEnv = { ...process.env, SKIP_NATIVE_BUNDLE_SYNC: 'true' };

function changedLintFiles() {
  const tracked = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--'], {
    encoding: 'utf8',
  });
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  if (tracked.status !== 0 || untracked.status !== 0) return [];
  return [...new Set(`${tracked.stdout}\n${untracked.stdout}`
    .split('\n')
    .filter((file) => /^src\/.*\.(?:ts|tsx|js|jsx)$/.test(file)))];
}

const fastLintFiles = changedLintFiles();
const fastSteps = [
  ['Unstaged diff hygiene', 'git', ['diff', '--check']],
  ['Staged diff hygiene', 'git', ['diff', '--cached', '--check']],
  ['Type-safety regression audit', node, ['scripts/type-safety-regression-audit.mjs']],
  ['TypeScript', npm, ['run', 'type-check']],
  ['Dead-code TypeScript audit', npm, ['run', 'type-check:unused']],
  ...(fastLintFiles.length
    ? [['Changed-file lint', node, ['node_modules/eslint/bin/eslint.js', ...fastLintFiles]]]
    : []),
  [
    'Changed tests',
    node,
    ['node_modules/jest/bin/jest.js', '--runInBand', '--onlyChanged', '--passWithNoTests'],
  ],
  ['Visual contracts', node, ['scripts/stack-to-six-visual-audit.mjs']],
];

const fullSteps = [
  ['Unstaged diff hygiene', 'git', ['diff', '--check']],
  ['Staged diff hygiene', 'git', ['diff', '--cached', '--check']],
  ['Type-safety regression audit', node, ['scripts/type-safety-regression-audit.mjs']],
  ['TypeScript', npm, ['run', 'type-check']],
  ['Dead-code TypeScript audit', npm, ['run', 'type-check:unused']],
  ['Source release audit', npm, ['run', 'release:audit']],
  ['Lint', npm, ['run', 'lint']],
  ['Tests', node, ['node_modules/jest/bin/jest.js', '--runInBand']],
  ['Visual contracts', node, ['scripts/stack-to-six-visual-audit.mjs']],
  ['Production build (no native sync)', npm, ['run', 'build'], { env: buildEnv }],
  ['Built bundle audit', npm, ['run', 'release:bundle-audit']],
  ['Native source guard', node, ['scripts/stack-to-six-native-audit.mjs', '--source-only']],
];

const results = [];
for (const [label, command, args, options = {}] of mode === 'full' ? fullSteps : fastSteps) {
  console.log(`\n[QA] ${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  const passed = result.status === 0;
  results.push({ label, passed });
  if (!passed) console.error(`[QA] ${label} failed with exit code ${result.status ?? 'unknown'}`);
}

console.log(`\nStack to Six QA (${mode})`);
for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.label}`);

const failed = results.filter((result) => !result.passed);
if (failed.length) {
  console.error(`\nFAIL: ${failed.length} QA gate${failed.length === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('\nPASS: all selected deterministic QA gates passed.');
