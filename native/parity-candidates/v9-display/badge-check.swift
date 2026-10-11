import UIKit
import Foundation

@MainActor
func check() throws {
 var checks=0
 for density in [CGFloat(1),2,3] {for depth in [2,3,12,99] {
  let badge=try NativeRegularSixMultiplierGlyph.render(depth:depth,displayScale:density)
  precondition(badge.caption.string=="×\(depth)")
  let attrs=badge.caption.attributes(at:0,effectiveRange:nil),font=attrs[.font] as! UIFont
  precondition(font.fontName=="Arial-BoldMT" && font.pointSize==33)
  precondition(abs((attrs[.strokeWidth] as! NSNumber).doubleValue+100*2.0/33)<1e-10)
  let image=badge.image.cgImage!,width=image.width,height=image.height
  precondition(abs(badge.image.scale-density)<0.001)
  var bytes=[UInt8](repeating:0,count:width*height*4)
  let context=CGContext(data:&bytes,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
  context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
  let fill=NSMutableAttributedString(attributedString:badge.caption)
  fill.removeAttribute(.strokeWidth,range:NSRange(location:0,length:fill.length));fill.removeAttribute(.strokeColor,range:NSRange(location:0,length:fill.length))
  let format=UIGraphicsImageRendererFormat();format.scale=density;format.opaque=false
  let plain=UIGraphicsImageRenderer(size:badge.image.size,format:format).image{_ in fill.draw(at:badge.contentRect.origin)}.cgImage!
  var plainBytes=[UInt8](repeating:0,count:width*height*4)
  let plainContext=CGContext(data:&plainBytes,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
  plainContext.draw(plain,in:CGRect(x:0,y:0,width:width,height:height))
  var white=0,brown=0,edge=0,solidFill=0

  for y in 0..<height {for x in 0..<width {let p=(y*width+x)*4,a=Int(bytes[p+3]);if a>200 {
   if plainBytes[p+3]==255 {precondition(bytes[p]>=254 && bytes[p+1]>=254 && bytes[p+2]>=254,"outline ate original bold fill");solidFill+=1}
   if bytes[p]>230 && bytes[p+1]>230 && bytes[p+2]>230 {white+=1}
   if bytes[p]>100 && bytes[p]<170 && bytes[p+1]<140 && bytes[p+2]<120 {brown+=1}
  };if (x==0 || y==0 || x==width-1 || y==height-1) && a>0 {edge+=1}}}
  precondition(white>50 && brown>30 && edge==0 && solidFill>50,"missing fill/stroke or clipped badge")
  if density==3 && depth<=3 {try badge.image.pngData()!.write(to:URL(fileURLWithPath:"/tmp/native-v9-badge-\(depth).png"))}
  checks+=1
 }}
 print("PASS UIKit badge raster",checks,"font/fill/outline/density/uncapped-depth cases")
}
try MainActor.assumeIsolated {try check()}
