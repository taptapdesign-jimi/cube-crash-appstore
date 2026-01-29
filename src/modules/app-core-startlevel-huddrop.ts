type StartLevelHudDropDeps = {
  HUD: { HUD_ROOT?: any };
  gsap: { killTweensOf: (target: any) => void };
  logger: { debug: (...args: any[]) => void };
  getHudRootFromWindow: () => any;
  isTriggerHudDrop: () => boolean;
  clearTriggerHudDrop: () => void;
  setHudDropPending: (v: boolean) => void;
  setHudInitDone: (v: boolean) => void;
};

export function handleStartLevelHudDrop({
  HUD,
  gsap,
  logger,
  getHudRootFromWindow,
  isTriggerHudDrop,
  clearTriggerHudDrop,
  setHudDropPending,
  setHudInitDone,
}: StartLevelHudDropDeps){
  // 🔥 JOURNEY PROGRESSION: Check if HUD drop should be triggered (from Journey Play Board)
  if (!isTriggerHudDrop()) return;
  setHudDropPending(true);
  logger.debug('✅ HUD drop pending set to true (from Journey Play Board)', 'app-core');
  clearTriggerHudDrop();
  setHudInitDone(false);
  try {
    const hudRoot = getHudRootFromWindow() ?? HUD.HUD_ROOT ?? null;
    if (hudRoot && !(hudRoot as { destroyed?: boolean }).destroyed) {
      const top = hudRoot._dropTop ?? 44;
      try { gsap.killTweensOf(hudRoot); } catch {}
      hudRoot._dropped = false;
      hudRoot.alpha = 0;
      hudRoot.y = top - 140;
      hudRoot.visible = true;
    }
  } catch {}
}
