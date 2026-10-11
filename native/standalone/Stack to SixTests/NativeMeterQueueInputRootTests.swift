import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeMeterQueueInputRootTests:XCTestCase {
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
        envelope.progression.completedJourneyBoards=Set(1..<21)
        var board=NativeBoardFactory.make(mode:.journey,board:21,generation:9,seed:7)
        for index in board.tiles.indices {board.tiles[index].value=0;board.tiles[index].locked=true;board.tiles[index].alpha=0.25}
        for(index,value)in [(0,3),(1,3),(2,1),(3,2),(4,2),(40,6)] {
            board.tiles[index].value=value;board.tiles[index].locked=false;board.tiles[index].alpha=1
        }
        board.tiles[40].archetype = .star
        let priorWildID=board.tiles[40].id,ordinaryID=board.tiles[2].id,targetID=board.tiles[3].id
        board.wildMeter=0.95;envelope.journeyRuns[21]=board;try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait("home"){!app.home.isHidden};app.navigate(.world(3),interrupt:true)
        try await wait("world-play") {if game() != nil{return true};app.world?.onRequest?("continue",21);return false}
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
    }
}
