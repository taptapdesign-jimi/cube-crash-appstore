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
    func testRenderedOpacityOwnsCanonicalFlashesAndUsesContinuousEase()throws {
        let f=try Fixture();defer{f.dispose()}
        let node=try XCTUnwrap(f.targets.first{!$0.sourceLocked && $0.sourceValue>0})
        let owner=NativeTutorialBoardOpacityOwner();defer{owner.dispose()}
        node.isHidden=false;node.alpha=1;owner.setFocus([])
        _=owner.paint(nodes:[node],generation:1,time:0,suspended:false,externallyOwned:{_ in false})
        var previous=node.alpha
        for frame in 1...30 {
            node.alpha=1 // actual synchronize/focus writer attempting a full-opacity flash
            _=owner.paint(nodes:[node],generation:1,time:Double(frame)/60,suspended:false,externallyOwned:{_ in false})
            XCTAssertLessThanOrEqual(node.alpha,previous+1e-6);XCTAssertLessThan(previous-node.alpha,0.07);previous=node.alpha
        }
        XCTAssertEqual(node.alpha,0.2,accuracy:1e-6)
        owner.setFocus(nil)
        for frame in 31...65 {
            node.alpha=1
            _=owner.paint(nodes:[node],generation:1,time:Double(frame)/60,suspended:false,externallyOwned:{_ in false})
            XCTAssertGreaterThanOrEqual(node.alpha,previous-1e-6);XCTAssertLessThan(node.alpha-previous,0.07);previous=node.alpha
        }
        XCTAssertEqual(node.alpha,1,accuracy:1e-6);XCTAssertFalse(owner.active)
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
    func testContinuousRestoreKeepsLivePoseThenAnimatesAndCleanupCannotRepaint()throws {
        let f=try Fixture();defer{f.dispose()}
        let active=try XCTUnwrap(f.targets.first{!$0.sourceLocked && $0.sourceValue>0})
        active.paintSourceOuterScale(.init(x:1.03,y:0.96));active.alpha=0.43
        let snapshot=f.scene.engine.state
        XCTAssertTrue(f.restore.restore(immediate:false,continuous:true))
        XCTAssertEqual(active.sourceLocalScale.x,1.03,accuracy:1e-6)
        XCTAssertEqual(active.sourceLocalScale.y,0.96,accuracy:1e-6)
        XCTAssertEqual(active.alpha,0.43,accuracy:1e-6)
        f.deliver(608);f.deliver(656)
        XCTAssertNotEqual(active.sourceLocalScale.x,1.03)
        XCTAssertGreaterThan(active.alpha,0.43)
        for time in stride(from:672.0,through:1800,by:16){f.deliver(time)}
        XCTAssertEqual(active.sourceLocalScale.x,1,accuracy:1e-6)
        XCTAssertEqual(active.sourceLocalScale.y,1,accuracy:1e-6)
        XCTAssertEqual(active.alpha,1,accuracy:1e-6)
        XCTAssertEqual(f.scene.engine.state,snapshot)
        f.restore.dispose();f.restore.dispose()
        active.paintSourceOuterScale(.init(x:0.94,y:0.92));active.alpha=0.61
        f.deliver(1900)
        XCTAssertEqual(active.sourceLocalScale.x,0.94,accuracy:1e-6);XCTAssertEqual(active.alpha,0.61,accuracy:1e-6)
        XCTAssertEqual(f.restore.activeRootCount,0)
    }
    func testImmediateFourthRestorePreservesLiveMergeScaleAndOriginalShuffleDraws()throws {
        let f=try Fixture();defer{f.dispose()}
        let active=try XCTUnwrap(f.targets.first{!$0.sourceLocked && $0.sourceValue>0})
        active.paintSourceOuterScale(.init(x:1.18,y:0.83));active.alpha=0.2
        XCTAssertTrue(f.restore.restore(immediate:true,preserveScale:true))
        XCTAssertEqual(f.draws,f.targets.count)
        XCTAssertEqual(active.sourceLocalScale.x,1.18,accuracy:1e-6)
        XCTAssertEqual(active.sourceLocalScale.y,0.83,accuracy:1e-6)
        XCTAssertEqual(active.alpha,1,accuracy:1e-6)
        XCTAssertEqual(f.restore.activeRootCount,0)
    }
    func testImmediateFourthRestoreDoesNotKillAnActiveMergeScaleChild()throws {
        let f=try Fixture();defer{f.dispose()}
        let active=try XCTUnwrap(f.targets.first{!$0.sourceLocked && $0.sourceValue>0})
        XCTAssertTrue(active.beginSourceMergeImpact(.init(variantDraw:0.8,variationDraw:0.5)))
        f.deliver(608);f.deliver(640)
        XCTAssertTrue(active.sourceOuterOwners.mergeImpact)
        let captured=active.sourceLocalScale
        active.alpha=0.2
        XCTAssertTrue(f.restore.restore(immediate:true,preserveScale:true))
        XCTAssertTrue(active.sourceOuterOwners.mergeImpact)
        XCTAssertEqual(active.sourceLocalScale,captured)
        XCTAssertEqual(active.alpha,1,accuracy:1e-6)
        f.deliver(688)
        XCTAssertNotEqual(active.sourceLocalScale,captured)
        XCTAssertTrue(active.sourceOuterOwners.mergeImpact)
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
