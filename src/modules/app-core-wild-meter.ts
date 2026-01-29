type WildMeterDeps = {
  wildMeter: number;
  setWildMeter: (v: number) => void;
  setStateWildMeter: (v: number) => void;
  resetWildProgress: (v: number, animate?: boolean) => void;
};

export function consumeWildCharge({
  wildMeter,
  setWildMeter,
  setStateWildMeter,
  resetWildProgress,
}: WildMeterDeps){
  const leftover = Math.max(0, wildMeter - 1);
  setWildMeter(leftover);
  setStateWildMeter(leftover);
  resetWildProgress(leftover, true);
  return leftover;
}
