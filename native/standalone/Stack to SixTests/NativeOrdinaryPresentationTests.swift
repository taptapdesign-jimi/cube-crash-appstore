import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeOrdinaryPresentationTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private func tile(_ id:String,_ column:Int,_ value:Int)->NativeTile {NativeTile(id:id,cell:NativeCell(column:column,row:0),value:value)}
    private func mounted(_ tiles:[NativeTile])->(UIWindow,SKView,NativeBoardScene) {
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:tiles)),resourceRoot:root,size:CGSize(width:390,height:844))
        scene.layout(size:scene.size,insets:.zero)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        return (window,renderer,scene)
    }
    private func point(_ scene:NativeBoardScene,_ column:Int)->CGPoint {scene.boardGeometry!.center(row:0,column:column)}
    func testStackRejectsExternalDropUntilActualAbsorbButKeepsPickup() async throws {
        let (window,renderer,scene)=mounted([tile("a",0,1),tile("b",1,1),tile("c",2,1),tile("d",3,1),tile("e",4,2)])
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:point(scene,1),now:1)).accepted)
        XCTAssertTrue(scene.beginDrag(at:point(scene,2)));scene.moveDrag(to:point(scene,3))
        XCTAssertFalse(try XCTUnwrap(scene.finishDrag(at:point(scene,3),now:1.01)).accepted,"External drop is rejected by the captured80ms handoff")
        XCTAssertEqual(scene.engine.state.tiles.first {$0.id=="d"}?.value,1)
        let removed=expectation(description:"Actual native absorb releases drop handoff")
        scene.onGameplayEvent={event in if event.kind == .removed,event.tileIDs==["a"] {removed.fulfill()}}
        await fulfillment(of:[removed],timeout:3)
        XCTAssertTrue(scene.beginDrag(at:point(scene,2)));scene.moveDrag(to:point(scene,3))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:point(scene,3),now:1.2)).accepted)
    }
    func testBackgroundSettlesAcceptedStackShapeAndCancelsPostcheckDebit() {
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[tile("a",0,1),tile("b",1,2),tile("c",2,1)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844));scene.layout(size:scene.size,insets:.zero)
        defer {scene.dispose()}
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        let score=engine.state.score;XCTAssertGreaterThan(score,0)
        scene.setSuspended(true)
        XCTAssertNil(engine.pendingOrdinaryStack);XCTAssertTrue(engine.pendingOrdinaryPostchecks.isEmpty)
        XCTAssertNil(engine.state.tiles.first {$0.id=="a"});XCTAssertEqual(engine.state.tiles.first {$0.id=="b"}?.value,3)
        XCTAssertEqual(engine.state.moves,50,"Interrupted awaited postcheck cannot invent moves debit")
        XCTAssertEqual(engine.state.score,score);XCTAssertTrue(engine.state.validationIssues().isEmpty)
        scene.setSuspended(false);XCTAssertTrue(scene.beginDrag(at:point(scene,1)))
    }
    func testSixMainUsesLiveInterleavedStackAndRevokesOldSpawnPermit() async throws {
        let (window,renderer,scene)=mounted([tile("a",0,1),tile("b",1,5),tile("c",2,1),tile("d",3,1),tile("e",4,3)])
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let main=expectation(description:"Actual six absorb commits live counters")
        var spawned:[String]=[]
        scene.onGameplayEvent={event in
            if event.kind == .spawned {spawned+=event.tileIDs}
            if event.kind == .merged,event.value==6 {main.fulfill()}
        }
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        XCTAssertEqual(scene.engine.state.tiles.first {$0.id=="b"}?.value,6)
        XCTAssertEqual(scene.engine.state.score,0)
        XCTAssertTrue(scene.beginDrag(at:point(scene,2)));scene.moveDrag(to:point(scene,3))
        XCTAssertEqual(scene.finishDrag(at:point(scene,3),now:1.01)?.accepted,true,"Stable sub-six stack remains accepted during protected6")
        let stackScore=scene.engine.state.score
        XCTAssertGreaterThan(stackScore,0);XCTAssertEqual(scene.engine.state.moves,50)
        await fulfillment(of:[main],timeout:3)
        XCTAssertGreaterThan(scene.engine.state.score,stackScore)
        XCTAssertEqual(scene.engine.state.tiles.first {$0.id=="d"}?.value,2)
        XCTAssertNil(scene.engine.pendingOrdinarySix)
        XCTAssertEqual(spawned,[],"Newer accepted stack invalidates the older six spawn epoch")
    }
    func testAssignedSixSpawnCanBePickedUpBeforeItsDecorativeBounceFinishes() async throws {
        let (window,renderer,scene)=mounted([tile("a",0,1),tile("b",1,5),tile("c",2,1),tile("d",3,2)])
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let assigned=expectation(description:"Captured native primary assignment is acknowledged")
        var spawnedID:String?
        scene.onGameplayEvent={event in if event.kind == .spawned,spawnedID==nil {spawnedID=event.tileIDs.first;assigned.fulfill()}}
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        await fulfillment(of:[assigned],timeout:3)
        let tile=try XCTUnwrap(scene.engine.state.tiles.first {$0.id==spawnedID})
        XCTAssertTrue(scene.engine.pendingOrdinarySpawns.isEmpty);XCTAssertNotNil(scene.engine.pendingOrdinaryPrimaryArrival);XCTAssertNotNil(scene.engine.pendingOrdinarySix)
        XCTAssertTrue(scene.beginDrag(at:scene.boardGeometry!.center(row:tile.cell.row,column:tile.cell.column)),"Source permits pickup once assigned; bounce is interruptible")
        XCTAssertNil(scene.engine.pendingOrdinaryPrimaryArrival)
        XCTAssertNotNil(scene.engine.pendingOrdinarySix,"Independent main+100 cleanup still owns the handoff after pickup")
        let cleaned=expectation(description:"Independent captured cleanup consumes after primary interruption")
        scene.onStateChange={_ in if scene.engine.pendingOrdinarySix==nil {cleaned.fulfill();scene.onStateChange=nil}}
        await fulfillment(of:[cleaned],timeout:3)
        scene.cancelDrag()
        XCTAssertTrue(scene.engine.pendingOrdinarySpawns.isEmpty)
    }
    func testSixBackgroundCommitsMainOnceAndNeverReplaysItsOldGhost() async throws {
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[tile("a",0,1),tile("b",1,5),tile("c",2,1),tile("d",3,2)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844));scene.layout(size:scene.size,insets:.zero)
        defer {scene.dispose()}
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        XCTAssertEqual(engine.state.moves,50);XCTAssertEqual(engine.state.score,0)
        XCTAssertEqual(engine.state.tiles.first {$0.id=="b"}?.value,6)
        scene.setSuspended(true);let settled=engine.state
        XCTAssertEqual(settled.moves,49);XCTAssertGreaterThan(settled.score,0);XCTAssertNil(engine.pendingOrdinarySix)
        scene.setSuspended(false)
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertEqual(engine.state,settled)
    }
    func testLockedOpeningUsesCapturedDelayAndRetainsPlaceholderIdentity() async throws {
        var a=tile("a",0,1),b=tile("b",1,5)
        a.stackDepth=2;b.stackDepth=2
        var lock1=tile("lock1",0,0),lock2=tile("lock2",1,0),lock3=tile("lock3",2,0)
        lock1.cell=NativeCell(column:0,row:1);lock1.locked=true
        lock2.cell=NativeCell(column:1,row:1);lock2.locked=true
        lock3.cell=NativeCell(column:2,row:1);lock3.locked=true
        let (window,renderer,scene)=mounted([a,b,tile("c",2,1),tile("d",3,2),lock1,lock2,lock3])
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let main=expectation(description:"Six main before selection"),prepared=expectation(description:"Captured current locked selection"),opened=expectation(description:"All captured locked callbacks")
        var mainTime=0.0,preparedTime=0.0,slots:[NativeOrdinaryAssignment]=[],arrivalTimes:[Double]=[],openedIDs:[String]=[]
        scene.onGameplayEvent={event in
            if event.kind == .merged,event.value==6 {
                mainTime=CACurrentMediaTime()
                XCTAssertTrue(scene.engine.pendingOrdinaryAssignments.isEmpty)
                XCTAssertEqual(scene.engine.state.tiles.filter {$0.locked}.count,3)
                main.fulfill()
            }
            if event.kind == .ordinaryAssignmentsPrepared {
                preparedTime=CACurrentMediaTime();slots=scene.engine.pendingOrdinaryAssignments
                XCTAssertEqual(slots.map(\.delayMilliseconds),[50,150,250])
                XCTAssertEqual(scene.engine.state.tiles.filter {$0.locked}.count,3)
                prepared.fulfill()
            }
            if event.kind == .spawned,slots.contains(where:{$0.id==event.reason}) {
                openedIDs+=event.tileIDs;arrivalTimes.append(CACurrentMediaTime())
                if openedIDs.count==3 {opened.fulfill()}
            }
        }
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        await fulfillment(of:[main,prepared,opened],timeout:4,enforceOrder:true)
        XCTAssertGreaterThanOrEqual(preparedTime-mainTime,0.035,"Source outer50ms must run after actual main")
        XCTAssertGreaterThanOrEqual(arrivalTimes[0]-preparedTime,0.035,"First locked face remains unchanged through the separate50ms preparation delay")
        XCTAssertGreaterThanOrEqual(arrivalTimes[2]-preparedTime,0.23,"Captured third opening uses250ms, independent of decorative bounce")
        XCTAssertEqual(openedIDs,slots.compactMap(\.tileID))
        XCTAssertEqual(Set(openedIDs),Set(["lock1","lock2","lock3"]))
        XCTAssertNil(scene.engine.pendingOrdinarySix)
        XCTAssertTrue(scene.engine.state.validationIssues().isEmpty)
        let first=try XCTUnwrap(scene.engine.state.tiles.first {$0.id==openedIDs[0]})
        XCTAssertTrue(scene.beginDrag(at:scene.boardGeometry!.center(row:first.cell.row,column:first.cell.column)),"Locked assignment is playable while its decoration continues")
    }

    func testPrimaryAwaitsActualBounceAndIndependentCleanupCannotRemoveFreshIdentity() async throws {
        let (window,renderer,scene)=mounted([tile("a",0,1),tile("b",1,5),tile("c",2,1),tile("d",3,2)])
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let assigned=expectation(description:"Primary assigned at source outer50ms"),released=expectation(description:"Actual primary bounce settles authoritative handoff")
        var freshID:String?,arrival=0.0
        scene.onGameplayEvent={event in
            if event.kind == .spawned,freshID==nil {
                freshID=event.tileIDs.first;arrival=CACurrentMediaTime()
                XCTAssertNotNil(scene.engine.pendingOrdinaryPrimaryArrival)
                XCTAssertNotNil(scene.engine.pendingOrdinaryDestinationCleanup)
                assigned.fulfill()
            }
        }
        scene.onStateChange={_ in
            if freshID != nil,scene.engine.pendingOrdinarySix==nil {released.fulfill();scene.onStateChange=nil}
        }
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        await fulfillment(of:[assigned,released],timeout:4,enforceOrder:true)
        XCTAssertGreaterThanOrEqual(CACurrentMediaTime()-arrival,0.52,"Primary awaits its actual original0.56s bounce")
        XCTAssertNil(scene.engine.pendingOrdinaryDestinationCleanup)
        XCTAssertEqual(scene.engine.state.tile(at:NativeCell(column:1,row:0))?.id,freshID)
        XCTAssertNil(scene.engine.state.tiles.first {$0.id=="b"})
        XCTAssertTrue(scene.engine.state.validationIssues().isEmpty)
    }

    func testBackgroundDuringCapturedDelayedBatchRevokesOldUICommands() async throws {
        var locked=tile("locked",2,0);locked.locked=true
        let (window,renderer,scene)=mounted([tile("a",0,1),tile("b",1,5),locked,tile("c",3,1),tile("d",4,2)])
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let prepared=expectation(description:"Captured delayed batch before first assignment")
        scene.onGameplayEvent={event in
            if event.kind == .ordinaryAssignmentsPrepared {prepared.fulfill()}
        }
        XCTAssertTrue(scene.beginDrag(at:point(scene,0)));scene.moveDrag(to:point(scene,1))
        XCTAssertEqual(scene.finishDrag(at:point(scene,1),now:1)?.accepted,true)
        await fulfillment(of:[prepared],timeout:3)
        scene.setSuspended(true)
        let settled=scene.engine.state
        XCTAssertNil(scene.engine.pendingOrdinarySix);XCTAssertTrue(scene.engine.pendingOrdinaryAssignments.isEmpty)
        XCTAssertFalse(try XCTUnwrap(settled.tiles.first {$0.id=="locked"}).locked)
        scene.onGameplayEvent=nil;scene.setSuspended(false)
        try await Task.sleep(for:.milliseconds(450))
        XCTAssertEqual(scene.engine.state,settled,"Retired native callbacks cannot replay after authoritative background settlement")
    }

}
