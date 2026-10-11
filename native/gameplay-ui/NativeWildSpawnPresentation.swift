import SpriteKit
import UIKit

/// Captured v9 carrier/pop/flight. The engine has already chosen the die and
/// destination; this finite owner cannot draw RNG or mutate a board cell.
@MainActor
final class NativeWildSpawnPresentation:SKNode {
    private weak var die:NativeDiceNode?
    private let target:CGPoint,baseScale:CGFloat
    private var completed=false
    private var completion:(()->Void)?
    init(die:NativeDiceNode,viewport:CGSize,tileSize:CGFloat,scale:CGFloat,arcade:Bool,textures:NativeBoardTextures,completion:@escaping()->Void) {
        self.die=die;target=die.position;baseScale=scale;self.completion=completion
        super.init();zPosition=2_100_000
        let sources=(1...20).map { index in arcade ? "assets/animations/crate/box-\(index<=10 ? index:21-index).png":"assets/animations/backpack/backpack-\(index).png" }
        let frames=sources.compactMap {textures.texture($0)}
        guard let first=frames.first else{finish();return}
        let carrier=SKSpriteNode(texture:first);carrier.anchorPoint=CGPoint(x:0.5,y:0.28);addChild(carrier)
        let back=CGPoint(x:viewport.width-tileSize*1.15,y:tileSize*1.35-32)
        let point=CGPoint(x:back.x-(arcade ? 24*scale:0),y:back.y+(arcade ? (70.8)*scale:0))
        let start=CGPoint(x:back.x-34*scale,y:point.y+96*scale+(arcade ? 48*scale:0)),launch=CGPoint(x:start.x,y:start.y+14*scale)
        let carrierScale=tileSize*2.15*1.15/(arcade ? 290:379)*(arcade ? 0.95:1)
        carrier.zRotation=CGFloat.random(in:4...5)*(.pi/180)*(Bool.random() ? 1:-1)
        die.removeAllActions();die.visual.removeAllActions();die.zPosition=2_100_001;die.alpha=0
        let side:CGFloat=target.x>=launch.x ? 1:-1
        let lift=max(54,min(112,abs(target.y-launch.y)*0.16+38))
        let control=CGPoint(x:launch.x+(target.x-launch.x)*0.48+side*CGFloat.random(in:10...22),y:launch.y+(target.y-launch.y)*0.22+lift)
        run(.sequence([.customAction(withDuration:1.405){[weak self,weak die,weak carrier] _,elapsed in
            guard let self,let die,let carrier else{return}
            let t=Double(elapsed),enter=min(1,t/0.28)
            carrier.position=CGPoint(x:point.x,y:point.y-tileSize*2.2*(1-JimiV9Motion.Ease.backOut(2.3).value(enter)))
            carrier.alpha=CGFloat(min(1,t/0.08));carrier.setScale(carrierScale)
            if t<0.13 {let p=JimiV9Motion.Ease.powerOut(2).value(t/0.13);carrier.xScale=carrierScale*(0.82+0.36*p);carrier.yScale=carrierScale*(0.82+0.02*p)}
            else if t<0.21 {let p=min(1,(t-0.11)/0.1);carrier.xScale=carrierScale*(1.18-0.28*p);carrier.yScale=carrierScale*(0.84+0.28*p)}
            else if t<0.3 {let p=min(1,(t-0.2)/0.1);carrier.xScale=carrierScale*(0.9+0.15*p);carrier.yScale=carrierScale*(1.12-0.15*p)}
            else if t<0.45 {let p=Double(NativeBoardMotion.Ease.elasticOut(1,0.72).sample(CGFloat((t-0.29)/0.16)));carrier.xScale=carrierScale*(1.05-0.05*p);carrier.yScale=carrierScale*(0.97+0.03*p)}
            let opening=max(0,t-0.28),frame:Int
            if opening<0.375 {frame=min(9,Int(opening/0.0375))}
            else if opening<0.575 {frame=9}
            else {frame=min(19,10+Int((opening-0.575)/0.0225))}
            carrier.texture=frames[min(frame,frames.count-1)]
            if t>1.08 {let p=min(1,(t-1.08)/0.24);carrier.alpha=CGFloat(1-p);carrier.position.y-=tileSize*2.2*p}
            guard t>=0.505 else{return}
            if t<0.865 {
                let p=(t-0.505)/0.36;die.alpha=CGFloat(min(1,p/0.28));die.position.x=start.x
                func cosine(_ p:Double)->Double{0.5-cos(min(1,max(0,p)) * .pi)*0.5}
                var y:CGFloat,sx:Double,sy:Double
                if p<0.34 {let q=cosine(p/0.34);y=start.y-16*scale+14*scale*q;sx=0.5+0.12*q;sy=0.5+0.08*q}
                else if p<0.78 {let q=JimiV9Motion.Ease.backOut(2.45).value((p-0.34)/0.44);y=start.y-2*scale+26*scale*q;sx=0.62+0.28*q;sy=0.58+0.24*q}
                else {let q=cosine((p-0.78)/0.22);y=start.y+24*scale-10*scale*q;sx=0.9-0.1*q;sy=0.82-0.02*q}
                die.position.y=y;die.xScale=scale*sx;die.yScale=scale*sy
            }else {
                let p=CGFloat(Self.power3InOut(min(1,(t-0.865)/0.54))),q=1-p
                die.alpha=1;die.position=CGPoint(x:q*q*launch.x+2*q*p*control.x+p*p*self.target.x,y:q*q*launch.y+2*q*p*control.y+p*p*self.target.y)
                let pulse=sin(p * .pi)*0.04,bounce=sin(p * .pi*7.5)*(1-p*0.25)*0.075,squash=sin(p * .pi*7.5 + .pi*0.5)*(1-p*0.35)*0.03
                let spawn=min(1,p/0.34),pop=max(0,1-spawn)*0.1,spawnBounce=sin(spawn * .pi*2.25)*max(0,1-spawn)*0.05
                die.xScale=scale*(1+pop+spawnBounce+pulse+bounce+squash);die.yScale=scale*(1+pop*0.68-spawnBounce*0.5+pulse-bounce*0.45-squash*0.55)
                die.visual.zRotation = -side*sin(p * .pi)*0.18
            }
        },.run{[weak self] in self?.finish()}]),withKey:"v9-wild-drop")
    }
    required init?(coder:NSCoder){fatalError("native wild presentation")}
    private static func power3InOut(_ p:Double)->Double {p<0.5 ? 8*pow(p,4):1-pow(-2*p+2,4)/2}
    func finish(){guard !completed else{return};completed=true;removeAllActions();die?.position=target;die?.alpha=1;die?.setScale(baseScale);die?.visual.zRotation=0;die?.zPosition=0;let done=completion;completion=nil;removeAllChildren();removeFromParent();done?()}
}
