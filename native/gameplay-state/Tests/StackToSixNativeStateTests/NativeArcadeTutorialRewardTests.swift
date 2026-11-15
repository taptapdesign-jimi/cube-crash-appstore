import XCTest
@testable import StackToSixNativeState
import StackToSixGameplay

final class NativeArcadeTutorialRewardTests:XCTestCase {
    func testEveryTutorialPhaseAndVariantUsesOnlyTheFourBoxIdentities()throws {
        let expected:[NativeWildRewardChoice]=[.init(.star,variant:"cubero"),.init(.juice,variant:"baloon"),.init(.tnt),.init(.magnet)]
        XCTAssertEqual(NativeTutorialRules.arcadeRewards,expected)
        for variant in NativeArcadeVariant.allCases {for assisted in [false,true] {for drop in [0,1,8] {
            var tutorial=NativeTutorialState();tutorial.active = !assisted;tutorial.guideCompleted=assisted;tutorial.completionAssist=assisted
            // An older checkpoint's wrong selection cannot broaden later drops.
            tutorial.rewardArchetype = .magnet;tutorial.rewardVariant="bottle"
            var state=NativeBoardState(tiles:[],mode:.arcade,tutorial:tutorial,arcadeVariant:variant)
            state.wildSpawnCount=drop
            state=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
            for index in 0..<400 {
                let choice=NativeWildRewardPolicy.choose(state:state,roll:(Double(index)+0.5)/400,plainStarUnlocked:true,mushroomUnlocked:true,nextRoll:{XCTFail("No second tutorial draw");return 0})
                XCTAssertEqual(choice,expected[index/100])
            }
        }}}
    }
    func testActualInitialAndLaterMeterSpawnsUseBoxIdentities()throws {
        for staged in [false,true] {for initial in [false,true] {for index in 0..<4 {
            var tutorial=NativeTutorialState();tutorial.step = .freePlay;tutorial.waitingForWild=initial
            tutorial.active=initial;tutorial.guideCompleted = !initial;tutorial.completionAssist = !initial
            let state=NativeBoardState(tiles:[.init(id:"ordinary",cell:.init(column:0,row:0),value:2)],mode:.arcade,wildMeter:1,tutorial:tutorial)
            let engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:(Double(index)+0.5)/4,count:100),rewardPicker:{state,roll in
                NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:true,mushroomUnlocked:true,nextRoll:{0})
            })
            engine.stagedMeterDrops=staged;engine.stagedMeterOpen=staged
            if initial {engine.configureTutorialReward(NativeTutorialRules.arcadeRewards[index])}
            XCTAssertTrue(engine.claimMeterReward().accepted)
            let tile=try XCTUnwrap(staged ? engine.pendingMeterOpen?.tile:engine.state.activeTiles.first{$0.isWild})
            XCTAssertEqual(tile.archetype,NativeTutorialRules.arcadeRewards[index].archetype)
            XCTAssertEqual(tile.variant,NativeTutorialRules.arcadeRewards[index].variant)
        }}}
    }
    func testRestoredIllegalInitialRewardCanBeReplacedButValidSelectionStays() {
        for old in [NativeWildRewardChoice(.juice),.init(.magnet,variant:"bottle"),.init(.star)] {
            var tutorial=NativeTutorialState();tutorial.rewardArchetype=old.archetype;tutorial.rewardVariant=old.variant
            let engine=NativeGameplayEngine(state:.init(tiles:[],mode:.arcade,tutorial:tutorial))
            engine.configureTutorialReward(.init(.juice,variant:"baloon"))
            XCTAssertEqual(engine.state.tutorial?.reward,.init(.juice,variant:"baloon"))
            engine.configureTutorialReward(.init(.tnt))
            XCTAssertEqual(engine.state.tutorial?.reward,.init(.juice,variant:"baloon"))
        }
    }
    func testOrdinaryArcadeAndJourneyRetainTheirRewardPolicies() {
        let ordinary=NativeBoardState(tiles:[],mode:.arcade)
        XCTAssertEqual(NativeWildRewardPolicy.choose(state:ordinary,roll:0,plainStarUnlocked:false,allowEnduranceTrial:false,nextRoll:{0}),.init(.star,variant:"cubero"))
        var finished=ordinary;var tutorial=NativeTutorialState();tutorial.done=true;finished.tutorial=tutorial
        XCTAssertEqual(NativeWildRewardPolicy.choose(state:finished,roll:0,plainStarUnlocked:false,allowEnduranceTrial:false,nextRoll:{0}),.init(.star,variant:"cubero"))
        let journey=NativeBoardState(tiles:[],mode:.journey,board:11,tutorial:NativeTutorialState())
        XCTAssertEqual(NativeWildRewardPolicy.choose(state:journey,roll:0,plainStarUnlocked:false,nextRoll:{0}),.init(.juice))
    }
}
