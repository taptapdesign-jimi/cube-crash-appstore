import fs from 'node:fs';
import path from 'node:path';
import { resolveJourneyNewCardTapAction } from '../journey-new-card-input';

describe('Journey New Reward rapid-tap handoff', () => {
  test('buffers a collect tap during reveal and keeps settled taps collectible', () => {
    expect(resolveJourneyNewCardTapAction({
      revealed: false,
      revealRunning: false,
      resolved: false,
      disposed: false,
    })).toBe('reveal');
    expect(resolveJourneyNewCardTapAction({
      revealed: false,
      revealRunning: true,
      resolved: false,
      disposed: false,
    })).toBe('queue-collect');
    expect(resolveJourneyNewCardTapAction({
      revealed: true,
      revealRunning: false,
      resolved: false,
      disposed: false,
    })).toBe('collect');
    expect(resolveJourneyNewCardTapAction({
      revealed: true,
      revealRunning: false,
      resolved: true,
      disposed: false,
    })).toBe('ignore');
  });

  test('hands early reveal ownership a full-size hero and consumes the queued collect once', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );
    const revealStart = source.slice(
      source.indexOf('const reveal = async () => {'),
      source.indexOf('const settleUnlockedCardAfterDrag = () => {'),
    );
    expect(revealStart).toContain('enterTimeline?.kill();');
    expect(revealStart).toMatch(/gsap\.set\(hero, \{[\s\S]*?opacity: 1,[\s\S]*?visibility: 'visible',[\s\S]*?scale: 1,/);
    expect(revealStart).toContain('if (collectRequestedDuringReveal) {');
    expect(revealStart).toContain('collectRequestedDuringReveal = false;');
    expect(revealStart).toContain('finish();');
    expect(source).toContain("if (action === 'queue-collect') {");
    expect(source).toContain('activeDragPointerId === null && revealRunning');
  });
});
