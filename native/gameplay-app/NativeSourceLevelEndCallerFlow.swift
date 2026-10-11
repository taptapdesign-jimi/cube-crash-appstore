import Foundation

/// Actual delayed checkLevelEnd coroutine. Every decision is supplied by its
/// retained physical/global owners; unknown observations never authorize fail.
@MainActor final class NativeSourceLevelEndCallerFlow {
    enum Decision:Equatable {case continued,clean(String),stuck(String),wait(Int,String)}
    enum Gate:Equatable {case ready,stop,retry(Int,String)}
    struct Hooks {
        var current:()->Bool
        var wait:(Int,@escaping()->Void,@escaping()->Void)->(()->Void)
        var delayed:((Int,@escaping()->Void,@escaping()->Void)->(()->Void))?=nil
        /// Ordered original guard/repair sweep, including mandatory-cell repair.
        var preflight:()->Gate?
        var tutorialSingleTile:(@escaping(Bool?)->Void)->Void
        var physicalSignature:()->String?
        var writeSignature:(String)->Bool?
        var resolve:()->Decision?
        /// Drag/not-ready/current physical validation at each stuck recheck.
        var stableRecheck:()->Gate?
        /// Actual Source cooldown and lingering-six rescue owners.
        var stuckAdmission:(String)->Gate?
        var tutorialFinalChance:(String,@escaping(Bool?)->Void)->Void
        var finalAdmission:()->Gate?
        var clean:(String,@escaping()->Void)->Void
        var noMoves:(@escaping()->Void)->Void
        var continued:()->Void
    }
    private final class Invocation {let id=UUID();var cancel:(()->Void)?;var signature:String?;var rechecks=0;var closed=false;var waitID:UUID?}
    private let hooks:Hooks
    private var invocation:Invocation?
    private var disposed=false
    private(set) var diagnosticPhase="idle"
    private(set) var confirmedSignature:String?
    init(hooks:Hooks){self.hooks=hooks}
    private func valid(_ call:Invocation)->Bool {
        guard !disposed,!call.closed,invocation === call else{return false}
        let accepted=hooks.current()
        return accepted && !disposed && !call.closed && invocation === call
    }
    func check(){guard !disposed else{return};diagnosticPhase="check500";confirmedSignature=nil;let previous=invocation;invocation=nil;previous?.closed=true;previous?.cancel?();guard !disposed,hooks.current(),!disposed else{return};let call=Invocation();invocation=call;schedule(call,500,gsap:true){[weak self,weak call] in guard let self,let call else{return};self.begin(call)}}
    private func schedule(_ call:Invocation,_ ms:Int,gsap:Bool=false,_ action:@escaping()->Void){
        guard valid(call) else{return}
        let waitID=UUID();call.waitID=waitID
        let transport=gsap ? hooks.delayed ?? hooks.wait:hooks.wait
        let cancel=transport(ms,{[weak self,weak call] in guard let self,let call,self.valid(call),call.waitID==waitID else{return};call.waitID=nil;call.cancel=nil;action()}, {[weak self,weak call] in guard let self,let call,self.valid(call),call.waitID==waitID else{return};call.waitID=nil;self.close(call)})
        guard valid(call),call.waitID==waitID else{cancel();return};call.cancel=cancel
    }
    private func gate(_ value:Gate?,_ call:Invocation)->Bool {
        guard valid(call) else{return false}
        guard let value else{close(call);return false}
        switch value {case .ready:return true;case .stop:close(call);case .retry(let ms,_):schedule(call,ms,gsap:true){[weak self,weak call] in guard let self,let call else{return};self.check()}}
        return false
    }
    private func begin(_ call:Invocation){
        diagnosticPhase="preflight"
        guard valid(call),gate(hooks.preflight(),call) else{return}
        diagnosticPhase="await-tutorial-single"
        hooks.tutorialSingleTile{[weak self,weak call] repaired in
            guard let self,let call,self.valid(call) else{return}
            guard let repaired,!repaired else{self.close(call);return}
            guard let signature=self.hooks.physicalSignature(),self.valid(call),
                self.hooks.writeSignature(signature) != nil,self.valid(call) else{self.close(call);return}
            call.signature=signature;call.rechecks=0;self.decide(call)
        }
    }
    private func decide(_ call:Invocation){
        diagnosticPhase="resolve"
        guard valid(call),let decision=hooks.resolve(),valid(call) else{close(call);return}
        switch decision {
        case .continued:close(call);hooks.continued()
        case .clean(let reason):hooks.clean(reason){[weak self,weak call] in guard let self,let call,self.valid(call) else{return};self.close(call)}
        case .wait(let ms,_):schedule(call,ms,gsap:true){[weak self,weak call] in guard let self,let call else{return};self.check()}
        case .stuck(let reason):guard gate(hooks.stuckAdmission(reason),call) else{return};confirm(call,reason)
        }
    }
    private func confirm(_ call:Invocation,_ reason:String){
        guard valid(call) else{return}
        if call.rechecks < 2 {
            schedule(call,250){[weak self,weak call] in
                guard let self,let call,self.valid(call),self.gate(self.hooks.stableRecheck(),call) else{return}
                guard let decision=self.hooks.resolve(),self.valid(call),case .stuck(let nextReason)=decision,
                    let signature=self.hooks.physicalSignature(),self.valid(call),signature==call.signature else{
                    self.schedule(call,250,gsap:true){[weak self,weak call] in guard let self,let call else{return};self.check()};return
                }
                call.rechecks+=1;self.confirm(call,nextReason)
            };return
        }
        hooks.tutorialFinalChance(reason){[weak self,weak call] repaired in
            guard let self,let call,self.valid(call) else{return}
            guard let repaired,!repaired else{self.close(call);return}
            guard self.gate(self.hooks.finalAdmission(),call),self.valid(call) else{return}
            self.confirmedSignature=call.signature
            self.hooks.noMoves{[weak self,weak call] in guard let self,let call,self.valid(call) else{return};self.close(call)}
        }
    }
    private func close(_ call:Invocation){guard invocation === call else{return};diagnosticPhase="closed:"+diagnosticPhase;invocation=nil;call.closed=true;call.waitID=nil;let cancel=call.cancel;call.cancel=nil;cancel?()}
    func dispose(){guard !disposed else{return};disposed=true;confirmedSignature=nil;if let call=invocation{close(call)}}
}

/// Literal resolveStuckWildDeferralDecision: app Date and actual continuation
/// observation are supplied by the mounted caller, never inferred from a plan.
struct NativeSourceStuckWildDeferral {
    enum Action:Equatable {case deferFail,continueFail,forceFail}
    private(set) var startedAt:Double?
    mutating func decide(pending:Bool,now:Double)->Action? {
        guard now.isFinite else{return nil}
        guard pending else{startedAt=nil;return .continueFail}
        let started=startedAt ?? now;startedAt=started
        return max(0,now-started)<2200 ? .deferFail:.forceFail
    }
    mutating func reset(){startedAt=nil}
}
