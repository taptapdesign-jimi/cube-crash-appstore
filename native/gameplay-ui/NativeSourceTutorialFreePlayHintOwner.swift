import Foundation
import CoreGraphics

/// A visible, captured Source step-three timeline. Uses the existing APP
/// transport/FIFO and cancels its exact repeating root on hide/replacement.
@MainActor final class NativeSourceTutorialFreePlayHintOwner:NativeSourceAnimationParticipant {
    private let service:NativeSourceAnimationClockService,plan:NativeSourceTutorialFreePlayPlan,current:()->Bool
    private let fingertip:CGPoint,paint:(NativeSourceTutorialFreePlayPlan.Pose)->Void
    private var lease:NativeSourceAnimationClockService.Lease?,disposed=false,started=false
    var active:Bool{!disposed && lease?.active==true}
    init?(service:NativeSourceAnimationClockService,plan:NativeSourceTutorialFreePlayPlan,fingertip:CGPoint,current:@escaping()->Bool,paint:@escaping(NativeSourceTutorialFreePlayPlan.Pose)->Void) {
        guard service.sourceMicrotaskRAFBoundaryInstalled,(1...4).contains(plan.moves.count),current() else{return nil}
        self.service=service;self.plan=plan;self.fingertip=fingertip;self.current=current;self.paint=paint
    }
    @discardableResult func start()->Bool {
        guard !disposed,!started,current() else{return false};started=true
        let installed=service.registerTutorialFreePlayHint(participant:self,moves:plan.moves.count,cleanup:{[weak self] _ in self?.lease=nil})
        guard !disposed,current(),!disposed,let installed else{installed?.cancel(success:false);return false}
        lease=installed;return active
    }
    func advanceSourceAnimation(seconds:Double) {
        guard !disposed,current(),!disposed else{dispose();return}
        if let pose=plan.pose(seconds:seconds,fingertip:fingertip){paint(pose)}
    }
    func dispose(){guard !disposed else{return};disposed=true;let old=lease;lease=nil;old?.cancel(success:false)}
    isolated deinit{dispose()}
}

/// Original finite step-four timeline plus real wall180 repeat/wall420 retry.
@MainActor final class NativeSourceTutorialFourthPointerOwner:NativeSourceAnimationParticipant {
    private let service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64
    private let current:()->Bool,select:()->NativeSourceTutorialFourthPointerPlan?,fingertip:CGPoint
    private let paint:(NativeSourceTutorialFreePlayPlan.Pose)->Void
    private var lease:NativeSourceAnimationClockService.Lease?,timer:NativeSourceAppTimeoutOwner.Receipt?
    private var plan:NativeSourceTutorialFourthPointerPlan?,disposed=false,started=false,epoch:UInt64=0
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,current:@escaping()->Bool,
        select:@escaping()->NativeSourceTutorialFourthPointerPlan?,fingertip:CGPoint,paint:@escaping(NativeSourceTutorialFreePlayPlan.Pose)->Void) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,current() else{return nil}
        self.service=service;self.timeouts=timeouts;self.generation=generation;self.current=current;self.select=select;self.fingertip=fingertip;self.paint=paint
    }
    private func admitted()->Bool{guard !disposed else{return false};let ok=current();return ok && !disposed}
    @discardableResult func start()->Bool{guard !started,admitted() else{return false};started=true;return playOne()}
    private func playOne()->Bool {
        guard admitted() else{return false};epoch &+= 1;let captured=epoch
        let selected=select()
        guard admitted(),epoch==captured else{return false}
        guard let selected else{return schedule(420)}
        plan=selected
        // Original timeline .set is lazy: no shell pose is published until
        // actual APP delivery. Preserve the previous painted pose beforehand.
        guard admitted(),epoch==captured else{return false}
        let installed=service.register(participant:self,duration:NativeSourceTutorialFourthPointerPlan.duration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] success in
            guard let self,self.epoch==captured else{return};self.lease=nil
            if success,self.admitted(){_=self.schedule(180)}
        })
        guard let installed,admitted(),epoch==captured else{installed?.cancel(success:false);return false}
        lease=installed;return installed.active
    }
    private func schedule(_ delay:Int)->Bool {
        guard admitted() else{return false};let captured=epoch
        timer=timeouts.schedule(sourceID:"tutorial-fourth-pointer\(Int(delay))",generation:generation,delayMilliseconds:delay,elapsed:{[weak self] in
            guard let self,self.epoch==captured else{return};self.timer=nil
            guard self.admitted() else{self.dispose();return}
            if !self.playOne(){self.dispose()}
        });return timer != nil
    }
    func advanceSourceAnimation(seconds:Double){guard admitted() else{dispose();return};if let pose=plan?.pose(seconds:seconds,fingertip:fingertip){paint(pose)}}
    func dispose(){guard !disposed else{return};disposed=true;epoch &+= 1;plan=nil;let old=lease;lease=nil;let timeout=timer;timer=nil;old?.cancel(success:false);if let timeout{_=timeouts.cancel(timeout)}}
    isolated deinit{dispose()}
}
