import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeSourceLogicalWallTimerTests:XCTestCase {
    private var root:URL {NativeTestResources.root}
    private func tile(_ id:String,_ c:Int,_ value:Int,_ r:Int=0)->NativeTile {NativeTile(id:id,cell:.init(column:c,row:r),value:value)}
    private func mount(_ tiles:[NativeTile],randomChoices:[Double]=[])->(NativeBoardScene,UIWindow,SKView) {
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10,rngState:12345),recordedRandomChoices:randomChoices)
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844));scene.layout(size:scene.size,insets:.zero)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),vc=UIViewController(),view=SKView(frame:window.bounds)
        vc.view=view;window.rootViewController=vc;window.makeKeyAndVisible();view.presentScene(scene)
        return(scene,window,view)
    }
    private func release(_ scene:NativeBoardScene,_ window:UIWindow,_ view:SKView) {scene.dispose();view.presentScene(nil);window.isHidden=true}
    private func drop(_ scene:NativeBoardScene)throws {
        let geometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:100)).accepted)
    }
    func testOriginalPostcheck100DebitsOnceUnderAnimationPauseAfterActual80Absorb() async throws {
        let(scene,window,view)=mount([tile("a",0,1),tile("b",1,2),tile("c",2,1),tile("d",3,1),tile("e",4,2)])
        defer{release(scene,window,view)}
        let prepared=expectation(description:"Actual80 entered original100 wait"),debited=expectation(description:"Original100 logical callback runs under pause")
        var waiting=false,done=false
        scene.onGameplayEvent={ [weak scene] event in if event.kind == .ordinaryPostcheckPrepared {
            waiting=true;XCTAssertEqual(scene?.engine.state.moves,50);scene?.setSuspended(true);prepared.fulfill()
        }}
        scene.onStateChange={state in if waiting,!done,scene.engine.pendingOrdinaryPostchecks.isEmpty {done=true;XCTAssertEqual(state.moves,49);debited.fulfill()}}
        try drop(scene);await fulfillment(of:[prepared,debited],timeout:3)
        XCTAssertNil(scene.engine.pendingOrdinaryStack);XCTAssertNil(scene.engine.state.tiles.first{$0.id=="a"})
        let state=scene.engine.state;try await Task.sleep(for:.milliseconds(200));XCTAssertEqual(scene.engine.state,state)
        scene.setSuspended(false);try await Task.sleep(for:.milliseconds(150));XCTAssertEqual(scene.engine.state.moves,49)
    }
    func testOriginalPrepare50AndLocked50_150_250CommitUnderPauseWithoutFakeBounceArrival() async throws {
        var a=tile("a",0,1),b=tile("b",1,5);a.stackDepth=2;b.stackDepth=2
        var locks=(0..<3).map{tile("l\($0)",$0,0,1)};for i in locks.indices{locks[i].locked=true}
        let(scene,window,view)=mount([a,b,tile("c",2,1),tile("d",3,2)]+locks);defer{release(scene,window,view)}
        let prepared=expectation(description:"Source outer50 selects under pause"),assigned=expectation(description:"Three original locked wall callbacks")
        var values:[String]=[],expectThree=false
        scene.onGameplayEvent={ [weak scene] event in
            if event.kind == .merged,event.value==6 {scene?.setSuspended(true)}
            if event.kind == .ordinaryAssignmentsPrepared {XCTAssertEqual(scene?.engine.pendingOrdinaryAssignments.map(\.delayMilliseconds),[50,150,250]);expectThree=true;prepared.fulfill()}
            if event.kind == .spawned,expectThree,(event.value ?? 0)>0 {values+=event.tileIDs;if values.count==3{assigned.fulfill()}}
        }
        try drop(scene);await fulfillment(of:[prepared,assigned],timeout:3)
        XCTAssertEqual(Set(values),Set(locks.map(\.id)))
        XCTAssertNil(scene.engine.pendingOrdinarySix,"Source finally may release logical handoff while decorative bounces are paused")
        XCTAssertNil(scene.engine.pendingOrdinaryPrimaryArrival)
        XCTAssertEqual(scene.engine.state.moves,49)
        let state=scene.engine.state;try await Task.sleep(for:.milliseconds(650));XCTAssertEqual(scene.engine.state,state)
        scene.setSuspended(false)
    }
    func testOriginalTntThirdImpact400CreditRunsUnderPauseWithoutOtherCounterOrRngChanges() async throws {
        var tiles=[NativeTile(id:"tnt",cell:.init(column:0,row:0),value:6,archetype:.tnt),tile("d",1,2),tile("a",2,1),tile("b",3,2),tile("c",4,3)]
        tiles += (0..<10).map{tile("extra\($0)",$0%5,$0%2==0 ? 1:5,1+$0/5)}
        let(scene,window,view)=mount(tiles);defer{release(scene,window,view)}
        let prepared=expectation(description:"Actual third TNT impact captures Source400"),credited=expectation(description:"Original400 charge runs under animation pause")
        var captured:NativeMeterRewardReceipt?,before:NativeBoardState?,done=false
        scene.onGameplayEvent={ [weak scene] event in if event.kind == .meterRewardPrepared,captured==nil,let scene,let receipt=scene.engine.pendingMeterRewards.first {
            XCTAssertEqual(receipt.delay,0.4);captured=receipt;before=scene.engine.state;scene.setSuspended(true);prepared.fulfill()
        }}
        scene.onStateChange={state in if let captured,let before,!done,!scene.engine.pendingMeterRewards.contains(where:{$0.id==captured.id}) {
            done=true;let increment=NativeWildMeterRules.increment(base:captured.base,mode:before.mode,board:before.board,spawnCount:before.wildSpawnCount,tutorialSlow:false)
            XCTAssertEqual(state.wildMeter,before.wildMeter+increment,accuracy:1e-9);XCTAssertEqual(state.moves,before.moves)
            XCTAssertEqual(state.score,before.score);XCTAssertEqual(state.rngState,before.rngState);credited.fulfill()
        }}
        try drop(scene);await fulfillment(of:[prepared,credited],timeout:8)
        XCTAssertTrue(done);scene.setSuspended(false)
    }
    private func lockedFixture()->[NativeTile] {
        var locks=(0..<2).map{tile("l\($0)",$0,0,1)};for i in locks.indices{locks[i].locked=true}
        return [tile("a",0,1),tile("b",1,5),tile("c",2,1),tile("d",3,2)]+locks
    }
    func testActualLevelFlowCompletion160RepairsScaleAndAlphaUnderPauseWithoutKillingRotation() async throws {
        let(scene,window,view)=mount(lockedFixture(),randomChoices:Array(repeating:0,count:100));defer{release(scene,window,view)}
        let completed=expectation(description:"Actual completed level-flow560 owns Source160")
        var target:NativeDiceNode?,captured=false
        scene.onLevelFlowBounceCompletion={ [weak scene] id,_ in
            guard let scene,!captured,let node=scene.childNode(withName:"//native-die-"+id) as? NativeDiceNode else{return}
            captured=true;target=node;scene.setSuspended(true)
            node.visual.setScale(1.75);node.alpha=0.3
            node.visual.run(.scale(to:2,duration:2),withKey:"source-ordinary-six-hero")
            node.visual.run(.rotate(toAngle:0.9,duration:2),withKey:"unrelated-rotation")
            completed.fulfill()
        }
        try drop(scene);await fulfillment(of:[completed],timeout:4)
        let node=try XCTUnwrap(target),rotation=node.visual.zRotation
        try await Task.sleep(for:.milliseconds(230))
        XCTAssertEqual(node.visual.xScale,1,accuracy:1e-9);XCTAssertEqual(node.alpha,1,accuracy:1e-9)
        XCTAssertNil(node.visual.action(forKey:"source-ordinary-six-hero"))
        XCTAssertNotNil(node.visual.action(forKey:"unrelated-rotation"));XCTAssertEqual(node.visual.zRotation,rotation)
        scene.setSuspended(false)
    }
    func testActualPickupInterruptionReleasesCapturedBounceAndNeverSchedulesCompleted160Repair() async throws {
        let(scene,window,view)=mount(lockedFixture(),randomChoices:Array(repeating:0,count:100));defer{release(scene,window,view)}
        let picked=expectation(description:"Actual assigned locked pickup interrupts scale bounce")
        var firstID:String?,interrupted=false,completedIDs:[String]=[]
        scene.onLevelFlowBounceCompletion={id,_ in completedIDs.append(id)}
        scene.onGameplayEvent={event in if event.kind == .spawned,firstID==nil,(event.value ?? 0)>0 {firstID=event.tileIDs.first}}
        scene.onStateChange={ [weak scene] _ in
            guard let scene,let firstID,!interrupted,let tile=scene.engine.state.tiles.first(where:{$0.id==firstID}),let geometry=scene.boardGeometry else{return}
            interrupted=true;XCTAssertTrue(scene.beginDrag(at:geometry.center(row:tile.cell.row,column:tile.cell.column)));picked.fulfill()
        }
        try drop(scene);await fulfillment(of:[picked],timeout:4)
        let id=try XCTUnwrap(firstID),node=try XCTUnwrap(scene.childNode(withName:"//native-die-"+id) as? NativeDiceNode)
        try await Task.sleep(for:.milliseconds(800))
        XCTAssertFalse(completedIDs.contains(id));XCTAssertEqual(node.visual.xScale,1.08,accuracy:1e-6)
        scene.cancelDrag()
    }
    func testActualUnpickedDestinationMergeRetiresOldWrappedLeaseBeforeFeedbackKillsItsAction() async throws {
        let(scene,window,view)=mount(lockedFixture(),randomChoices:Array(repeating:0,count:100));defer{release(scene,window,view)}
        let replaced=expectation(description:"Actual sub-six drop interrupts unpicked destination bounce")
        var firstID:String?,handled=false,completedIDs:[String]=[]
        scene.onLevelFlowBounceCompletion={id,_ in completedIDs.append(id)}
        scene.onGameplayEvent={event in if event.kind == .spawned,firstID==nil,(event.value ?? 0)>0 {firstID=event.tileIDs.first}}
        scene.onStateChange={ [weak scene] _ in
            guard let scene,let firstID,!handled,let target=scene.engine.state.tiles.first(where:{$0.id==firstID}),let geometry=scene.boardGeometry else{return}
            handled=true;XCTAssertEqual(scene.sourceWrappedSpawnCount,1)
            XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:2)))
            XCTAssertTrue(scene.finishDrag(at:geometry.center(row:target.cell.row,column:target.cell.column),now:101)?.accepted==true)
            XCTAssertEqual(scene.sourceWrappedSpawnCount,0,"Retired old capture cannot leak when feedback removes scale action")
            replaced.fulfill()
        }
        try drop(scene);await fulfillment(of:[replaced],timeout:4)
        try await Task.sleep(for:.milliseconds(800))
        XCTAssertFalse(completedIDs.contains(try XCTUnwrap(firstID)));XCTAssertEqual(scene.sourceWrappedSpawnCount,0)
    }
}
