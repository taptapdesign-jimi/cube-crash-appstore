import XCTest
@testable import StackToSixNativeState

final class NativeBackpackAlertStateTests:XCTestCase {
    func testDeveloperHideRearmsOnlySelectedIntroductionDurably() throws {
        var state=NativeProgressionState()
        XCTAssertTrue(state.announceJourneyDie("bee",board:1))
        XCTAssertTrue(state.announceJourneyDie("honey",board:4))
        XCTAssertTrue(state.announceJourneyDie("fish",board:12))
        state.readJourneyDie("bee")
        state.resetDeveloperJourneyDieAnnouncement(board:1)
        state.resetDeveloperJourneyDieAnnouncement(board:5) // No new die on this Unit.
        state=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(state))
        XCTAssertEqual(state.announcedJourneyDice,["honey","fish"])
        XCTAssertEqual(state.unreadJourneyDice,["honey","fish"])
        XCTAssertTrue(state.announceJourneyDie("bee",board:1))
        XCTAssertFalse(state.announceJourneyDie("bee",board:1))
        state.resetDeveloperJourneyDieAnnouncement(board:4)
        XCTAssertEqual(state.unreadJourneyDice,["bee","fish"])
        XCTAssertEqual(state.announcedJourneyDice,["bee","fish"])
    }
    func testEveryIntroductionIsUnreadOnlyOnceAndDetailReadsOnlyIt() throws {
        var state=NativeProgressionState()
        let introductions=(1...30).compactMap{board -> (Int,String)? in NativeJourneyContent.introductionID(board:board).map{(board,$0)}}
        XCTAssertEqual(introductions.count,18)
        for (board,id) in introductions {
            XCTAssertTrue(state.unreadJourneyDice.isEmpty)
            XCTAssertFalse(state.announceJourneyDie("invalid",board:board))
            XCTAssertTrue(state.announceJourneyDie(id,board:board))
            XCTAssertFalse(state.announceJourneyDie(id,board:board))
            XCTAssertEqual(state.unreadJourneyDice,[id])
            let data=try JSONEncoder().encode(state)
            state=try JSONDecoder().decode(NativeProgressionState.self,from:data)
            XCTAssertEqual(state.unreadJourneyDice,[id])
            state.readJourneyDie("other");XCTAssertEqual(state.unreadJourneyDice,[id])
            state.readJourneyDie(id);XCTAssertTrue(state.unreadJourneyDice.isEmpty)
            XCTAssertFalse(state.announceJourneyDie(id,board:board))
        }
        XCTAssertEqual(state.announcedJourneyDice.count,18)
    }
    func testOldProfileProgressionNeverInventsLandedDiscovery() throws {
        var state=NativeProgressionState();state.lastOpenedJourneyBoard=4;state.completedJourneyBoards=[1,2,3]
        var json=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(state)) as? [String:Any])
        json.removeValue(forKey:"announcedJourneyDice");json.removeValue(forKey:"unreadJourneyDice")
        var migrated=try JSONDecoder().decode(NativeProgressionState.self,from:JSONSerialization.data(withJSONObject:json))
        XCTAssertTrue(migrated.unreadJourneyDice.isEmpty)
        XCTAssertTrue(migrated.announcedJourneyDice.isEmpty)
        XCTAssertTrue(migrated.announceJourneyDie("honey",board:4))
        migrated.readJourneyDie("honey")
        XCTAssertTrue(migrated.announceJourneyDie("mushroom",board:6))
        XCTAssertTrue(migrated.announceJourneyDie("fish",board:12))
        migrated.readJourneyDie("mushroom");XCTAssertEqual(migrated.unreadJourneyDice,["fish"])
    }
    func testFirstLandedEligibleDieCanBeDiscoveredOnLaterUnit() throws {
        var state=NativeProgressionState()
        XCTAssertFalse(state.announceJourneyDie("fish",board:10))
        XCTAssertFalse(state.announceJourneyDie("bee",board:11))
        XCTAssertTrue(state.announceJourneyDie("bee",board:5))
        XCTAssertTrue(state.announceJourneyDie("fish",board:20))
        XCTAssertTrue(state.announceJourneyDie("robo-cube",board:30))
        state.readJourneyDie("bee")
        state=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(state))
        XCTAssertEqual(state.announcedJourneyDice,["bee","fish","robo-cube"])
        XCTAssertFalse(state.announceJourneyDie("bee",board:10))
    }
    func testUnreadMetadataDoesNotMutateRunAndSurvivesAtomicStore() throws {
        let dir=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer {try? FileManager.default.removeItem(at:dir)}
        let store=NativeSaveStore(directory:dir)
        var envelope=NativeSaveEnvelope();let runs=envelope.journeyRuns
        XCTAssertTrue(envelope.progression.announceJourneyDie("bee",board:1))
        try store.save(envelope)
        let loaded=try XCTUnwrap(store.load())
        XCTAssertEqual(loaded.progression.unreadJourneyDice,["bee"]);XCTAssertEqual(loaded.journeyRuns,runs)
    }
}
