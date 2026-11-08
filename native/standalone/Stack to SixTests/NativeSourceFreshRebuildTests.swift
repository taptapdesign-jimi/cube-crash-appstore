import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceFreshRebuildTests:XCTestCase {
    private var observeTransitionPaint:(()->Void)?
    private var timeoutDiagnostic:(()->String)?
    private func wait(file:StaticString = #filePath,line:UInt = #line,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(35)
        while !predicate(){observeTransitionPaint?();guard Date()<deadline else{XCTFail("Actual fresh rebuild boundary timed out: \(timeoutDiagnostic?() ?? "unavailable")",file:file,line:line);throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
    }
    private func button(_ root:UIView,id:String)->UIButton? {
        if let value=root as? UIButton,value.accessibilityIdentifier==id{return value}
        return root.subviews.lazy.compactMap{self.button($0,id:id)}.first
    }
    func testJourneyRestartHasNoPaintedBoardOverlapOrThreeFrameChromeFlash() async throws {
        try await exerciseRestart(board:11,auditPaintFrames:true)
    }
    func testArcadeNewGameHasNoPaintedBoardOverlapOrThreeFrameChromeFlash() async throws {
        try await exerciseRestart(board:nil,auditPaintFrames:true)
    }
    func testJourneyRestartPaintHandoffWaitsForForegroundWithoutChromeFlash() async throws {
        try await exerciseRestart(board:11,backgroundRestart:true,auditPaintFrames:true)
    }
    func testDisposalDuringRestartPaintHandoffCannotExposeIncomingGeneration() async throws {
        try await exerciseRestart(board:11,disposeAtPreparation:true,auditPaintFrames:true)
    }
    func testRestartExactFirstVisibleHandoffResumesZeroPoseAfterCallbackBackground() async throws {
        try await exerciseRestart(board:11,auditPaintFrames:true,pauseAtHandoff:true)
    }
    func testNewGameExactFirstVisibleHandoffExitCannotStartRetiredEntryWave() async throws {
        try await exerciseRestart(board:nil,auditPaintFrames:true,exitAtHandoff:true)
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
    func testBottleUnlockUnitRestartStartsOrdinaryBeforeFirstBackpackDrop()async throws {
        try await exerciseRestart(board:14)
    }
    func testNormalBottleUnlockPlayReachesPlayableBoardWithoutPresentationFailure()async throws {
        try await exerciseBottleEntry(continueSaved:false)
    }
    func testColdJourneyTransitionRevealsOneMountedHUDWithOneHundredMillisecondDelay() async throws {
        try await exerciseBottleEntry(continueSaved:false,verifyColdHUD:true)
    }
    func testColdForestOneDividerNeverWashesOverHUDDuringEntry() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-forest-hud-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{observeTransitionPaint=nil;host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isEntering && app.home.isUserInteractionEnabled}
        app.navigate(.world(1),interrupt:true)
        try await wait{if app.children.contains(where:{$0 is NativeGameplayViewController}){return true};app.world?.onRequest?("play",1);return false}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        func alpha(_ node:SKNode)->CGFloat {var result:CGFloat=1,node:SKNode?=node;while let current=node{result *= current.alpha;node=current.parent};return result}
        func depth(_ node:SKNode)->CGFloat {var result:CGFloat=0,node:SKNode?=node;while let current=node{result += current.zPosition;node=current.parent};return result}
        var sampled=0,sawDividerArrival=false,sawSettledHUD=false,maximumPaperDepthAboveHUD:CGFloat = -.infinity
        let start=CACurrentMediaTime()
        observeTransitionPaint = {
            guard !game.children.contains(where:{$0 is NativeThemedBoardTransitionController}),
                  let divider=scene.childNode(withName:"//native-preload-divider"),!divider.isHidden,
                  let close=hud.childNode(withName:"preload-navigation-hud-1"),alpha(close)>0.9 else{return}
            sampled+=1
            let dividerAlpha=alpha(divider)
            if dividerAlpha>0.01 {
                sawDividerArrival=true
                maximumPaperDepthAboveHUD=max(maximumPaperDepthAboveHUD,depth(divider)-depth(close))
            }
            sawSettledHUD = sawSettledHUD || dividerAlpha>0.99 && hud.action(forKey:"hud-enter")==nil
            if sampled%10==1 {print("[FOREST_01_HUD_FRAME] t=\(CACurrentMediaTime()-start) closeAlpha=\(alpha(close)) dividerAlpha=\(dividerAlpha) closeZ=\(depth(close)) dividerZ=\(depth(divider))")}
        }
        try await wait{sawSettledHUD && game.boardScene?.isBoardEntryComplete==true}
        for _ in 0..<10 {observeTransitionPaint?();try await Task.sleep(for:.milliseconds(20))}
        XCTAssertGreaterThan(sampled,5);XCTAssertTrue(sawDividerArrival);XCTAssertTrue(sawSettledHUD)
        XCTAssertLessThan(maximumPaperDepthAboveHUD,0,"The divider includes17percent paper across the navigation area;it must paint behind HUD icons throughout entry and at rest")
    }
    func testNormalSavedBottleContinueKeepsExistingDieAndReachesPlayableBoard()async throws {
        try await exerciseBottleEntry(continueSaved:true)
    }
    func testTabletActualFreshPlayAndSavedContinueReachEightRowGameplayWithSceneryMask() async throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else{throw XCTSkip("Tablet entry on iPad Simulator only")}
        try await exerciseBottleEntry(continueSaved:false,tablet:true)
        try await exerciseBottleEntry(continueSaved:true,tablet:true)
    }
    private func exerciseBottleEntry(continueSaved:Bool,tablet:Bool=false,verifyColdHUD:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-bottle-entry-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1...13)
        var saved=NativeBoardFactory.make(mode:.journey,board:14,columns:tablet ? 7:5,rows:tablet ? 8:9,generation:9,seed:17)
        saved.moves=49
        if continueSaved {
            let index=try XCTUnwrap(saved.tiles.firstIndex(where:{$0.isPlayable}))
            saved.tiles[index].value=6;saved.tiles[index].archetype = .magnet;saved.tiles[index].variant="bottle"
            saved.wildSpawnCount=1
        }
        if continueSaved {seed.journeyRuns[14]=saved;seed.journeyRunSavedAt[14]=Date().timeIntervalSince1970}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:tablet ? 820:390,height:tablet ? 1180:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{timeoutDiagnostic=nil;host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden && (!app.home.isEntering && app.home.isUserInteractionEnabled)}
        app.navigate(.world(2),interrupt:true)
        try await wait{if app.children.contains(where:{$0 is NativeGameplayViewController}){return true};app.world?.onRequest?(continueSaved ? "continue":"play",14);return false}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        timeoutDiagnostic = {[weak game] in game.map{"\($0.sourceEntryDiagnostic());failure=\(String(describing:$0.sourcePresentationFailureGeneration))"} ?? "game released"}
        let initialScene=try XCTUnwrap(game.boardScene)
        let previousHUDDrop=initialScene.onHUDDrop
        var visibleHUDReveals=0,sawThemedTransition=false,firstFrameReadyAt:CFTimeInterval?,visibleHUDAt:CFTimeInterval?
        if verifyColdHUD {
            XCTAssertFalse(UIAccessibility.isReduceMotionEnabled,"Full-motion cold Journey fixture")
            game.whenFirstBoardFrameReady {firstFrameReadyAt=CACurrentMediaTime()}
            initialScene.onHUDDrop = {[weak game,weak initialScene] generation in
                previousHUDDrop?(generation)
                guard let game,let scene=initialScene else{XCTFail("Cold HUD owner retired before reveal");return}
                visibleHUDReveals+=1;visibleHUDAt=CACurrentMediaTime()
                XCTAssertEqual(generation,game.engine.state.generation)
                XCTAssertTrue(game.boardScene === scene)
                XCTAssertTrue(scene.gameplayRenderHost?.renderedScene === scene)
                XCTAssertNotNil(scene.gameplayRenderHost?.renderView.window)
                XCTAssertFalse(scene.gameplayRenderHost?.renderView.isHidden ?? true)
                XCTAssertFalse(game.children.contains{$0 is NativeThemedBoardTransitionController},"Cold HUD must not consume its entrance under the transition cover")
                XCTAssertNotNil(firstFrameReadyAt,"Actual board paint must have released the transition before the visible HUD starts")
                let delay=scene.childNode(withName:"//native-game-hud")?.action(forKey:"hud-enter-delay")
                XCTAssertEqual(delay?.duration ?? -1,NativeBoardScene.ordinaryHUDEntryDelay,accuracy:0.000001)
                XCTAssertNotNil(scene.childNode(withName:"//native-game-hud")?.action(forKey:"hud-enter"))
            }
            try await wait{
                sawThemedTransition = sawThemedTransition || game.children.contains{$0 is NativeThemedBoardTransitionController}
                return sawThemedTransition
            }
        }
        defer{if verifyColdHUD {initialScene.onHUDDrop=previousHUDDrop}}
        try await wait{game.beforeSourceGameplayAdmission==nil && game.boardScene?.isBoardEntryComplete==true && game.boardScene?.gameplayRenderHost?.renderView.window != nil}
        let scene=try XCTUnwrap(game.boardScene)
        let bottles=game.engine.state.tiles.filter{$0.variant=="bottle"}
        XCTAssertNil(game.sourcePresentationFailureGeneration);XCTAssertNil(game.presentedViewController)
        XCTAssertEqual(app.route,.gameplay)
        if verifyColdHUD {
            try await wait{visibleHUDReveals>0 && scene.childNode(withName:"//native-game-hud")?.action(forKey:"hud-enter")==nil}
            XCTAssertTrue(sawThemedTransition)
            XCTAssertEqual(visibleHUDReveals,1)
            let first=try XCTUnwrap(firstFrameReadyAt),reveal=try XCTUnwrap(visibleHUDAt)
            XCTAssertGreaterThanOrEqual(reveal,first)
            XCTAssertFalse(scene.isHUDRevealPending)
            try await Task.sleep(for:.milliseconds(150));XCTAssertEqual(visibleHUDReveals,1)
            print("COLD_JOURNEY_HUD_PROOF firstPaintToHUD=\(reveal-first) configuredDelay=\(NativeBoardScene.ordinaryHUDEntryDelay) reveals=\(visibleHUDReveals)")
        }
        if tablet {
            XCTAssertEqual(game.engine.state.columns,7);XCTAssertEqual(game.engine.state.rows,8)
            scene.didFinishUpdate();XCTAssertNotNil(scene.onBackdropOcclusion)
            XCTAssertNotNil(game.journeyBottomDecor?.layer.mask)
        }
        if continueSaved {
            XCTAssertEqual(bottles.count,1)
            let tile=try XCTUnwrap(bottles.first),node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
            try await wait{node.hasSourceBottleIdle && node.sourceWildSkinReceiptCurrent}
            XCTAssertFalse(node.isHidden);XCTAssertEqual(node.alpha,1,accuracy:0.001)
            XCTAssertTrue(tile.isPlayable)
            XCTAssertEqual(tile.id,saved.tiles.first(where:{$0.variant=="bottle"})?.id)
            XCTAssertEqual(game.engine.state.moves,49)
            XCTAssertNotNil(try store.load()?.journeyRuns[14])
        } else {
            XCTAssertTrue(bottles.isEmpty);XCTAssertFalse(game.engine.state.tiles.contains(where: \.isWild))
            XCTAssertEqual(game.engine.state.moves,50)
            XCTAssertNil(try store.load()?.journeyRuns[14])
        }
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
    func testArcadeCrateDropKeepsExclusiveMotionDuringFlowerMergeSix()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"flower",meter:0.95,overlapMode:.arcade)
    }
    func testJourneyBackpackDropKeepsExclusiveMotionDuringFlowerMergeSix()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"flower",meter:0.95,overlapMode:.journey)
    }
    func testJourneyFlowerAfterRepeatedBackpackDetailReturnKeepsSourceTransaction()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"flower",backpackReturns:true)
    }
    func testJourneyRegularOntoFlowerAfterRepeatedBackpackDetailReturnKeepsSourceTransaction()async throws {
        try await exerciseAuthoredTntReplacementSize(variant:"flower",backpackReturns:true,reversed:true)
    }
    private func exerciseAuthoredTntReplacementSize(variant:String,meter:Double=0,reuseMeterHolder:Bool=false,overlapMode:NativeRunMode?=nil,backpackReturns:Bool=false,reversed:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-flower-size-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        var tiles:[NativeTile]=[.init(id:"flower",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:variant),.init(id:"destination",cell:.init(column:1,row:0),value:2)]+(1...6).map{.init(id:"target-\($0)",cell:.init(column:$0%5,row:1+$0/5),value:1+$0%5)}
        if overlapMode != nil {
            tiles += [.init(id:"ordinary-three-a",cell:.init(column:0,row:4),value:3),.init(id:"ordinary-three-b",cell:.init(column:1,row:4),value:3)]
        }
        if reuseMeterHolder {tiles.append(.init(id:"meter-holder",cell:.init(column:4,row:0),value:0,locked:true,alpha:0.25))}
        seed.arcadeRun = .init(tiles:tiles,mode:.arcade,board:3,stage:3,generation:9,moves:37,score:123)
        seed.arcadeRun?.wildMeter=meter
        seed.arcadeRunSavedAt=Date().timeIntervalSince1970
        if overlapMode == .journey || backpackReturns {
            seed.journeyRuns[3]=seed.arcadeRun!
            seed.journeyRuns[3]?.mode = .journey
            seed.journeyRunSavedAt[3]=Date().timeIntervalSince1970
            seed.progression.completedJourneyBoards=[1,2]
            seed.arcadeRun=nil
        }
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{observeTransitionPaint=nil;host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden}
        if overlapMode == .journey || backpackReturns {
            app.navigate(.world(1),interrupt:true)
            try await wait{if app.children.contains(where:{$0 is NativeGameplayViewController}){return true};app.world?.onRequest?("continue",3);return false}
        }else{app.navigate(.gameplay,interrupt:true)}
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let gameplay=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(gameplay.boardScene)
        XCTAssertTrue(gameplay.engine.comboHUDCoinRewardsEnabled)
        try await wait{!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.beforeSourceGameplayAdmission==nil}
        if backpackReturns {
            let original=gameplay.engine.state
            for opening in 0..<3 {
                let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help"))
                XCTAssertTrue(scene.handleHUDContact(at:help.convert(CGPoint.zero,to:scene)))
                try await wait{gameplay.presentedViewController?.view.isUserInteractionEnabled==true}
                let backpack=try XCTUnwrap(gameplay.presentedViewController as? NativeGameplayBackpackController)
                XCTAssertTrue(scene.isPaused)
                backpack.screen?.onDie?(try XCTUnwrap(NativeBackpackCatalog.forest.first{$0.id=="flower"}))
                try await wait{backpack.detail?.card.isUserInteractionEnabled==true}
                let detail=try XCTUnwrap(backpack.detail)
                // Dwell through APP wall callbacks while the real scene stays paused.
                try await Task.sleep(for:.milliseconds(opening==0 ? 1300:650))
                detail.closeTapped()
                try await wait{backpack.detail==nil && backpack.view.isUserInteractionEnabled}
                try XCTUnwrap(button(backpack.view,id:"native.gameplay.backpack.close")).sendActions(for:.touchUpInside)
                try await wait{gameplay.presentedViewController==nil && !scene.isPaused}
                XCTAssertTrue(gameplay.boardScene === scene)
                XCTAssertEqual(gameplay.engine.state,original)
                XCTAssertNil(gameplay.sourcePresentationFailure,"Backpack return failure: \(String(describing:gameplay.sourcePresentationFailure))")
            }
        }
        var carrier:NativeDiceNode?,carrierCell:NativeCell?,carrierSamples=0
        if overlapMode != nil {
            let sn=try XCTUnwrap(scene.sourceNativeTileNode("ordinary-three-a")),dn=try XCTUnwrap(scene.sourceNativeTileNode("ordinary-three-b"))
            let p=scene.convert(sn.position,from:try XCTUnwrap(sn.parent)),q=scene.convert(dn.position,from:try XCTUnwrap(dn.parent))
            XCTAssertTrue(scene.beginDrag(at:p));scene.moveDrag(to:q,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:q,now:CACurrentMediaTime())).accepted)
            try await wait{gameplay.engine.meterDropReservations.values.contains{$0.assetsPrepared && !$0.landed}}
            let drop=try XCTUnwrap(gameplay.engine.meterDropReservations.values.first)
            carrier=try XCTUnwrap(scene.sourceNativeTileNode(drop.tileID));carrierCell=drop.cell
            observeTransitionPaint={
                guard let carrier else{return};carrierSamples+=1
                XCTAssertNil(carrier.action(forKey:"tnt-blast"),"Flower stole the carrier transform")
                XCTAssertNil(carrier.action(forKey:"tnt-return"),"Flower rewound the landed carrier")
            }
        }
        let a=try XCTUnwrap(scene.sourceNativeTileNode(reversed ? "destination":"flower")),b=try XCTUnwrap(scene.sourceNativeTileNode(reversed ? "flower":"destination"))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        if variant == "beach-ball" {
            XCTAssertNil(gameplay.engine.pendingSpecial,"Ball now shares Mushroom's direct refill owner")
            XCTAssertNotNil(gameplay.engine.pendingDirectWild)
        }
        try await wait{
            if gameplay.sourcePresentationFailure != nil {
                XCTFail("Authored TNT subsequent reward failure: \(gameplay.sourcePresentationFailure!)")
                return true
            }
            return gameplay.engine.pendingSpecial==nil && !gameplay.engine.hasUnsavableSourceGameplayState
        }
        if let carrier,let carrierCell {
            observeTransitionPaint?();observeTransitionPaint=nil
            XCTAssertGreaterThan(carrierSamples,0)
            XCTAssertTrue(scene.sourceNativeTileNode(carrier.tileID) === carrier)
            XCTAssertEqual(carrier.sourceGridCell,carrierCell)
            XCTAssertEqual(gameplay.engine.state.wildSpawnCount,1)
            XCTAssertTrue(gameplay.engine.meterDropReservations.isEmpty)
            XCTAssertNil(gameplay.sourcePresentationFailure)
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
    func testActualOwnedGameplayRetainsDragAfterRepeatedStacksSixesAndMeterReward()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-sustained-contacts-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        let tiles=(0..<30).map { index in
            NativeTile(id:"sustained-\(index)",cell:.init(column:index%5,row:index/5),value:1+index%5)
        }
        seed.arcadeRun = .init(tiles:tiles,mode:.arcade,board:3,stage:3,generation:9,moves:90,maxMoves:100,score:123)
        seed.arcadeRun?.wildMeter=0.95
        seed.arcadeRunSavedAt=Date().timeIntervalSince1970
        try store.save(seed)
        let root=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
        defer{root.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        root.loadViewIfNeeded()
        let app=try XCTUnwrap(root.children.first as? NativeAppController)
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let gameplay=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(gameplay.boardScene),scope=try XCTUnwrap(gameplay.sourceScope)
        let renderer=try XCTUnwrap(scene.gameplayRenderHost as? NativeOwnedMetalGameplayView,"Actual standalone route must retain the accepted renderer without launch flags")
        try await wait{!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.beforeSourceGameplayAdmission==nil}
        let initialMoves=gameplay.engine.state.moves,initialScore=gameplay.engine.state.score
        func settled()->Bool {
            !gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingOrdinaryStack==nil &&
                gameplay.engine.pendingOrdinarySix==nil && scene.sourceRegularStackFeedbackRootCount==0 &&
                scope.sixResources.activeShards==0 && scope.smoke.activeOwnerCount==0 &&
                gameplay.engine.state.tiles.allSatisfy{scene.sourceNativeTileNode($0.id)?.sourcePendingStackFrameCount==0}
        }
        for cycle in 0..<6 {
            for mergeSix in [false,true] {
                try await wait{settled()}
                let ordinary=gameplay.engine.state.tiles.filter{$0.isPlayable && !$0.isWild}
                let pair=try XCTUnwrap(ordinary.lazy.compactMap { a in
                    ordinary.first { b in b.id != a.id && (mergeSix ? a.value+b.value==6:a.value+b.value<6) }.map{(a,$0)}
                }.first,"Cycle \(cycle) must have an actual \(mergeSix ? "merge6":"stack") pair")
                let source=try XCTUnwrap(scene.sourceNativeTileNode(pair.0.id)),destination=try XCTUnwrap(scene.sourceNativeTileNode(pair.1.id))
                let start=scene.convert(source.position,from:try XCTUnwrap(source.parent)),end=scene.convert(destination.position,from:try XCTUnwrap(destination.parent))
                XCTAssertTrue(scene.beginDrag(at:start))
                scene.moveDrag(to:end,now:CACurrentMediaTime())
                // Existing authored contact target settling, also exercised by the reward regression above.
                try await Task.sleep(for:.milliseconds(160))
                let result=try XCTUnwrap(scene.finishDrag(at:end,now:CACurrentMediaTime()))
                XCTAssertTrue(result.accepted,"Cycle \(cycle) refused actual contact: \(result.events)")
                try await wait{settled()}
                XCTAssertNil(gameplay.sourcePresentationFailure)
                XCTAssertNil(gameplay.engine.state.terminal)
                XCTAssertFalse(gameplay.engine.flags.isWaiting)
                if !mergeSix {XCTAssertEqual(destination.sourceValue,pair.0.value+pair.1.value)}
            }
        }
        XCTAssertEqual(gameplay.engine.state.moves,initialMoves-12)
        XCTAssertGreaterThan(gameplay.engine.state.score,initialScore)
        XCTAssertNil(gameplay.engine.pendingMeterOpen)
        XCTAssertTrue(gameplay.engine.state.tiles.contains(where:\.isWild),"The charged meter must actually deliver its reward")
        let held=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.isPlayable && !$0.isWild})
        let node=try XCTUnwrap(scene.sourceNativeTileNode(held.id)),parent=try XCTUnwrap(node.parent)
        let origin=scene.convert(node.position,from:parent)
        let rafBefore=scope.service.pendingSourceAnimationFrameCount
        XCTAssertTrue(scene.beginDrag(at:origin))
        for index in 1...20 {
            let point=CGPoint(x:origin.x+CGFloat(index%5)*3,y:origin.y+CGFloat(index)*0.5)
            scene.dispatchSourceTouchMove(to:point)
            XCTAssertTrue(renderer.updateSceneForRendererFrame(atTime:CACurrentMediaTime()))
            let actual=scene.convert(node.position,from:parent)
            XCTAssertEqual(actual.x,point.x,accuracy:0.001,"Latest real touch must paint after sustained contacts")
            XCTAssertEqual(actual.y,point.y,accuracy:0.001)
        }
        scene.cancelDrag(pointerCancelled:true)
        try await wait{
            let actual=scene.convert(node.position,from:parent)
            return settled() && scope.service.pendingSourceAnimationFrameCount<=rafBefore &&
                abs(actual.x-origin.x)<0.001 && abs(actual.y-origin.y)<0.001
        }
        XCTAssertFalse(scope.service.rendererDragDeliveryActive)
        XCTAssertEqual(gameplay.engine.state.moves,initialMoves-12,"Cancelled physical drag must not create another move")
        XCTAssertNil(gameplay.sourcePresentationFailure)
    }
    func testDisposalAtActualRestartPreparationCannotConstructOrWriteSuccessor()async throws {
        try await exerciseRestart(board:nil,disposeAtPreparation:true)
    }
    func testJourneyRestartWaitsForForegroundExitBeforeConstructingSuccessor()async throws {
        try await exerciseRestart(board:1,backgroundRestart:true)
    }
    func testJourneyDisposalAtRestartPreparationPreservesPreviousAttempt()async throws {
        try await exerciseRestart(board:14,disposeAtPreparation:true)
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
    func testActualJourneyCleanRewardAndContinueAdoptPreparedFoundationAndResetScore()async throws {
        try await exerciseContinuation(board:21)
    }
    func testActualJourneySixToSevenStartsFreshAttemptAndPreservesCompletedScore()async throws {
        try await exerciseContinuation(board:6)
    }
    func testActualJourneyNextUsesCompletedSixAndIgnoresStaleSuccessorSave()async throws {
        try await exerciseContinuation(board:6,staleJourneySave:true)
    }
    func testActualPreviouslyClearedJourneySixAlsoAdvancesToFreshSeven()async throws {
        try await exerciseContinuation(board:6,replayJourney:true)
    }
    func testActualArcadeRoundOneToTwoKeepsUpperAndLowerHUDVisibleThroughoutCueAndEntry()async throws {
        try await exerciseContinuation(board:nil,arcadeRound:1,verifyChrome:true)
    }
    func testJourneyPlayRequiresFirstCommittedMoveForContinue()async throws {
        try await exerciseFirstMovePersistence(board:11,variant:.endurance)
    }
    func testAllArcadeVariantsRequireFirstCommittedMoveForContinue()async throws {
        for variant in NativeArcadeVariant.allCases {try await exerciseFirstMovePersistence(board:nil,variant:variant)}
    }
    func testActualExitWithoutMoveKeepsJourneyAndArcadeAsPlay()async throws {
        try await exerciseFirstMovePersistence(board:11,variant:.endurance,exitWithoutMove:true)
        try await exerciseFirstMovePersistence(board:nil,variant:.endurance,exitWithoutMove:true)
    }
    private func exerciseFirstMovePersistence(board:Int?,variant:NativeArcadeVariant,exitWithoutMove:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-first-move-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1...30)
        seed.activeArcadeVariant=variant
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden}
        if let board {
            app.navigate(.world(2),interrupt:true)
            try await wait{if app.children.contains(where:{$0 is NativeGameplayViewController}){return true};app.world?.onRequest?("play",board);return false}
        } else {app.navigate(.gameplay,interrupt:true)}
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.completedSourceBoardEntry != nil}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),number=board ?? 1
        try await wait{game.beforeSourceGameplayAdmission==nil && !game.engine.hasUnsavableSourceGameplayState}
        func lifecycleSave(){
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        }
        lifecycleSave()
        let untouched=try XCTUnwrap(store.load())
        XCTAssertNil(board==nil ? untouched.arcadeRun:untouched.journeyRuns[number])
        XCTAssertNil(untouched.resumedRun(mode:board==nil ? .arcade:.journey,board:number))
        if exitWithoutMove {
            game.onExit?()
            try await wait{game.presentedViewController is JimiNativeEndRunModal}
            let modal=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
            let exit=try XCTUnwrap(button(modal.view,id:"native.end-run.exit"))
            try await wait{modal.view.isUserInteractionEnabled && exit.isUserInteractionEnabled}
            exit.sendActions(for:.touchUpInside)
            try await wait{game.parent==nil}
            let exited=try XCTUnwrap(store.load())
            XCTAssertNil(board==nil ? exited.arcadeRun:exited.journeyRuns[number])
            XCTAssertNil(exited.resumedRun(mode:board==nil ? .arcade:.journey,board:number))
            return
        }
        let candidates=game.engine.state.tiles.filter{!$0.locked && !$0.isWild && $0.value>0}
        let pair=try XCTUnwrap(candidates.enumerated().flatMap{i,a in candidates.dropFirst(i+1).filter{a.value+$0.value<6}.map{(a,$0)}}.first)
        let geometry=try XCTUnwrap(scene.boardGeometry)
        let from=geometry.center(row:pair.0.cell.row,column:pair.0.cell.column),to=geometry.center(row:pair.1.cell.row,column:pair.1.cell.column)
        // Pickup and snap-back cannot admit Continue.
        XCTAssertTrue(scene.beginDrag(at:from));_ = scene.finishDrag(at:from,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(600));lifecycleSave()
        XCTAssertNil(try store.load()?.resumedRun(mode:board==nil ? .arcade:.journey,board:number))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.state.moves==49 && game.engine.pendingOrdinaryStack==nil && !game.engine.hasUnsavableSourceGameplayState}
        lifecycleSave()
        try await wait{(try? store.load()?.resumedRun(mode:board==nil ? .arcade:.journey,board:number)) != nil}
        let restored=try XCTUnwrap(store.load()?.resumedRun(mode:board==nil ? .arcade:.journey,board:number))
        XCTAssertEqual(restored.moves,49);XCTAssertEqual(restored.tiles,game.engine.state.tiles)
    }
    private func exerciseContinuation(board:Int?,arcadeRound:Int=3,verifyChrome:Bool=false,staleJourneySave:Bool=false,replayJourney:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-fresh-continue-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory),number=board ?? arcadeRound
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1..<(board ?? 21))
        if replayJourney {seed.progression.completedJourneyBoards.insert(number)}
        let saved=NativeBoardState(tiles:[
            .init(id:"continue-a",cell:.init(column:0,row:0),value:3),
            .init(id:"continue-b",cell:.init(column:1,row:0),value:3)],
            mode:board==nil ? .arcade:.journey,board:number,stage:number,generation:9,moves:37,score:123)
        if let board {seed.journeyRuns[board]=saved;seed.journeyRunSavedAt[board]=Date().timeIntervalSince1970}
        else {seed.arcadeRun=saved;seed.arcadeRunSavedAt=Date().timeIntervalSince1970}
        if staleJourneySave {
            var stale=NativeBoardFactory.make(mode:.journey,board:number+1,generation:90,seed:24)
            stale.score=9876;stale.moves=12;stale.combo=45;stale.longestCombo=45
            seed.journeyRuns[number+1]=stale;seed.journeyRunSavedAt[number+1]=Date().timeIntervalSince1970
        }
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
        let old=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(old.boardScene)
        try await wait{!old.engine.hasUnsavableSourceGameplayState && old.beforeSourceGameplayAdmission==nil}
        var sawUpperHUDHidden=false,sawLowerHUDHidden=false,sawDividerHidden=false
        if verifyChrome {
            try await wait{scene.boardChromeReceipt.alpha==1 && scene.boardChromeReceipt.offset==0 && !scene.boardChromeReceipt.entering && scene.roundChromeReceipt.alpha==1 && !scene.roundChromeReceipt.animating}
            observeTransitionPaint={
                let visible=old.parent != nil ? old:app.children.compactMap{$0 as? NativeGameplayViewController}.first
                if let chrome=visible?.boardScene?.boardChromeReceipt {
                    sawUpperHUDHidden = sawUpperHUDHidden || chrome.alpha != 1 || chrome.offset != 0 || chrome.entering
                }
                if let surface=visible?.boardScene?.childNode(withName:"//native-preload-bar"),
                   let divider=surface.childNode(withName:"//native-preload-divider") {
                    let hidden=surface.isHidden || surface.alpha<0.999 || divider.isHidden || divider.alpha<0.999 || abs(divider.xScale-1)>0.001 || abs(divider.yScale-1)>0.001
                    if hidden && !sawDividerHidden {print("ARCADE_DIVIDER_HANDOFF owner=\(visible === old ? "outgoing":"incoming") rootHidden=\(surface.isHidden) rootAlpha=\(surface.alpha) dividerHidden=\(divider.isHidden) dividerAlpha=\(divider.alpha) scale=\(divider.xScale),\(divider.yScale)")}
                    sawDividerHidden = sawDividerHidden || hidden
                }else{
                    if !sawDividerHidden {print("ARCADE_DIVIDER_HANDOFF owner=\(visible === old ? "outgoing":"incoming") missing-surface")}
                    sawDividerHidden=true
                }
                if let lower=visible?.boardScene?.roundChromeReceipt {
                    sawLowerHUDHidden = sawLowerHUDHidden || lower.hidden || lower.alpha != 1 || lower.offset != 0
                }
                if let footer=visible?.journeyBottomDecor {
                    sawLowerHUDHidden = sawLowerHUDHidden || footer.phase != .visible || footer.pose.opacity != 1
                }
            }
        }
        defer{observeTransitionPaint=nil}
        let oldGeneration=old.engine.state.generation
        let sourceID=try XCTUnwrap(old.engine.state.tiles.first{$0.cell == .init(column:0,row:0)}?.id)
        let destinationID=try XCTUnwrap(old.engine.state.tiles.first{$0.cell == .init(column:1,row:0)}?.id)
        let a=try XCTUnwrap(scene.sourceNativeTileNode(sourceID)),b=try XCTUnwrap(scene.sourceNativeTileNode(destinationID))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        if board != nil,!replayJourney {
            try await wait{old.visibleJourneyRewardController != nil}
            let reward=try XCTUnwrap(old.visibleJourneyRewardController)
            try await wait{(try? store.load()?.progression.completedJourneyBoards.contains(reward.board)) == true}
            // The real card input performs reveal and queued collection, using
            // its resource and animation owners rather than a result callback.
            reward.activate()
            try await wait{reward.phase == "unlocked"}
            reward.activate()
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
            XCTAssertEqual(committed.progression.boardStats[number]?.highScore,carriedScore)
            primary.sendActions(for:.touchUpInside);primary.sendActions(for:.touchUpInside)
        }else {
            // Clean Arcade's authored round cue commits and continues itself.
            // Observe its genuine pending-round receipt before it is consumed.
            try await wait{(try? store.load()?.pendingArcadeRound?.round)==number+1}
            XCTAssertEqual(try store.load()?.pendingArcadeRound?.score,carriedScore)
        }
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{$0 !== old}==true}
        let fresh=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        if board != nil {
            try await wait{fresh.children.contains{$0 is NativeThemedBoardTransitionController}}
            XCTAssertNil(fresh.boardScene?.completedSourceBoardEntry,"Continue must show the transition before revealing the next board")
        }
        XCTAssertTrue(try XCTUnwrap(fresh.sourceInitialConstruction).borrowedPreparedFoundation)
        XCTAssertEqual(fresh.engine.state.generation,oldGeneration+1)
        XCTAssertEqual(fresh.engine.state.board,number+1);XCTAssertEqual(fresh.engine.state.stage,number+1)
        XCTAssertEqual(fresh.engine.state.score,board == nil ? carriedScore:0)
        if board != nil {
            XCTAssertEqual(fresh.engine.state.combo,0);XCTAssertEqual(fresh.engine.state.longestCombo,0)
            XCTAssertEqual(fresh.engine.state.earnedComboBonus,0);XCTAssertEqual(fresh.engine.state.cubesCracked,0)
            XCTAssertNil(fresh.engine.state.terminal)
            XCTAssertFalse(fresh.engine.state.tiles.isEmpty)
            XCTAssertFalse(fresh.engine.state.tiles.contains{$0.id=="continue-a" || $0.id=="continue-b"})
        }
        XCTAssertEqual(fresh.engine.state.moves,50);XCTAssertEqual(fresh.engine.state.mode,saved.mode)
        if verifyChrome {
            XCTAssertTrue(fresh.keepsGameplayChromeVisibleOnEntry)
            XCTAssertTrue(fresh.waitsForFirstFrameOnReplacement)
        }
        try await wait{(board != nil || fresh.sourceInitialBoardSaveAccepted) && fresh.boardScene?.isBoardEntryComplete==true && fresh.beforeSourceGameplayAdmission==nil && !fresh.engine.hasUnsavableSourceGameplayState}
        if verifyChrome {
            observeTransitionPaint?()
            XCTAssertFalse(sawUpperHUDHidden,"Arcade Round01→02 must keep upper HUD settled through clean cue and next-board entry")
            XCTAssertFalse(sawDividerHidden,"Arcade continuation must retain the full divider/ribbon instead of replaying its exit/entry")
            XCTAssertFalse(sawLowerHUDHidden,"Arcade Round01→02 must keep lower Round pill visible through clean cue and next-board entry")
        }
        if board != nil {
            // Journey persists through its canonical lifecycle receipt; unlike
            // Arcade it has no beforeSourceInitialBoardReveal save callback.
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        }
        let durable=try XCTUnwrap(store.load())
        XCTAssertEqual(app.route,.gameplay)
        XCTAssertNil(durable.resumedRun(mode:saved.mode,board:number+1))
        if board != nil {
            XCTAssertNil(durable.journeyRuns[number+1])
            XCTAssertTrue(durable.progression.completedJourneyBoards.contains(number))
            XCTAssertEqual(durable.progression.boardStats[number]?.highScore,carriedScore)
        } else {
            XCTAssertNil(durable.arcadeRun)
            XCTAssertEqual(durable.pendingArcadeRound?.round,number+1)
            XCTAssertEqual(durable.pendingArcadeRound?.score,carriedScore)
        }
    }

    private func exerciseRestart(board:Int?,disposeAtPreparation:Bool=false,warmupOnly:Bool=false,pauseWarmup:Bool=false,backgroundWarmup:Bool=false,backgroundRestart:Bool=false,auditPaintFrames:Bool=false,pauseAtHandoff:Bool=false,exitAtHandoff:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-fresh-rebuild-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1..<21)
        var saved=NativeBoardFactory.make(mode:board==nil ? .arcade:.journey,board:board ?? 4,generation:9,seed:17)
        saved.moves=49
        if let board {seed.journeyRuns[board]=saved;seed.journeyRunSavedAt[board]=Date().timeIntervalSince1970}
        else if !warmupOnly {seed.arcadeRun=saved;seed.arcadeRunSavedAt=Date().timeIntervalSince1970}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        if auditPaintFrames {window.windowScene=try XCTUnwrap(previous?.windowScene,"Paint audit requires the real Simulator UIWindowScene")}
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden && (!app.home.isEntering && app.home.isUserInteractionEnabled)}
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
            try await wait{scene.completedSourceBoardEntry != nil && scene.gameplayRenderHost?.renderView.window != nil && scene.isBoardEntryComplete}
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
        // Polling every20ms misses a three-frame flash and final-state checks
        // cannot prove the first incoming paint. Sample each display opportunity
        // plus the real Scene post-update/pre-encode boundary on both owners.
        let paintSampler=NativeRestartPaintSampler()
        var paintHooks:[NativeRestartRenderHook]=[],paintHookIDs=Set<ObjectIdentifier>()
        var paintRows:[[String:Any]]=[],paintFailures=Set<String>(),incomingVisibleSamples=0,paintSamples=0
        var incomingRenderSerials=Set<UInt64>(),firstIncomingPaintScales:[CGFloat]=[],incomingHandoffSamples=0
        var firstIncomingGeometry:(CGSize,UIEdgeInsets,[String:CGFloat])?
        var incomingWavePaintEpoch:CFTimeInterval?
        var handoffInterrupted=false,handoffResumed=false,handoffPausedAt:CFTimeInterval?,handoffExitResult:Bool?
        let oldScene=try XCTUnwrap(old.boardScene)
        let oldBoardNodes=old.engine.state.tiles.compactMap{oldScene.sourceNativeTileNode($0.id)}
        let fixedNames=["native-game-close","native-game-help","native-preload-divider"]
        func nodeAlpha(_ node:SKNode)->CGFloat {
            var value:CGFloat=1,current:SKNode?=node
            while let n=current {if n.isHidden {return 0};value *= n.alpha;current=n.parent}
            return value
        }
        func chrome(_ game:NativeGameplayViewController)->[String:(point:CGPoint,alpha:CGFloat)] {
            guard let scene=game.boardScene,let render=scene.gameplayRenderHost else{return [:]}
            return Dictionary(uniqueKeysWithValues:fixedNames.compactMap{name in
                guard let node=scene.childNode(withName:"//"+name) else{return nil}
                let point=render.scenePointToView(node.convert(.zero,to:scene),scene:scene)
                return (name,(point:render.renderView.convert(point,to:window),alpha:nodeAlpha(node)))
            })
        }
        let fixedChrome=chrome(old)
        if auditPaintFrames {XCTAssertEqual(fixedChrome.count,3);XCTAssertTrue(fixedChrome.values.allSatisfy{$0.alpha>0.01})}
        func requirePaint(_ condition:Bool,key:String,message:String) {
            if !condition,paintFailures.insert(key).inserted {XCTFail(message)}
        }
        func samplePaint(_ phase:String) {
            guard auditPaintFrames else{return}
            let sampleTime=CACurrentMediaTime()
            let games=app.children.compactMap{$0 as? NativeGameplayViewController}
            for game in games {
                guard let scene=game.boardScene,paintHookIDs.insert(ObjectIdentifier(scene)).inserted else{continue}
                let hook=NativeRestartRenderHook(scene:scene,previous:scene.onRenderSurfacePreparation,first:scene.onFirstBoardFrame);paintHooks.append(hook)
                scene.onRenderSurfacePreparation = {[weak scene] in
                    hook.previous?();guard scene != nil else{return};samplePaint("render")
                }
                scene.onFirstBoardFrame = {[weak scene,weak game] in
                    // Original VC receipt first retires old coverage. Scene's
                    // dormant Restart wave resumes only after this returns.
                    hook.first?();guard let scene,let game else{return};samplePaint("handoff")
                    guard scene !== oldScene,!handoffInterrupted else{return}
                    if pauseAtHandoff {
                        handoffInterrupted=true;handoffPausedAt=CACurrentMediaTime()
                        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                    } else if exitAtHandoff {
                        handoffInterrupted=true
                        game.animateRestartExit{handoffExitResult=$0}
                    }
                }
            }
            let incoming=games.first{$0 !== old}
            if incoming != nil {
                requirePaint(oldScene.hasCompletedBoardExit,key:"incoming-before-exit",message:"Incoming generation mounted before the full old board exit receipt")
                requirePaint(oldBoardNodes.allSatisfy{$0.alpha<0.01 || abs($0.xScale)<0.001 || abs($0.yScale)<0.001},key:"old-dice-not-retired",message:"Old playable/locked holders remained visibly painted when the incoming board mounted")
            }
            // The retained old view is actual coverage until replacement's
            // existing first-frame receipt removes it. Never count both models
            // as if two opaque UIKit boards were simultaneously on screen.
            guard let displayed=old.parent != nil ? old:incoming,let scene=displayed.boardScene,
                  let render=scene.gameplayRenderHost,render.renderView.window != nil,
                  !render.renderView.isHidden,displayed.view.alpha>0.001 else{return}
            let fresh=displayed !== old,points=chrome(displayed)
            for name in fixedNames {
                guard let expected=fixedChrome[name],let actual=points[name] else{requirePaint(false,key:"missing-"+name,message:"Fixed chrome disappeared from a mounted Restart frame: "+name);continue}
                requirePaint(hypot(actual.point.x-expected.point.x,actual.point.y-expected.point.y)<0.1,key:"anchor-"+name,message:"Restart/New Game moved fixed chrome across a painted frame: "+name)
                requirePaint(abs(actual.alpha-expected.alpha)<0.01,key:"alpha-"+name,message:"Restart/New Game flashed fixed chrome during the replacement gap: "+name)
            }
            var scale:CGFloat=0,rawScale:CGFloat=0
            var paintedDiceCount=0,hiddenDiceCount=0
            if fresh {
                let nodes=displayed.engine.state.tiles.filter{$0.value>0 && !$0.locked}.compactMap{scene.sourceNativeTileNode($0.id)}
                rawScale=nodes.map{max(abs($0.sourceLocalScale.x),abs($0.sourceLocalScale.y))}.max() ?? 0
                // Constructor-held roots can legitimately retain local scale1.
                // Measure painted geometry through the actual ancestor chain,
                // while keeping raw scale in evidence to expose that distinction.
                let painted=nodes.filter{nodeAlpha($0)>0.001}
                paintedDiceCount=painted.count;hiddenDiceCount=nodes.count-painted.count
                scale=painted.map{max(abs($0.sourceLocalScale.x),abs($0.sourceLocalScale.y))}.max() ?? 0
                if phase=="render" {paintSamples+=1}
                if phase=="handoff" {
                    incomingWavePaintEpoch=sampleTime
                    incomingHandoffSamples+=1
                    requirePaint(scale<0.001,key:"handoff-already-grown",message:"Actual first-visible handoff must retain zero-pose dice before the Source wave starts")
                }
                if let epoch=incomingWavePaintEpoch,sampleTime-epoch<0.04 {
                    // Existing20ms delay +180ms grow cannot reach this scale
                    // within40ms, even allowing8ms callback scheduling variance.
                    requirePaint(scale<0.8,key:"entry-clock-catchup",message:"Incoming Source wave consumed time from before its visible handoff")
                }
                if incomingRenderSerials.insert(scene.freshFaceRenderSerial).inserted,firstIncomingPaintScales.count<3 {firstIncomingPaintScales.append(scale)}
                if incomingVisibleSamples==0 {
                    requirePaint(scale<0.35,key:"incoming-already-grown",message:"First visible incoming board had already consumed its entry wave under the old cover")
                    requirePaint(scene.size==render.renderView.bounds.size,key:"initial-scene-size",message:"First incoming paint used pre-mount Scene geometry")
                    requirePaint(displayed.view.safeAreaInsets==window.safeAreaInsets,key:"initial-safe-area",message:"First incoming paint used a stale safe-area inset")
                    firstIncomingGeometry=(scene.size,displayed.view.safeAreaInsets,Dictionary(uniqueKeysWithValues:nodes.map{($0.tileID,$0.sourceGeometryScale)}))
                }
                incomingVisibleSamples+=1
            }
            if paintRows.count<3000 {
                paintRows.append(["phase":phase,"time":sampleTime,"wallMilliseconds":Date().timeIntervalSince1970*1000,"generation":displayed.engine.state.generation,"incoming":fresh,"oldExitComplete":oldScene.hasCompletedBoardExit,"maxActiveDieScale":scale,"maxRawActiveDieScale":rawScale,"paintedDiceCount":paintedDiceCount,"hiddenDiceCount":hiddenDiceCount,"renderSerial":scene.freshFaceRenderSerial,"safeTop":displayed.view.safeAreaInsets.top,"sceneWidth":scene.size.width,"sceneHeight":scene.size.height,"chrome":points.mapValues{["x":$0.point.x,"y":$0.point.y,"alpha":$0.alpha]}])
            }
        }
        if auditPaintFrames {paintSampler.onFrame={samplePaint("display")};samplePaint("before-tap");paintSampler.start()}
        defer {
            paintSampler.stop()
            for hook in paintHooks {if let scene=hook.scene,scene.gameplayRenderHost != nil {scene.onRenderSurfacePreparation=hook.previous;scene.onFirstBoardFrame=hook.first}}
            if auditPaintFrames {
                let suffix=(board == nil ? "arcade-new-game":"journey-restart")+(backgroundRestart ? "-background":disposeAtPreparation ? "-dispose":pauseAtHandoff ? "-handoff-background":exitAtHandoff ? "-handoff-exit":"")
                do {
                    let data=try JSONSerialization.data(withJSONObject:paintRows,options:[.sortedKeys])
                    try data.write(to:URL(fileURLWithPath:"/tmp/native-restart-"+suffix+"-paint-audit.json"))
                } catch {XCTFail("Unable to save per-paint Restart evidence: \(error)")}
            }
        }
        // Use the genuine owner action after its ready admission. Double input
        // must not construct two fresh generations.
        let durableBeforeRestart=try Data(contentsOf:directory.appendingPathComponent("state-v1.json"))
        restart.sendActions(for:.touchUpInside);restart.sendActions(for:.touchUpInside)
        if backgroundRestart {
            let closed=try XCTUnwrap(modal.onClosed);var backgrounded=false
            modal.onClosed={
                closed()
                NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                backgrounded=true
            }
            try await wait{backgrounded}
            try await Task.sleep(for:.milliseconds(300))
            XCTAssertTrue(app.children.contains{$0 === old})
            XCTAssertTrue(old.sourceScope?.current==true)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        }
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
            if auditPaintFrames {
                XCTAssertFalse(paintRows.contains{($0["incoming"] as? Bool)==true},"Disposed preparation must never paint a successor")
                XCTAssertTrue(paintFailures.isEmpty)
            }
            return
        }
        var sawOldExit=false
        try await wait{
            if old.boardScene?.childNode(withName:"//native-game-hud")?.action(forKey:"hud-exit") != nil {
                sawOldExit=true
                if let combo=old.boardScene?.childNode(withName:"//preload-navigation-hud-2"),combo.alpha>0.001 {
                    XCTAssertTrue(old.sourceScope?.current==true,"Successor construction must wait for full board exit, including tiles and chrome")
                }
            }
            return app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{$0 !== old}==true
        }
        XCTAssertTrue(sawOldExit,"Journey Restart and Arcade New Game both wait for old board/chrome exit")
        let fresh=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        timeoutDiagnostic = {[weak fresh] in
            guard let fresh else{return "fresh released"}
            return "\(fresh.sourceEntryDiagnostic());failure=\(String(describing:fresh.sourcePresentationFailureGeneration));construction=\(fresh.sourceInitialConstruction?.isCurrent == true);faces=\(fresh.sourceInitialConstruction?.pendingFaceCount ?? -1);entry=\(fresh.boardScene?.isBoardEntryComplete == true);completed=\(fresh.boardScene?.completedSourceBoardEntry != nil);stateIssues=\(fresh.engine.state.validationIssues())"
        }
        defer{timeoutDiagnostic=nil}
        XCTAssertFalse(containsAnnouncement(fresh),"Exit Restart must not mount an announcement before the fresh board's entry")
        XCTAssertFalse(fresh.incomingOriginalThemedCoverExpected)
        XCTAssertFalse(fresh.keepsGameplayChromeVisibleOnEntry)
        XCTAssertTrue(fresh.replaysRestartChrome)
        XCTAssertEqual(fresh.boardScene?.replaysRestartChrome,true)
        XCTAssertTrue(try XCTUnwrap(fresh.sourceInitialConstruction).borrowedPreparedFoundation,"A cold restart must adopt the asynchronously prepared resource owner before constructor draws")
        XCTAssertEqual(fresh.engine.state.generation,oldGeneration+1);XCTAssertEqual(fresh.engine.state.board,board ?? 1)
        XCTAssertEqual(fresh.engine.state.moves,50);XCTAssertEqual(fresh.engine.state.score,0)
        XCTAssertTrue(fresh.engine.state.tiles.allSatisfy{$0.id != saved.tiles.first?.id})
        if exitAtHandoff {
            try await wait{handoffExitResult != nil}
            XCTAssertTrue(handoffInterrupted);XCTAssertEqual(handoffExitResult,true)
            let scene=try XCTUnwrap(fresh.boardScene)
            XCTAssertTrue(scene.hasCompletedBoardExit)
            XCTAssertFalse(scene.restartEntryHandoffReleased)
            XCTAssertNil(scene.completedSourceBoardEntry)
            try await Task.sleep(for:.milliseconds(150))
            XCTAssertFalse(scene.restartEntryHandoffReleased,"A later rendered frame cannot revive an exited dormant wave")
            XCTAssertNil(scene.completedSourceBoardEntry);XCTAssertTrue(paintFailures.isEmpty)
            return
        }
        var sawAnnouncement=false,sawChromeReplay=false
        try await wait{
            if pauseAtHandoff,let paused=handoffPausedAt,!handoffResumed,CACurrentMediaTime()-paused>=0.15 {
                let scene=fresh.boardScene
                XCTAssertFalse(scene?.restartEntryHandoffReleased ?? true)
                let nodes=fresh.engine.state.tiles.filter{$0.value>0 && !$0.locked}.compactMap{scene?.sourceNativeTileNode($0.id)}
                XCTAssertTrue(nodes.allSatisfy{nodeAlpha($0)<=0.001 || (abs($0.sourceLocalScale.x)<0.001 && abs($0.sourceLocalScale.y)<0.001)},"Background callback must hold unpainted zero-pose entry")
                handoffResumed=true
                incomingWavePaintEpoch=CACurrentMediaTime()
                NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            }
            sawAnnouncement = sawAnnouncement || self.containsAnnouncement(fresh)
            if let chrome=fresh.boardScene?.boardChromeReceipt {
                sawChromeReplay = sawChromeReplay || chrome.offset != 0 || chrome.alpha != 1
            }
            return fresh.boardScene?.completedSourceBoardEntry != nil && fresh.boardScene?.gameplayRenderHost?.renderView.window != nil &&
                fresh.boardScene?.isBoardEntryComplete==true && fresh.beforeSourceGameplayAdmission==nil
        }
        if auditPaintFrames {
            samplePaint("settled")
            XCTAssertGreaterThanOrEqual(incomingRenderSerials.count,3,"Audit must observe at least three distinct incoming renderer updates")
            XCTAssertGreaterThan(paintSamples,0,"Audit must wrap the actual incoming Scene paint boundary")
            XCTAssertEqual(incomingHandoffSamples,1,"Audit must observe exactly one first-visible old-to-new handoff")
            if pauseAtHandoff {XCTAssertTrue(handoffInterrupted);XCTAssertTrue(handoffResumed)}
            let initial=try XCTUnwrap(firstIncomingGeometry),scene=try XCTUnwrap(fresh.boardScene)
            XCTAssertEqual(initial.0,scene.size);XCTAssertEqual(initial.1,fresh.view.safeAreaInsets)
            for (id,scale) in initial.2 {if let node=scene.sourceNativeTileNode(id) {XCTAssertEqual(node.sourceGeometryScale,scale,accuracy:0.00001,"Incoming die geometry changed after its first visible paint")}}
            XCTAssertTrue(paintFailures.isEmpty,"Per-paint Restart audit: \(paintFailures.sorted())")
            print("RESTART_PAINT_PROOF board=\(String(describing:board)) incomingSamples=\(incomingVisibleSamples) renders=\(paintSamples) uniquePaints=\(incomingRenderSerials.count) firstThreeScales=\(firstIncomingPaintScales) rows=\(paintRows.count)")
        }
        XCTAssertFalse(sawAnnouncement,"Journey/Arcade Exit Restart must stay announcement-free throughout actual entry readiness")
        XCTAssertFalse(sawChromeReplay,"HUD carrier must stay fixed while the finite mask and selected groups enter")
        XCTAssertFalse(fresh.engine.state.tiles.contains(where: \.isWild),"Restart must wait for the earned Backpack drop")

        if let footer=fresh.journeyBottomDecor {
            XCTAssertEqual(footer.phase,.visible);XCTAssertFalse(footer.hasActiveClock)
        }
        XCTAssertNil(old.parent,"Only the ready incoming board may retire the covered previous board")
        XCTAssertFalse(containsAnnouncement(fresh))
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(app.children.contains{$0 === fresh})
        let durable=try XCTUnwrap(store.load())
        XCTAssertTrue(durable.progression.firstPlayTutorialComplete)
        if let board {XCTAssertNil(durable.journeyRuns[board])}
        else {XCTAssertNil(durable.arcadeRun)}
    }
}

@MainActor private final class NativeRestartPaintSampler:NSObject {
    var onFrame:(()->Void)?
    private var link:CADisplayLink?
    func start(){guard link==nil else{return};let value=CADisplayLink(target:self,selector:#selector(frame(_:)));value.preferredFrameRateRange=CAFrameRateRange(minimum:60,maximum:60,preferred:60);link=value;value.add(to:.main,forMode:.common)}
    @objc private func frame(_ link:CADisplayLink){onFrame?()}
    func stop(){link?.invalidate();link=nil;onFrame=nil}
}
@MainActor private final class NativeRestartRenderHook {
    weak var scene:NativeBoardScene?
    let previous:(()->Void)?
    let first:(()->Void)?
    init(scene:NativeBoardScene,previous:(()->Void)?,first:(()->Void)?){self.scene=scene;self.previous=previous;self.first=first}
}

/// Incident board captured before the 2026-10-19 Spaceship freeze. This mounts
/// the normal standalone graph, including physical verification and UIKit finale.
@MainActor final class NativeSpaceshipPostMergeInputTests:XCTestCase {
    func testSavedJourney24SpaceshipIntoLowerDieThenActualOrdinaryStack()async throws {
        try await exercise(reversed:false)
    }
    func testSavedJourney24LowerDieIntoSpaceshipThenActualOrdinaryStack()async throws {
        try await exercise(reversed:true)
    }
    func testActualLandedLaserCarrierSurvivesOverlappingSpaceshipAndNextStack()async throws {
        try await exercise(reversed:false,overlappingCarrier:true)
    }
    func testBookkeptLaserAcceptsOrdinaryBeforeWallUnlockWithoutGhostOrFrozenStack()async throws {
        try await exercise(reversed:false,overlappingCarrier:true,consumeBookkeptCarrier:true)
    }
    private func incidentBoard()->NativeBoardState {
        let rows:[(String,Int,Int,Int)]=[
            ("g1-0",0,0,4),("g1-5",0,1,1),("g1-7",2,1,2),("g1-10",0,2,0),
            ("g1-11",1,2,2),("g1-12",2,2,0),("g1-17",2,3,0),("g1-19",4,3,0),
            ("g1-21",1,4,5),("g1-22",2,4,3),("g1-23",3,4,0),("g1-25",0,5,0),
            ("g1-26",1,5,0),("g1-30",0,6,2),("g1-33",3,6,0),("g1-36",1,7,1),
            ("g1-15",0,3,6),("native:1:18:2:5:die:3",2,5,3),
            ("native:1:18:1:0:die:4:locked",1,0,0),("native:1:18:0:8:die:5:locked",0,8,0),
            ("native:1:18:4:0:die:6:locked",4,0,0),("native:1:18:3:3:die:7:locked",3,3,0),
            ("native:1:18:4:6:die:8:locked",4,6,0),("native:1:18:4:8:die:9:locked",4,8,0),
            ("native:1:18:2:8:die:10:locked",2,8,0),("native:1:18:1:8:die:11:locked",1,8,0),
            ("native:1:18:2:0:die:12:locked",2,0,0)]
        let tiles=rows.map{id,x,y,value in NativeTile(id:id,cell:.init(column:x,row:y),value:value,
            archetype:id=="g1-15" ? .magnet:nil,variant:id=="g1-15" ? "spaceship":nil,
            locked:value==0,alpha:value==0 && id.hasPrefix("native:") ? 0.25:1)}
        return NativeBoardState(tiles:tiles,mode:.journey,board:24,stage:24,generation:1,revision:18,
            moves:32,score:1996,bestScore:49045,maxStackDepth:3,longestCombo:18,cubesCracked:10,
            combo:18,earnedComboBonus:3900,wildMeter:0.864,wildSpawnCount:2,
            lastWildDropType:.magnet,wildDropTypeStreak:1,lastSpecialMergeWorld:"area55")
    }
    private func diagnostic(_ game:NativeGameplayViewController)->String {
        guard let scene=game.boardScene else{return "no scene"}
        let tiles=game.engine.state.tiles.map{tile -> String in
            guard let node=scene.sourceNativeTileNode(tile.id) else{return "\(tile.id):missing"}
            return "\(tile.id):core=\(tile.value)/\(tile.stackDepth)/\(tile.locked),node=\(node.sourceValue)/\(node.sourceStackDepth)/\(node.sourceEventMode),point=\(node.position),stackFrames=\(node.sourcePendingStackFrameCount)"
        }.joined(separator:";")
        return "failure=\(String(describing:game.sourcePresentationFailure));flags=\(game.engine.flags);special=\(String(describing:game.engine.pendingSpecial?.id));unsavable=\(game.engine.hasUnsavableSourceGameplayState);survivorInput=\(scene.sourceMagnetSurvivorPendingInputIDs);\(tiles)"
    }
    private func wait(_ label:String,game:NativeGameplayViewController?=nil,seconds:Double=15,_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(seconds)
        while !condition() {
            if Date()>deadline {XCTFail("\(label): \(game.map{diagnostic($0)} ?? "route not ready")");throw NSError(domain:"SpaceshipPostMergeTimeout",code:1)}
            try await Task.sleep(for:.milliseconds(20))
        }
    }
    private func move(_ source:String,onto destination:String,game:NativeGameplayViewController)async throws {
        let scene=try XCTUnwrap(game.boardScene),a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(destination))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        guard scene.beginDrag(at:from) else{XCTFail("pickup rejected: \(diagnostic(game))");throw NSError(domain:"SpaceshipPickupRejected",code:1)}
        scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        let result=try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime()))
        XCTAssertTrue(result.accepted,"\(result.resolution.reason): \(diagnostic(game))")
        guard result.accepted else{throw NSError(domain:"SpaceshipDropRejected",code:1)}
    }
    private func exercise(reversed:Bool,overlappingCarrier:Bool=false,consumeBookkeptCarrier:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-spaceship-incident-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1...23)
        var saved=incidentBoard();if overlappingCarrier {saved.wildMeter=0.95};seed.journeyRuns[24]=saved;seed.journeyRunSavedAt[24]=Date().timeIntervalSince1970;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{overlappingCarrier ? 0.99:0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("Home"){!app.home.isHidden}
        app.navigate(.world(3),interrupt:true)
        try await wait("Journey Continue"){
            if app.children.contains(where:{$0 is NativeGameplayViewController}){return true}
            app.world?.onRequest?("continue",24);return false
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        try await wait("real entry",game:game){game.beforeSourceGameplayAdmission==nil && game.boardScene?.isBoardEntryComplete==true && !game.engine.hasUnsavableSourceGameplayState}
        let scene=try XCTUnwrap(game.boardScene)
        var survivorID=reversed ? "g1-15":"g1-36"
        var carrierID:String?,overlapAccepted=false,magnetCommitted=false
        let receiptObserver=scene.onGameplayReceipt
        scene.onGameplayReceipt={event,source,destination,generation in
            receiptObserver?(event,source,destination,generation)
            if event.kind == .specialBoardCommitted && event.archetype == (consumeBookkeptCarrier ? .tnt:.magnet) {magnetCommitted=true}
        }
        defer{scene.onGameplayReceipt=receiptObserver}
        if overlappingCarrier {
            let original=scene.onGameplayReceipt
            scene.onGameplayReceipt={event,source,destination,generation in
                original?(event,source,destination,generation)
                guard event.kind == (consumeBookkeptCarrier ? .meterDropCompleted:.meterDropLanded),carrierID==nil,
                      let drop=game.engine.meterDropReservations.values.first(where:{$0.tileID==event.tileIDs.first}) else{return}
                carrierID=drop.tileID
                XCTAssertEqual(drop.variant,"laser-gun")
                XCTAssertTrue(drop.landed);XCTAssertEqual(drop.bookkeepingCommitted,consumeBookkeptCarrier);XCTAssertTrue(drop.handoffLocked)
                let candidates=game.engine.state.tiles.filter{$0.isPlayable && !$0.isWild && $0.id != drop.tileID}
                let target=candidates.min{a,b in
                    let ax=a.cell.column-drop.cell.column,ay=a.cell.row-drop.cell.row,bx=b.cell.column-drop.cell.column,by=b.cell.row-drop.cell.row
                    return ax*ax+ay*ay < bx*bx+by*by
                }
                guard let target,let ship=scene.sourceNativeTileNode(consumeBookkeptCarrier ? target.id:"g1-15"),let dst=scene.sourceNativeTileNode(consumeBookkeptCarrier ? drop.tileID:target.id),let sp=ship.parent,let dp=dst.parent else{XCTFail("missing overlap nodes");return}
                survivorID=consumeBookkeptCarrier ? drop.tileID:target.id
                let from=scene.convert(ship.position,from:sp),to=scene.convert(dst.position,from:dp)
                guard scene.beginDrag(at:from) else{XCTFail("landed carrier overlap pickup: \(self.diagnostic(game))");return}
                scene.moveDrag(to:to,now:CACurrentMediaTime())
                overlapAccepted=scene.finishDrag(at:to,now:CACurrentMediaTime())?.accepted==true
                XCTAssertTrue(overlapAccepted,self.diagnostic(game))
                XCTAssertEqual(game.engine.pendingSpecial?.archetype,consumeBookkeptCarrier ? .tnt:.magnet,self.diagnostic(game))
                XCTAssertFalse(game.engine.pendingSpecial?.targets.contains{$0.id==drop.tileID} ?? false,"Carrier is not a collateral target")
            }
            defer{scene.onGameplayReceipt=original}
            try await move("g1-5",onto:"g1-7",game:game)
            try await wait("real landed Laser overlap",game:game){carrierID != nil}
            XCTAssertTrue(overlapAccepted,diagnostic(game))
        } else {
            try await move(reversed ? "g1-36":"g1-15",onto:survivorID,game:game)
        }
        try await wait("Magnet board commit",game:game){magnetCommitted || game.sourcePresentationFailure != nil}
        XCTAssertNil(game.sourcePresentationFailure,diagnostic(game))
        // Use the actual survivor while decorative/helper tails may still run.
        if let carrierID {
            try await wait("real Laser finally",game:game){!game.engine.meterDropReservations.values.contains{$0.tileID==carrierID}}
            if !consumeBookkeptCarrier {
                XCTAssertNotNil(game.engine.state.tiles.first{$0.id==carrierID},diagnostic(game))
                XCTAssertNotNil(scene.sourceNativeTileNode(carrierID),diagnostic(game))
            }
            XCTAssertNotNil(scene.captureSourceMagnetPhysicalTiles(),diagnostic(game))
        }
        if overlappingCarrier {
            let ordinary=game.engine.state.tiles.filter{!$0.isWild && $0.isPlayable}
            if let destination=ordinary.first(where:{a in ordinary.contains{b in a.id != b.id && a.value+b.value<6}}) {survivorID=destination.id}
        }
        let survivor=try XCTUnwrap(game.engine.state.tiles.first{$0.id==survivorID},diagnostic(game))
        let other=try XCTUnwrap(game.engine.state.tiles.first{$0.id != survivorID && !$0.isWild && $0.isPlayable && $0.value+survivor.value<6},diagnostic(game))
        let expected=other.value+survivor.value
        try await move(other.id,onto:survivorID,game:game)
        try await wait("post-Spaceship stack settles",game:game){
            guard let node=scene.sourceNativeTileNode(survivorID) else{return false}
            return node.sourceValue==expected && node.sourcePendingStackFrameCount==0 && !game.engine.hasUnsavableSourceGameplayState
        }
        XCTAssertNil(game.sourcePresentationFailure,diagnostic(game))
        XCTAssertFalse(game.engine.flags.wildMagnetPullInProgress,diagnostic(game))
        XCTAssertNotNil(scene.captureSourcePhysicalBoard(),"\(scene.sourcePhysicalBoardCaptureDiagnostic);\(diagnostic(game))")
        XCTAssertTrue(scene.sourceMagnetSurvivorPendingInputIDs.isEmpty,diagnostic(game))
        XCTAssertEqual(game.engine.state.tiles.first{$0.id==survivorID}?.value,expected)
        try await wait("durable post-Spaceship stack",game:game){(try? store.load()?.journeyRuns[24]?.tiles.first{$0.id==survivorID}?.value)==expected}
    }
}
