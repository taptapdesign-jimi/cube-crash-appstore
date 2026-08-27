import fs from 'node:fs';
import path from 'node:path';

const tutorialSource = fs.readFileSync(
  path.resolve(__dirname, '../first-play-tutorial.ts'),
  'utf8',
);
const dragSource = fs.readFileSync(
  path.resolve(__dirname, '../drag-core.ts'),
  'utf8',
);

describe('first-play tutorial guided drag pointer contract', () => {
  test('hides the guide only after drag ownership is acquired', () => {
    const acquiredAt = dragSource.indexOf('drag.t = t;');
    const notifyAt = dragSource.indexOf('__ccFirstPlayTutorialDragStarted?.(t)');

    expect(acquiredAt).toBeGreaterThan(-1);
    expect(notifyAt).toBeGreaterThan(acquiredAt);
    expect(tutorialSource).toContain('if (!isCurrentGuidedDragTile(tile)) return;');
    expect(tutorialSource).toContain("pointer.style.display = 'none';");
  });

  test('restores the current guide only after snap-back completes', () => {
    const snapBackComplete = dragSource.indexOf('onSnapBackComplete?.(t)');
    const returnedAt = dragSource.indexOf('__ccFirstPlayTutorialDragReturned?.(t)');

    expect(snapBackComplete).toBeGreaterThan(-1);
    expect(returnedAt).toBeGreaterThan(snapBackComplete);
    expect(tutorialSource).toContain('owner.tile !== tile || owner.step !== currentStep');
    expect(tutorialSource).toContain('if (currentStep === 4)');
    expect(tutorialSource).toContain('startStepFourPointerHint();');
    expect(tutorialSource).toContain('popInPointer();');
  });

  test('removes both drag hooks when tutorial ownership ends', () => {
    expect(tutorialSource).toContain('delete (window as any).__ccFirstPlayTutorialDragStarted;');
    expect(tutorialSource).toContain('delete (window as any).__ccFirstPlayTutorialDragReturned;');
  });
});
