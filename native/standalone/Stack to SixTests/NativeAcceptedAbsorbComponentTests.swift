import XCTest
import SpriteKit
import UIKit
@testable import Stack_to_Six

/// Component-only SDK packet: no Scene mutation, routing, input, score or RNG.
@MainActor private final class AcceptedAbsorbSDKHost: NativeTileOuterPoseHost {
    let node=SKNode(),shadow=SKNode(),family=SKNode()
    var sourceTileID="same-source",sourceGeneration:UInt64=1,sourceSkipIdleScaleReset=false
    let geometry:CGFloat=0.637
    init(){node.position=CGPoint(x:200,y:100);node.setScale(geometry*1.105);node.zRotation=0.3;shadow.position=CGPoint(x:0,y:-12.8);family.setScale(1.17);family.zRotation=0.21;node.addChild(shadow);node.addChild(family)}
    var sourceLocalPosition:CGPoint{node.position}
    var sourceLocalScale:CGPoint{CGPoint(x:node.xScale/geometry,y:node.yScale/geometry)}
    var sourceRotation:CGFloat{node.zRotation}
    func paintSourceOuter(_ p:NativeTileOuterMotion.Pose){node.position=p.position;paintSourceOuterScale(p.scale);node.zRotation=p.rotation}
    func paintSourceOuterPosition(_ p:CGPoint){node.position=p}
    func paintSourceOuterScale(_ p:CGPoint){node.xScale=geometry*p.x;node.yScale=geometry*p.y}
    func paintSourceIdleRotation(_ r:CGFloat){node.zRotation=r}
    func paintSourceIdle(_ p:NativeRegularIdleMotion.Pose){paintSourceOuterScale(CGPoint(x:p.x,y:p.y));node.zRotation=p.rotation}
}

@MainActor final class NativeAcceptedAbsorbComponentTests: XCTestCase {
    func testActualInjectedV5ClockSameNodeSixOriginalSequentialFramesAndCompletion() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),driver=NativeSourceDragTweenAdapter(service:service),h=AcceptedAbsorbSDKHost(),owner=NativeSourceAcceptedAbsorbOwner(host:h,driver:driver)
        defer{owner.dispose();driver.dispose();service.dispose()}
        var completed=0
        XCTAssertTrue(owner.begin(destination:CGPoint(x:20,y:30),onAutoScaleInitialize:{},isCurrent:{true},onMainCompleted:{completed+=1},onMainInterrupted:{XCTFail("not interrupted")}))
        // Literal pinned original GSAP parent advances, exporter stream rows.
        // Mounted SpriteKit uses Float32 storage; pure Double oracle stays unchanged.
        let rows:[(Double,Double,Double,Double)]=[(5,153.777976,82.024768,1.094708),(10,128.766449,72.298063,1.084516),(20,88.494324,56.636681,1.064818),(40,40.294614,37.89235,1.030754),(60,22.536827,30.986544,1.007993),(80,20,30,1)]
        for (wall,x,y,scale) in rows {
            service.deliver(wallMilliseconds:wall)
            XCTAssertEqual(h.node.position.x,x,accuracy:2e-5);XCTAssertEqual(h.node.position.y,y,accuracy:2e-5);XCTAssertEqual(h.sourceLocalScale.x,scale,accuracy:1e-6)
            XCTAssertTrue(h.shadow.parent === h.node);XCTAssertTrue(h.family.parent === h.node)
            XCTAssertEqual(h.family.xScale,CGFloat(Float(1.17)));XCTAssertEqual(h.family.zRotation,CGFloat(Float(0.21)));XCTAssertEqual(h.shadow.position,CGPoint(x:0,y:CGFloat(Float(-12.8))));XCTAssertEqual(h.node.zRotation,CGFloat(Float(0.3)))
        }
        XCTAssertEqual(completed,1);XCTAssertFalse(owner.hasActiveRoots);XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testGlobalPauseRetainsActualLazyRootsAndResumeCompletesWithoutManufacturedArrival() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),driver=NativeSourceDragTweenAdapter(service:service),h=AcceptedAbsorbSDKHost(),owner=NativeSourceAcceptedAbsorbOwner(host:h,driver:driver)
        defer{owner.dispose();driver.dispose();service.dispose()};var completed=0
        _=owner.begin(destination:.zero,onAutoScaleInitialize:{},isCurrent:{true},onMainCompleted:{completed+=1},onMainInterrupted:{XCTFail("pause is not destruction")})
        service.deliver(wallMilliseconds:16);let position=h.node.position,scale=h.sourceLocalScale
        service.setSourceGlobalPaused(true);service.deliver(wallMilliseconds:200);service.deliver(wallMilliseconds:400)
        XCTAssertEqual(h.node.position,position);XCTAssertEqual(h.sourceLocalScale,scale);XCTAssertEqual(completed,0);XCTAssertEqual(service.activeParticipantCount,3)
        service.setSourceGlobalPaused(false)
        for wall in stride(from:416.0,through:512,by:16){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(completed,1);XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testSelectiveScaleRemovalRetainsActualIdleRotationSmokeAndOnce350Cleanup() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),driver=NativeSourceOuterTimelineAdapter(service:service),h=AcceptedAbsorbSDKHost(),bridge=NativeTileOuterNodeBridge(host:h,driver:driver)
        defer{bridge.dispose();driver.dispose();service.dispose()};var release=0,smoke=0
        XCTAssertTrue(bridge.idle(.init(variantDraw:0,directionDraw:1,tiltDraw:0.5),releaseSourceFrames:{release+=1},onSmoke:{smoke+=1},onFinished:{}))
        service.deliver(wallMilliseconds:50)
        XCTAssertTrue(bridge.mergeImpact(.init(variantDraw:0.5,variationDraw:0.5)))
        XCTAssertTrue(bridge.activeIdle);XCTAssertTrue(bridge.owners.mergeImpact)
        service.deliver(wallMilliseconds:100)
        XCTAssertNotEqual(h.node.zRotation,0);XCTAssertEqual(h.family.zRotation,CGFloat(Float(0.21)))
        service.deliver(wallMilliseconds:230);XCTAssertEqual(smoke,1)
        service.deliver(wallMilliseconds:349);XCTAssertTrue(bridge.activeIdle);XCTAssertEqual(release,0)
        service.deliver(wallMilliseconds:350);XCTAssertFalse(bridge.activeIdle);XCTAssertEqual(release,1);XCTAssertTrue(bridge.owners.mergeImpact)
        service.deliver(wallMilliseconds:515);XCTAssertFalse(bridge.owners.mergeImpact);XCTAssertEqual(release,1);XCTAssertEqual(h.sourceLocalScale.x,1,accuracy:1e-6)
    }
    func testActualDestructiveCancellationRetiresOldMainBeforeReentrantNewOwner() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),driver=NativeSourceDragTweenAdapter(service:service),h=AcceptedAbsorbSDKHost(),owner=NativeSourceAcceptedAbsorbOwner(host:h,driver:driver)
        defer{owner.dispose();driver.dispose();service.dispose()};var interrupted=0
        _=owner.begin(destination:.zero,onAutoScaleInitialize:{},isCurrent:{h.sourceGeneration==1},onMainCompleted:{XCTFail("no fake arrival")},onMainInterrupted:{interrupted+=1;h.sourceGeneration=2;h.node.position=CGPoint(x:400,y:500)})
        service.deliver(wallMilliseconds:16);owner.cancelAll();owner.cancelAll();service.deliver(wallMilliseconds:80)
        XCTAssertEqual(interrupted,1);XCTAssertEqual(h.node.position,CGPoint(x:400,y:500));XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testLazyAdapterDestructionRejectsActualReentrantRegistration() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),driver=NativeSourceDragTweenAdapter(service:service)
        defer{driver.dispose();service.dispose()}
        let old=NativeDragTweenReceipt(id:UUID(),tileID:"old",generation:1),new=NativeDragTweenReceipt(id:UUID(),tileID:"new",generation:2)
        var cleaned=0,rejected=false
        XCTAssertTrue(driver.start(receipt:old,duration:0.08,paint:{_ in},finished:{success in
            XCTAssertFalse(success);cleaned+=1
            rejected = !driver.start(receipt:new,duration:0.08,paint:{_ in XCTFail("disposed driver paint")},finished:{_ in XCTFail("rejected replacement cannot finish")})
            driver.dispose()
        }))
        driver.dispose();driver.dispose();service.deliver(wallMilliseconds:80)
        XCTAssertTrue(rejected);XCTAssertEqual(cleaned,1);XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testTimelineAdapterDestructionRejectsActualReentrantRegistration() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),driver=NativeSourceOuterTimelineAdapter(service:service)
        defer{driver.dispose();service.dispose()}
        let old=NativeTileOuterReceipt(id:UUID(),tileID:"old",generation:1,kind:.idle),new=NativeTileOuterReceipt(id:UUID(),tileID:"new",generation:2,kind:.pickupScale)
        var cleaned=0,rejected=false
        XCTAssertTrue(driver.start(receipt:old,duration:0.52,paint:{_ in},completed:{XCTFail("no forced completion")},interrupted:{
            cleaned+=1
            rejected = !driver.start(receipt:new,duration:0.13,paint:{_ in XCTFail("disposed driver paint")},completed:{XCTFail("dead replacement")},interrupted:{XCTFail("rejected owner callback")})
            driver.dispose()
        }))
        driver.dispose();driver.dispose();service.deliver(wallMilliseconds:520)
        XCTAssertTrue(rejected);XCTAssertEqual(cleaned,1);XCTAssertEqual(service.activeParticipantCount,0)
    }

}
