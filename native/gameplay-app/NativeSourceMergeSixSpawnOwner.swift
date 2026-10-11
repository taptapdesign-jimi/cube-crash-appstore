import Foundation
import SpriteKit

/// Literal merge6SpawnOwnerSequence / activeMerge6SpawnOwnerToken lifecycle.
/// Companion resets are mandatory actual captured Source owners, not inferred
/// from a Native pending plan, input permission or renderer animation duration.
@MainActor final class NativeSourceMergeSixSpawnOwner {
    nonisolated struct Claim:Equatable {
        fileprivate let instance:UUID
        let token:UInt64,ownerID:String,generation:UInt64,bindingID:UUID
    }
    struct ResetBindings {
        let endResolutionFrames:()->Void
        let releaseSpecialTransaction:()->Void
        let queueWildAfterGuardRelease:()->Void
    }
    private var sequence:UInt64=0,epoch:UInt64=0,disposed=false
    private(set) var active:Claim?
    private var diagnostic:NativeSourceAnimationClockService.Lease?
    private var diagnosticParticipant:Diagnostic?
    private var resetBindings:ResetBindings?
    var inProgress:Bool {active != nil}
    var allocationSequence:UInt64 {sequence}
    var resetDiagnosticActive:Bool {diagnostic?.active==true}
    @MainActor private final class Diagnostic:NativeSourceAnimationParticipant {
        func advanceSourceAnimation(seconds:Double){}
    }
    /// Date record occurs AFTER the true active token and in-progress flag are
    /// assigned, exactly before the diagnostic delayedCall is installed.
    func begin(ownerID:String,generation:UInt64,bindingID:UUID,
               service:NativeSourceAnimationClockService,bindings:ResetBindings,
               current:()->Bool,recordDate:(Claim)->Bool)->Claim? {
        guard !disposed,active==nil else{return nil};let e=epoch,admitted=current()
        guard admitted,!disposed,epoch==e,active==nil else{return nil}
        sequence &+= 1;epoch &+= 1
        let claim=Claim(instance:UUID(),token:sequence,ownerID:ownerID,generation:generation,bindingID:bindingID)
        active=claim;resetBindings=bindings
        let accepted=recordDate(claim)
        guard accepted,!disposed,active==claim else{return nil}
        let stillCurrent=current()
        guard stillCurrent,!disposed,active==claim else{return nil}
        let participant=Diagnostic();diagnosticParticipant=participant
        // trackDelayedCall(2.5) is GSAP, not wall. Its callback clears only the
        // diagnostic reference; ownership survives indefinitely until reset.
        let installed=service.register(participant:participant,duration:0,domain:.sourceGSAP(.eagerTween),delay:2.5) { [weak self] success in
            guard success,let self,!self.disposed,self.active==claim else{return}
            self.diagnostic=nil;self.diagnosticParticipant=nil
        }
        guard !disposed,active==claim else{installed?.cancel();return nil}
        guard let installed else{return nil}
        diagnostic=installed
        return claim
    }
    func owns(_ claim:Claim)->Bool {!disposed && active==claim}
    /// Only an actual captured Source coroutine finally/error/reset caller may
    /// call this. No Native handoff callback is wired to it by this packet.
    @discardableResult func reset(_ claim:Claim,releaseSpecial:Bool=true)->Bool {
        guard !disposed,active==claim else{return false}
        return clearCaptured(claim,releaseSpecial:releaseSpecial)
    }
    private func clearCaptured(_ claim:Claim,releaseSpecial:Bool)->Bool {
        guard active==claim else{return false}
        let timer=diagnostic,bindings=resetBindings
        active=nil;diagnostic=nil;diagnosticParticipant=nil;resetBindings=nil;epoch &+= 1
        let captured=epoch
        timer?.cancel()
        guard epoch==captured,active==nil else{return true}
        bindings?.endResolutionFrames()
        guard epoch==captured,active==nil else{return true}
        if releaseSpecial {bindings?.releaseSpecialTransaction()}
        guard epoch==captured,active==nil else{return true}
        bindings?.queueWildAfterGuardRelease()
        return true
    }
    /// Actual captured Scene/navigation teardown, with stale A protection.
    /// This is a force reset only for the currently owned binding, no Date.
    func retire(bindingID:UUID) {
        guard let claim=active,claim.bindingID==bindingID else{return}
        _=clearCaptured(claim,releaseSpecial:true)
    }
    func dispose(){guard !disposed else{return};disposed=true
        if let claim=active {_=clearCaptured(claim,releaseSpecial:true)}
        epoch &+= 1
    }
}

/// Literal merge6-destination-cleanup-owner.ts. Tokens live on the exact
/// retained tile; the APP owner retains only its monotonic sequence.
@MainActor final class NativeSourceMergeSixDestinationCleanupOwner {
    private var nextToken:UInt64=1
    func claim(_ tile:NativeDiceNode)->UInt64? {
        guard tile.sourceContactNodeAlive else{return nil}
        let token=nextToken;nextToken &+= 1
        tile.sourceMergeSixCleanupToken=token
        _=protect(tile,token:token)
        return token
    }
    @discardableResult func protect(_ tile:NativeDiceNode,token:UInt64?)->Bool {
        guard owns(tile,token:token) else{return false}
        tile.sourceEventMode="none";tile.isUserInteractionEnabled=false
        return true
    }
    func owns(_ tile:NativeDiceNode,token:UInt64?)->Bool {
        guard tile.sourceContactNodeAlive,let token else{return false}
        return tile.sourceMergeSixCleanupToken==token
    }
    func hasClaim(_ tile:NativeDiceNode)->Bool {
        tile.sourceContactNodeAlive && tile.sourceMergeSixCleanupToken != nil
    }
    @discardableResult func release(_ tile:NativeDiceNode,token:UInt64?)->Bool {
        guard owns(tile,token:token) else{return false}
        tile.sourceMergeSixCleanupToken=nil
        return true
    }
    func forget(_ tile:NativeDiceNode){tile.sourceMergeSixCleanupToken=nil}
    /// Real Source wall1200 watchdog; caller supplies the actual final flags
    /// and destination-only mutation endpoint. It never invents main arrival.
    func scheduleOrdinaryWatchdog(tile:NativeDiceNode,token:UInt64,generation:UInt64,
        timeouts:NativeSourceAppTimeoutOwner,current:@escaping()->Bool,
        lastMerge:@escaping()->Bool,finalAllowed:@escaping()->Bool,
        special:@escaping()->Bool,removeDestination:@escaping(NativeDiceNode)->Void)->NativeSourceAppTimeoutOwner.Receipt? {
        guard owns(tile,token:token),current(),owns(tile,token:token) else{return nil}
        return timeouts.schedule(sourceID:"source-six-destination-watchdog:\(token)",
            generation:generation,delayMilliseconds:1200,elapsed:{[weak self,weak tile] in
                guard let self,let tile,self.owns(tile,token:token),current(),self.owns(tile,token:token) else{return}
                let last=lastMerge()
                guard current(),self.owns(tile,token:token) else{return}
                if last {_=self.release(tile,token:token);return}
                let allowed=finalAllowed()
                guard current(),self.owns(tile,token:token) else{return}
                if allowed {_=self.release(tile,token:token);return}
                if tile.sourceValue != 6 {_=self.release(tile,token:token);return}
                let isSpecial=special()
                guard current(),self.owns(tile,token:token) else{return}
                if isSpecial {_=self.release(tile,token:token);return}
                guard self.release(tile,token:token),current() else{return}
                removeDestination(tile)
            })
    }
}
