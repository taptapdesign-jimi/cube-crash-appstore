import XCTest
import SpriteKit
import Metal
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

nonisolated final class NativeSourceMagnetPhysicalBindingTests:XCTestCase {
 @MainActor private func fixture(value:Int=0,locked:Bool=true)throws->(NativeBoardTextures,SKNode,NativeDiceNode,NativeSourceAnimationClockService,NativeSourceOuterTimelineAdapter){
  let textures=NativeBoardTextures(root:try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")))
  for path in ["assets/tile.png","assets/shadow.png"]+NativeRegularStackLayout.Skin.allCases.map({String($0.rawValue.dropFirst(2))}){XCTAssertNotNil(textures.texture(path,densityAware:false))}
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  let canvas=SKNode(),node=NativeDiceNode(id:"a",value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures)
  let adapter=NativeSourceOuterTimelineAdapter(service:service);canvas.addChild(node)
  XCTAssertTrue(node.prepareSourceInitialHolder(rotation:0,generation:1))
  node.update(value:value,kind:"regular",variant:nil,depth:1,locked:locked)
  node.installSourceOuterDriver(adapter,generation:1,geometryScale:1)
  return(textures,canvas,node,service,adapter)
 }
 @MainActor func testNativeFreshFaceRenderedStoryboardPreservesGrowthAfterDelayedFirstDelivery()throws {
  let (textures,canvas,node,service,adapter)=try fixture()
  let device=try XCTUnwrap(MTLCreateSystemDefaultDevice()),queue=try XCTUnwrap(device.makeCommandQueue())
  let side=192,height=220,scene=SKScene(size:.init(width:CGFloat(side),height:CGFloat(height)))
  scene.scaleMode = .fill;scene.anchorPoint = .zero;scene.backgroundColor=UIColor(red:0.96,green:0.93,blue:0.88,alpha:1)
  scene.addChild(canvas);node.position=CGPoint(x:CGFloat(side)/2,y:CGFloat(height)/2)
  XCTAssertTrue(node.openSourceAppSpawnHolder(1,service:service,random:{0.5},current:{node.parent === canvas},beforeSetValue:{true},onCancelled:{XCTFail("Storyboard face must remain current")}))
  service.deliver(wallMilliseconds:0)
  service.deliver(wallMilliseconds:16)
  let skin=try XCTUnwrap(node.sourcePaintedNumbersTexture)
  XCTAssertEqual(Double(skin.size().width)*node.sourceBaseScaleX,128,accuracy:1e-6)
  XCTAssertEqual(Double(skin.size().height)*node.sourceBaseScaleY,128,accuracy:1e-6)
  XCTAssertEqual(node.visual.xScale,1);XCTAssertEqual(node.visual.yScale,1)
  XCTAssertEqual(node.sourcePipNodes.count,1)
  let faceSprite=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === skin})
  let renderer=SKRenderer(device:device);renderer.scene=scene;renderer.ignoresSiblingOrder=false
  defer{renderer.scene=nil;node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:side,height:height,mipmapped:false)
  descriptor.usage=[.renderTarget,.shaderRead];descriptor.storageMode = .shared
  let target=try XCTUnwrap(device.makeTexture(descriptor:descriptor))
  var images:[UIImage]=[],captions:[String]=[],scales:[Double]=[],renderTime=0.0
  func capture(_ caption:String)throws {
   let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=target
   pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store
   pass.colorAttachments[0].clearColor=MTLClearColorMake(0.96,0.93,0.88,1)
   let command=try XCTUnwrap(queue.makeCommandBuffer())
   renderTime+=1.0/60;renderer.update(atTime:renderTime)
   XCTAssertEqual(scene.size,CGSize(width:CGFloat(side),height:CGFloat(height)))
   XCTAssertEqual(scene.scaleMode,.fill,"Standalone SKRenderer must use the same density-independent projection as production")
   XCTAssertEqual(canvas.position,.zero);XCTAssertEqual(canvas.xScale,1);XCTAssertEqual(canvas.yScale,1)
   XCTAssertEqual(node.position,CGPoint(x:CGFloat(side)/2,y:CGFloat(height)/2))
   XCTAssertEqual(faceSprite.frame.width,128,accuracy:1e-6);XCTAssertEqual(faceSprite.frame.height,128,accuracy:1e-6)
   XCTAssertEqual(node.visual.xScale,1);XCTAssertEqual(node.visual.yScale,1)
   print("FRESH_FACE_POSE \(caption) scene=\(scene.size) node=\(node.position) scale=\(node.sourceLocalScale) accumulated=\(node.calculateAccumulatedFrame()) face=\(faceSprite.frame) visual=\(node.visual.position)")
   renderer.render(withViewport:CGRect(x:0,y:0,width:CGFloat(side),height:CGFloat(height)),commandBuffer:command,renderPassDescriptor:pass)
   command.commit();command.waitUntilCompleted() // Independent test renderer, one submission at a time.
   XCTAssertEqual(command.status,.completed)
   var pixels=[UInt8](repeating:0,count:side*height*4)
   pixels.withUnsafeMutableBytes{target.getBytes($0.baseAddress!,bytesPerRow:side*4,from:MTLRegionMake2D(0,0,side,height),mipmapLevel:0)}
   let provider=try XCTUnwrap(CGDataProvider(data:Data(pixels) as CFData))
   let bitmap=CGBitmapInfo.byteOrder32Little.union(CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedFirst.rawValue))
   let cg=try XCTUnwrap(CGImage(width:side,height:height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:side*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:bitmap,provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent))
   images.append(UIImage(cgImage:cg));captions.append(caption);scales.append(Double(node.sourceLocalScale.x))
  }
  node.prepareSourceFreshFaceEntry();try capture("Pending: hidden")
  var finished=0
  let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{node.parent === canvas},readRotation:{0},paintScale:{node.paintSourceOuterScale(.init(x:$0,y:$0))},paintRotation:{node.dragInnerTilt=CGFloat($0)},ensureFullOpacity:{node.ensureSourceAppSpawnFullOpacity()},random:{0.5},acquireFrames:{{}},finished:{_ in finished+=1;node.unbindSourceAppSpawnInterruption(id:"storyboard")}),nativeFreshFace:true)
  XCTAssertTrue(node.bindSourceAppSpawnInterruption(id:"storyboard",pickup:{owner.removeChildrenForPickup()},interrupted:{owner.interrupt()}));XCTAssertTrue(owner.start())
  for index in 0...36 {
   service.deliver(wallMilliseconds:500+Double(index)*1000/60)
   if [0,1,2,4,7,10,11,18,25,36].contains(index){try capture(index==0 ? "Late first: hidden":"+\(Int(Double(index)*1000/60)) ms")}
  }
  XCTAssertEqual(scales[0],0);XCTAssertEqual(scales[1],0)
  XCTAssertGreaterThan(scales[2],0);XCTAssertLessThan(scales[2],0.70)
  XCTAssertLessThan(scales[2],scales[3]);XCTAssertLessThan(scales[3],scales[4])
  XCTAssertGreaterThan(scales.max() ?? 0,1.04);XCTAssertEqual(scales.last ?? 0,1,accuracy:1e-6);XCTAssertEqual(finished,1)
  let format=UIGraphicsImageRendererFormat();format.scale=1
  let storyboard=UIGraphicsImageRenderer(size:.init(width:CGFloat(side*images.count),height:CGFloat(height+28)),format:format).image{context in
   UIColor(red:0.96,green:0.93,blue:0.88,alpha:1).setFill()
   context.fill(CGRect(x:0,y:0,width:CGFloat(side*images.count),height:CGFloat(height+28)))
   for (index,image) in images.enumerated(){
    image.draw(at:CGPoint(x:CGFloat(index*side),y:28))
    (captions[index]+String(format:" / %.2f",scales[index]) as NSString).draw(at:CGPoint(x:CGFloat(index*side+5),y:5),withAttributes:[.font:UIFont.systemFont(ofSize:11),.foregroundColor:UIColor.black])
   }
  }
  let url=URL(fileURLWithPath:NSTemporaryDirectory()).appendingPathComponent("native-fresh-face-entry-storyboard.png")
  try XCTUnwrap(storyboard.pngData()).write(to:url)
  let attachment=XCTAttachment(image:storyboard);attachment.name="native-fresh-face-entry-storyboard";attachment.lifetime = .keepAlways;add(attachment)
  print("FRESH_FACE_STORYBOARD \(url.path)")
 }
 @MainActor func testNewFaceEnterDoesNotResizeExistingNeighbour()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:3,locked:false)
  let neighbour=NativeDiceNode(id:"neighbour",value:4,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  canvas.addChild(neighbour)
  defer{node.dispose();neighbour.dispose();adapter.dispose();textures.dispose();service.dispose()}
  let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{node.parent === canvas},readRotation:{0},paintScale:{node.paintSourceOuterScale(.init(x:$0,y:$0))},paintRotation:{node.dragInnerTilt=CGFloat($0)},ensureFullOpacity:{node.ensureSourceAppSpawnFullOpacity()},random:{0.5},acquireFrames:{{}},finished:{_ in node.unbindSourceAppSpawnInterruption(id:"new-entry")}),initialScale:NativeSourceAppSpawnBounceOwner.nativeEntryScale,nativeFreshFace:true)
  XCTAssertTrue(node.bindSourceAppSpawnInterruption(id:"new-entry",pickup:{},interrupted:{}))
  XCTAssertTrue(owner.start());XCTAssertEqual(node.sourceLocalScale.x,0,accuracy:1e-6)
  for wall in stride(from:0.0,through:600,by:5) {
   service.deliver(wallMilliseconds:wall)
   let before=node.sourceLocalScale
   XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:false,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{true},current:{true}))
   XCTAssertEqual(node.sourceLocalScale.x,before.x,accuracy:1e-6)
   XCTAssertEqual(neighbour.xScale,1);XCTAssertEqual(neighbour.yScale,1)
   XCTAssertEqual(neighbour.visual.xScale,1);XCTAssertEqual(neighbour.visual.yScale,1)
  }
  XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6)
  node.paintSourceOuterScale(.init(x:0.7,y:0.7))
  XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:false,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{true},current:{true}))
  XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6,"After genuine completion repair must recover a stale small pose")
 }
 @MainActor func testPendingFreshFaceProtectsZeroFromRepairAndRetiresByExactIdentity()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:1,locked:false)
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  node.prepareSourceFreshFaceEntry()
  let first=try XCTUnwrap(node.sourcePendingFreshFaceEntryID)
  XCTAssertTrue(node.sourceAppSpawnOwnsOuterScale)
  XCTAssertEqual(node.sourceLocalScale.x,0)
  XCTAssertTrue(node.repairSourceRegularBoardVisuals(outerTransformOwned:false,activeDrag:false,innerImpactOwned:false,wildDropping:false,retireUnownedInnerTransform:{true},current:{true}))
  XCTAssertEqual(node.sourceLocalScale.x,0,"A safety sweep cannot reveal a pending fresh face")
  let model=NativeTile(id:"a",cell:.init(column:0,row:0),value:1)
  let markers=try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil))
  XCTAssertFalse(markers.isBeingSpawned);XCTAssertFalse(markers.hasSpawnTween)
  node.prepareSourceFreshFaceEntry()
  let second=try XCTUnwrap(node.sourcePendingFreshFaceEntryID)
  node.retireSourcePendingFreshFaceEntry(expected:first)
  XCTAssertEqual(node.sourcePendingFreshFaceEntryID,second)
  XCTAssertEqual(node.sourceLocalScale.x,0)
  node.retireSourcePendingFreshFaceEntry(expected:second)
  XCTAssertFalse(node.sourceAppSpawnOwnsOuterScale);XCTAssertEqual(node.sourceLocalScale.x,1)
 }
 @MainActor func testPendingFreshFaceTransfersToBounceAndCancellationRestoresFullSize()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:1,locked:false)
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  node.prepareSourceFreshFaceEntry()
  XCTAssertTrue(node.bindSourceAppSpawnInterruption(id:"entry",pickup:{},interrupted:{}))
  XCTAssertNil(node.sourcePendingFreshFaceEntryID)
  XCTAssertTrue(node.sourceAppSpawnOwnsOuterScale)
  node.unbindSourceAppSpawnInterruption(id:"stale")
  XCTAssertEqual(node.sourceLocalScale.x,0)
  node.unbindSourceAppSpawnInterruption(id:"entry")
  XCTAssertFalse(node.sourceAppSpawnOwnsOuterScale);XCTAssertEqual(node.sourceLocalScale.x,1)
 }
 @MainActor func testFreshFaceRenderSerialFollowsActualSceneUpdatesAndRetiresOnDetach()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:1,locked:false)
  let scene=NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[])),resourceRoot:try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")),size:.init(width:390,height:844))
  defer{node.dispose();scene.dispose();adapter.dispose();textures.dispose();service.dispose()}
  XCTAssertNil(node.sourceFreshFaceRenderSerial)
  scene.addChild(canvas)
  XCTAssertEqual(node.sourceFreshFaceRenderSerial,0)
  scene.update(1)
  XCTAssertEqual(node.sourceFreshFaceRenderSerial,1)
  service.deliver(wallMilliseconds:100)
  service.deliver(wallMilliseconds:200)
  XCTAssertEqual(node.sourceFreshFaceRenderSerial,1,"Source callbacks do not fabricate renderer progress")
  scene.update(1.016)
  XCTAssertEqual(node.sourceFreshFaceRenderSerial,2)
  node.removeFromParent()
  XCTAssertNil(node.sourceFreshFaceRenderSerial)
 }
 @MainActor func testPhysicalSnapshotReadsActualObjectNotStoredCorePaintOrActiveFilter()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:5,locked:true)
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  let model=NativeTile(id:"a",cell:.init(column:0,row:0),value:1,locked:false,alpha:1)
  node.alpha=0.2;node.isHidden=false;node.sourceEventMode="none"
  let t=try XCTUnwrap(node.captureSourceMagnetPhysical(model:model,runtime:nil,lastMerge:false))
  XCTAssertEqual(t.value,5);XCTAssertTrue(t.locked);XCTAssertEqual(t.eventMode,"none")
  XCTAssertEqual(t.alpha,Double(Float(0.2)),accuracy:0,"actual SKNode alpha storage is Float32")
  XCTAssertTrue(NativeSourceMagnetPhysicalState.active(t),"Source Magnet includes locked positive dice")
  XCTAssertFalse(NativeSourceMagnetPhysicalState.playable(t),"postMagnet excludes locked ordinary dice")
  node.isHidden=true
  XCTAssertFalse(try XCTUnwrap(node.captureSourceMagnetPhysical(model:model,runtime:nil,lastMerge:false)).visible)
  node.dispose();XCTAssertNil(node.captureSourceMagnetPhysical(model:model,runtime:nil,lastMerge:false))
 }
 @MainActor func testUnmappedRawNodeCannotDeclareMissingSourceMarkersFalse()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:2,locked:false)
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  let raw=NativeDiceNode(id:"raw",value:2,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
  canvas.addChild(raw);raw.installSourceOuterDriver(adapter,generation:1,geometryScale:1)
  defer{raw.dispose()}
  let model=NativeTile(id:"raw",cell:.init(column:1,row:0),value:2)
  XCTAssertFalse(raw.sourcePhysicalMarkersCovered)
  XCTAssertNil(raw.captureSourceSaveTileMarkers(model:model,runtime:nil))
  XCTAssertNil(raw.captureSourceMagnetPhysical(model:model,runtime:nil,lastMerge:false))
  XCTAssertFalse(raw.beginSourceLockedSpawnMarker(id:"invented"))
  XCTAssertTrue(node.sourcePhysicalMarkersCovered)
 }
 @MainActor func testActualLockedSlotFlagHasCapturedIdentityAndDoesNotFollowBounceOrClearReplacement()throws {
  let (textures,canvas,node,service,adapter)=try fixture()
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  let model=NativeTile(id:"a",cell:.init(column:0,row:0),value:0,locked:true)
  XCTAssertTrue(node.beginSourceLockedSpawnMarker(id:"A"));XCTAssertFalse(node.beginSourceLockedSpawnMarker(id:"A"))
  XCTAssertTrue(node.beginSourceLockedSpawnMarker(id:"C"));node.clearSourceLockedSpawnMarker(id:"A")
  XCTAssertTrue(try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil)).isBeingSpawned)
  node.clearSourceLockedSpawnMarker(id:"A")
  XCTAssertTrue(try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil)).isBeingSpawned)
  node.clearSourceLockedSpawnMarker(id:"C")
  XCTAssertFalse(try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil)).isBeingSpawned)
  XCTAssertFalse(try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil)).hasSpawnTween)
 }
 @MainActor func testAppSpawnActualTimelineDoesNotInventSpawnMarkerOrStoreLeaseAsSpawnTween()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:3,locked:false)
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  let model=NativeTile(id:"a",cell:.init(column:0,row:0),value:3)
  var finishes=0,acquired=0,released=0
  let owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{node.sourceContactNodeAlive && node.parent != nil},readRotation:{Double(node.dragInnerTilt)},paintScale:{node.paintSourceOuterScale(.init(x:$0,y:$0))},paintRotation:{node.dragInnerTilt=CGFloat($0)},ensureFullOpacity:{node.ensureSourceAppSpawnFullOpacity()},random:{0.9},acquireFrames:{acquired+=1;return{released+=1}},finished:{outcome in XCTAssertEqual(outcome,.completed);finishes+=1}))
  XCTAssertTrue(owner.start());XCTAssertEqual(acquired,1)
  for wall in stride(from:10.0,through:550.0,by:10){service.deliver(wallMilliseconds:wall)}
  let during=try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil))
  XCTAssertFalse(during.isBeingSpawned);XCTAssertFalse(during.hasSpawnTween);XCTAssertFalse(during.ccSpawnAnimating)
  XCTAssertEqual(finishes,0);service.deliver(wallMilliseconds:560)
  XCTAssertEqual(finishes,1);XCTAssertEqual(released,1)
  XCTAssertFalse(try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:nil)).isBeingSpawned)
 }
 @MainActor func testCoreOwnedMarkersAreDistinctFromPhysicalValueAndCapturedSpawnSlot()throws {
  let (textures,canvas,node,service,adapter)=try fixture(value:2,locked:true)
  defer{withExtendedLifetime(canvas){};node.dispose();adapter.dispose();textures.dispose();service.dispose()}
  var model=NativeTile(id:"a",cell:.init(column:0,row:0),value:2,locked:true,magnetOwned:true)
  var runtime=NativeNoMovesTileRuntime();runtime.wildHandoff=true;runtime.beingRemoved=true
  let t=try XCTUnwrap(node.captureSourceMagnetPhysical(model:model,runtime:runtime,lastMerge:true))
  XCTAssertTrue(t.magnetAffected);XCTAssertTrue(t.wildHandoff);XCTAssertTrue(t.beingRemoved);XCTAssertTrue(t.lastMerge)
  XCTAssertTrue(NativeSourceMagnetPhysicalState.transient(t))
  XCTAssertFalse(try XCTUnwrap(node.captureSourceSaveTileMarkers(model:model,runtime:runtime)).isBeingSpawned)
  model.magnetOwned=false;runtime.wildHandoff=false;runtime.beingRemoved=false
  XCTAssertFalse(try XCTUnwrap(node.captureSourceMagnetPhysical(model:model,runtime:runtime,lastMerge:false)).magnetAffected)
 }
}
