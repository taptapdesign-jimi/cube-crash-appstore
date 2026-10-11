import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeRegularStackFrameNodeTests:XCTestCase {
 @MainActor private final class Fixture {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  let canvas=SKNode(),textures:NativeBoardTextures,node:NativeDiceNode,outer:NativeSourceOuterTimelineAdapter
  var draws=0
  init(depth:Int=2) {
   textures=NativeBoardTextures(root:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"))
   node=NativeDiceNode(id:"frame-dst",value:2,kind:"regular",variant:nil,depth:depth,locked:false,textures:textures)
   outer=NativeSourceOuterTimelineAdapter(service:service);canvas.addChild(node);node.position=CGPoint(x:35,y:50)
   node.installSourceOuterDriver(outer,generation:1,geometryScale:0.5)
  }
  @discardableResult func queue(_ value:Int=5,add:Int=1)->Bool {node.queueSourceStackValue(value,addStack:add,service:service,random:{[weak self] in self?.draws+=1;return 0.5},current:{[weak self] in guard let self else{return false};return self.node.parent === self.canvas})}
  func dispose(){node.dispose();outer.dispose();service.dispose();textures.dispose()}
 }
 func testOriginalHolderFaceRetains128LocalPixelsBeforeAndAfterSceneBindings()throws {
  let f=Fixture(depth:1);defer{f.dispose()}
  let node=NativeDiceNode(id:"holder",value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:f.textures);f.canvas.addChild(node);defer{node.dispose()}
  XCTAssertTrue(node.prepareSourceInitialHolder(rotation:0,generation:1))
  let face=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
  XCTAssertEqual(face.frame.width,128,accuracy:1e-5,"holder preparation size=\(face.size), scale=\(face.xScale)")
  node.installSourceOuterDriver(f.outer,generation:1,geometryScale:0.475)
  XCTAssertEqual(face.frame.width,128,accuracy:1e-5)
  XCTAssertTrue(node.openSourceInitialHolder(1,service:f.service,random:{0.5},current:{true},onFinished:{},onCancelled:{}))
  f.service.deliver(wallMilliseconds:16)
  XCTAssertEqual(face.frame.width,128,accuracy:1e-5,"after face RAF size=\(face.size), scale=\(face.xScale)")
 }
 func testActualSelectedOriginalTexturePipsAndLayerContainersCommitInOneFaceRAF()throws {
  let f=Fixture();defer{f.dispose()};let oldTexture=f.node.sourcePaintedNumbersTexture,old=f.node.sourceStackLayerNodes
  XCTAssertTrue(f.queue());XCTAssertEqual(f.node.value,5);XCTAssertEqual(f.node.depth,2);XCTAssertEqual(f.draws,0);XCTAssertTrue(f.node.sourcePaintedNumbersTexture === oldTexture)
  f.service.deliver(wallMilliseconds:16)
  XCTAssertTrue(f.node.sourcePaintedNumbersTexture === f.textures.texture("assets/tile_numbers2.png",densityAware:false));XCTAssertEqual(f.node.depth,3);XCTAssertEqual(f.node.sourcePipNodes.count,5);XCTAssertEqual(f.node.sourceStackLayerNodes.count,2)
  XCTAssertFalse(f.node.sourceStackLayerNodes[0] === old[0]);XCTAssertEqual(f.node.sourceStackLayerNodes[0].children.count,2)
  let sprite=try XCTUnwrap(f.node.sourceStackLayerNodes[0].children.first as? SKSpriteNode),overlay=try XCTUnwrap(f.node.sourceStackLayerNodes[0].children.last as? SKShapeNode)
  XCTAssertEqual(sprite.frame.width,121.6,accuracy:2e-5);XCTAssertEqual(sprite.texture?.size().width,512);XCTAssertEqual(f.node.sourceBaseScaleX,0.25,accuracy:2e-5);XCTAssertEqual(sprite.xScale,0.2375,accuracy:2e-5);XCTAssertEqual(sprite.alpha,CGFloat(Float(0.9)),accuracy:1e-6);XCTAssertEqual(overlay.alpha,0.25,accuracy:1e-6);XCTAssertEqual(sprite.colorBlendFactor,0)
  XCTAssertEqual(f.node.sourceStackLayerNodes[0].zPosition,-9);XCTAssertEqual(f.node.xScale,0.5,accuracy:1e-6);XCTAssertEqual(f.node.position,CGPoint(x:35,y:50));XCTAssertEqual(f.node.sourcePendingStackFrameCount,0)
 }
 func testReentrantLogicalSynchronizeRetainsExactOldStackUntilFrameWithoutEarlySkinDraw()throws {
  let f=Fixture();defer{f.dispose()};let old=f.node.sourceStackLayerNodes,texture=f.node.sourcePaintedNumbersTexture
  XCTAssertTrue(f.queue());f.node.update(value:5,kind:"regular",variant:nil,depth:3,locked:false)
  XCTAssertEqual(f.node.depth,2);XCTAssertTrue(f.node.sourceStackLayerNodes[0] === old[0]);XCTAssertTrue(f.node.sourcePaintedNumbersTexture === texture);XCTAssertEqual(f.draws,0)
  f.service.deliver(wallMilliseconds:16);XCTAssertEqual(f.node.depth,3);XCTAssertEqual(f.draws,8)
  let painted=f.node.sourceStackLayerNodes;f.node.update(value:5,kind:"regular",variant:nil,depth:3,locked:false);XCTAssertTrue(f.node.sourceStackLayerNodes[0] === painted[0])
 }
 func testForegroundGlobalTimelinePauseAllowsFaceAndBackgroundKeepsItQueued()throws {
  let f=Fixture();defer{f.dispose()};f.service.setSourceGlobalPaused(true);f.service.setSourceForeground(false);XCTAssertTrue(f.queue());f.service.deliver(wallMilliseconds:16)
  XCTAssertEqual(f.node.depth,2);XCTAssertEqual(f.draws,0);XCTAssertEqual(f.node.sourcePendingStackFrameCount,1)
  f.service.setSourceForeground(true);f.service.deliver(wallMilliseconds:32);XCTAssertEqual(f.node.depth,3);XCTAssertEqual(f.node.sourcePipNodes.count,5)
 }
 func testCapturedFrameRetirementCannotCancelSameNodeReplacementFrame()throws {
  let f=Fixture();defer{f.dispose()};XCTAssertTrue(f.queue(3,add:1));f.node.retireSourceStackFrames();XCTAssertTrue(f.queue(4,add:2))
  f.service.deliver(wallMilliseconds:16);XCTAssertEqual(f.node.value,4);XCTAssertEqual(f.node.depth,4);XCTAssertEqual(f.draws,11);XCTAssertEqual(f.node.sourcePipNodes.count,4)
 }
 func testNodeDisposeCancelsFrameBeforeOriginalSkinDrawAndNewSameIDIsUntouched()throws {
  let f=Fixture();XCTAssertTrue(f.queue());f.node.dispose();let replacement=NativeDiceNode(id:"frame-dst",value:1,kind:"regular",variant:nil,depth:1,locked:false,textures:f.textures);f.canvas.addChild(replacement)
  f.service.deliver(wallMilliseconds:16);XCTAssertEqual(f.draws,0);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0);XCTAssertEqual(replacement.value,1);XCTAssertEqual(replacement.depth,1);replacement.dispose();f.dispose()
 }
 func testRawUpdateIsImmediateAndAddsNoFaceOrAnimationRegistration()throws {
  let f=Fixture();defer{f.dispose()};f.node.update(value:5,kind:"regular",variant:nil,depth:3,locked:false)
  XCTAssertEqual(f.node.depth,3);XCTAssertEqual(f.node.sourcePipNodes.count,5);XCTAssertEqual(f.node.sourceStackLayerNodes.count,2);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0);XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.draws,0)
 }
 @MainActor private final class Probe:NativeSourceAnimationParticipant {
  weak var node:NativeDiceNode?;var captures:[Int]=[]
  init(_ node:NativeDiceNode){self.node=node}
  func advanceSourceAnimation(seconds:Double){if captures.isEmpty,let node {captures.append(node.sourceStackLayerNodes.count)}}
 }
 func testAwakeTickerCapturesOldLayersButFaceQueuedBeforeSleepingWakeCapturesNewLayers()throws {
  for awake in [true,false] {
   let f=Fixture();defer{f.dispose()};let probe=Probe(f.node);var lease:NativeSourceAnimationClockService.Lease?
   if awake {lease=f.service.register(participant:probe,duration:0.2,domain:.sourceGSAP(.defaultLazyTween),cleanup:{_ in})}
   XCTAssertTrue(f.queue());if !awake {lease=f.service.register(participant:probe,duration:0.2,domain:.sourceGSAP(.defaultLazyTween),cleanup:{_ in})}
   f.service.deliver(wallMilliseconds:16);XCTAssertEqual(probe.captures,[awake ? 1:2]);XCTAssertEqual(f.node.sourceStackLayerNodes.count,2);lease?.cancel()
  }
 }
}
