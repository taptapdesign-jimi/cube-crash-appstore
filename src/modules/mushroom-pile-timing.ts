export const MUSHROOM_PILE_PREVIOUS_DURATION_SECONDS = (
  0.30 // rise and three-step squash/stretch settle
  + 0.62 // fully stacked hold
  + 0.50 // complete 21-Mushroom reveal stagger
  + 1.00 // reverse exit stagger
  + 0.12 // exit anticipation squash
  + 0.32 // downward exit
);
export const MUSHROOM_PILE_DURATION_REDUCTION_SECONDS = 1;
export const MUSHROOM_PILE_DURATION_SECONDS = (
  MUSHROOM_PILE_PREVIOUS_DURATION_SECONDS - MUSHROOM_PILE_DURATION_REDUCTION_SECONDS
);
export const MUSHROOM_PILE_TIME_SCALE = (
  MUSHROOM_PILE_DURATION_SECONDS / MUSHROOM_PILE_PREVIOUS_DURATION_SECONDS
);
