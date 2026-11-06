import UIKit
import SpriteKit

/// Native HUD Close keeps the source hit area and modal-style rounded corners.
/// Stage uses typographic advance, not ink bounds.
@MainActor
final class NativeHUDCloseNode:SKNode {
    static let radius:CGFloat=22
    let stageAdvance:CGFloat
    let ring:SKShapeNode
    let icon:SKSpriteNode
    var onTapFinished:(()->Void)?
    var isTapAnimating:Bool {action(forKey:"hud-tap-bounce") != nil}
    private var visualScale:CGFloat=1
    private let iconBaseSize:CGSize
    private var tapBase:CGPoint?
    private var tapPosition:CGPoint?
    init(texture:SKTexture?,stageFont:UIFont) {
        stageAdvance=("Stage" as NSString).size(withAttributes:[.font:stageFont]).width
        let side=Self.radius*2,corner=side*16/52
        let outline=UIBezierPath(roundedRect:CGRect(x:-Self.radius,y:-Self.radius,width:side,height:side),cornerRadius:corner).cgPath
        let path=outline.copy(dashingWithPhase:0,lengths:[6,6])
        ring=SKShapeNode(path:path);ring.strokeColor=UIColor(red:232.0/255,green:212.0/255,blue:199.0/255,alpha:1)
        ring.fillColor = .clear;ring.lineWidth=2;ring.lineCap = .butt;ring.lineJoin = .miter;ring.miterLimit=10;ring.isAntialiased=true
        icon=SKSpriteNode(texture:texture)
        let dimensions=texture?.size() ?? CGSize(width:24,height:24),scale=24/max(1,max(dimensions.width,dimensions.height))
        iconBaseSize=CGSize(width:dimensions.width*scale,height:dimensions.height*scale)
        icon.size=iconBaseSize;icon.alpha=0.8
        super.init();name="native-game-close";zPosition=10;addChild(ring);addChild(icon)
    }
    required init?(coder:NSCoder){fatalError("Use preserved close artwork")}
    func layout(valueRowY:CGFloat,visualScale:CGFloat=1) {
        if self.visualScale != visualScale {
            self.visualScale=visualScale;ring.setScale(visualScale)
            icon.size=CGSize(width:iconBaseSize.width*visualScale,height:iconBaseSize.height*visualScale)
        }
        position=CGPoint(x:24+stageAdvance/2,y:valueRowY)
    }
    func playTapBounce() {
        // Repeat starts from the first captured base, as the original owner.
        let base=tapBase ?? CGPoint(x:xScale,y:yScale);tapBase=base
        let origin=tapPosition ?? position;tapPosition=origin
        removeAction(forKey:"hud-tap-bounce");xScale=base.x;yScale=base.y
        run(.sequence([.customAction(withDuration:NativeHUDTapMotion.duration) { node,elapsed in
            let pose=NativeHUDTapMotion.pose(at:Double(elapsed))
            node.xScale=base.x*pose.x;node.yScale=base.y*pose.y;node.position.y=origin.y-pose.offset
        },.run { [weak self] in self?.xScale=base.x;self?.yScale=base.y;self?.position=origin;self?.tapPosition=nil;self?.tapBase=nil;self?.onTapFinished?() }]),withKey:"hud-tap-bounce")
    }
    func cancelTapBounce() {
        removeAction(forKey:"hud-tap-bounce")
        if let base=tapBase {xScale=base.x;yScale=base.y}
        if let origin=tapPosition{position=origin};tapPosition=nil;tapBase=nil
    }
    var hitRect:CGRect {
        let radius=Self.radius*visualScale
        let circle=CGRect(x:position.x-radius,y:position.y-radius,width:radius*2,height:radius*2)
        if visualScale != 1 {return circle.insetBy(dx:-8,dy:-8)}
        let sourceLongWrapper=CGRect(x:0,y:position.y-32,width:104,height:68)
        return circle.union(sourceLongWrapper)
    }
}
