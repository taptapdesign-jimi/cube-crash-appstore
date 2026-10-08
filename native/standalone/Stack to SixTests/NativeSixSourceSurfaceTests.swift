import XCTest
@testable import Stack_to_Six

@MainActor final class NativeSixSourceSurfaceTests:XCTestCase {
    private final class Raw:NativeSourceAnimationParticipant {func advanceSourceAnimation(seconds:Double){}}
    private let zero=NativeSixSourceShakeGraph.Pose(canvas:[0,0],indicator:[0,0],decor:[0,0])
    func testActualUnionClockOriginalMultiplierAndCSSPluginShakeSixContexts() throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"six-surfaces-source-oracle",withExtension:"json"))
        let packet=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        for trace in packet["traces"] as! [[String:Any]] {
            let asleep=trace["asleep"] as! Bool,behavior=trace["behavior"] as! String
            var now=0.0,draws=0,seed:UInt32=127,m=NativeSixSourceMultiplierGraph.Pose()
            var surface=NativeSixSourceShakeGraph.Pose(canvas:[-1.3,2.8],indicator:[-0.7,1.1],decor:[-0.4,0.5]),removed=0
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
            let raw=Raw(),rawLease=asleep ? nil:service.register(participant:raw,duration:3,domain:.nativeRaw,cleanup:{_ in})
            let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{surface=$0})
            func random()->Double{seed=seed &* 1664525 &+ 1013904223;draws+=1;return Double(seed)/4294967296}
            now=10
            XCTAssertNotNil(owner.start(depth:5,initial:surface,random:random,paintMultiplier:{m=$0},removeMultiplier:{removed+=1}))
            for row in trace["rows"] as! [[String:Any]] {
                let at=row["wall"] as! Int;now=Double(at)
                if behavior=="paused",at==200{service.setSourceGlobalPaused(true)}
                if behavior=="paused",at==500{service.setSourceGlobalPaused(false)}
                if behavior=="replacement",at==200 {
                    XCTAssertNotNil(owner.start(depth:2,initial:surface,random:random,paintMultiplier:{_ in},removeMultiplier:{removed+=1}))
                }
                service.deliver(wallMilliseconds:now)
                XCTAssertEqual(service.sourceAnimationSeconds,row["animation"] as! Double,accuracy:1e-10)
                for(actual,key)in [([m.scale,m.alpha,m.rotation],"multiplier"),(surface.canvas,"canvas"),(surface.indicator,"indicator"),(surface.decor,"decor")] {
                    for(a,e)in zip(actual,row[key] as! [Double]){XCTAssertEqual(a,e,accuracy:1e-10,"\(asleep)/\(behavior)/\(at)/\(key)")}
                }
                XCTAssertEqual(draws,row["draws"] as! Int)
            }
            owner.dispose();rawLease?.cancel();service.dispose()
            XCTAssertEqual(removed,behavior=="replacement" ? 2:1)
            XCTAssertEqual(service.activeParticipantCount,0)
        }
    }
    func testLateTTLRemovesMultiplierOnlyAtActualSourceDeliveryWhilePaused() {
        var now=0.0,removed=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        XCTAssertNotNil(owner.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{removed+=1}))
        now=200;service.deliver(wallMilliseconds:now);service.setSourceGlobalPaused(true)
        now=500;service.deliver(wallMilliseconds:now);now=800;service.deliver(wallMilliseconds:now)
        XCTAssertEqual(removed,0);XCTAssertTrue(service.hasActiveClock)
        service.setSourceGlobalPaused(false)
        now=1100;service.deliver(wallMilliseconds:now);XCTAssertEqual(removed,0)
        now=1500;service.deliver(wallMilliseconds:now);XCTAssertEqual(removed,1)
        owner.dispose();service.dispose();XCTAssertEqual(removed,1)
    }
    func testVisualRandomRetirementStopsRemainingDrawsAndSourceRootAdmission() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var owner:NativeSixSourceSurfaceOwner!,draws=0,removed=0
        owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        let id=owner.start(depth:5,initial:zero,random:{draws+=1;if draws==3{owner.dispose()};return 0.5},paintMultiplier:{_ in},removeMultiplier:{removed+=1})
        XCTAssertNil(id);XCTAssertEqual(draws,3);XCTAssertEqual(removed,1)
        XCTAssertEqual(service.activeParticipantCount,0);service.dispose()
    }
    func testOldDisposalRemoveCallbackPreservesReplacementOwnerRoots() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let old=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        var replacement:NativeSixSourceSurfaceOwner?,oldRemoved=0,newRemoved=0
        XCTAssertNotNil(old.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{
            oldRemoved+=1
            let c=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in});replacement=c
            XCTAssertNotNil(c.start(depth:3,initial:self.zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{newRemoved+=1}))
        }))
        old.dispose();old.dispose();XCTAssertEqual(oldRemoved,1);XCTAssertEqual(newRemoved,0)
        XCTAssertEqual(service.activeParticipantCount,3)
        replacement?.dispose();service.dispose();XCTAssertEqual(newRemoved,1)
    }
    func testTrueReturningCurrentPredicateRetirementCannotReviveOldPaint() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var owner:NativeSixSourceSurfaceOwner!,retire=false,paints=0,removed=0
        owner=NativeSixSourceSurfaceOwner(service:service,current:{if retire{owner.dispose()};return true},paintShake:{_ in paints+=1})
        XCTAssertNotNil(owner.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in paints+=1},removeMultiplier:{removed+=1}))
        retire=true;service.deliver(wallMilliseconds:16)
        XCTAssertEqual(paints,0);XCTAssertEqual(removed,1);XCTAssertEqual(service.activeParticipantCount,0)
        service.dispose()
    }
    func testCapturedCarrierCancellationPreservesReplacementShakeAndMultiplier(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var oldRemoved=0,newRemoved=0
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        let old=owner.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{oldRemoved+=1})!
        let replacement=owner.start(depth:3,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{newRemoved+=1})!
        owner.cancel(old);owner.cancel(old)
        XCTAssertEqual(oldRemoved,1);XCTAssertEqual(newRemoved,0);XCTAssertEqual(service.activeParticipantCount,3)
        owner.cancel(replacement);XCTAssertEqual(newRemoved,1);XCTAssertEqual(service.activeParticipantCount,0)
        owner.dispose();service.dispose()
    }
    func testCapturedCarrierRetirementDuringRandomRejectsRemainingDrawsWithoutRetiringOwner(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var current=true,draws=0,removed=0
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        XCTAssertNil(owner.start(depth:2,initial:zero,random:{draws+=1;if draws==3{current=false};return 0.5},paintMultiplier:{_ in},removeMultiplier:{removed+=1},carrierCurrent:{current}))
        XCTAssertEqual(draws,3);XCTAssertEqual(removed,1);XCTAssertEqual(service.activeParticipantCount,0)
        XCTAssertNotNil(owner.start(depth:3,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{}))
        XCTAssertEqual(service.activeParticipantCount,3);owner.dispose();service.dispose()
    }

}
