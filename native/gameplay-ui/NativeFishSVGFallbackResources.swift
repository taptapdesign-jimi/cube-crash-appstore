import Foundation
import CoreGraphics
import ImageIO

/// Immutable selected-family pixels and SMIL metadata decoded from the original
/// SVG. No generated image asset and no process-wide bitmap cache.
nonisolated struct NativeFishSVGFallbackResources:@unchecked Sendable {
    struct Track:Sendable {
        let type:String,duration:Double,values:[[Double]],keyTimes:[Double],splines:[[Double]],discrete:Bool
        func sample(unit:Double)->[Double] {
            if discrete {return values[min(values.count-1,max(0,Int(floor(unit*Double(values.count)))))]}
            var index=keyTimes.count-2
            for i in 0..<(keyTimes.count-1) where unit<keyTimes[i+1] {index=i;break}
            let span=keyTimes[index+1]-keyTimes[index]
            let t=min(1,max(0,(unit-keyTimes[index])/span)),curve=splines[index]
            func cubic(_ x:Double,_ a:Double,_ b:Double)->Double {3*(1-x)*(1-x)*x*a+3*(1-x)*x*x*b+x*x*x}
            var low=0.0,high=1.0
            for _ in 0..<48 {let mid=(low+high)/2;if cubic(mid,curve[0],curve[2])<t {low=mid}else{high=mid}}
            let eased=cubic((low+high)/2,curve[1],curve[3])
            return zip(values[index],values[index+1]).map {$0+($1-$0)*eased}
        }
    }
    struct Pose {
        let frame:Int,x:Double,y:Double,rotation:Double,scaleX:Double,scaleY:Double
    }
    enum ResourceError:Error {case unsupportedOriginalSVG,undecodableOriginalStrip}
    let frames:[CGImage]
    let translate:Track,rotate:Track,scale:Track,discrete:Track
    let duration:Double,viewBox:CGRect,pivot:CGPoint
    static func load(resourceRoot:URL)throws->Self {
        let data=try Data(contentsOf:resourceRoot.appendingPathComponent("assets/shop/fish/fish.svg"))
        try Task.checkCancellation()
        let parsed=NativeFishSVGMetadata(),parser=XMLParser(data:data);parser.delegate=parsed
        guard parser.parse(),parsed.tracks.count==4,
              let translate=parsed.tracks.first(where:{$0.type=="translate" && !$0.discrete}),
              let rotate=parsed.tracks.first(where:{$0.type=="rotate"}),let scale=parsed.tracks.first(where:{$0.type=="scale"}),
              let discrete=parsed.tracks.first(where:{$0.discrete}),discrete.values.count==72,
              translate.duration==1.125,rotate.duration==translate.duration,scale.duration==translate.duration,discrete.duration==translate.duration,
              parsed.viewBox==CGRect(x:-24,y:-28,width:272,height:280),parsed.pivot==CGPoint(x:137,y:112),
              let encoded=parsed.imageURI,encoded.hasPrefix("data:image/webp;base64,"),
              let bytes=Data(base64Encoded:String(encoded.dropFirst("data:image/webp;base64,".count))),
              let source=CGImageSourceCreateWithData(bytes as CFData,nil),let strip=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),strip.width==16128,strip.height==224 else {throw ResourceError.unsupportedOriginalSVG}
        var frames:[CGImage]=[]
        for i in 0..<72 {
            try Task.checkCancellation()
            guard discrete.values[i]==[-Double(i)*224,0],let frame=strip.cropping(to:CGRect(x:i*224,y:0,width:224,height:224)) else {throw ResourceError.undecodableOriginalStrip}
            frames.append(frame)
        }
        return Self(frames:frames,translate:translate,rotate:rotate,scale:scale,discrete:discrete,duration:translate.duration,viewBox:parsed.viewBox!,pivot:parsed.pivot!)
    }
    func sample(seconds:Double)->Pose {
        let elapsed=max(0,seconds),unit=elapsed.truncatingRemainder(dividingBy:duration)/duration
        let translation=translate.sample(unit:unit),rotation=rotate.sample(unit:unit),scaling=scale.sample(unit:unit)
        return Pose(frame:min(71,Int(floor(unit*72))),x:translation[0],y:translation[1],rotation:rotation[0]*Double.pi/180,scaleX:scaling[0],scaleY:scaling[1])
    }
}

private nonisolated final class NativeFishSVGMetadata:NSObject,XMLParserDelegate {
    var tracks:[NativeFishSVGFallbackResources.Track]=[],viewBox:CGRect?,pivot:CGPoint?,imageURI:String?
    func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes attrs:[String:String]) {
        func numbers(_ value:String)->[Double] {value.split(whereSeparator:{$0==" " || $0=="," || $0=="\n"}).compactMap {Double($0)}}
        func vectors(_ value:String)->[[Double]] {value.split(separator:";").map {numbers(String($0))}}
        if name=="svg",let text=attrs["viewBox"] {let box=numbers(text);if box.count==4 {viewBox=CGRect(x:box[0],y:box[1],width:box[2],height:box[3])}}
        if name=="g",attrs["transform"]=="translate(137 112)" {pivot=CGPoint(x:137,y:112)}
        if name=="image" {imageURI=attrs["href"]}
        guard name=="animateTransform",let type=attrs["type"],let raw=attrs["values"],let dur=attrs["dur"],dur.hasSuffix("s"),let duration=Double(dur.dropLast()),duration>0 else {return}
        let values=vectors(raw),discrete=attrs["calcMode"]=="discrete",times=(attrs["keyTimes"] ?? "").split(separator:";").compactMap {Double($0)},splines=vectors(attrs["keySplines"] ?? "")
        let dimensions=type=="rotate" ? 1:2
        guard !values.isEmpty,values.allSatisfy({$0.count==dimensions}),discrete || times.count==values.count && times.first==0 && times.last==1 && splines.count==values.count-1 && splines.allSatisfy({$0.count==4}) else {return}
        tracks.append(.init(type:type,duration:duration,values:values,keyTimes:times,splines:splines,discrete:discrete))
    }
}
