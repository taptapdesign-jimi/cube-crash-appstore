# Star HUD Source authority — 2026-10-09

Inspected current `src/modules/fx.ts`, getStarTexture at 3737 and animateStarsToHudIcon at 4171, specifically 4295–4368.

The common texture comes from the app cached original small-star.png. Saved positions[0].texture is a fallback when that lookup fails. Actual animation starts at the finite merge6 screen center, with saved Wild screen center as fallback. Saved individual orbit world poses and scales are not animation start geometry. Their entries determine whether/count of stars are animated. Missing entries retain original loop ordinals, which affect stagger and size selection.

The existing private Native Scene Direct receipt origin is therefore the correct common origin branch. Do not replace it with captured per-orbit positions. Core contact counts and retained halo captures do not yet prove the missing-common-texture fallback or sparse-entry ordinal behavior. Those, current SDK/full QA and the whole activated caller remain OPEN.

Current captured-HUD gameplay-lock log: terminal PASS, 24 suites / 330 tests. This is the web gameplay contract gate, not Native visual or physical acceptance. Core 359/359 and earlier Scene SDK22 are separate evidence; SDK22 predates the HUD count addition. Whole Source flags remain OFF; grey flash LAST; no phone/PWA/asset/live Native mutation.
