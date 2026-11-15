import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativePresentationFailureRecoveryTests:XCTestCase {
    func testSameControllerGenerationRefreshRejectsOldBridgeAndSealsCurrentRun()async throws {
        let engine=NativeGameplayEngine(state:.init(tiles:[
            .init(id:"one",cell:.init(column:0,row:0),value:1),
            .init(id:"two",cell:.init(column:1,row:1),value:2)
        ],generation:9))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
        let context=NativeGameplaySourceContext(service:service,visualRandom:{0.5})
        let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        // The fallback reuses its ordinary-contact scope without opting into
        // the complete Special idle capability/preparation graph.
        game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        game.view.layoutIfNeeded()
        defer{game.dispose();context.dispose();service.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let scene=try XCTUnwrap(game.boardScene)
        try await wait("Initial mounted board"){scene.isBoardEntryComplete}
        let old=try XCTUnwrap(scene.onPresentationFailure),oldGeneration=engine.state.generation
        var next=engine.state;next.generation=oldGeneration+1
        engine.restart(state:next);game.refreshFromEngine()
        XCTAssertNotEqual(engine.state.generation,oldGeneration)
        XCTAssertTrue(game.boardScene === scene)
        let current=try XCTUnwrap(scene.onPresentationFailure)
        var recoveries=0;game.onSourcePresentationFailure={recoveries+=1}
        old("stale-generic-generation")
        XCTAssertNil(game.sourcePresentationFailure)
        XCTAssertEqual(recoveries,0)
        XCTAssertTrue(scene.sourceAnimationBindingAdmissionOpen)
        let reason="current-generic-generation-"+UUID().uuidString
        current(reason)
        XCTAssertEqual(game.sourcePresentationFailureGeneration,engine.state.generation)
        XCTAssertEqual(game.sourcePresentationFailure?.reason,reason)
        XCTAssertEqual(recoveries,1)
        XCTAssertFalse(scene.sourceAnimationBindingAdmissionOpen)
        XCTAssertEqual(NativeSourceRejectionDiagnostics.read(from:NativeSourceRejectionDiagnostics.fileURL).last?.reason,reason)
        old("late-old-generation");current("duplicate-current-generation")
        XCTAssertEqual(recoveries,1)
    }
    func testMountedGenericFailureSealsOnceAndExplicitExitPreservesDurableRun()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("generic-failure-recovery-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        envelope.arcadeRun = .init(tiles:[
            .init(id:"fish",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"fish"),
            .init(id:"juice",cell:.init(column:2,row:1),value:6,archetype:.juice),
            .init(id:"one",cell:.init(column:4,row:8),value:1),
            .init(id:"two",cell:.init(column:3,row:5),value:2),
            .init(id:"three",cell:.init(column:1,row:3),value:3)
        ],mode:.arcade,board:1,stage:5,generation:9,moves:12,score:123,rngState:777)
        var preceding=envelope;preceding.arcadeRun?.score=122
        try store.save(preceding);try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded()
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("Home admission"){!app.home.isHidden && !app.transitioning}
        app.navigate(.gameplay,interrupt:true)
        try await wait("Actual complete gameplay admission"){
            app.children.compactMap{$0 as? NativeGameplayViewController}.first.map{ game in
                guard let scene=game.boardScene,let render=scene.gameplayRenderHost else{return false}
                return game.view.window === window && render.renderedScene === scene &&
                    !render.renderingPaused && scene.isBoardEntryComplete &&
                    game.beforeSourceGameplayAdmission==nil && !game.engine.hasUnsavableSourceGameplayState
            }==true
        }
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
        let failure=try XCTUnwrap(scene.onPresentationFailure,"Generic setup rejection must reach the existing Source recovery owner")
        let before=game.engine.state,durable=try store.load()
        let saves=try ["state-v1.json","state-v1.previous.json"].map{try Data(contentsOf:directory.appendingPathComponent($0))}
        let reason="source_direct_main_setup_failed-"+UUID().uuidString
        failure(reason)
        XCTAssertEqual(game.sourcePresentationFailureGeneration,before.generation)
        XCTAssertEqual(game.sourcePresentationFailure?.boardState,before)
        XCTAssertEqual(game.engine.state,before)
        XCTAssertFalse(scene.sourceAnimationBindingAdmissionOpen)
        XCTAssertTrue(scene.navigationLocked)
        XCTAssertFalse(scene.beginDrag(at:.zero))
        let recovery=try XCTUnwrap(host.presentedViewController as? JimiNativeEndRunModal)
        XCTAssertEqual(app.route,.gameplay)
        XCTAssertTrue(game.parent === app)
        let evidence=NativeSourceRejectionDiagnostics.read(from:NativeSourceRejectionDiagnostics.fileURL)
        XCTAssertEqual(evidence.last?.reason,reason)
        XCTAssertEqual(evidence.last?.generation,before.generation)
        failure("duplicate-generic-failure")
        scene.onSourcePresentationFailure?("duplicate-source-failure",before.generation)
        XCTAssertTrue(host.presentedViewController === recovery)
        XCTAssertEqual(NativeSourceRejectionDiagnostics.read(from:NativeSourceRejectionDiagnostics.fileURL),evidence)
        XCTAssertEqual(try store.load(),durable)
        XCTAssertEqual(try ["state-v1.json","state-v1.previous.json"].map{try Data(contentsOf:directory.appendingPathComponent($0))},saves)
        try await wait("Existing recovery choice becomes interactive"){recovery.view.window === window && recovery.view.isUserInteractionEnabled}
        let exit=try XCTUnwrap(all(recovery.view).compactMap{$0 as? UIButton}.first{$0.accessibilityIdentifier=="native.end-run.exit"})
        exit.sendActions(for:.touchUpInside)
        try await wait("Explicit recovery Exit") {app.route != .gameplay}
        XCTAssertFalse(scope.current)
        XCTAssertNil(game.parent)
        XCTAssertEqual(try store.load(),durable)
        XCTAssertEqual(try ["state-v1.json","state-v1.previous.json"].map{try Data(contentsOf:directory.appendingPathComponent($0))},saves)
        failure("late-retired-generic-failure")
        XCTAssertEqual(NativeSourceRejectionDiagnostics.read(from:NativeSourceRejectionDiagnostics.fileURL),evidence)
    }
    private func all(_ view:UIView)->[UIView]{[view]+view.subviews.flatMap(all)}
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){guard Date()<deadline else{XCTFail(label);throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
}
