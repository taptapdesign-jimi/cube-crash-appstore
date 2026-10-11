import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetLazySceneTests:XCTestCase {
 @MainActor private final class Fixture {
  let fifo=NativeSourceMicrotaskFIFO(),tasks:NativeSourceMicrotaskAdapters,service:NativeSourceAnimationClockService
  let context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView,window:UIWindow
  let construction:NativeSourceInitialBoardConstruction,resources:NativeWildMeterDropResources
  var events:[NativeGameplayEvent]=[],closed=false
  init(resources:NativeWildMeterDropResources)throws {
   self.resources=resources
   tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   let origin=Date().timeIntervalSince1970*1000
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:origin,sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:origin,visualRandom:{0},sourceMicrotaskTasks:tasks)
   let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
   let saved=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"d",cell:.init(column:2,row:0),value:2),.init(id:"far",cell:.init(column:4,row:8),value:1)],board:10,wildMeter:0.95)
   construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestoredRegular(root:root,service:service,saved:saved,random:context.mathRandom.next))
   let engine=NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state),rewardPicker:{_,_ in .init(.magnet)},sourceMathRandom:context.mathRandom)
   scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
   let scene=scene
   scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceContactVisualRandom=scope.mathRandom.next;scene.sourceStackAbsorbAdmission={_,_ in true}
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true});scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.ignoresSiblingOrder=false
   let controller=UIViewController();controller.view=view;window=UIWindow(frame:view.bounds);window.rootViewController=controller;window.isHidden=false
   view.presentScene(scene)
   scene.onGameplayReceipt={[weak self] event,_,_,_ in self?.events.append(event)}
   scene.onRenderingDemand={[weak view] demand in if demand{view?.isPaused=false}}
  }
  func prepare()async throws {
   let entered=XCTNSPredicateExpectation(predicate:NSPredicate{[weak scene] _,_ in scene?.isBoardEntryComplete==true},object:nil)
   let entryResult=await XCTWaiter.fulfillment(of:[entered],timeout:5);XCTAssertEqual(entryResult,.completed)
   let face=try XCTUnwrap(scene.sourceNativeTileNode("d"))
   XCTAssertTrue(face === construction.nodes["d"]);XCTAssertTrue(face.sourcePhysicalMarkersCovered)
   XCTAssertTrue(face.sourceMergeSixFaceReady(service:service));XCTAssertEqual(construction.pendingFaceCount,0)
   XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo));XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope))
   XCTAssertTrue(scene.configureSourceMeterOpen(scope:scope,resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in},carrierAudio:{_,_,_ in {}},dividerMask:{{}},landing:{_,_ in}))
   // Earn the charge via an actual ordinary contact, then await the real
   // hidden-holder/travel/rendered-frame/Promise finally Source caller.
   // The retained destination has its genuine Source constructor coverage;
   // no test mutates marker flags or manufactures an initial Wild object.
   try move(from:.init(column:0,row:0),to:.init(column:1,row:0))
   let meter=XCTNSPredicateExpectation(predicate:NSPredicate{[weak scene] _,_ in
    guard let scene else{return false};return scene.engine.state.wildSpawnCount==1 && !scene.engine.sourceMeterHandoffInProgress && scene.engine.state.tiles.contains{$0.gameplayArchetype == .magnet}
   },object:nil)
   let meterResult=await XCTWaiter.fulfillment(of:[meter],timeout:8);XCTAssertEqual(meterResult,.completed)
   // Exact main/normal graph fixture. Postcommit verification is intentionally
   // refused: full physical levelEnd/FX producer is a separate caller packet.
   let bindings=NativeSourceMagnetSceneBindings(admitted:{true},ownsLifecycle:{[engine=scene.engine] in $0.generation==engine.state.generation},simulate:{false},observation:{_ in nil},fallback:{_,_,_ in false},fxStatus:{nil},clearLastMerge:{_ in},updateGhostVisibility:{},centralCheck:{_ in},cleanupPullAnimations:{_ in},releasePullFlag:{_ in})
   XCTAssertTrue(scene.configureSourceMagnetVerification(scope:scope,bindings:bindings));XCTAssertTrue(scene.configureSourceMagnetMain80(scope:scope));XCTAssertTrue(scene.configureSourceMagnetLazyRespawn(scope:scope))
  }
  func point(_ cell:NativeCell)throws->CGPoint{try XCTUnwrap(scene.boardGeometry).center(row:cell.row,column:cell.column)}
  func move(from:NativeCell,to:NativeCell)throws {
   let src=try point(from),dst=try point(to)
   XCTAssertTrue(tasks.inputTask{XCTAssertTrue(scene.beginDrag(at:src));scene.moveDrag(to:dst,now:0);XCTAssertTrue(scene.finishDrag(at:dst,now:0)?.accepted==true)})
  }
  func contact()throws {
   let magnet=try XCTUnwrap(scene.engine.state.tiles.first{$0.gameplayArchetype == .magnet})
   try move(from:magnet.cell,to:.init(column:2,row:0))
  }
  func dispose(){guard !closed else{return};closed=true;scene.dispose();construction.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
  isolated deinit {dispose()}
 }
 private func makeFixture()async throws->Fixture {
  let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")),resources=NativeWildMeterDropResources(root:root)
  let ready=expectation(description:"original selected carrier resources prepared before Source admission")
  var failure:NativeWildMeterDropResources.Failure?
  resources.prepare(arcade:false,capture:.init(id:"magnet-fixture-prewarm",generation:1,epoch:1)){result in
   if case .failure(let reason)=result{failure=reason};ready.fulfill()
  }
  await fulfillment(of:[ready],timeout:8);XCTAssertNil(failure)
  XCTAssertNotNil(resources.sourceSynchronousPreparationReceipt())
  return try Fixture(resources:resources)
 }
 private func awaitCondition(_ label:String,timeout:Double=4,_ condition:@escaping @MainActor()->Bool)async {
  let end=Date().addingTimeInterval(timeout)
  while !condition(),Date()<end {try? await Task.sleep(for:.milliseconds(10))}
  XCTAssertTrue(condition(),label)
 }
 func testActualMountedNormalGraphCreatesReservesThenSameDestinationAndNextRealMerge()async throws {
  let f=try await makeFixture();defer{f.dispose()};try await f.prepare()
  let original=try XCTUnwrap(f.scene.sourceNativeTileNode("d"));try f.contact()
  await awaitCondition("genuine actual specialBoardCommitted"){f.events.contains{$0.kind == .specialBoardCommitted}}
  XCTAssertNil(f.scene.engine.pendingSpecial);XCTAssertNil(f.scene.engine.pendingMagnetRespawn);XCTAssertNil(f.scene.engine.pendingSourceMagnetLazyRespawn)
  XCTAssertTrue(f.scene.sourceNativeTileNode("d") === original);XCTAssertEqual(original.kind,"regular");XCTAssertFalse(original.sourceResidualWildPresence)
  XCTAssertEqual(original.sourceValue,1);XCTAssertEqual(original.sourceStackDepth,1);XCTAssertFalse(original.isHidden);XCTAssertEqual(original.alpha,1)
  let survivorIndex=try XCTUnwrap(f.events.firstIndex{$0.kind == .spawned && $0.tileIDs==["d"]})
  XCTAssertTrue(f.events[..<survivorIndex].contains{$0.kind == .spawned && $0.value==0})
  XCTAssertEqual(f.events.filter{$0.kind == .spawned && $0.tileIDs==["d"]}.count,1)
  await awaitCondition("actual survivor tail/input bind and retained raw face"){
   f.scene.sourceMagnetSurvivorPendingInputIDs.isEmpty && original.sourceMergeSixFaceReady(service:f.service)
  }
  let other=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id != "d" && !$0.locked && $0.value==1})
  let src=try f.point(other.cell),dst=try f.point(.init(column:2,row:0))
  XCTAssertTrue(f.tasks.inputTask{XCTAssertTrue(f.scene.beginDrag(at:src));f.scene.moveDrag(to:dst,now:0);XCTAssertTrue(f.scene.finishDrag(at:dst,now:0)?.accepted==true)})
  await awaitCondition("next actual same-object face survives retired Magnet caller"){original.sourceValue==2 && original.sourcePendingStackFrameCount==0}
  XCTAssertTrue(f.scene.sourceNativeTileNode("d") === original);XCTAssertEqual(original.sourceStackDepth,2)
 }
 func testSourceGlobalPauseAllowsWallHolderCascadeButCannotInventSurvivorArrival()async throws {
  let f=try await makeFixture();defer{f.dispose()};try await f.prepare();try f.contact()
  await awaitCondition("actual main80") {f.scene.engine.sourceSpecialAbsorbMainEntered}
  f.service.setSourceGlobalPaused(true)
  await awaitCondition("actual app-wall replacement holders while Source root paused"){
   guard let lazy=f.scene.engine.pendingSourceMagnetLazyRespawn,!lazy.slots.isEmpty else{return false}
   return lazy.slots.allSatisfy{slot in
    guard let tile=f.scene.engine.state.tile(at:slot.cell) else{return false};return tile.value>0 && !tile.locked
   }
  }
  XCTAssertEqual(f.scene.engine.state.tile(at:.init(column:2,row:0))?.value,6)
  XCTAssertNotNil(f.scene.engine.pendingSourceMagnetLazyRespawn);XCTAssertFalse(f.events.contains{$0.kind == .specialBoardCommitted})
  f.service.setSourceGlobalPaused(false)
  await awaitCondition("actual resumed bounces and Promise-all") {f.events.contains{$0.kind == .specialBoardCommitted}}
  XCTAssertTrue(f.scene.sourceNativeTileNode("d")?.sourceValue==1)
 }
 func testScopeDisposalRetiresCapturedAnimationAndOldLogicalCallbacksWithoutRawFallback()async throws {
  let f=try await makeFixture();try await f.prepare();try f.contact()
  await awaitCondition("first genuine lazy holder assignment"){
   guard let slot=f.scene.engine.pendingSourceMagnetLazyRespawn?.slots.first,
         let tile=f.scene.engine.state.tile(at:slot.cell) else{return false}
   return tile.value>0 && !tile.locked
  }
  let before=f.scene.engine.state,plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
  f.dispose();XCTAssertEqual(f.service.activeParticipantCount,0)
  XCTAssertFalse(f.scene.engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
  XCTAssertFalse(f.scene.engine.commitSpecialBoard(transactionID:plan.id).accepted)
  XCTAssertEqual(f.scene.engine.state,before)
  // Route replacement requires the canonical new board/reset owner. This
  // refusal does not fabricate a successful old transaction or saved state.
  XCTAssertTrue(f.scene.engine.hasUnsavableSourceGameplayState)
 }
}
