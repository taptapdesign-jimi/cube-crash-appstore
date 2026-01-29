type FinalizeDeps = {
  devLog: (...args: any[]) => void;
};

type ResumeDeps = {
  app: { ticker?: { start: () => void } };
  gsap: { globalTimeline: { resume: () => void } };
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function markUserMoveAfterLoad({ devLog }: FinalizeDeps){
  (window as any)._userMadeMove = true;
  devLog('✅ Set _userMadeMove = true after loading saved game state');
}

export function resumeRuntimeAfterLoad({ app, gsap, devLog, devWarn }: ResumeDeps){
  try {
    gsap.globalTimeline.resume();
    app.ticker.start();
    devLog('✅ GSAP and PIXI ticker resumed after loading');
  } catch (error) {
    devWarn('⚠️ Failed to resume GSAP/PIXI:', error);
  }
}
