import UIKit
import SpriteKit

/// Decorative main-phase source layers share the actual gameplay canvas and
/// its clock. Core and Scene retain absorb, spawn, input and endgame ownership.
@MainActor
final class NativeRegularSixSpritePresentation:SKNode {
    enum AdmissionError:Error {case missingSourceFont}
    struct ShakeReceipt {let canvas,indicator,bottomDecor:CGPoint}
    var onShake:((ShakeReceipt,UInt64)->Void)?
    var onFinished:((Bool)->Void)?
    let generation:UInt64
    let shards:NativeRegularSixShardPlan,smoke:NativeRegularSixSmokePlan,shake:NativeRegularSixShakePlan
    let shardLayer=SKNode(),smokeLayer=SKNode(),multiplierLayer=SKNode()
    var hasActiveClock:Bool {action(forKey:Self.clockKey) != nil}
    private static let clockKey="source-regular-six-finite"
    private let current:(UInt64)->Bool,multiplier=NativeRegularSixMultiplierMotion()
    private var shardNodes:[SKShapeNode]=[],puffNodes:[SKShapeNode]=[]
    private let halo=SKShapeNode()
    private var started=false,disposed=false,suspended=false,finishedPaint=false
    init(origin:CGPoint,tileSize:CGFloat,destinationDepth:CGFloat,combinedDepth:Int,generation:UInt64,reduced:Bool,hotFactor:Double,patternIndex:Int,initialShake:ShakeReceipt = .init(canvas:.zero,indicator:.zero,bottomDecor:.zero),isCurrent:@escaping(UInt64)->Bool,random:()->Double) throws {
        guard let font=UIFont(name:"Arial-BoldMT",size:33) else{throw AdmissionError.missingSourceFont}
        self.generation=generation;current=isCurrent
        shards=NativeRegularSixShardPlan(patternIndex:patternIndex,reduced:reduced,random:random)
        smoke=NativeRegularSixSmokePlan(tileSize:128,reduced:reduced,hotFactor:hotFactor,random:random)
        shake=NativeRegularSixShakePlan(multiplier:combinedDepth,initialCanvas:.init(x:initialShake.canvas.x,y:initialShake.canvas.y),initialIndicator:.init(x:initialShake.indicator.x,y:initialShake.indicator.y),initialBottomDecor:.init(x:initialShake.bottomDecor.x,y:initialShake.bottomDecor.y),random:random)
        super.init();position=origin;setScale(tileSize/128);zPosition=0
        shardLayer.zPosition=destinationDepth;smokeLayer.zPosition=9990;multiplierLayer.zPosition=10000
        addChild(shardLayer);addChild(smokeLayer);addChild(multiplierLayer)
        halo.path=CGPath(ellipseIn:CGRect(x:-smoke.haloRadius,y:-smoke.haloRadius,width:smoke.haloRadius*2,height:smoke.haloRadius*2),transform:nil)
        halo.fillColor = .white;halo.strokeColor = .clear;smokeLayer.addChild(halo)
        for puff in smoke.puffs {
            let item=SKShapeNode(ellipseOf:CGSize(width:2*puff.radiusX,height:2*puff.radiusY))
            item.fillColor = .white;item.strokeColor = .clear;item.setScale(puff.scale);item.zRotation = -puff.rotation
            smokeLayer.addChild(item);puffNodes.append(item)
        }
        for shard in shards.shards {
            let path=CGMutablePath()
            for index in stride(from:0,to:shard.points.count,by:2) {
                let point=CGPoint(x:shard.points[index],y:-shard.points[index+1]);if index==0 {path.move(to:point)}else{path.addLine(to:point)}
            }
            path.closeSubpath();let item=SKShapeNode(path:path)
            item.fillColor=UIColor(red:212/255,green:165/255,blue:132/255,alpha:1);item.strokeColor = .clear;item.zRotation = -shard.rotation
            shardLayer.addChild(item);shardNodes.append(item)
        }
        let radius=128.0*0.28,disk=SKShapeNode(circleOfRadius:radius)
        disk.fillColor=UIColor(red:171/255,green:128/255,blue:110/255,alpha:1);disk.strokeColor = .clear
        multiplierLayer.addChild(disk)
        let ring=SKShapeNode(circleOfRadius:radius);ring.fillColor = .clear;ring.strokeColor=UIColor(red:250/255,green:237/255,blue:224/255,alpha:0.9);ring.lineWidth=1.4
        let glow=SKShapeNode(circleOfRadius:radius*1.08);glow.fillColor = .clear;glow.strokeColor=UIColor(red:250/255,green:237/255,blue:224/255,alpha:0.2);glow.lineWidth=3
        multiplierLayer.addChild(glow);multiplierLayer.addChild(ring)
        let text=SKLabelNode();text.attributedText=NSAttributedString(string:"×\(combinedDepth)",attributes:[.font:font,.foregroundColor:UIColor.white,.strokeColor:UIColor(red:143/255,green:105/255,blue:89/255,alpha:1),.strokeWidth:-100*2/33])
        text.horizontalAlignmentMode = .center;text.verticalAlignmentMode = .center;multiplierLayer.addChild(text)
        paint(seconds:0)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func mount(in canvas:SKNode) {
        guard !started,!disposed,current(generation) else{return}
        started=true;canvas.addChild(self);paint(seconds:0)
        let paintAction=SKAction.customAction(withDuration:1){[weak self] _,time in MainActor.assumeIsolated {self?.paint(seconds:Double(time))}}
        run(.sequence([paintAction,.run{[weak self] in MainActor.assumeIsolated{self?.finish(true)}}]),withKey:Self.clockKey)
        isPaused=suspended
    }
    func setSuspended(_ value:Bool) {suspended=value;isPaused=value}
    func paint(seconds:Double) {
        guard !disposed,!suspended,!finishedPaint else{return}
        guard current(generation) else{finish(false);return}
        for(index,plan)in shards.shards.enumerated(){let pose=plan.sample(seconds:seconds);shardNodes[index].position=CGPoint(x:pose.x,y:-pose.y);shardNodes[index].alpha=pose.alpha}
        for(index,plan)in smoke.puffs.enumerated(){let pose=plan.sample(seconds:seconds);puffNodes[index].position=CGPoint(x:pose.x,y:-pose.y);puffNodes[index].alpha=pose.alpha}
        halo.alpha=smoke.haloAlpha(seconds:seconds)
        let pose=multiplier.sample(seconds:seconds);multiplierLayer.alpha=pose.alpha;multiplierLayer.setScale(pose.scale);multiplierLayer.zRotation = -pose.rotation
        let p=shake.sample(seconds:seconds),indicator=shake.indicator(seconds:seconds),bottom=shake.bottomDecor(seconds:seconds)
        onShake?(.init(canvas:CGPoint(x:p.x,y:p.y),indicator:CGPoint(x:indicator.x,y:indicator.y),bottomDecor:CGPoint(x:bottom.x,y:bottom.y)),generation)
        if seconds>=0.9 {multiplierLayer.isHidden=true}
        if seconds>=1 {finishedPaint=true}
    }
    private func finish(_ success:Bool) {
        guard !disposed else{return};disposed=true
        removeAction(forKey:Self.clockKey);removeFromParent()
        if current(generation){onShake?(.init(canvas:.zero,indicator:.zero,bottomDecor:.zero),generation)}
        let receipt=onFinished;onFinished=nil;onShake=nil;receipt?(success && current(generation))
    }
    /// A newer source screenShake replaces only these surface tweens. Original
    /// accepted shard/smoke/multiplier tails keep their own finite lease.
    func detachShake(){onShake=nil}
    func dispose(){finish(false)}
}
