# Journey 8 paper-only entry — 2026-09-16

## Physical evidence

Installed Stack to Six bundle `f153d45717fc6b6c678b6f7d37a79496c8e2f455cdfd95d74ac6d97363213a81`, iPhone13blue, process51503. User reported Cjelina8 would not load; clarified only paper background. No app restart/build/install was used to inspect the failure. Copied this app's WebKit local storage before intervention and attached LLDB to the existing native process, briefly pausing/resuming it to evaluate read-only WKWebView state.

- Document complete; `CC.state()` board8/level8/score0/moves50/45tiles. All45tiles alive and unique, all45grid references valid.
- Host visible/opacity1, canvas displayblock/visibilityvisible but **opacity0**. Board visiblefalse, animation list empty, Pixi ticker running.
- Local storage lacks board08 save. This alone did not establish whether the route was fresh or resumed. Native-readable logger resolved the ambiguity: **19:51:30.480Z** loadGameState reports no saved board08; **.481Z** continuation warns saved state not loaded and rebuilds. It was the **resume fallback**.
- Lifecycle trace: boot complete3867ms, later layout starts3990ms/completes3993ms, no entry animation. User's Journey viewport flags were settled.

Raw evidence: `logs/journey8-paper-20260916/` (localstorage-before.json, process/files metadata, live-pixi.txt, live-board-and-flags.txt, live-trace-and-errors.txt, live-recovery.txt, incident.json). This is runtime state, not screen video.

## Proven entry failure

Skip-rebuild boot begins entry preparation without registering an animation. The caller invokes showApp before loading; the entry commit is consequently a no-op. It then explicitly hides the canvas. When load returnsfalse, raw rebuildBoard constructs45tiles and registers an entry, but the fallback only waits/layouts and never commits it. Existing surface assertion ignores opacity, so it does not detect this paper-only outcome. A real-coordinator reproduction reaches pending=true/prepared=true/paints0; canonical commit produces paints1 and clears the entry.

## Live recovery

Invoked the existing `window.uiManager.showApp()` once to commit that prepared board. No forced opacity write, board regeneration, app restart or save reset. Post-read confirms sameboard8/45tiles/score0, canvasopacity1, stage/boardvisibletrue and45visibletiles. User explicitly confirmed: **“Da, igra se pojavila i radi.”** Debugger detached cleanly; app continued running. This emergency recovery is not a shipped permanent repair.

## Permanent source repair

- `src/main.ts`: all missing/failed saved-load fallback branches now await the canonical `startLevel` entry rather than raw rebuild plus a 100ms delay. Each replacement captures its own caller generation; superseded loads/layouts cannot commit or clear a newer entry. Continuations explicitly await the prepared visual commit.
- `src/modules/app-core.ts`: skip-rebuild restore boot no longer schedules the initial board save; direct/debounced/lifecycle save calls cannot serialize the temporary runtime while restore owns it.
- `src/modules/app-core-startlevel-save.ts`: delayed initial saves verify that their entry is still current.
- Successful Journey and Homepage resumes release the restore gate after their owned entry finishes. Independent review caught the previously missing Homepage release; the final repair includes it so later player moves can persist normally.

Two new regression suites exercise the actual continuation/save functions with the production entry coordinator and save helpers. They cover failed/missing loads, successful restoration, obsolete entry callbacks, normal fresh saves and preservation of an existing snapshot during restore. The old fallback ordering is reproduced as prepared but never painted.

The save-overwrite hazard is independently reproducible, but **not proven to have removed this incident's board08 save**. The recorded later layout also matches the old fallback delay; the original snapshot was already absent at attachment. Loader rejection/expiry and the original removal history remain unknown. The permanent entry fix handles rejected or missing saves without leaving the player on paper.

## Validation and delivery status

- `qa:fast`: PASS, 8 gates, 113 suites / 970 tests.
- Independent final review: PASS, 13 focused regressions; no remaining concrete introduced regression in scope.
- Final `qa:full`: PASS, all 13 gates, 322 suites / 2141 tests; Gameplay KING 24 suites / 306 tests, TypeScript, lint, source-only production build, bundle audit and native source guard. Initial full run caught one stale static assertion requiring the old Homepage flag-retention comment; it now checks commit/current-owner/release ordering. Final log: `/tmp/journey8-entry-full-final.log`.
- HTTP retrieval confirms `http://localhost:5174/src/main.ts` serves the new fallback helper and its five call sites. Browser visual acceptance has not been performed.
- Source/local web and `dist` changed. Installed phone, native Web.bundle and final app remain the old `f153d457…` package. Live rescue did not update that package.
- **NEEDS PHYSICAL TEST:** repeat Journey 8 Continue with both valid and missing/rejected save, then make moves and verify persistence after exit/relaunch. Web approval precedes the next phone delivery under `LIVE_DEBUG_WORKFLOW.md` unless the user explicitly reorders it.
