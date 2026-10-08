import Foundation

/// Exact awaited-primary/retry/verification order from app-core's two Wild callsites.
/// This helper never releases the Special receipt; caller audits its actual primary accounting.
/// Unconnected draft: model/presentation integration is still required before admission.
final class NativeWildPrimaryRecoveryOwner {
    enum Mode { case normal, endgame }
    enum Kind { case awaitedPrimary, hardFallback, verifyActive }
    struct Command:Equatable {let id:String;let generation:UInt64;let kind:Kind;let attempt:Int}
    let id:String
    let generation:UInt64
    let mode:Mode
    private(set) var command:Command?
    private(set) var complete=false
    private(set) var cancelled=false
    private(set) var primaryReturnedSuccess=false
    private var sequence=0
    private var started=false
    init(id:String,generation:UInt64,mode:Mode){self.id=id;self.generation=generation;self.mode=mode}
    @discardableResult func begin()->Command? {
        guard !started,!cancelled else{return nil};started=true;return issue(.awaitedPrimary,attempt:1)
    }
    func acknowledgeAwaited(commandID:String,generation:UInt64,spawned:Bool)->Bool {
        guard owns(commandID,generation),let captured=command,captured.kind == .awaitedPrimary else{return false}
        command=nil
        if mode == .normal {primaryReturnedSuccess=spawned;finish();return true}
        if captured.attempt==3 {finish();return true} // Original verification retry's return value is ignored.
        if spawned {primaryReturnedSuccess=true;issue(.verifyActive,attempt:1)}
        else if captured.attempt==1 {issue(.awaitedPrimary,attempt:2)}
        else {issue(.hardFallback,attempt:1)}
        return true
    }
    func acknowledgeHardFallback(commandID:String,generation:UInt64,spawned:Bool)->Bool {
        guard owns(commandID,generation),let captured=command,captured.kind == .hardFallback else{return false}
        command=nil
        if captured.attempt==1 {issue(.verifyActive,attempt:1)}
        else if spawned {finish()}
        else {issue(.awaitedPrimary,attempt:3)}
        return true
    }
    func acknowledgeVerification(commandID:String,generation:UInt64,activeAtReservedCell:Bool)->Bool {
        guard owns(commandID,generation),command?.kind == .verifyActive else{return false}
        command=nil
        if activeAtReservedCell {finish()} else {issue(.hardFallback,attempt:2)}
        return true
    }
    /// Promise rejection exits the coroutine; unlike a false return it performs no retry.
    func cancelForLifecycle(){cancelled=true;command=nil}
    private func finish(){complete=true;command=nil}
    @discardableResult private func issue(_ kind:Kind,attempt:Int)->Command {
        sequence+=1;let c=Command(id:"\(id):primary-recovery:\(sequence)",generation:generation,kind:kind,attempt:attempt);command=c;return c
    }
    private func owns(_ commandID:String,_ generation:UInt64)->Bool {!cancelled && self.generation==generation && command?.id==commandID}
}
