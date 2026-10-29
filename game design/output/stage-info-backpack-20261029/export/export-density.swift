import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let destination=root.appendingPathComponent("assets/ui/native-stage-stats-v4")
try FileManager.default.createDirectory(at:destination,withIntermediateDirectories:true)
func export(_ name:String,_ source:String,_ logical:CGSize,_ trim:CGRect)throws {
 let url=root.appendingPathComponent(source)
 guard let loader=CGImageSourceCreateWithURL(url as CFURL,nil),let full=CGImageSourceCreateImageAtIndex(loader,0,nil),let image=full.cropping(to:CGRect(x:trim.minX*CGFloat(full.width),y:trim.minY*CGFloat(full.height),width:trim.width*CGFloat(full.width),height:trim.height*CGFloat(full.height)).integral) else{fatalError("Missing master")}
 let w=image.width,h=image.height
 var pixels=[UInt8](repeating:0,count:w*h*4)
 let bitmap=CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
 let space=CGColorSpace(name:CGColorSpace.sRGB)!
 let cleaned:CGImage=pixels.withUnsafeMutableBytes { bytes in
  let c=CGContext(data:bytes.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:bitmap)!
  c.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
  let p=bytes.bindMemory(to:UInt8.self)
  var mask=[UInt8](repeating:0,count:w*h)
  for i in 0..<mask.count {mask[i]=p[i*4+3]>=200 ? 1:0}
  // Keep the opaque connected slab, excluding disconnected generation speckles.
  var keep=[UInt8](repeating:0,count:w*h),queue=[Int]();queue.reserveCapacity(w*h)
  let center=(h/2)*w+w/2;queue.append(center);keep[center]=1
  var q=0
  while q<queue.count {
   let i=queue[q];q += 1
   for next in [i-1,i+1,i-w,i+w] where next>=0 && next<mask.count && abs(next%w-i%w)<=1 {
    if mask[next] != 0 && keep[next]==0 {keep[next]=1;queue.append(next)}
   }
  }
  // A tiny master-resolution opening removes needle-like fringe spurs. The
  // density export below resamples the silhouette with high-quality antialiasing.
  var eroded=[UInt8](repeating:0,count:w*h)
  for y in 2..<(h-2) {for x in 2..<(w-2) {
   var all=true
   for dy in -2...2 {for dx in -2...2 {if keep[(y+dy)*w+x+dx]==0 {all=false}}}
   eroded[y*w+x]=all ? 1:0
  }}
  var smooth=[UInt8](repeating:0,count:w*h)
  for y in 2..<(h-2) {for x in 2..<(w-2) {
   if eroded[y*w+x] != 0 {for dy in -2...2 {for dx in -2...2 {smooth[(y+dy)*w+x+dx]=1}}}
  }}
  for i in 0..<smooth.count {
   if smooth[i]==0 {for channel in 0..<4 {p[i*4+channel]=0}}
   else {let alpha=max(1,Int(p[i*4+3]));for channel in 0..<3 {p[i*4+channel]=UInt8(min(255,Int(p[i*4+channel])*255/alpha))};p[i*4+3]=255}
  }
  return c.makeImage()!
 }
 for density in 1...3 {
  let width=Int(logical.width)*density,height=Int(logical.height)*density
  let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:bitmap)!
  context.interpolationQuality = .high
  context.draw(cleaned,in:CGRect(x:0,y:0,width:width,height:height))
  let suffix=density==1 ? "":"@\(density)x"
  let out=destination.appendingPathComponent(name+suffix+".png")
  let writer=CGImageDestinationCreateWithURL(out as CFURL,UTType.png.identifier as CFString,1,nil)!
  CGImageDestinationAddImage(writer,context.makeImage()!,nil);precondition(CGImageDestinationFinalize(writer))
  print(out.lastPathComponent,width,height)
 }
}
try export("info-slab","assets/ui/native-stage-stats-v1/puffy-info-slab-v3.png",CGSize(width:326,height:482),CGRect(x:0.012,y:0.035,width:0.976,height:0.94))
try export("stat-tile","assets/ui/native-stage-stats-v1/puffy-stat-tile-v3.png",CGSize(width:136,height:176),CGRect(x:0.02,y:0.04,width:0.96,height:0.925))
