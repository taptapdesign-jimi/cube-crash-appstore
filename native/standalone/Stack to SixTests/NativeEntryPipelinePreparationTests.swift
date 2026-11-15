import XCTest
import UIKit
import SpriteKit
import Metal
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeEntryPipelinePreparationTests:XCTestCase {
    func testCancelledQueuedPreparationDoesNotSubmitOrPublishSuccess()async throws {
        var queued:(@Sendable ()->Void)?
        let done=expectation(description:"cancelled request settles false")
        var receipts=0
        var request:NativeGameplayPipelinePreparation.Request?=NativeGameplayPipelinePreparation.prepare(textures:[],enqueue:{queued=$0}) {ready in
            receipts+=1;XCTAssertFalse(ready);done.fulfill()
        }
        weak var released=request
        request?.cancel();queued?();queued=nil
        await fulfillment(of:[done],timeout:2)
        XCTAssertEqual(receipts,1);XCTAssertEqual(request?.submittedFrames,0)
        request=nil
        XCTAssertNil(released,"No completion, timer or worker may retain the retired request")
    }
    func testActualGPUPreparationSubmitsOneFiniteFrameAndReleasesRequest()async throws {
        guard MTLCreateSystemDefaultDevice() != nil else{throw XCTSkip("Requires Metal")}
        let done=expectation(description:"scratch frame GPU completion")
        var request:NativeGameplayPipelinePreparation.Request?=NativeGameplayPipelinePreparation.prepare(textures:[]) {ready in
            XCTAssertTrue(ready);done.fulfill()
        }
        weak var released=request
        await fulfillment(of:[done],timeout:15)
        XCTAssertEqual(request?.submittedFrames,1)
        request=nil
        // The command callback may be unwinding after its main-queue receipt.
        for _ in 0..<20 where released != nil {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNil(released)
    }
    func testColdArcadeRootFirstVisibleWaveDoesNotCompilePipelinesOnMain()async throws {
        guard MTLCreateSystemDefaultDevice() != nil else{throw XCTSkip("Requires Metal")}
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("arcade-pipeline-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true
        try store.save(envelope)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:820,height:1180));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("home"){!app.home.isHidden && app.home.isUserInteractionEnabled}
        app.navigate(.arcadeHub,interrupt:true)
        try await wait("hub"){app.route == .arcadeHub && !app.transitioning}
        app.arcadeHub.onPlay?(NativeArcadeVariant.endurance.rawValue)
        try await wait("game") {app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let surface=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeOwnedMetalGameplayView}.first)
        surface.diagnosticsEnabled=true
        try await wait("real entry") {
            surface.renderedScene === game.boardScene &&
                (surface.diagnosticSnapshot()["completedFrames"] as? Int ?? 0)>10 &&
                game.boardScene?.isBoardEntryComplete==true
        }
        let stats=surface.diagnosticSnapshot()
        print("[NativeEntryPipelinesTest]",stats)
        XCTAssertGreaterThan(stats["completedFrames"] as? Int ?? 0,10)
        XCTAssertEqual(stats["failedFrames"] as? Int,0)
        XCTAssertLessThan(stats["encodeWorstMs"] as? Double ?? .infinity,150,"The previous cold wave stalled for858ms; compile on the preparation worker before visible entry")
        XCTAssertFalse(game.engine.isDragging)
        XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
    }
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let end=Date().addingTimeInterval(25)
        while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(predicate(),label)
    }
}
