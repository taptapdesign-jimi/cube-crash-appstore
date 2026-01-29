import type { Tile } from '../types/game-types.js';
import { tileIsActive } from './endgame-checker.ts';

export function getReactiveActiveTiles(tiles: Tile[]): Tile[] {
  return tiles.filter(tileIsActive);
}

export function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.hasAttribute('hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  return true;
}

export function getScreenVisibility() {
  const appEl = document.getElementById('app') as HTMLElement | null;
  const homeEl = document.getElementById('home') as HTMLElement | null;
  const journeyEl = document.getElementById('journey-screen') as HTMLElement | null;
  return {
    appVisible: isElementVisible(appEl),
    homeVisible: isElementVisible(homeEl),
    journeyVisible: isElementVisible(journeyEl),
  };
}
