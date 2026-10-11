import XCTest
import Foundation
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceEndgameMutationLedgerTests:XCTestCase {
    func testFourthWriterReadsDateOnlyWhenActualSignatureChangesAndRetirementRemovesCoverage()throws {
        var dates=0;let ledger=NativeSourceEndgameMutationLedger(sourceDateMilliseconds:{dates+=1;return Double(dates)*1000})
        let binding=try XCTUnwrap(ledger.bind(current:{true}))
        XCTAssertNil(binding.captureSpawnInProgress())
        XCTAssertTrue(binding.publishInstalledWriters([.handoff,.ordinarySpawn,.wildSpawn,.tntSpawn],current:{true}))
        XCTAssertEqual(binding.captureSpawnInProgress(),false);XCTAssertFalse(ledger.allFourWritersConnected)
        XCTAssertEqual(binding.observeLevelCheckSignature("physical",current:{true}),true)
        XCTAssertEqual(binding.observeLevelCheckSignature("physical",current:{true}),false)
        XCTAssertEqual(dates,1);XCTAssertEqual(ledger.snapshot.lastSignature,"physical")
        XCTAssertTrue(binding.publishInstalledWriters([.handoff,.ordinarySpawn,.wildSpawn,.tntSpawn,.levelCheck],current:{true}))
        XCTAssertTrue(ledger.allFourWritersConnected);binding.retire();XCTAssertFalse(ledger.allFourWritersConnected)
        XCTAssertNil(binding.observeLevelCheckSignature("late",current:{true}));XCTAssertEqual(dates,1)
    }
    struct Oracle:Decodable {let rows:[Row];struct Row:Decodable {let events:[Event],trace:[Snapshot]};struct Event:Decodable {let kind:String,at:Double,id:String?};struct Snapshot:Decodable {let lastMutationAt:Double,dateCalls:Int,active:Int}}
    func testLiteralOriginalThreeHandoffLifecyclesFifteenSnapshots()throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceEndgameHandoffLedgerOracle",withExtension:"json")),oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url))
        XCTAssertEqual(oracle.rows.count,3)
        for row in oracle.rows {
            var now:Double=0,calls=0,receipts:[String:NativeSourceRegularHandoffMutationReceipt]=[:]
            let ledger=NativeSourceEndgameMutationLedger(sourceDateMilliseconds:{calls+=1;return now});var binding=try XCTUnwrap(ledger.bind(current:{true}))
            for (index,event) in row.events.enumerated() {
                now=event.at
                switch event.kind {
                case "begin":let receipt=NativeSourceRegularHandoffMutationReceipt(ownerID:event.id!,generation:1);receipts[event.id!]=receipt;XCTAssertTrue(binding.handoff(receipt,phase:.began))
                case "release":if let receipt=receipts[event.id!] {_=binding.handoff(receipt,phase:.released)}
                case "clear":binding.retire();binding=try XCTUnwrap(ledger.bind(current:{true}))
                case "read":_=ledger.snapshot
                default:XCTFail(event.kind)
                }
                XCTAssertEqual(ledger.snapshot.lastMutationAt,row.trace[index].lastMutationAt);XCTAssertEqual(calls,row.trace[index].dateCalls)
            }
            XCTAssertFalse(ledger.allFourWritersConnected);binding.retire();ledger.dispose()
        }
    }
    func testSnapshotsAndExplicitAgeQueriesNeverReadOrWriteDateAndZeroMeansInfinity()throws {
        var calls=0;let ledger=NativeSourceEndgameMutationLedger(sourceDateMilliseconds:{calls+=1;return 1000}),binding=try XCTUnwrap(ledger.bind(current:{true}))
        XCTAssertTrue(ledger.sinceMutation(at:400).isInfinite);_=ledger.snapshot;_=binding.snapshot;XCTAssertEqual(calls,0)
        let receipt=NativeSourceRegularHandoffMutationReceipt(ownerID:"real-A",generation:1);XCTAssertTrue(binding.handoff(receipt,phase:.began));XCTAssertEqual(calls,1)
        XCTAssertEqual(ledger.sinceMutation(at:1080),80);_=binding.snapshot;XCTAssertEqual(calls,1);binding.retire();ledger.dispose()
    }
    func testWrongBindingCannotRemoveAnotherCapturedTokenAndDuplicateReleaseNeverWritesDate()throws {
        var now:Double=1,calls=0;let ledger=NativeSourceEndgameMutationLedger(sourceDateMilliseconds:{calls+=1;return now}),a=try XCTUnwrap(ledger.bind(current:{true})),c=try XCTUnwrap(ledger.bind(current:{true}))
        let receipt=NativeSourceRegularHandoffMutationReceipt(ownerID:"A",generation:1);XCTAssertTrue(a.handoff(receipt,phase:.began));now=2
        XCTAssertFalse(c.handoff(receipt,phase:.released));XCTAssertTrue(a.handoff(receipt,phase:.released));XCTAssertFalse(a.handoff(receipt,phase:.released));XCTAssertEqual(calls,2);XCTAssertEqual(ledger.snapshot.sequence,2)
        a.retire();c.retire();ledger.dispose()
    }
    func testRealContextReplacementPreservesDateWithoutCopyingMeterLedgerOrInventingRelease()throws {
        var now:Double=1000;let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),context=NativeGameplaySourceContext(service:service,sourceDateMilliseconds:{now})
        defer{context.dispose();service.dispose()};let a=try XCTUnwrap(context.beginScene(retire:{})),binding=try XCTUnwrap(a.bindEndgameMutations(current:{a.current})),receipt=NativeSourceRegularHandoffMutationReceipt(ownerID:"A",generation:1)
        XCTAssertTrue(binding.handoff(receipt,phase:.began));now=2000;let c=try XCTUnwrap(context.beginScene(retire:{}));XCTAssertFalse(a.current);XCTAssertTrue(c.current);XCTAssertTrue(binding.retired)
        XCTAssertFalse(binding.handoff(receipt,phase:.released));XCTAssertEqual(context.endgameMutations.snapshot.lastMutationAt,1000)
        XCTAssertFalse(context.endgameMutations.allFourWritersConnected)
    }
    func testExternalDateReentryReplacementCannotOverwriteNewScopeTimestamp()throws {
        var context:NativeGameplaySourceContext!,replace=false,now:Double=1000
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        context=NativeGameplaySourceContext(service:service,sourceDateMilliseconds:{if replace {replace=false;_=context.beginScene(retire:{})};return now})
        defer{context.dispose();service.dispose()};let a=try XCTUnwrap(context.beginScene(retire:{})),binding=try XCTUnwrap(a.bindEndgameMutations(current:{a.current})),receipt=NativeSourceRegularHandoffMutationReceipt(ownerID:"A",generation:1)
        XCTAssertTrue(binding.handoff(receipt,phase:.began));let before=context.endgameMutations.snapshot;now=2000;replace=true
        XCTAssertFalse(binding.handoff(receipt,phase:.released));XCTAssertEqual(context.endgameMutations.snapshot,before);XCTAssertTrue(binding.retired)
    }
    func testTntBonusDatesUseDistinctWritesAndSurviveScopeReplacementWithoutReadSideEffects()throws {
        var now=1000.0,reads=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let context=NativeGameplaySourceContext(service:service,sourceDateMilliseconds:{reads+=1;return now})
        defer{context.dispose();service.dispose()}
        let a=try XCTUnwrap(context.beginScene(retire:{}))
        XCTAssertEqual(a.captureTntBonusDates()?.guardUntil,0);XCTAssertEqual(reads,0)
        XCTAssertTrue(a.extendTntBonusGuard(milliseconds:3200));XCTAssertEqual(reads,1)
        now=2000;XCTAssertTrue(a.recordTntBonusReplacement());XCTAssertEqual(reads,3)
        XCTAssertEqual(a.captureTntBonusDates()?.lastChangeAt,2000);XCTAssertEqual(a.captureTntBonusDates()?.guardUntil,4200)
        let c=try XCTUnwrap(context.beginScene(retire:{}));XCTAssertNil(a.captureTntBonusDates())
        XCTAssertEqual(c.captureTntBonusDates()?.lastChangeAt,2000);XCTAssertEqual(reads,3)
        XCTAssertFalse(a.extendTntBonusGuard(milliseconds:9999));XCTAssertEqual(reads,3)
        XCTAssertFalse(context.endgameMutations.allFourWritersConnected)
    }
    func testTntBonusDateReentryCannotOverwriteSuccessorGuard()throws {
        var context:NativeGameplaySourceContext!,replace=false,successor:NativeGameplaySourceContext.Scope?
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        context=NativeGameplaySourceContext(service:service,sourceDateMilliseconds:{
            if replace {replace=false;successor=context.beginScene(retire:{});XCTAssertTrue(successor?.extendTntBonusGuard(milliseconds:7000)==true)}
            return 1000
        })
        defer{context.dispose();service.dispose()};let a=try XCTUnwrap(context.beginScene(retire:{}))
        replace=true;XCTAssertFalse(a.extendTntBonusGuard(milliseconds:99999))
        XCTAssertEqual(successor?.captureTntBonusDates()?.guardUntil,8000)
    }

}
