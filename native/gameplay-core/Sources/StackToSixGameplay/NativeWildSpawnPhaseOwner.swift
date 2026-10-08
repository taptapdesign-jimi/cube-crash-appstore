import Foundation

/// Source coroutine order, without timers, artwork or an independent board snapshot.
/// The engine commits the captured command against its live board before acknowledging it.
final class NativeWildSpawnPhaseOwner {
    enum Mode { case normal, endgame, arcade }
    enum Kind { case primary, baseLocked, extraLocked, juiceExtra, remainderWait, remainderPrimary, remainderFallback, juiceSafety, forcedLocked, juiceSafetyPrimary, minimumActive, emergencyLocked, emergencyFallback }
    struct Command: Equatable {
        let id:String
        let generation:UInt64
        let kind:Kind
        let count:Int
        let delayMilliseconds:Int
    }
    private enum Stage { case idle, primary, base, remainderWait, remainderPrimary, remainderFallback, remainderArrival, juiceSafety, forced, juiceSafetyPrimary, minimum, emergency, emergencyFallback, extra, endgameJuice, complete }
    let id:String
    let generation:UInt64
    let mode:Mode
    let archetype:NativeWildArchetype
    let spawnCount:Int
    let orbitCount:Int
    private(set) var command:Command?
    private(set) var pendingArrivals:Set<String> = []
    private(set) var complete=false
    private(set) var cancelled=false
    private(set) var primaryCommitted=false
    private(set) var primaryArrived=false
    private(set) var consumedIdentitiesRetired=false
    var ordinaryInputReleased:Bool { primaryCommitted && primaryArrived && consumedIdentitiesRetired }
    private var stage=Stage.idle
    private var sequence=0
    private var opened=0
    private var remainderRequested=0
    private var remainderIndex=0
    private var remainderOpened=0
    private var missingJuice=0
    private var endgameExtras=0
    private var minimumPass=0
    private var waitingSingleArrival:String?
    private var primaryCommand:Command?

    init(id:String,generation:UInt64,mode:Mode,archetype:NativeWildArchetype,spawnCount:Int,orbitCount:Int) {
        self.id=id;self.generation=generation;self.mode=mode;self.archetype=archetype
        self.spawnCount=max(0,spawnCount);self.orbitCount=max(1,min(3,orbitCount))
    }
    @discardableResult func begin()->Command? {
        guard !cancelled,stage == .idle,(archetype == .star || archetype == .juice),spawnCount>0 else{return nil};stage = .primary
        return issue(.primary,delay:mode == .normal ? 0:50)
    }
    /// Primary assignment is playable but does not settle the original Special receipt.
    func acknowledgePrimaryAssignment(commandID:String,generation:UInt64,arrivalID:String)->Bool {
        guard owns(commandID,generation),stage == .primary else{return false}
        primaryCommand=command;command=nil;primaryCommitted=true;waitingSingleArrival=arrivalID;return true
    }
    /// False return follows the source continuation with zero primary accounting; it never unlocks input.
    func acknowledgePrimaryReturnedFalse(commandID:String,generation:UInt64)->Bool {
        guard owns(commandID,generation),stage == .primary else{return false}
        command=nil;advanceAfterPrimary(openedCount:0,arrived:false);return true
    }
    /// Hard fallback's logical assignment commits its receipt immediately; its bounce is decorative.
    func acknowledgeHardPrimary(commandID:String,generation:UInt64)->Bool {
        guard owns(commandID,generation),stage == .primary else{return false}
        command=nil;primaryCommitted=true;advanceAfterPrimary(openedCount:1,arrived:true);return true
    }
    /// A destroyed awaited holder resolves false and returns to the source retry owner.
    func revokePrimaryAssignment(arrivalID:String,generation:UInt64)->Bool {
        guard !cancelled,generation==self.generation,stage == .primary,waitingSingleArrival==arrivalID else{return false}
        waitingSingleArrival=nil;primaryCommitted=false;command=primaryCommand;return true
    }
    /// Logical postcondition, not an elapsed visual-cleanup delay.
    func acknowledgeConsumedIdentitiesRetired(generation:UInt64)->Bool {
        guard !cancelled,stage != .idle,generation==self.generation,!consumedIdentitiesRetired else{return false}
        consumedIdentitiesRetired=true;return true
    }
    /// Source Promise resolution drives the next phase. No wall-clock timeout can manufacture it.
    func acknowledgeArrival(_ arrivalID:String,generation:UInt64)->Bool {
        guard !cancelled,generation==self.generation else{return false}
        if waitingSingleArrival==arrivalID {
            waitingSingleArrival=nil
            switch stage {
            case .primary:
                advanceAfterPrimary(openedCount:1,arrived:true)
            case .endgameJuice:
                endgameExtras-=1
                if endgameExtras>0 {issue(.juiceExtra)} else {startExtra()}
            case .juiceSafetyPrimary:
                missingJuice-=1
                if missingJuice>0 {issue(.juiceSafetyPrimary)} else {startMinimum()}
            default:return false
            }
            return true
        }
        guard pendingArrivals.remove(arrivalID) != nil else{return false}
        remainderOpened+=1
        if stage == .remainderArrival && pendingArrivals.isEmpty {startJuiceSafety()}
        return true
    }
    /// Locked batches settle on actual logical assignments; their bounces are decorative.
    func acknowledgeLockedBatch(commandID:String,generation:UInt64,openedCount:Int)->Bool {
        guard owns(commandID,generation),let owned=command else{return false}
        command=nil
        let n=max(0,min(owned.count,openedCount))
        switch stage {
        case .base:
            opened+=n;remainderRequested=max(0,spawnCount-opened);remainderIndex=0
            if remainderRequested>0 {startRemainderWait()} else {startJuiceSafety()}
        case .remainderFallback:
            remainderOpened+=n;finishRemainderIteration()
        case .forced:
            missingJuice=max(0,missingJuice-n)
            if missingJuice>0 {stage = .juiceSafetyPrimary;issue(.juiceSafetyPrimary)} else {startMinimum()}
        case .emergency:
            if n>0 {finishMinimum()} else {stage = .emergencyFallback;issue(.emergencyFallback)}
        case .extra:
            if mode == .normal {startMinimum()} else {finish()}
        default:command=owned;return false
        }
        return true
    }
    func acknowledgeRemainderWait(commandID:String,generation:UInt64)->Bool {
        guard owns(commandID,generation),stage == .remainderWait else{return false}
        command=nil;stage = .remainderPrimary;issue(.remainderPrimary);return true
    }
    /// Remainder primary promises overlap. Source waits for all arrivals after scheduling the loop.
    func acknowledgeRemainderAssignment(commandID:String,generation:UInt64,arrivalID:String?,hasCell:Bool)->Bool {
        guard owns(commandID,generation),stage == .remainderPrimary else{return false}
        command=nil
        if !hasCell {stage = .remainderFallback;issue(.remainderFallback,count:1);return true}
        if let arrivalID {pendingArrivals.insert(arrivalID)}
        finishRemainderIteration();return true
    }
    func acknowledgeJuiceSafety(commandID:String,generation:UInt64)->Bool {
        guard owns(commandID,generation),stage == .juiceSafety else{return false}
        command=nil;missingJuice=archetype == .juice && spawnCount>=2 ? max(0,2-opened-remainderOpened):0
        if missingJuice>0 {stage = .forced;issue(.forcedLocked,count:missingJuice)} else {startMinimum()}
        return true
    }
    func acknowledgeExtraPrimary(commandID:String,generation:UInt64,arrivalID:String?)->Bool {
        guard owns(commandID,generation),stage == .endgameJuice || stage == .juiceSafetyPrimary else{return false}
        command=nil
        if let arrivalID {waitingSingleArrival=arrivalID;return true}
        if stage == .endgameJuice {
            endgameExtras-=1
            if endgameExtras>0 {issue(.juiceExtra)} else {startExtra()}
        } else {startMinimum()}
        return true
    }
    /// The two source safety checks re-read current active tiles, never the entry snapshot.
    func acknowledgeMinimum(commandID:String,generation:UInt64,activeCount:Int)->Bool {
        guard owns(commandID,generation),stage == .minimum else{return false}
        command=nil
        if activeCount>=2 {finishMinimum()} else {stage = .emergency;issue(.emergencyLocked,count:1)}
        return true
    }
    func acknowledgeEmergencyFallback(commandID:String,generation:UInt64)->Bool {
        guard owns(commandID,generation),stage == .emergencyFallback else{return false}
        command=nil;finishMinimum();return true
    }
    /// Original pre-spawn/after-primary/star-extra guards observe the existing terminal
    /// owner at these exact coroutine boundaries; delayed locked callbacks do not recheck it.
    func acknowledgeTerminalOwnerBoundary(commandID:String,generation:UInt64)->Bool {
        guard owns(commandID,generation) else{return false}
        if stage == .primary && mode != .normal {finish();return true}
        if stage == .endgameJuice && endgameExtras==2 {finish();return true}
        if stage == .extra {
            if mode == .normal {command=nil;startMinimum()} else {finish()}
            return true
        }
        return false
    }
    /// Navigation/restart owns cancellation. A cancelled command can never resume on an old timer.
    func cancelForLifecycle(){cancelled=true;command=nil;pendingArrivals.removeAll();waitingSingleArrival=nil}
    private func advanceAfterPrimary(openedCount:Int,arrived:Bool) {
        primaryArrived=arrived;opened=openedCount
        if mode == .arcade {finish()}
        else if mode == .normal {stage = .base;issue(.baseLocked,count:max(0,spawnCount-openedCount))}
        else if archetype == .juice {endgameExtras=2;stage = .endgameJuice;issue(.juiceExtra)}
        else {startExtra()}
    }
    private func finishRemainderIteration() {
        remainderIndex+=1
        if remainderIndex<remainderRequested {startRemainderWait()}
        else if pendingArrivals.isEmpty {startJuiceSafety()}
        else {stage = .remainderArrival}
    }
    private func startRemainderWait(){stage = .remainderWait;issue(.remainderWait,delay:80+remainderIndex*150)}
    private func startJuiceSafety(){stage = .juiceSafety;issue(.juiceSafety)}
    private func startMinimum(){stage = .minimum;minimumPass+=1;issue(.minimumActive)}
    private func finishMinimum(){if minimumPass==1 {startExtra()} else {finish()}}
    private func startExtra(){
        if archetype == .star && mode != .arcade {stage = .extra;issue(.extraLocked,count:orbitCount)}
        else if mode == .normal {startMinimum()}
        else {finish()}
    }
    private func finish(){stage = .complete;command=nil;complete=true}
    @discardableResult private func issue(_ kind:Kind,count:Int=1,delay:Int=0)->Command {
        sequence+=1;let next=Command(id:"\(id):phase:\(sequence)",generation:generation,kind:kind,count:count,delayMilliseconds:delay);command=next;return next
    }
    private func owns(_ commandID:String,_ generation:UInt64)->Bool {!cancelled && generation==self.generation && command?.id==commandID}
}
