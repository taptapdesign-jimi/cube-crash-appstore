import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeFirstPlayLaunchPolicyTests:XCTestCase {
    func testUnacknowledgedGenuineGuideStartsFreshTutorialOnDefaultNativePlay()async throws {try await run(source:false)}
    func testUnacknowledgedGenuineGuideStartsFreshSourceDemoInsteadOfSavedConstructor()async throws {try await run(source:true)}
    func testJourneyPlayStartsFreshDefaultTutorialWithoutConsumingSavedArcadeGuide()async throws {try await run(source:false,journey:true)}
    func testJourneyPlayStartsFreshSourceDemoWithoutWorldOrSavedArcadeGuide()async throws {try await run(source:true,journey:true)}
    func testImporterMatchesExecutedImmutableSourceFirstPlayRequests()throws {
        struct Oracle:Decodable {struct Row:Decodable {let done:String?,force:String?,forced:Bool,resume:Bool,saved:Bool,savedQueries:Int};let rows:[Row]}
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeFirstPlayLaunchSourceOracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url))
        for row in oracle.rows {
            var storage:[String:String]=[:]
            storage["cc_first_play_tutorial_done"]=row.done;storage["cc_first_play_tutorial_force_next"]=row.force
            let data=try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.native","storage":storage])
            let result=try NativeHybridImporter.importExport(data)
            XCTAssertEqual(result.progression.firstPlayTutorialComplete,!row.forced,"done=\(String(describing:row.done)) force=\(String(describing:row.force))")
            if row.forced {XCTAssertFalse(row.resume);XCTAssertEqual(row.savedQueries,0)}
        }
    }
    private func run(source:Bool,journey:Bool=false)async throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeGenuineCompletedGuideSave",withExtension:"json"))
        let seed=try JSONDecoder().decode(NativeSaveEnvelope.self,from:Data(contentsOf:url))
        XCTAssertFalse(seed.progression.firstPlayTutorialComplete);XCTAssertEqual(seed.arcadeRun?.tutorial?.guideCompleted,true)
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-first-play-policy-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory);try store.save(seed)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:source ? context:nil)
        if source {
            bootstrap.sourceInitialFreshStartupEnabled=true;bootstrap.sourceInitialRegularResumeEnabled=true
            bootstrap.sourceBoardEntryEnabled=true;bootstrap.sourceTutorialActivationEnabled=true
            bootstrap.sourceTutorialIntroEnabled=true;bootstrap.sourceTutorialHUDEnabled=true
        }
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        // Mounting Home reads the profile without resetting it. Original forced
        // Play entry makes a new demo; it must not borrow the old guide board.
        XCTAssertEqual(try store.load()?.arcadeRun,seed.arcadeRun)
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await waitUntil { app.route == .home && app.home.isUserInteractionEnabled }
        app.home.onActivate?(journey ? 0:1)
        if !journey {
            try await waitUntil { app.route == .arcadeHub && app.arcadeHub.hub.scrollView.isUserInteractionEnabled }
            let endurance=try XCTUnwrap(app.arcadeHub.hub.worldUnits.first { $0.tag == 1 })
            endurance.sendActions(for:.touchUpInside)
            func findPlay(_ root:UIView)->UIButton? {
                if let button=root as? UIButton,button.accessibilityIdentifier == "native.arcade-world-modal.play" { return button }
                return root.subviews.lazy.compactMap { findPlay($0) }.first
            }
            try await waitUntil { findPlay(app.arcadeHub) != nil }
            let play=try XCTUnwrap(findPlay(app.arcadeHub))
            try await waitUntil { play.isEnabled }
            play.sendActions(for:.touchUpInside)
        }
        try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertEqual(game.engine.state.moves,50);XCTAssertEqual(game.engine.state.score,0)
        XCTAssertEqual(game.engine.state.tiles.count,45);XCTAssertNotEqual(game.engine.state.tiles,seed.arcadeRun?.tiles)
        XCTAssertEqual(game.engine.state.mode,journey ? .journey:.arcade)
        if journey {
            XCTAssertEqual(try store.load()?.arcadeRun,seed.arcadeRun,"Journey first entry cannot consume the preserved Arcade document")
            XCTAssertNil(app.world)
        } else {XCTAssertGreaterThan(game.engine.state.generation,try XCTUnwrap(seed.arcadeRun).generation)}
        if source {
            XCTAssertNotNil(game.sourceInitialConstruction);XCTAssertNotNil(game.engine.pendingSourceTutorialDemoActivation)
            XCTAssertTrue(game.sourceTutorialHUDEnabled);XCTAssertTrue(game.sourceBoardEntryEnabled)
        } else {
            XCTAssertEqual(game.engine.state.tutorial?.active,true);XCTAssertEqual(game.engine.state.tutorial?.step,.stack)
            XCTAssertEqual(game.engine.state.tutorial?.guideCompleted,false);XCTAssertEqual(game.engine.state.tutorial?.completionAssist,false)
        }
        XCTAssertFalse(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
    }
    private func waitUntil(timeout:Double=8,_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(timeout)
        while !condition(),Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(condition())
    }
}
