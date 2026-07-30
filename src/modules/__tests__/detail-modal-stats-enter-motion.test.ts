import fs from 'node:fs';
import path from 'node:path';
import {
  createDetailModalStatsEnterDelays,
  DETAIL_MODAL_STATS_ENTER_MOTION,
  getDetailModalStatsEnterTotalDuration,
} from '../detail-modal-stats-enter-motion';

describe('detail modal stats enter motion', () => {
  it('mirrors the accepted exit order with one equal beat per direct child', () => {
    expect(createDetailModalStatsEnterDelays(5)).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
  });

  it('uses the exact exit duration and relative stagger', () => {
    expect(DETAIL_MODAL_STATS_ENTER_MOTION.durationSeconds).toBe(0.4);
    expect(DETAIL_MODAL_STATS_ENTER_MOTION.staggerSeconds).toBe(0.05);
    expect(getDetailModalStatsEnterTotalDuration(5)).toBeCloseTo(0.6, 5);
  });

  it('handles an empty stats list without scheduling cleanup work', () => {
    expect(createDetailModalStatsEnterDelays(0)).toEqual([]);
    expect(getDetailModalStatsEnterTotalDuration(0)).toBe(0);
  });

  it('locks enter and exit to the same CSS keyframes with enter reversed', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/collectibles-screen.css'),
      'utf8',
    );

    expect(css).toMatch(
      /\.detail-stat-entering,\s*#collectibles-detail-modal \.detail-stat-exiting\s*\{[^}]*animation-name:\s*detailStatPopOut;[^}]*animation-duration:\s*0\.4s;/s,
    );
    expect(css).toMatch(
      /\.detail-stat-entering\s*\{[^}]*animation-direction:\s*reverse;/s,
    );
  });

  it('keeps CSS as the sole enter animation owner in the modal manager', () => {
    const managerSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );

    expect(managerSource).toContain("element.classList.add('detail-stat-entering')");
    expect(managerSource).not.toContain('const statsEnterTimeline =');
  });
});
