import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeKiteRewardTests:XCTestCase {
    func testBeachEightIntroductionAndSaveIdentity() throws {
        for board in 1...30 {XCTAssertEqual(NativeJourneyContent.rewardPool(board:board).contains("kite"),(18...20).contains(board))}
        XCTAssertEqual(NativeJourneyContent.introductionID(board:18),"kite")
        for drop in 0...2 {
            let reward=NativeJourneyContent.reward(board:18,wildSpawnCount:drop,roll:0,unlockedDice:[],introducedDice:[])
            XCTAssertEqual(reward?.variant,"kite");XCTAssertEqual(reward?.archetype,.star)
        }
        XCTAssertEqual(NativeJourneyContent.reward(board:18,wildSpawnCount:2,roll:0.999,introducedDice:[])?.variant,"kite")
        let tile=NativeTile(id:"kite",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"kite")
        let restored=try JSONDecoder().decode(NativeTile.self,from:JSONEncoder().encode(tile))
        XCTAssertEqual(restored.variant,"kite");XCTAssertEqual(restored.gameplayArchetype,.star)
        XCTAssertEqual(restored.effectiveStarDropCount,1)
    }
}
