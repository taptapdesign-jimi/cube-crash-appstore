/** One active foreground interval; stop consumes it before asynchronous storage. */
export function createPlayTimeTracker({ now, saveSeconds }: {
  now: () => number;
  saveSeconds: (seconds: number) => Promise<void> | void;
}) {
  let startedAt: number | null = null;
  let remainderMs = 0;
  return {
    start() {
      if (startedAt === null) startedAt = now();
    },
    async stop(): Promise<void> {
      if (startedAt === null) return;
      const elapsed = Math.max(0, now() - startedAt) + remainderMs;
      startedAt = null;
      const seconds = Math.floor(elapsed / 1000);
      remainderMs = elapsed - seconds * 1000;
      if (seconds > 0) await saveSeconds(seconds);
    },
  };
}
