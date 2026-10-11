import Foundation
import SpriteKit

/// Actual fresh-demo focus roots use the one APP GSAP transport. Each captured
/// target owns only alpha; repeated focus kills the prior exact alpha root.
/// No Source input/idle cadence lease is fabricated by these roots.
@MainActor final class NativeSourceTutorialFocusOwner {
    @MainActor private final class Entry:NativeSourceAnimationParticipant {
        let id:UUID
        weak var node:NativeDiceNode?
        let generation:UInt64,parent:SKNode,plan:NativeSourceTutorialFocusPlan,current:()->Bool
        var from:Double?,lease:NativeSourceAnimationClockService.Lease?
        init(id:UUID,node:NativeDiceNode,generation:UInt64,parent:SKNode,duration:Double,to:Double,current:@escaping()->Bool){self.id=id;self.node=node;self.generation=generation;self.parent=parent;self.plan = .init(duration:duration,delay:0,target:to);self.current=current}
        func advanceSourceAnimation(seconds:Double) {
            guard let node,node.sourceContactNodeAlive,node.sourceGeneration==generation,node.parent === parent else{return}
            let allowed=current()
            guard allowed,self.node === node,node.sourceContactNodeAlive,node.sourceGeneration==generation,node.parent === parent else{return}
            // For this initial focus-only channel, no sibling participant writes
            // alpha between Source lazy init and flush (entry already settled;
            // previous same-target focus root killed). Capture at real delivery.
            if from==nil {from=Double(node.alpha)}
            node.alpha=CGFloat(plan.alpha(from:from!,seconds:seconds))
        }
    }
    private let service:NativeSourceAnimationClockService,random:()->Double,current:()->Bool
    private var disposed=false,entries:[String:Entry]=[:],sequence:UInt64=0,epochs:[String:UInt64]=[:]
    var activeRootCount:Int{entries.count}
    init(service:NativeSourceAnimationClockService,random:@escaping()->Double,current:@escaping()->Bool){self.service=service;self.random=random;self.current=current}
    @discardableResult func focus(_ node:NativeDiceNode,focused:Bool)->Bool {
        guard !disposed,node.sourceContactNodeAlive,let parent=node.parent else{return false}
        sequence &+= 1;let epoch=sequence,generation=node.sourceGeneration,id=UUID()
        epochs[node.tileID]=epoch
        func bound()->Bool{!disposed && epochs[node.tileID]==epoch && node.sourceContactNodeAlive && node.sourceGeneration==generation && node.parent === parent}
        guard bound(),current(),bound() else{return false}
        // normalizeTutorialTileVisual precedes both branches and Math draws.
        let old=entries.removeValue(forKey:node.tileID);old?.lease?.cancel(success:false)
        guard bound(),node.normalizeSourceTutorialInitialTile(),bound(),current(),bound(),
            node.setSourceTutorialInitialFocus(focused),bound() else{return false}
        let duration=focused ? 0.22:0.42+random()*0.22
        guard bound(),current(),bound() else{return false}
        let delay=focused ? 0:random()*0.28
        guard bound(),current(),bound() else{return false}
        let entry=Entry(id:id,node:node,generation:generation,parent:parent,duration:duration,to:focused ? 1:0.2,current:{[weak self,weak node] in
            guard let self,let node,!self.disposed,self.epochs[node.tileID]==epoch,self.entries[node.tileID]?.id==id else{return false}
            let admitted=self.current()
            return admitted && !self.disposed && self.epochs[node.tileID]==epoch && self.entries[node.tileID]?.id==id && node.sourceContactNodeAlive && node.sourceGeneration==generation && node.parent === parent
        })
        entries[node.tileID]=entry
        let lease=service.register(participant:entry,duration:duration,domain:.sourceGSAP(.defaultLazyTween),delay:delay,cleanup:{[weak self,weak entry] _ in
            guard let self,let entry,self.entries[node.tileID] === entry else{return};self.entries[node.tileID]=nil
        })
        guard let lease,bound(),entries[node.tileID] === entry else{lease?.cancel(success:false);if entries[node.tileID] === entry{entries[node.tileID]=nil};return false}
        entry.lease=lease;return lease.active
    }
    /// Fourth step has no normalize or random timing: allowed targets are
    /// immediately visible; every other living object owns alpha .28 sine.
    @discardableResult func focusFourth(_ node:NativeDiceNode,focused:Bool)->Bool {
        guard !disposed,node.sourceContactNodeAlive,let parent=node.parent else{return false}
        sequence &+= 1;let epoch=sequence,generation=node.sourceGeneration,id=UUID()
        epochs[node.tileID]=epoch
        let old=entries.removeValue(forKey:node.tileID);old?.lease?.cancel(success:false)
        func bound()->Bool{!disposed && epochs[node.tileID]==epoch && node.sourceContactNodeAlive && node.sourceGeneration==generation && node.parent === parent}
        guard bound(),current(),bound() else{return false}
        node.sourceEventMode=focused ? "static":"none"
        if focused {node.isHidden=false;node.alpha=1;return true}
        let target=(node.sourceLocked ? 0.2:1)*0.35
        let entry=Entry(id:id,node:node,generation:generation,parent:parent,duration:0.28,to:target,current:{[weak self,weak node] in
            guard let self,let node,!self.disposed,self.epochs[node.tileID]==epoch,self.entries[node.tileID]?.id==id else{return false}
            let accepted=self.current()
            return accepted && !self.disposed && self.epochs[node.tileID]==epoch && self.entries[node.tileID]?.id==id && node.sourceContactNodeAlive && node.sourceGeneration==generation && node.parent === parent
        })
        entries[node.tileID]=entry
        let lease=service.register(participant:entry,duration:0.28,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self,weak entry] _ in
            guard let self,let entry,self.entries[node.tileID] === entry else{return};self.entries[node.tileID]=nil
        })
        guard let lease,bound(),entries[node.tileID] === entry else{lease?.cancel(success:false);if entries[node.tileID] === entry{entries[node.tileID]=nil};return false}
        entry.lease=lease;return lease.active
    }
    func retire(_ node:NativeDiceNode){guard let entry=entries[node.tileID],entry.node === node else{return};entries[node.tileID]=nil;epochs[node.tileID]=nil;entry.lease?.cancel(success:false)}
    func dispose(){guard !disposed else{return};disposed=true;let old=Array(entries.values);entries.removeAll();epochs.removeAll();for entry in old{entry.lease?.cancel(success:false)}}
    isolated deinit{dispose()}
}
