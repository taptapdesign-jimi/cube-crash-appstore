import SpriteKit

/// Front/rear authored cans and exactly three reusable cyan bubbles. The
/// board's existing visible ticker owns this field; drag settles artwork and
/// clears particles without touching the tile's model/position authority.
@MainActor
final class NativeKantaDiceIdle: SKNode {
    let assetReady:Bool
    private let front=SKSpriteNode(),rear=SKSpriteNode(),frontBubbles=SKNode(),rearBubbles=SKNode()
    private struct Bubble {let node:SKNode,rear:Bool;var active=false,age:Double=0,duration:Double=1.1,startX:CGFloat=0,direction:CGFloat=1,distance:CGFloat=8,alpha:CGFloat=1,startScale:CGFloat=0.32}
    var activeBubbleCount:Int {bubbles.filter(\.active).count}
    var bubblePoolCount:Int {bubbles.count}
    private var bubbles:[Bubble]=[],cursor=0,emissions=0
    private var motion:NativeKantaIdleMotion
    private let width:CGFloat,height:CGFloat,correction:CGFloat,tilt:CGFloat,random:()->Double
    private var elapsed:Double=0,rearElapsed:Double=0,nextBubble:Double=0.7,pendingDouble:Double=0
    private var dragging=false,disposed=false,rearSettled=false
    private var facing:CGFloat = -1,facingCaptured=false
    init(textures:NativeBoardTextures,size:CGSize,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        width=size.width;height=size.height;correction=NativeKantaIdleMotion.centerCorrection(width:size.width);self.random=random
        motion=NativeKantaIdleMotion(squash:random()>=0.5);tilt=CGFloat(3+random()*7) * .pi/180
        let frontTexture=textures.texture("assets/shop/kanta/04.png"),rearTexture=textures.texture("assets/shop/kanta/02.png")
        assetReady=frontTexture != nil && rearTexture != nil
        super.init();name="native-kanta-local-idle"
        front.texture=frontTexture;front.size=size;front.anchorPoint=CGPoint(x:0.5,y:0);front.zPosition=2
        rear.texture=rearTexture;rear.size=CGSize(width:width*0.7,height:height*0.7);rear.anchorPoint=CGPoint(x:0.5,y:0);rear.zPosition=0
        frontBubbles.zPosition=2600;rearBubbles.zPosition=1
        addChild(rear);addChild(rearBubbles);addChild(front);addChild(frontBubbles)
        for index in 0..<3 {
            let node=SKNode(),radius=CGFloat(3.8+Double(index)*0.9)
            let circle=SKShapeNode(circleOfRadius:radius);circle.fillColor=UIColor(red:6.0/255,green:244.0/255,blue:1,alpha:1);circle.strokeColor=circle.fillColor;circle.lineWidth=1.5
            let highlight=SKShapeNode(circleOfRadius:radius*0.3);highlight.position=CGPoint(x:-radius*0.2,y:radius*0.2);highlight.fillColor=UIColor.white.withAlphaComponent(0.86);highlight.strokeColor = .clear
            node.addChild(circle);node.addChild(highlight);node.isHidden=true
            let back=index%2==1;(back ? rearBubbles:frontBubbles).addChild(node);bubbles.append(Bubble(node:node,rear:back))
        }
        admit();nextBubble=0.7+roll()*0.4;paint()
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    private func roll()->Double {let x=random();return x.isFinite ? min(1-Double.ulpOfOne,max(0,x)):0.5}
    @discardableResult
    private func admit()->Bool {
        guard !disposed else {return false}
        for offset in 0..<bubbles.count {
            let index=(cursor+offset)%bubbles.count
            guard !bubbles[index].active else {continue}
            cursor=(index+1)%bubbles.count
            var bubble=bubbles[index];bubble.active=true;bubble.age=0;bubble.duration=1.1+roll()*0.4
            bubble.startX=CGFloat(roll()-0.5)*width*(bubble.rear ? 0.7:1)*0.62
            bubble.direction=roll()<0.5 ? -1:1;bubble.distance=CGFloat(6+roll()*6);bubble.alpha=CGFloat(0.82+roll()*0.18);bubble.startScale=CGFloat(0.28+roll()*0.12)
            bubble.node.isHidden=false;bubbles[index]=bubble;emissions+=1;paintBubble(index);return true
        }
        return false
    }
    func tick(_ delta:TimeInterval,globalX:CGFloat,viewportCenter:CGFloat) {
        guard !disposed,assetReady else {return}
        if !facingCaptured {facing=globalX>viewportCenter ? 1:-1;facingCaptured=true}
        guard !dragging else {paint();return}
        let step=max(0,min(0.1,delta));elapsed+=step;rearElapsed+=step
        if elapsed>=NativeKantaIdleMotion.cycle {elapsed=elapsed.truncatingRemainder(dividingBy:NativeKantaIdleMotion.cycle);motion=NativeKantaIdleMotion(squash:roll()>=0.5)}
        for index in bubbles.indices where bubbles[index].active {
            bubbles[index].age+=step
            if bubbles[index].age>=bubbles[index].duration {bubbles[index].active=false;bubbles[index].node.isHidden=true}
            else {paintBubble(index)}
        }
        if pendingDouble>0 {pendingDouble-=step;if pendingDouble<=0 {admit()}}
        nextBubble-=step
        if nextBubble<=0 {
            let emitted=admit();if emitted && emissions%4==0 {pendingDouble=0.12}
            nextBubble=0.7+roll()*0.4
        }
        paint()
    }
    private func paintBubble(_ index:Int) {
        let b=bubbles[index],p=CGFloat(min(1,b.age/b.duration)),wave=sin(p * .pi*3)*b.distance*(1-p*0.3)
        b.node.position=CGPoint(x:b.startX+b.direction*wave,y:-6+height*0.552*p)
        let scale=p<0.42 ? b.startScale+(1.1-b.startScale)*(p/0.42):p<0.88 ? 1.1:1.1+(1.48-1.1)*((p-0.88)/0.12)
        b.node.xScale=scale;b.node.yScale=scale*0.96;b.node.alpha=p<0.9 ? b.alpha:b.alpha*(1-(p-0.9)/0.1)
    }
    private func paint() {
        let pose=dragging ? CGPoint(x:1,y:1):motion.sample(seconds:elapsed),oppx=max(0.8,2-pose.x),oppy=max(0.8,2-pose.y)
        front.position=CGPoint(x:8+correction,y:-height/2);front.xScale=pose.x;front.yScale=pose.y
        let reveal=rearSettled ? 1:NativeKantaIdleMotion.rearReveal(seconds:rearElapsed)
        rear.position=CGPoint(x:correction-width*0.4*oppx,y:-height/2+height*0.14);rear.xScale=oppx*reveal;rear.yScale=oppy*reveal;rear.zRotation = -facing*tilt
        rear.alpha=rearSettled || rearElapsed>=0.12 ? 1:0
        frontBubbles.position=CGPoint(x:8+correction,y:-height/2+height*0.75*pose.y-3)
        rearBubbles.position=CGPoint(x:correction-width*0.4*oppx,y:-height/2+height*0.14+height*0.7*0.75*oppy-3)
    }
    func setDragging(_ active:Bool) {
        guard !disposed,dragging != active else {return};dragging=active
        if active {rearSettled=true;for index in bubbles.indices {bubbles[index].active=false;bubbles[index].node.isHidden=true}}
        else {elapsed=0;pendingDouble=0;nextBubble=0.25}
        paint()
    }
    func dispose() {guard !disposed else {return};disposed=true;bubbles.removeAll();removeAllChildren();removeFromParent()}
}
