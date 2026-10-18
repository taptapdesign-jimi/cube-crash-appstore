import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadeModalMotionTests: XCTestCase {
    private func wait(_ condition: () -> Bool) async throws {
        let end = Date().addingTimeInterval(4)
        while !condition(), Date() < end { try await Task.sleep(for: .milliseconds(20)) }
        XCTAssertTrue(condition())
    }
    private func descendant(_ view: UIView, id: String) -> UIView? {
        if view.accessibilityIdentifier == id { return view }
        return view.subviews.lazy.compactMap { self.descendant($0, id: id) }.first
    }
    func testPlayAndPaperExitTogetherWithoutRelayoutJumpAndDisposalCancels() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer {window.isHidden=true}
        for background in [false,true] {
            let modal=NativeArcadeWorldModal(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),index:0)
            var completed=0
            modal.onFinish={play in XCTAssertTrue(play);completed += 1}
            host.view.addSubview(modal);modal.reveal()
            defer {modal.dispose()}
            try await wait {modal.accessibilityValue == "ready"}
            let button=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.play") as? UIButton)
            let card=try XCTUnwrap(modal.modalDrag?.pan.view)
            let paper=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.paper"))
            let art=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.art"))
            let idle=try XCTUnwrap(art.superview)
            let originalBounds=[card.bounds,paper.bounds,idle.bounds,art.bounds,button.bounds]
            let originalCenters=[card.center,paper.center,idle.center,art.center,button.center]
            button.sendActions(for:.touchDown)
            XCTAssertNotNil(button.layer.animation(forKey:"arcade.cta.press"))
            button.sendActions(for:.touchUpInside)
            XCTAssertNotNil(button.layer.animation(forKey:"arcade.cta.exit"))
            XCTAssertNotNil(card.layer.animation(forKey:"arcade.modal.exit"))
            XCTAssertNil(button.layer.animation(forKey:"arcade.cta.release"))
            XCTAssertEqual(button.layer.transform.m11,0,accuracy:0.000001)
            XCTAssertEqual(button.layer.transform.m42,18,accuracy:0.000001)
            XCTAssertEqual(button.layer.opacity,0)
            XCTAssertFalse(button.isEnabled)
            let retiredIdle=idle.layer.transform,retiredArt=art.layer.transform
            modal.setNeedsLayout();modal.layoutIfNeeded()
            XCTAssertEqual([card.bounds,paper.bounds,idle.bounds,art.bounds,button.bounds],originalBounds)
            XCTAssertEqual([card.center,paper.center,idle.center,art.center,button.center],originalCenters)
            XCTAssertTrue(CATransform3DEqualToTransform(idle.layer.transform,retiredIdle))
            XCTAssertTrue(CATransform3DEqualToTransform(art.layer.transform,retiredArt))
            button.sendActions(for:.touchUpInside)
            let close=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.close") as? UIButton)
            close.sendActions(for:.touchUpInside)
            try await Task.sleep(for:.milliseconds(150))
            XCTAssertEqual(completed,0)
            if background {
                modal.setForeground(false)
                try await Task.sleep(for:.milliseconds(350))
                XCTAssertEqual(completed,0)
                modal.setForeground(true)
            }
            try await Task.sleep(for:.milliseconds(300))
            XCTAssertEqual(completed,0)
            try await wait {completed == 1}
        }
        let modal=NativeArcadeWorldModal(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),index:1)
        host.view.addSubview(modal);modal.reveal()
        try await wait {modal.accessibilityValue == "ready"}
        var finishes=0;modal.onFinish={_ in finishes += 1}
        let button=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.play") as? UIButton)
        button.sendActions(for:.touchDown);button.sendActions(for:.touchUpInside)
        modal.dispose()
        try await Task.sleep(for:.milliseconds(750))
        XCTAssertEqual(finishes,0)
        XCTAssertNil(modal.superview)
    }

    func testVisibleIdleBackgroundPauseAndShortLongDragOwnership() async throws {
        let host = UIViewController(), window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host; window.makeKeyAndVisible(); host.loadViewIfNeeded()
        let modal = NativeArcadeWorldModal(frame: window.bounds, assets: JimiV9Artwork(resourceRoot: NativeTestResources.root), index: 2)
        host.view.addSubview(modal)
        defer { modal.dispose(); window.isHidden = true }
        var dismissed = 0
        modal.onFinish = { play in XCTAssertFalse(play); dismissed += 1; modal.dispose() }
        modal.reveal()
        try await wait { modal.accessibilityValue == "ready" }
        let art = try XCTUnwrap(descendant(modal, id: "native.arcade-world-modal.art"))
        let idle = try XCTUnwrap(art.superview), drag = try XCTUnwrap(modal.modalDrag)
        let card = try XCTUnwrap(drag.pan.view)
        let play = try XCTUnwrap(descendant(modal, id: "native.arcade-world-modal.play") as? UIButton)
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertNotNil(idle.layer.animation(forKey: "arcade.modal.idle"))
            XCTAssertNotNil(art.layer.animation(forKey: "arcade.modal.art.idle"))
        }
        drag.begin(); drag.move(CGPoint(x: 0, y: 50))
        XCTAssertEqual(idle.layer.speed, 0)
        drag.finish(CGPoint(x: 0, y: 50), cancelled: false)
        XCTAssertEqual(dismissed, 0)
        XCTAssertEqual(idle.layer.speed, 1)
        XCTAssertTrue(CATransform3DEqualToTransform(card.layer.transform, CATransform3DIdentity))
        drag.begin(); drag.move(CGPoint(x: 0, y: 120))
        modal.setForeground(false)
        XCTAssertEqual(modal.layer.speed, 0)
        XCTAssertFalse(play.isEnabled)
        XCTAssertFalse(modal.isUserInteractionEnabled)
        drag.finish(CGPoint(x: 0, y: 120), cancelled: false)
        XCTAssertEqual(dismissed, 0)
        modal.setForeground(true)
        XCTAssertEqual(modal.layer.speed, 1)
        XCTAssertTrue(play.isEnabled)
        drag.begin(); drag.move(CGPoint(x: 0, y: 120)); drag.finish(CGPoint(x: 0, y: 120), cancelled: false)
        XCTAssertNil(idle.layer.animation(forKey: "arcade.modal.idle"))
        XCTAssertNil(art.layer.animation(forKey: "arcade.modal.art.idle"))
        try await wait { dismissed == 1 }
        XCTAssertNil(modal.superview)
        XCTAssertNil(modal.modalDrag)
        XCTAssertNil(art.layer.animationKeys())
    }
    func testDisposalDuringEntranceCannotRecreateIdleOrInvokePlay() async throws {
        let modal = NativeArcadeWorldModal(frame: CGRect(x: 0, y: 0, width: 390, height: 844), assets: JimiV9Artwork(resourceRoot: NativeTestResources.root), index: 0)
        var finishes = 0
        modal.onFinish = { _ in finishes += 1 }
        modal.reveal(); modal.setForeground(false); modal.dispose(); modal.setForeground(true)
        try await Task.sleep(for: .milliseconds(750))
        XCTAssertEqual(finishes, 0)
        XCTAssertNil(modal.modalDrag)
        func assertNoAnimations(_ view: UIView) {
            XCTAssertNil(view.layer.animationKeys())
            view.subviews.forEach(assertNoAnimations)
        }
        assertNoAnimations(modal)
    }
}
