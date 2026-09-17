# Kanta position and pickup incident — 2026-09-16

## Live evidence

User reported Kanta misplaced and impossible to drag. Read the existing Stack to Six process52098 without restarting, resetting or changing visuals. Installed package0c431337cb613a580a5ad29b9f2552e892a0cd7d80082432b7028c1451334a54. Board21 had4tiles,score2368,moves8. Saved board21 snapshot preserved in `logs/kanta-live-20260916/board21-save-before.json` alongside raw and parsed reads.

Kanta was logically atgrid(1,6),outertile(212,952),unlocked,static event mode,pointerdown listener1,hitArea128×128 centered atzero. Global input locks wereempty. Active Kanta idle owner present; base.y64,anchor.y0.5,texture128×171,scale0.748538. Board scale0.475 converts the unintended64localpixel pivot shift to approximately30.4screenpixels. Actual finger coordinates were not captured, so the observation proves bad alignment and a plausible pickup failure rather than a complete pointer-event trace.

## Proven mechanism

Kanta idle installs bottompivot1 and compensates baseY by64. The late `applyWildSkinLocalCore` texture callback uses `getSpecialDiceFaceAnchorY`, which protected live Bottle only, and resets Kanta tocenter0.5 without removing theY compensation. An executable source reproduction confirms visual center moves from0 to64 with the idle stillactive. The same helper also serves board repaint and app-core visual recovery.

No Kanta runtime or asset edits were present when the failure was captured. The first inspection tried to serialize Pixi cyclic objects and caused a diagnostic JavaScript error; this is our read error, not a gameplay crash. Safe scalar reads then succeeded. LLDB detached cleanly and app continued; there is no ongoing capture.

## Authorized repair

User subsequently authorized repair and asked which issues need further measurement. Repair the live base pivot ownership in the shared helper, prove deferred-load alignment and disposed/replaced host safety, and preserve Bottle/Barrel/static fallbacks. No hit-area enlargement, repositioned cells, art changes or gameplay rule changes are required. Implemented: live Kanta controller exposes `ownsBase(candidate)` for its exact nondestroyed sprite until disposal. Shared `getSpecialDiceFaceAnchorY` keeps anchor1 only for that owner; ordinary/inactive/replacement sprites retain their normal anchor. This covers delayed skin, board repaint and app-core recovery without changing their callers.

Three focused suites /22 tests and typecheck PASS. New tests run real skin assignment and Kanta controller with skin-first and idle-first deferred texture resolution, repeated repaint, stable hit rectangle and visual center, restoration after disposal, stale/replacement owner rejection, Bottle preservation and Barrel/default anchors. Final validation **PASS**: qa:fast8 gates/132 suites/1098 tests; qa:full13 gates/329 suites/2170 tests, including Gameplay KING24/306, TypeScript, lint, source-only build, bundle audit and native source guard. Independent Kanta review4/4 PASS. Logs `/tmp/kanta-pivot-fast.log`, `/tmp/kanta-pivot-full.log`. HTTP confirms localhost:5174 serves both Kanta ownership and shared-clock Homepage exit. Local source/dist updated; no native Web.bundle/app/phone delivery. Physical Kanta pickup/appearance and transition smoothness remain **NEEDS PHYSICAL TEST**.

## Combined next test

Install only after authorized native delivery. Test Kanta appearance, pickup and release after cold load and saved-board restore; repeat Homepage Journey hero inflation→exit; repeat Homepage→Hub, Hub→World, World→Hub, gameplay→World and back to Homepage. New corrected-clock scopes distinguish preparation from visible World entry and Homepage exit. Previously recorded long overall frames remain unresolved until same-device repeat; a full deterministic pass alone cannot certify smoothness or sustained thermals.
