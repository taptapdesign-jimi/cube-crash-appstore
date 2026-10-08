import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativePaperHandoffTests:XCTestCase {
    func testActualJourneyContinueRetainsIdenticalViewportPaperAtGameplayMount() async throws {
        for size in [CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-paper-handoff-\(UUID().uuidString)")
            defer {try? FileManager.default.removeItem(at:directory)}
            let store=NativeSaveStore(directory:directory)
            let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:1),NativeTile(id:"b",cell:.init(column:1,row:0),value:2)]
            var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false),journeyRuns:[1:NativeBoardState(tiles:tiles,mode:.journey,board:1)])
            seed.progression.firstPlayTutorialComplete=true;seed.journeyRunSavedAt[1]=Date().timeIntervalSince1970;try store.save(seed)
            let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store)
            let host=UIViewController(),window=UIWindow(frame:CGRect(origin:.zero,size:size))
            let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
            defer {bootstrap.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            app.view.frame=window.bounds;app.view.layoutIfNeeded()
            let paper=try XCTUnwrap(app.view.subviews.first as? NativeAppPaperSurface)
            paper.layoutIfNeeded();let initial=render(paper)
            app.navigate(.world(1),interrupt:true)
            try await waitUntil {app.world?.isReadyForInput == true}
            app.world?.onRequest?("continue",1)
            try await waitUntil {app.route == .gameplay}
            let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
            game.view.layoutIfNeeded()
            let gameplayPaper=try XCTUnwrap(game.view.subviews.first as? NativeAppPaperSurface)
            gameplayPaper.layoutIfNeeded()
            XCTAssertEqual(paper.bounds,gameplayPaper.bounds)
            XCTAssertEqual(initial,render(gameplayPaper),"The first mounted gameplay paper must not replace the Journey viewport with a different composition")
            XCTAssertTrue(app.view.subviews.first === paper)
            XCTAssertEqual(initial,render(paper))
        }
    }
    private func render(_ view:UIView)->Data? {
        let format=UIGraphicsImageRendererFormat();format.scale=1
        return UIGraphicsImageRenderer(bounds:view.bounds,format:format).image{view.layer.render(in:$0.cgContext)}.pngData()
    }
    private func waitUntil(_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(12)
        while !predicate() {if Date()>deadline {XCTFail("Native paper handoff did not reach its actual route");throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
    }
}
