import Foundation

/// Pure state owner. SpriteKit reads receipts; animation completions never resolve a move again.
/// Special mutations use captured receipts and release gameplay independently of decorative tails.
public final class NativeGameplayEngine {
    public private(set) var state: NativeBoardState
    public var snapshot: NativeBoardState { state }
    public private(set) var flags = NativeGameplayRuntimeFlags()
    public private(set) var noMovesSignature: String?
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
    public var navigationLocked: Bool { noMovesSignature != nil || state.terminal != nil }
    public var isDragging: Bool { drag != nil }
    private struct Drag { let id: String; let pointerID: Int; let generation: UInt64; let revision: UInt64 }
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
              let tile = state.tiles.first(where: { $0.id == tileID }), tile.isPlayable,
              NativeTutorialRules.allowsPickup(tile,tutorial:state.tutorial,rows:state.rows),
              !locks.values.contains(where: { !$0 || tile.isWild }), (!flags.isWaiting || canRunOrdinaryDuringTnt(tile)) else { return false }
        noMovesSignature = nil
        drag = Drag(id: tileID, pointerID: pointerID, generation: state.generation, revision: state.revision)
        return true
    }
    public func cancelDrag() { drag = nil }
    public func cancelNoMovesConfirmation() { noMovesSignature = nil }
    public func restart(state fresh: NativeBoardState) {
        let generation = state.generation &+ 1
        state = fresh; state.generation = generation; state.revision = 0; state.terminal = nil; tileSequence = 0
        pendingSpecial = nil; pendingLaserShots = []; pendingMagnetRespawn = nil; magnetReplacementIndex = 0; specialPreBoard = nil; specialImpactIndex = 0
        pendingDirectWild = nil; directWildGameplayCommitted = false; committingDirectWild = false
        pendingOrdinaryStack = nil; pendingOrdinarySix = nil; ordinarySixGameplayCommitted = false; pendingOrdinaryPostchecks.removeAll(); pendingOrdinarySpawns.removeAll(); ordinarySpawnPreparationPending=false;pendingOrdinaryAssignments.removeAll();pendingOrdinaryPrimaryArrival=nil;pendingOrdinaryDestinationCleanup=nil;ordinaryRefillRemaining=0;ordinaryRequestedOpenings=0;ordinarySuccessfulOpenings=0;ordinaryForcedCandidates=[];ordinaryForcedPass=false; committingOrdinaryStack = false
        drag = nil; pendingHUDStars.removeAll(); pendingMeterRewards.removeAll(); tntReservationReleased = false; specialActivationCommitted = false; tntTargetsReserved = false; deferredFinalMerge = nil; locks.removeAll(); flags = NativeGameplayRuntimeFlags(); noMovesSignature = nil; comboLastMutationTime = nil
    }
    public func cancelForBackground() {
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
            _ = releaseDirectWildPresentation(transactionID:direct.id,generation:direct.generation)
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
        if state.terminal == nil && (pendingOrdinaryStack != nil || pendingOrdinarySix != nil || !pendingOrdinaryPostchecks.isEmpty) { return NativeResolution(.wait,reason:"ordinary_mutation_pending") }
        if state.terminal == nil && !pendingMeterRewards.isEmpty { return NativeResolution(.wait,reason:"captured_meter_reward_pending") }
        if state.terminal == nil && state.wildMeter >= 1-0.000001 && !flags.isWaiting { return NativeResolution(.wait,reason:"wild_continuation_pending") }
        let resolution = NativeGameplayResolver.resolve(state: state, flags: flags)
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
        guard let target, let source = state.tiles.first(where: { $0.id == owned.id }), let destination = state.tile(at: target), NativeGameplayResolver.canDrop(source, onto: destination), !locks.values.contains(where: { !$0 || source.isWild || destination.isWild }), (!flags.isWaiting || canRunOrdinaryDuringTnt(source) && canRunOrdinaryDuringTnt(destination)) else { return rejected("illegal_drop") }
        guard state.validationIssues().isEmpty else { return rejected("invalid_authoritative_board") }
        guard NativeTutorialRules.allowsDrop(source:source,destination:destination,tutorial:state.tutorial,rows:state.rows) else { return rejected("tutorial_drop_restricted") }
        let effectiveSum = source.isWild || destination.isWild ? 6 : source.value + destination.value
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
        if state.wildMeter >= 1 - 0.000001 && pendingSpecial == nil && pendingOrdinaryStack == nil && pendingOrdinarySix == nil {
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
        pendingDirectWild = plan; directWildGameplayCommitted = false; directWildPointerID = pointerID
        locks[plan.id] = false; flags.pendingSpecialMutation = true; noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.directWildReserved,tileIDs:[source.id,destination.id],archetype:archetype,reason:plan.id,variant:plan.variant)],resolution:resolve())
    }
    /// Called at the actual 80 ms absorb completion. Uses live earned HUD score, not a stale saved board.
    public func commitDirectWildGameplay(transactionID: String) -> NativeMoveResult {
        guard let plan = pendingDirectWild,plan.id == transactionID,plan.generation == state.generation,
              plan.revision == state.revision,state.terminal == nil,!directWildGameplayCommitted,
              state.tiles.first(where:{ $0.id == plan.source.id }) == plan.source,
              state.tiles.first(where:{ $0.id == plan.destination.id }) == plan.destination else { return rejected("direct_wild_commit_not_ready") }
        locks.removeValue(forKey:plan.id); flags.pendingSpecialMutation = false
        committingDirectWild = true
        drag = Drag(id:plan.source.id,pointerID:directWildPointerID,generation:plan.generation,revision:plan.revision)
        let result = drop(target:plan.destination.cell,pointerID:directWildPointerID,now:plan.startedAt + 0.08)
        committingDirectWild = false
        guard result.accepted else { pendingDirectWild = nil; return result }
        directWildGameplayCommitted = true
        // Star/Juice source visual gates restrict Wild/Special while ordinary input is released.
        locks[plan.id] = true
        return result
    }
    public func releaseDirectWildPresentation(transactionID: String,generation: UInt64) -> NativeMoveResult {
        guard let plan = pendingDirectWild,plan.id == transactionID,plan.generation == generation,
              generation == state.generation,directWildGameplayCommitted else { return rejected("direct_wild_release_not_ready") }
        locks.removeValue(forKey:plan.id); pendingDirectWild = nil; directWildGameplayCommitted = false
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
        guard state.terminal == nil, !flags.isWaiting, pendingOrdinaryStack == nil, pendingOrdinarySix == nil, state.wildMeter >= 1-0.000001 else { return rejected("wild_meter_not_ready") }
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
              NativeGameplayResolver.resolve(state:state,flags:flags).kind == .fail else { return rejected("lingering_six_repair_not_admitted") }
        state.revision &+= 1; state.tiles.removeAll { $0.id == tile.id }; let replacement = freshTile(cell:tile.cell,value:randomValue()); state.tiles.append(replacement)
        noMovesSignature = nil
        return NativeMoveResult(accepted:true,state:state,events:[NativeGameplayEvent(.removed,tileIDs:[tile.id]),NativeGameplayEvent(.spawned,tileIDs:[replacement.id],value:replacement.value,reason:"lingering_merge6_rescue")],resolution:resolve())
    }
    public func beginNoMovesConfirmation() -> String? {
        guard drag == nil, resolve().kind == .fail else { noMovesSignature = nil; return nil }
        noMovesSignature = state.signature
        return noMovesSignature
    }
    public func confirmNoMoves(signature: String, generation: UInt64) -> NativeMoveResult {
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
    private func spawnMeterReward(events: inout [NativeGameplayEvent]) -> Bool {
        guard rewardPicker != nil || state.tutorial?.waitingForWild == true else { return false }
        let available = NativeMagnetRules.emptyCells(state:state)
        guard !available.isEmpty else { return false }
        let cell = state.tutorial?.waitingForWild == true ? (NativeTutorialRules.preferredWildCell(state:state) ?? available[min(available.count-1,Int(nextRandom()*Double(available.count)))]) : available[min(available.count-1,Int(nextRandom()*Double(available.count)))]
        let choice = state.tutorial?.waitingForWild == true ? NativeWildRewardChoice(.star) : rewardPicker?(state,nextRandom(),{ self.nextRandom() })
        guard let reward = choice, reward.variant == nil || NativeSpecialDiceRegistry.compatibleVariant(reward.variant!,core:reward.archetype) != nil else { return false }
        state.tiles.removeAll { $0.cell == cell }
        var tile = freshTile(cell:cell,value:6); tile.archetype = reward.archetype; tile.variant = reward.variant
        if reward.archetype == .star { tile.starOrbitCount = reward.variant == nil ? 1+Int(nextRandom()*3) : 1 }
        state.tiles.append(tile); state.wildMeter = max(0,state.wildMeter-1); state.wildSpawnCount += 1
        if state.lastWildDropType == reward.archetype { state.wildDropTypeStreak += 1 } else { state.lastWildDropType = reward.archetype; state.wildDropTypeStreak = 1 }
        if state.tutorial?.waitingForWild == true {
            state.tutorial?.waitingForWild = false; state.tutorial?.step = .special; state.tutorial?.wildTileID = tile.id
            state.tutorial?.guidedPair = [tile.id]
        }
        events.append(NativeGameplayEvent(.spawned,tileIDs:[tile.id],value:6,archetype:reward.archetype,variant:reward.variant))
        return true
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
        pendingOrdinaryStack=plan; committingOrdinaryStack=true
        let movesBefore=state.moves
        drag=Drag(id:source.id,pointerID:pointerID,generation:state.generation,revision:state.revision)
        let accepted=drop(target:destination.cell,pointerID:pointerID,now:now)
        committingOrdinaryStack=false
        guard accepted.accepted else {pendingOrdinaryStack=nil;return accepted}
        state.moves=movesBefore
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
        pendingOrdinaryPostchecks.remove(at:index)
        return NativeMoveResult(accepted:true,state:state,events:[],resolution:resolve())
    }
    public func commitOrdinaryPostcheck(receiptID:String,generation:UInt64)->NativeMoveResult {
        guard generation==state.generation,let index=pendingOrdinaryPostchecks.firstIndex(where:{$0.id==receiptID && $0.generation==generation}) else{return rejected("stale_ordinary_postcheck")}
        let receipt=pendingOrdinaryPostchecks.remove(at:index)
        // Source entered this awaited branch before busyEnding changed. Its fresh stuck
        // classifier must still return before moves--; only captured0ms bypasses it.
        var postcheckFlags=flags;postcheckFlags.busyEnding=false
        let sourceResolution=NativeGameplayResolver.resolve(state:state,flags:postcheckFlags)
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
