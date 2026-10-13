import XCTest

/// Explicit physical diagnostic against the installed Native candidate.
/// No launch/reset arguments, fixture profile, save injection, or app termination.
@MainActor final class NativePhysicalDragProbeUITests:XCTestCase {
    private let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
    private func item(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}
    private func receipt(_ name:String,screenshot:Bool=false) {
        let tree=XCTAttachment(string:app.debugDescription)
        tree.name=name+"-accessibility";tree.lifetime = .keepAlways;add(tree)
        if screenshot {
            let image=XCTAttachment(screenshot:app.screenshot())
            image.name=name;image.lifetime = .keepAlways;add(image)
        }
    }
    func testOptInBackgroundInstalledNativeAfterCapture()throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("Physical capture completion only")
        #else
        guard ProcessInfo.processInfo.environment["CC_NATIVE_PHYSICAL_DRAG_PROBE"]=="1" else {
            throw XCTSkip("Physical capture completion is explicitly opt-in")
        }
        guard app.state == .runningForeground else {throw XCTSkip("Do not launch an app to finish a capture")}
        // Let the existing application background/save owner commit the current
        // run before the coordinator closes its console transport.
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for:.runningBackground,timeout:10) || app.state == .runningBackgroundSuspended)
        #endif
    }
    func testOptInInspectInstalledNativeWithoutTouchingBoard()throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("Physical Native inspection only")
        #else
        guard ProcessInfo.processInfo.environment["CC_NATIVE_PHYSICAL_DRAG_PROBE"]=="1" else {throw XCTSkip("Physical inspection is explicitly opt-in")}
        app.launchArguments=[];app.launchEnvironment=[:]
        app.activate() // Normal activation, including a normal launch if stopped.
        receipt("native-drag-probe-inspect",screenshot:true)
        print("[CC_NATIVE_PHYSICAL_DRAG_PROBE] inspect state=\(app.state.rawValue) board=\(item("native-gameplay-board").exists)")
        #endif
    }
    func testOptInPhysicalSameTileDragWithoutRestartingInstalledGame()throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("This opt-in probe requires the physical Native candidate")
        #else
        let environment=ProcessInfo.processInfo.environment
        guard environment["CC_NATIVE_PHYSICAL_DRAG_PROBE"]=="1" else {throw XCTSkip("Physical drag probe is explicitly opt-in")}
        continueAfterFailure=false
        app.launchArguments=[];app.launchEnvironment=[:]
        if app.state != .runningForeground {app.activate()}
        receipt("native-drag-probe-entry",screenshot:true)
        defer {receipt("native-drag-probe-exit",screenshot:true)}
        let board=item("native-gameplay-board")
        guard board.waitForExistence(timeout:10),board.isHittable else {
            throw XCTSkip("Actual gameplay board must exist and be hittable before any drag")
        }
        guard !item("native.tutorial.sheet").exists else {throw XCTSkip("Do not change tutorial progress with this probe")}
        XCTAssertEqual(app.webViews.count,0)
        let frame=board.frame
        guard abs(frame.width-390)<=1,abs(frame.height-844)<=1 else {throw XCTSkip("Verified physical probe requires the actual iPhone13 board geometry")}
        // Dice have no general accessibility targets. The coordinator must
        // inspect the actual board/save and supply a verified occupied tile
        // center. Missing/unverified coordinates produce receipts, not touches.
        guard environment["CC_NATIVE_PHYSICAL_DRAG_VERIFIED_ORIGIN"]=="1",
              let encoded=environment["CC_NATIVE_PHYSICAL_DRAG_ORIGIN"] else {
            throw XCTSkip("Require verified original tile center as normalized board x,y")
        }
        let values=encoded.split(separator:",").compactMap{Double($0)}
        guard values.count==2,values.allSatisfy({$0.isFinite && $0>0 && $0<1}) else {throw XCTSkip("Invalid normalized tile center")}
        let origin=CGPoint(x:frame.minX+CGFloat(values[0])*frame.width,y:frame.minY+CGFloat(values[1])*frame.height)
        guard frame.insetBy(dx:18,dy:18).contains(origin) else {throw XCTSkip("Verified tile center must leave room inside the board")}
        let plan=XCTAttachment(string:"board=\(frame) verifiedCenter=\(origin) excursions=15pt velocity=4pt/s repeats=4; every release remains inside the original tile")
        plan.name="native-drag-probe-plan";plan.lifetime = .keepAlways;add(plan)
        let base=app.coordinate(withNormalizedOffset:.zero)
        let start=base.withOffset(CGVector(dx:origin.x,dy:origin.y))
        // Public XCTest has straight press/drag/release gestures. Four very
        // slow fifteen-point excursions keep every release within the verified
        // original tile; the existing rejected-drop owner returns it home.
        for (index,offset) in [CGVector(dx:15,dy:0),CGVector(dx:-15,dy:0),CGVector(dx:15,dy:0),CGVector(dx:-15,dy:0)].enumerated() {
            guard app.state == .runningForeground,board.exists,board.isHittable,board.frame == frame else {
                XCTFail("Board/route changed before excursion \(index); stopping further touches");return
            }
            print("[CC_NATIVE_PHYSICAL_DRAG_PROBE] excursion=\(index) board=\(frame)")
            let end=base.withOffset(CGVector(dx:origin.x+offset.dx,dy:origin.y+offset.dy))
            start.press(forDuration:0.2,thenDragTo:end,withVelocity:XCUIGestureVelocity(rawValue:4),thenHoldForDuration:0.1)
            let settled=expectation(description:"Existing same-tile return \(index)")
            DispatchQueue.main.asyncAfter(deadline:.now()+0.6){settled.fulfill()}
            wait(for:[settled],timeout:2)
        }
        XCTAssertTrue(board.exists);XCTAssertEqual(board.frame,frame)
        #endif
    }
    func testResumeVerifiedExistingJourneyRun()throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("Physical existing-run resume only")
        #else
        let environment=ProcessInfo.processInfo.environment
        guard environment["CC_NATIVE_PHYSICAL_DRAG_PROBE"]=="1",
              let boardNumber=environment["CC_NATIVE_PHYSICAL_DRAG_RESUME_BOARD"],
              ["2","24"].contains(boardNumber) else {
            throw XCTSkip("Coordinator must validate an explicitly supported actual saved Journey run before resume")
        }
        let worldNumber=boardNumber == "2" ? "1":"3"
        continueAfterFailure=false
        app.launchArguments=[];app.launchEnvironment=[:]
        if app.state != .runningForeground {app.activate()}
        receipt("native-drag-probe-resume-entry",screenshot:true)
        defer {receipt("native-drag-probe-resume-exit",screenshot:true)}
        if item("native-gameplay-board").exists {return}
        func ready(_ element:XCUIElement,_ name:String)throws {
            guard element.waitForExistence(timeout:15) else {throw XCTSkip("Expected verified \(name) is absent; stop navigation")}
            let wait=XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == true AND enabled == true"),object:element)
            guard XCTWaiter.wait(for:[wait],timeout:10) == .completed else {throw XCTSkip("Verified \(name) did not admit input")}
        }
        let journey=app.buttons["native.home.slide.0"]
        if !item("native.hub").exists,!item("native.world.\(worldNumber)").exists {
            // Native intro may still be completing after normal activation.
            // Wait without touching; retain an already-mounted Hub/World route.
            _=journey.waitForExistence(timeout:15)
        }
        if journey.exists {
            try ready(journey,"Journey Home navigation")
            if !journey.isSelected {journey.tap()}
            let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true AND hittable == true"),object:journey)
            guard XCTWaiter.wait(for:[selected],timeout:8) == .completed else {throw XCTSkip("Journey is not the actual selected Home route")}
            let cta=app.buttons["native.home.cta"]
            try ready(cta,"selected Journey CTA");cta.tap()
        }
        let world=item("native.world.\(worldNumber)")
        if !world.exists {
            let worldButton=app.buttons["native.hub.world.\(worldNumber)"]
            try ready(worldButton,"actual World\(worldNumber) button");worldButton.tap()
        }
        guard world.waitForExistence(timeout:15) else {throw XCTSkip("Verified World\(worldNumber) did not appear")}
        let card=app.buttons["native.world.card.\(boardNumber)"]
        guard card.waitForExistence(timeout:15) else {throw XCTSkip("Existing Journey\(boardNumber) card is unavailable")}
        let scroll=world.descendants(matching:.scrollView).firstMatch
        for _ in 0..<6 where !card.isHittable {
            guard scroll.exists,scroll.isHittable else {throw XCTSkip("No actual World\(worldNumber) scroll surface; stop")}
            scroll.swipeUp(velocity:.slow)
        }
        try ready(card,"existing Journey\(boardNumber) card");card.tap()
        let resume=app.buttons["native.world.card.continue"]
        // Never tap Play/Play Again or manufacture a saved-board fixture.
        try ready(resume,"existing-run Continue action");resume.tap()
        guard item("native-gameplay-board").waitForExistence(timeout:20) else {throw XCTSkip("Existing run did not mount gameplay")}
        XCTAssertEqual(app.webViews.count,0)
        #endif
    }
}
