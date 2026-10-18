import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeWildStarEligibilityTests:XCTestCase {
    private func plainStar(_ choice:NativeWildRewardChoice?) -> Bool {choice?.archetype == .star && choice?.variant == nil}
    func testJourneyPlainStarIsForestOnlyAndEveryPoolStillProducesRewards() {
        let rolls = [0.0,0.199999,0.2,0.249999,0.25,0.499999,0.5,0.749999,0.75,0.999999]
        for board in 1...30 {
            XCTAssertFalse(NativeJourneyContent.rewardPool(board:board).isEmpty)
            XCTAssertEqual(NativeJourneyContent.rewardPool(board:board).contains("wild-star"),board <= 10)
            for count in [0,1,4] {for previous in NativeWildArchetype.allCases {for roll in rolls {
                let state=NativeBoardState(tiles:[],mode:.journey,board:board,wildSpawnCount:count,lastWildDropType:previous,wildDropTypeStreak:3)
                for unlocked in [false,true] {
                    let reward=NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:unlocked,nextRoll:{roll})
                    XCTAssertNotNil(reward,"board \(board), roll \(roll)")
                    if board > 10 {XCTAssertFalse(plainStar(reward),"board \(board)")}
                    if board == 1 {XCTAssertTrue(plainStar(reward))}
                    if board == 21 {XCTAssertEqual(reward?.variant,"kanta")}
                }
            }}}
        }
    }
    func testLockedArcadeHasNonemptyFallbackWithoutPlainStarAndKeepsAuthoredFirstFour() {
        for board in [1,2,10,11,20,21,24,30,31,50] {for count in [0,1,2,3,4,12] {for roll in [0.0,0.24,0.5,0.74,0.999999] {
            let state=NativeBoardState(tiles:[],mode:.arcade,board:board,wildSpawnCount:count,lastWildDropType:.star,wildDropTypeStreak:3)
            let reward=NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:false,nextRoll:{roll})
            XCTAssertNotNil(reward);XCTAssertFalse(plainStar(reward),"board \(board), count \(count)")
        }}}
        for unlocked in [false,true] {
            let firstFour:[(Int,NativeWildArchetype,String?)] = [(0,.magnet,nil),(1,.magnet,"bottle"),(2,.star,"cubero"),(3,.tnt,"barell")]
            for (count,kind,variant) in firstFour {
                let state=NativeBoardState(tiles:[],mode:.arcade,board:1,wildSpawnCount:count)
                let reward=NativeWildRewardPolicy.choose(state:state,roll:0,plainStarUnlocked:unlocked,nextRoll:{0})
                XCTAssertEqual(reward?.archetype,kind);XCTAssertEqual(reward?.variant,variant)
            }
        }
        let ordinary=NativeBoardState(tiles:[],mode:.arcade,board:2,wildSpawnCount:4)
        XCTAssertTrue(plainStar(NativeWildRewardPolicy.choose(state:ordinary,roll:0,plainStarUnlocked:true,nextRoll:{0})))
    }
    func testForestEvidenceUnlocksStarAndUnrelatedWorldEvidenceDoesNot() throws {
        XCTAssertFalse(NativeProgressionState().hasUnlockedWildStar)
        for board in 1...10 {
            var completed=NativeProgressionState();completed.completedJourneyBoards=[board]
            var played=NativeProgressionState();var stats=NativeBoardStats();stats.timesPlayed=1;played.boardStats[board]=stats
            var opened=NativeProgressionState();opened.lastOpenedJourneyBoard=board
            for evidence in [completed,played,opened] {
                XCTAssertTrue(evidence.hasUnlockedWildStar)
                XCTAssertTrue(try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(evidence)).hasUnlockedWildStar)
            }
        }
        for board in 11...30 {
            var other=NativeProgressionState();other.completedJourneyBoards=[board];other.lastOpenedJourneyBoard=board;other.highestUnlockedJourneyBoard=board
            var stats=NativeBoardStats();stats.timesPlayed=3;other.boardStats[board]=stats
            XCTAssertFalse(other.hasUnlockedWildStar)
        }
        for board in 2...10 {var legacy=NativeProgressionState();legacy.highestUnlockedJourneyBoard=board;XCTAssertTrue(legacy.hasUnlockedWildStar)}
        var emptyStats=NativeProgressionState();emptyStats.boardStats[1]=NativeBoardStats();XCTAssertFalse(emptyStats.hasUnlockedWildStar)
        var begun=NativeProgressionState();begun.beginAttempt(mode:.journey,board:1,now:1000);XCTAssertTrue(begun.hasUnlockedWildStar)
    }
    func testExistingPlainStarsInOtherWorldSavesRemainUsableWithoutSchemaMigration() throws {
        for board in [11,21] {
            let tile=NativeTile(id:"existing-star",cell:.init(column:0,row:0),value:6,starOrbitCount:3,archetype:.star)
            let run=NativeBoardState(tiles:[tile],mode:.journey,board:board,moves:49,rngState:123)
            var envelope=NativeSaveEnvelope(journeyRuns:[board:run]);envelope.savedAt=1000
            let loaded=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONEncoder().encode(envelope))
            try loaded.validate()
            let restored=try XCTUnwrap(loaded.resumedRun(mode:.journey,board:board,now:1001))
            XCTAssertEqual(restored.tiles,[tile]);XCTAssertEqual(restored.rngState,123)
            XCTAssertFalse(loaded.progression.hasUnlockedWildStar)
        }
    }
    func testLegacyForestEvidenceIsLatchedBeforeUnrelatedRouteChanges() throws {
        var opened=NativeProgressionState();opened.lastOpenedJourneyBoard=1
        opened.beginAttempt(mode:.journey,board:11,now:1000)
        XCTAssertEqual(opened.lastOpenedJourneyBoard,11)
        XCTAssertTrue(opened.hasUnlockedWildStar)
        XCTAssertTrue(try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(opened)).hasUnlockedWildStar)

        var legacy=NativeProgressionState();legacy.highestUnlockedJourneyBoard=2
        legacy.finishAttempt(mode:.journey,board:21,score:100,longestCombo:1,cubesCracked:2,clean:true,now:1000)
        XCTAssertEqual(legacy.highestUnlockedJourneyBoard,21)
        XCTAssertTrue(legacy.hasUnlockedWildStar)
        XCTAssertTrue(try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(legacy)).hasUnlockedWildStar)

        var unrelated=NativeProgressionState()
        unrelated.beginAttempt(mode:.journey,board:11,now:1000)
        unrelated.finishAttempt(mode:.journey,board:21,score:100,longestCombo:1,cubesCracked:2,clean:true,now:1001)
        XCTAssertFalse(unrelated.hasUnlockedWildStar)
    }
    func testOldSaveWithoutLatchPreservesForestUnlockAfterRouteChangesAndRejectsMalformedLatch() throws {
        var original=NativeProgressionState();original.lastOpenedJourneyBoard=1
        var payload=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(original)) as? [String:Any])
        payload.removeValue(forKey:"wildStarUnlocked")
        var decoded=try JSONDecoder().decode(NativeProgressionState.self,from:JSONSerialization.data(withJSONObject:payload))
        XCTAssertTrue(decoded.hasUnlockedWildStar)
        decoded.beginAttempt(mode:.journey,board:11,now:1000)
        decoded.finishAttempt(mode:.journey,board:21,score:100,longestCombo:1,cubesCracked:2,clean:true,now:1001)
        let saved=try JSONEncoder().encode(decoded)
        XCTAssertTrue(try JSONDecoder().decode(NativeProgressionState.self,from:saved).hasUnlockedWildStar)
        payload["wildStarUnlocked"]="true"
        XCTAssertThrowsError(try JSONDecoder().decode(NativeProgressionState.self,from:JSONSerialization.data(withJSONObject:payload)))
    }

}
