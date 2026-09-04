# Stack to Six Gameplay KING Contract

Status: **ULTIMATE BEHAVIORAL AUTHORITY**
Established: 2026-08-27
Behavioral reference: Git commit `17d42949225380ac8a3ee8cef9045af10d2a74ff` (`v2.0.653`)
Product: **Stack to Six**

## 1. Authority

This document is the highest-priority contract for Stack to Six gameplay behavior. It protects the real, user-accepted gameplay that exists at the behavioral reference above while allowing implementation details to be improved safely.

If a cleanup, refactor, optimization, feature, migration, test, comment, or older document conflicts with this contract, **this contract wins** unless the user explicitly changes the desired gameplay behavior.

This is a behavioral baseline, not a claim that every visual surface of `v2.0.653` supersedes the immutable production recovery tag in `APPROVED_PRODUCTION_BASELINE.md`. The historical `production-benchmark-v2.0.636` must remain preserved.

## 2. Protected scope

The following behavior is locked:

- board state, grid membership, active-tile classification, stack depth, tile visibility and tile destruction;
- legal and illegal drag/drop behavior, hit ownership, pointer ownership and drag cleanup;
- regular stack and merge rules;
- merge-to-six spawn behavior and final-merge behavior;
- every registered wild/special archetype's gameplay handoff;
- clean-board, stuck/NO MOVES, fail, Play Again and next-board decisions;
- Journey versus Arcade routing and progression ownership;
- start, restart, load, resume, background/foreground and navigation lifecycle;
- save compatibility and recovery behavior;
- input lock scope, acquisition, revalidation and release;
- ordering between gameplay commit, visual tail, HUD/star reward and terminal presentation.

Animation art direction is governed by `JOURNEY_ANIMATION_CONTRACT.md` and accepted feature-specific contracts, but animation code may never change gameplay decisions or leave input/state ownership behind.

## 3. Explicit asset preservation order

Until the user explicitly revokes this order:

- **MUST NOT** optimize, recompress, resize, rename, deduplicate, relocate, delete or replace assets;
- **MUST NOT** use asset size, duplication, filename style or folder structure as a cleanup blocker;
- **MUST NOT** remove an asset merely because static analysis finds no direct import; runtime-relative lookup, native packaging and future authored use remain possible;
- asset work is reserved for the user's separate final pre-Apple session;
- release audits may verify that required files are packaged, but may not mutate or recommend cleanup of the asset library in this phase.

This order must survive later folder/code cleanup. A general request to "clean the project" does not authorize asset changes.

## 4. Canonical owners

There must be one decision owner for each gameplay concern.

| Concern | Canonical owner | Contract |
| --- | --- | --- |
| Gameplay snapshot | `gameplay-snapshot.ts` | Classifies the live board once for a decision. |
| Continue/wait/spawn/complete/fail | `gameplay-resolution-engine.ts` | Central decision authority. No new parallel terminal resolver. |
| Final merge | `final-merge-rules.ts` plus resolver | Finality comes from the active physical merge snapshot, not a local animation flag. |
| Legacy end-game observation | `endgame-checker.ts` | Compatibility/diagnostic input; must not independently override the resolver. |
| Input permission | `input-gate.ts` | All gameplay-wide and wild-only locks pass through the shared gate. |
| Drag lifecycle | `drag-core.ts` and installed drag owner | One active pointer/drag owner; cleanup before replacement. |
| Tile removal | `tile-lifecycle-service.ts` and established board helpers | Grid, tile list, input and display ownership must be cleared coherently. |
| Run origin | `run-mode.ts` | Arcade is `arcade_home`; Journey is `journey`. |
| Terminal presentation | `endgame-flow.ts` via the central app-core handoff | One clean/fail/continuation handoff. |
| Board generation lifecycle | `app-core.ts` plus extracted `app-core-*` owners | Old async work cannot cross a new gameplay generation. |
| Save/load | `app-core-save-*`, `app-core-load-*`, atomic storage/recovery owners | Save schema changes require compatibility or an explicit migration. |

`app-core.ts` remains the orchestrator. New business decisions must not be added there when a canonical decision owner already exists.

## 5. Locked gameplay behavior matrix

### 5.1 Regular drag, stack and merge

| Scenario | Required result |
| --- | --- |
| Valid regular pickup | Drag starts when the tile is active and no applicable input lock exists. |
| Valid stack/drop | Mutation commits exactly once and the tile remains bound for subsequent legal play. |
| Valid regular merge below six | Merge commits, score/combo/state update once, then normal continuation runs. |
| Regular merge equals six with other active blockers | It is **not** terminal; required spawn/continuation occurs. |
| Only physical regular pair sums to six | It is final complete; no extra gameplay tile is spawned. |
| Illegal target/drop | Board state is not mutated and the source returns through the canonical drag cleanup. |
| Rapid sequential drags | A completed accepted drop cannot be rejected by a stale previous owner or stale input lock. |

Regular tiles use a stable parent hit area and child visuals do not intercept the regular hit target. Special dice may retain their explicitly authored child interaction path.

### 5.2 Wild and special dice

| Scenario | Required result |
| --- | --- |
| Wild/special plus regular reaches final six | Resolver completes the board when those are the only physical active merge participants. |
| Magnet still has playable pull/merge work | Continue/wait; never complete early. |
| Special gameplay transaction is active | Terminal evaluation defers until the transaction releases or is safely cancelled. |
| Visual tail remains after gameplay commit | Ordinary input may resume according to the registered gate scope; a visual tail alone must not create a global terminal lock. |
| Hidden/pending-removal residue | Must be classified by canonical active-tile rules and must not create false finality or false stuck. |
| Locked future placeholder | Must follow canonical placeholder classification and must not invent a playable physical blocker. |

New visual variants must map to an existing gameplay archetype unless the user explicitly requests a new gameplay rule.

Forest Journey Stages use one cumulative authored reward pool and do not emit
generic Juice or Magnet dice. Stage 01 contains Wild Star only. The first
wild-meter reward on Stage 02/03/04/07 respectively guarantees Mushroom,
Flower, Honey, and TNT as that Stage's introduction; subsequent rewards use
only Wild Star plus the Forest rewards introduced up to that Stage. Mushroom,
Flower, and Honey retain their registered Juice/TNT/Magnet gameplay archetypes,
while their authored visuals remain the player-facing dice.

### 5.3 Clean board and final merge

- Resolver output is authoritative.
- A resolver error **MUST fail closed** to `wait`; legacy output cannot authorize clean or fail.
- Legacy last-merge booleans may remain diagnostic but cannot override central final-merge rules.
- A final regular or final wild merge must preserve its final snapshot through animation/residual cleanup.
- Clean presentation occurs once through `triggerCleanBoardFlow`/the canonical terminal owner.
- No duplicate modal, reward, next-level or save commit may occur.

### 5.4 NO MOVES and fail

- Candidate stuck state does **not** immediately own all input.
- The confirmation window remains playable.
- Immediately before fail presentation, the board is re-snapshotted and re-resolved.
- `terminal-no-moves` is acquired only at the atomic final commit boundary.
- After acquiring the lock, the board is checked again before presenting fail.
- Any board mutation, active drag, wild continuation, gameplay transaction, end-game guard or changed signature cancels/defers the candidate.
- Cancellation releases every flow-owned lock and schedules safe reevaluation.
- Resolver failure during stuck confirmation fails closed and retries; it never falls back to an unverified fail.

### 5.5 Merge-six rescue

The current stuck-path repair is protected compatibility behavior:

- an unlocked, non-special, non-final lingering regular six may be consumed only when other active tiles prove the board should continue;
- its grid cell is captured before removal;
- removal clears grid/input/display/tile ownership through established helpers;
- one mandatory replacement attempt is made at that cell;
- successful replacement clears the pending repair marker and restarts end-game evaluation;
- final-merge sixes, magnet-owned sixes and pull-owned sixes must never enter this rescue;
- failure to respawn may continue stuck evaluation only through the existing guarded path.

This rescue may not be deleted or generalized until an equivalent tested canonical resolver/spawn transaction replaces it.

### 5.6 Journey and Arcade

- Arcade progression must not write Journey progression.
- Journey completion targets the current Journey board and returns through Journey-owned routing.
- Arcade completion advances the Arcade run/stage through its owner.
- Shared gameplay rules remain identical unless a mode difference is explicitly represented by `run-mode.ts` and tested.
- Internal persisted `board` identifiers must not be renamed merely to match player-facing Stage/Round terminology.

### 5.7 Restart, Play Again, load and navigation

- A new board increments/changes generation ownership and cancels old end-game timers, animation frames and level-flow work before awaiting new entry work.
- Restart and Play Again clear transient gameplay locks, special transactions, stale tiles, FX owners and pending terminal state.
- Save loading either restores one coherent board or enters the existing fresh-board recovery path; it must not combine two partial boards.
- Navigation cleanup must not destroy application-wide shared services needed by the next screen.
- Background/foreground recovery must not allow an old callback to mutate the current board.

## 6. Runtime bridge policy

`window.CC` and named window hooks are compatibility adapters, not an invitation to add global state.

- Existing bridge methods remain until all call sites and recovery paths are migrated.
- New gameplay modules should use typed imports or injected capabilities instead of adding globals.
- A bridge method must delegate to one canonical owner; it must not contain a second implementation.
- Removing a bridge requires repository call-site proof, runtime/console compatibility review and `qa:gameplay-lock`.
- The current inventory and migration classification live in `RUNTIME_BRIDGE_CONTRACT.md`.

## 7. Legacy strangler protocol

Every legacy candidate must be classified before modification:

- `KEEP`: active canonical or safety behavior;
- `ADAPTER`: active compatibility bridge delegating to a canonical owner;
- `REMOVE`: proven no-op/unreachable with no runtime or external contract;
- `UNKNOWN`: ownership is unclear; do not change it.

Removal requires all of the following:

1. direct and indirect call-site search;
2. runtime flag/event/storage-key search where applicable;
3. replacement or proof of no behavior;
4. focused regression test;
5. `qa:gameplay-lock` and `qa:full` pass;
6. physical test when touch, animation feel, lifecycle, performance or native behavior can change.

No big-bang rewrite of `app-core.ts`, `drag-core.ts`, `endgame-flow.ts`, `input-gate.ts`, the resolver or save/load owners is allowed.

## 8. Change and versioning protocol

For every future gameplay-affecting change:

1. state the intended contract delta before editing;
2. identify canonical owner and all call sites;
3. add/update focused behavioral tests first or in the same change;
4. keep one ownership boundary per change where practical;
5. run `npm run qa:gameplay-lock`;
6. run `npm run qa:fast` during implementation;
7. run `npm run qa:full` before checkpoint, commit, push or release preparation;
8. use `npm run qa:ios` before native build/install;
9. physically verify touch/animation/FPS/thermal/native lifecycle when affected;
10. record source, bundle, built app, installed app and physical acceptance separately.

Versioning rules:

- immutable accepted tags are never moved or deleted;
- source version, native marketing version and native build number must be intentionally advanced and verified for release;
- a cleanup with no behavior change still requires a new checkpoint, not rewriting an accepted tag;
- rollback uses the named immutable reference, never an assumed recent commit.

## 9. Definition of done

A gameplay cleanup is done only when:

- behavior remains within this contract;
- no second source of truth was introduced;
- lifecycle ownership and cancellation are explicit;
- changed decisions have focused tests;
- `qa:gameplay-lock` passes;
- `qa:full` passes;
- asset preservation remains intact;
- physical-only claims remain `NEEDS PHYSICAL TEST` until tested;
- `CURRENT_HANDOFF.md` records the actual source/bundle/device state.

## 10. Changing this contract

Automated cleanup, refactoring, dependency upgrades, linting and agent preference may not silently change this document. A behavioral clause changes only when the user explicitly requests the gameplay change and the same change updates tests and the contract.
