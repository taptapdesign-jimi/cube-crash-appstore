import Foundation
import StackToSixGameplay

/// PRIVATE queue receipt bridge. The Source queue owns the outer600 retry;
/// the Core owns12 creation attempts and distinct40 empty-cell waits. Success
/// comes from actual meterDropCompleted, never wall140 or resource readiness.
@MainActor final class NativeMeterSourceQueueCoreBridge {
    struct Hooks {
        let current:()->Bool
        let permission:(Bool)->NativeMeterSourceQueue.Permission
        let continuation:()->Bool
        let meterReady:()->Bool
        let enqueue:(@escaping @MainActor ()->Void)->Void
        let sourceQueueInProgress:(Bool)->Void
        let shimmer:()->Void
        let canonicalSave:(Int)->Void
        let consume:(NativeMoveResult,NativeBoardState)->Void
        let fault:(String)->Void
    }
    @MainActor private final class Attempt {
        let id=UUID(),generation:UInt64
        let completed:(NativeMeterSourceQueue.Outcome)->Void
        var dropID:String?,closed=false
        init(generation:UInt64,completed:@escaping(NativeMeterSourceQueue.Outcome)->Void){self.generation=generation;self.completed=completed}
    }
    private let engine:NativeGameplayEngine,timeouts:NativeSourceAppTimeoutOwner,hooks:Hooks,signalRegistry:NativeMeterQueueSignals
    private var signal:NativeMeterQueueSignals.Capture?
    private var closed=false,attempt:Attempt?,innerWait:NativeSourceAppTimeoutOwner.Receipt?
    private var retrySequence:UInt64=0
    private lazy var queue:NativeMeterSourceQueue=NativeMeterSourceQueue(hooks:.init(current:{[weak self] in self?.valid()==true},permission:{[weak self] in
        guard let self,self.valid() else{return .block("retired")}
        guard self.engine.state.tutorial?.specialBarDefersReward != true else{return .block("tutorial-special-bar")}
        return self.hooks.permission(self.queue.isSpawning)
    },continuation:{[weak self] in guard let self,self.engine.state.tutorial?.specialBarDefersReward != true else{return false};return self.hooks.continuation()},meterReady:{[weak self] in guard let self,self.engine.state.tutorial?.specialBarDefersReward != true else{return false};return self.hooks.meterReady()},enqueue:hooks.enqueue,after:{[weak self] delay,callback in
        guard let self,self.valid() else{return {}}
        self.retrySequence &+= 1
        let receipt=self.timeouts.schedule(sourceID:"source-meter-outer-retry:\(self.retrySequence)",generation:self.engine.state.generation,delayMilliseconds:delay,elapsed:callback)
        return{[timeouts] in _=timeouts.cancel(receipt)}
    },inProgress:{[weak self] in self?.signal?.setProgress($0)},retryPending:{[weak self] in self?.signal?.setRetry($0)},shimmer:hooks.shimmer,spawn:{[weak self] completed in self?.begin(completed)},reportFailure:{[weak self] in self?.hooks.fault("Actual Source meter coroutine rejected")},debounceCanonicalSave:hooks.canonicalSave))
    init(engine:NativeGameplayEngine,timeouts:NativeSourceAppTimeoutOwner,signalRegistry:NativeMeterQueueSignals,hooks:Hooks){self.engine=engine;self.timeouts=timeouts;self.signalRegistry=signalRegistry;self.hooks=hooks}
    private func valid()->Bool {guard !closed else{return false};let c=hooks.current();return !closed && c}
    private func valid(_ a:Attempt)->Bool {valid() && !a.closed && attempt === a && a.generation==engine.state.generation}
    func captureSourceQueueSignals()->NativeMeterQueueSignals.Snapshot? {
        guard valid(),let captured=signal,let value=captured.captureSnapshot(),
              valid(),signal === captured,value.generation==engine.state.generation else{return nil}
        return value
    }
    /// Install the actual queue writer before an environment reader asks for
    /// its initial state. This performs no enqueue, reward claim or Date read.
    @discardableResult func activateSourceSignals()->Bool {ensureBinding()}
    private func ensureBinding()->Bool {
        guard valid() else{return false}
        if let signal{return signal.isCurrent}
        let generation=engine.state.generation
        let captured=signalRegistry.begin(generation:generation,current:{[weak self] in guard let self else{return false};return self.valid() && self.engine.state.generation==generation},changed:{[engine,hooks] progress,retry in
            // Independent writer capture still releases exact active flags when
            // the bridge is deallocated; weak bridge identity is already nil.
            guard engine.state.generation==generation else{return}
            engine.sourceWildRetryPending=retry
            hooks.sourceQueueInProgress(progress)
        },retire:{[weak self] in self?.dispose()})
        guard valid(),let captured,captured.isCurrent else{captured?.release();return false}
        signal=captured;return true
    }
    func guardReleased(){guard ensureBinding() else{return};queue.guardReleased()}
    func queueIfNeeded(){guard ensureBinding() else{return};queue.queueIfNeeded()}
    private func begin(_ completed:@escaping(NativeMeterSourceQueue.Outcome)->Void){
        guard valid(),attempt==nil else{return}
        let a=Attempt(generation:engine.state.generation,completed:completed);attempt=a
        guard let capturedSignal=signal,let snapshot=capturedSignal.captureSnapshot(),
              snapshot.generation==a.generation,snapshot.inProgress,valid(a) else{finish(a,.rejected);return}
        let claim=NativeGameplayEngine.SourceMeterQueueClaimCapture(ownerID:capturedSignal.id,generation:a.generation,
            isCurrent:{[weak self,weak a,weak capturedSignal] in
                guard let self,let a,let capturedSignal,self.valid(a),self.signal === capturedSignal,
                      let current=capturedSignal.captureSnapshot() else{return false}
                return current.generation==a.generation && current.inProgress && self.valid(a) && self.signal === capturedSignal
            })
        let previous=engine.state,result=engine.claimSourceMeterReward(queue:claim)
        guard valid(a) else{return}
        guard result.accepted else{finish(a,.notSpawned);return}
        // Real Scene consumer dispatches hidden creation. It must call receive
        // for its subsequent Core packets BEFORE handleResolution requeue.
        hooks.consume(result,previous)
        guard valid(a) else{return};receive(result)
    }
    func receive(_ result:NativeMoveResult){
        guard result.accepted,let a=attempt,valid(a),result.state.generation==a.generation else{return}
        for event in result.events {
            guard valid(a) else{return}
            switch event.kind {
            case .meterDropReserved:a.dropID=event.reason
            case .meterDropOpenRetryPrepared:
                guard let retry=engine.pendingMeterOpenRetry,retry.id==event.reason,innerWait==nil else{continue}
                let receipt=timeouts.schedule(sourceID:retry.id,generation:retry.generation,delayMilliseconds:retry.milliseconds,elapsed:{[weak self,weak a] in
                    guard let self,let a,self.valid(a),self.engine.pendingMeterOpenRetry?.id==retry.id else{return}
                    self.innerWait=nil
                    let previous=self.engine.state,result=self.engine.deliverMeterOpenEmptyWait(id:retry.id,generation:retry.generation)
                    guard self.valid(a) else{return};self.hooks.consume(result,previous)
                    guard self.valid(a) else{return};self.receive(result)
                })
                guard valid(a) else{_=timeouts.cancel(receipt);return};innerWait=receipt
            case .meterDropCompleted:
                guard event.reason==a.dropID else{continue};queue.spawnSucceeded();finish(a,.spawned)
            case .meterDropOpenFailed:finish(a,.notSpawned)
            case .meterDropCanceled:
                if event.reason==a.dropID{finish(a,.notSpawned)}
            default:break
            }
        }
    }
    /// Rejected actual coroutine differs from refused/12-attempt exhaustion.
    /// Asset onFailure cannot call this as a success/prepare substitute.
    func coroutineRejected(){guard let a=attempt,valid(a) else{return};finish(a,.rejected)}
    private func finish(_ a:Attempt,_ outcome:NativeMeterSourceQueue.Outcome){
        guard valid(a) else{return};a.closed=true;attempt=nil
        if let receipt=innerWait{innerWait=nil;_=timeouts.cancel(receipt)}
        guard valid() else{return};a.completed(outcome)
    }
    func dispose(){
        guard !closed else{return};closed=true
        attempt?.closed=true;attempt=nil
        if let receipt=innerWait{innerWait=nil;_=timeouts.cancel(receipt)}
        queue.dispose()
        let captured=signal;signal=nil;captured?.release()
    }
    isolated deinit {dispose()}
}
