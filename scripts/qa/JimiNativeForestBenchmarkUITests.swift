import XCTest

/// Operator prelaunches the same exact .native build with probe flag, then only
/// varies --jimi-native-forest. No save fixture, launch, screenshot or recording.
@MainActor
final class JimiNativeForestBenchmarkUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
    private func item(_ id:String) -> XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}
    private func quiet(_ seconds:Double = 4) {
        let done = expectation(description:"Quiet route window")
        DispatchQueue.main.asyncAfter(deadline:.now()+seconds) {done.fulfill()}
        wait(for:[done],timeout:seconds+3)
    }
    private func marker(_ value:String) {print("[FOREST_BENCHMARK] \(Date().timeIntervalSince1970) \(value)")}
    func testMatchedForestRouteCallbacksOff() throws {try measure(mode:"off")}
    func testMatchedForestRouteCallbacksOn() throws {try measure(mode:"on")}
    /// Cause-finding only; operator starts sampler after the first marker.
    /// Retained Hub avoids process-start/XCTest-launch delay consuming the sample.
    func testProfileForestEntriesFromRetainedHub() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Wrong Simulator")}
        XCTAssertTrue(item("native.hub.world.1").isHittable)
        marker("profile-start excluded-from-timing-statistics")
        for _ in 0..<6 {
            item("native.hub.world.1").tap();quiet()
            XCTAssertTrue(item("native.world.1").exists)
            item("native.world.back").tap();quiet()
            XCTAssertTrue(item("native.hub.world.1").isHittable)
        }
        marker("profile-end")
    }
    private func measure(mode:String) throws {
        continueAfterFailure = false
        #if !targetEnvironment(simulator)
        throw XCTSkip("QA Simulator only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Wrong Simulator")}
        guard app.state == .runningForeground else {throw XCTSkip("Operator must prelaunch verified probe build")}
        guard item("native.policy").value as? String == "journey-tutorial-complete" else {throw XCTSkip("Canonical tutorial prerequisite unmet")}
        XCTAssertTrue(item("native.home.cta").isHittable,"Prelaunch must settle at native Home")
        item("native.home.slide.0").tap();quiet()
        item("native.home.cta").tap();quiet()
        XCTAssertTrue(item("native.hub.world.1").isHittable)
        marker("begin mode=\(mode) trials=4 first=first-entry remaining=warm")
        for trial in 0..<4 {
            marker("trial=\(trial) Hub-to-Forest")
            item("native.hub.world.1").tap();quiet()
            let back:XCUIElement
            if mode == "on" {
                XCTAssertTrue(item("native.world.1").exists)
                back = item("native.world.back")
            } else {
                XCTAssertFalse(item("native.world.1").exists,"OFF condition accidentally entered native Forest")
                back = app.buttons["Close world"].firstMatch
            }
            XCTAssertTrue(back.isHittable,"Actual condition-specific World must be ready")
            marker("trial=\(trial) Forest-to-Hub")
            back.tap();quiet()
            XCTAssertTrue(item("native.hub.world.1").isHittable)
        }
        marker("end mode=\(mode)")
    }
}
