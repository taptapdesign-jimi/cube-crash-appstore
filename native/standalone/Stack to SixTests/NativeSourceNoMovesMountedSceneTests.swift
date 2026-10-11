import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

/// Mounted transport tests. Fixture callbacks stand in for the required owner
/// contract; these tests do not admit unported idle/guard/caller preflight owners.
@MainActor final class NativeSourceNoMovesMountedSceneTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private func state(_ values:[Int])->NativeBoardState {
        NativeBoardState(columns:5,rows:9,tiles:values.enumerated().map {
            NativeTile(id:"t\($0.offset)",cell:.init(column:$0.offset,row:0),value:$0.element)
        })
    }
    @MainActor private final class Mounted {
        let engine:NativeGameplayEngine,service:NativeSourceAnimationClockService
        let context:NativeGameplaySourceContext,controller:NativeGameplayViewController,window:UIWindow
        var trace:[String]=[]
        var proof:NativeSourceNoMovesLevelEndPreflight?
        init(root:URL,state:NativeBoardState,enabled:Bool) {
            engine=NativeGameplayEngine(state:state);engine.stagedSourceNoMoves=enabled
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
            context=NativeGameplaySourceContext(service:service,visualRandom:{0.5})
            controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
            window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            controller.sourceContext=context;controller.sourceSmallStackPresentationEnabled=enabled
            controller.sourceNoMovesPresentationEnabled=enabled
            controller.sourceNoMovesBindings = .init(visibleShowCue:{[weak self] _,token in self?.trace.append("visible.audio:\(token)")},admitted:{[weak controller,weak context] gen in
                controller?.engine.state.generation==gen && controller?.sourceScope?.current==true && context != nil
            },refreshRuntime:{},ordinaryCallerReady:{ _,_ in true },levelEndPreflight:{[weak self] in self?.proof},
            stopIdleAndIdleSmoke:{[weak self] in self?.trace.append("idle.stop+tag")},
            restartIdle:{[weak self] in self?.trace.append("idle.start")},
            persistStuckState:{[weak self] in self?.trace.append("persist")},
            resetHint:{[weak self] in self?.trace.append("hint")},
            terminalFields:{[weak self] active,ttl in self?.trace.append("terminal:\(active):\(ttl)")},
            queueGuardRelease:{[weak self] _ in self?.trace.append("guard.queue")},
            scheduleGSAPRecheck:{[weak self] ms,_ in self?.trace.append("recheck:\(ms)")},
            exitFailure:{[weak self] in self?.trace.append("exit.failed")})
            window.rootViewController=controller;window.makeKeyAndVisible()
            controller.view.frame=window.bounds;controller.view.layoutIfNeeded()
        }
        func dispose(){controller.dispose();context.dispose();service.dispose();window.isHidden=true}
    }
    private func prepared(_ f:Mounted)async {
        let ready=expectation(description:"Original selected PNG and font prepared")
        f.controller.prepareSourceNoMovesSceneBinding {ok in XCTAssertTrue(ok);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
    }
    private func awaitActualEntry(_ f:Mounted)async {
        let deadline=Date().addingTimeInterval(4)
        while f.controller.boardScene?.isBoardEntryComplete != true && Date()<deadline {
            try? await Task.sleep(nanoseconds:10_000_000)
        }
        XCTAssertEqual(f.controller.boardScene?.isBoardEntryComplete,true)
    }
    func testDefaultOffDoesNotAcquireCandidateOrMountText()throws {
        let f=Mounted(root:root,state:state([4,3]),enabled:false);defer{f.dispose()}
        let scene=try XCTUnwrap(f.controller.boardScene)
        XCTAssertFalse(scene.beginSourceNoMovesFromLevelEndCaller())
        XCTAssertNil(f.engine.pendingSourceNoMoves);XCTAssertNil(f.controller.sourceNoMovesUIKit)
        XCTAssertTrue(f.trace.isEmpty)
    }
    func testUnsupportedThreeCallerCategoriesAndMissingOrStaleLevelEndProofRefuseBeforeOwnership()async throws {
        let f=Mounted(root:root,state:state([4,3]),enabled:true);defer{f.dispose()}
        await prepared(f);let scene=try XCTUnwrap(f.controller.boardScene)
        for caller:NativeSourceNoMovesUnsupportedCaller in [.mergeMovesDepleted,.movesDepleted,.tutorialOrRescue] {
            XCTAssertFalse(scene.refuseUnsupportedSourceNoMovesCaller(caller))
        }
        XCTAssertFalse(scene.beginSourceNoMovesFromLevelEndCaller())
        f.proof = .init(generation:f.engine.state.generation,signature:"obsolete",
            stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,
            recentTntMutationRecheckCompleted:true,sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
        XCTAssertFalse(scene.beginSourceNoMovesFromLevelEndCaller())
        f.proof = .init(generation:f.engine.state.generation,signature:f.engine.sourceGameplaySignature.key,
            stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,
            recentTntMutationRecheckCompleted:false,sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
        XCTAssertFalse(scene.beginSourceNoMovesFromLevelEndCaller())
        XCTAssertNil(f.engine.pendingSourceNoMoves);XCTAssertNil(f.controller.sourceNoMovesUIKit?.presentation)
        XCTAssertTrue(f.trace.isEmpty)
    }
    func testActualOrdinaryPostcheckMountsLastTwoTextBeforeStatePublicationAndPickupKeepsCandidate()async throws {
        let f=Mounted(root:root,state:state([2,3]),enabled:true);defer{f.dispose()}
        await prepared(f)
        let scene=try XCTUnwrap(f.controller.boardScene)
        await awaitActualEntry(f)
        let geometry=try XCTUnwrap(scene.boardGeometry),candidate=expectation(description:"Real ordinary postcheck")
        var published=false
        f.controller.onStateChange={state in
            // Source stuck postcheck returns before moves--. Observe the actual
            // candidate publication rather than waiting for an invented debit.
            if f.engine.pendingSourceNoMoves != nil,!published {
                XCTAssertEqual(state.moves,50)
                published=true
                XCTAssertEqual(f.engine.pendingSourceNoMoves?.trigger,.lastTwoRegular)
                XCTAssertNotNil(f.controller.sourceNoMovesUIKit?.presentation?.superview)
                candidate.fulfill()
            }
        }
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        scene.moveDrag(to:geometry.center(row:0,column:1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:1)).accepted)
        await fulfillment(of:[candidate],timeout:3)
        XCTAssertTrue(scene.sourceNoMovesCandidateActive);XCTAssertTrue(scene.navigationLocked)
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:1)))
        XCTAssertTrue(scene.sourceNoMovesCandidateActive,"Pickup is not Source wait cancellation")
        f.controller.setSuspended(true)
        XCTAssertTrue(scene.sourceNoMovesCandidateActive);XCTAssertFalse(f.engine.flags.busyEnding)
        scene.cancelDrag();f.controller.setSuspended(false)
    }
    func testActualLevelEndUsesMountedV3AndRealBoardExitBeforeTerminal()async throws {
        let f=Mounted(root:root,state:state([4,3]),enabled:true);defer{f.dispose()}
        await prepared(f);await awaitActualEntry(f)
        let scene=try XCTUnwrap(f.controller.boardScene)
        f.proof = .init(generation:f.engine.state.generation,signature:f.engine.sourceGameplaySignature.key,
            stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,
            recentTntMutationRecheckCompleted:true,sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
        let terminal=expectation(description:"Actual native board exit then terminal")
        var terminalCount=0
        f.controller.onTerminal={resolution in
            terminalCount += 1;XCTAssertEqual(resolution.kind,.fail)
            XCTAssertNil(f.controller.sourceNoMovesUIKit?.presentation)
            terminal.fulfill()
        }
        XCTAssertTrue(scene.beginSourceNoMovesFromLevelEndCaller())
        XCTAssertNil(f.engine.state.terminal);XCTAssertFalse(f.engine.flags.busyEnding)
        let node=try XCTUnwrap(f.controller.sourceNoMovesUIKit?.presentation)
        XCTAssertTrue(node.superview === f.controller.view);XCTAssertEqual(node.cloudViews.count,5)
        await fulfillment(of:[terminal],timeout:7)
        XCTAssertEqual(terminalCount,1);XCTAssertEqual(f.engine.state.terminal?.kind,.fail)
        XCTAssertTrue(f.trace.contains("persist"));XCTAssertTrue(f.trace.contains("terminal:true:12000"))
    }
    func testReentrantAdmissionInstallsReplacementCAndOldConfigureCannotEraseIt()async throws {
        let f=Mounted(root:root,state:state([4,3]),enabled:true);defer{f.dispose()}
        await prepared(f);await awaitActualEntry(f)
        let scene=try XCTUnwrap(f.controller.boardScene),owner=try XCTUnwrap(f.controller.sourceNoMovesUIKit)
        var replacement=try XCTUnwrap(f.controller.sourceNoMovesBindings)
        replacement.levelEndPreflight={
            .init(generation:f.engine.state.generation,signature:f.engine.sourceGameplaySignature.key,
                stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,
                recentTntMutationRecheckCompleted:true,sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
        }
        var replacementShown=0,oldShown=0
        let installC:()->Void = {
            XCTAssertTrue(scene.configureSourceNoMoves(bindings:replacement,
                showText:{plan,gen in replacementShown += 1;XCTAssertTrue(owner.show(generation:gen,receipt:plan.token))},
                beginTextExit:{gen,reply in owner.beginExit(generation:gen,completion:reply)},
                clearText:{owner.clear()},confirmedBoardExit:{_,reply in reply(false)}))
        }
        var old=replacement
        old.admitted={_ in installC();return true}
        XCTAssertFalse(scene.configureSourceNoMoves(bindings:old,
            showText:{_,_ in oldShown += 1},beginTextExit:{_,reply in reply(false)},
            clearText:{},confirmedBoardExit:{_,reply in reply(false)}))
        XCTAssertTrue(scene.beginSourceNoMovesFromLevelEndCaller())
        XCTAssertEqual(replacementShown,1);XCTAssertEqual(oldShown,0)
        XCTAssertNotNil(owner.presentation?.superview)
    }
    func testDirectSceneDisposalRetiresMountedGraphAndLateWaitCannotPublishTerminal()async throws {
        let f=Mounted(root:root,state:state([4,3]),enabled:true);defer{f.dispose()}
        await prepared(f);await awaitActualEntry(f)
        let scene=try XCTUnwrap(f.controller.boardScene),owner=try XCTUnwrap(f.controller.sourceNoMovesUIKit)
        f.proof = .init(generation:f.engine.state.generation,signature:f.engine.sourceGameplaySignature.key,
            stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,
            recentTntMutationRecheckCompleted:true,sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
        XCTAssertTrue(scene.beginSourceNoMovesFromLevelEndCaller());XCTAssertNotNil(owner.presentation)
        XCTAssertEqual(f.trace.filter{$0.hasPrefix("visible.audio:")}.count,1)
        scene.dispose();scene.dispose()
        XCTAssertNil(owner.presentation);XCTAssertFalse(scene.sourceNoMovesCandidateActive)
        XCTAssertFalse(scene.beginSourceNoMovesFromLevelEndCaller())
        var rebound=try XCTUnwrap(f.controller.sourceNoMovesBindings)
        rebound.levelEndPreflight={nil}
        XCTAssertFalse(scene.configureSourceNoMoves(bindings:rebound,showText:{_,_ in XCTFail()},
            beginTextExit:{_,_ in XCTFail()},clearText:{},confirmedBoardExit:{_,_ in XCTFail()}))
        try? await Task.sleep(nanoseconds:1_600_000_000)
        XCTAssertNil(f.engine.state.terminal);XCTAssertEqual(f.trace.filter{$0.hasPrefix("visible.audio:")}.count,1)
    }
    func testColdPreparationDisposeReentryCannotDeliverStaleReadyOrCreateGraph()async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
        defer{service.dispose()}
        let owner=NativeSourceNoMovesUIKitCoordinator(host:UIView(frame:CGRect(x:0,y:0,width:390,height:844)),
            root:root,service:service,current:{_ in true},random:{0.5},fallback:{_,_ in {}},onVisibleShow:{_,_ in XCTFail("Disposed/invisible show cannot play authored cue")})
        let replies=expectation(description:"Coalesced original preparation replies");replies.expectedFulfillmentCount=2
        owner.prepare {ready in XCTAssertTrue(ready);owner.dispose();replies.fulfill()}
        owner.prepare {ready in XCTAssertFalse(ready);replies.fulfill()}
        await fulfillment(of:[replies],timeout:5)
        XCTAssertEqual(owner.preparationCount,1);XCTAssertFalse(owner.show(generation:1,receipt:1));XCTAssertNil(owner.presentation)
    }
}
