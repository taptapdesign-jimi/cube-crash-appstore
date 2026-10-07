import XCTest
@testable import StackToSixGameplay
final class NativeSpecialRulesTests: XCTestCase {
    func die(_ id: String, _ value: Int, _ x: Int, _ y: Int = 0, wild: NativeWildArchetype? = nil) -> NativeTile { NativeTile(id:id,cell:NativeCell(column:x,row:y),value:value,archetype:wild) }
    func testMagnetRespawnExactlyMatchesPulledCountAndNoObligatoryCube() {
        for count in 0...4 { XCTAssertEqual(NativeMagnetRules.respawnCount(pulledCount:count,hasTilesToRespawn:true),count); XCTAssertEqual(NativeMagnetRules.respawnCount(pulledCount:count,hasTilesToRespawn:false),0) }
        XCTAssertEqual(NativeMagnetRules.respawnDelays(count:4),[0,150,300,450])
    }
    func testMagnetPullNearestFourUsesStableTieOrderAndCanConsumeWilds() {
        let magnet = die("magnet",6,0,wild:.magnet), target = die("target",1,1)
        let candidates = [die("close",3,1,1),die("star",6,2,wild:.star),die("far",4,4,5),die("juice",6,1,2,wild:.juice),die("mid",5,3),die("otherMagnet",6,0,wild:.magnet)]
        let state = NativeBoardState(tiles:[magnet,target]+Array(candidates.dropLast()))
        let pulled = NativeMagnetRules.nearestPullTargets(state:state,source:magnet,destination:target)
        XCTAssertEqual(pulled.map(\.id),["close","star","juice","mid"])
        XCTAssertFalse(pulled.contains { $0.id == "magnet" || $0.id == "target" })
    }
    func testForcedMagnetPairsAreAuthoredSourceCombinations() {
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:1,random:{0}),[1])
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:1,random:{0.999}),[3])
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:2,random:{0}),[1,5])
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:2,random:{0.5}),[2,4])
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:2,random:{0.999}),[3,3])
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:3,random:{0}).sorted(),[1,1,5])
        XCTAssertEqual(NativeMagnetRules.forcedReplacementValues(count:4,random:{0}).sorted(),[1,2,4,5])
    }
    func testPullMeterLastPairAndInvalidCounts() {
        let merge = die("merge",6,0), partner = die("r",3,1)
        XCTAssertFalse(NativeMagnetRules.pullProgress(activeBeforePull:[merge,partner],mergeTile:merge,pulledCount:1).addProgress)
        XCTAssertTrue(NativeMagnetRules.pullProgress(activeBeforePull:[merge,partner,die("x",2,2)],mergeTile:merge,pulledCount:4).addProgress)
        XCTAssertFalse(NativeMagnetRules.pullProgress(activeBeforePull:[merge,partner],mergeTile:merge,pulledCount:5).isLastMergeBeforePull)
    }
    func testTntNeverTargetsWildsOrParticipantsAndRetainsLockedRealDice() {
        var locked = die("locked",3,3); locked.locked = true
        let all = [die("target",2,0),die("participant",6,1),die("wild",6,2,wild:.star),locked,die("placeholder",0,4)]
        XCTAssertEqual(NativeTntRules.eligibleTargets(all,excluding:["participant"]).map(\.id),["target","locked"])
    }
    func testSeparatedTntTargetsPortSourceGreedyDistanceSelection() {
        let targets = [die("a",1,0,0),die("b",2,1,0),die("c",3,4,5),die("d",4,0,5),die("e",5,4,0)]
        XCTAssertEqual(NativeTntRules.separatedTargets(targets,count:4,random:{0}).map(\.id),["a","c","d","e"])
    }
    func testTntBurstAlwaysChangesFaceAndPrefersUniqueFaces() {
        let targets = [die("a",1,0),die("b",2,1),die("c",3,2),die("d",4,3)]
        let values = NativeTntRules.replacementValues(targets:targets,random:{0})
        XCTAssertEqual(values,[2,1,4,3]); XCTAssertEqual(Set(values).count,4)
        for (target,value) in zip(targets,values) { XCTAssertNotEqual(target.value,value) }
    }
    func testWildMeterFillRateAndReadinessBoundary() {
        XCTAssertEqual(NativeWildMeterRules.increment(base:0.22,mode:.arcade,board:1,spawnCount:0),0.253,accuracy:0.000001)
        XCTAssertEqual(NativeWildMeterRules.increment(base:0.10,mode:.journey,board:1,spawnCount:2),0.06,accuracy:0.000001)
        XCTAssertEqual(NativeWildMeterRules.increment(base:0.10,mode:.arcade,board:8,spawnCount:2,tutorialSlow:true),0.0018,accuracy:0.000001)
        XCTAssertEqual(NativeWildMeterRules.permission(meter:0.999999).action,.allow)
        XCTAssertEqual(NativeWildMeterRules.permission(meter:0.999998).reason,"wild-meter-not-ready")
    }
    func testWildSpawnPermissionPriorityAndNonfinalSnapshotCannotBeOverridden() {
        XCTAssertEqual(NativeWildMeterRules.permission(meter:1,meterEnabled:false,lastMerge:true).reason,"wild-meter-disabled")
        XCTAssertEqual(NativeWildMeterRules.permission(meter:1,animationBlock:"board-settling").retryDelayMs,80)
        XCTAssertEqual(NativeWildMeterRules.permission(meter:1,animationBlock:"magnet-pull").retryDelayMs,220)
        let last = NativeWildMeterRules.permission(meter:1,lastMerge:true)
        XCTAssertEqual(NativeWildMeterRules.progressAction(permission:last,confirmedNonFinal:true).action,"add")
        XCTAssertEqual(NativeWildMeterRules.progressAction(permission:last,confirmedNonFinal:false).action,"reset")
        XCTAssertEqual(NativeWildMeterRules.progressAction(permission:NativeWildMeterRules.permission(meter:1,spawnEnabled:false),confirmedNonFinal:false).action,"add")
    }
}
