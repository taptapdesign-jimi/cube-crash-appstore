import XCTest
import SpriteKit
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
