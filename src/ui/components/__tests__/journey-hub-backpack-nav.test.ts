import fs from 'node:fs';
import path from 'node:path';

const mockPlayNavIconCartoonBounce = jest.fn();
jest.mock('../../../utils/nav-icon-bounce.js', () => ({
  playNavIconCartoonBounce: mockPlayNavIconCartoonBounce,
}));

import { createCollectiblesScreen } from '../collectibles-screen';
import { HTMLBuilder } from '../html-builder';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Journey Worlds Hub backpack navigation control', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('uses the live Journey nav backpack at the requested 40px size', () => {
    const screen = HTMLBuilder.createElement(createCollectiblesScreen());
    const button = screen.querySelector('#journey-hub-backpack') as HTMLButtonElement | null;
    const icon = button?.querySelector('img') as HTMLImageElement | null;
    const css = read('src/collectibles-screen.css');

    expect(button).not.toBeNull();
    expect(button?.hidden).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('Backpack');
    expect(icon?.getAttribute('src')).toBe('./assets/nav/stats-nav.png');
    expect(icon?.getAttribute('srcset')).toBe(
      './assets/nav/stats-nav@2x.png 2x, ./assets/nav/stats-nav@3x.png 3x',
    );
    expect(css).toMatch(/\.journey-hub-backpack-icon \{[\s\S]*?width: 40px;[\s\S]*?height: 40px;/);
    expect(css).toMatch(/\.journey-hub-backpack-button \{[\s\S]*?grid-column: 3;[\s\S]*?justify-self: end;[\s\S]*?margin-right: var\(--pad-right, 24px\);/);
  });

  test('uses the shared former-heart navigation bounce', () => {
    const screen = HTMLBuilder.createElement(createCollectiblesScreen());
    const button = screen.querySelector('#journey-hub-backpack') as HTMLButtonElement;

    button.click();
    expect(mockPlayNavIconCartoonBounce).toHaveBeenCalledWith(button);
    expect(read('src/ui/components/collectibles-screen.ts')).toContain(
      "import { playNavIconCartoonBounce } from '../../utils/nav-icon-bounce.js';",
    );
  });

  test('lets the canonical Journey nav owner show it only on the Hub', () => {
    const managerSource = read('src/modules/journey-boards-manager.ts');
    const navOwner = managerSource.split(
      "private updateJourneyV700Nav(view: 'hub' | 'world', worldId: number | null = null): void",
    )[1]?.split('private getJourneyV700NavTargets')[0] ?? '';

    expect(navOwner).toContain("document.getElementById('journey-hub-backpack')");
    expect(navOwner).toContain("hubBackpackButton.hidden = view !== 'hub';");
  });
});
