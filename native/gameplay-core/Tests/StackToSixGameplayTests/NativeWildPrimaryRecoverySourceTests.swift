import XCTest
@testable import StackToSixGameplay
final class NativeWildPrimaryRecoverySourceTests:XCTestCase {
    struct Event:Decodable {let kind:String}
    struct Row:Decodable {let mode:String;let rejectPermits:Int;let trace:[Event]}
    func testOriginalFalsePrimaryRetryAndHardFallbackCallsMatchSeparateRecoveryOwner()throws {
        let rows=try JSONDecoder().decode([Row].self,from:NativeWildPrimaryRejectionOracle.data);XCTAssertEqual(rows.count,4)
        for row in rows {
            let p=NativeWildPrimaryRecoveryOwner(id:"wild",generation:7,mode:row.mode=="normal" ? .normal:.endgame)
            var rejections=0,active=false,attempts:[String]=[],steps=0
            XCTAssertNotNil(p.begin())
            while let c=p.command {
                steps+=1;XCTAssertLessThan(steps,9)
                let permitted=rejections>=row.rejectPermits
                switch c.kind {
                case .awaitedPrimary:
                    attempts.append("primary-attempt")
                    if !permitted {rejections+=1} else {active=true}
                    XCTAssertTrue(p.acknowledgeAwaited(commandID:c.id,generation:7,spawned:permitted))
                case .hardFallback:
                    attempts.append("hard-fallback-attempt")
                    if !permitted {rejections+=1} else {active=true}
                    XCTAssertTrue(p.acknowledgeHardFallback(commandID:c.id,generation:7,spawned:permitted))
                case .verifyActive:XCTAssertTrue(p.acknowledgeVerification(commandID:c.id,generation:7,activeAtReservedCell:active))
                }
                XCTAssertFalse(p.acknowledgeAwaited(commandID:c.id,generation:6,spawned:true))
            }
            XCTAssertTrue(p.complete)
            XCTAssertEqual(attempts,row.trace.filter{$0.kind=="primary-attempt" || $0.kind=="hard-fallback-attempt"}.map(\.kind))
            XCTAssertNil(p.begin())
        }
        let cancelled=NativeWildPrimaryRecoveryOwner(id:"old",generation:1,mode:.endgame)
        let c=try XCTUnwrap(cancelled.begin());cancelled.cancelForLifecycle()
        XCTAssertFalse(cancelled.complete);XCTAssertFalse(cancelled.acknowledgeAwaited(commandID:c.id,generation:1,spawned:false));XCTAssertNil(cancelled.command)
    }
}
