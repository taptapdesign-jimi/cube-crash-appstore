import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceSpecialIdleMountedTests:XCTestCase {
 func testEveryRegistryVariantRetainsPaintedSubtreeAcrossForegroundModalPause() {
  let identities=NativeSpecialDiceRegistry.variants.values.map{($0.id,$0.archetype.rawValue,Optional($0.id))}
   + NativeWildArchetype.allCases.map{($0.rawValue,$0.rawValue,Optional<String>.none)}
  for (id,kind,variant) in identities {
   let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true})
   let textures=NativeBoardTextures(root:root)
   let die=NativeDiceNode(id:id,value:6,kind:kind,variant:variant,depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
   let parent=SKNode();parent.addChild(die)
   die.tick(0.7,suspended:false,viewportCenter:195)
   func snapshot(_ node:SKNode)->[String] {
    ["\(ObjectIdentifier(node))|\(node.position)|\(node.xScale)|\(node.yScale)|\(node.zRotation)|\(node.alpha)|\(node.isHidden)"] + node.children.flatMap{snapshot($0)}
   }
   let before=snapshot(die)
   die.preservesPausedSpecialVisuals=true
   let release=scope.acquire(reason:"foreground-modal")
   XCTAssertEqual(snapshot(die),before,"Modal pause changes no painted child: \(id)")
   die.preservesPausedSpecialVisuals=false
   release?()
   XCTAssertEqual(snapshot(die),before,"Modal resume cannot reset authored pose: \(id)")
   die.dispose();scope.dispose();registry.dispose();textures.dispose()
  }
 }
 func testPreparedHoneyAndTntFreezeLiveEffectsAcrossRepeatedForegroundModalPauses() throws {
  for variant in [Optional("honey"),nil] {
   let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,sourceMathRandom:.init(draw:{0.5}),current:{true})
   let textures=NativeBoardTextures(root:root)
   let die=NativeDiceNode(id:variant ?? "tnt",value:6,kind:variant == nil ? "wild-tnt":"wild",variant:variant,depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
   let parent=SKNode();parent.addChild(die)
   let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
   service.sourceMicrotaskTasks=tasks
   defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
   if variant != nil {
    XCTAssertTrue(tasks.inputTask{XCTAssertTrue(die.beginSourceHoneyIdle(service:service,scope:scope,assetTasks:tasks,use2x:true,current:{true},paintable:{true}))})
    XCTAssertEqual(die.sourceHoneySprites.count,3)
   } else {
    XCTAssertTrue(die.beginSourceTntFuse(service:service,current:{true},paintable:{true}))
   }
   func snapshot(_ node:SKNode)->[String] {
    ["\(ObjectIdentifier(node))|\(node.position)|\(node.xScale)|\(node.yScale)|\(node.zRotation)|\(node.alpha)|\(node.isHidden)"] + node.children.flatMap{snapshot($0)}
   }
   var time=400.0
   service.deliver(wallMilliseconds:time)
   let fuse=die.visual.children.compactMap{$0 as? NativeTntFuseSparkles}.first
   if variant == nil {XCTAssertGreaterThan(try XCTUnwrap(fuse).activeCount,0,"Fixture must contain live sparks")}
   else {XCTAssertTrue(die.sourceHoneySprites.contains{$0.alpha>0},"Fixture must contain painted bees")}
   for _ in 0..<3 {
    let before=snapshot(die),participants=service.activeParticipantCount,sparks=fuse?.activeCount
    die.preservesPausedSpecialVisuals=true
    let release=scope.acquire(reason:"foreground-modal-live-effects")
    XCTAssertTrue(service.setSourceGlobalPaused(true))
    time+=400;service.deliver(wallMilliseconds:time)
    XCTAssertEqual(snapshot(die),before,"Modal freezes live artwork and FX")
    XCTAssertEqual(fuse?.activeCount,sparks,"Modal never clears existing sparks")
    XCTAssertEqual(service.activeParticipantCount,participants,"Pause retains owners")
    die.preservesPausedSpecialVisuals=false
    release?();XCTAssertTrue(service.setSourceGlobalPaused(false))
    XCTAssertEqual(snapshot(die),before,"Resume preserves the exact painted pose")
    time+=100;service.deliver(wallMilliseconds:time)
   }
  }
 }
 private final class Key {}
 private var root:URL{Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
 func testActualHoneyNodePreservesRepeatedPhaseAndRegistryChaseWhileVisibilitySuspends()throws {
  var draws=0
  let random=NativeSourceMathRandomStream(draw:{draws+=1;return 0.5})
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,sourceMathRandom:random,current:{true})
  let textures=NativeBoardTextures(root:root)
  for index in 1...7 {XCTAssertNotNil(textures.texture("assets/shop/honey/bee\(index)@2x.png",densityAware:false))}
  let die=NativeDiceNode(id:"source-honey",value:0,kind:"wild",variant:"honey",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  XCTAssertEqual(draws,0)
  XCTAssertTrue(tasks.inputTask{XCTAssertTrue(die.beginSourceHoneyIdle(service:service,scope:scope,assetTasks:tasks,use2x:true,current:{true},paintable:{true}))})
  XCTAssertEqual(draws,78);XCTAssertTrue(die.hasSourceHoneyIdle)
  let ids=die.sourceHoneySprites.map(ObjectIdentifier.init)
  service.deliver(wallMilliseconds:400);let painted=die.sourceHoneySprites.map(\.position)
  die.tick(100,suspended:false,viewportCenter:195);XCTAssertEqual(die.sourceHoneySprites.map(\.position),painted)
  XCTAssertTrue(tasks.inputTask{XCTAssertTrue(die.beginSourceHoneyIdle(service:service,scope:scope,assetTasks:tasks,use2x:true,current:{true},paintable:{true}))})
  XCTAssertEqual(draws,78);XCTAssertEqual(die.sourceHoneySprites.map(ObjectIdentifier.init),ids)
  XCTAssertEqual(die.sourceHoneySprites.map(\.position),painted);XCTAssertEqual(service.activeParticipantCount,1)
  let release=scope.acquire(reason:"actual-honey-pressure")
  XCTAssertTrue(die.hasAnimatedArtwork)
  service.deliver(wallMilliseconds:800);let chasing=die.sourceHoneySprites.map(\.position)
  XCTAssertNotEqual(chasing,painted,"Honey pressure changes chase, never suspends its root")
  die.updateIdleDrag(offset:.init(x:20,y:-10),velocity:.init(x:0.2,y:0.04))
  for index in die.sourceHoneySprites.indices {
   XCTAssertEqual(die.sourceHoneySprites[index].position.x,chasing[index].x-20,accuracy:1e-5)
   XCTAssertEqual(die.sourceHoneySprites[index].position.y,chasing[index].y-10,accuracy:1e-5)
  }
  release?();die.visual.alpha=0.001;die.reconcileSourceIdleBubbleVisibility()
  let held=die.sourceHoneySprites.map(\.position)
  service.deliver(wallMilliseconds:1200);XCTAssertEqual(die.sourceHoneySprites.map(\.position),held)
  die.visual.alpha=1;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:1600)
  XCTAssertNotEqual(die.sourceHoneySprites.map(\.position),held)
  die.setSourceIdleDeferred(true);XCTAssertFalse(die.hasSourceHoneyIdle);XCTAssertEqual(service.activeParticipantCount,0)
 }
 func testNestedHoneyAdmissionPreservesCurrentCAndScopeRetirementClosesOnlyItsRoot()throws {
  var draws=0
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,sourceMathRandom:.init(draw:{draws+=1;return 0.5}),current:{true})
  let textures=NativeBoardTextures(root:root)
  for index in 1...7 {XCTAssertNotNil(textures.texture("assets/shop/honey/bee\(index)@2x.png",densityAware:false))}
  let die=NativeDiceNode(id:"nested-honey",value:0,kind:"wild",variant:"honey",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  var nested=false
  XCTAssertTrue(tasks.inputTask{
   XCTAssertFalse(die.beginSourceHoneyIdle(service:service,scope:scope,assetTasks:tasks,use2x:true,current:{
    if !nested {nested=true;XCTAssertTrue(die.beginSourceHoneyIdle(service:service,scope:scope,assetTasks:tasks,use2x:true,current:{true},paintable:{true}))}
    return true
   },paintable:{true}))
  })
  XCTAssertTrue(die.hasSourceHoneyIdle);XCTAssertEqual(draws,78);XCTAssertEqual(service.activeParticipantCount,1)
  XCTAssertEqual(die.sourceHoneySprites.count,3);service.deliver(wallMilliseconds:400)
  let foreign=die.sourceHoneySprites
  scope.retire(die)
  XCTAssertFalse(die.hasSourceHoneyIdle);XCTAssertEqual(service.activeParticipantCount,0)
  for sprite in foreign {sprite.position = .init(x:999,y:222)}
  service.deliver(wallMilliseconds:800)
  XCTAssertTrue(foreign.allSatisfy{$0.position == .init(x:999,y:222)})
 }
 func testAllLiveRegistryAndNestedCapturedSuspensionsStartEveryActualOwner(){
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true})
  var starts=0,pauses=0,resumes=0,stops=0
  let keys=(0..<13).map{_ in Key()}
  for key in keys {XCTAssertTrue(scope.register(key,owner:.init(start:{starts+=1},stop:{stops+=1},pause:{pauses+=1},resume:{resumes+=1})))}
  XCTAssertEqual(starts,13);XCTAssertEqual(scope.snapshot.running,13)
  let a=scope.acquire(reason:"merge6"),b=scope.acquire(reason:"nested")
  XCTAssertEqual(pauses,13);a?();XCTAssertEqual(resumes,0)
  b?();b?();XCTAssertEqual(resumes,13)
  scope.dispose();registry.dispose();XCTAssertEqual(stops,13)
 }
 func testOldCapturedScopeRetirementPreservesNewNodeAndSuspension(){
  let registry=NativeSourceSpecialIdleRegistry(),a=NativeSourceSpecialIdleScope(registry:registry,current:{true}),c=NativeSourceSpecialIdleScope(registry:registry,current:{true})
  let old=Key(),new=Key();var oldStops=0,newStarts=0
  XCTAssertTrue(a.register(old,owner:.init(start:{},stop:{oldStops+=1},pause:{},resume:{})))
  let oldRelease=a.acquire(reason:"A")
  XCTAssertTrue(c.register(new,owner:.init(start:{newStarts+=1},stop:{},pause:{},resume:{})))
  let newRelease=c.acquire(reason:"C")
  a.dispose();oldRelease?();XCTAssertEqual(oldStops,1);XCTAssertTrue(registry.has(new));XCTAssertTrue(registry.snapshot.suspended);XCTAssertEqual(newStarts,0)
  newRelease?();XCTAssertEqual(newStarts,1);XCTAssertFalse(a.register(new,owner:.init(start:{},stop:{},pause:{},resume:{})))
  c.dispose();registry.dispose()
 }
 func testReentrantStartSuspendsAfterItsActualStartWithoutRestart(){
  let registry=NativeSourceSpecialIdleRegistry();var release:(()->Void)?,starts=0,pauses=0,resumes=0
  let key=Key()
  registry.register(key,owner:.init(start:{starts+=1;release=registry.acquire(reason:"reentry")},stop:{},pause:{pauses+=1},resume:{resumes+=1}))
  XCTAssertEqual(starts,1);XCTAssertEqual(pauses,1);XCTAssertEqual(registry.snapshot.paused,1)
  release?();release?();XCTAssertEqual(resumes,1);XCTAssertEqual(starts,1);registry.dispose()
 }
 func testActualBottlePauseKeepsPoseAndDirectArtworkRemainsPointerOwned()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let die=NativeDiceNode(id:"idle-bottle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose()}
  let art=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first)
  die.tick(1.8,suspended:false,viewportCenter:195);let pose=art.position,anchor=art.anchorPoint,rotation=art.zRotation
  let release=scope.acquire(reason:"actual-merge6")
  XCTAssertFalse(die.hasAnimatedArtwork);die.tick(10,suspended:false,viewportCenter:195)
  XCTAssertEqual(art.position,pose);XCTAssertEqual(art.anchorPoint,anchor);XCTAssertEqual(art.zRotation,rotation)
  release?();die.tick(0.3,suspended:false,viewportCenter:195)
  let sample=NativeBottleIdleMotion.sample(seconds:2.1)
  // SpriteKit stores node positions at its own renderer precision. Compare
  // original oracle through the same SKSpriteNode boundary, without widening
  // the assertion tolerance or modifying motion/runtime code.
  let originalPoseNode=SKSpriteNode()
  originalPoseNode.position=CGPoint(x:0,y:-64-sample.y)
  XCTAssertEqual(art.position.y,originalPoseNode.position.y,accuracy:1e-8)
  let held=scope.acquire(reason:"during-pointer")
  die.setDragging(true);XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.anchorPoint,CGPoint(x:0.5,y:0.5))
  held?();XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.anchorPoint,CGPoint(x:0.5,y:0.5))
  die.setDragging(false);XCTAssertEqual(art.position.y,-64)
 }
 func testExplicitBottleNodeSourceRootOwnsPaintAndRetainsPhaseThroughRegistryDragAndVisibility()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let die=NativeDiceNode(id:"source-bottle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  let art=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first)
  let originalPosition=art.position,originalAnchor=art.anchorPoint,originalRotation=art.zRotation
  var visible=true
  XCTAssertTrue(die.beginSourceBottleIdle(service:service,scope:scope,current:{true},paintable:{visible}))
  service.deliver(wallMilliseconds:400)
  let position=art.position,rotation=art.zRotation
  die.tick(100,suspended:false,viewportCenter:195)
  XCTAssertEqual(art.position,position);XCTAssertEqual(art.zRotation,rotation,"Raw tick cannot overwrite the Source face")
  let release=scope.acquire(reason:"source-bottle-pause")
  service.deliver(wallMilliseconds:800);XCTAssertEqual(art.position,position)
  die.setDragging(true);release?();service.deliver(wallMilliseconds:1200)
  XCTAssertEqual(art.position,position);XCTAssertEqual(art.zRotation,rotation,"drag pauses the authored timeline without resetting")
  die.setDragging(false);service.deliver(wallMilliseconds:1600)
  let expected=NativeBottleIdleMotion.sample(seconds:0.8)
  XCTAssertEqual(art.zRotation,originalRotation-expected.rotation,accuracy:1e-6)
  let resumed=art.position
  visible=false;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:2000)
  XCTAssertEqual(art.position,resumed)
  visible=true;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:2400)
  XCTAssertEqual(art.zRotation,originalRotation-NativeBottleIdleMotion.sample(seconds:1.2).rotation,accuracy:1e-6)
  scope.retire(die)
  XCTAssertEqual(art.position,originalPosition);XCTAssertEqual(art.anchorPoint,originalAnchor);XCTAssertEqual(art.zRotation,originalRotation)
  XCTAssertEqual(service.activeParticipantCount,0)
 }
 func testBottleConsumedOwnerRetiresBeforeCapturedFaceCanBeReused()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let die=NativeDiceNode(id:"consumed-bottle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  let face=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first)
  XCTAssertTrue(die.beginSourceBottleIdle(service:service,scope:scope,current:{true},paintable:{true}))
  service.deliver(wallMilliseconds:400)
  let pose=face.position
  die.retireSourceAnimationBindingsPreservingPaint()
  XCTAssertFalse(die.hasSourceBottleIdle)
  XCTAssertEqual(service.activeParticipantCount,0)
  service.deliver(wallMilliseconds:1200)
  XCTAssertEqual(face.position,pose,"A consumed Bottle owner cannot move a reused face")
  die.retireSourceAnimationBindingsPreservingPaint()
  XCTAssertFalse(die.hasSourceBottleIdle)
 }
 func testSourceBottleVisibilityTracksRotGThresholdAndIgnoresHiddenBaseFace()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let die=NativeDiceNode(id:"visible-bottle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  let face=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first)
  XCTAssertTrue(die.beginSourceBottleIdle(service:service,scope:scope,current:{true},paintable:{true}))
  service.deliver(wallMilliseconds:400);let pose=face.position
  die.visual.alpha=0.0005;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:800)
  XCTAssertFalse(die.sourceIdleHostPaintable(canvasPaintable:true));XCTAssertEqual(face.position,pose)
  die.visual.alpha=0.001;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:1200)
  XCTAssertFalse(die.sourceIdleHostPaintable(canvasPaintable:true));XCTAssertEqual(face.position,pose)
  die.visual.alpha=0.0011;face.isHidden=true
  die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:1600)
  XCTAssertTrue(die.sourceIdleHostPaintable(canvasPaintable:true));XCTAssertNotEqual(face.position,pose)
  let resumed=face.position
  parent.isHidden=true;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:2000)
  XCTAssertEqual(face.position,resumed)
  parent.isHidden=false;die.visual.isHidden=true
  die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:2400)
  XCTAssertEqual(face.position,resumed)
  die.visual.isHidden=false;die.reconcileSourceIdleBubbleVisibility();service.deliver(wallMilliseconds:2800)
  XCTAssertNotEqual(face.position,resumed)
 }
 func testBottleAdmissionCurrentReentryCannotReplaceOrCancelInnerAcceptedOwner()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let die=NativeDiceNode(id:"reentrant-bottle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  let art=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first)
  var called=false
  XCTAssertFalse(die.beginSourceBottleIdle(service:service,scope:scope,current:{
   if !called {
    called=true
    XCTAssertTrue(die.beginSourceBottleIdle(service:service,scope:scope,current:{true},paintable:{true}))
   }
   return true
  },paintable:{true}))
  XCTAssertTrue(called);XCTAssertEqual(service.activeParticipantCount,1)
  let before=art.zRotation;service.deliver(wallMilliseconds:400)
  XCTAssertNotEqual(art.zRotation,before,"accepted inner owner remains live")
  die.tick(100,suspended:false,viewportCenter:195)
  XCTAssertEqual(service.activeParticipantCount,1)
 }
 func testRepeatedBottlePrefixRestoresBaseBeforeRepivotAndClosesOnlyOldRoot()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let die=NativeDiceNode(id:"repeat-bottle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  let parent=SKNode();parent.addChild(die)
  let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose();service.dispose();fifo.dispose()}
  let art=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first)
  let savedPosition=art.position,savedAnchor=art.anchorPoint
  XCTAssertTrue(die.beginSourceBottleIdle(service:service,scope:scope,current:{true},paintable:{true}))
  let firstPivot=art.position
  service.deliver(wallMilliseconds:400)
  XCTAssertTrue(die.beginSourceBottleIdle(service:service,scope:scope,current:{true},paintable:{true}))
  XCTAssertEqual(art.position,firstPivot);XCTAssertEqual(service.activeParticipantCount,1)
  scope.retire(die)
  XCTAssertEqual(art.position,savedPosition);XCTAssertEqual(art.anchorPoint,savedAnchor)
  XCTAssertEqual(service.activeParticipantCount,0)
 }
 func testActualNewSpaceshipAllocatesNoIdleOwnerUntilFinalRelease()throws {
  let registry=NativeSourceSpecialIdleRegistry(),scope=NativeSourceSpecialIdleScope(registry:registry,current:{true}),textures=NativeBoardTextures(root:root)
  let a=scope.acquire(reason:"A"),b=scope.acquire(reason:"B")
  let die=NativeDiceNode(id:"new-idle-ship",value:6,kind:"wild-magnet",variant:"spaceship",depth:1,locked:false,textures:textures,sourceSpecialIdle:scope)
  defer{die.dispose();scope.dispose();registry.dispose();textures.dispose()}
  XCTAssertEqual(die.sourceIdleOwnerCount,0);XCTAssertEqual(scope.snapshot.pending,1)
  die.tick(5,suspended:false,viewportCenter:195);a?();XCTAssertEqual(die.sourceIdleOwnerCount,0)
  b?();XCTAssertEqual(scope.snapshot.running,1);XCTAssertGreaterThan(die.sourceIdleOwnerCount,0)
  die.tick(1.1,suspended:false,viewportCenter:195)
  let host=try XCTUnwrap(die.visual.children.first{$0.children.contains{$0.name=="native-spaceship-engine"}})
  XCTAssertEqual(host.position,CGPoint(x:-5,y:3));XCTAssertEqual(host.zRotation,.pi/12,accuracy:1e-8)
 }
 func testActualSceneBorrowsOneExistingPopulationCadenceForAllLiveNodes()throws {
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),context=NativeGameplaySourceContext(service:service)
  let tiles=(0..<13).map{i in NativeTile(id:"special-\(i)",cell:.init(column:i%5,row:i/5),value:6,archetype:.magnet,variant:"cubero")}
  let scene=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:tiles)),resourceRoot:root,size:.init(width:390,height:844))
  let scope=try XCTUnwrap(context.beginScene(engine:scene.engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
  scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
  let view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene);view.isPaused=true
  defer{scene.dispose();context.dispose();service.dispose();view.presentScene(nil)}
  XCTAssertTrue(scene.configureSourceSpecialIdle(scope:scope));XCTAssertEqual(scope.specialIdle.snapshot.running,13)
  XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,1)
  let release=try XCTUnwrap(scene.acquireSourceSpecialIdle(reason:"genuine-owner"))
  XCTAssertEqual(scope.specialIdle.snapshot.paused,13);XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,0)
  release();XCTAssertEqual(scope.specialIdle.snapshot.running,13);XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,1)
  scene.dispose();XCTAssertEqual(scope.specialIdle.registeredKeys.count,0);XCTAssertNil(scene.acquireSourceSpecialIdle(reason:"stale"))
 }
}
