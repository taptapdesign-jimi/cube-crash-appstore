type StartLevelVisibilityDeps = {
  stage?: { visible?: boolean; alpha?: number; renderable?: boolean; addChild?: (c: any) => void } | null;
  board?: { visible?: boolean; alpha?: number; renderable?: boolean; parent?: any } | null;
  hud?: { visible?: boolean; alpha?: number; renderable?: boolean; parent?: any } | null;
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
  devError: (...args: any[]) => void;
};

export function ensureStartLevelVisibility({
  stage,
  board,
  hud,
  devLog,
  devWarn,
  devError,
}: StartLevelVisibilityDeps){
  // 🔥 CRITICAL FIX: Ensure board and hud are visible BEFORE anything else
  // This fixes the issue where board is hidden after cleanup and not restored
  if (stage) {
    stage.visible = true;
    stage.alpha = 1;
    stage.renderable = true;
  }
  if (board) {
    board.visible = true;
    board.alpha = 1;
    board.renderable = true;
    // Ensure board is in stage
    if (!board.parent) {
      devWarn('⚠️ Board not in stage, adding it...');
      if (stage && typeof stage.addChild === 'function') {
        stage.addChild(board);
        devLog('✅ Board added to stage');
      }
    }
    devLog('✅ Board made visible in startLevel - visible:', board.visible, 'alpha:', board.alpha, 'renderable:', board.renderable, 'in stage:', !!board.parent);
  } else {
    devError('❌ Board is null in startLevel!');
  }
  if (hud) {
    hud.visible = true;
    hud.alpha = 1;
    hud.renderable = true;
    // Ensure hud is in stage
    if (!hud.parent) {
      devWarn('⚠️ HUD not in stage, adding it...');
      if (stage && typeof stage.addChild === 'function') {
        stage.addChild(hud);
        devLog('✅ HUD added to stage');
      }
    }
    devLog('✅ HUD made visible in startLevel - visible:', hud.visible, 'alpha:', hud.alpha, 'renderable:', hud.renderable, 'in stage:', !!hud.parent);
  } else {
    devError('❌ HUD is null in startLevel!');
  }
}
