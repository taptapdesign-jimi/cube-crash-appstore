import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSourceSmokePoolWarmupTests:XCTestCase {
    private final class Jobs {
        var deadlines:[Int]=[],callbacks:[()->Void]=[],cancelled:[NativeSourceAppTimeoutOwner.Receipt]=[]
        func schedule(_ source:String,_ generation:UInt64,_ delay:Int,_ elapsed:@escaping()->Void,_ cancelled:@escaping()->Void)->NativeSourceAppTimeoutOwner.Receipt {
            deadlines.append(delay);callbacks.append(elapsed)
            return .init(id:UUID(),sourceID:source,generation:generation)
        }
    }
    func testTenExactSourceDeadlinesWarmExistingPoolWithoutRandomAndReuseIt() {
        let jobs=Jobs();var randomDraws=0
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{randomDraws+=1;return 0.5})
        let owner=NativeSourceSmokePoolWarmup(generation:3,current:{true},warm:{session.prewarm(to:$0)},schedule:jobs.schedule,cancel:{jobs.cancelled.append($0)})
        XCTAssertEqual(session.pool.created,0);XCTAssertTrue(owner.start());XCTAssertFalse(owner.start())
        XCTAssertEqual(jobs.deadlines,[330,400,470,540,610,680,750,820,890,960])
        for (index,callback) in jobs.callbacks.enumerated(){callback();XCTAssertEqual(session.pool.created,min(76,(index+1)*8))}
        XCTAssertEqual(owner.completedTargets,[8,16,24,32,40,48,56,64,72,76]);XCTAssertEqual(owner.pendingCount,0)
        XCTAssertEqual(session.pool.retainedNodeCount,76);XCTAssertEqual(randomDraws,0)
        let lease=session.pool.acquire();XCTAssertEqual(session.pool.created,76);XCTAssertEqual(session.pool.reused,1)
        session.pool.release(lease);owner.dispose()
        let successor=NativeSourceSmokePoolWarmup(generation:4,current:{true},warm:{session.prewarm(to:$0)},schedule:jobs.schedule,cancel:{jobs.cancelled.append($0)})
        XCTAssertTrue(successor.start());for callback in jobs.callbacks.suffix(10){callback()}
        XCTAssertEqual(session.pool.created,76);XCTAssertEqual(randomDraws,0)
    }
    func testBackgroundOrReplacedEntryRejectsCapturedDeliveryAndCancelsRemainingBatches() {
        for background in [false,true] {
            let jobs=Jobs();var entryCurrent=true,foreground=true;var warmed:[Int]=[]
            let owner=NativeSourceSmokePoolWarmup(generation:7,current:{entryCurrent && foreground},warm:{warmed.append($0)},schedule:jobs.schedule,cancel:{jobs.cancelled.append($0)})
            XCTAssertTrue(owner.start());jobs.callbacks[0]()
            if background {foreground=false}else{entryCurrent=false}
            jobs.callbacks[1]();XCTAssertTrue(owner.disposed);XCTAssertEqual(jobs.cancelled.count,8)
            entryCurrent=true;foreground=true;for callback in jobs.callbacks{callback()}
            XCTAssertEqual(warmed,[8]);XCTAssertEqual(owner.pendingCount,0)
        }
    }
    func testDisposeCancelsExactJobsAndRetainedCallbacksCannotAllocate() {
        let jobs=Jobs();var warmed=0
        let owner=NativeSourceSmokePoolWarmup(generation:1,current:{true},warm:{_ in warmed+=1},schedule:jobs.schedule,cancel:{jobs.cancelled.append($0)})
        XCTAssertTrue(owner.start());owner.dispose();owner.dispose()
        XCTAssertEqual(jobs.cancelled.count,10);XCTAssertTrue(jobs.cancelled.allSatisfy{$0.generation==1})
        for callback in jobs.callbacks{callback()};XCTAssertEqual(warmed,0)
    }
    func testUnadmittedEntryCannotScheduleOrWarm() {
        let jobs=Jobs();var warmed=0
        let owner=NativeSourceSmokePoolWarmup(generation:1,current:{false},warm:{_ in warmed+=1},schedule:jobs.schedule,cancel:{jobs.cancelled.append($0)})
        XCTAssertFalse(owner.start());XCTAssertTrue(jobs.deadlines.isEmpty);XCTAssertEqual(warmed,0)
    }
}
