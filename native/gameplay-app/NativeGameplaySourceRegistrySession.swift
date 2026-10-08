import Foundation
import StackToSixGameplay

/// One app-lived registry session; borrows wall Date only at actual operations.
/// No timer/clock and no blanket pause/dispose transaction release.
@MainActor final class NativeGameplaySourceRegistrySession {
    enum Capability:String,CaseIterable {case terminalNoMovesInput,specialContactCommitRelease,magnetGuardBeginFinally,sourceTileLifecycle,sourceSpawnMarkers}
    struct Snapshot {
        let sourceDateMilliseconds:Double
        let special:NativeSourceSpecialTransactionRegistry.Snapshot?
        let endgameGuard:NativeSourceEndgameGuardRegistry.Snapshot
        let inputReasons:[String]
        let failScreenPending:Bool
    }
    final class NoMovesCapture {
        fileprivate let sessionID:UUID,scopeID:UUID,generation:UInt64,planToken:UInt64
        fileprivate let input:NativeSourceInputGateRegistry.Lease
        fileprivate var released=false
        fileprivate init(sessionID:UUID,scopeID:UUID,generation:UInt64,planToken:UInt64,input:NativeSourceInputGateRegistry.Lease) {
            self.sessionID=sessionID;self.scopeID=scopeID;self.generation=generation;self.planToken=planToken;self.input=input
        }
    }
    private let id=UUID(),sourceDate:()->Double
    private var input=NativeSourceInputGateRegistry(),special=NativeSourceSpecialTransactionRegistry(),guardOwner=NativeSourceEndgameGuardRegistry()
    private weak var active:Scope?
    private var terminal:NoMovesCapture?
    private var specialInput:[UInt64:NativeSourceInputGateRegistry.Lease]=[:]
    private var disposed=false
    private var operation:UInt64=0
    private func beginOperation()->UInt64 {operation &+= 1;return operation}
    private func operationCurrent(_ captured:UInt64)->Bool {!disposed && operation==captured}
    init(sourceDateMilliseconds:@escaping()->Double = {floor(Date().timeIntervalSince1970*1000)}) {sourceDate=sourceDateMilliseconds}
    func beginScope(epoch:UInt64)->Scope {
        let scope=Scope(session:self,epoch:epoch);active=scope;return scope
    }
    private func owns(_ scope:Scope)->Bool {!disposed && active === scope && !scope.disposed}
    func dispose(){guard !disposed else{return};disposed=true;active=nil;terminal=nil}

    @MainActor final class Scope {
        let epoch:UInt64
        fileprivate let id=UUID()
        fileprivate weak var session:NativeGameplaySourceRegistrySession?
        fileprivate private(set) var disposed=false
        private var parentCurrent:(()->Bool)?
        private var installed:Set<Capability>=[]
        private var specialTokens:Set<UInt64>=[]
        private var guardLeases:[UInt64:NativeSourceEndgameGuardRegistry.Lease]=[:]
        fileprivate init(session:NativeGameplaySourceRegistrySession,epoch:UInt64){self.session=session;self.epoch=epoch}
        func bindParentCurrent(_ predicate:@escaping()->Bool){guard !disposed,parentCurrent==nil else{return};parentCurrent=predicate}
        var current:Bool {
            guard !disposed,let session,session.owns(self),let parentCurrent else{return false}
            let accepted=parentCurrent()
            return accepted && !disposed && session.owns(self)
        }
        /// Installer records only genuinely mounted endpoints. Root's current Scene
        /// callers remain unmounted; no default capability is installed by construction.
        func endpointMounted(_ capability:Capability){guard current else{return};installed.insert(capability)}
        func missing(_ required:Set<Capability>)->[String] {required.subtracting(installed).map(\.rawValue).sorted()}
        func dispose(){guard !disposed else{return};disposed=true;parentCurrent=nil;installed=[];if session?.active === self {session?.active=nil}}
        func snapshot(isWild:Bool)->Snapshot? {
            guard current,let session else{return nil};let op=session.beginOperation(),now=session.sourceDate()
            guard current,session.owns(self),session.operationCurrent(op) else{return nil}
            return .init(sourceDateMilliseconds:now,special:session.special.snapshot(now:now),endgameGuard:session.guardOwner.snapshot(now:now),inputReasons:session.input.reasons(isWild:isWild,now:now),failScreenPending:session.terminal != nil)
        }
        /// Only the actual post-text-exit afterLock callback supplies this plan.
        func lockNoMoves(engine:NativeGameplayEngine,generation:UInt64,ttlMilliseconds:Int)->NoMovesCapture? {
            guard current,let session,installed.contains(.terminalNoMovesInput),engine.stagedSourceNoMoves,
                engine.state.generation==generation,engine.flags.busyEnding,
                let plan=engine.pendingSourceNoMoves,ttlMilliseconds==12000 else{return nil}
            let op=session.beginOperation(),now=session.sourceDate()
            guard current,session.owns(self),session.operationCurrent(op),engine.state.generation==generation,
                  engine.pendingSourceNoMoves==plan,engine.flags.busyEnding else{return nil}
            // No timer is installed: exactly Source setInputGateLock(all,12000).
            guard let lease=session.input.set("terminal-no-moves",active:true,now:now,ttlMilliseconds:12000) else{return nil}
            let capture=NoMovesCapture(sessionID:session.id,scopeID:id,generation:generation,planToken:plan.token,input:lease)
            session.terminal=capture;return capture
        }
        /// Cleanup is permitted after this scope retires, only for the exact matching
        /// capture. New C's key cannot be erased by obsolete A.
        @discardableResult func releaseNoMoves(_ capture:NoMovesCapture)->Bool {
            guard let session,!session.disposed,capture.sessionID==session.id,capture.scopeID==id,
                !capture.released,session.terminal === capture else{return false}
            let op=session.beginOperation(),now=session.sourceDate()
            guard session.operationCurrent(op),!capture.released,session.terminal === capture else{return false}
            capture.released=true;session.terminal=nil;_ = session.input.release(capture.input,now:now);return true
        }
        func claimSpecial(kind:NativeSourceSpecialTransactionRegistry.Kind)->UInt64? {
            guard current,installed.contains(.specialContactCommitRelease),let session else{return nil}
            let op=session.beginOperation(),now=session.sourceDate();guard current,session.owns(self),session.operationCurrent(op) else{return nil}
            guard let token=session.special.claim(kind:kind,now:now) else{return nil}
            specialTokens.insert(token)
            if let lease=session.input.set("special-transaction",active:true,now:now,ttlMilliseconds:15000,scope:.all){session.specialInput[token]=lease}
            return token
        }
        @discardableResult func commitSpecial(token:UInt64,revision:Double)->Bool {
            guard current,installed.contains(.specialContactCommitRelease),specialTokens.contains(token),let session else{return false}
            let op=session.beginOperation(),now=session.sourceDate();guard current,session.owns(self),specialTokens.contains(token),session.operationCurrent(op) else{return false}
            guard session.special.markBoardCommitted(token:token,boardRevision:revision,now:now) else{return false}
            if let lease=session.input.set("special-transaction",active:true,now:now,ttlMilliseconds:15000,scope:.wildOnly){session.specialInput[token]=lease}
            return true
        }
        @discardableResult func releaseSpecial(token:UInt64)->Bool {
            guard specialTokens.contains(token),let session,!session.disposed else{return false}
            let op=session.beginOperation(),now=session.sourceDate()
            guard session.operationCurrent(op),specialTokens.remove(token) != nil else{return false}
            let active=session.special.snapshot(now:now)
            guard active==nil || active?.token==token else{return false}
            let released=session.special.release(token,now:now)
            if let lease=session.specialInput.removeValue(forKey:token){_ = session.input.release(lease,now:now)}
            return released
        }
        func beginMagnetGuard()->NativeSourceEndgameGuardRegistry.Lease? {
            guard current,installed.contains(.magnetGuardBeginFinally),let session else{return nil}
            let op=session.beginOperation(),now=session.sourceDate();guard current,session.owns(self),session.operationCurrent(op) else{return nil}
            let lease=session.guardOwner.begin(source:"mergePulledTilesIntoMerge6",now:now,ttlMilliseconds:2200)
            guardLeases[lease.epoch]=lease;return lease
        }
        /// Actual caller preserves ownsLifecycle; this does not manufacture a finally.
        @discardableResult func releaseMagnetGuard(_ lease:NativeSourceEndgameGuardRegistry.Lease,ownsLifecycle:Bool)->Bool {
            guard ownsLifecycle,guardLeases[lease.epoch]==lease,let session,!session.disposed else{return false}
            guardLeases.removeValue(forKey:lease.epoch);return session.guardOwner.release(lease)
        }
    }
}

/// Actual callback owner retained by the mounted Source NO MOVES installer.
@MainActor final class NativeSourceNoMovesTerminalFieldsBinder {
    private let scope:NativeGameplaySourceRegistrySession.Scope
    private weak var engine:NativeGameplayEngine?
    private let generation:UInt64
    private var capture:NativeGameplaySourceRegistrySession.NoMovesCapture?
    private var epoch:UInt64=0
    init(scope:NativeGameplaySourceRegistrySession.Scope,engine:NativeGameplayEngine) {self.scope=scope;self.engine=engine;generation=engine.state.generation}
    /// Invoke only once the real Scene configure callback has been published.
    func callbackMounted(){scope.endpointMounted(.terminalNoMovesInput)}
    @discardableResult func terminalFields(active:Bool,ttlMilliseconds:Int)->Bool {
        epoch &+= 1;let acceptedEpoch=epoch
        if !active {guard let owned=capture else{return false};capture=nil;return scope.releaseNoMoves(owned)}
        guard capture==nil,let engine else{return false}
        guard let next=scope.lockNoMoves(engine:engine,generation:generation,ttlMilliseconds:ttlMilliseconds) else{return false}
        guard epoch==acceptedEpoch,capture==nil else{_ = scope.releaseNoMoves(next);return false}
        capture=next;return true
    }
    /// Root binds actual Source final cleanup separately, never a UI elapsed timer.
    @discardableResult func resultCleanup(receipt:NativeSourceNoMovesCompletedReceipt)->Bool {
        guard let capture,let engine,receipt==engine.completedSourceNoMovesReceipt,
            receipt.generation==generation,receipt.planToken==capture.planToken else{return false}
        epoch &+= 1;self.capture=nil;return scope.releaseNoMoves(capture)
    }
}
