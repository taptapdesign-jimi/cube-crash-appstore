import XCTest
import Foundation
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeStateTests: XCTestCase {
    func testStarVariantDropCountSurvivesAtomicSaveAndResumeWithoutReroll() throws {
        for variant in ["fish","kanta","cubero"] {for count in 1...3 {
            let store=NativeSaveStore(directory:try temporary())
            var envelope=NativeSaveEnvelope();envelope.savedAt=1000
            envelope.journeyRuns[11] = .init(tiles:[.init(id:"special",cell:.init(column:0,row:0),value:6,starOrbitCount:count,archetype:.star,variant:variant)],board:11,moves:49,rngState:873)
            envelope.journeyRunSavedAt[11]=1000
            XCTAssertTrue(try store.save(envelope))
            let loaded=try XCTUnwrap(store.load())
            let resumed=try XCTUnwrap(loaded.resumedRun(mode:.journey,board:11,now:1001))
            XCTAssertEqual(resumed.tiles.first?.starOrbitCount,count)
            XCTAssertEqual(resumed.tiles.first?.effectiveStarDropCount,count)
            XCTAssertEqual(resumed.rngState,873)
        }}
    }

    func testWholeJourneySaveWorkloadPreservesLatestContentAndBackup() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        var envelope=NativeSaveEnvelope()
        for number in 1...30 {envelope.journeyRuns[number]=NativeBoardFactory.make(mode:.journey,board:number)}
        try store.save(envelope)
        let duplicateStart=Date.timeIntervalSinceReferenceDate
        for index in 0..<50 {
            envelope.savedAt=Double(index+1000)
            XCTAssertFalse(try store.save(envelope))
        }
        let duplicateMS=(Date.timeIntervalSinceReferenceDate-duplicateStart)*1000/50
        let changedStart=Date.timeIntervalSinceReferenceDate
        for index in 0..<10 {
            envelope.journeyRuns[1]?.score=index+1
            XCTAssertTrue(try store.save(envelope))
        }
        let changedMS=(Date.timeIntervalSinceReferenceDate-changedStart)*1000/10
        XCTAssertEqual(try store.load()?.journeyRuns[1]?.score,10)
        try Data("corrupt".utf8).write(to:dir.appendingPathComponent("state-v1.json"))
        XCTAssertEqual(try store.load()?.journeyRuns[1]?.score,9)
        print("[NativeSaveWorkload] fullJourney duplicateMeanMS=\(duplicateMS) changedMeanMS=\(changedMS)")
    }
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
        original.journeyRuns[2]?.moves=49
        var payload=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(original)) as? [String:Any])
        for key in ["journeyRunSavedAt","arcadeRunSavedAt","pendingArcadeRound"] {payload.removeValue(forKey:key)}
        var oldProgression=try XCTUnwrap(payload["progression"] as? [String:Any]);oldProgression.removeValue(forKey:"unlockedSpecialDice");payload["progression"]=oldProgression
        try JSONSerialization.data(withJSONObject:payload).write(to:dir.appendingPathComponent("state-v1.json"))
        let loaded=try XCTUnwrap(store.load())
        var expectedProgression=original.progression
        var legacyAward=NativeBoardStats();legacyAward.awardedStars=1;legacyAward.starRankingVersion=0
        expectedProgression.boardStats[1]=legacyAward
        XCTAssertEqual(loaded.settings,original.settings);XCTAssertEqual(loaded.progression,expectedProgression)
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
        XCTAssertTrue(board.tiles.filter(\.locked).allSatisfy {$0.value==0 && $0.alpha==0.25})
        XCTAssertTrue(board.tiles.filter{!$0.locked}.allSatisfy{$0.alpha==1})
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
    func testSaveCacheValidatesForeignPrimaryAndPreservesItsCoherentBackup() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        let original=NativeSaveEnvelope()
        try store.save(original)
        var foreign=original;foreign.settings.musicEnabled=false
        try JSONEncoder().encode(foreign).write(to:dir.appendingPathComponent("state-v1.json"))
        XCTAssertTrue(try store.save(original),"A foreign primary cannot borrow our successful-content dedup receipt")
        try Data("corrupt".utf8).write(to:dir.appendingPathComponent("state-v1.json"))
        XCTAssertEqual(try store.load()?.settings,foreign.settings,"Backup must contain the actual validated foreign primary")
        XCTAssertTrue(try store.save(original),"Corrupt primary must be repaired without backing up corrupt bytes")
        try Data("corrupt again".utf8).write(to:dir.appendingPathComponent("state-v1.json"))
        XCTAssertEqual(try store.load()?.settings,foreign.settings)
    }
    func testOrderedExistingPrimaryKeepsActualBackupBytesAndUnorderedSaveDedup() throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        var previous=NativeSaveEnvelope();previous.savedAt=1000
        previous.journeyRuns[3]=NativeBoardFactory.make(mode:.journey,board:3)
        previous.arcadeRun=NativeBoardFactory.make(mode:.arcade,board:2)
        let sorted=JSONEncoder();sorted.outputFormatting=[.sortedKeys,.prettyPrinted]
        let previousBytes=try sorted.encode(previous)
        let primary=dir.appendingPathComponent("state-v1.json"),backup=dir.appendingPathComponent("state-v1.previous.json")
        try previousBytes.write(to:primary)
        XCTAssertEqual(try store.load(),previous,"Existing ordered documents retain their exact schema and state")
        var changed=previous;changed.journeyRuns[3]?.score=420;changed.savedAt=2000
        XCTAssertTrue(try store.save(changed))
        XCTAssertEqual(try store.load(),changed)
        XCTAssertEqual(try Data(contentsOf:backup),previousBytes,"Recovery preserves actual prior bytes, without re-encoding their key order")
        let changedBytes=try Data(contentsOf:primary)
        changed.savedAt=3000;changed.journeyRunSavedAt[3]=3000;changed.arcadeRunSavedAt=3000
        XCTAssertFalse(try store.save(changed),"Timestamp-only changes retain semantic-content dedup with unsorted output")
        XCTAssertEqual(try Data(contentsOf:primary),changedBytes)
        XCTAssertEqual(try Data(contentsOf:backup),previousBytes)
        try Data("corrupt".utf8).write(to:primary)
        XCTAssertEqual(try store.load(),previous,"Ordered legacy bytes remain a coherent whole-document recovery fallback")
    }
    func testWorldStarThresholdsRestartInEveryWorld() {
        for board in [1,11,21] {
            XCTAssertEqual(NativeJourneyContent.smallValueBias(board:board),0.75)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:14499,board:board),1)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:14500,board:board),2)
            XCTAssertEqual(NativeJourneyContent.earnedStars(score:35000,board:board),3)
        }
        XCTAssertEqual(NativeJourneyContent.earnedStars(score:51999,board:30),2)
        XCTAssertEqual(NativeJourneyContent.cardAsset(board:21,score:35000),"./assets/colelctibles/Area55/legendary/01-gold.png")
        XCTAssertEqual(NativeJourneyContent.cardAsset(board:2,score:0),"./assets/colelctibles/Forest/common/01.png")
    }
    func testBeachUnlocksOneAdditionalDiePerUnitUntilFour() {
        let order=["wild-juice","fish","beach-ball","bottle"]
        for unit in 1...10 {
            XCTAssertEqual(Set(NativeJourneyContent.rewardPool(board:10+unit)),Set(order.prefix(min(unit,4))))
        }
    }
    func testEveryJourneyPoolContainsOnlyItsWorldDiceAndNeverArcadeOnlyDice() {
        let worlds:[Set<String>]=[
            ["bee","wild-star","flower","honey","mushroom","barell"],
            ["wild-juice","fish","beach-ball","bottle"],
            ["robo-cube","kanta","spaceship","laser-gun","bloob-ball"]]
        for board in 1...30 {
            let pool=Set(NativeJourneyContent.rewardPool(board:board))
            XCTAssertFalse(pool.isEmpty)
            XCTAssertTrue(pool.isSubset(of:worlds[(board-1)/10]),"World isolation at board \(board)")
            XCTAssertTrue(pool.isDisjoint(with:["tnt","wild-tnt","wild-magnet","cubero"]))
            for index in 0..<1000 {
                let reward=NativeWildRewardPolicy.choose(state:.init(tiles:[],mode:.journey,board:board,wildSpawnCount:index%9),roll:(Double(index)+0.5)/1000,plainStarUnlocked:true,nextRoll:{XCTFail("Journey cannot reroll or force a sequence");return 0})
                let id=reward?.variant ?? (reward?.archetype == .star ? "wild-star":reward?.archetype == .juice ? "wild-juice":"ARCADE")
                XCTAssertTrue(pool.contains(id),"board \(board), \(id)")
            }
        }
    }
    func testLegacyForestTntResumeRepairsOnlyVariantWithoutRerollingOrChangingGameplay() throws {
        for board in 7...10 {
            var envelope=NativeSaveEnvelope()
            let tile=NativeTile(id:"legacy-tnt",cell:.init(column:0,row:0),value:6,archetype:.tnt)
            let run=NativeBoardState(tiles:[tile],mode:.journey,board:board,moves:20,score:1080,wildMeter:0.12,rngState:765)
            envelope.journeyRuns[board]=run;envelope.journeyRunSavedAt[board]=100
            let resumed=try XCTUnwrap(envelope.resumedRun(mode:.journey,board:board,now:101))
            var expected=tile;expected.variant="barell"
            XCTAssertEqual(resumed.tiles,[expected]);XCTAssertEqual(resumed.rngState,run.rngState)
            XCTAssertEqual(resumed.score,run.score);XCTAssertEqual(resumed.moves,run.moves);XCTAssertEqual(resumed.wildMeter,run.wildMeter)
        }
    }
    func testJourneyLaterDropsRetainEqualNonMushroomWeightsWithoutHistoryOverride() throws {
        for board in 1...30 {
            let pool = NativeJourneyContent.rewardPool(board:board)
            for (index,name) in pool.enumerated() {
                let roll:Double
                if pool.contains("mushroom") {
                    let others=pool.filter{$0 != "mushroom"}
                    roll=name == "mushroom" ? 0.025:0.05+0.95*(Double(try XCTUnwrap(others.firstIndex(of:name)))+0.5)/Double(others.count)
                } else {roll=(Double(index)+0.5)/Double(pool.count)}
                for count in [0,1,2,8] where count > 0 || NativeJourneyContent.unlockReward(board:board) == nil {for previous in NativeWildArchetype.allCases {
                    var state = NativeBoardState(tiles:[],mode:.journey,board:board,wildSpawnCount:count,lastWildDropType:previous,wildDropTypeStreak:8)
                    if board==6 {state.forestMushroomIntroduced=true}
                    let restored = try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
                    let choice = NativeWildRewardPolicy.choose(state:restored,roll:roll,plainStarUnlocked:false,nextRoll:{XCTFail("Unexpected override draw");return 0})
                    let expected:NativeWildArchetype? = name == "wild-star" ? .star : name == "wild-juice" ? .juice : name == "tnt" ? .tnt : NativeSpecialDiceRegistry.variants[name]?.archetype
                    XCTAssertEqual(choice?.archetype,expected,"board \(board)")
                    XCTAssertEqual(choice?.variant,NativeSpecialDiceRegistry.variants[name] == nil ? nil:name,"board \(board)")
                }}
            }
        }
        XCTAssertEqual(NativeJourneyContent.rewardPool(board:1),["bee"])
        XCTAssertEqual(NativeJourneyContent.rewardPool(board:11),["wild-juice"])
        XCTAssertEqual(NativeJourneyContent.rewardPool(board:21),["robo-cube"])
        XCTAssertFalse(NativeJourneyContent.rewardPool(board:4).contains("mushroom"))
    }
    func testEveryJourneyCardTitleFollowsItsAuthoredArtworkAcrossRarityAndDensity() {
        let worlds=["Forest","beach","Area55"]
        let expected:[[(Int,String)]] = [
            [(3,"Weee - Beee"),(1,"Star Is Out"),(9,"Final Gate"),(4,"Honey Splat"),(5,"Dreamy"),(6,"Shroomy"),(7,"Kaboom"),(8,"Break Out"),(2,"Flying Tent"),(10,"Winner")],
            [(2,"Fresh Juice"),(1,"Fishy"),(3,"Bouncy Day"),(4,"Bottle Tips"),(6,"Castle Ruins"),(5,"Star Below"),(7,"Looky Here"),(9,"Playtime"),(8,"The Letter"),(10,"Life Saver")],
            [(1,"Bibi - Ribi"),(4,"The Bloob"),(3,"Woombuu"),(2,"Zap - Zap"),(5,"Beam Up"),(6,"Bloob Spill"),(7,"Team Party"),(8,"Transport"),(9,"Fixer Upper"),(10,"Take Over")]
        ]
        for world in 0..<3 {for stage in 0..<10 {
            let board=world*10+stage+1,(art,name)=expected[world][stage]
            XCTAssertEqual(NativeJourneyContent.cardName(board:board),name,"board \(board)")
            for density in [false,true] {for legendary in [false,true] {
                let path="./assets/colelctibles/\(worlds[world])/\(legendary ? "legendary":"common")/\(String(format:"%02d",art))\(legendary ? "-gold":"")\(density ? "@2x":"").png"
                XCTAssertEqual(NativeJourneyContent.cardAsset(board:board,score:legendary ? 100000:0,doubleDensity:density),path)
            }}
        }}
        XCTAssertEqual(NativeJourneyContent.cardName(board:0),NativeJourneyContent.cardName(board:1))
        XCTAssertEqual(NativeJourneyContent.cardName(board:31),NativeJourneyContent.cardName(board:1))
    }
    func testFirstTwoCardsSwapInEveryWorldAndDensity() {
        for (board,world,number) in [(1,"Forest","03"),(2,"Forest","01"),(11,"beach","02"),(12,"beach","01"),(21,"Area55","01"),(22,"Area55","04")] {
            for density in [false,true] {for score in [0,100000] {
                let rarity = score == 0 ? "common":"legendary"
                let suffix = score == 0 ? "":"-gold"
                XCTAssertEqual(NativeJourneyContent.cardAsset(board:board,score:score,doubleDensity:density),"./assets/colelctibles/\(world)/\(rarity)/\(number)\(suffix)\(density ? "@2x":"").png")
            }}
        }
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
        board.moves=49;board.combo=7;board.earnedComboBonus=725;board.wildSpawnCount=5
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
    func testArea55BeamPulsesAreMinimalIndependentAndStableAcrossRefresh() throws {
        let provider=try NativeWorldLayouts(),state=NativeProgressionState()
        func sequences(_ width:Double,_ revision:Int) throws -> [[String:Any]] {
            let snapshot=try provider.snapshot(world:3,width:width,height:844,generation:revision+1,revision:revision,progression:state)
            let units=try XCTUnwrap(snapshot["units"] as? [[String:Any]])
            XCTAssertEqual(units.compactMap{$0["boardID"] as? Int},Array(21...30))
            return try units.map {unit in
                let parts=try XCTUnwrap(unit["parts"] as? [[String:Any]])
                return try XCTUnwrap(parts.first{$0["role"] as? String == "beam"}?["beamIdle"] as? [String:Any])
            }
        }
        let first=try sequences(390,0),refreshed=try sequences(768,1)
        var durations:Set<Double>=[],bands:Set<Int>=[]
        for (index,sequence) in first.enumerated() {
            let points=try XCTUnwrap(sequence["points"] as? [[String:Double]])
            let duration=try XCTUnwrap(sequence["duration"] as? Double),phase=try XCTUnwrap(sequence["phase"] as? Double)
            durations.insert(duration)
            XCTAssertEqual(points.count,3);XCTAssertEqual(points.compactMap{$0["opacity"]},[0.2,1.0,0.2])
            XCTAssertEqual(points.first?["time"],0);XCTAssertEqual(points.last?["time"],duration)
            let peak=try XCTUnwrap(points[1]["time"])
            XCTAssertGreaterThanOrEqual(peak/duration,0.28-0.000001);XCTAssertLessThanOrEqual(peak/duration,0.42+0.000001)
            let baseDuration=duration*(index == 0 ? 2 : 1)*1.5
            let matchingBands=(0..<10).filter{baseDuration>=3.2+Double($0)*0.24-0.000001 && baseDuration<=3.34+Double($0)*0.24+0.000001}
            XCTAssertEqual(matchingBands.count,1)
            if let band=matchingBands.first {bands.insert(band)}
            XCTAssertGreaterThanOrEqual(phase,0);XCTAssertLessThan(phase,duration)
            XCTAssertTrue(NSDictionary(dictionary:sequence).isEqual(to:refreshed[index]),"Refresh/density must retain the same Unit rhythm")
        }
        XCTAssertEqual(durations.count,10);XCTAssertEqual(bands,Set(0..<10))
        var advanced=state;advanced.completedJourneyBoards.insert(21)
        let next=try provider.snapshot(world:3,width:390,height:844,generation:2,revision:2,progression:advanced)
        let nextUnits=try XCTUnwrap(next["units"] as? [[String:Any]])
        for (index,unit) in nextUnits.enumerated() {
            let parts=try XCTUnwrap(unit["parts"] as? [[String:Any]])
            let pulse=try XCTUnwrap(parts.first{$0["role"] as? String == "beam"}?["beamIdle"] as? [String:Any])
            let factor=index == 1 ? 0.5 : 1.0
            XCTAssertEqual(try XCTUnwrap(pulse["duration"] as? Double),try XCTUnwrap(first[index]["duration"] as? Double)*factor)
            XCTAssertEqual(try XCTUnwrap(pulse["phase"] as? Double),try XCTUnwrap(first[index]["phase"] as? Double)*factor)
            XCTAssertEqual(parts.contains{$0["role"] as? String == "card"},index<=1)
        }
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
            let actual=planner.next(ids:[0,2,5,7,9]),expected=cycles[cycle]
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
    func testForestAddsFourBeesWithExistingGateDepthAndRenewal() {
        var seed:UInt32=7
        let planner=NativeForestBeePlanning(contentTop:138,mainX:0,mainY:154,mainWidth:390,mainHeight:350,random:{seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296})
        let added=Set([1,3,4,6]);var passing=Set<Int>()
        for _ in 0..<10 {
            let plans=planner.next()
            XCTAssertEqual(plans.map{$0["id"] as! Int},NativeForestBeePlanning.retainedIDs)
            for plan in plans where added.contains(plan["id"] as! Int) {
                let frames=plan["frames"] as! [[String:Any]]
                if frames.contains(where:{$0["depth"] as? String == "behind"}) {passing.insert(plan["id"] as! Int)}
            }
        }
        XCTAssertEqual(passing,added,"All four added bees must pass behind the gate")
        XCTAssertEqual(Set(planner.next(ids:Array(added)).map{$0["id"] as! Int}),added)
    }
    func testNewProfileUsesInterimCardsWithoutUnlockingOtherWorlds() throws {
        let provider=try NativeWorldLayouts(),state=NativeProgressionState()
        let snapshot=try provider.snapshot(world:3,width:393,height:852,generation:8,progression:state)
        let units=try XCTUnwrap(snapshot["units"] as? [[String:Any]])
        XCTAssertEqual(units[0]["locked"] as? Bool,false);XCTAssertEqual(units[0]["cardArt"] as? String,"./assets/colelctibles/interim.png")
        XCTAssertEqual(units[1]["locked"] as? Bool,true)
        XCTAssertFalse((units[1]["parts"] as? [[String:Any]] ?? []).contains {$0["role"] as? String=="card"})
    }
    func testSourceTutorialGridOrphanCannotOverwriteLastCoherentSave()throws {
        let dir=try temporary(),store=NativeSaveStore(directory:dir)
        let old=NativeTile(id:"old",cell:.init(column:2,row:1),value:0,locked:true)
        let wild=NativeTile(id:"wild",cell:.init(column:2,row:4),value:6,archetype:.star)
        let run=NativeBoardState(tiles:[old,wild])
        var good=NativeSaveEnvelope();good.journeyRuns[1]=run
        XCTAssertTrue(try store.save(good));let original=try Data(contentsOf:dir.appendingPathComponent("state-v1.json"))
        var transient=run;XCTAssertTrue(transient.sourcePlaceTutorialTile(id:"wild",at:old.cell))
        XCTAssertTrue(transient.validationIssues(allowSourceDetachedGridReferences:true).isEmpty)
        XCTAssertFalse(NativeSaveEnvelope.isCoherentRun(transient))
        var bad=good;bad.journeyRuns[1]=transient;XCTAssertThrowsError(try store.save(bad))
        XCTAssertEqual(try Data(contentsOf:dir.appendingPathComponent("state-v1.json")),original)
        XCTAssertEqual(try XCTUnwrap(store.load()).journeyRuns[1],run)
    }

}
