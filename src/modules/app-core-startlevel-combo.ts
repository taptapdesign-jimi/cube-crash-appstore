type StartLevelComboDeps = {
  comboIdleTimer: any;
};

export function clearComboIdleTimer({ comboIdleTimer }: StartLevelComboDeps){
  try { 
    if (comboIdleTimer) {
      if (typeof comboIdleTimer.kill === 'function') {
        comboIdleTimer.kill();
      } else if (typeof comboIdleTimer === 'number') {
        clearTimeout(comboIdleTimer);
      }
    }
  } catch {}
}
