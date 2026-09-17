/** Only these finale textures have exclusive consumers in tnt-animation.
 * Shared dice, artwork, debris and other registry families stay untouched. */
export function isOwnedTntFrameSource(source: string): boolean {
  return /^\.\/assets\/shop\/explosion pack\/animation\/tnt(?:[1-9]|1[0-2])(?:@2x)?\.png$/.test(source)
    || /^\.\/assets\/shop\/bush\/(?:bush(?:[1-9]|10)|flowr[1-6])(?:@2x)?\.png$/.test(source);
}

/** Keeps warmups for a gameplay session, then retires them at explicit exit.
 * A new request cancels retirement before unload, or waits for an unload that
 * already started. No timer can evict a frame between merge readiness and play. */
export class TntFrameCache {
  private entries = new Map<string, Promise<void>>();
  private sources = new Set<string>();
  private generation = 0;
  private retirement: Promise<void> | null = null;

  constructor(private readonly unload: (source: string) => Promise<void>) {}

  remember(source: string): void {
    if (isOwnedTntFrameSource(source)) this.sources.add(source);
  }

  request(key: string, load: () => Promise<void>): Promise<void> {
    this.generation += 1;
    if (this.retirement) {
      return this.retirement.then(() => this.request(key, load));
    }
    const existing = this.entries.get(key);
    if (existing) return existing;
    const pending = Promise.resolve().then(load).catch((error) => {
      if (this.entries.get(key) === pending) this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, pending);
    return pending;
  }

  retire(canRelease: () => boolean, releaseReferences: () => void): Promise<void> {
    if (this.retirement) return this.retirement;
    const generation = this.generation;
    const pending = [...this.entries.values()];
    const task = (async () => {
      // Include partially successful loads; otherwise a late decode could
      // repopulate the cache after the exit cleanup has already finished.
      await Promise.allSettled(pending);
      if (generation !== this.generation || !canRelease()) return;
      releaseReferences();
      this.entries.clear();
      await Promise.all([...this.sources].map(async (source) => {
        try {
          await this.unload(source);
          this.sources.delete(source);
        } catch {
          // Keep failed releases tracked for the next exit; new warmups still
          // revalidate through Assets instead of trusting a fulfilled promise.
        }
      }));
    })();
    this.retirement = task.finally(() => { this.retirement = null; });
    return this.retirement;
  }
}
