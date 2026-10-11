import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceTutorialDemoPrefixTests:XCTestCase {
    private func sourceCases()throws->[[String:Any]] {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceTutorialPreparationV9Oracle",withExtension:"json"))
        let json=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        return json["cases"] as! [[String:Any]]
    }
    private func state(_ c:[String:Any])->NativeBoardState {
        let tiles=(c["before"] as! [[String:Any]]).map{item in
            NativeTile(id:item["id"] as! String,cell:.init(column:item["c"] as! Int,row:item["r"] as! Int),value:item["value"] as! Int,stackDepth:item["depth"] as! Int,locked:item["locked"] as! Bool,visible:item["visible"] as! Bool,alpha:item["alpha"] as! Double)
        }
        return .init(columns:c["columns"] as! Int,rows:9,tiles:tiles,mode:.arcade,board:1,stage:1,generation:1,revision:7,moves:42,score:130,wildMeter:0.4,rngState:123)
    }
    func testDemoPrefixMatchesActualOriginalPreparationWithoutRewritingOtherValues()throws {
        for c in try sourceCases() where c["demoReady"] as! Bool {
            let before=state(c);var draws=0
            let engine=NativeGameplayEngine(state:before,sourceMathRandom:.init(draw:{draws+=1;return 0.4}))
            engine.sourceTutorialDemoActivationEnabled=true
            let receipt=try XCTUnwrap(engine.beginSourceTutorialDemoActivation())
            XCTAssertEqual(engine.state.tiles,before.tiles);XCTAssertFalse(engine.beginDrag(tileID:receipt.threeID));XCTAssertEqual(draws,0)
            let result=engine.commitSourceTutorialDemoPreparation(receiptID:receipt.id,generation:receipt.generation)
            XCTAssertTrue(result.accepted);XCTAssertNil(engine.pendingSourceTutorialDemoActivation)
            for item in c["after"] as! [[String:Any]] {
                let tile=try XCTUnwrap(engine.state.tiles.first{$0.id==item["id"] as! String})
                XCTAssertEqual(tile.value,item["value"] as! Int);XCTAssertEqual(tile.locked,item["locked"] as! Bool)
                XCTAssertEqual(tile.stackDepth,item["depth"] as! Int);XCTAssertEqual(tile.alpha,item["alpha"] as! Double)
                XCTAssertEqual(tile.visible,item["visible"] as! Bool)
            }
            XCTAssertEqual(engine.state.tutorial?.guidedPair,(c["targets"] as! [String:Any])["pair"] as? [String])
            XCTAssertEqual(engine.state.tutorial?.oneTileID,(c["targets"] as! [String:Any])["one"] as? String)
            XCTAssertEqual(engine.state.revision,before.revision);XCTAssertEqual(engine.state.score,before.score);XCTAssertEqual(engine.state.moves,before.moves);XCTAssertEqual(engine.state.rngState,before.rngState);XCTAssertEqual(engine.state.wildMeter,before.wildMeter);XCTAssertEqual(draws,0)
            XCTAssertTrue(engine.beginDrag(tileID:receipt.threeID));engine.cancelDrag()
            XCTAssertFalse(engine.commitSourceTutorialDemoPreparation(receiptID:receipt.id,generation:receipt.generation).accepted)
        }
    }
    func testDefaultDisabledRefusesBeforeChangingStateOrInput()throws {
        let s=state(try sourceCases()[0]),e=NativeGameplayEngine(state:s)
        XCTAssertNil(e.beginSourceTutorialDemoActivation());XCTAssertEqual(e.state,s);XCTAssertNil(e.pendingSourceTutorialDemoActivation)
        XCTAssertTrue(e.beginDrag(tileID:s.activeTiles[0].id))
    }
    func testOriginalRawStartStillRewritesAsBeforeWhileSourceDemoDoesNot()throws {
        let s=state(try sourceCases()[0]),raw=NativeGameplayEngine(state:s)
        XCTAssertTrue(raw.startTutorial().accepted);XCTAssertEqual(raw.state.revision,s.revision+1)
        XCTAssertNotEqual(raw.state.tiles.first{$0.cell == .init(column:0,row:0)}?.value,s.tiles.first{$0.cell == .init(column:0,row:0)}?.value)
    }
    func testNonDemoBoardAndUnmappedWildRefuseBeforeMutation()throws {
        var s=state(try sourceCases()[0]);s.tiles[0].value=5
        let e=NativeGameplayEngine(state:s);e.sourceTutorialDemoActivationEnabled=true
        XCTAssertNil(e.beginSourceTutorialDemoActivation());XCTAssertEqual(e.state,s)
        s=state(try sourceCases()[0]);s.tiles[0].archetype = .star;s.tiles[0].value=6;s.tiles[0].locked=false
        let wild=NativeGameplayEngine(state:s);wild.sourceTutorialDemoActivationEnabled=true
        XCTAssertNil(wild.beginSourceTutorialDemoActivation());XCTAssertEqual(wild.state,s)
    }
    func testCancelledActivationHasNoForcedPreparationOrRandomDraw()throws {
        let s=state(try sourceCases()[0]);var draws=0
        let e=NativeGameplayEngine(state:s,sourceMathRandom:.init(draw:{draws+=1;return 0.9}));e.sourceTutorialDemoActivationEnabled=true
        let r=try XCTUnwrap(e.beginSourceTutorialDemoActivation())
        XCTAssertTrue(e.cancelSourceTutorialDemoActivation(receiptID:r.id,generation:r.generation));XCTAssertEqual(e.state,s)
        XCTAssertFalse(e.cancelSourceTutorialDemoActivation(receiptID:r.id,generation:r.generation));XCTAssertFalse(e.commitSourceTutorialDemoPreparation(receiptID:r.id,generation:r.generation).accepted);XCTAssertEqual(draws,0)
    }
    func testActualRestartRetiresOldReceiptWithoutRecreatingOldGuidedPair()throws {
        let s=state(try sourceCases()[0]),e=NativeGameplayEngine(state:s);e.sourceTutorialDemoActivationEnabled=true
        let r=try XCTUnwrap(e.beginSourceTutorialDemoActivation());var fresh=s;fresh.score=990;e.restart(state:fresh);let restarted=e.state
        XCTAssertNil(e.pendingSourceTutorialDemoActivation);XCTAssertFalse(e.commitSourceTutorialDemoPreparation(receiptID:r.id,generation:r.generation).accepted);XCTAssertFalse(e.cancelSourceTutorialDemoActivation(receiptID:r.id,generation:r.generation));XCTAssertEqual(e.state,restarted)
    }
    func testBusyCapturedBoardCannotInstallOrCommitTutorialPrefix()throws {
        let s=state(try sourceCases()[0]),e=NativeGameplayEngine(state:s);e.sourceTutorialDemoActivationEnabled=true
        var flags=NativeGameplayRuntimeFlags();flags.wildSpawnInProgress=true;e.setRuntimeFlags(flags)
        XCTAssertNil(e.beginSourceTutorialDemoActivation());XCTAssertEqual(e.state,s)
        e.setRuntimeFlags(.init());let r=try XCTUnwrap(e.beginSourceTutorialDemoActivation());e.setRuntimeFlags(flags);let captured=e.state
        XCTAssertFalse(e.commitSourceTutorialDemoPreparation(receiptID:r.id,generation:r.generation).accepted);XCTAssertEqual(e.state,captured);XCTAssertEqual(e.pendingSourceTutorialDemoActivation,r)
    }
}
