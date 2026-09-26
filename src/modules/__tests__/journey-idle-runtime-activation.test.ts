/** @jest-environment jsdom */

import {
  captureJourneyIdleRuntimeSuspension,
  isJourneyRuntimeTargetNearViewport,
  shouldSuspendJourneyUnitIdlePaint,
  updateJourneyIdleRuntimeActivation,
} from '../journey-idle-runtime-activation';
import { readJourneyRenderedTransformAxis } from '../journey-world-animation-coordinator';

describe('Journey idle runtime activation handoff', () => {
  test('culls zero-size and offscreen interim work while keeping the near viewport margin', () => {
    const viewport = { top: 0, bottom: 800, left: 0, right: 390 };
    expect(isJourneyRuntimeTargetNearViewport(
      { top: 820, bottom: 970, left: 40, right: 150, width: 110, height: 150 },
      viewport,
      160,
    )).toBe(true);
    expect(isJourneyRuntimeTargetNearViewport(
      { top: 1200, bottom: 1350, left: 40, right: 150, width: 110, height: 150 },
      viewport,
      160,
    )).toBe(false);
    expect(isJourneyRuntimeTargetNearViewport(
      { top: 100, bottom: 100, left: 40, right: 40, width: 0, height: 0 },
      viewport,
    )).toBe(false);
  });

  test('reads the painted matrix instead of a stale animation-library translation cache', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    target.style.transform = 'matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 0, 0)';
    expect(readJourneyRenderedTransformAxis(target, 'x')).toBe(0);
    expect(readJourneyRenderedTransformAxis(target, 'y')).toBe(0);

    target.style.transform = 'matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 0, -4.16)';
    expect(readJourneyRenderedTransformAxis(target, 'y')).toBe(-4.16);
  });

  test('rebases a budget-suspended Unit from its current pose before idle resumes', () => {
    const target = document.createElement('div');
    const entry = {
      runtimeActive: false,
      startTime: 12,
      suspendedRebasePending: false,
      targetStates: [{ target, initialX: 1, initialY: 2 }],
    };

    const rebased = updateJourneyIdleRuntimeActivation(
      entry,
      true,
      20,
      false,
      (_target, axis) => axis === 'x' ? 7.5 : -4.25,
    );

    expect(rebased).toBe(true);
    expect(entry).toMatchObject({
      runtimeActive: true,
      startTime: 20,
      suspendedRebasePending: false,
      targetStates: [{ initialX: 7.5, initialY: -4.25 }],
    });
  });

  test('does not restart an already-active Unit or mutate a deactivated Unit', () => {
    const target = document.createElement('div');
    const entry = {
      runtimeActive: true,
      startTime: 12,
      suspendedRebasePending: false,
      targetStates: [{ target, initialX: 1, initialY: 2 }],
    };
    const readTransform = jest.fn(() => 99);

    expect(updateJourneyIdleRuntimeActivation(entry, true, 20, false, readTransform)).toBe(false);
    expect(updateJourneyIdleRuntimeActivation(entry, false, 21, false, readTransform)).toBe(false);
    expect(readTransform).not.toHaveBeenCalled();
    expect(entry).toMatchObject({ runtimeActive: false, startTime: 12 });
  });

  test('records a suspended rebase for the scheduler resume boundary', () => {
    const target = document.createElement('div');
    const entry = {
      runtimeActive: false,
      startTime: 1,
      suspendedRebasePending: false,
      targetStates: [{ target, initialX: 0, initialY: 0 }],
    };

    updateJourneyIdleRuntimeActivation(entry, true, 5, true, () => 0);

    expect(entry.suspendedRebasePending).toBe(true);
  });

  test('freezes the last painted pose for every active Unit before scroll suspension', () => {
    const target = document.createElement('div');
    const entry = {
      runtimeActive: true,
      startTime: 12,
      suspendedRebasePending: false,
      targetStates: [{ target, initialX: 1, initialY: 2 }],
    };

    expect(captureJourneyIdleRuntimeSuspension(entry, (_target, axis) => (
      axis === 'x' ? 1.25 : -2.75
    ))).toBe(true);
    expect(entry.suspendedRebasePending).toBe(true);
    expect(entry.targetStates[0]).toMatchObject({ initialX: 1.25, initialY: -2.75 });

    expect(captureJourneyIdleRuntimeSuspension(entry, () => 99)).toBe(false);
    expect(entry.targetStates[0].initialY).toBe(-2.75);
  });

  test('does not mutate a budget-inactive Unit during scroll suspension', () => {
    const target = document.createElement('div');
    const entry = {
      runtimeActive: false,
      startTime: 12,
      suspendedRebasePending: false,
      targetStates: [{ target, initialX: 1, initialY: 2 }],
    };

    expect(captureJourneyIdleRuntimeSuspension(entry, () => 99)).toBe(false);
    expect(entry).toMatchObject({ suspendedRebasePending: false });
    expect(entry.targetStates[0]).toMatchObject({ initialX: 1, initialY: 2 });
  });

  test('keeps bounded Unit idle paint continuous through scroll and its settle tail', () => {
    expect(shouldSuspendJourneyUnitIdlePaint({
      paintSuspended: true,
      ambientScrollBoosted: true,
    })).toBe(false);
    expect(shouldSuspendJourneyUnitIdlePaint({
      paintSuspended: false,
      ambientScrollBoosted: false,
    })).toBe(false);
  });

  test('still suspends Unit idle for transitions, modals and teardown', () => {
    expect(shouldSuspendJourneyUnitIdlePaint({
      paintSuspended: true,
      ambientScrollBoosted: false,
    })).toBe(true);
  });
});
