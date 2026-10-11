import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

/// Connected renderer delivery tests. Literal source callback/cadence and raw
/// monitor-order proofs remain separate; these tests do not fabricate samples.
@MainActor
final class NativeSourceTickerIntegrationTests:XCTestCase {
    private let viewport=CGSize(width:390,height:844)
    private func regular(_ id:String,_ column:Int,_ value:Int=1)->NativeTile {
        NativeTile(id:id,cell:NativeCell(column:column,row:0),value:value)
    }
    private func makeController()->(NativeGameplayViewController,UIWindow) {
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,
            tiles:[regular("a",0),regular("b",1,2),regular("c",2,4)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(origin:.zero,size:viewport));window.rootViewController=controller
        window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        return (controller,window)
    }
    private func renderer(_ controller:NativeGameplayViewController)throws->SKView {
        try XCTUnwrap(controller.view.subviews.compactMap {$0 as? SKView}.first)
    }
    private func waitFor(_ description:String,timeout:Double=5,_ condition:()->Bool)async throws {
        let deadline=CACurrentMediaTime()+timeout
        while !condition(),CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(condition(),description)
    }
    private func fishScene()->NativeBoardScene {
        let fish=(0..<2).map {NativeTile(id:"fish-\($0)",cell:NativeCell(column:$0,row:0),value:0,archetype:.star,variant:"fish")}
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:fish+[regular("ordinary",2)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:viewport)
        scene.layout(size:viewport,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
        for tile in fish {scene.prepareFishMedia(tileID:tile.id,generation:engine.state.generation)}
        return scene
    }
    private func host(_ scene:NativeBoardScene)->(UIWindow,SKView) {
        let window=UIWindow(frame:CGRect(origin:.zero,size:viewport)),controller=UIViewController(),view=SKView(frame:window.bounds)
        controller.view=view;window.rootViewController=controller
        scene.onFrameTarget={view.preferredFramesPerSecond=$0}
        scene.onRenderingDemand={view.isPaused = !$0}
        window.makeKeyAndVisible();view.presentScene(scene)
        return (window,view)
    }

    func testActualQuietVisibleBoardKeepsItsExistingTickerAt15()async throws {
        let (controller,window)=makeController()
        let view=try renderer(controller)
        defer{controller.dispose();window.isHidden=true}
        let scene=try XCTUnwrap(controller.boardScene)
        try await waitFor("Actual entry completes and its captured100ms tails retire") {
            scene.isBoardEntryComplete && scene.sourceFrameSnapshot.maxFPS==15
        }
        XCTAssertTrue(scene.sourceFrameSnapshot.active);XCTAssertFalse(scene.sourceFrameSnapshot.sleeping)
        XCTAssertEqual(scene.sourceFrameSnapshot.activityLeaseCount,0)
        XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,0)
        XCTAssertEqual(view.preferredFramesPerSecond,15);XCTAssertFalse(view.isPaused);XCTAssertFalse(scene.isPaused)
        let painted=expectation(description:"Existing quiet15 ticker advances a real SpriteKit completion")
        scene.run(.sequence([.wait(forDuration:0.15),.run{painted.fulfill()}]),withKey:"quiet-source-ticker-observer")
        await fulfillment(of:[painted],timeout:3)
        XCTAssertEqual(view.preferredFramesPerSecond,15);XCTAssertFalse(view.isPaused)
    }

    func testRegisteredSpecialPopulationKeeps30WhileItsRealPhaseIsWaiting()async throws {
        let scene=fishScene()
        defer{scene.dispose()}
        let nodes=try (0..<2).map {try XCTUnwrap(scene.childNode(withName:"//native-die-fish-\($0)") as? NativeDiceNode)}
        let pending=nodes.compactMap {$0.fishFrame(in:scene,visible:false)}
        XCTAssertEqual(pending.count,2)
        XCTAssertTrue(pending.contains {!$0.phaseStarted},"Actual shared family admission contains a waiting phase before any renderer tick")
        XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,1,"Registration does not wait for media/phase readiness")
        let (window,view)=host(scene)
        defer{view.presentScene(nil);window.isHidden=true}
        try await waitFor("Existing renderer delivers canonical registered-population cap30",timeout:2) {scene.sourceFrameSnapshot.maxFPS==30}
        XCTAssertEqual(view.preferredFramesPerSecond,30);XCTAssertFalse(view.isPaused)
        XCTAssertEqual(scene.sourceFrameSnapshot.activityLeaseCount,0)
        XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,1)
    }

    func testCapturedNestedSourceScopesSuspendOnePopulationUntilLastRealCleanup()async throws {
        let scene=fishScene()
        let (window,view)=host(scene)
        defer{scene.dispose();view.presentScene(nil);window.isHidden=true}
        try await waitFor("Renderer attaches registered idle",timeout:2) {scene.sourceFrameSnapshot.maxFPS==30}
        var suspensionReceipts:[Bool]=[];scene.onSpecialIdleSuspended={suspensionReceipts.append($0)}
        let generation=scene.engine.state.generation
        let releaseStack=try XCTUnwrap(scene.beginSourceMotion(.regularMergeHandoff,id:"captured-stack",generation:generation))
        let releaseSix=try XCTUnwrap(scene.beginSourceMotion(.mergeSixResolution,id:"captured-six",generation:generation))
        XCTAssertEqual(scene.sourceFrameSnapshot.activityLeaseCount,2)
        XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,0);XCTAssertEqual(view.preferredFramesPerSecond,60)
        XCTAssertEqual(suspensionReceipts,[true])
        // This exercises the typed captured-owner API. The gameplay callback
        // graphs themselves are proved independently against original source.
        releaseStack();releaseStack()
        XCTAssertEqual(scene.sourceFrameSnapshot.activityLeaseCount,1);XCTAssertEqual(scene.sourceFrameSnapshot.settledMotionLeaseCount,0)
        XCTAssertEqual(suspensionReceipts,[true])
        let cleanup=expectation(description:"Existing renderer executes captured final cleanup")
        scene.run(.run{releaseSix();cleanup.fulfill()},withKey:"captured-source-cleanup")
        await fulfillment(of:[cleanup],timeout:3)
        let released=scene.sourceFrameSnapshot
        XCTAssertEqual(released.activityLeaseCount,0);XCTAssertEqual(released.settledMotionLeaseCount,1)
        XCTAssertEqual(suspensionReceipts,[true,false]);releaseSix()
        XCTAssertEqual(scene.sourceFrameSnapshot,released,"Late duplicate cleanup cannot extend a paint tail")
        try await waitFor("Actual captured100/180 tails settle back to registered30",timeout:2) {scene.sourceFrameSnapshot.maxFPS==30}
        XCTAssertEqual(view.preferredFramesPerSecond,30);XCTAssertFalse(view.isPaused)
    }

    func testPausePreservesActualRiseOwnersAndTargetSetterCannotResumeCoveredView()async throws {
        let (controller,window)=makeController()
        let view=try renderer(controller)
        defer{controller.dispose();window.isHidden=true}
        let scene=try XCTUnwrap(controller.boardScene)
        try await waitFor("Initial captured wave completes") {scene.isBoardEntryComplete && scene.sourceFrameSnapshot.maxFPS==15}
        controller.setSuspended(true)
        XCTAssertTrue(view.isPaused);XCTAssertTrue(scene.isPaused)
        let release=try XCTUnwrap(scene.beginSourceMotion(.spawnBounce,id:"captured-modal-source-scope",generation:scene.engine.state.generation))
        XCTAssertEqual(view.preferredFramesPerSecond,60,"Actual source target setter runs even while delivery is covered")
        XCTAssertTrue(view.isPaused);XCTAssertTrue(scene.isPaused)
        release()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(view.isPaused);XCTAssertTrue(scene.isPaused)
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        var exits=0
        let completed=expectation(description:"Actual existing-clock HUD/board exit completes after resume")
        scene.animateExit{success in XCTAssertTrue(success);exits+=1;completed.fulfill()}
        scene.setSuspended(true)
        let captured=scene.sourceFrameSnapshot,start=hud.position,alpha=hud.alpha,state=scene.engine.state
        XCTAssertGreaterThanOrEqual(captured.activityLeaseCount,2)
        try await Task.sleep(for:.milliseconds(400))
        XCTAssertEqual(exits,0);XCTAssertEqual(scene.sourceFrameSnapshot,captured)
        XCTAssertEqual(scene.engine.state,state);XCTAssertEqual(hud.position,start);XCTAssertEqual(hud.alpha,alpha)
        controller.setSuspended(false)
        await fulfillment(of:[completed],timeout:5)
        XCTAssertEqual(exits,1);XCTAssertEqual(scene.sourceFrameSnapshot.activityLeaseCount,0)
        XCTAssertEqual(hud.alpha,0,accuracy:0.000001)
    }
}
