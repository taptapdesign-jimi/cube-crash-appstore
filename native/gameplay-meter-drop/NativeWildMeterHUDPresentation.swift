import SpriteKit

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
            let source=self.nativeToSource(self.container.position)
            return .init(x:Double(source.x),y:Double(source.y),left:self.owner?.left ?? 0,width:self.owner?.width ?? 0,fillAlive:!self.closed,parentAttached:self.container.parent === self.stage)
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
        owner.setWidth(maximum){[weak self] width in self?.background.path=Self.barPath(left:0,width:width)}
    }
    func stopSmoke(){smoke.stopSmoke()}
    func dispose(){
        guard !closed else{return};closed=true
        owner.dispose();smoke.dispose();container.removeFromParent()
    }
    isolated deinit {owner?.dispose();smoke?.dispose();container.removeFromParent()}
}
