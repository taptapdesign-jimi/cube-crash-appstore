import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeRewardOracleTests:XCTestCase {
    func testArcadeRandomPoolIsIndependentOfDropNumberRoundHistoryAndResume() throws {
        for variant in NativeArcadeVariant.allCases {for unlocked in [false,true] {
            let base=NativeBoardState(tiles:[],mode:.arcade,board:1,arcadeVariant:variant)
            var identities=Set<String>()
            for index in 0..<100 {
                let roll=(Double(index)+0.5)/100
                let expected=try XCTUnwrap(NativeWildRewardPolicy.choose(state:base,roll:roll,plainStarUnlocked:unlocked,nextRoll:{XCTFail("No extra RNG draw");return 0}))
                identities.insert(expected.variant ?? expected.archetype.rawValue)
                for board in [1,2,11,21,50] {for count in 0...12 {for previous in NativeWildArchetype.allCases {
                    var state=base;state.board=board;state.wildSpawnCount=count;state.lastWildDropType=previous;state.wildDropTypeStreak=9
                    state=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
                    let actual=NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:unlocked,nextRoll:{XCTFail("No history override");return 0})
                    XCTAssertEqual(actual?.archetype,expected.archetype);XCTAssertEqual(actual?.variant,expected.variant)
                }}}
            }
            var expected=Set([NativeWildArchetype.juice.rawValue,NativeWildArchetype.magnet.rawValue,NativeWildArchetype.tnt.rawValue])
            if unlocked {expected.insert(NativeWildArchetype.star.rawValue)}
            if variant != .pureDice {expected.formUnion(["bottle","cubero","barell"])}
            XCTAssertEqual(identities,expected)
        }}
    }
}
