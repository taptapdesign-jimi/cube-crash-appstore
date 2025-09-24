// public/src/modules/audio.js
// Jednostavan audio loader i reproduktor za SFX.

export function makeAudio() {
  const SFX = {};

  // učitaj zvuk (kljuc, putanja, početna glasnoća)
  const load = (key, url, vol=0.9) => {
    try {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = vol;
      SFX[key] = a;
    } catch {
      SFX[key] = null;
    }
  };

  // jednom otključaj reprodukciju dodirima
  let unlocked = false;
  const unlockOnce = () => {
    if (unlocked) return;
    unlocked = true;
    Object.values(SFX).forEach(a => {
      try {
        if (a) {
          a.muted = false;
          a.play().then(() => a.pause()).catch(() => {});
        }
      } catch {}
    });
    window.removeEventListener('pointerdown', unlockOnce, true);
    window.removeEventListener('touchstart', unlockOnce, true);
  };
  window.addEventListener('pointerdown', unlockOnce, true);
  window.addEventListener('touchstart', unlockOnce, true);

  // pusti zvuk
  const play = (key, vol=null) => {
    const a = SFX[key];
    if (!a) return;
    try {
      if (vol != null) a.volume = vol;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };

  return { SFX, load, play };
}