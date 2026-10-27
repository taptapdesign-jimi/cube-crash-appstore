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
    private let magic=NativeMagicCardReveal()
    private var magicOpened=false,magicOpening=false,magicPrepared=false,cardPrepared=false
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
    private let hero=UIView(),interim=UIView(),unlocked=UIView(),pose=UIView(),front=UIImageView(),hand=UIImageView()
    private let interimRotor=UIView(),unlockedRotor=UIView()
    private let headingLabel=UILabel(),subtitle=UILabel(),coach=UILabel()
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
        headingLabel.text="New Reward";headingLabel.textColor=UIColor(red:239/255,green:116/255,blue:77/255,alpha:1)
        subtitle.text="Tap the card to reveal";subtitle.textColor=NativeTextPalette.subtitle
        coach.text="TAP TO COLLECT";coach.font=assets.font(size:32,weight:"ExtraBold");coach.textColor = .white;coach.alpha=0
        coach.layer.shadowColor=UIColor(red:159/255,green:105/255,blue:82/255,alpha:0.34).cgColor;coach.layer.shadowOffset=CGSize(width:0,height:3);coach.layer.shadowOpacity=1
        hero.accessibilityIdentifier="native.reward.card";hero.accessibilityLabel="Reveal \(NativeRewardPresentation.name(board:board))";hero.accessibilityTraits = .button
        view.addSubview(hero);pose.layer.name="native.reward.card-pose";pose.layer.zPosition=1;hero.addSubview(pose);pose.addSubview(interim);pose.addSubview(unlocked)
        interim.layer.zPosition=1;interim.addSubview(interimRotor);unlocked.addSubview(unlockedRotor);interimRotor.layer.addSublayer(magic.layer);unlockedRotor.addSubview(front)
        for image in [front,hand] {image.contentMode = .scaleAspectFit;image.isUserInteractionEnabled=false}
        view.addSubview(hand);hand.alpha=0;hand.layer.shadowColor=UIColor(red:132/255,green:82/255,blue:63/255,alpha:1).cgColor;hand.layer.shadowOpacity=0.24;hand.layer.shadowOffset=CGSize(width:0,height:12);hand.layer.shadowRadius=16
        glow.name="native.reward.unlocked-burn";glow.opacity=0;glow.contentsGravity = .resizeAspect;glow.zPosition=0.5;glow.isDoubleSided=false
        unlockedRotor.layer.addSublayer(glow)
        unlockedRotor.layer.addSublayer(holo)
        tap=UITapGestureRecognizer(target:self,action:#selector(tapped));pan=UIPanGestureRecognizer(target:self,action:#selector(panned(_:)));tap.delegate=self;pan.delegate=self;tap.require(toFail:pan);hero.addGestureRecognizer(tap);hero.addGestureRecognizer(pan)
        ownedLayers=[view.layer,headingLabel.layer,subtitle.layer,hero.layer,pose.layer,interim.layer,unlocked.layer,interimRotor.layer,unlockedRotor.layer,front.layer,hand.layer,coach.layer,glow,holo]
        headingLabel.layer.opacity=0;subtitle.layer.opacity=0;pose.layer.opacity=0;unlocked.layer.opacity=0
        applyFace(interim,scale:1,y:40,z:0,x:0,ry:0)
        applyFace(unlocked,scale:0,y:22,z:tilt.entryZ,x:tilt.entryX,ry:tilt.entryY,depth:-180)
        let paths=[cardPath,maskPath,"assets/hand-pointer.png"]
        resources.prepare(paths,owner:resourceOwner,required:true) { [weak self] accepted in
            guard let self,!self.disposed,!self.resolved else{return}
            for path in paths {if let image=self.resources.image(path,owner:self.resourceOwner) {self.preparedImages[path]=image}}
            self.maskImage=self.preparedImages[self.maskPath]?.cgImage
            self.front.image=self.preparedImages[self.cardPath];self.hand.image=self.preparedImages["assets/hand-pointer.png"]
            guard accepted,paths.allSatisfy({self.preparedImages[$0] != nil}) else {
                self.phase="asset-failed";self.onAssetFailure?("Selected Native reward artwork preparation failed");return
            }
            self.view.setNeedsLayout()
            self.prepareFilteredFrames(self.preparedImages,self.preparationLease) { [weak self] filtered in
                guard let self,!self.disposed,!self.resolved else{return};self.glow.contents=filtered[self.cardPath+"#burn"]?.cgImage;self.cardPrepared=true;self.admitPreparedArtwork()
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
        NativeRewardCardRendering.configure(faces:[interim,unlocked,interimRotor,unlockedRotor],images:[front],displayScale:view.window?.screen.scale ?? traitCollection.displayScale)
        let aspect=(hand.image?.size.height ?? 1)/max(1,hand.image?.size.width ?? 1)
        let layout=NativeRewardPresentation.Layout(width:view.bounds.width,height:view.bounds.height,bottomSafe:view.safeAreaInsets.bottom,handAspect:aspect)
        headingLabel.frame=layout.title;subtitle.frame=layout.subtitle;hero.frame=layout.hero
        headingLabel.font=assets.font(size:layout.titleFont,weight:"ExtraBold");subtitle.font=assets.font(size:layout.subtitleFont,weight:"SemiBold")
        pose.frame=hero.bounds;interim.bounds=hero.bounds;interim.center=CGPoint(x:hero.bounds.midX,y:hero.bounds.midY);unlocked.bounds=hero.bounds;unlocked.center=interim.center
        interimRotor.frame=interim.bounds;unlockedRotor.frame=unlocked.bounds
        front.bounds=unlocked.bounds;front.center=CGPoint(x:unlocked.bounds.midX,y:unlocked.bounds.midY);front.transform=CGAffineTransform(translationX:0,y:-4).scaledBy(x:NativeRewardPresentation.frontArtworkScale,y:NativeRewardPresentation.frontArtworkScale)
        hand.frame=layout.hand;coach.frame=layout.coach
        CATransaction.begin();CATransaction.setDisableActions(true)
        let effectScale=view.window?.screen.scale ?? view.traitCollection.displayScale
        for layer in [glow] {layer.contentsScale=max(1,effectScale);layer.allowsEdgeAntialiasing=true;layer.edgeAntialiasingMask=[.layerLeftEdge,.layerRightEdge,.layerTopEdge,.layerBottomEdge];layer.minificationFilter = .trilinear;layer.magnificationFilter = .linear}
        let artworkScale=NativeRewardPresentation.frontArtworkScale
        glow.frame=CGRect(x:unlocked.bounds.width*(1-artworkScale)/2,y:unlocked.bounds.height*(1-artworkScale)/2-4,width:unlocked.bounds.width*artworkScale,height:unlocked.bounds.height*artworkScale);holo.frame=unlocked.bounds
        let maskImage=self.maskImage
        foil.layout(unlocked.bounds,mask:maskImage,displayScale:effectScale)
        CATransaction.commit();magic.layout(in:interimRotor.bounds)
    }
    private func admitPreparedArtwork() {
        guard phase != "asset-failed" else{return}
        if foreground,started,magicPrepared,!magicOpening,!magicOpened {crumble()}
        guard cardPrepared,magicPrepared else{return};assetsReady=true
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
        pose.layer.transform=CATransform3DIdentity;pose.layer.opacity=1;CATransaction.commit()
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
        phase="revealing";revealRunning=true;pose.layer.opacity=1;pose.layer.transform=CATransform3DIdentity
        interimRotor.layer.transform=CATransform3DIdentity
        if !reducedMotion {
            animate(pose.layer,"transform",from:NSValue(caTransform3D:idlePose),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.16)
            animate(interimRotor.layer,"transform",from:NSValue(caTransform3D:idleRotor),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.16)
        }
        onHaptic?("medium");onSoundMoment?("new-card-reveal",0,generation)
        interim.layer.opacity=1
        let closedExit=reducedMotion ? 0.16:(NativeMagicCardSource.end-NativeMagicCardSource.hold)*1.3
        let unlockedDelay=0.300
        later("unlocked-enter-sound",after:unlockedDelay){[weak self] in guard let self else{return};self.onSoundMoment?("new-card-unlocked-enter",0,self.generation)}
        magic.play(from:NativeMagicCardSource.hold,to:NativeMagicCardSource.end,reduced:reducedMotion,durationScale:1.3)
        headingLabel.layer.opacity=0;subtitle.layer.opacity=0
        animate(unlocked.layer,"opacity",from:0,to:1,duration:0.001,delay:unlockedDelay)
        headingLabel.text=rarity=="legendary" ? "Legendary!":"Common"
        let copy=NSMutableAttributedString(string:"Unlocked \(NativeRewardPresentation.name(board:board))")
        copy.addAttribute(.foregroundColor,value:NativeTextPalette.subtitle,range:NSRange(location:9,length:copy.length-9));subtitle.attributedText=copy
        let enter=reducedMotion ? 0.16:NativeRewardMotion.cardEnterDuration
        animateCardEntrance(unlocked.layer,from:NativeRewardMotion.pose(scale:0,y:22,z:tilt.entryZ,x:tilt.entryX,ry:tilt.entryY,depth:-180),to:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.restZ,x:tilt.restX,ry:tilt.restY),delay:unlockedDelay)
        animate(headingLabel.layer,"opacity",from:0,to:1,duration:0.192,delay:unlockedDelay);animate(subtitle.layer,"opacity",from:0,to:1,duration:0.192,delay:unlockedDelay)
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0.72,y:-16)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.192,delay:unlockedDelay,ease:.backOut(1.65))
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0.78,y:-12)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.192,delay:unlockedDelay,ease:.backOut(1.65))
        later("reveal-haptic",after:0.176){ [weak self] in self?.onHaptic?("light") }
        later("impact",after:max(closedExit,unlockedDelay+enter)){ [weak self] in guard let self else{return};self.shine();self.shake(strength:22,duration:0.42);self.onHaptic?("medium") }
        later("revealed",after:max(closedExit,unlockedDelay+enter)+0.192) { [weak self] in
            guard let self else{return};self.interim.layer.opacity=0;self.magic.dispose();self.phase="unlocked";self.revealRunning=false;self.revealed=true;self.hero.accessibilityLabel="Collect \(NativeRewardPresentation.name(board:self.board))"
            self.onHaptic?("light");if self.queuedCollect {self.collect()}else{self.scheduleCoach(after:1);self.scheduleUnlockedIdle(after:3)}
        }
    }
    private func collect() {
        guard !disposed,!resolved,!revealRunning,revealed else{return};resolved=true;phase="exiting";epoch &+= 1;cancelTasks();removeAnimations();hand.alpha=0;coach.alpha=0
        onSoundMoment?("modal-exit",0,generation)
        onSoundMoment?("cta",0,generation);onHaptic?("selection")
        let inflation=reducedMotion ? 0 : 0.08,collapse=0.16
        if inflation>0 {animate(pose.layer,"transform",from:NSValue(caTransform3D:CATransform3DIdentity),to:NSValue(caTransform3D:spatial(scaleX:1.18,scaleY:1.15)),duration:inflation,ease:.powerIn(2))}
        animate(pose.layer,"transform",from:NSValue(caTransform3D:spatial(scaleX:inflation>0 ? 1.18:1,scaleY:inflation>0 ? 1.15:1)),to:NSValue(caTransform3D:spatial(scale:0)),duration:collapse,delay:inflation,ease:reducedMotion ? .powerIn(1):.backIn(1.7))
        animate(headingLabel.layer,"opacity",from:1,to:0,duration:0.12);animate(subtitle.layer,"opacity",from:1,to:0,duration:0.12,delay:0.04)
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:CATransform3DIdentity),to:NSValue(caTransform3D:spatial(scale:0,y:-34)),duration:0.12,ease:.backIn(1.55))
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:CATransform3DIdentity),to:NSValue(caTransform3D:spatial(scale:0,y:-28)),duration:0.12,delay:0.04,ease:.backIn(1.55))
        animatePose(unlocked.layer,from:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.restZ,x:tilt.restX,ry:tilt.restY),to:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.exitZ,x:tilt.exitX,ry:tilt.exitY,depth:-188),duration:inflation+collapse,ease:.powerIn(2))
        animate(view.layer,"opacity",from:1,to:0,duration:0.08,delay:max(0,inflation+collapse-0.08))
        later("collected",after:inflation+collapse,allowResolved:true) { [weak self] in self?.settle(.collect) }
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
            guard let self else{return};self.keyframes(self.hand.layer,"opacity",values:[0,1,1,1,0],times:[0,0.2,0.42,0.58,1],duration:2.1)
            let heights=[-0.28,-0.50,-0.38,-0.52,-0.34],rotations=[-8.0,-8,-6,-8,-7],scales=[0.78,0.96,0.84,1,0.84]
            self.keyframes(self.hand.layer,"transform",values:(0..<5).map{NSValue(caTransform3D:self.spatial(scale:scales[$0],y:(heights[$0]+0.28)*self.hand.bounds.height,z:rotations[$0],depth:80))},times:[0,0.2,0.42,0.58,1],duration:2.1)
            self.keyframes(self.pose.layer,"transform",values:[1,1,0.965,1.06,0.988,1,1].map{NSValue(caTransform3D:self.spatial(scale:$0))},times:[0,0.34,0.43,0.57,0.7,0.82,1],duration:2.1)
            self.keyframes(self.coach.layer,"opacity",values:[0,1,1,0],times:[0,0.12,0.9,1],duration:2.1)
            self.scheduleCoach(after:3)
        }
    }
    private func shine() {
        guard !reducedMotion,foreground,!disposed else{return}
        // Keep the finite face-local burn; the removed traveling shimmer has
        // no gradient or transform owner on the unlocked card.
        keyframes(glow,"opacity",values:[0,1,0],times:[0,0.56,1],duration:0.5)
    }
    private func shake(strength:Double,duration:Double) {
        guard !reducedMotion else{return}
        let points=[(0.0,0.0),(strength,-strength*0.45),(-strength*0.85,strength*0.35),(strength*0.55,-strength*0.25),(-strength*0.25,strength*0.12),(0.0,0.0)]
        keyframes(view.layer,"transform",values:points.map{NSValue(caTransform3D:CATransform3DMakeTranslation($0.0,$0.1,0))},times:[0,0.12,0.24,0.38,0.54,1],duration:duration)
    }
    @objc private func panned(_ gesture:UIPanGestureRecognizer) {
        guard rewardActionsAdmitted,revealed,!revealRunning,!resolved,!disposed else{return};let delta=gesture.translation(in:view)
        switch gesture.state {
        case .began:
            if let visible=unlockedRotor.layer.presentation()?.transform {dragAngle=atan2(-visible.m13,visible.m11)*180 / .pi;unlockedRotor.layer.transform=visible}
            foil.stop();tasks.removeValue(forKey:"coach")?.cancel();tasks.removeValue(forKey:"idle")?.cancel();hand.layer.removeAllAnimations();coach.layer.removeAllAnimations();unlockedRotor.layer.removeAllAnimations();pose.layer.removeAllAnimations();dragStart=dragAngle;dragAxis=nil
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
    private func animate(_ layer:CALayer,_ key:String,from:Any,to:Any,duration:Double,delay:Double=0,ease:JimiV9Motion.Ease = .powerOut(2)) {
        let count=32,values:[Any]
        if let a=from as? NSNumber,let b=to as? NSNumber {values=(0...count).map {a.doubleValue+(b.doubleValue-a.doubleValue)*ease.value(Double($0)/Double(count))}}
        else if let a=from as? NSValue,let b=to as? NSValue {
            let left=a.caTransform3DValue,right=b.caTransform3DValue
            values=(0...count).map { index -> NSValue in let t=ease.value(Double(index)/Double(count));var value=CATransform3DIdentity
                withUnsafeMutableBytes(of:&value) { target in withUnsafeBytes(of:left) { first in withUnsafeBytes(of:right) { second in let out=target.bindMemory(to:CGFloat.self),aa=first.bindMemory(to:CGFloat.self),bb=second.bindMemory(to:CGFloat.self);for i in 0..<16 {out[i]=aa[i]+(bb[i]-aa[i])*t} } } };return NSValue(caTransform3D:value)
            }
        } else {return}
        keyframes(layer,key,values:values,times:(0...count).map{Double($0)/Double(count)},duration:reducedMotion ? min(0.16,duration):duration,delay:delay,final:to)
    }
    private func keyframes(_ layer:CALayer,_ key:String,values:[Any],times:[Double],duration:Double,delay:Double=0,final:Any?=nil,repeating:Bool=false) {
        CATransaction.begin();CATransaction.setDisableActions(true);if let final {layer.setValue(final,forKeyPath:key)};CATransaction.commit()
        let animation=CAKeyframeAnimation(keyPath:key);animation.values=values;animation.keyTimes=times.map{NSNumber(value:$0)};animation.duration=duration;animation.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)+delay;animation.fillMode = delay>0 && (layer.animationKeys() ?? []).contains(where:{$0.hasPrefix("reward.\(key).")}) ? .removed:.backwards;animation.isRemovedOnCompletion=true
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
    private func removeAnimations(){foil.stop();magic.stop();for layer in ownedLayers {layer.removeAllAnimations()}}
    private func settle(_ action:Action){guard !disposed else{return};let callback=onFinish;onFinish=nil;dispose(notify:false);callback?(action)}
    func dispose(notify:Bool=true){guard !disposed else{return};disposed=true;magicPreparationWaiters.removeAll();phase="disposed";epoch &+= 1;cancelTasks();removeAnimations();resources.release(resourceOwner);preparationLease.cancel();preparedImages.removeAll();maskImage=nil;glow.contents=nil;magic.dispose();holo.mask=nil;for observer in observations {NotificationCenter.default.removeObserver(observer)};observations.removeAll();onSoundMoment=nil;onHaptic=nil;onAssetFailure=nil;let callback=onFinish;onFinish=nil;if notify {callback?(.cancelled)}}
}
