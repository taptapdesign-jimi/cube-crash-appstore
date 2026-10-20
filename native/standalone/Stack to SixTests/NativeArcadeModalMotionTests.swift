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
    func testCloseEmitsSemanticBackOnceAtAcceptedExit() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        let modal=NativeArcadeWorldModal(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),index:0)
        defer{modal.dispose();window.isHidden=true}
        var cues:[String]=[];modal.onFeedback={cues.append($0)}
        host.view.addSubview(modal);modal.reveal()
        try await wait{modal.accessibilityValue == "ready"}
        let close=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.close") as? UIButton)
        close.sendActions(for:.touchUpInside);close.sendActions(for:.touchUpInside)
        XCTAssertEqual(cues,["back"])
        modal.dispose();close.sendActions(for:.touchUpInside)
        XCTAssertEqual(cues,["back"])
    }
    func testPlayAndPaperExitTogetherWithoutRelayoutJumpAndDisposalCancels() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer {window.isHidden=true}
        for background in [false,true] {
            let modal=NativeArcadeWorldModal(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),index:0)
            var completed=0,exitStarts=0,cues:[String]=[]
            modal.onFeedback={cues.append($0)}
            modal.onPlayExitStart={exitStarts += 1}
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
            XCTAssertEqual(exitStarts,1);XCTAssertEqual(completed,0);XCTAssertEqual(cues,["cta"])
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
            XCTAssertEqual(completed,0);XCTAssertEqual(cues,["cta"])
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
    func testFiveClusteredCloudsBehindEachIllustrationMovePauseResumeAndRetireWithoutRetention() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer{window.isHidden=true}
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for index in 0..<3 {
            weak var retired:NativeArcadeWorldModal?
            do {
                let modal=NativeArcadeWorldModal(frame:window.bounds,assets:assets,index:index)
                retired=modal;host.view.addSubview(modal);modal.reveal()
                try await wait{modal.accessibilityValue == "ready"}
                let stage=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.clouds"))
                let art=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.art"))
                let parent=try XCTUnwrap(stage.superview)
                XCTAssertTrue(parent === art.superview)
                XCTAssertLessThan(try XCTUnwrap(parent.subviews.firstIndex(of:stage)),try XCTUnwrap(parent.subviews.firstIndex(of:art)))
                let clouds=stage.subviews.compactMap{$0 as? UIImageView}
                XCTAssertEqual(clouds.count,5);XCTAssertEqual(Set(clouds.map{$0.bounds.width}).count,5)
                for (ordinal,cloud) in clouds.enumerated() {
                    XCTAssertLessThanOrEqual(cloud.bounds.width,(art.bounds.width+20)*[272.0,188,248,166,184][ordinal]/390*1.2+0.001)
                }
                let meanX=clouds.reduce(CGFloat.zero){$0+$1.center.x-50}/5
                let meanY=clouds.reduce(CGFloat.zero){$0+$1.center.y}/5
                switch index {
                case 0:XCTAssertGreaterThan(meanY,(stage.bounds.height-40)/2)
                case 1:XCTAssertLessThan(meanX,(stage.bounds.width-50)/2)
                default:XCTAssertGreaterThan(meanX,(stage.bounds.width-50)/2)
                }
                XCTAssertLessThan(stage.layer.zPosition,art.layer.zPosition)
                let envelopes=try clouds.map { item -> CGRect in
                    let animation=try XCTUnwrap(item.layer.animation(forKey:"arcade.modal.cloud.idle") as? CAKeyframeAnimation)
                    return try XCTUnwrap(animation.values).reduce(CGRect.null) { bounds,value in
                        let pose=(value as! NSValue).caTransform3DValue
                        XCTAssertEqual(pose.m43,0);XCTAssertEqual(pose.m33,1)
                        let rect=CGRect(x:-item.bounds.width/2,y:-item.bounds.height/2,width:item.bounds.width,height:item.bounds.height)
                            .applying(CGAffineTransform(a:pose.m11,b:pose.m12,c:pose.m21,d:pose.m22,tx:pose.m41,ty:pose.m42))
                            .offsetBy(dx:item.center.x,dy:item.center.y)
                        return bounds.union(rect)
                    }
                }
                for envelope in envelopes {XCTAssertTrue(stage.bounds.contains(envelope))}
                var connected:Set<Int>=[0]
                for _ in clouds.indices {
                    for candidate in clouds.indices where !connected.contains(candidate) {
                        if connected.contains(where:{clouds[$0].frame.insetBy(dx:12,dy:12).intersects(clouds[candidate].frame.insetBy(dx:12,dy:12))}) {
                            connected.insert(candidate)
                        }
                    }
                }
                XCTAssertEqual(connected.count,5,"Five clouds stay one connected bank throughout bounded motion")
                XCTAssertFalse(stage.isUserInteractionEnabled)
                let originalIdle=try XCTUnwrap(art.layer.animation(forKey:"arcade.modal.art.idle") as? CAKeyframeAnimation)
                XCTAssertEqual(originalIdle.duration,6.8)
                for value in try XCTUnwrap(originalIdle.values) {
                    XCTAssertEqual(try XCTUnwrap(value as? NSValue).caTransform3DValue.m41,0)
                }
                for cloud in clouds {
                    XCTAssertNotNil(cloud.image);XCTAssertTrue(stage.bounds.contains(cloud.frame))
                    XCTAssertEqual(cloud.layer.animationKeys(),["arcade.modal.cloud.idle"])
                }
                let cloud=try XCTUnwrap(clouds.first)
                let initial=try XCTUnwrap(cloud.layer.presentation()).transform
                try await Task.sleep(for:.milliseconds(180))
                let moving=try XCTUnwrap(cloud.layer.presentation()).transform
                XCTAssertEqual(moving.m43,0);XCTAssertEqual(moving.m33,1)
                XCTAssertGreaterThan(abs(moving.m41-initial.m41)+abs(moving.m42-initial.m42),0.01)
                modal.setForeground(false)
                try await Task.sleep(for:.milliseconds(40))
                let held=try XCTUnwrap(cloud.layer.presentation()).transform
                try await Task.sleep(for:.milliseconds(130))
                let paused=try XCTUnwrap(cloud.layer.presentation()).transform
                XCTAssertEqual(held.m41,paused.m41,accuracy:0.001);XCTAssertEqual(held.m42,paused.m42,accuracy:0.001)
                modal.setForeground(true)
                for item in clouds {XCTAssertEqual(item.layer.animationKeys(),["arcade.modal.cloud.idle"])}
                modal.refreshCloudIdle(reducedMotion:true)
                for item in clouds {XCTAssertNil(item.layer.animationKeys())}
                modal.setForeground(false);modal.refreshCloudIdle(reducedMotion:false)
                for item in clouds {XCTAssertNil(item.layer.animationKeys())}
                modal.setForeground(true)
                for item in clouds {XCTAssertEqual(item.layer.animationKeys(),["arcade.modal.cloud.idle"])}
                let close=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.close") as? UIButton)
                close.sendActions(for:.touchUpInside)
                for item in clouds {XCTAssertNil(item.layer.animationKeys())}
                modal.setForeground(false);modal.setForeground(true)
                for item in clouds {XCTAssertNil(item.layer.animationKeys())}
                modal.dispose();modal.dispose()
                for item in clouds {XCTAssertNil(item.image);XCTAssertNil(item.layer.animationKeys())}
            }
            try await wait{retired == nil} // drain UIKit/Core Animation completion and autorelease ownership
            XCTAssertNil(retired,"Retired clouds must not retain their modal")
        }
    }

}
