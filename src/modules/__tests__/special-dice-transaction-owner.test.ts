import { SpecialDiceTransactionOwner } from '../special-dice-transaction-owner';

test('serializes every special archetype behind one immutable owner token', () => {
  let now = 1000;
  const owner = new SpecialDiceTransactionOwner(() => now, 5000);

  const flower = owner.claim('tnt');
  expect(flower).toBe(1);
  expect(owner.isActive()).toBe(true);
  expect(owner.claim('magnet')).toBeNull();
  expect(owner.claim('juice')).toBeNull();
  expect(owner.claim('star')).toBeNull();

  expect(owner.release(999)).toBe(false);
  expect(owner.isActive()).toBe(true);
  expect(owner.release(flower)).toBe(true);
  expect(owner.isActive()).toBe(false);

  const honey = owner.claim('magnet');
  expect(honey).toBe(2);
  expect(owner.snapshot()).toMatchObject({ token: 2, kind: 'magnet', startedAt: 1000 });
});

test('watchdog expiry recovers ownership without retaining gameplay objects', () => {
  let now = 0;
  const owner = new SpecialDiceTransactionOwner(() => now, 1000);
  const token = owner.claim('juice');
  expect(owner.owns(token)).toBe(true);

  now = 1001;
  expect(owner.isActive()).toBe(false);
  expect(owner.release(token)).toBe(false);
  expect(owner.claim('star')).toBe(2);

  owner.reset();
  expect(owner.isActive()).toBe(false);
});
