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
        init(variant:NativeArcadeVariant,tiles:[NativeTile],meter:Double,random:Double=0.1,board:Int=3,luckyDropUsed:Bool=false) throws {
            directory=FileManager.default.temporaryDirectory.appendingPathComponent("arcade-integration-"+UUID().uuidString)
            store=NativeSaveStore(directory:directory)
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            seed.progression.firstPlayTutorialComplete=true
            seed.activeArcadeVariant=variant
            seed.arcadeRun = .init(tiles:tiles,mode:.arcade,board:board,stage:board,generation:9,moves:37,score:123,wildMeter:meter,arcadeVariant:variant)
            seed.arcadeRun?.luckyDropUsed=luckyDropUsed
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
        let f=try Fixture(variant:.slowBurn,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3),.init(id:"b",cell:.init(column:1,row:0),value:3)],meter:0.63)
        defer{f.dispose()}
        let old=try await enter(f),scene=try XCTUnwrap(old.boardScene)
        XCTAssertTrue(scene.sourceTutorialMeterHUDReady)
        try await merge(scene,source:"a",target:"b")
        try await wait("Clean result"){old.presentedViewController is NativeResultController}
        let result=try XCTUnwrap(old.presentedViewController as? NativeResultController)
        XCTAssertTrue(result.clean)
        try await wait("Durable Slow Burn pending round"){(try? f.store.load()?.pendingArcadeRound?.round)==4}
        let pending=try XCTUnwrap(f.store.load()?.pendingArcadeRound)
        XCTAssertEqual(try XCTUnwrap(pending.meterProgress),0.63,accuracy:0.000001)
        XCTAssertEqual(pending.score,result.finalScore)
        try await wait("Next Source controller"){f.game.map{$0 !== old}==true}
        let next=try XCTUnwrap(f.game)
        XCTAssertNotNil(next.sourceInitialConstruction)
        XCTAssertEqual(next.engine.state.effectiveArcadeVariant,.slowBurn)
        XCTAssertEqual(next.engine.state.board,4)
        XCTAssertEqual(next.engine.state.wildMeter,0.63,accuracy:0.000001)
        try await wait("Next Source canonical save"){next.sourceInitialBoardSaveAccepted && next.boardScene?.isBoardEntryComplete==true && next.beforeSourceGameplayAdmission==nil}
        let persisted=try XCTUnwrap(f.store.load())
        XCTAssertNil(persisted.pendingArcadeRound)
        XCTAssertEqual(persisted.arcadeRun?.effectiveArcadeVariant,.slowBurn)
        XCTAssertEqual(try XCTUnwrap(persisted.arcadeRun?.wildMeter),0.63,accuracy:0.000001)
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
