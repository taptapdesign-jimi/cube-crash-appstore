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
        XCTAssertTrue(scene.engine.pendingOrdinarySpawns.isEmpty);XCTAssertNil(scene.engine.pendingOrdinarySix)
        XCTAssertTrue(scene.beginDrag(at:scene.boardGeometry!.center(row:tile.cell.row,column:tile.cell.column)),"Source permits pickup once assigned; bounce is interruptible")
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
}
