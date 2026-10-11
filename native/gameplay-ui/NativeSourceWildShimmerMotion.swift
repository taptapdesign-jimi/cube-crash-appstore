import Foundation

/// Literal fx.ts startWildShimmer envelope. Coordinates remain Source y-down;
/// the eventual renderer owns the single SpriteKit coordinate conversion.
struct NativeSourceWildShimmerMotion {
    struct Pose:Equatable {let alpha:Double,x:Double,y:Double}
    static let duration=2.56
    static func delay(random:Double)->Double {4+random*4}
    static func pose(seconds:Double,width:Double,height:Double)->Pose {
        let t=max(0,min(duration,seconds)),w=max(64,width),h=max(64,height)
        let alpha:Double
        if t<0.28 {alpha=0.3*(1-pow(1-t/0.28,3))}
        else if t<2.28 {alpha=0.3}
        else {alpha=0.3*(1-pow((t-2.28)/0.28,3))}
        let u=max(0,min(1,(t-0.28)/2))
        let eased=u<0.5 ? 4*u*u*u:1-pow(-2*u+2,3)/2
        return .init(alpha:alpha,x:w*(-0.8+1.6*eased),y:h*(-0.8+1.6*eased))
    }
}

/// One admitted die borrows the shared Source roots. There is at most one
/// delayed call and one finite sweep. No local link, timer, RNG, media or state.
/// This clock/paint owner is not yet a mounted artwork-mask renderer.
@MainActor final class NativeSourceWildShimmerClock {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    private struct Entry {let participant:Participant,lease:NativeSourceAnimationClockService.Lease}
    private let service:NativeSourceAnimationClockService,current:()->Bool,random:()->Double
    private let width:Double,height:Double,paint:(NativeSourceWildShimmerMotion.Pose)->Void
    private var delay:Entry?,sweep:Entry?,disposed=false,visible=true,epoch:UInt64=0
    var activeRootCount:Int {[delay?.lease.active==true,sweep?.lease.active==true].filter{$0}.count}
    init(service:NativeSourceAnimationClockService,width:Double,height:Double,
         current:@escaping()->Bool,random:@escaping()->Double,
         paint:@escaping(NativeSourceWildShimmerMotion.Pose)->Void){
        self.service=service;self.width=width;self.height=height
        self.current=current;self.random=random;self.paint=paint
    }
    @discardableResult func start()->Bool {
        guard !disposed,delay==nil,sweep==nil,width.isFinite,height.isFinite,live() else{return false}
        return schedule()
    }
    private func live()->Bool {
        guard !disposed else{return false}
        let accepted=current();return accepted && !disposed
    }
    private func schedule()->Bool {
        guard live(),delay==nil else{return false}
        let sample=random()
        guard sample.isFinite,(0..<1).contains(sample),live() else{dispose();return false}
        let captured=epoch,participant=Participant{_ in}
        guard let lease=service.register(participant:participant,duration:0,domain:.sourceGSAP(.eagerTween),
            delay:NativeSourceWildShimmerMotion.delay(random:sample),initiallySuspended:!visible,
            cleanup:{[weak self] success in
                guard let self,!self.disposed,self.epoch==captured else{return}
                self.delay=nil
                guard success,self.live() else{self.dispose();return}
                self.beginSweep()
            }) else{dispose();return false}
        delay = .init(participant:participant,lease:lease);return true
    }
    private func beginSweep(){
        guard live(),sweep==nil else{dispose();return}
        let captured=epoch
        let participant=Participant{[weak self] seconds in
            guard let self,self.epoch==captured,self.live() else{self?.dispose();return}
            self.paint(NativeSourceWildShimmerMotion.pose(seconds:seconds,width:self.width,height:self.height))
        }
        guard let lease=service.register(participant:participant,duration:NativeSourceWildShimmerMotion.duration,
            domain:.sourceGSAP(.timeline),initiallySuspended:!visible,cleanup:{[weak self] _ in
                guard let self,!self.disposed,self.epoch==captured else{return};self.sweep=nil
            }) else{dispose();return}
        sweep = .init(participant:participant,lease:lease)
        // Source resets the sprite synchronously and schedules the next delay
        // when the sweep begins, not after its final fade completes.
        paint(NativeSourceWildShimmerMotion.pose(seconds:0,width:width,height:height))
        guard live() else{dispose();return}
        _ = schedule()
    }
    func setVisible(_ value:Bool){
        guard !disposed,visible != value else{return};visible=value
        delay?.lease.setSuspended(!value);sweep?.lease.setSuspended(!value)
    }
    func dispose(){
        guard !disposed else{return};disposed=true;epoch &+= 1
        let captured=[delay,sweep].compactMap{$0};delay=nil;sweep=nil
        captured.forEach{$0.lease.cancel()}
    }
    isolated deinit{dispose()}
}
