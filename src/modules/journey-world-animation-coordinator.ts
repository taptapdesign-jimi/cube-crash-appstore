import { gsap } from 'gsap';
import {
  getJourneyV700EnterOffset,
  getJourneyV700MotionProfile,
  getJourneyV700UnitStagger,
  JOURNEY_V700_UNIT_CARD_EXIT_DURATION,
  JOURNEY_V700_UNIT_CARD_EXIT_EASE,
} from './journey-v700-motion.js';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';
import { markIOSJourneyTransitionAudit } from '../utils/ios-journey-world-enter-audit.js';
import {
  MOBILE_RUNTIME_PROFILE,
  type MobileRuntimeProfile,
} from './mobile-runtime-profile.js';

export interface JourneyWorldAnimationUnit {
  id: string;
  targets: HTMLElement[];
  clouds: HTMLElement[];
  enterDelayOffset?: number;
}

interface JourneyWorldEnterOptions {
  targetsPrimed?: boolean;
}

type JourneyWorldAnimationPhase = 'hidden' | 'entering' | 'idle' | 'exiting';

interface JourneyWorldIdleEntry {
  startTime: number;
  speed: number;
  phaseOffset: number;
  ySetters: Array<(value: number) => void>;
  cloudSetters: Array<{
    x: (value: number) => void;
    y: (value: number) => void;
  }>;
  visibilityTargets: HTMLElement[];
  visibleTargets: Set<HTMLElement>;
  visibilityResolved: boolean;
}

const FRAME_INTERVAL_TOLERANCE_MS = 1;

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
  private phase: JourneyWorldAnimationPhase = 'hidden';
  private activeTimeline: gsap.core.Timeline | null = null;
  private idleTicker: (() => void) | null = null;
  private idleEntries: JourneyWorldIdleEntry[] = [];
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
    this.activeTimeline?.kill();
    this.activeTimeline = null;
    if (this.idleTicker) gsap.ticker.remove(this.idleTicker);
    this.idleTicker = null;
    this.idleEntries = [];
    this.idlePaintSuspendedAt = null;
    this.lastSettledIdlePaintAt = null;
    this.idleVisibilityObserver?.disconnect();
    this.idleVisibilityObserver = null;
    if (resetTransforms) this.phase = 'hidden';
  }

  /** Pause only settled idle paint. Enter keeps its contractually required
   * per-Unit handoff, while modal/scroll suspension resumes from the exact
   * previous phase without a catch-up jump. */
  public setIdlePaintSuspended(suspended: boolean): void {
    const now = gsap.ticker.time;
    if (suspended) {
      if (this.idlePaintSuspendedAt === null) this.idlePaintSuspendedAt = now;
      return;
    }
    if (this.idlePaintSuspendedAt === null) return;
    const pausedFor = Math.max(0, now - this.idlePaintSuspendedAt);
    this.idleEntries.forEach((entry) => entry.startTime += pausedFor);
    this.idlePaintSuspendedAt = null;
    this.lastSettledIdlePaintAt = null;
  }

  public async enter(
    units: JourneyWorldAnimationUnit[],
    reducedMotion: boolean,
    options: JourneyWorldEnterOptions = {},
  ): Promise<void> {
    const liveUnits = this.getLiveUnits(units);
    if (!liveUnits.length) {
      this.phase = 'idle';
      return;
    }

    this.stop();
    this.phase = 'entering';
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const liveClouds = Array.from(new Set(liveUnits.flatMap((unit) => unit.clouds)));

    // Idle cloud drift owns GSAP x while the World is settled. An interrupted
    // or completed exit can leave that last horizontal value inline. Reset it
    // while the return enter is still at opacity 0, so the first idle frame
    // continues from x=0 instead of visibly snapping there after enter.
    if (liveClouds.length) {
      gsap.set(liveClouds, { x: 0, overwrite: true });
    }

    await new Promise<void>((resolve) => {
      const timeline = gsap.timeline({
        onComplete: () => {
          if (this.activeTimeline === timeline) this.activeTimeline = null;
          resolve();
        },
        onInterrupt: resolve,
      });
      this.activeTimeline = timeline;

      liveUnits.forEach((unit, index) => {
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
        const irregularOffset = Number.isFinite(unit.enterDelayOffset)
          ? Number(unit.enterDelayOffset)
          : getJourneyV700EnterOffset(unit.id, index, reducedMotion);
        tween.eventCallback('onStart', () => {
          markIOSJourneyTransitionAudit(`enter-unit-${unit.id}-start`);
          emitIOSNativeDiagnostic('world-unit-enter-start', {
            unitId: unit.id,
            unitIndex: index,
            targetCount: unit.targets.length,
            scheduledAt: motion.enter.baseDelay + irregularOffset,
          });
        });
        tween.eventCallback('onComplete', () => {
          if (this.phase !== 'entering') return;
          unit.targets.forEach((target) => this.finalizeEnterTarget(target));
          // Each Unit becomes alive as soon as its own enter settles. Its idle
          // never competes with that Unit's enter transform, and later Units
          // do not hold the already-visible scene motion hostage.
          this.startIdle([unit], reducedMotion, index);
        });
        timeline.add(tween, motion.enter.baseDelay + irregularOffset);
      });
    });

    if (this.phase !== 'entering') return;
    this.phase = 'idle';
  }

  public async exit(units: JourneyWorldAnimationUnit[], reducedMotion: boolean): Promise<void> {
    const liveUnits = this.getLiveUnits(units);
    if (!liveUnits.length) {
      this.phase = 'hidden';
      return;
    }

    this.stop();
    this.phase = 'exiting';
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const stagger = getJourneyV700UnitStagger(liveUnits.length, reducedMotion);
    const exitOrder = liveUnits.slice().reverse();

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
          finalizeUnitExits();
          finalizeCardExits();
          if (this.activeTimeline === timeline) this.activeTimeline = null;
          resolve();
        },
        onInterrupt: () => {
          finalizeUnitExits();
          finalizeCardExits();
          resolve();
        },
      });
      this.activeTimeline = timeline;

      exitOrder.forEach((unit, index) => {
        const position = index * stagger;
        const markUnitExitStart = () => {
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
        const cardVisualTargets = cardWrappers.flatMap((wrapper) => {
          const card = wrapper.querySelector<HTMLElement>('.journey-board-card');
          return card ? [card] : [];
        });
        let unitExitFinalized = false;
        const finalizeUnitExit = () => {
          if (unitExitFinalized) return;
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
          if (cardExitFinalized) return;
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

    if (this.phase === 'exiting') this.phase = 'hidden';
  }

  private startIdle(
    units: JourneyWorldAnimationUnit[],
    reducedMotion: boolean,
    unitIndexOffset = 0,
  ): void {
    if (reducedMotion) return;

    units.forEach((unit, localUnitIndex) => {
      const unitIndex = unitIndexOffset + localUnitIndex;
      const startTime = gsap.ticker.time;
      const duration = 3.15 + ((unitIndex % 3) * 0.28);
      const speed = (Math.PI * 2) / duration;
      const phaseOffset = unitIndex * 0.47;
      const ySetters = unit.targets.map((target) => gsap.quickSetter(target, 'y', 'px') as (value: number) => void);
      const cloudSetters = unit.clouds.map((cloud) => ({
        x: gsap.quickSetter(cloud, 'x', 'px') as (value: number) => void,
        y: gsap.quickSetter(cloud, 'y', 'px') as (value: number) => void,
      }));
      const visibilityTargets = Array.from(new Set(unit.targets));
      const entry: JourneyWorldIdleEntry = {
        startTime,
        speed,
        phaseOffset,
        ySetters,
        cloudSetters,
        visibilityTargets,
        // Treat every target as potentially visible until its own observer
        // record arrives. Partial initial observer batches therefore cannot
        // incorrectly suppress a Unit that is already on screen.
        visibleTargets: new Set(visibilityTargets),
        // Until IntersectionObserver delivers its first batch, preserve the
        // previous visible behavior. This avoids a blank/snap frame on enter.
        visibilityResolved: false,
      };
      this.idleEntries.push(entry);
      this.observeIdleEntry(entry);
    });

    if (this.idleTicker) return;
    this.idleTicker = () => {
      if (this.phase !== 'entering' && this.phase !== 'idle') return;
      if (this.idlePaintSuspendedAt !== null && this.phase === 'idle') return;
      const now = gsap.ticker.time;
      if (
        this.phase === 'idle'
        && !shouldRenderJourneySettledIdleFrame(
          now,
          this.lastSettledIdlePaintAt,
          this.runtimeProfile.settledIdleMaxFramesPerSecond,
        )
      ) return;
      if (this.phase === 'idle') this.lastSettledIdlePaintAt = now;
      this.idleEntries.forEach((entry) => {
        if (entry.visibilityResolved && entry.visibleTargets.size === 0) return;
        const elapsed = now - entry.startTime;
        const ramp = Math.min(1, elapsed / 0.18);
        const easedRamp = ramp * ramp * (3 - (2 * ramp));
        const y = Math.sin((elapsed * entry.speed) + entry.phaseOffset) * 7 * easedRamp;
        entry.ySetters.forEach((setY) => setY(y));
        entry.cloudSetters.forEach((setters, cloudIndex) => {
          const x = Math.sin((elapsed * entry.speed * 0.62) + entry.phaseOffset + cloudIndex) * 10 * easedRamp;
          const cloudY = Math.cos((elapsed * entry.speed * 0.48) + entry.phaseOffset + (cloudIndex * 0.73)) * 5 * easedRamp;
          setters.x(x);
          setters.y(cloudY);
        });
      });
    };
    gsap.ticker.add(this.idleTicker);
  }

  private observeIdleEntry(entry: JourneyWorldIdleEntry): void {
    if (typeof window.IntersectionObserver !== 'function' || entry.visibilityTargets.length === 0) return;
    if (!this.idleVisibilityObserver) {
      const firstTarget = entry.visibilityTargets[0];
      const scrollRoot = firstTarget.closest<HTMLElement>('.collectibles-scrollable');
      this.idleVisibilityObserver = new IntersectionObserver((records) => {
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
      }, {
        root: scrollRoot,
        rootMargin: '160px 0px',
      });
    }
    entry.visibilityTargets.forEach((target) => this.idleVisibilityObserver?.observe(target));
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
