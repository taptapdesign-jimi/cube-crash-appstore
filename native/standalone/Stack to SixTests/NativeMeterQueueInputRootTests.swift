import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeMeterQueueInputRootTests:XCTestCase {
    func testDeveloperHiddenBeeOnRestoredBoardAnnouncesAfterEntry() async throws {
        try await restoredIntroductionAlert(boardNumber:1,id:"bee")
    }
    func testDeveloperHiddenFishOnRestoredBoardAnnouncesAfterEntry() async throws {
        try await restoredIntroductionAlert(boardNumber:12,id:"fish")
    }
    func testAlreadyReadRestoredBeeDoesNotAnnounceAgain() async throws {
        try await restoredIntroductionAlert(boardNumber:1,id:"bee",hide:false)
    }
    private func restoredIntroductionAlert(boardNumber:Int,id:String,hide:Bool=true) async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("restored-alert-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        envelope.progression.completedJourneyBoards=Set(1..<boardNumber)
        XCTAssertTrue(envelope.progression.announceJourneyDie(id,board:boardNumber))
        envelope.progression.readJourneyDie(id)
        var board=NativeBoardFactory.make(mode:.journey,board:boardNumber,generation:9,seed:7)
        board.moves=49;board.wildSpawnCount=1
        board.tiles[0].value=6;board.tiles[0].archetype = .star;board.tiles[0].variant=id
        board.tiles[0].locked=false;board.tiles[0].alpha=1
        envelope.journeyRuns[boardNumber]=board
        envelope.journeyRunSavedAt[boardNumber]=Date().timeIntervalSince1970
        try store.save(envelope)
        let developer=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        let setupHost=UIViewController();developer.start(in:setupHost)
        if hide {try developer.applyDeveloperProgress(.hide,values:[String(boardNumber)])}
        developer.dispose()
        XCTAssertEqual(try store.load()?.journeyRuns[boardNumber],board)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait("home"){!app.home.isHidden};app.navigate(.world((boardNumber-1)/10+1),interrupt:true)
        try await wait("world-play"){if game() != nil{return true};app.world?.onRequest?("continue",boardNumber);return false}
        try await wait("entry"){game()?.boardScene?.isBoardEntryComplete == true}
        try await Task.sleep(for:.milliseconds(800))
        let gameplay=try XCTUnwrap(game()),scene=try XCTUnwrap(gameplay.boardScene)
        XCTAssertEqual(try store.load()?.progression.unreadJourneyDice,hide ? [id]:[])
        if hide {XCTAssertNotNil(scene.childNode(withName:"//native-game-backpack-alert"))}
        else {XCTAssertNil(scene.childNode(withName:"//native-game-backpack-alert"))}
        XCTAssertNil(gameplay.presentedViewController)
        XCTAssertEqual(gameplay.engine.state.wildSpawnCount,1)
        XCTAssertTrue(gameplay.engine.state.tiles.contains{$0.variant==id})
        if hide {
            gameplay.onHelp?()
            let first=try XCTUnwrap(gameplay.presentedViewController as? NativeGameplayBackpackController)
            try await wait("first-backpack-ready") {first.view.isUserInteractionEnabled && first.screen?.isUserInteractionEnabled==true}
            XCTAssertTrue(first.screen?.sections.first?.unlocked.contains(id)==true)
            func closeButton(in view:UIView)->UIButton? {
                if let button=view as? UIButton,button.accessibilityIdentifier=="native.gameplay.backpack.close" {return button}
                return view.subviews.lazy.compactMap{closeButton(in:$0)}.first
            }
            try XCTUnwrap(closeButton(in:first.view)).sendActions(for:.touchUpInside)
            try await wait("first-backpack-dismissed") {gameplay.presentedViewController==nil}
            XCTAssertTrue(try XCTUnwrap(store.load()).progression.unreadJourneyDice.isEmpty)
            gameplay.onHelp?()
            let reopened=try XCTUnwrap(gameplay.presentedViewController as? NativeGameplayBackpackController)
            try await wait("reopened-backpack-ready") {reopened.view.isUserInteractionEnabled && reopened.screen?.isUserInteractionEnabled==true}
            let screen=try XCTUnwrap(reopened.screen),section=try XCTUnwrap(screen.sections.first)
            XCTAssertTrue(section.unlocked.contains(id),"Acknowledging the alert must retain the discovered die on the next collection visit")
            XCTAssertFalse(section.unread.contains(id))
            let item=try XCTUnwrap(section.dice.firstIndex{$0.id==id})
            screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:item,section:0))
            try await wait("reopened-die-selectable") {reopened.detail?.card.isUserInteractionEnabled==true}
            XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        }
    }
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate() {
            guard Date()<deadline else{XCTFail("MeterQueueInputRoot timeout="+label);throw NSError(domain:label,code:1)}
            try await Task.sleep(for:.milliseconds(10))
        }
    }
    func testActualBootstrapEarnedKantaArrivalKeepsUnrelatedOrdinaryAndPriorWildInput()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("meter-input-root-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        envelope.progression.completedJourneyBoards=Set(1..<22)
        var board=NativeBoardFactory.make(mode:.journey,board:22,generation:9,seed:7)
        for index in board.tiles.indices {board.tiles[index].value=0;board.tiles[index].locked=true;board.tiles[index].alpha=0.25;board.tiles[index].archetype=nil;board.tiles[index].variant=nil}
        for(index,value)in [(0,3),(1,3),(2,1),(3,2),(4,2),(40,6)] {
            board.tiles[index].value=value;board.tiles[index].locked=false;board.tiles[index].alpha=1
        }
        board.tiles[40].archetype = .star
        let priorWildID=board.tiles[40].id,ordinaryID=board.tiles[2].id,targetID=board.tiles[3].id
        board.wildMeter=0.95;board.moves=49
        envelope.journeyRuns[22]=board;envelope.journeyRunSavedAt[22]=Date().timeIntervalSince1970;try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait("home"){!app.home.isHidden};app.navigate(.world(3),interrupt:true)
        try await wait("world-play") {if game() != nil{return true};app.world?.onRequest?("continue",22);return false}
        try await wait("actual-gameplay") {
            return game()?.boardScene?.isBoardEntryComplete==true && game()?.beforeSourceGameplayAdmission==nil
        }
        let gameplay=try XCTUnwrap(game()),scene=try XCTUnwrap(gameplay.boardScene)
        func point(_ id:String)throws->CGPoint {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(id));return scene.convert(node.position,from:try XCTUnwrap(node.parent))
        }
        let from=try point(board.tiles[0].id),to=try point(board.tiles[1].id)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait("real-Kanta-arrival") {
            scene.captureSourceMeterQueueSignals()?.inProgress==true &&
                gameplay.engine.meterDropReservations.values.contains{$0.assetsPrepared && !$0.landed && !$0.queueCanceled} &&
                !gameplay.engine.flags.merge6SpawnInProgress && !gameplay.engine.flags.pendingSpecialMutation
        }
        let drop=try XCTUnwrap(gameplay.engine.meterDropReservations.values.first{$0.assetsPrepared && !$0.landed && !$0.queueCanceled})
        XCTAssertEqual(gameplay.engine.state.tiles.first{$0.id==drop.tileID}?.variant,"kanta")
        XCTAssertTrue(gameplay.engine.hasUnsavableSourceGameplayState)
        XCTAssertTrue(gameplay.engine.resolutionRuntimeFlags.wildSpawnInProgress)
        XCTAssertFalse(gameplay.engine.beginDrag(tileID:drop.tileID),"The exact arriving tile keeps its own drop/handoff lock")
        let ordinaryPoint=try point(ordinaryID)
        guard scene.beginDrag(at:ordinaryPoint) else{return XCTFail("Actual Bootstrap queue must not lock unrelated ordinary input during Kanta arrival")}
        scene.cancelDrag()
        guard scene.beginDrag(at:try point(priorWildID)) else{return XCTFail("Actual Bootstrap queue must not lock a settled prior Wild")}
        scene.cancelDrag()
        let ordinaryFrom=try point(ordinaryID),ordinaryTo=try point(targetID)
        XCTAssertTrue(scene.beginDrag(at:ordinaryFrom));scene.moveDrag(to:ordinaryTo)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:ordinaryTo,now:CACurrentMediaTime())).accepted)
        XCTAssertTrue(gameplay.engine.meterDropReservations[drop.id]?.landed==false,"The unrelated move is accepted during the real descent, not after queue release")
        XCTAssertTrue(scene.captureSourceMeterQueueSignals()?.inProgress==true)
        try await wait("arrival-and-unrelated-move-settled") {
            !gameplay.engine.sourceMeterSpawnInProgress && !gameplay.engine.sourceMeterHandoffInProgress &&
                gameplay.engine.pendingOrdinaryStack==nil && !gameplay.engine.hasPendingSourceOrdinaryStackFace
        }
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game() === gameplay)
        XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        XCTAssertEqual(gameplay.engine.state.tiles.first{$0.id==targetID}?.value,3)
        try await wait("new-die-HUD-alert") {
            scene.childNode(withName:"//native-game-backpack-alert") != nil &&
                scene.childNode(withName:"//native-game-help")?.action(forKey:"backpack-icon-swap") == nil
        }
        XCTAssertEqual(try store.load()?.progression.unreadJourneyDice,["kanta"])
        XCTAssertNil(gameplay.presentedViewController,"An actual first earned drop only changes HUD; it never opens Backpack or detail")
        XCTAssertFalse(scene.navigationLocked)
        let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help"))
        XCTAssertLessThan(help.frame.width,40,"The actual rendered HUD owner must keep its 34pt footprint")
        let boardPoint=try point(targetID)
        XCTAssertFalse(scene.handleHUDContact(at:boardPoint),"A board touch after discovery cannot hit an inflated Backpack")
        XCTAssertNil(gameplay.presentedViewController)
        XCTAssertTrue(scene.beginDrag(at:boardPoint),"Ordinary dice remain playable after the HUD swap")
        scene.cancelDrag()
    }
}
