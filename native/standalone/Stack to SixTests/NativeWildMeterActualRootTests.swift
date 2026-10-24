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
    func testRestoredProductionRootKeepsGainOnBaselineWithTinySmokeAndRetiresThem()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("meter-hud-root-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        var board=NativeBoardFactory.make(mode:.journey,board:2,generation:9,seed:7)
        envelope.progression.completedJourneyBoards=[1]
        for index in board.tiles.indices{board.tiles[index].value=0;board.tiles[index].locked=true;board.tiles[index].alpha=0.25}
        for index in [0,1]{board.tiles[index].value=1;board.tiles[index].locked=false;board.tiles[index].alpha=1}
        // Only a run with a committed move is resumable under current save policy.
        board.moves=board.maxMoves-1
        board.wildMeter=0.1;envelope.journeyRuns[2]=board
        envelope.journeyRunSavedAt[2]=Date().timeIntervalSince1970
        try store.save(envelope)
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
        func assertSavedFill(file:StaticString=#filePath,line:UInt=#line)throws {
            let loader=try XCTUnwrap(scene.childNode(withName:"//wildLoader"),file:file,line:line)
            let track=try XCTUnwrap(loader.children.compactMap{$0 as? SKShapeNode}.first?.path,file:file,line:line)
            let fill=try XCTUnwrap(loader.childNode(withName:"//wildMeterFillBounceLayer")?.children.compactMap{$0 as? SKShapeNode}.first?.path,file:file,line:line)
            XCTAssertEqual(fill.boundingBox.width,track.boundingBox.width*0.1,accuracy:0.001,"Saved charge visible before any move",file:file,line:line)
            XCTAssertEqual(gameplay.engine.state.wildMeter,0.1,accuracy:0.000001,file:file,line:line)
        }
        try assertSavedFill()
        let originalSize=scene.size
        scene.layout(size:CGSize(width:originalSize.width+8,height:originalSize.height),insets:.zero)
        try assertSavedFill()
        scene.layout(size:originalSize,insets:window.safeAreaInsets)
        try assertSavedFill()

        let loader=try XCTUnwrap(scene.childNode(withName:"//wildLoader"))
        let bounce=try XCTUnwrap(loader.childNode(withName:"//wildMeterFillBounceLayer"))
        func point(_ id:String)throws->CGPoint{let node=try XCTUnwrap(scene.sourceNativeTileNode(id));return scene.convert(node.position,from:try XCTUnwrap(node.parent))}
        let from=try point(board.tiles[0].id),to=try point(board.tiles[1].id)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        for _ in 0..<10 {
            XCTAssertEqual(bounce.position.y,0,accuracy:0.0001,"Gameplay meter stays on its horizontal baseline")
            try await Task.sleep(for:.milliseconds(10))
        }
        try await wait("100ms orange bubbles"){scene.sourceTutorialMeterSmokeCount>0}
        let bubble=try XCTUnwrap(scene.childNode(withName:"//wild-meter-smoke") as? SKShapeNode)
        XCTAssertEqual(bubble.fillColor.cgColor.alpha,0.5,accuracy:0.00001)
        XCTAssertGreaterThan(bubble.frame.width,0)
        // A real gameplay refresh must not repaint owner-controlled particle
        // opacity. Pure smoke-plan tests cannot catch a HUD sibling overwrite.
        try await wait("Moving bubble has partial opacity"){bubble.parent != nil && bubble.alpha>0.05 && bubble.alpha<0.6}
        for refresh in 0..<3 {
            let particles=try XCTUnwrap(bubble.parent).children.filter{$0.name=="wild-meter-smoke"}
            XCTAssertFalse(particles.isEmpty)
            let before=particles.map{($0,$0.alpha,$0.position,$0.parent?.alpha)}
            scene.synchronize()
            for (particle,alpha,position,parentAlpha) in before {
                NSLog("[METER_FLASH] refresh=%d modelBefore=%.6f modelAfter=%.6f parentBefore=%.6f parentAfter=%.6f x=%.3f y=%.3f",refresh,Double(alpha),Double(particle.alpha),Double(parentAlpha ?? -1),Double(particle.parent?.alpha ?? -1),Double(position.x),Double(position.y))
                XCTAssertEqual(particle.alpha,alpha,accuracy:0.000001,"Gameplay synchronization must preserve the live smoke owner's opacity")
                XCTAssertEqual(particle.position,position,"Synchronization must not restart the flight")
                XCTAssertEqual(particle.parent?.alpha,parentAlpha,"The parent must not introduce a synchronized brightness flash")
            }
        }
        try await wait("Gain and spring settled"){scene.sourceTutorialMeterSmokeCount==0 && abs(bounce.position.y)<0.0001}
        XCTAssertGreaterThan(gameplay.engine.state.wildMeter,0.1);XCTAssertEqual(app.route,.gameplay)
        host.dispose();XCTAssertNil(loader.parent);XCTAssertNil(bubble.parent)
        try await Task.sleep(for:.milliseconds(120));XCTAssertEqual(scene.sourceTutorialMeterSmokeCount,0)
    }
}
