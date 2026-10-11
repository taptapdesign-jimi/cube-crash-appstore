import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeActualReplaySaveRootTests:XCTestCase {
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate() {
            guard Date()<deadline else{XCTFail("ActualReplaySaveRoot timeout="+label);throw NSError(domain:label,code:1)}
            try await Task.sleep(for:.milliseconds(10))
        }
    }
    func testFreshCompletedJourneyReplayWritesNewRunAndNewHostRestoresMove()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("replay-save-root-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.progression.completedJourneyBoards=Set(1...21)
        try store.save(seed)
        XCTAssertNil(try store.load()?.journeyRuns[21],"This must prove a new write, not preservation of a seeded replay")
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        var host:NativeStandaloneViewController?
        defer{host?.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        func mount()throws->NativeAppController {
            let next=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
            host=next;window.rootViewController=next;window.makeKeyAndVisible();next.loadViewIfNeeded()
            return try XCTUnwrap(next.children.first as? NativeAppController)
        }
        func game(_ app:NativeAppController)->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        func enter(_ app:NativeAppController)async throws->NativeGameplayViewController {
            try await wait("home"){!app.home.isHidden};app.navigate(.world(3),interrupt:true)
            try await wait("world-play"){if game(app) != nil{return true};app.world?.onRequest?("play",21);return false}
            try await wait("entry"){game(app)?.boardScene?.isBoardEntryComplete==true && game(app)?.beforeSourceGameplayAdmission==nil}
            return try XCTUnwrap(game(app))
        }
        let app=try mount(),original=try await enter(app),scene=try XCTUnwrap(original.boardScene)
        let scope=try XCTUnwrap(original.sourceScope)
        let playable=original.engine.state.tiles.filter{!$0.locked && !$0.isWild && $0.value>0}
        let source=try XCTUnwrap(playable.first{a in playable.contains{b in a.id != b.id && a.value+b.value<6}})
        let destination=try XCTUnwrap(playable.first{$0.id != source.id && $0.value+source.value<6})
        let expectedValue=source.value+destination.value,cell=destination.cell,beforeMoves=original.engine.state.moves
        func point(_ tile:NativeTile)throws->CGPoint {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id));return scene.convert(node.position,from:try XCTUnwrap(node.parent))
        }
        let from=try point(source),to=try point(destination)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait("move-settled") {
            original.engine.state.moves==beforeMoves-1 && original.engine.pendingOrdinaryStack==nil &&
                !original.engine.hasPendingSourceOrdinaryStackFace && !original.engine.hasUnsavableSourceGameplayState
        }
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait("new-replay-durable-run"){(try? store.load()?.journeyRuns[21])==original.engine.state}
        let saved=try XCTUnwrap(store.load()?.journeyRuns[21])
        XCTAssertEqual(saved.tile(at:cell)?.value,expectedValue)
        XCTAssertFalse(saved.tiles.contains{$0.id==source.id})
        XCTAssertTrue(try XCTUnwrap(store.load()).progression.completedJourneyBoards.contains(21),"Replaying must not undo earned progression")
        host?.dispose();host=nil
        XCTAssertFalse(scope.current)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(try store.load()?.journeyRuns[21],saved,"A retired old host cannot publish a late snapshot")
        let reopenedApp=try mount(),reopened=try await enter(reopenedApp)
        XCTAssertTrue(reopened !== original)
        XCTAssertEqual(reopened.engine.state.moves,saved.moves)
        XCTAssertEqual(reopened.engine.state.score,saved.score)
        XCTAssertEqual(reopened.engine.state.tile(at:cell)?.value,expectedValue)
        XCTAssertFalse(reopened.engine.state.tiles.contains{$0.cell==source.cell})
        XCTAssertNil(reopened.sourcePresentationFailureGeneration)
    }
}
