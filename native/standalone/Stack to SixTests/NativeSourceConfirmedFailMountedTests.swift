import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

/// Opt-in fixtures supply explicit missing caller owners; this does NOT admit
/// all Source NO MOVES callers, idle/transaction markers or original star roots.
@MainActor final class NativeSourceConfirmedFailMountedTests:XCTestCase {
    @MainActor private final class Fixture {
        let engine:NativeGameplayEngine,service:NativeSourceAnimationClockService
        let context:NativeGameplaySourceContext,game:NativeGameplayViewController,window:UIWindow
        init(mode:NativeRunMode = .journey,star:Bool=false) {
            var tiles:[NativeTile]=[.init(id:"a",cell:.init(column:2,row:0),value:4),.init(id:"b",cell:.init(column:3,row:0),value:3)]
            if star {tiles += [.init(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star),.init(id:"d",cell:.init(column:1,row:0),value:2)]}
            engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles,mode:mode),recordedRandomChoices:Array(repeating:0,count:300));engine.stagedSourceNoMoves=true
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
            context=NativeGameplaySourceContext(service:service,visualRandom:{0.5})
            game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
            game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true;game.sourceNoMovesPresentationEnabled=true
            game.sourceNoMovesBindings = .init(visibleShowCue:{_,_ in},admitted:{[weak game] gen in game?.engine.state.generation==gen && game?.sourceScope?.current==true},refreshRuntime:{},ordinaryCallerReady:{_,_ in false},levelEndPreflight:{nil},stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},terminalFields:{_,_ in},queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{})
            window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible();game.view.frame=window.bounds;game.view.layoutIfNeeded()
        }
        func dispose(){game.dispose();context.dispose();service.dispose();window.isHidden=true;window.rootViewController=nil}
    }
    private func prepared(_ f:Fixture)async {
        let ready=expectation(description:"Actual original NO MOVES assets")
        f.game.prepareSourceNoMovesSceneBinding {ok in XCTAssertTrue(ok);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
    }
    private func confirm(_ f:Fixture)throws->NativeNoMovesCandidateOwner.Plan {
        guard case .candidate(let p)=f.engine.beginSourceNoMoves(origin:.levelEnd) else{throw NSError(domain:"confirmedPlan",code:1)}
        _=f.engine.deliverSourceNoMovesWait(plan:p,generation:1);_=f.engine.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited)
        let endpoint=try XCTUnwrap(f.game.sourceNoMovesTerminalRegistry)
        XCTAssertEqual(f.engine.acquireSourceNoMovesLock(plan:p,generation:1,afterLock:{_ = endpoint.terminalFields(active:true,ttlMilliseconds:12000,observer:{_,_ in})}),.confirmedFinal(p));return p
    }
    private func prepareStars(_ f:Fixture,mount:Bool)throws->[NativeHUDStarReceipt] {
        // This fixture tests HUD-flight cleanup, not Source direct-main80.
        // Use the genuine existing synchronous Core drop branch to create its
        // real earned-star receipts; no fabricated arrival or board exit.
        let staged=f.engine.stagedDirectWildMoves;f.engine.stagedDirectWildMoves=false
        XCTAssertTrue(f.engine.beginDrag(tileID:"s"));XCTAssertTrue(f.engine.drop(target:.init(column:1,row:0)).accepted)
        f.engine.stagedDirectWildMoves=staged
        for t in f.engine.state.tiles where t.id != "a" && t.id != "b" {var r=NativeNoMovesTileRuntime();r.destroyed=true;f.engine.noMovesTileRuntime[t.id]=r}
        let stars=f.engine.pendingHUDStars;XCTAssertFalse(stars.isEmpty)
        if mount {let scene=try XCTUnwrap(f.game.boardScene);scene.setSuspended(false);scene.setSuspended(true)}
        return stars
    }
    func testActualPausedJourneyWallHandoffKillsCapturedProtectedFlightsWithoutAward()async throws {
        let f=Fixture(star:true);defer{f.dispose()};await prepared(f)
        let stars=try prepareStars(f,mount:true),plan=try confirm(f),score=f.engine.state.score
        let done=expectation(description:"Actual wall60 then real Source board exit"),start=Date()
        f.game.beginSourceConfirmedFailBoardExit(generation:1) {ok in
            XCTAssertTrue(ok);XCTAssertGreaterThanOrEqual(Date().timeIntervalSince(start),0.055)
            XCTAssertTrue(f.engine.pendingHUDStars.isEmpty);XCTAssertEqual(f.engine.state.score,score)
            XCTAssertTrue(f.engine.finishSourceNoMovesBoardExit(plan:plan,generation:1).accepted);done.fulfill()
        }
        XCTAssertEqual(f.engine.pendingHUDStars,stars);XCTAssertNil(f.engine.completedSourceNoMovesReceipt)
        await fulfillment(of:[done],timeout:4)
        for r in stars {XCTAssertFalse(f.engine.commitHUDStarArrival(receiptID:r.id,generation:r.generation).accepted)}
        XCTAssertEqual(f.engine.state.score,score);XCTAssertTrue(f.engine.flags.busyEnding)
        XCTAssertEqual(f.game.sourceScope?.registries.snapshot(isWild:false)?.inputReasons,["terminal-no-moves"])
    }
    func testActualArcade40HandoffUsesRealExitReceiptWithoutSyntheticTerminal()async throws {
        let f=Fixture(mode:.arcade);defer{f.dispose()};await prepared(f);_=try confirm(f)
        let done=expectation(description:"Actual wall40 and board exit"),start=Date()
        f.game.beginSourceConfirmedFailBoardExit(generation:1) {ok in XCTAssertTrue(ok);XCTAssertGreaterThanOrEqual(Date().timeIntervalSince(start),0.035);done.fulfill()}
        await fulfillment(of:[done],timeout:4)
        XCTAssertNil(f.engine.completedSourceNoMovesReceipt,"VC exit receipt alone does not fabricate Core board-exit publication")
    }
    func testUnboundPendingFlightRefusesCleanupInsteadOfForcedScoreOrFakeExit()async throws {
        let f=Fixture(star:true);defer{f.dispose()};await prepared(f)
        let stars=try prepareStars(f,mount:false);_=try confirm(f);let score=f.engine.state.score
        let done=expectation(description:"Missing actual flight ownership refuses")
        f.game.beginSourceConfirmedFailBoardExit(generation:1){ok in XCTAssertFalse(ok);done.fulfill()}
        await fulfillment(of:[done],timeout:2)
        XCTAssertEqual(f.engine.pendingHUDStars,stars);XCTAssertEqual(f.engine.state.score,score);XCTAssertNil(f.engine.completedSourceNoMovesReceipt)
        XCTAssertFalse(f.engine.flags.busyEnding);XCTAssertEqual(f.game.sourceScope?.registries.snapshot(isWild:false)?.inputReasons,[])
    }
    func testRetirementDuringActualWallWaitRejectsOnceAndNeverLandsOrPublishesExit()async throws {
        let f=Fixture(star:true);defer{f.dispose()};await prepared(f)
        let stars=try prepareStars(f,mount:true);_=try confirm(f);let score=f.engine.state.score
        let done=expectation(description:"Captured wall cancellation");var replies=0
        f.game.beginSourceConfirmedFailBoardExit(generation:1){ok in replies += 1;XCTAssertFalse(ok);done.fulfill()}
        f.game.retireSourceNoMovesUIKit();await fulfillment(of:[done],timeout:2)
        try? await Task.sleep(nanoseconds:100_000_000)
        XCTAssertEqual(replies,1);XCTAssertEqual(f.engine.pendingHUDStars,stars);XCTAssertEqual(f.engine.state.score,score)
        XCTAssertNil(f.engine.completedSourceNoMovesReceipt);XCTAssertFalse(f.engine.flags.busyEnding)
    }
    func testActualModalActionCleanupPrecedesRouteAndRetainsKeyUntilSheetFinishes()async throws {
        let f=Fixture();defer{f.dispose()};await prepared(f);let p=try confirm(f)
        let result=f.engine.finishSourceNoMovesBoardExit(plan:p,generation:1),receipt=try XCTUnwrap(f.engine.completedSourceNoMovesReceipt),endpoint=try XCTUnwrap(f.game.sourceNoMovesTerminalRegistry)
        let routed=expectation(description:"Actual Source modal close and retry"),owner=NativeResultOwner(gameplay:f.game,root:NativeTestResources.root,resolution:result.resolution,commit:{_ in},restart:{XCTAssertFalse(f.engine.flags.busyEnding);XCTAssertEqual(f.game.sourceScope?.registries.snapshot(isWild:false)?.inputReasons,[]);routed.fulfill()},continueArcade:{},exit:{},sourceNoMovesReceipt:receipt)
        var cleanups=0
        owner.onSourceFinalCleanup={r in cleanups += 1;XCTAssertTrue(f.game.sourceConfirmedFailFinalCleanup(receipt:r,endpoint:endpoint))}
        defer{owner.dispose()};owner.present()
        let sheet=try XCTUnwrap(f.game.presentedViewController as? NativeResultController)
        XCTAssertTrue(f.engine.flags.busyEnding);XCTAssertEqual(cleanups,0)
        sheet.tick(0);for i in 1...30 {sheet.tick(Double(i)/10)}
        func button(_ v:UIView)->UIButton? {if v.accessibilityIdentifier=="native.result.play-again" {return v as? UIButton};return v.subviews.compactMap(button).first}
        let cta=try XCTUnwrap(button(sheet.view));XCTAssertTrue(cta.isUserInteractionEnabled);cta.sendActions(for:.touchUpInside)
        await fulfillment(of:[routed],timeout:4);XCTAssertEqual(cleanups,1);owner.dispose();XCTAssertEqual(cleanups,1)
    }
    func testActualModalAbortFinallyClearsCoreAndExactRegistryLeaseOnce()async throws {
        let f=Fixture();defer{f.dispose()};await prepared(f);let p=try confirm(f)
        let result=f.engine.finishSourceNoMovesBoardExit(plan:p,generation:1),receipt=try XCTUnwrap(f.engine.completedSourceNoMovesReceipt),endpoint=try XCTUnwrap(f.game.sourceNoMovesTerminalRegistry)
        let owner=NativeResultOwner(gameplay:f.game,root:NativeTestResources.root,resolution:result.resolution,commit:{_ in},restart:{XCTFail()},continueArcade:{XCTFail()},exit:{XCTFail()},sourceNoMovesReceipt:receipt)
        var cleanups=0;owner.onSourceFinalCleanup={r in cleanups += 1;XCTAssertTrue(f.game.sourceConfirmedFailFinalCleanup(receipt:r,endpoint:endpoint))}
        owner.present();XCTAssertTrue(f.engine.flags.busyEnding);owner.dispose();owner.dispose()
        XCTAssertEqual(cleanups,1);XCTAssertFalse(f.engine.flags.busyEnding);XCTAssertEqual(f.game.sourceScope?.registries.snapshot(isWild:false)?.inputReasons,[])
    }
}
