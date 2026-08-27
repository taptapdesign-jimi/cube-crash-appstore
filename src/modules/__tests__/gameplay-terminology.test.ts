import {
  formatGameplayProgressLabel,
  formatGameplayResultProgressLabel,
  getGameplayProgressTerm,
} from '../gameplay-terminology.js';

describe('gameplay terminology', () => {
  it('uses Stage for Journey progress', () => {
    expect(getGameplayProgressTerm('journey')).toBe('Stage');
    expect(getGameplayProgressTerm('journey', { plural: true })).toBe('Stages');
    expect(formatGameplayProgressLabel('journey', 4, { padTo: 2 })).toBe('Stage 04');
  });

  it('uses Round for Arcade progress', () => {
    expect(getGameplayProgressTerm('arcade')).toBe('Round');
    expect(getGameplayProgressTerm('arcade', { plural: true })).toBe('Rounds');
    expect(formatGameplayProgressLabel('arcade', 12, { padTo: 2 })).toBe('Round 12');
  });

  it.each([
    [1, 'Forest 01'],
    [10, 'Forest 10'],
    [11, 'Beach 01'],
    [12, 'Beach 02'],
    [20, 'Beach 10'],
    [21, 'Area 01'],
    [22, 'Area 02'],
    [30, 'Area 10'],
  ])('formats Journey result board %i as a World-local stage', (boardNumber, expected) => {
    expect(formatGameplayResultProgressLabel('journey', boardNumber)).toBe(expected);
  });

  it('keeps Arcade result numbering global', () => {
    expect(formatGameplayResultProgressLabel('arcade', 12)).toBe('Round 12');
  });
});
