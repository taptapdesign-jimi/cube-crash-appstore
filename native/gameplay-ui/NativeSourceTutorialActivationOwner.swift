import Foundation

/// Literal activateFirstPlayTutorialWhenReady: two separate APP RAF callbacks,
/// readiness RAF retries, then the existing real-wall1250 timeout. Failed
/// preparation restarts that same graph; no guessed animation completion.
@MainActor final class NativeSourceTutorialActivationOwner {
    enum Phase:Equatable {case idle,frames,waiting,prepared,retired}
    private let service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner
    private let generation:UInt64,current:()->Bool,ready:()->Bool,prepare:()->Bool,activated:()->Void
    private var frame:NativeSourceAnimationClockService.SourceFrameLease?
    private var timeout:NativeSourceAppTimeoutOwner.Receipt?
    private var epoch:UInt64=0
    private(set) var phase:Phase = .idle
    var pendingFrame:Bool{frame?.active==true}
    var pendingTimeout:Bool{timeout != nil}
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,
          current:@escaping()->Bool,ready:@escaping()->Bool,prepare:@escaping()->Bool,activated:@escaping()->Void) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,
            let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,current() else{return nil}
        self.service=service;self.timeouts=timeouts;self.generation=generation
        self.current=current;self.ready=ready;self.prepare=prepare;self.activated=activated
    }
    private func admitted(_ capture:UInt64)->Bool {
        guard phase != .retired,epoch==capture else{return false}
        let valid=current();return valid && phase != .retired && epoch==capture
    }
    @discardableResult func start()->Bool {
        guard phase == .idle else{return false};epoch &+= 1;let capture=epoch
        guard admitted(capture) else{dispose();return false}
        phase = .frames
        return enqueue(capture){[weak self] in
            guard let self,self.admitted(capture) else{return}
            if !self.enqueue(capture,{[weak self] in self?.tick(capture)}){self.dispose()}
        }
    }
    private func enqueue(_ capture:UInt64,_ callback:@escaping()->Void)->Bool {
        guard admitted(capture),frame==nil else{return false}
        let lease=service.requestSourceAnimationFrame(ownerID:"tutorial-activation:\(generation):\(capture)",generation:generation,callback:{[weak self] in
            guard let self,self.admitted(capture) else{return};self.frame=nil;callback()
        },onCancelled:{[weak self] in guard let self,self.epoch==capture else{return};self.frame=nil})
        guard let lease,admitted(capture),phase == .frames else{lease?.cancel();return false}
        frame=lease;return lease.active
    }
    private func tick(_ capture:UInt64) {
        guard admitted(capture) else{dispose();return}
        let isReady=ready();guard admitted(capture) else{return}
        if !isReady {if !enqueue(capture,{[weak self] in self?.tick(capture)}){dispose()};return}
        phase = .waiting
        let receipt=timeouts.schedule(sourceID:"tutorial-activation1250:\(generation):\(capture)",generation:generation,delayMilliseconds:1250,elapsed:{[weak self] in
            guard let self,self.admitted(capture),self.phase == .waiting else{return};self.timeout=nil
            let prepared=self.prepare();guard self.admitted(capture) else{return}
            if prepared {self.phase = .prepared;self.activated()}
            else {self.phase = .idle;if !self.start(){self.dispose()}}
        })
        guard admitted(capture),phase == .waiting else{_=timeouts.cancel(receipt);return};timeout=receipt
    }
    func dispose() {
        guard phase != .retired else{return};phase = .retired;epoch &+= 1
        let oldFrame=frame,oldTimeout=timeout;frame=nil;timeout=nil
        oldFrame?.cancel();if let oldTimeout{_=timeouts.cancel(oldTimeout)}
    }
    isolated deinit{dispose()}
}
