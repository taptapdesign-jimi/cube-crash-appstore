import SpriteKit
import UIKit

/// Source DOM Round pill is Arcade-only and sits outside the shaken Pixi HUD.
/// SpriteKit owns these finite actions through the visible board's lifecycle.
@MainActor
final class NativeRoundIndicator:SKNode {
    private let painted=SKNode(),content=SKNode(),label=SKLabelNode(),pill=SKShapeNode(),lines=SKShapeNode()
    private let lineHeight:CGFloat
    private var round:Int?
    init(font:UIFont) {
        lineHeight=font.lineHeight
        super.init()
        name="native-game-round-indicator";zPosition=10001
        label.fontName=font.fontName;label.fontSize=18;label.verticalAlignmentMode = .center
        label.fontColor=UIColor(red:173/255,green:135/255,blue:117/255,alpha:1)
        pill.fillColor=UIColor(red:243/255,green:230/255,blue:220/255,alpha:0.52)
        pill.strokeColor=UIColor(red:232/255,green:211/255,blue:200/255,alpha:1);pill.lineWidth=1
        lines.strokeColor=UIColor(red:237/255,green:224/255,blue:213/255,alpha:1);lines.lineWidth=2
        addChild(painted);painted.addChild(lines);painted.addChild(content);content.addChild(pill);content.addChild(label)
    }
    required init?(coder:NSCoder){fatalError("Use preserved source font")}
    func synchronize(round:Int,arcade:Bool,viewport:CGSize,alpha:CGFloat) {
        isHidden = !arcade
        guard arcade else {painted.removeAllActions();content.removeAllActions();return}
        let changed=self.round != nil && self.round != round;self.round=round
        label.text=String(format:"Round %02d",round)
        let width=label.frame.width+122,height=lineHeight+10
        pill.path=CGPath(roundedRect:CGRect(x:-width/2,y:-height/2,width:width,height:height),cornerWidth:min(32,height/2),cornerHeight:min(32,height/2),transform:nil)
        let path=CGMutablePath(),edge=viewport.width/2-23
        if edge>width/2+24 {
            path.move(to:CGPoint(x:-edge,y:2));path.addLine(to:CGPoint(x:-width/2-24,y:2))
            path.move(to:CGPoint(x:width/2+24,y:2));path.addLine(to:CGPoint(x:edge,y:2))
        }
        lines.path=path;self.alpha=alpha
        if changed,painted.action(forKey:"round-enter")==nil {
            painted.removeAllActions();painted.position = .zero;painted.alpha=1
            content.removeAllActions();content.setScale(0.88);content.position.y = -6
            content.run(.sequence([
                .group([NativeBoardMotion.scale(from:CGPoint(x:0.88,y:0.88),to:CGPoint(x:1.13,y:1.13),duration:0.2,ease:.backOut(2.2)),
                        NativeBoardMotion.move(from:CGPoint(x:0,y:-6),to:CGPoint(x:0,y:4),duration:0.2,ease:.backOut(2.2))]),
                .group([NativeBoardMotion.scale(from:CGPoint(x:1.13,y:1.13),to:CGPoint(x:1,y:1),duration:0.16,ease:.power2Out),
                        NativeBoardMotion.move(from:CGPoint(x:0,y:4),to:.zero,duration:0.16,ease:.power2Out)])
            ]),withKey:"round-value")
        }
    }
    func enter(animated:Bool) {
        guard !isHidden else{return}
        if !animated,hasAnimatedPresentation {return}
        painted.removeAllActions()
        content.removeAllActions();content.position = .zero;content.setScale(1)
        guard animated else {painted.position = .zero;painted.alpha=1;return}
        painted.position.y = -72;painted.alpha=0
        painted.run(.customAction(withDuration:0.8){[weak self] _,time in
            guard let self else{return};let t=min(1,max(0,Double(time)/0.8))
            let p=Double(NativeBoardMotion.Ease.elasticOut(1,0.6).sample(CGFloat(t)))
            self.painted.position.y=CGFloat(-72*(1-p));self.painted.alpha=CGFloat(min(1,max(0,p)))
        },withKey:"round-enter")
    }
    func exit() {
        guard !isHidden else{return};painted.removeAllActions()
        let start=painted.position.y,alpha=painted.alpha
        painted.run(.customAction(withDuration:0.3){[weak self] _,time in
            guard let self else{return};let t=min(1,max(0,CGFloat(time)/0.3)),p=t*t*t
            self.painted.position.y=start+(-72-start)*p;self.painted.alpha=alpha*(1-p)
        },withKey:"round-exit")
    }
    var hasAnimatedPresentation:Bool {painted.hasActions() || content.hasActions()}
    func cancelExit(){painted.removeAllActions();content.removeAllActions();content.position = .zero;content.setScale(1);painted.position = .zero;painted.alpha=1}
}
