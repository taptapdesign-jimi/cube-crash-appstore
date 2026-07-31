export const GAMEPLAY_TEXTURE_SCALE_MODE = 'linear' as const;
export const GAMEPLAY_TEXTURE_ADDRESS_MODE = 'clamp-to-edge' as const;
export const GAMEPLAY_TEXTURE_ANISOTROPY = 2;

type TextureSourceLike = {
  scaleMode?: string;
  addressMode?: string;
  mipmapFilter?: string;
  autoGenerateMipmaps?: boolean;
  style?: {
    maxAnisotropy?: number;
  } | null;
};

type TextureLike = {
  source?: TextureSourceLike | null;
  baseTexture?: TextureSourceLike | null;
} | null | undefined;

/**
 * Keep illustrated gameplay faces smooth while they move through fractional
 * positions/scales (for example during gyro motion). Mipmaps stabilize the
 * heavily downscaled cube art, clamp-to-edge prevents opposite-edge sampling,
 * and low anisotropy keeps gently rotated stack faces readable.
 */
export function applyGameplayTextureFiltering(texture: TextureLike): boolean {
  const source = texture?.source ?? texture?.baseTexture ?? null;
  if (!source) return false;

  source.addressMode = GAMEPLAY_TEXTURE_ADDRESS_MODE;
  source.autoGenerateMipmaps = true;
  source.scaleMode = GAMEPLAY_TEXTURE_SCALE_MODE;
  source.mipmapFilter = GAMEPLAY_TEXTURE_SCALE_MODE;
  if (source.style) source.style.maxAnisotropy = GAMEPLAY_TEXTURE_ANISOTROPY;
  return true;
}
