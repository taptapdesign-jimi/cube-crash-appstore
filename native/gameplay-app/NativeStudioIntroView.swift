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

/// Bounded adapter for this original SVG only. Three embedded WebP images and
/// twenty-one finite CA tracks reuse the intro's preparation and parent clocks.
nonisolated private enum NativeStudioDropSource {
    final class Node:@unchecked Sendable {
        let tag:String,attributes:[String:String]
        var children:[Node]=[],image:CGImage?
        init(_ tag:String,_ attributes:[String:String]){self.tag=tag;self.attributes=attributes}
    }
    private final class Parser:NSObject,XMLParserDelegate {
        var root:Node?,stack:[Node]=[]
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            let node=Node(name,attributes);if let parent=stack.last {parent.children.append(node)}else{root=node};stack.append(node)
        }
        func parser(_ parser:XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?){stack.removeLast()}
    }
    static func read(_ url:URL,token:NativeStudioPreparationToken)->Node? {
        guard !token.isCancelled,let data=try? Data(contentsOf:url),data.count<1_000_000 else{return nil}
        let p=Parser(),xml=XMLParser(data:data);xml.delegate=p;xml.shouldResolveExternalEntities=false
        guard xml.parse(),let root=p.root,root.attributes["viewBox"]=="0 0 800 760" else{return nil}
        var count=0,bytes=0
        func decode(_ node:Node)->Bool {
            guard !token.isCancelled else{return false}
            if node.tag=="image" {
                guard let href=node.attributes["href"],let encoded=href.split(separator:",",maxSplits:1).last,
                      let data=Data(base64Encoded:String(encoded)),let source=CGImageSourceCreateWithData(data as CFData,nil),
                      let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),
                      let context=CGContext(data:nil,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
                context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height));node.image=context.makeImage()
                count+=1;bytes+=image.width*image.height*4
                guard count<=3,bytes<2_000_000 else{return false}
            }
            return node.children.allSatisfy(decode)
        }
        return decode(root) && count==3 ? root:nil
    }
    static func numbers(_ text:String)->[Double] {
        text.split(whereSeparator:{!"0123456789.eE-+".contains($0)}).compactMap{Double($0)}
    }
    static func path(_ text:String)->CGPath {
        let v=numbers(text),path=CGMutablePath()
        guard v.count==8 else{return path}
        path.move(to:CGPoint(x:v[0],y:v[1]));path.addCurve(to:CGPoint(x:v[6],y:v[7]),control1:CGPoint(x:v[2],y:v[3]),control2:CGPoint(x:v[4],y:v[5]));return path
    }
    static func transform(_ values:[Double],type:String)->CATransform3D {
        guard let first=values.first else{return CATransform3DIdentity}
        if type=="translate" {return CATransform3DMakeTranslation(first,values.count>1 ? values[1]:0,0)}
        let x=values.count>1 ? values[1]:0,y=values.count>2 ? values[2]:0
        return CATransform3DTranslate(CATransform3DRotate(CATransform3DMakeTranslation(x,y,0),first * .pi/180,0,0,1),-x,-y,0)
    }
}

@MainActor private final class NativeStudioDropLogo:UIView {
    private let canvas=CALayer()
    private struct CaptionTrack {let values:[[Double]],times:[Double],splines:[[Double]]}
    private var captionTracks:[String:CaptionTrack]=[:]
    private var tracks:[(CALayer,CAKeyframeAnimation)]=[]
    private var shimmerBands:[CAGradientLayer]=[]
    init(source:NativeStudioDropSource.Node) {
        super.init(frame:.zero);isUserInteractionEnabled=false;accessibilityIdentifier="native.studio-intro.drop-logo"
        layer.addSublayer(canvas);build(source,in:canvas)
    }
    required init?(coder:NSCoder){fatalError("Original SVG initializer")}
    override func layoutSubviews(){super.layoutSubviews();canvas.anchorPoint = .zero;canvas.position = .zero;canvas.bounds=CGRect(x:0,y:0,width:800,height:760);canvas.transform=CATransform3DMakeScale(bounds.width/800,bounds.height/760,1)}
    private func build(_ node:NativeStudioDropSource.Node,in parent:CALayer) {
        let a=node.attributes
        if let id=a["id"],["dropTranslate","microJitter","swingRotate"].contains(id),let motion=node.children.first(where:{$0.tag=="animateTransform"}) {
            let a=motion.attributes
            captionTracks[id]=CaptionTrack(values:(a["values"] ?? "").split(separator:";").map{NativeStudioDropSource.numbers(String($0))},times:NativeStudioDropSource.numbers(a["keyTimes"] ?? ""),splines:(a["keySplines"] ?? "").split(separator:";").map{NativeStudioDropSource.numbers(String($0))})
        }
        if ["defs","title","desc"].contains(node.tag){return}
        if node.tag=="animate" || node.tag=="animateTransform" {
            let key=a["attributeName"]=="d" ? "path":"transform"
            let animation=CAKeyframeAnimation(keyPath:key)
            let values=(a["values"] ?? "").split(separator:";").map(String.init)
            animation.values=values.map{key=="path" ? NativeStudioDropSource.path($0) as Any:NSValue(caTransform3D:NativeStudioDropSource.transform(NativeStudioDropSource.numbers($0),type:a["type"] ?? ""))}
            animation.keyTimes=NativeStudioDropSource.numbers(a["keyTimes"] ?? "").map{NSNumber(value:$0)}
            animation.timingFunctions=(a["keySplines"] ?? "").split(separator:";").compactMap{let n=NativeStudioDropSource.numbers(String($0));return n.count==4 ? CAMediaTimingFunction(controlPoints:Float(n[0]),Float(n[1]),Float(n[2]),Float(n[3])):nil}
            animation.duration=4;animation.fillMode = .both;animation.isRemovedOnCompletion=false
            Self.extendHold(animation);tracks.append((parent,animation));return
        }
        let child:CALayer
        var animatedShape:CAShapeLayer?
        if node.tag=="path" {
            let shape=CAShapeLayer();shape.path=NativeStudioDropSource.path(a["d"] ?? "");shape.fillColor=nil
            let stroke=a["stroke"] ?? "#fffaf3"
            let hex=stroke.hasPrefix("#") ? String(stroke.dropFirst()):stroke.contains("Main") ? "efd0b3":"fffaf3"
            let value=UInt32(hex,radix:16) ?? 0xfffaf3
            shape.strokeColor=UIColor(red:CGFloat((value>>16)&255)/255,green:CGFloat((value>>8)&255)/255,blue:CGFloat(value&255)/255,alpha:1).cgColor
            shape.lineWidth=Double(a["stroke-width"] ?? "1") ?? 1;shape.lineCap = .round
            shape.lineDashPattern=a["stroke-dasharray"].map{NativeStudioDropSource.numbers($0).map{NSNumber(value:$0)}}
            shape.lineDashPhase=Double(a["stroke-dashoffset"] ?? "0") ?? 0
            if stroke.hasPrefix("url") {
                let gradient=CAGradientLayer();gradient.frame=CGRect(x:0,y:-800,width:800,height:1600)
                let colors=stroke.contains("Main") ? ["c1916b","f7dfc9","fffdf9","efd0b3","d0a27c"]:["f6efe6","ffffff","f4e1cf"]
                gradient.colors=colors.map { hex in
                    let v=UInt32(hex,radix:16)!
                    return UIColor(red:CGFloat((v>>16)&255)/255,green:CGFloat((v>>8)&255)/255,blue:CGFloat(v&255)/255,alpha:1).cgColor
                }
                gradient.locations=stroke.contains("Main") ? [0,0.22,0.46,0.7,1]:[0,0.5,1]
                shape.strokeColor=UIColor.white.cgColor;shape.bounds=CGRect(x:0,y:0,width:800,height:760);shape.anchorPoint = .zero;shape.position=CGPoint(x:0,y:800)
                gradient.mask=shape
                let paths=node.children.filter{$0.tag=="animate"}.flatMap{($0.attributes["values"] ?? "").split(separator:";").map{NativeStudioDropSource.path(String($0)).boundingBoxOfPath}}
                if let animation=node.children.first(where:{$0.tag=="animate"}),!paths.isEmpty {
                    for end in [false,true] {
                        let track=CAKeyframeAnimation(keyPath:end ? "endPoint":"startPoint")
                        track.values=paths.map{NSValue(cgPoint:CGPoint(x:(end ? $0.maxX:$0.minX)/800,y:0.5))}
                        track.keyTimes=NativeStudioDropSource.numbers(animation.attributes["keyTimes"] ?? "").map{NSNumber(value:$0)}
                        track.timingFunctions=(animation.attributes["keySplines"] ?? "").split(separator:";").compactMap{let n=NativeStudioDropSource.numbers(String($0));return n.count==4 ? CAMediaTimingFunction(controlPoints:Float(n[0]),Float(n[1]),Float(n[2]),Float(n[3])):nil}
                        track.duration=4;track.fillMode = .both;track.isRemovedOnCompletion=false;Self.extendHold(track);tracks.append((gradient,track))
                    }
                }
                let holder=CALayer();holder.addSublayer(gradient);child=holder;animatedShape=shape
            } else {child=shape}
        } else {child=CALayer()}
        child.anchorPoint = .zero;child.bounds=CGRect(x:0,y:0,width:800,height:760);child.position = .zero
        if let image=node.image {
            child.contents=image;child.contentsGravity = .resize
            child.frame=CGRect(x:Double(a["x"] ?? "0") ?? 0,y:Double(a["y"] ?? "0") ?? 0,width:Double(a["width"] ?? "0") ?? 0,height:Double(a["height"] ?? "0") ?? 0)
            if a["filter"] != nil {
                child.shadowColor=UIColor(red:0.50,green:0.28,blue:0.15,alpha:1).cgColor;child.shadowOpacity=0.16;child.shadowRadius=5;child.shadowOffset=CGSize(width:0,height:6)
                let shine=CALayer();shine.frame=child.bounds
                let mask=CALayer();mask.frame=shine.bounds;mask.contents=image;shine.mask=mask
                let band=CAGradientLayer();band.bounds=CGRect(x:0,y:0,width:child.bounds.width*0.48,height:child.bounds.height)
                band.position=CGPoint(x:-child.bounds.width*0.26,y:child.bounds.midY)
                band.colors=[0.0,0.06,0.35,1,0.35,0.06,0].map{UIColor(white:1,alpha:$0*0.288).cgColor}
                band.locations=[0,0.18,0.38,0.5,0.62,0.82,1];band.startPoint=CGPoint(x:0,y:0.2);band.endPoint=CGPoint(x:1,y:0.8);band.opacity=0
                shine.addSublayer(band);child.addSublayer(shine);shimmerBands.append(band)
            }
        }
        child.opacity=Float(a["opacity"] ?? "1") ?? 1
        if let t=a["transform"] {child.transform=NativeStudioDropSource.transform(NativeStudioDropSource.numbers(t),type:t.hasPrefix("translate") ? "translate":"rotate")}
        parent.addSublayer(child);node.children.forEach{build($0,in:animatedShape ?? child)}
    }
    // Fit the source logo and100ms hold to the original4.33s intro.
    // Character and letter-by-letter PRESENTS retire first; plaque follows180ms later.
    private static func extendHold(_ animation:CAKeyframeAnimation) {
        guard var values=animation.values,let sourceTimes=animation.keyTimes else{return}
        let speed=NativeStudioIntroView.logoMotionSpeed,hold=NativeStudioIntroView.logoExtraHold,duration=NativeStudioIntroView.logoDuration,lead=NativeStudioIntroView.logoSourceLead
        var seconds=sourceTimes.map{$0.doubleValue*4},eases=animation.timingFunctions ?? []
        // Remove the source's fully hidden240ms anticipation, not its drop.
        while let first=seconds.first,first<lead-0.000001 {
            seconds.removeFirst();values.removeFirst();if !eases.isEmpty {eases.removeFirst()}
        }
        guard let i=seconds.firstIndex(where:{abs($0-2.96)<0.000001}) else{return}
        var times=seconds.map{NSNumber(value:(($0-lead)/speed+($0>2.9600001 ? hold:0))/duration)}
        values.insert(values[i],at:i+1);times.insert(NSNumber(value:((2.96-lead)/speed+hold)/duration),at:i+1)
        eases.insert(CAMediaTimingFunction(name:.linear),at:i)
        animation.values=values;animation.keyTimes=times;animation.timingFunctions=eases;animation.duration=duration
    }
    private func sample(_ id:String,at seconds:Double)->[Double] {
        guard let track=captionTracks[id] else{return [0,0]}
        let times=track.times,values=track.values,splines=track.splines
        let hold=NativeStudioIntroView.logoExtraHold*NativeStudioIntroView.logoMotionSpeed
        let authored=seconds+NativeStudioIntroView.logoSourceLead
        let source=authored<=2.96 ? authored:authored<=2.96+hold ? 2.96:min(4,authored-hold)
        let t=source/4
        guard let i=times.indices.dropLast().first(where:{t<times[$0+1]}) else{return values.last ?? [0,0]}
        let n=splines[i],fraction=(t-times[i])/(times[i+1]-times[i])
        let mix=NativeRewardMotion.cubic(fraction,n[0],n[1],n[2],n[3])
        return zip(values[i],values[i+1]).map{$0+($1-$0)*mix}
    }
    func captionAnimation(center:CGPoint,reducedMotion:Bool)->CAKeyframeAnimation? {
        guard !reducedMotion else{return nil}
        let scale=bounds.width/800,point=CGPoint(x:center.x/scale,y:center.y/scale)
        let animation=CAKeyframeAnimation(keyPath:"transform")
        animation.values=(0...1040).map { index in
            let time=max(0,NativeStudioIntroView.duration*Double(index)/1040-NativeStudioIntroView.logoStartDelay)*NativeStudioIntroView.logoMotionSpeed,drop=sample("dropTranslate",at:time),jitter=sample("microJitter",at:time),swing=sample("swingRotate",at:time)
            let angle=swing[0] * .pi/180,x=point.x-swing[1],y=point.y-swing[2]
            let dx=drop[0]+jitter[0]+swing[1]+cos(angle)*x-sin(angle)*y-point.x
            let dy=drop[1]+jitter[1]+swing[2]+sin(angle)*x+cos(angle)*y-point.y
            return NSValue(caTransform3D:CATransform3DRotate(CATransform3DMakeTranslation(dx*scale,dy*scale,0),angle,0,0,1))
        }
        animation.duration=NativeStudioIntroView.duration;animation.fillMode = .both;animation.isRemovedOnCompletion=false
        return animation
    }
    func start(reducedMotion:Bool,epoch:CFTimeInterval) {
        if !reducedMotion {
            for band in shimmerBands {
                let width=band.superlayer!.bounds.width
                let sweep=CABasicAnimation(keyPath:"position.x");sweep.fromValue = -width*0.26;sweep.toValue=width*1.26;sweep.duration=1.05;sweep.timingFunction=CAMediaTimingFunction(name:.easeInEaseOut)
                let glow=CAKeyframeAnimation(keyPath:"opacity");glow.values=[0,1,1,0];glow.keyTimes=[0,0.12,0.86,1];glow.duration=1.05
                let pass=CAAnimationGroup();pass.animations=[sweep,glow];pass.duration=1.05
                let sequence=CAAnimationGroup();let second=pass.copy() as! CAAnimationGroup;pass.beginTime=0.65;second.beginTime=1.80
                sequence.animations=[pass,second];sequence.duration=NativeStudioIntroView.duration;sequence.beginTime=band.convertTime(epoch+NativeStudioIntroView.logoStartDelay,from:nil);sequence.fillMode = .both;sequence.isRemovedOnCompletion=false
                band.add(sequence,forKey:"native-studio-drop-shimmer")
            }
        }
        for (index,track) in tracks.enumerated() {
            if reducedMotion {
                if let value=track.1.values?[8] {track.0.setValue(value,forKeyPath:track.1.keyPath!)}
            } else {
                track.1.beginTime=track.0.convertTime(epoch+NativeStudioIntroView.logoStartDelay,from:nil)
                track.0.add(track.1,forKey:"native-studio-svg-\(index)")
            }
        }
    }
    func dispose(){tracks.forEach{$0.0.removeAllAnimations()};shimmerBands.forEach{$0.removeAllAnimations()};shimmerBands.removeAll();tracks.removeAll();captionTracks.removeAll();canvas.sublayers?.forEach{$0.removeFromSuperlayer()}}
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
        // Keep the established selection/audio identity; only this character's
        // presentation uses the lossless Studio export. Originals stay intact.
        var motionAssetPath:String {
            key == "lik-pas-SVG" ? "assets/logo addons/native/lik-lajna-v1.webp":"assets/logo addons/optimized/\(key)-mobile.webp"
        }
        var stillAssetPath:String {
            if key == "lik-pas-SVG" {return "assets/logo addons/native/lik-lajna-v1.png"}
            let png=key == "lik-slikanje" ? "lik slikanje":key == "pas-novine" ? "pas novine":key
            return "assets/logo addons/\(png).png"
        }
    }
    static let characters:[Character]=[
        .init("lik-kauc",1.1475,0,40),.init("lik-gitara",1.1,0,16),.init("lik-slikanje",1.08,20,10),
        .init("lik-cvijet",1.08,0,8),.init("lik-board",1.04,0,16),.init("lik-game",1.08),
        .init("lik-laptop",1.7424,0,8),.init("lik-pas-SVG",1.2768,0,0,true),.init("lik-speceraj",1.37214,0,20),
        .init("pas-novine",1.43,0,16)]
    static let duration=4.33,logoExtraHold=0.10
    // The plaque travels above the screen before becoming visible; let it
    // clear that travel before admitting the character.
    static let characterEntryStart=0.45,logoStartDelay=0.0,logoSourceLead=0.24
    static let logoMotionSpeed=(4-logoSourceLead)/(duration-logoStartDelay-logoExtraHold-0.05)
    static let logoDuration=(4-logoSourceLead)/logoMotionSpeed+logoExtraHold
    static let logoExitStart=logoStartDelay+(3.56-logoSourceLead)/logoMotionSpeed+logoExtraHold
    static let characterExitTime=logoExitStart-0.65-0.18
    static let logoEntryDuration=JimiV9Motion.homeEnter(.logo).duration
    static let logoIdleKey="native-studio-logo-idle"
    private let reducedMotion:Bool
    let character:Character
    private let artwork:JimiV9Artwork,logoUnit=UIView(),logo=UIImageView(),sheen=UIImageView(),label=UIView(),characterView=UIView(),fallback=UIImageView()
    private lazy var tabletComposition:UIView = {
        let view=UIView();view.accessibilityIdentifier="native.studio-intro.tablet-composition"
        return view
    }()
    private(set) var presentsGlyphs:[UILabel]=[]
    private var presentsGlyphCarriers:[UIView]=[]
    static let presentsEntryDuration=0.44+7*0.02+1.0
    static let presentsEntryStart=logoStartDelay+(0.95-logoSourceLead)/logoMotionSpeed
    static let presentsLetterStagger=0.12
    static func presentsPose(at seconds:Double,index:Int)->NativeArcadeRoundPresentation.Pose {
        let exit=seconds-(characterExitTime-0.10)-Double(index)*0.05
        if exit>=0 {return NativeArcadeRoundPresentation.exit(exit,index:index,rotation:0)}
        let letterDuration=presentsEntryDuration-7*presentsLetterStagger
        let local=(seconds-presentsEntryStart-Double(index)*presentsLetterStagger)*0.44/letterDuration
        return NativeArcadeRoundPresentation.entry(local,overshoot:1.32,dip:0.90)
    }
    private let sheenMask=CALayer(),sheenRows=[CALayer(),CALayer()],sheenBands=[CAGradientLayer(),CAGradientLayer()]
    private let resourceRoot:URL
    private let decodedPublicationGate:((@escaping ()->Void)->Void)?
    private var dropLogo:NativeStudioDropLogo?
    private var preparedLoop:NativeStudioPreparedLoop?,preparationToken:NativeStudioPreparationToken?,mediaEpoch:UInt64=0
    private let notificationOwners=NativeStudioNotificationOwners()
    private var completion:(()->Void)?,started=false,disposed=false,backgrounded=false
    private var leftApplication=false
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
    var onLogoMotionCue:((NativeStudioLogoAudioEvent)->Void)?
    private var logoCueReceipts:[JimiWorldAnimationStart]=[]
    private var logoContactEpoch:UInt64=0
    private var logoCueEvents=Set<NativeStudioLogoAudioEvent>()
    private var landingPoof:CALayer?,exitPoof:CALayer?
    init(root:URL,character:Character?=nil,decodedPublicationGate:((@escaping ()->Void)->Void)?=nil,reducedMotion:Bool?=nil) {
        self.reducedMotion=reducedMotion ?? UIAccessibility.isReduceMotionEnabled
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
        label.accessibilityLabel="PRESENTS";label.isAccessibilityElement=true
        presentsGlyphs="PRESENTS".map {character in
            let glyph=UILabel();glyph.text=String(character);glyph.font=artwork.font(size:18)
            glyph.textColor=UIColor(red:184.0/255,green:121.0/255,blue:96.0/255,alpha:0.8)
            glyph.textAlignment = .center;glyph.layer.isDoubleSided=false;glyph.layer.opacity=0
            let carrier=UIView();carrier.isUserInteractionEnabled=false
            label.addSubview(carrier);carrier.addSubview(glyph);presentsGlyphCarriers.append(carrier);return glyph
        }
        fallback.image=artwork.image(self.character.stillAssetPath);fallback.contentMode = .scaleAspectFit
        if self.character.topPivot {characterView.layer.anchorPoint=CGPoint(x:0.5,y:0)}
        for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification,UIApplication.didBecomeActiveNotification] {
            notificationOwners.tokens.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main){[weak self] note in
                MainActor.assumeIsolated{
                    guard let self else{return}
                    if note.name==UIApplication.didEnterBackgroundNotification {self.leftApplication=true}
                    self.setBackgrounded(note.name != UIApplication.didBecomeActiveNotification)
                }
            })
        }
    }
    deinit{preparationToken?.cancel()}
    required init?(coder:NSCoder){fatalError("Native original-art initializer")}
    override func layoutSubviews(){
        super.layoutSubviews()
        let tablet=NativeTabletLayout.applies(bounds.size)
        let canvas=tablet ? CGRect(x:0,y:0,width:390,height:844):bounds
        if tablet {
            if logoUnit.superview !== tabletComposition {
                addSubview(tabletComposition)
                tabletComposition.addSubview(logoUnit);tabletComposition.addSubview(characterView)
            }
            let available=bounds.inset(by:safeAreaInsets)
            let projection=max(0,min(1.33,max(0,available.width-48)/canvas.width,available.height/canvas.height))
            tabletComposition.bounds=canvas
            tabletComposition.center=CGPoint(x:available.midX,y:available.midY)
            tabletComposition.transform=CGAffineTransform(scaleX:projection,y:projection)
        } else if logoUnit.superview !== self {
            addSubview(logoUnit);addSubview(characterView);tabletComposition.removeFromSuperview()
        }
        // The original phone composition owns all local geometry and motion.
        // Tablet projects it once, including glyphs, offsets and finite floats.
        let width=min(canvas.width*0.806,315),charWidth=min(canvas.width*0.74,289)
        let logoAspect=logo.image.map{$0.size.height/max(1,$0.size.width)} ?? 0.5
        let imageHeight=width*logoAspect,logoHeight=imageHeight+29
        let aspect=preparedLoop.map{CGFloat($0.sourceAspect)} ?? fallback.image.map{$0.size.height/max(1,$0.size.width)} ?? 1
        let charHeight=min(canvas.height*0.54,charWidth*aspect),total=logoHeight+20+charHeight
        let top=(canvas.height-total)/2
        logoUnit.bounds=CGRect(x:0,y:0,width:width,height:logoHeight);logoUnit.center=CGPoint(x:canvas.midX,y:top+logoHeight/2)
        logo.frame=CGRect(x:0,y:0,width:width,height:imageHeight);sheen.frame=logo.frame;label.frame=CGRect(x:0,y:imageHeight+14,width:width,height:15)
        if let dropLogo {
            let dropWidth=canvas.width
            logoUnit.bounds=CGRect(x:0,y:0,width:dropWidth,height:dropWidth*760/800+29)
            logoUnit.center=CGPoint(x:canvas.midX,y:logoUnit.bounds.height/2-44)
            dropLogo.frame=CGRect(x:0,y:0,width:dropWidth,height:dropWidth*760/800)
            label.frame=CGRect(x:(dropWidth-width)/2,y:dropWidth*619/800+14,width:width,height:15)
        }
        let advances=presentsGlyphs.map{($0.text! as NSString).size(withAttributes:[.font:$0.font as Any]).width}
        var glyphX=(width-advances.reduce(0,+)-1.08*CGFloat(max(0,advances.count-1)))/2
        for (index,glyph) in presentsGlyphs.enumerated(){
            glyph.bounds=CGRect(x:0,y:0,width:advances[index],height:18)
            let centerX=glyphX+advances[index]/2,carrier=presentsGlyphCarriers[index]
            // Match the baked lower plaque edge, not just its animated swing.
            // Quadratic fitted to the opaque original560x337 plaque silhouette
            // around the caption: y=318.658+8.091u+0.525u²,u=(sourceX-280)/100.
            let sourceScale=dropLogo.map{$0.bounds.width/800} ?? 1
            let u=(centerX-width/2)/max(0.001,100*sourceScale)
            let rise:CGFloat=dropLogo == nil ? 0:(8.091211*u+0.524981*u*u)*sourceScale
            let angle:CGFloat=dropLogo == nil ? 0:atan((8.091211+1.049962*u)/100)
            carrier.bounds=glyph.bounds;carrier.center=CGPoint(x:centerX,y:7.5+rise)
            carrier.transform=CGAffineTransform(rotationAngle:angle)
            glyph.center=CGPoint(x:carrier.bounds.midX,y:carrier.bounds.midY);glyphX+=advances[index]+1.08
        }
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
        // Resize every tablet character variant without shifting the existing
        // logo composition, authored pivot, entry/exit scale or frame clock.
        let selectedCharacterScale:CGFloat
        switch character.key {
        case "lik-pas-SVG": selectedCharacterScale=tablet ? 1.176:1.10
        case "lik-gitara": selectedCharacterScale=tablet ? 1.15:1.05
        case "lik-kauc": selectedCharacterScale=tablet ? 1.15:1
        case "lik-slikanje": selectedCharacterScale=tablet ? 1.10:1.05
        case "pas-novine": selectedCharacterScale=tablet ? 1.21:0.96
        case "lik-laptop","lik-board","lik-game","lik-cvijet": selectedCharacterScale=tablet ? 1.10:1
        default: selectedCharacterScale=1
        }
        let characterSizeScale:CGFloat=(tablet ? 1.5*0.70:1)*selectedCharacterScale
        characterView.bounds=CGRect(x:0,y:0,width:charWidth*characterSizeScale,height:charHeight*characterSizeScale)
        let characterVerticalFraction:CGFloat
        switch character.key {
        case "lik-speceraj": characterVerticalFraction=tablet ? 0.05:0.02
        case "lik-pas-SVG": characterVerticalFraction=tablet ? -0.06:-0.04
        case "lik-board": characterVerticalFraction=tablet ? 0.07:0
        case "lik-laptop": characterVerticalFraction=tablet ? 0.02:0
        case "pas-novine": characterVerticalFraction=tablet ? 0.04:0
        case "lik-gitara": characterVerticalFraction=tablet ? 0.05:0
        case "lik-kauc": characterVerticalFraction=tablet ? 0.02:0
        case "lik-game","lik-cvijet": characterVerticalFraction=tablet ? 0.05:0
        case "lik-slikanje": characterVerticalFraction=tablet ? 0.05:0.04
        default: characterVerticalFraction=0
        }
        let characterVerticalOffset=character.y+canvas.height*characterVerticalFraction
        characterView.layer.position=CGPoint(x:canvas.midX+character.x,y:top+logoHeight+20+charHeight*characterView.layer.anchorPoint.y+characterVerticalOffset)
        fallback.frame=characterView.bounds
    }
    static func scale(at seconds:Double,character:Bool,rest:Double=1,reducedMotion:Bool=false)->Double {
        let begin=character ? characterEntryStart:0,enter=character ? 0.55:(reducedMotion ? 0.16:logoEntryDuration),exit=character ? characterExitTime:logoExitStart
        if !character,seconds<enter {
            return rest*(reducedMotion ? JimiV9Motion.Ease.powerOut(2).value(max(0,seconds)/enter):JimiV9Motion.homeEnter(.logo).pose(at:seconds).scaleX)
        }
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
        if !reducedMotion {onLogoMotionCue?(.prepare)}
        prepareAnimatedCharacter()
    }
    private func prepareAnimatedCharacter(){
        guard started,!disposed,!backgrounded,preparedLoop==nil,selectedMotionSource != "fallback-loading" else{return}
        mediaEpoch &+= 1;let epoch=mediaEpoch,token=NativeStudioPreparationToken()
        preparationToken=token;selectedMotionSource="fallback-loading"
        let url=resourceRoot.appendingPathComponent(character.motionAssetPath)
        let logoURL=resourceRoot.appendingPathComponent("assets/logo addons/logo drop.svg")
        NativeStudioAnimatedDecoder.queue.async{[weak self] in
            let began=ProcessInfo.processInfo.systemUptime
            let logoSource=NativeStudioDropSource.read(logoURL,token:token)
            let loop=NativeStudioAnimatedDecoder.prepare(url:url,token:token)
            let elapsed=ProcessInfo.processInfo.systemUptime-began
            guard !token.isCancelled else{return}
            DispatchQueue.main.async{[weak self] in
                self?.publishDecodedMedia{[weak self] in
                    guard let self,!self.disposed,!self.backgrounded,self.mediaEpoch==epoch,!token.isCancelled else{return}
                    self.preparationToken=nil;self.preparationDuration=elapsed
                    if let logoSource {
                        let drop=NativeStudioDropLogo(source:logoSource);self.dropLogo=drop
                        self.logoUnit.insertSubview(drop,belowSubview:self.label)
                        self.logo.isHidden=true;self.sheen.isHidden=true;self.setNeedsLayout();self.layoutIfNeeded()
                    }
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
        if let motion=dropLogo?.captionAnimation(center:label.layer.position,reducedMotion:reducedMotion) {
            label.layer.add(motion,forKey:"native-studio-presents-follow")
        }
        for (index,glyph) in presentsGlyphs.enumerated(){
            let samples=Int(ceil(Self.duration*60))
            let poses=(0...samples).map{Self.presentsPose(at:Self.duration*Double($0)/Double(samples),index:index)}
            let scale=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
            scale.values=poses.map{NSValue(caTransform3D:$0.transform)}
            opacity.values=poses.map{NSNumber(value:Double(max(0,min(1,$0.alpha))))}
            let group=CAAnimationGroup();group.animations=[scale,opacity];group.duration=Self.duration
            group.isRemovedOnCompletion=false;group.fillMode = .both
            glyph.layer.add(group,forKey:"native-studio-presents")
        }
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
        for (index,band) in sheenBands.enumerated() where dropLogo == nil {
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
                let value = !isCharacter && self.dropLogo != nil ? 1:Self.scale(at:Self.duration*Double(index)/Double(samples),character:isCharacter,rest:isCharacter ? Double(character.scale):1,reducedMotion:reducedMotion)
                return NSValue(caTransform3D:CATransform3DMakeScale(value,value,1))
            }
            opacity.values=(0...samples).map{index -> NSNumber in
                let seconds=Self.duration*Double(index)/Double(samples),begin=isCharacter ? Self.characterEntryStart:0,enter=isCharacter ? 0.55:0.45
                if !isCharacter,self.dropLogo != nil {
                    return NSNumber(value:self.reducedMotion ? max(0,min(1,(Self.logoStartDelay+Self.logoDuration-seconds)/(0.44/Self.logoMotionSpeed))):1)
                }
                return NSNumber(value:min(1,max(0,(seconds-begin)/enter)))
            }
            scale.duration=Self.duration;opacity.duration=Self.duration
            let group=CAAnimationGroup();group.animations=[scale,opacity];group.duration=Self.duration
            if !isCharacter{group.delegate=self}
            target.layer.add(group,forKey:"native-studio-intro")
        }
        // Admit explicit SVG/contact clocks after all preparation and character
        // cue work. Their epoch now matches the parent/character CA commit,
        // preserving the100ms stagger instead of advancing it during setup.
        let epoch=CACurrentMediaTime()
        if let dropLogo {
            dropLogo.start(reducedMotion:reducedMotion,epoch:epoch)
            if !reducedMotion {installLogoContactMarkers(epoch:epoch)}
        }else{startLogoIdle()}
    }
    private func installLogoContactMarkers(epoch:CFTimeInterval) {
        logoContactEpoch &+= 1;let token=logoContactEpoch
        let moment=NativeGameplayAudioOwner.studioLogoMoment
        let contacts:[(NativeStudioLogoAudioEvent?,Double)]=[(.fall,moment(0.52)),(.landing,moment(0.84)),(nil,moment(3.56)-0.30),(.exitSmoke,moment(3.56)-0.10),(.exit,moment(3.56))]+NativeGameplayAudioOwner.studioLogoSwingContacts.map{($0.event,$0.cue.delay)}
        for (event,time) in contacts {
            let receipt=JimiWorldAnimationStart{[weak self] in
                guard let self,self.logoContactEpoch==token,!self.disposed,!self.backgrounded,self.timelineStarted else{return}
                if let event {
                    guard self.logoCueEvents.insert(event).inserted else{return}
                    self.onLogoMotionCue?(event)
                }
                // The visual exit puff leads its previous contact by200ms.
                // Keep authored wood/swoosh contacts at their existing times.
                if event == .landing || event == nil {
                    let width=self.logoUnit.bounds.width
                    let projection=NativeTabletLayout.applies(self.bounds.size) ? max(0.01,abs(self.tabletComposition.transform.a)):1
                    let center=CGPoint(x:width/2+(event == nil ? CGFloat.random(in:-0.10...0.10)*width:0),y:width*619/800-20/projection)
                    let rect=CGRect(x:center.x-width*0.52*1.4/2,y:center.y-16*1.4/2,width:width*0.52*1.4,height:16*1.4)
                    let cloud=JimiNativeWorldEffects.smoke(at:rect,in:self.logoUnit,landing:true,below:self.dropLogo)
                    cloud?.name=event == .landing ? "native-studio-logo-landing-poof":"native-studio-logo-exit-poof"
                    if event == .landing {self.landingPoof=cloud}else{self.exitPoof=cloud}
                }
            }
            logoCueReceipts.append(receipt)
            let marker=CABasicAnimation(keyPath:"borderWidth");marker.fromValue=0;marker.toValue=0
            marker.beginTime=label.layer.convertTime(epoch+time,from:nil)
            marker.duration=0.001;marker.delegate=receipt
            label.layer.add(marker,forKey:"native-studio-logo-contact."+(event?.rawValue ?? "exit-poof"))
        }
    }
    private func retireLogoContactMarkers() {
        logoContactEpoch &+= 1
        for event in [NativeStudioLogoAudioEvent.fall,.landing,.swing1,.swing2,.swing3,.swing4,.swing5,.swing6,.swing7,.exitSmoke,.exit] {label.layer.removeAnimation(forKey:"native-studio-logo-contact."+event.rawValue)}
        label.layer.removeAnimation(forKey:"native-studio-logo-contact.exit-poof")
        logoCueReceipts.removeAll()
        for cloud in [landingPoof,exitPoof].compactMap({$0}) {cloud.sublayers?.forEach{$0.removeAllAnimations()};cloud.removeAllAnimations();cloud.removeFromSuperlayer()}
        landingPoof=nil;exitPoof=nil
    }
    private func startLogoIdle() {
        guard !reducedMotion else{return}
        // Exact Worlds Hub outer float:8pt lift,1.8percent breath,0.7degree lean.
        // A finite4.4s fallback float stays quiet after settling.
        // Logo and its sheen share one epoch beneath the unchanged route shell.
        var peak=CATransform3DMakeTranslation(0,-8,0)
        peak=CATransform3DScale(peak,1.018,1.018,1)
        peak=CATransform3DRotate(peak,0.7 * .pi/180,0,0,1)
        let epoch=CACurrentMediaTime()+Self.logoEntryDuration
        for target in [logo,sheen] {
            let animation=CAKeyframeAnimation(keyPath:"transform")
            animation.values=[CATransform3DIdentity,peak,CATransform3DIdentity].map{NSValue(caTransform3D:$0)}
            animation.keyTimes=[0,0.5,1];animation.duration=4.4
            animation.timingFunctions=[CAMediaTimingFunction(name:.easeInEaseOut),CAMediaTimingFunction(name:.easeInEaseOut)]
            animation.beginTime=target.layer.convertTime(epoch,from:nil);animation.fillMode = .backwards
            target.layer.add(animation,forKey:Self.logoIdleKey)
        }
    }
    func animationDidStop(_ anim:CAAnimation,finished:Bool){
        guard finished,timelineStarted,!disposed else{return};finishPresentation()
    }
    private func finishPresentation(){
        guard started,!disposed else{return}
        let done=completion;completion=nil;dispose();done?()
    }
    private func setBackgrounded(_ value:Bool){
        guard !disposed,backgrounded != value else{return};backgrounded=value
        if value {retireLogoContactMarkers();onLogoMotionCue?(.stop)}
        // iOS may discard finite CA animations while the app is backgrounded.
        // Their model pose is intentionally hidden, so waiting for the lost
        // delegate would strand the root on paper. A real app switch retires
        // this launch-only presentation and hands Home off exactly once.
        // Transient focus loss retains the authored pause/resume path below.
        if !value,leftApplication {finishPresentation();return}
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
        retireLogoContactMarkers();onLogoMotionCue?(.stop);onLogoMotionCue=nil
        isHidden=true;mediaEpoch &+= 1;preparationToken?.cancel();preparationToken=nil
        fallback.layer.removeAllAnimations();fallback.image=nil;fallback.layer.contents=nil;preparedLoop=nil
        dropLogo?.dispose();dropLogo?.removeFromSuperview();dropLogo=nil
        CATransaction.begin();CATransaction.setDisableActions(true)
        for target in [logoUnit,characterView]{target.layer.opacity=0;target.layer.transform=CATransform3DMakeScale(0,0,1)}
        sheen.layer.opacity=0;CATransaction.commit()
        for target in [logoUnit,characterView]{target.layer.removeAllAnimations()}
        logo.layer.removeAnimation(forKey:Self.logoIdleKey)
        sheen.layer.removeAllAnimations();sheenMask.removeAllAnimations();sheenBands.forEach{$0.removeAllAnimations()}
        label.layer.removeAllAnimations();presentsGlyphs.forEach{$0.layer.removeAllAnimations();$0.layer.opacity=0}
        notificationOwners.removeAll();removeFromSuperview()
    }
}
