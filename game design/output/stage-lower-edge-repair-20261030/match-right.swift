import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let work=URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("game design/output/stage-lower-edge-repair-20261030")
let image=CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(work.appendingPathComponent("candidate-01.png") as CFURL,nil)!,0,nil)!
precondition(image.bitsPerPixel==32 && image.alphaInfo == .last)
let data=image.dataProvider!.data!,a=Array(UnsafeBufferPointer(start:CFDataGetBytePtr(data),count:CFDataGetLength(data)))
let w=image.width,h=image.height,row=image.bytesPerRow
var out=a,changed=0,alphaChanged=0,outsideChanged=0
func smooth(_ t:Double)->Double {let u=max(0,min(1,t));return u*u*(3-2*u)}
for y in 0..<Int(Double(h)*0.96) {
 let xs=(0..<w).filter{a[y*row+$0*4+3]>220}
 guard let left=xs.first,let right=xs.last,right-left>w/3 else{continue}
 for d in 0..<48 {
  let x=right-d,sx=left+d
  guard x>w*3/4,sx>=0,sx<w else{continue}
  let i=y*row+x*4,j=y*row+sx*4
  guard a[i+3]>0,a[j+3]>220 else{continue}
  let blend=smooth((48-Double(d))/16)*smooth((Double(x)/Double(w)-0.75)/0.06)*smooth((0.96-Double(y)/Double(h))/0.025)
  for c in 0..<3 {out[i+c]=UInt8((Double(a[i+c])*(1-blend)+Double(a[j+c])*blend).rounded())}
 }
}
for y in 0..<h {for x in 0..<w {let i=y*row+x*4;if out[i+3] != a[i+3]{alphaChanged+=1};if (0..<3).contains(where:{out[i+$0] != a[i+$0]}) {changed+=1;if x<=w*3/4{outsideChanged+=1}}}}
precondition(alphaChanged==0 && outsideChanged==0)
let result=CGImage(width:w,height:h,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:row,space:image.colorSpace!,bitmapInfo:image.bitmapInfo,provider:CGDataProvider(data:Data(out) as CFData)!,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
let writer=CGImageDestinationCreateWithURL(work.appendingPathComponent("candidate-02.png") as CFURL,UTType.png.identifier as CFString,1,nil)!
CGImageDestinationAddImage(writer,result,nil);precondition(CGImageDestinationFinalize(writer))
let report:[String:Any] = ["changedPixels":changed,"changedAlphaPixels":alphaChanged,"changedLeftOrCenterPixels":outsideChanged,"method":"Original left-edge RGB mirrored by silhouette distance into the right-edge strip, inward seam feathered; original alpha retained","dimensions":[w,h],"runtimeIntegration":false]
try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:work.appendingPathComponent("verification-02.json"))
print(report)
