# Runtime Architecture Rebuild Plan — 2026-10-03

Status: replacement architecture implemented in source with full deterministic
QA passing. The
installed `00b2a8...` candidate failed physical acceptance and is rejected.
Browser feel, forced-loss behavior, cooled iPhone acceptance, native bundle
sync and install remain pending; deterministic gates do not certify fluidity.

## 2026-10-04 physical rejection and revised replacement boundary

The installed `4816f8...` candidate is also rejected. The lossless run at
`logs/journey-final-physical-20261004-124841/` proves that the current work is
still an incremental prepaint architecture, not the resident-surface design
specified below:

- Home -> Hub reached 106-110ms scoped worst frames; the warm repeat still
  missed at 43-45ms.
- Hub -> World continued to build/prepare after accepted taps for 263-416ms.
- Gameplay return painted 96 images for 1096ms and started the first Unit 69ms
  after the result's last visible frame.
- Beach board 16 exposed a Special/finality ownership defect: after Bottle
  disappeared the visible tile count jumped `3 -> 7 -> 8`; the user observed a
  fake ordinary six. Beach Ball activity coincided with 73/56ms frames.
- The returned Beach card was structurally present but visually missing. The
  narrow last-active-card reset is revoked: every Unit layer must normalize
  from canonical state before activation.
- The user revoked latest-only mobile Special idle admission. Every active
  SVG/Special die must keep its authored animation. Work is bounded through one
  shared scheduler/ticker and route/transaction suspension, never by silently
  freezing older visible content.

The decisive replacement is therefore mandatory, not optional backlog:

1. one immutable all-archetype Special merge transaction owns finality,
   consumed tiles, survivor disposition, cleanup and exact continuation spawns;
2. one `JourneySceneRegistry` retains stable Hub, Forest, Beach and Area 55
   identities and prepares them only during settled idle;
3. one production `JourneyTransitionDirector` owns the actual timeline, token,
   surface activation, leases, interruption and settlement;
4. gameplay return is `park -> keyed model patch -> normalize changed Units ->
   activate`, never full-World reconcile/prime;
5. one route-state audio residency plan fits inside the pressure budget and
   permits zero decode/eviction during visible motion.

No new connected `opacity: 0.001` prepaint, full-tree forced layout, watchdog
fallback or last-only visual suppression may be accepted as this repair.

Evidence source:
`logs/quality-blocker-new-mobile-20261003-1151/REPORT.md`.

Follow-up physical evidence:
`logs/architecture-rebuild-physical-20261003-1518/REPORT.md`.

Latest failed physical evidence:
`logs/post-owner-repair-retest-20261003-2313/analysis.md`.

## Lifecycle owner replacement checkpoint — 2026-10-03

- Journey navigation now has one route-transition coordinator for its token,
  critical lease, app-zone publication, completion and interruption. Hub and
  World build/decode/prime while detached; only the exact destination subtree
  is connected for one bounded compositor frame before the existing visible
  Unit enter begins. A cancelled enter frame interrupts instead of publishing
  false completion.
- Special audio uses one board-scoped working-set plan. Board refresh records
  inventory without decoding finale families; only the exact Special whose
  transaction was successfully claimed may prepare its family. Board cleanup
  releases the plan.
- One reusable GameplayRendererSupervisor owns every recovery caller. It keeps
  gameplay hidden/input-locked until structure, die/render/hit parity, GPU
  probes and extracted painted pixels pass. It can perform one hidden
  renderer/canvas transplant while retaining the authoritative Application,
  stage and gameplay model; failure remains explicitly visible and retryable.
- Focused Journey, audio and renderer suites pass, as do TypeScript, targeted
  ESLint, audio ownership, feature ownership and Gameplay KING. `qa:fast`
  passes 12/12 gates (222 suites / 1,980 tests) and source-only `qa:full`
  passes 18/18 gates (493 suites / 3,406 tests). Localhost review and physical
  acceptance are still required.

## Post-physical-regression checkpoint — 2026-10-03

- Homepage exit was physically clean, but Journey preparation, viewport entry
  and Hub cascade overlapped on the destination surface. The Hub now has one
  truthful epoch-owned completion boundary, no competing common-scroll
  transform, no mid-cascade scroll/style restoration, and admits World/cloud/
  banner idle only after the visible cascade settles.
- Finality now uses an audited authoritative grid while reconstructing only the
  accepted drag-detached source. Historical tile-list orphans cannot turn a
  true final Laser pair into the ordinary multiplier-two continuation; invalid,
  duplicate or malformed ownership waits fail-closed before board mutation.
- Terminal board-mutation capability guards delayed Laser/TNT commits and the
  existing continuation spawn families. The all-archetype final-merge matrix
  covers every current Special in Journey and Arcade, in both merge directions.
- Magnet-family destination reuse is one atomic `MagnetSurvivorCommit`: Special
  idle retirement precedes identity clear; regular paint, canonical hit/input
  ownership and one pointer binding commit while hidden; reveal follows the
  commit; bounce completion and interruption share the same settlement; failure
  removes the exact destination. This closes the physically observed dead
  Spaceship carrier and applies to Magnet, Bottle, Honey and Spaceship.
- Full source QA passes 18/18 gates with 485 suites / 3,363 tests and a
  1,114-module production build. The corrected source is served on localhost;
  no native bundle sync or install has occurred after the failed physical run.
- Still open: exact-grid validation at the accepted-drop owner in `drag-core`,
  broader every-merge immutable transaction migration, physical Hub/card tail
  latency, sustained audio working-set churn and a cooled natural-play retest.

## Implementation checkpoint — 2026-10-03

Connected in the current worktree:

- a monotonic board-mutation epoch owner now makes terminal completion and
  continuation spawn mutually exclusive; delayed direct, locked, fallback,
  repair, wild-meter and Magnet spawn paths require a current permit at their
  final mutation boundary;
- WebGL loss advances one visual-asset generation, current-generation broker
  handles now protect the canonical Special base face plus Kanta and Spaceship
  carriers, gameplay input remains persistently locked during recovery, and a
  failed/detached recovery presents an actionable DOM fallback instead of an
  invisible board;
- settled endgame now validates every logical move-enabling Special against its
  canonical base face and current renderer generation before either Fail or
  continue may commit. Missing/stale Kanta routes to at most two recovery
  attempts and then the explicit Retry/Return fallback; neither raw Pixi cache
  repair path may stamp a Special as current;
- recovery success validates live renderer/stage/board/HUD attachment, renders
  the validated stage, restores CSS canvas visibility even while entry owns the
  Pixi reveal, and normalizes an active board instead of accepting an all-hidden
  snapshot;
- Journey-to-game now calls `suspendForGameplay()`: it preserves the exact
  mounted Hub/World nodes while stopping RAFs, timers, GSAP/tickers, prepaints,
  listeners and ambient audio. Back-to-Homepage and reset remain destructive;
- Journey card opens reuse one mounted shell with generation-guarded callbacks;
  ordinary taps no longer perform synchronous style/animation/geometry reads,
  and entry/gesture/flip/dismiss windows hold the foreground resource lease;
- speculative background work is deduplicated and serialized after visible
  critical windows; audio starts at most one new speculative job per frame
  slice while direct playback stays immediate, and shared Pixi atlas eviction
  waits for the same safe point;
- mobile Clean Board applause/sax use bounded HTML media instead of repeatedly
  entering the decoded SFX cache. The retained phone trace proves audio churn,
  but not a monotonic audio-object leak or the invisible-board root cause.
- final merge now commits one frozen board snapshot, terminal decision,
  presentation capability and board revision before the first live-board
  mutation. The exact New Reward plus two delayed value-5 spawn interleaving is
  deterministic and both stale spawns are rejected;
- settled checks now produce all-die model/render/hit-test parity snapshots and
  a fixed-deadline watchdog. A real zero-move state schedules the canonical
  No Moves resolver; a logical move with broken regular presentation invokes
  renderer recovery instead of silently leaving the player stuck;
- Journey card detail rebinds one reusable image/ribbon face instead of cloning
  the connected World card tree, and raw pointer movement paints at most once
  per tracked animation frame while release flushes the latest sample;
- decoded audio supports atomic package admission and generation-safe route
  leases. Journey card flip and short mobile Clean Board packages cannot partly
  decode/evict-thrash, while direct audible playback retains priority.

Still open before release: extending immutable transaction/revision ownership
from the terminal final-merge slice to every continuation/save callback, strict
renderer-generation stamps for regular faces, broker migration for every Pixi
acquisition and carrier, real Pixi Application/canvas recreation after bounded
rehydration failure, complete route orchestrator ownership, and physical
tail-latency/thermal acceptance.

## Product invariant

At every player-visible frame, Stack to Six must have exactly one authoritative
gameplay snapshot, one active screen-transition transaction, one owner for each
animated transform, and a provably renderable/hittable representation of every
gameplay object that participates in move legality.

“The JavaScript object exists” and “the outer Pixi container is visible” are not
sufficient. A move can block No Moves only when the corresponding die is present
in the committed model and its current render generation is healthy, presented,
and interactive.

## Recommended architecture

This is a controlled replacement of lifecycle boundaries, not a blind rewrite
of the entire game. Preserve accepted art, motion, timings, progression, audio
identity, save data, rapid input, haptics, and gameplay rules while replacing
the overlapping owners underneath them.

### 1. Runtime Orchestrator

Create one top-level runtime state machine with explicit states such as:

`HomeSettled -> PreparingJourney -> JourneySettled -> PreparingBoard ->
BoardSettled -> ResolvingMerge -> PresentingResult -> ReturningToJourney`.

Each transition receives a monotonically increasing token and owns:

- its permitted background preparation;
- its visible surface lease;
- its animation timeline;
- its audio working set;
- its cleanup/rollback path;
- its diagnostic span and deadline.

No screen helper may independently reveal, hide, replace, or recover a surface
without the active token. Cancellation must be synchronous at the ownership
boundary and asynchronous work must prove the token again before committing.

### 2. Surface Registry and bounded residency

Introduce a `RouteSurfaceRegistry` for Home, Journey Hub, Journey World, card
modal, board, and result surfaces.

- Retain a small, explicit number of settled shells instead of rebuilding whole
  trees on every visit.
- Separate a stable shell from replaceable data/content.
- At most one heavy connected prepaint surface may exist, and only while the
  outgoing screen is under a guaranteed opaque cover or demonstrably idle.
- Hidden settled surfaces have zero RAF, zero infinite GSAP work, zero pointer
  listeners, and no media owner.
- Promotion changes ownership and visibility; it does not rebuild or clone the
  full destination tree.
- Every lease records DOM/Pixi nodes, listeners, timers, RAFs, GSAP targets,
  decoded assets, and audio reservations for deterministic teardown.

Retaining every screen forever is not the goal. Predictable bounded residency
is. The registry decides whether a surface is retained, suspended, or destroyed
from a declared memory budget.

For Journey specifically, normal gameplay navigation must call
`suspendForGameplay()` rather than the current destructive cleanup. Keep the
exact Hub and active/reachable World node identity for the session, update only
the Unit whose progress changed, and reserve `dispose()` for sign-out/reset,
explicit eviction, or memory pressure. A warm game return must not invoke a
Journey builder or connected prepaint path.

### 3. Frame-phase scheduler

Route all expensive visible work through a single scheduler with explicit
phases:

1. snapshot/read;
2. prepare off-DOM or under an opaque cover;
3. one batched DOM/Pixi mutation;
4. compositor commit;
5. reveal on a later verified frame.

Rules:

- no computed-style or geometry read after writes in the same interaction turn;
- no unbounded `Promise.all` image readiness on the visible transition path;
- no broad GSAP target scans during an active gesture;
- no connected `opacity: 0.001` duplicate tree competing with visible
  animations unless a measured budget admits it;
- preparation yields when a visible animation or pointer gesture owns the frame;
- every chunk has an iPhone budget and emits over-budget diagnostics.

### 4. Transactional gameplay engine

Replace distributed merge/finality/spawn decisions with one immutable
`GameplayTransaction`:

1. capture pre-merge board revision;
2. validate the input against that revision;
3. calculate merge result, score, specials, spawns, and terminal outcome once;
4. commit the next logical board atomically;
5. animate only the committed transaction;
6. persist the committed revision;
7. allow the next input only after visual reconciliation or an explicit bounded
   input policy.

If the transaction is terminal, later spawn work cannot run. New Reward, Clean
Board, Fail, No Moves, save state, and the visible final board all derive from
the same transaction result—not separate early/late checks.

Add a monotonic board revision to every spawn, animation completion, end-game
check, persistence write, and modal request. Work from an old revision is
discarded and logged, never committed.

Every mutation primitive—including regular `openAtCell`, locked opens, hard
fallback, minimum-two-active repair, retries, and wild-meter spawn—must require
an explicit `{ boardEpoch, transactionId, spawnPermit }`. It revalidates that
capability immediately before mutation and again after every await. A terminal
commit increments the epoch and revokes every outstanding spawn permit before
New Reward or result presentation starts.

### 5. Render-generation and health owner

Create a renderer health state machine independent of route state:

`Healthy -> ContextLost -> Quiescing -> Rehydrating -> Validating -> Healthy`
or `FallbackRequired`.

On context loss:

- freeze new gameplay transactions and pointer input;
- increment the GPU generation;
- invalidate every GPU-backed texture handle, including dormant special
  variants and cached animation frames;
- cancel all Pixi animation owners bound to the old generation;
- rebuild/rebind the renderer and the complete current working set;
- validate every visible gameplay texture with a GPU pixel probe or equivalent
  render-to-target check;
- validate semantic render parity: each logical die has a visible sprite, valid
  pixels, expected bounds, and hit target;
- reveal once, from the recovery owner, independent of a pending route-entry
  flag;
- if validation fails, rebuild the full renderer or show a recoverable blocking
  surface. Never resume invisible gameplay.

The exceptional fallback is a `GameplayRendererSupervisor`: after a bounded
wait for context restoration, destroy only the compromised Pixi renderer/session,
create a new canvas/Application, rehydrate from the immutable gameplay snapshot,
bind HUD/input/Special owners once, and atomically reveal. Ordinary navigation
continues to reuse the renderer. If recreation also fails, enter an explicit
`visible-failed` state with Retry/Return UI; there must be no hidden interactive
board and no unbounded recovery wait.

Assets loaded in an old GPU generation must not be considered healthy merely
because dimensions/metadata are present.

Implement this boundary as a `VisualAssetBroker` (or equivalent sole owner) so
feature modules no longer call Pixi `Assets.get/load` directly. A borrow returns
both the texture and renderer epoch; an epoch mismatch coalesces a forced cache
purge/reload per asset path. This makes a special that was dormant during
recovery repair itself safely on its first later activation.

### 6. Semantic gameplay/render parity

Maintain a reconciliation index keyed by die ID and board revision:

- logical kind/value/special state;
- expected render asset and GPU generation;
- sprite attachment and pixel health;
- effective alpha/visibility/bounds;
- hit-test eligibility;
- animation owner.

End-game legality remains a pure gameplay calculation, but before returning
“continue”, the runtime must assert that every move-enabling object is currently
presentable and interactive. A mismatch pauses the board and invokes render
recovery; it must not silently suppress No Moves forever.

Add a bounded settled-board watchdog: if board revision, input, and animations
are unchanged and no legal player-visible move exists, resolve No Moves or raise
a diagnostic invariant within a fixed deadline.

### 7. Card compositor

Retain one reusable card-stage shell. Bind card content/data into it instead of
recreating the complete 3D hierarchy on every open.

- Capture all geometry before gesture ownership begins.
- Make pointer down allocation/layout-free: record pointer identity and
  coordinates only. Acquire drag ownership only after movement crosses the
  existing intent threshold.
- Cache settled modal geometry and refresh it only from resize/orientation
  ownership. Read computed animation state only when interrupting a genuinely
  active WAAPI owner, never on every ordinary tap.
- Use one pointer sample per animation frame, not a style write for every raw
  pointer event.
- Restrict interactive rotation to transform and opacity on pre-promoted layers.
- Bake or temporarily simplify expensive drop shadows, masks, and shine during
  the flip; restore authored appearance when settled.
- Avoid `getComputedStyle`/`getBoundingClientRect` after class or transform
  mutations in the same turn.
- Keep common and legendary effects under the same scheduler and budget.
- Preserve current gestures and authored flip character; change the compositor
  cost, not the design.

The reusable front face should bind dedicated static art/ribbon nodes rather
than cloning the complete live World card subtree. Acquire a compositor lease
once per modal open, keep the two face layers promoted for that modal session,
and release on close—not on every half-turn. Move the expensive settled shadow
to a stationary sibling, reduce `preserve-3d` to the rotor boundary, and suspend
shine/filter/mask work during the live rotation.

### 8. Audio Residency Manager

Use declared route/session working sets rather than broad speculative family
warmups.

- Pin only tiny, latency-critical core interaction sounds.
- Stream long music/ambient loops as media; do not compete with the decoded SFX
  cache.
- Reserve a bounded set for the active route plus the single admitted
  destination.
- Do not prepare all Journey/Special families on every Play/return.
- Deduplicate decode promises and apply backoff after eviction.
- Never start decode/eviction work during an active card gesture, visible route
  commit, or terminal board animation unless the cue is required for that exact
  interaction.
- Expose per-route decode time, eviction reason, redecode count, resident bytes,
  and deadline misses.

Split transport from residency. The existing buffer player should own only the
AudioContext, voices, and playback. A new residency owner admits atomic packages
such as `core-board`, `journey-ui`, current `result`, live Special families, and
the short-lived transition set. An active screen/tile holds an explicit lease;
the final owner releases it. Track `lastAudibleUse` separately from
`lastPrepared`, so speculative preload cannot make an old package look more
valuable than the current route.

Long, timing-tolerant result/ambient cues should use route/feature-owned media
transport on mobile rather than continuously displacing short decoded SFX. If a
cue truly needs decoded timing, admit its entire result package atomically under
its own declared budget. Card pointer down must start zero audio decoding; the
small Journey UI/flip package is prepared and leased while the settled World is
idle.

Use one route-scoped `LongLoopMediaPool` for ambient/result media retention.
Keep only the current and, when explicitly admitted, immediate-next loop.
Final release removes `src` and performs a media `load()` reset at a safe point
so paused decoders do not remain indefinitely retained outside measured Web
Audio bytes.

The target is not merely a larger cache. The target is a smaller, predictable
working set that does not churn.

### 9. Foreground Resource Coordinator

One coordinator must arbitrate main-thread and GPU-adjacent preparation across
audio fetch/decode, DOM image decode, Pixi upload/unload, Journey prepaint, atlas
preparation, and smoke/pool warmup.

Hub/World/card/board/result enter and exit acquire a critical-presentation lease.
While it is held, no new speculative job begins. A browser decode already in
flight may finish, but cache admission, eviction, and GPU unload wait for a safe
point. Idle-budget expiry marks an atlas evictable; it does not independently
unload GPU content on a wall-clock timeout while the player is interacting.

This replaces several individually bounded schedulers that can currently all
be correct in isolation yet compete during the same first gameplay seconds.
Generation guards remain required, but guarding a stale commit alone does not
remove the cost of work already started.

### 10. Diagnostics that measure the visible truth

Keep aggregate FPS, but gate on tail latency and semantic correctness:

- per-transition p50/p95/p99/worst frame interval;
- phase spans for prepare, DOM/Pixi commit, raster wait, reveal, and cleanup;
- active surface leases and overlapping heavy work;
- GPU generation and per-visible-asset health;
- logical-to-rendered die reconciliation failures;
- pointer-to-next-presented-frame latency for card gestures;
- board revision and stale async work rejection;
- audio decode/eviction work correlated to long frames;
- context loss/recovery duration and reason;
- hidden RAF/GSAP/timer/listener counts per settled route.

Diagnostics must remain cheap in production and detailed only under the existing
diagnostic flag.

## Prioritized implementation backlog

### P0 — correctness and recovery blockers

- [ ] Add board revision and one authoritative immutable merge transaction.
      The terminal final-merge path is connected before live-board mutation;
      non-terminal continuation transactions remain to be migrated.
- [ ] Derive spawn, final merge, Clean Board/Fail/No Moves, New Reward, save, and
      visible animation plan from the same committed transaction.
- [ ] Reject every async spawn/animation/end-game callback whose revision/token
      is stale.
- [ ] Require a current spawn permit on every direct and fallback board mutation,
      including the minimum-two-active safety path.
      First merge/final/spawn slice is connected; a complete mutation-surface
      inventory remains open before this item can be closed.
- [x] Add an invariant owner that forbids `terminalCommitted` and
      `spawnCommitted` in the same board generation.
- [x] Write a deterministic reproduction for “New Reward while two 5s/new spawn
      remain” before changing the logic.
- [x] Replace recovery's route-entry-dependent reveal with a single recovery
      owner and guaranteed finally/rollback behavior.
- [ ] Invalidate all texture handles on GPU generation change, not only active
      special assets.
- [ ] Centralize all Pixi texture acquisition behind `VisualAssetBroker`; forbid
      feature-local metadata-only reuse across renderer epochs.
      Canonical Special base faces plus Kanta and Spaceship carriers are migrated;
      remaining direct Pixi acquisitions still require inventory and migration.
- [ ] Rehydrate the complete visible gameplay working set, including Kanta and
      every special/idle frame required by current logical dice.
- [ ] Add GPU pixel health validation for each visible die asset after recovery.
- [x] Add model/render/hit-test parity checks keyed by die ID.
      Settled move-enabling Specials retain the strict current-generation gate;
      all dice now receive immutable attachment, presentation, texture, bounds
      and hit-test records. Regular-face generation remains intentionally zero
      until their remaining direct texture owners migrate to the broker.
- [x] Pause input and game decisions during context recovery; resume only after
      current structural and core-texture validation. Full semantic parity is
      tracked separately below.
- [ ] Add renderer recreation when rehydration validation fails. A static,
      generation-owned Retry/Return fallback is connected so failure is visible
      and actionable instead of exposing an invisible interactive board.
- [x] Make Kanta/wild move legality unable to suppress No Moves when its render
      representation is unhealthy or absent; route this to recovery/invariant,
      not to a silent logical rule change.
- [x] Add a settled-board watchdog and deterministic invisible-special test.
      The watchdog never commits gameplay: it schedules the canonical resolver
      for zero moves and renderer recovery for logical-but-invisible regular dice.
- [x] Add context-loss chaos tests: core tile, dormant Kanta loaded before loss,
      Kanta spawned after loss, context loss during board entry, and repeated
      loss/recovery.
- [x] Parameterize cached-before-loss/absent-during-restore/later-activation for
      every registered Special variant and its front/rear/idle carriers.
- [ ] Test recovery failure as input-locked and hidden, followed by one bounded
      retry and exactly one successful reveal/idle-owner restart.
      The isolated supervisor proves this state machine, but app-core does not
      yet have the immutable-snapshot adapter required for real Application and
      canvas recreation.
- [ ] Test terminal-vs-spawn interleavings at every await/timer boundary,
      including full wild meter, retry, fallback, locked open, and minimum-active
      repair in Journey and Arcade and both drag directions.
- [ ] Test save/load and context recovery mid-final-merge: the restored revision
      must remain terminal and must never manufacture a continuation board.

### P1 — visible frame pacing

- [ ] Introduce Runtime Orchestrator transition tokens and surface leases.
- [ ] Inventory and remove every independent reveal/hide/replace owner outside
      the orchestrator.
- [ ] Split Journey Hub/World into stable shells plus bounded content binding.
- [x] Split Journey cleanup into `suspendForGameplay()` and true `dispose()`;
      normal Play/return must preserve exact Hub/World node identity.
- [ ] Update only the changed Journey Unit after progress commit instead of
      destroying readiness/raster ownership for the entire tree.
- [ ] Stop constructing a full connected destination tree while an uncovered
      visible animation/gesture is active.
- [ ] Replace World/Hub promotion paths with one batched commit and verified
      reveal frame.
- [ ] Cap preparation chunks by measured iPhone time and yield to input/visible
      motion.
- [x] Reuse one card modal shell and pre-promoted face layers.
- [x] Replace full World-card `cloneNode` portal content with dedicated reusable
      modal face nodes.
- [x] Batch card pointer events to one update per RAF.
- [x] Remove pointer-turn style/layout read-write interleaving.
- [x] Remove unconditional `getComputedStyle`, `getBoundingClientRect`, and
      `getAnimations` work from ordinary card pointer down and next-frame audit.
- [x] Gate pointer diagnostics behind detailed diagnostics and buffer native
      bridge delivery into one profiler summary instead of posting several
      synchronous events per touch.
- [ ] Collapse the simultaneous 520 ms idle-shell rotation and rotor
      turn/recoil into one explicit transform owner for the live flip.
- [ ] A/B-test card shadows, masks, shine, and back-face raster cost, then keep
      the authored settled look with the cheapest live-flip representation.
- [ ] Add pointer-to-frame telemetry for every flip.
- [ ] Add per-flip profiler phases; the existing opening profiler is not enough
      to identify interactive rotation cost.
- [ ] Implement route-scoped audio working sets and stop broad warmups.
      Journey card and short mobile Clean Board packages are connected; the
      remaining route families still need declared package migration.
- [x] Split audio voice transport from package residency/admission.
- [x] Make package admission atomic and keep audible-use recency separate from
      speculative-preparation recency.
- [ ] Separate streamed long loops from decoded short-effect residency.
- [x] Move long, timing-tolerant Clean Board applause/sax and equivalent result
      layers to feature-owned media transport on mobile, or grant one explicit
      atomic result budget when authored sync requires decoding.
- [ ] Enforce no speculative decode/eviction during visible transitions and
      gestures.
- [x] Ensure card pointer down starts zero audio decode/eviction work.
- [ ] Add a `ForegroundResourceCoordinator` critical-presentation lease across
      audio decode, image decode, Pixi upload/unload, prepaint, and warmup.
      Audio scheduling, card windows, gameplay entry/exit/result/recovery and
      shared-atlas eviction are connected; remaining image/prepaint/warmup
      producers still require migration.
- [x] Convert independent atlas-unload timeouts into coordinator-approved idle
      evictions.
- [ ] Consolidate Special per-frame dispatch without revoking the approved
      continuous Kanta/Honey/Bee/Fish behavior or changing its appearance.
- [ ] Audit simultaneous Kanta/Honey/Bee/Fish continuous idle against the frame
      scheduler; preserve the approved policy, but suspend/rebind safely during
      recovery and terminal transactions.
- [ ] Ensure hidden/suspended routes have zero active RAF, infinite GSAP,
      listeners, audio owners, and Pixi tickers.

### P2 — simplification and enforcement

- [ ] Build a machine-readable owner registry for route surface, transition,
      GPU generation, gameplay transaction, audio set, and cleanup.
- [ ] Delete superseded prepaint/recovery/end-game branches only after source
      contract tests prove the new owner is connected.
- [ ] Replace legacy timeout/RAF ownership stored on DOM nodes with registered
      leases and abort signals.
- [ ] Add static gates against unregistered screen replacement, infinite
      animation, timers, and audio preparation.
- [ ] Add runtime assertions for more than one heavy connected prepaint surface
      and for hidden work after settle.
- [ ] Reduce production diagnostics to counters/ring buffers; retain detailed
      spans only in diagnostic builds.
- [ ] Add renderer-supervisor state, canvas inline/computed visibility, context
      recovery/rebuild timings, GPU texture/upload/unload estimates, and
      per-owner background-work duration to the diagnostic ring buffer.
- [ ] Update gameplay, feature, background-work, Special, audio, and Journey
      contracts as owners move.
- [ ] Run dead-code and duplicate-owner audit only after P0/P1 behavior is
      covered; do not delete or rename preserved assets.

## Proposed release gates

These gates are deliberately based on visible tail behavior, not average FPS.
They are starting acceptance thresholds to validate on the iPhone 13 blue and
then lock into the performance contract.

### Correctness gates

- zero invisible logical dice;
- zero board/model/render/hit-test parity violations;
- zero board deadlocks and zero missing No Moves decisions;
- zero post-terminal spawns or stale board mutations;
- zero context-recovery resumes before all visible assets pass health checks;
- save/load at every merge/result/recovery boundary reproduces the same board
  revision and outcome.
- renderer recovery always terminates in `healthy` or a visible recoverable
  failure state; the canvas is never hidden without a live supervisor owner.

### Frame gates

- card flip gesture: no sampled frame above 34 ms in the acceptance route;
- Hub/World/Board/Fail/Clean Board visible transitions: first destination visual
  within 33 ms after the outgoing cover is gone;
- zero visible frames above 100 ms that are caused by application work;
- p99 frame interval and worst frame reported separately for each transition;
- no heavy background preparation during an active visible gesture.
- after warmup, no Journey prepaint builder on normal Hub/World/game-return
  routes and no full-tree node replacement;
- 20 alternating flips reuse the same nodes, perform no append/clone/decode or
  layout/style read on stable tap flip, target p95 <= 20 ms, and have zero
  frames above 34 ms;
- terminal result return presents the first Unit within 33 ms.
- from card pointer down until settled, zero decode-start, audio eviction, image
  decode, atlas upload, or atlas unload events.

### Soak gates

- repeat the same natural ten-minute route from a cooled phone;
- repeat after a forced WebGL context loss;
- repeat with Kanta created only after recovery;
- thermal state, audio churn, GPU generations, renderer recovery, and route
  ownership retained in one lossless capture;
- pass requires both metrics and user-observed fluidity. Deterministic QA alone
  cannot declare animation feel accepted.
- after first warmup, core/Journey UI have zero redecodes; repeated-route
  redecoded bytes remain below 5 MB per cycle and converge toward a plateau.

## Delivery sequence

1. Lock reproduction tests for final merge, invisible Kanta, context recovery,
   and No Moves.
2. Implement P0 transactional gameplay and render-generation recovery behind
   narrow adapters, preserving current presentation.
3. Validate P0 in browser, deterministic QA, forced context-loss harness, and
   physical iPhone test.
4. Implement P1 surface/frame/card/audio architecture in measurable slices.
5. Compare every slice against the retained 2026-10-03 trace; revert slices that
   move work without improving tail latency.
6. Complete P2 cleanup only after the new owners pass all existing contracts.
7. Run the final cooled ten-minute natural-play acceptance and do not label the
   build production-ready until every correctness gate and the physical feel
   gate pass.
