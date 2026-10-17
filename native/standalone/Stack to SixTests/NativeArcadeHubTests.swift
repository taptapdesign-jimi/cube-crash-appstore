import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadeHubTests: XCTestCase {
    private func make() -> NativeArcadeHubView {
        NativeArcadeHubView(frame:CGRect(x:0,y:0,width:375,height:812),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
    }
    func testWorldSelectionUsesMatchingModalAndCleanupRejectsStalePlay() {
        let view = make(); view.present(); view.layoutIfNeeded()
        for (index,title) in ["Endurance","Pure Dice","Slow Burn"].enumerated() {
            view.hub.onWorld?(view.hub.worldIDs[index])
            let modal = view.subviews.last!
            XCTAssertEqual(modal.accessibilityIdentifier,"native.arcade-world-modal")
            func labels(_ root:UIView)->[UILabel] { root.subviews.flatMap { ($0 as? UILabel).map {[$0]} ?? labels($0) } }
            XCTAssertTrue(labels(modal).contains { $0.text == title })
            view.hide(); view.hide()
            XCTAssertFalse(view.subviews.contains { $0 === modal })
            view.present()
        }
    }
    func testCascadeAndHiddenLifecycleStayBounded() {
        let view = make(); view.present(); view.layoutIfNeeded()
        XCTAssertEqual(view.tracks(enter:true).count,4)
        XCTAssertEqual(view.tracks(enter:false).count,4)
        view.suspend(); view.resume(); view.hide(); view.resume()
        for unit in view.hub.worldUnits {
            XCTAssertNil(unit.layer.animationKeys())
            XCTAssertLessThanOrEqual(unit.frame.maxX,view.bounds.width)
            XCTAssertGreaterThanOrEqual(unit.frame.minX,0)
        }
        XCTAssertTrue(view.isHidden)
    }
}
