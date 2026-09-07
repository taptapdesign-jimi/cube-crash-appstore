import {
  getArea55AllowedWildCoreTypes,
  getArea55WildPool,
  getArea55WildRewardCoreType,
  getArea55WildRewardVariantId,
  isArea55JourneyBoard,
  pickArea55WildReward,
} from '../journey-area55-wild-progression';

describe('Area 55 progressive Wild pool', () => {
  test('adds Kanta in 01, Robo in 02, Spaceship in 03, and LaserGun in 04', () => {
    expect(getArea55WildPool(21)).toEqual(['wild-star', 'kanta']);
    expect(getArea55WildPool(22)).toEqual(['wild-star', 'kanta', 'robo-cube']);
    expect(getArea55WildPool(23)).toEqual(['wild-star', 'kanta', 'robo-cube', 'spaceship']);
    expect(getArea55WildPool(24)).toEqual(['wild-star', 'kanta', 'robo-cube', 'spaceship', 'laser-gun']);
    expect(getArea55WildPool(30)).toEqual(['wild-star', 'kanta', 'robo-cube', 'spaceship', 'laser-gun']);
    expect(getArea55WildPool(20)).toEqual([]);
    expect(getArea55WildPool(31)).toEqual([]);
  });

  test('guarantees each newly introduced reward on that Cjelina first drop', () => {
    expect(pickArea55WildReward({ boardNumber: 21, wildSpawnCount: 0, roll: 0.99 }))
      .toBe('kanta');
    expect(pickArea55WildReward({ boardNumber: 22, wildSpawnCount: 0, roll: 0 }))
      .toBe('robo-cube');
    expect(pickArea55WildReward({ boardNumber: 23, wildSpawnCount: 0, roll: 0 }))
      .toBe('spaceship');
    expect(pickArea55WildReward({ boardNumber: 24, wildSpawnCount: 0, roll: 0 }))
      .toBe('laser-gun');
  });

  test('keeps Cjelina 01 limited to Star and the newly introduced Kanta', () => {
    expect([0, 0.9999].map((roll) => pickArea55WildReward({
      boardNumber: 21,
      wildSpawnCount: 1,
      roll,
    }))).toEqual(['wild-star', 'kanta']);
  });

  test('uses only the cumulative player-facing pool after each introduction', () => {
    expect([0, 0.34, 0.9999].map((roll) => pickArea55WildReward({
      boardNumber: 22,
      wildSpawnCount: 1,
      roll,
    }))).toEqual(['wild-star', 'kanta', 'robo-cube']);
    expect([0, 0.26, 0.51, 0.9999].map((roll) => pickArea55WildReward({
      boardNumber: 23,
      wildSpawnCount: 1,
      roll,
    }))).toEqual(['wild-star', 'kanta', 'robo-cube', 'spaceship']);
    expect([0, 0.21, 0.41, 0.61, 0.9999].map((roll) => pickArea55WildReward({
      boardNumber: 24,
      wildSpawnCount: 1,
      roll,
    }))).toEqual(['wild-star', 'kanta', 'robo-cube', 'spaceship', 'laser-gun']);
  });

  test('maps each visual reward to its existing gameplay archetype', () => {
    expect(getArea55AllowedWildCoreTypes(21)).toEqual(['wild']);
    expect(getArea55AllowedWildCoreTypes(22)).toEqual(['wild', 'wild-juice']);
    expect(getArea55AllowedWildCoreTypes(23)).toEqual(['wild', 'wild-juice', 'wild-magnet']);
    expect(getArea55WildRewardCoreType('laser-gun')).toBe('wild-tnt');
    expect(getArea55WildRewardCoreType('spaceship')).toBe('wild-magnet');
    expect(getArea55WildRewardCoreType('kanta')).toBe('wild');
    expect(getArea55WildRewardVariantId('wild-star')).toBeNull();
    expect(getArea55WildRewardVariantId('robo-cube')).toBe('robo-cube');
    expect(getArea55WildRewardVariantId('kanta')).toBe('kanta');
    expect(isArea55JourneyBoard(21)).toBe(true);
    expect(isArea55JourneyBoard(30)).toBe(true);
    expect(isArea55JourneyBoard(31)).toBe(false);
  });
});
