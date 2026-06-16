const GAME_OVER_BOARD_EXIT_TIMEOUT_MS = 5600;
const GAME_OVER_BOARD_EXIT_FALLBACK_MS = 360;
const GAME_OVER_BOARD_EXIT_MIN_VISIBLE_MS = 700;

let activeGameOverBoardExitPromise: Promise<void> | null = null;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function playGameOverBoardExitAnimation(): Promise<void> {
  if (typeof window === 'undefined') return;

  const anyWindow = window as any;
  if (activeGameOverBoardExitPromise) {
    await activeGameOverBoardExitPromise;
    return;
  }
  if (anyWindow.__ccGameOverBoardExitAnimating === true && anyWindow.__ccGameOverBoardExitComplete !== true) {
    await Promise.race([
      wait(GAME_OVER_BOARD_EXIT_TIMEOUT_MS),
      new Promise<void>((resolve) => {
        const startedAt = Date.now();
        const poll = () => {
          if (anyWindow.__ccGameOverBoardExitComplete === true) {
            resolve();
            return;
          }
          if (Date.now() - startedAt >= GAME_OVER_BOARD_EXIT_TIMEOUT_MS) {
            resolve();
            return;
          }
          window.setTimeout(poll, 50);
        };
        poll();
      }),
    ]);
    return;
  }

  anyWindow.__ccGameOverBoardExitAnimating = true;
  anyWindow.__ccGameOverBoardExitComplete = false;

  activeGameOverBoardExitPromise = (async () => {
    try {
      const animateBoardExit = anyWindow.animateBoardExit;
      if (typeof animateBoardExit !== 'function') {
        await wait(GAME_OVER_BOARD_EXIT_FALLBACK_MS);
        anyWindow.__ccGameOverBoardExitComplete = true;
        return;
      }

      const boardExitPromise = Promise.resolve(animateBoardExit());
      await Promise.all([
        Promise.race([boardExitPromise, wait(GAME_OVER_BOARD_EXIT_TIMEOUT_MS)]),
        wait(GAME_OVER_BOARD_EXIT_MIN_VISIBLE_MS),
      ]);
      anyWindow.__ccGameOverBoardExitComplete = true;
    } catch {
      await wait(GAME_OVER_BOARD_EXIT_FALLBACK_MS);
      anyWindow.__ccGameOverBoardExitComplete = true;
    } finally {
      try {
        delete anyWindow.__ccGameOverBoardExitAnimating;
      } catch {}
      activeGameOverBoardExitPromise = null;
    }
  })();

  await activeGameOverBoardExitPromise;
}
