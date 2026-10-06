import XCTest
import UIKit
@testable import Stack_to_Six

/// Copy into the isolated Simulator unit-test folder. Exercises the real UIView
/// layout, not a duplicated geometry formula. No save, input or route writes.
@MainActor
final class JimiHomeHeroGeometryTests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Geometry fixture is Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {
            throw XCTSkip("Preserve physical devices and the original gameplay incident Simulator")
        }
    }

    private func home() -> JimiV9HomeView {
        let assets = JimiV9Artwork(resourceRoot: Bundle.main.bundleURL.appendingPathComponent("Web.bundle"))
        let view = JimiV9HomeView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), assets: assets)
        view.layoutSubviews()
        return view
    }

    private func verifyRelayout(pivot: CGFloat, scale: CGFloat) {
        let view = home()
        let hero = view.heroView.layer
        let originalAnchor = hero.anchorPoint
        // Same pivot compensation as the route owner, preserving the rest rect.
        hero.position.y += (pivot - originalAnchor.y) * hero.bounds.height
        hero.anchorPoint = CGPoint(x: originalAnchor.x, y: pivot)
        hero.transform = CATransform3DMakeScale(scale, scale, 1)
        let localCenter = CGPoint(x: hero.bounds.midX, y: hero.bounds.midY)
        let before = hero.convert(localCenter, to: hero.superlayer)
        let beforePosition = hero.position
        for _ in 0..<3 {
            view.layoutSubviews()
            let after = hero.convert(localCenter, to: hero.superlayer)
            XCTAssertEqual(after.x, before.x, accuracy: 0.001)
            XCTAssertEqual(after.y, before.y, accuracy: 0.001, "Relayout moved hero at pivot \(pivot), scale \(scale)")
            XCTAssertEqual(hero.position.y, beforePosition.y, accuracy: 0.001)
        }
        // Restoring the baseline anchor after motion must restore the rest pose.
        hero.transform = CATransform3DIdentity
        hero.position.y += (originalAnchor.y - hero.anchorPoint.y) * hero.bounds.height
        hero.anchorPoint = originalAnchor
        let restored = hero.position
        view.layoutSubviews()
        XCTAssertEqual(hero.position.y, restored.y, accuracy: 0.001)
    }

    func testExitPivotRelayoutDoesNotMoveHero() {
        for scale in [CGFloat(1), 1.15, 0.5, 0] { verifyRelayout(pivot: 0.54, scale: scale) }
    }

    func testSelectedSlidePivotRelayoutDoesNotMoveHero() {
        for scale in [CGFloat(1), 1.065, 0.975] { verifyRelayout(pivot: 0.65, scale: scale) }
    }

    func testDefaultPivotRetainsExistingHomeGeometry() {
        verifyRelayout(pivot: 0.5, scale: 1)
    }

    func testCTAStartsRouteSynchronouslyAndRejectsRepeatedActivation() {
        let view = home()
        view.selectSlide(0, animated: false)
        let cta = view.ctaView
        var activations = 0
        view.onActivate = { _ in
            activations += 1
            view.cancelPan(preservingCTAFeedback: true)
        }
        cta.sendActions(for: .touchDown)
        cta.sendActions(for: .touchUpInside)
        XCTAssertEqual(activations, 1, "Route must start before the rebound finishes")
        cta.sendActions(for: .touchUpInside)
        XCTAssertEqual(activations, 1)
        view.cancelPan()
        cta.sendActions(for: .touchUpInside)
        XCTAssertEqual(activations, 2, "Cancellation must release the activation lock")
    }
}
