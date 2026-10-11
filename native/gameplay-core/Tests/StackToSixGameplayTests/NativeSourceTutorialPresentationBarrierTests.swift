import XCTest
@testable import StackToSixGameplay
final class NativeSourceTutorialPresentationBarrierTests:XCTestCase {
    func make()throws->NativeGameplayEngine {
        let engine=NativeGameplayEngine(state:NativeTutorialTests().board(),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.startTutorial().accepted);engine.sourceTutorialPresentationBarrierEnabled=true
        let pair=try XCTUnwrap(engine.state.tutorial?.guidedPair)
        XCTAssertTrue(engine.beginDrag(tileID:pair[0]));XCTAssertTrue(engine.drop(target:try XCTUnwrap(engine.state.tiles.first{$0.id==pair[1]}).cell).accepted)
        return engine
    }
    func testCanonicalSaveContainsNoLiveBarrierAndNextGestureWaitsForCapturedCompletion()throws {
        let engine=try make(),receipt=try XCTUnwrap(engine.pendingSourceTutorialPresentationBarrier)
        XCTAssertEqual(engine.state.tutorial?.step,.mergeSix);XCTAssertFalse(engine.beginDrag(tileID:receipt.oneID))
        let snapshot=engine.state,decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(snapshot))
        let relaunched=NativeGameplayEngine(state:decoded);XCTAssertTrue(relaunched.beginDrag(tileID:receipt.oneID))
        XCTAssertTrue(engine.completeSourceTutorialPresentationBarrier(receipt));XCTAssertEqual(engine.state,snapshot)
        XCTAssertFalse(engine.completeSourceTutorialPresentationBarrier(receipt));XCTAssertTrue(engine.beginDrag(tileID:receipt.oneID))
    }
    func testStaleReceiptCannotUnlockAnotherOwnerOrRestartedBoard()throws {
        let engine=try make(),receipt=try XCTUnwrap(engine.pendingSourceTutorialPresentationBarrier)
        engine.setInputLock("another-owner",active:true);XCTAssertTrue(engine.completeSourceTutorialPresentationBarrier(receipt))
        XCTAssertFalse(engine.beginDrag(tileID:receipt.oneID));engine.setInputLock("another-owner",active:false)
        XCTAssertTrue(engine.beginDrag(tileID:receipt.oneID));engine.cancelDrag();engine.restart(state:engine.state)
        XCTAssertNil(engine.pendingSourceTutorialPresentationBarrier);XCTAssertFalse(engine.completeSourceTutorialPresentationBarrier(receipt))
    }
    func testRetirementIsExactAndDoesNotRewriteSavedStep()throws {
        let engine=try make(),receipt=try XCTUnwrap(engine.pendingSourceTutorialPresentationBarrier),saved=engine.state
        XCTAssertTrue(engine.retireSourceTutorialPresentationBarrier(receipt));XCTAssertFalse(engine.retireSourceTutorialPresentationBarrier(receipt));XCTAssertEqual(engine.state,saved)
    }
    func testSecondMergeBarrierPreservesCanonicalFreePlayAndOnlyReleasesCapturedLock()throws {
        let engine=try make(),first=try XCTUnwrap(engine.pendingSourceTutorialPresentationBarrier)
        XCTAssertTrue(engine.completeSourceTutorialPresentationBarrier(first));engine.sourceTutorialSubsequentPresentationEnabled=true
        XCTAssertTrue(engine.beginDrag(tileID:first.oneID))
        XCTAssertTrue(engine.drop(target:try XCTUnwrap(engine.state.tiles.first{$0.id==first.mergedID}).cell).accepted)
        let second=try XCTUnwrap(engine.pendingSourceTutorialPresentationBarrier),saved=engine.state
        XCTAssertEqual(second.phase,.secondMerge);XCTAssertEqual(saved.tutorial?.step,.freePlay)
        XCTAssertFalse(engine.completeSourceTutorialPresentationBarrier(first))
        engine.setInputLock("other-owner",active:true);XCTAssertTrue(engine.completeSourceTutorialPresentationBarrier(second))
        XCTAssertEqual(engine.state,saved);XCTAssertFalse(engine.beginDrag(tileID:try XCTUnwrap(engine.state.activeTiles.first).id))
        XCTAssertFalse(engine.completeSourceTutorialPresentationBarrier(second))
    }

    func testSourceSecondPreparationNormalizesGuidedDepthWithoutInventingAccounting()throws {
        let engine=try make(),receipt=try XCTUnwrap(engine.pendingSourceTutorialPresentationBarrier)
        let before=engine.state
        XCTAssertEqual(before.tiles.first{$0.id==receipt.mergedID}?.stackDepth,2)
        engine.sourceTutorialSubsequentPresentationEnabled=true
        XCTAssertTrue(engine.completeSourceTutorialPresentationBarrier(receipt))
        var expected=before
        for index in expected.tiles.indices where expected.tiles[index].id==receipt.mergedID || expected.tiles[index].id==receipt.oneID {
            expected.tiles[index].stackDepth=1
        }
        XCTAssertEqual(engine.state,expected)
        XCTAssertFalse(engine.completeSourceTutorialPresentationBarrier(receipt))
        XCTAssertTrue(engine.beginDrag(tileID:receipt.oneID))
    }

}
