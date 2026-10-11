# Native Source entry continuation — 2026-10-09

User resumed the ordered migration. The grey Journey → Play flash remains open and deferred until the end.

## Exact source and recovery

Current isolated composition: `/tmp/native-resume-20261009/source`. QA source: `/tmp/native-resume-20261009/qa`. These are temporary; the durable recovery below is authoritative if they disappear.

Recover the 2026-10-08 `NativeSource.tar.gz` into a NEW isolated directory and verify all original source/media hashes according to its README. Then verify `EntrySourceDelta.tar.gz` against `EntryManifest.json`; check each existing destination against `baseSHA256` before applying ONLY these eleven files. Null base hashes mean new files. Verify every resulting `sha256`. Never apply this full-file delta to the live dirty tree or a later composition without a narrow rebase.

## Connected scope

Fresh/restored ordinary entry now borrows the actual APP Math stream, clock, constructor nodes, finite timeout owner and FIFO. Its parent timeline and .03 final delayed call remain distinct from the real-wall watchdog. Normal/forced/abort/retire have separate completion receipts. Source geometry is compared in exact SpriteKit Float32 representation; synchronizing while entry owns paint cannot overwrite the pose. Ordinary base-z remains Source locked5/active20. Relayout settles before epoch invalidation; reparented nodes release only the matching old binding. Route retirement preserves paint.

Default-OFF VC/Bootstrap wiring calls the existing `startSourceBoardEntrySound` owner, using the app audio receipt counter. It does not replay generic board entry or add a sound transport. The complete Source mode remains OFF. Tutorial entry, restart, arbitrary Wild resume, full HUD motion and physical acceptance are not admitted by this bounded ordinary-entry batch.

## Current evidence

- Pure entry: **2/2 PASS**, including 1890 original channel comparisons.
- Actual final Native SDK: **25/25 PASS**, no skips. Includes 10 mounted owner cases, 4 real Scene cases, 1 genuine Bootstrap route, 2 prior Bootstrap regressions and 8 constructor regressions.
- Earlier app run retained one failed cue assertion: it checked before real cue mounting. The next test waits for the actual mounted cue; runtime and assertion are unchanged. Both raw runs are retained.
- Exact final Source full QA: **19/19 gates PASS**, KING330 and530 suites/4010 tests; `source-final-full.log`. This is source admission, separate from actual Native SDK and physical acceptance.

SDK result bundle: `/tmp/native-resume-20261009/entry-final-sdk.xcresult`. Raw logs are durable here; historical counts are separate runs and must not be summed into a whole-app acceptance claim.

No phone install, PWA sync, asset byte mutation, main/index change or remote publication. **NEEDS PHYSICAL TEST**.

## Current next checkpoint

Tutorial entry/activation has now been connected privately in the separate [TutorialREADME.md](TutorialREADME.md) and ten-file delta. Apply that delta only after this entry delta. Full Source tutorial sheet/pointer/HUD/monitor/steps remain OPEN; whole flags remain OFF. The grey flash is still last.
