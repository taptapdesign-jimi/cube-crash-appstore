import Foundation
import StackToSixGameplay

/// One captured genuine Scene publication. No clock, deadline timer or resolver.
/// The actual true configure receipt is confirmed against the same bridge epoch.
@MainActor final class NativeSourceNoMovesTerminalRegistryEndpoint {
    private enum Phase {case waiting,publishing,mounted,retired}
    private let scope:NativeGameplaySourceRegistrySession.Scope
    private weak var engine:NativeGameplayEngine?
    private let generation:UInt64
    private let binder:NativeSourceNoMovesTerminalFieldsBinder
    private var phase=Phase.waiting,epoch:UInt64=0
    private var publicationCurrent:(()->Bool)?
    var mounted:Bool {phase == .mounted}
    init(scope:NativeGameplaySourceRegistrySession.Scope,engine:NativeGameplayEngine) {
        self.scope=scope;self.engine=engine;generation=engine.state.generation
        binder=NativeSourceNoMovesTerminalFieldsBinder(scope:scope,engine:engine)
    }
    private func valid(_ capturedEpoch:UInt64)->Bool {
        guard phase == .mounted,epoch==capturedEpoch,let engine,engine.state.generation==generation,
            scope.current,let publicationCurrent else{return false}
        let accepted=publicationCurrent()
        return accepted && phase == .mounted && epoch==capturedEpoch && scope.current && engine.state.generation==generation
    }
    /// Invoke only AFTER configureSourceNoMoves returned true and its captured
    /// Scene endpoint still matches. A callback cannot revive a retired A.
    @discardableResult func confirmPublication(current:@escaping()->Bool)->Bool {
        guard phase == .waiting,let engine,engine.state.generation==generation else{return false}
        epoch &+= 1;let e=epoch;phase = .publishing;publicationCurrent=current
        let accepted=current()
        guard accepted,phase == .publishing,epoch==e,scope.current,engine.state.generation==generation else{retire();return false}
        guard binder.mountCapturedCallback() else{retire();return false}
        let stillCurrent=current()
        guard stillCurrent,phase == .publishing,epoch==e,scope.current,engine.state.generation==generation else{retire();return false}
        phase = .mounted;return true
    }
    var current:Bool {valid(epoch)}
    /// Source Core already owns busyEnding/input at the actual afterLock callback.
    /// Its captured registry key is installed BEFORE the mandatory external fields
    /// observer, and all post-observer continuation seals remain authoritative.
    @discardableResult func terminalFields(active:Bool,ttlMilliseconds:Int,observer:(Bool,Int)->Void)->Bool {
        guard phase == .mounted else{return false}
        epoch &+= 1;let e=epoch
        guard valid(e) else{return false}
        let accepted=binder.terminalFields(active:active,ttlMilliseconds:ttlMilliseconds)
        guard accepted,valid(e) else{return false}
        observer(active,ttlMilliseconds)
        return valid(e)
    }
    /// The Source final-modal coroutine cleanup calls this explicitly. Merely
    /// creating/delivering completedBoardExit NEVER invokes it.
    @discardableResult func actualFinalCleanup(receipt:NativeSourceNoMovesCompletedReceipt)->Bool {
        guard phase == .mounted else{return false};epoch &+= 1;let e=epoch
        guard valid(e) else{return false}
        let result=binder.resultCleanup(receipt:receipt)
        return result && valid(e)
    }
    @discardableResult func actualConfirmedFlowCleanup(receipt:NativeSourceNoMovesFinalFlowReceipt)->Bool {
        guard phase == .mounted else{return false};epoch &+= 1;let e=epoch
        guard valid(e) else{return false}
        let result=binder.confirmedFlowCleanup(receipt:receipt)
        return result && valid(e)
    }
    func retire() {
        guard phase != .retired else{return};phase = .retired;epoch &+= 1
        publicationCurrent=nil // captured-remove BEFORE Date/cleanup callbacks
        binder.unhook()
    }
}
