import { preloadKantaMerge6Sounds } from '../kanta-merge6-sound';
jest.mock('../kanta-merge6-sound', () => ({ preloadKantaMerge6Sounds: jest.fn() }));
import { getSpecialSoundWarmupFamilies, preloadEligibleSpecialSounds } from '../special-sound-warmup';
import { preloadFishMerge6Sounds } from '../fish-merge6-sound';
jest.mock('../fish-merge6-sound', () => ({ preloadFishMerge6Sounds: jest.fn() }));
import { preloadBeachBallMerge6Sounds } from '../beach-ball-merge6-sound';
jest.mock('../beach-ball-merge6-sound', () => ({ preloadBeachBallMerge6Sounds: jest.fn() }));
import { preloadCoreTntMerge6Sound } from '../core-tnt-merge6-sound';
jest.mock('../core-tnt-merge6-sound', () => ({ preloadCoreTntMerge6Sound: jest.fn() }));
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
const owners = {preloadKantaMerge6Sounds, preloadFishMerge6Sounds, preloadBeachBallMerge6Sounds, preloadCoreTntMerge6Sound, preloadFlowerMerge6Sounds, preloadBeeMerge6Sounds, preloadRoboCubeMerge6Sounds, preloadBottleFinaleSounds, preloadBottlePullMergeSounds, preloadMagnetPullForceSounds, preloadHoneyMerge6Sounds};

function warmed(boardNumber: number, isArcade = false, tiles: any[] = []): string[] {
  Object.values(owners).forEach(owner => jest.mocked(owner).mockClear());
  preloadEligibleSpecialSounds({ boardNumber, isArcade, tiles });
  return Object.entries(owners).filter(([, owner]) => jest.mocked(owner).mock.calls.length > 0).map(([name]) => name).sort();
}
test('Forest starts with common Star only and progressively warms earned sounds', () => {
  expect(warmed(1)).toEqual([]);
  expect(warmed(2)).toEqual(['preloadBeeMerge6Sounds']);
  expect(warmed(3)).toEqual(['preloadBeeMerge6Sounds', 'preloadFlowerMerge6Sounds']);
  expect(warmed(4)).toEqual(['preloadBeeMerge6Sounds', 'preloadFlowerMerge6Sounds', 'preloadHoneyMerge6Sounds', 'preloadMagnetPullForceSounds']);
  expect(warmed(7)).toContain('preloadCoreTntMerge6Sound');
  expect(warmed(7)).not.toContain('preloadFishMerge6Sounds');
});
test('Area55 uses the cumulative authored pool without unrelated Forest/Beach sounds', () => {
  expect(warmed(21)).toEqual(['preloadKantaMerge6Sounds']);
  expect(warmed(22)).toEqual(['preloadKantaMerge6Sounds', 'preloadRoboCubeMerge6Sounds']);
  expect(warmed(24)).toEqual(['preloadKantaMerge6Sounds', 'preloadMagnetPullForceSounds', 'preloadRoboCubeMerge6Sounds']);
});
test('Beach and Arcade use their actual families and shared magnet foundation', () => {
  expect(warmed(12)).toEqual(['preloadBeachBallMerge6Sounds', 'preloadBottleFinaleSounds', 'preloadBottlePullMergeSounds', 'preloadFishMerge6Sounds', 'preloadMagnetPullForceSounds']);
  expect(warmed(1, true)).toEqual(['preloadBeachBallMerge6Sounds', 'preloadBottleFinaleSounds', 'preloadBottlePullMergeSounds', 'preloadCoreTntMerge6Sound', 'preloadMagnetPullForceSounds']);
  expect(warmed(2, true)).toEqual(['preloadCoreTntMerge6Sound', 'preloadMagnetPullForceSounds']);
});
test('saved live variants and core specials extend eligibility without duplicates or destroyed tiles', () => {
  const tiles = [
    { special: 'wild', _ccSpecialDiceVariant: 'fish' },
    { special: 'wild', _ccSpecialDiceVariant: 'fish' },
    { special: 'wild-tnt' },
    { special: 'wild-tnt', _ccSpecialDiceVariant: 'flower', destroyed: true },
  ];
  expect(warmed(21, false, tiles)).toEqual(['preloadCoreTntMerge6Sound', 'preloadFishMerge6Sounds', 'preloadKantaMerge6Sounds']);
  expect(preloadFishMerge6Sounds).toHaveBeenCalledTimes(1);
  expect(getSpecialSoundWarmupFamilies({ boardNumber: 7, isArcade: false }).has('barell')).toBe(true);
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
  const delays: number[] = [];
  let current = true;
  let latest = true;
  const visibility = { hidden: false };
  const savedTiles = [{ special: 'wild', _ccSpecialDiceVariant: 'fish' }];
  const schedule = new Function('entryGeneration', 'entryBoard', 'isCurrent', 'isGameplayEntryGenerationLatest',
    'boardNumber', 'trackAppTimeout', 'preloadEligibleSpecialSounds', 'isArcadeHomeRunMode', 'tiles',
    'getSpecialArtworkWarmupEligibility', 'preloadFishFinaleBubbles', 'preloadJuiceMerge6Sounds', 'preloadBarrelMerge6Sounds', 'document', body);
  const run = () => schedule(7, 24, () => current, () => latest, 24,
    (callback: () => void, delay: number) => { timers.push(callback); delays.push(delay); }, audio, () => false, savedTiles,
    () => ({ fish: true, juice: true, barrel: true }), media, juice, barrel, visibility);
  run();
  expect(delays).toEqual([600, 1600, 2000, 4200]);
  timers.splice(0).forEach(callback => callback());
  expect(audio).toHaveBeenCalledWith({ boardNumber: 24, isArcade: false, tiles: savedTiles });
  expect(media).toHaveBeenCalledTimes(1);
  expect(juice).toHaveBeenCalledTimes(1);
  expect(barrel).toHaveBeenCalledTimes(1);
  run(); visibility.hidden = true;
  timers.splice(0).forEach(callback => callback());
  visibility.hidden = false;
  run(); current = false;
  timers.splice(0).forEach(callback => callback());
  run(); current = true; latest = false;
  timers.splice(0).forEach(callback => callback());
  expect(audio).toHaveBeenCalledTimes(1);
  expect(media).toHaveBeenCalledTimes(1);
  expect(juice).toHaveBeenCalledTimes(1);
  expect(barrel).toHaveBeenCalledTimes(1);
});
