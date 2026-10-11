# Stack to Six Native — current handoff

Updated: 2026-10-10. Main is authoritative; 100% Native migration remains **OPEN**.
Goal active. Source/SIMULATOR proof does not imply physical acceptance.

## Identity and preservation

- Active target: `native/standalone/Stack to Six.xcodeproj`, scheme `Stack to Six`, bundle `com.taptapdesign.stacktosix.native`.
- Actual storyboard root: NativeStandaloneViewController -> NativeBootstrap -> Swift/UIKit/SpriteKit. Archived GameViewController.swift and Web.bundle are excluded from active target membership. Original NativeAssets.bundle bytes remain preserved.
- No global Source migration flags are enabled. Default Native implementation and opted-in Source parity owners have separate evidence.
- Do not operate PWA `/Users/user/Stack to Six`, legacy Kockice, phone installs, or normal profiles as a QA side effect. Use `SKIP_NATIVE_BUNDLE_SYNC=true` for transitional web QA.
- Preserve unrelated dirty/untracked work. No reset/clean/whole-tree replay. Narrow evidence snapshots can be replayed only into NEW isolated trees.
- Physical target remains iPhone 13 blue. Huge-cubes report **OPEN**; grey Journey→Play flash **LAST**. No physical claim from screenshots or callback FPS.

## Current implementation: original forced first-play policy

Immutable `production-benchmark-v9` Homepage executes `!isFirstPlayTutorialForced() && hasArcadeSavedState`. Actual request owner forces first play until authored Tutorial Complete Continue; explicit force-next overrides done.

Native previously resumed an unacknowledged guide after Home/OS restart. Earlier tests proved that data retention, but it contradicted original launch behavior. The trial Source completed-guide restore candidate was withdrawn after exact SHA-safe reversal; its logs/snapshot remain historical evidence.

- Native Home reads and retains the existing document. A new Play while first play is forced starts fresh demo, using the prior durable generation's next epoch.
- NativeHybridImporter maps effective force-next precedence without changing old localStorage/data.
- Executed immutable request/expression oracle: 18 cases; original MOVES_MAX=50.
- Genuine tutorial completion -> real exit/Home -> new Source demo/wave/guided pickup -> default Native owner recreation/new fresh tutorial is connected.
- Result fixture now installs its two-die finale AFTER real first entry; authored result/acknowledgement checks remain unchanged.
- Existing Source saved constructor still refuses tutorial metadata. An active-tutorial Home restore is not an original Source route. In-memory background/foreground continuity, normal acknowledged resume and all other callers remain required.
- NativeTutorialOverlay has semantic `native.tutorial.sheet` accessibility ID for actual OS UI proof; no visible/motion change.

## Current verification

| Check | Evidence | Verdict |
| --- | --- | --- |
| Original-policy baseline |5357:3 tests15 failures|Confirmed mismatch|
| Intermediate corrected fixture |91974:3 tests2 failures; wrong zero-moves expectation|Historical; Source budget50 corrected|
| Connected before result-fixture repair |17761:5 tests2 errors from obsolete saved-launch result fixture; policy3 and genuine source/cold sequence pass|Historical|
| Current connected policy/result/guide |26491:5/5,26.050s,exit0|PASS|
| Current full Source QA |18543,exit0,all selected gates; no native sync|PASS|
| State package |63624:24/24,0.786s,exit0|PASS|
| Affected fresh/resume/tutorial/Bootstrap/root SDK |42564 terminal89/89,230.711s,exit0|PASS|
| Current OS UI forced-tutorial entry |72151 exit0,1/1,34.340s; two OS launches; late Drag to stack captures and actual private save inspected|PASS for forced entry|
| Policy checkpoint complete SDK |95921 exit0:1261/1261,613.671s|PASS|
| Current Release |80792 exit0; .native,Web.bundle absent,private QA strings absent|PASS for Simulator build|

State package26356 first failed at nested sandbox-exec before tests. Retry63624 disabled only inner SwiftPM sandbox under same workspace restriction; no profile access.

## Native legacy storage reader continuation

New Foundation/SQLite reader is added to NativeState; NativeHybridExport now uses Foundation/SQLite detached read instead of WKWebView/JS; connected transport/lifecycle checks PASS. Actual named iOS producer87859 PASS2.172s yielded original/foreign origin files and WAL/Unicode receipts. Reader93576 terminal12/12 PASS0.177s: origin/port/truncation, WAL, exact key filter, Unicode/NUL, invalid UTF16, schema view/type, empty/unscoped/ambiguous/corrupt profiles, symlink refusal and native atomic reopen/source-byte preservation. Full State45361 terminal36/36 PASS0.940s before root/cancellation adapter; updated State63398 terminal36/36 PASS1.023s. See [NativeLegacyStorageReaderValidation.json](native-completion-2026-10-10/NativeLegacyStorageReaderValidation.json). SDK77518 terminal10/10 PASS2.838s; SDK39036 terminal11/11 PASS14.946s including actual12second fallback and no late save. Sourcefull13504 terminal exit0 PASS. Release85572 terminal BUILD SUCCEEDED; both Simulator architectures have no WebKit/JavaScriptCore linkage, WK/JS importer strings or Web.bundle. Full current SDK73706 terminal exit0 TEST SUCCEEDED:1267 tests,1 opt-in producer skipped,0 failures626.559s; durable `native-legacy-reader-full-sdk.log`. Generic iOS Release98953 terminal exit0 BUILD SUCCEEDED. iOS arm64 binary also has no WebKit/JavaScriptCore linkage, WK/JS importer strings or Web.bundle; proof NativeLegacyStorageIOSReleaseDependencyProof.json. Unsigned, no installation. Bootstrap transport uses the same NativeSaveStore legacy Library boundary.

## Source integer wall clock continuation

The SDK1267 and both Release proofs above predate this two-line clock change. NativeSourceAnimationClockService now floors its default Source Date wall milliseconds and shared origin to match actual GSAP3.13 `_getTime = Date.now`. nativeRaw still receives separate CADisplayLink timestamps; injected clocks remain unchanged. Clock5021 terminal exit0 36/36 PASS1.161s. Added an actual display-link Source wall-resolution regression; clock69447 terminal exit0 37/37 PASS1.169s (`native-source-integer-wall-clock-actual.log`). Broader clock/ticker/FIFO/Tutorial/resume33776 terminal exit0 103/103 PASS98.816s. Sourcefull65155 and gameplay-lock37355 terminal exit0 PASS. Full updated SDK75220 terminal exit65:1268 tests,1 opt-in producer skipped,1 Bee synchronous pre-upload frame assertion failure (bee3 vs bee2),626.913s. Fixture already injects Source wall0; actual SKView Native idle runs during async upload. Only failing synchronous pre-upload fixture now pauses independent SKView before async wait; Source wall was already0. Exact manual40ms/assertion and production Bee code unchanged. SDK61137 terminal10 iterations/0 failures1.015s. Full Star+clock14376 terminal113/113 PASS9.354s. Combined full regression follows Native diagnostics admission; NativeSourceIntegerWallValidation.json. Global Source feature flags OFF. Before file retained as NativeSourceAnimationClockBeforeIntegerWall.swift in evidence directory.

## Native diagnostics continuation

NativeDiagnosticsCapture is now connected to actual NativeStandaloneViewController. Exact .native + explicit performance/thermal launch argument or preserved cc.performanceDiagnostics preference; no new preference writes. Ordinary unrequested root creates no capture files/observers/timeouts. Own bounded JSONL sessions/rows, five lifecycle/thermal/memory observers, one existing finite timeout only while foreground; source profiles/assets/audio/haptics untouched. Root/dispose/cap/failure cleanup and preserved state bytes are tested. Initial target-default actor initializer compile failure and actual Simulator battery-enable readback failure retained; corrected55297 terminal15/15 PASS0.157s. Battery commands/restore are injected proof; actual Simulator readback cleanup is separate, physical availability OPEN. Reentrant root/clock SDK39851 terminal53/53 PASS1.316s; final metadata/root/clock92655 terminal53/53 PASS1.335s. Feature gate, fastQA43426 and fullSource71311 terminal PASS. Generic unsigned iOS Release75024 terminal BUILD SUCCEEDED; actual arm64 binary no WebKit/JavaScriptCore/WK/JS import strings/Web.bundle (NativeDiagnosticsIOSReleaseDependencyProof.json). Combined full Native SDK34475 terminal exit0 TEST SUCCEEDED:1279 tests,1 opt-in producer skipped,0 failures626.347s (`native-diagnostics-full-sdk.log`). UI runner93851 terminal TEST BUILD SUCCEEDED. Opt-in NativeHomeInteraction UI foreground/background test prepared for profile0003 (CC_NATIVE_QA_DIAGNOSTICS_OS=1), active6s/background8s/resume6s with same-process requirement, executed47837 terminal1/1 PASS33.068s. Actual8 JSONL rows prove8958ms background without intervals. Profile preservation NOT accepted: existing normal save SHA changed at installation/lifecycle boundary and private0003 already existed. Before baseline kept hashes only; old container removed, so precise semantic comparison is missing. Preserve first failure and capture full raw baseline before next scoped run; never reset/overwrite profiles. Initial52838 pretest70 relative TESTROOT path issue retained; corrected descriptor executes. Prior .xctestrun files use format1 top-level target EnvironmentVariables; rebuild UI runner before creating new scoped opt-in copy. See NativeDiagnosticsValidation.json. Draft/typecheck history retained, not shipping proof. Combined fullSDK/Release and real OS-launch capture proof pending. Global Source flags OFF.

## Next work

Current test-only continuation: NativeLegacyStorageProducerTests added with exact Simulator/.native and explicit environment guard. Build32716/74691 PASS. Initial71331 failed guessed unprefixed path (preserved); corrected87859 terminal1/1 PASS2.172s. Actual46/58-byte original/foreign origins and UTF16LE BLOB Unicode/NUL verified in extracted snapshot. Source flags unchanged. Policy1261/Release checkpoints predate reader/transport continuation; see NativeLegacyStorageProducerValidation.json.

1. Both result fixtures now install finale after genuine first entry. Connected6 terminal27389 exit0 PASS. Added actual Journey first-play coverage for default/Source modes and opposite Arcade save preservation; connected8 terminal67083 exit0 PASS (`source-first-play-launch-policy-both-origins.log`); affected89 terminal42564 exit0 PASS230.711s (`source-first-play-launch-policy-broader-ready.log`). Runtime unchanged from fullQA18543/State24; test-only Arcade result repair.
2. Rebuild UI runner and run explicit prepared-profile forced tutorial entry through two real OS launches. Completed72151: two OS entries, actual profile gen7,45tiles/moves50/score0,active step1/progressionfalse; late screenshots inspected.
3. Current complete SDK95921 terminal exit0:1261/1261 PASS613.671s. Release80792 terminal exit0 BUILD SUCCEEDED; .native identity,Web.bundle absent,private QA strings absent. No physical/signed-release claim.
4. Continue missing common Source clock/Date/Promise/registry/RNG/resource/marker fidelity, all family/mixed gameplay and shipping activation. Immutable-v9 schema + restore-function execution now proves 8/8 modern/legacy regular, locked and Wild cases discard alpha/visible/renderable/stackDepth/occluder residue without input mutation. Actual restore sets visible=true and alpha=1 (locked zero=.25); explicit minimal board factory means this is not renderer/entry proof. See SourceSaveSchemaMarkerOracle.json. This corrects the earlier persisted-marker mismatch assumption; live/rendered marker fidelity remains OPEN.
5. Shipping active importer transport retired; preserved hybrid UI adapters are already Release-excluded Debug fixtures. Current binary dependency proof is [NativeLegacyStorageReleaseDependencyProof.json](native-completion-2026-10-10/NativeLegacyStorageReleaseDependencyProof.json). Physical migration compatibility and remaining internal diagnostics remain OPEN. Primary-format investigation and actual producer evidence: [NativeLegacyStorageRetirementInvestigation.md](native-completion-2026-10-10/NativeLegacyStorageRetirementInvestigation.md). The active importer is now native and its isolated producer is tested. Generic iOS Release dependency proof is PASS (NativeLegacyStorageIOSReleaseDependencyProof.json). Continue native diagnostics/resources/signing, then complete physical Journey/Arcade/touch/audio/performance/thermal acceptance. Do not remove/reset old data to avoid migration.
6. Huge cubes remain open; grey flash last. Only actual complete requirements/user acceptance permit a 100%-native benchmark.

## Evidence and execution

- Latest exact before/code/SHA/logs: [SourceFirstPlayLaunchPolicyValidation.json](native-completion-2026-10-10/SourceFirstPlayLaunchPolicyValidation.json).
- Withdrawn trial: SourceCompletedGuideRestoreValidation.json. PASS86/fullQA were trial component proof, not current shipping parity.
- Earlier actual OS Home/settings/guide retention: NativeOSProcessProfileValidation.json and NativeOSGameplayProducerValidation.json. Those precede correction and do not prove accepted forced-Play behavior.
- Dedicated QA Simulator: `1018BE2D-491B-465F-8F75-3E5BEB38C22A`. Private QA store is DEBUG/Simulator-only/exact .native + valid UUID and named tmp directory; Release binary excludes it. No normal profile fallback/reset/migration.
- DerivedData `/tmp/native-main-core-integration-derived`; transient logs `/tmp/native-completion-20261010-evidence`; durable logs/snapshots `docs/engineering/native-completion-2026-10-10`.
- CLI `xcodebuild` Native Gameplay QA/UI QA schemes, `CODE_SIGNING_ALLOWED=NO ASSETCATALOG_COMPILER_APPICON_NAME= ENABLE_USER_SCRIPT_SANDBOXING=NO` for unsigned Simulator evidence.
- Periodic pre-test runner/resource crashes: preserve terminal failure and retry unchanged only after process exits. No speculative cache/app deletion. Observation timeout is not terminal.
- Detailed prior checkpoints, installs, Source owner evidence and all historical state are preserved in [the handoff archive](NATIVE_MIGRATION_HANDOFF_ARCHIVE_BEFORE_FIRST_PLAY_POLICY.md). Read relevant manifest rather than treating old LIVE/green assertions as current.

The full requirement list remains [NATIVE_100_PERCENT_PLAN.md](NATIVE_100_PERCENT_PLAN.md). No phone/PWA/assets operations in this continuation.

Latest actual OS replay77449 terminal1/1 PASS32.793s: full raw before/after retained; normal Native primary/backup exact bytes unchanged, prior capture exact unchanged. Private0003 canonical state unchanged; primary/backup only lifecycle savedAt differences from existing willResignActive->services.flush. Actual8 JSONL rows prove8956ms background interval silence + resumed interval. NativeDiagnosticsOSReplayPreservation.json/Chronology.json. Initial hash-only baseline mismatch remains historical/inconclusive at old SDK host/install boundary; no reset/overwrite used. Actual replay Home screenshot exported and inspected: expected Native Home, no technical fault/web surface or obvious clipping; no transition/pixel/physical claim; native runtime unchanged from full1279 and iOS Release75024. Physical/internal DEV-menu/whole Source activation remain OPEN.

## Current Source app transport checkpoint

- One explicit app-lived NativeSourceApplicationRuntime owns Source context/common RNG/Date, FIFO/task adapter and single shared animation service. Quiet admission precedes external Date/RNG/resource/profile work; reentry and late takeover refuse; exact disposal restores default service. Ordinary/coder shipping defaults remain OFF.
- NativeStandaloneViewController owns optional runtime before Bootstrap and closes it after Bootstrap. DEBUG Source fresh-tutorial OS capability requires exact native product, dedicated Simulator, explicit CC_NATIVE_QA_SOURCE_FRESH_TUTORIAL=1 and valid isolated QA profile UUID. Only fresh construction/entry/first-step presentation enabled; full Source family/save/global activation not enabled.
- Connected current SDK68571 terminal0 **127/127 PASS20.700s**:9 root including actual Studio Intro->Home->Source tutorial on live app clock/FIFO;5 app runtime,37 clock,76 Star. No manual tick in live root test. Bee golden SDK99109 terminal0 **10/10 iterations PASS**.
- Actual OS Source UI33607 terminal0 **1/1 PASS36.394s**, two real launches using new private0004. Both screenshots exported and viewed: expected first-step Drag to stack/pointer/focus dimming; no web surface or technical error. No full pixel/transition/input/physical claim.
- Exact normal primary/backup and all eight prior QA files remain byte-identical across install+two OS launches; raw before/after retained. New private0004 generation2,45 tiles,50 moves,score0,incomplete step1. No save reset/restore used. NativeSourceOSProfilePreservation.json.
- Unsigned iOS arm64 Release88588 terminal0 BUILD SUCCEEDED. No linked WebKit/JavaScriptCore, WK classes/Web.bundle or private Source/profile QA environment strings. NativeSourceOSCapabilityIOSReleaseProof.json. Signing/physical/App Store acceptance OPEN.
- Historical full pre-capability SDK81350 terminal65:1286 tests,1 explicit producer skipped,5 assertions failed in one Bee40ms golden test. Independent SKView update during awaited texture prep invalidated manual-time expectation; only that test now pauses SKView before prep, authored values/drag assertions unchanged; production Bee untouched. BeforeStar archive/log retained.
- Withdrawn invalid missing-resource root fixture SDK42344 allowed default store access (preservation unproven), had3 assertions failing, then interrupted terminal75. Replaced with explicit private-store busy admission test; no reset/restore. Historical caveat retained, never claim broad preservation across that attempt.

**LIVE:** current complete Native SDK10223 in /tmp/native-source-os-capability-derived (native-source-os-capability-complete-sdk.log); current source full QA34319 (native-source-os-capability-full-qa.log). Poll exact handles to terminal; do not start second test runner or mutate same DerivedData while running. Earlier full QA72920 PASS precedes final fixture/OS capability checkpoint.

Next: finish current full gates; close actual Source guided input/subsequent steps and whole-app ordinary/Wild/resource/marker/canonical save admission on same app transport. Shipping Source defaults remainOFF. Huge cubes OPEN; grey Journey-to-Play flash LAST. No phone/PWA/media operations. Full objective remains NATIVE_100_PERCENT_PLAN.md; this is bounded startup proof, not completed migration.

Current receipts: NativeSourceAppTransportValidation.json, NativeSourceOSCapabilityValidation.json, NativeSourceOSProfilePreservation.json, NativeSourceOSCapabilityIOSReleaseProof.json; earlier before/code artifacts retained. Replay code archives only into NEW isolated directories, never overwrite current dirty work.
