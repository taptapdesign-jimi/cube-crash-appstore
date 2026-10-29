import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Offline export only. Existing originals stay untouched; runtime has no processing.
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let work=root.appendingPathComponent("game design/output/stat-tile-no-wood-20261029")
let dest=root.appendingPathComponent("assets/ui/native-stage-stats-v12")
try FileManager.default.createDirectory(at:dest,withIntermediateDirectories:true)
let space=CGColorSpace(name:CGColorSpace.sRGB)!
let format=CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue
func load(_ url:URL)->CGImage {CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(url as CFURL,nil)!,0,nil)!}
func pixels(_ image:CGImage,_ w:Int,_ h:Int)->[UInt8] {
    var data=[UInt8](repeating:0,count:w*h*4)
    data.withUnsafeMutableBytes {b in
        let c=CGContext(data:b.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:format)!
        c.interpolationQuality = .high;c.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
    };return data
}
// Ignore detached generation flecks when aligning material to the retained silhouette.
func body(_ p:[UInt8],_ w:Int,_ h:Int)->CGRect {
    let ys=(0..<h).filter{y in (0..<w).reduce(0){$0+(p[(y*w+$1)*4+3]>220 ? 1:0)}>w/4}
    let xs=(0..<w).filter{x in (0..<h).reduce(0){$0+(p[($1*w+x)*4+3]>220 ? 1:0)}>h/4}
    return CGRect(x:xs.first!,y:ys.first!,width:xs.last!-xs.first!+1,height:ys.last!-ys.first!+1)
}
func sample(_ p:[UInt8],_ w:Int,_ h:Int,_ x:Double,_ y:Double,_ ch:Int)->Double {
    let x=max(0,min(Double(w-1),x)),y=max(0,min(Double(h-1),y))
    let x0=Int(x),y0=Int(y),x1=min(w-1,x0+1),y1=min(h-1,y0+1),tx=x-Double(x0),ty=y-Double(y0)
    func v(_ a:Int,_ b:Int)->Double {Double(p[(b*w+a)*4+ch])}
    return (v(x0,y0)*(1-tx)+v(x1,y0)*tx)*(1-ty)+(v(x0,y1)*(1-tx)+v(x1,y1)*tx)*ty
}
var manifest=[[String:Any]]()
for density in 1...3 {
    let suffix=density==1 ? "":"@\(density)x",w=138*density,h=176*density
    let old=pixels(load(root.appendingPathComponent("assets/ui/native-stage-stats-v11/stat-tile\(suffix).png")),w,h),target=body(old,w,h)
    let paint=pixels(load(work.appendingPathComponent("candidate-01.png")),w,h),bounds=body(paint,w,h)
    var silhouette=[UInt8](repeating:0,count:w*h*4)
    silhouette.withUnsafeMutableBytes { bytes in
        let c=CGContext(data:bytes.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:format)!
        c.scaleBy(x:CGFloat(density),y:CGFloat(density))
        let path=CGMutablePath()
        path.move(to:CGPoint(x:2,y:0));path.addLine(to:CGPoint(x:136,y:0));path.addLine(to:CGPoint(x:136,y:140))
        path.addCurve(to:CGPoint(x:120,y:171),control1:CGPoint(x:136,y:161),control2:CGPoint(x:133,y:168))
        path.addCurve(to:CGPoint(x:69,y:175),control1:CGPoint(x:106,y:175),control2:CGPoint(x:86,y:175))
        path.addCurve(to:CGPoint(x:18,y:171),control1:CGPoint(x:52,y:175),control2:CGPoint(x:32,y:175))
        path.addCurve(to:CGPoint(x:2,y:140),control1:CGPoint(x:5,y:168),control2:CGPoint(x:2,y:161))
        path.closeSubpath();c.addPath(path);c.setFillColor(CGColor(gray:1,alpha:1));c.fillPath()
    }
    let topY:[Int]=(0..<w).map {x in (0..<h).first(where:{old[($0*w+x)*4+3]>127}) ?? 0}
    let bottomY:[Int]=(0..<w).map {x in (0..<h).last(where:{silhouette[((h-1-$0)*w+x)*4+3]>127}) ?? (h-1)}
    var output=old
    for y in 0..<h {for x in 0..<w {
        let sx=bounds.minX+(Double(x)-target.minX)*bounds.width/target.width
        let sy=bounds.minY+(Double(y)-target.minY)*bounds.height/target.height
        let i=(y*w+x)*4,alpha=Double(old[i+3])/255
        var paintY=sy,ga=sample(paint,w,h,sx,sy,3)/255
        // Do not pull transparent generation fringe or old wood into the new edge.
        while ga<0.98 && paintY>Double(h)*0.6 {paintY-=0.5;ga=sample(paint,w,h,sx,paintY,3)/255}
        // Protect the entire upper80percent, including sprig and existing sides.
        let transition=max(0,min(1,(Double(y)/Double(h)-0.80)/0.04))
        let oldOrange=Int(old[i])-Int(old[i+1])>30 && Int(old[i+1])-Int(old[i+2])>25
        let blend = Double(y)/Double(h)>=0.80 && oldOrange ? 1:transition
        // Smooth tangent-connected lower curves match the thin rounded top.
        // Never reuse the defective wooden lower alpha from v11.
        let newAlpha=Double(silhouette[((h-1-y)*w+x)*4+3])
        let finalAlpha = Double(y)/Double(h) < 0.80 ? Double(old[i+3]):newAlpha
        for ch in 0..<3 {
            let original=alpha>0 ? Double(old[i+ch])/alpha:0
            let generated=ga>0.95 ? sample(paint,w,h,sx,paintY,ch)/ga:Double([245,238,226][ch])
            // Carry the complete thin TOP rim onto the new bottom outline,
            // including its highlight; never cut a thick painted rim in half.
            let depth=max(0,bottomY[x]-y)
            let rim=max(0,min(1,(Double(6*density-depth))/Double(2*density)))
            let topIndex=(min(h-1,topY[x]+depth)*w+x)*4
            let topAlpha=Double(old[topIndex+3])/255
            let topColor=topAlpha>0 ? Double(old[topIndex+ch])/topAlpha:generated
            let fresh=generated*(1-rim)+topColor*rim
            let color=original*(1-blend)+fresh*blend
            output[i+ch]=UInt8(max(0,min(finalAlpha,color*finalAlpha/255)).rounded())
        }
        output[i+3]=UInt8(max(0,min(255,finalAlpha)).rounded())
    }}
    let url=dest.appendingPathComponent("stat-tile\(suffix).png")
    output.withUnsafeMutableBytes {b in
        let c=CGContext(data:b.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:format)!
        let writer=CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil)!
        CGImageDestinationAddImage(writer,c.makeImage()!,nil);precondition(CGImageDestinationFinalize(writer))
    }
    manifest.append(["file":url.lastPathComponent,"width":w,"height":h,"density":density])
}
try JSONSerialization.data(withJSONObject:manifest,options:[.prettyPrinted,.sortedKeys]).write(to:work.appendingPathComponent("density-manifest.json"))
print("Exported three static clean-edge mini densities; upper80percent preserved; wood removed; smooth tangent-connected lower silhouette.")
