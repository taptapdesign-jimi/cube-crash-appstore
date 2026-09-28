import { isThermalWorkSuppressed } from '../utils/thermal-isolation.js';
import { gsap } from 'gsap';
import {
  getJourneyV700EnterOffset,
  getJourneyV700MotionProfile,
  getJourneyV700UnitStagger,
  getJourneyV700WorldMainExitDuration,
  JOURNEY_WORLD_CARTOON_BOUNCE_ENTER,
  JOURNEY_V700_UNIT_CARD_EXIT_DURATION,
  JOURNEY_V700_UNIT_CARD_EXIT_EASE,
} from './journey-v700-motion.js';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';
import { markIOSJourneyTransitionAudit } from '../utils/ios-journey-world-enter-audit.js';
import {
  MOBILE_RUNTIME_PROFILE,
  type MobileRuntimeProfile,
} from './mobile-runtime-profile.js';
import { markJourneyReturnFirstUnitStart } from './journey-return-transition-trace.js';
import {
  createJourneyUnitMotionSoundSession,
  preloadJourneyUnitMotionSounds,
} from './journey-unit-motion-sound.js';

export interface JourneyWorldAnimationUnit {
  id: string;
  targets: HTMLElement[];
  clouds: HTMLElement[];
  enterDelayOffset?: number;
}

export function isJourneyWorldMainArtworkTarget(
  unitId: string,
  target: HTMLElement,
): boolean {
  return unitId.endsWith('-main')
    && target.classList.contains('journey-forest-main-art');
}

interface JourneyWorldEnterOptions {
  targetsPrimed?: boolean;
  immediateFirstUnit?: boolean;
}

type JourneyWorldAnimationPhase = 'hidden' | 'entering' | 'idle' | 'exiting';

interface JourneyWorldIdleEntry {
  startTime: number;
  speed: number;
  phaseOffset: number;
  ySetters: Array<(value: number) => void>;
  yTargets: HTMLElement[];
  cloudSetters: Array<{
    target: HTMLElement;
    x: (value: number) => void;
  }>;
  resumeBlendStartedAt: number | null;
  resumeFromY: number[];
  resumeFromCloudX: number[];
  visibilityTargets: HTMLElement[];
  visibleTargets: Set<HTMLElement>;
  visibilityResolved: boolean;
}

const FRAME_INTERVAL_TOLERANCE_MS = 1;
const IDLE_RESUME_POSE_BLEND_SECONDS = 0.52;
const ENTER_VIEWPORT_MARGIN_PX = 220;
export const JOURNEY_WORLD_IDLE_ACTIVE_CLASS = 'journey-world-idle-active';

export function isJourneyWorldUnitNearViewport(
  unit: JourneyWorldAnimationUnit,
  scrollRoot: HTMLElement | null,
): boolean {
  const viewportRect = scrollRoot?.getBoundingClientRect();
  const viewportTop = viewportRect && viewportRect.height > 0 ? viewportRect.top : 0;
  const viewportBottom = viewportRect && viewportRect.height > 0
    ? viewportRect.bottom
    : Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  let hasMeasurableTarget = false;
  const intersects = unit.targets.some((target) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    hasMeasurableTarget = true;
    return rect.bottom >= viewportTop - ENTER_VIEWPORT_MARGIN_PX
      && rect.top <= viewportBottom + ENTER_VIEWPORT_MARGIN_PX;
  });
  // A detached/test DOM with no measurable geometry must keep the historical
  // full-enter behavior. Production admission is used only with real boxes.
  return intersects || !hasMeasurableTarget;
}

/** Read the transform that the browser actually painted. GSAP's cached x/y can
 * be stale after a lifecycle owner restores an authored transform string
 * directly (for example `rotate(-4deg) scale(1)`). Using that cache at idle
 * resume would materialize an old translation as a one-frame Unit snap. */
export function readJourneyRenderedTransformAxis(
  target: HTMLElement,
  axis: 'x' | 'y',
): number {
  const view = target.ownerDocument.defaultView;
  const transform = view?.getComputedStyle(target).transform || target.style.transform;
  if (!transform || transform === 'none') return 0;

  const matrix3dMatch = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map(Number);
    const value = values[axis === 'x' ? 12 : 13];
    return Number.isFinite(value) ? value : 0;
  }

  const matrixMatch = transform.match(/^matrix\((.+)\)$/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map(Number);
    const value = values[axis === 'x' ? 4 : 5];
    return Number.isFinite(value) ? value : 0;
  }

  // Some test DOMs return the authored transform list rather than a computed
  // matrix. Only absolute pixel translations are meaningful for the idle
  // owner's x/y contract; rotation/scale alone correctly resolves to zero.
  const translate3dMatch = transform.match(/translate3d\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/i);
  if (translate3dMatch) {
    const value = Number(translate3dMatch[axis === 'x' ? 1 : 2]);
    return Number.isFinite(value) ? value : 0;
  }
  const translateMatch = transform.match(/translate(?:X|Y)?\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?/i);
  if (translateMatch) {
    const isTranslateY = /^translateY/i.test(transform);
    const isTranslateX = /^translateX/i.test(transform);
    if ((axis === 'x' && isTranslateY) || (axis === 'y' && isTranslateX)) return 0;
    const value = Number(axis === 'y' && translateMatch[2] !== undefined
      ? translateMatch[2]
      : translateMatch[1]);
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
}

export function shouldRenderJourneySettledIdleFrame(
  nowSeconds: number,
  lastPaintSeconds: number | null,
  maxFramesPerSecond: number,
): boolean {
  if (maxFramesPerSecond <= 0 || lastPaintSeconds === null) return true;
  const minimumIntervalSeconds = Math.max(
    0,
    ((1000 / maxFramesPerSecond) - FRAME_INTERVAL_TOLERANCE_MS) / 1000,
  );
  return (nowSeconds - lastPaintSeconds) >= minimumIntervalSeconds;
}

export class JourneyWorldAnimationCoordinator {
  private generation = 0;
  private phase: JourneyWorldAnimationPhase = 'hidden';
  private activeTimeline: gsap.core.Timeline | null = null;
  private motionSounds: ReturnType<typeof createJourneyUnitMotionSoundSession> | null = null;
  private idleTicker: (() => void) | null = null;
  private idleTickerAttached = false;
  private idleEntries: JourneyWorldIdleEntry[] = [];
  private idlePaintSuspensionRequested = false;
  private idlePaintSuspendedAt: number | null = null;
  private lastSettledIdlePaintAt: number | null = null;
  private idleVisibilityObserver: IntersectionObserver | null = null;

  public constructor(
    private readonly runtimeProfile: MobileRuntimeProfile = MOBILE_RUNTIME_PROFILE,
  ) {}

  public getPhase(): JourneyWorldAnimationPhase {
    return this.phase;
  }

  public stop(resetTransforms = false): void {
    this.motionSounds?.stop();
    this.motionSounds = null;
    this.activeTimeline?.kill();
    this.generation++;
    this.activeTimeline = null;
    if (this.idleTicker) gsap.ticker.remove(this.idleTicker);
    this.idleTickerAttached = false;
    this.idleTicker = null;
    this.idleEntries.forEach((entry) => this.setIdleEntryRuntimeActive(entry, false));
    this.idleEntries = [];
    this.idlePaintSuspendedAt = this.idlePaintSuspensionRequested ? gsap.ticker.time : null;
    this.lastSettledIdlePaintAt = null;
    this.idleVisibilityObserver?.disconnect();
    this.idleVisibilityObserver = null;
    if (resetTransforms) this.phase = 'hidden';
  }

  /** Pause idle paint without consuming its phase. The visible transition
   * owner allows each completed Unit to idle during the remaining cascade;
   * background/modal/scroll suspension resumes from the last painted pose. */
  public setIdlePaintSuspended(suspended: boolean): void {
    this.idlePaintSuspensionRequested = suspended;
    const now = gsap.ticker.time;
    if (suspended) {
      if (this.idlePaintSuspendedAt === null) {
        this.idlePaintSuspendedAt = now;
        // Capture pixels, not only the mathematical sine phase. A second
        // legacy Unit owner may have painted the final pre-modal frame, and
        // WebKit's throttled ticker can also leave a fractional phase gap.
        // Resuming from these exact values prevents either case from becoming
        // a one-frame vertical snap.
        this.idleEntries.forEach((entry) => {
          entry.resumeFromY = entry.yTargets.map((target) => (
            readJourneyRenderedTransformAxis(target, 'y')
          ));
          entry.resumeFromCloudX = entry.cloudSetters.map(({ target }) => (
            readJourneyRenderedTransformAxis(target, 'x')
          ));
          entry.resumeBlendStartedAt = null;
        });
      }
      this.idleEntries.forEach((entry) => this.setIdleEntryRuntimeActive(entry, false));
      this.refreshIdleTickerAttachment();
      return;
    }
    if (this.idlePaintSuspendedAt === null) return;
    const pausedFor = Math.max(0, now - this.idlePaintSuspendedAt);
    this.idleEntries.forEach((entry) => {
      entry.startTime += pausedFor;
      entry.resumeBlendStartedAt = now;
    });
    this.idlePaintSuspendedAt = null;
    this.lastSettledIdlePaintAt = null;
    this.idleEntries.forEach((entry) => this.refreshIdleEntryRuntimeActive(entry));
    this.refreshIdleTickerAttachment();
  }

  public async enter(
    units: JourneyWorldAnimationUnit[],
    reducedMotion: boolean,
    options: JourneyWorldEnterOptions = {},
  ): Promise<void> {
    const liveUnits = this.getLiveUnits(units);
    this.stop();
    const generation = this.generation;
    if (!liveUnits.length) {
      this.phase = 'idle';
      return;
    }

    this.phase = 'entering';
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const liveClouds = Array.from(new Set(liveUnits.flatMap((unit) => unit.clouds)));
    const canUseViewportAdmission = !reducedMotion
      && typeof window.IntersectionObserver === 'function';
    const scrollRoot = liveUnits[0]?.targets[0]?.closest<HTMLElement>('.collectibles-scrollable') ?? null;
    let enteringUnits = canUseViewportAdmission
      ? liveUnits.filter((unit) => isJourneyWorldUnitNearViewport(unit, scrollRoot))
      : liveUnits;
    // Never turn a malformed viewport measurement into an empty visible enter.
    if (enteringUnits.length === 0) enteringUnits = liveUnits.slice(0, 1);
    const enteringUnitSet = new Set(enteringUnits);
    const settledOffscreenUnits = liveUnits.filter((unit) => !enteringUnitSet.has(unit));
    preloadJourneyUnitMotionSounds();
    const motionSounds = this.motionSounds = createJourneyUnitMotionSoundSession(enteringUnits);

    // Idle cloud drift owns GSAP x while the World is settled. An interrupted
    // or completed exit can leave that last horizontal value inline. Reset it
    // while the return enter is still at opacity 0, so the first idle frame
    // continues from x=0 instead of visibly snapping there after enter.
    if (liveClouds.length) {
      gsap.set(liveClouds, { x: 0, overwrite: true });
    }
    // Units outside the initial viewport cannot be seen during this cascade.
    // Settle them before the visible frame instead of animating dozens of
    // large transparent PNG layers offscreen. IntersectionObserver admits
    // their idle work later when the player scrolls near them.
    settledOffscreenUnits.forEach((unit) => {
      gsap.killTweensOf(unit.targets);
      unit.targets.forEach((target) => this.finalizeEnterTarget(target));
    });
    emitIOSNativeDiagnostic('world-enter-viewport-admission', {
      totalUnits: liveUnits.length,
      animatedUnits: enteringUnits.length,
      settledOffscreenUnits: settledOffscreenUnits.length,
    });

    await new Promise<void>((resolve) => {
      const timeline = gsap.timeline({
        onComplete: () => {
          motionSounds.stop();
          if (this.activeTimeline === timeline) this.activeTimeline = null;
          resolve();
        },
        onInterrupt: () => { motionSounds.stop(); resolve(); },
      });
      this.activeTimeline = timeline;

      const enterOffsets = enteringUnits.map((unit, index) => Number.isFinite(unit.enterDelayOffset)
        ? Number(unit.enterDelayOffset)
        : getJourneyV700EnterOffset(unit.id, index, reducedMotion));
      // Remove only the empty lead-in after a completed result exit. Keep every
      // Unit's duration, curve and relative cascade spacing unchanged.
      const enterLead = options.immediateFirstUnit
        ? -Math.min(...enterOffsets)
        : motion.enter.baseDelay;
      enteringUnits.forEach((unit, index) => {
        if (!options.targetsPrimed) {
          gsap.killTweensOf(unit.targets);
          unit.targets.forEach((target) => {
            target.style.visibility = 'visible';
            target.style.pointerEvents = 'none';
          });
        }
        const enterVars = {
          y: 0,
          scale: 1,
          opacity: 1,
          visibility: 'visible',
          duration: motion.enter.duration,
          ease: motion.enter.ease,
          // The World contains dozens of large transparent PNG targets. Forcing
          // all of them into compositor layers before their first visible frame
          // produced a measured 77-150ms cold iOS hitch. Let GSAP keep this
          // short enter in 2D; settled idle motion can then own only live Units.
          force3D: false,
          overwrite: true,
        };
        const tween = options.targetsPrimed
          ? gsap.to(unit.targets, enterVars)
          : gsap.fromTo(unit.targets, {
            y: motion.enter.y,
            scale: motion.enter.scale,
            opacity: 0,
            visibility: 'visible',
          }, enterVars);
        // drag-core's Timeline.fromTo guard drops GSAP's position argument.
        // Timeline.add is not patched, so it preserves the exact short cascade.
        const irregularOffset = enterOffsets[index];
        tween.eventCallback('onStart', () => {
          if (generation !== this.generation) return;
          motionSounds.playEnter(unit.id, motion.enter.duration);
          markJourneyReturnFirstUnitStart({
            unitId: unit.id,
            unitIndex: index,
            targetCount: unit.targets.length,
          });
          markIOSJourneyTransitionAudit(`enter-unit-${unit.id}-start`);
          emitIOSNativeDiagnostic('world-unit-enter-start', {
            unitId: unit.id,
            unitIndex: index,
            targetCount: unit.targets.length,
            scheduledAt: enterLead + irregularOffset,
          });
        });
        tween.eventCallback('onComplete', () => {
          if (generation !== this.generation || this.phase !== 'entering') return;
          unit.targets.forEach((target) => this.finalizeEnterTarget(target));
        });
        timeline.add(tween, enterLead + irregularOffset);
      });
    });

    if (generation !== this.generation || this.phase !== 'entering') return;
    this.phase = 'idle';
    // Start the shared settled motion immediately after the complete cascade.
    // Painting earlier Units while later Units are still entering makes their
    // large PNG transforms compete in the same iOS compositor frames.
    this.startIdle(liveUnits, reducedMotion, 0, enteringUnitSet);
  }

  public async exit(units: JourneyWorldAnimationUnit[], reducedMotion: boolean): Promise<void> {
    const liveUnits = this.getLiveUnits(units);
    this.stop();
    const generation = this.generation;
    if (!liveUnits.length) {
      this.phase = 'hidden';
      return;
    }

    this.phase = 'exiting';
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const stagger = getJourneyV700UnitStagger(liveUnits.length, reducedMotion);
    const exitOrder = liveUnits.slice().reverse();
    preloadJourneyUnitMotionSounds();
    const motionSounds = this.motionSounds = createJourneyUnitMotionSoundSession(exitOrder);

    await new Promise<void>((resolve) => {
      const cardExitFinalizers: Array<() => void> = [];
      const unitExitFinalizers: Array<() => void> = [];
      const finalizeCardExits = () => {
        cardExitFinalizers.forEach((finalize) => finalize());
      };
      const finalizeUnitExits = () => {
        unitExitFinalizers.forEach((finalize) => finalize());
      };
      const timeline = gsap.timeline({
        onComplete: () => {
          motionSounds.stop();
          finalizeUnitExits();
          finalizeCardExits();
          if (this.activeTimeline === timeline) this.activeTimeline = null;
          resolve();
        },
        onInterrupt: () => {
          motionSounds.stop();
          finalizeUnitExits();
          finalizeCardExits();
          resolve();
        },
      });
      this.activeTimeline = timeline;

      exitOrder.forEach((unit, index) => {
        const position = index * stagger;
        const markUnitExitStart = () => {
          if (generation !== this.generation) return;
          const duration = !reducedMotion && unit.targets.some(target => isJourneyWorldMainArtworkTarget(unit.id, target))
            ? getJourneyV700WorldMainExitDuration(JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.bounceDurationSeconds)
              + getJourneyV700WorldMainExitDuration(JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.exitDurationSeconds)
            : motion.exit.duration;
          motionSounds.playExit(unit.id, duration);
          markIOSJourneyTransitionAudit(`exit-unit-${unit.id}-start`);
          emitIOSNativeDiagnostic('world-unit-exit-start', {
            unitId: unit.id,
            unitIndex: index,
            targetCount: unit.targets.length,
            scheduledAt: position,
          });
        };
        const cardWrappers = unit.targets.filter((target) => (
          target.classList.contains('journey-board-card-wrapper')
        ));
        const structuralTargets = unit.targets.filter((target) => !cardWrappers.includes(target));
        const mainArtworkTargets = reducedMotion
          ? []
          : unit.targets.filter((target) => isJourneyWorldMainArtworkTarget(unit.id, target));
        const cardVisualTargets = cardWrappers.flatMap((wrapper) => {
          const card = wrapper.querySelector<HTMLElement>('.journey-board-card');
          return card ? [card] : [];
        });
        let unitExitFinalized = false;
        const finalizeUnitExit = () => {
          if (unitExitFinalized || generation !== this.generation) return;
          unitExitFinalized = true;
          unit.targets.forEach((target) => {
            if (!target.isConnected) return;
            gsap.set(target, {
              opacity: 0,
              visibility: 'hidden',
              pointerEvents: 'none',
              overwrite: true,
            });
          });
        };
        unitExitFinalizers.push(finalizeUnitExit);

        gsap.killTweensOf([...unit.targets, ...cardVisualTargets]);

        if (mainArtworkTargets.length) {
          const companionTargets = unit.targets.filter((target) => !mainArtworkTargets.includes(target));
          gsap.set(mainArtworkTargets, {
            opacity: 1,
            visibility: 'visible',
            transformOrigin: JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.transformOrigin,
            overwrite: true,
          });
          const mainArtworkExit = gsap.timeline({
            onComplete: companionTargets.length ? undefined : finalizeUnitExit,
            onInterrupt: finalizeUnitExit,
          })
            .to(mainArtworkTargets, {
              scaleX: JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.scaleX,
              scaleY: JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.scaleY,
              duration: getJourneyV700WorldMainExitDuration(
                JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.bounceDurationSeconds,
              ),
              ease: JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.bounceEase,
              force3D: false,
              overwrite: true,
              onStart: markUnitExitStart,
            })
            .to(mainArtworkTargets, {
              y: motion.exit.y,
              scaleX: 0,
              scaleY: 0,
              opacity: 1,
              duration: getJourneyV700WorldMainExitDuration(
                JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.exitDurationSeconds,
              ),
              ease: JOURNEY_WORLD_CARTOON_BOUNCE_ENTER.exitEase,
              force3D: false,
              overwrite: true,
            });
          timeline.add(mainArtworkExit, position);
          if (companionTargets.length) {
            timeline.add(gsap.to(companionTargets, {
              y: motion.exit.y,
              scale: motion.exit.scale,
              opacity: 0,
              duration: motion.exit.duration,
              ease: motion.exit.ease,
              force3D: false,
              overwrite: true,
              onComplete: finalizeUnitExit,
              onInterrupt: finalizeUnitExit,
            }), position);
          }
          return;
        }

        if (reducedMotion || !cardVisualTargets.length) {
          const tween = gsap.to(unit.targets, {
            y: motion.exit.y,
            scale: motion.exit.scale,
            opacity: 0,
            duration: motion.exit.duration,
            ease: motion.exit.ease,
            force3D: false,
            overwrite: true,
            onStart: markUnitExitStart,
            onComplete: finalizeUnitExit,
            onInterrupt: finalizeUnitExit,
          });
          timeline.add(tween, position);
          return;
        }

        // The complete Unit still has one coordinator/timeline and one start
        // position. Structural art keeps the v910 World exit. The card's
        // visible face performs the established opaque back.in collapse and
        // finishes before its island, so a high-contrast card can never appear
        // alone after the softer island/cloud PNGs have faded.
        if (structuralTargets.length) {
          timeline.add(gsap.to(structuralTargets, {
            y: motion.exit.y,
            scale: motion.exit.scale,
            opacity: 0,
            duration: motion.exit.duration,
            ease: motion.exit.ease,
            force3D: false,
            overwrite: true,
            onStart: markUnitExitStart,
            onComplete: finalizeUnitExit,
            onInterrupt: finalizeUnitExit,
          }), position);
        }

        timeline.add(gsap.to(cardWrappers, {
          y: motion.exit.y,
          duration: JOURNEY_V700_UNIT_CARD_EXIT_DURATION,
          ease: motion.exit.ease,
          force3D: false,
          overwrite: true,
          onStart: structuralTargets.length ? undefined : markUnitExitStart,
        }), position);
        cardVisualTargets.forEach((card) => {
          card.classList.add('journey-card-tapping');
          card.style.visibility = 'visible';
          card.style.opacity = '1';
          card.style.willChange = 'transform';
        });
        let cardExitFinalized = false;
        const finalizeCardExit = () => {
          if (cardExitFinalized || generation !== this.generation) return;
          cardExitFinalized = true;
          cardWrappers.forEach((wrapper) => {
            if (!document.body.contains(wrapper)) return;
            gsap.set(wrapper, { opacity: 0, visibility: 'hidden', overwrite: true });
          });
          cardVisualTargets.forEach((card) => {
            if (!document.body.contains(card)) return;
            card.classList.remove('journey-card-tapping');
            card.style.willChange = 'auto';
            gsap.set(card, {
              scale: 1,
              opacity: 1,
              visibility: 'visible',
              clearProps: 'transform,opacity,visibility',
              overwrite: true,
            });
          });
        };
        cardExitFinalizers.push(finalizeCardExit);
        timeline.add(gsap.to(cardVisualTargets, {
          scale: 0,
          opacity: 1,
          duration: JOURNEY_V700_UNIT_CARD_EXIT_DURATION,
          ease: JOURNEY_V700_UNIT_CARD_EXIT_EASE,
          force3D: false,
          overwrite: true,
          onComplete: finalizeCardExit,
          onInterrupt: finalizeCardExit,
        }), position);
      });
    });

    if (generation === this.generation && this.phase === 'exiting') this.phase = 'hidden';
  }

  private startIdle(
    units: JourneyWorldAnimationUnit[],
    reducedMotion: boolean,
    unitIndexOffset = 0,
    initiallyVisibleUnits?: ReadonlySet<JourneyWorldAnimationUnit>,
  ): void {
    if (reducedMotion) return;

    units.forEach((unit, localUnitIndex) => {
      const unitIndex = unitIndexOffset + localUnitIndex;
      const startTime = this.idlePaintSuspendedAt ?? gsap.ticker.time;
      const duration = 3.15 + ((unitIndex % 3) * 0.28);
      const speed = (Math.PI * 2) / duration;
      const phaseOffset = unitIndex * 0.47;
      const ySetters = unit.targets.map((target) => gsap.quickSetter(target, 'y', 'px') as (value: number) => void);
      const cloudSetters = unit.clouds.map((cloud) => ({
        target: cloud,
        x: gsap.quickSetter(cloud, 'x', 'px') as (value: number) => void,
      }));
      // Main clouds use a full-map-sized positioning wrapper. Its empty box
      // stays intersecting long after the actual artwork has left the viewport.
      // Observe the painted cloud leaves instead, without changing the wrapper
      // or any of the Unit's transform/lifecycle owners.
      const visibilityTargets = Array.from(new Set(unit.targets.flatMap((target) => (
        target.classList.contains('journey-main-cloud-unit')
          ? Array.from(target.querySelectorAll<HTMLElement>('.journey-forest-cloud-art'))
          : [target]
      ))));
      const initialVisibilityResolved = initiallyVisibleUnits !== undefined;
      const initiallyVisible = !initialVisibilityResolved || initiallyVisibleUnits.has(unit);
      const entry: JourneyWorldIdleEntry = {
        startTime,
        speed,
        phaseOffset,
        ySetters,
        yTargets: unit.targets,
        cloudSetters,
        resumeBlendStartedAt: null,
        resumeFromY: [],
        resumeFromCloudX: [],
        visibilityTargets,
        // Treat every target as potentially visible until its own observer
        // record arrives. Partial initial observer batches therefore cannot
        // incorrectly suppress a Unit that is already on screen.
        visibleTargets: new Set(initiallyVisible ? visibilityTargets : []),
        // Until IntersectionObserver delivers its first batch, preserve the
        // previous visible behavior. This avoids a blank/snap frame on enter.
        visibilityResolved: initialVisibilityResolved,
      };
      this.idleEntries.push(entry);
      this.refreshIdleEntryRuntimeActive(entry);
      this.observeIdleEntry(entry);
    });

    if (this.idleTicker) {
      this.refreshIdleTickerAttachment();
      return;
    }
    this.idleTicker = () => {
      if (this.phase !== 'idle') return;
      if (isThermalWorkSuppressed('journey-units')) return;
      if (this.idlePaintSuspendedAt !== null) return;
      const now = gsap.ticker.time;
      if (
        !shouldRenderJourneySettledIdleFrame(
          now,
          this.lastSettledIdlePaintAt,
          this.runtimeProfile.settledIdleMaxFramesPerSecond,
        )
      ) return;
      this.lastSettledIdlePaintAt = now;
      this.idleEntries.forEach((entry) => {
        if (entry.visibilityResolved && entry.visibleTargets.size === 0) return;
        const elapsed = now - entry.startTime;
        const ramp = Math.min(1, elapsed / 0.18);
        const easedRamp = ramp * ramp * (3 - (2 * ramp));
        const y = Math.sin((elapsed * entry.speed) + entry.phaseOffset) * 7 * easedRamp;
        const resumeProgress = entry.resumeBlendStartedAt === null
          ? 1
          : Math.min(1, Math.max(0, (now - entry.resumeBlendStartedAt) / IDLE_RESUME_POSE_BLEND_SECONDS));
        const resumeBlend = resumeProgress * resumeProgress * (3 - (2 * resumeProgress));
        entry.ySetters.forEach((setY, targetIndex) => {
          const fromY = entry.resumeFromY[targetIndex];
          setY(Number.isFinite(fromY) && resumeProgress < 1
            ? fromY + ((y - fromY) * resumeBlend)
            : y);
        });
        entry.cloudSetters.forEach((setters, cloudIndex) => {
          const x = Math.sin((elapsed * entry.speed * 0.62) + entry.phaseOffset + cloudIndex) * 10 * easedRamp;
          const fromX = entry.resumeFromCloudX[cloudIndex];
          setters.x(Number.isFinite(fromX) && resumeProgress < 1
            ? fromX + ((x - fromX) * resumeBlend)
            : x);
        });
        if (entry.resumeBlendStartedAt !== null && resumeProgress >= 1) {
          entry.resumeBlendStartedAt = null;
          entry.resumeFromY = [];
          entry.resumeFromCloudX = [];
        }
      });
    };
    this.refreshIdleTickerAttachment();
  }

  private refreshIdleTickerAttachment(): void {
    if (!this.idleTicker) return;
    const needed = this.idlePaintSuspendedAt === null
      && this.phase === 'idle'
      && this.idleEntries.some((entry) => !entry.visibilityResolved || entry.visibleTargets.size > 0);
    if (needed === this.idleTickerAttached) return;
    this.idleTickerAttached = needed;
    if (needed) gsap.ticker.add(this.idleTicker);
    else gsap.ticker.remove(this.idleTicker);
  }

  private observeIdleEntry(entry: JourneyWorldIdleEntry): void {
    if (typeof window.IntersectionObserver !== 'function' || entry.visibilityTargets.length === 0) return;
    if (!this.idleVisibilityObserver) {
      const generation = this.generation;
      const firstTarget = entry.visibilityTargets[0];
      const scrollRoot = firstTarget.closest<HTMLElement>('.collectibles-scrollable');
      this.idleVisibilityObserver = new IntersectionObserver((records) => {
        if (generation !== this.generation) return;
        const changedEntries = new Set<JourneyWorldIdleEntry>();
        records.forEach((record) => {
          const element = record.target as HTMLElement;
          this.idleEntries.forEach((idleEntry) => {
            if (!idleEntry.visibilityTargets.includes(element)) return;
            idleEntry.visibilityResolved = true;
            if (record.isIntersecting) idleEntry.visibleTargets.add(element);
            else idleEntry.visibleTargets.delete(element);
            changedEntries.add(idleEntry);
          });
        });
        // Paint newly visible Units immediately at their elapsed-time pose.
        if (Array.from(changedEntries).some((idleEntry) => idleEntry.visibleTargets.size > 0)) {
          this.lastSettledIdlePaintAt = null;
        }
        changedEntries.forEach((idleEntry) => this.refreshIdleEntryRuntimeActive(idleEntry));
        this.refreshIdleTickerAttachment();
      }, {
        root: scrollRoot,
        rootMargin: '160px 0px',
      });
    }
    entry.visibilityTargets.forEach((target) => this.idleVisibilityObserver?.observe(target));
  }

  private refreshIdleEntryRuntimeActive(entry: JourneyWorldIdleEntry): void {
    this.setIdleEntryRuntimeActive(
      entry,
      this.idlePaintSuspendedAt === null
        && (!entry.visibilityResolved || entry.visibleTargets.size > 0),
    );
  }

  private setIdleEntryRuntimeActive(entry: JourneyWorldIdleEntry, active: boolean): void {
    entry.yTargets.forEach((target) => {
      if (!target.isConnected && active) return;
      target.classList.toggle(JOURNEY_WORLD_IDLE_ACTIVE_CLASS, active);
    });
  }

  private getLiveUnits(units: JourneyWorldAnimationUnit[]): JourneyWorldAnimationUnit[] {
    return units
      .map((unit) => ({
        ...unit,
        targets: Array.from(new Set(unit.targets)).filter((target) => document.body.contains(target) && target.style.display !== 'none'),
        clouds: Array.from(new Set(unit.clouds)).filter((target) => document.body.contains(target) && target.style.display !== 'none'),
      }))
      .filter((unit) => unit.targets.length > 0);
  }

  private finalizeEnterTarget(target: HTMLElement): void {
    if (!document.body.contains(target)) return;

    try {
      gsap.set(target, {
        y: 0,
        scale: 1,
        opacity: 1,
        visibility: 'visible',
        force3D: false,
        overwrite: true,
      });
    } catch {
      target.style.opacity = '1';
      target.style.visibility = 'visible';
    }

    target.style.visibility = 'visible';
    target.style.opacity = '1';
    target.style.pointerEvents = '';
    target.style.willChange = 'auto';
  }
}
