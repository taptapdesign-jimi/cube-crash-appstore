import fs from 'node:fs';
import ts from 'typescript';

const parsed = ts.createSourceFile(
  'fx.ts',
  fs.readFileSync('src/modules/fx.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const functionNames = new Set([
  'makeLinearGradientTexture',
  'isWildShimmerTextureUsable',
  'pruneWildShimmerTextureCache',
  'acquireWildShimmerTexture',
  'releaseTileWildShimmerTexture',
  'getWildShimmerTextureCacheSnapshot',
  'destroyWildShimmerTextureCache',
  'stopWildShimmer',
  'stopWildIdle',
]);
const selectedSource = parsed.statements
  .filter((node) => {
    if (ts.isFunctionDeclaration(node)) return functionNames.has(node.name?.text || '');
    if (!ts.isVariableStatement(node)) return false;
    return node.declarationList.declarations.some((declaration) => {
      const name = ts.isIdentifier(declaration.name) ? declaration.name.text : '';
      return name === 'MAX_WILD_SHIMMER_TEXTURE_CACHE_ENTRIES' || name === 'wildShimmerTextureCache';
    });
  })
  .map((node) => node.getText(parsed).replace(/^export /, ''))
  .join('\n');

function createOwners() {
  const textures: any[] = [];
  const Texture = {
    from: jest.fn(() => {
      const texture = {
        destroyed: false,
        source: { destroyed: false },
        destroy: jest.fn(function destroy(this: any) {
          this.destroyed = true;
          this.source.destroyed = true;
        }),
      };
      textures.push(texture);
      return texture;
    }),
  };
  const gradient = { addColorStop: jest.fn() };
  const context = {
    createLinearGradient: jest.fn(() => gradient),
    fillRect: jest.fn(),
    set fillStyle(_value: any) {},
  };
  const originalCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    const element = originalCreateElement(tagName);
    if (tagName.toLowerCase() === 'canvas') {
      Object.defineProperty(element, 'getContext', { value: () => context });
    }
    return element;
  }) as typeof document.createElement);

  const runtimeTextures = new Set<any>();
  (window as any).__ccRuntimeTextures = runtimeTextures;
  const destroyRuntimeTexture = jest.fn((texture: any) => {
    runtimeTextures.delete(texture);
    texture.destroy(true);
  });
  const dependencies = {
    Texture,
    destroyRuntimeTexture,
    animationManager: {
      killExternalTimeline: jest.fn(),
      killExternalTween: jest.fn(),
    },
    gsap: { killTweensOf: jest.fn() },
    stopWildStars: jest.fn(),
    __globalDelayedCalls: new Set(),
  };
  const transpiled = ts.transpileModule(selectedSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const ownerNames = [...functionNames];
  const owners = new Function(
    ...Object.keys(dependencies),
    `${transpiled}; return { ${ownerNames.join(',')} };`,
  )(...Object.values(dependencies));
  return { owners, Texture, textures, destroyRuntimeTexture };
}

describe('Wild shimmer shared texture lifecycle', () => {
  afterEach(() => {
    delete (window as any).__ccRuntimeTextures;
    jest.restoreAllMocks();
  });

  test('two tiles share one texture and either stop owner releases only its own lease', () => {
    const { owners, Texture, textures, destroyRuntimeTexture } = createOwners();
    const stops = [{ o: 0, c: 'transparent' }, { o: 1, c: 'white' }];
    const firstLease = owners.acquireWildShimmerTexture(192, 192, stops);
    const secondLease = owners.acquireWildShimmerTexture(192, 192, stops);
    const firstTile: any = {
      _wildShimmerTexture: firstLease.texture,
      _wildShimmerTextureRelease: firstLease.release,
    };
    const secondTile: any = {
      _wildShimmerTexture: secondLease.texture,
      _wildShimmerTextureRelease: secondLease.release,
    };

    expect(Texture.from).toHaveBeenCalledTimes(1);
    expect(firstLease.texture).toBe(secondLease.texture);
    expect(owners.getWildShimmerTextureCacheSnapshot()[0].refs).toBe(2);

    owners.stopWildShimmer(firstTile);
    expect(owners.getWildShimmerTextureCacheSnapshot()[0].refs).toBe(1);
    expect(textures[0].destroy).not.toHaveBeenCalled();

    owners.stopWildIdle(secondTile);
    owners.stopWildIdle(secondTile);
    expect(owners.getWildShimmerTextureCacheSnapshot()[0].refs).toBe(0);
    expect(textures[0].destroy).not.toHaveBeenCalled();
    expect(destroyRuntimeTexture).not.toHaveBeenCalled();
  });

  test('restart reuses the released texture and cache teardown waits for the final lease', () => {
    const { owners, Texture, textures, destroyRuntimeTexture } = createOwners();
    const stops = [{ o: 0, c: 'transparent' }, { o: 1, c: 'white' }];
    const first = owners.acquireWildShimmerTexture(192, 192, stops);
    const second = owners.acquireWildShimmerTexture(192, 192, stops);
    const firstTile: any = { _wildShimmerTexture: first.texture, _wildShimmerTextureRelease: first.release };
    const secondTile: any = { _wildShimmerTexture: second.texture, _wildShimmerTextureRelease: second.release };

    owners.stopWildShimmer(firstTile);
    owners.destroyWildShimmerTextureCache();
    expect(textures[0].destroy).not.toHaveBeenCalled();

    owners.stopWildIdle(secondTile);
    const restarted = owners.acquireWildShimmerTexture(192, 192, stops);
    expect(restarted.texture).toBe(textures[0]);
    expect(Texture.from).toHaveBeenCalledTimes(1);
    expect(owners.getWildShimmerTextureCacheSnapshot()[0].refs).toBe(1);

    restarted.release();
    restarted.release();
    owners.destroyWildShimmerTextureCache();
    expect(destroyRuntimeTexture).toHaveBeenCalledTimes(1);
    expect(textures[0].destroy).toHaveBeenCalledTimes(1);
    expect(owners.getWildShimmerTextureCacheSnapshot()).toEqual([]);
  });

  test('replaces a texture invalidated by the global runtime cleanup', () => {
    const { owners, Texture, textures } = createOwners();
    const stops = [{ o: 0, c: 'transparent' }, { o: 1, c: 'white' }];
    const first = owners.acquireWildShimmerTexture(192, 192, stops);
    first.release();
    textures[0].destroy(true);

    const replacement = owners.acquireWildShimmerTexture(192, 192, stops);
    expect(Texture.from).toHaveBeenCalledTimes(2);
    expect(replacement.texture).toBe(textures[1]);
    expect(owners.getWildShimmerTextureCacheSnapshot()).toHaveLength(1);
    replacement.release();
  });

  test('prunes the oldest released size while preserving four live cache entries', () => {
    const { owners, destroyRuntimeTexture } = createOwners();
    const stops = [{ o: 0, c: 'transparent' }, { o: 1, c: 'white' }];
    const leases = [128, 160, 192, 224, 256]
      .map((size) => owners.acquireWildShimmerTexture(size, size, stops));
    expect(owners.getWildShimmerTextureCacheSnapshot()).toHaveLength(5);

    leases[0].release();
    expect(owners.getWildShimmerTextureCacheSnapshot()).toHaveLength(4);
    expect(destroyRuntimeTexture).toHaveBeenCalledTimes(1);
    expect(owners.getWildShimmerTextureCacheSnapshot().map((entry: any) => entry.key))
      .not.toContain('128x128');
    leases.slice(1).forEach((lease) => lease.release());
  });
});
