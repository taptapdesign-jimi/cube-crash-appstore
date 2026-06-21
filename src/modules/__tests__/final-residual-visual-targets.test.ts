import {
  cleanupFinalGhostResidualTargets,
  collectFinalBoardTileResidualTargets,
  collectFinalGhostResidualTargets,
  collectFinalLockedResidualTargets,
  collectOrphanFinalBoardTileResidualTargets,
  prepareFinalResidualTargets,
} from '../final-residual-visual-targets';

const makeTarget = (overrides: Partial<any> = {}) => ({
  alpha: 1,
  scale: { x: 1, y: 1 },
  ...overrides,
});

describe('final-residual-visual-targets', () => {
  it('collects locked and inert value-zero tile residue only', () => {
    const locked = { locked: true, value: 0 };
    const inert = { locked: false, value: 0, eventMode: 'none' };
    const active = { locked: false, value: 4, eventMode: 'static' };
    const special = { locked: false, value: 0, special: 'wild-juice', eventMode: 'none' };
    const destroyed = { locked: true, value: 0, destroyed: true };

    expect(collectFinalLockedResidualTargets([locked, inert, active, special, destroyed])).toEqual([
      locked,
      inert,
    ]);
  });

  it('collects orphan final merge tile visuals from board children', () => {
    const known = makeTarget({ value: 3 });
    const orphanSix = makeTarget({ value: 6 });
    const orphanTnt = makeTarget({ special: 'wild-tnt' });
    const unrelatedFx = makeTarget({ value: 4, special: null });
    const root = {
      children: [
        known,
        unrelatedFx,
        { children: [orphanSix, orphanTnt] },
      ],
    };

    expect(collectOrphanFinalBoardTileResidualTargets({
      root,
      knownTiles: [known],
      maxDepth: 2,
    })).toEqual([orphanSix, orphanTnt]);
  });

  it('collects all remaining board tile visuals for final pop-out', () => {
    const activeMerge6 = { value: 6, locked: false, alpha: 1, scale: { x: 1, y: 1 } };
    const activeRegular = { value: 4, locked: false, alpha: 1, scale: { x: 1, y: 1 } };
    const locked = { value: 0, locked: true, alpha: 1, scale: { x: 1, y: 1 } };
    const destroyed = { value: 6, destroyed: true, alpha: 1, scale: { x: 1, y: 1 } };
    const notDisplayObject = { value: 2, alpha: 1 };

    expect(collectFinalBoardTileResidualTargets([activeMerge6, activeRegular, locked, destroyed, notDisplayObject])).toEqual([
      activeMerge6,
      activeRegular,
      locked,
    ]);
  });

  it('collects placeholder holders attached to final merge tiles', () => {
    const placeholder = { value: 0, locked: true, alpha: 0.35, scale: { x: 1, y: 1 } };
    const finalTile = {
      value: 6,
      locked: false,
      alpha: 0,
      scale: { x: 1, y: 1 },
      _placeholderHolder: placeholder,
    };

    expect(collectFinalBoardTileResidualTargets([finalTile])).toEqual([
      finalTile,
      placeholder,
    ]);
  });

  it('collects unique ghost placeholders from rows', () => {
    const a = { scale: { x: 1, y: 1 } };
    const b = { scale: { x: 1, y: 1 } };
    expect(collectFinalGhostResidualTargets([[a, b], [a, { destroyed: true }]])).toEqual([a, b]);
  });

  it('prepares valid targets for pop-out animation', () => {
    const target = {
      alpha: 0.2,
      visible: true,
      renderable: true,
      eventMode: 'static',
      scale: { x: 0, y: Number.NaN },
    };

    expect(prepareFinalResidualTargets([target, target, { alpha: 1 }])).toEqual([target]);
    expect(target.visible).toBe(true);
    expect(target.renderable).toBe(true);
    expect(target.eventMode).toBe('none');
    expect(target.alpha).toBe(0.22);
    expect(target.scale.x).toBe(1);
    expect(target.scale.y).toBe(1);
  });

  it('does not re-show hidden residual targets during final cleanup', () => {
    const hiddenGhost = {
      alpha: 1,
      visible: false,
      renderable: true,
      eventMode: 'static',
      scale: { x: 1, y: 1 },
    };
    const hiddenLocked = {
      value: 0,
      locked: true,
      alpha: 0,
      visible: true,
      renderable: true,
      eventMode: 'static',
      scale: { x: 1, y: 1 },
    };

    expect(prepareFinalResidualTargets([hiddenGhost, hiddenLocked])).toEqual([]);
    expect(hiddenGhost.visible).toBe(false);
    expect(hiddenGhost.renderable).toBe(false);
    expect(hiddenGhost.alpha).toBe(0);
    expect(hiddenLocked.visible).toBe(false);
    expect(hiddenLocked.renderable).toBe(false);
    expect(hiddenLocked.alpha).toBe(0);
  });

  it('does not prepare final merge-6 tile visuals for pop-out', () => {
    const stackG = {
      destroy: jest.fn(),
    };
    const finalMerge6 = {
      value: 6,
      alpha: 1,
      visible: true,
      renderable: true,
      eventMode: 'static',
      scale: { x: 1, y: 1 },
      stackG,
    };
    const regular = {
      value: 4,
      alpha: 1,
      visible: true,
      renderable: true,
      eventMode: 'static',
      scale: { x: 1, y: 1 },
    };

    expect(prepareFinalResidualTargets([finalMerge6, regular])).toEqual([regular]);
    expect(finalMerge6.visible).toBe(false);
    expect(finalMerge6.renderable).toBe(false);
    expect(finalMerge6.alpha).toBe(0);
    expect(finalMerge6.eventMode).toBe('none');
    expect(stackG.destroy).toHaveBeenCalledWith({ children: true });
  });

  it('cleans ghost placeholders after pop-out', () => {
    const ghost = {
      visible: true,
      alpha: 0.2,
      scale: { set: jest.fn() },
    };

    cleanupFinalGhostResidualTargets([ghost]);
    expect(ghost.visible).toBe(false);
    expect(ghost.alpha).toBe(1);
    expect(ghost.scale.set).toHaveBeenCalledWith(1);
  });
});
