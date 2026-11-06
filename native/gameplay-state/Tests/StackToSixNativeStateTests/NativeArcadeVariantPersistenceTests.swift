import XCTest
import Foundation
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeArcadeVariantPersistenceTests: XCTestCase {
    func testResetRecordOnlyChangesSelectedVariant() {
        var progression = NativeProgressionState()
        for variant in NativeArcadeVariant.allCases {
            progression.finishAttempt(mode: .arcade, board: 2, score: 1234, longestCombo: 3, cubesCracked: 4, clean: true, arcadeVariant: variant)
        }
        progression.resetArcadeStats(for: .pureDice)
        XCTAssertEqual(progression.arcadeStats(for: .pureDice), NativeArcadeStats())
        XCTAssertEqual(progression.arcadeStats(for: .endurance).highScore, 1234)
        XCTAssertEqual(progression.arcadeStats(for: .slowBurn).highScore, 1234)
    }
    func testRecordsHistoriesAndResetRemainIndependentAfterSaveReload() throws {
        var progression=NativeProgressionState()
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            progression.beginAttempt(mode:.arcade,board:index+2,arcadeVariant:variant,now:100)
            progression.finishAttempt(mode:.arcade,board:index+2,score:(index+1)*1000,
                longestCombo:index+3,cubesCracked:index+4,clean:true,arcadeVariant:variant,now:101)
            progression.finishAttempt(mode:.arcade,board:index+3,score:(index+1)*100,
                longestCombo:1,cubesCracked:2,clean:false,arcadeVariant:variant,now:102)
        }
        var loaded=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(progression))
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            let stats=loaded.arcadeStats(for:variant)
            XCTAssertEqual(stats.highScore,(index+1)*1000)
            XCTAssertEqual(stats.longestCombo,index+3)
            XCTAssertEqual(stats.cubesCracked,index+6)
            XCTAssertEqual(stats.highestStageOpened,index+3)
            XCTAssertEqual(stats.scoreHistory?.map(\.value),[(index+1)*1000,(index+1)*100])
            XCTAssertEqual(stats.comboHistory?.map(\.value),[index+3,1])
        }
        let endurance=loaded.arcadeStats(for:.endurance),slow=loaded.arcadeStats(for:.slowBurn)
        loaded.resetArcadeStats(for:.pureDice)
        let reset=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(loaded))
        XCTAssertEqual(reset.arcadeStats(for:.pureDice),NativeArcadeStats())
        XCTAssertEqual(reset.arcadeStats(for:.endurance),endurance)
        XCTAssertEqual(reset.arcadeStats(for:.slowBurn),slow)
        XCTAssertTrue(reset.boardStats.isEmpty)
    }
    func testLegacyDocumentDefaultsToEnduranceWithoutLosingRunOrRecord() throws {
        var original = NativeSaveEnvelope()
        original.arcadeRun = NativeBoardFactory.make(mode: .arcade, board: 3)
        original.progression.arcadeStats.highScore = 1234
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(original)) as? [String: Any])
        for key in ["activeArcadeVariant", "arcadeVariantRuns", "arcadeVariantPendingRounds", "arcadeVariantRunSavedAt"] { json.removeValue(forKey: key) }
        var progression = try XCTUnwrap(json["progression"] as? [String: Any])
        progression.removeValue(forKey: "arcadeVariantStats"); json["progression"] = progression
        let loaded = try JSONDecoder().decode(NativeSaveEnvelope.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertEqual(loaded.activeArcadeVariant, .endurance)
        XCTAssertEqual(loaded.arcadeRun, original.arcadeRun)
        XCTAssertEqual(loaded.progression.arcadeStats(for: .endurance).highScore, 1234)
        XCTAssertEqual(loaded.progression.arcadeStats(for: .pureDice).highScore, 0)
        try loaded.validate()
    }

    func testAllVariantsRetainIndependentRunsPendingMeterAndScores() throws {
        var envelope = NativeSaveEnvelope()
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            envelope.activeArcadeVariant = variant
            envelope.arcadeRun = NativeBoardFactory.make(mode: .arcade, board: index + 1, arcadeVariant: variant)
            envelope.arcadeRun?.moves = 49
            envelope.pendingArcadeRound = .init(round: index + 2, score: index * 100, meterProgress: Double(index))
            envelope.arcadeRunSavedAt = 1000
            envelope.progression.finishAttempt(mode: .arcade, board: index + 1, score: (index + 1) * 100, longestCombo: 2, cubesCracked: 4, clean: true, arcadeVariant: variant, now: 1000)
        }
        var loaded = try JSONDecoder().decode(NativeSaveEnvelope.self, from: JSONEncoder().encode(envelope))
        try loaded.validate()
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            loaded.activeArcadeVariant = variant
            XCTAssertEqual(loaded.resumedRun(mode: .arcade, board: index + 1, now: 1001)?.effectiveArcadeVariant, variant)
            XCTAssertEqual(loaded.pendingArcadeRound?.meterProgress, Double(index))
            XCTAssertEqual(loaded.progression.arcadeStats(for: variant).highScore, (index + 1) * 100)
        }
        loaded.activeArcadeVariant = .pureDice
        loaded.arcadeRun = nil; loaded.pendingArcadeRound = nil
        loaded.activeArcadeVariant = .endurance
        XCTAssertNotNil(loaded.arcadeRun); XCTAssertNotNil(loaded.pendingArcadeRound)
    }
}
