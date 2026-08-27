import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`missing required contract file: ${relativePath}`);
    return '';
  }
  return read(relativePath);
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

function requireOrder(source, needles, label) {
  let previous = -1;
  for (const needle of needles) {
    const index = source.indexOf(needle);
    if (index < 0) {
      failures.push(`${label}: missing ${JSON.stringify(needle)}`);
      return;
    }
    if (index <= previous) {
      failures.push(`${label}: incorrect ownership order at ${JSON.stringify(needle)}`);
      return;
    }
    previous = index;
  }
}

const king = requireFile('docs/engineering/GAMEPLAY_KING_CONTRACT.md');
const bridge = requireFile('docs/engineering/RUNTIME_BRIDGE_CONTRACT.md');
const appStore = requireFile('docs/engineering/APP_STORE_RELEASE_READINESS.md');
const agents = requireFile('AGENTS.md');
const projectContext = requireFile('docs/engineering/PROJECT_CONTEXT.md');
const appCore = requireFile('src/modules/app-core.ts');
const appMerge = requireFile('src/modules/app-merge.ts');
const packageJson = JSON.parse(requireFile('package.json'));
const qaGate = requireFile('scripts/qa-gate.mjs');

requireText(king, 'ULTIMATE BEHAVIORAL AUTHORITY', 'KING contract authority');
requireText(king, 'MUST NOT** optimize, recompress, resize, rename, deduplicate, relocate, delete or replace assets', 'asset preservation');
requireText(king, '`terminal-no-moves` is acquired only at the atomic final commit boundary', 'NO MOVES ownership');
requireText(king, 'The current stuck-path repair is protected compatibility behavior', 'merge-six rescue');
requireText(king, 'No big-bang rewrite', 'legacy strangler protocol');
requireText(bridge, '`window.rebuildBoard`', 'runtime bridge recovery inventory');
requireText(bridge, '`testCleanBoard`', 'runtime bridge no-op inventory');
requireText(appStore, 'Explicit exclusion: asset optimization', 'App Store asset exclusion');
requireText(agents, 'GAMEPLAY_KING_CONTRACT.md', 'agent routing');
requireText(projectContext, 'GAMEPLAY_KING_CONTRACT.md', 'project context routing');

const noMovesStart = appCore.indexOf('async function runNoMovesFailFlow');
const noMovesEnd = appCore.indexOf('\n\nfunction createEmptyGrid', noMovesStart);
const noMovesOwner = appCore.slice(noMovesStart, noMovesEnd);
requireOrder(noMovesOwner, [
  'await waitTrackedResult(waitMs + Math.max(0, extraWaitMs))',
  'const finalCommitBlockReason = getNoMovesCommitBlockReason(initialSignature)',
  "setInputGateLock('terminal-no-moves', true",
  'const postLockBlockReason = getNoMovesCommitBlockReason(initialSignature)',
  'showFinalScreen({ confirmedFailFlow: true })',
], 'NO MOVES atomic commit');

requireText(appCore, "levelEndDecision = { type: 'wait', reason: 'resolver-error', source: 'resolver' }", 'resolver fail-closed');
requireText(appCore, 'Legacy last-merge candidate ignored by central resolver', 'legacy final-merge diagnostics');
requireText(appCore, 'ENDGAME RESCUE: lingering plain merge-6 detected in stuck path', 'merge-six rescue owner');
requireText(appMerge, 'refusing legacy direct endgame fallback', 'central terminal handoff');
if (typeof packageJson.scripts?.['qa:gameplay-lock'] !== 'string') {
  failures.push('package scripts: missing qa:gameplay-lock');
}
requireText(qaGate, "['Gameplay KING contract', npm, ['run', 'qa:gameplay-lock']]", 'full QA gameplay lock');

if (failures.length) {
  console.error('Gameplay KING contract audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: Gameplay KING contract, asset preservation, ownership routing and terminal invariants are intact.');
