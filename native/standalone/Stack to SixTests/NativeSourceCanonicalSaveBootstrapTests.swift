import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceCanonicalSaveBootstrapTests:XCTestCase {
    func testPhysicalFactoryKeepsTransientReadsLazyAndRefusesReplacedRoster()throws {
        let canonical=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4)])
        var current=true,reads=0
        let read:()->Bool?={reads+=1;return false}
        let hooks=NativeSourceCanonicalSaveTransient.Hooks(current:{current},busyEnding:read,
            spawningOrPulling:read,specialActive:read,regularHandoff:read,
            cleanupClaim:read,livingDrag:read,foregroundDrop:read,livingTileMarker:read)
        let fields=NativeSourceCanonicalSaveGuard(runMode:canonical.mode.rawValue,skipRebuildBoard:false,
            journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,
            gameplayTransientBusy:false,freshArcadeEntryAuthorized:false)
        var painted=canonical;painted.tiles[0].alpha=0.5
        let capture=try XCTUnwrap(NativeSourceCanonicalSaveCapture.physical(canonicalState:canonical,
            physicalState:painted,eventModes:["a":"static"],guardFields:fields,transient:hooks,
            missingOwners:["actual-unmounted-owner"],physicalStillMatches:{current}))
        XCTAssertEqual(reads,0);XCTAssertEqual(capture.missingOwners,["actual-unmounted-owner"])
        XCTAssertTrue(capture.matchesCanonicalState(canonical));XCTAssertEqual(canonical.tiles[0].alpha,1)
        XCTAssertNil(NativeSourceCanonicalSaveCapture.physical(canonicalState:canonical,
            physicalState:painted,eventModes:[:],guardFields:fields,transient:hooks,
            missingOwners:[],physicalStillMatches:{true}))
        XCTAssertNil(NativeSourceCanonicalSaveCapture.physical(canonicalState:canonical,
            physicalState:painted,eventModes:["a":"static"],guardFields:fields,transient:hooks,
            missingOwners:[],physicalStillMatches:{current=false;return true}))
        XCTAssertEqual(reads,0);XCTAssertFalse(current)
    }
    func testSourcePaintReceiptCannotBypassOriginalPassivePlayableSnapshotRules() throws {
        let canonical=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4)])
        let hooks=NativeSourceCanonicalSaveTransient.Hooks(current:{true},busyEnding:{false},spawningOrPulling:{false},specialActive:{false},regularHandoff:{false},cleanupClaim:{false},livingDrag:{false},foregroundDrop:{false},livingTileMarker:{false})
        let fields=NativeSourceCanonicalSaveGuard(runMode:canonical.mode.rawValue,skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,gameplayTransientBusy:false,freshArcadeEntryAuthorized:true)
        for (alpha,visible,mode,prepared,expected) in [
            (0.2,true,"static",false,true),(0.2,false,"static",false,false),
            (0.2,false,"static",true,true),(0.01,true,"static",true,false),
            (0.010001,true,"static",false,true),(1.0,true,"none",true,false),
            (1.0,true,"passive",true,false)] {
            var painted=canonical;painted.tiles[0].alpha=alpha;painted.tiles[0].visible=visible
            let receipt=try XCTUnwrap(NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:painted))
            let capture=NativeSourceCanonicalSaveCapture(guardFields:fields,transient:hooks,missingOwners:[],physicalState:painted,paintedStateReceipt:receipt,physicalEventModes:["a":mode])
            XCTAssertTrue(capture.matchesCanonicalState(canonical))
            XCTAssertEqual(capture.hasSerializablePaint(allowPreparedHidden:prepared),expected)
            XCTAssertEqual(canonical.tiles[0].alpha,1);XCTAssertTrue(canonical.tiles[0].visible)
        }
        let receipt=try XCTUnwrap(NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(canonicalState:canonical,paintedState:canonical))
        let missing=NativeSourceCanonicalSaveCapture(guardFields:fields,transient:hooks,missingOwners:[],physicalState:canonical,paintedStateReceipt:receipt)
        XCTAssertFalse(missing.hasCompletePhysicalEventModes)
        XCTAssertFalse(missing.hasSerializablePaint(allowPreparedHidden:true))
        var unrelated=canonical;unrelated.moves-=1
        XCTAssertFalse(missing.matchesCanonicalState(unrelated))
    }
    func testActualFreshSourceRouteRefusesMissingMarkerOwnersWithoutPruningRegistriesOrOverwritingDurableRun()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-save-refusal-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false));seed.progression.firstPlayTutorialComplete=true;try store.save(seed)
        var dates=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceDateMilliseconds:{dates+=1;return 100})
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
        XCTAssertFalse(bootstrap.sourceCanonicalGameplaySaveEnabled)
        bootstrap.sourceInitialFreshStartupEnabled=true
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
        let deadline=Date().addingTimeInterval(8)
        while !app.children.contains(where:{$0 is NativeGameplayViewController}) {if Date()>deadline{throw NSError(domain:"SourceSaveMount",code:1)};try await Task.sleep(nanoseconds:20_000_000)}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scope=try XCTUnwrap(game.sourceScope)
        let before=try XCTUnwrap(store.load()?.arcadeRun),beforeDates=dates
        XCTAssertFalse(scope.registries.missing([.sourceTileLifecycle,.sourceSpawnMarkers]).isEmpty)
        bootstrap.sourceCanonicalGameplaySaveEnabled=true
        var reads=0
        let refuse=bootstrap.configureSourceCanonicalGameplaySave(observe:{actual in
            XCTAssertTrue(actual === game)
            let state=actual.engine.state
            guard let physical=actual.boardScene?.captureSourcePhysicalBoard() else{XCTFail("Actual Source physical roster unavailable");return nil}
            XCTAssertEqual(physical.canonicalState,state)
            XCTAssertNotNil(physical.paintedStateReceipt)
            let h=NativeSourceCanonicalSaveTransient.Hooks(current:{scope.current},busyEnding:{reads+=1;return false},spawningOrPulling:{false},specialActive:{XCTFail("installer must not query Special");return false},regularHandoff:{false},cleanupClaim:{false},livingDrag:{false},foregroundDrop:{false},livingTileMarker:{false})
            return .init(guardFields:.init(runMode:state.mode.rawValue,skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,gameplayTransientBusy:false,freshArcadeEntryAuthorized:false),transient:h,missingOwners:[],physicalState:physical.observedState,paintedStateReceipt:physical.paintedStateReceipt,physicalEventModes:physical.tiles.mapValues(\.eventMode),physicalStillMatches:physical.isStillCurrent)
        })
        XCTAssertNil(refuse);XCTAssertEqual(reads,0);XCTAssertEqual(dates,beforeDates)
        XCTAssertEqual(try store.load()?.arcadeRun,before)
        XCTAssertFalse(game.engine.sourceHUDStarJobsEnabled,"save installation never enables gameplay flags")
    }
}
