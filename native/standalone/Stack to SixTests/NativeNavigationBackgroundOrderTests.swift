import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeNavigationBackgroundOrderTests:XCTestCase {
    func testUpperBackgroundExitsBetweenFirstAndSecondBeatAndRetainsLifecycle() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full motion order fixture")}
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{motion.cancel();window.isHidden=true}
        for width in [CGFloat(390),820] {for continuous in [false,true] {for immediate in [false,true] {
            let header=JimiV9NavigationHeader(frame:CGRect(x:0,y:0,width:width,height:110))
            host.view.addSubview(header);header.layoutIfNeeded()
            header.continuousBackground=continuous;header.fadeBackgroundDuringHandoff=true;header.immediateBackgroundExit=immediate
            let decoration=try XCTUnwrap((header.layer as? JimiV9NavigationRouteLayer)?.decorationLayer)
            motion.animate([(header,JimiV9Motion.journeyNavigationExit())]){}
            let group=try XCTUnwrap(decoration.animation(forKey:"native-route") as? CAAnimationGroup)
            let tracks=try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation})
            let transform=try XCTUnwrap(tracks.first{$0.keyPath=="transform"})
            let opacity=try XCTUnwrap(tracks.first{$0.keyPath=="opacity"})
            let stagger=JimiV9ArchedNavigationTitle.elementStagger
            for track in [transform,opacity] {
                XCTAssertEqual(track.beginTime,0.5*stagger,accuracy:0.000001)
                XCTAssertGreaterThan(track.beginTime,JimiV9ArchedNavigationTitle.contentDelay(index:1,entering:false))
                XCTAssertLessThan(track.beginTime,JimiV9ArchedNavigationTitle.contentDelay(index:2,entering:false))
                XCTAssertEqual(track.duration,JimiV9ArchedNavigationTitle.elementDuration)
                XCTAssertGreaterThanOrEqual(group.duration,track.beginTime+track.duration)
                XCTAssertEqual(track.fillMode,.both)
            }
            XCTAssertEqual(JimiV9ArchedNavigationTitle.contentDelay(index:1,entering:false),0)
            let poses=try XCTUnwrap(transform.values as? [NSValue]).map{$0.caTransform3DValue}
            XCTAssertGreaterThan(try XCTUnwrap(poses.last).m42,try XCTUnwrap(poses.first).m42,"Outgoing upper paper/divider leaves downward")
            XCTAssertEqual(try XCTUnwrap(poses.last).m42-poses[0].m42,14.4*0.7,accuracy:0.000001,"Exit bounce is30percent smaller")
            let alpha=try XCTUnwrap(opacity.values as? [NSNumber])
            XCTAssertEqual(alpha.first?.doubleValue,1);XCTAssertEqual(alpha.last?.doubleValue,0)
            motion.suspend();XCTAssertEqual(header.layer.speed,0)
            motion.resume();XCTAssertEqual(header.layer.speed,1)
            motion.cancel();XCTAssertNil(decoration.animation(forKey:"native-route"))
            header.removeFromSuperview()
        }}}
    }
}
