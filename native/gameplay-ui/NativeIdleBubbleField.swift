import SpriteKit

/// Original fizz paths on six reusable vector carriers; no independent ticker.
@MainActor
final class NativeIdleBubbleField:SKNode {
    private struct Carrier {
        let node:SKNode,body:SKShapeNode,highlight:SKShapeNode,border:SKShapeNode
        var id:Int?
    }
    private let runtime:NativeIdleBubbleMotion.Runtime
    private var carriers:[Carrier]=[],disposed=false
    init(family:NativeIdleBubbleMotion.Family,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        runtime=NativeIdleBubbleMotion.Runtime(family:family,random:random)
        super.init();name="native-source-idle-fizz";zPosition=2600
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
    func tick(_ delta:Double) {guard !disposed else {return};runtime.advance(delta);paint()}
    func stopForPointer() {guard !disposed else {return};runtime.stopForPointer();paint()}
    func restartAfterLanding() {guard !disposed else {return};runtime.restartAfterLanding();paint()}
    private func paint() {
        for i in carriers.indices where !runtime.bubbles.contains(where:{$0.slot==i}) {carriers[i].node.isHidden=true;carriers[i].id=nil}
        for bubble in runtime.bubbles {
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
            let pose=plan.sample(seconds:runtime.elapsed-bubble.born),carrier=carriers[i]
            carrier.node.isHidden=false;carrier.node.position=CGPoint(x:pose.x,y:-pose.y)
            carrier.node.xScale=pose.scaleX;carrier.node.yScale=pose.scaleY;carrier.node.alpha=pose.alpha
            let color=plan.family == .bottle ? pose.tint:plan.color
            func paintColor(_ alpha:CGFloat)->UIColor {UIColor(red:CGFloat((color>>16)&255)/255,green:CGFloat((color>>8)&255)/255,blue:CGFloat(color&255)/255,alpha:alpha)}
            carrier.body.fillColor=paintColor(0.6);carrier.highlight.fillColor=paintColor(0.8);carrier.border.strokeColor=paintColor(0.4)
        }
    }
    var fishBubbleSnapshots:[NativeFishIdleFrame.Bubble] {
        guard !disposed else {return []}
        return runtime.bubbles.map {bubble in
            let pose=bubble.plan.sample(seconds:runtime.elapsed-bubble.born)
            return NativeFishIdleFrame.Bubble(id:bubble.id,slot:bubble.slot,radius:bubble.plan.radius,color:bubble.plan.color,point:CGPoint(x:pose.x,y:pose.y),scale:CGPoint(x:pose.scaleX,y:pose.scaleY),alpha:pose.alpha)
        }
    }
    var activeCount:Int {runtime.bubbles.count}
    var isRunning:Bool {runtime.running && !disposed}
    func dispose() {guard !disposed else {return};disposed=true;runtime.stopForPointer();carriers.removeAll();removeAllChildren();removeFromParent()}
}
