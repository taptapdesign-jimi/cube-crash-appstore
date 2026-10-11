import Foundation

/// PRIVATE literal queue scheduler, independent of renderer/GSAP pause. The
/// Core/Scene integration supplies AUTHORITATIVE permission/continuation; this
/// owner does not infer lastMerge from visual markers or read model copies.
@MainActor final class NativeMeterSourceQueue {
    enum Permission:Equatable {case allow,block(String),retry(String,Int)}
    enum Outcome {case spawned,notSpawned,rejected}
    struct Hooks {
        let current:()->Bool
        let permission:()->Permission
        let continuation:()->Bool // exact finite ready && !Core busyEnding
        let meterReady:()->Bool   // no busy predicate in literal then/finally
        let enqueue:(@escaping @MainActor ()->Void)->Void // app microtask owner
        let after:(Int,@escaping @MainActor ()->Void)->(()->Void) // app wall owner
        let inProgress:(Bool)->Void
        let retryPending:(Bool)->Void
        let shimmer:()->Void
        let spawn:(@escaping @MainActor (Outcome)->Void)->Void
        let reportFailure:()->Void
        let debounceCanonicalSave:(Int)->Void // shared save owner, not new timer
    }
    @MainActor private final class Retry {
        var cancel:(()->Void)?,closed=false
        func close(){guard !closed else{return};closed=true;let c=cancel;cancel=nil;c?()}
        func adopt(_ c:@escaping()->Void){if closed{c()}else{cancel=c}}
    }
    @MainActor private final class Spawn {var settled=false}
    private let hooks:Hooks
    private var closed=false,retry:Retry?,spawn:Spawn?
    var hasRetry:Bool {retry != nil}
    var isSpawning:Bool {spawn != nil}
    init(hooks:Hooks){self.hooks=hooks}
    private func valid()->Bool {guard !closed else{return false};let ok=hooks.current();return ok && !closed}
    func guardReleased(){
        guard valid(),hooks.continuation(),valid() else{return}
        hooks.enqueue{[weak self] in guard let self,self.valid(),self.hooks.continuation(),self.valid() else{return};self.queueIfNeeded()}
    }
    func queueIfNeeded(){
        guard valid() else{return}
        let permission=hooks.permission()
        guard valid() else{return}
        switch permission {
        case .block:return
        case .retry(let reason,let delay):
            guard !["busyEnding","fail-screen-pending","board-transition"].contains(reason) else{return}
            scheduleRetry(delay);return
        case .allow:break
        }
        // Permission must include canonical in-progress; this second captured
        // guard protects synchronous reentry without manufacturing a rule.
        guard spawn==nil else{return}
        let capture=Spawn();spawn=capture;hooks.inProgress(true)
        guard valid(),spawn === capture else{return}
        hooks.shimmer()
        guard valid(),spawn === capture else{return}
        hooks.spawn{[weak self,weak capture] outcome in
            guard let self,let capture,self.valid(),self.spawn === capture,!capture.settled else{return}
            capture.settled=true
            self.hooks.enqueue{[weak self,weak capture] in
                guard let self,let capture,self.valid(),self.spawn === capture else{return}
                // Promise .then fulfillment; rejection merely propagates.
                if case .notSpawned=outcome,self.hooks.meterReady(),self.valid(),self.retry==nil{self.scheduleRetry(600)}
                guard self.valid(),self.spawn === capture else{return}
                self.hooks.enqueue{[weak self,weak capture] in
                    guard let self,let capture,self.valid(),self.spawn === capture else{return}
                    // Promise .catch, including fulfillment passthrough.
                    if case .rejected=outcome{self.hooks.reportFailure()}
                    guard self.valid(),self.spawn === capture else{return}
                    self.hooks.enqueue{[weak self,weak capture] in
                        guard let self,let capture,self.valid(),self.spawn === capture else{return}
                        self.spawn=nil;self.hooks.inProgress(false)
                        guard self.valid() else{return}
                        if self.hooks.meterReady(),self.valid(),self.retry==nil{self.guardReleased()}
                        guard self.valid() else{return}
                        self.hooks.debounceCanonicalSave(400)
                    }
                }
            }
        }
    }
    /// Called by the successful actual Source spawn caller before returning
    /// true, as v9 spawnWildFromMeter clears any previously scheduled retry.
    func spawnSucceeded(){cancelRetry()}
    private func scheduleRetry(_ delay:Int){
        guard valid(),retry==nil else{return}
        let ticket=Retry();retry=ticket;hooks.retryPending(true)
        guard valid(),retry === ticket else{ticket.close();return}
        let cancel=hooks.after(delay){[weak self,weak ticket] in
            guard let self,let ticket,self.valid(),self.retry === ticket else{return}
            self.retry=nil;ticket.close();self.hooks.retryPending(false)
            guard self.valid() else{return};self.guardReleased()
        }
        ticket.adopt(cancel)
        if !valid() || retry !== ticket{ticket.close()}
    }
    private func cancelRetry(){
        let captured=retry;retry=nil;captured?.close()
        if captured != nil{hooks.retryPending(false)}
    }
    /// Canonical Core cancellation/reset owns meter/token/drop teardown. This
    /// transport only revokes old callbacks; old A cannot publish into new C.
    func dispose(){
        guard !closed else{return};closed=true
        let hadSpawn=spawn != nil;spawn=nil;cancelRetry()
        if hadSpawn{hooks.inProgress(false)}
    }
    isolated deinit {dispose()}
}
