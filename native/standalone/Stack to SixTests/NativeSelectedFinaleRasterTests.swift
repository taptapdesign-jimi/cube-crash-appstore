import XCTest
import ImageIO
import CoreGraphics
@testable import Stack_to_Six
nonisolated final class NativeSelectedFinaleRasterTests:XCTestCase {
 func testOriginalSelectedNativePathsDecodeWithPreferredSourceAndNoConversion()throws {
  #if os(macOS)
  let root=URL(fileURLWithPath:"/Users/user/cube-crash")
  #else
  let root=NativeTestResources.root
  #endif
  for key in ["wild-juice","wild-tnt","flower","barell","laser-gun","mushroom","robo-cube","beach-ball"] {
   let plan=try XCTUnwrap(NativeMeterSelectedWarmupCatalog.plan(special:key,variant:nil))
   for spec in plan.preOpen+plan.committed {
    let raster=try XCTUnwrap(NativeSelectedFinaleRaster.decode(root:root,candidates:spec.candidates),spec.key)
    XCTAssertEqual(raster.path,spec.candidates[0].replacingOccurrences(of:"./",with:""));XCTAssertGreaterThan(raster.image.width,0);XCTAssertGreaterThan(raster.image.height,0)
   }
  }
 }
 func testExplicitSourceFallbackAndHostTraversalRejection()throws {
  #if os(macOS)
  let root=URL(fileURLWithPath:"/Users/user/cube-crash")
  #else
  let root=NativeTestResources.root
  #endif
  let fallback="assets/shop/juice/bubbles pack/bubble1.png"
  let raster=try XCTUnwrap(NativeSelectedFinaleRaster.decode(root:root,candidates:["missing-exact-source@2x.png",fallback]));XCTAssertEqual(raster.path,fallback)
  XCTAssertNil(NativeSelectedFinaleRaster.decode(root:root,candidates:["../AGENTS.md","/etc/hosts","missing.png"]))
 }
 func testOriginalWebPBecomesRawRGBAProviderWithIdenticalRenderedPixels()throws {
  #if os(macOS)
  let root=URL(fileURLWithPath:"/Users/user/cube-crash")
  #else
  let root=NativeTestResources.root
  #endif
  let path="assets/shop/barell/barell-pixi-sheet.webp"
  let encoded=try Data(contentsOf:root.appendingPathComponent(path))
  let source=try XCTUnwrap(CGImageSourceCreateWithData(encoded as CFData,nil))
  let original=try XCTUnwrap(CGImageSourceCreateImageAtIndex(source,0,nil))
  let raster=try XCTUnwrap(NativeSelectedFinaleRaster.decode(root:root,candidates:[path]))
  XCTAssertEqual(raster.image.width,original.width);XCTAssertEqual(raster.image.height,original.height)
  XCTAssertEqual(raster.image.bitsPerPixel,32);XCTAssertEqual(raster.image.bytesPerRow,original.width*4)
  let backing=try XCTUnwrap(raster.image.dataProvider?.data) as Data
  XCTAssertEqual(backing.count,original.width*original.height*4)
  XCTAssertNotEqual(backing,encoded,"The SpriteKit handoff must retain pixels, not an encoded ImageIO provider")
  var reference=Data(count:backing.count)
  let space=try XCTUnwrap(original.colorSpace?.model == .rgb ? original.colorSpace:CGColorSpace(name:CGColorSpace.sRGB))
  try reference.withUnsafeMutableBytes {bytes in
   let context=try XCTUnwrap(CGContext(data:bytes.baseAddress,width:original.width,height:original.height,
       bitsPerComponent:8,bytesPerRow:original.width*4,space:space,
       bitmapInfo:CGBitmapInfo.byteOrder32Big.rawValue|CGImageAlphaInfo.premultipliedLast.rawValue))
   context.setBlendMode(.copy);context.draw(original,in:CGRect(x:0,y:0,width:original.width,height:original.height))
  }
  XCTAssertEqual(backing,reference,"Original geometry, color and premultiplied alpha survive resource preparation")
 }
}
