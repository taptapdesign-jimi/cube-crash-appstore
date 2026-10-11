import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceSchedulingDiagnosticsTests:XCTestCase {
    func testDiagnosticsRemainOffUntilEnabledAndDoNotChangeSourceCallbackOrder() {
        var reads=0,now=10.0,order:[Int]=[]
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,
            diagnosticMillisecondsNow:{reads+=1;return now})
        defer{service.dispose()}
        _=service.requestSourceAnimationFrame(ownerID:"a",generation:1,callback:{order.append(1)})
        service.deliver(wallMilliseconds:10)
        XCTAssertEqual(reads,0);XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0)
        service.enableSchedulingDiagnostics()
        _=service.requestSourceAnimationFrame(ownerID:"b",generation:1,callback:{order.append(2);now+=0.75})
        _=service.requestSourceAnimationFrame(ownerID:"c",generation:1,callback:{order.append(3)})
        service.deliver(wallMilliseconds:20)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(order,[1,2,3]);XCTAssertEqual(snapshot.deliveries,1)
        XCTAssertEqual(snapshot.worstDeliveryMilliseconds,0.75,accuracy:1e-8)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0)
    }
    func testSourceDeliveryGapResetsAcrossForegroundAndIdleDemand() {
        var now=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        defer{service.dispose()};service.enableSchedulingDiagnostics()
        func queue(){_=service.requestSourceAnimationFrame(ownerID:"sample",generation:1,callback:{})}
        queue();service.deliver(wallMilliseconds:0)
        now=1000;queue();service.deliver(wallMilliseconds:1000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().worstGapMilliseconds,0,"An idle link restart must not be called an active frame stall")
        queue();service.setSourceForeground(false);now=2000;service.deliver(wallMilliseconds:2000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0)
        service.setSourceForeground(true);now=3000;service.deliver(wallMilliseconds:3000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().worstGapMilliseconds,0)
    }
    func testContinuousSourceDemandRecordsActualGapAndStopsAfterDisposal() {
        var now=10.0,calls=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        service.enableSchedulingDiagnostics()
        func queue(){_=service.requestSourceAnimationFrame(ownerID:"next",generation:1,callback:{calls+=1;queue()})}
        queue();service.deliver(wallMilliseconds:10)
        now=60;service.deliver(wallMilliseconds:60)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(snapshot.deliveries,2);XCTAssertEqual(snapshot.worstGapMilliseconds,50)
        XCTAssertEqual(calls,2);XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        service.dispose();now=1000;service.deliver(wallMilliseconds:1000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0);XCTAssertEqual(calls,2)
    }
    func testRenderAggregatesDetectPaintBunchingAndTouchLatencyWithoutIntervalAlias() {
        var metrics=NativeSourceDragRenderDiagnostics()
        metrics.rendered(at:0,dragging:true)
        metrics.painted(at:10,touchMilliseconds:4);metrics.rendered(at:12,dragging:true)
        metrics.painted(at:15,touchMilliseconds:14);metrics.painted(at:16,touchMilliseconds:15)
        metrics.rendered(at:20,dragging:true)
        XCTAssertEqual(metrics.rendersWithoutPaint,1);XCTAssertEqual(metrics.rendersOnePaint,1)
        XCTAssertEqual(metrics.rendersMultiplePaints,1);XCTAssertEqual(metrics.worstPaintAgeMilliseconds,4)
        XCTAssertEqual(metrics.worstQueuedTouchAgeMilliseconds,6)
        metrics.resetInterval();metrics.rendered(at:30,dragging:true)
        XCTAssertEqual(metrics.rendersWithoutPaint,1);XCTAssertEqual(metrics.rendersMultiplePaints,0)
        metrics.retireDrag();metrics.rendered(at:1000,dragging:false)
        metrics.rendered(at:1010,dragging:true)
        XCTAssertEqual(metrics.worstPaintAgeMilliseconds,14,"Old drag ages must not leak into a successor drag")
    }
}
