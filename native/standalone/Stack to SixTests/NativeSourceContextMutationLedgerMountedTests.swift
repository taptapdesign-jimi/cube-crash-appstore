import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceContextMutationLedgerMountedTests:XCTestCase {
    private func engine(_ generation:UInt64=1)->NativeGameplayEngine {
        NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1)],generation:generation))
    }
    private func write(_ e:NativeGameplayEngine,_ token:UInt64,_ now:Int64)->Bool {
        e.recordSourceMeterBoardMutation(.mergeSixSpawnOwnerAllocated(token),generation:e.state.generation,sourceDateMilliseconds:now)
    }
    func testActualContextRetirementCapturesBeforeExternalCallbackAndFreshSceneCoreAdopts() throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        let a=engine(),c=engine(2);var observedBefore:Int64?
        let aScope=try XCTUnwrap(context.beginScene(engine:a){
            observedBefore=context.mutationLedger.snapshot?.lastMutationDateMilliseconds
            XCTAssertTrue(self.write(a,8,999)) // obsolete A's later genuine callback
        })
        XCTAssertTrue(write(a,7,123))
        let cScope=try XCTUnwrap(context.beginScene(engine:c){})
        XCTAssertFalse(aScope.current);XCTAssertTrue(cScope.current)
        XCTAssertEqual(observedBefore,123);XCTAssertEqual(c.sourceMeterLastBoardMutationDateMilliseconds,123)
        XCTAssertFalse(write(c,7,300));XCTAssertTrue(write(c,8,300))
        context.dispose();service.dispose()
    }
    func testActualReentrantRetirementPublishesCAndOuterBDoesNotAdoptOrOverwrite()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        let a=engine(),b=engine(2),c=engine(3);var cScope:NativeGameplaySourceContext.Scope?
        let aScope=try XCTUnwrap(context.beginScene(engine:a){
            XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,100)
            cScope=context.beginScene(engine:c){}
            XCTAssertTrue(self.write(c,2,200))
        })
        XCTAssertTrue(write(a,1,100));XCTAssertNil(context.beginScene(engine:b){XCTFail("Unpublished B must not own retirement")})
        XCTAssertFalse(aScope.current);XCTAssertTrue(try XCTUnwrap(cScope).current)
        XCTAssertEqual(c.sourceMeterLastBoardMutationDateMilliseconds,200)
        // B was never adopted: true initial adoption remains possible.
        XCTAssertTrue(b.adoptSourceMeterMutationSnapshot(.init(generation:2),generation:2))
        context.dispose();XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,200);service.dispose()
    }
    func testFreshAlreadyWrittenEngineRefusesSourceSceneScopeBeforeGameplayBindings()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        let a=engine(),b=engine(2);_ = try XCTUnwrap(context.beginScene(engine:a){})
        XCTAssertTrue(write(a,5,100));XCTAssertTrue(write(b,1,200))
        XCTAssertNil(context.beginScene(engine:b){XCTFail("Failed adoption must not publish scope")})
        XCTAssertEqual(b.sourceMeterLastBoardMutationDateMilliseconds,200)
        XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,100)
        context.dispose();service.dispose()
    }
    func testSameEngineRealRestartKeepsSourceLedgerIdentityAndDate()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        let a=engine();_ = try XCTUnwrap(context.beginScene(engine:a){})
        XCTAssertTrue(write(a,3,100));a.restart(state:a.state)
        XCTAssertNotNil(context.beginScene(engine:a){})
        XCTAssertEqual(context.mutationLedger.snapshot?.generation,a.state.generation)
        XCTAssertEqual(a.sourceMeterLastBoardMutationDateMilliseconds,100)
        XCTAssertFalse(write(a,3,300));XCTAssertTrue(write(a,4,300))
        context.dispose();service.dispose()
    }
    func testContextDisposalCapturesBeforeCallbackAndCannotRebindDuringDestruction()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        let a=engine(),c=engine(2)
        _ = try XCTUnwrap(context.beginScene(engine:a){
            XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,321)
            XCTAssertNil(context.beginScene(engine:c){})
        })
        XCTAssertTrue(write(a,1,321));context.dispose();context.dispose()
        XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,321)
        XCTAssertNil(context.beginScene(engine:c){});service.dispose()
    }
    func testActualVcInitialSourceScopeBindsBeforeAnyWriterWhileRawVcStaysUnadopted()throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        for enabled in [false,true] {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0),e=engine()
            let vc=NativeGameplayViewController(engine:e,resourceRoot:root),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            vc.sourceContext=context;vc.sourceSmallStackPresentationEnabled=enabled
            window.rootViewController=vc;window.makeKeyAndVisible();vc.view.frame=window.bounds;vc.view.layoutIfNeeded()
            if enabled {
                XCTAssertNotNil(vc.sourceScope);XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,0)
                XCTAssertFalse(e.adoptSourceMeterMutationSnapshot(.init(generation:e.state.generation),generation:e.state.generation))
                XCTAssertTrue(write(e,1,123));vc.dispose();XCTAssertEqual(context.mutationLedger.snapshot?.lastMutationDateMilliseconds,123)
            } else {
                XCTAssertNil(vc.sourceScope);XCTAssertNil(context.mutationLedger.snapshot)
                XCTAssertTrue(e.adoptSourceMeterMutationSnapshot(.init(generation:e.state.generation),generation:e.state.generation));vc.dispose()
            }
            context.dispose();service.dispose();window.isHidden=true
        }
    }
    func testInjectedAppMicrotaskIdentityBorrowDoesNotCreateOrInstallAnotherTransport()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,sourceMicrotaskTasks:tasks)
        let a=try XCTUnwrap(context.beginScene(engine:engine()){})
        XCTAssertTrue(context.sourceMicrotaskTasks === tasks);XCTAssertTrue(a.sourceMicrotaskTasks === tasks)
        XCTAssertNil(service.sourceMicrotaskTasks,"Context injection does not install service RAF boundary")
        context.dispose();service.dispose();fifo.dispose()
    }
}
