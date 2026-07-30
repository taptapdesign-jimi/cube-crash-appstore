import {
  formatGameplayProgressLabel,
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
});
