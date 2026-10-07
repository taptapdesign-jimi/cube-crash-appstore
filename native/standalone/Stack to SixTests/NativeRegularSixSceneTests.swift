import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeRegularSixSceneTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private func tile(_ id:String,_ column:Int,_ value:Int)->NativeTile {NativeTile(id:id,cell:NativeCell(column:column,row:0),value:value)}
    private func mounted()->(UIWindow,SKView,NativeBoardScene) {
        var lock1=tile("lock1",0,0),lock2=tile("lock2",1,0)
        lock1.cell=NativeCell(column:0,row:1);lock1.locked=true
        lock2.cell=NativeCell(column:1,row:1);lock2.locked=true
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[tile("a",0,1),tile("b",1,5),tile("c",2,1),tile("d",3,2),lock1,lock2]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844));scene.layout(size:scene.size,insets:.zero)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        renderer.ignoresSiblingOrder=false;controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        return(window,renderer,scene)
    }
    func testContactCapturesActualXYScaleAndMainMountsSourceDepthPlanesInsideShakenCanvas() async throws {
        let(window,renderer,scene)=mounted();defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let canvas=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas"))
        let destination=try XCTUnwrap(canvas.childNode(withName:"native-die-b") as? NativeDiceNode)
        destination.visual.xScale=1.08;destination.visual.yScale=0.92
        let from=scene.boardGeometry!.center(row:0,column:0),to=scene.boardGeometry!.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertEqual(scene.finishDrag(at:to,now:1)?.accepted,true)
        XCTAssertEqual(destination.visual.xScale,1.08,accuracy:1e-6);XCTAssertEqual(destination.visual.yScale,0.92,accuracy:1e-6)
        XCTAssertNotNil(destination.visual.action(forKey:"source-ordinary-six-hero"))
        let main=expectation(description:"Exact native six main")
        scene.onGameplayEvent={event in if event.kind == .merged,event.value==6 {main.fulfill()}}
        await fulfillment(of:[main],timeout:3)
        let carrier=try XCTUnwrap(canvas.children.compactMap {$0 as? NativeRegularSixSpritePresentation}.first)
        XCTAssertTrue(carrier.parent===canvas,"Source shard z planes must share the die canvas, without an above-all UIView wrapper")
        XCTAssertEqual(carrier.shardLayer.zPosition,1);XCTAssertEqual(carrier.smokeLayer.zPosition,9990);XCTAssertEqual(carrier.multiplierLayer.zPosition,10000)
        XCTAssertTrue(try XCTUnwrap(scene.childNode(withName:"native-game-round-indicator")).parent===scene)
        let snapshot=canvas.position
        XCTAssertTrue(snapshot.x.isFinite && snapshot.y.isFinite)
        let logical=scene.boardGeometry!.center(row:0,column:2),physical=scene.convert(logical,from:canvas)
        XCTAssertTrue(scene.beginDrag(at:physical),"Native touch hit tests use the translated Pixi-equivalent canvas")
        scene.cancelDrag()
        let retained=expectation(description:"Captured decoration finishes on its own source1s clock")
        scene.onStateChange={_ in
            if scene.engine.pendingOrdinarySix==nil {retained.fulfill();scene.onStateChange=nil}
        }
        await fulfillment(of:[retained],timeout:3)
        XCTAssertTrue(carrier.parent===canvas,"Logical locked openings do not retire the independent accepted smoke/shard/multiplier tail")
        try await Task.sleep(for:.milliseconds(950))
        XCTAssertNil(carrier.parent);XCTAssertEqual(canvas.position,.zero)
    }
    func testBackgroundPausesDecorativeClockAndRestartRevokesOldShakeWithoutMovingNewCanvas() async throws {
        let(window,renderer,scene)=mounted();defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let main=expectation(description:"Accepted main")
        scene.onGameplayEvent={event in if event.kind == .merged,event.value==6 {main.fulfill()}}
        let from=scene.boardGeometry!.center(row:0,column:0),to=scene.boardGeometry!.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to);XCTAssertEqual(scene.finishDrag(at:to,now:1)?.accepted,true)
        await fulfillment(of:[main],timeout:3)
        let canvas=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas")),owner=try XCTUnwrap(canvas.children.compactMap {$0 as? NativeRegularSixSpritePresentation}.first)
        scene.setSuspended(true);let pose=canvas.position
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(canvas.position,pose);XCTAssertNotNil(owner.parent)
        var fresh=NativeBoardState(columns:5,rows:9,tiles:[tile("x",0,1),tile("y",1,1),tile("z",2,2)])
        fresh.generation=scene.engine.state.generation+1
        scene.engine.restart(state:fresh);scene.synchronize();scene.setSuspended(false)
        XCTAssertNil(owner.parent);XCTAssertEqual(canvas.position,.zero)
        try await Task.sleep(for:.milliseconds(500))
        XCTAssertEqual(canvas.position,.zero);XCTAssertEqual(scene.engine.state.tiles.map(\.id),["x","y","z"])
    }
}
