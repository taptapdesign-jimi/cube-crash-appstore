import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

/// Actual mounted publication/terminal transport tests. Other required Source
/// idle/tag/marker/queue owners are explicit fixture hooks, not admitted ports.
@MainActor final class NativeSourceNoMovesTerminalEndpointMountedTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    @MainActor private final class Mounted {
        let engine:NativeGameplayEngine,service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext
        let controller:NativeGameplayViewController,window:UIWindow
        var trace:[String]=[],admitted=true
        var terminalObserver:((Bool)->Void)?
        var proof:NativeSourceNoMovesLevelEndPreflight?
        init(root:URL,enabled:Bool=true) {
            engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4),.init(id:"b",cell:.init(column:1,row:0),value:3)]))
            engine.stagedSourceNoMoves=enabled
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
            context=NativeGameplaySourceContext(service:service,visualRandom:{0.5},sourceDateMilliseconds:{100})
            controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
            window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            controller.sourceContext=context;controller.sourceSmallStackPresentationEnabled=enabled
            controller.sourceNoMovesPresentationEnabled=enabled
            controller.sourceNoMovesBindings = .init(visibleShowCue:{_,_ in},admitted:{[weak self] gen in
                guard let self else{return false};return self.admitted && self.engine.state.generation==gen && self.controller.sourceScope?.current==true
            },refreshRuntime:{},ordinaryCallerReady:{_,_ in true},levelEndPreflight:{[weak self] in self?.proof},
                stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},
                terminalFields:{[weak self] active,ttl in
                    guard let self else{return};self.trace.append("terminal:\(active):\(ttl)")
                    if active {
                        XCTAssertTrue(self.engine.flags.busyEnding)
                        XCTAssertEqual(self.controller.sourceScope?.registries.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
                    }
                    self.terminalObserver?(active)
                },queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{})
            window.rootViewController=controller;window.makeKeyAndVisible();controller.view.frame=window.bounds;controller.view.layoutIfNeeded()
        }
        func dispose(){controller.dispose();context.dispose();service.dispose();window.isHidden=true}
    }
    private func prepared(_ f:Mounted,expected:Bool=true)async {
        let reply=expectation(description:"Actual selected assets and captured Scene publication")
        f.controller.prepareSourceNoMovesSceneBinding {ok in XCTAssertEqual(ok,expected);reply.fulfill()}
        await fulfillment(of:[reply],timeout:5)
    }
    private func entry(_ f:Mounted)async {
        let deadline=Date().addingTimeInterval(4)
        while f.controller.boardScene?.isBoardEntryComplete != true && Date()<deadline {try? await Task.sleep(nanoseconds:10_000_000)}
        XCTAssertEqual(f.controller.boardScene?.isBoardEntryComplete,true)
    }
    private func levelEndProof(_ f:Mounted) {
        f.proof = .init(generation:f.engine.state.generation,signature:f.engine.sourceGameplaySignature.key,
            stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,recentTntMutationRecheckCompleted:true,
            sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
    }
    func testDefaultOffDoesNotCreateTerminalEndpointOrCapability()throws {
        let f=Mounted(root:root,enabled:false);defer{f.dispose()}
        XCTAssertNil(f.controller.sourceNoMovesTerminalRegistry);XCTAssertNil(f.controller.sourceScope)
        XCTAssertFalse(try XCTUnwrap(f.controller.boardScene).beginSourceNoMovesFromLevelEndCaller())
        XCTAssertTrue(f.trace.isEmpty)
    }
    func testActualVcPublicationMountsAfterReadyAndRealTerminalLockSurvivesCompletedExit()async throws {
        let f=Mounted(root:root);defer{f.dispose()};await prepared(f);await entry(f)
        let scope=try XCTUnwrap(f.controller.sourceScope),endpoint=try XCTUnwrap(f.controller.sourceNoMovesTerminalRegistry)
        XCTAssertTrue(endpoint.mounted);XCTAssertTrue(scope.registries.missing([.terminalNoMovesInput]).isEmpty)
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
        levelEndProof(f);let terminal=expectation(description:"Actual Scene text exit and board exit")
        f.controller.onTerminal={resolution in XCTAssertEqual(resolution.kind,.fail);terminal.fulfill()}
        XCTAssertTrue(try XCTUnwrap(f.controller.boardScene).beginSourceNoMovesFromLevelEndCaller())
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
        await fulfillment(of:[terminal],timeout:7)
        XCTAssertTrue(f.trace.contains("terminal:true:12000"))
        let receipt=try XCTUnwrap(f.engine.completedSourceNoMovesReceipt)
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
        XCTAssertTrue(endpoint.actualFinalCleanup(receipt:receipt));XCTAssertFalse(endpoint.actualFinalCleanup(receipt:receipt))
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
    }
    func testActualPostLockFreshGuardRollbackReleasesCapturedRegistryBeforeObserver()async throws {
        let f=Mounted(root:root);defer{f.dispose()};await prepared(f);await entry(f)
        let scope=try XCTUnwrap(f.controller.sourceScope),rolledBack=expectation(description:"Actual Core post-lock recheck rollback")
        f.terminalObserver={[weak f] active in
            guard let f else{return}
            if active {var flags=f.engine.flags;flags.endgameGuardActive=true;f.engine.setRuntimeFlags(flags)}
            else {
                XCTAssertFalse(f.engine.flags.busyEnding)
                XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
                rolledBack.fulfill()
            }
        }
        levelEndProof(f);XCTAssertTrue(try XCTUnwrap(f.controller.boardScene).beginSourceNoMovesFromLevelEndCaller())
        await fulfillment(of:[rolledBack],timeout:7)
        XCTAssertNil(f.engine.state.terminal);XCTAssertNil(f.engine.pendingSourceNoMoves)
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.failScreenPending,false)
    }
    func testFailedRealSceneConfigureNeverMountsCapabilityFromArtworkReady()async throws {
        let f=Mounted(root:root);defer{f.dispose()};f.admitted=false;await prepared(f,expected:false)
        let scope=try XCTUnwrap(f.controller.sourceScope)
        XCTAssertNil(f.controller.sourceNoMovesTerminalRegistry)
        XCTAssertEqual(scope.registries.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
    }
    func testUnconfirmedCapturedSceneEndpointCannotStartCandidate()async throws {
        let f=Mounted(root:root);defer{f.dispose()};await prepared(f);await entry(f)
        let scene=try XCTUnwrap(f.controller.boardScene),scope=try XCTUnwrap(f.controller.sourceScope)
        let c=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope.registries,engine:f.engine)
        levelEndProof(f)
        let bindings=try XCTUnwrap(f.controller.sourceNoMovesBindings)
        XCTAssertTrue(scene.configureSourceNoMoves(bindings:bindings,showText:{_,_ in},beginTextExit:{_,reply in reply(false)},clearText:{},confirmedBoardExit:{_,reply in reply(false)},terminalRegistry:c))
        XCTAssertFalse(c.mounted);XCTAssertFalse(scene.beginSourceNoMovesFromLevelEndCaller())
        XCTAssertNil(f.engine.pendingSourceNoMoves)
        XCTAssertTrue(scene.confirmSourceNoMovesTerminalRegistry(c));XCTAssertTrue(c.current)
    }
    func testOldVcAUnhookCannotRetireSameScopePublishedSceneC()async throws {
        let f=Mounted(root:root);defer{f.dispose()};await prepared(f)
        let scene=try XCTUnwrap(f.controller.boardScene),scope=try XCTUnwrap(f.controller.sourceScope),a=try XCTUnwrap(f.controller.sourceNoMovesTerminalRegistry)
        let c=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope.registries,engine:f.engine),bindings=try XCTUnwrap(f.controller.sourceNoMovesBindings)
        XCTAssertTrue(scene.configureSourceNoMoves(bindings:bindings,showText:{_,_ in},beginTextExit:{_,reply in reply(false)},clearText:{},confirmedBoardExit:{_,reply in reply(false)},terminalRegistry:c))
        XCTAssertTrue(scene.confirmSourceNoMovesTerminalRegistry(c));XCTAssertFalse(a.current)
        f.controller.retireSourceNoMovesUIKit()
        XCTAssertTrue(c.current);XCTAssertTrue(scope.registries.missing([.terminalNoMovesInput]).isEmpty)
        XCTAssertTrue(scene.retireSourceNoMovesTerminalRegistry(c));XCTAssertFalse(c.current)
        XCTAssertEqual(scope.registries.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
    }
    func testActualDirectSceneDisposeUnhooksEndpointBeforeAnyLateWait()async throws {
        let f=Mounted(root:root);defer{f.dispose()};await prepared(f);await entry(f)
        let scene=try XCTUnwrap(f.controller.boardScene),scope=try XCTUnwrap(f.controller.sourceScope),endpoint=try XCTUnwrap(f.controller.sourceNoMovesTerminalRegistry)
        levelEndProof(f);XCTAssertTrue(scene.beginSourceNoMovesFromLevelEndCaller())
        scene.dispose();scene.dispose()
        XCTAssertFalse(endpoint.current);XCTAssertEqual(scope.registries.missing([.terminalNoMovesInput]),["terminalNoMovesInput"])
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
        try? await Task.sleep(nanoseconds:1_600_000_000)
        XCTAssertNil(f.engine.state.terminal);XCTAssertTrue(f.trace.isEmpty)
    }
    func testActualGenerationRefreshReplacesCapturedEndpointWithoutOldLeasePublication()async throws {
        let f=Mounted(root:root);defer{f.dispose()};await prepared(f)
        let a=try XCTUnwrap(f.controller.sourceNoMovesTerminalRegistry),scope=try XCTUnwrap(f.controller.sourceScope)
        f.engine.restart(state:f.engine.state);f.controller.refreshFromEngine();await prepared(f)
        let c=try XCTUnwrap(f.controller.sourceNoMovesTerminalRegistry)
        XCTAssertFalse(c === a);XCTAssertFalse(a.current);XCTAssertTrue(c.current)
        XCTAssertFalse(a.terminalFields(active:true,ttlMilliseconds:12000,observer:{_,_ in XCTFail()}))
        XCTAssertEqual(scope.registries.snapshot(isWild:false)?.inputReasons,[])
    }
}
