import XCTest

/// Real native gestures against a fresh isolated QA profile. No seeded board,
/// progression or tutorial-complete flag; the same factory/rules run as play.
@MainActor
final class NativeGameplayUITests:XCTestCase {
    private let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
    private func item(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}
    override func setUpWithError() throws {
        continueAfterFailure=false
        #if !targetEnvironment(simulator)
        throw XCTSkip("Native gameplay UI QA is Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Wrong QA Simulator")}
        app.launchArguments=["--native-gameplay","--native-qa-fresh-profile"];app.launch()
        XCTAssertTrue(item("native.home.cta").waitForExistence(timeout:15))
    }
    private func capture(_ name:String) {let shot=XCTAttachment(screenshot:app.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot)}
    private func waitForSourceMotion() {let done=expectation(description:"Source sheet motion");DispatchQueue.main.asyncAfter(deadline:.now()+1.5){done.fulfill()};wait(for:[done],timeout:2)}
    func testRealJourneyFirstPlayGesturesAdvanceNativeTutorialWithoutWeb() {
        item("native.home.slide.0").tap();item("native.home.cta").tap()
        XCTAssertTrue(app.staticTexts["Drag to stack"].waitForExistence(timeout:10));waitForSourceMotion()
        XCTAssertTrue(item("native-gameplay-board").exists);XCTAssertEqual(app.webViews.count,0)
        capture("native-first-play-stack")
        // QA iPhone13 has accepted47/34 safe areas. Compute the same stable
        // 128/20,5×9 hit geometry; the actual drag admits through SpriteKit.
        let width=app.frame.width,height=app.frame.height
        let scale=min((width-48)/720,(height-47-34-192)/1312)
        let originX=(width-720*scale)/2,originY=107.0
        func cell(_ column:Int,_ row:Int)->XCUICoordinate {
            let x=originX+(Double(column)*148+64)*scale
            let y=height-(originY+(Double(8-row)*148+64)*scale)
            return app.coordinate(withNormalizedOffset:.zero).withOffset(CGVector(dx:x,dy:y))
        }
        cell(1,3).press(forDuration:0.15,thenDragTo:cell(3,5),withVelocity:.slow,thenHoldForDuration:0.1)
        XCTAssertTrue(app.staticTexts["Merge dice"].waitForExistence(timeout:5));waitForSourceMotion()
        cell(3,5).press(forDuration:0.15,thenDragTo:cell(3,1),withVelocity:.slow,thenHoldForDuration:0.1)
        XCTAssertTrue(app.buttons["native.tutorial.got-it"].waitForExistence(timeout:5));waitForSourceMotion()
        XCTAssertTrue(app.staticTexts["Clear the stage"].exists);capture("native-first-play-freeplay")
        app.buttons["native.tutorial.got-it"].tap()
        let absent=NSPredicate(format:"exists == false")
        expectation(for:absent,evaluatedWith:app.buttons["native.tutorial.got-it"]);waitForExpectations(timeout:5)
        XCTAssertEqual(app.webViews.count,0);XCTAssertTrue(item("native-gameplay-board").exists)
        capture("native-first-play-freeplay-admitted")
    }
}
