import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeRewardOracleTests:XCTestCase {
    func testAuthoredRewardPolicyMatchesSourceExceptExplicitNativeArcadeSequence() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource:"NativeRewardOracle",withExtension:"json"))
        let root = try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        let cases = root["cases"] as! [[String:Any]]
        XCTAssertGreaterThan(cases.count,10000)
        for fixture in cases {
            let input = fixture["input"] as! [String:Any],expected = fixture["expected"] as! [String:Any]
            let previous = (input["lastWildDropType"] as? String).flatMap(NativeWildArchetype.init(rawValue:))
            let state = NativeBoardState(tiles:[],mode:input["isArcade"] as! Bool ? .arcade : .journey,board:input["boardNumber"] as! Int,wildSpawnCount:input["wildSpawnCount"] as! Int,lastWildDropType:previous,wildDropTypeStreak:input["wildDropTypeStreak"] as! Int)
            let additional = input["additional"] as! [Double];var draws = 0
            let actual = NativeWildRewardPolicy.choose(state:state,roll:input["roll"] as! Double,nextRoll:{defer {draws += 1};return additional[min(draws,additional.count-1)]})
            let label = "\(input)"
            // Explicit Native product override; immutable PWA oracle remains unchanged.
            if state.mode == .arcade && state.board <= 1 && state.wildSpawnCount == 2 {
                XCTAssertEqual(actual?.archetype,.star,label)
                XCTAssertEqual(actual?.variant,"cubero",label)
            } else if state.mode == .arcade && state.board <= 1 && state.wildSpawnCount == 3 {
                XCTAssertEqual(actual?.archetype,.tnt,label)
                XCTAssertEqual(actual?.variant,"barell",label)
            } else {
                XCTAssertEqual(actual?.archetype.rawValue,expected["archetype"] as? String,label)
                XCTAssertEqual(actual?.variant,expected["variant"] as? String,label)
            }
            XCTAssertEqual(draws,expected["additionalDraws"] as? Int,label)
        }
    }
    func testArcadeOneGuaranteesCuberoAfterBottleAcrossSaveResume() throws {
        var state = NativeBoardState(tiles:[],mode:.arcade,board:1,wildSpawnCount:1)
        for (count,variant) in [(1,"bottle"),(2,"cubero"),(3,"barell")] {
            state.wildSpawnCount = count
            state = try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
            for roll in [0.0,0.49,0.66,0.83,0.999] {
                XCTAssertEqual(NativeWildRewardPolicy.choose(state:state,roll:roll,nextRoll:{0.99})?.variant,variant)
            }
        }
        state.board = 2; state.wildSpawnCount = 2
        XCTAssertNil(NativeWildRewardPolicy.choose(state:state,roll:0,nextRoll:{0.99})?.variant)
    }

}
