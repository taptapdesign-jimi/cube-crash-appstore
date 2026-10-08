# Isolated native continuation checkpoint

This is an unfinished native migration checkpoint based on main3f1b776268542fdc55ca38db072ac2361a04f5da. It preserves the original production-benchmark-v9 and native-benchmark-v1 references. It does not contain the secondary conversation's unaccepted shared Scene/Home/Bootstrap draft. Shipping activation and complete physical acceptance remain pending.

Admitted work in this snapshot: source ordinary/Wild callback ordering and captured cancellation, source app wall timers distinct from paused animation, typed completed-level-flow160 repair, source pause/save protection, source frame policy, HUD motion/reveal/close, Fish original SVG fallback, final board geometry and original bold multiplier. Shared smoke adapter is compiled/tested but not connected to all callers. Ordinary idle motion/scheduler values are tested but not Scene activated.

Evidence: exact Core114/114 mac Swift PASS from this tree; qa:fast12 and qa:full19 gates PASS,530 suites4010 tests/KING24/330; SDK7 actual44/44 PASS; SDK4 other58 PASS and its single source-moves fixture failure corrected/verified in SDK6 1/1. Earlier failed receipts remain described in CURRENT_HANDOFF. Separate runs are not one aggregate test suite. No source asset conversion, PWA sync or phone install occurred.

Reproduce core with `swift test --package-path native/gameplay-core`. QA target is native/standalone/Stack to Six.xcodeproj, scheme Stack to Six Native Gameplay QA, bundle com.taptapdesign.stacktosix.native. Use original NativeAssets through existing native preparation; bundles are excluded from Git. Source build uses SKIP_NATIVE_BUNDLE_SYNC=true. Never operate the legacy Kockice shell.

Not included/activated: private meter Core/renderer/audio128-test draft, canonical source animation delivery consolidation, ordinary pickup/snap-back bridge, Source NoMoves staged transaction/display, full shared FX clock/RNG composition, Release web-dependency retirement. Secondary v9-display package is separately available on the shared workspace; final geometry/multiplier were selectively admitted here. Physical acceptance is NEEDS PHYSICAL TEST.

The checkpoint is intended for a separate native continuation branch; publishing it must not advance mixed main or overwrite unrelated shared working files. Online status is confirmed separately after remote read-back.
