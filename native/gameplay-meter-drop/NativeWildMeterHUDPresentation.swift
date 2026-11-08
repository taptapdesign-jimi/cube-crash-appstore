import SpriteKit
import UIKit

/// PRIVATE caller bridge: mount container in actual source-equivalent HUD root.
/// All animation delivery comes from the supplied app service; wall emission
/// uses its separate captured app timeout registry. No assets or common smoke.
@MainActor final class NativeWildMeterHUDPresentation {
    let container=SKNode(),background=SKShapeNode(),fillSpatialLayer=SKNode(),fillBounceLayer=SKNode(),fill=SKShapeNode()
    private final class SmokeResources:NativeWildMeterSmokeResources {
        weak var hudStage:SKNode?
        var visualsHidden=false
        var curveBirthOffset:((CGPoint)->CGPoint)?
        var birthColor:((CGPoint)->UIColor)?
        private var birthOffsets:[UInt64:CGPoint]=[:]
        let sourceToNative:(CGPoint)->CGPoint
        var nodes:[UInt64:SKShapeNode]=[:]
        private var birthPositions:[UInt64:CGPoint]=[:]
        private var shakeCompensation=CGPoint.zero
        func setCanvasShakeOffset(_ offset:CGPoint){
            let next=CGPoint(x:-offset.x,y:-offset.y)
            let delta=CGPoint(x:next.x-shakeCompensation.x,y:next.y-shakeCompensation.y)
            shakeCompensation=next
            for node in nodes.values {node.position=CGPoint(x:node.position.x+delta.x,y:node.position.y+delta.y)}
        }
        private func position(_ source:CGPoint)->CGPoint {
            let p=sourceToNative(source)
            return CGPoint(x:p.x+shakeCompensation.x,y:p.y+shakeCompensation.y)
        }
        init(stage:SKNode,sourceToNative:@escaping(CGPoint)->CGPoint){hudStage=stage;self.sourceToNative=sourceToNative}
        func create(id:UInt64,x:Double,y:Double,radius:Double){
            guard let hudStage else{return}
            let bubble=SKShapeNode(circleOfRadius:CGFloat(radius))
            bubble.isHidden=visualsHidden
            bubble.name="wild-meter-smoke";bubble.fillColor=SKColor(red:248/255,green:107/255,blue:60/255,alpha:0.5)
            bubble.strokeColor = .clear;bubble.lineWidth=0;bubble.alpha=0;bubble.zPosition=12000
            let source=CGPoint(x:x,y:y),offset=curveBirthOffset?(source) ?? .zero,p=position(source)
            if let color=birthColor?(source){bubble.fillColor=color}
            birthOffsets[id]=offset;bubble.position=CGPoint(x:p.x+offset.x,y:p.y+offset.y);nodes[id]=bubble
            birthPositions[id]=CGPoint(x:x,y:y);hudStage.addChild(bubble)
        }
        func paint(id:UInt64,_ pose:NativeWildMeterSmokePlan.Pose){
            guard let bubble=nodes[id],let birth=birthPositions[id] else{return}
            let p=position(.init(x:pose.x,y:pose.y)),offset=birthOffsets[id] ?? .zero
            bubble.position=CGPoint(x:p.x+offset.x,y:p.y+offset.y)
            // Wall emission can precede a lazy/paused Source tween. Do not paint
            // its stationary spawn row, including any zero-time initialization.
            let moving=abs(pose.x-birth.x)>0.000001 || abs(pose.y-birth.y)>0.000001
            bubble.alpha=moving ? CGFloat(pose.alpha):0
        }
        func destroy(id:UInt64){birthOffsets.removeValue(forKey:id);birthPositions.removeValue(forKey:id);nodes.removeValue(forKey:id)?.removeFromParent()}
    }
    private let stage:SKNode,sourceToNative:(CGPoint)->CGPoint,nativeToSource:(CGPoint)->CGPoint
    private let current:()->Bool
    private let driver:NativeWildMeterSourceDriver
    private let wall:NativeWildMeterSmokeWallDriver
    private let smokeResources:SmokeResources
    private var owner:NativeWildMeterHUDOwner!
    private var preloadBar:NativePreloadBarPresentation?
    var onPreloadMotionChanged:((Bool)->Void)? {didSet{preloadBar?.onMotionChanged=onPreloadMotionChanged}}
    private var smoke:NativeWildMeterSmokeOwner!
    private let materialCrop=SKCropNode(),materialMask=SKShapeNode(),materialSurface=SKSpriteNode(),materialRim=SKShapeNode()
    private var barHeight:CGFloat=10
    private let initiallyPad:Bool
    private var isPad:Bool {initiallyPad || stage.scene.map{NativeTabletLayout.applies($0.size)} == true}
    private var canonicalMaximum=0.0
    private var closed=false,preloadPrimed=false,preloadSurfaceDetached=false
    private var tutorialPulseActive=false,tutorialPulseEpoch:UInt64=0
    private var tutorialPulseCancel:(()->Void)?
    private var tutorialPulseBase:(CGPoint,CGFloat,CGFloat)?
    private var tutorialFillBase:(CGPoint,CGFloat,CGFloat)?
    private var tutorialBubbleStep=0
    var tutorialPulseRunning:Bool{tutorialPulseActive}
    static let tutorialPulseDuration=1.6/1.1
    static func tutorialPulseScale(_ seconds:Double)->Double {
        let t=max(0,min(1,seconds/tutorialPulseDuration))
        return 1+0.03*(0.5-0.5*cos(t*2*Double.pi))
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
        tutorialPulseCancel=driver.start(duration:Self.tutorialPulseDuration,paint:{[weak self] seconds in
            guard let self,!self.closed,self.tutorialPulseActive,self.tutorialPulseEpoch==epoch,self.current(),self.tutorialPulseBase != nil else{return}
            guard let base=self.tutorialPulseBase else{return}
            let scale=CGFloat(Self.tutorialPulseScale(seconds))
            self.container.xScale=base.1*scale;self.container.yScale=base.2*scale
            let center=self.background.path?.boundingBox.midX ?? 0
            self.container.position=CGPoint(x:base.0.x-center*base.1*(scale-1),y:base.0.y+5*base.2*(scale-1))
            if let fillBase=self.tutorialFillBase {
                let spring=(scale-1)/0.03,extra=1+0.035*spring,stretch=(1+0.12*spring)*extra
                self.fill.xScale=fillBase.1*stretch;self.fill.yScale=fillBase.2*extra
                self.fill.position=CGPoint(x:fillBase.0.x+CGFloat(self.owner.left)*fillBase.1*(1-stretch),y:fillBase.0.y+5*fillBase.2*(extra-1))
            }
            let step=Int((seconds+1e-9)/0.3)
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
         generation:UInt64,maximum:Double,isPad:Bool,sourceOrigin:CGPoint,barHeight:CGFloat=10,preloadDividerRoot:URL?=nil,
         sourceToNative:@escaping(CGPoint)->CGPoint,nativeToSource:@escaping(CGPoint)->CGPoint,
         smokeDisabled:@escaping()->Bool,current:@escaping()->Bool,visualRandom:@escaping()->Double){
        self.barHeight=barHeight;initiallyPad=isPad;canonicalMaximum=maximum
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
        materialMask.fillColor = .white;materialMask.strokeColor = .clear;materialMask.lineWidth=0
        materialCrop.maskNode=materialMask;materialSurface.anchorPoint=CGPoint(x:0,y:0.5)
        materialRim.fillColor = .clear;materialRim.strokeColor=SKColor.white.withAlphaComponent(0.60)
        materialRim.lineCap = .round;materialRim.zPosition=1
        materialCrop.addChild(materialSurface);materialCrop.addChild(materialRim);fill.addChild(materialCrop)
        fillBounceLayer.addChild(fill);fillSpatialLayer.addChild(fillBounceLayer);container.addChild(background);container.addChild(fillSpatialLayer)
        hudStage.addChild(container)
        smoke=NativeWildMeterSmokeOwner(driver:driver,wall:wall,resources:smokeResources,geometry:{[weak self] in
            guard let self else{return .init(x:0,y:0,left:0,width:0,fillAlive:false,parentAttached:false)}
            if self.preloadSurfaceDetached{return .init(x:0,y:0,left:0,width:0,fillAlive:false,parentAttached:false)}
            // Read actual painted transform, NOT logical meter/model geometry.
            if self.tutorialPulseActive,self.preloadBar==nil,let owner=self.owner {
                let left=self.nativeToSource(self.fill.convert(CGPoint(x:owner.left,y:0),to:self.stage))
                let right=self.nativeToSource(self.fill.convert(CGPoint(x:owner.left+owner.width,y:0),to:self.stage))
                return .init(x:Double(left.x),y:Double(left.y),left:0,width:Double(right.x-left.x),fillAlive:!self.closed,parentAttached:self.container.parent === self.stage,maximum:Double(self.background.path?.boundingBox.width ?? 0))
            }
            if let preview=self.preloadBar {
                let a=preview.smokeBaseline(in:self.stage),b=preview.smokePoint(atX:preview.visualMaximum,in:self.stage)
                let source=self.nativeToSource(a),span=max(0,Double(b.x-a.x)),scale=span/max(1,self.canonicalMaximum)
                let left=(self.owner?.left ?? 0)*scale,right=min(span*preview.lifecycleReveal,((self.owner?.left ?? 0)+(self.owner?.width ?? 0)*preview.liquidFillFraction)*scale)
                return .init(x:Double(source.x),y:Double(source.y)-5,left:left,width:max(0,right-left),fillAlive:!self.closed && !preview.container.isHidden && preview.smokeAdmitted,parentAttached:preview.container.parent != nil,maximum:span)
            }
            let source=self.nativeToSource(self.container.position)
            return .init(x:Double(source.x),y:Double(source.y),left:self.owner?.left ?? 0,width:self.owner?.width ?? 0,fillAlive:!self.closed,parentAttached:self.container.parent === self.stage,maximum:Double(self.background.path?.boundingBox.width ?? 0))
        },disabled:smokeDisabled,current:{[weak self] in guard let self else{return false};return !self.closed && self.current()},random:visualRandom)
        owner=NativeWildMeterHUDOwner(driver:driver,maximum:maximum,initialWidth:0,isPad:isPad,draw:{[weak self] pose in
            guard let self else{return}
            let path=Self.barPath(left:pose.left,width:pose.width,height:self.barHeight)
            self.fill.path=path;self.materialMask.path=path
            self.preloadBar?.setNativeFill(left:pose.left,width:pose.width,maximum:self.canonicalMaximum)
            self.materialRim.lineWidth=max(0.5,self.barHeight*0.055)
            self.materialRim.path=Self.upperRimPath(left:pose.left,width:pose.width,height:self.barHeight)
        },drawBounce:{[weak self] y in self?.fillBounceLayer.position.y = -CGFloat(y)},stopSmoke:{[weak self] in self?.smoke.stopSmoke()},stopEmission:{[weak self] in self?.smoke.stopEmission()},startSmoke:{[weak self] in self?.smoke.startEmission()},verticalBounceEnabled:false)
        if let root=preloadDividerRoot {
            let preview=NativePreloadBarPresentation(isPad:self.isPad,dividerResourceRoot:root)
            preloadBar=preview;container.addChild(preview.container)
            background.isHidden=true;fillSpatialLayer.isHidden=true
            // Preserve authored shared-RNG smoke scheduling,without painting
            // the old visuals behind the experimental PNG replacement.
            smokeResources.visualsHidden=false
            smokeResources.birthColor={[weak self,weak preview] source in
                guard let self,let preview else{return SKColor.clear}
                return preview.smokeColor(self.sourceToNative(source),in:self.stage)
            }
            smokeResources.curveBirthOffset={[weak self,weak preview] source in
                guard let self,let preview else{return .zero}
                return preview.smokeCurveOffset(self.sourceToNative(source),in:self.stage)
            }
        }
        resize(maximum:maximum,sourceOrigin:sourceOrigin)
    }
    /// Static original orange with inner gloss; no lower dark shading.
    private func prepareMaterialSurface(maximum:Double) {
        let size=CGSize(width:max(1,CGFloat(maximum)),height:max(1,barHeight))
        let format=UIGraphicsImageRendererFormat();format.scale=2;format.opaque=false
        let image=UIGraphicsImageRenderer(size:size,format:format).image { context in
            let cg=context.cgContext,rect=CGRect(origin:.zero,size:size)
            cg.setFillColor(UIColor(red:231/255,green:116/255,blue:74/255,alpha:1).cgColor);cg.fill(rect)
            let colors=[UIColor.white.withAlphaComponent(0.28).cgColor,UIColor.white.withAlphaComponent(0.06).cgColor,UIColor.clear.cgColor,UIColor.clear.cgColor] as CFArray
            if let gloss=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors,locations:[0,0.18,0.40,1]) {
                cg.drawLinearGradient(gloss,start:.zero,end:CGPoint(x:0,y:size.height),options:[])
            }
        }
        let texture=SKTexture(image:image);texture.filteringMode = .linear
        materialSurface.texture=texture;materialSurface.size=size;materialSurface.position=CGPoint(x:0,y:-5)
    }
    /// Inset highlight follows only the upper semicircular lip of the live fill.
    private static func upperRimPath(left:Double,width:Double,height:CGFloat)->CGPath {
        let path=CGMutablePath(),inset:CGFloat=0.55
        guard width>Double(inset*2),height>inset*2 else{return path}
        let x=CGFloat(left)+inset,w=CGFloat(width)-inset*2,h=height-inset*2
        let r=min(h/2,w/2),top = -5+h/2,side=top-r,k:CGFloat=0.5522847498
        path.move(to:CGPoint(x:x,y:side))
        path.addCurve(to:CGPoint(x:x+r,y:top),control1:CGPoint(x:x,y:side+k*r),control2:CGPoint(x:x+r-k*r,y:top))
        path.addLine(to:CGPoint(x:x+w-r,y:top))
        path.addCurve(to:CGPoint(x:x+w,y:side),control1:CGPoint(x:x+w-r+k*r,y:top),control2:CGPoint(x:x+w,y:side+k*r))
        return path
    }
    private static func barPath(left:Double,width:Double,height:CGFloat)->CGPath {
        // Retain the original local centre y=-5 as thickness grows. Both
        // track and fill share true semicircular caps, including narrow fills.
        guard width>0 else{return CGMutablePath()}
        let radius=min(height/2,CGFloat(width)/2)
        return CGPath(roundedRect:CGRect(x:left,y:-5-height/2,width:width,height:height),cornerWidth:radius,cornerHeight:radius,transform:nil)
    }
    /// Cancel only the board canvas translation; HUD enter/exit still owns its parent.
    func setCanvasShakeOffset(_ offset:CGPoint){guard !closed else{return};smokeResources.setCanvasShakeOffset(offset)}
    var activeSmokeCount:Int{smoke.activeBubbleCount}
    /// Sibling particles retain their own flight/fade opacity during HUD refresh.
    func ownsSmoke(_ node:SKNode)->Bool{smokeResources.nodes.values.contains{$0 === node}}
    func ownsPreloadSurface(_ node:SKNode)->Bool{preloadBar?.container === node}
    var fillPose:NativeWildMeterConsumptionPlan.Pose{.init(left:owner.left,width:owner.width)}
    var consumeActive:Bool{owner.consumeActive}
    func setProgress(_ ratio:Double,animated:Bool){guard !closed else{return};owner.setProgress(ratio,animated:animated)}
    func consume(_ ratio:Double,reducedMotion:Bool){guard !closed else{return};owner.consume(ratio,reducedMotion:reducedMotion)}
    func resize(maximum:Double,sourceOrigin:CGPoint,barHeight:CGFloat?=nil){
        guard !closed else{return};canonicalMaximum=maximum;if let barHeight {self.barHeight=barHeight};container.position=sourceToNative(sourceOrigin)
        if let base=tutorialPulseBase {tutorialPulseBase=(container.position,base.1,base.2)}
        preloadBar?.resize(maximum:isPad ? maximum:Double((stage.scene?.size.width ?? 390)*0.88),barHeight:self.barHeight)
        attachPreloadSurface()
        prepareMaterialSurface(maximum:maximum)
        owner.setWidth(maximum){[weak self] width in guard let self else{return};self.background.path=Self.barPath(left:0,width:width,height:self.barHeight)}
    }
    private var preloadDesignMeterPosition:CGPoint {
        if isPad{return container.position}
        let size=stage.scene?.size ?? CGSize(width:390,height:844),factor=size.width/390
        return CGPoint(x:(size.width-size.width*0.88)/2,y:size.height-107.06736002185303*factor)
    }
    private func attachPreloadSurface(){
        guard let preloadBar,let parent=stage.parent else{return}
        if preloadBar.container.parent !== parent {preloadBar.container.removeFromParent();parent.addChild(preloadBar.container)}
        // Resting HUD coordinates,without inheriting its drop/rise or fade.
        preloadBar.container.position=preloadDesignMeterPosition
        // This surface includes translucent navigation paper as well as the
        // divider. Keep it above the board but behind the HUD: its entrance
        // must not wash over already opaque Close/score/combo/Backpack artwork.
        preloadBar.container.zPosition=stage.zPosition-1
    }
    func takePreloadExitPresentation()->NativePreloadBarPresentation? {
        guard !closed else{return nil};attachPreloadSurface();smoke.stopEmission();preloadSurfaceDetached=true;let visual=preloadBar;preloadBar=nil;return visual
    }
    func restorePreloadPresentation(_ visual:NativePreloadBarPresentation){
        guard !closed else{visual.dispose();return};preloadSurfaceDetached=false;preloadBar=visual;visual.onMotionChanged=onPreloadMotionChanged;preloadPrimed=false;attachPreloadSurface();visual.cancelBoardExit()
    }
    func primeBoardEntry(restart:Bool=false){guard !closed else{return};preloadPrimed = !restart;attachPreloadSurface();preloadBar?.primeBoardEntry(restart:restart)}
    func beginBoardEntry(restart:Bool=false){guard !closed else{return};preloadPrimed=false;attachPreloadSurface();preloadBar?.beginBoardEntry(restart:restart)}
    func paintPreloadBoardEntry(_ elapsed:Double){guard !closed else{return};preloadBar?.paintBoardEntry(elapsed)}
    func synchronizePreloadSurfaceVisibility(){guard !closed,let preloadBar else{return};preloadBar.container.position=preloadDesignMeterPosition;preloadBar.container.xScale=container.xScale;preloadBar.container.yScale=container.yScale;preloadBar.container.alpha=container.alpha;preloadBar.container.isHidden=preloadPrimed || stage.isHidden}
    func cancelBoardExit(){guard !closed else{return};preloadPrimed=false;preloadBar?.cancelBoardExit()}
    func stopSmoke(){smoke.stopSmoke()}
    func dispose(){
        guard !closed else{return};stopTutorialPulse();closed=true;smokeResources.curveBirthOffset=nil;smokeResources.birthColor=nil
        preloadBar?.dispose();preloadBar=nil;owner.dispose();smoke.dispose();container.removeFromParent()
    }
    isolated deinit {stopTutorialPulse();preloadBar?.dispose();owner?.dispose();smoke?.dispose();container.removeFromParent()}
}
