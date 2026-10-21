import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

/// Actual complete Native root, normal restored canonical Wild ownership. This
/// matrix checks visual admission separately from the earned-reward policy.
@MainActor
final class NativeWildMergeSixRootTests:XCTestCase {
    private var timeoutDiagnostic:(()->String)?
    private var boardScaleAudit:(()->Void)?
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){
            boardScaleAudit?()
            guard Date()<deadline else{XCTFail("WildMergeSixRoot timeout=\(label) \(timeoutDiagnostic?() ?? "")");throw NSError(domain:label,code:1)}
            try await Task.sleep(for:.milliseconds(20))
        }
        boardScaleAudit?()
    }
    func testBeachBallMergeKeepsUnrelatedBoardDiceFullSize()async throws {
        try await exercise(archetype:.tnt,variant:"beach-ball",reverse:false,disposeDuringMain:false,moves:49,verifyBoardScale:true)
    }
    func testAllArchetypesAndVariantsKeepUnrelatedBoardDiceFullSizeBothDirections()async throws {
        let choices=NativeWildArchetype.allCases.map{($0,Optional<String>.none)} +
            NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype,Optional($0.id))}
        for (archetype,variant) in choices {
            for reverse in [false,true] {
                try await exercise(archetype:archetype,variant:variant,reverse:reverse,disposeDuringMain:false,moves:49,verifyBoardScale:true)
            }
        }
    }
    func testAllSeventeenCoreAndVariantWildsUseActualSourceMainPullAndImpactParticlesInBothDirections()async throws {
        let core=NativeWildArchetype.allCases.map{($0,Optional<String>.none)}
        let variants=NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype,Optional($0.id))}
        for (archetype,variant) in core+variants {
            try await exercise(archetype:archetype,variant:variant,reverse:false)
            try await exercise(archetype:archetype,variant:variant,reverse:true)
        }
    }
    func testBaloonJourneyBlockerSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:false)
    }
    func testBaloonJourneyBlockerDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:false)
    }
    func testBaloonJourneyFinalSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:false)
    }
    func testBaloonJourneyFinalDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:false)
    }
    func testBaloonArcadeBlockerSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:true)
    }
    func testBaloonArcadeBlockerDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:true)
    }
    func testBaloonArcadeFinalSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true)
    }
    func testBaloonArcadeFinalDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true)
    }
    func testSoleBaloonDestinationActualArcadeMergeMountsSVGAndBalloons()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,arcadeRun:true,verifyBaloonRetirement:true)
    }
    func testSpaceshipDestinationActualSourceParticlesSettleAndContinue()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:true)
    }
    func testLaserEveryActualContactUsesOrdinaryMergeSixSmokeAndShardsAndSettlesBothDirections()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false)
    }
    func testLaserReplacementStackDuringBounceSettlesAndAdmitsNextMove()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,laserInterveningStack:true)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,laserInterveningStack:true)
    }
    func testArcadeLaserReplacementStackDuringBounceSettlesAndAdmitsNextMove()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,laserInterveningStack:true,arcadeRun:true)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,laserInterveningStack:true,arcadeRun:true)
    }
    func testChargedLaserReplacementInterruptionReleasesMeterQueueAndContinues()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,laserInterveningStack:true,initialMeter:0.8)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,laserInterveningStack:true,arcadeRun:true,initialMeter:0.8)
    }
    func testCoreTNTArcadeDestinationActualImpactSharedLayersSettleAndContinue()async throws {
        try await exercise(archetype:.tnt,variant:nil,reverse:true,disposeDuringMain:false,moves:49,arcadeRun:true)
    }
    func testCoreTNTDestinationActualImpactSharedLayersSettleAndContinue()async throws {
        // A restored fixture must contain a committed move;50/50 is correctly
        // treated as unplayed and replaced before any TNT presentation exists.
        try await exercise(archetype:.tnt,variant:nil,reverse:true,disposeDuringMain:false,moves:49)
    }
    func testTutorialAssistFinalStarMergeShowsCompletionAndContinue()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:0,tutorialAssist:true)
    }
    func testArcadeTutorialResultContinueReplacesSourceGenerationAndAdmitsNextMove()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:0,tutorialAssist:true,arcadeTutorial:true)
    }
    func testArcadeStarArchetypesUseJourneyDropsAndAdmitNextActualDrag()async throws {
        for (index,variant) in ([nil,"fish","kanta","cubero","bee"] as [String?]).enumerated() {
            try await exercise(archetype:.star,variant:variant,reverse:index%2==1,disposeDuringMain:false,starCount:1+index%3,arcadeRun:true)
        }
    }
    func testStarSourceAndDestinationSettleAndAdmitNextActualDrag()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:false,disposeDuringMain:false)
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false)
    }
    func testActualStarFinaleKeepsSixtyHzAfterMainParticlesRetire()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:false,disposeDuringMain:false,verifyStarTail:true)
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,verifyStarTail:true)
    }
    func testFinalOnlyStarSourceAndDestinationCompleteInsteadOfReturningToMenu()async throws {
        for count in [0,3] {
            try await exercise(archetype:.star,variant:nil,reverse:false,disposeDuringMain:false,finalOnly:true,starCount:count)
            try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:count)
        }
    }
    func testZeroOrbitStarDestinationNonFinalRetainsGameplayAndContinues()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,starCount:0)
    }
    func testCapturedPhoneFinalStarDestinationWithZeroMovesCompletes()async throws {
        // Read-only GOTOVO capture: exact durable final pair before the refused
        // last Star merge, including moves0, revision52 and source identities.
        let data=Data(#"{"bestScore":20397,"board":2,"columns":5,"combo":4,"cubesCracked":28,"earnedComboBonus":23025,"generation":19,"lastWildDropType":"wild","longestCombo":43,"maxMoves":50,"maxStackDepth":3,"mode":"journey","moves":0,"revision":52,"rngState":1,"rows":9,"score":9173,"stage":2,"starsCount":0,"tiles":[{"alpha":1,"archetype":"wild","cell":{"column":2,"row":3},"id":"native:18:43:2:3:die:29","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":0,"transientSpawn":false,"value":6,"visible":true},{"alpha":1,"cell":{"column":0,"row":8},"id":"native:19:52:0:8:die:3","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true}],"wildDropTypeStreak":5,"wildMeter":0.9519999999999996,"wildSpawnCount":5}"#.utf8)
        let board=try JSONDecoder().decode(NativeBoardState.self,from:data)
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:0,capturedBoard:board)
    }
    func testFreshMeterStarDestinationAfterOrdinaryMergeRetainsGameplay()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,starCount:0,freshStar:true)
    }
    func testBeeSourceAndDestinationSettleAndAdmitNextActualDrag()async throws {
        try await exercise(archetype:.star,variant:"bee",reverse:false,disposeDuringMain:false,moves:49)
        try await exercise(archetype:.star,variant:"bee",reverse:true,disposeDuringMain:false,moves:49)
    }
    func testHiddenVariantDropCountsSettleWithoutOrbitPresentation()async throws {
        for (variant,count) in [("fish",1),("kanta",2),("cubero",3)] {
            for reverse in [false,true] {
                try await exercise(archetype:.star,variant:variant,reverse:reverse,disposeDuringMain:false,starCount:count)
            }
        }
    }
    func testFishSourceAndDestinationSettleAndAdmitNextActualDrag()async throws {
        try await exercise(archetype:.star,variant:"fish",reverse:false,disposeDuringMain:false)
        try await exercise(archetype:.star,variant:"fish",reverse:true,disposeDuringMain:false)
    }
    func testSpaceshipOrdinaryContactDuringPullAndAfterBoardCommitReleasesAllOwners()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:false,disposeDuringMain:false,interveningOrdinary:true)
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:true,disposeDuringMain:false,interveningOrdinary:true)
    }
    func testSpaceshipOrdinaryMergeSixAfterBoardCommitReleasesAllOwners()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:false,disposeDuringMain:false,interveningOrdinary:true,interveningSix:true)
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:true,disposeDuringMain:false,interveningOrdinary:true,interveningSix:true)
    }
    func testSpaceshipHeldOrdinaryDragAcrossHelperFinallyAndRapidContactsRemainPlayable()async throws {
        for reverse in [false,true] {
            try await exercise(archetype:.magnet,variant:"spaceship",reverse:reverse,disposeDuringMain:false,
                interveningOrdinary:true,heldOrdinaryMilliseconds:1600,rapidOrdinaryContacts:5)
            try await exercise(archetype:.magnet,variant:"spaceship",reverse:reverse,disposeDuringMain:false,
                interveningOrdinary:true,interveningSix:true,rapidOrdinaryContacts:5)
        }
    }
    func testSpaceshipSourceActualSourceParticlesSettleAndContinue()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:false,disposeDuringMain:false)
    }
    func testMagnetSourcePullsVisibleKantaAndCompletesItsActualRestoredMove()async throws {
        try await exercise(archetype:.magnet,variant:nil,reverse:false,disposeDuringMain:false,pulledKanta:true,moves:34)
    }
    func testMagnetDestinationPullsVisibleKantaAndCompletesItsActualRestoredMove()async throws {
        try await exercise(archetype:.magnet,variant:nil,reverse:true,disposeDuringMain:false,pulledKanta:true,moves:34)
    }
    private func exercise(archetype:NativeWildArchetype,variant:String?,reverse:Bool,disposeDuringMain:Bool=true,pulledKanta:Bool=false,moves:Int=50,finalOnly:Bool=false,starCount:Int=3,capturedBoard:NativeBoardState?=nil,freshStar:Bool=false,verifyStarTail:Bool=false,interveningOrdinary:Bool=false,interveningSix:Bool=false,heldOrdinaryMilliseconds:Int=160,rapidOrdinaryContacts:Int=0,tutorialAssist:Bool=false,arcadeTutorial:Bool=false,laserInterveningStack:Bool=false,arcadeRun:Bool=false,initialMeter:Double?=nil,verifyBaloonRetirement:Bool=false,verifyBoardScale:Bool=false)async throws {
        let label=(variant ?? archetype.rawValue)+(reverse ? ":destination":":source")
        print("[WildMergeSixRoot] start \(label)")
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("wild-six-particles-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true;envelope.progression.completedJourneyBoards=Set(1..<26)
        var board=NativeBoardFactory.make(mode:.journey,board:26,generation:9,seed:7)
        for i in board.tiles.indices {board.tiles[i].value=0;board.tiles[i].locked=true;board.tiles[i].alpha=0.25}
        for (i,value) in (finalOnly ? [(0,6),(1,2)]:[(0,6),(1,2),(2,1),(3,1),(40,1)]) {
            board.tiles[i].value=value;board.tiles[i].locked=false;board.tiles[i].alpha=1
        }
        if interveningOrdinary || laserInterveningStack {
            for i in [2,3,4,5,40,41] {board.tiles[i].value=1;board.tiles[i].locked=false;board.tiles[i].alpha=1}
            if interveningSix {board.tiles[40].value=3;board.tiles[41].value=3}
        }
        board.tiles[0].archetype=archetype;board.tiles[0].variant=variant;board.tiles[0].starOrbitCount=starCount
        if tutorialAssist {var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true;tutorial.step = .freePlay;board.tutorial=tutorial}
        board.moves=moves
        if let initialMeter {board.wildMeter=initialMeter}
        if freshStar {board.tiles[0].archetype=nil;board.tiles[0].variant=nil;board.tiles[0].value=1;board.wildMeter=0.99}
        if pulledKanta {board.tiles[2].value=6;board.tiles[2].archetype = .star;board.tiles[2].variant="kanta"}
        if let capturedBoard {board=capturedBoard;envelope.progression.completedJourneyBoards=Set(1..<board.board)}
        if arcadeTutorial || arcadeRun {board.mode = .arcade;board.board=1}
        let boardNumber=board.board
        if arcadeTutorial || arcadeRun {envelope.arcadeRun=board;envelope.arcadeRunSavedAt=Date().timeIntervalSince1970}
        else {envelope.journeyRuns[boardNumber]=board}
        try store.save(envelope)
        weak var drawingScene:NativeBoardScene?
        var drawPhases:[String]=[],drawCount=0
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{
                if let phase=drawingScene?.sourceWildFXDrawingPhase {drawPhases.append(phase)}
                defer{drawCount+=1}
                return 0.1+Double(drawCount % 7)*0.01
            },completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        if interveningOrdinary {window.windowScene=try XCTUnwrap(previous?.windowScene,"Overlap fixture must mount on the actual Simulator UIWindowScene")}
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory);timeoutDiagnostic=nil;boardScaleAudit=nil}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        timeoutDiagnostic={"route=\(app.route) homeHidden=\(app.home.isHidden) worldReady=\(app.world?.isReadyForInput==true) gameplay=\(game() != nil)"}
        try await wait(label+":home"){!app.home.isHidden}
        app.navigate(arcadeTutorial || arcadeRun ? .gameplay:.world(boardNumber < 26 ? 1:3),interrupt:true)
        try await wait(label+":world") {
            if game() != nil{return true}
            app.world?.onRequest?("continue",boardNumber)
            return false
        }
        try await wait(label+":entry"){game()?.boardScene?.isBoardEntryComplete==true && game()?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game()),scene=try XCTUnwrap(gameplay.boardScene),scope=try XCTUnwrap(gameplay.sourceScope)
        drawingScene=scene
        timeoutDiagnostic={"route=\(app.route) failureScope=\(scope.current) unsavable=\(gameplay.engine.hasUnsavableSourceGameplayState) HUD=\(gameplay.engine.pendingHUDStars) pullOwners=\(scene.sourceMagnetActualPullOwnerCount) survivorInput=\(scene.sourceMagnetSurvivorPendingInputIDs) revision=\(gameplay.engine.state.revision) flags=\(gameplay.engine.flags) mainEntered=\(gameplay.engine.sourceSpecialAbsorbMainEntered) lazy=\(String(describing:gameplay.engine.pendingSourceMagnetLazyRespawn)) special=\(String(describing:gameplay.engine.pendingSpecial)) direct=\(String(describing:gameplay.engine.pendingDirectWild)) shards=\(scene.sourceWildSixShardOwnerCount) smoke=\(scope.smoke.activeOwnerCount)"}
        var wildID=board.tiles[0].id,targetID=board.tiles[1].id
        if !freshStar {
            XCTAssertEqual(gameplay.engine.state.tiles.first{$0.id==wildID}?.variant,variant)
            XCTAssertEqual(gameplay.engine.state.tiles.first{$0.id==wildID}?.gameplayArchetype,archetype)
        }
        if verifyBoardScale {
            let mergedPair=Set(board.tiles.prefix(2).map(\.id))
            var reported=Set<String>()
            boardScaleAudit={
                for tile in gameplay.engine.state.tiles where !mergedPair.contains(tile.id) && !tile.isWild {
                    guard !tile.magnetOwned,!tile.pendingRemoval,!tile.resolutionOwned,
                          let node=scene.sourceNativeTileNode(tile.id),!node.isSpecial,!node.sourceMagnetPullProtected,node.parent != nil,
                          !node.isHidden,node.alpha>0.01,!node.visual.isHidden,
                          let face=node.visual.children.compactMap({$0 as? SKSpriteNode}).first(where:{$0.texture === node.sourcePaintedNumbersTexture}) else{continue}
                    let message="\(label) tile=\(tile.id) value=\(tile.value) locked=\(tile.locked) face=\(face.frame.size) outer=\(node.sourceLocalScale) visual=\(node.visual.xScale),\(node.visual.yScale) owners=\(node.sourceOuterOwners) appBounce=\(node.sourceAppSpawnOwnsOuterScale)"
                    if abs(face.frame.width-128)>0.001 || abs(face.frame.height-128)>0.001 {
                        if reported.insert(tile.id+":face").inserted {XCTFail(message)}
                    }
                    if scene.sourceOwnsNewFaceEntry(tile.id) {
                        XCTAssertGreaterThanOrEqual(min(node.sourceLocalScale.x*node.visual.xScale,node.sourceLocalScale.y*node.visual.yScale),0.699,"Entry must not compound outer and inner scaling: "+message)
                    }
                    if !node.sourceOuterOwners.competes && !node.sourceIsBeingSpawned && !node.sourceSkipIdleScaleReset && !scene.sourceOwnsNewFaceEntry(tile.id) && !node.visual.hasActions() {
                        if min(node.sourceLocalScale.x,node.sourceLocalScale.y)<0.94 || min(node.visual.xScale,node.visual.yScale)<0.94 {
                            if reported.insert(tile.id+":scale").inserted {XCTFail(message)}
                        }
                    }
                }
            }
            boardScaleAudit?()
        }
        var failure:String?
        let original=scene.onSourcePresentationFailure
        scene.onSourcePresentationFailure={reason,generation in failure=reason;print("[WildMergeSixRoot] \(label) failure=\(reason)");original?(reason,generation)}
        let originalPlainFailure=scene.onPresentationFailure
        scene.onPresentationFailure={reason in
            failure="plain:"+reason
            print("[WildMergeSixRoot] \(label) failure=\(reason) \(self.timeoutDiagnostic?() ?? "")")
            originalPlainFailure?(reason)
        }
        var baloonDestinationPrefixObservations=0
        if variant=="baloon" {
            let originalStateChange=scene.onStateChange
            scene.onStateChange={ [weak gameplay,weak scene] state in
                originalStateChange?(state)
                guard let gameplay,let scene,
                      let plan=gameplay.engine.pendingDirectWild,plan.generation==state.generation,plan.variant=="baloon",
                      let prefix=gameplay.engine.sourceDirectWildPrefix,prefix.id==plan.id,prefix.generation==state.generation,
                      let destination=state.tiles.first(where:{$0.id==plan.destination.id}),
                      destination.variant=="baloon",!destination.isWild else{return}
                baloonDestinationPrefixObservations+=1
                XCTAssertTrue(scene.authoredFinalePresentationReady?("baloon")==true,
                    "Cleared destination prefix must retain transaction-owned Baloon resources: "+label)
            }
        }
        func drag(_ source:String,_ target:String,holdMilliseconds:Int=160)async throws {
            let inputTasks=try XCTUnwrap(scope.sourceMicrotaskTasks)
            let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            inputTasks.inputTask {
                XCTAssertTrue(scene.beginDrag(at:from),label);scene.moveDrag(to:to,now:CACurrentMediaTime())
            }
            try await Task.sleep(for:.milliseconds(holdMilliseconds))
            var result:NativeMoveResult?
            inputTasks.inputTask {result=scene.finishDrag(at:to,now:CACurrentMediaTime())}
            XCTAssertTrue(try XCTUnwrap(result).accepted,label)
        }
        var laserOverlapAccepted=false
        if laserInterveningStack {
            let previousMoment=scene.onSpecialMoment
            scene.onSpecialMoment={kind,moment,index in
                previousMoment?(kind,moment,index)
                guard kind=="laser-gun",moment=="impact",index==0,
                      let plan=gameplay.engine.pendingSpecial,let hit=plan.targets.first,
                      let source=gameplay.engine.state.tiles.first(where:{$0.id==hit.id}),
                      let target=gameplay.engine.state.activeTiles.first(where:{$0.id != hit.id && !$0.isWild && !$0.resolutionOwned && $0.value+source.value<6}) else{return}
                Task { @MainActor in
                    do {
                        try await drag(source.id,target.id,holdMilliseconds:20)
                        laserOverlapAccepted=true
                        print("[LaserOverlap] accepted during replacement bounce \(label)")
                    } catch {XCTFail("Laser overlap failed: \(error)")}
                }
            }
        }
        if freshStar {
            try await drag(board.tiles[0].id,board.tiles[1].id)
            try await wait(label+":earned-Star-landing") {
                failure != nil || (!gameplay.engine.sourceMeterSpawnInProgress && !gameplay.engine.sourceMeterHandoffInProgress &&
                    gameplay.engine.state.activeTiles.contains{$0.archetype == .star && $0.variant==nil && scene.sourceNativeTileNode($0.id)?.sourcePlainStarArtworkSprite != nil})
            }
            XCTAssertNil(failure,label)
            let earned=try XCTUnwrap(gameplay.engine.state.activeTiles.first{$0.archetype == .star && $0.variant==nil})
            wildID=earned.id;targetID=board.tiles[2].id
            XCTAssertEqual(scene.sourceWildDropTileMarkers(try XCTUnwrap(scene.sourceNativeTileNode(wildID))),.init(dropping:false,handoffLocked:false))
        }
        try await drag(reverse ? targetID:wildID,reverse ? wildID:targetID)
        if interveningOrdinary {print("[SpaceshipOverlap] visible-scene-entry direction=\(reverse ? "destination":"source")")}
        let pulledNodes=archetype == .magnet ? try XCTUnwrap(gameplay.engine.pendingSpecial).targets.compactMap{scene.sourceNativeTileNode($0.id)}:[]
        let pulledPositions=pulledNodes.map(\.position)
        let mainKey=(variant ?? archetype.rawValue)+":main"
        try await wait(label+":main"){failure != nil || scene.sourceWildSixParticleAdmissions[mainKey]==1}
        XCTAssertNil(failure,label);XCTAssertEqual(app.route,.gameplay,label);XCTAssertTrue(game() === gameplay,label)
        XCTAssertEqual(scene.sourceWildSixParticleAdmissions[mainKey],1,label)
        XCTAssertEqual(scene.sourceWildOrdinaryMergeSixShardCounts[mainKey],[12],label)
        let ordinarySmoke=NativeSharedSmokeRecipes.regularSix(tileDepth:9993,reduced:false)
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        XCTAssertEqual(try scene.sourceWildOrdinaryMergeSixSmokeRecipes[mainKey]?.map{try encoder.encode($0)},
            [try encoder.encode(ordinarySmoke)],"Every actual Wild/Special main borrows ordinary merge6 clouds: "+label)
        weak var mountedBaloon:NativeBaloonFinalePresentation?
        if variant=="baloon" {
            if reverse {
                XCTAssertGreaterThan(baloonDestinationPrefixObservations,0,
                    "Actual ordinary-to-Baloon merge must observe its Wild-clearing prefix: "+label)
            }
            // Main particles can succeed while the selected UIKit resources have
            // been retired by the destination's earlier Wild-clearing prefix.
            // Require the actual merge to mount and paint the complete finale.
            let baloon=try XCTUnwrap(gameplay.view.subviews.compactMap{$0 as? NativeBaloonFinalePresentation}.first,
                "Actual Baloon merge must mount its SVG and balloon finale: "+label)
            mountedBaloon=baloon
            XCTAssertTrue(baloon.assetReady,label)
            XCTAssertTrue(baloon.hasActiveClock,label)
            XCTAssertEqual(baloon.flightSnapshot.count,24,label)
            let bodies=baloon.subviews.compactMap{$0 as? UIImageView}
            XCTAssertEqual(bodies.count,24,label)
            XCTAssertTrue(bodies.allSatisfy{$0.image != nil},label)
            XCTAssertNotNil(baloon.subviews.first{$0.accessibilityIdentifier=="native-baloon-caption"},label)
            let hero=try XCTUnwrap(baloon.subviews.last,label)
            try await wait(label+":baloon-SVG-painted") {hero.layer.sublayers?.first?.contents != nil}
            XCTAssertTrue(baloon.superview === gameplay.view,label)
            XCTAssertFalse(hero.isHidden,label)
            XCTAssertGreaterThan(hero.alpha,0,label)
        }
        if variant=="spaceship" {
            let ship=try XCTUnwrap(gameplay.view.subviews.compactMap{$0 as? NativeSpaceshipFinalePresentation}.first,
                "The actual Magnet main must mount WOOMBUU's ship, beams and debris")
            XCTAssertTrue(ship.assetReady);XCTAssertEqual(ship.generation,gameplay.engine.state.generation)
        }
        if pulledKanta {
            let kanta=try XCTUnwrap(pulledNodes.first{$0.tileID==board.tiles[2].id})
            let texture=try XCTUnwrap(kanta.sourcePaintedNumbersTexture)
            func paintedBase(_ node:SKNode)->Bool {
                guard !node.isHidden,node.alpha>0.001 else{return false}
                if let sprite=node as? SKSpriteNode,sprite.texture === texture{return true}
                return node.children.contains(where:paintedBase)
            }
            XCTAssertTrue(kanta.sourceMagnetPullProtected)
            XCTAssertTrue(paintedBase(kanta),"Retiring Kanta's idle must retain a visible original base during actual pull")
            try await Task.sleep(for:.milliseconds(250))
            XCTAssertTrue(zip(pulledNodes,pulledPositions).contains{$0.0.parent != nil && $0.0.position != $0.1},"Actual Source pull roots must move their visible captured dice")
        }
        if !finalOnly {
        let mainShake=try XCTUnwrap(drawPhases.firstIndex(of:"main-shake"),label)
        do {
            let mainParticles=try XCTUnwrap(drawPhases.firstIndex(of:"main-shards"),label)
            XCTAssertLessThan(mainShake,mainParticles,"v9 creates shake before main particle RNG: "+label)
            if archetype == .star || archetype == .juice {
                let blast=try XCTUnwrap(drawPhases.firstIndex(of:"board-blast"),label)
                XCTAssertLessThan(mainShake,blast,label);XCTAssertLessThan(blast,mainParticles,label)
            }
        }
        }
        XCTAssertGreaterThan(scene.sourceWildSixShardOwnerCount,0,label)
        XCTAssertGreaterThan(scope.smoke.activeOwnerCount,0,label)
        if interveningOrdinary {
            let farID=board.tiles[40].id
            XCTAssertFalse(try XCTUnwrap(gameplay.engine.pendingSpecial).targets.contains{$0.id==farID})
            let far=try XCTUnwrap(scene.sourceNativeTileNode(farID))
            let point=scene.convert(far.position,from:try XCTUnwrap(far.parent))
            XCTAssertFalse(scene.beginDrag(at:point),"Actual pull mutation must reject unrelated pickup without cancelling its cleanup")
            for _ in 0..<10 where gameplay.engine.pendingSpecial != nil && failure==nil {
                XCTAssertFalse(scene.beginDrag(at:point),"Repeated pickup during captured pull must not acquire stale drag ownership")
                try await Task.sleep(for:.milliseconds(20))
            }
            try await wait(label+":special-board-commit") {failure != nil || gameplay.engine.pendingSpecial==nil}
            XCTAssertNil(failure,label)
            XCTAssertNotNil(gameplay.engine.sourceMagnetPostCommit,"Ordinary contact must occur before captured helper finally")
            let revision=scope.contactMutations.revision
            try await drag(board.tiles[40].id,board.tiles[41].id,holdMilliseconds:heldOrdinaryMilliseconds)
            try await wait(label+":intervening-ordinary-commit") {failure != nil || scope.contactMutations.revision>revision}
            XCTAssertNil(failure,label)
        }
        if !finalOnly,(archetype == .star || archetype == .juice) {
            let mainSmoke=try XCTUnwrap(drawPhases.firstIndex(of:"main-smoke"),label)
            let mainShards=try XCTUnwrap(drawPhases.firstIndex(of:"main-shards"),label)
            XCTAssertLessThan(mainShards,mainSmoke,label)
            XCTAssertEqual(Array(scene.sourceWildSixMainPhases.values),[[.shards,.presentation,.smoke]],
                "Actual Direct consume places hero/HUD admission between shards and smoke: "+label)
        }
        if !reverse,disposeDuringMain {
            // Disposal during the genuine main burst must revoke its exact old
            // Scope resources; the next matrix root must not inherit them.
            host.dispose()
            XCTAssertFalse(scope.current,label);XCTAssertEqual(scene.sourceWildSixShardOwnerCount,0,label)
            XCTAssertEqual(scope.smoke.activeOwnerCount,0,label)
            print("[WildMergeSixRoot] active disposal PASS \(label)")
            return
        }
        if verifyBaloonRetirement {
            var retiringBaloon:NativeBaloonFinalePresentation?=try XCTUnwrap(mountedBaloon,label)
            try await wait(label+":baloon-natural-retirement") {
                retiringBaloon?.superview == nil && retiringBaloon?.hasActiveClock == false
            }
            XCTAssertNil(retiringBaloon?.superview,label)
            XCTAssertFalse(retiringBaloon?.hasActiveClock ?? true,label)
            XCTAssertFalse(gameplay.engine.state.tiles.contains{$0.isWild && $0.variant=="baloon"},label)
            XCTAssertNil(gameplay.engine.pendingDirectWild,label)
            XCTAssertNil(gameplay.engine.pendingSpecial,label)
            XCTAssertNil(gameplay.engine.pendingSourceLateFinalMerge,label)
            XCTAssertFalse(scene.authoredFinalePresentationReady?("baloon") ?? true,
                "Completed transaction and finite finale must retire selected Baloon resources: "+label)
            retiringBaloon=nil
            try await wait(label+":baloon-deallocated") {mountedBaloon == nil}
            XCTAssertNil(mountedBaloon,label)
        }
        if verifyStarTail {
            try await Task.sleep(for:.milliseconds(1500))
            XCTAssertNil(failure,label)
            XCTAssertEqual(scene.sourceWildSixShardOwnerCount,0,label)
            XCTAssertNotNil(scene.childNode(withName:"//native-core-star-finale"),"The actual Star field remains alive after its ordinary shards retire")
            XCTAssertEqual(scene.sourceFrameSnapshot.maxFPS,60,"The live Star field must own render cadence after merge settlement: "+label)
        }
        if finalOnly {
            try await wait(label+":clean-result") {
                failure != nil || gameplay.engine.state.terminal?.kind == .complete
            }
            XCTAssertNil(failure,label)
            XCTAssertEqual(gameplay.engine.state.terminal?.kind,.complete,label)
            XCTAssertEqual(app.route,.gameplay,"Final Wild must retain gameplay for Clean Board: "+label)
            XCTAssertTrue(game() === gameplay,label)
            if tutorialAssist {
                try await wait(label+":tutorial-completion") {failure != nil || app.children.contains{$0 is NativeTutorialCompleteController}}
                XCTAssertNil(failure,label)
                let sheet=try XCTUnwrap(app.children.compactMap{$0 as? NativeTutorialCompleteController}.first)
                try await wait(label+":tutorial-ready"){sheet.phase == .ready}
                sheet.requestContinue()
                if arcadeTutorial {
                    try await wait(label+":fresh-arcade"){failure != nil || (game() !== gameplay && game()?.boardScene?.isBoardEntryComplete==true)}
                    XCTAssertNil(failure)
                    let incoming=try XCTUnwrap(game())
                    XCTAssertFalse(incoming === gameplay)
                    XCTAssertFalse(scope.current)
                    XCTAssertTrue(incoming.sourceScope?.current==true)
                    XCTAssertNil(incoming.sourcePresentationFailure)
                    XCTAssertNil(incoming.engine.state.tutorial)
                    let nextScene=try XCTUnwrap(incoming.boardScene)
                    var moved=false
                    try await wait(label+":next-arcade-move") {
                        for a in incoming.engine.state.activeTiles where !moved {
                            for b in incoming.engine.state.activeTiles where !moved && a.id != b.id && NativeGameplayResolver.canDrop(a,onto:b) {
                                guard let source=nextScene.sourceNativeTileNode(a.id),let target=nextScene.sourceNativeTileNode(b.id),let parent=source.parent else{continue}
                                let from=parent.convert(source.position,to:nextScene),to=parent.convert(target.position,to:nextScene)
                                guard nextScene.beginDrag(at:from) else{continue}
                                nextScene.moveDrag(to:to)
                                moved=nextScene.finishDrag(at:to,now:CACurrentMediaTime())?.accepted==true
                            }
                        }
                        return moved || incoming.sourcePresentationFailure != nil
                    }
                    XCTAssertTrue(moved)
                    try await wait(label+":next-arcade-settlement"){incoming.sourcePresentationFailure != nil || !incoming.engine.hasUnsavableSourceGameplayState}
                    XCTAssertNil(incoming.sourcePresentationFailure)
                    return
                }
                try await wait(label+":tutorial-continue"){app.route == .home}
                XCTAssertNil(failure,label)
                XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
                return
            }
            try await wait(label+":clean-presentation") {
                failure != nil || gameplay.visibleJourneyRewardController != nil || gameplay.presentedViewController is NativeResultController
            }
            XCTAssertNil(failure,label)
            try await wait(label+":completion-committed") {
                failure != nil || ((try? store.load()?.progression.completedJourneyBoards.contains(boardNumber)) == true)
            }
            XCTAssertNil(failure,label)
            if let reward=gameplay.visibleJourneyRewardController {reward.activate()}
            XCTAssertEqual(try store.load()?.progression.completedJourneyBoards.contains(boardNumber),true,label)
            XCTAssertEqual(app.route,.gameplay,label)
            return
        }
        try await wait(label+":gameplay-settled") {
            failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty &&
                scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
        }
        if laserInterveningStack {XCTAssertTrue(laserOverlapAccepted,"Must exercise replacement interruption")}
        if initialMeter != nil {
            try await wait(label+":charged-meter-release") {
                failure != nil || (gameplay.engine.state.wildSpawnCount>board.wildSpawnCount && !gameplay.engine.hasUnsavableSourceGameplayState)
            }
            XCTAssertNil(failure,label)
            XCTAssertGreaterThan(gameplay.engine.state.wildSpawnCount,board.wildSpawnCount)
        }
        XCTAssertNil(failure,label);XCTAssertEqual(app.route,.gameplay,label);XCTAssertTrue(game() === gameplay,label)
        if interveningOrdinary {XCTAssertFalse(gameplay.engine.flags.wildMagnetPullInProgress);XCTAssertNil(gameplay.engine.sourceMagnetPostCommit)}
        XCTAssertEqual(scene.sourceWildSixParticleAdmissions[mainKey],1,"Late-final or pull must not repeat the main burst: "+label)
        if archetype == .magnet {
            let pullKey=(variant ?? archetype.rawValue)+":pull"
            XCTAssertEqual(scene.sourceWildSixParticleAdmissions[pullKey],1,label)
            XCTAssertEqual(scene.sourceWildOrdinaryMergeSixShardCounts[pullKey],[12],label)
            XCTAssertEqual(try scene.sourceWildOrdinaryMergeSixSmokeRecipes[pullKey]?.map{try encoder.encode($0)},
                [try encoder.encode(ordinarySmoke)],"Pull convergence borrows the same ordinary clouds: "+label)
            XCTAssertEqual(scene.sourceWildScreenShakeInvocations.count,2,label)
            let pullParticles=try XCTUnwrap(drawPhases.firstIndex(of:"pull-particles"),label)
            let pullShake=try XCTUnwrap(drawPhases.firstIndex(of:"pull-shake"),label)
            XCTAssertLessThan(pullParticles,pullShake,"v9 pull convergence creates shards before shake: "+label)
        } else if archetype == .tnt {
            XCTAssertNil(scene.sourceSpecialImpactParticleRejection,label)
            XCTAssertGreaterThan(scene.sourceSpecialImpactParticleAdmissions[variant ?? "tnt"] ?? 0,0,label)
            let contactCounts=try XCTUnwrap(scene.sourceSpecialImpactMergeSixShardCounts[variant ?? "tnt"],label)
            XCTAssertEqual(contactCounts.count,scene.sourceSpecialImpactParticleAdmissions[variant ?? "tnt"],label)
            XCTAssertTrue(contactCounts.allSatisfy{$0==12},"Every actual Special contact borrows ordinary wooden shards: "+label)
            if variant == "laser-gun" {
                XCTAssertEqual(scene.sourceLaserImpactMergeSixShardCounts.count,scene.sourceSpecialImpactParticleAdmissions["laser-gun"],label)
                XCTAssertTrue(scene.sourceLaserImpactMergeSixShardCounts.allSatisfy{$0==12},"Each actual Laser contact admits the existing ordinary merge6 shard profile: "+label)
                for tile in gameplay.engine.state.activeTiles where !tile.isWild && !tile.locked {
                    let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id),label)
                    XCTAssertEqual(node.sourceValue,tile.value,label)
                    XCTAssertEqual(node.sourceEventMode,"static",label)
                    XCTAssertTrue(gameplay.engine.canBeginDrag(tileID:tile.id),"Laser replacement must admit pickup: \(tile.id) flags=\(gameplay.engine.flags)")
                    let point=scene.convert(node.position,from:try XCTUnwrap(node.parent))
                    XCTAssertTrue(scene.beginDrag(at:point),"Actual laser replacement pickup: \(tile.id)")
                    scene.cancelDrag()
                }
            }
        } else {XCTAssertEqual(scene.sourceWildScreenShakeInvocations.count,1,label)}
        try await wait(label+":shards-retired"){scene.sourceWildSixShardOwnerCount==0}
        if laserInterveningStack {
            let playable=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
            let six=try XCTUnwrap(playable.lazy.flatMap{a in playable.filter{$0.id != a.id && a.value+$0.value==6}.map{(a,$0)}}.first,
                "Laser interruption fixture must retain a real merge-six pair")
            try await drag(six.0.id,six.1.id)
            try await wait(label+":post-laser-merge-six"){failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
            XCTAssertNil(failure,label);XCTAssertNil(gameplay.sourcePresentationFailure)
        }
        let ordinary=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
        let pair=ordinary.lazy.flatMap{a in ordinary.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first
        if let pair {
            try await drag(pair.0.id,pair.1.id)
            try await wait(label+":next-drag"){failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
            XCTAssertNil(failure,label);XCTAssertEqual(app.route,.gameplay,label)
        }
        for index in 0..<rapidOrdinaryContacts {
            try await wait(label+":rapid-ready-\(index)") {failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
            XCTAssertNil(failure,label)
            let playable=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
            let pair=try XCTUnwrap(playable.lazy.flatMap{a in playable.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first,"Rapid continuation must retain a legal pair")
            try await drag(pair.0.id,pair.1.id,holdMilliseconds:20)
            print("[SpaceshipOverlap] direction=\(reverse ? "destination":"source") hold=\(heldOrdinaryMilliseconds) six=\(interveningSix) contact=\(index) revision=\(gameplay.engine.state.revision) pull=\(scene.sourceMagnetActualPullOwnerCount) failure=\(failure ?? "none")")
        }
        if rapidOrdinaryContacts>0 {
            try await wait(label+":rapid-final-settle") {failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)}
            XCTAssertNil(failure,label);XCTAssertNil(gameplay.sourcePresentationFailure)
            XCTAssertFalse(gameplay.engine.flags.wildMagnetPullInProgress)
            XCTAssertEqual(scene.sourceMagnetActualPullOwnerCount,0)
            XCTAssertTrue(scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
            XCTAssertEqual(app.route,.gameplay)
        }
        host.dispose();XCTAssertFalse(scope.current,label);XCTAssertEqual(scope.smoke.activeOwnerCount,0,label)
        print("[WildMergeSixRoot] settled continuation PASS \(label)")
    }
}
