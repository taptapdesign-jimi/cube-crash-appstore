import Foundation
import CoreGraphics
import SpriteKit

/// Literal playMerge6HeroBounce15851 two-child Source timeline. Only ordinary
/// Six uses its one peak draw. No nativeRaw timer or extra activity is created.
@MainActor final class NativeSourceMergeSixHeroOwner:NativeSourceAnimationParticipant {
    private weak var node:NativeDiceNode?
    private let service:NativeSourceAnimationClockService,current:()->Bool
    private let generation:UInt64
    private var lease:NativeSourceAnimationClockService.Lease?
    private var disposed=false,starting=false,start:CGPoint?
    private var peak:Double?
    private var installation=UUID()
    var onFinished:((Bool)->Void)?
    init(node:NativeDiceNode,service:NativeSourceAnimationClockService,generation:UInt64,current:@escaping()->Bool){
        self.node=node;self.service=service;self.generation=generation;self.current=current
    }
    private func valid()->Bool {
        guard !disposed,let captured=node,captured.sourceContactNodeAlive,captured.sourceGeneration==generation else{return false}
        let admitted=current()
        return admitted && !disposed && node === captured && captured.sourceContactNodeAlive && captured.sourceGeneration==generation
    }
    func begin(random:()->Double)->Bool {
        guard !starting,peak==nil,valid(),let node else{return false};starting=true;defer{starting=false}
        node.killSourceActiveScaleChildren()
        guard valid() else{return false}
        peak=1.15+random()*0.018
        let install=UUID();installation=install
        guard valid(),let captured=service.register(participant:self,duration:0.275,domain:.sourceGSAP(.timeline),cleanup:{[weak self] success in
            guard let self,self.installation==install else{return};self.lease=nil
            let complete=success && self.valid()
            if complete {self.node?.paintSourceOuterScale(.init(x:1,y:1))}
            self.installation=UUID();let callback=self.onFinished;self.onFinished=nil;callback?(complete)
        }) else{return false}
        guard installation==install,valid() else{captured.cancel(success:false);return false}
        lease=captured;return true
    }
    func advanceSourceAnimation(seconds:Double) {
        guard valid(),let node,let peak else{return}
        if start==nil {start=node.sourceLocalScale}
        guard let start else{return}
        func back(_ t:Double,_ strength:Double)->Double {let x=max(0,min(1,t))-1;return 1+(strength+1)*x*x*x+strength*x*x}
        let x:Double,y:Double
        if seconds<0.105 {let p=back(seconds/0.105,2.5);x=Double(start.x)+(peak-Double(start.x))*p;y=Double(start.y)+(peak-Double(start.y))*p}
        else {let p=back((seconds-0.105)/0.17,1.9);x=peak+(1-peak)*p;y=x}
        node.paintSourceOuterScale(.init(x:x,y:y))
    }
    func dispose(){guard !disposed else{return};disposed=true;installation=UUID();let captured=lease;lease=nil;captured?.cancel(success:false);node=nil
        let callback=onFinished;onFinished=nil;callback?(false)}
    isolated deinit {dispose()}
}

/// PWA fx.ts wildImpactEffect at Magnet main80. Inner rotG animation leaves
/// the outer pull geometry and gameplay lifetime untouched. No random draws.
@MainActor final class NativeSourceMagnetImpactOwner:NativeSourceAnimationParticipant {
    private weak var node:NativeDiceNode?
    private let service:NativeSourceAnimationClockService,current:()->Bool
    private let generation:UInt64
    private var lease:NativeSourceAnimationClockService.Lease?
    private let token=UUID()
    private var base:CGPoint?,closed=false
    var onFinished:(()->Void)?
    init(node:NativeDiceNode,service:NativeSourceAnimationClockService,generation:UInt64,current:@escaping()->Bool){
        self.node=node;self.service=service;self.generation=generation;self.current=current
    }
    private func valid()->Bool {
        guard !closed,let captured=node,captured.sourceContactNodeAlive,captured.sourceGeneration==generation,captured.sourceMagnetImpactToken==token else{return false}
        return current() && !closed && node === captured && captured.sourceContactNodeAlive && captured.sourceGeneration==generation && captured.sourceMagnetImpactToken==token
    }
    func begin()->Bool {
        guard !closed,base==nil,let node,node.sourceContactNodeAlive,node.sourceGeneration==generation,
              node.sourceMagnetImpactToken==nil,current(),!closed else{return false}
        node.sourceMagnetImpactToken=token
        guard valid() else{finish();return false}
        base=CGPoint(x:node.visual.xScale,y:node.visual.yScale)
        node.dragInnerTilt=0
        // The first fromTo immediate render matches GSAP's authored .88 pose.
        node.visual.xScale=base!.x*0.88;node.visual.yScale=base!.y*0.88
        guard let captured=service.register(participant:self,duration:1.09,domain:.sourceGSAP(.timeline),cleanup:{[weak self] _ in self?.finish()}) else {finish();return false}
        guard valid() else{captured.cancel(success:false);finish();return false}
        lease=captured;return true
    }
    static func pose(seconds:Double)->(scale:CGPoint,rotation:CGFloat) {
        let t=max(0,seconds)
        func mix(_ a:CGFloat,_ b:CGFloat,_ p:CGFloat)->CGFloat {a+(b-a)*p}
        let scale:CGPoint
        if t<0.08 {let p=NativeBoardMotion.Ease.power2Out.sample(CGFloat(t/0.08));scale = .init(x:mix(0.88,1.30,p),y:mix(0.88,0.74,p))}
        else if t<0.28 {let p=NativeBoardMotion.Ease.backOut(3).sample(CGFloat((t-0.08)/0.20));scale = .init(x:mix(1.30,1.24,p),y:mix(0.74,1.24,p))}
        else if t<0.43 {let p=NativeBoardMotion.Ease.power2Out.sample(CGFloat((t-0.28)/0.15));scale = .init(x:mix(1.24,0.96,p),y:mix(1.24,1.04,p))}
        else {let p=NativeBoardMotion.Ease.elasticOut(1,0.7).sample(CGFloat((t-0.43)/0.22));scale = .init(x:mix(0.96,1,p),y:mix(1.04,1,p))}
        // Implicit proxy children append at the full timeline's .65 endpoint,
        // rather than at the first rotation child's .20 endpoint.
        let rotation:CGFloat
        if t<0.10 {rotation=0}
        else if t<0.20 {rotation=0.18*sin(CGFloat((t-0.10)/0.10) * .pi/2)}
        else if t<0.65 {rotation=0.18}
        else if t<0.77 {rotation=mix(0.18,-0.144,NativeBoardMotion.Ease.sineInOut.sample(CGFloat((t-0.65)/0.12)))}
        else if t<0.91 {rotation=mix(-0.144,0.09,NativeBoardMotion.Ease.sineInOut.sample(CGFloat((t-0.77)/0.14)))}
        else {rotation=mix(0.09,0,NativeBoardMotion.Ease.backOut(2.2).sample(CGFloat((t-0.91)/0.18)))}
        return (scale,rotation)
    }
    func advanceSourceAnimation(seconds:Double) {
        guard valid(),let node,let base else{dispose();return}
        let pose=Self.pose(seconds:seconds)
        node.visual.xScale=base.x*pose.scale.x;node.visual.yScale=base.y*pose.scale.y;node.dragInnerTilt=pose.rotation
    }
    private func finish() {
        guard !closed else{return}
        closed=true;lease=nil
        // Scope teardown seals admission first. The exact inner-transform
        // token still permits symmetric restoration, without touching a new
        // owner or a rebuilt/reused node of a later generation.
        if let node,node.sourceMagnetImpactToken==token {
            node.sourceMagnetImpactToken=nil
            if node.sourceContactNodeAlive,node.sourceGeneration==generation,let base {
                node.visual.xScale=base.x;node.visual.yScale=base.y;node.dragInnerTilt=0
            }
        }
        node=nil
        let callback=onFinished;onFinished=nil;callback?()
    }
    func dispose(){guard !closed else{return};let captured=lease;finish();captured?.cancel(success:false)}
    isolated deinit {dispose()}
}
