import XCTest
import Foundation
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeStateTests: XCTestCase {
    func testHybridRunCountersSurviveCanonicalSchemaRange() throws {
        let run:[String:Any] = ["schemaVersion":2,"boardNumber":2,"level":2,"starsCount":7,"bestScore":9182,"wildMeter":4.5,"wildSpawnCount":12,"grid":[[["value":3,"locked":false,"open":true]]]]
        let text = String(data:try JSONSerialization.data(withJSONObject:run),encoding:.utf8)!
        let export = try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.native","storage":["cc_saved_game_board_02":text]])
        let imported = try NativeHybridImporter.importExport(export)
        XCTAssertEqual(imported.journeyRuns[2]?.starsCount,7)
        XCTAssertEqual(imported.journeyRuns[2]?.bestScore,9182)
        XCTAssertEqual(imported.journeyRuns[2]?.wildMeter,4.5)
        XCTAssertEqual(imported.journeyRuns[2]?.wildSpawnCount,12)
    }
    private func temporary() throws -> URL {
        let path=FileManager.default.temporaryDirectory.appendingPathComponent("NativeStateTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at:path,withIntermediateDirectories:true)
        addTeardownBlock {try? FileManager.default.removeItem(at:path)}
        return path
    }
    func testPreviousNativeV1SchemaDefaultsOnlyAdditiveFieldsAndPreservesRun() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        var original=NativeSaveEnvelope();original.savedAt=1000
        original.settings.gameSoundsEnabled=true;original.settings.musicEnabled=false
        original.progression.completedJourneyBoards=[1];original.progression.viewedJourneyBoards=[1]
        original.journeyRuns[2]=NativeBoardFactory.make(mode:.journey,board:2)
        var payload=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(original)) as? [String:Any])
        for key in ["journeyRunSavedAt","arcadeRunSavedAt","pendingArcadeRound"] {payload.removeValue(forKey:key)}
        var oldProgression=try XCTUnwrap(payload["progression"] as? [String:Any]);oldProgression.removeValue(forKey:"unlockedSpecialDice");payload["progression"]=oldProgression
        try JSONSerialization.data(withJSONObject:payload).write(to:dir.appendingPathComponent("state-v1.json"))
        let loaded=try XCTUnwrap(store.load())
        XCTAssertEqual(loaded.settings,original.settings);XCTAssertEqual(loaded.progression,original.progression)
        XCTAssertEqual(loaded.journeyRuns,original.journeyRuns);XCTAssertTrue(loaded.journeyRunSavedAt.isEmpty)
        XCTAssertNil(loaded.pendingArcadeRound);XCTAssertNil(loaded.arcadeRunSavedAt)
        XCTAssertNotNil(loaded.resumedRun(mode:.journey,board:2,now:1100))
        for required in ["product","version","settings","progression","importedHybrid","journeyRuns","savedAt"] {
            var missing=payload;missing.removeValue(forKey:required)
            XCTAssertThrowsError(try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONSerialization.data(withJSONObject:missing)))
        }
        payload["journeyRunSavedAt"]="malformed-present-field"
        XCTAssertThrowsError(try JSONDecoder().decode(NativeSaveEnvelope.self,from:JSONSerialization.data(withJSONObject:payload)))
    }
    func testSameNativeSpecialUnlockFlagsImportAndRoundTripWithoutInventedBoardUnlocks() throws {
        let export=try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.native","storage":["cc_special_dice_unlocked_flower":"true","cc_special_dice_unlocked_juice":"false"]])
        let state=try NativeHybridImporter.importExport(export)
        XCTAssertEqual(state.progression.unlockedSpecialDice,["flower"]);XCTAssertTrue(state.progression.completedJourneyBoards.isEmpty)
        let store=NativeSaveStore(directory:try temporary());try store.save(state)
        XCTAssertEqual(try store.load()?.progression.unlockedSpecialDice,["flower"])
        var invalid=state;invalid.progression.unlockedSpecialDice.insert("imagined-archetype");XCTAssertThrowsError(try store.save(invalid))
    }
    func testFactoryPreservesRealPhoneGridAndPlaceholderPopulation() {
        let board=NativeBoardFactory.make(mode:.journey,board:1,seed:9)
        XCTAssertEqual(board.columns,5);XCTAssertEqual(board.rows,9);XCTAssertEqual(board.tiles.count,45)
        XCTAssertEqual(board.tiles.filter { !$0.locked }.count,14)
        XCTAssertTrue(board.tiles.filter(\.locked).allSatisfy {$0.value==0})
        XCTAssertEqual(board,NativeBoardFactory.make(mode:.journey,board:1,seed:9))
        XCTAssertEqual(NativeBoardFactory.make(mode:.journey,board:21,columns:7).tiles.filter { !$0.locked }.count,19)
    }
    func testSaveDedupIgnoresTimestampButRepairsExternallyRemovedCopy() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        var envelope=NativeSaveEnvelope();envelope.savedAt=1000
        XCTAssertTrue(try store.save(envelope))
        envelope.savedAt=2000;XCTAssertFalse(try store.save(envelope))
        XCTAssertEqual(try store.load()?.savedAt,1000)
        try FileManager.default.removeItem(at:dir.appendingPathComponent("state-v1.json"))
        XCTAssertTrue(try store.save(envelope));XCTAssertEqual(try store.load()?.savedAt,2000)
    }
    func testWorldStarThresholdsRestartInEveryWorld() {
        for board in [1,11,21] {
            XCTAssertEqual(NativeJourneyContent.smallValueBias(board:board),0.75)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:2499,board:board),1)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:2500,board:board),2)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:6500,board:board),3)
        }
        XCTAssertEqual(NativeJourneyContent.earnedStars(score:9499,board:30),2)
        XCTAssertEqual(NativeJourneyContent.cardAsset(board:21,score:6500),"./assets/colelctibles/Area55/legendary/04-gold.png")
        XCTAssertEqual(NativeJourneyContent.cardAsset(board:2,score:0),"./assets/colelctibles/Forest/common/03.png")
    }
    func testIntroRewardsAndCumulativePools() {
        for (board,variant) in [(2,"bee"),(3,"flower"),(4,"honey"),(6,"mushroom"),(7,"barell"),(21,"kanta"),(22,"robo-cube"),(23,"spaceship"),(24,"laser-gun")] {
            XCTAssertEqual(NativeJourneyContent.reward(board:board,wildSpawnCount:0,roll:0.99)?.variant,variant)
        }
        XCTAssertEqual(NativeJourneyContent.reward(board:12,wildSpawnCount:0,roll:0)?.archetype,.juice)
        XCTAssertEqual(NativeJourneyContent.reward(board:11,wildSpawnCount:1,roll:0.9,previous:.juice)?.variant,"fish")
        XCTAssertFalse(NativeJourneyContent.rewardPool(board:4).contains("mushroom"))
        XCTAssertEqual(NativeJourneyContent.reward(board:25,wildSpawnCount:8,roll:0.99)?.variant,"laser-gun")
    }
    func testIndependentJourneyInterimsAndArcadeIsolation() {
        var state=NativeProgressionState()
        XCTAssertEqual((1...3).compactMap {state.interimBoard(world:$0)},[1,11,21])
        state.finishAttempt(mode:.arcade,board:4,score:9000,longestCombo:6,cubesCracked:12,clean:true)
        XCTAssertTrue(state.completedJourneyBoards.isEmpty);XCTAssertEqual(state.arcadeStats.highestStageOpened,5)
        state.finishAttempt(mode:.journey,board:11,score:3000,longestCombo:4,cubesCracked:8,clean:true)
        XCTAssertEqual(state.interimBoard(world:1),1);XCTAssertEqual(state.interimBoard(world:2),12)
        XCTAssertEqual(state.arcadeStats.highScore,9000);XCTAssertEqual(state.boardStats[11]?.highScore,3000)
    }
    func testAtomicSaveCoherentRecoveryAndResumeStreakBoundary() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        var envelope=NativeSaveEnvelope()
        var board=NativeBoardFactory.make(mode:.journey,board:3)
        board.combo=7;board.earnedComboBonus=725;board.wildSpawnCount=5
        envelope.journeyRuns[3]=board;envelope.savedAt=1000
        try store.save(envelope)
        envelope.settings.musicEnabled=false;try store.save(envelope)
        let resumed=try XCTUnwrap(store.load()?.resumedRun(mode:.journey,board:3,now:1100))
        XCTAssertEqual(resumed.combo,0);XCTAssertEqual(resumed.earnedComboBonus,725);XCTAssertEqual(resumed.wildSpawnCount,5)
        XCTAssertGreaterThan(resumed.generation,board.generation)
        try Data("broken".utf8).write(to:dir.appendingPathComponent("state-v1.json"))
        XCTAssertEqual(try store.load()?.settings.musicEnabled,true)
    }
    func testInvalidPartialBoardAndWrongModeCannotOverwriteValidSave() throws {
        let store=NativeSaveStore(directory:try temporary())
        var envelope=NativeSaveEnvelope();try store.save(envelope)
        var board=NativeBoardFactory.make(mode:.arcade,board:1)
        board.tiles[0].transientSpawn=true;envelope.journeyRuns[1]=board
        XCTAssertThrowsError(try store.save(envelope))
        XCTAssertTrue(try XCTUnwrap(store.load()).journeyRuns.isEmpty)
    }
    func testRuntimeRecordAdmissionRejectsReservedOrdinaryHeroAndPartialRemovalUsingDurableValidator() throws {
        let store=NativeSaveStore(directory:try temporary())
        let stable=NativeBoardFactory.make(mode:.journey,board:2)
        XCTAssertTrue(NativeSaveEnvelope.isCoherentRun(stable))
        var envelope=NativeSaveEnvelope();envelope.journeyRuns[2]=stable;try store.save(envelope)
        var removal=stable;removal.tiles[0].pendingRemoval=true
        var protected=stable;protected.tiles[0].value=6;protected.tiles[0].merge6CleanupOwned=true
        for reserved in [removal,protected] {
            XCTAssertFalse(NativeSaveEnvelope.isCoherentRun(reserved))
            envelope.journeyRuns[2]=reserved;XCTAssertThrowsError(try store.save(envelope))
            XCTAssertEqual(try store.load()?.journeyRuns[2],stable,"A transient presentation cannot overwrite the prior coherent document")
        }
        removal.tiles[0].pendingRemoval=false
        XCTAssertTrue(NativeSaveEnvelope.isCoherentRun(removal))
    }
    func testFutureVersionNeverFallsBackToOlderSave() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        var envelope=NativeSaveEnvelope();try store.save(envelope)
        envelope.settings.musicEnabled=false;try store.save(envelope)
        envelope.version=99
        try JSONEncoder().encode(envelope).write(to:dir.appendingPathComponent("state-v1.json"))
        XCTAssertThrowsError(try store.load()) {XCTAssertEqual($0 as? NativeSaveError,.unsupportedVersion(99))}
    }
    func testFailedAtomicWriteDoesNotPoisonRetryDedup() throws {
        let dir=try temporary(),blocked=dir.appendingPathComponent("blocked")
        try Data("file".utf8).write(to:blocked)
        let store=NativeSaveStore(directory:blocked),envelope=NativeSaveEnvelope()
        XCTAssertThrowsError(try store.save(envelope))
        try FileManager.default.removeItem(at:blocked)
        XCTAssertTrue(try store.save(envelope));XCTAssertEqual(try store.load()?.settings,envelope.settings)
    }
    func testLegacyTilesOnlyAndAcceptedPendingRoundImportWithoutMixingModes() throws {
        let raw:[String:Any]=["boardNumber":1,"tiles":[["value":2,"gridX":0,"gridY":0,"locked":false],["value":3,"gridX":1,"gridY":0,"locked":false]],"timestamp":1000000]
        let json=String(data:try JSONSerialization.data(withJSONObject:raw),encoding:.utf8)!
        let storage=["cc_arcade_run_state_v1":json,"cc_arcade_pending_round_v1":"{\"round\":2,\"score\":4200,\"ownerId\":\"accepted\"}"]
        let payload=try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.native","storage":storage])
        let envelope=try NativeHybridImporter.importExport(payload,now:1000)
        XCTAssertEqual(envelope.arcadeRun?.columns,5);XCTAssertEqual(envelope.arcadeRun?.tiles.count,2)
        XCTAssertEqual(envelope.pendingArcadeRound,NativePendingArcadeRound(round:2,score:4200,ownerID:"accepted"))
        XCTAssertTrue(envelope.journeyRuns.isEmpty);XCTAssertTrue(envelope.progression.completedJourneyBoards.isEmpty)
    }
    func testExistingHybridSandboxRequiresImportAndWrongProductCannotImport() throws {
        let dir=try temporary();try FileManager.default.createDirectory(at:dir.appendingPathComponent("WebKit"),withIntermediateDirectories:true)
        XCTAssertThrowsError(try NativeSaveStore(directory:dir.appendingPathComponent("New"),legacyLibrary:dir).load()) {XCTAssertEqual($0 as? NativeSaveError,.requiresLegacyImport)}
        let payload=try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.Stack-to-Six","storage":[:]])
        XCTAssertThrowsError(try NativeHybridImporter.importExport(payload)) {XCTAssertEqual($0 as? NativeSaveError,.wrongProduct)}
    }
    func testHybridImportPreservesVariantCountRewardAndCompletedTombstone() throws {
        let grid:[[Any]]=[[ ["value":6,"special":"wild","specialDiceVariant":"bee","locked":false,"open":true,"gridX":0,"gridY":0], ["value":2,"locked":false,"gridX":1,"gridY":0] ]]
        let save:[String:Any]=["schemaVersion":2,"boardNumber":2,"level":2,"grid":grid,"moves":42,"score":510,"wildMeter":0.7,"wildSpawnCount":3,"runComboBonus":["version":1,"earnedBonus":225],"timestamp":1000000]
        let json=String(data:try JSONSerialization.data(withJSONObject:save),encoding:.utf8)!
        let storage=["cc_saved_game_board_02":json,"cc_saved_game_board_01":json,"cc_journey_completed_board_01":"1","journey_boards_state":"[{\"id\":1,\"unlocked\":true}]","cc_settings":"{\"musicEnabled\":false}"]
        let payload=try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.native","storage":storage])
        let envelope=try NativeHybridImporter.importExport(payload,now:1000)
        XCTAssertNil(envelope.journeyRuns[1]);XCTAssertEqual(envelope.journeyRuns[2]?.wildSpawnCount,3)
        XCTAssertEqual(envelope.journeyRuns[2]?.tiles.first?.variant,"bee");XCTAssertEqual(envelope.journeyRuns[2]?.earnedComboBonus,225)
        XCTAssertFalse(envelope.settings.musicEnabled);XCTAssertTrue(envelope.progression.completedJourneyBoards.contains(1))
        XCTAssertNil(envelope.resumedRun(mode:.journey,board:2,now:1000+8*24*60*60))
    }
    func testAuthoredWorldGeometryAtEveryExportedViewport() throws {
        let provider=try NativeWorldLayouts()
        var state=NativeProgressionState();state.completedJourneyBoards=Set(1...30)
        for width in [320.0,375,390,393,414,428,768,834,1024] {
            for world in 1...3 {
                let snapshot=try provider.snapshot(world:world,width:width,height:844,generation:1,progression:state)
                // Exercise the actual strict consumer casts directly, before any JSON
                // round trip can accidentally convert integer-valued Doubles back.
                XCTAssertEqual(snapshot["version"] as? Int,1,"direct native snapshot protocol version")
                XCTAssertEqual(snapshot["worldID"] as? Int,world)
                XCTAssertEqual(snapshot["routeGeneration"] as? Int,1)
                XCTAssertEqual(snapshot["stateRevision"] as? Int,0)
                let units=try XCTUnwrap(snapshot["units"] as? [[String:Any]])
                let reference=try XCTUnwrap(provider.referenceSnapshot(world:world,width:Int(width)))
                let referenceUnits=reference["units"] as! [[String:Any]]
                for index in units.indices {
                    let actualFrame=units[index]["frame"] as! [String:Any],expectedFrame=referenceUnits[index]["frame"] as! [String:Any]
                    for key in ["x","y","width","height"] {XCTAssertEqual((actualFrame[key] as! NSNumber).doubleValue,(expectedFrame[key] as! NSNumber).doubleValue,accuracy:0.000001,"width=\(width) world=\(world) board=\(index) key=\(key)")}
                    let actualParts=units[index]["parts"] as! [[String:Any]],expectedParts=referenceUnits[index]["parts"] as! [[String:Any]]
                    XCTAssertEqual(actualParts.count,expectedParts.count)
                    for part in actualParts.indices {
                        for key in ["x","y","width","rotation","zIndex"] {XCTAssertEqual((actualParts[part][key] as! NSNumber).doubleValue,(expectedParts[part][key] as! NSNumber).doubleValue,accuracy:0.000001)}
                    }
                }
                XCTAssertEqual(units.count,10);XCTAssertEqual(units.first?["boardID"] as? Int,(world-1)*10+1)
                XCTAssertTrue(units.allSatisfy {($0["parts"] as? [[String:Any]])?.contains {$0["role"] as? String=="island"}==true})
            }
        }
    }
    func testWorldProjectionPreservesDiscreteIdentitiesAtUnexportedViewportAndPlayerGating() throws {
        let provider=try NativeWorldLayouts()
        var player=NativeProgressionState();player.completedJourneyBoards=Set(1...12)
        for world in 1...3 {
            let snapshot=try provider.snapshot(world:world,width:401.5,height:877,generation:73,revision:19,progression:player,returnBoard:13)
            XCTAssertEqual(snapshot["version"] as? Int,1)
            XCTAssertEqual(snapshot["worldID"] as? Int,world)
            XCTAssertEqual(snapshot["routeGeneration"] as? Int,73)
            XCTAssertEqual(snapshot["stateRevision"] as? Int,19)
            XCTAssertEqual(snapshot["returnBoardID"] as? Int,13)
            let units=try XCTUnwrap(snapshot["units"] as? [[String:Any]])
            XCTAssertEqual(units.compactMap {$0["boardID"] as? Int},Array((world-1)*10+1...world*10))
            XCTAssertEqual(Set(units.compactMap {$0["id"] as? String}).count,10)
            for unit in units {
                let board=try XCTUnwrap(unit["boardID"] as? Int)
                XCTAssertEqual(unit["completed"] as? Bool,board<=12)
                XCTAssertEqual(unit["locked"] as? Bool,board>13 && board != 21)
                XCTAssertEqual(unit["interim"] as? Bool,board==13 || (world==3 && board==21))
                XCTAssertNotNil(unit["stars"] as? Int)
                XCTAssertNotNil(unit["frame"] as? [String:Any])
            }
        }
    }
    func testNativeAmbientPortMatchesCanonicalTSRetainedMotionOracle() throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"NativeAmbientOracle",withExtension:"json"))
        let root=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any])
        let expectedWorlds=try XCTUnwrap(root["worlds"] as? [String:[[[String:Any]]]])
        let emitters=(root["emitters"] as! [[String:Any]]).map {NativeWorldPlanning.Emitter(board:$0["boardId"] as! Int,x:$0["x"] as! Double,y:$0["y"] as! Double)}
        for world in [2,3] {
            var seed:UInt32=7
            let random:()->Double={seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296}
            let planner=NativeWorldPlanning(world:world,emitters:emitters,sceneHeight:1440,random:random)
            for cycle in 0..<2 {
                let actual=planner.next(top:0,bottom:844),expected=expectedWorlds[String(world)]![cycle]
                XCTAssertEqual(actual.count,expected.count)
                for index in actual.indices {
                    let frames=actual[index]["frames"] as! [[String:Any]],oracle=expected[index]["frames"] as! [[String:Any]]
                    XCTAssertNotNil(actual[index]["id"] as? Int)
                    XCTAssertEqual(actual[index]["worldID"] as? Int,world)
                    XCTAssertEqual(actual[index]["duration"] as? Double,11)
                    // Validate the direct native producer/consumer transport, not
                    // JSON NSNumber coercion. Delay frames must stay Double too.
                    for row in frames {for key in ["time","x","y","width","height","rotation","opacity"] {
                        XCTAssertNotNil(row[key] as? Double,"direct compositor transport world=\(world) key=\(key)")
                    }}
                    for (sample,frameIndex) in [0,1,30,150,330].enumerated() {
                        for key in ["x","y","width","height","rotation","opacity"] {
                            XCTAssertEqual((frames[frameIndex][key] as! NSNumber).doubleValue,(oracle[sample][key] as! NSNumber).doubleValue,accuracy:0.000001,"world=\(world) cycle=\(cycle) index=\(index) frame=\(frameIndex) key=\(key)")
                        }
                        XCTAssertEqual(frames[frameIndex]["asset"] as? String,oracle[sample]["asset"] as? String)
                        XCTAssertEqual(frames[frameIndex]["depth"] as? String,oracle[sample]["depth"] as? String)
                    }
                }
            }
        }
    }
    func testForestBeeRetainedPortMatchesCanonicalTSIncludingGateTransitions() throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"NativeBeeOracle",withExtension:"json"))
        let root=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any])
        let cycles=root["cycles"] as! [[[String:Any]]]
        var seed:UInt32=7
        let planner=NativeForestBeePlanning(contentTop:138,mainX:0,mainY:154,mainWidth:390,mainHeight:350,random:{seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296})
        for cycle in cycles.indices {
            let actual=planner.next(),expected=cycles[cycle]
            XCTAssertEqual(actual.map {$0["id"] as! Int},[0,2,5,7,9])
            for index in actual.indices {
                let frames=actual[index]["frames"] as! [[String:Any]],oracle=expected[index]["frames"] as! [[String:Any]]
                for (sample,frameIndex) in [0,1,30,90,150,240,330].enumerated() {
                    for key in ["x","y","width","scaleX","scaleY","rotation","blend"] {
                        XCTAssertEqual((frames[frameIndex][key] as! NSNumber).doubleValue,(oracle[sample][key] as! NSNumber).doubleValue,accuracy:0.0001,"bee cycle=\(cycle) index=\(index) frame=\(frameIndex) key=\(key)")
                    }
                    for key in ["asset","previousAsset","depth"] {XCTAssertEqual(frames[frameIndex][key] as? String,oracle[sample][key] as? String)}
                }
            }
        }
    }
    func testNewProfileUsesInterimCardsWithoutUnlockingOtherWorlds() throws {
        let provider=try NativeWorldLayouts(),state=NativeProgressionState()
        let snapshot=try provider.snapshot(world:3,width:393,height:852,generation:8,progression:state)
        let units=try XCTUnwrap(snapshot["units"] as? [[String:Any]])
        XCTAssertEqual(units[0]["locked"] as? Bool,false);XCTAssertEqual(units[0]["cardArt"] as? String,"./assets/colelctibles/interim.png")
        XCTAssertEqual(units[1]["locked"] as? Bool,true)
        XCTAssertFalse((units[1]["parts"] as? [[String:Any]] ?? []).contains {$0["role"] as? String=="card"})
    }
}
