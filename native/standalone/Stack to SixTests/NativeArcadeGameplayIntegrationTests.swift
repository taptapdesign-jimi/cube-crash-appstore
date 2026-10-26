import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeArcadeGameplayIntegrationTests: XCTestCase {
    @MainActor private final class Fixture {
        let directory:URL,store:NativeSaveStore,host:NativeStandaloneViewController,window:UIWindow
        let previous:UIWindow?
        init(variant:NativeArcadeVariant,tiles:[NativeTile],meter:Double,random:Double=0.1,board:Int=3,luckyDropUsed:Bool=false,lastSpecialMergeWorld:String?=nil) throws {
            directory=FileManager.default.temporaryDirectory.appendingPathComponent("arcade-integration-"+UUID().uuidString)
            store=NativeSaveStore(directory:directory)
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            seed.progression.firstPlayTutorialComplete=true
            seed.activeArcadeVariant=variant
            seed.arcadeRun = .init(tiles:tiles,mode:.arcade,board:board,stage:board,generation:9,moves:37,score:123,wildMeter:meter,arcadeVariant:variant)
            seed.arcadeRun?.luckyDropUsed=luckyDropUsed
            seed.arcadeRun?.lastSpecialMergeWorld=lastSpecialMergeWorld
            seed.arcadeRunSavedAt=Date().timeIntervalSince1970
            try store.save(seed)
            host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{random},completeNativeGameplayEnabled:true)
            previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
            host.loadViewIfNeeded()
        }
        var game:NativeGameplayViewController? {host.children.compactMap{$0 as? NativeAppController}.first?.children.compactMap{$0 as? NativeGameplayViewController}.first}
        func dispose(){host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
    }
    private func wait(_ label:String,_ predicate:()->Bool) async throws {
        let deadline=Date().addingTimeInterval(30)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    private func enter(_ f:Fixture) async throws -> NativeGameplayViewController {
        let app=try XCTUnwrap(f.host.children.first as? NativeAppController)
        try await wait("Home ready"){!app.home.isHidden}
        app.navigate(.gameplay,interrupt:true)
        try await wait("Source board admitted"){f.game?.boardScene?.isBoardEntryComplete==true && f.game?.beforeSourceGameplayAdmission==nil && f.game?.engine.hasUnsavableSourceGameplayState==false}
        return try XCTUnwrap(f.game)
    }
    private func merge(_ scene:NativeBoardScene,source:String,target:String) async throws {
        let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
    }
    func testPureDiceStuckFiveTwoFivePresentsNoMoves() async throws {
        let f=try Fixture(variant:.pureDice,tiles:[
            .init(id:"g5-22",cell:.init(column:2,row:4),value:5,stackDepth:2,locked:false,alpha:1),
            .init(id:"native:5:26:0:6:die:1",cell:.init(column:0,row:6),value:2,stackDepth:1,locked:false,alpha:1),
            .init(id:"native:5:28:4:8:die:2",cell:.init(column:4,row:8),value:5,stackDepth:1,locked:false,alpha:1)
        ],meter:0,board:1)
        defer{f.dispose()}
        let game=try await enter(f),scene=try XCTUnwrap(game.boardScene)
        try await Task.sleep(for:.seconds(7))
        try await wait("Fail result: " + scene.sourceLevelEndDiagnostic()){game.presentedViewController is NativeResultController}
        XCTAssertFalse(try XCTUnwrap(game.presentedViewController as? NativeResultController).clean)
        XCTAssertFalse(game.hasPresentedBoardCleared)
    }
    func testArcadeLossAfterClearedRoundPresentsCleanRunSummaryWithoutAdvancing() async throws {
        for variant in [NativeArcadeVariant.slowBurn,.pureDice] {
            for board in [1,2,5] {
                let f=try Fixture(variant:variant,tiles:[
                    .init(id:"five-a",cell:.init(column:2,row:4),value:5,stackDepth:2),
                    .init(id:"two",cell:.init(column:0,row:6),value:2),
                    .init(id:"five-b",cell:.init(column:4,row:8),value:5)
                ],meter:0,board:board)
                defer{f.dispose()}
                let game=try await enter(f),scene=try XCTUnwrap(game.boardScene)
                try await wait("Terminal summary \(variant.rawValue) stage \(board): " + scene.sourceLevelEndDiagnostic()){
                    game.presentedViewController is NativeResultController
                }
                let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
                XCTAssertEqual(result.clean,board>1,"Only a run with a cleared round earns the clean summary")
                XCTAssertEqual(result.finalScore,123)
                XCTAssertEqual(result.combo,0)
                XCTAssertEqual(result.efficiency,0)
                XCTAssertNotEqual(game.engine.state.terminal?.kind,.complete,"Presentation cannot turn a loss into a completed round")
                XCTAssertFalse(result.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
                // Exercise the full finite result timeline; it must expose run-end CTAs,
                // never the automatic next-round handoff used by a genuine clear.
                result.tick(0)
                for frame in 1...600 {result.tick(Double(frame)/60)}
                XCTAssertTrue(f.game === game)
                XCTAssertEqual(game.engine.state.board,board)
                let saved=try XCTUnwrap(f.store.load())
                XCTAssertNil(saved.pendingArcadeRound)
                XCTAssertNil(saved.arcadeRun)
                XCTAssertEqual(saved.progression.arcadeStats(for:variant).highScore,123)
                XCTAssertLessThanOrEqual(saved.progression.arcadeStats(for:variant).highestStageOpened,board)
                XCTAssertTrue(saved.progression.completedJourneyBoards.isEmpty)
                XCTAssertTrue(saved.progression.boardStats.isEmpty)
                XCTAssertEqual(saved.progression.highestUnlockedJourneyBoard,1)
            }
        }
    }
    func testArcadeCleanRunThemeUsesLastSpecialWorldInsteadOfRoundNumber() async throws {
        let cases:[(String?,NativeResultCelebrationTheme)]=[(nil,.area55),("forest",.forest),("beach",.beach),("area55",.area55)]
        for (world,expected) in cases {
            let f=try Fixture(variant:.slowBurn,tiles:[
                .init(id:"five-a",cell:.init(column:2,row:4),value:5,stackDepth:2),
                .init(id:"two",cell:.init(column:0,row:6),value:2),
                .init(id:"five-b",cell:.init(column:4,row:8),value:5)
            ],meter:0,board:2,lastSpecialMergeWorld:world)
            defer{f.dispose()}
            let game=try await enter(f)
            try await wait("Last-special-world clean summary"){game.presentedViewController is NativeResultController}
            let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
            XCTAssertTrue(result.clean)
            XCTAssertEqual(result.celebrationTheme,expected)
            XCTAssertEqual(result.finalScore,123)
            XCTAssertEqual(game.engine.state.lastSpecialMergeWorld,world)
        }
    }
    func testPureDiceMergeSixRefillToFivePresentsNoMoves() async throws {
        let f=try Fixture(variant:.pureDice,tiles:[
            .init(id:"five",cell:.init(column:2,row:4),value:5,stackDepth:2),
            .init(id:"two",cell:.init(column:0,row:6),value:2),
            .init(id:"a",cell:.init(column:3,row:8),value:3),
            .init(id:"b",cell:.init(column:4,row:8),value:3)
        ],meter:0,random:0.99,board:1)
        defer{f.dispose()}
        let game=try await enter(f),scene=try XCTUnwrap(game.boardScene)
        try await merge(scene,source:"a",target:"b")
        try await Task.sleep(for:.seconds(7))
        XCTAssertEqual(game.engine.state.activeTiles.map(\.value).sorted(),[2,5,5])
        try await wait("Fail result: " + scene.sourceLevelEndDiagnostic()){game.presentedViewController is NativeResultController}
        XCTAssertFalse(try XCTUnwrap(game.presentedViewController as? NativeResultController).clean)
    }
    func testCrateRetainsMountedGameplayHUD() async throws {
        func closeButton(in view:UIView)->UIControl? {
            if view.accessibilityIdentifier=="native.gameplay.backpack.close" {return view as? UIControl}
            return view.subviews.lazy.compactMap{closeButton(in:$0)}.first
        }
        for variant in [NativeArcadeVariant.endurance,.slowBurn] {
            let f=try Fixture(variant:variant,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:1),.init(id:"c",cell:.init(column:4,row:8),value:3)],meter:0.4)
            defer{f.dispose()}
            let game=try await enter(f),scene=try XCTUnwrap(game.boardScene)
            let before=game.engine.state
            let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help"))
            // Source board admission precedes the final HUD entrance. Opening
            // here used to reset its custom action to alpha0/y140 and freeze it.
            XCTAssertTrue(scene.boardChromeReceipt.entering)
            for opening in 0..<2 {
                XCTAssertTrue(scene.handleHUDContact(at:help.convert(CGPoint.zero,to:scene)))
                try await wait("Crate admitted"){game.presentedViewController?.view.isUserInteractionEnabled==true}
                try await wait("HUD settled behind Crate"){scene.boardChromeReceipt.alpha==1 && scene.boardChromeReceipt.offset==0 && !scene.boardChromeReceipt.entering}
                let surface=try XCTUnwrap(scene.gameplayRenderHost)
                try await wait("Finite HUD work stopped"){surface.renderingPaused}
                XCTAssertTrue(scene.isPaused)
                XCTAssertEqual(game.engine.state,before)
                if opening==0 {
                    let image=UIGraphicsImageRenderer(bounds:f.window.bounds).image{_ in f.window.drawHierarchy(in:f.window.bounds,afterScreenUpdates:true)}
                    let attachment=XCTAttachment(image:image);attachment.name="Actual \(variant.rawValue) Crate HUD";attachment.lifetime = .keepAlways;add(attachment)
                    try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/actual-crate-hud-\(variant.rawValue).png"))
                }
                let modal=try XCTUnwrap(game.presentedViewController)
                try XCTUnwrap(closeButton(in:modal.view)).sendActions(for:.touchUpInside)
                try await wait("Crate closed and same board resumed"){game.presentedViewController==nil && !scene.isPaused && !surface.renderingPaused}
                XCTAssertTrue(game.boardScene === scene)
                XCTAssertEqual(game.engine.state,before)
                XCTAssertEqual(scene.boardChromeReceipt.alpha,1)
                XCTAssertEqual(scene.boardChromeReceipt.offset,0)
            }
        }
    }
    func testSlowBurnActualFinalMergePersistsChargeAndNextSourceRoundRestoresIt() async throws {
        let f=try Fixture(variant:.slowBurn,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3),.init(id:"b",cell:.init(column:1,row:0),value:3)],meter:0.63,lastSpecialMergeWorld:"beach")
        defer{f.dispose()}
        let old=try await enter(f),scene=try XCTUnwrap(old.boardScene)
        XCTAssertTrue(scene.sourceTutorialMeterHUDReady)
        func assertSavedFill()throws {
            let loader=try XCTUnwrap(scene.childNode(withName:"//wildLoader"))
            let track=try XCTUnwrap(loader.children.compactMap{$0 as? SKShapeNode}.first?.path)
            let fill=try XCTUnwrap(loader.childNode(withName:"//wildMeterFillBounceLayer")?.children.compactMap{$0 as? SKShapeNode}.first?.path)
            XCTAssertEqual(fill.boundingBox.width,track.boundingBox.width*0.63,accuracy:0.001,"Arcade saved charge appears before a merge")
            XCTAssertEqual(old.engine.state.wildMeter,0.63,accuracy:0.000001)
        }
        try assertSavedFill()
        let originalSize=scene.size
        scene.layout(size:CGSize(width:originalSize.width+8,height:originalSize.height),insets:.zero)
        try assertSavedFill()
        scene.layout(size:originalSize,insets:f.window.safeAreaInsets)
        try assertSavedFill()
        var clearProgress:[Double]=[],voices=0
        let progress=scene.onFinalMergeProgress,voice=old.onRoundWon
        scene.onFinalMergeProgress={seconds,duration,generation in clearProgress.append(seconds/duration);progress?(seconds,duration,generation)}
        old.onRoundWon={generation in voices += 1;voice?(generation)}
        try await merge(scene,source:"a",target:"b")
        try await wait("Actual ordinary clear-card entry"){voices>0}
        XCTAssertEqual(voices,1);XCTAssertFalse(clearProgress.isEmpty,"Ordinary finale completion remains observed independently of immediate celebration")
        if let first=clearProgress.first {XCTAssertGreaterThanOrEqual(first,0.85);XCTAssertLessThan(first,1.05)}
        XCTAssertTrue(old.hasPresentedBoardCleared)
        try await wait("Clean result"){old.presentedViewController is NativeResultController}
        let result=try XCTUnwrap(old.presentedViewController as? NativeResultController)
        XCTAssertTrue(result.clean)
        try await wait("Durable Slow Burn pending round"){(try? f.store.load()?.pendingArcadeRound?.round)==4}
        let pending=try XCTUnwrap(f.store.load()?.pendingArcadeRound)
        XCTAssertEqual(try XCTUnwrap(pending.meterProgress),0.63,accuracy:0.000001)
        XCTAssertEqual(pending.score,result.finalScore)
        XCTAssertEqual(pending.lastSpecialMergeWorld,"beach")
        try await wait("Next Source controller"){f.game.map{$0 !== old}==true}
        let next=try XCTUnwrap(f.game)
        XCTAssertNotNil(next.sourceInitialConstruction)
        XCTAssertEqual(next.engine.state.effectiveArcadeVariant,.slowBurn)
        XCTAssertEqual(next.engine.state.board,4)
        XCTAssertEqual(next.engine.state.lastSpecialMergeWorld,"beach")
        XCTAssertEqual(next.engine.state.wildMeter,0.63,accuracy:0.000001)
        try await wait("Next Source canonical save"){next.sourceInitialBoardSaveAccepted && next.boardScene?.isBoardEntryComplete==true && next.beforeSourceGameplayAdmission==nil}
        let persisted=try XCTUnwrap(f.store.load())
        // A newly entered round is not a played layout. The canonical save
        // retains earned carry metadata until its first committed move.
        XCTAssertFalse(NativeSaveEnvelope.hasRecordedMove(next.engine.state))
        XCTAssertNil(persisted.arcadeRun)
        XCTAssertEqual(persisted.activeArcadeVariant,.slowBurn)
        let untouched=try XCTUnwrap(persisted.pendingArcadeRound)
        XCTAssertEqual(untouched.round,4)
        XCTAssertEqual(untouched.score,next.engine.state.score)
        XCTAssertNil(untouched.ownerID)
        XCTAssertEqual(untouched.lastSpecialMergeWorld,"beach")
        XCTAssertEqual(try XCTUnwrap(untouched.meterProgress),0.63,accuracy:0.000001)
    }
    func testLuckyDropNextActualRoundStartsChargingAgain() async throws {
        let f=try Fixture(variant:.pureDice,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3),.init(id:"b",cell:.init(column:1,row:0),value:3)],meter:0,luckyDropUsed:true)
        defer{f.dispose()}
        let old=try await enter(f),scene=try XCTUnwrap(old.boardScene)
        try await merge(scene,source:"a",target:"b")
        try await wait("Next Lucky Drop round"){f.game.map{$0 !== old && $0.engine.state.board==4 && $0.boardScene?.isBoardEntryComplete==true && $0.beforeSourceGameplayAdmission==nil}==true}
        let next=try XCTUnwrap(f.game)
        XCTAssertFalse(next.engine.state.luckyDropUsed)
        XCTAssertEqual(next.engine.state.wildMeter,0)
        XCTAssertTrue(try XCTUnwrap(next.boardScene).sourceTutorialMeterHUDReady)
    }
    func testLuckyDropActualSourceChargesThenSpendsOnce() async throws {
        let f=try Fixture(variant:.pureDice,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:1),.init(id:"other",cell:.init(column:4,row:8),value:2)],meter:0.99)
        defer{f.dispose()}
        let game=try await enter(f),scene=try XCTUnwrap(game.boardScene)
        XCTAssertTrue(scene.sourceTutorialMeterHUDReady)
        try await merge(scene,source:"a",target:"b")
        try await wait("One random drop settled"){game.engine.state.wildSpawnCount==1 && !game.engine.hasUnsavableSourceGameplayState}
        XCTAssertTrue(game.engine.state.luckyDropUsed)
        XCTAssertEqual(game.engine.state.wildMeter,0)
        XCTAssertEqual(game.engine.state.tiles.filter(\.isWild).count,1)
        XCTAssertFalse(game.engine.claimMeterReward().accepted)
        try await wait("Durable used drop"){(try? f.store.load()?.arcadeRun?.luckyDropUsed)==true}
        XCTAssertEqual(try f.store.load()?.arcadeRun?.wildMeter,0)
        try await merge(scene,source:"b",target:"other")
        try await wait("Post-drop ordinary merge settled"){!game.engine.hasUnsavableSourceGameplayState}
        XCTAssertEqual(game.engine.state.wildMeter,0)
        XCTAssertEqual(game.engine.state.wildSpawnCount,1)
    }
}
