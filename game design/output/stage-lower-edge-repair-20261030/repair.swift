import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let work=URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("game design/output/stage-lower-edge-repair-20261030")
func load(_ name:String)->CGImage {CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(work.appendingPathComponent(name) as CFURL,nil)!,0,nil)!}
func bytes(_ i:CGImage)->[UInt8]{precondition(i.bitsPerPixel==32 && i.alphaInfo == .last);let d=i.dataProvider!.data!;return Array(UnsafeBufferPointer(start:CFDataGetBytePtr(d),count:CFDataGetLength(d)))}
let source=load("original.png"),paint=load("generated-repair.png"),a=bytes(source),p=bytes(paint)
let w=source.width,h=source.height,row=source.bytesPerRow
var out=a,changed=0,alphaChanges=0,outsideChanges=0
func edge(_ b:[UInt8],_ row:Int,_ w:Int,_ y:Int,_ left:Bool)->Int {var x=w/2;while x>0 && x<w-1 && b[y*row+x*4+3]>220{x += left ? -1:1};return x+(left ? 1:-1)}
func smooth(_ x:Double)->Double{let t=max(0,min(1,x));return t*t*(3-2*t)}
for y in 0..<h {
 let fy=Double(y)/Double(h)
 guard fy>0.72 && fy<0.965 else{continue}
 let vertical=smooth((fy-0.72)/0.045)*smooth((0.965-fy)/0.035)
 let py=min(paint.height-1,Int(fy*Double(paint.height)))
 for left in [true,false] {
  let old=edge(a,row,w,y,left),new=edge(p,paint.bytesPerRow,paint.width,py,left)
  for d in 0..<48 {
   let x=old+(left ? d:-d)
   guard x>=0 && x<w && (left ? x<w/6 : x>=w*5/6) else{continue}
   let i=y*row+x*4;guard a[i+3]>0 else{continue}
   let shift=Int(Double(d)*Double(paint.width)/Double(w))
   let px=max(0,min(paint.width-1,new+(left ? shift:-shift))),j=py*paint.bytesPerRow+px*4
   guard p[j+3]>220 else{continue}
   let blend=vertical*smooth((48-Double(d))/16)
   for c in 0..<3 {out[i+c]=UInt8((Double(a[i+c])*(1-blend)+Double(p[j+c])*blend).rounded())}
  }
 }
}
for y in 0..<h {for x in 0..<w {let i=y*row+x*4;if out[i+3] != a[i+3]{alphaChanges+=1};if (0..<3).contains(where:{out[i+$0] != a[i+$0]}) {changed+=1;if Double(y)/Double(h)<=0.72 || Double(y)/Double(h)>=0.965 || (x>=w/4 && x<w*3/4){outsideChanges+=1}}}}
precondition(alphaChanges==0 && outsideChanges==0)
let image=CGImage(width:w,height:h,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:row,space:source.colorSpace!,bitmapInfo:source.bitmapInfo,provider:CGDataProvider(data:Data(out) as CFData)!,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
let writer=CGImageDestinationCreateWithURL(work.appendingPathComponent("candidate-01.png") as CFURL,UTType.png.identifier as CFString,1,nil)!
CGImageDestinationAddImage(writer,image,nil);precondition(CGImageDestinationFinalize(writer))
let report:[String:Any] = ["width":w,"height":h,"changedPixels":changed,"changedAlphaPixels":alphaChanges,"changedPixelsOutsideLowerSideBands":outsideChanges,"method":"ImageGen repair RGB aligned row-by-row to original sides, exact original alpha and untouched remainder","runtimeIntegration":false]
try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:work.appendingPathComponent("verification.json"))
print(String(data:try JSONSerialization.data(withJSONObject:report,options:.sortedKeys),encoding:.utf8)!)
