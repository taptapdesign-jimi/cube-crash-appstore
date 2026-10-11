import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeCompleteGameplayRootTests:XCTestCase {
    private var timeoutDiagnostic:(()->String)?
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){
            guard Date()<deadline else{XCTFail("NativeCompleteRoot timeout=\(label) \(timeoutDiagnostic?() ?? "")");throw NSError(domain:"NativeCompleteRoot."+label,code:1)}
            try await Task.sleep(for:.milliseconds(20))
        }
    }
    private func game(_ app:NativeAppController)->NativeGameplayViewController? {
        app.children.compactMap{$0 as? NativeGameplayViewController}.first
    }
    private func assertKnownIdleOwners(_ scene:NativeBoardScene)throws {
        let snapshot=try XCTUnwrap(scene.captureSourceGameplayRuntime(isWild:false))
        XCTAssertEqual(snapshot.missingOwners,[])
        let environment=try XCTUnwrap(snapshot.meterEnvironment)
        XCTAssertFalse(environment.queueInProgress);XCTAssertFalse(environment.boardTransitionActive)
        XCTAssertFalse(environment.mergeSixSpawnInProgress);XCTAssertFalse(environment.wildMagnetPullInProgress)
        XCTAssertFalse(environment.wildDropInProgress)
        let authority=try XCTUnwrap(scene.engine.sourceNoMovesRuntimeAuthority)
        XCTAssertTrue(authority.isCurrent())
        let observed=try XCTUnwrap(authority.capture())
        XCTAssertEqual(observed.capabilities,Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
        XCTAssertFalse(observed.gameplayTransactionActive);XCTAssertFalse(observed.livingDragActive)
    }
    func testFirstEarnedArcadeWildCanMergeAndContinueOnSameGameplayRoute()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("first-earned-wild-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        var board=NativeBoardFactory.make(mode:.arcade,board:1,generation:9,seed:7)
        for i in board.tiles.indices {board.tiles[i].value=0;board.tiles[i].locked=true;board.tiles[i].alpha=0.25}
        for (i,value) in [(0,3),(1,3),(2,2),(3,1),(40,1)] {
            board.tiles[i].value=value;board.tiles[i].locked=false;board.tiles[i].alpha=1
        }
        board.wildMeter=0.95;seed.arcadeRun=board;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory);timeoutDiagnostic=nil}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("earned-wild-home"){!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait("earned-wild-entry"){self.game(app)?.boardScene?.isBoardEntryComplete==true && self.game(app)?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game(app)),scene=try XCTUnwrap(gameplay.boardScene)
        for _ in 0..<2 {
            scene.synchronize()
            for tile in gameplay.engine.state.tiles where tile.locked && tile.value==0 {
                XCTAssertLessThanOrEqual(try XCTUnwrap(scene.sourceNativeTileNode(tile.id)).alpha,0.25)
            }
        }
        var failure:String?
        let originalFailure=scene.onSourcePresentationFailure
        scene.onSourcePresentationFailure={reason,generation in failure=reason;originalFailure?(reason,generation)}
        timeoutDiagnostic={"failure=\(failure ?? "none") route=\(app.route) meter=\(gameplay.engine.state.wildMeter) reservations=\(gameplay.engine.meterDropReservations) state=\(gameplay.engine.state)"}
        func drag(_ source:String,_ target:String)async throws {
            let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        }
        try await drag(board.tiles[0].id,board.tiles[1].id)
        try await wait("first-earned-wild-landed"){
            failure != nil || (gameplay.engine.state.wildSpawnCount>0 && !gameplay.engine.sourceMeterHandoffInProgress &&
                gameplay.engine.state.tiles.contains{$0.isWild && scene.sourceNativeTileNode($0.id).map{!$0.isHidden && scene.sourceWildDropTileMarkers($0) == .init(dropping:false,handoffLocked:false)} == true})
        }
        XCTAssertNil(failure);XCTAssertTrue(game(app) === gameplay)
        let wild=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.isWild})
        let target=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id==board.tiles[2].id})
        try await drag(wild.id,target.id)
        try await wait("earned-wild-merge-settled"){
            failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty &&
                scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
        }
        XCTAssertNil(failure);XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
        XCTAssertFalse(gameplay.engine.state.tiles.contains{$0.id==wild.id})
        let ordinary=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
        let pair=try XCTUnwrap(ordinary.lazy.flatMap{a in ordinary.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first)
        try await drag(pair.0.id,pair.1.id)
        try await wait("ordinary-after-earned-wild"){
            failure != nil || (gameplay.engine.pendingOrdinaryStack==nil && !gameplay.engine.hasPendingSourceOrdinaryStackFace && !gameplay.engine.hasUnsavableSourceGameplayState)
        }
        XCTAssertNil(failure);XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
    }
    func testFirstEarnedJourneyWildMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:1)
    }
    func testFirstEarnedJourneyFlowerMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:3)
    }
    func testFirstEarnedJourneyBarrelMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:7)
    }
    func testFirstEarnedJourneyStarAsDestinationMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:1,reverse:true)
    }
    func testFirstEarnedJourneyHoneyMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:4)
    }
    func testFirstEarnedJourneyHoneyAsDestinationMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:4,reverse:true)
    }
    func testFirstEarnedJourneyMushroomMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:6)
    }
    func testFirstEarnedJourneyMushroomAsDestinationMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:6,reverse:true)
    }
    func testFirstEarnedJourneyFlowerAsDestinationMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:3,reverse:true)
    }
    func testFirstEarnedJourneyBeachBallMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:13,random:0.5)
    }
    func testFirstEarnedJourneyBeachBallAsDestinationMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:13,reverse:true,random:0.5)
    }
    func testFirstEarnedJourneyKantaMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:21)
    }
    func testFirstEarnedJourneyKantaAsDestinationMergeSixKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:21,reverse:true)
    }
    func testFirstEarnedJourneyBeeLiveSafetyRepairAndMergeKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:2)
    }
    func testFirstEarnedJourneyBeeLiveSafetyRepairAsDestinationKeepsActualGameplayRoute()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:2,reverse:true)
    }
    func testFirstEarnedJourneyPlainStarKeepsEmptyHoldersFaintThroughLiveSafetyAndMerge()async throws {
        try await exerciseFirstEarnedJourneyWild(boardNumber:8)
    }
    private func exerciseFirstEarnedJourneyWild(boardNumber:Int,reverse:Bool=false,random:Double=0.1)async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("first-earned-wild-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.progression.completedJourneyBoards=Set(1..<boardNumber)
        var board=NativeBoardFactory.make(mode:.journey,board:boardNumber,generation:9,seed:7)
        // The existing Native presentation contract paints legacy alpha1 zero
        // holders faint. Board8 exercises that genuine canonical/painted split
        // through the real owner, so bonus allocation must borrow the paint.
        for i in board.tiles.indices {board.tiles[i].value=0;board.tiles[i].locked=true;board.tiles[i].alpha=boardNumber==8 ? 1:0.25}
        for (i,value) in [(0,3),(1,3),(2,2),(3,1),(40,1)] {
            board.tiles[i].value=value;board.tiles[i].locked=false;board.tiles[i].alpha=1
        }
        if boardNumber==21 || boardNumber==2 || boardNumber==8 {
            for i in [4,5] {board.tiles[i].value=3;board.tiles[i].locked=false;board.tiles[i].alpha=1}
        }
        board.wildMeter=0.95;seed.journeyRuns[boardNumber]=board;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{random},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory);timeoutDiagnostic=nil}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("earned-wild-home"){!app.home.isHidden};app.navigate(.world((boardNumber-1)/10+1),interrupt:true)
        try await wait("earned-wild-world-play"){if self.game(app) != nil{return true};app.world?.onRequest?("continue",boardNumber);return false}
        try await wait("earned-wild-entry"){self.game(app)?.boardScene?.isBoardEntryComplete==true && self.game(app)?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game(app)),scene=try XCTUnwrap(gameplay.boardScene)
        for _ in 0..<2 {
            scene.synchronize()
            for tile in gameplay.engine.state.tiles where tile.locked && tile.value==0 {
                XCTAssertLessThanOrEqual(try XCTUnwrap(scene.sourceNativeTileNode(tile.id)).alpha,0.25)
            }
        }
        var failure:String?
        let originalFailure=scene.onSourcePresentationFailure
        scene.onSourcePresentationFailure={reason,generation in failure=reason;print("[WildSixRepro] board=\(boardNumber) reason=\(reason)");originalFailure?(reason,generation)}
        let originalPlainFailure=scene.onPresentationFailure
        scene.onPresentationFailure={reason in
            failure="plain:"+reason
            print("[WildSixRepro] board=\(boardNumber) reason=\(reason) \(self.timeoutDiagnostic?() ?? "")")
            originalPlainFailure?(reason)
        }
        timeoutDiagnostic={"failure=\(failure ?? "none") route=\(app.route) meter=\(gameplay.engine.state.wildMeter) reservations=\(gameplay.engine.meterDropReservations) flags=\(gameplay.engine.flags) mainEntered=\(gameplay.engine.sourceSpecialAbsorbMainEntered) pullOwners=\(scene.sourceMagnetActualPullOwnerCount) survivorInput=\(scene.sourceMagnetSurvivorPendingInputIDs) lazy=\(String(describing:gameplay.engine.pendingSourceMagnetLazyRespawn)) special=\(String(describing:gameplay.engine.pendingSpecial)) state=\(gameplay.engine.state)"}
        func drag(_ source:String,_ target:String)async throws {
            let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        }
        func assertActualOrdinaryFaces(_ phase:String)throws {
            guard boardNumber==8 else{return}
            for tile in gameplay.engine.state.tiles where !tile.isWild && tile.variant==nil && !tile.pendingRemoval {
                let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id),"\(phase): \(tile.id)")
                XCTAssertEqual(node.sourceValue,tile.value,"\(phase): real face owner value \(tile.id)")
                if tile.locked && tile.value==0 {
                    XCTAssertLessThanOrEqual(node.alpha,0.25,"\(phase): locked empty holder \(tile.id) at \(tile.cell) must stay faint")
                    XCTAssertTrue(node.sourcePipNodes.isEmpty,"\(phase): zero holder must have no pips")
                } else if (1...5).contains(tile.value) && !tile.locked && !node.sourceRegularFramePending {
                    XCTAssertFalse(node.sourcePipNodes.isEmpty,"\(phase): positive ordinary \(tile.id) at \(tile.cell) must paint real pips")
                    XCTAssertGreaterThanOrEqual(node.alpha,0.99,"\(phase): active positive face must remain opaque")
                }
            }
        }
        var carrierPixelWidths:[CGFloat]=[]
        func sampleCarrier(_ root:SKNode) {
            if let sprite=root as? SKSpriteNode,let texture=sprite.texture,
               sprite.parent.map({String(describing:type(of:$0))=="NativeWildMeterDropPresentation"})==true,
               (texture.size()==CGSize(width:379,height:438) || texture.size()==CGSize(width:290,height:403)),let skView=scene.view {
                let left=skView.convert(sprite.convert(CGPoint(x:-texture.size().width*0.5,y:0),to:scene),from:scene)
                let right=skView.convert(sprite.convert(CGPoint(x:texture.size().width*0.5,y:0),to:scene),from:scene)
                let width=hypot(right.x-left.x,right.y-left.y);carrierPixelWidths.append(width)
                if width>180 {
                    var chain:[String]=[];var ancestor:SKNode?=sprite
                    while let node=ancestor {chain.append("\(type(of:node)) scale=\(node.xScale),\(node.yScale) rotation=\(node.zRotation)");ancestor=node.parent}
                    print("[CarrierRootProof] board=\(boardNumber) width=\(width) size=\(sprite.size) texture=\(texture.size()) gridScale=\(String(describing:scene.boardGeometry?.scale)) scene=\(scene.size) view=\(skView.bounds) chain=\(chain)")
                }
            }
            for child in root.children {sampleCarrier(child)}
        }
        try await drag(board.tiles[0].id,board.tiles[1].id)
        try await wait("first-earned-wild-landed"){
            sampleCarrier(scene)
            return failure != nil || (gameplay.engine.state.wildSpawnCount>0 && !gameplay.engine.sourceMeterHandoffInProgress &&
                gameplay.engine.state.tiles.contains{$0.isWild && scene.sourceNativeTileNode($0.id).map{!$0.isHidden && scene.sourceWildDropTileMarkers($0) == .init(dropping:false,handoffLocked:false)} == true})
        }
        XCTAssertNil(failure);XCTAssertTrue(game(app) === gameplay)
        print("[WildSixRepro] board=\(boardNumber) carrierScreenWidths=\(carrierPixelWidths)")
        let wild=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.isWild})
        let expectedVariant=[3:"flower",4:"honey",6:"mushroom",7:"barell",2:"bee",13:"beach-ball",21:"kanta"][boardNumber]
        XCTAssertEqual(wild.variant,expectedVariant,"The real canonical first reward must exercise the requested registry path")
        try assertActualOrdinaryFaces("earned reward landed")
        if boardNumber==21 || boardNumber==2 || boardNumber==8 {
            let liveKanta=try XCTUnwrap(scene.sourceNativeTileNode(wild.id))
            XCTAssertFalse(liveKanta.sourceIdleDeferred,"The actual first reward must be live, unlike a restored deferred Wild")
            try await drag(board.tiles[4].id,board.tiles[5].id)
            try await wait("first-kanta-live-during-ordinary-six"){
                failure != nil || (gameplay.engine.pendingOrdinarySix==nil && gameplay.engine.pendingSourceOrdinaryMinimumPhase==nil &&
                    !gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)
            }
            // The actual ordinary-six owner schedules both 600/1200 ms safety sweeps.
            try await Task.sleep(for:.milliseconds(1400))
            XCTAssertNil(failure);XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
            XCTAssertTrue(gameplay.engine.state.tiles.contains{$0.id==wild.id && $0.isWild && $0.variant==expectedVariant})
            XCTAssertTrue(scene.sourceNativeTileNode(wild.id) === liveKanta)
            XCTAssertFalse(liveKanta.sourceIdleDeferred)
            try assertActualOrdinaryFaces("live Wild after ordinary-six and both safety sweeps")
        }
        let target=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id==board.tiles[2].id})
        try await drag(reverse ? target.id:wild.id,reverse ? wild.id:target.id)
        try await wait("earned-wild-merge-settled"){
            failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty &&
                scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
        }
        XCTAssertNil(failure);XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
        try assertActualOrdinaryFaces("Wild merge settled")
        let consumedSourceID=reverse ? target.id:wild.id
        XCTAssertFalse(gameplay.engine.state.tiles.contains{$0.id==consumedSourceID})
        if reverse && wild.archetype == .magnet {
            let survivor=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id==wild.id})
            XCTAssertFalse(survivor.isWild);XCTAssertFalse(survivor.locked)
            XCTAssertEqual(survivor.cell,wild.cell)
        }
        let ordinary=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
        let pair=try XCTUnwrap(ordinary.lazy.flatMap{a in ordinary.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first)
        try await drag(pair.0.id,pair.1.id)
        try await wait("ordinary-after-earned-wild"){
            failure != nil || (gameplay.engine.pendingOrdinaryStack==nil && !gameplay.engine.hasPendingSourceOrdinaryStackFace && !gameplay.engine.hasUnsavableSourceGameplayState)
        }
        XCTAssertNil(failure);XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
    }
    func testPhysicalJourneyThreePlainStarMergeSixKeepsActualGameplayRoute()async throws {
        let boardNumber=3
        let reverse=false
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("first-earned-wild-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.progression.completedJourneyBoards=Set(1..<boardNumber)
        // Exact isolated board from the user's 2026-10-11 pre-repair Native save.
        let board=try JSONDecoder().decode(NativeBoardState.self,from:Data(#"{"bestScore":16198,"board":3,"columns":5,"combo":2,"cubesCracked":10,"earnedComboBonus":2700,"generation":1,"lastWildDropType":"wild","longestCombo":15,"maxMoves":50,"maxStackDepth":4,"mode":"journey","moves":31,"revision":19,"rngState":7093224069043717358,"rows":9,"score":1751,"stage":3,"starsCount":0,"tiles":[{"alpha":1,"cell":{"column":1,"row":0},"id":"g1-1","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":2,"row":0},"id":"g1-2","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":4,"row":1},"id":"g1-9","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":2},"id":"g1-10","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":2,"row":2},"id":"g1-12","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":1,"row":3},"id":"g1-16","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":2,"row":3},"id":"g1-17","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":2,"row":4},"id":"g1-22","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":5},"id":"g1-25","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":4,"row":5},"id":"g1-29","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true},{"alpha":1,"cell":{"column":0,"row":6},"id":"native:1:15:0:6:die:15","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":5,"visible":true},{"alpha":1,"cell":{"column":2,"row":6},"id":"g1-32","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":7},"id":"g1-35","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":4,"visible":true},{"alpha":1,"cell":{"column":1,"row":7},"id":"g1-36","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":3,"row":7},"id":"g1-38","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":3,"row":8},"id":"g1-43","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true},{"alpha":1,"archetype":"wild","cell":{"column":4,"row":7},"id":"native:1:13:4:7:die:2","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":6,"visible":true},{"alpha":0.2,"cell":{"column":3,"row":4},"id":"native:1:15:3:4:die:3:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":0.2,"cell":{"column":3,"row":3},"id":"native:1:15:3:3:die:4:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":0.2,"cell":{"column":0,"row":4},"id":"native:1:15:0:4:die:5:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":0.2,"cell":{"column":0,"row":3},"id":"native:1:15:0:3:die:6:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":0.2,"cell":{"column":1,"row":5},"id":"native:1:15:1:5:die:7:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":1,"row":4},"id":"native:1:15:1:4:die:8:locked","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":1,"visible":true},{"alpha":0.2,"cell":{"column":1,"row":6},"id":"native:1:15:1:6:die:9:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":0.2,"cell":{"column":3,"row":1},"id":"native:1:15:3:1:die:10:locked","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":1},"id":"native:1:15:0:1:die:11:locked","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":2,"visible":true},{"alpha":1,"cell":{"column":4,"row":3},"id":"g1-19","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":2,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true}],"wildDropTypeStreak":1,"wildMeter":0.7879999999999999,"wildSpawnCount":2}"#.utf8))
        seed.journeyRuns[boardNumber]=board;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory);timeoutDiagnostic=nil}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("earned-wild-home"){!app.home.isHidden};app.navigate(.world(1),interrupt:true)
        try await wait("earned-wild-world-play"){if self.game(app) != nil{return true};app.world?.onRequest?("continue",boardNumber);return false}
        try await wait("earned-wild-entry"){self.game(app)?.boardScene?.isBoardEntryComplete==true && self.game(app)?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game(app)),scene=try XCTUnwrap(gameplay.boardScene)
        for _ in 0..<2 {
            scene.synchronize()
            for tile in gameplay.engine.state.tiles where tile.locked && tile.value==0 {
                XCTAssertLessThanOrEqual(try XCTUnwrap(scene.sourceNativeTileNode(tile.id)).alpha,0.25)
            }
        }
        var failure:String?
        let originalFailure=scene.onSourcePresentationFailure
        scene.onSourcePresentationFailure={reason,generation in failure=reason;print("[WildSixRepro] board=\(boardNumber) reason=\(reason)");originalFailure?(reason,generation)}
        timeoutDiagnostic={"failure=\(failure ?? "none") route=\(app.route) meter=\(gameplay.engine.state.wildMeter) reservations=\(gameplay.engine.meterDropReservations) state=\(gameplay.engine.state)"}
        func drag(_ source:String,_ target:String)async throws {
            let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        }
        let wild=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.isWild})
        let target=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id=="g1-29"})
        try await drag(reverse ? target.id:wild.id,reverse ? wild.id:target.id)
        try await wait("earned-wild-merge-settled"){
            failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty &&
                scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
        }
        XCTAssertNil(failure);XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
        XCTAssertFalse(gameplay.engine.state.tiles.contains{$0.id==wild.id})
        let ordinary=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
        let pair=try XCTUnwrap(ordinary.lazy.flatMap{a in ordinary.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first)
        try await drag(pair.0.id,pair.1.id)
        try await wait("ordinary-after-earned-wild"){
            failure != nil || (gameplay.engine.pendingOrdinaryStack==nil && !gameplay.engine.hasPendingSourceOrdinaryStackFace && !gameplay.engine.hasUnsavableSourceGameplayState)
        }
        XCTAssertNil(failure);XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
    }
    func testPhysicalJourneyTwentySixOrdinarySixKeepsLiveKantaAndGameplayRoute()async throws {try await exercisePhysicalJourneyTwentySix(mode:0)}
    func testPhysicalJourneyTwentySixKantaSourceKeepsGameplayRoute()async throws {try await exercisePhysicalJourneyTwentySix(mode:1)}
    func testPhysicalJourneyTwentySixKantaDestinationKeepsGameplayRoute()async throws {try await exercisePhysicalJourneyTwentySix(mode:2)}
    func testPhysicalJourneyTwentySixKantaPickupCancelThenOrdinarySixKeepsGameplayRoute()async throws {try await exercisePhysicalJourneyTwentySix(mode:3)}
    func testPhysicalJourneyTwentySixEarnedStarThenOrdinarySixKeepsGameplayRoute()async throws {try await exercisePhysicalJourneyTwentySix(mode:4)}
    private func exercisePhysicalJourneyTwentySix(mode:Int)async throws {
        let boardNumber=26
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("first-earned-wild-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.progression.completedJourneyBoards=Set(1..<boardNumber)
        // Exact isolated board from the user's 2026-10-11 pre-repair Native save.
        let board=try JSONDecoder().decode(NativeBoardState.self,from:Data(#"{"bestScore":0,"board":26,"columns":5,"combo":0,"cubesCracked":0,"earnedComboBonus":3075,"generation":1,"longestCombo":0,"maxMoves":50,"maxStackDepth":1,"mode":"journey","moves":34,"revision":0,"rngState":26,"rows":9,"score":1468,"stage":26,"starsCount":0,"tiles":[{"alpha":1,"cell":{"column":0,"row":0},"id":"import-journey-26-0-0","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":5,"visible":true},{"alpha":1,"cell":{"column":1,"row":0},"id":"import-journey-26-0-1","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":3,"row":0},"id":"import-journey-26-0-3","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":1,"visible":true},{"alpha":1,"cell":{"column":1,"row":1},"id":"import-journey-26-1-1","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":5,"visible":true},{"alpha":1,"cell":{"column":2,"row":1},"id":"import-journey-26-1-2","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true},{"alpha":1,"archetype":"wild","cell":{"column":0,"row":2},"id":"import-journey-26-2-0","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":6,"variant":"kanta","visible":true},{"alpha":1,"cell":{"column":2,"row":2},"id":"import-journey-26-2-2","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":4,"visible":true},{"alpha":1,"cell":{"column":3,"row":2},"id":"import-journey-26-2-3","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":4,"row":2},"id":"import-journey-26-2-4","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":3},"id":"import-journey-26-3-0","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":1,"row":3},"id":"import-journey-26-3-1","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":4},"id":"import-journey-26-4-0","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":4,"visible":true},{"alpha":1,"cell":{"column":1,"row":4},"id":"import-journey-26-4-1","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":4,"visible":true},{"alpha":1,"cell":{"column":2,"row":4},"id":"import-journey-26-4-2","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":4,"visible":true},{"alpha":1,"cell":{"column":0,"row":5},"id":"import-journey-26-5-0","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":1,"row":5},"id":"import-journey-26-5-1","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":3,"row":5},"id":"import-journey-26-5-3","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true},{"alpha":1,"cell":{"column":4,"row":5},"id":"import-journey-26-5-4","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":6},"id":"import-journey-26-6-0","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":4,"visible":true},{"alpha":1,"cell":{"column":1,"row":6},"id":"import-journey-26-6-1","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":2,"row":6},"id":"import-journey-26-6-2","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":4,"row":6},"id":"import-journey-26-6-4","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":0,"row":7},"id":"import-journey-26-7-0","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":1,"row":7},"id":"import-journey-26-7-1","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":2,"row":7},"id":"import-journey-26-7-2","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true},{"alpha":1,"cell":{"column":4,"row":7},"id":"import-journey-26-7-4","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":2,"visible":true},{"alpha":1,"cell":{"column":4,"row":8},"id":"import-journey-26-8-4","locked":true,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":0,"visible":true}],"wildDropTypeStreak":0,"wildMeter":0.5599999999999999,"wildSpawnCount":2}"#.utf8))
        seed.journeyRuns[boardNumber]=board;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory);timeoutDiagnostic=nil}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("earned-wild-home"){!app.home.isHidden};app.navigate(.world(3),interrupt:true)
        try await wait("earned-wild-world-play"){if self.game(app) != nil{return true};app.world?.onRequest?("continue",boardNumber);return false}
        try await wait("earned-wild-entry"){self.game(app)?.boardScene?.isBoardEntryComplete==true && self.game(app)?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game(app)),scene=try XCTUnwrap(gameplay.boardScene)
        for _ in 0..<2 {
            scene.synchronize()
            for tile in gameplay.engine.state.tiles where tile.locked && tile.value==0 {
                XCTAssertLessThanOrEqual(try XCTUnwrap(scene.sourceNativeTileNode(tile.id)).alpha,0.25)
            }
        }
        var failure:String?
        let originalFailure=scene.onSourcePresentationFailure
        scene.onSourcePresentationFailure={reason,generation in failure=reason;print("[WildSixRepro] board=\(boardNumber) reason=\(reason)");originalFailure?(reason,generation)}
        timeoutDiagnostic={"failure=\(failure ?? "none") route=\(app.route) meter=\(gameplay.engine.state.wildMeter) reservations=\(gameplay.engine.meterDropReservations) state=\(gameplay.engine.state)"}
        func drag(_ source:String,_ target:String)async throws {
            let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        }
        let kantaID="import-journey-26-2-0"
        XCTAssertEqual(try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id==kantaID}).variant,"kanta")
        if mode==4 {
            func settle()async throws {
                try await wait("actual-phone26-ordinary-or-meter-settled"){
                    failure != nil || (gameplay.engine.pendingOrdinarySix==nil && gameplay.engine.pendingOrdinaryStack==nil && gameplay.engine.pendingDirectWild==nil && gameplay.engine.pendingSourceOrdinaryMinimumPhase==nil && gameplay.engine.pendingMeterOpen==nil && !gameplay.engine.sourceMeterHandoffInProgress && !gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)
                }
                XCTAssertNil(failure)
            }
            func bestPair()throws->(NativeTile,NativeTile) {
                let regular=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
                var best:(NativeTile,NativeTile)?
                for source in regular {
                    for destination in regular where source.id != destination.id {
                        let sum=source.value+destination.value
                        guard sum<=6 else{continue}
                        if let existing=best,sum<existing.0.value+existing.1.value {continue}
                        best=(source,destination)
                    }
                }
                return try XCTUnwrap(best)
            }
            for index in 0..<20 {
                if gameplay.engine.state.wildSpawnCount>board.wildSpawnCount {break}
                let pair=try bestPair()
                print("[Phone26EarnedStar] earnStep=\(index) values=\(pair.0.value)+\(pair.1.value) meter=\(gameplay.engine.state.wildMeter)")
                try await drag(pair.0.id,pair.1.id);try await settle()
            }
            XCTAssertGreaterThan(gameplay.engine.state.wildSpawnCount,board.wildSpawnCount)
            let star=try XCTUnwrap(gameplay.engine.state.tiles.first{$0.isWild && $0.id != kantaID && $0.variant==nil})
            try await wait("actual-new-star-landed"){
                failure != nil || scene.sourceNativeTileNode(star.id).map{!$0.isHidden && scene.sourceWildDropTileMarkers($0) == .init(dropping:false,handoffLocked:false)}==true
            }
            print("[Phone26EarnedStar] liveStar=\(star.id) deferred=\(try XCTUnwrap(scene.sourceNativeTileNode(star.id)).sourceIdleDeferred)")
            var mergedSix=false
            for index in 0..<20 {
                let pair=try bestPair(),sum=pair.0.value+pair.1.value
                print("[Phone26EarnedStar] afterStarStep=\(index) values=\(pair.0.value)+\(pair.1.value)")
                try await drag(pair.0.id,pair.1.id);try await settle()
                if sum==6 {mergedSix=true;break}
            }
            XCTAssertTrue(mergedSix)
            try await Task.sleep(for:.milliseconds(1400))
            XCTAssertNil(failure);XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
            XCTAssertTrue(try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id==star.id}).isWild)
            return
        }
        if mode==3 {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(kantaID))
            let point=scene.convert(node.position,from:try XCTUnwrap(node.parent))
            XCTAssertTrue(scene.beginDrag(at:point));scene.moveDrag(to:point,now:CACurrentMediaTime());scene.cancelDrag()
        }
        print("[Phone26Safety] mode=\(mode) kantaDeferred=\(try XCTUnwrap(scene.sourceNativeTileNode(kantaID)).sourceIdleDeferred)")
        if mode==1 {try await drag(kantaID,"import-journey-26-1-2")}
        else if mode==2 {try await drag("import-journey-26-1-2",kantaID)}
        else {try await drag("import-journey-26-1-2","import-journey-26-5-3")}
        try await wait("phone-ordinary-six-settled"){
            failure != nil || (gameplay.engine.pendingOrdinarySix==nil && gameplay.engine.pendingDirectWild==nil && gameplay.engine.pendingSourceOrdinaryMinimumPhase==nil && !gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)
        }
        // Both real APP wall safety sweeps must run while Kanta stays on board.
        try await Task.sleep(for:.milliseconds(1400))
        XCTAssertNil(failure);XCTAssertNil(gameplay.sourcePresentationFailureGeneration)
        XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
        if mode==0 || mode==3 {XCTAssertTrue(try XCTUnwrap(gameplay.engine.state.tiles.first{$0.id==kantaID}).isWild)}
        try await drag("import-journey-26-0-3","import-journey-26-0-0")
        try await wait("phone-next-move"){
            failure != nil || (gameplay.engine.pendingOrdinaryStack==nil && !gameplay.engine.hasPendingSourceOrdinaryStackFace && !gameplay.engine.hasUnsavableSourceGameplayState)
        }
        XCTAssertNil(failure);XCTAssertEqual(app.route,.gameplay);XCTAssertTrue(game(app) === gameplay)
    }

    func testArea55SavedWorldCardKeepsV9TransitionAndGhostOpacity()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("area55-v9-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        var board=NativeBoardFactory.make(mode:.journey,board:21,columns:5,generation:9,seed:7)
        // Exercise old Native saves that stored full opacity for empty cells.
        for index in board.tiles.indices where board.tiles[index].locked && board.tiles[index].value==0 {
            board.tiles[index].alpha=1
        }
        seed.journeyRuns[21]=board;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("area55-home"){!app.home.isHidden};app.navigate(.world(3),interrupt:true)
        try await wait("area55-play"){if self.game(app) != nil{return true};app.world?.onRequest?("continue",21);return false}
        try await wait("area55-transition-admission"){self.game(app)?.incomingOriginalThemedCoverExpected==true || self.game(app)?.boardScene?.isBoardEntryComplete==true}
        XCTAssertTrue(try XCTUnwrap(game(app)).incomingOriginalThemedCoverExpected)
        try await wait("area55-entry"){self.game(app)?.boardScene?.isBoardEntryComplete==true && self.game(app)?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game(app)),scene=try XCTUnwrap(gameplay.boardScene)
        XCTAssertEqual(gameplay.engine.state.board,21);XCTAssertEqual(app.route,.gameplay)
        let ghosts=gameplay.engine.state.tiles.filter{$0.locked && $0.value==0}
        XCTAssertFalse(ghosts.isEmpty)
        for _ in 0..<2 {
            scene.synchronize()
            for tile in ghosts {XCTAssertEqual(try XCTUnwrap(scene.sourceNativeTileNode(tile.id)).alpha,0.25,accuracy:0.0001)}
        }
    }
    func testCompleteRootJourneyMoveCanonicalSaveExitAndReopen()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("complete-journey-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.journeyRuns[1]=NativeBoardState(tiles:[
            .init(id:"a",cell:.init(column:0,row:0),value:3),
            .init(id:"b",cell:.init(column:1,row:0),value:2),
            .init(id:"c",cell:.init(column:2,row:0),value:1)],mode:.journey,board:1,generation:9,moves:37,score:123,wildMeter:0.25)
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("home"){!app.home.isHidden};app.navigate(.world(1),interrupt:true)
        try await wait("world-play"){if self.game(app) != nil{return true};app.world?.onRequest?("continue",1);return false}
        try await wait("journey-transition-admission"){self.game(app)?.incomingOriginalThemedCoverExpected==true || self.game(app)?.boardScene?.isBoardEntryComplete==true}
        XCTAssertTrue(try XCTUnwrap(game(app)).incomingOriginalThemedCoverExpected,
            "v9 World-card Continue must retain the original themed transition for saved Journey boards")
        try await wait("entry"){self.game(app)?.boardScene?.view != nil && self.game(app)?.beforeSourceGameplayAdmission==nil && self.game(app)?.engine.sourceNoMovesRuntimeAuthority?.isCurrent()==true && self.game(app)?.boardScene?.isBoardEntryComplete==true}
        let original=try XCTUnwrap(game(app)),scene=try XCTUnwrap(original.boardScene),scope=try XCTUnwrap(original.sourceScope)
        timeoutDiagnostic={ "shown=\(scene.view != nil) paused=\(String(describing:scene.view?.isPaused)) scenePaused=\(scene.isPaused) scopeCurrent=\(scope.current) initialSave=\(original.sourceInitialBoardSaveAccepted) pendingOrdinary=\(String(describing:original.engine.pendingOrdinaryStack)) face=\(original.engine.hasPendingSourceOrdinaryStackFace) unsavable=\(original.engine.hasUnsavableSourceGameplayState) state=\(original.engine.state) durable=\(String(describing:try? store.load()?.journeyRuns[1])) levelEnd=\(scene.sourceLevelEndDiagnostic())" }
        defer{timeoutDiagnostic=nil}
        try assertKnownIdleOwners(scene)
        let geometry=try XCTUnwrap(scene.boardGeometry),a=geometry.center(row:0,column:0),b=geometry.center(row:0,column:1)
        let beforeDrag=try XCTUnwrap(store.load()?.journeyRuns[1])
        XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b,now:CACurrentMediaTime())
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(try store.load()?.journeyRuns[1],beforeDrag)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:CACurrentMediaTime())).accepted)
        try await wait("stable-move") {
            original.engine.state.moves==36 && original.engine.pendingOrdinaryStack==nil &&
            !original.engine.hasPendingSourceOrdinaryStackFace &&
            original.engine.sourceNoMovesRuntimeAuthority?.capture()?.gameplayTransactionActive==false
        }
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(try store.load()?.journeyRuns[1],original.engine.state)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait("move-save"){
            original.engine.state.moves==36 && original.engine.pendingOrdinaryStack==nil &&
            !original.engine.hasPendingSourceOrdinaryStackFace &&
            (try? store.load()?.journeyRuns[1])==original.engine.state
        }
        let persisted=try XCTUnwrap(store.load()?.journeyRuns[1])
        XCTAssertEqual(persisted.tiles.first{$0.id=="b"}?.value,5);XCTAssertFalse(persisted.tiles.contains{$0.id=="a"})
        try assertKnownIdleOwners(scene)
        original.onExit?();try await wait("exit-modal"){original.presentedViewController is JimiNativeEndRunModal}
        let modal=try XCTUnwrap(original.presentedViewController as? JimiNativeEndRunModal)
        try await wait("exit-ready"){modal.view.isUserInteractionEnabled};modal.buttons[1].sendActions(for:.touchUpInside)
        try await wait("world-return"){self.game(app)==nil && app.world != nil}
        XCTAssertFalse(scope.current);XCTAssertEqual(try store.load()?.journeyRuns[1],persisted)
        try await wait("reopen"){if self.game(app) != nil{return true};app.world?.onRequest?("continue",1);return false}
        try await wait("reentry"){self.game(app)?.boardScene?.view != nil && self.game(app)?.boardScene?.isBoardEntryComplete==true}
        let reopened=try XCTUnwrap(game(app)),reopenedScene=try XCTUnwrap(reopened.boardScene)
        XCTAssertTrue(reopened !== original);XCTAssertEqual(reopened.engine.state.moves,persisted.moves)
        XCTAssertEqual(reopened.engine.state.score,persisted.score)
        // Immutable Source occupied-cell restore reconstructs row-major holders
        // and normalizes depth to one (app-core-load-tiles constructor).
        // SourceRegularRestoreV9Oracle depth-reset records literal depth1 and
        // occupied-cell row-major bind order, independently of Native's recipe.
        XCTAssertEqual(reopened.engine.state.tiles,[
            NativeTile(id:"b",cell:.init(column:1,row:0),value:5,stackDepth:1),
            NativeTile(id:"c",cell:.init(column:2,row:0),value:1,stackDepth:1)])
        try assertKnownIdleOwners(reopenedScene)
    }
    func testCompleteRootPreparedArcadeCommitsPendingRoundBeforeEntry()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("complete-prepared-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun=NativeBoardFactory.make(mode:.arcade,board:1,columns:5,generation:9,seed:7)
        seed.pendingArcadeRound = .init(round:2,score:321,ownerID:"accepted-round-one")
        try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("arcade-home"){!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait("arcade-mounted"){self.game(app) != nil}
        let entering=try XCTUnwrap(game(app)),prepared=try XCTUnwrap(entering.beforeSourceInitialBoardReveal)
        var receipts=0
        entering.beforeSourceInitialBoardReveal={
            receipts+=1
            XCTAssertNil(entering.boardScene?.completedSourceBoardEntry)
            XCTAssertEqual(try? store.load()?.pendingArcadeRound,seed.pendingArcadeRound)
            XCTAssertEqual(try? store.load()?.arcadeRun,seed.arcadeRun)
            XCTAssertTrue(entering.boardScene?.captureSourcePhysicalBoard()?.observedState.tiles.allSatisfy{!$0.visible} == true)
            return prepared()
        }
        try await wait("arcade-entry"){entering.sourceInitialBoardSaveAccepted && entering.boardScene?.view != nil && entering.boardScene?.isBoardEntryComplete==true}
        XCTAssertEqual(receipts,1);XCTAssertTrue(entering.sourceInitialBoardSaveAccepted)
        let saved=try XCTUnwrap(store.load())
        XCTAssertNil(saved.pendingArcadeRound);XCTAssertEqual(saved.arcadeRun?.board,2);XCTAssertEqual(saved.arcadeRun?.score,321)
        try assertKnownIdleOwners(try XCTUnwrap(entering.boardScene))
    }
}
