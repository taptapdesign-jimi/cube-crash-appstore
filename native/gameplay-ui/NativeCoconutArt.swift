import UIKit
import ImageIO

/// Original Coconut SVG128sample loop. Decode only on the shared selected
/// preparation queue; one18MiB atlas is shared by board and selected preview.
nonisolated enum NativeCoconutArt {
 static let path="assets/shop/coconut/coconut.svg"
 private final class Parser:NSObject,XMLParserDelegate {
  var images:[CGImage]=[]
  func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]) {
   guard name=="image",let href=attributes["href"],let encoded=href.split(separator:",",maxSplits:1).last,let data=Data(base64Encoded:String(encoded)),let source=CGImageSourceCreateWithData(data as CFData,nil),let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary) else{return}
   images.append(image)
  }
 }
 static func decode(_ url:URL)->CGImage? {
  guard let data=try? Data(contentsOf:url),data.count<8_000_000 else{return nil}
  let p=Parser(),xml=XMLParser(data:data);xml.delegate=p;xml.shouldResolveExternalEntities=false
  guard xml.parse(),p.images.count==26,let c=CGContext(data:nil,width:1536,height:3072,bitsPerComponent:8,bytesPerRow:6144,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
  for (i,layers) in NativeCoconutAtlasPlan.frames.enumerated() {
   c.saveGState();c.translateBy(x:CGFloat(i%8*192),y:CGFloat((15-i/8)*192+192));c.scaleBy(x:0.3,y:-0.3)
   c.clip(to:CGRect(x:0,y:0,width:640,height:640))
   for v in layers {
    c.saveGState();c.setAlpha(v[11])
    c.concatenate(CGAffineTransform(a:v[5],b:v[6],c:v[7],d:v[8],tx:v[9],ty:v[10]))
    c.translateBy(x:v[1],y:v[2]+v[4]);c.scaleBy(x:1,y:-1)
    c.draw(p.images[Int(v[0])],in:CGRect(x:0,y:0,width:v[3],height:v[4]));c.restoreGState()
   }
   c.restoreGState()
  }
  return c.makeImage()
 }

}
extension NativeDiceSheet {
 static let coconut=NativeDiceSheet(path:NativeCoconutArt.path,atlas:CGSize(width:1536,height:3072),cell:CGSize(width:192,height:192),columns:8,frameCount:128,cycle:NativeCoconutAtlasPlan.cycle,anchor:CGPoint(x:0.5,y:0.5),displayScale:2.0/3,animateDuringDrag:true)
}
