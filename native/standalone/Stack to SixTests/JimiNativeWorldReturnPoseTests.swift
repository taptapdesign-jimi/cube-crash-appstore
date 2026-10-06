import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class JimiNativeWorldReturnPoseTests: XCTestCase {
    override func setUpWithError() throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else { throw XCTSkip("Isolated QA Simulator only") }
    }
    func testHiddenReturnPreparationHasNoMotionFeedbackOrInputAndHandsOffToAuthoredEnter() async throws {
        let snapshot: [String: Any] = ["version":1,"worldID":1,"requestID":"return-pose",
            "routeGeneration":2,"stateRevision":3,"title":"Forest","contentHeight":1800,
            "mainFrame":["x":0,"y":120,"width":390,"height":180],"mainParts":[],
            "units":[["id":"board-1","boardID":1,"frame":["x":20,"y":420,"width":160,"height":200],
                "locked":false,"interim":false,"stars":0,"allowedActions":["openCard","play"],
                "parts":[["asset":"assets/close-icon.png","role":"card","x":20,"y":0,"width":90,"height":120,"rotation":0,"opacity":1,"zIndex":2]]]]]
        let art = JimiV9Artwork(resourceRoot:Bundle.main.bundleURL.appendingPathComponent("Web.bundle"))
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:snapshot,assets:art))
        world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
        defer {world.cleanup()}
        let prepared = expectation(description:"Actual artwork preparation")
        world.prepare {prepared.fulfill()}
        await fulfillment(of:[prepared],timeout:5)
        var feedback = 0, requests = 0
        world.onFeedback = {_,_,_ in feedback += 1};world.onRequest = {_,_ in requests += 1}
        XCTAssertTrue(world.primeHiddenReturnPose())
        let card = try XCTUnwrap(world.scrollView.subviews.first?.subviews.compactMap {$0 as? UIButton}.first)
        for target in [world.header,card] {
            let prime = try XCTUnwrap(target.layer.animation(forKey:"world.return.prime") as? CAAnimationGroup)
            XCTAssertEqual(prime.speed,0);XCTAssertNil(prime.delegate)
            XCTAssertNil(target.layer.animation(forKey:"world.enter"))
            XCTAssertTrue(CATransform3DIsIdentity(target.layer.transform),"Priming must preserve the baseline used by enter")
        }
        XCTAssertTrue(world.isHidden);XCTAssertFalse(world.isUserInteractionEnabled)
        XCTAssertFalse(world.scrollView.isScrollEnabled);XCTAssertFalse(world.isReadyForInput)
        card.sendActions(for:.touchUpInside)
        XCTAssertEqual(requests,0);XCTAssertEqual(feedback,0)
        let entered = expectation(description:"Original terminal enter completion")
        world.isHidden = false;world.enter(terminal:true) {entered.fulfill()}
        XCTAssertNil(world.header.layer.animation(forKey:"world.return.prime"))
        XCTAssertNil(card.layer.animation(forKey:"world.return.prime"))
        XCTAssertNotNil(card.layer.animation(forKey:"world.enter"))
        await fulfillment(of:[entered],timeout:5)
        XCTAssertFalse(world.isReadyForInput,"Readiness ACK is not input admission")
        world.finishPresentationAdmission();XCTAssertTrue(world.isReadyForInput)
        world.park();XCTAssertTrue(world.primeHiddenReturnPose());world.park()
        XCTAssertNil(card.layer.animation(forKey:"world.return.prime"),"Parking cancels the prepared receipt's frozen pose")
        XCTAssertFalse(world.isReadyForInput)
    }
}
