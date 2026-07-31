import {
  applyGameplayTextureFiltering,
  GAMEPLAY_TEXTURE_ADDRESS_MODE,
  GAMEPLAY_TEXTURE_ANISOTROPY,
  GAMEPLAY_TEXTURE_SCALE_MODE,
} from '../gameplay-texture-filtering.ts';

describe('gameplay texture filtering', () => {
  it('uses smooth linear sampling on Pixi v8 texture sources', () => {
    const source = {
      scaleMode: 'nearest',
      addressMode: 'repeat',
      mipmapFilter: 'nearest',
      autoGenerateMipmaps: false,
      style: { maxAnisotropy: 1 },
    };

    expect(applyGameplayTextureFiltering({ source })).toBe(true);
    expect(source.scaleMode).toBe('linear');
    expect(source.addressMode).toBe('clamp-to-edge');
    expect(source.mipmapFilter).toBe('linear');
    expect(source.autoGenerateMipmaps).toBe(true);
    expect(source.style.maxAnisotropy).toBe(2);
    expect(GAMEPLAY_TEXTURE_SCALE_MODE).toBe('linear');
    expect(GAMEPLAY_TEXTURE_ADDRESS_MODE).toBe('clamp-to-edge');
    expect(GAMEPLAY_TEXTURE_ANISOTROPY).toBe(2);
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
