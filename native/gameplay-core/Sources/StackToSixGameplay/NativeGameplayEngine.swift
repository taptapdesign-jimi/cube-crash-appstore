import Foundation

/// Pure state owner. SpriteKit reads receipts; animation completions never resolve a move again.
/// Special mutations use captured receipts and release gameplay independently of decorative tails.
public final class NativeGameplayEngine {
    public private(set) var state: NativeBoardState
    /// Actual shouldSpawnAtDst/physical-verification writer transport.
    public var sourceMandatoryMergeCellMutation:((String,UInt64,NativeCell,Bool)->Bool)?
    public var sourceMandatoryMergeCellWriterID:UUID?
    private var sourceMandatoryMergeCellWrittenOwner:(String,UInt64)?
    public var snapshot: NativeBoardState { state }
    /// Additional exact source lifecycle markers are supplied only by their native
    /// owner (for example Wild-drop travel); ordinary decorative SKActions add none.
    private var sourceMeterMutationLedger:NativeSourceMeterMutationLedger?
    public var sourceSaveRuntime=NativeSourceSaveRuntime()
    /// Actual Source Special claim AFTER canonical legality/presentation checks,
    /// BEFORE sequence/plan/RNG. Nil preserves all existing pure/Raw callers.
    public struct SourceOrdinaryLockedSettlement:Equatable,Sendable {
        public let id:UUID,ownerID:String,generation:UInt64
    }
    public struct SourceOrdinaryMinimumPhaseReceipt:Equatable,Sendable {
        public let id:UUID,ownerID:String,generation:UInt64
    }
    public var sourceOrdinaryLockedSettlementsEnabled=false
    /// Actual retained locked-holder setValue/face RAF, after value assignment
    /// and before bounce direction or the next logical spawn phase. Nil keeps
    /// the independent Raw renderer; a refused Source face never advances it.
    public var sourceWildLockedFaceCommit:((NativeWildSpawnAction,NativeTile)->Bool)?
    /// Genuine fresh primary constructor + immediate value/face frame. Explicit
    /// Wild value arguments have already been evaluated; bounce/phase work has not.
    public var sourceWildPrimaryFaceCommit:((NativeWildSpawnAction,NativeTile)->Bool)?
    /// Source constructor runs per cell before its captured pop direction draw.
    public var sourceWildLockedBonusConstruct:((NativeTile,UInt64)->Bool)?
    public var sourceWildLockedBonusPop:((NativeWildLockedBonusPresentation)->Bool)?
    public var sourceWildHardPrimaryConstruct:((NativeTile,UInt64)->Bool)?
    public var sourceWildFailedPrimaryRetire:((NativeTile,String,UInt64)->Bool)?
    private var sourceOwnedPrimary:(ownerID:String,generation:UInt64,tileID:String)?
    private var sourceFailedPrimary:(ownerID:String,generation:UInt64,tileID:String)?
    /// Genuine APP bounce publication is synchronous before the next phase/cell.
    public var sourceWildSpawnBouncePublish:((NativeWildSpawnPresentation,String)->Bool)?
    public var sourceWildCoroutineResume:((String,UInt64)->Bool)?
    /// Actual completed spawn coroutine schedules its captured APP finally.
    public var sourceWildCoroutineFinally:((String,UInt64)->Bool)?
    public var sourceWildSpawnBegin:((NativeSourceWildSpawnBeginReceipt)->Bool)?
    /// Full Source normal Direct assembly only. Physical publication from the
    /// captured main must precede both original pre-spawn await reactions.
    public var sourceDirectNormalPreSpawnGuardsEnabled=false
    public private(set) var sourceDirectNormalPreSpawnChecks=0
    public private(set) var sourceDirectEndgamePreSpawnChecks=0
    public var sourceWildEndgamePhysicalGuardsEnabled=false
    public private(set) var sourceWildEndgamePhysicalGuardChecks=0
    public private(set) var sourceWildEndgameActiveVerificationChecks=0
    public private(set) var sourceWildEndgameDelayCallbacks=0
    private var sourceWildEndgamePhysicalGuardRefused=false
    public private(set) var pendingSourceDirectInitialAwait:NativeSourceWildSpawnBeginReceipt?
    private var sourceDirectInitialMath:NativeSourceMathRandomStream?
    private var sourceDirectInitialReady=false
    private var sourceDirectInitialRefused=false
    private var sourceDirectInitialGuardPass=0
    private var sourceDirectInitialEnqueueReceipt:NativeSourceWildSpawnBeginReceipt?
    public var sourceDirectNormalLockedBonusGuardsEnabled=false
    public var sourceDirectEndgameLockedBonusGuardsEnabled=false
    public var sourceDirectLockedBonusGuardResume:((NativeSourceDirectLockedBonusGuardReceipt)->Bool)?
    public private(set) var pendingSourceDirectLockedBonusGuard:NativeSourceDirectLockedBonusGuardReceipt?
    public private(set) var sourceDirectNormalLockedBonusGuardChecks=0
    public private(set) var sourceDirectEndgameLockedBonusGuardChecks=0
    private var sourceDirectLockedBonusContext:NativeWildSpawnPhaseContext?
    private var sourceDirectLockedBonusPhase:NativeWildSpawnPhaseOwner?
    private var sourceDirectLockedBonusMath:NativeSourceMathRandomStream?
    private var sourceDirectLockedBonusDispatching:NativeSourceDirectLockedBonusGuardReceipt?
    private var sourceDirectLockedBonusRefused=false
    private func sourceDirectInitialAwaitCurrent(_ receipt:NativeSourceWildSpawnBeginReceipt)->Bool {
        pendingSourceDirectInitialAwait==receipt && sourceWildSpawnBeginIsCurrent(receipt) &&
        (directWildSpawnPhase?.mode == .normal ? sourceDirectNormalPreSpawnGuardsEnabled:sourceWildEndgamePhysicalGuardsEnabled) &&
        directWildSpawnPhase?.cancelled==false && directWildSpawnPhase?.complete==false &&
        !flags.busyEnding && state.terminal==nil && sourceDirectInitialMath != nil &&
        sourceMathRandom === sourceDirectInitialMath
    }
    /// Called by the real captured Direct main after Scene publishes the
    /// canonical retained roster. This never constructs or selects a holder.
    @discardableResult public func releaseSourceDirectInitialAwait(_ receipt:NativeSourceWildSpawnBeginReceipt)->Bool {
        guard sourceDirectInitialAwaitCurrent(receipt),!sourceDirectInitialReady,
              sourceDirectInitialEnqueueReceipt==nil,let plan=currentWildSpawnContext,
              let phase=directWildSpawnPhase,let enqueue=sourceWildCoroutineResume,
              sourceWildPhysicalBlockerPresent(plan:plan,phase:phase,admitted:{self.sourceDirectInitialAwaitCurrent(receipt)}),
              sourceDirectInitialAwaitCurrent(receipt) else{return false}
        if phase.mode == .normal {sourceDirectNormalPreSpawnChecks+=1} else {sourceDirectEndgamePreSpawnChecks+=1}
        let captured=state
        sourceDirectInitialEnqueueReceipt=receipt
        let accepted=enqueue(receipt.ownerID,receipt.generation)
        if sourceDirectInitialEnqueueReceipt==receipt {sourceDirectInitialEnqueueReceipt=nil}
        guard accepted,state==captured,sourceDirectInitialAwaitCurrent(receipt),directWildSpawnPhase === phase else{
            _=retireSourceDirectInitialAwait(receipt);return false
        }
        sourceDirectInitialReady=true;return true
    }
    @discardableResult public func retireSourceDirectInitialAwait(_ receipt:NativeSourceWildSpawnBeginReceipt)->Bool {
        guard clearSourceDirectInitialAwait(receipt) else{return false}
        sourceDirectInitialRefused=true;return true
    }
    private func clearSourceDirectInitialAwait(_ receipt:NativeSourceWildSpawnBeginReceipt)->Bool {
        guard pendingSourceDirectInitialAwait==receipt else{return false}
        pendingSourceDirectInitialAwait=nil;sourceDirectInitialMath=nil
        sourceDirectInitialReady=false;sourceDirectInitialEnqueueReceipt=nil;sourceDirectInitialGuardPass=0
        return true
    }
    public var stagedTntWildSpawnAssignments=false
    public var sourceTntSpawnBegin:((NativeSourceTntSpawnBeginReceipt)->Bool)?
    public var sourceTntCoroutineResume:((String,UInt64)->Bool)?
    public var sourceTntCoroutineFinally:((String,UInt64)->Bool)?
    public private(set) var sourceTntSpawnBeginReceipt:NativeSourceTntSpawnBeginReceipt?
    private var sourceTntSpawnBeginAccepted=false
    /// Explicit Source assembly only. The actual mounted finale releases this
    /// initial await through the installed APP FIFO; Raw remains synchronous.
    public var sourceTntInitialAwaitEnabled=false
    public var sourceTntPhysicalPreSpawnGuardsEnabled=false
    public private(set) var sourceTntPhysicalPreSpawnChecks=0
    public var sourceWildExtraFinalGuardsEnabled=false
    public private(set) var sourceWildExtraFinalGuardChecks=0
    private var sourceWildExtraFinalGuardRefused=false
    public var sourceTntLockedBonusPhysicalGuardsEnabled=false
    public var sourceTntLockedBonusGuardResume:((NativeSourceTntLockedBonusGuardReceipt)->Bool)?
    public private(set) var pendingSourceTntLockedBonusGuard:NativeSourceTntLockedBonusGuardReceipt?
    private var sourceTntLockedBonusGuardContext:NativeWildSpawnPhaseContext?
    private var sourceTntLockedBonusGuardPhase:NativeWildSpawnPhaseOwner?
    private var sourceTntLockedBonusGuardMath:NativeSourceMathRandomStream?
    private var sourceTntLockedBonusGuardDispatching:NativeSourceTntLockedBonusGuardReceipt?
    private var sourceTntLockedBonusGuardRefused=false
    private var sourceTntInitialGuardPass=0
    private var sourceTntInitialAwaitReceipt:NativeSourceTntSpawnBeginReceipt?
    private var sourceTntInitialMath:NativeSourceMathRandomStream?
    private var sourceTntInitialReadyReceipt:NativeSourceTntSpawnBeginReceipt?
    private var sourceTntInitialEnqueueReceipt:NativeSourceTntSpawnBeginReceipt?
    @discardableResult public func releaseSourceTntInitialAwait(_ receipt:NativeSourceTntSpawnBeginReceipt)->Bool {
        guard sourceTntInitialAwaitEnabled,sourceTntSpawnBeginIsCurrent(receipt),
              sourceTntInitialAwaitReceipt==receipt,sourceTntInitialReadyReceipt==nil,
              sourceTntInitialEnqueueReceipt==nil,let math=sourceTntInitialMath,sourceMathRandom === math,let enqueue=sourceTntCoroutineResume,
              let phase=directWildSpawnPhase,!phase.cancelled,!phase.complete else{return false}
        let captured=state
        sourceTntInitialEnqueueReceipt=receipt
        let accepted=enqueue(receipt.ownerID,receipt.generation)
        if sourceTntInitialEnqueueReceipt==receipt {sourceTntInitialEnqueueReceipt=nil}
        guard accepted,state==captured,sourceTntSpawnBeginIsCurrent(receipt),
              sourceTntInitialAwaitReceipt==receipt,directWildSpawnPhase === phase,sourceMathRandom === math else{return false}
        sourceTntInitialReadyReceipt=receipt
        return true
    }
    private var sourceTntCoroutineSettled:(id:String,generation:UInt64)?
    public func sourceTntSpawnBeginIsCurrent(_ receipt:NativeSourceTntSpawnBeginReceipt)->Bool {
        receipt==sourceTntSpawnBeginReceipt && receipt.generation==state.generation &&
            currentWildSpawnContext?.isDirect==false && currentWildSpawnContext?.id==receipt.ownerID
    }
    public func hasSourceTntSpawnCoroutine(transactionID:String,generation:UInt64)->Bool {
        // A finally receipt owns cleanup and the independent outer bonus, not
        // another resume. Queued callbacks must still own the actual phase.
        // A complete phase remains resumable until its finally is published.
        state.generation==generation && currentWildSpawnContext?.isDirect==false &&
            currentWildSpawnContext?.id==transactionID && directWildSpawnPhase?.cancelled==false
    }
    public func hasSettledSourceTntSpawnCoroutine(transactionID:String,generation:UInt64)->Bool {
        state.generation==generation && sourceTntCoroutineSettled?.id==transactionID && sourceTntCoroutineSettled?.generation==generation
    }
    public private(set) var sourceWildSpawnBeginReceipt:NativeSourceWildSpawnBeginReceipt?
    public func sourceWildSpawnBeginIsCurrent(_ receipt:NativeSourceWildSpawnBeginReceipt)->Bool {
        receipt==sourceWildSpawnBeginReceipt && receipt.generation==state.generation &&
            pendingDirectWild?.id==receipt.ownerID && directWildSpawnPhase?.id==receipt.ownerID
    }
    private var sourceOrdinaryMinimumReadInProgress=false
    public var sourceOrdinaryMinimumPhaseEnabled=false
    public var sourceOrdinaryPhysicalFinalSnapshotEnabled=false
    public private(set) var sourceOrdinaryPhysicalFinalCaptureCount=0
    private func captureSourceOrdinaryFinalSnapshot(source:NativeTile,destination:NativeTile,effectiveSum:Int)->NativeFinalMergeSnapshot? {
        guard let authority=sourceOrdinaryMinimumTileAuthority else{return nil}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {
            sourceOrdinaryPhysicalFinalSnapshotEnabled && sourceOrdinaryMinimumTileAuthority === authority &&
                state==captured && flags==capturedFlags && locks==capturedLocks
        }
        guard current(),authority.isCurrent(),current(),let paint=authority.capture(),current(),
              paint.paint.canonicalState==captured,authority.isCurrent(),current(),
              captured.sourceDetachedGridTileIDs?.isEmpty != false else{return nil}
        guard let result=NativeSourceFinalMergeBlockers.finalSnapshot(tiles:paint.paint.paintedState.tiles,runtime:paint.tiles,
            source:source,destination:destination,effectiveSum:effectiveSum),current() else{return nil}
        sourceOrdinaryPhysicalFinalCaptureCount+=1
        return result
    }
    public var sourceDirectPhysicalFinalSnapshotEnabled=false
    public private(set) var sourceDirectPhysicalFinalCaptureCount=0
    public var sourceFinalMergePresenceAuthority:NativeSourceFinalMergePresenceAuthority?
    public private(set) var pendingSourceLateFinalMerge:NativeSourceLateFinalMergeReceipt?
    public private(set) var confirmedSourceLateFinalMerge:NativeSourceLateFinalMergeReceipt?
    public func hasConfirmedSourceLateFinalMerge(ownerID:String,generation:UInt64)->Bool {
        confirmedSourceLateFinalMerge?.ownerID==ownerID && confirmedSourceLateFinalMerge?.generation==generation && state.generation==generation
    }
    public struct SourceRetainedDirectDestination:Equatable,Sendable {
        public let ownerID:String,generation:UInt64,tileID:String,endgame:Bool
    }
    public private(set) var sourceRetainedDirectDestination:SourceRetainedDirectDestination?
    public var sourceRetainedDirectDestinationCleanup:((SourceRetainedDirectDestination)->Bool)?
    public func removeSourceRetainedDirectDestination(_ receipt:SourceRetainedDirectDestination)->NativeMoveResult {
        guard sourceRetainedDirectDestination==receipt,state.generation==receipt.generation else{return rejected("stale_source_direct_destination_cleanup")}
        state.tiles.removeAll{$0.id==receipt.tileID}
        if var detached=state.sourceDetachedGridTileIDs {detached.remove(receipt.tileID);state.sourceDetachedGridTileIDs=detached.isEmpty ? nil:detached}
        sourceRetainedDirectDestination=nil
        return .init(accepted:true,state:state,events:[.init(.removed,tileIDs:[receipt.tileID],reason:"source-direct-destination-cleanup")],resolution:resolve())
    }
    public var sourceLateFinalVisualBegin:((NativeSourceLateFinalMergeReceipt)->Bool)?
    /// Scene calls inside the actual FIFO guard reaction, before any spawn.
    /// Known zero without an active captured destination-six is a false guard;
    /// missing physical state remains unknown and cannot complete a board.
    public func commitSourceLateFinalMergeGuard(ownerID:String,generation:UInt64)->NativeMoveResult? {
        guard generation==state.generation,pendingSourceLateFinalMerge==nil,
              let plan=currentWildSpawnContext,plan.id==ownerID,let phase=directWildSpawnPhase,
              !phase.cancelled,!flags.busyEnding,state.terminal==nil,
              let authority=sourceFinalMergePresenceAuthority,let begin=sourceLateFinalVisualBegin,
              currentSpawnCoroutineFinally != nil else{return nil}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {state==captured && flags==capturedFlags && locks==capturedLocks &&
            currentWildSpawnContext?.id==ownerID && directWildSpawnPhase === phase &&
            sourceFinalMergePresenceAuthority === authority && state.generation==generation}
        guard current(),authority.isCurrent(),current(),let physical=authority.capture(),current(),
              physical.canonicalState==captured,authority.isCurrent(),current(),
              NativeSourceFinalMergeBlockers.singleMergeSixCompletion(tiles:physical.physicalTiles,runtime:physical.runtime,
                sourceID:plan.source.id,destinationID:plan.destination.id)==true else{return nil}
        let receipt=NativeSourceLateFinalMergeReceipt(ownerID:ownerID,generation:generation,revision:state.revision,
            source:plan.source,destination:plan.destination,archetype:plan.archetype,variant:plan.source.variant ?? plan.destination.variant)
        pendingSourceLateFinalMerge=receipt
        guard begin(receipt),current(),pendingSourceLateFinalMerge==receipt else {
            if pendingSourceLateFinalMerge==receipt {pendingSourceLateFinalMerge=nil}
            return nil
        }
        // Literal guard seals the current mutation and cancels its continuation,
        // then resets captured spawn/Special owners through their actual finally.
        phase.cancelForLifecycle()
        guard currentSpawnCoroutineFinally != nil,publishSourceWildCoroutineFinally(plan:plan,phase:phase) else {
            pendingSourceLateFinalMerge=nil
            return rejected("source_late_final_owner_reset_unavailable")
        }
        let removed=[plan.source.id,plan.destination.id]
        state.tiles.removeAll{removed.contains($0.id)}
        if sourceRetainedDirectDestination?.ownerID==ownerID {sourceRetainedDirectDestination=nil}
        if let detached=state.sourceDetachedGridTileIDs {
            let live=detached.intersection(Set(state.tiles.map(\.id)));state.sourceDetachedGridTileIDs=live.isEmpty ? nil:live
        }
        pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];pendingWildLockedBonusPresentations=[]
        directWildPrimaryRecovery=nil;wildPhaseScheduledID=nil;directWildSpawnPhase=nil;wildSpawnContext=nil
        _=clearSourceDirectInitialAwaitIfOwned(ownerID:ownerID,generation:generation)
        pendingSourceDirectLockedBonusGuard=nil;sourceDirectLockedBonusContext=nil;sourceDirectLockedBonusPhase=nil;sourceDirectLockedBonusMath=nil
        pendingSourceTntLockedBonusGuard=nil;sourceTntLockedBonusGuardContext=nil;sourceTntLockedBonusGuardPhase=nil;sourceTntLockedBonusGuardMath=nil
        sourceTntInitialAwaitReceipt=nil;sourceTntInitialReadyReceipt=nil;sourceTntInitialMath=nil
        locks.removeValue(forKey:ownerID)
        // The actual Direct FX receipt still has its authored release timer;
        // retain that exact committed plan until its genuine release callback.
        if !plan.isDirect, pendingSpecial?.id==ownerID {pendingSpecial=nil;specialActivationCommitted=false}
        flags.pendingSpecialMutation=false;wildSourceResolutionBoundary=(ownerID,generation)
        resetMeterAfterRound();state.bestScore=max(state.bestScore,state.score);noMovesSignature=nil
        let resolution=NativeResolution(.complete,reason:"final_single_merge6_guard",target:state.mode == .arcade ? "arcade-stage":"journey-board")
        state.terminal=resolution;pendingSourceLateFinalMerge=nil
        return .init(accepted:true,state:state,events:[.init(.removed,tileIDs:removed,reason:"source-late-final"),.init(.terminal,reason:resolution.reason)],resolution:resolution)
    }
    private func clearSourceDirectInitialAwaitIfOwned(ownerID:String,generation:UInt64)->Bool {
        guard let receipt=pendingSourceDirectInitialAwait,receipt.ownerID==ownerID,receipt.generation==generation else{return false}
        return clearSourceDirectInitialAwait(receipt)
    }
    /// Read-only physical admission for Direct final families/registry variants.
    /// The accepted drop captures its own immutable entry snapshot separately.
    public func sourceDirectTntFinalAdmission(source:NativeTile,destination:NativeTile)->NativeFinalMergeSnapshot? {
        guard [source,destination].filter(\.isWild).allSatisfy({NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:$0) != nil}),
              source.gameplayArchetype != nil || destination.gameplayArchetype != nil else{return nil}
        return captureSourceDirectLiveFinalSnapshot(source:source,destination:destination,effectiveSum:6,countAcceptedCapture:false)
    }
    private func sourceDetachedPhysicalRosterAdmission()->Bool {
        guard sourceDirectPhysicalFinalSnapshotEnabled,sourceMathRandom != nil,
              let authority=sourceFinalMergePresenceAuthority else{return false}
        let captured=state,capturedFlags=flags,capturedLocks=locks,math=sourceMathRandom
        func current()->Bool {state==captured && flags==capturedFlags && locks==capturedLocks &&
            sourceFinalMergePresenceAuthority === authority && sourceMathRandom === math && sourceDirectPhysicalFinalSnapshotEnabled}
        guard current(),authority.isCurrent(),current(),let snapshot=authority.capture(),current(),
              snapshot.canonicalState==captured,authority.isCurrent(),current() else{return false}
        return true
    }
    private func captureSourceDirectLiveFinalSnapshot(source:NativeTile,destination:NativeTile,effectiveSum:Int,countAcceptedCapture:Bool=true)->NativeFinalMergeSnapshot? {
        guard let authority=sourceFinalMergePresenceAuthority else{return nil}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {
            sourceDirectPhysicalFinalSnapshotEnabled && sourceFinalMergePresenceAuthority === authority &&
                state==captured && flags==capturedFlags && locks==capturedLocks
        }
        guard current(),authority.isCurrent(),current(),let paint=authority.capture(),current(),
              paint.canonicalState==captured,authority.isCurrent(),current(),
              let result=NativeSourceFinalMergeBlockers.finalSnapshot(tiles:paint.physicalTiles,runtime:paint.runtime,
                source:source,destination:destination,effectiveSum:effectiveSum,
                magnetWillPull:(source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet) &&
                    !magnetPullCandidates(paint.physicalTiles,source:source,destination:destination).isEmpty),current() else{return nil}
        if countAcceptedCapture {sourceDirectPhysicalFinalCaptureCount+=1}
        return result
    }
    public var sourceOrdinaryMinimumTileAuthority:NativeSourceOrdinaryMinimumTileAuthority?
    public var sourceWildMinimumTileAuthority:NativeSourceOrdinaryMinimumTileAuthority?
    private var sourceWildMinimumCaptureRejected=false
    private var sourceOrdinaryMinimumPhaseEligible=false
    private var sourceOrdinaryMinimumRuntime:[String:NativeNoMovesTileRuntime]?
    private var sourceOrdinaryMinimumRescueStage:Int?
    private var sourceOrdinaryMinimumRescueOpened=0
    public private(set) var pendingSourceOrdinaryMinimumPhase:SourceOrdinaryMinimumPhaseReceipt?
    public private(set) var pendingSourceOrdinaryLockedSettlement:SourceOrdinaryLockedSettlement?
    public var sourceSpecialContactHook:NativeSourceSpecialContactHook?
    /// Native physical-face bridge admission, not a Source spawn/save marker.
    public var sourceOrdinaryStackFacesEnabled=false
    /// Private constructor timing opt-in; actual halo owns its count draw.
    /// Requires shared APP Math and remains OFF until full caller/reward binding.
    public var sourceStarOrbitCountAtPresentationEnabled=false
    private var sourceOrdinaryStackFaces:[String:NativeSourceOrdinaryStackFaceEntry]=[:]
    private var sourceOrdinaryStackFaceCancellationBlocks:[String:NativeSourceOrdinaryStackFaceReceipt]=[:]
    public var unsettledSourceOrdinaryStackFaceCancellations:[NativeSourceOrdinaryStackFaceReceipt] {
        sourceOrdinaryStackFaceCancellationBlocks.values.sorted{$0.sequence<$1.sequence}
    }
    public var pendingSourceOrdinaryStackFaces:[NativeSourceOrdinaryStackFaceReceipt] {
        sourceOrdinaryStackFaces.values.map(\.receipt).sorted{$0.sequence<$1.sequence}
    }
    public var hasPendingSourceOrdinaryStackFace:Bool {!sourceOrdinaryStackFaces.isEmpty || !sourceOrdinaryStackFaceCancellationBlocks.isEmpty}
    public var hasUnsavableSourceGameplayState:Bool {
        // A Native caller cannot serialize a partially observed Core/physical
        // callback pair. Do not write a fabricated flag into SourceSaveRuntime.
        if hasPendingSourceOrdinaryStackFace || pendingSourceMagnetFallbackOpen != nil || !sourceNoMovesCallerRefusals.isEmpty {return true}
        if pendingSourceDirectInitialAwait != nil || sourceDirectLockedBonusContext != nil ||
           sourceTntInitialAwaitReceipt != nil || sourceTntLockedBonusGuardContext != nil {return true}
        var snapshot=sourceSaveRuntime
        snapshot.wildSpawnInProgress = snapshot.wildSpawnInProgress || sourceMeterSpawnInProgress
        snapshot.wildDropInProgress = snapshot.wildDropInProgress || meterDropReservations.values.contains {$0.assetsPrepared && !$0.dropCompleted && !$0.queueCanceled}
        for drop in meterDropReservations.values {
            var marker=NativeSourceSaveTileMarkers()
            marker.wildSpawnDropping = drop.assetsPrepared && !drop.landed
            marker.wildSpawnHandoffLock=drop.handoffLocked
            snapshot.tileMarkers.append(marker)
        }
        snapshot.busyEnding = snapshot.busyEnding || flags.busyEnding
        snapshot.wildSpawnInProgress = snapshot.wildSpawnInProgress || flags.wildSpawnInProgress
        snapshot.merge6SpawnInProgress = snapshot.merge6SpawnInProgress || flags.merge6SpawnInProgress || pendingOrdinarySix != nil || directWildSpawnPhase != nil
        snapshot.wildMagnetPullInProgress = snapshot.wildMagnetPullInProgress || flags.wildMagnetPullInProgress
        snapshot.specialTransactionActive = snapshot.specialTransactionActive || pendingSpecial != nil || (pendingDirectWild != nil && !directWildGameplayCommitted)
        snapshot.regularHandoffActive = snapshot.regularHandoffActive || pendingOrdinaryStack != nil
        snapshot.cleanupOwned = snapshot.cleanupOwned || state.tiles.contains(where:{$0.merge6CleanupOwned})
        snapshot.activeDrag = snapshot.activeDrag || drag != nil
        snapshot.tileMarkers += state.tiles.map {tile in
            var marker=NativeSourceSaveTileMarkers();marker.pendingRemoval=tile.pendingRemoval
            // Existing native transientSpawn is the imported source spawn lifecycle
            // marker. spawn-helpers bounce by itself never sets this marker.
            marker.isBeingSpawned=tile.transientSpawn
            return marker
        }
        return snapshot.hasUnsavableTransientGameplayState
    }
    // PRIVATE candidate; the admitted Scene must provide actual Source receipts.
    public var stagedMeterDrops=false
    /// Opt-in only after real selected warmup/native hidden-node transport is installed.
    public var stagedMeterOpen=false
    public private(set) var pendingMeterOpen:NativeMeterOpenRequest?
    public private(set) var pendingMeterOpenRetry:NativeMeterOpenRetry?
    private var meterOpenSequence:UInt64=0,sourceMeterSpawnCancelToken:UInt64=0
    private struct MeterOpenFlow {
        let id:String,generation:UInt64,spawnToken:UInt64,excluded:Set<NativeCell>
        let sourceTutorialOwnerID:String?,forcedTutorialCell:NativeCell?
        var tries=0,attempted:Set<NativeCell>=[],queueCanceled=false
    }
    private var meterOpenFlow:MeterOpenFlow?
    private var meterOpenCommitting=false
    /// Must be fed by the actual authoritative final-merge owner, never guessed alpha/HUD state.
    public var sourceMeterLastMergeTileIDs:Set<String>=[]
    public private(set) var meterDropReservations:[String:NativeMeterDropReservation]=[:]
    private var meterDropSequence:UInt64=0
    /// Source queue owner participates in ENDGAME/SAVE, never the unrelated
    /// shared input flag. Ordinary and prior Wild input remain independently legal.
    public var sourceMeterSpawnInProgress:Bool {
        (meterOpenFlow != nil && meterOpenFlow?.queueCanceled == false) || meterDropReservations.values.contains {!$0.bookkeepingCommitted && !$0.queueCanceled}
    }
    /// Source tile-state-utils classifies the separate140ms handoff marker as
    /// transient even after queue/wildSpawnInProgress becomes false.
    public var sourceMeterHandoffInProgress:Bool {
        meterDropReservations.values.contains {$0.handoffLocked}
    }
    public var resolutionRuntimeFlags:NativeGameplayRuntimeFlags {
        var snapshot=flags
        snapshot.wildSpawnInProgress = snapshot.wildSpawnInProgress || sourceMeterSpawnInProgress
        return snapshot
    }
    private var sourceMeterBlocksAnotherSpawn:Bool {
        if meterOpenFlow != nil {return true}
        return         meterDropReservations.values.contains {
            (!$0.bookkeepingCommitted && !$0.queueCanceled) ||
            ($0.assetsPrepared && !$0.landed) || $0.handoffLocked
        }
    }
    /// A meter carrier is owned through its real Promise bookkeeping and wall
    /// handoff. Visibility/landing alone cannot transfer it to a Magnet pull:
    /// removing it would strand the pending carrier receipts and physical node.
    public func magnetPullCandidates(_ tiles:[NativeTile],source:NativeTile,destination:NativeTile)->[NativeTile] {
        let protected=Set(meterDropReservations.values.filter {
            $0.generation==state.generation && (!$0.bookkeepingCommitted || $0.handoffLocked)
        }.map(\.tileID))
        return NativeGameplayResolver.magnetCandidates(tiles,source:source,destination:destination).filter{!protected.contains($0.id)}
    }
    private func meterDropBlocksTile(_ id:String)->Bool {
        meterDropReservations.values.contains {$0.generation==state.generation && $0.tileID==id && (!$0.landed || $0.handoffLocked || !$0.bookkeepingCommitted)}
    }
    public private(set) var flags = NativeGameplayRuntimeFlags()
    public private(set) var noMovesSignature: String?
    /// Opt-in until the authored Scene transport and final exit are admitted.
    public var stagedSourceNoMoves = false
    /// nil preserves existing Native conservative guards; actual Source owners only.
    public var sourceNoMovesRuntimeAuthority:NativeSourceNoMovesRuntimeAuthority?
    /// Actual Source caller transports must be installed first. Raw/default unchanged.
    public var sourceNoMovesCallerReceiptsEnabled=false
    public var sourceNoMovesCallerAdmission:NativeSourceNoMovesCallerAdmission?
    public var sourceNoMovesCallerCompletionBinding:NativeSourceNoMovesCallerCompletionBinding?
    private var sourceNoMovesCallerPlans:[String:UInt64]=[:]
    /// Default OFF. Actual Source callback/transport publication only.
    /// Observer-only Source writer subset. The active spawn token/reset/save/
    /// input coroutine remains a separate admission requirement.
    public var sourceOrdinarySixSpawnBeginReceiptsEnabled=false
    /// App caller may admit normal locked-pool coroutine separately from endgame.
    public var sourceOrdinarySixSpawnNormalOnly=false
    /// Source value:null constructs its real zero holder before drawing a face.
    /// Default OFF; refusal never falls back to Raw/value-first construction.
    public var sourceOrdinaryFreshConstructorEnabled=false
    public var sourceOrdinaryEndgameCoroutineEnabled=false
    private var sourceOrdinaryEndgameRecovery:NativeWildPrimaryRecoveryOwner?
    public struct SourceOrdinaryEndgameVerificationReceipt:Equatable,Sendable {
        public let id:UUID,ownerID:String,generation:UInt64,commandID:String
    }
    public private(set) var pendingSourceOrdinaryEndgameVerification:SourceOrdinaryEndgameVerificationReceipt?
    public struct SourceOrdinaryEndgameResumeReceipt:Equatable,Sendable {
        public let id:UUID,ownerID:String,generation:UInt64,commandID:String
    }
    public private(set) var pendingSourceOrdinaryEndgameResume:SourceOrdinaryEndgameResumeReceipt?
    public var sourceOrdinaryHardPrimaryPublish:((NativeMoveResult,NativeBoardState,NativeOrdinaryAssignment)->Bool)?
    public var sourceOrdinaryFreshConstructor:((NativeSourceOrdinaryFreshConstructorReceipt)->Bool)?
    public var sourceOrdinaryFreshConstructorCurrent:((NativeSourceOrdinaryFreshConstructorReceipt)->Bool)?
    private var sourceOrdinaryFreshConstructorReceipt:NativeSourceOrdinaryFreshConstructorReceipt?
    public func sourceOrdinaryFreshConstructorIsCurrent(_ receipt:NativeSourceOrdinaryFreshConstructorReceipt)->Bool {
        sourceOrdinaryFreshConstructorEnabled && sourceOrdinaryFreshConstructorReceipt==receipt && state.generation==receipt.generation &&
        pendingOrdinarySix?.id==receipt.ownerID && pendingOrdinaryPrimaryArrival?.id==receipt.assignmentID &&
        state.tiles.contains{$0.id==receipt.tileID && $0.cell==receipt.cell && $0.locked && $0.value==0}
    }
    private var sourceOrdinarySixSpawnBeginSequence:UInt64=0
    private var sourceOrdinarySixSpawnBeginReceipts:[UUID:NativeSourceOrdinarySixSpawnBeginReceipt]=[:]
    public var pendingSourceOrdinarySixSpawnBeginReceipts:[NativeSourceOrdinarySixSpawnBeginReceipt] {
        sourceOrdinarySixSpawnBeginReceipts.values.sorted{$0.sequence<$1.sequence}
    }
    public func sourceOrdinarySixSpawnBeginIsCurrent(_ receipt:NativeSourceOrdinarySixSpawnBeginReceipt)->Bool {
        receipt.generation==state.generation && sourceOrdinarySixSpawnBeginReceipts[receipt.id]==receipt
    }
    @discardableResult public func acknowledgeSourceOrdinarySixSpawnBegin(_ receipt:NativeSourceOrdinarySixSpawnBeginReceipt)->Bool {
        guard sourceOrdinarySixSpawnBeginIsCurrent(receipt) else{return false}
        sourceOrdinarySixSpawnBeginReceipts.removeValue(forKey:receipt.id);return true
    }
    /// Exact observer retirement only; never finish arrival, clear native
    /// transaction locks or infer a Source spawn-owner reset.
    public func retireSourceOrdinarySixSpawnBeginReceipts(generation:UInt64) {
        sourceOrdinarySixSpawnBeginReceipts=sourceOrdinarySixSpawnBeginReceipts.filter{$0.value.generation != generation}
    }
    private func requestSourceOrdinarySixSpawnBegin(_ plan:NativeOrdinaryMovePlan,events:inout[NativeGameplayEvent]) {
        guard sourceOrdinarySixSpawnBeginReceiptsEnabled,
              !sourceOrdinarySixSpawnNormalOnly || state.tiles.contains(where:{$0.locked}) else{return}
        sourceOrdinarySixSpawnBeginSequence &+= 1
        let receipt=NativeSourceOrdinarySixSpawnBeginReceipt(ownerID:plan.id,generation:plan.generation,sequence:sourceOrdinarySixSpawnBeginSequence)
        sourceOrdinarySixSpawnBeginReceipts[receipt.id]=receipt
        events.append(.init(.sourceOrdinarySixSpawnOwnerBeginRequested,reason:receipt.id.uuidString))
    }
    public var sourceOrdinaryPreDebitEnabled=false
    public var sourceOrdinaryPreDebitAdmission:NativeSourceOrdinaryPreDebitAdmission?
    private var sourceOrdinaryPreDebitReceipts:[String:NativeSourceOrdinaryPreDebitReceipt]=[:]
    private var sourceOrdinaryPreDebitRefused:Set<String>=[]
    private var sourceNoMovesCallerRollbackPlans:Set<UInt64>=[]
    private var sourceNoMovesCallerRefusals:Set<String>=[]
    private var sourceNoMovesCallerSequence:UInt64=0
    private var sourceNoMovesCallerReceipts:[String:NativeSourceNoMovesCallerReceipt]=[:]
    private var sourceNoMovesMergeContinuations:[String:Bool]=[:]
    public var pendingSourceNoMovesCallerReceipts:[NativeSourceNoMovesCallerReceipt] {
        sourceNoMovesCallerReceipts.values.sorted{$0.sequence<$1.sequence}
    }
    private var sourceNoMovesAuthorityReading=false
    private var sourceNoMovesLastAuthoritySnapshot:NativeSourceNoMovesRuntimeSnapshot?
    public var noMovesTileRuntime:[String:NativeNoMovesTileRuntime]=[:]
    public var sourceWildRetryPending=false
    public var sourceNonFinalMerge6Guard=false
    private var sourceNoMovesReadyPostchecks:Set<String>=[]
    private var sourceNoMovesStackContexts:[String:NativeNoMovesStackContext]=[:]
    private var sourceNoMovesOwner=NativeNoMovesCandidateOwner()
    private var sourceNoMovesGeneration:UInt64?
    private var sourceNoMovesConfirmed:NativeNoMovesCandidateOwner.Plan?
    private var sourceNoMovesConfirmedResolution:NativeResolution?
    private var sourceNoMovesFinalCleanupReceipt:NativeSourceNoMovesFinalFlowReceipt?
    public private(set) var sourceNoMovesFinalFlowReceipt:NativeSourceNoMovesFinalFlowReceipt?
    public private(set) var completedSourceNoMovesReceipt:NativeSourceNoMovesCompletedReceipt?
    public var pendingSourceNoMoves:NativeNoMovesCandidateOwner.Plan? {sourceNoMovesOwner.active ?? sourceNoMovesConfirmed}
    public var sourceGameplaySignature:NativeSourceGameplaySignature {NativeSourceGameplaySignature(tiles:state.tiles.filter{!(noMovesTileRuntime[$0.id]?.destroyed ?? false)})}

    public private(set) var pendingSpecial: NativeSpecialMovePlan?
    public private(set) var pendingLaserShots: [NativeLaserShot] = []
    /// Native board supplies actual UIKit x coordinates; gameplay owns exact ordering/shooter RNG.
    public var laserTargetX: ((NativeTile) -> Double)?
    public var laserViewportWidth: Double?
    public private(set) var pendingMagnetRespawn: NativeMagnetRespawnPlan?
    /// PRIVATE/default OFF. Authentic Source app-merge fallback continuation.
    public var sourceMagnetLazyRespawnEnabled=false
    public private(set) var pendingSourceMagnetLazyRespawn:NativeSourceMagnetLazyRespawnPlan?
    private var sourceMagnetLazyOperation:UInt64?,sourceMagnetLazyOperationSequence:UInt64=0
    private var sourceMagnetLazyOpens:[Int:NativeSourceMagnetLazyOpen]=[:]
    private var sourceMagnetLazyValueCommits:Set<Int>=[],sourceMagnetLazySettled:Set<Int>=[]
    private var sourceMagnetLazyReserveFill:NativeSourceMagnetReserveFill?
    private var sourceMagnetLazyReserveCommits:Set<Int>=[]
    private var sourceMagnetLazyConversion:NativeSourceMagnetSurvivorConversion?
    private var sourceMagnetLazyConversionCommitted=false,sourceMagnetLazyResolutionReleased=false
    public var sourceMagnetFallbacksEnabled=false
    public private(set) var sourceMagnetPostCommit:NativeSourceMagnetPostCommitReceipt?
    public private(set) var pendingSourceMagnetFallback:NativeSourceMagnetFallbackPlan?
    public private(set) var pendingSourceMagnetFallbackOpen:NativeSourceMagnetFallbackOpen?
    private var sourceMagnetFallbackIndex=0,sourceMagnetFallbackSequence:UInt64=0
    private var sourceMagnetFallbackValueCommitted=false

    private var magnetReplacementIndex = 0
    public private(set) var pendingHUDStars: [NativeHUDStarReceipt] = []
    /// Opt-in only after genuine Source flight/job bindings are mounted.
    public var sourceHUDStarJobsEnabled=false
    /// Enabled by the Native composition root; reference/oracle callers retain captured Source rules.
    public var comboHUDCoinRewardsEnabled=false
    public private(set) var sourceHUDStarJobs:[NativeSourceHUDStarJob]=[]
    private var sourceHUDStarJobSequence:UInt64=0
    public private(set) var pendingMeterRewards: [NativeMeterRewardReceipt] = []
    public var stagedTntActivation = false
    public var stagedDirectWildMoves = false
    public private(set) var pendingWildSpawnPresentations:[NativeWildSpawnPresentation] = []
    private var wildSourceResolutionBoundary:(id:String,generation:UInt64)?
    private var sourceWildCoroutineSettled:(id:String,generation:UInt64)?
    public func hasSourceWildSpawnCoroutine(transactionID:String,generation:UInt64)->Bool {
        state.generation==generation && ((directWildSpawnPhase?.id==transactionID && directWildSpawnPhase?.generation==generation) || hasSettledSourceWildSpawnCoroutine(transactionID:transactionID,generation:generation))
    }
    public func canResumeSourceDirectWildCoroutine(transactionID:String,generation:UInt64)->Bool {
        // Visual/abort and finally receipts can outlive their coroutine phase.
        // Keep the broader lifecycle query above for cleanup callers only.
        state.generation==generation && currentWildSpawnContext?.isDirect==true &&
            currentWildSpawnContext?.id==transactionID && directWildSpawnPhase?.cancelled==false
    }
    public func hasSettledSourceWildSpawnCoroutine(transactionID:String,generation:UInt64)->Bool {
        state.generation==generation && sourceWildCoroutineSettled?.id==transactionID && sourceWildCoroutineSettled?.generation==generation
    }
    /// Original frame/idle scope ends at its Special-primary settlement, or the
    /// actual coroutine finally/cancellation boundary when no primary commits.
    /// It is independent of later Wild-only visual lease and extra spawn work.
    public func hasReachedWildSourceResolutionBoundary(transactionID:String,generation:UInt64)->Bool {
        wildSourceResolutionBoundary?.id==transactionID && wildSourceResolutionBoundary?.generation==generation
    }
    public private(set) var pendingWildRecoveryChecks:[NativeWildRecoveryCheck] = []
    public var stagedDirectWildAssignments = false
    enum WildSpawnPermitPurpose {case primary,hardFallback,locked,bonus}
    var wildSpawnPermitAdmission:((WildSpawnPermitPurpose)->Bool)? // Isolated fixture injection; live epoch checks always remain authoritative.
    private var directWildPrimaryRecovery:NativeWildPrimaryRecoveryOwner?
    public private(set) var pendingWildLockedBonusPresentations:[NativeWildLockedBonusPresentation] = []
    public private(set) var pendingWildSpawnActions:[NativeWildSpawnAction] = []
    public private(set) var pendingWildSpawnArrivals:[NativeWildSpawnArrival] = []
    private var directWildSpawnPhase:NativeWildSpawnPhaseOwner?
    private var wildSpawnContext:NativeWildSpawnPhaseContext?
    private var currentWildSpawnContext:NativeWildSpawnPhaseContext? {
        guard let context=wildSpawnContext,let phase=directWildSpawnPhase,
              context.generation==state.generation,phase.id==context.id,phase.generation==context.generation else{return nil}
        if context.isDirect,pendingDirectWild?.id != context.id {return nil}
        return context
    }
    private var currentSpawnCoroutineResume:((String,UInt64)->Bool)? {
        currentWildSpawnContext?.isDirect==false ? sourceTntCoroutineResume:sourceWildCoroutineResume
    }
    private var currentSpawnCoroutineFinally:((String,UInt64)->Bool)? {
        currentWildSpawnContext?.isDirect==false ? sourceTntCoroutineFinally:sourceWildCoroutineFinally
    }
    private var directWildSpawnAvoiding=0
    private var directWildSpawnRevision:UInt64=0
    private var directWildVisualReleased=false
    private var wildPhaseScheduledID:String?
    private var wildPhaseOpened=0
    private var wildActionSequence=0
    private var wildRemainderExcluded:Set<NativeCell>=[]
    public var stagedOrdinaryMoves = false
    public var stagedOrdinaryAssignments = false
    public private(set) var ordinarySpawnPreparationPending = false
    public private(set) var pendingOrdinaryAssignments:[NativeOrdinaryAssignment] = []
    public private(set) var pendingOrdinaryDestinationCleanup:NativeOrdinaryPostcheckReceipt?
    public private(set) var pendingOrdinaryPrimaryArrival:NativeOrdinaryAssignment?
    private var ordinaryRefillRemaining = 0
    private var ordinaryAssignmentsSequence = 0
    private var ordinaryRequestedOpenings = 0
    private var ordinarySuccessfulOpenings = 0
    private var ordinaryForcedCandidates:[NativeTile] = []
    private var ordinaryForcedPass = false
    public private(set) var pendingOrdinaryStack: NativeOrdinaryMovePlan?
    public private(set) var pendingOrdinarySix: NativeOrdinaryMovePlan?
    public var sourceMergeSixAutoCenterHook:NativeSourceMergeSixAutoCenterHook?
    public private(set) var ordinarySixGameplayCommitted = false
    public private(set) var pendingOrdinarySpawns:Set<String> = []
    public private(set) var pendingOrdinaryPostchecks: [NativeOrdinaryPostcheckReceipt] = []
    private var committingOrdinaryStack = false
    public private(set) var pendingDirectWild: NativeDirectWildMovePlan?
    public private(set) var directWildGameplayCommitted = false
    public private(set) var sourceDirectWildPrefix: NativeSourceDirectWildPrefixReceipt?
    public private(set) var pendingSourceWildDestinationFace:NativeSourceWildDestinationFaceReceipt?
    public private(set) var completedSourceWildDestinationFace:NativeSourceWildDestinationFaceReceipt?
    private func sourceDirectWildLiveDestination(_ prefix:NativeSourceDirectWildPrefixReceipt)->NativeTile {
        if let face=completedSourceWildDestinationFace,face.transactionID==prefix.id,face.generation==prefix.generation{return face.afterFace}
        return prefix.preparedDestination
    }

    private var committingDirectWild = false
    private var directWildPointerID = 0
    public private(set) var specialActivationCommitted = false
    public private(set) var pendingSourceSpecialWildDestinationFace:NativeSourceSpecialWildDestinationFaceReceipt?
    private var completedSourceSpecialWildDestinationFace:NativeSourceSpecialWildDestinationFaceReceipt?
    public private(set) var pendingSourceSpecialAbsorb:NativeSourceSpecialAbsorbReceipt?
    public private(set) var sourceSpecialAbsorbMainEntered=false
    /// Source normal Magnet caller only; Raw parent visibility remains unchanged.
    public var sourceMagnetMain80Enabled=false
    public var sourceTntMain80Enabled=false
    public var sourceTntBonusValuesAtImpact=false
    /// Actual collect-board object order/painted position capability, default nil.
    public var sourceMagnetPullSelection:NativeSourceMagnetPullSelectionOwner?
    private var sourceSpecialAbsorbSequence:UInt64=0
    private var tntTargetsReserved = false
    private var tntComboCoinReward = 0
    private var tntCoinCounts:[String:Int]=[:]
    private var tntReservationReleased = false
    private var deferredFinalMerge: NativeResolution?
    private var hudStarSequence: UInt64 = 0
    /// Presentation readiness belongs to the native renderer; a missing authored owner cannot consume a move.
    public var specialPresentationAdmitted: ((NativeWildArchetype, String?) -> Bool)?
    /// Final pairs use a distinct ready roster from nonfinal mutations.
    public var finalePresentationAdmitted: ((NativeWildArchetype, String?) -> Bool)?
    /// Ordinary six also requires its authored native multiplier/impact owner before reservation.
    public var ordinarySixPresentationAdmitted: (() -> Bool)?
    private var specialSequence: UInt64 = 0
    private var tileSequence: UInt64 = 0
    private var specialImpactIndex = 0
    private var specialPreBoard: NativeBoardState?
    private var specialMoveTime: Double = 0
    public var navigationLocked: Bool { noMovesSignature != nil || state.terminal != nil || (stagedSourceNoMoves && pendingSourceNoMoves != nil) }
    public var isDragging: Bool { drag != nil }
    private struct Drag { let id: String; let pointerID: Int; let generation: UInt64; let revision: UInt64; let origin:NativeCell }
    private var drag: Drag?
    private var locks: [String: Bool] = [:] // true = wild-only; false = entire gameplay
    private var comboLastMutationTime: Double?
    public var comboWindowExtension:Double=0
    private var comboWindow: Double = 2
    public let sourceMathRandom:NativeSourceMathRandomStream?
    private var randomChoices: [Double]
    private let rewardPicker: ((NativeBoardState, Double, () -> Double) -> NativeWildRewardChoice?)?
    private var meterDropAllowed: Bool {
        state.effectiveArcadeVariant != .pureDice || !state.luckyDropUsed
    }
    private var arcadeChargeMultiplier: Double {
        guard meterDropAllowed else { return 0 }
        let variant = state.effectiveArcadeVariant
        // Keep the single drop near the same part of every round, rather than
        // inheriting Endurance's progressively slower stage/spawn modifiers.
        if variant == .pureDice {
            let normalGain = NativeWildMeterRules.increment(base:1,mode:.arcade,board:state.stage,spawnCount:state.wildSpawnCount)
            return variant.meterMultiplier * 1.15 / normalGain
        }
        return variant.meterMultiplier
    }
    private func consumeMeterCharge() {
        if state.effectiveArcadeVariant == .pureDice {
            state.luckyDropUsed = true
            state.wildMeter = 0
        } else {
            state.wildMeter = max(0,state.wildMeter-1)
        }
    }
    private func resetMeterAfterRound() {
        if state.effectiveArcadeVariant != .slowBurn { state.wildMeter = 0 }
    }

    public init(state: NativeBoardState, recordedRandomChoices: [Double] = [], rewardPicker: ((NativeBoardState, Double) -> NativeWildRewardChoice?)? = nil, sourceMathRandom:NativeSourceMathRandomStream?=nil) { self.sourceMathRandom=sourceMathRandom; self.state = state; randomChoices = recordedRandomChoices; self.rewardPicker = rewardPicker.map { picker in { state, roll, _ in picker(state,roll) } } }
    public init(state: NativeBoardState, recordedRandomChoices: [Double] = [], rewardPicker: @escaping (NativeBoardState, Double, () -> Double) -> NativeWildRewardChoice?, sourceMathRandom:NativeSourceMathRandomStream?=nil) { self.sourceMathRandom=sourceMathRandom; self.state = state; randomChoices = recordedRandomChoices; self.rewardPicker = rewardPicker }
    public func setInputLock(_ reason: String, active: Bool, wildOnly: Bool = false) { if active { locks[reason] = wildOnly } else { locks.removeValue(forKey: reason) } }
    public func setRuntimeFlags(_ flags: NativeGameplayRuntimeFlags) { self.flags = flags; if let plan = pendingSpecial { self.flags.pendingSpecialMutation = true; self.flags.wildMagnetPullInProgress = plan.archetype == .magnet }; if pendingDirectWild != nil && !directWildGameplayCommitted { self.flags.pendingSpecialMutation = true } }
    public func canBeginDrag(tileID:String,ignoringInputLock:String?=nil)->Bool {
        guard drag == nil, state.terminal == nil, state.validationIssues(allowSourceDetachedGridReferences:sourceTutorialSubsequentPresentationEnabled).isEmpty,
              let tile = state.tiles.first(where: { $0.id == tileID }), tile.isPlayable, !meterDropBlocksTile(tileID),
              NativeTutorialRules.allowsPickup(tile,tutorial:state.tutorial,rows:state.rows),
              !locks.contains(where: { $0.key != ignoringInputLock && (!$0.value || tile.isWild) }), (!flags.isWaiting || canRunOrdinaryDuringTnt(tile)) else { return false }
        return true
    }
    public func beginDrag(tileID: String, pointerID: Int = 0) -> Bool {
        guard canBeginDrag(tileID:tileID),let tile=state.tiles.first(where:{$0.id==tileID}) else{return false}
        noMovesSignature = nil
        drag = Drag(id: tileID, pointerID: pointerID, generation: state.generation, revision: state.revision,origin:tile.cell)
        return true
    }
    public func cancelDrag() { drag = nil }
    public func cancelNoMovesConfirmation() { noMovesSignature = nil }
    public func restart(state fresh: NativeBoardState) {
        pendingSourceTutorialDemoActivation=nil;sourceTutorialDemoActivationSequence=0
        pendingSourceTutorialPresentationBarrier=nil;sourceTutorialWildReservation=nil;sourceTutorialFourthPreparation=nil
        sourceOrdinarySixSpawnBeginReceipts.removeAll();sourceOrdinaryFreshConstructorReceipt=nil
        sourceOrdinaryEndgameRecovery=nil;pendingSourceOrdinaryEndgameVerification=nil;pendingSourceOrdinaryEndgameResume=nil
        sourceOrdinaryStackFaces.removeAll();sourceOrdinaryStackFaceCancellationBlocks.removeAll()
        meterDropReservations.removeAll();meterDropSequence=0
        pendingMeterOpen=nil;pendingMeterOpenRetry=nil;meterOpenFlow=nil;meterOpenSequence=0;sourceMeterSpawnCancelToken &+= 1;sourceMeterLastMergeTileIDs=[]
        sourceOrdinaryPreDebitReceipts=[:];sourceOrdinaryPreDebitRefused=[];sourceNoMovesCallerReceipts=[:];sourceNoMovesMergeContinuations=[:];sourceNoMovesCallerPlans=[:];sourceNoMovesCallerRollbackPlans=[];sourceNoMovesCallerRefusals=[];sourceNoMovesReadyPostchecks=[];sourceNoMovesStackContexts=[:];sourceNoMovesOwner=NativeNoMovesCandidateOwner();sourceNoMovesConfirmed=nil;sourceNoMovesConfirmedResolution=nil;completedSourceNoMovesReceipt=nil;sourceNoMovesFinalCleanupReceipt=nil;sourceNoMovesFinalFlowReceipt=nil;sourceNoMovesGeneration=nil;noMovesTileRuntime=[:];sourceWildRetryPending=false;sourceNonFinalMerge6Guard=false
        pendingWildRecoveryChecks=[];pendingWildSpawnPresentations=[];wildSourceResolutionBoundary=nil;sourceWildCoroutineSettled=nil;sourceWildSpawnBeginReceipt=nil;sourceSaveRuntime=NativeSourceSaveRuntime()
        pendingSourceDirectInitialAwait=nil;sourceDirectInitialMath=nil;sourceDirectInitialReady=false
        sourceDirectInitialGuardPass=0;sourceDirectInitialEnqueueReceipt=nil;sourceDirectNormalPreSpawnChecks=0;sourceDirectInitialRefused=false
        sourceDirectEndgamePreSpawnChecks=0;sourceWildEndgamePhysicalGuardChecks=0;sourceWildEndgamePhysicalGuardRefused=false
        sourceWildEndgameActiveVerificationChecks=0
        sourceWildEndgameDelayCallbacks=0
        pendingSourceDirectLockedBonusGuard=nil;sourceDirectLockedBonusContext=nil;sourceDirectLockedBonusPhase=nil
        sourceDirectLockedBonusMath=nil;sourceDirectLockedBonusDispatching=nil;sourceDirectLockedBonusRefused=false;sourceDirectNormalLockedBonusGuardChecks=0
        sourceDirectEndgameLockedBonusGuardChecks=0
        let generation = state.generation &+ 1
        state = fresh; state.generation = generation; state.revision = 0; state.terminal = nil; tileSequence = 0
        sourceMeterMutationLedger?.resetTransientGuards(generation:generation)
        retireSourceMagnetLazyState()
        sourceMagnetPostCommit=nil;pendingSourceMagnetFallback=nil;pendingSourceMagnetFallbackOpen=nil;sourceMagnetFallbackIndex=0;sourceMagnetFallbackValueCommitted=false
        pendingSpecial = nil; pendingLaserShots = []; pendingMagnetRespawn = nil; magnetReplacementIndex = 0; specialPreBoard = nil; specialImpactIndex = 0
        sourceRetainedDirectDestination=nil
        directWildPrimaryRecovery?.cancelForLifecycle();directWildPrimaryRecovery=nil;directWildSpawnPhase?.cancelForLifecycle();directWildSpawnPhase=nil;wildSpawnContext=nil;sourceTntSpawnBeginReceipt=nil;sourceTntCoroutineSettled=nil;sourceTntInitialAwaitReceipt=nil;sourceTntInitialMath=nil;sourceTntInitialReadyReceipt=nil;sourceTntInitialEnqueueReceipt=nil;pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];pendingWildLockedBonusPresentations=[];wildPhaseScheduledID=nil;directWildVisualReleased=false
        pendingSourceTntLockedBonusGuard=nil;sourceTntLockedBonusGuardContext=nil;sourceTntLockedBonusGuardPhase=nil
        sourceTntLockedBonusGuardMath=nil;sourceTntLockedBonusGuardDispatching=nil;sourceTntLockedBonusGuardRefused=false
        pendingSourceLateFinalMerge=nil;confirmedSourceLateFinalMerge=nil;pendingDirectWild = nil; sourceDirectWildPrefix = nil;pendingSourceWildDestinationFace=nil;completedSourceWildDestinationFace=nil; directWildGameplayCommitted = false; committingDirectWild = false
        pendingSourceSpecialAbsorb=nil;sourceSpecialAbsorbMainEntered=false
        pendingSourceSpecialWildDestinationFace=nil;completedSourceSpecialWildDestinationFace=nil
        pendingOrdinaryStack = nil; pendingOrdinarySix = nil; ordinarySixGameplayCommitted = false; pendingOrdinaryPostchecks.removeAll(); pendingOrdinarySpawns.removeAll(); ordinarySpawnPreparationPending=false;pendingOrdinaryAssignments.removeAll();pendingSourceOrdinaryLockedSettlement=nil;pendingSourceOrdinaryMinimumPhase=nil;sourceOrdinaryMinimumRescueStage=nil;sourceOrdinaryMinimumRuntime=nil;sourceOrdinaryMinimumRescueOpened=0;sourceOrdinaryMinimumPhaseEligible=false;pendingOrdinaryPrimaryArrival=nil;pendingOrdinaryDestinationCleanup=nil;ordinaryRefillRemaining=0;ordinaryRequestedOpenings=0;ordinarySuccessfulOpenings=0;ordinaryForcedCandidates=[];ordinaryForcedPass=false; committingOrdinaryStack = false
        drag = nil; sourceHUDStarJobs.removeAll(); sourceHUDStarJobSequence=0; pendingHUDStars.removeAll(); pendingMeterRewards.removeAll(); tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = false;tntComboCoinReward = 0;tntCoinCounts.removeAll(); deferredFinalMerge = nil; locks.removeAll(); flags = NativeGameplayRuntimeFlags(); noMovesSignature = nil; comboLastMutationTime = nil
    }
    public func cancelForBackground() {
        pendingWildRecoveryChecks=[];pendingWildSpawnPresentations=[]
        drag = nil; noMovesSignature = nil
        // Source coroutine callbacks retain their own APP/FIFO lifecycle.
        // Background cannot drain a pending helper receipt or fake an arrival.
        if !sourceOrdinaryLockedSettlementsEnabled,let six = pendingOrdinarySix { if !ordinarySixGameplayCommitted { _ = commitOrdinarySix(receiptID:six.id,generation:six.generation) }; if ordinarySpawnPreparationPending {_ = prepareOrdinarySpawns(receiptID:six.id,generation:six.generation)}
            while pendingOrdinaryPrimaryArrival != nil || !pendingOrdinaryAssignments.isEmpty {
                if let primary=pendingOrdinaryPrimaryArrival {
                    guard finishOrdinaryPrimarySpawn(receiptID:six.id,generation:six.generation,assignmentID:primary.id).accepted else{break}
                } else if let slot=pendingOrdinaryAssignments.first {
                    guard commitOrdinaryAssignment(receiptID:six.id,generation:six.generation,assignmentID:slot.id).accepted else{break}
                }
            }
            if pendingOrdinaryDestinationCleanup != nil {_ = commitOrdinaryDestinationCleanup(receiptID:six.id,generation:six.generation)}
            pendingOrdinarySpawns.removeAll(); _ = releaseOrdinarySixHandoff(receiptID:six.id,generation:six.generation) }
        if let stack = pendingOrdinaryStack { _ = finishOrdinaryStackAbsorb(receiptID:stack.id,generation:stack.generation,interrupted:true) }
        pendingOrdinaryPostchecks.removeAll() // waitTrackedResult returns cancelled on interrupted background work.
        if let direct = pendingDirectWild {
            if !directWildGameplayCommitted { _ = commitDirectWildGameplay(transactionID:direct.id) }
            if directWildSpawnPhase != nil {
                for _ in 0..<256 {
                    if let action=pendingWildSpawnActions.first {
                        guard commitWildSpawnAction(transactionID:direct.id,generation:direct.generation,actionID:action.id).accepted else{break}
                    } else if let arrival=pendingWildSpawnArrivals.first {
                        guard finishWildSpawnArrival(transactionID:direct.id,generation:direct.generation,arrivalID:arrival.id).accepted else{break}
                    } else {break}
                    if directWildSpawnPhase == nil {break}
                }
            }
            if (directWildSpawnPhase?.cancelled == true || directWildSpawnPhase?.complete == true) && directWildSpawnPhase?.primaryArrived == false {
                abortUncommittedDirectWildForLifecycle(plan:direct)
            } else { _ = releaseDirectWildPresentation(transactionID:direct.id,generation:direct.generation) }
        }
        if let initial = pendingSpecial {
            if initial.archetype == .tnt {
                if !specialActivationCommitted { _ = commitSpecialActivation(transactionID:initial.id) }
                if !tntTargetsReserved { _ = reserveTntTargets(transactionID:initial.id) }
                while let live = pendingSpecial,specialImpactIndex < live.targets.count {
                    if !commitSpecialImpact(transactionID:live.id,tileID:live.targets[specialImpactIndex].id).accepted { break }
                }
            }
            guard let plan = pendingSpecial else { return }
            if let respawn = pendingMagnetRespawn {
                while magnetReplacementIndex < respawn.replacements.count {
                    if !commitMagnetReplacement(transactionID:plan.id,index:magnetReplacementIndex).accepted { break }
                }
            }
            _ = commitSpecialBoard(transactionID:plan.id)
        }
        for receipt in pendingMeterRewards { _ = commitMeterReward(receiptID:receipt.id,generation:receipt.generation) }
        // Protected Source roots remain paused. Their independent wall job may
        // discard unfinished debt; background must not invent a98% arrival.
        let protected=Set(sourceHUDStarJobs.flatMap(\.receiptIDs))
        for receipt in pendingHUDStars where !sourceHUDStarJobsEnabled && !protected.contains(receipt.id) { _ = commitHUDStarArrival(receiptID:receipt.id,generation:receipt.generation) }
    }
    private func canRunOrdinaryDuringTnt(_ tile: NativeTile) -> Bool {
        tntReservationReleased && pendingSpecial?.archetype == .tnt && !tile.isWild && tile.isPlayable &&
            !flags.busyEnding && !flags.wildSpawnInProgress && !flags.merge6SpawnInProgress && !flags.wildMagnetPullInProgress
    }
    /// Called only after the authored blast/return has settled and exact targets have been reserved.
    public func releaseTntReservation(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil, let plan = pendingSpecial,plan.id == transactionID,plan.generation == state.generation,plan.archetype == .tnt,tntTargetsReserved,!tntReservationReleased else { return rejected("tnt_reservation_release_not_ready") }
        var events: [NativeGameplayEvent] = []
        if !specialActivationCommitted {
            let activated = commitSpecialActivation(transactionID:transactionID)
            guard activated.accepted else { return activated }; events += activated.events
        }
        tntReservationReleased = true
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Exactly one generation-bound timer may credit a captured delayed impact charge.
    public func commitMeterReward(receiptID: String,generation: UInt64) -> NativeMoveResult {
        guard state.terminal == nil,generation == state.generation,let index = pendingMeterRewards.firstIndex(where: { $0.id == receiptID && $0.generation == generation }) else { return rejected("stale_or_duplicate_meter_reward") }
        let receipt = pendingMeterRewards.remove(at:index)
        state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:receipt.base,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        var events = [NativeGameplayEvent(.meterRewardCommitted,value:receipt.impactIndex,reason:receipt.id)]
        let resolution = settleDeferredFinalMerge(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    public func resolve() -> NativeResolution {
        if state.terminal==nil && !sourceOrdinaryPreDebitRefused.isEmpty {return .init(.wait,reason:"source_ordinary_predebit_endpoint_missing")}
        if state.terminal==nil && !sourceNoMovesCallerRefusals.isEmpty {return .init(.wait,reason:"source_no_moves_caller_endpoint_missing")}
        if state.terminal == nil && hasPendingSourceOrdinaryStackFace {return NativeResolution(.wait,reason:"captured_ordinary_face_pending")}
        if state.terminal == nil && sourceMeterSpawnInProgress {
            return NativeResolution(.wait,reason:"captured_meter_drop_continuation")
        }
        if state.terminal == nil && sourceMeterHandoffInProgress {
            return NativeResolution(.wait,reason:"captured_meter_tile_handoff")
        }
        if state.terminal == nil && directWildSpawnPhase != nil {return NativeResolution(.wait,reason:"direct_wild_spawn_continuation_pending")}
        if state.terminal == nil && (pendingOrdinaryStack != nil || pendingOrdinarySix != nil || !pendingOrdinaryPostchecks.isEmpty) { return NativeResolution(.wait,reason:"ordinary_mutation_pending") }
        if state.terminal == nil && !pendingMeterRewards.isEmpty { return NativeResolution(.wait,reason:"captured_meter_reward_pending") }
        if meterDropAllowed && state.terminal == nil && state.wildMeter >= 1-0.000001 && !flags.isWaiting { return NativeResolution(.wait,reason:"wild_continuation_pending") }
        let resolution = NativeGameplayResolver.resolve(state: state, flags: resolutionRuntimeFlags)
        if resolution.kind == .fail && state.tutorial?.completionAssist == true { return NativeResolution(.wait,reason:"tutorial_final_chance_pending") }
        return resolution
    }
    public func expireCombo(now: Double) {
        guard let last = comboLastMutationTime, now - last >= comboWindow+max(0,comboWindowExtension) else { return }
        state.combo = 0; comboLastMutationTime = nil
    }
    public func drop(target: NativeCell?, pointerID: Int = 0, now: Double = 0) -> NativeMoveResult {
        guard let owned = drag else { return rejected("no_active_drag") }
        guard owned.pointerID == pointerID else { return rejected("pointer_owner_mismatch") }
        if pendingOrdinaryStack != nil && !committingOrdinaryStack { drag = nil; return rejected("regular_stack_absorb_handoff") }
        drag = nil
        guard owned.generation == state.generation, owned.revision == state.revision, state.terminal == nil else { return rejected("stale_drag_owner") }
        guard let target, let liveSource = state.tiles.first(where: { $0.id == owned.id }), let liveDestination = state.tile(at: target) else { return rejected("illegal_drop") }
        // Source saved the pair's family/value/depth before clearing the actual
        // destination. Only the genuine internal main80 commit may consume it.
        // Keep state.tiles live throughout callbacks/RNG; never swap old tiles in.
        let prefixPlan: NativeDirectWildMovePlan? = {
            guard committingDirectWild,let plan=pendingDirectWild,let prefix=sourceDirectWildPrefix,
                  prefix.id==plan.id,prefix.generation==state.generation,prefix.revision==state.revision,
                  liveSource==plan.source,liveDestination==sourceDirectWildLiveDestination(prefix) else{return nil}
            return plan
        }()
        let source=prefixPlan?.source ?? liveSource,destination=prefixPlan?.destination ?? liveDestination
        let decisionTiles=prefixPlan == nil ? state.tiles:state.tiles.map{$0.id==destination.id ? destination:$0}
        guard NativeGameplayResolver.canDrop(source, onto: destination),
              !meterDropReservations.values.contains(where:{$0.tileID==source.id && (!$0.landed || $0.handoffLocked || !$0.bookkeepingCommitted)}),
              !meterDropReservations.values.contains(where:{$0.tileID==destination.id && !$0.bookkeepingCommitted}), !locks.values.contains(where: { !$0 || source.isWild || destination.isWild }), (!flags.isWaiting || canRunOrdinaryDuringTnt(source) && canRunOrdinaryDuringTnt(destination)) else { return rejected("illegal_drop") }
        let detachedAdmission=sourceTutorialSubsequentPresentationEnabled ||
            (state.sourceDetachedGridTileIDs?.isEmpty==false && sourceDetachedPhysicalRosterAdmission())
        guard state.validationIssues(allowSourceDetachedGridReferences:detachedAdmission).isEmpty else { return rejected("invalid_authoritative_board") }
        guard NativeTutorialRules.allowsDrop(source:source,destination:destination,tutorial:state.tutorial,rows:state.rows) else { return rejected("tutorial_drop_restricted") }
        let effectiveSum = source.isWild || destination.isWild ? 6 : source.value + destination.value
        if directWildSpawnPhase != nil && effectiveSum>=6 {return rejected("direct_wild_spawn_continuation_pending")}
        if pendingOrdinarySix != nil && (!source.isWild && !destination.isWild && effectiveSum < 6) == false { return rejected("regular_merge6_handoff") }
        // The production canDrop permits lingering regular six + 1...5. Its recovery
        // continuation is a distinct source branch; fail closed until that port exists.
        guard effectiveSum <= 6 else { return rejected("native_lingering_six_continuation_pending") }
        let pull = (source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet) && !magnetPullCandidates(decisionTiles,source:source,destination:destination).isEmpty
        let final:NativeFinalMergeSnapshot
        var sourceDirectEntrySnapshot:NativeFinalMergeSnapshot?
        let directPhysicalPair=(source.isWild || destination.isWild) &&
            [source,destination].filter(\.isWild).allSatisfy {
                NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:$0) != nil
            }
        if committingDirectWild,let plan=pendingDirectWild,plan.generation==state.generation,
           let captured=plan.sourceEntryFinalSnapshot,captured.isFinalMerge {
            // Literal Source: confirmed entry finality survives live Wild prefix
            // and later FX/visibility mutation. Never re-read a cleared marker.
            final=captured
        } else if sourceDirectPhysicalFinalSnapshotEnabled,directPhysicalPair {
            guard let captured=captureSourceDirectLiveFinalSnapshot(source:source,destination:destination,effectiveSum:effectiveSum) else {
                return rejected("source_direct_final_snapshot_unavailable")
            }
            if committingDirectWild,let plan=pendingDirectWild,captured.isFinalMerge != plan.isFinal {
                guard !plan.isFinal,captured.isFinalMerge else{return rejected("source_direct_live_final_guard_unadmitted")}
                // Genuine main-boundary false→true capture has its own receipt;
                // the immutable entry plan remains unchanged. Normal main
                // accounting happens once and suppresses all refill ownership.
                let receipt=NativeSourceLateFinalMergeReceipt(ownerID:plan.id,generation:plan.generation,revision:state.revision,
                    source:plan.source,destination:plan.destination,archetype:plan.archetype,variant:plan.variant)
                pendingSourceLateFinalMerge=receipt;confirmedSourceLateFinalMerge=receipt
            }
            final=captured;sourceDirectEntrySnapshot=captured
        } else if sourceOrdinaryPhysicalFinalSnapshotEnabled,!source.isWild,!destination.isWild,effectiveSum==6 {
            guard let captured=captureSourceOrdinaryFinalSnapshot(source:source,destination:destination,effectiveSum:effectiveSum) else {
                return rejected("source_ordinary_final_snapshot_unavailable")
            }
            final=captured
        } else {final=NativeGameplayResolver.finalMerge(decisionTiles, source: source, destination: destination, effectiveSum: effectiveSum, hasTilesToPull: pull)}
        let gameplayArchetype = NativeSpecialDiceRegistry.finale(source: source, destination: destination, gameplay: true)
        if final.isFinalMerge,let gameplayArchetype,let finalePresentationAdmitted,
           !finalePresentationAdmitted(gameplayArchetype,source.variant ?? destination.variant) { return rejected("native_finale_presentation_not_ready") }
        // Source no-pull Magnet uses the same genuine primary/locked spawn
        // continuation as the other Direct Wilds, rather than eager refill.
        let sourceMagnetWithoutPull = gameplayArchetype == .magnet && !pull && stagedDirectWildMoves && stagedDirectWildAssignments
        if let gameplayArchetype, (gameplayArchetype == .magnet || gameplayArchetype == .tnt) && !final.isFinalMerge && !sourceMagnetWithoutPull { return stageSpecialMove(source:source,destination:destination,archetype:gameplayArchetype,now:now) }
        // Meter reward can create a Special die. Never discard the reward or substitute a regular die.
        let arcadeStage = max(1, state.stage)
        let arcadeMeterMultiplier: Double = state.mode != .arcade ? 1 : arcadeStage == 1 ? 1.15 : arcadeStage == 2 ? 1 : arcadeStage == 3 ? 0.9 : arcadeStage == 4 ? 0.8 : arcadeStage < 8 ? 0.7 : 0.6
        let meterIncrement = (effectiveSum == 6 ? 0.22 : 0.10) * (state.wildSpawnCount >= 2 ? 0.6 : 1) * arcadeMeterMultiplier * (state.tutorial?.meterMultiplier ?? 1) * arcadeChargeMultiplier
        if pendingSpecial == nil && !final.isFinalMerge && state.wildMeter + meterIncrement >= 1 - 0.000001 && rewardPicker == nil && state.tutorial?.waitingForWild != true && state.tutorial?.specialBarDefersReward != true { return rejected("native_wild_meter_spawn_pending") }
        if stagedDirectWildMoves && !committingDirectWild,let gameplayArchetype,
           final.isFinalMerge || gameplayArchetype == .star || gameplayArchetype == .juice || sourceMagnetWithoutPull {
            return stageDirectWild(source:source,destination:destination,archetype:gameplayArchetype,pointerID:pointerID,now:now,isFinal:final.isFinalMerge,sourceEntryFinalSnapshot:sourceDirectEntrySnapshot)
        }
        if stagedOrdinaryMoves && !committingOrdinaryStack && gameplayArchetype == nil {
            if effectiveSum == 6 { return stageOrdinarySix(source:source,destination:destination,now:now,isFinal:final.isFinalMerge) }
            return stageOrdinaryStack(source:source,destination:destination,pointerID:pointerID,now:now)
        }
        let initialState = state
        let initialHUDStars = pendingHUDStars
        let initialStarSequence = hudStarSequence
        let initialRandomChoices = randomChoices
        let initialComboTime = comboLastMutationTime
        let initialComboWindow = comboWindow
        expireCombo(now: now)
        let oldCombo = state.combo
        let isMagnet = source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet
        state.combo = min(99, oldCombo + 1)
        let hudStars = captureHUDStars(source:source,destination:destination,starOrbitCapture:committingDirectWild ? pendingDirectWild?.sourceStarOrbitCapture:nil,finalMerge:final.isFinalMerge)
        state.longestCombo = max(state.longestCombo,state.combo)
        let deltaBonus = NativeRewardMath.streakBonus(state.combo) - NativeRewardMath.streakBonus(oldCombo)
        state.earnedComboBonus = min(999999, state.earnedComboBonus + max(0, deltaBonus))
        comboLastMutationTime = now
        comboWindow = source.isWild || destination.isWild ? 4 : 2
        state.revision &+= 1
        state.moves = max(0, state.moves - 1)
        if effectiveSum < 6 { state.score = min(999999, state.score + effectiveSum) }
        state.tiles.removeAll { $0.id == source.id }
        var merged = destination
        merged.value = effectiveSum
        let sourceFaceCaptured = sourceOrdinaryStackFacesEnabled && effectiveSum<6 && committingOrdinaryStack && pendingOrdinaryStack != nil
        merged.stackDepth = sourceFaceCaptured ? destination.stackDepth:min(4,source.stackDepth+destination.stackDepth)
        if effectiveSum < 6 && !sourceFaceCaptured {state.maxStackDepth=max(state.maxStackDepth,merged.stackDepth)}
        merged.archetype = nil; merged.variant = nil; merged.locked = false
        state.tiles.removeAll { $0.id == destination.id }
        var events = [NativeGameplayEvent(.merged, tileIDs: [source.id, destination.id], value: effectiveSum, archetype: NativeSpecialDiceRegistry.finale(source: source, destination: destination), variant: source.variant ?? destination.variant), NativeGameplayEvent(.comboChanged, value: state.combo)]
        if !hudStars.isEmpty { events.append(NativeGameplayEvent(.hudStarsPrepared,tileIDs:hudStars.map(\.id),value:hudStars.count,archetype:source.isWild ? source.archetype : destination.archetype,variant:source.variant ?? destination.variant)) }
        if effectiveSum < 6 { state.tiles.append(merged) }
        if effectiveSum == 6 {
            if let world=NativeSpecialDiceRegistry.celebrationWorld(source:source,destination:destination) {state.lastSpecialMergeWorld=world}
            state.cubesCracked += 1
            let finale = NativeSpecialDiceRegistry.finale(source: source, destination: destination)
            let multiplier = isMagnet || finale == .star || finale == .juice ? 2 : source.stackDepth + destination.stackDepth
            // On final ordinary merge the source retains its regular physical multiplier;
            // final Magnet has mult=0 => bubbleMult1; its ordinary no-pull completion increments combo.
            let bubbleMultiplier = isMagnet && final.isFinalMerge ? 1 : multiplier
            state.score = min(999999, state.score + 6 * bubbleMultiplier * max(1, state.combo))
            if committingDirectWild,!final.isFinalMerge,sourceWildSpawnBegin != nil,
               sourceDirectPhysicalFinalSnapshotEnabled,let plan=pendingDirectWild,
               sourceRetainedDirectDestinationCleanup != nil {
                // Literal Wild placeholder leaves this same dst in the physical
                // roster, hidden and detached, until the actual cleanup callback.
                // Preserve the actual committed first-face fields. A Wild
                // destination's RAF changed depth/residual before this main;
                // the pre-RAF prefix is no longer the live captured object.
                var retained=sourceDirectWildPrefix.map{sourceDirectWildLiveDestination($0)} ?? merged
                retained.value=6;retained.archetype=nil;retained.visible=false;retained.alpha=0
                retained.merge6CleanupOwned=true;retained.nonFinalMerge6=true
                state.tiles.append(retained)
                var detached=state.sourceDetachedGridTileIDs ?? [];detached.insert(retained.id);state.sourceDetachedGridTileIDs=detached
                sourceRetainedDirectDestination = .init(ownerID:plan.id,generation:plan.generation,tileID:retained.id,endgame:usesSimpleArcadeWildSpawn(archetype:plan.archetype) || !state.tiles.contains{$0.locked})
            }
            if sourceRetainedDirectDestination?.tileID != destination.id {events.append(NativeGameplayEvent(.removed, tileIDs: [destination.id]))}
            if !final.isFinalMerge {
                if let gameplayArchetype { spawnDirectWildMerge6(at: destination.cell, archetype: gameplayArchetype, depth: multiplier, avoiding: source.isWild ? destination.value : source.value, starOrbitCount: (source.isWild ? (source.variant == nil ? source.starOrbitCount:source.effectiveStarDropCount) : (destination.variant == nil ? destination.starOrbitCount:destination.effectiveStarDropCount)), variant:source.variant ?? destination.variant, events: &events) }
                else { spawnRegularMerge6(at: destination.cell, depth: multiplier, events: &events) }
            }
        }
        advanceTutorialAfterMerge(source:source,destination:destination,events:&events)
        if final.isFinalMerge {
            let resolution = NativeResolution(.complete, reason: final.isFinalRegularMerge6 ? "final_regular_merge6" : "final_wild_merge6", target: state.mode == .arcade ? "arcade-stage" : "journey-board")
            if pendingSpecial != nil || !pendingMeterRewards.isEmpty {
                // The captured last pair suppresses its own spawn, but cannot publish a terminal
                // result over an earlier reserved mutation/earned charge.
                deferredFinalMerge = resolution; state.bestScore = max(state.bestScore,state.score)
                return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
            }
            resetMeterAfterRound()
            state.bestScore = max(state.bestScore,state.score)
            state.terminal = resolution; noMovesSignature = nil
            events.append(NativeGameplayEvent(.terminal, reason: resolution.reason))
            return NativeMoveResult(accepted: true, state: state, events: events, resolution: resolution)
        }
        state.wildMeter = max(0, state.wildMeter + meterIncrement)
        if state.wildMeter >= 1 - 0.000001 && directWildSpawnPhase == nil && pendingSpecial == nil && pendingOrdinaryStack == nil && pendingOrdinarySix == nil && state.tutorial?.specialBarDefersReward != true {
            guard spawnMeterReward(events: &events) else { state = initialState; pendingHUDStars = initialHUDStars; hudStarSequence = initialStarSequence; randomChoices = initialRandomChoices; comboLastMutationTime = initialComboTime; comboWindow = initialComboWindow; return rejected("native_wild_meter_reward_policy_rejected") }
        }
        state.bestScore = max(state.bestScore,state.score)
        let resolution = settleDeferredFinalMerge(events:&events)
        if resolution.kind == .fail { noMovesSignature = state.signature; events.append(NativeGameplayEvent(.noMovesCandidate, reason: resolution.reason)) } else { noMovesSignature = nil }
        return NativeMoveResult(accepted: true, state: state, events: events, resolution: resolution)
    }

    private func stageDirectWild(source: NativeTile,destination: NativeTile,archetype: NativeWildArchetype,pointerID: Int,now: Double,isFinal: Bool,sourceEntryFinalSnapshot:NativeFinalMergeSnapshot?=nil) -> NativeMoveResult {
        guard pendingDirectWild == nil,pendingSpecial == nil else { return rejected("direct_wild_transaction_in_progress") }
        if !isFinal,let specialPresentationAdmitted,!specialPresentationAdmitted(archetype,source.variant ?? destination.variant) { return rejected("native_special_presentation_not_ready") }
        var prepared:NativeSourceMergeSixAutoCenterLease?,stageAccepted=false
        var starOrbitCapture:NativeSourceStarOrbitCapture?
        defer {if !stageAccepted {prepared?.rejected()}}
        if let hook=sourceMergeSixAutoCenterHook {
            let captured=state,capturedFlags=flags,capturedLocks=locks
            let capturedOpen=pendingMeterOpen,capturedStack=pendingOrdinaryStack,capturedSix=pendingOrdinarySix,capturedSpecial=pendingSpecial,capturedDirect=pendingDirectWild
            guard let lease=hook.prepare(source,destination,state.generation) else{return rejected("source_six_auto_center_not_admitted")}
            prepared=lease
            let admitted=lease.isCurrent()
            guard admitted,drag==nil,sourceMergeSixAutoCenterHook === hook,state==captured,flags==capturedFlags,locks==capturedLocks,
                  pendingMeterOpen==capturedOpen,pendingOrdinaryStack==capturedStack,pendingOrdinarySix==capturedSix,pendingSpecial==capturedSpecial,pendingDirectWild==capturedDirect else{return rejected("source_six_auto_center_reentered")}
        }
        if let hook=sourceSpecialContactHook {
            let captured=state,capturedFlags=flags,capturedLocks=locks
            let capturedOpen=pendingMeterOpen,capturedStack=pendingOrdinaryStack,capturedSix=pendingOrdinarySix
            guard state.tiles.first(where:{$0.id==source.id})==source,
                  state.tiles.first(where:{$0.id==destination.id})==destination else{return rejected("source_special_contact_changed")}
            guard let lease=hook.claim(source,destination,archetype) else{return rejected("source_special_claim_rejected")}
            let accepted=lease.isCurrent()
            if let capture=lease.starOrbitCapture,!capture.matches(source:source,destination:destination,generation:state.generation) {
                lease.rejected();return rejected("source_star_orbit_capture_mismatch")
            }
            guard accepted,sourceSpecialContactHook === hook,state==captured,flags==capturedFlags,locks==capturedLocks,
                  pendingMeterOpen==capturedOpen,pendingOrdinaryStack==capturedStack,pendingOrdinarySix==capturedSix,
                  pendingSpecial==nil,pendingDirectWild==nil else {
                lease.rejected();return rejected("source_special_claim_reentered")
            }
            starOrbitCapture=lease.starOrbitCapture
        }
        specialSequence &+= 1
        var plan = NativeDirectWildMovePlan(id:"native-direct:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,archetype:archetype,variant:source.variant ?? destination.variant,source:source,destination:destination,startedAt:now,isFinal:isFinal)
        plan.sourceEntryFinalSnapshot=sourceEntryFinalSnapshot
        plan.sourceStarOrbitCapture=starOrbitCapture
        wildSourceResolutionBoundary=nil;sourceWildCoroutineSettled=nil;sourceWildSpawnBeginReceipt=nil
        pendingDirectWild = plan; directWildGameplayCommitted = false;directWildVisualReleased=false;pendingWildLockedBonusPresentations=[];pendingWildSpawnPresentations=[]; directWildPointerID = pointerID
        locks[plan.id] = false; flags.pendingSpecialMutation = true; noMovesSignature = nil
        stageAccepted=true
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.directWildReserved,tileIDs:[source.id,destination.id],archetype:archetype,reason:plan.id,variant:plan.variant)],resolution:resolve())
    }
    /// Literal Source mainTween.onInterrupt BEFORE its main80 callback. This
    /// is destructive cancellation, never global/modal pause or fake completion.
    /// Scene retires only the matching native ghost/pull/cleanup/frame owners.
    public func cancelSourceMergeSixAbsorb(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation else{return rejected("stale_source_six_absorb_interrupt")}
        let source:NativeTile,destination:NativeTile,archetype:NativeWildArchetype?
        if let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,!ordinarySixGameplayCommitted {
            source=plan.source;destination=plan.destination;archetype=nil
            pendingOrdinarySix=nil;ordinarySixGameplayCommitted=false
        } else if let plan=pendingDirectWild,plan.id==receiptID,plan.generation==generation,!directWildGameplayCommitted {
            source=plan.source;destination=plan.destination;archetype=plan.archetype
            wildSourceResolutionBoundary=(plan.id,plan.generation)
            locks.removeValue(forKey:plan.id);flags.pendingSpecialMutation=false
            pendingDirectWild=nil;sourceDirectWildPrefix=nil;pendingSourceWildDestinationFace=nil;completedSourceWildDestinationFace=nil;directWildGameplayCommitted=false;directWildVisualReleased=false
        } else{return rejected("stale_source_six_absorb_interrupt")}
        // isWildMagnet is saved from BOTH captured Source identities, independently
        // of the selected dominant family (e.g. Magnet + TNT).
        if source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet {
            flags.wildMagnetPullInProgress=false
        }
        let captured=[source.id,destination.id]
        let removed=captured.filter{id in state.tiles.contains{$0.id==id}}
        state.tiles.removeAll{captured.contains($0.id)}
        noMovesSignature=nil
        var events=[NativeGameplayEvent(.mergeSixAbsorbInterrupted,tileIDs:captured,archetype:archetype,reason:receiptID)]
        if !removed.isEmpty {events.append(NativeGameplayEvent(.removed,tileIDs:removed,reason:"merge6-absorb-interrupted"))}
        // No debit/combo/score/RNG, new spawn, recovery timer, terminal dispatch,
        // forced arrival or background drain. Source release's Promise-based
        // meter continuation remains the captured Scene/queue adapter boundary.
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }

    /// Actual ordinary nonfinal wall1200 watchdog only. The Scene has already
    /// verified its exact live destination cleanup token and final flags.
    /// Keep the captured source/main transaction until its genuine callback;
    /// this removes only the destination and never invents an absorb arrival.
    public func removeSourceOrdinarySixWatchdogDestination(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,sourceMergeSixAutoCenterHook != nil,
              let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,
              !plan.isFinal,!ordinarySixGameplayCommitted,
              let index=state.tiles.firstIndex(where:{$0.id==plan.destination.id && $0.cell==plan.destination.cell}),
              state.tiles[index].value==6,!state.tiles[index].isWild,state.tiles[index].variant==nil else {
            return rejected("stale_source_six_destination_watchdog")
        }
        state.tiles.remove(at:index)
        if let detached=state.sourceDetachedGridTileIDs {
            let live=detached.intersection(Set(state.tiles.map(\.id)))
            state.sourceDetachedGridTileIDs=live.isEmpty ? nil:live
        }
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,
            events:[NativeGameplayEvent(.removed,tileIDs:[plan.destination.id],reason:"source-six-destination-watchdog")],resolution:resolve())
    }

    /// The same Source wall1200 destination owner survives the genuine main
    /// callback and a depleted-moves return. Remove only its exact retained
    /// ordinary six; caller/spawn/HUD/accounting ownership does not settle here.
    public func removeSourceCommittedOrdinarySixWatchdogDestination(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,sourceMergeSixAutoCenterHook != nil,
              let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,
              !plan.isFinal,ordinarySixGameplayCommitted,
              let index=state.tiles.firstIndex(where:{$0.id==plan.destination.id && $0.cell==plan.destination.cell}),
              state.tiles[index].value==6,state.tiles[index].merge6CleanupOwned,state.tiles[index].nonFinalMerge6,
              !state.tiles[index].isWild,state.tiles[index].variant==nil else {
            return rejected("stale_source_committed_six_destination_watchdog")
        }
        state.tiles.remove(at:index)
        if pendingOrdinaryDestinationCleanup?.id==plan.id {pendingOrdinaryDestinationCleanup=nil}
        if let detached=state.sourceDetachedGridTileIDs {
            let live=detached.intersection(Set(state.tiles.map(\.id)))
            state.sourceDetachedGridTileIDs=live.isEmpty ? nil:live
        }
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,
            events:[NativeGameplayEvent(.removed,tileIDs:[plan.destination.id],reason:"source-six-committed-destination-watchdog")],resolution:resolve())
    }

    /// Called by the actual captured Source prefix, after accepted reservation
    /// and before installing its main root. No debit, charge, spawn, RNG or cue.
    /// Receipt identity is the exact plan; duplicate or stale calls are rejected.
    public func prepareSourceDirectWildPrefix(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingDirectWild,plan.id==receiptID,
              plan.generation==generation,plan.revision==state.revision,!directWildGameplayCommitted,
              sourceDirectWildPrefix==nil,state.terminal==nil,
              state.tiles.first(where:{$0.id==plan.source.id})==plan.source,
              let index=state.tiles.firstIndex(where:{$0.id==plan.destination.id}),state.tiles[index]==plan.destination else{return rejected("source_direct_prefix_not_ready")}
        var prepared=plan.destination
        prepared.value=6;prepared.archetype=nil;prepared.sourceWildStateCleared=true;prepared.sourceResidualWildPresence=false
        if !prepared.locked {prepared.alpha=1}
        prepared.stackDepth=plan.isFinal ? 1:min(4,plan.source.stackDepth+plan.destination.stackDepth)
        // Final hide suppresses child artwork; Source parent visibility is
        // unchanged. setValue resets an unlocked parent alpha to one. The actual Node owner controls z/input/child suppression.
        state.tiles[index]=prepared
        sourceDirectWildPrefix=NativeSourceDirectWildPrefixReceipt(id:plan.id,generation:generation,revision:plan.revision,isFinal:plan.isFinal,originalDestination:plan.destination,preparedDestination:prepared)
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }

    /// Original first face callback can re-enter Wild rendering because actual
    /// construction remembered _ccWildSpecial. This captures that selected
    /// Direct destination; it never chooses a regular skin or draws RNG.
    public func prepareSourceWildDestinationFace(transactionID:String,generation:UInt64)->NativeSourceWildDestinationFaceReceipt? {
        guard generation==state.generation,let plan=pendingDirectWild,plan.id==transactionID,
              plan.generation==generation,plan.revision==state.revision,!directWildGameplayCommitted,
              let prefix=sourceDirectWildPrefix,prefix.id==plan.id,
              pendingSourceWildDestinationFace==nil,completedSourceWildDestinationFace==nil,
              let assetPath=NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:plan.destination),
              state.tiles.first(where:{$0.id==plan.destination.id})==prefix.preparedDestination else{return nil}
        var after=prefix.preparedDestination;after.stackDepth=1;after.sourceResidualWildPresence=true
        let receipt=NativeSourceWildDestinationFaceReceipt(id:plan.id+":wild-first-face",transactionID:plan.id,
            generation:generation,revision:plan.revision,originalDestination:plan.destination,
            beforeFace:prefix.preparedDestination,afterFace:after,assetPath:assetPath)
        pendingSourceWildDestinationFace=receipt;return receipt
    }
    /// Only the real first face RAF calls this. No timeout/main80 manufactures it.
    public func commitSourceWildDestinationFace(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let receipt=pendingSourceWildDestinationFace,receipt.id==receiptID,
              receipt.generation==generation,receipt.revision==state.revision,let plan=pendingDirectWild,
              plan.id==receipt.transactionID,!directWildGameplayCommitted,state.terminal==nil,
              sourceDirectWildPrefix?.id==plan.id,
              let index=state.tiles.firstIndex(where:{$0.id==receipt.beforeFace.id}),
              state.tiles[index]==receipt.beforeFace else{return rejected("source_wild_first_face_not_ready")}
        state.tiles[index]=receipt.afterFace;pendingSourceWildDestinationFace=nil;completedSourceWildDestinationFace=receipt
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }

    /// Called at the actual 80 ms absorb completion. Uses live earned HUD score, not a stale saved board.
    public func commitDirectWildGameplay(transactionID: String) -> NativeMoveResult {
        guard let plan = pendingDirectWild,plan.id == transactionID,plan.generation == state.generation,
              plan.revision == state.revision,state.terminal == nil,!directWildGameplayCommitted,
              state.tiles.first(where:{ $0.id == plan.source.id }) == plan.source,
              state.tiles.first(where:{ $0.id == plan.destination.id }) == (sourceDirectWildPrefix.map{sourceDirectWildLiveDestination($0)} ?? plan.destination),
              sourceDirectWildPrefix == nil || (sourceDirectWildPrefix?.id==plan.id && sourceDirectWildPrefix?.generation==state.generation && sourceDirectWildPrefix?.revision==plan.revision) else { return rejected("direct_wild_commit_not_ready") }
        let normalInitial = !usesSimpleArcadeWildSpawn(archetype:plan.archetype) && state.tiles.contains(where:{$0.locked})
        if !plan.isFinal,!flags.busyEnding,
           (normalInitial ? sourceDirectNormalPreSpawnGuardsEnabled || sourceDirectNormalLockedBonusGuardsEnabled:sourceWildEndgamePhysicalGuardsEnabled || sourceDirectEndgameLockedBonusGuardsEnabled) {
            guard sourceWildSpawnBegin != nil,sourceWildCoroutineResume != nil,
                  sourceFinalMergePresenceAuthority != nil,sourceMathRandom != nil else {
                return rejected("source_direct_normal_initial_dependencies_missing")
            }
            if normalInitial,sourceDirectNormalLockedBonusGuardsEnabled,sourceDirectLockedBonusGuardResume==nil {
                return rejected("source_direct_normal_outer_dependencies_missing")
            }
            if !normalInitial,!usesSimpleArcadeWildSpawn(archetype:plan.archetype),sourceDirectEndgameLockedBonusGuardsEnabled,
               !sourceWildEndgamePhysicalGuardsEnabled || sourceDirectLockedBonusGuardResume==nil {
                return rejected("source_direct_endgame_outer_dependencies_missing")
            }
        }
        // Original main80 callback returns before combo, score, move debit or RNG when
        // another terminal owner is active. Abort repairs captured identities only.
        if flags.busyEnding {
            wildSourceResolutionBoundary=(plan.id,plan.generation)
            let removed=[plan.destination.id,plan.source.id]
            state.tiles.removeAll { removed.contains($0.id) }
            locks.removeValue(forKey:plan.id); flags.pendingSpecialMutation=false
            pendingDirectWild=nil;sourceDirectWildPrefix=nil;pendingSourceWildDestinationFace=nil;completedSourceWildDestinationFace=nil;directWildGameplayCommitted=false;drag=nil
            let check=NativeWildRecoveryCheck(id:plan.id+":recovery",generation:plan.generation,delayMilliseconds:120,reason:"merge6-terminal-owner-active")
            pendingWildRecoveryChecks.append(check)
            return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:removed,reason:check.reason),NativeGameplayEvent(.wildRecoveryCheckPrepared,reason:check.id)],resolution:resolve())
        }
        locks.removeValue(forKey:plan.id); flags.pendingSpecialMutation = false
        committingDirectWild = true
        drag = Drag(id:plan.source.id,pointerID:directWildPointerID,generation:plan.generation,revision:plan.revision,origin:plan.source.cell)
        let result = drop(target:plan.destination.cell,pointerID:directWildPointerID,now:plan.startedAt + 0.08)
        committingDirectWild = false
        guard result.accepted else {
            if sourceDirectWildPrefix != nil {
                // A rejected revalidation cannot make a still-live prepared
                // object durable. Retain its captured cancellation authority.
                locks[plan.id]=false;flags.pendingSpecialMutation=true
                return NativeMoveResult(accepted:false,state:state,events:result.events,resolution:resolve())
            }
            pendingDirectWild = nil; return result
        }
        sourceDirectWildPrefix=nil;pendingSourceWildDestinationFace=nil;completedSourceWildDestinationFace=nil
        directWildGameplayCommitted = true
        // Star/Juice source visual gates restrict Wild/Special while ordinary input is released.
        locks[plan.id] = directWildSpawnPhase == nil
        return result
    }
    /// Consumes the actual generation-owned120ms callback; it never clears another terminal owner.
    public func commitWildRecoveryCheck(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let index=pendingWildRecoveryChecks.firstIndex(where:{$0.id==receiptID && $0.generation==generation}) else{return rejected("stale_wild_recovery_check")}
        pendingWildRecoveryChecks.remove(at:index)
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    public func releaseDirectWildPresentation(transactionID: String,generation: UInt64) -> NativeMoveResult {
        guard let plan = pendingDirectWild,plan.id == transactionID,plan.generation == generation,
              generation == state.generation,directWildGameplayCommitted,!directWildVisualReleased else { return rejected("direct_wild_release_not_ready") }
        directWildVisualReleased=true
        if pendingSourceLateFinalMerge?.ownerID==transactionID {pendingSourceLateFinalMerge=nil}
        if confirmedSourceLateFinalMerge?.ownerID==transactionID {confirmedSourceLateFinalMerge=nil}
        if directWildSpawnPhase == nil {locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false}
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }

    private func stageSpecialMove(source: NativeTile, destination: NativeTile, archetype: NativeWildArchetype, now: Double) -> NativeMoveResult {
        guard pendingSpecial == nil else { return rejected("special_transaction_in_progress") }
        if let specialPresentationAdmitted, !specialPresentationAdmitted(archetype,source.variant ?? destination.variant) { return rejected("native_special_presentation_not_ready") }
        if stagedTntActivation && (source.variant ?? destination.variant) == "laser-gun",
           laserTargetX == nil || laserViewportWidth == nil || !(laserViewportWidth!.isFinite && laserViewportWidth! > 0) { return rejected("native_laser_geometry_not_ready") }
        var capturedSpecialClaim:NativeSourceSpecialContactLease?
        if let hook=sourceSpecialContactHook {
            let captured=state,capturedFlags=flags,capturedLocks=locks
            let capturedOpen=pendingMeterOpen,capturedStack=pendingOrdinaryStack,capturedSix=pendingOrdinarySix
            guard state.tiles.first(where:{$0.id==source.id})==source,
                  state.tiles.first(where:{$0.id==destination.id})==destination else{return rejected("source_special_contact_changed")}
            guard let lease=hook.claim(source,destination,archetype) else{return rejected("source_special_claim_rejected")}
            let accepted=lease.isCurrent()
            if let capture=lease.starOrbitCapture,!capture.matches(source:source,destination:destination,generation:state.generation) {
                lease.rejected();return rejected("source_star_orbit_capture_mismatch")
            }
            guard accepted,sourceSpecialContactHook === hook,state==captured,flags==capturedFlags,locks==capturedLocks,
                  pendingMeterOpen==capturedOpen,pendingOrdinaryStack==capturedStack,pendingOrdinarySix==capturedSix,
                  pendingSpecial==nil,pendingDirectWild==nil else {
                lease.rejected();return rejected("source_special_claim_reentered")
            }
            capturedSpecialClaim=lease
        }
        var capturedMagnetTargets:[NativeTile]?
        if archetype == .magnet,let owner=sourceMagnetPullSelection {
            let captured=state,capturedFlags=flags,capturedLocks=locks
            let capturedOpen=pendingMeterOpen,capturedStack=pendingOrdinaryStack,capturedSix=pendingOrdinarySix,claimHook=sourceSpecialContactHook
            let candidates=magnetPullCandidates(captured.tiles,source:source,destination:destination)
            let ids=owner.capture(captured,source,destination,candidates)
            let alive=capturedSpecialClaim?.isCurrent() ?? true
            guard alive,sourceMagnetPullSelection === owner,sourceSpecialContactHook === claimHook,
                  state==captured,flags==capturedFlags,locks==capturedLocks,
                  pendingMeterOpen==capturedOpen,pendingOrdinaryStack==capturedStack,pendingOrdinarySix==capturedSix,
                  pendingSpecial==nil,pendingDirectWild==nil,let ids,
                  ids.count==candidates.count,Set(ids).count==ids.count,Set(ids)==Set(candidates.map(\.id)) else {
                capturedSpecialClaim?.rejected();return rejected("source_magnet_physical_target_capture_rejected")
            }
            let byID=Dictionary(uniqueKeysWithValues:candidates.map{($0.id,$0)})
            capturedMagnetTargets=ids.prefix(4).compactMap{byID[$0]}
        }
        pendingLaserShots = [];tntComboCoinReward = 0;tntCoinCounts.removeAll()
        expireCombo(now:now)
        let pre = state
        let hudStars = comboHUDCoinRewardsEnabled ? [] : captureHUDStars(source:source,destination:destination,starOrbitCapture:capturedSpecialClaim?.starOrbitCapture)
        var targets: [NativeTile]
        let variant = source.variant ?? destination.variant
        if archetype == .magnet {
            var eligible=state
            eligible.tiles=magnetPullCandidates(state.tiles,source:source,destination:destination)
            targets=capturedMagnetTargets ?? NativeMagnetRules.nearestPullTargets(state:eligible,source:source,destination:destination)
        }
        else if stagedTntActivation {targets=[]}
        else {
            guard let selected=selectTntTargets(source:source,destination:destination,variant:variant) else {
                capturedSpecialClaim?.rejected();return rejected("tnt_target_selection_obsolete")
            }
            targets=selected
        }
        let replacementValues = archetype == .tnt ? NativeTntRules.replacementValues(targets:targets,random:{ self.nextRandom() }) : []
        specialSequence &+= 1
        state.revision &+= 1
        var plan = NativeSpecialMovePlan(id:"native-special:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,archetype:archetype,variant:variant,source:source,destination:destination,targets:targets,replacementValues:replacementValues)
        plan.sourceStarOrbitCapture=capturedSpecialClaim?.starOrbitCapture
        specialPreBoard = pre; specialMoveTime = now; specialImpactIndex = 0; tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = archetype == .tnt && !stagedTntActivation
        state.tiles.removeAll { $0.id == source.id }
        if let index = state.tiles.firstIndex(where: { $0.id == destination.id }) {
            state.tiles[index].value = 6; state.tiles[index].archetype = nil; state.tiles[index].variant = nil
            state.tiles[index].resolutionOwned = true
            if ((sourceMagnetMain80Enabled && archetype == .magnet) || (sourceTntMain80Enabled && archetype == .tnt)) &&
                NativeSpecialDiceRegistry.finale(source:source,destination:destination,gameplay:true)==archetype {
                state.tiles[index].variant=destination.variant
                // Literal clearWildState/setValue6 keeps the original parent;
                // drawStack caps the actual physical result before main80.
                state.tiles[index].visible=destination.visible;state.tiles[index].alpha=1
                state.tiles[index].stackDepth=min(4,source.stackDepth+destination.stackDepth)
                state.tiles[index].sourceWildStateCleared=true
            } else {state.tiles[index].visible=false;state.tiles[index].alpha=0}
        }
        for target in targets { if let index = state.tiles.firstIndex(where: { $0.id == target.id }) {
            if archetype == .magnet { state.tiles[index].locked = true }; state.tiles[index].resolutionOwned = true
            state.tiles[index].magnetOwned = archetype == .magnet
        } }
        flags.pendingSpecialMutation = true; flags.wildMagnetPullInProgress = archetype == .magnet
        pendingSourceSpecialWildDestinationFace=nil;completedSourceSpecialWildDestinationFace=nil
        pendingSpecial = plan; noMovesSignature = nil
        var events: [NativeGameplayEvent] = []
        if !hudStars.isEmpty { events.append(NativeGameplayEvent(.hudStarsPrepared,tileIDs:hudStars.map(\.id),value:hudStars.count,archetype:source.isWild ? source.archetype : destination.archetype,variant:variant)) }
        events += [NativeGameplayEvent(.merged,tileIDs:[source.id,destination.id],value:6,archetype:NativeSpecialDiceRegistry.finale(source:source,destination:destination),variant:variant),NativeGameplayEvent(.specialReserved,tileIDs:targets.map(\.id),archetype:archetype,reason:plan.id,variant:variant)]
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:NativeResolution(.wait,reason:"special_gameplay_mutation_active"))
    }
    private func selectTntTargets(source: NativeTile,destination: NativeTile,variant: String?) -> [NativeTile]? {
        let candidates = NativeTntRules.eligibleTargets(state.tiles,excluding:[source.id,destination.id])
        // Barrel whole-board experiment: retain the existing ordinary-target
        // eligibility and transaction, but capture every eligible die once.
        if NativeSpecialDiceRegistry.usesBarrelFlow(variant) { return candidates }
        if variant == "beach-ball" || variant == "laser-gun" { return NativeTntRules.separatedTargets(candidates,count:4,random:{ self.nextRandom() }) }
        var captured=state
        let capturedFlags=flags,capturedLocks=locks
        guard let selected=NativeSourceTntTargetSort.select(candidateIDs:candidates.map(\.id),random:{
            let roll=self.nextRandom()
            // Raw deterministic RNG advances its own serialized state. The
            // external Source Math binding must preserve the entire board.
            if self.sourceMathRandom==nil {captured.rngState=self.state.rngState}
            return roll
        },
            current:{self.state==captured && self.flags==capturedFlags && self.locks==capturedLocks}) else{return nil}
        let byID=Dictionary(uniqueKeysWithValues:candidates.map{($0.id,$0)})
        return selected.compactMap{byID[$0]}
    }
    /// Source main merge callback after80ms absorb. Bonus targets are reserved later after blast return.
    public func commitSpecialActivation(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil,let plan = pendingSpecial,plan.id == transactionID,plan.generation == state.generation,plan.archetype == .tnt,!specialActivationCommitted else { return rejected("special_activation_not_ready") }
        if sourceTntMain80Enabled {
            guard pendingSourceSpecialAbsorb?.transactionID==plan.id,sourceSpecialAbsorbMainEntered else{return rejected("source_tnt_main80_not_entered")}
        }
        if pendingSourceSpecialAbsorb?.transactionID==plan.id {sourceSpecialAbsorbMainEntered=true}
        let previousCombo = state.combo
        state.combo = min(99,state.combo+1); state.longestCombo = max(state.longestCombo,state.combo)
        state.earnedComboBonus = min(999999,state.earnedComboBonus+max(0,NativeRewardMath.streakBonus(state.combo)-NativeRewardMath.streakBonus(previousCombo)))
        comboLastMutationTime = specialMoveTime+0.08; comboWindow = 4
        let visual = NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination)
        let multiplier = visual == .star || visual == .juice ? 2 : plan.source.stackDepth+plan.destination.stackDepth
        state.score = min(999999,state.score+6*multiplier*max(1,state.combo)); state.bestScore = max(state.bestScore,state.score)
        state.lastSpecialMergeWorld=NativeSpecialDiceRegistry.celebrationWorld(source:plan.source,destination:plan.destination) ?? state.lastSpecialMergeWorld
        state.moves = max(0,state.moves-1); state.cubesCracked += 1
        state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        var events = [NativeGameplayEvent(.comboChanged,value:state.combo)]
        state.tiles.removeAll { $0.id == plan.destination.id }
        if stagedTntWildSpawnAssignments {
            // Genuine main accounting cannot be replayed if later Source
            // spawn-owner acquisition refuses; captured abort owns recovery.
            specialActivationCommitted=true
            beginWildSpawnPhases(context:.tnt(plan),depth:multiplier,avoiding:plan.source.isWild ? plan.destination.value:plan.source.value,orbitCount:3,events:&events)
            if sourceTntSpawnBegin != nil,!sourceTntSpawnBeginAccepted {return rejected("source_tnt_spawn_begin_refused")}
        } else {
            spawnDirectWildMerge6(at:plan.destination.cell,archetype:plan.archetype,depth:multiplier,avoiding:plan.source.isWild ? plan.destination.value : plan.source.value,starOrbitCount:3,events:&events)
        }
        guard state.generation==plan.generation,pendingSpecial?.id==plan.id else{return rejected("stale_tnt_spawn_entry")}
        if comboHUDCoinRewardsEnabled {
            tntComboCoinReward=NativeComboCoinPolicy.count(combo:state.combo)
            if tntTargetsReserved {distributeTntCoins(plan:plan,events:&events)}
        }
        specialActivationCommitted = true
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Select current real targets only at the source return/bonus boundary, then freeze IDs and faces.
    public func reserveTntTargets(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil,let initial = pendingSpecial,initial.id == transactionID,initial.generation == state.generation,initial.archetype == .tnt,specialActivationCommitted,!tntTargetsReserved else { return rejected("tnt_target_reservation_not_ready") }
        guard var targets = selectTntTargets(source:initial.source,destination:initial.destination,variant:initial.variant),
              pendingSpecial?.id==initial.id,pendingSpecial?.generation==initial.generation,
              specialActivationCommitted,!tntTargetsReserved else{return rejected("tnt_target_selection_obsolete")}
        if initial.variant == "laser-gun",let x = laserTargetX,let width = laserViewportWidth {
            pendingLaserShots = NativeLaserGunRules.plan(targets:targets,viewportWidth:width,x:x,random:{self.nextRandom()})
            let byID = Dictionary(uniqueKeysWithValues:targets.map{($0.id,$0)})
            targets = pendingLaserShots.compactMap{byID[$0.tileID]}
        }
        let values = sourceTntBonusValuesAtImpact && initial.variant==nil ? []:
            NativeTntRules.replacementValues(targets:targets,random:{ self.nextRandom() })
        var plan = NativeSpecialMovePlan(id:initial.id,generation:initial.generation,revision:initial.revision,archetype:initial.archetype,variant:initial.variant,source:initial.source,destination:initial.destination,targets:targets,replacementValues:values)
        plan.sourceStarOrbitCapture=initial.sourceStarOrbitCapture
        pendingSpecial = plan; tntTargetsReserved = true
        for tile in targets { if let index = state.tiles.firstIndex(where: { $0.id == tile.id }) { state.tiles[index].resolutionOwned = true } }
        var events=[NativeGameplayEvent(.specialReserved,tileIDs:targets.map(\.id),archetype:.tnt,reason:plan.id,variant:plan.variant)]
        if comboHUDCoinRewardsEnabled {
            distributeTntCoins(plan:plan,events:&events)
        }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    private func distributeTntCoins(plan:NativeSpecialMovePlan,events:inout [NativeGameplayEvent]) {
        tntCoinCounts.removeAll()
        guard !plan.targets.isEmpty else {
            let coins=prepareHUDStars(count:tntComboCoinReward,origin:plan.destination.cell,variant:plan.variant,archetype:plan.archetype)
            if !coins.isEmpty {events.append(NativeGameplayEvent(.hudStarsPrepared,tileIDs:coins.map(\.id),value:coins.count,archetype:.tnt,variant:plan.variant))}
            return
        }
        let total=max(tntComboCoinReward,plan.targets.count),base=total/plan.targets.count
        var ids=plan.targets.map(\.id),seed=state.rngState ^ UInt64(state.combo) ^ plan.generation
        // Private reward-placement shuffle never consumes board/value randomness.
        for i in stride(from:ids.count-1,through:1,by:-1) {
            seed=seed &* 6364136223846793005 &+ 1442695040888963407
            ids.swapAt(i,Int((seed >> 32)%UInt64(i+1)))
        }
        for (index,id) in ids.enumerated() {tntCoinCounts[id]=base+(index<total%ids.count ? 1:0)}
    }
    /// Commit a captured TNT target in source order. No callback may select a new target or face.
    public func commitSpecialImpact(transactionID: String, tileID: String) -> NativeMoveResult {
        guard state.terminal == nil,var plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, plan.archetype == .tnt,tntTargetsReserved,
              specialImpactIndex < plan.targets.count, plan.targets[specialImpactIndex].id == tileID,
              let index = state.tiles.firstIndex(where: { $0.id == tileID }), state.tiles[index].resolutionOwned else { return rejected("stale_or_unowned_special_impact") }
        let target = plan.targets[specialImpactIndex]
        if sourceTntBonusValuesAtImpact,plan.variant==nil {
            guard sourceTntMain80Enabled,let math=sourceMathRandom,plan.replacementValues.count==specialImpactIndex else{return rejected("source_tnt_bonus_value_not_ready")}
            let captured=state,capturedFlags=flags,capturedLocks=locks,impact=specialImpactIndex,original=plan
            var validDraw=false
            let value=NativeTntRules.replacementValue(oldValue:target.value,used:plan.replacementValues,random:{
                let roll=self.nextRandom();validDraw=roll.isFinite && roll>=0 && roll<1;return roll
            })
            guard validDraw,state==captured,flags==capturedFlags,locks==capturedLocks,pendingSpecial==original,
                specialImpactIndex==impact,sourceTntMain80Enabled,sourceTntBonusValuesAtImpact,sourceMathRandom === math else{return rejected("source_tnt_bonus_value_obsolete")}
            plan=NativeSpecialMovePlan(id:original.id,generation:original.generation,revision:original.revision,
                archetype:original.archetype,variant:original.variant,source:original.source,destination:original.destination,
                targets:original.targets,replacementValues:original.replacementValues+[value])
            plan.sourceStarOrbitCapture=original.sourceStarOrbitCapture;pendingSpecial=plan
        }
        guard plan.replacementValues.indices.contains(specialImpactIndex) else{return rejected("special_impact_value_not_captured")}
        let value = plan.replacementValues[specialImpactIndex]
        let replacement: NativeTile
        if plan.variant == "laser-gun" { replacement = NativeTile(id:target.id,cell:target.cell,value:value) }
        else { replacement = freshTile(cell:target.cell,value:value) }
        state.tiles[index] = replacement
        let impactIndex = specialImpactIndex
        var meterEvents: [NativeGameplayEvent] = []
        if impactIndex < 2 {
            state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:0.05,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        } else {
            let receipt = NativeMeterRewardReceipt(id:"\(plan.id):meter:\(impactIndex)",generation:state.generation,transactionID:plan.id,impactIndex:impactIndex,base:0.05,delay:0.4+Double(impactIndex-2)*0.1)
            pendingMeterRewards.append(receipt)
            meterEvents.append(NativeGameplayEvent(.meterRewardPrepared,tileIDs:[receipt.id],value:impactIndex,archetype:.tnt,reason:plan.id,variant:plan.variant))
        }
        specialImpactIndex += 1
        let stars = prepareHUDStars(count:comboHUDCoinRewardsEnabled ? (tntCoinCounts.removeValue(forKey:target.id) ?? 1):1,origin:target.cell,variant:plan.variant,archetype:.tnt)
        let impactedIDs = replacement.id == tileID ? [tileID] : [tileID,replacement.id]
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.specialImpact,tileIDs:impactedIDs,value:value,archetype:.tnt,reason:plan.id,variant:plan.variant),NativeGameplayEvent(.hudStarsPrepared,tileIDs:stars.map(\.id),value:stars.count,archetype:.tnt,variant:plan.variant)]+meterEvents,resolution:NativeResolution(.wait,reason:"special_gameplay_mutation_active"))
    }
    // PRIVATE normal source-only route. No eager/Raw entry can consume a lazy
    // continuation and no renderer chooses or writes its logical cells/values.
    public func prepareSourceMagnetLazyRespawn(transactionID:String,generation:UInt64,
        sourceCurrent:()->Bool)->NativeMoveResult {
        guard let operation=beginSourceMagnetLazyOperation() else{return rejected("source_magnet_lazy_operation_reentrant")}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyRespawnEnabled,sourceMathRandom != nil,state.terminal==nil,
              let special=pendingSpecial,special.id==transactionID,special.generation==generation,
              state.generation==generation,special.revision==state.revision,special.archetype == .magnet,
              NativeSpecialDiceRegistry.finale(source:special.source,destination:special.destination,gameplay:true) == .magnet,
              sourceSpecialAbsorbMainEntered,!special.targets.isEmpty,
              pendingMagnetRespawn==nil,pendingSourceMagnetLazyRespawn==nil else{return rejected("source_magnet_lazy_respawn_not_ready")}
        let before=state
        func validBefore()->Bool {
            guard state==before,pendingSpecial==special,pendingSourceMagnetLazyRespawn==nil else{return false}
            let accepted=sourceCurrent()
            return accepted && sourceMagnetLazyRespawnEnabled && state==before && pendingSpecial==special && pendingSourceMagnetLazyRespawn==nil
        }
        guard validBefore(),let destinationIndex=state.tiles.firstIndex(where:{$0.id==special.destination.id && $0.value==6}) else{return rejected("source_magnet_lazy_scope_not_current")}
        // PWA app-merge hides the consumed six at the second impact, while
        // keeping this exact grid cell reserved until survivor conversion.
        state.tiles[destinationIndex].visible=false;state.tiles[destinationIndex].alpha=0
        let owned=Set(special.targets.map(\.id));state.tiles.removeAll{owned.contains($0.id)}
        let captured=state
        func valid()->Bool {
            guard state==captured,pendingSpecial==special,pendingSourceMagnetLazyRespawn==nil else{return false}
            let accepted=sourceCurrent()
            return accepted && sourceMagnetLazyRespawnEnabled && state==captured && pendingSpecial==special && pendingSourceMagnetLazyRespawn==nil
        }
        var refused=false
        func draw()->Double {
            guard valid(),!refused else{refused=true;return 0}
            let roll=nextRandom()
            guard valid(),roll.isFinite,roll>=0,roll<1 else{refused=true;return 0}
            return roll
        }
        func find(_ count:Int)->[NativeCell] {
            var empties=NativeMagnetRules.emptyCells(state:captured)
            if empties.count>1 {for index in stride(from:empties.count-1,through:1,by:-1) {
                let roll=draw();if refused{return []};empties.swapAt(index,Int(floor(roll*Double(index+1))))
            }}
            return Array(empties.prefix(count)) // Source slices BEFORE exclusions.
        }
        let count=special.targets.count,excluded=Set(special.targets.map(\.cell)+[special.destination.cell])
        let first=find(count+6).filter{!excluded.contains($0)}
        let cells=Array(first.prefix(count));var reserved=Array(first.dropFirst(count).prefix(6))
        // This component requires the literal normal all-target branch. The
        // source shortage retry/catch owns a separate real continuation; none
        // is manufactured here or borrowed from Raw's eager transaction.
        guard !refused,valid(),cells.count==count else{return rejected("source_magnet_target_shortage_continuation_not_bound")}
        if reserved.count<6 {
            let extras=find(12);var used=Set(reserved);let opens=Set(cells)
            for cell in extras {
                if reserved.count>=6{break}
                if excluded.contains(cell) || used.contains(cell) || opens.contains(cell){continue}
                reserved.append(cell);used.insert(cell)
            }
        }
        guard !refused,valid() else{return rejected("source_magnet_lazy_draw_retired")}
        let values=NativeMagnetRules.forcedReplacementValues(count:count,random:draw)
        guard !refused,valid(),values.count==count else{return rejected("source_magnet_lazy_values_retired")}
        let slots=zip(cells,values).enumerated().map{NativeSourceMagnetLazySlot(index:$0.offset,cell:$0.element.0,forcedValue:$0.element.1)}
        pendingSourceMagnetLazyRespawn = .init(transactionID:transactionID,generation:generation,revision:special.revision,
            slots:slots,reserved:reserved,destinationID:special.destination.id,avoiding:special.destination.value)
        sourceMagnetLazyOpens=[:];sourceMagnetLazyValueCommits=[];sourceMagnetLazySettled=[];sourceMagnetLazyReserveFill=nil;sourceMagnetLazyReserveCommits=[];sourceMagnetLazyConversion=nil;sourceMagnetLazyConversionCommitted=false;sourceMagnetLazyResolutionReleased=false
        let pulledStar=special.targets.first{$0.gameplayArchetype == .star && NativeStarDropCountPolicy.usesRandomCount(variant:$0.variant)}
        let rewardCount=comboHUDCoinRewardsEnabled ? NativeComboCoinPolicy.count(combo:(specialPreBoard?.combo ?? state.combo)+1+count) : min(3,max(0,pulledStar.map{$0.effectiveStarDropCount} ?? 0)+count)
        let stars=prepareHUDStars(count:rewardCount,origin:special.destination.cell,variant:nil,archetype:.magnet)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:special.targets.map(\.id),archetype:.magnet,reason:transactionID),NativeGameplayEvent(.hudStarsPrepared,tileIDs:stars.map(\.id),value:stars.count,archetype:.magnet)],resolution:NativeResolution(.wait,reason:"source_magnet_lazy_respawn_pending"))
    }
    private func sourceMagnetLazyCurrent(_ transactionID:String,_ generation:UInt64,sourceCurrent:()->Bool)->Bool {
        guard sourceMagnetLazyRespawnEnabled,state.generation==generation,state.terminal==nil,
              let plan=pendingSourceMagnetLazyRespawn,plan.transactionID==transactionID,plan.generation==generation,
              pendingSpecial?.id==transactionID,pendingSpecial?.generation==generation,pendingSpecial?.revision==state.revision else{return false}
        let captured=state,accepted=sourceCurrent()
        return accepted && sourceMagnetLazyRespawnEnabled && state==captured && pendingSourceMagnetLazyRespawn==plan && pendingSpecial?.id==transactionID
    }
    /// forceFreshPlaceholder is an actual per-open action, before constructor
    /// rotation/raw RAF. It makes NO value/skin/bounce draw at preparation time.
    public func beginSourceMagnetLazyOpen(transactionID:String,generation:UInt64,index:Int,
        sourceCurrent:()->Bool)->NativeSourceMagnetLazyOpen? {
        guard let operation=beginSourceMagnetLazyOperation() else{return nil}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent),
              let plan=pendingSourceMagnetLazyRespawn,plan.slots.indices.contains(index),sourceMagnetLazyOpens[index]==nil else{return nil}
        let slot=plan.slots[index],existing=state.tile(at:slot.cell)
        let skipped=existing.map{$0.value>0 || $0.isWild || !$0.locked} ?? false
        var holder:NativeTile?,removed:String?
        if !skipped {
            if let existing {removed=existing.id;state.tiles.removeAll{$0.id==existing.id}}
            var fresh=freshTile(cell:slot.cell,value:0);fresh.locked=true;fresh.alpha=0.20
            holder=fresh;state.tiles.append(fresh)
        }
        let open=NativeSourceMagnetLazyOpen(id:"\(transactionID):source-open:\(index)",transactionID:transactionID,
            generation:generation,slot:slot,holder:holder,removedHolderID:removed,skipped:skipped)
        sourceMagnetLazyOpens[index]=open;return open
    }
    public func commitSourceMagnetLazyOpenValue(openID:String,generation:UInt64,sourceCurrent:()->Bool)->NativeMoveResult {
        guard let operation=beginSourceMagnetLazyOperation() else{return rejected("source_magnet_lazy_operation_reentrant")}
        defer{endSourceMagnetLazyOperation(operation)}
        guard let open=sourceMagnetLazyOpens.values.first(where:{$0.id==openID}),!open.skipped,
              let holder=open.holder,!sourceMagnetLazyValueCommits.contains(open.slot.index),
              sourceMagnetLazyCurrent(open.transactionID,generation,sourceCurrent:sourceCurrent),
              let index=state.tiles.firstIndex(where:{$0.id==holder.id && $0.cell==holder.cell && $0.locked && $0.value==0}) else{return rejected("source_magnet_lazy_open_value_not_owned")}
        var tile=state.tiles[index];tile.value=open.slot.forcedValue;tile.locked=false;tile.alpha=1;tile.visible=true
        state.tiles[index]=tile;sourceMagnetLazyValueCommits.insert(open.slot.index)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:tile.value,archetype:.magnet,reason:open.transactionID)],resolution:NativeResolution(.wait,reason:"source_magnet_lazy_replacement_assigned"))
    }
    /// Called ONLY by the real openAtCell Promise → wall50 verification. This
    /// preserves skipped/failed slots for the source shortage continuation.
    public func finishSourceMagnetLazyOpen(openID:String,generation:UInt64,verifiedTileID:String?,sourceCurrent:()->Bool)->Bool {
        guard let operation=beginSourceMagnetLazyOperation() else{return false}
        defer{endSourceMagnetLazyOperation(operation)}
        guard let open=sourceMagnetLazyOpens.values.first(where:{$0.id==openID}),
              sourceMagnetLazyCurrent(open.transactionID,generation,sourceCurrent:sourceCurrent),!sourceMagnetLazySettled.contains(open.slot.index) else{return false}
        guard !open.skipped,sourceMagnetLazyValueCommits.contains(open.slot.index),let holder=open.holder,verifiedTileID==holder.id,
              let tile=state.tile(at:open.slot.cell),tile.id==holder.id,!tile.locked,tile.value>0 else{return false}
        sourceMagnetLazySettled.insert(open.slot.index);return true
    }
    /// First literal fill runs after Promise.all and BEFORE survivor value.
    /// An empty reserved list means all null cells row-major, not no fill.
    public func prepareSourceMagnetLazyReserveFill(transactionID:String,generation:UInt64,sourceCurrent:()->Bool)->NativeSourceMagnetReserveFill? {
        guard let operation=beginSourceMagnetLazyOperation() else{return nil}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent),let plan=pendingSourceMagnetLazyRespawn,
              sourceMagnetLazySettled.count==plan.slots.count,sourceMagnetLazyReserveFill==nil else{return nil}
        let cells=plan.reserved.isEmpty ? (0..<state.rows).flatMap{row in (0..<state.columns).map{NativeCell(column:$0,row:row)}}:plan.reserved
        let holders=cells.compactMap{cell->NativeTile? in
            guard state.tile(at:cell)==nil else{return nil};var tile=freshTile(cell:cell,value:0);tile.locked=true;tile.alpha=0.20;return tile
        }
        let fill=NativeSourceMagnetReserveFill(transactionID:transactionID,generation:generation,holders:holders)
        sourceMagnetLazyReserveFill=fill;return fill
    }
    public func commitSourceMagnetLazyReserve(transactionID:String,generation:UInt64,index:Int,sourceCurrent:()->Bool)->NativeMoveResult {
        guard let operation=beginSourceMagnetLazyOperation() else{return rejected("source_magnet_lazy_operation_reentrant")}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent),let fill=sourceMagnetLazyReserveFill,
              fill.holders.indices.contains(index),!sourceMagnetLazyReserveCommits.contains(index) else{return rejected("source_magnet_lazy_reserve_not_owned")}
        let tile=fill.holders[index]
        guard state.tile(at:tile.cell)==nil else{return rejected("source_magnet_lazy_reserve_cell_replaced")}
        state.tiles.append(tile);sourceMagnetLazyReserveCommits.insert(index)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:0,archetype:.magnet,reason:transactionID)],resolution:NativeResolution(.wait,reason:"source_magnet_lazy_reserve_constructed"))
    }
    /// At actual conversion after all real reserved constructor draws. The
    /// SAME Core destination ID is retained; no value is selected in prepare.
    public func prepareSourceMagnetLazySurvivor(transactionID:String,generation:UInt64,sourceCurrent:()->Bool)->NativeSourceMagnetSurvivorConversion? {
        guard let operation=beginSourceMagnetLazyOperation() else{return nil}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent),let plan=pendingSourceMagnetLazyRespawn,
              let fill=sourceMagnetLazyReserveFill,sourceMagnetLazyReserveCommits.count==fill.holders.count,
              sourceMagnetLazyConversion==nil,let destination=state.tiles.first(where:{$0.id==plan.destinationID}),destination.value==6 else{return nil}
        let value=randomValue(excluding:plan.avoiding)
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent) else{return nil}
        let survivor=NativeTile(id:destination.id,cell:destination.cell,value:value)
        let conversion=NativeSourceMagnetSurvivorConversion(transactionID:transactionID,generation:generation,survivor:survivor)
        sourceMagnetLazyConversion=conversion;return conversion
    }
    /// Before genuine Node setValue, clear special state and assign the same
    /// object. Its resolution claim stays held until setValue has returned.
    public func commitSourceMagnetLazySurvivorValue(transactionID:String,generation:UInt64,sourceCurrent:()->Bool)->NativeMoveResult {
        guard let operation=beginSourceMagnetLazyOperation() else{return rejected("source_magnet_lazy_operation_reentrant")}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent),let conversion=sourceMagnetLazyConversion,
              !sourceMagnetLazyConversionCommitted,let index=state.tiles.firstIndex(where:{$0.id==conversion.survivor.id && $0.value==6}) else{return rejected("source_magnet_lazy_survivor_not_owned")}
        var survivor=conversion.survivor;survivor.resolutionOwned=true
        state.tiles[index]=survivor;sourceMagnetLazyConversionCommitted=true
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[survivor.id],value:survivor.value,archetype:.magnet,reason:transactionID)],resolution:NativeResolution(.wait,reason:"source_magnet_lazy_survivor_value_assigned"))
    }
    public func releaseSourceMagnetLazySurvivorResolution(transactionID:String,generation:UInt64,sourceCurrent:()->Bool)->Bool {
        guard let operation=beginSourceMagnetLazyOperation() else{return false}
        defer{endSourceMagnetLazyOperation(operation)}
        guard sourceMagnetLazyCurrent(transactionID,generation,sourceCurrent:sourceCurrent),let conversion=sourceMagnetLazyConversion,
              sourceMagnetLazyConversionCommitted,!sourceMagnetLazyResolutionReleased,
              let index=state.tiles.firstIndex(where:{$0.id==conversion.survivor.id && $0.value==conversion.survivor.value}) else{return false}
        state.tiles[index].resolutionOwned=false;sourceMagnetLazyResolutionReleased=true;return true
    }
    private func beginSourceMagnetLazyOperation()->UInt64? {
        guard sourceMagnetLazyOperation==nil else{return nil}
        sourceMagnetLazyOperationSequence &+= 1;let token=sourceMagnetLazyOperationSequence
        sourceMagnetLazyOperation=token;return token
    }
    private func endSourceMagnetLazyOperation(_ token:UInt64){
        if sourceMagnetLazyOperation==token{sourceMagnetLazyOperation=nil}
    }
    private func retireSourceMagnetLazyState(){
        sourceMagnetLazyOperation=nil
        pendingSourceMagnetLazyRespawn=nil;sourceMagnetLazyOpens=[:];sourceMagnetLazyValueCommits=[];sourceMagnetLazySettled=[]
        sourceMagnetLazyReserveFill=nil;sourceMagnetLazyReserveCommits=[];sourceMagnetLazyConversion=nil;sourceMagnetLazyConversionCommitted=false;sourceMagnetLazyResolutionReleased=false
    }

    /// Source pull convergence removes consumed IDs before the 50ms respawn pause.
    public func prepareMagnetRespawn(transactionID: String) -> NativeMoveResult {
        guard !sourceMagnetLazyRespawnEnabled,pendingSourceMagnetLazyRespawn==nil else{return rejected("source_magnet_lazy_callback_required")}
        guard let plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, plan.revision == state.revision,
              plan.archetype == .magnet, !plan.targets.isEmpty, pendingMagnetRespawn == nil else { return rejected("magnet_respawn_not_ready") }
        let before = state; let choices = randomChoices
        let ownedIDs = Set(plan.targets.map(\.id))
        state.tiles.removeAll { ownedIDs.contains($0.id) }
        let excluded = Set(plan.targets.map(\.cell)+[plan.destination.cell])
        var available = NativeMagnetRules.emptyCells(state:state)
        if available.count > 1 { for index in stride(from:available.count-1,through:1,by:-1) { available.swapAt(index,min(index,Int(nextRandom()*Double(index+1)))) } }
        let filtered = available.filter { !excluded.contains($0) }
        guard filtered.count >= plan.targets.count else { state = before; randomChoices = choices; return rejected("magnet_replacement_cells_unavailable") }
        let spawnCells = Array(filtered.prefix(plan.targets.count))
        let reserved = Array(filtered.dropFirst(plan.targets.count).prefix(6))
        let values = NativeMagnetRules.forcedReplacementValues(count:plan.targets.count,random:{ self.nextRandom() })
        let replacements = zip(spawnCells,values).map { freshTile(cell:$0.0,value:$0.1) }
        let avoiding = plan.source.isWild ? plan.destination.value : plan.source.value
        let survivor = freshTile(cell:plan.destination.cell,value:randomValue(excluding:avoiding))
        let placeholders = reserved.compactMap { cell -> NativeTile? in
            guard state.tile(at:cell) == nil else { return nil }
            var tile = freshTile(cell:cell,value:0); tile.id += ":locked"; tile.locked = true; tile.alpha = 0.20; return tile
        }
        pendingMagnetRespawn = NativeMagnetRespawnPlan(transactionID:plan.id,replacements:replacements,survivor:survivor,placeholders:placeholders)
        magnetReplacementIndex = 0
        if sourceMagnetFallbacksEnabled {
            sourceMagnetPostCommit = .init(transactionID:plan.id,generation:plan.generation,spawnCount:plan.targets.count,reserved:reserved)
        }
        let pulledCoreStar = plan.targets.first { $0.gameplayArchetype == .star && NativeStarDropCountPolicy.usesRandomCount(variant:$0.variant) }
        let orbitCount = pulledCoreStar.map { $0.effectiveStarDropCount } ?? 0
        let rewardCount=comboHUDCoinRewardsEnabled ? NativeComboCoinPolicy.count(combo:(specialPreBoard?.combo ?? state.combo)+1+plan.targets.count) : min(3,orbitCount+plan.targets.count)
        let stars = prepareHUDStars(count:rewardCount,origin:plan.destination.cell,variant:plan.variant,archetype:plan.archetype)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:plan.targets.map(\.id),archetype:.magnet,reason:plan.id,variant:plan.variant),NativeGameplayEvent(.hudStarsPrepared,tileIDs:stars.map(\.id),value:stars.count,archetype:.magnet,variant:plan.variant)],resolution:NativeResolution(.wait,reason:"magnet_respawn_pending"))
    }
    /// The native cascade invokes this at each authored 0/150/300/450ms open boundary.
    public func commitMagnetReplacement(transactionID: String, index: Int) -> NativeMoveResult {
        guard let plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, plan.revision == state.revision,
              let respawn = pendingMagnetRespawn, respawn.transactionID == transactionID, index == magnetReplacementIndex,
              respawn.replacements.indices.contains(index) else { return rejected("stale_or_unowned_magnet_replacement") }
        let tile = respawn.replacements[index]
        state.removeSourceGridOwner(at:tile.cell); state.tiles.append(tile); magnetReplacementIndex += 1
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:tile.value,archetype:.magnet,reason:plan.id,variant:plan.variant)],resolution:NativeResolution(.wait,reason:"magnet_replacement_cascade_active"))
    }

    /// Finish one immutable Special transaction; release gameplay before its decorative tail.
    public func commitSpecialBoard(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil,let plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, (plan.archetype == .tnt || plan.revision == state.revision),
              let pre = specialPreBoard, plan.archetype != .tnt || tntTargetsReserved && specialImpactIndex == plan.targets.count else { return rejected("special_board_commit_not_ready") }
        var events: [NativeGameplayEvent] = []
        if plan.archetype == .magnet && pendingSourceMagnetLazyRespawn != nil && !sourceMagnetLazyRespawnEnabled {return rejected("source_magnet_lazy_retired_continuation")}
        if plan.archetype == .magnet && sourceMagnetLazyRespawnEnabled && !plan.targets.isEmpty {
            guard sourceMagnetLazyOperation==nil,let lazy=pendingSourceMagnetLazyRespawn,lazy.transactionID==plan.id,
                  let conversion=sourceMagnetLazyConversion,sourceMagnetLazyResolutionReleased,
                  let fill=sourceMagnetLazyReserveFill,sourceMagnetLazySettled.count==lazy.slots.count,
                  sourceMagnetLazyReserveCommits.count==fill.holders.count else{return rejected("source_magnet_lazy_board_not_ready")}
            let replacements=lazy.slots.compactMap{slot in sourceMagnetLazyOpens[slot.index]?.holder.flatMap{holder in state.tiles.first{$0.id==holder.id}}}
            guard replacements.count==lazy.slots.count else{return rejected("source_magnet_lazy_replacement_identity_missing")}
            pendingMagnetRespawn=NativeMagnetRespawnPlan(transactionID:plan.id,replacements:replacements,survivor:conversion.survivor,placeholders:fill.holders)
            magnetReplacementIndex=replacements.count
        }
        if plan.archetype == .tnt && !specialActivationCommitted {
            let activation = commitSpecialActivation(transactionID:plan.id)
            guard activation.accepted else { return activation }; events += activation.events
        }
        let oldCombo = pre.combo
        let avoiding = plan.source.isWild ? plan.destination.value : plan.source.value
        if plan.archetype == .magnet && !plan.targets.isEmpty {
            if pendingMagnetRespawn == nil {
                let prepared = prepareMagnetRespawn(transactionID:plan.id)
                guard prepared.accepted else { return prepared }
                events += prepared.events
                // Background settling and older pure callers may consume all captured phases synchronously.
                while let respawn = pendingMagnetRespawn, magnetReplacementIndex < respawn.replacements.count {
                    events += commitMagnetReplacement(transactionID:plan.id,index:magnetReplacementIndex).events
                }
            }
            guard let respawn = pendingMagnetRespawn, magnetReplacementIndex == respawn.replacements.count else { return rejected("magnet_replacements_not_settled") }
            let ownedIDs = Set(plan.targets.map(\.id))
            // Source uses an explicit 4x pull crack, independent of the one-to-four pull count.
            state.score = min(999999,state.score+24); state.cubesCracked = pre.cubesCracked+2
            state.combo = min(99,oldCombo+1+plan.targets.count)
            if sourceMagnetLazyRespawnEnabled {
                guard let index=state.tiles.firstIndex(where:{$0.id==plan.destination.id}),respawn.survivor.id==plan.destination.id else{return rejected("source_magnet_lazy_destination_identity_missing")}
                state.tiles[index]=respawn.survivor
            } else {
                state.tiles.removeAll { $0.id == plan.destination.id }
                state.tiles.append(respawn.survivor)
            }
            if !sourceMagnetLazyRespawnEnabled {events.append(NativeGameplayEvent(.spawned,tileIDs:[respawn.survivor.id],value:respawn.survivor.value))}
            for tile in respawn.placeholders where state.tile(at:tile.cell) == nil {
                state.tiles.append(tile); events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:0))
            }
            let holder = NativeTile(id:plan.destination.id,cell:plan.destination.cell,value:6)
            let unpulled = pre.activeTiles.filter { $0.id != plan.source.id && $0.id != plan.destination.id && !ownedIDs.contains($0.id) }
            let progress = NativeMagnetRules.pullProgress(activeBeforePull:[holder]+unpulled,mergeTile:holder,pulledCount:plan.targets.count)
            if progress.addProgress { state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true) }
            else if progress.isLastMergeBeforePull { resetMeterAfterRound() }
        } else if plan.archetype != .tnt {
            state.tiles.removeAll { $0.id == plan.destination.id }
            if plan.archetype != .tnt { state.combo = min(99,oldCombo+1) }; state.cubesCracked += 1
            let visualFx = NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination)
            let multiplier = plan.archetype == .magnet || visualFx == .star || visualFx == .juice ? 2 : plan.source.stackDepth+plan.destination.stackDepth
            state.score = min(999999,state.score+6*multiplier*max(1,state.combo))
            spawnDirectWildMerge6(at:plan.destination.cell,archetype:plan.archetype,depth:multiplier,avoiding:avoiding,starOrbitCount:3,events:&events)
            state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        }
        if plan.archetype == .magnet,!sourceSpecialAbsorbMainEntered {
            state.lastSpecialMergeWorld=NativeSpecialDiceRegistry.celebrationWorld(source:plan.source,destination:plan.destination) ?? state.lastSpecialMergeWorld
        }
        if plan.archetype != .tnt { state.moves = max(0,state.moves-1) }
        state.longestCombo = max(state.longestCombo,state.combo)
        if plan.archetype != .tnt { state.earnedComboBonus = min(999999,state.earnedComboBonus+max(0,NativeRewardMath.streakBonus(state.combo)-NativeRewardMath.streakBonus(oldCombo))) }
        state.bestScore = max(state.bestScore,state.score)
        if plan.archetype != .tnt { comboLastMutationTime = specialMoveTime; comboWindow = 4 }
        flags.pendingSpecialMutation = false; flags.wildMagnetPullInProgress = false
        pendingSpecial = nil; pendingLaserShots = []; pendingMagnetRespawn = nil; magnetReplacementIndex = 0; specialPreBoard = nil; tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = false
        pendingSourceSpecialAbsorb=nil;sourceSpecialAbsorbMainEntered=false
        pendingSourceSpecialWildDestinationFace=nil;completedSourceSpecialWildDestinationFace=nil
        if sourceMagnetLazyRespawnEnabled {
            if sourceMagnetFallbacksEnabled,let lazy=pendingSourceMagnetLazyRespawn {sourceMagnetPostCommit = .init(transactionID:plan.id,generation:plan.generation,spawnCount:lazy.slots.count,reserved:lazy.reserved)}
            retireSourceMagnetLazyState()
        }
        events.append(NativeGameplayEvent(.comboChanged,value:state.combo))
        events.append(NativeGameplayEvent(.specialBoardCommitted,archetype:plan.archetype,reason:plan.id,variant:plan.variant))
        if state.wildMeter >= 1-0.000001 && rewardPicker != nil { _ = spawnMeterReward(events:&events) }
        let resolution = settleDeferredFinalMerge(events:&events)
        if resolution.kind == .fail { noMovesSignature = state.signature; events.append(NativeGameplayEvent(.noMovesCandidate,reason:resolution.reason)) }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }

    /// Literal random-empty-cell scan/shuffle. Source-current callback must own
    /// actual postcommit revision/zero-active branch; no Core revision proxy.
    public func prepareSourceMagnetFallback(transactionID:String,generation:UInt64,
        sourceCurrent:()->Bool,sourceRandom:()->Double)->NativeSourceMagnetFallbackPlan? {
        guard sourceMagnetFallbacksEnabled,state.generation==generation,state.terminal==nil,state.validationIssues(allowSourceDetachedGridReferences:sourceTutorialSubsequentPresentationEnabled).isEmpty,
              pendingSpecial==nil,pendingSourceMagnetFallback==nil,pendingSourceMagnetFallbackOpen==nil,
              let receipt=sourceMagnetPostCommit,receipt.transactionID==transactionID,receipt.generation==generation else{return nil}
        let captured=state
        func valid()->Bool {let accepted=sourceCurrent();return accepted && state==captured && sourceMagnetPostCommit==receipt && pendingSourceMagnetFallback==nil && pendingSourceMagnetFallbackOpen==nil}
        guard valid() else{return nil}
        var empty:[NativeCell]=[]
        for row in 0..<state.rows {for column in 0..<state.columns {
            let cell=NativeCell(column:column,row:row),tile=state.tile(at:cell)
            if let tile,tile.value>0 || tile.isWild {continue}
            if tile==nil || tile?.locked==true {empty.append(cell)}
        }}
        if empty.count>1 {for i in stride(from:empty.count-1,through:1,by:-1) {
            let roll=sourceRandom();guard valid(),roll.isFinite,roll>=0,roll<1 else{return nil}
            empty.swapAt(i,Int(floor(roll*Double(i+1))))
        }}
        let count=max(1,min(receipt.spawnCount,2)),reserved=Set(receipt.reserved)
        let cells=Array(empty.prefix(count+6)).filter{!reserved.contains($0)}.prefix(count)
        guard valid() else{return nil};sourceMagnetFallbackSequence &+= 1
        let plan=NativeSourceMagnetFallbackPlan(id:"source-magnet-fallback:\(generation):\(sourceMagnetFallbackSequence)",transactionID:transactionID,generation:generation,cells:Array(cells))
        pendingSourceMagnetFallback=plan;sourceMagnetFallbackIndex=0;return plan
    }
    /// Value draw precedes the literal openAtCell occupied-cell check. Fresh
    /// placeholder constructor/rotation belongs to the actual Scene callback.
    public func beginSourceMagnetFallbackOpen(planID:String,generation:UInt64,index:Int,
        sourceCurrent:()->Bool,sourceRandom:()->Double)->NativeSourceMagnetFallbackOpen? {
        guard sourceMagnetFallbacksEnabled,state.generation==generation,state.terminal==nil,
              let plan=pendingSourceMagnetFallback,plan.id==planID,plan.generation==generation,index==sourceMagnetFallbackIndex,
              plan.cells.indices.contains(index),pendingSourceMagnetFallbackOpen==nil else{return nil}
        let captured=state
        func valid()->Bool {let accepted=sourceCurrent();return accepted && state==captured && pendingSourceMagnetFallback==plan && pendingSourceMagnetFallbackOpen==nil && sourceMagnetFallbackIndex==index}
        guard valid() else{return nil};let roll=sourceRandom()
        guard valid(),roll.isFinite,roll>=0,roll<1 else{return nil}
        let value=1+Int(floor(roll*3)),cell=plan.cells[index],old=state.tile(at:cell)
        let skipped=old.map{!$0.locked && ($0.value>0 || $0.isWild)} ?? false
        var holder:NativeTile?,removed:String?,created=false
        if !skipped {
            if let old,old.locked,old.value<=0,!old.isWild {removed=old.id;state.tiles.removeAll{$0.id==old.id}}
            if let existing=state.tile(at:cell) {holder=existing}
            else {var fresh=freshTile(cell:cell,value:0);fresh.locked=true;fresh.alpha=0.20;state.tiles.append(fresh);holder=fresh;created=true}
        }
        let open=NativeSourceMagnetFallbackOpen(id:"\(plan.id):open:\(index)",planID:plan.id,generation:generation,index:index,cell:cell,value:value,holder:holder,removedHolderID:removed,createdHolder:created,skipped:skipped)
        pendingSourceMagnetFallbackOpen=open;sourceMagnetFallbackValueCommitted=false;return open
    }
    /// Actual constructor/bind before setValue caller invokes this once. It
    /// never chooses another cell/value or draws additional gameplay randomness.
    public func commitSourceMagnetFallbackValue(openID:String,generation:UInt64)->NativeMoveResult {
        guard state.generation==generation,state.terminal==nil,let open=pendingSourceMagnetFallbackOpen,
            open.id==openID,open.generation==generation,!sourceMagnetFallbackValueCommitted,!open.skipped,let holder=open.holder,
            let i=state.tiles.firstIndex(where:{$0.id==holder.id && $0.cell==open.cell}),state.tiles[i]==holder else{return rejected("source_magnet_fallback_holder_changed")}
        state.tiles[i].locked=false;state.tiles[i].visible=true;state.tiles[i].alpha=1;state.tiles[i].value=open.value;state.tiles[i].stackDepth=1
        state.tiles[i].archetype=nil;state.tiles[i].variant=nil;state.tiles[i].pendingRemoval=false;state.tiles[i].magnetOwned=false;state.tiles[i].resolutionOwned=false
        sourceMagnetFallbackValueCommitted=true
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[holder.id],value:open.value,archetype:.magnet,reason:open.id)],resolution:NativeResolution(.wait,reason:"source_magnet_fallback_open_pending"))
    }
    /// Called only from actual Source GSAP560 completion/interruption. A moved
    /// or consumed cube is never restored by this late acknowledgement.
    @discardableResult public func finishSourceMagnetFallbackOpen(openID:String,generation:UInt64,interrupted:Bool)->Bool {
        guard state.generation==generation,let open=pendingSourceMagnetFallbackOpen,open.id==openID,open.generation==generation,
            interrupted || open.skipped || sourceMagnetFallbackValueCommitted else{return false}
        pendingSourceMagnetFallbackOpen=nil;sourceMagnetFallbackValueCommitted=false
        if interrupted {pendingSourceMagnetFallback=nil;sourceMagnetPostCommit=nil;sourceMagnetFallbackIndex=0}
        else {sourceMagnetFallbackIndex+=1}
        return true
    }
    @discardableResult public func finishSourceMagnetFallback(planID:String,generation:UInt64)->Bool {
        guard state.generation==generation,let plan=pendingSourceMagnetFallback,plan.id==planID,plan.generation==generation,
            pendingSourceMagnetFallbackOpen==nil,sourceMagnetFallbackIndex==plan.cells.count else{return false}
        pendingSourceMagnetFallback=nil;sourceMagnetFallbackIndex=0;return true
    }
    @discardableResult public func retireSourceMagnetPostCommit(transactionID:String,generation:UInt64)->Bool {
        guard state.generation==generation,sourceMagnetPostCommit?.transactionID==transactionID,sourceMagnetPostCommit?.generation==generation else{return false}
        sourceMagnetPostCommit=nil;pendingSourceMagnetFallback=nil;pendingSourceMagnetFallbackOpen=nil;sourceMagnetFallbackIndex=0;sourceMagnetFallbackValueCommitted=false;return true
    }

    private func settleDeferredFinalMerge(events: inout [NativeGameplayEvent]) -> NativeResolution {
        let resolution = resolve()
        guard !hasPendingSourceOrdinaryStackFace,pendingSpecial == nil,pendingMeterRewards.isEmpty,pendingOrdinaryStack == nil,pendingOrdinarySix == nil,pendingOrdinaryPostchecks.isEmpty,let captured = deferredFinalMerge else { return resolution }
        deferredFinalMerge = nil
        if resolution.kind == .complete {
            resetMeterAfterRound(); state.terminal = captured; noMovesSignature = nil
            events.append(NativeGameplayEvent(.terminal,reason:captured.reason)); return captured
        }
        return resolution
    }

    /// PRIVATE fresh-demo caller only. No timer, RNG, revision, score or move debit.
    public var sourceTutorialPresentationBarrierEnabled=false
    public var sourceTutorialSubsequentPresentationEnabled=false
    public private(set) var sourceTutorialWildReservation:NativeSourceTutorialWildReservation?
    public private(set) var sourceTutorialFourthPreparation:NativeSourceTutorialFourthPreparationReceipt?
    @discardableResult public func retireSourceTutorialWildReservation(ownerID:String,generation:UInt64)->Bool {
        guard let receipt=sourceTutorialWildReservation,receipt.ownerID==ownerID,receipt.generation==generation,state.generation==generation else{return false}
        sourceTutorialWildReservation=nil;return true
    }
    public private(set) var pendingSourceTutorialPresentationBarrier:NativeSourceTutorialPresentationBarrier?
    @discardableResult public func completeSourceTutorialPresentationBarrier(_ receipt:NativeSourceTutorialPresentationBarrier)->Bool {
        guard pendingSourceTutorialPresentationBarrier==receipt,state.generation==receipt.generation,state.tutorial?.active==true else{return false}
        switch receipt.phase {
        case .firstMerge:
            guard state.tutorial?.step == .mergeSix,state.tutorial?.guidedPair==[receipt.mergedID,receipt.oneID],
                state.tiles.contains(where:{$0.id==receipt.mergedID && $0.value==5}),state.tiles.contains(where:{$0.id==receipt.oneID && $0.value==1}) else{return false}
            if sourceTutorialSubsequentPresentationEnabled {
                // Literal Source step-two normalizeTutorialTileVisual. The actual
                // captured Scene preparation has normalized these same objects
                // before releasing this barrier. Keep physical/model depth equal
                // without another move, score, RNG or max-depth-stat mutation.
                for index in state.tiles.indices where state.tiles[index].id==receipt.mergedID || state.tiles[index].id==receipt.oneID {
                    state.tiles[index].stackDepth=1
                }
            }
        case .secondMerge:
            guard state.tutorial?.step == .freePlay,state.tutorial?.waitingForWild==false else{return false}
        }
        pendingSourceTutorialPresentationBarrier=nil;setInputLock(receipt.id,active:false);return true
    }
    @discardableResult public func retireSourceTutorialPresentationBarrier(_ receipt:NativeSourceTutorialPresentationBarrier)->Bool {
        guard pendingSourceTutorialPresentationBarrier==receipt,state.generation==receipt.generation else{return false}
        pendingSourceTutorialPresentationBarrier=nil;setInputLock(receipt.id,active:false);return true
    }
    public var sourceTutorialDemoActivationEnabled=false
    public private(set) var pendingSourceTutorialDemoActivation:NativeSourceTutorialDemoActivationReceipt?
    private var sourceTutorialDemoActivationSequence:UInt64=0
    /// Source arms active before the captured activation RAFs. Empty guided IDs
    /// reject input until the actual prepareTutorialBoard callback owns the pair.
    public func beginSourceTutorialDemoActivation()->NativeSourceTutorialDemoActivationReceipt? {
        guard sourceTutorialDemoActivationEnabled,pendingSourceTutorialDemoActivation==nil,
            state.tutorial==nil,state.terminal==nil,drag==nil,!flags.isWaiting,
            state.board>0,state.validationIssues(allowSourceDetachedGridReferences:sourceTutorialSubsequentPresentationEnabled).isEmpty,
            NativeSourceTutorialDemoActivationReceipt.matchesOriginalDemo(state) else{return nil}
        sourceTutorialDemoActivationSequence &+= 1
        let cells=NativeTutorialRules.guidedCells(columns:state.columns,rows:state.rows)
        guard let three=state.tile(at:cells.three),let two=state.tile(at:cells.two),let one=state.tile(at:cells.one) else{return nil}
        let receipt=NativeSourceTutorialDemoActivationReceipt(id:"source-tutorial-demo:\(state.generation):\(sourceTutorialDemoActivationSequence)",generation:state.generation,revision:state.revision,threeID:three.id,twoID:two.id,oneID:one.id,originalTiles:state.tiles)
        state.tutorial=NativeTutorialState();pendingSourceTutorialDemoActivation=receipt
        return receipt
    }
    /// Must be invoked at genuine Source wall1250 prepare, paired with actual
    /// captured Node normalization/immediate square pips/focus roots. Original
    /// demoReady skips initializeLowTutorialBoardValues for all nonreserved cells.
    public func commitSourceTutorialDemoPreparation(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard let receipt=pendingSourceTutorialDemoActivation,receipt.id==receiptID,
            receipt.generation==generation,state.generation==generation,state.revision==receipt.revision,
            state.tiles==receipt.originalTiles,state.tutorial?.active==true,
            state.tutorial?.guidedPair.isEmpty==true,state.terminal==nil,drag==nil,!flags.isWaiting else{return rejected("source_tutorial_demo_preparation_stale")}
        pendingSourceTutorialDemoActivation=nil
        for index in state.tiles.indices {state.tiles[index].stackDepth=1}
        for (id,value) in [(receipt.threeID,3),(receipt.twoID,2),(receipt.oneID,1)] {
            guard let i=state.tiles.firstIndex(where:{$0.id==id}) else{preconditionFailure("captured validated demo identity lost")}
            state.tiles[i].value=value;state.tiles[i].locked=false;state.tiles[i].visible=true;state.tiles[i].alpha=1
            state.tiles[i].archetype=nil;state.tiles[i].sourceWildStateCleared=false;state.tiles[i].sourceResidualWildPresence=false
        }
        state.tutorial?.guidedPair=[receipt.threeID,receipt.twoID];state.tutorial?.oneTileID=receipt.oneID
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    /// True lifecycle/candidate retirement only. Modal pause retains activation.
    @discardableResult public func cancelSourceTutorialDemoActivation(receiptID:String,generation:UInt64)->Bool {
        guard let receipt=pendingSourceTutorialDemoActivation,receipt.id==receiptID,
            receipt.generation==generation,state.generation==generation,state.revision==receipt.revision,
            state.tiles==receipt.originalTiles,state.tutorial?.guidedPair.isEmpty==true else{return false}
        pendingSourceTutorialDemoActivation=nil;state.tutorial=nil;return true
    }

    /// Explicitly armed by the Native tutorial coordinator, never by a normal completed board.
    public func startTutorial() -> NativeMoveResult {
        guard state.terminal == nil, !flags.isWaiting, state.tutorial?.active != true, state.columns >= 3, state.rows >= 3 else { return rejected("tutorial_start_not_ready") }
        let cells = NativeTutorialRules.guidedCells(columns:state.columns,rows:state.rows)
        guard let three = state.tile(at:cells.three), let two = state.tile(at:cells.two), let one = state.tile(at:cells.one), Set([three.id,two.id,one.id]).count == 3 else { return rejected("tutorial_canonical_cells_unavailable") }
        var tutorial = NativeTutorialState(); tutorial.guidedPair = [three.id,two.id]; tutorial.oneTileID = one.id
        let reserved = Set([three.id,two.id,one.id])
        let ordered = state.tiles.filter { !reserved.contains($0.id) }.sorted { $0.cell.row != $1.cell.row ? $0.cell.row < $1.cell.row : $0.cell.column < $1.cell.column }
        for (offset,tile) in ordered.enumerated() where !tile.isWild && tile.value > 0 {
            if let index = state.tiles.firstIndex(where: { $0.id == tile.id }) { state.tiles[index].value = offset % 11 == 10 ? 3 : offset % 2 + 1; state.tiles[index].stackDepth = 1 }
        }
        for (tile,value) in [(three,3),(two,2),(one,1)] {
            if let index = state.tiles.firstIndex(where: { $0.id == tile.id }) { state.tiles[index].value = value; state.tiles[index].locked = false; state.tiles[index].visible = true; state.tiles[index].alpha = 1; state.tiles[index].stackDepth = 1; state.tiles[index].archetype = nil; state.tiles[index].variant = nil }
        }
        state.tutorial = tutorial; state.revision &+= 1; drag = nil; noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    /// Arm before the first guided action. The actual stack and merge-six
    /// commits introduce Special Bar before Clear the Stage.
    public func configureTutorialReward(_ reward:NativeWildRewardChoice) {
        guard state.tutorial != nil,state.tutorial?.rewardArchetype == nil else{return}
        state.tutorial?.rewardArchetype=reward.archetype;state.tutorial?.rewardVariant=reward.variant
    }
    public func beginTutorialSpecialBarInterval() -> NativeMoveResult {
        guard state.terminal == nil, state.tutorial?.active == true,
              state.tutorial?.step != .special,
              state.tutorial?.waitingForWild == false,
              state.tutorial?.specialBarSuccessfulActions == nil, sourceTutorialWildReservation == nil else {
            return rejected("tutorial_special_bar_interval_not_ready")
        }
        state.tutorial?.specialBarSuccessfulActions = 0
        state.tutorial?.specialBarAcknowledged = false
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    /// Continue acknowledges Special Bar. Clear the Stage owns subsequent
    /// forced-Star reservation through dismissTutorialFreePlayGuide.
    public func acknowledgeTutorialSpecialBar(sourceReservationOwnerID:String?=nil) -> NativeMoveResult {
        guard state.terminal == nil, state.tutorial?.specialBarReady == true else {
            return rejected("tutorial_special_bar_not_ready")
        }
        guard state.tutorial?.active==true,state.tutorial?.step == .freePlay,
            state.tutorial?.waitingForWild==false else{return rejected("tutorial_special_bar_not_ready")}
        state.tutorial?.specialBarAcknowledged = true
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    /// Source calls after actual CTA exit/restore, before sheet340; default
    /// Native prototype calls after its sheet. Window reservation is transient.
    public func dismissTutorialFreePlayGuide(sourceReservationOwnerID:String?=nil) -> NativeMoveResult {
        guard state.tutorial?.active == true, state.tutorial?.step == .freePlay else { return rejected("tutorial_freeplay_guide_not_active") }
        if sourceTutorialSubsequentPresentationEnabled {
            guard state.tutorial?.waitingForWild==false,sourceTutorialWildReservation==nil,
                let ownerID=sourceReservationOwnerID,!ownerID.isEmpty,
                let cell=NativeTutorialRules.sourceFourthWildCell(state:state,destroyedIDs:sourceTutorialDestroyedIDs,emptyGridCells:sourceMeterDropExcludedCells) else{return rejected("source_tutorial_wild_reservation_unavailable")}
            sourceTutorialWildReservation = .init(ownerID:ownerID,generation:state.generation,cell:cell)
        }
        state.tutorial?.waitingForWild = true
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    private var sourceTutorialDestroyedIDs:Set<String>{Set(noMovesTileRuntime.compactMap{$0.value.destroyed ? $0.key:nil})}
    private var forceTutorialWildStar:Bool {
        sourceTutorialSubsequentPresentationEnabled ? sourceTutorialWildReservation?.generation==state.generation:state.tutorial?.waitingForWild==true
    }
    private func resolveSourceTutorialWildReservation(excluded:Set<NativeCell>)->NativeCell? {
        guard sourceTutorialSubsequentPresentationEnabled,var receipt=sourceTutorialWildReservation,receipt.generation==state.generation else{return nil}
        guard let cell=NativeTutorialRules.sourceResolveReservedWildCell(state:state,reserved:receipt.cell,destroyedIDs:sourceTutorialDestroyedIDs,excluded:excluded) else{return nil}
        receipt.cell=cell;sourceTutorialWildReservation=receipt;return cell
    }
    private func clearSourceTutorialWildReservation(ownerID:String?,generation:UInt64,forcedCell:NativeCell?,openedCell:NativeCell){
        guard let ownerID,let forcedCell,forcedCell==openedCell,let receipt=sourceTutorialWildReservation,
            receipt.ownerID==ownerID,receipt.generation==generation,state.generation==generation else{return}
        sourceTutorialWildReservation=nil
    }
    /// Genuine fourth preparation calls this synchronously after capturing its
    /// live Wild and selected ordinary object. No spawn, replacement or RNG.
    public func prepareSourceTutorialFourthStep(ownerID:String,generation:UInt64,wildID:String,targetID:String)->NativeMoveResult {
        guard sourceTutorialSubsequentPresentationEnabled,!ownerID.isEmpty,generation==state.generation,
            sourceTutorialFourthPreparation==nil,state.terminal==nil,state.tutorial?.active==true,
            state.tutorial?.step == .freePlay || state.tutorial?.step == .special,
            let wildIndex=state.tiles.firstIndex(where:{$0.id==wildID}),
            !sourceTutorialDestroyedIDs.contains(wildID),state.tiles[wildIndex].value>0,!state.tiles[wildIndex].locked,
            state.tiles[wildIndex].isWild,
            let target=NativeTutorialRules.sourceFourthTarget(state:state,wildID:wildID,destroyedIDs:sourceTutorialDestroyedIDs),target.id==targetID,
            let cell=NativeTutorialRules.sourceFourthWildCell(state:state,wildID:wildID,destroyedIDs:sourceTutorialDestroyedIDs),
            let targetIndex=state.tiles.firstIndex(where:{$0.id==targetID}) else{return rejected("source_tutorial_fourth_preparation_stale")}
        var prepared=state
        guard prepared.sourcePlaceTutorialTile(id:wildID,at:cell) else{return rejected("source_tutorial_fourth_placement_unavailable")}
        prepared.tiles[wildIndex].sourceWildStateCleared=false;prepared.tiles[wildIndex].sourceResidualWildPresence=false
        prepared.tiles[wildIndex].locked=false;prepared.tiles[wildIndex].value=6;prepared.tiles[wildIndex].visible=true;prepared.tiles[wildIndex].alpha=1
        prepared.tiles[targetIndex].value=target.value;prepared.tiles[targetIndex].archetype=nil
        // Match the ordinary tutorial node's initial-value setter. This tile
        // has no cleared Wild state to carry into physical-board receipts.
        prepared.tiles[targetIndex].sourceWildStateCleared=false;prepared.tiles[targetIndex].sourceResidualWildPresence=false
        prepared.tiles[targetIndex].locked=false;prepared.tiles[targetIndex].visible=true;prepared.tiles[targetIndex].alpha=1
        prepared.tutorial?.step = .special;prepared.tutorial?.waitingForWild=false;prepared.tutorial?.wildTileID=wildID;prepared.tutorial?.guidedPair=[wildID,targetID]
        guard prepared.validationIssues(allowSourceDetachedGridReferences:true).isEmpty else{return rejected("source_tutorial_fourth_preparation_invalid")}
        state=prepared;sourceTutorialFourthPreparation = .init(ownerID:ownerID,generation:generation,wildID:wildID,targetID:targetID,wildCell:cell,targetValue:target.value)
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    private func advanceTutorialAfterMerge(source: NativeTile, destination: NativeTile, events: inout [NativeGameplayEvent]) {
        guard var tutorial = state.tutorial, tutorial.active else { return }
        if let count=tutorial.specialBarSuccessfulActions,tutorial.specialBarAcknowledged != true,
            !tutorial.waitingForWild,source.gameplayArchetype==nil,destination.gameplayArchetype==nil {
            tutorial.specialBarSuccessfulActions=min(2,count+1)
        }
        switch tutorial.step {
        case .stack:
            guard let merged = state.tile(at:destination.cell), merged.value == 5, let oneID = tutorial.oneTileID else { return }
            tutorial.step = .mergeSix; tutorial.guidedPair = [merged.id,oneID]
            if sourceTutorialPresentationBarrierEnabled {
                let receipt=NativeSourceTutorialPresentationBarrier(id:"source-tutorial-step-one:\(state.generation):\(state.revision)",generation:state.generation,mergedID:merged.id,oneID:oneID)
                pendingSourceTutorialPresentationBarrier=receipt;setInputLock(receipt.id,active:true)
            }
        case .mergeSix:
            tutorial.step = .freePlay; tutorial.guidedPair = []
            if sourceTutorialSubsequentPresentationEnabled {
                let receipt=NativeSourceTutorialPresentationBarrier(id:"source-tutorial-step-two:\(state.generation):\(state.revision)",generation:state.generation,mergedID:destination.id,oneID:source.id,phase:.secondMerge)
                pendingSourceTutorialPresentationBarrier=receipt;setInputLock(receipt.id,active:true)
            }
        case .freePlay: break
        case .special:
            guard source.id == tutorial.wildTileID || destination.id == tutorial.wildTileID else { return }
            // Admitted Source fourth presentation still owns its wall60,
            // pointer/sheet exits and restoration. A merge cannot retire it.
            if sourceTutorialSubsequentPresentationEnabled,sourceTutorialFourthPreparation?.generation==state.generation{return}
            tutorial.active = false; tutorial.guideCompleted = true; tutorial.completionAssist = true; tutorial.guidedPair = []
        }
        state.tutorial = tutorial
    }
    /// Called after the captured Source fourth pointer/sheet exit and board
    /// restore. Requires the canonical preparation owner and a genuine fourth
    /// completion condition; no timer, Math, revision or save owner is added.
    public func completeSourceTutorialFourthStep(ownerID:String,generation:UInt64)->NativeMoveResult {
        guard sourceTutorialSubsequentPresentationEnabled,generation==state.generation,
            let receipt=sourceTutorialFourthPreparation,receipt.ownerID==ownerID,receipt.generation==generation,
            state.tutorial?.active==true,state.tutorial?.step == .special else{return rejected("source_tutorial_fourth_completion_stale")}
        let destroyed=sourceTutorialDestroyedIDs
        let wild=state.tiles.first{$0.id==receipt.wildID}
        let wildConsumed=wild==nil || destroyed.contains(receipt.wildID) || wild?.isWild != true
        let hasSix=state.tiles.contains{!destroyed.contains($0.id) && !$0.locked && $0.gameplayArchetype==nil && $0.value==6 && $0.cell.row<=min(state.rows-1,5)}
        guard wildConsumed || hasSix else{return rejected("source_tutorial_fourth_completion_not_ready")}
        state.tutorial?.active=false;state.tutorial?.guideCompleted=true;state.tutorial?.completionAssist=true;state.tutorial?.guidedPair=[]
        sourceTutorialFourthPreparation=nil
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    /// Result acknowledgement is scoped to a tutorial run that actually completed its guide.
    public func acknowledgeTutorialEncouragement() {
        guard state.tutorial?.guideCompleted == true else{return}
        state.tutorial?.encouragementAcknowledged=true
    }
    public func acknowledgeTutorialResult() -> Bool {
        guard state.terminal != nil, state.tutorial?.guideCompleted == true else { return false }
        state.tutorial?.done = true; state.tutorial?.completionAssist = false; return true
    }
    public func claimTutorialFinalChance() -> NativeMoveResult {
        guard state.terminal == nil, !flags.isWaiting, let value = NativeTutorialRules.finalChanceValue(state:state) else { return rejected("tutorial_final_chance_unavailable") }
        let cells = NativeMagnetRules.emptyCells(state:state)
        guard !cells.isEmpty else { return rejected("tutorial_final_chance_no_cell") }
        let cell = cells[min(cells.count-1,Int(nextRandom()*Double(cells.count)))]
        state.revision &+= 1; state.removeSourceGridOwner(at:cell); let tile = freshTile(cell:cell,value:value); state.tiles.append(tile)
        state.tutorial?.finalChanceSpawnCount += 1; noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:value,reason:"tutorial_final_chance")],resolution:resolve())
    }

    private func captureHUDStars(source: NativeTile, destination: NativeTile,starOrbitCapture:NativeSourceStarOrbitCapture?=nil,finalMerge:Bool=false) -> [NativeHUDStarReceipt] {
        guard let wild = [source,destination].first(where: { $0.isWild }) else {
            return finalMerge ? prepareHUDStars(count:1,origin:destination.cell,variant:nil,finalMerge:true):[]
        }

        if comboHUDCoinRewardsEnabled {
            // Keep the existing Juice selection draw so the board RNG stream is unchanged.
            if wild.archetype == .juice {_ = nextRandom()}
            return prepareHUDStars(count:NativeComboCoinPolicy.count(combo:state.combo),origin:destination.cell,variant:wild.variant,archetype:wild.gameplayArchetype,finalMerge:finalMerge)
        }
        let count: Int
        // Final TNT gameplay, including legacy variant provenance, earns three
        // HUD coins without entering the nonfinal target/respawn graph.
        if finalMerge && NativeSpecialDiceRegistry.finale(source:source,destination:destination,gameplay:true) == .tnt {
            if wild.archetype == .juice {_ = nextRandom()} // retain legacy reward-selection draw
            count=3
        }
        // Nonfinal Source keeps its saved core-special reward provenance.
        else if wild.archetype == .star && wild.variant != "bloob-ball" {
            if wild.variant==nil,let capture=starOrbitCapture,capture.tileID==wild.id,capture.generation==state.generation {
                count=finalMerge ? wild.effectiveStarDropCount:max(0,min(3,capture.savedPositions))
                if count==0 {return []} // Original missing texture poses skips HUD call.
            } else {count = wild.effectiveStarDropCount}
        }
        else if wild.archetype == .juice { count = 1+Int(nextRandom()*3) }
        else if finalMerge {count=1}
        else { return [] }
        return prepareHUDStars(count:count,origin:destination.cell,variant:wild.variant,archetype:wild.gameplayArchetype,finalMerge:finalMerge)
    }
    private func prepareHUDStars(count: Int, origin: NativeCell, variant: String?, archetype: NativeWildArchetype? = nil, finalMerge:Bool=false) -> [NativeHUDStarReceipt] {
        hudStarSequence &+= 1
        let batch = "native-hud-star:\(state.generation):\(hudStarSequence)"
        let receipts = (0..<count).map { NativeHUDStarReceipt(isFinalMerge:finalMerge,id:"\(batch):\($0)",generation:state.generation,origin:origin,ordinal:$0,batchCount:count,variant:variant,archetype:archetype) }
        pendingHUDStars += receipts
        return receipts
    }
    /// Adopts one reward group (Native cap7, Source reference cap3), never a
    /// flattened set of several independent earned batches. No score mutation.
    public func registerSourceHUDStarJob(receiptIDs:[String],generation:UInt64)->NativeSourceHUDStarJob? {
        guard sourceHUDStarJobsEnabled,generation==state.generation,!receiptIDs.isEmpty,receiptIDs.count <= (comboHUDCoinRewardsEnabled ? NativeComboCoinPolicy.maximumCount : 3),
            Set(receiptIDs).count==receiptIDs.count else{return nil}
        let ordered=receiptIDs.compactMap{id in pendingHUDStars.first{$0.id==id && $0.generation==generation}}
        guard ordered.count==receiptIDs.count,let first=ordered.first else{return nil}
        guard ordered.allSatisfy({$0.batchCount==ordered.count && $0.variant==first.variant && $0.origin==first.origin}),
            ordered.map(\.ordinal)==Array(0..<ordered.count),
            ordered.allSatisfy({$0.id.dropLast(2)==first.id.dropLast(2)}),
            sourceHUDStarJobs.allSatisfy({Set($0.receiptIDs).isDisjoint(with:receiptIDs)}) else{return nil}
        sourceHUDStarJobSequence &+= 1
        let job=NativeSourceHUDStarJob(id:"native-source-hud-job:\(generation):\(sourceHUDStarJobSequence)",generation:generation,receiptIDs:receiptIDs)
        sourceHUDStarJobs.append(job);return job
    }
    /// Actual transformed-path98% callback for this captured job/star only.
    public func commitSourceHUDStarArrival(job:NativeSourceHUDStarJob,receiptID:String)->NativeMoveResult {
        guard job.generation==state.generation,sourceHUDStarJobs.contains(job),job.receiptIDs.contains(receiptID) else{return rejected("stale_source_hud_star_job")}
        return performHUDStarArrival(receiptID:receiptID,generation:job.generation)
    }
    /// Genuine job wall cleanup or explicit forceCleanup kills unfinished debt
    /// without reward. Completed stars are already absent; captured IDs retain
    /// their original job until this callback, even if all visual sprites left.
    @discardableResult public func retireSourceHUDStarJob(job:NativeSourceHUDStarJob)->Bool {
        guard job.generation==state.generation,let i=sourceHUDStarJobs.firstIndex(of:job) else{return false}
        sourceHUDStarJobs.remove(at:i);let captured=Set(job.receiptIDs)
        pendingHUDStars.removeAll{$0.generation==job.generation && captured.contains($0.id)}
        return true
    }
    /// Called only by the captured flight reaching98% of its HUD path. Terminal sealing does not revoke authored score arrivals.
    public func commitHUDStarArrival(receiptID: String, generation: UInt64) -> NativeMoveResult {
        guard !sourceHUDStarJobsEnabled,!sourceHUDStarJobs.contains(where:{$0.generation==generation && $0.receiptIDs.contains(receiptID)}) else{return rejected("source_hud_star_requires_captured_job")}
        return performHUDStarArrival(receiptID:receiptID,generation:generation)
    }
    private func performHUDStarArrival(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation == state.generation, let index = pendingHUDStars.firstIndex(where: { $0.id == receiptID && $0.generation == generation }) else { return rejected("stale_or_duplicate_hud_star") }
        let receipt = pendingHUDStars.remove(at:index)
        state.score = min(999999,state.score+100); state.bestScore = max(state.bestScore,state.score)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.hudStarArrived,tileIDs:[receipt.id],value:100,variant:receipt.variant)],resolution:resolve())
    }

    /// Exact installed Source queue capture. The queue sets its own progress
    /// writer before entering spawnWildFromMeter; that writer is not a foreign
    /// Wild coroutine and must not veto its own already admitted claim.
    public final class SourceMeterQueueClaimCapture {
        public let ownerID:UUID,generation:UInt64
        public let isCurrent:()->Bool
        public init(ownerID:UUID,generation:UInt64,isCurrent:@escaping()->Bool) {
            self.ownerID=ownerID;self.generation=generation;self.isCurrent=isCurrent
        }
    }
    public func claimSourceMeterReward(queue:SourceMeterQueueClaimCapture)->NativeMoveResult {
        let captured=state,capturedFlags=flags
        guard stagedMeterDrops,stagedMeterOpen,queue.generation==captured.generation,
              queue.isCurrent(),state==captured,flags==capturedFlags,
              queue.isCurrent(),state==captured,flags==capturedFlags else{return rejected("source_meter_queue_claim_not_current")}
        return claimMeterReward(sourceQueueOwned:true)
    }
    public func claimMeterReward() -> NativeMoveResult {claimMeterReward(sourceQueueOwned:false)}
    private func claimMeterReward(sourceQueueOwned:Bool)->NativeMoveResult {
        guard meterDropAllowed else { return rejected("one_lucky_drop_already_used") }
        guard state.tutorial?.specialBarDefersReward != true else { return rejected("tutorial_special_bar_reward_deferred") }
        // Only the captured queue's own progress writer is excluded. Every
        // independent mutation/end-game owner remains a claim veto.
        var waiting=flags
        if sourceQueueOwned {waiting.wildSpawnInProgress=false}
        let directOwnershipSettled=pendingDirectWild == nil || (directWildGameplayCommitted && directWildSpawnPhase == nil && pendingDirectWild?.isFinal == false)
        guard state.terminal == nil, !hasSourceMeterLastMerge, !waiting.isWaiting, directOwnershipSettled,
              !sourceMeterBlocksAnotherSpawn, pendingOrdinaryStack == nil, pendingOrdinarySix == nil, state.wildMeter >= 1-0.000001 else { return rejected("wild_meter_not_ready") }
        if stagedMeterDrops && stagedMeterOpen {return beginMeterOpenFlow()}
        if sourceTutorialSubsequentPresentationEnabled,sourceTutorialWildReservation != nil{return rejected("source_tutorial_hidden_open_owner_unavailable")}
        let before = state; let choices = randomChoices
        var events: [NativeGameplayEvent] = []
        guard spawnMeterReward(events:&events) else { state = before; randomChoices = choices; return rejected("wild_meter_reward_unavailable") }
        let resolution = resolve()
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    /// Hard recovery from the source stuck-path. A six+1...5 continuation remains vetoed by that owner.
    public func repairLingeringRegularSix(tileID: String, generation: UInt64, revision: UInt64) -> NativeMoveResult {
        guard generation == state.generation, revision == state.revision, drag == nil, state.terminal == nil, !flags.isWaiting, !flags.endgameGuardActive,
              let tile = state.tiles.first(where: { $0.id == tileID }), tile.isPlayable, !tile.isWild, tile.value == 6, !tile.nonFinalMerge6,
              state.activeTiles.contains(where: { $0.id != tile.id }), !state.activeTiles.contains(where: { !$0.isWild && (1...5).contains($0.value) }),
              !sourceMeterSpawnInProgress, !sourceMeterHandoffInProgress, NativeGameplayResolver.resolve(state:state,flags:resolutionRuntimeFlags).kind == .fail else { return rejected("lingering_six_repair_not_admitted") }
        state.revision &+= 1; state.tiles.removeAll { $0.id == tile.id }; let replacement = freshTile(cell:tile.cell,value:randomValue()); state.tiles.append(replacement)
        noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:[tile.id]),NativeGameplayEvent(.spawned,tileIDs:[replacement.id],value:replacement.value,reason:"lingering_merge6_rescue")],resolution:resolve())
    }
    public func beginNoMovesConfirmation() -> String? {
        guard !stagedSourceNoMoves else{return nil}
        guard drag == nil, resolve().kind == .fail else { noMovesSignature = nil; return nil }
        noMovesSignature = state.signature
        return noMovesSignature
    }
    public func confirmNoMoves(signature: String, generation: UInt64) -> NativeMoveResult {
        guard !stagedSourceNoMoves else{return rejected("source_no_moves_transport_required")}
        guard generation == state.generation, noMovesSignature == signature, state.signature == signature,
              drag == nil, state.terminal == nil, !flags.isWaiting, !flags.endgameGuardActive,
              state.validationIssues(allowSourceDetachedGridReferences:sourceTutorialSubsequentPresentationEnabled).isEmpty, resolve().kind == .fail else { noMovesSignature = nil; return rejected("no_moves_confirmation_cancelled") }
        setInputLock("terminal-no-moves", active: true)
        guard state.signature == signature, resolve().kind == .fail else { setInputLock("terminal-no-moves", active: false); noMovesSignature = nil; return rejected("no_moves_final_commit_cancelled") }
        let resolution = resolve()
        state.terminal = resolution; noMovesSignature = nil
        return NativeMoveResult(accepted: true, state: state, events: [NativeGameplayEvent(.terminal, reason: resolution.reason)], resolution: resolution)
    }
    private func rejected(_ reason: String) -> NativeMoveResult { NativeMoveResult(accepted: false, state: state, events: [NativeGameplayEvent(.blocked, reason: reason)], resolution: NativeResolution(.wait, reason: reason)) }
    private func nextRandom() -> Double {
        // Original APP Math draw is external and forward-only even if a native
        // rejected attempt restores its model/recorded Raw choices.
        if let sourceMathRandom {return sourceMathRandom.next()}
        if !randomChoices.isEmpty { let roll = randomChoices.removeFirst(); return roll.isFinite ? min(1 - Double.ulpOfOne, max(0, roll)) : 0 }
        state.rngState &+= 0x9e3779b97f4a7c15
        var z = state.rngState
        z = (z ^ (z >> 30)) &* 0xbf58476d1ce4e5b9
        z = (z ^ (z >> 27)) &* 0x94d049bb133111eb
        z ^= z >> 31
        return Double(z >> 11) / 9007199254740992
    }
    private func randomValue(excluding: Int? = nil) -> Int {
        if state.tutorial?.usesLowValues == true { return NativeTutorialRules.lowValue(excluding:excluding,roll:nextRandom()) }
        let pool = (1...5).filter { $0 != excluding }
        let stageInWorld = ((max(1, state.board) - 1) % 10) + 1
        let bias = state.mode == .arcade ? max(0, 0.5 - Double(max(1, state.stage) - 1) * 0.05) : stageInWorld <= 3 ? 0.75 : stageInWorld <= 6 ? 0.4 : 0
        let small = pool.filter { $0 <= 3 }
        if bias > 0 && nextRandom() < bias { return small[min(small.count - 1, Int(nextRandom() * Double(small.count)))] }
        return pool[min(pool.count - 1, Int(nextRandom() * Double(pool.count)))]
    }
    private func freshTile(cell: NativeCell, value: Int) -> NativeTile { tileSequence &+= 1; return NativeTile(id: "native:\(state.generation):\(state.revision):\(cell.column):\(cell.row):die:\(tileSequence)", cell: cell, value: value) }
    private func openLocked(count: Int, avoiding: Int?, events: inout [NativeGameplayEvent]) {
        var locked = state.tiles.filter { $0.locked && !$0.isWild && !$0.pendingRemoval && !$0.resolutionOwned }
        if locked.count > 1 { for index in stride(from:locked.count-1,through:1,by:-1) { locked.swapAt(index,min(index,Int(nextRandom()*Double(index+1)))) } }
        for placeholder in locked.prefix(max(0,count)) {
            state.tiles.removeAll { $0.id == placeholder.id }
            let tile = freshTile(cell:placeholder.cell,value:randomValue(excluding:avoiding)); state.tiles.append(tile)
            events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:tile.value))
        }
    }
    private func createLockedBonus(count: Int, excluding: NativeCell, events: inout [NativeGameplayEvent]) {
        var cells: [NativeCell] = []
        for row in 0..<state.rows { for column in 0..<state.columns {
            let cell = NativeCell(column:column,row:row)
            if cell != excluding && state.tile(at:cell) == nil { cells.append(cell) }
        } }
        if cells.count > 1 { for index in stride(from:cells.count-1,through:1,by:-1) { cells.swapAt(index,min(index,Int(nextRandom()*Double(index+1)))) } }
        for cell in cells.prefix(max(0,count)) {
            var tile = freshTile(cell:cell,value:0); tile.id += ":locked"; tile.locked = true; tile.alpha = 0.20
            state.tiles.append(tile); events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:0))
        }
    }
    private func initialStarDropCount(variant:String?)->Int {
        guard NativeStarDropCountPolicy.usesRandomCount(variant:variant) else{return NativeStarDropCountPolicy.effectiveCount(variant:variant,savedCount:1)}
        // Preserve plain Star's original Source presentation draw boundary. Variant
        // drop counts use this committed reward draw and never reroll during rendering.
        if variant == nil,sourceStarOrbitCountAtPresentationEnabled,sourceMathRandom != nil{return 0}
        return 1+Int(nextRandom()*3)
    }
    /// Star and every registered Star variant share Journey's full spawn coroutine
    /// in Arcade too. Other archetypes retain their existing mode-specific rules.
    private func usesSimpleArcadeWildSpawn(archetype:NativeWildArchetype)->Bool {
        state.mode == .arcade && archetype != .star
    }
    private func spawnDirectWildMerge6(at cell: NativeCell, archetype: NativeWildArchetype, depth: Int, avoiding: Int, starOrbitCount: Int, variant:String?=nil, events: inout [NativeGameplayEvent]) {
        // One captured draw per genuine non-final Mushroom or BLOOB merge.
        let mushroomBonusCount = (variant == "mushroom" || variant == "bloob") ? 4+min(2,max(0,Int(nextRandom()*3))) : nil
        let effectiveOrbitCount:Int
        if archetype == .star,committingDirectWild,let plan=pendingDirectWild,
            let capture=plan.sourceStarOrbitCapture,capture.generation==state.generation {
            effectiveOrbitCount=NativeSpawnRules.sourceStarOrbitCountForSpawn(savedPositions:capture.savedPositions,savedSystem:capture.savedSystem,liveSystem:0)
        } else {effectiveOrbitCount=starOrbitCount}
        if stagedDirectWildAssignments,committingDirectWild,let plan=pendingDirectWild,!plan.isFinal,(archetype == .star || archetype == .juice || archetype == .magnet) {
            beginDirectWildSpawnPhases(plan:plan,depth:depth,avoiding:avoiding,orbitCount:effectiveOrbitCount,mushroomBonusCount:mushroomBonusCount,events:&events)
            return
        }
        let lockedCount = state.tiles.filter { $0.locked && !$0.isWild && !$0.pendingRemoval && !$0.resolutionOwned }.count
        let lockedEmptyCount = state.tiles.filter { $0.locked && $0.value <= 0 && !$0.isWild && !$0.pendingRemoval }.count
        let multiplier = NativeSpawnRules.wildEndgameMultiplier(depth,isWild:true,lockedEmptyCount:lockedEmptyCount,isLastMerge:false)
        let arcadeSimple = mushroomBonusCount == nil && usesSimpleArcadeWildSpawn(archetype:archetype) && archetype != .magnet
        let endgame = lockedCount == 0
        let bonus = NativeSpawnRules.wildBonus(archetype:archetype,isLastMerge:false,isArcadeSimpleWild:arcadeSimple,isFinalWildSnapshot:false,starOrbitCount:effectiveOrbitCount,mushroomBonusCount:mushroomBonusCount)
        // The source creates bonus placeholders while primary-open work yields;
        // freeze its final logical allocation before visual spawning begins.
        let primaryValue = randomValue(excluding:avoiding)
        createLockedBonus(count:bonus.locked,excluding:cell,events:&events)
        let primary = freshTile(cell:cell,value:primaryValue); state.tiles.append(primary)
        events.append(NativeGameplayEvent(.spawned,tileIDs:[primary.id],value:primary.value))
        if mushroomBonusCount == nil && !endgame && !arcadeSimple { openLocked(count:max(0,multiplier-1),avoiding:avoiding,events:&events) }
        if mushroomBonusCount == nil && endgame && !arcadeSimple && archetype == .juice {
            for _ in 0..<2 {
                let available = NativeMagnetRules.emptyCells(state:state,excluding:[cell])
                guard !available.isEmpty else { break }
                let target = available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
                state.removeSourceGridOwner(at:target)
                let extra = freshTile(cell:target,value:randomValue(excluding:avoiding)); state.tiles.append(extra)
                events.append(NativeGameplayEvent(.spawned,tileIDs:[extra.id],value:extra.value))
            }
        }
        if !arcadeSimple { openLocked(count:bonus.active,avoiding:avoiding,events:&events) }
    }
    /// Immutable source drag-origin capture, retained even if a visual grid slot
    /// is temporarily empty. No meter spawn can consume that pointer-owned cell.
    public var sourceMeterDropExcludedCells:Set<NativeCell> {
        guard let drag,drag.generation==state.generation else{return []}
        return [drag.origin]
    }
    private func spawnMeterReward(events: inout [NativeGameplayEvent]) -> Bool {
        guard meterDropAllowed else { return true }
        if state.tutorial?.specialBarDefersReward == true { return true }
        // Existing Source wildSpawnInProgress blocks only another meter spawn;
        // ordinary moves/charge credit remain valid while the first die flies.
        if sourceMeterBlocksAnotherSpawn {return true}
        if stagedMeterDrops && stagedMeterOpen {
            let result=beginMeterOpenFlow();events += result.events;return result.accepted
        }
        if sourceTutorialSubsequentPresentationEnabled,sourceTutorialWildReservation != nil{return false}
        guard rewardPicker != nil || state.tutorial?.waitingForWild == true else { return false }
        let available = NativeMagnetRules.emptyCells(state:state,excluding:sourceMeterDropExcludedCells)
        guard !available.isEmpty else { return false }
        let cell = state.tutorial?.waitingForWild == true ? (NativeTutorialRules.preferredWildCell(state:state) ?? available[min(available.count-1,Int(nextRandom()*Double(available.count)))]) : available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
        let choice = state.tutorial?.waitingForWild == true ? (state.tutorial?.reward ?? NativeWildRewardChoice(.star)) : rewardPicker?(state,nextRandom(),{ self.nextRandom() })
        guard let reward = choice, reward.variant == nil || NativeSpecialDiceRegistry.compatibleVariant(reward.variant!,core:reward.archetype) != nil else { return false }
        state.removeSourceGridOwner(at:cell)
        var tile = freshTile(cell:cell,value:6); tile.archetype = reward.archetype; tile.variant = reward.variant
        if reward.archetype == .star { tile.starOrbitCount = initialStarDropCount(variant:reward.variant) }
        if stagedMeterDrops {
            // Source openAtCell(skipSpawnAnimation:true) creates a hidden die,
            // then consumeWildCharge subtracts exactly one, retaining surplus.
            tile.visible=false;tile.alpha=0
            state.tiles.append(tile);consumeMeterCharge()
            meterDropSequence &+= 1
            let drop=NativeMeterDropReservation(id:"native-meter-drop:\(state.generation):\(meterDropSequence)",
                generation:state.generation,tileID:tile.id,cell:tile.cell,archetype:reward.archetype,variant:reward.variant)
            meterDropReservations[drop.id]=drop
            events.append(NativeGameplayEvent(.meterDropReserved,tileIDs:[tile.id],value:6,archetype:reward.archetype,reason:drop.id,variant:reward.variant))
            return true
        }
        state.tiles.append(tile); consumeMeterCharge(); recordEarnedJourneyDie(archetype:reward.archetype,variant:reward.variant); state.wildSpawnCount += 1
        if state.mode == .journey,state.board==6 {
            state.forestMushroomIntroduced=(state.forestMushroomIntroduced ?? (state.wildSpawnCount>1)) || reward.variant=="mushroom"
        }
        if state.lastWildDropType == reward.archetype { state.wildDropTypeStreak += 1 } else { state.lastWildDropType = reward.archetype; state.wildDropTypeStreak = 1 }
        if state.tutorial?.waitingForWild == true {
            state.tutorial?.waitingForWild = false; state.tutorial?.step = .special; state.tutorial?.wildTileID = tile.id
            state.tutorial?.guidedPair = [tile.id]
        }
        events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:6,archetype:reward.archetype,variant:reward.variant))
        return true
    }

    private func recordEarnedJourneyDie(archetype:NativeWildArchetype,variant:String?) {
        guard state.mode == .journey else{return}
        // A missing receipt on an already-running legacy save stays legacy;
        // creating an empty set there would forget its former first-drop guarantee.
        if state.earnedJourneyDice == nil,state.wildSpawnCount==0 {state.earnedJourneyDice=[]}
        state.earnedJourneyDice?.insert(variant ?? (archetype == .star ? "wild-star":archetype == .juice ? "wild-juice":archetype.rawValue))
    }

    /// This is an explicit Source owner request, never a background/pause hook.
    /// Cleanup receipts still settle the actual travel/entered warmup Promise.
    public func requestMeterDropCancellation(id:String,generation:UInt64,reason:NativeMeterDropCancellation)->NativeMoveResult {
        guard generation==state.generation,var drop=meterDropReservations[id],
              drop.generation==generation,!drop.cancellationRequested,!drop.bookkeepingCommitted else {
            return rejected("stale_meter_drop_cancellation")
        }
        drop.cancellationRequested=true
        if reason == .explicitPendingContinuation {drop.queueCanceled=true;state.wildMeter=0}
        let events=[NativeGameplayEvent(.meterDropCancellationRequested,tileIDs:[drop.tileID],reason:drop.id)]
        if drop.dropCompleted && (!drop.warmupAwaitStarted || drop.warmupCompleted) {
            return retireCanceledMeterDrop(drop,events:events)
        }
        meterDropReservations[id]=drop
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    private func retireCanceledMeterDrop(_ drop:NativeMeterDropReservation,events:[NativeGameplayEvent])->NativeMoveResult {
        // Captured ID/cell ownership: never delete a newer replacement in this slot.
        state.tiles.removeAll{$0.id==drop.tileID}
        meterDropReservations.removeValue(forKey:drop.id)
        var events=events;events.append(NativeGameplayEvent(.meterDropCanceled,tileIDs:[drop.tileID],reason:drop.id))
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }

    /// None of these callbacks is inferred from a generic spawn bounce/input permit.
    public func applyMeterDropReceipt(id:String,generation:UInt64,receipt:NativeMeterDropReceipt)->NativeMoveResult {
        guard generation==state.generation,var drop=meterDropReservations[id],drop.generation==generation else {return rejected("stale_meter_drop_receipt")}
        let index=state.tiles.firstIndex(where:{$0.id==drop.tileID})
        // Accepted destination contact may consume the landed die before the
        // independent wall marker ends. That genuine receipt retires only its
        // ledger; it must never recreate or mutate the consumed/replacement die.
        guard index != nil || receipt == .wallHandoffUnlocked && drop.bookkeepingCommitted else {return rejected("stale_meter_drop_receipt")}
        let kind:NativeGameplayEvent.Kind
        switch receipt {
        case .assetsPrepared:
            guard !drop.assetsPrepared,!drop.dropCompleted else {return rejected("duplicate_meter_drop_prepare")}
            drop.assetsPrepared=true;kind = .meterDropPrepared
        case .revealed:
            guard let index,drop.assetsPrepared,!drop.revealed,!drop.dropCompleted else {return rejected("duplicate_meter_drop_reveal")}
            drop.revealed=true;state.tiles[index].visible=true;state.tiles[index].alpha=1;kind = .meterDropRevealed
        case .impact:
            guard drop.assetsPrepared,drop.revealed,!drop.impactOccurred,!drop.dropCompleted else {return rejected("duplicate_meter_drop_impact")}
            drop.impactOccurred=true;kind = .meterDropImpact
        case .boardFallbackRestored:
            guard let index,drop.assetsPrepared,!drop.landed,!drop.dropCompleted else {return rejected("duplicate_meter_drop_restore")}
            drop.landed=true;drop.handoffLocked=true
            state.tiles[index].visible=true;state.tiles[index].alpha=1;kind = .meterDropLanded
        case .dropPromiseCompleted:
            guard drop.assetsPrepared,drop.landed,!drop.dropCompleted else {return rejected("duplicate_meter_drop_completion")}
            drop.dropCompleted=true
            // Source finally enters an already-selected warmup await ONLY if
            // cancellation wasn't detected when the travel Promise settled.
            drop.warmupAwaitStarted = !drop.cancellationRequested && !drop.warmupCompleted
            kind = .meterDropTravelCompleted
        case .selectedWarmupCompleted:
            guard !drop.warmupCompleted else {return rejected("duplicate_meter_drop_warmup")}
            drop.warmupCompleted=true;kind = .meterDropWarmupCompleted
        case .wallHandoffUnlocked:
            guard drop.landed,drop.handoffLocked else {return rejected("stale_meter_drop_handoff")}
            drop.handoffLocked=false;kind = .meterDropHandoffUnlocked
        }
        var events=[NativeGameplayEvent(kind,tileIDs:[drop.tileID],archetype:drop.archetype,reason:drop.id,variant:drop.variant)]
        // Exact spawnWildFromMeter continuation runs after travel AND selected
        // warmup; Source does not wait for the separate140ms wall input marker.
        if drop.cancellationRequested,drop.dropCompleted,
           !drop.warmupAwaitStarted || drop.warmupCompleted {
            return retireCanceledMeterDrop(drop,events:events)
        }
        if drop.dropCompleted && drop.warmupCompleted && !drop.bookkeepingCommitted {
            drop.bookkeepingCommitted=true;recordEarnedJourneyDie(archetype:drop.archetype,variant:drop.variant);state.wildSpawnCount += 1
            if state.mode == .journey,state.board==6 {
                state.forestMushroomIntroduced=(state.forestMushroomIntroduced ?? (state.wildSpawnCount>1)) || drop.variant=="mushroom"
            }
            if state.lastWildDropType==drop.archetype {state.wildDropTypeStreak += 1}
            else {state.lastWildDropType=drop.archetype;state.wildDropTypeStreak=1}
            if state.tutorial?.waitingForWild==true {
                state.tutorial?.waitingForWild=false;state.tutorial?.step = .special;state.tutorial?.wildTileID=drop.tileID
                state.tutorial?.guidedPair=[drop.tileID]
            }
            events.append(NativeGameplayEvent(.meterDropCompleted,tileIDs:[drop.tileID],archetype:drop.archetype,reason:drop.id,variant:drop.variant))
        }
        meterDropReservations[id]=drop
        if drop.bookkeepingCommitted && !drop.handoffLocked {meterDropReservations.removeValue(forKey:id)}
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }

    private func spawnRegularMerge6(at cell: NativeCell, depth: Int, events: inout [NativeGameplayEvent]) {
        let locked = state.tiles.filter { $0.locked && !$0.isWild && !$0.pendingRemoval && !$0.resolutionOwned }
        if locked.isEmpty {
            let tile = freshTile(cell: cell, value: randomValue()); state.tiles.append(tile)
            events.append(NativeGameplayEvent(.spawned, tileIDs: [tile.id], value: tile.value)); return
        }
        let count = NativeSpawnRules.regularMerge6SpawnCount(depth)
        // Fisher-Yates matches level-flow.ts selection; merge-cell placeholder gets priority.
        let preferred = locked.filter { $0.cell == cell }
        var rest = locked.filter { $0.cell != cell }
        if rest.count > 1 { for index in stride(from: rest.count - 1, through: 1, by: -1) { let choice = min(index, Int(nextRandom() * Double(index + 1))); rest.swapAt(index, choice) } }
        for placeholder in (preferred + rest).prefix(count) {
            state.tiles.removeAll { $0.id == placeholder.id }
            let tile = freshTile(cell: placeholder.cell, value: randomValue()); state.tiles.append(tile)
            events.append(NativeGameplayEvent(.spawned, tileIDs: [tile.id], value: tile.value))
        }
    }
}

public enum NativeRewardMath {
    public static func streakBonus(_ length: Int) -> Int { length < 3 ? 0 : 50 * length + 25 * (length - 3) * (length - 2) / 2 }
    public static func efficiencyBonus(baseBonus: Int, remainingMoves: Int, maxMoves: Int = 50, maxStackDepth: Int = 1) -> Int {
        let bonus = max(0,baseBonus)
        let moves = max(0,min(1,Double(max(0,remainingMoves))/Double(max(1,maxMoves))))
        let stack = max(0,min(1,Double(max(1,maxStackDepth)-1)/3))
        let factor = 0.30 + 0.70 * max(0,min(1,moves*0.6+stack*0.4)) + 4 * moves * moves
        return Int((Double(bonus)*factor).rounded(.toNearestOrAwayFromZero))
    }
    public static func finalScore(currentScore: Int, comboBonus: Int, efficiencyBonus: Int, scoreCap: Int = 999999) -> Int { min(max(0,scoreCap),max(0,currentScore)+max(0,comboBonus)+max(0,efficiencyBonus)) }
}
public enum NativeSpawnRules {
    /// Literal original captured positions → captured system → live system →3.
    /// Counts are live truthy-entry lengths supplied at their genuine callsites.
    public static func sourceStarOrbitCountForSpawn(savedPositions:Int,savedSystem:Int,liveSystem:Int)->Int {
        let count=savedPositions>0 ? savedPositions:savedSystem>0 ? savedSystem:liveSystem>0 ? liveSystem:3
        return max(1,min(3,count))
    }
    public static func regularMerge6SpawnCount(_ multiplier: Int) -> Int { min(3, max(2, multiplier - 1)) }
    public static func shouldSpawnAtDestination(isLastMerge: Bool, isFinalMerge: Bool, multiplier: Int, isEndgameMode: Bool, isArcadeSimpleWild: Bool) -> Bool { !isLastMerge && !isFinalMerge && multiplier > 0 && (isEndgameMode || isArcadeSimpleWild) }
    public static func wildEndgameMultiplier(_ multiplier: Int, isWild: Bool, lockedEmptyCount: Int, isLastMerge: Bool) -> Int { isWild && lockedEmptyCount <= 0 && multiplier > 1 && !isLastMerge ? 1 : multiplier }
    public static func wildBonus(archetype: NativeWildArchetype?, isLastMerge: Bool, isArcadeSimpleWild: Bool, isFinalWildSnapshot: Bool, starOrbitCount: Int = 3,mushroomBonusCount:Int?=nil) -> (locked: Int, active: Int) {
        guard let archetype, !isLastMerge, !isFinalWildSnapshot else { return (0, 0) }
        if (archetype == .juice || archetype == .star),let mushroomBonusCount {
            let count=max(4,min(6,mushroomBonusCount))
            return (3+2*count,count)
        }
        guard !isArcadeSimpleWild else{return (0,0)}
        switch archetype {
        case .juice: return (3, 0)
        case .magnet, .tnt: return (9, 0)
        case .star: let count = max(1, min(3, starOrbitCount == 0 ? 3 : starOrbitCount)); return (3 + 2 * count, count)
        }
    }
}

extension NativeGameplayEngine {
    private func stageOrdinaryStack(source:NativeTile,destination:NativeTile,pointerID:Int,now:Double)->NativeMoveResult {
        specialSequence &+= 1
        let plan=NativeOrdinaryMovePlan(id:"native-stack:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,source:source,destination:destination,startedAt:now,isFinal:false)
        let sourceContextBefore=state
        pendingOrdinaryStack=plan; committingOrdinaryStack=true
        let movesBefore=state.moves
        drag=Drag(id:source.id,pointerID:pointerID,generation:state.generation,revision:state.revision,origin:source.cell)
        let accepted=drop(target:destination.cell,pointerID:pointerID,now:now)
        committingOrdinaryStack=false
        guard accepted.accepted else {pendingOrdinaryStack=nil;return accepted}
        if sourceOrdinaryStackFacesEnabled {
            let receipt=NativeSourceOrdinaryStackFaceReceipt(id:plan.id+":face",ordinaryMoveID:plan.id,generation:plan.generation,sequence:specialSequence,destinationID:destination.id,cell:destination.cell,value:source.value+destination.value,addStack:source.stackDepth)
            sourceOrdinaryStackFaces[receipt.id]=NativeSourceOrdinaryStackFaceEntry(receipt:receipt,before:sourceContextBefore,source:source,destination:destination)
        }
        state.moves=movesBefore
        if stagedSourceNoMoves,let committedDestination=state.tiles.first(where:{$0.id==destination.id}) {
            sourceNoMovesStackContexts[plan.id]=NativeNoMovesStackContext(before:sourceContextBefore,source:source,destination:destination,effectiveSum:committedDestination.value,destinationDepthAfterCommit:committedDestination.stackDepth)
        }
        var carrier=source;carrier.pendingRemoval=true;carrier.resolutionOwned=true;state.tiles.append(carrier)
        noMovesSignature=nil
        let events=accepted.events+[NativeGameplayEvent(.ordinaryStackReserved,tileIDs:[source.id,destination.id],reason:plan.id)]
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Source absorb completion releases the global drop handoff before its awaited postcheck.
    /// Interruption commits the accepted board shape, but does not invent a moves debit.
    public func finishOrdinaryStackAbsorb(receiptID:String,generation:UInt64,interrupted:Bool=false)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinaryStack,plan.id==receiptID,plan.generation==generation else{return rejected("stale_ordinary_stack_absorb")}
        state.tiles.removeAll{$0.id==plan.source.id && $0.pendingRemoval};pendingOrdinaryStack=nil
        var events=[NativeGameplayEvent(.removed,tileIDs:[plan.source.id])]
        if interrupted {sourceNoMovesStackContexts.removeValue(forKey:receiptID)}
        if !interrupted {
            let receipt=NativeOrdinaryPostcheckReceipt(id:plan.id,generation:generation,delayMilliseconds:flags.busyEnding ? 0:100)
            pendingOrdinaryPostchecks.append(receipt)
            events.append(NativeGameplayEvent(.ordinaryPostcheckPrepared,value:receipt.delayMilliseconds,reason:receipt.id))
        }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Runs only after the actual owned wait callback. Current board guards decide
    /// whether this callback continues to moves-- or returns via fail/recovery.
    public func cancelOrdinaryPostcheck(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let index=pendingOrdinaryPostchecks.firstIndex(where:{$0.id==receiptID && $0.generation==generation}) else{return rejected("stale_ordinary_postcheck")}
        pendingOrdinaryPostchecks.remove(at:index);sourceNoMovesStackContexts.removeValue(forKey:receiptID);sourceNoMovesReadyPostchecks.remove(receiptID)
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    public func commitOrdinaryPostcheck(receiptID:String,generation:UInt64)->NativeMoveResult {
        if hasPendingSourceOrdinaryStackFace {return rejected("captured_ordinary_face_pending")}
        guard generation==state.generation,let index=pendingOrdinaryPostchecks.firstIndex(where:{$0.id==receiptID && $0.generation==generation}) else{return rejected("stale_ordinary_postcheck")}
        let receipt=pendingOrdinaryPostchecks.remove(at:index)
        // Source entered this awaited branch before busyEnding changed. Its fresh stuck
        // classifier must still return before moves--; only captured0ms bypasses it.
        var postcheckFlags=flags;postcheckFlags.busyEnding=false
        let sourceResolution=stagedSourceNoMoves ? NativeSourceEndgameChecker.check(state:state,runtime:sourceNoMovesEffectiveTileRuntime,endgameGuard:flags.endgameGuardActive,nonFinalGuard:sourceNonFinalMerge6Guard):NativeGameplayResolver.resolve(state:state,flags:postcheckFlags)
        if stagedSourceNoMoves && receipt.delayMilliseconds>0 {sourceNoMovesReadyPostchecks.insert(receiptID)}
        else {sourceNoMovesStackContexts.removeValue(forKey:receiptID)}
        if receipt.delayMilliseconds == 0 || sourceResolution.kind != .fail {
            state.moves=max(0,state.moves-1)
            if sourceNoMovesCallerPublicationReady,sourceNoMovesCallerAdmission?.kinds.contains(.ordinaryMovesDepleted)==true,state.moves==0 {
                _=prepareSourceNoMovesCaller(ownerID:receiptID,kind:.ordinaryMovesDepleted)
            }
        }
        var events:[NativeGameplayEvent]=[]
        let resolution=settleDeferredFinalMerge(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    private func stageOrdinarySix(source:NativeTile,destination:NativeTile,now:Double,isFinal:Bool)->NativeMoveResult {
        guard pendingOrdinarySix==nil else{return rejected("regular_merge6_handoff")}
        if let ordinarySixPresentationAdmitted,!ordinarySixPresentationAdmitted() {return rejected("native_ordinary_six_presentation_not_ready")}
        var prepared:NativeSourceMergeSixAutoCenterLease?,stageAccepted=false
        defer {if !stageAccepted {prepared?.rejected()}}
        if let hook=sourceMergeSixAutoCenterHook {
            let captured=state,capturedFlags=flags,capturedLocks=locks
            let capturedOpen=pendingMeterOpen,capturedStack=pendingOrdinaryStack,capturedSix=pendingOrdinarySix,capturedSpecial=pendingSpecial,capturedDirect=pendingDirectWild
            guard let lease=hook.prepare(source,destination,state.generation) else{return rejected("source_six_auto_center_not_admitted")}
            prepared=lease
            let admitted=lease.isCurrent()
            guard admitted,drag==nil,sourceMergeSixAutoCenterHook === hook,state==captured,flags==capturedFlags,locks==capturedLocks,
                  pendingMeterOpen==capturedOpen,pendingOrdinaryStack==capturedStack,pendingOrdinarySix==capturedSix,pendingSpecial==capturedSpecial,pendingDirectWild==capturedDirect else{return rejected("source_six_auto_center_reentered")}
        }
        specialSequence &+= 1;state.revision &+= 1
        let plan=NativeOrdinaryMovePlan(id:"native-six:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,source:source,destination:destination,startedAt:now,isFinal:isFinal)
        pendingOrdinarySix=plan;ordinarySixGameplayCommitted=false
        if let i=state.tiles.firstIndex(where:{$0.id==source.id}) {state.tiles[i].pendingRemoval=true;state.tiles[i].resolutionOwned=true}
        if let i=state.tiles.firstIndex(where:{$0.id==destination.id}) {
            state.tiles[i].value=6;state.tiles[i].stackDepth=isFinal ? 1:min(4,source.stackDepth+destination.stackDepth)
            state.tiles[i].merge6CleanupOwned=true;state.tiles[i].nonFinalMerge6 = !isFinal;state.tiles[i].visible = sourceMergeSixAutoCenterHook?.usesSourceDestinationParentState == true ? destination.visible:!isFinal
            if !isFinal,sourceMergeSixAutoCenterHook?.usesSourceDestinationParentState == true {
                // The actual Source prefix claims this exact destination for
                // cleanup/resolution before the main root. Match that producer.
                state.tiles[i].resolutionOwned=true
            }
            if sourceMergeSixAutoCenterHook?.usesSourceDestinationParentState == true {state.tiles[i].alpha=1}
        }
        noMovesSignature=nil
        stageAccepted=true
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.ordinarySixReserved,tileIDs:[source.id,destination.id],value:6,reason:plan.id)],resolution:resolve())
    }
    /// Renderer calls only once every owned spawn/cleanup receipt actually settles.
    public func commitOrdinarySpawnArrival(receiptID:String,generation:UInt64,tileID:String)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,ordinarySixGameplayCommitted,pendingOrdinarySpawns.remove(tileID) != nil else{return rejected("stale_ordinary_spawn_arrival")}
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    public func releaseOrdinarySixHandoff(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,ordinarySixGameplayCommitted,!sourceNoMovesCallerReceipts.values.contains(where:{$0.kind == .mergeMovesDepleted && $0.ownerID==receiptID && $0.generation==generation}),pendingOrdinarySpawns.isEmpty,!ordinarySpawnPreparationPending,pendingOrdinaryAssignments.isEmpty,pendingSourceOrdinaryLockedSettlement==nil,pendingSourceOrdinaryMinimumPhase==nil,pendingSourceOrdinaryEndgameVerification==nil,
              sourceOrdinaryEndgameRecovery.map{$0.complete || $0.cancelled} ?? true,pendingOrdinaryPrimaryArrival==nil else{return rejected("stale_ordinary_six_handoff")}
        if pendingOrdinaryDestinationCleanup != nil {
            guard !state.tiles.contains(where:{$0.id==plan.destination.id && $0.merge6CleanupOwned}) else{return rejected("stale_ordinary_six_handoff")}
            // A primary force-clear already retired this exact old identity. Source
            // hasClaim ignores destroyed dice; its later decorative cleanup is a no-op.
            pendingOrdinaryDestinationCleanup=nil
        }
        pendingOrdinarySix=nil;ordinarySixGameplayCommitted=false
        var events:[NativeGameplayEvent]=[];let resolution=settleDeferredFinalMerge(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    public func commitOrdinarySix(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,!ordinarySixGameplayCommitted,
              state.tiles.contains(where:{$0.id==plan.source.id && $0.pendingRemoval && $0.resolutionOwned}),
              state.tiles.contains(where:{$0.id==plan.destination.id && $0.value==6 && $0.merge6CleanupOwned}) else{return rejected("stale_ordinary_six")}
        let epochCurrent=state.revision==plan.revision
        expireCombo(now:plan.startedAt+0.08)
        let oldCombo=state.combo;state.combo=min(99,state.combo+1)
        state.longestCombo=max(state.longestCombo,state.combo)
        state.earnedComboBonus=min(999999,state.earnedComboBonus+max(0,NativeRewardMath.streakBonus(state.combo)-NativeRewardMath.streakBonus(oldCombo)))
        comboLastMutationTime=plan.startedAt+0.08;comboWindow=2
        state.moves=max(0,state.moves-1);state.cubesCracked += 1
        let depth=plan.source.stackDepth+plan.destination.stackDepth
        state.score=min(999999,state.score+6*depth*max(1,state.combo));state.bestScore=max(state.bestScore,state.score)
        let holdsEndgameDestination=stagedOrdinaryAssignments && !plan.isFinal && epochCurrent && !state.tiles.contains{$0.locked}
        let sourcePreSpawnCaller=sourceNoMovesCallerPublicationReady && sourceNoMovesCallerAdmission?.kinds.contains(.mergeMovesDepleted)==true &&
            !plan.isFinal && epochCurrent && state.moves==0
        let destinationCarrier=state.tiles.first{$0.id==plan.destination.id}
        state.tiles.removeAll{$0.id==plan.source.id || $0.id==plan.destination.id}
        if holdsEndgameDestination || sourcePreSpawnCaller,let destinationCarrier {state.tiles.append(destinationCarrier)}
        ordinarySixGameplayCommitted=true
        var events=[NativeGameplayEvent(.merged,tileIDs:[plan.source.id,plan.destination.id],value:6,reason:plan.id),NativeGameplayEvent(.comboChanged,value:state.combo),NativeGameplayEvent(.removed,tileIDs:holdsEndgameDestination || sourcePreSpawnCaller ? [plan.source.id]:[plan.source.id,plan.destination.id])]
        if holdsEndgameDestination && !sourcePreSpawnCaller {
            pendingOrdinaryDestinationCleanup=NativeOrdinaryPostcheckReceipt(id:plan.id,generation:plan.generation,delayMilliseconds:100)
            events.append(NativeGameplayEvent(.ordinaryDestinationCleanupPrepared,value:100,reason:plan.id))
        }
        advanceTutorialAfterMerge(source:plan.source,destination:plan.destination,events:&events)
        if plan.isFinal {
            let terminal=NativeResolution(.complete,reason:"final_regular_merge6",target:state.mode == .arcade ? "arcade-stage":"journey-board")
            if pendingSpecial != nil || !pendingMeterRewards.isEmpty || !pendingOrdinaryPostchecks.isEmpty {deferredFinalMerge=terminal;return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())}
            resetMeterAfterRound();state.terminal=terminal;events.append(NativeGameplayEvent(.terminal,reason:terminal.reason))
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:terminal)
        }
        if sourcePreSpawnCaller {
            // Literal Source keeps regular dst visible/unlocked under cleanup, adds
            // confirmed non-final meter progress, THEN checks moves before spawn.
            if let index=state.tiles.firstIndex(where:{$0.id==plan.destination.id}) {
                state.tiles[index].locked=false;state.tiles[index].visible=true;state.tiles[index].alpha=1
            }
            state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage:state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
            let caller=prepareSourceNoMovesCaller(ownerID:plan.id,kind:.mergeMovesDepleted)
            sourceNoMovesMergeContinuations[caller.id]=holdsEndgameDestination
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
        }
        // BoardMutationEpochOwner rejects old spawn permits after a newer accepted stack.
        if epochCurrent && stagedOrdinaryAssignments {
            requestSourceOrdinarySixSpawnBegin(plan,events:&events)
            ordinarySpawnPreparationPending=true
            events.append(NativeGameplayEvent(.ordinarySpawnsPrepareRequested,value:50,reason:plan.id))
        } else if epochCurrent {
            spawnRegularMerge6(at:plan.destination.cell,depth:depth,events:&events)
            pendingOrdinarySpawns.formUnion(events.filter{$0.kind == .spawned}.flatMap(\.tileIDs))
        }
        state.wildMeter += arcadeChargeMultiplier * NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage:state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
}


extension NativeGameplayEngine {
    /// Independent source main+100ms cleanup: never remove a fresh owner at the same cell.
    public func commitOrdinaryDestinationCleanup(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let receipt=pendingOrdinaryDestinationCleanup,receipt.id==receiptID,receipt.generation==generation,let plan=pendingOrdinarySix,plan.id==receiptID else{return rejected("stale_ordinary_destination_cleanup")}
        pendingOrdinaryDestinationCleanup=nil
        let owned=state.tiles.contains{$0.id==plan.destination.id && $0.merge6CleanupOwned}
        state.tiles.removeAll{$0.id==plan.destination.id && $0.merge6CleanupOwned}
        return NativeMoveResult(accepted:true,state:state,events:owned ? [NativeGameplayEvent(.removed,tileIDs:[plan.destination.id])]:[],resolution:resolve())
    }
    /// app-core outer 50ms callback: select actual current placeholders only now.
    public func prepareOrdinarySpawns(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,ordinarySixGameplayCommitted,ordinarySpawnPreparationPending else{return rejected("stale_ordinary_spawn_preparation")}
        ordinarySpawnPreparationPending=false
        guard state.revision==plan.revision,state.terminal==nil else{
            // Ordinary primary beforeSpawn owns retirement even when its old spawn permit is stale.
            if state.terminal==nil,state.tiles.contains(where:{$0.id==plan.destination.id && $0.merge6CleanupOwned}) {
                pendingOrdinaryAssignments=[ordinaryAssignment(plan:plan,cell:plan.destination.cell,tileID:nil,kind:.endgamePrimary,delay:0)]
                return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.ordinaryAssignmentsPrepared,tileIDs:pendingOrdinaryAssignments.map(\.id),reason:plan.id)],resolution:resolve())
            }
            return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
        }
        ordinaryAssignmentsSequence=0;ordinaryRequestedOpenings=0;ordinarySuccessfulOpenings=0;ordinaryForcedPass=false;ordinaryForcedCandidates=[]
        let locked=state.tiles.filter{$0.locked}
        sourceOrdinaryMinimumPhaseEligible = !locked.isEmpty
        if locked.isEmpty {
            if sourceOrdinaryEndgameCoroutineEnabled {
                let recovery=NativeWildPrimaryRecoveryOwner(id:plan.id,generation:generation,mode:.endgame)
                sourceOrdinaryEndgameRecovery=recovery;_=recovery.begin()
                if let writer=sourceMandatoryMergeCellMutation,!writer(plan.id,plan.generation,plan.destination.cell,true) {return rejected("source_mandatory_cell_writer_unavailable")}
            }
            pendingOrdinaryAssignments=[ordinaryAssignment(plan:plan,cell:plan.destination.cell,tileID:nil,kind:.endgamePrimary,delay:0)]
        } else {
            let count=NativeSpawnRules.regularMerge6SpawnCount(plan.source.stackDepth+plan.destination.stackDepth)
            ordinaryRequestedOpenings=count
            let preferred=locked.filter{$0.cell==plan.destination.cell}
            var rest=locked.filter{$0.cell != plan.destination.cell}
            if rest.count>1 {for index in stride(from:rest.count-1,through:1,by:-1){rest.swapAt(index,min(index,Int(nextRandom()*Double(index+1))))}}
            let picks=Array((preferred+rest).prefix(count))
            pendingOrdinaryAssignments=picks.enumerated().map{ordinaryAssignment(plan:plan,cell:$0.element.cell,tileID:$0.element.id,kind:.locked,delay:50+100*$0.offset)}
            ordinaryRefillRemaining=max(0,count-picks.count)
        }
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.ordinaryAssignmentsPrepared,tileIDs:pendingOrdinaryAssignments.map(\.id),reason:plan.id)],resolution:resolve())
    }
    private func ordinaryAssignment(plan:NativeOrdinaryMovePlan,cell:NativeCell,tileID:String?,kind:NativeOrdinaryAssignment.Kind,delay:Int)->NativeOrdinaryAssignment {
        ordinaryAssignmentsSequence+=1
        return NativeOrdinaryAssignment(id:"\(plan.id):opening:\(ordinaryAssignmentsSequence)",generation:plan.generation,cell:cell,tileID:tileID,kind:kind,delayMilliseconds:delay)
    }
    /// Values/RNG/input commit at the actual captured opening callback, never at batch reservation.
    public func commitOrdinaryAssignment(receiptID:String,generation:UInt64,assignmentID:String)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,pendingOrdinaryPrimaryArrival==nil,
              let first=pendingOrdinaryAssignments.first,first.id==assignmentID,first.generation==generation else{return rejected("stale_or_out_of_order_ordinary_assignment")}
        if sourceOrdinaryEndgameCoroutineEnabled,first.kind == .endgamePrimary || first.kind == .endgameHardPrimary {
            guard sourceOrdinaryFreshConstructorEnabled,sourceOrdinaryFreshConstructor != nil,
                  sourceOrdinaryFreshConstructorCurrent != nil else{return rejected("source_ordinary_endgame_constructor_not_bound")}
        }
        pendingOrdinaryAssignments.removeFirst()
        let assignmentPrevious=state
        var events:[NativeGameplayEvent]=[]
        // Source primary beforeSpawn retires its captured old destination before epoch permit issuance.
        if (first.kind == .endgamePrimary || first.kind == .endgameHardPrimary),let holder=state.tile(at:first.cell),holder.id==plan.destination.id,holder.merge6CleanupOwned {
            state.tiles.removeAll{$0.id==holder.id}
            events.append(NativeGameplayEvent(.removed,tileIDs:[holder.id]))
        }
        if sourceOrdinaryEndgameCoroutineEnabled,first.kind == .endgamePrimary,
           let old=state.tile(at:first.cell) {
            state.removeSourceGridOwner(at:first.cell)
            events.append(.init(.removed,tileIDs:[old.id]))
        }
        guard state.terminal==nil,state.revision==plan.revision else {
            ordinaryRefillRemaining=0
            if sourceOrdinaryEndgameCoroutineEnabled,sourceOrdinaryEndgameRecovery != nil,
               first.kind == .endgamePrimary || first.kind == .endgameHardPrimary {
                advanceSourceOrdinaryEndgameRecovery(plan:plan,spawned:false,hard:first.kind == .endgameHardPrimary,events:&events)
                return .init(accepted:true,state:state,events:events,resolution:resolve())
            }
            // Literal forceUnlock returns immediately when its commit permit
            // fails; it does not retry later candidates from the captured list.
            if sourceOrdinaryLockedSettlementsEnabled,first.kind == .forcedLocked {ordinaryForcedCandidates=[]}
            if sourceOrdinaryLockedSettlementsEnabled,pendingOrdinaryAssignments.isEmpty,
               first.kind == .locked || first.kind == .forcedLocked || first.kind == .emergencyLocked || first.kind == .emergencyForced {
                prepareSourceOrdinaryLockedSettlement(plan:plan,events:&events)
            }
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
        }
        if first.kind == .locked || first.kind == .forcedLocked || first.kind == .emergencyLocked || first.kind == .emergencyForced {
            if let index=state.tiles.firstIndex(where:{$0.id==first.tileID && $0.locked}) {
                let value=randomValue();state.tiles[index].locked=false;state.tiles[index].value=value;state.tiles[index].stackDepth=1
                state.tiles[index].archetype=nil;state.tiles[index].variant=nil;state.tiles[index].alpha=1;state.tiles[index].visible=true
                // resetTileToNormalState releases registry resolution; TNT's independent bonus reservation survives.
                let reopenedID=state.tiles[index].id
                state.tiles[index].resolutionOwned=pendingSpecial.map{special in special.archetype == .tnt && special.targets.dropFirst(specialImpactIndex).contains{$0.id==reopenedID}} ?? false
                state.tiles[index].magnetOwned=false;state.tiles[index].transientSpawn=false
                events.append(NativeGameplayEvent(.spawned,tileIDs:[state.tiles[index].id],value:value,reason:first.id))
                if first.kind == .emergencyLocked || first.kind == .emergencyForced {sourceOrdinaryMinimumRescueOpened+=1}
                else {ordinarySuccessfulOpenings+=1}
            }
            if pendingOrdinaryAssignments.isEmpty {
                if sourceOrdinaryLockedSettlementsEnabled {
                    prepareSourceOrdinaryLockedSettlement(plan:plan,events:&events)
                } else {finishOrdinaryLockedBatch(plan:plan,events:&events)}
            }
        } else {
            // openAtCellCore refuses a valued/current active holder before drawing a face.
            if first.kind != .endgameHardPrimary,let holder=state.tile(at:first.cell),holder.value>0 || holder.isWild || !holder.locked {
                ordinaryRefillRemaining=0
                return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
            }
            if first.kind == .endgameHardPrimary,sourceOrdinaryEndgameCoroutineEnabled,
               let old=state.tile(at:first.cell) {
                var detached=state.sourceDetachedGridTileIDs ?? [];detached.insert(old.id)
                state.sourceDetachedGridTileIDs=detached
            } else {state.removeSourceGridOwner(at:first.cell)}
            let tile:NativeTile
            if sourceOrdinaryFreshConstructorEnabled {
                guard sourceMathRandom != nil,let construct=sourceOrdinaryFreshConstructor,let constructorCurrent=sourceOrdinaryFreshConstructorCurrent else{return rejected("source_ordinary_constructor_unavailable")}
                var holder=freshTile(cell:first.cell,value:0);holder.locked=true
                state.tiles.append(holder);pendingOrdinaryPrimaryArrival=first
                let receipt=NativeSourceOrdinaryFreshConstructorReceipt(ownerID:plan.id,generation:generation,
                    assignmentID:first.id,tileID:holder.id,cell:first.cell,kind:first.kind,retiredTileIDs:events.filter{$0.kind == .removed}.flatMap(\.tileIDs))
                sourceOrdinaryFreshConstructorReceipt=receipt
                defer {if sourceOrdinaryFreshConstructorReceipt==receipt {sourceOrdinaryFreshConstructorReceipt=nil}}
                func abandonZeroHolder() {
                    guard state.generation==generation,pendingOrdinarySix==plan,pendingOrdinaryPrimaryArrival==first,
                          state.tiles.contains(where:{$0.id==holder.id && $0.value==0 && $0.locked}) else{return}
                    state.tiles.removeAll{$0.id==holder.id};pendingOrdinaryPrimaryArrival=nil;ordinaryRefillRemaining=0
                    sourceOrdinaryEndgameRecovery?.cancelForLifecycle()
                }
                let captured=state
                let accepted=construct(receipt)
                guard sourceOrdinaryFreshConstructorIsCurrent(receipt),state==captured,pendingOrdinarySix==plan else {
                    abandonZeroHolder()
                    return rejected("source_ordinary_constructor_retired")
                }
                guard accepted else {
                    state.tiles.removeAll{$0.id==holder.id};pendingOrdinaryPrimaryArrival=nil;ordinaryRefillRemaining=0
                    if sourceOrdinaryEndgameCoroutineEnabled,sourceOrdinaryEndgameRecovery != nil {
                        advanceSourceOrdinaryEndgameRecovery(plan:plan,spawned:false,hard:first.kind == .endgameHardPrimary,events:&events)
                        return .init(accepted:true,state:state,events:events,resolution:resolve())
                    }
                    return rejected("source_ordinary_constructor_refused")
                }
                guard constructorCurrent(receipt),sourceOrdinaryFreshConstructorIsCurrent(receipt),state==captured else {
                    abandonZeroHolder();return rejected("source_ordinary_constructor_scope_retired")
                }
                let value=randomValue()
                guard constructorCurrent(receipt),sourceOrdinaryFreshConstructorIsCurrent(receipt),state==captured,
                      pendingOrdinarySix==plan,pendingOrdinaryPrimaryArrival==first,
                      let index=state.tiles.firstIndex(where:{$0.id==holder.id}) else {
                    abandonZeroHolder();return rejected("source_ordinary_constructor_value_reentry")
                }
                state.tiles[index].value=value;state.tiles[index].locked=false
                tile=state.tiles[index]
            } else {
                tile=freshTile(cell:first.cell,value:randomValue());state.tiles.append(tile)
                pendingOrdinaryPrimaryArrival=first
            }
            events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:tile.value,reason:first.id))
            if first.kind == .endgameHardPrimary,sourceOrdinaryEndgameCoroutineEnabled {
                pendingOrdinaryPrimaryArrival=nil
                let publication=NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
                let captured=state
                guard let publish=sourceOrdinaryHardPrimaryPublish,publish(publication,assignmentPrevious,first),
                      sourceOrdinaryEndgameCoroutineEnabled,state==captured,pendingOrdinarySix==plan else{return rejected("source_ordinary_hard_publication_retired")}
                events=[]
                advanceSourceOrdinaryEndgameRecovery(plan:plan,spawned:true,hard:true,events:&events)
            }
        }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Source cancelled forceUnlockLockedTiles wait returns the count already opened.
    /// The caller then attempts remainder opens; cancellation is not primary arrival
    /// and cannot award a face, debit a move or retire the captured destination.
    public func cancelOrdinarySpawnWait(receiptID:String,generation:UInt64,assignmentID:String)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,
              pendingOrdinaryPrimaryArrival==nil,let first=pendingOrdinaryAssignments.first,
              first.id==assignmentID,first.generation==generation,first.kind == .forcedLocked,
              first.delayMilliseconds>0 else{return rejected("stale_ordinary_spawn_wait_cancellation")}
        pendingOrdinaryAssignments.removeFirst();ordinaryForcedCandidates=[]
        ordinaryRefillRemaining=max(0,ordinaryRequestedOpenings-ordinarySuccessfulOpenings)
        var events:[NativeGameplayEvent]=[]
        continueOrdinaryRefill(plan:plan,events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Primary/remainder openAtCell Promise completes on its actual bounce or lifecycle interrupt.
    public func finishOrdinaryPrimarySpawn(receiptID:String,generation:UInt64,assignmentID:String,interrupted:Bool=false)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,let slot=pendingOrdinaryPrimaryArrival,slot.id==assignmentID else{return rejected("stale_ordinary_primary_arrival")}
        pendingOrdinaryPrimaryArrival=nil
        var events:[NativeGameplayEvent]=[]
        if sourceOrdinaryEndgameCoroutineEnabled,slot.kind == .endgamePrimary,let recovery=sourceOrdinaryEndgameRecovery {
            if interrupted {recovery.cancelForLifecycle();events.append(.init(.sourceOrdinaryEndgameCoroutineSettled,reason:plan.id))}
            else {advanceSourceOrdinaryEndgameRecovery(plan:plan,spawned:true,hard:false,events:&events)}
        } else if interrupted {ordinaryRefillRemaining=0}else{continueOrdinaryRefill(plan:plan,events:&events)}
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    private func advanceSourceOrdinaryEndgameRecovery(plan:NativeOrdinaryMovePlan,spawned:Bool,hard:Bool,events:inout[NativeGameplayEvent]) {
        guard let recovery=sourceOrdinaryEndgameRecovery,let command=recovery.command else{return}
        let accepted=hard ? recovery.acknowledgeHardFallback(commandID:command.id,generation:plan.generation,spawned:spawned):
            recovery.acknowledgeAwaited(commandID:command.id,generation:plan.generation,spawned:spawned)
        guard accepted else{return}
        publishSourceOrdinaryEndgameRecovery(plan:plan,events:&events)
    }
    private func publishSourceOrdinaryEndgameRecovery(plan:NativeOrdinaryMovePlan,events:inout[NativeGameplayEvent]) {
        guard let recovery=sourceOrdinaryEndgameRecovery else{return}
        if recovery.complete {
            events.append(.init(.sourceOrdinaryEndgameCoroutineSettled,reason:plan.id));return
        }
        guard let command=recovery.command else{return}
        if command.kind == .verifyActive {
            let receipt=SourceOrdinaryEndgameVerificationReceipt(id:UUID(),ownerID:plan.id,generation:plan.generation,commandID:command.id)
            pendingSourceOrdinaryEndgameVerification=receipt
            events.append(.init(.sourceOrdinaryEndgameVerificationPrepared,reason:receipt.id.uuidString))
        } else {
            let receipt=SourceOrdinaryEndgameResumeReceipt(id:UUID(),ownerID:plan.id,generation:plan.generation,commandID:command.id)
            pendingSourceOrdinaryEndgameResume=receipt
            events.append(.init(.sourceOrdinaryEndgameResumePrepared,reason:receipt.id.uuidString))
        }
    }
    public func resumeSourceOrdinaryEndgame(_ receipt:SourceOrdinaryEndgameResumeReceipt)->NativeMoveResult {
        guard sourceOrdinaryEndgameCoroutineEnabled,pendingSourceOrdinaryEndgameResume==receipt,
              state.generation==receipt.generation,let plan=pendingOrdinarySix,plan.id==receipt.ownerID,
              pendingOrdinaryAssignments.isEmpty,pendingOrdinaryPrimaryArrival==nil,
              let command=sourceOrdinaryEndgameRecovery?.command,command.id==receipt.commandID,
              command.kind != .verifyActive else{return rejected("source_ordinary_endgame_resume_retired")}
        pendingSourceOrdinaryEndgameResume=nil
        let kind:NativeOrdinaryAssignment.Kind=command.kind == .hardFallback ? .endgameHardPrimary:.endgamePrimary
        let slot=ordinaryAssignment(plan:plan,cell:plan.destination.cell,tileID:nil,kind:kind,delay:0)
        pendingOrdinaryAssignments=[slot]
        return .init(accepted:true,state:state,events:[.init(.ordinaryAssignmentsPrepared,tileIDs:[slot.id],reason:plan.id)],resolution:resolve())
    }
    /// Physical Source verification borrows only the admitted tile predicate;
    /// it grants no global NO MOVES, save or full final-clean-board permission.
    public func verifySourceOrdinaryEndgamePrimary(_ receipt:SourceOrdinaryEndgameVerificationReceipt)->NativeMoveResult {
        guard sourceOrdinaryEndgameCoroutineEnabled,pendingSourceOrdinaryEndgameVerification==receipt,
              receipt.generation==state.generation,let plan=pendingOrdinarySix,plan.id==receipt.ownerID,
              let recovery=sourceOrdinaryEndgameRecovery,recovery.command?.id==receipt.commandID,
              let authority=sourceOrdinaryMinimumTileAuthority else{return rejected("source_ordinary_endgame_verification_unavailable")}
        let captured=state
        guard authority.isCurrent(),let snapshot=authority.capture(),authority.isCurrent(),state==captured,
              sourceOrdinaryEndgameCoroutineEnabled,sourceOrdinaryMinimumTileAuthority === authority,pendingOrdinarySix==plan,
              sourceOrdinaryEndgameRecovery === recovery,pendingSourceOrdinaryEndgameVerification==receipt,
              snapshot.paint.canonicalState==captured else{return rejected("source_ordinary_endgame_verification_retired")}
        let active=snapshot.paint.paintedState.tiles.contains {tile in
            guard tile.cell==plan.destination.cell,let runtime=snapshot.tiles[tile.id] else{return false}
            return NativeSourceEndgameChecker.active(tile,runtime:runtime)
        }
        guard recovery.acknowledgeVerification(commandID:receipt.commandID,generation:receipt.generation,activeAtReservedCell:active) else {
            return rejected("source_ordinary_endgame_verification_obsolete")
        }
        if active {
            _=sourceMandatoryMergeCellMutation?(plan.id,plan.generation,plan.destination.cell,false)
        }
        pendingSourceOrdinaryEndgameVerification=nil
        var events:[NativeGameplayEvent]=[];publishSourceOrdinaryEndgameRecovery(plan:plan,events:&events)
        return .init(accepted:true,state:state,events:events,resolution:resolve())
    }
    private func prepareSourceOrdinaryLockedSettlement(plan:NativeOrdinaryMovePlan,events:inout [NativeGameplayEvent]) {
        guard pendingSourceOrdinaryLockedSettlement==nil else{return}
        let receipt=SourceOrdinaryLockedSettlement(id:UUID(),ownerID:plan.id,generation:plan.generation)
        pendingSourceOrdinaryLockedSettlement=receipt
        events.append(.init(.sourceOrdinaryLockedSettlementPrepared,reason:receipt.id.uuidString))
    }
    /// Actual awaited locked-helper continuation, acknowledged by the Scene FIFO.
    /// It does not acknowledge the whole spawn coroutine or its finally.
    public func continueSourceOrdinaryLockedSettlement(_ receipt:SourceOrdinaryLockedSettlement)->NativeMoveResult {
        guard sourceOrdinaryLockedSettlementsEnabled,pendingSourceOrdinaryLockedSettlement==receipt,
              state.generation==receipt.generation,let plan=pendingOrdinarySix,plan.id==receipt.ownerID,
              ordinarySixGameplayCommitted,pendingOrdinaryAssignments.isEmpty else{return rejected("stale_source_ordinary_locked_settlement")}
        pendingSourceOrdinaryLockedSettlement=nil
        var events:[NativeGameplayEvent]=[]
        if let stage=sourceOrdinaryMinimumRescueStage {
            if stage==1 && sourceOrdinaryMinimumRescueOpened==0 {
                // Re-read lifecycle after the awaited helper; a previously
                // captured candidate may have been destroyed during its wait.
                guard captureSourceOrdinaryMinimumActiveCount(ownerID:receipt.ownerID,generation:receipt.generation) != nil,
                      state.generation==receipt.generation,pendingOrdinarySix==plan,
                      let runtime=sourceOrdinaryMinimumRuntime else {
                    if state.generation==receipt.generation,pendingOrdinarySix==plan,
                       pendingSourceOrdinaryLockedSettlement==nil {pendingSourceOrdinaryLockedSettlement=receipt}
                    return rejected("source_ordinary_minimum_runtime_missing")
                }
                let locked=state.tiles.filter{$0.locked && runtime[$0.id]?.destroyed == false}
                let candidate=locked.first{$0.cell==plan.destination.cell} ?? locked.first
                if let candidate {
                    sourceOrdinaryMinimumRescueStage=2
                    let slot=ordinaryAssignment(plan:plan,cell:candidate.cell,tileID:candidate.id,kind:.emergencyForced,delay:0)
                    pendingOrdinaryAssignments=[slot]
                    events.append(.init(.ordinaryAssignmentsPrepared,tileIDs:[slot.id],reason:plan.id))
                } else {pendingSourceOrdinaryMinimumPhase=nil;sourceOrdinaryMinimumRescueStage=nil}
            } else {pendingSourceOrdinaryMinimumPhase=nil;sourceOrdinaryMinimumRescueStage=nil}
        } else {finishOrdinaryLockedBatch(plan:plan,events:&events)}
        return .init(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// A real minimum phase must read the current physical lifecycle authority.
    /// Nil refuses the decision; it never manufactures a count or a rescue tile.
    public func captureSourceOrdinaryMinimumActiveCount(ownerID:String,generation:UInt64)->Int? {
        guard sourceOrdinaryLockedSettlementsEnabled,!sourceOrdinaryMinimumReadInProgress,
              state.generation==generation,let plan=pendingOrdinarySix,plan.id==ownerID,
              ordinarySixGameplayCommitted,!ordinarySpawnPreparationPending,
              pendingOrdinaryAssignments.isEmpty,pendingOrdinaryPrimaryArrival==nil,
              pendingSourceOrdinaryLockedSettlement==nil,ordinaryRefillRemaining==0 else{return nil}
        sourceOrdinaryMinimumRuntime=nil
        sourceOrdinaryMinimumReadInProgress=true;defer{sourceOrdinaryMinimumReadInProgress=false}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        let tileAuthority=sourceOrdinaryMinimumTileAuthority,authority=sourceNoMovesRuntimeAuthority
        func owned()->Bool {
            sourceOrdinaryLockedSettlementsEnabled && sourceOrdinaryMinimumTileAuthority === tileAuthority && sourceNoMovesRuntimeAuthority === authority &&
            state==captured && flags==capturedFlags && locks==capturedLocks && pendingOrdinarySix==plan &&
            ordinarySixGameplayCommitted && pendingOrdinaryAssignments.isEmpty && pendingOrdinaryPrimaryArrival==nil &&
            pendingSourceOrdinaryLockedSettlement==nil && ordinaryRefillRemaining==0
        }
        if let tileAuthority {
            guard tileAuthority.isCurrent(),owned(),let snapshot=tileAuthority.capture(),owned(),
                  snapshot.paint.canonicalState==captured,tileAuthority.isCurrent(),owned() else{return nil}
            sourceOrdinaryMinimumRuntime=snapshot.tiles
            return snapshot.paint.paintedState.tiles.filter{tile in
                guard let runtime=snapshot.tiles[tile.id] else{return false}
                return NativeSourceEndgameChecker.active(tile,runtime:runtime)
            }.count
        }
        guard let authority,authority.isCurrent(),owned(),let snapshot=authority.capture(),owned(),snapshot.complete,
              authority.isCurrent(),owned() else{return nil}
        // The physical authority reports painted alpha/visibility; these are
        // Source predicate inputs, not permission to change canonical gameplay.
        var logical=snapshot.state
        for index in logical.tiles.indices {
            guard let canonical=captured.tiles.first(where:{$0.id==logical.tiles[index].id}) else{return nil}
            logical.tiles[index].alpha=canonical.alpha
            logical.tiles[index].visible=canonical.visible
        }
        guard logical==captured else{return nil}
        sourceOrdinaryMinimumRuntime=snapshot.tiles
        return snapshot.state.tiles.filter{tile in
            guard let runtime=snapshot.tiles[tile.id] else{return false}
            return NativeSourceEndgameChecker.active(tile,runtime:runtime)
        }.count
    }
    private func finishOrdinaryLockedBatch(plan:NativeOrdinaryMovePlan,events:inout [NativeGameplayEvent]) {
        if ordinarySuccessfulOpenings==0 && !ordinaryForcedPass {
            // app-core forceUnlockLockedTiles: stable merge-cell priority, no shuffle draw.
            ordinaryForcedPass=true
            let locked=state.tiles.filter{$0.locked}
            ordinaryForcedCandidates=locked.filter{$0.cell==plan.destination.cell}+locked.filter{$0.cell != plan.destination.cell}
        }
        if ordinaryForcedPass && ordinarySuccessfulOpenings<ordinaryRequestedOpenings && !ordinaryForcedCandidates.isEmpty {
            let candidate=ordinaryForcedCandidates.removeFirst()
            let slot=ordinaryAssignment(plan:plan,cell:candidate.cell,tileID:candidate.id,kind:.forcedLocked,delay:ordinarySuccessfulOpenings>0 ? 100:0)
            pendingOrdinaryAssignments=[slot]
            events.append(NativeGameplayEvent(.ordinaryAssignmentsPrepared,tileIDs:[slot.id],reason:plan.id))
            return
        }
        ordinaryRefillRemaining=max(0,ordinaryRequestedOpenings-ordinarySuccessfulOpenings)
        ordinaryForcedCandidates=[]
        continueOrdinaryRefill(plan:plan,events:&events)
    }
    private func requestSourceOrdinaryMinimumPhase(plan:NativeOrdinaryMovePlan,events:inout [NativeGameplayEvent]) {
        guard sourceOrdinaryMinimumPhaseEnabled,sourceOrdinaryLockedSettlementsEnabled,sourceOrdinaryMinimumPhaseEligible,
              pendingSourceOrdinaryMinimumPhase==nil else{return}
        let receipt=SourceOrdinaryMinimumPhaseReceipt(id:UUID(),ownerID:plan.id,generation:plan.generation)
        pendingSourceOrdinaryMinimumPhase=receipt
        events.append(.init(.sourceOrdinaryMinimumPhasePrepared,reason:receipt.id.uuidString))
    }
    /// Starts the literal single emergency locked-open. Empty helpers also
    /// settle through the Source FIFO; zero opened then tries one stable fallback.
    public func prepareSourceOrdinaryMinimumRescue(_ receipt:SourceOrdinaryMinimumPhaseReceipt)->NativeMoveResult {
        guard sourceOrdinaryMinimumPhaseEnabled,pendingSourceOrdinaryMinimumPhase==receipt,
              sourceOrdinaryMinimumRescueStage==nil,
              let count=captureSourceOrdinaryMinimumActiveCount(ownerID:receipt.ownerID,generation:receipt.generation),count<2,
              pendingSourceOrdinaryMinimumPhase==receipt else{return rejected("stale_source_ordinary_minimum_rescue")}
        return prepareSourceOrdinaryMinimumRescueCaptured(receipt)
    }
    /// Scene phase decision reads the physical predicate once, then uses that
    /// same capture for acknowledgement or candidate selection.
    public func advanceSourceOrdinaryMinimumPhase(_ receipt:SourceOrdinaryMinimumPhaseReceipt)->NativeMoveResult {
        guard sourceOrdinaryMinimumPhaseEnabled,pendingSourceOrdinaryMinimumPhase==receipt,
              sourceOrdinaryMinimumRescueStage==nil,
              let count=captureSourceOrdinaryMinimumActiveCount(ownerID:receipt.ownerID,generation:receipt.generation),
              pendingSourceOrdinaryMinimumPhase==receipt else{return rejected("stale_source_ordinary_minimum_phase")}
        if count>=2 {
            pendingSourceOrdinaryMinimumPhase=nil
            return .init(accepted:true,state:state,events:[],resolution:resolve())
        }
        return prepareSourceOrdinaryMinimumRescueCaptured(receipt)
    }
    private func prepareSourceOrdinaryMinimumRescueCaptured(_ receipt:SourceOrdinaryMinimumPhaseReceipt)->NativeMoveResult {
        guard pendingSourceOrdinaryMinimumPhase==receipt,let plan=pendingOrdinarySix,
              let runtime=sourceOrdinaryMinimumRuntime else{return rejected("stale_source_ordinary_minimum_rescue_capture")}
        sourceOrdinaryMinimumRescueStage=1;sourceOrdinaryMinimumRescueOpened=0
        let locked=state.tiles.filter{$0.locked && runtime[$0.id]?.destroyed == false}
        let preferred=locked.filter{$0.cell==plan.destination.cell}
        var rest=locked.filter{$0.cell != plan.destination.cell}
        if rest.count>1 {for i in stride(from:rest.count-1,through:1,by:-1){rest.swapAt(i,min(i,Int(nextRandom()*Double(i+1))))}}
        var events:[NativeGameplayEvent]=[]
        if let candidate=(preferred+rest).first {
            let slot=ordinaryAssignment(plan:plan,cell:candidate.cell,tileID:candidate.id,kind:.emergencyLocked,delay:50)
            pendingOrdinaryAssignments=[slot]
            events.append(.init(.ordinaryAssignmentsPrepared,tileIDs:[slot.id],reason:plan.id))
        } else {
            let helper=SourceOrdinaryLockedSettlement(id:UUID(),ownerID:plan.id,generation:plan.generation)
            pendingSourceOrdinaryLockedSettlement=helper
            events.append(.init(.sourceOrdinaryLockedSettlementPrepared,reason:helper.id.uuidString))
        }
        return .init(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Covered sufficient-count branch only. A deficient count keeps its receipt
    /// for the real emergency helper/fallback producer; it never fakes rescue.
    public func acknowledgeSourceOrdinaryMinimumSatisfied(_ receipt:SourceOrdinaryMinimumPhaseReceipt)->Bool {
        guard sourceOrdinaryMinimumPhaseEnabled,pendingSourceOrdinaryMinimumPhase==receipt,
              let count=captureSourceOrdinaryMinimumActiveCount(ownerID:receipt.ownerID,generation:receipt.generation),
              count>=2,pendingSourceOrdinaryMinimumPhase==receipt else{return false}
        pendingSourceOrdinaryMinimumPhase=nil
        return true
    }
    private func continueOrdinaryRefill(plan:NativeOrdinaryMovePlan,events:inout [NativeGameplayEvent]) {
        guard ordinaryRefillRemaining>0,state.revision==plan.revision,state.terminal==nil else{ordinaryRefillRemaining=0;requestSourceOrdinaryMinimumPhase(plan:plan,events:&events);return}
        ordinaryRefillRemaining-=1
        let cells=NativeMagnetRules.emptyCells(state:state,excluding:[plan.destination.cell])
        guard !cells.isEmpty else{ordinaryRefillRemaining=0;requestSourceOrdinaryMinimumPhase(plan:plan,events:&events);return}
        let cell=cells[min(cells.count-1,Int(nextRandom()*Double(cells.count)))]
        let slot=ordinaryAssignment(plan:plan,cell:cell,tileID:nil,kind:.remainderPrimary,delay:0)
        pendingOrdinaryAssignments.append(slot)
        events.append(NativeGameplayEvent(.ordinaryAssignmentsPrepared,tileIDs:[slot.id],reason:plan.id))
    }
}

extension NativeGameplayEngine {
    private func beginDirectWildSpawnPhases(plan:NativeDirectWildMovePlan,depth:Int,avoiding:Int,orbitCount:Int,mushroomBonusCount:Int?=nil,events:inout [NativeGameplayEvent]) {
        beginWildSpawnPhases(context:.direct(plan),depth:depth,avoiding:avoiding,orbitCount:orbitCount,mushroomBonusCount:mushroomBonusCount,events:&events)
    }
    private func beginWildSpawnPhases(context plan:NativeWildSpawnPhaseContext,depth:Int,avoiding:Int,orbitCount:Int,mushroomBonusCount:Int?=nil,events:inout [NativeGameplayEvent]) {
        wildSpawnContext=plan
        pendingSourceDirectInitialAwait=nil;sourceDirectInitialMath=nil;sourceDirectInitialReady=false
        sourceDirectInitialGuardPass=0;sourceDirectInitialEnqueueReceipt=nil;sourceDirectNormalPreSpawnChecks=0;sourceDirectInitialRefused=false
        sourceDirectEndgamePreSpawnChecks=0;sourceWildEndgamePhysicalGuardChecks=0;sourceWildEndgamePhysicalGuardRefused=false
        sourceWildEndgameActiveVerificationChecks=0
        sourceWildEndgameDelayCallbacks=0
        pendingSourceDirectLockedBonusGuard=nil;sourceDirectLockedBonusContext=nil;sourceDirectLockedBonusPhase=nil
        sourceDirectLockedBonusMath=nil;sourceDirectLockedBonusDispatching=nil;sourceDirectLockedBonusRefused=false;sourceDirectNormalLockedBonusGuardChecks=0
        sourceDirectEndgameLockedBonusGuardChecks=0
        sourceTntInitialGuardPass=0;sourceTntPhysicalPreSpawnChecks=0
        sourceWildExtraFinalGuardChecks=0;sourceWildExtraFinalGuardRefused=false
        sourceTntInitialAwaitReceipt=nil;sourceTntInitialMath=nil;sourceTntInitialReadyReceipt=nil;sourceTntInitialEnqueueReceipt=nil
        if !plan.isDirect {
            sourceTntSpawnBeginAccepted=false;sourceTntSpawnBeginReceipt=nil;sourceTntCoroutineSettled=nil
            pendingSourceTntLockedBonusGuard=nil;sourceTntLockedBonusGuardContext=nil;sourceTntLockedBonusGuardPhase=nil
            sourceTntLockedBonusGuardMath=nil;sourceTntLockedBonusGuardDispatching=nil;sourceTntLockedBonusGuardRefused=false
        }
        let mode:NativeWildSpawnPhaseOwner.Mode=mushroomBonusCount == nil && usesSimpleArcadeWildSpawn(archetype:plan.archetype) ? .arcade:state.tiles.contains{$0.locked} ? .normal:.endgame
        // The original transient dst placeholder exists when the multiplier law is evaluated.
        let emptyCount=state.tiles.filter{$0.locked && $0.value<=0}.count+1
        let count=mushroomBonusCount == nil ? NativeSpawnRules.wildEndgameMultiplier(depth,isWild:true,lockedEmptyCount:emptyCount,isLastMerge:false):1
        let phase=NativeWildSpawnPhaseOwner(id:plan.id,generation:plan.generation,mode:mode,archetype:plan.archetype,spawnCount:count,orbitCount:orbitCount,mushroomBonusCount:mushroomBonusCount,tntOwner:plan.tntOwner,sourceExtraGuardAwaits:sourceWildExtraFinalGuardsEnabled,sourceEndgameGuardAwaits:sourceWildEndgamePhysicalGuardsEnabled)
        directWildPrimaryRecovery=NativeWildPrimaryRecoveryOwner(id:plan.id,generation:plan.generation,mode:mode == .normal ? .normal:.endgame);_=directWildPrimaryRecovery?.begin()
        directWildSpawnPhase=phase;directWildSpawnAvoiding=avoiding;directWildSpawnRevision=state.revision;directWildVisualReleased=false
        wildPhaseScheduledID=nil;wildPhaseOpened=0;wildActionSequence=0;wildRemainderExcluded=[plan.destination.cell]
        if plan.isDirect,let acquire=sourceWildSpawnBegin {
            let receipt=NativeSourceWildSpawnBeginReceipt(ownerID:plan.id,generation:plan.generation)
            sourceWildSpawnBeginReceipt=receipt
            let captured=state
            guard acquire(receipt),state==captured,sourceWildSpawnBeginIsCurrent(receipt),
                  directWildSpawnPhase === phase else{return}
        }
        if !plan.isDirect,let acquire=sourceTntSpawnBegin {
            let receipt=NativeSourceTntSpawnBeginReceipt(ownerID:plan.id,generation:plan.generation)
            sourceTntSpawnBeginReceipt=receipt;sourceTntCoroutineSettled=nil
            let captured=state
            guard acquire(receipt),state==captured,sourceTntSpawnBeginIsCurrent(receipt),directWildSpawnPhase === phase else{return}
            sourceTntSpawnBeginAccepted=true
        }
        _=phase.begin()
        if plan.isDirect,(phase.mode == .normal ? sourceDirectNormalPreSpawnGuardsEnabled:sourceWildEndgamePhysicalGuardsEnabled) {
            guard let receipt=sourceWildSpawnBeginReceipt,sourceWildSpawnBeginIsCurrent(receipt),
                  sourceWildCoroutineResume != nil,let math=sourceMathRandom else{return}
            pendingSourceDirectInitialAwait=receipt;sourceDirectInitialMath=math
            return
        }
        if !plan.isDirect,sourceTntInitialAwaitEnabled {
            guard sourceTntSpawnBeginAccepted,let receipt=sourceTntSpawnBeginReceipt,
                  sourceTntCoroutineResume != nil,let math=sourceMathRandom else {sourceTntSpawnBeginAccepted=false;return}
            sourceTntInitialMath=math;sourceTntInitialAwaitReceipt=receipt
            return
        }
        startWildInitialAssignments(plan:plan,phase:phase,events:&events)
    }
    private func startWildInitialAssignments(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner,events:inout [NativeGameplayEvent]) {
        pumpWildSpawnPhases(events:&events)
        // Source normal primary is synchronous within its resumed coroutine;
        // the actual bounce remains awaited independently.
        if phase.mode == .normal,let action=pendingWildSpawnActions.first,action.delayMilliseconds==0 {
            let result=commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)
            events += result.events
        }
        guard state.generation==plan.generation,currentWildSpawnContext?.id==plan.id,directWildSpawnPhase === phase else{return}
        let bonus=NativeSpawnRules.wildBonus(archetype:plan.archetype,isLastMerge:false,isArcadeSimpleWild:phase.mode == .arcade,isFinalWildSnapshot:false,starOrbitCount:phase.orbitCount,mushroomBonusCount:phase.mushroomBonusCount)
        if plan.isDirect,sourceDirectLockedBonusGuardAdmission(phase),bonus.locked>0 {
            sourceDirectLockedBonusContext=plan;sourceDirectLockedBonusPhase=phase;sourceDirectLockedBonusMath=sourceMathRandom
            guard sourceDirectLockedBonusGuardResume != nil,
                  sourceDirectLockedBonusBlockersPresent(plan:plan,phase:phase) else {
                if sourceDirectLockedBonusContext?.id==plan.id,sourceDirectLockedBonusPhase === phase {sourceDirectLockedBonusRefused=true}
                return
            }
            if phase.mode == .normal {sourceDirectNormalLockedBonusGuardChecks+=1} else {sourceDirectEndgameLockedBonusGuardChecks+=1}
            if !enqueueSourceDirectLockedBonusGuard(plan:plan,stage:.preSpawn),
               sourceDirectLockedBonusContext?.id==plan.id,sourceDirectLockedBonusPhase === phase {sourceDirectLockedBonusRefused=true}
            return
        }
        if !plan.isDirect,sourceTntLockedBonusPhysicalGuardsEnabled,bonus.locked>0 {
            func refuse() {
                if sourceTntLockedBonusPhysicalGuardsEnabled,state.generation==plan.generation,pendingSpecial?.id==plan.id {
                    sourceTntLockedBonusGuardRefused=true
                }
            }
            guard let math=sourceMathRandom,sourceTntLockedBonusGuardResume != nil,
                  pendingSourceTntLockedBonusGuard==nil else {refuse();return}
            sourceTntLockedBonusGuardContext=plan;sourceTntLockedBonusGuardPhase=phase;sourceTntLockedBonusGuardMath=math
            guard sourceTntLockedBonusBlockersPresent(plan:plan,phase:phase) else {refuse();return}
            sourceTntPhysicalPreSpawnChecks+=1
            if !enqueueSourceTntLockedBonusGuard(plan:plan,stage:.preSpawn) {refuse()}
            return
        }
        allocateWildLockedBonus(plan:plan,phase:phase,events:&events)
    }
    private func allocateWildLockedBonus(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner,events:inout [NativeGameplayEvent]) {
        let bonus=NativeSpawnRules.wildBonus(archetype:plan.archetype,isLastMerge:false,isArcadeSimpleWild:phase.mode == .arcade,isFinalWildSnapshot:false,starOrbitCount:phase.orbitCount,mushroomBonusCount:phase.mushroomBonusCount)
        func current()->Bool {
            guard state.generation==plan.generation,state.revision==directWildSpawnRevision else{return false}
            if plan.isDirect,sourceDirectLockedBonusGuardAdmission(phase) {
                return sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase)
            }
            if !plan.isDirect,sourceTntLockedBonusPhysicalGuardsEnabled {
                return sourceTntLockedBonusContextCurrent(plan:plan,phase:phase)
            }
            return currentWildSpawnContext?.id==plan.id && directWildSpawnPhase === phase
        }
        guard current() else{return}
        var empty:[NativeCell]=[]
        for row in 0..<state.rows {for column in 0..<state.columns {let cell=NativeCell(column:column,row:row);if cell != plan.destination.cell && state.tile(at:cell)==nil {empty.append(cell)}}}
        let referenceTiles:[NativeTile]
        if sourceDirectLockedBonusGuardAdmission(phase) || (!plan.isDirect && sourceTntLockedBonusPhysicalGuardsEnabled) {
            // v9 reads the existing Pixi holder, not the constructor's logical
            // alpha. A fresh Source zero-holder can retain model alpha1 while
            // its actual presentation is faint. Borrow the exact current
            // physical roster before allocation consumes any entropy.
            let captured=state,capturedFlags=flags,capturedLocks=locks
            let authority=sourceFinalMergePresenceAuthority
            func observationCurrent()->Bool {
                current() && state==captured && flags==capturedFlags && locks==capturedLocks &&
                    sourceFinalMergePresenceAuthority === authority
            }
            guard let authority,observationCurrent(),authority.isCurrent(),observationCurrent(),
                  let snapshot=authority.capture(),observationCurrent(),snapshot.canonicalState==captured,
                  authority.isCurrent(),observationCurrent() else {
                if state.generation==plan.generation {
                    if plan.isDirect,sourceDirectLockedBonusContext?.id==plan.id {sourceDirectLockedBonusRefused=true}
                    else if !plan.isDirect,sourceTntLockedBonusGuardContext?.id==plan.id {sourceTntLockedBonusGuardRefused=true}
                }
                return
            }
            referenceTiles=snapshot.physicalTiles
        } else {referenceTiles=state.tiles}
        let referenceAlpha=referenceTiles.first{$0.locked && $0.value<=0 && !$0.isWild && $0.alpha.isFinite}?.alpha
        var constructed:[NativeCell:NativeTile]=[:]
        let allocations=NativeWildLockedBonusRules.allocate(count:bonus.locked,emptyCells:empty,referenceAlpha:referenceAlpha,admitted:{current() && self.state.terminal==nil && (self.wildSpawnPermitAdmission?(.bonus) ?? true)},isEmpty:{self.state.tile(at:$0)==nil},random:{self.nextRandom()},construct:{cell,alpha in
            guard let construct=self.sourceWildLockedBonusConstruct else{return true}
            let captured=self.state
            var tile=self.freshTile(cell:cell,value:0);tile.id += ":locked";tile.locked=true;tile.alpha=alpha
            guard construct(tile,plan.generation),self.state==captured,
                  current() else{return false}
            constructed[cell]=tile;self.state.tiles.append(tile)
            return true
        },created:{allocation in
            guard current() else{return}
            var tile=constructed[allocation.cell] ?? freshTile(cell:allocation.cell,value:0)
            if constructed[allocation.cell]==nil {tile.id += ":locked";tile.locked=true;tile.alpha=allocation.alpha}
            if constructed[allocation.cell]==nil {state.tiles.append(tile)}
            let presentation=NativeWildLockedBonusPresentation(tileID:tile.id,transactionID:plan.id,generation:plan.generation,alpha:allocation.alpha,direction:allocation.direction,delayMilliseconds:allocation.delayMilliseconds)
            pendingWildLockedBonusPresentations.append(presentation)
            if let pop=sourceWildLockedBonusPop{_=pop(presentation)}
            events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:0,reason:plan.id+":locked-bonus"))
        },current:current)
        if !allocations.isEmpty {events.append(NativeGameplayEvent(.wildLockedBonusPrepared,tileIDs:pendingWildLockedBonusPresentations.map(\.tileID),reason:plan.id))}
    }
    private func sourceDirectLockedBonusGuardAdmission(_ phase:NativeWildSpawnPhaseOwner)->Bool {
        phase.mode == .normal ? sourceDirectNormalLockedBonusGuardsEnabled:
            phase.mode == .endgame && sourceDirectEndgameLockedBonusGuardsEnabled && sourceWildEndgamePhysicalGuardsEnabled
    }
    private func sourceDirectLockedBonusContextCurrent(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        guard sourceDirectLockedBonusGuardAdmission(phase),!sourceDirectLockedBonusRefused,plan.isDirect,
              !phase.cancelled,state.generation==plan.generation,
              state.revision==directWildSpawnRevision,sourceDirectLockedBonusContext?.id==plan.id,
              sourceDirectLockedBonusPhase === phase,let math=sourceDirectLockedBonusMath,sourceMathRandom === math,
              !flags.busyEnding,state.terminal==nil else{return false}
        // The original outer async helper survives independent primary finally.
        // Only its actual captured settled receipt permits that exact boundary.
        return (pendingDirectWild?.id==plan.id && currentWildSpawnContext?.id==plan.id && directWildSpawnPhase === phase) ||
            (phase.complete && sourceWildCoroutineSettled?.id==plan.id && sourceWildCoroutineSettled?.generation==plan.generation)
    }
    private func sourceDirectLockedBonusBlockersPresent(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        guard sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase),let authority=sourceFinalMergePresenceAuthority else{return false}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {
            sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase) && state==captured && flags==capturedFlags &&
                locks==capturedLocks && sourceFinalMergePresenceAuthority === authority
        }
        guard current(),authority.isCurrent(),current(),let snapshot=authority.capture(),current(),
              snapshot.canonicalState==captured,authority.isCurrent(),current() else{return false}
        // The original false guard also continues for a known zero roster.
        // A positive single-six clean-board path is handled at the FIFO entry.
        return true
    }
    private func enqueueSourceDirectLockedBonusGuard(plan:NativeWildSpawnPhaseContext,stage:NativeSourceDirectLockedBonusGuardReceipt.Stage)->Bool {
        guard let phase=sourceDirectLockedBonusPhase,sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase),
              sourceDirectLockedBonusDispatching==nil,let enqueue=sourceDirectLockedBonusGuardResume else{return false}
        let receipt=NativeSourceDirectLockedBonusGuardReceipt(ownerID:plan.id,generation:plan.generation,stage:stage)
        pendingSourceDirectLockedBonusGuard=receipt;sourceDirectLockedBonusDispatching=receipt
        let accepted=enqueue(receipt)
        if sourceDirectLockedBonusDispatching==receipt {sourceDirectLockedBonusDispatching=nil}
        let admitted=accepted && pendingSourceDirectLockedBonusGuard==receipt && sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase)
        if !admitted {_=retireSourceDirectLockedBonusGuard(receipt)}
        return admitted
    }
    public func sourceDirectLockedBonusGuardIsCurrent(_ receipt:NativeSourceDirectLockedBonusGuardReceipt)->Bool {
        guard pendingSourceDirectLockedBonusGuard==receipt,sourceDirectLockedBonusDispatching != receipt,
              let plan=sourceDirectLockedBonusContext,let phase=sourceDirectLockedBonusPhase else{return false}
        return sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase)
    }
    @discardableResult public func retireSourceDirectLockedBonusGuard(_ receipt:NativeSourceDirectLockedBonusGuardReceipt)->Bool {
        guard pendingSourceDirectLockedBonusGuard==receipt else{return false}
        pendingSourceDirectLockedBonusGuard=nil;sourceDirectLockedBonusContext=nil;sourceDirectLockedBonusPhase=nil
        sourceDirectLockedBonusMath=nil;sourceDirectLockedBonusRefused=true
        if sourceDirectLockedBonusDispatching==receipt {sourceDirectLockedBonusDispatching=nil}
        return true
    }
    public func resumeSourceDirectLockedBonusGuard(_ receipt:NativeSourceDirectLockedBonusGuardReceipt)->NativeMoveResult {
        guard sourceDirectLockedBonusGuardIsCurrent(receipt),let plan=sourceDirectLockedBonusContext,
              let phase=sourceDirectLockedBonusPhase else{return rejected("source_direct_locked_bonus_await_not_current")}
        if receipt.stage == .preSpawn {
            guard sourceDirectLockedBonusBlockersPresent(plan:plan,phase:phase),sourceDirectLockedBonusGuardIsCurrent(receipt) else {
                return rejected("source_direct_locked_bonus_single_guard_unadmitted")
            }
            if phase.mode == .normal {sourceDirectNormalLockedBonusGuardChecks+=1} else {sourceDirectEndgameLockedBonusGuardChecks+=1}
            guard enqueueSourceDirectLockedBonusGuard(plan:plan,stage:.singleMergeSix) else{return rejected("source_direct_locked_bonus_single_await_refused")}
            return .init(accepted:true,state:state,events:[],resolution:resolve())
        }
        pendingSourceDirectLockedBonusGuard=nil // before external constructors/pop
        var events:[NativeGameplayEvent]=[]
        allocateWildLockedBonus(plan:plan,phase:phase,events:&events)
        guard sourceDirectLockedBonusContextCurrent(plan:plan,phase:phase) else {
            if sourceDirectLockedBonusContext?.id==plan.id,sourceDirectLockedBonusPhase === phase {
                sourceDirectLockedBonusContext=nil;sourceDirectLockedBonusPhase=nil;sourceDirectLockedBonusMath=nil
            }
            return rejected("source_direct_locked_bonus_constructor_retired")
        }
        sourceDirectLockedBonusContext=nil;sourceDirectLockedBonusPhase=nil;sourceDirectLockedBonusMath=nil
        return .init(accepted:true,state:state,events:events,resolution:resolve())
    }
    private func sourceTntLockedBonusContextCurrent(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        guard sourceTntLockedBonusPhysicalGuardsEnabled,!sourceTntLockedBonusGuardRefused,!plan.isDirect,let owner=plan.tntOwner,
              state.generation==plan.generation,state.revision==directWildSpawnRevision,
              sourceTntLockedBonusGuardContext?.id==plan.id,sourceTntLockedBonusGuardPhase === phase,
              let math=sourceTntLockedBonusGuardMath,sourceMathRandom === math,
              pendingSpecial?.id==owner.id,pendingSpecial?.generation==owner.generation,
              specialActivationCommitted,!flags.busyEnding,state.terminal==nil else{return false}
        // Source outer bonus can resume after the independent primary finally.
        // Only the real captured settled receipt permits that exact lifecycle.
        return (currentWildSpawnContext?.id==plan.id && directWildSpawnPhase === phase) ||
            (phase.complete && sourceTntCoroutineSettled?.id==plan.id && sourceTntCoroutineSettled?.generation==plan.generation)
    }
    private func sourceTntLockedBonusBlockersPresent(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        guard sourceTntLockedBonusContextCurrent(plan:plan,phase:phase),let owner=plan.tntOwner,
              let authority=sourceFinalMergePresenceAuthority else{return false}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {
            sourceTntLockedBonusContextCurrent(plan:plan,phase:phase) && state==captured && flags==capturedFlags &&
                locks==capturedLocks && sourceFinalMergePresenceAuthority === authority
        }
        guard current(),authority.isCurrent(),current(),let snapshot=authority.capture(),current(),
              snapshot.canonicalState==captured,authority.isCurrent(),current() else{return false}
        // The original false guard also continues for a known zero roster.
        // A positive single-six clean-board path is handled at the FIFO entry.
        return true
    }
    private func enqueueSourceTntLockedBonusGuard(plan:NativeWildSpawnPhaseContext,stage:NativeSourceTntLockedBonusGuardReceipt.Stage)->Bool {
        guard let phase=sourceTntLockedBonusGuardPhase,sourceTntLockedBonusContextCurrent(plan:plan,phase:phase),
              sourceTntLockedBonusGuardDispatching==nil,let enqueue=sourceTntLockedBonusGuardResume else{return false}
        let receipt=NativeSourceTntLockedBonusGuardReceipt(ownerID:plan.id,generation:plan.generation,stage:stage)
        pendingSourceTntLockedBonusGuard=receipt;sourceTntLockedBonusGuardDispatching=receipt
        let accepted=enqueue(receipt)
        if sourceTntLockedBonusGuardDispatching==receipt {sourceTntLockedBonusGuardDispatching=nil}
        let admitted=accepted && pendingSourceTntLockedBonusGuard==receipt && sourceTntLockedBonusContextCurrent(plan:plan,phase:phase)
        if !admitted {_=retireSourceTntLockedBonusGuard(receipt)}
        return admitted
    }
    public func sourceTntLockedBonusGuardIsCurrent(_ receipt:NativeSourceTntLockedBonusGuardReceipt)->Bool {
        guard pendingSourceTntLockedBonusGuard==receipt,sourceTntLockedBonusGuardDispatching != receipt,
              let plan=sourceTntLockedBonusGuardContext,let phase=sourceTntLockedBonusGuardPhase else{return false}
        return sourceTntLockedBonusContextCurrent(plan:plan,phase:phase)
    }
    @discardableResult public func retireSourceTntLockedBonusGuard(_ receipt:NativeSourceTntLockedBonusGuardReceipt)->Bool {
        guard pendingSourceTntLockedBonusGuard==receipt else{return false}
        pendingSourceTntLockedBonusGuard=nil;sourceTntLockedBonusGuardContext=nil;sourceTntLockedBonusGuardPhase=nil
        sourceTntLockedBonusGuardMath=nil
        if sourceTntLockedBonusGuardDispatching==receipt {sourceTntLockedBonusGuardDispatching=nil}
        return true
    }
    public func resumeSourceTntLockedBonusGuard(_ receipt:NativeSourceTntLockedBonusGuardReceipt)->NativeMoveResult {
        guard sourceTntLockedBonusGuardIsCurrent(receipt),let plan=sourceTntLockedBonusGuardContext,
              let phase=sourceTntLockedBonusGuardPhase else{return rejected("source_tnt_locked_bonus_await_not_current")}
        if receipt.stage == .preSpawn {
            guard sourceTntLockedBonusBlockersPresent(plan:plan,phase:phase),sourceTntLockedBonusGuardIsCurrent(receipt) else {
                return rejected("source_tnt_locked_bonus_single_guard_unadmitted")
            }
            sourceTntPhysicalPreSpawnChecks+=1
            guard enqueueSourceTntLockedBonusGuard(plan:plan,stage:.singleMergeSix) else{return rejected("source_tnt_locked_bonus_single_await_refused")}
            return .init(accepted:true,state:state,events:[],resolution:resolve())
        }
        // Remove captured await before constructors/pop callbacks. The outer
        // context alone remains until the exact finite allocation returns.
        pendingSourceTntLockedBonusGuard=nil
        var events:[NativeGameplayEvent]=[]
        allocateWildLockedBonus(plan:plan,phase:phase,events:&events)
        guard sourceTntLockedBonusContextCurrent(plan:plan,phase:phase) else {
            if sourceTntLockedBonusGuardContext?.id==plan.id,sourceTntLockedBonusGuardPhase === phase {
                sourceTntLockedBonusGuardContext=nil;sourceTntLockedBonusGuardPhase=nil;sourceTntLockedBonusGuardMath=nil
            }
            return rejected("source_tnt_locked_bonus_constructor_retired")
        }
        sourceTntLockedBonusGuardContext=nil;sourceTntLockedBonusGuardPhase=nil;sourceTntLockedBonusGuardMath=nil
        return .init(accepted:true,state:state,events:events,resolution:resolve())
    }
    private func captureSourceWildEndgameActiveAtCell(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool? {
        guard sourceWildEndgamePhysicalGuardsEnabled,phase.mode != .normal,
              let authority=sourceFinalMergePresenceAuthority,let math=sourceMathRandom else{return nil}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {
            sourceWildEndgamePhysicalGuardsEnabled && sourceFinalMergePresenceAuthority === authority &&
                state==captured && flags==capturedFlags && locks==capturedLocks && sourceMathRandom === math &&
                directWildSpawnPhase === phase && currentWildSpawnContext?.id==plan.id && state.generation==plan.generation
        }
        guard current(),authority.isCurrent(),current(),let snapshot=authority.capture(),current(),
              snapshot.canonicalState==captured,authority.isCurrent(),current() else{return nil}
        let active=snapshot.physicalTiles.contains {tile in
            guard tile.cell==plan.destination.cell,let runtime=snapshot.runtime[tile.id] else{return false}
            return NativeSourceEndgameChecker.active(tile,runtime:runtime)
        }
        guard current() else{return nil}
        sourceWildEndgameActiveVerificationChecks+=1
        if active {
            sourceFailedPrimary=nil
            _=sourceMandatoryMergeCellMutation?(plan.id,plan.generation,plan.destination.cell,false)
        } else if let owned=sourceOwnedPrimary,owned.ownerID==plan.id,owned.generation==plan.generation,
                  captured.tiles.contains(where:{$0.id==owned.tileID && $0.cell==plan.destination.cell && !$0.pendingRemoval}) &&
                  !(captured.sourceDetachedGridTileIDs?.contains(owned.tileID) ?? false) {
            // A real negative retained physical read grants retirement only to
            // this current Wild producer's exact owned primary. It does not
            // classify detached siblings or a later ordinary replacement.
            sourceFailedPrimary=owned
        }
        return active
    }
    private func retireFailedSourcePrimary(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner,cell:NativeCell)->Bool {
        guard let failed=sourceFailedPrimary,failed.ownerID==plan.id,failed.generation==plan.generation,
              let owned=sourceOwnedPrimary,owned.ownerID==failed.ownerID,owned.generation==failed.generation,owned.tileID==failed.tileID,
              let tile=state.tile(at:cell),tile.id==failed.tileID,cell==plan.destination.cell,
              captureSourceWildEndgameActiveAtCell(plan:plan,phase:phase)==false,
              let retire=sourceWildFailedPrimaryRetire else{return false}
        let captured=state
        guard retire(tile,plan.id,plan.generation),state==captured,currentWildSpawnContext?.id==plan.id,
              directWildSpawnPhase === phase else{return false}
        state.removeSourceGridOwner(at:cell)
        pendingWildSpawnArrivals.removeAll{$0.tileID==tile.id}
        pendingWildSpawnPresentations.removeAll{$0.tileID==tile.id}
        sourceFailedPrimary=nil;sourceOwnedPrimary=nil
        return true
    }
    private func sourceWildExtraPhysicalBlockerPresent(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        sourceWildPhysicalBlockerPresent(plan:plan,phase:phase,admitted:{self.sourceWildExtraFinalGuardsEnabled})
    }
    private func sourceWildPhysicalBlockerPresent(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner,admitted:()->Bool)->Bool {
        guard admitted(),let authority=sourceFinalMergePresenceAuthority,let math=sourceMathRandom else{return false}
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func current()->Bool {
            admitted() && sourceFinalMergePresenceAuthority === authority &&
                state==captured && flags==capturedFlags && locks==capturedLocks && sourceMathRandom === math &&
                directWildSpawnPhase === phase && currentWildSpawnContext?.id==plan.id && state.generation==plan.generation
        }
        guard current(),authority.isCurrent(),current(),let snapshot=authority.capture(),current(),
              snapshot.canonicalState==captured,authority.isCurrent(),current() else{return false}
        // The original false guard also continues for a known zero roster.
        // A positive single-six clean-board path is handled at the FIFO entry.
        return true
    }
    /// A current physical blocker proves the literal first pre-spawn branch
    /// false. Zero blockers still needs immutable final/clean-board authority;
    /// missing authority cannot become false or a Raw fallback.
    private func sourceTntPhysicalBlockersPresent(authority:NativeSourceOrdinaryMinimumTileAuthority,
        plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        let captured=state,capturedFlags=flags,capturedLocks=locks,math=sourceMathRandom
        func current()->Bool {
            state==captured && flags==capturedFlags && locks==capturedLocks && sourceMathRandom === math &&
                sourceWildMinimumTileAuthority === authority && directWildSpawnPhase === phase &&
                currentWildSpawnContext?.id==plan.id && state.generation==plan.generation
        }
        guard current(),authority.isCurrent(),current(),let snapshot=authority.capture(),current(),
              snapshot.paint.canonicalState==captured,authority.isCurrent(),current() else{return false}
        guard plan.tntOwner != nil else{return false}
        return true
    }
    private func captureSourceWildMinimumActiveCount(authority:NativeSourceOrdinaryMinimumTileAuthority,
        phase:NativeWildSpawnPhaseOwner,ownerID:String,generation:UInt64)->Int? {
        let captured=state,capturedFlags=flags,capturedLocks=locks
        func owned()->Bool {
            state==captured && flags==capturedFlags && locks==capturedLocks && state.generation==generation &&
                sourceWildMinimumTileAuthority === authority && directWildSpawnPhase === phase && currentWildSpawnContext?.id==ownerID
        }
        guard owned(),authority.isCurrent(),owned(),let snapshot=authority.capture(),owned(),
              snapshot.paint.canonicalState==captured,authority.isCurrent(),owned() else{return nil}
        return snapshot.paint.paintedState.tiles.filter{tile in
            guard let runtime=snapshot.tiles[tile.id] else{return false}
            return NativeSourceEndgameChecker.active(tile,runtime:runtime)
        }.count
    }
    private func wildAction(phase:NativeWildSpawnPhaseOwner.Command,kind:NativeWildSpawnAction.Kind,cell:NativeCell?,tileID:String?=nil,delay:Int)->NativeWildSpawnAction {
        wildActionSequence+=1
        return NativeWildSpawnAction(id:"\(phase.id):action:\(wildActionSequence)",transactionID:directWildSpawnPhase!.id,generation:phase.generation,phaseID:phase.id,kind:kind,cell:cell,tileID:tileID,delayMilliseconds:delay,sourceLevelFlow:kind == .locked && [.baseLocked,.extraLocked,.remainderFallback,.emergencyLocked].contains(phase.kind))
    }
    /// Owns the live selection boundary; the renderer never derives an opening from a stale snapshot.
    private func pumpWildSpawnPhases(events:inout [NativeGameplayEvent]) {
        sourceWildMinimumCaptureRejected=false
        guard let phase=directWildSpawnPhase,let plan=currentWildSpawnContext else{return}
        for _ in 0..<32 {
            if phase.primaryArrived || phase.complete || phase.cancelled {
                wildSourceResolutionBoundary=(plan.id,plan.generation)
            }
            if phase.complete {settleWildSpawnContinuation();return}
            guard let command=phase.command,pendingWildSpawnActions.isEmpty,wildPhaseScheduledID != command.id else{return}
            // Initial endgame guard executes at its actual delayed entry callback, not
            // while preparing the50ms action. Other source guard boundaries are synchronous.
            if flags.busyEnding,command.kind != .primary,
               phase.acknowledgeTerminalOwnerBoundary(commandID:command.id,generation:state.generation) {continue}
            wildPhaseScheduledID=command.id;wildPhaseOpened=0
            switch command.kind {
            case .extraGuardPre,.extraGuardSingle:
                guard currentSpawnCoroutineResume != nil,sourceWildExtraPhysicalBlockerPresent(plan:plan,phase:phase),
                      directWildSpawnPhase === phase,currentWildSpawnContext?.id==plan.id,
                      phase.acknowledgeExtraGuard(commandID:command.id,generation:plan.generation) else {
                    if state.generation==plan.generation,directWildSpawnPhase === phase {sourceWildExtraFinalGuardRefused=true}
                    return
                }
                sourceWildExtraFinalGuardChecks+=1
                guard continueOrEnqueueWildSpawnPhases(events:&events) else {
                    if state.generation==plan.generation,directWildSpawnPhase === phase {sourceWildExtraFinalGuardRefused=true}
                    return
                }
                return // actual false guard await; never fall through to selection
            case .juiceSafety:_=phase.acknowledgeJuiceSafety(commandID:command.id,generation:state.generation);continue
            case .minimumActive:
                if sourceWildExtraFinalGuardsEnabled,(currentSpawnCoroutineResume==nil || sourceWildMinimumTileAuthority==nil) {
                    sourceWildMinimumCaptureRejected=true;return
                }
                let count:Int
                if let authority=sourceWildMinimumTileAuthority {
                    guard let captured=captureSourceWildMinimumActiveCount(authority:authority,phase:phase,ownerID:plan.id,generation:plan.generation) else {
                        if state.generation==plan.generation,directWildSpawnPhase === phase {
                            sourceWildMinimumCaptureRejected=true;wildPhaseScheduledID=nil
                        }
                        return
                    }
                    count=captured
                } else {count=state.tiles.filter(\.isActive).count}
                _=phase.acknowledgeMinimum(commandID:command.id,generation:state.generation,activeCount:count)
                if sourceWildExtraFinalGuardsEnabled {
                    // ensureMinimumActiveTilesAfterSpawn is async even when
                    // sufficient. Its real await precedes extra/finally work.
                    guard continueOrEnqueueWildSpawnPhases(events:&events) else {
                        if state.generation==plan.generation,directWildSpawnPhase === phase {sourceWildMinimumCaptureRejected=true}
                        return
                    }
                    return
                }
                continue
            case .endgameGuardPre,.endgameGuardSingle,.endgameGuardAfter:
                guard sourceWildEndgamePhysicalGuardsEnabled,currentSpawnCoroutineResume != nil,
                      sourceWildPhysicalBlockerPresent(plan:plan,phase:phase,admitted:{self.sourceWildEndgamePhysicalGuardsEnabled}) else {
                    if state.generation==plan.generation,directWildSpawnPhase === phase {sourceWildEndgamePhysicalGuardRefused=true}
                    return
                }
                sourceWildEndgamePhysicalGuardChecks+=1
                _=phase.acknowledgeEndgameGuard(commandID:command.id,generation:plan.generation)
                guard continueOrEnqueueWildSpawnPhases(events:&events) else {
                    if state.generation==plan.generation,directWildSpawnPhase === phase {sourceWildEndgamePhysicalGuardRefused=true}
                    return
                }
                return
            case .endgameDelay,.remainderWait:
                pendingWildSpawnActions=[wildAction(phase:command,kind:.wait,cell:nil,delay:command.delayMilliseconds)]
            case .primary:
                if phase.mode != .normal,let writer=sourceMandatoryMergeCellMutation,
                    sourceMandatoryMergeCellWrittenOwner?.0 != plan.id || sourceMandatoryMergeCellWrittenOwner?.1 != plan.generation {
                    // Actual post-guard coroutine entry, before openAtCell. Never
                    // write Date while merely staging the delayed phase plan.
                    sourceMandatoryMergeCellWrittenOwner=(plan.id,plan.generation)
                    guard writer(plan.id,plan.generation,plan.destination.cell,true),state.generation==plan.generation,
                        directWildSpawnPhase === phase,currentWildSpawnContext?.id==plan.id else{
                        if sourceMandatoryMergeCellWrittenOwner?.0==plan.id && sourceMandatoryMergeCellWrittenOwner?.1==plan.generation {sourceMandatoryMergeCellWrittenOwner=nil}
                        return
                    }
                }
                guard let recovery=directWildPrimaryRecovery else{return}
                if recovery.complete {
                    _=phase.acknowledgePrimaryReturnedFalse(commandID:command.id,generation:state.generation)
                    directWildPrimaryRecovery=nil;continue
                }
                guard let recoveryCommand=recovery.command else{return}
                if recoveryCommand.kind == .verifyActive {
                    let active:Bool
                    if sourceWildEndgamePhysicalGuardsEnabled,phase.mode != .normal {
                        guard let captured=captureSourceWildEndgameActiveAtCell(plan:plan,phase:phase) else {
                            if state.generation==plan.generation,directWildSpawnPhase === phase {sourceWildEndgamePhysicalGuardRefused=true}
                            return
                        }
                        active=captured
                    } else {active=state.tile(at:plan.destination.cell)?.isActive == true}
                    _=recovery.acknowledgeVerification(commandID:recoveryCommand.id,generation:state.generation,activeAtReservedCell:active)
                    wildPhaseScheduledID=nil;continue
                }
                let hard=recoveryCommand.kind == .hardFallback
                pendingWildSpawnActions=[wildAction(phase:command,kind:hard ? .hardPrimary:.primary,cell:plan.destination.cell,delay:recoveryCommand.attempt==1 && recoveryCommand.kind == .awaitedPrimary ? command.delayMilliseconds:0)]
            case .juiceExtra,.juiceSafetyPrimary,.remainderPrimary:
                let excluded=command.kind == .remainderPrimary ? wildRemainderExcluded:Set([plan.destination.cell])
                let cells=NativeMagnetRules.emptyCells(state:state,excluding:excluded)
                if let cell=cells.isEmpty ? nil:cells[min(cells.count-1,Int(nextRandom()*Double(cells.count)))] {
                    if command.kind == .remainderPrimary {wildRemainderExcluded.insert(cell)}
                    pendingWildSpawnActions=[wildAction(phase:command,kind:.primary,cell:cell,delay:0)]
                } else {
                    if command.kind == .remainderPrimary {_=phase.acknowledgeRemainderAssignment(commandID:command.id,generation:state.generation,arrivalID:nil,hasCell:false)}
                    else {_=phase.acknowledgeExtraPrimary(commandID:command.id,generation:state.generation,arrivalID:nil)}
                    continue
                }
            case .baseLocked,.extraLocked,.remainderFallback,.forcedLocked,.emergencyLocked,.emergencyFallback:
                if command.count<=0 {_=phase.acknowledgeLockedBatch(commandID:command.id,generation:state.generation,openedCount:0);continue}
                var pool=state.tiles.filter{$0.locked && (command.kind == .emergencyFallback || $0.cell != plan.destination.cell)}
                if command.kind != .forcedLocked && command.kind != .emergencyFallback && pool.count>1 {
                    for i in stride(from:pool.count-1,through:1,by:-1) {pool.swapAt(i,min(i,Int(nextRandom()*Double(i+1))))}
                }
                let picks=Array(pool.prefix(command.count))
                if picks.isEmpty {
                    if command.kind == .emergencyFallback {_=phase.acknowledgeEmergencyFallback(commandID:command.id,generation:state.generation)}
                    else {_=phase.acknowledgeLockedBatch(commandID:command.id,generation:state.generation,openedCount:0)}
                    continue
                }
                pendingWildSpawnActions=picks.enumerated().map {wildAction(phase:command,kind:.locked,cell:$0.element.cell,tileID:$0.element.id,delay:(command.kind == .forcedLocked || command.kind == .emergencyFallback ? 0:50)+100*$0.offset)}
            }
            events.append(NativeGameplayEvent(.wildSpawnActionsPrepared,tileIDs:pendingWildSpawnActions.map(\.id),reason:plan.id))
            return
        }
    }
    private func continueOrEnqueueWildSpawnPhases(events:inout [NativeGameplayEvent])->Bool {
        if let enqueue=currentSpawnCoroutineResume {
            guard let plan=currentWildSpawnContext,let phase=directWildSpawnPhase,
                  phase.generation==state.generation,!phase.cancelled else{return false}
            let captured=state
            return enqueue(plan.id,plan.generation) && state==captured &&
                currentWildSpawnContext?.id==plan.id && directWildSpawnPhase === phase
        }
        let generation=state.generation
        pumpWildSpawnPhases(events:&events);return state.generation==generation && !sourceWildMinimumCaptureRejected
    }
    /// App FIFO caller only. A resumed Promise/captured timeout cannot cross
    /// a board/phase replacement, and Source has no synchronous Raw fallback.
    public func resumeSourceWildSpawnCoroutine(transactionID:String,generation:UInt64)->NativeMoveResult {
        if let final=commitSourceLateFinalMergeGuard(ownerID:transactionID,generation:generation) {return final}
        guard currentSpawnCoroutineResume != nil,generation==state.generation,
              currentWildSpawnContext?.id==transactionID,let phase=directWildSpawnPhase,
              phase.generation==generation,!phase.cancelled else{return rejected("stale_source_wild_coroutine_resume")}
        guard !sourceDirectInitialRefused else{return rejected("source_direct_initial_await_retired")}
        guard !sourceDirectLockedBonusRefused else{return rejected("source_direct_locked_bonus_guard_unadmitted")}
        guard !sourceWildEndgamePhysicalGuardRefused else{return rejected("source_wild_endgame_physical_guard_unadmitted")}
        var events:[NativeGameplayEvent]=[]
        if let receipt=pendingSourceDirectInitialAwait {
            guard sourceDirectInitialAwaitCurrent(receipt),sourceDirectInitialReady,
                  sourceDirectInitialEnqueueReceipt==nil,let plan=currentWildSpawnContext else {
                return rejected("source_direct_initial_await_not_released")
            }
            if sourceDirectInitialGuardPass==0,phase.mode == .normal {
                guard sourceWildPhysicalBlockerPresent(plan:plan,phase:phase,admitted:{self.sourceDirectNormalPreSpawnGuardsEnabled}),
                      sourceDirectInitialAwaitCurrent(receipt) else{return rejected("source_direct_normal_pre_spawn_guard_unadmitted")}
                sourceDirectNormalPreSpawnChecks+=1;sourceDirectInitialGuardPass=1
                sourceDirectInitialEnqueueReceipt=receipt
                let accepted=continueOrEnqueueWildSpawnPhases(events:&events)
                if sourceDirectInitialEnqueueReceipt==receipt {sourceDirectInitialEnqueueReceipt=nil}
                guard accepted,sourceDirectInitialAwaitCurrent(receipt),directWildSpawnPhase === phase else {
                    _=retireSourceDirectInitialAwait(receipt)
                    return rejected("source_direct_normal_pre_spawn_resume_refused")
                }
                return .init(accepted:true,state:state,events:events,resolution:resolve())
            }
            _=clearSourceDirectInitialAwait(receipt)
            startWildInitialAssignments(plan:plan,phase:phase,events:&events)
            guard state.generation==generation else{return rejected("stale_source_direct_initial_await")}
            guard !sourceDirectLockedBonusRefused else{return rejected("source_direct_locked_bonus_guard_unadmitted")}
            guard !sourceWildExtraFinalGuardRefused else{return rejected("source_wild_extra_final_guard_unadmitted")}
            guard !sourceWildMinimumCaptureRejected else{return rejected("source_wild_minimum_capture_missing")}
            return .init(accepted:true,state:state,events:events,resolution:resolve())
        }
        if let receipt=sourceTntInitialAwaitReceipt {
            guard sourceTntInitialAwaitEnabled,receipt.ownerID==transactionID,receipt.generation==generation,
                  sourceTntSpawnBeginIsCurrent(receipt),sourceTntInitialReadyReceipt==receipt,
                  sourceTntInitialEnqueueReceipt != receipt,let math=sourceTntInitialMath,sourceMathRandom === math,let plan=currentWildSpawnContext else {
                return rejected("source_tnt_initial_await_not_released")
            }
            if sourceTntPhysicalPreSpawnGuardsEnabled {
                guard !flags.busyEnding,let authority=sourceWildMinimumTileAuthority,
                      sourceTntPhysicalBlockersPresent(authority:authority,plan:plan,phase:phase) else {
                    return rejected("source_tnt_pre_spawn_guard_unadmitted")
                }
                sourceTntPhysicalPreSpawnChecks+=1
                // Actual pre_spawn await resumes first. Normal branch's own
                // wild_normal_before_spawn await is another APP FIFO reaction.
                if sourceTntInitialGuardPass==0,phase.mode == .normal {
                    sourceTntInitialGuardPass=1
                    guard continueOrEnqueueWildSpawnPhases(events:&events) else{return rejected("source_tnt_pre_spawn_resume_refused")}
                    return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
                }
            }
            sourceTntInitialAwaitReceipt=nil;sourceTntInitialMath=nil;sourceTntInitialReadyReceipt=nil
            startWildInitialAssignments(plan:plan,phase:phase,events:&events)
        } else {
            pumpWildSpawnPhases(events:&events)
            if sourceWildEndgamePhysicalGuardsEnabled,phase.mode != .normal,
               let action=pendingWildSpawnActions.first,action.kind == .primary,action.delayMilliseconds==0 {
                let result=commitWildSpawnAction(transactionID:transactionID,generation:generation,actionID:action.id)
                guard result.accepted else{return result}
                events += result.events
            }
        }
        guard state.generation==generation else{return rejected("stale_source_wild_minimum_capture")}
        guard !sourceTntLockedBonusGuardRefused else{return rejected("source_tnt_locked_bonus_guard_unadmitted")}
        guard !sourceWildExtraFinalGuardRefused else{return rejected("source_wild_extra_final_guard_unadmitted")}
        guard !sourceWildMinimumCaptureRejected else{return rejected("source_wild_minimum_capture_missing")}
        guard !sourceWildEndgamePhysicalGuardRefused else{return rejected("source_wild_endgame_physical_guard_unadmitted")}
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    public func commitWildSpawnAction(transactionID:String,generation:UInt64,actionID:String)->NativeMoveResult {
        guard generation==state.generation,let plan=currentWildSpawnContext,plan.id==transactionID,let phase=directWildSpawnPhase,phase.generation==generation,
              let command=phase.command,let action=pendingWildSpawnActions.first,action.id==actionID,action.phaseID==command.id else{return rejected("stale_wild_spawn_action")}
        pendingWildSpawnActions.removeFirst();if pendingWildSpawnActions.isEmpty {wildPhaseScheduledID=nil};var events:[NativeGameplayEvent]=[]
        let current=state.terminal==nil && state.revision==directWildSpawnRevision
        if flags.busyEnding,command.kind == .primary,
           phase.acknowledgeTerminalOwnerBoundary(commandID:command.id,generation:generation) {
            guard continueOrEnqueueWildSpawnPhases(events:&events) else{return rejected("source_wild_coroutine_resume_refused")}
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
        }
        switch action.kind {
        case .wait:
            if command.kind == .endgameDelay {
                guard sourceWildEndgamePhysicalGuardsEnabled,
                      phase.acknowledgeEndgameDelay(commandID:command.id,generation:generation) else{return rejected("source_wild_endgame_delay_unadmitted")}
                sourceWildEndgameDelayCallbacks+=1
                // The actual APP50 callback invokes the async helper synchronously;
                // capture its first guard before yielding the first real await.
                pumpWildSpawnPhases(events:&events)
                guard state.generation==generation,!sourceWildEndgamePhysicalGuardRefused else{return rejected("source_wild_endgame_pre_guard_unadmitted")}
                return .init(accepted:true,state:state,events:events,resolution:resolve())
            }
            _=phase.acknowledgeRemainderWait(commandID:command.id,generation:generation)
        case .locked:
            if current,(wildSpawnPermitAdmission?(.locked) ?? true),let index=state.tiles.firstIndex(where:{$0.id==action.tileID && $0.locked}) {
                let value=randomValue(excluding:directWildSpawnAvoiding)
                state.tiles[index].locked=false;state.tiles[index].value=value;state.tiles[index].stackDepth=1;state.tiles[index].archetype=nil;state.tiles[index].variant=nil
                state.tiles[index].resolutionOwned=false;state.tiles[index].magnetOwned=false;state.tiles[index].alpha=1;state.tiles[index].visible=true;state.tiles[index].transientSpawn=false
                if let commitFace=sourceWildLockedFaceCommit {
                    let captured=state,holder=state.tiles[index]
                    guard commitFace(action,holder),state==captured,
                          currentWildSpawnContext?.id==transactionID,directWildSpawnPhase === phase,
                          phase.command?.id==command.id else {
                        return rejected("source_wild_locked_face_not_committed")
                    }
                }
                wildPhaseOpened+=1;events.append(NativeGameplayEvent(.spawned,tileIDs:[state.tiles[index].id],value:value,reason:action.id))
            }
            if pendingWildSpawnActions.isEmpty {
                if command.kind == .emergencyFallback {_=phase.acknowledgeEmergencyFallback(commandID:command.id,generation:generation)}
                else {_=phase.acknowledgeLockedBatch(commandID:command.id,generation:generation,openedCount:wildPhaseOpened)}
            }
        case .primary:
            // Source evaluates explicit Wild value arguments before its epoch permit check.
            let value=randomValue(excluding:directWildSpawnAvoiding)
            if current,let cell=action.cell,sourceFailedPrimary?.ownerID==plan.id,sourceFailedPrimary?.generation==generation {
                guard retireFailedSourcePrimary(plan:plan,phase:phase,cell:cell) else{return rejected("source_wild_failed_primary_retirement_refused")}
            }
            if current,(wildSpawnPermitAdmission?(.primary) ?? true),let cell=action.cell,state.tile(at:cell).map({$0.locked && $0.value<=0 && !$0.isWild}) ?? true {
                state.removeSourceGridOwner(at:cell);let tile=freshTile(cell:cell,value:value);state.tiles.append(tile)
                if let commitFace=sourceWildPrimaryFaceCommit {
                    let captured=state
                    guard commitFace(action,tile),state==captured,
                          currentWildSpawnContext?.id==transactionID,directWildSpawnPhase === phase,
                          phase.command?.id==command.id else {
                        return rejected("source_wild_primary_face_not_committed")
                    }
                }
                sourceOwnedPrimary=(plan.id,generation,tile.id)
                let arrival=NativeWildSpawnArrival(id:action.id,transactionID:transactionID,generation:generation,tileID:tile.id,cell:cell)
                pendingWildSpawnArrivals.append(arrival)
                switch command.kind {
                case .primary:_=phase.acknowledgePrimaryAssignment(commandID:command.id,generation:generation,arrivalID:arrival.id);_=phase.acknowledgeConsumedIdentitiesRetired(generation:generation)
                case .remainderPrimary:_=phase.acknowledgeRemainderAssignment(commandID:command.id,generation:generation,arrivalID:arrival.id,hasCell:true)
                default:_=phase.acknowledgeExtraPrimary(commandID:command.id,generation:generation,arrivalID:arrival.id)
                }
                events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:value,reason:action.id))
            } else {
                // Recovery of an uncommitted primary must not pretend its receipt settled.
                if command.kind == .primary,let recovery=directWildPrimaryRecovery,let recoveryCommand=recovery.command {_=recovery.acknowledgeAwaited(commandID:recoveryCommand.id,generation:generation,spawned:false)}
                else if command.kind == .remainderPrimary {_=phase.acknowledgeRemainderAssignment(commandID:command.id,generation:generation,arrivalID:nil,hasCell:true)}
                else {_=phase.acknowledgeExtraPrimary(commandID:command.id,generation:generation,arrivalID:nil)}
            }
        case .hardPrimary:
            guard let recovery=directWildPrimaryRecovery,let recoveryCommand=recovery.command else{return rejected("wild_primary_recovery_missing")}
            let allowed=current && (wildSpawnPermitAdmission?(.hardFallback) ?? true)
            var spawned=false
            if allowed,let cell=action.cell,sourceFailedPrimary?.ownerID==plan.id,sourceFailedPrimary?.generation==generation {
                guard retireFailedSourcePrimary(plan:plan,phase:phase,cell:cell) else{return rejected("source_wild_failed_hard_primary_retirement_refused")}
            }
            if allowed,let cell=action.cell,state.tile(at:cell).map({$0.locked && $0.value<=0 && !$0.isWild}) ?? true {
                state.removeSourceGridOwner(at:cell)
                let tile:NativeTile
                if let construct=sourceWildHardPrimaryConstruct {
                    var holder=freshTile(cell:cell,value:0);holder.locked=true;state.tiles.append(holder)
                    let captured=state
                    guard construct(holder,generation),state==captured,currentWildSpawnContext?.id==transactionID,
                          directWildSpawnPhase === phase,phase.command?.id==command.id else{return rejected("source_wild_hard_constructor_refused")}
                    let index=state.tiles.count-1;state.tiles[index].locked=false
                    let beforeValue=state,value=randomValue(excluding:directWildSpawnAvoiding)
                    guard state==beforeValue,currentWildSpawnContext?.id==transactionID,directWildSpawnPhase === phase else{return rejected("source_wild_hard_value_stale")}
                    state.tiles[index].value=value;tile=state.tiles[index]
                    guard let face=sourceWildPrimaryFaceCommit else{return rejected("source_wild_hard_face_missing")}
                    let beforeFace=state
                    guard face(action,tile),state==beforeFace,currentWildSpawnContext?.id==transactionID,
                          directWildSpawnPhase === phase else{return rejected("source_wild_hard_face_refused")}
                } else {
                    let value=randomValue(excluding:directWildSpawnAvoiding);tile=freshTile(cell:cell,value:value);state.tiles.append(tile)
                }
                sourceOwnedPrimary=(plan.id,generation,tile.id)
                let value=tile.value;spawned=true
                if sourceWildEndgamePhysicalGuardsEnabled,phase.mode != .normal {
                    guard let active=captureSourceWildEndgameActiveAtCell(plan:plan,phase:phase) else {
                        return rejected("source_wild_endgame_hard_active_verification_unavailable")
                    }
                    // A retained negative observation is a real Source recovery
                    // branch, not unknown admission and not primary completion.
                    spawned=active
                }
                if spawned {
                    _=phase.acknowledgeConsumedIdentitiesRetired(generation:generation)
                    _=phase.acknowledgeHardPrimary(commandID:command.id,generation:generation)
                    if plan.isDirect,phase.ordinaryInputReleased {locks[plan.id]=true}
                }
                events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:value,reason:action.id))
            }
            _=recovery.acknowledgeHardFallback(commandID:recoveryCommand.id,generation:generation,spawned:spawned)
            if spawned {directWildPrimaryRecovery=nil}
        }
        // The original successful spawnBounce draws its direction after authoritative face
        // assignment, before subsequent bonus/continuation selection. Renderer must reuse it.
        for event in events where command.kind != .emergencyFallback && event.kind == .spawned && (event.value ?? 0)>0 {
            for tileID in event.tileIDs {
                let presentation=NativeWildSpawnPresentation(tileID:tileID,transactionID:plan.id,generation:generation,direction:nextRandom()<0.5 ? 1:-1,sourceLevelFlowReinforcement:[.baseLocked,.extraLocked,.remainderFallback,.emergencyLocked].contains(command.kind))
                guard state.generation==generation,currentWildSpawnContext?.id==transactionID,directWildSpawnPhase === phase else{return rejected("stale_wild_bounce_direction")}
                pendingWildSpawnPresentations.append(presentation)
                if let publish=sourceWildSpawnBouncePublish {
                    let captured=state
                    guard publish(presentation,action.id),state==captured,currentWildSpawnContext?.id==transactionID,
                          directWildSpawnPhase === phase else{return rejected("source_wild_bounce_publication_refused")}
                }
            }
        }
        guard continueOrEnqueueWildSpawnPhases(events:&events) else{return rejected("source_wild_coroutine_resume_refused")}
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    public func finishWildSpawnArrival(transactionID:String,generation:UInt64,arrivalID:String,interrupted:Bool=false)->NativeMoveResult {
        if interrupted, generation==state.generation,let plan=currentWildSpawnContext,plan.id==transactionID,let phase=directWildSpawnPhase,
           pendingWildSpawnArrivals.contains(where:{$0.id==arrivalID && $0.generation==generation}) {
            phase.cancelForLifecycle();wildSourceResolutionBoundary=(plan.id,generation)
            pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];wildPhaseScheduledID=nil
            if currentSpawnCoroutineFinally != nil,
               !publishSourceWildCoroutineFinally(plan:plan,phase:phase) {return rejected("source_wild_cancel_finally_refused")}
            if let retained=sourceRetainedDirectDestination,retained.ownerID==plan.id,
               retained.generation==generation,!retained.endgame {
                let captured=state
                guard sourceRetainedDirectDestinationCleanup?(retained)==true,state==captured,
                      currentWildSpawnContext?.id==plan.id,directWildSpawnPhase === phase else{return rejected("source_wild_cancel_destination_cleanup_refused")}
            }
            // Original primary promise rejection cancels its reservation: no committed primary accounting.
            // Retain all-input ownership until exact-ID lifecycle abort recovery; never manufacture arrival.
            if phase.primaryArrived || !plan.isDirect {
                directWildSpawnPhase=nil;wildSpawnContext=nil
                if plan.isDirect,directWildVisualReleased {locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false}
            }
            return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
        }
        guard generation==state.generation,let plan=currentWildSpawnContext,plan.id==transactionID,let phase=directWildSpawnPhase,
              let index=pendingWildSpawnArrivals.firstIndex(where:{$0.id==arrivalID && $0.generation==generation}) else{return rejected("stale_wild_spawn_arrival")}
        let arrival=pendingWildSpawnArrivals[index]
        if !phase.primaryArrived,let recovery=directWildPrimaryRecovery,let c=recovery.command {
            let active=state.tiles.contains{$0.id==arrival.tileID && $0.cell==arrival.cell && $0.isActive}
            _=recovery.acknowledgeAwaited(commandID:c.id,generation:generation,spawned:active)
            if !active {
                guard phase.revokePrimaryAssignment(arrivalID:arrivalID,generation:generation) else{return rejected("wild_primary_retry_not_owned")}
                pendingWildSpawnArrivals.remove(at:index);wildPhaseScheduledID=nil
                var events:[NativeGameplayEvent]=[];guard continueOrEnqueueWildSpawnPhases(events:&events) else{return rejected("source_wild_coroutine_resume_refused")}
                return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
            }
            if let verify=recovery.command {
                let verified:Bool
                if sourceWildEndgamePhysicalGuardsEnabled,phase.mode != .normal {
                    guard let captured=captureSourceWildEndgameActiveAtCell(plan:plan,phase:phase) else{return rejected("source_wild_endgame_active_snapshot_unavailable")}
                    verified=captured
                } else {verified=true}
                _=recovery.acknowledgeVerification(commandID:verify.id,generation:generation,activeAtReservedCell:verified)
                if !verified {
                    guard phase.revokePrimaryAssignment(arrivalID:arrivalID,generation:generation) else{return rejected("source_wild_endgame_verify_recovery_not_owned")}
                    pendingWildSpawnArrivals.remove(at:index);wildPhaseScheduledID=nil
                    var events:[NativeGameplayEvent]=[]
                    guard continueOrEnqueueWildSpawnPhases(events:&events) else{return rejected("source_wild_coroutine_resume_refused")}
                    return .init(accepted:true,state:state,events:events,resolution:resolve())
                }
            }
            directWildPrimaryRecovery=nil
        }
        guard phase.acknowledgeArrival(arrivalID,generation:generation) else{return rejected("stale_wild_spawn_arrival")}
        pendingWildSpawnArrivals.remove(at:index)
        if plan.isDirect,phase.ordinaryInputReleased {locks[plan.id]=true}
        var events:[NativeGameplayEvent]=[];guard continueOrEnqueueWildSpawnPhases(events:&events) else{return rejected("source_wild_coroutine_resume_refused")}
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Matches explicit source abort-recovery; only captured consumed identities may be retired.
    private func abortUncommittedDirectWildForLifecycle(plan:NativeDirectWildMovePlan) {
        guard plan.generation==state.generation,pendingDirectWild?.id==plan.id,
              let phase=directWildSpawnPhase,(phase.cancelled || phase.complete),!phase.primaryArrived else{return}
        let consumed:Set<String>=[plan.source.id,plan.destination.id]
        state.tiles.removeAll{consumed.contains($0.id)}
        if var detached=state.sourceDetachedGridTileIDs {
            detached.subtract(consumed);state.sourceDetachedGridTileIDs=detached.isEmpty ? nil:detached
        }
        if sourceRetainedDirectDestination?.ownerID==plan.id,sourceRetainedDirectDestination?.generation==plan.generation {sourceRetainedDirectDestination=nil}
        directWildSpawnPhase=nil;wildSpawnContext=nil;pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];wildPhaseScheduledID=nil
        locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false
    }
    /// Literal coroutine settlement, including rejected awaited arrival. This
    /// never manufactures primary accounting or a lifecycle abort receipt.
    private func publishSourceWildCoroutineFinally(plan:NativeWildSpawnPhaseContext,phase:NativeWildSpawnPhaseOwner)->Bool {
        guard let finally=currentSpawnCoroutineFinally,phase.complete || phase.cancelled,
              state.generation==plan.generation,currentWildSpawnContext?.id==plan.id,directWildSpawnPhase === phase,
              (plan.isDirect ? sourceWildCoroutineSettled?.id:sourceTntCoroutineSettled?.id) != plan.id else{return false}
        let captured=state
        if plan.isDirect {sourceWildCoroutineSettled=(plan.id,plan.generation)}
        else {sourceTntCoroutineSettled=(plan.id,plan.generation)}
        return finally(plan.id,plan.generation) && state==captured &&
            currentWildSpawnContext?.id==plan.id && directWildSpawnPhase === phase
    }
    private func settleWildSpawnContinuation() {
        guard directWildSpawnPhase?.complete == true,
              (directWildSpawnPhase?.primaryArrived == true || currentSpawnCoroutineFinally != nil),let plan=currentWildSpawnContext else{return}
        if currentSpawnCoroutineFinally != nil,
           !publishSourceWildCoroutineFinally(plan:plan,phase:directWildSpawnPhase!) {return}
        if let retained=sourceRetainedDirectDestination,retained.ownerID==plan.id,retained.generation==plan.generation,!retained.endgame {
            let captured=state
            guard sourceRetainedDirectDestinationCleanup?(retained)==true,state==captured,currentWildSpawnContext?.id==plan.id else{return}
        }
        directWildSpawnPhase=nil;wildSpawnContext=nil;wildPhaseScheduledID=nil;pendingWildSpawnActions=[]
        if plan.isDirect,directWildVisualReleased {locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false}
    }
}


extension NativeGameplayEngine {
    private var sourceNoMovesEffectiveTileRuntime:[String:NativeNoMovesTileRuntime] {
        var runtime=noMovesTileRuntime
        for drop in meterDropReservations.values {
            var marker=runtime[drop.tileID] ?? .init()
            marker.wildDropping = marker.wildDropping || (drop.assetsPrepared && !drop.landed)
            marker.wildHandoff = marker.wildHandoff || drop.handoffLocked
            runtime[drop.tileID]=marker
        }
        return runtime
    }
    private var sourceNoMovesAuthorityPhaseKey:Int? {
        guard let phase=sourceNoMovesOwner.phase else{return nil}
        switch phase {case .waiting:return 0;case .exiting:return 1;case .awaitingPostLock:return 2}
    }
    private func sourceNoMovesGuard(initial:String,beginning:Bool=false)->NativeNoMovesCandidateOwner.Guard {
        sourceNoMovesLastAuthoritySnapshot=nil
        if let authority=sourceNoMovesRuntimeAuthority {
            var refused=NativeNoMovesCandidateOwner.Guard(initialSignature:initial,currentSignature:sourceGameplaySignature.key)
            refused.freshCheckFailed=true
            guard stagedSourceNoMoves,!sourceNoMovesAuthorityReading else{return refused}
            sourceNoMovesAuthorityReading=true;defer{sourceNoMovesAuthorityReading=false}
            let capturedState=state,capturedFlags=flags,capturedLocks=locks
            let capturedActive=sourceNoMovesOwner.active,capturedConfirmed=sourceNoMovesConfirmed,capturedPhase=sourceNoMovesAuthorityPhaseKey
            func owned()->Bool {
                sourceNoMovesRuntimeAuthority === authority && state==capturedState &&
                flags==capturedFlags && locks==capturedLocks && sourceNoMovesOwner.active==capturedActive &&
                sourceNoMovesConfirmed==capturedConfirmed && sourceNoMovesAuthorityPhaseKey==capturedPhase
            }
            guard owned() else{return refused}
            let current=authority.isCurrent()
            guard current,owned(),stagedSourceNoMoves else{return refused}
            let observation=authority.capture()
            guard owned(),stagedSourceNoMoves else{return refused}
            let stillCurrent=authority.isCurrent()
            guard stillCurrent,owned(),stagedSourceNoMoves,let observation,
                observation.complete,observation.matchesCanonicalState(capturedState) else{return refused}
            sourceNoMovesLastAuthoritySnapshot=observation
            var result=NativeNoMovesCandidateOwner.Guard(initialSignature:beginning ? observation.signature.key:initial,currentSignature:observation.signature.key)
            result.freshEndgameType=observation.freshResult.kind == .fail ? "stuck":observation.freshResult.kind == .complete ? "clean":"continue"
            result.wildContinuation=observation.wildContinuationPending
            result.gameplayTransaction=observation.gameplayTransactionActive
            result.activeDrag=observation.livingDragActive
            result.endgameGuard=observation.endgameGuardActive
            return result
        }

        // Literal forced checker autoClearStaleFlag. An interactive stale spawn
        // marker is retired before fresh classification; no synthetic arrival.
        for index in state.tiles.indices {
            let t=state.tiles[index],r=sourceNoMovesEffectiveTileRuntime[t.id] ?? .init()
            if !r.destroyed && !r.wildHandoff && t.archetype != .juice && t.transientSpawn && !t.locked && (t.value>0 || t.isWild) && t.visible && r.eventMode == .normal {
                state.tiles[index].transientSpawn=false
            }
        }
        let fresh=NativeSourceEndgameChecker.check(state:state,runtime:sourceNoMovesEffectiveTileRuntime,endgameGuard:flags.endgameGuardActive,nonFinalGuard:sourceNonFinalMerge6Guard)
        var result=NativeNoMovesCandidateOwner.Guard(initialSignature:initial,currentSignature:sourceGameplaySignature.key)
        result.freshEndgameType = fresh.kind == .fail ? "stuck" : fresh.kind == .complete ? "clean":"continue"
        result.freshCheckFailed = !state.validationIssues(allowSourceDetachedGridReferences:sourceTutorialSubsequentPresentationEnabled).isEmpty
        result.wildContinuation=sourceMeterSpawnInProgress || (meterDropAllowed && state.wildMeter>=1-0.000001) || flags.wildSpawnInProgress || sourceSaveRuntime.wildSpawnInProgress || sourceWildRetryPending || sourceSaveRuntime.wildDropInProgress
        result.gameplayTransaction=hasPendingSourceOrdinaryStackFace || sourceMeterSpawnInProgress || flags.wildSpawnInProgress || flags.merge6SpawnInProgress || flags.wildMagnetPullInProgress || sourceSaveRuntime.wildSpawnInProgress || sourceSaveRuntime.merge6SpawnInProgress || sourceSaveRuntime.wildMagnetPullInProgress || sourceSaveRuntime.specialTransactionActive || sourceSaveRuntime.regularHandoffActive || pendingOrdinaryStack != nil || pendingOrdinarySix != nil || directWildSpawnPhase != nil || pendingSpecial != nil || (pendingDirectWild != nil && !directWildGameplayCommitted)
        result.activeDrag=drag != nil || sourceSaveRuntime.activeDrag
        result.endgameGuard=flags.endgameGuardActive
        return result
    }
    public func beginSourceNoMovesForOrdinaryPostcheck(receiptID:String,generation:UInt64)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesReadyPostchecks.remove(receiptID) != nil,let context=sourceNoMovesStackContexts.removeValue(forKey:receiptID) else{return .ignored}
        return beginSourceNoMoves(origin:.ordinaryPostcheck(context))
    }
    private var sourceNoMovesCallerPublicationReady:Bool {
        sourceNoMovesCallerReceiptsEnabled && stagedSourceNoMoves && sourceNoMovesRuntimeAuthority != nil &&
            sourceNoMovesCallerAdmission?.generation==state.generation && sourceNoMovesCallerAdmission?.retired==false
    }
    private func prepareSourceNoMovesCaller(ownerID:String,kind:NativeSourceNoMovesCallerReceipt.Kind)->NativeSourceNoMovesCallerReceipt {
        sourceNoMovesCallerSequence &+= 1
        let receipt=NativeSourceNoMovesCallerReceipt(id:"source-nomoves-caller:\(state.generation):\(sourceNoMovesCallerSequence)",ownerID:ownerID,generation:state.generation,sequence:sourceNoMovesCallerSequence,kind:kind,admissionID:sourceNoMovesCallerAdmission!.id)
        sourceNoMovesCallerReceipts[receipt.id]=receipt;return receipt
    }
    public func sourceNoMovesCaller(ownerID:String,generation:UInt64,kind:NativeSourceNoMovesCallerReceipt.Kind)->NativeSourceNoMovesCallerReceipt? {
        guard sourceNoMovesCallerPublicationReady,generation==state.generation else{return nil}
        return pendingSourceNoMovesCallerReceipts.first{$0.ownerID==ownerID && $0.generation==generation && $0.kind==kind}
    }
    public func sourceNoMovesCallerIsCurrent(_ receipt:NativeSourceNoMovesCallerReceipt)->Bool {
        guard !sourceNoMovesCallerRefusals.contains(receipt.id),sourceNoMovesCallerPublicationReady,
            sourceNoMovesCallerAdmission?.id==receipt.admissionID,receipt.generation==state.generation,
            sourceNoMovesCallerReceipts[receipt.id]==receipt else{return false}
        if receipt.isPreDebit {
            guard let pre=sourceOrdinaryPreDebitReceipts[receipt.ownerID],sourceOrdinaryPreDebitIsCurrent(pre) else{return false}
            return sourceNoMovesCallerReceipts[receipt.id]==receipt && sourceNoMovesCallerAdmission?.id==receipt.admissionID
        }
        return sourceNoMovesCallerAdmission?.kinds.contains(receipt.kind)==true
    }
    /// Claim only the real postcheck produced by actual ordinary-main completion.
    /// The Scene supplies actual physical pair/order and all external predicates.
    public func claimSourceOrdinaryPreDebit(ownerID:String,generation:UInt64)->NativeSourceOrdinaryPreDebitReceipt? {
        guard sourceOrdinaryPreDebitEnabled,sourceNoMovesCallerPublicationReady,
            let endpoint=sourceOrdinaryPreDebitAdmission,!endpoint.retired,
            endpoint.generation==generation,generation==state.generation,
            endpoint.callerAdmissionID==sourceNoMovesCallerAdmission?.id,
            sourceOrdinaryPreDebitReceipts[ownerID]==nil,
            pendingOrdinaryPostchecks.contains(where:{$0.id==ownerID && $0.generation==generation}) else{return nil}
        let current=endpoint.isCurrent()
        guard current,sourceOrdinaryPreDebitEnabled,sourceOrdinaryPreDebitAdmission === endpoint,!endpoint.retired,
            sourceNoMovesCallerPublicationReady,endpoint.callerAdmissionID==sourceNoMovesCallerAdmission?.id,
            generation==state.generation,sourceOrdinaryPreDebitReceipts[ownerID]==nil,
            pendingOrdinaryPostchecks.contains(where:{$0.id==ownerID && $0.generation==generation}) else{return nil}
        let receipt=NativeSourceOrdinaryPreDebitReceipt(ownerID:ownerID,generation:generation,admissionID:endpoint.id)
        sourceOrdinaryPreDebitReceipts[ownerID]=receipt;return receipt
    }
    public func sourceOrdinaryPreDebitIsCurrent(_ receipt:NativeSourceOrdinaryPreDebitReceipt)->Bool {
        guard sourceOrdinaryPreDebitEnabled,sourceNoMovesCallerPublicationReady,
            !sourceOrdinaryPreDebitRefused.contains(receipt.ownerID),receipt.generation==state.generation,
            sourceOrdinaryPreDebitReceipts[receipt.ownerID]==receipt,
            let endpoint=sourceOrdinaryPreDebitAdmission,!endpoint.retired,endpoint.id==receipt.admissionID,
            endpoint.callerAdmissionID==sourceNoMovesCallerAdmission?.id,
            pendingOrdinaryPostchecks.contains(where:{$0.id==receipt.ownerID && $0.generation==receipt.generation}) else{return false}
        let current=endpoint.isCurrent()
        return current && sourceOrdinaryPreDebitEnabled && sourceNoMovesCallerPublicationReady &&
            sourceOrdinaryPreDebitAdmission === endpoint && !endpoint.retired &&
            endpoint.callerAdmissionID==sourceNoMovesCallerAdmission?.id && receipt.generation==state.generation &&
            !sourceOrdinaryPreDebitRefused.contains(receipt.ownerID) && sourceOrdinaryPreDebitReceipts[receipt.ownerID]==receipt &&
            pendingOrdinaryPostchecks.contains(where:{$0.id==receipt.ownerID && $0.generation==receipt.generation})
    }
    public func prepareSourceOrdinaryPreDebitNoMoves(_ receipt:NativeSourceOrdinaryPreDebitReceipt,
        trigger:NativeNoMovesCandidateOwner.Trigger)->NativeSourceNoMovesCallerReceipt? {
        guard sourceOrdinaryPreDebitIsCurrent(receipt) else{return nil}
        let kind:NativeSourceNoMovesCallerReceipt.Kind
        switch trigger {
        case .lastTwoRegular:kind = .lastTwoRegular
        case .lastTwoSelf:kind = .lastTwoSelf
        case .lastThreeRegular:kind = .lastThreeRegular
        case .lastThreeSelf:kind = .lastThreeSelf
        case .singleRegular:kind = .singleRegular
        case .postMerge:kind = .postMerge
        default:return nil
        }
        guard !sourceNoMovesCallerReceipts.values.contains(where:{$0.ownerID==receipt.ownerID && $0.isPreDebit}),
            sourceOrdinaryPreDebitReceipts[receipt.ownerID]==receipt,sourceNoMovesCallerPublicationReady else{return nil}
        return prepareSourceNoMovesCaller(ownerID:receipt.ownerID,kind:kind)
    }
    /// No fresh classifier runs here: the genuinely mounted Source coordinator
    /// already executed the literal pre-debit branches against physical owners.
    /// A pending face is retained; completion never invents its physical arrival.
    public func finishSourceOrdinaryPreDebit(_ receipt:NativeSourceOrdinaryPreDebitReceipt,
        outcome:NativeSourceOrdinaryPreDebitOutcome)->NativeMoveResult {
        guard sourceOrdinaryPreDebitIsCurrent(receipt),let index=pendingOrdinaryPostchecks.firstIndex(where:{$0.id==receipt.ownerID && $0.generation==receipt.generation}) else{return rejected("stale_source_ordinary_predebit")}
        sourceOrdinaryPreDebitReceipts.removeValue(forKey:receipt.ownerID)
        pendingOrdinaryPostchecks.remove(at:index);sourceNoMovesStackContexts.removeValue(forKey:receipt.ownerID);sourceNoMovesReadyPostchecks.remove(receipt.ownerID)
        if outcome == .continueToDebit {
            state.moves=max(0,state.moves-1)
            if sourceNoMovesCallerPublicationReady,sourceNoMovesCallerAdmission?.kinds.contains(.ordinaryMovesDepleted)==true,state.moves==0 {
                _=prepareSourceNoMovesCaller(ownerID:receipt.ownerID,kind:.ordinaryMovesDepleted)
            }
        }
        // Source returned/cancelled early branch does NOT schedule a generic
        // observer, repeat debit or fabricate a post-merge save notification.
        if outcome != .continueToDebit {return NativeMoveResult(accepted:true,state:state,events:[],resolution:.init(.wait,reason:"source_ordinary_postcheck_returned"))}
        var events:[NativeGameplayEvent]=[];let resolution=settleDeferredFinalMerge(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    @discardableResult public func refuseSourceOrdinaryPreDebit(_ receipt:NativeSourceOrdinaryPreDebitReceipt)->Bool {
        guard receipt.generation==state.generation,sourceOrdinaryPreDebitReceipts[receipt.ownerID]==receipt else{return false}
        sourceOrdinaryPreDebitRefused.insert(receipt.ownerID);return true
    }
    /// Teardown metadata only; does not debit, finish a face, or invent Source cleanup.
    @discardableResult public func retireSourceOrdinaryPreDebit(_ receipt:NativeSourceOrdinaryPreDebitReceipt)->Bool {
        guard receipt.generation==state.generation,sourceOrdinaryPreDebitReceipts[receipt.ownerID]==receipt else{return false}
        sourceOrdinaryPreDebitReceipts.removeValue(forKey:receipt.ownerID);sourceOrdinaryPreDebitRefused.remove(receipt.ownerID);return true
    }
    /// Actual caller has already run forced context moves0 and tutorial/Wild
    /// policy. Use only its genuine provenance, never mutable moves at delivery.
    public func beginSourceNoMovesFromCaller(_ receipt:NativeSourceNoMovesCallerReceipt)->NativeNoMovesCandidateOwner.Effect {
        guard sourceNoMovesCallerIsCurrent(receipt),sourceNoMovesRuntimeAuthority != nil,
            state.terminal==nil,sourceNoMovesConfirmed==nil,sourceNoMovesOwner.active==nil,
            !flags.busyEnding,!sourceSaveRuntime.busyEnding else{return .ignored}
        let snapshot=sourceNoMovesGuard(initial:sourceGameplaySignature.key,beginning:true)
        guard sourceNoMovesCallerIsCurrent(receipt) else{return .deferred("fresh-check-error")}
        if let block=snapshot.blockReason{return .deferred(block)}
        let trigger=receipt.trigger
        let effect=sourceNoMovesOwner.begin(trigger:trigger,busyEnding:flags.busyEnding || sourceSaveRuntime.busyEnding,guard:snapshot)
        if case .candidate(let plan)=effect {sourceNoMovesGeneration=state.generation;sourceNoMovesCallerPlans[receipt.id]=plan.token}
        return effect
    }
    /// Only actual original continue-merge6 branch resumes replacement work.
    /// NO MOVES/tutorial return must never be translated into this callback.
    public func continueSourceMergeSixAfterNoMovesCaller(_ receipt:NativeSourceNoMovesCallerReceipt)->NativeMoveResult {
        guard sourceNoMovesCallerIsCurrent(receipt),receipt.kind == .mergeMovesDepleted,
            let wasHeld=sourceNoMovesMergeContinuations[receipt.id],
            let plan=pendingOrdinarySix,plan.id==receipt.ownerID,ordinarySixGameplayCommitted,!ordinarySpawnPreparationPending,
            pendingOrdinarySpawns.isEmpty,pendingOrdinaryAssignments.isEmpty else{return rejected("stale_source_six_moves_caller")}
        sourceNoMovesCallerReceipts.removeValue(forKey:receipt.id);sourceNoMovesMergeContinuations.removeValue(forKey:receipt.id)
        let epochCurrent=state.revision==plan.revision,depth=plan.source.stackDepth+plan.destination.stackDepth
        var events:[NativeGameplayEvent]=[]
        if wasHeld {
            pendingOrdinaryDestinationCleanup=NativeOrdinaryPostcheckReceipt(id:plan.id,generation:plan.generation,delayMilliseconds:100)
            events.append(.init(.ordinaryDestinationCleanupPrepared,value:100,reason:plan.id))
        } else {
            state.tiles.removeAll{$0.id==plan.destination.id};events.append(.init(.removed,tileIDs:[plan.destination.id]))
        }
        if epochCurrent && stagedOrdinaryAssignments {
            requestSourceOrdinarySixSpawnBegin(plan,events:&events)
            ordinarySpawnPreparationPending=true;events.append(.init(.ordinarySpawnsPrepareRequested,value:50,reason:plan.id))
        } else if epochCurrent {
            spawnRegularMerge6(at:plan.destination.cell,depth:depth,events:&events)
            pendingOrdinarySpawns.formUnion(events.filter{$0.kind == .spawned}.flatMap(\.tileIDs))
        }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Missing genuine endpoint after acceptance preserves conservative native
    /// ownership/durability until exact recovery/teardown. Never a Source marker.
    @discardableResult public func refuseSourceNoMovesCaller(_ receipt:NativeSourceNoMovesCallerReceipt)->Bool {
        guard sourceNoMovesCallerIsCurrent(receipt) else{return false};sourceNoMovesCallerRefusals.insert(receipt.id);return true
    }
    /// Captured Source return/teardown removes caller metadata only. It cannot
    /// spawn, erase destination, settle native input or award pending HUD debt.
    @discardableResult public func retireSourceNoMovesCaller(_ receipt:NativeSourceNoMovesCallerReceipt)->Bool {
        guard receipt.generation==state.generation,sourceNoMovesCallerReceipts[receipt.id]==receipt else{return false}
        sourceNoMovesCallerReceipts.removeValue(forKey:receipt.id);sourceNoMovesMergeContinuations.removeValue(forKey:receipt.id)
        if let plan=sourceNoMovesCallerPlans.removeValue(forKey:receipt.id),!sourceNoMovesCallerPlans.values.contains(plan) {sourceNoMovesCallerRollbackPlans.remove(plan)}
        sourceNoMovesCallerRefusals.remove(receipt.id);return true
    }
    public func beginSourceNoMoves(origin:NativeNoMovesOrigin,extraWaitMilliseconds:Int=0)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,state.terminal==nil,sourceNoMovesConfirmed==nil else{return .ignored}
        if sourceNoMovesOwner.active != nil || flags.busyEnding || sourceSaveRuntime.busyEnding {return .ignored}
        let snapshot=sourceNoMovesGuard(initial:sourceGameplaySignature.key,beginning:true)
        // Source preflight can defer Wild before candidate allocation.
        if let block=snapshot.blockReason{return .deferred(block)}
        let classifiedState:NativeBoardState,classifiedRuntime:[String:NativeNoMovesTileRuntime]
        if sourceNoMovesRuntimeAuthority != nil {
            guard let physical=sourceNoMovesLastAuthoritySnapshot else{return .deferred("fresh-check-error")}
            classifiedState=physical.state;classifiedRuntime=physical.tiles
        } else {classifiedState=state;classifiedRuntime=sourceNoMovesEffectiveTileRuntime}
        guard let trigger=NativeNoMovesTriggerClassifier.classify(state:classifiedState,origin:origin,runtime:classifiedRuntime) else{return .ignored}
        let effect=sourceNoMovesOwner.begin(trigger:trigger,busyEnding:flags.busyEnding || sourceSaveRuntime.busyEnding,extraWaitMilliseconds:extraWaitMilliseconds,guard:snapshot)
        if case .candidate = effect {sourceNoMovesGeneration=state.generation}
        return effect
    }
    public func deliverSourceNoMovesWait(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64,cancelled:Bool=false)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesGeneration==generation else{return .ignored}
        return applySourceNoMovesEffect(sourceNoMovesOwner.waited(plan:plan,delivery:cancelled ? .cancelled:.elapsed,guard:sourceNoMovesGuard(initial:plan.signature)))
    }
    public func deliverSourceNoMovesTextExit(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64,delivery:NativeNoMovesCandidateOwner.ExitDelivery)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesGeneration==generation else{return .ignored}
        return applySourceNoMovesEffect(sourceNoMovesOwner.exited(plan:plan,delivery:delivery,guard:sourceNoMovesGuard(initial:plan.signature)))
    }
    /// Lock acquisition and the final fresh recheck are one synchronous authority
    /// boundary. A fixture hook can simulate the original post-lock pointer race.
    public func acquireSourceNoMovesLock(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64,afterLock:(()->Void)?=nil)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesGeneration==generation,sourceNoMovesOwner.active==plan,sourceNoMovesOwner.phase == .awaitingPostLock else{return .ignored}
        setInputLock("terminal-no-moves",active:true);flags.busyEnding=true
        afterLock?()
        let effect=applySourceNoMovesEffect(sourceNoMovesOwner.locked(plan:plan,guard:sourceNoMovesGuard(initial:plan.signature)))
        if case .confirmedFinal = effect {
            sourceNoMovesConfirmed=plan
            sourceNoMovesConfirmedResolution=sourceNoMovesRuntimeAuthority == nil ? NativeSourceEndgameChecker.check(state:state,runtime:sourceNoMovesEffectiveTileRuntime):sourceNoMovesLastAuthoritySnapshot?.freshResult
            if let result=sourceNoMovesConfirmedResolution {sourceNoMovesFinalFlowReceipt = .init(generation:generation,planToken:plan.token,resolution:result)}
        }
        return effect
    }
    /// Literal fx.forceCleanupAllStarAnimations at confirmedFailFlow handoff.
    /// Discard only captured outstanding receipts; this is NOT a HUD arrival.
    /// The confirmed plan is the genuine lock receipt, not an elapsed UI claim.
    @discardableResult public func cancelSourceConfirmedFailHUDStars(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64,receiptIDs:[String])->Bool {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesGeneration==generation,
            sourceNoMovesConfirmed==plan,sourceNoMovesFinalCleanupReceipt==nil,flags.busyEnding,state.terminal==nil else{return false}
        let captured=Set(receiptIDs)
        guard pendingHUDStars.filter({captured.contains($0.id)}).allSatisfy({$0.generation==generation}) else{return false}
        pendingHUDStars.removeAll{captured.contains($0.id) && $0.generation==generation}
        return true
    }
    /// Literal showFinalScreen finally AFTER actual modal result/navigation abort.
    /// Board exit/modal mount never calls this. No score/RNG/resolver mutation.
    @discardableResult public func finishSourceNoMovesFinalCleanup(receipt:NativeSourceNoMovesCompletedReceipt)->Bool {
        guard completedSourceNoMovesReceipt==receipt,state.terminal==receipt.resolution,
            let flow=sourceNoMovesFinalFlowReceipt,flow.generation==receipt.generation,flow.planToken==receipt.planToken else{return false}
        return finishSourceConfirmedFinalFlow(receipt:flow)
    }
    /// Actual confirmed-final coroutine abort/action finally, including BEFORE
    /// board exit. The receipt is created only by the genuine confirmed lock.
    @discardableResult public func finishSourceConfirmedFinalFlow(receipt:NativeSourceNoMovesFinalFlowReceipt)->Bool {
        guard stagedSourceNoMoves,receipt.generation==state.generation,
            sourceNoMovesFinalFlowReceipt==receipt,sourceNoMovesFinalCleanupReceipt==nil else{return false}
        sourceNoMovesFinalCleanupReceipt=receipt
        flags.busyEnding=false;setInputLock("terminal-no-moves",active:false)
        return true
    }
    /// Source confirmedFailFlow awaits the real board exit and checks generation.
    /// This receipt does not rerun RNG, mutate moves, or freshly select a failure.
    public func finishSourceNoMovesBoardExit(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64)->NativeMoveResult {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesGeneration==generation,sourceNoMovesConfirmed==plan,sourceNoMovesFinalCleanupReceipt==nil,let result=sourceNoMovesConfirmedResolution,state.terminal==nil else{return rejected("stale_source_no_moves_board_exit")}
        state.terminal=result
        completedSourceNoMovesReceipt = .init(generation:generation,planToken:plan.token,resolution:result)
        sourceNoMovesConfirmed=nil;sourceNoMovesConfirmedResolution=nil;sourceNoMovesGeneration=nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.terminal,reason:result.reason)],resolution:result)
    }
    /// Genuine showFinalScreen invocation, not its eventual board-exit/modal
    /// cleanup. The native owner must prove actual accepted launch; no timer.
    @discardableResult public func finishSourceNoMovesCallerInvocation(planToken:UInt64,generation:UInt64)->Bool {
        guard generation==state.generation,let flow=sourceNoMovesFinalFlowReceipt,
            flow.generation==generation,flow.planToken==planToken,sourceNoMovesConfirmed?.token==planToken,
            sourceNoMovesFinalCleanupReceipt==nil,sourceNoMovesCallerPlans.values.contains(planToken) else{return false}
        completeSourceNoMovesCallerRun(planToken:planToken,generation:generation);return true
    }
    /// Mounted rollback finishes its real nav/text/idle/queue cleanup before the
    /// caller coroutine returns. Core rollback alone cannot fake that receipt.
    @discardableResult public func finishSourceNoMovesCallerRollback(planToken:UInt64,generation:UInt64)->Bool {
        guard generation==state.generation,sourceNoMovesCallerRollbackPlans.remove(planToken) != nil else{return false}
        completeSourceNoMovesCallerRun(planToken:planToken,generation:generation);return true
    }
    private func completeSourceNoMovesCallerRun(planToken:UInt64,generation:UInt64) {
        guard generation==state.generation,let binding=sourceNoMovesCallerCompletionBinding else{return}
        let captured=pendingSourceNoMovesCallerReceipts.filter{sourceNoMovesCallerPlans[$0.id]==planToken && $0.generation==generation && $0.admissionID==binding.admissionID}
        for receipt in captured {
            guard generation==state.generation,sourceNoMovesCallerCompletionBinding === binding,
                sourceNoMovesCallerReceipts[receipt.id]==receipt,sourceNoMovesCallerPlans[receipt.id]==planToken else{return}
            sourceNoMovesCallerPlans.removeValue(forKey:receipt.id) // remove BEFORE external, once
            binding.deliver(receipt)
        }
    }
    private func applySourceNoMovesEffect(_ effect:NativeNoMovesCandidateOwner.Effect)->NativeNoMovesCandidateOwner.Effect {
        if case .rollback(let plan,_,let release)=effect {
            if release {setInputLock("terminal-no-moves",active:false);flags.busyEnding=false}
            sourceNoMovesGeneration=nil
            if sourceNoMovesCallerPlans.values.contains(plan.token) {sourceNoMovesCallerRollbackPlans.insert(plan.token)}
        }
        return effect
    }
}

extension NativeGameplayEngine {
    private var hasSourceMeterLastMerge:Bool {
        // Finality belongs to the captured move while its authored animation is
        // pending, even before the physical destination receives its last marker.
        if pendingDirectWild?.isFinal == true || pendingOrdinarySix?.isFinal == true ||
            deferredFinalMerge != nil || confirmedSourceLateFinalMerge != nil {return true}
        if state.tiles.contains(where:{sourceMeterLastMergeTileIDs.contains($0.id) && !(noMovesTileRuntime[$0.id]?.destroyed ?? false)}) {return true}
        let runtime=sourceNoMovesEffectiveTileRuntime
        let active=state.tiles.filter{NativeSourceEndgameChecker.active($0,runtime:runtime[$0.id] ?? .init())}
        return active.count==1 && active[0].value==6
    }
    /// Literal spawnWildFromMeter closure. A completed native reservation may
    /// already be retired when Source startLandedIdle's finally fallback runs.
    /// Absence of a drop never substitutes for the captured cancellation token.
    /// Caller retains the real pendingMeterOpen.spawnToken and exact tile object.
    public func meterDropSourceCancellation(generation:UInt64,spawnToken:UInt64,dropID:String,retainedCarrier:Bool=false)->NativeMeterDropCancellation? {
        guard generation==state.generation,spawnToken==sourceMeterSpawnCancelToken else {
            return .explicitPendingContinuation
        }
        if let drop=meterDropReservations[dropID],drop.generation==generation,drop.queueCanceled {
            return .explicitPendingContinuation
        }
        // A captured carrier is an independent main presentation. Other
        // merge-six owners cannot cancel its travel or landed bookkeeping.
        // Explicit cancellation and generation replacement still win above.
        if retainedCarrier || meterDropReservations[dropID]?.generation==generation {return nil}
        if flags.busyEnding || hasSourceMeterLastMerge {return .busyEndingOrLastMerge}
        return nil
    }
    private var meterOpenCancelled:Bool {
        guard let flow=meterOpenFlow else{return true}
        return flow.spawnToken != sourceMeterSpawnCancelToken || flow.queueCanceled || flags.busyEnding || hasSourceMeterLastMerge
    }
    private func beginMeterOpenFlow()->NativeMoveResult {
        guard state.tutorial?.specialBarDefersReward != true else{return rejected("tutorial_special_bar_reward_deferred")}
        guard stagedMeterDrops,stagedMeterOpen,meterOpenFlow==nil,state.terminal==nil,!flags.busyEnding,!hasSourceMeterLastMerge else{return rejected("meter_open_not_admitted")}
        meterOpenSequence &+= 1
        let excluded=sourceMeterDropExcludedCells
        let sourceOwnerID=sourceTutorialWildReservation?.ownerID
        let forcedCell=resolveSourceTutorialWildReservation(excluded:excluded)
        meterOpenFlow=MeterOpenFlow(id:"native-meter-open:\(state.generation):\(meterOpenSequence)",generation:state.generation,spawnToken:sourceMeterSpawnCancelToken,excluded:excluded,sourceTutorialOwnerID:sourceOwnerID,forcedTutorialCell:forcedCell)
        return prepareMeterOpenAttempt()
    }
    private func prepareMeterOpenAttempt()->NativeMoveResult {
        guard var flow=meterOpenFlow,flow.generation==state.generation else{return rejected("stale_meter_open_flow")}
        if meterOpenCancelled {return finishMeterOpenFlow(reason:"source_meter_open_cancelled")}
        while flow.tries<12 {
            let available=NativeMagnetRules.emptyCells(state:state,excluding:flow.excluded)
            let forced=flow.tries==0 ? flow.forcedTutorialCell:nil
            guard forced != nil || !available.isEmpty else {
                flow.tries+=1;meterOpenFlow=flow
                let retry=NativeMeterOpenRetry(id:flow.id+":empty:\(flow.tries)",generation:flow.generation,spawnToken:flow.spawnToken,milliseconds:40)
                pendingMeterOpenRetry=retry
                return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.meterDropOpenRetryPrepared,value:40,reason:retry.id)],resolution:resolve())
            }
            let cell:NativeCell
            if sourceTutorialSubsequentPresentationEnabled {
                cell=forced ?? available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
            } else {
                cell=(state.tutorial?.waitingForWild == true && flow.tries==0) ? (NativeTutorialRules.preferredWildCell(state:state) ?? available[min(available.count-1,Int(nextRandom()*Double(available.count)))]) : available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
            }
            if flow.attempted.contains(cell) {flow.tries+=1;continue}
            flow.attempted.insert(cell)
            let choice=forceTutorialWildStar ? (state.tutorial?.reward ?? NativeWildRewardChoice(.star)):rewardPicker?(state,nextRandom(),{self.nextRandom()})
            guard let choice,choice.variant==nil || NativeSpecialDiceRegistry.compatibleVariant(choice.variant!,core:choice.archetype) != nil else{flow.tries+=1;continue}
            var tile=freshTile(cell:cell,value:6);tile.archetype=choice.archetype;tile.variant=choice.variant;tile.visible=false;tile.alpha=0
            if choice.archetype == .star {tile.starOrbitCount=initialStarDropCount(variant:choice.variant)}
            let request=NativeMeterOpenRequest(id:flow.id+":attempt:\(flow.tries+1)",generation:flow.generation,spawnToken:flow.spawnToken,attempt:flow.tries+1,tile:tile,expectedHolderID:state.tile(at:cell)?.id)
            meterOpenFlow=flow;pendingMeterOpen=request
            return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.meterDropWillOpen,tileIDs:[tile.id],archetype:tile.archetype,reason:request.id,variant:tile.variant)],resolution:resolve())
        }
        meterOpenFlow=flow;return finishMeterOpenFlow(reason:"source_meter_open_attempts_exhausted")
    }
    /// Actual native renderer calls after a matching hidden node was created.
    /// Source await-open token/busy/final recheck occurs BEFORE charge consumption.
    public func completeMeterOpen(id:String,generation:UInt64,receipt:NativeMeterOpenReceipt,prepareCommitted:((NativeTile)->Void)?=nil)->NativeMoveResult {
        guard generation==state.generation,var flow=meterOpenFlow,let request=pendingMeterOpen,request.id==id,request.generation==generation else{return rejected("stale_meter_open_receipt")}
        pendingMeterOpen=nil
        switch receipt {
        case .refused,.creationFailed:
            flow.tries+=1;meterOpenFlow=flow
            let result=prepareMeterOpenAttempt()
            return NativeMoveResult(accepted:result.accepted,state:state,events:[NativeGameplayEvent(.meterDropOpenRejected,tileIDs:[request.tile.id],reason:id)]+result.events,resolution:result.resolution)
        case .created(let tileID):
            // Literal openAtCellCore reuses a live locked zero normal holder.
            // The request ID identifies this operation, never the object's ID.
            // Destroyed Source grid entries are treated as an empty slot.
            let holder=state.tile(at:request.tile.cell).flatMap { tile in
                (noMovesTileRuntime[tile.id]?.destroyed ?? false) ? nil:tile
            }
            if let holder,(!holder.locked || holder.value>0 || holder.isWild) {
                flow.tries+=1;meterOpenFlow=flow
                let result=prepareMeterOpenAttempt()
                return NativeMoveResult(accepted:result.accepted,state:state,events:[NativeGameplayEvent(.meterDropOpenRejected,tileIDs:[request.tile.id],reason:id)]+result.events,resolution:result.resolution)
            }
            let actualID=holder?.id ?? request.tile.id
            guard tileID==actualID else{pendingMeterOpen=request;return rejected("foreign_meter_open_node")}
            var opened=request.tile;opened.id=actualID
            state.removeSourceGridOwner(at:request.tile.cell);state.tiles.append(opened)
            var events=[NativeGameplayEvent(.meterDropOpenCreated,tileIDs:[opened.id],archetype:request.tile.archetype,reason:id,variant:request.tile.variant)]
            if meterOpenCancelled {
                state.tiles.removeAll{$0.id==opened.id}
                events.append(NativeGameplayEvent(.meterDropOpenCanceled,tileIDs:[opened.id],reason:id))
                meterOpenFlow=nil;pendingMeterOpenRetry=nil
                return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
            }
            // Original window flags are deleted only for the captured forced
            // cell after open success and its first cancellation recheck.
            clearSourceTutorialWildReservation(ownerID:flow.sourceTutorialOwnerID,generation:generation,forcedCell:flow.forcedTutorialCell,openedCell:request.tile.cell)
            // Literal Source prepares authored audio/selected Juice after the
            // first token check, BEFORE live charge consumption. It does NOT
            // await these callbacks and rechecks cancellation after charge.
            meterOpenCommitting=true
            prepareCommitted?(opened)
            meterOpenCommitting=false
            guard generation==state.generation,meterOpenFlow?.id==flow.id else{return rejected("stale_meter_committed_preparation")}
            consumeMeterCharge()
            events.append(NativeGameplayEvent(.meterDropChargeConsumed,tileIDs:[opened.id],reason:id))
            if meterOpenCancelled {
                state.tiles.removeAll{$0.id==opened.id}
                events.append(NativeGameplayEvent(.meterDropOpenCanceled,tileIDs:[opened.id],reason:id+":before-travel"))
                meterOpenFlow=nil;pendingMeterOpenRetry=nil
                return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
            }
            meterDropSequence &+= 1
            let drop=NativeMeterDropReservation(id:"native-meter-drop:\(generation):\(meterDropSequence)",generation:generation,tileID:opened.id,cell:request.tile.cell,archetype:request.tile.archetype!,variant:request.tile.variant)
            meterDropReservations[drop.id]=drop;meterOpenFlow=nil;pendingMeterOpenRetry=nil
            events.append(NativeGameplayEvent(.meterDropReserved,tileIDs:[opened.id],value:6,archetype:request.tile.archetype,reason:drop.id,variant:request.tile.variant))
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
        }
    }
    public func deliverMeterOpenEmptyWait(id:String,generation:UInt64,cancelled:Bool=false)->NativeMoveResult {
        guard generation==state.generation,let retry=pendingMeterOpenRetry,retry.id==id,meterOpenFlow != nil else{return rejected("stale_meter_empty_wait")}
        pendingMeterOpenRetry=nil
        if cancelled{return finishMeterOpenFlow(reason:"source_meter_empty_wait_cancelled")}
        return prepareMeterOpenAttempt()
    }
    /// Explicit literal Source global cancellation, NOT background/global GSAP
    /// pause. A pending creation still replies; live travel cleanup belongs to
    /// its actual carrier receipt. Entered warmup Promise is never fake-settled.
    public func cancelMeterSourceContinuation()->NativeMoveResult {
        guard stagedMeterDrops,stagedMeterOpen else{return rejected("source_meter_route_not_installed")}
        sourceMeterSpawnCancelToken &+= 1;state.wildMeter=0
        var events=[NativeGameplayEvent(.meterDropContinuationReset)]
        if var flow=meterOpenFlow {
            flow.queueCanceled=true;meterOpenFlow=flow
            if pendingMeterOpen==nil && !meterOpenCommitting {
                events += finishMeterOpenFlow(reason:"source_meter_open_explicit_cancel").events
            }
        }
        for drop in Array(meterDropReservations.values) where !drop.bookkeepingCommitted {
            events += requestMeterDropCancellation(id:drop.id,generation:drop.generation,reason:.explicitPendingContinuation).events
        }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    public func cancelMeterOpenContinuation()->NativeMoveResult {cancelMeterSourceContinuation()}
    private func finishMeterOpenFlow(reason:String)->NativeMoveResult {
        let id=meterOpenFlow?.id;meterOpenFlow=nil;pendingMeterOpen=nil;pendingMeterOpenRetry=nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.meterDropOpenFailed,value:reason=="source_meter_open_attempts_exhausted" ? 600:nil,reason:id.map{$0+":"+reason} ?? reason)],resolution:resolve())
    }
}


extension NativeGameplayEngine {
 /// Installation is permitted only after the real captured native main owner
 /// exists. The current raw Magnet Scene has no such owner: do not call this
 /// based on pendingMagnetRespawn/elapsed time; its integration stays gated.
 public func registerSourceSpecialAbsorbOwner(transactionID:String,generation:UInt64)->NativeSourceSpecialAbsorbReceipt? {
  guard generation==state.generation,let plan=pendingSpecial,plan.id==transactionID,plan.generation==generation,
   pendingSourceSpecialAbsorb==nil,!specialActivationCommitted,pendingMagnetRespawn==nil,
   plan.archetype == .magnet || plan.archetype == .tnt && stagedTntActivation else{return nil}
  sourceSpecialAbsorbSequence &+= 1
  let receipt=NativeSourceSpecialAbsorbReceipt(id:"native-source-special-absorb:\(generation):\(sourceSpecialAbsorbSequence)",transactionID:transactionID,sourceID:plan.source.id,destinationID:plan.destination.id,generation:generation)
  pendingSourceSpecialAbsorb=receipt;sourceSpecialAbsorbMainEntered=false;return receipt
 }
 /// FIRST statement of actual Source main80 onComplete, before its asynchronous
 /// work. No body preparation/convergence/replacement/wall-wait substitutes it.
 public func sourceSpecialWildDestinationFaceDelivered(transactionID:String,generation:UInt64)->Bool {
  guard state.generation==generation,let plan=pendingSpecial,plan.id==transactionID else{return false}
  return !plan.destination.isWild || completedSourceSpecialWildDestinationFace?.transactionID==transactionID
 }
 public func commitSourceSpecialAbsorbMain(receiptID:String,generation:UInt64)->NativeMoveResult {
  guard generation==state.generation,let receipt=pendingSourceSpecialAbsorb,receipt.id==receiptID,receipt.generation==generation,
   let plan=pendingSpecial,plan.id==receipt.transactionID,plan.generation==generation,!sourceSpecialAbsorbMainEntered,
   !specialActivationCommitted,pendingMagnetRespawn==nil else{return rejected("stale_source_special_absorb_main")}
  guard !plan.destination.isWild || completedSourceSpecialWildDestinationFace?.transactionID==plan.id else{return rejected("source_special_first_face_not_delivered")}
  sourceSpecialAbsorbMainEntered=true
  if plan.archetype == .magnet {state.lastSpecialMergeWorld=NativeSpecialDiceRegistry.celebrationWorld(source:plan.source,destination:plan.destination) ?? state.lastSpecialMergeWorld}
  return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
 }
 /// Destructive pre-main callback only. Actual Source pull timeline interrupts
 /// restore captured target poses/bindings and stop current-run force sounds.
 public func cancelSourceSpecialAbsorb(receiptID:String,generation:UInt64)->NativeMoveResult {
  guard generation==state.generation,let receipt=pendingSourceSpecialAbsorb,receipt.id==receiptID,receipt.generation==generation,
   let plan=pendingSpecial,plan.id==receipt.transactionID,plan.generation==generation,!sourceSpecialAbsorbMainEntered,
   !specialActivationCommitted,pendingMagnetRespawn==nil else{return rejected("stale_source_special_absorb_interrupt")}
  return cancelSourceSpecialCapturedPair(plan)
 }
 /// KING-safe setup-abort overlay: the accepted actual normal Magnet pair
 /// cannot retain input forever if a prefix/driver installation is refused.
 /// This is destructive cancellation, never a synthesized Source arrival.
 public func cancelSourceMagnetMainSetup(transactionID:String,generation:UInt64)->NativeMoveResult {
  guard sourceMagnetMain80Enabled,generation==state.generation,
   let plan=pendingSpecial,plan.id==transactionID,plan.generation==generation,
   plan.archetype == .magnet,NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination,gameplay:true) == .magnet,
   pendingSourceSpecialAbsorb==nil,!sourceSpecialAbsorbMainEntered,!specialActivationCommitted,pendingMagnetRespawn==nil
  else{return rejected("stale_source_magnet_main_setup_abort")}
  return cancelSourceSpecialCapturedPair(plan)
 }
 public func cancelSourceTntMainSetup(transactionID:String,generation:UInt64)->NativeMoveResult {
  guard sourceTntMain80Enabled,generation==state.generation,
   let plan=pendingSpecial,plan.id==transactionID,plan.generation==generation,
   plan.archetype == .tnt,NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination,gameplay:true) == .tnt,
   pendingSourceSpecialAbsorb==nil,!sourceSpecialAbsorbMainEntered,!specialActivationCommitted
  else{return rejected("stale_source_tnt_main_setup_abort")}
  return cancelSourceSpecialCapturedPair(plan)
 }
 private func cancelSourceSpecialCapturedPair(_ plan:NativeSpecialMovePlan)->NativeMoveResult {
  var restored:[String]=[]
  if plan.archetype == .magnet {
   // Literal delayed pull timelines' onInterrupt -> cleanupPulledTile. Original
   // captured target objects survive; no respawn/value/RNG/idle invention.
   for target in plan.targets {
    if let index=state.tiles.firstIndex(where:{$0.id==target.id && $0.magnetOwned && $0.resolutionOwned}),!(noMovesTileRuntime[target.id]?.destroyed ?? false) {
     state.tiles[index].locked=false;state.tiles[index].magnetOwned=false;state.tiles[index].resolutionOwned=false
     if var runtime=noMovesTileRuntime[target.id] {runtime.eventMode = .normal;noMovesTileRuntime[target.id]=runtime}
     restored.append(target.id)
    }
   }
  }
  let captured=[plan.source.id,plan.destination.id],removed=captured.filter{id in state.tiles.contains{$0.id==id}}
  state.tiles.removeAll{captured.contains($0.id)}
  flags.pendingSpecialMutation=false
  if plan.source.gameplayArchetype == .magnet || plan.destination.gameplayArchetype == .magnet {flags.wildMagnetPullInProgress=false}
  pendingSpecial=nil;pendingSourceSpecialAbsorb=nil;sourceSpecialAbsorbMainEntered=false
        pendingSourceSpecialWildDestinationFace=nil;completedSourceSpecialWildDestinationFace=nil
  specialPreBoard=nil;specialImpactIndex=0;specialActivationCommitted=false;tntTargetsReserved=false;tntReservationReleased=false
  pendingLaserShots=[];noMovesSignature=nil
  var events=[NativeGameplayEvent(.mergeSixAbsorbInterrupted,tileIDs:captured,archetype:plan.archetype,reason:plan.id,variant:plan.variant)]
  if !removed.isEmpty {events.append(NativeGameplayEvent(.removed,tileIDs:removed,reason:"merge6-absorb-interrupted"))}
  if !restored.isEmpty {events.append(NativeGameplayEvent(.sourceMagnetPullInterrupted,tileIDs:restored,archetype:.magnet,reason:plan.id,variant:plan.variant))}
  return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
 }
}


extension NativeGameplayEngine {
    /// Install only at the four captured actual Source callbacks; never in synchronize/resolve.
    @discardableResult public func recordSourceMeterBoardMutation(_ writer:NativeSourceMeterMutationLedger.Writer,generation:UInt64,sourceDateMilliseconds:Int64)->Bool {
        guard generation==state.generation else{return false}
        if sourceMeterMutationLedger == nil {sourceMeterMutationLedger = .init(generation:generation)}
        return sourceMeterMutationLedger!.record(writer,generation:generation,sourceDateMilliseconds:sourceDateMilliseconds)
    }
    public var sourceMeterLastBoardMutationDateMilliseconds:Int64 {sourceMeterMutationLedger?.lastMutationDateMilliseconds ?? 0}
    /// App-lived Source context carries the actual Date/signature across replacement
    /// Core objects. Adopt before the first writer; never rebuild it from board revision.
    public var sourceMeterMutationSnapshot:NativeSourceMeterMutationLedger {sourceMeterMutationLedger ?? .init(generation:state.generation)}
    @discardableResult public func adoptSourceMeterMutationSnapshot(_ captured:NativeSourceMeterMutationLedger,generation:UInt64)->Bool {
        guard generation==state.generation,sourceMeterMutationLedger==nil else{return false}
        var adopted=captured;adopted.resetTransientGuards(generation:generation);sourceMeterMutationLedger=adopted;return true
    }

    /// Call only after actual awaited tutorial repair and isCurrentCheck gates. Missing
    /// Source event-mode capture refuses observation; it never fabricates a signature.
    @discardableResult public func observeSourceMeterCheckLevelEndSignature(generation:UInt64,sourceDateMilliseconds:Int64,eventModes:[String:NativeSourceMeterEventMode])->Bool? {
        guard generation==state.generation,state.tiles.allSatisfy({eventModes[$0.id] != nil}) else{return nil}
        let runtime=sourceNoMovesEffectiveTileRuntime
        let active=state.tiles.filter { NativeSourceEndgameChecker.active($0,runtime:runtime[$0.id] ?? .init()) }
        let signature=NativeSourceMeterEndgameSignature(activeEntries:active.map {t in
            .init(value:t.value,special:t.archetype?.rawValue,locked:t.locked,depth:t.stackDepth,
                  x:t.cell.column,y:t.cell.row,eventMode:eventModes[t.id]!.name)
        })
        return recordSourceMeterBoardMutation(.checkLevelEndSignatureObserved(signature),generation:generation,sourceDateMilliseconds:sourceDateMilliseconds)
    }

    /// Canonical ordered v9 getWildSpawnAnimationBlockReason. Environment carries
    /// actual owner state, not pending-plan presence or generic native visual tails.
    public func sourceMeterAnimationBlockReason(environment e:NativeSourceMeterQueueEnvironment)->String? {
        guard e.generation==state.generation else{return "obsolete-generation"}
        guard state.tiles.allSatisfy({tile in e.tiles.filter{$0.tileID==tile.id}.count==1}) else{return "source-meter-markers-unavailable"}
        if flags.busyEnding {return "busyEnding"}
        if e.boardTransitionActive {return "board-transition"}
        if e.failScreenPending {return "fail-screen-pending"}
        if e.specialTransactionActive {return "special-transaction"}
        if e.endgameGuardActive {return "endgame-guard:"+(e.endgameGuardSources.isEmpty ? "ttl":e.endgameGuardSources.joined(separator:","))}
        if e.mergeSixSpawnInProgress {return "merge6-spawn-in-progress"}
        if sourceMeterMutationLedger?.activeRegularHandoffs.isEmpty == false {return "regular-merge-handoff"}
        let liveIDs=Set(state.tiles.map(\.id))
        let markers=e.tiles.filter{liveIDs.contains($0.tileID) && !$0.destroyed}
        let destroyed=Set(e.tiles.filter(\.destroyed).map(\.tileID))
        if markers.contains(where:{$0.cleanupClaim}) || state.tiles.contains(where:{$0.merge6CleanupOwned && !destroyed.contains($0.id) && !(noMovesTileRuntime[$0.id]?.destroyed ?? false)}) {return "regular-merge6-handoff"}
        if e.wildMagnetPullInProgress {return "wild-magnet-pull"}
        if sourceMeterMutationLedger?.isBoardSettling(sourceDateMilliseconds:e.sourceDateMilliseconds) == true {return "board-settling"}
        if markers.contains(where:{$0.magnetAffected}) || state.tiles.contains(where:{$0.magnetOwned && !destroyed.contains($0.id) && !(noMovesTileRuntime[$0.id]?.destroyed ?? false)}) {return "wild-magnet-affected-tiles"}
        if markers.contains(where:{$0.transientAnimation}) || meterDropReservations.values.contains(where:{liveIDs.contains($0.tileID) && !destroyed.contains($0.tileID) && (($0.assetsPrepared && !$0.landed) || $0.handoffLocked)}) {return "tile-transient-animation"}
        if e.wildDropInProgress {return "wild-spawn-drop"}
        return nil
    }
    public func meterSourceQueuePermission(environment e:NativeSourceMeterQueueEnvironment)->NativeWildMeterRules.Permission {
        guard meterDropAllowed else{return .init(.block,"one-lucky-drop-already-used")}
        guard e.generation==state.generation else{return .init(.block,"obsolete-generation")}
        guard state.tutorial?.specialBarDefersReward != true else{return .init(.block,"tutorial-special-bar")}
        guard state.tiles.allSatisfy({tile in e.tiles.filter{$0.tileID==tile.id}.count==1}) else{return .init(.block,"source-meter-markers-unavailable")}
        return NativeWildMeterRules.permission(meter:state.wildMeter,meterEnabled:e.boardMeterEnabled,
            spawnEnabled:e.boardSpawnEnabled,spawnInProgress:e.queueInProgress,busyEnding:flags.busyEnding,
            boardTransition:e.boardTransitionActive,failPending:e.failScreenPending,lastMerge:hasSourceMeterLastMerge,
            animationBlock:sourceMeterAnimationBlockReason(environment:e))
    }
}


extension NativeGameplayEngine {
    /// Actual same-node setValue face callback only. No elapsed-time/pickup/main80
    /// callback may stand in for this receipt. Signature depth/max update here.
    public func commitSourceOrdinaryStackFace(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let entry=sourceOrdinaryStackFaces[receiptID],entry.receipt.generation==generation,
              !sourceOrdinaryStackFaces.values.contains(where:{$0.receipt.destinationID==entry.receipt.destinationID && $0.receipt.sequence<entry.receipt.sequence}),
              let index=state.tiles.firstIndex(where:{$0.id==entry.receipt.destinationID && $0.cell==entry.receipt.cell}),
              !state.tiles[index].locked,!state.tiles[index].isWild,state.tiles[index].variant==nil,
              noMovesTileRuntime[entry.receipt.destinationID]?.destroyed != true else{return rejected("stale_or_out_of_order_ordinary_face")}
        sourceOrdinaryStackFaces.removeValue(forKey:receiptID) // retire BEFORE publication
        state.tiles[index].value=entry.receipt.value
        state.tiles[index].stackDepth=min(4,max(1,state.tiles[index].stackDepth)+entry.receipt.addStack)
        state.maxStackDepth=max(state.maxStackDepth,state.tiles[index].stackDepth)
        if sourceNoMovesStackContexts[entry.receipt.ordinaryMoveID] != nil {
            sourceNoMovesStackContexts[entry.receipt.ordinaryMoveID]=NativeNoMovesStackContext(before:entry.before,source:entry.source,destination:entry.destination,effectiveSum:entry.receipt.value,destinationDepthAfterCommit:state.tiles[index].stackDepth)
        }
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    /// Captured node/RAF cancellation or real destructive retirement only. Pure
    /// global pause/background cannot invent a face commit or cancel this owner.
    public func cancelSourceOrdinaryStackFace(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let entry=sourceOrdinaryStackFaces[receiptID],entry.receipt.generation==generation else{return rejected("stale_ordinary_face_cancel")}
        sourceOrdinaryStackFaces.removeValue(forKey:receiptID)
        // The captured physical face did not arrive. Keep the live Native model
        // unpublishable until a genuine generation teardown, rather than calling
        // cancellation a coherent new depth or serializing a missing physical tile.
        sourceOrdinaryStackFaceCancellationBlocks[receiptID]=entry.receipt
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
}

extension NativeGameplayEngine {
    /// Actual Source openAtCell repair producer. Random cell selection is read
    /// before construction; reentrant Math cannot publish into a successor run.
    public func beginSourceTutorialRepair(physical:NativeBoardState,singleOnly:Bool,
        blocked:Bool)->NativeMoveResult? {
        guard state.terminal==nil,physical.generation==state.generation,
            state.tutorial?.completionAssist==true,state.tutorial?.done != true,
            !blocked,(state.tutorial?.finalChanceSpawnCount ?? 99)<99 else{return nil}
        let candidates=physical.tiles.filter{!$0.locked && !$0.isWild && $0.visible && (1...5).contains($0.value)}
        guard !singleOnly || candidates.count==1,let target=candidates.enumerated().sorted(by:{a,b in
            a.element.value==b.element.value ? a.offset<b.offset:a.element.value>b.element.value
        }).first?.element else{return nil}
        var cells:[NativeCell]=[]
        for row in 0..<state.rows {for column in 0..<state.columns {
            let cell=NativeCell(column:column,row:row)
            let occupant=physical.tile(at:cell)
            if occupant==nil || occupant.map({$0.locked && $0.value<=0 && !$0.isWild})==true {cells.append(cell)}
        }}
        guard !cells.isEmpty else{return nil}
        let captured=state,roll=nextRandom()
        guard roll.isFinite,roll>=0,roll<1,state.generation==captured.generation,
            state.tiles==captured.tiles,state.tutorial==captured.tutorial,state.terminal==nil else{return nil}
        let cell=cells[min(cells.count-1,Int(roll*Double(cells.count)))]
        let replaced=state.tiles.filter{$0.cell==cell};state.tiles.removeAll{$0.cell==cell}
        state.removeSourceGridOwner(at:cell)
        let tile=freshTile(cell:cell,value:max(1,min(5,6-target.value)))
        state.tiles.append(tile);state.tutorial?.finalChanceSpawnCount+=1;state.revision &+= 1
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,
            events:replaced.map{.init(.removed,tileIDs:[$0.id])},resolution:NativeResolution(.wait,reason:"source_tutorial_repair_open"))
    }
    /// Genuine repair cancellation decrements the Source counter. It does not
    /// restore a prior entire board over input or a replacement generation.
    public func rollbackSourceTutorialRepair(generation:UInt64,tileID:String)->Bool {
        guard state.generation==generation,state.tiles.contains(where:{$0.id==tileID}) else{return false}
        let count=state.tutorial?.finalChanceSpawnCount ?? 0
        state.tutorial?.finalChanceSpawnCount=max(0,count-1)
        return true
    }
}

extension NativeGameplayEngine {
    public func beginSourceLingeringSixRepair(tileID:String,generation:UInt64)->NativeMoveResult? {
        guard state.generation==generation,state.terminal==nil,!isDragging,
            let index=state.tiles.firstIndex(where:{$0.id==tileID}),state.tiles[index].value==6,
            state.tiles[index].gameplayArchetype==nil,!state.tiles[index].locked,
            !state.tiles[index].magnetOwned,!state.tiles[index].pendingRemoval,
            state.tiles.contains(where:{$0.id != tileID && $0.visible && !$0.locked && ($0.value>0 || $0.isWild)}),
            !state.tiles.contains(where:{$0.id != tileID && !$0.isWild && !$0.locked && (1...5).contains($0.value)}) else{return nil}
        let old=state.tiles.remove(at:index);state.removeSourceGridOwner(at:old.cell);state.revision &+= 1
        var holder=freshTile(cell:old.cell,value:0);holder.locked=true;state.tiles.append(holder)
        return NativeMoveResult(accepted:true,state:state,events:[.init(.removed,tileIDs:[old.id])],resolution:.init(.wait,reason:"source_lingering_six_constructor"))
    }
    public func openSourceLingeringSixRepair(tileID:String,generation:UInt64)->NativeMoveResult? {
        guard state.generation==generation,state.terminal==nil,let index=state.tiles.firstIndex(where:{$0.id==tileID}),
            state.tiles[index].value==0,state.tiles[index].locked else{return nil}
        let captured=state,value=randomValue()
        guard state.generation==generation,state.tiles==captured.tiles,state.tutorial==captured.tutorial else{return nil}
        state.tiles[index].value=value;state.tiles[index].locked=false;state.tiles[index].alpha=1;state.revision &+= 1
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:.init(.wait,reason:"source_lingering_six_open"))
    }
}

extension NativeGameplayEngine {
    public func beginSourceMandatoryCellRepair(cell:NativeCell,generation:UInt64)->NativeMoveResult? {
        guard state.generation==generation,state.terminal==nil,!isDragging,
            cell.column>=0,cell.column<state.columns,cell.row>=0,cell.row<state.rows else{return nil}
        let removed=state.tiles.filter{$0.cell==cell};state.tiles.removeAll{$0.cell==cell};state.removeSourceGridOwner(at:cell);state.revision &+= 1
        var holder=freshTile(cell:cell,value:0);holder.locked=true;state.tiles.append(holder)
        return .init(accepted:true,state:state,events:removed.map{.init(.removed,tileIDs:[$0.id])},resolution:.init(.wait,reason:"source_mandatory_cell_constructor"))
    }
}


extension NativeGameplayEngine {
 /// Genuine Special-plan first-face carrier; no Direct transaction is created.
 public func prepareSourceSpecialWildDestinationFace(transactionID:String,generation:UInt64)->NativeSourceSpecialWildDestinationFaceReceipt? {
  guard generation==state.generation,let plan=pendingSpecial,plan.id==transactionID,plan.generation==generation,
   !sourceSpecialAbsorbMainEntered,!specialActivationCommitted,pendingSourceSpecialWildDestinationFace==nil,
   completedSourceSpecialWildDestinationFace==nil,
   let path=NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:plan.destination),
   let before=state.tiles.first(where:{$0.id==plan.destination.id}),before.sourceWildStateCleared,before.value==6 else{return nil}
  var after=before;after.stackDepth=1;after.sourceResidualWildPresence=true
  let face=NativeSourceWildDestinationFaceReceipt(id:plan.id+":special-first-face",transactionID:plan.id,generation:generation,revision:state.revision,originalDestination:plan.destination,beforeFace:before,afterFace:after,assetPath:path)
  let receipt=NativeSourceSpecialWildDestinationFaceReceipt(transactionID:plan.id,archetype:plan.archetype,face:face)
  pendingSourceSpecialWildDestinationFace=receipt;return receipt
 }
 public func commitSourceSpecialWildDestinationFace(receiptID:String,generation:UInt64)->NativeMoveResult {
  guard generation==state.generation,let receipt=pendingSourceSpecialWildDestinationFace,receipt.face.id==receiptID,
   let plan=pendingSpecial,plan.id==receipt.transactionID,plan.archetype==receipt.archetype,
   !sourceSpecialAbsorbMainEntered,!specialActivationCommitted,receipt.face.revision==state.revision,
   let index=state.tiles.firstIndex(where:{$0.id==receipt.face.beforeFace.id}),state.tiles[index]==receipt.face.beforeFace else{return rejected("source_special_first_face_not_ready")}
  state.tiles[index]=receipt.face.afterFace;pendingSourceSpecialWildDestinationFace=nil;completedSourceSpecialWildDestinationFace=receipt
  return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
 }
}
