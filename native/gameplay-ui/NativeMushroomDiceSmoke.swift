import SpriteKit

/// The three source smoke puffs reuse the board ticker and pause during pickup.
@MainActor
final class NativeMushroomDiceSmoke:SKNode {
    struct Pose {let x,y,alpha,scaleX,scaleY:CGFloat}
    static func sample(index:Int,seconds:Double)->Pose {
        let baseX=CGFloat(index-1)*8,baseY=11+CGFloat(index)*1.5,drift=CGFloat(index-1)*4+(index==1 ? 2:0),age=seconds-Double(index)*0.24
        guard age>=0 else {return Pose(x:baseX,y:baseY,alpha:0,scaleX:0.35,scaleY:0.35)}
        let local=age.truncatingRemainder(dividingBy:1.36)
        if local<0.22 {
            let p=CGFloat(1-pow(1-local/0.22,2))
            return Pose(x:baseX+drift*p,y:baseY-5*p,alpha:0.30*p,scaleX:0.35+(0.82-0.35)*p,scaleY:0.35+(0.66-0.35)*p)
        }
        let p=sin(CGFloat(min(1,(local-0.22)/0.48)) * .pi/2)
        return Pose(x:baseX+drift*(1+0.5*p),y:baseY-5-6*p,alpha:0.30*(1-p),scaleX:0.82+(1.16-0.82)*p,scaleY:0.66+(0.90-0.66)*p)
    }
    private var puffs:[SKShapeNode]=[],seconds:Double=0,dragging=false,disposed=false
    override init() {
        super.init();name="native-mushroom-local-smoke"
        let colors:[UInt32]=[0xFFF1E5,0xFFE1D2,0xF7C8B7]
        for index in 0..<3 {
            let radius=CGFloat(3.4+Double(index)*0.75),path=CGMutablePath()
            for (x,y,r) in [(-radius*0.7,CGFloat.zero,radius*0.72),(CGFloat.zero,radius*0.28,radius),(radius*0.78,-radius*0.04,radius*0.66)] {path.addEllipse(in:CGRect(x:x-r,y:y-r,width:r*2,height:r*2))}
            let puff=SKShapeNode(path:path),hex=colors[index]
            puff.fillColor=UIColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1);puff.strokeColor = .clear
            addChild(puff);puffs.append(puff)
        }
        paint()
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func tick(_ delta:Double) {guard !disposed,!dragging else {return};seconds+=max(0,delta);paint()}
    func setDragging(_ value:Bool) {guard !disposed else {return};dragging=value;isHidden=value}
    private func paint() {
        for index in puffs.indices {let pose=Self.sample(index:index,seconds:seconds),puff=puffs[index];puff.position=CGPoint(x:pose.x,y:-pose.y);puff.alpha=pose.alpha;puff.xScale=pose.scaleX;puff.yScale=pose.scaleY}
    }
    func dispose() {guard !disposed else {return};disposed=true;removeAllActions();removeAllChildren();removeFromParent();puffs.removeAll()}
}
