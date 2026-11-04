import UIKit
import CoreText

@MainActor
protocol NativeBoardTransitionResources:AnyObject {
    func image(_ path:String,owner:Int)->UIImage?
    func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void)
    func release(_ owner:Int)
}
extension JimiNativeWorldResources:NativeBoardTransitionResources {}

/// One coordinator-owned variation sequence preserves the original Beach
/// alternating entry side across repeated transitions, including replay.
@MainActor
final class NativeThemedTransitionVariationOwner {
    private var previousBeach:Bool?
    func next(theme:NativeBoardTransitionPlan.Theme,random:()->Double)->NativeTransitionSceneGeometry.Variation {
        switch theme {
        case .beach:
            let swapped:Bool
            if let previousBeach {swapped = !previousBeach}else {let sample=random();swapped=(sample.isFinite ? max(0,min(0.999999,sample)):0)<0.5}
            previousBeach=swapped
            return .init(beachSwapped:swapped)
        case .area55:
            let sample=random(),front=sample.isFinite && sample>=0.5 ? -1:1
            return .init(frontDirection:front,walkerDirection:-front)
        case .forest:return .init()
        }
    }
}

/// Authored selected-scene carrier only. Progression and board creation remain
/// the route coordinator's transaction. This controller never opens gameplay.
@MainActor
final class NativeThemedBoardTransitionController:UIViewController {
    let board:Int,generation:UInt64,theme:NativeBoardTransitionPlan.Theme,viewport:CGSize
    var onOriginalOpaqueCover:((UInt64)->Void)?
    var onSceneExit:((UInt64)->Void)?
    var onCue:((String,Int)->Void)?
    var onHaptic:((String)->Void)?
    var onAudioCleanup:((Bool)->Void)?
    var onMusicPhase:((String,Double,Double)->Void)?
    var onAssetFailure:(()->Void)?
    private let root:URL,resources:any NativeBoardTransitionResources,random:()->Double,artwork:JimiV9Artwork
    private let variation:NativeTransitionSceneGeometry.Variation,fontOverride:UIFont?
    private let sceneOwner:Int,paperOwner:Int
    private static var nextOwner = -200000
    private let presentationViewport:CGSize
    private let composition=UIView()
    private static let tabletContentScale:CGFloat=0.7*1.15
    private static let forestSceneryScale:CGFloat=1.05*1.05*1.05
    private var tabletArtworkScale:CGFloat {theme == .beach ? 0.85:theme == .area55 ? 0.90:1}
    private var tabletCompositionScale:CGFloat {Self.tabletContentScale*tabletArtworkScale}
    private var sceneryCompositionDrop:CGFloat {
        guard NativeTabletLayout.applies(presentationViewport) else{return 0}
        // Height-relative offsets from the1180pt review viewport. Convert
        // once through the complete projection; NN/paper cancel this offset.
        let fraction:CGFloat
        switch theme {
        case .forest:fraction=50.0/1180.0
        case .area55:fraction=40.0/1180.0+0.20
        case .beach:fraction=60.0/1180.0+0.20
        }
        return presentationViewport.height*fraction/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
    }
    private var beachPropLift:CGFloat {
        guard NativeTabletLayout.applies(presentationViewport) else{return 0}
        return 32/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
    }
    private var forestFenceCompensation:CGFloat {
        guard theme == .forest,NativeTabletLayout.applies(presentationViewport) else{return 0}
        // Fences retain the previous20pt group placement. Cancel only the
        // additional drop, including the lower scenery's own uniform scale.
        let previousDrop=presentationViewport.height*(20.0/1180.0)/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
        return (sceneryCompositionDrop-previousDrop)/Self.forestSceneryScale
    }
    private var forestSceneryDrop:CGFloat {
        guard theme == .forest,NativeTabletLayout.applies(presentationViewport) else{return 0}
        // Uniform downscaling around screen centre lifted the lower scene by
        // this physical gutter. Restore its authored bottom anchoring only.
        let physicalDrop=presentationViewport.height*(1-tabletCompositionScale)/2
        return physicalDrop/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
    }
    private let paper=UIImageView(),scene=UIView(),paperCover=UIView(),digitUnit=UIView()
    private struct MountedCloud {
        let plan:NativeTransitionCloudPlan.Cloud,host:UIView,sprite:UIImageView
        let tabletTopClearance:CGFloat?,tabletDriftDistance:CGFloat?
        var retired=false
    }
    private var sceneImages:[String:UIImageView]=[:],clouds:[MountedCloud]=[]
    private var digitViews:[UILabel]=[],digitRotations:[Double]=[]
    private struct Moment {let key:String,seconds:Double,cue:String?,index:Int,haptic:String?}
    private var moments:[Moment]=[]
    private var scenePlan:NativeTransitionScenePlan?,combat:NativeTransitionRoboCombatPlan?,bees:NativeForestTransitionBees?
    private var fighterViews:[NativeTransitionRoboCombatPlan.Side:(UIView,UIImageView)]=[:],beamViews:[String:UIImageView]=[:]
    private var shake:NativeTransitionInterpolation.Track?
    private var displayLink:CADisplayLink?,clockProxy:ClockProxy?,observers:[NSObjectProtocol]=[]
    private var lastTimestamp:CFTimeInterval?,elapsed=0.0,fired:Set<String>=[]
    private var musicContacts:[(key:String,seconds:Double,ratio:Double,duration:Double)]=[]
    private var requested=false,foreground=true,disposed=false,sceneFinished=false,sceneReleased=false,paperReleased=false,preparationFailed=false,audioNaturalFinished=false,audioAborted=false
    private(set) var assetsReady=false
    var retainsOpaqueCover:Bool {sceneFinished && !disposed && paper.image != nil && view.alpha==1}
    var hasActiveClock:Bool {displayLink != nil}
    var selectedAssetCount:Int {Self.assets(theme:theme).count}
    init(root:URL,board:Int,viewport:CGSize,generation:UInt64,resources:(any NativeBoardTransitionResources)?=nil,variation:NativeTransitionSceneGeometry.Variation?=nil,font:UIFont?=nil,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.root=root;self.board=max(1,min(30,board));self.viewport=NativeTabletLayout.animationViewport(viewport);presentationViewport=viewport;self.generation=generation
        theme=NativeBoardTransitionPlan.Theme(board:board);self.resources=resources ?? JimiNativeWorldResources(root:root);self.random=random;artwork=JimiV9Artwork(resourceRoot:root);fontOverride=font
        self.variation=variation ?? NativeThemedTransitionVariationOwner().next(theme:theme,random:random)
        sceneOwner=Self.nextOwner;paperOwner=Self.nextOwner-1;Self.nextOwner -= 2
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use authored native transition initializer")}
    override func loadView(){view=UIView(frame:CGRect(origin:.zero,size:presentationViewport));view.alpha=0;view.backgroundColor = .clear;view.isOpaque=false;view.clipsToBounds=false
        composition.frame=CGRect(origin:.zero,size:viewport);composition.isUserInteractionEnabled=false
        if NativeTabletLayout.applies(presentationViewport) {
            view.addSubview(composition);NativeTabletLayout.projectAnimation(composition,viewport:presentationViewport)
            composition.transform=composition.transform.scaledBy(x:tabletCompositionScale,y:tabletCompositionScale)
            composition.center.y+=sceneryCompositionDrop*NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale
        }
        // Keep the already painted gameplay paper visible while this captured
        // cover prepares. A flat opaque placeholder must never replace it.
        paperCover.frame=canvas.bounds;paperCover.isHidden=true;paperCover.clipsToBounds=true;paperCover.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1);paperCover.isUserInteractionEnabled=false;canvas.addSubview(paperCover)
        let gradient=CAGradientLayer();gradient.frame=canvas.bounds;gradient.colors=[UIColor(red:243/255,green:238/255,blue:232/255,alpha:1).cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor];gradient.locations=[0,0.6,1];paperCover.layer.insertSublayer(gradient,at:0)
        paper.frame=canvas.bounds;paper.contentMode = .scaleAspectFill;paper.isUserInteractionEnabled=false;paperCover.addSubview(paper);let tint=UIView(frame:canvas.bounds);tint.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.4);tint.isUserInteractionEnabled=false;paperCover.addSubview(tint)
        // Keep the opaque paper full-screen while artwork/digits/clouds shrink.
        if NativeTabletLayout.applies(presentationViewport) {
            paperCover.transform=CGAffineTransform(scaleX:1/tabletCompositionScale,y:1/tabletCompositionScale)
            paperCover.center.y-=sceneryCompositionDrop
        }
        scene.frame=NativeTransitionSceneGeometry.sceneFrame(viewport:viewport).offsetBy(dx:0,dy:forestSceneryDrop);scene.isUserInteractionEnabled=false;scene.clipsToBounds=false;scene.backgroundColor = .clear;scene.layer.zPosition=4;canvas.addSubview(scene)
        if theme == .forest,NativeTabletLayout.applies(presentationViewport) {
            // Grow the whole lower scenery around its bottom edge, retaining
            // the accepted ground alignment instead of zooming the screen.
            let sceneryScale=Self.forestSceneryScale
            scene.center.y-=scene.bounds.height*(sceneryScale-1)/2
            scene.transform=CGAffineTransform(scaleX:sceneryScale,y:sceneryScale)
        }
        // PWA's NN Unit is a fixed stacking context. Keep each digit's authored
        // 3D exit inside it so perspective cannot reorder scene/cloud siblings.
        digitUnit.frame=canvas.bounds;digitUnit.isUserInteractionEnabled=false;digitUnit.clipsToBounds=false;digitUnit.backgroundColor = .clear;digitUnit.layer.zPosition=10;canvas.addSubview(digitUnit)
        // Cancel the group translation only for NN; all scenery/bee/cloud
        // siblings keep the common shift and their original depth ordering.
        digitUnit.center.y-=sceneryCompositionDrop
        if theme == .forest,NativeTabletLayout.applies(presentationViewport) {
            digitUnit.center.y-=24/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
        }
        if NativeTabletLayout.applies(presentationViewport) {
            // Scene-only size corrections never change the NN size or pose.
            digitUnit.transform=CGAffineTransform(scaleX:1/tabletArtworkScale,y:1/tabletArtworkScale)
        }
    }
    private var canvas:UIView {NativeTabletLayout.applies(presentationViewport) ? composition:view}
    static func assets(theme:NativeBoardTransitionPlan.Theme)->[String] {
        var paths=NativeTransitionThemeLayers.layers(theme).map(\.asset)+NativeTransitionCloudPlan.assets
        if theme == .forest {paths += (1...7).map{"./assets/shop/honey/bee\($0)@2x.png"}}
        return Array(Set(paths)).sorted()
    }
    func start(){guard !disposed,!requested else{return};requested=true;loadViewIfNeeded()
        observers=[UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification].map {name in
            NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main){[weak self] notice in MainActor.assumeIsolated{self?.setForeground(notice.name==UIApplication.didBecomeActiveNotification)}}
        }
        resources.prepare(["./assets/paper-bg.png"],owner:paperOwner,required:true){[weak self] ready in
            guard let self,!self.disposed else{return};guard ready,let image=self.resources.image("./assets/paper-bg.png",owner:self.paperOwner) else{self.failPreparation();return};self.paper.image=image;self.paper.frame=NativeAppPaperSurface.textureFrame(imageSize:image.size,bounds:self.canvas.bounds)
            self.resources.prepare(Self.assets(theme:self.theme),owner:self.sceneOwner,required:true){[weak self] ready in
                guard let self,!self.disposed,!self.preparationFailed else{return};guard ready else{self.failPreparation();return}
                do {
                    try self.mountPreparedScene()
                    self.assetsReady=true
                    self.paperCover.isHidden=false;self.view.backgroundColor=self.paperCover.backgroundColor;self.view.isOpaque=true
                    self.paint(seconds:0,generation:self.generation);self.startClockIfReady()
                }catch {self.failPreparation()}
            }
        }
    }
    private func failPreparation(){guard !preparationFailed,!disposed else{return};preparationFailed=true;stopClock();cleanupAudio(aborted:true);onAssetFailure?()}
    private enum PreparationError:Error {case requiredAsset,font,bees}
    private func image(_ path:String)throws->UIImage {guard let image=resources.image(path,owner:sceneOwner) else{throw PreparationError.requiredAsset};return image}
    private func mountPreparedScene() throws {
        let font:UIFont
        if let fontOverride {font=fontOverride}else {
            guard FileManager.default.fileExists(atPath:root.appendingPathComponent("assets/fonts/Baloo2-ExtraBold.ttf").path) else{throw PreparationError.font}
            font=artwork.font(size:166,weight:"ExtraBold");guard font.fontName.lowercased().contains("baloo") else{throw PreparationError.font}
        }
        let descriptor=font.fontDescriptor.addingAttributes([.featureSettings:[[UIFontDescriptor.FeatureKey.type:kNumberSpacingType,UIFontDescriptor.FeatureKey.selector:kMonospacedNumbersSelector]]])
        let cloudPlans=NativeTransitionCloudPlan.make(theme:theme,width:viewport.width,random:random)
        let digitFont=UIFont(descriptor:descriptor,size:166),text=NativeBoardTransitionPlan.localStage(board)
        let width=("0" as NSString).size(withAttributes:[.font:digitFont]).width,total=width*CGFloat(text.count),centerY=viewport.height*0.29-4
        for (index,character) in text.enumerated(){let label=UILabel(frame:CGRect(x:(viewport.width-total)/2+CGFloat(index)*width,y:centerY-83,width:width,height:166));label.text=String(character);label.font=digitFont;label.textColor=UIColor(red:0xE7/255,green:0x74/255,blue:0x49/255,alpha:1);label.textAlignment = .center;label.isUserInteractionEnabled=false;digitUnit.addSubview(label);digitViews.append(label);let angle = -8+random()*16;digitRotations.append(index%2==0 ? angle:-angle)}
        let layers=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation)
        for layer in layers {
            let key=layer.definition.key
            guard !key.hasPrefix("robo-fighter"),!key.hasPrefix("robo-beam") else{continue}
            let sprite=UIImageView(image:try image(layer.definition.asset));sprite.bounds=CGRect(origin:.zero,size:layer.frame.size);sprite.layer.anchorPoint=CGPoint(x:0.5,y:1);sprite.layer.position=CGPoint(x:layer.left,y:scene.bounds.height-layer.bottom);sprite.contentMode = .scaleAspectFit;sprite.layer.zPosition=CGFloat(layer.definition.depth)
            if theme == .beach,(key == "beach-bottle" || key == "beach-ball") {sprite.layer.position.y-=beachPropLift}
            if key == "fence-left" || key == "fence-right" {sprite.layer.position.y-=forestFenceCompensation}
            if theme == .forest,key == "mountain",NativeTabletLayout.applies(presentationViewport) {
                // Convert physical displacement through both composition and scenery.
                sprite.layer.position.y+=60/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale*Self.forestSceneryScale)
            }
            if NativeTabletLayout.applies(presentationViewport) {
                if theme == .beach,key.hasPrefix("beach-sea-") {
                    sprite.bounds.size=CGSize(width:layer.frame.width*1.20,height:layer.frame.height*1.20)
                }
                if theme == .area55,(key == "robo-front" || key == "robo-walker") {
                    // Preserve the rest centre during resize, then lift the
                    // front120pt/rear20pt through the full tablet projection.
                    // One cumulative offset includes each requested40pt upward adjustment.
                    let height=layer.frame.height*0.85
                    sprite.bounds.size=CGSize(width:layer.frame.width*0.85,height:height)
                    let lift:CGFloat=(key == "robo-front" ? 120:20)/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
                    sprite.layer.position.y-=(layer.frame.height-height)/2+lift
                }
                if theme == .area55,key.hasPrefix("robo-fence") {
                    sprite.layer.position.y-=24/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
                }
            }
            scene.addSubview(sprite);sceneImages[key]=sprite
        }
        let tabletUpperCloudCount=cloudPlans.filter{$0.depth != 415 && $0.yPercent<32}.count
        var tabletUpperCloudIndex=0
        for plan in cloudPlans {let host=UIView(frame:CGRect(x:0,y:0,width:plan.width,height:plan.height));host.backgroundColor = .clear;host.isUserInteractionEnabled=false;host.clipsToBounds=false
            var tabletTopClearance:CGFloat?,tabletDriftDistance:CGFloat?
            let sprite=UIImageView(image:try image(NativeTransitionCloudPlan.assets[plan.asset]));sprite.frame=host.bounds;sprite.contentMode = .scaleAspectFit;host.addSubview(sprite)
            if plan.depth==415 {host.layer.position=CGPoint(x:viewport.width*plan.xPercent/100,y:scene.bounds.height*plan.yPercent/100);host.layer.zPosition=15;scene.addSubview(host)}
            else {host.layer.position=CGPoint(x:viewport.width*plan.xPercent/100,y:viewport.height*plan.yPercent/100);host.layer.zPosition=CGFloat(plan.depth);canvas.addSubview(host)}
            if theme == .beach,NativeTabletLayout.applies(presentationViewport) {
                // Layout only: use the phone's original sampled animation,
                // placing its six clouds above the sea in physical screen space.
                // No drift override or per-frame vertical correction on Beach.
                let spreadX=min(98,max(2,50+(plan.xPercent-50)*1.20))
                let physicalCenter=CGPoint(x:presentationViewport.width*spreadX/100,
                    y:presentationViewport.height*(0.16+plan.yPercent*0.002))
                host.layer.position=canvas.convert(physicalCenter,from:view)
            }
            if theme == .area55,NativeTabletLayout.applies(presentationViewport) {
                host.layer.position.y-=presentationViewport.height*0.35/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
            }
            if theme == .forest,NativeTabletLayout.applies(presentationViewport),plan.depth != 415,plan.yPercent<32 {
                let projection=NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale
                let lane=CGFloat(tabletUpperCloudIndex)/CGFloat(max(1,tabletUpperCloudCount-1))
                // Separate screen-wide lanes instead of crossing the upper
                // clouds into one cluster. Outer lanes travel outward; the
                // centre retains a small independent drift and a lower tier.
                host.layer.position.x=canvas.convert(CGPoint(x:presentationViewport.width*(0.04+0.92*lane),y:0),from:view).x
                host.layer.position.y-=presentationViewport.height*0.20/projection
                let tier:CGFloat=lane<0.25 ? 0:lane>0.75 ? 0.045:0.10
                tabletTopClearance=40+presentationViewport.height*tier
                let travel:CGFloat=lane<0.25 ? -0.32:lane>0.75 ? 0.32:(plan.driftDistance<0 ? -0.08:0.08)
                tabletDriftDistance=presentationViewport.width*travel/projection
                tabletUpperCloudIndex+=1
            }
            host.isHidden=true;sprite.alpha=0
            clouds.append(MountedCloud(plan:plan,host:host,sprite:sprite,tabletTopClearance:tabletTopClearance,tabletDriftDistance:tabletDriftDistance))
        }
        var frames:[NativeTransitionInterpolation.Frame]=[]
        for index in 0..<20 {let intensity=15*(1-Double(index)/20);frames.append(.init(duration:0.025,to:.init(x:(random()-0.5)*intensity*2,y:(random()-0.5)*intensity*2),ease:.linear))}
        frames.append(.init(duration:0.1,to:.init(),ease:.powerOut(2)));shake = .init(initial:.init(),frames:frames)
        if theme == .forest {var images:[String:UIImage]=[:];for index in 1...7 {images["bee\(index)"]=try image("./assets/shop/honey/bee\(index)@2x.png")}
            let bees=NativeForestTransitionBees(viewport:viewport,digitCenters:digitViews.map(\.center),images:images,random:random);guard bees.needsNativeParityReady else{throw PreparationError.bees};bees.mountLayers(in:canvas);self.bees=bees
        }
        if theme == .area55 {combat=NativeTransitionRoboCombatPlan(viewport:viewport,sceneFrame:scene.frame,random:random);try mountCombat(layers:layers)}
        scenePlan=try NativeTransitionScenePlan(theme:theme,layers:layers,viewportWidth:viewport.width,viewportHeight:viewport.height,variation:variation,random:random)
        if theme != .beach {moments.append(.init(key:"start",seconds:0,cue:theme == .forest ? "forest-start":"area55-start",index:0,haptic:nil))}
        if theme == .area55 {for cue in combat!.cues {moments.append(.init(key:"beam\(cue.index)",seconds:cue.seconds,cue:"area55-beam",index:cue.index,haptic:nil))}}
        for index in 0..<2 {moments.append(.init(key:"digit\(index)",seconds:NativeBoardTransitionPlan.digitEnterStart(theme:theme,index:index),cue:"digit",index:index,haptic:nil));moments.append(.init(key:"enterHaptic\(index)",seconds:NativeBoardTransitionPlan.enterHaptic(theme:theme,index:index),cue:nil,index:index,haptic:"light"));moments.append(.init(key:"exitHaptic\(index)",seconds:scenePlan!.exitAt+NativeBoardTransitionPlan.exitHaptic(index:index),cue:nil,index:index,haptic:"light"))}
        moments.sort{$0.seconds<$1.seconds}
        let enter=theme == .area55 ? 2.35:1.35,plan=scenePlan!
        musicContacts=[("begin",0,0.62,enter),("hold",enter,0.5,plan.exitAt-enter),("exit",plan.exitAt,0.2,plan.exitDuration)]


    }
    private func mountCombat(layers:[NativeTransitionSceneGeometry.Layer]) throws {
        for side in [NativeTransitionRoboCombatPlan.Side.left,.right] {let key=side == .left ? "robo-fighter-left":"robo-fighter-right",layer=layers.first{$0.definition.key==key}!
            // Independent extra drops use each ship's authored height, so its
            // complete existing flight/hover/exit path is translated uniformly.
            let shipDrop=NativeTabletLayout.applies(presentationViewport) ? layer.height*(side == .left ? 0.40:0.15):0
            let host=UIView(frame:layer.frame.offsetBy(dx:scene.frame.minX,dy:scene.frame.minY+shipDrop));host.isUserInteractionEnabled=false;host.backgroundColor = .clear;host.clipsToBounds=false
            let sprite=UIImageView(image:try image(layer.definition.asset));sprite.frame=host.bounds;sprite.contentMode = .scaleAspectFit;host.addSubview(sprite);canvas.addSubview(host);fighterViews[side]=(host,sprite)
        }
        for key in ["robo-beam-hit","robo-beam-final"] {let layer=layers.first{$0.definition.key==key}!,sprite=UIImageView(image:try image(layer.definition.asset));sprite.bounds=CGRect(origin:.zero,size:layer.frame.size);sprite.layer.anchorPoint=CGPoint(x:0.88,y:0.75);sprite.contentMode = .scaleAspectFit;sprite.layer.zPosition=29;scene.addSubview(sprite);beamViews[key]=sprite}
    }
    /// Testable actual clock admission, including background and stale routes.
    func paint(seconds:Double,generation:UInt64){guard generation==self.generation,!disposed,!sceneFinished,foreground,assetsReady,seconds.isFinite,seconds>=elapsed,let scenePlan else{return};elapsed=seconds
        view.alpha=NativeBoardTransitionPlan.powerOut(seconds/0.2,2)
        if view.alpha>=1,view.window != nil,paper.image != nil,let ready=onOriginalOpaqueCover {
            onOriginalOpaqueCover=nil;ready(generation)
        }
        // One clock sample is one compositor transaction for every theme.
        // Route/audio callbacks remain outside this transaction.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        if let shake {let p=shake.sample(seconds);view.transform=CGAffineTransform(translationX:p.x,y:p.y)}
        for (key,sprite) in sceneImages {if let p=scenePlan.pose(key:key,seconds:seconds){
            if theme == .beach,(key=="beach-bottle" || key=="beach-ball"),seconds>=(key=="beach-bottle" ? 0.7115:0.79655),sprite.layer.anchorPoint.y != 0.5 {let layer=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation).first{$0.definition.key==key}!;sprite.layer.anchorPoint=CGPoint(x:0.5,y:0.5);sprite.layer.position=CGPoint(x:layer.left,y:scene.bounds.height-layer.bottom-layer.height/2-beachPropLift)}
            let phoneBall=theme == .beach && key == "beach-ball" && !NativeTabletLayout.applies(presentationViewport)
            // Apply to the complete sampled pose so entry/anchor-change/exit
            // retain one continuous16pt lower path on phone only.
            sprite.alpha=min(1,max(0,p.opacity))
            sprite.transform=CGAffineTransform(translationX:p.x*(phoneBall ? 0.65:1),y:p.y+(phoneBall ? 16:0))
                .rotated(by:p.rotation * (phoneBall ? 0.50:1) * .pi/180).scaledBy(x:p.sx,y:p.sy)}}
        for index in clouds.indices {
            guard !clouds[index].retired else{continue}
            let cloud=clouds[index],plan=cloud.plan,host=cloud.host,sprite=cloud.sprite
            let p=plan.sample(seconds:seconds,exitAt:scenePlan.cloudExitAt)
            if p.opacity==0,seconds>=scenePlan.cloudExitAt {
                // Completed clouds have no drawable content and receive no
                // further transforms, including a singular zero-scale matrix.
                clouds[index].retired=true;host.isHidden=true;sprite.alpha=0;sprite.image=nil
                continue
            }
            host.isHidden=p.opacity==0
            let drift=cloud.tabletDriftDistance.map{$0*CGFloat(plan.driftDistance == 0 ? 0:p.wrapperX/plan.driftDistance)} ?? CGFloat(p.wrapperX)
            host.transform=CGAffineTransform(translationX:drift,y:0)
            sprite.alpha=p.opacity
            sprite.transform=CGAffineTransform(translationX:0,y:p.imageY).rotated(by:plan.rotation * .pi/180).scaledBy(x:p.scaleX,y:p.scaleY)
            if let clearance=cloud.tabletTopClearance {
                // Bound the complete rotated/bouncing silhouette in physical
                // screen points, including entry overshoot and root shake.
                // Start from the authored pose each frame; never accumulate a lift.
                let top=sprite.convert(sprite.bounds,to:view).minY+view.transform.ty
                let correction=max(0,clearance-top)/(NativeTabletLayout.animationScale(presentationViewport)*tabletCompositionScale)
                host.transform=CGAffineTransform(translationX:drift,y:correction)
            }
        }
        for (index,digit) in digitViews.enumerated(){let exit=scenePlan.exitAt+0.35+Double(index)*0.4,p=seconds>=exit ? NativeBoardTransitionPlan.digitExit(seconds-exit,index:index,rotation:digitRotations[index]):NativeBoardTransitionPlan.digitEnter(seconds-NativeBoardTransitionPlan.digitEnterStart(theme:theme,index:index),rotation:digitRotations[index]);digit.alpha=min(1,max(0,p.alpha));var matrix=CATransform3DIdentity;matrix.m34 = -1/1000;matrix=CATransform3DTranslate(matrix,0,0,p.z);matrix=CATransform3DRotate(matrix,p.rotation * .pi/180,0,0,1);matrix=CATransform3DRotate(matrix,p.rotationX * .pi/180,1,0,0);matrix=CATransform3DRotate(matrix,p.rotationY * .pi/180,0,1,0);digit.layer.transform=CATransform3DScale(matrix,p.scale,p.scale,1)}
        paintCombat(seconds:seconds)
        bees?.paint(seconds:seconds,mountainBounds:sceneImages["mountain"].map{$0.convert($0.bounds,to:canvas)})
        CATransaction.commit()
        emitMoments(seconds:seconds)
        if seconds>=scenePlan.exitAt+scenePlan.exitDuration {finishScene()}
    }
    private func paintCombat(seconds:Double){guard let combat else{return}
        for (side,(host,image)) in fighterViews {let p=combat.fighter(side:side,seconds:seconds),outer=p.outer,inner=p.inner;host.alpha=min(1,max(0,outer.opacity));host.layer.zPosition=CGFloat(p.depth)
            var t=CGAffineTransform(translationX:outer.x+outer.hoverX,y:outer.y+outer.hoverY).rotated(by:outer.rotation * .pi/180).scaledBy(x:outer.scale,y:outer.scale)
            t=t.concatenating(CGAffineTransform(a:1,b:0,c:tan(outer.skewX * .pi/180),d:1,tx:0,ty:0));host.transform=t
            image.transform=CGAffineTransform(translationX:inner.x,y:inner.y).concatenating(CGAffineTransform(a:1,b:0,c:tan(inner.skewX * .pi/180),d:1,tx:0,ty:0))
        }
        for (key,image) in beamViews {guard let p=combat.beam(key:key,seconds:seconds) else{image.alpha=0;continue};image.alpha=min(1,max(0,p.opacity));image.layer.zPosition=CGFloat(p.depth);image.layer.position=CGPoint(x:p.anchorX,y:p.anchorY);image.transform=CGAffineTransform(rotationAngle:p.rotation * .pi/180).scaledBy(x:p.scaleX,y:p.scaleY)
            image.layer.shadowColor=UIColor(red:104/255,green:239/255,blue:1,alpha:1).cgColor;image.layer.shadowOpacity=Float(p.opacity);image.layer.shadowOffset = .zero;image.layer.shadowRadius=CGFloat(p.glow)
        }
    }
    private func emitMoments(seconds:Double){
        for phase in musicContacts where seconds>=phase.seconds && !fired.contains("music-"+phase.key) {fired.insert("music-"+phase.key);onMusicPhase?(phase.key,phase.ratio,phase.duration)}
        for moment in moments where seconds>=moment.seconds && !fired.contains(moment.key) {fired.insert(moment.key);if let cue=moment.cue {onCue?(cue,moment.index)};if let haptic=moment.haptic {onHaptic?(haptic)}}
    }
    private func cleanupAudio(aborted:Bool){if aborted {guard !audioAborted else{return};audioAborted=true}else{guard !audioNaturalFinished,!audioAborted else{return};audioNaturalFinished=true};onAudioCleanup?(aborted)}
    private func finishScene(){guard !sceneFinished,!disposed else{return};sceneFinished=true;stopClock();view.alpha=1;view.transform = .identity;onMusicPhase?("complete",0.33,0.32);retireScene();cleanupAudio(aborted:false);let complete=onSceneExit;onSceneExit=nil;complete?(generation)}
    /// Release only after the coordinator confirms the prepared board's paint.
    func releaseCover(generation:UInt64){guard generation==self.generation,sceneFinished,!disposed else{return};dispose(aborted:false);view.removeFromSuperview();removeFromParent()}
    func captureCleanup()->()->Void {let captured=self.generation;return {[weak self] in guard let self,self.generation==captured else{return};self.dispose()}}
    private func retireScene(){bees?.dispose();bees=nil;scene.subviews.forEach{$0.removeFromSuperview()};sceneImages.removeAll();clouds.forEach{$0.host.removeFromSuperview()};clouds.removeAll();digitViews.forEach{$0.removeFromSuperview()};digitViews.removeAll();digitUnit.removeFromSuperview();fighterViews.values.forEach{$0.0.removeFromSuperview()};fighterViews.removeAll();beamViews.values.forEach{$0.removeFromSuperview()};beamViews.removeAll();scenePlan=nil;combat=nil;shake=nil;moments.removeAll()
        if !sceneReleased {sceneReleased=true;resources.release(sceneOwner)}
    }
    func setForeground(_ value:Bool){guard !disposed else{return};foreground=value;lastTimestamp=nil;if value{startClockIfReady()}else{stopClock()}}
    private func startClockIfReady(){guard foreground,assetsReady,!disposed,!sceneFinished,displayLink==nil else{return};let proxy=ClockProxy(self);clockProxy=proxy;let link=CADisplayLink(target:proxy,selector:#selector(ClockProxy.tick(_:)));link.add(to:.main,forMode:.common);displayLink=link}
    private func stopClock(){displayLink?.invalidate();displayLink=nil;clockProxy=nil;lastTimestamp=nil}
    @MainActor private final class ClockProxy:NSObject {weak var owner:NativeThemedBoardTransitionController?;init(_ owner:NativeThemedBoardTransitionController){self.owner=owner};@objc func tick(_ link:CADisplayLink){guard let owner else{link.invalidate();return};owner.tick(link)}}
    private func tick(_ link:CADisplayLink){advanceDisplayClock(timestamp:link.timestamp)}
    /// Preparation and route handoff can stall the main thread. Consume visible
    /// animation time in bounded steps rather than skipping the authored enter
    /// on the first frame after that stall. Normal 60/120Hz timing is unchanged;
    /// cues, cover and exit receipts still follow this same presentation clock.
    func advanceDisplayClock(timestamp:CFTimeInterval) {
        guard !disposed,foreground,assetsReady,timestamp.isFinite,viewIfLoaded?.window != nil else{lastTimestamp=nil;return}
        let delta=lastTimestamp.map{min(1.0/30,max(0,timestamp-$0))} ?? 0
        lastTimestamp=timestamp
        paint(seconds:elapsed+delta,generation:generation)
    }
    func dispose(aborted:Bool=true){guard !disposed else{return};disposed=true;stopClock();retireScene();if !paperReleased{paperReleased=true;resources.release(paperOwner)};paper.image=nil;if aborted || !sceneFinished{cleanupAudio(aborted:aborted)};onAudioCleanup=nil;onOriginalOpaqueCover=nil;onSceneExit=nil;onCue=nil;onHaptic=nil;onMusicPhase=nil;onAssetFailure=nil;for observer in observers{NotificationCenter.default.removeObserver(observer)};observers.removeAll()}
}
