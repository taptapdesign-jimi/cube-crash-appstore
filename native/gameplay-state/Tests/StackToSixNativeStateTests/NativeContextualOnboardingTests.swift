import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeContextualOnboardingTests:XCTestCase {
    func testWorldFirstUnitChoiceAndCheckpointRoundTripAreIsolatedFromRealRuns()throws {
        for board in [1,11,21] {
            var state=NativeBoardFactory.make(mode:.journey,board:board,tutorial:true)
            var tutorial=NativeTutorialState()
            let reward=try XCTUnwrap(NativeJourneyContent.unlockReward(board:board))
            tutorial.rewardArchetype=reward.archetype;tutorial.rewardVariant=reward.variant
            state.tutorial=tutorial
            var envelope=NativeSaveEnvelope();envelope.recordPlayableRun(state,now:100)
            try envelope.validate()
            let decoded=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONEncoder().encode(envelope))
            XCTAssertEqual(decoded.firstPlayRun,state);XCTAssertTrue(decoded.journeyRuns.isEmpty)
            XCTAssertFalse(decoded.progression.firstPlayTutorialComplete)
            XCTAssertTrue(decoded.progression.completedJourneyBoards.isEmpty)
        }
    }
    func testArcadePracticeCannotCreateStatsPendingRoundOrConsumeRealRun()throws {
        for variant in NativeArcadeVariant.allCases {
            var envelope=NativeSaveEnvelope();envelope.activeArcadeVariant=variant
            let existing=NativeBoardFactory.make(mode:.arcade,board:4,arcadeVariant:variant)
            envelope.arcadeRun=existing
            var practice=NativeBoardFactory.make(mode:.arcade,board:1,tutorial:true,arcadeVariant:variant)
            practice.tutorial=NativeTutorialState()
            envelope.recordPlayableRun(practice,now:100)
            XCTAssertEqual(envelope.arcadeRun,existing);XCTAssertNil(envelope.pendingArcadeRound)
            XCTAssertEqual(envelope.firstPlayRun?.effectiveArcadeVariant,variant)
            XCTAssertEqual(envelope.progression.arcadeStats(for:variant),NativeArcadeStats())
            let low=NativeWildRewardPolicy.choose(state:practice,roll:0,plainStarUnlocked:false,allowEnduranceTrial:false,nextRoll:{0})
            let high=NativeWildRewardPolicy.choose(state:practice,roll:0.999,plainStarUnlocked:false,allowEnduranceTrial:false,nextRoll:{0})
            XCTAssertNotEqual(low,high)
        }
    }
    func testLegacyEnvelopeWithoutCheckpointStillDecodes()throws {
        let original=NativeSaveEnvelope()
        var json=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(original)) as? [String:Any])
        json.removeValue(forKey:"firstPlayRun")
        let decoded=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONSerialization.data(withJSONObject:json))
        XCTAssertNil(decoded.firstPlayRun);XCTAssertFalse(decoded.progression.firstPlayTutorialComplete)
    }
}
