import XCTest

@MainActor
final class NativeHomeInteractionUITests: XCTestCase {
    func testNormalJourneyArea55TutorialTransitionsOnActualOSClock()throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Dedicated isolated Native Simulator only")}
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchArguments=[];app.launchEnvironment=["CC_NATIVE_QA_PROFILE_ID":UUID().uuidString]
        app.launch();defer{app.terminate()}
        func settle(_ seconds:Double=1.0){let e=expectation(description:"actual visible motion");DispatchQueue.main.asyncAfter(deadline:.now()+seconds){e.fulfill()};wait(for:[e],timeout:seconds+3)}
        func tap(_ id:String,timeout:Double=15){let e=app.buttons[id];XCTAssertTrue(e.waitForExistence(timeout:timeout));let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == true AND enabled == true"),object:e);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:timeout),.completed);e.tap()}
        tap("native.home.cta",timeout:25);tap("native.hub.world.3");tap("native.world.card.21")
        let board=app.otherElements["native-gameplay-board"]
        let launched=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in board.exists || app.buttons["native.world.card.play"].exists},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[launched],timeout:15),.completed)
        if app.buttons["native.world.card.play"].exists{tap("native.world.card.play")}
        XCTAssertTrue(board.waitForExistence(timeout:20));XCTAssertTrue(app.staticTexts["Drag to stack"].waitForExistence(timeout:15));settle(1.2)
        func guidedDrag(){
            let source=app.descendants(matching:.any).matching(identifier:"native.tutorial.drag-source").firstMatch
            let target=app.descendants(matching:.any).matching(identifier:"native.tutorial.drag-target").firstMatch
            XCTAssertTrue(source.waitForExistence(timeout:8));XCTAssertTrue(target.waitForExistence(timeout:8))
            source.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.16,thenDragTo:target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)))
        }
        guidedDrag();XCTAssertTrue(app.staticTexts["Merge dice"].waitForExistence(timeout:10));settle(1.0)
        guidedDrag();XCTAssertTrue(app.staticTexts["Special Bar"].waitForExistence(timeout:15));settle(1.1)
        tap("native.tutorial.got-it");XCTAssertTrue(app.staticTexts["Clear the stage"].waitForExistence(timeout:3));settle(0.8)
        tap("native.tutorial.got-it");settle(0.8)
        func point(_ x:Double,_ y:Double)->XCUICoordinate{board.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y))}
        for (sx,sy,tx,ty) in [(0.141,0.197,0.321,0.197),(0.50,0.197,0.321,0.197),(0.50,0.363,0.679,0.363),(0.141,0.363,0.321,0.363),(0.679,0.363,0.321,0.363)] {
            point(sx,sy).press(forDuration:0.16,thenDragTo:point(tx,ty));settle(1.2)
        }
        XCTAssertTrue(app.staticTexts["Special dice"].waitForExistence(timeout:15));settle(1.2)
        XCTAssertEqual(app.buttons["native.tutorial.got-it"].label,"Got it")
        tap("native.tutorial.got-it");settle(0.4)
        XCTAssertFalse(app.staticTexts["Special dice"].exists)
        guidedDrag();settle(5)
        XCTAssertFalse(app.staticTexts["Great merge!"].exists)
        XCTAssertFalse(app.staticTexts["Special dice"].exists);XCTAssertFalse(app.staticTexts["Replay board?"].exists)
        XCTAssertFalse(app.otherElements["native.tutorial.sheet"].exists);XCTAssertTrue(board.exists);XCTAssertEqual(app.webViews.count,0)
    }
    func testExplicitSourceGuidedOSDragsCTAAndBackground()throws {
        try runSourceGuidedOS(profile:"AD1E2026-1010-4000-8000-000000000005",completeFourth:false)
    }
    func testExplicitSourceEntireGuideUsesEarnedStarOnActualOSInput()throws {
        try runSourceGuidedOS(profile:"AD1E2026-1010-4000-8000-000000000006",completeFourth:true)
    }
    func testExplicitSourceOrdinaryAndDirectEntireGuideUsesActualOSInput()throws {
        try runSourceGuidedOS(profile:"AD1E2026-1010-4000-8000-000000000013",completeFourth:true,sourceOrdinaryAndDirect:true)
    }
    func testNormalStoryboardDefaultEntireGuideUsesActualOSInputWithoutSourceSwitches()throws {
        try runSourceGuidedOS(profile:UUID().uuidString,completeFourth:true,normalDefault:true)
    }
    private func runSourceGuidedOS(profile:String,completeFourth:Bool,sourceOrdinaryAndDirect:Bool=false,normalDefault:Bool=false)throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A",
              (normalDefault || ProcessInfo.processInfo.environment["CC_NATIVE_QA_SOURCE_GUIDED_OS"]=="1") else {
            throw XCTSkip("Explicit isolated guided Source OS evidence only")
        }
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchArguments=[]
        app.launchEnvironment=["CC_NATIVE_QA_PROFILE_ID":profile]
        if !normalDefault {app.launchEnvironment["CC_NATIVE_QA_SOURCE_FRESH_TUTORIAL"]="1"}
        if sourceOrdinaryAndDirect {
            app.launchEnvironment["CC_NATIVE_QA_SOURCE_ORDINARY"]="1"
            app.launchEnvironment["CC_NATIVE_QA_SOURCE_DIRECT"]="1"
        }
        app.launch();defer{app.terminate()}
        let nav=app.buttons["native.home.slide.1"]
        XCTAssertTrue(nav.waitForExistence(timeout:20))
        let ready=XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == true"),object:nav)
        XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:10),.completed)
        nav.tap()
        let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true AND hittable == true"),object:nav)
        XCTAssertEqual(XCTWaiter.wait(for:[selected],timeout:5),.completed)
        app.buttons["native.home.cta"].tap()
        let board=app.otherElements["native-gameplay-board"]
        XCTAssertTrue(board.waitForExistence(timeout:15))
        XCTAssertTrue(app.staticTexts["Drag to stack"].waitForExistence(timeout:15))
        func settle(_ name:String,seconds:Double=1.5) {
            let done=expectation(description:name)
            DispatchQueue.main.asyncAfter(deadline:.now()+seconds){done.fulfill()}
            wait(for:[done],timeout:seconds+3)
        }
        settle("first authored sheet and pointer")
        // Frozen positions from the original5x9 iPhone13 board and preserved
        // actual entry screenshot. These are OS gestures, never Scene seams.
        XCTAssertEqual(board.frame.width,390,accuracy:1)
        XCTAssertEqual(board.frame.height,844,accuracy:1)
        func point(_ x:Double,_ y:Double)->XCUICoordinate {
            board.coordinate(withNormalizedOffset:CGVector(dx:x,dy:y))
        }
        point(0.321,0.447).press(forDuration:0.16,thenDragTo:point(0.679,0.614))
        XCTAssertTrue(app.staticTexts["Merge dice"].waitForExistence(timeout:12))
        settle("second authored sheet")
        XCUIDevice.shared.press(.home)
        let background=XCTNSPredicateExpectation(predicate:NSPredicate(format:"state != %d",XCUIApplication.State.runningForeground.rawValue),object:app)
        XCTAssertEqual(XCTWaiter.wait(for:[background],timeout:10),.completed)
        app.activate()
        XCTAssertTrue(app.staticTexts["Merge dice"].waitForExistence(timeout:10))
        point(0.679,0.28).press(forDuration:0.16,thenDragTo:point(0.679,0.614))
        let cta=app.buttons["native.tutorial.got-it"]
        XCTAssertTrue(cta.waitForExistence(timeout:15));settle("third authored CTA")
        let before=XCTAttachment(screenshot:app.screenshot());before.name="native-source-guided-os-third";before.lifetime = .keepAlways;add(before)
        cta.tap()
        let hidden=XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == false"),object:cta)
        XCTAssertEqual(XCTWaiter.wait(for:[hidden],timeout:8),.completed)
        XCTAssertEqual(app.webViews.count,0)
        let after=XCTAttachment(screenshot:app.screenshot());after.name="native-source-guided-os-free-play";after.lifetime = .keepAlways;add(after)
        if completeFourth {
            settle("third sheet exit")
            // Original demo's authored top-row2+2+2 and row-two2+2/1+1
            // earn the meter. No fixture flag, saved-state write or injected die.
            let moves:[(Double,Double,Double,Double)]=[
                (0.141,0.197,0.321,0.197),(0.50,0.197,0.321,0.197),
                (0.50,0.363,0.679,0.363),(0.141,0.363,0.321,0.363),
                (0.679,0.363,0.321,0.363)]
            for (sx,sy,tx,ty) in moves {
                point(sx,sy).press(forDuration:0.16,thenDragTo:point(tx,ty))
                settle("actual free-play commit")
            }
            XCTAssertTrue(app.staticTexts["Special dice"].waitForExistence(timeout:15))
            settle("fourth authored sheet and pointer")
            let fourth=XCTAttachment(screenshot:app.screenshot());fourth.name="native-source-entire-guide-os-earned-star";fourth.lifetime = .keepAlways;add(fourth)
            // Genuine UIKit accessibility targets follow the same selected
            // physical rectangles as the visible hand. Shared RNG may change
            // the surviving roster; never freeze guessed post-merge cells.
            let wild=app.descendants(matching:.any).matching(identifier:"native.tutorial.drag-source").firstMatch
            let target=app.descendants(matching:.any).matching(identifier:"native.tutorial.drag-target").firstMatch
            XCTAssertTrue(wild.waitForExistence(timeout:5));XCTAssertTrue(target.waitForExistence(timeout:5))
            wild.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.16,
                thenDragTo:target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)))
            let retired=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.otherElements["native.tutorial.sheet"])
            XCTAssertEqual(XCTWaiter.wait(for:[retired],timeout:15),.completed)
            XCTAssertTrue(board.exists);XCTAssertEqual(app.webViews.count,0)
            let completed=XCTAttachment(screenshot:app.screenshot());completed.name="native-source-entire-guide-os-completed";completed.lifetime = .keepAlways;add(completed)
        }
    }
    func testExplicitSourceFreshTutorialAcrossTwoActualOSLaunches()throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A",
              ProcessInfo.processInfo.environment["CC_NATIVE_QA_SOURCE_OS"]=="1" else {
            throw XCTSkip("Explicit isolated Source OS evidence only")
        }
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchEnvironment["CC_NATIVE_QA_PROFILE_ID"]="AD1E2026-1010-4000-8000-000000000004"
        app.launchEnvironment["CC_NATIVE_QA_SOURCE_FRESH_TUTORIAL"]="1"
        defer{app.terminate()}
        for index in 0..<2 {
            app.launch()
            let nav=app.buttons["native.home.slide.1"]
            XCTAssertTrue(nav.waitForExistence(timeout:20));nav.tap()
            let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true AND hittable == true"),object:nav)
            XCTAssertEqual(XCTWaiter.wait(for:[selected],timeout:5),.completed)
            app.buttons["native.home.cta"].tap()
            XCTAssertTrue(app.otherElements["native-gameplay-board"].waitForExistence(timeout:15))
            let entry=expectation(description:"Actual Source entry painted capture window")
            DispatchQueue.main.asyncAfter(deadline:.now()+5){entry.fulfill()}
            wait(for:[entry],timeout:7)
            XCTAssertTrue(app.otherElements["native.tutorial.sheet"].waitForExistence(timeout:10))
            XCTAssertEqual(app.webViews.count,0)
            let shot=XCTAttachment(screenshot:app.screenshot());shot.name="native-source-tutorial-os-entry-\(index)";shot.lifetime = .keepAlways;add(shot)
            app.terminate()
        }
    }
    func testExplicitNativeDiagnosticsCaptureAcrossActualOSForegroundAndBackground()throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A",
              ProcessInfo.processInfo.environment["CC_NATIVE_QA_DIAGNOSTICS_OS"]=="1" else {
            throw XCTSkip("Explicit dedicated Native diagnostics OS evidence only")
        }
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchEnvironment["CC_NATIVE_QA_PROFILE_ID"]="AD1E2026-1010-4000-8000-000000000003"
        app.launchArguments=["--cc-native-thermal-telemetry"]
        app.launch();defer{app.terminate()}
        XCTAssertTrue(app.buttons["native.home.slide.0"].waitForExistence(timeout:20))
        XCTAssertEqual(app.webViews.count,0)
        func window(_ name:String,seconds:Double) {
            print("[NATIVE_DIAGNOSTICS_OS] \(name)")
            let done=expectation(description:name)
            DispatchQueue.main.asyncAfter(deadline:.now()+seconds){done.fulfill()}
            wait(for:[done],timeout:seconds+5)
        }
        window("active-capture",seconds:6)
        XCUIDevice.shared.press(.home)
        let background=XCTNSPredicateExpectation(predicate:NSPredicate(format:"state != %d",XCUIApplication.State.runningForeground.rawValue),object:app)
        XCTAssertEqual(XCTWaiter.wait(for:[background],timeout:10),.completed)
        window("background-silence",seconds:8)
        XCTAssertTrue([XCUIApplication.State.runningBackground,.runningBackgroundSuspended].contains(app.state),"Capture must retain the same background process")
        app.activate()
        XCTAssertTrue(app.buttons["native.home.slide.0"].waitForExistence(timeout:10))
        window("resumed-capture",seconds:6)
        XCTAssertEqual(app.webViews.count,0)
        let screenshot=XCTAttachment(screenshot:app.screenshot())
        screenshot.name="native-diagnostics-os-return-home";screenshot.lifetime = .keepAlways;add(screenshot)
    }
    func testRealSlowAndFastSwipesAndNavClicksKeepHomeRoute() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Dedicated QA Simulator only")}
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchEnvironment["CC_NATIVE_QA_PROFILE_ID"]=UUID().uuidString;app.launch()
        func nav(_ index:Int)->XCUIElement {app.buttons["native.home.slide.\(index)"]}
        XCTAssertTrue(nav(0).waitForExistence(timeout:15))
        func settled(_ index:Int) {
            let target=nav(index)
            let selectionExpectation=XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true AND hittable == true"),object:target)
            XCTAssertEqual(XCTWaiter.wait(for:[selectionExpectation],timeout:5),.completed)
            // Input admission does not cover selection; allow original finite
            // track/bounce completion before the next unrelated slow gesture.
            let done=expectation(description:"Original finite Home motion")
            DispatchQueue.main.asyncAfter(deadline:.now()+0.9){done.fulfill()};wait(for:[done],timeout:2)
            XCTAssertTrue(app.buttons["native.home.cta"].exists)
        }
        settled(0)
        app.swipeLeft(velocity:.slow);settled(1)
        app.swipeLeft(velocity:.fast);settled(2)
        app.swipeRight(velocity:.fast);settled(1)
        app.swipeRight(velocity:.slow);settled(0)
        nav(2).tap();settled(2)
        nav(0).tap();settled(0)
        XCTAssertEqual(app.webViews.count,0)
        let shot=XCTAttachment(screenshot:app.screenshot());shot.name="native-home-real-swipes-nav";shot.lifetime = .keepAlways;add(shot)
    }
    func testNativeSettingsSurviveActualOSProcessRestart() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Dedicated QA Simulator only")}
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchEnvironment["CC_NATIVE_QA_PROFILE_ID"]=UUID().uuidString
        func openSettings() {
            let nav=app.buttons["native.home.slide.2"]
            XCTAssertTrue(nav.waitForExistence(timeout:20));nav.tap()
            let cta=app.buttons["native.home.cta"]
            let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true AND hittable == true"),object:nav)
            XCTAssertEqual(XCTWaiter.wait(for:[selected],timeout:5),.completed)
            XCTAssertTrue(cta.waitForExistence(timeout:5));cta.tap()
            XCTAssertTrue(app.otherElements["native.settings"].waitForExistence(timeout:10))
        }
        app.launch();openSettings()
        let toggle=app.buttons["native.settings.hapticsEnabled"]
        XCTAssertTrue(toggle.waitForExistence(timeout:5));XCTAssertEqual(toggle.value as? String,"Off")
        toggle.tap()
        XCTAssertEqual(toggle.value as? String,"On")
        // Back travels through the actual Settings save owner before OS exit.
        app.buttons["native.settings.back"].tap()
        XCTAssertTrue(app.buttons["native.home.slide.2"].waitForExistence(timeout:10))
        app.terminate();app.launch();openSettings()
        XCTAssertEqual(app.buttons["native.settings.hapticsEnabled"].value as? String,"On")
        XCTAssertEqual(app.webViews.count,0)
        let shot=XCTAttachment(screenshot:app.screenshot());shot.name="native-settings-os-restart";shot.lifetime = .keepAlways;add(shot)
        app.terminate()
    }

    func testPreparedGenuineGuideProfileStartsForcedTutorialAcrossTwoOSLaunches() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator-only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Dedicated QA Simulator only")}
        // This explicit evidence fixture must be populated with bytes exported
        // by the actual completed-guide transaction before selecting this test.
        guard ProcessInfo.processInfo.environment["CC_NATIVE_QA_GENUINE_GUIDE_REPLAY"] == "1" else {throw XCTSkip("Genuine producer evidence must be prepared first")}
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.taptapdesign.stacktosix.native")
        app.launchEnvironment["CC_NATIVE_QA_PROFILE_ID"]="AD1E2026-1010-4000-8000-000000000002"
        for index in 0..<2 {
            app.launch()
            let nav=app.buttons["native.home.slide.1"]
            XCTAssertTrue(nav.waitForExistence(timeout:20));nav.tap()
            let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"selected == true AND hittable == true"),object:nav)
            XCTAssertEqual(XCTWaiter.wait(for:[selected],timeout:5),.completed)
            app.buttons["native.home.cta"].tap()
            XCTAssertTrue(app.otherElements["native-gameplay-board"].waitForExistence(timeout:15))
            // Capture after the existing finite board/HUD entry window;
            // element existence alone can precede the final painted pose.
            let entryWindow=expectation(description:"Existing finite board entry capture window")
            DispatchQueue.main.asyncAfter(deadline:.now()+4){entryWindow.fulfill()}
            wait(for:[entryWindow],timeout:6)
            XCTAssertTrue(app.otherElements["native.tutorial.sheet"].waitForExistence(timeout:10))
            XCTAssertEqual(app.webViews.count,0)
            let shot=XCTAttachment(screenshot:app.screenshot());shot.name="native-forced-tutorial-os-entry-\(index)";shot.lifetime = .keepAlways;add(shot)
            app.terminate()
        }
    }

}
