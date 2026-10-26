import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class JimiNativeWorldReturnPoseTests: XCTestCase {
    override func setUpWithError() throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else { throw XCTSkip("Isolated QA Simulator only") }
    }
    func testInterimTerminalReturnUsesArtworkCentreWithBottomIdlePivotInEveryWorld() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else {throw XCTSkip("Return reminder requires full motion")}
        for width:CGFloat in [390,768] {for worldID in 1...3 {
            let boardID=(worldID-1)*10+8
            var progression=NativeProgressionState()
            progression.completedJourneyBoards=Set(1..<boardID)
            let raw=try NativeWorldLayouts().snapshot(world:worldID,width:Double(width),height:844,generation:2,progression:progression,returnBoard:boardID)
            let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
            let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:width,height:844))
            window.rootViewController=host;window.makeKeyAndVisible();world.frame=window.bounds;host.view.addSubview(world)
            defer {world.cleanup();window.isHidden=true}
            world.layoutIfNeeded()
            func find(_ root:UIView,_ id:String)->UIView? {
                if root.accessibilityIdentifier==id{return root}
                return root.subviews.lazy.compactMap{find($0,id)}.first
            }
            let unit=try XCTUnwrap(find(world,"native.world.card.\(boardID)"))
            world.scrollView.contentOffset=CGPoint(x:0,y:max(0,min(unit.frame.midY-422,world.scrollView.contentSize.height-844)))
            let prepared=expectation(description:"Authored Unit08 artwork ready")
            world.prepare{prepared.fulfill()};await fulfillment(of:[prepared],timeout:10)
            let card=try XCTUnwrap(find(unit,"native.world.part.\(boardID).card"))
            let originalPosition=card.layer.position,originalAnchor=card.layer.anchorPoint
            for _ in 0..<2 {
                let entered=expectation(description:"Terminal World enters and starts reminder")
                world.isHidden=false;world.enter(terminal:true){entered.fulfill()}
                await fulfillment(of:[entered],timeout:5)
                let carrier=try XCTUnwrap(find(world,"native.world.return-reminder-carrier"))
                let content=try XCTUnwrap(carrier.superview)
                XCTAssertEqual(card.layer.anchorPoint,CGPoint(x:0.5,y:1),"Exercise interim idle's live bottom pivot")
                let artworkCentre=card.convert(CGPoint(x:card.bounds.midX,y:card.bounds.midY),to:content)
                XCTAssertEqual(carrier.center.x,artworkCentre.x,accuracy:0.001)
                XCTAssertEqual(carrier.center.y,artworkCentre.y,accuracy:0.001,"World \(worldID) Unit08 must not move down by half a card on return")
                world.park()
                XCTAssertEqual(card.layer.position,originalPosition)
                XCTAssertEqual(card.layer.anchorPoint,originalAnchor)
                XCTAssertNil(find(world,"native.world.return-reminder-carrier"))
            }
        }}
    }
    func testHiddenReturnPreparationHasNoMotionFeedbackOrInputAndHandsOffToAuthoredEnter() async throws {
        let snapshot: [String: Any] = ["version":1,"worldID":1,"requestID":"return-pose",
            "routeGeneration":2,"stateRevision":3,"title":"Forest","contentHeight":1800,
            "mainFrame":["x":0,"y":120,"width":390,"height":180],"mainParts":[],
            "units":[["id":"board-1","boardID":1,"frame":["x":20,"y":420,"width":160,"height":200],
                "locked":false,"interim":false,"stars":0,"allowedActions":["openCard","play"],
                "parts":[["asset":"assets/close-icon.png","role":"card","x":20,"y":0,"width":90,"height":120,"rotation":0,"opacity":1,"zIndex":2]]]]]
        let art = JimiV9Artwork(resourceRoot:NativeTestResources.root)
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
