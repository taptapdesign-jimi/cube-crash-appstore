import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeTutorialCompleteTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    private func mount(_ owner: NativeTutorialCompleteController, size: CGSize = CGSize(width:390,height:844)) -> UIWindow {
        let window = UIWindow(frame:CGRect(origin:.zero,size:size)); window.rootViewController = owner; window.makeKeyAndVisible()
        owner.view.frame = window.bounds; owner.view.setNeedsLayout(); owner.view.layoutIfNeeded(); return window
    }
    func testContinueReceiptIsExactlyOnceAndRetainsOpaqueTransitionCover() async {
        let owner = NativeTutorialCompleteController(resourceRoot:root,reducedMotion:true)
        let window = mount(owner)
        var continues = 0,cancels = 0
        let received = expectation(description:"Authored Continue exit releases one receipt")
        owner.onContinue = { continues += 1; received.fulfill() }; owner.onCancelled = { cancels += 1 }
        owner.sampleEnter(seconds:0.2); owner.requestContinue(); owner.requestContinue()
        await fulfillment(of:[received],timeout:2)
        XCTAssertEqual(continues,1); XCTAssertEqual(cancels,0); XCTAssertEqual(owner.phase,.continued)
        XCTAssertTrue(owner.view.window === window); XCTAssertEqual(owner.view.backgroundColor?.cgColor.alpha,1)
        XCTAssertFalse(owner.view.subviews.compactMap { $0 as? UIButton }.first?.isUserInteractionEnabled ?? true)
        let cleanup = owner.captureCoverCleanup(); cleanup(); cleanup()
        XCTAssertEqual(owner.phase,.disposed); XCTAssertEqual(continues,1); XCTAssertEqual(cancels,0)
        window.isHidden = true
    }
    func testDisposeBeforeEnterRejectsLateAnimationAndDoubleCleanup() async {
        let owner = NativeTutorialCompleteController(resourceRoot:root,reducedMotion:true)
        let window = mount(owner); var continues = 0,cancels = 0
        owner.onContinue = { continues += 1 }; owner.onCancelled = { cancels += 1 }
        owner.dispose(); owner.dispose(); owner.sampleEnter(seconds:10); owner.requestContinue()
        XCTAssertEqual(continues,0); XCTAssertEqual(cancels,1); XCTAssertEqual(owner.phase,.disposed)
        await Task.yield(); XCTAssertEqual(continues,0); window.isHidden = true
    }
    func testBackgroundSuspendsInputAndResumePreservesOwnedLifetime() async {
        let owner = NativeTutorialCompleteController(resourceRoot:root,reducedMotion:true)
        let window = mount(owner); var continues = 0
        owner.onContinue = { continues += 1 }
        owner.sampleEnter(seconds:0.2); owner.setSuspended(true); owner.requestContinue()
        XCTAssertEqual(continues,0); XCTAssertEqual(owner.phase,.entering); XCTAssertEqual(owner.view.layer.speed,0)
        owner.setSuspended(false); XCTAssertEqual(owner.view.layer.speed,1)
        owner.dispose(); XCTAssertEqual(continues,0); window.isHidden = true
    }
    func testSmallViewportContainsContinueAndUsesOriginalHeroArtwork() {
        let owner = NativeTutorialCompleteController(resourceRoot:root,reducedMotion:true)
        let window = mount(owner,size:CGSize(width:390,height:667))
        let button = owner.view.subviews.compactMap { $0 as? UIButton }.first!
        XCTAssertEqual(button.currentTitle,"Continue"); XCTAssertEqual(button.accessibilityIdentifier,"native.tutorial-complete.continue")
        XCTAssertGreaterThanOrEqual(button.frame.minX,0); XCTAssertLessThanOrEqual(button.frame.maxX,390)
        XCTAssertLessThanOrEqual(button.frame.maxY,667); XCTAssertGreaterThan(button.bounds.height,44)
        let images = owner.view.subviews.compactMap { $0 as? UIImageView }
        XCTAssertEqual(images.count,2); XCTAssertTrue(images.allSatisfy { $0.image != nil })
        XCTAssertEqual(owner.view.subviews.compactMap { $0 as? UILabel }.map(\.text),["Congrats!","You cleared the stage."])
        owner.dispose(); window.isHidden = true
    }
    func testCapturedCleanupCannotDisposeAnotherPresentation() {
        let first = NativeTutorialCompleteController(resourceRoot:root), second = NativeTutorialCompleteController(resourceRoot:root)
        first.loadViewIfNeeded(); second.loadViewIfNeeded()
        let cleanup = first.captureCoverCleanup(); cleanup(); cleanup()
        XCTAssertEqual(first.phase,.disposed); XCTAssertEqual(second.phase,.entering); second.dispose()
    }
}
