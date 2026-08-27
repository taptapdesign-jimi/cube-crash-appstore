# Stack to Six Post-KING Cleanup Closure

Closed: 2026-08-27
Behavioral baseline: `gameplay-king-v1` / `v2.0.653`
Scope: source hardening packages 1-8

## Closure verdict

The planned post-KING source cleanup cycle is complete. The immutable KING
checkpoint remains the recovery authority, accepted gameplay is preserved, and
the repository now has stronger typed runtime boundaries, explicit ownership
documentation and regression locks around the removed legacy surfaces.

This closure does not mean that the App Store release process is complete. It
closes the current source-cleanup program only.

## Completed work

1. Characterized saved-game resume routing and typed the RuntimeGameBridge.
2. Removed the unused parallel `src/types/main.ts` declaration surface.
3. Migrated protected bridge callers to the typed runtime contract.
4. Migrated remaining typed state, HUD, score, restart and layout callers.
5. Removed unpublished `CC.STATE`, `CC.combo` and `CC.makeBoard` fallbacks while
   retaining the active `_endgameFlowRunning` compatibility guard.
6. Extracted boot-scoped mobile save/resume listener ownership into
   `app-core-mobile-save-lifecycle.ts` with focused lifecycle tests.
7. Removed the proven-empty `scheduleIdleCheck()` boot shim.
8. Removed unreachable local merge-animation duplicates and the unused Journey
   Figma width converter while retaining their active canonical owners.

## Protected behavior

No gameplay/end-game decision, drag or input rule, save schema, special-dice
transaction, animation cadence, asset, native source, bundled `Web.bundle` or
installed iPhone app was intentionally changed by this cycle. The protected
zones and future extraction protocol remain defined by
`GAMEPLAY_KING_CONTRACT.md` and `APP_CORE_OWNERSHIP_MAP.md`.

The exported `startFreshGame` compatibility entry point is `UNKNOWN/KEEP`: no
static importer was found, but absence of a repository caller is not sufficient
proof that a public surface is safe to remove. `isTerminalEndgameInteractionLocked`
is `KEEP` because it has a live HUD importer. Further `app-core.ts`
decomposition requires a separately characterized package and is not part of
this closure.

## Final deterministic evidence

- `qa:gameplay-lock`: PASS, 24 suites / 268 tests.
- `qa:fast`: PASS, 22 suites / 250 changed tests.
- `qa:full`: PASS, 198 suites / 1248 tests.
- Production build: PASS, 954 modules; native sync skipped.
- Built-bundle audit: PASS.
- Authoritative Stack to Six native-source guard: PASS.

Physical animation feel, touch behavior, sustained FPS, thermal behavior and
memory growth remain `NEEDS PHYSICAL TEST`; deterministic tests cannot close
those claims.

## Remaining release work

Before App Store submission, separately close the native marketing/build
version, Release signing/archive validation, final privacy and permission
declarations, dormant private development URL handling, App Store Connect
metadata, TestFlight acceptance matrix and physical performance/thermal review.
The authoritative checklist is `APP_STORE_RELEASE_READINESS.md`.

This source-cleanup closure does not guarantee Apple approval; Apple evaluates the final
archive, current policy compliance, declarations, metadata and runtime behavior.
