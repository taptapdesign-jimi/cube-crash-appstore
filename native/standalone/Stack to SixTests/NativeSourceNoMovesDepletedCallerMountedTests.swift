import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

/// Explicit bounded test capabilities do not admit the product's missing
/// physical/global/tutorial/Wild/preflight producer roster.
@MainActor final class NativeSourceNoMovesDepletedCallerMountedTests:XCTestCase {
 @MainActor private final class Fixture {
  let fifo:NativeSourceMicrotaskFIFO,tasks:NativeSourceMicrotaskAdapters
  let service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,game:NativeGameplayViewController,window:UIWindow
  var admitted:((UInt64,Set<NativeSourceNoMovesCallerReceipt.Kind>)->Bool)?
  init()throws {
   let fifo=NativeSourceMicrotaskFIFO();self.fifo=fifo;tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
   context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
   let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"other",cell:.init(column:2,row:0),value:1)],moves:1));engine.stagedSourceNoMoves=true
   game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root);game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true
   window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible();game.view.layoutIfNeeded()
   let scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
   scene.layout(size:window.bounds.size,insets:.init(top:1,left:0,bottom:0,right:0),animateEntry:false)
   XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo));scene.sourceNoMovesPresentationEnabled=true;scene.sourceNoMovesRuntimeAuthorityEnabled=true
   let authority=NativeSourceNoMovesRuntimeAuthority(isCurrent:{[weak game] in game?.sourceScope?.current==true},capture:{[weak game] in
    guard let game else{return nil};return .init(state:game.engine.state,tiles:Dictionary(uniqueKeysWithValues:game.engine.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(.fail,reason:"controlled-test-global-capabilities"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
   })
   XCTAssertTrue(scene.configureSourceNoMoves(bindings:.init(runtimeAuthority:authority,visibleShowCue:{_,_ in},admitted:{[weak game] gen in game?.engine.state.generation==gen && game?.sourceScope?.current==true},refreshRuntime:{},ordinaryCallerReady:{_,_ in false},levelEndPreflight:{nil},stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},terminalFields:{_,_ in},queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{}),showText:{_,_ in},beginTextExit:{_,_ in},clearText:{},confirmedBoardExit:{_,_ in},callerInvocationReceiptBound:true))
  }
  func bindings(kinds:Set<NativeSourceNoMovesCallerReceipt.Kind>=[.ordinaryMovesDepleted],fresh:@escaping(NativeSourceNoMovesDepletedCallerFlow.FreshRequest)->NativeResolution?={_ in nil})->NativeSourceNoMovesDepletedCallerBindings {
   .init(kinds:kinds,admitted:{[weak self] gen,kinds in self?.admitted?(gen,kinds) ?? true},busyEnding:{[weak game] in game?.engine.flags.busyEnding},ensureTutorialSingleTile:{_,done in done(false)},forceFresh:fresh,resetHint:{},deferWild:{_ in false},tutorialFinalChance:{_,done in done(false)},cleanVisibility:{(false,false)},clean:{_ in})
  }
  func dispose(){game.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;window.rootViewController=nil}
 }
 func testActualSceneRequiresExplicitCallerModeAndRejectsUnsupportedSixWithoutPublication()throws {
  let f=try Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene)
  XCTAssertFalse(scene.sourceNoMovesDepletedCallersEnabled);XCTAssertFalse(scene.configureSourceNoMovesDepletedCallers(f.bindings()));XCTAssertFalse(f.game.engine.sourceNoMovesCallerReceiptsEnabled)
  scene.sourceNoMovesDepletedCallersEnabled=true
  XCTAssertFalse(scene.configureSourceNoMovesDepletedCallers(f.bindings(kinds:[.mergeMovesDepleted])));XCTAssertNil(f.game.engine.sourceNoMovesCallerAdmission)
  XCTAssertTrue(scene.configureSourceNoMovesDepletedCallers(f.bindings()));XCTAssertEqual(f.game.engine.sourceNoMovesCallerAdmission?.kinds,[.ordinaryMovesDepleted])
  scene.dispose();XCTAssertNil(f.game.engine.sourceNoMovesCallerAdmission);XCTAssertFalse(f.game.engine.sourceNoMovesCallerReceiptsEnabled)
 }
 func testActualSameNodeMainAndDebitStartWall400Then100UnderSourceGlobalPause()async throws {
  let f=try Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene),arrived=expectation(description:"genuine forced caller after real app wall waits")
  scene.sourceNoMovesDepletedCallersEnabled=true;var checks=0
  XCTAssertTrue(scene.configureSourceNoMovesDepletedCallers(f.bindings(fresh:{request in checks+=1;XCTAssertEqual(request.moves,0);XCTAssertTrue(request.forceRefresh);XCTAssertEqual(request.receipt.kind,.ordinaryMovesDepleted);arrived.fulfill();return nil})))
  let geometry=try XCTUnwrap(scene.boardGeometry),source=geometry.center(row:0,column:0),destination=geometry.center(row:0,column:1)
  XCTAssertTrue(scene.beginDrag(at:source));f.service.deliver(wallMilliseconds:25);scene.moveDrag(to:destination,now:0.025)
  XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:destination,now:0.025)).accepted);XCTAssertTrue(f.game.engine.pendingSourceNoMovesCallerReceipts.isEmpty)
  f.service.deliver(wallMilliseconds:105);f.service.setSourceGlobalPaused(true);scene.setSuspended(true)
  await fulfillment(of:[arrived],timeout:3)
  XCTAssertEqual(checks,1);XCTAssertEqual(f.game.engine.state.moves,0);let receipt=try XCTUnwrap(f.game.engine.pendingSourceNoMovesCallerReceipts.first)
  XCTAssertEqual(receipt.kind,.ordinaryMovesDepleted);XCTAssertTrue(f.game.engine.hasUnsavableSourceGameplayState);XCTAssertEqual(f.game.engine.resolve().reason,"source_no_moves_caller_endpoint_missing");XCTAssertFalse(scene.sourceNoMovesCandidateActive)
  let state=f.game.engine.state;scene.dispose();XCTAssertTrue(f.game.engine.pendingSourceNoMovesCallerReceipts.isEmpty);XCTAssertEqual(f.game.engine.state,state)
 }
 func testReentrantAdmissionDisposalCannotRepublishOldCallerCapability()throws {
  let f=try Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene);scene.sourceNoMovesDepletedCallersEnabled=true
  f.admitted={_,_ in scene.dispose();return true}
  XCTAssertFalse(scene.configureSourceNoMovesDepletedCallers(f.bindings()));XCTAssertNil(f.game.engine.sourceNoMovesCallerAdmission);XCTAssertFalse(f.game.engine.sourceNoMovesCallerReceiptsEnabled)
 }
 func testPostAdmissionSelectedStackProducerChangeRefusesOldCapabilityPublication()throws {
  let f=try Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene);scene.sourceNoMovesDepletedCallersEnabled=true
  f.admitted={_,_ in scene.sourceSameNodeStackAbsorbsEnabled=false;return true}
  XCTAssertFalse(scene.configureSourceNoMovesDepletedCallers(f.bindings()));XCTAssertNil(f.game.engine.sourceNoMovesCallerAdmission);XCTAssertFalse(f.game.engine.sourceNoMovesCallerReceiptsEnabled)
 }

}
