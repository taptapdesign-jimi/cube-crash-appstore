import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialFirstStepMonitorTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,current=true,activated:[String]=[]
        let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        var service:NativeSourceAnimationClockService!,construction:NativeSourceInitialBoardConstruction!,intro:NativeSourceTutorialIntroOwner!,monitor:NativeSourceTutorialFirstStepMonitor!
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
            monitor=try XCTUnwrap(NativeSourceTutorialFirstStepMonitor(service:service,timeouts:timeouts,generation:state.generation,targets:targets,parent:construction.canvas,current:{[weak self] in self?.current==true},targetCurrent:{[weak self] node in self?.construction.nodes[node.tileID] === node},pointerExit:{[weak self] callback in self?.intro.popOutPointer(completed:callback)==true},sheetExit:{[weak self] callback in self?.intro.exitSheet(completed:callback)==true},activate:{[weak self] node in self?.activated.append(node.tileID);return true}))
        }
        func deliver(_ ms:Double){wall=ms;service.deliver(wallMilliseconds:ms)}
        func finishRoots(){for t in stride(from:608.0,through:1400,by:16){deliver(t)}}
        func dispose(){monitor.dispose();intro.dispose();timeouts.cancelAll();scene.dispose();construction.dispose();driver.dispose();service.dispose();fifo.dispose()}
    }
    func testActualWallObserverRequiresBoundPointerdownAndRealAPPCompletionThenWall90()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.monitor.start());XCTAssertFalse(f.monitor.start())
        XCTAssertTrue(f.targets[1].forceSourceTutorialInitialValue(5));try await Task.sleep(for:.milliseconds(160))
        XCTAssertEqual(f.monitor.phase,.polling);XCTAssertTrue(f.activated.isEmpty)
        _=f.service.setSourceGlobalPaused(true);f.monitor.pointerDown(f.targets[0]);try await Task.sleep(for:.milliseconds(160))
        XCTAssertEqual(f.monitor.phase,.pointerExit);XCTAssertFalse(f.monitor.pendingTimer)
        f.finishRoots();XCTAssertTrue(f.activated.isEmpty);XCTAssertEqual(f.monitor.phase,.pointerExit)
        _=f.service.setSourceGlobalPaused(false)
        for t in stride(from:1408.0,through:2200,by:16){f.deliver(t)}
        XCTAssertEqual(f.monitor.phase,.activationWait);XCTAssertTrue(f.activated.isEmpty)
        f.service.setSourceForeground(false);try await Task.sleep(for:.milliseconds(130))
        XCTAssertEqual(f.monitor.phase,.finished);XCTAssertEqual(f.activated,[f.targets[1].tileID]);XCTAssertFalse(f.monitor.pendingTimer)
    }
    func testOriginalCandidateOrderAndReplacementTimerRemainIndependent()async throws {
        let f=try Fixture();defer{f.dispose()};var unrelated=0
        _=f.timeouts.schedule(sourceID:"another-owner",generation:1,delayMilliseconds:170,elapsed:{unrelated+=1})
        XCTAssertTrue(f.monitor.start());for node in f.targets{XCTAssertTrue(node.forceSourceTutorialInitialValue(5))}
        f.monitor.pointerDown(f.targets[1]);try await Task.sleep(for:.milliseconds(160))
        XCTAssertEqual(f.monitor.matchedID,f.targets[0].tileID)
        f.monitor.dispose();f.finishRoots();try await Task.sleep(for:.milliseconds(130))
        XCTAssertTrue(f.activated.isEmpty);XCTAssertEqual(unrelated,1)
    }
    func testUnrelatedNodeCannotMarkInteractionAndReparentedCandidateCannotMatch()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.monitor.start())
        let other=try XCTUnwrap(f.construction.nodes.values.first{node in !f.targets.contains(where:{$0 === node})})
        f.monitor.pointerDown(other);XCTAssertTrue(f.targets[0].forceSourceTutorialInitialValue(5));try await Task.sleep(for:.milliseconds(160))
        XCTAssertEqual(f.monitor.phase,.polling)
        f.monitor.pointerDown(f.targets[1]);let replacement=SKNode();f.targets[0].removeFromParent();replacement.addChild(f.targets[0])
        try await Task.sleep(for:.milliseconds(160));XCTAssertEqual(f.monitor.phase,.polling);XCTAssertNil(f.monitor.matchedID)
    }
    func testGenerationRetirementCannotActivateAfterCapturedExits()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.monitor.start());f.monitor.pointerDown(f.targets[0]);XCTAssertTrue(f.targets[1].forceSourceTutorialInitialValue(5))
        try await Task.sleep(for:.milliseconds(160));XCTAssertEqual(f.monitor.phase,.pointerExit)
        f.current=false;f.monitor.dispose();f.finishRoots();try await Task.sleep(for:.milliseconds(130))
        XCTAssertEqual(f.monitor.phase,.retired);XCTAssertTrue(f.activated.isEmpty);XCTAssertFalse(f.monitor.pendingTimer)
    }
}
