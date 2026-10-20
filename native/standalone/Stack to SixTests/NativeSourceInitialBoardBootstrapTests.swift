import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceInitialBoardBootstrapTests:XCTestCase {
    func testGenuineFreshArcadeRouteAdoptsExactCapturedObjectsBeforeFirstRAFAndKeepsCue() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-initial-bootstrap-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true;try store.save(envelope)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        var count=0
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{count+=1;return Double((count*37)%97)/97})
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
        bootstrap.sourceInitialFreshStartupEnabled=true
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.gameplay,interrupt:true)
        try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction)
        XCTAssertTrue(scene.sourceInitialStartupReady);XCTAssertTrue(game.sourceScope?.service === service)
        // Child-controller adoption precedes the genuine UIKit layout cue.
        try await waitUntil{game.view.subviews.contains{$0 is NativeArcadeRoundPresentation}}
        XCTAssertTrue(game.view.subviews.contains{$0 is NativeArcadeRoundPresentation})
        XCTAssertFalse(game.sourceSmallStackPresentationEnabled)
        for holder in construction.recipe?.holders ?? [] {XCTAssertTrue(scene.sourceNativeTileNode(holder.tileID) === construction.nodes[holder.tileID])}
        let opening=game.engine.state.tiles
        XCTAssertNil(try store.load()?.arcadeRun,"An untouched fresh board must remain Play, not Continue")
        // Actual APP callbacks may already have arrived by this awaited test
        // task. No fabricated arrival, fixed sleep or extra face draw is used.
        service.deliver(wallMilliseconds:16)
        XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertEqual(game.engine.state.tiles,opening)
    }
    func testDefaultBootstrapAndVCFlagsDoNotCreateSourceConstructorForFreshRoute() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-initial-default-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false));envelope.progression.firstPlayTutorialComplete=true;try store.save(envelope)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
        try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        XCTAssertNil(game.sourceInitialConstruction);XCTAssertFalse(game.sourceSmallStackPresentationEnabled)
    }
    private func waitUntil(_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(8)
        while !predicate() {if Date()>deadline {throw NSError(domain:"SourceInitialBoardTimeout",code:1)};try await Task.sleep(nanoseconds:20_000_000)}
    }
}
