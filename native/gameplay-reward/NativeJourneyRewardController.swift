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
    private let assets:JimiV9Artwork
    private let resources:any NativeRewardResources
    private let scheduler:any NativeMusicScheduler
    private let random:()->Double
    private let tilt:NativeRewardPresentation.Tilt
    private let reducedMotion:Bool
    private let generation:UInt64
    private let paper=UIImageView(),hero=UIView(),interim=UIView(),unlocked=UIView(),pose=UIView(),frame=UIImageView(),front=UIImageView(),hand=UIImageView()
    private let interimRotor=UIView(),unlockedRotor=UIView()
    private let headingLabel=UILabel(),subtitle=UILabel(),coach=UILabel()
    private let shadow=CAGradientLayer(),foil=NativeRewardFoil()
    private var holo:CALayer {foil.layer}
    private let glow=CALayer(),interimLight=CALayer(),sweep=CAGradientLayer(),interimSweep=CAGradientLayer()
    private let preparationLease=NativeRewardPreparationLease()
    private var blurredFrames:[String:UIImage]=[:]
    private var ownedSmoke:CALayer?
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
    private var interimScale=1.0
    private(set) var phase="mounted"
    var onFinish:((Action)->Void)?
    var onSoundMoment:((String,Int,UInt64)->Void)?
    var onHaptic:((String)->Void)?
    var onAssetFailure:((String)->Void)?
    /// Tests can accept already prepared immutable carriers without invoking CI.
    var prepareFilteredFrames:(([String:UIImage],NativeRewardPreparationLease,@escaping ([String:UIImage])->Void)->Void)=NativeRewardFilteredFrames.prepare
    private var resourceOwner:Int {-50000-board}
    private var rarity:String {NativeJourneyContent.earnedStars(score:score,board:board)==3 ? "legendary":"common"}
    private var cardPath:String {NativeJourneyContent.cardAsset(board:board,score:score,doubleDensity:true)}
    private var maskPath:String {NativeJourneyContent.cardAsset(board:board,score:score)}
    init(root:URL,board:Int,score:Int,generation:UInt64,resources:(any NativeRewardResources)?=nil,scheduler:(any NativeMusicScheduler)?=nil,reducedMotion:Bool?=nil,random:@escaping ()->Double={Double.random(in:0..<1)},now:@escaping ()->Double={ProcessInfo.processInfo.systemUptime}) {
        self.board=max(1,min(30,board));self.score=score;self.generation=generation;self.resources=resources ?? JimiNativeWorldResources(root:root)
        self.scheduler=scheduler ?? RewardScheduler();self.random=random;self.now=now;self.reducedMotion=reducedMotion ?? UIAccessibility.isReduceMotionEnabled;tilt=NativeRewardPresentation.Tilt(random:random);assets=JimiV9Artwork(resourceRoot:root)
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use Native reward initializer")}
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        paper.image=assets.image("assets/paper-bg.png");paper.contentMode = .scaleAspectFill;view.addSubview(paper)
        for label in [headingLabel,subtitle,coach] {label.textAlignment = .center;label.isUserInteractionEnabled=false;view.addSubview(label)}
        headingLabel.text="New Reward";headingLabel.textColor=UIColor(red:239/255,green:116/255,blue:77/255,alpha:1)
        subtitle.text="Tap the card to reveal";subtitle.textColor=UIColor(red:196/255,green:168/255,blue:150/255,alpha:1)
        coach.text="TAP TO COLLECT";coach.font=assets.font(size:32,weight:"ExtraBold");coach.textColor = .white;coach.alpha=0
        coach.layer.shadowColor=UIColor(red:159/255,green:105/255,blue:82/255,alpha:0.34).cgColor;coach.layer.shadowOffset=CGSize(width:0,height:3);coach.layer.shadowOpacity=1
        hero.accessibilityIdentifier="native.reward.card";hero.accessibilityLabel="Reveal \(NativeRewardPresentation.name(board:board))";hero.accessibilityTraits = .button
        view.addSubview(hero);hero.layer.addSublayer(shadow);hero.addSubview(pose);pose.addSubview(interim);pose.addSubview(unlocked)
        interim.addSubview(interimRotor);unlocked.addSubview(unlockedRotor);interimRotor.addSubview(frame);unlockedRotor.addSubview(front)
        for image in [frame,front,hand] {image.contentMode = .scaleAspectFit;image.isUserInteractionEnabled=false}
        view.addSubview(hand);hand.alpha=0;hand.layer.shadowColor=UIColor(red:132/255,green:82/255,blue:63/255,alpha:1).cgColor;hand.layer.shadowOpacity=0.24;hand.layer.shadowOffset=CGSize(width:0,height:12);hand.layer.shadowRadius=16
        shadow.type = .radial;shadow.colors=[UIColor(red:185/255,green:105/255,blue:62/255,alpha:0.34).cgColor,UIColor(red:185/255,green:105/255,blue:62/255,alpha:0.2).cgColor,UIColor.clear.cgColor];shadow.locations=[0,0.42,0.76];shadow.startPoint=CGPoint(x:0.5,y:0.5);shadow.endPoint=CGPoint(x:1,y:1)
        for (surface,gradient) in [(glow,sweep),(interimLight,interimSweep)] {
            surface.opacity=0;surface.masksToBounds=true;surface.addSublayer(gradient)
            gradient.colors=[UIColor.clear.cgColor,UIColor.white.withAlphaComponent(0.52).cgColor,UIColor.clear.cgColor];gradient.locations=[0,0.5,1];gradient.startPoint=CGPoint(x:0,y:0.5);gradient.endPoint=CGPoint(x:1,y:0.5);gradient.opacity=0
        }
        unlockedRotor.layer.addSublayer(glow);interimRotor.layer.addSublayer(interimLight)
        unlockedRotor.layer.addSublayer(holo)
        tap=UITapGestureRecognizer(target:self,action:#selector(tapped));pan=UIPanGestureRecognizer(target:self,action:#selector(panned(_:)));tap.delegate=self;pan.delegate=self;tap.require(toFail:pan);hero.addGestureRecognizer(tap);hero.addGestureRecognizer(pan)
        ownedLayers=[view.layer,headingLabel.layer,subtitle.layer,hero.layer,pose.layer,interim.layer,unlocked.layer,interimRotor.layer,unlockedRotor.layer,frame.layer,front.layer,shadow,hand.layer,coach.layer,glow,holo,sweep,interimLight,interimSweep]
        headingLabel.layer.opacity=0;subtitle.layer.opacity=0;pose.layer.opacity=0;shadow.opacity=0;unlocked.layer.opacity=0
        applyFace(interim,scale:1,y:40,z:tilt.interimZ,x:tilt.interimX,ry:tilt.interimY)
        applyFace(unlocked,scale:0.58,y:22,z:tilt.entryZ,x:tilt.entryX,ry:tilt.entryY,depth:-180)
        let paths=(1...9).map{"assets/animations/sand/zguzvano\($0).png"}+[cardPath,maskPath,"assets/hand-pointer.png"]
        resources.prepare(paths,owner:resourceOwner,required:true) { [weak self] accepted in
            guard let self,!self.disposed,!self.resolved else{return}
            for path in paths {if let image=self.resources.image(path,owner:self.resourceOwner) {self.preparedImages[path]=image}}
            self.maskImage=self.preparedImages[self.maskPath]?.cgImage
            self.frame.image=self.preparedImages[self.revealRunning || self.revealed ? "assets/animations/sand/zguzvano9.png":"assets/animations/sand/zguzvano1.png"]
            self.front.image=self.preparedImages[self.cardPath];self.hand.image=self.preparedImages["assets/hand-pointer.png"]
            guard accepted,paths.allSatisfy({self.preparedImages[$0] != nil}) else {
                self.phase="asset-failed";self.onAssetFailure?("Selected Native reward artwork preparation failed");return
            }
            self.view.setNeedsLayout()
            self.prepareFilteredFrames(self.preparedImages,self.preparationLease) { [weak self] filtered in
                guard let self,!self.disposed,!self.resolved else{return};self.blurredFrames=filtered;self.assetsReady=true
                if self.waitingReveal {
                    if self.foreground {self.waitingReveal=false;self.reveal()}
                } else if self.waitingCrumble {self.waitingCrumble=false;self.crumble()}
            }
        }
        observations=[NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated {self?.setForeground(false)} },NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated {self?.setForeground(true)} }]
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();paper.frame=view.bounds
        let aspect=(hand.image?.size.height ?? 1)/max(1,hand.image?.size.width ?? 1)
        let layout=NativeRewardPresentation.Layout(width:view.bounds.width,height:view.bounds.height,bottomSafe:view.safeAreaInsets.bottom,handAspect:aspect)
        headingLabel.frame=layout.title;subtitle.frame=layout.subtitle;hero.frame=layout.hero
        headingLabel.font=assets.font(size:layout.titleFont,weight:"ExtraBold");subtitle.font=assets.font(size:layout.subtitleFont,weight:"SemiBold")
        pose.frame=hero.bounds;interim.bounds=hero.bounds;interim.center=CGPoint(x:hero.bounds.midX,y:hero.bounds.midY);unlocked.bounds=hero.bounds;unlocked.center=interim.center
        interimRotor.frame=interim.bounds;unlockedRotor.frame=unlocked.bounds
        frame.bounds=interim.bounds;frame.center=CGPoint(x:interim.bounds.midX,y:interim.bounds.midY);front.bounds=unlocked.bounds;front.center=CGPoint(x:unlocked.bounds.midX,y:unlocked.bounds.midY);front.transform=CGAffineTransform(translationX:0,y:-4).scaledBy(x:0.95,y:0.95)
        shadow.frame=layout.shadow;hand.frame=layout.hand;coach.frame=layout.coach
        glow.frame=unlocked.bounds;holo.frame=unlocked.bounds;sweep.frame=glow.bounds;interimLight.frame=interim.bounds;interimSweep.frame=interimLight.bounds
        let maskImage=self.maskImage
        foil.layout(unlocked.bounds,mask:maskImage)
        for layer in [glow] {let mask=CALayer();mask.frame=CGRect(x:unlocked.bounds.width*0.025,y:unlocked.bounds.height*0.025-4,width:unlocked.bounds.width*0.95,height:unlocked.bounds.height*0.95);mask.contents=maskImage;mask.contentsGravity = .resizeAspect;layer.mask=mask}
        let interimMask=CALayer();interimMask.frame=interim.bounds.insetBy(dx:-interim.bounds.width*0.1,dy:-interim.bounds.height*0.1);interimMask.contents=preparedImages["assets/animations/sand/zguzvano9.png"]?.cgImage;interimMask.contentsGravity = .resizeAspect;interimLight.mask=interimMask
    }
    override func viewDidAppear(_ animated:Bool) {super.viewDidAppear(animated);start()}
    func start() {
        guard !started,!disposed,!revealRunning,!revealed,!resolved else{return};started=true;phase="entering"
        onSoundMoment?("new-card-happy",0,generation);onHaptic?("medium")
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0,y:-28)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.24,ease:.backOut(1.65))
        animate(headingLabel.layer,"opacity",from:0,to:1,duration:0.24)
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0,y:-22)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.24,delay:0.032,ease:.backOut(1.65));animate(subtitle.layer,"opacity",from:0,to:1,duration:0.24,delay:0.032)
        animate(pose.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0,y:-30)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.52,delay:0.176,ease:.backOut(1.7));animate(pose.layer,"opacity",from:0,to:1,duration:0.52,delay:0.176)
        animate(shadow,"opacity",from:0,to:1,duration:0.256)
        later("intro",after:0.176) { [weak self] in self?.onSoundMoment?("new-card-intro",0,self?.generation ?? 0) }
        later("intro-haptic",after:0.12){ [weak self] in self?.onHaptic?("light")}
        later("intro-haptic2",after:0.24){ [weak self] in self?.onHaptic?("medium")}
        later("crumble",after:0.696) { [weak self] in guard let self,!self.revealRunning,!self.revealed else{return};self.onSoundMoment?("new-card-crumble",0,self.generation);if self.assetsReady {self.crumble()}else{self.waitingCrumble=true} }
    }
    @objc private func tapped(){activate()}
    func activate() {
        guard foreground else{return}
        if waitingReveal,!disposed,!resolved {queuedCollect=true;return}
        switch NativeRewardPresentation.tapAction(revealed:revealed,revealRunning:revealRunning,resolved:resolved,disposed:disposed) {
        case .reveal:reveal()
        case .queueCollect:queuedCollect=true
        case .collect:collect()
        case .ignore:break
        }
    }
    private func crumble() {
        guard !disposed,!revealRunning,!revealed else{return};phase="interim"
        let delays=[27,26,24,23,24,25,27,29].map{Double(max(10,Int((Double($0)*0.8).rounded())))/1000}
        var time=0.0
        for index in 1...8 {time += delays[index-1];let stepTime=time;later("frame\(index)",after:time) { [weak self] in
            guard let self,!self.revealRunning,!self.revealed else{return};let path="assets/animations/sand/zguzvano\(index+1).png"
            self.frame.image=self.blurredFrames[path] ?? self.preparedImages[path]
            let peak=0.94+self.random()*0.12,start=peak*(0.86+self.random()*0.06)
            self.keyframes(self.frame.layer,"transform",values:([start,peak,1] as [Double]).map{NSValue(caTransform3D:CATransform3DMakeScale(CGFloat($0),CGFloat($0),1))},times:[0,0.55,1],duration:0.035,final:NSValue(caTransform3D:CATransform3DIdentity))
            self.later("clear-blur\(index)",after:0.035*0.55){ [weak self] in self?.frame.image=self?.preparedImages[path] }
            self.onHaptic?(index==8 ? "medium":"light")
        };time=stepTime+0.035 }
        later("interim-pulse",after:time){ [weak self] in guard let self,!self.revealRunning,!self.revealed else{return};self.shimmer(self.interimLight,gradient:self.interimSweep);self.shake(strength:16,duration:0.38);self.keyframes(self.frame.layer,"transform",values:([1,1.34,1.2] as [Double]).map{NSValue(caTransform3D:CATransform3DMakeScale(CGFloat($0),CGFloat($0),1))},times:[0,0.08/0.26,1],duration:0.26,final:NSValue(caTransform3D:CATransform3DMakeScale(1.2,1.2,1)))}
        later("interim-rest",after:time+0.26) { [weak self] in
            guard let self,!self.revealRunning,!self.revealed else{return};self.interimScale=1.17
            self.applyFace(self.interim,scale:1.17,y:40,z:self.tilt.interimZ,x:self.tilt.interimX,ry:self.tilt.interimY);self.frame.transform=CGAffineTransform(scaleX:1.2,y:1.2)
            self.onHaptic?("medium");self.scheduleInterimIdle()
        }
    }
    private func reveal() {
        guard !disposed,!resolved,!revealRunning,!revealed else{return}
        guard assetsReady else {waitingReveal=true;phase="awaiting-artwork";return}
        waitingReveal=false;epoch &+= 1;cancelTasks();removeAnimations();waitingCrumble=false
        phase="revealing";revealRunning=true;pose.layer.opacity=1;pose.layer.transform=CATransform3DIdentity
        onHaptic?("medium");onSoundMoment?("new-card-reveal",0,generation)
        frame.image=preparedImages["assets/animations/sand/zguzvano9.png"];frame.transform=CGAffineTransform(scaleX:1.2,y:1.2)
        interim.layer.opacity=1;interimScale=1.17
        let inflation=reducedMotion ? 0 : 0.12,collapse=reducedMotion ? 0.16 : 0.224,closedExit=inflation+collapse
        let start=NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.interimZ,x:tilt.interimX,ry:tilt.interimY)
        let peak=NativeRewardMotion.pose(scaleX:1.17*1.18,scaleY:1.17*1.15,y:40,z:tilt.interimZ,x:tilt.interimX,ry:tilt.interimY)
        if inflation>0 {animatePose(interim.layer,from:start,to:peak,duration:inflation,ease:.powerIn(2))}
        animatePose(interim.layer,from:inflation>0 ? peak:start,to:NativeRewardMotion.pose(scale:0,y:40,z:tilt.interimExitZ,x:tilt.interimExitX,ry:tilt.interimExitY,depth:-188),duration:collapse,delay:inflation,ease:reducedMotion ? .powerIn(1):.backIn(1.7))
        headingLabel.layer.opacity=0;subtitle.layer.opacity=0
        later("closed-exited",after:closedExit) { [weak self] in
            guard let self else{return};self.interim.layer.opacity=0;self.unlocked.layer.opacity=1;self.shake(strength:11,duration:0.42)
            self.headingLabel.text=self.rarity=="legendary" ? "Legendary!":"Common"
            let copy=NSMutableAttributedString(string:"Unlocked \(NativeRewardPresentation.name(board:self.board))")
            copy.addAttribute(.foregroundColor,value:UIColor(red:239/255,green:116/255,blue:77/255,alpha:1),range:NSRange(location:9,length:copy.length-9));self.subtitle.attributedText=copy
            self.onHaptic?("medium")
        }
        let enter=reducedMotion ? 0.16:0.28
        animatePose(unlocked.layer,from:NativeRewardMotion.pose(scale:0.58,y:22,z:tilt.entryZ,x:tilt.entryX,ry:tilt.entryY,depth:-180),to:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.restZ,x:tilt.restX,ry:tilt.restY),duration:enter,delay:closedExit,ease:.backOut(2.1))
        animate(headingLabel.layer,"opacity",from:0,to:1,duration:0.192,delay:closedExit);animate(subtitle.layer,"opacity",from:0,to:1,duration:0.192,delay:closedExit)
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0.72,y:-16)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.192,delay:closedExit,ease:.backOut(1.65))
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:spatial(scale:0.78,y:-12)),to:NSValue(caTransform3D:CATransform3DIdentity),duration:0.192,delay:closedExit,ease:.backOut(1.65))
        later("reveal-haptic",after:0.176){ [weak self] in self?.onHaptic?("light") }
        later("impact",after:closedExit+enter){ [weak self] in guard let self else{return};self.shine();self.revealSmoke();self.shake(strength:22,duration:0.42);self.onHaptic?("medium") }
        later("revealed",after:closedExit+enter+0.192) { [weak self] in
            guard let self else{return};self.phase="unlocked";self.revealRunning=false;self.revealed=true;self.hero.accessibilityLabel="Collect \(NativeRewardPresentation.name(board:self.board))"
            self.onHaptic?("light");self.shine();if self.queuedCollect {self.collect()}else{self.scheduleCoach(after:1);self.scheduleUnlockedIdle(after:3)}
        }
    }
    private func collect() {
        guard !disposed,!resolved,!revealRunning,revealed else{return};resolved=true;phase="exiting";epoch &+= 1;cancelTasks();removeAnimations();hand.alpha=0;coach.alpha=0
        onSoundMoment?("cta",0,generation)
        let inflation=reducedMotion ? 0 : 0.12,collapse=reducedMotion ? 0.16 : 0.224
        if inflation>0 {animate(pose.layer,"transform",from:NSValue(caTransform3D:CATransform3DIdentity),to:NSValue(caTransform3D:spatial(scaleX:1.18,scaleY:1.15)),duration:inflation,ease:.powerIn(2))}
        animate(pose.layer,"transform",from:NSValue(caTransform3D:spatial(scaleX:inflation>0 ? 1.18:1,scaleY:inflation>0 ? 1.15:1)),to:NSValue(caTransform3D:spatial(scale:0)),duration:collapse,delay:inflation,ease:reducedMotion ? .powerIn(1):.backIn(1.7))
        animate(headingLabel.layer,"opacity",from:1,to:0,duration:0.12);animate(subtitle.layer,"opacity",from:1,to:0,duration:0.12,delay:0.04)
        animate(headingLabel.layer,"transform",from:NSValue(caTransform3D:CATransform3DIdentity),to:NSValue(caTransform3D:spatial(scale:0,y:-34)),duration:0.12,ease:.backIn(1.55))
        animate(subtitle.layer,"transform",from:NSValue(caTransform3D:CATransform3DIdentity),to:NSValue(caTransform3D:spatial(scale:0,y:-28)),duration:0.12,delay:0.04,ease:.backIn(1.55))
        animatePose(unlocked.layer,from:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.restZ,x:tilt.restX,ry:tilt.restY),to:NativeRewardMotion.pose(scale:1.17,y:40,z:tilt.exitZ,x:tilt.exitX,ry:tilt.exitY,depth:-188),duration:inflation+collapse,ease:.powerIn(2))
        animate(view.layer,"opacity",from:1,to:0,duration:0.08,delay:inflation+collapse)
        later("collected",after:inflation+collapse+0.08,allowResolved:true) { [weak self] in self?.settle(.collect) }
    }
    private func scheduleInterimIdle() {
        guard !reducedMotion,foreground,!disposed,!revealed,!revealRunning else{return}
        cssTrack(pose.layer,poses:[NativeRewardMotion.pose(),NativeRewardMotion.pose(scale:1.02,y:-8),NativeRewardMotion.pose()],offsets:[0,0.5,1],duration:3)
        let extra=[NativeRewardMotion.pose(z:-0.45),NativeRewardMotion.pose(z:1.35,x:-2.3,ry:2.6,depth:5),NativeRewardMotion.pose(z:-1.15,x:1.65,ry:-2.35,depth:3),NativeRewardMotion.pose(z:0.3,x:-0.4,ry:0.7,depth:1),NativeRewardMotion.pose(z:-0.45)]
        cssTrack(interimRotor.layer,poses:extra,offsets:[0,0.28,0.58,0.78,1],duration:3,interimOrder:true)
        later("interim-idle",after:3){ [weak self] in guard let self else{return};self.shimmer(self.interimLight,gradient:self.interimSweep);self.scheduleInterimIdle()}
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
    private func shimmer(_ surface:CALayer,gradient:CAGradientLayer) {
        guard !reducedMotion,foreground,!disposed else{return};surface.opacity=0.92
        let times=[0.0,0.01,0.02,0.05,0.12,0.20,0.30,0.40,0.45,0.50,1]
        let positions=[-1.60,-1.58,-1.54,-1.40,-1.20,-0.80,0,0.80,1.20,1.60,1.60]
        keyframes(gradient,"opacity",values:[0,0.125,0.25,0.375,0.45,0.5,0.5,0.5,0.25,0,0],times:times,duration:1.7)
        keyframes(gradient,"transform",values:positions.map{position -> NSValue in var transform=CATransform3DMakeTranslation(position*gradient.bounds.width,0,0);transform.m21=tan(-12 * .pi/180);return NSValue(caTransform3D:transform)},times:times,duration:1.7)
    }
    private func shine(){shimmer(glow,gradient:sweep)}
    private func shake(strength:Double,duration:Double) {
        guard !reducedMotion else{return}
        let points=[(0.0,0.0),(strength,-strength*0.45),(-strength*0.85,strength*0.35),(strength*0.55,-strength*0.25),(-strength*0.25,strength*0.12),(0.0,0.0)]
        keyframes(view.layer,"transform",values:points.map{NSValue(caTransform3D:CATransform3DMakeTranslation($0.0,$0.1,0))},times:[0,0.12,0.24,0.38,0.54,1],duration:duration)
    }
    private func revealSmoke() {
        guard !reducedMotion,!disposed,foreground else{return};ownedSmoke?.removeFromSuperlayer()
        let plan=NativeRewardSmokePlan(width:hero.bounds.width,height:hero.bounds.height,random:random)
        let container=NativeRewardSmoke.layer(plan:plan,center:CGPoint(x:hero.bounds.midX,y:hero.bounds.midY));hero.layer.insertSublayer(container,at:0);ownedSmoke=container
        later("smoke-retire",after:1.75){ [weak self,weak container] in container?.removeAllAnimations();container?.removeFromSuperlayer();if self?.ownedSmoke===container {self?.ownedSmoke=nil} }
    }
    @objc private func panned(_ gesture:UIPanGestureRecognizer) {
        guard revealed,!revealRunning,!resolved,!disposed else{return};let delta=gesture.translation(in:view)
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
    func gestureRecognizerShouldBegin(_ gestureRecognizer:UIGestureRecognizer)->Bool {gestureRecognizer !== pan || revealed && !revealRunning}
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
            if waitingReveal,assetsReady {waitingReveal=false;reveal()}
        }
    }
    private func spatial(scale:Double=1,scaleX:Double?=nil,scaleY:Double?=nil,y:Double=0,z:Double=0,x:Double=0,ry:Double=0,depth:Double=0)->CATransform3D {
        NativeRewardMotion.pose(scale:scale,scaleX:scaleX,scaleY:scaleY,y:y,z:z,x:x,ry:ry,depth:depth).transform
    }
    private func animatePose(_ layer:CALayer,from:NativeRewardMotion.Pose,to:NativeRewardMotion.Pose,duration:Double,delay:Double=0,ease:JimiV9Motion.Ease) {
        let samples=NativeRewardMotion.samples(from:from,to:to,ease:ease.value)
        keyframes(layer,"transform",values:samples.map{NSValue(caTransform3D:$0)},times:(0..<samples.count).map{Double($0)/Double(samples.count-1)},duration:reducedMotion ? min(0.16,duration):duration,delay:delay,final:NSValue(caTransform3D:to.transform))
    }
    private func cssTrack(_ layer:CALayer,poses:[NativeRewardMotion.Pose],offsets:[Double],duration:Double,interimOrder:Bool=false) {
        let samples=NativeRewardMotion.cssTrack(poses:poses,offsets:offsets,interimOrder:interimOrder)
        keyframes(layer,"transform",values:samples.map{NSValue(caTransform3D:$0)},times:(0..<samples.count).map{Double($0)/Double(samples.count-1)},duration:duration,final:NSValue(caTransform3D:interimOrder ? poses.last!.interimIdleTransform:poses.last!.transform))
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
    private func keyframes(_ layer:CALayer,_ key:String,values:[Any],times:[Double],duration:Double,delay:Double=0,final:Any?=nil) {
        CATransaction.begin();CATransaction.setDisableActions(true);if let final {layer.setValue(final,forKeyPath:key)};CATransaction.commit()
        let animation=CAKeyframeAnimation(keyPath:key);animation.values=values;animation.keyTimes=times.map{NSNumber(value:$0)};animation.duration=duration;animation.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)+delay;animation.fillMode = delay>0 && (layer.animationKeys() ?? []).contains(where:{$0.hasPrefix("reward.\(key).")}) ? .removed:.backwards;animation.isRemovedOnCompletion=true
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
    private func removeAnimations(){foil.stop();for layer in ownedLayers {layer.removeAllAnimations()};ownedSmoke?.sublayers?.forEach{$0.removeAllAnimations()};ownedSmoke?.removeAllAnimations();ownedSmoke?.removeFromSuperlayer();ownedSmoke=nil}
    private func settle(_ action:Action){guard !disposed else{return};let callback=onFinish;onFinish=nil;dispose(notify:false);callback?(action)}
    func dispose(notify:Bool=true){guard !disposed else{return};disposed=true;phase="disposed";epoch &+= 1;cancelTasks();removeAnimations();resources.release(resourceOwner);preparationLease.cancel();preparedImages.removeAll();blurredFrames.removeAll();maskImage=nil;ownedSmoke?.removeAllAnimations();ownedSmoke?.removeFromSuperlayer();ownedSmoke=nil;for observer in observations {NotificationCenter.default.removeObserver(observer)};observations.removeAll();onSoundMoment=nil;onHaptic=nil;onAssetFailure=nil;let callback=onFinish;onFinish=nil;if notify {callback?(.cancelled)}}
}
