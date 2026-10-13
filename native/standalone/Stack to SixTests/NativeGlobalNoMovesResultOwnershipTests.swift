import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeGlobalNoMovesResultOwnershipTests:XCTestCase {
    func testActualNoMovesResultRemainsSingleAcrossAllWorldFamiliesAndArcade() async throws {
        for board in [1,11,21] {try await exercise(board:board,journey:true)}
        try await exercise(board:1,journey:false)
    }
    private func exercise(board:Int,journey:Bool) async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-global-no-moves-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        if journey,board>1 {seed.progression.completedJourneyBoards=Set(1..<board);seed.progression.highestUnlockedJourneyBoard=board}
        let state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),.init(id:"c",cell:.init(column:2,row:0),value:5)],mode:journey ? .journey:.arcade,board:board,generation:1,moves:1)
        if journey {seed.journeyRuns[board]=state}else{seed.arcadeRun=state}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ label:String,_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(40)
            while !predicate(){guard Date()<deadline else{XCTFail("\(label) board=\(board) journey=\(journey)");throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
        }
        func current()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait("Home ready"){!app.home.isHidden}
        if journey {
            app.navigate(.world((board-1)/10+1),interrupt:true)
            try await wait("Continue mounted"){
                if current() != nil{return true};app.world?.onRequest?("continue",board);return false
            }
        }else{app.navigate(.gameplay,interrupt:true)}
        try await wait("Source entry"){
            guard let game=current(),let scene=game.boardScene else{return false}
            return scene.isBoardEntryComplete && game.beforeSourceGameplayAdmission==nil && game.engine.sourceNoMovesRuntimeAuthority?.isCurrent()==true
        }
        let game=try XCTUnwrap(current()),scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait("Actual Source result"){game.engine.completedSourceNoMovesReceipt != nil && game.presentedViewController is NativeResultController}
        let receipt=try XCTUnwrap(game.engine.completedSourceNoMovesReceipt),result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
        XCTAssertEqual(receipt.resolution.kind,.fail);XCTAssertTrue(receipt.boardExitCompleted)
        let committed=try XCTUnwrap(store.load()),generation=game.engine.state.generation
        for _ in 0..<3 {game.onTerminal?(receipt.resolution)}
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertTrue(game.presentedViewController === result,"Duplicate callback must retain the same mounted result")
        XCTAssertEqual(game.engine.state.generation,generation);XCTAssertEqual(try store.load(),committed)
        func exit(_ view:UIView)->UIButton? {
            if let button=view as? UIButton,button.accessibilityIdentifier=="native.result.exit" {return button}
            return view.subviews.lazy.compactMap{exit($0)}.first
        }
        let button=try XCTUnwrap(exit(result.view));try await wait("Exit ready"){button.isUserInteractionEnabled && result.view.isUserInteractionEnabled && (result.view.layer.animationKeys() ?? []).isEmpty}
        button.sendActions(for:.touchUpInside)
        try await wait("Real result return"){current()==nil && (journey ? app.world != nil:!app.home.isHidden)}
        XCTAssertEqual(try store.load()?.progression,committed.progression)
    }
}
