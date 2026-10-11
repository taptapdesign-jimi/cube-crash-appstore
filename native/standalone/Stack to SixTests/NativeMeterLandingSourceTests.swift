import XCTest
import SpriteKit
@testable import Stack_to_Six

nonisolated final class NativeMeterLandingSourceTests:XCTestCase {
    @MainActor private final class Wall{var value=0.0}
    @MainActor func testActualSourceUnionImmediateGroupedLandingHasNoInventedActivityAndRetiresCapturedResources()throws {
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value})
        var seed:UInt32=127,draws=0,sounds=0,current=true
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{seed=seed &* 1664525 &+ 1013904223;draws+=1;return Double(seed)/4294967296})
        let renderer=session.makeRenderer(service:service),canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        var pose=NativeMeterLandingShakeGraph.Pose(canvas:[-1.3,2.8],indicator:[-0.7,1.1],decor:[-0.4,0.5])
        let capture=NativeWildMeterDropRuntime.Capture(id:"actual-contact",generation:1,epoch:3)
        let owner=NativeMeterLandingSourceOwner(service:service,renderer:renderer,session:session,hooks:.init(current:{current},impactCurrent:{$0==capture},readShake:{pose},paintShake:{pose=$0},sound:{sounds+=1},reduced:{false},monotonicMilliseconds:{1000},fault:{XCTFail($0)}))
        defer{current=false;owner.dispose();renderer.dispose();service.dispose()}
        XCTAssertTrue(owner.impact(capture,origin:.init(canvas:canvas,sourceTile:tile,point:.init(x:164,y:244),renderScale:0.4,depth:7)))
        XCTAssertEqual(sounds,1);XCTAssertGreaterThan(draws,36);XCTAssertGreaterThan(session.pool.activeCount,0)
        XCTAssertFalse(owner.impact(capture,origin:.init(canvas:canvas,sourceTile:tile,point:.zero,renderScale:1,depth:7)))
        wall.value=100;service.deliver(wallMilliseconds:100);let frozen=pose
        service.setSourceGlobalPaused(true);wall.value=300;service.deliver(wallMilliseconds:300);XCTAssertEqual(pose,frozen)
        service.setSourceGlobalPaused(false)
        for time in stride(from:316.0,through:1700.0,by:16){wall.value=time;service.deliver(wallMilliseconds:time)}
        XCTAssertEqual(pose,.init(canvas:[0,0],indicator:[0,0],decor:[0,0]));XCTAssertEqual(renderer.activeOwnerCount,0);XCTAssertEqual(session.pool.activeCount,0)
        XCTAssertEqual(service.activeParticipantCount,0)
    }
    @MainActor func testSoundReentrantRetirementCreatesNoClockSmokeOrRandom()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var draws=0
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{draws+=1;return 0.5}),canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        let renderer=session.makeRenderer(service:service);var owner:NativeMeterLandingSourceOwner!
        owner=NativeMeterLandingSourceOwner(service:service,renderer:renderer,session:session,hooks:.init(current:{true},impactCurrent:{_ in true},readShake:{.init(canvas:[0,0],indicator:[0,0],decor:[0,0])},paintShake:{_ in XCTFail("retired paint")},sound:{owner.dispose()},reduced:{false},monotonicMilliseconds:{1000},fault:{XCTFail($0)}))
        defer{owner.dispose();renderer.dispose();service.dispose()}
        XCTAssertFalse(owner.impact(.init(id:"retired",generation:1,epoch:1),origin:.init(canvas:canvas,sourceTile:tile,point:.zero,renderScale:1,depth:7)))
        XCTAssertEqual(draws,0);XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(session.pool.activeCount,0)
    }
    @MainActor func testRandomReentrantRetirementCannotContinueDrawsRegisterSmokeOrResetNewPaint()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var owner:NativeMeterLandingSourceOwner!,draws=0,paints=0
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{draws+=1;if draws==4{owner.dispose()};return 0.5}),canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        let renderer=session.makeRenderer(service:service)
        owner=NativeMeterLandingSourceOwner(service:service,renderer:renderer,session:session,hooks:.init(current:{true},impactCurrent:{_ in true},readShake:{.init(canvas:[0,0],indicator:[0,0],decor:[0,0])},paintShake:{_ in paints+=1},sound:{},reduced:{false},monotonicMilliseconds:{1000},fault:{XCTFail($0)}))
        defer{owner.dispose();renderer.dispose();service.dispose()}
        XCTAssertFalse(owner.impact(.init(id:"random-retired",generation:1,epoch:1),origin:.init(canvas:canvas,sourceTile:tile,point:.zero,renderScale:1,depth:7)))
        XCTAssertEqual(draws,4);XCTAssertEqual(paints,0);XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(session.pool.activeCount,0)
    }
    @MainActor func testReplacementDuringAdmissionCallbacksPreservesOnlyAcceptedC()throws {
        // Same object, generation and actual service/session: C replaces A from
        // an external callback BEFORE A can publish, cancel, or draw again.
        for boundary in ["impactCurrent","sound","readShake","reduced","monotonic"] {
            let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value})
            var draws=0,sounds=0,reentered=false,cAccepted=false
            let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{draws+=1;return 0.5})
            let renderer=session.makeRenderer(service:service),canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
            let a=NativeWildMeterDropRuntime.Capture(id:"A",generation:1,epoch:1),c=NativeWildMeterDropRuntime.Capture(id:"C",generation:1,epoch:2)
            let origin=NativeMeterLandingSourceOwner.Origin(canvas:canvas,sourceTile:tile,point:.init(x:160,y:240),renderScale:0.4,depth:7)
            var pose=NativeMeterLandingShakeGraph.Pose(canvas:[1,2],indicator:[0.8,1.6],decor:[0.8,1.6])
            var owner:NativeMeterLandingSourceOwner!
            func replace(_ name:String){guard boundary==name,!reentered else{return};reentered=true;cAccepted=owner.impact(c,origin:origin)}
            owner=NativeMeterLandingSourceOwner(service:service,renderer:renderer,session:session,hooks:.init(current:{true},impactCurrent:{_ in replace("impactCurrent");return true},readShake:{replace("readShake");return pose},paintShake:{pose=$0},sound:{sounds+=1;replace("sound")},reduced:{replace("reduced");return false},monotonicMilliseconds:{replace("monotonic");return 1000},fault:{XCTFail($0)}))
            XCTAssertFalse(owner.impact(a,origin:origin),boundary);XCTAssertTrue(cAccepted,boundary)
            XCTAssertEqual(renderer.activeOwnerCount,1,boundary)
            // C owns both the visible shake root and actual smoke. Retired A
            // neither erases C nor appends a second smoke emission.
            let poolAtC=session.pool.activeCount;XCTAssertGreaterThan(poolAtC,0,boundary)
            let drawsBeforeFrame=draws
            wall.value=100;service.deliver(wallMilliseconds:100)
            XCTAssertNotEqual(pose,.init(canvas:[1,2],indicator:[0.8,1.6],decor:[0.8,1.6]),boundary)
            XCTAssertEqual(draws,drawsBeforeFrame,boundary)
            for time in stride(from:116.0,through:1600.0,by:16){wall.value=time;service.deliver(wallMilliseconds:time)}
            XCTAssertEqual(pose,.init(canvas:[0,0],indicator:[0,0],decor:[0,0]),boundary)
            XCTAssertEqual(renderer.activeOwnerCount,0,boundary);XCTAssertEqual(session.pool.activeCount,0,boundary)
            XCTAssertEqual(service.activeParticipantCount,0,boundary)
            XCTAssertEqual(sounds,boundary=="impactCurrent" ? 1:2,boundary)
            owner.dispose();renderer.dispose();service.dispose()
        }
    }
    @MainActor func testRejectedLaterImpactDoesNotInvalidateAcceptedRunningShake()throws {
        let wall=Wall(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall.value})
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{0.5}),renderer=session.makeRenderer(service:service)
        let canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        var pose=NativeMeterLandingShakeGraph.Pose(canvas:[1,2],indicator:[1,2],decor:[1,2])
        let owner=NativeMeterLandingSourceOwner(service:service,renderer:renderer,session:session,hooks:.init(current:{true},impactCurrent:{$0.id=="C"},readShake:{pose},paintShake:{pose=$0},sound:{},reduced:{false},monotonicMilliseconds:{1000},fault:{XCTFail($0)}))
        defer{owner.dispose();renderer.dispose();service.dispose()}
        let origin=NativeMeterLandingSourceOwner.Origin(canvas:canvas,sourceTile:tile,point:.zero,renderScale:1,depth:7)
        XCTAssertTrue(owner.impact(.init(id:"C",generation:1,epoch:1),origin:origin))
        XCTAssertFalse(owner.impact(.init(id:"invalid-D",generation:1,epoch:2),origin:origin))
        wall.value=100;service.deliver(wallMilliseconds:100)
        XCTAssertNotEqual(pose,.init(canvas:[1,2],indicator:[1,2],decor:[1,2]))
        wall.value=500;service.deliver(wallMilliseconds:500)
        XCTAssertEqual(pose,.init(canvas:[0,0],indicator:[0,0],decor:[0,0]))
    }
}
