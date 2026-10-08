import XCTest
@testable import Stack_to_Six

final class NativeBoardFrameCadenceTests:XCTestCase {
    func testOriginalV9NativeBenchmarkAndCurrentLeaseSessionsMatchEveryDecision() {
        let payload=NativeBoardFrameCadenceSourceOracle.payload
        XCTAssertEqual(payload.hashes.count,3);XCTAssertEqual(Set(payload.hashes.map(\.sha256)).count,1)
        XCTAssertEqual(payload.records.count,10)
        var states=0
        for record in payload.records {
            let owner=NativeBoardFrameCadence(isMobileRuntime:record.mobile)
            var leases:[String:NativeBoardFrameCadence.Lease]=[:]
            for (index,op) in record.ops.enumerated() {
                switch op.kind {
                case "start":owner.start(tickerID:op.ticker,nowMs:op.at)
                case "stop":owner.stop(nowMs:op.at)
                case "tick":owner.advance(nowMs:op.at)
                case "acquire":leases[op.key!]=owner.acquireActivity(label:op.key!,releaseTailMs:op.tail ?? 180,nowMs:op.at)
                case "settled":leases[op.key!]=owner.acquireSettled(label:op.key!,nowMs:op.at)
                case "release":owner.release(leases[op.key!]!,nowMs:op.at)
                case "mark":owner.markActivity(nowMs:op.at,durationMs:op.duration ?? 300)
                case "diagnostic":owner.setDiagnosticActiveCap(op.cap)
                case "pointerdown","touchstart":owner.beginDirectManipulation(nowMs:op.at)
                case "pointerup","touchend","pointercancel","touchcancel","blur","pagehide":owner.endDirectManipulation(nowMs:op.at)
                case "hidden":owner.visibilityChanged(hidden:true,nowMs:op.at)
                case "visible":owner.visibilityChanged(hidden:false,nowMs:op.at)
                default:XCTFail("Unknown source operation")
                }
                XCTAssertEqual(owner.snapshot,record.states[index],"\(record.name) operation \(index)");states += 1
            }
        }
        XCTAssertEqual(states,110)
    }
    func testSourceTickerPreservesActivityTailSettledThirtyAndStaticFifteen() {
        let owner=NativeBoardFrameCadence();owner.start(tickerID:1,nowMs:0)
        let lease=owner.acquireActivity(label:"actual-visual",releaseTailMs:100,nowMs:10)
        owner.release(lease,nowMs:40)
        owner.advance(nowMs:139.999)
        let before=NativeBoardFrameCadenceDelivery.decide(owner.snapshot,foreground:true)
        XCTAssertEqual(before.preferredFramesPerSecond,60);XCTAssertFalse(before.isPaused)
        owner.advance(nowMs:140)
        let settled=NativeBoardFrameCadenceDelivery.decide(owner.snapshot,foreground:true)
        XCTAssertEqual(settled.preferredFramesPerSecond,15);XCTAssertFalse(settled.isPaused)
        let idle=owner.acquireSettled(label:"visible-special-idle",nowMs:200)
        let visible=NativeBoardFrameCadenceDelivery.decide(owner.snapshot,foreground:true)
        XCTAssertEqual(visible.preferredFramesPerSecond,30);XCTAssertFalse(visible.isPaused)
        XCTAssertTrue(NativeBoardFrameCadenceDelivery.decide(owner.snapshot,foreground:false).isPaused)
        owner.release(idle,nowMs:220)
        XCTAssertFalse(NativeBoardFrameCadenceDelivery.decide(owner.snapshot,foreground:true).isPaused)
    }
    func testOldActivityReleaseCannotExtendNewTickerButSourceSettledReleaseReappliesCap() {
        let owner=NativeBoardFrameCadence();owner.start(tickerID:1,nowMs:0)
        let old=owner.acquireActivity(nowMs:0),idle=owner.acquireSettled(nowMs:0)
        owner.start(tickerID:2,nowMs:10);let fresh=owner.acquireActivity(nowMs:11)
        owner.setDiagnosticActiveCap(30)
        owner.release(old,nowMs:12);XCTAssertEqual(owner.snapshot.maxFPS,60);XCTAssertEqual(owner.snapshot.activeUntil,0)
        owner.release(idle,nowMs:13);XCTAssertEqual(owner.snapshot.maxFPS,30);XCTAssertEqual(owner.snapshot.activityLeaseCount,1)
        owner.release(fresh,nowMs:20);owner.release(fresh,nowMs:100)
        XCTAssertEqual(owner.snapshot.activeUntil,200)
    }
    func testVisibleStaticSourceTickerMatchesOriginalBudgetRecoveryAndCallbackOrder() {
        let records=NativeBoardFrameCadenceSourceOracle.payload.coupled
        let owner=NativeBoardFrameCadence();var budget=NativeBoardFrameBudget(),now=0.0
        budget.start(nowMs:now,maxFPS:60);owner.start(tickerID:1,nowMs:now)
        let pressure=owner.acquireActivity(label:"controlled-pressure",nowMs:now)
        XCTAssertEqual(records.count,262)
        for (index,source) in records.enumerated() {
            if index>0 && index<=120 {
                now += 24
                budget.sample(nowMs:now,maxFPS:Double(owner.snapshot.maxFPS))
                owner.advance(nowMs:now)
            } else if index==121 {owner.release(pressure,nowMs:now)}
            else if index>121 {
                now += 1000/Double(owner.snapshot.maxFPS)
                // Original registration order: monitor BEFORE cadence expiry.
                budget.sample(nowMs:now,maxFPS:Double(owner.snapshot.maxFPS))
                owner.advance(nowMs:now)
            }
            XCTAssertEqual(now,source.at);XCTAssertEqual(owner.snapshot,source.cadence)
            XCTAssertEqual(budget.snapshot,source.budget);XCTAssertEqual(budget.isReduced,source.reduced)
            XCTAssertFalse(NativeBoardFrameCadenceDelivery.decide(owner.snapshot,foreground:true).isPaused)
        }
        XCTAssertTrue(records[120].reduced);XCTAssertFalse(budget.isReduced)
    }
}
