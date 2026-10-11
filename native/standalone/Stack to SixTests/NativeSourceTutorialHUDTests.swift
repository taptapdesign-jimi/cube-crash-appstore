import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialHUDTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,current=true
        let parent=SKNode(),root=SKNode(),ordinary=SKNode(),loader=SKNode(),extra=SKNode(),child=SKNode()
        let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        var service:NativeSourceAnimationClockService!,owner:NativeSourceTutorialHUDOwner!
        init(unified:Bool=false)throws {
            parent.addChild(root);root.addChild(ordinary);root.addChild(loader);parent.addChild(extra);ordinary.addChild(child)
            ordinary.alpha=0.8;loader.alpha=0.6;loader.name="wildLoader";extra.alpha=1
            ordinary.isUserInteractionEnabled=true;child.isUserInteractionEnabled=true
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo);timeouts.sourceMicrotaskTasks=tasks
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
            owner=try XCTUnwrap(NativeSourceTutorialHUDOwner(root:root,extraTargets:unified ? []:[extra],unifiedTargets:unified ? [extra]:[],service:service,timeouts:timeouts,generation:1,current:{[weak self] in self?.current==true}))
        }
        func deliver(_ time:Double){wall=time;service.deliver(wallMilliseconds:time)}
        func dispose(){owner.dispose();timeouts.cancelAll();service.dispose();fifo.dispose()}
    }
    func testAnimatedRestorePreservesLoaderConsumesOnlyOriginalHUDMathAndKeepsControlsLocked()async throws {
        let f=try Fixture(unified:true);defer{f.dispose()};XCTAssertTrue(f.owner.start())
        let close=SKNode();close.name="close";close.isUserInteractionEnabled=true;f.root.addChild(close)
        try await Task.sleep(for:.milliseconds(150))
        var draws=0,smoke=0
        XCTAssertTrue(f.owner.stop(animateRestore:true,random:{draws+=1;return 0.5},hudLocked:true,isLockedControl:{$0 === close},cleanupSmoke:{smoke+=1}))
        XCTAssertEqual(draws,2);XCTAssertEqual(smoke,1);XCTAssertFalse(f.owner.pendingInterval)
        XCTAssertEqual(close.alpha,0.2,accuracy:1e-6);XCTAssertFalse(close.isUserInteractionEnabled)
        XCTAssertTrue(f.ordinary.isUserInteractionEnabled);XCTAssertTrue(f.child.isUserInteractionEnabled)
        XCTAssertEqual(f.ordinary.xScale,0.9,accuracy:1e-6);XCTAssertEqual(f.loader.xScale,1)
        for time in stride(from:16.0,through:900,by:16){f.deliver(time)}
        XCTAssertEqual(f.ordinary.alpha,0.8,accuracy:1e-6);XCTAssertEqual(f.loader.alpha,0.6,accuracy:1e-6)
        XCTAssertEqual(f.extra.alpha,1,accuracy:1e-6);XCTAssertEqual(f.ordinary.xScale,1,accuracy:1e-6)
        XCTAssertEqual(draws,2);XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testUnifiedHUDRetainsInitialDOMFadeAcrossWallClampAndCapturesLazyBackgroundAlpha()async throws {
        for background in [false,true] {
            let f=try Fixture(unified:true);defer{f.dispose()}
            if background{f.service.setSourceForeground(false)}
            XCTAssertTrue(f.owner.start())
            if !background{f.deliver(16);f.deliver(64)}
            try await Task.sleep(for:.milliseconds(150))
            XCTAssertEqual(f.extra.alpha,0.2,accuracy:1e-6);XCTAssertEqual(f.service.activeParticipantCount,1)
            if background{f.service.setSourceForeground(true)}
            f.deliver(background ? 16:80)
            if background{XCTAssertEqual(f.extra.alpha,0.2,accuracy:1e-6)}else{XCTAssertGreaterThan(f.extra.alpha,0.2)}
        }
    }
    func testImmediateRestoreInterruptsExistingScaleWithoutInventingResetAndCanUnlockControls()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start());try await Task.sleep(for:.milliseconds(150))
        XCTAssertTrue(f.owner.stop(animateRestore:true,random:{0},hudLocked:false,isLockedControl:{_ in false},cleanupSmoke:{}));f.deliver(32)
        let captured=f.ordinary.xScale
        XCTAssertTrue(f.owner.stop(animateRestore:false,random:{XCTFail("immediate restore Math");return 0},hudLocked:false,isLockedControl:{_ in false},cleanupSmoke:{}))
        for time in stride(from:48.0,through:700,by:16){f.deliver(time)}
        XCTAssertEqual(f.ordinary.xScale,captured);XCTAssertEqual(f.ordinary.alpha,0.8,accuracy:1e-6)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testDynamicDescendantFlagsRestoreAndDetachedChildIsNeverMutated()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start())
        f.child.removeFromParent();f.parent.addChild(f.child);f.child.isUserInteractionEnabled=true
        let newChild=SKNode();newChild.isUserInteractionEnabled=true;f.ordinary.addChild(newChild)
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertTrue(f.child.isUserInteractionEnabled);XCTAssertFalse(newChild.isUserInteractionEnabled)
        XCTAssertTrue(f.owner.stop(random:{XCTFail("immediate Math");return 0},hudLocked:false,isLockedControl:{_ in false},cleanupSmoke:{}))
        XCTAssertTrue(newChild.isUserInteractionEnabled);XCTAssertTrue(f.child.isUserInteractionEnabled)
    }
    func testUncapturedLateRootChildUsesOriginalRestoreFallback()throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start())
        let late=SKNode();late.alpha=0.47;f.root.addChild(late)
        XCTAssertTrue(f.owner.stop(random:{XCTFail("immediate Math");return 0},hudLocked:false,isLockedControl:{_ in false},cleanupSmoke:{}))
        XCTAssertEqual(late.alpha,1,accuracy:1e-6)
    }
    func testCleanupRetirementCannotCreateLateRestoreRootsOrConsumeMath()throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start())
        var draws=0
        XCTAssertFalse(f.owner.stop(animateRestore:true,random:{draws+=1;return 0},hudLocked:false,isLockedControl:{_ in false},cleanupSmoke:{f.owner.dispose()}))
        XCTAssertEqual(draws,0);XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertFalse(f.owner.pendingInterval)
    }
    func testActualFadeThenOriginalWall120ClampCancelsRootsAndPreservesLoader()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start());XCTAssertFalse(f.owner.start())
        XCTAssertFalse(f.ordinary.isUserInteractionEnabled);XCTAssertFalse(f.child.isUserInteractionEnabled)
        f.deliver(16);f.deliver(64)
        XCTAssertLessThan(f.ordinary.alpha,0.8);XCTAssertGreaterThan(f.ordinary.alpha,0.2)
        XCTAssertEqual(f.loader.alpha,0.6,accuracy:1e-6)
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertGreaterThanOrEqual(f.owner.intervalDeliveries,1);XCTAssertEqual(f.ordinary.alpha,0.2,accuracy:1e-6)
        XCTAssertEqual(f.loader.alpha,0.6,accuracy:1e-6);XCTAssertEqual(f.extra.alpha,0.2,accuracy:1e-6)
        XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.timeouts.pendingCount,1)
        f.ordinary.alpha=0.9;f.root.alpha=0.4;f.root.isHidden=true
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(f.ordinary.alpha,0.2,accuracy:1e-6);XCTAssertEqual(f.root.alpha,1);XCTAssertFalse(f.root.isHidden)
    }
    func testWallClampRemainsIndependentOfGlobalPauseAndForeground()async throws {
        let f=try Fixture();defer{f.dispose()};f.service.setSourceForeground(false);_=f.service.setSourceGlobalPaused(true)
        XCTAssertTrue(f.owner.start());XCTAssertEqual(f.ordinary.alpha,0.8,accuracy:1e-6)
        try await Task.sleep(for:.milliseconds(150));XCTAssertEqual(f.ordinary.alpha,0.2,accuracy:1e-6)
        XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertFalse(f.service.hasActiveClock)
    }
    func testDisposalKeepsPaintCancelsExactTimerAndDoesNotTouchOtherOwner()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start());f.deliver(32)
        var unrelated=false
        _=f.timeouts.schedule(sourceID:"unrelated",generation:2,delayMilliseconds:140,elapsed:{unrelated=true})
        let alpha=f.ordinary.alpha;f.owner.dispose();f.owner.dispose()
        XCTAssertEqual(f.timeouts.pendingCount,1);XCTAssertEqual(f.service.activeParticipantCount,0)
        try await Task.sleep(for:.milliseconds(170));f.deliver(200)
        XCTAssertEqual(f.ordinary.alpha,alpha);XCTAssertTrue(unrelated)
    }
    func testReparentedHUDChildIsNeverClampedByOldCapture()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start())
        f.ordinary.removeFromParent();f.parent.addChild(f.ordinary);f.ordinary.alpha=0.9
        try await Task.sleep(for:.milliseconds(150));f.deliver(300)
        XCTAssertEqual(f.ordinary.alpha,0.9,accuracy:1e-6);XCTAssertEqual(f.extra.alpha,0.2,accuracy:1e-6)
    }
    func testRetiredScopeStopsBeforeNextWallMutation()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start());f.current=false
        let alpha=f.ordinary.alpha;try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(f.ordinary.alpha,alpha);XCTAssertFalse(f.owner.pendingInterval)
        XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(f.service.activeParticipantCount,0)
    }
}
