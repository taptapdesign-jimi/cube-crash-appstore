import SpriteKit

/// Nine fixed source particles, below original artwork, sampled by the board clock.
@MainActor
final class NativeSpaceshipDiceIdle:SKNode {
    private var particles:[SKNode]=[]
    override init() {
        super.init();name="native-spaceship-engine"
        for index in 0..<9 {
            let container=SKNode(),radius=CGFloat(1.45+Double(index%3)*0.55)
            for (r,hex,alpha) in [(radius*1.9,UInt32(0x4DEBFF),CGFloat(0.2)),(radius,index%2==0 ? UInt32(0x77F4FF):UInt32(0x35CFEA),CGFloat(1))] {
                let shape=SKShapeNode(circleOfRadius:r)
                shape.fillColor=UIColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:alpha);shape.strokeColor = .clear
                container.addChild(shape)
            }
            addChild(container);particles.append(container)
        }
        paint(seconds:0)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func paint(seconds:Double) {
        for index in particles.indices {let pose=NativeSpaceshipIdleMotion.engine(index:index,seconds:seconds),node=particles[index];node.position=CGPoint(x:pose.x,y:-pose.y);node.alpha=pose.alpha;node.setScale(pose.scale)}
    }
    func dispose() {particles.removeAll();removeAllChildren();removeFromParent()}
}
