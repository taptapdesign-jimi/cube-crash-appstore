import XCTest

/// Copy only into the isolated Simulator project's synchronized UI-test folder.
/// Functional/original-art evidence, NOT a performance test: accessibility and
/// screenshots add observation cost. Inspect the retained attachments manually.
@MainActor
final class JimiNativeHomeHubUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.taptapdesign.stacktosix.Stack-to-Six")
    private let simulatorID = "1018BE2D-491B-465F-8F75-3E5BEB38C22A"
    private var settledHeroFrames: [Int: CGRect] = [:]

    override func setUpWithError() throws {
        continueAfterFailure = false
        #if !targetEnvironment(simulator)
        throw XCTSkip("Native Home/Hub fixture is Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == simulatorID else {
            throw XCTSkip("Wrong Simulator; preserve physical devices and the original gameplay incident")
        }
        guard app.state != .notRunning else {
            throw XCTSkip("Operator must first launch the verified native Home/Hub candidate; this test never launches or terminates it")
        }
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        quiet()
        // A visible native screen is insufficient: the controller must expose
        // readiness only once its explicitly owned web bridge has acknowledged.
        let status = element("native.status")
        XCTAssertTrue(status.exists, "Refuse to drive the old web prototype or gameplay")
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "ready"), object: status)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed,
                       "Native bridge never acknowledged readiness")
        let policy = element("native.policy")
        XCTAssertTrue(policy.exists, "Candidate must expose canonical first-play policy before any route input")
        XCTAssertEqual(policy.value as? String, "journey-tutorial-complete",
                       "This route fixture requires genuinely completed first play. Stop before any tab, hero or CTA activation; use the separate real-input tutorial setup on this isolated Simulator.")
        quiet(0.3)
        requireHome(slide: 0)
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func quiet(_ seconds: TimeInterval = 2) {
        let settled = expectation(description: "No accessibility/screenshot polling during motion")
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { settled.fulfill() }
        wait(for: [settled], timeout: seconds + 3)
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        quiet(0.3)
    }

    private func requireVisibleControl(_ control: XCUIElement, allowAuthoredOverflow: Bool = false) {
        XCTAssertTrue(control.exists)
        XCTAssertTrue(control.isEnabled)
        XCTAssertTrue(control.isHittable)
        let frame = control.frame
        XCTAssertGreaterThan(frame.width, 0)
        XCTAssertGreaterThan(frame.height, 0)
        XCTAssertTrue(frame.minX.isFinite && frame.minY.isFinite)
        if allowAuthoredOverflow {
            // v9 deliberately places World artwork 2–8pt past a screen edge.
            // Require a substantial visible hit region, not zero authored bleed.
            let visible = app.frame.intersection(frame)
            XCTAssertGreaterThan(visible.width * visible.height, frame.width * frame.height * 0.5)
            XCTAssertTrue(app.frame.contains(CGPoint(x: frame.midX, y: frame.midY)))
        } else {
            XCTAssertTrue(app.frame.insetBy(dx: -1, dy: -1).contains(frame),
                          "Control is clipped/offscreen: \(control.identifier) \(frame)")
        }
    }

    private func requireHome(slide: Int) {
        XCTAssertTrue(element("native.home").exists)
        XCTAssertFalse(app.buttons["native.hub.back"].isHittable,
                       "Hidden Hub must not retain an active Back target")
        for index in 0..<3 {
            let tab = app.buttons["native.home.slide.\(index)"]
            requireVisibleControl(tab)
            XCTAssertEqual(tab.isSelected, index == slide)
        }
        let hero = app.buttons["native.home.hero.\(slide)"]
        requireVisibleControl(hero)
        if let reference = settledHeroFrames[slide] {
            // Restoring an animation anchor without its position compensation
            // shifts a 336pt hero by 13–50pt while it remains perfectly hittable.
            let actual = hero.frame
            XCTAssertEqual(actual.minX, reference.minX, accuracy: 1, "Hero x drift after retained return/tab/background")
            XCTAssertEqual(actual.minY, reference.minY, accuracy: 1, "Hero y drift after retained return/tab/background")
            XCTAssertEqual(actual.width, reference.width, accuracy: 1, "Hero scale did not settle")
            XCTAssertEqual(actual.height, reference.height, accuracy: 1, "Hero scale did not settle")
        } else {
            settledHeroFrames[slide] = hero.frame
        }
        let cta = app.buttons["native.home.cta"]
        requireVisibleControl(cta)
        XCTAssertEqual(cta.label, ["Journey", "Arcade", "Settings"][slide])
        XCTAssertEqual(app.buttons.matching(identifier: "native.home.cta").count, 1,
                       "Inactive slides must not expose duplicate CTA controls")
        XCTAssertEqual(element("native.status").value as? String, "ready")
    }

    private func requireHub() {
        XCTAssertTrue(element("native.hub").exists)
        requireVisibleControl(app.buttons["native.hub.back"])
        XCTAssertFalse(app.buttons["native.home.cta"].isHittable,
                       "Hidden Home must not accept CTA input through Hub")
        let worlds = [1, 3, 2].map { app.buttons["native.hub.world.\($0)"] }
        worlds.forEach { requireVisibleControl($0, allowAuthoredOverflow: true) }
        XCTAssertLessThan(worlds[0].frame.midY, worlds[1].frame.midY, "v9 Hub order: Forest, Area 55, Beach")
        XCTAssertLessThan(worlds[1].frame.midY, worlds[2].frame.midY)
        XCTAssertEqual(element("native.status").value as? String, "ready")
    }

    private func selectSlide(_ index: Int) {
        let tab = app.buttons["native.home.slide.\(index)"]
        requireVisibleControl(tab)
        tab.tap()
        quiet()
        requireHome(slide: index)
    }

    private func backgroundAndResume() {
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 2)
                      || app.wait(for: .runningBackgroundSuspended, timeout: 2))
        quiet(1)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        quiet()
    }

    private func dragHeroSlowly(slide: Int, horizontalPoints: CGFloat) {
        let hero = app.buttons["native.home.hero.\(slide)"]
        requireVisibleControl(hero)
        let start = hero.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = start.withOffset(CGVector(dx: horizontalPoints, dy: 0))
        // 80pt/s is below the authored 350pt/s flick threshold. Holding the
        // endpoint also avoids an accidental release flick or a CTA activation.
        start.press(forDuration: 0.1, thenDragTo: end,
                    withVelocity: XCUIGestureVelocity(rawValue: 80), thenHoldForDuration: 0.2)
        quiet()
    }

    private func requireCanonicalWebScreen(backLabel: String, title: String) -> XCUIElement {
        let back = app.buttons[backLabel]
        XCTAssertTrue(back.waitForExistence(timeout: 10), "Canonical web destination did not become accessible")
        requireVisibleControl(back)
        XCTAssertTrue(app.staticTexts[title].exists, "Wrong canonical destination: expected \(title)")
        XCTAssertFalse(app.buttons["native.home.cta"].isHittable,
                       "Native Home must relinquish input to canonical web destination")
        XCTAssertFalse(app.buttons["native.hub.back"].isHittable,
                       "Native Hub must relinquish input to canonical web destination")
        return back
    }

    func testOriginalHomeSlidesHubReturnAndLifecycle() throws {
        XCTAssertEqual(app.frame.width, 390, accuracy: 1)
        XCTAssertEqual(app.frame.height, 844, accuracy: 1)
        capture("native-v9-home-journey-original-art")
        selectSlide(1)
        capture("native-v9-home-arcade-original-art")
        selectSlide(2)
        capture("native-v9-home-settings-original-art")

        // Retain actual selected slide across background; never reset save data.
        backgroundAndResume()
        requireHome(slide: 2)
        capture("native-v9-home-settings-after-background")
        app.buttons["native.home.hero.2"].swipeRight()
        quiet()
        requireHome(slide: 1)
        app.buttons["native.home.hero.1"].swipeRight()
        quiet()
        requireHome(slide: 0)

        // Left-edge resistance must settle back without invoking Journey.
        dragHeroSlowly(slide: 0, horizontalPoints: 130)
        requireHome(slide: 0)
        selectSlide(1)
        dragHeroSlowly(slide: 1, horizontalPoints: -60)
        requireHome(slide: 1)
        // No explicit settle between taps: exercise replacement navigation.
        // XCUITest may still impose its own idle wait; this is not a latency test.
        for index in [2, 1, 0] { app.buttons["native.home.slide.\(index)"].tap() }
        quiet()
        requireHome(slide: 0)
        capture("native-v9-home-after-pan-snap-and-replacement-nav")

        // Both authored Journey entry targets must actually change the route.
        // This existing, already-played save is not first-play tutorial evidence.
        // Arcade/gameplay remains out of scope: never touch a stage/card/Play CTA.
        for pass in 1...3 {
            let entry = app.buttons[pass == 2 ? "native.home.hero.0" : "native.home.cta"]
            requireVisibleControl(entry)
            entry.tap()
            quiet()
            requireHub()
            capture("native-v9-hub-original-world-art-pass-\(pass)")
            if pass == 2 {
                backgroundAndResume()
                requireHub()
                capture("native-v9-hub-after-background")
            }
            app.buttons["native.hub.back"].tap()
            quiet()
            requireHome(slide: 0)
            capture("native-v9-home-return-pass-\(pass)")
        }
        // Exercise the real canonical Settings source/action/return handshake.
        // Do not change settings or enter developer/reset controls.
        selectSlide(2)
        app.buttons["native.home.cta"].tap()
        quiet(4)
        let settingsBack = requireCanonicalWebScreen(backLabel: "Go back to home", title: "Settings")
        capture("native-to-canonical-web-settings-original-art")
        settingsBack.tap()
        quiet(4)
        requireHome(slide: 2)
        capture("canonical-settings-return-native-home")

        // Open and close each actual World, never its board/card targets.
        // Native source-ready alone is NOT proof of the requested World ready.
        selectSlide(0)
        app.buttons["native.home.cta"].tap()
        quiet()
        requireHub()
        for (worldID, worldName) in [(1, "Forest"), (3, "Area 55"), (2, "Beach")] {
            let world = app.buttons["native.hub.world.\(worldID)"]
            requireVisibleControl(world, allowAuthoredOverflow: true)
            world.tap()
            quiet(4)
            let close = requireCanonicalWebScreen(backLabel: "Close world", title: worldName)
            capture("native-to-canonical-world-\(worldID)-original-art")
            close.tap()
            quiet(4)
            requireHub()
            capture("canonical-world-\(worldID)-return-native-hub")
        }
        app.buttons["native.hub.back"].tap()
        quiet()
        requireHome(slide: 0)
        capture("native-v9-home-final-original-art")
    }

    /// Bounded real-input cadence capture for the native diagnostic helper.
    /// No screenshots, AX assertions or polling during motion. XCTest's own
    /// tap/idleness overhead still applies: this is NOT presented-frame FPS.
    func testNativeHomeHubRouteCadence() {
        let journey = app.buttons["native.home.cta"]
        let back = app.buttons["native.hub.back"]
        for _ in 0..<5 {
            journey.tap()
            quiet(2)
            back.tap()
            quiet(2)
        }
        requireHome(slide: 0)
    }

    /// Real-input native Hub→canonical World→native Hub cycles. Assertions run
    /// only after four-second quiet windows, with no screenshots or polling
    /// during motion. Callback cadence is not a presented-frame FPS claim.
    func testNativeWorldRouteCadence() {
        app.buttons["native.home.cta"].tap()
        quiet(2)
        requireHub()
        // Consecutive visits isolate each World's first entry plus two warm
        // reuses. Earlier captures alternated all three Worlds; do not pool the
        // two route orders as one condition. The full functional test still
        // covers changing Worlds in the original Forest→Area55→Beach order.
        for (worldID, worldName) in [(1, "Forest"), (3, "Area 55"), (2, "Beach")] {
            for _ in 0..<3 {
                app.buttons["native.hub.world.\(worldID)"].tap()
                quiet(4)
                // A source-Hub readiness receipt is insufficient: require the
                // actual World's title and its canonical Close world control.
                let close = requireCanonicalWebScreen(backLabel: "Close world", title: worldName)
                close.tap()
                quiet(4)
                requireHub()
                XCTAssertFalse(app.buttons["Close world"].isHittable,
                               "Returned native Hub must not leak World input")
            }
        }
        app.buttons["native.hub.back"].tap()
        quiet(2)
        requireHome(slide: 0)
    }

    /// Functional background race, not a performance measurement. No restart,
    /// injected route state, save reset or tutorial policy changes.
    func testNativeWorldBackgroundReturn() {
        app.buttons["native.home.cta"].tap()
        quiet(2)
        requireHub()
        app.buttons["native.hub.world.2"].tap()
        quiet(4)
        let close = requireCanonicalWebScreen(backLabel: "Close world", title: "Beach")
        close.tap()
        // Deliberately no quiet/AX polling between Close and background.
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        quiet(4)
        if app.buttons["Close world"].isHittable {
            // Cancellation may validly retain the interactive canonical World;
            // prove its identity, then use its normal Close action to finish.
            let restored = requireCanonicalWebScreen(backLabel: "Close world", title: "Beach")
            restored.tap()
            quiet(4)
        }
        requireHub()
        XCTAssertFalse(app.buttons["Close world"].isHittable)
        app.buttons["native.hub.back"].tap()
        quiet(2)
        requireHome(slide: 0)
    }

    /// Canonical interim entry and manual gameplay exit, with no tile moves,
    /// restarts, developer controls or injected progression/save state.
    func testNativeJourneyInterimGameExitReturn() throws {
        XCTAssertEqual(app.frame.width, 390, accuracy: 1)
        XCTAssertEqual(app.frame.height, 844, accuracy: 1)
        app.buttons["native.home.cta"].tap()
        quiet(2)
        requireHub()
        app.buttons["native.hub.world.1"].tap()
        quiet(4)
        let forestClose = requireCanonicalWebScreen(backLabel: "Close world", title: "Forest")
        let interim = app.images["Stage 1 (interim)"]
        guard interim.waitForExistence(timeout: 8) else {
            capture("native-game-exit-stage-one-interim-unavailable")
            forestClose.tap()
            quiet(4)
            requireHub()
            app.buttons["native.hub.back"].tap()
            quiet(2)
            requireHome(slide: 0)
            throw XCTSkip("This real profile has no Stage 1 interim card; do not fabricate progress or substitute an unverified card")
        }
        XCTAssertTrue(interim.isHittable)
        interim.tap()
        quiet(8)
        XCTAssertFalse(app.buttons["Close world"].isHittable)
        XCTAssertFalse(app.buttons["native.hub.back"].isHittable)
        XCTAssertFalse(app.buttons["native.home.cta"].isHittable)
        XCTAssertFalse(app.staticTexts["Drag a dice onto another dice."].exists)
        capture("native-forest-interim-real-game-before-exit")

        // HUD Close is a Pixi Container, not a semantic UIKit/DOM button.
        // This exact390×844 point was exercised by the existing genuine-game
        // JourneyFlowUITests; retain the game screenshot for hit verification.
        let hudClose = app.coordinate(withNormalizedOffset: CGVector(dx: 45.0 / 390.0, dy: 67.0 / 844.0))
        hudClose.tap()
        quiet(2)
        let exit = app.buttons["Exit Stage"]
        XCTAssertTrue(exit.waitForExistence(timeout: 8), "HUD tap did not open the actual Journey Exit modal")
        requireVisibleControl(exit)
        XCTAssertTrue(app.staticTexts["Exit Stage?"].exists)
        let cancel = app.buttons["Close Exit Stage?"]
        requireVisibleControl(cancel)
        cancel.tap()
        quiet(2)
        XCTAssertFalse(exit.isHittable, "Cancel must close the modal without leaving gameplay")
        XCTAssertFalse(app.buttons["Close world"].isHittable)
        capture("native-forest-game-after-exit-modal-cancel")

        hudClose.tap()
        quiet(2)
        XCTAssertTrue(exit.waitForExistence(timeout: 8))
        requireVisibleControl(exit)
        XCTAssertTrue(app.staticTexts["Exit Stage?"].exists)
        exit.tap()
        quiet(4)
        let returnedClose = requireCanonicalWebScreen(backLabel: "Close world", title: "Forest")
        XCTAssertFalse(exit.isHittable)
        XCTAssertTrue(app.images["Stage 1 (interim)"].isHittable,
                      "Canonical gameplay return must restore its usable interim card")
        capture("native-forest-after-real-game-exit-return")
        returnedClose.tap()
        quiet(4)
        requireHub()
        app.buttons["native.hub.back"].tap()
        quiet(2)
        requireHome(slide: 0)
    }
}
