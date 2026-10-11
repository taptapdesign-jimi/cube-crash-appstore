import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeDefaultNoMovesMountedTests:XCTestCase {
    func testRealNativeNoMovesOriginalGraphPausesPickupClearsAndConfirmationWaitsForTextExit()async throws {
        let tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:4),NativeTile(id:"b",cell:.init(column:1,row:0),value:3)]
        let engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles))
        let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        let oldWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        defer{game.dispose();window.isHidden=true;oldWindow?.makeKeyAndVisible()}
        var cues=0,terminals=0
        game.onGameplayEvent={event in
            if event.kind == .noMovesCandidate {
                cues+=1
                XCTAssertEqual(game.nativeNoMovesUIKit?.presentation?.glyphViews.count,8,"Cue follows actual original glyph mount")
            }
        }
        game.onTerminal={resolution in
            XCTAssertEqual(resolution.kind,.fail);XCTAssertNil(game.nativeNoMovesUIKit?.presentation,"Modal follows actual text disposal")
            terminals+=1
        }
        game.loadViewIfNeeded()
        func wait(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(8)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"NativeDefaultNoMoves",code:1)};try await Task.sleep(for:.milliseconds(10))}
        }
        try await wait{game.nativeNoMovesUIKit?.presentation?.glyphViews.allSatisfy{$0.alpha>0.9}==true}
        let scene=try XCTUnwrap(game.boardScene),owner=try XCTUnwrap(game.nativeNoMovesUIKit),first=try XCTUnwrap(owner.presentation)
        XCTAssertEqual(first.cloudViews.count,5);XCTAssertTrue(first.glyphViews.allSatisfy{$0.font.fontName=="Baloo2-ExtraBold"})
        XCTAssertFalse(first.isUserInteractionEnabled);XCTAssertEqual(owner.preparationCount,1);XCTAssertEqual(cues,1)
        XCTAssertNil(game.sourceScope);XCTAssertFalse(engine.stagedSourceNoMoves);XCTAssertNil(engine.sourceNoMovesRuntimeAuthority)
        let before=engine.state
        game.setSuspended(true)
        let pose=first.glyphViews[0].layer.transform,cloud=first.cloudViews[0].center
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertTrue(CATransform3DEqualToTransform(first.glyphViews[0].layer.transform,pose));XCTAssertEqual(first.cloudViews[0].center,cloud)
        XCTAssertEqual(engine.state,before);XCTAssertEqual(terminals,0);XCTAssertTrue(owner.presentation === first)
        game.setSuspended(false)
        let image=UIGraphicsImageRenderer(bounds:game.view.bounds).image{_ in game.view.drawHierarchy(in:game.view.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:image);attachment.name="Native default NO MOVES original glyphs and clouds";attachment.lifetime = .keepAlways;add(attachment)
        let geometry=try XCTUnwrap(scene.boardGeometry)
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        XCTAssertNil(owner.presentation);XCTAssertTrue(first.disposed);XCTAssertTrue(first.graph.disposed)
        XCTAssertEqual(engine.state,before);XCTAssertNil(scene.action(forKey:"no-moves-confirm"));XCTAssertEqual(terminals,0)
        scene.cancelDrag(pointerCancelled:true);scene.evaluate()
        try await wait{owner.presentation != nil}
        XCTAssertEqual(cues,2);XCTAssertEqual(owner.preparationCount,1)
        try await wait{engine.state.terminal?.kind == .fail}
        XCTAssertEqual(terminals,0,"Committed Core confirmation cannot bypass its mounted text exit")
        try await wait{terminals==1}
        XCTAssertNil(owner.presentation);XCTAssertEqual(engine.state.tiles,before.tiles)
        scene.evaluate();XCTAssertEqual(terminals,1)
    }
}
