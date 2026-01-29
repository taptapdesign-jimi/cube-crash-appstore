type StartHudExitDeps = {
  HUD: { playHudRise?: (opts?: any) => void };
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function startHudExitAnimation({ HUD, devLog, devWarn }: StartHudExitDeps){
  // 🔥 CRITICAL: Start HUD exit animation IMMEDIATELY (same time as board exit)
  // This ensures both animations start simultaneously
  devLog('🎯 Starting HUD exit animation simultaneously with board exit');
  try { 
    HUD.playHudRise?.({}); 
    devLog('✅ HUD exit animation started');
  } catch (e) {
    devWarn('⚠️ Failed to call HUD.playHudRise:', e);
  }
}
