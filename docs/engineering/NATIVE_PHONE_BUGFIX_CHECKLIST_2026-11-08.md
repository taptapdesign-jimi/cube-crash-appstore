# Native phone regression repairs — 2026-11-08

Scope: user's physical review of the latest installed Native Release. Preserve
all accepted gameplay, art, saves and unrelated working-tree changes. Four-agent
implementation; one serialized Native build/test/install owner (root).

## Checklist

- [x] Fresh Journey Play: HUD entry remains visible after board transition.
- [x] HUD entry starts 100ms later using its existing clock.
- [x] Ball adopts Shroomy's new-die count/cell arrangement (explicitly confirmed), preserving Beach Ball media and legacy-save compatibility.
- [x] Stage NN label uses shared navigation-title enter/exit motion.
- [x] Backpack/Box section title then count use shared title enter/exit motion.
- [x] Journey info Play/Continue uses Exit Stage CTA enter/exit and authored cue.
- [x] Repeated Beach card visits: Close returns promptly to Worlds Hub.
- [x] iPhone Home clouds spread vertically between top and divider.
- [x] Arcade continuation retains the complete HUD/divider without exit/reentry.
- [x] Repeated info/score/combo visits: Backpack opens promptly; retired owners
  release and stale work cannot delay the successor.

## Ownership

- HUD/Arcade: `hud_entry_rounds` (Scene/Gameplay VC/preload owner).
- Ball/drop, then Home clouds: `ball_drop` (variant presentation owners).
- Stage/section titles and CTA/audio parity: `titles_stage_cta`.
- Route latency, lifecycle/resource queues, integration and validation: root.

## Verification

Each item needs concrete diagnosis and focused real-owner regression coverage.
Latency checks include repeated open/close, nested modals, pending preparation,
background/resume, route replacement and weak-reference retirement. Timing tests
distinguish visible playback admission from preparation and screen input gates.
Use existing animation/resource/audio owners; add no unbounded work or asset
mutations. Run applicable admission, Gameplay KING, fast/full/Native gates;
serialize mounted Simulator tests and normal retained preview refresh, preserving
both canonical saves. Physical visual/touch/FPS/thermal acceptance is separate.

## Verified results

All10items above are complete in Native source and dedicated Simulator regression
coverage. Final status across the coordinated mounted runs:32distinct tests PASS.
Initial failures remain in raw logs; corrected HUD fixtures and the actual Arcade
Source-owner handoff were rerun before normal delivery.

- Cold actual Journey Play traverses the real themed transition, then emits one
  HUD reveal on a mounted visible host after its cover has gone. Configured
  wait is0.100s; measured first-board-paint→HUD0.0804s (the100ms track starts at
  host admission, before the two-paint receipt). No Source wave/input delay.
- World source-card layers retain shifted clocks after covered landing pauses.
  Old global exit epochs reproduced a9s artificial future start. Local-clock
  scheduling finishes the actual exit in1.482s, preserving its authored curves.
- Twelve Beach card cycles each open alternating Score/Combo history, close and
  land the card, and require both weak references to retire. After the bounded
  first-three-card image warmup, repeated viewport decoded bytes stabilize.
  Measured full Backpack admission2.009s; full Hub admission1.792s. These include
  existing exit/entry animation durations; no artificial route wait was added.
- Ball: affected Core49/49PASS; state/import107/107PASS; strict Native override
  admission15/15PASS. Actual Journey/Arcade Source refill and final pair tests
  pass in both drop directions, preserving Ball media and production coin policy.
- HUD12adjacent transition tests and the actual Arcade Round01→02 divider/ribbon
  continuity test pass. Stage CTA/title, section title/count, authored cue mute
  policy and Home phone geometry tests pass; mounted Stage/Backpack exports and
  final live Home clouds were visually inspected.

QA: fast/full (no PWA sync), feature/audio/Native admission and Native target
checks PASS. Broader standalone Core audit remains15inherited failing assertions
out of560tests, all also failing at untouched HEAD (557tests/17assertions);
these are legacy Kite/BLOOB coin and historical roster/count expectations.
No Ball-introduced failure remains. This inherited debt is not an all-Core PASS.

Normal complete-tree Debug app built, installed over the retained1018iPhone
Simulator and launched normally. Both canonical saves are restored after tests
and byte-identical through initial launch. Exact bundle/binary/input receipts:
`/tmp/native-phone-regressions-20261108/`. Silent Mode OFF was verified by the real iOS Off banner for the CTA review;
a subsequent external Mute ON change was observed in both toolbar and SpringBoard
and preserved (final-verification.json). Game/Mac sound preferences unchanged. No new physical installation or PWA/legacy
operation in this task. Physical touch, optical/audio feel, sustained FPS and
thermal confirmation remain NEEDS PHYSICAL TEST/user review.

Raw Native logs: native-initial.log,native-hud-repeat.log,native-final.log;
source gates: qa-fast-final.log,qa-full-final.log; normal delivery:main-delivery.json.
Ball package logs and untouched baseline: `/tmp/native-ball-*-20261108*.log`.
Physical installation requires its own user authorization.
