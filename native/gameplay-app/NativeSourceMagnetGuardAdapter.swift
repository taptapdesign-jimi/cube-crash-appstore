import Foundation

/// Binds only genuine app-owned timeout/FIFO/guard producers. No Source registry
/// capability is mounted unless the actual Scene installer publishes callbacks.
@MainActor final class NativeSourceMagnetGuardAdapter {
    private let scope:NativeGameplaySourceRegistrySession.Scope
    private let timeouts:NativeSourceAppTimeoutOwner
    private let tasks:NativeSourceMicrotaskAdapters
    private let enqueue:(@escaping()->Void)->Bool
    private var endpoint:NativeGameplaySourceRegistrySession.EndpointLease?,closed=false,epoch:UInt64=0
    private var captures:[UInt64:NativeSourceEndgameGuardRegistry.Lease]=[:]
    private var admission:Bool {
        guard !closed,endpoint != nil else{return false};let accepted=scope.current
        return accepted && !closed && endpoint != nil && timeouts.sourceMicrotaskTasks === tasks
    }
    init(scope:NativeGameplaySourceRegistrySession.Scope,timeouts:NativeSourceAppTimeoutOwner,tasks:NativeSourceMicrotaskAdapters,enqueue:@escaping(@escaping()->Void)->Bool){self.scope=scope;self.timeouts=timeouts;self.tasks=tasks;self.enqueue=enqueue}
    @discardableResult func mount()->Bool {
        guard !closed,scope.current,timeouts.sourceMicrotaskTasks === tasks else{return false}
        guard endpoint==nil else{return true}
        let lease=scope.mountCapturedEndpoint(.magnetGuardBeginFinally)
        guard !closed,scope.current,timeouts.sourceMicrotaskTasks === tasks else{if let lease{_ = scope.unmountCapturedEndpoint(lease)};return false}
        endpoint=lease;return lease != nil
    }
    func beginGuard()->((Bool)->Void)? {
        guard admission else{return nil};let acceptedEpoch=epoch
        guard let lease=scope.beginMagnetGuard() else{return nil}
        guard epoch==acceptedEpoch,admission,epoch==acceptedEpoch else {
            _ = scope.retireCapturedMagnetGuard(lease);return nil
        }
        captures[lease.epoch]=lease
        var consumed=false
        return {[weak self,scope] owned in
            guard !consumed else{return};consumed=true
            if scope.releaseMagnetGuard(lease,ownsLifecycle:owned),self?.captures[lease.epoch]==lease {self?.captures.removeValue(forKey:lease.epoch)}
        }
    }
    func schedule(id:String,generation:UInt64,ms:Int,elapsed:@escaping()->Void,cancelled:@escaping()->Void)->(()->Void)? {
        guard admission else{return nil}
        // Source timeout owner already wraps its literal timeout task. Its
        // Promise continuation goes through enqueue, not a second task wrapper.
        let receipt=timeouts.schedule(sourceID:"magnet-helper:\(id)",generation:generation,delayMilliseconds:ms,elapsed:elapsed,cancelled:cancelled)
        guard admission else{_ = timeouts.cancel(receipt);return nil}
        return {[timeouts] in _ = timeouts.cancel(receipt)}
    }
    func reaction(_ callback:@escaping()->Void)->Bool {guard admission else{return false};return enqueue(callback)}
    func retire(){
        guard !closed else{return};closed=true;epoch &+= 1
        let mounted=endpoint;endpoint=nil;let captured=Array(captures.values);captures=[:]
        if let mounted{_ = scope.unmountCapturedEndpoint(mounted)}
        for lease in captured {_ = scope.retireCapturedMagnetGuard(lease)}
    }
    isolated deinit {retire()}
}
