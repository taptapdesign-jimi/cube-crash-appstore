import {
  applyGameplayTextureFiltering,
  GAMEPLAY_TEXTURE_SCALE_MODE,
} from '../gameplay-texture-filtering.ts';

describe('gameplay texture filtering', () => {
  it('uses smooth linear sampling on Pixi v8 texture sources', () => {
    const source = { scaleMode: 'nearest' };

    expect(applyGameplayTextureFiltering({ source })).toBe(true);
    expect(source.scaleMode).toBe('linear');
    expect(GAMEPLAY_TEXTURE_SCALE_MODE).toBe('linear');
  });

  it('supports the legacy baseTexture shape used by fallback texture paths', () => {
    const baseTexture = { scaleMode: 'nearest' };

    expect(applyGameplayTextureFiltering({ baseTexture })).toBe(true);
    expect(baseTexture.scaleMode).toBe('linear');
  });

  it('is safe when a texture has no usable source', () => {
    expect(applyGameplayTextureFiltering(null)).toBe(false);
    expect(applyGameplayTextureFiltering({})).toBe(false);
  });
});
