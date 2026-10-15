import UIKit
import ImageIO

/// Authored cubero.svg curves at user-requested 1.56x playback, sampled by the existing board clock.
/// No browser, per-die decoder, timer or additional animation lease.
nonisolated enum NativeCuberoIdleMotion {
    static let artworkScale:CGFloat=1.3248
    static let duration=1.5/1.3
    static let sourcePath="assets/shop/cubero/cubero.svg"
    static let frameIDs=["p9","p1","p6","p5","p4","p7","p0"]
    static let frameTimes=[0.0,0.09,0.18,0.27,0.36,0.54,0.63,0.72,0.81,0.9,1.0]
    static let frameOrder=[0,1,2,3,4,3,2,1,5,6,0]
    struct Pose {let y,scaleX,scaleY:CGFloat}
    static func frame(seconds:Double)->Int {
        let t=max(0,seconds).truncatingRemainder(dividingBy:duration)/duration
        let i=frameTimes.lastIndex(where:{$0<=t+1e-12}) ?? 0
        return frameOrder[i]
    }
    private static let sy:[[Double]]=[[0.4,0,0.6,1],[0.16,0.65,0.3,1],[0.3,0,0.7,1],[0.65,0,0.9,0.6],[0.2,0,0.4,1],[0.2,0,0.4,1]]
    private static let ss:[[Double]]=[[0.4,0,0.6,1],[0.2,0,0.4,1],[0.3,0,0.7,1],[0.4,0,0.7,1],[0.2,0,0.4,1],[0.15,0,0.4,1]]
    private static let scaleTimes=[0.0,0.12,0.25,0.52,0.8,0.9,1.0]
    static func sample(seconds:Double)->Pose {
        let t=max(0,seconds).truncatingRemainder(dividingBy:duration)/duration
        func track(_ times:[Double],_ values:[Double],_ splines:[[Double]])->CGFloat {
            let i=times.indices.dropLast().first(where:{t<times[$0+1]}) ?? times.count-2
            let raw=(t-times[i])/(times[i+1]-times[i]),s=splines[i]
            var lo=0.0,hi=1.0
            func cubic(_ u:Double,_ a:Double,_ b:Double)->Double {3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u}
            for _ in 0..<30 {let mid=(lo+hi)/2;if cubic(mid,s[0],s[2])<raw {lo=mid}else{hi=mid}}
            let p=cubic((lo+hi)/2,s[1],s[3])
            return CGFloat(values[i]+(values[i+1]-values[i])*p)
        }
        return Pose(y:track([0,0.12,0.4,0.52,0.82,0.9,1],[0,7,-55,-65,0,8,0],sy),
            scaleX:track(scaleTimes,[1,1.04,0.98,1,0.99,1.05,1],ss),
            scaleY:track(scaleTimes,[1,0.96,1.025,1,1.02,0.95,1],ss))
    }
}

/// Seven immutable embedded WebP poses become one shared bounded atlas, on
/// NativeBoardTextures' existing serial decoder. Original SVG bytes stay intact.
nonisolated enum NativeCuberoSVGAtlas {
    private final class Parser:NSObject,XMLParserDelegate {
        var images:[String:([String:String])]=[:]
        var valid=true
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            if name=="svg",attributes["viewBox"] != "0 0 480 540" {valid=false}
            if name=="image",let id=attributes["id"] {images[id]=attributes}
        }
    }
    static func decode(_ url:URL)->CGImage? {
        guard let data=try? Data(contentsOf:url),data.count<=2_000_000 else{return nil}
        let delegate=Parser(),parser=XMLParser(data:data);parser.delegate=delegate;parser.shouldResolveExternalEntities=false
        guard parser.parse(),delegate.valid,delegate.images.count==7,
            let canvas=CGContext(data:nil,width:3360,height:540,bitsPerComponent:8,bytesPerRow:3360*4,
                space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
        // CGContext bottom-left coordinates; each cell retains the full SVG
        // canvas, including the outer translate(0 50) and foot pivot (240 480).
        for (index,id) in NativeCuberoIdleMotion.frameIDs.enumerated() {
            guard let a=delegate.images[id],let href=a["href"],href.hasPrefix("data:image/webp;base64,"),
                let bytes=Data(base64Encoded:String(href.dropFirst("data:image/webp;base64,".count))),
                let source=CGImageSourceCreateWithData(bytes as CFData,nil),
                let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),
                image.width<=1024,image.height<=1024,
                let x=Double(a["x"] ?? ""),let y=Double(a["y"] ?? ""),
                let w=Double(a["width"] ?? ""),let h=Double(a["height"] ?? "") else{return nil}
            canvas.draw(image,in:CGRect(x:Double(index*480)+x,y:540-y-50-h,width:w,height:h))
        }
        return canvas.makeImage()
    }
}
