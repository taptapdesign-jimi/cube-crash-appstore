# Native stability, feedback and audio — 2026-10-21

Scope: all Journey Worlds and shared Arcade/Home owners. Recovery reference remains immutable `native-benchmark-v9`. Original assets, saved progress and global Journey star ranking v1 are preserved.

## Implementation checklist

- [x] Home navigation: rapid selection cannot commit an independent contact squash into route/layout transforms through background/resume.
- [x] Haptics: accepted navigation, World, Back and Close contacts use the existing protected human-contact path. Decorative Home/gameplay impact budgets remain bounded and Settings/foreground gates remain authoritative.
- [x] Ordinary idle smoke uses actual painted tile zPosition, rather than logical stack depth, to stay behind the tile even in row zero and after resume.
- [x] Fish original SVG handoff: retain static fallback until the replacement has contents, geometry and a visible window; ordinary pause/drag does not reset the admitted phase.
- [x] Fish decoding: retain a cancelled worker's occupied slot until it drains, preventing rapid pause/resume from overlapping full-strip decodes within a board route.
- [x] Home slider: add authored swoosh only on a changed selection; tapping the selected icon keeps its contact cue without a swoosh.
- [x] Home hero tap: original human smile plus one original Nala cue; CTA keeps its own sound.
- [x] Modal open/close: additive Journey card air source through the existing audio owner, retaining authored feature cues. Covers gameplay pause/score/combo/Backpack/detail, Arcade selection, Settings Privacy/DEV panel/pickers, results/rewards, tutorial completion and recovery. Journey cards keep their existing matching layered entry/return; front-drag close adds the missing air.
- [x] Physical crash receipt: remove unnecessary synchronous weak-capture closure at the symbolicated Backpack icon refresh site; retain normal weak ownership in genuinely asynchronous callbacks.

## Crash evidence and limits

Read-only retrieval from the connected phone preserved its running state. `Stack to Six-2026-10-21-122308.ips` records EXC_BAD_ACCESS/SIGSEGV at12:23:08 after a12:16:20 launch. Exact dSYM UUID `0C1CB83F-9892-3FC1-A5BB-666C78C7205E` matches the crashing binary. Main-thread caller chain is HUD contact → presentBackpack → refreshBackpackAlert. At image offset2190712 / function+1548, disassembly identifies the synchronous closure's `swift_unknownObjectWeakLoadStrong` return (`NativeBoardScene.swift:262` in that binary). The update now calls applyBackpackAlert directly using the already-strong local node. This receipt is not a Jetsam termination and does not establish a general memory leak or prove the user's earlier merge-time crash had the same cause.

Full-strip cancellation work is a separate bounded-resource correction, not an inferred cause of this crash. Raw device logs and private container identifiers remain in /tmp, outside versioned documentation.

## Review and validation

- PASS `qa:full` `/tmp/native-fixes-oct21-full-complete.log`: KING24 suites/330 tests, total530 suites/4010 tests and all selected admission/build gates. Native identity/original-asset audit PASS `/tmp/native-fixes-oct21-ios-final.log`.
- PASS combined affected SDK suite106/0 `/tmp/native-fixes-oct21-sdk-complete.log`: Home real input, rapid mounted route selection, protected haptic contacts, Fish original72-frame/first-paint and bounded cancelled decode, audio Settings/natural voices, actual Forest04 Backpack8x modal roundtrip, discovery/return, HUD Close, result18 and reward21 (including exactly-once modal air). Earlier Arcade navigation4 and crate6 tests also passed in `/tmp/native-fixes-oct21-sdk2.log`.
- PASS current unsigned iOS Release compile and compiled Native dependency/packaged-asset audit `/tmp/native-fixes-oct21-release.log`, `-release-audit.log`. Exact .native identity; dSYM UUID `C3DD2FB3-4D77-3BFE-B35B-B5C3B4ACA1FB`. Static optimized disassembly confirms direct strong-local apply calls, without the former pair of synchronous closure weak loads. Its remaining weak load belongs to the existing render-host guard. Compile-only artifact; no signing, phone installation or phone launch.
- Existing catalog groups are independently equal before/after regeneration; only modalWhoosh and homeCharacter0/1/2 were added. Post-implementation review found no new recurring-work owner, save/schema mutation or original-asset modification. Worker cancellation/late publication, foreground/Settings gates and idempotent disposal remain owned by existing components.
- An exploratory broader SDK run also exposed eight unchanged NativeBootstrap fixtures with old SKView, direct Home→gameplay and tutorial/save timing/policy expectations. Those fixtures were not silently weakened or production policy changed to satisfy them; that broader run remains FAIL and needs a separate fixture migration/baseline comparison. Final affected-path results are recorded in CURRENT_HANDOFF. Early new-test failures were corrected by mounting/awaiting the real entry and modal callbacks and checking the rendered settled pose rather than Core Animation key removal.

## Acceptance

PASS normal complete-tree Debug build, verified .native install-over and normal launchPID78873 on retained Simulator1018BE2D. Both save files byte-identical across install/launch; all meaningful state remains intact after review. CUA Home rapid selection/hero→Journey→Home and visible Silent Mode Off verified. Automated and Simulator receipts are recorded in CURRENT_HANDOFF.md. Physical haptic feel, speaker mix, first-frame motion and sustained memory/thermal/crash-free play require physical acceptance. No phone installation is implied by source/tests or Simulator delivery.

## Fast review

1. Home: rapidly alternate all three navigation icons, repeat the selected one, then background/return. Icons settle normally; swoosh accompanies changed slides only. Tap hero artwork for human/Nala cues.
2. Journey World → Unit → gameplay: repeat Back/Close and modal open/close; each accepted contact retains haptic and modal air plus existing sound.
3. One Lucky Drop and Slow Burn: watch Fish arrival and ordinary idle smoke, including after another app/background. No empty Fish handoff; smoke stays behind its tile.
4. Forest04: repeatedly open/close Backpack/details, play merges, switch Worlds/modes and background/return. Check board/progress are preserved; longer phone sessions assess stability.
