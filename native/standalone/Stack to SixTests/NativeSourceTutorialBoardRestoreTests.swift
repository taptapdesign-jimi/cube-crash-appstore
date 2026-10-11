import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialBoardRestoreTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,current=true,draws=0,keys:[Double]=[]
        let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        var service:NativeSourceAnimationClockService!,construction:NativeSourceInitialBoardConstruction!,intro:NativeSourceTutorialIntroOwner!,restore:NativeSourceTutorialBoardRestoreOwner!
        var scene:NativeBoardScene!,driver:NativeSourceOuterTimelineAdapter!
        var targets:[NativeDiceNode]=[]
        init()throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo);timeouts.sourceMicrotaskTasks=tasks
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,tutorialDemo:true,random:{0.25}))
            let state=try XCTUnwrap(construction.recipe?.state)
            scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
            driver=NativeSourceOuterTimelineAdapter(service:service);scene.sourceOuterTimelineDriver=driver
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0));deliver(16)
            let capturedState=state,cells=NativeTutorialRules.guidedCells(columns:capturedState.columns,rows:capturedState.rows)
            targets=try [cells.three,cells.two].map{try XCTUnwrap(construction.nodes[try XCTUnwrap(state.tile(at:$0)).id])}
            intro=try XCTUnwrap(NativeSourceTutorialIntroOwner(service:service,timeouts:timeouts,generation:state.generation,current:{[weak self] in self?.current==true},sheet:{_ in},pointer:{_ in},reveal:{},focus:{}))
            intro.restorePointer();for t in stride(from:32.0,through:600,by:16){deliver(t)}
            targets=Array(construction.nodes.values).sorted{$0.tileID<$1.tileID}
            keys=targets.indices.map{Double(targets.count-$0)/Double(targets.count+1)}
            restore=try XCTUnwrap(NativeSourceTutorialBoardRestoreOwner(service:service,random:{[weak self] in guard let self else{return 0};defer{self.draws+=1};return self.draws<self.keys.count ? self.keys[self.draws]:0},nodes:targets,parent:construction.canvas,generation:state.generation,current:{[weak self] in self?.current==true}))
        }
        func deliver(_ ms:Double){wall=ms;service.deliver(wallMilliseconds:ms)}
        func finishRoots(){for t in stride(from:608.0,through:1400,by:16){deliver(t)}}
        func dispose(){restore.dispose();intro.dispose();timeouts.cancelAll();scene.dispose();construction.dispose();driver.dispose();service.dispose();fifo.dispose()}
    }
    func testImmediateRestoreConsumesShuffleOnlyAndRestoresActualActiveScale()throws {
        let f=try Fixture();defer{f.dispose()}
        for node in f.targets{node.alpha=0.2;node.paintSourceOuterScale(.init(x:0.7,y:0.7))}
        XCTAssertTrue(f.restore.restore(immediate:true));XCTAssertFalse(f.restore.restore(immediate:true))
        XCTAssertEqual(f.draws,f.targets.count);XCTAssertEqual(f.restore.orderedIDs,f.targets.reversed().map(\.tileID))
        XCTAssertEqual(f.restore.activeRootCount,0)
        for node in f.targets {
            XCTAssertEqual(node.alpha,node.sourceLocked ? 0.2:1,accuracy:1e-6)
            XCTAssertEqual(node.sourceLocalScale.x,node.sourceLocked || node.sourceValue<=0 ? 0.7:1,accuracy:1e-6)
        }
    }
    func testAnimatedRestoreUsesOneSortedDelayPerObjectAndRetiresOnlyCapturedNode()throws {
        let f=try Fixture();defer{f.dispose()};for node in f.targets{node.alpha=0.2}
        let snapshot=f.scene.engine.state
        XCTAssertTrue(f.restore.restore(immediate:false));XCTAssertEqual(f.draws,2*f.targets.count)
        let active=try XCTUnwrap(f.targets.first{!$0.sourceLocked && $0.sourceValue>0})
        XCTAssertEqual(active.sourceLocalScale.x,0.88,accuracy:1e-6)
        let roots=f.restore.activeRootCount;f.restore.retire(active)
        XCTAssertEqual(f.restore.activeRootCount,roots-2);let retained=active.sourceLocalScale
        for t in stride(from:608.0,through:1800,by:16){f.deliver(t)}
        XCTAssertEqual(active.sourceLocalScale,retained)
        XCTAssertEqual(f.scene.engine.state,snapshot)
        for node in f.targets where node !== active {
            XCTAssertEqual(node.alpha,node.sourceLocked ? 0.2:1,accuracy:1e-6)
            if !node.sourceLocked && node.sourceValue>0{XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6)}
        }
    }
    func testScopeRetirementDuringMathCannotCreateRootsOrConsumeSiblingDraws()throws {
        let f=try Fixture();defer{f.dispose()};f.restore.dispose();var draws=0
        let owner=try XCTUnwrap(NativeSourceTutorialBoardRestoreOwner(service:f.service,random:{draws+=1;f.current=false;return 0.5},nodes:f.targets,parent:f.construction.canvas,generation:f.scene.engine.state.generation,current:{f.current}))
        defer{owner.dispose()};XCTAssertFalse(owner.restore(immediate:false));XCTAssertEqual(draws,1);XCTAssertEqual(owner.activeRootCount,0)
    }
}
