# Stack to Six bug-fix tracker — 2026-09-30

This tracker consolidates the reported installed-build problems. A deterministic
source verdict is not a physical-device verdict: every animation, FPS and
speaker item stays open until the localhost build is accepted and that exact
bundle is installed on `iPhone 13 blue`.

| Priority | Reported problem | Source owner / repair | Deterministic status | Physical acceptance |
| --- | --- | --- | --- | --- |
| P0 | Laser beam remains visible after contact; Zap-Zap can corrupt the board or make cubes disappear | Beam retires at the exact contact tick. The hit changes value on the same grid/list tile and runs one standard bounce under one reservation; Laser never removes/reopens the cell. | PASS | Required |
| P0 | Arcade Stage 1 remains on CONGRATS instead of Round 02/fresh board | Thumb completion receipt is armed before its timeline can finish; continuation is exactly-once. | PASS | Required |
| P0 | Music is absent after returning from Photos/another app; a later switch can produce only a faint restart before silence while SFX still work | The installed v7 repair was insufficient. Source now separates hide/show receipts, retires on `pagehide`, ignores stale-hidden `pageshow`, rejects receipts requested before the newest background boundary, prevents AudioContext state from consuming native epochs, publishes a fresh receipt when a newer foreground arrives during an older in-flight activation, correctly retries category/media-service failures, retries failed same-sequence JS rebinds, and rebinds a visible-first theme/Arcade source once at its preserved position. | DETERMINISTIC PASS / NEEDS PHYSICAL TEST | Required on a new authorized install; current v7 phone build still FAILS |
| P1 | Wild-Star orbit remains frozen after Exit Game | Stage-level orbit foreground copies the tile hidden state before invisible work is skipped. | PASS | Required |
| P1 | Flower pollen is no longer visible | Existing pollen emitter is mirrored into a Pixi foreground layer above Flower artwork; no second emitter/ticker. | PASS | Required |
| P1 | Ordinary Merge-6 smoke/shards, Magnet/Bottle, Honey pull/bees and replacement cubes hitch or fall below target FPS | Existing animation/FX owners hold bounded active-frame leases, Stage 1 visual resources warm ahead of first use, and board pop-in uses a bounded cadence. | PASS | Required: Merge-6 at least 30 FPS; bees 24–30 FPS; judge pull/spawn fluidity |
| P1 | New cubes after Merge-6 / Special Merge-6 appear jerky | Canonical spawn bounce owns its complete frame lease and cleanup/interrupt boundary. | PASS | Required |
| P2 | Journey return leaves the cube nav icon selected instead of Backpack | Hidden slider state resets visual poses atomically through the existing owner. | PASS | Required |
| P2 | Launch character smile is too quiet | Only `logo transitions/smile.wav` is raised 20%: 0.70→0.84 action gain, 0.42→0.504 effective. | PASS | Required |
| P2 | Main theme is too loud | Only main-theme ceiling is reduced 15%: 0.68→0.578. Journey derived targets are 0.1156/0.19074; Arcade adaptive beds are unchanged. | PASS | Required |

## Release checklist

- [x] Focused regression coverage for Laser, Flower, Wild Star, soundtrack and launch audio.
- [x] Audio-runtime and Special-dice admission gates.
- [x] Gameplay KING contract: 24 suites / 308 tests.
- [x] Full deterministic QA for the foreground repair: 18 gates / 455 suites / 3,109 tests.
- [x] Third independent Laser review: PASS with no P0/P1/P2 findings.
- [x] Native-sync-disabled production build and bundle audit.
- [x] Corrected source served at `http://localhost:5174`.
- [x] User authorized native delivery after localhost review.
- [x] Sync only the authoritative Stack to Six `Web.bundle`.
- [x] `qa:ios`, signed device build and install-over-existing-data.
- [x] Exact Stack to Six bundle launched on `iPhone 13 blue` at 11:20:42 CEST.
- [x] Physical acceptance reported for Laser, Flower and the remaining non-soundtrack fixes.
- [x] Immutable `production-benchmark-v7` published online before the soundtrack repair.
- [ ] Foreground soundtrack physical acceptance on `iPhone 13 blue` after a new authorized install.

The legacy Kockice Crash shell and all supplied asset identities remain out of
scope and untouched.
