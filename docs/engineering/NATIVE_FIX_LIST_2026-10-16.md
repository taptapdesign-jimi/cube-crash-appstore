# Native reported fixes — 2026-10-16

Scope: standalone Native on top of benchmark v6. Preserved PWA is a read-only parity reference. Original assets and saves remain preserved.

## Work list

- [x] Restore ghost placeholders where locked-tile artwork is incorrectly used.
- [x] Recover music and SFX after returning from another application.
- [x] Recover SFX after a subsequent hard exit/relaunch when music still works.
- [x] Backpack die selection: reuse Home navigation squeeze feedback.
- [x] Gameplay exit X: reuse authored cartoon navigation pop.
- [x] Increase modal title-to-body separation by 4 points.
- [x] Kanta caption: `splat` → `clank-clank`.
- Skipped by explicit user request: Arcade text fit.
- [x] Increase intro character laugh gain by 25% relative to current gain.
- [x] Clean Board stage numbers use two digits, e.g. `02`.
- [x] Compare Journey card CTA spacing with preserved PWA and restore parity.
- [x] Restore automatic Unit/card and manual drag flip cues from PWA.
- [x] Restore board clear-exit cue matching the authored dice-rain entrance cue.

## Verification

Follow-up lifecycle audit also fixed pending Fish background/resume readiness, skipped retired queued decoding and weak/pruned navigation layer metadata. Mounted all17 previews plus heavy repeats passed23 open/close cycles with hidden-clock stability and weak deallocation checks. See CURRENT_HANDOFF.md for exact receipts and physical limits.

Checked items mean implemented in Native source. Physical audio recovery, speaker balance and animation feel remain NEEDS PHYSICAL TEST. No phone installation was performed.

Modal spacing covers Backpack detail, Score/Combo, Exit, tutorial overlay and Journey card stats. Fullscreen reward/unlock presentations retain their authored geometry. Journey CTA moves down16pt; narrow-phone stat rows adapt to retain clearance rather than overlap the button.

QA fast/full, Gameplay KING330, Swift gameplay483 and state43, original-asset/Native target audits pass. Final combined Native SDK91/91 PASS (`/tmp/native-fix-list-final-mounted-sdk.log` and `.xcresult`). Mounted320/360/390pt card screenshots are `/tmp/native-card-back-{320,360,390}.png`; parent visually reviewed320/390. Failure/correction history and delivery boundaries are recorded in CURRENT_HANDOFF.md.
