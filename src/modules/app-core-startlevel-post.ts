type StartLevelPostDeps = {
  syncSharedState: () => void;
  updateHUD: () => void;
};

export function runStartLevelPost({ syncSharedState, updateHUD }: StartLevelPostDeps){
  syncSharedState();
  updateHUD();
}
