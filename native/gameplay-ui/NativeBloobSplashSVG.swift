import UIKit
import ImageIO

/// Immutable selected-resource payload. All embedded PNGs become raw pixels on
/// the existing preparation queue; no XML/ImageIO work belongs to paint.
nonisolated struct NativeBloobSplashScene:@unchecked Sendable {
    struct Operation:Sendable {
        let kind:String,values:[Double]
        var transform:CGAffineTransform {
            let v=values.map{CGFloat($0)}
            guard let x=v.first else{return .identity}
            switch kind {
            case "translate":return .init(translationX:x,y:v.count>1 ? v[1]:0)
            case "scale":return .init(scaleX:x,y:v.count>1 ? v[1]:x)
            case "rotate":
                let cx=v.count>1 ? v[1]:0,cy=v.count>2 ? v[2]:0
                return CGAffineTransform(translationX:cx,y:cy).rotated(by:x * .pi/180).translatedBy(x:-cx,y:-cy)
            case "skewX":return .init(a:1,b:0,c:tan(x * .pi/180),d:1,tx:0,ty:0)
            default:return .identity
            }
        }
    }
    struct Track:Sendable {
        let kind:String,values:[[Double]],times:[Double],splines:[[Double]],duration:Double,begin:Double
        func sample(_ seconds:Double)->[Double]? {
            guard seconds>=begin else{return nil}
            let phase=(seconds-begin).truncatingRemainder(dividingBy:duration)/duration
            let i=min(values.count-2,times.lastIndex(where:{$0<=phase}) ?? 0)
            let span=times[i+1]-times[i],p=span>0 ? min(1,max(0,(phase-times[i])/span)):1
            var e=p
            if splines.indices.contains(i) {
                let s=splines[i]
                func cubic(_ t:Double,_ a:Double,_ b:Double)->Double {3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t}
                var lo=0.0,hi=1.0
                for _ in 0..<40 {let mid=(lo+hi)/2;if cubic(mid,s[0],s[2])<p{lo=mid}else{hi=mid}}
                e=cubic((lo+hi)/2,s[1],s[3])
            }
            return zip(values[i],values[i+1]).map{$0+($1-$0)*e}
        }
    }
    struct Node:Sendable {
        let imageID:String?,rect:CGRect,base:[Operation],opacity:Double,tracks:[Track],children:[Node]
        func transform(seconds:Double)->CGAffineTransform {
            // SVG animateTransform defaults to replace, not additive sum.
            if let track=tracks.first(where:{$0.kind != "opacity"}),let values=track.sample(seconds) {return Operation(kind:track.kind,values:values).transform}
            return base.reduce(.identity){$1.transform.concatenating($0)}
        }
        func alpha(seconds:Double)->Double {tracks.first(where:{$0.kind=="opacity"})?.sample(seconds)?.first ?? opacity}
    }
    let root:Node,images:[String:CGImage],animationCount:Int
    private final class Element {
        let name:String,attributes:[String:String];var children:[Element]=[]
        init(_ name:String,_ attributes:[String:String]){self.name=name;self.attributes=attributes}
    }
    private final class Parser:NSObject,XMLParserDelegate {
        var root:Element?,stack:[Element]=[],ids:[String:Element]=[:],valid=true,count=0
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            count+=1;guard count<=512,stack.count<40 else{valid=false;parser.abortParsing();return}
            let node=Element(name,attributes)
            if let id=attributes["id"] {ids[id]=node}
            stack.last?.children.append(node);if root==nil {root=node};stack.append(node)
        }
        func parser(_ parser:XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?){_ = stack.popLast()}
    }
    private static func numbers(_ text:String)->[Double] {
        text.split{!($0.isNumber || $0=="-" || $0=="." || $0=="e" || $0=="+")}.compactMap{Double($0)}
    }
    private static func operations(_ text:String)->[Operation] {
        text.split(separator:")").compactMap {part in
            let pair=part.split(separator:"(",maxSplits:1)
            guard pair.count==2 else{return nil}
            return Operation(kind:pair[0].trimmingCharacters(in:.whitespaces),values:numbers(String(pair[1])))
        }
    }
    private static func track(_ element:Element)->Track? {
        let a=element.attributes,kind=element.name=="animate" ? "opacity":a["type"] ?? ""
        guard ["opacity","translate","rotate","scale","skewX"].contains(kind),
              a["repeatCount"]=="indefinite",a["additive"]==nil,
              let durationText=a["dur"],durationText.hasSuffix("s"),let duration=Double(durationText.dropLast()),duration>0 else{return nil}
        let values=(a["values"] ?? "").split(separator:";").map{numbers(String($0))}
        let times=numbers(a["keyTimes"] ?? "")
        let splines=a["calcMode"]=="spline" ? (a["keySplines"] ?? "").split(separator:";").map{numbers(String($0))}:[]
        guard values.count>=2,values.count<=128,times.count==values.count,times.first==0,times.last==1,
              values.allSatisfy({!$0.isEmpty && $0.count==values[0].count && $0.allSatisfy(\.isFinite)}),
              zip(times,times.dropFirst()).allSatisfy({$0<=$1}),
              splines.isEmpty || (splines.count==values.count-1 && splines.allSatisfy{$0.count==4}) else{return nil}
        let begin=Double((a["begin"] ?? "0s").dropLast()) ?? 0
        return Track(kind:kind,values:values,times:times,splines:splines,duration:duration,begin:begin)
    }
    static func decode(_ url:URL)->Self? {
        guard url.lastPathComponent=="robo splash.svg",let data=try? Data(contentsOf:url),data.count<4_000_000 else{return nil}
        let delegate=Parser(),parser=XMLParser(data:data);parser.delegate=delegate;parser.shouldResolveExternalEntities=false
        guard parser.parse(),delegate.valid,let root=delegate.root,root.attributes["viewBox"]=="0 0 900 900" else{return nil}
        var images:[String:CGImage]=[:]
        for (id,node) in delegate.ids where node.name=="image" {
            guard let encoded=(node.attributes["href"] ?? node.attributes["xlink:href"])?.split(separator:",",maxSplits:1).last,
                  let bytes=Data(base64Encoded:String(encoded)),let source=CGImageSourceCreateWithData(bytes as CFData,nil),
                  let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),
                  let pixels=NativeSelectedFinaleRaster.materialize(image) else{return nil}
            images[id]=pixels
        }
        guard images.count==14 else{return nil}
        var valid=true,animationCount=0,nodeCount=0
        func compile(_ element:Element,_ depth:Int=0)->Node? {
            guard depth<40,nodeCount<512 else{valid=false;return nil}
            guard ["svg","g","use","image"].contains(element.name) else{return nil}
            nodeCount+=1
            let a=element.attributes
            func number(_ key:String)->CGFloat {CGFloat(Double(a[key] ?? "0") ?? 0)}
            let animations=element.children.filter{$0.name=="animate" || $0.name=="animateTransform"}
            let tracks=animations.compactMap{track($0)}
            if tracks.count != animations.count {valid=false}
            animationCount+=tracks.count
            var children:[Node]=[]
            if element.name=="use" {
                guard let href=a["href"] ?? a["xlink:href"],href.hasPrefix("#"),let target=delegate.ids[String(href.dropFirst())],let node=compile(target,depth+1) else{valid=false;return nil}
                children=[node]
            }else{children=element.children.compactMap{compile($0,depth+1)}}
            return Node(imageID:element.name=="image" ? a["id"]:nil,
                rect:CGRect(x:number("x"),y:number("y"),width:number("width"),height:number("height")),
                base:operations(a["transform"] ?? ""),opacity:Double(a["opacity"] ?? "1") ?? 1,tracks:tracks,children:children)
        }
        guard let compiled=compile(root),valid,animationCount==88 else{return nil}
        return Self(root:compiled,images:images,animationCount:animationCount)
    }
    /// Only preparation/tests render a poster. Visible motion updates layers.
    func poster(seconds:Double=0)->CGImage? {
        guard let context=CGContext(data:nil,width:900,height:900,bitsPerComponent:8,bytesPerRow:3600,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
        context.translateBy(x:0,y:900);context.scaleBy(x:1,y:-1)
        func draw(_ node:Node) {
            context.saveGState();defer{context.restoreGState()}
            context.concatenate(node.transform(seconds:seconds));context.setAlpha(node.alpha(seconds:seconds))
            if let id=node.imageID,let image=images[id] {
                context.translateBy(x:node.rect.minX,y:node.rect.maxY);context.scaleBy(x:1,y:-1)
                context.draw(image,in:CGRect(origin:.zero,size:node.rect.size))
            }
            for child in node.children {draw(child)}
        }
        draw(root);return context.makeImage()
    }
}

/// All88 original tracks sample the finale's existing finite clock. This view
/// owns no display link, timer, decode queue, observer or perpetual animation.
@MainActor final class NativeBloobSplashSVGView:UIView {
    private var animated:[(UIView,NativeBloobSplashScene.Node)]=[]
    private var retired=false,lastTime:Double?
    init(scene:NativeBloobSplashScene) {
        super.init(frame:CGRect(x:0,y:0,width:900,height:900));isUserInteractionEnabled=false
        accessibilityIdentifier="native-bloob-splash-svg"
        func mount(_ node:NativeBloobSplashScene.Node,in parent:UIView) {
            let view:UIView
            if let id=node.imageID,let pixels=scene.images[id] {
                let image=UIImageView(image:UIImage(cgImage:pixels));image.frame=node.rect
                image.accessibilityIdentifier="native-bloob-splash-"+id;view=image
            }else {
                view=UIView(frame:bounds);view.layer.anchorPoint = .zero;view.layer.position = .zero
            }
            view.isUserInteractionEnabled=false;view.alpha=node.alpha(seconds:0);view.transform=node.transform(seconds:0)
            parent.addSubview(view)
            if !node.tracks.isEmpty {animated.append((view,node))}
            for child in node.children {mount(child,in:view)}
        }
        mount(scene.root,in:self)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func paint(seconds:Double) {
        guard !retired,lastTime != seconds else{return};lastTime=seconds
        for (view,node) in animated {
            let transform=node.transform(seconds:seconds),alpha=node.alpha(seconds:seconds)
            if view.transform != transform {view.transform=transform}
            if view.alpha != alpha {view.alpha=alpha}
        }
    }
    func dispose(){guard !retired else{return};retired=true;animated.removeAll();subviews.forEach{$0.removeFromSuperview()}}
}
