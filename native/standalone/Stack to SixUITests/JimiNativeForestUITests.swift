import XCTest

/// Real .native app routes; no injected progression, result, save or board state.
/// Operator launches the verified candidate first. Screenshots are evidence,
/// not a presented-frame or thermal measurement.
@MainActor
final class JimiNativeForestUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.taptapdesign.stacktosix.native")
    private func item(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func quiet(_ seconds: Double = 3) {
        let done = expectation(description: "Allow authored route to settle")
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { done.fulfill() }
        wait(for: [done], timeout: seconds + 3)
    }
    private func scrollWorld(towardBottom: Bool) {
        let start = towardBottom ? 0.78 : 0.30
        let end = towardBottom ? 0.30 : 0.78
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: start)).press(forDuration: 0.1,
            thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: end)),
            withVelocity: .slow, thenHoldForDuration: 0.1)
    }
    private func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = name
        shot.lifetime = .keepAlways; add(shot)
    }
    override func setUpWithError() throws {
        continueAfterFailure = false
        #if !targetEnvironment(simulator)
        throw XCTSkip("Only isolated QA Simulator; never a physical phone")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else { throw XCTSkip("Wrong Simulator") }
        guard app.state != .notRunning else { throw XCTSkip("Operator must launch the verified .native candidate") }
        app.activate(); quiet()
        guard item("native.policy").value as? String == "journey-tutorial-complete" else { throw XCTSkip("Canonical tutorial prerequisite unmet; never fabricate progression") }
        // A retained World may already be visible during manual review. Reach
        // Home only through the real authored controls; never relaunch/reset/save.
        if item("native.world.card.close").isHittable {item("native.world.card.close").tap();quiet()}
        if item("native.world.back").isHittable {item("native.world.back").tap();quiet()}
        if item("native.hub.back").isHittable {item("native.hub.back").tap();quiet()}
        XCTAssertTrue(item("native.home.cta").waitForExistence(timeout:20), "Real canonical navigation must reach native Home")
        XCTAssertTrue(item("native.home.cta").isHittable)
    }
    private func openForest() {
        item("native.home.slide.0").tap(); quiet()
        item("native.home.cta").tap(); quiet()
        XCTAssertTrue(item("native.hub.world.1").isHittable)
        item("native.hub.world.1").tap(); quiet(4)
        XCTAssertTrue(item("native.world.1").exists, "Requires real native Forest, not the web fallback")
        XCTAssertTrue(item("native.world.back").isHittable)
        XCTAssertFalse(item("native.hub.back").isHittable)
    }
    private func finish() {
        item("native.world.back").tap(); quiet()
        XCTAssertTrue(item("native.hub.back").isHittable)
        item("native.hub.back").tap(); quiet()
        XCTAssertTrue(item("native.home.cta").isHittable)
    }
    /// Same verified build/profile, native-Forest flag OFF. Never compare this
    /// observation-overhead capture with physical presented-frame measurements.
    func testHybridForestBaselineActualRoutes() throws {
        item("native.home.slide.0").tap(); quiet()
        item("native.home.cta").tap(); quiet()
        item("native.hub.world.1").tap(); quiet(5)
        let close = app.buttons["Close world"]
        XCTAssertTrue(close.waitForExistence(timeout:8)); XCTAssertTrue(close.isHittable)
        XCTAssertTrue(app.staticTexts["Forest"].exists)
        XCTAssertFalse(item("native.world.1").exists,"Run baseline with native-Forest flag OFF")
        capture("hybrid-forest-same-build-top")
        app.coordinate(withNormalizedOffset:CGVector(dx:0.7,dy:0.8)).press(forDuration:0.1,
            thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.7,dy:0.3)),withVelocity:.slow,thenHoldForDuration:0.1)
        quiet(); capture("hybrid-forest-same-build-scrolled")
        XCTAssertTrue(close.isHittable,"Web header remains usable at deep scroll")
        close.tap(); quiet()
        item("native.hub.world.1").tap(); quiet(5)
        capture("hybrid-forest-same-build-reopened")
        let interim = app.images["Stage 1 (interim)"]
        if interim.isHittable {
            interim.tap(); quiet(8)
            capture("hybrid-forest-same-build-interim-game")
            app.coordinate(withNormalizedOffset:CGVector(dx:45/390.0,dy:67/844.0)).tap(); quiet()
            let exit = app.buttons["Exit Stage"]
            XCTAssertTrue(exit.waitForExistence(timeout:8)); XCTAssertTrue(exit.isHittable)
            exit.tap(); quiet(5)
            XCTAssertTrue(close.isHittable); capture("hybrid-forest-same-build-manual-exit-return")
        } else {
            let regular = app.images["Stage 1"]
            if regular.isHittable {
                regular.tap(); quiet()
                capture("hybrid-forest-same-build-card-front")
                let flip = app.buttons["Turn card to view stats"]
                if flip.isHittable { flip.tap(); quiet(); capture("hybrid-forest-same-build-card-back") }
                let cardClose = app.buttons["Close stage details"]
                guard cardClose.isHittable else {
                    capture("hybrid-forest-modal-close-semantic-unavailable")
                    throw XCTSkip("Actual modal semantics require observed close identifier; do not fabricate card route")
                }
                cardClose.tap(); quiet()
            }
        }
        close.tap(); quiet()
        item("native.hub.back").tap(); quiet()
        XCTAssertTrue(item("native.home.cta").isHittable)
    }
    func testForestScrollCloseAndReopen() {
        openForest(); capture("native-forest-top")
        for _ in 0..<6 { scrollWorld(towardBottom: true); quiet(1) }
        quiet(2) // Observe settled legal scroll, never rubber-band extension.
        let finalAnchor = item("native.world.card.10")
        XCTAssertTrue(finalAnchor.waitForExistence(timeout:8))
        XCTAssertEqual(app.frame.width,390,accuracy:1)
        // Original Forest10 art is a200px square,73px below its card anchor.
        // Decorative children are intentionally hidden by the Unit's AX button.
        // Check that actual scroll translates the complete original art above
        // the bottom safe area, rather than accepting a visible number alone.
        XCTAssertGreaterThanOrEqual(finalAnchor.frame.minY+73,app.frame.minY)
        XCTAssertLessThanOrEqual(finalAnchor.frame.minY+273,app.frame.maxY-34,
            "The complete last island must clear the iPhone 13 bottom safe area at legal maximum scroll")
        capture("native-forest-unit10-legal-scroll-end")
        capture("native-forest-deep-scroll")
        XCTAssertTrue(item("native.world.back").isHittable, "Header must remain usable at deep scroll")
        finish(); openForest(); capture("native-forest-reopened")
        finish()
    }
    func testRegularCardFlipCloseAndCanonicalManualExit() throws {
        openForest()
        let card = item("native.world.card.1")
        for _ in 0..<5 where !card.isHittable { scrollWorld(towardBottom: false); quiet(1) }
        XCTAssertTrue(card.isHittable)
        guard card.value as? String == "regular" else {
            capture("native-forest-regular-profile-unavailable");finish()
            throw XCTSkip("Regular modal requires a real regular card; never tap interim during this fixture")
        }
        card.tap(); quiet()
        let modal = item("native.world.card.modal")
        guard modal.exists else {
            capture("native-forest-regular-card-unavailable")
            XCTFail("Admitted regular card did not present its modal");return
        }
        capture("native-forest-card-auto-back")
        XCTAssertTrue(item("native.world.card.play").isHittable || item("native.world.card.continue").isHittable)
        modal.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); quiet(0.12)
        capture("native-forest-card-midflip-isolated-camera")
        quiet(1)
        capture("native-forest-card-manual-front")
        modal.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); quiet(1)
        capture("native-forest-card-manual-back")
        item("native.world.card.close").tap(); quiet(0.85)
        capture("native-forest-card-return-landing")
        quiet(2)
        XCTAssertFalse(modal.exists); XCTAssertTrue(card.isHittable)
        card.tap(); quiet()
        let play = item("native.world.card.play"), resume = item("native.world.card.continue")
        let cta = resume.isHittable ? resume : play
        XCTAssertTrue(cta.isHittable); cta.tap(); quiet(2)
        capture("native-forest-original-board-transition")
        quiet(6)
        XCTAssertFalse(item("native.world.back").isHittable)
        capture("native-forest-real-game")
        // Canonical Pixi HUD Close at390×844; screenshot retained for proof.
        XCTAssertEqual(app.frame.width, 390, accuracy: 1); XCTAssertEqual(app.frame.height, 844, accuracy: 1)
        app.coordinate(withNormalizedOffset: CGVector(dx:45/390.0,dy:67/844.0)).tap(); quiet()
        let exit = app.buttons["Exit Stage"]
        XCTAssertTrue(exit.waitForExistence(timeout: 8)); XCTAssertTrue(exit.isHittable)
        exit.tap(); quiet(5)
        XCTAssertTrue(item("native.world.1").exists)
        XCTAssertTrue(item("native.world.back").isHittable)
        capture("native-forest-canonical-exit-return")
        finish()
    }

    func testRegularCardBackDragReturnsThroughPhysicalFlip() throws {
        openForest()
        let card = item("native.world.card.1")
        guard card.isHittable && card.value as? String == "regular" else {
            finish(); throw XCTSkip("Requires a real regular card; progression stays canonical")
        }
        card.tap(); quiet()
        let modal = item("native.world.card.modal")
        XCTAssertTrue(modal.exists); XCTAssertTrue(item("native.world.card.close").isHittable)
        capture("native-return-card-back-before-drag")
        modal.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.55)).press(forDuration:0.1,
            thenDragTo:modal.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.90)),
            withVelocity:.slow,thenHoldForDuration:0.1)
        quiet(0.1); capture("native-return-card-back-drag-flip")
        quiet(2)
        XCTAssertFalse(modal.exists); XCTAssertTrue(card.isHittable)
        capture("native-return-card-back-drag-landed")
        finish()
    }

    func testInterimCanonicalManualExitAndRetainedReturn() throws {
        openForest()
        var interim: XCUIElement?
        for _ in 0..<5 {
            interim = (1...10).map {item("native.world.card.\($0)")}.first {$0.isHittable && $0.value as? String == "interim"}
            if interim != nil {break}
            scrollWorld(towardBottom: true); quiet(1)
        }
        guard let card = interim else {
            capture("native-forest-interim-profile-unavailable");finish()
            throw XCTSkip("Interim entry requires a real visible interim card; never mutate progression")
        }
        card.tap(); quiet(2)
        capture("native-forest-interim-original-board-transition")
        quiet(6)
        guard !item("native.world.card.modal").exists else {
            item("native.world.card.close").tap(); quiet(); finish()
            XCTFail("Canonically interim card incorrectly opened a regular modal");return
        }
        XCTAssertFalse(item("native.world.back").isHittable)
        capture("native-forest-interim-real-game")
        app.coordinate(withNormalizedOffset:CGVector(dx:45/390.0,dy:67/844.0)).tap(); quiet()
        let exit = app.buttons["Exit Stage"]
        XCTAssertTrue(exit.waitForExistence(timeout:8)); XCTAssertTrue(exit.isHittable)
        let cancel = app.buttons["Close Exit Stage?"]
        XCTAssertTrue(cancel.isHittable); cancel.tap(); quiet()
        XCTAssertFalse(exit.isHittable); XCTAssertFalse(item("native.world.back").isHittable)
        app.coordinate(withNormalizedOffset:CGVector(dx:45/390.0,dy:67/844.0)).tap(); quiet()
        XCTAssertTrue(exit.isHittable); exit.tap(); quiet(5)
        XCTAssertTrue(item("native.world.1").exists); XCTAssertTrue(item("native.world.back").isHittable)
        XCTAssertTrue(card.isHittable)
        capture("native-forest-interim-manual-exit-return")
        finish()
    }
    func testBeachAndArea55ActualNativeScrollCardsAndReopen() throws {
        // The verified fresh launch starts on Journey. Use its actual CTA;
        // tapping the oversized hero's accessibility frame can also hit CTA.
        item("native.home.cta").tap();quiet()
        for worldID in [3,2] {
            let first = (worldID-1)*10+1
            let hubWorld = item("native.hub.world.\(worldID)")
            if !hubWorld.isHittable {scrollWorld(towardBottom:true);quiet()}
            XCTAssertTrue(hubWorld.isHittable);hubWorld.tap();quiet(4)
            XCTAssertTrue(item("native.world.\(worldID)").exists,"Must present UIKit, not web fallback")
            let admitted = XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@", "ready"),object:item("native.status"))
            XCTAssertEqual(XCTWaiter.wait(for:[admitted],timeout:12),.completed,"Wait for the real presentation/input commit")
            XCTAssertTrue(item("native.world.back").isHittable);capture("native-world-\(worldID)-original-top")
            let card = item("native.world.card.\(first)")
            if card.isHittable && card.value as? String == "regular" {
                print("NATIVE_WORLD_REAL_CARD \(worldID) \(card.debugDescription)")
                card.tap();XCTAssertTrue(item("native.world.card.modal").waitForExistence(timeout:8));quiet()
                capture("native-world-\(worldID)-regular-card-back")
                item("native.world.card.modal").coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap();quiet()
                capture("native-world-\(worldID)-regular-card-front")
                item("native.world.card.close").tap();quiet();XCTAssertFalse(item("native.world.card.modal").exists)
                card.tap();quiet()
                let cta = item("native.world.card.continue").isHittable ? item("native.world.card.continue") : item("native.world.card.play")
                XCTAssertTrue(cta.isHittable);cta.tap();quiet(2);capture("native-world-\(worldID)-original-board-transition");quiet(6)
                XCTAssertFalse(item("native.world.back").isHittable)
                capture("native-world-\(worldID)-canonical-gameplay")
                app.coordinate(withNormalizedOffset:CGVector(dx:45/390.0,dy:67/844.0)).tap();quiet()
                let exit = app.buttons["Exit Stage"];XCTAssertTrue(exit.waitForExistence(timeout:8));XCTAssertTrue(exit.isHittable);exit.tap();quiet(5)
                XCTAssertTrue(item("native.world.\(worldID)").exists);XCTAssertTrue(item("native.world.back").isHittable)
                capture("native-world-\(worldID)-retained-manual-exit-return")
            } else if card.value as? String == "locked" {
                card.tap();quiet(1);XCTAssertFalse(item("native.world.card.modal").exists)
            }
            for _ in 0..<6 {scrollWorld(towardBottom:true);quiet(1)}
            quiet(2);capture("native-world-\(worldID)-legal-bottom")
            XCTAssertTrue(item("native.world.card.\(worldID*10)").exists);XCTAssertTrue(item("native.world.back").isHittable)
            item("native.world.back").tap();quiet();XCTAssertTrue(item("native.hub.back").isHittable)
            let again = item("native.hub.world.\(worldID)");if !again.isHittable {scrollWorld(towardBottom:true);quiet()}
            again.tap();quiet(4);XCTAssertTrue(item("native.world.\(worldID)").exists);capture("native-world-\(worldID)-reopened")
            item("native.world.back").tap();quiet()
        }
        item("native.hub.back").tap();quiet();XCTAssertTrue(item("native.home.cta").isHittable)
    }

}
