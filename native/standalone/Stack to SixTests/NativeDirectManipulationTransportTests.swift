import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeDirectManipulationTransportTests:XCTestCase {
    private func service()->NativeSourceAnimationClockService {
        NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
    }
    func testGenuineQueuePreviouslyRecreatesLinkPerMoveAndReceiptRetainsOneWithoutSourceTicks()throws {
        let unretained=service();defer{unretained.dispose()}
        var oldPaints=0
        let oldQueue=NativeSourceDragMoveQueue(service:unretained,ownerID:"before",generation:1,current:{true},paint:{_ in oldPaints+=1})
        defer{oldQueue.dispose()}
        for n in 1...12 {oldQueue.enqueue(.init(x:CGFloat(n),y:0));unretained.deliver(wallMilliseconds:Double(n*16))}
        XCTAssertEqual(oldPaints,12);XCTAssertEqual(unretained.displayLinkCreationCount,12)
        XCTAssertFalse(unretained.hasActiveClock)
        let retained=service();defer{retained.dispose()}
        let lease=try XCTUnwrap(retained.retainDirectManipulationTransport(ownerID:"after",generation:1,current:{true}))
        var paints=0
        let queue=NativeSourceDragMoveQueue(service:retained,ownerID:"after",generation:1,current:{true},paint:{_ in paints+=1})
        defer{queue.dispose();lease.cancel()}
        for n in 1...100 {
            queue.enqueue(.init(x:CGFloat(n),y:0));queue.enqueue(.init(x:CGFloat(n),y:1))
            retained.deliver(wallMilliseconds:Double(n*16))
        }
        XCTAssertEqual(paints,100);XCTAssertEqual(retained.displayLinkCreationCount,1)
        XCTAssertEqual(retained.pendingSourceAnimationFrameCount,0)
        XCTAssertFalse(retained.sourceTickerRAFQueued);XCTAssertEqual(retained.sourceTickerDispatchFrame,0)
        XCTAssertEqual(retained.activeParticipantCount,0)
        retained.deliver(wallMilliseconds:2000)
        XCTAssertEqual(paints,100);XCTAssertEqual(retained.sourceTickerDispatchFrame,0)
        lease.cancel();XCTAssertFalse(retained.hasActiveClock)
    }
    func testStaleReentrantReceiptCannotRetireSuccessorOrReviveDisposedService()throws {
        let clock=service();defer{clock.dispose()}
        var current=true
        let old=try XCTUnwrap(clock.retainDirectManipulationTransport(ownerID:"old",generation:1,current:{current}))
        current=false;clock.deliver(wallMilliseconds:16)
        XCTAssertFalse(old.active);XCTAssertFalse(clock.hasActiveClock)
        let fresh=try XCTUnwrap(clock.retainDirectManipulationTransport(ownerID:"fresh",generation:2,current:{true}))
        old.cancel();XCTAssertTrue(fresh.active);XCTAssertTrue(clock.hasActiveClock)
        clock.setSourceForeground(false);XCTAssertFalse(clock.hasActiveClock);XCTAssertFalse(fresh.active)
        XCTAssertNil(clock.retainDirectManipulationTransport(ownerID:"background",generation:3,current:{true}))
        clock.setSourceForeground(true);XCTAssertFalse(clock.hasActiveClock)
        let resumed=try XCTUnwrap(clock.retainDirectManipulationTransport(ownerID:"resumed",generation:3,current:{true}))
        XCTAssertTrue(clock.hasActiveClock)
        clock.dispose();XCTAssertFalse(resumed.active);XCTAssertFalse(clock.hasActiveClock)
        XCTAssertNil(clock.retainDirectManipulationTransport(ownerID:"disposed",generation:3,current:{true}))
        let hostile=service()
        XCTAssertNil(hostile.retainDirectManipulationTransport(ownerID:"reentrant",generation:1,current:{hostile.dispose();return true}))
        XCTAssertFalse(hostile.hasActiveClock);XCTAssertEqual(hostile.directManipulationTransportCount,0)
    }
    func testActualAllSeventeenSceneDragsRetainTransportAndReleaseOnPauseCancelFailureAndDispose()throws {
        let families:[(NativeWildArchetype,String?)]=NativeWildArchetype.allCases.map{($0,nil)} + NativeSpecialDiceRegistry.variants.values.map{($0.archetype,$0.id)}
        XCTAssertEqual(families.count,17)
        for (core,variant) in families {
            let clock=service();defer{clock.dispose()}
            var wild=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6);wild.archetype=core;wild.variant=variant
            let state=NativeBoardState(columns:5,rows:9,tiles:[wild,.init(id:"other",cell:.init(column:4,row:0),value:3)])
            let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
            defer{scene.dispose()}
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
            scene.configureSourceRegularStackHandoff(service:clock,admitted:{true})
            let from=try XCTUnwrap(scene.boardGeometry).center(row:0,column:0)
            XCTAssertTrue(scene.beginDrag(at:from),variant ?? core.rawValue)
            XCTAssertEqual(clock.directManipulationTransportCount,1)
            XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,60,"An admitted drag must not permit the APP transport to fall to30")
            scene.dispatchSourceTouchMove(to:.init(x:from.x+10,y:from.y));clock.deliver(wallMilliseconds:16)
            XCTAssertTrue(clock.hasActiveClock)
            scene.setSuspended(true);XCTAssertEqual(clock.directManipulationTransportCount,0)
            scene.setSuspended(false);XCTAssertEqual(clock.directManipulationTransportCount,1)
            scene.cancelDrag();XCTAssertEqual(clock.directManipulationTransportCount,0)
            XCTAssertTrue(scene.beginDrag(at:from))
            XCTAssertTrue(scene.sealSourcePresentationFailure(generation:scene.engine.state.generation))
            XCTAssertEqual(clock.directManipulationTransportCount,0)
            scene.dispose();XCTAssertEqual(clock.directManipulationTransportCount,0)
        }
    }
    func testActualExistingDisplayLinkPromotesForExactRenderDemandAndReturnsToIdleWithoutNewClock()throws {
        let clock=service();defer{clock.dispose()}
        let frame=try XCTUnwrap(clock.requestSourceAnimationFrame(ownerID:"pending",generation:1,callback:{}));defer{frame.cancel()}
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,30)
        let creations=clock.displayLinkCreationCount,tickerFrame=clock.sourceTickerDispatchFrame
        let first=try XCTUnwrap(clock.acquireSource60HzRenderDemand(ownerID:"hud-job:A",generation:1,current:{true}))
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,60)
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.maximum,60)
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.preferred,60)
        let next=try XCTUnwrap(clock.acquireSource60HzRenderDemand(ownerID:"hud-job:C",generation:1,current:{true}))
        first.cancel();first.cancel()
        XCTAssertTrue(next.active);XCTAssertEqual(clock.source60HzRenderDemandCount,1)
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,60)
        next.cancel();XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,30)
        XCTAssertEqual(clock.displayLinkCreationCount,creations)
        XCTAssertEqual(clock.sourceTickerDispatchFrame,tickerFrame,"A render-rate hint never delivers a Source ticker or changes its time")
        XCTAssertEqual(clock.pendingSourceAnimationFrameCount,1)
    }
    func testRenderDemandAloneCreatesNoClockAndPreservesOwnedPolicyAcrossForeground()throws {
        let clock=service();defer{clock.dispose()}
        let demand=try XCTUnwrap(clock.acquireSource60HzRenderDemand(ownerID:"visible",generation:1,current:{true}))
        XCTAssertFalse(clock.hasActiveClock);XCTAssertEqual(clock.displayLinkCreationCount,0)
        let frame=try XCTUnwrap(clock.requestSourceAnimationFrame(ownerID:"flight",generation:1,callback:{}));defer{frame.cancel()}
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,60)
        clock.setSourceForeground(false)
        XCTAssertFalse(clock.hasActiveClock);XCTAssertTrue(demand.active)
        XCTAssertNil(clock.acquireSource60HzRenderDemand(ownerID:"background",generation:1,current:{true}))
        clock.setSourceForeground(true)
        XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,60)
        demand.cancel();XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,30)
        clock.dispose();XCTAssertFalse(demand.active);XCTAssertEqual(clock.source60HzRenderDemandCount,0)
    }
    func testStaleRenderDemandCannotChangeSuccessorAndReentrantDisposalRefusesHint()throws {
        let clock=service();defer{clock.dispose()};var admitted=true
        let old=try XCTUnwrap(clock.acquireSource60HzRenderDemand(ownerID:"old",generation:1,current:{admitted}))
        let frame=try XCTUnwrap(clock.requestSourceAnimationFrame(ownerID:"pending",generation:2,callback:{}));defer{frame.cancel()}
        let next=try XCTUnwrap(clock.acquireSource60HzRenderDemand(ownerID:"next",generation:2,current:{true}))
        admitted=false;clock.deliver(wallMilliseconds:16)
        XCTAssertFalse(old.active);XCTAssertTrue(next.active);XCTAssertEqual(clock.source60HzRenderDemandCount,1)
        let another=try XCTUnwrap(clock.requestSourceAnimationFrame(ownerID:"pending-next",generation:2,callback:{}));defer{another.cancel()}
        old.cancel();XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,60)
        next.cancel();XCTAssertEqual(clock.sourceTransportFrameRateRange?.minimum,30)
        let hostile=service();defer{hostile.dispose()}
        XCTAssertNil(hostile.acquireSource60HzRenderDemand(ownerID:"disposed-during-admission",generation:1,current:{hostile.dispose();return true}))
        XCTAssertEqual(hostile.source60HzRenderDemandCount,0);XCTAssertEqual(hostile.displayLinkCreationCount,0)
    }
}
