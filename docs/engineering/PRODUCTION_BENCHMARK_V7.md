# Production Benchmark v7

Date: 2026-09-30

## Identity

- Product: Stack to Six
- Source version: `2.0.653`
- Canonical branch: `main`
- Immutable tag: `production-benchmark-v7`
- Complete content checkpoint: `c3fba03a` (`release: establish production benchmark v7`)
- Previous approved complete baseline: `production-benchmark-v6`
- Native target: `/Users/user/Stack to Six/Stack to Six.xcodeproj`
- Bundle identifier: `com.taptapdesign.stacktosix.Stack-to-Six`
- Physical target: `iPhone 13 blue`
- Installed entrypoint SHA-256: `04e4d58a24a5cdd0a6cacec7b59e7b6479edb09c15b9c7633ec0eae5689f1b83`

## Complete change record

This benchmark captures the complete repository state explicitly promoted by
the user after physical confirmation that the Laser, Flower and other reported
gameplay, navigation and presentation regressions are resolved. Git is the
authoritative file inventory. This checkpoint intentionally precedes the next
foreground-soundtrack investigation so the accepted Laser/Flower behavior has
an immutable recovery point.

The user also reported one known issue in this exact installed runtime: after
leaving Stack to Six for another iOS app such as Photos and returning, the main
theme can remain silent. A later app switch can produce only a faint attempted
restart before silence returns. That issue is explicitly open in this
benchmark; this tag must not be cited as evidence that foreground soundtrack
continuity is fixed.

### Laser Gun gameplay and presentation

- The Zap Zap beam remains visible only until exact tile contact, then retires
  before the contacted tile performs its value-change response.
- The accepted transaction changes the value on the same live tile instead of
  removing and replacing the board object, preserving grid/list identity and
  preventing holes, duplicate tiles or stale drag/snapback ownership.
- The contacted tile uses the standard `0.30 -> 1.08 -> 0.96 -> 1.02 -> 1.00`
  bounce-in response. Cleanup is idempotent across completion, interruption,
  board retirement and a successor Laser run.
- Reward, shards, smoke, star, changed-cube sound and haptic occur only after
  the same-tile mutation is accepted. Four-hit and board-integrity regression
  coverage prevents the prior board-corruption failure.

### Flower and Wild-Star lifecycle

- Flower pollen again renders above the promoted artwork through a bounded
  foreground mirror while `fx.ts` remains the sole particle-motion owner.
- Pollen follows the live world transform and releases on completion, drag,
  failure, detachment, board exit and runtime cleanup.
- Pure Wild-Star orbit presentation synchronizes hidden tile visibility before
  skipping invisible work, so Exit Game cannot leave frozen stage-level stars.

### Arcade, Journey and performance repairs

- Arcade Stage 1 completion advances from the congratulations state to Round
  02 exactly once and prepares a fresh board without allowing retired callbacks
  to unlock the successor.
- Journey-to-Homepage navigation resets the hidden slider pose and restores the
  canonical backpack selection instead of leaving the cube icon selected.
- Merge-6 smoke/shards, Honey/Magnet pulls, new-cube appearance and Special
  presentation hold bounded mobile frame-activity leases through their actual
  completion and cleanup boundaries.
- Honey retains its pooled three-bee cadence owner; Stage 1 Magnet/Bottle visual
  resources receive bounded warmup before first use.

### Audio mix retained by this benchmark

- The studio-character `smile.wav` action gain is `0.84`, exactly 20% above
  `0.70` (`0.504` effective through the established master).
- The main-theme ceiling is `0.578`, exactly 15% below `0.68`.
- Journey transition/gameplay derived targets are `0.1156` and `0.19074`.
- Arcade Calm, Active and result targets remain `0.528`, `0.594` and `0.10`.
- The foreground-soundtrack failure described above remains open despite the
  existing Web Audio context-recovery paths and requires owner-level evidence.

## Validation and delivery

- Focused Laser regression: PASS, 11 suites / 77 tests.
- Independent Laser review: PASS, no P0/P1/P2 findings.
- `npm run qa:gameplay-lock`: PASS, 24 suites / 308 tests.
- `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`: PASS, all 18 gates,
  455 suites / 3,100 tests and a 1,100-module production build.
- TypeScript, strict unused-code audit, lint, audio-runtime admission,
  Special-dice admission, visual contracts and built-bundle audit passed.
- Complete raw assets were restored to `dist`; only the authoritative Stack to
  Six `Web.bundle` was synchronized.
- `npm run qa:ios`: PASS. Signed Xcode build: `BUILD SUCCEEDED`.
- Source `dist`, official Web.bundle and final-app entrypoints share SHA-256
  `04e4d58a24a5cdd0a6cacec7b59e7b6479edb09c15b9c7633ec0eae5689f1b83`.
- Apple returned explicit `App installed` over existing data at container
  `6BEC8214-2F3B-4625-BC1F-905A1E41B1A4`.
- Exact bundle launch succeeded on `iPhone 13 blue` at 2026-09-30 11:20:42
  CEST. Kockice Crash was not touched.

## Acceptance boundary

- User physical acceptance: Laser, Flower and the remaining previously reported
  non-soundtrack issues are resolved in this installed build.
- Deterministic and native delivery: PASS for the evidence listed above.
- Main-theme continuity across repeated iOS background/foreground cycles:
  **FAIL / OPEN**, based on the user's physical Photos-switch reproduction.
- The next soundtrack change must begin with targeted diagnostics at every
  transport, context, route, generation and native lifecycle ownership boundary;
  source tests alone cannot close the physical acceptance requirement.
