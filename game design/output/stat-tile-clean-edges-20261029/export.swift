import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Offline export only. Existing originals stay untouched; runtime has no processing.
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let work=root.appendingPathComponent("game design/output/stat-tile-clean-edges-20261029")
let dest=root.appendingPathComponent("assets/ui/native-stage-stats-v11")
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
    let old=pixels(load(root.appendingPathComponent("assets/ui/native-stage-stats-v8/stat-tile\(suffix).png")),w,h),target=body(old,w,h)
    let paint=pixels(load(work.appendingPathComponent("candidate-01.png")),w,h),bounds=body(paint,w,h)
    var output=old
    for y in 0..<h {for x in 0..<w {
        let sx=bounds.minX+(Double(x)-target.minX)*bounds.width/target.width
        let sy=bounds.minY+(Double(y)-target.minY)*bounds.height/target.height
        let i=(y*w+x)*4,alpha=Double(old[i+3])/255,ga=sample(paint,w,h,sx,sy,3)/255
        let edge=min(Double(x)-target.minX,target.maxX-1-Double(x))/Double(density)
        let side=max(0,min(1,(8-edge)/3))
        let bottom=max(0,min(1,(Double(y)/Double(h)-0.84)/0.04))
        let blend=max(side,bottom)
        for ch in 0..<3 {
            let fresh=ga>0.02 ? sample(paint,w,h,sx,sy,ch)/ga*alpha:Double(old[i+ch])
            output[i+ch]=UInt8(max(0,min(255,Double(old[i+ch])*(1-blend)+fresh*blend)).rounded())
        }
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
print("Exported three static clean-edge mini densities; original alpha and center preserved.")
