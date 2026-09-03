import { decideWildType } from '../app-core-wild-type';

const noop = () => {};

function decideForRoll({
  roll,
  boardNumber = 1,
  isArcade = false,
  wildSpawnCount = 0,
  lastWildDropType = 'wild',
}: {
  roll: number;
  boardNumber?: number;
  isArcade?: boolean;
  wildSpawnCount?: number;
  lastWildDropType?: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt' | null;
}) {
  const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(roll);
  const filterWildType = jest.fn((type: string) => type);
  try {
    return {
      result: decideWildType({
        boardNumber,
        isArcade,
        firstWildSpawned: false,
        wildSpawnCount,
        lastWildDropType,
        wildDropTypeStreak: 99,
        filterWildType,
        devLog: noop,
        devWarn: noop,
      }),
      filterWildType,
    };
  } finally {
    randomSpy.mockRestore();
  }
}

describe('Forest Cjelina 01 Wild pool', () => {
  test.each([0.1, 0.6, 0.75, 0.95])(
    'maps every core-Wild roll (%s) to base Star before Mushroom selection',
    (roll) => {
      const { result, filterWildType } = decideForRoll({ roll });

      expect(result).toEqual({
        spawnJuice: false,
        spawnMagnet: false,
        spawnTnt: false,
        wildType: 'wild',
      });
      expect(filterWildType).not.toHaveBeenCalled();
    },
  );

  test('does not apply the Forest restriction to Arcade Round 01', () => {
    expect(decideForRoll({ roll: 0.95, isArcade: true }).result).toMatchObject({
      spawnTnt: true,
      wildType: 'wild-tnt',
    });
  });

  test('does not apply the Forest restriction to another Journey board', () => {
    expect(decideForRoll({ roll: 0.75, boardNumber: 2 }).result).toMatchObject({
      spawnMagnet: true,
      wildType: 'wild-magnet',
    });
  });
});

describe('Beach Cjelina 01 Wild pool', () => {
  test('starts with Wild Star', () => {
    expect(decideForRoll({
      roll: 0,
      boardNumber: 11,
      wildSpawnCount: 0,
      lastWildDropType: null,
    }).result).toMatchObject({
      spawnJuice: false,
      wildType: 'wild',
    });
  });

  test('uses a 60% Juice / 40% Star base roll after the first drop', () => {
    expect(decideForRoll({
      roll: 0.5999,
      boardNumber: 11,
      wildSpawnCount: 1,
      lastWildDropType: 'wild-juice',
    }).result).toMatchObject({
      spawnJuice: true,
      wildType: 'wild-juice',
    });
    expect(decideForRoll({
      roll: 0.60,
      boardNumber: 11,
      wildSpawnCount: 2,
      lastWildDropType: 'wild-juice',
    }).result).toMatchObject({
      spawnJuice: false,
      wildType: 'wild',
    });
  });

  test('forces Juice after Star so two Stars cannot arrive consecutively', () => {
    expect(decideForRoll({
      roll: 0.9999,
      boardNumber: 11,
      wildSpawnCount: 3,
      lastWildDropType: 'wild',
    }).result).toMatchObject({
      spawnJuice: true,
      wildType: 'wild-juice',
    });
  });
});

test('Area 55 Cjelina 01 keeps the core drop on Star before Robo selection', () => {
  expect(decideForRoll({
    roll: 0.95,
    boardNumber: 21,
    wildSpawnCount: 3,
    lastWildDropType: 'wild-juice',
  }).result).toEqual({
    spawnJuice: false,
    spawnMagnet: false,
    spawnTnt: false,
    wildType: 'wild',
  });
});
