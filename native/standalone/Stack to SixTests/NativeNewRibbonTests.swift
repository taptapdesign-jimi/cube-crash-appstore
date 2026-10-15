import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeNewRibbonTests:XCTestCase {
    func testRibbonStartsHiddenThenFiniteFadeAndBounceKeepItsAuthoredLayout() throws {
        let ribbon=try XCTUnwrap(JimiNativeWorldRibbon.make(image:nil,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),cardSize:CGSize(width:90,height:133),scale:1,portal:false) as? JimiNativeNewRibbonView)
        XCTAssertEqual(ribbon.layer.opacity,0);let frame=ribbon.frame
        ribbon.enter(delay:0.08)
        let group=try XCTUnwrap(ribbon.layer.animation(forKey:"ribbon.motion") as? CAAnimationGroup)
        XCTAssertEqual(group.duration,0.36);XCTAssertEqual(group.repeatCount,0);XCTAssertEqual(group.fillMode,.backwards)
        let opacity=try XCTUnwrap(group.animations?.last as? CAKeyframeAnimation)
        XCTAssertEqual((opacity.values?.first as? NSNumber)?.doubleValue,0);XCTAssertEqual((opacity.values?.last as? NSNumber)?.doubleValue,1)
        let poses=try XCTUnwrap((group.animations?.first as? CAKeyframeAnimation)?.values as? [NSValue]).map{$0.caTransform3DValue}
        XCTAssertGreaterThan(poses.map{$0.m11}.max()!,1);XCTAssertEqual(poses.last!.m42,0)
        XCTAssertEqual(ribbon.frame,frame);XCTAssertEqual(ribbon.viewWithTag(991).map{($0 as? UILabel)?.attributedText?.string},"New")
    }
    func testExitRemovesOnlyAtOwnedCompletionAndStaleEnterCannotRemoveReplacement() throws {
        let parent=UIView(),ribbon=JimiNativeNewRibbonView();parent.addSubview(ribbon)
        ribbon.enter();let enter=try XCTUnwrap(ribbon.layer.animation(forKey:"ribbon.motion"))
        ribbon.exit();let exit=try XCTUnwrap(ribbon.layer.animation(forKey:"ribbon.motion"))
        XCTAssertTrue(ribbon.superview === parent);XCTAssertEqual(exit.duration,0.24)
        ribbon.animationDidStop(enter,finished:true);XCTAssertTrue(ribbon.superview === parent)
        ribbon.enter();XCTAssertEqual(ribbon.layer.opacity,0,"Retiring ribbon cannot re-enter during resource reconciliation")
        ribbon.animationDidStop(exit,finished:true);XCTAssertNil(ribbon.superview);XCTAssertNil(ribbon.layer.animationKeys())
    }
    func testWorldExitRetainsRibbonForTheNextVisibleAdmission() throws {
        let ribbon=JimiNativeNewRibbonView();ribbon.enter();ribbon.exit(remove:false);ribbon.enter()
        XCTAssertEqual(ribbon.layer.opacity,1);XCTAssertEqual(ribbon.layer.animation(forKey:"ribbon.motion")?.duration,0.36)
    }
}
