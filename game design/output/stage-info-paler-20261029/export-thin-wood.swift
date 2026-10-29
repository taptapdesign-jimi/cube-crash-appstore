import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let folder=root.appendingPathComponent("assets/ui/native-stage-stats-v7")
let space=CGColorSpace(name:CGColorSpace.sRGB)!
let bitmap=CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue
func load(_ path:String)->CGImage {let source=CGImageSourceCreateWithURL(root.appendingPathComponent(path) as CFURL,nil)!;return CGImageSourceCreateImageAtIndex(source,0,nil)!}
func pixels(_ image:CGImage,_ w:Int,_ h:Int)->[UInt8] {
 var result=[UInt8](repeating:0,count:w*h*4)
 result.withUnsafeMutableBytes{b in let c=CGContext(data:b.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:bitmap)!;c.interpolationQuality = .high;c.draw(image,in:CGRect(x:0,y:0,width:w,height:h))}
 return result
}
var manifest=[[String:Any]]()
for (name,master,old) in [("stat-tile","thin-wood-mini-v7","assets/ui/native-stage-stats-v6/stat-tile")] {
 let generated=load("game design/output/stage-info-paler-20261029/production-masters/"+master+".png")
 for density in 1...3 {
  let suffix=density==1 ? "":"@\(density)x"
  let original=load(old+suffix+".png"),w=original.width,h=original.height
  let prior=pixels(original,w,h),paint=pixels(generated,w,h)
  var output=prior
  // Production export preserves the existing per-density alpha EXACTLY. Generated
  // RGB is composited into it; old material fills any generator transparent gaps.
  // Thus no generation speckles/halo or geometry drift enters runtime silhouettes.
  for i in stride(from:0,to:output.count,by:4) {
   let oa=Double(prior[i+3])/255,ga=Double(paint[i+3])/255
   for ch in 0..<3 {
    let oldStraight=oa>0 ? Double(prior[i+ch])/oa:0
    output[i+ch]=UInt8(max(0,min(255,(Double(paint[i+ch])+oldStraight*(1-ga))*oa)).rounded())
   }
   output[i+3]=prior[i+3]
  }
  output.withUnsafeMutableBytes{b in
   let c=CGContext(data:b.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:bitmap)!
   let out=folder.appendingPathComponent(name+suffix+".png")
   let writer=CGImageDestinationCreateWithURL(out as CFURL,UTType.png.identifier as CFString,1,nil)!
   CGImageDestinationAddImage(writer,c.makeImage()!,nil);precondition(CGImageDestinationFinalize(writer))
   manifest.append(["file":out.lastPathComponent,"width":w,"height":h,"density":density,"master":master,"alphaIdenticalTo":old+suffix+".png"])
  }
 }
}
let data=try JSONSerialization.data(withJSONObject:manifest,options:[.prettyPrinted,.sortedKeys]);try data.write(to:root.appendingPathComponent("game design/output/stage-info-paler-20261029/wood-density-manifest.json"))
print("Exported \(manifest.count) density variants with unchanged source alpha")
