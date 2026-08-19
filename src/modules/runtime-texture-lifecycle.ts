/**
 * Releases a runtime-created Pixi texture and its global diagnostic ownership.
 * Asset-managed textures must not use this helper.
 */
export function destroyRuntimeTexture(texture: any): void {
  if (!texture) return;
  try {
    (window as any).__ccRuntimeTextures?.delete?.(texture);
  } catch {}
  try {
    texture.destroy?.(true);
  } catch {}
  // Keep the registry truthful even when a custom destroy implementation
  // throws after partially releasing its Pixi source.
  try {
    (window as any).__ccRuntimeTextures?.delete?.(texture);
  } catch {}
}
