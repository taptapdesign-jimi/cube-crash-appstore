import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeStarHaloRenderCadenceTests:XCTestCase {
    private func halo(_ service:NativeSourceAnimationClockService,generation:UInt64=1)throws->NativeSourceStarHaloPresentation {
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:1,textureWidth:56,introBounce:false,performanceNow:{0},random:{0.25}))
        return try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:nil,introBounce:false,performanceMilliseconds:0,
            service:service,generation:generation,current:{true},paintable:{true},metrics:{.init(width:128,height:128)}))
    }
    func testActualSharedHaloRegistryKeepsOneSixtyHzRenderLeaseUntilLastRetirement()throws {
        var wall=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true)
        let runtime=NativeSourceFrameRuntime();runtime.attach(rendererID:1,nowMs:0,configuredFPS:60)
        runtime.registerPopulation(["ordinary-special"]);XCTAssertEqual(runtime.snapshot.maxFPS,30)
        var acquisitions=0
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{wall},beginRendering:{
            acquisitions+=1;let receipt=runtime.begin(.init(kind:.starHalo,generation:1,id:"shared"));return{runtime.end(receipt)}
        })
        let stage=SKNode(),first=try halo(service),second=try halo(service)
        defer{first.dispose();second.dispose();ticker.dispose();service.dispose();runtime.stop()}
        stage.addChild(first);stage.addChild(second)
        XCTAssertTrue(first.start(ticker:ticker));XCTAssertTrue(second.start(ticker:ticker))
        XCTAssertEqual(acquisitions,1);XCTAssertEqual(runtime.snapshot.activityLeaseCount,1);XCTAssertEqual(runtime.snapshot.maxFPS,60)
        wall=1000;runtime.frame(nowMs:wall,configuredFPS:60);service.deliver(wallMilliseconds:wall)
        XCTAssertEqual(runtime.snapshot.maxFPS,60,"A settled population must not throttle the admitted shared halo to30Hz")
        let hidden=NativeBoardFrameCadenceDelivery.decide(runtime.snapshot,foreground:false)
        XCTAssertTrue(hidden.isPaused,"Halo cadence cannot resume a hidden/background renderer")
        first.dispose();XCTAssertEqual(runtime.snapshot.activityLeaseCount,1);XCTAssertEqual(runtime.snapshot.maxFPS,60)
        second.dispose();XCTAssertEqual(runtime.snapshot.activityLeaseCount,0);XCTAssertEqual(runtime.snapshot.maxFPS,30)
        XCTAssertEqual(ticker.count,0)
        runtime.registerPopulation([]);XCTAssertEqual(runtime.snapshot.maxFPS,15)
    }
    func testOldScopeRetirementCannotReleaseReplacementHaloCadenceOrExtendItsTail()throws {
        var wall=0.0,current=true
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true)
        let runtime=NativeSourceFrameRuntime();runtime.attach(rendererID:1,nowMs:0,configuredFPS:60)
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{current},performanceNow:{wall},beginRendering:{
            let receipt=runtime.begin(.init(kind:.starHalo,generation:1,id:"shared"));return{runtime.end(receipt)}
        })
        let stage=SKNode(),node=try halo(service);stage.addChild(node);XCTAssertTrue(node.start(ticker:ticker))
        runtime.stop();runtime.attach(rendererID:2,nowMs:500,configuredFPS:60)
        let replacement=runtime.begin(.init(kind:.starHalo,generation:2,id:"shared"))
        current=false;wall=500;service.deliver(wallMilliseconds:wall)
        XCTAssertTrue(node.isDisposed);XCTAssertEqual(ticker.count,0)
        XCTAssertEqual(runtime.snapshot.activityLeaseCount,1);XCTAssertEqual(runtime.snapshot.maxFPS,60)
        runtime.end(replacement);XCTAssertEqual(runtime.snapshot.activityLeaseCount,0);XCTAssertEqual(runtime.snapshot.maxFPS,15)
        ticker.dispose();service.dispose();runtime.stop()
    }
}
