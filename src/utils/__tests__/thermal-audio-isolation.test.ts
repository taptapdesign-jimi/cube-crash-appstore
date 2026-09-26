import {
  getThermalAudioIsolationStats, isThermalAudioIsolationAvailable, isThermalAudioSuppressed,
  recordThermalAudioIsolationBlock, resetThermalAudioIsolationForTests,
  setThermalAudioSuppressed, subscribeThermalAudioIsolation,
} from '../thermal-audio-isolation';
import fs from 'node:fs';
import path from 'node:path';

afterEach(() => {
  resetThermalAudioIsolationForTests();
  delete (window as any).__ccThermalIsolation;
  delete (window as any).__ccThermalAudioIsolationAvailable;
  delete (window as any).__ccThermalAudioSuppressedOnLaunch;
});

test('normal launch cannot enable isolation and does not collect blocked-work counters', () => {
  expect(isThermalAudioIsolationAvailable()).toBe(false);
  expect(setThermalAudioSuppressed(true)).toBe(false);
  recordThermalAudioIsolationBlock('sfx-play');
  expect(getThermalAudioIsolationStats()).toEqual({ isolationEnabled: false, suppressed: {} });
});

test('diagnostic switch is idempotent, survives gameplay input and supports late owners without auto-restart', () => {
  (window as any).__ccThermalIsolation = true;
  const owner = jest.fn();
  const release = subscribeThermalAudioIsolation(owner);
  setThermalAudioSuppressed(true);
  setThermalAudioSuppressed(true);
  window.dispatchEvent(new Event('pointerdown'));
  window.dispatchEvent(new Event('touchstart'));
  expect(isThermalAudioSuppressed()).toBe(true);
  expect(owner).toHaveBeenCalledTimes(1);
  const late = jest.fn();
  const releaseLate = subscribeThermalAudioIsolation(late);
  expect(late).toHaveBeenCalledWith(true);
  recordThermalAudioIsolationBlock('sfx-play');
  expect(getThermalAudioIsolationStats().suppressed).toEqual({ 'sfx-play': 1 });
  setThermalAudioSuppressed(false);
  expect(owner.mock.calls).toEqual([[true], [false]]);
  release(); releaseLate();
});

test('passive native launch enables audio isolation without exposing the visual isolation panel flag', () => {
  (window as any).__ccThermalAudioIsolationAvailable = true;
  expect(isThermalAudioIsolationAvailable()).toBe(true);
  expect((window as any).__ccThermalIsolation).toBeUndefined();
  expect(setThermalAudioSuppressed(true)).toBe(true);
  expect(isThermalAudioSuppressed()).toBe(true);
});

test('passive native launch starts suppressed before any audio owner subscribes', () => {
  jest.resetModules();
  (window as any).__ccThermalAudioIsolationAvailable = true;
  (window as any).__ccThermalAudioSuppressedOnLaunch = true;
  jest.isolateModules(() => {
    const isolated = jest.requireActual('../thermal-audio-isolation') as typeof import('../thermal-audio-isolation');
    expect(isolated.isThermalAudioIsolationAvailable()).toBe(true);
    expect(isolated.isThermalAudioSuppressed()).toBe(true);
    const owner = jest.fn();
    isolated.subscribeThermalAudioIsolation(owner);
    expect(owner).toHaveBeenCalledWith(true);
    isolated.resetThermalAudioIsolationForTests();
  });
});

test('does not retain the unread legacy explode media preload or its global cache', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/asset-preloader.ts'), 'utf8');
  const windowTypes = fs.readFileSync(path.resolve(process.cwd(), 'src/types/window.d.ts'), 'utf8');
  expect(source).not.toContain('loadAudioFiles');
  expect(source).not.toContain('window.gameAudio');
  expect(source).not.toContain("'./assets/sound/sfx/explode.mp3'");
  expect(windowTypes).not.toContain('gameAudio?:');
});
