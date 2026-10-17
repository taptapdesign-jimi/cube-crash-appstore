import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeStandaloneRootTests:XCTestCase {
    func testCompleteNativeLastOrdinaryStackToFourDropsEarnedWildAndKeepsExitAvailable() async throws {
        try await exerciseLastFourMeterReward()
    }
    func testCompleteNativeRestoresCapturedFullMeterFourWithoutLosingScore() async throws {
        let state=try JSONDecoder().decode(NativeBoardState.self,from:Data(#"{  "tiles": [    {      "id": "native:1:32:4:5:die:20",      "cell": {        "column": 4,        "row": 5      },      "value": 0,      "stackDepth": 1,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": true,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 0.2    },    {      "id": "native:1:32:2:7:die:21",      "cell": {        "column": 2,        "row": 7      },      "value": 0,      "stackDepth": 1,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": true,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 0.2    },    {      "id": "native:1:32:2:2:die:22",      "cell": {        "column": 2,        "row": 2      },      "value": 0,      "stackDepth": 1,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": true,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 0.2    },    {      "id": "native:1:32:1:7:die:23",      "cell": {        "column": 1,        "row": 7      },      "value": 0,      "stackDepth": 1,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": true,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 0.2    },    {      "id": "native:1:32:3:8:die:24",      "cell": {        "column": 3,        "row": 8      },      "value": 0,      "stackDepth": 1,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": true,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 0.2    },    {      "id": "native:1:32:3:7:die:25",      "cell": {        "column": 3,        "row": 7      },      "value": 0,      "stackDepth": 1,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": true,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 0.2    },    {      "id": "native:1:32:0:2:die:19",      "cell": {        "column": 0,        "row": 2      },      "value": 4,      "stackDepth": 2,      "starOrbitCount": 3,      "sourceResidualWildPresence": false,      "sourceWildStateCleared": false,      "locked": false,      "visible": true,      "pendingRemoval": false,      "transientSpawn": false,      "magnetOwned": false,      "resolutionOwned": false,      "merge6CleanupOwned": false,      "nonFinalMerge6": false,      "alpha": 1.0    }  ],  "mode": "arcade_home",  "columns": 5,  "rows": 9,  "board": 1,  "stage": 1,  "generation": 1,  "revision": 33,  "moves": 18,  "maxMoves": 50,  "score": 4672,  "starsCount": 0,  "bestScore": 4672,  "maxStackDepth": 3,  "longestCombo": 29,  "cubesCracked": 24,  "combo": 3,  "earnedComboBonus": 10675,  "wildSpawnCount": 4,  "wildDropTypeStreak": 1,  "rngState": 1,  "wildMeter": 1.151999999999999,  "lastWildDropType": "wild"}"#.utf8))
        try await exerciseLastFourMeterReward(captured:state)
    }
    private func exerciseLastFourMeterReward(captured:NativeBoardState?=nil) async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-meter-four-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        var tiles=[NativeTile(id:"two-a",cell:.init(column:0,row:2),value:2),NativeTile(id:"two-b",cell:.init(column:1,row:2),value:2)]
        for (index,cell) in [NativeCell(column:4,row:5),.init(column:2,row:7),.init(column:2,row:2),.init(column:1,row:7),.init(column:3,row:8),.init(column:3,row:7)].enumerated() {
            tiles.append(.init(id:"locked-\(index)",cell:cell,value:0,locked:true))
        }
        envelope.arcadeRun = captured ?? .init(tiles:tiles,mode:.arcade,board:1,generation:1,moves:19,wildMeter:0.99,wildSpawnCount:4)
        try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded()
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ label:String,_ predicate:()->Bool) async throws {
            let deadline=Date().addingTimeInterval(20)
            while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait("Home ready"){!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait("Gameplay ready"){app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        if captured==nil {
        let a=try XCTUnwrap(scene.sourceNativeTileNode("two-a")),b=try XCTUnwrap(scene.sourceNativeTileNode("two-b"))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime());XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        }
        try await wait("Earned Wild must finish instead of orphaning a full meter") {game.engine.state.wildSpawnCount==5 && game.engine.pendingMeterOpen==nil && !game.engine.hasUnsavableSourceGameplayState}
        XCTAssertTrue(game.engine.state.tiles.contains{$0.value==4 && !$0.isWild})
        XCTAssertTrue(game.engine.state.tiles.contains(where:\.isWild));XCTAssertLessThan(game.engine.state.wildMeter,1)
        XCTAssertNil(game.engine.state.terminal);XCTAssertFalse(game.engine.navigationLocked)
        XCTAssertNil(game.sourcePresentationFailure)
        if let captured {XCTAssertEqual(game.engine.state.score,captured.score);XCTAssertEqual(game.engine.state.moves,captured.moves)}
        game.onExit?()
        try await wait("Exit menu opens after earned Wild"){game.presentedViewController is JimiNativeEndRunModal}
    }
    @MainActor private final class RetiredRound {
        weak var controller:NativeGameplayViewController?
        weak var scene:NativeBoardScene?
        init(_ controller:NativeGameplayViewController) {self.controller=controller;scene=controller.boardScene}
    }
    func testCompleteNativeRepeatedResetReleasesOutgoingRoundsAndSettlesSharedResources()async throws {
        try await exerciseCompleteRoundRetirement(playAgainFirst:false)
    }
    func testCompleteNativeActualFailPlayAgainThenRepeatedResetReleasesOutgoingRounds()async throws {
        try await exerciseCompleteRoundRetirement(playAgainFirst:true)
    }
    private func exerciseCompleteRoundRetirement(playAgainFirst:Bool)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-round-retirement-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        if playAgainFirst {
            envelope.arcadeRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),
                .init(id:"b",cell:.init(column:1,row:0),value:2),
                .init(id:"c",cell:.init(column:2,row:0),value:5)],mode:.arcade,board:1,generation:9,moves:1)
        }
        try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded()
        let app=try XCTUnwrap(host.children.first as? NativeAppController),runtime=try XCTUnwrap(host.sourceRuntime)
        func wait(_ label:String,_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(40)
            while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
        }
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        func ready()->Bool {
            guard let game=game(),let scene=game.boardScene else{return false}
            return scene.isBoardEntryComplete && game.beforeSourceGameplayAdmission==nil &&
                !game.engine.hasUnsavableSourceGameplayState && scene.sourceFrameSnapshot.activityLeaseCount==0 &&
                runtime.fifo.pendingCount==0 && runtime.service.pendingSourceAnimationFrameCount==0
        }
        func resources()->[Int] {[runtime.service.activeParticipantCount,runtime.service.sourceTickerListenerCount,
            runtime.service.pendingSourceAnimationFrameCount,runtime.service.directManipulationTransportCount,runtime.fifo.pendingCount]}
        func button(_ view:UIView,_ id:String)->UIButton? {
            if let button=view as? UIButton,button.accessibilityIdentifier==id{return button}
            return view.subviews.lazy.compactMap{button($0,id)}.first
        }
        func reset()->RetiredRound? {
            guard let current=game() else{return nil}
            let retired=RetiredRound(current);current.onExit?();return retired
        }
        try await wait("Home ready"){!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait("Initial complete gameplay settled",ready)
        if playAgainFirst {
            // Genuine accepted contact exhausts moves; no synthetic terminal or receipt.
            let retired:RetiredRound = try {
                let current=try XCTUnwrap(game()),scene=try XCTUnwrap(current.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
                let captured=RetiredRound(current),a=geometry.center(row:0,column:0),b=geometry.center(row:0,column:1)
                XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b,now:CACurrentMediaTime())
                XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:CACurrentMediaTime())).accepted)
                return captured
            }()
            try await wait("Genuine Source fail result"){
                game()?.engine.completedSourceNoMovesReceipt != nil && game()?.presentedViewController is NativeResultController
            }
            try await wait("Play Again CTA"){
                guard let current=game(),let modal=current.presentedViewController,
                      let primary=button(modal.view,"native.result.play-again"),primary.isUserInteractionEnabled else{return false}
                primary.sendActions(for:.touchUpInside);return true
            }
            try await wait("Play Again retires controller and scene"){retired.controller==nil && retired.scene==nil && ready()}
        }
        let baseline=resources()
        var retired:[RetiredRound]=[]
        for index in 0..<6 {
            let old=try XCTUnwrap(reset());retired.append(old)
            try await wait("Reset modal admitted"){
                guard let modal=game()?.presentedViewController as? JimiNativeEndRunModal,
                      modal.view.isUserInteractionEnabled else{return false}
                modal.buttons[0].sendActions(for:.touchUpInside);return true
            }
            try await wait("Round \(index) deallocated and resources settled"){
                retired.allSatisfy{$0.controller==nil && $0.scene==nil} && ready() && resources()==baseline
            }
            XCTAssertEqual(app.children.filter{$0 is NativeGameplayViewController}.count,1)
            XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game()?.sourceScope?.current==true)
            let expectedMoves:Int = try {
                let current=try XCTUnwrap(game()),scene=try XCTUnwrap(current.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
                let tiles=current.engine.state.activeTiles.filter{!$0.isWild && !$0.locked}
                let pair=try XCTUnwrap(tiles.enumerated().flatMap{i,a in
                    tiles.dropFirst(i+1).filter{a.value+$0.value<6}.map{(a,$0)}
                }.first)
                let a=geometry.center(row:pair.0.cell.row,column:pair.0.cell.column)
                let b=geometry.center(row:pair.1.cell.row,column:pair.1.cell.column)
                let moves=current.engine.state.moves
                XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b,now:CACurrentMediaTime())
                XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:CACurrentMediaTime())).accepted)
                return moves-1
            }()
            try await wait("Replacement accepts and settles actual contact"){ready() && game()?.engine.state.moves==expectedMoves}
        }
        host.dispose()
        try await wait("Whole host releases all shared work"){
            resources()==[0,0,0,0,0] && !runtime.service.hasActiveClock
        }
    }
    func testSourceNormalRestartFromActualExitModalCreatesFreshSceneAndRetiresOldScope()async throws {
        try await runSourceGenerationReplacement(restart:true)
    }
    func testSourceFinalOrdinaryMergeContinuesArcadeThroughActualResultIntoFreshScene()async throws {
        try await runSourceGenerationReplacement(restart:false)
    }
    func testSourceFinalJourneyMergeCollectsRewardAndContinuesIntoFreshScene()async throws {
        try await runSourceGenerationReplacement(restart:false,journey:true)
    }
    private func runSourceGenerationReplacement(restart:Bool,journey:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-generation-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        let seededRun=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3),
            .init(id:"b",cell:.init(column:1,row:0),value:restart ? 2:3)],mode:journey ? .journey:.arcade,
            board:restart ? 2:1,stage:restart ? 2:1,generation:9,moves:37,score:123,wildMeter:0.25)
        if journey {seed.journeyRuns[1]=seededRun}else {seed.arcadeRun=seededRun}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true,
            sourceFreshOrdinaryEnabled:true,sourceOrdinaryResumeEnabled:true)
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previousWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(40)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeSourceGeneration",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden}
        if journey {
            app.navigate(.world(1),interrupt:true)
            try await wait{
                if app.children.contains(where:{$0 is NativeGameplayViewController}) {return true}
                app.world?.onRequest?("continue",1);return false
            }
        } else {app.navigate(.gameplay,interrupt:true)}
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let old=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let oldScene=try XCTUnwrap(old.boardScene),oldScope=try XCTUnwrap(old.sourceScope)
        let oldNode=try XCTUnwrap(oldScene.sourceNativeTileNode("a"))
        let nextGeneration=old.engine.state.generation+1 // restore itself retires the saved generation
        if restart {
            old.onExit?()
            try await wait{old.presentedViewController is JimiNativeEndRunModal}
            let modal=try XCTUnwrap(old.presentedViewController as? JimiNativeEndRunModal)
            try await wait{modal.view.isUserInteractionEnabled}
            modal.buttons[0].sendActions(for:.touchUpInside)
        } else {
            let geometry=try XCTUnwrap(oldScene.boardGeometry)
            let source=geometry.center(row:0,column:0),target=geometry.center(row:0,column:1)
            XCTAssertTrue(oldScene.beginDrag(at:source));oldScene.moveDrag(to:target,now:CACurrentMediaTime())
            XCTAssertTrue(try XCTUnwrap(oldScene.finishDrag(at:target,now:CACurrentMediaTime())).accepted)
        }
        if journey {
            try await wait{old.visibleJourneyRewardController != nil}
            let reward=try XCTUnwrap(old.visibleJourneyRewardController)
            try await wait{(try? store.load()?.progression.completedJourneyBoards.contains(reward.board)) == true}
            reward.activate();reward.activate() // real tap handler queues collect during reveal
            try await wait{old.presentedViewController is NativeResultController}
            let result=try XCTUnwrap(old.presentedViewController as? NativeResultController)
            func primary(_ view:UIView)->UIButton? {
                if let button=view as? UIButton,button.accessibilityIdentifier=="native.result.play-again" {return button}
                return view.subviews.compactMap{primary($0)}.first
            }
            let button=try XCTUnwrap(primary(result.view))
            try await wait{button.isUserInteractionEnabled};button.sendActions(for:.touchUpInside)
        }
        var observedSourceTransition=false
        var observedThemedAnnouncement=false
        var transitionObservations:[String]=[]
        try await wait{
            guard let current=app.children.compactMap({$0 as? NativeGameplayViewController}).first(where:{$0 !== old}) else{return false}
            let observation="generation=\(current.engine.state.generation) current=\(current.sourceScope?.current ?? false) flag=\(String(describing:current.sourceScope?.captureSourceBoardTransitionActive())) children=\(current.children.map{String(describing:type(of:$0))}) pendingEntry=\(current.beforeInitialBoardEntry != nil) completedEntry=\(current.boardScene?.completedSourceBoardEntry != nil) sourceConstructor=\(current.sourceInitialConstruction != nil)"
            if transitionObservations.last != observation,transitionObservations.count<24 {transitionObservations.append(observation)}
            if journey {
                observedThemedAnnouncement = observedThemedAnnouncement || current.children.contains(where:{$0 is NativeThemedBoardTransitionController})
                observedSourceTransition = observedSourceTransition || current.sourceScope?.captureSourceBoardTransitionActive()==true
            }
            return current.boardScene?.completedSourceBoardEntry != nil
        }
        if journey {let receipt=XCTAttachment(string:transitionObservations.joined(separator:"\n"));receipt.lifetime = .keepAlways;add(receipt)}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
        XCTAssertFalse(oldScope.current);XCTAssertFalse(oldNode.sourceContactNodeAlive)
        XCTAssertNil(old.parent);XCTAssertNil(old.boardScene)
        XCTAssertTrue(scope.current);XCTAssertTrue(scope.service === oldScope.service,"One app transport survives the new Scene generation")
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(app.home.isHidden)
        XCTAssertEqual(game.engine.state.generation,nextGeneration);XCTAssertEqual(game.engine.state.board,restart ? 1:2)
        XCTAssertEqual(game.engine.state.moves,50);XCTAssertEqual(game.engine.state.wildMeter,restart || journey ? 0:0.25)
        if restart {XCTAssertEqual(game.engine.state.score,0)}else {
            XCTAssertGreaterThan(game.engine.state.score,123)
            if !journey {XCTAssertEqual(game.engine.state.score,old.engine.state.score)}
        }
        XCTAssertEqual(game.sourceInitialBoardSaveAccepted,!journey);XCTAssertTrue(scene.sourceRegularIdleAdmissionOpen)
        XCTAssertTrue(try XCTUnwrap(scene.captureSourcePhysicalBoard()).isStillCurrent())
        XCTAssertFalse(app.replaceGameplay(old,with:game),"Stale previous VC cannot replace or dispose the current board")
        XCTAssertTrue(scope.current)
        XCTAssertEqual(scope.captureSourceBoardTransitionActive(),false)
        if journey {
            XCTAssertFalse(observedThemedAnnouncement,"Accepted Journey Play Again continues directly under first-frame coverage without another announcement")
            XCTAssertFalse(observedSourceTransition,"Direct Journey continuation must not acquire an announcement transition flag")
        }
        let saved=try XCTUnwrap(store.load())
        let savedRun=journey ? saved.journeyRuns[2]:saved.arcadeRun
        XCTAssertEqual(savedRun?.generation,nextGeneration);XCTAssertEqual(savedRun?.board,game.engine.state.board)
        if journey {XCTAssertEqual(game.engine.state.score,saved.progression.boardStats[1]?.highScore)}
        XCTAssertNil(saved.pendingArcadeRound);XCTAssertTrue(saved.progression.firstPlayTutorialComplete)
        let candidates=game.engine.state.tiles.filter{!$0.locked && !$0.isWild && $0.value>0}
        let pair=try XCTUnwrap(candidates.enumerated().flatMap{i,a in candidates.dropFirst(i+1).filter{a.value+$0.value<6}.map{(a,$0)}}.first)
        let destination=try XCTUnwrap(scene.sourceNativeTileNode(pair.1.id)),geometry=try XCTUnwrap(scene.boardGeometry)
        let a=geometry.center(row:pair.0.cell.row,column:pair.0.cell.column),b=geometry.center(row:pair.1.cell.row,column:pair.1.cell.column)
        let moves=game.engine.state.moves
        XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.state.moves==moves-1 && game.engine.pendingOrdinaryStack==nil && !game.engine.hasPendingSourceOrdinaryStackFace}
        XCTAssertTrue(scene.sourceNativeTileNode(pair.1.id) === destination)
        XCTAssertTrue(try XCTUnwrap(scene.captureSourcePhysicalBoard()).isStillCurrent())
    }
    func testPendingArcadeRoundUsesFreshSourceOwnersAndWaveWithResumeAlsoEnabled()async throws {
        try await runPendingArcadeEntry(rejectPaint:false)
    }
    func testRejectedPreparedArcadePaintKeepsPendingContinuationAndPreviousRun()async throws {
        try await runPendingArcadeEntry(rejectPaint:true)
    }
    private func runPendingArcadeEntry(rejectPaint:Bool)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-next-round-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun=NativeBoardFactory.make(mode:.arcade,board:1,columns:5,generation:9,seed:7)
        seed.pendingArcadeRound = .init(round:2,score:321,ownerID:"accepted-round-one")
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true,
            sourceFreshOrdinaryEnabled:true,sourceOrdinaryResumeEnabled:true)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeSourceNextRound",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first != nil}
        let entering=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let preparedSave=try XCTUnwrap(entering.beforeSourceInitialBoardReveal)
        var entrySaveCalls=0
        entering.beforeSourceInitialBoardReveal={
            entrySaveCalls += 1
            XCTAssertNil(entering.boardScene?.completedSourceBoardEntry)
            XCTAssertEqual(try? store.load()?.pendingArcadeRound?.round,2,
                           "Construction alone must not consume the durable pending continuation")
            XCTAssertEqual(try? store.load()?.arcadeRun?.board,1,
                           "Native lifecycle flush retains the old run until the prepared-entry receipt writes")
            XCTAssertTrue(entering.boardScene?.captureSourcePhysicalBoard()?.observedState.tiles.allSatisfy{!$0.visible} == true,
                          "The actual constructor holders are still hidden before the Source wave")
            if rejectPaint,let tile=entering.engine.state.tiles.first(where:{!$0.locked && $0.value>0}) {
                entering.boardScene?.sourceNativeTileNode(tile.id)?.sourceAlpha=0
            }
            let accepted=preparedSave()
            if rejectPaint {
                XCTAssertFalse(accepted)
                XCTAssertEqual(try? store.load()?.pendingArcadeRound,seed.pendingArcadeRound)
                XCTAssertEqual(try? store.load()?.arcadeRun,seed.arcadeRun)
                return accepted
            }
            XCTAssertEqual(try? store.load()?.arcadeRun?.board,2)
            XCTAssertEqual(try? store.load()?.arcadeRun?.score,321)
            return accepted
        }
        if rejectPaint {
            try await wait{entering.parent==nil && app.route == .home}
            XCTAssertEqual(entrySaveCalls,1);XCTAssertFalse(entering.sourceInitialBoardSaveAccepted)
            let saved=try XCTUnwrap(store.load())
            XCTAssertEqual(saved.pendingArcadeRound,seed.pendingArcadeRound)
            XCTAssertEqual(saved.arcadeRun,seed.arcadeRun)
            return
        }
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.completedSourceBoardEntry != nil}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertTrue(game.sourceBoardEntryEnabled,"A newly constructed pending round must not take the restore entry")
        XCTAssertTrue(game.sourceInitialBoardSaveAccepted,"The genuine fresh-entry save must precede the Source wave")
        XCTAssertEqual(entrySaveCalls,1)
        XCTAssertTrue(game.sourceOrdinaryPresentationEnabled);XCTAssertTrue(game.sourceDirectPresentationEnabled)
        XCTAssertTrue(scene.sourceRegularIdleAdmissionOpen);XCTAssertTrue(scene.sourceEndgameMutationLedgerAdmissionOpen)
        XCTAssertEqual(game.engine.state.board,2);XCTAssertEqual(game.engine.state.score,321)
        XCTAssertEqual(game.engine.state.generation,10);XCTAssertEqual(game.engine.state.wildMeter,0.25)
        XCTAssertNil(game.engine.state.tutorial)
        XCTAssertTrue(try XCTUnwrap(scene.captureSourcePhysicalBoard()).isStillCurrent())
        let saved=try XCTUnwrap(store.load())
        XCTAssertNil(saved.pendingArcadeRound);XCTAssertEqual(saved.arcadeRun?.board,2)
        XCTAssertEqual(saved.arcadeRun?.score,321)
    }
    func testRootSourceDirectEveryPointerTargetAfterOSGuideEarningMoves()async throws {
        try await runRootGuidedDrags(ordinary:true,direct:true,osEarning:true)
    }
    func testExplicitFreshOrdinaryRootRunsNormalArcadeOutsideTutorialWithSameSourceHolders()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-fresh-ordinary-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true,sourceFreshOrdinaryEnabled:true)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeFreshOrdinary",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.completedSourceBoardEntry != nil}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertNil(game.engine.state.tutorial);XCTAssertFalse(game.sourceTutorialActivationEnabled)
        XCTAssertTrue(game.sourceInitialBoardSaveAccepted)
        XCTAssertTrue(game.sourceOrdinaryPresentationEnabled);XCTAssertTrue(game.sourceDirectPresentationEnabled)
        XCTAssertTrue(scene.sourceEndgameMutationLedgerAdmissionOpen)
        let board=try XCTUnwrap(scene.captureSourcePhysicalBoard());XCTAssertTrue(board.isStillCurrent())
        XCTAssertEqual(board.tiles.count,game.engine.state.tiles.count)
        let runtime=try XCTUnwrap(scene.captureSourceGameplayRuntime(isWild:false))
        XCTAssertEqual(runtime.observedState.tiles.count,game.engine.state.tiles.count)
        XCTAssertTrue(try XCTUnwrap(game.sourceScope).registries.missing([.sourceTileLifecycle,.sourceSpawnMarkers]).isEmpty)
        XCTAssertTrue(runtime.missingOwners.contains("terminalNoMovesInput"))
        XCTAssertTrue(runtime.missingOwners.contains("source-global-owner-bindings"))
        XCTAssertNil(runtime.meterEnvironment,"Unknown global writers must never become false")
        XCTAssertEqual(runtime.observedGlobalOwners?.boardMeterEnabled,true)
        XCTAssertEqual(runtime.observedGlobalOwners?.boardSpawnEnabled,true)
        XCTAssertNil(runtime.observedGlobalOwners?.queueInProgress,"No Source queue is installed on this actual fresh root")
        XCTAssertTrue(runtime.missingOwners.contains("source-queue-in-progress"))
        XCTAssertFalse(runtime.missingOwners.contains("source-board-transition"))
        XCTAssertEqual(runtime.observedGlobalOwners?.boardTransitionActive,false)

        XCTAssertTrue(game.sourceRegularIdlePresentationEnabled);XCTAssertTrue(scene.sourceRegularIdleAdmissionOpen)
        let beforeIdle=game.engine.state
        try await wait{game.engine.state.tiles.contains{scene.sourceNativeTileNode($0.id)?.sourceActiveIdle==true}}
        XCTAssertEqual(game.engine.state,beforeIdle,"Actual idle does not mutate gameplay or serialized RNG")
        let idleTile=try XCTUnwrap(game.engine.state.tiles.first{scene.sourceNativeTileNode($0.id)?.sourceActiveIdle==true})
        let idleNode=try XCTUnwrap(scene.sourceNativeTileNode(idleTile.id)),idleGeometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertTrue(scene.beginDrag(at:idleGeometry.center(row:idleTile.cell.row,column:idleTile.cell.column)))
        XCTAssertFalse(idleNode.sourceActiveIdle,"Actual accepted pointer cancels the retained idle receipt before pickup")
        scene.cancelDrag()
        try await wait{idleNode.sourceOuterReceipt==nil}
        scene.stopSourceRegularIdle()
        XCTAssertFalse(game.engine.state.tiles.contains{scene.sourceNativeTileNode($0.id)?.sourceActiveIdle==true})
        XCTAssertTrue(scene.restartSourceRegularIdle())
        let candidates=game.engine.state.tiles.filter{!$0.locked && !$0.isWild && $0.value>0}
        let pair=try XCTUnwrap(candidates.enumerated().flatMap{i,a in candidates.dropFirst(i+1).filter{a.value+$0.value<6}.map{(a,$0)}}.first)
        let source=try XCTUnwrap(scene.sourceNativeTileNode(pair.0.id)),target=try XCTUnwrap(scene.sourceNativeTileNode(pair.1.id))
        let geometry=try XCTUnwrap(scene.boardGeometry),a=geometry.center(row:pair.0.cell.row,column:pair.0.cell.column),b=geometry.center(row:pair.1.cell.row,column:pair.1.cell.column)
        let before=game.engine.state
        XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b,now:CACurrentMediaTime())
        XCTAssertEqual(source.sourceGridCell,pair.0.cell)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.state.moves==before.moves-1 && game.engine.pendingOrdinaryStack==nil && !game.engine.hasPendingSourceOrdinaryStackFace}
        XCTAssertTrue(scene.sourceNativeTileNode(pair.1.id) === target)
        XCTAssertEqual(target.sourceValue,pair.0.value+pair.1.value);XCTAssertEqual(game.engine.state.moves,before.moves-1)
        XCTAssertTrue(try XCTUnwrap(scene.captureSourcePhysicalBoard()).isStillCurrent())
        XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
        let exit=expectation(description:"Actual board exit completes after idle retirement")
        scene.animateExit{completed in XCTAssertTrue(completed);exit.fulfill()}
        XCTAssertFalse(scene.restartSourceRegularIdle(),"Exit cannot restart decorative idle on the exiting surface")
        XCTAssertFalse(game.engine.state.tiles.contains{scene.sourceNativeTileNode($0.id)?.sourceActiveIdle==true})
        await fulfillment(of:[exit],timeout:3)
    }
    func testRootSourceDirectEarnedStarUsesActualHUDAndSpecialOwners()async throws {
        try await runRootGuidedDrags(ordinary:true,direct:true)
    }
    func testExplicitOrdinaryResumeRootRestoresSavedRegularAndStarWithoutTutorialOrNewRound()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-resume-app-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),
            .init(id:"b",cell:.init(column:1,row:0),value:2),
            .init(id:"star",cell:.init(column:2,row:0),value:6,archetype:.star)],mode:.arcade,moves:37,score:123,wildMeter:0.4)
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true,sourceOrdinaryResumeEnabled:true)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeSourceResumeApp",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{
            guard let game=app.children.compactMap({$0 as? NativeGameplayViewController}).first,let scene=game.boardScene else{return false}
            return scene.boardGeometry != nil && scene.isBoardEntryComplete && scene.sourceSpecialIdleAdmissionOpen && !scene.isHUDRevealPending && scene.sourceNativeTileNode("star")?.sourceEventMode=="static"
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertNil(game.engine.state.tutorial);XCTAssertFalse(game.sourceTutorialActivationEnabled)
        XCTAssertTrue(game.sourceOrdinaryPresentationEnabled);XCTAssertTrue(game.sourceDirectPresentationEnabled)
        XCTAssertFalse(game.sourceBoardEntryEnabled,"Resume retains its separate entry owner")
        XCTAssertFalse(game.sourceInitialBoardSaveAccepted,"Restored state cannot borrow the fresh Arcade bypass")
        XCTAssertEqual(game.engine.state.moves,37);XCTAssertEqual(game.engine.state.score,123);XCTAssertEqual(game.engine.state.wildMeter,0.4)
        XCTAssertEqual(Set(game.engine.state.tiles.map(\.id)),Set(["a","b","star"]))
        let restoredStar=try XCTUnwrap(scene.sourceNativeTileNode("star"))
        XCTAssertEqual(scene.sourceWildDropTileMarkers(restoredStar),.init(dropping:false,handoffLocked:false))
        let savedStarMarkers=try XCTUnwrap(scene.captureSourceSaveTileMarkers(id:"star"))
        XCTAssertFalse(savedStarMarkers.wildSpawnDropping);XCTAssertFalse(savedStarMarkers.wildSpawnHandoffLock)
        let restoredRuntime=try XCTUnwrap(scene.captureSourceGameplayRuntime(isWild:true))
        XCTAssertEqual(restoredRuntime.observedState.tiles.count,3)
        XCTAssertFalse(restoredRuntime.missingOwners.contains(where:{$0.hasPrefix("source-tile-marker-owner:")}))
        XCTAssertNil(restoredRuntime.meterEnvironment)

        XCTAssertTrue(try XCTUnwrap(scene.captureSourcePhysicalBoard()).isStillCurrent())
        let source=try XCTUnwrap(scene.sourceNativeTileNode("a")),target=try XCTUnwrap(scene.sourceNativeTileNode("b")),geometry=try XCTUnwrap(scene.boardGeometry)
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.state.moves==36 && !game.engine.hasPendingSourceOrdinaryStackFace}
        XCTAssertTrue(scene.sourceNativeTileNode("b") === target);XCTAssertFalse(source.sourceContactNodeAlive)
        XCTAssertEqual(target.sourceValue,3);XCTAssertEqual(game.engine.state.score,126)
        XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
    }
    func testExplicitJuiceResumeRootUsesActualDirectCommitAndHUDCollection()async throws {
        try await runJuiceResumeRoot(locked:false)
    }
    func testExplicitJuiceResumeRootOpensActualSourceLockedHolderBeforeBounce()async throws {
        try await runJuiceResumeRoot(locked:true)
    }
    func testJourneyStarExtraFaceCommitsFollowBothPhysicalAPPGuards()async throws {
        try await runJuiceResumeRoot(locked:true,archetype:.star)
    }
    func testJourneyStarEndgameBonusAwaitsFinishBeforeActualAPPFiftyPrimary()async throws {
        try await runJuiceResumeRoot(locked:false,archetype:.star,endgame:true)
    }
    func testSourceJuiceHardPrimaryUsesConstructorBeforeValueAndActualAPPBounce()async throws {
        try await runJuiceResumeRoot(locked:false,hardPrimary:true)
    }
    func testSourceNormalOrdinaryResumeUsesActualMinimumCoroutine()async throws {
        try await runOrdinaryResumeRoot(noLocked:false)
    }
    func testSourceNoLockedOrdinaryResumeVerifiesActualPrimaryBeforeFinally()async throws {
        try await runOrdinaryResumeRoot(noLocked:true)
    }
    func testActualOrdinaryPhysicalFinalSnapshotReachesResultWithoutRefillingHiddenOtherTiles()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true)
    }
    func testActualJuicePhysicalFinalSurvivesWildPrefixThroughJourneyRewardResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true)
    }
    func testActualTntPhysicalFinalUsesSourceConstructorClockThroughJourneyResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,directArchetype:.tnt)
    }
    func testActualTntWildDestinationPhysicalFinalRetainsFirstFaceThroughJourneyResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,directArchetype:.tnt,wildDestination:true)
    }
    func testActualMagnetWildDestinationNoPullFinalReachesJourneyResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,directArchetype:.magnet,wildDestination:true)
    }
    func testActualBottleWildDestinationFinalReachesJourneyResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,directArchetype:.magnet,wildDestination:true,directVariant:"bottle")
    }
    func testActualRegistryFlowerWildDestinationFinalRetainsVariantThroughJourneyResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,directArchetype:.tnt,wildDestination:true,directVariant:"flower")
    }
    func testActualRegistryCuberoWildDestinationFinalRetainsVariantThroughJourneyResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,directArchetype:.star,wildDestination:true,directVariant:"cubero")
    }
    func testActualJuiceLatePhysicalFinalMainReclassificationReachesRewardAndResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:true,physicalFinal:true,directFinal:true,lateFinal:true)
    }
    func testActualJuiceCoroutineLateRetainedDestinationGuardReachesRewardAndResult()async throws {
        try await runOrdinaryResumeRoot(noLocked:false,physicalFinal:true,directFinal:true,coroutineLate:true)
    }
    private func runOrdinaryResumeRoot(noLocked:Bool,physicalFinal:Bool=false,directFinal:Bool=false,directArchetype:NativeWildArchetype = .juice,wildDestination:Bool=false,directVariant:String?=nil,lateFinal:Bool=false,coroutineLate:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-normal-ordinary-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.journeyRuns[1] = .init(tiles:[
            .init(id:"source",cell:.init(column:0,row:0),value:directFinal && !wildDestination ? 6:2,archetype:directFinal && !wildDestination ? directArchetype:nil,variant:directFinal && !wildDestination ? directVariant:nil),
            .init(id:"destination",cell:.init(column:1,row:0),value:directFinal && wildDestination ? 6:4,archetype:wildDestination ? directArchetype:nil,variant:wildDestination ? directVariant:nil),
            .init(id:"other",cell:.init(column:2,row:0),value:1),
            .init(id:"far",cell:.init(column:4,row:8),value:1)],mode:.journey,moves:37,score:123,wildMeter:0.4)
        if !noLocked {seed.journeyRuns[1]?.tiles.append(.init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true))}
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:directFinal,sourceOrdinaryResumeEnabled:true,sourceOrdinaryEndgamePresentationEnabled:noLocked)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeNormalOrdinaryRoot",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden}
        app.navigate(.world(1),interrupt:true)
        try await wait{
            if app.children.contains(where:{$0 is NativeGameplayViewController}) {return true}
            app.world?.onRequest?("continue",1);return false
        }
        try await wait{
            guard let game=app.children.compactMap({$0 as? NativeGameplayViewController}).first,
                  let scene=game.boardScene else{return false}
            return scene.gameplayRenderHost?.renderedScene === scene && game.view.window != nil && scene.isBoardEntryComplete
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertEqual(game.engine.sourceOrdinarySixSpawnNormalOnly,!noLocked)
        XCTAssertNotNil(game.engine.sourceOrdinaryMinimumTileAuthority)
        XCTAssertEqual(game.engine.sourceOrdinaryPhysicalFinalCaptureCount,0,"Entry cannot manufacture a final decision before an accepted drop")
        XCTAssertNil(game.engine.sourceNoMovesRuntimeAuthority)
        var observedRetainedNode:NativeDiceNode?
        if coroutineLate {
            let originalFailure=scene.onSourcePresentationFailure
            scene.onSourcePresentationFailure={[weak game,weak scene] reason,generation in
                XCTFail("Actual late Source owner refused \(reason), generation=\(generation), retained=\(String(describing:game?.engine.sourceRetainedDirectDestination)), await=\(String(describing:game?.engine.pendingSourceDirectInitialAwait)), physical=\(scene?.captureSourcePhysicalBoard() != nil)")
                originalFailure?(reason,generation)
            }
            let originalResume=try XCTUnwrap(game.engine.sourceWildCoroutineResume)
            game.engine.sourceWildCoroutineResume={ownerID,generation in
                if observedRetainedNode==nil,let carrier=game.engine.sourceRetainedDirectDestination,carrier.ownerID==ownerID,
                   let node=scene.sourceNativeTileNode(carrier.tileID) {
                    observedRetainedNode=node;node.isHidden=false;node.alpha=1
                    scene.sourceNativeTileNode("other")?.isHidden=true;scene.sourceNativeTileNode("far")?.isHidden=true
                }
                return originalResume(ownerID,generation)
            }
        }
        let geometry=try XCTUnwrap(scene.boardGeometry)
        if physicalFinal && !lateFinal && !coroutineLate {
            // Real parent paint, read through the actual scoped observation;
            // no injected final flag, synthetic snapshot or manual completion.
            try XCTUnwrap(scene.sourceNativeTileNode("other")).alpha=0.01
            try XCTUnwrap(scene.sourceNativeTileNode("far")).alpha=0.01
        }
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        scene.moveDrag(to:geometry.center(row:0,column:1),now:Date().timeIntervalSince1970)
        try await Task.sleep(for:.milliseconds(160))
        let result=try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:Date().timeIntervalSince1970))
        XCTAssertTrue(result.accepted,"Actual final contact rejected: \(result.events) / \(result.resolution) / \(scene.sourceDirectContactAdmissionDiagnostics(sourceID:"source",destinationID:"destination"))")
        XCTAssertEqual(game.engine.sourceOrdinaryPhysicalFinalCaptureCount,directFinal ? 0:1,"Actual accepted pair captures its own physical finality")
        if directFinal {XCTAssertEqual(game.engine.sourceDirectPhysicalFinalCaptureCount,1)}
        if physicalFinal {
            if directFinal {
                let plan=try XCTUnwrap(game.engine.pendingDirectWild)
                if lateFinal || coroutineLate {
                    XCTAssertFalse(plan.isFinal)
                    if !coroutineLate {
                        try XCTUnwrap(scene.sourceNativeTileNode("other")).isHidden=true
                        try XCTUnwrap(scene.sourceNativeTileNode("far")).isHidden=true
                    }
                } else {XCTAssertTrue(plan.isFinal);XCTAssertTrue(try XCTUnwrap(plan.sourceEntryFinalSnapshot).isFinalMerge)}
            } else {XCTAssertTrue(try XCTUnwrap(game.engine.pendingOrdinarySix).isFinal)}
            try await wait{game.visibleJourneyRewardController != nil}
            if coroutineLate {
                XCTAssertNotNil(observedRetainedNode,"Actual FIFO uses the same retained constructor destination")
                XCTAssertEqual(game.engine.state.terminal?.reason,"final_single_merge6_guard")
                XCTAssertNil(game.engine.sourceRetainedDirectDestination)
                XCTAssertTrue(game.engine.pendingWildSpawnActions.isEmpty)
                XCTAssertGreaterThan(scene.sourceWildCoroutineFinallyDeliveredCount,0)
            }
            let reward=try XCTUnwrap(game.visibleJourneyRewardController)
            try await wait{(try? store.load()?.progression.completedJourneyBoards.contains(reward.board)) == true}
            reward.activate();reward.activate() // genuine collect handler, including reveal queuing
            try await wait{game.presentedViewController is NativeResultController}
            XCTAssertEqual(game.engine.state.terminal?.kind,.complete)
            XCTAssertEqual(scene.sourceOrdinarySpawnOwnerBeginCount,0,"Immutable actual finality cannot allocate refill ownership")
            XCTAssertTrue(game.engine.pendingOrdinaryAssignments.isEmpty)
            XCTAssertEqual(game.engine.sourceOrdinaryPhysicalFinalCaptureCount,directFinal ? 0:1)
            if directFinal {
                XCTAssertEqual(game.engine.sourceDirectPhysicalFinalCaptureCount,lateFinal || coroutineLate ? 2:1,"Normal main has its second live capture; confirmed entry keeps its immutable snapshot")
                XCTAssertEqual(scene.sourceWildSpawnOwnerBeginCount,coroutineLate ? 1:0,"Coroutine late guard resets the real already-acquired owner; entry/main finality never acquires refill")
                XCTAssertTrue(game.engine.pendingWildSpawnActions.isEmpty)
                XCTAssertTrue(game.engine.pendingWildLockedBonusPresentations.isEmpty)
            }
            if directArchetype == .tnt,directFinal,directVariant==nil {
                XCTAssertEqual(scene.sourceTntFinaleSourceConstructionCount,1)
                XCTAssertEqual(scene.sourceTntDirectBoomExitCount,1,"Real painted UIKit glyph exit releases final handoff")
                XCTAssertNil(game.engine.pendingSpecial,"Final TNT retains genuine Direct ownership")
            }
            XCTAssertNil(game.sourcePresentationFailureGeneration)
            let saved=try XCTUnwrap(store.load())
            XCTAssertTrue(saved.progression.completedJourneyBoards.contains(1),"Actual Result persists native progression")
            XCTAssertNil(game.engine.sourceNoMovesRuntimeAuthority)
            return
        }
        try await wait{scene.sourceOrdinaryMinimumFinallyDeliveredCount==1}
        XCTAssertEqual(scene.sourceOrdinarySpawnOwnerBeginCount,1)
        XCTAssertNil(game.engine.pendingOrdinarySix)
        if noLocked {
            XCTAssertNil(game.engine.pendingSourceOrdinaryEndgameVerification)
            let fresh=try XCTUnwrap(game.engine.state.tile(at:.init(column:1,row:0)))
            XCTAssertNotEqual(fresh.id,"destination");XCTAssertGreaterThan(fresh.value,0)
            let node=try XCTUnwrap(scene.sourceNativeTileNode(fresh.id))
            XCTAssertTrue(node.sourceMergeSixFaceReady(service:try XCTUnwrap(game.sourceScope?.service)))
            XCTAssertTrue(scene.beginDrag(at:scene.convert(node.position,from:try XCTUnwrap(node.parent))))
            scene.cancelDrag(pointerCancelled:true)
            XCTAssertNil(game.sourcePresentationFailureGeneration)
        } else {XCTAssertFalse(try XCTUnwrap(game.engine.state.tiles.first{$0.id=="locked"}).locked)}
        XCTAssertNil(scene.captureSourceMergeSixSpawnInProgress(),"Incomplete global writer coverage stays unknown after real finally")
        XCTAssertNil(game.engine.sourceNoMovesRuntimeAuthority)
        host.dispose()
        XCTAssertNil(game.engine.sourceOrdinaryMinimumTileAuthority)
        XCTAssertNil(game.engine.sourceWildMinimumTileAuthority)
    }
    func testExplicitTntResumeRootUsesCapturedMainAndSharedSpawnWithoutReleasingBonus()async throws {
        try await runTntResumeRoot(cancelBeforeMain:false)
    }
    func testActualTntMainCancellationRetiresPairWithoutChargeAndAllowsNextMove()async throws {
        try await runTntResumeRoot(cancelBeforeMain:true)
    }
    func testActualTntBonusAppSafetyContinuesThroughModalClockPauseAndLateDateWrites()async throws {
        try await runTntResumeRoot(cancelBeforeMain:false,pauseDuringBonus:true)
    }
    func testActualTntNoTargetReservationSettlesWithoutInventedPrimaryOrBonusDelay()async throws {
        try await runTntResumeRoot(cancelBeforeMain:false,noTargets:true)
    }
    func testActualCompleteLaserReverseNoTargetOwnerBoundary()async throws {
        try await runTntResumeRoot(cancelBeforeMain:false,noTargets:true,variant:"laser-gun",wildDestination:true,complete:true)
    }
    func testAuthoredTntReverseDestinationAndLaserNoTargetActualOwners()async throws {
        for variant in ["flower","barell","beach-ball","laser-gun"] {
            try await runTntResumeRoot(cancelBeforeMain:false,noTargets:variant=="laser-gun",variant:variant,wildDestination:true,complete:true)
        }
    }
    private func runTntResumeRoot(cancelBeforeMain:Bool,pauseDuringBonus:Bool=false,noTargets:Bool=false,variant:String?=nil,wildDestination:Bool=false,complete:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-tnt-source-main-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.journeyRuns[1] = .init(tiles:[
            .init(id:"source",cell:.init(column:0,row:0),value:wildDestination ? 2:6,archetype:wildDestination ? nil:.tnt,variant:wildDestination ? nil:variant),
            .init(id:"destination",cell:.init(column:1,row:0),value:wildDestination ? 6:2,archetype:wildDestination ? .tnt:nil,variant:wildDestination ? variant:nil),
            .init(id:"other",cell:.init(column:2,row:0),value:noTargets ? 6:1,archetype:noTargets ? .star:nil),
            .init(id:"far",cell:.init(column:4,row:8),value:noTargets ? 6:1,archetype:noTargets ? .juice:nil),
            .init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true)],mode:.journey,moves:37,score:123,wildMeter:0.4)
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true,sourceOrdinaryResumeEnabled:true,sourceTntPresentationEnabled:true,completeNativeGameplayEnabled:complete)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ name:String,_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else {
                let active=app.children.compactMap{$0 as? NativeGameplayViewController}.first
                XCTFail("NativeTntSourceRoot timeout=\(name) variant=\(variant ?? "core") admission=\(active?.sourceEntryDiagnostic() ?? "none") pending=\(String(describing:active?.engine.pendingSpecial)) main=\(active?.boardScene?.sourceTntMainDeliveredCount ?? -1) finally=\(active?.boardScene?.sourceTntSpawnFinallyCount ?? -1) tntMain=\(active?.boardScene?.sourceTntMainDiagnostic() ?? "none") levelEnd=\(active?.boardScene?.sourceLevelEndDiagnostic() ?? "none")")
                throw NSError(domain:"NativeTntSourceRoot."+name,code:1)
            };try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait("home"){!app.home.isHidden}
        app.navigate(.world(1),interrupt:true)
        try await wait("continue"){
            if app.children.contains(where:{$0 is NativeGameplayViewController}) {return true}
            app.world?.onRequest?("continue",1);return false
        }
        try await wait("entry"){
            guard let game=app.children.compactMap({$0 as? NativeGameplayViewController}).first,
                  let scene=game.boardScene,scene.view != nil,scene.isBoardEntryComplete else{return false}
            return !complete || (game.beforeSourceGameplayAdmission==nil && game.engine.sourceNoMovesRuntimeAuthority?.isCurrent()==true)
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertTrue(game.engine.sourceTntMain80Enabled);XCTAssertTrue(game.engine.stagedTntWildSpawnAssignments)
        XCTAssertTrue(scene.sourceHUDStarJobsAdmissionOpen)
        if noTargets {game.engine.wildSpawnPermitAdmission={_ in false}} // actual refused-admission branch, no fake arrival or completion
        var outerBonusConstructors=0
        let originalOuterBonus=try XCTUnwrap(game.engine.sourceWildLockedBonusConstruct)
        game.engine.sourceWildLockedBonusConstruct={tile,generation in
            if variant==nil {
                XCTAssertEqual(game.engine.sourceTntPhysicalPreSpawnChecks,4,"Actual ctor follows both initial and both outer guards")
                XCTAssertEqual(scene.sourceTntLockedBonusGuardAwaitDeliveredCount,1,"Ctor executes inside second actual outer await reaction")
                XCTAssertNil(game.engine.pendingSourceTntLockedBonusGuard,"Remove captured await before external constructor")
            }
            let accepted=originalOuterBonus(tile,generation)
            if accepted {outerBonusConstructors+=1}
            return accepted
        }
        let source=try XCTUnwrap(scene.sourceNativeTileNode("source")),destination=try XCTUnwrap(scene.sourceNativeTileNode("destination"))
        let start=scene.convert(source.position,from:try XCTUnwrap(source.parent)),end=scene.convert(destination.position,from:try XCTUnwrap(destination.parent))
        XCTAssertTrue(scene.beginDrag(at:start));scene.moveDrag(to:end,now:Date().timeIntervalSince1970)
        try await Task.sleep(for:.milliseconds(160))
        let result=try XCTUnwrap(scene.finishDrag(at:end,now:Date().timeIntervalSince1970));XCTAssertTrue(result.accepted)
        XCTAssertTrue(scene.sourceNativeTileNode("source") === source)
        XCTAssertTrue(scene.sourceNativeTileNode("destination") === destination)
        XCTAssertNil(game.engine.pendingDirectWild)
        if cancelBeforeMain {
            source.dispose() // genuine captured outer-root destruction, no manual main callback
            try await wait("captured cancellation"){game.engine.pendingSpecial==nil}
            XCTAssertEqual(scene.sourceTntMainDeliveredCount,0);XCTAssertEqual(scene.sourceTntSpawnBeginCount,0)
            XCTAssertEqual(scene.sourceTntCapturedMainCount,0)
            XCTAssertEqual(game.engine.state.moves,37);XCTAssertEqual(game.engine.state.score,123)
            XCTAssertNil(scene.sourceNativeTileNode("source"));XCTAssertNil(scene.sourceNativeTileNode("destination"))
            let a=try XCTUnwrap(scene.sourceNativeTileNode("other")),b=try XCTUnwrap(scene.sourceNativeTileNode("far"))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:Date().timeIntervalSince1970)
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:Date().timeIntervalSince1970)).accepted)
            try await wait("next regular handoff"){game.engine.pendingOrdinaryStack==nil}
            XCTAssertNil(game.sourcePresentationFailureGeneration)
            return
        }
        if let variant {
            XCTAssertEqual(try XCTUnwrap(game.engine.pendingSpecial).variant,variant)
            XCTAssertTrue(destination.sourceWildStateCleared)
            try await wait("authored first-face") {destination.sourceResidualWildPresence || scene.sourceNativeTileNode("destination") == nil}
            try await wait("authored main and spawn finally") {scene.sourceTntMainDeliveredCount==1 && scene.sourceTntSpawnFinallyCount==1}
            try await wait("authored bonus completion") {game.engine.pendingSpecial==nil}
            XCTAssertEqual(game.engine.state.moves,36);XCTAssertEqual(game.engine.state.cubesCracked,1)
            XCTAssertNil(game.sourcePresentationFailureGeneration)
            let spawnReceipt=try XCTUnwrap(game.engine.sourceTntSpawnBeginReceipt)
            XCTAssertTrue(game.engine.hasSettledSourceTntSpawnCoroutine(transactionID:spawnReceipt.ownerID,generation:spawnReceipt.generation))
            XCTAssertFalse(game.engine.sourceTntSpawnBeginIsCurrent(spawnReceipt))
            if noTargets {XCTAssertEqual(scene.sourceTntNoTargetCompletionCount,1)}
            if complete {
                do {try await wait("authored physical finally and canonical-save") {
                    guard let runtime=scene.captureSourceGameplayRuntime(isWild:false),let meter=runtime.meterEnvironment else{return false}
                    return runtime.missingOwners.isEmpty && !meter.queueInProgress && !meter.mergeSixSpawnInProgress &&
                        !meter.wildMagnetPullInProgress && !meter.wildDropInProgress &&
                        (noTargets ? game.engine.state.terminal?.kind == .fail : (try? store.load()?.journeyRuns[1])==game.engine.state)
                }} catch {
                    XCTFail("authored variant=\(variant) unsavable=\(game.engine.hasUnsavableSourceGameplayState) durable=\(String(describing:try? store.load()?.journeyRuns[1])) current=\(game.engine.state) runtime=\(String(describing:scene.captureSourceGameplayRuntime(isWild:false))) levelEnd=\(scene.sourceLevelEndDiagnostic())")
                    throw error
                }
                let runtime=try XCTUnwrap(scene.captureSourceGameplayRuntime(isWild:false))
                XCTAssertEqual(runtime.missingOwners,[])
                let meter=try XCTUnwrap(runtime.meterEnvironment)
                XCTAssertFalse(meter.queueInProgress);XCTAssertFalse(meter.mergeSixSpawnInProgress)
                XCTAssertFalse(meter.wildMagnetPullInProgress);XCTAssertFalse(meter.wildDropInProgress)
                XCTAssertNotNil(game.engine.sourceNoMovesRuntimeAuthority?.capture())
                if noTargets {
                    // Rejected Source spawn permits leave two incompatible
                    // Wilds: genuine NO MOVES commits Result, never a resumable
                    // ended-board snapshot.
                    try await wait("laser-zero actual result"){game.presentedViewController is NativeResultController}
                    XCTAssertEqual(game.engine.completedSourceNoMovesReceipt?.resolution.kind,.fail)
                    XCTAssertTrue(game.engine.completedSourceNoMovesReceipt?.boardExitCompleted==true)
                    try await wait("laser-zero committed attempt"){(try? store.load()?.journeyRuns[1])==nil}
                    let committed=try XCTUnwrap(store.load())
                    XCTAssertNil(committed.journeyRuns[1]);XCTAssertNil(committed.journeyRunSavedAt[1])
                    XCTAssertFalse(committed.progression.completedJourneyBoards.contains(1))
                    let result=try XCTUnwrap(game.presentedViewController as? NativeResultController)
                    func exitButton(_ view:UIView)->UIButton? {
                        if let button=view as? UIButton,button.accessibilityIdentifier=="native.result.exit" {return button}
                        return view.subviews.lazy.compactMap(exitButton).first
                    }
                    let exit=try XCTUnwrap(exitButton(result.view)),oldScope=game.sourceScope
                    try await wait("laser-zero result exit-ready"){exit.isUserInteractionEnabled}
                    exit.sendActions(for:.touchUpInside)
                    try await wait("laser-zero real world return"){!app.children.contains(where:{$0 is NativeGameplayViewController}) && app.world != nil}
                    XCTAssertFalse(oldScope?.current ?? true)
                    let afterExit=try XCTUnwrap(store.load())
                    XCTAssertEqual(afterExit.progression,committed.progression)
                    XCTAssertEqual(afterExit.settings,committed.settings)
                    XCTAssertEqual(afterExit.journeyRuns,committed.journeyRuns)
                }
            }
            return
        }
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let paused=game.engine.state
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertEqual(scene.sourceTntMainDeliveredCount,0);XCTAssertEqual(game.engine.state,paused)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait("spawn finally"){scene.sourceTntSpawnFinallyCount==1}
        XCTAssertEqual(scene.sourceTntMainDeliveredCount,1);XCTAssertEqual(scene.sourceTntSpawnBeginCount,1)
        XCTAssertEqual(scene.sourceTntFinaleSourceConstructionCount,1,"Actual Source finale uses genuine UIKit/common-RNG construction, not a hidden Raw title")
        try await wait("outer bonus awaits"){scene.sourceTntLockedBonusGuardAwaitDeliveredCount==2}
        XCTAssertEqual(game.engine.sourceTntPhysicalPreSpawnChecks,4,"Actual normal TNT reads two initial and two outer bonus guards")
        XCTAssertEqual(game.engine.sourceWildExtraFinalGuardChecks,2,"Actual TNT empty extra helper still passes pre/single await guards")
        XCTAssertEqual(outerBonusConstructors,noTargets ? 0:9)
        XCTAssertNil(game.engine.pendingSourceTntLockedBonusGuard)
        XCTAssertEqual(game.engine.state.moves,36);XCTAssertEqual(game.engine.state.cubesCracked,1)
        XCTAssertNil(game.engine.pendingDirectWild);XCTAssertNil(game.engine.sourceWildSpawnBeginReceipt)
        XCTAssertNotNil(game.engine.pendingSpecial,"Actual TNT bonus still owns its separate completion")
        if pauseDuringBonus {
            try await wait("first real bonus constructor"){scene.sourceTntBonusConstructorCount>0}
            let service=try XCTUnwrap(game.sourceScope?.service)
            XCTAssertTrue(service.setSourceGlobalPaused(true))
            try await wait("actual APP safety and complete80"){game.engine.pendingSpecial==nil}
            let before=try XCTUnwrap(game.sourceScope?.captureTntBonusDates())
            XCTAssertTrue(service.setSourceGlobalPaused(false))
            try await wait("late genuine replacement Date after safety"){(game.sourceScope?.captureTntBonusDates()?.lastChangeAt ?? 0)>before.lastChangeAt}
        } else {try await wait("bonus finally"){game.engine.pendingSpecial==nil}}
        if noTargets {
            XCTAssertEqual(scene.sourceTntNoTargetCompletionCount,1)
            XCTAssertEqual(scene.sourceTntCompletion80ScheduledCount,0,"Actual no-target branch cannot invent Source complete80")
            XCTAssertEqual(game.sourceScope?.captureTntBonusDates()?.lastChangeAt,0,"No replacement cannot write a positive last-change timestamp")
            XCTAssertEqual(scene.sourceTntBonusConstructorCount,0);XCTAssertEqual(scene.sourceTntBonusSharedFxCount,0)
            XCTAssertTrue(game.engine.pendingWildSpawnArrivals.isEmpty)
            try await wait("actual no-target visual transaction release"){scene.sourceTntTransactionCaptureCount==0}
            try await wait("actual main HUD jobs collect"){game.engine.pendingHUDStars.isEmpty && game.engine.sourceHUDStarJobs.isEmpty}
            XCTAssertNil(game.sourcePresentationFailureGeneration);XCTAssertNil(game.engine.sourceNoMovesRuntimeAuthority)
            XCTAssertNil(scene.captureSourceMergeSixSpawnInProgress())
            return
        }
        XCTAssertEqual(scene.sourceTntCompletion80ScheduledCount,1,"Actual nonempty impact sequence schedules its authored complete80 exactly once")
        XCTAssertGreaterThan(scene.sourceTntBonusConstructorCount,0,"Actual bonus uses fresh Source holders and independent face/bounce owners")
        XCTAssertEqual(scene.sourceTntBonusSharedFxCount,scene.sourceTntBonusConstructorCount,"Each actual impact constructs the original shared shards and target smoke before replacement")
        try await wait("actual independent visual and gameplay transaction release"){scene.sourceTntTransactionCaptureCount==0}
        try await wait("all actual TNT main and bonus HUD jobs collect"){game.engine.pendingHUDStars.isEmpty && game.engine.sourceHUDStarJobs.isEmpty}
        let fresh=try XCTUnwrap(game.engine.state.tiles.first{tile in
            tile.value>0 && tile.value<6 && !tile.isWild && tile.id != "other" && tile.id != "far"
        })
        let freshNode=try XCTUnwrap(scene.sourceNativeTileNode(fresh.id))
        XCTAssertEqual(freshNode.sourceGeneration,game.engine.state.generation)
        XCTAssertTrue(freshNode.sourceMergeSixFaceReady(service:try XCTUnwrap(game.sourceScope?.service)))
        XCTAssertTrue(scene.beginDrag(at:scene.convert(freshNode.position,from:try XCTUnwrap(freshNode.parent))))
        scene.cancelDrag(pointerCancelled:true)
        XCTAssertNil(game.sourcePresentationFailureGeneration)
        XCTAssertNil(game.engine.sourceNoMovesRuntimeAuthority)
        XCTAssertNil(scene.captureSourceMergeSixSpawnInProgress(),"Incomplete global coverage remains unknown")
        host.dispose()
        XCTAssertNil(game.engine.sourceTntSpawnBegin);XCTAssertNil(game.engine.sourceTntCoroutineFinally)
        XCTAssertNil(game.engine.sourceTntLockedBonusGuardResume);XCTAssertNil(game.engine.pendingSourceTntLockedBonusGuard)
        XCTAssertFalse(game.engine.sourceTntLockedBonusPhysicalGuardsEnabled)
        XCTAssertNil(game.engine.sourceFinalMergePresenceAuthority)
    }
    func testSourceNegativeHardPrimaryRetiresExactHoldersBeforeAwaitedThirdAttempt()async throws {
        try await runJuiceResumeRoot(locked:false,hardPrimary:true,negativeHard:true)
    }
    private func runJuiceResumeRoot(locked:Bool,hardPrimary:Bool=false,negativeHard:Bool=false,archetype:NativeWildArchetype = .juice,endgame:Bool=false)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-juice-app-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"juice",cell:.init(column:0,row:0),value:6,archetype:archetype),
            .init(id:"destination",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:2,row:0),value:1),
            .init(id:"far",cell:.init(column:4,row:8),value:1)],mode:locked || hardPrimary || endgame ? .journey:.arcade,moves:37,score:123,wildMeter:0.4)
        if locked || hardPrimary || endgame {
            if locked {seed.arcadeRun?.tiles.append(.init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true))}
            seed.journeyRuns[1]=seed.arcadeRun;seed.arcadeRun=nil
        }
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true,sourceOrdinaryResumeEnabled:true)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeJuiceRoot",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden}
        if locked || hardPrimary || endgame {
            app.navigate(.world(1),interrupt:true)
            try await wait{
                if app.children.contains(where:{$0 is NativeGameplayViewController}) {return true}
                app.world?.onRequest?("continue",1);return false
            }
        } else {app.navigate(.gameplay,interrupt:true)}
        try await wait{
            guard let game=app.children.compactMap({$0 as? NativeGameplayViewController}).first,
                  let scene=game.boardScene else{return false}
            return scene.view != nil && game.view.window != nil && scene.isBoardEntryComplete
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        let source=try XCTUnwrap(scene.sourceNativeTileNode("juice")),geometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertTrue(scene.sourceHUDStarJobsAdmissionOpen)
        XCTAssertNotNil(game.engine.sourceFinalMergePresenceAuthority)
        XCTAssertNotNil(game.engine.sourceWildLockedFaceCommit)
        XCTAssertNotNil(game.engine.sourceWildSpawnBegin,"Actual root connects Direct Wild app token acquisition")
        XCTAssertEqual(scene.sourceWildSpawnOwnerBeginCount,0)
        let minimumTiles=try XCTUnwrap(game.engine.sourceOrdinaryMinimumTileAuthority)
        XCTAssertTrue(game.engine.sourceWildMinimumTileAuthority === minimumTiles,"Actual Direct graph borrows exact physical tile-only owner")
        let tileSnapshot=try XCTUnwrap(minimumTiles.capture())
        XCTAssertEqual(tileSnapshot.paint.canonicalState,game.engine.state)
        XCTAssertEqual(Set(tileSnapshot.tiles.keys),Set(game.engine.state.tiles.map(\.id)))
        XCTAssertNil(game.engine.sourceNoMovesRuntimeAuthority,"Tile-only minimum capture does not admit global NO MOVES")
        let originalBounce=try XCTUnwrap(game.engine.sourceWildSpawnBouncePublish)
        var bounceActionIDs:[String]=[]
        game.engine.sourceWildSpawnBouncePublish={presentation,actionID in
            let accepted=originalBounce(presentation,actionID)
            XCTAssertTrue(accepted);XCTAssertGreaterThan(scene.sourceWildOpenBounceCount,0)
            XCTAssertEqual(scene.sourceWildSpawnOwnerBeginCount,1)
            XCTAssertEqual(scene.captureSourceMergeSixSpawnInProgress(),true,"Only actual app token publishes the active global observation")
            XCTAssertEqual(scene.sourceWildSpawnOwnerResetCount,0,"Decorative/awaited bounce publication cannot reset the global spawn owner")
            bounceActionIDs.append(actionID);return accepted
        }
        let originalBonus=try XCTUnwrap(game.engine.sourceWildLockedBonusConstruct)
        var bonusSourceIDs:[String]=[]
        game.engine.sourceWildLockedBonusConstruct={tile,generation in
            if locked || hardPrimary || endgame {
                XCTAssertEqual(game.engine.sourceDirectNormalPreSpawnChecks,locked ? 2:0)
                XCTAssertEqual(game.engine.sourceDirectNormalLockedBonusGuardChecks,locked ? 2:0)
                XCTAssertEqual(game.engine.sourceDirectEndgamePreSpawnChecks,locked ? 0:1)
                XCTAssertEqual(game.engine.sourceDirectEndgameLockedBonusGuardChecks,locked ? 0:2)
                if !locked {XCTAssertEqual(game.engine.sourceWildEndgameDelayCallbacks,0,"Actual endgame outer bonus finishes before APP50 primary")}
                XCTAssertEqual(scene.sourceDirectLockedBonusGuardAwaitDeliveredCount,1,"Constructor runs inside actual second outer APP reaction")
                XCTAssertNil(game.engine.pendingSourceDirectLockedBonusGuard)
            }
            let accepted=originalBonus(tile,generation)
            if accepted {
                let node=scene.sourceNativeTileNode(tile.id)
                XCTAssertEqual(node?.sourceGeneration,generation);XCTAssertEqual(node?.sourcePhysicalMarkersCovered,true)
                XCTAssertEqual(node?.locked,true);XCTAssertEqual(node?.value,0)
                XCTAssertEqual(node?.sourceRegularFramePending,false,"Locked zero constructor creates no independent value-face RAF")
                XCTAssertEqual(node?.sourceIsBeingSpawned,false)
                XCTAssertEqual(Double(node?.alpha ?? 0),tile.alpha,accuracy:0.000001);bonusSourceIDs.append(tile.id)
            }
            return accepted
        }
        var openedSourceIDs:[String]=[]
        var guardedStarExtraOpenIDs:[String]=[]
        var primarySourceIDs:[String]=[]
        var hardSourceIDs:[String]=[]
        var actualReservedPrimaryIsHard=false
        var actualReservedPrimaryID:String?
        if hardPrimary {
            var rejectedPrimaries=0
            game.engine.wildSpawnPermitAdmission={purpose in
                if purpose == .primary,rejectedPrimaries<2{rejectedPrimaries+=1;return false};return true
            }
            let originalHard=try XCTUnwrap(game.engine.sourceWildHardPrimaryConstruct)
            game.engine.sourceWildHardPrimaryConstruct={tile,generation in
                let accepted=originalHard(tile,generation)
                if accepted {
                    let node=scene.sourceNativeTileNode(tile.id)
                    XCTAssertEqual(node?.value,0);XCTAssertEqual(node?.locked,false)
                    XCTAssertEqual(node?.sourceRegularFramePending,false)
                    XCTAssertEqual(node?.sourceGeneration,generation)
                    hardSourceIDs.append(tile.id)
                }
                return accepted
            }
        }
        var failedHardPhysicalReadIDs:[String]=[]
        let originalPresenceAuthority=game.engine.sourceFinalMergePresenceAuthority
        if negativeHard {
            let actualAuthority=try XCTUnwrap(game.engine.sourceFinalMergePresenceAuthority)
            game.engine.sourceFinalMergePresenceAuthority = .init(isCurrent:{actualAuthority.isCurrent()},capture:{[weak scene,weak game] in
                let cell=NativeCell(column:1,row:0)
                // The typed real face action owns the negative attempt. Earlier
                // detached same-cell primaries cannot disable this injection;
                // a later genuine ordinary third face immediately retires it.
                let failedID=actualReservedPrimaryIsHard ? actualReservedPrimaryID:nil
                if let game,let failedID,hardSourceIDs.contains(failedID),
                    game.engine.state.tiles.contains(where:{$0.id==failedID && $0.cell==cell}),
                    scene?.sourceNativeTileNode(failedID) != nil {
                    failedHardPhysicalReadIDs.append(failedID)
                    for model in game.engine.state.tiles where model.cell==cell {
                        scene?.sourceNativeTileNode(model.id)?.isHidden=true
                    }
                }
                let snapshot=actualAuthority.capture()
                if let snapshot,let failedID,snapshot.canonicalState.tiles.contains(where:{$0.id==failedID && $0.cell==cell}) {
                    let active=snapshot.physicalTiles.filter {tile in
                        tile.cell==cell && snapshot.runtime[tile.id].map{NativeSourceEndgameChecker.active(tile,runtime:$0)} == true
                    }
                    XCTAssertTrue(active.isEmpty,"Real failed-hard reserved-cell observation must be negative: \(active.map{"\($0.id):\($0.value):\($0.visible)"}).")
                }
                return snapshot
            })
        }
        let originalPrimary=try XCTUnwrap(game.engine.sourceWildPrimaryFaceCommit)
        game.engine.sourceWildPrimaryFaceCommit={action,tile in
            if locked {
                XCTAssertEqual(game.engine.sourceDirectNormalPreSpawnChecks,2,"Actual normal Direct value commit follows both initial physical await guards")
                XCTAssertNil(game.engine.pendingSourceDirectInitialAwait)
                XCTAssertEqual(game.engine.sourceDirectNormalLockedBonusGuardChecks,0,"Primary starts before the independent outer bonus helper")
            } else {
                XCTAssertEqual(game.engine.sourceDirectEndgamePreSpawnChecks,1)
                XCTAssertEqual(game.engine.sourceWildEndgameDelayCallbacks,1)
                XCTAssertEqual(game.engine.sourceWildEndgamePhysicalGuardChecks,action.cell == NativeCell(column:1,row:0) ? 2:3,"Actual primary follows both APP50 guards; later extras also follow after-primary guard")
            }
            let accepted=originalPrimary(action,tile)
            if accepted {
                let holder=scene.sourceNativeTileNode(tile.id)
                XCTAssertEqual(holder?.value,tile.value);XCTAssertEqual(holder?.locked,false)
                XCTAssertEqual(holder?.sourceRegularFramePending,true)
                XCTAssertEqual(holder?.sourcePhysicalMarkersCovered,true)
                XCTAssertEqual(holder?.sourceGeneration,game.engine.state.generation)
                XCTAssertFalse(game.engine.pendingWildSpawnPresentations.contains{$0.tileID==tile.id})
                primarySourceIDs.append(tile.id)
                if negativeHard,action.cell == NativeCell(column:1,row:0) {
                    actualReservedPrimaryID=tile.id;actualReservedPrimaryIsHard=action.kind == .hardPrimary
                    if actualReservedPrimaryIsHard {holder?.isHidden=true}
                }
            }
            return accepted
        }
        let originalPop=try XCTUnwrap(game.engine.sourceWildLockedBonusPop)
        var publishedBonusIDs:[String]=[]
        game.engine.sourceWildLockedBonusPop={bonus in
            XCTAssertEqual(bonusSourceIDs.last,bonus.tileID,"Each constructor is followed by its own direction/pop before the next constructor")
            XCTAssertNotNil(game.engine.state.tiles.first{$0.id==bonus.tileID},"Original constructor publishes grid/tiles before pop")
            let accepted=originalPop(bonus)
            XCTAssertTrue(accepted);XCTAssertEqual(Double(scene.sourceNativeTileNode(bonus.tileID)?.sourceLocalScale.x ?? 0),0.30,accuracy:0.000001)
            publishedBonusIDs.append(bonus.tileID);return accepted
        }
        if locked || (archetype == .star && endgame) {
            let originalFace=try XCTUnwrap(game.engine.sourceWildLockedFaceCommit)
            game.engine.sourceWildLockedFaceCommit={action,tile in
                let accepted=originalFace(action,tile)
                if accepted {
                    let holder=scene.sourceNativeTileNode(tile.id)
                    XCTAssertEqual(holder?.value,tile.value);XCTAssertEqual(holder?.locked,false)
                    XCTAssertEqual(holder?.sourceRegularFramePending,true)
                    XCTAssertFalse(game.engine.pendingWildSpawnPresentations.contains{$0.tileID==tile.id})
                    openedSourceIDs.append(tile.id)
                    if archetype == .star,game.engine.sourceWildExtraFinalGuardChecks==2 {
                        guardedStarExtraOpenIDs.append(tile.id)
                    }
                }
                return accepted
            }
        }
        let sourceWave=expectation(description:"Actual Source Juice root borrows APP timeline for both surviving physical holders")
        let originalEvent=scene.onGameplayEvent
        var actualEndgameDelayIDs:Set<String>=[]
        scene.onGameplayEvent={event in
            originalEvent?(event)
            if !locked,event.kind == .wildSpawnActionsPrepared,
               let action=game.engine.pendingWildSpawnActions.first,action.kind == .wait {
                XCTAssertEqual(action.delayMilliseconds,50)
                XCTAssertEqual(game.engine.sourceWildEndgameDelayCallbacks,0)
                XCTAssertEqual(game.engine.sourceWildEndgamePhysicalGuardChecks,0)
                XCTAssertTrue(primarySourceIDs.isEmpty)
                actualEndgameDelayIDs.insert(action.id)
            }
            if event.kind == .merged,event.archetype == archetype {
                DispatchQueue.main.async {
                    XCTAssertEqual(scene.sourceShortWildBoardBlastActiveCount,2)
                    for id in ["other","far"] {
                        XCTAssertEqual(scene.sourceNativeTileNode(id)?.zPosition,320)
                        XCTAssertNil(scene.sourceNativeTileNode(id)?.action(forKey:"native-short-wild-blast"),"Source wave uses its existing APP transport")
                    }
                    sourceWave.fulfill()
                }
            }
        }
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        if locked {
            let deadline=Date().addingTimeInterval(8)
            while openedSourceIDs.isEmpty {
                if Date()>=deadline {
                    XCTFail("Locked Source spawn did not open; state=\(game.engine.state) actions=\(game.engine.pendingWildSpawnActions) presentations=\(game.engine.pendingWildSpawnPresentations)")
                    await fulfillment(of:[sourceWave],timeout:1)
                    return
                }
                try await Task.sleep(for:.milliseconds(20))
            }
        } else {try await wait{game.engine.state.moves==36 && !source.sourceContactNodeAlive && game.engine.pendingHUDStars.isEmpty}}
        await fulfillment(of:[sourceWave],timeout:2)
        try await wait{scene.sourceShortWildBoardBlastActiveCount==0}
        XCTAssertEqual(scene.sourceShortWildBoardBlastActiveCount,0,"Completed Source wave retires exact borrowed roots")
        if locked {
            let id=try XCTUnwrap(openedSourceIDs.first)
            let opened=try XCTUnwrap(scene.sourceNativeTileNode(id))
            try await wait{!opened.sourceRegularFramePending}
            XCTAssertGreaterThan(opened.value,0);XCTAssertFalse(opened.locked)
            XCTAssertEqual(opened.value,game.engine.state.tiles.first{$0.id==id}?.value)
            XCTAssertNil(opened.visual.action(forKey:"native-wild-spawn"))
            try await wait{scene.sourceWildOpenBounceCount==0}
        }
        if locked || hardPrimary || endgame {XCTAssertFalse(bonusSourceIDs.isEmpty,"Actual Journey Wild continuation invokes Source bonus constructors")}
        else{XCTAssertTrue(bonusSourceIDs.isEmpty,"Original Arcade Simple Wild has no locked bonus") }
        XCTAssertEqual(publishedBonusIDs,bonusSourceIDs)
        try await wait{scene.sourceWildBonusPopCount==0}
        for id in bonusSourceIDs {
            if let node=scene.sourceNativeTileNode(id),node.locked {
                XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:0.000001)
                XCTAssertEqual(node.sourceGeneration,game.engine.state.generation)
                XCTAssertFalse(node.sourceRegularFramePending)
                XCTAssertNil(node.visual.action(forKey:"native-wild-locked-bonus"))
                XCTAssertEqual(Double(node.alpha),game.engine.state.tiles.first{$0.id==id}!.alpha,accuracy:0.000001)
            }
        }
        if hardPrimary {XCTAssertFalse(hardSourceIDs.isEmpty);XCTAssertTrue(primarySourceIDs.contains(hardSourceIDs.first ?? ""))}
        if negativeHard {
            XCTAssertEqual(hardSourceIDs.count,2,"Both actual hard holders fail physical verification before awaited attempt three")
            for id in hardSourceIDs {XCTAssertNil(scene.sourceNativeTileNode(id),"Only exact failed constructor holders retire")}
            XCTAssertGreaterThanOrEqual(primarySourceIDs.count,3)
        }
        XCTAssertFalse(bounceActionIDs.isEmpty);XCTAssertEqual(Set(bounceActionIDs).count,bounceActionIDs.count)
        XCTAssertGreaterThan(scene.sourceWildCoroutineResumeDeliveredCount,0,"Actual source phase continuation runs after callback through app FIFO")
        XCTAssertGreaterThan(scene.sourceWildPromiseArrivalDeliveredCount,0,"Actual awaited primary/extra Source arrival crosses app FIFO")
        XCTAssertEqual(scene.sourceWildPromiseArrivalEnqueuedCount,scene.sourceWildPromiseArrivalDeliveredCount)
        try await wait{scene.sourceWildCoroutineFinallyDeliveredCount==1}
        XCTAssertEqual(scene.sourceWildCoroutineFinallyDeliveredCount,1,"Actual completed Source coroutine releases its captured resolution through APP finally FIFO")
        XCTAssertEqual(game.engine.sourceDirectPhysicalFinalCaptureCount,2,"Real negative entry and main read actual retained presence")
        XCTAssertEqual(game.engine.sourceDirectNormalPreSpawnChecks,locked ? 2:0,"Only actual normal Direct admits this initial await subset")
        XCTAssertEqual(game.engine.sourceDirectEndgamePreSpawnChecks,locked ? 0:1)
        XCTAssertEqual(game.engine.sourceWildEndgameDelayCallbacks,locked ? 0:1)
        XCTAssertEqual(game.engine.sourceWildEndgamePhysicalGuardChecks,locked ? 0:3)
        if !locked {
            XCTAssertEqual(actualEndgameDelayIDs.count,1)
            XCTAssertGreaterThan(game.engine.sourceWildEndgameActiveVerificationChecks,0,"Actual after-primary verification reads retained physical holders")
        }
        XCTAssertEqual(game.engine.sourceDirectNormalLockedBonusGuardChecks,locked ? 2:0)
        XCTAssertEqual(game.engine.sourceDirectEndgameLockedBonusGuardChecks,hardPrimary || endgame ? 2:0)
        XCTAssertEqual(scene.sourceDirectLockedBonusGuardAwaitDeliveredCount,locked || hardPrimary || endgame ? 2:0)
        XCTAssertNil(game.engine.pendingSourceDirectLockedBonusGuard)
        XCTAssertEqual(game.engine.sourceWildExtraFinalGuardChecks,locked || hardPrimary || endgame ? 2:0,"Original Arcade skips the extra helper; Journey still awaits both guards")
        if archetype == .star {XCTAssertEqual(guardedStarExtraOpenIDs.count,3,"All three genuine Star extra face commits follow both physical guard reactions")}
        XCTAssertEqual(scene.sourceWildSpawnOwnerBeginCount,1)
        XCTAssertEqual(scene.sourceWildSpawnOwnerResetCount,1)
        XCTAssertNil(scene.captureSourceMergeSixSpawnInProgress(),"Idle remains unknown until every genuine acquisition caller is admitted")
        XCTAssertGreaterThanOrEqual(scene.sourceMeterGuardReleaseRequestCount,2,"Actual special release and spawn reset retain their queue requests; absence of a queue is not observed as false")
        XCTAssertNil(scene.captureSourceMeterQueueSignals(),"Unbound delivery remains unknown")
        XCTAssertEqual(scene.sourceMeterGuardReleasePendingGeneration,game.engine.state.generation)
        let primaryID=try XCTUnwrap(negativeHard ? primarySourceIDs.first(where:{!hardSourceIDs.contains($0)}):primarySourceIDs.first)
        let primaryHolder=try XCTUnwrap(scene.sourceNativeTileNode(primaryID))
        try await wait{!primaryHolder.sourceRegularFramePending && scene.sourceWildOpenBounceCount==0}
        XCTAssertGreaterThan(primaryHolder.value,0);XCTAssertFalse(primaryHolder.locked)
        XCTAssertNil(primaryHolder.visual.action(forKey:"native-wild-spawn"))
        XCTAssertGreaterThanOrEqual(game.engine.state.score,locked || hardPrimary || endgame ? 123:223,"Arcade and Journey preserve their own reward rules")
        XCTAssertFalse(game.engine.state.tiles.contains{$0.id=="juice"})
        XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
        if negativeHard {game.engine.sourceFinalMergePresenceAuthority=originalPresenceAuthority}
        host.dispose()
        XCTAssertNil(scene.sourceMeterGuardReleasePendingGeneration,"Exact graph retirement drops its pending request without installing a queue")
        XCTAssertNil(game.engine.sourceWildSpawnBegin)
        XCTAssertFalse(game.engine.sourceDirectNormalPreSpawnGuardsEnabled)
        XCTAssertFalse(game.engine.sourceWildEndgamePhysicalGuardsEnabled)
        XCTAssertNil(game.engine.pendingSourceDirectInitialAwait)
        XCTAssertFalse(game.engine.sourceDirectNormalLockedBonusGuardsEnabled)
        XCTAssertFalse(game.engine.sourceDirectEndgameLockedBonusGuardsEnabled)
        XCTAssertNil(game.engine.sourceDirectLockedBonusGuardResume);XCTAssertNil(game.engine.pendingSourceDirectLockedBonusGuard)
        XCTAssertNil(game.engine.sourceOrdinaryMinimumTileAuthority)
        XCTAssertNil(game.engine.sourceWildMinimumTileAuthority)
        XCTAssertNil(game.engine.sourceFinalMergePresenceAuthority)
        XCTAssertFalse(minimumTiles.isCurrent())
        XCTAssertEqual(scene.sourceWildSpawnOwnerResetCount,1)
    }
    func testExplicitMagnetResumeRootUsesActualPullAndSameDestination()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-magnet-app-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"magnet",cell:.init(column:0,row:0),value:6,archetype:.magnet),
            .init(id:"destination",cell:.init(column:1,row:0),value:2),
            .init(id:"near",cell:.init(column:2,row:0),value:3),
            .init(id:"far",cell:.init(column:4,row:8),value:1)],mode:.arcade,moves:37,score:123,wildMeter:0.4)
        try store.save(seed)
        // One common APP stream from root acquisition, not a per-Scene reset.
        // Keep the next sub-six contact deterministic while retaining every actual FX/logical draw.
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceOrdinaryPresentationEnabled:true,
            sourceOrdinaryResumeEnabled:true,sourceMagnetPresentationEnabled:true,sourceVisualRandom:{0.1})
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeMagnetRoot",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertTrue(game.engine.sourceMagnetMain80Enabled);XCTAssertTrue(game.engine.sourceMagnetLazyRespawnEnabled)
        let scope=try XCTUnwrap(game.sourceScope)
        XCTAssertEqual(scene.captureSourceMagnetPullInProgress(scope:scope),false)
        XCTAssertEqual(scene.captureSourceGameplayRuntime(isWild:true)?.observedGlobalOwners?.wildMagnetPullInProgress,false)
        let destination=try XCTUnwrap(scene.sourceNativeTileNode("destination")),geometry=try XCTUnwrap(scene.boardGeometry),service=try XCTUnwrap(host.sourceRuntime).service
        let from=geometry.center(row:0,column:0),to=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.sourceSpecialAbsorbMainEntered && scene.sourceMagnetActualPullOwnerCount==1}
        XCTAssertEqual(scene.captureSourceMagnetPullInProgress(scope:scope),true)
        XCTAssertEqual(scene.captureSourceGameplayRuntime(isWild:true)?.observedGlobalOwners?.wildMagnetPullInProgress,true)
        try await wait{scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty && destination.sourceMergeSixFaceReady(service:service)}
        XCTAssertEqual(scene.captureSourceMagnetPullInProgress(scope:scope),false)
        XCTAssertEqual(scene.captureSourceGameplayRuntime(isWild:true)?.observedGlobalOwners?.wildMagnetPullInProgress,false)
        XCTAssertTrue(scene.sourceNativeTileNode("destination") === destination)
        XCTAssertFalse(game.engine.state.tiles.contains{$0.id=="magnet"})
        XCTAssertFalse(try XCTUnwrap(game.sourceScope).registries.missing([.magnetGuardBeginFinally]).contains("magnetGuardBeginFinally"))
        XCTAssertTrue(try XCTUnwrap(scene.captureSourcePhysicalBoard()).isStillCurrent())
        let other=try XCTUnwrap(game.engine.state.tiles.first{$0.id != "destination" && !$0.isWild && !$0.locked && $0.value+destination.sourceValue<6})
        let value=other.value+destination.sourceValue,before=game.engine.state.moves
        let next=geometry.center(row:other.cell.row,column:other.cell.column)
        XCTAssertTrue(scene.beginDrag(at:next));scene.moveDrag(to:to,now:CACurrentMediaTime())
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{destination.sourceValue==value && !game.engine.hasPendingSourceOrdinaryStackFace && game.engine.pendingOrdinaryPostchecks.isEmpty && game.engine.pendingOrdinaryStack==nil}
        // Original awaited stuck classification returns before moves--. Random
        // actual respawns can make this the last legal pair; assert that branch
        // rather than demanding another payable move after the board is stuck.
        var postcheckFlags=game.engine.flags;postcheckFlags.busyEnding=false
        let stuck=NativeGameplayResolver.resolve(state:game.engine.state,flags:postcheckFlags).kind == .fail
        XCTAssertEqual(game.engine.state.moves,stuck ? before:before-1)
        XCTAssertTrue(scene.sourceNativeTileNode("destination") === destination)
    }
    func testRootOrdinarySourceHandoffAndSixUseLiveAppOwners()async throws {
        try await runRootGuidedDrags(ordinary:true)
    }
    func testRootGuidedDragsAndCTAUseLiveTransportAcrossBackgroundAndRecreation()async throws {
        try await runRootGuidedDrags(ordinary:false)
    }
    func testCompleteNativeRootEarnedTutorialStarUsesActualCanonicalQueue()async throws {
        try await runRootGuidedDrags(ordinary:true,direct:true,osEarning:true,completeNative:true)
    }
    private func runRootGuidedDrags(ordinary:Bool,direct:Bool=false,osEarning:Bool=false,completeNative:Bool=false)async throws {
        let previous=NativeSourceAnimationClockService.shared
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-live-guide-\(UUID().uuidString)")
        let store=NativeSaveStore(directory:directory)
        try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        var hosts:[NativeStandaloneViewController]=[]
        defer{hosts.forEach{$0.dispose()};window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        func wait(_ name:String,_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(15)
            while !predicate() {
                guard Date()<deadline else{
                    print("[NativeLiveGuide] timeout \(name)")
                    throw NSError(domain:"NativeLiveGuide.\(name)",code:1)
                }
                try await Task.sleep(for:.milliseconds(20))
            }
        }
        func open()async throws->(NativeStandaloneViewController,NativeAppController,NativeGameplayViewController) {
            let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceFreshTutorialEnabled:true,sourceOrdinaryPresentationEnabled:ordinary,sourceDirectPresentationEnabled:direct,completeNativeGameplayEnabled:completeNative)
            hosts.append(host);window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            try await wait("home"){!app.home.isHidden}
            app.navigate(.gameplay,interrupt:true)
            try await wait("preparation"){
                app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.sourceTutorialPreparationReady == true
            }
            return(host,app,try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first))
        }
        let (host,app,game)=try await open()
        let runtime=try XCTUnwrap(host.sourceRuntime),scene=try XCTUnwrap(game.boardScene)
        let overlay=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeTutorialOverlay}.first)
        let intro=try XCTUnwrap(overlay.sourceIntroOwner)
        try await wait("first sheet"){abs(overlay.sourceSheetTranslation)<0.001 && overlay.sourcePointerVisible && overlay.sourcePointerAlpha>0.99}
        let physicalBoard=try XCTUnwrap(scene.captureSourcePhysicalBoard())
        XCTAssertEqual(physicalBoard.canonicalState,game.engine.state)
        let paintReceipt=try XCTUnwrap(physicalBoard.paintedStateReceipt)
        XCTAssertEqual(paintReceipt.canonicalState,game.engine.state)
        XCTAssertEqual(paintReceipt.paintedState,physicalBoard.observedState)
        XCTAssertEqual(Set(physicalBoard.tiles.keys),Set(game.engine.state.tiles.map(\.id)))
        for tile in game.engine.state.tiles {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
            let physical=try XCTUnwrap(physicalBoard.tiles[tile.id])
            XCTAssertEqual(physical.tile.cell,node.sourceGridCell)
            XCTAssertEqual(physical.tile.alpha,node.sourceAlpha)
            XCTAssertEqual(physical.pendingStackFrames,node.sourcePendingStackFrameCount)
        }
        XCTAssertTrue(game.engine.sourceTutorialSubsequentPresentationEnabled)
        func drag(_ sourceID:String,_ targetID:String)async throws {
            let source=try XCTUnwrap(scene.sourceNativeTileNode(sourceID)),target=try XCTUnwrap(scene.sourceNativeTileNode(targetID))
            let start=scene.convert(source.position,from:try XCTUnwrap(source.parent))
            let end=scene.convert(target.position,from:try XCTUnwrap(target.parent))
            XCTAssertTrue(scene.beginDrag(at:start))
            let heldCell=try XCTUnwrap(source.sourceGridCell)
            scene.moveDrag(to:end,now:Date().timeIntervalSince1970)
            XCTAssertEqual(source.sourceGridCell,heldCell,"Painted drag must not rewrite actual Source c/r")
            var conflicting=try XCTUnwrap(game.engine.state.tiles.first{$0.id==sourceID})
            conflicting.cell = .init(column:99,row:99)
            XCTAssertEqual(try XCTUnwrap(scene.sourcePhysicalTileObservation(conflicting)).tile.cell,heldCell)
            try await Task.sleep(for:.milliseconds(160))
            let result=try XCTUnwrap(scene.finishDrag(at:end,now:Date().timeIntervalSince1970))
            if !result.accepted {
                print("[NativeLiveGuide] rejected",sourceID,targetID,result.events.map{($0.kind.rawValue,$0.reason ?? "")},
                      "source",source.sourceValue,source.sourceStackDepth,"target",target.sourceValue,target.sourceStackDepth,
                      "core",game.engine.state.tiles.filter{$0.id==sourceID || $0.id==targetID},
                      "sixFace",target.sourceMergeSixFaceReady(service:runtime.service),"idle",scene.sourceSpecialIdleAdmissionOpen)
            }
            XCTAssertTrue(result.accepted)
        }
        let pair=try XCTUnwrap(game.engine.state.tutorial?.guidedPair),one=try XCTUnwrap(game.engine.state.tutorial?.oneTileID)
        let ordinaryDestination=try XCTUnwrap(scene.sourceNativeTileNode(pair[1]))
        try await drag(pair[0],pair[1])
        if ordinary {
            XCTAssertTrue(scene.sourceRegularStackHandoffEnabled)
            XCTAssertTrue(scene.sourceStackCoreFaceReceiptsEnabled)
            XCTAssertTrue(scene.sourceOrdinarySixSameNodeEnabled)
            XCTAssertTrue(game.engine.sourceOrdinaryStackFacesEnabled)
            XCTAssertTrue(scene.sourceNativeTileNode(pair[1]) === ordinaryDestination)
            XCTAssertTrue(game.engine.hasPendingSourceOrdinaryStackFace)
        }
        try await wait("second"){scene.sourceTutorialSecondPreparationReady && game.engine.pendingSourceTutorialPresentationBarrier == nil}
        XCTAssertTrue(overlay.sourceIntroOwner === intro)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let snapshot=game.engine.state
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertEqual(game.engine.state,snapshot)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await drag(one,pair[1])
        try await wait("third"){scene.sourceTutorialThirdPresentationActive && game.engine.pendingSourceTutorialPresentationBarrier == nil}
        try await wait("CTA"){overlay.sourceCTAState == .idle && abs(overlay.sourceSheetTranslation)<0.001}
        let button=try XCTUnwrap(overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UIButton}.first)
        button.sendActions(for:.touchDown);button.sendActions(for:.touchUpInside)
        try await wait("CTA exit"){game.engine.state.tutorial?.waitingForWild == true && overlay.sourceCTAState == .hidden}
        XCTAssertTrue(overlay.sourceIntroOwner === intro)
        XCTAssertNil(game.sourcePresentationFailureGeneration)
        XCTAssertFalse(game.engine.state.tutorial?.guideCompleted == true)
        XCTAssertTrue(game.engine.stagedMeterOpen);XCTAssertTrue(game.engine.stagedMeterDrops)
        if ordinary && !direct {
            XCTAssertTrue(game.engine.pendingSourceOrdinaryStackFaces.isEmpty)
            XCTAssertNil(game.engine.pendingOrdinaryStack);XCTAssertNil(game.engine.pendingOrdinarySix)
            XCTAssertEqual(scene.sourceSameObjectSixCount,0)
            host.dispose()
            XCTAssertTrue(runtime.disposed);XCTAssertEqual(runtime.fifo.pendingCount,0)
            XCTAssertTrue(app.children.isEmpty)
            XCTAssertTrue(NativeSourceAnimationClockService.shared === previous)
            return
        }
        // Earn the fourth step through real legal free-play drops. Never inject
        // a Star, mutate the meter or manually deliver an animation callback.
        if osEarning {
            var observedSourceOpenBounce=false
            var interruptedSourceOpenBounce=false
            var observedSourceDrop=false
            let moves:[(NativeCell,NativeCell)]=[
                (.init(column:0,row:0),.init(column:1,row:0)),(.init(column:2,row:0),.init(column:1,row:0)),
                (.init(column:2,row:2),.init(column:3,row:2)),(.init(column:0,row:2),.init(column:1,row:2)),
                (.init(column:3,row:2),.init(column:1,row:2))]
            for (from,to) in moves {
                try await drag(try XCTUnwrap(game.engine.state.tile(at:from)).id,try XCTUnwrap(game.engine.state.tile(at:to)).id)
                let settledAt=Date().addingTimeInterval(1.5)
                while Date()<settledAt {
                    for drop in game.engine.meterDropReservations.values {
                        guard let node=scene.sourceNativeTileNode(drop.tileID),
                              let markers=scene.sourceWildDropTileMarkers(node),markers.dropping else{continue}
                        if !observedSourceDrop {
                            observedSourceDrop=true
                            XCTAssertGreaterThan(try XCTUnwrap(scene.captureSourceWildDropActiveCount()),0)
                            let saveMarkers=try XCTUnwrap(scene.captureSourceSaveTileMarkers(id:node.tileID))
                            XCTAssertEqual(saveMarkers.wildSpawnDropping,markers.dropping)
                            XCTAssertEqual(saveMarkers.wildSpawnHandoffLock,markers.handoffLocked)
                            let position=node.position
                            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                            try await Task.sleep(for:.milliseconds(250))
                            XCTAssertEqual(scene.sourceWildDropTileMarkers(node),markers)
                            XCTAssertEqual(scene.captureSourceSaveTileMarkers(id:node.tileID),saveMarkers)
                            XCTAssertGreaterThan(try XCTUnwrap(scene.captureSourceWildDropActiveCount()),0)
                            XCTAssertEqual(node.position,position)
                            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                        }
                    }
                    observedSourceOpenBounce = observedSourceOpenBounce || scene.sourceOrdinaryOpenBounceCount>0
                    if !interruptedSourceOpenBounce,!game.engine.flags.isWaiting,
                       let id=scene.sourceOrdinaryOpenBounceTileIDs.first,
                       let node=scene.sourceNativeTileNode(id),let parent=node.parent {
                        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                        let scale=CGPoint(x:node.xScale,y:node.yScale),tilt=node.dragInnerTilt
                        try await Task.sleep(for:.milliseconds(250))
                        XCTAssertEqual(CGPoint(x:node.xScale,y:node.yScale),scale)
                        XCTAssertEqual(node.dragInnerTilt,tilt)
                        XCTAssertTrue(scene.sourceOrdinaryOpenBounceTileIDs.contains(id))
                        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                        let start=scene.convert(node.position,from:parent)
                        XCTAssertTrue(scene.beginDrag(at:start),"Genuine newly opened holder must accept pickup during its Source bounce")
                        XCTAssertTrue(scene.sourceOrdinaryOpenBounceTileIDs.contains(id),"Pickup removes captured children; parent completion waits actual Source delivery")
                        try await wait("picked-up Source bounce parent completion"){!scene.sourceOrdinaryOpenBounceTileIDs.contains(id)}
                        scene.cancelDrag(pointerCancelled:true)
                        interruptedSourceOpenBounce=true
                    }
                    try await Task.sleep(for:.milliseconds(20))
                }
            }
            XCTAssertTrue(observedSourceOpenBounce,"Actual ordinary openings must use the shared Source app-spawn bounce")
            XCTAssertTrue(interruptedSourceOpenBounce)
            if completeNative,!observedSourceDrop {
                let runtime=scene.captureSourceGameplayRuntime(isWild:false)
                let permission=runtime?.meterEnvironment.map{game.engine.meterSourceQueuePermission(environment:$0)}
                let physical=scene.captureSourcePhysicalBoard()
                let invalidObjects=game.engine.state.tiles.compactMap {tile->String? in
                    guard let node=scene.sourceNativeTileNode(tile.id) else{return "missing-node:"+tile.id}
                    if node.sourceGridCell != tile.cell || node.sourceGeneration != game.engine.state.generation || !node.sourcePhysicalMarkersCovered || scene.captureSourceGameplayTileMarkers(tile.id)==nil {
                        return "\(tile.id):cell=\(String(describing:node.sourceGridCell)):covered=\(node.sourcePhysicalMarkersCovered):markers=\(scene.captureSourceGameplayTileMarkers(tile.id) != nil)"
                    }
                    return nil
                }
                XCTFail("Actual Native earned queue: physical=\(physical != nil); invalid=\(invalidObjects); missing=\(String(describing:runtime?.missingOwners)); permission=\(String(describing:permission)); meter=\(game.engine.state.wildMeter); lastMerge=\(game.engine.sourceMeterLastMergeTileIDs); resolution=\(game.engine.resolve()); flags=\(game.engine.flags); guardRequests=\(scene.sourceMeterGuardReleaseRequestCount)")
            }
            XCTAssertTrue(observedSourceDrop,"Actual earned carrier must publish its own Source dropping marker")
            XCTAssertEqual(scene.sourceOrdinaryOpenBounceCount,0)
        }
        for _ in 0..<30 where !osEarning && game.engine.sourceTutorialFourthPreparation == nil {
            if game.engine.sourceMeterSpawnInProgress || game.engine.state.wildSpawnCount>0 {break}
            let tiles=game.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0}
            var move:(String,String)?
            for source in tiles where move == nil {
                for target in tiles where move == nil && source.id != target.id {
                    if NativeGameplayResolver.canDrop(source,onto:target),source.value+target.value<=6 {
                        move=(source.id,target.id)
                    }
                }
            }
            let chosen=try XCTUnwrap(move)
            try await drag(chosen.0,chosen.1)
            try await Task.sleep(for:.milliseconds(1200))
        }
        try await wait("earned fourth"){game.engine.sourceTutorialFourthPreparation != nil}
        let fourth=try XCTUnwrap(game.engine.sourceTutorialFourthPreparation)
        try await wait("fourth landing"){!game.engine.sourceMeterHandoffInProgress && scene.sourceNativeTileNode(fourth.wildID)?.sourcePlainStarArtworkSprite != nil}
        try await wait("fourth sheet"){abs(overlay.sourceSheetTranslation)<0.001 && overlay.sourcePointerVisible && overlay.sourcePointerAlpha>0.99}
        let landedWild=try XCTUnwrap(scene.sourceNativeTileNode(fourth.wildID))
        XCTAssertEqual(scene.sourceWildDropTileMarkers(landedWild),.init(dropping:false,handoffLocked:false))
        let landedSaveMarkers=try XCTUnwrap(scene.captureSourceSaveTileMarkers(id:landedWild.tileID))
        XCTAssertFalse(landedSaveMarkers.wildSpawnDropping)
        XCTAssertFalse(landedSaveMarkers.wildSpawnHandoffLock)
        XCTAssertEqual(scene.captureSourceWildDropActiveCount(),0)
        if direct {
            let service=try XCTUnwrap(game.sourceScope?.service)
            for tile in game.engine.state.tiles where tile.cell.row<=min(game.engine.state.rows-1,5) {
                guard let node=scene.sourceNativeTileNode(tile.id),!node.sourceLocked,!node.isSpecial,node.sourceValue>0 else{continue}
                XCTAssertEqual(node.sourceValue,tile.value,"Every genuine fourth-pointer target must match Core: \(tile.id)")
                XCTAssertTrue(node.sourceMergeSixFaceReady(service:service),"Every genuine fourth-pointer target needs its retained Source face caller: \(tile.id)")
            }
        }
        let screenshot=XCTAttachment(image:UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)})
        screenshot.name="native-live-root-earned-star-guide";screenshot.lifetime = .keepAlways;add(screenshot)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let fourthSnapshot=game.engine.state
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertEqual(game.engine.state,fourthSnapshot)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await drag(fourth.wildID,fourth.targetID)
        if direct {
            XCTAssertTrue(scene.sourceDirectWildSameNodeEnabled)
            XCTAssertTrue(scene.sourceHUDStarJobsAdmissionOpen)
            XCTAssertNotNil(game.engine.sourceDirectWildPrefix)
            XCTAssertEqual(scene.sourceSameObjectSixCount,1)
        }
        try await wait("guide completion"){game.engine.state.tutorial?.guideCompleted == true && game.engine.state.tutorial?.active == false}
        XCTAssertNil(overlay.sourceIntroOwner);XCTAssertNil(game.sourcePresentationFailureGeneration)
        // Guide exit is independent from the later Tutorial Complete Continue.
        try await wait("coherent guide"){!game.engine.hasUnsavableSourceGameplayState && NativeSaveEnvelope.isCoherentRun(game.engine.state)}
        if direct {XCTAssertEqual(game.engine.sourceWildExtraFinalGuardChecks,0,"Actual Arcade earned Star skips the Source extra helper")}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        let persisted=try XCTUnwrap(store.load())
        XCTAssertEqual(persisted.arcadeRun?.tutorial?.guideCompleted,true)
        XCTAssertFalse(persisted.progression.firstPlayTutorialComplete)
        // No direct engine mutations, synthetic clock frames or resume bypass.
        host.dispose()
        XCTAssertTrue(runtime.disposed);XCTAssertFalse(runtime.service.hasActiveClock)
        XCTAssertEqual(runtime.fifo.pendingCount,0)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === previous)
        XCTAssertTrue(app.children.isEmpty)
        let (_,_,reopened)=try await open()
        XCTAssertEqual(reopened.engine.state.tutorial?.step,.stack)
        XCTAssertFalse(reopened.engine.state.tutorial?.guideCompleted == true)
        XCTAssertNil(reopened.sourcePresentationFailureGeneration)
    }
    func testActualFirstPlayRestartReconstructsSourceGuideAndRetiresPreviousPointer()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-guide-restart-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceFreshTutorialEnabled:true,sourceOrdinaryPresentationEnabled:true,sourceDirectPresentationEnabled:true)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(30)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeSourceGuideRestart",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.sourceTutorialPreparationReady==true}
        let old=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scope=try XCTUnwrap(old.sourceScope),generation=old.engine.state.generation
        old.onExit?();try await wait{old.presentedViewController is JimiNativeEndRunModal}
        let modal=try XCTUnwrap(old.presentedViewController as? JimiNativeEndRunModal)
        try await wait{modal.view.isUserInteractionEnabled};modal.buttons[0].sendActions(for:.touchUpInside)
        try await wait{
            guard let next=app.children.compactMap({$0 as? NativeGameplayViewController}).first,next !== old else{return false}
            return next.boardScene?.sourceTutorialPreparationReady==true
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        XCTAssertFalse(scope.current);XCTAssertNil(old.boardScene);XCTAssertNil(old.parent)
        XCTAssertTrue(game.sourceScope?.service === scope.service);XCTAssertEqual(game.engine.state.generation,generation+1)
        XCTAssertNotNil(game.engine.state.tutorial);XCTAssertNil(game.engine.pendingSourceTutorialDemoActivation)
        XCTAssertEqual(scene.completedSourceBoardEntry?.outcome,.normal);XCTAssertTrue(scene.sourceTutorialHUDActive)
        XCTAssertEqual(game.engine.state.tiles.count,45);XCTAssertFalse(game.sourceInitialBoardSaveAccepted)
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(app.home.isHidden)
    }
    func testExplicitRootFreshTutorialCompletesEntryOnItsOwnSourceTransport()async throws {
        let previous=NativeSourceAnimationClockService.shared
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-root-guide-\(UUID().uuidString)")
        let store=NativeSaveStore(directory:directory)
        try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceFreshTutorialEnabled:true)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        let runtime=try XCTUnwrap(host.sourceRuntime),app=try XCTUnwrap(host.children.first as? NativeAppController)
        let homeDeadline=Date().addingTimeInterval(15)
        while app.home.isHidden && Date()<homeDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertFalse(app.home.isHidden)
        app.navigate(.gameplay,interrupt:true)
        let deadline=Date().addingTimeInterval(15)
        var game:NativeGameplayViewController?
        while Date()<deadline {
            game=app.children.compactMap{$0 as? NativeGameplayViewController}.first
            if game?.boardScene?.sourceTutorialPreparationReady==true {break}
            try await Task.sleep(for:.milliseconds(20))
        }
        let mounted=try XCTUnwrap(game),scene=try XCTUnwrap(mounted.boardScene)
        XCTAssertTrue(scene.sourceTutorialPreparationReady)
        XCTAssertEqual(scene.completedSourceBoardEntry?.outcome,.normal)
        XCTAssertTrue(mounted.sourceScope?.service === runtime.service)
        XCTAssertTrue(scene.sourceTutorialHUDActive)
        XCTAssertNil(mounted.engine.pendingSourceTutorialDemoActivation)
        XCTAssertEqual(mounted.engine.state.tiles.count,45)
        XCTAssertFalse(previous.hasActiveClock)
        host.dispose();XCTAssertFalse(runtime.service.hasActiveClock)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === previous)
    }
    func testExplicitRootOwnsOneSourceTransportAndRestoresDefaultOnDisposal()throws {
        let previous=NativeSourceAnimationClockService.shared
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-source-root-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceTransportEnabled:true)
        defer{host.dispose()}
        host.loadViewIfNeeded()
        let runtime=try XCTUnwrap(host.sourceRuntime)
        XCTAssertTrue(host.children.first is NativeAppController)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === runtime.service)
        XCTAssertFalse(previous.hasActiveClock)
        host.dispose();host.dispose()
        XCTAssertTrue(runtime.disposed);XCTAssertFalse(runtime.service.hasActiveClock)
        XCTAssertEqual(runtime.fifo.pendingCount,0);XCTAssertNil(host.sourceRuntime)
        XCTAssertTrue(NativeSourceAnimationClockService.shared === previous)
    }
    func testBusyRootRefusesBeforeAnyProfileAccess()throws {
        let previous=NativeSourceAnimationClockService.shared
        let blocker=try XCTUnwrap(NativeSourceApplicationRuntime.acquire())
        defer{blocker.dispose()}
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-busy-root-\(UUID().uuidString)")
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:NativeSaveStore(directory:directory),sourceTransportEnabled:true)
        defer{host.dispose();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded()
        XCTAssertTrue(host.children.isEmpty);XCTAssertNil(host.sourceRuntime)
        XCTAssertFalse(FileManager.default.fileExists(atPath:directory.path))
        XCTAssertTrue(NativeSourceAnimationClockService.shared === blocker.service)
        blocker.dispose();XCTAssertTrue(NativeSourceAnimationClockService.shared === previous)
    }
    func testDefaultNativeIdleHintUsesRealTwentySecondWaitAndPickupClearsItWithoutChangingCore()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-default-hint-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),
            .init(id:"b",cell:.init(column:1,row:0),value:1),.init(id:"c",cell:.init(column:2,row:0),value:4)],mode:.arcade,board:1,stage:1,generation:9,moves:37,score:123)
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(32)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeDefaultHint",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        func findHint(_ view:UIView)->UIView? {
            if view.accessibilityIdentifier=="native.endgame-idle-hint" {return view}
            return view.subviews.compactMap{findHint($0)}.first
        }
        let before=game.engine.state,start=Date()
        XCTAssertNil(findHint(game.view));XCTAssertNil(host.sourceRuntime)
        try await wait{findHint(game.view) != nil}
        XCTAssertGreaterThan(Date().timeIntervalSince(start),18)
        let hint=try XCTUnwrap(findHint(game.view));XCTAssertFalse(hint.isUserInteractionEnabled)
        func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap{v in (v as? UILabel).map{[$0]} ?? labels(v)}}
        try await wait{!labels(hint).isEmpty && labels(hint).allSatisfy{$0.alpha>0.9}}
        XCTAssertEqual(game.engine.state,before,"Original caption/cloud presentation cannot author any gameplay/save field")
        XCTAssertEqual(hint.subviews.compactMap{$0 as? UIImageView}.count,5)
        XCTAssertTrue(labels(hint).allSatisfy{$0.font.fontName=="Baloo2-ExtraBold"})
        let image=UIGraphicsImageRenderer(bounds:game.view.bounds).image{_ in game.view.drawHierarchy(in:game.view.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:image);attachment.name="Native default idle hint original caption and clouds";attachment.lifetime = .keepAlways;add(attachment)
        let geometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        try await wait{findHint(game.view)==nil};XCTAssertEqual(game.engine.state,before)
        scene.cancelDrag(pointerCancelled:true)
        game.setSuspended(true);XCTAssertNil(findHint(game.view))
    }
    func testDefaultNativeArcadeFinalMergeNextRoundNextMoveAndExitPersistWithoutSourceOptIns()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-default-round-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3),
            .init(id:"b",cell:.init(column:1,row:0),value:3)],mode:.arcade,board:1,stage:1,generation:9,moves:37,score:123)
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(35)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeDefaultRound",code:1)};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry),oldGeneration=game.engine.state.generation
        XCTAssertNil(host.sourceRuntime);XCTAssertNil(game.sourceScope);XCTAssertNil(game.sourceInitialConstruction)
        let a=geometry.center(row:0,column:0),b=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.state.generation>oldGeneration && game.engine.state.board==2 && scene.isBoardEntryComplete}
        XCTAssertTrue(game.boardScene === scene);XCTAssertEqual(app.route,.gameplay);XCTAssertNil(game.engine.state.terminal)
        let candidates=game.engine.state.tiles.filter{!$0.locked && !$0.isWild && $0.value>0}
        let pair=try XCTUnwrap(candidates.enumerated().flatMap{i,a in candidates.dropFirst(i+1).filter{a.value+$0.value<6}.map{(a,$0)}}.first)
        let nextGeometry=try XCTUnwrap(scene.boardGeometry),moves=game.engine.state.moves
        let from=nextGeometry.center(row:pair.0.cell.row,column:pair.0.cell.column),to=nextGeometry.center(row:pair.1.cell.row,column:pair.1.cell.column)
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{game.engine.state.moves==moves-1 && game.engine.pendingOrdinaryStack==nil && game.engine.pendingOrdinaryPostchecks.isEmpty}
        game.onExit?();try await wait{game.presentedViewController is JimiNativeEndRunModal}
        let modal=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
        try await wait{modal.view.isUserInteractionEnabled};modal.buttons[1].sendActions(for:.touchUpInside)
        try await wait{app.route == .arcadeHub && !app.arcadeHub.isHidden && game.parent==nil}
        let saved=try XCTUnwrap(store.load()),run=try XCTUnwrap(saved.arcadeRun)
        XCTAssertEqual(run.board,2);XCTAssertEqual(run.generation,oldGeneration+1);XCTAssertEqual(run.moves,moves-1)
        XCTAssertEqual(run.score,game.engine.state.score);XCTAssertNil(saved.pendingArcadeRound)
        XCTAssertTrue(saved.progression.firstPlayTutorialComplete)
        XCTAssertNil(host.sourceRuntime);XCTAssertNil(game.boardScene)
    }
    func testNativeRootMountsFromNativeStoreWithoutHybridShellAndDisposesOnce()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-root-test-\(UUID().uuidString)")
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store)
        host.loadViewIfNeeded()
        XCTAssertTrue(host.children.first is NativeAppController)
        func containsHybrid(_ view:UIView)->Bool {
            NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsHybrid)
        }
        XCTAssertFalse(containsHybrid(host.view))
        XCTAssertFalse(host.children.contains{NSStringFromClass(type(of:$0)).hasSuffix(".GameViewController")})
        XCTAssertEqual(try store.load()?.settings,seed.settings)
        host.dispose();host.dispose();XCTAssertTrue(host.disposed);XCTAssertTrue(host.children.isEmpty)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(host.children.isEmpty)
    }
    func testDefaultStoryboardBuildsNativeRootAndPlainUIKitSurface()throws {
        let storyboard=UIStoryboard(name:"Main",bundle:Bundle.main)
        let host=try XCTUnwrap(storyboard.instantiateInitialViewController() as? NativeStandaloneViewController)
        // Coder construction must not read or migrate any profile. Retire
        // before loading to inspect the exact default root independently.
        XCTAssertFalse(host.isViewLoaded);host.dispose();host.loadViewIfNeeded()
        XCTAssertTrue(type(of:host.view!) == UIView.self)
        XCTAssertTrue(host.children.isEmpty)
    }
    #if DEBUG && targetEnvironment(simulator)
    func testSourceOSCapabilityRequiresExplicitFlagDedicatedDeviceAndIsolatedProfile() {
        var environment=["SIMULATOR_UDID":"1018BE2D-491B-465F-8F75-3E5BEB38C22A","CC_NATIVE_QA_PROFILE_ID":UUID().uuidString]
        let product="com.taptapdesign.stacktosix.native"
        XCTAssertFalse(NativeSimulatorSourceQA.admitted(environment:environment,bundleIdentifier:product))
        environment["CC_NATIVE_QA_SOURCE_FRESH_TUTORIAL"]="1"
        XCTAssertTrue(NativeSimulatorSourceQA.admitted(environment:environment,bundleIdentifier:product))
        XCTAssertFalse(NativeSimulatorSourceQA.admitted(environment:environment,bundleIdentifier:"other.product"))
        XCTAssertFalse(NativeSimulatorSourceQA.admittedOrdinary(environment:environment,bundleIdentifier:product))
        environment["CC_NATIVE_QA_SOURCE_DIRECT"]="1"
        XCTAssertFalse(NativeSimulatorSourceQA.admittedDirect(environment:environment,bundleIdentifier:product))
        environment["CC_NATIVE_QA_SOURCE_ORDINARY"]="1"
        XCTAssertTrue(NativeSimulatorSourceQA.admittedOrdinary(environment:environment,bundleIdentifier:product))
        XCTAssertTrue(NativeSimulatorSourceQA.admittedDirect(environment:environment,bundleIdentifier:product))
        XCTAssertFalse(NativeSimulatorSourceQA.admittedDirect(environment:environment,bundleIdentifier:"other.product"))
        environment["CC_NATIVE_QA_PROFILE_ID"]="../normal"
        XCTAssertFalse(NativeSimulatorSourceQA.admittedDirect(environment:environment,bundleIdentifier:product))
        XCTAssertFalse(NativeSimulatorSourceQA.admitted(environment:environment,bundleIdentifier:product))
        environment["CC_NATIVE_QA_PROFILE_ID"]=UUID().uuidString;environment["SIMULATOR_UDID"]="other-device"
        XCTAssertFalse(NativeSimulatorSourceQA.admitted(environment:environment,bundleIdentifier:product))
    }
    func testIsolatedProcessProfileCannotSelectNormalOrOtherDeviceStore()throws {
        let root=FileManager.default.temporaryDirectory,id=UUID().uuidString
        var environment=["SIMULATOR_UDID":"1018BE2D-491B-465F-8F75-3E5BEB38C22A","CC_NATIVE_QA_PROFILE_ID":id]
        let directory=try XCTUnwrap(NativeSimulatorQAProfile.directory(environment:environment,bundleIdentifier:"com.taptapdesign.stacktosix.native",temporaryDirectory:root))
        XCTAssertEqual(directory.deletingLastPathComponent(),root)
        XCTAssertNil(NativeSimulatorQAProfile.directory(environment:environment,bundleIdentifier:"com.taptapdesign.stacktosix.Stack-to-Six",temporaryDirectory:root))
        environment["SIMULATOR_UDID"]="other-device"
        XCTAssertNil(NativeSimulatorQAProfile.directory(environment:environment,bundleIdentifier:"com.taptapdesign.stacktosix.native",temporaryDirectory:root))
        environment["SIMULATOR_UDID"]="1018BE2D-491B-465F-8F75-3E5BEB38C22A";environment["CC_NATIVE_QA_PROFILE_ID"]="../StackToSixNative"
        XCTAssertNil(NativeSimulatorQAProfile.directory(environment:environment,bundleIdentifier:"com.taptapdesign.stacktosix.native",temporaryDirectory:root))
    }
    func testProcessProfileReopenRetainsDurableBytesAndDoesNotResetSettings()throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-process-profile-test-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let first=try NativeSimulatorQAProfile.prepare(directory:directory)
        var seed=try XCTUnwrap(first.load());seed.settings.musicEnabled=true;seed.progression.firstPlayTutorialComplete=true;try first.save(seed)
        let file=directory.appendingPathComponent("state-v1.json"),bytes=try Data(contentsOf:file)
        let reopened=try NativeSimulatorQAProfile.prepare(directory:directory)
        XCTAssertEqual(try reopened.load(),seed);XCTAssertEqual(try Data(contentsOf:file),bytes)
    }
    #endif
    func testRetiredRootCannotMountAfterLateViewLoading()async throws {
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root)
        host.dispose();host.loadViewIfNeeded()
        XCTAssertTrue(host.children.isEmpty)
    }
}
