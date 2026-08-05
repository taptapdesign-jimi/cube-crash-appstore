import { gsap } from 'gsap';
import {
  getJourneyV700EnterOffset,
  getJourneyV700MotionProfile,
  getJourneyV700UnitStagger,
} from './journey-v700-motion.js';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';

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

export class JourneyWorldAnimationCoordinator {
  private phase: JourneyWorldAnimationPhase = 'hidden';
  private activeTimeline: gsap.core.Timeline | null = null;
  private idleTickers: Array<() => void> = [];

  public getPhase(): JourneyWorldAnimationPhase {
    return this.phase;
  }

  public stop(resetTransforms = false): void {
    this.activeTimeline?.kill();
    this.activeTimeline = null;
    this.idleTickers.forEach((ticker) => gsap.ticker.remove(ticker));
    this.idleTickers = [];
    if (resetTransforms) this.phase = 'hidden';
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
          force3D: true,
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
      const timeline = gsap.timeline({
        onComplete: () => {
          if (this.activeTimeline === timeline) this.activeTimeline = null;
          resolve();
        },
        onInterrupt: resolve,
      });
      this.activeTimeline = timeline;

      exitOrder.forEach((unit, index) => {
        gsap.killTweensOf(unit.targets);
        const tween = gsap.to(unit.targets, {
          y: motion.exit.y,
          scale: motion.exit.scale,
          opacity: 0,
          duration: motion.exit.duration,
          ease: motion.exit.ease,
          force3D: true,
          overwrite: true,
        });
        timeline.add(tween, index * stagger);
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
      const ticker = () => {
        if (this.phase !== 'entering' && this.phase !== 'idle') return;
        const elapsed = gsap.ticker.time - startTime;
        const ramp = Math.min(1, elapsed / 0.18);
        const easedRamp = ramp * ramp * (3 - (2 * ramp));
        const y = Math.sin((elapsed * speed) + phaseOffset) * 7 * easedRamp;
        ySetters.forEach((setY) => setY(y));
        cloudSetters.forEach((setters, cloudIndex) => {
          const x = Math.sin((elapsed * speed * 0.62) + phaseOffset + cloudIndex) * 10 * easedRamp;
          const y = Math.cos((elapsed * speed * 0.48) + phaseOffset + (cloudIndex * 0.73)) * 5 * easedRamp;
          setters.x(x);
          setters.y(y);
        });
      };

      gsap.ticker.add(ticker);
      this.idleTickers.push(ticker);
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
        force3D: true,
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
