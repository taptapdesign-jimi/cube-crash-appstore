# Restart / Arcade New Game visual handoff

User review supersedes the previous fast-HUD replacement policy. Preserve the
working tree and original assets; repair explicit Restart/New Game only.

## Video evidence

Original: `/Users/user/Downloads/blic.mp4`, 350×720, 244 actual frames,
approximately30fps, duration8.133s. Decoded with AVFoundation/AVAssetReader;
the original file is unchanged. Evidence under
`/tmp/native-restart-flash-20261108/` includes actual presentation timestamps,
individual PNGs and `fine-contact.png`.

- Frame131,4.3667s: old board still has visible right-column2/1/1/2 dice.
- Frame132,4.4000s: new board pattern appears abruptly, with its top rows already
  far into entry (top1, lower-left5/2).
- Frame134,4.4667s: new score HUD is beginning its entry.

This is a premature old/new generation handoff plus hidden incoming wave aging,
not an authored three-frame reposition of one board.

## Required ownership

- [x] Old board/ghost/footer exit and resource readiness join before replacement.
- [x] Both Journey Restart and Arcade Exit New Game use the same partial chrome.
- [x] Only X, Backpack and divider remain, fixed in position/scale/visibility.
- [x] Incoming Restart first paint already includes its stationary divider.
- [x] Incoming Source entry stays dormant under the existing first-two-paint
  cover, then starts once after that cover is removed; no consumed hidden wave.
- [x] Ordered new board, score/combo, meter and footer entry use existing owners.
- [x] Background, interruption and disposal cannot release a stale entry.
- [x] Automatic Arcade next-round full-HUD retention remains unchanged.

## Work split

Root inspects video, reviews ownership, serializes native tests/build/delivery and
updates contracts. `hud_entry_rounds` owns Scene/VC/meter lifecycle;
`titles_stage_cta` owns Bootstrap replacement admission;
`ball_drop` owns actual-root per-frame handoff regressions.

No new timer, renderer, opaque cover, gameplay/RNG rule, asset or save migration.
Final measured/visual evidence will be recorded after mounted validation.

## Implemented handoff

The VC now joins the full Scene and Journey footer exit before Bootstrap can
construct the successor. Resource preparation still overlaps that exit. Both
explicit Journey Restart and Arcade Exit New Game choose the partial chrome;
automatic next-round continuation keeps its separate full-HUD retention.

The incoming preload surface primes its divider as visible at its settled pose,
while ribbon and moving HUD groups remain hidden. Restart no longer adds the
former3pt divider oscillation. The Source constructor keeps its dice hidden and
its wave unstarted beneath the existing two-paint cover. After the existing
first-board-frame callback removes that cover, a generation-bound finite receipt
waits for the existing Source root clock delivery, then starts the original wave
once. It cancels its listener before creating the wave and all authored child
callbacks, so their birth epoch is current. The existing100ms HUD schedule begins from that
visible entry rather than consuming time underneath the retired host.

A retryable rendered-callback release survives background interruption and rejects
exit, disposal, generation replacement and retired Source construction. Motion
readiness is consumed once, including Reduced Motion, without another timer,
renderer or resource owner. Existing save/load and gameplay semantics are retained.

## First compiled audit and clock correction

The initial compiled audit detected a second fault after old/new exit ownership
was corrected. At the visible Arcade handoff, constructor-held roots had raw
scale1 while hidden (the sampler now records raw and effectively painted scale
separately). Subsequent actual paints reached1.0549 after18ms,1.1467 after34ms
and1.1845 after52ms despite the authored20ms delay and180ms growth. The recorded
Simulator frames also show the first visible row already large.

`register` attached a Source timeline at cached `animationSeconds` when the ticker
was awake. Starting it from a render-ready callback could therefore inherit time
before the visible handoff. The correction uses a typed one-shot receipt on the
existing Source ticker after its root clock updates. It creates no new clock or
recurring transport and changes only explicit Restart/New Game admission. Source
wave, haptic and midpoint children are created together at the updated epoch.
Foreground/global-pause guards and suspension/exit/disposal cancellation retain
retryable generation readiness. Initially Reduced Motion uses existing static
constructor release rather than leaving its roots hidden.

First-run failure logs/video remain under the task evidence directory; final
rerun evidence is separate (`restart-final2.*`). The per-paint regression retains
strict hidden initial handoff and a first40ms growth cap, plus fixed chrome,
full old exit and distinct frame receipts. This prevents final-state-only tests
from accepting the same three-frame fault again.

## Final verification and delivery

- PASS:78 selected mounted Native tests,0failures,206.927s;
  `restart-final2.xcresult` and `.log`. Includes12HUD,10preload,
  45Source-clock and11actual-root replacement/continuation/cold-entry checks.
- PASS: final no-sync `qa:fast`, `qa:full` (530suites/4011tests;
  gameplay lock24suites/330tests), `qa:ios` and `qa:feature-runtime`41owners.
  Full QA rebuilds local `dist`; no Native Web.bundle sync or PWA installation.
- PASS: independent production ownership review, no unresolved findings.
- PASS: actual captured final Arcade and Journey frames visually reviewed.
  `restart-final2.mp4`, `final-arcade-new-game/contact.png`,
  `final-journey-restart/contact.png` and `paint-summary.json`.
  First visible handoff has painted scale0. Arcade remains0 at15/25ms,
  grows to0.3544 at43ms and0.6841 at59ms instead of1.0549 at18ms.
  Both normal audits have position error0pt and alpha error0 for all three fixed
  anchors,59/60distinct incoming render serials, and every incoming sample follows
  the full old exit. Background/callback exit/disposal checks also pass.
- PASS: normal Debug `Stack to Six` scheme built from complete stable current
  inputs, bundle identity verified, install-over and normal launch on retained
  `Jimi 2026 QA iPhone 13` UUID1018BE2D-491B-465F-8F75-3E5BEB38C22A.
  Built/installed binaries match; no test plug-ins/Web.bundle. Both canonical
  saves restored after QA and byte-identical at install and launch.
  Actual SpringBoard Silent Mode ON. Receipts:`main-delivery.json`,
  `final-production-inputs.json`, `final-preview.png`;normal Home visually checked.
- NEEDS PHYSICAL TEST: final feel/touch/FPS on iPhone; no physical install or
  physical acceptance in this task. Original assets and gameplay/save rules unchanged.
