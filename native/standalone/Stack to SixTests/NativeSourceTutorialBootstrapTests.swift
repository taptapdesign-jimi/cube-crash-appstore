import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialBootstrapTests:XCTestCase {
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
    private func run(monitored:Bool,retireDuringExit:Bool,third:Bool=false,dismiss:String?=nil,failure:Bool=false,meter:Bool=false,fourth:Bool=false,fourthComplete:Bool=false)async throws {
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
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction)
        XCTAssertTrue(scene.sourceInitialStartupReady);XCTAssertTrue(game.sourceScope?.service === service)
        XCTAssertFalse(game.sourceSmallStackPresentationEnabled)
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
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertTrue(scene.sourceTutorialHUDAlphas.allSatisfy{abs($0-0.2)<1e-6})
        scene.synchronize()
        XCTAssertTrue(scene.sourceTutorialHUDAlphas.allSatisfy{abs($0-0.2)<1e-6})
        XCTAssertNil(game.engine.pendingSourceTutorialDemoActivation)
        var meterResources:NativeWildMeterDropResources?
        defer{meterResources?.dispose()}
        if meter || fourth {
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
        XCTAssertEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight)
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
                XCTAssertTrue(scene.sourceTutorialThirdPresentationActive);XCTAssertFalse(scene.sourceTutorialSecondPresentationActive)
                XCTAssertNil(game.engine.pendingSourceTutorialPresentationBarrier)
                XCTAssertTrue(overlay.sourceIntroOwner === intro)
                for _ in 0..<110{wall+=16;service.deliver(wallMilliseconds:wall)}
                XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
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
                    while game.engine.state.tutorial?.waitingForWild != true && delivered<60 {
                        delivered+=1;wall+=16;service.deliver(wallMilliseconds:wall)
                    }
                    XCTAssertEqual(game.engine.state.tutorial?.waitingForWild,true)
                    let reservation=try XCTUnwrap(game.engine.sourceTutorialWildReservation);XCTAssertEqual(reservation.generation,game.engine.state.generation)
                    XCTAssertEqual(reservation.cell,NativeTutorialRules.sourceFourthWildCell(state:game.engine.state,emptyGridCells:game.engine.sourceMeterDropExcludedCells))
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
                    if fourth {
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
                        let wild=try XCTUnwrap(scene.sourceNativeTileNode(receipt.wildID))
                        XCTAssertTrue(wild.sourceOpenedWildConstructorCurrent)
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
                            let destination=point(target)
                            XCTAssertTrue(scene.beginDrag(at:point(wild)))
                            scene.moveDrag(to:destination,now:50)
                            for _ in 0..<10{wall+=16;service.deliver(wallMilliseconds:wall)}
                            let merged=try XCTUnwrap(scene.finishDrag(at:destination,now:50.2))
                            XCTAssertTrue(merged.accepted)
                            XCTAssertEqual(game.engine.state.tutorial?.active,true,"actual fourth exit owns guide completion after merge")
                            let completionDeadline=Date().addingTimeInterval(10)
                            while game.engine.state.tutorial?.active==true && Date()<completionDeadline {
                                wall+=16;service.deliver(wallMilliseconds:wall)
                                try await Task.sleep(for:.milliseconds(10))
                            }
                            XCTAssertEqual(game.engine.state.tutorial?.active,false)
                            XCTAssertEqual(game.engine.state.tutorial?.guideCompleted,true)
                            XCTAssertEqual(game.engine.state.tutorial?.completionAssist,true)
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
