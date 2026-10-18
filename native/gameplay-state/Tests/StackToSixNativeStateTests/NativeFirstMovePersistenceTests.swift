import XCTest
import Foundation
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeFirstMovePersistenceTests:XCTestCase {
    func testEveryJourneyBoardRequiresRecordedMoveBeforeLayoutIsResumable()throws {
        for board in 1...30 {
            var envelope=NativeSaveEnvelope()
            var state=NativeBoardFactory.make(mode:.journey,board:board)
            state.revision=100 // Preparation is not a move.
            state.score=1200 // Carried score is not a move.
            envelope.recordPlayableRun(state,now:1000)
            XCTAssertNil(envelope.journeyRuns[board])
            XCTAssertNil(envelope.resumedRun(mode:.journey,board:board,now:1001))
            state.moves -= 1
            envelope.recordPlayableRun(state,now:1000)
            let loaded=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONEncoder().encode(envelope))
            let resumed=try XCTUnwrap(loaded.resumedRun(mode:.journey,board:board,now:1001))
            XCTAssertEqual(resumed.tiles,state.tiles)
            XCTAssertEqual(resumed.moves,49)
        }
    }
    func testEveryArcadeVariantPreservesRoundAndScoreWithoutSavingUntouchedLayout()throws {
        var envelope=NativeSaveEnvelope()
        for variant in NativeArcadeVariant.allCases {
            envelope.activeArcadeVariant=variant
            var state=NativeBoardFactory.make(mode:.arcade,board:3,arcadeVariant:variant)
            state.score=987;state.wildMeter=0.25
            envelope.recordPlayableRun(state,now:1000)
            XCTAssertNil(envelope.arcadeRun)
            XCTAssertEqual(envelope.pendingArcadeRound?.round,3)
            XCTAssertEqual(envelope.pendingArcadeRound?.score,987)
            XCTAssertEqual(envelope.pendingArcadeRound?.meterProgress,0.25)
            state.moves -= 1
            envelope.recordPlayableRun(state,now:1000)
            XCTAssertNil(envelope.pendingArcadeRound)
            let loaded=try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONEncoder().encode(envelope))
            XCTAssertEqual(loaded.resumedRun(mode:.arcade,board:3,now:1001)?.tiles,state.tiles)
        }
    }
    func testLegacyCleanupKeepsPlayedRunsAndEveryVariantsEarnedRound() {
        var envelope=NativeSaveEnvelope()
        for board in 1...30 {
            var state=NativeBoardFactory.make(mode:.journey,board:board)
            if board % 2 == 0 {state.moves=49}
            envelope.journeyRuns[board]=state
        }
        for variant in NativeArcadeVariant.allCases {
            envelope.activeArcadeVariant=variant
            var state=NativeBoardFactory.make(mode:.arcade,board:4,arcadeVariant:variant)
            state.score=345;state.wildMeter=0.17
            envelope.arcadeRun=state
        }
        envelope.activeArcadeVariant = .pureDice
        envelope.discardUntouchedLayouts()
        XCTAssertEqual(envelope.activeArcadeVariant,.pureDice)
        XCTAssertEqual(Set(envelope.journeyRuns.keys),Set((1...30).filter{$0 % 2 == 0}))
        for variant in NativeArcadeVariant.allCases {
            envelope.activeArcadeVariant=variant
            XCTAssertNil(envelope.arcadeRun)
            XCTAssertEqual(envelope.pendingArcadeRound?.round,4)
            XCTAssertEqual(envelope.pendingArcadeRound?.score,345)
            XCTAssertEqual(envelope.pendingArcadeRound?.meterProgress,0.17)
        }
    }
    func testLegacyUntouchedLayoutsAreNotContinueButPlayedLayoutsRemain() {
        var envelope=NativeSaveEnvelope()
        var state=NativeBoardFactory.make(mode:.journey,board:2)
        state.revision=42;state.score=500
        envelope.journeyRuns[2]=state;envelope.journeyRunSavedAt[2]=1000
        XCTAssertNil(envelope.resumedRun(mode:.journey,board:2,now:1001))
        state.moves=49;envelope.journeyRuns[2]=state
        XCTAssertNotNil(envelope.resumedRun(mode:.journey,board:2,now:1001))
    }
}
