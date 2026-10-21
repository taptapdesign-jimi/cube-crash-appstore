import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeHubBackpackFeedbackTests:XCTestCase {
    func testBackpackSwitchStaysOpenUntilExplicitReverseAndSurvivesParentExit() async throws {
        let button=UIButton(type:.custom),host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        button.setImage(assets.image("assets/nav/stats-nav.png",densityAware:true),for:.normal)
        button.frame=CGRect(x:40,y:80,width:40,height:48)
        window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(button);defer{window.isHidden=true}
        let closed=button.image(for:.normal)
        NativeHubBackpackFeedback.switchArtwork(on:button,open:true,assets:assets)
        XCTAssertNotNil(button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        button.layer.removeAllAnimations()
        XCTAssertNotNil(button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        XCTAssertEqual(button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey)?.duration,0.4)
        let openDeadline=Date().addingTimeInterval(2)
        while button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey) != nil,Date()<openDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertFalse(button.image(for:.normal) === closed)
        XCTAssertNil(button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        let start=CACurrentMediaTime()
        NativeHubBackpackFeedback.switchArtwork(on:button,open:false,assets:assets,delay:0.56*0.4)
        let reverse=try XCTUnwrap(button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        XCTAssertEqual(reverse.fillMode,.backwards)
        XCTAssertEqual(reverse.beginTime-(button.imageView?.layer.convertTime(start,from:nil) ?? start),0.224,accuracy:0.02)
        let deadline=Date().addingTimeInterval(2)
        while button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey) != nil,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(button.image(for:.normal) === closed)
        XCTAssertNil(button.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
    }
    func testModalLongPressReleaseDoesNotReplayAndCancelledContactCanRetap() async throws {
        let button=JimiV9PlainButton(type:.custom);button.setImage(UIImage(),for:.normal)
        button.enableArtworkTapFeedback();button.enableArtworkTapFeedback()
        button.sendActions(for:.touchDown)
        let layer=try XCTUnwrap(button.imageView).layer
        let start=try XCTUnwrap(layer.animation(forKey:NativeHubBackpackFeedback.animationKey)).beginTime
        try await Task.sleep(for:.milliseconds(460))
        button.playArtworkTapFeedback()
        if let animation=layer.animation(forKey:NativeHubBackpackFeedback.animationKey) {XCTAssertEqual(animation.beginTime,start)}
        button.sendActions(for:.touchDown)
        let second=try XCTUnwrap(layer.animation(forKey:NativeHubBackpackFeedback.animationKey)).beginTime
        XCTAssertGreaterThan(second,start)
        button.sendActions(for:.touchCancel)
        button.playArtworkTapFeedback()
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(layer.animation(forKey:NativeHubBackpackFeedback.animationKey)).beginTime,second)
    }
    func testSharedContactEndpointsAndSquashStretch() {
        XCTAssertEqual(NativeHUDTapMotion.duration,0.4)
        for i in NativeHUDTapMotion.poses.indices {
            let expected=NativeHUDTapMotion.poses[i],actual=NativeHUDTapMotion.pose(at:NativeHUDTapMotion.phases[i]*0.4)
            XCTAssertEqual(actual.x,expected.x,accuracy:0.00001);XCTAssertEqual(actual.y,expected.y,accuracy:0.00001);XCTAssertEqual(actual.offset,expected.offset,accuracy:0.00001)
        }
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
        XCTAssertEqual(contact?.duration,0.4)
        XCTAssertEqual(contact?.keyPath,"transform")
        XCTAssertTrue(CATransform3DIsIdentity(icon.layer.transform))
        XCTAssertTrue(CATransform3DIsIdentity((contact?.values?.last as! NSValue).caTransform3DValue))
        NativeHubBackpackFeedback.play(on:icon)
        XCTAssertEqual(icon.layer.animationKeys(),[NativeHubBackpackFeedback.animationKey])
        XCTAssertNotNil(header.layer.animation(forKey:"native-route"))
    }

    func testCartoonBounceCTAComposesWithExistingPressAndPreservesLayoutAndVisibility() throws {
        let host=UIView(frame:CGRect(x:0,y:0,width:390,height:844)),button=JimiV9PlainButton(type:.custom)
        let rect=CGRect(x:70,y:120,width:230,height:64);button.frame=rect;host.addSubview(button)
        button.enableCartoonBounce();button.enableCartoonBounce()
        XCTAssertEqual(host.subviews.count,1)
        XCTAssertEqual(button.convert(button.bounds,to:host),rect)
        let shell=button.cartoonBounceLayoutView
        XCTAssertFalse(shell === button)
        let press=CABasicAnimation(keyPath:"transform.scale");press.toValue=0.84;press.duration=0.12
        button.layer.add(press,forKey:"authored-press")
        button.sendActions(for:.touchDown)
        XCTAssertEqual(shell.layer.animation(forKey:NativeHubBackpackFeedback.animationKey)?.duration,0.4)
        XCTAssertNotNil(button.layer.animation(forKey:"authored-press"))
        button.isHidden=true;XCTAssertTrue(shell.isHidden);XCTAssertNil(shell.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        button.isHidden=false;button.setCartoonBounceFrame(rect.offsetBy(dx:5,dy:10))
        XCTAssertEqual(button.convert(button.bounds,to:host),rect.offsetBy(dx:5,dy:10))
        XCTAssertNil(shell.hitTest(CGPoint(x:-20,y:-20),with:nil))
    }
    func testSettingsToggleUsesCartoonBounceAndEmitsOneChangePerActivation() throws {
        let toggle=JimiNativeSettingsToggle(frame:CGRect(x:0,y:0,width:67,height:45))
        var changes=0;toggle.addAction(UIAction{_ in changes += 1},for:.valueChanged)
        toggle.layoutIfNeeded();toggle.sendActions(for:.touchUpInside)
        XCTAssertTrue(toggle.isOn);XCTAssertEqual(changes,1)
        let pill=try XCTUnwrap(toggle.subviews.first)
        let bounce=try XCTUnwrap(pill.layer.animation(forKey:NativeHubBackpackFeedback.animationKey) as? CAKeyframeAnimation)
        XCTAssertEqual(bounce.duration,0.4);XCTAssertEqual(bounce.keyPath,"transform")
        XCTAssertTrue(toggle.accessibilityActivate());XCTAssertFalse(toggle.isOn);XCTAssertEqual(changes,2)
        XCTAssertEqual(pill.layer.animationKeys()?.filter{$0==NativeHubBackpackFeedback.animationKey},[NativeHubBackpackFeedback.animationKey])
        XCTAssertNil(pill.layer.animation(forKey:"settings-toggle-bounce"),"Old uniform bounce is replaced while knob/color animation remains")
    }
    func testHomeCTAPreviewAddsBounceWithoutReplacingExistingPressShell() throws {
        let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        home.layoutIfNeeded()
        let button=home.ctaView,preview=try XCTUnwrap(button.superview),shell=try XCTUnwrap(preview.superview)
        button.sendActions(for:.touchDown)
        XCTAssertNotNil(shell.layer.animation(forKey:"cta-press"))
        XCTAssertEqual(preview.layer.animation(forKey:NativeHubBackpackFeedback.animationKey)?.duration,0.4)
        button.sendActions(for:.touchCancel)
        XCTAssertNotNil(shell.layer.animation(forKey:"cta-press"),"Original release remains on its own layer")
        let motion=NativeRouteMotion(home:home,hub:JimiV9HubView(frame:home.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
        motion.animate(motion.homeTracks(enter:false)){}
        XCTAssertNotNil(button.layer.animation(forKey:"native-route"))
        XCTAssertNotNil(preview.layer.animation(forKey:NativeHubBackpackFeedback.animationKey),"Route exit has a separate owner")
        home.cancelPan();motion.cancel()
        XCTAssertNil(preview.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
    }
    func testHomeEveryTabBouncesArtworkAndSurvivesImmediateExit() throws {
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
                let contact=try XCTUnwrap(icon.layer.animation(forKey:NativeHubBackpackFeedback.animationKey) as? CAKeyframeAnimation)
                XCTAssertEqual(contact.duration,0.4);XCTAssertEqual(contact.keyPath,"transform")
                XCTAssertEqual(contact.repeatCount,0)
                let poses=contact.values as! [NSValue]
                XCTAssertEqual(poses[1].caTransform3DValue.m11,1.16,accuracy:0.0001)
                XCTAssertEqual(poses[1].caTransform3DValue.m22,0.82,accuracy:0.0001)
                XCTAssertEqual(poses[2].caTransform3DValue.m42,-7)
                XCTAssertTrue(CATransform3DIsIdentity(poses.last!.caTransform3DValue))
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
