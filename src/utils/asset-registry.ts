const REGISTRY_KEY = '__ccAssetAliasesRegistered';

function getRegistry(): Set<string> {
  const g = globalThis as any;
  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = new Set<string>();
  }
  return g[REGISTRY_KEY] as Set<string>;
}

export function isAssetAliasRegistered(alias: string): boolean {
  return getRegistry().has(alias);
}

export function markAssetAliasRegistered(alias: string): void {
  getRegistry().add(alias);
}
