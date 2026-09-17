/** @jest-environment jsdom */
import { cleanupJourneySmokeEffects } from '../journey-card-idle-bounce';
import { domElementPool } from '../dom-element-pool';

jest.mock('../drag-core', () => ({ getOriginalGsapTo: jest.fn(), getOriginalGsapTimeline: jest.fn() }));

test('smoke cleanup retires its old card before pooled div reuse and preserves overlap bookkeeping', () => {
  domElementPool.clear();
  const world = document.createElement('div');
  const card = document.createElement('div') as HTMLDivElement & { _smokeActive: boolean; _overlapSmokeContainers: HTMLElement[] };
  world.append(card);
  const smoke = domElementPool.acquire('div') as HTMLElement & { _sourceCard: HTMLElement | null };
  const otherSmoke = document.createElement('div');
  smoke.className = 'journey-card-smoke-container';
  smoke._sourceCard = card;
  card._smokeActive = true;
  card._overlapSmokeContainers = [smoke, otherSmoke];
  document.body.append(smoke);
  try {
    cleanupJourneySmokeEffects();
    expect(card._smokeActive).toBe(false);
    expect(card._overlapSmokeContainers).toEqual([otherSmoke]);
    expect(smoke.isConnected).toBe(false);
    const recycled = domElementPool.acquire('div') as typeof smoke;
    expect(recycled).toBe(smoke);
    expect(recycled._sourceCard).toBeNull();
    domElementPool.release(recycled);
  } finally {
    domElementPool.clear();
    document.body.innerHTML = '';
  }
});
