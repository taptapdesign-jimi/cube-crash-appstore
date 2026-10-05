import XCTest

/// Copy into a TEMPORARY native project's synchronized UI-test folder only.
/// This removes explicit CUA/AX polling during motion, not XCTest's own input
/// machinery. It is a low-observer comparison, never an observer-free claim.
@MainActor
final class JimiPresentationUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.taptapdesign.stacktosix.Stack-to-Six")
    private let isolatedSimulator = "1018BE2D-491B-465F-8F75-3E5BEB38C22A"

    override func setUpWithError() throws {
        continueAfterFailure = false
        #if !targetEnvironment(simulator)
        throw XCTSkip("Jimi presentation automation is Simulator-only")
        #endif
        let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"]
        guard simulator == isolatedSimulator else {
            throw XCTSkip("Wrong or unknown Simulator; preserve the original game's incident state")
        }
    }

    private func quiet(_ seconds: TimeInterval = 2) {
        let settled = expectation(description: "No UI observation for \(seconds)s")
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { settled.fulfill() }
        wait(for: [settled], timeout: seconds + 3)
    }

    private func marker(_ text: String) {
        print("JIMI_XCUI \(Date().timeIntervalSince1970) \(text)")
    }

    /// Call only after quiet(), never between the tap and its settling interval.
    private func requireText(_ label: String) {
        XCTAssertTrue(app.staticTexts[label].exists, "Expected settled Jimi scene: \(label)")
        quiet(0.3) // Do not start the next route immediately after an AX query.
    }

    private func capture(_ name: String) {
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
        quiet(0.3)
    }

    /// Settled-only geometry assertion; never poll accessibility during motion.
    private func stageFourFrame() -> CGRect {
        let stage = app.buttons["Beach Stage 04 Progress unavailable"]
        XCTAssertTrue(stage.exists, "Stage 04 must exist; missing AX nodes cannot prove retained scroll")
        let frame = stage.frame
        XCTAssertGreaterThan(frame.width, 0)
        XCTAssertGreaterThan(frame.height, 0)
        XCTAssertTrue(frame.minY.isFinite)
        XCTAssertNotEqual(frame, .zero)
        return frame
    }

    func testLowObserverWarmRoutesAndRetainedScroll() throws {
        // Never launch/terminate here: the operator first verifies and opens the
        // isolated Jimi payload at Home. activate() only resumes that exact app.
        guard app.state != .notRunning else {
            throw XCTSkip("Activate the verified Jimi payload at Home before this test; no cold restart is permitted")
        }
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        quiet()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Presentation prototype")).firstMatch.exists,
                      "Refuse to drive the original game instead of Jimi")
        requireText("Chart your journey")
        let frame = app.frame
        XCTAssertEqual(frame.width, 390, accuracy: 1)
        XCTAssertEqual(frame.height, 844, accuracy: 1)
        let origin = app.coordinate(withNormalizedOffset: .zero)
        let homeHero = origin.withOffset(CGVector(dx: 195, dy: 355))
        let beachWorld = origin.withOffset(CGVector(dx: 132, dy: 654))
        let back = origin.withOffset(CGVector(dx: 42, dy: 67))
        let preview = origin.withOffset(CGVector(dx: 288, dy: 67))
        let dragStart = origin.withOffset(CGVector(dx: 306, dy: 689))
        let dragEnd = origin.withOffset(CGVector(dx: 306, dy: 309))
        let probeStart = origin.withOffset(CGVector(dx: 307, dy: 575))
        let probeEnd = origin.withOffset(CGVector(dx: 307, dy: 527))
        quiet(0.3)

        func cycle(_ name: String) {
            marker("\(name).home-to-hub")
            homeHero.tap()
            quiet()
            requireText("Worlds")
            marker("\(name).hub-to-beach")
            beachWorld.tap()
            quiet()
            requireText("Beach")
            marker("\(name).beach-to-hub")
            back.tap()
            quiet()
            requireText("Worlds")
            marker("\(name).hub-to-home")
            back.tap()
            quiet()
            requireText("Chart your journey")
        }

        // Normal selected routes establish warm roots without restarting the app.
        // Exclude this explicitly marked pass from the three warm comparisons.
        cycle("prime")
        for pass in 1...3 { cycle("warm-\(pass)") }
        capture("jimi-home-after-three-warm-cycles")

        marker("scroll-probe.home-to-hub")
        homeHero.tap()
        quiet()
        requireText("Worlds")
        beachWorld.tap()
        quiet()
        requireText("Beach")
        capture("jimi-beach-before-scroll")
        marker("scroll-probe.long-pan")
        // ~0.95 seconds of actual movement (380pt / 400pt/s), not a long press
        // followed by an instantaneous coordinate teleport.
        dragStart.press(forDuration: 0.05, thenDragTo: dragEnd,
                        withVelocity: 400, thenHoldForDuration: 0)
        quiet()
        capture("jimi-beach-scrolled-before-card")
        let stageBeforePreview = stageFourFrame()
        XCTAssertTrue(app.buttons["Artwork preview (not an unlock)"].exists)
        quiet(0.3)
        marker("scroll-probe.open-preview")
        preview.tap()
        quiet()
        requireText("Artwork preview — not an unlocked reward")
        back.tap()
        quiet()
        requireText("Beach")
        capture("jimi-beach-returned-from-card")
        let stageAfterReturn = stageFourFrame()
        marker("scroll-probe.stage04-y-before=\(stageBeforePreview.minY)-after=\(stageAfterReturn.minY)")
        quiet(0.3)
        // Inspect the native [JIMI_INPUT] start.scrollTop receipt for this pan,
        // compared with the previous pan's final receipts. Screenshots alone
        // and detached-node identity do not prove retained scrollTop in WebKit.
        marker("scroll-probe.post-return-small-pan")
        probeStart.press(forDuration: 0.05, thenDragTo: probeEnd,
                         withVelocity: 160, thenHoldForDuration: 0)
        quiet()
        capture("jimi-beach-after-return-input-probe")
        // Assert after the independent native start.scrollTop receipt has been
        // captured, so a regression retains both geometry and input evidence.
        XCTAssertEqual(stageAfterReturn.minY, stageBeforePreview.minY, accuracy: 2,
                       "Beach must restore its scroll position after the artwork preview")
        // A second pan places later z-indexed map cards beneath the fixed
        // header. A visible/AX-existing button alone does not prove hit testing.
        marker("deep-scroll.long-pan")
        dragStart.press(forDuration: 0.05, thenDragTo: dragEnd,
                        withVelocity: 400, thenHoldForDuration: 0)
        quiet()
        let deepStageBefore = stageFourFrame()
        capture("jimi-deep-scroll-header")
        marker("deep-scroll.open-preview")
        preview.tap()
        quiet()
        requireText("Artwork preview — not an unlocked reward")
        back.tap()
        quiet()
        requireText("Beach")
        XCTAssertEqual(stageFourFrame().minY, deepStageBefore.minY, accuracy: 2,
                       "Deep scroll must retain its position and leave header input reachable")
        capture("jimi-deep-scroll-return")
        marker("complete-needs-native-log-and-pixel-review")
    }
}
