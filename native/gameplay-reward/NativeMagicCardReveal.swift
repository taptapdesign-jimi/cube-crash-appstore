import UIKit
import ImageIO

/// A bounded adapter for the authored magic-card-reveal.svg vocabulary, not a
/// browser or general SVG renderer. Decode once off-main; finite CA tracks use
/// the reward parent's clock. The source asset remains byte-for-byte intact.
nonisolated enum NativeMagicCardSource {
    static let path="assets/animations/sand/magic-card-reveal.svg"
    static let duration=1.86666667
    static let hold=0.725*duration
    static let end=duration
    static let brightnessLift=0.145
    final class Node:@unchecked Sendable {
        let tag:String,attributes:[String:String]
        var children:[Node]=[],image:CGImage?
        init(_ tag:String,_ attributes:[String:String]) {self.tag=tag;self.attributes=attributes}
    }
    private final class Parser:NSObject,XMLParserDelegate {
        var root:Node?,stack:[Node]=[],failed=false
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            let node=Node(name,attributes)
            if let parent=stack.last {parent.children.append(node)}else{root=node}
            stack.append(node)
        }
        func parser(_ parser:XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?){stack.removeLast()}
        func parser(_ parser:XMLParser,foundExternalEntityDeclarationWithName name:String,publicID:String?,systemID:String?){failed=true;parser.abortParsing()}
    }
    private static let queue=DispatchQueue(label:"stacktosix.magic-card.prepare",qos:.userInitiated)
    static func load(root:URL,lease:NativeRewardPreparationLease,completion:@escaping (Node?)->Void) {
        queue.async {
            let node=read(root.appendingPathComponent(path),lease:lease)
            Task { @MainActor in guard !lease.cancelled else{return};completion(node) }
        }
    }
    static func read(_ url:URL,lease:NativeRewardPreparationLease)->Node? {
        guard !lease.cancelled,let data=try? Data(contentsOf:url),data.count<=2_000_000 else{return nil}
        let delegate=Parser(),parser=XMLParser(data:data);parser.delegate=delegate;parser.shouldResolveExternalEntities=false
        guard parser.parse(),!delegate.failed,let root=delegate.root,root.attributes["viewBox"]=="0 0 600 820" else{return nil}
        var images=0,nodes=0,bytes=0
        func prepare(_ node:Node)->Bool {
            nodes += 1
            guard !lease.cancelled,nodes<=600 else{return false}
            guard ["svg","title","desc","defs","radialGradient","stop","g","image","path","circle","animate","animateTransform"].contains(node.tag) else{return false}
            if node.tag=="image" {
                images += 1
                guard images<=9,let href=node.attributes["xlink:href"] ?? node.attributes["href"],href.hasPrefix("data:image/webp;base64,"),let data=Data(base64Encoded:String(href.dropFirst("data:image/webp;base64,".count))),let source=CGImageSourceCreateWithData(data as CFData,nil),let decoded=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),decoded.width<=1024,decoded.height<=1024 else{return false}
                bytes += decoded.width*decoded.height*4
                guard bytes<=12*1024*1024 else{return false}
                // Materialized RGBA avoids first-visible-frame lazy decode.
                guard let bitmap=CGContext(data:nil,width:decoded.width,height:decoded.height,bitsPerComponent:8,bytesPerRow:decoded.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
                bitmap.draw(decoded,in:CGRect(x:0,y:0,width:decoded.width,height:decoded.height))
                brightenPremultipliedRGBA(bitmap)
                node.image=bitmap.makeImage()
                guard node.image != nil else{return false}
            }
            if node.tag=="animate" || node.tag=="animateTransform" {
                guard let dur=node.attributes["dur"],abs((Double(dur.dropLast()) ?? 0)-duration)<0.000001,let values=node.attributes["values"],let times=node.attributes["keyTimes"],values.split(separator:";").count==times.split(separator:";").count else{return false}
            }
            return node.children.allSatisfy(prepare)
        }
        return prepare(root) && images==9 ? root:nil
    }
    static func numbers(_ string:String)->[Double] {string.split(whereSeparator:{$0==" " || $0=="," || $0==";"}).compactMap{Double($0)}}
    /// The accepted five-percent lift plus another ten-percent lift toward
    /// white (1 - 0.95 * 0.90), with no exposure gain or
    /// highlight clipping. Alpha and authored question-mark contrast remain.
    static func brightenPremultipliedRGBA(_ bitmap:CGContext) {
        guard let data=bitmap.data else{return}
        let pixels=data.assumingMemoryBound(to:UInt8.self)
        for y in 0..<bitmap.height {
            for x in 0..<bitmap.width {
                let offset=y*bitmap.bytesPerRow+x*4,alpha=pixels[offset+3]
                for channel in 0..<3 {let value=Double(pixels[offset+channel]);pixels[offset+channel]=UInt8((value+(Double(alpha)-value)*brightnessLift).rounded())}
            }
        }
    }

}

@MainActor
final class NativeMagicCardReveal {
    private struct Track {
        let layer:CALayer,key:String,values:[[Double]],times:[Double],discrete:Bool,splines:[[Double]],type:String
        func value(at seconds:Double)->[Double] {
            let t=min(1,max(0,seconds/NativeMagicCardSource.duration))
            guard let index=times.indices.dropLast().first(where:{t+1e-12<times[$0+1]}) else{return values.last!}
            if discrete {return values[index]}
            var p=(t-times[index])/max(0.00000001,times[index+1]-times[index])
            if splines.indices.contains(index),splines[index].count==4 {let s=splines[index];p=NativeRewardMotion.cubic(p,s[0],s[1],s[2],s[3])}
            return zip(values[index],values[index+1]).map{$0+($1-$0)*p}
        }
        func object(at seconds:Double)->Any {
            let v=value(at:seconds)
            if key=="transform" {
                let result:CATransform3D
                switch type {
                case "scale":result=CATransform3DMakeScale(v[0],v.count>1 ? v[1]:v[0],1)
                case "translate":result=CATransform3DMakeTranslation(v[0],v.count>1 ? v[1]:0,0)
                default:result=CATransform3DMakeRotation(v[0] * .pi/180,0,0,1)
                };return NSValue(caTransform3D:result)
            }
            return NSNumber(value:key=="transform.scale" && layer is CAGradientLayer ? v[0]/128:v[0])
        }
    }
    let layer=CALayer()
    private var tracks:[Track]=[],layers:[CALayer]=[]
    private(set) var ready=false
    var trackCount:Int {tracks.count}
    var imageCount:Int {layers.filter{$0.contents != nil}.count}
    init(){layer.name="native.reward.magic-card";layer.anchorPoint = .zero;layer.bounds=CGRect(x:0,y:0,width:600,height:820)}
    func install(_ source:NativeMagicCardSource.Node) {
        dispose();layer.opacity=1
        CATransaction.begin();CATransaction.setDisableActions(true)
        for node in source.children {build(node,in:layer)}
        ready=true;settle(at:0);CATransaction.commit()
    }
    func layout(in bounds:CGRect) {
        // Match the visible unlocked artwork, including its face and image scales.
        // Keep the complete SVG canvas so authored dust/smoke stays unclipped.
        let scale=bounds.height*NativeRewardPresentation.surfaceScale*NativeRewardPresentation.frontArtworkScale/650
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.position=CGPoint(x:bounds.midX-300*scale,y:bounds.midY-410*scale)
        layer.transform=CATransform3DMakeScale(scale,scale,1);CATransaction.commit()
    }
    func settle(at time:Double) {
        CATransaction.begin();CATransaction.setDisableActions(true)
        for track in tracks {track.layer.removeAnimation(forKey:"magic.\(track.key)");track.layer.setValue(track.object(at:time),forKeyPath:track.key)}
        CATransaction.commit()
    }
    func play(from start:Double,to end:Double,reduced:Bool=false,durationScale:Double=1) {
        guard ready else{return}
        guard !reduced else{settle(at:end);return}
        var prepared:[(CALayer,CAKeyframeAnimation,String)]=[]
        for track in tracks {
            // Preserve every discrete artwork change exactly. Numeric tracks
            // sample only their active portion; constant tracks need no owner.
            let boundaries=track.times.map{$0*NativeMagicCardSource.duration}.filter{$0>start && $0<end}
            if track.value(at:start)==track.value(at:end),boundaries.allSatisfy({track.value(at:$0)==track.value(at:start)}) {continue}
            var samples=[start]+boundaries+[end]
            if !track.discrete {samples += (0...Int(ceil((end-start)*120))).map{start+(end-start)*Double($0)/Double(max(1,Int(ceil((end-start)*120))))}}
            samples=Array(Set(samples)).sorted()
            let animation=CAKeyframeAnimation(keyPath:track.key);animation.values=samples.map{track.object(at:$0)};animation.keyTimes=samples.map{NSNumber(value:($0-start)/(end-start))};animation.duration=(end-start)*durationScale
            animation.calculationMode=track.discrete ? .discrete:.linear
            animation.fillMode = .backwards;animation.isRemovedOnCompletion=true
            prepared.append((track.layer,animation,"magic.\(track.key)"))
        }
        // Build while the source remains at its blank/held start pose. Publish
        // model endpoints and every animation atomically, on one shared clock.
        CATransaction.begin();CATransaction.setDisableActions(true)
        settle(at:end)
        let startTime=CACurrentMediaTime()
        for (target,animation,key) in prepared {
            animation.beginTime=target.convertTime(startTime,from:nil)
            target.add(animation,forKey:key)
        }
        CATransaction.commit()
    }
    func stop(){for item in layers {item.removeAllAnimations()}}
    func dispose(){stop();layer.sublayers?.forEach{$0.removeFromSuperlayer()};layers.removeAll();tracks.removeAll();ready=false}
    private func build(_ node:NativeMagicCardSource.Node,in parent:CALayer) {
        let a=node.attributes
        guard ["g","image","path","circle"].contains(node.tag) else{return}
        let child:CALayer
        if node.tag=="path" {
            let shape=CAShapeLayer(),path=CGMutablePath();let parts=(a["d"] ?? "").split(separator:" ").map(String.init);var i=0
            while i<parts.count {
                let command=parts[i];i += 1
                if command=="Z" {path.closeSubpath();continue}
                guard i+1<parts.count,let x=Double(parts[i]),let y=Double(parts[i+1]) else{break};i += 2
                if command=="M" {path.move(to:CGPoint(x:x,y:y))}else if command=="L" {path.addLine(to:CGPoint(x:x,y:y))}
            }
            shape.path=path;shape.fillColor=color(a["fill"]).cgColor;shape.strokeColor=a["stroke"].map{color($0).cgColor};shape.lineWidth=Double(a["stroke-width"] ?? "0") ?? 0;child=shape
        } else if node.tag=="circle" {
            if a["fill"]=="url(#smoke)" {
                let gradient=CAGradientLayer();gradient.type = .radial;gradient.startPoint=CGPoint(x:0.5,y:0.5);gradient.endPoint=CGPoint(x:1,y:0.5)
                gradient.colors=[color("#e8d8ba",alpha:0.65).cgColor,color("#cbbda5",alpha:0.4).cgColor,color("#cbbda5",alpha:0).cgColor];gradient.locations=[0,0.55,1]
                let mask=CAShapeLayer();mask.path=CGPath(ellipseIn:CGRect(x:0,y:0,width:256,height:256),transform:nil);gradient.mask=mask;child=gradient
            }else{let shape=CAShapeLayer();shape.path=CGPath(ellipseIn:CGRect(x:0,y:0,width:2,height:2),transform:nil);shape.fillColor=color(a["fill"]).cgColor;child=shape}
            let diameter:CGFloat=child is CAGradientLayer ? 256:2
            child.bounds=CGRect(x:0,y:0,width:diameter,height:diameter);child.position=CGPoint(x:Double(a["cx"] ?? "0") ?? 0,y:Double(a["cy"] ?? "0") ?? 0)
            let radius=Double(a["r"] ?? "1") ?? 1;child.transform=CATransform3DMakeScale(radius/(diameter/2),radius/(diameter/2),1)
        } else {
            child=CALayer();child.anchorPoint = .zero
            if node.tag=="image" {
                child.bounds=CGRect(x:0,y:0,width:Double(a["width"] ?? "0") ?? 0,height:Double(a["height"] ?? "0") ?? 0);child.position=CGPoint(x:Double(a["x"] ?? "0") ?? 0,y:Double(a["y"] ?? "0") ?? 0);child.contents=node.image;child.contentsGravity = .resize
            }
        }
        child.name="magic.\(node.tag).\(layers.count)";child.opacity=Float(a["opacity"] ?? "1") ?? 1;child.allowsEdgeAntialiasing=true;child.minificationFilter = .trilinear
        if let transform=a["transform"],transform.hasPrefix("translate("),let close=transform.firstIndex(of:")") {let v=NativeMagicCardSource.numbers(String(transform[transform.index(transform.startIndex,offsetBy:10)..<close]));if v.count==2 {child.transform=CATransform3DMakeTranslation(v[0],v[1],0)}}
        parent.addSublayer(child);layers.append(child)
        for part in node.children {
            if part.tag=="animate" || part.tag=="animateTransform" {
                let attr=part.attributes,type=attr["type"] ?? "",property=attr["attributeName"] ?? ""
                let key:[String:String]=["transform":"transform","opacity":"opacity","cx":"position.x","cy":"position.y","r":"transform.scale"]
                guard let key=key[property] else{continue}
                let values=(attr["values"] ?? "").split(separator:";").map{NativeMagicCardSource.numbers(String($0))},times=NativeMagicCardSource.numbers(attr["keyTimes"] ?? "")
                guard values.count==times.count,values.count>=2,values.allSatisfy({!$0.isEmpty}) else{continue}
                let splines=(attr["keySplines"] ?? "").split(separator:";").map{NativeMagicCardSource.numbers(String($0))}
                tracks.append(Track(layer:child,key:key,values:values,times:times,discrete:attr["calcMode"]=="discrete",splines:splines,type:type))
            }else{build(part,in:child)}
        }
    }
    private func color(_ hex:String?,alpha:CGFloat=1)->UIColor {
        guard let hex,hex.hasPrefix("#"),let number=UInt32(hex.dropFirst(),radix:16) else{return .clear}
        func lift(_ channel:UInt32)->CGFloat {let value=CGFloat(channel)/255;return value+(1-value)*NativeMagicCardSource.brightnessLift}
        return UIColor(red:lift((number>>16)&255),green:lift((number>>8)&255),blue:lift(number&255),alpha:alpha)
    }
}
