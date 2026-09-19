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
import { preloadLaserGunMerge6Sounds } from '../laser-gun-merge6-sound';
jest.mock('../laser-gun-merge6-sound', () => ({ preloadLaserGunMerge6Sounds: jest.fn() }));
import { preloadSpaceshipMerge6Sounds } from '../spaceship-merge6-sound';
jest.mock('../spaceship-merge6-sound', () => ({ preloadSpaceshipMerge6Sounds: jest.fn() }));
import { preloadBarrelMerge6Sounds } from '../barrel-merge6-sound';
jest.mock('../barrel-merge6-sound', () => ({ preloadBarrelMerge6Sounds: jest.fn() }));
import { preloadJuiceMerge6Sounds } from '../juice-finale-sound';
jest.mock('../juice-finale-sound', () => ({ preloadJuiceMerge6Sounds: jest.fn() }));
const owners = {preloadKantaMerge6Sounds, preloadFishMerge6Sounds, preloadBeachBallMerge6Sounds, preloadCoreTntMerge6Sound, preloadFlowerMerge6Sounds, preloadBeeMerge6Sounds, preloadRoboCubeMerge6Sounds, preloadBottleFinaleSounds, preloadBottlePullMergeSounds, preloadMagnetPullForceSounds, preloadHoneyMerge6Sounds, preloadLaserGunMerge6Sounds, preloadSpaceshipMerge6Sounds, preloadBarrelMerge6Sounds, preloadJuiceMerge6Sounds};

function warmed(boardNumber: number, isArcade = false, tiles: any[] = []): string[] {
  Object.values(owners).forEach(owner => jest.mocked(owner).mockClear());
  preloadEligibleSpecialSounds({ boardNumber, isArcade, tiles });
  return Object.entries(owners).filter(([, owner]) => jest.mocked(owner).mock.calls.length > 0).map(([name]) => name).sort();
}
test('entry does not decode possible rewards before a special exists', () => {
  expect(warmed(1)).toEqual([]);
  expect(warmed(7)).toEqual([]);
  expect(warmed(24)).toEqual([]);
  expect(warmed(12)).toEqual([]);
  expect(warmed(1, true)).toEqual([]);
});
test('saved live variants and core specials extend eligibility without duplicates or destroyed tiles', () => {
  const tiles = [
    { special: 'wild', _ccSpecialDiceVariant: 'fish' },
    { special: 'wild', _ccSpecialDiceVariant: 'fish' },
    { special: 'wild-tnt' },
    { special: 'wild-tnt', _ccSpecialDiceVariant: 'flower', destroyed: true },
  ];
  expect(warmed(21, false, tiles)).toEqual(['preloadCoreTntMerge6Sound', 'preloadFishMerge6Sounds']);
  expect(preloadFishMerge6Sounds).toHaveBeenCalledTimes(1);
  expect(getSpecialSoundWarmupFamilies({ boardNumber: 7, isArcade: false }).size).toBe(0);
});

test('a committed die warms only its exact package and gameplay foundation', () => {
  expect(warmed(1, true, [{ special: 'wild-magnet', _ccSpecialDiceVariant: 'bottle' }])).toEqual([
    'preloadBottleFinaleSounds', 'preloadBottlePullMergeSounds', 'preloadMagnetPullForceSounds',
  ]);
  expect(warmed(7, false, [{ special: 'wild-tnt', _ccSpecialDiceVariant: 'barell' }])).toEqual([
    'preloadBarrelMerge6Sounds', 'preloadCoreTntMerge6Sound',
  ]);
  expect(warmed(12, false, [{ special: 'wild-juice' }])).toEqual(['preloadJuiceMerge6Sounds']);
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
  expect(delays).toEqual([600, 1600]);
  timers.splice(0).forEach(callback => callback());
  expect(audio).toHaveBeenCalledWith({ boardNumber: 24, isArcade: false, tiles: savedTiles });
  expect(media).toHaveBeenCalledTimes(1);
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
  expect(juice).not.toHaveBeenCalled();
  expect(barrel).not.toHaveBeenCalled();
});
