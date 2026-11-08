import UIKit
import StackToSixNativeState

@MainActor
protocol NativeRewardResources:AnyObject {
    func image(_ path:String,owner:Int)->UIImage?
    func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void)
    func release(_ owner:Int)
}
extension JimiNativeWorldResources:NativeRewardResources {}
@MainActor
private final class RewardTimer:NativeMusicCancellation {
    var timer:Timer?
    func cancel(){timer?.invalidate();timer=nil}
}
@MainActor
private final class RewardScheduler:NativeMusicScheduler {
    func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {
        let result=RewardTimer();result.timer=Timer.scheduledTimer(withTimeInterval:max(0.001,seconds),repeats:false) { [weak result] _ in MainActor.assumeIsolated{result?.timer=nil;callback()} };return result
    }
}

/// Native presentation of an already committed Journey reward. No save/unlock
/// mutation. One finite contact owner hands each face to visible idle/drag work.
@MainActor
final class NativeJourneyRewardController:UIViewController,UIGestureRecognizerDelegate {
    enum Action {case collect,cancelled}
    let board:Int,score:Int
    private let awardedStars:Int
    private var rewardActionsAdmitted=true
    private let resourceRoot:URL
    private let magic=NativeMagicCardReveal(),unlockedEffects=NativeMagicCardReveal()
    private var magicOpened=false,magicOpening=false,magicPrepared=false,cardPrepared=false
    private var unlockedEffectsPreparing=false,unlockedEffectsPrepared=false,unlockedEffectsPreparationComplete=false,unlockedBounceFinished=false
    var prepareMagicCard:(URL,NativeRewardPreparationLease,@escaping(NativeMagicCardSource.Node?)->Void)->Void=NativeMagicCardSource.load
    private let assets:JimiV9Artwork
    private let resources:any NativeRewardResources
    private let scheduler:any NativeMusicScheduler
    private let random:()->Double
    private let tilt:NativeRewardPresentation.Tilt
    private let reducedMotion:Bool
    private let generation:UInt64
    var presentationGeneration:UInt64 {generation}
    var initialPresentationReady:Bool {magicPrepared || phase == "asset-failed"}
    private var magicPreparationWaiters:[()->Void]=[]
    func whenMagicCardPrepared(_ completion:@escaping ()->Void) {
        guard !disposed,phase != "asset-failed" else{return}
        if magicPrepared {completion()}else {magicPreparationWaiters.append(completion)}
    }
    private var paper:NativeAppPaperSurface!
    private let hero=UIView(),interim=JimiNativeModalTransformView(),unlocked=JimiNativeModalTransformView(),pose=JimiNativeModalTransformView(),front=UIImageView(),hand=UIImageView()
    private let interimRotor=JimiNativeModalTransformView(),unlockedRotor=JimiNativeModalTransformView()
    static let collectBackAssetPath="assets/colelctibles/cardflip@22.png"
    static let unlockedSubtitleEntryDelay=0.300
    static let unlockedHeadingEntryDelay=0.420
    static let unlockedArtworkEntryDelay=0.540
    private let collectBack=UIImageView()
    private let headingLabel=UILabel(),subtitle=UILabel(),coach=UILabel()
    private var coachGlyphs:[UILabel]=[]
    private let foil=NativeRewardFoil()
    private var holo:CALayer {foil.layer}
    private let glow=CALayer()
    private let preparationLease=NativeRewardPreparationLease()
    private var tap:UITapGestureRecognizer!,pan:UIPanGestureRecognizer!
    private var observations:[NSObjectProtocol]=[]
    @MainActor private final class Work {
        let callback:()->Void,allowResolved:Bool,epoch:UInt64
        var remaining:Double,deadline:Double=0,lease:UInt64=0,cancellation:(any NativeMusicCancellation)?
        init(after:Double,allowResolved:Bool,epoch:UInt64,callback:@escaping ()->Void){remaining=after;self.allowResolved=allowResolved;self.epoch=epoch;self.callback=callback}
        func cancel(){lease &+= 1;cancellation?.cancel();cancellation=nil}
    }
    private var tasks:[String:Work]=[:]
    private let now:()->Double
    private var preparedImages:[String:UIImage]=[:]
    private var maskImage:CGImage?
    private var ownedLayers:[CALayer]=[]
    private var epoch:UInt64=1
    private var disposed=false,resolved=false,revealRunning=false,revealed=false,queuedCollect=false,waitingReveal=false,started=false,foreground=true,assetsReady=false,waitingCrumble=false
    private var dragStart=0.0,dragAngle=0.0,dragAxis:String?
    private(set) var phase="mounted"
    var onFinish:((Action)->Void)?
    var onSoundMoment:((String,Int,UInt64)->Void)?
    var onHaptic:((String)->Void)?
    var onAssetFailure:((String)->Void)?
    /// Tests can accept already prepared immutable carriers without invoking CI.
    var prepareFilteredFrames:(([String:UIImage],NativeRewardPreparationLease,@escaping ([String:UIImage])->Void)->Void)=NativeRewardFilteredFrames.prepare
    private var resourceOwner:Int {-50000-board}
    private var rarity:String {awardedStars==3 ? "legendary":"common"}
    private var cardPath:String {NativeJourneyContent.cardAsset(board:board,stars:awardedStars,doubleDensity:true)}
    private var maskPath:String {NativeJourneyContent.cardAsset(board:board,stars:awardedStars)}
    init(root:URL,board:Int,score:Int,generation:UInt64,awardedStars:Int?=nil,resources:(any NativeRewardResources)?=nil,scheduler:(any NativeMusicScheduler)?=nil,reducedMotion:Bool?=nil,random:@escaping ()->Double={Double.random(in:0..<1)},now:@escaping ()->Double={ProcessInfo.processInfo.systemUptime}) {
        self.awardedStars=max(0,min(3,awardedStars ?? NativeJourneyContent.earnedStars(score:score,board:board)))
        self.resourceRoot=root;self.board=max(1,min(30,board));self.score=score;self.generation=generation;self.resources=resources ?? JimiNativeWorldResources(root:root)
        self.scheduler=scheduler ?? RewardScheduler();self.random=random;self.now=now;self.reducedMotion=reducedMotion ?? UIAccessibility.isReduceMotionEnabled;tilt=NativeRewardPresentation.Tilt(random:random);assets=JimiV9Artwork(resourceRoot:root)
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    func setRewardActionsAdmitted(_ value:Bool){rewardActionsAdmitted=value}
    required init?(coder:NSCoder){fatalError("Use Native reward initializer")}
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        paper=NativeAppPaperSurface(artwork:assets);view.addSubview(paper)
        for label in [headingLabel,subtitle,coach] {label.textAlignment = .center;label.isUserInteractionEnabled=false;view.addSubview(label)}
        headingLabel.text="New Reward";headingLabel.textColor=NativeTextPalette.accentOrange
        subtitle.text="Tap the card to reveal";subtitle.textColor=NativeTextPalette.subtitle
        coach.text="TAP TO COLLECT";coach.accessibilityIdentifier="native.reward.coach-copy"
        coach.font=assets.font(size:32,weight:"ExtraBold");coach.textColor = .clear;coach.alpha=0
        coach.clipsToBounds=false;coach.isAccessibilityElement=true
        coach.shadowColor=nil;coach.shadowOffset = .zero;coach.layer.shadowOpacity=0
        coachGlyphs=Array(coach.text ?? "").enumerated().map { index,letter in
            let glyph=NativeCoachCopyMotion.collectGlyph(letter,font:coach.font)
            glyph.accessibilityIdentifier="native.reward.coach-glyph.\(index)"
            coach.addSubview(glyph);return glyph
        }
        hero.accessibilityIdentifier="native.reward.card";hero.accessibilityLabel="Reveal \(NativeRewardPresentation.name(board:board))";hero.accessibilityTraits = .button
        view.addSubview(hero);hero.layer.allowsGroupOpacity=false
        interim.layer.name="native.reward.interim-spatial";unlocked.layer.name="native.reward.unlocked-spatial"
        pose.layer.name="native.reward.card-pose";pose.layer.zPosition=1;hero.addSubview(pose);pose.addSubview(interim);pose.addSubview(unlocked)
        interim.layer.zPosition=1;interim.addSubview(interimRotor);unlocked.addSubview(unlockedRotor);interimRotor.layer.addSublayer(magic.layer);unlockedRotor.addSubview(collectBack);unlockedRotor.addSubview(front);front.layer.addSublayer(unlockedEffects.layer)
        unlockedRotor.layer.name="native.reward.collect-rotor"
        collectBack.accessibilityIdentifier="native.reward.collect-back";collectBack.layer.name="native.reward.collect-back"
        collectBack.contentMode = .scaleAspectFit;collectBack.layer.isDoubleSided=false;front.layer.isDoubleSided=false
        front.accessibilityIdentifier="native.reward.card-front";front.layer.name="native.reward.card-front"
        for image in [front,hand] {image.contentMode = .scaleAspectFit;image.isUserInteractionEnabled=false}
        view.addSubview(hand);hand.alpha=0;hand.layer.shadowColor=UIColor(red:132/255,green:82/255,blue:63/255,alpha:1).cgColor;hand.layer.shadowOpacity=0.24;hand.layer.shadowOffset=CGSize(width:0,height:12);hand.layer.shadowRadius=16
        glow.name="native.reward.unlocked-burn";glow.opacity=0;glow.contentsGravity = .resizeAspect;glow.zPosition=0.5;glow.isDoubleSided=false
        unlockedRotor.layer.addSublayer(glow)
        unlockedRotor.layer.addSublayer(holo)
        tap=UITapGestureRecognizer(target:self,action:#selector(tapped));pan=UIPanGestureRecognizer(target:self,action:#selector(panned(_:)));tap.delegate=self;pan.delegate=self;tap.require(toFail:pan);hero.addGestureRecognizer(tap);hero.addGestureRecognizer(pan)
        ownedLayers=[view.layer,headingLabel.layer,subtitle.layer,hero.layer,pose.layer,interim.layer,unlocked.layer,interimRotor.layer,unlockedRotor.layer,front.layer,collectBack.layer,hand.layer,coach.layer,glow,holo]+coachGlyphs.map(\.layer)
        headingLabel.layer.opacity=0;subtitle.layer.opacity=0;hero.layer.opacity=0;front.layer.opacity=0;collectBack.layer.opacity=0
        applyFace(interim,scale:1,y:40,z:0,x:0,ry:0)
        applyFace(unlocked,scale:0,y:22,z:tilt.entryZ,x:tilt.entryX,ry:tilt.entryY,depth:-180)
        let paths=[cardPath,maskPath,"assets/hand-pointer.png",Self.collectBackAssetPath]
        resources.prepare(paths,owner:resourceOwner,required:true) { [weak self] accepted in
            guard let self,!self.disposed,!self.resolved else{return}
            for path in paths {if let image=self.resources.image(path,owner:self.resourceOwner) {self.preparedImages[path]=image}}
            self.maskImage=self.preparedImages[self.cardPath]?.cgImage
            self.front.image=self.preparedImages[self.cardPath];self.hand.image=self.preparedImages["assets/hand-pointer.png"];self.collectBack.image=self.preparedImages[Self.collectBackAssetPath]
            guard accepted,paths.allSatisfy({self.preparedImages[$0] != nil}) else {
                self.phase="asset-failed";self.onAssetFailure?("Selected Native reward artwork preparation failed");return
            }
            self.view.setNeedsLayout()
            guard self.rarity=="legendary" else {
                self.cardPrepared=true;self.unlockedEffectsPreparationComplete=true
                self.admitPreparedArtwork();return
            }
            self.prepareFilteredFrames(self.preparedImages,self.preparationLease) { [weak self] filtered in
                guard let self,!self.disposed,!self.resolved else{return};self.glow.contents=filtered[self.cardPath+"#burn"]?.cgImage;self.cardPrepared=true;self.prepareUnlockedEffects();self.admitPreparedArtwork()
            }
        }
        prepareMagicCard(resourceRoot,preparationLease) { [weak self] source in
            guard let self,!self.disposed,!self.resolved else{return}
            guard let source else{self.phase="asset-failed";self.onAssetFailure?("Native magic-card SVG preparation failed");return}
            self.magic.install(source);self.magicPrepared=true;self.view.setNeedsLayout();self.admitPreparedArtwork()
            let ready=self.magicPreparationWaiters;self.magicPreparationWaiters=[];ready.forEach{$0()}
        }
        observations=[NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated {self?.setForeground(false)} },NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated {self?.setForeground(true)} }]
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();paper.frame=view.bounds
        NativeRewardCardRendering.configure(faces:[hero],images:[],displayScale:view.window?.screen.scale ?? traitCollection.displayScale)
        let aspect=(hand.image?.size.height ?? 1)/max(1,hand.image?.size.width ?? 1)
        let layout=NativeRewardPresentation.Layout(width:view.bounds.width,height:view.bounds.height,bottomSafe:view.safeAreaInsets.bottom,handAspect:aspect)
        // A Collect track publishes zero-scale model endpoints. Setting frame
        // then would erase UILabel bounds; preserve geometry via bounds/center.
        func place(_ target:UIView,_ rect:CGRect) {
            target.bounds=CGRect(origin:.zero,size:rect.size);target.center=CGPoint(x:rect.midX,y:rect.midY)
        }
        place(headingLabel,layout.title);place(subtitle,layout.subtitle);place(hero,layout.hero)
        headingLabel.font=assets.font(size:layout.titleFont,weight:"ExtraBold");subtitle.font=assets.font(size:layout.subtitleFont,weight:"SemiBold")
        place(pose,hero.bounds);interim.bounds=hero.bounds;interim.center=CGPoint(x:hero.bounds.midX,y:hero.bounds.midY);unlocked.bounds=hero.bounds;unlocked.center=interim.center
        place(interimRotor,interim.bounds);place(unlockedRotor,unlocked.bounds)
        front.bounds=unlocked.bounds;front.center=CGPoint(x:unlocked.bounds.midX,y:unlocked.bounds.midY);front.transform=CGAffineTransform(translationX:0,y:-4).scaledBy(x:NativeRewardPresentation.unlockedArtworkScale,y:NativeRewardPresentation.unlockedArtworkScale)
        collectBack.bounds=front.bounds;collectBack.center=front.center
        var backTransform=CATransform3DMakeTranslation(0,-4,-0.6)
        backTransform=CATransform3DRotate(backTransform,.pi,0,1,0)
        collectBack.layer.transform=CATransform3DScale(backTransform,NativeRewardPresentation.unlockedArtworkScale,NativeRewardPresentation.unlockedArtworkScale,1)
        place(hand,layout.hand);place(coach,layout.coach)
        NativeCoachCopyMotion.layoutCollectGlyphs(coachGlyphs,in:coach.bounds,font:coach.font)
        CATransaction.begin();CATransaction.setDisableActions(true)
        let effectScale=view.window?.screen.scale ?? view.traitCollection.displayScale
        for layer in [glow] {layer.contentsScale=max(1,effectScale);layer.allowsEdgeAntialiasing=true;layer.edgeAntialiasingMask=[.layerLeftEdge,.layerRightEdge,.layerTopEdge,.layerBottomEdge];layer.minificationFilter = .trilinear;layer.magnificationFilter = .linear}
        layoutUnlockedEffects()
        let artworkScale=NativeRewardPresentation.unlockedArtworkScale
        glow.frame=CGRect(x:unlocked.bounds.width*(1-artworkScale)/2,y:unlocked.bounds.height*(1-artworkScale)/2-4,width:unlocked.bounds.width*artworkScale,height:unlocked.bounds.height*artworkScale);holo.frame=unlocked.bounds
        let maskImage=self.maskImage
        foil.layout(unlocked.bounds,mask:maskImage,displayScale:effectScale,artworkScale:NativeRewardPresentation.unlockedArtworkScale)
        CATransaction.commit();magic.layout(in:interimRotor.bounds)
    }
    private func admitPreparedArtwork() {
        guard phase != "asset-failed" else{return}
        if foreground,started,magicPrepared,!magicOpening,!magicOpened {crumble()}
        guard cardPrepared,magicPrepared,unlockedEffectsPreparationComplete else{return};assetsReady=true
        if foreground,started,waitingReveal,magicOpened {waitingReveal=false;reveal()}
    }
    override func viewDidAppear(_ animated:Bool) {super.viewDidAppear(animated);start()}
    func start() {
        guard !started,!disposed,!revealRunning,!revealed,!resolved else{return};started=true;phase="entering"
        onSoundMoment?("modal-open",0,generation)
        onSoundMoment?("new-card-happy",0,generation);onHaptic?("medium")
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0,y:-28)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.24,ease:.backOut(1.65))
        animate(headingLabel.layer,"opacity",from:0,to:1,duration:0.24)
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0,y:-22)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.24,delay:0.032,ease:.backOut(1.65));animate(subtitle.layer,"opacity",from:0,to:1,duration:0.24,delay:0.032)
        // The selected SVG starts immediately; its parent spring starts on the
        // same admission clock without a lead-in or artwork/filter gate.
        CATransaction.begin();CATransaction.setDisableActions(true)
        pose.layer.transform=CATransform3DIdentity;hero.layer.opacity=1;CATransaction.commit()
        later("intro-haptic",after:0.12){ [weak self] in self?.onHaptic?("light")}
        later("intro-haptic2",after:0.24){ [weak self] in self?.onHaptic?("medium")}
        if magicPrepared {crumble()}else{waitingCrumble=true}
    }
    @objc private func tapped(){activate()}
    func activate() {
        guard rewardActionsAdmitted,foreground,!disposed,!resolved,phase != "asset-failed" else{return}
        if !magicOpened,!revealed {
            // An early tap requests reveal after the authored opening settles;
            // duplicates cannot skip opening or invisibly collect the reward.
            waitingReveal=true
            if !assetsReady {phase="awaiting-artwork"}
            else if started,!magicOpening {crumble()}
            return
        }
        switch NativeRewardPresentation.tapAction(revealed:revealed,revealRunning:revealRunning,resolved:resolved,disposed:disposed) {
        case .reveal:reveal()
        case .queueCollect:queuedCollect=true
        case .collect:collect()
        case .ignore:break
        }
    }
    private func crumble() {
        guard foreground,started,magicPrepared,!disposed,!revealRunning,!revealed,!magicOpening,!magicOpened else{return}
        magicOpening=true;phase="opening"
        onSoundMoment?("new-card-interim-speech",0,generation)
        // SVG retains its authored opening/dust/angular tracks; the parent owns
        // the requested additional finite scale bounce.
        // Start at visible admission or immediately upon selected SVG readiness.
        waitingCrumble=false
        animateCardEntrance(pose.layer,from:NativeRewardMotion.pose(scale:0),to:NativeRewardMotion.pose(),delay:reducedMotion ? 0:NativeMagicCardSource.fullyOpenAt,fromRest:!reducedMotion)
        magic.play(from:0,to:NativeMagicCardSource.hold,reduced:reducedMotion,parentOwnsCardScale:true)
        let openingDuration=reducedMotion ? 0.16:NativeMagicCardSource.hold
        later("opening-crumbs",after:openingDuration*0.20){[weak self] in
            guard let self else{return}
            self.onSoundMoment?("new-card-intro",0,self.generation)
            self.onSoundMoment?("new-card-crumble",0,self.generation)
        }
        later("opening-puff",after:openingDuration*0.50){[weak self] in
            guard let self else{return};self.onSoundMoment?("new-card-opening-puff",0,self.generation)
        }
        later("interim-effects",after:reducedMotion ? 0.16:NativeMagicCardSource.fullyOpenAt) { [weak self] in
            guard let self,!self.revealRunning,!self.revealed else{return}
            self.magic.playCardShimmer(reduced:self.reducedMotion)
            self.shake(strength:22,duration:0.42)
        }
        later("magic-opened",after:reducedMotion ? 0.16:NativeMagicCardSource.hold) { [weak self] in
            guard let self,self.phase != "asset-failed",!self.revealRunning,!self.revealed else{return}
            self.magic.settle(at:NativeMagicCardSource.hold);self.magicOpening=false;self.magicOpened=true;self.phase="interim";self.onHaptic?("medium")
            if self.waitingReveal {self.waitingReveal=false;self.reveal()}else{self.startInterimIdle()}
        }
    }
    private func startInterimIdle() {
        guard !reducedMotion,foreground,!disposed,!resolved,magicOpened,!revealed,!revealRunning else{return}
        // The settled SVG stays intact; its two existing parent carriers own
        // the gentle float and tilt on the compositor, without recurring timers.
        cssTrack(pose.layer,poses:[NativeRewardMotion.pose(),NativeRewardMotion.pose(scale:1.02,y:-8),NativeRewardMotion.pose()],offsets:[0,0.5,1],duration:3,repeating:true)
        let poses=[NativeRewardMotion.pose(),NativeRewardMotion.pose(z:1.35,x:-2.3,ry:2.6,depth:5),NativeRewardMotion.pose(z:-1.15,x:1.65,ry:-2.35,depth:3),NativeRewardMotion.pose(z:0.3,x:-0.4,ry:0.7,depth:1),NativeRewardMotion.pose()]
        cssTrack(interimRotor.layer,poses:poses,offsets:[0,0.28,0.58,0.78,1],duration:3,interimOrder:true,repeating:true)
    }
    private func reveal() {
        guard !disposed,!resolved,!revealRunning,!revealed else{return}
        guard assetsReady else {waitingReveal=true;phase="awaiting-artwork";return}
        let idlePose=pose.layer.presentation()?.transform ?? pose.layer.transform
        let idleRotor=interimRotor.layer.presentation()?.transform ?? interimRotor.layer.transform
        waitingReveal=false;epoch &+= 1;cancelTasks();removeAnimations();waitingCrumble=false
        phase="revealing";revealRunning=true;hero.layer.opacity=1;pose.layer.transform=CATransform3DIdentity
        interimRotor.layer.transform=CATransform3DIdentity
        if !reducedMotion {
            animate(pose.layer,"transform",from:NSValue(caTransform3D:idlePose),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.16)
            animate(interimRotor.layer,"transform",from:NSValue(caTransform3D:idleRotor),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.16)
        }
        onHaptic?("medium");onSoundMoment?("new-card-reveal",0,generation)
        magic.layer.opacity=1
        let closedExit=reducedMotion ? 0.16:(NativeMagicCardSource.end-NativeMagicCardSource.hold)*1.3
        let unlockedDelay=Self.unlockedArtworkEntryDelay
        later("unlocked-enter-sound",after:unlockedDelay){[weak self] in guard let self else{return};self.onSoundMoment?("new-card-unlocked-enter",0,self.generation);self.onSoundMoment?("new-card-unlock-speech",self.rarity=="legendary" ? 1:0,self.generation)}
        magic.stopCardShimmer()
        magic.play(from:NativeMagicCardSource.hold,to:NativeMagicCardSource.end,reduced:reducedMotion,durationScale:1.3)
        headingLabel.layer.opacity=0;subtitle.layer.opacity=0
        animate(unlocked.layer,"opacity",from:0,to:1,duration:0.001,delay:unlockedDelay)
        let unlockedTextColor=NativeTextPalette.accentOrange
        headingLabel.text=rarity=="legendary" ? "Legendary!":"Common"
        headingLabel.textColor=unlockedTextColor
        let copy=NSMutableAttributedString(string:"Unlocked \(NativeRewardPresentation.name(board:board))")
        copy.addAttribute(.foregroundColor,value:unlockedTextColor,range:NSRange(location:0,length:copy.length))
        copy.addAttribute(.foregroundColor,value:NativeTextPalette.subtitle,range:NSRange(location:0,length:("Unlocked" as NSString).length))
        subtitle.attributedText=copy
        let enter=reducedMotion ? 0.16:NativeRewardMotion.cardEnterDuration
        animateCardEntrance(unlocked.layer,from:NativeRewardMotion.pose(scale:0,y:22,z:tilt.entryZ,x:tilt.entryX,ry:tilt.entryY,depth:-180),to:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.restZ,x:tilt.restX,ry:tilt.restY),delay:unlockedDelay)
        animate(headingLabel.layer,"opacity",from:0,to:1,duration:0.192,delay:Self.unlockedHeadingEntryDelay);animate(subtitle.layer,"opacity",from:0,to:1,duration:0.192,delay:Self.unlockedSubtitleEntryDelay)
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0.72,y:-16)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.192,delay:Self.unlockedHeadingEntryDelay,ease:.backOut(1.65))
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0.78,y:-12)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.192,delay:Self.unlockedSubtitleEntryDelay,ease:.backOut(1.65))
        later("reveal-haptic",after:0.176){ [weak self] in self?.onHaptic?("light") }
        if rarity=="legendary" {
            later("unlocked-effects",after:unlockedDelay+enter) { [weak self] in
                guard let self else{return};self.unlockedBounceFinished=true;self.admitUnlockedEffects()
            }
        }
        later("impact",after:max(closedExit,unlockedDelay+enter)){ [weak self] in guard let self else{return};self.shine();self.shake(strength:22,duration:0.42);self.onHaptic?("medium") }
        later("revealed",after:max(closedExit,unlockedDelay+enter)+0.192) { [weak self] in
            guard let self else{return};self.magic.layer.opacity=0;self.magic.dispose();self.phase="unlocked";self.revealRunning=false;self.revealed=true;self.hero.accessibilityLabel="Collect \(NativeRewardPresentation.name(board:self.board))"
            self.onHaptic?("light");if self.queuedCollect {self.collect()}else{self.scheduleCoach(after:1);self.scheduleUnlockedIdle(after:3)}
        }
    }
    private func collect() {
        guard !disposed,!resolved,!revealRunning,revealed else{return}
        let exitLayers=[pose.layer,headingLabel.layer,subtitle.layer]
        let exitPoses=exitLayers.map{$0.presentation()?.transform ?? $0.transform}
        let coachPoses=coachGlyphs.map{($0.layer.presentation()?.transform ?? $0.layer.transform,$0.layer.presentation()?.opacity ?? $0.layer.opacity)}
        let facePose=unlocked.layer.presentation()?.transform ?? unlocked.layer.transform
        let rotorPose=unlockedRotor.layer.presentation()?.transform ?? unlockedRotor.layer.transform
        let rootPose=view.layer.presentation()?.transform ?? view.layer.transform
        // Publish the captured hold, turn and delayed collapse atomically.
        CATransaction.begin();CATransaction.setDisableActions(true)
        defer {CATransaction.commit()}
        resolved=true;preparationLease.cancel();phase="exiting";epoch &+= 1;cancelTasks();removeAnimations();hand.alpha=0;coach.alpha=1
        // Keep the copy container visible: each painted glyph retires separately.
        for (index,glyph) in coachGlyphs.enumerated() {
            let (transform,opacity)=coachPoses[index]
            let delay=reducedMotion ? 0:Double(index)*0.014
            animate(glyph.layer,"opacity",from:opacity,to:Float(0),duration:0.18,delay:delay)
            let end=CATransform3DScale(CATransform3DTranslate(transform,0,14,0),0.75,0.75,1)
            animate(glyph.layer,"transform",from:NSValue(caTransform3D:transform),to:NSValue(caTransform3D:end),duration:0.18,delay:delay)
        }
        CATransaction.begin();CATransaction.setDisableActions(true)
        view.layer.transform=rootPose
        unlocked.layer.transform=facePose;unlockedRotor.layer.transform=rotorPose
        for (index,target) in exitLayers.enumerated(){target.transform=exitPoses[index]}
        CATransaction.commit()
        onSoundMoment?("new-card-collect",0,generation);onHaptic?("selection")
        // Text exits start at tap: rarity first, then Unlocked80ms later.
        // The card retains its contact bounce and collapse with the return flip.
        let track=JimiV9Motion.homeExit(.hero)
        let duration=reducedMotion ? 0.16:track.duration*NativeRewardMotion.collectExitTimeScale
        let flipDuration=reducedMotion ? 0:NativeRewardMotion.collectFlipDuration(forExitDuration:track.duration)
        let bounceDuration=reducedMotion ? 0:NativeHUDTapMotion.duration
        let stagger=reducedMotion ? 0:0.08
        let motionStart=CACurrentMediaTime()
        if !reducedMotion {
            let count=80
            let values=(0...count).map { sample -> NSValue in
                let contact=NativeHUDTapMotion.pose(at:Double(sample)/Double(count)*bounceDuration)
                let translated=CATransform3DTranslate(facePose,0,contact.offset,0)
                return NSValue(caTransform3D:CATransform3DScale(translated,contact.x,contact.y,1))
            }
            keyframes(unlocked.layer,"transform",values:values,times:(0...count).map{Double($0)/Double(count)},duration:bounceDuration,final:NSValue(caTransform3D:facePose),startTime:motionStart)
        }
        for (index,target) in [pose.layer,headingLabel.layer,subtitle.layer].enumerated() {
            let start=exitPoses[index]
            let targetDuration=index==0 && !reducedMotion ? track.duration*NativeRewardMotion.collectCardExitTimeScale:duration
            let count=64
            let values=(0...count).map { sample -> NSValue in
                let progress=Double(sample)/Double(count)
                let frame=reducedMotion ? JimiV9Motion.Pose.scale(1-progress):track.pose(at:progress*track.duration)
                let sx=index==0 && !reducedMotion ? NativeRewardMotion.collectCardExitScale(progress:progress):frame.scaleX
                let sy=index==0 && !reducedMotion ? NativeRewardMotion.collectCardExitScale(progress:progress):frame.scaleY
                return NSValue(caTransform3D:CATransform3DScale(start,sx,sy,1))
            }
            let exitDelay=index==0 ? bounceDuration+flipDuration:Double(index-1)*stagger
            keyframes(target,"transform",values:values,times:(0...count).map{Double($0)/Double(count)},duration:targetDuration,delay:exitDelay,final:values.last,startTime:motionStart)
        }
        if !reducedMotion {
            // The original World automatic-return backface turns with the same
            // selected rotor; its front-only effects are culled with the front.
            // Draw once per accepted collect, never once per keyframe or tap.
            let direction=random()<0.5 ? -1.0:1.0
            // The first half-turn holds size. The card immediately shrinks at
            // the return half-turn boundary, without Home anticipation.
            // Both turns share one precommitted rotor track and captured pose.
            let flipSamples=100,totalSamples=flipSamples*2
            let turns=(0...totalSamples).map { index in
                let progress=Double(index)/Double(flipSamples)
                let angle=NativeRewardMotion.collectFlipAngle(progress:progress)
                    + NativeRewardMotion.collectFlipAngle(progress:progress-1)
                return NSValue(caTransform3D:CATransform3DRotate(rotorPose,direction*angle,0,1,0))
            }
            keyframes(unlockedRotor.layer,"transform",values:turns,times:(0...totalSamples).map{Double($0)/Double(totalSamples)},duration:flipDuration*2,delay:bounceDuration,final:turns.last,startTime:motionStart)
            shake(strength:22,duration:0.42,delay:bounceDuration+flipDuration*2,startTime:motionStart,base:rootPose)
        }
        let finish=bounceDuration+flipDuration+duration+stagger*2
        animate(view.layer,"opacity",from:1,to:0,duration:0.08,delay:finish,startTime:motionStart)
        later("collected",after:finish+0.08,allowResolved:true) { [weak self] in self?.settle(.collect) }
    }

    private func layoutUnlockedEffects() {
        guard let image=front.image,image.size.width>0,image.size.height>0 else{return}
        let scale=min(front.bounds.width/image.size.width,front.bounds.height/image.size.height)
        let size=CGSize(width:image.size.width*scale,height:image.size.height*scale)
        unlockedEffects.layoutHeldFace(in:CGRect(x:front.bounds.midX-size.width/2,y:front.bounds.midY-size.height/2,width:size.width,height:size.height))
    }
    var prepareFaceEffects:(CGImage,NativeRewardPreparationLease,@escaping (NativeMagicCardSource.Node)->Void)->Void=NativeRewardFilteredFrames.prepareFaceEffects
    private func prepareUnlockedEffects() {
        guard !disposed,!resolved,!unlockedEffectsPreparing else{return}
        guard rarity=="legendary",!reducedMotion,let image=front.image?.cgImage else{unlockedEffectsPreparationComplete=true;return}
        unlockedEffectsPreparing=true
        prepareFaceEffects(image,preparationLease) { [weak self] source in
            guard let self,!self.disposed,!self.resolved else{return}
            self.unlockedEffects.install(source);self.view.setNeedsLayout();self.layoutUnlockedEffects();self.unlockedEffectsPrepared=true;self.unlockedEffectsPreparationComplete=true
            self.admitPreparedArtwork();self.admitUnlockedEffects()
        }
    }
    private func admitUnlockedEffects() {
        guard rarity=="legendary",foreground,!disposed,!resolved,unlockedBounceFinished,unlockedEffectsPrepared else{return}
        unlockedEffectsPrepared=false // admit once; foreground resumes the inherited clock
        unlockedEffects.playCardShimmer(reduced:reducedMotion)
    }
    private func scheduleUnlockedIdle(after:Double) {
        guard !reducedMotion,foreground,!disposed,revealed,!resolved else{return}
        later("idle",after:after) { [weak self] in
            guard let self,self.revealed,!self.revealRunning else{return}
            self.cssTrack(self.unlockedRotor.layer,poses:[0,-21.6,0,21.6,0].map{NativeRewardMotion.pose(ry:$0)},offsets:[0,0.25,0.5,0.75,1],duration:6.8)
            if self.rarity=="legendary" {self.foil.idle()}
            self.later("idle",after:6.8) { [weak self] in guard let self else{return};self.foil.stop();self.holo.opacity=0;self.unlockedRotor.layer.transform=CATransform3DIdentity;self.scheduleUnlockedIdle(after:3) }
        }
    }
    private func scheduleCoach(after:Double) {
        guard !reducedMotion,foreground,!disposed,revealed,!resolved else{return}
        later("coach",after:after) { [weak self] in
            guard let self else{return}
            let life=NativeCoachCopyMotion.collectLifespan,handLife=2.8,epoch=CACurrentMediaTime()
            self.keyframes(self.hand.layer,"opacity",values:[0,1,1,0],times:[0,0.12/handLife,2.65/handLife,1],duration:handLife)
            let heights=[-0.28,-0.50,-0.38,-0.52,-0.34],rotations=[-8.0,-8,-6,-8,-7],scales=[0.78,0.96,0.84,1,0.84]
            var handPoses=(0..<5).map{NSValue(caTransform3D:self.spatial(scale:scales[$0],y:(heights[$0]+0.28)*self.hand.bounds.height,z:rotations[$0],depth:80))}
            handPoses.append(handPoses.last!)
            self.keyframes(self.hand.layer,"transform",values:handPoses,times:[0,0.2*2.1/handLife,0.42*2.1/handLife,0.58*2.1/handLife,2.1/handLife,1],duration:handLife)
            self.keyframes(self.pose.layer,"transform",values:[1,1,0.965,1.06,0.988,1,1].map{NSValue(caTransform3D:self.spatial(scale:$0))},times:[0,0.34,0.43,0.57,0.7,0.82,1],duration:2.1)
            self.keyframes(self.coach.layer,"opacity",values:[1,1],times:[0,1],duration:life)
            for (index,glyph) in self.coachGlyphs.enumerated() {
                NativeCoachCopyMotion.installCollect(on:glyph.layer,index:index,key:"native.reward.coach.copy",beginTime:epoch)
            }
            self.scheduleCoach(after:4+NativeCoachCopyMotion.collectHoldExtension)
        }
    }
    private func shine() {
        guard rarity=="legendary",!reducedMotion,foreground,!disposed else{return}
        // Keep the finite face-local burn; the removed traveling shimmer has
        // no gradient or transform owner on the unlocked card.
        keyframes(glow,"opacity",values:[0,1,0],times:[0,0.56,1],duration:0.5)
    }
    private func shake(strength:Double,duration:Double,delay:Double=0,startTime:Double?=nil,base:CATransform3D=CATransform3DIdentity) {
        guard !reducedMotion else{return}
        let points=NativeRewardMotion.screenShakeOffsets(strength:strength)
        keyframes(view.layer,"transform",values:points.map{NSValue(caTransform3D:CATransform3DTranslate(base,$0.x,$0.y,0))},times:NativeRewardMotion.screenShakeTimes,duration:duration,delay:delay,startTime:startTime)
    }
    @objc private func panned(_ gesture:UIPanGestureRecognizer) {
        guard rewardActionsAdmitted,revealed,!revealRunning,!resolved,!disposed else{return};let delta=gesture.translation(in:view)
        switch gesture.state {
        case .began:
            if let visible=unlockedRotor.layer.presentation()?.transform {dragAngle=atan2(-visible.m13,visible.m11)*180 / .pi;unlockedRotor.layer.transform=visible}
            foil.stop();tasks.removeValue(forKey:"coach")?.cancel();tasks.removeValue(forKey:"idle")?.cancel();hand.layer.removeAllAnimations();coach.layer.removeAllAnimations();coachGlyphs.forEach{$0.layer.removeAllAnimations()};unlockedRotor.layer.removeAllAnimations();pose.layer.removeAllAnimations();dragStart=dragAngle;dragAxis=nil
        case .changed:
            if max(abs(delta.x),abs(delta.y))>7 && dragAxis==nil {dragAxis=abs(delta.y)>abs(delta.x)*1.15 ? "vertical":"horizontal"}
            if dragAxis=="horizontal" {dragAngle=NativeRewardPresentation.dragTilt(start:dragStart,deltaX:delta.x,width:view.bounds.width);applyFace(unlockedRotor,scale:1,y:0,z:0,x:0,ry:dragAngle);if rarity=="legendary" {foil.paint(angle:dragAngle,idle:false)}}
        case .ended,.cancelled:
            if gesture.state == .ended && NativeRewardPresentation.collectDrag(deltaX:delta.x,deltaY:delta.y,cardHeight:hero.bounds.height) {collect()}
            else {let from=NativeRewardMotion.pose(ry:dragAngle),to=NativeRewardMotion.pose();if rarity=="legendary" {foil.settle(angle:dragAngle)};dragAngle=0
                let samples=NativeRewardMotion.samples(from:from,to:to,ease:{NativeRewardMotion.cubic($0,0.22,1,0.36,1)})
                keyframes(unlockedRotor.layer,"transform",values:samples.map{NSValue(caTransform3D:$0)},times:(0..<samples.count).map{Double($0)/Double(samples.count-1)},duration:0.26,final:NSValue(caTransform3D:to.transform));scheduleCoach(after:2);scheduleUnlockedIdle(after:3)}
        default:break
        }
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer:UIGestureRecognizer)->Bool {rewardActionsAdmitted && (gestureRecognizer !== pan || revealed && !revealRunning)}
    func setForeground(_ value:Bool) {
        guard !disposed,foreground != value else{return};foreground=value
        // Pause one parent clock; child layers inherit it without compounded offsets.
        if !value {
            let time=view.layer.convertTime(CACurrentMediaTime(),from:nil);view.layer.speed=0;view.layer.timeOffset=time
            for work in tasks.values {work.remaining=max(0,work.deadline-now());work.cancel()}
        } else {
            let paused=view.layer.timeOffset;view.layer.speed=1;view.layer.timeOffset=0;view.layer.beginTime=0
            view.layer.beginTime=view.layer.convertTime(CACurrentMediaTime(),from:nil)-paused
            for (id,work) in tasks {arm(id,work)}
            admitUnlockedEffects()
            if started,magicPrepared,!magicOpened,!magicOpening {crumble()}
            if waitingReveal,magicOpened,assetsReady {waitingReveal=false;reveal()}
        }
    }
    private func spatial(scale:Double=1,scaleX:Double?=nil,scaleY:Double?=nil,y:Double=0,z:Double=0,x:Double=0,ry:Double=0,depth:Double=0)->CATransform3D {
        NativeRewardMotion.pose(scale:scale,scaleX:scaleX,scaleY:scaleY,y:y,z:z,x:x,ry:ry,depth:depth).transform
    }
    private func animateCardEntrance(_ layer:CALayer,from:NativeRewardMotion.Pose,to:NativeRewardMotion.Pose,delay:Double=0,fromRest:Bool=false) {
        let curve:(Double)->Double=reducedMotion ? JimiV9Motion.Ease.powerOut(2).value:(fromRest ? NativeRewardMotion.cardRestBounceProgress:NativeRewardMotion.cardEnterProgress)
        let samples=NativeRewardMotion.samples(from:from,to:to,ease:curve)
        keyframes(layer,"transform",values:samples.map{NSValue(caTransform3D:$0)},times:(0..<samples.count).map{Double($0)/Double(samples.count-1)},duration:reducedMotion ? 0.16:NativeRewardMotion.cardEnterDuration,delay:delay,final:NSValue(caTransform3D:to.transform))
    }
    private func animatePose(_ layer:CALayer,from:NativeRewardMotion.Pose,to:NativeRewardMotion.Pose,duration:Double,delay:Double=0,ease:JimiV9Motion.Ease) {
        let samples=NativeRewardMotion.samples(from:from,to:to,ease:ease.value)
        keyframes(layer,"transform",values:samples.map{NSValue(caTransform3D:$0)},times:(0..<samples.count).map{Double($0)/Double(samples.count-1)},duration:reducedMotion ? min(0.16,duration):duration,delay:delay,final:NSValue(caTransform3D:to.transform))
    }
    private func cssTrack(_ layer:CALayer,poses:[NativeRewardMotion.Pose],offsets:[Double],duration:Double,interimOrder:Bool=false,repeating:Bool=false) {
        let samples=NativeRewardMotion.cssTrack(poses:poses,offsets:offsets,interimOrder:interimOrder)
        keyframes(layer,"transform",values:samples.map{NSValue(caTransform3D:$0)},times:(0..<samples.count).map{Double($0)/Double(samples.count-1)},duration:duration,final:NSValue(caTransform3D:interimOrder ? poses.last!.interimIdleTransform:poses.last!.transform),repeating:repeating)
    }
    private func applyFace(_ face:UIView,scale:Double,y:Double,z:Double,x:Double,ry:Double,depth:Double=0){face.layer.transform=spatial(scale:scale,y:y,z:z,x:x,ry:ry,depth:depth)}
    private func animate(_ layer:CALayer,_ key:String,from:Any,to:Any,duration:Double,delay:Double=0,ease:JimiV9Motion.Ease = .powerOut(2),startTime:Double?=nil) {
        let count=32,values:[Any]
        if let a=from as? NSNumber,let b=to as? NSNumber {values=(0...count).map {a.doubleValue+(b.doubleValue-a.doubleValue)*ease.value(Double($0)/Double(count))}}
        else if let a=from as? NSValue,let b=to as? NSValue {
            let left=a.caTransform3DValue,right=b.caTransform3DValue
            values=(0...count).map { index -> NSValue in let t=ease.value(Double(index)/Double(count));var value=CATransform3DIdentity
                withUnsafeMutableBytes(of:&value) { target in withUnsafeBytes(of:left) { first in withUnsafeBytes(of:right) { second in let out=target.bindMemory(to:CGFloat.self),aa=first.bindMemory(to:CGFloat.self),bb=second.bindMemory(to:CGFloat.self);for i in 0..<16 {out[i]=aa[i]+(bb[i]-aa[i])*t} } } };return NSValue(caTransform3D:value)
            }
        } else {return}
        keyframes(layer,key,values:values,times:(0...count).map{Double($0)/Double(count)},duration:reducedMotion ? min(0.16,duration):duration,delay:delay,final:to,startTime:startTime)
    }
    private func keyframes(_ layer:CALayer,_ key:String,values:[Any],times:[Double],duration:Double,delay:Double=0,final:Any?=nil,repeating:Bool=false,startTime:Double?=nil) {
        // CATransformLayer preserves spatial detail but does not own group
        // opacity. Keep visibility outside the chain, or on final paint leaves.
        if key=="opacity",layer===pose.layer {
            keyframes(hero.layer,key,values:values,times:times,duration:duration,delay:delay,final:final,repeating:repeating,startTime:startTime);return
        }
        if key=="opacity",layer===unlocked.layer {
            for leaf in [front.layer,collectBack.layer] {
                keyframes(leaf,key,values:values,times:times,duration:duration,delay:delay,final:final,repeating:repeating,startTime:startTime)
            }
            return
        }
        CATransaction.begin();CATransaction.setDisableActions(true);if let final {layer.setValue(final,forKeyPath:key)};CATransaction.commit()
        let animation=CAKeyframeAnimation(keyPath:key);animation.values=values;animation.keyTimes=times.map{NSNumber(value:$0)};animation.duration=duration;animation.beginTime=layer.convertTime(startTime ?? CACurrentMediaTime(),from:nil)+delay;animation.fillMode = delay>0 && (layer.animationKeys() ?? []).contains(where:{$0.hasPrefix("reward.\(key).")}) ? .removed:.backwards;animation.isRemovedOnCompletion=true
        if repeating {animation.repeatCount = .infinity}
        layer.add(animation,forKey:"reward.\(key).\(delay)")
    }
    private func later(_ id:String,after seconds:Double,allowResolved:Bool=false,_ callback:@escaping ()->Void) {
        tasks.removeValue(forKey:id)?.cancel()
        let work=Work(after:max(0,seconds),allowResolved:allowResolved,epoch:epoch,callback:callback);tasks[id]=work
        if foreground {arm(id,work)}
    }
    private func arm(_ id:String,_ work:Work) {
        work.cancel();work.deadline=now()+work.remaining;let lease=work.lease
        work.cancellation=scheduler.after(work.remaining) { [weak self,weak work] in
            guard let self,let work,!self.disposed,self.epoch==work.epoch,self.tasks[id]===work,work.lease==lease,self.foreground,work.allowResolved || !self.resolved else{return}
            self.tasks.removeValue(forKey:id);work.cancellation=nil;work.callback()
        }
    }
    private func cancelTasks(){for task in tasks.values {task.cancel()};tasks.removeAll()}
    private func removeAnimations(){foil.stop();magic.stop();unlockedEffects.stop();for layer in ownedLayers {layer.removeAllAnimations()}}
    private func settle(_ action:Action){guard !disposed else{return};let callback=onFinish;onFinish=nil;dispose(notify:false);callback?(action)}
    func dispose(notify:Bool=true){guard !disposed else{return};disposed=true;magicPreparationWaiters.removeAll();phase="disposed";epoch &+= 1;cancelTasks();removeAnimations();resources.release(resourceOwner);preparationLease.cancel();preparedImages.removeAll();maskImage=nil;glow.contents=nil;magic.dispose();unlockedEffects.dispose();front.image=nil;collectBack.image=nil;hand.image=nil;holo.mask=nil;for observer in observations {NotificationCenter.default.removeObserver(observer)};observations.removeAll();onSoundMoment=nil;onHaptic=nil;onAssetFailure=nil;let callback=onFinish;onFinish=nil;if notify {callback?(.cancelled)}}
}
