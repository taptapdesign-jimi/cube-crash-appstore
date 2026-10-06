import XCTest

/// Real-input setup for the isolated QA profile only. Run each named test only
/// from its inspected predecessor state; these tests do NOT claim completion.
/// The canonical completion policy changes only after natural board completion
/// and the actual Tutorial Complete modal's Continue action.
@MainActor
final class JimiTutorialSetupUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.taptapdesign.stacktosix.Stack-to-Six")

    override func setUpWithError() throws {
        continueAfterFailure = false
        #if !targetEnvironment(simulator)
        throw XCTSkip("Tutorial setup is Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {
            throw XCTSkip("Preserve every other Simulator and physical device")
        }
        guard app.state != .notRunning else {
            throw XCTSkip("Operator must launch the verified isolated candidate; no launch/reset by this fixture")
        }
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        quiet(2)
        XCTAssertEqual(app.frame.width, 390, accuracy: 1)
        XCTAssertEqual(app.frame.height, 844, accuracy: 1)
        XCTAssertFalse(app.buttons["native.home.cta"].isHittable)
    }

    private func quiet(_ seconds: TimeInterval) {
        let settled = expectation(description: "Allow canonical tutorial transition to settle")
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { settled.fulfill() }
        wait(for: [settled], timeout: seconds + 3)
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func drag(fromColumn: Int, row: Int, toColumn: Int, row targetRow: Int) {
        // 5×9 canvas mapping verified against the actual 1170×2532 screenshot
        // /tmp/jimi-native-home-hub-failure.png, displayed at390×844 points.
        // Cell indexes are zero-based. This is input, never a board-state write.
        func point(_ column: Int, _ row: Int) -> XCUICoordinate {
            app.coordinate(withNormalizedOffset: .zero).withOffset(
                CGVector(dx: 54 + Double(column) * 70.5, dy: 167 + Double(row) * 70.5))
        }
        point(fromColumn, row).press(forDuration: 0.12,
            thenDragTo: point(toColumn, targetRow), withVelocity: .slow, thenHoldForDuration: 0.12)
        quiet(3)
    }

    func testAdvanceGuidedTutorialToFreePlay() {
        XCTAssertTrue(app.staticTexts["Drag a dice onto another dice."].waitForExistence(timeout: 10),
                      "Require the observed genuine tutorial step one, not an arbitrary board")
        capture("tutorial-observed-step-one")
        // Source3 at(1,3) onto destination2 at(3,5) becomes5.
        drag(fromColumn: 1, row: 3, toColumn: 3, row: 5)
        XCTAssertTrue(app.staticTexts["Drag to stack this dice to make 6."].waitForExistence(timeout: 10),
                      "First real drag did not reach canonical step two")
        capture("tutorial-after-real-three-plus-two")

        // The surviving5 onto the authored1 at(3,1) performs the actual merge6.
        drag(fromColumn: 3, row: 5, toColumn: 3, row: 1)
        let gotIt = app.buttons["Got it!"]
        XCTAssertTrue(gotIt.waitForExistence(timeout: 10))
        XCTAssertTrue(gotIt.isHittable, "Step-three CTA must actually be admitted")
        capture("tutorial-after-real-five-plus-one")
        gotIt.tap()
        quiet(3)
        XCTAssertFalse(gotIt.isHittable, "Canonical step-three dismissal did not complete")
        capture("tutorial-free-play-awaiting-natural-wild")
        // Deliberate boundary: leave the real board for observation and further
        // legal moves. Do not invoke tutorial.complete/markDone or edit storage.
    }

    func testObservedFreePlayToWildInstruction() {
        // Run only this method after inspecting /tmp/jimi-native-tutorial-freeplay.png.
        // There is deliberately no restart or synthetic board seed. The image
        // shows each of the original target values below, plus real new spawns.
        let special = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@",
            "They can merge with any regular")).firstMatch
        XCTAssertFalse(app.staticTexts["Drag a dice onto another dice."].exists)
        XCTAssertFalse(app.staticTexts["Drag to stack this dice to make 6."].exists)
        XCTAssertFalse(app.buttons["Got it!"].isHittable)
        XCTAssertFalse(special.isHittable)
        capture("tutorial-observed-freeplay-before-four-drags")
        drag(fromColumn: 0, row: 0, toColumn: 1, row: 0) // 2+2=4
        capture("tutorial-freeplay-row-zero-stack-four")
        drag(fromColumn: 1, row: 0, toColumn: 2, row: 0) // 4+2=6
        capture("tutorial-freeplay-row-zero-merge-six")
        drag(fromColumn: 2, row: 2, toColumn: 3, row: 2) // 1+1=2
        capture("tutorial-freeplay-row-two-stack-two")
        drag(fromColumn: 0, row: 2, toColumn: 1, row: 2) // 2+2=4
        capture("tutorial-freeplay-after-four-drags")
        if !special.waitForExistence(timeout: 3) {
            // The observed initial meter was about32%; four moves can leave94%.
            // These are the surviving4 and2 produced above, not a random spawn.
            drag(fromColumn: 1, row: 2, toColumn: 3, row: 2) // 4+2=6
            capture("tutorial-freeplay-after-bounded-fifth-drag")
        }
        XCTAssertTrue(special.waitForExistence(timeout: 10),
                      "No Special dice instruction yet: inspect meter and current board; do not infer spawn or reset")
        quiet(3)
        capture("tutorial-natural-special-dice-instruction")
        // Do not guess the Wild's actual cell. Observe this attachment first.
    }

    func testObservedWildMergeEndsInstruction() {
        // Confirmed by /tmp/jimi-native-tutorial-wild.png: actual Wild(2,1),
        // preserved regular2(4,4). No assumption about newly spawned dice.
        let special = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@",
            "They can merge with any regular")).firstMatch
        XCTAssertTrue(special.waitForExistence(timeout: 10))
        XCTAssertTrue(special.isHittable)
        capture("tutorial-observed-wild-before-real-merge")
        drag(fromColumn: 2, row: 1, toColumn: 4, row: 4)
        let retired = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: special)
        XCTAssertEqual(XCTWaiter.wait(for: [retired], timeout: 10), .completed,
                       "Actual Wild merge did not retire the instruction")
        quiet(4)
        capture("tutorial-after-real-wild-merge-instruction-retired")
        // Instruction dismissal is NOT Tutorial Complete. Stop for a new board
        // inspection before further legal moves through canonical free play.
    }
}
