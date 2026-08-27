# Stack to Six App Core Ownership Map

Updated: 2026-08-27
Behavioral authority: `GAMEPLAY_KING_CONTRACT.md`

## Purpose

`src/modules/app-core.ts` is the gameplay orchestrator. It is not a generic
utility bucket, and it must not be split through a broad rewrite. This map
records safe ownership boundaries for incremental strangler work while the
accepted gameplay remains locked.

## Protected orchestration zones

The following remain protected in `app-core.ts` unless a separately
characterized owner replaces them with focused tests:

- clean/fail and NO MOVES handoff;
- special-dice transactions and regular merge handoff;
- merge, merge-six continuation and wild-meter spawn ordering;
- final residual tiles, ghosts and terminal presentation preparation;
- start/restart/rebuild generation changes;
- atomic save/load coordination and recovery;
- RuntimeGameBridge publication.

These zones may delegate to existing canonical modules, but cleanup must not
create a second decision owner or reorder gameplay commit, visual tail, input
release, HUD reward or terminal presentation.

## Established extracted owner families

- `app-core-startlevel-*`: start-level preparation and post-commit steps.
- `app-core-load-*` / `app-core-save-*`: typed save/load operations under the
  orchestrator's atomic boundary.
- `app-core-board-*` / `app-core-exit-*`: board construction, visibility,
  exit selection and cleanup adapters.
- `app-core-merge-*`: focused score, combo, haptic and last-merge adapters;
  final decisions remain with the KING canonical owners.
- `app-core-utils.ts`: tracked timers, frames, intervals and listeners plus
  pure board utilities.
- `app-core-mobile-save-lifecycle.ts`: sole owner of boot-scoped `pagehide`,
  `beforeunload`, `visibilitychange`, `pause` and `resume` save/load listeners.

## Extraction rules

Every new extraction must:

1. identify all direct and indirect call sites;
2. preserve call order, fallback behavior, timing and cleanup;
3. accept dependencies explicitly instead of creating new global state;
4. keep one owner for every listener, timer, ticker, animation and retained
   object;
5. add focused characterization or behavioral coverage;
6. run `qa:gameplay-lock`, `qa:fast` and `qa:full`;
7. leave assets untouched under the active KING preservation order;
8. keep physical-only claims as `NEEDS PHYSICAL TEST`.

## Completed incremental seam: mobile save lifecycle

The sixth post-KING cleanup moves the already active mobile save/resume
listener installation and teardown into `app-core-mobile-save-lifecycle.ts`.
It retains the same five events, exact retained handler references, save-only
when hidden behavior and tracked 100ms resume load. `app-core.ts` remains the
caller and supplies `saveGameState` plus the existing tracked-timeout owner.

## Removed proven no-op: boot idle-check shim

The seventh post-KING cleanup removes `scheduleIdleCheck()` and its sole boot
call after repository and history checks proved that the function was always
empty and owned no timer, listener, state, storage key or external adapter.
Active tile, board, special-dice and Journey idle motion owners remain
unchanged. The gameplay audit prevents this misleading shim from returning.

## Final dead-surface closure

The eighth post-KING cleanup completes the current large-file dead-surface
audit. It removes two unreachable, non-exported animation implementations from
`app-merge.ts` (`pulseBoardZoom` and `landPreBounce`) while retaining the
canonical exported owners in `merge-utils.ts`. It also removes the unused
Journey `figmaToPercent` converter and its private width constant while keeping
the active frame-height/top-position conversion.

`isTerminalEndgameInteractionLocked` remains `KEEP` because HUD imports it.
`startFreshGame` remains `UNKNOWN/KEEP` because it is an exported compatibility
entry point; absence of a static repository importer is not sufficient proof
to remove a public module surface. Further `app-core.ts` decomposition is
deferred to separately characterized packages rather than treated as dead
code.
