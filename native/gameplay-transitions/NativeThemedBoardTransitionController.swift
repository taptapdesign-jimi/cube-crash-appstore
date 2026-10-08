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
    private let paper=UIImageView(),scene=UIView(),paperCover=UIView()
    private var sceneImages:[String:UIImageView]=[:],clouds:[(NativeTransitionCloudPlan.Cloud,UIView,UIImageView)]=[]
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
        self.root=root;self.board=max(1,min(30,board));self.viewport=viewport;self.generation=generation
        theme=NativeBoardTransitionPlan.Theme(board:board);self.resources=resources ?? JimiNativeWorldResources(root:root);self.random=random;artwork=JimiV9Artwork(resourceRoot:root);fontOverride=font
        self.variation=variation ?? NativeThemedTransitionVariationOwner().next(theme:theme,random:random)
        sceneOwner=Self.nextOwner;paperOwner=Self.nextOwner-1;Self.nextOwner -= 2
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use authored native transition initializer")}
    override func loadView(){view=UIView(frame:CGRect(origin:.zero,size:viewport));view.backgroundColor = .clear;view.isOpaque=false;view.clipsToBounds=false
        // Keep the already painted gameplay paper visible while this captured
        // cover prepares. A flat opaque placeholder must never replace it.
        paperCover.frame=view.bounds;paperCover.isHidden=true;paperCover.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1);paperCover.isUserInteractionEnabled=false;view.addSubview(paperCover)
        let gradient=CAGradientLayer();gradient.frame=view.bounds;gradient.colors=[UIColor(red:243/255,green:238/255,blue:232/255,alpha:1).cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor];gradient.locations=[0,0.6,1];paperCover.layer.insertSublayer(gradient,at:0)
        paper.frame=view.bounds;paper.contentMode = .scaleToFill;paper.isUserInteractionEnabled=false;paperCover.addSubview(paper);let tint=UIView(frame:view.bounds);tint.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.4);tint.isUserInteractionEnabled=false;paperCover.addSubview(tint)
        scene.frame=NativeTransitionSceneGeometry.sceneFrame(viewport:viewport);scene.isUserInteractionEnabled=false;scene.clipsToBounds=false;scene.backgroundColor = .clear;scene.layer.zPosition=4;view.addSubview(scene)
    }
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
            guard let self,!self.disposed else{return};guard ready,let image=self.resources.image("./assets/paper-bg.png",owner:self.paperOwner) else{self.failPreparation();return};self.paper.image=image
            self.paperCover.isHidden=false;self.view.backgroundColor=self.paperCover.backgroundColor;self.view.isOpaque=true
            self.resources.prepare(Self.assets(theme:self.theme),owner:self.sceneOwner,required:true){[weak self] ready in
                guard let self,!self.disposed,!self.preparationFailed else{return};guard ready else{self.failPreparation();return}
                do {try self.mountPreparedScene();self.assetsReady=true;self.paint(seconds:0,generation:self.generation);self.startClockIfReady()}catch {self.failPreparation()}
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
        for (index,character) in text.enumerated(){let label=UILabel(frame:CGRect(x:(viewport.width-total)/2+CGFloat(index)*width,y:centerY-83,width:width,height:166));label.text=String(character);label.font=digitFont;label.textColor=UIColor(red:0xE7/255,green:0x74/255,blue:0x49/255,alpha:1);label.textAlignment = .center;label.layer.zPosition=10;label.isUserInteractionEnabled=false;view.addSubview(label);digitViews.append(label);let angle = -8+random()*16;digitRotations.append(index%2==0 ? angle:-angle)}
        let layers=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation)
        for layer in layers {
            let key=layer.definition.key
            guard !key.hasPrefix("robo-fighter"),!key.hasPrefix("robo-beam") else{continue}
            let sprite=UIImageView(image:try image(layer.definition.asset));sprite.bounds=CGRect(origin:.zero,size:layer.frame.size);sprite.layer.anchorPoint=CGPoint(x:0.5,y:1);sprite.layer.position=CGPoint(x:layer.left,y:scene.bounds.height-layer.bottom);sprite.contentMode = .scaleAspectFit;sprite.layer.zPosition=CGFloat(layer.definition.depth);scene.addSubview(sprite);sceneImages[key]=sprite
        }
        for plan in cloudPlans {let host=UIView(frame:CGRect(x:0,y:0,width:plan.width,height:plan.height));host.backgroundColor = .clear;host.isUserInteractionEnabled=false;host.clipsToBounds=false
            let sprite=UIImageView(image:try image(NativeTransitionCloudPlan.assets[plan.asset]));sprite.frame=host.bounds;sprite.contentMode = .scaleAspectFit;host.addSubview(sprite)
            if plan.depth==415 {host.layer.position=CGPoint(x:viewport.width*plan.xPercent/100,y:scene.bounds.height*plan.yPercent/100);host.layer.zPosition=15;scene.addSubview(host)}
            else {host.layer.position=CGPoint(x:viewport.width*plan.xPercent/100,y:viewport.height*plan.yPercent/100);host.layer.zPosition=CGFloat(plan.depth);view.addSubview(host)}
            clouds.append((plan,host,sprite))
        }
        var frames:[NativeTransitionInterpolation.Frame]=[]
        for index in 0..<20 {let intensity=15*(1-Double(index)/20);frames.append(.init(duration:0.025,to:.init(x:(random()-0.5)*intensity*2,y:(random()-0.5)*intensity*2),ease:.linear))}
        frames.append(.init(duration:0.1,to:.init(),ease:.powerOut(2)));shake = .init(initial:.init(),frames:frames)
        if theme == .forest {var images:[String:UIImage]=[:];for index in 1...7 {images["bee\(index)"]=try image("./assets/shop/honey/bee\(index)@2x.png")}
            let bees=NativeForestTransitionBees(viewport:viewport,digitCenters:digitViews.map(\.center),images:images,random:random);guard bees.needsNativeParityReady else{throw PreparationError.bees};bees.mountLayers(in:view);self.bees=bees
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
            let host=UIView(frame:layer.frame.offsetBy(dx:scene.frame.minX,dy:scene.frame.minY));host.isUserInteractionEnabled=false;host.backgroundColor = .clear;host.clipsToBounds=false
            let sprite=UIImageView(image:try image(layer.definition.asset));sprite.frame=host.bounds;sprite.contentMode = .scaleAspectFit;host.addSubview(sprite);view.addSubview(host);fighterViews[side]=(host,sprite)
        }
        for key in ["robo-beam-hit","robo-beam-final"] {let layer=layers.first{$0.definition.key==key}!,sprite=UIImageView(image:try image(layer.definition.asset));sprite.bounds=CGRect(origin:.zero,size:layer.frame.size);sprite.layer.anchorPoint=CGPoint(x:0.88,y:0.75);sprite.contentMode = .scaleAspectFit;sprite.layer.zPosition=29;scene.addSubview(sprite);beamViews[key]=sprite}
    }
    /// Testable actual clock admission, including background and stale routes.
    func paint(seconds:Double,generation:UInt64){guard generation==self.generation,!disposed,!sceneFinished,foreground,assetsReady,seconds.isFinite,seconds>=elapsed,let scenePlan else{return};elapsed=seconds
        view.alpha=NativeBoardTransitionPlan.powerOut(seconds/0.2,2)
        if let shake {let p=shake.sample(seconds);view.transform=CGAffineTransform(translationX:p.x,y:p.y)}
        for (key,sprite) in sceneImages {if let p=scenePlan.pose(key:key,seconds:seconds){
            if theme == .beach,(key=="beach-bottle" || key=="beach-ball"),seconds>=(key=="beach-bottle" ? 0.7115:0.79655),sprite.layer.anchorPoint.y != 0.5 {let layer=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation).first{$0.definition.key==key}!;sprite.layer.anchorPoint=CGPoint(x:0.5,y:0.5);sprite.layer.position=CGPoint(x:layer.left,y:scene.bounds.height-layer.bottom-layer.height/2)}
            sprite.alpha=min(1,max(0,p.opacity));sprite.transform=CGAffineTransform(translationX:p.x,y:p.y).rotated(by:p.rotation * .pi/180).scaledBy(x:p.sx,y:p.sy)}}
        for (plan,host,sprite) in clouds {let p=plan.sample(seconds:seconds,exitAt:scenePlan.cloudExitAt);host.transform=CGAffineTransform(translationX:p.wrapperX,y:0);sprite.alpha=p.opacity;sprite.transform=CGAffineTransform(translationX:0,y:p.imageY).rotated(by:plan.rotation * .pi/180).scaledBy(x:p.scaleX,y:p.scaleY)}
        for (index,digit) in digitViews.enumerated(){let exit=scenePlan.exitAt+0.35+Double(index)*0.4,p=seconds>=exit ? NativeBoardTransitionPlan.digitExit(seconds-exit,index:index,rotation:digitRotations[index]):NativeBoardTransitionPlan.digitEnter(seconds-NativeBoardTransitionPlan.digitEnterStart(theme:theme,index:index),rotation:digitRotations[index]);digit.alpha=min(1,max(0,p.alpha));var matrix=CATransform3DIdentity;matrix.m34 = -1/1000;matrix=CATransform3DTranslate(matrix,0,0,p.z);matrix=CATransform3DRotate(matrix,p.rotation * .pi/180,0,0,1);matrix=CATransform3DRotate(matrix,p.rotationX * .pi/180,1,0,0);matrix=CATransform3DRotate(matrix,p.rotationY * .pi/180,0,1,0);digit.layer.transform=CATransform3DScale(matrix,p.scale,p.scale,1)}
        paintCombat(seconds:seconds)
        bees?.paint(seconds:seconds,mountainBounds:sceneImages["mountain"].map{$0.convert($0.bounds,to:view)})
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
    private func retireScene(){bees?.dispose();bees=nil;scene.subviews.forEach{$0.removeFromSuperview()};sceneImages.removeAll();clouds.forEach{$0.1.removeFromSuperview()};clouds.removeAll();digitViews.forEach{$0.removeFromSuperview()};digitViews.removeAll();fighterViews.values.forEach{$0.0.removeFromSuperview()};fighterViews.removeAll();beamViews.values.forEach{$0.removeFromSuperview()};beamViews.removeAll();scenePlan=nil;combat=nil;shake=nil;moments.removeAll()
        if !sceneReleased {sceneReleased=true;resources.release(sceneOwner)}
    }
    func setForeground(_ value:Bool){guard !disposed else{return};foreground=value;lastTimestamp=nil;if value{startClockIfReady()}else{stopClock()}}
    private func startClockIfReady(){guard foreground,assetsReady,!disposed,!sceneFinished,displayLink==nil else{return};let proxy=ClockProxy(self);clockProxy=proxy;let link=CADisplayLink(target:proxy,selector:#selector(ClockProxy.tick(_:)));link.add(to:.main,forMode:.common);displayLink=link}
    private func stopClock(){displayLink?.invalidate();displayLink=nil;clockProxy=nil;lastTimestamp=nil}
    @MainActor private final class ClockProxy:NSObject {weak var owner:NativeThemedBoardTransitionController?;init(_ owner:NativeThemedBoardTransitionController){self.owner=owner};@objc func tick(_ link:CADisplayLink){guard let owner else{link.invalidate();return};owner.tick(link)}}
    private func tick(_ link:CADisplayLink){let delta=lastTimestamp.map{max(0,link.timestamp-$0)} ?? 0;lastTimestamp=link.timestamp;paint(seconds:elapsed+delta,generation:generation)}
    func dispose(aborted:Bool=true){guard !disposed else{return};disposed=true;stopClock();retireScene();if !paperReleased{paperReleased=true;resources.release(paperOwner)};paper.image=nil;if aborted || !sceneFinished{cleanupAudio(aborted:aborted)};onAudioCleanup=nil;onSceneExit=nil;onCue=nil;onHaptic=nil;onMusicPhase=nil;onAssetFailure=nil;for observer in observers{NotificationCenter.default.removeObserver(observer)};observers.removeAll()}
}
