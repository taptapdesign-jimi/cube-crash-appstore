import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeHoneyPresentationTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testHoneyRoutesMatchExecutedOriginalSourceAndBalancedArtwork() throws {
        let plans = NativeHoneyFinaleMotion.make(viewport: CGSize(width: 390,height: 844),random: { 0.5 })
        XCTAssertEqual(plans.map(\.assetIndex),[1,3,2,7,3,5,4,2,5,4,6,6,7,1,1,2])
        let first = try XCTUnwrap(plans.first)
        XCTAssertEqual(first.birth,CGPoint(x: 239,y: 466)); XCTAssertEqual(first.size,66.5)
        XCTAssertEqual(first.delay,0.004,accuracy: 0.000001); XCTAssertEqual(first.enter,0.1475,accuracy: 0.000001)
        XCTAssertEqual(first.buzzA,7.25); XCTAssertEqual(first.buzzB,-7.25)
        XCTAssertEqual(first.waypoints[1].point.x,45.05787591328681,accuracy: 0.000001)
        XCTAssertEqual(first.waypoints[1].point.y,35.607875913286804,accuracy: 0.000001)
        XCTAssertEqual(first.waypoints[5].point.x,171.17386642713328,accuracy: 0.000001)
        XCTAssertEqual(first.outside.x,241.12460741570436,accuracy: 0.000001)
        XCTAssertEqual(plans.last?.delay ?? 0,0.742,accuracy: 0.000001)
        XCTAssertTrue(plans.allSatisfy { $0.end < 3.16 })
        XCTAssertEqual(first.sample(seconds: first.end).alpha,0)
    }
    func testHoneySpacingPreservesExecutedSourceEightPassOrderAndNextTickDamping() {
        let plans = Array(NativeHoneyFinaleMotion.make(viewport: CGSize(width: 390,height: 844),random: { 0.5 }).prefix(2))
        let poses = Array(repeating: NativeHoneyFinaleMotion.Pose(point: CGPoint(x: 200,y: 400),scale: 1,alpha: 1,rotation: 0),count: 2)
        var offsets = Array(repeating: CGPoint.zero,count: 2)
        NativeHoneyFinaleMotion.relax(plans: plans,poses: poses,offsets: &offsets)
        XCTAssertEqual((offsets[0].x*100).rounded()/100,-40.76); XCTAssertEqual((offsets[0].y*100).rounded()/100,-35.04)
        XCTAssertEqual((offsets[1].x*100).rounded()/100,40.76); XCTAssertEqual((offsets[1].y*100).rounded()/100,35.04)
        NativeHoneyFinaleMotion.relax(plans: plans,poses: poses,offsets: &offsets)
        XCTAssertEqual((offsets[0].x*100).rounded()/100,-40.42); XCTAssertEqual((offsets[0].y*100).rounded()/100,-34.74)
    }
    func testHoneyFiniteClockKeepsPostCueAndOneCleanupReceipt() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeHoneyFinalePresentation(resourceRoot: root,viewport: window.bounds.size,random: { 0.5 })
        controller.view.addSubview(owner)
        defer { owner.dispose(); window.isHidden = true }
        var cues = 0,finishes = 0
        let finished = expectation(description: "All eight Honey pairs and glyphs finish before bounded source cleanup")
        owner.onCue = { cue,_ in XCTAssertEqual(cue,"post"); cues += 1 }
        owner.onFinished = { success in XCTAssertTrue(success); finishes += 1; finished.fulfill() }
        owner.start(); owner.start()
        XCTAssertEqual(cues,1)
        XCTAssertEqual(owner.subviews.compactMap { $0 as? UIImageView }.count,16)
        await fulfillment(of: [finished],timeout: 6)
        owner.dispose(); XCTAssertEqual(finishes,1); XCTAssertNil(owner.superview)
    }
}
