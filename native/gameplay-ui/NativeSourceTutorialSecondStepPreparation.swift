import Foundation
import SpriteKit

/// Literal step-two node recipe. Uses original surviving-object order for
/// Math, not the logical array's reinserted destination order. There is no
/// local clock: every alpha/scale channel borrows the one APP GSAP service.
@MainActor final class NativeSourceTutorialSecondStepPreparation {
    @MainActor private final class Paint:NativeSourceAnimationParticipant {
        let update:(Double)->Void
        init(_ update:@escaping(Double)->Void){self.update=update}
        func advanceSourceAnimation(seconds:Double){update(seconds)}
    }
    private let service:NativeSourceAnimationClockService,random:()->Double,current:()->Bool
    private let nodes:[NativeDiceNode],merged:NativeDiceNode,one:NativeDiceNode,parent:SKNode,generation:UInt64,onePosition:CGPoint
    private var paints:[Paint]=[],leases:[NativeSourceAnimationClockService.Lease]=[]
    private var disposed=false,started=false
    init?(service:NativeSourceAnimationClockService,random:@escaping()->Double,nodes:[NativeDiceNode],merged:NativeDiceNode,one:NativeDiceNode,
          parent:SKNode,generation:UInt64,onePosition:CGPoint,current:@escaping()->Bool) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,merged !== one,
            nodes.contains(where:{$0 === merged}),nodes.contains(where:{$0 === one}),
            nodes.allSatisfy({$0.parent === parent && $0.sourceContactNodeAlive && $0.sourceGeneration==generation}),current() else{return nil}
        self.service=service;self.random=random;self.nodes=nodes;self.merged=merged;self.one=one;self.parent=parent;self.generation=generation;self.onePosition=onePosition;self.current=current
    }
    private func admitted()->Bool{guard !disposed else{return false};let valid=current();return valid && !disposed}
    private func bound(_ node:NativeDiceNode)->Bool{node.parent === parent && node.sourceContactNodeAlive && node.sourceGeneration==generation}
    func owns(_ node:NativeDiceNode)->Bool{started && !disposed && nodes.contains(where:{$0 === node}) && bound(node)}
    @discardableResult func prepare()->Bool {
        guard !started,admitted(),bound(merged),bound(one) else{return false};started=true
        guard merged.setSourceTutorialInitialValue(5),admitted(),one.setSourceTutorialInitialValue(1),admitted() else{dispose();return false}
        one.position=onePosition
        for node in nodes {
            guard admitted(),bound(node) else{dispose();return false}
            let focused=node === merged || node === one
            if focused {
                guard node.normalizeSourceTutorialInitialTile(),admitted(),node.drawSourceTutorialPips(node === one ? 1:5),admitted() else{dispose();return false}
                if node === one {
                    node.isHidden=false;node.alpha=0;node.paintSourceOuterScale(.init(x:0.72,y:0.72))
                    guard attach(node,duration:0.4,domain:.sourceGSAP(.timeline),delay:0,update:{node,time in
                        node.alpha=CGFloat(sin(max(0,min(1,time/0.16))*Double.pi/2))
                        let scale:Double
                        if time<=0.22 {let t=max(0,min(1,time/0.22))-1;scale=0.72+0.42*(1+3.5*t*t*t+2.5*t*t)}
                        else {scale=1.14-0.14*sin(max(0,min(1,(time-0.22)/0.18))*Double.pi/2)}
                        node.paintSourceOuterScale(.init(x:scale,y:scale))
                    }) else{dispose();return false}
                } else if !fade(node,to:1,duration:0.22,delay:0){dispose();return false}
            } else {
                let duration=0.32+random()*0.2;guard admitted(),bound(node) else{dispose();return false}
                let delay=random()*0.16;guard admitted(),bound(node),fade(node,to:0.2,duration:duration,delay:delay) else{dispose();return false}
            }
            guard node.setSourceTutorialInitialFocus(focused),admitted() else{dispose();return false}
        }
        return admitted()
    }
    private func fade(_ node:NativeDiceNode,to:Double,duration:Double,delay:Double)->Bool {
        var from:Double?
        return attach(node,duration:duration,domain:.sourceGSAP(.defaultLazyTween),delay:delay,update:{node,time in
            if from==nil{from=Double(node.alpha)}
            let t=0.5-0.5*cos(max(0,min(1,time/duration))*Double.pi)
            node.alpha=CGFloat(from!+(to-from!)*t)
        })
    }
    private func attach(_ node:NativeDiceNode,duration:Double,domain:NativeSourceAnimationClockService.Domain,delay:Double,update:@escaping(NativeDiceNode,Double)->Void)->Bool {
        let paint=Paint{[weak self,weak node] seconds in
            guard let self else{return};guard self.admitted() else{self.dispose();return};guard let node,self.bound(node) else{return};update(node,seconds)
        }
        paints.append(paint)
        guard let lease=service.register(participant:paint,duration:duration,domain:domain,delay:delay,cleanup:{_ in}) else{return false}
        leases.append(lease);return lease.active && admitted()
    }
    @discardableResult func repair()->Bool {
        guard started,admitted(),bound(merged),bound(one) else{return false}
        return merged.forceSourceTutorialInitialValue(5) && admitted() && one.forceSourceTutorialInitialValue(1) && admitted()
    }
    func dispose(){guard !disposed else{return};disposed=true;let old=leases;leases.removeAll();paints.removeAll();for lease in old{lease.cancel(success:false)}}
    isolated deinit{dispose()}
}
