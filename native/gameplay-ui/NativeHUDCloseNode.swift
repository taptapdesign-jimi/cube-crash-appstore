import UIKit
import SpriteKit

/// hud-helpers.ts live circle owner; the later unstroked X wrapper only
/// contributes its long hit area. Stage uses typographic advance, not ink bounds.
@MainActor
final class NativeHUDCloseNode:SKNode {
    static let radius:CGFloat=22
    let stageAdvance:CGFloat
    let ring:SKShapeNode
    let icon:SKSpriteNode
    init(texture:SKTexture?,stageFont:UIFont) {
        stageAdvance=("Stage" as NSString).size(withAttributes:[.font:stageFont]).width
        let path=CGMutablePath(),circumference=2*CGFloat.pi*Self.radius
        let segments=Int(floor(circumference/12))
        for i in 0..<segments {
            let start=CGFloat(i)*12/Self.radius,end=start+6/Self.radius
            // CSS/Pixi y grows down; reflect the exact original arcs for SpriteKit.
            path.move(to:CGPoint(x:cos(start)*Self.radius,y:-sin(start)*Self.radius))
            path.addArc(center:.zero,radius:Self.radius,startAngle:-start,endAngle:-end,clockwise:true)
        }
        ring=SKShapeNode(path:path);ring.strokeColor=UIColor(red:232.0/255,green:212.0/255,blue:199.0/255,alpha:1)
        ring.fillColor = .clear;ring.lineWidth=2;ring.lineCap = .butt;ring.lineJoin = .miter;ring.miterLimit=10;ring.isAntialiased=true
        icon=SKSpriteNode(texture:texture)
        let dimensions=texture?.size() ?? CGSize(width:24,height:24),scale=24/max(1,max(dimensions.width,dimensions.height))
        icon.size=CGSize(width:dimensions.width*scale,height:dimensions.height*scale);icon.alpha=0.8
        super.init();name="native-game-close";zPosition=10;addChild(ring);addChild(icon)
    }
    required init?(coder:NSCoder){fatalError("Use preserved close artwork")}
    func layout(valueRowY:CGFloat) {
        position=CGPoint(x:24+stageAdvance/2,y:valueRowY)
    }
    var hitRect:CGRect {
        let circle=CGRect(x:position.x-22,y:position.y-22,width:44,height:44)
        let sourceLongWrapper=CGRect(x:0,y:position.y-32,width:104,height:68)
        return circle.union(sourceLongWrapper)
    }
}
