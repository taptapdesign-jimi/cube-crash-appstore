import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let work=root.appendingPathComponent("game design/output/stage-three-variants-20261030")
let sourceURL=root.appendingPathComponent("game design/output/stage-lower-edge-repair-20261030/candidate-02.png")
func load(_ u:URL)->CGImage{CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(u as CFURL,nil)!,0,nil)!}
func bytes(_ i:CGImage)->[UInt8]{precondition(i.bitsPerPixel==32 && i.alphaInfo == .last);let d=i.dataProvider!.data!;return Array(UnsafeBufferPointer(start:CFDataGetBytePtr(d),count:CFDataGetLength(d)))}
func smooth(_ x:Double)->Double{let t=max(0,min(1,x));return t*t*(3-2*t)}
let original=load(sourceURL),a=bytes(original),w=original.width,h=original.height,row=original.bytesPerRow
let first=root.appendingPathComponent("assets/ui/stage-info-card-01.png")
precondition(!FileManager.default.fileExists(atPath:first.path));try FileManager.default.copyItem(at:sourceURL,to:first)
var reports:[[String:Any]]=[]
for variant in 2...3 {
 let paint=load(work.appendingPathComponent(String(format:"generated-%02d.png",variant))),p=bytes(paint)
 var out=a,changed=0,alphaChanges=0,outsideChanges=0
 for y in Int(Double(h)*0.86)..<h {
  let fy=Double(y)/Double(h),py=min(paint.height-1,Int(fy*Double(paint.height)))
  let vertical=smooth((fy-0.86)/0.045)
  for x in 65..<(w-65) {
   let i=y*row+x*4;guard a[i+3]>0 else{continue}
   let px=min(paint.width-1,Int(Double(x)*Double(paint.width)/Double(w))),j=py*paint.bytesPerRow+px*4
   guard p[j+3]>220 else{continue}
   let blend=vertical*smooth(Double(x-65)/24)*smooth(Double(w-66-x)/24)
   for c in 0..<3 {out[i+c]=UInt8((Double(a[i+c])*(1-blend)+Double(p[j+c])*blend).rounded())}
  }
 }
 for y in 0..<h {for x in 0..<w {let i=y*row+x*4;if a[i+3] != out[i+3]{alphaChanges+=1};if (0..<3).contains(where:{a[i+$0] != out[i+$0]}) {changed+=1;if Double(y)/Double(h)<0.86 || x<65 || x>=w-65{outsideChanges+=1}}}}
 precondition(alphaChanges==0 && outsideChanges==0)
 let name=String(format:"stage-info-card-%02d.png",variant),dest=root.appendingPathComponent("assets/ui/"+name)
 precondition(!FileManager.default.fileExists(atPath:dest.path))
 let image=CGImage(width:w,height:h,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:row,space:original.colorSpace!,bitmapInfo:original.bitmapInfo,provider:CGDataProvider(data:Data(out) as CFData)!,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
 let writer=CGImageDestinationCreateWithURL(dest as CFURL,UTType.png.identifier as CFString,1,nil)!
 CGImageDestinationAddImage(writer,image,nil);precondition(CGImageDestinationFinalize(writer))
 reports.append(["file":name,"width":w,"height":h,"changedPixels":changed,"alphaChanges":alphaChanges,"changesOutsideBottomBand":outsideChanges])
}
try JSONSerialization.data(withJSONObject:reports,options:[.prettyPrinted,.sortedKeys]).write(to:work.appendingPathComponent("verification.json"))
print(reports)
