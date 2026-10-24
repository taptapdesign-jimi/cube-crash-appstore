import Foundation
import ImageIO
import CoreGraphics

/// A pixel-backed bitmap crosses existing serial I/O -> MainActor only.
/// ImageIO's cache-immediately hint is insufficient for some original WebP
/// providers: SKTexture can otherwise trigger their first decode on MainActor.
nonisolated struct NativeSelectedFinaleRaster:@unchecked Sendable {
 let path:String
 let image:CGImage
 let bloobSplash:NativeBloobSplashScene?
 let bloobReverse:NativeBloobReverseArt?
 init(path:String,image:CGImage,bloobSplash:NativeBloobSplashScene?=nil,bloobReverse:NativeBloobReverseArt?=nil){self.path=path;self.image=image;self.bloobSplash=bloobSplash;self.bloobReverse=bloobReverse}
 static func decode(root:URL,candidates:[String])->Self? {
  for path in candidates {
   let relative=path.hasPrefix("./") ? String(path.dropFirst(2)):path
   guard !relative.hasPrefix("/"),!relative.split(separator:"/").contains("..") else{continue}
   if relative==NativeBloobReverseArt.path {
    if let recipe=NativeBloobReverseArt.decode(root.appendingPathComponent(relative)),let pixel=NativeBloobReverseArt.readinessPixel() {return Self(path:relative,image:pixel,bloobReverse:recipe)}
    continue
   }
   if relative==NativeBloobArt.splashPath {
    if let scene=NativeBloobSplashScene.decode(root.appendingPathComponent(relative)),let poster=scene.poster() {return Self(path:relative,image:poster,bloobSplash:scene)}
    continue
   }
   if relative==NativeCoconutArt.path {
    if let image=NativeCoconutArt.decode(root.appendingPathComponent(relative)){return Self(path:relative,image:image)}
    continue
   }
   if NativeBloobArt.isSource(relative) {
    if let image=NativeBloobArt.decode(root.appendingPathComponent(relative)) {return Self(path:relative,image:image)}
    continue
   }
   if NativeBloobBallArt.isSource(relative) {
    if let image=NativeBloobBallArt.decode(root.appendingPathComponent(relative)) {return Self(path:relative,image:image)}
    continue
   }
   if NativeCuberoIdleMotion.isSVGSource(relative) {
    if let image=NativeCuberoSVGAtlas.decode(root.appendingPathComponent(relative)) {return Self(path:relative,image:image)}
    continue
   }
   guard let source=CGImageSourceCreateWithURL(root.appendingPathComponent(relative) as CFURL,nil),
         let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),
         let pixels=materialize(image) else{continue}
   return Self(path:relative,image:pixels)
  }
  return nil
 }
 /// Draw on the caller's resource queue, then retain only raw RGBA bytes. The
 /// returned provider has no encoded source or deferred ImageIO decode callback.
 static func materialize(_ image:CGImage)->CGImage? {
  let (rowBytes,rowOverflow)=image.width.multipliedReportingOverflow(by:4)
  let (byteCount,countOverflow)=rowBytes.multipliedReportingOverflow(by:image.height)
  guard image.width>0,image.height>0,!rowOverflow,!countOverflow else{return nil}
  // Keep the original RGB profile; non-RGB source formats use the same sRGB
  // destination expected by the native texture renderer.
  guard let space=image.colorSpace?.model == .rgb ? image.colorSpace:CGColorSpace(name:CGColorSpace.sRGB) else{return nil}
  let info=CGBitmapInfo.byteOrder32Big.rawValue|CGImageAlphaInfo.premultipliedLast.rawValue
  var data=Data(count:byteCount)
  let rendered=data.withUnsafeMutableBytes {bytes -> Bool in
   guard let context=CGContext(data:bytes.baseAddress,width:image.width,height:image.height,
       bitsPerComponent:8,bytesPerRow:rowBytes,space:space,bitmapInfo:info) else{return false}
   context.setBlendMode(.copy)
   context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
   return true
  }
  guard rendered,let provider=CGDataProvider(data:data as CFData) else{return nil}
  return CGImage(width:image.width,height:image.height,bitsPerComponent:8,bitsPerPixel:32,
      bytesPerRow:rowBytes,space:space,bitmapInfo:CGBitmapInfo(rawValue:info),provider:provider,
      decode:nil,shouldInterpolate:image.shouldInterpolate,intent:image.renderingIntent)
 }
}
