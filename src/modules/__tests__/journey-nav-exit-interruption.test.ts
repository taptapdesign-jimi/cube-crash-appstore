/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = fs.readFileSync(path.resolve(__dirname, '../journey-boards-manager.ts'), 'utf8');
const start = source.indexOf('\t  private playJourneyV700NavExit()');
const end = source.indexOf('\t\t  private playJourneyV700NavEnter', start);
const method = source.slice(start, end);
const js = ts.transpileModule(`class NavExitProbe { ${method} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;

describe('Journey nav exit interruption', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="journey-screen">
        <header class="collectibles-header"></header>
        <div id="journey-boards-container"></div>
      </section>
    `;
    (window as any).matchMedia = jest.fn(() => ({ matches: false }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).matchMedia;
  });

  test('a killed GSAP tween resolves immediately instead of waiting for the watchdog', async () => {
    let tweenVars: Record<string, (...args: unknown[]) => void> = {};
    const gsap = {
      killTweensOf: jest.fn(),
      set: jest.fn(),
      to: jest.fn((_targets: HTMLElement[], vars: typeof tweenVars) => {
        tweenVars = vars;
        return {};
      }),
    };
    const clearTrackedTimeout = jest.fn();
    const Probe = new Function(
      'getJourneyV700MotionProfile',
      'gsap',
      `${js}; return NavExitProbe;`,
    )(
      () => ({ exit: { duration: 0.4, ease: 'power2.in' } }),
      gsap,
    );
    const owner = new Probe();
    Object.assign(owner, {
      getJourneyV700NavTargets: () => [document.querySelector('.collectibles-header')],
      logJourneyV700Flow: jest.fn(),
      trackTimeout: jest.fn(() => 73),
      clearTrackedTimeout,
    });

    const completion = owner.playJourneyV700NavExit();
    let resolved = false;
    void completion.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    tweenVars.onInterrupt();
    await completion;

    expect(resolved).toBe(true);
    expect(clearTrackedTimeout).toHaveBeenCalledWith(73);
    expect(owner.logJourneyV700Flow).toHaveBeenCalledWith(
      'nav-exit-complete',
      expect.objectContaining({ source: 'tween-interrupt' }),
      expect.anything(),
    );
  });
});

