import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceBoardEntrySceneTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,draws=0,sounds=0,stops=0,completed:[NativeSourceBoardEntryOwner.Completion]=[]
        let fifo=NativeSourceMicrotaskFIFO()
        var service:NativeSourceAnimationClockService!,context:NativeGameplaySourceContext!,scope:NativeGameplaySourceContext.Scope!,construction:NativeSourceInitialBoardConstruction!,scene:NativeBoardScene!
        init(tutorial:Bool=false,hud:Bool=false) throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true)
            service.sourceMicrotaskTasks=tasks
            context=NativeGameplaySourceContext(service:service,visualRandom:{[weak self] in guard let self else{return 0};self.draws+=1;return Double((self.draws*37)%97)/97},sourceMicrotaskTasks:tasks)
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,tutorialDemo:tutorial,random:{[context] in context!.mathRandom.next()}))
            let engine=NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state))
            if tutorial {engine.sourceTutorialDemoActivationEnabled=true;XCTAssertNotNil(engine.beginSourceTutorialDemoActivation())}
            scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844),sourceInitialConstruction:construction)
            scope=try XCTUnwrap(context.beginScene(engine:engine){[weak self] in self?.scene.retireSourceAnimationBindings()})
            scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
            XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
            scene.sourceBoardEntryEnabled=true
            XCTAssertTrue(scene.configureSourceBoardEntry(scope:scope,sound:{[weak self] _,_,_ in guard let self else{return nil};self.sounds+=1;return{[weak self] in self?.stops+=1}},completed:{[weak self] receipt in
                guard let self else{return};XCTAssertTrue(self.fifo.isInsideCheckpoint);self.completed.append(receipt)
            }))
            if tutorial {scene.sourceTutorialHUDEnabled=hud;scene.sourceTutorialActivationEnabled=true;XCTAssertTrue(scene.configureSourceTutorialActivation(scope:scope))}
            scene.onPresentationFailure={XCTFail($0)}
            scene.synchronize(animateEntry:true)
        }
        func deliver(_ value:Double){wall=value;service.deliver(wallMilliseconds:value)}
        func dispose(){scene.dispose();context.dispose();service.dispose();fifo.dispose()}
    }
    func testGenuineSceneEntryOwnsSameConstructorNodesBeforeFaceRAFAndResolvesThroughFIFO()throws {
        let f=try Fixture();defer{f.dispose()}
        XCTAssertEqual(f.sounds,1);XCTAssertTrue(f.completed.isEmpty)
        let nodes=f.construction.nodes
        XCTAssertTrue(nodes.values.allSatisfy{$0.sourceBoardEntryBinding != nil && !$0.isHidden})
        let before=f.draws;f.deliver(16);XCTAssertGreaterThan(f.draws,before)
        let captured=try XCTUnwrap(nodes.values.first),pose=captured.position,scale=captured.sourceLocalScale
        f.scene.synchronize();XCTAssertEqual(captured.position,pose);XCTAssertEqual(captured.sourceLocalScale,scale)
        for time in stride(from:32.0,through:1200,by:16){f.deliver(time)}
        XCTAssertEqual(f.completed.map(\.outcome),[.normal]);XCTAssertEqual(f.stops,1)
        XCTAssertTrue(nodes.values.allSatisfy{$0.sourceBoardEntryBinding==nil})
        f.scene.synchronize()
        for (id,node) in nodes {XCTAssertTrue(f.scene.sourceNativeTileNode(id) === node);XCTAssertEqual(node.zPosition,node.locked ? 5:20)}
    }
    func testActualScopeRetirementKeepsPaintAndDropsLateEntryReaction()throws {
        let f=try Fixture();defer{f.dispose()};f.deliver(160)
        let node=try XCTUnwrap(f.construction.nodes.values.first),position=node.position,scale=node.sourceLocalScale
        f.scope.dispose();f.deliver(1000)
        XCTAssertEqual(node.position,position);XCTAssertEqual(node.sourceLocalScale,scale);XCTAssertNil(node.sourceBoardEntryBinding)
        XCTAssertTrue(f.completed.isEmpty);XCTAssertEqual(f.stops,1);XCTAssertEqual(f.fifo.pendingCount,0)
    }
    func testCanonicalStoredPositionUsesExactSpriteKitRepresentation() {
        let point=CGPoint(x:12.123456789,y:765.987654321),node=SKNode();node.position=point
        XCTAssertEqual(NativeBoardScene.sourceBoardEntryStoredPosition(point),node.position)
        XCTAssertNotEqual(NativeBoardScene.sourceBoardEntryStoredPosition(CGPoint(x:point.x+0.1,y:point.y)),node.position)
    }
    func testActualRelayoutAbortsEntryWithCanonicalScaleAndNoLateCompletion()throws {
        let f=try Fixture();defer{f.dispose()};f.deliver(160)
        let nodes=f.construction.nodes
        XCTAssertTrue(nodes.values.contains{abs($0.sourceLocalScale.x-1)>0.001})
        f.scene.layout(size:CGSize(width:393,height:852),insets:.zero)
        for node in nodes.values {XCTAssertNil(node.sourceBoardEntryBinding);XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6)}
        f.deliver(1200);XCTAssertTrue(f.completed.isEmpty);XCTAssertEqual(f.stops,1)
    }

    func testActualDemoEntryThenTwoRAFsWallPreparationAndPaintRetention()async throws {
        let f=try Fixture(tutorial:true);defer{f.dispose()}
        XCTAssertNotNil(f.scene.engine.pendingSourceTutorialDemoActivation);XCTAssertTrue(f.scene.engine.state.tutorial?.guidedPair.isEmpty==true)
        var wall=0.0
        while f.completed.isEmpty && wall<1500 {wall+=16;f.deliver(wall)}
        XCTAssertEqual(f.completed.map(\.outcome),[.normal]);XCTAssertEqual(f.scene.sourceTutorialActivationPhase,.frames)
        f.deliver(wall+16);XCTAssertEqual(f.scene.sourceTutorialActivationPhase,.frames)
        f.deliver(wall+32);XCTAssertEqual(f.scene.sourceTutorialActivationPhase,.waiting)
        XCTAssertFalse(f.scene.sourceTutorialPreparationReady)
        try await Task.sleep(for:.milliseconds(1350))
        XCTAssertTrue(f.scene.sourceTutorialPreparationReady);XCTAssertNil(f.scene.engine.pendingSourceTutorialDemoActivation)
        let pair=try XCTUnwrap(f.scene.engine.state.tutorial?.guidedPair);XCTAssertEqual(pair.count,2)
        f.deliver(wall+48);f.deliver(wall+64)
        let node=try XCTUnwrap(f.construction.nodes.values.first{!pair.contains($0.tileID)}),alpha=node.alpha,position=node.position
        f.scene.synchronize();XCTAssertEqual(node.alpha,alpha);XCTAssertEqual(node.position,position)
        XCTAssertTrue(f.scene.sourceNativeTileNode(node.tileID) === node)
    }
    func testActualDemoRouteRetirementCancelsPendingActivationAndPreservesBoard()async throws {
        let f=try Fixture(tutorial:true);defer{f.dispose()};var wall=0.0
        while f.completed.isEmpty && wall<1500 {wall+=16;f.deliver(wall)}
        f.deliver(wall+16);f.deliver(wall+32);XCTAssertEqual(f.scene.sourceTutorialActivationPhase,.waiting)
        let tiles=f.scene.engine.state.tiles,draws=f.draws;f.scope.dispose()
        try await Task.sleep(for:.milliseconds(1350));f.deliver(wall+1600)
        XCTAssertFalse(f.scene.sourceTutorialPreparationReady);XCTAssertEqual(f.scene.engine.state.tiles,tiles);XCTAssertEqual(f.draws,draws)
        XCTAssertNil(f.scene.engine.pendingSourceTutorialDemoActivation)
    }

    func testPreparedTutorialRelayoutKeepsFocusAndRepairsAtCurrentGeometry()async throws {
        let f=try Fixture(tutorial:true);defer{f.dispose()};var wall=0.0
        while f.completed.isEmpty && wall<1500 {wall+=16;f.deliver(wall)}
        f.deliver(wall+16);f.deliver(wall+32);f.service.setSourceForeground(false)
        try await Task.sleep(for:.milliseconds(1350))
        XCTAssertTrue(f.scene.sourceTutorialPreparationReady)
        let state=f.scene.engine.state,draws=f.draws,alphas=f.construction.nodes.mapValues(\.alpha)
        f.scene.layout(size:CGSize(width:430,height:932),insets:.zero)
        XCTAssertTrue(f.scene.sourceTutorialPreparationReady);XCTAssertEqual(f.scene.engine.state,state);XCTAssertEqual(f.draws,draws)
        let geometry=try XCTUnwrap(f.scene.boardGeometry)
        for tile in state.tiles {
            let node=try XCTUnwrap(f.construction.nodes[tile.id])
            XCTAssertEqual(node.position,NativeBoardScene.sourceBoardEntryStoredPosition(geometry.center(row:tile.cell.row,column:tile.cell.column)))
            XCTAssertEqual(node.alpha,alphas[tile.id]);XCTAssertTrue(f.scene.sourceNativeTileNode(tile.id) === node)
        }
        f.service.setSourceForeground(true);f.deliver(wall+48);f.deliver(wall+64)
        for tile in state.tiles {
            XCTAssertEqual(f.construction.nodes[tile.id]?.position,NativeBoardScene.sourceBoardEntryStoredPosition(geometry.center(row:tile.cell.row,column:tile.cell.column)))
        }
    }

    func testActualTutorialHUDScopeRetirementPreservesPaintAndCancelsWallClamp()async throws {
        let f=try Fixture(tutorial:true,hud:true);defer{f.dispose()};var wall=0.0
        while f.completed.isEmpty && wall<1500 {wall+=16;f.deliver(wall)}
        f.deliver(wall+16);f.deliver(wall+32);f.service.setSourceForeground(false)
        try await Task.sleep(for:.milliseconds(1500))
        XCTAssertTrue(f.scene.sourceTutorialHUDActive)
        XCTAssertTrue(f.scene.sourceTutorialHUDAlphas.allSatisfy{abs($0-0.2)<1e-6})
        let paint=f.scene.sourceTutorialHUDAlphas,state=f.scene.engine.state,draws=f.draws
        f.scope.dispose();XCTAssertFalse(f.scene.sourceTutorialHUDActive)
        try await Task.sleep(for:.milliseconds(170));f.service.setSourceForeground(true);f.deliver(wall+2000)
        XCTAssertEqual(f.scene.sourceTutorialHUDAlphas,paint);XCTAssertEqual(f.scene.engine.state,state);XCTAssertEqual(f.draws,draws)
    }

}
