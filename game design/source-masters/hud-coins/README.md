# HUD coin source masters

User-authorized optimization, 2026-10-18, applies only to the six supplied HUD coin SVGs. These byte-exact masters stay development-only under `game design/`, outside every app resource root.

Runtime SVGs retain their names under `assets/hud/animation coin/`. Their identical 120 embedded 320px PNG frames have been sampled at the display cadence (30 frames per 0.5-second cycle, 60 FPS), resized to 192px and encoded as WebP quality90 with transparency. All other SVG paths, transforms, timing, glows and sparkles are retained. This is a deliberate small-HUD optimization, not an interchangeable full-size illustration master.

`python3 scripts/optimize-hud-coin-svgs.py` reproduces the optimized SVGs from these masters and updates `optimization.json`. Re-running never overwrites the masters.

`python3 scripts/prepare-native-hud-coins.py` renders those SVGs with the existing local Chrome renderer into six 128px/frame transparent WebP quality94 atlases, at60FPS over their main0.5/2-second cycles. Native uses only these sheets, without an SVG/browser player. Their450 frames borrow shared atlas storage:29,491,200 decoded RGBA bytes before driver overhead. Frame playback borrows the existing finite flight clock and stops with its owning flight. Package sizes and decoded memory are separate budgets.

Measured source SVG total:62,695,186 →1,790,038 bytes (97.14percent smaller). Native atlas/manifest total:3,922,248 bytes. Total incremental packaged coin animation payload:5,712,286 bytes, versus62,695,186 bytes for the supplied SVGs alone. Existing static coin fallback remains unchanged.

Actual first-frame original/optimized native comparison is retained during validation at `/tmp/coin-original-optimized.png`; at128px on cream, mean channel difference was approximately1.36/0.87/1.73 out of255. This is a scoped sample, not a guarantee of lossless fidelity or physical-device acceptance.
