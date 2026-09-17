import { getSpecialArtworkWarmupEligibility as eligibility } from '../special-artwork-warmup-eligibility';

describe('special resource warmup eligibility', () => {
  test.each([1, 2, 3, 4, 5, 6])('Forest %i does not preload unavailable Juice or Barrel', (boardNumber) => {
    expect(eligibility({ boardNumber, isArcade: false })).toMatchObject({ juice: false, barrel: false });
  });
  test.each([7, 8, 9, 10])('Forest %i warms Barrel once it is in the earned pool', (boardNumber) => {
    expect(eligibility({ boardNumber, isArcade: false })).toMatchObject({ juice: false, barrel: true });
  });
  test.each([11, 12, 20])('Beach %i warms plain Juice without Barrel', (boardNumber) => {
    expect(eligibility({ boardNumber, isArcade: false })).toMatchObject({ juice: true, barrel: false });
  });
  test.each([21, 24, 30])('Area 55 %i does not confuse skinned archetypes with generic Juice', (boardNumber) => {
    expect(eligibility({ boardNumber, isArcade: false })).toMatchObject({ juice: false, barrel: false });
  });
  test('Arcade uses the round-one variant tour, then core specials', () => {
    expect(eligibility({ boardNumber: 1, isArcade: true })).toMatchObject({ juice: true, barrel: true });
    expect(eligibility({ boardNumber: 7, isArcade: true })).toMatchObject({ juice: true, barrel: false });
  });
  test('restored live specials can require warmups outside the normal reward pool', () => {
    const barrel = { special: 'wild-tnt', _ccSpecialDiceVariant: 'barell' };
    const juice = { special: 'wild-juice' };
    expect(eligibility({ boardNumber: 1, isArcade: false, tiles: [barrel, juice] }))
      .toMatchObject({ juice: true, barrel: true });
    expect(eligibility({ boardNumber: 1, isArcade: false, tiles: [
      { ...barrel, destroyed: true }, { ...juice, _ccSpecialDiceVariant: 'mushroom' },
    ] })).toMatchObject({ juice: false, barrel: false });
  });
});


describe('Fish finale warmup eligibility', () => {
  test.each([1, 7, 10, 11, 21, 24, 30])('Journey board %i does not warm Fish media', (boardNumber) => {
    expect(eligibility({ boardNumber, isArcade: false }).fish).toBe(false);
  });
  test.each([12, 13, 20])('Beach board %i can produce Fish', (boardNumber) => {
    expect(eligibility({ boardNumber, isArcade: false }).fish).toBe(true);
  });
  test('Arcade tour has no Fish; restored live Fish remains eligible', () => {
    expect(eligibility({ boardNumber: 1, isArcade: true }).fish).toBe(false);
    expect(eligibility({ boardNumber: 2, isArcade: true }).fish).toBe(false);
    const fish = { special: 'wild', _ccSpecialDiceVariant: 'fish' };
    for (const isArcade of [true, false]) {
      expect(eligibility({ boardNumber: 24, isArcade, tiles: [fish] }).fish).toBe(true);
      expect(eligibility({ boardNumber: 24, isArcade, tiles: [{ ...fish, destroyed: true }] }).fish).toBe(false);
    }
  });
});
