import XCTest
import UIKit
import WebKit
@testable import Stack_to_Six

@MainActor
private final class RouteTestWebView: WKWebView {
    override func evaluateJavaScript(_ javaScriptString: String, completionHandler: (@MainActor @Sendable (Any?, Error?) -> Void)? = nil) {
        completionHandler?(true, nil)
    }
}

@MainActor
final class JimiHomePlacementAndBackTests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only; never drive a physical phone")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {
            throw XCTSkip("Use only the isolated QA Simulator")
        }
    }

    func testAllThreeHomeRectsMatchV10MobileOffsets() {
        let root = Bundle.main.bundleURL.appendingPathComponent("Web.bundle")
        let home = JimiV9HomeView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), assets: JimiV9Artwork(resourceRoot: root))
        // v10 CSS evaluated at390×844: image233, CTA599.99 with47px
        // top safe area. Removing its two47px insets and retaining Home's
        // 44px minimum gives183 /549.99 in this unattached UIKit fixture.
        for index in 0..<3 {
            home.selectSlide(index, animated: false)
            home.layoutSubviews()
            XCTAssertEqual(home.heroView.frame.minY, 183, accuracy: 0.001)
            XCTAssertEqual(home.heroView.frame.height, 336, accuracy: 0.001)
            XCTAssertEqual(home.ctaView.convert(home.ctaView.bounds, to: home).minY, 549.99, accuracy: 0.02)
        }
    }

    func testBackInterruptsHubEnterOnceAndCannotBeResurrectedByOldCompletion() async throws {
        let web = RouteTestWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        let controller = JimiHomeHubController(web: web, resourceRoot: Bundle.main.bundleURL.appendingPathComponent("Web.bundle"))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = controller; window.makeKeyAndVisible()
        defer { controller.dispose(); window.isHidden = true }
        var starts: [String] = []
        var firstRouteMotionStarts = 0
        let hubEnterStarted = expectation(description: "Actual Hub incoming animation started")
        controller.onDiagnosticEvent = { event in
            if case .start(_, let label) = event { starts.append(label) }
            if case .motionStart(let id) = event, id == 1 {
                firstRouteMotionStarts += 1
                if firstRouteMotionStarts == 2 { hubEnterStarted.fulfill() }
            }
        }
        controller.receive(["kind": "present", "route": "home", "snapshot": ["homeSlide": 0, "journeyRequiresTutorial": false]])
        controller.home.ctaView.sendActions(for: .touchUpInside)
        controller.receive(["kind": "ready", "requestId": 1, "destination": ["kind": "hub"]])
        await fulfillment(of: [hubEnterStarted], timeout: 5)
        try await Task.sleep(nanoseconds: 120_000_000)
        XCTAssertFalse(controller.hub.isHidden)
        XCTAssertTrue(controller.hub.isUserInteractionEnabled)
        let unit = controller.hub.worldUnits[0].layer
        let paintedAlpha = unit.presentation()?.opacity ?? unit.opacity
        let paintedTransform = unit.presentation()?.transform ?? unit.transform
        let anchorDelta = (0.54 - unit.anchorPoint.y) * unit.bounds.height
        XCTAssertGreaterThan(paintedAlpha, 0, "Exercise an already painted World, not a hidden delayed one")
        XCTAssertLessThan(paintedAlpha, 1, "Test must tap during incoming motion")
        let point = CGPoint(x:controller.hub.backButton.frame.midX,y:controller.hub.backButton.frame.midY)
        let hit = try XCTUnwrap(controller.hub.hitTest(point,with:nil) as? UIButton)
        XCTAssertTrue(hit.point(inside:controller.hub.convert(point,to:hit),with:nil),"Physical tracking uses a stable 44pt target")
        hit.sendActions(for:.touchUpInside)
        XCTAssertEqual(starts, ["home->hub", "hub->home"])
        let group = try XCTUnwrap(unit.animation(forKey: "native-route") as? CAAnimationGroup)
        let alpha = try XCTUnwrap(group.animations?.first { $0 is CAKeyframeAnimation && ($0 as? CAKeyframeAnimation)?.keyPath == "opacity" } as? CAKeyframeAnimation)
        XCTAssertEqual((alpha.values?.first as? NSNumber)?.floatValue ?? -1, paintedAlpha, accuracy: 0.1)
        let transform = try XCTUnwrap(group.animations?.first { ($0 as? CAKeyframeAnimation)?.keyPath == "transform" } as? CAKeyframeAnimation)
        let initial = try XCTUnwrap(transform.values?.first as? NSValue).caTransform3DValue
        XCTAssertEqual(initial.m11, paintedTransform.m11, accuracy: 0.02)
        XCTAssertEqual(initial.m22, paintedTransform.m22, accuracy: 0.02)
        XCTAssertEqual(initial.m42, paintedTransform.m42 + anchorDelta * (paintedTransform.m22 - 1), accuracy: 0.5)
        controller.hub.backButton.sendActions(for: .touchUpInside)
        XCTAssertEqual(starts.count, 2, "Repeated Back cannot start another route")
        controller.receive(["kind": "ready", "requestId": 2, "destination": ["kind": "home"]])
        try await Task.sleep(nanoseconds: 1_650_000_000)
        XCTAssertTrue(controller.hub.isHidden)
        XCTAssertFalse(controller.home.isHidden)
        XCTAssertTrue(controller.home.isUserInteractionEnabled)
    }
    func testBackSupersedesOutgoingWorldPreparationAndIgnoresOldReady() async throws {
        let web = RouteTestWebView(frame:CGRect(x:0,y:0,width:390,height:844))
        let controller = JimiHomeHubController(web:web,resourceRoot:Bundle.main.bundleURL.appendingPathComponent("Web.bundle"))
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController = controller; window.makeKeyAndVisible()
        defer {controller.dispose();window.isHidden = true}
        var starts:[String] = []
        controller.onDiagnosticEvent = {if case .start(_,let label) = $0 {starts.append(label)}}
        controller.receive(["kind":"present","route":"hub","snapshot":["homeSlide":0]])
        controller.hub.worldUnits[0].sendActions(for:.touchUpInside)
        try await Task.sleep(nanoseconds:120_000_000)
        XCTAssertTrue(controller.hub.isUserInteractionEnabled)
        let point = CGPoint(x:controller.hub.backButton.frame.midX,y:controller.hub.backButton.frame.midY)
        let hit = try XCTUnwrap(controller.hub.hitTest(point,with:nil) as? UIButton)
        XCTAssertTrue(hit.point(inside:controller.hub.convert(point,to:hit),with:nil))
        hit.sendActions(for:.touchUpInside);hit.sendActions(for:.touchUpInside)
        XCTAssertEqual(starts,["hub->world:world-1","hub->home"])
        controller.receive(["kind":"ready","requestId":1,"destination":["kind":"world","worldId":1]])
        controller.receive(["kind":"ready","requestId":2,"destination":["kind":"home"]])
        try await Task.sleep(nanoseconds:1_700_000_000)
        XCTAssertTrue(controller.hub.isHidden);XCTAssertFalse(controller.home.isHidden)
        XCTAssertTrue(controller.home.isUserInteractionEnabled)
    }

}
