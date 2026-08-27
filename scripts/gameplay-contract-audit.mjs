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

function forbidText(source, needle, label) {
  if (source.includes(needle)) failures.push(`${label}: forbidden ${JSON.stringify(needle)}`);
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
const appCoreOwnership = requireFile('docs/engineering/APP_CORE_OWNERSHIP_MAP.md');
const cleanupClosure = requireFile('docs/engineering/POST_KING_CLEANUP_CLOSURE.md');
const agents = requireFile('AGENTS.md');
const projectContext = requireFile('docs/engineering/PROJECT_CONTEXT.md');
const appCore = requireFile('src/modules/app-core.ts');
const appMerge = requireFile('src/modules/app-merge.ts');
const main = requireFile('src/main.ts');
const uiManager = requireFile('src/modules/ui-manager.ts');
const firstPlayTutorial = requireFile('src/modules/first-play-tutorial.ts');
const journeyIncidentRing = requireFile('src/utils/journey-play-again-incident-ring.ts');
const endgameFlow = requireFile('src/modules/endgame-flow.ts');
const mobileSaveLifecycle = requireFile('src/modules/app-core-mobile-save-lifecycle.ts');
const mergeUtils = requireFile('src/modules/merge-utils.ts');
const journeyBoardsManager = requireFile('src/modules/journey-boards-manager.ts');
const runtimeBridgeType = requireFile('src/types/runtime-game-bridge.ts');
const windowTypes = requireFile('src/types/window.d.ts');
const packageJson = JSON.parse(requireFile('package.json'));
const qaGate = requireFile('scripts/qa-gate.mjs');

requireText(king, 'ULTIMATE BEHAVIORAL AUTHORITY', 'KING contract authority');
requireText(king, 'MUST NOT** optimize, recompress, resize, rename, deduplicate, relocate, delete or replace assets', 'asset preservation');
requireText(king, '`terminal-no-moves` is acquired only at the atomic final commit boundary', 'NO MOVES ownership');
requireText(king, 'The current stuck-path repair is protected compatibility behavior', 'merge-six rescue');
requireText(king, 'No big-bang rewrite', 'legacy strangler protocol');
requireText(bridge, '`window.rebuildBoard`', 'runtime bridge recovery inventory');
requireText(bridge, 'Removed no-op surface', 'runtime bridge no-op removal record');
requireText(bridge, 'Typed implementation boundary', 'runtime bridge typing record');
requireText(appStore, 'Explicit exclusion: asset optimization', 'App Store asset exclusion');
requireText(appCoreOwnership, 'Protected orchestration zones', 'app-core protected ownership map');
requireText(appCoreOwnership, '`app-core-mobile-save-lifecycle.ts`', 'mobile save lifecycle ownership map');
requireText(cleanupClosure, 'source hardening packages 1-8', 'post-KING cleanup closure');
requireText(cleanupClosure, 'NEEDS PHYSICAL TEST', 'post-KING physical-test boundary');
requireText(cleanupClosure, 'does not guarantee Apple approval', 'post-KING Apple-review boundary');
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
forbidText(appCore, 'testCleanBoard', 'removed testCleanBoard bridge');
forbidText(appCore, 'testCleanAndPrize', 'removed testCleanAndPrize bridge');
forbidText(appCore, 'scheduleIdleCheck', 'removed empty boot idle-check shim');
forbidText(appMerge, 'function pulseBoardZoom', 'removed unreachable app-merge zoom implementation');
forbidText(appMerge, 'function landPreBounce', 'removed unreachable app-merge pre-bounce implementation');
requireText(mergeUtils, 'export function pulseBoardZoom', 'canonical merge-utils zoom owner');
requireText(mergeUtils, 'export function landPreBounce', 'canonical merge-utils pre-bounce owner');
forbidText(journeyBoardsManager, 'function figmaToPercent', 'removed unreachable Journey Figma converter');
requireText(runtimeBridgeType, 'export interface RuntimeGameBridge', 'typed runtime bridge interface');
requireText(appCore, 'satisfies RuntimeGameBridge', 'typed runtime bridge implementation');
requireText(windowTypes, 'CC?: RuntimeGameBridge', 'typed window.CC declaration');
forbidText(main, 'CC?.STATE', 'removed CC.STATE fallback in main');
forbidText(uiManager, 'CC?.STATE', 'removed CC.STATE fallback in UI manager');
forbidText(journeyIncidentRing, 'CC?.STATE', 'removed CC.STATE fallback in incident ring');
forbidText(appMerge, 'CC?.combo', 'removed CC.combo fallback');
forbidText(firstPlayTutorial, 'CC?.makeBoard', 'removed CC.makeBoard fallback');
requireText(endgameFlow, '(window as any).CC?._endgameFlowRunning', 'protected terminal presentation marker');
requireText(appCore, 'installMobileSaveLifecycle({ saveGameState, trackAppTimeout })', 'mobile save lifecycle install owner');
requireText(appCore, 'cleanupMobileSaveLifecycle({ log: devLog, warn: devWarn })', 'mobile save lifecycle cleanup owner');
requireText(mobileSaveLifecycle, "window.addEventListener('pagehide', saveHandler)", 'mobile pagehide save listener');
requireText(mobileSaveLifecycle, "document.addEventListener('resume', resumeHandler, false)", 'mobile resume listener');
forbidText(appCore, '_saveGameStateRef', 'mobile save listener ownership leaked into app-core');
forbidText(appCore, '_iosVisibilityHandler', 'mobile visibility listener ownership leaked into app-core');
forbidText(appCore, '_saveGameStateResumeRef', 'mobile pause listener ownership leaked into app-core');
forbidText(appCore, '_resumeHandlerRef', 'mobile resume listener ownership leaked into app-core');
if (fs.existsSync(path.join(root, 'src/types/main.ts'))) {
  failures.push('legacy type surface: src/types/main.ts must remain removed');
}
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
