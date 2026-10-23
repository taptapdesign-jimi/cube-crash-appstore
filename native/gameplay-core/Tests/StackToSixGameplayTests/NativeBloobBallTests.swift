import XCTest
@testable import StackToSixGameplay

final class NativeBloobBallTests:XCTestCase {
    func testNewMeterPodCapturesFixedTwoWithoutExtraRandomDraw() throws {
        for variant in ["bee","bloob-ball"] {
            var draws=0
            let math=NativeSourceMathRandomStream{draws+=1;return 0.8}
            let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4)],wildMeter:1.25),rewardPicker:{_,_ in .init(.star,variant:variant)},sourceMathRandom:math)
            engine.stagedMeterDrops=true;engine.stagedMeterOpen=true;engine.sourceStarOrbitCountAtPresentationEnabled=true
            XCTAssertTrue(engine.claimMeterReward().accepted)
            let request=try XCTUnwrap(engine.pendingMeterOpen)
            XCTAssertEqual(request.tile.starOrbitCount,variant=="bee" ? 1:2)
            XCTAssertEqual(request.tile.effectiveStarDropCount,variant=="bee" ? 1:2)
            XCTAssertEqual(draws,2)
        }
    }
    func testBothMergeDirectionsUseStandardTwoBonusAndSevenClosedDice() throws {
        for mode in [NativeRunMode.journey,.arcade] {for final in [false,true] {for reverse in [false,true] {
            func merge(_ variant:String,_ count:Int)->NativeGameplayEngine {
                let wild=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,starOrbitCount:count,archetype:.star,variant:variant)
                let ordinary=NativeTile(id:"ordinary",cell:.init(column:1,row:0),value:2)
                var tiles=[wild,ordinary]
                if !final {tiles.append(.init(id:"blocker",cell:.init(column:2,row:0),value:1))}
                let engine=NativeGameplayEngine(state:.init(tiles:tiles,mode:mode),recordedRandomChoices:Array(repeating:0.4,count:300))
                XCTAssertTrue(engine.beginDrag(tileID:reverse ? "ordinary":"wild"))
                XCTAssertTrue(engine.drop(target:reverse ? wild.cell:ordinary.cell).accepted)
                return engine
            }
            let pod=merge("bloob-ball",1),standard=merge("kanta",2)
            XCTAssertEqual(pod.state.tiles.filter(\.isActive).count,standard.state.tiles.filter(\.isActive).count)
            XCTAssertEqual(pod.state.tiles.filter(\.locked).count,standard.state.tiles.filter(\.locked).count)
            XCTAssertEqual(pod.state.terminal,standard.state.terminal)
            if final {XCTAssertTrue(pod.state.tiles.isEmpty)}
            else {
                XCTAssertEqual(pod.state.tiles.filter{$0.isActive && !$0.isWild}.count,4) // blocker + primary +2bonus
                XCTAssertEqual(pod.state.tiles.filter(\.locked).count,5) //7closed constructed,2opened as bonuses
            }
            let restored=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(NativeBoardState(tiles:[.init(id:"old",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:.star,variant:"bloob-ball")])))
            XCTAssertEqual(restored.tiles[0].effectiveStarDropCount,2)
        }}}
        let bonus=NativeSpawnRules.wildBonus(archetype:.star,isLastMerge:false,isArcadeSimpleWild:false,isFinalWildSnapshot:false,starOrbitCount:2)
        XCTAssertEqual(bonus.active,2);XCTAssertEqual(bonus.locked,7)
    }
    func testFixedTwoBonusSpecialIdentityAndCanonicalSixCoinReceipts()throws {
        for mode in [NativeRunMode.arcade,.journey] {for final in [false,true] {for combo in [false,true] {
            let ball=NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bloob-ball")
            var tiles=[ball,NativeTile(id:"d",cell:.init(column:1,row:0),value:2)]
            if !final {tiles.append(.init(id:"blocker",cell:.init(column:2,row:0),value:1))}
            let e=NativeGameplayEngine(state:.init(tiles:tiles,mode:mode))
            e.comboHUDCoinRewardsEnabled=combo
            XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            XCTAssertEqual(ball.effectiveStarDropCount,2)
            XCTAssertEqual(e.pendingHUDStars.count,6)
            XCTAssertEqual(Set(e.pendingHUDStars.map(\.ordinal)),Set(0..<6))
            XCTAssertTrue(e.pendingHUDStars.allSatisfy{$0.variant=="bloob-ball" && $0.isFinalMerge==final})
            let restored=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(NativeBoardState(tiles:[ball])))
            XCTAssertEqual(restored.tiles.first?.variant,"bloob-ball")
            let ids=e.pendingHUDStars.map(\.id),before=e.state.score
            for id in ids {XCTAssertTrue(e.commitHUDStarArrival(receiptID:id,generation:e.state.generation).accepted);XCTAssertFalse(e.commitHUDStarArrival(receiptID:id,generation:e.state.generation).accepted)}
            XCTAssertEqual(e.state.score-before,600)
            XCTAssertEqual(e.pendingHUDStars.count,0)
        }}}
    }
}
