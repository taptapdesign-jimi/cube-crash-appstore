type WildMeterDeps = {
  wildMeter: number;
  setWildMeter: (v: number) => void;
  setStateWildMeter: (v: number) => void;
  resetWildProgress: (v: number, animate?: boolean) => void;
  animateWildMeterChargeConsumption?: (leftover: number) => void;
};

export function consumeWildCharge({
  wildMeter,
  setWildMeter,
  setStateWildMeter,
  resetWildProgress,
  animateWildMeterChargeConsumption,
}: WildMeterDeps){
  const leftover = Math.max(0, wildMeter - 1);
  setWildMeter(leftover);
  setStateWildMeter(leftover);
  if (animateWildMeterChargeConsumption) {
    animateWildMeterChargeConsumption(leftover);
  } else {
    resetWildProgress(leftover, true);
  }
  return leftover;
}
