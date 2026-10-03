import { preloadKantaMerge6Sounds } from '../kanta-merge6-sound';
jest.mock('../kanta-merge6-sound', () => ({ preloadKantaMerge6Sounds: jest.fn() }));
import {
  acquireSpecialSoundWorkingSetPlan,
  getSpecialSoundWarmupFamilies,
  preloadEligibleSpecialSounds,
  resetSpecialSoundWorkingSetForTests,
} from '../special-sound-warmup';
import { preloadFishMerge6Sounds } from '../fish-merge6-sound';
jest.mock('../fish-merge6-sound', () => ({ preloadFishMerge6Sounds: jest.fn() }));
import { preloadBeachBallMerge6Sounds } from '../beach-ball-merge6-sound';
jest.mock('../beach-ball-merge6-sound', () => ({ preloadBeachBallMerge6Sounds: jest.fn() }));
import { preloadCoreTntBonusImpactSounds, preloadCoreTntMerge6Sound } from '../core-tnt-merge6-sound';
jest.mock('../core-tnt-merge6-sound', () => ({ preloadCoreTntMerge6Sound: jest.fn(), preloadCoreTntBonusImpactSounds: jest.fn() }));
import { preloadFlowerMerge6Sounds } from '../flower-merge6-sound';
jest.mock('../flower-merge6-sound', () => ({ preloadFlowerMerge6Sounds: jest.fn() }));
import { preloadBeeMerge6Sounds } from '../bee-merge6-sound';
jest.mock('../bee-merge6-sound', () => ({ preloadBeeMerge6Sounds: jest.fn() }));
import { preloadRoboCubeMerge6Sounds } from '../robo-cube-merge6-sound';
jest.mock('../robo-cube-merge6-sound', () => ({ preloadRoboCubeMerge6Sounds: jest.fn() }));
import { preloadBottleFinaleSounds } from '../bottle-finale-sound';
jest.mock('../bottle-finale-sound', () => ({ preloadBottleFinaleSounds: jest.fn() }));
import { preloadBottlePullMergeSounds } from '../bottle-pull-merge-sound';
jest.mock('../bottle-pull-merge-sound', () => ({ preloadBottlePullMergeSounds: jest.fn() }));
import { preloadMagnetPullForceSounds } from '../magnet-pull-force-sound';
jest.mock('../magnet-pull-force-sound', () => ({ preloadMagnetPullForceSounds: jest.fn() }));
import { preloadHoneyMerge6Sounds } from '../honey-merge6-sound';
jest.mock('../honey-merge6-sound', () => ({ preloadHoneyMerge6Sounds: jest.fn() }));
import { preloadLaserGunMerge6Sounds } from '../laser-gun-merge6-sound';
jest.mock('../laser-gun-merge6-sound', () => ({ preloadLaserGunMerge6Sounds: jest.fn() }));
import { preloadSpaceshipMerge6Sounds } from '../spaceship-merge6-sound';
jest.mock('../spaceship-merge6-sound', () => ({ preloadSpaceshipMerge6Sounds: jest.fn() }));
import { preloadBarrelMerge6Sounds } from '../barrel-merge6-sound';
jest.mock('../barrel-merge6-sound', () => ({ preloadBarrelMerge6Sounds: jest.fn() }));
import { preloadJuiceMerge6Sounds } from '../juice-finale-sound';
jest.mock('../juice-finale-sound', () => ({ preloadJuiceMerge6Sounds: jest.fn() }));
import { preloadWildStarMerge6Sound } from '../wild-star-merge6-sound';
jest.mock('../wild-star-merge6-sound', () => ({ preloadWildStarMerge6Sound: jest.fn() }));
import { SPECIAL_DICE_VARIANTS } from '../special-dice-registry';
const owners = {preloadKantaMerge6Sounds, preloadFishMerge6Sounds, preloadBeachBallMerge6Sounds, preloadCoreTntMerge6Sound, preloadCoreTntBonusImpactSounds, preloadFlowerMerge6Sounds, preloadBeeMerge6Sounds, preloadRoboCubeMerge6Sounds, preloadBottleFinaleSounds, preloadBottlePullMergeSounds, preloadMagnetPullForceSounds, preloadHoneyMerge6Sounds, preloadLaserGunMerge6Sounds, preloadSpaceshipMerge6Sounds, preloadBarrelMerge6Sounds, preloadJuiceMerge6Sounds, preloadWildStarMerge6Sound};

function warmed(boardNumber: number, isArcade = false, tiles: any[] = []): string[] {
  Object.values(owners).forEach(owner => jest.mocked(owner).mockClear());
  preloadEligibleSpecialSounds({ boardNumber, isArcade, tiles });
  return Object.entries(owners).filter(([, owner]) => jest.mocked(owner).mock.calls.length > 0).map(([name]) => name).sort();
}

function prepared(boardNumber: number, isArcade = false, tile: any): string[] {
  Object.values(owners).forEach(owner => jest.mocked(owner).mockClear());
  const plan = acquireSpecialSoundWorkingSetPlan({ boardNumber, isArcade, tiles: [tile] });
  plan.prepareCommittedTransaction(tile);
  return Object.entries(owners).filter(([, owner]) => jest.mocked(owner).mock.calls.length > 0).map(([name]) => name).sort();
}

afterEach(() => resetSpecialSoundWorkingSetForTests());
test('entry does not decode possible rewards before a special exists', () => {
  expect(warmed(1)).toEqual([]);
  expect(warmed(7)).toEqual([]);
  expect(warmed(24)).toEqual([]);
  expect(warmed(12)).toEqual([]);
  expect(warmed(1, true)).toEqual([]);
});

test.each([false, true])('a committed core Star transaction warms its package once in Arcade=%s', isArcade => {
  const tile = { special: 'wild' };
  const plan = acquireSpecialSoundWorkingSetPlan({ boardNumber: 7, isArcade, tiles: [tile, tile] });
  expect(plan.prepareCommittedTransaction(tile)).toBe(true);
  expect(plan.prepareCommittedTransaction(tile)).toBe(true);
  expect(preloadWildStarMerge6Sound).toHaveBeenCalledTimes(1);
  expect(plan.prepareCommittedTransaction({ special: 'wild', destroyed: true })).toBe(false);
});

test('entry keeps ordinary cues ready and leaves Star preparation with the committed-special owner', () => {
  const fs = require('node:fs');
  for (const file of ['src/modules/ui-manager.ts', 'src/modules/journey-boards-manager.ts']) {
    const source: string = fs.readFileSync(file, 'utf8');
    expect(source).not.toContain('preloadWildStarMerge6Sound');
    expect(source).toContain('preloadRegularMerge6Sounds();');
    expect(source).toContain('preloadWildSpecialMerge6PoofSounds();');
  }
  const appCore: string = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  expect(appCore).toContain("withGameplayAudioDiagnosticCaller('drop-special', refreshSpecialSoundWorkingSetPlan);");
  expect(appCore).toContain("withGameplayAudioDiagnosticCaller('committed-special-transaction'");
});

test('app integration replaces, refreshes, prepares and releases the plan at committed lifecycle boundaries', () => {
  const fs = require('node:fs');
  const source: string = fs.readFileSync('src/modules/app-core.ts', 'utf8');

  const startLevel = source.slice(
    source.indexOf('async function startLevel(n)'),
    source.indexOf('// --- local Wild skin fallback'),
  );
  const entryGeneration = startLevel.indexOf('beginGameplayEntryPreparation(`startLevel:${n}`)');
  const previousPlanRelease = startLevel.indexOf('specialSoundWorkingSetPlan?.release();', entryGeneration);
  const firstAsyncBoundary = startLevel.indexOf("await ensureCoreRenderTexturesGpuReady('startLevel'");
  expect(entryGeneration).toBeGreaterThanOrEqual(0);
  expect(previousPlanRelease).toBeGreaterThan(entryGeneration);
  expect(firstAsyncBoundary).toBeGreaterThan(previousPlanRelease);
  expect(startLevel.indexOf('maybeRebuildBoard({')).toBeGreaterThanOrEqual(0);
  expect(startLevel.indexOf('replaceSpecialSoundWorkingSetPlan();')).toBeGreaterThan(
    startLevel.indexOf('maybeRebuildBoard({'),
  );

  const savedLoad = source.slice(
    source.indexOf('async function loadGameState('),
    source.indexOf('// 🔥 CRITICAL: Function to stop PIXI ticker'),
  );
  const rulesCommitted = savedLoad.indexOf('applyRulesAfterLoad({');
  const currentLoadGuard = savedLoad.indexOf("if (!isCurrentLoad()) return 'superseded' as const;", rulesCommitted);
  const restoredRefresh = savedLoad.indexOf('refreshSpecialSoundWorkingSetPlan();', rulesCommitted);
  expect(rulesCommitted).toBeGreaterThanOrEqual(0);
  expect(currentLoadGuard).toBeGreaterThan(rulesCommitted);
  expect(restoredRefresh).toBeGreaterThan(currentLoadGuard);

  const spawn = source.slice(
    source.indexOf('const ok = await openAtCell(cell.c, cell.r, {'),
    source.indexOf('consumeCharge();', source.indexOf('const ok = await openAtCell(cell.c, cell.r, {')),
  );
  expect(spawn.indexOf('applySpecialDiceVariantToTile(spawnedTile, specialDiceVariant);')).toBeGreaterThanOrEqual(0);
  expect(spawn.indexOf("withGameplayAudioDiagnosticCaller('drop-special', refreshSpecialSoundWorkingSetPlan);")).toBeGreaterThan(
    spawn.indexOf('applySpecialDiceVariantToTile(spawnedTile, specialDiceVariant);'),
  );

  const transaction = source.slice(
    source.indexOf('specialTransactionToken = beginSpecialDiceTransaction'),
    source.indexOf('if (srcIsMagnetLike) markSpecialDiceResolutionOwned(src);'),
  );
  expect(transaction.indexOf('if (specialTransactionToken === null)')).toBeGreaterThanOrEqual(0);
  expect(transaction.indexOf('specialSoundWorkingSetPlan?.prepareCommittedTransaction(committedSpecialTile);')).toBeGreaterThan(
    transaction.indexOf('if (specialTransactionToken === null)'),
  );

  const cleanup = source.slice(
    source.indexOf('export function cleanupGame('),
    source.indexOf('// 🔥 CRITICAL FIX: Stop PIXI ticker FIRST', source.indexOf('export function cleanupGame(')),
  );
  expect(cleanup).toContain('specialSoundWorkingSetPlan?.release();');
  expect(cleanup).toContain('specialSoundWorkingSetPlan = null;');
});
test('saved live variants and core specials extend eligibility without duplicates or destroyed tiles', () => {
  const tiles = [
    { special: 'wild', _ccSpecialDiceVariant: 'fish' },
    { special: 'wild', _ccSpecialDiceVariant: 'fish' },
    { special: 'wild-tnt' },
    { special: 'wild-tnt', _ccSpecialDiceVariant: 'flower', destroyed: true },
  ];
  expect(warmed(21, false, tiles)).toEqual([]);
  expect(getSpecialSoundWarmupFamilies({ boardNumber: 21, isArcade: false, tiles })).toEqual(
    new Set(['fish', 'tnt']),
  );
  expect(getSpecialSoundWarmupFamilies({ boardNumber: 7, isArcade: false }).size).toBe(0);
});

test('a committed transaction warms only its exact package and gameplay foundation', () => {
  expect(prepared(1, true, { special: 'wild-magnet', _ccSpecialDiceVariant: 'bottle' })).toEqual([
    'preloadBottleFinaleSounds', 'preloadBottlePullMergeSounds', 'preloadMagnetPullForceSounds',
  ]);
  expect(prepared(7, false, { special: 'wild-tnt', _ccSpecialDiceVariant: 'barell' })).toEqual([
    'preloadBarrelMerge6Sounds', 'preloadCoreTntBonusImpactSounds',
  ]);
  expect(prepared(12, false, { special: 'wild-juice' })).toEqual(['preloadJuiceMerge6Sounds']);
});

const variantOwners: Record<string, string[]> = {
  fish: ['preloadFishMerge6Sounds'],
  kanta: ['preloadKantaMerge6Sounds'],
  bee: ['preloadBeeMerge6Sounds'],
  'laser-gun': ['preloadCoreTntBonusImpactSounds', 'preloadLaserGunMerge6Sounds'],
  spaceship: ['preloadMagnetPullForceSounds', 'preloadSpaceshipMerge6Sounds'],
  bottle: ['preloadBottleFinaleSounds', 'preloadBottlePullMergeSounds', 'preloadMagnetPullForceSounds'],
  honey: ['preloadHoneyMerge6Sounds', 'preloadMagnetPullForceSounds'],
  flower: ['preloadCoreTntBonusImpactSounds', 'preloadFlowerMerge6Sounds'],
  barell: ['preloadBarrelMerge6Sounds', 'preloadCoreTntBonusImpactSounds'],
  mushroom: [],
  'robo-cube': ['preloadRoboCubeMerge6Sounds'],
  cubero: [],
  'beach-ball': ['preloadBeachBallMerge6Sounds', 'preloadCoreTntBonusImpactSounds'],
};

test('every registered authored variant has a reviewed sound-preparation owner', () => {
  expect(Object.keys(variantOwners).sort()).toEqual(Object.keys(SPECIAL_DICE_VARIANTS).sort());
});

test.each(Object.entries(variantOwners))('%s transaction warms its authored sounds and only the gameplay tails it actually plays', (id, expected) => {
  expect(prepared(12, false, { special: SPECIAL_DICE_VARIANTS[id].archetype, _ccSpecialDiceVariant: id })).toEqual(expected);
});

test('cumulative Area 55 entry and spawn refresh never decode five complete finale families', () => {
  const tiles = [
    { special: 'wild' },
    { special: 'wild', _ccSpecialDiceVariant: 'robo-cube' },
    { special: 'wild-tnt', _ccSpecialDiceVariant: 'laser-gun' },
    { special: 'wild-magnet', _ccSpecialDiceVariant: 'spaceship' },
    { special: 'wild', _ccSpecialDiceVariant: 'kanta' },
  ];
  const plan = acquireSpecialSoundWorkingSetPlan({ boardNumber: 28, isArcade: false, tiles });
  expect([...plan.getFamilies()].sort()).toEqual([
    'kanta', 'laser-gun', 'robo-cube', 'spaceship', 'tnt-bonus', 'wild-star',
  ]);
  expect(plan.refresh({ boardNumber: 28, isArcade: false, tiles })).toBe(true);
  expect(plan.refresh({ boardNumber: 28, isArcade: false, tiles: [...tiles, tiles[4]] })).toBe(true);
  expect(Object.values(owners).every(owner => jest.mocked(owner).mock.calls.length === 0)).toBe(true);

  expect(plan.prepareCommittedTransaction(tiles[2])).toBe(true);
  expect(plan.prepareCommittedTransaction(tiles[2])).toBe(true);
  expect(preloadLaserGunMerge6Sounds).toHaveBeenCalledTimes(1);
  expect(preloadCoreTntBonusImpactSounds).toHaveBeenCalledTimes(1);
  expect(preloadRoboCubeMerge6Sounds).not.toHaveBeenCalled();
  expect(preloadSpaceshipMerge6Sounds).not.toHaveBeenCalled();
  expect(preloadKantaMerge6Sounds).not.toHaveBeenCalled();
  expect(preloadWildStarMerge6Sound).not.toHaveBeenCalled();
});

test('replacement and release invalidate stale board audio plans', () => {
  const laser = { special: 'wild-tnt', _ccSpecialDiceVariant: 'laser-gun' };
  const first = acquireSpecialSoundWorkingSetPlan({ boardNumber: 22, isArcade: false, tiles: [laser] });
  const second = acquireSpecialSoundWorkingSetPlan({ boardNumber: 23, isArcade: false, tiles: [] });
  expect(first.prepareCommittedTransaction(laser)).toBe(false);
  expect(first.refresh({ boardNumber: 22, isArcade: false, tiles: [laser] })).toBe(false);
  second.release();
  second.release();
  expect(second.prepareCommittedTransaction(laser)).toBe(false);
  expect(preloadLaserGunMerge6Sounds).not.toHaveBeenCalled();
});

test.each([undefined, 'bottle', 'spaceship', 'honey'])('the actual Magnet pull caller only warms Honey for captured variant %s', (id) => {
  const fs = require('node:fs');
  const source: string = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  const preparation = source.split('if (nearestTiles.length > 0) {')[1].split('// Store original positions')[0];
  const magnet = jest.fn();
  const honey = jest.fn();
  new Function('magnetVariantAtMergeEntry', 'preloadMagnetPullForceSounds', 'preloadHoneyMerge6Sounds', 'withGameplayAudioDiagnosticCaller', preparation)(
    id ? { id } : null, magnet, honey, (_label: string, action: () => void) => action(),
  );
  expect(magnet).toHaveBeenCalledTimes(1);
  expect(honey).toHaveBeenCalledTimes(id === 'honey' ? 1 : 0);
});

test('fresh and restored entry share delayed generation-owned audio/media preparation', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source: string = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
  expect(source).toContain('scheduleEntrySpecialWarmups(gameplayEntryGeneration, entryBoardNumber);');
  expect(source).toContain('scheduleEntrySpecialWarmups(loadedEntryGeneration, boardNumber, isCurrentLoad);');
  const body = source.split('function scheduleEntrySpecialWarmups(')[1].split('): void {')[1].split('\n}\n')[0];
  const timers: Array<() => void> = [];
  const audio = jest.fn();
  const media = jest.fn();
  const juice = jest.fn();
  const barrel = jest.fn();
  const juiceTextures = jest.fn();
  const delays: number[] = [];
  let current = true;
  let latest = true;
  const visibility = { hidden: false };
  const savedTiles = [{ special: 'wild', _ccSpecialDiceVariant: 'fish' }];
  const schedule = new Function('entryGeneration', 'entryBoard', 'isCurrent', 'isGameplayEntryGenerationLatest',
    'boardNumber', 'trackAppTimeout', 'refreshSpecialSoundWorkingSetPlan', 'isArcadeHomeRunMode', 'tiles',
    'getSpecialArtworkWarmupEligibility', 'preloadFishFinaleBubbles', 'preloadJuiceMerge6Sounds', 'preloadBarrelMerge6Sounds', 'preloadLiveJuiceFinaleTextures', 'document', 'withGameplayAudioDiagnosticCaller', body);
  const run = () => schedule(7, 24, () => current, () => latest, 24,
    (callback: () => void, delay: number) => { timers.push(callback); delays.push(delay); }, audio, () => false, savedTiles,
    () => ({ fish: true, juice: true, barrel: true }), media, juice, barrel, juiceTextures, visibility, (_label: string, action: () => void) => action());
  run();
  expect(delays).toEqual([600, 1600]);
  timers.splice(0).forEach(callback => callback());
  expect(audio).toHaveBeenCalledWith();
  expect(media).toHaveBeenCalledTimes(1);
  expect(juiceTextures).toHaveBeenCalledWith(savedTiles, expect.any(Function));
  expect(juice).not.toHaveBeenCalled();
  expect(barrel).not.toHaveBeenCalled();
  run(); visibility.hidden = true;
  timers.splice(0).forEach(callback => callback());
  visibility.hidden = false;
  run(); current = false;
  timers.splice(0).forEach(callback => callback());
  run(); current = true; latest = false;
  timers.splice(0).forEach(callback => callback());
  expect(audio).toHaveBeenCalledTimes(1);
  expect(media).toHaveBeenCalledTimes(1);
  expect(juiceTextures).toHaveBeenCalledTimes(1);
  expect(juiceTextures.mock.calls[0][1]()).toBe(false);
  expect(juice).not.toHaveBeenCalled();
  expect(barrel).not.toHaveBeenCalled();
});
