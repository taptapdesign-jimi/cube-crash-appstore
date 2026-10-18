import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeCompleteNoMovesRootTests:XCTestCase {
    @MainActor final class Fixture {
        let directory:URL,store:NativeSaveStore,host:NativeStandaloneViewController,window:UIWindow
        let previous:UIWindow?
        var app:NativeAppController {host.children.first as! NativeAppController}
        var game:NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        init(state:NativeBoardState,random:@escaping()->Double={0.1})throws {
            directory=FileManager.default.temporaryDirectory.appendingPathComponent("complete-no-moves-"+UUID().uuidString)
            store=NativeSaveStore(directory:directory)
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            seed.progression.firstPlayTutorialComplete=true;seed.activeArcadeVariant=state.effectiveArcadeVariant;seed.arcadeRun=state;try store.save(seed)
            host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:random,completeNativeGameplayEnabled:true)
            previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        }
        func dispose(){host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
    }
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let until=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<until else{throw NSError(domain:"CompleteNoMoves."+label,code:1)};try await Task.sleep(for:.milliseconds(10))}
    }
    private func enter(_ fixture:Fixture)async throws->(NativeGameplayViewController,NativeBoardScene) {
        try await wait("home"){!fixture.app.home.isHidden};fixture.app.navigate(.gameplay,interrupt:true)
        do {try await wait("entry"){
            guard let game=fixture.game,let scene=game.boardScene else{return false}
            return scene.gameplayRenderHost?.renderView.window != nil && scene.isBoardEntryComplete && game.beforeSourceGameplayAdmission==nil
        }} catch {
            let profileError=fixture.host.view.subviews.compactMap{$0 as? UILabel}.first{$0.accessibilityIdentifier=="native.profile.error"}?.text ?? "none"
            let detail="profileError=\(profileError);Actual Native root entry timeout: game=\(fixture.game != nil);entry=\(fixture.game?.sourceEntryDiagnostic() ?? "no-game");state=\(String(describing:fixture.game?.engine.state));sceneView=\(fixture.game?.boardScene?.view != nil);complete=\(String(describing:fixture.game?.boardScene?.isBoardEntryComplete));scene=\(fixture.game?.boardScene?.sourceLevelEndDiagnostic() ?? "no-scene")"
            XCTFail(detail);throw NSError(domain:detail,code:1)
        }
        let game=try XCTUnwrap(fixture.game),scene=try XCTUnwrap(game.boardScene)
        XCTAssertEqual(game.engine.sourceNoMovesCallerAdmission?.kinds,[.ordinaryMovesDepleted,.mergeMovesDepleted])
        XCTAssertTrue(game.engine.sourceOrdinaryPreDebitEnabled)
        XCTAssertTrue(game.engine.sourceOrdinaryPreDebitAdmission?.isCurrent()==true)
        XCTAssertNotNil(game.engine.sourceMandatoryMergeCellWriterID)
        XCTAssertTrue(game.sourceContext?.endgameMutations.allFourWritersConnected==true)
        let runtime=try XCTUnwrap(game.engine.sourceNoMovesRuntimeAuthority?.capture())
        XCTAssertEqual(runtime.capabilities,Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
        return (game,scene)
    }
    func testCapturedLuckyDropRunReachesNoMoves() async throws {
        let board=try JSONDecoder().decode(NativeBoardState.self,from:Data(#"{"tiles":[{"locked":false,"transientSpawn":false,"cell":{"row":0,"column":3},"starOrbitCount":3,"pendingRemoval":false,"sourceWildStateCleared":false,"id":"g3-3","alpha":1,"resolutionOwned":false,"merge6CleanupOwned":false,"visible":true,"value":3,"magnetOwned":false,"stackDepth":1,"sourceResidualWildPresence":false,"nonFinalMerge6":false},{"locked":false,"transientSpawn":false,"cell":{"row":1,"column":3},"starOrbitCount":3,"pendingRemoval":false,"sourceWildStateCleared":false,"id":"g3-8","alpha":1,"resolutionOwned":false,"merge6CleanupOwned":false,"visible":true,"value":3,"magnetOwned":false,"stackDepth":1,"sourceResidualWildPresence":false,"nonFinalMerge6":false},{"locked":false,"transientSpawn":false,"cell":{"row":2,"column":1},"starOrbitCount":3,"pendingRemoval":false,"sourceWildStateCleared":false,"id":"g3-11","alpha":1,"resolutionOwned":false,"merge6CleanupOwned":false,"visible":true,"value":2,"magnetOwned":false,"stackDepth":1,"sourceResidualWildPresence":false,"nonFinalMerge6":false},{"sourceWildStateCleared":false,"visible":true,"id":"g3-15","pendingRemoval":false,"transientSpawn":false,"cell":{"row":3,"column":0},"nonFinalMerge6":false,"starOrbitCount":3,"value":0,"sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":true,"merge6CleanupOwned":false,"stackDepth":1},{"sourceWildStateCleared":false,"visible":true,"id":"g3-22","pendingRemoval":false,"transientSpawn":false,"cell":{"row":4,"column":2},"nonFinalMerge6":false,"starOrbitCount":3,"value":4,"sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":false,"merge6CleanupOwned":false,"stackDepth":1},{"sourceWildStateCleared":false,"visible":true,"id":"g3-26","pendingRemoval":false,"transientSpawn":false,"cell":{"row":5,"column":1},"nonFinalMerge6":false,"starOrbitCount":3,"value":2,"sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":false,"merge6CleanupOwned":false,"stackDepth":1},{"sourceWildStateCleared":false,"visible":true,"id":"g3-35","pendingRemoval":false,"transientSpawn":false,"cell":{"row":7,"column":0},"nonFinalMerge6":false,"starOrbitCount":3,"value":4,"sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":false,"merge6CleanupOwned":false,"stackDepth":1},{"sourceWildStateCleared":false,"visible":true,"id":"g3-40","pendingRemoval":false,"transientSpawn":false,"cell":{"row":8,"column":0},"nonFinalMerge6":false,"starOrbitCount":3,"value":4,"sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":false,"merge6CleanupOwned":false,"stackDepth":1},{"sourceWildStateCleared":false,"visible":true,"id":"g3-43","pendingRemoval":false,"transientSpawn":false,"cell":{"row":8,"column":3},"nonFinalMerge6":false,"starOrbitCount":3,"value":1,"sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":false,"merge6CleanupOwned":false,"stackDepth":1},{"sourceWildStateCleared":false,"visible":true,"id":"g3-24","pendingRemoval":false,"transientSpawn":false,"cell":{"row":4,"column":4},"nonFinalMerge6":false,"starOrbitCount":0,"value":6,"archetype":"wild","sourceResidualWildPresence":false,"magnetOwned":false,"resolutionOwned":false,"alpha":1,"locked":false,"merge6CleanupOwned":false,"stackDepth":1}],"moves":29,"lastWildDropType":"wild","rngState":1,"score":5563,"wildMeter":0,"wildDropTypeStreak":1,"earnedComboBonus":5325,"stage":3,"combo":21,"wildSpawnCount":1,"starsCount":0,"columns":5,"maxStackDepth":3,"longestCombo":21,"arcadeVariant":"pureDice","cubesCracked":14,"maxMoves":50,"bestScore":5563,"generation":3,"revision":21,"luckyDropUsed":true,"mode":"arcade_home","board":3,"rows":9}"#.utf8))
        let fixture=try Fixture(state:board,random:{0.9});defer{fixture.dispose()}
        let(game,scene)=try await enter(fixture)
        var lastContactWasStar=false
        for _ in 0..<30 {
            if game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil {break}
            let tiles=game.engine.state.tiles.filter{!$0.locked && $0.value>0 && !$0.pendingRemoval}
            var pair:(NativeTile,NativeTile)?
            for a in tiles where pair==nil {
                for b in tiles where b.id != a.id {
                    if !a.isWild && !b.isWild && a.value+b.value<=6 {pair=(a,b);break}
                }
            }
            if pair==nil,let star=tiles.first(where:{$0.isWild}),let target=tiles.first(where:{!$0.isWild}) {pair=(target,star)}
            guard let(a,b)=pair,let geometry=scene.boardGeometry else{break}
            lastContactWasStar=a.isWild || b.isWild
            let start=geometry.center(row:a.cell.row,column:a.cell.column),end=geometry.center(row:b.cell.row,column:b.cell.column)
            XCTAssertTrue(scene.beginDrag(at:start));scene.moveDrag(to:end,now:CACurrentMediaTime())
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:end,now:CACurrentMediaTime())).accepted)
            try await Task.sleep(for:.seconds(2))
        }
        XCTAssertTrue(lastContactWasStar,"Captured round must end specifically after Star merge-six")
        do {try await wait("captured-lucky-no-moves") {game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil}}
        catch {XCTFail("state=\(game.engine.state);"+scene.sourceLevelEndDiagnostic());throw error}
        try await awaitNoMovesResultWithoutTextRevival(game)
    }
    func testLuckyDropRoundThreeStarCleanupStartsNoMoves() async throws {
        var tiles=[NativeTile(id:"lucky-star",cell:.init(column:0,row:0),value:6,archetype:.star),NativeTile(id:"target",cell:.init(column:1,row:0),value:3),NativeTile(id:"four",cell:.init(column:2,row:0),value:4),NativeTile(id:"five",cell:.init(column:3,row:0),value:5)]
        tiles[0].starOrbitCount=0
        var board=NativeBoardState(tiles:tiles,mode:.arcade,board:3,stage:3,generation:3,moves:20,score:7977,wildMeter:0)
        board.arcadeVariant = .pureDice;board.luckyDropUsed=true
        let fixture=try Fixture(state:board,random:{0.5});defer{fixture.dispose()}
        let(game,scene)=try await enter(fixture)
        // Let the entry check finish with a legal Star contact first. It must
        // not accidentally supply the missing post-Star check.
        try await Task.sleep(for:.seconds(2))
        try drop(scene)
        do {try await wait("lucky-star-no-moves") {game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil}}
        catch {XCTFail("state=\(game.engine.state);"+scene.sourceLevelEndDiagnostic());throw error}
        try await awaitNoMovesResultWithoutTextRevival(game)
    }
    func testLuckyDropRoundThreeLastOrdinaryStackStartsNoMoves() async throws {
        let values=[1,2,4,5]
        let tiles=values.enumerated().map{NativeTile(id:"lucky-stall-\($0.offset)",cell:.init(column:$0.offset,row:0),value:$0.element)}
        var board=NativeBoardState(tiles:tiles,mode:.arcade,board:3,stage:3,generation:3,moves:20,score:7977,wildMeter:0)
        board.arcadeVariant = .pureDice;board.luckyDropUsed=true
        let fixture=try Fixture(state:board);defer{fixture.dispose()}
        let(game,scene)=try await enter(fixture)
        try drop(scene)
        do {try await wait("lucky-no-moves") {game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil}}
        catch {XCTFail(scene.sourceLevelEndDiagnostic());throw error}
        try await awaitNoMovesResultWithoutTextRevival(game)
    }
    func testArcadeRoundFourFinalStackStartsNoMovesWithoutForegroundRecovery() async throws {
        let values=[2,3,3,4,4,5,5]
        let tiles=values.enumerated().map{NativeTile(id:"stall-\($0.offset)",cell:.init(column:$0.offset%5,row:$0.offset/5),value:$0.element)}
        let fixture=try Fixture(state:.init(tiles:tiles,mode:.arcade,board:4,stage:4,generation:19,moves:22,score:9900,wildMeter:0.81))
        defer{fixture.dispose()}
        let(game,scene)=try await enter(fixture)
        let geometry=try XCTUnwrap(scene.boardGeometry),start=geometry.center(row:0,column:0),end=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:start));scene.moveDrag(to:end,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:end,now:CACurrentMediaTime())).accepted)
        try await wait("automatic-no-moves: "+scene.sourceLevelEndDiagnostic()){
            game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil
        }
        XCTAssertEqual(game.engine.state.moves,22,"Source pre-debit stuck return preserves the move")
        try await awaitNoMovesResultWithoutTextRevival(game)
    }
    func testArcadeRoundFourSixSpawnStartsNoMovesWithoutForegroundRecovery() async throws {
        let values=[2,4,3,4,4,5,5,5]
        let tiles=values.enumerated().map{NativeTile(id:"six-stall-\($0.offset)",cell:.init(column:$0.offset%5,row:$0.offset/5),value:$0.element)}
        let fixture=try Fixture(state:.init(tiles:tiles,mode:.arcade,board:4,stage:4,generation:19,moves:22,score:9900,wildMeter:0.5),random:{0.9})
        defer{fixture.dispose()};let(game,scene)=try await enter(fixture)
        let geometry=try XCTUnwrap(scene.boardGeometry),start=geometry.center(row:0,column:0),end=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:start));scene.moveDrag(to:end,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:end,now:CACurrentMediaTime())).accepted)
        try await wait("six settles"){game.engine.pendingOrdinarySix==nil && game.engine.pendingOrdinarySpawns.isEmpty}
        if game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil {
            try await awaitNoMovesResultWithoutTextRevival(game);return
        }
        let physical=try XCTUnwrap(game.engine.sourceNoMovesRuntimeAuthority?.capture())
        XCTAssertEqual(physical.freshResult.kind,.fail,"Actual seeded replacement board must have no legal contacts: \(game.engine.state.tiles)")
        do {try await wait("six automatic no moves"){game.engine.pendingSourceNoMoves != nil || game.engine.completedSourceNoMovesReceipt != nil}}
        catch {XCTFail(scene.sourceLevelEndDiagnostic());throw error}
        try await awaitNoMovesResultWithoutTextRevival(game)
    }
    private func persistedGameplayMatches(_ fixture:Fixture,_ engine:NativeGameplayEngine)->Bool {
        guard let saved=try? fixture.store.load()?.arcadeRun else{return false}
        return saved.moves==engine.state.moves && saved.score==engine.state.score &&
            saved.tiles.map { "\($0.id):\($0.value):\($0.cell.column):\($0.cell.row)" }.sorted()==engine.state.tiles.map { "\($0.id):\($0.value):\($0.cell.column):\($0.cell.row)" }.sorted()
    }
    private func drop(_ scene:NativeBoardScene)throws {
        let geometry=try XCTUnwrap(scene.boardGeometry),source=geometry.center(row:0,column:0),destination=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:source));scene.moveDrag(to:destination,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:destination,now:CACurrentMediaTime())).accepted)
    }
    private func awaitNoMovesResultWithoutTextRevival(_ game:NativeGameplayViewController)async throws {
        var observed:NativeNoMovesSourcePresentation?,textRemoved=false
        let resultDeadline=Date().addingTimeInterval(40)
        while !(game.presentedViewController is NativeResultController),Date()<resultDeadline {
            let overlays=game.view.subviews.compactMap{$0 as? NativeNoMovesSourcePresentation}
            XCTAssertLessThanOrEqual(overlays.count,1,"One actual NO MOVES presentation owns this fail flow")
            if let overlay=overlays.first {
                XCTAssertFalse(textRemoved,"Text cannot remount between clear and result")
                if let observed {XCTAssertTrue(observed === overlay,"No replacement text after exit begins")}
                else {observed=overlay}
            } else if observed != nil {textRemoved=true}
            try await Task.sleep(for:.milliseconds(16))
        }
        XCTAssertTrue(game.presentedViewController is NativeResultController)
        XCTAssertNotNil(observed);XCTAssertTrue(textRemoved)
        XCTAssertTrue(observed?.disposed==true);XCTAssertNil(observed?.superview)
    }
    func testActualCompleteRootLevelEndTimeoutCannotRemountTextDuringBoardExitAndResult()async throws {
        let fixture=try Fixture(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:4),.init(id:"d",cell:.init(column:1,row:0),value:3)],mode:.arcade,generation:25,moves:7,wildMeter:0))
        defer {fixture.dispose()}
        let (game,scene)=try await enter(fixture)
        scene.evaluate()
        try await wait("level-end-candidate"){game.engine.pendingSourceNoMoves?.trigger == .levelEnd}
        XCTAssertEqual(game.engine.pendingSourceNoMoves?.trigger.exitTimeoutMilliseconds,700)
        try await awaitNoMovesResultWithoutTextRevival(game)
        XCTAssertTrue(game.engine.completedSourceNoMovesReceipt?.boardExitCompleted==true)
    }
    func testActualCompleteRootLastTwoDeadEndReachesOriginalNoMovesRealResultAndPersistedAttempt()async throws {
        let fixture=try Fixture(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:2),.init(id:"d",cell:.init(column:1,row:0),value:3)],mode:.arcade,generation:19,moves:7,score:123,wildMeter:0))
        defer{fixture.dispose()};let (game,scene)=try await enter(fixture);try drop(scene)
        try await wait("last-two-candidate"){game.engine.pendingSourceNoMoves?.trigger == .lastTwoRegular}
        XCTAssertEqual(game.engine.state.moves,7,"Source dead-end caller returns before debit")
        XCTAssertEqual(game.engine.pendingSourceNoMovesCallerReceipts.first?.kind,.lastTwoRegular)
        try await awaitNoMovesResultWithoutTextRevival(game)
        XCTAssertEqual(game.engine.completedSourceNoMovesReceipt?.resolution.kind,.fail)
        XCTAssertTrue(game.engine.completedSourceNoMovesReceipt?.boardExitCompleted==true)
        XCTAssertTrue(game.view.subviews.filter{$0.accessibilityIdentifier=="native.no-moves.source-graph"}.isEmpty)
        let persisted=try XCTUnwrap(fixture.store.load());XCTAssertNil(persisted.arcadeRun)
        XCTAssertGreaterThanOrEqual(persisted.progression.arcadeStats.highScore,game.engine.state.score)
        let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
        func exitButton(_ view:UIView)->UIButton? {
            if let button=view as? UIButton,button.accessibilityIdentifier=="native.result.exit" {return button}
            return view.subviews.compactMap{exitButton($0)}.first
        }
        let exit=try XCTUnwrap(exitButton(result.view)),oldScope=game.sourceScope
        try await wait("genuine-result-exit-ready"){exit.isUserInteractionEnabled}
        exit.sendActions(for:.touchUpInside)
        try await wait("genuine-result-home-return"){fixture.game==nil && fixture.app.route == .home && !fixture.app.home.isHidden}
        XCTAssertFalse(oldScope?.current==true,"Exited gameplay retires its actual Source Scope")
        let afterExit=try XCTUnwrap(fixture.store.load())
        XCTAssertEqual(afterExit.progression,persisted.progression)
        XCTAssertEqual(afterExit.settings,persisted.settings)
        XCTAssertEqual(afterExit.arcadeRun,persisted.arcadeRun)
        XCTAssertEqual(afterExit.pendingArcadeRound,persisted.pendingArcadeRound)
    }
    func testActualCompleteRootLastTwoSelfDeadEndUsesSeparateGenuineCaller()async throws {
        let fixture=try Fixture(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:2)],mode:.arcade,generation:20,moves:7,wildMeter:0))
        defer{fixture.dispose()};let (game,scene)=try await enter(fixture);try drop(scene)
        try await wait("last-two-self-candidate"){game.engine.pendingSourceNoMoves?.trigger == .lastTwoSelf}
        XCTAssertEqual(game.engine.pendingSourceNoMovesCallerReceipts.first?.kind,.lastTwoSelf)
        XCTAssertEqual(game.engine.state.moves,7)
        try await wait("self-result"){game.presentedViewController is NativeResultController}
        XCTAssertNotNil(game.engine.completedSourceNoMovesReceipt)
    }
    func testActualCompleteRootZeroDebitRunsDepletedCallerAndRetainsLegalContinuation()async throws {
        let fixture=try Fixture(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"other",cell:.init(column:2,row:0),value:1)],mode:.arcade,generation:21,moves:1,wildMeter:0))
        defer{fixture.dispose()};let (game,scene)=try await enter(fixture);try drop(scene)
        try await wait("genuine-zero-debit"){game.engine.pendingSourceNoMovesCallerReceipts.contains{$0.kind == .ordinaryMovesDepleted}}
        XCTAssertEqual(game.engine.state.moves,0)
        try await wait("depleted-return-save"){game.engine.pendingSourceNoMovesCallerReceipts.isEmpty && game.engine.pendingOrdinaryPostchecks.isEmpty && self.persistedGameplayMatches(fixture,game.engine)}
        XCTAssertNil(game.engine.pendingSourceNoMoves);XCTAssertNil(game.engine.state.terminal)
        XCTAssertEqual(game.engine.sourceNoMovesRuntimeAuthority?.capture()?.freshResult.kind,.continue)
    }
    func testActualCompleteRootCompletedTutorialAssistAwaitsComplementPresentationAndCanonicalSave()async throws {
        var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true
        let fixture=try Fixture(state:.init(tiles:[.init(id:"only",cell:.init(column:0,row:0),value:5)],mode:.arcade,generation:22,moves:4,wildMeter:0,tutorial:tutorial))
        defer{fixture.dispose()};let (game,scene)=try await enter(fixture)
        XCTAssertEqual(game.engine.state.tutorial?.completionAssist,true,"Actual resumed tutorial owner must retain completion assist before repair")
        scene.evaluate()
        do {try await wait("actual-tutorial-complement-save"){game.engine.state.tutorial?.finalChanceSpawnCount==1 && game.engine.state.tiles.filter{!$0.locked && $0.value>0}.count==2 && self.persistedGameplayMatches(fixture,game.engine)}} catch {
            XCTFail("Actual tutorial repair timeout: state=\(game.engine.state);saved=\(String(describing:try? fixture.store.load()?.arcadeRun));\(scene.sourceLevelEndDiagnostic())")
            return
        }
        XCTAssertEqual(game.engine.state.tiles.filter{!$0.locked}.map(\.value).sorted(),[1,5])
        XCTAssertEqual(game.engine.state.moves,4);XCTAssertNil(game.engine.pendingSourceNoMoves);XCTAssertNil(game.engine.state.terminal)
        XCTAssertEqual(game.engine.state.tutorial?.completionAssist,true)
    }
}
