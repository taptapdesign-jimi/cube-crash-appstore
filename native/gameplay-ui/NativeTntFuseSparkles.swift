import SpriteKit

/// OG TNT's fx.ts/startTntIdleParticles recipe. Three shards every 200ms,
/// at most nine live (<600ms lifetime), one finite root on the shared APP clock.
/// Cosmetic entropy is local: restoring this missing FX cannot alter dice rolls.
@MainActor final class NativeTntFuseSparkles:SKNode,NativeSourceAnimationParticipant {
    struct Plan {
        let width,height:Double,color:UInt32,start,end:CGPoint,rotation,turn,duration:Double
        static func make(random:()->Double)->Self {
            let colors:[UInt32]=[0xE85C3A,0xEB7A5A,0xF09880,0xF5B6A6,0xFFD966,0xFFE699]
            let color=colors[min(colors.count-1,Int(random()*Double(colors.count)))]
            let width=(12+random()*12)*0.55,height=(16+random()*16)*0.55
            let angle=random()*2 * .pi,distance=96*(0.1+random()*0.6)*0.2,rotation=random()*2 * .pi
            let endAngle=angle+(random()-0.5),endDistance=distance*(1.5+random()*0.5)
            return .init(width:width,height:height,color:color,
                start:.init(x:cos(angle)*distance,y:-sin(angle)*distance),
                end:.init(x:cos(endAngle)*endDistance,y:-sin(endAngle)*endDistance),
                rotation:-rotation,turn:-(random()-0.5)*2 * .pi,duration:0.3+random()*0.3)
        }
    }
    private struct Spark {let slot:Int,born:Double,plan:Plan}
    private var carriers:[SKSpriteNode]=[],sparks:[Spark]=[]
    private let service:NativeSourceAnimationClockService,current:()->Bool,paintable:()->Bool,random:()->Double
    private var lease:NativeSourceAnimationClockService.Lease?
    private var elapsed=0.0,lastClockSeconds=0.0,visible=true,disposed=false,started=false
    private(set) var emissionCount=0
    var isDisposed:Bool{disposed}
    var activeCount:Int{sparks.count}
    var activeRootCount:Int{lease?.active==true ? 1:0}
    init(service:NativeSourceAnimationClockService,current:@escaping()->Bool,paintable:@escaping()->Bool={true},random:@escaping()->Double={Double.random(in:0..<1)}) {
        self.service=service;self.current=current;self.paintable=paintable;self.random=random
        super.init();name="native-og-tnt-fuse-sparkles";zPosition=3
        // PWA artwork and Native both use128-unit tiles; the authored emitter
        // deliberately uses96 units. Preserve that smaller fuse offset/spread.
        position = .init(x:38.4,y:48)
        for _ in 0..<9 {
            let node=SKSpriteNode(color:.white,size:.zero);node.isHidden=true
            node.isUserInteractionEnabled=false;carriers.append(node);addChild(node)
        }
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    private func live()->Bool {guard !disposed else{return false};let accepted=current();return accepted && !disposed}
    @discardableResult func start()->Bool {
        guard !started,live() else{return false};started=true
        lastClockSeconds=service.sourceAnimationSeconds
        if !paintable(){setVisible(false)}
        if visible {emit()}
        return schedule()
    }
    private func emit(){
        guard live(),visible,paintable(),live() else{return}
        for _ in 0..<3 {
            guard let slot=carriers.indices.first(where:{slot in !sparks.contains{$0.slot==slot}}) else{break}
            let plan=Plan.make(random:random)
            guard live() else{return}
            let node=carriers[slot];node.size = .init(width:plan.width,height:plan.height)
            node.color=UIColor(red:CGFloat((plan.color>>16)&255)/255,green:CGFloat((plan.color>>8)&255)/255,blue:CGFloat(plan.color&255)/255,alpha:1)
            sparks.append(.init(slot:slot,born:elapsed,plan:plan))
        }
        emissionCount+=1;paint()
    }
    private func schedule()->Bool {
        guard live() else{dispose();return false}
        lease=service.register(participant:self,duration:0.2,domain:.sourceGSAP(.eagerTween),initiallySuspended:!visible,cleanup:{[weak self] success in
            guard let self,!self.disposed else{return};self.lease=nil
            guard success,self.live() else{self.dispose();return}
            if self.visible {self.emit()}
            _ = self.schedule()
        })
        if lease==nil {dispose();return false};return true
    }
    func advanceSourceAnimation(seconds:Double){
        guard live() else{dispose();return};guard visible else{return}
        guard paintable(),live() else{setVisible(false);return}
        // The emission root clamps at200ms. Sample the same APP clock so an
        // overshooting frame still ages existing300–600ms shards correctly.
        let now=service.sourceAnimationSeconds
        elapsed+=max(0,now-lastClockSeconds);lastClockSeconds=now
        sparks.removeAll {spark in
            guard elapsed-spark.born>=spark.plan.duration else{return false}
            carriers[spark.slot].isHidden=true;return true
        }
        paint()
    }
    private func paint(){
        for spark in sparks {
            let plan=spark.plan,p=min(1,max(0,(elapsed-spark.born)/plan.duration)),ease=1-pow(1-p,2),node=carriers[spark.slot]
            node.isHidden=false;node.position = .init(x:plan.start.x+(plan.end.x-plan.start.x)*ease,y:plan.start.y+(plan.end.y-plan.start.y)*ease)
            node.zRotation=plan.rotation+plan.turn*ease;node.alpha=1-ease
        }
    }
    func setVisible(_ value:Bool){
        guard !disposed,visible != value else{return};visible=value;isHidden = !value
        lastClockSeconds=service.sourceAnimationSeconds
        lease?.setSuspended(!value)
        // Pointer/hide suspension removes existing sparks, with no catch-up burst.
        if !value {sparks.removeAll();carriers.forEach{$0.isHidden=true}}
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        let old=lease;lease=nil;old?.cancel();sparks.removeAll();carriers.removeAll();removeAllChildren();removeFromParent()
    }
    isolated deinit{dispose()}
}
