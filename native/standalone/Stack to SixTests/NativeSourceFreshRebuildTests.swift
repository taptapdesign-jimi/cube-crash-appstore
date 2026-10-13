import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceFreshRebuildTests:XCTestCase {
    private func wait(_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(35)
        while !predicate(){guard Date()<deadline else{XCTFail("Actual fresh rebuild boundary timed out");throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
    }
    private func button(_ root:UIView,id:String)->UIButton? {
        if let value=root as? UIButton,value.accessibilityIdentifier==id{return value}
        return root.subviews.lazy.compactMap{self.button($0,id:id)}.first
    }
    func testActualArcadeRestartBorrowsPreparedFoundationAndStartsFreshRoundOne()async throws {
        try await exerciseRestart(board:nil)
    }
    func testActualJourneyRestartBorrowsPreparedFoundationAndKeepsSelectedBoard()async throws {
        try await exerciseRestart(board:21)
    }
    func testActualForestExitRestartSkipsAnnouncementAndKeepsSelectedUnit()async throws {
        try await exerciseRestart(board:1)
    }
    func testActualBeachExitRestartSkipsAnnouncementAndKeepsSelectedUnit()async throws {
        try await exerciseRestart(board:11)
    }
    func testExitRestartAnnouncementPolicyCoversEveryAuthoredWorldAndUnitWhileResultIsUnchanged()throws {
        let layouts=try NativeWorldLayouts()
        var progression=NativeProgressionState();progression.firstPlayTutorialComplete=true
        progression.completedJourneyBoards=Set(1...30)
        var boards:[Int]=[]
        for world in 1...3 {
            let raw=try layouts.snapshot(world:world,width:390,height:844,generation:1,progression:progression)
            let snapshot=try XCTUnwrap(JimiNativeWorldSnapshot(raw))
            XCTAssertEqual(snapshot.units.count,10)
            for unit in snapshot.units {
                boards.append(unit.boardID)
                XCTAssertTrue(NativeGameplayRestartOrigin.exitMenu.skipsBoardAnnouncement,"World \(world), Unit \(unit.boardID)")
                XCTAssertTrue(NativeGameplayRestartOrigin.failPlayAgain.skipsBoardAnnouncement,"Fail Play Again: World \(world), Unit \(unit.boardID)")
                XCTAssertTrue(NativeGameplayRestartOrigin.result.skipsBoardAnnouncement,"Clean Play Again must skip its announcement")
            }
        }
        XCTAssertEqual(boards,Array(1...30))
    }
    private func containsAnnouncement(_ gameplay:NativeGameplayViewController)->Bool {
        func arcadeCue(_ view:UIView)->Bool {
            view is NativeArcadeRoundPresentation || view.subviews.contains(where:arcadeCue)
        }
        return gameplay.children.contains{$0 is NativeThemedBoardTransitionController} || arcadeCue(gameplay.view)
    }
    func testActualFlowerReplacementDiceReturnToFullSize()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"flower")
    }
    func testActualBarrelReplacementDiceReturnToFullSize()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"barell")
    }
    func testActualBarrelMeterChargeCrossingKeepsReplacementInput()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"barell",meter:0.95)
    }
    func testActualBarrelMeterReusesLockedHolderAndKeepsReplacementInput()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"barell",meter:0.95,reuseMeterHolder:true)
    }
    func testActualFlowerMeterChargeCrossingKeepsReplacementInput()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"flower",meter:0.95)
    }
    func testActualBeachBallMeterChargeCrossingKeepsReplacementInput()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"beach-ball",meter:0.95)
    }
    func testActualBeachBallReplacementDiceReturnToFullSize()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"beach-ball")
    }
    private func exerciseAuthoredTntReplacementSize(variant:String,meter:Double=0,reuseMeterHolder:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-flower-size-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        var tiles:[NativeTile]=[.init(id:"flower",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:variant),.init(id:"destination",cell:.init(column:1,row:0),value:2)]+(1...6).map{.init(id:"target-\($0)",cell:.init(column:$0%5,row:1+$0/5),value:1+$0%5)}
        if reuseMeterHolder {tiles.append(.init(id:"meter-holder",cell:.init(column:4,row:0),value:0,locked:true,alpha:0.25))}
        seed.arcadeRun = .init(tiles:tiles,mode:.arcade,board:3,stage:3,generation:9,moves:37,score:123)
        seed.arcadeRun?.wildMeter=meter
        seed.arcadeRunSavedAt=Date().timeIntervalSince1970;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let gameplay=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(gameplay.boardScene)
        try await wait{!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.beforeSourceGameplayAdmission==nil}
        let a=try XCTUnwrap(scene.sourceNativeTileNode("flower")),b=try XCTUnwrap(scene.sourceNativeTileNode("destination"))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{
            if gameplay.sourcePresentationFailure != nil {
                XCTFail("Barrel subsequent reward failure: \(gameplay.sourcePresentationFailure!)")
                return true
            }
            return gameplay.engine.pendingSpecial==nil && !gameplay.engine.hasUnsavableSourceGameplayState
        }
        try await Task.sleep(for:.seconds(2))
        let originals=Set(tiles.map(\.id)),replacements=gameplay.engine.state.tiles.filter{!originals.contains($0.id) && $0.value>0 && !$0.isWild}
        XCTAssertFalse(replacements.isEmpty)
        for tile in replacements {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
            XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:0.01,"Replacement \(tile.id) retained outer constructor shrink")
            XCTAssertEqual(node.sourceLocalScale.y,1,accuracy:0.01)
            XCTAssertEqual(node.visual.xScale,1,accuracy:0.01,"Replacement \(tile.id) retained inner shrink")
            XCTAssertEqual(node.visual.yScale,1,accuracy:0.01)
            XCTAssertEqual(node.sourceStarOrbitMetrics.width,128,accuracy:0.01)
            XCTAssertEqual(node.sourceGridCell,tile.cell)
            XCTAssertEqual(node.sourceValue,tile.value)
            XCTAssertEqual(node.sourceStackDepth,tile.stackDepth)
            XCTAssertEqual(node.sourceEventMode,"static")
            let center=scene.convert(node.position,from:try XCTUnwrap(node.parent))
            XCTAssertTrue(scene.beginDrag(at:center),"Replacement \(tile.id) refuses pickup")
            scene.cancelDrag(pointerCancelled:true)
        }
        try await Task.sleep(for:.milliseconds(500))
        let playable=gameplay.engine.state.tiles.filter{$0.isPlayable && !$0.isWild}
        let pair=try XCTUnwrap(replacements.lazy.compactMap{a in playable.first{b in b.id != a.id && a.value+b.value<6}.map{(a,$0)}}.first)
        let source=try XCTUnwrap(scene.sourceNativeTileNode(pair.0.id)),destination=try XCTUnwrap(scene.sourceNativeTileNode(pair.1.id))
        let start=scene.convert(source.position,from:try XCTUnwrap(source.parent)),end=scene.convert(destination.position,from:try XCTUnwrap(destination.parent))
        XCTAssertTrue(scene.beginDrag(at:start))
        scene.moveDrag(to:end,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        let drop=try XCTUnwrap(scene.finishDrag(at:end,now:CACurrentMediaTime()))
        XCTAssertTrue(drop.accepted,"Replacement stack refused: \(drop.events)")
        try await wait{gameplay.engine.pendingOrdinaryStack==nil && destination.sourcePendingStackFrameCount==0}
        XCTAssertEqual(destination.sourceValue,pair.0.value+pair.1.value)
        if meter>0 {
            XCTAssertNil(gameplay.engine.pendingMeterOpen)
            XCTAssertFalse(gameplay.engine.state.tiles.filter(\.isWild).isEmpty,"Meter reward must actually complete")
            if reuseMeterHolder {XCTAssertTrue(gameplay.engine.state.tiles.contains{$0.id=="meter-holder" && $0.isWild && !$0.locked},"Reward must reuse the original locked holder")}
            try await Task.sleep(for:.milliseconds(500))
            let ordinary=gameplay.engine.state.tiles.filter{$0.isPlayable && !$0.isWild}
            let six=try XCTUnwrap(ordinary.lazy.compactMap{a in ordinary.first{b in b.id != a.id && a.value+b.value==6}.map{(a,$0)}}.first)
            let sn=try XCTUnwrap(scene.sourceNativeTileNode(six.0.id)),dn=try XCTUnwrap(scene.sourceNativeTileNode(six.1.id))
            let p=scene.convert(sn.position,from:try XCTUnwrap(sn.parent)),q=scene.convert(dn.position,from:try XCTUnwrap(dn.parent))
            XCTAssertTrue(scene.beginDrag(at:p));scene.moveDrag(to:q,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            let merged=try XCTUnwrap(scene.finishDrag(at:q,now:CACurrentMediaTime()))
            XCTAssertTrue(merged.accepted,"Subsequent merge6 refused: \(merged.events)")
            try await wait{gameplay.engine.pendingOrdinarySix==nil && !gameplay.engine.hasUnsavableSourceGameplayState}
        }
    }
    func testDisposalAtActualRestartPreparationCannotConstructOrWriteSuccessor()async throws {
        try await exerciseRestart(board:nil,disposeAtPreparation:true)
    }
    func testActualSourceBoardEntryWarmsExistingSmokePoolThroughAllTenBatches()async throws {
        try await exerciseRestart(board:nil,warmupOnly:true)
    }
    func testActualEndRunModalPauseKeepsFiniteAPPWallSmokeWarmup()async throws {
        try await exerciseRestart(board:nil,warmupOnly:true,pauseWarmup:true)
    }
    func testActualBackgroundCancelsEntrySmokeWarmupBeforeOverdueResume()async throws {
        try await exerciseRestart(board:nil,warmupOnly:true,backgroundWarmup:true)
    }
    func testActualArcadeCleanRoundContinuationAdoptsPreparedFoundationAndConsumesPendingRound()async throws {
        try await exerciseContinuation(board:nil)
    }
    func testActualJourneyCleanRewardAndContinueAdoptPreparedFoundationAndCarryScore()async throws {
        try await exerciseContinuation(board:21)
    }
    private func exerciseContinuation(board:Int?)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-fresh-continue-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory),number=board ?? 3
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1..<21)
        let saved=NativeBoardState(tiles:[
            .init(id:"continue-a",cell:.init(column:0,row:0),value:3),
            .init(id:"continue-b",cell:.init(column:1,row:0),value:3)],
            mode:board==nil ? .arcade:.journey,board:number,stage:number,generation:9,moves:37,score:123)
        if let board {seed.journeyRuns[board]=saved;seed.journeyRunSavedAt[board]=Date().timeIntervalSince1970}
        else {seed.arcadeRun=saved;seed.arcadeRunSavedAt=Date().timeIntervalSince1970}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden}
        if let board {
            app.navigate(.world(3),interrupt:true)
            try await wait{if app.children.contains(where:{$0 is NativeGameplayViewController}){return true};app.world?.onRequest?("continue",board);return false}
        }else{app.navigate(.gameplay,interrupt:true)}
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let old=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(old.boardScene)
        try await wait{!old.engine.hasUnsavableSourceGameplayState && old.beforeSourceGameplayAdmission==nil}
        let oldGeneration=old.engine.state.generation
        let sourceID=try XCTUnwrap(old.engine.state.tiles.first{$0.cell == .init(column:0,row:0)}?.id)
        let destinationID=try XCTUnwrap(old.engine.state.tiles.first{$0.cell == .init(column:1,row:0)}?.id)
        let a=try XCTUnwrap(scene.sourceNativeTileNode(sourceID)),b=try XCTUnwrap(scene.sourceNativeTileNode(destinationID))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        if board != nil {
            try await wait{old.presentedViewController is NativeJourneyRewardController}
            let reward=try XCTUnwrap(old.presentedViewController as? NativeJourneyRewardController)
            // The real card input performs reveal and queued collection, using
            // its resource and animation owners rather than a result callback.
            reward.activate();reward.activate()
        }
        try await wait{old.presentedViewController is NativeResultController}
        let result=try XCTUnwrap(old.presentedViewController as? NativeResultController)
        XCTAssertTrue(result.clean);XCTAssertEqual(result.state.board,number)
        let carriedScore=result.finalScore
        if board != nil {
            let primary=try XCTUnwrap(button(result.view,id:"native.result.play-again"))
            try await wait{primary.isUserInteractionEnabled}
            let committed=try XCTUnwrap(store.load())
            XCTAssertTrue(committed.progression.completedJourneyBoards.contains(number))
            XCTAssertNil(committed.journeyRuns[number])
            primary.sendActions(for:.touchUpInside);primary.sendActions(for:.touchUpInside)
        }else {
            // Clean Arcade's authored round cue commits and continues itself.
            // Observe its genuine pending-round receipt before it is consumed.
            try await wait{(try? store.load()?.pendingArcadeRound?.round)==number+1}
            XCTAssertEqual(try store.load()?.pendingArcadeRound?.score,carriedScore)
        }
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{$0 !== old}==true}
        let fresh=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        if board != nil {XCTAssertFalse(containsAnnouncement(fresh),"Clean Play Again must enter dice/HUD directly")}
        XCTAssertTrue(try XCTUnwrap(fresh.sourceInitialConstruction).borrowedPreparedFoundation)
        XCTAssertEqual(fresh.engine.state.generation,oldGeneration+1)
        XCTAssertEqual(fresh.engine.state.board,number+1);XCTAssertEqual(fresh.engine.state.score,carriedScore)
        XCTAssertEqual(fresh.engine.state.moves,50);XCTAssertEqual(fresh.engine.state.mode,saved.mode)
        try await wait{(board != nil || fresh.sourceInitialBoardSaveAccepted) && fresh.boardScene?.isBoardEntryComplete==true && fresh.beforeSourceGameplayAdmission==nil && !fresh.engine.hasUnsavableSourceGameplayState}
        if board != nil {
            // Journey persists through its canonical lifecycle receipt; unlike
            // Arcade it has no beforeSourceInitialBoardReveal save callback.
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        }
        try await wait{(try? store.load()).map{board==nil ? $0.arcadeRun?.board==number+1:$0.journeyRuns[number+1]?.board==number+1}==true}
        let durable=try XCTUnwrap(store.load())
        XCTAssertNil(durable.pendingArcadeRound);XCTAssertEqual(app.route,.gameplay)
        let run=try XCTUnwrap(board==nil ? durable.arcadeRun:durable.journeyRuns[number+1])
        XCTAssertEqual(run.board,number+1);XCTAssertEqual(run.score,carriedScore)
        XCTAssertEqual(run.generation,fresh.engine.state.generation)
        XCTAssertTrue(run.validationIssues().isEmpty)
        if board != nil {XCTAssertTrue(durable.progression.completedJourneyBoards.contains(number))}
    }
    private func exerciseRestart(board:Int?,disposeAtPreparation:Bool=false,warmupOnly:Bool=false,pauseWarmup:Bool=false,backgroundWarmup:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-fresh-rebuild-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1..<21)
        let saved=NativeBoardFactory.make(mode:board==nil ? .arcade:.journey,board:board ?? 4,generation:9,seed:17)
        if let board {seed.journeyRuns[board]=saved;seed.journeyRunSavedAt[board]=Date().timeIntervalSince1970}
        else if !warmupOnly {seed.arcadeRun=saved;seed.arcadeRunSavedAt=Date().timeIntervalSince1970}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden}
        if let board {
            app.navigate(.world((board-1)/10+1),interrupt:true)
            try await wait{if app.children.contains(where:{$0 is NativeGameplayViewController}){return true};app.world?.onRequest?("continue",board);return false}
        }else{app.navigate(.gameplay,interrupt:true)}
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let old=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        try await wait{!old.engine.hasUnsavableSourceGameplayState && old.beforeSourceGameplayAdmission==nil}
        let oldGeneration=old.engine.state.generation
        if !warmupOnly {XCTAssertGreaterThanOrEqual(oldGeneration,saved.generation)}
        if warmupOnly {
            let scene=try XCTUnwrap(old.boardScene),scope=try XCTUnwrap(old.sourceScope)
            // Constructor synchronization can admit its initial physical grid
            // before the VC presents the Scene and starts fresh sweetPopIn.
            // Use the real completed entry receipt before modal/background input.
            try await wait{scene.completedSourceBoardEntry != nil && scene.view?.window != nil && scene.isBoardEntryComplete}
            XCTAssertTrue(old.sourceBoardEntryEnabled,"Warmup belongs to actual fresh sweetPopIn, not resumed ordinary entry")
            XCTAssertNotNil(scene.completedSourceBoardEntry)
            let beforeWarmup=old.engine.state
            if pauseWarmup {old.onExit?();XCTAssertTrue(old.presentedViewController is JimiNativeEndRunModal)}
            if backgroundWarmup {
                // Real lifecycle observers publish foreground=false before
                // suspending this Scene. Resume before the first APP deadline
                // to prove cancellation rather than a callback-time bailout.
                let completedBeforeBackground=scene.sourceSmokePoolWarmupCompletedTargets
                XCTAssertLessThan(completedBeforeBackground.count,10,"Background must interrupt outstanding entry work")
                NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                XCTAssertFalse(scope.service.sourceForegroundAdmissionOpen)
                NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                XCTAssertTrue(scope.service.sourceForegroundAdmissionOpen)
                try await Task.sleep(for:.milliseconds(1100))
                XCTAssertEqual(scene.sourceSmokePoolWarmupCompletedTargets,completedBeforeBackground)
                XCTAssertEqual(old.engine.state,beforeWarmup)
                return
            }
            let deadline=Date().addingTimeInterval(3)
            while scene.sourceSmokePoolWarmupCompletedTargets.count<10 && Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertEqual(scene.sourceSmokePoolWarmupCompletedTargets,[8,16,24,32,40,48,56,64,72,76],"Actual admitted board entry must wire v9's tracked pool warmup")
            XCTAssertGreaterThanOrEqual(scope.smokeSession.pool.retainedNodeCount,76)
            XCTAssertEqual(old.engine.state,beforeWarmup)
            if pauseWarmup {XCTAssertTrue(old.presentedViewController is JimiNativeEndRunModal)}
            return
        }
        old.onExit?()
        try await wait{old.presentedViewController is JimiNativeEndRunModal}
        let modal=try XCTUnwrap(old.presentedViewController as? JimiNativeEndRunModal)
        var modalReady=false;let originalReady=modal.onReady
        modal.onReady={modalReady=true;originalReady?()}
        let restart=try XCTUnwrap(button(modal.view,id:"native.end-run.restart"))
        try await wait{modalReady && restart.isUserInteractionEnabled && modal.view.isUserInteractionEnabled}
        // Use the genuine owner action after its ready admission. Double input
        // must not construct two fresh generations.
        let durableBeforeRestart=try Data(contentsOf:directory.appendingPathComponent("state-v1.json"))
        restart.sendActions(for:.touchUpInside);restart.sendActions(for:.touchUpInside)
        if disposeAtPreparation {
            // The genuine modal's close completion dispatches restart. Dispose
            // immediately after that dispatch while its asynchronous foundation
            // owner is outstanding; retain no synthetic clock or decode owner.
            let closed=try XCTUnwrap(modal.onClosed);var disposedAtPreparation=false
            modal.onClosed={closed();host.dispose();disposedAtPreparation=true}
            try await wait{disposedAtPreparation}
            try await Task.sleep(for:.milliseconds(600))
            XCTAssertTrue(host.children.isEmpty)
            XCTAssertEqual(try Data(contentsOf:directory.appendingPathComponent("state-v1.json")),durableBeforeRestart)
            return
        }
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{$0 !== old}==true}
        let fresh=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        XCTAssertFalse(containsAnnouncement(fresh),"Exit Restart must not mount an announcement before the fresh board's entry")
        XCTAssertFalse(fresh.incomingOriginalThemedCoverExpected)
        XCTAssertTrue(fresh.keepsGameplayChromeVisibleOnEntry)
        XCTAssertTrue(try XCTUnwrap(fresh.sourceInitialConstruction).borrowedPreparedFoundation,"A cold restart must adopt the asynchronously prepared resource owner before constructor draws")
        XCTAssertEqual(fresh.engine.state.generation,oldGeneration+1);XCTAssertEqual(fresh.engine.state.board,board ?? 1)
        XCTAssertEqual(fresh.engine.state.moves,50);XCTAssertEqual(fresh.engine.state.score,0)
        XCTAssertTrue(fresh.engine.state.tiles.allSatisfy{$0.id != saved.tiles.first?.id})
        var sawAnnouncement=false,sawChromeReplay=false
        try await wait{
            sawAnnouncement = sawAnnouncement || self.containsAnnouncement(fresh)
            if let chrome=fresh.boardScene?.boardChromeReceipt {
                sawChromeReplay = sawChromeReplay || chrome.offset != 0 || chrome.alpha != 1 || chrome.entering
            }
            return fresh.boardScene?.completedSourceBoardEntry != nil && fresh.boardScene?.view?.window != nil &&
                fresh.boardScene?.isBoardEntryComplete==true && fresh.beforeSourceGameplayAdmission==nil
        }
        XCTAssertFalse(sawAnnouncement,"Journey/Arcade Exit Restart must stay announcement-free throughout actual entry readiness")
        XCTAssertFalse(sawChromeReplay,"Exit Restart must keep the top HUD settled while dice enter")
        if let footer=fresh.journeyBottomDecor {
            XCTAssertEqual(footer.phase,.visible);XCTAssertFalse(footer.hasActiveClock)
        }
        XCTAssertNil(old.parent,"Only the ready incoming board may retire the covered previous board")
        XCTAssertFalse(containsAnnouncement(fresh))
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(app.children.contains{$0 === fresh})
        let durable=try XCTUnwrap(store.load())
        XCTAssertTrue(durable.progression.firstPlayTutorialComplete)
        if let board {XCTAssertEqual(durable.journeyRuns[board]?.board,board)}
    }
}
