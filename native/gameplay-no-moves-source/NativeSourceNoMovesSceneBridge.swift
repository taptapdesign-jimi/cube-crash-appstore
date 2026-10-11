import Foundation
import StackToSixGameplay

/// NO clock. App wall waits/700 race and actual selected text exit/1190 fallback
/// are injected separately. Default OFF until full Scene caller admission.
@MainActor final class NativeSourceNoMovesSceneBridge {
    enum Phase {case waiting,exiting,clearingForTimeout,locking,boardExit,closed}
    private final class Capture {
        let id=UUID(),plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64
        var phase=Phase.waiting
        init(_ plan:NativeNoMovesCandidateOwner.Plan,_ generation:UInt64){self.plan=plan;self.generation=generation}
    }
    struct Hooks {
        var current:(UInt64)->Bool
        /// Refresh markers ONLY from genuine Scene/node/transaction owners.
        var refreshSourceRuntime:()->Void
        /// finite NativeSourceAppTimeoutOwner; Source pause does not cancel it.
        var appWait:(String,UInt64,Int,@escaping()->Void,@escaping()->Void)->Void
        var navigation:(Bool)->Void
        var stopIdleAndIdleSmoke:()->Void
        var persistStuckState:()->Void
        var resetHint:()->Void
        /// Actual UIKit Source graph with original4 assets/font, plus own1190
        /// wall fallback. Mount immediately; beginTextExit delivers true actual
        /// natural/fallback completion, false rejected exit (Source catch).
        var showText:(NativeNoMovesCandidateOwner.Plan,UInt64)->Void
        var beginTextExit:(UInt64,@escaping(Bool)->Void)->Void
        var clearText:()->Void
        /// Own terminal flags +all-input TTL12000; Core lock fresh-check occurs
        /// immediately AFTER this hook (actual pointer reentry is captured).
        var terminalFields:(Bool,Int)->Void
        var restartIdle:()->Void
        var queueGuardRelease:(String)->Void
        /// Source scheduleCheckLevelEnd uses GSAP200, NOT appWait.
        var scheduleGSAPRecheck:(Int,String)->Void
        var confirmedBoardExit:(UInt64,@escaping(Bool)->Void)->Void
        var confirmedResult:(NativeMoveResult)->Void
        var exitFailure:()->Void
    }
    let engine:NativeGameplayEngine
    private let hooks:Hooks
    var enabled=false
    private var active:Capture?
    private var retired=false
    var hasActiveCandidate:Bool {active != nil}
    init(engine:NativeGameplayEngine,hooks:Hooks){self.engine=engine;self.hooks=hooks}
    private func valid(_ capture:Capture,phase:Phase?=nil)->Bool {
        guard !retired,active === capture,engine.state.generation==capture.generation,
              phase==nil || capture.phase==phase else{return false}
        let admitted=hooks.current(capture.generation)
        return !retired && active === capture && admitted && engine.state.generation==capture.generation && (phase==nil || capture.phase==phase)
    }
    private func refresh(_ capture:Capture,phase:Phase)->Bool {
        guard valid(capture,phase:phase) else{return false};hooks.refreshSourceRuntime();return valid(capture,phase:phase)
    }
    @discardableResult func begin(origin:NativeNoMovesOrigin,extraWaitMilliseconds:Int=0)->NativeNoMovesCandidateOwner.Effect {
        guard enabled,!retired,active==nil else{return .ignored}
        let generation=engine.state.generation
        let initiallyCurrent=hooks.current(generation)
        guard initiallyCurrent,enabled,!retired,active==nil,engine.state.generation==generation else{return .ignored}
        hooks.refreshSourceRuntime()
        let stillCurrent=hooks.current(generation)
        guard stillCurrent,enabled,!retired,active==nil,engine.state.generation==generation else{return .ignored}
        let effect=engine.beginSourceNoMoves(origin:origin,extraWaitMilliseconds:extraWaitMilliseconds)
        applyInitial(effect,generation:generation);return effect
    }
    /// Called AFTER actual ordinary postcheck Core commit but BEFORE generic
    /// consume/handleResolution can schedule a levelEnd candidate instead.
    @discardableResult func ordinaryPostcheck(receiptID:String,generation:UInt64)->NativeNoMovesCandidateOwner.Effect {
        guard enabled,!retired,active==nil,engine.state.generation==generation else{return .ignored}
        let initiallyCurrent=hooks.current(generation)
        guard initiallyCurrent,enabled,!retired,active==nil,engine.state.generation==generation else{return .ignored}
        hooks.refreshSourceRuntime()
        let stillCurrent=hooks.current(generation)
        guard stillCurrent,enabled,!retired,active==nil,engine.state.generation==generation else{return .ignored}
        let effect=engine.beginSourceNoMovesForOrdinaryPostcheck(receiptID:receiptID,generation:generation)
        applyInitial(effect,generation:generation);return effect
    }
    /// Genuine caller receipt after its original forced checker/tutorial/Wild
    /// sequence. Core owns exact provenance; generic origin inference is bypassed.
    @discardableResult func capturedCaller(_ receipt:NativeSourceNoMovesCallerReceipt)->NativeNoMovesCandidateOwner.Effect {
        guard enabled,!retired,active==nil,engine.sourceNoMovesCallerIsCurrent(receipt) else{return .ignored}
        let initiallyCurrent=hooks.current(receipt.generation)
        guard initiallyCurrent,enabled,!retired,active==nil,engine.sourceNoMovesCallerIsCurrent(receipt) else{return .ignored}
        hooks.refreshSourceRuntime()
        let stillCurrent=hooks.current(receipt.generation)
        guard stillCurrent,enabled,!retired,active==nil,engine.sourceNoMovesCallerIsCurrent(receipt) else{return .ignored}
        let effect=engine.beginSourceNoMovesFromCaller(receipt)
        applyInitial(effect,generation:receipt.generation);return effect
    }
    /// Actual native showFinalScreen owner accepted its synchronous launch.
    /// Its independent wall40/60/board-exit/modal cleanup still retains ownership.
    @discardableResult func confirmedCallerInvocation(planToken:UInt64,generation:UInt64)->Bool {
        guard let c=active,c.plan.token==planToken,c.generation==generation,valid(c,phase:.boardExit) else{return false}
        return engine.finishSourceNoMovesCallerInvocation(planToken:planToken,generation:generation)
    }
    private func applyInitial(_ effect:NativeNoMovesCandidateOwner.Effect,generation:UInt64) {
        switch effect {
        case .candidate(let plan):
            guard !retired,engine.state.generation==generation else{return}
            let c=Capture(plan,generation);active=c
            hooks.navigation(true);guard valid(c,phase:.waiting) else{return}
            hooks.stopIdleAndIdleSmoke();guard valid(c,phase:.waiting) else{return}
            if plan.trigger.persistStuckState {hooks.persistStuckState();guard valid(c,phase:.waiting) else{return}}
            if plan.trigger.resetHint {hooks.resetHint();guard valid(c,phase:.waiting) else{return}}
            hooks.showText(plan,generation);guard valid(c,phase:.waiting) else{return}
            hooks.appWait("no-moves-wait:"+c.id.uuidString,generation,plan.waitMilliseconds,{[weak self,weak c] in guard let self,let c else{return};self.waitDelivered(c,cancelled:false)},{[weak self,weak c] in guard let self,let c else{return};self.waitDelivered(c,cancelled:true)})
        case .deferred(let reason):
            guard !retired,engine.state.generation==generation else{return}
            hooks.queueGuardRelease("no-moves-prelock-deferred:"+reason)
            guard !retired,engine.state.generation==generation else{return}
            hooks.scheduleGSAPRecheck(200,reason)
        default:break
        }
    }
    private func waitDelivered(_ c:Capture,cancelled:Bool) {
        guard refresh(c,phase:.waiting) else{return}
        let effect=engine.deliverSourceNoMovesWait(plan:c.plan,generation:c.generation,cancelled:cancelled)
        switch effect {
        case .exit:
            c.phase = .exiting
            hooks.beginTextExit(c.generation,{[weak self,weak c] success in guard let self,let c else{return};self.exitDelivered(c,delivery:success ? .exited:.rejected)})
            // Literal Promise.race starts exit FIRST, then wall700. Do not put
            // this on GSAP or cancel a genuine candidate merely due globalpause.
            // Even a synchronous rejected exit may win; remaining timer reply
            // only observes matching active/exiting capture, never replacement.
            if let timeout=c.plan.trigger.exitTimeoutMilliseconds,!retired,engine.state.generation==c.generation {
                hooks.appWait("no-moves-exit-race:"+c.id.uuidString,c.generation,timeout,{[weak self,weak c] in
                    guard let self,let c,self.valid(c,phase:.exiting) else{return}
                    c.phase = .clearingForTimeout
                    self.hooks.clearText();guard self.valid(c,phase:.clearingForTimeout) else{return}
                    c.phase = .exiting;self.exitDelivered(c,delivery:.timedOut)
                },{[weak self,weak c] in guard let self,let c else{return};self.exitDelivered(c,delivery:.cancelled)})
            }
        case .rollback:rollback(effect,c)
        default:break
        }
    }
    private func exitDelivered(_ c:Capture,delivery:NativeNoMovesCandidateOwner.ExitDelivery) {
        guard refresh(c,phase:.exiting) else{return}
        let effect=engine.deliverSourceNoMovesTextExit(plan:c.plan,generation:c.generation,delivery:delivery)
        switch effect {
        case .acquireInputLock:
            c.phase = .locking
            let locked=engine.acquireSourceNoMovesLock(plan:c.plan,generation:c.generation,afterLock:{[weak self,weak c] in
                guard let self,let c,self.valid(c,phase:.locking) else{return}
                self.hooks.terminalFields(true,c.plan.inputLockTTLMilliseconds)
                guard self.valid(c,phase:.locking) else{return};self.hooks.refreshSourceRuntime()
            })
            guard valid(c,phase:.locking) else{return}
            if case .confirmedFinal=locked {
                c.phase = .boardExit
                hooks.confirmedBoardExit(c.generation,{[weak self,weak c] success in guard let self,let c else{return};self.boardExited(c,success:success)})
            } else if case .rollback=locked {rollback(locked,c)}
        case .rollback:rollback(effect,c)
        default:break
        }
    }
    private func rollback(_ effect:NativeNoMovesCandidateOwner.Effect,_ c:Capture) {
        guard case .rollback(_,let reason,let releaseInput)=effect,valid(c) else{return}
        // Keep capture until AFTER each cleanup callback; replacement/reentry
        // stops this sequence. Once closed a duplicate callback cannot publish.
        c.phase = .closed
        hooks.navigation(false);guard valid(c,phase:.closed) else{return}
        hooks.clearText();guard valid(c,phase:.closed) else{return}
        if releaseInput {hooks.terminalFields(false,c.plan.inputLockTTLMilliseconds);guard valid(c,phase:.closed) else{return}}
        hooks.restartIdle();guard valid(c,phase:.closed) else{return}
        hooks.queueGuardRelease("no-moves-cancelled:"+reason);guard valid(c,phase:.closed) else{return}
        hooks.scheduleGSAPRecheck(200,reason);guard valid(c,phase:.closed) else{return}
        active=nil
        _=engine.finishSourceNoMovesCallerRollback(planToken:c.plan.token,generation:c.generation)
    }
    private func boardExited(_ c:Capture,success:Bool) {
        guard valid(c,phase:.boardExit) else{return}
        guard success else{hooks.exitFailure();return} // no fake terminal arrival
        let result=engine.finishSourceNoMovesBoardExit(plan:c.plan,generation:c.generation)
        guard valid(c,phase:.boardExit),result.accepted else{return}
        c.phase = .closed;active=nil;hooks.confirmedResult(result)
    }
    /// Generation retirement only. Pure pause/background NEVER calls this.
    /// Actual same-generation wait cancellation must use appWait.cancel receipt
    /// so Core executes captured Source rollback, not this stale-root cleanup.
    func retireObsolete(){guard !retired else{return};retired=true;active?.phase = .closed;active=nil}
}
