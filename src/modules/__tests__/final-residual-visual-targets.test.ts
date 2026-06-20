import {
  cleanupFinalGhostResidualTargets,
  collectFinalBoardTileResidualTargets,
  collectFinalGhostResidualTargets,
  collectFinalLockedResidualTargets,
  prepareFinalResidualTargets,
} from '../final-residual-visual-targets';

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

  it('collects unique ghost placeholders from rows', () => {
    const a = { scale: { x: 1, y: 1 } };
    const b = { scale: { x: 1, y: 1 } };
    expect(collectFinalGhostResidualTargets([[a, b], [a, { destroyed: true }]])).toEqual([a, b]);
  });

  it('prepares valid targets for pop-out animation', () => {
    const target = {
      alpha: 0,
      visible: false,
      renderable: false,
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
