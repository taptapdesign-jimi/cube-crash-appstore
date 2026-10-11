import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeWildMeterActualRootTests:XCTestCase {
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(5))}
    }
    func testRestoredProductionRootUsesOriginalGainBounceTinySmokeAndRetiresThem()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("meter-hud-root-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        var board=NativeBoardFactory.make(mode:.journey,board:2,generation:9,seed:7)
        envelope.progression.completedJourneyBoards=[1]
        for index in board.tiles.indices{board.tiles[index].value=0;board.tiles[index].locked=true;board.tiles[index].alpha=0.25}
        for index in [0,1]{board.tiles[index].value=1;board.tiles[index].locked=false;board.tiles[index].alpha=1}
        board.wildMeter=0.1;envelope.journeyRuns[2]=board;try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController?{app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait("Home"){!app.home.isHidden};app.navigate(.world(1),interrupt:true)
        try await wait("World request"){if game() != nil{return true};app.world?.onRequest?("continue",2);return false}
        try await wait("Actual Source admission"){game()?.boardScene?.isBoardEntryComplete==true && game()?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game()),scene=try XCTUnwrap(gameplay.boardScene)
        XCTAssertTrue(scene.sourceTutorialMeterHUDReady,"Restored gameplay must mount the actual Source owner, not prototype fill")
        XCTAssertFalse(scene.sourceTutorialMeterSmokeFrozen)
        let loader=try XCTUnwrap(scene.childNode(withName:"//wildLoader"))
        let bounce=try XCTUnwrap(loader.childNode(withName:"//wildMeterFillBounceLayer"))
        func point(_ id:String)throws->CGPoint{let node=try XCTUnwrap(scene.sourceNativeTileNode(id));return scene.convert(node.position,from:try XCTUnwrap(node.parent))}
        let from=try point(board.tiles[0].id),to=try point(board.tiles[1].id)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait("Authored bounce"){abs(bounce.position.y)>0.2}
        try await wait("100ms orange bubbles"){scene.sourceTutorialMeterSmokeCount>0}
        let bubble=try XCTUnwrap(scene.childNode(withName:"//wild-meter-smoke") as? SKShapeNode)
        XCTAssertEqual(bubble.fillColor.cgColor.alpha,0.5,accuracy:0.00001)
        XCTAssertGreaterThan(bubble.frame.width,0)
        try await wait("Gain and spring settled"){scene.sourceTutorialMeterSmokeCount==0 && abs(bounce.position.y)<0.0001}
        XCTAssertGreaterThan(gameplay.engine.state.wildMeter,0.1);XCTAssertEqual(app.route,.gameplay)
        host.dispose();XCTAssertNil(loader.parent);XCTAssertNil(bubble.parent)
        try await Task.sleep(for:.milliseconds(120));XCTAssertEqual(scene.sourceTutorialMeterSmokeCount,0)
    }
}
