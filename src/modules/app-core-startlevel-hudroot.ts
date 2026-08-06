import { isGameplayHudRevealAllowed } from './gameplay-hud-visibility-policy.ts';

type StartLevelHudRootDeps = {
  HUD: { HUD_ROOT?: any };
  getHudRootFromWindow: () => any;
  isHudDropPending: () => boolean;
};

export function syncHudRootVisibility({
  HUD,
  getHudRootFromWindow,
  isHudDropPending,
}: StartLevelHudRootDeps){
  if (!isGameplayHudRevealAllowed()) return;
  try {
    const hudRoot = getHudRootFromWindow() ?? HUD.HUD_ROOT ?? null;
    if (hudRoot && !(hudRoot as { destroyed?: boolean }).destroyed) {
      const top = hudRoot._dropTop ?? 44;
      if (!isHudDropPending()) {
        hudRoot.y = top;
        hudRoot.alpha = 1;
        hudRoot.visible = true;
        hudRoot._dropped = true;
      } else {
        hudRoot.visible = true;
        hudRoot.alpha = 0;
        hudRoot.y = top - 140;
        hudRoot._dropped = false;
      }
    }
  } catch {}
}
