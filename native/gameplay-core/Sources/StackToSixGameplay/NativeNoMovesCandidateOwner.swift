import Foundation

// PRIVATE clockless immutable-v9 fail candidate graph. Presentation/timers,
// actual core lock, fresh checkEndGame and confirmed result remain injected.
public struct NativeNoMovesCandidateOwner {
    public enum Trigger:String,CaseIterable {
        case lastTwoRegular="last_two_regular_stack_dead_end"
        case lastTwoSelf="last_two_self_merge_dead_end"
        case lastThreeRegular="last_three_regular_stack_dead_end"
        case lastThreeSelf="last_three_self_merge_dead_end"
        case singleRegular="single_regular_tile_safety_net"
        case postMerge="post_merge_stuck"
        case mergeMovesDepleted="merge_moves_depleted_stuck"
        case movesDepleted="moves_depleted_stuck"
        case levelEnd="check_level_end_stuck"
        public var waitMilliseconds:Int {self == .singleRegular ? 500:1500}
        public var exitTimeoutMilliseconds:Int? {self == .levelEnd ? 700:nil}
        public var resetHint:Bool {self == .movesDepleted}
        public var persistStuckState:Bool {self == .levelEnd}
    }
    struct Guard {
        var initialSignature:String
        var currentSignature:String
        var freshEndgameType="stuck"
        var wildContinuation=false
        var gameplayTransaction=false
        var activeDrag=false
        var endgameGuard=false
        var freshCheckFailed=false
        var blockReason:String? {
            if freshCheckFailed{return "fresh-check-error"}
            if wildContinuation{return "wild-continuation-pending"}
            if gameplayTransaction{return "gameplay-transaction-active"}
            if activeDrag{return "active-drag"}
            if endgameGuard{return "endgame-guard-active"}
            if currentSignature != initialSignature{return "board-changed"}
            if freshEndgameType != "stuck"{return "fresh-result:"+freshEndgameType}
            return nil
        }
    }
    public struct Plan:Equatable {public let token:UInt64;public let trigger:Trigger;public let signature:String;public let waitMilliseconds:Int;public var inputLockTTLMilliseconds:Int {12000}}
    enum Phase {case waiting,exiting,awaitingPostLock}
    public enum Delivery {case elapsed,cancelled}
    public enum ExitDelivery {case exited,timedOut,cancelled,rejected}
    public enum Effect:Equatable {
        case ignored
        case deferred(String)
        case candidate(Plan)
        case exit(Plan)
        case acquireInputLock(Plan)
        case rollback(Plan,String,releaseInputLock:Bool)
        case confirmedFinal(Plan)
    }
    private(set) var sequence:UInt64=0
    private(set) var active:Plan?
    private(set) var phase:Phase?
    mutating func begin(trigger:Trigger,busyEnding:Bool,extraWaitMilliseconds:Int=0,guard snapshot:Guard)->Effect {
        guard active==nil,!busyEnding else{return .ignored}
        if let reason=snapshot.blockReason{return .deferred(reason)}
        sequence += 1
        let plan=Plan(token:sequence,trigger:trigger,signature:snapshot.initialSignature,waitMilliseconds:trigger.waitMilliseconds+max(0,extraWaitMilliseconds))
        active=plan;phase = .waiting;return .candidate(plan)
    }
    mutating func waited(plan:Plan,delivery:Delivery,guard snapshot:Guard)->Effect {
        guard active==plan,phase == .waiting else{return .ignored}
        if delivery == .cancelled{return rollback(plan,"lifecycle-cancelled-before-commit")}
        if let reason=checked(snapshot,plan:plan){return rollback(plan,"pre-commit:"+reason)}
        phase = .exiting;return .exit(plan)
    }
    mutating func exited(plan:Plan,delivery:ExitDelivery,guard snapshot:Guard)->Effect {
        guard active==plan,phase == .exiting else{return .ignored}
        if delivery == .cancelled{return rollback(plan,"lifecycle-cancelled-during-exit")}
        // Only the Source levelEnd caller owns the positive700 timeout race.
        if delivery == .timedOut,plan.trigger.exitTimeoutMilliseconds==nil{return .ignored}
        // Rejected authored exit is caught by Source and still proceeds to check.
        if let reason=checked(snapshot,plan:plan){return rollback(plan,"final-commit:"+reason)}
        phase = .awaitingPostLock;return .acquireInputLock(plan)
    }
    mutating func locked(plan:Plan,guard snapshot:Guard)->Effect {
        guard active==plan,phase == .awaitingPostLock else{return .ignored}
        if let reason=checked(snapshot,plan:plan){return rollback(plan,"post-lock:"+reason)}
        active=nil;phase=nil;return .confirmedFinal(plan)
    }
    private func checked(_ snapshot:Guard,plan:Plan)->String? {
        var captured=snapshot;captured.initialSignature=plan.signature;return captured.blockReason
    }
    private mutating func rollback(_ plan:Plan,_ reason:String)->Effect {
        let lock=phase == .awaitingPostLock
        active=nil;phase=nil;return .rollback(plan,reason,releaseInputLock:lock)
    }
}
