// clean-board-utils.ts
// Utility functions for clean board modal

/**
 * Pick random from array
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
