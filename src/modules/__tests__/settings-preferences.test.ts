import { applySettingsPreference, readSettingsPreferences } from '../settings-preferences.js';
import { applyGameSoundsSettingToAudio } from '../gameplay-sound-settings.js';
jest.mock('../gameplay-sound-settings.js', () => ({ applyGameSoundsSettingToAudio: jest.fn(() => Promise.resolve()) }));
jest.mock('../soundtrack-manager.js', () => ({ fadeInAndResume: jest.fn(), stopSoundtrack: jest.fn() }));

test('projects canonical defaults without creating or saving settings', () => {
  const host = { saveSettings: jest.fn() };
  expect(readSettingsPreferences(host)).toEqual({ gameSoundsEnabled: false, musicEnabled: true, hapticsEnabled: true });
  expect(host.saveSettings).not.toHaveBeenCalled();
  expect(applySettingsPreference('musicEnabled', false, host)).toBe(false);
});

test('native Sounds toggles use the same save object and invalidate every OFF sweep', () => {
  const state = { gameSoundsEnabled: true, other: 'preserved' };
  const host = { _settings: state, saveSettings: jest.fn() };
  applySettingsPreference('gameSoundsEnabled', false, host);
  expect(host.saveSettings).toHaveBeenLastCalledWith(state);
  expect(applyGameSoundsSettingToAudio).toHaveBeenLastCalledWith(false);
  applySettingsPreference('gameSoundsEnabled', true, host);
  expect(applyGameSoundsSettingToAudio).toHaveBeenLastCalledWith(true);
  expect(state.other).toBe('preserved');
});

test.each([true, false])('vibration=%s retains canonical haptic/save ordering', enabled => {
  const order: string[] = [];
  const host = { _settings: { hapticsEnabled: !enabled },
    saveSettings: () => { order.push(`save:${host._settings.hapticsEnabled}`); },
    triggerHapticImpact: () => { order.push(`pulse:${host._settings.hapticsEnabled}`); } };
  applySettingsPreference('hapticsEnabled', enabled, host);
  expect(order).toEqual(enabled ? ['save:true', 'pulse:true'] : ['pulse:true', 'save:false']);
});

test('delayed Music import cannot apply an obsolete ON after OFF', async () => {
  const music = await import('../soundtrack-manager.js');
  jest.clearAllMocks();
  const host = { _settings: { musicEnabled: true }, saveSettings: jest.fn() };
  applySettingsPreference('musicEnabled', true, host);
  applySettingsPreference('musicEnabled', false, host);
  await Promise.resolve(); await Promise.resolve();
  expect(music.fadeInAndResume).not.toHaveBeenCalled();
  expect(music.stopSoundtrack).toHaveBeenCalledTimes(1);
});


test('failed persistence rejects the native update and restores the canonical value', () => {
  const host = {_settings: {musicEnabled: true, unrelated: 'keep'}, saveSettings: () => { throw new Error('storage unavailable'); }};
  expect(applySettingsPreference('musicEnabled', false, host)).toBe(false);
  expect(host._settings).toEqual({musicEnabled: true, unrelated: 'keep'});
});
