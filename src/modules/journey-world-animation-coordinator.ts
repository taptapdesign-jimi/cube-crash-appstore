import { gsap } from 'gsap';
import {
  getJourneyV700EnterOffset,
  getJourneyV700MotionProfile,
  getJourneyV700UnitStagger,
} from './journey-v700-motion.js';

export interface JourneyWorldAnimationUnit {
  id: string;
  targets: HTMLElement[];
  clouds: HTMLElement[];
  enterDelayOffset?: number;
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

  public async enter(units: JourneyWorldAnimationUnit[], reducedMotion: boolean): Promise<void> {
    const liveUnits = this.getLiveUnits(units);
    if (!liveUnits.length) {
      this.phase = 'idle';
      return;
    }

    this.stop();
    this.phase = 'entering';
    const motion = getJourneyV700MotionProfile(reducedMotion);

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
        gsap.killTweensOf(unit.targets);
        unit.targets.forEach((target) => {
          target.style.visibility = 'visible';
          target.style.pointerEvents = 'none';
        });
        const tween = gsap.fromTo(unit.targets, {
          y: motion.enter.y,
          scale: motion.enter.scale,
          opacity: 0,
          visibility: 'visible',
        }, {
          y: 0,
          scale: 1,
          opacity: 1,
          visibility: 'visible',
          duration: motion.enter.duration,
          ease: motion.enter.ease,
          force3D: true,
          overwrite: true,
          onComplete: () => {
            unit.targets.forEach((target) => {
              this.finalizeEnterTarget(target);
            });
          },
        });
        // drag-core's Timeline.fromTo guard drops GSAP's position argument.
        // Timeline.add is not patched, so it preserves the exact short cascade.
        const irregularOffset = Number.isFinite(unit.enterDelayOffset)
          ? Number(unit.enterDelayOffset)
          : getJourneyV700EnterOffset(unit.id, index, reducedMotion);
        timeline.add(tween, motion.enter.baseDelay + irregularOffset);
      });
    });

    if (this.phase !== 'entering') return;
    liveUnits.forEach((unit) => {
      unit.targets.forEach((target) => this.finalizeEnterTarget(target));
    });
    this.phase = 'idle';
    this.startIdle(liveUnits, reducedMotion);
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

  private startIdle(units: JourneyWorldAnimationUnit[], reducedMotion: boolean): void {
    if (reducedMotion) return;

    units.forEach((unit, unitIndex) => {
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
        if (this.phase !== 'idle') return;
        const elapsed = gsap.ticker.time - startTime;
        const ramp = Math.min(1, elapsed / 0.8);
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
