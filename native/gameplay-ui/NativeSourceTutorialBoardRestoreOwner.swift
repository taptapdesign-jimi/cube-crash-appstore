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
    @discardableResult func restore(immediate:Bool,continuous:Bool=false,preserveScale:Bool=false)->Bool {
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
                if !preserveScale {node.killSourceActiveScaleChildren()};guard admitted(),entry.current else{dispose();return false}
                node.alpha=CGFloat(target);if active && !preserveScale{node.paintSourceOuterScale(.init(x:1,y:1))};continue
            }
            let delay=random()*(active ? 0.78:0.42);guard admitted(),entry.current else{dispose();return false}
            let duration=active ? 0.2:0.34;var from:Double?
            guard attach(entry,duration:duration,domain:.sourceGSAP(.defaultLazyTween),delay:delay,update:{node,time in
                if from==nil{from=Double(node.alpha)}
                let t=sin(max(0,min(1,time/duration))*Double.pi/2);node.alpha=CGFloat(from!+(target-from!)*t)
            }) else{dispose();return false}
            if active {
                node.killSourceActiveScaleChildren();guard admitted(),entry.current else{dispose();return false}
                let captured=node.sourceLocalScale
                var start:CGPoint?=continuous ? nil:CGPoint(x:0.88,y:0.88)
                if !continuous {node.paintSourceOuterScale(.init(x:0.88,y:0.88))}
                guard attach(entry,duration:0.44,domain:.sourceGSAP(.timeline),delay:delay,update:{node,time in
                    if start==nil {start=node.sourceLocalScale}
                    let from=start ?? captured
                    let scale:Double
                    if time<=0.18{
                        let t=Self.backOut(time/0.18,2.6)
                        node.paintSourceOuterScale(.init(x:Double(from.x)+(1.12-Double(from.x))*t,y:Double(from.y)+(1.12-Double(from.y))*t));return
                    }
                    else if time<=0.28{let t=0.5-0.5*cos(max(0,min(1,(time-0.18)/0.1))*Double.pi);scale=1.12-0.15*t}
                    else{scale=0.97+0.03*Self.backOut((time-0.28)/0.16,2)}
                    node.paintSourceOuterScale(.init(x:scale,y:scale))
                }) else{dispose();return false}
            }
        }
        return admitted()
    }
    /// Transfer alpha ownership without repainting between adjacent sheets.
    @discardableResult func retainPaint()->Bool {
        guard !started,admitted() else{return false};started=true
        for node in nodes {
            guard node.parent === parent,node.sourceContactNodeAlive,node.sourceGeneration==generation else{dispose();return false}
            entries[ObjectIdentifier(node)]=Entry(node,parent:parent,generation:generation)
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

/// The final rendered alpha channel for tutorial dice. Logical synchronize and
/// finite spawn/focus writers cannot publish an intermediate full-opacity flash.
/// Sampled by the existing Scene handoff; no timer, action, or display link.
@MainActor final class NativeTutorialBoardOpacityOwner {
    private final class Entry {
        weak var node:NativeDiceNode?
        var from:CGFloat,painted:CGFloat,target:CGFloat,elapsed=0.0
        init(_ node:NativeDiceNode,target:CGFloat){self.node=node;from=node.alpha;painted=node.alpha;self.target=target}
    }
    private var entries:[ObjectIdentifier:Entry]=[:]
    private var focus:Set<String>?,enabled=false,lastTime:Double?,generation:UInt64?
    var active:Bool{enabled}
    func setFocus(_ ids:Set<String>?) {
        guard focus != ids || (!enabled && ids != nil) else{return}
        focus=ids;enabled=enabled || ids != nil;lastTime=nil
    }
    @discardableResult func paint(nodes:[NativeDiceNode],generation:UInt64,time:Double,suspended:Bool,externallyOwned:(NativeDiceNode)->Bool)->Bool {
        guard enabled,!suspended else{lastTime=nil;return false}
        if self.generation != generation{entries.removeAll();self.generation=generation;lastTime=nil}
        let delta=min(0.05,max(0,time-(lastTime ?? time)));lastTime=time
        let live=Set(nodes.map(ObjectIdentifier.init));entries=entries.filter{live.contains($0.key) && $0.value.node != nil}
        var moving=false
        for node in nodes {
            let key=ObjectIdentifier(node)
            guard !node.isHidden,node.sourceContactNodeAlive,!externallyOwned(node) else{entries.removeValue(forKey:key);continue}
            let target:CGFloat=node.sourceLocked ? 0.2:(focus.map{$0.contains(node.tileID) ? 1:0.2} ?? 1)
            let entry:Entry
            if let old=entries[key],old.node === node{entry=old}else{entry=Entry(node,target:target);entries[key]=entry}
            if abs(entry.target-target)>0.000001{entry.from=entry.painted;entry.target=target;entry.elapsed=0}
            entry.elapsed+=delta
            let t=min(1,entry.elapsed/0.42),e=t*t*(3-2*t)
            entry.painted=entry.from+(entry.target-entry.from)*CGFloat(e);node.alpha=entry.painted
            moving = moving || abs(entry.painted-entry.target)>0.00001
        }
        if !moving && focus==nil{enabled=false;entries.removeAll();lastTime=nil}
        return moving
    }
    func dispose(){entries.removeAll();focus=nil;enabled=false;lastTime=nil;generation=nil}
}
