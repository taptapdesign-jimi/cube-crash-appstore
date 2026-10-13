import SpriteKit
import UIKit

/// PRIVATE caller bridge: mount container in actual source-equivalent HUD root.
/// All animation delivery comes from the supplied app service; wall emission
/// uses its separate captured app timeout registry. No assets or common smoke.
@MainActor final class NativeWildMeterHUDPresentation {
    let container=SKNode(),background=SKShapeNode(),fillSpatialLayer=SKNode(),fillBounceLayer=SKNode(),fill=SKShapeNode()
    private final class SmokeResources:NativeWildMeterSmokeResources {
        weak var hudStage:SKNode?
        let sourceToNative:(CGPoint)->CGPoint
        var nodes:[UInt64:SKShapeNode]=[:]
        init(stage:SKNode,sourceToNative:@escaping(CGPoint)->CGPoint){hudStage=stage;self.sourceToNative=sourceToNative}
        func create(id:UInt64,x:Double,y:Double,radius:Double){
            guard let hudStage else{return}
            let bubble=SKShapeNode(circleOfRadius:CGFloat(radius))
            bubble.name="wild-meter-smoke";bubble.fillColor=SKColor(red:248/255,green:107/255,blue:60/255,alpha:0.5)
            bubble.strokeColor = .clear;bubble.lineWidth=0;bubble.alpha=1;bubble.zPosition=2000
            bubble.position=sourceToNative(.init(x:x,y:y));nodes[id]=bubble;hudStage.addChild(bubble)
        }
        func paint(id:UInt64,_ pose:NativeWildMeterSmokePlan.Pose){
            guard let bubble=nodes[id] else{return}
            bubble.position=sourceToNative(.init(x:pose.x,y:pose.y));bubble.alpha=CGFloat(pose.alpha)
        }
        func destroy(id:UInt64){nodes.removeValue(forKey:id)?.removeFromParent()}
    }
    private let stage:SKNode,sourceToNative:(CGPoint)->CGPoint,nativeToSource:(CGPoint)->CGPoint
    private let current:()->Bool
    private let driver:NativeWildMeterSourceDriver
    private let wall:NativeWildMeterSmokeWallDriver
    private let smokeResources:SmokeResources
    private var owner:NativeWildMeterHUDOwner!
    private var smoke:NativeWildMeterSmokeOwner!
    private var closed=false
    private var tutorialPulseActive=false,tutorialPulseEpoch:UInt64=0
    private var tutorialPulseCancel:(()->Void)?
    private var tutorialPulseBase:(CGPoint,CGFloat,CGFloat)?
    private var tutorialFillBase:(CGPoint,CGFloat,CGFloat)?
    private var tutorialBubbleStep=0
    var tutorialPulseRunning:Bool{tutorialPulseActive}
    static func tutorialPulseScale(_ seconds:Double)->Double {
        let t=max(0,min(0.6,seconds))
        if t<=0.3 {return 1+0.04*JimiV9Motion.Ease.backOut(1.7).value(t/0.3)}
        return 1.04-0.04*JimiV9Motion.Ease.backOut(1.7).value((t-0.3)/0.3)
    }
    func startTutorialPulse() {
        guard !closed,!tutorialPulseActive,current(),!UIAccessibility.isReduceMotionEnabled else{return}
        tutorialPulseActive=true;tutorialPulseEpoch &+= 1
        tutorialPulseBase=(container.position,container.xScale,container.yScale)
        tutorialFillBase=(fill.position,fill.xScale,fill.yScale)
        runTutorialPulse(tutorialPulseEpoch)
    }
    private func runTutorialPulse(_ epoch:UInt64) {
        guard !closed,tutorialPulseActive,tutorialPulseEpoch==epoch,current() else{return}
        tutorialBubbleStep=0
        tutorialPulseCancel=driver.start(duration:0.6,paint:{[weak self] seconds in
            guard let self,!self.closed,self.tutorialPulseActive,self.tutorialPulseEpoch==epoch,self.current(),self.tutorialPulseBase != nil else{return}
            guard let base=self.tutorialPulseBase else{return}
            let scale=CGFloat(Self.tutorialPulseScale(seconds))
            self.container.xScale=base.1*scale;self.container.yScale=base.2*scale
            let center=self.background.path?.boundingBox.midX ?? 0
            self.container.position=CGPoint(x:base.0.x-center*base.1*(scale-1),y:base.0.y+5*base.2*(scale-1))
            if let fillBase=self.tutorialFillBase {
                let spring=(scale-1)/0.04,extra=1+0.1*spring,stretch=(1+0.4*spring)*extra
                self.fill.xScale=fillBase.1*stretch;self.fill.yScale=fillBase.2*extra
                self.fill.position=CGPoint(x:fillBase.0.x+CGFloat(self.owner.left)*fillBase.1*(1-stretch),y:fillBase.0.y+5*fillBase.2*(extra-1))
            }
            let step=min(2,Int((seconds+1e-9)/0.3))
            if step>self.tutorialBubbleStep {
                self.tutorialBubbleStep=step;self.smoke.emitTutorialBubble()
            }
        },completed:{[weak self] in
            guard let self,self.tutorialPulseEpoch==epoch else{return};self.tutorialPulseCancel=nil
            self.runTutorialPulse(epoch)
        },interrupted:{[weak self] in guard let self,self.tutorialPulseEpoch==epoch else{return};self.stopTutorialPulse()})
        if tutorialPulseCancel==nil{stopTutorialPulse()}
    }
    func stopTutorialPulse() {
        guard tutorialPulseActive || tutorialPulseBase != nil else{return}
        tutorialPulseActive=false;tutorialPulseEpoch &+= 1
        let cancel=tutorialPulseCancel;tutorialPulseCancel=nil;cancel?()
        if let base=tutorialPulseBase {container.position=base.0;container.xScale=base.1;container.yScale=base.2}
        if let base=tutorialFillBase {fill.position=base.0;fill.xScale=base.1;fill.yScale=base.2}
        tutorialPulseBase=nil;tutorialFillBase=nil;tutorialBubbleStep=0
        smoke.stopSmoke()
    }
    init(hudStage:SKNode,service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,
         generation:UInt64,maximum:Double,isPad:Bool,sourceOrigin:CGPoint,
         sourceToNative:@escaping(CGPoint)->CGPoint,nativeToSource:@escaping(CGPoint)->CGPoint,
         smokeDisabled:@escaping()->Bool,current:@escaping()->Bool,visualRandom:@escaping()->Double){
        stage=hudStage;self.sourceToNative=sourceToNative;self.nativeToSource=nativeToSource;self.current=current
        driver=NativeWildMeterSourceDriver(service:service)
        wall=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:generation)
        smokeResources=SmokeResources(stage:hudStage,sourceToNative:sourceToNative)
        container.name="wildLoader";container.zPosition=1000;container.position=sourceToNative(sourceOrigin)
        background.zPosition=0;background.strokeColor = .clear;background.lineWidth=0
        background.fillColor=SKColor(red:234/255,green:223/255,blue:214/255,alpha:1)
        fillSpatialLayer.name="wildMeterFillSpatialLayer";fillSpatialLayer.zPosition=5000
        fillBounceLayer.name="wildMeterFillBounceLayer";fill.zPosition=0;fill.strokeColor = .clear;fill.lineWidth=0
        fill.fillColor=SKColor(red:231/255,green:116/255,blue:74/255,alpha:1)
        fillBounceLayer.addChild(fill);fillSpatialLayer.addChild(fillBounceLayer);container.addChild(background);container.addChild(fillSpatialLayer)
        hudStage.addChild(container)
        smoke=NativeWildMeterSmokeOwner(driver:driver,wall:wall,resources:smokeResources,geometry:{[weak self] in
            guard let self else{return .init(x:0,y:0,left:0,width:0,fillAlive:false,parentAttached:false)}
            // Read actual painted transform, NOT logical meter/model geometry.
            if self.tutorialPulseActive,let owner=self.owner {
                let left=self.nativeToSource(self.fill.convert(CGPoint(x:owner.left,y:0),to:self.stage))
                let right=self.nativeToSource(self.fill.convert(CGPoint(x:owner.left+owner.width,y:0),to:self.stage))
                return .init(x:Double(left.x),y:Double(left.y),left:0,width:Double(right.x-left.x),fillAlive:!self.closed,parentAttached:self.container.parent === self.stage,maximum:Double(self.background.path?.boundingBox.width ?? 0))
            }
            let source=self.nativeToSource(self.container.position)
            return .init(x:Double(source.x),y:Double(source.y),left:self.owner?.left ?? 0,width:self.owner?.width ?? 0,fillAlive:!self.closed,parentAttached:self.container.parent === self.stage,maximum:Double(self.background.path?.boundingBox.width ?? 0))
        },disabled:smokeDisabled,current:{[weak self] in guard let self else{return false};return !self.closed && self.current()},random:visualRandom)
        owner=NativeWildMeterHUDOwner(driver:driver,maximum:maximum,initialWidth:0,isPad:isPad,draw:{[weak self] pose in
            self?.fill.path=Self.barPath(left:pose.left,width:pose.width)
        },drawBounce:{[weak self] y in self?.fillBounceLayer.position.y = -CGFloat(y)},stopSmoke:{[weak self] in self?.smoke.stopSmoke()},stopEmission:{[weak self] in self?.smoke.stopEmission()},startSmoke:{[weak self] in self?.smoke.startEmission()})
        resize(maximum:maximum,sourceOrigin:sourceOrigin)
    }
    private static func barPath(left:Double,width:Double)->CGPath {
        // Source rectangle occupies y=0...10; SpriteKit source-Y projection is
        // local y=0...-10. Zero width remains empty, with no invented min pixel.
        guard width>0 else{return CGMutablePath()}
        return CGPath(roundedRect:CGRect(x:left,y:-10,width:width,height:10),cornerWidth:5,cornerHeight:5,transform:nil)
    }
    var activeSmokeCount:Int{smoke.activeBubbleCount}
    var fillPose:NativeWildMeterConsumptionPlan.Pose{.init(left:owner.left,width:owner.width)}
    var consumeActive:Bool{owner.consumeActive}
    func setProgress(_ ratio:Double,animated:Bool){guard !closed else{return};owner.setProgress(ratio,animated:animated)}
    func consume(_ ratio:Double,reducedMotion:Bool){guard !closed else{return};owner.consume(ratio,reducedMotion:reducedMotion)}
    func resize(maximum:Double,sourceOrigin:CGPoint){
        guard !closed else{return};container.position=sourceToNative(sourceOrigin)
        if let base=tutorialPulseBase {tutorialPulseBase=(container.position,base.1,base.2)}
        owner.setWidth(maximum){[weak self] width in self?.background.path=Self.barPath(left:0,width:width)}
    }
    func stopSmoke(){smoke.stopSmoke()}
    func dispose(){
        guard !closed else{return};stopTutorialPulse();closed=true
        owner.dispose();smoke.dispose();container.removeFromParent()
    }
    isolated deinit {stopTutorialPulse();owner?.dispose();smoke?.dispose();container.removeFromParent()}
}
