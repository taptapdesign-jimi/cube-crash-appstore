import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class JimiNativeEndRunTests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("QA Simulator only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else {throw XCTSkip("Isolated QA Simulator only")}
    }
    private var dto:[String:Any] {["title":"Exit Game?","subtitle":"Come back anytime.\nRound 01 progress saved.","restartLabel":"New Game","exitLabel":"Exit Game"]}
    func testV10PaperCoverTopAndComponentRotationThroughCollapse() {
        let paper = UIImageView(image: UIGraphicsImageRenderer(size:CGSize(width:200,height:100)).image { _ in })
        JimiNativeModalV10.paperLayout(paper,bounds:CGRect(x:0,y:0,width:100,height:200))
        XCTAssertEqual(paper.layer.contentsRect,CGRect(x:0.375,y:0,width:0.25,height:1))
        JimiNativeModalV10.paperLayout(paper,bounds:CGRect(x:0,y:0,width:100,height:200),bottomExtension:96)
        XCTAssertEqual(paper.layer.contentsRect.height,200/296.0,accuracy:0.000001)
        let progress = 0.75
        let eased = JimiV9Motion.Ease.cubicBezier(0.4,0,0.2,1).value((progress-0.18)/0.82)
        let expectedAngle = (-7 + 119*eased) * .pi/180
        let transform = JimiNativeModalV10.exitTransform(progress:progress,flip:true)
        let rotateX = (1.25-16.25*eased) * .pi/180
        XCTAssertEqual(atan2(-transform.m13/cos(rotateX),transform.m11),expectedAngle,accuracy:0.000001,
                       "v10 crosses edge-on while still scaled; zero endpoint must not erase its 112-degree rotation")
        let view = UIView();JimiNativeModalV10.exit(view,flip:true,key:"test")
        XCTAssertEqual((view.layer.animation(forKey:"test") as? CAKeyframeAnimation)?.values?.count,158)
        XCTAssertEqual(view.layer.transform.m11,0,accuracy:0.000001)
    }

    func testEveryNativeEndRunCTAUsesV10WidthCenterAndVerticalStack() throws {
        for width in [CGFloat(320),390,430] {
            let assets = JimiV9Artwork(resourceRoot:Bundle.main.bundleURL.appendingPathComponent("Web.bundle"))
            let modal = JimiNativeEndRunModal(id:1,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:assets)
            modal.loadViewIfNeeded();modal.view.frame = CGRect(x:0,y:0,width:width,height:844);modal.viewDidLayoutSubviews()
            for (i,button) in modal.buttons.enumerated() {
                XCTAssertEqual(button.bounds.size,CGSize(width:249,height:64))
                XCTAssertEqual(button.center.x,modal.card.bounds.midX)
                XCTAssertEqual(button.frame.minY,184+CGFloat(i)*80)
            }
            XCTAssertEqual(modal.buttons[1].frame.minY-modal.buttons[0].frame.maxY,16)
            XCTAssertEqual(modal.card.bounds.height-modal.buttons[1].frame.maxY,36)
            modal.dispose()
        }
    }

    func testV10DragHasDiminishingEdgeResistanceSpringReturnAndExactReleasePose() throws {
        let root = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        let target = UIView(frame:CGRect(x:24,y:240,width:342,height:364)),idle = UIView(frame:CGRect(x:0,y:0,width:342,height:364))
        root.addSubview(target);target.addSubview(idle)
        var enabled = true,dismissals = 0
        let drag = JimiNativeModalDrag(target:target,idle:idle,viewport:root,canDrag:{enabled},onDismiss:{dismissals += 1})
        drag.begin();XCTAssertEqual(idle.layer.speed,0)
        drag.move(CGPoint(x:0,y:100));let first = target.layer.transform.m42
        XCTAssertEqual(first,168*72/(168+72),accuracy:0.000001)
        drag.move(CGPoint(x:0,y:200));let second = target.layer.transform.m42
        drag.move(CGPoint(x:0,y:300));let third = target.layer.transform.m42
        XCTAssertLessThan(third-second,second-first);XCTAssertLessThan(third,168)
        drag.finish(CGPoint(x:0,y:300),cancelled:true)
        XCTAssertEqual(dismissals,0)
        let spring = try XCTUnwrap(target.layer.animation(forKey:"modal.drag.return"))
        XCTAssertEqual(spring.duration,0.28)
        var point: [Float] = [0,0];spring.timingFunction?.getControlPoint(at:1,values:&point)
        XCTAssertEqual(point[0],0.34,accuracy:0.0001);XCTAssertEqual(point[1],1.56,accuracy:0.0001)
        drag.cancel();XCTAssertEqual(idle.layer.speed,1)
        drag.begin();drag.move(CGPoint(x:0,y:-120))
        let release = target.layer.transform
        drag.finish(CGPoint(x:0,y:-120),cancelled:false);drag.finish(CGPoint(x:0,y:-120),cancelled:false)
        XCTAssertEqual(dismissals,1)
        drag.cancel(preservePose:true)
        XCTAssertEqual(target.layer.transform.m42,release.m42)
        let pose = JimiNativeModalV10.exitTransform(progress:0,flip:false,releaseY:release.m42,releaseTilt:atan2(release.m12,release.m11)*180 / .pi)
        XCTAssertEqual(pose.m42,release.m42);XCTAssertEqual(pose.m12,release.m12,accuracy:0.000001)
        enabled = false;drag.begin();drag.move(CGPoint(x:0,y:300));XCTAssertEqual(target.layer.transform.m42,release.m42)
        drag.dispose();drag.dispose();XCTAssertNil(drag.pan.view);XCTAssertEqual(idle.layer.speed,1)
    }

    func testRejectsMalformedPresentationAndKeepsCanonicalLabels() throws {
        XCTAssertNil(JimiNativeEndRunModel(["title":"Exit"]))
        let model = try XCTUnwrap(JimiNativeEndRunModel(dto))
        XCTAssertEqual(model.restartLabel,"New Game");XCTAssertTrue(model.subtitle.contains("Round 01"))
    }
    func testFiniteEnterInputAndCleanupWithStableCollapsedLayout() async throws {
        let assets = JimiV9Artwork(resourceRoot:Bundle.main.bundleURL.appendingPathComponent("Web.bundle"))
        let modal = JimiNativeEndRunModal(id:7,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:assets)
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));let presenter = UIViewController();window.rootViewController = presenter
        let ready = expectation(description:"Actual CA enter completion")
        modal.onReady = {ready.fulfill()};window.makeKeyAndVisible();presenter.present(modal,animated:false)
        defer {modal.dispose();window.isHidden = true}
        XCTAssertFalse(modal.view.isUserInteractionEnabled)
        await fulfillment(of:[ready],timeout:4)
        XCTAssertTrue(modal.view.isUserInteractionEnabled)
        XCTAssertEqual(modal.card.bounds.width,342)
        XCTAssertEqual(modal.card.layer.anchorPoint.y,0.55);XCTAssertEqual(modal.flip.layer.anchorPoint.y,1)
        XCTAssertEqual(modal.buttons[0].bounds.height,64)
        XCTAssertLessThanOrEqual(modal.subtitle.sizeThatFits(CGSize(width:modal.subtitle.bounds.width,height:1000)).height,52)
        XCTAssertEqual(modal.subtitle.text,modal.model.subtitle)
        var actions:[String] = [];modal.onAction = {actions.append($0)}
        modal.buttons[1].sendActions(for:.touchUpInside)
        XCTAssertEqual(actions,["exit"]);XCTAssertFalse(modal.view.isUserInteractionEnabled)
        modal.actionRejected();XCTAssertTrue(modal.view.isUserInteractionEnabled)
        modal.suspend();XCTAssertEqual(modal.view.layer.speed,0);modal.resume();XCTAssertEqual(modal.view.layer.speed,1)
        let closed = expectation(description:"Actual native dismissal receipt");modal.onClosed = {closed.fulfill()}
        modal.closeFromOwner();modal.closeFromOwner();XCTAssertTrue(modal.closing)
        XCTAssertEqual(modal.card.layer.animation(forKey:"end-run-exit")?.duration,0.65)
        let geometry = modal.card.bounds;modal.viewDidLayoutSubviews();XCTAssertEqual(modal.card.bounds,geometry)
        await fulfillment(of:[closed],timeout:4)
        XCTAssertNil(presenter.presentedViewController)
        modal.dispose();modal.dispose();XCTAssertNil(modal.idle.layer.animationKeys())
    }
}
