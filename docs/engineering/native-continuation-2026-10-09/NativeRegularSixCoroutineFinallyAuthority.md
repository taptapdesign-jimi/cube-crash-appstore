# Regular-six real coroutine finally boundary

Status: OPEN; this audit is not coroutine integration or physical acceptance.

Verified original src/modules/app-core.ts current code:
- 14280–14287: endgame branch starts actual doEndgameSpawns at an APP50ms callback; its Promise catch/finally resets the exact spawn owner. releaseSpecialTransaction is false for TNT only. This is separate from destination deletion APP100ms at14824–14842.
- 14460–14474: normal ordinary branch APP50ms creates Promise.resolve().then(spawnFromLocked).catch(...).finally(exact owner reset). The coroutine includes minimum-active-tile enforcement and schedules opacity safety sweep before resolving. The delay is50ms, not500ms.
- 14846–14875: normal destination cleanup follows spawn scheduling immediately; it removes only the exact dst/current owned placeholder, releases captured destination cleanup token, hides/detaches actual dst. It does not wait for ordinary bounce arrival.
- 15055–15072: actual main async catch removes captured src/dst, resets captured spawn owner with abort recovery and schedules owned recovery120ms. Ordinary source onInterrupt remains a distinct earlier callback.

Verified private Native code:
NativeGameplayEngine.swift1991/2034 emits preparation50 and assignment delays50+100*index. These values already match the scheduled ordinary cadence; do not change them to500.
NativeBoardScene.swift200–245 accepts real Source spawn begin with Date/claim/frame companion and has explicit sourceOrdinarySixSpawnCoroutineFinally. It has no actual regular/endgame coroutine producer. NativeBoardScene.swift4325 explicitly does not treat releaseOrdinarySixIfReady as Source Promise finally; preserve that distinction.

Next required work: mount the real Source-equivalent spawn coroutine with shared Scene Promise FIFO and exact captured generation/claim, include every normal/forced/minimum-active fallback and endgame branch, then call captured finally exactly once from that coroutine success/error/cancellation. Preserve releaseSpecial=false TNT branch. Do not use bounce duration, native pending-spawn emptiness, wall1200, or an invented timeout as finally. Destination physical cleanup must protect a newer same-cell owner independently of spawn-owner reset.

Proof required: actual main→APP50→shared FIFO spawn/forced/emergency→actual coroutine finally; paused GSAP with live APP wall and resource suspension; actual error/cancel/Scope disposal; same-cell replacement; exact queue/frame/idle release; no duplicate score/moves/RNG or timer-created arrival. Existing destination watchdog10/10 proof does not cover these branches.

## Verified next prerequisite: locked-helper settlement boundary

NativeGameplayEngine.commitOrdinaryAssignment currently invokes finishOrdinaryLockedBatch synchronously inside the final locked/forced callback. finishOrdinaryLockedBatch immediately chooses forced candidates or calls continueOrdinaryRefill; this can draw/select a remainder before the Source awaited helper Promise continuation. NativeBoardScene.startOrdinaryAssignments also directly consumes that callback result, so adding a Promise wrapper only around final owner reset would preserve the wrong continuation order.

Original app-core14407 awaits openLockedBounceForMerge;14423 awaits forceUnlockLockedTiles only if opened count is zero;14434/14442 awaits remainder primary/locked operations;14459 awaits ensureMinimumActiveTilesAfterSpawn. The ordinary Native refill code contains no explicit corresponding minimum-active coroutine phase. Wild phase owner already has its own minimum/emergency phases, which cannot substitute for ordinary behavior or be borrowed without matching Source semantics.

Concrete implementation sequence: expose an exact generation/owner/phase locked-helper settlement receipt in Core instead of running downstream batch continuation inline; Scene must acknowledge that receipt through its existing sourceMicrotaskInstallation.enqueue only after genuine unlock/helper completion. Then explicit forced/remainder/minimum phases can publish their real settlement and finally once. Preserve default-off admission until all actual callers and ordinary safety phase are covered. Do not equate pending-assignment emptiness with completed whole coroutine. Native assignment/primary mutation remains at actual physical callback; downstream RNG/selection must wait for the Source Promise FIFO.

## Minimum-active predicate authority

Verified src/modules/endgame-checker.ts158–198 and NativeSourceGameplaySignature.swift59–70. The original tileIsActive ignores alpha for ordinary unlocked positive-value tiles; it separately reads destroyed/visible/transient/dropping/magnet/pendingRemoval/beingRemoved/cleanupQueued, and has specific Wild event-mode/locked visibility behavior. Generic NativeTile.isActive requires alpha>0.01 and is therefore not the correct ordinary rescue count. Reuse existing NativeSourceEndgameChecker.active with the actual complete physical runtime capture, rather than changing generic NativeTile.isActive or copying another predicate.

The captured ordinary minimum phase must reject missing lifecycle/marker owners and reentrant stale generation/state. NativeNoMovesTileRuntime has the required lifecycle fields, and existing SourceNoMovesRuntimeAuthority provides complete capability/roster admission. A default .init() runtime per tile does not prove physical capture. The same cleanup-owned regular six remains counted while still visibly/live unlocked per original predicate; count again at the actual Promise continuation after destination cleanup rather than at initial reservation.

Normal safety first checks active>=2; otherwise awaits exactly one openLockedBounceForMerge, and only if zero opened does it select the first stable merge-cell-priority fallback candidate and perform immediate forced unlock/value/input/bounce. It does not repeatedly loop until count2, create an arbitrary extra fresh tile or perform a generic final-merge count. Whole native phase/caller and original-helper execution proof remain OPEN.
