# Journey ambient canvas work reduction — 2026-09-17

## Concrete source finding

Every painted frame in journey-ambient-canvas-runtime.ts cleared both full viewport-sized backing surfaces, even when one depth layer was empty or only a small sprite occupied it. Forest, Beach and Area55 renderers already cull sprites and cap mobile cadence; whole-layer clearing ignored that sparsity. Earlier physical traces support a continuous rendering workload but do not prove these clears are the dominant heat source.

## Implemented change

Opt-in painted-bound tracking shared by the existing two-canvas owner. Each actual successful draw records canvas-local bounds; one union per depth gives at most one clear per layer. The next frame clears old pixels before any new draws; no clear is issued for a layer that had no pixels. Existing full clear fallback remains for callers that do not opt in.

Forest records a circle-enclosing rectangle around the rotated, nonuniformly scaled sprite, including both crossfade draws; Beach records its actual square draw; Area55 encloses the rotated authored aspect ratio. The shared owner rounds outward with2CSSpx margin and clips to bitmap bounds, with full-surface fallback for nonfinite coordinates. Old bitmap-local coordinates remain correct when the scrolling canvas window moves. Depth switches clear the old layer, and suspension retains pending old damage for resume.

No flight paths, timing, number of characters, DPR, FPS, opacity, depth, assets or input behavior changed. This reduces clear calls/clear area for sparse frames; it does not by itself prove lower hardware GPU energy (partial clears and compositor behavior require device measurement).

## Validation

Focused original runtime/three owner suites27tests PASS; actual draw-function tests2 PASS verify every rotated corner fits the reported region and zero-opacity/unloaded assets do not mark paint. Runtime regression covers empty layers, union, depth switch, old coordinates during scroll, suspension/resume and dispose. Initial test fixture TypeScript overload and Array.at library mismatch corrected. Final qa:fast8/8 and qa:full13/13 PASS;346suites2285tests,KING24/306. Logs in logs/journey-ambient-damage-20260917. HTTP localhost:5174 serves new canvas runtime; dist rebuilt without native sync. No native sync/install; previous memory-pressure repair remains included in source.

Browser visual inspection unavailable in this session (CUA reports no browser). iPhone visual trace/thermal difference remain NEEDS PHYSICAL TEST. No claim of solved abnormal heat.
