import XCTest
@testable import StackToSixGameplay

final class NativeSourceOrdinaryStackFaceTests:XCTestCase {
    private func engine(sourceDepth:Int=1,destinationDepth:Int=1,maxDepth:Int=1,enabled:Bool=true,sourceValue:Int=1,destinationValue:Int=2)->NativeGameplayEngine {
        var state=NativeBoardState(columns:5,rows:9,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:sourceValue,stackDepth:sourceDepth),.init(id:"b",cell:.init(column:1,row:0),value:destinationValue,stackDepth:destinationDepth),.init(id:"c",cell:.init(column:2,row:0),value:1),.init(id:"far",cell:.init(column:4,row:8),value:5)],rngState:12345)
        state.maxStackDepth=maxDepth
        let e=NativeGameplayEngine(state:state);e.stagedOrdinaryMoves=true;e.sourceOrdinaryStackFacesEnabled=enabled;return e
    }
    @discardableResult private func stack(_ e:NativeGameplayEngine,source:String="a",destination:NativeCell = .init(column:1,row:0),now:Double=0)throws->NativeSourceOrdinaryStackFaceReceipt {
        XCTAssertTrue(e.beginDrag(tileID:source,pointerID:7));XCTAssertTrue(e.drop(target:destination,pointerID:7,now:now).accepted)
        return try XCTUnwrap(e.pendingSourceOrdinaryStackFaces.last)
    }
    private func tile(_ e:NativeGameplayEngine,_ id:String)throws->NativeTile{try XCTUnwrap(e.state.tiles.first{$0.id==id})}
    func testDefaultDisabledPreservesImmediate205DepthAndMaximum()throws {
        let e=engine(sourceDepth:2,destinationDepth:2,enabled:false)
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(try tile(e,"b").stackDepth,4);XCTAssertEqual(e.state.maxStackDepth,4);XCTAssertTrue(e.pendingSourceOrdinaryStackFaces.isEmpty)
    }
    func testContactValueScoreImmediateButPhysicalDepthAndMaximumRemainOldUntilFace()throws {
        let e=engine(sourceDepth:2,destinationDepth:2,maxDepth:2),rng=e.state.rngState
        let face=try stack(e);XCTAssertEqual(face.value,3);XCTAssertEqual(face.addStack,2)
        XCTAssertEqual(try tile(e,"b").value,3);XCTAssertEqual(try tile(e,"b").stackDepth,2);XCTAssertEqual(e.state.maxStackDepth,2);XCTAssertEqual(e.state.score,3);XCTAssertEqual(e.state.moves,50);XCTAssertEqual(e.state.rngState,rng)
    }
    func testRealFaceCommitUpdatesPhysicalDepthMaxWithoutRevisionDebitOrRandom()throws {
        let e=engine(sourceDepth:2,destinationDepth:2,maxDepth:2),face=try stack(e),before=e.state,ledger=e.sourceMeterMutationSnapshot
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted)
        XCTAssertEqual(try tile(e,"b").stackDepth,4);XCTAssertEqual(e.state.maxStackDepth,4);XCTAssertEqual(e.state.revision,before.revision);XCTAssertEqual(e.state.score,before.score);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.sourceMeterMutationSnapshot,ledger);XCTAssertFalse(e.hasPendingSourceOrdinaryStackFace)
    }
    func testMain80CannotPretendSiblingFaceArrivedAndPostcheckRemainsRetryable()throws {
        let e=engine(),face=try stack(e),plan=try XCTUnwrap(e.pendingOrdinaryStack)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertNil(e.pendingOrdinaryStack)
        XCTAssertEqual(try tile(e,"b").stackDepth,1);XCTAssertEqual(e.state.maxStackDepth,1);XCTAssertEqual(e.resolve().reason,"captured_ordinary_face_pending");XCTAssertTrue(e.hasUnsavableSourceGameplayState)
        let before=e.state,postchecks=e.pendingOrdinaryPostchecks
        XCTAssertFalse(e.commitOrdinaryPostcheck(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertEqual(e.state,before);XCTAssertEqual(e.pendingOrdinaryPostchecks,postchecks)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted)
        XCTAssertTrue(e.commitOrdinaryPostcheck(receiptID:plan.id,generation:plan.generation).accepted);XCTAssertEqual(e.state.moves,49);XCTAssertFalse(e.hasUnsavableSourceGameplayState)
    }
    func testCancellationRetiresCapturedReceiptWithoutInventingPhysicalCommit()throws {
        let e=engine(sourceDepth:2,destinationDepth:2,maxDepth:2),face=try stack(e),before=e.state
        XCTAssertTrue(e.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,before);XCTAssertTrue(e.hasPendingSourceOrdinaryStackFace);XCTAssertEqual(e.unsettledSourceOrdinaryStackFaceCancellations,[face])
        XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,before)
    }
    func testDuplicateAndWrongGenerationDoNotStealLiveFace()throws {
        let e=engine(),face=try stack(e),before=e.state
        XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation+1).accepted);XCTAssertFalse(e.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation+1).accepted);XCTAssertEqual(e.state,before);XCTAssertEqual(e.pendingSourceOrdinaryStackFaces,[face])
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);let after=e.state
        XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,after)
    }
    func testGenerationReplacementClearsOldReceiptsAndPreservesNewSameIDs()throws {
        let e=engine(),face=try stack(e);var fresh=e.state;fresh.tiles.removeAll{$0.id=="a"};fresh.tiles[0].stackDepth=1;fresh.maxStackDepth=1
        e.restart(state:fresh);let before=e.state
        XCTAssertTrue(e.pendingSourceOrdinaryStackFaces.isEmpty);XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,before)
    }
    func testPureQueriesAndPausedRuntimeFlagsDoNotCommitOrCancelFace()throws {
        let e=engine(),face=try stack(e),before=e.state
        for _ in 0..<10 {_=e.resolve();_=e.hasUnsavableSourceGameplayState;_=e.sourceGameplaySignature;_=e.sourceMeterMutationSnapshot}
        XCTAssertEqual(e.state,before);XCTAssertEqual(e.pendingSourceOrdinaryStackFaces,[face]);XCTAssertFalse(e.sourceSaveRuntime.hasUnsavableTransientGameplayState)
    }
    func testSignatureReadsOldPhysicalDepthThenGenuineFaceDepth()throws {
        let e=engine(),face=try stack(e),signature=e.sourceGameplaySignature
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertNotEqual(e.sourceGameplaySignature,signature)
    }
    func testHistoricalMaximumNeverDropsAndDepthCapsAtFour()throws {
        let e=engine(sourceDepth:4,destinationDepth:3,maxDepth:4),face=try stack(e)
        XCTAssertEqual(e.state.maxStackDepth,4);XCTAssertEqual(try tile(e,"b").stackDepth,3)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(try tile(e,"b").stackDepth,4);XCTAssertEqual(e.state.maxStackDepth,4)
    }
    func testTargetFacesReplayCapturedFIFOAndLogicalValueJustAsOriginalSetValueVisuals()throws {
        let e=engine(),first=try stack(e),plan=try XCTUnwrap(e.pendingOrdinaryStack)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
        let second=try stack(e,source:"c",now:0.081),before=e.state
        XCTAssertEqual(try tile(e,"b").value,4);XCTAssertEqual(try tile(e,"b").stackDepth,1)
        XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:second.id,generation:second.generation).accepted);XCTAssertEqual(e.state,before)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:first.id,generation:first.generation).accepted);XCTAssertEqual(try tile(e,"b").value,3);XCTAssertEqual(try tile(e,"b").stackDepth,2)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:second.id,generation:second.generation).accepted);XCTAssertEqual(try tile(e,"b").value,4);XCTAssertEqual(try tile(e,"b").stackDepth,3)
    }
    func testCancellationOfEarlierTargetFaceAllowsLaterCapturedFIFOReceipt()throws {
        let e=engine(),first=try stack(e),plan=try XCTUnwrap(e.pendingOrdinaryStack)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
        // c→b is a second same-target receipt; cancelling the earlier captured
        // frame leaves later delivery based on physical depth which really exists.
        let second=try stack(e,source:"c",now:0.081)
        XCTAssertTrue(e.cancelSourceOrdinaryStackFace(receiptID:first.id,generation:first.generation).accepted)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:second.id,generation:second.generation).accepted);XCTAssertEqual(try tile(e,"b").stackDepth,2)
    }
    func testDestroyedPhysicalTargetRejectsCommitWithoutForcingCallback()throws {
        let e=engine(),face=try stack(e),before=e.state;e.noMovesTileRuntime["b"] = .init();e.noMovesTileRuntime["b"]?.destroyed=true
        XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,before);XCTAssertEqual(e.pendingSourceOrdinaryStackFaces,[face])
        XCTAssertTrue(e.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,before)
    }
    func testLiteralImmutableSource640FaceDepthMaximumAndDestroyedCallbackCases()throws {
        struct Value:Decodable {let value:Int,depth:Int,max:Int}
        struct Row:Decodable {let sourceValue:Int,destinationValue:Int,sourceDepth:Int,destinationDepth:Int,maximum:Int,cancelled:Bool,before:Value,after:Value}
        struct Oracle:Decodable {let tag:String,cases:[Row]}
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceOrdinaryStackFaceOracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url));XCTAssertEqual(oracle.tag,"production-benchmark-v9");XCTAssertEqual(oracle.cases.count,640)
        for row in oracle.cases {
            let e=engine(sourceDepth:row.sourceDepth,destinationDepth:row.destinationDepth,maxDepth:row.maximum,sourceValue:row.sourceValue,destinationValue:row.destinationValue),face=try stack(e)
            XCTAssertEqual(try tile(e,"b").value,row.before.value);XCTAssertEqual(try tile(e,"b").stackDepth,row.before.depth);XCTAssertEqual(e.state.maxStackDepth,row.before.max)
            if row.cancelled {XCTAssertTrue(e.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted)}
            else {XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted)}
            XCTAssertEqual(try tile(e,"b").value,row.after.value);XCTAssertEqual(try tile(e,"b").stackDepth,row.after.depth);XCTAssertEqual(e.state.maxStackDepth,row.after.max)
        }
    }
    func testNoMovesCandidateCannotSealAfterMainWhilePhysicalFaceIsStillUnobserved()throws {
        let e=engine(destinationValue:3);e.stagedSourceNoMoves=true
        let face=try stack(e),plan=try XCTUnwrap(e.pendingOrdinaryStack)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation).accepted)
        XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("gameplay-transaction-active"));XCTAssertNil(e.completedSourceNoMovesReceipt)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(try tile(e,"b").stackDepth,2)
    }

    func testCancelledLiveFaceRemainsUnsavableAfterMainRetiresUntilRealGenerationTeardown()throws {
        let e=engine(),face=try stack(e),plan=try XCTUnwrap(e.pendingOrdinaryStack)
        XCTAssertTrue(e.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted)
        XCTAssertTrue(e.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation,interrupted:true).accepted)
        XCTAssertNil(e.pendingOrdinaryStack);XCTAssertTrue(e.pendingOrdinaryPostchecks.isEmpty);XCTAssertTrue(e.pendingSourceOrdinaryStackFaces.isEmpty)
        XCTAssertTrue(e.hasUnsavableSourceGameplayState);XCTAssertEqual(e.resolve().reason,"captured_ordinary_face_pending");XCTAssertEqual(try tile(e,"b").stackDepth,1);XCTAssertEqual(e.state.maxStackDepth,1)
        let before=e.state;XCTAssertFalse(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);XCTAssertEqual(e.state,before)
        e.restart(state:before);XCTAssertTrue(e.unsettledSourceOrdinaryStackFaceCancellations.isEmpty);XCTAssertFalse(e.hasPendingSourceOrdinaryStackFace)
    }
    func testLateCancellationAfterActualCommitCannotInstallIncoherentModelBlock()throws {
        let e=engine(),face=try stack(e)
        XCTAssertTrue(e.commitSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted);let before=e.state
        XCTAssertFalse(e.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:face.generation).accepted)
        XCTAssertEqual(e.state,before);XCTAssertTrue(e.unsettledSourceOrdinaryStackFaceCancellations.isEmpty)
    }

}
