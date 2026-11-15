import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeAuthoredPresentationProducerTests:XCTestCase {
    @MainActor private final class Fixture {
        let fifo=NativeSourceMicrotaskFIFO()
        let tasks:NativeSourceMicrotaskAdapters
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true)
        let context:NativeGameplaySourceContext
        let game:NativeGameplayViewController
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        init() {
            tasks=NativeSourceMicrotaskAdapters(fifo:fifo);service.sourceMicrotaskTasks=tasks
            context=NativeGameplaySourceContext(service:service,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
            let engine=NativeGameplayEngine(state:.init(tiles:[
                .init(id:"one",cell:.init(column:0,row:0),value:1),
                .init(id:"two",cell:.init(column:2,row:2),value:2)
            ],generation:7))
            game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
            game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true
            window.rootViewController=game;window.makeKeyAndVisible();game.view.layoutIfNeeded()
        }
        func close(){game.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;window.rootViewController=nil}
    }
    func testActualNativeRawFinaleCompletionOwnsMeterPromiseCheckpoint()throws {
        let f=Fixture();defer{f.close()}
        let scope=try XCTUnwrap(f.game.sourceScope)
        XCTAssertTrue(scope.current)
        let reactionScope=try XCTUnwrap(f.fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{scope.current}))
        defer{reactionScope.dispose()}
        var trace:[String]=[],refusals=0
        let queue=NativeMeterSourceQueue(hooks:.init(current:{scope.current},permission:{trace.append("queue-check");return .block("meter-empty")},continuation:{true},meterReady:{false},enqueue:{action in
            if !reactionScope.enqueue(action){refusals+=1}
        },after:{_,_ in { }},inProgress:{_ in},retryPending:{_ in},shimmer:{},spawn:{_ in XCTFail("Empty meter cannot spawn")},reportFailure:{XCTFail("Unexpected queue rejection")},debounceCanonicalSave:{_ in}))
        defer{queue.dispose()}
        let finale=NativeFinitePresentation(viewport:f.window.bounds.size,duration:0.01)
        finale.configureAnimationDelivery(f.service) // preserve actual nativeRaw transport
        finale.configurePresentationCallbackTask(f.game.captureSourceNativePresentationTask(generation:7))
        f.game.view.addSubview(finale)
        f.game.bindAuthoredPresentationCompletion(finale,variant:"producer-test",generation:7){
            trace.append("callback-begin");queue.guardReleased();trace.append("callback-end")
        }
        finale.start()
        XCTAssertFalse(f.fifo.isAcceptingJobs)
        f.service.deliver(wallMilliseconds:0);f.service.deliver(wallMilliseconds:20)
        XCTAssertEqual(refusals,0)
        XCTAssertEqual(trace,["callback-begin","callback-end","queue-check"])
        XCTAssertEqual(f.fifo.pendingCount,0)
        XCTAssertNil(finale.superview);XCTAssertNil(finale.onFinished);XCTAssertFalse(finale.hasActiveClock)
        f.service.deliver(wallMilliseconds:40)
        XCTAssertEqual(trace.count,3,"Natural completion is once")
    }
    private final class PaintedFinale:NativeFinitePresentation {
        var contact:(()->Void)?,afterContact:(()->Void)?
        override func paint(seconds:TimeInterval){if seconds>0 {contact?();afterContact?()}}
    }
    func testGameplayContactReactionWaitsForEntireActualRawPaint()throws {
        let f=Fixture();defer{f.close()}
        let scope=try XCTUnwrap(f.game.sourceScope)
        let reactions=try XCTUnwrap(f.fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{scope.current}))
        defer{reactions.dispose()}
        var trace:[String]=[]
        let finale=PaintedFinale(viewport:f.window.bounds.size,duration:1)
        finale.configureAnimationDelivery(f.service)
        finale.configurePresentationCallbackTask(f.game.captureSourceNativePresentationTask(generation:7))
        let contact=f.game.captureSourceNativePresentationCallback(generation:7,refused:()){(_:Void) in
            trace.append("contact");XCTAssertTrue(reactions.enqueue{trace.append("reaction")})
        }
        finale.contact={contact(())};finale.afterContact={trace.append("remaining-paint")}
        f.game.view.addSubview(finale);finale.start()
        f.service.deliver(wallMilliseconds:0);f.service.deliver(wallMilliseconds:20)
        XCTAssertEqual(trace,["contact","remaining-paint","reaction"])
        finale.contact=nil;finale.afterContact=nil;finale.dispose()
    }
    func testCapturedNativeCallbackRejectsGenerationAndScopeReplacement()throws {
        let f=Fixture();defer{f.close()}
        var calls=0,ownerCurrent=true
        let replaced=f.game.captureSourceNativePresentationCallback(generation:7,refused:false,isCurrent:{ownerCurrent}){(_:Void)->Bool in calls+=1;return true}
        ownerCurrent=false;XCTAssertFalse(replaced(()));XCTAssertEqual(calls,0)
        let callback=f.game.captureSourceNativePresentationCallback(generation:7,refused:false){(_:Void)->Bool in calls+=1;return true}
        var next=f.game.engine.state;next.generation=8;f.game.engine.restart(state:next)
        XCTAssertFalse(callback(()));XCTAssertEqual(calls,0)
        let current=f.game.captureSourceNativePresentationCallback(generation:8,refused:false){(_:Void)->Bool in calls+=1;return true}
        _=f.context.beginScene(engine:f.game.engine,retire:{})
        XCTAssertFalse(current(()));XCTAssertEqual(calls,0);XCTAssertEqual(f.fifo.pendingCount,0)
    }
    func testObsoleteFinaleRetiresVisualReceiptWithoutGameplayContinuation()async throws {
        let f=Fixture();defer{f.close()}
        var calls=0,retirements=0
        weak var released:NativeFinitePresentation?
        autoreleasepool {
            let finale=NativeFinitePresentation(viewport:f.window.bounds.size,duration:0.01)
            released=finale
            finale.configureAnimationDelivery(f.service);f.game.view.addSubview(finale)
            f.game.bindAuthoredPresentationCompletion(finale,variant:"retired-test",generation:7,releaseSource:{retirements+=1}){calls+=1}
            finale.start()
            var next=f.game.engine.state;next.generation=8;f.game.engine.restart(state:next)
            finale.dispose();finale.dispose()
            XCTAssertEqual(calls,0);XCTAssertEqual(retirements,1)
            XCTAssertNil(finale.superview);XCTAssertNil(finale.onFinished);XCTAssertFalse(finale.hasActiveClock)
        }
        // UIKit/CALayer may retain an attached-then-removed UIView until the
        // mounted transaction and autorelease turn drain. This is distinct
        // from the synchronous owner/clock/callback retirement asserted above.
        CATransaction.flush()
        let deadline=Date().addingTimeInterval(2)
        while released != nil,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(released)
    }
}
