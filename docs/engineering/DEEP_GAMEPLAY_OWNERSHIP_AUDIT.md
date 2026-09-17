# Deep gameplay ownership audit

Date: 2026-09-16. Initial read-only gameplay audit, followed by user-authorized repairs. Three agents reviewed save/load, drag and special transactions; primary reviewed terminal flow and independently reran the executable probes. Original findings below describe the pre-repair source. Earlier dirty repairs are preserved; assets and native/device state are unchanged.

## Verdict and evidence boundary

**Initial audit: FAIL — source ownership gaps demonstrated below.** Existing deterministic tests pass, but do not cover these interleavings. These probes execute actual current functions/branches with controlled platform/dependency substitutes; they demonstrate stale mutation/callback boundaries, not the frequency or complete physical navigation sequence on iPhone. All primary findings are pre-existing code, not newly introduced by the animation/audio repairs.

### P1 — canceled Magnet/Honey fanout can spawn onto the replacement board

Owner: `src/modules/app-merge.ts:1482`, `:1555`, `:1602`.

Child spawn waits return false when `clearAllAppTimeouts` cancels them. `Promise.all` still resolves normally, and insufficient successful spawns enters the fallback branch. Fresh `openAtCell` calls then use current board state instead of the retired transaction's state. The probe canceled two actual tracked child waits and recorded two new calls on `new-after-restart`, at cells (2,0) value2 and (3,0) value4, even with the old destination destroyed.

Evidence: `/tmp/magnet-cancelled-fanout-audit.cjs`. Proposed fix: propagate cancellation as transaction cancellation, capture/revalidate run generation at every async mutation boundary, and prevent fallback spawning for canceled owners. Preserve ordinary genuine spawn-failure recovery.

### P1 — stale saved-board restoration reaches a newer run

Owner: `src/modules/app-core.ts:16500` and `:16511` (`loadGameState`).

Saved data is selected before awaiting app readiness. After readiness resolves, restore uses current global tiles/grid/board without checking the original run/mode/generation. Controlled replacement during the await passed a Journey1 snapshot to restoration targeting a newer Arcade7 board. The restore applier was instrumented to record and stop at that boundary; full user data corruption was not performed.

Evidence: `/tmp/save-load-generation-audit.cjs`. Proposed fix: bind load to immutable mode/board/generation and revalidate after all awaits and before restoration, state updates and recovery callbacks. Keep normal key isolation and save schema intact.

### P1 — old Clean Board completion releases a newer terminal owner

Owner: `src/modules/app-core.ts:1735`, `:1741` in `triggerCleanBoardFlow`.

An older flow awaits `runEndgame`. After abort/restart permits a newer flow, completion of the old await still clears pending Clean Board, visual suppression and `busyEnding` in its unconditional tail/finally. Probe: newer flow pending with token1 and busy=true; resolving old token0 produces busy=false and clears the shared marker/suppression.

Evidence: `/tmp/clean-board-owner-audit.cjs`. Proposed fix: only the matching abort/generation owner may clear terminal flags or completion markers; local cleanup of the retired flow must remain possible.

### P1 — delayed board recovery invokes Clean Board in a replacement run

Owner: `src/modules/board-recovery.ts:281`, `:316`; callback binding in `src/modules/app-core-load-recovery.ts:52`.

Recovery uses an untracked 500ms timer with no originating-run guard. Replacing Journey1 with Arcade7 during that wait still invokes the completion callback in Arcade7. The called Clean Board function captures the current token when invoked, so its internal token cannot reconstruct the stale request's origin.

Evidence: `/tmp/save-load-generation-audit.cjs`, recorded mode arcade_home, board7, generation2 for a recovery originating on Journey1. Proposed fix: tracked cancellation plus originating-generation verification immediately before all recovery callbacks.

### P2 — stale NO MOVES exit timer removes a newer warning

Owner: `src/modules/splash-text-overlay.ts:1135`, `:1200` and `cleanupNoMovesOverlay` at `:858`.

The exit promise's fallback timer calls global cleanup without an overlay identity. Explicit cleanup/replacement does not settle/cancel that timer. Probe: create old overlay, start exit, clear it, create new overlay, execute old fallback timer; the new overlay changes from connected=true to false. This proves incorrect UI cleanup, not an incorrect fail decision.

Evidence: `/tmp/no-moves-overlay-owner-audit.cjs`. Proposed fix: exit ownership tied to captured overlay/generation and cancellation settlement; old completion cannot remove new DOM or reset its flags.

### P2 conditional input robustness — release coordinates do not establish a drag

Owner: `src/modules/drag-core.ts:1923`, `:2051`.

Actual `onUp` rejects as not-moved if a matching pointer releases 200px from pickup but no pointermove was delivered. The final pointerup coordinates do not update movement/pose before that decision. This matters only under that event delivery pattern; real iPhone occurrence remains unmeasured.

Evidence: `/tmp/drag-up-final-position-audit.cjs`, snapbacks1, rejection not-moved, pointer(200,0). Proposed fix: process valid final release position through existing movement/hit-test ownership before deciding tap/drop; preserve foreign pointer rejection and canceled-drag semantics.

## Lower-confidence defensive observations

- `PostCommitBoardRevisionGuard.capture` returns null after initial getter failure/nonfinite value, but `isCurrent` returns true. Executable guard probe permits a callback afterward. Current production getter is a direct numeric variable (`app-core.ts:9781`); no actual invalid-getter trigger was found. Treat as low-priority defensive hardening, not a proven live gameplay incident.
- Transaction/input TTLs use wall time. Long background suspension deserves physical interruption testing; no normal-path duplicate mutation was established from TTL alone.

## Checks that passed

- Fresh Gameplay KING audit: 24 suites /305 tests PASS (`/tmp/deep-gameplay-audit-king.log`).
- Agent save/lifecycle checks: 7 suites /43 tests PASS. Storage keys are mode-separated; schema validation precedes destructive restoration; Journey completion tombstones do not block Arcade; queued retired foreground resumes are guarded.
- Agent drag/transaction checks: 6 suites /54 tests PASS. Foreign pointer events rejected, pending frame work retired at release, snap-back canceled on fresh pickup, restart retires pointer/portal owners, stale token release cannot release a newer transaction.
- Parent reran all five probe files above and confirmed their outputs. Temporary probes are controlled audit evidence, not yet durable repository regression coverage.

## Original implementation recommendation

Fix originating-run ownership together at save/load, recovery, terminal completion and canceled special spawning; add adversarial regressions that first reproduce each boundary, then ensure no old owner writes a new run. Fix NO MOVES overlay identity and separately validate final pointer coordinates. No blanket gameplay rewrite, save schema change or visual redesign is needed. Full QA and a natural iPhone interruption sequence remain necessary after implementation. Prior 2064-test full PASS is baseline evidence, not closure of these newly discovered cases.


## Authorized repair pass

The six findings above were repaired together at their actual asynchronous boundaries. Load, recovery and terminal callbacks carry their originating run/entry ownership; superseded operations cannot become fresh fallback operations. The save schema and ordinary progression rules stay intact.

- Magnet/Honey fanout propagates cancellation through awaited children, guards normal and fallback spawns, and scopes delayed work and caller cleanup to the original run. Genuine spawn failure retains the existing recovery path.
- Saved-board restoration rechecks ownership after readiness, drag and layout awaits, including the helper-internal writes and delayed entry/recovery callbacks. Callers distinguish supersession from an invalid save before rebuilding or showing gameplay.
- Clean Board completion and callbacks cannot clear newer terminal flags, alter its HUD or release its input.
- Recovery checks originating ownership after its settle delay and immediately before triggering Clean Board. A superseded delay preserves the pending receipt. The bounded 500ms delay can expire harmlessly; it cannot mutate the replacement run.
- NO MOVES exit owns its captured overlay and both exit clocks. Explicit cleanup cancels clocks and settles the promise; a delivered retired callback is harmless. The outer fail-flow timeout also checks its owner.
- Pointer release feeds finite Pixi global coordinates through the existing movement owner before normal drop decisions. Foreign pointers, cancellation, tap thresholds and board-local geometry remain covered.

Durable regressions execute production functions or event closures with controlled dependencies: `saved-load-generation.test.ts`, `stale-terminal-and-magnet-ownership.test.ts`, `no-moves-exit-ownership.test.ts`, and `drag-release-position.test.ts`. They cover replacement during awaits, cancelled fanout, valid recovery/success, stale clock delivery and missing/coalesced movement. They do not establish real-device occurrence rates, thermal behavior or subjective smoothness.

Independent review caught and corrected two issues in the repair itself: an original-run-only guard prevented a legitimate next-level retry, and cold boot could invalidate its own requested board before adopting the new entry. Terminal presentation stays tied to the original run; permitted next-level retries use a separately captured child entry. The endgame running flag has its own completion identity, allowing normal next-level cleanup without clearing a newer terminal owner. Stale internal layout/HUD callbacks and Arcade recovery finalizers are also guarded.

The low-confidence revision-getter case was hardened to fail closed after an invalid capture, with regression coverage; it remains a defensive improvement rather than a proven physical incident.

Independent final review: **PASS** within the repaired scope; two production-function suites independently rerun with **35 tests PASS**. Layout's Event-compatible signature preserves its resize-listener use.

Validation boundary: caller boot/navigation before `loadGameState` starts, and Journey's separate global start dispatcher, were not rewritten or proven race-free. The new lease covers load-owned work and its caller continuation; it is not a universal navigation transaction. Browser automation was unavailable. Real iPhone touch, audio, thermal/brightness and interruption acceptance remain **NEEDS PHYSICAL TEST**.

## Final integrated validation

**PASS — all 13 deterministic `qa:full` gates.** Gameplay KING: **24 suites /306 tests**. Complete test run: **318 suites /2113 tests**, including **49 additional regressions** relative to the 2064-test baseline. TypeScript, unused-code audit, lint, asset-preservation audit, static visual contracts, production build (**1042 modules**, native sync disabled), built bundle audit and authoritative native source guard all pass. Evidence: `/tmp/gameplay-ownership-fixes-full-final.log`.

Intermediate `qa:fast` and first full runs exposed stale structural assertions plus a transient parse state during concurrent edits. Final tests preserve the original gameplay assertions and now locate the actual boot async boundary through TypeScript AST, excluding uninvoked nested helpers. The final gate ran after runtime edits were stable.

Local `dist` refreshed. HTTP **200** at `http://localhost:5174/src/modules/app-core.ts` and the served `savedBoardLoadRequest`, `startOwnedNextLevel`, and Event-safe layout markers confirm current source is served. This is HTTP/source verification, not browser gameplay interaction. No assets, native `Web.bundle`, native app build or physical installed app changed. Web approval remains required before iPhone delivery.
