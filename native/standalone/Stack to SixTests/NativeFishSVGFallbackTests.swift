import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeFishSVGFallbackTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private struct Fixture:Decodable {
        struct Sample:Decodable {let requested,time:Double,frame:Int,matrix:[Double]}
        let width,height:Int,samples:[Sample]
    }
    private func frame(dragging:Bool=false,phase:Bool=true)->NativeFishIdleFrame {
        NativeFishIdleFrame.project(center:CGPoint(x:140,y:500),horizontalUnit:CGPoint(x:140.4,y:500),verticalUnit:CGPoint(x:140,y:499.4),sceneHeight:844,alpha:0.8,dragging:dragging,phaseStarted:phase,visible:true,bubbles:[])
    }
    func testOriginalEmbeddedWebPAndSMILMatchActualBrowserThroughAll72Frames() throws {
        let gold=try JSONDecoder().decode(Fixture.self,from:Data(NativeFishSVGSourceOracle.json.utf8))
        let resources=try NativeFishSVGFallbackResources.load(resourceRoot:root)
        XCTAssertEqual(gold.samples.count,179);XCTAssertEqual(gold.width,16128);XCTAssertEqual(gold.height,224)
        XCTAssertEqual(resources.frames.count,72);XCTAssertEqual(resources.duration,1.125)
        let view=NativeFishSVGFallbackView(resources:resources),scale:CGFloat=128.0/224
        defer {view.dispose()}
        for sample in gold.samples {
            view.paint(seconds:sample.time)
            XCTAssertEqual(view.currentFrame,sample.frame)
            let nativeImage=try XCTUnwrap(view.layer.sublayers?.first)
            XCTAssertEqual(nativeImage.bounds,CGRect(x:0,y:0,width:128,height:128))
            // Executed original-browser samples: NativeFishSVGSourceOracle.swift.
            // Original WebP coordinates are224px; CALayer has already resized
            // them to128px. Linear transform coefficients are dimensionless.
            // Independent original-SVG reprojection measured maximum2.01e-7
            // coefficient error,8.40e-6px translation error and2.32e-5px corner
            // error from browser Float32 SMIL at3600.1298828125seconds.
            let matrix=view.currentTransform
            for (actual,expected) in zip([matrix.a,matrix.b,matrix.c,matrix.d],sample.matrix.prefix(4)) {
                XCTAssertEqual(actual,expected,accuracy:1e-6)
            }
            XCTAssertEqual(matrix.tx,sample.matrix[4]*scale,accuracy:2e-5)
            XCTAssertEqual(matrix.ty,sample.matrix[5]*scale,accuracy:2e-5)
            for original in [CGPoint.zero,CGPoint(x:224,y:0),CGPoint(x:0,y:224),CGPoint(x:224,y:224)] {
                let actual=CGPoint(x:original.x*scale,y:original.y*scale).applying(view.currentTransform)
                let source=sample.matrix
                let expected=CGPoint(x:(source[0]*original.x+source[2]*original.y+source[4])*scale,
                                     y:(source[1]*original.x+source[3]*original.y+source[5])*scale)
                XCTAssertEqual(actual.x,expected.x,accuracy:3e-5)
                XCTAssertEqual(actual.y,expected.y,accuracy:3e-5)
            }
            XCTAssertEqual(resources.frames[sample.frame].width,224);XCTAssertEqual(resources.frames[sample.frame].height,224)
        }
        XCTAssertEqual(Set(gold.samples.map(\.frame)).count,72)
        view.dispose();XCTAssertNil(view.currentFrame)
    }
    func testSelectedResourceLeaseSharesOneOriginalDecodeAndCancelsStaleSuspendedRequests() async throws {
        let lease=NativeFishSVGResourceLease(resourceRoot:root)
        defer {lease.dispose()}
        lease.setSuspended(true)
        var stale=0
        let cancelled=try XCTUnwrap(lease.request {_ in stale+=1})
        XCTAssertEqual(lease.pendingRequestCount,1);XCTAssertEqual(lease.decodedFrameCount,0)
        lease.cancel(cancelled);lease.setSuspended(false)
        XCTAssertEqual(lease.pendingRequestCount,0);XCTAssertEqual(stale,0)
        let ready=expectation(description:"Two selected owners share exactly one immutable originalstrip");ready.expectedFulfillmentCount=2
        var frames:[CGImage]=[]
        for _ in 0..<2 {lease.request {resource in XCTAssertNotNil(resource);if let resource {frames.append(resource.frames[0])};ready.fulfill()}}
        await fulfillment(of:[ready],timeout:5)
        XCTAssertEqual(lease.decodedFrameCount,72);XCTAssertEqual(frames.count,2);if frames.count==2 {XCTAssertTrue(frames[0] === frames[1])};XCTAssertEqual(lease.pendingRequestCount,0)
        lease.dispose();XCTAssertEqual(lease.decodedFrameCount,0);XCTAssertEqual(stale,0)
    }
    func testOriginalFallbackMirrorsNativePoseWithoutVideoAndRetiresItsGenerationOnDragBackgroundRestart() async throws {
        let policy=NativeFishMediaPolicy();policy.recordVideoSourceError()
        let host=NativeFishIdleOwner(resourceRoot:root,mediaPolicy:policy)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController()
        window.rootViewController=controller;window.makeKeyAndVisible();controller.view.addSubview(host);host.frame=window.bounds
        defer {host.dispose();window.isHidden=true}
        let ready=expectation(description:"OriginalSVG fallback becomes source-ready")
        host.onPrepared={id,generation in XCTAssertEqual(id,"f");XCTAssertEqual(generation,1);host.paint(["f":self.frame()],generation:1,force:true)}
        var becameReady=false
        host.onMediaReady={_,_,isReady in if isReady,!becameReady {becameReady=true;ready.fulfill()}}
        host.paint(["f":frame(phase:false)],generation:1,force:true)
        await fulfillment(of:[ready],timeout:5)
        let owner=try XCTUnwrap(host.presentation(tileID:"f"))
        XCTAssertTrue(owner.mediaReady);XCTAssertTrue(owner.usesOriginalSVGFallback);XCTAssertFalse(owner.isHidden)
        XCTAssertEqual(owner.playbackRate,0);XCTAssertEqual(owner.retainedItemCount,0);XCTAssertEqual(host.selectedSVGFrameCount,72)
        host.paint(["f":frame(dragging:true)],generation:1,force:true);XCTAssertTrue(owner.isHidden)
        host.paint(["f":frame()],generation:1,force:true);XCTAssertFalse(owner.isHidden)
        // Paint from the accepted board clock before suspension. Foreground
        // must preserve that receipt until the next native board paint, rather
        // than inventing time0 when the pose-throttle timestamp was cleared.
        let acceptedTime=CACurrentMediaTime()+0.4
        host.paint(["f":frame()],generation:1,force:true,now:acceptedTime)
        let acceptedSVGFrame=try XCTUnwrap(owner.originalSVGFrame)
        XCTAssertGreaterThan(acceptedSVGFrame,0)
        host.setSuspended(true);XCTAssertTrue(owner.isHidden)
        host.setSuspended(false);XCTAssertFalse(owner.isHidden)
        XCTAssertEqual(owner.originalSVGFrame,acceptedSVGFrame)
        host.paint(["f":frame()],generation:1,force:true,now:acceptedTime+0.1)
        XCTAssertGreaterThan(try XCTUnwrap(owner.originalSVGFrame),acceptedSVGFrame)
        host.paint([:],generation:2,force:true);XCTAssertEqual(host.activeMediaCount,0);XCTAssertFalse(owner.mediaReady)
        host.dispose();XCTAssertEqual(host.selectedSVGFrameCount,0)
    }
    func testRetiredSuspendedFallbackCannotDecodeOrFinishIntoTheNextGeneration() async throws {
        let policy=NativeFishMediaPolicy();policy.recordVideoSourceError()
        let host=NativeFishIdleOwner(resourceRoot:root,mediaPolicy:policy)
        host.setSuspended(true)
        var ready=0;host.onMediaReady={_,_,success in if success {ready+=1}}
        host.paint(["f":frame()],generation:1,force:true)
        XCTAssertEqual(host.pendingSVGRequests,1);XCTAssertEqual(host.selectedSVGFrameCount,0)
        host.paint([:],generation:2,force:true);XCTAssertEqual(host.pendingSVGRequests,0)
        host.setSuspended(false);host.dispose()
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(ready,0);XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(host.selectedSVGFrameCount,0)
    }
}
