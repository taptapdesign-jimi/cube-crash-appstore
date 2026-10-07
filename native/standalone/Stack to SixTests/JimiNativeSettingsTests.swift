import XCTest
import UIKit
import WebKit
@testable import Stack_to_Six

@MainActor
private final class SettingsRouteWebView: WKWebView {
    var scripts: [String] = []
    override func evaluateJavaScript(_ script: String, completionHandler: (@MainActor @Sendable (Any?, Error?) -> Void)? = nil) {
        scripts.append(script); completionHandler?(true, nil)
    }
}

@MainActor
final class JimiNativeSettingsTests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only; never drive the physical phone")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else { throw XCTSkip("Isolated QA Simulator only") }
    }
    private var root: URL { NativeTestResources.root }
    private var preferences: [String: Any] { ["presentationEpoch": 10, "gameSoundsEnabled": false, "musicEnabled": true, "hapticsEnabled": true, "developerToolsAvailable": true] }

    func testUIKitTogglesProjectCanonicalValuesAndSendEpochOwnedCommands() {
        let settings = JimiNativeSettingsView(frame: CGRect(x: 0,y: 0,width: 390,height: 844), assets: JimiV9Artwork(resourceRoot: root))
        XCTAssertTrue(settings.apply(preferences)); settings.layoutSubviews()
        XCTAssertFalse(settings.switches[0].isOn); XCTAssertTrue(settings.switches[1].isOn)
        var commands: [(String,Bool,Int)] = []
        settings.onPreference = { commands.append(($0,$1,$2)) }
        settings.switches[1].setOn(false, animated: false)
        settings.switches[1].sendActions(for: .valueChanged)
        XCTAssertEqual(commands.count,1); XCTAssertEqual(commands[0].0,"musicEnabled")
        XCTAssertFalse(commands[0].1); XCTAssertEqual(commands[0].2,10)
        XCTAssertFalse(settings.apply(["presentationEpoch":11,"musicEnabled":false]))
        XCTAssertEqual(settings.presentationEpoch,10,"Malformed updates cannot replace accepted identity")
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844)] {
            settings.frame.size = size; settings.layoutSubviews()
            XCTAssertGreaterThan(settings.scroll.frame.height,0)
            XCTAssertLessThanOrEqual(settings.footer.frame.maxY,size.height)
            for toggle in settings.switches {
                XCTAssertGreaterThanOrEqual(toggle.frame.minX,0)
                XCTAssertLessThanOrEqual(toggle.frame.maxX,settings.scroll.bounds.width)
                XCTAssertEqual(toggle.frame.size,CGSize(width:67,height:45))
            }
        }
    }

    func testSettingsAnimationViewportIsFullWidthAndNeverClipsPaddedRows() {
        for width in [CGFloat(320),390,430] {
            let settings = JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:width,height:844),assets:JimiV9Artwork(resourceRoot:root))
            settings.layoutSubviews()
            XCTAssertEqual(settings.scroll.frame.minX,0)
            XCTAssertEqual(settings.scroll.bounds.width,width)
            XCTAssertFalse(settings.clipsToBounds);XCTAssertFalse(settings.scroll.clipsToBounds)
            XCTAssertEqual(settings.switches[0].convert(settings.switches[0].bounds,to:settings).maxX,width-24,accuracy:0.001)
            for row in settings.rows {
                XCTAssertEqual(row.frame.minX,24);XCTAssertEqual(row.bounds.width,width-48)
                var parent: UIView? = row
                while let view = parent {XCTAssertFalse(view.clipsToBounds);parent = view.superview}
                // The authored overshoot may paint beyond the padded layout box.
                row.transform = CGAffineTransform(scaleX:1.12,y:1.12)
                XCTAssertLessThan(row.frame.minX,24)
                XCTAssertGreaterThan(row.frame.maxX,width-24)
            }
            for divider in settings.dividers {XCTAssertEqual(divider.frame.minX,24);XCTAssertEqual(divider.bounds.width,width-48)}
        }
    }

    func testSettingsLayoutKeepsV10ExitPivotsWhenModelIsCollapsed() {
        let settings = JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        settings.layoutSubviews()
        let targets = settings.tracks(enter:false).map{$0.0}
        let geometry = targets.map{($0.bounds,$0.center)}
        for target in targets {target.layer.transform = CATransform3DMakeScale(0,0,1)}
        settings.layoutSubviews()
        for (index,target) in targets.enumerated() {
            XCTAssertEqual(target.bounds,geometry[index].0,"v10 scale exit must not change the element's layout bounds")
            XCTAssertEqual(target.center,geometry[index].1,"Each element collapses around its own unchanged center")
        }
    }

    func testPrivacyUsesCenteredV10PaperAndLifecycleOwnedClose() async throws {
        let privacy = JimiNativePrivacyController(assets:JimiV9Artwork(resourceRoot:root))
        privacy.loadViewIfNeeded();privacy.view.frame = CGRect(x:0,y:0,width:390,height:844)
        privacy.viewDidLayoutSubviews();privacy.viewDidAppear(false)
        XCTAssertEqual(privacy.card.bounds.width,342)
        XCTAssertEqual(privacy.card.center.y-privacy.card.bounds.height*0.05,422,accuracy:0.001)
        XCTAssertEqual(privacy.flip.layer.anchorPoint.y,0.46)
        XCTAssertEqual(privacy.paper.layer.contentsRect.minY,0)
        XCTAssertEqual(privacy.paper.layer.cornerRadius,40)
        XCTAssertNotNil(privacy.paper.image)
        XCTAssertEqual(privacy.close.frame.size,CGSize(width:52,height:52))
        XCTAssertTrue(privacy.copy.text.contains("Read Privacy Policy"))
        XCTAssertEqual(privacy.card.layer.animation(forKey:"privacy-enter")?.duration,0.65)
        XCTAssertEqual(privacy.idle.layer.animation(forKey:"privacy-idle")?.duration,6.8)
        privacy.close.sendActions(for:.touchUpInside)
        XCTAssertEqual(privacy.card.layer.animation(forKey:"privacy-exit")?.duration,0.65)
        XCTAssertNotNil(privacy.card.layer.animation(forKey:"privacy-exit-opacity"))
        let geometry = [privacy.card,privacy.flip,privacy.idle].map { ($0.bounds,$0.center) }
        privacy.viewDidLayoutSubviews()
        for (i,target) in [privacy.card,privacy.flip,privacy.idle].enumerated() {
            XCTAssertEqual(target.bounds,geometry[i].0);XCTAssertEqual(target.center,geometry[i].1)
        }
        privacy.viewDidDisappear(false)
        XCTAssertNil(privacy.idle.layer.animationKeys())
    }

    func testSettingsTracksPreserveAuthoredHeaderAndStaggerWithoutIdle() throws {
        let settings = JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        let enter = settings.tracks(enter:true), exit = settings.tracks(enter:false)
        XCTAssertTrue(enter.first!.0 === settings.header)
        XCTAssertTrue(exit.last!.0 === settings.header)
        XCTAssertEqual(enter[0].1.tweens[0].duration,0.5)
        XCTAssertEqual(enter[1].1.tweens[0].begin,0.05)
        XCTAssertEqual(enter[2].1.tweens[0].begin,0.13,accuracy:0.001)
        let expected: [UIView] = [settings.rows[2],settings.dividers[1],settings.rows[1],settings.dividers[0],settings.rows[0],settings.footer,settings.header]
        XCTAssertEqual(exit.count,expected.count)
        for (i,item) in exit.enumerated() {
            XCTAssertTrue(item.0 === expected[i])
            let tween = item.1.tweens[0]
            XCTAssertEqual(tween.begin,Double(i)*0.04+(i==6 ? 0.05 : 0),accuracy:0.000001)
            XCTAssertEqual(tween.duration,0.34)
            XCTAssertEqual(item.1.pose(at:tween.begin+tween.duration*0.5).scaleX,1-JimiV9Motion.Ease.backIn(1.7).value(0.5),accuracy:0.000001)
        }
        XCTAssertEqual(exit.last!.1.tweens[0].duration,0.34)
        XCTAssertEqual(enter[0].1.pose(at:0).opacity,0,accuracy:0.000001)
        XCTAssertEqual(enter[0].1.pose(at:0.5).opacity,1)
    }

    func testRealNativeSettingsRouteNeverActivatesWebSettingsAndReturnsToNativeSlider() async throws {
        let web = SettingsRouteWebView(frame:CGRect(x:0,y:0,width:390,height:844))
        let controller = JimiHomeHubController(web:web,resourceRoot:root)
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer { controller.dispose();window.isHidden=true }
        let incoming = expectation(description:"Native Settings incoming starts")
        var motions = 0, starts: [String] = []
        controller.onDiagnosticEvent = { event in
            if case .start(_,let label)=event {starts.append(label)}
            if case .motionStart(let id)=event,id==1 {motions+=1;if motions==2 {incoming.fulfill()}}
        }
        controller.receive(["kind":"present","route":"home","snapshot":["homeSlide":2,"settings":preferences]])
        XCTAssertNotNil(controller.home.heroImages[2].layer.animation(forKey:"native-hero-idle"))
        controller.home.ctaView.sendActions(for:.touchUpInside)
        controller.receive(["kind":"ready","requestId":1,"destination":["kind":"settings"]])
        await fulfillment(of:[incoming],timeout:5)
        XCTAssertTrue(controller.home.isHidden);XCTAssertFalse(controller.settings.isHidden)
        XCTAssertTrue(web.accessibilityElementsHidden)
        let group = try XCTUnwrap(controller.settings.header.layer.animation(forKey:"native-route") as? CAAnimationGroup)
        let alpha = try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
        XCTAssertEqual((alpha.values?.first as? NSNumber)?.doubleValue ?? -1,0,accuracy:0.000001)
        XCTAssertFalse(web.scripts.contains{$0.contains("activateSource")},"Settings must never expose a web source")
        try await Task.sleep(nanoseconds:1_050_000_000)
        XCTAssertTrue(controller.settings.isUserInteractionEnabled)
        controller.settings.back.sendActions(for:.touchUpInside)
        controller.settings.back.sendActions(for:.touchUpInside)
        XCTAssertEqual(starts,["home->settings","settings->home"])
        controller.receive(["kind":"ready","requestId":2,"destination":["kind":"home"]])
        try await Task.sleep(nanoseconds:1_650_000_000)
        XCTAssertTrue(controller.settings.isHidden);XCTAssertFalse(controller.home.isHidden)
        XCTAssertEqual(controller.home.selectedSlide,2)
        let idleLayer = controller.home.heroImages[2].layer
        XCTAssertNotNil(idleLayer.animation(forKey:"native-hero-idle"))
        controller.suspend();XCTAssertEqual(idleLayer.speed,0)
        controller.resume();XCTAssertEqual(idleLayer.speed,1)
        XCTAssertFalse(web.scripts.contains{$0.contains("activateSource")})
    }

    func testArcadeHeroAndSliderRemainUIKitWithCanonicalGameLaunchOnly() {
        let home = JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        home.selectSlide(1,animated:false);home.layoutSubviews()
        XCTAssertEqual(home.heroView.accessibilityIdentifier,"native.home.hero.1")
        XCTAssertEqual(home.ctaView.title(for:.normal),"Arcade")
        XCTAssertTrue(home.heroView is UIButton)
        var activated: Int?
        home.onActivate={activated=$0}
        (home.heroView as? UIButton)?.sendActions(for:.touchUpInside)
        XCTAssertEqual(activated,1)
        XCTAssertFalse(home.sliderTrack.subviews.contains{$0 is WKWebView})
    }
    func testHomeArtworkEnlargementAndVisibleOnlyV10IdleOwnership() throws {
        let home = JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        home.layoutSubviews()
        for i in 0..<3 {
            home.selectSlide(i,animated:false);home.startHeroIdle()
            let layer = home.heroImages[i].layer
            XCTAssertEqual(home.heroImages[i].bounds.width,336*1.05,accuracy:0.001)
            XCTAssertEqual(home.heroImages[i].center.x,168,accuracy:0.001)
            let animation = try XCTUnwrap(layer.animation(forKey:"native-hero-idle") as? CAKeyframeAnimation)
            XCTAssertEqual(animation.duration,[4.0,3.0,3.5][i])
            let peak = try XCTUnwrap((animation.values?[1] as? NSValue)?.caTransform3DValue)
            XCTAssertEqual(peak.m42,[-6.0,-8.0,-7.0][i],accuracy:0.001)
            XCTAssertEqual(sqrt(peak.m11*peak.m11+peak.m12*peak.m12),[1.05,1.02,1.03][i],accuracy:0.001)
            for other in 0..<3 where other != i {XCTAssertNil(home.heroImages[other].layer.animationKeys())}
            home.pauseHeroIdle();XCTAssertEqual(layer.speed,0)
            home.startHeroIdle();XCTAssertEqual(layer.speed,1)
            let geometry = home.heroImages[i].bounds;home.layoutSubviews();XCTAssertEqual(home.heroImages[i].bounds,geometry)
        }
        home.isHidden = true
        for image in home.heroImages {XCTAssertNil(image.layer.animationKeys());XCTAssertEqual(image.layer.speed,1)}
        home.startHeroIdle();XCTAssertNil(home.heroImages[2].layer.animationKeys())
        home.isHidden = false;home.startHeroIdle();home.stopHeroIdle();home.stopHeroIdle()
        XCTAssertNil(home.heroImages[2].layer.animationKeys())
    }

}
