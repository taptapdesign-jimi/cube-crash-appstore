import fs from 'node:fs';
import path from 'node:path';
import { buildBeachScene } from '../scene-builders';
import { JIMI_BEACH_UNITS } from '../scene-catalog';

/** jsdom cannot prove native hit testing. This locks the CSS boundary whose
 * absence let scrolled z5 cards cover the fixed z5 header in real XCUITest. */
test('the scroll subtree has its own stacking context below the fixed navigation header', () => {
  const style = document.createElement('style');
  style.textContent = fs.readFileSync(path.resolve(__dirname, '../styles.css'), 'utf8');
  document.head.append(style);
  try {
    const rules = Array.from(style.sheet!.cssRules) as CSSStyleRule[];
    const declaration = (selector: string, property: string) => {
      const rule = rules.find(candidate => candidate.selectorText === selector);
      expect(rule).toBeDefined();
      return rule!.style.getPropertyValue(property).trim();
    };
    expect(declaration('.jimi-scroll', 'isolation')).toBe('isolate');
    const headerLevel = Number(declaration('.jimi-scene-header', 'z-index'));
    const scrollLevel = Number(declaration('.jimi-scroll', 'z-index')) || 0;
    expect(headerLevel).toBeGreaterThan(scrollLevel);
    // Containment must not solve navigation by suppressing art or map input.
    expect(declaration('.jimi-scroll', 'overflow-y')).toBe('auto');
    expect(declaration('.jimi-scroll', 'pointer-events')).not.toBe('none');
    expect(declaration('.jimi-scroll', 'transform')).toBe('');
  } finally { style.remove(); }
});

test('deep-scroll reproducer places the later z5 Stage04 card under the preview tap coordinate', () => {
  const root = buildBeachScene({});
  const header = root.querySelector<HTMLElement>('.jimi-scene-header')!;
  const scroll = root.querySelector<HTMLElement>('.jimi-scroll')!;
  const card = root.querySelector<HTMLElement>('.jimi-board-card[data-board-id="14"]')!;
  expect(header.parentElement).toBe(root);
  expect(scroll.parentElement).toBe(root);
  expect(header.compareDocumentPosition(scroll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(scroll.contains(card)).toBe(true);
  expect(card.style.zIndex).toBe('5');

  const unit = JIMI_BEACH_UNITS.find(candidate => candidate.boardId === 14)!;
  const scrollTop = 765;
  const centerX = unit.x + unit.card.x + unit.card.width / 2;
  const centerY = unit.y + unit.card.y - scrollTop + unit.card.height / 2;
  const angle = unit.card.rotation * Math.PI / 180;
  const dx = 288 - centerX;
  const dy = 67 - centerY;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  expect(Math.abs(localX)).toBeLessThan(unit.card.width / 2);
  expect(Math.abs(localY)).toBeLessThan(unit.card.height / 2);
});
