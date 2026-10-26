import UIKit
import ImageIO

/// Original embedded SVG atlases; green hero playback is1.3x. Preparation runs on the existing
/// selected-resource serial queue. No asset conversion or playback scheduler.
nonisolated enum NativeKiteArt {
    static let playbackRate=2.0
    static func sourceTime(seconds:Double)->Double {max(0,seconds)*playbackRate}
    static let path="assets/shop/kite/green kite 2.svg"
    static let previousHeroPath="assets/shop/kite/kite.svg"
    static let backgroundPath="assets/shop/kite/kite2.svg"
    static let assets=[path,backgroundPath]+(1...4).map{"assets/shop/kite/zastavica\($0).png"}
    static let translate = NativeBloobSplashScene.Track(kind:"translate",values:[[0.0,0.0],[56.0,-27.0],[22.0,19.0],[-57.0,-12.0],[-26.0,23.0],[0.0,0.0]],times:[0,0.19,0.43,0.64,0.83,1],splines:Array(repeating:[0.42,0,0.58,1],count:5),duration:2.8,begin:0)
    static let rotation = NativeBloobSplashScene.Track(kind:"rotate",values:[[-3],[10],[4],[-11],[-6],[-3]],times:[0,0.19,0.43,0.64,0.83,1],splines:Array(repeating:[0.42,0,0.58,1],count:5),duration:2.8,begin:0)
    static let scale = NativeBloobSplashScene.Track(kind:"scale",values:[[1.0,1.0],[1.025,0.975],[0.985,1.015],[1.02,0.98],[0.99,1.01],[1.0,1.0]],times:[0,0.19,0.43,0.64,0.83,1],splines:Array(repeating:[0.42,0,0.58,1],count:5),duration:2.8,begin:0)
    static let greenTranslate=NativeBloobSplashScene.Track(kind:"translate",values:[[-13.79,18.85],[-6.86,21.02],[-0.44,22.47],[4.97,22.79],[9.04,21.62],[11.7,18.74],[13.08,14.07],[13.47,7.76],[13.29,0.15],[13.0,-8.24],[12.97,-16.78],[13.48,-24.79],[14.6,-31.62],[16.24,-36.74],[18.09,-39.76],[19.72,-40.55],[20.65,-39.15],[20.39,-35.86],[18.57,-31.11],[15.02,-25.43],[9.74,-19.39],[3.03,-13.49],[-4.64,-8.13],[-12.61,-3.55],[-20.15,0.15],[-26.52,3.08],[-31.1,5.42],[-33.46,7.43],[-33.39,9.39],[-30.97,11.49],[-26.52,13.82],[-20.57,16.34],[-13.79,18.85]],times:[0.0,0.03125,0.0625,0.09375,0.125,0.15625,0.1875,0.21875,0.25,0.28125,0.3125,0.34375,0.375,0.40625,0.4375,0.46875,0.5,0.53125,0.5625,0.59375,0.625,0.65625,0.6875,0.71875,0.75,0.78125,0.8125,0.84375,0.875,0.90625,0.9375,0.96875,1.0],splines:Array(repeating:[0.33,0,0.67,1],count:32),duration:2.55,begin:0)
    static let greenRotation=NativeBloobSplashScene.Track(kind:"rotate",values:[[-4.28,240.0,240.0],[-2.14,240.0,240.0],[0.04,240.0,240.0],[2.11,240.0,240.0],[3.96,240.0,240.0],[5.55,240.0,240.0],[6.89,240.0,240.0],[8.01,240.0,240.0],[8.97,240.0,240.0],[9.85,240.0,240.0],[10.72,240.0,240.0],[11.58,240.0,240.0],[12.45,240.0,240.0],[13.24,240.0,240.0],[13.89,240.0,240.0],[14.26,240.0,240.0],[14.23,240.0,240.0],[13.7,240.0,240.0],[12.59,240.0,240.0],[10.89,240.0,240.0],[8.65,240.0,240.0],[5.96,240.0,240.0],[2.99,240.0,240.0],[-0.04,240.0,240.0],[-2.92,240.0,240.0],[-5.42,240.0,240.0],[-7.35,240.0,240.0],[-8.58,240.0,240.0],[-9.05,240.0,240.0],[-8.75,240.0,240.0],[-7.77,240.0,240.0],[-6.22,240.0,240.0],[-4.28,240.0,240.0]],times:[0.0,0.03125,0.0625,0.09375,0.125,0.15625,0.1875,0.21875,0.25,0.28125,0.3125,0.34375,0.375,0.40625,0.4375,0.46875,0.5,0.53125,0.5625,0.59375,0.625,0.65625,0.6875,0.71875,0.75,0.78125,0.8125,0.84375,0.875,0.90625,0.9375,0.96875,1.0],splines:Array(repeating:[0.33,0,0.67,1],count:32),duration:2.55,begin:0)
    static let greenScale=NativeBloobSplashScene.Track(kind:"scale",values:[[1.0,1.0],[1.0,1.0],[1.0,1.0],[0.9974,0.9974],[0.9903,0.9903],[0.9811,0.9811],[0.9702,0.9702],[0.9585,0.9585],[0.9466,0.9466],[0.9352,0.9352],[0.925,0.925],[0.9163,0.9163],[0.9097,0.9097],[0.9051,0.9051],[0.9027,0.9027],[0.9022,0.9022],[0.9034,0.9034],[0.906,0.906],[0.9097,0.9097],[0.9143,0.9143],[0.9196,0.9196],[0.9255,0.9255],[0.932,0.932],[0.939,0.939],[0.9466,0.9466],[0.9547,0.9547],[0.9632,0.9632],[0.9719,0.9719],[0.9804,0.9804],[0.9883,0.9883],[0.9951,0.9951],[1.0,1.0],[1.0,1.0]],times:[0.0,0.03125,0.0625,0.09375,0.125,0.15625,0.1875,0.21875,0.25,0.28125,0.3125,0.34375,0.375,0.40625,0.4375,0.46875,0.5,0.53125,0.5625,0.59375,0.625,0.65625,0.6875,0.71875,0.75,0.78125,0.8125,0.84375,0.875,0.90625,0.9375,0.96875,1.0],splines:Array(repeating:[0.33,0,0.67,1],count:32),duration:2.55,begin:0)
    static let frameCount=40,columns=5,rows=8
    static let greenPlaybackRate=1.3
    static let cycle=2.55/greenPlaybackRate
    static func frame(seconds:Double)->Int {min(39,Int(max(0,seconds).truncatingRemainder(dividingBy:cycle)/cycle*40))}
    private final class Parser:NSObject,XMLParserDelegate {
        var encoded:String?
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            if name=="image" {encoded=attributes["xlink:href"]}
        }
    }
    static func isSource(_ path:String)->Bool {[Self.path,previousHeroPath,backgroundPath].contains(path)}
    static func decode(_ url:URL)->CGImage? {
        let name=url.lastPathComponent
        let sourceWidth:Int,sourceHeight:Int,width:Int,height:Int
        switch name {
        case "green kite 2.svg":(sourceWidth,sourceHeight,width,height)=(2400,3840,1200,1920)
        case "kite.svg":(sourceWidth,sourceHeight,width,height)=(3520,5280,1760,2640)
        case "kite2.svg":(sourceWidth,sourceHeight,width,height)=(5120,7680,2400,3600)
        default:return nil
        }
        guard let data=try? Data(contentsOf:url),data.count<12_000_000 else{return nil}
        let delegate=Parser(),parser=XMLParser(data:data);parser.delegate=delegate;parser.shouldResolveExternalEntities=false
        guard parser.parse(),let encoded=delegate.encoded?.split(separator:",",maxSplits:1).last,
              let bytes=Data(base64Encoded:String(encoded)),let source=CGImageSourceCreateWithData(bytes as CFData,nil),
              let properties=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],
              properties[kCGImagePropertyPixelWidth] as? Int == sourceWidth,
              properties[kCGImagePropertyPixelHeight] as? Int == sourceHeight,
              let image=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceThumbnailMaxPixelSize:max(width,height),kCGImageSourceShouldCacheImmediately:true] as CFDictionary),
              let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,
                space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
        // Runtime-only bounded surfaces; every supplied SVG remains byte-exact.
        context.interpolationQuality = .high;context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
        return context.makeImage().flatMap{NativeSelectedFinaleRaster.materialize($0)}
    }
    @MainActor static func paint(_ image:UIImageView,seconds:Double,canvas:CGRect,fillsCanvas:Bool=false,driftStrength:Double=1,background:Bool=false,previousHero:Bool=false) {
        let green = !background && !previousHero
        let cycle=green ? 2.55:background ? 1.6:2.8
        let columns=green ? 5:8,rows=green ? 8:12,count=green ? 40:96
        let time=green ? max(0,seconds)*greenPlaybackRate:sourceTime(seconds:seconds)
        let frame=min(count-1,Int(time.truncatingRemainder(dividingBy:cycle)/cycle*Double(count)))
        let drift=driftStrength==0 ? [0.0,0.0]:(translate.sample(sourceTime(seconds:seconds)) ?? [0,0])
        let fabric=(green ? greenScale:scale).sample(green ? time:sourceTime(seconds:seconds)) ?? [1,1]
        let fit:CGFloat=green ? 480.0/640:fillsCanvas ? 1:440.0/640
        image.bounds=CGRect(x:0,y:0,width:canvas.width*fit,height:canvas.height*fit)
        let authored=green ? (greenTranslate.sample(time) ?? [0,0]):drift
        image.center=CGPoint(x:canvas.midX+CGFloat(authored[0])*canvas.width/640,y:canvas.midY+CGFloat(authored[1])*canvas.height/640)
        image.layer.contentsRect=CGRect(x:Double(frame%columns)/Double(columns),y:Double(frame/columns)/Double(rows),width:1.0/Double(columns),height:1.0/Double(rows))
        let angle=green ? (greenRotation.sample(time)?.first ?? 0):0
        image.transform=CGAffineTransform(rotationAngle:angle * .pi/180).scaledBy(x:fabric[0],y:fabric[1])
    }
}
