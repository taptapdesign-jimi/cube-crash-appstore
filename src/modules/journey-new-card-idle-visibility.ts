type KillableTimeline = { kill: () => void };

export type JourneyNewCardIdleShineWork = {
  timeoutIds: Set<number>;
  frameIds: Set<number>;
  timelines: Set<KillableTimeline>;
  lightElement: HTMLElement | null;
  faceElement: HTMLElement | null;
  lightActiveClass: string;
  faceActiveClass: string;
  restoreFaceScale: () => void;
};

/** Suspend only the repeating closed-card pulse. The authored mask and the
 * reveal/entry timelines belong to separate owners and must survive a normal
 * background/foreground boundary. */
export function clearJourneyNewCardIdleShineWork(work: JourneyNewCardIdleShineWork): void {
  const ownsWork = work.timeoutIds.size > 0 || work.frameIds.size > 0 || work.timelines.size > 0;
  if (!ownsWork) return;
  work.timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  work.timeoutIds.clear();
  work.frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
  work.frameIds.clear();
  work.timelines.forEach((timeline) => {
    try { timeline.kill(); } catch {}
  });
  work.timelines.clear();
  work.lightElement?.classList.remove(work.lightActiveClass);
  work.faceElement?.classList.remove(work.faceActiveClass);
  work.restoreFaceScale();
}
