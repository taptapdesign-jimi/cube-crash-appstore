import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialBootstrapTests:XCTestCase {
    func testRestoredNonSourceSpecialBarContinuesToClearWithoutReservingStarEarly()async throws {
        var tutorial=NativeTutorialState();tutorial.step = .freePlay
        tutorial.specialBarSuccessfulActions=2;tutorial.specialBarAcknowledged=false
        var state=NativeBoardState(tiles:[NativeTile(id:"fallback-a",cell:.init(column:0,row:0),value:1),NativeTile(id:"fallback-b",cell:.init(column:1,row:0),value:2)])
        state.tutorial=tutorial;state.wildMeter=0.4
        let gameplay=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
        let owner=NativeTutorialOwner(gameplay:gameplay,root:NativeTestResources.root)
        owner.onChanged={[weak owner] state in owner?.refresh(state)}
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=gameplay;window.makeKeyAndVisible()
        defer{owner.dispose();gameplay.dispose();window.isHidden=true}
        gameplay.view.frame=window.bounds;gameplay.view.setNeedsLayout();gameplay.view.layoutIfNeeded()
        owner.refresh(gameplay.engine.state)
        let deadline=Date().addingTimeInterval(5)
        var overlay:NativeTutorialOverlay?
        while Date()<deadline {
            overlay=gameplay.view.subviews.compactMap{$0 as? NativeTutorialOverlay}.first
            if overlay?.specialBarVisible==true,overlay?.subviews.flatMap({$0.subviews}).compactMap({$0 as? UIButton}).first?.isEnabled==true{break}
            try await Task.sleep(for:.milliseconds(40))
        }
        let sheet=try XCTUnwrap(overlay);XCTAssertTrue(sheet.specialBarVisible)
        let button=try XCTUnwrap(sheet.subviews.flatMap{$0.subviews}.compactMap{$0 as? UIButton}.first)
        XCTAssertNil(gameplay.engine.sourceTutorialWildReservation)
        button.sendActions(for:.touchUpInside)
        while sheet.specialBarVisible && Date()<deadline{try await Task.sleep(for:.milliseconds(40))}
        XCTAssertFalse(sheet.specialBarVisible);XCTAssertEqual(gameplay.engine.state.tutorial?.specialBarAcknowledged,true)
        XCTAssertEqual(gameplay.engine.state.tutorial?.waitingForWild,false);XCTAssertNil(gameplay.engine.sourceTutorialWildReservation)
        XCTAssertTrue(sheet.subviews.flatMap{$0.subviews}.compactMap{$0 as? UILabel}.contains{$0.text=="Clear the stage"})
        button.sendActions(for:.touchUpInside)
        while gameplay.engine.state.tutorial?.waitingForWild==false && Date()<deadline{try await Task.sleep(for:.milliseconds(40))}
        XCTAssertEqual(gameplay.engine.state.tutorial?.waitingForWild,true)
    }
    func testActualFreshTutorialRouteUsesSourceDemoAndWaitsForGenuinePreparation() async throws {try await run(monitored:false,retireDuringExit:false)}
    func testActualFirstMergeKeepsSourceSheetAndInputUntilRealMonitorCompletions()async throws {try await run(monitored:true,retireDuringExit:false)}
    func testActualScopeRetirementDuringFirstExitCancelsMonitorAndInputBarrier()async throws {try await run(monitored:true,retireDuringExit:true)}
    func testActualSecondMergeWaitsForSourceThirdRestoreAndKeepsSameIntroOwner()async throws {try await run(monitored:true,retireDuringExit:false,third:true)}
    func testActualThirdButtonWaitsForCTAThenRestoresBeforeSourceSheetExit()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button")}
    func testActualThirdTileDragUsesSameCTAExitBeforeRestore()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"drag")}
    func testActualScopeRetirementDuringThirdCTAExitCannotRestoreOrCommitWaiting()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"retire")}
    func testActualTypedSourceFailureReturnsThroughNativeRouteAndPreservesDurableBytes()async throws {try await run(monitored:false,retireDuringExit:false,failure:true)}
    func testActualBootstrapInstallsMeterOwnersWithRealResourcesAndSharedCoreMath()async throws {try await run(monitored:false,retireDuringExit:false,meter:true)}
    func testActualFourthTutorialUsesEarnedStarSheetAndRetiresSameOwner()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true)}
    func testActualFourthTutorialMergeWaitsForRealExitThenCompletesGuide()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true,fourthComplete:true)}
    func testCompleteNativeTutorialStarMergeRetainsGameplayAndCompletesGuide()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true,fourthComplete:true,complete:true)}
    func testCompleteNativeTutorialOrdinaryOntoStarRetainsGameplayAndCompletesGuide()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true,fourthComplete:true,complete:true,reverseFourth:true)}
    func testActualSpecialBarBoardDragDismissesAndRetainsSamePhysicalPickup()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true,complete:true,specialInteraction:true)}
    func testSettledPostTutorialGameplayRetainsPhysicalOwnership()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true,fourthComplete:true,complete:true,reverseFourth:true,stressTurns:70)}
    func testRapidPostTutorialGameplayRetainsPhysicalOwnership()async throws {try await run(monitored:true,retireDuringExit:false,third:true,dismiss:"button",fourth:true,fourthComplete:true,complete:true,reverseFourth:true,stressTurns:150,stressFrames:4)}
    private func run(monitored:Bool,retireDuringExit:Bool,third:Bool=false,dismiss:String?=nil,failure:Bool=false,meter:Bool=false,fourth:Bool=false,fourthComplete:Bool=false,complete:Bool=false,reverseFourth:Bool=false,specialInteraction:Bool=false,stressTurns:Int=1,stressFrames:Int=100)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-initial-bootstrap-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=false;try store.save(envelope)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        var count=0
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{count+=1;return Double((count*37)%97)/97},sourceMicrotaskTasks:tasks)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
        bootstrap.sourceInitialFreshStartupEnabled=true;bootstrap.sourceBoardEntryEnabled=true;bootstrap.sourceTutorialActivationEnabled=true;bootstrap.sourceTutorialIntroEnabled=true;bootstrap.sourceTutorialHUDEnabled=true;bootstrap.sourceTutorialFirstStepMonitorEnabled=monitored;bootstrap.sourceTutorialSubsequentPresentationEnabled=third
        bootstrap.sourceLogicalMathRandomEnabled=meter || fourth
        bootstrap.sourceSpecialIdlePresentationEnabled=fourth
        if complete {
            bootstrap.completeNativeGameplayEnabled=true
            bootstrap.sourceCanonicalGameplaySaveEnabled=true
            bootstrap.sourceWildShimmerPresentationEnabled=true
            bootstrap.sourceTutorialEarnedMeterEnabled=true
            bootstrap.sourceOrdinaryPresentationEnabled=true
            bootstrap.sourceDirectPresentationEnabled=true
            bootstrap.sourceFreshOrdinaryPresentationEnabled=true
            bootstrap.sourceRestoredOrdinaryPresentationEnabled=true
            bootstrap.sourceInitialRegularResumeEnabled=true
            bootstrap.sourceInitialWildResumeEnabled=true
            bootstrap.sourceMagnetPresentationEnabled=true
            bootstrap.sourceOrdinaryEndgamePresentationEnabled=true
            bootstrap.sourceTntPresentationEnabled=true
        }
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction)
        XCTAssertTrue(scene.sourceInitialStartupReady);XCTAssertTrue(game.sourceScope?.service === service)
        XCTAssertEqual(game.sourceSmallStackPresentationEnabled,complete)
        for holder in construction.recipe?.holders ?? [] {XCTAssertTrue(scene.sourceNativeTileNode(holder.tileID) === construction.nodes[holder.tileID])}
        XCTAssertTrue(scene.sourceBoardEntryAdmissionOpen)
        XCTAssertNotNil(game.engine.pendingSourceTutorialDemoActivation)
        XCTAssertFalse(game.view.subviews.contains{$0 is NativeTutorialOverlay})
        XCTAssertTrue(scene.sourceTutorialHUDAlphas.allSatisfy{abs($0-1)<1e-6})
        XCTAssertFalse(scene.sourceTutorialHUDActive)
        let initialTiles=game.engine.state.tiles
        let deadline=Date().addingTimeInterval(10);var wall=0.0
        while scene.completedSourceBoardEntry==nil && Date()<deadline {
            wall+=16;service.deliver(wallMilliseconds:wall)
            try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertEqual(scene.completedSourceBoardEntry?.outcome,.normal)
        if construction.pendingFaceCount==0 {
            XCTAssertTrue(scene.sourceTutorialPreparationReady,"ready board completion must not start an activation delay")
            let firstSheet=try XCTUnwrap(game.view.subviews.first{$0 is NativeTutorialOverlay} as? NativeTutorialOverlay)
            XCTAssertTrue(firstSheet.sourceIntroOwner?.sheetStarted==true,"Drag to stack entry starts at the ready board completion")
        }
        while !scene.sourceTutorialPreparationReady && Date()<deadline {
            wall+=16;service.deliver(wallMilliseconds:wall)
            try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertTrue(scene.sourceTutorialPreparationReady)
        let actualGeometry=try XCTUnwrap(scene.boardGeometry)
        for tile in game.engine.state.tiles {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
            let face=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture})
            let width=abs(face.frame.width*node.visual.xScale*node.xScale)
            XCTAssertLessThanOrEqual(width,actualGeometry.tileSize*1.05,"oversized actual face \(tile.id): faceFrame=\(face.frame) root=\(node.xScale), visual=\(node.visual.xScale), expected=\(actualGeometry.tileSize)")
        }
        if let texture=scene.view?.texture(from:scene) {
            let shot=XCTAttachment(image:UIImage(cgImage:texture.cgImage()));shot.name="actual-native-tutorial-board-scale";shot.lifetime = .keepAlways;add(shot)
        }
        XCTAssertTrue(scene.sourceTutorialHUDActive)
        if complete {for _ in 0..<40 {wall+=16;service.deliver(wallMilliseconds:wall)}}
        try await Task.sleep(for:.milliseconds(150))
        if !complete {XCTAssertTrue(scene.sourceTutorialHUDAlphas.allSatisfy{abs($0-0.2)<1e-6})}
        scene.synchronize()
        if !complete {XCTAssertTrue(scene.sourceTutorialHUDAlphas.allSatisfy{abs($0-0.2)<1e-6})}
        XCTAssertNil(game.engine.pendingSourceTutorialDemoActivation)
        var meterResources:NativeWildMeterDropResources?
        defer{meterResources?.dispose()}
        if (meter || fourth) && !complete {
            let resources=NativeWildMeterDropResources(root:NativeTestResources.root)
            meterResources=resources
            let ready=expectation(description:"actual original meter resource preload")
            var loadFailure:NativeWildMeterDropResources.Failure?
            resources.prepare(arcade:game.engine.state.mode == .arcade,
                capture:.init(id:"actual-bootstrap-meter-preparation",generation:game.engine.state.generation,epoch:1)) {result in
                if case .failure(let failure)=result{loadFailure=failure};ready.fulfill()
            }
            await fulfillment(of:[ready],timeout:8)
            XCTAssertNil(loadFailure);XCTAssertNotNil(resources.sourceSynchronousPreparationReceipt())
            XCTAssertTrue(game.engine.sourceMathRandom === context.mathRandom)
            // Explicit fixture admission of the actual earned-meter creator;
            // whole startup flags and uncovered creators remain unadmitted.
            game.engine.sourceStarOrbitCountAtPresentationEnabled=true
            XCTAssertTrue(bootstrap.configureSourceMeterPresentation(gameplay:game,resources:resources))
            XCTAssertTrue(game.engine.stagedMeterOpen);XCTAssertTrue(game.engine.stagedMeterDrops)
            XCTAssertTrue(scene.sourceMicrotaskBoundariesInstalled)
            XCTAssertFalse(bootstrap.configureSourceMeterPresentation(gameplay:game,resources:resources),"duplicate cannot replace current owners")
            XCTAssertTrue(scene.sourcePlainStarHalosConfigured(scope:try XCTUnwrap(game.sourceScope)),"duplicate must retain preceding successful Star owner")
            if meter {
            let scope=try XCTUnwrap(game.sourceScope);scope.dispose()
            XCTAssertFalse(bootstrap.configureSourceMeterPresentation(gameplay:game,resources:resources))
            XCTAssertEqual(service.sourceTickerListenerCount,0)
            return
            }
        }
        if failure {
            let file=directory.appendingPathComponent("state-v1.json"),bytes=try Data(contentsOf:file)
            let callback=try XCTUnwrap(scene.onSourcePresentationFailure),generation=game.engine.state.generation
            callback("qa-stale-transaction",generation+1)
            XCTAssertNil(game.sourcePresentationFailureGeneration);XCTAssertEqual(try Data(contentsOf:file),bytes)
            callback("qa-captured-transaction",generation)
            XCTAssertEqual(game.sourcePresentationFailureGeneration,generation)
            XCTAssertFalse(scene.sourceAnimationBindingAdmissionOpen)
            try await waitUntil{!app.children.contains{$0 === game}}
            XCTAssertEqual(try Data(contentsOf:file),bytes)
            callback("qa-duplicate-transaction",generation)
            XCTAssertEqual(try Data(contentsOf:file),bytes)
            XCTAssertFalse(app.children.contains{$0 === game})
            return
        }
        XCTAssertEqual(game.engine.state.tutorial?.guidedPair.count,2)
        XCTAssertEqual(game.engine.state.tiles.map(\.value),initialTiles.map(\.value))
        let overlay=try XCTUnwrap(game.view.subviews.first{$0 is NativeTutorialOverlay} as? NativeTutorialOverlay)
        let intro=try XCTUnwrap(overlay.sourceIntroOwner)
        if complete {
            XCTAssertEqual(overlay.sourceSheetTranslation,0)
        } else {
            XCTAssertTrue(intro.sheetStarted,"Native initial sheet starts on its rendered handoff")
            XCTAssertGreaterThanOrEqual(overlay.sourceSheetTranslation,-overlay.sourceSheetHeight*0.15)
            XCTAssertLessThanOrEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight)
        }
        XCTAssertFalse(overlay.sourcePointerVisible)
        service.setSourceForeground(false)
        try await Task.sleep(for:.milliseconds(1300))
        XCTAssertTrue(intro.sheetStarted);XCTAssertTrue(intro.pointerStarted)
        XCTAssertTrue(overlay.sourcePointerVisible)
        XCTAssertFalse(overlay.sourceHintUsesCoreAnimation)
        service.setSourceForeground(true)
        for _ in 0..<60 {wall+=16;service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
        XCTAssertEqual(overlay.sourcePointerAlpha,1,accuracy:1e-6)
        let hint=overlay.sourceHintTransform
        for _ in 0..<30 {wall+=16;service.deliver(wallMilliseconds:wall)}
        XCTAssertNotEqual(overlay.sourceHintTransform,hint)
        overlay.hidePointer();XCTAssertFalse(overlay.sourcePointerVisible)
        let stopped=overlay.sourceHintTransform
        for _ in 0..<30 {wall+=16;service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(overlay.sourceHintTransform,stopped)
        overlay.restorePointer();XCTAssertTrue(overlay.sourcePointerVisible)
        XCTAssertFalse(overlay.sourceHintUsesCoreAnimation)

        if monitored {
            XCTAssertTrue(scene.sourceTutorialFirstStepPresentationActive)
            let pair=try XCTUnwrap(game.engine.state.tutorial?.guidedPair),oneID=try XCTUnwrap(game.engine.state.tutorial?.oneTileID)
            let source=try XCTUnwrap(scene.sourceNativeTileNode(pair[0])),target=try XCTUnwrap(scene.sourceNativeTileNode(pair[1]))
            func point(_ node:NativeDiceNode)->CGPoint{scene.convert(node.position,from:try! XCTUnwrap(node.parent))}
            XCTAssertTrue(scene.beginDrag(at:point(source)))
            let destination=point(target)
            scene.moveDrag(to:destination,now:1)
            for _ in 0..<10{wall+=16;service.deliver(wallMilliseconds:wall)}
            let moved=try XCTUnwrap(scene.finishDrag(at:destination,now:1.2));XCTAssertTrue(moved.accepted)
            XCTAssertEqual(game.engine.state.tutorial?.step,.mergeSix)
            XCTAssertEqual(game.engine.state.tutorial?.specialBarSuccessfulActions,1)
            XCTAssertFalse(overlay.specialBarVisible,"one successful guided action cannot show Special Bar")
            let receipt=try XCTUnwrap(game.engine.pendingSourceTutorialPresentationBarrier)
            XCTAssertEqual(receipt.mergedID,target.tileID);XCTAssertTrue(scene.sourceTutorialFirstStepPresentationActive)
            XCTAssertFalse(game.engine.beginDrag(tileID:oneID));XCTAssertFalse(scene.sourceTutorialSecondPreparationReady)
            _=service.setSourceGlobalPaused(true)
            try await Task.sleep(for:.milliseconds(180))
            for _ in 0..<60{wall+=16;service.deliver(wallMilliseconds:wall)}
            XCTAssertNotNil(game.engine.pendingSourceTutorialPresentationBarrier)
            XCTAssertFalse(scene.sourceTutorialSecondPreparationReady)
            if retireDuringExit {
                // This bounded Bootstrap fixture deliberately retains the
                // default Native contact/debit owner. Drain its genuine debit
                // before auditing Source Scope retirement; tutorial exit stays
                // globally paused throughout, and no completion is fabricated.
                let debitDeadline=Date().addingTimeInterval(2)
                while game.engine.state.moves==50 && Date()<debitDeadline{try await Task.sleep(for:.milliseconds(20))}
                XCTAssertEqual(game.engine.state.moves,49)
                XCTAssertNotNil(game.engine.pendingSourceTutorialPresentationBarrier)
                let snapshot=game.engine.state,draws=count
                game.sourceScope?.dispose()
                XCTAssertNil(game.engine.pendingSourceTutorialPresentationBarrier)
                XCTAssertNil(overlay.sourceIntroOwner);XCTAssertFalse(scene.sourceTutorialFirstStepPresentationActive)
                XCTAssertFalse(scene.sourceTutorialSecondPreparationReady)
                _=service.setSourceGlobalPaused(false)
                for _ in 0..<100{wall+=16;service.deliver(wallMilliseconds:wall)}
                try await Task.sleep(for:.milliseconds(220))
                XCTAssertEqual(game.engine.state,snapshot);XCTAssertEqual(count,draws)
                return
            }
            _=service.setSourceGlobalPaused(false)
            for _ in 0..<45{wall+=16;service.deliver(wallMilliseconds:wall)}
            // Only wall90 after the two real finite roots may prepare step two.
            service.setSourceForeground(false)
            try await Task.sleep(for:.milliseconds(130))
            XCTAssertTrue(scene.sourceTutorialSecondPreparationReady)
            XCTAssertFalse(scene.sourceTutorialFirstStepPresentationActive)
            XCTAssertNil(game.engine.pendingSourceTutorialPresentationBarrier)
            XCTAssertTrue(game.engine.beginDrag(tileID:oneID));game.engine.cancelDrag()
            XCTAssertTrue(overlay.sourceIntroOwner === intro)
            service.setSourceForeground(true)
            for _ in 0..<90{wall+=16;service.deliver(wallMilliseconds:wall)}
            XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
            XCTAssertFalse(overlay.sourceHintUsesCoreAnimation)
            if third {
                XCTAssertTrue(scene.sourceTutorialSecondPresentationActive)
                let five=try XCTUnwrap(scene.sourceNativeTileNode(receipt.mergedID)),one=try XCTUnwrap(scene.sourceNativeTileNode(oneID))
                XCTAssertTrue(scene.beginDrag(at:point(one)));let secondDestination=point(five)
                scene.moveDrag(to:secondDestination,now:3)
                for _ in 0..<10{wall+=16;service.deliver(wallMilliseconds:wall)}
                XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:secondDestination,now:3.2)).accepted)
                // The existing Native Six transaction commits later than its
                // accepted gesture; wait for that genuine producer while Source
                // exit roots stay paused, rather than asserting at acceptance.
                if complete {
                    let deadline=Date().addingTimeInterval(12)
                    while !scene.sourceTutorialThirdPresentationActive && Date()<deadline {
                        wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
                    }
                    XCTAssertNil(game.sourcePresentationFailure, String(describing:game.sourcePresentationFailure))
                    XCTAssertEqual(game.engine.state.tutorial?.step,.freePlay)
                } else {
                _=service.setSourceGlobalPaused(true)
                let sixDeadline=Date().addingTimeInterval(6)
                while game.engine.state.tutorial?.step != .freePlay && Date()<sixDeadline {
                    wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
                }
                XCTAssertEqual(game.engine.state.tutorial?.step,.freePlay)
                let second=try XCTUnwrap(game.engine.pendingSourceTutorialPresentationBarrier);XCTAssertEqual(second.phase,.secondMerge)
                XCTAssertTrue(scene.sourceTutorialSecondPresentationActive);XCTAssertFalse(scene.sourceTutorialThirdPresentationActive)
                _=service.setSourceGlobalPaused(true);try await Task.sleep(for:.milliseconds(100))
                for _ in 0..<60{wall+=16;service.deliver(wallMilliseconds:wall)}
                XCTAssertEqual(game.engine.pendingSourceTutorialPresentationBarrier,second)
                _=service.setSourceGlobalPaused(false)
                let thirdDeadline=Date().addingTimeInterval(5)
                while !scene.sourceTutorialThirdPresentationActive && Date()<thirdDeadline {
                    wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
                }
                }
                XCTAssertTrue(scene.sourceTutorialThirdPresentationActive);XCTAssertFalse(scene.sourceTutorialSecondPresentationActive)
                XCTAssertNil(game.engine.pendingSourceTutorialPresentationBarrier)
                XCTAssertTrue(overlay.sourceIntroOwner === intro)
                for _ in 0..<110{wall+=16;service.deliver(wallMilliseconds:wall)}
                let specialButton=try XCTUnwrap(overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UIButton}.first)
                let specialFocusDeadline=Date().addingTimeInterval(5)
                while (!overlay.specialBarVisible || scene.tutorialSpecialBarFocusValue<1 || abs(overlay.sourceSheetTranslation)>1e-6 || !specialButton.isEnabled) && Date()<specialFocusDeadline {
                    wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(40))
                }
                XCTAssertEqual(scene.tutorialSpecialBarFocusValue,1,accuracy:1e-6)
                XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
                XCTAssertEqual(game.engine.state.tutorial?.specialBarSuccessfulActions,2)
                XCTAssertTrue(overlay.specialBarVisible)
                XCTAssertLessThan(game.engine.state.wildMeter,1,"Special Bar precedes a fully charged meter")
                let button=specialButton
                XCTAssertNil(game.engine.sourceTutorialWildReservation)
                    let liveNode=try XCTUnwrap(scene.sourceNativeTileNode(try XCTUnwrap(game.engine.state.activeTiles.first).id))
                    func effectiveAlpha(_ node:SKNode)->CGFloat {var alpha=node.alpha;var parent=node.parent;while let ancestor=parent{alpha *= ancestor.alpha;parent=ancestor.parent};return alpha}
                    XCTAssertEqual(effectiveAlpha(liveNode),min(liveNode.alpha,0.2),accuracy:1e-6)
                    XCTAssertLessThanOrEqual(effectiveAlpha(liveNode),0.2+1e-6)
                    scene.synchronize()
                    XCTAssertLessThanOrEqual(effectiveAlpha(liveNode),0.2+1e-6,"focus survives canonical synchronize")
                    let focusedDice=game.engine.state.activeTiles.compactMap{scene.sourceNativeTileNode($0.id)}
                    for node in focusedDice{node.run(.fadeAlpha(to:1,duration:0),withKey:"qa.late-alpha-writer")}
                    // Mounted SpriteKit frames evaluate real SKActions before
                    // the renderer handoff reapplies the tutorial's dim paint.
                    for _ in 0..<4 {
                        wall+=16;service.deliver(wallMilliseconds:wall)
                        try await Task.sleep(for:.milliseconds(40))
                        for node in focusedDice {
                            XCTAssertLessThanOrEqual(effectiveAlpha(node),0.2+1e-6,"late physical alpha writers cannot brighten another die")
                        }
                    }
                    if let loader=scene.childNode(withName:"//wildLoader"){
                        var path:[String]=[];var cursor:SKNode?=loader
                        while let node=cursor{path.append("\(node.name ?? String(describing:type(of:node))):\(node.alpha)");cursor=node.parent}
                        XCTAssertEqual(effectiveAlpha(loader),1,accuracy:1e-6,"meter ancestry: \(path.joined(separator:" -> "))")
                    }
                    var meterBubbles:[SKNode]=[]
                    scene.enumerateChildNodes(withName:"//wild-meter-smoke"){node,_ in meterBubbles.append(node)}
                    XCTAssertFalse(meterBubbles.isEmpty,"tutorial focus emits original meter bubbles")
                    XCTAssertTrue(meterBubbles.contains{$0.alpha>0.2},"meter bubbles retain original opacity animation above dimmed board")
                    let labels=overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UILabel}
                    let body=try XCTUnwrap(labels.first{$0.text=="Stack and merge dice to fill the bar and earn special dice."})
                    XCTAssertGreaterThanOrEqual(body.bounds.height,ceil(body.sizeThatFits(CGSize(width:body.bounds.width,height:.greatestFiniteMagnitude)).height))
                    XCTAssertLessThanOrEqual(overlay.convert(button.bounds,to:game.view).maxY,game.view.bounds.maxY)
                    let shot=UIGraphicsImageRenderer(bounds:game.view.bounds).image{_ in game.view.drawHierarchy(in:game.view.bounds,afterScreenUpdates:true)}
                    let attachment=XCTAttachment(image:shot);attachment.name="actual-native-special-bar";attachment.lifetime = .keepAlways;add(attachment)
                    try shot.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-special-bar-mounted.png"))
                    XCTAssertNil(overlay.hitTest(CGPoint(x:10,y:10),with:nil),"board touches reach the real Scene interaction admission")
                    let playable=try XCTUnwrap(game.engine.state.activeTiles.first{$0.isPlayable})
                    XCTAssertFalse(game.engine.beginDrag(tileID:playable.id),"sheet locks real engine admission")
                    if specialInteraction {
                        let pickup=try XCTUnwrap(scene.sourceNativeTileNode(playable.id))
                        game.engine.setInputLock("qa.foreign-modal",active:true)
                        XCTAssertFalse(scene.beginDrag(at:point(pickup)),"foreign lock cannot acknowledge the tutorial")
                        XCTAssertEqual(game.engine.state.tutorial?.specialBarAcknowledged,false)
                        XCTAssertTrue(overlay.specialBarVisible)
                        game.engine.setInputLock("qa.foreign-modal",active:false)
                        XCTAssertTrue(scene.beginDrag(at:point(pickup)),"same physical down dismisses modal then picks up")
                        XCTAssertTrue(game.engine.isDragging)
                        XCTAssertEqual(game.engine.state.tutorial?.specialBarAcknowledged,true)
                        XCTAssertTrue(overlay.specialBarVisible,"sheet exits continuously while drag owns its real node")
                    } else {button.sendActions(for:.touchUpInside);button.sendActions(for:.touchUpInside)}
                    for _ in 0..<4{wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(10))}
                    XCTAssertGreaterThan(scene.tutorialSpecialBarFocusValue,0,"focus exit is continuous")
                    XCTAssertLessThan(scene.tutorialSpecialBarFocusValue,1,"exit begins before final restore")
                    XCTAssertTrue(overlay.specialBarVisible)
                    if specialInteraction{XCTAssertTrue(game.engine.isDragging)}
                    for _ in 0..<51{wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(10))}
                    XCTAssertEqual(scene.tutorialSpecialBarFocusValue,0,accuracy:1e-6)
                    scene.didFinishUpdate()
                    let restoredMeter=try XCTUnwrap(scene.childNode(withName:"//wildLoader"))
                    XCTAssertEqual(effectiveAlpha(restoredMeter),1,accuracy:1e-6,"Continue keeps the meter fully opaque while tutorial controls stay locked")
                    XCTAssertTrue(game.engine.state.tutorial?.shouldLockHUD == true)
                    XCTAssertTrue(try XCTUnwrap(scene.childNode(withName:"//native-game-round-indicator")).isHidden,"bottom HUD stays absent through tutorial")
                    XCTAssertFalse(overlay.specialBarVisible)
                    XCTAssertEqual(liveNode.parent?.alpha ?? 1,1,accuracy:1e-6)
                    XCTAssertEqual(game.engine.state.tutorial?.specialBarAcknowledged,true)
                    if specialInteraction{scene.cancelDrag()}
                XCTAssertEqual(game.engine.state.tutorial?.waitingForWild,false)
                XCTAssertNil(game.engine.sourceTutorialWildReservation)
                service.setSourceForeground(false)
                try await Task.sleep(for:.milliseconds(320))
                XCTAssertTrue(overlay.sourceFreeHintActive);XCTAssertTrue(overlay.sourcePointerVisible)
                XCTAssertEqual(overlay.sourcePointerAlpha,1,accuracy:1e-6)
                XCTAssertFalse(overlay.sourceHintUsesCoreAnimation)
                service.setSourceForeground(true)
                for _ in 0..<15{wall+=16;service.deliver(wallMilliseconds:wall)}
                let thirdHintPose=overlay.sourceHintTransform
                for _ in 0..<35{wall+=16;service.deliver(wallMilliseconds:wall)}
                XCTAssertNotEqual(overlay.sourceHintTransform,thirdHintPose)
                if let dismiss {
                    XCTAssertEqual(overlay.sourceCTAState,.idle)
                    let button=try XCTUnwrap(overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UIButton}.first)
                    let hit=overlay.sourceCTAHitFrame
                    _=service.setSourceGlobalPaused(true)
                    if dismiss=="drag" {
                        let tile=try XCTUnwrap(game.engine.state.activeTiles.first{!$0.locked && $0.value>0 && !$0.isWild})
                        let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id));XCTAssertTrue(scene.beginDrag(at:point(node)))
                    }else{button.sendActions(for:.touchDown);button.sendActions(for:.touchUpInside)}
                    XCTAssertEqual(overlay.sourceCTAState,.exiting);XCTAssertFalse(button.isEnabled)
                    XCTAssertEqual(overlay.sourceCTAHitFrame,hit);XCTAssertEqual(button.transform,.identity)
                    XCTAssertTrue(overlay.sourceFreeHintActive);XCTAssertEqual(game.engine.state.tutorial?.waitingForWild,false)
                    XCTAssertTrue(scene.sourceTutorialMeterSmokeFrozen);XCTAssertNil(game.engine.sourceTutorialWildReservation)
                    let before=game.engine.state,draws=count,restoreKeys=scene.sourceTutorialCapturedLiveNodes.count
                    for _ in 0..<40{wall+=16;service.deliver(wallMilliseconds:wall)}
                    try await Task.sleep(for:.milliseconds(80))
                    XCTAssertEqual(game.engine.state.tutorial?.waitingForWild,false);XCTAssertEqual(count,draws)
                    if dismiss=="retire" {
                        game.sourceScope?.dispose();XCTAssertNil(overlay.sourceIntroOwner);XCTAssertNil(overlay.sourceCTAState)
                        _=service.setSourceGlobalPaused(false)
                        for _ in 0..<80{wall+=16;service.deliver(wallMilliseconds:wall)}
                        try await Task.sleep(for:.milliseconds(230))
                        XCTAssertEqual(game.engine.state,before);XCTAssertEqual(count,draws);XCTAssertNil(game.engine.sourceTutorialWildReservation)
                        XCTAssertFalse(scene.sourceTutorialIntroTimeouts.pendingReceipts.contains{$0.sourceID=="tutorial-meter-smoke-resume180"})
                        return
                    }
                    _=service.setSourceGlobalPaused(false)
                    var delivered=0
                    while game.engine.state.tutorial?.waitingForWild == false && delivered<60 {
                        delivered+=1;wall+=16;service.deliver(wallMilliseconds:wall)
                    }
                    XCTAssertEqual(game.engine.state.tutorial?.waitingForWild,true)
                    XCTAssertEqual(game.engine.state.tutorial?.specialBarSuccessfulActions,2)
                    XCTAssertNotNil(game.engine.sourceTutorialWildReservation)
                    XCTAssertEqual(count,draws+restoreKeys,"one original shuffle-key draw per actual surviving node, no delay/HUD draw for immediate restore")
                    XCTAssertEqual(overlay.sourceCTAState,.hidden);XCTAssertFalse(overlay.sourceFreeHintActive)
                    XCTAssertFalse(scene.sourceTutorialMeterSmokeFrozen)
                    XCTAssertTrue(scene.sourceTutorialIntroTimeouts.pendingReceipts.contains{$0.sourceID=="tutorial-meter-smoke-resume180"})
                    XCTAssertTrue(overlay.sourceIntroOwner === intro)
                    XCTAssertLessThan(overlay.sourceSheetTranslation,overlay.sourceSheetHeight)
                    for node in scene.sourceTutorialCapturedLiveNodes {
                        XCTAssertEqual(node.alpha,node.sourceLocked ? 0.2:1,accuracy:1e-6)
                        XCTAssertEqual(node.sourceEventMode,!node.sourceLocked && node.sourceValue>0 ? "static":"none")
                    }
                    for _ in 0..<50{wall+=16;service.deliver(wallMilliseconds:wall)}
                    XCTAssertEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight,accuracy:1e-6)
                    XCTAssertEqual(overlay.sourceDimAlpha,0,accuracy:1e-6);XCTAssertFalse(overlay.sourcePointerVisible)
                    XCTAssertEqual(count,draws+restoreKeys)
                    service.setSourceForeground(false);try await Task.sleep(for:.milliseconds(230))
                    XCTAssertFalse(scene.sourceTutorialIntroTimeouts.pendingReceipts.contains{$0.sourceID=="tutorial-meter-smoke-resume180"})
                    XCTAssertFalse(overlay.sourceFreeHintActive)
                    service.setSourceForeground(true)
                    if dismiss=="drag"{scene.cancelDrag()}
                    if !fourth {XCTAssertNotNil(game.engine.sourceTutorialWildReservation)}
                    if fourth {
                        let originalDropStart=scene.onTutorialSpecialDropStarted
                        var actualDropStarts=0
                        scene.onTutorialSpecialDropStarted={wild in
                            actualDropStarts+=1
                            XCTAssertTrue(scene.sourceTutorialWildIsDropping(wild))
                            originalDropStart?(wild)
                            XCTAssertFalse(scene.sourceTutorialIntroTimeouts.pendingReceipts.contains{$0.sourceID=="tutorial-fourth-sheet900"})
                            XCTAssertTrue(overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UILabel}.contains{$0.text=="Special dice"},"Special Dice copy mounts at genuine fall admission")
                        }
                        let failureCallback=scene.onSourcePresentationFailure
                        scene.onSourcePresentationFailure={reason,generation in
                            XCTFail("fourth actual failure \(reason), generation=\(generation)")
                            failureCallback?(reason,generation)
                        }
                        // The Scene's genuine level-end caller admits the actual
                        // earned meter queue; it creates and places the Wild.
                        for turn in 0..<30 where game.engine.state.wildMeter < 1 && !game.engine.sourceMeterSpawnInProgress && game.engine.state.wildSpawnCount==0 && game.engine.sourceTutorialFourthPreparation==nil {
                            let tiles=game.engine.state.activeTiles
                            var moved=false
                            for sourceTile in tiles where !moved {
                                for targetTile in tiles where !moved && targetTile.id != sourceTile.id && NativeGameplayResolver.canDrop(sourceTile,onto:targetTile) && sourceTile.value+targetTile.value<=6 {
                                    guard let sourceNode=scene.sourceNativeTileNode(sourceTile.id),let targetNode=scene.sourceNativeTileNode(targetTile.id),scene.beginDrag(at:point(sourceNode)) else{continue}
                                    let destination=point(targetNode)
                                    scene.moveDrag(to:destination,now:Double(turn+10))
                                    moved=scene.finishDrag(at:destination,now:Double(turn+10)+0.2)?.accepted==true
                                }
                            }
                            XCTAssertTrue(moved,"actual free-play move must fill tutorial meter")
                            if !moved{break}
                            for _ in 0..<90 {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                        }
                        tasks.inputTask{scene.evaluate()}
                        let fourthDeadline=Date().addingTimeInterval(12)
                        while game.engine.sourceTutorialFourthPreparation==nil && Date()<fourthDeadline {
                            wall+=16;service.deliver(wallMilliseconds:wall)
                            try await Task.sleep(for:.milliseconds(10))
                        }
                        let receipt=try XCTUnwrap(game.engine.sourceTutorialFourthPreparation)
                        XCTAssertEqual(actualDropStarts,1)
                        let wild=try XCTUnwrap(scene.sourceNativeTileNode(receipt.wildID))
                        XCTAssertTrue(wild.sourceOpenedWildConstructorCurrent)
                        XCTAssertEqual(wild.sourceLiveStarHaloCount,0,"tutorial Star has no orbiting dice")
                        while wild.sourcePlainStarArtworkSprite==nil && Date()<fourthDeadline {
                            wall+=16;service.deliver(wallMilliseconds:wall)
                            try await Task.sleep(for:.milliseconds(10))
                        }
                        let sheet=try XCTUnwrap(wild.sourcePlainStarArtworkSprite)
                        XCTAssertTrue(overlay.sourceIntroOwner === intro)
                        XCTAssertNil(game.sourcePresentationFailureGeneration)
                        if fourthComplete {
                            while game.engine.sourceMeterHandoffInProgress && Date()<fourthDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                            let target=try XCTUnwrap(scene.sourceNativeTileNode(receipt.targetID))
                            XCTAssertEqual(game.engine.state.tiles.first{$0.id==receipt.targetID}?.sourceWildStateCleared,target.sourceWildStateCleared,"tutorial preparation must retain matching logical and physical ordinary flags")
                            let destination=point(reverseFourth ? wild:target)
                            XCTAssertTrue(scene.beginDrag(at:point(reverseFourth ? target:wild)))
                            scene.moveDrag(to:destination,now:50)
                            for _ in 0..<10{wall+=16;service.deliver(wallMilliseconds:wall)}
                            let selector=try XCTUnwrap(scene.childNode(withName:"//native-stack-hover"))
                            for tile in game.engine.state.activeTiles {
                                let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
                                if node.zPosition >= 12001 {
                                    XCTAssertLessThan(selector.zPosition,node.zPosition,"Wild/Special and held dice stay above the selector")
                                } else {
                                    XCTAssertGreaterThan(selector.zPosition,node.zPosition,"ordinary target faces must not occlude the inset stroke")
                                }
                            }
                            let merged=try XCTUnwrap(scene.finishDrag(at:destination,now:50.2))
                            XCTAssertTrue(merged.accepted)
                            XCTAssertEqual(game.engine.state.tutorial?.active,true,"actual fourth exit owns guide completion after merge")
                            let completionDeadline=Date().addingTimeInterval(10)
                            while game.engine.state.tutorial?.active==true && Date()<completionDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                                for name in ["native-game-close","native-game-help"] {
                                    let control=try XCTUnwrap(scene.childNode(withName:"//"+name))
                                    XCTAssertLessThanOrEqual(control.alpha,0.200001,"HUD must stay dim through fourth sheet exit as well as after guide completion")
                                }
                            }
                            XCTAssertEqual(game.engine.state.tutorial?.active,false)
                            XCTAssertEqual(game.engine.state.tutorial?.guideCompleted,true)
                            XCTAssertEqual(game.engine.state.tutorial?.completionAssist,true)
                            XCTAssertEqual(game.engine.state.tutorial?.shouldLockHUD,true)
                            for _ in 0..<4 {wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(40))}
                            for name in ["native-game-close","native-game-help"] {
                                let control=try XCTUnwrap(scene.childNode(withName:"//"+name))
                                XCTAssertLessThanOrEqual(control.alpha,0.200001)
                            }

                            XCTAssertNil(game.engine.sourceTutorialFourthPreparation)
                            XCTAssertNil(overlay.sourceIntroOwner)
                            XCTAssertNil(game.sourcePresentationFailureGeneration)
                            // Real lifecycle save must retain the completed guide
                            // and assist without acknowledging its later result.
                            let saveDeadline=Date().addingTimeInterval(8)
                            while (game.engine.hasUnsavableSourceGameplayState || !NativeSaveEnvelope.isCoherentRun(game.engine.state)) && Date()<saveDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                            XCTAssertFalse(game.engine.hasUnsavableSourceGameplayState)
                            XCTAssertTrue(NativeSaveEnvelope.isCoherentRun(game.engine.state))
                            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                            let persisted=try XCTUnwrap(store.load())
                            let run=try XCTUnwrap(persisted.arcadeRun)
                            XCTAssertEqual(run.tutorial?.guideCompleted,true)
                            XCTAssertEqual(run.tutorial?.active,false)
                            XCTAssertEqual(run.tutorial?.completionAssist,true)
                            XCTAssertEqual(run.generation,game.engine.state.generation)
                            XCTAssertEqual(run.moves,game.engine.state.moves)
                            XCTAssertEqual(run.score,game.engine.state.score)
                            XCTAssertFalse(persisted.progression.firstPlayTutorialComplete,"guide exit does not acknowledge the later authored result")
                            if complete {
                                var acceptedMoves=0
                                for turn in 0..<stressTurns where game.engine.state.terminal==nil && game.sourcePresentationFailure==nil {
                                    var moved=false
                                    let live=game.engine.state.activeTiles.sorted{($0.isWild ? 0:1)<($1.isWild ? 0:1)}
                                    for a in live where !moved {
                                        for b in live where !moved && a.id != b.id && NativeGameplayResolver.canDrop(a,onto:b) {
                                            guard let source=scene.sourceNativeTileNode(a.id),let target=scene.sourceNativeTileNode(b.id),scene.beginDrag(at:point(source)) else{continue}
                                            let destination=point(target);scene.moveDrag(to:destination,now:Double(100+turn))
                                            moved=scene.finishDrag(at:destination,now:Double(100+turn)+0.2)?.accepted==true
                                        }
                                    }
                                    if moved {acceptedMoves+=1}
                                    for _ in 0..<stressFrames {wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(5))}
                                    XCTAssertNil(game.sourcePresentationFailure,"turn=\(turn) minimum=\(scene.sourceMinimumCaptureDiagnostic) safety=\(scene.sourceSpawnSafetyDiagnostic) failure=\(String(describing:game.sourcePresentationFailure))")
                                    if game.sourcePresentationFailure != nil {break}
                                }
                                if stressTurns>1 {
                                    for _ in 0..<150 {wall+=16;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(5))}
                                    print("[NativeRapidStack] accepted=\(acceptedMoves) terminal=\(String(describing:game.engine.state.terminal)) physical=\(scene.sourcePhysicalBoardCaptureDiagnostic)")
                                    XCTAssertGreaterThan(acceptedMoves,3)
                                    XCTAssertNil(game.sourcePresentationFailure)
                                    XCTAssertTrue(game.engine.state.validationIssues(allowSourceDetachedGridReferences:true).isEmpty)
                                }
                                return
                            }
                            // Preserve bytes produced by the genuine guide and
                            // save owner for separate OS-process resume evidence.
                            let savedGuide=XCTAttachment(data:try Data(contentsOf:directory.appendingPathComponent("state-v1.json")),uniformTypeIdentifier:"public.json")
                            savedGuide.name="native-genuine-completed-guide-save";savedGuide.lifetime = .keepAlways;add(savedGuide)
                            let requestExit=try XCTUnwrap(scene.onExitRequest)
                            requestExit()
                            try await waitUntil{game.presentedViewController is JimiNativeEndRunModal}
                            let exitModal=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
                            exitModal.onAction?("exit")
                            let leaveDeadline=Date().addingTimeInterval(8)
                            while app.children.contains(where:{$0 === game}) && Date()<leaveDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                            XCTAssertFalse(app.children.contains{$0 === game},"actual Source exit must finish before returning Home")
                            app.navigate(.gameplay,interrupt:true)
                            let mountDeadline=Date().addingTimeInterval(8)
                            while !app.children.contains(where:{$0 is NativeGameplayViewController}) && Date()<mountDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                            let resumed=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
                            let resumedScene=try XCTUnwrap(resumed.boardScene)
                            // Immutable v9 rejects saved Arcade entry until the
                            // Tutorial Complete result has been acknowledged.
                            // Home Play must create another genuine Source demo.
                            XCTAssertTrue(resumed.sourceBoardEntryEnabled)
                            XCTAssertNotNil(resumed.sourceInitialConstruction)
                            XCTAssertTrue(resumed.sourceTutorialHUDEnabled)
                            let newEntryDeadline=Date().addingTimeInterval(12)
                            while (!resumedScene.sourceTutorialPreparationReady || resumedScene.completedSourceBoardEntry==nil) && Date()<newEntryDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                            XCTAssertEqual(resumedScene.completedSourceBoardEntry?.outcome,.normal)
                            XCTAssertNil(resumed.engine.pendingSourceTutorialDemoActivation)
                            XCTAssertEqual(resumed.engine.state.tutorial?.active,true)
                            XCTAssertEqual(resumed.engine.state.tutorial?.step,.stack)
                            XCTAssertEqual(resumed.engine.state.tutorial?.guideCompleted,false)
                            XCTAssertEqual(resumed.engine.state.tutorial?.completionAssist,false)
                            XCTAssertEqual(resumed.engine.state.moves,50);XCTAssertEqual(resumed.engine.state.score,0)
                            XCTAssertGreaterThan(resumed.engine.state.generation,run.generation)
                            XCTAssertEqual(resumed.engine.state.tiles.count,45)
                            XCTAssertEqual(resumed.engine.state.tiles.map(\.value),initialTiles.map(\.value))
                            let pickupID=try XCTUnwrap(resumed.engine.state.tutorial?.guidedPair.first)
                            let pickupNode=try XCTUnwrap(resumedScene.sourceNativeTileNode(pickupID))
                            var pickedUp=false
                            while !pickedUp && Date()<newEntryDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                                if let parent=pickupNode.parent {pickedUp=resumedScene.beginDrag(at:resumedScene.convert(pickupNode.position,from:parent))}
                            }
                            XCTAssertTrue(pickedUp,"original forced fresh guide has actual guided input")
                            resumedScene.cancelDrag()
                            XCTAssertNil(resumed.sourcePresentationFailureGeneration)
                            XCTAssertFalse(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
                            // Recreate all owners with the default Native path.
                            // Cold Home preserves its save until a new Play; that
                            // Play also obeys the original forced fresh policy.
                            let oldGeneration=resumed.engine.state.generation
                            bootstrap.dispose();context.dispose();service.dispose()
                            let coldStore=NativeSaveStore(directory:directory)
                            let beforeCold=try XCTUnwrap(coldStore.load())
                            let cold=try NativeBootstrap(root:NativeTestResources.root,store:coldStore,showStudioIntro:false)
                            defer{cold.dispose()};cold.start(in:host)
                            XCTAssertEqual(try coldStore.load(),beforeCold)
                            let coldApp=try XCTUnwrap(host.children.first as? NativeAppController)
                            coldApp.navigate(.gameplay,interrupt:true)
                            try await waitUntil{coldApp.children.contains{$0 is NativeGameplayViewController}}
                            let coldGame=try XCTUnwrap(coldApp.children.first as? NativeGameplayViewController)
                            let coldScene=try XCTUnwrap(coldGame.boardScene)
                            let coldPickupID=try XCTUnwrap(coldGame.engine.state.tutorial?.guidedPair.first)
                            try await waitUntil{coldScene.sourceNativeTileNode(coldPickupID) != nil}
                            let coldNode=try XCTUnwrap(coldScene.sourceNativeTileNode(coldPickupID))
                            try await waitUntil{
                                guard let parent=coldNode.parent else{return false}
                                return coldScene.beginDrag(at:coldScene.convert(coldNode.position,from:parent))
                            }
                            coldScene.cancelDrag()
                            XCTAssertEqual(coldGame.engine.state.tutorial?.active,true)
                            XCTAssertEqual(coldGame.engine.state.tutorial?.step,.stack)
                            XCTAssertEqual(coldGame.engine.state.tutorial?.guideCompleted,false)
                            XCTAssertEqual(coldGame.engine.state.tutorial?.completionAssist,false)
                            XCTAssertEqual(coldGame.engine.state.moves,50);XCTAssertEqual(coldGame.engine.state.score,0)
                            XCTAssertEqual(coldGame.engine.state.tiles.count,45)
                            XCTAssertGreaterThan(coldGame.engine.state.generation,oldGeneration)
                            XCTAssertFalse(coldGame.sourceTutorialHUDEnabled)
                            XCTAssertNil(coldGame.sourcePresentationFailureGeneration)
                            XCTAssertFalse(try XCTUnwrap(coldStore.load()).progression.firstPlayTutorialComplete)



                        }
                        game.sourceScope?.dispose()
                        for _ in 0..<10{wall+=16;service.deliver(wallMilliseconds:wall)}
                        XCTAssertNil(sheet.parent);XCTAssertNil(wild.sourcePlainStarArtworkSprite)
                        XCTAssertEqual(service.sourceTickerListenerCount,0)
                        return
                    }
                } else {
                    overlay.hidePointer();XCTAssertFalse(overlay.sourceFreeHintActive)
                    let stoppedHint=overlay.sourceHintTransform
                    for _ in 0..<20{wall+=16;service.deliver(wallMilliseconds:wall)}
                    XCTAssertEqual(overlay.sourceHintTransform,stoppedHint)
                }
            }
        }
        if monitored{NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)}
        let saved=try XCTUnwrap(store.load()?.arcadeRun)
        XCTAssertEqual(saved.tiles,game.engine.state.tiles)
        // Actual APP callbacks may already have arrived by this awaited test
        // task. No fabricated arrival, fixed sleep or extra face draw is used.
        if monitored{NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)}
        service.deliver(wallMilliseconds:wall+16)
        XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertEqual(game.engine.state.tiles,saved.tiles)
    }
    private func waitUntil(_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(8)
        while !predicate() {if Date()>deadline {throw NSError(domain:"SourceInitialBoardTimeout",code:1)};try await Task.sleep(nanoseconds:20_000_000)}
    }
}
