import UIKit

/// Only SVG motion metadata is prepared here. Its40 original images are byte
/// identical to BLOOB's existing atlas and are never decoded a second time.
nonisolated struct NativeBloobReverseArt:Sendable {
    static let path="assets/shop/bloob/bloob reverse.svg"
    static let duration=1.333333333
    static let burstOffset=duration*0.55
    static let bodyCycle=1.090577307
    typealias Track=NativeBloobSplashScene.Track
    struct Drop:Sendable {let position,rotation,scale,opacity:Track;let frame:Int}
    let collapse,opacity:Track
    let drops:[Drop]
    static func sample(_ track:Track,seconds:Double)->[Double] {
        if seconds>=track.duration {return track.values.last ?? [0]}
        return track.sample(max(0,seconds)) ?? track.values[0]
    }
    private final class Element {
        let name:String,attributes:[String:String];var children:[Element]=[]
        init(_ name:String,_ attributes:[String:String]){self.name=name;self.attributes=attributes}
    }
    private final class Parser:NSObject,XMLParserDelegate {
        var root:Element?,stack:[Element]=[],valid=true,count=0
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            count+=1;guard count<=512,stack.count<40 else{valid=false;parser.abortParsing();return}
            let e=Element(name,attributes);stack.last?.children.append(e)
            if root==nil{root=e};stack.append(e)
        }
        func parser(_ parser:XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?){_ = stack.popLast()}
    }
    private static func numbers(_ value:String)->[Double] {
        value.split{!($0.isNumber || $0=="-" || $0=="." || $0=="e" || $0=="+")}.compactMap{Double($0)}
    }
    private static func track(_ parent:Element,kind:String)->Track? {
        guard let e=parent.children.first(where:{kind=="opacity" ? $0.name=="animate" && $0.attributes["attributeName"]==kind:$0.name=="animateTransform" && $0.attributes["type"]==kind}) else{return nil}
        let a=e.attributes
        guard a["dur"]=="1.333333333s",a["repeatCount"]=="indefinite" else{return nil}
        var values=(a["values"] ?? "").split(separator:";").map{numbers(String($0))}
        let width=kind=="translate" || kind=="scale" ? 2:1
        if kind=="scale" {values=values.map{$0.count==1 ? [$0[0],$0[0]]:$0}}
        let times=numbers(a["keyTimes"] ?? "")
        let splines=a["calcMode"]=="spline" ? (a["keySplines"] ?? "").split(separator:";").map{numbers(String($0))}:[]
        guard values.count>=2,values.count<=64,values.count==times.count,times.first==0,times.last==1,
              values.allSatisfy({$0.count==width && $0.allSatisfy(\.isFinite)}),
              zip(times,times.dropFirst()).allSatisfy({$0<=$1}),
              splines.isEmpty || (splines.count==values.count-1 && splines.allSatisfy{$0.count==4}) else{return nil}
        return Track(kind:kind,values:values,times:times,splines:splines,duration:duration,begin:0)
    }
    static func decode(_ url:URL)->Self? {
        guard url.lastPathComponent=="bloob reverse.svg",let data=try? Data(contentsOf:url),data.count<2_000_000 else{return nil}
        let delegate=Parser(),parser=XMLParser(data:data);parser.delegate=delegate;parser.shouldResolveExternalEntities=false
        guard parser.parse(),delegate.valid,let root=delegate.root,root.attributes["viewBox"]=="0 0 640 640",
              let definitions=root.children.first(where:{$0.name=="defs"}),definitions.children.count==40,
              let group=root.children.first(where:{$0.name=="g"}),group.attributes["transform"]=="translate(320 320)",
              let body=group.children.first,let collapse=track(body,kind:"scale"),let opacity=track(body,kind:"opacity") else{return nil}
        var drops:[Drop]=[]
        for parent in group.children.dropFirst() {
            guard parent.name=="g",parent.attributes["opacity"]=="0",
                  let position=track(parent,kind:"translate"),let alpha=track(parent,kind:"opacity"),
                  let turn=parent.children.first(where:{$0.name=="g"}),let rotation=track(turn,kind:"rotate"),
                  let sizing=turn.children.first(where:{$0.name=="g"}),let scale=track(sizing,kind:"scale"),
                  let offset=sizing.children.first(where:{$0.name=="g"}),offset.attributes["transform"]=="translate(-320 -320)",
                  let href=offset.children.first?.attributes["href"],href.hasPrefix("#f"),
                  let frame=Int(href.dropFirst(2)),(0..<40).contains(frame) else{return nil}
            drops.append(Drop(position:position,rotation:rotation,scale:scale,opacity:alpha,frame:frame))
        }
        guard drops.count==20 else{return nil}
        return Self(collapse:collapse,opacity:opacity,drops:drops)
    }
    /// A tiny readiness token travels through the existing selected image lease.
    /// Runtime drawing uses the original shared BLOOB atlas, not this token.
    static func readinessPixel()->CGImage? {
        CGContext(data:nil,width:1,height:1,bitsPerComponent:8,bytesPerRow:4,
            space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)?.makeImage()
    }
}

/// One finite SVG playback, sampled exclusively by the existing finale clock.
@MainActor final class NativeBloobReverseView:UIView {
    private let recipe:NativeBloobReverseArt
    private let body=CALayer()
    private var droplets:[CALayer]=[]
    private var retired=false,lastTime:Double?,lastFrame:Int?
    init(recipe:NativeBloobReverseArt,atlas:CGImage) {
        self.recipe=recipe;super.init(frame:CGRect(x:0,y:0,width:640,height:640))
        isUserInteractionEnabled=false;isOpaque=false;clipsToBounds=false
        accessibilityIdentifier="native-bloob-reverse"
        func prepare(_ target:CALayer) {
            target.bounds=bounds;target.position=CGPoint(x:320,y:320)
            target.contents=atlas;target.contentsGravity = .resize
            target.contentsRect=CGRect(x:0,y:0,width:1.0/8,height:0.2)
            target.actions=["position":NSNull(),"transform":NSNull(),"opacity":NSNull(),"contentsRect":NSNull()]
            layer.addSublayer(target)
        }
        prepare(body)
        for plan in recipe.drops {
            let drop=CALayer();prepare(drop);drop.opacity=0
            drop.contentsRect=CGRect(x:Double(plan.frame%8)/8,y:Double(plan.frame/8)/5,width:1.0/8,height:0.2)
            droplets.append(drop)
        }
        paint(seconds:0,bodyFrame:0)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func paint(seconds:Double,bodyFrame:Int) {
        guard !retired else{return}
        let t=min(NativeBloobReverseArt.duration,max(0,seconds))
        if lastFrame != bodyFrame {
            body.contentsRect=CGRect(x:Double(bodyFrame%8)/8,y:Double(bodyFrame/8)/5,width:1.0/8,height:0.2);lastFrame=bodyFrame
        }
        guard lastTime != t else{return};lastTime=t
        let size=NativeBloobReverseArt.sample(recipe.collapse,seconds:t)
        body.setAffineTransform(CGAffineTransform(scaleX:size[0],y:size[1]))
        body.opacity=Float(NativeBloobReverseArt.sample(recipe.opacity,seconds:t)[0])
        for (layer,drop) in zip(droplets,recipe.drops) {
            let alpha=NativeBloobReverseArt.sample(drop.opacity,seconds:t)[0]
            layer.opacity=Float(alpha)
            guard alpha>0 else{continue}
            let p=NativeBloobReverseArt.sample(drop.position,seconds:t),s=NativeBloobReverseArt.sample(drop.scale,seconds:t)
            let r=NativeBloobReverseArt.sample(drop.rotation,seconds:t)[0]
            layer.position=CGPoint(x:320+p[0],y:320+p[1])
            layer.setAffineTransform(CGAffineTransform(rotationAngle:r * .pi/180).scaledBy(x:s[0],y:s[1]))
        }
    }
    func dispose(){guard !retired else{return};retired=true;body.contents=nil;droplets.forEach{$0.contents=nil;$0.removeFromSuperlayer()};droplets.removeAll();body.removeFromSuperlayer()}
}
