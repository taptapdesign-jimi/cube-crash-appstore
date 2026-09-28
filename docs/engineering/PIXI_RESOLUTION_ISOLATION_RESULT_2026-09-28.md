# Pixi 1x / 60 FPS Isolation Result — 2026-09-28

## Verdict

**PARTIAL THERMAL IMPROVEMENT; PHYSICAL HEAT STILL FAILS.**

The unplugged physical route retained the normal 60 FPS activity cadence and reduced only the mobile Pixi backing resolution from 1.25x to 1x. The user completed Forest with two Fail/Play Again cycles and a Clean Board/reward return, then Beach with repeated Fail/Play Again activity and a Clean Board/reward return.

The lossless native file contains 145 consecutive samples. From the first active gameplay sample, native thermal state reached `fair` after 137.598 seconds (2:17.6) and never reached `serious` through 505.110 seconds (8:25.1) of active play. The complete process remained `fair` through 650.110 seconds, with 642 impact requests, six notification requests, six selection requests, no memory warning and no crash.

The comparable 1.25x / normal-cadence run reached `fair` after 105.188 seconds and `serious` after 435.181 seconds. The 1x profile delayed `fair` by 32.410 seconds (30.8%) and avoided `serious` through a longer, heavier route. The user found the 1x image sharp, but reported the phone physically **hot** and a short Beach Wild Merge pause before its animation began. Physical heat therefore remains a release failure even though native state did not cross Apple's coarse `serious` threshold.

## Product decision

- Adopt 1x as the normal mobile Pixi backing resolution because physical sharpness passed and measured GPU pressure improved.
- Keep 60 FPS for direct touch and the exact lifetime of visible merges/finales.
- Reduce the post-touch 60 FPS tail from 500ms to 250ms. The rejected-drop snap-back lasts 235ms; accepted merges and finales already own separate exact leases.
- Finish the selected Special/Wild finale texture warmup during its drop choreography and keep that die noninteractive until readiness. This removes the demonstrated merge-time asset-readiness barrier without preloading the entire World pool.

## Evidence

- `logs/pixi-resolution-isolation-20260928/final-complete.jsonl`
- Active reference: sequence 14, wall `1790549652167`, nominal, impact 6
- First `fair`: sequence 42, wall `1790549789765`, impact 170
- Last active-route sample: sequence 116, wall `1790550157277`, fair, impact 642
- Final sample: sequence 145, wall `1790550302277`, fair, battery 60%, unplugged, brightness 55%
