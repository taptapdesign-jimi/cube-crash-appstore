import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMergeSixSpawnOwnerTests:XCTestCase {
    @MainActor private final class Box {var now:Double=1000,calls=0,trace:[String]=[]}
    @MainActor private final class Fixture {
        let box=Box(),service:NativeSourceAnimationClockService,ledger:NativeSourceEndgameMutationLedger,binding:NativeSourceEndgameMutationLedger.Binding,engine:NativeGameplayEngine,receipt:NativeSourceOrdinarySixSpawnBeginReceipt
        init()throws {
            let b=box;service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            ledger=NativeSourceEndgameMutationLedger(sourceDateMilliseconds:{b.calls+=1;b.trace.append("date");return b.now})
            binding=try XCTUnwrap(ledger.bind(current:{true}))
            engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:5),.init(id:"o",cell:.init(column:2,row:0),value:4)]))
            engine.stagedOrdinaryMoves=true;engine.stagedOrdinaryAssignments=true;engine.sourceOrdinarySixSpawnBeginReceiptsEnabled=true
            XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            let p=try XCTUnwrap(engine.pendingOrdinarySix);XCTAssertTrue(engine.commitOrdinarySix(receiptID:p.id,generation:p.generation).accepted)
            receipt=try XCTUnwrap(engine.pendingSourceOrdinarySixSpawnBeginReceipts.first)
        }
        var resets:NativeSourceMergeSixSpawnOwner.ResetBindings {let b=box;return .init(endResolutionFrames:{b.trace.append("end-frames")},releaseSpecialTransaction:{b.trace.append("release-special")},queueWildAfterGuardRelease:{b.trace.append("queue")})}
        func begin(receipt r:NativeSourceOrdinarySixSpawnBeginReceipt?=nil)->NativeSourceMergeSixSpawnOwner.Claim? {let e=engine,r=r ?? receipt;return binding.beginSpawn(r,service:service,resets:resets,current:{r.id != self.receipt.id || e.sourceOrdinarySixSpawnBeginIsCurrent(r)})}
        func dispose(){binding.retire();ledger.dispose();service.dispose()}
    }
    func testActualTokenAssignedBeforeDateAndDiagnosticDoesNotReleaseAfterTwoPointFiveGSAPSeconds()throws {
        let f=try Fixture();defer{f.dispose()};let claim=try XCTUnwrap(f.begin())
        XCTAssertEqual(claim.token,1);XCTAssertTrue(f.ledger.mergeSixSpawns.inProgress);XCTAssertEqual(f.box.calls,1)
        XCTAssertTrue(f.ledger.mergeSixSpawns.resetDiagnosticActive);f.service.deliver(wallMilliseconds:500)
        f.service.setSourceGlobalPaused(true);for t in stride(from:1000.0,through:4000,by:500){f.service.deliver(wallMilliseconds:t)}
        XCTAssertTrue(f.ledger.mergeSixSpawns.resetDiagnosticActive);XCTAssertTrue(f.ledger.mergeSixSpawns.owns(claim))
        f.service.setSourceGlobalPaused(false);for t in stride(from:4500.0,through:7000,by:500){f.service.deliver(wallMilliseconds:t)}
        XCTAssertFalse(f.ledger.mergeSixSpawns.resetDiagnosticActive);XCTAssertTrue(f.ledger.mergeSixSpawns.owns(claim));XCTAssertEqual(f.box.calls,1)
        XCTAssertFalse(f.ledger.allFourWritersConnected)
    }
    func testOwnedResetOrdersCompanionsAndNeverWritesDateOrAcceptsAnotherActiveClaim()throws {
        let f=try Fixture();defer{f.dispose()};let a=try XCTUnwrap(f.begin());XCTAssertNil(f.begin());XCTAssertEqual(f.box.calls,1)
        XCTAssertTrue(f.binding.resetSpawn(a));XCTAssertEqual(f.box.trace,["date","end-frames","release-special","queue"]);XCTAssertEqual(f.box.calls,1)
        XCTAssertNil(f.begin());let next=try Fixture();defer{next.dispose()};let c=try XCTUnwrap(f.begin(receipt:next.receipt));XCTAssertEqual(c.token,2);XCTAssertFalse(f.binding.resetSpawn(a));XCTAssertTrue(f.ledger.mergeSixSpawns.owns(c))
        XCTAssertEqual(f.box.calls,2);XCTAssertTrue(f.binding.resetSpawn(c))
    }
    func testCapturedBindingRetirementResetsCurrentTokenOnceWithoutInventingDate()throws {
        let f=try Fixture();defer{f.dispose()};let claim=try XCTUnwrap(f.begin()),before=f.ledger.snapshot
        f.binding.retire();f.binding.retire();XCTAssertFalse(f.ledger.mergeSixSpawns.owns(claim));XCTAssertEqual(f.ledger.snapshot,before)
        XCTAssertEqual(f.box.trace,["date","end-frames","release-special","queue"])
    }
    func testDateProviderReentrantRetirementCannotInstallDiagnosticOrReviveObsoleteToken()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        var binding:NativeSourceEndgameMutationLedger.Binding?,calls=0
        let ledger=NativeSourceEndgameMutationLedger(sourceDateMilliseconds:{calls+=1;binding?.retire();return 999})
        defer{ledger.dispose();service.dispose()};binding=try XCTUnwrap(ledger.bind(current:{true}))
        let f=try Fixture();defer{f.dispose()}
        XCTAssertNil(binding?.beginSpawn(f.receipt,service:service,resets:f.resets,current:{true}))
        XCTAssertEqual(calls,1);XCTAssertFalse(ledger.mergeSixSpawns.inProgress);XCTAssertFalse(ledger.mergeSixSpawns.resetDiagnosticActive)
        XCTAssertEqual(ledger.snapshot.lastMutationAt,0);XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testResetReentryNewClaimSurvivesAndOldReleaseCannotContinueIntoItsSpecialOrQueue()throws {
        let f=try Fixture(),next=try Fixture();defer{f.dispose();next.dispose()};var c:NativeSourceMergeSixSpawnOwner.Claim?
        let resets=NativeSourceMergeSixSpawnOwner.ResetBindings(endResolutionFrames:{c=f.begin(receipt:next.receipt)},releaseSpecialTransaction:{f.box.trace.append("old-special")},queueWildAfterGuardRelease:{f.box.trace.append("old-queue")})
        let a=try XCTUnwrap(f.binding.beginSpawn(f.receipt,service:f.service,resets:resets,current:{true}))
        XCTAssertTrue(f.binding.resetSpawn(a));XCTAssertTrue(f.ledger.mergeSixSpawns.owns(try XCTUnwrap(c)))
        XCTAssertFalse(f.box.trace.contains("old-special"));XCTAssertFalse(f.box.trace.contains("old-queue"))
    }
    func testGenuineWildEntrySharesTheAppTokenAndDateWithoutOrdinaryReceiptFabrication()throws {
        let f=try Fixture();defer{f.dispose()}
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.juice),
            .init(id:"dst",cell:.init(column:1,row:0),value:5),
            .init(id:"other",cell:.init(column:4,row:8),value:2)],board:10),recordedRandomChoices:Array(repeating:0.2,count:200))
        engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true
        XCTAssertNil(f.binding.captureSpawnInProgress())
        var captured:NativeSourceWildSpawnBeginReceipt?,claim:NativeSourceMergeSixSpawnOwner.Claim?
        engine.sourceWildSpawnBegin={receipt in
            captured=receipt
            claim=f.binding.beginWildSpawn(receipt,service:f.service,resets:f.resets,current:{engine.sourceWildSpawnBeginIsCurrent(receipt)})
            return claim != nil
        }
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingDirectWild)
        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
        let receipt=try XCTUnwrap(captured),actual=try XCTUnwrap(claim)
        XCTAssertEqual(actual.ownerID,plan.id);XCTAssertEqual(f.box.calls,1)
        XCTAssertTrue(f.ledger.mergeSixSpawns.inProgress)
        XCTAssertEqual(f.binding.captureSpawnInProgress(),true)
        XCTAssertNil(f.binding.beginWildSpawn(receipt,service:f.service,resets:f.resets,current:{true}))
        XCTAssertTrue(f.binding.resetSpawn(actual));XCTAssertEqual(f.box.calls,1)
        XCTAssertNil(f.binding.captureSpawnInProgress())
        XCTAssertEqual(f.box.trace,["date","end-frames","release-special","queue"])
        XCTAssertFalse(f.ledger.allFourWritersConnected,"Direct acquisition does not fabricate missing global mutation writers")
    }

    func testGenuineTntReceiptUsesSharedTokenAndDateButSpawnResetCannotReleaseBonus()throws {
        let f=try Fixture();defer{f.dispose()}
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"tnt",cell:.init(column:0,row:0),value:6,archetype:.tnt),
            .init(id:"dst",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:8),value:3)],mode:.arcade),recordedRandomChoices:Array(repeating:0.2,count:100))
        engine.stagedTntActivation=true;engine.stagedTntWildSpawnAssignments=true
        var claim:NativeSourceMergeSixSpawnOwner.Claim?
        engine.sourceTntSpawnBegin={receipt in
            claim=f.binding.beginTntSpawn(receipt,service:f.service,
                resets:.init(endResolutionFrames:{f.box.trace.append("tnt-frames")},releaseSpecialTransaction:{f.box.trace.append("unexpected-special")},
                    queueWildAfterGuardRelease:{f.box.trace.append("queue")}),
                current:{engine.sourceTntSpawnBeginIsCurrent(receipt)})
            return claim != nil
        }
        engine.sourceTntCoroutineFinally={_,_ in guard let claim else{return false};return f.binding.resetSpawn(claim,releaseSpecial:false)}
        XCTAssertTrue(engine.beginDrag(tileID:"tnt"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let plan=try XCTUnwrap(engine.pendingSpecial)
        XCTAssertTrue(engine.commitSpecialActivation(transactionID:plan.id).accepted)
        XCTAssertNotNil(claim);XCTAssertEqual(f.box.calls,1);XCTAssertEqual(f.binding.captureSpawnInProgress(),true)
        XCTAssertNil(engine.pendingDirectWild);XCTAssertNil(engine.sourceWildSpawnBeginReceipt)
        let action=try XCTUnwrap(engine.pendingWildSpawnActions.first)
        XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
        let arrival=try XCTUnwrap(engine.pendingWildSpawnArrivals.first)
        XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
        XCTAssertEqual(f.box.trace,["date","tnt-frames","queue"]);XCTAssertEqual(f.box.calls,1)
        XCTAssertEqual(engine.pendingSpecial?.id,plan.id,"Actual bonus owner survives spawn reset")
        XCTAssertNil(f.binding.captureSpawnInProgress(),"Unmapped app callers cannot invent global false")
    }

}
