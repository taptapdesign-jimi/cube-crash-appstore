import XCTest
@testable import StackToSixGameplay
final class NativeTutorialTests: XCTestCase {
    func testCollectionLessonPausePreservesExpiryAndSpeedScoringTimestamps() {
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.encouragementAcknowledged=true
        tutorial.collectionLessonAcknowledged=false;tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false
        let tiles=(0..<6).map{i in NativeTile(id:"paused-collection-\(i)",cell:.init(column:i%5,row:i/5),value:i%2+1)}
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,tutorial:tutorial))
        for (pair,time) in [(0,0.0),(1,0.25)] {
            XCTAssertTrue(engine.beginDrag(tileID:tiles[pair*2].id))
            XCTAssertTrue(engine.drop(target:tiles[pair*2+1].cell,now:time).accepted)
        }
        let combo=engine.state.combo,fast=engine.state.efficiencyFastComboContinuations
        XCTAssertGreaterThan(combo,0)
        engine.setTutorialComboPaused(true,now:0.5)
        XCTAssertTrue(engine.tutorialComboPaused)
        engine.setTutorialComboPaused(true,now:10)
        engine.expireCombo(now:100)
        XCTAssertEqual(engine.state.combo,combo)
        XCTAssertTrue(engine.acknowledgeTutorialCollectionLesson().accepted)
        engine.setTutorialComboPaused(false,now:100.5)
        engine.setTutorialComboPaused(false,now:100.7)
        XCTAssertFalse(engine.tutorialComboPaused)
        engine.expireCombo(now:100.6)
        XCTAssertEqual(engine.state.combo,combo,"Reading duration is removed from the expiry clock")
        XCTAssertTrue(engine.beginDrag(tileID:tiles[4].id))
        XCTAssertTrue(engine.drop(target:tiles[5].cell,now:100.75).accepted)
        XCTAssertEqual(engine.state.efficiencyFastComboContinuations,fast+1,"The same reading duration is removed from speed-scoring timestamps")
        engine.expireCombo(now:110)
        XCTAssertEqual(engine.state.combo,0)
    }
    func testLegacyActiveTutorialArmsCollectionOnlyAtGenuineSpecialCompletion() {
        for source in [false,true] {for oldAcknowledgement:Bool? in [nil,true] {
            var board=fourthPreparationBoard()
            board.tutorial?.step = .special;board.tutorial?.waitingForWild=false;board.tutorial?.wildTileID="wild"
            board.tutorial?.collectionLessonAcknowledged=oldAcknowledgement
            let engine=NativeGameplayEngine(state:board,recordedRandomChoices:Array(repeating:0,count:200))
            engine.sourceTutorialSubsequentPresentationEnabled=source
            if source {
                XCTAssertTrue(engine.prepareSourceTutorialFourthStep(ownerID:"tutorial",generation:1,wildID:"wild",targetID:"target").accepted)
                XCTAssertFalse(engine.completeSourceTutorialFourthStep(ownerID:"tutorial",generation:1).accepted)
                XCTAssertEqual(engine.state.tutorial?.collectionLessonAcknowledged,oldAcknowledgement)
            }
            XCTAssertTrue(engine.beginDrag(tileID:"wild"))
            XCTAssertTrue(engine.drop(target:.init(column:3,row:2)).accepted)
            if source {
                XCTAssertEqual(engine.state.tutorial?.active,true)
                XCTAssertEqual(engine.state.tutorial?.collectionLessonAcknowledged,oldAcknowledgement,"A merge cannot bypass the genuine Source exit")
                XCTAssertTrue(engine.completeSourceTutorialFourthStep(ownerID:"tutorial",generation:1).accepted)
            }
            XCTAssertEqual(engine.state.tutorial?.active,false)
            XCTAssertEqual(engine.state.tutorial?.guideCompleted,true)
            XCTAssertEqual(engine.state.tutorial?.collectionLessonAcknowledged,oldAcknowledgement ?? false)
        }}
    }
    func testAlreadyCompletedLegacyTutorialStillSkipsCollectionLesson()throws {
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.encouragementAcknowledged=true
        tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false;tutorial.comboLessonMoveCount=6
        let restored=try JSONDecoder().decode(NativeTutorialState.self,from:JSONEncoder().encode(tutorial))
        XCTAssertNil(restored.collectionLessonAcknowledged)
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],tutorial:restored))
        XCTAssertFalse(engine.acknowledgeTutorialCollectionLesson().accepted)
        XCTAssertNil(engine.state.tutorial?.collectionLessonAcknowledged)
        XCTAssertTrue(engine.beginTutorialComboLesson().accepted)
        XCTAssertNil(engine.state.tutorial?.collectionLessonAcknowledged)
    }
    func testCollectionLessonAcknowledgesOnlyPostSpecialPresentationAndIsIdempotent() {
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true
        tutorial.encouragementAcknowledged=true;tutorial.collectionLessonAcknowledged=false
        tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false;tutorial.comboLessonMoveCount=6
        var state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],tutorial:tutorial)
        state.wildMeter=0.63;state.moves=37;state.score=311;state.rngState=123
        var draws=0
        let engine=NativeGameplayEngine(state:state,sourceMathRandom:.init(draw:{draws+=1;return 0.4}))
        XCTAssertFalse(engine.beginTutorialComboLesson().accepted,"Collection copy precedes any already-ready combo lesson")
        XCTAssertEqual(engine.state,state)
        let result=engine.acknowledgeTutorialCollectionLesson()
        var expected=state;expected.tutorial?.collectionLessonAcknowledged=true
        XCTAssertTrue(result.accepted);XCTAssertTrue(result.events.isEmpty)
        XCTAssertEqual(result.state,expected);XCTAssertEqual(engine.state,expected);XCTAssertEqual(draws,0)
        XCTAssertFalse(engine.acknowledgeTutorialCollectionLesson().accepted)
        XCTAssertEqual(engine.state,expected);XCTAssertEqual(draws,0)
        XCTAssertTrue(engine.beginTutorialComboLesson().accepted)
        let premature:[(Bool,Bool?,Bool?)]=[(false,true,false),(true,false,false),(true,nil,false),(true,true,nil),(true,true,true)]
        for (completed,encouraged,collected) in premature {
            var before=state;before.tutorial?.guideCompleted=completed;before.tutorial?.encouragementAcknowledged=encouraged;before.tutorial?.collectionLessonAcknowledged=collected
            let blocked=NativeGameplayEngine(state:before)
            XCTAssertFalse(blocked.acknowledgeTutorialCollectionLesson().accepted)
            XCTAssertEqual(blocked.state,before)
        }
    }
    func testBothModesShowComboImmediatelyAfterCollectionWithoutAMove() {
        for mode in [NativeRunMode.journey,.arcade] {
            var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true
            tutorial.encouragementAcknowledged=true;tutorial.collectionLessonAcknowledged=false
            tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false;tutorial.comboLessonMoveCount=0
            let state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2)],mode:mode,moves:37,score:311,tutorial:tutorial)
            let engine=NativeGameplayEngine(state:state)
            XCTAssertFalse(engine.beginTutorialComboLesson().accepted)
            XCTAssertTrue(engine.acknowledgeTutorialCollectionLesson().accepted)
            XCTAssertTrue(engine.beginTutorialComboLesson().accepted,"Collection return must continue tutorial in both modes")
            XCTAssertEqual(engine.state.moves,37);XCTAssertEqual(engine.state.score,311)
            XCTAssertEqual(engine.state.rngState,state.rngState)
            XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,0)
        }
    }
    func testLegacyPendingComboWithoutHUDReceiptResumesOnceInBothModes()throws {
        for mode in [NativeRunMode.journey,.arcade] {for acknowledged in [false,true] {
            var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true
            tutorial.encouragementAcknowledged=true;tutorial.collectionLessonAcknowledged=true
            tutorial.comboLessonAcknowledged=acknowledged;tutorial.comboHUDRevealed=nil;tutorial.comboLessonMoveCount=0
            let state=NativeBoardState(tiles:[.init(id:"legacy",cell:.init(column:0,row:0),value:2)],mode:mode,moves:42,score:310,tutorial:tutorial)
            let engine=NativeGameplayEngine(state:try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state)))
            XCTAssertNil(engine.state.tutorial?.comboHUDRevealed)
            XCTAssertEqual(engine.beginTutorialComboLesson().accepted,!acknowledged)
            XCTAssertFalse(engine.beginTutorialComboLesson().accepted,"Re-entry cannot duplicate the same pending sheet")
            XCTAssertEqual(engine.state.moves,state.moves);XCTAssertEqual(engine.state.score,state.score)
            XCTAssertEqual(engine.state.rngState,state.rngState)
        }}
        var skipped=NativeTutorialState();skipped.active=false;skipped.guideCompleted=true
        skipped.encouragementAcknowledged=true;skipped.collectionLessonAcknowledged=true
        let old=NativeGameplayEngine(state:.init(tiles:[],tutorial:skipped))
        XCTAssertFalse(old.beginTutorialComboLesson().accepted,"Missing lesson acknowledgement keeps completed legacy guides quiet")
    }

    func testCompletionLessonReceiptRestoresAndKeepsLegacyFinishedGuidesQuiet()throws {
        let engine=NativeGameplayEngine(state:board())
        XCTAssertTrue(engine.startTutorial().accepted)
        XCTAssertEqual(engine.state.tutorial?.completionLessonAcknowledged,false)
        XCTAssertFalse(engine.acknowledgeTutorialCompletionLesson().accepted)
        var state=engine.state;state.tutorial?.active=false;state.tutorial?.guideCompleted=true
        state.tutorial?.encouragementAcknowledged=true;state.tutorial?.collectionLessonAcknowledged=true
        state.tutorial?.comboHUDRevealed=true;state.tutorial?.comboLessonAcknowledged=true
        let restored=NativeGameplayEngine(state:try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state)))
        XCTAssertEqual(restored.state.tutorial?.completionLessonAcknowledged,false)
        restored.setTutorialComboPaused(true,now:1);XCTAssertTrue(restored.tutorialComboPaused)
        XCTAssertTrue(restored.acknowledgeTutorialCompletionLesson().accepted)
        restored.setTutorialComboPaused(false,now:2)
        XCTAssertFalse(restored.acknowledgeTutorialCompletionLesson().accepted)
        var expected=state;expected.tutorial?.completionLessonAcknowledged=true
        XCTAssertEqual(restored.state,expected)
        var old=try XCTUnwrap(JSONSerialization.jsonObject(with:JSONEncoder().encode(state.tutorial)) as? [String:Any])
        old.removeValue(forKey:"completionLessonAcknowledged")
        let legacy=try JSONDecoder().decode(NativeTutorialState.self,from:JSONSerialization.data(withJSONObject:old))
        XCTAssertNil(legacy.completionLessonAcknowledged)
        XCTAssertEqual(legacy.comboLessonAcknowledged,true)
    }
    func testCollectionLessonDefersComboMoveCountingUntilAcknowledged() {
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true
        tutorial.collectionLessonAcknowledged=false;tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false
        let tiles=(0..<16).map{i in NativeTile(id:"collection-\(i)",cell:.init(column:i%5,row:i/5),value:i%2+1)}
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,tutorial:tutorial))
        engine.acknowledgeTutorialEncouragement()
        XCTAssertEqual(engine.state.tutorial?.encouragementAcknowledged,true)
        for i in 0..<8 {
            if i==2 {XCTAssertTrue(engine.acknowledgeTutorialCollectionLesson().accepted)}
            XCTAssertTrue(engine.beginDrag(tileID:tiles[i*2].id))
            XCTAssertTrue(engine.drop(target:tiles[i*2+1].cell,now:Double(i*10)).accepted)
            XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,max(0,i-1))
        }
        XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,6)
        XCTAssertTrue(engine.beginTutorialComboLesson().accepted)
    }
    func testNewTutorialArmsCollectionAndOlderCodableCheckpointSkipsIt()throws {
        let engine=NativeGameplayEngine(state:board())
        XCTAssertTrue(engine.startTutorial().accepted)
        XCTAssertEqual(engine.state.tutorial?.collectionLessonAcknowledged,false)
        let tutorial=try XCTUnwrap(engine.state.tutorial)
        let encoded=try JSONEncoder().encode(tutorial)
        XCTAssertEqual(try JSONDecoder().decode(NativeTutorialState.self,from:encoded).collectionLessonAcknowledged,false)
        var old=try XCTUnwrap(JSONSerialization.jsonObject(with:encoded) as? [String:Any])
        old.removeValue(forKey:"collectionLessonAcknowledged")
        let restored=try JSONDecoder().decode(NativeTutorialState.self,from:JSONSerialization.data(withJSONObject:old))
        XCTAssertNil(restored.collectionLessonAcknowledged)
        XCTAssertNil(NativeTutorialState().collectionLessonAcknowledged)
    }
    func testComboLessonWaitsForSixAcceptedMovesAndSurvivesSave() throws {
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true
        tutorial.comboLessonAcknowledged=false;tutorial.comboHUDRevealed=false
        let tiles=(0..<12).map {i in NativeTile(id:"die-\(i)",cell:.init(column:i%5,row:i/5),value:i%2+1)}
        var engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,tutorial:tutorial))
        engine.acknowledgeTutorialEncouragement()
        XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,0)
        XCTAssertFalse(engine.drop(target:nil).accepted)
        XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,0)
        for i in 0..<6 {
            XCTAssertFalse(engine.beginTutorialComboLesson().accepted)
            XCTAssertTrue(engine.beginDrag(tileID:"die-\(i*2)"))
            XCTAssertTrue(engine.drop(target:tiles[i*2+1].cell,now:Double(i*10)).accepted)
            XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,i+1)
            if i==4 {
                let saved=try JSONEncoder().encode(engine.state)
                engine=NativeGameplayEngine(state:try JSONDecoder().decode(NativeBoardState.self,from:saved))
                engine.acknowledgeTutorialEncouragement()
                XCTAssertEqual(engine.state.tutorial?.comboLessonMoveCount,5)
            }
        }
        XCTAssertEqual(engine.state.efficiencyFastComboContinuations,0)
        XCTAssertTrue(engine.beginTutorialComboLesson().accepted)
        XCTAssertFalse(engine.beginTutorialComboLesson().accepted)
        let frozen=engine.state.combo
        engine.setTutorialComboPaused(true,now:50.25)
        engine.setTutorialComboPaused(true,now:60) // repeated refresh must not move the pause origin
        engine.expireCombo(now:100)
        XCTAssertEqual(engine.state.combo,frozen)
        engine.setTutorialComboPaused(false,now:100.25)
        engine.setTutorialComboPaused(false,now:110) // idempotent release
        engine.expireCombo(now:100.3)
        XCTAssertEqual(engine.state.combo,frozen,"Reading the sheet must not consume the combo window")
        engine.expireCombo(now:110)
        XCTAssertEqual(engine.state.combo,0,"Normal expiry resumes after dismissal")
        engine.acknowledgeTutorialComboLesson()
        XCTAssertEqual(engine.state.tutorial?.comboLessonAcknowledged,true)
    }
    func testSpecialGuideAllowsEveryPlayableRegularTargetAcrossEntireBoard() {
        for row in 0..<9 {for value in 1...5 {for reverse in [false,true] {
            var tutorial=NativeTutorialState();tutorial.step = .special;tutorial.wildTileID="wild"
            let wild=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,archetype:.star)
            let regular=NativeTile(id:"regular",cell:.init(column:1,row:row),value:value)
            XCTAssertTrue(NativeTutorialRules.allowsPickup(regular,tutorial:tutorial,rows:9))
            let source=reverse ? regular:wild,destination=reverse ? wild:regular
            XCTAssertTrue(NativeTutorialRules.allowsDrop(source:source,destination:destination,tutorial:tutorial,rows:9))
            let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[wild,regular],tutorial:tutorial),recordedRandomChoices:Array(repeating:0.5,count:100))
            XCTAssertTrue(engine.beginDrag(tileID:source.id))
            XCTAssertTrue(engine.drop(target:destination.cell).accepted,"row=\(row),value=\(value),reverse=\(reverse)")
        }}}
    }

    func testHUDRemainsLockedAfterGuideUntilResultAcknowledged() {
        var tutorial=NativeTutorialState()
        XCTAssertTrue(tutorial.shouldLockHUD)
        tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true
        XCTAssertTrue(tutorial.shouldLockHUD)
        tutorial.done=true;tutorial.completionAssist=false
        XCTAssertFalse(tutorial.shouldLockHUD)
    }

    func testSpecialBarPickupAdmissionIgnoresOnlyItsOwnLockAndDoesNotStartDrag() {
        var tutorial=NativeTutorialState();tutorial.step = .freePlay
        let tile=NativeTile(id:"pickup",cell:NativeCell(column:0,row:0),value:1)
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[tile],tutorial:tutorial))
        let ownerLock="tutorial-special-bar:owner:1"
        engine.setInputLock(ownerLock,active:true)
        let before=engine.state
        XCTAssertFalse(engine.canBeginDrag(tileID:tile.id))
        XCTAssertTrue(engine.canBeginDrag(tileID:tile.id,ignoringInputLock:ownerLock))
        XCTAssertFalse(engine.isDragging);XCTAssertEqual(engine.state,before)
        engine.setInputLock("foreign-gameplay-owner",active:true)
        XCTAssertFalse(engine.canBeginDrag(tileID:tile.id,ignoringInputLock:ownerLock))
        XCTAssertFalse(engine.isDragging);XCTAssertEqual(engine.state,before)
        engine.setInputLock("foreign-gameplay-owner",active:false)
        XCTAssertFalse(engine.canBeginDrag(tileID:"missing",ignoringInputLock:ownerLock))
        XCTAssertFalse(engine.beginDrag(tileID:tile.id))
        engine.setInputLock(ownerLock,active:false)
        XCTAssertTrue(engine.beginDrag(tileID:tile.id));XCTAssertTrue(engine.isDragging)
        XCTAssertFalse(engine.canBeginDrag(tileID:tile.id,ignoringInputLock:ownerLock))
    }
    func testSpecialBarCountsTwoCommittedActionsAndClearStageReservesStar() throws {
        var tutorial = NativeTutorialState(); tutorial.step = .freePlay
        let tiles = (0..<4).map { NativeTile(id:"bar-\($0)",cell:NativeCell(column:$0,row:0),value:1) }
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:tiles,tutorial:tutorial),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.beginTutorialSpecialBarInterval().accepted)
        XCTAssertFalse(engine.beginTutorialSpecialBarInterval().accepted)
        XCTAssertFalse(engine.acknowledgeTutorialSpecialBar().accepted)
        XCTAssertFalse(engine.drop(target:tiles[1].cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.specialBarSuccessfulActions,0)
        for index in 0..<2 {
            XCTAssertTrue(engine.beginDrag(tileID:"bar-\(index)"))
            XCTAssertTrue(engine.drop(target:tiles[index+1].cell).accepted)
            XCTAssertEqual(engine.state.tutorial?.specialBarSuccessfulActions,index+1)
            XCTAssertEqual(engine.state.tutorial?.specialBarReady,index == 1)
            XCTAssertEqual(engine.state.tutorial?.waitingForWild,false)
        }
        XCTAssertTrue(engine.acknowledgeTutorialSpecialBar().accepted)
        XCTAssertEqual(engine.state.tutorial?.waitingForWild,false)
        XCTAssertTrue(engine.state.tutorial?.specialBarDefersReward==true)
        XCTAssertEqual(engine.state.tutorial?.specialBarAcknowledged,true)
        XCTAssertFalse(engine.acknowledgeTutorialSpecialBar().accepted)
        XCTAssertTrue(engine.dismissTutorialFreePlayGuide().accepted)
        XCTAssertEqual(engine.state.tutorial?.waitingForWild,true)
    }
    func testOlderTutorialSaveDecodesWithoutSpecialBarFields() throws {
        let encoded = try JSONEncoder().encode(NativeTutorialState())
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with:encoded) as? [String:Any])
        object.removeValue(forKey:"specialBarSuccessfulActions"); object.removeValue(forKey:"specialBarAcknowledged")
        let decoded = try JSONDecoder().decode(NativeTutorialState.self,from:JSONSerialization.data(withJSONObject:object))
        XCTAssertNil(decoded.specialBarSuccessfulActions)
        XCTAssertNil(decoded.specialBarAcknowledged)
        XCTAssertFalse(decoded.specialBarReady)
    }
    func testSpecialBarThreeSixMergesRetainFullMeterUntilContinue() {
        var tutorial = NativeTutorialState(); tutorial.step = .freePlay
        var tiles = (0..<6).map { NativeTile(id:"six-\($0)",cell:NativeCell(column:$0 % 5,row:$0 / 5),value:3) }
        tiles.append(NativeTile(id:"remaining",cell:NativeCell(column:4,row:2),value:1))
        var state = NativeBoardState(tiles:tiles,tutorial:tutorial); state.wildMeter = 0.8
        let engine = NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.beginTutorialSpecialBarInterval().accepted)
        for index in stride(from:0,to:6,by:2) {
            XCTAssertTrue(engine.beginDrag(tileID:"six-\(index)"))
            XCTAssertTrue(engine.drop(target:tiles[index+1].cell).accepted)
            XCTAssertFalse(engine.claimMeterReward().accepted)
            XCTAssertFalse(engine.state.activeTiles.contains{$0.isWild})
        }
        XCTAssertTrue(engine.state.tutorial?.specialBarReady == true)
        XCTAssertGreaterThan(engine.state.wildMeter,1)
        let meter = engine.state.wildMeter
        XCTAssertTrue(engine.acknowledgeTutorialSpecialBar().accepted)
        XCTAssertEqual(engine.state.wildMeter,meter)
        XCTAssertFalse(engine.claimMeterReward().accepted,"Clear the Stage still owns reward admission")
        XCTAssertTrue(engine.dismissTutorialFreePlayGuide().accepted)
        XCTAssertTrue(engine.claimMeterReward().accepted)
        XCTAssertTrue(engine.state.activeTiles.contains{$0.gameplayArchetype == .star})
    }
    func testContextualSpecialIdentitySurvivesSpawnPreparationAndSave()throws {
        for reward in [NativeWildRewardChoice(.star,variant:"bee"),.init(.juice),.init(.juice,variant:"robo-cube"),.init(.magnet),.init(.tnt)] {
            var state=board();var tutorial=NativeTutorialState();tutorial.step = .freePlay;tutorial.waitingForWild=true
            state.tutorial=tutorial;state.wildMeter=1
            let engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.2,count:100))
            engine.configureTutorialReward(reward);engine.configureTutorialReward(.init(.star))
            XCTAssertEqual(engine.state.tutorial?.reward,reward)
            XCTAssertTrue(engine.claimMeterReward().accepted)
            let wild=try XCTUnwrap(engine.state.activeTiles.first{$0.isWild})
            XCTAssertEqual(wild.archetype,reward.archetype);XCTAssertEqual(wild.variant,reward.variant)
            XCTAssertTrue(NativeTutorialRules.allowsPickup(wild,tutorial:engine.state.tutorial,rows:9))
            let target=try XCTUnwrap(engine.state.activeTiles.first{!$0.isWild})
            XCTAssertTrue(NativeTutorialRules.allowsDrop(source:wild,destination:target,tutorial:engine.state.tutorial,rows:9))
            XCTAssertTrue(NativeTutorialRules.allowsDrop(source:target,destination:wild,tutorial:engine.state.tutorial,rows:9))
            let decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
            XCTAssertEqual(decoded.tutorial?.reward,reward)
        }
    }
    func testEncouragementAcknowledgementRequiresCompletedGuideAndPersists()throws {
        var state=board();state.tutorial=NativeTutorialState()
        let engine=NativeGameplayEngine(state:state);engine.acknowledgeTutorialEncouragement()
        XCTAssertNil(engine.state.tutorial?.encouragementAcknowledged)
        state.tutorial?.active=false;state.tutorial?.guideCompleted=true;engine.restart(state:state)
        XCTAssertTrue(engine.state.tutorial?.needsEncouragement==true)
        engine.acknowledgeTutorialEncouragement()
        XCTAssertFalse(engine.state.tutorial?.needsEncouragement==true)
        let decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
        XCTAssertEqual(decoded.tutorial?.encouragementAcknowledged,true)
    }
    func board() -> NativeBoardState {
        var tiles: [NativeTile] = []
        for row in 0..<9 { for column in 0..<5 {
            tiles.append(NativeTile(id:"\(column),\(row)",cell:NativeCell(column:column,row:row),value:column == 0 && row == 0 ? 2 : 0,locked:!(column == 0 && row == 0)))
        } }
        return NativeBoardState(tiles:tiles)
    }
    func testCanonicalGuidedCellsAndBidirectionalDropRestrictions() {
        let engine = NativeGameplayEngine(state:board(),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.startTutorial().accepted)
        let cells = NativeTutorialRules.guidedCells(columns:5,rows:9)
        XCTAssertEqual(cells.three,NativeCell(column:1,row:3)); XCTAssertEqual(cells.two,NativeCell(column:3,row:5)); XCTAssertEqual(cells.one,NativeCell(column:3,row:1))
        let three = engine.state.tile(at:cells.three)!, two = engine.state.tile(at:cells.two)!, one = engine.state.tile(at:cells.one)!
        XCTAssertFalse(engine.beginDrag(tileID:one.id)); XCTAssertTrue(engine.beginDrag(tileID:three.id))
        XCTAssertFalse(engine.drop(target:one.cell).accepted); XCTAssertEqual(engine.state.tutorial?.step,.stack)
        XCTAssertTrue(engine.beginDrag(tileID:three.id)); XCTAssertTrue(engine.drop(target:two.cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.step,.mergeSix); XCTAssertEqual(engine.state.tutorial?.guidedPair,[two.id,one.id])
        XCTAssertTrue(engine.beginDrag(tileID:one.id)); XCTAssertTrue(engine.drop(target:two.cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.step,.freePlay); XCTAssertTrue(engine.state.tutorial?.shouldLockHUD == true)
        XCTAssertFalse(engine.acknowledgeTutorialResult())
        XCTAssertTrue(engine.dismissTutorialFreePlayGuide().accepted); XCTAssertTrue(engine.state.tutorial?.waitingForWild == true)
    }
    func testActualFirstTwoGuidedCommitsIntroduceSpecialBarWithUnfilledMeter()throws {
        let engine=NativeGameplayEngine(state:board(),recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(engine.startTutorial().accepted)
        XCTAssertTrue(engine.beginTutorialSpecialBarInterval().accepted)
        let pair=try XCTUnwrap(engine.state.tutorial?.guidedPair),one=try XCTUnwrap(engine.state.tutorial?.oneTileID)
        let destination=try XCTUnwrap(engine.state.tiles.first{$0.id==pair[1]})
        XCTAssertTrue(engine.beginDrag(tileID:pair[0]));XCTAssertTrue(engine.drop(target:destination.cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.specialBarSuccessfulActions,1)
        XCTAssertFalse(engine.state.tutorial?.specialBarReady==true)
        XCTAssertTrue(engine.beginDrag(tileID:one));XCTAssertTrue(engine.drop(target:destination.cell).accepted)
        XCTAssertEqual(engine.state.tutorial?.specialBarSuccessfulActions,2)
        XCTAssertTrue(engine.state.tutorial?.specialBarReady==true)
        XCTAssertLessThan(engine.state.wildMeter,1)
        XCTAssertFalse(engine.state.activeTiles.contains{$0.isWild})
        let preserved=engine.state.tiles
        XCTAssertTrue(engine.acknowledgeTutorialSpecialBar().accepted)
        XCTAssertEqual(engine.state.tiles,preserved)
        XCTAssertEqual(engine.state.tutorial?.waitingForWild,false)
        XCTAssertTrue(engine.dismissTutorialFreePlayGuide().accepted)
        XCTAssertEqual(engine.state.tutorial?.waitingForWild,true)
    }
    func testForcedStarSpawnAndSpecialTargetAdmissionUseSourceTopRows() {
        var state = board(); var tutorial = NativeTutorialState(); tutorial.step = .freePlay; tutorial.waitingForWild = true
        state.tutorial = tutorial; state.wildMeter = 1
        let engine = NativeGameplayEngine(state:state,recordedRandomChoices:[0.8])
        let spawn = engine.claimMeterReward(); XCTAssertTrue(spawn.accepted)
        let wild = engine.state.activeTiles.first { $0.isWild }!
        XCTAssertEqual(wild.gameplayArchetype,.star); XCTAssertEqual(wild.cell,NativeCell(column:2,row:1)); XCTAssertEqual(wild.starOrbitCount,3)
        XCTAssertEqual(engine.state.tutorial?.step,.special)
        let target = engine.state.tile(at:NativeCell(column:0,row:0))!
        XCTAssertTrue(engine.beginDrag(tileID:wild.id)); let finish = engine.drop(target:target.cell)
        XCTAssertTrue(finish.accepted); XCTAssertEqual(engine.state.tutorial?.active,false); XCTAssertEqual(engine.state.tutorial?.guideCompleted,true)
        XCTAssertEqual(engine.state.tutorial?.completionAssist,true); XCTAssertTrue(engine.state.tutorial?.requiresResultCompletion == true)
        XCTAssertTrue(engine.state.tutorial?.shouldLockHUD == true); XCTAssertTrue(engine.acknowledgeTutorialResult()); XCTAssertFalse(engine.state.tutorial?.shouldLockHUD == true)
        XCTAssertEqual(engine.state.tutorial?.done,true)
    }
    func testCompletionAssistWeightedValuesSlowMeterAndFailSuppression() {
        var tutorial = NativeTutorialState(); tutorial.active = false; tutorial.guideCompleted = true; tutorial.completionAssist = true
        let lone = NativeTile(id:"only",cell:NativeCell(column:0,row:0),value:5)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[lone],tutorial:tutorial),recordedRandomChoices:[0])
        XCTAssertEqual(engine.resolve().reason,"tutorial_final_chance_pending"); XCTAssertNil(engine.beginNoMovesConfirmation())
        XCTAssertTrue(engine.claimTutorialFinalChance().accepted)
        XCTAssertEqual(engine.state.activeTiles.map(\.value).sorted(),[1,5]); XCTAssertEqual(engine.state.tutorial?.finalChanceSpawnCount,1)
        XCTAssertEqual(NativeTutorialRules.lowValue(excluding:1,roll:0),2); XCTAssertEqual(NativeTutorialRules.lowValue(roll:0.99),3)
        XCTAssertEqual(tutorial.meterMultiplier,0.5); XCTAssertTrue(tutorial.shouldLockHUD)
    }
    func testOrdinaryBoardCompletionNeverMarksTutorialDone() {
        let a = NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:3), b = NativeTile(id:"b",cell:NativeCell(column:1,row:0),value:3)
        let engine = NativeGameplayEngine(state:NativeBoardState(tiles:[a,b]))
        XCTAssertTrue(engine.beginDrag(tileID:a.id)); XCTAssertEqual(engine.drop(target:b.cell).resolution.kind,.complete)
        XCTAssertFalse(engine.acknowledgeTutorialResult()); XCTAssertNil(engine.state.tutorial)
    }
    func testTutorialPolicySurvivesSaveWithoutPresentationDimChangingClassification() throws {
        let engine = NativeGameplayEngine(state:board()); _ = engine.startTutorial()
        let decoded = try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state))
        XCTAssertEqual(decoded,engine.state); XCTAssertEqual(decoded.activeTiles.count,4)
        XCTAssertTrue(decoded.tiles.filter { decoded.tutorial!.guidedPair.contains($0.id) }.allSatisfy { $0.alpha == 1 && !$0.locked })
    }
}

extension NativeTutorialTests {
    private struct WildCellOracle:Decodable {
        struct Tile:Decodable {
            let id:String,column:Int,row:Int,value:Int,locked:Bool,destroyed:Bool,special:String?,cleared:Bool,residual:Bool
            var native:NativeTile{.init(id:id,cell:.init(column:column,row:row),value:value,archetype:special.flatMap(NativeWildArchetype.init(rawValue:)),sourceWildStateCleared:cleared,sourceResidualWildPresence:residual,locked:locked)}
        }
        struct Target:Decodable {let id:String,value:Int}
        struct Case:Decodable {
            let fourthTarget:Target?
            let index:Int,columns:Int,rows:Int,tiles:[Tile],wildID:String?,emptyGridCells:[NativeCell],reserved:NativeCell?,laterTiles:[Tile],excluded:[NativeCell],rawResolvedFrom:NativeCell,resolved:NativeCell?
        }
        let cases:[Case]
    }
    func testSourceWildCellReservationAndLiveRevalidationMatchLiteralOriginal96CaseOracle()throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceTutorialWildCellsV9Oracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(WildCellOracle.self,from:Data(contentsOf:url));XCTAssertEqual(oracle.cases.count,96)
        for c in oracle.cases {
            let initial=NativeBoardState(columns:c.columns,rows:c.rows,tiles:c.tiles.map(\.native)),later=NativeBoardState(columns:c.columns,rows:c.rows,tiles:c.laterTiles.map(\.native))
            XCTAssertEqual(NativeTutorialRules.sourceFourthWildCell(state:initial,wildID:c.wildID,destroyedIDs:Set(c.tiles.filter(\.destroyed).map(\.id)),emptyGridCells:Set(c.emptyGridCells)),c.reserved,"source reserve case \(c.index)")
            XCTAssertEqual(NativeTutorialRules.sourceResolveReservedWildCell(state:later,reserved:c.rawResolvedFrom,destroyedIDs:Set(c.laterTiles.filter(\.destroyed).map(\.id)),excluded:Set(c.excluded)),c.resolved,"source revalidate case \(c.index)")
        }
    }
    private func sourceReservationEngine(draw:@escaping()->Double={0},hiddenOpen:Bool=true)->NativeGameplayEngine {
        var state=board();var tutorial=NativeTutorialState();tutorial.step = .freePlay;state.tutorial=tutorial;state.wildMeter=1.25
        let e=NativeGameplayEngine(state:state,rewardPicker:{_,_ in .init(.tnt)},sourceMathRandom:.init(draw:draw))
        e.sourceTutorialSubsequentPresentationEnabled=true;e.stagedMeterDrops=hiddenOpen;e.stagedMeterOpen=hiddenOpen
        return e
    }
    func testSourceReservationIsOwnedTransientAndConsumesNoMathMoveOrRevision()throws {
        var draws=0;let e=sourceReservationEngine(draw:{draws+=1;return 0.8}),before=e.state
        XCTAssertFalse(e.dismissTutorialFreePlayGuide().accepted);XCTAssertEqual(e.state,before)
        XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"actual-owner").accepted)
        let reservation=try XCTUnwrap(e.sourceTutorialWildReservation)
        XCTAssertEqual(reservation.ownerID,"actual-owner");XCTAssertEqual(reservation.generation,e.state.generation)
        XCTAssertEqual(reservation.cell,.init(column:2,row:1));XCTAssertEqual(draws,0)
        XCTAssertEqual(e.state.tiles,before.tiles);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.revision,before.revision)
        let saved=e.state,decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(saved)),relaunched=NativeGameplayEngine(state:decoded)
        XCTAssertEqual(decoded,saved);XCTAssertTrue(decoded.tutorial?.waitingForWild==true);XCTAssertNil(relaunched.sourceTutorialWildReservation)
        XCTAssertFalse(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"successor").accepted);XCTAssertEqual(e.sourceTutorialWildReservation,reservation)
        XCTAssertFalse(e.retireSourceTutorialWildReservation(ownerID:"successor",generation:reservation.generation));XCTAssertFalse(e.retireSourceTutorialWildReservation(ownerID:reservation.ownerID,generation:reservation.generation+1))
        XCTAssertTrue(e.retireSourceTutorialWildReservation(ownerID:reservation.ownerID,generation:reservation.generation));XCTAssertEqual(e.state,saved)
        XCTAssertFalse(e.retireSourceTutorialWildReservation(ownerID:reservation.ownerID,generation:reservation.generation))
    }
    func testActualHiddenOpenUsesCapturedForcedCellAndClearsOnlyOnMatchingSuccessBeforePreparation()throws {
        var draws=0;let e=sourceReservationEngine(draw:{draws+=1;return 0.8})
        XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"actual-owner").accepted)
        let old=try XCTUnwrap(e.sourceTutorialWildReservation)
        XCTAssertTrue(e.claimMeterReward().accepted);let request=try XCTUnwrap(e.pendingMeterOpen)
        XCTAssertEqual(request.tile.cell,old.cell);XCTAssertEqual(request.tile.gameplayArchetype,.star);XCTAssertEqual(draws,1,"only actual Star orbit draw, no random cell/selection")
        let holder=try XCTUnwrap(request.expectedHolderID),snapshot=e.state
        XCTAssertFalse(e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:"foreign")).accepted)
        XCTAssertEqual(e.state,snapshot);XCTAssertEqual(e.sourceTutorialWildReservation,old)
        var prepared=false
        let result=e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:holder),prepareCommitted:{tile in
            prepared=true;XCTAssertNil(e.sourceTutorialWildReservation);XCTAssertEqual(tile.cell,old.cell);XCTAssertEqual(tile.id,holder)
        })
        XCTAssertTrue(result.accepted);XCTAssertTrue(prepared);XCTAssertNil(e.sourceTutorialWildReservation)
        XCTAssertEqual(e.state.wildMeter,0.25,accuracy:1e-10);XCTAssertEqual(e.meterDropReservations.values.first?.cell,old.cell)
        XCTAssertFalse(e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:holder)).accepted)
    }
    func testRefusedForcedCellThenActualRandomSuccessRetainsOriginalForceFlags()throws {
        var draws=0;let e=sourceReservationEngine(draw:{draws+=1;return 0})
        XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"actual-owner").accepted)
        let reservation=try XCTUnwrap(e.sourceTutorialWildReservation);XCTAssertTrue(e.claimMeterReward().accepted)
        let first=try XCTUnwrap(e.pendingMeterOpen);XCTAssertEqual(first.tile.cell,reservation.cell);XCTAssertEqual(draws,1)
        XCTAssertTrue(e.completeMeterOpen(id:first.id,generation:first.generation,receipt:.creationFailed).accepted)
        let second=try XCTUnwrap(e.pendingMeterOpen);XCTAssertNotEqual(second.tile.cell,first.tile.cell);XCTAssertEqual(second.tile.archetype,.star);XCTAssertEqual(draws,3)
        XCTAssertTrue(e.completeMeterOpen(id:second.id,generation:second.generation,receipt:.created(tileID:try XCTUnwrap(second.expectedHolderID))).accepted)
        XCTAssertEqual(e.sourceTutorialWildReservation,reservation,"original flags clear only on matching forced-cell success")
    }
    func testSourceReservationCancellationBeforeOpenKeepsFlagsAndReentrantRestartCannotClearSuccessor()throws {
        let e=sourceReservationEngine();XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"old").accepted)
        let old=try XCTUnwrap(e.sourceTutorialWildReservation);XCTAssertTrue(e.claimMeterReward().accepted)
        let request=try XCTUnwrap(e.pendingMeterOpen);var flags=NativeGameplayRuntimeFlags();flags.busyEnding=true;e.setRuntimeFlags(flags)
        XCTAssertTrue(e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:try XCTUnwrap(request.expectedHolderID))).accepted)
        XCTAssertEqual(e.sourceTutorialWildReservation,old);XCTAssertEqual(e.state.wildMeter,1.25)
        var fresh=board();var tutorial=NativeTutorialState();tutorial.step = .freePlay;fresh.tutorial=tutorial;fresh.wildMeter=2.25
        e.restart(state:fresh);XCTAssertNil(e.sourceTutorialWildReservation)
        XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"new").accepted);let successor=try XCTUnwrap(e.sourceTutorialWildReservation)
        XCTAssertFalse(e.retireSourceTutorialWildReservation(ownerID:old.ownerID,generation:old.generation));XCTAssertEqual(e.sourceTutorialWildReservation,successor)
        XCTAssertFalse(e.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:"stale")).accepted);XCTAssertEqual(e.sourceTutorialWildReservation,successor);XCTAssertEqual(e.state.wildMeter,2.25)
        XCTAssertTrue(e.claimMeterReward().accepted);let newRequest=try XCTUnwrap(e.pendingMeterOpen)
        let result=e.completeMeterOpen(id:newRequest.id,generation:newRequest.generation,receipt:.created(tileID:try XCTUnwrap(newRequest.expectedHolderID)),prepareCommitted:{_ in
            e.restart(state:fresh);XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"newest").accepted)
        })
        XCTAssertFalse(result.accepted);XCTAssertEqual(e.state.wildMeter,2.25);XCTAssertEqual(e.sourceTutorialWildReservation?.ownerID,"newest")
    }
    func testSourceReservationCannotSilentlyUseAtomicOrDropOnlyPrototype()throws {
        for drops in [false,true]{
            let e=sourceReservationEngine(hiddenOpen:false);e.stagedMeterDrops=drops
            XCTAssertTrue(e.dismissTutorialFreePlayGuide(sourceReservationOwnerID:"actual-owner").accepted)
            let snapshot=e.state,receipt=e.sourceTutorialWildReservation
            let result=e.claimMeterReward();XCTAssertFalse(result.accepted);XCTAssertEqual(result.resolution.reason,"source_tutorial_hidden_open_owner_unavailable")
            XCTAssertEqual(e.state,snapshot);XCTAssertEqual(e.sourceTutorialWildReservation,receipt);XCTAssertTrue(e.meterDropReservations.isEmpty)
        }
    }
    func testSourceFourthTargetMatchesLiteralOriginal96CaseOracle()throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceTutorialWildCellsV9Oracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(WildCellOracle.self,from:Data(contentsOf:url));XCTAssertEqual(oracle.cases.count,96)
        for c in oracle.cases {
            let state=NativeBoardState(columns:c.columns,rows:c.rows,tiles:c.tiles.map(\.native))
            let actual=NativeTutorialRules.sourceFourthTarget(state:state,wildID:c.wildID,destroyedIDs:Set(c.tiles.filter(\.destroyed).map(\.id)))
            XCTAssertEqual(actual?.id,c.fourthTarget?.id,"target identity case \(c.index)")
            XCTAssertEqual(actual?.value,c.fourthTarget?.value,"target value case \(c.index)")
        }
    }

    func testSourceTutorialPlacementRetainsDisplacedRosterAndAuthoritativeGridIdentity()throws {
        let old=NativeTile(id:"old",cell:.init(column:2,row:1),value:0,locked:true)
        let wild=NativeTile(id:"wild",cell:.init(column:2,row:4),value:6,archetype:.star)
        var state=NativeBoardState(tiles:[old,wild]);let revision=state.revision,rng=state.rngState
        XCTAssertTrue(state.sourcePlaceTutorialTile(id:"wild",at:old.cell))
        XCTAssertEqual(state.tiles.map(\.id),["old","wild"]);XCTAssertEqual(state.tiles[0],old)
        XCTAssertEqual(state.tile(at:old.cell)?.id,"wild");XCTAssertNil(state.tile(at:wild.cell))
        XCTAssertEqual(state.sourceDetachedGridTileIDs,["old"])
        var otherGrid=state;otherGrid.sourceDetachedGridTileIDs=nil;XCTAssertNotEqual(state.signature,otherGrid.signature)
        XCTAssertTrue(state.validationIssues(allowSourceDetachedGridReferences:true).isEmpty)
        XCTAssertTrue(state.validationIssues().contains("orphan-live-tile"));XCTAssertTrue(state.validationIssues().contains("duplicate-grid-owner"))
        XCTAssertEqual(state.revision,revision);XCTAssertEqual(state.rngState,rng)
        let decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(state))
        XCTAssertEqual(decoded,state);XCTAssertEqual(decoded.tile(at:old.cell)?.id,"wild")
        state.removeSourceGridOwner(at:old.cell);XCTAssertEqual(state.tiles,[old]);XCTAssertNil(state.tile(at:old.cell))
        XCTAssertTrue(state.sourcePlaceTutorialTile(id:"old",at:.init(column:1,row:1)))
        XCTAssertNil(state.sourceDetachedGridTileIDs);XCTAssertTrue(state.validationIssues().isEmpty)
    }
    func testSourceRuntimeGridMetadataIsAdditiveAndInvalidPlacementCannotMutate()throws {
        let original=board();let data=try JSONEncoder().encode(original)
        var object=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any]);object.removeValue(forKey:"sourceDetachedGridTileIDs")
        let decoded=try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:object))
        XCTAssertEqual(decoded,original);XCTAssertNil(decoded.sourceDetachedGridTileIDs)
        var state=original
        XCTAssertFalse(state.sourcePlaceTutorialTile(id:"missing",at:.init(column:0,row:0)))
        XCTAssertFalse(state.sourcePlaceTutorialTile(id:state.tiles[0].id,at:.init(column:-1,row:0)))
        XCTAssertEqual(state,original)
        XCTAssertTrue(state.sourcePlaceTutorialTile(id:state.tiles[0].id,at:state.tiles[0].cell))
        XCTAssertEqual(state,original)
    }
    func testSourceDetachedPositiveRosterObjectRemainsPlayableButCannotStealGridOwner() {
        let old=NativeTile(id:"old",cell:.init(column:2,row:1),value:4,locked:true)
        let wild=NativeTile(id:"wild",cell:.init(column:2,row:4),value:6,archetype:.star)
        var state=NativeBoardState(tiles:[old,wild]);XCTAssertTrue(state.sourcePlaceTutorialTile(id:"wild",at:old.cell))
        state.tiles[0].locked=false
        XCTAssertEqual(Set(state.activeTiles.map(\.id)),["old","wild"])
        XCTAssertEqual(state.tile(at:old.cell)?.id,"wild")
        XCTAssertTrue(state.validationIssues(allowSourceDetachedGridReferences:true).isEmpty)
        let off=NativeGameplayEngine(state:state);XCTAssertFalse(off.beginDrag(tileID:"old",pointerID:1))
        let on=NativeGameplayEngine(state:state);on.sourceTutorialSubsequentPresentationEnabled=true
        XCTAssertTrue(on.beginDrag(tileID:"old",pointerID:1));on.cancelDrag()
    }

    private func fourthPreparationBoard()->NativeBoardState {
        var tutorial=NativeTutorialState();tutorial.step = .freePlay;tutorial.waitingForWild=true
        return NativeBoardState(tiles:[
            .init(id:"holder",cell:.init(column:2,row:1),value:0,locked:true),
            .init(id:"other",cell:.init(column:0,row:0),value:4),
            .init(id:"wild",cell:.init(column:2,row:4),value:6,starOrbitCount:2,archetype:.star),
            .init(id:"target",cell:.init(column:3,row:2),value:2,stackDepth:3)
        ],revision:7,tutorial:tutorial)
    }
    func testSourceFourthCorePreparationKeepsSameIDsDepthCountersAndConsumesNoMath()throws {
        let original=fourthPreparationBoard();var draws=0
        let e=NativeGameplayEngine(state:original,sourceMathRandom:.init(draw:{draws+=1;return 0.5}));e.sourceTutorialSubsequentPresentationEnabled=true
        let r=e.prepareSourceTutorialFourthStep(ownerID:"tutorial",generation:1,wildID:"wild",targetID:"target")
        XCTAssertTrue(r.accepted);XCTAssertEqual(draws,0);XCTAssertEqual(e.state.tiles.map(\.id),original.tiles.map(\.id))
        XCTAssertEqual(e.state.tiles[0],original.tiles[0]);XCTAssertEqual(e.state.tiles[1],original.tiles[1])
        XCTAssertEqual(e.state.tile(at:.init(column:2,row:1))?.id,"wild");XCTAssertEqual(e.state.sourceDetachedGridTileIDs,["holder"])
        XCTAssertEqual(e.state.tiles[2].starOrbitCount,2);XCTAssertEqual(e.state.tiles[3].stackDepth,3)
        XCTAssertFalse(e.state.tiles[3].sourceWildStateCleared)
        XCTAssertEqual(e.state.tutorial?.step,.special);XCTAssertEqual(e.state.tutorial?.guidedPair,["wild","target"])
        XCTAssertEqual(e.state.moves,original.moves);XCTAssertEqual(e.state.revision,original.revision);XCTAssertEqual(e.state.rngState,original.rngState)
        XCTAssertEqual(e.state.score,original.score);XCTAssertEqual(e.state.wildMeter,original.wildMeter)
        let receipt=try XCTUnwrap(e.sourceTutorialFourthPreparation);XCTAssertEqual(receipt.ownerID,"tutorial");XCTAssertEqual(receipt.targetValue,2)
        let prepared=e.state
        XCTAssertFalse(e.prepareSourceTutorialFourthStep(ownerID:"tutorial",generation:1,wildID:"wild",targetID:"target").accepted)
        XCTAssertEqual(e.state,prepared);XCTAssertEqual(draws,0)
        e.restart(state:original);XCTAssertNil(e.sourceTutorialFourthPreparation)
        XCTAssertFalse(e.prepareSourceTutorialFourthStep(ownerID:"tutorial",generation:1,wildID:"wild",targetID:"target").accepted)
        XCTAssertTrue(e.prepareSourceTutorialFourthStep(ownerID:"successor",generation:e.state.generation,wildID:"wild",targetID:"target").accepted)
    }
    func testSourceFourthCorePreparationRejectsUnadmittedOrStaleTargetWithoutMutation() {
        let original=fourthPreparationBoard()
        for (enabled,owner,generation,target) in [(false,"owner",UInt64(1),"target"),(true,"",1,"target"),(true,"owner",2,"target"),(true,"owner",1,"other")] {
            let e=NativeGameplayEngine(state:original);e.sourceTutorialSubsequentPresentationEnabled=enabled
            XCTAssertFalse(e.prepareSourceTutorialFourthStep(ownerID:owner,generation:generation,wildID:"wild",targetID:target).accepted)
            XCTAssertEqual(e.state,original);XCTAssertNil(e.sourceTutorialFourthPreparation)
        }
    }

    func testSourceFourthGuideWaitsForActualExitCompletionAndRejectsForeignOrDuplicateOwner()throws {
        let e=NativeGameplayEngine(state:fourthPreparationBoard(),recordedRandomChoices:Array(repeating:0,count:200))
        e.sourceTutorialSubsequentPresentationEnabled=true
        XCTAssertTrue(e.prepareSourceTutorialFourthStep(ownerID:"tutorial",generation:1,wildID:"wild",targetID:"target").accepted)
        let prepared=e.state
        XCTAssertFalse(e.completeSourceTutorialFourthStep(ownerID:"tutorial",generation:1).accepted);XCTAssertEqual(e.state,prepared)
        XCTAssertTrue(e.beginDrag(tileID:"wild"));XCTAssertTrue(e.drop(target:.init(column:3,row:2)).accepted)
        XCTAssertEqual(e.state.tutorial?.active,true);XCTAssertEqual(e.state.tutorial?.guideCompleted,false)
        let merged=e.state
        XCTAssertFalse(e.completeSourceTutorialFourthStep(ownerID:"foreign",generation:1).accepted)
        XCTAssertFalse(e.completeSourceTutorialFourthStep(ownerID:"tutorial",generation:2).accepted);XCTAssertEqual(e.state,merged)
        XCTAssertTrue(e.completeSourceTutorialFourthStep(ownerID:"tutorial",generation:1).accepted)
        XCTAssertEqual(e.state.tutorial?.active,false);XCTAssertEqual(e.state.tutorial?.guideCompleted,true);XCTAssertEqual(e.state.tutorial?.completionAssist,true)
        XCTAssertEqual(e.state.moves,merged.moves);XCTAssertEqual(e.state.revision,merged.revision);XCTAssertEqual(e.state.rngState,merged.rngState)
        XCTAssertNil(e.sourceTutorialFourthPreparation);let completed=e.state
        XCTAssertFalse(e.completeSourceTutorialFourthStep(ownerID:"tutorial",generation:1).accepted);XCTAssertEqual(e.state,completed)
    }
}
