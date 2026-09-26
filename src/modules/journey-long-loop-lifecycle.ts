type JourneyLongLoopId = 'worlds' | 'forest-world' | 'forest-gameplay';

interface JourneyLongLoopSession {
  media: readonly HTMLAudioElement[];
  playDecoded?: () => void;
  pauseDecoded?: () => void;
  canResume: () => boolean;
  beforeResume?: () => void;
  onSuspend?: () => void;
  onRetire: () => void;
  onFailure: (error: unknown) => void;
}

interface JourneyLongLoopStats {
  owner: JourneyLongLoopId;
  active: boolean;
  suspended: boolean;
  transport: 'media' | 'decoded' | 'none';
  retainedMedia: number;
  playingMedia: number;
  pendingMediaPlays: number;
  failedStarts: number;
}

const owners = new Map<JourneyLongLoopId, () => JourneyLongLoopStats>();
const NATIVE_AUDIO_ACTIVE_EVENT = 'cc:native-audio-active';

/** One listener set per live loop owner. No timers, polling, or audio allocation.
 * Screen owners retain the authority to stop; foreground never acquires it. */
export function createJourneyLongLoopLifecycle(
  owner: JourneyLongLoopId,
  getRetainedMedia: () => readonly HTMLAudioElement[],
) {
  let session: JourneyLongLoopSession | null = null;
  let generation = 0;
  let suspended = false;
  let listening = false;
  let failedStarts = 0;
  const pending = new Set<HTMLAudioElement>();

  const deactivate = (): void => {
    generation++;
    session = null;
    suspended = false;
    pending.clear();
    if (!listening) return;
    listening = false;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onForeground);
    window.removeEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onForeground);
  };

  const suspend = (): void => {
    const current = session;
    if (!current || suspended) return;
    generation++;
    pending.clear();
    suspended = true;
    current.media.forEach((audio) => { try { audio.pause(); } catch {} });
    current.pauseDecoded?.();
    current.onSuspend?.();
  };

  const resume = (initial = false, nativeActive = false): void => {
    const current = session;
    if (!current || (document.hidden && !nativeActive)) return;
    if (!current.canResume()) {
      current.onRetire();
      return;
    }
    const wasSuspended = suspended;
    suspended = false;
    if (initial || wasSuspended) current.beforeResume?.();
    if (session !== current) return;
    const attemptGeneration = generation;
    if (initial || wasSuspended) {
      try { current.playDecoded?.(); }
      catch (error) { failedStarts++; current.onFailure(error); }
    }
    current.media.forEach((audio) => {
      if (session !== current || generation !== attemptGeneration || pending.has(audio)) return;
      if (!initial && !audio.paused) return;
      pending.add(audio);
      const fail = (error: unknown): void => {
        if (session !== current || generation !== attemptGeneration) return;
        pending.delete(audio);
        failedStarts++;
        current.onFailure(error);
      };
      try {
        const play = audio.play();
        void Promise.resolve(play).then(() => {
          if (session === current && generation === attemptGeneration) {
            pending.delete(audio);
          } else if (suspended || !session?.media.includes(audio)) {
            // A late native media completion may not outlive stop/background.
            // The same element can already belong to a newer live session;
            // never pause that newer owner from an old promise continuation.
            try { audio.pause(); } catch {}
          }
        }, fail);
      } catch (error) { fail(error); }
    });
  };

  function onVisibility(): void {
    if (document.hidden) suspend();
    else resume();
  }
  function onPageHide(): void { suspend(); }
  function onForeground(event: Event): void {
    // Native sends this only after the app becomes active. WKWebView can lag
    // behind that notification when updating document.hidden.
    resume(false, event.type === NATIVE_AUDIO_ACTIVE_EVENT);
  }

  owners.set(owner, () => {
    const media = getRetainedMedia();
    return {
      owner,
      active: session !== null,
      suspended,
      transport: session ? session.media.length ? 'media' : 'decoded' : 'none',
      retainedMedia: media.length,
      playingMedia: media.filter((audio) => !audio.paused && !audio.ended).length,
      pendingMediaPlays: pending.size,
      failedStarts,
    };
  });

  return {
    activate(next: JourneyLongLoopSession): void {
      deactivate();
      session = next;
      listening = true;
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('pageshow', onForeground);
      window.addEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onForeground);
      if (document.hidden) suspend();
      else resume(true);
    },
    deactivate,
    isSuspended: () => suspended,
    resetDiagnostics: () => { failedStarts = 0; },
  };
}

/** Detached Audio elements are absent from DOM/media and Web Audio counters.
 * Only these three fixed owners are registered; no history or event arrays. */
export function getJourneyLongLoopAudioStats() {
  const snapshots = Array.from(owners.values(), (read) => read());
  return {
    activeOwners: snapshots.filter((owner) => owner.active).length,
    suspendedOwners: snapshots.filter((owner) => owner.suspended).length,
    retainedMedia: snapshots.reduce((sum, owner) => sum + owner.retainedMedia, 0),
    playingMedia: snapshots.reduce((sum, owner) => sum + owner.playingMedia, 0),
    pendingMediaPlays: snapshots.reduce((sum, owner) => sum + owner.pendingMediaPlays, 0),
    failedStarts: snapshots.reduce((sum, owner) => sum + owner.failedStarts, 0),
    owners: snapshots,
  };
}
