import {
  getIosResistedModalVerticalDelta,
  installGameplayOverlayModalDragMotion,
  installModalVerticalDragDismiss,
} from '../modal-vertical-drag-dismiss';

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event;
}

describe('modal vertical drag dismiss', () => {
  test('applies iOS resistance within a 30-percent-shorter viewport range', () => {
    const rect = { top: 120, bottom: 620, height: 500 } as DOMRect;
    const upward = getIosResistedModalVerticalDelta(-400, rect, 800);
    const downward = getIosResistedModalVerticalDelta(400, rect, 800);
    expect(upward).toBeCloseTo(-65.03, 2);
    expect(downward).toBeCloseTo(87.65, 2);
    expect(Math.abs(upward)).toBeLessThan(120 * 0.7);
    expect(downward).toBeLessThan(180 * 0.7);
    expect(getIosResistedModalVerticalDelta(0, rect, 800)).toBe(0);
  });

  test.each([[180, 80], [80, 180]])('commits both vertical directions', (fromY, toY) => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const onDismiss = jest.fn();
    const dispose = installModalVerticalDragDismiss(surface, { onDismiss });

    surface.dispatchEvent(pointer('pointerdown', 100, fromY));
    surface.dispatchEvent(pointer('pointermove', 102, toY));
    surface.dispatchEvent(pointer('pointerup', 102, toY));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    dispose();
  });

  test('rejects horizontal gestures and interactive controls', () => {
    const surface = document.createElement('div');
    const button = document.createElement('button');
    surface.appendChild(button);
    document.body.appendChild(surface);
    const onDismiss = jest.fn();
    const dispose = installModalVerticalDragDismiss(surface, { onDismiss });

    surface.dispatchEvent(pointer('pointerdown', 40, 100));
    surface.dispatchEvent(pointer('pointermove', 150, 120));
    surface.dispatchEvent(pointer('pointerup', 150, 120));
    button.dispatchEvent(pointer('pointerdown', 100, 180));
    button.dispatchEvent(pointer('pointerup', 100, 70));

    expect(onDismiss).not.toHaveBeenCalled();
    dispose();
  });

  test('reports live signed movement and snapback versus committed release', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const onDismiss = jest.fn();
    const onDragMove = jest.fn();
    const onDragEnd = jest.fn();
    const dispose = installModalVerticalDragDismiss(surface, {
      onDismiss,
      onDragMove,
      onDragEnd,
    });

    surface.dispatchEvent(pointer('pointerdown', 100, 180));
    surface.dispatchEvent(pointer('pointermove', 100, 150));
    surface.dispatchEvent(pointer('pointerup', 100, 150));
    surface.dispatchEvent(pointer('pointerdown', 100, 180, 2));
    surface.dispatchEvent(pointer('pointermove', 100, 80, 2));
    surface.dispatchEvent(pointer('pointerup', 100, 80, 2));

    expect(onDragMove).toHaveBeenNthCalledWith(1, -30);
    expect(onDragMove).toHaveBeenNthCalledWith(2, -100);
    expect(onDragEnd).toHaveBeenNthCalledWith(1, false);
    expect(onDragEnd).toHaveBeenNthCalledWith(2, true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    dispose();
  });

  test('never dismisses during movement and uses only the final release position', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const onDismiss = jest.fn();
    const onDragEnd = jest.fn();
    const dispose = installModalVerticalDragDismiss(surface, { onDismiss, onDragEnd });

    surface.dispatchEvent(pointer('pointerdown', 100, 200));
    surface.dispatchEvent(pointer('pointermove', 100, -200));
    expect(onDismiss).not.toHaveBeenCalled();
    surface.dispatchEvent(pointer('pointermove', 100, 190));
    surface.dispatchEvent(pointer('pointerup', 100, 190));

    expect(onDragEnd).toHaveBeenLastCalledWith(false);
    expect(onDismiss).not.toHaveBeenCalled();
    dispose();
  });

  test('shared gameplay motion follows the finger and restores after a short release', () => {
    jest.useFakeTimers();
    const surface = document.createElement('div');
    const motion = document.createElement('div');
    const idle = document.createElement('div');
    idle.className = 'cc-gameplay-modal-idle-shell';
    motion.appendChild(idle);
    surface.appendChild(motion);
    jest.spyOn(motion, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 600,
      height: 500,
      width: 300,
      left: 50,
      right: 350,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    });
    document.body.appendChild(surface);
    const onDismiss = jest.fn();
    const dispose = installGameplayOverlayModalDragMotion(surface, {
      motionElement: motion,
      onDismiss,
      restTiltDeg: 1,
    });

    surface.dispatchEvent(pointer('pointerdown', 100, 180));
    surface.dispatchEvent(pointer('pointermove', 100, 140));
    expect(motion.style.transform).toContain('translate3d(0, -20.40px, 0)');
    expect(idle.style.animationPlayState).toBe('paused');
    surface.dispatchEvent(pointer('pointerup', 100, 140));
    expect(motion.style.transform).toContain('translate3d(0, 0.00px, 0)');
    expect(motion.style.transition).toContain('280ms');
    jest.advanceTimersByTime(280);
    expect(idle.style.animationPlayState).toBe('');
    expect(onDismiss).not.toHaveBeenCalled();

    surface.dispatchEvent(pointer('pointerdown', 100, 180, 2));
    surface.dispatchEvent(pointer('pointermove', 100, -220, 2));
    expect(motion.style.transform).toContain('translate3d(0, -56.31px, 0)');
    expect(onDismiss).not.toHaveBeenCalled();
    surface.dispatchEvent(pointer('pointermove', 100, 170, 2));
    surface.dispatchEvent(pointer('pointerup', 100, 170, 2));
    expect(motion.style.transform).toContain('translate3d(0, 0.00px, 0)');
    expect(onDismiss).not.toHaveBeenCalled();

    surface.dispatchEvent(pointer('pointerdown', 100, 180, 3));
    surface.dispatchEvent(pointer('pointermove', 100, 400, 3));
    surface.dispatchEvent(pointer('pointercancel', 100, 400, 3));
    expect(motion.style.transform).toContain('translate3d(0, 0.00px, 0)');
    expect(onDismiss).not.toHaveBeenCalled();

    dispose();
    jest.useRealTimers();
  });
});
