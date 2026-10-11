import Foundation
import SpriteKit

/// Original independent wall40 monitor. An actual unlocked six may complete
/// the step even without another pointerdown; otherwise the captured pair must
/// have been interacted with and must no longer be a surviving Five/One pair.
@MainActor final class NativeSourceTutorialSecondStepMonitor {
    enum Phase:Equatable {case idle,polling,pointerExit,sheetExit,activationWait,finished,retired}
    private let timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,five:NativeDiceNode,one:NativeDiceNode,parent:SKNode
    private let current:()->Bool,hasUnlockedSix:()->Bool,nodeCurrent:(NativeDiceNode)->Bool
    private let pointerExit:(@escaping()->Void)->Bool,sheetExit:(@escaping()->Void)->Bool,activate:()->Bool
    private var timer:NativeSourceAppTimeoutOwner.Receipt?,deadline:UInt64=0,interacted=false
    private(set) var phase=Phase.idle
    var pendingTimer:Bool{timer != nil}
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,five:NativeDiceNode,one:NativeDiceNode,parent:SKNode,
        current:@escaping()->Bool,hasUnlockedSix:@escaping()->Bool,nodeCurrent:@escaping(NativeDiceNode)->Bool,
        pointerExit:@escaping(@escaping()->Void)->Bool,sheetExit:@escaping(@escaping()->Void)->Bool,activate:@escaping()->Bool) {
        guard generation>0,five !== one,service.sourceMicrotaskRAFBoundaryInstalled,
            let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,
            five.parent === parent,one.parent === parent,five.sourceContactNodeAlive,one.sourceContactNodeAlive,
            five.sourceGeneration==generation,one.sourceGeneration==generation,current() else{return nil}
        self.timeouts=timeouts;self.generation=generation;self.five=five;self.one=one;self.parent=parent
        self.current=current;self.hasUnlockedSix=hasUnlockedSix;self.nodeCurrent=nodeCurrent;self.pointerExit=pointerExit;self.sheetExit=sheetExit;self.activate=activate
    }
    private func admitted()->Bool{guard phase != .retired,phase != .finished else{return false};let valid=current();return valid && phase != .retired && phase != .finished}
    @discardableResult func start()->Bool {
        guard phase == .idle,admitted() else{return false};phase = .polling
        deadline=DispatchTime.now().uptimeNanoseconds+40_000_000;schedulePoll();return admitted() && timer != nil
    }
    private func bound(_ node:NativeDiceNode)->Bool{node.parent === parent && node.sourceContactNodeAlive && node.sourceGeneration==generation && nodeCurrent(node)}
    func pointerDown(_ node:NativeDiceNode){guard phase == .polling,admitted(),(node === five || node === one),bound(node) else{return};interacted=true}
    private func schedulePoll(){
        guard phase == .polling,admitted(),timer==nil else{return}
        timer=timeouts.schedule(sourceID:"tutorial-second-monitor40",generation:generation,delayMilliseconds:0,from:DispatchTime(uptimeNanoseconds:deadline),elapsed:{[weak self] in
            guard let self else{return};self.timer=nil
            guard self.admitted(),self.phase == .polling else{self.dispose();return}
            let now=DispatchTime.now().uptimeNanoseconds;self.deadline += 40_000_000
            if self.deadline<=now{self.deadline += ((now-self.deadline)/40_000_000+1)*40_000_000}
            let hasSix=self.hasUnlockedSix();guard self.admitted() else{self.dispose();return}
            let pairIntact=self.bound(self.five) && self.five.sourceValue==5 && self.bound(self.one) && self.one.sourceValue==1
            guard hasSix || (self.interacted && !pairIntact) else{self.schedulePoll();return}
            self.phase = .pointerExit
            guard self.pointerExit({[weak self] in
                guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.phase == .pointerExit else{return}
                self.phase = .sheetExit
                guard self.sheetExit({[weak self] in
                    guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.phase == .sheetExit else{return}
                    self.phase = .activationWait
                    self.timer=self.timeouts.schedule(sourceID:"tutorial-second-activate90",generation:self.generation,delayMilliseconds:90,elapsed:{[weak self] in
                        guard let self else{return};self.timer=nil
                        guard self.admitted(),self.phase == .activationWait else{self.dispose();return}
                        if self.activate(),self.phase != .retired{self.phase = .finished}else{self.dispose()}
                    })
                    if self.timer==nil{self.dispose()}
                }) else{self.dispose();return}
            }) else{self.dispose();return}
        })
    }
    func dispose(){guard phase != .retired else{return};phase = .retired;let old=timer;timer=nil;if let old{_=timeouts.cancel(old)}}
    isolated deinit{dispose()}
}

/// Original step-three polling ends before step-four activation. Sheet motion
/// and the drop predicate are genuine caller-owned completions, not deadlines.
@MainActor final class NativeSourceTutorialFourthStepMonitor {
    enum Phase:Equatable {case idle,polling,sheetDelay,sheetTransition,waitingForDrop,prepared,unprepared,retired}
    private let timeouts:NativeSourceAppTimeoutOwner,generation:UInt64
    private let current:()->Bool,findWild:()->NativeDiceNode?,nodeCurrent:(NativeDiceNode)->Bool,dropping:(NativeDiceNode)->Bool
    private let activate:(NativeDiceNode)->Bool,transitionSheet:(@escaping()->Void)->Bool,prepare:(NativeDiceNode)->Bool,wallNow:()->Double
    private var timer:NativeSourceAppTimeoutOwner.Receipt?,deadline:UInt64=0,waitStarted=0.0
    private var wild:NativeDiceNode?
    private(set) var phase=Phase.idle
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,
        current:@escaping()->Bool,findWild:@escaping()->NativeDiceNode?,nodeCurrent:@escaping(NativeDiceNode)->Bool,
        dropping:@escaping(NativeDiceNode)->Bool,activate:@escaping(NativeDiceNode)->Bool,
        transitionSheet:@escaping(@escaping()->Void)->Bool,prepare:@escaping(NativeDiceNode)->Bool,
        wallNow:@escaping()->Double={Date().timeIntervalSince1970*1000}) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,
            let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,current() else{return nil}
        self.timeouts=timeouts;self.generation=generation;self.current=current;self.findWild=findWild;self.nodeCurrent=nodeCurrent
        self.dropping=dropping;self.activate=activate;self.transitionSheet=transitionSheet;self.prepare=prepare;self.wallNow=wallNow
    }
    private func admitted()->Bool {guard phase != .retired else{return false};let ok=current();return ok && phase != .retired}
    @discardableResult func start()->Bool {
        guard phase == .idle,admitted() else{return false};phase = .polling
        deadline=DispatchTime.now().uptimeNanoseconds+120_000_000;schedulePoll();return admitted()
    }
    private func schedulePoll(){
        guard admitted(),phase == .polling else{return}
        timer=timeouts.schedule(sourceID:"tutorial-fourth-monitor120",generation:generation,delayMilliseconds:0,
            from:DispatchTime(uptimeNanoseconds:deadline),elapsed:{[weak self] in
                guard let self else{return};self.timer=nil
                guard self.admitted(),self.phase == .polling else{self.dispose();return}
                let candidate=self.findWild()
                guard self.admitted(),self.phase == .polling else{self.dispose();return}
                guard let candidate,self.nodeCurrent(candidate),self.dropping(candidate) else{
                    guard self.admitted(),self.phase == .polling else{self.dispose();return}
                    let now=DispatchTime.now().uptimeNanoseconds;self.deadline += 120_000_000
                    if self.deadline<=now{self.deadline += ((now-self.deadline)/120_000_000+1)*120_000_000}
                    self.schedulePoll();return
                }
                guard self.admitted(),self.phase == .polling else{self.dispose();return}
                self.wild=candidate;self.phase = .sheetDelay
                guard self.activate(candidate),self.admitted(),self.phase == .sheetDelay else{self.dispose();return}
                self.timer=self.timeouts.schedule(sourceID:"tutorial-fourth-sheet900",generation:self.generation,delayMilliseconds:900,elapsed:{[weak self] in
                    guard let self else{return};self.timer=nil
                    guard self.admitted(),self.phase == .sheetDelay else{self.dispose();return}
                    self.phase = .sheetTransition
                    guard self.transitionSheet({[weak self] in
                        guard let self,self.admitted(),self.phase == .sheetTransition else{return}
                        self.phase = .waitingForDrop;self.waitStarted=self.wallNow()
                        guard self.admitted(),self.phase == .waitingForDrop else{self.dispose();return}
                        self.waitForDrop()
                    }) else{self.dispose();return}
                })
            })
    }
    private func waitForDrop(){
        guard admitted(),phase == .waitingForDrop,let wild,nodeCurrent(wild) else{dispose();return}
        let stillDropping=dropping(wild),elapsed=wallNow()-waitStarted
        guard admitted(),phase == .waitingForDrop else{dispose();return}
        if stillDropping && elapsed<5000 {
            timer=timeouts.schedule(sourceID:"tutorial-fourth-drop80",generation:generation,delayMilliseconds:80,elapsed:{[weak self] in
                guard let self else{return};self.timer=nil;self.waitForDrop()
            });return
        }
        let prepared=prepare(wild)
        guard admitted(),phase == .waitingForDrop else{dispose();return}
        phase = prepared ? .prepared:.unprepared
    }
    func dispose(){guard phase != .retired else{return};phase = .retired;wild=nil;let old=timer;timer=nil;if let old{_=timeouts.cancel(old)}}
    isolated deinit{dispose()}
}

/// Literal makeTileWildStar scheduling: first setValue queues face A; the
/// separate outer RAF queues face B for the next frame, then starts the halo.
/// Callers capture the same Wild identity in all four closures.
@MainActor final class NativeSourceTutorialFourthWildFrames {
    private let service:NativeSourceAnimationClockService,generation:UInt64
    private let current:()->Bool,commitFields:()->Bool,paintFace:()->Bool,startHalo:()->Bool
    private var frames:[UUID:NativeSourceAnimationClockService.SourceFrameLease]=[:]
    private var disposed=false,started=false
    var pendingFrameCount:Int{frames.count}
    init?(service:NativeSourceAnimationClockService,generation:UInt64,current:@escaping()->Bool,
        commitFields:@escaping()->Bool,paintFace:@escaping()->Bool,startHalo:@escaping()->Bool) {
        guard generation>0,service.sourceFrameTransportAdmissionOpen,current() else{return nil}
        self.service=service;self.generation=generation;self.current=current
        self.commitFields=commitFields;self.paintFace=paintFace;self.startHalo=startHalo
    }
    private func admitted()->Bool {
        guard !disposed else{return false};let accepted=current();return accepted && !disposed
    }
    @discardableResult func start()->Bool {
        guard !started,admitted() else{return false};started=true
        guard commitFields(),admitted(),enqueueFace(),enqueue({[weak self] in
            guard let self,self.admitted(),self.enqueueFace(),self.admitted() else{return false}
            return self.startHalo() && self.admitted()
        }) else{dispose();return false}
        return admitted()
    }
    private func enqueueFace()->Bool {enqueue({[weak self] in
        guard let self,self.admitted() else{return false};return self.paintFace() && self.admitted()
    })}
    private func enqueue(_ action:@escaping()->Bool)->Bool {
        guard admitted() else{return false};let id=UUID()
        let lease=service.requestSourceAnimationFrame(ownerID:"tutorial-fourth-wild:\(id)",generation:generation,
            callback:{[weak self] in
                guard let self,self.frames.removeValue(forKey:id) != nil,self.admitted() else{return}
                if !action(){self.dispose()}
            },onCancelled:{[weak self] in self?.frames[id]=nil})
        guard let lease,admitted() else{lease?.cancel();return false}
        frames[id]=lease;return lease.active
    }
    func dispose(){guard !disposed else{return};disposed=true;let captured=Array(frames.values);frames.removeAll();captured.forEach{$0.cancel()}}
    isolated deinit{dispose()}
}

/// Source startFourthStepMonitor wall interval. Polling ends before the exit
/// callback; the callback owns real pointer/sheet/restoration completion.
@MainActor final class NativeSourceTutorialFourthCompletionMonitor {
    enum Phase:Equatable{case idle,polling,completing,retired}
    private let timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,current:()->Bool,isComplete:()->Bool,complete:()->Void
    private var timer:NativeSourceAppTimeoutOwner.Receipt?,deadline:UInt64=0
    private(set) var phase=Phase.idle
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,current:@escaping()->Bool,
        isComplete:@escaping()->Bool,complete:@escaping()->Void) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,current() else{return nil}
        self.timeouts=timeouts;self.generation=generation;self.current=current;self.isComplete=isComplete;self.complete=complete
    }
    private func admitted()->Bool{guard phase != .retired else{return false};let ok=current();return ok && phase != .retired}
    @discardableResult func start()->Bool {
        guard phase == .idle,admitted() else{return false};phase = .polling
        deadline=DispatchTime.now().uptimeNanoseconds+60_000_000;schedule();return admitted()
    }
    private func schedule() {
        guard admitted(),phase == .polling else{return}
        timer=timeouts.schedule(sourceID:"tutorial-fourth-completion60",generation:generation,delayMilliseconds:0,
            from:DispatchTime(uptimeNanoseconds:deadline),elapsed:{[weak self] in
                guard let self else{return};self.timer=nil
                guard self.admitted(),self.phase == .polling else{self.dispose();return}
                let done=self.isComplete()
                guard self.admitted(),self.phase == .polling else{self.dispose();return}
                if done {self.phase = .completing;self.complete();return}
                let now=DispatchTime.now().uptimeNanoseconds;self.deadline += 60_000_000
                if self.deadline<=now{self.deadline += ((now-self.deadline)/60_000_000+1)*60_000_000}
                self.schedule()
            })
    }
    func dispose(){guard phase != .retired else{return};phase = .retired;let old=timer;timer=nil;if let old{_=timeouts.cancel(old)}}
    isolated deinit{dispose()}
}
