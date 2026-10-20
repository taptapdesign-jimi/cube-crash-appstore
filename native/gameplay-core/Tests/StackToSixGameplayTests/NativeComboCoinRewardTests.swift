import XCTest
@testable import StackToSixGameplay

final class NativeComboCoinRewardTests:XCTestCase {
    private let thresholds=[(0,1),(2,1),(3,2),(4,2),(5,3),(9,3),(10,4),(14,4),(15,5),(19,5),(20,6),(24,6),(25,7),(99,7)]
    private func engine(_ type:NativeWildArchetype,_ variant:String?,combo:Int,extra:Int=0,mode:NativeRunMode = .journey)->NativeGameplayEngine {
        var tiles=[NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:type,variant:variant),NativeTile(id:"d",cell:.init(column:1,row:0),value:2)]
        for i in 0..<extra {tiles.append(.init(id:"extra\(i)",cell:.init(column:(i+2)%5,row:(i+2)/5),value:2))}
        var state=NativeBoardState(tiles:tiles);state.combo=combo;state.mode=mode
        let e=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.2,count:1000));e.comboHUDCoinRewardsEnabled=true
        return e
    }
    func testEveryThresholdAndNonSixReward() {
        for (combo,count) in thresholds {XCTAssertEqual(NativeComboCoinPolicy.count(combo:combo),count);XCTAssertEqual(NativeComboCoinPolicy.count(combo:combo,mergeSix:false),1)}
    }
    func testEveryVariantAndOriginalFinalMergeBothDirectionsBothModes()throws {
        let families=NativeWildArchetype.allCases.map{($0,Optional<String>.none)}+NativeSpecialDiceRegistry.variants.values.map{($0.archetype,Optional($0.id))}
        for mode in [NativeRunMode.journey,.arcade] {for (type,variant) in families {for (combo,count) in thresholds where combo>0 {for reverse in [false,true] {
            let e=engine(type,variant,combo:combo-1,mode:mode)
            XCTAssertTrue(e.beginDrag(tileID:reverse ? "d":"s"));XCTAssertTrue(e.drop(target:.init(column:reverse ? 0:1,row:0)).accepted)
            XCTAssertEqual(e.state.combo,combo);XCTAssertEqual(e.pendingHUDStars.count,count,"\(mode) \(variant ?? type.rawValue) combo \(combo)")
            XCTAssertTrue(e.pendingHUDStars.allSatisfy{$0.archetype == type})
            e.sourceHUDStarJobsEnabled=true
            let ids=e.pendingHUDStars.map(\.id),job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:ids,generation:e.state.generation)),score=e.state.score
            for id in ids {XCTAssertTrue(e.commitSourceHUDStarArrival(job:job,receiptID:id).accepted);XCTAssertFalse(e.commitSourceHUDStarArrival(job:job,receiptID:id).accepted)}
            XCTAssertEqual(e.state.score,score+100*count);XCTAssertTrue(e.retireSourceHUDStarJob(job:job));XCTAssertTrue(e.pendingHUDStars.isEmpty)
        }}}}
    }
    func testTntSplitsComboBudgetBetweenCenterAndEveryActualImpact()throws {
        for mode in [NativeRunMode.journey,.arcade] {
            for staged in [false,true] {
                for variant in [nil,"flower","barell","laser-gun","beach-ball"] as [String?] {
                    for extra in 1...6 {for (combo,reward) in thresholds where combo>0 {
                        let e=engine(.tnt,variant,combo:combo-1,extra:extra,mode:mode)
                        e.stagedTntActivation=staged
                        // Source Laser admission requires its visual planner; its
                        // late reservation is exercised by the mounted root test.
                        if staged && variant=="laser-gun" {continue}
                        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
                        let initial=try XCTUnwrap(e.pendingSpecial)
                        let main=e.commitSpecialActivation(transactionID:initial.id)
                        XCTAssertTrue(main.accepted)
                        XCTAssertEqual(e.pendingHUDStars.count,0)
                        XCTAssertTrue(e.pendingHUDStars.allSatisfy{$0.origin==initial.destination.cell})
                        XCTAssertFalse(e.commitSpecialActivation(transactionID:initial.id).accepted)
                        if staged {
                            XCTAssertTrue(e.reserveTntTargets(transactionID:initial.id).accepted)
                            XCTAssertFalse(e.reserveTntTargets(transactionID:initial.id).accepted)
                        }
                        let plan=try XCTUnwrap(e.pendingSpecial)
                        XCTAssertEqual(e.pendingHUDStars.count,0)
                        for target in plan.targets {
                            let before=e.pendingHUDStars.count
                            let impact=e.commitSpecialImpact(transactionID:plan.id,tileID:target.id)
                            XCTAssertTrue(impact.accepted);XCTAssertGreaterThan(e.pendingHUDStars.count,before)
                            XCTAssertEqual(e.pendingHUDStars.last?.origin,target.cell)
                            XCTAssertEqual(impact.events.first{$0.kind == .hudStarsPrepared}?.value,e.pendingHUDStars.count-before)
                            XCTAssertFalse(e.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)
                        }
                        XCTAssertEqual(e.pendingHUDStars.count,max(reward,plan.targets.count))
                        XCTAssertTrue(e.pendingHUDStars.allSatisfy{$0.archetype == .tnt})
                        let counts=plan.targets.map {target in e.pendingHUDStars.filter{$0.origin==target.cell}.count}
                        XCTAssertTrue(counts.allSatisfy{$0>=1})
                        XCTAssertLessThanOrEqual((counts.max() ?? 0)-(counts.min() ?? 0),1)
                        if reward==7 && plan.targets.count==4 {XCTAssertEqual(counts.sorted(),[1,2,2,2])}
                        let score=e.state.score,receipts=e.pendingHUDStars
                        for coin in receipts {
                            XCTAssertTrue(e.commitHUDStarArrival(receiptID:coin.id,generation:coin.generation).accepted)
                            XCTAssertFalse(e.commitHUDStarArrival(receiptID:coin.id,generation:coin.generation).accepted)
                        }
                        XCTAssertEqual(e.state.score,score+100*receipts.count)
                    }}
                }
            }
        }
    }
    func testMagnetRewardUsesResultingComboIncludingPulls()throws {
        for variant in [nil,"honey","bottle","spaceship"] as [String?] {
            let e=engine(.magnet,variant,combo:20,extra:4)
            XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            let p=try XCTUnwrap(e.pendingSpecial);XCTAssertTrue(e.pendingHUDStars.isEmpty)
            XCTAssertTrue(e.prepareMagnetRespawn(transactionID:p.id).accepted)
            XCTAssertEqual(e.pendingHUDStars.count,7)
            XCTAssertFalse(e.prepareMagnetRespawn(transactionID:p.id).accepted)
            XCTAssertEqual(e.pendingHUDStars.count,7)
        }
    }
    func testNonfinalBeeUsesCommittedComboAndExpiredComboReturnsToOne()throws {
        for (prior,expected) in [(1,1),(2,2),(4,3),(9,4),(14,5),(19,6),(24,7)] {
            let e=engine(.star,"bee",combo:prior,extra:2)
            XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0),now:0).accepted)
            XCTAssertEqual(e.pendingHUDStars.count,expected)
        }
        var state=NativeBoardState(tiles:[
            .init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),
            .init(id:"bee",cell:.init(column:2,row:0),value:6,archetype:.star,variant:"bee"),
            .init(id:"d",cell:.init(column:3,row:0),value:2),.init(id:"e",cell:.init(column:4,row:0),value:1)])
        state.combo=24
        let e=NativeGameplayEngine(state:state);e.comboHUDCoinRewardsEnabled=true
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0),now:0).accepted)
        XCTAssertTrue(e.pendingHUDStars.isEmpty)
        XCTAssertTrue(e.beginDrag(tileID:"bee"));XCTAssertTrue(e.drop(target:.init(column:3,row:0),now:5).accepted)
        XCTAssertEqual(e.state.combo,1);XCTAssertEqual(e.pendingHUDStars.count,1)
    }
    func testRestartInvalidatesSevenCoinJobWithoutCredit()throws {
        let e=engine(.star,"bee",combo:24)
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        e.sourceHUDStarJobsEnabled=true
        let ids=e.pendingHUDStars.map(\.id),job=try XCTUnwrap(e.registerSourceHUDStarJob(receiptIDs:ids,generation:e.state.generation))
        e.restart(state:.init(tiles:[]));let state=e.state
        for id in ids {XCTAssertFalse(e.commitSourceHUDStarArrival(job:job,receiptID:id).accepted)}
        XCTAssertEqual(e.state,state);XCTAssertTrue(e.pendingHUDStars.isEmpty)
    }
}
