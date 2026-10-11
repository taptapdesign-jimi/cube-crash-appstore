import Foundation
import SpriteKit

/// Literal common sweetPopIn for fresh regular and captured restored Wild: one captured parent timeline, separate
/// Source delayedCalls, real app wall watchdog, actual completion provenance.
/// Every clock/Math/cadence/audio resource is borrowed from the APP/caller.
@MainActor final class NativeSourceBoardEntryOwner:NativeSourceAnimationParticipant {
    struct Capture {
        let node:NativeDiceNode,parent:SKNode,generation:UInt64
        let sourcePosition:CGPoint,nativePosition:CGPoint,sourceRotation:Double,geometryScale:Double
        let locked:Bool,value:Int,kind:String,variant:String?
        init(node:NativeDiceNode,parent:SKNode,generation:UInt64,sourcePosition:CGPoint,
            nativePosition:CGPoint,sourceRotation:Double,geometryScale:Double,locked:Bool,value:Int){
            self.node=node;self.parent=parent;self.generation=generation
            self.sourcePosition=sourcePosition;self.nativePosition=nativePosition
            self.sourceRotation=sourceRotation;self.geometryScale=geometryScale
            self.locked=locked;self.value=value;kind=node.kind;variant=node.variant
        }
    }
    struct Completion:Equatable {enum Outcome:Equatable{case normal,forced,aborted,retired};let id:UUID,generation:UInt64,outcome:Outcome}
    enum Phase:Equatable {case idle,running,finished}
    @MainActor private final class Call:NativeSourceAnimationParticipant {func advanceSourceAnimation(seconds:Double){};var lease:NativeSourceAnimationClockService.Lease?}
    let id=UUID(),generation:UInt64
    private let service:NativeSourceAnimationClockService,captures:[Capture],random:()->Double?,current:()->Bool
    private let acquireFrames:()->(()->Void)?,sound:(Double)->(()->Void)?,half:()->Void,haptic:()->Void,syncZ:(NativeDiceNode,Bool)->Void,drawBG:()->Void,finished:(Completion)->Void
    private let timeouts:NativeSourceAppTimeoutOwner
    private var parentLease:NativeSourceAnimationClockService.Lease?,calls:[UUID:Call]=[:],watchdog:NativeSourceAppTimeoutOwner.Receipt?
    private var releaseFrames:(()->Void)?,stopSound:(()->Void)?,plans:[NativeSourceBoardEntryPlan]=[],completed=Set<Int>(),halfFired=false
    private(set) var phase:Phase = .idle
    var pendingCallCount:Int{calls.count}
    var parentDuration:Double{plans.map(\.end).max() ?? 0}
    init?(service:NativeSourceAnimationClockService,captures:[Capture],generation:UInt64,
        timeouts:NativeSourceAppTimeoutOwner,random:@escaping()->Double?,current:@escaping()->Bool,
        acquireFrames:@escaping()->(()->Void)?,sound:@escaping(Double)->(()->Void)?,
        half:@escaping()->Void,haptic:@escaping()->Void,syncZ:@escaping(NativeDiceNode,Bool)->Void,
        drawBG:@escaping()->Void,finished:@escaping(Completion)->Void) {
        guard service.sourceFrameTransportAdmissionOpen,captures.allSatisfy({$0.node.sourceContactNodeAlive && $0.node.sourceGeneration==generation && $0.generation==generation && $0.node.parent === $0.parent && $0.node.sourceOuterDriven && $0.node.sourceBoardEntryIdentityAdmitted && $0.node.kind==$0.kind && $0.node.variant==$0.variant && !$0.node.sourceResidualWildPresence && $0.node.locked==$0.locked && $0.node.value==$0.value && $0.geometryScale>0}),current(),captures.allSatisfy({$0.node.sourceContactNodeAlive && $0.node.sourceGeneration==generation && $0.node.parent === $0.parent && $0.node.sourceBoardEntryIdentityAdmitted && $0.node.kind==$0.kind && $0.node.variant==$0.variant}) else{return nil}
        self.service=service;self.captures=captures;self.generation=generation;self.timeouts=timeouts;self.random=random;self.current=current;self.acquireFrames=acquireFrames;self.sound=sound;self.half=half;self.haptic=haptic;self.syncZ=syncZ;self.drawBG=drawBG;self.finished=finished
    }
    private func admitted()->Bool {guard phase != .finished else{return false};let value=current();return value && phase != .finished}
    private func bound(_ capture:Capture)->Bool {capture.node.sourceContactNodeAlive && capture.node.sourceGeneration==capture.generation && capture.node.parent === capture.parent && capture.node.sourceBoardEntryBinding==id && capture.node.sourceBoardEntryIdentityAdmitted && capture.node.kind==capture.kind && capture.node.variant==capture.variant}
    @discardableResult func start(groupedHaptics:Bool)->Bool {
        guard phase == .idle,admitted(),phase == .idle else{return false};phase = .running
        let next:()->Double? = {[weak self] in guard let self,self.phase == .running,self.admitted() else{return nil};let value=self.random();return self.phase == .running && self.admitted() ? value:nil}
        guard let plans=NativeSourceBoardEntryPlan.make(positions:captures.map(\.sourcePosition),maxOffset:128*0.42,random:next),phase == .running,admitted() else{retire();return false};self.plans=plans
        let release=acquireFrames();guard phase == .running,admitted(),let release else{release?();retire();return false};releaseFrames=release
        guard !plans.isEmpty else{finish(.normal);return true}
        if groupedHaptics {for delay in NativeSourceBoardEntryPlan.haptics(plans){guard delayed(delay,{[weak self] in guard let self,self.phase == .running,self.admitted() else{return};self.haptic()}) else{retire();return false}}}
        for plan in plans {
            let capture=captures[plan.tileIndex]
            guard admitted(),capture.node.beginSourceBoardEntryPaint(id:id),phase == .running,admitted(),bound(capture) else{retire();return false}
            paint(plan,seconds:0);guard phase == .running,admitted(),bound(capture) else{retire();return false}
            syncZ(capture.node,true);guard phase == .running,admitted(),bound(capture) else{retire();return false}
        }
        let lease=service.register(participant:self,duration:parentDuration,domain:.sourceGSAP(.timeline),cleanup:{[weak self] success in
            guard let self,self.phase == .running else{return};self.parentLease=nil
            if success {if !self.delayed(0.03,{[weak self] in self?.finish(.normal)}){self.retire()}}
            else {self.retire()}
        })
        guard let lease,phase == .running,admitted() else{lease?.cancel(success:false);retire();return false};parentLease=lease
        let stop=sound(parentDuration+0.03);guard phase == .running,admitted(),let stop else{stop?();retire();return false};stopSound=stop
        guard delayed(max(0.01,parentDuration*0.5),{[weak self] in self?.fireHalf()}) else{retire();return false}
        let timeout=timeouts.schedule(sourceID:"board-entry:\(id)",generation:generation,delayMilliseconds:Int(ceil(max(1200,(parentDuration+0.65)*1000))),elapsed:{[weak self] in self?.watchdog=nil;self?.finish(.forced)})
        guard phase == .running,admitted() else{_=timeouts.cancel(timeout);retire();return false};watchdog=timeout;return true
    }
    private func delayed(_ delay:Double,_ callback:@escaping()->Void)->Bool {
        guard phase == .running,admitted() else{return false};let key=UUID(),call=Call();calls[key]=call
        let lease=service.register(participant:call,duration:0,domain:.sourceGSAP(.eagerTween),delay:delay,cleanup:{[weak self,weak call] success in
            guard let self,let call,self.calls[key] === call else{return};self.calls[key]=nil
            if success,self.phase == .running,self.admitted(){callback()}
        })
        guard let lease,phase == .running,admitted(),calls[key] === call else{lease?.cancel(success:false);if calls[key] === call{calls[key]=nil};return false};call.lease=lease;return lease.active
    }
    private func paint(_ plan:NativeSourceBoardEntryPlan,seconds:Double) {
        let capture=captures[plan.tileIndex];guard bound(capture),phase == .running else{return}
        let pose=NativeSourceBoardEntryPose.sample(plan,rest:capture.sourcePosition,rotation:capture.sourceRotation,locked:capture.locked,value:capture.value,seconds:seconds)
        capture.node.paintSourceBoardEntry(id:id,position:CGPoint(x:capture.nativePosition.x+(pose.x-capture.sourcePosition.x)*capture.geometryScale,y:capture.nativePosition.y-(pose.y-capture.sourcePosition.y)*capture.geometryScale),rotation:-pose.rotation,scale:pose.scale,alpha:pose.alpha)
    }
    func advanceSourceAnimation(seconds:Double) {
        guard phase == .running,admitted() else{return}
        for plan in plans {
            guard phase == .running,admitted() else{return};let capture=captures[plan.tileIndex]
            if bound(capture){paint(plan,seconds:seconds)} // Never paint a retired physical object.
            if seconds>=plan.end,!completed.contains(plan.tileIndex) {
                completed.insert(plan.tileIndex)
                if bound(capture) {capture.node.paintSourceBoardEntryRest(id:id,position:capture.nativePosition,rotation:-capture.sourceRotation);syncZ(capture.node,false)}
                guard phase == .running,admitted() else{return}
                if completed.count>=Int(ceil(Double(captures.count)/2)){fireHalf()}
            }
        }
    }
    private func fireHalf(){guard phase == .running,!halfFired,admitted() else{return};halfFired=true;half()}
    func abort(){finish(.aborted)}
    func retire(){finish(.retired)}
    private func finish(_ outcome:Completion.Outcome) {
        guard phase != .finished else{return};let wasRunning=phase == .running;phase = .finished
        let parent=parentLease,oldCalls=Array(calls.values),timer=watchdog,stop=stopSound,release=releaseFrames
        parentLease=nil;calls.removeAll();watchdog=nil;stopSound=nil;releaseFrames=nil
        if let timer{_=timeouts.cancel(timer)};parent?.cancel(success:false);for call in oldCalls{call.lease?.cancel(success:false)}
        for capture in captures {
            if bound(capture) && (outcome == .forced || outcome == .aborted) {
                let allowed=current()
                if allowed,bound(capture){capture.node.settleSourceBoardEntry(id:id,position:capture.nativePosition,rotation:-capture.sourceRotation);if bound(capture){syncZ(capture.node,false)}}
            }
            capture.node.endSourceBoardEntryPaint(id:id)
        }
        if (outcome == .normal || outcome == .forced),current(){drawBG()}
        stop?();release?()
        if wasRunning {finished(.init(id:id,generation:generation,outcome:outcome))}
    }
    func dispose(){retire()}
    isolated deinit{dispose()}
}
