import { resolvePostSpawnEndgameDelayMs } from '../post-spawn-endgame-delay';

describe('post-spawn-endgame-delay', () => {
  it('keeps TNT post-spawn checks longer than other merge effects', () => {
    expect(resolvePostSpawnEndgameDelayMs({ isTntMerge: true })).toBe(1700);
    expect(resolvePostSpawnEndgameDelayMs({ isTntMerge: false })).toBe(850);
  });
});
