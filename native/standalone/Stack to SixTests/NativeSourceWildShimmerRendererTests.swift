import XCTest
import SpriteKit
import WebKit
import UIKit
@testable import Stack_to_Six
@MainActor final class NativeSourceWildShimmerRendererTests:XCTestCase {
 @MainActor private final class OriginalGPU:NSObject,WKNavigationDelegate {
  let web=WKWebView(frame:CGRect(x:0,y:0,width:512,height:512))
  private var ready:CheckedContinuation<Void,Error>?
  func open()async throws {
   let url=try XCTUnwrap(Bundle(for:NativeSourceWildShimmerRendererTests.self).url(forResource:"SourceWildShimmerGPUReference",withExtension:"js"))
   let script=try String(contentsOf:url,encoding:.utf8)
   web.configuration.userContentController.addUserScript(WKUserScript(source:script,injectionTime:.atDocumentEnd,forMainFrameOnly:true))
   web.navigationDelegate=self
   try await withCheckedThrowingContinuation{ready=$0;web.loadHTMLString("<!doctype html><meta charset=utf-8><body></body>",baseURL:nil)}
  }
  func render(_ parameters:[String:Any])async throws->[NSNumber] {
   try await withCheckedThrowingContinuation{continuation in
    web.callAsyncJavaScript("return await window.renderOriginalWildShimmer(p)",arguments:["p":parameters],in:nil,in:.page){result in
     switch result {case .success(let value):
      guard let alpha=value as? [NSNumber] else{continuation.resume(throwing:NSError(domain:"OriginalGPUResult",code:1));return};continuation.resume(returning:alpha)
     case .failure(let error):continuation.resume(throwing:error)}
    }
   }
  }
  func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){ready?.resume();ready=nil}
  func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){ready?.resume(throwing:error);ready=nil}
  func dispose(){web.navigationDelegate=nil;web.stopLoading();web.configuration.userContentController.removeAllUserScripts()}
 }
 func testOriginalArtworkGPUParityAcrossParentSpaceMaskTransforms()async throws {
  let original=OriginalGPU();try await original.open();defer{original.dispose()}
  let textures=NativeBoardTextures(root:NativeTestResources.root);defer{textures.dispose()}
  struct Face:Decodable {let path:String,width:Double,height:Double,anchorY:Double}
  let fixtureURL=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceWildFaceGPUFixtures",withExtension:"json"))
  let faces=try JSONDecoder().decode([Face].self,from:Data(contentsOf:fixtureURL))
  XCTAssertEqual(faces.count,17)
  for face in faces {let path=face.path
   let png=try Data(contentsOf:NativeTestResources.root.appendingPathComponent(path))
   let texture=try XCTUnwrap(textures.texture(path,densityAware:false)),pixels=try XCTUnwrap(textures.sourceRasterPixelSize(for:texture)),logical=try XCTUnwrap(textures.sourceRasterLogicalWidth(for:texture))
   for density in [1,2] {for transform in [(0.0,0.0,0.0),(16.0,-8.0,0.4)] {
    let canvas=256*density
    let expected=try await original.render(["png":png.base64EncodedString(),"resolution":NativeBoardTextures.sourceRasterResolution(path:path),"canvas":canvas,"density":density,"width":face.width,"height":face.height,"anchorY":face.anchorY,"x":transform.0,"y":transform.1,"rotation":transform.2])
    XCTAssertEqual(expected.count,canvas*canvas)
    let view=SKView(frame:CGRect(x:0,y:0,width:canvas,height:canvas)),scene=SKScene(size:CGSize(width:canvas,height:canvas));scene.backgroundColor = .clear;view.allowsTransparency=true;view.presentScene(scene)
    let host=SKNode();host.setScale(CGFloat(density));scene.addChild(host)
    let renderer=try XCTUnwrap(NativeSourceWildShimmerRenderer(texture:texture,size:CGSize(width:face.width,height:face.height),anchor:CGPoint(x:0.5,y:1-face.anchorY),pixelSize:pixels,logicalMaskWidth:logical,cache:textures.sourceWildShimmerGradients))
    renderer.mount(in:host,position:CGPoint(x:transform.0,y:-transform.1),rotation:-transform.2,zPosition:0);renderer.paint(.init(alpha:0.3,x:0,y:0))
    let image=try XCTUnwrap(view.texture(from:host,crop:CGRect(x:-canvas/2,y:-canvas/2,width:canvas,height:canvas))).cgImage()
    var bytes=[UInt8](repeating:0,count:canvas*canvas*4)
    bytes.withUnsafeMutableBytes{raw in
     let ctx=CGContext(data:raw.baseAddress,width:canvas,height:canvas,bitsPerComponent:8,bytesPerRow:canvas*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
     ctx.draw(image,in:CGRect(x:0,y:0,width:canvas,height:canvas))
    }
    var differences=[Int](),flipped=[Int](),active=[Int]()
    for y in 0..<canvas {for x in 0..<canvas {
     let actual=Int(bytes[(y*canvas+x)*4+3]),reference=expected[y*canvas+x].intValue
     differences.append(abs(actual-reference))
     if actual>0 || reference>0 {active.append(abs(actual-reference))}
     flipped.append(abs(Int(bytes[((canvas-1-y)*canvas+x)*4+3])-expected[y*canvas+x].intValue))
    }}
    let mean=Double(differences.reduce(0,+))/Double(differences.count),flipMean=Double(flipped.reduce(0,+))/Double(flipped.count)
    let activeMean=Double(active.reduce(0,+))/Double(max(1,active.count))
    print("ORIGINAL_SHIMMER_GPU path=\(path) density=\(density) transform=\(transform) mean=\(mean) flippedMean=\(flipMean) activeMean=\(activeMean) activePixels=\(active.count) max=\(differences.max()!)")
    XCTAssertGreaterThan(expected.filter{$0.intValue>0}.count,30)
    XCTAssertLessThan(activeMean,1.5,"Compare participating artwork pixels, without dilution from the surrounding empty canvas")
    renderer.dispose();view.presentScene(nil)
   }}
  }
 }
 func testMaskClampMatchesExecutedOriginalTextureMatrixPhysicalPixelCases(){
  let rows:[(CGFloat,CGFloat,CGFloat,SIMD4<Float>)]=[
   (1,1,1,.init(0,0,1,1)),(16,16,8,.init(0,0,1,1)),(128,128,128,.init(0.00390625,0.00390625,0.99609375,0.99609375)),
   (512,512,256,.init(0.0009765625,0.0009765625,0.9990234375,0.9990234375)),
   (1024,1024,512,.init(0.00048828125,0.00048828125,0.99951171875,0.99951171875)),
   (171,128,171,.init(0.002923976629972458,0.00390625,0.9970760345458984,0.99609375))]
  for (w,h,logical,expected) in rows {
   XCTAssertEqual(NativeSourceWildShimmerRenderer.maskClamp(pixelSize:.init(width:w,height:h),logicalWidth:logical),expected)
  }
  XCTAssertNil(NativeSourceWildShimmerRenderer.maskClamp(pixelSize:.zero,logicalWidth:128))
  XCTAssertEqual(NativeBoardTextures.sourceRasterResolution(path:"assets/bee@2x.png"),2)
  XCTAssertEqual(NativeBoardTextures.sourceRasterResolution(path:"assets/bee@3x.png"),3)
  XCTAssertEqual(NativeBoardTextures.sourceRasterResolution(path:"assets/bee.png"),1)
 }
 func testActualGPUHalfTexelClampRemovesMaskBorderButPreservesCenter()throws {
  let view=SKView(frame:.init(x:0,y:0,width:128,height:128)),scene=SKScene(size:.init(width:128,height:128))
  scene.backgroundColor = .clear;view.allowsTransparency=true;view.presentScene(scene);defer{view.presentScene(nil)}
  let cache=NativeSourceWildShimmerGradientCache();defer{cache.dispose()}
  let color:[UInt8]=Array(repeating:[UInt8]([255,0,0,255]),count:32*32).flatMap{$0}
  let texture=SKTexture(data:Data(color),size:.init(width:32,height:32))
  let renderer=try XCTUnwrap(NativeSourceWildShimmerRenderer(texture:texture,size:.init(width:128,height:128),anchor:.init(x:0.5,y:0.5),cache:cache));defer{renderer.dispose()}
  let host=SKNode();scene.addChild(host);renderer.mount(in:host,position:.zero,rotation:0,zPosition:0)
  renderer.paint(NativeSourceWildShimmerMotion.pose(seconds:1.28,width:128,height:128))
  let image=try XCTUnwrap(view.texture(from:host,crop:.init(x:-64,y:-64,width:128,height:128))).cgImage()
  var bytes=[UInt8](repeating:0,count:128*128*4)
  bytes.withUnsafeMutableBytes{raw in
   let ctx=CGContext(data:raw.baseAddress,width:128,height:128,bitsPerComponent:8,bytesPerRow:512,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
   ctx.draw(image,in:.init(x:0,y:0,width:128,height:128))
  }
  func alpha(_ x:Int)->UInt8{bytes[(64*128+x)*4+3]}
  XCTAssertEqual(alpha(0),0);XCTAssertEqual(alpha(127),0)
  XCTAssertGreaterThan(alpha(2),0);XCTAssertEqual(Double(alpha(64)),69,accuracy:2)
 }
 func testActualGradientLeasesDeduplicateReferencedTexturesAndPruneOnlyUnused(){
  let cache=NativeSourceWildShimmerGradientCache()
  let a=cache.acquire(width:256,height:256)!,b=cache.acquire(width:256,height:256)!
  XCTAssertTrue(a.texture === b.texture);XCTAssertEqual(cache.references,2)
  for n in 1...8 {let h=cache.acquire(width:Double(256+n),height:256)!;h.release()}
  XCTAssertEqual(cache.count,4);XCTAssertEqual(cache.references,2)
  a.release();a.release();b.release();XCTAssertEqual(cache.references,0)
  cache.dispose();XCTAssertNil(cache.acquire(width:256,height:256))
 }
 func testActualRendererMountAndDoubleDisposalKeepCapturedArtworkUntouched(){
  let cache=NativeSourceWildShimmerGradientCache(),texture=SKTexture(data:Data([255,255,255,255]),size:.init(width:1,height:1))
  let owner=NativeSourceWildShimmerRenderer(texture:texture,size:.init(width:128,height:128),anchor:.init(x:0.5,y:0.5),cache:cache)!
  let host=SKNode();owner.mount(in:host,position:.init(x:4,y:8),rotation:0.3,zPosition:12)
  XCTAssertTrue(owner.sprite.texture === texture);XCTAssertTrue(owner.sprite.parent === host)
  XCTAssertEqual(owner.sprite.position,.init(x:4,y:8));XCTAssertEqual(owner.sprite.zRotation,0.3,accuracy:1e-6)
  owner.dispose();owner.dispose();XCTAssertNil(owner.sprite.parent);XCTAssertNil(owner.sprite.shader)
  XCTAssertEqual(cache.references,0)
 }
 func testRetiredSceneGradientCannotKeepPaintingOrMountLate(){
  let cache=NativeSourceWildShimmerGradientCache(),texture=SKTexture(data:Data([255,255,255,255]),size:.init(width:1,height:1))
  let a=NativeSourceWildShimmerRenderer(texture:texture,size:.init(width:128,height:128),anchor:.init(x:0.5,y:0.5),cache:cache)!
  let b=NativeSourceWildShimmerRenderer(texture:texture,size:.init(width:128,height:128),anchor:.init(x:0.5,y:0.5),cache:cache)!
  let host=SKNode();a.mount(in:host,position:.zero,rotation:0,zPosition:0)
  cache.dispose();a.paint(.init(alpha:0.3,x:0,y:0));b.mount(in:host,position:.zero,rotation:0,zPosition:0)
  XCTAssertNil(a.sprite.parent);XCTAssertNil(a.sprite.shader);XCTAssertNil(b.sprite.parent);XCTAssertNil(b.sprite.texture)
 }
 func testActualGPUShaderPreservesPixiRedChannelMaskInsteadOfAlphaOnly()throws {
  let view=SKView(frame:.init(x:0,y:0,width:128,height:128)),scene=SKScene(size:.init(width:128,height:128))
  scene.backgroundColor = .clear;view.allowsTransparency=true;view.presentScene(scene)
  defer{view.presentScene(nil)}
  let cache=NativeSourceWildShimmerGradientCache();defer{cache.dispose()}
  func render(_ color:[UInt8])throws->UInt8 {
   let texture=SKTexture(data:Data(color),size:.init(width:1,height:1))
   let owner=try XCTUnwrap(NativeSourceWildShimmerRenderer(texture:texture,size:.init(width:128,height:128),anchor:.init(x:0.5,y:0.5),cache:cache))
   defer{owner.dispose()}
   let host=SKNode();scene.addChild(host);defer{host.removeFromParent()}
   owner.mount(in:host,position:.zero,rotation:0,zPosition:0)
   owner.paint(NativeSourceWildShimmerMotion.pose(seconds:1.28,width:128,height:128))
   let rendered=try XCTUnwrap(view.texture(from:host,crop:.init(x:-64,y:-64,width:128,height:128)))
   let image=rendered.cgImage()
   var bytes=[UInt8](repeating:0,count:128*128*4)
   let ok=bytes.withUnsafeMutableBytes{raw->Bool in
    guard let context=CGContext(data:raw.baseAddress,width:128,height:128,bitsPerComponent:8,bytesPerRow:512,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
    context.draw(image,in:.init(x:0,y:0,width:128,height:128));return true
   }
   XCTAssertTrue(ok);return bytes[(64*128+64)*4+3]
  }
  let red=try render([255,0,0,255]),green=try render([0,255,0,255])
  XCTAssertEqual(green,0,"Pixi mask multiplies sampled red even when artwork alpha is fully opaque")
  let halfRed=try render([128,0,0,128])
  print("SOURCE_SHIMMER_GPU_MASK red=\(red) green=\(green) halfRed=\(halfRed)")
  // Literal original Pixi equation at opacity.3/gradient.9: opaque red.27,
  // premultiplied half-red .9*.3*(128/255)^2. Two8-bit steps allow2levels.
  XCTAssertEqual(Double(red),69,accuracy:2);XCTAssertEqual(Double(halfRed),17,accuracy:2)
 }
}
