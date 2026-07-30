export const GAMEPLAY_TEXTURE_SCALE_MODE = 'linear' as const;

type TextureSourceLike = {
  scaleMode?: string;
};

type TextureLike = {
  source?: TextureSourceLike | null;
  baseTexture?: TextureSourceLike | null;
} | null | undefined;

/**
 * Keep illustrated gameplay faces smooth while they move through fractional
 * positions/scales (for example during gyro motion). This only changes texture
 * sampling; renderer-wide antialiasing and shared texture ownership stay intact.
 */
export function applyGameplayTextureFiltering(texture: TextureLike): boolean {
  const source = texture?.source ?? texture?.baseTexture ?? null;
  if (!source) return false;

  source.scaleMode = GAMEPLAY_TEXTURE_SCALE_MODE;
  return true;
}
