import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialFocusMountedTests:XCTestCase {
    @MainActor private final class Clock {var now=0.0}
    @MainActor private final class NodeFixture {
        let clock=Clock(),service:NativeSourceAnimationClockService,driver:NativeSourceOuterTimelineAdapter,parent=SKNode(),node:NativeDiceNode
        var draws=0,owner:NativeSourceTutorialFocusOwner?
        init()throws {
            let clock=clock
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{clock.now},sourceFrameTransportEnabled:true)
            driver=NativeSourceOuterTimelineAdapter(service:service)
            node=NativeDiceNode(id:"ordinary",value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:NativeBoardTextures(root:NativeTestResources.root))
            parent.addChild(node)
            XCTAssertTrue(node.prepareSourceInitialHolder(rotation:0.04,generation:1))
            node.installSourceOuterDriver(driver,generation:1,geometryScale:0.5)
            XCTAssertTrue(node.forceSourceTutorialInitialValue(3))
        }
        func deliver(_ ms:Double){clock.now=ms;service.deliver(wallMilliseconds:ms)}
        func dispose(){owner?.dispose();owner=nil;node.dispose();driver.dispose();service.dispose()}
    }
    func testLiteralSquarePipsAndNormalizationPreserveTiltBackingAndNativeGeometry()throws {
        let f=try NodeFixture();defer{f.dispose()};let backing=f.node.sourcePaintedNumbersTexture
        f.node.paintSourceOuterScale(.init(x:0.73,y:1.25));f.node.visual.setScale(0.8);f.node.sourceStackDepth=4
        XCTAssertTrue(f.node.normalizeSourceTutorialInitialTile())
        XCTAssertEqual(f.node.sourceStackDepth,1);XCTAssertEqual(f.node.xScale,0.5,accuracy:1e-6);XCTAssertEqual(f.node.visual.xScale,1,accuracy:1e-6)
        XCTAssertEqual(f.node.dragInnerTilt,0.04,accuracy:2e-5);XCTAssertTrue(f.node.sourcePaintedNumbersTexture === backing)
        let map=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
        for value in 1...6 {
            XCTAssertTrue(f.node.forceSourceTutorialInitialValue(value));let indices=try XCTUnwrap(map[value]);XCTAssertEqual(f.node.sourcePipNodes.count,indices.count)
            for (pip,index) in zip(f.node.sourcePipNodes,indices) {
                let shape=try XCTUnwrap(pip as? SKShapeNode),rect=try XCTUnwrap(shape.path).boundingBoxOfPath
                XCTAssertEqual(rect.midX,Double(index%3-1)*26.88,accuracy:2e-5);XCTAssertEqual(rect.midY,-Double(index/3-1)*26.88,accuracy:2e-5)
                XCTAssertEqual(rect.width,15,accuracy:2e-5);XCTAssertEqual(rect.height,15,accuracy:2e-5)
                var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0;shape.fillColor.getRed(&r,green:&g,blue:&b,alpha:&a)
                XCTAssertEqual(r,143.0/255,accuracy:1e-6);XCTAssertEqual(g,106.0/255,accuracy:1e-6);XCTAssertEqual(b,85.0/255,accuracy:1e-6);XCTAssertEqual(a,0.96,accuracy:1e-6)
            }
        }
    }
    func testFocusUsesActualLazyRootTwoMathDrawsAndZeroFocusedDraws()throws {
        let f=try NodeFixture();defer{f.dispose()};f.node.alpha=0.25
        let owner=NativeSourceTutorialFocusOwner(service:f.service,random:{f.draws+=1;return f.draws==1 ? 0.25:0.5},current:{true});f.owner=owner
        XCTAssertTrue(owner.focus(f.node,focused:false));XCTAssertEqual(f.draws,2);XCTAssertEqual(f.node.alpha,0.25);XCTAssertEqual(f.node.sourceEventMode,"none")
        for time in stride(from:16.0,through:800,by:16){f.deliver(time)}
        XCTAssertEqual(f.node.alpha,0.2,accuracy:1e-6);XCTAssertEqual(owner.activeRootCount,0)
        XCTAssertTrue(owner.focus(f.node,focused:true));XCTAssertEqual(f.draws,2);XCTAssertEqual(f.node.sourceEventMode,"static")
        for time in stride(from:816.0,through:1200,by:16){f.deliver(time)}
        XCTAssertEqual(f.node.alpha,1,accuracy:1e-6);XCTAssertEqual(owner.activeRootCount,0)
    }
    func testForegroundGlobalPauseKeepsFocusPendingWhileRawRAFContinuesAndBackgroundFreezesBoth()throws {
        let f=try NodeFixture();defer{f.dispose()};f.node.alpha=0.25
        let owner=NativeSourceTutorialFocusOwner(service:f.service,random:{0.5},current:{true});f.owner=owner
        XCTAssertTrue(owner.focus(f.node,focused:true));f.service.setSourceGlobalPaused(true)
        var raw=0;let frame=try XCTUnwrap(f.service.requestSourceAnimationFrame(ownerID:"test-raw",generation:1,callback:{raw+=1}))
        f.service.setSourceForeground(false);f.deliver(400);XCTAssertEqual(raw,0);XCTAssertEqual(f.node.alpha,0.25)
        f.service.setSourceForeground(true);f.deliver(416);XCTAssertEqual(raw,1);XCTAssertFalse(frame.active);XCTAssertEqual(f.node.alpha,0.25);XCTAssertEqual(owner.activeRootCount,1)
        f.service.setSourceGlobalPaused(false)
        for time in stride(from:432.0,through:800,by:16){f.deliver(time)}
        XCTAssertEqual(f.node.alpha,1,accuracy:1e-6);XCTAssertEqual(owner.activeRootCount,0)
    }
    func testRealPointerScaleOwnerRefusesInitialNormalizationWithoutKillingPickup()throws {
        let f=try NodeFixture();defer{f.dispose()};XCTAssertTrue(f.node.beginSourcePickup());XCTAssertTrue(f.node.sourceOuterOwners.pickupScale)
        let owner=NativeSourceTutorialFocusOwner(service:f.service,random:{f.draws+=1;return 0.5},current:{true});f.owner=owner
        XCTAssertFalse(owner.focus(f.node,focused:false));XCTAssertEqual(f.draws,0);XCTAssertTrue(f.node.sourceOuterOwners.pickupScale)
        XCTAssertEqual(owner.activeRootCount,0)
    }
    func testReentrantCurrentDisposeCannotNormalizeDrawOrInstall()throws {
        let f=try NodeFixture();defer{f.dispose()};f.node.paintSourceOuterScale(.init(x:0.73,y:1.25));var calls=0
        let owner=NativeSourceTutorialFocusOwner(service:f.service,random:{f.draws+=1;return 0.5},current:{calls+=1;f.owner?.dispose();return true});f.owner=owner
        XCTAssertFalse(owner.focus(f.node,focused:false));XCTAssertEqual(calls,1);XCTAssertEqual(f.draws,0);XCTAssertEqual(f.node.sourceLocalScale.x,0.73,accuracy:1e-6);XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testSameNodeReentryDuringMathCannotRemoveOrPaintReplacementFocusRoot()throws {
        let f=try NodeFixture();defer{f.dispose()};f.node.alpha=0.25
        let owner=NativeSourceTutorialFocusOwner(service:f.service,random:{f.draws+=1;if f.draws==1{XCTAssertTrue(f.owner?.focus(f.node,focused:true)==true)};return 0.5},current:{true});f.owner=owner
        XCTAssertFalse(owner.focus(f.node,focused:false));XCTAssertEqual(f.draws,1);XCTAssertEqual(owner.activeRootCount,1);XCTAssertEqual(f.node.sourceEventMode,"static")
        for time in stride(from:16.0,through:400,by:16){f.deliver(time)}
        XCTAssertEqual(f.node.alpha,1,accuracy:1e-6);XCTAssertEqual(owner.activeRootCount,0)
    }
}
