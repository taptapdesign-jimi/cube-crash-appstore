# Native v9 interaction repair

Primary retains core/clock/meter/Wild migration ownership. Apply the scoped patch
against primary checkpoint9a90908cd3b6b9dabe15d8b2df494414c2e65519; never merge the
whole live dirty draft. Frozen source is `/tmp/native-interaction-repair`.

- NativeRouteMotion owns400ms power2.out slider and380ms nav layout, painted
  interruption, stale completion retirement and shared background suspension.
  Shared Home stays a settled layout owner; hybrid selection owner is preserved.
- Ordinary drop consumes changed release coordinates once, uses sticky4px
  logical movement and actual v9 configured5% overlap,26% padded pointer area,
  68% radius. Resolver/tutorial legality and captured80ms completions retained.
  Special-source targeting, core and cadence are unchanged.
- One board-lived original15px rounded pip raster replaces live pip vector
  tessellation. Original RGB129/90/66 alpha0.9/corner6 preserved; cache released
  on disposal. FPS/hitch benefit still requires physical testing.

`export-drop.cjs` executes immutable v9 pickDropTarget/intersectRatio with actual
app-core config. Swift matches6000 cases. Run the exporter, copy drop-check.swift
to a temporary main.swift and compile it with NativeRegularDropTarget.swift.
Source manifest records the exact compiled candidate files. Documentation and
QA receipts: `docs/engineering/NATIVE_INTERACTION_REPAIR_2026-10-08.md`.
No new phone install is implied by this packet.

Swipe also preserves recognition travel and last synchronous release pose. Route
exit retains the painted hero bounce while retiring layout. Final actual SDK10
10/10 and UIKit UI2 slow/fast swipes both ways plus nav taps1/1 PASS. Phone93b
remains unchanged; native preview approval and physical retest are outstanding.
