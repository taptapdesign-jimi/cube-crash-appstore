import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeGhostReuseTests:XCTestCase {
    private func makeScene()->NativeBoardScene {
        let state=NativeBoardState(columns:5,rows:9,tiles:[.init(id:"occupied",cell:.init(column:0,row:0),value:1)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),
            resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0))
        return scene
    }
    private func ghosts(_ root:SKNode)->[SKSpriteNode] {
        root.children.flatMap {child->[SKSpriteNode] in
            let own=(child as? SKSpriteNode).map{($0.name?.hasPrefix("native-ghost-")==true) ? [$0]:[]} ?? []
            return own+ghosts(child)
        }
    }
    private func ghost(_ scene:NativeBoardScene,column:Int,row:Int)throws->SKSpriteNode {
        try XCTUnwrap(ghosts(scene).first{$0.name=="native-ghost-\(column)-\(row)"})
    }
    func testActualSceneRepeatedSynchronizeReusesAllEmptyCellIdentities()throws {
        let scene=makeScene();defer{scene.dispose()}
        let original=ghosts(scene)
        XCTAssertEqual(original.count,44)
        let identities=Set(original.map(ObjectIdentifier.init))
        for _ in 0..<12 {scene.synchronize()}
        XCTAssertEqual(Set(ghosts(scene).map(ObjectIdentifier.init)),identities)
        XCTAssertEqual(ghosts(scene).count,44)
        for node in ghosts(scene) {XCTAssertEqual(node.alpha,CGFloat(Float(0.08)),accuracy:1e-7);XCTAssertFalse(node.isHidden)}
    }
    func testActualOccupiedToggleRetainsDetachedGhostWithoutAddingExitTargets()throws {
        let scene=makeScene();defer{scene.dispose()}
        let original=try ghost(scene,column:1,row:0),parent=try XCTUnwrap(original.parent)
        var filled=scene.engine.state
        filled.tiles.append(.init(id:"new",cell:.init(column:1,row:0),value:2))
        scene.engine.restart(state:filled);scene.synchronize()
        XCTAssertNil(original.parent);XCTAssertEqual(ghosts(scene).count,43)
        XCTAssertFalse(parent.children.contains{$0 === original},"Occupied cells must not add authored exit scheduling or RNG work")
        var emptied=scene.engine.state;emptied.tiles.removeAll{$0.id=="new"}
        scene.engine.restart(state:emptied);scene.synchronize()
        XCTAssertTrue(try ghost(scene,column:1,row:0) === original)
        XCTAssertTrue(original.parent === parent);XCTAssertEqual(ghosts(scene).count,44)
        XCTAssertEqual(parent.children.first?.name,"native-ghost-1-0","Restored cells retain row-major exit scheduling order")
    }
    func testActualRelayoutResetsExitPosePreservesTextureAndDisposeReleasesPool()throws {
        let scene=makeScene()
        var retained:SKSpriteNode?=try ghost(scene,column:1,row:0)
        let texture=try XCTUnwrap(retained?.texture)
        retained?.setScale(0.4);retained?.zRotation=0.5;retained?.alpha=0.2
        scene.layout(size:.init(width:430,height:932),insets:.init(top:47,left:0,bottom:34,right:0))
        let geometry=try XCTUnwrap(scene.boardGeometry),node=try XCTUnwrap(retained)
        XCTAssertTrue(try ghost(scene,column:1,row:0) === node);XCTAssertTrue(node.texture === texture)
        XCTAssertEqual(node.position.x,geometry.center(row:0,column:1).x,accuracy:1e-4)
        XCTAssertEqual(node.position.y,geometry.center(row:0,column:1).y,accuracy:1e-4)
        XCTAssertEqual(node.size.width,geometry.tileSize,accuracy:1e-4)
        XCTAssertEqual(node.xScale,1);XCTAssertEqual(node.yScale,1);XCTAssertEqual(node.zRotation,0)
        XCTAssertEqual(node.alpha,CGFloat(Float(0.08)),accuracy:1e-7)
        retained=nil
        scene.dispose()
        XCTAssertNil(node.parent);XCTAssertEqual(ghosts(scene).count,0)
    }
    func testActualBoardShrinkPrunesObsoleteCellsAndDisposalDropsRemainingCache()throws {
        let scene=makeScene()
        weak var obsolete:SKSpriteNode?=try ghost(scene,column:4,row:8)
        weak var remaining:SKSpriteNode?=try ghost(scene,column:1,row:0)
        var state=scene.engine.state;state.rows=8
        scene.engine.restart(state:state);scene.synchronize()
        XCTAssertNil(obsolete);XCTAssertEqual(ghosts(scene).count,39)
        scene.dispose();XCTAssertNil(remaining)
    }
}
