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
| Visual tail remains after gameplay commit | Every stable ordinary stack/merge through six may resume, including a new ordinary merge-6; a visual tail alone must not create a global gameplay or terminal lock. Special dice and exact tiles still owned by unfinished gameplay mutation remain gated. |
| Hidden/pending-removal residue | Must be classified by canonical active-tile rules and must not create false finality or false stuck. |
| Locked future placeholder | Must follow canonical placeholder classification and must not invent a playable physical blocker. |

New visual variants must map to an existing gameplay archetype unless the user explicitly requests a new gameplay rule.

Forest Journey Stages use one cumulative authored reward pool and do not emit
generic Juice or Magnet dice. Stage 01 contains Wild Star only. The first
wild-meter reward on Stage 02/03/04/06/07 respectively guarantees Bee,
Flower, Honey, Mushroom, and Barrel as that Stage's introduction; TNT is also
unlocked in Stage 07's later cumulative pool. Subsequent rewards use
only Wild Star plus the Forest rewards introduced up to that Stage. Mushroom
uses Juice gameplay, Honey uses Magnet gameplay, and Flower and Barrel use TNT gameplay;
Bee retains Wild Star gameplay while suppressing the orbiting-star presentation,
and every authored visual remains player-facing.

Area 55 uses one cumulative player-facing reward pool. Cjelina 01 contains only
Wild Star and Robo Cube: Star is the first Wild Meter reward and Robo Cube is
guaranteed immediately after it. Cjelina 02 adds LaserGun and guarantees it on
that Cjelina's first reward. Cjelina 03 adds Spaceship and guarantees it on that
Cjelina's first reward. Cjelina 04 adds Kanta and guarantees it on that Cjelina's
first reward. Later Area 55 rewards use only Wild Star plus the Area 55 rewards
introduced up to that Cjelina. LaserGun and Spaceship retain their canonical Wild
TNT and Wild Magnet gameplay archetypes respectively; Kanta retains canonical
Wild Star gameplay. The per-board `wildSpawnCount` remains persisted across
reloads.

**Native Wild Star availability override (user decision2026-10-16):**
Plain Wild Star (Star archetype with no visual variant) is a Forest-only Journey
reward: boards1–10 retain their existing cumulative pool and Unit1 introduction;
Beach11–20 and Area55 21–30 never select plain Star. This overrides plain-Star
membership in the historical Area55/PWA description above for Native only.
Fish, Bee, Kanta and Cubero retain Star gameplay and their original visuals.
Forest Unit1 unlock uses the existing Backpack milestone (a real Forest attempt
opened/played or durable Forest completion/legacy progress); the default unplayed
interim1, other Worlds and tutorial completion alone grant nothing. Once unlocked,
plain Star is eligible for normal Arena/Arcade rewards. Before unlock, Arcade
normal pools exclude it and remain nonempty. Arcade01 authored Magnet → Bottle →
Cubero → Barrel sequence and existing World-specific first rewards stay intact.
Existing saved tiles, scripted tutorial demonstration, final-merge behavior and
save format version are preserved. An additive optional wildStarUnlocked Bool
latches existing Forest evidence before World changes; old saves decode without it.
Restriction applies to future ordinary meter selection;
no persisted tile is deleted/replaced. Preserved PWA source/oracle is unchanged.

- User-requested Native carrier independence (2026-10-14): a reserved Journey backpack or Arcade crate drop owns its die through travel, landing and presentation handoff. Concurrent ordinary or Wild/Special merge-6 effects cannot capture its transform or cancel its bookkeeping. Explicit route/restart/generation retirement still cancels the obsolete owner; background/modal pause retains normal lifecycle ownership.

### 5.3 Clean board and final merge

- Clean Board Combo bonus (user-requested 2026-09-21) belongs to the current
  attempt, independently of the persistent longest-combo record. Every streak
  of length `n >= 3` earns `50*n + 25*(n-3)*(n-2)/2`; shorter streaks earn zero.
  Incremental credit includes the final live streak and Magnet combo jumps once.
  New attempts reset the reward; save/resume preserves earned points and starts
  a new live streak. Legacy saves without this optional reward start at zero.
  Reward projection and the result modal must use the same captured total.
  Live combo timing/multipliers and Arcade round carryover remain unchanged.
- Clean Board Efficiency includes a move-saving reward: retain the existing
  completion/stack component and add `4 × baseBonus × (remainingMoves / maxMoves)²`,
  with the move ratio clamped to 0..1. Total Efficiency is bounded to 0.30..5.00
  times the board bonus. This user-requested scoring change (2026-09-20) rewards
  short Wild-assisted clears independently of accumulated score, elapsed time and
  combo. Existing Combo scoring, score caps and Arcade round carryover are unchanged.
- Resolver output is authoritative.
- A resolver error **MUST fail closed** to `wait`; legacy output cannot authorize clean or fail.
- Legacy last-merge booleans may remain diagnostic but cannot override central final-merge rules.
- A final regular or final wild merge must preserve its final snapshot through animation/residual cleanup.
- Clean presentation occurs once through `triggerCleanBoardFlow`/the canonical terminal owner.
- No duplicate modal, reward, next-level or save commit may occur.

### 5.4 NO MOVES and fail

- Candidate stuck state does **not** immediately own all input.
- The confirmation window remains playable.
- From the first visible `NO MOVES` candidate frame, navigation alone is locked: HUD X, an already-open End Run restart/exit, the menu handoff and the final `exitToMenu` boundary must not replace the board underneath the terminal presentation. Only the CTA owned by the mounted Fail/summary modal may explicitly bypass that navigation lock.
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

- User-requested Native failure containment (2026-10-12): an internal die presentation or Source phase rejection must not automatically navigate out of gameplay, restart the round, commit a result, or save a partial phase. A valid retained cleanup owner continues its existing lifecycle. A genuinely rejected phase retains the board and last coherent durable save under its authority gate, with an explicit authored Replay Board/Exit choice. Replay clearly restarts the round and uses the existing restart owner only after the player chooses it; unavailable or failed preparation retains the choice. No generic reconstruction of in-flight captured closures or silent rollback is permitted.
- A new board increments/changes generation ownership and cancels old end-game timers, animation frames and level-flow work before awaiting new entry work.
- Restart and Play Again clear transient gameplay locks, special transactions, stale tiles, FX owners and pending terminal state.
- User-approved Native Exit-menu Restart (2026-10-11) installs a fresh board directly after existing resource/readiness admission, without a Journey board transition or Arcade round announcement. This applies uniformly to all Worlds/Units; fresh-generation cleanup and normal board entry remain owned by their existing services. User-approved Exit-menu Restart (2026-10-12) keeps top/bottom gameplay chrome settled while only the dice grid reenters. Direct announcement-free Native restarts retain the previous painted view until the incoming board first-frame receipt to avoid exposing an unprepared frame. User-approved Native Fail-screen Play Again (2026-10-12) likewise starts the fresh board directly with normal board entry, without Journey board transition or Arcade announcement. User-approved Clean Result Play Again (2026-10-12), including Journey next-board continuation, skips the board announcement and enters dice plus upper/lower HUD. Progression and score carry remain unchanged; Arcade automatic next-round cue retains its owner.
- User-requested Native Arcade automatic Round01→02 and later round continuation (2026-10-13) preserves visible settled upper HUD and lower Round indicator through the clean cue and incoming dice wave, matching preserved PWA. Only board residue exits; incoming prepared gameplay adopts settled chrome and retains old painted coverage until its actual first-frame receipt. Fail, Journey, tutorial and Homepage entry retain their existing presentation.
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

### Native Arcade variants — user requested 2026-10-17

Arcade Home opens a dedicated three-world Hub with individual information/Play modals. Endurance retains the existing Arcade rules and legacy durable slot. One Lucky Drop (save identifier pureDice) slowly charges the meter at40percent first-round gain (4.6percent per ordinary merge,10.12percent per nonfinal six; same pace in later rounds), allows one random Special meter drop per round, then keeps meter at zero until the next round. The additive luckyDropUsed save flag is consumed with charge before travel and survives restore; rounds1–4 use small-value opening bias80/65/50/35percent and round5+ uses existing Arcade random draws. Slow Burn uses half normal meter gains across all merge paths and carries completed-round charge into the next round; explicit restart starts fresh. Existing special eligibility/unlocks, final reward veto, transactions, drag and scoring remain canonical. Each variant owns independent durable run, pending round and score/combo/stage records, encoded additively in the Native document; absent variant means Endurance. Journey progression/rules and preserved PWA remain separate.

### Native Arcade Star archetype parity — user requested 2026-10-18

All Native Arcade variants use Journey's complete Star spawn rules for plain Star, Fish, Kanta, Cubero and Bee. Reuse the saved 1–3 Star drop count (Bee fixed at one), existing normal/endgame primary and bonus phases, physical-final guards, input release and lifecycle cleanup. Never reroll at merge or restore. Final pairs still complete without spawning. Other archetypes retain their existing mode rules; Arcade score/progression and meter variants remain Arcade-owned.

## Native final merge HUD coins (user decision 2026-10-18)

A confirmed final merge-six earns visible upward coin flights to the trophy HUD before the result handoff, including ordinary, Wild and every Special variant in Journey and Arcade. This is an explicit Native reward-policy addition: final ordinary/Magnet receive one coin; final TNT gameplay archetype (all variants, including legacy Beach Ball provenance) receives three coins, only in this endgame branch; Star-family retains its saved effective1–3 count (Bee one), independent of missing board-local orbit artwork; Juice-family retains its existing1–3 selection. Each genuine HUD arrival credits the existing100 points once. Finality still vetoes every board die/meter spawn. Existing pending-HUD gates must hold terminal publication until those flights complete, then resume the exact captured final transaction/terminal once. Generation replacement/disposal cannot award stale arrivals. Nonfinal reward policy and preserved PWA behavior are unchanged.
