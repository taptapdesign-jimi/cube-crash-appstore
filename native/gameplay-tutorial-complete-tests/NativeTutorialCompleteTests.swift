import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeTutorialCompleteTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    private func continueButton(_ owner:NativeTutorialCompleteController)->UIButton {
        func find(_ view:UIView)->UIButton? {
            if let button=view as? UIButton,button.accessibilityIdentifier=="native.tutorial-complete.continue" {return button}
            return view.subviews.lazy.compactMap{find($0)}.first
        }
        return find(owner.visualUnit)!
    }
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
        XCTAssertFalse(continueButton(owner).isUserInteractionEnabled)
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
        let button = continueButton(owner)
        XCTAssertEqual(button.currentTitle,"Continue"); XCTAssertEqual(button.accessibilityIdentifier,"native.tutorial-complete.continue")
        XCTAssertGreaterThanOrEqual(button.frame.minX,0); XCTAssertLessThanOrEqual(button.frame.maxX,390)
        XCTAssertLessThanOrEqual(button.frame.maxY,667); XCTAssertGreaterThan(button.bounds.height,44)
        let images = owner.visualUnit.subviews.compactMap { $0 as? UIImageView }
        XCTAssertEqual(images.count,2); XCTAssertTrue(images.allSatisfy { $0.image != nil })
        XCTAssertEqual(owner.visualUnit.subviews.compactMap { $0 as? UILabel }.map(\.text),["Tutorial completed","You’re ready to play!"])
        owner.dispose(); window.isHidden = true
    }
    func testIndividualElementsFollowSharedHomepageExitWithThirtyMillisecondStagger() {
        let owner=NativeTutorialCompleteController(resourceRoot:root,reducedMotion:false)
        let window=mount(owner);owner.sampleEnter(seconds:1)
        let image=UIGraphicsImageRenderer(bounds:owner.view.bounds).image{_ in owner.view.drawHierarchy(in:owner.view.bounds,afterScreenUpdates:true)}
        try? image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-tutorial-win-mounted.png"))
        owner.requestContinue()
        owner.sampleElementExit(seconds:0.18)
        let labels=owner.visualUnit.subviews.compactMap{$0 as? UILabel}
        let button=continueButton(owner)
        XCTAssertEqual(labels[0].transform.a,1.18,accuracy:1e-6)
        XCTAssertLessThan(labels[1].transform.a,labels[0].transform.a)
        XCTAssertEqual(owner.visualUnit.transform,.identity)
        owner.sampleElementExit(seconds:0.516)
        XCTAssertEqual(labels[0].alpha,0)
        XCTAssertEqual(button.alpha,1)
        owner.sampleElementExit(seconds:0.606)
        XCTAssertTrue((labels as [UIView]+owner.visualUnit.subviews.compactMap{$0 as? UIImageView}+[button]).allSatisfy{$0.alpha==0})
        XCTAssertEqual(owner.visualUnit.transform,.identity)
        XCTAssertEqual(owner.view.backgroundColor?.cgColor.alpha,1)
        owner.dispose();window.isHidden=true
    }
    func testEnterUsesSameQuickElementOrderWithoutScalingWholeCover() {
        let owner=NativeTutorialCompleteController(resourceRoot:root,reducedMotion:false)
        let window=mount(owner);defer{owner.dispose();window.isHidden=true}
        let labels=owner.visualUnit.subviews.compactMap{$0 as? UILabel}
        let button=continueButton(owner)
        owner.sampleEnter(seconds:0.02)
        XCTAssertGreaterThan(labels[0].transform.a,0)
        XCTAssertEqual(labels[1].transform.a,0,accuracy:1e-6)
        XCTAssertEqual(button.transform.a,0,accuracy:1e-6)
        XCTAssertFalse(button.isUserInteractionEnabled)
        owner.sampleEnter(seconds:0.74)
        XCTAssertTrue(owner.visualUnit.subviews.allSatisfy{abs($0.transform.a-1)<1e-6 && $0.alpha==1})
        XCTAssertTrue(button.isUserInteractionEnabled)
        XCTAssertEqual(owner.visualUnit.transform,.identity)
    }
    func testCapturedCleanupCannotDisposeAnotherPresentation() {
        let first = NativeTutorialCompleteController(resourceRoot:root), second = NativeTutorialCompleteController(resourceRoot:root)
        first.loadViewIfNeeded(); second.loadViewIfNeeded()
        let cleanup = first.captureCoverCleanup(); cleanup(); cleanup()
        XCTAssertEqual(first.phase,.disposed); XCTAssertEqual(second.phase,.entering); second.dispose()
    }
    func testMountedWinPaperStretchesTextureToViewportBottomAndSurvivesUnitMotion()throws {
        let owner=NativeTutorialCompleteController(resourceRoot:root,reducedMotion:false)
        let window=mount(owner);defer{owner.dispose();window.isHidden=true}
        let paper=try XCTUnwrap(owner.view.subviews.compactMap{$0 as? NativeAppPaperSurface}.first)
        let texture=try XCTUnwrap(paper.subviews.first as? UIImageView)
        XCTAssertEqual(texture.contentMode,.scaleAspectFill)
        for size in [CGSize(width:390,height:844),CGSize(width:390,height:667),CGSize(width:430,height:932)] {
            owner.view.frame=CGRect(origin:.zero,size:size);owner.view.setNeedsLayout();owner.view.layoutIfNeeded();paper.layoutIfNeeded()
            for seconds in [0.0,0.2,0.45,0.9] {
                owner.sampleEnter(seconds:seconds)
                XCTAssertEqual(paper.frame,owner.view.bounds)
                XCTAssertGreaterThanOrEqual(texture.frame.width,paper.bounds.width)
                XCTAssertGreaterThanOrEqual(texture.frame.maxY,paper.bounds.maxY)
                XCTAssertTrue(paper.clipsToBounds)
                XCTAssertEqual(paper.transform,.identity)
                XCTAssertEqual(paper.alpha,1)
            }
        }
    }
}
