# Native Source tutorial sheet/pointer checkpoint — 2026-10-09

## Recovery

Recover verified pause source/media, then EntrySourceDelta, then TutorialSourceDelta. Apply ONLY the eleven files in `TutorialIntroSourceDelta.tar.gz` after validating `TutorialIntroManifest.json` base hashes; null means the new file must be absent. Verify archive and every resulting hash. Never overwrite dirty live source or a later composition with this full-file delta.

Source remains private at `/tmp/native-resume-20261009/source`. All647 Native Swift files were verified byte-identical to the SDK host and final Source QA snapshot. Whole Source flags and new `sourceTutorialIntroEnabled` are **OFF by default**. Fresh first-step intro requires actual prior Source tutorial preparation and the current APP scope.

## Connected owners

`NativeTutorialOwner` is the existing UI/input owner; canonical tutorial state remains in the Engine. It mounts the original Native sheet/pointer artwork and geometry. `NativeSourceTutorialIntroOwner` captures one generation and reuses Scene's actual app timeout registry/FIFO. It inserts original independent pointer1200 and sheet800 timers in original order. These wall timers stay independent of paused GSAP. The existing APP GSAP transport owns sheet420 back.out(1.25), image pop alpha80 sine.out plus scale/rotation220 back.out(2.2),110 power2.out,160 back.out(1.7), and the separate next-RAF focus refresh.

Fresh first-step pointer shell now uses one explicitly typed repeating APP lazy-tween root: movement1.18, repeat delay.12, power1.inOut and yoyo. It does not use the prototype CoreAnimation hint. General finite registration still rejects infinity; no second display link or timer transport was created. Hide cancels the exact shell/image roots; guided snap-back creates the authored fresh pop/hint. Background retains roots without foreground delivery; global pause affects GSAP separately from wall timeout/raw RAF. Stale current scope retires hint on next actual delivery. Disposal and step replacement cancel exact timers/roots/RAF. Sheet resize preserves percent translation; handoff to the existing next-step exit samples current presentation/model paint rather than assuming zero.

Original art/fonts, save state, input decisions, audio and haptics are unchanged. One visible first-step shell is the only recurring population added to APP transport. Native subsequent-step presentation and monitor admission remain separate.

## Proof and boundaries

- Final actual SDK **53/53 PASS**, zero skips/failures: intro11, actual tutorialBootstrap1, ordinary entryBootstrap1, Scene7, activation6, existing clock23 and ticker4. Result `/tmp/native-resume-20261009/intro-admitted-sdk.xcresult`, durable `intro-admitted-sdk.log`.
- Intro comparator checks **1039 numeric GSAP channels** against literal production-benchmark-v9 recipes using installed GSAP3.13.0. JSON records original source hash and version. `TutorialIntroOracle.cjs` is the repeatable generator with local paths; this proves recipes, not DOM raster or phone timing.
- Two actual UIKit overlay rasters (390×844 and430×932) exported from final SDK to `TutorialIntroRasters/`. Inspected: sheet title/subtitle and pointer are present without text clipping. These are model-layer overlay images, not physical gameplay GPU/FPS or full-board visual parity.
- Exact final Source full QA verdict/log is recorded in CURRENT_HANDOFF and `intro-admitted-full.log`, separate from SDK/physical evidence.
- Earlier21/21,51/51,53/53 runs are retained as distinct scopes; do not sum them. One extra interruption assertion initially inspected CoreAnimation on a detached view and failed. Fixture now mounts a real UIWindow and reads NSNumber animation channels without relaxing the position assertion; final53/53 passes. Raw failed `intro-settled-sdk.log` retained.

SDK uses the prior documented QA-only resource workaround: original project ibtool previously stalled; unchanged precompiled storyboards/Assets.car are reused by separate QA host. Native Swift is exact. This is **not** fresh original-project resource compilation, Release or physical acceptance. See TutorialREADME for host reconstruction and hashes.

No physical phone install, PWA sync, main/index/remote operation or original artwork mutation. **NEEDS PHYSICAL TEST**.

## Next

Guided-phase Source HUD dim is now connected in [TutorialHUDREADME.md](TutorialHUDREADME.md). Next: real first-step monitor/state/input/exit boundaries, full HUD restore, subsequent steps/input/cleanup and tutorial resume/restart. Existing later-step sheet exit/transition still uses prototype timing; this batch closes only fresh first-step entry/pop/hint, with safe interruption into that existing path. Then original Magnet/regular-six/statistics/TNT order.

Grey Journey→Play flash remains **OPEN and LAST**.
