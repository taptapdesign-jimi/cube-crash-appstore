import XCTest
import UIKit
import WebKit
@testable import Stack_to_Six

@MainActor
private final class ForestActionWebSpy: JimiNativeWorldTransport {
    var replies: [(@MainActor (Result<Any, Error>) -> Void)] = []
    var arguments: [[String: Any]] = []
    func call(_ functionBody: String, arguments: [String: Any], completion: @escaping @MainActor @Sendable (Result<Any, Error>) -> Void) {
        self.arguments.append(arguments)
        replies.append(completion)
    }
}

/// In-memory UIKit lifecycle fixtures. No gameplay/progression/save writes.
/// These complement actual routing UI tests; they do not prove terminal parity.
@MainActor
final class JimiNativeWorldTests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else { throw XCTSkip("Isolated QA Simulator only") }
    }
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("Web.bundle") }
    private var art: JimiV9Artwork { JimiV9Artwork(resourceRoot: root) }
    private func fixture(_ revision: Int = 1) -> [String: Any] {
        func unit(_ id: Int, locked: Bool) -> [String: Any] {
            ["id":"board-\(id)","boardID":id,"frame":["x":30,"y":400 + id * 120,"width":150,"height":200],
             "cardArt":"assets/close-icon.png","locked":locked,"interim":false,"stars":0,
             "allowedActions":locked ? [] : ["openCard","play"],"stats":[["label":"Score","value":"0"]],
             "parts":[["asset":"assets/close-icon.png","role":"card","x":20,"y":10,"width":90,"height":120,"rotation":0,"opacity":1,"zIndex":2]]]
        }
        return ["version":1,"worldID":1,"requestID":"fixture","routeGeneration":1,"stateRevision":revision,
                "title":"Forest","contentHeight":2400,"mainFrame":["x":0,"y":100,"width":390,"height":300],
                "mainParts":[],"units":[unit(1,locked:false),unit(2,locked:true)]]
    }
    private func descendant(_ root: UIView, _ identifier: String) -> UIView? {
        if root.accessibilityIdentifier == identifier { return root }
        return root.subviews.lazy.compactMap { self.descendant($0,identifier) }.first
    }
    private func settle(_ seconds: Double = 1.3) async throws { try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000)) }

    func testPhysicalBackTargetDuringEnterAndPreemptedCardReceipt() async throws {
        for worldID in 1...3 {
            var data = fixture(); data["worldID"] = worldID
            let firstBoard = (worldID-1)*10+1
            data["units"] = (data["units"] as! [[String:Any]]).map { value in
                var unit = value;let board = (value["boardID"] as! Int)+(worldID-1)*10
                unit["boardID"] = board;unit["id"] = "board-\(board)";return unit
            }
            let spy = ForestActionWebSpy()
            let host = JimiNativeWorldHost(web:WKWebView(frame:.zero),artwork:art,transport:spy)
            let controller = UIViewController(),window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            window.rootViewController = controller;window.makeKeyAndVisible()
            defer {host.dispose();window.isHidden = true}
            XCTAssertTrue(host.prepare(data,in:controller.view))
            let world = try XCTUnwrap(host.worldView)
            var oldEnterFinished = false,back = 0
            host.enter(terminal:false) {oldEnterFinished = true}
            world.layoutIfNeeded()
            try await settle(0.12)
            XCTAssertFalse(world.isReadyForInput)
            let point = CGPoint(x:world.backButton.frame.midX,y:world.backButton.frame.midY)
            let hit = try XCTUnwrap(world.hitTest(point,with:nil) as? UIButton)
            XCTAssertTrue(hit.point(inside:world.convert(point,to:hit),with:nil))
            host.onBack = {back += 1;host.exit {}}
            hit.sendActions(for:.touchUpInside);hit.sendActions(for:.touchUpInside)
            XCTAssertEqual(spy.replies.count,1,"First X dispatches during enter, duplicates are inert")
            spy.replies[0](.success(["accepted":true]))
            let group = try XCTUnwrap(world.header.layer.animation(forKey:"world.exit") as? CAAnimationGroup)
            XCTAssertNotNil(group.animations)
            hit.sendActions(for:.touchUpInside);XCTAssertEqual(spy.replies.count,1)
            try await settle()
            XCTAssertEqual(back,1);XCTAssertFalse(oldEnterFinished,"Retired enter cannot grant admission")

            XCTAssertTrue(host.prepare(data,in:controller.view))
            host.enter(terminal:false) {};try await settle();world.finishPresentationAdmission()
            world.onRequest?("openCard",firstBoard)
            XCTAssertEqual(spy.replies.count,2)
            let nextHit = try XCTUnwrap(world.hitTest(point,with:nil) as? UIButton)
            nextHit.sendActions(for:.touchUpInside)
            XCTAssertEqual(spy.replies.count,3,"Back preempts pending presentation work")
            spy.replies[1](.success(["accepted":true,"snapshot":data]))
            XCTAssertFalse(world.hasActiveCard,"Retired openCard receipt cannot mount a modal")
            spy.replies[2](.success(["accepted":true]))
            XCTAssertEqual(back,2)
        }
    }

    func testBackRevalidatesViewedRevisionOnceAndRejectedTapCanRetry() async throws {
        let spy = ForestActionWebSpy()
        let host = JimiNativeWorldHost(web:WKWebView(frame:.zero),artwork:art,transport:spy)
        let container = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        defer {host.dispose()}
        XCTAssertTrue(host.prepare(fixture(),in:container))
        host.enter(terminal:false) {};try await settle()
        let world = try XCTUnwrap(host.worldView);world.finishPresentationAdmission()
        var backs = 0;host.onBack = {backs += 1}
        world.backButton.sendActions(for:.touchUpInside)
        spy.replies[0](.success(["accepted":false,"code":"stale-request","snapshot":fixture(2)]))
        XCTAssertEqual(spy.replies.count,2)
        let retry = try XCTUnwrap(spy.arguments[1]["action"] as? [String:Any])
        XCTAssertEqual(retry["stateRevision"] as? Int,2)
        world.backButton.sendActions(for:.touchUpInside);XCTAssertEqual(spy.replies.count,2)
        spy.replies[1](.success(["accepted":false,"code":"stale-request","snapshot":fixture(3)]))
        XCTAssertEqual(spy.replies.count,2,"Stale revision retry is bounded")
        world.backButton.sendActions(for:.touchUpInside);XCTAssertEqual(spy.replies.count,3)
        spy.replies[2](.success(["accepted":true]));XCTAssertEqual(backs,1)
    }

    func testWorldPrimesHiddenRequiresAdmissionAndBlocksLockedCard() async throws {
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:fixture(),assets:art))
        world.frame = CGRect(x:0,y:0,width:390,height:844); world.layoutIfNeeded()
        defer { world.cleanup() }
        XCTAssertEqual(world.alpha,0); XCTAssertFalse(world.isReadyForInput)
        var requests: [String] = []; world.onRequest = { action,_ in requests.append(action) }
        let unlocked = try XCTUnwrap(descendant(world,"native.world.card.1") as? UIButton)
        unlocked.sendActions(for:.touchUpInside); XCTAssertTrue(requests.isEmpty)
        let entered = expectation(description:"Finite enter completes")
        world.enter { entered.fulfill() }
        await fulfillment(of:[entered],timeout:5)
        XCTAssertFalse(world.isReadyForInput, "Enter completion cannot replace web admission")
        world.finishPresentationAdmission(); XCTAssertTrue(world.isReadyForInput)
        let locked = try XCTUnwrap(descendant(world,"native.world.card.2") as? UIButton)
        locked.sendActions(for:.touchUpInside); XCTAssertTrue(requests.isEmpty)
        unlocked.sendActions(for:.touchUpInside); XCTAssertEqual(requests,["openCard"])
        XCTAssertTrue(world.scrollView.touchesShouldCancel(in:unlocked), "Vertical scroll must cancel a pending button touch")
        world.park(); unlocked.sendActions(for:.touchUpInside); XCTAssertEqual(requests.count,1)
        world.cleanup(); world.cleanup(); XCTAssertFalse(world.isReadyForInput)
    }

    func testResourceLeasesUseDecodedRGBAAndDoubleCleanupRejectsLatePrepare() async throws {
        let resources = JimiNativeWorldResources(root:root)
        let image = try XCTUnwrap(resources.image("assets/close-icon.png",owner:1))
        let cg = try XCTUnwrap(image.cgImage)
        XCTAssertEqual(resources.decodedBytes,cg.bytesPerRow * cg.height)
        _ = resources.image("./assets/close-icon.png",owner:2)
        resources.release(1); XCTAssertEqual(resources.decodedBytes,cg.bytesPerRow * cg.height)
        resources.release(2); XCTAssertEqual(resources.decodedBytes,0)
        var callback: Bool?
        resources.prepare(["assets/close-icon.png"],owner:1) { accepted in callback = accepted }
        resources.cleanup(); resources.cleanup(); try await settle(0.3)
        XCTAssertEqual(callback,false,"Canceled decode must settle the caller with rejected admission")
        XCTAssertEqual(resources.decodedBytes,0)
        XCTAssertNil(resources.image("../Info.plist",owner:1))
    }

    func testSnapshotRejectsMalformedIdentityGeometryAndAssetTraversal() {
        XCTAssertNotNil(JimiNativeWorldSnapshot(fixture()))
        var wrongVersion = fixture(); wrongVersion["version"] = 2
        XCTAssertNil(JimiNativeWorldSnapshot(wrongVersion))
        var wrongWorld = fixture(); wrongWorld["worldID"] = 2
        XCTAssertNil(JimiNativeWorldSnapshot(wrongWorld))
        var invalidGeneration = fixture(); invalidGeneration["routeGeneration"] = -1
        XCTAssertNil(JimiNativeWorldSnapshot(invalidGeneration))
        var invalidGeometry = fixture(); invalidGeometry["mainFrame"] = ["x":0,"y":0,"width":Double.nan,"height":300]
        XCTAssertNil(JimiNativeWorldSnapshot(invalidGeometry))
        var duplicate = fixture(), units = fixture()["units"] as! [[String:Any]]
        units[1] = units[0]; duplicate["units"] = units
        XCTAssertNil(JimiNativeWorldSnapshot(duplicate))
        var traversal = fixture(); units = fixture()["units"] as! [[String:Any]]
        units[0]["cardArt"] = "assets/../Info.plist"; traversal["units"] = units
        XCTAssertNil(JimiNativeWorldSnapshot(traversal))
    }

    func testParkDuringIncomingMotionRetiresItsAdmissionCompletion() async throws {
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:fixture(),assets:art))
        world.frame = CGRect(x:0,y:0,width:390,height:844); world.layoutIfNeeded()
        defer { world.cleanup() }
        var resurrected = false
        world.enter {
            resurrected = true
            world.finishPresentationAdmission()
        }
        world.park()
        try await settle(2)
        XCTAssertFalse(resurrected,"Parked enter owner cannot commit input/visibility later")
        XCTAssertFalse(world.isReadyForInput)
        XCTAssertFalse(world.isUserInteractionEnabled)
    }

    func testCloseDuringFlipIsAcceptedAndCleanupRetiresOldCompletion() async throws {
        let unit = try XCTUnwrap(JimiNativeWorldSnapshot(fixture())).units[0]
        let card = JimiNativeWorldCardView(unit:unit,assets:art,resources:JimiNativeWorldResources(root:root))
        card.frame = CGRect(x:0,y:0,width:390,height:844)
        card.enter(from:CGRect(x:30,y:400,width:90,height:120)); try await settle()
        var closes = 0; card.onRequest = { if $0 == "close" { closes += 1 } }
        card.perform(NSSelectorFromString("tapped:"),with:UITapGestureRecognizer())
        let close = try XCTUnwrap(descendant(card,"native.world.card.close") as? UIButton)
        close.sendActions(for:.touchUpInside)
        XCTAssertEqual(closes,1,"Close during flip must interrupt its owned motion")
        var lateClose = false
        card.close(to:CGRect(x:30,y:400,width:90,height:120)) { lateClose = true }
        card.cleanup(); card.cleanup(); try await settle()
        XCTAssertFalse(lateClose,"Retired animation cannot land a replaced card")
    }

    func testActualCardTapAlternatesApprovedV10DirectionAndNormalizesFaces() async throws {
        let unit = try XCTUnwrap(JimiNativeWorldSnapshot(fixture())).units[0]
        let resources = JimiNativeWorldResources(root:root)
        let card = JimiNativeWorldCardView(unit:unit,assets:art,resources:resources)
        card.frame = CGRect(x:0,y:0,width:390,height:844)
        let window = UIWindow(frame:card.frame),controller = UIViewController()
        window.rootViewController = controller;window.makeKeyAndVisible();controller.view.addSubview(card)
        defer {card.cleanup();resources.cleanup();window.isHidden = true}
        card.enter(from:CGRect(x:30,y:400,width:90,height:120))
        let rotorView = try XCTUnwrap(descendant(card,"native.world.card.rotor"))
        let camera = try XCTUnwrap(descendant(card,"native.world.card.camera"))
        XCTAssertEqual(camera.layer.sublayerTransform.m34,-1/1050,accuracy:0.000001)
        XCTAssertEqual(card.layer.sublayerTransform.m34,0)
        var shell:UIView? = rotorView
        while let current = shell,current !== camera {
            XCTAssertTrue(current.layer is CATransformLayer,"Every physical shell must preserve the shared camera")
            XCTAssertEqual(current.layer.sublayerTransform.m34,0)
            shell = current.superview
        }
        let rotor = rotorView.layer
        let entry = try XCTUnwrap(rotor.animation(forKey:"card.flip") as? CAKeyframeAnimation)
        let entryAngles = try XCTUnwrap(entry.values as? [Double])
        XCTAssertEqual(entryAngles.first!,0,accuracy:0.000001);XCTAssertEqual(entryAngles.last!,-.pi,accuracy:0.000001)
        XCTAssertEqual(entryAngles[64],-.pi/2,accuracy:0.000001)
        try await settle(0.65)
        let carrier = try XCTUnwrap(camera.subviews.first(where:{$0.layer is CATransformLayer}))
        let backTilt = atan2(carrier.layer.transform.m12,carrier.layer.transform.m11)
        XCTAssertGreaterThanOrEqual(abs(backTilt),2 * .pi/180);XCTAssertLessThanOrEqual(abs(backTilt),3.25 * .pi/180)
        card.perform(NSSelectorFromString("tapped:"),with:UITapGestureRecognizer())
        let toFront = try XCTUnwrap(rotor.animation(forKey:"card.flip") as? CAKeyframeAnimation)
        let frontAngles = try XCTUnwrap(toFront.values as? [Double])
        XCTAssertEqual(frontAngles.first!,-.pi,accuracy:0.000001);XCTAssertEqual(frontAngles[1],-2 * .pi,accuracy:0.000001)
        try await settle(0.55)
        XCTAssertEqual(rotor.transform.m11,1,accuracy:0.000001);XCTAssertEqual(rotor.transform.m13,0,accuracy:0.000001)
        let frontTilt = atan2(carrier.layer.transform.m12,carrier.layer.transform.m11)
        XCTAssertLessThan(frontTilt*backTilt,0,"Front/back tilt must have opposite signs")
        card.perform(NSSelectorFromString("tapped:"),with:UITapGestureRecognizer())
        let toBack = try XCTUnwrap(rotor.animation(forKey:"card.flip") as? CAKeyframeAnimation)
        let backAngles = try XCTUnwrap(toBack.values as? [Double])
        XCTAssertEqual(backAngles.first!,0,accuracy:0.000001);XCTAssertEqual(backAngles[1],.pi,accuracy:0.000001)
        try await settle(0.55)
        XCTAssertEqual(card.stableFaceAngle,-.pi,accuracy:0.000001)
        XCTAssertEqual(rotor.transform.m11,-1,accuracy:0.000001);XCTAssertEqual(rotor.transform.m13,0,accuracy:0.000001)
    }

    func testHostSuspendRejectsDeferredActionAndDisposeTwice() async throws {
        let web = WKWebView(frame:.zero), spy = ForestActionWebSpy()
        let host = JimiNativeWorldHost(web:web,artwork:art,transport:spy)
        let container = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        XCTAssertTrue(host.prepare(fixture(),in:container))
        let entered = expectation(description:"Host enter")
        host.enter(terminal:false) { entered.fulfill() }
        await fulfillment(of:[entered],timeout:5)
        let world = try XCTUnwrap(host.worldView); world.finishPresentationAdmission()
        let button = try XCTUnwrap(descendant(world,"native.world.card.1") as? UIButton)
        button.sendActions(for:.touchUpInside)
        XCTAssertEqual(spy.replies.count,1)
        host.suspend()
        XCTAssertTrue(host.requiresPresentationRecovery)
        XCTAssertTrue(world.isHidden);XCTAssertFalse(world.isReadyForInput)
        spy.replies[0](.success(["accepted":true,"snapshot":fixture()]))
        XCTAssertFalse(world.hasActiveCard,"Late web receipt cannot present while suspended")
        host.resume();XCTAssertTrue(world.isHidden,"Foreground cannot revive a parked pending request without exact preparation")
        XCTAssertTrue(host.prepare(fixture(),in:container));XCTAssertFalse(host.requiresPresentationRecovery)
        host.dispose(); host.dispose(); XCTAssertNil(host.worldView)
    }

    func testCommittedCanonicalLaunchReceiptSurvivesSuspension() async throws {
        let spy = ForestActionWebSpy()
        let host = JimiNativeWorldHost(web:WKWebView(frame:.zero),artwork:art,transport:spy)
        let container = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        XCTAssertTrue(host.prepare(fixture(),in:container))
        let entered = expectation(description:"Enter for committed launch")
        host.enter(terminal:false) {entered.fulfill()};await fulfillment(of:[entered],timeout:5)
        let world = try XCTUnwrap(host.worldView);world.finishPresentationAdmission()
        world.onRequest?("play",1)
        XCTAssertEqual(spy.replies.count,1)
        spy.replies[0](.success(["accepted":true,"snapshot":fixture(),"launchToken":"canonical-token"]))
        try await settle(2)
        XCTAssertEqual(spy.replies.count,2,"Actual native exit must finish before canonical launch dispatch")
        world.backButton.sendActions(for:.touchUpInside)
        XCTAssertEqual(spy.replies.count,2,"Back cannot preempt an already dispatched canonical game")
        var committed = 0;host.onGameplayCommitted = {committed += 1}
        host.suspend();XCTAssertFalse(host.requiresPresentationRecovery,"Dispatched gameplay cannot be canceled by background")
        spy.replies[1](.success(true))
        XCTAssertEqual(committed,1,"Late authoritative launch must still retire native coverage")
        XCTAssertFalse(world.isReadyForInput)
        host.dispose()
    }

    func testPreparedTransitionReleasesCoverageBeforeCanonicalCompletionExactlyOnce() async throws {
        let spy = ForestActionWebSpy()
        let host = JimiNativeWorldHost(web:WKWebView(frame:.zero),artwork:art,transport:spy)
        let container = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        XCTAssertTrue(host.prepare(fixture(),in:container))
        let entered = expectation(description:"Enter for transition transfer")
        host.enter(terminal:false) {entered.fulfill()}; await fulfillment(of:[entered],timeout:5)
        let world = try XCTUnwrap(host.worldView); world.finishPresentationAdmission()
        world.onRequest?("play",1)
        spy.replies[0](.success(["accepted":true,"snapshot":fixture(),"launchToken":"transition-token"]))
        try await settle(2)
        XCTAssertEqual(spy.replies.count,2)
        var releases = 0
        host.onGameplayCommitted = { releases += 1; host.hide(); container.isHidden = true }
        XCTAssertFalse(host.acceptTransitionPresentation(token:"stale",routeGeneration:1,stateRevision:1))
        XCTAssertFalse(host.acceptTransitionPresentation(token:"transition-token",routeGeneration:2,stateRevision:1))
        XCTAssertFalse(host.acceptTransitionPresentation(token:"transition-token",routeGeneration:1,stateRevision:2))
        XCTAssertEqual(releases,0); XCTAssertEqual(spy.replies.count,2)
        XCTAssertTrue(host.acceptTransitionPresentation(token:"transition-token",routeGeneration:1,stateRevision:1))
        XCTAssertEqual(releases,1); XCTAssertTrue(container.isHidden); XCTAssertTrue(world.isHidden)
        XCTAssertEqual(spy.replies.count,3,"ACK follows synchronous native cover retirement")
        XCTAssertEqual(spy.arguments[2]["token"] as? String,"transition-token")
        XCTAssertFalse(host.acceptTransitionPresentation(token:"transition-token",routeGeneration:1,stateRevision:1))
        spy.replies[2](.success(true)); spy.replies[1](.success(true))
        XCTAssertEqual(releases,1,"Canonical game completion must not release coverage twice")
        host.dispose()
        XCTAssertFalse(host.acceptTransitionPresentation(token:"transition-token",routeGeneration:1,stateRevision:1))
    }

    func testRejectedStalePrepareDoesNotPoisonCurrentReceiptOrCancelAction() async throws {
        let spy = ForestActionWebSpy()
        let host = JimiNativeWorldHost(web:WKWebView(frame:.zero),artwork:art,transport:spy)
        let container = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        var current = fixture(4); current["routeGeneration"] = 2; current["requestID"] = "current"
        XCTAssertTrue(host.prepare(current,in:container))
        let entered = expectation(description:"Current host enter")
        host.enter(terminal:false) {entered.fulfill()}; await fulfillment(of:[entered],timeout:5)
        let world = try XCTUnwrap(host.worldView); world.finishPresentationAdmission()
        let button = try XCTUnwrap(descendant(world,"native.world.card.1") as? UIButton)
        button.sendActions(for:.touchUpInside); XCTAssertEqual(spy.replies.count,1)
        XCTAssertFalse(host.prepare(fixture(1),in:container))
        XCTAssertEqual(host.snapshotValue?["requestID"] as? String,"current")
        XCTAssertFalse(world.isHidden)
        spy.replies[0](.success(["accepted":true,"snapshot":current]))
        XCTAssertTrue(world.hasActiveCard,"Rejected stale prepare must not retire a valid in-flight request")
        host.dispose()
    }

    func testUnitAccessibilityTracksCanonicalInterimAndLockChanges() throws {
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:fixture(),assets:art))
        defer {world.cleanup()}
        let regular = try XCTUnwrap(descendant(world,"native.world.card.1") as? UIButton)
        let locked = try XCTUnwrap(descendant(world,"native.world.card.2") as? UIButton)
        XCTAssertEqual(regular.accessibilityValue,"regular");XCTAssertEqual(locked.accessibilityValue,"locked")
        var next = fixture(2),units = fixture()["units"] as! [[String:Any]]
        units[0]["interim"] = true;units[1]["locked"] = false
        next["units"] = units;world.reconcile(next)
        XCTAssertEqual(regular.accessibilityValue,"interim")
        XCTAssertEqual(regular.accessibilityLabel,"Stage 1, interim")
        XCTAssertEqual(locked.accessibilityValue,"regular")
        world.reconcile(fixture(1));XCTAssertEqual(regular.accessibilityValue,"interim","Stale snapshot cannot relabel current admission")
    }

    func testForestHeaderMatchesOriginalMobileCSSRecipe() throws {
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:fixture(),assets:art))
        world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
        defer {world.cleanup()}
        // Existing390×844 CSS: headerTop safeTop +2%ofviewport -16px,
        // title32px,24px artwork in44pxhit,2pxdivider/full49pxshadow.
        let top = max(0,world.safeAreaInsets.top + 844 * 0.02 - 16)
        let geometry = world.headerGeometrySnapshot()
        let header = try XCTUnwrap(geometry["header"]),title = try XCTUnwrap(geometry["title"])
        let target = try XCTUnwrap(geometry["backTarget"]),artwork = try XCTUnwrap(geometry["backArtwork"])
        let divider = try XCTUnwrap(geometry["divider"]),shadow = try XCTUnwrap(geometry["shadow"])
        XCTAssertEqual(header.minY,0,accuracy:0.001);XCTAssertEqual(header.height,top+58,accuracy:0.001)
        XCTAssertEqual(title.minY,top+10,accuracy:0.001);XCTAssertEqual(title.height,32,accuracy:0.001)
        XCTAssertEqual(target.minX,22,accuracy:0.001);XCTAssertEqual(target.minY,top+2,accuracy:0.001)
        XCTAssertEqual(target.width,44,accuracy:0.001);XCTAssertEqual(target.height,44,accuracy:0.001)
        XCTAssertEqual(artwork.minX,32,accuracy:0.001);XCTAssertEqual(artwork.minY,top+12,accuracy:0.001)
        XCTAssertEqual(artwork.width,24,accuracy:0.001);XCTAssertEqual(artwork.height,24,accuracy:0.001)
        XCTAssertEqual(divider,CGRect(x:24,y:top+56,width:342,height:2))
        XCTAssertEqual(shadow,CGRect(x:0,y:top+58,width:390,height:49))
    }

    private func rotatedInterimCard() -> (UIView,UIView) {
        let parent = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        let card = UIView(frame:CGRect(x:30,y:200,width:90,height:133))
        parent.addSubview(card);card.transform = CGAffineTransform(rotationAngle:-4 * .pi / 180)
        return (parent,card)
    }
    private func requireRect(_ actual:CGRect,_ expected:CGRect,file:StaticString = #filePath,line:UInt = #line) {
        XCTAssertEqual(actual.minX,expected.minX,accuracy:0.0001,file:file,line:line)
        XCTAssertEqual(actual.minY,expected.minY,accuracy:0.0001,file:file,line:line)
        XCTAssertEqual(actual.width,expected.width,accuracy:0.0001,file:file,line:line)
        XCTAssertEqual(actual.height,expected.height,accuracy:0.0001,file:file,line:line)
    }
    func testRepeatedInterimEffectPreservesRotatedCardGeometryAcrossTwentyStarts() {
        let (parent,card) = rotatedInterimCard()
        let frame = card.frame,bounds = card.bounds,position = card.layer.position,anchor = card.layer.anchorPoint,transform = card.layer.transform
        let effect = JimiNativeInterimEffect(card:card,scale:1)
        for _ in 0..<20 {
            effect.start();requireRect(card.frame,frame);XCTAssertEqual(card.bounds,bounds)
            effect.stop();requireRect(card.frame,frame)
            XCTAssertEqual(card.bounds,bounds);XCTAssertEqual(card.layer.position,position);XCTAssertEqual(card.layer.anchorPoint,anchor)
            XCTAssertTrue(CATransform3DEqualToTransform(card.layer.transform,transform))
            XCTAssertNil(card.layer.animation(forKey:"world.interim"))
        }
        XCTAssertTrue(card.superview === parent)
    }
    func testInterimBurnAndFaceGlowAreFiniteClippedAndCancellationSafe() async throws {
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller = UIViewController()
        window.rootViewController = controller;window.makeKeyAndVisible()
        defer {window.isHidden = true}
        let parent = controller.view!
        let card = UIImageView(frame:CGRect(x:30,y:200,width:90,height:133))
        card.image = UIGraphicsImageRenderer(size:card.bounds.size).image { context in
            UIColor.orange.setFill();context.fill(card.bounds)
        }
        parent.addSubview(card);card.transform = CGAffineTransform(rotationAngle:-4 * .pi/180)
        let frame = card.frame,position = card.layer.position,transform = card.layer.transform
        let owner = JimiNativeInterimEffect(card:card,scale:1)
        for _ in 0..<5 {
            let before = CACurrentMediaTime();owner.start();let after = CACurrentMediaTime()
            let glow = try XCTUnwrap(card.layer.sublayers?.first {$0.name == "world.interim.glow"})
            XCTAssertFalse(card.layer.sublayers?.contains {$0.name == "world.shimmer"} ?? false)
            let clip = try XCTUnwrap(card.layer.sublayers?.first {$0.name == "world.interim.burn.clip"})
            requireRect(clip.frame,card.bounds);XCTAssertTrue(clip.masksToBounds);XCTAssertEqual(clip.cornerRadius,12)
            let burn = try XCTUnwrap(clip.sublayers?.first {$0.name == "world.interim.burn"})
            requireRect(burn.frame,card.bounds)
            for _ in 0..<100 where owner.preparedBurnFrameCount == 0 {try await Task.sleep(nanoseconds:10_000_000)}
            XCTAssertEqual(owner.preparedBurnFrameCount,31)
            XCTAssertNotNil(glow.contents,"Face glow must contain filtered original artwork")
            XCTAssertLessThanOrEqual(owner.preparedBurnBytes,32*768*266,"Include CoreImage 64-byte row alignment within the2x cap")
            XCTAssertNil(burn.compositingFilter,"iOS must not depend on unsupported CALayer filters")
            let burnAnimation = try XCTUnwrap(burn.animation(forKey:"world.interim.burn"))
            let glowAnimation = try XCTUnwrap(glow.animation(forKey:"world.interim.glow"))
            let textures = try XCTUnwrap((burnAnimation as? CAKeyframeAnimation)?.values as? [CGImage])
            XCTAssertEqual(textures.count,31)
            XCTAssertNotEqual(textures[0].dataProvider?.data as Data?,textures[16].dataProvider?.data as Data?,"Middle burn must alter original pixels using supported screen blending")
            for animation in [burnAnimation,glowAnimation] {
                XCTAssertEqual(animation.duration,1.1/1.3,accuracy:0.0001)
                XCTAssertGreaterThanOrEqual(animation.beginTime,before+1.30)
                XCTAssertLessThanOrEqual(animation.beginTime,after+1.30)
                XCTAssertEqual(animation.repeatCount,0)
            }
            owner.stop();XCTAssertNil(clip.superlayer);XCTAssertNil(glow.superlayer)
            XCTAssertNil(clip.animationKeys());XCTAssertNil(glow.animationKeys());XCTAssertNil(burn.animationKeys());XCTAssertEqual(owner.preparedBurnBytes,0)
            requireRect(card.frame,frame);XCTAssertEqual(card.layer.position,position)
            XCTAssertTrue(CATransform3DEqualToTransform(card.layer.transform,transform))
        }
        XCTAssertTrue(card.superview === parent)
    }

    func testReturnLandingBouncesOnlyCardAndShowsFiniteSmokeAboveIsland() async throws {
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller = UIViewController()
        window.rootViewController = controller;window.makeKeyAndVisible()
        defer {window.isHidden = true}
        let unit = UIView(frame:CGRect(x:20,y:250,width:300,height:300)),island = UIView(frame:CGRect(x:0,y:50,width:280,height:200))
        island.backgroundColor = .brown;controller.view.addSubview(unit);unit.addSubview(island)
        let card = UIImageView(image:UIImage(systemName:"star.fill"));card.frame = CGRect(x:90,y:30,width:90,height:133);unit.addSubview(card)
        card.transform = CGAffineTransform(rotationAngle:-4 * .pi/180)
        let frame = card.frame,base = card.layer.transform,unitPosition = unit.layer.position
        var completed = false
        JimiNativeWorldEffects.returnLanding(card:card,in:unit,scale:1) {completed = true}
        let bounce = try XCTUnwrap(card.layer.animation(forKey:"world.card.landing") as? CAKeyframeAnimation)
        XCTAssertEqual(bounce.duration,0.79,accuracy:0.000001)
        let transforms = try XCTUnwrap(bounce.values as? [NSValue])
        XCTAssertTrue(CATransform3DEqualToTransform(transforms.first!.caTransform3DValue,base))
        XCTAssertTrue(CATransform3DEqualToTransform(transforms.last!.caTransform3DValue,base))
        XCTAssertNil(unit.layer.animationKeys());XCTAssertEqual(unit.layer.position,unitPosition)
        let smoke = try XCTUnwrap(unit.layer.sublayers?.first {$0.name == "world.smoke.feedback"})
        let siblings = try XCTUnwrap(unit.layer.sublayers)
        XCTAssertLessThan(siblings.firstIndex(of:island.layer)!,siblings.firstIndex(of:smoke)!)
        XCTAssertLessThan(siblings.firstIndex(of:smoke)!,siblings.firstIndex(of:card.layer)!)
        let bubbles = smoke.sublayers?.filter {$0.name != "world.smoke.halo"} ?? []
        XCTAssertGreaterThanOrEqual(bubbles.count,10);XCTAssertLessThanOrEqual(bubbles.count,16)
        for bubble in bubbles {
            let animation = try XCTUnwrap(bubble.animation(forKey:"world.smoke") as? CAAnimationGroup)
            let opacity = try XCTUnwrap(animation.animations?.first as? CAKeyframeAnimation)
            XCTAssertGreaterThanOrEqual(opacity.keyTimes![1].doubleValue*animation.duration,0.43)
        }
        let successor = CALayer();successor.name = "world.smoke.feedback";unit.layer.addSublayer(successor)
        XCTAssertFalse(completed);try await settle(0.9)
        XCTAssertTrue(successor.superlayer === unit.layer,"Retired landing must never clean a successor feedback lease")
        XCTAssertTrue(completed);XCTAssertNil(smoke.superlayer);XCTAssertNil(card.layer.animation(forKey:"world.card.landing"))
        requireRect(card.frame,frame);XCTAssertEqual(unit.layer.position,unitPosition)
    }

    func testInterimBurnPreparationCannotResurrectStoppedOwner() async throws {
        let card = UIImageView(frame:CGRect(x:0,y:0,width:90,height:133))
        card.image = UIGraphicsImageRenderer(size:card.bounds.size).image { context in UIColor.orange.setFill();context.fill(card.bounds) }
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller = UIViewController()
        window.rootViewController = controller;window.makeKeyAndVisible();controller.view.addSubview(card)
        defer {window.isHidden = true}
        let owner = JimiNativeInterimEffect(card:card,scale:1)
        owner.start();owner.stop()
        try await Task.sleep(nanoseconds:100_000_000)
        XCTAssertEqual(owner.preparedBurnFrameCount,0);XCTAssertEqual(owner.preparedBurnBytes,0)
        XCTAssertFalse(card.layer.sublayers?.contains {$0.name?.hasPrefix("world.interim") == true} ?? false)
    }

    func testRecreatedInterimOwnersPreserveOriginalGeometryAcrossTenReturns() {
        let (parent,card) = rotatedInterimCard()
        let frame = card.frame,bounds = card.bounds,position = card.layer.position,anchor = card.layer.anchorPoint,transform = card.layer.transform
        for _ in 0..<10 {
            let effect = JimiNativeInterimEffect(card:card,scale:1)
            effect.start();requireRect(card.frame,frame);XCTAssertEqual(card.bounds,bounds)
            effect.stop();effect.stop()
            requireRect(card.frame,frame);XCTAssertEqual(card.bounds,bounds)
            XCTAssertEqual(card.layer.position,position);XCTAssertEqual(card.layer.anchorPoint,anchor)
            XCTAssertTrue(CATransform3DEqualToTransform(card.layer.transform,transform))
        }
        XCTAssertTrue(card.superview === parent)
    }

    private func renderOriginalRegularCardFixture(rarity:String,path:String) async throws {
        var projection = fixture(),units = fixture()["units"] as! [[String:Any]]
        units[0]["frame"] = ["x":30,"y":400,"width":90,"height":133]
        units[0]["cardArt"] = path;units[0]["cardRarity"] = rarity;units[0]["stars"] = 2
        units[0]["stats"] = [["label":"High Score","value":"1,234"],["label":"Longest Combo","value":"12"]]
        units[0]["parts"] = [["asset":path,"role":"card","x":0,"y":0,"width":90,"height":133,"rotation":-4,"opacity":1,"zIndex":8]]
        projection["units"] = units
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:projection,assets:art))
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller = UIViewController()
        window.rootViewController = controller;window.makeKeyAndVisible()
        world.frame = controller.view.bounds;world.autoresizingMask = [.flexibleWidth,.flexibleHeight];controller.view.addSubview(world)
        defer {world.cleanup();window.isHidden = true}
        let prepared = expectation(description:"Original original-art fixture decoded")
        world.prepare {prepared.fulfill()};await fulfillment(of:[prepared],timeout:5)
        let entered = expectation(description:"Actual World fixture entered")
        world.enter {entered.fulfill()};await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        var actions:[String] = [];world.onRequest = {action,_ in actions.append(action)}
        world.openCard(boardID:1);try await settle(1.3)
        let modal = try XCTUnwrap(descendant(world,"native.world.card.modal"))
        let play = try XCTUnwrap(descendant(modal,"native.world.card.play") as? UIButton)
        let close = try XCTUnwrap(descendant(modal,"native.world.card.close") as? UIButton)
        XCTAssertEqual(play.title(for:.normal),"Play");XCTAssertTrue(play.isEnabled)
        XCTAssertTrue(world.hasActiveCard)
        func allLabels(_ root:UIView) -> [UILabel] {(root as? UILabel).map{[$0]} ?? root.subviews.flatMap(allLabels)}
        let labels = allLabels(modal)
        for text in ["Forest 01","1,234","12","High score","Longest combo"] {
            let label = try XCTUnwrap(labels.first {$0.text == text})
            XCTAssertGreaterThan(label.bounds.width,0);XCTAssertGreaterThan(label.bounds.height,0)
            XCTAssertGreaterThanOrEqual(label.bounds.width,label.intrinsicContentSize.width,"Critical card text must fit its original UIKit row")
            let rect = label.convert(label.bounds,to:world)
            XCTAssertTrue(world.bounds.insetBy(dx:-1,dy:-1).contains(rect),"Critical title/stats must remain in the visible viewport")
        }
        for control in [play,close] {
            let rect = control.convert(control.bounds,to:world)
            XCTAssertTrue(world.bounds.insetBy(dx:-1,dy:-1).contains(rect),"Card controls must stay within viewport")
        }
        let screenshot = UIGraphicsImageRenderer(bounds:world.bounds).image { _ in world.drawHierarchy(in:world.bounds,afterScreenUpdates:true) }
        let attachment = XCTAttachment(image:screenshot);attachment.name = "rendering-fixture-only-forest-\(rarity)-original-card-back";attachment.lifetime = .keepAlways;add(attachment)
        play.sendActions(for:.touchUpInside);XCTAssertEqual(actions,["play"],"Fixture emits semantic action, never starts real gameplay")
        close.sendActions(for:.touchUpInside);XCTAssertEqual(actions,["play","close"])
        let closed = expectation(description:"Actual card return fixture landed")
        world.closeCard {closed.fulfill()};await fulfillment(of:[closed],timeout:5)
        XCTAssertFalse(world.hasActiveCard)
    }
    func testRenderingFixtureCommonOriginalCardBackStatsAndControls() async throws {
        try await renderOriginalRegularCardFixture(rarity:"common",path:"assets/colelctibles/Forest/common/01.png")
    }
    func testRenderingFixtureLegendaryOriginalCardBackStatsAndControls() async throws {
        try await renderOriginalRegularCardFixture(rarity:"legendary",path:"assets/colelctibles/Forest/legendary/01-gold.png")
    }
    func testBeeCanonicalFrameProjectionAndFiniteVisibleOwner() async throws {
        func frame(_ time:Double,_ x:Double,_ depth:String,_ asset:String,_ previous:String? = nil)->[String:Any] {
            var result:[String:Any] = ["time":time,"x":x,"y":80.0,"width":40.0,"scaleX":1.12,"scaleY":0.91,"rotation":15.0,"blend":0.7,"asset":asset,"depth":depth]
            if let previous {result["previousAsset"] = previous};return result
        }
        let raw:[String:Any] = ["id":0,"duration":11.0,"frames":[frame(0,20,"front","./assets/shop/honey/bee1.png"),frame(11,50,"behind","./assets/shop/honey/bee3.png","./assets/shop/honey/bee1.png")]]
        let plan = try XCTUnwrap(JimiNativeWorldBees.Plan.parse(raw))
        XCTAssertEqual(plan.frames.last!.x,50);XCTAssertEqual(plan.frames.last!.rotation,.pi/12,accuracy:0.0001)
        var malformed = raw;malformed["frames"] = [frame(0,20,"front","../bee1.png"),frame(11,50,"front","../bee1.png")]
        XCTAssertNil(JimiNativeWorldBees.Plan.parse(malformed))
        malformed = raw;malformed["duration"] = Double.nan
        XCTAssertNil(JimiNativeWorldBees.Plan.parse(malformed))
        var invalidFrame = frame(0,20,"front","./assets/shop/honey/bee1.png");invalidFrame["rotation"] = Double.infinity
        malformed = raw;malformed["frames"] = [invalidFrame,frame(11,50,"front","./assets/shop/honey/bee1.png")]
        XCTAssertNil(JimiNativeWorldBees.Plan.parse(malformed))
        invalidFrame = frame(0,20,"front","./assets/shop/honey/bee1.png");invalidFrame["previousAsset"] = 7
        malformed["frames"] = [invalidFrame,frame(11,50,"front","./assets/shop/honey/bee1.png")]
        XCTAssertNil(JimiNativeWorldBees.Plan.parse(malformed))
        XCTAssertEqual(Set(plan.assets),Set(["./assets/shop/honey/bee1.png","./assets/shop/honey/bee3.png"]))
        XCTAssertEqual(plan.visualBounds.maxX,130,accuracy:0.001)

        let resources = JimiNativeWorldResources(root:root)
        let content = UIView(frame:CGRect(x:0,y:0,width:390,height:844)),main = UIView(frame:CGRect(x:0,y:0,width:390,height:300))
        content.addSubview(main)
        let helper = JimiNativeWorldBees(plans:[plan],content:content,main:main,resources:resources)
        let prepared = expectation(description:"Only visible bee original art prepared")
        helper.prepareVisible(viewport:content.bounds,scale:1) {accepted in XCTAssertTrue(accepted);prepared.fulfill()}
        await fulfillment(of:[prepared],timeout:5)
        helper.update(enabled:true,viewport:content.bounds,scale:1)
        let started = expectation(description:"Finite native compositor starts")
        DispatchQueue.main.asyncAfter(deadline:.now()+0.1) {started.fulfill()}
        await fulfillment(of:[started],timeout:2)
        XCTAssertEqual(helper.activeCount,1);XCTAssertEqual(helper.layerCount,4)
        let layer = try XCTUnwrap(content.layer.sublayers?.first {$0.name == "world.bee.0.0"})
        let flight = try XCTUnwrap(layer.animation(forKey:"world.bee.flight") as? CAAnimationGroup)
        XCTAssertEqual(flight.duration,11);XCTAssertEqual(flight.repeatCount,0)
        let motion = try XCTUnwrap(flight.animations?.first as? CAKeyframeAnimation)
        let first = try XCTUnwrap(motion.values?.first as? NSValue).caTransform3DValue
        XCTAssertEqual(first.m41,40,accuracy:0.001);XCTAssertEqual(first.m42,100,accuracy:0.001)
        var reply:(([[String:Any]]?)->Void)?
        helper.onRequest = {_,callback in reply = callback}
        flight.delegate?.animationDidStop?(flight,finished:true)
        XCTAssertNotNil(reply)
        helper.update(enabled:false,viewport:content.bounds,scale:1)
        var renewal = raw;renewal["frames"] = [frame(0,120,"front","./assets/shop/honey/bee1.png"),frame(11,150,"behind","./assets/shop/honey/bee3.png","./assets/shop/honey/bee1.png")]
        reply?([renewal]);XCTAssertEqual(helper.layerCount,0);XCTAssertEqual(helper.activeCount,0)
        helper.update(enabled:true,viewport:content.bounds,scale:1)
        let resumed = expectation(description:"Paused advanced chunk replays instead of skipping")
        DispatchQueue.main.asyncAfter(deadline:.now()+0.1) {resumed.fulfill()}
        await fulfillment(of:[resumed],timeout:2)
        let resumedFlight = try XCTUnwrap(layer.animation(forKey:"world.bee.flight") as? CAAnimationGroup)
        let resumedMotion = try XCTUnwrap(resumedFlight.animations?.first as? CAKeyframeAnimation)
        XCTAssertEqual((resumedMotion.values!.first as! NSValue).caTransform3DValue.m41,140,accuracy:0.001)
        // Logical session replacement retires any earlier in-flight reply.
        resumedFlight.delegate?.animationDidStop?(resumedFlight,finished:true)
        let obsolete = reply
        helper.replacePlans([plan]);obsolete?([renewal]);XCTAssertEqual(helper.layerCount,0)
        helper.update(enabled:true,viewport:content.bounds,scale:1)
        let replaced = expectation(description:"Fresh canonical session restarts original projected endpoint")
        DispatchQueue.main.asyncAfter(deadline:.now()+0.1) {replaced.fulfill()}
        await fulfillment(of:[replaced],timeout:2)
        let freshLayer = try XCTUnwrap(content.layer.sublayers?.first {$0.name == "world.bee.0.0"})
        let freshFlight = try XCTUnwrap(freshLayer.animation(forKey:"world.bee.flight") as? CAAnimationGroup)
        let freshMotion = try XCTUnwrap(freshFlight.animations?.first as? CAKeyframeAnimation)
        XCTAssertEqual((freshMotion.values!.first as! NSValue).caTransform3DValue.m41,40,accuracy:0.001)
        helper.exit()
        XCTAssertEqual(freshLayer.animation(forKey:"world.bee.exit")?.duration,0.22)
        helper.update(enabled:false,viewport:content.bounds,scale:1)
        XCTAssertEqual(helper.activeCount,0);XCTAssertEqual(helper.layerCount,0)
        helper.cleanup();resources.cleanup()
    }

    func testWorldBackStartsMainFirstWithoutChangingAuthoredExitDuration() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else {throw XCTSkip("Full authored exit timing requires standard motion")}
        var snapshot = fixture()
        snapshot["mainParts"] = [["asset":"assets/close-icon.png","role":"hero","x":0,"y":0,"width":200,"height":200,"rotation":0,"opacity":1,"zIndex":3]]
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:snapshot,assets:art))
        world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
        defer {world.cleanup()}
        let ready = expectation(description:"Original main leaf prepared")
        world.prepare {ready.fulfill()};await fulfillment(of:[ready],timeout:5)
        world.exit {}
        let hero = try XCTUnwrap(descendant(world,"native.world.part.0.hero"))
        let mainExit = try XCTUnwrap(hero.layer.animation(forKey:"world.exit") as? CAAnimationGroup)
        let lastBoard = try XCTUnwrap(descendant(world,"native.world.card.2"))
        let firstBoard = try XCTUnwrap(descendant(world,"native.world.card.1"))
        let lastExit = try XCTUnwrap(lastBoard.layer.animation(forKey:"world.exit") as? CAAnimationGroup)
        let firstExit = try XCTUnwrap(firstBoard.layer.animation(forKey:"world.exit") as? CAAnimationGroup)
        XCTAssertEqual(mainExit.duration,0.6708,accuracy:0.0001)
        XCTAssertEqual(lastExit.duration,0.48,accuracy:0.0001)
        XCTAssertEqual(lastExit.beginTime-mainExit.beginTime,0.03,accuracy:0.008)
        XCTAssertEqual(firstExit.beginTime-lastExit.beginTime,0.03,accuracy:0.008)
        XCTAssertGreaterThan(mainExit.beginTime+mainExit.duration,firstExit.beginTime+firstExit.duration)
    }

    func testSelectedWorldSnapshotRejectsForeignBoardsAndForestBees() throws {
        for worldID in [2,3] {
            var value = fixture();value["worldID"] = worldID;value["title"] = worldID == 2 ? "Beach" : "Area 55"
            XCTAssertNil(JimiNativeWorldSnapshot(value), "Forest IDs cannot enter another World's snapshot")
            var units = try XCTUnwrap(value["units"] as? [[String:Any]])
            for index in units.indices {let id = (worldID-1)*10+index+1;units[index]["boardID"] = id;units[index]["id"] = "board-\(id)"}
            value["units"] = units
            let model = try XCTUnwrap(JimiNativeWorldSnapshot(value));XCTAssertEqual(model.worldID,worldID)
            XCTAssertTrue(model.beePlans.isEmpty)
            value["worldID"] = 4;XCTAssertNil(JimiNativeWorldSnapshot(value))
        }
    }

    func testBeachArea55ShareInputScrollModalAndParkLifecycle() async throws {
        for worldID in [2,3] {
            var value = fixture();value["worldID"] = worldID;value["title"] = worldID == 2 ? "Beach" : "Area 55"
            var units = try XCTUnwrap(value["units"] as? [[String:Any]])
            let first = (worldID-1)*10+1
            for index in units.indices {units[index]["boardID"] = first+index;units[index]["id"] = "board-\(first+index)"}
            value["units"] = units
            let world = try XCTUnwrap(JimiNativeWorldView(snapshot:value,assets:art));world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
            var requests:[Int] = [];world.onRequest = {_,id in if let id {requests.append(id)}}
            let entered = expectation(description:"World \(worldID) actual enter")
            world.enter {entered.fulfill()};await fulfillment(of:[entered],timeout:5)
            XCTAssertFalse(world.isReadyForInput);world.finishPresentationAdmission()
            let card = try XCTUnwrap(descendant(world,"native.world.card.\(first)") as? UIButton)
            card.sendActions(for:.touchUpInside);XCTAssertEqual(requests,[first])
            let locked = try XCTUnwrap(descendant(world,"native.world.card.\(first+1)") as? UIButton);locked.sendActions(for:.touchUpInside);XCTAssertEqual(requests,[first])
            world.scrollView.contentOffset = CGPoint(x:0,y:80);world.park();XCTAssertFalse(world.isReadyForInput)
            XCTAssertEqual(world.scrollView.contentOffset.y,80);card.sendActions(for:.touchUpInside);XCTAssertEqual(requests,[first])
            world.cleanup();world.cleanup();XCTAssertFalse(world.isReadyForInput)
        }
    }

    func testArea55BeamSequenceBoundsAndVisibilityCleanup() async throws {
        let sequence:[String:Any] = ["points":[["time":0.0,"opacity":0.5],["time":1.0,"opacity":0.6],["time":2.0,"opacity":0.5]],"duration":2.0,"phase":0.5]
        XCTAssertNotNil(JimiNativeWorldSnapshot.BeamIdle(sequence))
        var invalid = sequence;invalid["duration"] = Double.nan;XCTAssertNil(JimiNativeWorldSnapshot.BeamIdle(invalid))
        invalid = sequence;invalid["points"] = [["time":0.0,"opacity":0.5],["time":2.0,"opacity":1.1]];XCTAssertNil(JimiNativeWorldSnapshot.BeamIdle(invalid))
        var value = fixture();value["worldID"] = 3;value["title"] = "Area 55"
        var units = try XCTUnwrap(value["units"] as? [[String:Any]])
        for index in units.indices {
            units[index]["boardID"] = 21+index;units[index]["id"] = "board-\(21+index)"
            units[index]["parts"] = [["asset":"assets/close-icon.png","role":"beam","x":20,"y":10,"width":54,"height":100,"rotation":0,"opacity":1,"zIndex":5,"beamIdle":sequence]]
        }
        value["units"] = units
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:value,assets:art));world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
        let prepared = expectation(description:"Beam resource ready");world.prepare {prepared.fulfill()};await fulfillment(of:[prepared],timeout:5)
        let entered = expectation(description:"Beam Unit enter");world.enter {entered.fulfill()};await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        let beam = try XCTUnwrap(descendant(world,"native.world.part.21.beam"));XCTAssertNotNil(beam.layer.animation(forKey:"world.idle.beam"))
        world.setActive(false);XCTAssertNil(beam.layer.animation(forKey:"world.idle.beam"))
        world.setActive(true);XCTAssertNotNil(beam.layer.animation(forKey:"world.idle.beam"))
        world.park();XCTAssertNil(beam.layer.animation(forKey:"world.idle.beam"));world.cleanup();world.cleanup()
    }

    func testReturnKeepsCloseOnPhysicalBackAndRejectsInputUntilLanding() async throws {
        for interruptManualFlip in [false,true] {
            let resources = JimiNativeWorldResources(root:root)
            let unit = try XCTUnwrap(JimiNativeWorldSnapshot(fixture())).units[0]
            let card = JimiNativeWorldCardView(unit:unit,assets:art,resources:resources)
            card.frame = CGRect(x:0,y:0,width:390,height:844)
            let host = UIView(frame:card.frame);host.addSubview(card)
            card.enter(from:CGRect(x:30,y:400,width:90,height:120));try await settle(0.65)
            let close = try XCTUnwrap(descendant(card,"native.world.card.close") as? UIButton)
            let back = try XCTUnwrap(close.superview)
            XCTAssertFalse(back.layer.isDoubleSided)
            if interruptManualFlip {card.tapToFlip();try await settle(0.04)}
            var unexpectedInput = 0;card.onRequest = {_ in unexpectedInput += 1}
            let landed = expectation(description:"Physical return completes with attached close")
            card.close(to:CGRect(x:30,y:400,width:90,height:120)) {
                XCTAssertTrue(close.superview === back)
                XCTAssertFalse(close.isHidden)
                XCTAssertFalse(close.isEnabled)
                landed.fulfill()
            }
            XCTAssertTrue(close.superview === back)
            XCTAssertFalse(close.isHidden,"X must travel with the back rather than disappear on frame zero")
            XCTAssertFalse(close.isEnabled)
            let rotor = try XCTUnwrap(descendant(card,"native.world.card.rotor"))
            XCTAssertNotNil(rotor.layer.animation(forKey:"card.flip"))
            close.sendActions(for:.touchUpInside);XCTAssertEqual(unexpectedInput,0)
            await fulfillment(of:[landed],timeout:3)
            card.cleanup();card.removeFromSuperview();close.sendActions(for:.touchUpInside)
            XCTAssertEqual(unexpectedInput,0);XCTAssertNil(card.superview)
            resources.cleanup()
        }
    }

    func testAmbientProjectionPauseLateRenewAndCleanupReleaseLayers() async throws {
        let asset = "./assets/shop/bottle/bottle animation pack/bubble1.png"
        let raw:[String:Any] = ["id":0,"worldID":2,"duration":1.0,"frames":[
            ["time":0.0,"x":50.0,"y":300.0,"width":40.0,"height":40.0,"rotation":0.0,"opacity":0.4,"asset":asset,"depth":"behind"],
            ["time":1.0,"x":80.0,"y":50.0,"width":40.0,"height":40.0,"rotation":0.0,"opacity":0.0,"asset":asset,"depth":"front"]]]
        let plan = try XCTUnwrap(JimiNativeWorldAmbient.Plan.parse(raw,worldID:2))
        XCTAssertNil(JimiNativeWorldAmbient.Plan.parse(raw,worldID:3))
        var invalid = raw;invalid["id"] = 8;XCTAssertNil(JimiNativeWorldAmbient.Plan.parse(invalid,worldID:2))
        let content = UIView(frame:CGRect(x:0,y:0,width:390,height:844)),resources = JimiNativeWorldResources(root:root)
        let helper = JimiNativeWorldAmbient(plans:[plan],content:content,resources:resources)
        let prepared = expectation(description:"Original bubble ready");helper.prepareVisible(viewport:content.bounds,scale:1) {ok in XCTAssertTrue(ok);prepared.fulfill()};await fulfillment(of:[prepared],timeout:5)
        helper.update(enabled:true,viewport:content.bounds,scale:1);try await settle(0.1)
        XCTAssertEqual(helper.activeCount,1);XCTAssertEqual(helper.layerCount,2)
        let front = try XCTUnwrap(content.layer.sublayers?.first {$0.name == "world.ambient.2.0.0"})
        XCTAssertEqual(front.zPosition,7)
        let flight = try XCTUnwrap(front.animation(forKey:"world.ambient.flight") as? CAAnimationGroup);XCTAssertEqual(flight.repeatCount,0)
        var reply:(([[String:Any]]?)->Void)?
        helper.onRequest = {viewport,ids,callback in XCTAssertEqual(ids,[0]);XCTAssertEqual(viewport.height,844);reply = callback}
        flight.delegate?.animationDidStop?(flight,finished:true);XCTAssertNotNil(reply)
        helper.update(enabled:false,viewport:content.bounds,scale:1);reply?([raw]);XCTAssertEqual(helper.layerCount,0);XCTAssertEqual(helper.activeCount,0)
        helper.update(enabled:true,viewport:content.bounds,scale:1);try await settle(0.1);XCTAssertEqual(helper.activeCount,1)
        let renewed = try XCTUnwrap(front.animation(forKey:"world.ambient.flight") as? CAAnimationGroup)
        renewed.delegate?.animationDidStop?(renewed,finished:true);let late = reply
        helper.cleanup();helper.cleanup();late?([raw]);try await settle(0.1)
        XCTAssertEqual(helper.layerCount,0);XCTAssertEqual(helper.activeCount,0);XCTAssertEqual(resources.decodedBytes,0);resources.cleanup()
    }

    func testWorldDepthPlanesPreserveCompleteUnitMotionAndParkedHiddenReturnPose() async throws {
        var value = fixture();value["worldID"] = 3;value["title"] = "Area 55"
        var units = try XCTUnwrap(value["units"] as? [[String:Any]])
        for index in units.indices {
            units[index]["boardID"] = 21+index;units[index]["id"] = "board-\(21+index)"
            var parts = try XCTUnwrap(units[index]["parts"] as? [[String:Any]])
            parts.append(["asset":"assets/close-icon.png","role":"island","x":-40,"y":30,"width":200,"height":200,"rotation":0,"opacity":1,"zIndex":2]);units[index]["parts"] = parts
        }
        value["units"] = units
        let world = try XCTUnwrap(JimiNativeWorldView(snapshot:value,assets:art));world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
        let ready = expectation(description:"Unit planes prepared");world.prepare {ready.fulfill()};await fulfillment(of:[ready],timeout:5)
        let button = try XCTUnwrap(descendant(world,"native.world.card.21"))
        let card = try XCTUnwrap(descendant(world,"native.world.part.21.card"))
        let island = try XCTUnwrap(descendant(world,"native.world.part.21.island")),terrain = try XCTUnwrap(island.superview)
        XCTAssertTrue(card.superview === button);XCTAssertFalse(terrain === button);XCTAssertEqual(button.layer.zPosition,8);XCTAssertEqual(terrain.layer.zPosition,2)
        let entered = expectation(description:"Complete Unit enters");world.enter {entered.fulfill()}
        let buttonEnter = try XCTUnwrap(button.layer.animation(forKey:"world.enter") as? CAAnimationGroup),terrainEnter = try XCTUnwrap(terrain.layer.animation(forKey:"world.enter") as? CAAnimationGroup)
        XCTAssertEqual(buttonEnter.duration,terrainEnter.duration);XCTAssertEqual(buttonEnter.beginTime,terrainEnter.beginTime,accuracy:0.01)
        await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        let unitIdle = try XCTUnwrap(button.layer.animation(forKey:"world.idle.y")),terrainIdle = try XCTUnwrap(terrain.layer.animation(forKey:"world.idle.y"));XCTAssertEqual(unitIdle.beginTime,terrainIdle.beginTime)
        world.park();XCTAssertNil(terrain.layer.animationKeys());XCTAssertTrue(world.primeHiddenReturnPose());XCTAssertNotNil(terrain.layer.animation(forKey:"world.return.prime"))
        world.cancelHiddenReturnPose();XCTAssertNil(terrain.layer.animation(forKey:"world.return.prime"));world.cleanup();world.cleanup();XCTAssertNil(terrain.superview)
    }

    func testTerminalReminderClearsEveryUnitAndCancelsBackToItsSourceInAllWorlds() async throws {
        for worldID in 1...3 {
            var value = fixture()
            value["worldID"] = worldID
            let boardID = (worldID-1)*10+1
            value["returnBoardID"] = boardID
            var projected = try XCTUnwrap(value["units"] as? [[String:Any]])
            for index in projected.indices {
                projected[index]["boardID"] = boardID+index;projected[index]["id"] = "board-\(boardID+index)"
                var parts = try XCTUnwrap(projected[index]["parts"] as? [[String:Any]])
                parts[0]["zIndex"] = 8
                parts.append(["asset":"assets/close-icon.png","role":"island","x":0,"y":30,"width":200,"height":200,"rotation":0,"opacity":1,"zIndex":2])
                projected[index]["parts"] = parts
            }
            value["units"] = projected
            let world = try XCTUnwrap(JimiNativeWorldView(snapshot:value,assets:art))
            let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller = UIViewController()
            window.rootViewController = controller;window.makeKeyAndVisible();controller.view.addSubview(world)
            defer {world.cleanup();window.isHidden = true}
            world.frame = CGRect(x:0,y:0,width:390,height:844);world.layoutIfNeeded()
            let ready = expectation(description:"Terminal return source decoded")
            world.prepare {ready.fulfill()};await fulfillment(of:[ready],timeout:5)
            world.scrollView.contentOffset.y = 60
            let entered = expectation(description:"Terminal return enters")
            world.enter(terminal:true) {entered.fulfill()};await fulfillment(of:[entered],timeout:5)
            let source = try XCTUnwrap(descendant(world,"native.world.part.\(boardID).card"))
            let unit = try XCTUnwrap(source.superview)
            let effect = try XCTUnwrap(descendant(world,"native.world.return-reminder"))
            let content = try XCTUnwrap(unit.superview)
            let carrier = try XCTUnwrap(effect.superview)
            XCTAssertTrue(carrier.superview === content,"Travelling face cannot stay behind an adjacent Unit parent")
            for sibling in content.subviews where sibling !== carrier {XCTAssertGreaterThan(carrier.layer.zPosition,sibling.layer.zPosition)}
            let sourceRect = CGRect(x:source.center.x-source.bounds.width/2,y:source.center.y-source.bounds.height/2,width:source.bounds.width,height:source.bounds.height)
            requireRect(carrier.frame,unit.convert(sourceRect,to:content))
            world.finishPresentationAdmission()
            let unitWave = try XCTUnwrap(unit.layer.animation(forKey:"world.idle.y"))
            let carrierWave = try XCTUnwrap(carrier.layer.animation(forKey:"world.idle.y"))
            XCTAssertEqual(unitWave.beginTime,carrierWave.beginTime)
            XCTAssertEqual(unitWave.duration,carrierWave.duration)
            let onset = try XCTUnwrap(unit.layer.animation(forKey:"world.idle.y.onset"))
            XCTAssertEqual(onset.beginTime,carrier.layer.animation(forKey:"world.idle.y.onset")?.beginTime)
            // Repeated admission/scroll updates must preserve the Unit clock.
            world.finishPresentationAdmission()
            XCTAssertEqual(unitWave.beginTime,unit.layer.animation(forKey:"world.idle.y")?.beginTime)
            XCTAssertTrue(source.isHidden);XCTAssertNotNil(effect.layer.animation(forKey:"world.reminder"))
            if worldID == 1 {
                let completed = expectation(description:"Reminder finishes without restarting Unit idle")
                DispatchQueue.main.asyncAfter(deadline:.now()+1.7) {completed.fulfill()}
                await fulfillment(of:[completed],timeout:3)
                XCTAssertNil(descendant(world,"native.world.return-reminder"))
                XCTAssertFalse(source.isHidden)
                XCTAssertNil(carrier.superview)
                XCTAssertEqual(unitWave.beginTime,unit.layer.animation(forKey:"world.idle.y")?.beginTime)
            }
            world.park()
            XCTAssertNil(effect.superview);XCTAssertNil(effect.layer.animationKeys());XCTAssertNil(carrier.superview);XCTAssertNil(carrier.layer.animationKeys());XCTAssertFalse(source.isHidden)
            XCTAssertNil(descendant(world,"native.world.return-reminder"))
            world.cleanup();world.cleanup()
        }
    }

}
