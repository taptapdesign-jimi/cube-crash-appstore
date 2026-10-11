import Foundation
import StackToSixGameplay

/// Actual external-contact claims and named Source completion boundaries only.
/// No pendingPlan polling, wall expiration timer or global-pause cleanup.
@MainActor final class NativeSourceSpecialSceneTransactionOwner {
    @MainActor private final class Capture {
        let token:UInt64,generation:UInt64,sourceID:String,destinationID:String,kind:NativeSourceSpecialTransactionRegistry.Kind
        var planID:String?,released=false,boardCommitted=false,gameplayComplete=false,visualComplete=false
        init(token:UInt64,generation:UInt64,source:String,destination:String,kind:NativeSourceSpecialTransactionRegistry.Kind){self.token=token;self.generation=generation;sourceID=source;destinationID=destination;self.kind=kind}
    }
    private let scope:NativeGameplaySourceRegistrySession.Scope,mutations:NativeSourceContactMutationOwner
    private let current:()->Bool,guardReleased:()->Void
    private var endpoint:NativeGameplaySourceRegistrySession.EndpointLease?
    private var pending:Capture?,plans:[String:Capture]=[:],closed=false,epoch:UInt64=0
    var capturedTntCount:Int {plans.values.filter{$0.kind == .tnt && !$0.released}.count}
    init(scope:NativeGameplaySourceRegistrySession.Scope,mutations:NativeSourceContactMutationOwner,
         current:@escaping()->Bool,guardReleased:@escaping()->Void){self.scope=scope;self.mutations=mutations;self.current=current;self.guardReleased=guardReleased}
    var admissionOpen:Bool {
        guard !closed,scope.current else{return false};let accepted=current()
        return accepted && !closed && scope.current
    }
    @discardableResult func mount()->Bool {
        guard admissionOpen,endpoint==nil else{return endpoint != nil && admissionOpen}
        epoch &+= 1;let accepted=epoch
        guard let next=scope.mountCapturedEndpoint(.specialContactCommitRelease) else{return false}
        guard admissionOpen,epoch==accepted,endpoint==nil else{_ = scope.unmountCapturedEndpoint(next);return false}
        endpoint=next;return true
    }
    func claim(source:NativeTile,destination:NativeTile,kind:NativeWildArchetype,generation:UInt64)->NativeSourceSpecialContactLease? {
        guard admissionOpen,endpoint != nil,pending==nil else{return nil}
        let family=sourceFamily(kind)
        epoch &+= 1;let admittedEpoch=epoch
        guard let token=scope.claimSpecial(kind:family) else{return nil}
        let next=Capture(token:token,generation:generation,source:source.id,destination:destination.id,kind:family)
        guard admissionOpen,epoch==admittedEpoch,pending==nil else{_ = scope.releaseSpecial(token:token);return nil}
        pending=next
        return .init(isCurrent:{[weak self,weak next] in guard let self,let next else{return false};return self.admissionOpen && self.pending === next && !next.released},rejected:{[weak self,next,scope] in
            if let self {self.release(next)}
            else if !next.released {next.released=true;_ = scope.releaseSpecial(token:next.token)}
        })
    }
    /// Called exactly once for engine.drop's accepted EXTERNAL input result,
    /// before consume/FX. Source claim happened before this counter increment.
    @discardableResult func acceptedContact(_ result:NativeMoveResult,direct:NativeDirectWildMovePlan?,special:NativeSpecialMovePlan?)->Bool {
        guard admissionOpen,result.accepted else{return false}
        if let next=pending {
            let receipt=result.events.first{event in
                (event.kind == .directWildReserved || event.kind == .specialReserved) && event.archetype.map{sourceFamily($0)==next.kind}==true && event.reason != nil
            }
            guard result.state.generation==next.generation,let plan=receipt?.reason else{release(next);return false}
            let genuineDirect=direct.map{$0.id==plan && $0.generation==next.generation && $0.source.id==next.sourceID && $0.destination.id==next.destinationID && sourceFamily($0.archetype)==next.kind} ?? false
            let genuineSpecial=special.map{$0.id==plan && $0.generation==next.generation && $0.source.id==next.sourceID && $0.destination.id==next.destinationID && sourceFamily($0.archetype)==next.kind} ?? false
            guard genuineDirect || genuineSpecial else{release(next);return false}
            pending=nil;next.planID=plan;plans[plan]=next
        }
        return mutations.acceptedExternalContact() != nil
    }
    func rejectedContact(){if let capture=pending{release(capture)}}
    /// Literal resetMerge6SpawnState: Star/Juice primary+locked continuation,
    /// busy main80 abort, or actual final cleanup (not visual timer polling).
    func directGameplaySettled(id:String,generation:UInt64){
        guard let capture=owned(id,generation),capture.kind == .star || capture.kind == .juice || capture.kind == .magnet || capture.kind == .tnt else{return}
        release(capture)
    }
    /// Exact reserve-after-blast-return receipt, or Magnet replacement+survivor
    /// conversion/placeholder commit. Core.state.revision is never supplied.
    func boardCommitted(id:String,generation:UInt64){
        guard let capture=owned(id,generation),!capture.boardCommitted,admissionOpen else{return}
        if scope.commitSpecial(token:capture.token,revision:mutations.revision){capture.boardCommitted=true}
    }
    func tntGameplayComplete(id:String,generation:UInt64){guard let capture=owned(id,generation),capture.kind == .tnt else{return};capture.gameplayComplete=true;finishTnt(capture)}
    func tntVisualComplete(id:String,generation:UInt64){guard let capture=owned(id,generation),capture.kind == .tnt else{return};capture.visualComplete=true;finishTnt(capture)}
    private func finishTnt(_ capture:Capture){if capture.gameplayComplete && capture.visualComplete {release(capture)}}
    /// ONLY actual app-merge coroutine ownsLifecycle finally can call this;
    /// boardCommitted and native replacement bounce are NOT that receipt.
    func magnetHelperFinally(id:String,generation:UInt64,ownsLifecycle:Bool){guard ownsLifecycle,let capture=owned(id,generation),capture.kind == .magnet else{return};release(capture)}
    func absorbInterrupted(id:String,generation:UInt64){if let capture=owned(id,generation){release(capture)}}
    private func sourceFamily(_ kind:NativeWildArchetype)->NativeSourceSpecialTransactionRegistry.Kind {
        switch kind {case .star:return .star;case .juice:return .juice;case .magnet:return .magnet;case .tnt:return .tnt}
    }
    private func owned(_ id:String,_ generation:UInt64)->Capture? {guard let capture=plans[id],capture.generation==generation,!capture.released else{return nil};return capture}
    private func release(_ capture:Capture){
        guard !capture.released else{return};capture.released=true
        if pending === capture{pending=nil}
        if let id=capture.planID,plans[id] === capture{plans.removeValue(forKey:id)}
        let released=scope.releaseSpecial(token:capture.token)
        if released,admissionOpen {guardReleased()}
    }
    /// Actual destructive scope/board reset only. It seals before external
    /// cleanup; old releases never erase another captured Source registry token.
    isolated deinit {retire()}
    func retire(){guard !closed else{return};closed=true;epoch &+= 1
        let mounted=endpoint;endpoint=nil;let captured=Array(plans.values)+(pending.map{[$0]} ?? []);pending=nil;plans=[:]
        if let mounted{_ = scope.unmountCapturedEndpoint(mounted)}
        captured.forEach{release($0)}
    }
}
