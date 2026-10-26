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
    func testBundledExitFacesMatchCurrentRecipeAcrossBothWidthsAndDensities() throws {
        let root=NativeTestResources.root,artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        func pixels(_ image:CGImage)->Data {
            var bytes=Data(count:image.width*image.height*4)
            bytes.withUnsafeMutableBytes { storage in
                let context=CGContext(data:storage.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
            }
            return bytes
        }
        for width in [CGFloat(240),249] {for scale in [CGFloat(4),6] {for primary in [true,false] {
            let button=JimiV9PlainButton(frame:CGRect(x:0,y:0,width:width,height:80))
            button.accessibilityIdentifier=primary ? "native.end-run.restart":"native.end-run.exit"
            button.setTitle(primary ? "Restart":"Exit Stage",for:.normal)
            button.applyModalCTA(artwork:artwork,primary:primary,preparesSculptedFaceOffMain:true)
            button.layoutIfNeeded()
            let face=try XCTUnwrap(button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
            face.contentScaleFactor=scale;face.setNeedsLayout();face.layoutIfNeeded()
            XCTAssertTrue(button.isSculptedFacePrepared,"Bundled face must be ready while detached, before modal entry")
            let actual=try XCTUnwrap(button.sculptedFaceRasterForTesting())
            let reference=try XCTUnwrap(button.sculptedFaceRasterForTesting(original:true))
            XCTAssertEqual(actual.width,Int(width*scale));XCTAssertEqual(actual.height,Int(80*scale))
            let name="\(primary ? "restart":"exit")-\(Int(width))-\(Int(scale))x.png"
            XCTAssertTrue(FileManager.default.fileExists(atPath:root.appendingPathComponent((primary ? "assets/ui/native-end-run-cta/":"assets/ui/native-end-run-cta-soft-top-v3/")+name).path))
            XCTAssertEqual(pixels(actual),pixels(reference),"Bundled material must preserve the exact current CGContext recipe,including orientation")
            face.bounds.size=CGSize(width:width-0.00000000001,height:80+0.00000000001)
            face.setNeedsLayout();face.layoutIfNeeded()
            XCTAssertTrue(button.isSculptedFacePrepared,"Tiny UIKit geometry rounding must not fall back to asynchronous paint")
            XCTAssertEqual(button.sculptedFaceRasterForTesting()?.width,Int(width*scale))
            button.retireSculptedFacePreparation();XCTAssertNil(button.sculptedFaceRasterForTesting())
        }}}
    }

    func testColdExitFacesAndRestartEnterInSameTurnAsPaperWithoutWorkerWait() async throws {
        let modal=JimiNativeEndRunModal(id:914,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        modal.loadViewIfNeeded();modal.view.frame=CGRect(x:0,y:0,width:390,height:844);modal.view.layoutIfNeeded()
        XCTAssertTrue(modal.buttons.allSatisfy{$0.isSculptedFacePrepared})
        XCTAssertNil(modal.card.layer.animation(forKey:"end-run-enter"))
        let entered=expectation(description:"Actual UIKit viewDidAppear installs paper and Restart together")
        modal.onEntryAnimationsInstalledForTesting={ [weak modal] in
            guard let modal else{XCTFail("Modal retired before visible entry");return}
            NSLog("[EXIT_CTA_ENTRY_PROBE] before=%@ after=%@",modal.ctaPreparationBeforeEntryForTesting.joined(separator:" | "),modal.buttons.map{$0.sculptedFacePreparationSnapshotForTesting}.joined(separator:" | "))
            XCTAssertTrue(modal.buttons.allSatisfy{$0.isSculptedFacePrepared},"Faces must already be ready at paper entry; states=\(modal.buttons.map{$0.sculptedFacePreparationSnapshotForTesting}),speed=\(modal.view.layer.speed)")
            XCTAssertNotNil(modal.card.layer.animation(forKey:"end-run-enter"))
            XCTAssertNotNil(modal.buttons[0].layer.animation(forKey:"cta-enter"),"Restart must already be entering in the same UIKit turn as the paper")
            XCTAssertEqual(modal.buttons[1].layer.animation(forKey:"cta-enter")?.duration ?? 0,0.52,accuracy:0.000001)
            entered.fulfill()
        }
        let window=UIWindow(frame:modal.view.bounds);window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
        await fulfillment(of:[entered],timeout:4)

    }

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
            let assets = JimiV9Artwork(resourceRoot:NativeTestResources.root)
            let modal = JimiNativeEndRunModal(id:1,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:assets)
            modal.loadViewIfNeeded();modal.view.frame = CGRect(x:0,y:0,width:width,height:844);modal.viewDidLayoutSubviews()
            for (i,button) in modal.buttons.enumerated() {
                if i==0 {XCTAssertEqual(button.bounds.height,84);XCTAssertLessThanOrEqual(button.bounds.width,modal.card.bounds.width-32)}
                else {XCTAssertEqual(button.bounds.size,CGSize(width:modal.buttons[0].bounds.width,height:84))}
                XCTAssertEqual(button.cartoonBounceLayoutView.center.x,modal.card.bounds.midX)
                XCTAssertEqual(button.cartoonBounceFrame.minY,i==0 ? 184:274,accuracy:0.001)
            }
            XCTAssertEqual(modal.buttons[1].cartoonBounceFrame.minY-modal.buttons[0].cartoonBounceFrame.maxY,6,accuracy:0.001)
            XCTAssertEqual(modal.card.bounds.height-modal.buttons[1].cartoonBounceFrame.maxY,36,accuracy:0.001)
            modal.close.layoutIfNeeded()
            XCTAssertEqual(modal.close.bounds.size,CGSize(width:52,height:52),"Circle and hit target stay unchanged")
            XCTAssertEqual(modal.close.frame.minX,modal.card.bounds.width-42)
            let glyph=try XCTUnwrap(modal.close.imageView)
            XCTAssertEqual(glyph.bounds.size,CGSize(width:24,height:24))
            XCTAssertEqual(glyph.frame.midX,28,accuracy:0.001,"Only the brown X shifts2pt right")
            modal.dispose()
        }
    }

    func testModalWidthsRestorePreRedesignWidthRegardlessOfTitleAndRelayoutWithinViewport() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for titles in [("Restart", "Exit"),("Play", "Exit Game")] {
            var data=dto;data["restartLabel"]=titles.0;data["exitLabel"]=titles.1
            let modal=JimiNativeEndRunModal(id:1,model:try XCTUnwrap(JimiNativeEndRunModel(data)),assets:assets)
            modal.loadViewIfNeeded()
            defer {modal.dispose()}
            for width in [CGFloat(390),320,430] {
                modal.view.frame=CGRect(x:0,y:0,width:width,height:844);modal.viewDidLayoutSubviews()
                let expected=min(CGFloat(249),modal.card.bounds.width-32)
                XCTAssertEqual(modal.buttons[0].bounds.width,expected)
                XCTAssertEqual(modal.buttons[1].bounds.width,expected)
                XCTAssertLessThanOrEqual(expected,modal.card.bounds.width-32)
                XCTAssertEqual(modal.buttons[1].cartoonBounceFrame.minY-modal.buttons[0].cartoonBounceFrame.maxY,6,accuracy:0.001)
            }
        }
    }

    func testPairedExitPaperIdleOnlyTranslatesKeepingScreenGapConstant() throws {
        let target=UIView()
        JimiNativeModalV10.startIdle(on:target,key:"pair",rigid:true)
        let animation=try XCTUnwrap(target.layer.animation(forKey:"pair") as? CAKeyframeAnimation)
        for value in try XCTUnwrap(animation.values as? [NSValue]) {
            let pose=value.caTransform3DValue
            XCTAssertEqual(pose.m11,1);XCTAssertEqual(pose.m22,1);XCTAssertEqual(pose.m33,1)
            XCTAssertEqual(pose.m43,0);XCTAssertEqual(pose.m34,0)
        }
    }

    func testExitCTARemovesLeadInAndUsesFailOrangeThenWhiteSpacing() {
        XCTAssertEqual(JimiNativeEndRunModal.ctaStart(0),0)
        XCTAssertEqual(JimiNativeEndRunModal.ctaStart(1)-JimiNativeEndRunModal.ctaStart(0),0.82-0.64,accuracy:0.000001)
        XCTAssertLessThan(JimiNativeEndRunModal.ctaStart(0),0.13)
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
        let assets = JimiV9Artwork(resourceRoot:NativeTestResources.root)
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
        XCTAssertEqual(modal.buttons[0].bounds.height,84)
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
    func testExitCannotEnterBeforeRestartWhenItsBitmapIsReadyFirst() async throws {
        let modal=JimiNativeEndRunModal(id:913,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        modal.loadViewIfNeeded()
        modal.buttons[0].setSculptedFacePreparationSuspended(true)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
        modal.view.frame=window.bounds;modal.view.layoutIfNeeded()
        var deadline=Date().addingTimeInterval(8)
        while !modal.buttons[1].isSculptedFacePrepared,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(modal.buttons[1].isSculptedFacePrepared)
        XCTAssertFalse(modal.buttons[0].isSculptedFacePrepared)
        for button in modal.buttons {
            XCTAssertNil(button.layer.animation(forKey:"cta-enter"))
            XCTAssertEqual(button.layer.opacity,0,"Exit must stay hidden until Restart can enter first")
        }
        modal.buttons[0].setSculptedFacePreparationSuspended(false)
        modal.buttons[0].setNeedsLayout();modal.buttons[0].layoutIfNeeded()
        deadline=Date().addingTimeInterval(8)
        while modal.buttons[0].layer.animation(forKey:"cta-enter")==nil,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        let restart=try XCTUnwrap(modal.buttons[0].layer.animation(forKey:"cta-enter") as? CAKeyframeAnimation)
        let exit=try XCTUnwrap(modal.buttons[1].layer.animation(forKey:"cta-enter") as? CAKeyframeAnimation)
        XCTAssertEqual(restart.duration,0.34,accuracy:0.000001)
        XCTAssertEqual(exit.duration,0.52,accuracy:0.000001,"Exit keeps its full180ms stagger even after late bitmap readiness")
        modal.suspend();modal.resume()
        XCTAssertEqual(modal.buttons[0].layer.animationKeys()?.filter{$0=="cta-enter"}.count,1)
        XCTAssertEqual(modal.buttons[1].layer.animationKeys()?.filter{$0=="cta-enter"}.count,1)
    }

    func testExitPreparedFacesMatchFullDensityUIKitRasterAndOrientation() async throws {
        let modal=JimiNativeEndRunModal(id:910,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true}
        modal.view.frame=window.bounds;modal.view.layoutIfNeeded()
        let deadline=Date().addingTimeInterval(8)
        while !modal.buttons.allSatisfy({$0.isSculptedFacePrepared}),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        func pixels(_ image:CGImage)throws->[UInt8] {
            var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
            let ok=bytes.withUnsafeMutableBytes { storage->Bool in
                guard let context=CGContext(data:storage.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
                context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height));return true
            }
            XCTAssertTrue(ok);return bytes
        }
        for button in modal.buttons {
            XCTAssertTrue(button.isSculptedFacePrepared)
            let actual=try XCTUnwrap(button.sculptedFaceRasterForTesting())
            let role=button.accessibilityIdentifier=="native.end-run.exit" ? "exit":"restart"
            let sourceWidth=button.bounds.width<245 ? 240:249
            let directory=role=="exit" ? "native-end-run-cta-soft-top-v3":"native-end-run-cta"
            let original=try XCTUnwrap(UIImage(contentsOfFile:NativeTestResources.root.appendingPathComponent("assets/ui/\(directory)/\(role)-\(sourceWidth)-6x.png").path))
            let format=UIGraphicsImageRendererFormat();format.scale=6;format.opaque=false;format.preferredRange = .standard
            let reference=try XCTUnwrap(UIGraphicsImageRenderer(size:button.bounds.size,format:format).image{_ in original.draw(in:CGRect(origin:.zero,size:button.bounds.size))}.cgImage)
            XCTAssertEqual(actual.width,reference.width);XCTAssertEqual(actual.height,reference.height)
            let face=try XCTUnwrap(button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
            XCTAssertEqual(face.contentScaleFactor,6,accuracy:0.001,"Retained iPhone13 Simulator uses exact6x face raster")
            XCTAssertEqual(actual.width,Int(ceil(face.bounds.width*6)));XCTAssertEqual(actual.height,Int(ceil(face.bounds.height*6)))
            let a=try pixels(actual),b=try pixels(reference)
            guard a.count==b.count else{XCTFail("Raster byte dimensions differ");continue}
            var error=0.0,outliers=0
            for index in a.indices {let difference=abs(Int(a[index])-Int(b[index]));error+=Double(difference);if difference>8 {outliers+=1}}
            XCTAssertLessThanOrEqual(error/Double(a.count),0.75,"Protected original raster resized to fuller bounds preserves directional lighting and orientation")
            XCTAssertLessThanOrEqual(Double(outliers)/Double(a.count),0.002,"Only bounded edge rounding may differ")
        }
    }
    func testExitFacePreparationSuspendsResumesAndRetiresBeforeLateCompletion() async throws {
        let modal=JimiNativeEndRunModal(id:911,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let window=UIWindow(frame:CGRect(x:0,y:0,width:321,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true}
        modal.view.frame=window.bounds;modal.view.layoutIfNeeded();modal.suspend()
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertTrue(modal.buttons.allSatisfy{$0.sculptedFaceRasterForTesting()==nil},"Suspension rejects queued paint publication")
        modal.resume();modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
        let deadline=Date().addingTimeInterval(8)
        while !modal.buttons.allSatisfy({$0.isSculptedFacePrepared}),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(modal.buttons.allSatisfy{$0.sculptedFaceRasterForTesting() != nil})
        modal.dispose()
        XCTAssertTrue(modal.buttons.allSatisfy{$0.sculptedFaceRasterForTesting()==nil})
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertTrue(modal.buttons.allSatisfy{$0.sculptedFaceRasterForTesting()==nil},"Retired work cannot republish")
        let pending=JimiNativeEndRunModal(id:912,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        window.rootViewController=pending;pending.view.frame=window.bounds;pending.view.layoutIfNeeded();pending.dispose()
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertTrue(pending.buttons.allSatisfy{$0.sculptedFaceRasterForTesting()==nil},"Dispose before queued completion rejects publication")
    }

}
