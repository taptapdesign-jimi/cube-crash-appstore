import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialSecondStepTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,current=true,draws=0
        let fifo=NativeSourceMicrotaskFIFO()
        var service:NativeSourceAnimationClockService!,construction:NativeSourceInitialBoardConstruction!,owner:NativeSourceTutorialSecondStepPreparation!
        var scene:NativeBoardScene!,driver:NativeSourceOuterTimelineAdapter!
        var one:NativeDiceNode!,merged:NativeDiceNode!,ordered:[NativeDiceNode]=[]
        init()throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,tutorialDemo:true,random:{0.25}))
            let state=try XCTUnwrap(construction.recipe?.state)
            scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
            driver=NativeSourceOuterTimelineAdapter(service:service);scene.sourceOuterTimelineDriver=driver
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0));deliver(16)
            let cells=NativeTutorialRules.guidedCells(columns:state.columns,rows:state.rows)
            merged=try XCTUnwrap(construction.nodes[try XCTUnwrap(state.tile(at:cells.two)).id])
            one=try XCTUnwrap(construction.nodes[try XCTUnwrap(state.tile(at:cells.one)).id])
            let removed=try XCTUnwrap(construction.nodes[try XCTUnwrap(state.tile(at:cells.three)).id]);removed.removeFromParent()
            ordered=state.tiles.compactMap{let node=construction.nodes[$0.id];return node?.parent === construction.canvas ? node:nil}
            XCTAssertTrue(merged.forceSourceTutorialInitialValue(5))
            owner=try XCTUnwrap(NativeSourceTutorialSecondStepPreparation(service:service,random:{[weak self] in self?.draws+=1;return 0.5},nodes:ordered,merged:merged,one:one,parent:construction.canvas,generation:state.generation,onePosition:CGPoint(x:230,y:610),current:{[weak self] in self?.current==true}))
        }
        func deliver(_ ms:Double){wall=ms;service.deliver(wallMilliseconds:ms)}
        func dispose(){owner.dispose();scene.dispose();construction.dispose();driver.dispose();service.dispose();fifo.dispose()}
    }
    func testLiteralSurvivingObjectOrderDrawCountAndOnePopChannels()throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.prepare());XCTAssertFalse(f.owner.prepare())
        XCTAssertEqual(f.draws,84);XCTAssertEqual(f.one.position,CGPoint(x:230,y:610));XCTAssertEqual(f.one.alpha,0)
        XCTAssertEqual(f.one.sourceLocalScale.x,0.72,accuracy:1e-6)
        XCTAssertEqual(f.merged.sourceEventMode,"static");XCTAssertEqual(f.one.sourceEventMode,"static")
        XCTAssertTrue(f.ordered.filter{$0 !== f.one && $0 !== f.merged}.allSatisfy{$0.sourceEventMode=="none"})
        for time in stride(from:32.0,through:900,by:16){f.deliver(time)}
        XCTAssertEqual(f.one.alpha,1,accuracy:1e-6);XCTAssertEqual(f.one.sourceLocalScale.x,1,accuracy:1e-6)
        XCTAssertTrue(f.ordered.filter{$0 !== f.one && $0 !== f.merged}.allSatisfy{abs($0.alpha-0.2)<1e-6})
        XCTAssertEqual(f.draws,84);XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testWallTimeAndPausedGSAPCannotDeliverSecondStepOnePop()async throws {
        let f=try Fixture();defer{f.dispose()};_=f.service.setSourceGlobalPaused(true);XCTAssertTrue(f.owner.prepare())
        try await Task.sleep(for:.milliseconds(450));f.deliver(1000)
        XCTAssertEqual(f.one.alpha,0);XCTAssertEqual(f.one.sourceLocalScale.x,0.72,accuracy:1e-6)
        _=f.service.setSourceGlobalPaused(false)
        for time in stride(from:1016.0,through:1800,by:16){f.deliver(time)}
        XCTAssertEqual(f.one.alpha,1,accuracy:1e-6);XCTAssertEqual(f.one.sourceLocalScale.x,1,accuracy:1e-6)
    }
    func testDisposePreservesCurrentPaintAndCannotRunLateRepairOrMath()throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.prepare());f.deliver(32)
        let alpha=f.one.alpha,scale=f.one.sourceLocalScale,draws=f.draws
        f.owner.dispose();XCTAssertFalse(f.owner.repair())
        for time in stride(from:48.0,through:900,by:16){f.deliver(time)}
        XCTAssertEqual(f.one.alpha,alpha);XCTAssertEqual(f.one.sourceLocalScale,scale);XCTAssertEqual(f.draws,draws)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
}
