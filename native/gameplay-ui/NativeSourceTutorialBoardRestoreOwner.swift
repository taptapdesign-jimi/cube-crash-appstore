import Foundation
import SpriteKit

/// Literal restoreBoardAndHudOpacity board channel only. Captured genuine
/// object order owns one shuffle key per surviving node; sorted order then
/// owns one active/locked delay draw. Restore never rewrites gameplay state.
@MainActor final class NativeSourceTutorialBoardRestoreOwner {
    @MainActor private final class Paint:NativeSourceAnimationParticipant {
        let update:(Double)->Void
        init(_ update:@escaping(Double)->Void){self.update=update}
        func advanceSourceAnimation(seconds:Double){update(seconds)}
    }
    @MainActor private final class Entry {
        let node:NativeDiceNode,parent:SKNode,generation:UInt64
        var paints:[Paint]=[],leases:[NativeSourceAnimationClockService.Lease]=[]
        var retired=false
        init(_ node:NativeDiceNode,parent:SKNode,generation:UInt64){self.node=node;self.parent=parent;self.generation=generation}
        var current:Bool{!retired && node.parent === parent && node.sourceContactNodeAlive && node.sourceGeneration==generation}
        func retire(){guard !retired else{return};retired=true;let old=leases;leases.removeAll();paints.removeAll();for lease in old{lease.cancel(success:false)}}
    }
    private let service:NativeSourceAnimationClockService,random:()->Double,current:()->Bool
    private let nodes:[NativeDiceNode],parent:SKNode,generation:UInt64
    private var entries:[ObjectIdentifier:Entry]=[:],started=false,disposed=false
    private(set) var orderedIDs:[String]=[]
    var activeRootCount:Int{entries.values.reduce(0){$0+$1.leases.filter(\.active).count}}
    init?(service:NativeSourceAnimationClockService,random:@escaping()->Double,nodes:[NativeDiceNode],parent:SKNode,generation:UInt64,current:@escaping()->Bool) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,
            Set(nodes.map(ObjectIdentifier.init)).count==nodes.count,
            nodes.allSatisfy({$0.parent === parent && $0.sourceContactNodeAlive && $0.sourceGeneration==generation}),current() else{return nil}
        self.service=service;self.random=random;self.nodes=nodes;self.parent=parent;self.generation=generation;self.current=current
    }
    private func admitted()->Bool{guard !disposed else{return false};let valid=current();return valid && !disposed}
    @discardableResult func restore(immediate:Bool)->Bool {
        guard !started,admitted() else{return false};started=true
        var keyed:[(NativeDiceNode,Double,Int)]=[]
        for (index,node) in nodes.enumerated(){guard admitted(),node.parent === parent,node.sourceContactNodeAlive else{dispose();return false};let key=random();guard admitted() else{dispose();return false};keyed.append((node,key,index))}
        // Source Array.sort is stable when comparator returns zero.
        keyed.sort{$0.1 != $1.1 ? $0.1<$1.1:$0.2<$1.2};orderedIDs=keyed.map{$0.0.tileID}
        for (node,_,_) in keyed {
            guard admitted(),node.parent === parent,node.sourceContactNodeAlive,node.sourceGeneration==generation else{dispose();return false}
            let entry=Entry(node,parent:parent,generation:generation);entries[ObjectIdentifier(node)]=entry
            node.isHidden=false;let target=node.sourceLocked ? 0.2:1.0,active = !node.sourceLocked && node.sourceValue>0
            if immediate {
                node.killSourceActiveScaleChildren();guard admitted(),entry.current else{dispose();return false}
                node.alpha=CGFloat(target);if active{node.paintSourceOuterScale(.init(x:1,y:1))};continue
            }
            let delay=random()*(active ? 0.78:0.42);guard admitted(),entry.current else{dispose();return false}
            let duration=active ? 0.2:0.34;var from:Double?
            guard attach(entry,duration:duration,domain:.sourceGSAP(.defaultLazyTween),delay:delay,update:{node,time in
                if from==nil{from=Double(node.alpha)}
                let t=sin(max(0,min(1,time/duration))*Double.pi/2);node.alpha=CGFloat(from!+(target-from!)*t)
            }) else{dispose();return false}
            if active {
                node.killSourceActiveScaleChildren();guard admitted(),entry.current else{dispose();return false}
                node.paintSourceOuterScale(.init(x:0.88,y:0.88))
                guard attach(entry,duration:0.44,domain:.sourceGSAP(.timeline),delay:delay,update:{node,time in
                    let scale:Double
                    if time<=0.18{scale=0.88+0.24*Self.backOut(time/0.18,2.6)}
                    else if time<=0.28{let t=0.5-0.5*cos(max(0,min(1,(time-0.18)/0.1))*Double.pi);scale=1.12-0.15*t}
                    else{scale=0.97+0.03*Self.backOut((time-0.28)/0.16,2)}
                    node.paintSourceOuterScale(.init(x:scale,y:scale))
                }) else{dispose();return false}
            }
        }
        return admitted()
    }
    private static func backOut(_ value:Double,_ amount:Double)->Double{let t=max(0,min(1,value))-1;return 1+(amount+1)*t*t*t+amount*t*t}
    private func attach(_ entry:Entry,duration:Double,domain:NativeSourceAnimationClockService.Domain,delay:Double,update:@escaping(NativeDiceNode,Double)->Void)->Bool {
        let paint=Paint{[weak self,weak entry] seconds in
            guard let self else{return};guard self.admitted() else{self.dispose();return};guard let entry,entry.current else{return};update(entry.node,seconds)
        }
        guard let lease=service.register(participant:paint,duration:duration,domain:domain,delay:delay,cleanup:{_ in}) else{return false}
        entry.paints.append(paint);entry.leases.append(lease);return lease.active && admitted() && entry.current
    }
    func owns(_ node:NativeDiceNode)->Bool{!disposed && entries[ObjectIdentifier(node)]?.current==true}
    /// The genuine pointer/drop/lifecycle caller replaces only this object's
    /// captured channels; sibling restores and unrelated roots remain alive.
    func retire(_ node:NativeDiceNode){entries.removeValue(forKey:ObjectIdentifier(node))?.retire()}
    func dispose(){guard !disposed else{return};disposed=true;let old=Array(entries.values);entries.removeAll();for entry in old{entry.retire()}}
    isolated deinit{dispose()}
}
