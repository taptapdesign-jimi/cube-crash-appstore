import Foundation

/// Literal spawnLockedTilesWithPop: independent APP scale/rotG roots and
/// guarded APP80ms opacity repair. No face RAF or spawn-animation flag.
@MainActor final class NativeSourceLockedBonusPopOwner {
    struct Hooks {
        let current:()->Bool
        let locked:()->Bool
        let readRotation:()->Double
        let scale:(Double)->Void
        let rotation:(Double)->Void
        let repair:()->Void
        let acquire:()->(()->Void)?
        let finished:()->Void
    }
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        var advance:((Double)->Void)?
        func advanceSourceAnimation(seconds:Double){advance?(seconds)}
    }
    private let service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner
    private let generation:UInt64,delay:Double,direction:Double,hooks:Hooks
    private var scaleLease:NativeSourceAnimationClockService.Lease?,rotationLease:NativeSourceAnimationClockService.Lease?
    private var scaleParticipant:Participant?,rotationParticipant:Participant?
    private var repairReceipt:NativeSourceAppTimeoutOwner.Receipt?
    private var release:(()->Void)?,initialRotation:Double?
    private var started=false,closed=false,scaleDone=false,rotationDone=false
    init(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,
         delayMilliseconds:Int,direction:Int,hooks:Hooks){
        self.service=service;self.timeouts=timeouts;self.generation=generation
        delay=Double(delayMilliseconds)/1000;self.direction=Double(direction);self.hooks=hooks
    }
    var active:Bool{started && !closed}
    private func current()->Bool{guard !closed else{return false};let value=hooks.current();return value && !closed}
    @discardableResult func start()->Bool {
        guard !started,current(),delay>=0,abs(direction)==1,service.sourceFrameTransportAdmissionOpen else{return false}
        started=true;hooks.scale(0.30)
        guard current(),let frames=hooks.acquire() else{dispose();return false}
        guard current() else{frames();dispose();return false};release=frames
        let scale=Participant();scaleParticipant=scale
        scale.advance={[weak self] seconds in self?.paintScale(seconds)}
        scaleLease=service.register(participant:scale,duration:delay+0.48,domain:.sourceGSAP(.timeline),cleanup:{[weak self] success in self?.scaleFinished(success)})
        guard current(),scaleLease != nil else{dispose();return false}
        let rotation=Participant();rotationParticipant=rotation
        rotation.advance={[weak self] seconds in self?.paintRotation(seconds)}
        rotationLease=service.register(participant:rotation,duration:delay+0.36,domain:.sourceGSAP(.timeline),cleanup:{[weak self] success in
            guard let self,!self.closed else{return}
            self.rotationLease=nil;self.rotationParticipant?.advance=nil;self.rotationParticipant=nil
            if !success{self.dispose();return};self.rotationDone=true;self.finishIfReady()
        })
        guard current(),rotationLease != nil else{dispose();return false}
        return true
    }
    private func paintScale(_ seconds:Double){
        guard current() else{dispose();return};guard seconds>=delay else{return}
        hooks.scale(Self.scale(seconds-delay));if !current(){dispose()}
    }
    private func paintRotation(_ seconds:Double){
        guard current() else{dispose();return};guard seconds>=delay else{return}
        if initialRotation==nil{initialRotation=hooks.readRotation()}
        guard current(),let initialRotation,initialRotation.isFinite else{dispose();return}
        hooks.rotation(Self.rotation(seconds-delay,initial:initialRotation,direction:direction));if !current(){dispose()}
    }
    private func scaleFinished(_ success:Bool){
        guard !closed else{return};scaleLease=nil;scaleParticipant?.advance=nil;scaleParticipant=nil
        guard success,current() else{dispose();return};scaleDone=true
        if hooks.locked(),current(){
            hooks.repair()
            guard current() else{dispose();return}
            repairReceipt=timeouts.schedule(sourceID:"wild-locked-pop-alpha:"+UUID().uuidString,generation:generation,delayMilliseconds:80,elapsed:{[weak self] in
                guard let self else{return};self.repairReceipt=nil
                if self.current(),self.hooks.locked(),self.current(){self.hooks.repair()}
                self.finishIfReady()
            },cancelled:{[weak self] in self?.repairReceipt=nil})
        }
        finishIfReady()
    }
    private func finishIfReady(){if scaleDone && rotationDone && repairReceipt==nil{dispose()}}
    func dispose(){
        guard !closed else{return};closed=true
        let scale=scaleLease,rotation=rotationLease,repair=repairReceipt,frames=release
        scaleLease=nil;rotationLease=nil;repairReceipt=nil;release=nil
        scaleParticipant?.advance=nil;rotationParticipant?.advance=nil;scaleParticipant=nil;rotationParticipant=nil
        scale?.cancel();rotation?.cancel();if let repair{_=timeouts.cancel(repair)}
        frames?();hooks.finished()
    }
    isolated deinit{dispose()}
    private static func mix(_ a:Double,_ b:Double,_ t:Double)->Double{floor((a+(b-a)*t)*1_000_000+0.5)/1_000_000}
    private static func back(_ t:Double,_ overshoot:Double)->Double{let u=t-1;return 1+u*u*((overshoot+1)*u+overshoot)}
    static func scale(_ seconds:Double)->Double{
        let t=max(0,seconds)
        if t<0.16{return mix(0.30,1.08,back(t/0.16,2.1))}
        if t<0.26{let u=(t-0.16)/0.10;return mix(1.08,0.96,u<0.5 ? 4*u*u*u:1-pow(-2*u+2,3)/2)}
        if t<0.36{return mix(0.96,1.02,1-pow(1-(t-0.26)/0.10,3))}
        if t<0.48{return mix(1.02,1,back((t-0.36)/0.12,2))};return 1
    }
    static func rotation(_ seconds:Double,initial:Double,direction:Double)->Double{
        let t=max(0,seconds)
        if t<0.10{return mix(initial,0.035*direction,1-pow(1-t/0.10,3))}
        if t<0.22{return mix(0.035*direction,-0.021*direction,1-pow(1-(t-0.10)/0.12,3))}
        if t<0.36{return mix(-0.021*direction,0,1-pow(1-(t-0.22)/0.14,3))};return 0
    }
}
