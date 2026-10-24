import UIKit
import ImageIO

/// Original embedded SVG pixels decoded only by selected resource preparation.
nonisolated enum NativeBloobArt {
    static let path="assets/shop/bloob/bloob.svg"
    static let splashPath="assets/shop/bloob/robo splash.svg"
    static func isSource(_ path:String)->Bool {path==Self.path || path==splashPath}
    static func frame(seconds:Double)->Int {
        let starts:[Double]=[0,0.03125,0.046875,0.078125,0.09375,0.125,0.15625,0.171875,0.203125,0.21875,0.25,0.28125,0.296875,0.328125,0.34375,0.375,0.40625,0.421875,0.453125,0.46875,0.5,0.53125,0.546875,0.578125,0.59375,0.625,0.65625,0.671875,0.703125,0.71875,0.75,0.78125,0.796875,0.828125,0.84375,0.875,0.90625,0.921875,0.953125,0.96875]
        let phase=max(0,seconds).truncatingRemainder(dividingBy:1.635865961197037)/1.635865961197037
        return starts.lastIndex(where:{$0<=phase}) ?? 0
    }
    /// Immutable per-owner source-time route; samples also support finite-clock
    /// inspection/rewind without random draws, retained history or extra clocks.
    struct PlaybackRoute {
        static let cycle=1.635865961197037
        private struct Segment {let begin,end,from,to:Double}
        private let segments:[Segment]
        let duration:Double
        init(random:()->Double={Double.random(in:0..<1)}) {
            var targets=[Self.cycle]
            for i in 1..<16 {
                let value=random(),r=value.isFinite ? min(1,max(0,value)):0.5
                let fraction:Double
                if i%4==0 {fraction=1}
                else if i%4==3 {fraction=0}
                else {fraction=i%2==0 ? 0.65+r*0.35:r*0.35}
                targets.append(fraction*Self.cycle)
            }
            var built:[Segment]=[],from:Double=0,time:Double=0
            for target in targets {
                let end=time+abs(target-from)
                built.append(Segment(begin:time,end:end,from:from,to:target))
                time=end;from=target
            }
            segments=built;duration=time
        }
        init(seed:UInt64) {
            var state=seed
            self.init(random:{state=state &* 6364136223846793005 &+ 1;return Double(state>>11)/Double(UInt64.max>>11)})
        }
        func seconds(at elapsed:Double)->Double {
            guard elapsed.isFinite else{return 0}
            let time=max(0,elapsed).truncatingRemainder(dividingBy:duration)
            var low=0,high=segments.count-1
            while low<high {
                let middle=(low+high)/2
                if time<segments[middle].end {high=middle}else{low=middle+1}
            }
            let segment=segments[low]
            return min(Self.cycle.nextDown,max(0,segment.from+(segment.to>segment.from ? 1:-1)*(time-segment.begin)))
        }
    }
    struct Playback {
        static let cycle=PlaybackRoute.cycle
        private let route:PlaybackRoute
        private var elapsed:Double=0
        var seconds:Double {route.seconds(at:elapsed)}
        init(random:()->Double={Double.random(in:0..<1)}) {route=PlaybackRoute(random:random)}
        init(seed:UInt64) {route=PlaybackRoute(seed:seed)}
        mutating func advance(_ delta:Double)->Double {
            guard delta.isFinite,delta>0 else{return seconds}
            elapsed=(elapsed+min(delta,Self.cycle)).truncatingRemainder(dividingBy:route.duration)
            return seconds
        }
    }
    struct Pose {let x,y,rotation:CGFloat}
    static func idlePose(seconds:Double)->Pose {
        // Exactly twice the existing Pod whole-body pose speed, with a clearly
        // airborne two-axis displacement. Shared board/Backpack clock only.
        let pose=NativeBloobBallArt.idlePose(seconds:seconds*2)
        return Pose(x:pose.x*1.4,y:14-pose.y*1.15,rotation:-pose.rotation * .pi/180)
    }
    private final class Element {
        let name:String,attributes:[String:String]
        var children:[Element]=[]
        init(_ name:String,_ attributes:[String:String]){self.name=name;self.attributes=attributes}
    }
    private final class Parser:NSObject,XMLParserDelegate {
        var root:Element?,stack:[Element]=[],ids:[String:Element]=[:]
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
            let node=Element(name,attributes)
            if let id=attributes["id"] {ids[id]=node}
            stack.last?.children.append(node);if root==nil {root=node};stack.append(node)
        }
        func parser(_ parser:XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?) {_=stack.popLast()}
    }
    private static func bitmap(_ node:Element)->CGImage? {
        guard let data=node.attributes["xlink:href"] ?? node.attributes["href"],
              let encoded=data.split(separator:",",maxSplits:1).last,let bytes=Data(base64Encoded:String(encoded)),
              let source=CGImageSourceCreateWithData(bytes as CFData,nil) else{return nil}
        return CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary)
    }
    static func decode(_ url:URL)->CGImage? {
        if url.lastPathComponent=="robo splash.svg" {return NativeBloobSplashScene.decode(url)?.poster()}
        guard let data=try? Data(contentsOf:url),data.count<12_000_000 else{return nil}
        let delegate=Parser(),parser=XMLParser(data:data);parser.delegate=delegate;parser.shouldResolveExternalEntities=false
        guard parser.parse() else{return nil}
        if url.lastPathComponent=="bloob.svg" {
            guard let context=CGContext(data:nil,width:2048,height:1280,bitsPerComponent:8,bytesPerRow:2048*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
            for i in 0..<40 {
                guard let node=delegate.ids["f\(i)"],let image=bitmap(node) else{return nil}
                context.draw(image,in:CGRect(x:i%8*256,y:(4-i/8)*256,width:256,height:256))
            }
            return context.makeImage()
        }
        return nil
    }
}
extension NativeDiceSheet {
    static let bloob=NativeDiceSheet(path:NativeBloobArt.path,atlas:CGSize(width:2048,height:1280),cell:CGSize(width:256,height:256),columns:8,frameCount:40,cycle:1.635865961197037,anchor:CGPoint(x:0.5,y:0.5),displayScale:0.5,animateDuringDrag:true)
}
