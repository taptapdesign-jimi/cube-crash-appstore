import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeRewardOracleTests:XCTestCase {
    func testArcadeRandomPoolIsIndependentOfDropNumberRoundHistoryAndResume() throws {
        for variant in NativeArcadeVariant.allCases {for unlocked in [false,true] {
            let base=NativeBoardState(tiles:[],mode:.arcade,board:2,arcadeVariant:variant)
            var identities=Set<String>()
            for index in 0..<100 {
                let roll=(Double(index)+0.5)/100
                let expected=try XCTUnwrap(NativeWildRewardPolicy.choose(state:base,roll:roll,plainStarUnlocked:unlocked,nextRoll:{XCTFail("No extra RNG draw");return 0}))
                identities.insert(expected.variant ?? expected.archetype.rawValue)
                for board in [1,2,11,21,50] {for count in 0...12 {for previous in NativeWildArchetype.allCases {
                    if NativeWildRewardPolicy.enduranceBaloonFirstDropTrialEnabled && variant == .endurance && board == 1 && count == 0 {continue}
                    var state=base;state.board=board;state.wildSpawnCount=count;state.lastWildDropType=previous;state.wildDropTypeStreak=9
                    state=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
                    let actual=NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:unlocked,nextRoll:{XCTFail("No history override");return 0})
                    XCTAssertEqual(actual?.archetype,expected.archetype);XCTAssertEqual(actual?.variant,expected.variant)
                }}}
            }
            var expected=Set([NativeWildArchetype.juice.rawValue,NativeWildArchetype.magnet.rawValue,NativeWildArchetype.tnt.rawValue,"baloon"])
            if unlocked {expected.insert(NativeWildArchetype.star.rawValue)}
            if variant != .pureDice {expected.formUnion(["bottle","cubero","barell"])}
            XCTAssertEqual(identities,expected)
        }}
    }
    func testBaloonIsArcadeOnlyAndNeverEntersAnyJourneyRewardPool() {
        for board in 1...30 {for spawn in 0..<5 {for index in 0..<100 {
            var state=NativeBoardState(tiles:[],mode:.journey,board:board);state.wildSpawnCount=spawn
            let reward=NativeWildRewardPolicy.choose(state:state,roll:Double(index)/100,plainStarUnlocked:true,nextRoll:{0.5})
            XCTAssertNotEqual(reward?.variant,"baloon")
        }}}
        let state=NativeBoardState(tiles:[],mode:.arcade,board:1)
        let choices=(0..<100).compactMap {NativeWildRewardPolicy.choose(state:state,roll:Double($0)/100,plainStarUnlocked:false,nextRoll:{0.5})}
        XCTAssertTrue(choices.contains{$0.variant=="baloon" && $0.archetype == .juice})
    }

    func testUserTrialForcesOnlyFirstSpecialOfNewEnduranceRunUntilExplicitlyDisabled() {
        guard NativeWildRewardPolicy.enduranceBaloonFirstDropTrialEnabled else{return}
        for roll in [0.0,0.2,0.7,0.999] {for unlocked in [false,true] {
            let state=NativeBoardState(tiles:[],mode:.arcade,board:1,arcadeVariant:.endurance)
            let reward=NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:unlocked,nextRoll:{XCTFail("Trial adds no RNG draw");return 0})
            XCTAssertEqual(reward?.variant,"baloon");XCTAssertEqual(reward?.archetype,.juice)
            var later=state;later.wildSpawnCount=1
            XCTAssertNotEqual(NativeWildRewardPolicy.choose(state:later,roll:0.99,plainStarUnlocked:unlocked,nextRoll:{0})?.variant,"baloon")
            later=state;later.board=2
            XCTAssertNotEqual(NativeWildRewardPolicy.choose(state:later,roll:0.99,plainStarUnlocked:unlocked,nextRoll:{0})?.variant,"baloon")
        }}
    }

}
