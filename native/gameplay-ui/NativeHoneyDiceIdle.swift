import SpriteKit

/// Three live source sprites reuse the board ticker and its resource lease.
@MainActor
final class NativeHoneyDiceIdle:SKNode {
    private let behind=SKNode(),front=SKNode()
    private var sprites:[SKSpriteNode]=[],images:[SKTexture]=[]
    private var runtime:NativeHoneyIdleMotion.Runtime
    private let random:()->Double
    private(set) var assetReady=false
    private var elapsed=0.0,disposed=false
    var hasActiveMotion:Bool {!disposed && assetReady && elapsed<3600}
    init(textures:NativeBoardTextures,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.random=random;runtime=NativeHoneyIdleMotion.Runtime(profiles:NativeHoneyIdleMotion.make(random:random))
        super.init();name="native-honey-idle-orbit"
        behind.zPosition = -2;front.zPosition=12;addChild(behind);addChild(front)
        images=(1...7).compactMap {textures.texture("assets/shop/honey/bee\($0).png")}
        assetReady=images.count==7
        guard assetReady else {images.removeAll();return}
        for index in 0..<3 {
            let sprite=SKSpriteNode(texture:images[index]);sprite.name="honey-idle-bee-\(index+1)"
            let size=CGFloat(128*0.435456*runtime.profiles[index].sizeScale);sprite.size=CGSize(width:size,height:size)
            front.addChild(sprite);sprites.append(sprite)
        }
        _=runtime.paint(seconds:0,force:true,random:random)
        // Original cached-resource recovery commits once on its initial clock.
        _=runtime.paint(seconds:0,force:true,random:random);apply()
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func tick(_ delta:Double) {guard hasActiveMotion else {return};elapsed=min(3600,elapsed+max(0,delta));if runtime.paint(seconds:elapsed,random:random) {apply()}}
    func setDragging(_ value:Bool) {guard !disposed else {return};runtime.setDragging(value)}
    func updateDrag(offset:CGPoint,velocity:CGPoint) {
        guard !disposed,assetReady else {return}
        runtime.updateDrag(offsetX:Double(offset.x),offsetY:Double(offset.y),velocityX:Double(velocity.x),velocityY:Double(velocity.y));apply()
    }
    private func apply() {
        guard !disposed,assetReady else {return}
        for index in sprites.indices {
            let pose=runtime.bees[index].pose,sprite=sprites[index],layer=pose.front ? front:behind
            if sprite.parent !== layer {sprite.removeFromParent();layer.addChild(sprite)}
            sprite.texture=images[pose.asset-1]
            sprite.position=CGPoint(x:pose.x,y:-pose.y);sprite.alpha=pose.alpha;sprite.setScale(pose.scale)
        }
    }
    func dispose() {guard !disposed else {return};disposed=true;sprites.removeAll();images.removeAll();removeAllChildren();removeFromParent()}
}
