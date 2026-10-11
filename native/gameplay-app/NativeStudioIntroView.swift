import UIKit
import AVFoundation
import ImageIO
import CoreImage

/// Selected authored proxy only. Images are decoded on one serial queue;
/// no array of the movie's hundreds of frames is retained.
nonisolated private final class NativeStudioAnimatedDecoder:@unchecked Sendable {
    let source:CGImageSource,count:Int
    init?(url:URL){
        guard let source=CGImageSourceCreateWithURL(url as CFURL,[kCGImageSourceShouldCache:false] as CFDictionary),CGImageSourceGetCount(source)>1 else{return nil}
        self.source=source;count=CGImageSourceGetCount(source)
    }
    func frame(_ index:Int)->(CGImage,Double)? {
        guard let image=CGImageSourceCreateImageAtIndex(source,index,[kCGImageSourceShouldCache:false] as CFDictionary) else{return nil}
        let properties=CGImageSourceCopyPropertiesAtIndex(source,index,nil) as? [CFString:Any]
        let webp=properties?[kCGImagePropertyWebPDictionary] as? [CFString:Any]
        let delay=(webp?[kCGImagePropertyWebPUnclampedDelayTime] as? NSNumber)?.doubleValue ?? (webp?[kCGImagePropertyWebPDelayTime] as? NSNumber)?.doubleValue ?? 1.0/30
        return(image,max(0.01,delay))
    }
}

/// Native owner of the preserved v9 studio composition. One finite CA timeline;
/// only the selected original transparent HEVC loop is decoded. No web surface.
@MainActor
final class NativeStudioIntroView:UIView,CAAnimationDelegate {
    enum MediaPreparation {case automatic,animatedFallback,manualReadiness}
    struct Character {
        let key:String,scale:CGFloat,x:CGFloat,y:CGFloat,topPivot:Bool
        init(_ key:String,_ scale:CGFloat,_ x:CGFloat=0,_ y:CGFloat=0,_ top:Bool=false){self.key=key;self.scale=scale;self.x=x;self.y=y;topPivot=top}
    }
    static let characters:[Character]=[
        .init("lik-kauc",1.1475,0,40),.init("lik-gitara",1.1,0,16),.init("lik-slikanje",1.08,20,10),
        .init("lik-cvijet",1.08,0,8),.init("lik-board",1.04,0,16),.init("lik-game",1.08),
        .init("lik-laptop",1.452,0,8),.init("lik-pas-SVG",1.12,0,0,true),.init("lik-speceraj",1.21,0,20),
        .init("lik-nogomet",1.1),.init("pas-novine",1.1,0,16)]
    static let duration=4.33
    let character:Character
    private let artwork:JimiV9Artwork,logoUnit=UIView(),logo=UIImageView(),sheen=UIImageView(),label=UILabel(),characterView=UIView(),fallback=UIImageView()
    private let sheenMask=CAGradientLayer(),resourceRoot:URL,mediaPreparation:MediaPreparation,readinessTimeout:TimeInterval
    private let decodeQueue=DispatchQueue(label:"com.taptapdesign.stacktosix.native-intro-proxy",qos:.userInitiated)
    private let videoProgressProbe:(()->Double)?
    private let decodedPublicationGate:((@escaping ()->Void)->Void)?
    private var pendingFallbackReason:String?
    private var decoder:NativeStudioAnimatedDecoder?,mediaEpoch:UInt64=0,frameIndex=0
    private var readinessDeadline:DispatchWorkItem?,fallbackFrameWork:DispatchWorkItem?
    private var videoProgressWork:DispatchWorkItem?,lastVideoTime=0.0,lastVideoAdvance=0.0
    private let playerLayer=AVPlayerLayer()
    private var readiness:NSKeyValueObservation?
    private var itemStatus:NSKeyValueObservation?
    private var currentItemObservation:NSKeyValueObservation?
    private var player:AVQueuePlayer?,looper:AVPlayerLooper?,observers:[NSObjectProtocol]=[]
    private var playbackObservation:Any?,sampledPlaybackSeconds=0.0,playbackObservationSequence:UInt64=0
    private var completion:(()->Void)?,started=false,disposed=false,backgrounded=false
    private(set) var timelineStarted=false,selectedMotionSource="pending",fallbackFramesPresented=0
    private(set) var videoProgressCheckCount=0
    private var pendingTimelineStart=false
    var displayedFallbackImage:UIImage?{fallback.image}
    /// AVPlayer currentTime can block behind decoder locks. Main reads only the
    /// last time delivered by the selected player's existing media clock.
    var mediaPlaybackSeconds:Double{sampledPlaybackSeconds}
    var isRetired:Bool{disposed}
    var terminalCompositionHidden:Bool{isHidden && logoUnit.layer.opacity==0 && characterView.layer.opacity==0}
    var onCharacterCue:((String)->Void)?
    init(root:URL,character:Character?=nil,mediaPreparation:MediaPreparation = .automatic,readinessTimeout:TimeInterval=1.8,
         videoProgressProbe:(()->Double)?=nil,decodedPublicationGate:((@escaping ()->Void)->Void)?=nil) {
        resourceRoot=root;self.mediaPreparation=mediaPreparation;self.readinessTimeout=readinessTimeout
        self.videoProgressProbe=videoProgressProbe
        self.decodedPublicationGate=decodedPublicationGate
        artwork=JimiV9Artwork(resourceRoot:root)
        self.character=character ?? Self.characters.randomElement()!
        super.init(frame:.zero);isUserInteractionEnabled=true;accessibilityIdentifier="native.studio-intro"
        addSubview(logoUnit);logoUnit.addSubview(logo);logoUnit.addSubview(sheen);logoUnit.addSubview(label);addSubview(characterView);characterView.addSubview(fallback)
        logoUnit.layer.opacity=0;characterView.layer.opacity=0
        logo.image=artwork.image("assets/logo addons/taplogo.png");logo.contentMode = .scaleAspectFit
        sheen.contentMode = .scaleAspectFit;sheen.isUserInteractionEnabled=false;sheen.layer.opacity=0
        if let image=logo.image,let cg=image.cgImage {
            let input=CIImage(cgImage:cg).applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.06])
                .applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.32,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.32,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.32,w:0)])
            if let bright=CIContext().createCGImage(input,from:input.extent){sheen.image=UIImage(cgImage:bright,scale:image.scale,orientation:image.imageOrientation)}
        }
        sheenMask.colors=[UIColor.clear.cgColor,UIColor.black.cgColor,UIColor.black.cgColor,UIColor.clear.cgColor]
        sheenMask.locations=[0.38,0.48,0.52,0.62];sheen.layer.mask=sheenMask
        label.attributedText=NSAttributedString(string:"PRESENTS",attributes:[.font:artwork.font(size:15),.kern:0.9,.foregroundColor:UIColor(red:184.0/255,green:121.0/255,blue:96.0/255,alpha:1)])
        label.textAlignment = .center
        let png=self.character.key == "lik-slikanje" ? "lik slikanje":self.character.key == "pas-novine" ? "pas novine":self.character.key == "lik-pas-SVG" ? "lik-pas":self.character.key
        fallback.image=artwork.image("assets/logo addons/\(png).png");fallback.contentMode = .scaleAspectFit
        let url=root.appendingPathComponent("assets/logo addons/optimized/\(self.character.key)-mobile-hevc.mov")
        if mediaPreparation == .automatic,FileManager.default.fileExists(atPath:url.path) {
            let item=AVPlayerItem(url:url),queue=AVQueuePlayer();queue.isMuted=true;queue.actionAtItemEnd = .none
            looper=AVPlayerLooper(player:queue,templateItem:item);player=queue;playerLayer.player=queue;playerLayer.videoGravity = .resizeAspect
            installPlaybackObservation()
            characterView.layer.addSublayer(playerLayer)
            readiness=playerLayer.observe(\.isReadyForDisplay,options:[.initial,.new]) { [weak self] layer,_ in
                DispatchQueue.main.async { [weak self] in
                    guard let self,!self.disposed else{return}
                    self.receiveVideoReadiness(layer.isReadyForDisplay)
                }
            }
            currentItemObservation=queue.observe(\.currentItem,options:[.initial,.new]){[weak self] queue,_ in
                let current=queue.currentItem
                DispatchQueue.main.async{[weak self] in
                    guard let self,!self.disposed,let current,self.player?.currentItem === current else{return}
                    self.itemStatus?.invalidate()
                    self.itemStatus=current.observe(\.status,options:[.initial,.new]){[weak self] item,_ in
                        guard item.status == .failed else{return}
                        DispatchQueue.main.async{[weak self] in
                            guard let self,!self.disposed,self.player?.currentItem === item else{return}
                            self.beginAnimatedFallback(reason:"video-failed")
                        }
                    }
                }
            }
        }
        if self.character.topPivot {characterView.layer.anchorPoint=CGPoint(x:0.5,y:0)}
        for name in [UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main){[weak self] note in
                MainActor.assumeIsolated{self?.setBackgrounded(note.name==UIApplication.willResignActiveNotification)}
            })
        }
    }
    private func retirePlaybackObservation(){
        playbackObservationSequence &+= 1
        if let playbackObservation{player?.removeTimeObserver(playbackObservation)}
        playbackObservation=nil
    }
    private func installPlaybackObservation(){
        retirePlaybackObservation()
        guard let player,!disposed,!backgrounded else{return}
        let sequence=playbackObservationSequence,epoch=mediaEpoch
        playbackObservation=player.addPeriodicTimeObserver(forInterval:CMTime(seconds:0.1,preferredTimescale:600),queue:decodeQueue){[weak self,weak player] time in
            let seconds=time.seconds
            DispatchQueue.main.async{[weak self,weak player] in
                guard let self,let player,!self.disposed,!self.backgrounded,self.player === player,
                      self.playbackObservationSequence==sequence,self.mediaEpoch==epoch,seconds.isFinite,
                      self.selectedMotionSource=="pending" || self.selectedMotionSource=="hevc-alpha" else{return}
                self.sampledPlaybackSeconds=seconds
            }
        }
    }
    required init?(coder:NSCoder){fatalError("Native original-art initializer")}
    override func layoutSubviews(){
        super.layoutSubviews()
        let width=min(bounds.width*0.806,315),charWidth=min(bounds.width*0.74,289)
        let logoAspect=logo.image.map{$0.size.height/max(1,$0.size.width)} ?? 0.5
        let imageHeight=width*logoAspect,logoHeight=imageHeight+29
        let aspect=fallback.image.map{$0.size.height/max(1,$0.size.width)} ?? 1
        let charHeight=min(bounds.height*0.54,charWidth*aspect),total=logoHeight+20+charHeight
        let top=(bounds.height-total)/2
        logoUnit.bounds=CGRect(x:0,y:0,width:width,height:logoHeight);logoUnit.center=CGPoint(x:bounds.midX,y:top+logoHeight/2)
        logo.frame=CGRect(x:0,y:0,width:width,height:imageHeight);sheen.frame=logo.frame;label.frame=CGRect(x:0,y:imageHeight+14,width:width,height:15)
        CATransaction.begin();CATransaction.setDisableActions(true)
        sheenMask.bounds=CGRect(x:0,y:0,width:width*2.6,height:imageHeight)
        sheenMask.position=CGPoint(x:width*1.3-width*1.6*1.45,y:imageHeight/2)
        let angle=110.0*Double.pi/180,dx=sin(angle),dy = -cos(angle),length=Double(width*2.6)*abs(dx)+Double(imageHeight)*abs(dy)
        sheenMask.startPoint=CGPoint(x:0.5-dx*length/Double(width*2.6)/2,y:0.5-dy*length/Double(max(1,imageHeight))/2)
        sheenMask.endPoint=CGPoint(x:1-sheenMask.startPoint.x,y:1-sheenMask.startPoint.y)
        CATransaction.commit()
        characterView.bounds=CGRect(x:0,y:0,width:charWidth,height:charHeight)
        characterView.layer.position=CGPoint(x:bounds.midX+character.x,y:top+logoHeight+20+charHeight*characterView.layer.anchorPoint.y+character.y)
        fallback.frame=characterView.bounds;playerLayer.frame=characterView.bounds
    }
    static func scale(at seconds:Double,character:Bool,rest:Double=1)->Double {
        let begin=character ? 0.15:0,enter=character ? 0.55:0.45,exit=character ? 3.5:3.68
        if seconds<begin{return rest*(character ? 0.82:0.92)}
        if seconds<begin+enter {
            let p=(seconds-begin)/enter,e=character ? JimiV9Motion.Ease.backOut(1.8).value(p):(p<0.5 ? 4*p*p*p:1-pow(-2*p+2,3)/2)
            return rest*((character ? 0.82:0.92)+(character ? 0.18:0.08)*e)
        }
        if seconds<exit{return rest}
        return rest*(1-JimiV9Motion.Ease.backIn(2.2).value(min(1,(seconds-exit)/0.65)))
    }
    func start(completion:@escaping()->Void){
        guard !started,!disposed else{return};started=true;self.completion=completion;layoutIfNeeded()
        player?.play()
        if mediaPreparation == .animatedFallback || (mediaPreparation == .automatic && player==nil){beginAnimatedFallback(reason:"video-unavailable");return}
        if player?.currentItem?.status == .failed{beginAnimatedFallback(reason:"video-failed");return}
        if playerLayer.isReadyForDisplay {receiveVideoReadiness(true);return}
        armReadinessDeadline()
    }
    private func armReadinessDeadline(){
        guard !disposed,!backgrounded,!timelineStarted else{return}
        let epoch=mediaEpoch,deadline=DispatchWorkItem{[weak self] in
            MainActor.assumeIsolated{guard let self,!self.disposed,self.mediaEpoch==epoch,!self.timelineStarted else{return};self.beginAnimatedFallback(reason:"readiness-timeout")}
        }
        readinessDeadline=deadline;scheduleMediaDeadline(deadline,after:readinessTimeout)
    }
    /// One selected-media preparation scheduling site for initial readiness and
    /// finite playback checks. These jobs never acquire a display/ticker lease.
    private func scheduleMediaDeadline(_ work:DispatchWorkItem,after delay:Double){
        DispatchQueue.main.asyncAfter(deadline:.now()+delay,execute:work)
    }
    func receiveVideoReadiness(_ ready:Bool){
        guard started,!disposed,ready,selectedMotionSource=="pending" || selectedMotionSource=="hevc-alpha" else{return}
        let firstReady=selectedMotionSource=="pending"
        readinessDeadline?.cancel();readinessDeadline=nil;selectedMotionSource="hevc-alpha"
        fallback.isHidden=true;playerLayer.isHidden=false
        NSLog("[NativeStudioIntro] character=%@ motion=hevc-alpha ready=1",character.key)
        beginTimeline()
        if firstReady {beginVideoProgressChecks()}
    }
    /// Readiness proves only a displayed first frame. Keep a finite selected
    /// playback watchdog during this intro, using no animation/display ticker.
    private func beginVideoProgressChecks(){
        guard mediaPreparation == .automatic,!disposed,!backgrounded,selectedMotionSource=="hevc-alpha" else{return}
        lastVideoTime=videoProgressProbe?() ?? mediaPlaybackSeconds;lastVideoAdvance=CACurrentMediaTime()
        scheduleVideoProgressCheck()
    }
    private func scheduleVideoProgressCheck(){
        guard !disposed,!backgrounded,selectedMotionSource=="hevc-alpha",videoProgressCheckCount<13 else{return}
        videoProgressWork?.cancel()
        let epoch=mediaEpoch,work=DispatchWorkItem{[weak self] in MainActor.assumeIsolated{
            guard let self,!self.disposed,!self.backgrounded,self.mediaEpoch==epoch,self.selectedMotionSource=="hevc-alpha" else{return}
            self.videoProgressWork=nil;self.videoProgressCheckCount+=1
            let time=self.videoProgressProbe?() ?? self.mediaPlaybackSeconds,now=CACurrentMediaTime()
            // Loop wrap also proves playback; don't misclassify a short movie.
            if time.isFinite,abs(time-self.lastVideoTime)>0.01 {
                self.lastVideoTime=time;self.lastVideoAdvance=now
            } else if now-self.lastVideoAdvance>=0.8 {
                self.beginAnimatedFallback(reason:"video-playback-stalled");return
            }
            self.scheduleVideoProgressCheck()
        }}
        videoProgressWork=work;scheduleMediaDeadline(work,after:0.35)
    }
    private func beginAnimatedFallback(reason:String){
        guard started,!disposed,!backgrounded,decoder==nil,selectedMotionSource != "animated-webp",selectedMotionSource != "fallback-loading" else{return}
        readinessDeadline?.cancel();readinessDeadline=nil;mediaEpoch &+= 1;let epoch=mediaEpoch
        videoProgressWork?.cancel();videoProgressWork=nil;retirePlaybackObservation()
        selectedMotionSource="fallback-loading";player?.pause();playerLayer.isHidden=true;fallback.isHidden=false
        pendingFallbackReason=reason
        let url=resourceRoot.appendingPathComponent("assets/logo addons/optimized/\(character.key)-mobile.webp")
        decodeQueue.async{[weak self] in
            let decoder=NativeStudioAnimatedDecoder(url:url),first=decoder?.frame(0)
            DispatchQueue.main.async{[weak self] in
                self?.publishDecodedMedia{[weak self] in
                guard let self,!self.disposed,!self.backgrounded,self.mediaEpoch==epoch else{return}
                self.pendingFallbackReason=nil
                guard let decoder,let first else{
                    self.selectedMotionSource="static-fallback-unavailable";NSLog("[NativeStudioIntro] character=%@ motion=static reason=%@",self.character.key,reason)
                    self.beginTimeline();return
                }
                self.decoder=decoder;self.selectedMotionSource="animated-webp";self.frameIndex=0
                self.fallback.image=UIImage(cgImage:first.0);self.fallbackFramesPresented+=1
                NSLog("[NativeStudioIntro] character=%@ motion=animated-webp reason=%@ frames=%d",self.character.key,reason,decoder.count)
                self.beginTimeline();self.scheduleFallbackFrame(after:first.1)
                }
            }
        }
    }
    /// Optional test hold exercises real background decode completions; normal
    /// publication remains one main-queue callback with no extra scheduler.
    private func publishDecodedMedia(_ publication:@escaping ()->Void){
        if let decodedPublicationGate{decodedPublicationGate(publication)}else{publication()}
    }
    private func scheduleFallbackFrame(after delay:Double){
        guard !disposed,!backgrounded,decoder != nil else{return}
        let epoch=mediaEpoch,work=DispatchWorkItem{[weak self] in MainActor.assumeIsolated{
            guard let self,!self.disposed,!self.backgrounded,self.mediaEpoch==epoch,let decoder=self.decoder else{return}
            let index=(self.frameIndex+1)%decoder.count
            self.decodeQueue.async{[weak self] in
                let frame=decoder.frame(index)
                DispatchQueue.main.async{[weak self] in
                    self?.publishDecodedMedia{[weak self] in
                    guard let self,!self.disposed,!self.backgrounded,self.mediaEpoch==epoch,let frame else{return}
                    self.frameIndex=index;self.fallback.image=UIImage(cgImage:frame.0);self.fallbackFramesPresented+=1
                    self.scheduleFallbackFrame(after:frame.1)
                    }
                }
            }
        }}
        fallbackFrameWork=work;DispatchQueue.main.asyncAfter(deadline:.now()+delay,execute:work)
    }
    private func beginTimeline(){
        guard !timelineStarted,!disposed else{return}
        guard !backgrounded else{pendingTimelineStart=true;return}
        pendingTimelineStart=false;timelineStarted=true
        onCharacterCue?(character.key);guard !disposed else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        for target in [logoUnit,characterView]{target.layer.transform=CATransform3DMakeScale(0,0,1);target.layer.opacity=0}
        CATransaction.commit()
        let sheenOpacity=CAKeyframeAnimation(keyPath:"opacity"),maskPosition=CAKeyframeAnimation(keyPath:"position.x")
        let times:[NSNumber]=[0,0.04,0.10,0.31,0.37,1]
        sheenOpacity.values=[0,0,0.24,0.24,0,0];sheenOpacity.keyTimes=times;sheenOpacity.duration=6;sheenOpacity.beginTime=CACurrentMediaTime()+0.2
        maskPosition.values=[145.0,145,-145,-145].map{Double(logo.bounds.width)*1.3-Double(logo.bounds.width)*1.6*$0/100}
        maskPosition.keyTimes=[0,0.04,0.37,1];maskPosition.duration=6;maskPosition.beginTime=sheenOpacity.beginTime
        sheenOpacity.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:5)
        maskPosition.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:3)
        sheen.layer.add(sheenOpacity,forKey:"native-studio-sheen");sheenMask.add(maskPosition,forKey:"native-studio-sheen")
        for (target,isCharacter) in [(logoUnit,false),(characterView,true)] {
            let scale=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
            let samples=1040
            scale.values=(0...samples).map{index in
                let value=Self.scale(at:Self.duration*Double(index)/Double(samples),character:isCharacter,rest:isCharacter ? Double(character.scale):1)
                return NSValue(caTransform3D:CATransform3DMakeScale(value,value,1))
            }
            opacity.values=(0...samples).map{index -> NSNumber in
                let seconds=Self.duration*Double(index)/Double(samples),begin=isCharacter ? 0.15:0,enter=isCharacter ? 0.55:0.45
                return NSNumber(value:min(1,max(0,(seconds-begin)/enter)))
            }
            scale.duration=Self.duration;opacity.duration=Self.duration
            let group=CAAnimationGroup();group.animations=[scale,opacity];group.duration=Self.duration
            if !isCharacter{group.delegate=self}
            target.layer.add(group,forKey:"native-studio-intro")
        }
    }
    func animationDidStop(_ anim:CAAnimation,finished:Bool){guard finished,timelineStarted,!disposed else{return};let done=completion;completion=nil;dispose();done?()}
    private func setBackgrounded(_ value:Bool){
        guard !disposed,backgrounded != value else{return};backgrounded=value
        if timelineStarted {for target in [logoUnit,characterView]{let layer=target.layer
            if value {let time=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0;layer.timeOffset=time}
            else {let paused=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-paused}
        }}
        if value{
            mediaEpoch &+= 1;retirePlaybackObservation()
            player?.pause();fallbackFrameWork?.cancel();fallbackFrameWork=nil;readinessDeadline?.cancel();readinessDeadline=nil;videoProgressWork?.cancel();videoProgressWork=nil
            if selectedMotionSource=="fallback-loading"{selectedMotionSource="pending"}
        }else if started{
            if pendingTimelineStart{beginTimeline()}
            if let reason=pendingFallbackReason,decoder==nil{beginAnimatedFallback(reason:reason)}
            else if player?.currentItem?.status == .failed,decoder==nil{beginAnimatedFallback(reason:"video-failed-after-resume")}
            if selectedMotionSource=="hevc-alpha"{installPlaybackObservation();player?.play();beginVideoProgressChecks()}
            else if decoder != nil{scheduleFallbackFrame(after:1.0/30)}
            else if selectedMotionSource=="pending"{installPlaybackObservation();player?.play();if playerLayer.isReadyForDisplay{receiveVideoReadiness(true)}else{armReadinessDeadline()}}
        }
    }
    func dispose(){guard !disposed else{return};disposed=true;completion=nil;onCharacterCue=nil
        isHidden=true;mediaEpoch &+= 1;pendingFallbackReason=nil;readinessDeadline?.cancel();readinessDeadline=nil;fallbackFrameWork?.cancel();fallbackFrameWork=nil;videoProgressWork?.cancel();videoProgressWork=nil;decoder=nil
        CATransaction.begin();CATransaction.setDisableActions(true)
        for target in [logoUnit,characterView]{target.layer.opacity=0;target.layer.transform=CATransform3DMakeScale(0,0,1)}
        sheen.layer.opacity=0;CATransaction.commit()
        for target in [logoUnit,characterView]{target.layer.removeAllAnimations()}
        sheen.layer.removeAllAnimations();sheenMask.removeAllAnimations()
        retirePlaybackObservation()
        readiness?.invalidate();readiness=nil;itemStatus?.invalidate();itemStatus=nil;currentItemObservation?.invalidate();currentItemObservation=nil;player?.pause();looper?.disableLooping();looper=nil;player?.removeAllItems();playerLayer.player=nil;player=nil
        observers.forEach(NotificationCenter.default.removeObserver);observers.removeAll();removeFromSuperview()
    }
}
