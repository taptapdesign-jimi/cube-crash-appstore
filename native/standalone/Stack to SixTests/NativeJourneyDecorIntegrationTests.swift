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
        let renderer=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? any NativeGameplayRenderHost}.first)
        XCTAssertNil(renderer.renderedScene);XCTAssertTrue(renderer.renderView.isHidden);XCTAssertEqual(resources.requests.count,1)
        release?();XCTAssertNil(renderer.renderedScene);XCTAssertEqual(entries,0)
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let footer=try XCTUnwrap(controller.journeyBottomDecor)
        XCTAssertTrue(footer.isPrepared);XCTAssertNotNil(renderer.renderedScene);XCTAssertEqual(entries,1)
        try await waitForActualDecorEntry(controller);XCTAssertEqual(footer.phase,.entering)
        XCTAssertTrue(controller.view.subviews.first is NativeAppPaperSurface)
        XCTAssertTrue(controller.view.subviews[1] === footer);XCTAssertTrue(controller.view.subviews[2] === renderer.renderView)
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
    func testOldNonfinalProgressCannotBorrowALaterFinalTransactionOrCrossGeneration()async throws {
        let resources=Resources()
        let tiles=[NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:3),NativeTile(id:"b",cell:NativeCell(column:1,row:0),value:3)]
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles))
        engine.stagedOrdinaryMoves=true
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        controller.journeyDecorCatalog=NativeJourneyBottomDecorCatalog();controller.journeyDecorResources={_ in resources}
        let window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);try await waitForActualDecorEntry(controller)
        let scene=try XCTUnwrap(controller.boardScene),generation=engine.state.generation
        let deadline=Date().addingTimeInterval(4)
        while !scene.isBoardEntryComplete {guard Date()<deadline else{throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
        let oldNonfinal=scene.finalMergeProgressObserver(generation:generation)
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
        XCTAssertTrue(engine.drop(target:tiles[1].cell).accepted)
        XCTAssertTrue(try XCTUnwrap(engine.pendingOrdinarySix).isFinal)
        let final=scene.finalMergeProgressObserver(generation:generation)
        var calls=0;scene.onFinalMergeProgress={_,_,_ in calls += 1}
        oldNonfinal(9,10);XCTAssertEqual(calls,0)
        final(8.999,10);XCTAssertEqual(calls,0)
        final(9.549,10);XCTAssertEqual(calls,0)
        final(9.55,10);XCTAssertEqual(calls,1)
        oldNonfinal(10,10);XCTAssertEqual(calls,1)
        scene.setSuspended(true);final(9.5,10);XCTAssertEqual(calls,1)
        scene.setSuspended(false)
        engine.restart(state:engine.state)
        final(10,10);XCTAssertEqual(calls,1)
        controller.dispose();final(10,10);XCTAssertEqual(calls,1)
    }

    func testCleanTerminalWaitsForResidualChromeExitAndClearCard() async throws {
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
            XCTAssertTrue(controller.hasPresentedBoardCleared,"Speech follows PNG onset while the CLEARED text is entering")
        }
        var callbacks=0
        controller.onTerminal={result in
            callbacks += 1;XCTAssertEqual(result.kind,.complete)
            XCTAssertEqual(footer.phase,.hidden,"Journey chrome retires after residuals before the result")
            for target in [tile] + ghosts {
                XCTAssertEqual(target.xScale,0,accuracy:0.001);XCTAssertEqual(target.alpha,0,accuracy:0.001)
            }
            XCTAssertEqual(closed.finalResidualExitSurface?.xScale ?? 1,0,accuracy:0.001)
            XCTAssertEqual(closed.finalResidualExitSurface?.alpha ?? 1,0,accuracy:0.001)
            XCTAssertEqual(hud.alpha,0,accuracy:0.001)
            done.fulfill()
        }
        scene.onTerminal?(NativeResolution(.complete,reason:"final_regular_merge6"))
        XCTAssertEqual(callbacks,0);XCTAssertEqual(roundWon,0)
        scene.onTerminal?(NativeResolution(.complete,reason:"final_regular_merge6"))
        XCTAssertEqual(roundWon,0,"Voice waits for the shared first-text/PNG onset")
        XCTAssertNotEqual(footer.phase,.exiting,"Footer must wait for board residual pop-out")
        XCTAssertNotNil(tile.action(forKey:"board-exit"))
        XCTAssertNotNil(closed.finalResidualExitSurface?.action(forKey:"board-exit"))
        XCTAssertNil(hud.action(forKey:"hud-exit"),"HUD must wait for all residual targets")
        try await Task.sleep(for:.milliseconds(1050))
        XCTAssertGreaterThanOrEqual(hud.alpha,0.99,"HUD remains painted for one second after CLEARED first appears at0.2s; existing drop can overshoot alpha1")
        XCTAssertNil(hud.action(forKey:"hud-exit"))
        XCTAssertNotEqual(footer.phase,.exiting)
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(callbacks,1);XCTAssertEqual(roundWon,1)
    }

    func testClearedResidualsExitBeforeTerminalWithoutRepaintingOrChangingModel()async throws {
        let resources=Resources(),controller=controller(resources)
        var state=controller.engine.state
        state.tiles[0].value=3
        state.tiles.append(NativeTile(id:"b",cell:NativeCell(column:1,row:0),value:3))
        state.tiles.append(NativeTile(id:"closed",cell:NativeCell(column:2,row:0),value:0,locked:true))
        controller.engine.restart(state:state)
        let window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);try await waitForActualDecorEntry(controller)
        let scene=try XCTUnwrap(controller.boardScene)
        let deadline=Date().addingTimeInterval(4)
        while !scene.isBoardEntryComplete {guard Date()<deadline else{throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
        let before=controller.engine.state
        let closed=try XCTUnwrap(scene.sourceNativeTileNode("closed"))
        let active=try XCTUnwrap(scene.sourceNativeTileNode("a"))
        var ghosts:[SKNode]=[]
        scene.enumerateChildNodes(withName:"//native-ghost-*"){node,_ in ghosts.append(node)}
        XCTAssertFalse(ghosts.isEmpty)
        scene.onFinalMergeProgress?(1,1,controller.engine.state.generation)
        XCTAssertTrue(controller.hasPresentedBoardCleared)
        let surface=try XCTUnwrap(closed.finalResidualExitSurface)
        XCTAssertNotNil(surface.action(forKey:"board-exit"))
        XCTAssertTrue(ghosts.allSatisfy{$0.action(forKey:"board-exit") != nil})
        XCTAssertNil(active.action(forKey:"board-exit"),"Active final artwork keeps its own lifecycle")
        let ghost=try XCTUnwrap(ghosts.first),action=try XCTUnwrap(ghost.action(forKey:"board-exit"))
        controller.setSuspended(true)
        let held=ghost.xScale
        try await Task.sleep(for:.milliseconds(120))
        XCTAssertEqual(ghost.xScale,held,accuracy:0.000001)
        controller.setSuspended(false)
        scene.synchronize()
        XCTAssertTrue(ghost.action(forKey:"board-exit") === action,"A save/HUD synchronization must not restart or resurrect ghost exit")
        XCTAssertEqual(controller.engine.state,before)
        try await Task.sleep(for:.milliseconds(1800))
        XCTAssertEqual(surface.xScale,0,accuracy:0.001);XCTAssertEqual(surface.alpha,0,accuracy:0.001)
        print("[ResidualExit] maxScale=\(ghosts.map{abs($0.xScale)}.max() ?? 0) maxAlpha=\(ghosts.map(\.alpha).max() ?? 0) active=\(ghosts.filter{$0.action(forKey:"board-exit") != nil}.count)")
        XCTAssertTrue(ghosts.allSatisfy{abs($0.xScale)<0.001 && $0.alpha<0.001})
        scene.synchronize()
        XCTAssertTrue(ghosts.allSatisfy{abs($0.xScale)<0.001 && $0.alpha<0.001})
        XCTAssertEqual(controller.engine.state,before)
        XCTAssertNil(controller.engine.state.terminal,"Presentation never manufactures a terminal")
    }

    private func waitForActualDecorEntry(_ controller:NativeGameplayViewController) async throws {
        let deadline=Date().addingTimeInterval(4)
        while controller.journeyBottomDecor?.phase != .entering {
            if Date()>deadline {XCTFail("Prepared footer did not enter through the actual HUD-drop owner");throw CancellationError()}
            try await Task.sleep(for:.milliseconds(20))
        }
    }

}
