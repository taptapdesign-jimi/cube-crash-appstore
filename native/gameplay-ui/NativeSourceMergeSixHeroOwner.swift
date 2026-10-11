import Foundation
import CoreGraphics

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
