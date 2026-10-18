import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

/// Actual Exit modal action must await existing board/HUD/footer owners before
/// Bootstrap returns to World/Home; no synthetic completion or clock delivery.
@MainActor final class NativeEndRunExitRootTests:XCTestCase {
    func testEveryWildAndSpecialUsesBoardPopoutAndFishProjectionStaysVisible()async throws {
        let identities:[(NativeWildArchetype,String?)]=NativeWildArchetype.allCases.map{($0,nil)} + NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype,Optional($0.id))}
        let tiles=identities.enumerated().map {index,identity in
            NativeTile(id:String(format:"%02d",index),cell:.init(column:index%5,row:index/5),value:1,archetype:identity.0,variant:identity.1)
        }
        let engine=NativeGameplayEngine(state:.init(tiles:tiles))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844)),host=UIViewController()
        host.view=view
        let window=UIWindow(frame:view.bounds);window.rootViewController=host;window.makeKeyAndVisible()
        defer{scene.dispose();window.isHidden=true}
        view.presentScene(scene);scene.layout(size:view.bounds.size,insets:.zero)
        try await wait("All variant board entry"){scene.isBoardEntryComplete}
        var sawFishExit=false
        scene.onFishIdleFrames={frames,_,force in
            if let frame=frames[tiles.first{$0.variant=="fish"}!.id],frame.visible,force {sawFishExit=true}
        }
        let done=expectation(description:"All Wild/Special exit owners")
        scene.animateExit{XCTAssertTrue($0);done.fulfill()}
        scene.didFinishUpdate()
        let fishNode=try XCTUnwrap(scene.sourceNativeTileNode(tiles.first{$0.variant=="fish"}!.id))
        XCTAssertNotNil(fishNode.fishFrame(in:scene,visible:true),"Fish frame must exist")
        XCTAssertTrue(fishNode.fishFrame(in:scene,visible:true)?.visible == true,"Fish host pose must be visible")
        XCTAssertNotNil(scene.gameplayRenderHost)
        for tile in tiles {
            XCTAssertNotNil(scene.sourceNativeTileNode(tile.id)?.action(forKey:"board-exit"),tile.variant ?? tile.archetype!.rawValue)
        }
        await fulfillment(of:[done],timeout:8)
        XCTAssertTrue(sawFishExit,"Fish's separate UIKit projection must remain admitted through the popout")
        for tile in tiles {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
            XCTAssertEqual(node.alpha,0,accuracy:0.001,tile.variant ?? tile.archetype!.rawValue)
            XCTAssertEqual(node.xScale,0,accuracy:0.001)
        }
    }
    func testCompletedExitSurfaceCannotRepaintDuringResultRelayoutButFreshBoardCanEnter()async throws {
        let state=NativeBoardState(tiles:[.init(id:"old",cell:.init(column:0,row:0),value:3)])
        let engine=NativeGameplayEngine(state:state)
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844))
        let host=UIViewController();host.view=view
        let window=UIWindow(frame:view.bounds);window.rootViewController=host;window.makeKeyAndVisible()
        defer{scene.dispose();window.isHidden=true}
        view.presentScene(scene);scene.layout(size:view.bounds.size,insets:.zero)
        let node=try XCTUnwrap(scene.sourceNativeTileNode("old"))
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        let ghost=try XCTUnwrap(scene.childNode(withName:"//native-ghost-1-0"))
        let exited=expectation(description:"Actual SpriteKit exit completion")
        var soundDurations:[TimeInterval]=[]
        scene.onBoardExit={soundDurations.append($0)}
        scene.animateExit{XCTAssertTrue($0);exited.fulfill()}
        await fulfillment(of:[exited],timeout:5)
        XCTAssertEqual(soundDurations.count,1,"The actual residual board exit must request its authored cue exactly once")
        XCTAssertGreaterThan(try XCTUnwrap(soundDurations.first),0.03)
        scene.animateExit{XCTAssertFalse($0)}
        XCTAssertEqual(soundDurations.count,1,"A repeated exit cannot replay the cue")
        XCTAssertEqual(node.alpha,0,accuracy:0.001);XCTAssertEqual(hud.alpha,0,accuracy:0.001)
        XCTAssertEqual(ghost.alpha,0,accuracy:0.001)
        let oldPose=node.position,oldScale=node.xScale,oldHUDPose=hud.position
        scene.isPaused=true
        let before=try XCTUnwrap(view.texture(from:scene)?.cgImage())
        // This is the actual UIKit-layout seam used while presenting results,
        // followed by a late same-generation state publication.
        scene.layout(size:.init(width:390,height:843),insets:.init(top:47,left:0,bottom:34,right:0))
        scene.synchronize()
        XCTAssertEqual(node.alpha,0,accuracy:0.001);XCTAssertEqual(node.xScale,oldScale)
        XCTAssertEqual(node.position,oldPose);XCTAssertEqual(hud.alpha,0,accuracy:0.001)
        XCTAssertEqual(hud.position,oldHUDPose)
        XCTAssertTrue(scene.childNode(withName:"//native-ghost-1-0") === ghost)
        XCTAssertEqual(ghost.alpha,0,accuracy:0.001)
        let after=try XCTUnwrap(view.texture(from:scene)?.cgImage())
        XCTAssertEqual(UIImage(cgImage:before).pngData(),UIImage(cgImage:after).pngData(),"The renderer must retain the exited surface across result layout")
        var fresh=state;fresh.generation=state.generation+1
        engine.restart(state:fresh);scene.isPaused=false
        scene.synchronize()
        scene.layout(size:view.bounds.size,insets:.zero)
        let replacement=try XCTUnwrap(scene.sourceNativeTileNode("old"))
        XCTAssertFalse(replacement === node);XCTAssertGreaterThan(replacement.alpha,0.01)
        XCTAssertGreaterThan(replacement.xScale,0.01)
    }
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    private func button(_ view:UIView,id:String)->UIButton? {
        if let button=view as? UIButton,button.accessibilityIdentifier==id{return button}
        return view.subviews.lazy.compactMap{self.button($0,id:id)}.first
    }
    func testActualJourneyExitStageKeepsGameplayMountedThroughDiceTopHUDAndFooterExit()async throws {
        try await exercise(board:21)
    }
    func testActualArcadeExitGameKeepsGameplayMountedThroughDiceAndTopHUDExit()async throws {
        try await exercise(board:nil)
    }
    func testDisposalDuringActualExitCannotPublishLateWorldReturn()async throws {
        try await exercise(board:21,disposeDuringExit:true)
    }
    private func exercise(board:Int?,disposeDuringExit:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-endrun-exit-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true;envelope.progression.completedJourneyBoards=Set(1...20)
        let saved=NativeBoardFactory.make(mode:board==nil ? .arcade:.journey,board:board ?? 1,generation:9,seed:17)
        if let board {envelope.journeyRuns[board]=saved}else{envelope.arcadeRun=saved}
        try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;prior?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("Home"){!app.home.isHidden}
        if let board {
            app.navigate(.world((board-1)/10+1),interrupt:true)
            try await wait("Journey"){
                if app.children.contains(where:{$0 is NativeGameplayViewController}){return true}
                app.world?.onRequest?("continue",board);return false
            }
        }else{app.navigate(.gameplay,interrupt:true)}
        try await wait("Actual gameplay admission"){
            app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{ game in
                guard let scene=game.boardScene,let render=scene.gameplayRenderHost else { return false }
                // Both the owned Metal renderer and SKView fallback must have
                // mounted this exact scene before real gameplay is admitted.
                return game.view.window != nil && render.renderedScene === scene &&
                    render.renderView.window === game.view.window && !render.renderView.isHidden &&
                    !render.renderingPaused && scene.isBoardEntryComplete &&
                    game.beforeSourceGameplayAdmission==nil && !game.engine.hasUnsavableSourceGameplayState
            }==true
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
        let tile=try XCTUnwrap(scene.sourceNativeTileNode(try XCTUnwrap(game.engine.state.activeTiles.first).id))
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        let footer=game.view.subviews.compactMap{$0 as? NativeJourneyBottomDecorOwner}.first
        if board != nil {XCTAssertNotNil(footer);try await wait("Visible footer"){footer?.phase == .visible}}
        game.onExit?()
        let modal=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
        let exit=try XCTUnwrap(button(modal.view,id:"native.end-run.exit"))
        try await wait("Modal admission"){modal.view.isUserInteractionEnabled && exit.isUserInteractionEnabled}
        exit.sendActions(for:.touchUpInside)
        try await wait("Existing authored exit owners"){
            tile.action(forKey:"board-exit") != nil && hud.action(forKey:"hud-exit") != nil &&
            (board==nil || footer?.phase == .exiting)
        }
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game.parent === app)
        XCTAssertTrue(scene.navigationLocked);XCTAssertFalse(scene.beginDrag(at:.zero))
        if disposeDuringExit {
            host.dispose();try await Task.sleep(for:.milliseconds(1200))
            XCTAssertTrue(host.children.isEmpty);XCTAssertFalse(scope.current);return
        }
        try await wait("Return only after authored exit"){app.route != .gameplay}
        XCTAssertNil(game.parent);XCTAssertFalse(scope.current)
        XCTAssertEqual(app.route,board==nil ? .arcadeHub:.world((board!-1)/10+1))
        let durable=try XCTUnwrap(store.load())
        XCTAssertEqual(board==nil ? durable.arcadeRun?.score:durable.journeyRuns[board!]?.score,saved.score)
        let savedRun=try XCTUnwrap(board==nil ? durable.arcadeRun:durable.journeyRuns[board!])
        XCTAssertTrue(savedRun.validationIssues().isEmpty)
        XCTAssertFalse(savedRun.activeTiles.isEmpty)
        XCTAssertTrue(savedRun.activeTiles.allSatisfy{$0.alpha>0.01},"Exit must retain the pre-animation playable save, never collapsed visual state")
    }
}
