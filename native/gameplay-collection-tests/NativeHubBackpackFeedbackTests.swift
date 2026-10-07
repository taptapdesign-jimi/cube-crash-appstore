import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeHubBackpackFeedbackTests:XCTestCase {
    func testExactSourceContactEndpointsAndOvershoot() {
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0),1)
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0.077),0.92,accuracy:0.00000001)
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0.154),1.06,accuracy:0.00000001)
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0.22),1,accuracy:0.00000001)
        XCTAssertGreaterThan(NativeHubBackpackFeedback.ease(0.5),1)
    }
    func testOnlyCurrentVisibleHubContactAnimatesImageAndRapidContactReplacesOwnTrack() {
        let button=UIButton(type:.custom);button.setImage(UIImage(),for:.normal)
        let owner=NativeHubBackpackFeedback(button:button)
        XCTAssertFalse(owner.activate(generation:1));owner.setActive(true,generation:1)
        XCTAssertTrue(owner.activate(generation:1));XCTAssertTrue(owner.activate(generation:1))
        XCTAssertEqual(button.imageView?.layer.animationKeys(),[NativeHubBackpackFeedback.animationKey]);XCTAssertNil(button.layer.animationKeys())
        owner.setActive(false,generation:2);XCTAssertNil(button.imageView?.layer.animationKeys());XCTAssertFalse(owner.activate(generation:1))
        owner.setActive(true,generation:1);XCTAssertFalse(owner.activate(generation:1));XCTAssertEqual(owner.acceptedContacts,2)
        owner.dispose();owner.dispose();owner.setActive(true,generation:3);XCTAssertFalse(owner.activate(generation:3))
    }
}
