import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeArcadeHelpHUDTests:XCTestCase {
    func testActualSceneOmitsPureDiceCrateAndControllerRejectsItsProgrammaticHelp()throws {
        for variant in NativeArcadeVariant.allCases {
            let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.arcade,board:1,arcadeVariant:variant))
            let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
            game.loadViewIfNeeded()
            defer { game.dispose() }
            let scene=try XCTUnwrap(game.boardScene)
            scene.layout(size:CGSize(width:390,height:844),insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
            let icon=scene.childNode(withName:"//native-game-help")
            XCTAssertEqual(icon == nil,variant == .pureDice)
            var helpRequests=0;game.onHelp={helpRequests += 1}
            let before=engine.state
            scene.onHelpRequest?()
            XCTAssertEqual(helpRequests,variant == .pureDice ? 0 : 1)
            XCTAssertEqual(engine.state,before)
            if variant == .pureDice {
                let y=NativeGameplayChromePlan.make(viewport:scene.size,safeTop:47).valueRowY
                XCTAssertFalse(scene.handleHUDContact(at:CGPoint(x:118,y:y)),"Former crate location has no Pure Dice hit target")
            }
        }
    }
    func testJourneyRetainsBackpackHUD()throws {
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:1))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        defer { scene.dispose() }
        XCTAssertNotNil(scene.childNode(withName:"//native-game-help"))
    }
}
