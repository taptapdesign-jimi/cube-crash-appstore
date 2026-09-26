import { Assets } from 'pixi.js';
import { preloadWildSpawnDropAssets } from '../wild-spawn-drop';
import { preloadArcadeCrateSounds } from '../arcade-crate-sound';
import { preloadJourneyBackpackSounds } from '../journey-backpack-sound';
import { isArcadeHomeRunMode } from '../run-mode';

jest.mock('pixi.js', () => ({ Assets: { load: jest.fn() }, Sprite: jest.fn(), Texture: {} }));
jest.mock('../animation-manager', () => ({ __esModule: true, default: {} }));
jest.mock('../wild-spawn-carrier-foreground', () => ({}));
jest.mock('../run-mode', () => ({ isArcadeHomeRunMode: jest.fn() }));
jest.mock('../arcade-crate-sound', () => ({ preloadArcadeCrateSounds: jest.fn() }));
jest.mock('../journey-backpack-sound', () => ({ preloadJourneyBackpackSounds: jest.fn() }));

test('the real cached spawn preparer selects current-route audio on cold entry, retries and mode changes', async () => {
  jest.mocked(Assets.load).mockResolvedValue({});
  jest.mocked(isArcadeHomeRunMode).mockReturnValue(false);
  const first = preloadWildSpawnDropAssets();
  await first;
  expect(preloadJourneyBackpackSounds).toHaveBeenCalledTimes(1);
  expect(preloadArcadeCrateSounds).not.toHaveBeenCalled();
  expect(Assets.load).toHaveBeenCalledTimes(1);

  // A retry/drop must recheck the eligible audio owner after OS cache pressure,
  // even though the visual assets promise remains ready.
  for (let retry = 0; retry < 4; retry++) expect(preloadWildSpawnDropAssets()).toBe(first);
  expect(preloadJourneyBackpackSounds).toHaveBeenCalledTimes(5);
  expect(preloadArcadeCrateSounds).not.toHaveBeenCalled();

  jest.mocked(isArcadeHomeRunMode).mockReturnValue(true);
  await preloadWildSpawnDropAssets();
  expect(preloadArcadeCrateSounds).toHaveBeenCalledTimes(1);
  expect(preloadJourneyBackpackSounds).toHaveBeenCalledTimes(5);
  jest.mocked(isArcadeHomeRunMode).mockReturnValue(false);
  await preloadWildSpawnDropAssets();
  expect(preloadJourneyBackpackSounds).toHaveBeenCalledTimes(6);
  expect(preloadArcadeCrateSounds).toHaveBeenCalledTimes(1);
  expect(Assets.load).toHaveBeenCalledTimes(1);
});
