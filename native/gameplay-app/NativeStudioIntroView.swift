import UIKit
import ImageIO
import CoreImage

/// Cancellation is checked between frames, so retired preparation never finishes
/// decoding a whole loop or publishes into a successor intro.
nonisolated private final class NativeStudioPreparationToken:@unchecked Sendable {
    private let lock=NSLock()
    private var cancelled=false
    func cancel(){lock.lock();cancelled=true;lock.unlock()}
    var isCancelled:Bool{lock.lock();defer{lock.unlock()};return cancelled}
}

/// Releases notification tokens even if an unstarted intro is dropped.
nonisolated private final class NativeStudioNotificationOwners:@unchecked Sendable {
    var tokens:[NSObjectProtocol]=[]
    func removeAll(){tokens.forEach(NotificationCenter.default.removeObserver);tokens.removeAll()}
    deinit{removeAll()}
}

/// Immutable, already materialized pixels. Core Animation owns presentation;
/// ImageIO and the serial worker are never used during visible playback.
nonisolated private struct NativeStudioPreparedLoop:@unchecked Sendable {
    let frames:[CGImage],durations:[Double],decodedBytes:Int,sourceAspect:Double
    var duration:Double{durations.reduce(0,+)}
    var keyTimes:[NSNumber]{
        var elapsed=0.0
        return durations.map{delay in defer{elapsed+=delay};return NSNumber(value:elapsed/duration)}+[1]
    }
}

nonisolated private enum NativeStudioAnimatedDecoder {
    static let queue=DispatchQueue(label:"com.taptapdesign.stacktosix.native-intro-proxy",qos:.userInitiated)
    static let memoryBudgetBytes=80*1024*1024
    static func prepare(url:URL,token:NativeStudioPreparationToken)->NativeStudioPreparedLoop?{
        guard !token.isCancelled,let data=try? Data(contentsOf:url),
              let independent=independentFrames(data,token:token) else{return nil}
        let count=independent.payloads.count
        let rawPixels=Double(independent.width)*Double(independent.height)*Double(count)
        let maxDimension=Double(max(independent.width,independent.height))
        let sourceAspect=Double(independent.height)/Double(independent.width)
        let durations=independent.durations
        // Runtime surface sizing only; the preserved WebP bytes are untouched.
        // Long loops use a smaller display surface to keep all frames resident.
        // 80 MiB leaves 16 MiB of target headroom for one transient frame; actual
        // ImageIO/compositor internal memory and Retina quality need device QA.
        let scale=min(1,sqrt(Double(memoryBudgetBytes)/(rawPixels*4)))
        let thumbnailDimension=max(1,Int(floor(maxDimension*scale)))
        var frames:[CGImage]=[],decodedBytes=0
        for index in 0..<count{
            guard !token.isCancelled else{return nil}
            let frame:CGImage?=autoreleasepool{
                let options:[CFString:Any]=[kCGImageSourceCreateThumbnailFromImageAlways:true,
                    kCGImageSourceThumbnailMaxPixelSize:thumbnailDimension,
                    kCGImageSourceShouldCache:false,kCGImageSourceShouldCacheImmediately:true]
                guard let source=CGImageSourceCreateWithData(independent.payloads[index] as CFData,[kCGImageSourceShouldCache:false] as CFDictionary),
                      let image=CGImageSourceCreateThumbnailAtIndex(source,0,options as CFDictionary),
                      let context=CGContext(data:nil,width:image.width,height:image.height,bitsPerComponent:8,
                        bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else{return nil}
                context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
                return context.makeImage()
            }
            guard !token.isCancelled,let frame else{return nil}
            let bytes=frame.bytesPerRow*frame.height
            guard bytes<=memoryBudgetBytes-decodedBytes else{return nil}
            frames.append(frame);decodedBytes+=bytes
        }
        return NativeStudioPreparedLoop(frames:frames,durations:durations,decodedBytes:decodedBytes,sourceAspect:sourceAspect)
    }
    /// These authored proxies contain independent full-canvas ANMF frames.
    /// Wrapping each payload as a still WebP avoids ImageIO replaying every
    /// preceding animation frame for each indexed decode (quadratic startup).
    /// Partial/blended frames are rejected rather than rendered incorrectly.
    private static func independentFrames(_ data:Data,token:NativeStudioPreparationToken)->(payloads:[Data],durations:[Double],width:Int,height:Int)?{
        let bytes=[UInt8](data)
        func tag(_ offset:Int,_ value:String)->Bool{
            offset>=0 && offset+4<=bytes.count && Array(bytes[offset..<offset+4])==Array(value.utf8)
        }
        func number(_ offset:Int,_ count:Int)->Int{
            (0..<count).reduce(0){$0 | Int(bytes[offset+$1]) << ($1*8)}
        }
        func appendNumber(_ value:Int,_ count:Int,to output:inout Data){
            for shift in 0..<count{output.append(UInt8((value >> (shift*8)) & 255))}
        }
        guard bytes.count>=12,tag(0,"RIFF"),tag(8,"WEBP"),number(4,4)==bytes.count-8 else{return nil}
        var offset=12,width=0,height=0,alpha:UInt8=0,payloads:[Data]=[],durations:[Double]=[]
        while offset+8<=bytes.count{
            guard !token.isCancelled else{return nil}
            let size=number(offset+4,4),body=offset+8
            guard size<=bytes.count-body else{return nil}
            if tag(offset,"VP8X"){
                guard size==10 else{return nil}
                width=number(body+4,3)+1;height=number(body+7,3)+1;alpha=bytes[body] & 0x10
            }else if tag(offset,"ANMF"){
                guard size>=24,width>0,height>0,number(body,3)==0,number(body+3,3)==0,
                      number(body+6,3)+1==width,number(body+9,3)+1==height,
                      bytes[body+15] & 2 != 0 else{return nil}
                let payloadStart=body+16,payloadSize=size-16
                // Only codec/alpha chunks belong in an independent still frame.
                var chunk=payloadStart,hasImage=false
                while chunk+8<=body+size{
                    let length=number(chunk+4,4)
                    guard length<=body+size-chunk-8,
                          tag(chunk,"ALPH") || tag(chunk,"VP8 ") || tag(chunk,"VP8L") else{return nil}
                    if tag(chunk,"VP8 ") || tag(chunk,"VP8L"){hasImage=true}
                    chunk+=8+length+(length & 1)
                }
                guard hasImage,chunk==body+size else{return nil}
                var frame=Data("RIFF".utf8)
                appendNumber(4+18+payloadSize,4,to:&frame);frame.append(Data("WEBPVP8X".utf8))
                appendNumber(10,4,to:&frame);frame.append(contentsOf:[alpha,0,0,0])
                appendNumber(width-1,3,to:&frame);appendNumber(height-1,3,to:&frame)
                frame.append(data.subdata(in:payloadStart..<body+size));payloads.append(frame)
                durations.append(max(0.01,Double(number(body+12,3))/1000))
            }
            offset=body+size+(size & 1)
        }
        guard offset==bytes.count,payloads.count>1 else{return nil}
        return(payloads,durations,width,height)
    }

}

/// Native owner of the preserved v9 studio composition. One finite CA timeline;
/// the selected original animated WebP paints the image directly. No web surface.
@MainActor
final class NativeStudioIntroView:UIView,CAAnimationDelegate {
    struct Character {
        let key:String,scale:CGFloat,x:CGFloat,y:CGFloat,topPivot:Bool
        init(_ key:String,_ scale:CGFloat,_ x:CGFloat=0,_ y:CGFloat=0,_ top:Bool=false){self.key=key;self.scale=scale;self.x=x;self.y=y;topPivot=top}
    }
    static let characters:[Character]=[
        .init("lik-kauc",1.1475,0,40),.init("lik-gitara",1.1,0,16),.init("lik-slikanje",1.08,20,10),
        .init("lik-cvijet",1.08,0,8),.init("lik-board",1.04,0,16),.init("lik-game",1.08),
        .init("lik-laptop",1.452,0,8),.init("lik-pas-SVG",1.12,0,0,true),.init("lik-speceraj",1.21,0,20),
        .init("pas-novine",1.1,0,16)]
    static let duration=4.33
    let character:Character
    private let artwork:JimiV9Artwork,logoUnit=UIView(),logo=UIImageView(),sheen=UIImageView(),label=UILabel(),characterView=UIView(),fallback=UIImageView()
    private let sheenMask=CALayer(),sheenRows=[CALayer(),CALayer()],sheenBands=[CAGradientLayer(),CAGradientLayer()]
    private let resourceRoot:URL
    private let decodedPublicationGate:((@escaping ()->Void)->Void)?
    private var preparedLoop:NativeStudioPreparedLoop?,preparationToken:NativeStudioPreparationToken?,mediaEpoch:UInt64=0
    private let notificationOwners=NativeStudioNotificationOwners()
    private var completion:(()->Void)?,started=false,disposed=false,backgrounded=false
    private(set) var timelineStarted=false,selectedMotionSource="pending"
    static let preparedMemoryBudgetBytes=NativeStudioAnimatedDecoder.memoryBudgetBytes
    static let frameAnimationKey="native-studio-character-frames"
    var preparedFrameCount:Int{preparedLoop?.frames.count ?? 0}
    var preparedFrameDurations:[Double]{preparedLoop?.durations ?? []}
    var preparedDecodedBytes:Int{preparedLoop?.decodedBytes ?? 0}
    private(set) var preparationDuration:Double=0
    var preparedFramePixelSize:CGSize{preparedLoop?.frames.first.map{CGSize(width:$0.width,height:$0.height)} ?? .zero}
    var animatedCharacterLayer:CALayer{fallback.layer}
    var displayedFallbackImage:UIImage?{
        guard !disposed else{return nil}
        if let contents=fallback.layer.presentation()?.contents,CFGetTypeID(contents as CFTypeRef)==CGImage.typeID{
            return UIImage(cgImage:contents as! CGImage)
        }
        return fallback.image
    }
    var isRetired:Bool{disposed}
    var terminalCompositionHidden:Bool{isHidden && logoUnit.layer.opacity==0 && characterView.layer.opacity==0}
    var onCharacterCue:((String)->Void)?
    init(root:URL,character:Character?=nil,decodedPublicationGate:((@escaping ()->Void)->Void)?=nil) {
        resourceRoot=root;self.decodedPublicationGate=decodedPublicationGate
        artwork=JimiV9Artwork(resourceRoot:root)
        self.character=character ?? Self.characters.randomElement()!
        super.init(frame:.zero);isUserInteractionEnabled=true;accessibilityIdentifier="native.studio-intro"
        addSubview(logoUnit);logoUnit.addSubview(logo);logoUnit.addSubview(sheen);logoUnit.addSubview(label);addSubview(characterView);characterView.addSubview(fallback)
        logoUnit.layer.opacity=0;characterView.layer.opacity=0
        logo.image=artwork.image("assets/logo addons/taplogo.png");logo.contentMode = .scaleAspectFit
        sheen.contentMode = .scaleAspectFit;sheen.isUserInteractionEnabled=false;sheen.layer.opacity=0
        if let image=logo.image,let cg=image.cgImage {
            let input=CIImage(cgImage:cg).applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.06])
                .applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.65,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.65,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.65,w:0)])
            if let bright=CIContext().createCGImage(input,from:input.extent){sheen.image=UIImage(cgImage:bright,scale:image.scale,orientation:image.imageOrientation)}
        }
        // One original bright logo, two isolated rows. Soft specular shoulders
        // retain the wood grain; the narrow core supplies the moving glint.
        for (row,band) in zip(sheenRows,sheenBands) {
            row.masksToBounds=true;sheenMask.addSublayer(row);row.addSublayer(band)
            band.colors=[0.0,0.06,0.35,1,0.35,0.06,0].map{UIColor(white:1,alpha:$0).cgColor}
            band.locations=[0,0.18,0.38,0.5,0.62,0.82,1]
            band.startPoint=CGPoint(x:0,y:0.2);band.endPoint=CGPoint(x:1,y:0.8)
            band.opacity=0
        }
        sheen.layer.mask=sheenMask
        label.attributedText=NSAttributedString(string:"PRESENTS",attributes:[.font:artwork.font(size:15),.kern:0.9,.foregroundColor:UIColor(red:184.0/255,green:121.0/255,blue:96.0/255,alpha:1)])
        label.textAlignment = .center
        let png=self.character.key == "lik-slikanje" ? "lik slikanje":self.character.key == "pas-novine" ? "pas novine":self.character.key == "lik-pas-SVG" ? "lik-pas":self.character.key
        fallback.image=artwork.image("assets/logo addons/\(png).png");fallback.contentMode = .scaleAspectFit
        if self.character.topPivot {characterView.layer.anchorPoint=CGPoint(x:0.5,y:0)}
        for name in [UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification] {
            notificationOwners.tokens.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main){[weak self] note in
                MainActor.assumeIsolated{self?.setBackgrounded(note.name==UIApplication.willResignActiveNotification)}
            })
        }
    }
    deinit{preparationToken?.cancel()}
    required init?(coder:NSCoder){fatalError("Native original-art initializer")}
    override func layoutSubviews(){
        super.layoutSubviews()
        let width=min(bounds.width*0.806,315),charWidth=min(bounds.width*0.74,289)
        let logoAspect=logo.image.map{$0.size.height/max(1,$0.size.width)} ?? 0.5
        let imageHeight=width*logoAspect,logoHeight=imageHeight+29
        let aspect=preparedLoop.map{CGFloat($0.sourceAspect)} ?? fallback.image.map{$0.size.height/max(1,$0.size.width)} ?? 1
        let charHeight=min(bounds.height*0.54,charWidth*aspect),total=logoHeight+20+charHeight
        let top=(bounds.height-total)/2
        logoUnit.bounds=CGRect(x:0,y:0,width:width,height:logoHeight);logoUnit.center=CGPoint(x:bounds.midX,y:top+logoHeight/2)
        logo.frame=CGRect(x:0,y:0,width:width,height:imageHeight);sheen.frame=logo.frame;label.frame=CGRect(x:0,y:imageHeight+14,width:width,height:15)
        CATransaction.begin();CATransaction.setDisableActions(true)
        sheenMask.frame=sheen.bounds
        // Split in the original artwork's gap, between TAP TAP and DESIGN.
        let split=imageHeight*0.49
        sheenRows[0].frame=CGRect(x:0,y:0,width:width,height:split)
        sheenRows[1].frame=CGRect(x:0,y:split,width:width,height:imageHeight-split)
        for (row,band) in zip(sheenRows,sheenBands) {
            band.bounds=CGRect(x:0,y:0,width:width*0.48,height:row.bounds.height)
            band.position=CGPoint(x:-width*0.26,y:row.bounds.midY)
        }
        CATransaction.commit()
        characterView.bounds=CGRect(x:0,y:0,width:charWidth,height:charHeight)
        characterView.layer.position=CGPoint(x:bounds.midX+character.x,y:top+logoHeight+20+charHeight*characterView.layer.anchorPoint.y+character.y)
        fallback.frame=characterView.bounds
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
        prepareAnimatedCharacter()
    }
    private func prepareAnimatedCharacter(){
        guard started,!disposed,!backgrounded,preparedLoop==nil,selectedMotionSource != "fallback-loading" else{return}
        mediaEpoch &+= 1;let epoch=mediaEpoch,token=NativeStudioPreparationToken()
        preparationToken=token;selectedMotionSource="fallback-loading"
        let url=resourceRoot.appendingPathComponent("assets/logo addons/optimized/\(character.key)-mobile.webp")
        NativeStudioAnimatedDecoder.queue.async{[weak self] in
            let began=ProcessInfo.processInfo.systemUptime
            let loop=NativeStudioAnimatedDecoder.prepare(url:url,token:token)
            let elapsed=ProcessInfo.processInfo.systemUptime-began
            guard !token.isCancelled else{return}
            DispatchQueue.main.async{[weak self] in
                self?.publishDecodedMedia{[weak self] in
                    guard let self,!self.disposed,!self.backgrounded,self.mediaEpoch==epoch,!token.isCancelled else{return}
                    self.preparationToken=nil;self.preparationDuration=elapsed
                    guard let loop,let first=loop.frames.first else{
                        self.selectedMotionSource="static-fallback-unavailable"
                        NSLog("[NativeStudioIntro] character=%@ motion=static reason=%@",self.character.key,"webp-preparation-unavailable")
                        self.beginTimeline();return
                    }
                    self.preparedLoop=loop;self.selectedMotionSource="animated-webp-predecoded"
                    self.fallback.image=UIImage(cgImage:first)
                    NSLog("[NativeStudioIntro] character=%@ motion=predecoded frames=%d pixels=%dx%d bytes=%d period=%.3f preparation=%.3f",self.character.key,loop.frames.count,first.width,first.height,loop.decodedBytes,loop.duration,elapsed)
                    self.beginTimeline()
                }
            }
        }
    }
    /// Optional test hold exercises the sole real background preparation reply.
    private func publishDecodedMedia(_ publication:@escaping ()->Void){
        if let decodedPublicationGate{decodedPublicationGate(publication)}else{publication()}
    }
    private func beginTimeline(){
        guard !timelineStarted,!disposed else{return}
        guard !backgrounded else{return}
        timelineStarted=true
        if let loop=preparedLoop,let first=loop.frames.first{
            let frames=CAKeyframeAnimation(keyPath:"contents")
            // Each authored image owns its cumulative hold interval; the first
            // image at 1 closes the loop without shortening the last hold.
            frames.values=loop.frames+[first]
            frames.keyTimes=loop.keyTimes;frames.calculationMode = .discrete
            frames.duration=loop.duration;frames.repeatCount = .infinity
            frames.isRemovedOnCompletion=true
            CATransaction.begin();CATransaction.setDisableActions(true)
            fallback.layer.contents=first;fallback.layer.contentsGravity = .resizeAspect
            fallback.layer.add(frames,forKey:Self.frameAnimationKey)
            CATransaction.commit()
        }
        onCharacterCue?(character.key);guard !disposed else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        for target in [logoUnit,characterView]{target.layer.transform=CATransform3DMakeScale(0,0,1);target.layer.opacity=0}
        CATransaction.commit()
        CATransaction.begin();CATransaction.setDisableActions(true)
        sheen.layer.opacity=0.72
        CATransaction.commit()
        for (index,band) in sheenBands.enumerated() {
            let sweep=CABasicAnimation(keyPath:"position.x")
            sweep.fromValue = -logo.bounds.width*0.26;sweep.toValue=logo.bounds.width*1.26;sweep.duration=1.05
            sweep.timingFunction=CAMediaTimingFunction(name:.easeInEaseOut)
            let glow=CAKeyframeAnimation(keyPath:"opacity")
            glow.values=[0,1,1,0];glow.keyTimes=[0,0.12,0.86,1];glow.duration=1.05
            let pass=CAAnimationGroup();pass.animations=[sweep,glow];pass.duration=1.05
            pass.beginTime=band.convertTime(CACurrentMediaTime(),from:nil)+0.65+Double(index)*1.15
            pass.fillMode = .both;pass.isRemovedOnCompletion=false
            band.add(pass,forKey:"native-studio-sheen")
        }
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
        if value, !timelineStarted{
            mediaEpoch &+= 1;preparationToken?.cancel();preparationToken=nil
            if selectedMotionSource=="fallback-loading"{selectedMotionSource="pending"}
        }else if !value,started,selectedMotionSource=="pending"{prepareAnimatedCharacter()}
    }
    func dispose(){guard !disposed else{return};disposed=true;completion=nil;onCharacterCue=nil
        isHidden=true;mediaEpoch &+= 1;preparationToken?.cancel();preparationToken=nil
        fallback.layer.removeAllAnimations();fallback.image=nil;fallback.layer.contents=nil;preparedLoop=nil
        CATransaction.begin();CATransaction.setDisableActions(true)
        for target in [logoUnit,characterView]{target.layer.opacity=0;target.layer.transform=CATransform3DMakeScale(0,0,1)}
        sheen.layer.opacity=0;CATransaction.commit()
        for target in [logoUnit,characterView]{target.layer.removeAllAnimations()}
        sheen.layer.removeAllAnimations();sheenMask.removeAllAnimations();sheenBands.forEach{$0.removeAllAnimations()}
        notificationOwners.removeAll();removeFromSuperview()
    }
}
