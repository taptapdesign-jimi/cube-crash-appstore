import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeRewardOracleTests:XCTestCase {
    func testAuthoredRewardPolicyMatchesIndependentTypeScriptIncludingRandomConsumption() throws {
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
            XCTAssertEqual(actual?.archetype.rawValue,expected["archetype"] as? String,label)
            XCTAssertEqual(actual?.variant,expected["variant"] as? String,label)
            XCTAssertEqual(draws,expected["additionalDraws"] as? Int,label)
        }
    }
}
