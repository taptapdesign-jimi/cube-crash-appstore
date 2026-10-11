import Foundation
import StackToSixGameplay

/// No clock. The actual Source main tween adapter delivers installed/completed/
/// interrupted receipts; Source global pause delivers none of these callbacks.
/// Scene retains these EXACT two objects before contact consume/synchronize.
@MainActor final class NativeSourceSpecialMainCapture<Node:AnyObject> {
    enum Phase:Equatable {case captured,installed,entered,interrupted,retired}
    struct Hooks {
        /// Exact Source run/generation; independent from Scene/node disposed.
        /// Destruction in the SAME run still owns cleanup; a new run does not.
        var generationCurrent:()->Bool
        /// Exact dictionary identity + original canvas parent + alive + gen.
        var nodeCurrent:(Node,String,UInt64)->Bool
        var register:()->NativeSourceSpecialAbsorbReceipt?
        var commit:(NativeSourceSpecialAbsorbReceipt)->Bool
        var mainReady:()->Bool = {true}
        /// Return accepted Core result WITHOUT consume/sync yet. Native effects
        /// and Source cleanup finish first; then publish the accepted result.
        var cancel:(NativeSourceSpecialAbsorbReceipt)->Bool
        var removeCapturedPair:(Node,Node)->Void
        /// Actual child cancellation -> per-child onInterrupt restores original
        /// pose/binding. No geometry-center reset or new idle allocation.
        var cleanupCapturedPull:()->Void
        var releaseMainFramesAndIdle:()->Void
        /// Canonical Source guarded queue, NOT immediate Core meter claim.
        var releaseSpecialAndQueue:()->Void
        var publishCanceledState:()->Void
        var continueAfterMain:()->Void
        var retireNativeRoots:()->Void
    }
    let plan:NativeSpecialMovePlan
    let source:Node,destination:Node
    private let hooks:Hooks
    private(set) var phase=Phase.captured
    private(set) var nativeMainID:UUID?
    private(set) var coreReceipt:NativeSourceSpecialAbsorbReceipt?
    init(plan:NativeSpecialMovePlan,source:Node,destination:Node,hooks:Hooks) {
        self.plan=plan;self.source=source;self.destination=destination;self.hooks=hooks
    }
    private var retiredRoots=false,cleanupAttempted=false,cleanupAccepted=false
    private var mainCompletionDelivered=false
    private func retireRootsOnce() {
        guard !retiredRoots else{return};retiredRoots=true;hooks.retireNativeRoots()
    }
    /// Every external callback can synchronously retire this owner. Revalidate
    /// phase AFTER each one; a returned true value never reopens terminal state.
    private func current(in expected:Phase)->Bool {
        guard phase==expected else{return false}
        let run=hooks.generationCurrent();guard phase==expected,run else{return false}
        let src=hooks.nodeCurrent(source,plan.source.id,plan.generation);guard phase==expected,src else{return false}
        let dst=hooks.nodeCurrent(destination,plan.destination.id,plan.generation);guard phase==expected,dst else{return false}
        return true
    }
    var isCurrent:Bool {let captured=phase;guard captured == .captured || captured == .installed || captured == .entered else{return false};return current(in:captured)}
    func retains(_ node:Node,id:String,generation:UInt64)->Bool {
        let expected=phase
        guard generation==plan.generation,expected == .captured || expected == .installed,current(in:expected),phase==expected else{return false}
        return id==plan.source.id && node === source || id==plan.destination.id && node === destination
    }
    /// Genuine accepted root only, after actual defaultLazy driver registration.
    @discardableResult func mainInstalled(_ nativeID:UUID)->Bool {
        guard phase == .captured,current(in:.captured),phase == .captured else{return false}
        nativeMainID=nativeID
        let returned=hooks.register()
        guard let receipt=returned,receipt.transactionID==plan.id,receipt.generation==plan.generation,receipt.sourceID==plan.source.id,receipt.destinationID==plan.destination.id else {
            if phase == .captured {phase = .retired};retireRootsOnce();return false
        }
        coreReceipt=receipt // genuine late receipt retained for cleanup, not revive
        guard phase == .captured,current(in:.captured),phase == .captured else {
            // External register can destroy the capture before returning the
            // newly installed Core receipt. Consume it once if same run remains.
            if phase == .captured {phase = .retired}
            cancelCaptured(receipt);retireRootsOnce();return false
        }
        phase = .installed;return true
    }
    /// FIRST actual main80 callback; committed body only when owner survives.
    @discardableResult func mainCompleted(_ nativeID:UUID)->Bool {
        guard phase == .installed,nativeMainID==nativeID,let receipt=coreReceipt else{return false}
        guard current(in:.installed),phase == .installed else {
            if phase == .installed {_ = mainInterrupted(nativeID)};return false
        }
        mainCompletionDelivered=true
        guard hooks.mainReady(),current(in:.installed),phase == .installed else{return false}
        phase = .entered // before reentrant Core commit or selected await
        let accepted=hooks.commit(receipt)
        guard phase == .entered,accepted else {
            if phase == .entered {phase = .retired};retireRootsOnce();return false
        }
        guard current(in:.entered),phase == .entered else {retireRootsOnce();return false}
        hooks.continueAfterMain();return phase == .entered
    }
    /// The real independent face callback may release a captured actual main80
    /// completion. No synthetic tween completion or elapsed-time retry exists.
    @discardableResult func resumeDeliveredMain()->Bool {
        guard mainCompletionDelivered,phase == .installed,let nativeMainID else{return false}
        return mainCompleted(nativeMainID)
    }
    private func sameRun()->Bool {
        let expected=phase,result=hooks.generationCurrent()
        return phase==expected && result
    }
    /// Current-run cleanup cannot be inferred from the return value of a hook
    /// that synchronously retires/replaces the owner. Each later effect checks.
    private func cancelCaptured(_ receipt:NativeSourceSpecialAbsorbReceipt) {
        guard !cleanupAttempted,sameRun() else{return};cleanupAttempted=true
        let before=phase,accepted=hooks.cancel(receipt);cleanupAccepted=accepted
        guard accepted,phase==before,sameRun() else{return}
        hooks.removeCapturedPair(source,destination)
        guard phase==before,sameRun() else{return}
        if plan.archetype == .magnet {hooks.cleanupCapturedPull()}
        guard phase==before,sameRun() else{return}
        hooks.releaseMainFramesAndIdle()
        guard phase==before,sameRun() else{return}
        hooks.releaseSpecialAndQueue()
        guard phase==before,sameRun() else{return}
        hooks.publishCanceledState()
    }
    @discardableResult func mainInterrupted(_ nativeID:UUID)->Bool {
        guard phase == .installed,nativeMainID==nativeID,let receipt=coreReceipt else{return false}
        phase = .interrupted // BEFORE any external cancel/kill callback
        cancelCaptured(receipt);retireRootsOnce();return cleanupAccepted
    }
    func capturedObjectRetired() {
        if let nativeMainID,phase == .installed {_ = mainInterrupted(nativeMainID)}
        else if phase == .captured {phase = .retired;retireRootsOnce()}
    }
    func retireObsolete(){guard phase != .retired else{return};phase = .retired;retireRootsOnce()}
    // Swift6.3.3 generic ARC destroyer optimizer workaround; hot code stays -O.
    @_optimize(none) deinit {}

}
