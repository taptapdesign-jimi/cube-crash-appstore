import XCTest
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
}
