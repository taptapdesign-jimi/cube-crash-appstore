import XCTest
@testable import StackToSixGameplay

final class NativeFinalHUDCoinTests:XCTestCase {
    func testFinalPairAllFamiliesVariantsModesAndDirectionsEarnCoinsWithoutSpawning() throws {
        let identities:[(NativeWildArchetype?,String?)]=[(nil,nil),(.star,nil),(.juice,nil),(.tnt,nil),(.magnet,nil),(.juice,"beach-ball"),(.magnet,"beach-ball")] + NativeSpecialDiceRegistry.variants.values.map{(Optional($0.archetype),Optional($0.id))}
        for mode in [NativeRunMode.journey,.arcade] {for (archetype,variant) in identities {for reverse in [false,true] {
            let tag="\(mode)/\(String(describing:archetype))/\(variant ?? "base")/\(reverse)"
            let first=NativeTile(id:"a",cell:.init(column:0,row:0),value:archetype==nil ? 3:6,starOrbitCount:3,archetype:archetype,variant:variant)
            let second=NativeTile(id:"b",cell:.init(column:1,row:0),value:3)
            let engine=NativeGameplayEngine(state:.init(tiles:[first,second],mode:mode),recordedRandomChoices:[0.5])
            engine.stagedDirectWildMoves=archetype != nil;engine.stagedDirectWildAssignments=true
            engine.sourceHUDStarJobsEnabled=true
            if archetype == .star && variant == nil {
                let generation=engine.state.generation
                engine.sourceSpecialContactHook=NativeSourceSpecialContactHook{_,_,_ in
                    .init(isCurrent:{true},rejected:{XCTFail("Final coin capture must be admitted")},
                        starOrbitCapture:.init(tileID:"a",generation:generation,savedPositions:0,savedSystem:3))
                }
            }

            XCTAssertTrue(engine.beginDrag(tileID:reverse ? "b":"a"),tag)
            var result=engine.drop(target:reverse ? first.cell:second.cell)
            XCTAssertTrue(result.accepted,tag)
            if let plan=engine.pendingDirectWild {XCTAssertTrue(plan.isFinal,tag);result=engine.commitDirectWildGameplay(transactionID:plan.id)}
            XCTAssertTrue(result.accepted,tag)
            let count=try XCTUnwrap(result.events.first{$0.kind == .hudStarsPrepared},tag).tileIDs.count
            XCTAssertEqual(count,variant=="bloob-ball" ? 6:first.gameplayArchetype == .tnt ? 3:archetype == .star ? (variant == "bee" ? 1:3):archetype == .juice ? 2:1,tag)
            XCTAssertTrue(engine.state.tiles.isEmpty,tag);XCTAssertTrue(engine.pendingMeterRewards.isEmpty,tag)
            XCTAssertFalse(result.events.contains{$0.kind == .spawned},tag)
            XCTAssertTrue(engine.pendingHUDStars.allSatisfy(\.isFinalMerge),tag)
            let score=engine.state.score,receipts=engine.pendingHUDStars.map(\.id)
            let groups=variant=="bloob-ball" ? receipts.map{[$0]}:[receipts]
            for group in groups {
            let job=try XCTUnwrap(engine.registerSourceHUDStarJob(receiptIDs:group,generation:engine.state.generation),tag)
            for id in group {
                XCTAssertTrue(engine.commitSourceHUDStarArrival(job:job,receiptID:id).accepted,tag)
                XCTAssertFalse(engine.commitSourceHUDStarArrival(job:job,receiptID:id).accepted,tag)
            }
            XCTAssertTrue(engine.retireSourceHUDStarJob(job:job),tag)
            }
            XCTAssertEqual(engine.state.score,score+count*100,tag)
            if let plan=engine.pendingDirectWild {XCTAssertTrue(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted,tag)}
            XCTAssertEqual(engine.state.terminal?.kind,.complete,tag)
        }}}
    }
    func testNonFinalWildCoinsDoNotCarryFinalSpeedAdmission() {
        for archetype in [NativeWildArchetype.star,.juice] {
            let engine=NativeGameplayEngine(state:.init(tiles:[
                .init(id:"s",cell:.init(column:0,row:0),value:6,archetype:archetype),
                .init(id:"d",cell:.init(column:1,row:0),value:2),
                .init(id:"other",cell:.init(column:2,row:0),value:1)]),recordedRandomChoices:[0.5])
            XCTAssertTrue(engine.beginDrag(tileID:"s"))
            XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            XCTAssertFalse(engine.pendingHUDStars.isEmpty)
            XCTAssertTrue(engine.pendingHUDStars.allSatisfy{!$0.isFinalMerge})
        }
    }
    func testFinalLegacyBeachBallGetsThreeCoinsWithoutSkippingItsExistingMathDraw() {
        var draws=0
        let math=NativeSourceMathRandomStream{draws+=1;return 0.5}
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"a",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"beach-ball"),
            .init(id:"b",cell:.init(column:1,row:0),value:3)]),sourceMathRandom:math)
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
        XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        XCTAssertEqual(engine.pendingHUDStars.count,3)
        XCTAssertEqual(draws,1)
        XCTAssertTrue(engine.state.tiles.isEmpty)
    }

    func testTwoWildDiceRemainIllegalAndNeverMintFinalCoins() {
        let variants:[String?]=[nil]+NativeSpecialDiceRegistry.variants.values.filter{$0.archetype == .tnt}.map{Optional($0.id)}
        for variant in variants {for reverse in [false,true] {
            let star=NativeTile(id:"star",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:.star)
            let tnt=NativeTile(id:"tnt",cell:.init(column:1,row:0),value:6,archetype:.tnt,variant:variant)
            let engine=NativeGameplayEngine(state:.init(tiles:[star,tnt]))
            XCTAssertTrue(engine.beginDrag(tileID:reverse ? tnt.id:star.id))
            XCTAssertFalse(engine.drop(target:reverse ? star.cell:tnt.cell).accepted)
            XCTAssertTrue(engine.pendingHUDStars.isEmpty)
            XCTAssertEqual(engine.state.tiles.count,2)
            XCTAssertNil(engine.state.terminal)
        }}
    }

}
