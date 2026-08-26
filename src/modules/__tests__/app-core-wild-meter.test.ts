import { consumeWildCharge } from '../app-core-wild-meter';

describe('wild meter charge consumption', () => {
  test.each([
    [1, 0],
    [1.5, 0.5],
    [2.4, 1.4],
  ])('consumes exactly one charge from %s and preserves %s overflow', (wildMeter, leftover) => {
    const meterValues: number[] = [];
    const stateValues: number[] = [];
    const visualValues: number[] = [];
    const resetValues: number[] = [];

    expect(consumeWildCharge({
      wildMeter,
      setWildMeter: value => meterValues.push(value),
      setStateWildMeter: value => stateValues.push(value),
      resetWildProgress: value => resetValues.push(value),
      animateWildMeterChargeConsumption: value => visualValues.push(value),
    })).toBeCloseTo(leftover);

    expect(meterValues).toEqual([leftover]);
    expect(stateValues).toEqual([leftover]);
    expect(visualValues).toEqual([leftover]);
    expect(resetValues).toEqual([]);
  });

  test('keeps the legacy visual reset as a safe fallback before HUD creation', () => {
    const resets: Array<[number, boolean | undefined]> = [];
    consumeWildCharge({
      wildMeter: 1.5,
      setWildMeter: () => {},
      setStateWildMeter: () => {},
      resetWildProgress: (value, animate) => resets.push([value, animate]),
    });
    expect(resets).toEqual([[0.5, true]]);
  });
});
