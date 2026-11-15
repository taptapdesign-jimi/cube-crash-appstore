# Native code health review · 2026-11-14

Scope: the current dirty Native working tree, with priority on November 14
Settings/Story/Score/result work and related tutorial, state and audio changes.
HEAD remains November 12, so Git cannot isolate only today's uncommitted edits.
Three independent read-only agents reviewed UI/lifecycle, gameplay/state and
audio/resources. Primary applied fixes and kept all other saved work.

## Findings and fixes

- Removed the always-false Studio character `topPivot` flag and branch after the
  leash character was retired. Removed its disconnected speech pool and audio
  conditions; all original assets remain. Retained newspaper-dog checks exercise
  the same Nala admission, history, generation and cleanup behavior.
- Removed unused tutorial Home/Arcade return methods and their stored callbacks.
- Removed the unreachable Score summary renderer/layout and summary model.
  Both active constructors now require bounded history; the same current/history
  rows, dimensions, motion and lifecycle continue to render.
- Migrated three stale integration tests from the retired tutorial completion
  cover to current reward/Clean Board, World or Arcade selection, and farewell.
  Wild fixtures use a real incomplete-profile checkpoint and restored Source
  graph rather than restarting its engine after constructor ownership is fixed.
  The Journey bootstrap test now likewise uses NativeStandaloneViewController's
  shipping complete graph, acknowledged guide receipts and genuine Source input;
  the old minimal fixture never reached its first frame under this renderer.
- Replaced two stale November 6 fitted-paper tests with checks of the original
  benchmark PNG, uniform UV cover, image reuse, deterministic resize, joined
  Close/body mask coverage, unchanged row spacing and weak release. The current
  implementation already existed in HEAD; November 7 handoff records the user
  choosing it. Production paper code was not changed.
- Corrected five pure-core test methods with pre-existing stale catalog/count/
  reward expectations: 18 variants, 22 core+variant identities, Kite/Coconut in
  Beach and Bloob in Area55; Bee/Kite/Bloob fixed one-coin Star-family policy.
  Production rules and immutable Production ready v1 agree; no gameplay rule changed.
- Corrected the broad navigation rhythm test's retired background expectations:
  outgoing starts at41.667ms and travels downward10.08pt, exactly as the approved
  November6 Journey contract specifies. Runtime code is unchanged in HEAD;
  title gaps, shared66pt header geometry and the route matrix stay protected.
- Updated the early Backpack Close regression to the later November8 policy
  allowing visible dice during entry. It still verifies painted-X hit testing,
  immediate outgoing parent input retirement, duplicate Close rejection and
  stale selection rejection after exit. No input policy changed in production.
- Made the12-cycle Beach card/history memory regression create its screenshot
  output directory instead of assuming an old temporary folder exists. Readiness
  now uses actual admitted interaction, including Reduced Motion, rather than
  requiring an optional idle animation. All12 weak-release, decoded-cohort and
  route-bound assertions remain.

## Lifecycle and resource review

No concrete new retain cycle or unbounded runtime collection was found in the
reviewed changes. Story weak callbacks, Star-frame release, Settings finite
heart tracks and shimmer retirement, tutorial FIFO bounds and celebration tail
ownership have explicit close, replacement, background and disposal paths.
This source review and mounted weak-release tests do not establish absence of
all game leaks or physical-device sustained memory/thermal behavior.

The old NativeTutorialCompleteController is explicitly retained for isolated
motion fixtures in the feature registry and has no production constructor.
It is not an active clock or heat source. Football remains an explicit injected
intro diagnostic fixture. Design output stays outside application resource roots.

One low-priority existing consistency observation remains: ordinary Settings
entry admits the creator heart/shimmer, while returning from Story also admits
Settings row idle. Route clocks pause background layers. No leak is demonstrated;
this cleanup does not alter accepted motion to resolve that asymmetry.

## Validation

- Pure Swift gameplay: PASS, 572 tests, zero failures.
  `/tmp/native-clean-review-core-final.log`.
- Pure Swift state: PASS, 124 tests, zero failures.
  `/tmp/sts-state-review-20261114.log`.
- Fast QA and iOS target/assets audit: PASS.
  Final complete-tree rerun PASS: `/tmp/native-clean-review-fast-delivery.log`,
  `/tmp/native-clean-review-ios-delivery.log`.
- Full QA: first run FAIL only existing preserved-web asset assertion in
  `src/jimi-2026/__tests__/scene-builders.test.ts:75`; 529 suites/4010 tests pass.
  Final rerun has the same sole failure and counts; all other gates pass.
  `/tmp/native-clean-review-full-final.log`.
- Initial hosted run exposed the stale tests above; audio107/0, intro14/0 and
  Story6/0 passed. Two overlapping external Xcode jobs replaced the same retained
  Simulator app during that run; interrupted results are not final proof.
- Hosted Native coverage: all61 selected cases pass across the broad run and
  focused corrections. The broad run had55 passing cases and6 stale/invalid
  fixture cases; corrected navigation/Close/memory tests PASS5/0 in135.755s
  (`/tmp/native-clean-review-corrections-tests.log`), shipping-root Journey
  completion PASS1/0 in23.479s (`/tmp/native-clean-review-journey-source-tests.log`).
  Score13/0 and actual Wild tutorial endings2/0 passed in the broad run
  `/tmp/native-clean-review-tests-final.log`; the old failure summary in that
  log is superseded only by the focused corrections above.
- The12-cycle mounted Beach card/history stress PASS: both old object weak
  references release each cycle, bounded decoded cohort checks pass; final
  decoded artwork74,348,836bytes (not process RSS). Backpack return1.980s,
  Hub return1.794s, below the existing3s limits. This is bounded Simulator
  evidence, not physical sustained-memory/thermal acceptance.
- Normal Debug build PASS: `/tmp/native-clean-review-build.log`, derived data
  `/tmp/story-fact-normal-derived`. Complete Swift input snapshot stayed unchanged
  through build. Exact `.native` identity, no Web.bundle/test PlugIns; install-over
  and ordinary launch PID74040. Installed executable/debug dylib match the build
  again after final UI observation. Both canonical save slots byte-identical
  before install versus the resolved current container after launch/UI; install
  relocated the data-container path, so the initial stale-path receipt was
  corrected rather than restoring anything. Actual final iOS SBRingerMuted=true.
  CUA observed normal Story then Home while the user navigated; content was not
  forced. Receipt: `/tmp/native-clean-review-delivery/receipt.json`.

Review-cutoff verdicts (superseded by the logo follow-up below): scoped source
cleanup and affected Native regressions PASS. Repository
full QA FAIL only for the pre-existing preserved-web missing-asset assertion.
Physical sustained memory, heat, touch and animation feel NEEDS PHYSICAL TEST.

Full QA regenerated ignored `dist` with `SKIP_NATIVE_BUNDLE_SYNC=true`; no
`Web.bundle` sync occurred. No physical phone, PWA bundle, legacy shell or
original asset changed by this review.
No uninstall, reset, restore or save migration was performed.

## Follow-up · confirmed logo replacement closes full-QA failure

User confirms the logo replacement and authorizes correcting stale references.
The seven affected web source/test files now use the existing logo-stacktosix
1x/2x/3x PNGs in rendering, preload and Retina CSS. Bootstrap alt text identifies
Stack to Six. Existing CSS classes/IDs and preload selection/concurrency stay;
all original asset bytes are preserved. Active asset guide updated. Native
already uses the correct logo and required no source/build/install change.

Targeted scene-builders7/0 PASS;fast QA PASS;full QA PASS with530suites/4011tests,
KING330 and all build/audit gates. Logs `/tmp/logo-reference-cleanup-{fast,full}.log`.
Independent source review and diff-check PASS. This supersedes the earlier
preserved-web logo failure; no test was skipped or asset-presence check weakened.
Ignored dist rebuilt with SKIP_NATIVE_BUNDLE_SYNC=true;no Web.bundle sync or
physical/Simulator operation in this follow-up. Physical memory/heat limits above
remain unchanged.
