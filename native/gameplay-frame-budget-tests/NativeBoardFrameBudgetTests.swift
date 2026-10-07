import XCTest
@testable import Stack_to_Six

final class NativeBoardFrameBudgetTests:XCTestCase {
    private func compare(_ actual:NativeBoardFrameBudget.Snapshot,_ source:NativeBoardFrameBudget.Snapshot,file:StaticString=#filePath,line:UInt=#line) {
        XCTAssertEqual(actual.averageFrameMs,source.averageFrameMs,accuracy:1e-8,file:file,line:line)
        XCTAssertEqual(actual.worstFrameMs,source.worstFrameMs,accuracy:1e-8,file:file,line:line)
        XCTAssertEqual(actual.expectedFrameMs,source.expectedFrameMs,accuracy:1e-8,file:file,line:line)
        XCTAssertEqual(actual.framesOver28Ms,source.framesOver28Ms,file:file,line:line)
        XCTAssertEqual(actual.framesOverBudget,source.framesOverBudget,file:file,line:line)
        XCTAssertEqual(actual.sampleCount,source.sampleCount,file:file,line:line)
        XCTAssertEqual(actual.reducedFx,source.reducedFx,file:file,line:line)
        XCTAssertEqual(actual.sustainedLoadReduction,source.sustainedLoadReduction,file:file,line:line)
    }
    func testExistingTickerMonitorMatchesExecutedOriginalAcrossThirteenSessions() {
        let records=NativeBoardFrameBudgetSourceOracle.payload.records
        XCTAssertEqual(records.count,13)
        var publications=0
        for record in records {
            var budget=NativeBoardFrameBudget(isMobileRuntime:record.mobile),now=0.0,fps:Double?=60,receipt=0
            for (index,operation) in record.ops.enumerated() {
                for ordinal in 0..<(operation.count ?? 1) {
                    if let next=operation.fps {fps=next.value}
                    let actual:NativeBoardFrameBudget.Snapshot?
                    switch operation.kind {
                    case "start":now += operation.delta ?? 0;actual=budget.start(nowMs:now,maxFPS:fps)
                    case "tick":now += operation.delta ?? 0;actual=budget.sample(nowMs:now,maxFPS:fps)
                    case "stop":budget.stop();actual=nil
                    default:XCTFail("Unknown original trace operation");actual=nil
                    }
                    let source=receipt<record.receipts.count ? record.receipts[receipt]:nil
                    if let actual {
                        guard let source else{XCTFail("Unexpected publish in \(record.name)");continue}
                        XCTAssertEqual(source.index,index,record.name);XCTAssertEqual(source.ordinal,ordinal,record.name)
                        compare(actual,source.snapshot);receipt += 1;publications += 1
                    } else if source?.index==index,source?.ordinal==ordinal {XCTFail("Missing publish in \(record.name)")}
                }
            }
            XCTAssertEqual(receipt,record.receipts.count,record.name)
            XCTAssertEqual(budget.isReduced,record.reduced,record.name);XCTAssertEqual(budget.isRunning,record.attached,record.name)
        }
        XCTAssertEqual(publications,1802)
    }
    func testPureEvaluationMatchesSourceFilteringWindowAndThresholds() {
        let records=NativeBoardFrameBudgetSourceOracle.payload.evaluations;XCTAssertEqual(records.count,8)
        for source in records {compare(NativeBoardFrameBudget.evaluate(samples:source.samples.map(\.value),currentlyReduced:source.reduced,sustainedLoadReduction:source.sustained,targetFrameMs:source.target),source.snapshot)}
    }
    func testNewBoardResetsHistoricalPressureAndStopAdmitsNoHiddenWork() {
        var budget=NativeBoardFrameBudget();budget.start(nowMs:0,maxFPS:60)
        var now=0.0
        for _ in 0..<120 {now += 24;budget.sample(nowMs:now,maxFPS:60)}
        XCTAssertTrue(budget.isReduced)
        let initial=budget.start(nowMs:now,maxFPS:60)
        XCTAssertFalse(initial.reducedFx);XCTAssertEqual(initial.sampleCount,0)
        for _ in 0..<120 {now += 16;budget.sample(nowMs:now,maxFPS:60)}
        XCTAssertFalse(budget.isReduced);budget.stop()
        XCTAssertNil(budget.sample(nowMs:now+250,maxFPS:60));XCTAssertFalse(budget.isRunning);XCTAssertFalse(budget.isReduced)
    }
    func testIdleTargetDoesNotSpendMobileSustainedLoadBudget() {
        var budget=NativeBoardFrameBudget();budget.start(nowMs:0,maxFPS:15)
        var now=0.0
        for _ in 0..<3000 {now += 1000.0/15;budget.sample(nowMs:now,maxFPS:15)}
        XCTAssertGreaterThan(now,180_000);XCTAssertFalse(budget.isReduced);XCTAssertFalse(budget.snapshot.sustainedLoadReduction)
        XCTAssertFalse(NativeBoardFrameBudget.shouldSample(maxFPS:.infinity,isMobileRuntime:true))
        XCTAssertTrue(NativeBoardFrameBudget.shouldSample(maxFPS:nil,isMobileRuntime:true))
        XCTAssertFalse(NativeBoardFrameBudget.shouldUseSustainedLoadReduction(elapsedMs:.infinity,isMobileRuntime:true))
        XCTAssertFalse(NativeBoardFrameBudget.shouldUseSustainedLoadReduction(elapsedMs:180_000,isMobileRuntime:false))
    }
}
