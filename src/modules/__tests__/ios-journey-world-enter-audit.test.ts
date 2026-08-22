import fs from 'node:fs';
import path from 'node:path';
import { summarizeJourneyWorldEnterFrames } from '../../utils/ios-journey-world-enter-audit.js';

const root = path.resolve(__dirname, '../../..');
const nativeDiagnosticSource = fs.readFileSync(
  path.join(root, 'src/utils/ios-native-diagnostic.ts'),
  'utf8',
);
const journeyAuditSource = fs.readFileSync(
  path.join(root, 'src/utils/ios-journey-world-enter-audit.ts'),
  'utf8',
);

describe('Journey world enter performance audit', () => {
  it('summarizes frame pressure without allowing invalid or unbounded samples', () => {
    expect(summarizeJourneyWorldEnterFrames([16, 17, 21, 35, 78, Number.NaN, 900])).toEqual({
      count: 6,
      averageMs: 69.5,
      worstMs: 250,
      over20: 4,
      over34: 3,
      over50: 2,
    });
  });

  it('returns a stable empty summary', () => {
    expect(summarizeJourneyWorldEnterFrames([])).toEqual({
      count: 0,
      averageMs: 0,
      worstMs: 0,
      over20: 0,
      over34: 0,
      over50: 0,
    });
  });

  it('keeps transition markers free of forced style reads and labels both ends of a slow interval', () => {
    expect(nativeDiagnosticSource).not.toContain('getComputedStyle(screen)');
    expect(nativeDiagnosticSource).toContain('display: screen.style.display || null');
    expect(journeyAuditSource).not.toContain('getComputedStyle(element)');
    expect(journeyAuditSource).toContain('activeCssAnimations: -1');
    expect(journeyAuditSource).toContain('intervalStartMarker');
    expect(journeyAuditSource).toContain('intervalEndMarker');
    expect(journeyAuditSource).toContain('marker: intervalStartMarker');
  });
});
