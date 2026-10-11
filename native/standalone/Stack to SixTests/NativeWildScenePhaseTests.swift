import XCTest
import UIKit
import SpriteKit
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeWildScenePhaseTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private func make(_ archetype:NativeWildArchetype)->NativeGameplayEngine {
        NativeGameplayEngine(state:NativeBoardState(tiles:[
            NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:archetype),
            NativeTile(id:"destination",cell:.init(column:1,row:0),value:5),
            NativeTile(id:"ordinary-a",cell:.init(column:2,row:0),value:1),
            NativeTile(id:"ordinary-b",cell:.init(column:3,row:0),value:1),
            NativeTile(id:"survivor",cell:.init(column:4,row:0),value:2)
        ],board:10),recordedRandomChoices:Array(repeating:0.2,count:1000))
    }
    private func mount(_ engine:NativeGameplayEngine)->(NativeBoardScene,UIWindow,SKView) {
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844)),host=UIViewController(),renderer=SKView(frame:window.bounds)
        host.view=renderer;window.rootViewController=host;window.makeKeyAndVisible();renderer.presentScene(scene)
        return(scene,window,renderer)
    }
    private func drop(_ scene:NativeBoardScene)throws {
        let geometry=try XCTUnwrap(scene.boardGeometry),from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:1)).accepted)
    }
    private func release(_ scene:NativeBoardScene,_ window:UIWindow,_ renderer:SKView) {
        scene.dispose();renderer.presentScene(nil);window.isHidden=true
    }

    func testActualPrimaryBounceOwnsInputAndCapturedStarBatchThenVisualLease() async throws {
        let engine=make(.star),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let spawned=expectation(description:"Actual endgame130 primary assignment"),arrived=expectation(description:"Actual560 primary bounce settles"),logicalDone=expectation(description:"Captured Star extra opens after primary"),visualDone=expectation(description:"Actual source Star Wild-only lease releases")
        var firstID:String?,arrivalSeen=false,logicalSeen=false,visualSeen=false,mainTime:TimeInterval?,assignmentTime:TimeInterval?
        scene.onGameplayEvent={event in
            if event.kind == .merged,event.archetype == .star {mainTime=CACurrentMediaTime()}
            if event.kind == .spawned,(event.value ?? 0)>0,firstID==nil {firstID=event.tileIDs.first;assignmentTime=CACurrentMediaTime();spawned.fulfill()}
        }
        scene.onStateChange={_ in
            if let firstID,!arrivalSeen,engine.directWildGameplayCommitted,engine.pendingWildSpawnArrivals.isEmpty,engine.state.tiles.contains(where:{$0.id==firstID}) {
                arrivalSeen=true;arrived.fulfill()
            }
            if arrivalSeen,!logicalSeen,!engine.hasUnsavableSourceGameplayState {logicalSeen=true;logicalDone.fulfill()}
            if logicalSeen,!visualSeen,engine.pendingDirectWild==nil {visualSeen=true;visualDone.fulfill()}
        }
        try drop(scene);XCTAssertEqual(engine.state.moves,50)
        await fulfillment(of:[spawned],timeout:3)
        let p=try XCTUnwrap(scene.boardGeometry).center(row:0,column:2)
        XCTAssertFalse(scene.beginDrag(at:p),"First logical assignment does not fake the awaited arrival")
        XCTAssertTrue(engine.hasUnsavableSourceGameplayState);XCTAssertEqual(engine.state.moves,49)
        await fulfillment(of:[arrived],timeout:3)
        XCTAssertGreaterThanOrEqual(CACurrentMediaTime()-(assignmentTime ?? 0),0.50)
        XCTAssertGreaterThanOrEqual((assignmentTime ?? 0)-(mainTime ?? 0),0.035)
        XCTAssertTrue(scene.beginDrag(at:p));scene.cancelDrag()
        await fulfillment(of:[logicalDone],timeout:3)
        XCTAssertNotNil(engine.pendingDirectWild,"Source visual lease remains independent of logical continuation")
        XCTAssertFalse(engine.hasUnsavableSourceGameplayState)
        await fulfillment(of:[visualDone],timeout:3)
        XCTAssertEqual(engine.state.moves,49)
    }

    func testPurePauseBeforeActualAbsorbPreservesCoreAndResumesCapturedGhostOnce() async throws {
        let engine=make(.juice),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let merged=expectation(description:"Original captured ghost completion after resume"),assigned=expectation(description:"Pending primary remains captured through pause")
        var mergedCount=0,assignedOnce=false
        scene.onGameplayEvent={event in
            if event.kind == .merged,event.archetype == .juice {mergedCount+=1;merged.fulfill()}
            if event.kind == .spawned,(event.value ?? 0)>0,!assignedOnce {assignedOnce=true;assigned.fulfill()}
        }
        try drop(scene);let snapshot=engine.state,plan=try XCTUnwrap(engine.pendingDirectWild)
        scene.setSuspended(true)
        try await Task.sleep(for:.milliseconds(300))
        XCTAssertEqual(engine.state,snapshot);XCTAssertEqual(engine.pendingDirectWild,plan);XCTAssertEqual(mergedCount,0)
        XCTAssertTrue(engine.hasUnsavableSourceGameplayState)
        scene.setSuspended(false)
        await fulfillment(of:[merged,assigned],timeout:3)
        XCTAssertEqual(mergedCount,1);XCTAssertEqual(engine.state.moves,49)
    }

    func testPauseDuringAwaitedPrimaryFreezesReceiptWithoutManufacturingArrival() async throws {
        let engine=make(.juice),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let first=expectation(description:"Actual primary assignment"),resumed=expectation(description:"Actual first arrival resumes next Juice primary")
        var seen=0
        scene.onGameplayEvent={event in if event.kind == .spawned,(event.value ?? 0)>0 {seen+=1;if seen==1 {first.fulfill()}else if seen==2 {resumed.fulfill()}}}
        try drop(scene);await fulfillment(of:[first],timeout:3)
        scene.setSuspended(true);let state=engine.state,arrivals=engine.pendingWildSpawnArrivals,actions=engine.pendingWildSpawnActions
        try await Task.sleep(for:.milliseconds(700))
        XCTAssertEqual(engine.state,state);XCTAssertEqual(engine.pendingWildSpawnArrivals,arrivals);XCTAssertEqual(engine.pendingWildSpawnActions,actions)
        XCTAssertTrue(engine.hasUnsavableSourceGameplayState);XCTAssertEqual(seen,1)
        scene.setSuspended(false);await fulfillment(of:[resumed],timeout:3)
        XCTAssertEqual(engine.state.moves,49)
    }

    func testHardPrimaryImmediateLogicUsesDecorativeBounceWithoutAwaitedReceipt() async throws {
        let engine=make(.juice);var rejected=0
        engine.wildSpawnPermitAdmission={purpose in if purpose == .primary && rejected<2 {rejected+=1;return false};return true}
        let(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let hard=expectation(description:"Captured hard fallback appears"),extra=expectation(description:"Immediate extra follows hard receipt")
        var activeSpawns=0
        scene.onGameplayEvent={event in if event.kind == .spawned,(event.value ?? 0)>0 {activeSpawns+=1;if activeSpawns==1 {hard.fulfill()}else if activeSpawns==2 {extra.fulfill()}}}
        try drop(scene);await fulfillment(of:[hard,extra],timeout:3)
        XCTAssertEqual(rejected,2);XCTAssertEqual(engine.pendingWildSpawnArrivals.count,1,"Only extra primary owns an awaited arrival")
        let p=try XCTUnwrap(scene.boardGeometry).center(row:0,column:2)
        XCTAssertTrue(scene.beginDrag(at:p),"Source hard receipt releases ordinary input before decorative560ms completion")
        scene.cancelDrag()
    }

    func testRestartRevokesOldSceneSpawnAndRecoveryCallbacksWithoutBlockedCue() async throws {
        let engine=make(.star),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        var blocked=0;scene.onGameplayEvent={if $0.kind == .blocked {blocked+=1}}
        try drop(scene)
        engine.restart(state:NativeBoardState(tiles:[NativeTile(id:"fresh",cell:.init(column:0,row:0),value:2)],board:10,rngState:78))
        scene.synchronize();let fresh=engine.state
        try await Task.sleep(for:.milliseconds(1200))
        XCTAssertEqual(engine.state,fresh);XCTAssertEqual(blocked,0);XCTAssertNil(engine.pendingDirectWild)
    }
    func testActualSecondaryPickupInterruptsCoroutineWithoutInventingNextSpawn() async throws {
        let engine=make(.juice),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let second=expectation(description:"Awaited extra primary starts actual bounce")
        var spawns=0,secondID:String?
        scene.onGameplayEvent={event in if event.kind == .spawned,(event.value ?? 0)>0 {
            spawns+=1;if spawns==2 {secondID=event.tileIDs.first;second.fulfill()}
        }}
        try drop(scene);await fulfillment(of:[second],timeout:3)
        let tile=try XCTUnwrap(engine.state.tiles.first{$0.id==secondID}),geometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertEqual(engine.pendingWildSpawnArrivals.count,1)
        let before=engine.state
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:tile.cell.row,column:tile.cell.column)))
        scene.cancelDrag()
        XCTAssertEqual(engine.state,before);XCTAssertTrue(engine.pendingWildSpawnActions.isEmpty);XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
        try await Task.sleep(for:.milliseconds(800))
        XCTAssertEqual(spawns,2,"Interruption is a cancellation receipt, not success followed by a third spawn")
        XCTAssertEqual(engine.state.moves,49)
    }

    func testActualMainBusyAbortOwnsRecovery120AndPreservesCounters() async throws {
        let engine=make(.star),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let prepared=expectation(description:"Actual80 captures source recovery"),checked=expectation(description:"Actual120 captured recovery executes")
        var recoveryTime:TimeInterval?,removed:[String]=[],merged=0,blocked=0
        scene.onGameplayEvent={event in
            if event.kind == .wildRecoveryCheckPrepared {recoveryTime=CACurrentMediaTime();prepared.fulfill()}
            if event.kind == .removed {removed.append(contentsOf:event.tileIDs)}
            if event.kind == .merged {merged+=1}
            if event.kind == .blocked {blocked+=1}
        }
        var checkedOnce=false
        scene.onStateChange={_ in if recoveryTime != nil,!checkedOnce,engine.pendingWildRecoveryChecks.isEmpty {
            checkedOnce=true;checked.fulfill()
        }}
        try drop(scene);let captured=engine.state
        var flags=engine.flags;flags.busyEnding=true;engine.setRuntimeFlags(flags)
        await fulfillment(of:[prepared,checked],timeout:3)
        XCTAssertGreaterThanOrEqual(CACurrentMediaTime()-(recoveryTime ?? 0),0.10)
        XCTAssertEqual(removed,["destination","wild"])
        XCTAssertEqual(engine.state.moves,captured.moves);XCTAssertEqual(engine.state.score,captured.score);XCTAssertEqual(engine.state.rngState,captured.rngState)
        XCTAssertEqual(merged,0);XCTAssertEqual(blocked,0);XCTAssertTrue(engine.flags.busyEnding)
        XCTAssertTrue(engine.pendingWildRecoveryChecks.isEmpty);XCTAssertNil(engine.pendingDirectWild)
    }

    func testNormalPrimaryArrivalStartsBase50ThenCapturedStarExtra50And100Cadence() async throws {
        let initial=make(.star).state
        var tiles=initial.tiles
        tiles[0].starOrbitCount=3
        tiles += (0..<4).map{NativeTile(id:"locked\($0)",cell:.init(column:$0,row:1),value:0,locked:true,alpha:0.2)}
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0.2,count:1000))
        let(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let batch=expectation(description:"Actual four captured base and Star locked assignments")
        var assignments:[TimeInterval]=[],firstArrivalTime:TimeInterval?,firstPrimaryID:String?
        scene.onGameplayEvent={event in if event.kind == .spawned,(event.value ?? 0)>0 {
            if firstPrimaryID==nil {firstPrimaryID=event.tileIDs.first}
            else {assignments.append(CACurrentMediaTime());if assignments.count==4 {batch.fulfill()}}
        }}
        scene.onStateChange={_ in
            if firstPrimaryID != nil,firstArrivalTime==nil,engine.pendingWildSpawnArrivals.isEmpty,engine.directWildGameplayCommitted {firstArrivalTime=CACurrentMediaTime()}
        }
        try drop(scene);await fulfillment(of:[batch],timeout:4)
        XCTAssertGreaterThanOrEqual(assignments[0]-(firstArrivalTime ?? 0),0.035)
        XCTAssertGreaterThanOrEqual(assignments[1]-assignments[0],0.035)
        XCTAssertGreaterThanOrEqual(assignments[2]-assignments[1],0.060)
        XCTAssertGreaterThanOrEqual(assignments[3]-assignments[2],0.060)
        XCTAssertEqual(engine.state.moves,49);XCTAssertTrue(engine.pendingWildSpawnArrivals.isEmpty)
    }

    func testSourceEndgame50AssignsUnderPauseWhileActual560BounceRemainsFrozen() async throws {
        let engine=make(.juice),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let main=expectation(description:"Actual80 main committed before pause"),assigned=expectation(description:"Source50 wall timer still assigns under pause"),arrived=expectation(description:"Actual560 bounce resumes after global pause")
        var firstID:String?,mainAt:TimeInterval?,firstArrived=false
        scene.onGameplayEvent={ [weak scene] event in
            if event.kind == .merged,event.archetype == .juice {mainAt=CACurrentMediaTime();scene?.setSuspended(true);main.fulfill()}
            if event.kind == .spawned,(event.value ?? 0)>0,firstID==nil {firstID=event.tileIDs.first;assigned.fulfill()}
        }
        scene.onStateChange={_ in if let firstID,!firstArrived,!engine.pendingWildSpawnArrivals.contains(where:{$0.tileID==firstID}) {
            firstArrived=true;arrived.fulfill()
        }}
        try drop(scene);await fulfillment(of:[main,assigned],timeout:3)
        XCTAssertGreaterThanOrEqual(CACurrentMediaTime()-(mainAt ?? 0),0.035)
        let pausedState=engine.state,receipt=try XCTUnwrap(engine.pendingWildSpawnArrivals.first)
        try await Task.sleep(for:.milliseconds(650))
        XCTAssertEqual(engine.state,pausedState);XCTAssertTrue(engine.pendingWildSpawnArrivals.contains(receipt))
        XCTAssertFalse(firstArrived);XCTAssertTrue(engine.hasUnsavableSourceGameplayState)
        scene.setSuspended(false);await fulfillment(of:[arrived],timeout:3)
        XCTAssertEqual(engine.state.moves,49)
    }
    func testGenerationReplacementCancelsSource50WallTimerEvenDuringPause() async throws {
        let engine=make(.star),(scene,window,renderer)=mount(engine);defer{release(scene,window,renderer)}
        let main=expectation(description:"Actual80 starts captured source timer")
        var spawned=0,blocked=0
        scene.onGameplayEvent={ [weak scene] event in
            if event.kind == .merged {scene?.setSuspended(true);main.fulfill()}
            if event.kind == .spawned,(event.value ?? 0)>0 {spawned+=1}
            if event.kind == .blocked {blocked+=1}
        }
        try drop(scene);await fulfillment(of:[main],timeout:3)
        engine.restart(state:NativeBoardState(tiles:[NativeTile(id:"fresh",cell:.init(column:0,row:0),value:2)],board:10,rngState:88))
        scene.synchronize();let fresh=engine.state
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(engine.state,fresh);XCTAssertEqual(spawned,0);XCTAssertEqual(blocked,0)
        scene.setSuspended(false)
    }

}
