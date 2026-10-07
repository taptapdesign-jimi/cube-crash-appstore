import { applyGameSoundsSettingToAudio } from './gameplay-sound-settings.js';

export type SettingsPreference = 'gameSoundsEnabled' | 'musicEnabled' | 'hapticsEnabled';
export interface SettingsPreferencesSnapshot {
  gameSoundsEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}
type SettingsHost = {
  _settings?: Record<string, unknown>;
  saveSettings?: (settings: Record<string, unknown>) => void;
  triggerHapticImpact?: (kind: string) => void;
};

/** Presentation adapter over the existing settings object and save owner. */
export function readSettingsPreferences(host: SettingsHost = window as SettingsHost): SettingsPreferencesSnapshot {
  return {
    gameSoundsEnabled: host._settings?.gameSoundsEnabled === true,
    musicEnabled: host._settings?.musicEnabled !== false,
    hapticsEnabled: host._settings?.hapticsEnabled !== false,
  };
}

export function applySettingsPreference(key: SettingsPreference, enabled: boolean,
  host: SettingsHost = window as SettingsHost): boolean {
  if (!host._settings || typeof host.saveSettings !== 'function') return false;
  // Preserve vibration OFF's final pulse and ON's first pulse order.
  if (key !== 'hapticsEnabled' || !enabled) host.triggerHapticImpact?.('light');
  const previous = host._settings[key];
  host._settings[key] = enabled;
  try { host.saveSettings(host._settings); } catch {
    if (previous === undefined) delete host._settings[key]; else host._settings[key] = previous;
    return false;
  }
  if (key === 'hapticsEnabled' && enabled) host.triggerHapticImpact?.('light');
  if (key === 'gameSoundsEnabled') void applyGameSoundsSettingToAudio(enabled);
  if (key === 'musicEnabled') {
    void import('./soundtrack-manager.js').then(owner => {
      // A delayed import cannot undo a newer toggle.
      if (host._settings?.musicEnabled !== enabled) return;
      if (enabled) owner.fadeInAndResume(); else owner.stopSoundtrack();
    }).catch(() => {});
  }
  return true;
}
