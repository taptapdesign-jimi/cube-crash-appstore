import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeJourneyDecorIntegrationTests:XCTestCase {
    private final class Resources:NativeJourneyBottomDecorResourcePreparing {
        var decodedBytes=0,requests:[(UIImage?)->Void]=[]
        func prepare(path:String,completion:@escaping(UIImage?)->Void){requests.append(completion)}
        func cancelPendingPreparation(){}
        func release(){decodedBytes=0}
        func finish(_ index:Int){
            let image=UIGraphicsImageRenderer(size:CGSize(width:2,height:1)).image{_ in UIColor.white.setFill();UIBezierPath(rect:CGRect(x:0,y:0,width:2,height:1)).fill()}
            decodedBytes=32;requests[index](image)
        }
    }
    private func controller(_ resources:Resources)->NativeGameplayViewController {
        let tile=NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:1)
        let controller=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root)
        controller.journeyDecorCatalog=NativeJourneyBottomDecorCatalog();controller.journeyDecorResources={_ in resources}
        return controller
    }
    private func mount(_ controller:NativeGameplayViewController)->UIWindow {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        controller.view.frame=window.bounds;controller.view.setNeedsLayout();controller.view.layoutIfNeeded();return window
    }
    func testThemedAdmissionStartsBeforeDecodeAndRevealsOnePreparedFooterBelowCanvas() async throws {
        let resources=Resources(),controller=controller(resources);var release:(()->Void)?,entries=0
        controller.beforeInitialBoardEntry={release=$0};controller.onBoardEntry={_,_ in entries += 1}
        let window=mount(controller);defer{controller.dispose();window.isHidden=true}
        XCTAssertNotNil(release,"Selected artwork preparation cannot delay themed first motion")
        let renderer=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? SKView}.first)
        XCTAssertNil(renderer.scene);XCTAssertTrue(renderer.isHidden);XCTAssertEqual(resources.requests.count,1)
        release?();XCTAssertNil(renderer.scene);XCTAssertEqual(entries,0)
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let footer=try XCTUnwrap(controller.journeyBottomDecor)
        XCTAssertTrue(footer.isPrepared);XCTAssertNotNil(renderer.scene);XCTAssertEqual(entries,1)
        try await waitForActualDecorEntry(controller);XCTAssertEqual(footer.phase,.entering)
        XCTAssertTrue(controller.view.subviews.first is NativeAppPaperSurface)
        XCTAssertTrue(controller.view.subviews[1] === footer);XCTAssertTrue(controller.view.subviews[2] === renderer)
        release?();controller.view.layoutIfNeeded();XCTAssertEqual(entries,1)
    }
    func testBackgroundCancellationRetainsEntryBarrierUntilFreshForegroundReply() throws {
        let resources=Resources(),controller=controller(resources);controller.beforeInitialBoardEntry={_ in}
        let window=mount(controller);defer{controller.dispose();window.isHidden=true}
        var replies:[Bool]=[];controller.prepareBoardEntryArtwork{replies.append($0)}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertTrue(replies.isEmpty);resources.finish(0);XCTAssertTrue(replies.isEmpty)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(resources.requests.count,2);resources.finish(0);XCTAssertTrue(replies.isEmpty)
        resources.finish(1);XCTAssertEqual(replies,[true]);XCTAssertTrue(try XCTUnwrap(controller.journeyBottomDecor).isPrepared)
    }
    func testGenerationReplacementRetiresOldBarrierAndIgnoresItsLateReply() throws {
        let resources=Resources(),controller=controller(resources);controller.beforeInitialBoardEntry={_ in}
        let window=mount(controller);defer{controller.dispose();window.isHidden=true}
        let old=try XCTUnwrap(controller.journeyBottomDecor);var replies:[Bool]=[],next:[Bool]=[]
        controller.prepareBoardEntryArtwork{replies.append($0)}
        var state=controller.engine.state;state.generation=2;state.board=13;controller.engine.restart(state:state)
        controller.refreshFromEngine();XCTAssertEqual(replies,[false]);XCTAssertEqual(old.phase,.disposed)
        controller.prepareBoardEntryArtwork{next.append($0)};resources.finish(0);XCTAssertTrue(next.isEmpty)
        resources.finish(1);XCTAssertEqual(next,[true]);XCTAssertEqual(controller.journeyBottomDecor?.board,13)
        controller.dispose();XCTAssertFalse(old.hasActiveClock)
    }
    func testPreparedArtworkAdmissionDoesNotDependOnAnimatedWaveNotification() async throws {
        let resources=Resources(),controller=controller(resources),window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        // The optional animation/audio wave callback is absent on reduced-motion
        // admission. The controller's real prepared-frame boundary still enters.
        controller.boardScene?.onBoardEntry=nil
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        try await waitForActualDecorEntry(controller)
        XCTAssertEqual(controller.journeyBottomDecor?.phase,.entering)
    }
    func testJourneyRetryWithoutThemedWaveEntersOnlyItsFreshPreparedFooter() throws {
        let resources=Resources(),controller=controller(resources),window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let old=try XCTUnwrap(controller.journeyBottomDecor)
        var state=controller.engine.state;state.generation=2;controller.engine.restart(state:state)
        controller.refreshFromEngine()
        XCTAssertEqual(old.phase,.disposed);XCTAssertEqual(controller.journeyBottomDecor?.phase,.unprepared)
        resources.finish(1);XCTAssertEqual(controller.journeyBottomDecor?.phase,.entering)
        controller.refreshFromEngine();XCTAssertEqual(resources.requests.count,2)
    }
    func testCoveredBoardExitExplicitlyRunsFooterAndAwaitsBothActualComponents() async throws {
        let resources=Resources(),controller=controller(resources),window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let footer=try XCTUnwrap(controller.journeyBottomDecor);footer.paint(seconds:0.62,generation:1)
        controller.setSuspended(true);XCTAssertFalse(footer.hasActiveClock)
        let done=expectation(description:"Board and original .44 footer exit both settle");var replies:[Bool]=[]
        controller.animateBoardExit {success in
            replies.append(success);XCTAssertTrue(success);XCTAssertEqual(footer.phase,.hidden);XCTAssertFalse(footer.hasActiveClock);done.fulfill()
        }
        XCTAssertEqual(footer.phase,.exiting);XCTAssertTrue(footer.hasActiveClock);XCTAssertTrue(replies.isEmpty)
        await fulfillment(of:[done],timeout:4);XCTAssertEqual(replies,[true])
    }
    func testCleanTerminalWaitsForResidualBoardThenHUDAndFooter() async throws {
        let resources=Resources(),controller=controller(resources)
        var state=controller.engine.state
        state.tiles.append(NativeTile(id:"closed",cell:NativeCell(column:1,row:0),value:0,locked:true))
        controller.engine.restart(state:state)
        let window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let scene=try XCTUnwrap(controller.boardScene)
        let footer=try XCTUnwrap(controller.journeyBottomDecor)
        try await waitForActualDecorEntry(controller)
        let entryDeadline=Date().addingTimeInterval(4)
        while !scene.isBoardEntryComplete {
            guard Date()<entryDeadline else {XCTFail("Actual board entry did not complete");throw CancellationError()}
            try await Task.sleep(for:.milliseconds(20))
        }
        footer.paint(seconds:0.62,generation:1)
        let tile=try XCTUnwrap(scene.sourceNativeTileNode("a"))
        let closed=try XCTUnwrap(scene.sourceNativeTileNode("closed"))
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        var ghosts:[SKNode]=[]
        scene.enumerateChildNodes(withName:"//native-ghost-*"){node,_ in ghosts.append(node)}
        XCTAssertFalse(ghosts.isEmpty)
        let done=expectation(description:"Clean callback follows residual, HUD and footer exit")
        var roundWon=0
        controller.onRoundWon={generation in
            roundWon += 1;XCTAssertEqual(generation,controller.engine.state.generation)
            XCTAssertNil(tile.action(forKey:"board-exit"),"Speech admission precedes board exit")
        }
        var callbacks=0
        controller.onTerminal={result in
            callbacks += 1;XCTAssertEqual(result.kind,.complete)
            XCTAssertEqual(footer.phase,.hidden);XCTAssertFalse(footer.hasActiveClock)
            for target in [tile,closed] + ghosts {
                XCTAssertEqual(target.xScale,0,accuracy:0.001);XCTAssertEqual(target.alpha,0,accuracy:0.001)
            }
            XCTAssertEqual(hud.alpha,0,accuracy:0.001)
            done.fulfill()
        }
        scene.onTerminal?(NativeResolution(.complete,reason:"final_regular_merge6"))
        XCTAssertEqual(callbacks,0);XCTAssertEqual(roundWon,1)
        scene.onTerminal?(NativeResolution(.complete,reason:"final_regular_merge6"))
        XCTAssertEqual(roundWon,1,"Duplicate terminal cannot select another phrase")
        XCTAssertNotEqual(footer.phase,.exiting,"Footer must wait for board residual pop-out")
        XCTAssertNotNil(tile.action(forKey:"board-exit"))
        XCTAssertNotNil(closed.action(forKey:"board-exit"))
        XCTAssertNil(hud.action(forKey:"hud-exit"),"HUD must wait for all residual targets")
        await fulfillment(of:[done],timeout:4)
        XCTAssertEqual(callbacks,1)
    }

    private func waitForActualDecorEntry(_ controller:NativeGameplayViewController) async throws {
        let deadline=Date().addingTimeInterval(4)
        while controller.journeyBottomDecor?.phase != .entering {
            if Date()>deadline {XCTFail("Prepared footer did not enter through the actual HUD-drop owner");throw CancellationError()}
            try await Task.sleep(for:.milliseconds(20))
        }
    }

}
