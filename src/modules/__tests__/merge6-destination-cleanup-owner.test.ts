import {
  MERGE6_CLEANUP_TOKEN_KEY,
  Merge6DestinationCleanupOwner,
} from '../merge6-destination-cleanup-owner';

describe('Merge6DestinationCleanupOwner', () => {
  test('claims a visible destination without leaving it interactive', () => {
    const owner = new Merge6DestinationCleanupOwner();
    const tile: any = {
      destroyed: false,
      visible: true,
      eventMode: 'static',
      interactive: true,
      interactiveChildren: true,
      cursor: 'pointer',
    };

    const token = owner.claim(tile);

    expect(token).toEqual(expect.any(Number));
    expect(tile.visible).toBe(true);
    expect(tile.eventMode).toBe('none');
    expect(tile.interactive).toBe(false);
    expect(tile.interactiveChildren).toBe(false);
    expect(tile.cursor).toBe('default');
    expect(owner.owns(tile, token)).toBe(true);
    expect(owner.hasClaim(tile)).toBe(true);
  });

  test('a superseded callback cannot release a newer owner', () => {
    const owner = new Merge6DestinationCleanupOwner();
    const tile: any = { destroyed: false };
    const firstToken = owner.claim(tile);
    const secondToken = owner.claim(tile);

    expect(owner.release(tile, firstToken)).toBe(false);
    expect(owner.owns(tile, secondToken)).toBe(true);
    expect(owner.release(tile, secondToken)).toBe(true);
    expect(owner.hasClaim(tile)).toBe(false);
    expect(tile[MERGE6_CLEANUP_TOKEN_KEY]).toBeUndefined();
  });

  test('protect restores the input lock if a visual refresh rebinds the tile', () => {
    const owner = new Merge6DestinationCleanupOwner();
    const tile: any = { destroyed: false };
    const token = owner.claim(tile);
    tile.eventMode = 'static';
    tile.interactive = true;
    tile.cursor = 'pointer';

    expect(owner.protect(tile, token)).toBe(true);
    expect(tile.eventMode).toBe('none');
    expect(tile.interactive).toBe(false);
    expect(tile.cursor).toBe('default');
  });

  test('forget is idempotent for lifecycle teardown', () => {
    const owner = new Merge6DestinationCleanupOwner();
    const tile: any = { destroyed: false };
    owner.claim(tile);

    owner.forget(tile);
    owner.forget(tile);

    expect(tile[MERGE6_CLEANUP_TOKEN_KEY]).toBeUndefined();
  });
});
