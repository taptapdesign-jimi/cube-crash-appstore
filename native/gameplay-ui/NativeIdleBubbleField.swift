import SpriteKit

/// Original fizz paths on six reusable vector carriers; no independent ticker.
@MainActor
final class NativeIdleBubbleField:SKNode {
    private struct Carrier {
        let node:SKNode,body:SKShapeNode,highlight:SKShapeNode,border:SKShapeNode
        var id:Int?
        var color:UInt32?
    }
    private let runtime:NativeIdleBubbleMotion.Runtime?
    private struct SourceBubble {
        let id:Int,slot:Int,plan:NativeIdleBubbleMotion.Plan
        var pose:NativeIdleBubbleMotion.Pose,clock:NativeSourceFizzBubbleClock?
    }
    private var sourceBubbles:[SourceBubble]=[],sourceProducer:NativeSourceFizzProducerClock?
    private var sourceRestart:(()->NativeSourceFizzProducerClock)?,sourceSequence=0,sourceCursor=0
    private var sourceVisible=true
    private var carriers:[Carrier]=[],disposed=false
#if DEBUG
    private(set) var carrierPaintCount=0,colorPaintCount=0,sourcePosePublishCount=0
#endif
    init(family:NativeIdleBubbleMotion.Family,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        runtime=NativeIdleBubbleMotion.Runtime(family:family,random:random)
        super.init();prepareCarriers()
    }
    private func prepareCarriers(){
        name="native-source-idle-fizz";zPosition=2600
        for _ in 0..<6 {
            let node=SKNode(),body=SKShapeNode(),highlight=SKShapeNode(),border=SKShapeNode()
            body.strokeColor = .clear;highlight.strokeColor = .clear;border.fillColor = .clear;border.lineWidth=1
            node.addChild(body);node.addChild(highlight);node.addChild(border)
            node.isHidden=true;addChild(node)
            carriers.append(Carrier(node:node,body:body,highlight:highlight,border:border))
        }
        paint()
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func tick(_ delta:Double) {guard !disposed,let runtime else {return};runtime.advance(delta);paint()}
    func stopForPointer() {
        guard !disposed else{return}
        runtime?.stopForPointer();let producer=sourceProducer;sourceProducer=nil;producer?.dispose()
        let old=sourceBubbles;sourceBubbles.removeAll();old.forEach{$0.clock?.dispose()};paint()
    }
    func restartAfterLanding() {
        guard !disposed else{return}
        if let runtime {runtime.restartAfterLanding();paint()}
        else if sourceProducer==nil {_ = startSource()}
    }
    /// Explicit Source constructor. No RNG/phase starts before mount admission.
    init(sourceFamily:NativeIdleBubbleMotion.Family,service:NativeSourceAnimationClockService,
         tasks:NativeSourceMicrotaskFIFO.Scope,random:@escaping()->Double,
         current:@escaping()->Bool,paintable:@escaping()->Bool){
        runtime=nil;super.init();prepareCarriers()
        sourceRestart = {[weak self] in
            NativeSourceFizzProducerClock(service:service,family:sourceFamily,random:random,
                current:{[weak self] in self?.disposed==false && current()},paintable:paintable,
                emit:{[weak self] plan in self?.compose(plan,service:service,tasks:tasks,current:current)})
        }
    }
    @discardableResult func startSource()->Bool {
        guard !disposed,runtime==nil,sourceProducer==nil,let sourceRestart else{return false}
        let producer=sourceRestart();sourceProducer=producer;producer.setVisible(sourceVisible)
        guard producer.start(),!disposed,sourceProducer === producer else{
            producer.dispose();if sourceProducer === producer {sourceProducer=nil};return false
        }
        return true
    }
    func setSourceVisible(_ value:Bool){
        guard !disposed,sourceVisible != value else{return};sourceVisible=value
        sourceProducer?.setVisible(value);let captured=sourceBubbles;captured.forEach{$0.clock?.setVisible(value)}
    }
    private func compose(_ plan:NativeIdleBubbleMotion.Plan,service:NativeSourceAnimationClockService,
                         tasks:NativeSourceMicrotaskFIFO.Scope,current:@escaping()->Bool){
        guard !disposed,let slot=(0..<6).map({(sourceCursor+$0)%6}).first(where:{candidate in !sourceBubbles.contains{$0.slot==candidate}}) else{return}
        sourceCursor=(slot+1)%6;sourceSequence+=1;let id=sourceSequence
        sourceBubbles.append(.init(id:id,slot:slot,plan:plan,pose:plan.sample(seconds:0),clock:nil))
        let clock=NativeSourceFizzBubbleClock(service:service,tasks:tasks,plan:plan,
            current:{[weak self] in self?.disposed==false && self?.sourceBubbles.contains(where:{$0.id==id})==true && current()},
            paint:{[weak self] pose in
                guard let self,!self.disposed,let index=self.sourceBubbles.firstIndex(where:{$0.id==id}) else{return}
                self.sourceBubbles[index].pose=pose
#if DEBUG
                self.sourcePosePublishCount+=1
#endif
                // Each independent Source root publishes only its own bubble.
                // Repainting the whole field here multiplies scene writes by
                // the number of live bubbles for every scale/rise/fade root.
                let bubble=self.sourceBubbles[index]
                self.paintBubble(.init(id:bubble.id,slot:bubble.slot,plan:bubble.plan,pose:pose))
            },retired:{[weak self] in self?.retireSourceBubble(id)})
        guard let index=sourceBubbles.firstIndex(where:{$0.id==id}) else{clock.dispose();return}
        sourceBubbles[index].clock=clock;clock.setVisible(sourceVisible)
        if !clock.start(){retireSourceBubble(id)}
    }
    private func retireSourceBubble(_ id:Int){
        guard let index=sourceBubbles.firstIndex(where:{$0.id==id}) else{return}
        let bubble=sourceBubbles.remove(at:index);bubble.clock?.dispose()
        carriers[bubble.slot].node.isHidden=true;carriers[bubble.slot].id=nil
    }
    private struct PaintedBubble {let id:Int,slot:Int,plan:NativeIdleBubbleMotion.Plan,pose:NativeIdleBubbleMotion.Pose}
    private var paintedBubbles:[PaintedBubble] {
        if let runtime{return runtime.bubbles.map{.init(id:$0.id,slot:$0.slot,plan:$0.plan,pose:$0.plan.sample(seconds:runtime.elapsed-$0.born))}}
        return sourceBubbles.map{.init(id:$0.id,slot:$0.slot,plan:$0.plan,pose:$0.pose)}
    }
    private func paint() {
        let bubbles=paintedBubbles
        for i in carriers.indices where !bubbles.contains(where:{$0.slot==i}) {carriers[i].node.isHidden=true;carriers[i].id=nil}
        for bubble in bubbles {paintBubble(bubble)}
    }
    private func paintBubble(_ bubble:PaintedBubble) {
#if DEBUG
            carrierPaintCount+=1
#endif
            let i=bubble.slot,plan=bubble.plan
            if carriers[i].id != bubble.id {
                carriers[i].id=bubble.id
                func circle(_ radius:Double)->CGPath {CGPath(ellipseIn:CGRect(x:-radius,y:-radius,width:radius*2,height:radius*2),transform:nil)}
                carriers[i].body.path=circle(plan.radius);carriers[i].highlight.path=circle(plan.radius*0.3)
                carriers[i].highlight.position=CGPoint(x:-plan.radius*0.2,y:plan.radius*0.2);carriers[i].border.path=circle(plan.radius)
                // Original pooled Graphics is appended after existing live
                // bubbles. Preserve translucent painter order on pool reuse.
                carriers[i].node.removeFromParent();addChild(carriers[i].node)
            }
            let pose=bubble.pose,carrier=carriers[i]
            carrier.node.isHidden=false;carrier.node.position=CGPoint(x:pose.x,y:-pose.y)
            carrier.node.xScale=pose.scaleX;carrier.node.yScale=pose.scaleY;carrier.node.alpha=pose.alpha
            let color=plan.family == .bottle ? pose.tint:plan.color
            guard carriers[i].color != color else{return}
            carriers[i].color=color
#if DEBUG
            colorPaintCount+=1
#endif
            func paintColor(_ alpha:CGFloat)->UIColor {UIColor(red:CGFloat((color>>16)&255)/255,green:CGFloat((color>>8)&255)/255,blue:CGFloat(color&255)/255,alpha:alpha)}
            carrier.body.fillColor=paintColor(0.6);carrier.highlight.fillColor=paintColor(0.8);carrier.border.strokeColor=paintColor(0.4)
    }
    var fishBubbleSnapshots:[NativeFishIdleFrame.Bubble] {
        guard !disposed else {return []}
        return paintedBubbles.map {bubble in
            let pose=bubble.pose
            return NativeFishIdleFrame.Bubble(id:bubble.id,slot:bubble.slot,radius:bubble.plan.radius,color:bubble.plan.color,point:CGPoint(x:pose.x,y:pose.y),scale:CGPoint(x:pose.scaleX,y:pose.scaleY),alpha:pose.alpha)
        }
    }
    var activeCount:Int {runtime?.bubbles.count ?? sourceBubbles.count}
    var isRunning:Bool {!disposed && (runtime?.running ?? (sourceProducer != nil))}
    func dispose() {guard !disposed else {return};stopForPointer();disposed=true;sourceRestart=nil;carriers.removeAll();removeAllChildren();removeFromParent()}
}
