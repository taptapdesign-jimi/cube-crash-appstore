import XCTest
import UIKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceApplicationRuntimeTests:XCTestCase {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        var values:[Double]=[]
        func advanceSourceAnimation(seconds:Double){values.append(seconds)}
    }
    func testAppContextFrameAndNativeRawBorrowOneRealDisplayLinkAndFIFO()async throws {
        let previous=NativeSourceAnimationClockService.shared
        let runtime=try XCTUnwrap(NativeSourceApplicationRuntime.acquire())
        defer{runtime.dispose()}
        XCTAssertTrue(NativeSourceAnimationClockService.shared === runtime.service)
        XCTAssertTrue(runtime.context.service === runtime.service)
        XCTAssertTrue(runtime.context.sourceMicrotaskTasks === runtime.tasks)
        XCTAssertTrue(runtime.service.sourceMicrotaskTasks === runtime.tasks)
        XCTAssertTrue(runtime.service.sourceMicrotaskRAFBoundaryInstalled)
        let scope=try XCTUnwrap(runtime.fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        defer{scope.dispose()}
        let done=expectation(description:"actual raw plus frame/reaction");done.expectedFulfillmentCount=2
        var order:[String]=[]
        let participant=Participant()
        let raw=runtime.service.register(participant:participant,duration:0.04,domain:.nativeRaw){success in XCTAssertTrue(success);done.fulfill()}
        let frame=runtime.service.requestSourceAnimationFrame(ownerID:"app-runtime-test",generation:1,callback:{
            order.append("frame");XCTAssertTrue(scope.enqueue{order.append("reaction");done.fulfill()})
        })
        XCTAssertNotNil(raw);XCTAssertNotNil(frame)
        await fulfillment(of:[done],timeout:2)
        XCTAssertEqual(order,["frame","reaction"]);XCTAssertEqual(runtime.service.displayLinkCreationCount,1)
        XCTAssertEqual(runtime.fifo.pendingCount,0)
        runtime.dispose();XCTAssertTrue(NativeSourceAnimationClockService.shared === previous)
    }
    func testActiveDefaultTransportRefusesBeforeDateOrRNGWork()throws {
        let original=NativeSourceAnimationClockService.shared,participant=Participant()
        let lease=try XCTUnwrap(original.register(participant:participant,duration:1,domain:.nativeRaw){_ in})
        defer{lease.cancel()}
        var dates=0,draws=0
        XCTAssertNil(NativeSourceApplicationRuntime.acquire(wallMillisecondsNow:{dates+=1;return 0},visualRandom:{draws+=1;return 0.5}))
        XCTAssertEqual(dates,0);XCTAssertEqual(draws,0);XCTAssertTrue(lease.active)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === original)
    }
    func testDisposalRejectsReentrantTakeoverAndLateRegistrationThenSuccessorIsIndependent()throws {
        let original=NativeSourceAnimationClockService.shared
        let runtime=try XCTUnwrap(NativeSourceApplicationRuntime.acquire())
        var refused=false
        let frame=runtime.service.requestSourceAnimationFrame(ownerID:"retirement",generation:1,callback:{XCTFail("late frame")},onCancelled:{
            refused=NativeSourceApplicationRuntime.acquire()==nil
            XCTAssertNil(NativeSourceAnimationClockService.shared.requestSourceAnimationFrame(ownerID:"late",generation:1,callback:{}))
        })
        XCTAssertNotNil(frame);runtime.dispose();runtime.dispose()
        XCTAssertTrue(refused);XCTAssertFalse(runtime.service.hasActiveClock)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === original)
        let next=try XCTUnwrap(NativeSourceApplicationRuntime.acquire());defer{next.dispose()}
        runtime.dispose();XCTAssertTrue(NativeSourceAnimationClockService.shared === next.service)
    }
    func testDateProducerReentryCannotOverwriteSuccessorAppBinding()throws {
        var successor:NativeSourceApplicationRuntime?
        let old=NativeSourceApplicationRuntime.acquire(wallMillisecondsNow:{
            successor=NativeSourceApplicationRuntime.acquire();return 0
        })
        XCTAssertNil(old)
        let next=try XCTUnwrap(successor);defer{next.dispose()}
        XCTAssertTrue(NativeSourceAnimationClockService.shared === next.service)
    }
    func testActualFreshSourceTutorialBootstrapUsesLiveAppTransportWithoutManualClockDelivery()async throws {
        let previousService=NativeSourceAnimationClockService.shared
        let runtime=try XCTUnwrap(NativeSourceApplicationRuntime.acquire())
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-live-app-\(UUID().uuidString)")
        let store=NativeSaveStore(directory:directory)
        try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:runtime.context)
        bootstrap.sourceInitialFreshStartupEnabled=true;bootstrap.sourceBoardEntryEnabled=true
        bootstrap.sourceTutorialActivationEnabled=true;bootstrap.sourceTutorialIntroEnabled=true
        bootstrap.sourceTutorialHUDEnabled=true;bootstrap.sourceTutorialFirstStepMonitorEnabled=true
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();runtime.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        let deadline=Date().addingTimeInterval(15)
        var game:NativeGameplayViewController?
        while Date()<deadline {
            game=app.children.compactMap{$0 as? NativeGameplayViewController}.first
            if game?.boardScene?.sourceTutorialPreparationReady==true {break}
            try await Task.sleep(for:.milliseconds(20))
        }
        let mounted=try XCTUnwrap(game),scene=try XCTUnwrap(mounted.boardScene)
        XCTAssertTrue(scene.sourceTutorialPreparationReady)
        XCTAssertEqual(scene.completedSourceBoardEntry?.outcome,.normal)
        XCTAssertTrue(mounted.sourceScope?.service === runtime.service)
        XCTAssertTrue(scene.sourceMicrotaskBoundariesInstalled)
        XCTAssertTrue(scene.sourceTutorialHUDActive)
        XCTAssertNil(mounted.engine.pendingSourceTutorialDemoActivation)
        XCTAssertEqual(mounted.engine.state.tiles.count,45)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === runtime.service)
        XCTAssertFalse(previousService.hasActiveClock)
        bootstrap.dispose();runtime.dispose()
        XCTAssertFalse(runtime.service.hasActiveClock);XCTAssertEqual(runtime.fifo.pendingCount,0)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === previousService)
    }
}
