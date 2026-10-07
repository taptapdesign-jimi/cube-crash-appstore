import UIKit
import CoreImage

@MainActor
private final class UnlockTimer:NativeMusicCancellation {var timer:Timer?;func cancel(){timer?.invalidate();timer=nil}}
@MainActor
private final class UnlockScheduler:NativeMusicScheduler {
    func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {let task=UnlockTimer();task.timer=Timer.scheduledTimer(withTimeInterval:max(0.001,seconds),repeats:false){ [weak task] _ in MainActor.assumeIsolated{task?.timer=nil;callback()}};return task}
}
nonisolated private enum UnlockFilteredFrames {
    static let queue=DispatchQueue(label:"stacktosix.native-unlock.filters",qos:.userInitiated)
    static func prepare(_ images:[String:UIImage],lease:NativeRewardPreparationLease,completion:@escaping ([String:UIImage])->Void) {
        queue.async {let context=CIContext(options:[.cacheIntermediates:false]);var result:[String:UIImage]=[:]
            for (path,image) in images where path.contains("/backpack-") {
                guard !lease.cancelled,let cg=image.cgImage else{continue};let original=CIImage(cgImage:cg)
                let bright=original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.04,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.04,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.04,w:0)])
                let filtered=bright.clampedToExtent().applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:1.6]).cropped(to:original.extent)
                if let output=context.createCGImage(filtered,from:original.extent){result[path]=UIImage(cgImage:output,scale:image.scale,orientation:.up)}
            };let frames=result;Task { @MainActor in guard !lease.cancelled else{return};completion(frames) }
        }
    }
}

/// One authored Special Dice unlock screen. Unlock persistence belongs to the
/// injected service and occurs at the visible finale, never at mount or dismissal.
@MainActor
final class NativeSpecialDiceUnlockController:UIViewController {
    enum Action {case `continue`,cancelled}
    typealias Dice=NativeSpecialDiceUnlockPresentation.Dice
    @MainActor private final class Work {
        let callback:()->Void,epoch:UInt64,allowResolved:Bool
        var remaining:Double,deadline=0.0,lease:UInt64=0,cancellation:(any NativeMusicCancellation)?
        init(seconds:Double,epoch:UInt64,allowResolved:Bool,callback:@escaping ()->Void){remaining=seconds;self.epoch=epoch;self.allowResolved=allowResolved;self.callback=callback}
        func cancel(){lease &+= 1;cancellation?.cancel();cancellation=nil}
    }
    let diceType:Dice,generation:UInt64
    private let assets:JimiV9Artwork,resources:any NativeRewardResources,scheduler:any NativeMusicScheduler,now:()->Double,reducedMotion:Bool
    private let paper=UIImageView(),hero=UIView(),motion=UIView(),backpack=UIImageView(),final=UIImageView()
    private let headingLabel=UILabel(),subtitle=UILabel(),fault=UILabel(),cta=JimiV9PlainButton(type:.custom)
    private let shadow=CAGradientLayer(),sweep=CAGradientLayer(),light=CALayer()
    private let preparationLease=NativeRewardPreparationLease()
    private var images:[String:UIImage]=[:],blurred:[String:UIImage]=[:],tasks:[String:Work]=[:],observations:[NSObjectProtocol]=[]
    private var epoch:UInt64=1,started=false,ready=false,disposed=false,resolved=false,revealRunning=false,revealed=false,foreground=true,ctaAdmitted=false,unlockCommitted=false
    private(set) var phase="preparing"
    var onFinish:((Action)->Void)?
    var onUnlock:((String)throws->Void)?
    var onHaptic:((String)->Void)?
    var onFeedback:((String)->Void)?
    var onAssetFailure:((String)->Void)?
    var prepareFilteredFrames:(([String:UIImage],NativeRewardPreparationLease,@escaping ([String:UIImage])->Void)->Void)=UnlockFilteredFrames.prepare
    private var owner:Int {diceType == .flower ? -60001:-60002}
    init(root:URL,diceType:Dice = .flower,generation:UInt64,resources:(any NativeRewardResources)?=nil,scheduler:(any NativeMusicScheduler)?=nil,reducedMotion:Bool?=nil,now:@escaping ()->Double={ProcessInfo.processInfo.systemUptime}) {
        self.diceType=diceType;self.generation=generation;assets=JimiV9Artwork(resourceRoot:root);self.resources=resources ?? JimiNativeWorldResources(root:root);self.scheduler=scheduler ?? UnlockScheduler();self.reducedMotion=reducedMotion ?? UIAccessibility.isReduceMotionEnabled;self.now=now
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use Native unlock initializer")}
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        paper.image=assets.image("assets/paper-bg.png");paper.contentMode = .scaleToFill;view.addSubview(paper)
        for label in [headingLabel,subtitle] {label.textAlignment = .center;view.addSubview(label)}
        headingLabel.text="Special Dice";headingLabel.textColor=UIColor(red:239/255,green:116/255,blue:77/255,alpha:1);subtitle.text="Tap the backpack to reveal";subtitle.textColor=UIColor(red:196/255,green:168/255,blue:150/255,alpha:1)
        view.addSubview(hero);hero.layer.addSublayer(shadow);hero.addSubview(motion);motion.addSubview(backpack);motion.addSubview(final);motion.layer.addSublayer(light);light.addSublayer(sweep);light.masksToBounds=true
        for image in [backpack,final] {image.contentMode = .scaleAspectFit;image.isUserInteractionEnabled=false}
        hero.accessibilityIdentifier="native.special-unlock.hero";hero.accessibilityLabel="Reveal \(diceType.label) special dice";hero.accessibilityTraits = .button
        hero.addGestureRecognizer(UITapGestureRecognizer(target:self,action:#selector(activateHero)))
        shadow.type = .radial;shadow.colors=[UIColor(red:185/255,green:105/255,blue:62/255,alpha:0.34).cgColor,UIColor(red:185/255,green:105/255,blue:62/255,alpha:0.2).cgColor,UIColor.clear.cgColor];shadow.locations=[0,0.42,0.76];shadow.startPoint=CGPoint(x:0.5,y:0.5);shadow.endPoint=CGPoint(x:1,y:1)
        sweep.colors=[UIColor.clear.cgColor,UIColor.white.withAlphaComponent(0.56).cgColor,UIColor.clear.cgColor];sweep.locations=[0,0.5,1];sweep.startPoint=CGPoint(x:0,y:0.5);sweep.endPoint=CGPoint(x:1,y:0.5);sweep.opacity=0;light.opacity=0
        cta.setTitle("Continue",for:.normal);cta.titleLabel?.font=assets.font(size:28,weight:"Bold");cta.setTitleColor(UIColor(red:1,green:251/255,blue:242/255,alpha:1),for:.normal)
        cta.backgroundColor=UIColor(red:233/255,green:122/255,blue:85/255,alpha:1);cta.layer.cornerRadius=32;cta.layer.shadowColor=UIColor(red:194/255,green:73/255,blue:33/255,alpha:1).cgColor;cta.layer.shadowOffset=CGSize(width:0,height:8);cta.layer.shadowOpacity=1;cta.layer.shadowRadius=0
        cta.titleLabel?.shadowColor=UIColor(red:194/255,green:73/255,blue:33/255,alpha:1);cta.titleLabel?.shadowOffset=CGSize(width:0,height:2)
        cta.addTarget(self,action:#selector(activateContinue),for:.touchUpInside);cta.addTarget(self,action:#selector(pressCTA),for:[.touchDown,.touchDragEnter]);cta.addTarget(self,action:#selector(cancelCTA),for:[.touchCancel,.touchUpOutside,.touchDragExit]);cta.accessibilityIdentifier="native.special-unlock.continue";view.addSubview(cta)
        fault.numberOfLines=0;fault.textColor = .systemRed;fault.textAlignment = .center;fault.font=assets.font(size:16,weight:"Medium");view.addSubview(fault)
        for layer in [hero.layer,headingLabel.layer,subtitle.layer,shadow,final.layer,cta.layer] {layer.opacity=0}
        cta.isEnabled=false;cta.layer.transform=transform(scale:0,y:18)
        let paths=(1...20).map{NativeSpecialDiceUnlockPresentation.framePath($0)}+[diceType.asset]
        resources.prepare(paths,owner:owner,required:true) { [weak self] accepted in
            guard let self,!self.disposed else{return};guard accepted else {self.phase="assets-failed";self.fault.text="Selected Special Dice artwork could not be prepared.";self.onAssetFailure?("Selected native Special Dice artwork failed");return}
            for path in paths {self.images[path]=self.resources.image(path,owner:self.owner)}
            self.backpack.image=self.images[NativeSpecialDiceUnlockPresentation.framePath(1)];self.final.image=self.images[self.diceType.asset]
            self.prepareFilteredFrames(self.images,self.preparationLease) { [weak self] frames in guard let self,!self.disposed else{return};self.blurred=frames;self.ready=true;self.phase="mounted";self.view.setNeedsLayout();if self.started {self.enter()} }
        }
        observations=[NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main){[weak self] _ in MainActor.assumeIsolated{self?.setForeground(false)}},NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main){[weak self] _ in MainActor.assumeIsolated{self?.setForeground(true)}}]
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();paper.frame=view.bounds;let layout=NativeSpecialDiceUnlockPresentation.Layout(width:view.bounds.width,height:view.bounds.height)
        headingLabel.frame=layout.title;subtitle.frame=layout.subtitle;hero.frame=layout.hero;shadow.frame=layout.shadow;cta.bounds=CGRect(origin:.zero,size:layout.cta.size);cta.center=CGPoint(x:layout.cta.midX,y:layout.cta.midY)
        headingLabel.font=assets.font(size:layout.titleFont,weight:"ExtraBold");subtitle.font=assets.font(size:layout.subtitleFont,weight:"SemiBold")
        motion.frame=hero.bounds;backpack.bounds=hero.bounds;backpack.center=CGPoint(x:hero.bounds.midX,y:hero.bounds.midY);final.bounds=CGRect(x:0,y:0,width:hero.bounds.width*0.52,height:hero.bounds.height*0.52);final.center=backpack.center
        light.frame=hero.bounds;sweep.frame=light.bounds;paintMask(revealed ? diceType.asset:NativeSpecialDiceUnlockPresentation.framePath(1),scale:revealed ? 0.56:1)
        fault.frame=CGRect(x:24,y:cta.frame.maxY+20,width:view.bounds.width-48,height:60)
    }
    override func viewDidAppear(_ animated:Bool){super.viewDidAppear(animated);start()}
    func start(){guard !disposed,!started else{return};started=true;if ready {enter()}}
    private func enter() {
        phase="entering";onHaptic?("medium")
        animate(headingLabel.layer,from:transform(scale:0,y:-28),to:CATransform3DIdentity,duration:0.24,ease:.backOut(1.65));fade(headingLabel.layer,from:0,to:1,duration:0.24)
        animate(subtitle.layer,from:transform(scale:0,y:-22),to:CATransform3DIdentity,duration:0.24,delay:0.03,ease:.backOut(1.65));fade(subtitle.layer,from:0,to:1,duration:0.24,delay:0.03)
        animate(hero.layer,from:transform(scale:0,y:-30,z:-8),to:CATransform3DIdentity,duration:0.52,delay:0.18,ease:.backOut(1.7));fade(hero.layer,from:0,to:1,duration:0.52,delay:0.18)
        fade(shadow,from:0,to:1,duration:0.26)
        if !reducedMotion {keyframes(motion.layer,"transform",values:[transform(),transform(scale:1.02,y:-8,z:1),transform()].map{NSValue(caTransform3D:$0)},times:[0,0.5,1],duration:3)}
        later("entered",after:0.70){[weak self] in guard let self else{return};self.phase="ready";if !self.reducedMotion {self.keyframes(self.shadow,"opacity",values:[1,0.72,1],times:[0,0.5,1],duration:2.28);self.keyframes(self.shadow,"transform",values:[CATransform3DIdentity,CATransform3DMakeScale(0.86,0.82,1),CATransform3DIdentity].map{NSValue(caTransform3D:$0)},times:[0,0.5,1],duration:2.28)}}
    }
    @objc func activateHero() {
        guard !disposed,!resolved,foreground,ready else{return}
        if revealed,!revealRunning {activateContinue();return}
        if phase=="save-failed" {commitUnlock();return}
        guard !revealRunning else{return};revealRunning=true;phase="opening";epoch &+= 1;cancelTasks();removeAnimations();hero.layer.opacity=1;hero.layer.transform=CATransform3DIdentity;onHaptic?("medium")
        for frame in 1...20 {
            later("frame\(frame)",after:NativeSpecialDiceUnlockPresentation.frameStartTimes[frame-1]) {[weak self] in
                guard let self else{return};let path=NativeSpecialDiceUnlockPresentation.framePath(frame);self.backpack.image=self.blurred[path] ?? self.images[path];self.paintMask(path,scale:1)
                self.animate(self.backpack.layer,from:self.transform(scale:frame>=18 ? 1.08:1.02),to:CATransform3DIdentity,duration:0.045,ease:.cubicBezier(0.39,0.575,0.565,1))
                self.later("blur\(frame)",after:0.0225){[weak self] in self?.backpack.image=self?.images[path]}
                if [1,7,14,20].contains(frame) {self.onHaptic?(frame==20 ? "medium":"light")}
            }
        }
        later("reveal",after:NativeSpecialDiceUnlockPresentation.frameDuration){[weak self] in self?.revealFinale()}
    }
    private func revealFinale() {
        guard !disposed,!resolved else{return};phase="revealing";headingLabel.text="Unlocked!";subtitle.text="Special dice unlocked \"\(diceType.label)\"";headingLabel.layer.opacity=0;subtitle.layer.opacity=0
        animate(backpack.layer,from:CATransform3DIdentity,to:transform(scale:0,y:-30,z:-8),duration:0.32,ease:.backIn(1.65));fade(backpack.layer,from:1,to:0,duration:0.32)
        fade(shadow,from:0,to:0.82,duration:0.24,delay:0.02)
        animate(shadow,from:CATransform3DMakeScale(0.52,0.58,1),to:CATransform3DMakeScale(1.16,1.08,1),duration:0.24,delay:0.02,ease:.powerOut(2))
        animate(final.layer,from:transform(scale:0,y:-18,z:-5),to:transform(scale:0.52,y:-4),duration:0.52,delay:0.02,ease:.backOut(1.85));fade(final.layer,from:0,to:1,duration:0.52,delay:0.02)
        animate(headingLabel.layer,from:transform(scale:0.72,y:-16),to:CATransform3DIdentity,duration:0.24,delay:0.02,ease:.backOut(1.65));fade(headingLabel.layer,from:0,to:1,duration:0.24,delay:0.02)
        animate(subtitle.layer,from:transform(scale:0.78,y:-12),to:CATransform3DIdentity,duration:0.24,delay:0.02,ease:.backOut(1.65));fade(subtitle.layer,from:0,to:1,duration:0.24,delay:0.02)
        later("reveal-haptic",after:0.04){[weak self] in self?.shake(13);self?.onHaptic?("medium")}
        later("cta-enter",after:0.22){[weak self] in guard let self else{return};self.ctaAdmitted=true;self.cta.isEnabled=true;self.animate(self.cta.layer,from:self.transform(scale:0,y:18),to:CATransform3DIdentity,duration:0.34,ease:.backOut(1.8));self.fade(self.cta.layer,from:0,to:1,duration:0.34)}
        later("unlock",after:0.54){[weak self] in self?.commitUnlock()}
    }
    private func commitUnlock() {
        guard !disposed,!resolved,!unlockCommitted else{return}
        do {try onUnlock?(diceType.rawValue);unlockCommitted=true;ctaAdmitted=true;cta.isEnabled=true;fault.text=nil;revealed=true;revealRunning=false;phase="unlocked";hero.accessibilityLabel="Continue";shake(22);shine()}
        catch {fault.text="Unable to save this unlock. Tap to retry.";revealRunning=false;cta.isEnabled=false;ctaAdmitted=false;phase="save-failed"}
    }
    @objc func activateContinue() {
        guard !disposed,!resolved,foreground,ctaAdmitted else{if phase=="save-failed" {commitUnlock()};return}
        resolved=true;phase="exiting";epoch &+= 1;cancelTasks();removeAnimations();onHaptic?("selection");onFeedback?("cta");ctaAdmitted=false;cta.isEnabled=false
        animate(cta.layer,from:cta.layer.transform,to:transform(scale:0,y:18),duration:0.31,ease:.backIn(1.75));fade(cta.layer,from:1,to:0,duration:0.31)
        // CTA exits first; the authored screen then serially retires hero/headingLabel/subtitle/paper.
        animate(hero.layer,from:CATransform3DIdentity,to:transform(scale:0,y:-30,z:-8),duration:0.24,delay:0.31,ease:.backIn(1.65));fade(hero.layer,from:1,to:0,duration:0.24,delay:0.31)
        animate(headingLabel.layer,from:CATransform3DIdentity,to:transform(scale:0,y:-34),duration:0.18,delay:0.55,ease:.backIn(1.55));fade(headingLabel.layer,from:1,to:0,duration:0.18,delay:0.55)
        animate(subtitle.layer,from:CATransform3DIdentity,to:transform(scale:0,y:-28),duration:0.18,delay:0.73,ease:.backIn(1.55));fade(subtitle.layer,from:1,to:0,duration:0.18,delay:0.73)
        fade(view.layer,from:1,to:0,duration:0.10,delay:0.91);later("continued",after:1.01,allowResolved:true){[weak self] in self?.settle(.continue)}
    }
    @objc private func pressCTA(){guard ctaAdmitted,!resolved,foreground else{return};animate(cta.layer,from:cta.layer.presentation()?.transform ?? cta.layer.transform,to:transform(scale:0.84,y:4),duration:0.12,ease:.powerOut(2))}
    @objc private func cancelCTA(){guard ctaAdmitted,!resolved,foreground else{return};animate(cta.layer,from:cta.layer.presentation()?.transform ?? cta.layer.transform,to:CATransform3DIdentity,duration:0.26,ease:.backOut(2.1))}
    private func paintMask(_ path:String,scale:Double){let mask=CALayer();mask.bounds=CGRect(x:0,y:0,width:light.bounds.width*scale,height:light.bounds.height*scale);mask.position=CGPoint(x:light.bounds.midX,y:light.bounds.midY);mask.contents=images[path]?.cgImage;mask.contentsGravity = .resizeAspect;light.mask=mask}
    private func shine(){guard !reducedMotion else{return};paintMask(diceType.asset,scale:0.56);light.opacity=0.92
        let times=[0.0,0.10,0.15,0.20,0.30,0.40,0.45,0.50,1],positions=[-1.6,-1.6,-1.2,-0.8,0,0.8,1.2,1.6,1.6]
        keyframes(sweep,"opacity",values:[0,0,0.5,1,1,1,0.5,0,0],times:times,duration:1.7)
        keyframes(sweep,"transform",values:positions.map{value->NSValue in var t=CATransform3DMakeTranslation(value*sweep.bounds.width,0,0);t.m21=tan(-12 * .pi/180);return NSValue(caTransform3D:t)},times:times,duration:1.7)
        keyframes(final.layer,"transform",values:[transform(scale:0.52,y:-4),transform(scale:0.56,y:-4),transform(scale:0.52,y:-4)].map{NSValue(caTransform3D:$0)},times:[0,0.14/0.32,1],duration:0.32)
    }
    private func shake(_ strength:Double){guard !reducedMotion else{return};keyframes(view.layer,"transform",values:[(0.0,0.0),(strength,-strength*0.45),(-strength*0.85,strength*0.35),(strength*0.55,-strength*0.25),(0,0)].map{NSValue(caTransform3D:CATransform3DMakeTranslation($0.0,$0.1,0))},times:[0,0.12,0.24,0.38,1],duration:0.42)}
    private func transform(scale:Double=1,y:Double=0,z:Double=0)->CATransform3D {var value=CATransform3DMakeTranslation(0,y,0);value=CATransform3DRotate(value,z * .pi/180,0,0,1);return CATransform3DScale(value,scale,scale,1)}
    private func animate(_ layer:CALayer,from:CATransform3D,to:CATransform3D,duration:Double,delay:Double=0,ease:JimiV9Motion.Ease){let values=(0...48).map{step->NSValue in let t=ease.value(Double(step)/48);var value=CATransform3DIdentity;withUnsafeMutableBytes(of:&value){dest in withUnsafeBytes(of:from){a in withUnsafeBytes(of:to){b in let target=dest.bindMemory(to:CGFloat.self),left=a.bindMemory(to:CGFloat.self),right=b.bindMemory(to:CGFloat.self);for i in 0..<16 {target[i]=left[i]+(right[i]-left[i])*t}}}};return NSValue(caTransform3D:value)};keyframes(layer,"transform",values:values,times:(0...48).map{Double($0)/48},duration:reducedMotion ? min(0.16,duration):duration,delay:delay,final:NSValue(caTransform3D:to))}
    private func fade(_ layer:CALayer,from:Double,to:Double,duration:Double,delay:Double=0){keyframes(layer,"opacity",values:[from,to],times:[0,1],duration:duration,delay:delay,final:to)}
    private func keyframes(_ layer:CALayer,_ key:String,values:[Any],times:[Double],duration:Double,delay:Double=0,final:Any?=nil){CATransaction.begin();CATransaction.setDisableActions(true);if let final {layer.setValue(final,forKeyPath:key)};CATransaction.commit();let animation=CAKeyframeAnimation(keyPath:key);animation.values=values;animation.keyTimes=times.map(NSNumber.init(value:));animation.duration=duration;animation.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)+delay;animation.fillMode = .backwards;layer.add(animation,forKey:"unlock.\(key)")}
    private func later(_ id:String,after seconds:Double,allowResolved:Bool=false,_ callback:@escaping ()->Void){tasks.removeValue(forKey:id)?.cancel();let work=Work(seconds:seconds,epoch:epoch,allowResolved:allowResolved,callback:callback);tasks[id]=work;if foreground {arm(id,work)}}
    private func arm(_ id:String,_ work:Work){work.cancel();work.deadline=now()+work.remaining;let lease=work.lease;work.cancellation=scheduler.after(work.remaining){[weak self,weak work] in guard let self,let work,!self.disposed,self.foreground,self.epoch==work.epoch,work.lease==lease,self.tasks[id]===work,work.allowResolved || !self.resolved else{return};self.tasks.removeValue(forKey:id);work.callback()}}
    func setForeground(_ value:Bool){guard !disposed,foreground != value else{return};foreground=value;if !value {let time=view.layer.convertTime(CACurrentMediaTime(),from:nil);view.layer.speed=0;view.layer.timeOffset=time;for work in tasks.values {work.remaining=max(0,work.deadline-now());work.cancel()}}else{let paused=view.layer.timeOffset;view.layer.speed=1;view.layer.timeOffset=0;view.layer.beginTime=0;view.layer.beginTime=view.layer.convertTime(CACurrentMediaTime(),from:nil)-paused;for(id,work)in tasks {arm(id,work)}}}
    private func cancelTasks(){tasks.values.forEach{$0.cancel()};tasks.removeAll()}
    private func removeAnimations(){for layer in [view.layer,headingLabel.layer,subtitle.layer,hero.layer,motion.layer,backpack.layer,final.layer,light,sweep,shadow,cta.layer] {layer.removeAllAnimations()}}
    private func settle(_ action:Action){guard !disposed else{return};let callback=onFinish;onFinish=nil;dispose(notify:false);callback?(action)}
    func dispose(notify:Bool=true){guard !disposed else{return};disposed=true;phase="disposed";epoch &+= 1;cancelTasks();removeAnimations();preparationLease.cancel();resources.release(owner);images.removeAll();blurred.removeAll();observations.forEach{NotificationCenter.default.removeObserver($0)};observations.removeAll();onHaptic=nil;onFeedback=nil;onUnlock=nil;onAssetFailure=nil;let callback=onFinish;onFinish=nil;if notify {callback?(.cancelled)}}
}
