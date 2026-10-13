import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class JimiHubLayoutContinuityTests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {
            throw XCTSkip("Use isolated QA Simulator only")
        }
    }

    func testEveryWorldKeepsPositionAcrossExitPivotRelayout() {
        // Short viewport gives a legal31px scroll range. On an unattached
        // 844px view with zero safe insets UIKit correctly clamps it to zero.
        let hub = JimiV9HubView(frame: CGRect(x: 0, y: 0, width: 390, height: 700),
                                assets: JimiV9Artwork(resourceRoot: NativeTestResources.root))
        hub.layoutSubviews()
        hub.scrollView.contentOffset = CGPoint(x: 0, y: 31)
        let offset = hub.scrollView.contentOffset
        for unit in hub.worldUnits {
            let layer = unit.layer
            let neutralPosition = layer.position
            CATransaction.begin(); CATransaction.setDisableActions(true)
            layer.position.y += (0.54 - layer.anchorPoint.y) * layer.bounds.height
            layer.anchorPoint = CGPoint(x: 0.5, y: 0.54)
            let exitPosition = layer.position
            // Negative control: reproduce the previous layout's center write.
            unit.center = neutralPosition
            XCTAssertEqual(layer.position.y - exitPosition.y, -0.04 * layer.bounds.height, accuracy: 0.001)
            XCTAssertLessThan(layer.position.y, exitPosition.y)
            layer.position = exitPosition
            // Model transforms are already final while CA paints the exit.
            for scale in [1.0, 1.18, 0.01] {
                layer.transform = CATransform3DMakeScale(scale, scale, 1)
                for _ in 0..<3 { hub.layoutSubviews() }
                XCTAssertEqual(layer.position.x, exitPosition.x, accuracy: 0.001, "World \(unit.tag)")
                XCTAssertEqual(layer.position.y, exitPosition.y, accuracy: 0.001, "World \(unit.tag)")
                XCTAssertEqual(hub.scrollView.contentOffset, offset)
            }
            layer.transform = CATransform3DIdentity
            layer.position.y += (0.5 - layer.anchorPoint.y) * layer.bounds.height
            layer.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            hub.layoutSubviews()
            XCTAssertEqual(layer.position.y, neutralPosition.y, accuracy: 0.001)
            CATransaction.commit()
        }
    }

    func testWorldUnitsHaveSixteenPointEdgePaddingAndSpacedProgress() {
        func labels(_ view:UIView)->[UILabel] {
            view.subviews.flatMap { child in (child as? UILabel).map {[$0]} ?? labels(child) }
        }
        for width:CGFloat in [375,390,430] {
            let hub=JimiV9HubView(frame:CGRect(x:0,y:0,width:width,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            hub.layoutSubviews()
            for unit in hub.worldUnits {
                XCTAssertEqual(unit.tag == 3 ? width-unit.frame.maxX:unit.frame.minX,16,accuracy:0.001)
                XCTAssertEqual(labels(unit).map(\.text),["0 / 10"])
                let banner=try! XCTUnwrap(labels(unit).first?.superview)
                let degrees=atan2(banner.transform.b,banner.transform.a)*180 / .pi
                XCTAssertEqual(degrees,unit.tag == 1 ? -15 : unit.tag == 2 ? 0 : 2,accuracy:0.001)
            }
            hub.updateProgress([["worldId":1,"completed":2,"total":10],["worldId":3,"completed":0,"total":10],["worldId":2,"completed":10,"total":10]])
            XCTAssertEqual(hub.worldUnits.flatMap {labels($0).compactMap(\.text)},["2 / 10","0 / 10","10 / 10"])
            hub.updateProgress([1,3,2].map {["worldId":$0,"completed":10,"total":10]})
            for label in hub.worldUnits.flatMap({labels($0)}) {
                XCTAssertLessThanOrEqual(label.intrinsicContentSize.width,label.bounds.width,"Full progress must fit the original flag label at width \(width)")
            }
        }
    }
}
