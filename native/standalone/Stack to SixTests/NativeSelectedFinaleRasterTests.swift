import XCTest
import ImageIO
import CoreGraphics
import UIKit
import SpriteKit
import StackToSixGameplay
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

@MainActor final class NativeSelectedUIKitFinaleArtworkTests:XCTestCase {
 nonisolated private final class DecodeCount:@unchecked Sendable {
  private let lock=NSLock();private var value=0
  func increment(){lock.lock();value+=1;lock.unlock()}
  var count:Int {lock.lock();defer{lock.unlock()};return value}
 }
 func testActualControllerSplashGlyphsBorrowGenerationFontBeforeFirstMerge()throws {
  let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2)])),resourceRoot:NativeTestResources.root)
  game.loadViewIfNeeded();defer{game.dispose()}
  let scene=try XCTUnwrap(game.boardScene),owner=try XCTUnwrap(game.finaleArtworkOwner)
  XCTAssertEqual(owner.artwork.fontDescriptorReadCount,1,"ExtraBold is prepared at generation admission even without a selected variant")
  let expected=owner.artwork.font(size:32,weight:"ExtraBold").fontName
  func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap{child in (child as? UILabel).map{[$0]} ?? labels(child)}}
  for repeatIndex in 0..<2 {
   scene.onTntGlyphClock?("boom-\(repeatIndex)",0,false)
   scene.onSplashGlyphClock?("star","star-\(repeatIndex)",0,false)
   scene.onSplashGlyphClock?("juice","juice-\(repeatIndex)",0,false)
   let fields=game.view.subviews.compactMap{$0 as? NativeSplashGlyphField}
   XCTAssertEqual(fields.count,3)
   XCTAssertEqual(fields.flatMap{labels($0)}.count,17)
   XCTAssertTrue(fields.flatMap{labels($0)}.allSatisfy{$0.font.fontName==expected})
   XCTAssertTrue(game.finaleArtworkOwner === owner)
   XCTAssertEqual(owner.artwork.fontDescriptorReadCount,1,"Actual BOOM/SPARKLE/BUBBLY creation must not reread the font URL")
   scene.onTntGlyphClock?("boom-\(repeatIndex)",1,true)
   scene.onSplashGlyphClock?("star","star-\(repeatIndex)",1,true)
   scene.onSplashGlyphClock?("juice","juice-\(repeatIndex)",1,true)
   XCTAssertFalse(game.view.subviews.contains{$0 is NativeSplashGlyphField})
  }
 }
 func testFinishedBubblyGlyphsStopLayerWritesAndBackwardSeekRestoresMotion()throws {
  let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2)])),resourceRoot:NativeTestResources.root)
  game.loadViewIfNeeded();defer{game.dispose()}
  let scene=try XCTUnwrap(game.boardScene)
  scene.onSplashGlyphClock?("juice","bubbly-retirement",0,false)
  let field=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeSplashGlyphField}.first)
  func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap{child in (child as? UILabel).map{[$0]} ?? labels(child)}}
  let glyphs=labels(field);XCTAssertEqual(glyphs.count,6)
  field.paint(seconds:field.duration)
  XCTAssertTrue(glyphs.allSatisfy{$0.alpha==0})
  let sentinel=CATransform3DMakeTranslation(123,456,789)
  for glyph in glyphs {glyph.layer.transform=sentinel}
  for time in [field.duration+0.1,3.4,5.4] {field.paint(seconds:time)}
  XCTAssertTrue(glyphs.allSatisfy{CATransform3DEqualToTransform($0.layer.transform,sentinel) && $0.alpha==0},"Hidden caption must not keep assigning layer transforms")
  field.paint(seconds:0.75)
  XCTAssertTrue(glyphs.contains{$0.alpha>0})
  XCTAssertTrue(glyphs.allSatisfy{!CATransform3DEqualToTransform($0.layer.transform,sentinel)})
  scene.onSplashGlyphClock?("juice","bubbly-retirement",1,true)
  XCTAssertNil(field.superview)
 }
 func testTrimThenReselectExactRequestCancelsOldQueuedDecodeWithoutStealingNewCallbacks()async throws {
  let queue=DispatchQueue(label:"test.finale-cancel"),gate=DispatchSemaphore(value:0),count=DecodeCount()
  queue.async{gate.wait()}
  let root=NativeTestResources.root,path="assets/shop/bee/bee1.png"
  let artwork=JimiV9Artwork(resourceRoot:root,preparationQueue:queue,prepareRaster:{root,paths in count.increment();return NativeSelectedFinaleRaster.decode(root:root,candidates:paths)})
  artwork.prepareImage(path,densityAware:true){_ in XCTFail("Retired request must not settle a replacement")}
  artwork.retainPreparedImages([])
  let ready=expectation(description:"exact replacement selected request")
  artwork.prepareImage(path,densityAware:true){image in XCTAssertNotNil(image);ready.fulfill()}
  gate.signal();await fulfillment(of:[ready],timeout:15)
  XCTAssertEqual(count.count,1,"Dropped queued family cannot perform raster work")
  XCTAssertEqual(artwork.preparedImageCount,1)
  artwork.retireImagePreparation()
 }
 func testActualControllerIgnoresClearedNonWildVariantMetadataAndSuspensionCancelsSelectedWork()async throws {
  let stale=NativeTile(id:"old",cell:.init(column:0,row:0),value:2,variant:"bee",sourceWildStateCleared:true)
  let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:.init(tiles:[stale])),resourceRoot:NativeTestResources.root)
  game.loadViewIfNeeded();defer{game.dispose()}
  let owner=try XCTUnwrap(game.finaleArtworkOwner)
  XCTAssertTrue(owner.selected.isEmpty);XCTAssertEqual(owner.artwork.preparedImageCount,0)
  let active=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:9,current:{true})
  defer{active.dispose()}
  active.prepare(variant:"bee");active.setSuspended(true)
  try await Task.sleep(for:.milliseconds(100))
  XCTAssertTrue(active.pendingFamilies.isEmpty);XCTAssertTrue(active.selected.isEmpty)
  active.setSuspended(false);active.prepare(variant:"bee")
  try await wait{active.readyFamilies.contains("bee")}
  XCTAssertEqual(active.selected,["bee"])
 }
 func testExactAndDensityAliasesPreserveOriginalScaleInBothOrdersBeforeAndAfterPreparation()async throws {
  let density=min(3,max(1,Int(UIScreen.main.scale.rounded(.up))))
  guard density>1 else{return}
  let base="assets/tile.png",exact="assets/tile@\(density)x.png"
  for exactFirst in [true,false] {
   let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
   defer{artwork.retireImagePreparation()}
   var exactImage:UIImage?,densityImage:UIImage?
   if exactFirst {exactImage=artwork.image(exact);densityImage=artwork.image(base,densityAware:true)}
   else {densityImage=artwork.image(base,densityAware:true);exactImage=artwork.image(exact)}
   let originalExact=try XCTUnwrap(exactImage),originalDensity=try XCTUnwrap(densityImage)
   XCTAssertEqual(originalExact.scale,1);XCTAssertEqual(originalDensity.scale,CGFloat(density))
   XCTAssertEqual(originalExact.size.width,originalDensity.size.width*CGFloat(density),accuracy:1e-6)
   let prepared=expectation(description:"both aliases share materialized backing with distinct logical scales")
   artwork.prepareImage(base,densityAware:true){XCTAssertNotNil($0);prepared.fulfill()}
   await fulfillment(of:[prepared],timeout:15)
   XCTAssertEqual(try XCTUnwrap(artwork.image(exact)).scale,1)
   XCTAssertEqual(try XCTUnwrap(artwork.image(base,densityAware:true)).scale,CGFloat(density))
   XCTAssertEqual(try XCTUnwrap(artwork.image(exact)).size,originalExact.size)
   XCTAssertEqual(try XCTUnwrap(artwork.image(base,densityAware:true)).size,originalDensity.size)
   XCTAssertEqual(artwork.imageFileLoadCount,1,"Separate logical aliases must share one original file load")
  }
 }
 private func wait(_ predicate:()->Bool)async throws {
  let end=Date().addingTimeInterval(15)
  while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(10))}
  XCTAssertTrue(predicate())
 }
 func testActualControllerSelectedBeeUsesSamePreparedBitmapsForReadinessAndRepeatedFinales()async throws {
  let state=NativeBoardState(tiles:[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee"),.init(id:"a",cell:.init(column:1,row:0),value:2)])
  let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
  game.loadViewIfNeeded();defer{game.dispose()}
  let owner=try XCTUnwrap(game.finaleArtworkOwner)
  try await wait{owner.readyFamilies.contains("bee")}
  XCTAssertEqual(owner.selected,["bee"]);XCTAssertEqual(owner.artwork.imageFileLoadCount,0)
  let prepared=owner.artwork.preparedImageCount
  XCTAssertEqual(prepared,12)
  let scene=try XCTUnwrap(game.boardScene)
  XCTAssertTrue(scene.authoredFinalePresentationReady?("bee")==true)
  for _ in 0..<2 {
   XCTAssertTrue(scene.onAuthoredFinale?("bee",CGPoint(x:195,y:422),state.generation,{})==true)
   XCTAssertTrue(game.finaleArtworkOwner === owner)
   XCTAssertEqual(owner.artwork.imageFileLoadCount,0)
   XCTAssertEqual(owner.artwork.preparedImageCount,prepared)
  }
 }
 func testEverySelectedFamilyConstructorReusesPreparedOriginalsWithoutAnotherMainFileLoad()async throws {
  for variant in NativeSpecialDiceRegistry.variants.keys.sorted() {
   let owner=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:7,current:{true})
   defer{owner.dispose()};owner.prepare(variant:variant);owner.prepare(variant:variant)
   try await wait{owner.readyFamilies.contains(variant)}
   XCTAssertEqual(owner.selected,[variant]);XCTAssertEqual(owner.artwork.imageFileLoadCount,0)
   let artwork=owner.artwork,size=CGSize(width:390,height:844),origin=CGPoint(x:195,y:422)
   let presentation:NativeFinitePresentation?
   switch variant {
   case "bloob":presentation=NativeBloobFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "bee":presentation=NativeBeeFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,origin:origin,preparedArtwork:artwork)
   case "honey":presentation=NativeHoneyFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "bottle":presentation=NativeBottleFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "kanta":presentation=NativeKantaFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "cubero":presentation=NativeCuberoFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "mushroom":presentation=NativeMushroomFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "robo-cube":presentation=NativeRoboFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "coconut","flower","barell":presentation=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:variant=="coconut" ? .coconut:variant=="flower" ? .flower:.barell,viewport:size,preparedArtwork:artwork)
   case "beach-ball":presentation=NativeBeachBallPresentation(resourceRoot:NativeTestResources.root,viewport:size,preparedArtwork:artwork)
   case "spaceship":presentation=NativeSpaceshipFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,origin:origin,generation:7,preparedArtwork:artwork)
   case "laser-gun":
    let resources=NativeLaserGunResources(resourceRoot:NativeTestResources.root,preparedArtwork:artwork)
    XCTAssertTrue(resources.assetReady)
    presentation=NativeLaserGunFinalePresentation(resourceRoot:NativeTestResources.root,viewport:size,origin:origin,generation:7,preparedArtwork:artwork)
   default:
    let fish=NativeFishFinalePresentation(resourceRoot:NativeTestResources.root,origin:origin,viewport:size,preparedArtwork:artwork)
    fish.dispose();presentation=nil
   }
   XCTAssertEqual(artwork.imageFileLoadCount,0,variant+" constructor must borrow the prepared bitmap owner")
   presentation?.dispose()
  }
 }
 func testColdFallbackStaysImmediateThenPreparationReplacesEncodedCacheAndRetirementRejectsLateWork()async throws {
  let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root),path="assets/shop/bee/bee1.png"
  let cold=try XCTUnwrap(artwork.image(path,densityAware:true))
  XCTAssertEqual(artwork.imageFileLoadCount,1)
  let ready=expectation(description:"pixel-backed preparation after genuine cold fallback")
  artwork.prepareImage(path,densityAware:true){image in XCTAssertNotNil(image);ready.fulfill()}
  await fulfillment(of:[ready],timeout:15)
  let prepared=try XCTUnwrap(artwork.image(path,densityAware:true))
  XCTAssertFalse(cold === prepared);XCTAssertEqual(cold.size,prepared.size);XCTAssertEqual(cold.scale,prepared.scale)
  XCTAssertEqual(artwork.preparedImageCount,1);XCTAssertEqual(artwork.imageFileLoadCount,1)
  let owner=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:8,current:{true})
  owner.prepare(variant:"bee");owner.dispose()
  try await Task.sleep(for:.milliseconds(100))
  XCTAssertTrue(owner.readyFamilies.isEmpty);XCTAssertTrue(owner.pendingFamilies.isEmpty);XCTAssertEqual(owner.artwork.preparedImageCount,0)
 }
 func testActualControllerGenerationReplacementAndLiveFamilyTrimDoNotRetainOldCaches()async throws {
  let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee")],generation:1))
  let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root);game.loadViewIfNeeded();defer{game.dispose()}
  let previous=try XCTUnwrap(game.finaleArtworkOwner)
  try await wait{previous.readyFamilies.contains("bee")}
  previous.retain(variants:[]);XCTAssertTrue(previous.selected.isEmpty)
  engine.restart(state:.init(tiles:[.init(id:"honey",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"honey")],generation:2))
  game.refreshFromEngine()
  let next=try XCTUnwrap(game.finaleArtworkOwner)
  XCTAssertFalse(next === previous);XCTAssertEqual(next.generation,2)
  try await wait{next.readyFamilies.contains("honey")}
  XCTAssertEqual(next.selected,["honey"]);XCTAssertTrue(previous.pendingFamilies.isEmpty)
 }
}

@MainActor final class NativeQueuedArtworkLifetimeTests:XCTestCase {
 private nonisolated final class DecodeCount:@unchecked Sendable {
  private let lock=NSLock();private var value=0
  var count:Int {lock.lock();defer{lock.unlock()};return value}
  func record(){lock.lock();value+=1;lock.unlock()}
 }
 func testDisposedQueuedRasterSkipsDecoderAndReleasesTextureOwner() {
  var jobs:[@Sendable ()->Void]=[]
  let decodes=DecodeCount();var completions=0
  var textures:NativeBoardTextures?=NativeBoardTextures(root:NativeTestResources.root,
   preparationQueue:{jobs.append($0)},selectedRasterDecoder:{_,_ in decodes.record();return nil})
  weak var released=textures
  textures?.prepareSelectedFinaleAsset(.init(["assets/tile.png"])) {texture in XCTAssertNil(texture);completions+=1}
  XCTAssertEqual(jobs.count,1)
  textures?.dispose();textures=nil
  XCTAssertNil(released,"A retired queued job must not retain the texture owner")
  XCTAssertEqual(completions,1)
  jobs.removeFirst()()
  XCTAssertEqual(decodes.count,0,"Retirement must reject work before expensive decoding")
  XCTAssertEqual(completions,1)
 }
 func testInvalidatedQueuedRasterSkipsOldDecodeAndAdmitsReplacementGeneration() async {
  var jobs:[@Sendable ()->Void]=[]
  let decodes=DecodeCount();var oldCompletions=0
  let textures=NativeBoardTextures(root:NativeTestResources.root,
   preparationQueue:{jobs.append($0)},selectedRasterDecoder:{_,_ in decodes.record();return nil})
  defer{textures.dispose()}
  textures.prepareSelectedFinaleAsset(.init(["assets/tile.png"])) {_ in oldCompletions+=1}
  textures.invalidatePendingPreparation()
  XCTAssertEqual(oldCompletions,1)
  let replacement=expectation(description:"Replacement generation decoder settles")
  textures.prepareSelectedFinaleAsset(.init(["assets/tile.png"])) {texture in XCTAssertNil(texture);replacement.fulfill()}
  XCTAssertEqual(jobs.count,2)
  jobs.removeFirst()();XCTAssertEqual(decodes.count,0)
  jobs.removeFirst()();XCTAssertEqual(decodes.count,1)
  await fulfillment(of:[replacement],timeout:2)
  XCTAssertEqual(oldCompletions,1)
 }
}

nonisolated final class NativeSheetFrameAlphaBoundsTests:XCTestCase {
 func testSingleAtlasTraversalMatchesIndependentCroppedFrameMeasurements()throws {
  let width=8,height=8,cell=CGSize(width:4,height:4)
  var pixels=[UInt8](repeating:0,count:width*height*4)
  // Deliberately different silhouettes in every atlas cell, including edges.
  for (x,y) in [(0,0),(2,2),(7,0),(4,3),(1,4),(1,7),(4,4),(7,7)] {pixels[(y*width+x)*4+3]=255}
  pixels[(7*width+1)*4+3]=9 // Included faint edge.
  pixels[(7*width+3)*4+3]=8 // Excluded edge at the exact threshold.
  let data=Data(pixels)
  let image=try XCTUnwrap(CGImage(width:width,height:height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:width*4,
   space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedLast.rawValue),
   provider:try XCTUnwrap(CGDataProvider(data:data as CFData)),decode:nil,shouldInterpolate:false,intent:.defaultIntent))
  let frames=try XCTUnwrap(NativeArtworkAlphaBounds.measureFrames(image,cell:cell,columns:2,frameCount:4))
  XCTAssertEqual(frames.count,4)
  for index in 0..<4 {
   let cropped=try XCTUnwrap(image.cropping(to:CGRect(x:(index%2)*4,y:(index/2)*4,width:4,height:4)))
   XCTAssertEqual(frames[index],NativeArtworkAlphaBounds.measure(UIImage(cgImage:cropped)),"Frame \(index) must keep source top-down normalized bounds")
  }
  XCTAssertNil(NativeArtworkAlphaBounds.measureFrames(image,cell:cell,columns:2,frameCount:4,current:{false}))
 }
}

@MainActor final class NativeSelectedAnimatedBodyBoundsTests:XCTestCase {
 func testCachedSheetUpgradesSelectedMetadataWithoutReplacingFrameTexturesAndPurgesIt() async throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root)
  defer{textures.dispose()}
  var initial:[SKTexture]=[],selected:[SKTexture]=[]
  let first=expectation(description:"Original Ball sheet")
  textures.prepare(.ball){initial=$0;first.fulfill()}
  await fulfillment(of:[first],timeout:15)
  XCTAssertEqual(initial.count,84)
  XCTAssertNil(textures.frameSheetBodyBounds(.ball,frame:0),"Default board preparation must not collect selected-only metadata")
  let legacyBounds=textures.firstSheetBodyBounds(.ball)
  let upgrade=expectation(description:"Selected per-frame metadata")
  textures.prepare(.ball,includeFrameBodyBounds:true){selected=$0;upgrade.fulfill()}
  await fulfillment(of:[upgrade],timeout:15)
  XCTAssertEqual(selected.count,84)
  for index in initial.indices {XCTAssertTrue(initial[index] === selected[index])}
  XCTAssertEqual(textures.firstSheetBodyBounds(.ball),legacyBounds,"Shadow metadata cannot change modal sizing")
  XCTAssertNotNil(textures.frameSheetBodyBounds(.ball,frame:83))
  let bottoms=(0..<84).compactMap{textures.frameSheetBodyBounds(.ball,frame:$0)?.maxY}
  XCTAssertGreaterThan(Set(bottoms).count,1,"Internal jump frames must have different silhouette positions")
  let union=try XCTUnwrap(textures.animatedSheetBodyBounds(.ball)),authored=NativeDiceSheet.ballMotionBounds
  XCTAssertEqual(union.minX,authored.minX,accuracy:1e-7);XCTAssertEqual(union.maxX,authored.maxX,accuracy:1e-7)
  XCTAssertEqual(union.minY,authored.minY,accuracy:1e-7);XCTAssertEqual(union.maxY,authored.maxY,accuracy:1e-7)
  textures.purgeUnused(retaining:[])
  XCTAssertNil(textures.frameSheetBodyBounds(.ball,frame:0))
 }
 func testKantaBodyBoundsFollowCanMotionAndExcludeOtherChildren()throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root)
  let idle=NativeKantaDiceIdle(textures:textures,size:CGSize(width:96,height:128),random:{0.5})
  defer{idle.dispose();textures.dispose()}
  let initial=try XCTUnwrap(idle.bodyBounds)
  let effect=SKSpriteNode(color:.cyan,size:CGSize(width:900,height:900));effect.position=CGPoint(x:1000,y:1000);idle.addChild(effect)
  XCTAssertEqual(idle.bodyBounds,initial,"Non-body effects cannot resize a collection shadow")
  for _ in 0..<5 {idle.tick(0.1,globalX:0,viewportCenter:100)}
  XCTAssertNotEqual(try XCTUnwrap(idle.bodyBounds),initial,"Actual front/rear can transforms must reach shadow geometry")
  idle.dispose();XCTAssertNil(idle.bodyBounds)
 }
 func testAnimatedBodyBoundsProjectsAllFourRotatedCorners()throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root)
  let node=NativeDiceNode(id:"rotated-preview",value:3,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  defer{node.dispose();textures.dispose()}
  node.visual.zRotation = .pi/4
  let bounds=node.collectionAnimatedBodyBounds(normalizedBounds:CGRect(x:0,y:0,width:1,height:1))
  XCTAssertEqual(bounds.width,128*sqrt(2),accuracy:0.001)
  XCTAssertEqual(bounds.height,128*sqrt(2),accuracy:0.001)
 }
}
