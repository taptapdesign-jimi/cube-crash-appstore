# Production Benchmark v8

Date: 2026-10-01

## Identity

- Product: Stack to Six
- Source version: `2.0.653`
- Canonical branch: `main`
- Immutable tag: `production-benchmark-v8`
- Complete content checkpoint: `cf165aa02941ad01ec13a29624a943ada926196a`
  (`release: establish production benchmark v8`)
- Previous approved complete baseline: `production-benchmark-v7`
- Native target: `/Users/user/Stack to Six/Stack to Six.xcodeproj`
- Bundle identifier: `com.taptapdesign.stacktosix.Stack-to-Six`
- Physical target: `iPhone 13 blue`
- Installed entrypoint SHA-256:
  `c39936500f0616dd714ef459f4c183c136d4672ff0715e0cfe92c3ff1f32d18a`

## Complete change record

This benchmark captures the complete repository state explicitly promoted by
the user after Production Benchmark v7. It includes the complete soundtrack,
board-runtime, result-transition, Beach, LaserGun and Area 55 package delivered
to the authoritative bundled Stack to Six app. Git is the authoritative file
inventory for the web/game repository.

The native Stack to Six shell is not itself a Git repository. Its installed
identity, bundled mode, audited Swift integration and final runtime hash are
therefore recorded as delivery evidence below rather than represented as files
inside this source tag.

### Foreground soundtrack and launch mix

- The JS/native foreground handshake retires stale-hidden voices, orders native
  activation receipts by foreground epoch, and rebinds main/Arcade voices once
  at their preserved position and route gain after authoritative activation.
- Repeated background/foreground attempts are generation-owned; Music OFF,
  route replacement, interruption failure and media reset retain explicit
  cancellation/retry behavior.
- Cold launch starts the main theme at the visible studio-logo boundary with an
  exact two-second gain fade instead of masking the authored character cues.
- The couch-character sleepy/snoring pair is reduced by exactly 20%; the
  previously accepted smile and global theme balance remain retained.

### Lossless gameplay runtime optimization

- Shared Pixi sheets avoid signature-string work when no frame publisher exists.
- Regular idle smoke reuses the grouped owner, and ordinary idle timers park
  completely while the app is hidden before resuming their retained cadence.
- Board exit uses one owned master timeline with the established random values,
  timing, easing, audio boundary and interruption cleanup.
- Pixi foreground transforms and Fish presentation writes are cached without
  changing accepted animation geometry or texture-repair behavior.
- Static demand-render sleep remains intentionally excluded because it lacks a
  complete wake/invalidation contract for every Merge-6 and exit owner.

### Result and transition behavior

- Clean Board Exit starts its visible owners before cold Journey preparation,
  preventing the pressed-CTA/main-thread stall while preserving choreography.
- Arcade victory holds long enough for the complete final sax beat before the
  existing `ROUND NN` animation and fresh-board handoff.
- Beach Board Transition contains no palm curtain; the ball rotates 30% less
  and uses the stronger accepted bounce without changing its owner/cadence.
- The launch, result and Journey preparation changes retain cancellation,
  replacement and stale-generation protection.

### LaserGun gameplay and presentation

- LaserGun shards use cyan `#97E9FD` instead of beige `#BEAA85` while beam,
  trail, smoke, shard motion and cube reaction stay otherwise unchanged.
- A final LaserGun plus ordinary-cube merge uses one 720ms presentation-only
  gun: frames `1 -> 2 -> 3 -> 2 -> 1`, `ZAPED OUT`, no beam and no invented
  gameplay target.
- The same fake-out now covers a non-final LaserGun merge when only Wild/Special
  dice remain and there is no eligible ordinary value `1..6` target. The
  remaining Wild/Special is not mutated, rewarded or targeted, and gameplay
  continues normally.
- If at least one ordinary target remains, the established `ZAP - ZAP`, beam,
  contact reaction and bounce path remains authoritative.

### Area 55 Clean Board ships

- Both existing ship flybys retain distinct left/right corridors, depth order,
  compositor ownership and confetti-length lifecycle.
- Their opacity and scale stay constant through exit; there is no fade-out or
  scale-away.
- A slow continuous bank sweep plus direction correction stays within a hard
  30-degree ceiling and passes all deterministic 30 FPS smoothness seeds.
- Each complete sprite travels beyond its sampled viewport edge before its
  animation and DOM node are cancelled and removed.

## Validation and delivery

- Focused Laser/target/finality coverage: PASS, 5 suites / 128 tests.
- Focused Area 55/result lifecycle coverage: PASS, 3 suites / 57 tests.
- `npm run qa:fast`: PASS, all 12 gates, 176 suites / 1,578 tests.
- `npm run qa:gameplay-lock`: PASS, 24 suites / 308 tests.
- `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`: PASS, all 18 gates,
  456 suites / 3,131 tests and a 1,100-module production build.
- TypeScript, strict unused-code audit, lint, audio-runtime admission,
  Special-dice admission, visual contracts and built-bundle audit passed.
- Complete raw assets were restored to `dist`; only the authoritative Stack to
  Six `Web.bundle` was synchronized.
- `npm run qa:ios`: PASS. Signed Xcode Debug build: `BUILD SUCCEEDED`.
- Final bundle identifier, strict code signature and bundled `tile.png` passed.
- Source `dist`, official Web.bundle and final-app entrypoints share SHA-256
  `c39936500f0616dd714ef459f4c183c136d4672ff0715e0cfe92c3ff1f32d18a`.
- Apple returned explicit `App installed` over existing data at container
  `FF5C7FFC-8096-4438-A9E2-8D58E77DA60A`.
- Exact bundle launch succeeded on `iPhone 13 blue` at 2026-09-30 23:59:24
  CEST. Kockice Crash was not touched.

## Acceptance boundary

- User benchmark promotion: the complete current repository and delivered
  Stack to Six package are the new recovery reference.
- Deterministic and native delivery: PASS for the evidence listed above.
- Exact Area 55 ship bank/no-fade appearance, broadened `ZAPED OUT` feel,
  repeated Photos foreground soundtrack continuity, speaker balance and
  sustained thermal/battery behavior remain `NEEDS PHYSICAL TEST` unless the
  user separately confirms them on the installed device.
- This tag does not move or replace any historical benchmark tag.
