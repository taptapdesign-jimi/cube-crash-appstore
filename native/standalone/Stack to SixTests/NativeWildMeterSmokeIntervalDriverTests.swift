import XCTest
@testable import Stack_to_Six

nonisolated final class NativeWildMeterSmokeIntervalDriverTests:XCTestCase {
    @MainActor func testOptInSchedulesBeforeCallbackAndSkipsMissedPeriodsFromActualEntry()async {
        let timeouts=NativeSourceAppTimeoutOwner(),base=DispatchTime.now().uptimeNanoseconds-1_000_000_000
        var now=base,deadlines:[UInt64]=[],calls=0,cancel:(()->Void)?
        let owner=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:1,sourcePhaseEnabled:true,monotonicNow:{DispatchTime(uptimeNanoseconds:now)})
        owner.onScheduledDeadline={deadlines.append(($0.uptimeNanoseconds-base)/1_000_000)}
        let finished=expectation(description:"three actual captured app timeout deliveries")
        cancel=owner.start{
            calls+=1
            XCTAssertEqual(timeouts.pendingCount,1) // NEXT receipt before callback
            switch calls {
            case 1:XCTAssertEqual(deadlines,[100,200]);now=base+336_000_000
            case 2:XCTAssertEqual(deadlines,[100,200,400]);now=base+400_000_000
            case 3:XCTAssertEqual(deadlines,[100,200,400,500]);cancel?();finished.fulfill()
            default:XCTFail("synthetic overdue burst")
            }
        }
        now=base+100_000_000
        await fulfillment(of:[finished],timeout:2)
        XCTAssertEqual(calls,3);XCTAssertEqual(timeouts.pendingCount,0)
        cancel?();timeouts.cancelAll()
    }
    @MainActor func testDefaultRetainsAfterCallbackLegacyPolicy()async {
        let timeouts=NativeSourceAppTimeoutOwner(),base=DispatchTime.now().uptimeNanoseconds-1_000_000_000
        var now=base,deadlines:[UInt64]=[],calls=0,cancel:(()->Void)?
        let owner=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:1,monotonicNow:{DispatchTime(uptimeNanoseconds:now)})
        owner.onScheduledDeadline={deadlines.append(($0.uptimeNanoseconds-base)/1_000_000)}
        let finished=expectation(description:"unchanged default callback-first policy")
        cancel=owner.start{
            calls+=1;XCTAssertEqual(timeouts.pendingCount,0)
            if calls==1{XCTAssertEqual(deadlines,[100]);now=base+336_000_000}
            else {XCTAssertEqual(deadlines,[100,436]);cancel?();finished.fulfill()}
        }
        now=base+100_000_000
        await fulfillment(of:[finished],timeout:2)
        XCTAssertEqual(calls,2);XCTAssertEqual(timeouts.pendingCount,0);timeouts.cancelAll()
    }
    @MainActor func testReentrantReplacementCancelsOnlyAAlreadyPendingNextReceipt()async {
        let timeouts=NativeSourceAppTimeoutOwner(),base=DispatchTime.now().uptimeNanoseconds-1_000_000_000
        var now=base,oldCalls=0,newCalls=0,cancelA:(()->Void)?,cancelC:(()->Void)?
        let owner=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:1,sourcePhaseEnabled:true,monotonicNow:{DispatchTime(uptimeNanoseconds:now)})
        let finished=expectation(description:"C survives A callback cleanup")
        cancelA=owner.start{
            oldCalls+=1;cancelA?();now=base+110_000_000
            cancelC=owner.start{newCalls+=1;cancelA?();XCTAssertEqual(timeouts.pendingCount,1);cancelC?();finished.fulfill()}
            XCTAssertEqual(timeouts.pendingCount,1)
        }
        now=base+100_000_000
        await fulfillment(of:[finished],timeout:2)
        XCTAssertEqual(oldCalls,1);XCTAssertEqual(newCalls,1);XCTAssertEqual(timeouts.pendingCount,0);timeouts.cancelAll()
    }
    @MainActor func testCancellationBeforeFirstDeliveryDrainsCapturedReceipt()async {
        let timeouts=NativeSourceAppTimeoutOwner(),base=DispatchTime.now().uptimeNanoseconds-1_000_000_000
        let owner=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:1,sourcePhaseEnabled:true,monotonicNow:{DispatchTime(uptimeNanoseconds:base)})
        var calls=0
        let cancel=owner.start{calls+=1};XCTAssertEqual(timeouts.pendingCount,1);cancel?();XCTAssertEqual(timeouts.pendingCount,0)
        let drained=expectation(description:"real main queue after canceled expired task")
        DispatchQueue.main.async{drained.fulfill()}
        await fulfillment(of:[drained],timeout:2)
        XCTAssertEqual(calls,0);XCTAssertEqual(timeouts.pendingCount,0);timeouts.cancelAll()
    }
    @MainActor func testClockReadReentryCancelsBeforeMutatingPhaseOrPublishingNextReceipt()async {
        let timeouts=NativeSourceAppTimeoutOwner(),base=DispatchTime.now().uptimeNanoseconds-1_000_000_000
        var reads=0,calls=0,cancel:(()->Void)?
        let retired=expectation(description:"actual delivery clock read retires old interval")
        let owner=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:1,sourcePhaseEnabled:true,monotonicNow:{
            reads+=1
            if reads==2{cancel?();retired.fulfill();return .init(uptimeNanoseconds:base+100_000_000)}
            return .init(uptimeNanoseconds:base)
        })
        cancel=owner.start{calls+=1}
        await fulfillment(of:[retired],timeout:2)
        XCTAssertEqual(calls,0);XCTAssertEqual(timeouts.pendingCount,0);timeouts.cancelAll()
    }
}
