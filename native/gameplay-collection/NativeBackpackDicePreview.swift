import SpriteKit
import StackToSixGameplay

/// One selected board presentation, without an engine, input, saves or audio.
/// The visible SKView owns cadence; hidden/retired previews own no rendering.
@MainActor final class NativeBackpackDicePreview:SKView {
    // Keep flying/floating previews on the lowered floor plane.
    private var preservesShadowFloor:Bool {["fish","spaceship","bee","flower","laser-gun"].contains(identity.id)}
    private func shadowFloorCenter(slot:CGRect,height:CGFloat)->CGFloat {
        (preservesShadowFloor ? slot.maxY+8+height/2:slot.maxY) - (["honey","kanta"].contains(identity.id) ? 4:0) + (identity.id=="bloob-ball" ? 16:0)
    }
    private final class PreviewScene:SKScene {
        weak var owner:NativeBackpackDicePreview?
        override func update(_ currentTime:TimeInterval){owner?.advance(currentTime)}
    }
    private let textures:NativeBoardTextures
    private let canvas=PreviewScene(size:CGSize(width:320,height:320))
    private(set) var dieNode:NativeDiceNode?
    private(set) var groundShadow:NativeArcadeThumbShadow?
    private(set) var rearCanShadow:NativeArcadeThumbShadow?
    // Laser's accepted modal footprint, shared independently of die silhouette.
    static func shadowSize(slotWidth:CGFloat,id:String,bodyWidth:CGFloat?=nil,rear:Bool=false)->CGSize {
        let width=228*slotWidth/342
        let factor:CGFloat=id=="kanta" ? (rear ? 0.8:1):id=="wild-star" ? 0.81:id=="spaceship" ? 0.8*1.2:id=="bottle" ? 0.8*0.85*0.7:id=="bloob-ball" ? 0.85:["beach-ball","wild-juice","robo-cube"].contains(id) ? 0.8:1
        // The blurred radial raster has generous transparent margins. Fit its
        // visible footprint to the can base rather than a fixed slot fraction.
        let footprintWidth=id=="kanta" ? (bodyWidth ?? width)*1.595*factor:width*factor
        return CGSize(width:footprintWidth,height:width/1.11*0.15*(rear ? 0.7:1))
    }
    static let selectedShadowAlphaGain:CGFloat=4.2*0.8*0.8
    // Each response keeps that die's original pose/timing; only small extrema
    // and high-frequency silhouette changes are softened.
    private var shadowResponse:(motion:CGFloat,width:CGFloat,opacity:CGFloat,follow:CGFloat,lag:Double) {
        switch identity.id {
        case "kanta":return (0.5,0,0.5,1,0.06)
        case "wild-star":return (0.85,0.35,0.75,0.65,0.045)
        case "flower":return (0.75,0,0.85,0,0.065)
        case "barell":return (1,1,0.85,1,0)
        case "bee":return (0.85,0.3,0.75,0.45,0.075)
        case "fish":return (0.8,0.25,0.5,0.45,0.09)
        case "laser-gun":return (0.9,0.4,0.65,0.8,0.04)
        case "bloob-ball":return (0.7,0,0.65,0.6,0.08)
        default:return (1,1,1,1,0)
        }
    }
    private struct ShadowPose:Equatable {
        var x:CGFloat,sx:CGFloat,sy:CGFloat,alpha:CGFloat
        func approaching(_ target:Self,by amount:CGFloat)->Self {
            Self(x:x+(target.x-x)*amount,sx:sx+(target.sx-sx)*amount,
                 sy:sy+(target.sy-sy)*amount,alpha:alpha+(target.alpha-alpha)*amount)
        }
    }
    private var shadowSample:(time:Double,pose:ShadowPose)?
    private var shadowSlot:CGRect?
    private var disposed=false,active=false,lastTime:TimeInterval?,bodyRect=CGRect(x:-64,y:-64,width:128,height:128)
    private let resourceRoot:URL
    private let fishOwnerFactory:((URL)->NativeFishIdleOwner)?
    private var preparationForeground=true,preparationStarted=false
    private var preparationEpoch:UInt64=0
    private(set) var fishOwner:NativeFishIdleOwner?
    private(set) var groundedBodyY:CGFloat?,highestBodyY:CGFloat?
    private var presentationRect=CGRect(x:-64,y:-64,width:128,height:128)
    var presentationHeightRatio:CGFloat {max(1,presentationRect.height/max(1,bodyRect.height))}
    private var previewElapsed:TimeInterval=0
    private var bloobPlayback:NativeBloobArt.Playback?
    private var layoutNodePosition=CGPoint.zero,layoutNodeScale:CGFloat=1
    var playbackElapsed:TimeInterval {previewElapsed}
    private var pollen:[SKShapeNode]=[]
    private(set) var ready=false
    var onReady:(()->Void)?
    var isPlaying:Bool {ready && active && !isPaused && !disposed}
    var artworkFrame:CGRect?
    private let referenceBounds:CGRect
    let identity:NativeBackpackCatalog.Die
    init(die:NativeBackpackCatalog.Die,root:URL,referenceBounds:CGRect=CGRect(x:0,y:0,width:1,height:1),fishOwnerFactory:((URL)->NativeFishIdleOwner)?=nil){
        identity=die;bloobPlayback=die.id=="bloob" ? .init():nil;self.resourceRoot=root;self.referenceBounds=referenceBounds;self.fishOwnerFactory=fishOwnerFactory;textures=NativeBoardTextures(root:root)
        super.init(frame:.zero)
        backgroundColor = .clear;allowsTransparency=true;isOpaque=false;isUserInteractionEnabled=false
        preferredFramesPerSecond=["bee","honey","fish"].contains(die.id) ? 60:30;isPaused=true
        canvas.backgroundColor = .clear;canvas.scaleMode = .resizeFill;canvas.owner=self
        let shadow=NativeArcadeThumbShadow(frame:.zero,alphaGain:Self.selectedShadowAlphaGain);shadow.isHidden=true
        shadow.layer.actions=["position":NSNull(),"transform":NSNull(),"opacity":NSNull()]
        groundShadow=shadow;addSubview(shadow)
        prepare()
    }
    required init?(coder:NSCoder){fatalError("Use selected die")}
    private func prepare(){
        guard !disposed,preparationForeground,!preparationStarted else{return}
        preparationStarted=true;preparationEpoch &+= 1
        let epoch=preparationEpoch
        let variant=NativeSpecialDiceRegistry.variants[identity.id]
        let kind=variant?.archetype.rawValue ?? (identity.id=="tnt" ? "wild-tnt":identity.id=="wild-star" ? "wild":identity.id)
        var artwork=identity.id=="barell" ? NativeDiceArtwork(path:"assets/shop/barell/barell.png",idleSheet:.barrel):identity.artwork
        if identity.id=="cubero" {artwork.idleSheet = .cuberoCollection}
        if identity.id=="kite" {artwork.idleSheet = .kite}
        // Admit selected heavy sheets with body bounds before node construction.
        // Otherwise Cubero's constructor starts a bounds-free decode and the
        // readiness barrier must decode/filter the same SVG a second time.
        let parallelSheet=["beach-ball","cubero"].contains(identity.id) ? artwork.idleSheet:nil
        var earlySheetReady=false
        var earlySheetCompletion:(()->Void)?
        if let sheet=parallelSheet {
            textures.prepareArtworkSheetForPresentation(sheet,includeMotionBounds:true,includeFrameBodyBounds:true){_ in
                earlySheetReady=true
                let completion=earlySheetCompletion;earlySheetCompletion=nil;completion?()
            }
        }
        // Materialize the base before constructing the exact board visual.
        let base=identity.id=="barell" ? "assets/shop/barell/barell.png":identity.artwork.path
        textures.prepareDensityAwareArtwork(base){[weak self] _ in
            guard let self,!self.disposed,self.preparationForeground,self.preparationEpoch==epoch else{return}
            let node=NativeDiceNode(id:"backpack-\(self.identity.id)",value:6,kind:kind,variant:variant?.id,depth:1,locked:false,textures:self.textures,deferSourceIdle:true,artworkOverride:["barell","cubero","kite"].contains(self.identity.id) ? artwork:nil)
            self.dieNode=node;self.canvas.addChild(node)
            var paths=node.resourcePaths
            if let sheet=artwork.idleSheet {paths.remove(sheet.path)}
            if self.identity.id=="bee" {paths.formUnion((1...4).map{"assets/shop/bee/bee\($0).png"})}
            let count=paths.count+(artwork.idleSheet == nil ? 0:1)
            var remaining=count
            @MainActor func complete(){
                guard !self.disposed,self.preparationForeground,self.preparationEpoch==epoch else{return};remaining-=1
                if remaining==0 {self.finishPreparation(node)}
            }
            for path in paths {self.textures.prepareDensityAwareArtwork(path){_ in complete()}}
            if let sheet=artwork.idleSheet {
                if parallelSheet != nil {
                    if earlySheetReady {complete()}else{earlySheetCompletion={complete()}}
                }else{self.textures.prepareArtworkSheetForPresentation(sheet,includeFrameBodyBounds:true){_ in complete()}}
            }
        }
    }
    private func finishPreparation(_ node:NativeDiceNode){
        guard !disposed,preparationForeground,dieNode === node else{return}
        node.configureCollectionBubbles()
        node.setSourceIdleDeferred(false)
        if identity.id=="honey" {node.configureCollectionHoney()}
        if identity.id=="fish" {node.prepareFishMediaPhase()}
        textures.advanceIdlePhases();node.tick(0,suspended:false,viewportCenter:0)
        node.paintCollectionPreview(seconds:0)
        if identity.id=="kanta" {node.configureCollectionSingleCan()}
        if identity.id=="flower" {
            // Three overlapping four-grain bursts; one selected-scene clock.
            for index in 0..<12 {
                let grain=SKShapeNode(ellipseOf:CGSize(width:8,height:4))
                grain.fillColor=[UIColor(red:1,green:241/255,blue:107/255,alpha:1),UIColor(red:1,green:226/255,blue:70/255,alpha:1),UIColor(red:1,green:206/255,blue:52/255,alpha:1)][index%3]
                grain.strokeColor = .clear;grain.zPosition=8;grain.alpha=0
                node.addChild(grain);pollen.append(grain)
            }
        }
        bodyRect=node.collectionBodyBounds(normalizedBounds:referenceBounds)
        if identity.id=="cubero" {bodyRect=node.collectionBodyBounds}
        // Modal spacing follows the visible body; motion/effect tails do not grow the card.
        presentationRect=bodyRect
        if identity.id=="beach-ball",let bottom=textures.lowestSheetBodyBottom(.ball),let top=textures.highestSheetBodyTop(.ball) {
            let sheet=NativeDiceSheet.ball
            let ground=(1-sheet.anchor.y-bottom)*sheet.cell.height*sheet.displayScale+sheet.offsetY
            let high=(1-sheet.anchor.y-top)*sheet.cell.height*sheet.displayScale+sheet.offsetY
            groundedBodyY=ground;highestBodyY=high
            presentationRect=CGRect(x:bodyRect.minX,y:ground,width:bodyRect.width,height:high-ground)
        }
        layoutArtwork()
        if identity.id=="fish" {
            let owner=fishOwnerFactory?(resourceRoot) ?? NativeFishIdleOwner(resourceRoot:resourceRoot,preferOriginalSVG:true,minimumPaintInterval:0,svgPlaybackRate:1.625);fishOwner=owner
            owner.frame=bounds;addSubview(owner)
            owner.onPrepared={[weak self] _,_ in
                guard let self,!self.disposed else{return}
                self.dieNode?.prepareFishMediaPhase();self.paintFish(force:true)
            }
            owner.onMediaReady={[weak self] _,_,available in
                guard let self,!self.disposed else{return}
                self.dieNode?.setFishMediaReady(available)
                if available,!self.ready {self.markReady()}
            }
            paintFish(force:true)
        }else{markReady()}
    }
    private func markReady(){guard !disposed,!ready else{return};ready=true;layoutArtwork();if !active {fishOwner?.setSuspended(true)};onReady?()}
    private func paintFish(force:Bool=false){
        guard !disposed,let node=dieNode,let owner=fishOwner,
              let frame=node.fishFrame(in:canvas,visible:true) else{return}
        owner.paint([node.tileID:frame],generation:1,force:force)
    }
    func layoutArtwork(){
        guard !disposed,let node=dieNode,bodyRect.height>0,bounds.width>0,bounds.height>0 else{return}
        canvas.size=bounds.size
        let slot=artworkFrame ?? bounds.insetBy(dx:0,dy:48)
        guard !slot.isNull,!slot.isInfinite,slot.width>0,slot.height>0 else{return}
        if shadowSlot != slot {shadowSample=nil;shadowSlot=slot}
        let targetHeight=max(0,slot.height)
        let scale=targetHeight/presentationRect.height
        node.setScale(scale)
        node.position=CGPoint(x:slot.midX-bodyRect.midX*scale,y:bounds.height-slot.midY-presentationRect.midY*scale)
        layoutNodePosition=node.position;layoutNodeScale=scale
        paintSelectedBounce(seconds:previewElapsed)
        fishOwner?.frame=bounds;paintFish(force:true)
        if let shadow=groundShadow {
            let width=bodyRect.width*scale
            shadow.bounds=CGRect(origin:.zero,size:Self.shadowSize(slotWidth:slot.width,id:identity.id,bodyWidth:width))
            shadow.center=CGPoint(x:slot.midX,y:shadowFloorCenter(slot:slot,height:shadow.bounds.height))
            shadow.isHidden = !ready || width<=0
            shadow.setNeedsLayout();shadow.layoutIfNeeded()
            if let rear=rearCanShadow {
                rear.bounds=CGRect(origin:.zero,size:Self.shadowSize(slotWidth:slot.width,id:identity.id,bodyWidth:width,rear:true))
                rear.setNeedsLayout();rear.layoutIfNeeded()
            }
        }
        refreshGroundShadow()
    }
    /// Cached raster only; all playback uses the existing selected preview clock.
    func refreshGroundShadow(){paintGroundShadow(seconds:previewElapsed)}
    func paintGroundShadow(seconds:Double){
        guard !disposed,ready,let node=dieNode,let shadow=groundShadow else{return}
        let slot=artworkFrame ?? bounds.insetBy(dx:0,dy:48)
        guard !slot.isNull,!slot.isInfinite,slot.width>0,slot.height>0,bounds.height>0 else{return}
        if identity.id=="kite" {
            // Two slow three-second pulses on the existing modal clock only.
            // Animated silhouette/rotation/float never feeds this grounded shadow.
            let t=max(0,seconds),pulse:CGFloat=t<6 ? CGFloat(pow(sin(.pi*t/3),2)):0
            let pose=ShadowPose(x:slot.midX,sx:1+0.04*pulse,sy:1+0.03*pulse,alpha:0.92+0.06*pulse)
            guard shadowSample?.pose != pose else{return}
            shadowSample=(seconds,pose)
            shadow.layer.position=CGPoint(x:pose.x,y:shadowFloorCenter(slot:slot,height:shadow.bounds.height))
            shadow.layer.setAffineTransform(CGAffineTransform(scaleX:pose.sx,y:pose.sy));shadow.layer.opacity=Float(pose.alpha)
            return
        }
        let lift:CGFloat,footprint:CGFloat,bodyCenterX:CGFloat
        if identity.id=="kanta" {
            // Project the actual bottom pivot: rocking moves the shadow under
            // the tilted can, while vertical float softens its grounded footprint.
            let base=node.convert(CGPoint(x:bodyRect.midX,y:bodyRect.minY),to:canvas)
            lift=slot.maxY-(bounds.height-base.y)
            footprint=1;bodyCenterX=base.x
        }else if identity.id=="bloob-ball" {
            // The selected whole-ball float owns height; inner SVG rotation
            // and squash must not pump the grounded footprint.
            lift=node.position.y-layoutNodePosition.y
            footprint=1;bodyCenterX=node.position.x+bodyRect.midX*layoutNodeScale
        }else if identity.id=="flower" {
            // Follow only authored up/down translation, never the rotating
            // petal bounds, squash/stretch or lateral movement.
            lift=(node.collectionFlowerVerticalLift(in:canvas) ?? 0)+node.position.y-layoutNodePosition.y
            footprint=1;bodyCenterX=slot.midX
        }else{
            let local=node.collectionAnimatedBodyBounds(normalizedBounds:referenceBounds)
            let corners=[CGPoint(x:local.minX,y:local.minY),CGPoint(x:local.maxX,y:local.minY),CGPoint(x:local.minX,y:local.maxY),CGPoint(x:local.maxX,y:local.maxY)].map{node.convert($0,to:canvas)}
            let left=corners.map(\.x).min() ?? 0,right=corners.map(\.x).max() ?? 0
            let bottom=corners.map(\.y).min() ?? 0,top=corners.map(\.y).max() ?? 0
            let painted=fishOwner?.currentBodyFrame(tileID:node.tileID) ?? CGRect(x:left,y:bounds.height-top,width:right-left,height:top-bottom)
            lift=slot.maxY-painted.maxY;bodyCenterX=painted.midX
            footprint=max(0.7,min(1.25,painted.width/max(1,bodyRect.width*layoutNodeScale)))
        }
        let proximity=max(0.4,min(1.15,32/max(16,32+lift)))
        let response=shadowResponse
        var follow=response.follow
        if identity.id=="wild-juice" {
            let t=max(0,min(1,(proximity-0.4)/0.15))
            follow=t*t*(3-2*t)
        }
        let height=1+(proximity-1)*response.motion
        // Barrel keeps Flower's grounded darkness while its rest footprint narrows.
        let alphaProximity:CGFloat=identity.id=="barell" ? 1:proximity
        let rawAlpha=max(0.5,min(1,0.5+(alphaProximity-0.4)/0.7*0.5))
        let contact=max(0,min(1,(proximity-0.4)/0.6))
        let restWidth:CGFloat=["barell","wild-juice"].contains(identity.id) ? 1-0.2*contact*contact*(3-2*contact):1
        let target=ShadowPose(x:slot.midX+(bodyCenterX-slot.midX)*follow,
            sx:height*(1+(footprint-1)*response.width)*restWidth,sy:height,alpha:1+(rawAlpha-1)*response.opacity)
        let pose:ShadowPose
        if response.lag>0,let previous=shadowSample,seconds>=previous.time {
            // Repeated layout/paint at the same selected time is idempotent.
            let amount=CGFloat(1-exp(-(seconds-previous.time)/response.lag))
            pose=previous.pose.approaching(target,by:amount)
        }else{pose=target}
        shadowSample=(seconds,pose)
        // Action-disabled layer writes join SpriteKit's existing frame commit.
        shadow.layer.position=CGPoint(x:pose.x,y:shadowFloorCenter(slot:slot,height:shadow.bounds.height))
        shadow.layer.setAffineTransform(CGAffineTransform(scaleX:pose.sx,y:pose.sy))
        shadow.layer.opacity=Float(pose.alpha)
        if let rear=rearCanShadow {
            if let center=node.collectionRearCanCenter(in:canvas) {
                rear.isHidden=shadow.isHidden
                rear.layer.position=CGPoint(x:center.x,y:shadow.layer.position.y-16)
                rear.layer.setAffineTransform(shadow.transform);rear.layer.opacity=Float(pose.alpha)
            }else{rear.isHidden=true}
        }
    }
    override func layoutSubviews(){super.layoutSubviews();layoutArtwork()}
    /// Selected-only whole-body float; authored inner artwork keeps its own motion.
    func paintSelectedBounce(seconds:Double){
        guard !disposed,let node=dieNode else{return}
        if identity.id=="bloob-ball" {
            let phase=max(0,seconds).truncatingRemainder(dividingBy:3.8)/3.8*2*Double.pi
            node.position=CGPoint(x:layoutNodePosition.x+CGFloat(2.4*sin(phase)),
                y:layoutNodePosition.y+CGFloat(12*(1-cos(phase))))
            node.xScale=layoutNodeScale;node.yScale=layoutNodeScale
            node.zRotation=CGFloat(sin(phase)*5*Double.pi/180)
            return
        }
        if ["kanta","tnt","wild-magnet","bottle","kite"].contains(identity.id) {
            let phase=max(0,seconds).truncatingRemainder(dividingBy:3.6)/3.6*2*Double.pi
            node.position=CGPoint(x:layoutNodePosition.x,y:layoutNodePosition.y+CGFloat(10*(1-cos(phase))))
            node.xScale=layoutNodeScale;node.yScale=layoutNodeScale
            node.zRotation=CGFloat(sin(phase)*14*Double.pi/180)
            return
        }
        guard ["honey","spaceship"].contains(identity.id) else{return}
        let local=max(0,seconds).truncatingRemainder(dividingBy:2.32)
        let progress=min(1,local/NativeRegularIdleMotion.duration)
        let lift=CGFloat(pow(sin(progress * .pi),2))*8
        let pose=NativeRegularIdleMotion(variantDraw:0.7,directionDraw:0.7,tiltDraw:0.5).sample(local)
        let strength:CGFloat=0.5
        node.position=CGPoint(x:layoutNodePosition.x,y:layoutNodePosition.y+lift)
        node.xScale=layoutNodeScale*(1+(pose.x-1)*strength)
        node.yScale=layoutNodeScale*(1+(pose.y-1)*strength)
        node.zRotation=pose.rotation*strength
    }
    /// Resource admission is independent of visible animation. A not-yet-ready
    /// Fish must resume decoding before the modal can start its visible enter.
    func setPreparationForeground(_ value:Bool){
        guard !disposed,preparationForeground != value else{return}
        preparationForeground=value
        if !value {
            setActive(false)
            if !ready,fishOwner == nil {
                preparationEpoch &+= 1;preparationStarted=false
                textures.invalidatePendingPreparation()
                dieNode?.dispose();dieNode?.removeFromParent();dieNode=nil
            }
        }else{
            if !ready,fishOwner == nil {prepare()}
            fishOwner?.setSuspended(false)
        }
    }
    func setActive(_ value:Bool,retainMediaUntilDisposal:Bool=false){
        guard !disposed else{return};active=value && preparationForeground;lastTime=nil
        if active,ready {
            if scene == nil {presentScene(canvas)}
            isPaused=UIAccessibility.isReduceMotionEnabled
        }else{isPaused=true}
        if active || !retainMediaUntilDisposal {fishOwner?.setSuspended(!preparationForeground || ready && !active)}

        dieNode?.reconcileSourceIdleBubbleVisibility()
    }
    private func advance(_ time:TimeInterval){
        guard active,ready,!disposed,!UIAccessibility.isReduceMotionEnabled else{return}
        let delta=lastTime.map{min(1.0/15,max(0,time-$0))} ?? 0;lastTime=time
        textures.advanceIdlePhases()
        // Only the selected BLOOB modal artwork accelerates; hover keeps its clock.
        let bloobDelta=NativeBloobArt.modalArtworkTime(previewElapsed+delta)-NativeBloobArt.modalArtworkTime(previewElapsed)
        let bloobTime=bloobPlayback?.advance(bloobDelta)
        let artworkRate=identity.id=="bee" ? 0.4356:1
        dieNode?.tick(delta*artworkRate,suspended:false,viewportCenter:canvas.size.width/2,
                      beeFrameOrder:identity.id=="bee" ? [1,2,4,3]:nil,selectedBloobTime:bloobTime)
        previewElapsed+=delta
        dieNode?.paintCollectionPreview(seconds:previewElapsed)
        paintSelectedBounce(seconds:previewElapsed)
        for (index,grain) in pollen.enumerated() {
            let birth=Double(index/4)*0.76
            let age=(previewElapsed-birth).truncatingRemainder(dividingBy:2.28)
            guard age>=0,age<2 else{grain.alpha=0;continue}
            let p=age/2,side=Double(index%4)-1.5
            grain.position=CGPoint(x:bodyRect.midX+side*22*p+sin(p*2 * .pi+Double(index))*8*sin(.pi*p),y:bodyRect.midY+2+16*sin(.pi*p)-side*6*p)
            grain.zRotation=side*0.4+p*side
            grain.alpha=0.8*min(1,p/0.16)*min(1,(1-p)/0.28)
        }
        paintFish()
        refreshGroundShadow()
    }
    func dispose(){
        guard !disposed else{return};disposed=true;active=false;isPaused=true;onReady=nil
        fishOwner?.dispose();fishOwner=nil;bloobPlayback=nil;pollen.removeAll();dieNode?.dispose();dieNode=nil
        groundShadow?.removeFromSuperview();groundShadow=nil;shadowSample=nil;shadowSlot=nil
        rearCanShadow?.removeFromSuperview();rearCanShadow=nil
        canvas.owner=nil;canvas.removeAllChildren();presentScene(nil);textures.dispose()
    }
}
