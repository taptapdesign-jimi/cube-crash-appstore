import XCTest
import SpriteKit
@testable import Stack_to_Six

nonisolated final class NativeMeterRestorationVisibilityTests:XCTestCase {
    @MainActor func testRestorePoseSampledAtLocalZeroRevealsSameCapturedNodeWithoutSceneRepaint()throws {
        for interruptedLocal in [0.0,0.3,0.8,1.835] {
            let parent=SKNode(),stage=SKNode(),tile=SKNode();stage.addChild(parent);parent.addChild(tile)
            tile.position = .init(x:164,y:244);tile.setScale(0.4);tile.isHidden=true;tile.alpha=0
            let capture=NativeWildMeterDropRuntime.Capture(id:"actual-restoration",generation:1,epoch:7)
            let handoff=try XCTUnwrap(NativeWildMeterDropNodeHandoff(tile:tile,stage:stage,capture:capture,sourceParentVisualScale:0.4,stagePoint:{.init(x:$0.x,y:844-$0.y)},isCurrent:{receipt,node in receipt==capture && node === tile}))
            let plan=NativeWildMeterDropPlan(arcade:false,viewport:.init(x:390,y:844),tileSize:128,target:.init(x:164,y:244),parentWorld:.init(a:0.4,d:0.4),originalRotation:0,originalZIndex:0,usesUniformDropScale:false,random:{0.5})
            XCTAssertTrue(handoff.apply(plan.sample(seconds:interruptedLocal,impactStart:nil,restored:false,wallHandoffPending:false).tile))
            // Presentation's literal restore event samples local0. Visibility
            // must follow restoreTile->revealTile independently of travel age.
            let restored=plan.sample(seconds:0,impactStart:nil,restored:true,wallHandoffPending:true).tile
            XCTAssertTrue(restored.visible)
            XCTAssertTrue(handoff.apply(restored));XCTAssertTrue(tile.parent === parent)
            XCTAssertFalse(tile.isHidden);XCTAssertEqual(tile.alpha,1)
            // Subsequent wall/bookkeeping does not need to re-reveal the Node.
            XCTAssertTrue(handoff.apply(restored));XCTAssertFalse(tile.isHidden)
            handoff.dispose()
        }
    }
}
