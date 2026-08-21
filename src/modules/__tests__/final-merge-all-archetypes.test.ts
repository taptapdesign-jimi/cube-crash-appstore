import { resolveLastMergeEarlyState } from '../app-core-merge-lastmerge';
import { resolveFinalMergeSpawnGuard } from '../final-merge-spawn-guard';
import { resolveGameplayState } from '../gameplay-resolution-engine';
import { createGameplaySnapshot } from '../gameplay-snapshot';
import { SPECIAL_DICE_VARIANTS } from '../special-dice-registry';

type FinalCase = {
  label: string;
  special: string;
  variant?: string;
};

const coreCases: FinalCase[] = [
  { label: 'Star', special: 'wild' },
  { label: 'Juice', special: 'wild-juice' },
  { label: 'Magnet', special: 'wild-magnet' },
  { label: 'TNT', special: 'wild-tnt' },
];

const variantCases: FinalCase[] = Object.values(SPECIAL_DICE_VARIANTS).map(definition => ({
  label: definition.id,
  special: definition.archetype,
  variant: definition.id,
}));

const allCases = [...coreCases, ...variantCases];

function makeSpecialTile(entry: FinalCase) {
  return {
    value: 0,
    special: entry.special,
    _ccWildSpecial: entry.special,
    _ccSpecialDiceVariant: entry.variant ?? null,
    _ccSpecialDiceArchetype: entry.special,
    stackDepth: 1,
    locked: false,
    destroyed: false,
    visible: true,
    alpha: 1,
  };
}

function makeRegularTile(value = 5) {
  return {
    value,
    special: null,
    stackDepth: 1,
    locked: false,
    destroyed: false,
    visible: true,
    alpha: 1,
  };
}

describe.each(['arcade', 'journey'] as const)('%s final-merge archetype matrix', mode => {
  test.each(allCases)('$label + regular is final in both merge directions and blocks continuation spawn', entry => {
    for (const specialIsSource of [true, false]) {
      const specialTile = makeSpecialTile(entry);
      const regularTile = makeRegularTile();
      const src = specialIsSource ? specialTile : regularTile;
      const dst = specialIsSource ? regularTile : specialTile;

      const result = resolveLastMergeEarlyState({
        tiles: [specialTile, regularTile],
        src,
        dst,
        effSum: 6,
        isWildMagnetMerge: entry.special === 'wild-magnet',
        mode,
      });

      expect(result.isActuallyLastMerge).toBe(true);
      expect(result.finalMergeSnapshot).toMatchObject({
        activeSnapshotWasOnlyMergePair: true,
        isFinalWildLastTwo: true,
        isFinalMerge: true,
      });
      expect(resolveFinalMergeSpawnGuard({
        activeTilesBeforeMerge: result.activeTilesBeforeWildProgress,
        finalMergeBlockersBefore: [],
        src,
        dst,
        effSum: 6,
        srcIsWild: specialIsSource,
        dstIsWild: !specialIsSource,
        magnetWillPull: result.willPullTiles,
      })).toEqual({
        shouldBlockSpawn: true,
        reason: 'wild-final-pair',
      });

      const gameplayDecision = resolveGameplayState(createGameplaySnapshot({
        tiles: [specialTile, regularTile],
        moves: 0,
        makeBoard: { anyMergePossible: () => false },
        mode,
        phase: 'before-merge',
        src,
        dst,
        effSum: 6,
      }));
      expect(gameplayDecision).toEqual({
        type: 'complete',
        target: mode === 'arcade' ? 'arcade-stage' : 'journey-board',
        reason: 'final_wild_merge6',
      });
    }
  });

  test.each(allCases)('$label does not complete while another playable tile remains', entry => {
    const specialTile = makeSpecialTile(entry);
    const regularTile = makeRegularTile();
    const blocker = makeRegularTile(1);
    const result = resolveLastMergeEarlyState({
      tiles: [specialTile, regularTile, blocker],
      src: specialTile,
      dst: regularTile,
      effSum: 6,
      isWildMagnetMerge: entry.special === 'wild-magnet',
      mode,
    });

    expect(result.isActuallyLastMerge).toBe(false);
    expect(result.finalMergeSnapshot.isFinalMerge).toBe(false);
    expect(resolveFinalMergeSpawnGuard({
      activeTilesBeforeMerge: result.activeTilesBeforeWildProgress,
      finalMergeBlockersBefore: [blocker],
      src: specialTile,
      dst: regularTile,
      effSum: 6,
      srcIsWild: true,
      dstIsWild: false,
      magnetWillPull: result.willPullTiles,
    }).shouldBlockSpawn).toBe(false);
  });

  test('regular 4 + 2 final merge resolves to the correct mode target', () => {
    const src = makeRegularTile(4);
    const dst = makeRegularTile(2);
    const decision = resolveGameplayState(createGameplaySnapshot({
      tiles: [src, dst],
      moves: 0,
      makeBoard: { anyMergePossible: () => false },
      mode,
      phase: 'before-merge',
      src,
      dst,
      effSum: 6,
    }));

    expect(decision).toEqual({
      type: 'complete',
      target: mode === 'arcade' ? 'arcade-stage' : 'journey-board',
      reason: 'final_regular_merge6',
    });
  });

  test.each(allCases.filter(entry => entry.special === 'wild-magnet'))(
    '$label remains non-final in both directions while a playable pull candidate exists',
    entry => {
      for (const specialIsSource of [true, false]) {
        const specialTile = makeSpecialTile(entry);
        const regularTile = makeRegularTile();
        const pullCandidate = makeRegularTile(2);
        const src = specialIsSource ? specialTile : regularTile;
        const dst = specialIsSource ? regularTile : specialTile;
        const snapshot = createGameplaySnapshot({
          tiles: [specialTile, regularTile, pullCandidate],
          moves: 3,
          makeBoard: { anyMergePossible: () => false },
          mode,
          phase: 'before-merge',
          src,
          dst,
          effSum: 6,
          flags: { hasTilesToPull: true },
        });

        expect(snapshot.finalMerge.isFinalMerge).toBe(false);
        expect(resolveGameplayState(snapshot).type).not.toBe('complete');
      }
    },
  );
});
