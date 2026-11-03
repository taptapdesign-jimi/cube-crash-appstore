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
    func testExportShallowerCTAFaceRecipe() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let output=URL(fileURLWithPath:"/tmp/native-cta-shallow-export")
        for width in [CGFloat(216.2),240,249] {for scale in [CGFloat(4),6] {for primary in [true,false] {
            let compact=width==216.2
            let button=JimiV9PlainButton(frame:CGRect(x:0,y:0,width:width,height:compact ? 70:80))
            button.accessibilityIdentifier=primary ? "native.end-run.restart":"native.end-run.exit"
            button.setTitle(primary ? "Restart":"Exit Stage",for:.normal)
            button.applyModalCTA(artwork:artwork,primary:primary,preparesSculptedFaceOffMain:false)
            button.layoutIfNeeded()
            let face=try XCTUnwrap(button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
            face.contentScaleFactor=scale
            let raster=try XCTUnwrap(button.sculptedFaceRasterForTesting(original:true))
            let folder=compact ? "native-paired-cta-shallow-v3":("native-end-run-cta-shallow-v4/"+(primary ? "primary":"secondary"))
            let dir=output.appendingPathComponent(folder)
            try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
            let name="\(primary ? "restart":"exit")-\(compact ? "216p2":String(Int(width)))-\(Int(scale))x.png"
            try XCTUnwrap(UIImage(cgImage:raster).pngData()).write(to:dir.appendingPathComponent(name))
        }}}
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
            XCTAssertTrue(FileManager.default.fileExists(atPath:root.appendingPathComponent((primary ? "assets/ui/native-end-run-cta-shallow-v4/primary/":"assets/ui/native-end-run-cta-shallow-v4/secondary/")+name).path))
            XCTAssertEqual(pixels(actual),pixels(reference),"Bundled material must preserve the exact current CGContext recipe,including orientation")
            if primary {
                let offset=((actual.height/2)*actual.width+actual.width/2)*4
                XCTAssertEqual(Array(pixels(actual)[offset..<offset+4]),[238,129,88,255],"CTA core matches requested #EE8158")
            }
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
                if i==0 {XCTAssertEqual(button.bounds.height,70);XCTAssertLessThanOrEqual(button.bounds.width,modal.card.bounds.width-32)}
                else {XCTAssertEqual(button.bounds.size,CGSize(width:modal.buttons[0].bounds.width,height:70))}
                XCTAssertEqual(button.titleLabel?.font.pointSize,28)
                XCTAssertEqual(button.cartoonBounceLayoutView.center.x,modal.card.bounds.midX)
                XCTAssertEqual(button.cartoonBounceFrame.minY,i==0 ? 172:254,accuracy:0.001)
            }
            XCTAssertEqual(modal.buttons[1].cartoonBounceFrame.minY-modal.buttons[0].cartoonBounceFrame.maxY,12,accuracy:0.001)
            XCTAssertEqual(modal.card.bounds.height-modal.buttons[1].cartoonBounceFrame.maxY,28,accuracy:0.001)
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
                let expected=min(CGFloat(230)*0.94,modal.card.bounds.width-32)
                XCTAssertEqual(modal.buttons[0].bounds.width,expected)
                XCTAssertEqual(modal.buttons[1].bounds.width,expected)
                XCTAssertLessThanOrEqual(expected,modal.card.bounds.width-32)
                XCTAssertEqual(modal.buttons[1].cartoonBounceFrame.minY-modal.buttons[0].cartoonBounceFrame.maxY,12,accuracy:0.001)
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

    func testMediaSafeDragHoldsOnlyOwnIdleWhileMountedChildClockContinues()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let target=UIView(frame:CGRect(x:24,y:220,width:342,height:360)),idle=UIView(frame:CGRect(x:0,y:0,width:342,height:360))
        let child=UIView(frame:CGRect(x:80,y:80,width:40,height:40));child.backgroundColor = .red
        host.view.addSubview(target);target.addSubview(idle);idle.addSubview(child)
        let key="backpack.detail.idle"
        let animation=CABasicAnimation(keyPath:"transform.translation.y")
        animation.fromValue=0;animation.toValue=20;animation.duration=4;animation.repeatCount = .infinity
        animation.beginTime=idle.layer.convertTime(CACurrentMediaTime(),from:nil);idle.layer.add(animation,forKey:key)
        let childMotion=CABasicAnimation(keyPath:"position.x")
        childMotion.fromValue=80;childMotion.toValue=280;childMotion.duration=5;childMotion.repeatCount = .infinity
        childMotion.beginTime=child.layer.convertTime(CACurrentMediaTime(),from:nil);child.layer.add(childMotion,forKey:"child.media")
        var dismissals=0
        let drag=JimiNativeModalDrag(target:target,idle:idle,viewport:host.view,mediaSafeIdleAnimationKeys:[key,JimiNativeModalV10.settledBounceKey],canDrag:{true},onDismiss:{dismissals+=1})
        defer{drag.dispose();window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        try await Task.sleep(for:.milliseconds(120))
        let originalClock=(idle.layer.speed,idle.layer.beginTime,idle.layer.timeOffset)
        for cycle in 0..<3 {
            drag.begin();drag.begin()
            XCTAssertEqual(idle.layer.speed,originalClock.0);XCTAssertEqual(idle.layer.beginTime,originalClock.1);XCTAssertEqual(idle.layer.timeOffset,originalClock.2)
            XCTAssertEqual(idle.layer.animation(forKey:key)?.speed,0)
            drag.move(CGPoint(x:0,y:20))
            try await Task.sleep(for:.milliseconds(70))
            let held=try XCTUnwrap(idle.layer.presentation()).transform.m42
            let childBefore=try XCTUnwrap(child.layer.presentation()).position.x
            try await Task.sleep(for:.milliseconds(140))
            XCTAssertEqual(try XCTUnwrap(idle.layer.presentation()).transform.m42,held,accuracy:0.05)
            XCTAssertGreaterThan(try XCTUnwrap(child.layer.presentation()).position.x,childBefore+1)
            if cycle==1 {drag.cancel()}else{drag.finish(CGPoint(x:0,y:20),cancelled:cycle==2)}
            XCTAssertEqual(idle.layer.animation(forKey:key)?.speed,1)
            try await Task.sleep(for:.milliseconds(100))
            XCTAssertGreaterThan(try XCTUnwrap(idle.layer.presentation()).transform.m42,held)
        }
        drag.cancel();drag.dispose();drag.dispose()
        try await Task.sleep(for:.milliseconds(350))
        XCTAssertEqual(dismissals,0);XCTAssertNil(drag.pan.view)
        XCTAssertEqual(idle.layer.speed,originalClock.0);XCTAssertEqual(idle.layer.beginTime,originalClock.1);XCTAssertEqual(idle.layer.timeOffset,originalClock.2)
        XCTAssertEqual(idle.layer.animation(forKey:key)?.speed,1)
        XCTAssertNotNil(child.layer.animation(forKey:"child.media"))
    }
    func testMediaSafeDragPreservesFiniteTimingAndDoesNotRestoreReplacedOrRemovedIdle()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        let target=UIView(frame:CGRect(x:0,y:0,width:300,height:300)),idle=UIView(frame:CGRect(x:0,y:0,width:300,height:300)),viewport=host.view!
        viewport.addSubview(target);target.addSubview(idle)
        let key=JimiNativeModalV10.settledBounceKey
        let finite=CABasicAnimation(keyPath:"transform.scale")
        finite.fromValue=0;finite.toValue=0.1;finite.isAdditive=true;finite.duration=0.4
        finite.speed=0.75;finite.timeOffset=0.15;finite.beginTime=idle.layer.convertTime(CACurrentMediaTime(),from:nil)
        finite.isRemovedOnCompletion=true;idle.layer.add(finite,forKey:key)
        let drag=JimiNativeModalDrag(target:target,idle:idle,viewport:viewport,mediaSafeIdleAnimationKeys:[key],canDrag:{true},onDismiss:{})
        defer{drag.dispose()}
        drag.begin();try await Task.sleep(for:.milliseconds(50));drag.cancel()
        let resumed=try XCTUnwrap(idle.layer.animation(forKey:key) as? CABasicAnimation)
        XCTAssertEqual(resumed.speed,finite.speed);XCTAssertEqual(resumed.timeOffset,finite.timeOffset)
        XCTAssertGreaterThan(resumed.beginTime,finite.beginTime)
        XCTAssertEqual(resumed.duration,finite.duration);XCTAssertEqual(resumed.repeatCount,0)
        XCTAssertEqual(resumed.isAdditive,finite.isAdditive);XCTAssertEqual(resumed.isRemovedOnCompletion,true)
        let retirementDeadline=Date().addingTimeInterval(2)
        while idle.layer.animation(forKey:key) != nil,Date()<retirementDeadline {try await Task.sleep(for:.milliseconds(20))}
        if let remaining=idle.layer.animation(forKey:key) {
            let local=idle.layer.convertTime(CACurrentMediaTime(),from:nil)
            XCTFail("Finite bounce did not retire: local=\(local),begin=\(remaining.beginTime),speed=\(remaining.speed),offset=\(remaining.timeOffset),duration=\(remaining.duration),removed=\(remaining.isRemovedOnCompletion),window=\(idle.window != nil)")
        }
        finite.beginTime=idle.layer.convertTime(CACurrentMediaTime(),from:nil)
        idle.layer.add(finite,forKey:key)
        drag.begin();idle.layer.removeAnimation(forKey:key);drag.cancel()
        XCTAssertNil(idle.layer.animation(forKey:key),"Retired animation cannot be resurrected")
        idle.layer.add(finite,forKey:key);drag.begin()
        let replacement=CABasicAnimation(keyPath:"opacity");replacement.duration=9;replacement.fromValue=1;replacement.toValue=0.5
        replacement.beginTime=idle.layer.convertTime(CACurrentMediaTime(),from:nil)
        idle.layer.add(replacement,forKey:key);drag.cancel()
        XCTAssertEqual((idle.layer.animation(forKey:key) as? CAPropertyAnimation)?.keyPath,"opacity")
        drag.begin();drag.finish(CGPoint(x:0,y:20),cancelled:true);drag.dispose()
        try await Task.sleep(for:.milliseconds(350))
        XCTAssertEqual((idle.layer.animation(forKey:key) as? CAPropertyAnimation)?.keyPath,"opacity")
        XCTAssertEqual(idle.layer.speed,1);XCTAssertEqual(idle.layer.beginTime,0);XCTAssertEqual(idle.layer.timeOffset,0)
    }
    func testMediaSafeDragPreservesDelayedFiniteAnimationAcrossAncestorBackgroundAndReleasesOwner()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let target=UIView(frame:CGRect(x:24,y:200,width:300,height:300)),idle=UIView(frame:CGRect(x:0,y:0,width:300,height:300))
        idle.backgroundColor = .red;host.view.addSubview(target);target.addSubview(idle)
        let key=JimiNativeModalV10.settledBounceKey
        let delayed=CABasicAnimation(keyPath:"opacity")
        delayed.fromValue=0.2;delayed.toValue=1;delayed.duration=0.3
        delayed.fillMode = .backwards;delayed.isRemovedOnCompletion=true
        delayed.beginTime=idle.layer.convertTime(CACurrentMediaTime(),from:nil)+0.2
        idle.layer.add(delayed,forKey:key)
        var drag:JimiNativeModalDrag?=JimiNativeModalDrag(target:target,idle:idle,viewport:host.view,mediaSafeIdleAnimationKeys:[key],canDrag:{true},onDismiss:{})
        weak var releasedDrag=drag
        defer{drag?.dispose();window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        drag?.begin()
        let held=try XCTUnwrap(idle.layer.animation(forKey:key))
        XCTAssertEqual(held.speed,0);XCTAssertLessThan(held.timeOffset,0,"The selected finite animation has not reached its delay")
        // Reproduce the existing app-level ancestor clock pause while the drag
        // owns only its selected animation. Background elapsed time is excluded.
        let parentTime=target.layer.convertTime(CACurrentMediaTime(),from:nil)
        target.layer.speed=0;target.layer.timeOffset=parentTime
        try await Task.sleep(for:.milliseconds(70))
        target.layer.speed=1;target.layer.timeOffset=0;target.layer.beginTime=0
        target.layer.beginTime=target.layer.convertTime(CACurrentMediaTime(),from:nil)-parentTime
        let restoredClock=(idle.layer.speed,idle.layer.beginTime,idle.layer.timeOffset)
        try await Task.sleep(for:.milliseconds(60))
        drag?.cancel()
        let resumed=try XCTUnwrap(idle.layer.animation(forKey:key))
        let remainingDelay=resumed.beginTime-idle.layer.convertTime(CACurrentMediaTime(),from:nil)
        XCTAssertGreaterThan(remainingDelay,0.13);XCTAssertLessThanOrEqual(remainingDelay,0.21)
        XCTAssertEqual(resumed.fillMode,.backwards);XCTAssertTrue(resumed.isRemovedOnCompletion)
        XCTAssertEqual(idle.layer.speed,restoredClock.0);XCTAssertEqual(idle.layer.beginTime,restoredClock.1);XCTAssertEqual(idle.layer.timeOffset,restoredClock.2)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(try XCTUnwrap(idle.layer.presentation()).opacity,0.2,accuracy:0.025,"Resume retains the unconsumed delay")
        try await Task.sleep(for:.milliseconds(240))
        XCTAssertGreaterThan(try XCTUnwrap(idle.layer.presentation()).opacity,0.25)
        drag?.dispose();drag=nil
        XCTAssertNil(releasedDrag,"Gesture delegate and pending spring completion cannot retain the drag owner")
        let retirementDeadline=Date().addingTimeInterval(2)
        while idle.layer.animation(forKey:key) != nil,Date()<retirementDeadline {try await Task.sleep(for:.milliseconds(20))}
        if let remaining=idle.layer.animation(forKey:key) {
            let local=idle.layer.convertTime(CACurrentMediaTime(),from:nil)
            XCTFail("Delayed finite animation did not retire: local=\(local),begin=\(remaining.beginTime),speed=\(remaining.speed),offset=\(remaining.timeOffset),duration=\(remaining.duration),removed=\(remaining.isRemovedOnCompletion),window=\(idle.window != nil)")
        }
        XCTAssertNil(releasedDrag)
    }
    func testFreshEndRunRestTiltSamplesOnceAndStaysWithinTwoDegrees()throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        var freshAngles:[CGFloat]=[]
        for sample in [0.0,0.25,0.5,0.75,1.0,-2,3,Double.nan] {
            var draws=0
            let modal=JimiNativeEndRunModal(id:70,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:assets,restTiltRandom:{draws+=1;return sample})
            defer{modal.dispose()}
            modal.loadViewIfNeeded();modal.view.frame=CGRect(x:0,y:0,width:390,height:844);modal.view.layoutIfNeeded()
            let tilt=try XCTUnwrap(modal.card.subviews.first{$0.accessibilityIdentifier=="native.end-run.rest-tilt"})
            XCTAssertTrue(tilt.layer is CATransformLayer);XCTAssertTrue(modal.flip.superview === tilt)
            XCTAssertLessThanOrEqual(abs(modal.restTiltDegrees),2)
            let expected=CGFloat(min(1,max(0,sample.isFinite ? sample:0.5))*4-2)
            XCTAssertEqual(modal.restTiltDegrees,expected)
            XCTAssertEqual(atan2(tilt.layer.transform.m12,tilt.layer.transform.m11)*180 / .pi,expected,accuracy:0.000001)
            let painted=tilt.layer.transform
            for width in [CGFloat(320),390,430] {
                modal.view.frame=CGRect(x:0,y:0,width:width,height:844);modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
                XCTAssertTrue(CATransform3DEqualToTransform(tilt.layer.transform,painted))
                XCTAssertEqual(tilt.bounds,modal.card.bounds)
            }
            modal.suspend();modal.resume();XCTAssertEqual(draws,1)
            if sample>=0 && sample<=1 {freshAngles.append(modal.restTiltDegrees)}
        }
        XCTAssertEqual(freshAngles,[-2,-1,0,1,2],"Each new opening selects its own rest angle")
    }
    func testMountedRestTiltSurvivesDragBackgroundAndCloseWithoutReset()async throws {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let modal=JimiNativeEndRunModal(id:71,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),restTiltRandom:{0.9})
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal
        let ready=expectation(description:"Tilted modal admitted"),closed=expectation(description:"Tilted modal closed")
        modal.onReady={ready.fulfill()};modal.onClosed={closed.fulfill()};window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        await fulfillment(of:[ready],timeout:5)
        let tilt=try XCTUnwrap(modal.card.subviews.first{$0.accessibilityIdentifier=="native.end-run.rest-tilt"})
        let painted=tilt.layer.transform
        let drag=try XCTUnwrap(modal.card.gestureRecognizers?.compactMap{$0.delegate as? JimiNativeModalDrag}.first)
        drag.begin();drag.move(CGPoint(x:2,y:20));drag.finish(CGPoint(x:2,y:20),cancelled:false)
        XCTAssertTrue(CATransform3DEqualToTransform(tilt.layer.transform,painted))
        modal.suspend();modal.resume();XCTAssertTrue(CATransform3DEqualToTransform(tilt.layer.transform,painted))
        try await Task.sleep(for:.milliseconds(350))
        XCTAssertTrue(CATransform3DEqualToTransform(tilt.layer.transform,painted))
        modal.closeFromOwner();XCTAssertTrue(CATransform3DEqualToTransform(tilt.layer.transform,painted))
        await fulfillment(of:[closed],timeout:3)
        XCTAssertTrue((tilt.layer.animationKeys() ?? []).isEmpty)
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
        XCTAssertEqual(modal.buttons[0].bounds.height,70)
        let image=UIGraphicsImageRenderer(size:window.bounds.size).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/cta-compact-mounted.png"))
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
    func testGameplayBoardPaperAndCTAsShareEpochAfterBothFacesAreReady() async throws {
        let modal=JimiNativeEndRunModal(id:915,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),synchronizesBoardCTAEntry:true)
        modal.loadViewIfNeeded();modal.buttons[0].setSculptedFacePreparationSuspended(true)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
        modal.view.frame=window.bounds;modal.view.layoutIfNeeded()
        var deadline=Date().addingTimeInterval(8)
        while !modal.buttons[1].isSculptedFacePrepared,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertFalse(modal.buttons[0].isSculptedFacePrepared)
        XCTAssertNil(modal.card.layer.animation(forKey:"end-run-enter"))
        XCTAssertEqual(modal.card.alpha,0,"Paper cannot consume its enter before the CTA cohort")
        modal.buttons[0].setSculptedFacePreparationSuspended(false)
        modal.buttons[0].setNeedsLayout();modal.buttons[0].layoutIfNeeded()
        deadline=Date().addingTimeInterval(8)
        while modal.card.layer.animation(forKey:"end-run-enter")==nil,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        let paper=try XCTUnwrap(modal.card.layer.animation(forKey:"end-run-enter") as? CAKeyframeAnimation)
        XCTAssertEqual(paper.values?.count,4,"Existing paper animation recipe is retained")
        let epoch=modal.card.layer.convertTime(paper.beginTime,to:nil)
        for (index,button) in modal.buttons.enumerated() {
            let enter=try XCTUnwrap(button.layer.animation(forKey:"cta-enter"))
            XCTAssertEqual(button.layer.convertTime(enter.beginTime,to:nil),epoch,accuracy:0.000001)
            XCTAssertEqual(enter.duration,index == 0 ? 0.34:0.52,accuracy:0.000001)
        }
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
            let original=try XCTUnwrap(UIImage(contentsOfFile:NativeTestResources.root.appendingPathComponent("assets/ui/native-paired-cta-shallow-v3/\(role)-216p2-6x.png").path))
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
            XCTAssertLessThanOrEqual(error/Double(a.count),0.75,"Compact prepainted face preserves exact UIKit material and orientation")
            XCTAssertLessThanOrEqual(Double(outliers)/Double(a.count),0.002,"Only bounded edge rounding may differ")
        }
    }
    func testExitFacePreparationSuspendsResumesAndRetiresBeforeLateCompletion() async throws {
        let modal=JimiNativeEndRunModal(id:911,model:try XCTUnwrap(JimiNativeEndRunModel(dto)),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let window=UIWindow(frame:CGRect(x:0,y:0,width:280,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
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


    func testEndRunCTAEntryKeepsSharpPaintLeavesAndRetiresThroughRealClose()async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Motion disabled")}
        let model=try XCTUnwrap(JimiNativeEndRunModel(["title":"Exit Stage?","subtitle":"Come back anytime.\nStage 1 progress saved.","restartLabel":"Restart","exitLabel":"Exit Stage"]))
        var modal:JimiNativeEndRunModal?=JimiNativeEndRunModal(id:74,model:model,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),synchronizesBoardCTAEntry:true)
        weak var released=modal
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first),prior=scene.windows.first{$0.isKeyWindow}
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:390,height:844);let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
        defer{modal?.dispose();window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        let installed=expectation(description:"Actual entry installed"),ready=expectation(description:"Original input deadline"),closed=expectation(description:"Actual finite dismissal")
        modal?.onEntryAnimationsInstalledForTesting={ [weak modal] in
            guard let modal else{return}
            XCTAssertTrue(modal.idle.layer is CATransformLayer)
            XCTAssertEqual(modal.idle.layer.shadowOpacity,0)
            XCTAssertNotNil(modal.idle.layer.sublayers?.first{$0.name=="native.end-run.paper-shadow"}?.shadowPath)
            for button in modal.buttons {
                XCTAssertTrue(button.layer is CATransformLayer)
                XCTAssertTrue(button.cartoonBounceLayoutView.layer is CATransformLayer)
                XCTAssertEqual(button.layer.opacity,1)
                XCTAssertNotNil(button.layer.animation(forKey:"cta-enter"))
                XCTAssertNil(button.layer.animation(forKey:"cta-enter-opacity"))
                XCTAssertFalse(button.paintLayers.isEmpty)
                for leaf in button.paintLayers {
                    XCTAssertFalse(leaf.isDoubleSided);XCTAssertFalse(leaf.shouldRasterize)
                    let alpha=leaf.animation(forKey:"cta-enter-opacity") as? CAKeyframeAnimation
                    XCTAssertEqual(alpha?.values?.first as? Double ?? -1,0,accuracy:0.000001)
                    XCTAssertEqual(alpha?.values?.last as? Double ?? -1,1,accuracy:0.000001)
                }
                XCTAssertEqual(button.titleLabel?.contentScaleFactor,(modal.view.window?.screen.scale ?? 3)*2)
            }
            installed.fulfill()
        }
        modal?.onReady={ready.fulfill()};modal?.onClosed={closed.fulfill()}
        var actions:[String]=[];modal?.onAction={actions.append($0)}
        host.present(try XCTUnwrap(modal),animated:false)
        await fulfillment(of:[installed,ready],timeout:5)
        XCTAssertTrue(modal?.view.isUserInteractionEnabled==true)
        modal?.suspend();XCTAssertFalse(modal?.view.isUserInteractionEnabled ?? true);modal?.resume()
        modal?.buttons[0].sendActions(for:.touchUpInside);XCTAssertEqual(actions,["restart"])
        modal?.closeFromOwner();await fulfillment(of:[closed],timeout:3)
        for button in modal?.buttons ?? [] {XCTAssertTrue(button.paintLayers.allSatisfy{($0.animationKeys() ?? []).isEmpty})}
        XCTAssertNil(modal?.idle.layer.sublayers?.first{$0.name=="native.end-run.paper-shadow"})
        modal=nil;CATransaction.flush()
        let deadline=ProcessInfo.processInfo.systemUptime+2
        while released != nil,ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(released)
        XCTAssertFalse(JimiV9PlainButton(type:.custom).layer is CATransformLayer,"Other buttons retain their existing implementation")
    }
}
