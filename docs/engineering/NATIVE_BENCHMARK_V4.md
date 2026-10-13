# Native benchmark v4

User-requested complete online checkpoint, 2026-10-13. Immutable tag:
`native-benchmark-v4`, published with `main` to the existing PUBLIC repository
`https://github.com/taptapdesign-jimi/cube-crash-appstore`.

This checkpoint preserves all current tracked and non-ignored project changes,
including the accumulated Native source, tests, runtime ownership records and
engineering handoff. It follows `native-benchmark-v3`. Previous Native and PWA
tags remain unchanged. Continue current Native development from this checkpoint.

## Included work

- Native tutorial activation, individual Unit enter/exit, shortened guide flow,
  original HUD dim/restore, Special Bar step, earned-reward deferral and Continue
  ownership. Whole-bar spring, orange fill motion and original meter bubbles
  use the existing shared clock and cleanup owners.
- Two reproduced Replay Board repairs: tutorial final-chance repair uses the
  actual Source constructor/face/bounce owner; final Arcade tutorial Continue
  replaces the old Source generation through prepared gameplay entry.
- Restored visible drag-over stroke above ordinary faces and below normal
  Wild/Special and held-die layers, with the existing interruptible reveal/exit.
  Wild/Special near-edge contact, Bottle finale opacity and Honey finale work
  are preserved with their shared targeting and presentation ownership.
- Renderer/save lifecycle, Native round/board restart and authored HUD policies,
  Special idle/artwork, static pip and source delivery refinements accumulated
  since v3. Current handoff preserves individual receipts and known limitations.
- Settings DEV tools and isolated previews, reward artwork sampling/antialiasing,
  original reward foil/frame preparation and reward-card rendering tests.
- Native/Home/World/result presentation updates, regression tests and feature
  runtime records. Original artwork and audio bytes remain preserved.

## Verification

- Full deterministic QA: PASS, 530 suites / 4010 tests, including Gameplay KING
  24 suites / 330 tests. Receipt: `/tmp/native-rapid-stack-full.log`.
- Final compiled Simulator regression group: PASS, 4 tests / 0 failures.
  Receipt: `/tmp/native-rapid-stack-final-sdk2.log`. Covers rapid post-guide
  attempts, 30 accepted moves to genuine tutorial completion, result Continue
  and the first fresh Arcade move, plus ordinary rapid contacts across the
  Spaceship helper in both directions and ordinary/merge-six branches.
- Native identity and original-asset audit: PASS.
  Receipt: `/tmp/native-rapid-stack-ios.log`.
- Final publication full QA: PASS, including 530 suites / 4010 tests,
  Gameplay KING 330, production build, bundle/startup and Native source gates.
  Receipt: `/tmp/native-benchmark-v4-full.log`.

## Delivery and remaining acceptance

This is a source checkpoint, not a new iPhone installation or complete Native
physical acceptance. Latest phone delivery remains the signed 2026-10-13
23:16 CEST orange-wave candidate, UUID
`FC09CC99-82EA-34CA-BFD9-82041250670A`, as recorded in CURRENT_HANDOFF.
Later simple meter spring/bubbles, selector restoration and the two Replay Board
repairs were validated in source/Simulator and are not installed by this task.

The active app is exclusively `native/standalone/Stack to Six.xcodeproj`,
`com.taptapdesign.stacktosix.native`. Publication does not build, install,
launch, reset or import any phone data and does not touch the preserved PWA.

Physical tutorial pacing, fast touch/drag, overlapping stack artwork, meter
motion, audio/haptics, sustained performance and reward rendering still require
device acceptance. Earlier unrelated typed-failure/return route regressions
remain open; the passing focused cases do not close them. The exact historical
iPhone screenshot incident lacks its OS trace; reproduced causes and fixes are
documented separately from physical causal confirmation in CURRENT_HANDOFF.

Large original v2 QA video artifacts retain their existing release attachment
manifest and recovery instructions in NATIVE_BENCHMARK_V2.md. No new ignored
build products, private phone save captures or temporary diagnostics are added
to this checkpoint.
