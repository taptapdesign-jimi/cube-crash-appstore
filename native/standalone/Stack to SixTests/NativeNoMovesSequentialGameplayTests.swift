import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

/// Independent fresh games share one Bootstrap but may issue value-equal
/// generation1/token1 receipts. Each actual Scene/result owns its own lifetime.
@MainActor final class NativeNoMovesSequentialGameplayTests:XCTestCase {
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    private func button(_ view:UIView,id:String)->UIButton? {
        if let button=view as? UIButton,button.accessibilityIdentifier==id{return button}
        return view.subviews.lazy.compactMap{self.button($0,id:id)}.first
    }
    func testIndependentFreshForestThenBeachEqualReceiptsEachMountOneRealFailResult()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-sequential-no-moves-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;seed.progression.completedJourneyBoards=Set(1...10);try store.save(seed)
        // The genuine fresh recipe opens value5 throughout its14 chosen cells.
        // Locked zero holders stay locked; Core's real checker finds no merges.
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.99},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("Visible Home"){!app.home.isHidden && app.home.isUserInteractionEnabled}
        let first=try await enterAndCompleteNoMoves(app,board:1)
        let firstReceipt=try XCTUnwrap(first.engine.completedSourceNoMovesReceipt)
        XCTAssertEqual(firstReceipt.generation,1);XCTAssertEqual(firstReceipt.planToken,1)
        let firstResult=try XCTUnwrap(first.presentedViewController as? NativeResultController)
        let firstScope=try XCTUnwrap(first.sourceScope)
        let exit=try XCTUnwrap(button(firstResult.view,id:"native.result.exit"))
        try await wait("First actual result Exit ready"){exit.isUserInteractionEnabled}
        exit.sendActions(for:.touchUpInside)
        try await wait("First result returns to its World"){first.parent == nil && app.route == .world(1) && app.world?.isReadyForInput == true}
        XCTAssertFalse(firstScope.current)
        let firstStats=try XCTUnwrap(store.load()?.progression.boardStats[1])
        let second=try await enterAndCompleteNoMoves(app,board:11)
        XCTAssertFalse(second === first)
        XCTAssertEqual(second.engine.completedSourceNoMovesReceipt,firstReceipt,"Distinct Core runs deliberately issue the same receipt value")
        let secondResult=try XCTUnwrap(second.presentedViewController as? NativeResultController)
        XCTAssertFalse(secondResult === firstResult)
        XCTAssertEqual(secondResult.view.window,window)
        let durable=try XCTUnwrap(store.load())
        XCTAssertEqual(durable.progression.boardStats[1],firstStats,"The second fail must not recommit the earlier attempt")
        XCTAssertNotNil(durable.progression.boardStats[11],"The second fail owns its own durable attempt")
    }
    private func enterAndCompleteNoMoves(_ app:NativeAppController,board:Int)async throws->NativeGameplayViewController {
        let world=(board-1)/10+1
        app.navigate(.world(world),interrupt:true)
        try await wait("World\(world) ready"){app.route == .world(world) && app.world?.isReadyForInput == true}
        app.world?.onRequest?("continue",board)
        try await wait("Actual board\(board) mounted"){app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        XCTAssertEqual(game.engine.state.generation,1)
        XCTAssertEqual(game.engine.state.board,board)
        XCTAssertTrue(game.engine.state.tiles.filter{!$0.locked}.allSatisfy{$0.value==5})
        try await wait("Board\(board) Source admission or genuine no-moves candidate"){
            game.beforeSourceGameplayAdmission == nil || game.engine.pendingSourceNoMoves != nil
        }
        game.boardScene?.evaluate()
        try await wait("Board\(board) real completed no-moves receipt"){game.engine.completedSourceNoMovesReceipt != nil}
        XCTAssertNil(game.sourcePresentationFailure)
        XCTAssertEqual(game.engine.completedSourceNoMovesReceipt?.resolution.reason,"no_merges_possible")
        XCTAssertTrue(game.engine.completedSourceNoMovesReceipt?.boardExitCompleted == true)
        print("[SequentialNoMoves] board=\(board) receipt=\(String(describing:game.engine.completedSourceNoMovesReceipt)) resultMounted=\(game.presentedViewController is NativeResultController)")
        // Receipt delivery mounts the result synchronously on the same source
        // checkpoint. A value collision must not silently leave a blank board.
        XCTAssertTrue(game.presentedViewController is NativeResultController,"Board\(board) completed actual board exit without a visible fail result")
        return game
    }
}
