import fs from 'node:fs';
import ts from 'typescript';

const dragSource = fs.readFileSync('src/modules/drag-core.ts', 'utf8');

function createReleaseOwners() {
  const start = dragSource.indexOf('  function clearMagnetFieldTileState');
  const end = dragSource.indexOf('  function clearDragRuntime', start);
  const helperSource = dragSource.slice(start, end);
  const drag = { _magnetFieldTiles: new Set<any>(), _magnetFieldCandidates: [] as any[] };
  const tweens: any[] = [];
  const trackTween = jest.fn((target: any, vars: any) => {
    const tween = { target, vars, kill: jest.fn() };
    tweens.push(tween);
    return tween;
  });
  const transpiled = ts.transpileModule(helperSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const owners = new Function(
    'drag',
    'trackTween',
    'MAGNET_RETURN_DUR',
    'MAGNET_SCALE_MULT',
    'MAGNET_IN_DUR',
    `${transpiled}; return { resumeMagnetFieldTile, releaseMagnetFieldTile, releaseMagnetFieldTiles };`,
  )(drag, trackTween, 0.18, 1.08, 0.15);
  return { drag, owners, trackTween, tweens };
}

describe('Wild Magnet drag hot path', () => {
  test('repeated release does not create duplicate return tweens', () => {
    const { drag, owners, trackTween, tweens } = createReleaseOwners();
    const scale = { x: 1.08, y: 1.08, set: jest.fn() };
    const tile: any = {
      x: 12,
      y: 14,
      _magnetHomeX: 10,
      _magnetHomeY: 10,
      _magnetSelected: true,
      _magnetState: {
        originX: 10,
        originY: 10,
        originScaleX: 1,
        originScaleY: 1,
        container: { scale },
        moveTween: null,
        scaleTween: null,
        returning: false,
      },
    };
    drag._magnetFieldTiles.add(tile);

    owners.releaseMagnetFieldTile(tile);
    owners.releaseMagnetFieldTile(tile);
    expect(trackTween).toHaveBeenCalledTimes(2);
    expect(tweens[0].vars).toMatchObject({ x: 10, y: 10 });

    tweens[0].vars.onComplete();
    expect(tile._magnetState).toBeNull();
    expect(tile._magnetSelected).toBe(false);
    expect(drag._magnetFieldTiles.size).toBe(0);
  });

  test('immediate restart cleanup restores every tracked tile and clears the snapshot', () => {
    const { drag, owners, trackTween } = createReleaseOwners();
    const makeTile = (x: number) => {
      const scale = { set: jest.fn() };
      const tile: any = {
        x: x + 2,
        y: 8,
        _magnetHomeX: x,
        _magnetHomeY: 5,
        _magnetSelected: true,
        _magnetState: {
          originX: x,
          originY: 5,
          originScaleX: 1,
          originScaleY: 1,
          container: { scale },
          moveTween: { kill: jest.fn() },
          scaleTween: { kill: jest.fn() },
          returning: true,
        },
      };
      return { tile, scale };
    };
    const first = makeTile(10);
    const second = makeTile(20);
    drag._magnetFieldTiles.add(first.tile);
    drag._magnetFieldTiles.add(second.tile);
    drag._magnetFieldCandidates = [first.tile, second.tile];

    owners.releaseMagnetFieldTiles({ immediate: true });
    expect(trackTween).not.toHaveBeenCalled();
    expect(drag._magnetFieldCandidates).toEqual([]);
    expect(drag._magnetFieldTiles.size).toBe(0);
    expect(first.tile).toMatchObject({ x: 10, y: 5, _magnetState: null, _magnetSelected: false });
    expect(second.tile).toMatchObject({ x: 20, y: 5, _magnetState: null, _magnetSelected: false });
    expect(first.scale.set).toHaveBeenCalledWith(1, 1);
    expect(second.scale.set).toHaveBeenCalledWith(1, 1);
  });

  test('re-entering during return kills the stale owner and forces a fresh pull destination', () => {
    const { owners, trackTween } = createReleaseOwners();
    const oldMove = { kill: jest.fn() };
    const oldScale = { kill: jest.fn() };
    const scale = { x: 1, y: 1 };
    const state: any = {
      returning: true,
      moveTween: oldMove,
      scaleTween: oldScale,
      destX: 42,
      destY: 24,
      originScaleX: 1,
      originScaleY: 1,
      container: { scale },
    };

    owners.resumeMagnetFieldTile(state);

    expect(oldMove.kill).toHaveBeenCalledTimes(1);
    expect(oldScale.kill).toHaveBeenCalledTimes(1);
    expect(state).toMatchObject({ returning: false, moveTween: null });
    expect(state.destX).toBeUndefined();
    expect(state.destY).toBeUndefined();
    expect(trackTween).toHaveBeenCalledWith(scale, expect.objectContaining({ x: 1.08, y: 1.08 }));
  });

  test('move frames reuse one candidate snapshot, skip the discarded resolver, and emit entry sparkle once', () => {
    const processStart = dragSource.indexOf('  function processMove');
    const processEnd = dragSource.indexOf('\n  function onMove', processStart);
    const processMove = dragSource.slice(processStart, processEnd);
    expect(dragSource).toContain("drag._magnetFieldCandidates = t.special === 'wild-magnet'");
    expect(processMove).toContain('const allTiles = drag._magnetFieldCandidates;');
    expect(processMove).toContain("const target = t.special === 'wild-magnet'");
    expect(processMove).toContain('? null');
    expect(processMove).toContain('state.moveTween.resetTo');
    expect(processMove).toContain('resumeMagnetFieldTile(state)');
    expect(processMove).toContain('if (!otherTile._magnetSelected)');
    expect(processMove).not.toContain("typeof getTiles === 'function' ? getTiles() : []");
    expect(processMove).not.toContain('now - (otherTile._magnetSelectedTime || 0)');
  });
});
