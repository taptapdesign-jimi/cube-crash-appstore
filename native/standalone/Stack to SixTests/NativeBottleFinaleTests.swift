import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeBottleFinaleTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testCrossingPathsMatchExecutedSourceGoldenCoordinates() {
        let progress: [CGFloat] = [0,0.125,0.375,0.625,0.875,1]
        let expected: [[CGFloat]] = [
            [23,27.625,41.25,52.0625,57.9375,60],
            [43,38.1875,35.25,44.3125,54.6875,58],
            [58,57.625,56.25,52.875,45.6875,42],
            [72,72.875,74.75,78.875,84.375,86],
            [81.8,81.15,78.2625,73.125,66.625,64]
        ]
        for (layer,values) in zip(NativeBottleFinaleMotion.layers,expected) {
            for (p,golden) in zip(progress,values) {
                XCTAssertEqual(NativeBottleFinaleMotion.crossing(layer.path,progress: p),golden,accuracy: 0.000001)
            }
        }
        XCTAssertEqual(NativeBottleFinaleMotion.crossing([],progress: 0.5),50)
    }
    func testBubbleKeyframesMatchInstalledGSAPAndOpacityRange() {
        let values: [CGFloat] = [0,5,-9,12,6]
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.125),0.761205,accuracy: 0.000001)
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.25),2.928932,accuracy: 0.000001)
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.5),-9,accuracy: 0.000001)
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.75),9.514718,accuracy: 0.000001)
        let alpha = NativeBottleFinaleMotion.mixedOpacities(count: 40,random: { 0.5 })
        XCTAssertEqual(alpha.count,40)
        XCTAssertEqual(Set(alpha).count,40)
        XCTAssertTrue(alpha.allSatisfy { $0 >= 0.2 && $0 <= 0.7 })
    }
    func testFullBottleClockKeepsCueOrderAndOneVisibleCompletionReceipt() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeBottleFinalePresentation(resourceRoot: root,viewport: window.bounds.size,random: { 0.5 })
        controller.view.addSubview(owner)
        defer { owner.dispose(); window.isHidden = true }
        var cues: [String] = [],finished = 0
        let completion = expectation(description: "Bottles and foreground bubbles retire before the source cleanup receipt")
        owner.onCue = { cue,_ in cues.append(cue) }
        owner.onFinished = { success in XCTAssertTrue(success); finished += 1; completion.fulfill() }
        owner.start(); owner.start()
        XCTAssertEqual(cues,["water-waves"])
        XCTAssertEqual(owner.duration,5.70,accuracy: 0.000001)
        XCTAssertEqual(owner.subviews.compactMap { $0 as? UIImageView }.count,100)
        await fulfillment(of: [completion],timeout: 8)
        XCTAssertEqual(cues,["water-waves","bottle1","bottle2","bublesi","cling","cling2"])
        XCTAssertNil(owner.superview)
        owner.dispose(); XCTAssertEqual(finished,1)
    }
    func testDisposedSuspendedOwnerReleasesItsClockAndCannotFinishTwice() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        var owner: NativeBottleFinalePresentation? = NativeBottleFinalePresentation(resourceRoot: root,viewport: window.bounds.size,random: { 0.5 })
        weak var weakOwner = owner
        controller.view.addSubview(owner!)
        var finishes = 0
        owner?.onFinished = { success in XCTAssertFalse(success); finishes += 1 }
        owner?.start(); XCTAssertEqual(owner?.hasActiveClock,true)
        owner?.setSuspended(true); owner?.dispose(); owner?.dispose()
        XCTAssertEqual(owner?.hasActiveClock,false); XCTAssertNil(owner?.superview); XCTAssertEqual(finishes,1)
        owner = nil
        // UIKit/CoreAnimation can retain a just-detached view until this frame
        // drains. Clock retirement above is synchronous; deallocation must
        // still occur across this bounded real run-loop boundary.
        try? await Task.sleep(for: .milliseconds(150))
        XCTAssertNil(weakOwner); XCTAssertEqual(finishes,1)
        window.isHidden = true
    }
    func testForegroundNotificationCannotOverrideExplicitPresentationSuspension() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeFinitePresentation(viewport: window.bounds.size,duration: 0.08)
        controller.view.addSubview(owner)
        defer { owner.dispose(); window.isHidden = true }
        var completions = 0
        let completed = expectation(description: "Explicitly resumed visible clock completes")
        owner.onFinished = { success in XCTAssertTrue(success); completions += 1; completed.fulfill() }
        owner.setSuspended(true); owner.start()
        NotificationCenter.default.post(name: UIApplication.willResignActiveNotification,object: nil)
        NotificationCenter.default.post(name: UIApplication.didBecomeActiveNotification,object: nil)
        try? await Task.sleep(for: .milliseconds(150))
        XCTAssertEqual(completions,0,"Foreground activation must preserve the navigation owner's explicit suspension")
        owner.setSuspended(false)
        await fulfillment(of: [completed],timeout: 2)
        XCTAssertEqual(completions,1)
    }
}
