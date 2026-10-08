import Foundation

/// Pure state owner. SpriteKit reads receipts; animation completions never resolve a move again.
/// Special mutations use captured receipts and release gameplay independently of decorative tails.
public final class NativeGameplayEngine {
    public private(set) var state: NativeBoardState
    public var snapshot: NativeBoardState { state }
    /// Additional exact source lifecycle markers are supplied only by their native
    /// owner (for example Wild-drop travel); ordinary decorative SKActions add none.
    public var sourceSaveRuntime=NativeSourceSaveRuntime()
    public var hasUnsavableSourceGameplayState:Bool {
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
    private func meterDropBlocksTile(_ id:String)->Bool {
        meterDropReservations.values.contains {$0.tileID==id && (!$0.landed || $0.handoffLocked || !$0.warmupCompleted)}
    }
    public private(set) var flags = NativeGameplayRuntimeFlags()
    public private(set) var noMovesSignature: String?
    /// Opt-in until the authored Scene transport and final exit are admitted.
    public var stagedSourceNoMoves = false
    public var noMovesTileRuntime:[String:NativeNoMovesTileRuntime]=[:]
    public var sourceWildRetryPending=false
    public var sourceNonFinalMerge6Guard=false
    private var sourceNoMovesReadyPostchecks:Set<String>=[]
    private var sourceNoMovesStackContexts:[String:NativeNoMovesStackContext]=[:]
    private var sourceNoMovesOwner=NativeNoMovesCandidateOwner()
    private var sourceNoMovesGeneration:UInt64?
    private var sourceNoMovesConfirmed:NativeNoMovesCandidateOwner.Plan?
    private var sourceNoMovesConfirmedResolution:NativeResolution?
    public var pendingSourceNoMoves:NativeNoMovesCandidateOwner.Plan? {sourceNoMovesOwner.active ?? sourceNoMovesConfirmed}
    public var sourceGameplaySignature:NativeSourceGameplaySignature {NativeSourceGameplaySignature(tiles:state.tiles.filter{!(noMovesTileRuntime[$0.id]?.destroyed ?? false)})}

    public private(set) var pendingSpecial: NativeSpecialMovePlan?
    public private(set) var pendingLaserShots: [NativeLaserShot] = []
    /// Native board supplies actual UIKit x coordinates; gameplay owns exact ordering/shooter RNG.
    public var laserTargetX: ((NativeTile) -> Double)?
    public var laserViewportWidth: Double?
    public private(set) var pendingMagnetRespawn: NativeMagnetRespawnPlan?
    private var magnetReplacementIndex = 0
    public private(set) var pendingHUDStars: [NativeHUDStarReceipt] = []
    public private(set) var pendingMeterRewards: [NativeMeterRewardReceipt] = []
    public var stagedTntActivation = false
    public var stagedDirectWildMoves = false
    public private(set) var pendingWildSpawnPresentations:[NativeWildSpawnPresentation] = []
    private var wildSourceResolutionBoundary:(id:String,generation:UInt64)?
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
    public private(set) var ordinarySixGameplayCommitted = false
    public private(set) var pendingOrdinarySpawns:Set<String> = []
    public private(set) var pendingOrdinaryPostchecks: [NativeOrdinaryPostcheckReceipt] = []
    private var committingOrdinaryStack = false
    public private(set) var pendingDirectWild: NativeDirectWildMovePlan?
    public private(set) var directWildGameplayCommitted = false
    private var committingDirectWild = false
    private var directWildPointerID = 0
    public private(set) var specialActivationCommitted = false
    private var tntTargetsReserved = false
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
    private var comboWindow: Double = 2
    private var randomChoices: [Double]
    private let rewardPicker: ((NativeBoardState, Double, () -> Double) -> NativeWildRewardChoice?)?
    public init(state: NativeBoardState, recordedRandomChoices: [Double] = [], rewardPicker: ((NativeBoardState, Double) -> NativeWildRewardChoice?)? = nil) { self.state = state; randomChoices = recordedRandomChoices; self.rewardPicker = rewardPicker.map { picker in { state, roll, _ in picker(state,roll) } } }
    public init(state: NativeBoardState, recordedRandomChoices: [Double] = [], rewardPicker: @escaping (NativeBoardState, Double, () -> Double) -> NativeWildRewardChoice?) { self.state = state; randomChoices = recordedRandomChoices; self.rewardPicker = rewardPicker }
    public func setInputLock(_ reason: String, active: Bool, wildOnly: Bool = false) { if active { locks[reason] = wildOnly } else { locks.removeValue(forKey: reason) } }
    public func setRuntimeFlags(_ flags: NativeGameplayRuntimeFlags) { self.flags = flags; if let plan = pendingSpecial { self.flags.pendingSpecialMutation = true; self.flags.wildMagnetPullInProgress = plan.archetype == .magnet }; if pendingDirectWild != nil && !directWildGameplayCommitted { self.flags.pendingSpecialMutation = true } }
    public func beginDrag(tileID: String, pointerID: Int = 0) -> Bool {
        guard drag == nil, state.terminal == nil, state.validationIssues().isEmpty,
              let tile = state.tiles.first(where: { $0.id == tileID }), tile.isPlayable, !meterDropBlocksTile(tileID),
              NativeTutorialRules.allowsPickup(tile,tutorial:state.tutorial,rows:state.rows),
              !locks.values.contains(where: { !$0 || tile.isWild }), (!flags.isWaiting || canRunOrdinaryDuringTnt(tile)) else { return false }
        noMovesSignature = nil
        drag = Drag(id: tileID, pointerID: pointerID, generation: state.generation, revision: state.revision,origin:tile.cell)
        return true
    }
    public func cancelDrag() { drag = nil }
    public func cancelNoMovesConfirmation() { noMovesSignature = nil }
    public func restart(state fresh: NativeBoardState) {
        meterDropReservations.removeAll();meterDropSequence=0
        pendingMeterOpen=nil;pendingMeterOpenRetry=nil;meterOpenFlow=nil;meterOpenSequence=0;sourceMeterSpawnCancelToken &+= 1;sourceMeterLastMergeTileIDs=[]
        sourceNoMovesReadyPostchecks=[];sourceNoMovesStackContexts=[:];sourceNoMovesOwner=NativeNoMovesCandidateOwner();sourceNoMovesConfirmed=nil;sourceNoMovesConfirmedResolution=nil;sourceNoMovesGeneration=nil;noMovesTileRuntime=[:];sourceWildRetryPending=false;sourceNonFinalMerge6Guard=false
        pendingWildRecoveryChecks=[];pendingWildSpawnPresentations=[];wildSourceResolutionBoundary=nil;sourceSaveRuntime=NativeSourceSaveRuntime()
        let generation = state.generation &+ 1
        state = fresh; state.generation = generation; state.revision = 0; state.terminal = nil; tileSequence = 0
        pendingSpecial = nil; pendingLaserShots = []; pendingMagnetRespawn = nil; magnetReplacementIndex = 0; specialPreBoard = nil; specialImpactIndex = 0
        directWildPrimaryRecovery?.cancelForLifecycle();directWildPrimaryRecovery=nil;directWildSpawnPhase?.cancelForLifecycle();directWildSpawnPhase=nil;pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];pendingWildLockedBonusPresentations=[];wildPhaseScheduledID=nil;directWildVisualReleased=false
        pendingDirectWild = nil; directWildGameplayCommitted = false; committingDirectWild = false
        pendingOrdinaryStack = nil; pendingOrdinarySix = nil; ordinarySixGameplayCommitted = false; pendingOrdinaryPostchecks.removeAll(); pendingOrdinarySpawns.removeAll(); ordinarySpawnPreparationPending=false;pendingOrdinaryAssignments.removeAll();pendingOrdinaryPrimaryArrival=nil;pendingOrdinaryDestinationCleanup=nil;ordinaryRefillRemaining=0;ordinaryRequestedOpenings=0;ordinarySuccessfulOpenings=0;ordinaryForcedCandidates=[];ordinaryForcedPass=false; committingOrdinaryStack = false
        drag = nil; pendingHUDStars.removeAll(); pendingMeterRewards.removeAll(); tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = false; deferredFinalMerge = nil; locks.removeAll(); flags = NativeGameplayRuntimeFlags(); noMovesSignature = nil; comboLastMutationTime = nil
    }
    public func cancelForBackground() {
        pendingWildRecoveryChecks=[];pendingWildSpawnPresentations=[]
        drag = nil; noMovesSignature = nil
        if let six = pendingOrdinarySix { if !ordinarySixGameplayCommitted { _ = commitOrdinarySix(receiptID:six.id,generation:six.generation) }; if ordinarySpawnPreparationPending {_ = prepareOrdinarySpawns(receiptID:six.id,generation:six.generation)}
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
        for receipt in pendingHUDStars { _ = commitHUDStarArrival(receiptID:receipt.id,generation:receipt.generation) }
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
        state.wildMeter += NativeWildMeterRules.increment(base:receipt.base,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        var events = [NativeGameplayEvent(.meterRewardCommitted,value:receipt.impactIndex,reason:receipt.id)]
        let resolution = settleDeferredFinalMerge(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    public func resolve() -> NativeResolution {
        if state.terminal == nil && sourceMeterSpawnInProgress {
            return NativeResolution(.wait,reason:"captured_meter_drop_continuation")
        }
        if state.terminal == nil && sourceMeterHandoffInProgress {
            return NativeResolution(.wait,reason:"captured_meter_tile_handoff")
        }
        if state.terminal == nil && directWildSpawnPhase != nil {return NativeResolution(.wait,reason:"direct_wild_spawn_continuation_pending")}
        if state.terminal == nil && (pendingOrdinaryStack != nil || pendingOrdinarySix != nil || !pendingOrdinaryPostchecks.isEmpty) { return NativeResolution(.wait,reason:"ordinary_mutation_pending") }
        if state.terminal == nil && !pendingMeterRewards.isEmpty { return NativeResolution(.wait,reason:"captured_meter_reward_pending") }
        if state.terminal == nil && state.wildMeter >= 1-0.000001 && !flags.isWaiting { return NativeResolution(.wait,reason:"wild_continuation_pending") }
        let resolution = NativeGameplayResolver.resolve(state: state, flags: resolutionRuntimeFlags)
        if resolution.kind == .fail && state.tutorial?.completionAssist == true { return NativeResolution(.wait,reason:"tutorial_final_chance_pending") }
        return resolution
    }
    public func expireCombo(now: Double) {
        guard let last = comboLastMutationTime, now - last >= comboWindow else { return }
        state.combo = 0; comboLastMutationTime = nil
    }
    public func drop(target: NativeCell?, pointerID: Int = 0, now: Double = 0) -> NativeMoveResult {
        guard let owned = drag else { return rejected("no_active_drag") }
        guard owned.pointerID == pointerID else { return rejected("pointer_owner_mismatch") }
        if pendingOrdinaryStack != nil && !committingOrdinaryStack { drag = nil; return rejected("regular_stack_absorb_handoff") }
        drag = nil
        guard owned.generation == state.generation, owned.revision == state.revision, state.terminal == nil else { return rejected("stale_drag_owner") }
        guard let target, let source = state.tiles.first(where: { $0.id == owned.id }), let destination = state.tile(at: target), NativeGameplayResolver.canDrop(source, onto: destination),
              !meterDropReservations.values.contains(where:{$0.tileID==source.id && (!$0.landed || $0.handoffLocked || !$0.bookkeepingCommitted)}),
              !meterDropReservations.values.contains(where:{$0.tileID==destination.id && !$0.bookkeepingCommitted}), !locks.values.contains(where: { !$0 || source.isWild || destination.isWild }), (!flags.isWaiting || canRunOrdinaryDuringTnt(source) && canRunOrdinaryDuringTnt(destination)) else { return rejected("illegal_drop") }
        guard state.validationIssues().isEmpty else { return rejected("invalid_authoritative_board") }
        guard NativeTutorialRules.allowsDrop(source:source,destination:destination,tutorial:state.tutorial,rows:state.rows) else { return rejected("tutorial_drop_restricted") }
        let effectiveSum = source.isWild || destination.isWild ? 6 : source.value + destination.value
        if directWildSpawnPhase != nil && effectiveSum>=6 {return rejected("direct_wild_spawn_continuation_pending")}
        if pendingOrdinarySix != nil && (!source.isWild && !destination.isWild && effectiveSum < 6) == false { return rejected("regular_merge6_handoff") }
        // The production canDrop permits lingering regular six + 1...5. Its recovery
        // continuation is a distinct source branch; fail closed until that port exists.
        guard effectiveSum <= 6 else { return rejected("native_lingering_six_continuation_pending") }
        let pull = (source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet) && !NativeGameplayResolver.magnetCandidates(state.tiles, source: source, destination: destination).isEmpty
        let final = NativeGameplayResolver.finalMerge(state.tiles, source: source, destination: destination, effectiveSum: effectiveSum, hasTilesToPull: pull)
        let gameplayArchetype = NativeSpecialDiceRegistry.finale(source: source, destination: destination, gameplay: true)
        if final.isFinalMerge,let gameplayArchetype,let finalePresentationAdmitted,
           !finalePresentationAdmitted(gameplayArchetype,source.variant ?? destination.variant) { return rejected("native_finale_presentation_not_ready") }
        if let gameplayArchetype, (gameplayArchetype == .magnet || gameplayArchetype == .tnt) && !final.isFinalMerge { return stageSpecialMove(source:source,destination:destination,archetype:gameplayArchetype,now:now) }
        // Meter reward can create a Special die. Never discard the reward or substitute a regular die.
        let arcadeStage = max(1, state.stage)
        let arcadeMeterMultiplier: Double = state.mode != .arcade ? 1 : arcadeStage == 1 ? 1.15 : arcadeStage == 2 ? 1 : arcadeStage == 3 ? 0.9 : arcadeStage == 4 ? 0.8 : arcadeStage < 8 ? 0.7 : 0.6
        let meterIncrement = (effectiveSum == 6 ? 0.22 : 0.10) * (state.wildSpawnCount >= 2 ? 0.6 : 1) * arcadeMeterMultiplier * (state.tutorial?.meterMultiplier ?? 1)
        if pendingSpecial == nil && !final.isFinalMerge && state.wildMeter + meterIncrement >= 1 - 0.000001 && rewardPicker == nil && state.tutorial?.waitingForWild != true { return rejected("native_wild_meter_spawn_pending") }
        if stagedDirectWildMoves && !committingDirectWild,let gameplayArchetype,
           final.isFinalMerge || gameplayArchetype == .star || gameplayArchetype == .juice {
            return stageDirectWild(source:source,destination:destination,archetype:gameplayArchetype,pointerID:pointerID,now:now,isFinal:final.isFinalMerge)
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
        let hudStars = captureHUDStars(source:source,destination:destination)
        expireCombo(now: now)
        let oldCombo = state.combo
        let isMagnet = source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet
        state.combo = min(99, oldCombo + 1)
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
        merged.value = effectiveSum; merged.stackDepth = min(4, source.stackDepth + destination.stackDepth)
        if effectiveSum < 6 { state.maxStackDepth = max(state.maxStackDepth,merged.stackDepth) }
        merged.archetype = nil; merged.variant = nil; merged.locked = false
        state.tiles.removeAll { $0.id == destination.id }
        var events = [NativeGameplayEvent(.merged, tileIDs: [source.id, destination.id], value: effectiveSum, archetype: NativeSpecialDiceRegistry.finale(source: source, destination: destination), variant: source.variant ?? destination.variant), NativeGameplayEvent(.comboChanged, value: state.combo)]
        if !hudStars.isEmpty { events.append(NativeGameplayEvent(.hudStarsPrepared,tileIDs:hudStars.map(\.id),value:hudStars.count,archetype:source.isWild ? source.archetype : destination.archetype,variant:source.variant ?? destination.variant)) }
        if effectiveSum < 6 { state.tiles.append(merged) }
        if effectiveSum == 6 {
            state.cubesCracked += 1
            let finale = NativeSpecialDiceRegistry.finale(source: source, destination: destination)
            let multiplier = isMagnet || finale == .star || finale == .juice ? 2 : source.stackDepth + destination.stackDepth
            // On final ordinary merge the source retains its regular physical multiplier;
            // final Magnet has mult=0 => bubbleMult1; its ordinary no-pull completion increments combo.
            let bubbleMultiplier = isMagnet && final.isFinalMerge ? 1 : multiplier
            state.score = min(999999, state.score + 6 * bubbleMultiplier * max(1, state.combo))
            events.append(NativeGameplayEvent(.removed, tileIDs: [destination.id]))
            if !final.isFinalMerge {
                if let gameplayArchetype { spawnDirectWildMerge6(at: destination.cell, archetype: gameplayArchetype, depth: multiplier, avoiding: source.isWild ? destination.value : source.value, starOrbitCount: (source.isWild ? source.variant : destination.variant) != nil ? 1 : (source.isWild ? source.starOrbitCount : destination.starOrbitCount), events: &events) }
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
            state.wildMeter = 0
            state.bestScore = max(state.bestScore,state.score)
            state.terminal = resolution; noMovesSignature = nil
            events.append(NativeGameplayEvent(.terminal, reason: resolution.reason))
            return NativeMoveResult(accepted: true, state: state, events: events, resolution: resolution)
        }
        state.wildMeter = max(0, state.wildMeter + meterIncrement)
        if state.wildMeter >= 1 - 0.000001 && directWildSpawnPhase == nil && pendingSpecial == nil && pendingOrdinaryStack == nil && pendingOrdinarySix == nil {
            guard spawnMeterReward(events: &events) else { state = initialState; pendingHUDStars = initialHUDStars; hudStarSequence = initialStarSequence; randomChoices = initialRandomChoices; comboLastMutationTime = initialComboTime; comboWindow = initialComboWindow; return rejected("native_wild_meter_reward_policy_rejected") }
        }
        state.bestScore = max(state.bestScore,state.score)
        let resolution = settleDeferredFinalMerge(events:&events)
        if resolution.kind == .fail { noMovesSignature = state.signature; events.append(NativeGameplayEvent(.noMovesCandidate, reason: resolution.reason)) } else { noMovesSignature = nil }
        return NativeMoveResult(accepted: true, state: state, events: events, resolution: resolution)
    }

    private func stageDirectWild(source: NativeTile,destination: NativeTile,archetype: NativeWildArchetype,pointerID: Int,now: Double,isFinal: Bool) -> NativeMoveResult {
        guard pendingDirectWild == nil,pendingSpecial == nil else { return rejected("direct_wild_transaction_in_progress") }
        if !isFinal,let specialPresentationAdmitted,!specialPresentationAdmitted(archetype,source.variant ?? destination.variant) { return rejected("native_special_presentation_not_ready") }
        specialSequence &+= 1
        let plan = NativeDirectWildMovePlan(id:"native-direct:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,archetype:archetype,variant:source.variant ?? destination.variant,source:source,destination:destination,startedAt:now,isFinal:isFinal)
        wildSourceResolutionBoundary=nil
        pendingDirectWild = plan; directWildGameplayCommitted = false;directWildVisualReleased=false;pendingWildLockedBonusPresentations=[];pendingWildSpawnPresentations=[]; directWildPointerID = pointerID
        locks[plan.id] = false; flags.pendingSpecialMutation = true; noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.directWildReserved,tileIDs:[source.id,destination.id],archetype:archetype,reason:plan.id,variant:plan.variant)],resolution:resolve())
    }
    /// Called at the actual 80 ms absorb completion. Uses live earned HUD score, not a stale saved board.
    public func commitDirectWildGameplay(transactionID: String) -> NativeMoveResult {
        guard let plan = pendingDirectWild,plan.id == transactionID,plan.generation == state.generation,
              plan.revision == state.revision,state.terminal == nil,!directWildGameplayCommitted,
              state.tiles.first(where:{ $0.id == plan.source.id }) == plan.source,
              state.tiles.first(where:{ $0.id == plan.destination.id }) == plan.destination else { return rejected("direct_wild_commit_not_ready") }
        // Original main80 callback returns before combo, score, move debit or RNG when
        // another terminal owner is active. Abort repairs captured identities only.
        if flags.busyEnding {
            wildSourceResolutionBoundary=(plan.id,plan.generation)
            let removed=[plan.destination.id,plan.source.id]
            state.tiles.removeAll { removed.contains($0.id) }
            locks.removeValue(forKey:plan.id); flags.pendingSpecialMutation=false
            pendingDirectWild=nil;directWildGameplayCommitted=false;drag=nil
            let check=NativeWildRecoveryCheck(id:plan.id+":recovery",generation:plan.generation,delayMilliseconds:120,reason:"merge6-terminal-owner-active")
            pendingWildRecoveryChecks.append(check)
            return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:removed,reason:check.reason),NativeGameplayEvent(.wildRecoveryCheckPrepared,reason:check.id)],resolution:resolve())
        }
        locks.removeValue(forKey:plan.id); flags.pendingSpecialMutation = false
        committingDirectWild = true
        drag = Drag(id:plan.source.id,pointerID:directWildPointerID,generation:plan.generation,revision:plan.revision,origin:plan.source.cell)
        let result = drop(target:plan.destination.cell,pointerID:directWildPointerID,now:plan.startedAt + 0.08)
        committingDirectWild = false
        guard result.accepted else { pendingDirectWild = nil; return result }
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
        if directWildSpawnPhase == nil {locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false}
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }

    private func stageSpecialMove(source: NativeTile, destination: NativeTile, archetype: NativeWildArchetype, now: Double) -> NativeMoveResult {
        guard pendingSpecial == nil else { return rejected("special_transaction_in_progress") }
        if let specialPresentationAdmitted, !specialPresentationAdmitted(archetype,source.variant ?? destination.variant) { return rejected("native_special_presentation_not_ready") }
        if stagedTntActivation && (source.variant ?? destination.variant) == "laser-gun",
           laserTargetX == nil || laserViewportWidth == nil || !(laserViewportWidth!.isFinite && laserViewportWidth! > 0) { return rejected("native_laser_geometry_not_ready") }
        pendingLaserShots = []
        expireCombo(now:now)
        let pre = state
        let hudStars = captureHUDStars(source:source,destination:destination)
        var targets: [NativeTile]
        let variant = source.variant ?? destination.variant
        if archetype == .magnet { targets = NativeMagnetRules.nearestPullTargets(state:state,source:source,destination:destination) }
        else { targets = stagedTntActivation ? [] : selectTntTargets(source:source,destination:destination,variant:variant) }
        let replacementValues = archetype == .tnt ? NativeTntRules.replacementValues(targets:targets,random:{ self.nextRandom() }) : []
        specialSequence &+= 1
        state.revision &+= 1
        let plan = NativeSpecialMovePlan(id:"native-special:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,archetype:archetype,variant:variant,source:source,destination:destination,targets:targets,replacementValues:replacementValues)
        specialPreBoard = pre; specialMoveTime = now; specialImpactIndex = 0; tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = archetype == .tnt && !stagedTntActivation
        state.tiles.removeAll { $0.id == source.id }
        if let index = state.tiles.firstIndex(where: { $0.id == destination.id }) {
            state.tiles[index].value = 6; state.tiles[index].archetype = nil; state.tiles[index].variant = nil
            state.tiles[index].resolutionOwned = true; state.tiles[index].visible = false; state.tiles[index].alpha = 0
        }
        for target in targets { if let index = state.tiles.firstIndex(where: { $0.id == target.id }) {
            if archetype == .magnet { state.tiles[index].locked = true }; state.tiles[index].resolutionOwned = true
            state.tiles[index].magnetOwned = archetype == .magnet
        } }
        flags.pendingSpecialMutation = true; flags.wildMagnetPullInProgress = archetype == .magnet
        pendingSpecial = plan; noMovesSignature = nil
        var events: [NativeGameplayEvent] = []
        if !hudStars.isEmpty { events.append(NativeGameplayEvent(.hudStarsPrepared,tileIDs:hudStars.map(\.id),value:hudStars.count,archetype:source.isWild ? source.archetype : destination.archetype,variant:variant)) }
        events += [NativeGameplayEvent(.merged,tileIDs:[source.id,destination.id],value:6,archetype:NativeSpecialDiceRegistry.finale(source:source,destination:destination),variant:variant),NativeGameplayEvent(.specialReserved,tileIDs:targets.map(\.id),archetype:archetype,reason:plan.id,variant:variant)]
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:NativeResolution(.wait,reason:"special_gameplay_mutation_active"))
    }
    private func selectTntTargets(source: NativeTile,destination: NativeTile,variant: String?) -> [NativeTile] {
        let candidates = NativeTntRules.eligibleTargets(state.tiles,excluding:[source.id,destination.id])
        if variant == "beach-ball" || variant == "laser-gun" { return NativeTntRules.separatedTargets(candidates,count:4,random:{ self.nextRandom() }) }
        var shuffled = candidates
        if shuffled.count > 1 { for index in stride(from:shuffled.count-1,through:1,by:-1) { shuffled.swapAt(index,min(index,Int(nextRandom()*Double(index+1)))) } }
        return Array(shuffled.prefix(4))
    }
    /// Source main merge callback after80ms absorb. Bonus targets are reserved later after blast return.
    public func commitSpecialActivation(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil,let plan = pendingSpecial,plan.id == transactionID,plan.generation == state.generation,plan.archetype == .tnt,!specialActivationCommitted else { return rejected("special_activation_not_ready") }
        let previousCombo = state.combo
        state.combo = min(99,state.combo+1); state.longestCombo = max(state.longestCombo,state.combo)
        state.earnedComboBonus = min(999999,state.earnedComboBonus+max(0,NativeRewardMath.streakBonus(state.combo)-NativeRewardMath.streakBonus(previousCombo)))
        comboLastMutationTime = specialMoveTime+0.08; comboWindow = 4
        let visual = NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination)
        let multiplier = visual == .star || visual == .juice ? 2 : plan.source.stackDepth+plan.destination.stackDepth
        state.score = min(999999,state.score+6*multiplier*max(1,state.combo)); state.bestScore = max(state.bestScore,state.score)
        state.moves = max(0,state.moves-1); state.cubesCracked += 1
        state.wildMeter += NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        var events = [NativeGameplayEvent(.comboChanged,value:state.combo)]
        state.tiles.removeAll { $0.id == plan.destination.id }
        spawnDirectWildMerge6(at:plan.destination.cell,archetype:plan.archetype,depth:multiplier,avoiding:plan.source.isWild ? plan.destination.value : plan.source.value,starOrbitCount:3,events:&events)
        specialActivationCommitted = true
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Select current real targets only at the source return/bonus boundary, then freeze IDs and faces.
    public func reserveTntTargets(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil,let initial = pendingSpecial,initial.id == transactionID,initial.generation == state.generation,initial.archetype == .tnt,specialActivationCommitted,!tntTargetsReserved else { return rejected("tnt_target_reservation_not_ready") }
        var targets = selectTntTargets(source:initial.source,destination:initial.destination,variant:initial.variant)
        if initial.variant == "laser-gun",let x = laserTargetX,let width = laserViewportWidth {
            pendingLaserShots = NativeLaserGunRules.plan(targets:targets,viewportWidth:width,x:x,random:{self.nextRandom()})
            let byID = Dictionary(uniqueKeysWithValues:targets.map{($0.id,$0)})
            targets = pendingLaserShots.compactMap{byID[$0.tileID]}
        }
        let values = NativeTntRules.replacementValues(targets:targets,random:{ self.nextRandom() })
        let plan = NativeSpecialMovePlan(id:initial.id,generation:initial.generation,revision:initial.revision,archetype:initial.archetype,variant:initial.variant,source:initial.source,destination:initial.destination,targets:targets,replacementValues:values)
        pendingSpecial = plan; tntTargetsReserved = true
        for tile in targets { if let index = state.tiles.firstIndex(where: { $0.id == tile.id }) { state.tiles[index].resolutionOwned = true } }
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.specialReserved,tileIDs:targets.map(\.id),archetype:.tnt,reason:plan.id,variant:plan.variant)],resolution:resolve())
    }
    /// Commit a captured TNT target in source order. No callback may select a new target or face.
    public func commitSpecialImpact(transactionID: String, tileID: String) -> NativeMoveResult {
        guard state.terminal == nil,let plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, plan.archetype == .tnt,tntTargetsReserved,
              specialImpactIndex < plan.targets.count, plan.targets[specialImpactIndex].id == tileID,
              let index = state.tiles.firstIndex(where: { $0.id == tileID }), state.tiles[index].resolutionOwned else { return rejected("stale_or_unowned_special_impact") }
        let target = plan.targets[specialImpactIndex]
        let value = plan.replacementValues[specialImpactIndex]
        let replacement: NativeTile
        if plan.variant == "laser-gun" { replacement = NativeTile(id:target.id,cell:target.cell,value:value) }
        else { replacement = freshTile(cell:target.cell,value:value) }
        state.tiles[index] = replacement
        let impactIndex = specialImpactIndex
        var meterEvents: [NativeGameplayEvent] = []
        if impactIndex < 2 {
            state.wildMeter += NativeWildMeterRules.increment(base:0.05,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        } else {
            let receipt = NativeMeterRewardReceipt(id:"\(plan.id):meter:\(impactIndex)",generation:state.generation,transactionID:plan.id,impactIndex:impactIndex,base:0.05,delay:0.4+Double(impactIndex-2)*0.1)
            pendingMeterRewards.append(receipt)
            meterEvents.append(NativeGameplayEvent(.meterRewardPrepared,tileIDs:[receipt.id],value:impactIndex,archetype:.tnt,reason:plan.id,variant:plan.variant))
        }
        specialImpactIndex += 1
        let stars = prepareHUDStars(count:1,origin:target.cell,variant:plan.variant)
        let impactedIDs = replacement.id == tileID ? [tileID] : [tileID,replacement.id]
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.specialImpact,tileIDs:impactedIDs,value:value,archetype:.tnt,reason:plan.id,variant:plan.variant),NativeGameplayEvent(.hudStarsPrepared,tileIDs:stars.map(\.id),value:stars.count,archetype:.tnt,variant:plan.variant)]+meterEvents,resolution:NativeResolution(.wait,reason:"special_gameplay_mutation_active"))
    }
    /// Source pull convergence removes consumed IDs before the 50ms respawn pause.
    public func prepareMagnetRespawn(transactionID: String) -> NativeMoveResult {
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
        let pulledCoreStar = plan.targets.first { $0.gameplayArchetype == .star && $0.variant == nil }
        let orbitCount = pulledCoreStar.map { max(1,min(3,$0.starOrbitCount)) } ?? 0
        let stars = prepareHUDStars(count:min(3,orbitCount+plan.targets.count),origin:plan.destination.cell,variant:plan.variant)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:plan.targets.map(\.id),archetype:.magnet,reason:plan.id,variant:plan.variant),NativeGameplayEvent(.hudStarsPrepared,tileIDs:stars.map(\.id),value:stars.count,archetype:.magnet,variant:plan.variant)],resolution:NativeResolution(.wait,reason:"magnet_respawn_pending"))
    }
    /// The native cascade invokes this at each authored 0/150/300/450ms open boundary.
    public func commitMagnetReplacement(transactionID: String, index: Int) -> NativeMoveResult {
        guard let plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, plan.revision == state.revision,
              let respawn = pendingMagnetRespawn, respawn.transactionID == transactionID, index == magnetReplacementIndex,
              respawn.replacements.indices.contains(index) else { return rejected("stale_or_unowned_magnet_replacement") }
        let tile = respawn.replacements[index]
        state.tiles.removeAll { $0.cell == tile.cell }; state.tiles.append(tile); magnetReplacementIndex += 1
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:tile.value,archetype:.magnet,reason:plan.id,variant:plan.variant)],resolution:NativeResolution(.wait,reason:"magnet_replacement_cascade_active"))
    }

    /// Finish one immutable Special transaction; release gameplay before its decorative tail.
    public func commitSpecialBoard(transactionID: String) -> NativeMoveResult {
        guard state.terminal == nil,let plan = pendingSpecial, plan.id == transactionID, plan.generation == state.generation, (plan.archetype == .tnt || plan.revision == state.revision),
              let pre = specialPreBoard, plan.archetype != .tnt || tntTargetsReserved && specialImpactIndex == plan.targets.count else { return rejected("special_board_commit_not_ready") }
        var events: [NativeGameplayEvent] = []
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
            state.tiles.removeAll { $0.id == plan.destination.id }
            state.tiles.append(respawn.survivor)
            events.append(NativeGameplayEvent(.spawned,tileIDs:[respawn.survivor.id],value:respawn.survivor.value))
            for tile in respawn.placeholders where state.tile(at:tile.cell) == nil {
                state.tiles.append(tile); events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:0))
            }
            let holder = NativeTile(id:plan.destination.id,cell:plan.destination.cell,value:6)
            let unpulled = pre.activeTiles.filter { $0.id != plan.source.id && $0.id != plan.destination.id && !ownedIDs.contains($0.id) }
            let progress = NativeMagnetRules.pullProgress(activeBeforePull:[holder]+unpulled,mergeTile:holder,pulledCount:plan.targets.count)
            if progress.addProgress { state.wildMeter += NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true) }
            else if progress.isLastMergeBeforePull { state.wildMeter = 0 }
        } else if plan.archetype != .tnt {
            state.tiles.removeAll { $0.id == plan.destination.id }
            if plan.archetype != .tnt { state.combo = min(99,oldCombo+1) }; state.cubesCracked += 1
            let visualFx = NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination)
            let multiplier = plan.archetype == .magnet || visualFx == .star || visualFx == .juice ? 2 : plan.source.stackDepth+plan.destination.stackDepth
            state.score = min(999999,state.score+6*multiplier*max(1,state.combo))
            spawnDirectWildMerge6(at:plan.destination.cell,archetype:plan.archetype,depth:multiplier,avoiding:avoiding,starOrbitCount:3,events:&events)
            state.wildMeter += NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage : state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
        }
        if plan.archetype != .tnt { state.moves = max(0,state.moves-1) }
        state.longestCombo = max(state.longestCombo,state.combo)
        if plan.archetype != .tnt { state.earnedComboBonus = min(999999,state.earnedComboBonus+max(0,NativeRewardMath.streakBonus(state.combo)-NativeRewardMath.streakBonus(oldCombo))) }
        state.bestScore = max(state.bestScore,state.score)
        if plan.archetype != .tnt { comboLastMutationTime = specialMoveTime; comboWindow = 4 }
        flags.pendingSpecialMutation = false; flags.wildMagnetPullInProgress = false
        pendingSpecial = nil; pendingLaserShots = []; pendingMagnetRespawn = nil; magnetReplacementIndex = 0; specialPreBoard = nil; tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = false
        events.append(NativeGameplayEvent(.comboChanged,value:state.combo))
        events.append(NativeGameplayEvent(.specialBoardCommitted,archetype:plan.archetype,reason:plan.id,variant:plan.variant))
        if state.wildMeter >= 1-0.000001 && rewardPicker != nil { _ = spawnMeterReward(events:&events) }
        let resolution = settleDeferredFinalMerge(events:&events)
        if resolution.kind == .fail { noMovesSignature = state.signature; events.append(NativeGameplayEvent(.noMovesCandidate,reason:resolution.reason)) }
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }

    private func settleDeferredFinalMerge(events: inout [NativeGameplayEvent]) -> NativeResolution {
        let resolution = resolve()
        guard pendingSpecial == nil,pendingMeterRewards.isEmpty,pendingOrdinaryStack == nil,pendingOrdinarySix == nil,pendingOrdinaryPostchecks.isEmpty,let captured = deferredFinalMerge else { return resolution }
        deferredFinalMerge = nil
        if resolution.kind == .complete {
            state.wildMeter = 0; state.terminal = captured; noMovesSignature = nil
            events.append(NativeGameplayEvent(.terminal,reason:captured.reason)); return captured
        }
        return resolution
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
    /// Called after the third sheet exits; the next meter reward is the authored top-row Wild Star.
    public func dismissTutorialFreePlayGuide() -> NativeMoveResult {
        guard state.tutorial?.active == true, state.tutorial?.step == .freePlay else { return rejected("tutorial_freeplay_guide_not_active") }
        state.tutorial?.waitingForWild = true
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    private func advanceTutorialAfterMerge(source: NativeTile, destination: NativeTile, events: inout [NativeGameplayEvent]) {
        guard var tutorial = state.tutorial, tutorial.active else { return }
        switch tutorial.step {
        case .stack:
            guard let merged = state.tile(at:destination.cell), merged.value == 5, let oneID = tutorial.oneTileID else { return }
            tutorial.step = .mergeSix; tutorial.guidedPair = [merged.id,oneID]
        case .mergeSix: tutorial.step = .freePlay; tutorial.guidedPair = []
        case .freePlay: break
        case .special:
            guard source.gameplayArchetype == .star || destination.gameplayArchetype == .star else { return }
            tutorial.active = false; tutorial.guideCompleted = true; tutorial.completionAssist = true; tutorial.guidedPair = []
        }
        state.tutorial = tutorial
    }
    /// Result acknowledgement is scoped to a tutorial run that actually completed its guide.
    public func acknowledgeTutorialResult() -> Bool {
        guard state.terminal != nil, state.tutorial?.guideCompleted == true else { return false }
        state.tutorial?.done = true; state.tutorial?.completionAssist = false; return true
    }
    public func claimTutorialFinalChance() -> NativeMoveResult {
        guard state.terminal == nil, !flags.isWaiting, let value = NativeTutorialRules.finalChanceValue(state:state) else { return rejected("tutorial_final_chance_unavailable") }
        let cells = NativeMagnetRules.emptyCells(state:state)
        guard !cells.isEmpty else { return rejected("tutorial_final_chance_no_cell") }
        let cell = cells[min(cells.count-1,Int(nextRandom()*Double(cells.count)))]
        state.revision &+= 1; state.tiles.removeAll { $0.cell == cell }; let tile = freshTile(cell:cell,value:value); state.tiles.append(tile)
        state.tutorial?.finalChanceSpawnCount += 1; noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:value,reason:"tutorial_final_chance")],resolution:resolve())
    }

    private func captureHUDStars(source: NativeTile, destination: NativeTile) -> [NativeHUDStarReceipt] {
        guard let wild = [source,destination].first(where: { $0.isWild }) else { return [] }
        let count: Int
        // Source reads the saved core special, preserving legacy BeachBall Juice provenance.
        if wild.archetype == .star { count = wild.variant == nil ? max(1,min(3,wild.starOrbitCount)) : 1 }
        else if wild.archetype == .juice { count = 1+Int(nextRandom()*3) }
        else { return [] }
        return prepareHUDStars(count:count,origin:destination.cell,variant:wild.variant)
    }
    private func prepareHUDStars(count: Int, origin: NativeCell, variant: String?) -> [NativeHUDStarReceipt] {
        hudStarSequence &+= 1
        let batch = "native-hud-star:\(state.generation):\(hudStarSequence)"
        let receipts = (0..<count).map { NativeHUDStarReceipt(id:"\(batch):\($0)",generation:state.generation,origin:origin,ordinal:$0,batchCount:count,variant:variant) }
        pendingHUDStars += receipts
        return receipts
    }
    /// Called only by the captured flight reaching98% of its HUD path. Terminal sealing does not revoke authored score arrivals.
    public func commitHUDStarArrival(receiptID: String, generation: UInt64) -> NativeMoveResult {
        guard generation == state.generation, let index = pendingHUDStars.firstIndex(where: { $0.id == receiptID && $0.generation == generation }) else { return rejected("stale_or_duplicate_hud_star") }
        let receipt = pendingHUDStars.remove(at:index)
        state.score = min(999999,state.score+100); state.bestScore = max(state.bestScore,state.score)
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.hudStarArrived,tileIDs:[receipt.id],value:100,variant:receipt.variant)],resolution:resolve())
    }

    public func claimMeterReward() -> NativeMoveResult {
        // Source meter permission checks logical owners, not the remaining Wild-only FX input lock.
        let directOwnershipSettled=pendingDirectWild == nil || (directWildGameplayCommitted && directWildSpawnPhase == nil && pendingDirectWild?.isFinal == false)
        guard state.terminal == nil, !flags.isWaiting, directOwnershipSettled,
              !sourceMeterBlocksAnotherSpawn, pendingOrdinaryStack == nil, pendingOrdinarySix == nil, state.wildMeter >= 1-0.000001 else { return rejected("wild_meter_not_ready") }
        if stagedMeterDrops && stagedMeterOpen {return beginMeterOpenFlow()}
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
              state.validationIssues().isEmpty, resolve().kind == .fail else { noMovesSignature = nil; return rejected("no_moves_confirmation_cancelled") }
        setInputLock("terminal-no-moves", active: true)
        guard state.signature == signature, resolve().kind == .fail else { setInputLock("terminal-no-moves", active: false); noMovesSignature = nil; return rejected("no_moves_final_commit_cancelled") }
        let resolution = resolve()
        state.terminal = resolution; noMovesSignature = nil
        return NativeMoveResult(accepted: true, state: state, events: [NativeGameplayEvent(.terminal, reason: resolution.reason)], resolution: resolution)
    }
    private func rejected(_ reason: String) -> NativeMoveResult { NativeMoveResult(accepted: false, state: state, events: [NativeGameplayEvent(.blocked, reason: reason)], resolution: NativeResolution(.wait, reason: reason)) }
    private func nextRandom() -> Double {
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
    private func spawnDirectWildMerge6(at cell: NativeCell, archetype: NativeWildArchetype, depth: Int, avoiding: Int, starOrbitCount: Int, events: inout [NativeGameplayEvent]) {
        if stagedDirectWildAssignments,committingDirectWild,let plan=pendingDirectWild,!plan.isFinal,(archetype == .star || archetype == .juice) {
            beginDirectWildSpawnPhases(plan:plan,depth:depth,avoiding:avoiding,orbitCount:starOrbitCount,events:&events)
            return
        }
        let lockedCount = state.tiles.filter { $0.locked && !$0.isWild && !$0.pendingRemoval && !$0.resolutionOwned }.count
        let lockedEmptyCount = state.tiles.filter { $0.locked && $0.value <= 0 && !$0.isWild && !$0.pendingRemoval }.count
        let multiplier = NativeSpawnRules.wildEndgameMultiplier(depth,isWild:true,lockedEmptyCount:lockedEmptyCount,isLastMerge:false)
        let arcadeSimple = state.mode == .arcade && archetype != .magnet
        let endgame = lockedCount == 0
        let bonus = NativeSpawnRules.wildBonus(archetype:archetype,isLastMerge:false,isArcadeSimpleWild:arcadeSimple,isFinalWildSnapshot:false,starOrbitCount:starOrbitCount)
        // The source creates bonus placeholders while primary-open work yields;
        // freeze its final logical allocation before visual spawning begins.
        let primaryValue = randomValue(excluding:avoiding)
        createLockedBonus(count:bonus.locked,excluding:cell,events:&events)
        let primary = freshTile(cell:cell,value:primaryValue); state.tiles.append(primary)
        events.append(NativeGameplayEvent(.spawned,tileIDs:[primary.id],value:primary.value))
        if !endgame && !arcadeSimple { openLocked(count:max(0,multiplier-1),avoiding:avoiding,events:&events) }
        if endgame && !arcadeSimple && archetype == .juice {
            for _ in 0..<2 {
                let available = NativeMagnetRules.emptyCells(state:state,excluding:[cell])
                guard !available.isEmpty else { break }
                let target = available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
                state.tiles.removeAll { $0.cell == target }
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
        // Existing Source wildSpawnInProgress blocks only another meter spawn;
        // ordinary moves/charge credit remain valid while the first die flies.
        if sourceMeterBlocksAnotherSpawn {return true}
        if stagedMeterDrops && stagedMeterOpen {
            let result=beginMeterOpenFlow();events += result.events;return result.accepted
        }
        guard rewardPicker != nil || state.tutorial?.waitingForWild == true else { return false }
        let available = NativeMagnetRules.emptyCells(state:state,excluding:sourceMeterDropExcludedCells)
        guard !available.isEmpty else { return false }
        let cell = state.tutorial?.waitingForWild == true ? (NativeTutorialRules.preferredWildCell(state:state) ?? available[min(available.count-1,Int(nextRandom()*Double(available.count)))]) : available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
        let choice = state.tutorial?.waitingForWild == true ? NativeWildRewardChoice(.star) : rewardPicker?(state,nextRandom(),{ self.nextRandom() })
        guard let reward = choice, reward.variant == nil || NativeSpecialDiceRegistry.compatibleVariant(reward.variant!,core:reward.archetype) != nil else { return false }
        state.tiles.removeAll { $0.cell == cell }
        var tile = freshTile(cell:cell,value:6); tile.archetype = reward.archetype; tile.variant = reward.variant
        if reward.archetype == .star { tile.starOrbitCount = reward.variant == nil ? 1+Int(nextRandom()*3) : 1 }
        if stagedMeterDrops {
            // Source openAtCell(skipSpawnAnimation:true) creates a hidden die,
            // then consumeWildCharge subtracts exactly one, retaining surplus.
            tile.visible=false;tile.alpha=0
            state.tiles.append(tile);state.wildMeter=max(0,state.wildMeter-1)
            meterDropSequence &+= 1
            let drop=NativeMeterDropReservation(id:"native-meter-drop:\(state.generation):\(meterDropSequence)",
                generation:state.generation,tileID:tile.id,cell:tile.cell,archetype:reward.archetype,variant:reward.variant)
            meterDropReservations[drop.id]=drop
            events.append(NativeGameplayEvent(.meterDropReserved,tileIDs:[tile.id],value:6,archetype:reward.archetype,reason:drop.id,variant:reward.variant))
            return true
        }
        state.tiles.append(tile); state.wildMeter = max(0,state.wildMeter-1); state.wildSpawnCount += 1
        if state.lastWildDropType == reward.archetype { state.wildDropTypeStreak += 1 } else { state.lastWildDropType = reward.archetype; state.wildDropTypeStreak = 1 }
        if state.tutorial?.waitingForWild == true {
            state.tutorial?.waitingForWild = false; state.tutorial?.step = .special; state.tutorial?.wildTileID = tile.id
            state.tutorial?.guidedPair = [tile.id]
        }
        events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:6,archetype:reward.archetype,variant:reward.variant))
        return true
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
        guard generation==state.generation,var drop=meterDropReservations[id],drop.generation==generation,
              let index=state.tiles.firstIndex(where:{$0.id==drop.tileID}) else {return rejected("stale_meter_drop_receipt")}
        let kind:NativeGameplayEvent.Kind
        switch receipt {
        case .assetsPrepared:
            guard !drop.assetsPrepared,!drop.dropCompleted else {return rejected("duplicate_meter_drop_prepare")}
            drop.assetsPrepared=true;kind = .meterDropPrepared
        case .revealed:
            guard drop.assetsPrepared,!drop.revealed,!drop.dropCompleted else {return rejected("duplicate_meter_drop_reveal")}
            drop.revealed=true;state.tiles[index].visible=true;state.tiles[index].alpha=1;kind = .meterDropRevealed
        case .impact:
            guard drop.assetsPrepared,drop.revealed,!drop.impactOccurred,!drop.dropCompleted else {return rejected("duplicate_meter_drop_impact")}
            drop.impactOccurred=true;kind = .meterDropImpact
        case .boardFallbackRestored:
            guard drop.assetsPrepared,!drop.landed,!drop.dropCompleted else {return rejected("duplicate_meter_drop_restore")}
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
            drop.bookkeepingCommitted=true;state.wildSpawnCount += 1
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
    public static func regularMerge6SpawnCount(_ multiplier: Int) -> Int { min(3, max(2, multiplier - 1)) }
    public static func shouldSpawnAtDestination(isLastMerge: Bool, isFinalMerge: Bool, multiplier: Int, isEndgameMode: Bool, isArcadeSimpleWild: Bool) -> Bool { !isLastMerge && !isFinalMerge && multiplier > 0 && (isEndgameMode || isArcadeSimpleWild) }
    public static func wildEndgameMultiplier(_ multiplier: Int, isWild: Bool, lockedEmptyCount: Int, isLastMerge: Bool) -> Int { isWild && lockedEmptyCount <= 0 && multiplier > 1 && !isLastMerge ? 1 : multiplier }
    public static func wildBonus(archetype: NativeWildArchetype?, isLastMerge: Bool, isArcadeSimpleWild: Bool, isFinalWildSnapshot: Bool, starOrbitCount: Int = 3) -> (locked: Int, active: Int) {
        guard let archetype, !isLastMerge, !isArcadeSimpleWild, !isFinalWildSnapshot else { return (0, 0) }
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
        }
        var events:[NativeGameplayEvent]=[]
        let resolution=settleDeferredFinalMerge(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolution)
    }
    private func stageOrdinarySix(source:NativeTile,destination:NativeTile,now:Double,isFinal:Bool)->NativeMoveResult {
        guard pendingOrdinarySix==nil else{return rejected("regular_merge6_handoff")}
        if let ordinarySixPresentationAdmitted,!ordinarySixPresentationAdmitted() {return rejected("native_ordinary_six_presentation_not_ready")}
        specialSequence &+= 1;state.revision &+= 1
        let plan=NativeOrdinaryMovePlan(id:"native-six:\(state.generation):\(specialSequence)",generation:state.generation,revision:state.revision,source:source,destination:destination,startedAt:now,isFinal:isFinal)
        pendingOrdinarySix=plan;ordinarySixGameplayCommitted=false
        if let i=state.tiles.firstIndex(where:{$0.id==source.id}) {state.tiles[i].pendingRemoval=true;state.tiles[i].resolutionOwned=true}
        if let i=state.tiles.firstIndex(where:{$0.id==destination.id}) {
            state.tiles[i].value=6;state.tiles[i].stackDepth=isFinal ? 1:min(4,source.stackDepth+destination.stackDepth)
            state.tiles[i].merge6CleanupOwned=true;state.tiles[i].nonFinalMerge6 = !isFinal;state.tiles[i].visible = !isFinal
        }
        noMovesSignature=nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.ordinarySixReserved,tileIDs:[source.id,destination.id],value:6,reason:plan.id)],resolution:resolve())
    }
    /// Renderer calls only once every owned spawn/cleanup receipt actually settles.
    public func commitOrdinarySpawnArrival(receiptID:String,generation:UInt64,tileID:String)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,ordinarySixGameplayCommitted,pendingOrdinarySpawns.remove(tileID) != nil else{return rejected("stale_ordinary_spawn_arrival")}
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    public func releaseOrdinarySixHandoff(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingOrdinarySix,plan.id==receiptID,plan.generation==generation,ordinarySixGameplayCommitted,pendingOrdinarySpawns.isEmpty,!ordinarySpawnPreparationPending,pendingOrdinaryAssignments.isEmpty,pendingOrdinaryPrimaryArrival==nil else{return rejected("stale_ordinary_six_handoff")}
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
        let destinationCarrier=state.tiles.first{$0.id==plan.destination.id}
        state.tiles.removeAll{$0.id==plan.source.id || $0.id==plan.destination.id}
        if holdsEndgameDestination,let destinationCarrier {state.tiles.append(destinationCarrier)}
        ordinarySixGameplayCommitted=true
        var events=[NativeGameplayEvent(.merged,tileIDs:[plan.source.id,plan.destination.id],value:6,reason:plan.id),NativeGameplayEvent(.comboChanged,value:state.combo),NativeGameplayEvent(.removed,tileIDs:holdsEndgameDestination ? [plan.source.id]:[plan.source.id,plan.destination.id])]
        if holdsEndgameDestination {
            pendingOrdinaryDestinationCleanup=NativeOrdinaryPostcheckReceipt(id:plan.id,generation:plan.generation,delayMilliseconds:100)
            events.append(NativeGameplayEvent(.ordinaryDestinationCleanupPrepared,value:100,reason:plan.id))
        }
        advanceTutorialAfterMerge(source:plan.source,destination:plan.destination,events:&events)
        if plan.isFinal {
            let terminal=NativeResolution(.complete,reason:"final_regular_merge6",target:state.mode == .arcade ? "arcade-stage":"journey-board")
            if pendingSpecial != nil || !pendingMeterRewards.isEmpty || !pendingOrdinaryPostchecks.isEmpty {deferredFinalMerge=terminal;return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())}
            state.wildMeter=0;state.terminal=terminal;events.append(NativeGameplayEvent(.terminal,reason:terminal.reason))
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:terminal)
        }
        // BoardMutationEpochOwner rejects old spawn permits after a newer accepted stack.
        if epochCurrent && stagedOrdinaryAssignments {
            ordinarySpawnPreparationPending=true
            events.append(NativeGameplayEvent(.ordinarySpawnsPrepareRequested,value:50,reason:plan.id))
        } else if epochCurrent {
            spawnRegularMerge6(at:plan.destination.cell,depth:depth,events:&events)
            pendingOrdinarySpawns.formUnion(events.filter{$0.kind == .spawned}.flatMap(\.tileIDs))
        }
        state.wildMeter += NativeWildMeterRules.increment(base:0.22,mode:state.mode,board:state.mode == .arcade ? state.stage:state.board,spawnCount:state.wildSpawnCount,tutorialSlow:state.tutorial?.completionAssist == true)
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
        if locked.isEmpty {
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
        pendingOrdinaryAssignments.removeFirst()
        var events:[NativeGameplayEvent]=[]
        // Source primary beforeSpawn retires its captured old destination before epoch permit issuance.
        if first.kind == .endgamePrimary,let holder=state.tile(at:first.cell),holder.id==plan.destination.id,holder.merge6CleanupOwned {
            state.tiles.removeAll{$0.id==holder.id}
            events.append(NativeGameplayEvent(.removed,tileIDs:[holder.id]))
        }
        guard state.terminal==nil,state.revision==plan.revision else {
            ordinaryRefillRemaining=0
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
        }
        if first.kind == .locked || first.kind == .forcedLocked {
            if let index=state.tiles.firstIndex(where:{$0.id==first.tileID && $0.locked}) {
                let value=randomValue();state.tiles[index].locked=false;state.tiles[index].value=value;state.tiles[index].stackDepth=1
                state.tiles[index].archetype=nil;state.tiles[index].variant=nil;state.tiles[index].alpha=1;state.tiles[index].visible=true
                // resetTileToNormalState releases registry resolution; TNT's independent bonus reservation survives.
                let reopenedID=state.tiles[index].id
                state.tiles[index].resolutionOwned=pendingSpecial.map{special in special.archetype == .tnt && special.targets.dropFirst(specialImpactIndex).contains{$0.id==reopenedID}} ?? false
                state.tiles[index].magnetOwned=false;state.tiles[index].transientSpawn=false
                events.append(NativeGameplayEvent(.spawned,tileIDs:[state.tiles[index].id],value:value,reason:first.id))
                ordinarySuccessfulOpenings+=1
            }
            if pendingOrdinaryAssignments.isEmpty {finishOrdinaryLockedBatch(plan:plan,events:&events)}
        } else {
            // openAtCellCore refuses a valued/current active holder before drawing a face.
            if let holder=state.tile(at:first.cell),holder.value>0 || holder.isWild || !holder.locked {
                ordinaryRefillRemaining=0
                return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
            }
            state.tiles.removeAll{$0.cell==first.cell}
            let tile=freshTile(cell:first.cell,value:randomValue());state.tiles.append(tile)
            pendingOrdinaryPrimaryArrival=first
            events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:tile.value,reason:first.id))
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
        if interrupted {ordinaryRefillRemaining=0}else{continueOrdinaryRefill(plan:plan,events:&events)}
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
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
    private func continueOrdinaryRefill(plan:NativeOrdinaryMovePlan,events:inout [NativeGameplayEvent]) {
        guard ordinaryRefillRemaining>0,state.revision==plan.revision,state.terminal==nil else{ordinaryRefillRemaining=0;return}
        ordinaryRefillRemaining-=1
        let cells=NativeMagnetRules.emptyCells(state:state,excluding:[plan.destination.cell])
        guard !cells.isEmpty else{ordinaryRefillRemaining=0;return}
        let cell=cells[min(cells.count-1,Int(nextRandom()*Double(cells.count)))]
        let slot=ordinaryAssignment(plan:plan,cell:cell,tileID:nil,kind:.remainderPrimary,delay:0)
        pendingOrdinaryAssignments.append(slot)
        events.append(NativeGameplayEvent(.ordinaryAssignmentsPrepared,tileIDs:[slot.id],reason:plan.id))
    }
}

extension NativeGameplayEngine {
    private func beginDirectWildSpawnPhases(plan:NativeDirectWildMovePlan,depth:Int,avoiding:Int,orbitCount:Int,events:inout [NativeGameplayEvent]) {
        let mode:NativeWildSpawnPhaseOwner.Mode=state.mode == .arcade ? .arcade:state.tiles.contains{$0.locked} ? .normal:.endgame
        // The original transient dst placeholder exists when the multiplier law is evaluated.
        let emptyCount=state.tiles.filter{$0.locked && $0.value<=0}.count+1
        let count=NativeSpawnRules.wildEndgameMultiplier(depth,isWild:true,lockedEmptyCount:emptyCount,isLastMerge:false)
        let phase=NativeWildSpawnPhaseOwner(id:plan.id,generation:plan.generation,mode:mode,archetype:plan.archetype,spawnCount:count,orbitCount:orbitCount)
        directWildPrimaryRecovery=NativeWildPrimaryRecoveryOwner(id:plan.id,generation:plan.generation,mode:mode == .normal ? .normal:.endgame);_=directWildPrimaryRecovery?.begin()
        directWildSpawnPhase=phase;directWildSpawnAvoiding=avoiding;directWildSpawnRevision=state.revision;directWildVisualReleased=false
        wildPhaseScheduledID=nil;wildPhaseOpened=0;wildActionSequence=0;wildRemainderExcluded=[plan.destination.cell]
        _=phase.begin();pumpWildSpawnPhases(events:&events)
        // Normal primary enters before this source bonus coroutine yields; endgame primary waits50ms.
        if mode == .normal,let action=pendingWildSpawnActions.first,action.delayMilliseconds==0 {
            let result=commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id)
            events += result.events
        }
        let bonus=NativeSpawnRules.wildBonus(archetype:plan.archetype,isLastMerge:false,isArcadeSimpleWild:mode == .arcade,isFinalWildSnapshot:false,starOrbitCount:orbitCount)
        var empty:[NativeCell]=[]
        for row in 0..<state.rows {for column in 0..<state.columns {let cell=NativeCell(column:column,row:row);if cell != plan.destination.cell && state.tile(at:cell)==nil {empty.append(cell)}}}
        let referenceAlpha=state.tiles.first{$0.locked && $0.value<=0 && $0.alpha.isFinite}?.alpha
        let allocations=NativeWildLockedBonusRules.allocate(count:bonus.locked,emptyCells:empty,referenceAlpha:referenceAlpha,admitted:{self.state.terminal==nil && self.state.revision==self.directWildSpawnRevision && (self.wildSpawnPermitAdmission?(.bonus) ?? true)},isEmpty:{self.state.tile(at:$0)==nil},random:{self.nextRandom()})
        for allocation in allocations {
            var tile=freshTile(cell:allocation.cell,value:0);tile.id += ":locked";tile.locked=true;tile.alpha=allocation.alpha;state.tiles.append(tile)
            pendingWildLockedBonusPresentations.append(.init(tileID:tile.id,transactionID:plan.id,generation:plan.generation,alpha:allocation.alpha,direction:allocation.direction,delayMilliseconds:allocation.delayMilliseconds))
            events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:0,reason:plan.id+":locked-bonus"))
        }
        if !allocations.isEmpty {events.append(NativeGameplayEvent(.wildLockedBonusPrepared,tileIDs:pendingWildLockedBonusPresentations.map(\.tileID),reason:plan.id))}
    }
    private func wildAction(phase:NativeWildSpawnPhaseOwner.Command,kind:NativeWildSpawnAction.Kind,cell:NativeCell?,tileID:String?=nil,delay:Int)->NativeWildSpawnAction {
        wildActionSequence+=1
        return NativeWildSpawnAction(id:"\(phase.id):action:\(wildActionSequence)",transactionID:directWildSpawnPhase!.id,generation:phase.generation,phaseID:phase.id,kind:kind,cell:cell,tileID:tileID,delayMilliseconds:delay)
    }
    /// Owns the live selection boundary; the renderer never derives an opening from a stale snapshot.
    private func pumpWildSpawnPhases(events:inout [NativeGameplayEvent]) {
        guard let phase=directWildSpawnPhase,let plan=pendingDirectWild else{return}
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
            case .juiceSafety:_=phase.acknowledgeJuiceSafety(commandID:command.id,generation:state.generation);continue
            case .minimumActive:_=phase.acknowledgeMinimum(commandID:command.id,generation:state.generation,activeCount:state.tiles.filter(\.isActive).count);continue
            case .remainderWait:
                pendingWildSpawnActions=[wildAction(phase:command,kind:.wait,cell:nil,delay:command.delayMilliseconds)]
            case .primary:
                guard let recovery=directWildPrimaryRecovery else{return}
                if recovery.complete {
                    _=phase.acknowledgePrimaryReturnedFalse(commandID:command.id,generation:state.generation)
                    directWildPrimaryRecovery=nil;continue
                }
                guard let recoveryCommand=recovery.command else{return}
                if recoveryCommand.kind == .verifyActive {
                    _=recovery.acknowledgeVerification(commandID:recoveryCommand.id,generation:state.generation,activeAtReservedCell:state.tile(at:plan.destination.cell)?.isActive == true)
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
    public func commitWildSpawnAction(transactionID:String,generation:UInt64,actionID:String)->NativeMoveResult {
        guard generation==state.generation,let plan=pendingDirectWild,plan.id==transactionID,let phase=directWildSpawnPhase,phase.generation==generation,
              let command=phase.command,let action=pendingWildSpawnActions.first,action.id==actionID,action.phaseID==command.id else{return rejected("stale_wild_spawn_action")}
        pendingWildSpawnActions.removeFirst();if pendingWildSpawnActions.isEmpty {wildPhaseScheduledID=nil};var events:[NativeGameplayEvent]=[]
        let current=state.terminal==nil && state.revision==directWildSpawnRevision
        if flags.busyEnding,command.kind == .primary,
           phase.acknowledgeTerminalOwnerBoundary(commandID:command.id,generation:generation) {
            pumpWildSpawnPhases(events:&events)
            return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
        }
        switch action.kind {
        case .wait:_=phase.acknowledgeRemainderWait(commandID:command.id,generation:generation)
        case .locked:
            if current,(wildSpawnPermitAdmission?(.locked) ?? true),let index=state.tiles.firstIndex(where:{$0.id==action.tileID && $0.locked}) {
                let value=randomValue(excluding:directWildSpawnAvoiding)
                state.tiles[index].locked=false;state.tiles[index].value=value;state.tiles[index].stackDepth=1;state.tiles[index].archetype=nil;state.tiles[index].variant=nil
                state.tiles[index].resolutionOwned=false;state.tiles[index].magnetOwned=false;state.tiles[index].alpha=1;state.tiles[index].visible=true;state.tiles[index].transientSpawn=false
                wildPhaseOpened+=1;events.append(NativeGameplayEvent(.spawned,tileIDs:[state.tiles[index].id],value:value,reason:action.id))
            }
            if pendingWildSpawnActions.isEmpty {
                if command.kind == .emergencyFallback {_=phase.acknowledgeEmergencyFallback(commandID:command.id,generation:generation)}
                else {_=phase.acknowledgeLockedBatch(commandID:command.id,generation:generation,openedCount:wildPhaseOpened)}
            }
        case .primary:
            // Source evaluates explicit Wild value arguments before its epoch permit check.
            let value=randomValue(excluding:directWildSpawnAvoiding)
            if current,(wildSpawnPermitAdmission?(.primary) ?? true),let cell=action.cell,state.tile(at:cell).map({$0.locked && $0.value<=0 && !$0.isWild}) ?? true {
                state.tiles.removeAll{$0.cell==cell};let tile=freshTile(cell:cell,value:value);state.tiles.append(tile)
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
            if allowed,let cell=action.cell,state.tile(at:cell).map({$0.locked && $0.value<=0 && !$0.isWild}) ?? true {
                state.tiles.removeAll{$0.cell==cell};let value=randomValue(excluding:directWildSpawnAvoiding),tile=freshTile(cell:cell,value:value);state.tiles.append(tile);spawned=true
                _=phase.acknowledgeConsumedIdentitiesRetired(generation:generation)
                _=phase.acknowledgeHardPrimary(commandID:command.id,generation:generation)
                if phase.ordinaryInputReleased {locks[plan.id]=true}
                events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:value,reason:action.id))
            }
            _=recovery.acknowledgeHardFallback(commandID:recoveryCommand.id,generation:generation,spawned:spawned)
            if spawned {directWildPrimaryRecovery=nil}
        }
        // The original successful spawnBounce draws its direction after authoritative face
        // assignment, before subsequent bonus/continuation selection. Renderer must reuse it.
        for event in events where command.kind != .emergencyFallback && event.kind == .spawned && (event.value ?? 0)>0 {
            for tileID in event.tileIDs {pendingWildSpawnPresentations.append(.init(tileID:tileID,transactionID:plan.id,generation:generation,direction:nextRandom()<0.5 ? 1:-1,sourceLevelFlowReinforcement:[.baseLocked,.extraLocked,.remainderFallback,.emergencyLocked].contains(command.kind)))}
        }
        pumpWildSpawnPhases(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    public func finishWildSpawnArrival(transactionID:String,generation:UInt64,arrivalID:String,interrupted:Bool=false)->NativeMoveResult {
        if interrupted, generation==state.generation,let plan=pendingDirectWild,plan.id==transactionID,let phase=directWildSpawnPhase,
           pendingWildSpawnArrivals.contains(where:{$0.id==arrivalID && $0.generation==generation}) {
            phase.cancelForLifecycle();wildSourceResolutionBoundary=(plan.id,generation)
            pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];wildPhaseScheduledID=nil
            // Original primary promise rejection cancels its reservation: no committed primary accounting.
            // Retain all-input ownership until exact-ID lifecycle abort recovery; never manufacture arrival.
            if phase.primaryArrived {
                directWildSpawnPhase=nil
                if directWildVisualReleased {locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false}
            }
            return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
        }
        guard generation==state.generation,let plan=pendingDirectWild,plan.id==transactionID,let phase=directWildSpawnPhase,
              let index=pendingWildSpawnArrivals.firstIndex(where:{$0.id==arrivalID && $0.generation==generation}) else{return rejected("stale_wild_spawn_arrival")}
        let arrival=pendingWildSpawnArrivals[index]
        if !phase.primaryArrived,let recovery=directWildPrimaryRecovery,let c=recovery.command {
            let active=state.tiles.contains{$0.id==arrival.tileID && $0.cell==arrival.cell && $0.isActive}
            _=recovery.acknowledgeAwaited(commandID:c.id,generation:generation,spawned:active)
            if !active {
                guard phase.revokePrimaryAssignment(arrivalID:arrivalID,generation:generation) else{return rejected("wild_primary_retry_not_owned")}
                pendingWildSpawnArrivals.remove(at:index);wildPhaseScheduledID=nil
                var events:[NativeGameplayEvent]=[];pumpWildSpawnPhases(events:&events)
                return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
            }
            if let verify=recovery.command {_=recovery.acknowledgeVerification(commandID:verify.id,generation:generation,activeAtReservedCell:true)}
            directWildPrimaryRecovery=nil
        }
        guard phase.acknowledgeArrival(arrivalID,generation:generation) else{return rejected("stale_wild_spawn_arrival")}
        pendingWildSpawnArrivals.remove(at:index)
        if phase.ordinaryInputReleased {locks[plan.id]=true}
        var events:[NativeGameplayEvent]=[];pumpWildSpawnPhases(events:&events)
        return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
    }
    /// Matches explicit source abort-recovery; only captured consumed identities may be retired.
    private func abortUncommittedDirectWildForLifecycle(plan:NativeDirectWildMovePlan) {
        guard plan.generation==state.generation,pendingDirectWild?.id==plan.id,
              let phase=directWildSpawnPhase,(phase.cancelled || phase.complete),!phase.primaryArrived else{return}
        let consumed:Set<String>=[plan.source.id,plan.destination.id]
        state.tiles.removeAll{consumed.contains($0.id)}
        directWildSpawnPhase=nil;pendingWildSpawnActions=[];pendingWildSpawnArrivals=[];wildPhaseScheduledID=nil
        locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false
    }
    private func settleWildSpawnContinuation() {
        guard directWildSpawnPhase?.complete == true,directWildSpawnPhase?.primaryArrived == true,let plan=pendingDirectWild else{return}
        directWildSpawnPhase=nil;wildPhaseScheduledID=nil;pendingWildSpawnActions=[]
        if directWildVisualReleased {locks.removeValue(forKey:plan.id);pendingDirectWild=nil;directWildGameplayCommitted=false}
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
    private func sourceNoMovesGuard(initial:String)->NativeNoMovesCandidateOwner.Guard {
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
        result.freshCheckFailed = !state.validationIssues().isEmpty
        result.wildContinuation=sourceMeterSpawnInProgress || state.wildMeter>=1-0.000001 || flags.wildSpawnInProgress || sourceSaveRuntime.wildSpawnInProgress || sourceWildRetryPending || sourceSaveRuntime.wildDropInProgress
        result.gameplayTransaction=sourceMeterSpawnInProgress || flags.wildSpawnInProgress || flags.merge6SpawnInProgress || flags.wildMagnetPullInProgress || sourceSaveRuntime.wildSpawnInProgress || sourceSaveRuntime.merge6SpawnInProgress || sourceSaveRuntime.wildMagnetPullInProgress || sourceSaveRuntime.specialTransactionActive || sourceSaveRuntime.regularHandoffActive || pendingOrdinaryStack != nil || pendingOrdinarySix != nil || directWildSpawnPhase != nil || pendingSpecial != nil || (pendingDirectWild != nil && !directWildGameplayCommitted)
        result.activeDrag=drag != nil || sourceSaveRuntime.activeDrag
        result.endgameGuard=flags.endgameGuardActive
        return result
    }
    public func beginSourceNoMovesForOrdinaryPostcheck(receiptID:String,generation:UInt64)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesReadyPostchecks.remove(receiptID) != nil,let context=sourceNoMovesStackContexts.removeValue(forKey:receiptID) else{return .ignored}
        return beginSourceNoMoves(origin:.ordinaryPostcheck(context))
    }
    public func beginSourceNoMoves(origin:NativeNoMovesOrigin,extraWaitMilliseconds:Int=0)->NativeNoMovesCandidateOwner.Effect {
        guard stagedSourceNoMoves,state.terminal==nil,sourceNoMovesConfirmed==nil else{return .ignored}
        if sourceNoMovesOwner.active != nil || flags.busyEnding || sourceSaveRuntime.busyEnding {return .ignored}
        let snapshot=sourceNoMovesGuard(initial:sourceGameplaySignature.key)
        // Source preflight can defer Wild before candidate allocation.
        if let block=snapshot.blockReason{return .deferred(block)}
        guard let trigger=NativeNoMovesTriggerClassifier.classify(state:state,origin:origin,runtime:sourceNoMovesEffectiveTileRuntime) else{return .ignored}
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
            sourceNoMovesConfirmedResolution=NativeSourceEndgameChecker.check(state:state,runtime:sourceNoMovesEffectiveTileRuntime)
        }
        return effect
    }
    /// Source confirmedFailFlow awaits the real board exit and checks generation.
    /// This receipt does not rerun RNG, mutate moves, or freshly select a failure.
    public func finishSourceNoMovesBoardExit(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64)->NativeMoveResult {
        guard stagedSourceNoMoves,generation==state.generation,sourceNoMovesGeneration==generation,sourceNoMovesConfirmed==plan,let result=sourceNoMovesConfirmedResolution,state.terminal==nil else{return rejected("stale_source_no_moves_board_exit")}
        state.terminal=result;sourceNoMovesConfirmed=nil;sourceNoMovesConfirmedResolution=nil;sourceNoMovesGeneration=nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.terminal,reason:result.reason)],resolution:result)
    }
    private func applySourceNoMovesEffect(_ effect:NativeNoMovesCandidateOwner.Effect)->NativeNoMovesCandidateOwner.Effect {
        if case .rollback(_,_,let release)=effect {
            if release {setInputLock("terminal-no-moves",active:false);flags.busyEnding=false}
            sourceNoMovesGeneration=nil
        }
        return effect
    }
}

extension NativeGameplayEngine {
    private var hasSourceMeterLastMerge:Bool {
        if state.tiles.contains(where:{sourceMeterLastMergeTileIDs.contains($0.id) && !(noMovesTileRuntime[$0.id]?.destroyed ?? false)}) {return true}
        let runtime=sourceNoMovesEffectiveTileRuntime
        let active=state.tiles.filter{NativeSourceEndgameChecker.active($0,runtime:runtime[$0.id] ?? .init())}
        return active.count==1 && active[0].value==6
    }
    private var meterOpenCancelled:Bool {
        guard let flow=meterOpenFlow else{return true}
        return flow.spawnToken != sourceMeterSpawnCancelToken || flow.queueCanceled || flags.busyEnding || hasSourceMeterLastMerge
    }
    private func beginMeterOpenFlow()->NativeMoveResult {
        guard stagedMeterDrops,stagedMeterOpen,meterOpenFlow==nil,state.terminal==nil,!flags.busyEnding,!hasSourceMeterLastMerge else{return rejected("meter_open_not_admitted")}
        meterOpenSequence &+= 1
        meterOpenFlow=MeterOpenFlow(id:"native-meter-open:\(state.generation):\(meterOpenSequence)",generation:state.generation,spawnToken:sourceMeterSpawnCancelToken,excluded:sourceMeterDropExcludedCells)
        return prepareMeterOpenAttempt()
    }
    private func prepareMeterOpenAttempt()->NativeMoveResult {
        guard var flow=meterOpenFlow,flow.generation==state.generation else{return rejected("stale_meter_open_flow")}
        if meterOpenCancelled {return finishMeterOpenFlow(reason:"source_meter_open_cancelled")}
        while flow.tries<12 {
            let available=NativeMagnetRules.emptyCells(state:state,excluding:flow.excluded)
            guard !available.isEmpty else {
                flow.tries+=1;meterOpenFlow=flow
                let retry=NativeMeterOpenRetry(id:flow.id+":empty:\(flow.tries)",generation:flow.generation,spawnToken:flow.spawnToken,milliseconds:40)
                pendingMeterOpenRetry=retry
                return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.meterDropOpenRetryPrepared,value:40,reason:retry.id)],resolution:resolve())
            }
            let cell=(state.tutorial?.waitingForWild == true && flow.tries==0) ? (NativeTutorialRules.preferredWildCell(state:state) ?? available[min(available.count-1,Int(nextRandom()*Double(available.count)))]) : available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
            if flow.attempted.contains(cell) {flow.tries+=1;continue}
            flow.attempted.insert(cell)
            let choice=state.tutorial?.waitingForWild == true ? NativeWildRewardChoice(.star):rewardPicker?(state,nextRandom(),{self.nextRandom()})
            guard let choice,choice.variant==nil || NativeSpecialDiceRegistry.compatibleVariant(choice.variant!,core:choice.archetype) != nil else{flow.tries+=1;continue}
            var tile=freshTile(cell:cell,value:6);tile.archetype=choice.archetype;tile.variant=choice.variant;tile.visible=false;tile.alpha=0
            if choice.archetype == .star {tile.starOrbitCount=choice.variant==nil ? 1+Int(nextRandom()*3):1}
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
            state.tiles.removeAll{$0.cell==request.tile.cell};state.tiles.append(opened)
            var events=[NativeGameplayEvent(.meterDropOpenCreated,tileIDs:[opened.id],archetype:request.tile.archetype,reason:id,variant:request.tile.variant)]
            if meterOpenCancelled {
                state.tiles.removeAll{$0.id==opened.id}
                events.append(NativeGameplayEvent(.meterDropOpenCanceled,tileIDs:[opened.id],reason:id))
                meterOpenFlow=nil;pendingMeterOpenRetry=nil
                return NativeMoveResult(accepted:true,state:state,events:events,resolution:resolve())
            }
            // Literal Source prepares authored audio/selected Juice after the
            // first token check, BEFORE live charge consumption. It does NOT
            // await these callbacks and rechecks cancellation after charge.
            meterOpenCommitting=true
            prepareCommitted?(opened)
            meterOpenCommitting=false
            guard generation==state.generation,meterOpenFlow?.id==flow.id else{return rejected("stale_meter_committed_preparation")}
            state.wildMeter=max(0,state.wildMeter-1)
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
