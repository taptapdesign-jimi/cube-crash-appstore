# Ordinary captured assignment phases

The coherent core/scene assignment port adds `stagedOrdinaryAssignments` to the existing ordinary80ms main receipts. Isolated83 tests passed before joint landing; actual scene validation is a separate requirement.

## Actual active source

- app-core.ts11771/13212: main absorb80ms owns counters.
- app-core.ts14473: normal locked flow starts after an outer50ms callback.
- level-flow.ts132–389: chooses actual locked objects at that callback, prioritizes merge cell if it is a locked object, Fisher–Yates shuffles rest, each selected object opens at50/150/250ms relative to preparation. Absolute drop assignment boundaries180/280/380ms. Unlock, input bind and face assignment retain the existing tile ID and settle this logical owner immediately; decorative bounce may be interrupted by valid drag.
- app-core.ts14151–14288: no-locked endgame primary is assigned at main80+outer50=130ms, clears the captured destination cell then invokes the active `app-core-open-cell.ts` owner; its Promise awaits actual bounce or rejects on interruption.
- app-core.ts14823–14847: independent main+100ms endgame destination cleanup removes only the captured destination. A fresh tile at the same coordinate survives `detachTileFromGrid` identity checks. Capture this cleanup receipt; when primary already retired the old ID, logical release retires the no-op receipt and the later scene callback skips it.
- Active adapter is app-core `playSpawnBounceWithFrames` → spawn-helpers.ts. Although callers pass `timeScale:2.0`, the active helper never reads/applies it. Source scale bounce stays0.18+0.12+0.12+0.14=0.56s. Do not halve native timing based on that unused option.
- Source `resetTileToNormalState` clears registry and Magnet identity. Independently claimed TNT bonus ownership remains; native preserves an unconsumed captured TNT target reservation when recycling a locked tile.

## Commands and presentation

`ordinarySpawnsPrepareRequested` carries original plan ID and50ms. The renderer waits on its own bounded generation-bound callback then calls `prepareOrdinarySpawns(receiptID:generation:)`.

`ordinaryAssignmentsPrepared` exposes immutable `pendingOrdinaryAssignments`, with slot ID, generation, cell, original tileID for locked opens, kind locked/forcedLocked/endgamePrimary/remainderPrimary, plus awaitsBounce, and delayMilliseconds. `commitOrdinaryAssignment(receiptID:generation:assignmentID:)` validates the exact first captured slot, epoch and current tile before drawing a face. `.spawned` carries slot ID as reason. Selection and faces do not draw together at main80ms.

Locked openings become playable and finish their logical ownership immediately on assignment; their0.56s visual receipt is independent. If all captured normal slots were retired without a new board epoch (for example prior TNT impacts), original source stable-priority forced unlock is captured without shuffle: first callback0ms, later callbacks100ms, no extra move debit. Actual success counts determine remainder count; opening preserves independent still-pending TNT reservations. Source old-epoch rejection consumes the captured slot without changing new authoritative dice. Partial locked batches produce captured sequential remainder primary slots only after the last logical open; each primary awaits its actual bounce/interrupt before scheduling the next.

`pendingOrdinaryPrimaryArrival` is acknowledged with `finishOrdinaryPrimarySpawn(receiptID:generation:assignmentID:interrupted:)` from the real native completion/interrupt. `ordinaryDestinationCleanupPrepared` carries100ms, captured original plan ID; call `commitOrdinaryDestinationCleanup(receiptID:generation:)` independently of primary bounce. Gameplay handoff releases after preparation, assignments and actual primary arrival/interrupt settle. Cleanup holds gameplay only while the exact captured destination remains cleanup-owned; an already retired identity cannot add a blanket100ms wait. Terminal visuals retain their separate scene receipts.

Background drains all captured opening/primary/cleanup commands exactly once before persistence, including interruption during the first primary of a three-opening refill. Restart revokes generation and all receipt arrays. Newly accepted stable ordinary stacks invalidate later old-epoch openings; captured counters already committed80ms remain.

## Evidence and limits

`native/gameplay-core/export-ordinary-assignment-oracle.mjs` executes unmodified original level-flow, app-core-open-cell and extracted actual endgame cleanup callback, plus original BoardMutationEpochOwner/detachTileFromGrid. It records60 locked batches,2 primary lifecycles and4 cleanup cases, plus136 original ordinary forced-unlock cases. Ordinary face provider is pinned1 to isolate lifecycle; this oracle does not claim fresh random-value probability parity. Existing native mode/value policy tests remain separate. Two valid native cleanup states are compared to source; two source destroyed-pointer cases are source assertions only because native authoritative model never retains destroyed objects.

New source tests compare original selection, stable IDs, absolute assignment boundaries, rejection after a newer accepted epoch, and logical settlement before decoration. Phase tests cover primary release, partial locked remainders, identity normalization, independent TNT ownership, same-cell cleanup, interruption/background/restart/save.

Before landing: peer must connect actual native callbacks and run meaningful actual VC/SpriteKit fixtures; this pure draft alone does not prove renderer timing. Source serialized locked-open mutex across all Wild owners and their still-atomic native spawn batches remains a separate integration dependency. Original zero-success ordinary forced-unlock owner is now ported and checked against actual source; imperatively triggered visual repair and complete source recovery-error branches still require broader command-timeline parity; no overall100% parity claim. Reference web visual-only RNG draws remain distinct from new native sessions.

`export-ordinary-retired-identity-oracle.mjs` executes the original endgame timer, cleanup, reset and entry guard, with actual openAtCell/lifecycle/active classifier/cleanup owner. The two fixtures distinguish primary interruption140ms (next six admitted before cleanup180ms) from normal completion690ms. Plain ordinary metadata and visual-clock transport are explicit; this does not claim full classifier or visual randomness coverage.

### Invalidated primary epoch

Original ordinary openPrimarySpecialMergeCell calls beforeSpawn before attempting openAtCellForMerge’s epoch permit. If a valid newer stack invalidated the spawn epoch before130ms, the captured old destination still retires at130ms, every original spawn/hard-fallback permit rejects, and source finally resets its old guard immediately. Native preserves that retirement-only slot without drawing a value or changing newer live tiles/counters. The later180ms callback is a no-op for the retired identity. The retired-identity exporter now records three executed original ownership flows with actual primary/epoch/hard-fallback helpers; its stale case asserts zero face draws.
