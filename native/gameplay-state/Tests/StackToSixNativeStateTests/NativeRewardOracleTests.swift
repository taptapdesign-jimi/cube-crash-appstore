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
            let actual = NativeWildRewardPolicy.choose(state:state,roll:input["roll"] as! Double,plainStarUnlocked:true,nextRoll:{defer {draws += 1};return additional[min(draws,additional.count-1)]})
            let label = "\(input)"
            // Explicit Native product override; immutable PWA oracle remains unchanged.
            if state.mode == .arcade && state.board <= 1 && state.wildSpawnCount == 2 {
                XCTAssertEqual(actual?.archetype,.star,label)
                XCTAssertEqual(actual?.variant,"cubero",label)
            } else if state.mode == .arcade && state.board <= 1 && state.wildSpawnCount == 3 {
                XCTAssertEqual(actual?.archetype,.tnt,label)
                XCTAssertEqual(actual?.variant,"barell",label)
            } else if state.mode == .journey && (12...20).contains(state.board) {
                let slotRoll = state.board == 12 && state.wildSpawnCount == 0 ? nil : additional[min(max(0,draws-1),additional.count-1)]
                let slot = slotRoll.map { value in (0..<4).first { value + Double.ulpOfOne < Double($0+1)*0.25 } ?? 3 } ?? 1
                let choices:[NativeWildRewardChoice] = [.init(.star,variant:"fish"),.init(.juice),.init(.tnt,variant:"beach-ball"),.init(.magnet,variant:"bottle")]
                XCTAssertEqual(actual?.archetype,choices[slot].archetype,label)
                XCTAssertEqual(actual?.variant,choices[slot].variant,label)
            } else if state.mode == .journey && (21...30).contains(state.board) {
                // Explicit Forest-only plain Star rule; immutable PWA oracle is retained.
                let variants:[String] = state.board == 21 ? ["kanta"] : state.board == 22 ? ["kanta","robo-cube"] : state.board == 23 ? ["kanta","robo-cube","spaceship"] : ["kanta","robo-cube","spaceship","laser-gun"]
                let forced:[Int:String] = [21:"kanta",22:"robo-cube",23:"spaceship",24:"laser-gun"]
                let raw = input["roll"] as! Double
                let bounded = raw.isFinite ? max(0,min(1-Double.ulpOfOne,raw)) : 0
                let variant = state.wildSpawnCount == 0 && state.board <= 24 ? forced[state.board] ?? variants[0] : variants[min(variants.count-1,Int(bounded*Double(variants.count)))]
                XCTAssertEqual(actual?.variant,variant,label)
                XCTAssertEqual(actual?.archetype,NativeSpecialDiceRegistry.variants[variant]?.archetype,label)
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
                XCTAssertEqual(NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:true,nextRoll:{0.99})?.variant,variant)
            }
        }
        state.board = 2; state.wildSpawnCount = 2
        XCTAssertNil(NativeWildRewardPolicy.choose(state:state,roll:0,plainStarUnlocked:true,nextRoll:{0.99})?.variant)
    }

}
