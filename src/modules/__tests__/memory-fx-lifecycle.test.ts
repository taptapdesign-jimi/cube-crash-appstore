import fs from 'node:fs';
import path from 'node:path';
import gameState from '../game-state';
import { MemoryManager } from '../memory-manager';
import { destroyRuntimeTexture } from '../runtime-texture-lifecycle';

const repoRoot = path.resolve(__dirname, '../../..');

describe('memory and runtime FX lifecycle ownership', () => {
  afterEach(() => {
    jest.useRealTimers();
    delete (window as any).__ccRuntimeTextures;
    jest.restoreAllMocks();
  });

  test('generic memory cleanup never removes loading DOM images', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'src/modules/memory-manager.ts'),
      'utf8',
    );
    expect(source).not.toContain("document.querySelectorAll('img')");
    expect(source).not.toContain('cleanupUnusedImages');

    const loadingImage = document.createElement('img');
    document.body.appendChild(loadingImage);
    const manager = new MemoryManager();
    manager.init();
    manager.performCleanup();
    manager.destroy();

    expect(document.body.contains(loadingImage)).toBe(true);
    loadingImage.remove();
  });

  test('stop performs final cleanup and restart owns exactly one state subscription', () => {
    jest.useFakeTimers();
    const unsubscribeFirst = jest.fn();
    const unsubscribeSecond = jest.fn();
    const subscribe = jest.spyOn(gameState, 'subscribe')
      .mockReturnValueOnce(unsubscribeFirst)
      .mockReturnValueOnce(unsubscribeSecond);
    const manager = new MemoryManager();

    manager.init();
    manager.registerObject('destroyed', { destroyed: true } as any);
    manager.stop();

    expect(manager.getMemoryInfo().trackedObjects).toBe(0);
    expect(unsubscribeFirst).toHaveBeenCalledTimes(1);

    manager.init();
    manager.stop();
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(unsubscribeSecond).toHaveBeenCalledTimes(1);
  });

  test('destroying a shimmer runtime texture unregisters it even if destroy throws', () => {
    const destroy = jest.fn(() => {
      throw new Error('partial Pixi destroy');
    });
    const texture = { destroy };
    const registry = new Set<any>([texture]);
    (window as any).__ccRuntimeTextures = registry;

    expect(() => destroyRuntimeTexture(texture)).not.toThrow();
    expect(destroy).toHaveBeenCalledWith(true);
    expect(registry.has(texture)).toBe(false);
  });

  test('both shimmer stop owners release the registered runtime texture', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/fx.ts'), 'utf8');
    expect(source).toContain("import { destroyRuntimeTexture } from './runtime-texture-lifecycle.ts';");
    const shimmerStop = source.slice(
      source.indexOf('export function stopWildShimmer'),
      source.indexOf('export function startMagnetIdleParticles'),
    );
    const idleStop = source.slice(
      source.indexOf('export function stopWildIdle'),
    );

    expect(shimmerStop).toContain('destroyRuntimeTexture(tile._wildShimmerTexture);');
    expect(idleStop).toContain('destroyRuntimeTexture(tile._wildShimmerTexture);');
  });

  test('Juice bubble screen cache unregisters its generated runtime texture', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'src/modules/wild-juice-bubbles-screen.ts'),
      'utf8',
    );
    expect(source).toContain("import { destroyRuntimeTexture } from './runtime-texture-lifecycle.js';");
    const destroyStart = source.indexOf('export function destroyWildJuiceBubblesScreenCache');
    const destroyEnd = source.indexOf('export function isWildJuiceBubblesActive', destroyStart);
    const destroyOwner = source.slice(destroyStart, destroyEnd);
    expect(destroyOwner).toContain('destroyRuntimeTexture(_cachedBubbleTexture)');
    expect(destroyOwner).not.toContain('_cachedBubbleTexture.destroy(');
  });
});
