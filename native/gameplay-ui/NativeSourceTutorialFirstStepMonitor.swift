import Foundation
import SpriteKit

/// The Source wall120 observer captures the original Three/Two objects in
/// their original order. Detection follows a real tutorial pointerdown and
/// actual surviving-node value. Pointer/sheet completions and wall90 are
/// separate boundaries, never a guessed total duration.
@MainActor final class NativeSourceTutorialFirstStepMonitor {
    enum Phase:Equatable {case idle,polling,pointerExit,sheetExit,activationWait,finished,retired}
    private let timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,targets:[NativeDiceNode],parent:SKNode
    private let current:()->Bool,targetCurrent:(NativeDiceNode)->Bool
    private let pointerExit:(@escaping()->Void)->Bool,sheetExit:(@escaping()->Void)->Bool,activate:(NativeDiceNode)->Bool
    private let presentAfterExit:((NativeDiceNode)->Bool)?
    private let readyToExit:(NativeDiceNode)->Bool
    private var timer:NativeSourceAppTimeoutOwner.Receipt?,deadline:UInt64=0,interacted=false
    private(set) var phase=Phase.idle
    private(set) var matchedID:String?
    var pendingTimer:Bool{timer != nil}
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,
          targets:[NativeDiceNode],parent:SKNode,current:@escaping()->Bool,targetCurrent:@escaping(NativeDiceNode)->Bool,
          pointerExit:@escaping(@escaping()->Void)->Bool,sheetExit:@escaping(@escaping()->Void)->Bool,activate:@escaping(NativeDiceNode)->Bool,
          readyToExit:@escaping(NativeDiceNode)->Bool={_ in true},presentAfterExit:((NativeDiceNode)->Bool)?=nil) {
        guard generation>0,targets.count==2,targets[0] !== targets[1],service.sourceMicrotaskRAFBoundaryInstalled,
            let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,
            targets.allSatisfy({$0.parent === parent && $0.sourceContactNodeAlive && $0.sourceGeneration==generation}),current() else{return nil}
        self.timeouts=timeouts;self.generation=generation;self.targets=targets;self.parent=parent
        self.current=current;self.targetCurrent=targetCurrent;self.pointerExit=pointerExit;self.sheetExit=sheetExit;self.activate=activate
        self.presentAfterExit=presentAfterExit;self.readyToExit=readyToExit
    }
    private func admitted()->Bool{guard phase != .retired,phase != .finished else{return false};let valid=current();return valid && phase != .retired && phase != .finished}
    @discardableResult func start()->Bool {
        guard phase == .idle,admitted() else{return false};phase = .polling
        deadline=DispatchTime.now().uptimeNanoseconds+120_000_000;schedulePoll();return admitted() && timer != nil
    }
    func pointerDown(_ node:NativeDiceNode){guard phase == .polling,admitted(),targets.contains(where:{$0 === node}),bound(node) else{return};interacted=true}
    private func bound(_ node:NativeDiceNode)->Bool{node.parent === parent && node.sourceContactNodeAlive && node.sourceGeneration==generation && targetCurrent(node)}
    private func schedulePoll(){
        guard phase == .polling,admitted(),timer==nil else{return}
        timer=timeouts.schedule(sourceID:"tutorial-first-monitor120",generation:generation,delayMilliseconds:0,from:DispatchTime(uptimeNanoseconds:deadline),elapsed:{[weak self] in
            guard let self else{return};self.timer=nil
            guard self.admitted(),self.phase == .polling else{self.dispose();return}
            let now=DispatchTime.now().uptimeNanoseconds;self.deadline += 120_000_000
            if self.deadline<=now{self.deadline += ((now-self.deadline)/120_000_000+1)*120_000_000}
            guard self.interacted,let merged=self.targets.first(where:{self.bound($0) && $0.sourceValue==5}) else{self.schedulePoll();return}
            guard (self.presentAfterExit != nil || self.readyToExit(merged)),self.admitted() else{self.schedulePoll();return}
            self.matchedID=merged.tileID;self.phase = .pointerExit
            guard self.pointerExit({[weak self,weak merged] in
                guard let self,let merged,self.admitted(),self.phase == .pointerExit,self.bound(merged),merged.sourceValue==5 else{return}
                self.phase = .sheetExit
                guard self.sheetExit({[weak self,weak merged] in
                    guard let self,let merged,self.admitted(),self.phase == .sheetExit,self.bound(merged),merged.sourceValue==5 else{return}
                    self.phase = .activationWait
                    if let present=self.presentAfterExit {
                        guard present(merged),self.admitted() else{self.dispose();return}
                        self.activateWhenReady(merged);return
                    }
                    self.timer=self.timeouts.schedule(sourceID:"tutorial-first-activate90",generation:self.generation,delayMilliseconds:90,elapsed:{[weak self,weak merged] in
                        guard let self else{return};self.timer=nil
                        guard let merged,self.admitted(),self.phase == .activationWait,self.bound(merged),merged.sourceValue==5 else{self.dispose();return}
                        if self.activate(merged),self.phase != .retired{self.phase = .finished}
                        else if self.admitted(){self.phase = .polling;self.schedulePoll()}
                        else{self.dispose()}
                    })
                    if self.timer==nil{self.dispose()}
                }) else{self.dispose();return}
            }) else{self.dispose();return}
        })
    }
    // Native paper can already be entering; the canonical preparation barrier
    // stays owned until readiness succeeds. Reuse this monitor's single timeout.
    private func activateWhenReady(_ merged:NativeDiceNode) {
        guard admitted(),phase == .activationWait,bound(merged),merged.sourceValue==5 else{dispose();return}
        if readyToExit(merged),admitted(),activate(merged) {
            if phase != .retired{phase = .finished};return
        }
        guard admitted(),phase == .activationWait else{return}
        timer=timeouts.schedule(sourceID:"tutorial-first-preparation120",generation:generation,delayMilliseconds:120,elapsed:{[weak self,weak merged] in
            guard let self else{return};self.timer=nil
            guard let merged else{self.dispose();return};self.activateWhenReady(merged)
        })
        if timer==nil{dispose()}
    }
    func dispose(){guard phase != .retired else{return};phase = .retired;let old=timer;timer=nil;if let old{_=timeouts.cancel(old)}}
    isolated deinit{dispose()}
}
