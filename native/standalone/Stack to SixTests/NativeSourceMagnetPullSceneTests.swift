import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetPullSceneTests:XCTestCase {
 @MainActor private final class Fixture {
  let fifo=NativeSourceMicrotaskFIFO(),tasks:NativeSourceMicrotaskAdapters,service:NativeSourceAnimationClockService
  let context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,view:SKView,window:UIWindow
  let construction:NativeSourceInitialBoardConstruction,resources:NativeWildMeterDropResources
  var events:[NativeGameplayEvent]=[],closed=false,forceCaptures=0,forceStops=0,cancelInForceCapture=false
  var failures:[String]=[]
  let actualSpecialIdle:Bool
  init(resources:NativeWildMeterDropResources,variant:String?=nil,pulledMagnetVariant:String?=nil,includePulledMagnet:Bool=false,destinationMagnetVariant:String?=nil,includeDestinationMagnet:Bool=false)throws {
   self.resources=resources
   actualSpecialIdle=includePulledMagnet || includeDestinationMagnet
   tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   let origin=Date().timeIntervalSince1970*1000
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:origin,sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:origin,visualRandom:{0},sourceMicrotaskTasks:tasks)
   let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
   var saved=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"d",cell:.init(column:2,row:0),value:2),.init(id:"far",cell:.init(column:4,row:8),value:1)],board:10,wildMeter:0.95)
   if includePulledMagnet {saved.tiles.append(.init(id:"pulled-magnet",cell:.init(column:3,row:0),value:6,archetype:.magnet,variant:pulledMagnetVariant))}
   if includeDestinationMagnet {saved.tiles[2] = .init(id:"d",cell:.init(column:2,row:0),value:6,archetype:.magnet,variant:destinationMagnetVariant)}
   construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestored(root:root,service:service,saved:saved,random:context.mathRandom.next))
   let engine=NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state),rewardPicker:{_,_ in .init(.magnet,variant:variant)},sourceMathRandom:context.mathRandom)
   engine.stagedOrdinaryMoves=true;engine.stagedOrdinaryAssignments=true
   scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
   let scene=scene
   scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak scene] in scene?.retireSourceAnimationBindings()}))
   scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
   scene.sourceSameNodeStackAbsorbsEnabled=true;scene.sourceOrdinarySixSameNodeEnabled=true;scene.sourceContactVisualRandom=scope.mathRandom.next;scene.sourceStackAbsorbAdmission={_,_ in true}
   scene.configureSourceRegularStackHandoff(service:service,admitted:{true});scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
   view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.ignoresSiblingOrder=false
   let controller=UIViewController();controller.view=view;window=UIWindow(frame:view.bounds);window.rootViewController=controller;window.isHidden=false
   view.presentScene(scene)
   // Host-owned overlays are outside this scene fixture; acknowledge their
   // real admission callback while testing the common retained board carrier.
   scene.onAuthoredFinale={_,_,_,completed in completed();return true}
   scene.onGameplayReceipt={[weak self] event,_,_,_ in self?.events.append(event)}
   scene.onPresentationFailure={[weak self] in self?.failures.append($0)}
   scene.onSourcePresentationFailure={[weak self] reason,_ in self?.failures.append(reason)}
   scene.onRenderingDemand={[weak view] demand in if demand{view?.isPaused=false}}
  }
  func prepare()async throws {
   let entered=XCTNSPredicateExpectation(predicate:NSPredicate{[weak scene] _,_ in scene?.isBoardEntryComplete==true},object:nil)
   let entryResult=await XCTWaiter.fulfillment(of:[entered],timeout:5);XCTAssertEqual(entryResult,.completed)
   let face=try XCTUnwrap(scene.sourceNativeTileNode("d"))
   XCTAssertTrue(face === construction.nodes["d"]);XCTAssertTrue(face.sourcePhysicalMarkersCovered)
   if !face.isSpecial {XCTAssertTrue(face.sourceMergeSixFaceReady(service:service))};XCTAssertEqual(construction.pendingFaceCount,0)
   XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo));XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope))
   if actualSpecialIdle {XCTAssertTrue(scene.configureSourceSpecialIdle(scope:scope))}
   XCTAssertTrue(scene.configureSourceOrdinarySixMain(scope:scope,acquireIdle:{[weak scene] reason in
    guard let scene else{return nil}
    return scene.sourceSpecialIdleAdmissionOpen ? scene.acquireSourceSpecialIdle(reason:reason):{}
   }))
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
   XCTAssertTrue(scene.configureSourceMagnetVerification(scope:scope,bindings:bindings));XCTAssertTrue(scene.configureSourceMagnetMain80(scope:scope));XCTAssertTrue(scene.configureSourceMagnetLazyRespawn(scope:scope));XCTAssertTrue(scene.configureSourceMagnetPull(scope:scope,captureForceStop:{[weak self] _,_ in
    guard let self else{return {}};self.forceCaptures+=1
    if self.cancelInForceCapture{self.scope.dispose()}
    return {[weak self] in self?.forceStops+=1}
   }))
   if actualSpecialIdle {
    let prepared=XCTestExpectation(description:"real Wild destination selected-face upload")
    var faceReady=false
    scene.prepareSourceSpecialWildDestinationFaceResources(scope:scope){faceReady=$0;prepared.fulfill()}
    let result=await XCTWaiter.fulfillment(of:[prepared],timeout:5)
    XCTAssertEqual(result,.completed);XCTAssertTrue(faceReady)
   }
  }
  func point(_ cell:NativeCell)throws->CGPoint{try XCTUnwrap(scene.boardGeometry).center(row:cell.row,column:cell.column)}
  func move(from:NativeCell,to:NativeCell)throws {
   let src=try point(from),dst=try point(to)
   XCTAssertTrue(tasks.inputTask{
    XCTAssertTrue(scene.beginDrag(at:src));scene.moveDrag(to:dst,now:0)
    let result=scene.finishDrag(at:dst,now:0)
    XCTAssertTrue(result?.accepted==true,(result?.resolution.reason ?? "contact returned no result")+"; presentation="+failures.joined(separator:","))
   })
  }
  func contact()throws {
   let magnet=try XCTUnwrap(scene.engine.state.tiles.first{$0.gameplayArchetype == .magnet && $0.id != "pulled-magnet" && $0.id != "d"})
   try move(from:magnet.cell,to:.init(column:2,row:0))
  }
  func dispose(){guard !closed else{return};closed=true;scene.dispose();construction.dispose();context.dispose();service.dispose();resources.dispose();fifo.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
  isolated deinit {dispose()}
 }
 private func makeFixture(variant:String?=nil,pulledMagnetVariant:String?=nil,includePulledMagnet:Bool=false,destinationMagnetVariant:String?=nil,includeDestinationMagnet:Bool=false)async throws->Fixture {
  let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")),resources=NativeWildMeterDropResources(root:root)
  let ready=expectation(description:"original selected carrier resources prepared before Source admission")
  var failure:NativeWildMeterDropResources.Failure?
  resources.prepare(arcade:false,capture:.init(id:"magnet-fixture-prewarm",generation:1,epoch:1)){result in
   if case .failure(let reason)=result{failure=reason};ready.fulfill()
  }
  await fulfillment(of:[ready],timeout:8);XCTAssertNil(failure)
  XCTAssertNotNil(resources.sourceSynchronousPreparationReceipt())
  return try Fixture(resources:resources,variant:variant,pulledMagnetVariant:pulledMagnetVariant,includePulledMagnet:includePulledMagnet,destinationMagnetVariant:destinationMagnetVariant,includeDestinationMagnet:includeDestinationMagnet)
 }
 private func awaitCondition(_ label:String,timeout:Double=4,_ condition:@escaping @MainActor()->Bool)async {
  let end=Date().addingTimeInterval(timeout)
  while !condition(),Date()<end {try? await Task.sleep(for:.milliseconds(10))}
  XCTAssertTrue(condition(),label)
 }
 func testEveryMagnetBackingPullsAnotherMagnetAndCommitsUsableOrdinarySurvivor()async throws {
  try await exercisePulledMagnet(variants:[nil,"honey","bottle","spaceship"],pulledVariants:[nil,"honey","bottle","spaceship"])
 }
 func testHoneyPullsHoneyAndCommitsUsableOrdinarySurvivor()async throws {
  try await exercisePulledMagnet(variants:["honey"],pulledVariants:["honey"])
 }
 private func exercisePulledMagnet(variants:[String?],pulledVariants:[String?])async throws {
  for variant in variants {
   for pulledVariant in pulledVariants {
    let label="\(variant ?? "core") pulls \(pulledVariant ?? "core")"
    let f=try await makeFixture(variant:variant,pulledMagnetVariant:pulledVariant,includePulledMagnet:true)
    defer{f.dispose()};try await f.prepare()
    let donor=try XCTUnwrap(f.scene.sourceNativeTileNode("pulled-magnet"))
    let destination=try XCTUnwrap(f.scene.sourceNativeTileNode("d"))
    donor.position=CGPoint(x:destination.position.x+5,y:destination.position.y)
    try f.contact()
    let plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
    XCTAssertTrue(plan.targets.contains{$0.id=="pulled-magnet"},label)
    XCTAssertTrue(donor.sourceMagnetPullProtected,label)
    await awaitCondition("second merge and actual survivor commit: "+label,timeout:10){f.events.contains{$0.kind == .specialBoardCommitted}}
    await awaitCondition("pull roots and input tail drain: "+label,timeout:5){
     f.scene.sourceMagnetActualPullOwnerCount==0 && f.scene.sourceMagnetSurvivorPendingInputIDs.isEmpty && destination.sourceMergeSixFaceReady(service:f.service)
    }
    XCTAssertNil(f.scene.sourceNativeTileNode("pulled-magnet"),label)
    XCTAssertFalse(f.scene.engine.state.tiles.contains{$0.id=="pulled-magnet"},label)
    let survivor=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id==plan.destination.id})
    XCTAssertFalse(survivor.isWild,label);XCTAssertNil(survivor.variant,label)
    XCTAssertFalse(destination.sourceMagnetPullProtected,label);XCTAssertEqual(destination.sourceEventMode,"static",label)
    XCTAssertFalse(destination.hasSourceHoneyIdle,label);XCTAssertTrue(destination.sourceHoneySprites.isEmpty,label)
    XCTAssertEqual(destination.sourceIdleOwnerCount,0,label);XCTAssertEqual(donor.sourceIdleOwnerCount,0,label)
    XCTAssertEqual(f.scope.specialIdle.snapshot.registered,0,label)
    let other=try XCTUnwrap(f.scene.engine.state.activeTiles.first{$0.id != survivor.id && !$0.isWild && $0.value+survivor.value<6})
    let moves=f.scene.engine.state.moves
    try f.move(from:other.cell,to:survivor.cell)
    await awaitCondition("survivor real next stack: "+label){f.scene.engine.state.moves==moves-1 && destination.sourcePendingStackFrameCount==0}
    XCTAssertEqual(destination.sourceValue,other.value+survivor.value,label)
    XCTAssertTrue(f.failures.isEmpty,label+": "+f.failures.joined(separator:","))
   }
  }
 }
 func testEveryMagnetBackingRefusesDirectMagnetContactWithoutMutationOrPullOwners()async throws {
  try await exerciseMagnetContact(variants:[nil,"honey","bottle","spaceship"],destinationVariants:[nil,"honey","bottle","spaceship"])
 }
 func testHoneyRefusesDirectHoneyContactWithoutMutationOrPullOwners()async throws {
  try await exerciseMagnetContact(variants:["honey"],destinationVariants:["honey"])
 }
 private func exerciseMagnetContact(variants:[String?],destinationVariants:[String?])async throws {
  for variant in variants {
   for destinationVariant in destinationVariants {
    let label="\(variant ?? "core") contacts \(destinationVariant ?? "core")"
    let f=try await makeFixture(variant:variant,destinationMagnetVariant:destinationVariant,includeDestinationMagnet:true)
    defer{f.dispose()};try await f.prepare()
    let destination=try XCTUnwrap(f.scene.sourceNativeTileNode("d"))
    let source=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.gameplayArchetype == .magnet && $0.id != "d"})
    let before=f.scene.engine.state,a=try f.point(source.cell),b=try f.point(.init(column:2,row:0))
    var result:NativeMoveResult?
    // PWA app-core canDrop explicitly refuses Magnet-like onto Magnet-like.
    // Attraction of a third Magnet donor is a separate permitted pull path.
    XCTAssertTrue(f.tasks.inputTask{
     XCTAssertTrue(f.scene.beginDrag(at:a));f.scene.moveDrag(to:b,now:0)
     result=f.scene.finishDrag(at:b,now:0)
    })
    XCTAssertFalse(try XCTUnwrap(result).accepted,label)
    XCTAssertEqual(result?.resolution.reason,"illegal_drop",label)
    XCTAssertEqual(f.scene.engine.state,before,label)
    XCTAssertNil(f.scene.engine.pendingSpecial,label)
    XCTAssertEqual(f.scene.sourceMagnetActualPullOwnerCount,0,label)
    XCTAssertTrue(f.scene.sourceMagnetSurvivorPendingInputIDs.isEmpty,label)
    XCTAssertTrue(destination.isSpecial,label)
    XCTAssertTrue(f.failures.isEmpty,label+": "+f.failures.joined(separator:","))
   }
  }
 }
 func testSecondImpactHidesConsumedSixBeforeSpawnForEveryMagnetBacking()async throws {
  for variant:String? in [nil,"honey","bottle","spaceship"] {
   let f=try await makeFixture(variant:variant);defer{f.dispose()};try await f.prepare()
   let destination=try XCTUnwrap(f.scene.sourceNativeTileNode("d"))
   try f.contact()
   XCTAssertFalse(destination.isHidden,"first merge carrier is visible during pull")
   let plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
   await awaitCondition("second impact hides six before replacements",timeout:8){
    f.scene.engine.pendingSourceMagnetLazyRespawn != nil
   }
   XCTAssertTrue(destination.isHidden,variant ?? "core")
   XCTAssertEqual(destination.alpha,0);XCTAssertEqual(destination.sourceEventMode,"none")
   XCTAssertNil(destination.sourceMagnetImpactToken,"hidden six no longer paints a swell")
   XCTAssertTrue(f.scene.sourceNativeTileNode(plan.destination.id) === destination)
   XCTAssertEqual(f.scene.engine.state.tile(at:plan.destination.cell)?.id,plan.destination.id)
   XCTAssertEqual(f.scene.engine.state.tile(at:plan.destination.cell)?.value,6)
   XCTAssertFalse(f.scene.engine.state.tile(at:plan.destination.cell)?.visible ?? true)
   // Freeze only authored motion. Wall callbacks may construct holders, but
   // none may show the consumed six or claim its still-reserved grid cell.
   f.service.setSourceGlobalPaused(true)
   try? await Task.sleep(for:.milliseconds(180))
   XCTAssertTrue(destination.isHidden);XCTAssertEqual(destination.alpha,0)
   XCTAssertEqual(f.scene.engine.state.tile(at:plan.destination.cell)?.id,plan.destination.id)
   f.service.setSourceGlobalPaused(false)
   await awaitCondition("actual survivor commit restores ordinary die",timeout:8){f.events.contains{$0.kind == .specialBoardCommitted}}
   XCTAssertTrue(f.scene.sourceNativeTileNode(plan.destination.id) === destination)
   XCTAssertFalse(destination.isHidden);XCTAssertEqual(destination.alpha,1)
   XCTAssertGreaterThan(destination.sourceValue,0);XCTAssertLessThan(destination.sourceValue,6)
   XCTAssertEqual(destination.sourceEventMode,"static")
   XCTAssertTrue(f.failures.isEmpty,f.failures.joined(separator:","))
  }
 }
 func testBottleWithActualIdleLeavesNoBottleAfterMergeAndRepeatedSynchronize()async throws {
  let f=try await makeFixture(variant:"bottle",pulledMagnetVariant:"bottle",includePulledMagnet:true)
  defer{f.dispose()};try await f.prepare()
  try f.contact()
  let plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
  let destination=try XCTUnwrap(f.scene.sourceNativeTileNode(plan.destination.id))
  await awaitCondition("Bottle six is consumed",timeout:8){f.scene.engine.pendingSourceMagnetLazyRespawn != nil}
  XCTAssertTrue(destination.isHidden);XCTAssertEqual(destination.alpha,0)
  for _ in 0..<3 {f.scene.synchronize();XCTAssertTrue(destination.isHidden);XCTAssertEqual(destination.alpha,0)}
  await awaitCondition("Bottle commits ordinary survivor",timeout:10){f.events.contains{$0.kind == .specialBoardCommitted}}
  XCTAssertEqual(destination.kind,"regular");XCTAssertNil(destination.variant)
  XCTAssertFalse(destination.hasSourceBottleIdle)
  XCTAssertNil(f.scene.sourceNativeTileNode(plan.source.id))
  for _ in 0..<5 {f.scene.synchronize();try? await Task.sleep(for:.milliseconds(30));XCTAssertNil(destination.variant);XCTAssertFalse(destination.hasSourceBottleIdle)}
  XCTAssertTrue(f.failures.isEmpty,f.failures.joined(separator:","))
 }
 func testActualSourcePullUsesLivePaintedOrderAndSameDestinationNextMove()async throws {
  let f=try await makeFixture();defer{f.dispose()};try await f.prepare()
  let destination=try XCTUnwrap(f.scene.sourceNativeTileNode("d"))
  let far=try XCTUnwrap(f.scene.sourceNativeTileNode("far")),near=try XCTUnwrap(f.scene.sourceNativeTileNode("b"))
  let target=destination.position
  // Actual rendered-node pose is authoritative: a tile with a far GRID cell
  // is painted closer before contact; Source stable sort must choose it first.
  far.position=CGPoint(x:target.x+5,y:target.y);near.position=CGPoint(x:target.x+80,y:target.y)
  try f.contact()
  let plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
  XCTAssertEqual(plan.targets.map(\.id),["far","b"])
  XCTAssertEqual(f.scene.sourceMagnetActualPullOwnerCount,1)
  XCTAssertTrue(far.sourceMagnetPullProtected);XCTAssertTrue(near.sourceMagnetPullProtected)
  XCTAssertEqual(far.sourceEventMode,"none");XCTAssertEqual(near.sourceEventMode,"none")
  await awaitCondition("actual Source root convergence/import reaction and lazy board commit") {f.events.contains{$0.kind == .specialBoardCommitted}}
  await awaitCondition("actual captured enclosing handler finally drains pull roots") {f.scene.sourceMagnetActualPullOwnerCount==0}
  XCTAssertTrue(f.scene.sourceNativeTileNode("d") === destination)
  await awaitCondition("actual survivor face/input tail") {f.scene.sourceMagnetSurvivorPendingInputIDs.isEmpty && destination.sourceMergeSixFaceReady(service:f.service)}
  let other=try XCTUnwrap(f.scene.engine.state.tiles.first{$0.id != "d" && !$0.locked && $0.value==1})
  try f.move(from:other.cell,to:.init(column:2,row:0))
  await awaitCondition("real next same-object regular face") {destination.sourceValue==2 && destination.sourcePendingStackFrameCount==0}
  XCTAssertTrue(f.scene.sourceNativeTileNode("d") === destination)
 }
 func testActualHoneyReservationKeepsNumberedDonorFacesAndPaintedPoses()async throws {
  let f=try await makeFixture(variant:"honey");defer{f.dispose()};try await f.prepare()
  let donors=try ["b","far"].map{try XCTUnwrap(f.scene.sourceNativeTileNode($0))}
  let faces=donors.map(\.sourcePaintedNumbersTexture),revisions=donors.map(\.sourceStackRevision)
  let destination=try XCTUnwrap(f.scene.sourceNativeTileNode("d"))
  donors[0].position=CGPoint(x:destination.position.x+80,y:destination.position.y)
  donors[1].position=CGPoint(x:destination.position.x+5,y:destination.position.y)
  let poses=donors.map(\.position)
  try f.contact()
  let plan=try XCTUnwrap(f.scene.engine.pendingSpecial)
  XCTAssertEqual(plan.variant,"honey");XCTAssertEqual(Set(plan.targets.map(\.id)),Set(["b","far"]))
  for (index,node) in donors.enumerated() {
   XCTAssertTrue(node.sourceMagnetPullProtected);XCTAssertTrue(node.sourceLocked)
   XCTAssertTrue(node.sourcePaintedNumbersTexture === faces[index],"input lock must preserve the exact numbered face")
   XCTAssertEqual(node.sourceStackRevision,revisions[index],"reservation must not rebuild a locked placeholder")
   XCTAssertEqual(node.position,poses[index],"pull captures the actual pre-reservation painted position")
  }
  await awaitCondition("Honey pull actually reaches lazy board commit",timeout:8) {f.events.contains{$0.kind == .specialBoardCommitted}}
  XCTAssertTrue(f.failures.isEmpty,f.failures.joined(separator:","))
 }
 func testGlobalSourcePauseFreezesPullBeforeAnyReplacementAssignment()async throws {
  let f=try await makeFixture();defer{f.dispose()};try await f.prepare();try f.contact()
  await awaitCondition("actual main80 before delayed pull root") {f.scene.engine.sourceSpecialAbsorbMainEntered}
  let plan=try XCTUnwrap(f.scene.engine.pendingSpecial),poses=plan.targets.map{f.scene.sourceNativeTileNode($0.id)!.position}
  f.service.setSourceGlobalPaused(true)
  // Genuine app-owned timeout/Promise task, not a synthetic animation frame:
  // check at100ms while the Source roots remain paused (2000 timeout separate).
  let paused=expectation(description:"actual app timeout while Source GSAP paused")
  let wall=NativeSourceAppTimeoutOwner();wall.sourceMicrotaskTasks=f.tasks
  let receipt=wall.schedule(sourceID:"pull-pause-proof",generation:plan.generation,delayMilliseconds:100,elapsed:{paused.fulfill()},cancelled:{})
  await fulfillment(of:[paused],timeout:1)
  _=wall.cancel(receipt)
  XCTAssertNil(f.scene.engine.pendingSourceMagnetLazyRespawn)
  XCTAssertEqual(plan.targets.map{f.scene.sourceNativeTileNode($0.id)!.position},poses)
  XCTAssertFalse(f.events.contains{$0.kind == .specialBoardCommitted})
  f.service.setSourceGlobalPaused(false)
  await awaitCondition("resumed actual Source convergence") {f.events.contains{$0.kind == .specialBoardCommitted}}
 }
 func testScopeDisposalBeforeRootArrivalDrainsCapturedRootsAndNoReplacementMutation()async throws {
  let f=try await makeFixture();try await f.prepare();try f.contact()
  let plan=try XCTUnwrap(f.scene.engine.pendingSpecial);XCTAssertEqual(f.scene.sourceMagnetActualPullOwnerCount,1)
  f.dispose();XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.scene.sourceMagnetActualPullOwnerCount,0)
  XCTAssertFalse(f.events.contains{$0.kind == .specialBoardCommitted})
  XCTAssertFalse(f.scene.engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
 }
 func testActualForceCaptureReentryDisposesBeforeImportReactionAndStopsLateHandleOnce()async throws {
  let f=try await makeFixture();defer{f.dispose()};try await f.prepare();f.cancelInForceCapture=true
  try f.contact()
  await awaitCondition("actual convergence Force factory cancels captured Scope") {f.forceCaptures==1 && f.scene.sourceMagnetActualPullOwnerCount==0}
  XCTAssertEqual(f.forceStops,1);XCTAssertEqual(f.service.activeParticipantCount,0)
  XCTAssertNil(f.scene.engine.pendingSourceMagnetLazyRespawn)
  XCTAssertFalse(f.events.contains{$0.kind == .specialBoardCommitted})
 }
}
