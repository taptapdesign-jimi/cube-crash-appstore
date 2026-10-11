import XCTest
import SpriteKit
@testable import Stack_to_Six

nonisolated final class NativeMeterRestorationVisibilityTests:XCTestCase {
    @MainActor func testV9CarrierAndRestorationIgnoreAnimatedDieScaleInJourneyAndArcade()throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let context=NativeGameplaySourceContext(service:service,visualRandom:{0.5})
        let scope=try XCTUnwrap(context.beginScene{})
        let textures=NativeBoardTextures(root:root),stage=SKNode()
        let tile=NativeDiceNode(id:"carrier-scale",value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures)
        stage.addChild(tile);tile.position = .init(x:160,y:300)
        tile.installSourceOuterDriver(scope.timeline,generation:7,geometryScale:0.4)
        defer{tile.dispose();textures.dispose();context.dispose();service.dispose()}
        for arcade in [false,true] {
            tile.paintSourceOuterScale(.init(x:2.3,y:1.8))
            let plan=try XCTUnwrap(NativeMeterSceneGeometry.plan(tile:tile,stage:stage,viewport:.init(width:390,height:844),arcade:arcade,random:{0.5}))
            XCTAssertEqual(plan.visualScale,0.4,accuracy:0.000001)
            let textureWidth=arcade ? 290.0:379.0
            XCTAssertEqual(plan.carrierScale*textureWidth,128*0.4*2.15*1.15*(arcade ? 0.95:1),accuracy:0.000001)
            let capture=NativeWildMeterDropRuntime.Capture(id:"scale",generation:7,epoch:1)
            let handoff=try XCTUnwrap(NativeWildMeterDropNodeHandoff(tile:tile,stage:stage,capture:capture,sourceParentVisualScale:plan.visualScale,stagePoint:{.init(x:$0.x,y:844-$0.y)},isCurrent:{$0==capture && $1 === tile}))
            XCTAssertTrue(handoff.apply(plan.sample(seconds:1,impactStart:nil,restored:false,wallHandoffPending:false).tile))
            XCTAssertTrue(handoff.apply(plan.sample(seconds:0,impactStart:nil,restored:true,wallHandoffPending:false).tile))
            XCTAssertEqual(tile.xScale,0.4,accuracy:0.000001);XCTAssertEqual(tile.yScale,0.4,accuracy:0.000001)
            handoff.dispose()
        }
    }
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
