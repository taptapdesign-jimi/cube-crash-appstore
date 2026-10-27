import Foundation
import SpriteKit

/// Captured Source HUD dim/restore channels. The wall interval and finite APP
/// GSAP roots retain their distinct domains. Original-loader/control/unified
/// HUD roles have distinct Math, scale and interaction restoration recipes.
@MainActor final class NativeSourceTutorialHUDOwner {
    @MainActor private final class Target {
        let node:SKNode,originalAlpha:CGFloat,preservesAlpha:Bool,unified:Bool
        weak var parent:SKNode?
        private var interactions:[ObjectIdentifier:(SKNode,Bool)]=[:]
        init(_ node:SKNode,unified:Bool=false,originalAlpha:CGFloat?=nil){self.node=node;parent=node.parent;self.originalAlpha=originalAlpha ?? node.alpha;preservesAlpha=node.name=="wildLoader";self.unified=unified;captureInteractions(node)}
        private func captureInteractions(_ node:SKNode){let id=ObjectIdentifier(node);if interactions[id]==nil{interactions[id]=(node,node.isUserInteractionEnabled)};for child in node.children{captureInteractions(child)}}
        private func visit(_ node:SKNode,_ callback:(SKNode)->Void){callback(node);for child in node.children{visit(child,callback)}}
        func dimInteractions(){captureInteractions(node);visit(node){$0.isUserInteractionEnabled=false}}
        func restoreInteractions(){visit(node){node in if let original=interactions[ObjectIdentifier(node)]{node.isUserInteractionEnabled=original.1}}}
        var current:Bool{node.parent === parent && parent != nil}
    }
    @MainActor private final class Fade:NativeSourceAnimationParticipant {
        let update:(Double)->Void
        init(_ update:@escaping(Double)->Void){self.update=update}
        func advanceSourceAnimation(seconds:Double){update(seconds)}
    }
    private let service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,current:()->Bool
    private let rootEntryPending:()->Bool
    private let root:SKNode,rootOriginalAlpha:CGFloat,excluded:Set<ObjectIdentifier>
    private var targets:[Target]
    private weak var rootParent:SKNode?
    private var fades:[Fade]=[],leases:[NativeSourceAnimationClockService.Lease]=[]
    private var unifiedFades:[Fade]=[],unifiedLeases:[NativeSourceAnimationClockService.Lease]=[]
    private var timer:NativeSourceAppTimeoutOwner.Receipt?,deadline:UInt64=0,started=false,disposed=false
    private(set) var intervalDeliveries=0
    var pendingInterval:Bool{timer != nil}
    init?(root:SKNode,rootFinalAlpha:CGFloat?=nil,rootEntryPending:@escaping()->Bool={false},extraTargets:[SKNode]=[],unifiedTargets:[SKNode]=[],excludedTargets:[SKNode]=[],service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,
        generation:UInt64,current:@escaping()->Bool) {
        guard generation>0,root.parent != nil,service.sourceMicrotaskRAFBoundaryInstalled,
            let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,current() else{return nil}
        self.root=root;rootParent=root.parent;rootOriginalAlpha=rootFinalAlpha ?? root.alpha;self.rootEntryPending=rootEntryPending
        self.service=service;self.timeouts=timeouts;self.generation=generation;self.current=current
        excluded=Set(excludedTargets.map(ObjectIdentifier.init))
        var seen=Set<ObjectIdentifier>();targets=[]
        for node in root.children+extraTargets+unifiedTargets where !excluded.contains(ObjectIdentifier(node)) && seen.insert(ObjectIdentifier(node)).inserted {
            targets.append(Target(node,unified:unifiedTargets.contains(where:{$0 === node})))
        }
    }
    private func restoreRootAlpha(){if !rootEntryPending(),root.action(forKey:"hud-enter")==nil{root.alpha=rootOriginalAlpha}}
    private func admitted()->Bool{guard !disposed,root.parent === rootParent,rootParent != nil else{return false};let valid=current();return valid && !disposed}
    func owns(_ node:SKNode)->Bool{!disposed && targets.contains{$0.node === node && $0.current}}
    private func captureNewRootChildren(restoring:Bool=false){for node in root.children where !excluded.contains(ObjectIdentifier(node)) && !targets.contains(where:{$0.node === node}){targets.append(Target(node,originalAlpha:restoring ? 1:nil))}}
    @discardableResult func start()->Bool {
        guard !started,admitted() else{return false};started=true
        root.isHidden=false;restoreRootAlpha()
        for target in targets where target.current {
            target.dimInteractions()
            let to=target.preservesAlpha ? Double(target.originalAlpha):0.2
            guard fade(target,to:to,duration:0.42,delay:0,ease:{0.5-0.5*cos($0*Double.pi)}) else{dispose();return false}
        }
        deadline=DispatchTime.now().uptimeNanoseconds+120_000_000;scheduleInterval()
        return admitted()
    }
    private func scheduleInterval(){
        guard admitted(),timer==nil else{return}
        timer=timeouts.schedule(sourceID:"tutorial-hud-interval120",generation:generation,delayMilliseconds:0,
            from:DispatchTime(uptimeNanoseconds:deadline),elapsed:{[weak self] in
                guard let self else{return};self.timer=nil
                guard self.admitted() else{self.dispose();return}
                let now=DispatchTime.now().uptimeNanoseconds
                self.deadline += 120_000_000
                if self.deadline<=now{self.deadline += ((now-self.deadline)/120_000_000+1)*120_000_000}
                self.scheduleInterval();guard self.admitted() else{return}
                self.intervalDeliveries+=1;self.cancelFades(includingUnified:false)
                self.root.isHidden=false;self.restoreRootAlpha()
                self.captureNewRootChildren()
                for target in self.targets where target.current {
                    target.dimInteractions();target.node.alpha=target.preservesAlpha ? target.originalAlpha:0.2
                }
            })
    }
    /// stopHudDim(false) only stops polling. A true restore kills the captured
    /// alpha/scale roots and may interrupt an earlier animated restore safely.
    @discardableResult func stop(restore:Bool=true,animateRestore:Bool=false,continuous:Bool=false,stopPresentationWrites:Bool=false,random:()->Double,
        hudLocked:Bool,isLockedControl:(SKNode)->Bool,cleanupSmoke:()->Void)->Bool {
        guard started,admitted() else{return false}
        let old=timer;timer=nil;if let old{_=timeouts.cancel(old)}
        if stopPresentationWrites {cancelFades()}
        guard restore else{return admitted()}
        cleanupSmoke();guard admitted() else{return false}
        cancelFades();captureNewRootChildren(restoring:true);restoreRootAlpha();root.isHidden=false
        for target in targets where target.current {
            guard admitted() else{return false}
            if hudLocked && isLockedControl(target.node){target.node.alpha=0.2;target.dimInteractions();continue}
            target.restoreInteractions()
            guard animateRestore else{target.node.alpha=target.originalAlpha;continue}
            if target.unified {
                guard fade(target,to:Double(target.originalAlpha),duration:0.22,delay:0,ease:{sin($0*Double.pi/2)}) else{dispose();return false}
                continue
            }
            if !continuous {target.node.alpha=min(target.node.alpha.isFinite ? target.node.alpha:0.2,0.35)}
            let alphaDelay=target.preservesAlpha ? 0:random()*0.1
            guard admitted(),target.current,fade(target,to:Double(target.originalAlpha),duration:0.22,delay:alphaDelay,ease:{sin($0*Double.pi/2)}) else{dispose();return false}
            if !target.preservesAlpha {
                let x=target.node.xScale.isFinite ? Double(target.node.xScale):1,y=target.node.yScale.isFinite ? Double(target.node.yScale):1
                if !continuous {target.node.xScale=CGFloat(x*0.9);target.node.yScale=CGFloat(y*0.9)}
                let scaleDelay=random()*0.1
                guard admitted(),target.current,attach(target,duration:0.36,domain:.sourceGSAP(.timeline),delay:scaleDelay,update:{node,time in
                    let multiplier:Double
                    if time<=0.18{let t=max(0,min(1,time/0.18))-1;multiplier=(continuous ? 1:0.9)+(continuous ? 0.12:0.22)*(1+3.5*t*t*t+2.5*t*t)}
                    else{multiplier=1.12-0.12*sin(max(0,min(1,(time-0.18)/0.18))*Double.pi/2)}
                    node.xScale=CGFloat(x*multiplier);node.yScale=CGFloat(y*multiplier)
                }) else{dispose();return false}
            }
        }
        return admitted()
    }
    private func fade(_ target:Target,to:Double,duration:Double,delay:Double,ease:@escaping(Double)->Double)->Bool {
        var from:Double?
        return attach(target,duration:duration,domain:.sourceGSAP(.defaultLazyTween),delay:delay,update:{node,time in
            if from==nil{from=Double(node.alpha)}
            node.alpha=CGFloat(from!+(to-from!)*ease(max(0,min(1,time/duration))))
        })
    }
    private func attach(_ target:Target,duration:Double,domain:NativeSourceAnimationClockService.Domain,delay:Double,update:@escaping(SKNode,Double)->Void)->Bool {
        let fade=Fade{[weak self,weak target] seconds in
            guard let self else{return};guard self.admitted() else{self.dispose();return};guard let target,target.current else{return};update(target.node,seconds)
        }
        guard let lease=service.register(participant:fade,duration:duration,domain:domain,delay:delay,cleanup:{_ in}) else{return false}
        if target.unified{unifiedFades.append(fade);unifiedLeases.append(lease)}else{fades.append(fade);leases.append(lease)}
        return lease.active && admitted()
    }
    private func cancelFades(includingUnified:Bool=true){
        let old=leases;leases.removeAll();fades.removeAll();for lease in old{lease.cancel(success:false)}
        if includingUnified{let old=unifiedLeases;unifiedLeases.removeAll();unifiedFades.removeAll();for lease in old{lease.cancel(success:false)}}
    }
    /// True Scope disposal retains current paint; it never fabricates restore.
    func dispose(){guard !disposed else{return};disposed=true;let old=timer;timer=nil;if let old{_=timeouts.cancel(old)};cancelFades()}
    isolated deinit{dispose()}
}
