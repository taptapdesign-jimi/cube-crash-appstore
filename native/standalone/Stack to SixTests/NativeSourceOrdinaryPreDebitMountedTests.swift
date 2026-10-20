import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

/// Mounted actual native Scene callback route. Complete capability sets below
/// are explicit fixture contracts, not product global-marker publication.
@MainActor final class NativeSourceOrdinaryPreDebitMountedTests:XCTestCase {
 @MainActor private final class Fixture {
    let fifo:NativeSourceMicrotaskFIFO,tasks:NativeSourceMicrotaskAdapters
    let service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,game:NativeGameplayViewController,window:UIWindow,scene:NativeBoardScene
    var trace:[String]=[]
    var fresh:((NativeSourceOrdinaryPreDebitFlow.FreshRequest)->NativeResolution?)?
    var admitted:((UInt64)->Bool)?
    var refuseContactCapture=false
    var onContactCapture:(()->Void)?
    init()throws {
        fifo=NativeSourceMicrotaskFIFO();tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
        context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"other",cell:.init(column:2,row:0),value:5)],moves:50));engine.stagedSourceNoMoves=true
        game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root);game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true
        window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible();game.view.layoutIfNeeded()
        scene=try XCTUnwrap(game.boardScene);let scope=try XCTUnwrap(game.sourceScope)
        scene.layout(size:window.bounds.size,insets:.init(top:1,left:0,bottom:0,right:0),animateEntry:false)
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo));scene.sourceNoMovesPresentationEnabled=true;scene.sourceNoMovesRuntimeAuthorityEnabled=true
        let authority=NativeSourceNoMovesRuntimeAuthority(isCurrent:{[weak game] in game?.sourceScope?.current==true},capture:{[weak game] in
            guard let game else{return nil};return .init(state:game.engine.state,tiles:Dictionary(uniqueKeysWithValues:game.engine.state.tiles.map{($0.id,.init())}),wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:.init(.fail,reason:"controlled-source-fixture"),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
        })
        XCTAssertTrue(scene.configureSourceNoMoves(bindings:.init(runtimeAuthority:authority,visibleShowCue:{_,_ in},admitted:{[weak game] gen in game?.engine.state.generation==gen && game?.sourceScope?.current==true},refreshRuntime:{},ordinaryCallerReady:{_,_ in false},levelEndPreflight:{nil},stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},terminalFields:{_,_ in},queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{}),showText:{_,_ in},beginTextExit:{_,_ in},clearText:{},confirmedBoardExit:{_,_ in},callerInvocationReceiptBound:true))
        scene.sourceNoMovesDepletedCallersEnabled=true
        XCTAssertTrue(scene.configureSourceNoMovesDepletedCallers(.init(kinds:[.ordinaryMovesDepleted],admitted:{_,_ in true},busyEnding:{[weak game] in game?.engine.flags.busyEnding},ensureTutorialSingleTile:{_,done in done(false)},forceFresh:{_ in nil},resetHint:{},deferWild:{_ in false},tutorialFinalChance:{_,done in done(false)},cleanVisibility:{(false,false)},clean:{_ in})))
        scene.onSourceRegularHandoffMutation={[weak self] receipt,phase in self?.trace.append(phase == .began ? "begin":"release");XCTAssertEqual(receipt.generation,engine.state.generation)}
    }
    func nodes()->[String:NativeDiceNode] {
        var result:[String:NativeDiceNode]=[:],pending=scene.children
        while let node=pending.popLast() {if let die=node as? NativeDiceNode {result[die.tileID]=die};pending.append(contentsOf:node.children)}
        return result
    }
    func observation(_ node:NativeDiceNode)->NativeSourcePostcheckTile {
        .init(object:node,id:node.tileID,value:node.sourceValue,depth:node.sourceStackDepth,locked:node.sourceLocked,destroyed:!node.sourceContactNodeAlive,isWildLike:node.isSpecial || node.sourceResidualWildPresence,active:node.sourceContactNodeAlive && !node.isHidden && node.alpha>0 && !node.sourceLocked && node.sourceValue>0)
    }
    func roster()->NativeSourcePostcheckRoster? {
        let actual=nodes();var tiles:[NativeSourcePostcheckTile]=[]
        for model in game.engine.state.tiles {guard let node=actual[model.id] else{return nil};tiles.append(observation(node))}
        return .init(tiles:tiles,moves:game.engine.state.moves,complete:true)
    }
    func bindings(capabilities:Set<NativeSourceNoMovesRuntimeSnapshot.Capability>=Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))->NativeSourceOrdinaryPreDebitBindings {
        .init(markerCapabilities:capabilities,admitted:{[weak self] gen in self?.admitted?(gen) ?? (self?.game.engine.state.generation==gen)},captureBefore:{[weak self] in guard let self else{return nil};self.onContactCapture?();guard !self.refuseContactCapture else{return nil};return self.roster()},stateRoster:{[weak self] in self?.trace.append("STATE");return self?.roster()},reread:{[weak self] held in guard let self,let node=held.object as? NativeDiceNode else{return nil};return self.observation(node)},busyEnding:{[weak self] in self?.trace.append("busy");return self?.game.engine.flags.busyEnding},forceFresh:{[weak self] request in self?.trace.append(request.kind == .active ? "fresh-active":"fresh-STATE");return self?.fresh?(request) ?? NativeResolution(.continue,reason:"controlled-physical-STATE-fixture")},clearEndGameCache:{[weak self] in self?.trace.append("clear")},resetHint:{},deferStackWild:{_ in false},ensureTutorialSingleTile:{_,done in done(false)},tutorialFinalChance:{_,done in done(false)})
    }
    func drop()throws {
        let geometry=try XCTUnwrap(scene.boardGeometry),source=geometry.center(row:0,column:0),destination=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:source));service.deliver(wallMilliseconds:25);scene.moveDrag(to:destination,now:0.025)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:destination,now:0.025)).accepted)
    }
    func dispose(){game.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;window.rootViewController=nil}
 }
 func testRefusedContactCaptureReturnsActualDraggedNodeAndAllowsRetry()throws {
    let f=try Fixture();defer{f.dispose()}
    f.scene.sourceOrdinaryPreDebitPresentationEnabled=true
    XCTAssertTrue(f.scene.configureSourceOrdinaryPreDebit(f.bindings()))
    let geometry=try XCTUnwrap(f.scene.boardGeometry),start=geometry.center(row:0,column:0),end=geometry.center(row:0,column:1)
    let node=try XCTUnwrap(f.nodes()["s"]),origin=node.position,before=f.game.engine.state
    XCTAssertTrue(f.scene.beginDrag(at:start));f.service.deliver(wallMilliseconds:25)
    f.scene.moveDrag(to:end,now:0.025)
    XCTAssertNotEqual(node.position,origin)
    f.refuseContactCapture=true
    let result=try XCTUnwrap(f.scene.finishDrag(at:end,now:0.025))
    XCTAssertFalse(result.accepted)
    XCTAssertTrue(result.events.contains{$0.reason=="source_predebit_contact_not_admitted"})
    XCTAssertEqual(f.game.engine.state,before);XCTAssertFalse(f.game.engine.isDragging)
    f.service.deliver(wallMilliseconds:400)
    XCTAssertEqual(node.position.x,origin.x,accuracy:0.001)
    XCTAssertEqual(node.position.y,origin.y,accuracy:0.001)
    XCTAssertTrue(f.nodes()["s"] === node)
    f.refuseContactCapture=false
    XCTAssertTrue(f.scene.beginDrag(at:start));f.scene.moveDrag(to:end,now:0.4)
    XCTAssertTrue(try XCTUnwrap(f.scene.finishDrag(at:end,now:0.4)).accepted)
 }
 func testReentrantContactCaptureMutationDoesNotReturnObsoletePointerPose()throws {
    let f=try Fixture();defer{f.dispose()}
    f.scene.sourceOrdinaryPreDebitPresentationEnabled=true
    XCTAssertTrue(f.scene.configureSourceOrdinaryPreDebit(f.bindings()))
    let geometry=try XCTUnwrap(f.scene.boardGeometry),start=geometry.center(row:0,column:0),end=geometry.center(row:0,column:1)
    let node=try XCTUnwrap(f.nodes()["s"]),before=f.game.engine.state
    XCTAssertTrue(f.scene.beginDrag(at:start));f.service.deliver(wallMilliseconds:25)
    f.scene.moveDrag(to:end,now:0.025)
    let capturedPose=node.position
    var committed:NativeBoardState?
    f.onContactCapture={
        f.onContactCapture=nil
        let result=f.game.engine.drop(target:.init(column:1,row:0),pointerID:1,now:0.025)
        XCTAssertTrue(result.accepted);committed=f.game.engine.state
    }
    let result=try XCTUnwrap(f.scene.finishDrag(at:end,now:0.025))
    XCTAssertFalse(result.accepted);XCTAssertNotEqual(f.game.engine.state,before)
    XCTAssertEqual(f.game.engine.state.generation,before.generation)
    XCTAssertTrue(f.nodes()["s"] === node)
    f.service.deliver(wallMilliseconds:400)
    XCTAssertEqual(f.game.engine.state,try XCTUnwrap(committed))
    XCTAssertEqual(node.position.x,capturedPose.x,accuracy:0.001)
    XCTAssertEqual(node.position.y,capturedPose.y,accuracy:0.001)
 }
 func testDefaultOffAndMissingMarkerCapabilityRefuseBeforeCorePublication()throws {
    let f=try Fixture();defer{f.dispose()};XCTAssertFalse(f.scene.sourceOrdinaryPreDebitPresentationEnabled);XCTAssertFalse(f.scene.configureSourceOrdinaryPreDebit(f.bindings()))
    f.scene.sourceOrdinaryPreDebitPresentationEnabled=true
    XCTAssertFalse(f.scene.configureSourceOrdinaryPreDebit(f.bindings(capabilities:[.physicalRoster,.sourceFreshCheck])))
    XCTAssertNil(f.game.engine.sourceOrdinaryPreDebitAdmission);XCTAssertFalse(f.game.engine.sourceOrdinaryPreDebitEnabled);XCTAssertEqual(f.game.engine.state.moves,50)
 }
 func testActualSameNodeMainRemovesSourceAndReleasesHandoffBeforeSingleWall100UnderPause()async throws {
    let f=try Fixture();defer{f.dispose()};let finished=expectation(description:"actual pre-debit wall100 reaches full STATE")
    f.scene.sourceOrdinaryPreDebitPresentationEnabled=true
    f.fresh={request in if request.kind == .STATE {finished.fulfill()};return .init(.continue,reason:"literal-source-continue")}
    XCTAssertTrue(f.scene.configureSourceOrdinaryPreDebit(f.bindings()));try f.drop()
    XCTAssertEqual(f.game.engine.state.moves,50);f.service.deliver(wallMilliseconds:105)
    f.service.setSourceGlobalPaused(true);f.scene.setSuspended(true)
    await fulfillment(of:[finished],timeout:3)
    XCTAssertEqual(f.game.engine.state.moves,49);XCTAssertNil(f.nodes()["s"]);XCTAssertTrue(f.game.engine.pendingOrdinaryPostchecks.isEmpty)
    let release=try XCTUnwrap(f.trace.firstIndex(of:"release")),busy=try XCTUnwrap(f.trace.firstIndex(of:"busy")),active=try XCTUnwrap(f.trace.firstIndex(of:"fresh-active")),state=try XCTUnwrap(f.trace.firstIndex(of:"fresh-STATE"))
    XCTAssertLessThan(release,busy);XCTAssertLessThan(active,state);XCTAssertEqual(f.trace.filter{$0=="release"}.count,1)
 }
 func testReentrantPhysicalFreshCallbackDisposalDoesNotDebitOrPublishAfterRetirement()async throws {
    let f=try Fixture();defer{f.dispose()};let queried=expectation(description:"actual external fresh query")
    f.scene.sourceOrdinaryPreDebitPresentationEnabled=true;f.fresh={_ in f.scene.dispose();queried.fulfill();return .init(.continue,reason:"reentrant-source-current-test")}
    XCTAssertTrue(f.scene.configureSourceOrdinaryPreDebit(f.bindings()));try f.drop();f.service.deliver(wallMilliseconds:105)
    await fulfillment(of:[queried],timeout:3)
    XCTAssertEqual(f.game.engine.state.moves,50);XCTAssertNil(f.game.engine.sourceOrdinaryPreDebitAdmission);XCTAssertFalse(f.game.engine.sourceOrdinaryPreDebitEnabled)
 }
 func testReentrantAdmissionDisposeCannotReviveEndpoint()throws {
    let f=try Fixture();defer{f.dispose()};f.scene.sourceOrdinaryPreDebitPresentationEnabled=true;f.admitted={_ in f.scene.dispose();return true}
    XCTAssertFalse(f.scene.configureSourceOrdinaryPreDebit(f.bindings()));XCTAssertNil(f.game.engine.sourceOrdinaryPreDebitAdmission);XCTAssertFalse(f.game.engine.sourceOrdinaryPreDebitEnabled)
 }
}
