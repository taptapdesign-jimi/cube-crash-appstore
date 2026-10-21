import Foundation
import XCTest
@testable import Stack_to_Six
@MainActor final class NativeSourceHUDStarJobsTests:XCTestCase {
    @MainActor final class Host {
        var plans:[String:NativeSourceHUDStarPlan]=[:]
        var time=0.0,events:[String]=[],sequence=0,valid=true,cadenceAdmitted=true
        var roots:[String:(Double)->Void]=[:],completions:[String:()->Void]=[:]
        var timers:[Int:(Double,()->Void)]=[:],ids:[String]=[],owner:NativeSourceHUDStarJobs!
        var onCurrent:(()->Bool)?,onMount:(()->Void)?,onRetire:(()->Void)?
        init(readableCoins:Bool=false){owner=NativeSourceHUDStarJobs(hooks:.init(current:{[unowned self] in self.onCurrent?() ?? self.valid},acquireCadence:{[unowned self] in guard self.cadenceAdmitted else{return nil};self.events.append("acquire60");return{self.events.append("release60")}},mountContainer:{[unowned self] in self.events.append("container+");return true},removeContainer:{[unowned self] in self.events.append("container-")},mountStar:{[unowned self] id,plan in self.plans[id]=plan;self.ids.append(id);self.events.append("mount:\(id)");self.onMount?();return true},paintStar:{_,_ in},removeStar:{[unowned self] id in self.events.append("remove:\(id)")},timeline:{[unowned self] _,update,complete in let id=self.ids.last!;self.roots[id]=update;self.completions[id]=complete;self.events.append("root:\(id)");return{self.roots.removeValue(forKey:id);self.completions.removeValue(forKey:id);self.events.append("kill:\(id)")}},wall:{[unowned self] delay,fn in self.sequence += 1;let id=self.sequence;self.timers[id]=(self.time+delay,fn);return{self.timers.removeValue(forKey:id)}},arrive:{[unowned self] id in self.events.append("score:\(id)")},retire:{[unowned self] _,_ in self.events.append("retire");self.onRetire?()}),readableCoins:readableCoins)}
        func start(_ ids:[String],finalMerge:Bool=false)->Bool {var seed:UInt32=1;return owner.start(jobID:UUID(),ids:ids,origin:.init(x:195,y:430),target:.init(x:37,y:76),textureWidth:64,finalMerge:finalMerge,random:{seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296})}
        func wall(_ now:Double){time=now;let due=timers.sorted{$0.value.0<$1.value.0}.filter{$0.value.0<=now};for (id,record) in due where timers[id] != nil {timers.removeValue(forKey:id);record.1()}}
    }
    func testFinalCoinJobsCompressLaunchAndMaximumEndButKeepCleanupMarginAndOrdinarySpeed() {
        let normal=Host(readableCoins:true),fast=Host(readableCoins:true)
        XCTAssertTrue(normal.start(["a","b","c"]))
        XCTAssertTrue(fast.start(["a","b","c"],finalMerge:true))
        for id in normal.ids {
            XCTAssertEqual(fast.plans[id]!.end*3,normal.plans[id]!.end,accuracy:1e-9)
        }
        let normalWall=normal.timers.values.first!.0,fastWall=fast.timers.values.first!.0
        XCTAssertEqual((fastWall-80)*3,normalWall-80,accuracy:1e-6)
        fast.wall(fastWall);XCTAssertEqual(fast.owner.jobCount,0)
        XCTAssertEqual(normal.owner.jobCount,1)
        XCTAssertEqual(fast.events.filter{$0=="retire"}.count,1)
        normal.owner.dispose();fast.owner.dispose()
    }
    func testRefusedActualFlightCadenceRetiresJobBeforeAnyStarOrTimeline() {
        let h=Host();h.cadenceAdmitted=false
        XCTAssertFalse(h.start(["a","b"]))
        XCTAssertEqual(h.owner.jobCount,0)
        XCTAssertTrue(h.roots.isEmpty)
        XCTAssertTrue(h.ids.isEmpty)
        XCTAssertEqual(h.events.filter{$0=="retire"}.count,1)
        XCTAssertFalse(h.events.contains("acquire60"))
        XCTAssertFalse(h.events.contains("release60"))
        h.wall(120)
        XCTAssertFalse(h.owner.containerMounted)
    }
    func testPausedGSAPIndependentWallRetiresDebtWithoutRewardThenContainer120() {
        let h=Host();XCTAssertTrue(h.start(["a","b","c"]))
        let end=h.timers.values.first!.0;h.wall(end-0.001);XCTAssertEqual(h.owner.jobCount,1);XCTAssertFalse(h.events.contains("release60"))
        h.wall(end);XCTAssertEqual(h.owner.jobCount,0);XCTAssertEqual(h.events.filter{$0.hasPrefix("score:")}.count,0)
        XCTAssertEqual(h.events.filter{$0=="release60"}.count,1);XCTAssertTrue(h.owner.containerMounted)
        h.wall(end+119.999);XCTAssertTrue(h.owner.containerMounted);h.wall(end+120);XCTAssertFalse(h.owner.containerMounted)
    }
    func testActualPath98ArrivalOnceDoesNotRetireJobOrCadenceEarly() {
        let h=Host();XCTAssertTrue(h.start(["a"]));let update=h.roots["a"]!
        update(0.4);XCTAssertFalse(h.events.contains("score:a"));update(1.01);update(1.02)
        XCTAssertEqual(h.events.filter{$0=="score:a"}.count,1);XCTAssertEqual(h.owner.jobCount,1);XCTAssertFalse(h.events.contains("release60"))
        h.wall(2000);XCTAssertEqual(h.events.filter{$0=="score:a"}.count,1);XCTAssertEqual(h.owner.jobCount,0)
    }
    func testSafetyCompletionAndForceCleanupNeverManufactureArrival() {
        let h=Host();XCTAssertTrue(h.start(["a","b"]));let late=h.roots["b"]!
        h.completions["a"]?();h.owner.dispose();late(100)
        XCTAssertEqual(h.events.filter{$0.hasPrefix("score:")}.count,0);XCTAssertEqual(h.events.filter{$0=="remove:a"}.count,1)
        XCTAssertEqual(h.events.filter{$0=="remove:b"}.count,1);XCTAssertEqual(h.events.filter{$0=="release60"}.count,1)
        XCTAssertTrue(h.timers.isEmpty);XCTAssertTrue(h.roots.isEmpty)
    }
    func testPerStarConstructionRegistersRootBeforeNextStarAndContainerReuseCancels120() {
        let h=Host();XCTAssertTrue(h.start(["a","b","c"]))
        XCTAssertEqual(h.events.filter{$0.hasPrefix("mount:") || $0.hasPrefix("root:")},["mount:a","root:a","mount:b","root:b","mount:c","root:c"])
        h.wall(2000);XCTAssertEqual(h.timers.count,1);XCTAssertTrue(h.start(["d"]))
        XCTAssertEqual(h.events.filter{$0=="container+"}.count,1);XCTAssertEqual(h.events.filter{$0=="acquire60"}.count,2)
        h.wall(2120);XCTAssertTrue(h.owner.containerMounted);XCTAssertEqual(h.owner.jobCount,1)
    }
    func testCurrentPredicateReentrantDisposeCannotPublishLateRootOrAward() {
        let h=Host();XCTAssertTrue(h.start(["a"]));let update=h.roots["a"]!
        h.onCurrent={h.owner.dispose();return true};update(100)
        XCTAssertTrue(h.owner.disposed);XCTAssertEqual(h.events.filter{$0.hasPrefix("score:")}.count,0);XCTAssertTrue(h.roots.isEmpty)
    }
    func testMountReentryRetiresExactlyCapturedJobAndRejectsFollowingPublication() {
        let h=Host();h.onMount={h.owner.dispose()};XCTAssertFalse(h.start(["a","b"]))
        XCTAssertTrue(h.owner.disposed);XCTAssertTrue(h.roots.isEmpty);XCTAssertEqual(h.events.filter{$0=="retire"}.count,1)
        XCTAssertEqual(h.events.filter{$0=="release60"}.count,1)
    }
}
