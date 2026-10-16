import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeHubBackpackFeedbackTests:XCTestCase {
    func testExactSourceContactEndpointsAndOvershoot() {
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0),1)
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0.077),0.92,accuracy:0.00000001)
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0.154),1.06,accuracy:0.00000001)
        XCTAssertEqual(NativeHubBackpackFeedback.scale(at:0.22),1,accuracy:0.00000001)
        XCTAssertGreaterThan(NativeHubBackpackFeedback.ease(0.5),1)
    }
    func testOnlyCurrentVisibleHubContactAnimatesImageAndRapidContactReplacesOwnTrack() {
        let button=UIButton(type:.custom);button.setImage(UIImage(),for:.normal)
        let owner=NativeHubBackpackFeedback(button:button)
        XCTAssertFalse(owner.activate(generation:1));owner.setActive(true,generation:1)
        XCTAssertTrue(owner.activate(generation:1));XCTAssertTrue(owner.activate(generation:1))
        XCTAssertEqual(button.imageView?.layer.animationKeys(),[NativeHubBackpackFeedback.animationKey]);XCTAssertNil(button.layer.animationKeys())
        owner.setActive(false,generation:2);XCTAssertNil(button.imageView?.layer.animationKeys());XCTAssertFalse(owner.activate(generation:1))
        owner.setActive(true,generation:1);XCTAssertFalse(owner.activate(generation:1));XCTAssertEqual(owner.acceptedContacts,2)
        owner.dispose();owner.dispose();owner.setActive(true,generation:3);XCTAssertFalse(owner.activate(generation:3))
    }
    func testContactSurvivesParentRouteReplacementAndKeepsModelPose() {
        let header=UIView(),icon=UIImageView()
        header.addSubview(icon)
        NativeHubBackpackFeedback.play(on:icon)
        header.layer.removeAllAnimations()
        let exit=CABasicAnimation(keyPath:"transform.scale");exit.toValue=0;exit.duration=0.48
        header.layer.add(exit,forKey:"native-route")
        let contact=icon.layer.animation(forKey:NativeHubBackpackFeedback.animationKey) as? CAKeyframeAnimation
        XCTAssertEqual(contact?.duration,0.22)
        XCTAssertEqual(contact?.keyPath,"transform.scale")
        XCTAssertTrue(CATransform3DIsIdentity(icon.layer.transform))
        XCTAssertEqual((contact?.values?.last as? NSNumber)?.doubleValue,1)
        NativeHubBackpackFeedback.play(on:icon)
        XCTAssertEqual(icon.layer.animationKeys(),[NativeHubBackpackFeedback.animationKey])
        XCTAssertNotNil(header.layer.animation(forKey:"native-route"))
    }

    func testHomeEveryTabBouncesArtworkAndSurvivesImmediateExit() {
        let root=Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
        let artwork=JimiV9Artwork(resourceRoot:root)
        let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:artwork)
        let hub=JimiV9HubView(frame:home.bounds,assets:artwork)
        let motion=NativeRouteMotion(home:home,hub:hub)
        for index in home.navigationIconViews.indices {
            // Both selecting a new tab and tapping the selected tab use the same child owner.
            for _ in 0..<2 {
                motion.selectSlide(index) {}
                let icon=home.navigationIconViews[index]
                XCTAssertNotNil(icon.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
                XCTAssertNil(home.navigationButtonViews[index].layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
                motion.cancelSelectionLayout()
                motion.animate(motion.homeTracks(enter:false)) {}
                XCTAssertNotNil(icon.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
                motion.cancel()
            }
        }
    }
    func testPlainNavigationButtonKeepsNormalPaintOnPress() {
        let button=JimiV9PlainButton(type:.custom)
        button.isHighlighted=true
        XCTAssertFalse(button.isHighlighted)
        XCTAssertFalse(button.adjustsImageWhenHighlighted)
        XCTAssertFalse(button.showsTouchWhenHighlighted)
    }

}
