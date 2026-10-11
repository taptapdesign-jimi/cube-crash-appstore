import Foundation

/// Literal primary/immediate cta-system.ts motion and capture policy, borrowing
/// the one APP GSAP runtime. Finite interruption settles the captured waiter;
/// only matching current-generation completions may change visible CTA state.
@MainActor final class NativeSourceTutorialCTAOwner {
    struct Pose:Equatable {let scale:Double,y:Double,alpha:Double}
    enum State:Equatable {case hidden,idle,entering,pressed,exiting,retired}
    @MainActor private final class Paint:NativeSourceAnimationParticipant {
        let update:(Double)->Void
        init(_ update:@escaping(Double)->Void){self.update=update}
        func advanceSourceAnimation(seconds:Double){update(seconds)}
    }
    private let service:NativeSourceAnimationClockService,current:()->Bool,paint:(Pose)->Void,contact:()->Void,activate:()->Void
    private var root:Paint?,lease:NativeSourceAnimationClockService.Lease?,epoch:UInt64=0,disposed=false,pressed=false,activating=false,soundStarted=false
    private(set) var state=State.hidden,pose=Pose(scale:0,y:18,alpha:0)
    var enabled:Bool{!disposed && state != .hidden && state != .exiting && state != .retired}
    init?(service:NativeSourceAnimationClockService,current:@escaping()->Bool,paint:@escaping(Pose)->Void,contact:@escaping()->Void,activate:@escaping()->Void) {
        guard service.sourceMicrotaskRAFBoundaryInstalled,current() else{return nil}
        self.service=service;self.current=current;self.paint=paint;self.contact=contact;self.activate=activate
    }
    private func admitted()->Bool{guard !disposed else{return false};let valid=current();return valid && !disposed}
    private func apply(_ value:Pose){pose=value;paint(value)}
    func prime(hidden:Bool){guard admitted() else{return};cancel();pressed=false;activating=false;soundStarted=false;state=hidden ? .hidden:.idle;apply(hidden ? Pose(scale:0,y:18,alpha:0):Pose(scale:1,y:0,alpha:1))}
    @discardableResult func enter()->Bool {
        guard admitted() else{return false};state = .entering
        return animate(to:Pose(scale:1,y:0,alpha:1),duration:0.34,ease:{Self.backOut($0,1.8)},completed:{[weak self] success in guard let self,success,self.admitted(),self.state == .entering else{return};self.state = .idle})
    }
    @discardableResult func exit(completed:@escaping(Bool)->Void)->Bool {
        guard admitted() else{return false};state = .exiting;pressed=false
        return animate(to:Pose(scale:0,y:18,alpha:0),duration:0.31,ease:{Self.backIn($0,1.75)},completed:{[weak self] success in
            guard let self else{return};if success,self.admitted(),self.state == .exiting{self.state = .hidden};completed(success)
        })
    }
    func pointerDown(){
        guard admitted(),enabled else{return};pressed=true;soundStarted=true;contact();guard admitted(),enabled else{return};state = .pressed
        _=animate(to:Pose(scale:0.84,y:4,alpha:pose.alpha),duration:0.12,ease:{1-pow(1-$0,3)},completed:{_ in})
    }
    func pointerUp(inside:Bool){guard admitted(),pressed else{return};pressed=false;if inside{activateImmediately()}else{soundStarted=false;release()}}
    func pointerCancel(){guard admitted(),pressed else{return};pressed=false;soundStarted=false;release()}
    /// Source keyboard activation calls immediate onActivate before a synthetic
    /// press; its synchronous exit prevents that press/release overwriting exit.
    func keyboardActivate(){guard admitted(),enabled else{return};activateImmediately()}
    private func activateImmediately(){
        guard admitted(),enabled,!activating else{return};activating=true
        if !soundStarted{contact();guard admitted(),enabled else{activating=false;return}}
        activate();guard admitted() else{return}
        if enabled{release()};activating=false;soundStarted=false
    }
    private func release(){guard admitted(),enabled else{return};state = .idle
        _=animate(to:Pose(scale:1,y:0,alpha:pose.alpha),duration:0.26,ease:{Self.backOut($0,2.1)},completed:{_ in})
    }
    private func cancel(){epoch &+= 1;let old=lease;lease=nil;root=nil;old?.cancel(success:false)}
    private func animate(to:Pose,duration:Double,ease:@escaping(Double)->Double,completed:@escaping(Bool)->Void)->Bool {
        cancel();guard admitted() else{return false};let captured=epoch;var from:Pose?
        let root=Paint{[weak self] seconds in
            guard let self,self.admitted(),self.epoch==captured else{return}
            if from==nil{from=self.pose};guard let from else{return};let t=ease(max(0,min(1,seconds/duration)))
            self.apply(Pose(scale:from.scale+(to.scale-from.scale)*t,y:from.y+(to.y-from.y)*t,alpha:from.alpha+(to.alpha-from.alpha)*t))
        }
        self.root=root
        let installed=service.register(participant:root,duration:duration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] success in
            if let self,self.epoch==captured{self.lease=nil;self.root=nil};completed(success)
        })
        guard let installed,admitted(),epoch==captured else{installed?.cancel(success:false);return false};lease=installed;return true
    }
    private static func backOut(_ value:Double,_ amount:Double)->Double{let t=value-1;return 1+(amount+1)*t*t*t+amount*t*t}
    private static func backIn(_ t:Double,_ amount:Double)->Double{(amount+1)*t*t*t-amount*t*t}
    func dispose(){guard !disposed else{return};disposed=true;state = .retired;cancel()}
    isolated deinit{dispose()}
}
