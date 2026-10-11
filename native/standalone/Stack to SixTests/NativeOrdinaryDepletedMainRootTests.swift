import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

/// Production Bootstrap/runtime authority; no injected fresh result, caller
/// reply, timer cancellation or manual absorb completion.
@MainActor final class NativeOrdinaryDepletedMainRootTests:XCTestCase {
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate() {
            guard Date()<deadline else{XCTFail(label);throw NSError(domain:label,code:1)}
            try await Task.sleep(for:.milliseconds(10))
        }
    }
    func testActualProductionDepletedMainSettlesBeforeWatchdogAndAcceptsRemainingThreePlusThree()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("ordinary-depleted-main-root-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        envelope.progression.completedJourneyBoards=[1]
        let board=NativeBoardState(columns:5,rows:9,tiles:[
            .init(id:"main-source",cell:.init(column:0,row:0),value:3,stackDepth:2),
            .init(id:"main-destination",cell:.init(column:1,row:0),value:3),
            .init(id:"next-source",cell:.init(column:2,row:0),value:3),
            .init(id:"next-destination",cell:.init(column:3,row:0),value:3),
            .init(id:"other",cell:.init(column:4,row:8),value:5)],mode:.journey,board:2,generation:9,moves:1,score:3280,wildMeter:0)
        envelope.journeyRuns[2]=board;try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait("home"){!app.home.isHidden};app.navigate(.world(1),interrupt:true)
        try await wait("Journey2"){if game() != nil{return true};app.world?.onRequest?("continue",2);return false}
        try await wait("actual-admission"){game()?.boardScene?.isBoardEntryComplete==true && game()?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game()),scene=try XCTUnwrap(gameplay.boardScene),scope=try XCTUnwrap(gameplay.sourceScope)
        XCTAssertNotNil(gameplay.engine.sourceNoMovesRuntimeAuthority)
        XCTAssertTrue(gameplay.engine.sourceNoMovesCallerReceiptsEnabled)
        XCTAssertTrue(scope.current)
        func point(_ id:String)throws->CGPoint {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(id));return scene.convert(node.position,from:try XCTUnwrap(node.parent))
        }
        let from=try point("main-source"),to=try point("main-destination")
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        let started=CACurrentMediaTime()
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        let first=try XCTUnwrap(gameplay.engine.pendingOrdinarySix)
        XCTAssertEqual(first.source.stackDepth+first.destination.stackDepth,
                       min(4,try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id=="main-destination"}).stackDepth),
                       "Restore may normalize layers; assert the actual admitted stack")
        while scene.sourceNativeTileNode("main-destination") != nil,CACurrentMediaTime()-started<0.3 {
            try await Task.sleep(for:.milliseconds(10))
        }
        let removalMilliseconds=(CACurrentMediaTime()-started)*1000
        print("[NATIVE_ORDINARY_MAIN_REMOVAL] dropToOldSixRemovalMs=\(removalMilliseconds) removed=\(scene.sourceNativeTileNode("main-destination")==nil)")
        XCTAssertNil(scene.sourceNativeTileNode("main-destination"),"Source main80 + primary preparation50 + RAF must remove old6 within300ms, independently of the1200ms watchdog")
        XCTAssertLessThanOrEqual(removalMilliseconds,300,"Normal cleanup must not wait for the watchdog")
        let settle=Date().addingTimeInterval(4)
        while gameplay.engine.pendingOrdinarySix != nil,Date()<settle {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNil(gameplay.engine.pendingOrdinarySix,"Actual checker/primary/finally must release the first handoff")
        XCTAssertTrue(gameplay.engine.pendingSourceNoMovesCallerReceipts.isEmpty)
        let authority=try XCTUnwrap(gameplay.engine.sourceNoMovesRuntimeAuthority)
        XCTAssertTrue(authority.isCurrent())
        XCTAssertNotNil(authority.capture(),"Settled production physical ownership must satisfy the unchanged strict runtime receipt")
        XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        XCTAssertEqual(app.route,.gameplay)
        let nextFrom=try point("next-source"),nextTo=try point("next-destination")
        guard scene.beginDrag(at:nextFrom) else{return XCTFail("Remaining ordinary source must remain draggable")}
        scene.moveDrag(to:nextTo)
        let next=try XCTUnwrap(scene.finishDrag(at:nextTo,now:CACurrentMediaTime()))
        XCTAssertTrue(next.accepted,"Settled first main must permit the remaining3+3")
        if next.accepted {XCTAssertNotEqual(gameplay.engine.pendingOrdinarySix?.id,first.id)}
    }
}
