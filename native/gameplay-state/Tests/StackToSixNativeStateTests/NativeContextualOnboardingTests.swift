import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeContextualOnboardingTests:XCTestCase {
    func testCollectionGuidanceReceiptPersistsAndLegacySavesRemainReadable()throws {
        var envelope=NativeSaveEnvelope()
        XCTAssertFalse(envelope.progression.tutorialCollectionGuidanceSeen)
        envelope.progression.tutorialCollectionGuidanceSeen=true
        let restored=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONEncoder().encode(envelope))
        XCTAssertTrue(restored.progression.tutorialCollectionGuidanceSeen)
        var legacy=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(envelope.progression)) as? [String:Any])
        legacy.removeValue(forKey:"tutorialCollectionGuidanceSeen")
        XCTAssertFalse(try JSONDecoder().decode(NativeProgressionState.self,from:JSONSerialization.data(withJSONObject:legacy)).tutorialCollectionGuidanceSeen)
        legacy["firstPlayTutorialComplete"]=true
        XCTAssertTrue(try JSONDecoder().decode(NativeProgressionState.self,from:JSONSerialization.data(withJSONObject:legacy)).tutorialCollectionGuidanceSeen)
    }
    func testIncompleteGuideResumesSameModeButSwitchStartsFreshAcrossRelaunch()throws {
        for mode in [NativeRunMode.journey,.arcade] {
            var envelope=NativeSaveEnvelope()
            var run=NativeBoardFactory.make(mode:mode,board:mode == .journey ? 11:1,tutorial:true,arcadeVariant:.slowBurn)
            var tutorial=NativeTutorialState();tutorial.step = .freePlay;tutorial.objectiveAcknowledged=true
            tutorial.rewardArchetype = .juice;tutorial.rewardVariant="juice"
            run.tutorial=tutorial;run.score=123;run.moves=37
            envelope.firstPlayRun=run
            let data=try JSONEncoder().encode(envelope)
            var restored=try JSONDecoder().decode(NativeSaveEnvelope.self,from:data)
            let same=restored.firstPlayDestination(requestedBoard:mode == .journey ? 1:nil)
            XCTAssertEqual(same,mode == .journey ? 11:nil)
            XCTAssertEqual(restored.firstPlayCheckpoint(mode:mode,board:run.board),run)
            let other:NativeRunMode=mode == .journey ? .arcade:.journey
            let destination=restored.firstPlayDestination(requestedBoard:other == .journey ? 13:nil)
            XCTAssertEqual(destination,other == .journey ? 11:nil)
            XCTAssertNil(restored.firstPlayCheckpoint(mode:other,board:destination ?? 1))
            XCTAssertEqual(restored.firstPlayRun,run,"Canceled preparation retains the existing guide")
            var fresh=NativeBoardFactory.make(mode:other,board:destination ?? 1,tutorial:true)
            fresh.tutorial=NativeTutorialState()
            restored.recordPlayableRun(fresh,now:100)
            restored=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONEncoder().encode(restored))
            XCTAssertEqual(restored.firstPlayRun,fresh)
            XCTAssertNil(restored.firstPlayCheckpoint(mode:mode,board:run.board),"Switching back cannot resurrect the discarded guide")
            XCTAssertTrue(restored.journeyRuns.isEmpty);XCTAssertNil(restored.arcadeRun)
            restored.progression.firstPlayTutorialComplete=true
            XCTAssertEqual(restored.firstPlayDestination(requestedBoard:13),13)
            XCTAssertNil(restored.firstPlayCheckpoint(mode:other,board:fresh.board))
        }
    }
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
    func testOrphanSuccessorRunAfterTutorialStartsFreshButRealAttemptResumes() {
        var envelope=NativeSaveEnvelope()
        envelope.progression.firstPlayTutorialComplete=true
        envelope.progression.completedJourneyBoards.insert(1)
        var stale=NativeBoardFactory.make(mode:.journey,board:2)
        stale.moves=49;stale.score=8203
        envelope.journeyRuns[2]=stale;envelope.journeyRunSavedAt[2]=1000
        XCTAssertNil(envelope.resumedRun(mode:.journey,board:2,now:1001))
        envelope.progression.beginAttempt(mode:.journey,board:2,now:1000)
        XCTAssertEqual(envelope.resumedRun(mode:.journey,board:2,now:1001)?.score,8203)
    }
}
