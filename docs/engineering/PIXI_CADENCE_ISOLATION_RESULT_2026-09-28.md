# Pixi Active Cadence Isolation Result — 2026-09-28

## Verdict

**THERMAL CAUSE CONFIRMED; 30 FPS PRODUCT BEHAVIOR REJECTED.**

The matched unplugged physical route kept audio, haptics, Special/Wild behavior and gameplay enabled while capping active Pixi lifecycle leases at 30 FPS. Native thermal state reached `fair` after 352.041 seconds (5:52) of active play and never reached `serious` through 400.485 seconds (6:40), despite 478 haptic impacts, three notifications and four selections.

The preceding normal-cadence route reached `fair` after 105.188 seconds (1:45) and `serious` after 435.181 seconds (7:15), with 439 impacts, three notifications and four selections. The cadence isolation therefore delayed `fair` by 246.853 seconds, more than 3.3 times the normal interval, under comparable or heavier interaction.

The user reported the final device slightly warmer than lukewarm and also correctly identified the 30 FPS presentation as visually slow/trzavo. This configuration is diagnostic evidence, not an acceptable product setting.

## What the result proves

- Active Pixi render cadence and its associated GPU/compositor work are the dominant remaining thermal contributor in this route.
- The bounded run contains no native memory warning, crash or transition failure.
- Audio, haptics and one isolated Journey screen are not supported as the dominant cause by this comparison.

The result does not identify one sprite or one World effect as the exclusive owner. The next discriminator keeps 60 FPS and reduces only the mobile Pixi backing resolution from 1.25x to 1x. That reduces Pixi pixel fill by 36% while retaining normal motion cadence; DOM text and HUD resolution stay unchanged.

## Evidence

- Lossless device telemetry: `logs/pixi-cadence-isolation-20260928/final.jsonl`
- Active reference: sequence 15, wall `1790548402641`, nominal, impact 4
- First `fair`: sequence 86, wall `1790548754682`, impact 417
- Final sample: sequence 96, wall `1790548803126`, fair, impact 478
- Battery: 75% to 70%, unplugged; brightness 55%; Low Power Mode off
