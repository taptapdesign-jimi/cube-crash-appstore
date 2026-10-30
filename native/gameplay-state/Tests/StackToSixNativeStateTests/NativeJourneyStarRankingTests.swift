import XCTest
@testable import StackToSixNativeState

final class NativeJourneyStarRankingTests:XCTestCase {
    func testAllThirtyLevelsUseApprovedLocalLevelBoundariesAndCompletionGate() {
        let two=[14500,19500,25500,15500,20000,16000,22000,21000,21000,21500]
        let three=[35000,48000,62500,37000,48000,38000,54000,52000,52000,52000]
        for board in 1...30 {
            let i=(board-1)%10
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:0,board:board),1)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:two[i]-1,board:board),1)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:two[i],board:board),2)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:three[i]-1,board:board),2)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:three[i],board:board),3)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:999999,board:board,completed:false),0)
        }
    }
    func testFailedJourneyCannotRecordStatsOrPromoteLaterLowCompletion()throws {
        var p=NativeProgressionState()
        p.finishAttempt(mode:.journey,board:3,score:200000,longestCombo:99,cubesCracked:20,clean:false)
        XCTAssertEqual(p.journeyStars(board:3),0)
        XCTAssertNil(p.boardStats[3])
        p.finishAttempt(mode:.journey,board:3,score:1000,longestCombo:2,cubesCracked:5,clean:true)
        XCTAssertEqual(p.boardStats[3]?.highScore,1000)
        XCTAssertEqual(p.journeyStars(board:3),1)
        let restored=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(p))
        XCTAssertEqual(restored.journeyStars(board:3),1)
        let world=try NativeWorldLayouts().snapshot(world:1,width:390,height:844,generation:1,progression:restored)
        let units=try XCTUnwrap(world["units"] as? [[String:Any]])
        XCTAssertEqual(units[2]["stars"] as? Int,1)
        XCTAssertEqual(units[2]["cardRarity"] as? String,"common")
    }
    func testFailedReplayPreservesAllExistingJourneyStatistics()throws {
        var p=NativeProgressionState()
        p.finishAttempt(mode:.journey,board:18,score:15000,longestCombo:12,cubesCracked:30,clean:true,now:100)
        p.beginAttempt(mode:.journey,board:18,now:200)
        let before=p
        p.finishAttempt(mode:.journey,board:18,score:999999,longestCombo:99,cubesCracked:41,clean:false,now:300)
        XCTAssertEqual(p,before)
        let restored=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(p))
        XCTAssertEqual(restored,before)
    }
    func testLegacyAwardIsFrozenAndRetainedAcrossLowReplayAndNewSave()throws {
        for board in 1...30 {
            var old=NativeProgressionState()
            old.completedJourneyBoards.insert(board)
            var stats=NativeBoardStats();stats.highScore=10000;old.boardStats[board]=stats
            // Synthesized optional fields are absent in genuine pre-v1 documents.
            let data=try JSONEncoder().encode(old)
            var p=try JSONDecoder().decode(NativeProgressionState.self,from:data)
            XCTAssertEqual(p.journeyStars(board:board),3)
            XCTAssertEqual(p.boardStats[board]?.starRankingVersion,0)
            p.finishAttempt(mode:.journey,board:board,score:500,longestCombo:1,cubesCracked:3,clean:true)
            p.finishAttempt(mode:.journey,board:board,score:900000,longestCombo:99,cubesCracked:3,clean:false)
            let saved=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(p))
            XCTAssertEqual(saved.journeyStars(board:board),3)
            XCTAssertEqual(saved.boardStats[board]?.starRankingVersion,1)
            XCTAssertTrue(NativeJourneyContent.cardAsset(board:board,stars:saved.journeyStars(board:board)).contains("/legendary/"))
        }
    }
    func testNewAwardsUpgradeButNeverDowngradeAndArcadeRemainsSeparate()throws {
        var p=NativeProgressionState()
        for (score,stars) in [(1000,1),(14500,2),(35000,3),(0,3)] {
            p.finishAttempt(mode:.journey,board:1,score:score,longestCombo:4,cubesCracked:5,clean:true)
            XCTAssertEqual(p.journeyStars(board:1),stars)
        }
        p.finishAttempt(mode:.arcade,board:2,score:999999,longestCombo:99,cubesCracked:10,clean:true)
        XCTAssertEqual(p.journeyStars(board:2),0)
        XCTAssertEqual(p.arcadeStats.highScore,999999)
        let decoded=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(p))
        XCTAssertEqual(decoded,p)
    }
}
