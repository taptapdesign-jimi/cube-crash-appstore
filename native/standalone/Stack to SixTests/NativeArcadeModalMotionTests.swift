import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadeModalMotionTests: XCTestCase {
    func testAllArcadePaperTracksMatchMountedCuberoDetail() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full motion parity")}
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let detail=NativeBackpackDetail(die:try XCTUnwrap(NativeBackpackCatalog.arcade.first{$0.id=="cubero"}),assets:assets,motion:motion)
        detail.entersImmediately=true
        host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host)
        detail.beginImmediatePresentation()
        defer{detail.dispose();detail.view.removeFromSuperview();detail.removeFromParent();motion.cancel();window.isHidden=true}
        func tracks(_ root:UIView,key:String)->[CAKeyframeAnimation] {
            (root.layer.animation(forKey:key).flatMap{$0 as? CAKeyframeAnimation}.map{[$0]} ?? []) + root.subviews.flatMap{tracks($0,key:key)}
        }
        let reference=tracks(detail.view,key:"backpack.detail.enter")
        XCTAssertEqual(reference.count,2)
        for index in 0..<3 {
            let modal=NativeArcadeWorldModal(frame:window.bounds,assets:assets,index:index)
            host.view.addSubview(modal);modal.reveal()
            defer{modal.dispose()}
            let actual=tracks(modal,key:"arcade.modal.enter")
            XCTAssertEqual(actual.count,reference.count)
            for (arcade,backpack) in zip(actual,reference) {
                XCTAssertEqual(arcade.duration,backpack.duration,accuracy:0.0001)
                XCTAssertEqual(arcade.keyTimes,backpack.keyTimes)
                XCTAssertTrue(NSArray(array:arcade.values ?? []).isEqual(to:backpack.values ?? []))
                let arcadeCurves=try XCTUnwrap(arcade.timingFunctions),backpackCurves=try XCTUnwrap(backpack.timingFunctions)
                XCTAssertEqual(arcadeCurves.count,backpackCurves.count)
                for (a,b) in zip(arcadeCurves,backpackCurves) {for point in 0...3 {
                    var actual=[Float](repeating:0,count:2),expected=actual
                    a.getControlPoint(at:point,values:&actual);b.getControlPoint(at:point,values:&expected)
                    XCTAssertEqual(actual,expected)
                }}
                XCTAssertEqual(arcade.fillMode,backpack.fillMode)
            }
        }
    }

    func testModalCloseEnterSharesEpochRetainsTiltAndRetiresWithModal() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full motion fixture")}
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer{window.isHidden=true}
        weak var retired:UIView?
        try autoreleasepool {
            let card=UIView(frame:host.view.bounds),flip=UIView(frame:host.view.bounds),close=UIView()
            retired=close;host.view.addSubview(card);card.addSubview(flip);flip.addSubview(close)
            JimiNativeModalV10.layoutClose(close,frame:CGRect(x:300,y:0,width:52,height:52),modalTilt:2)
            let rest=close.transform,epoch=CACurrentMediaTime()+0.1
            JimiNativeModalV10.enterClose(close,beginTime:epoch)
            JimiNativeModalV10.enter(card:card,flip:flip,key:"test.enter",beginTime:epoch)
            let animation=try XCTUnwrap(close.layer.animation(forKey:JimiNativeModalV10.closeEnterKey) as? CAAnimationGroup)
            let motion=try XCTUnwrap(animation.animations?.first as? CAKeyframeAnimation)
            let fade=try XCTUnwrap(animation.animations?.last as? CABasicAnimation)
            XCTAssertEqual(fade.keyPath,"opacity");XCTAssertEqual(fade.fromValue as? Int,0)
            XCTAssertEqual(fade.duration,0.20/1.6/0.6,accuracy:0.0001)
            XCTAssertEqual(animation.beginTime,close.layer.convertTime(epoch,from:nil)+1.0/3,accuracy:0.0001)
            XCTAssertEqual(animation.duration,0.38/1.6/0.6,accuracy:0.0001)
            XCTAssertEqual(animation.fillMode,.backwards)
            let paper=try XCTUnwrap(card.layer.animation(forKey:"test.enter"))
            let paperEnd=card.layer.convertTime(paper.beginTime+paper.duration,to:close.layer)
            XCTAssertEqual((paperEnd-animation.beginTime)/animation.duration,0.8,accuracy:0.0001)
            XCTAssertEqual(animation.beginTime+animation.duration-paperEnd,0.0791666667,accuracy:0.0001)
            let values=try XCTUnwrap(motion.values as? [NSValue]).map{$0.caTransform3DValue}
            XCTAssertEqual(hypot(values[0].m11,values[0].m12),0,accuracy:0.0001)
            XCTAssertGreaterThan(values.map{hypot($0.m11,$0.m12)}.max() ?? 0,1.30)
            XCTAssertGreaterThan(values.map{hypot($0.m21,$0.m22)}.max() ?? 0,1.15)
            XCTAssertEqual(values.last!.m11,rest.a,accuracy:0.0001)
            XCTAssertEqual(values.last!.m12,rest.b,accuracy:0.0001)
            XCTAssertEqual(values.first!.m42,rest.ty+22,accuracy:0.0001)
            XCTAssertLessThan(values.map{$0.m42}.min() ?? 0,rest.ty)
            XCTAssertEqual(values.last!.m42,rest.ty,accuracy:0.0001)
            // A later layout keeps the model rest pose while CA owns the reveal.
            JimiNativeModalV10.layoutClose(close,frame:CGRect(x:300,y:0,width:52,height:52),modalTilt:2)
            XCTAssertEqual(close.transform,rest);XCTAssertEqual(close.bounds.width,52)
            card.layer.speed=0;XCTAssertEqual(close.layer.convertTime(epoch,from:nil),close.layer.convertTime(epoch+1,from:nil),accuracy:0.0001)
            close.layer.removeAllAnimations();card.layer.removeAllAnimations();flip.layer.removeAllAnimations();card.removeFromSuperview()
            XCTAssertNil(close.layer.animation(forKey:JimiNativeModalV10.closeEnterKey))
        }
        XCTAssertNil(retired)
    }
    func testClosePaperTabBouncesWithXOnPhoneAndTablet() throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Full motion fixture")}
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for width:CGFloat in [390,820] {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:width,height:1180)),host=UIViewController()
            window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
            defer{window.isHidden=true}
            let parent=UIView(frame:window.bounds),paper=NativeModalPaperView(),close=UIButton()
            host.view.addSubview(parent);parent.addSubview(paper);parent.addSubview(close)
            paper.prepare(assets:assets);paper.fit(in:CGRect(x:0,y:0,width:width-70,height:440))
            JimiNativeModalV10.layoutClose(close,frame:CGRect(x:width-112,y:-10,width:52,height:52),modalTilt:2)
            let epoch=CACurrentMediaTime()+0.1
            JimiNativeModalV10.enterClose(close,beginTime:epoch)
            let icon=try XCTUnwrap(close.layer.animation(forKey:JimiNativeModalV10.closeEnterKey) as? CAAnimationGroup)
            let tab=try XCTUnwrap(paper.layer.mask?.sublayers?.first)
            let group=try XCTUnwrap(tab.animation(forKey:JimiNativeModalV10.closeEnterKey) as? CAAnimationGroup)
            let transform=try XCTUnwrap(icon.animations?.first as? CAKeyframeAnimation)
            let shape=try XCTUnwrap(group.animations?.first as? CAKeyframeAnimation)
            XCTAssertEqual(group.beginTime,tab.convertTime(icon.beginTime,from:close.layer),accuracy:0.0001)
            XCTAssertEqual(group.duration,icon.duration);XCTAssertEqual(group.fillMode,icon.fillMode)
            XCTAssertEqual(shape.keyTimes,transform.keyTimes)
            XCTAssertEqual((group.animations?.last as? CABasicAnimation)?.duration,(icon.animations?.last as? CABasicAnimation)?.duration)
            let paths=try XCTUnwrap(shape.values as? [CGPath]),poses=try XCTUnwrap(transform.values as? [NSValue])
            XCTAssertEqual(paths.count,poses.count)
            for (path,value) in zip(paths,poses) {
                var pose=CATransform3DGetAffineTransform(value.caTransform3DValue)
                pose.tx += close.center.x-pose.a*close.bounds.midX-pose.c*close.bounds.midY-paper.frame.minX
                pose.ty += close.center.y-pose.b*close.bounds.midX-pose.d*close.bounds.midY-paper.frame.minY
                let expected=try XCTUnwrap(UIBezierPath(roundedRect:close.bounds,cornerRadius:16).cgPath.copy(using:&pose))
                XCTAssertEqual(path,expected)
            }
            let restBounds=try XCTUnwrap((tab as? CAShapeLayer)?.path).boundingBoxOfPath
            XCTAssertEqual(paths.last!.boundingBoxOfPath.minX,restBounds.minX,accuracy:0.0001)
            XCTAssertEqual(paths.last!.boundingBoxOfPath.maxY,restBounds.maxY,accuracy:0.0001)
            parent.layer.speed=0
            XCTAssertEqual(tab.convertTime(epoch,from:nil),tab.convertTime(epoch+1,from:nil),accuracy:0.0001)
            parent.layer.speed=1
            close.layer.removeAllAnimations();tab.removeAllAnimations()
            close.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal)
            close.imageEdgeInsets=UIEdgeInsets(top:14,left:14,bottom:14,right:14)
            for (label,index) in [("start",0),("squash",try XCTUnwrap(shape.keyTimes?.firstIndex(of:0.42))),("rest",paths.count-1)] {
                close.transform=CATransform3DGetAffineTransform(poses[index].caTransform3DValue)
                (tab as? CAShapeLayer)?.path=paths[index]
                let data=UIGraphicsImageRenderer(bounds:CGRect(x:0,y:-80,width:width,height:560)).pngData{parent.layer.render(in:$0.cgContext)}
                try data.write(to:URL(fileURLWithPath:"/tmp/native-close-unit-20261108/close-\(Int(width))-\(label).png"))
            }
            parent.removeFromSuperview()
        }
    }
    func testBenchmarkPaperReusesOriginalImageAndCropsExactUpperRightForClose() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let original=try XCTUnwrap(assets.image("assets/modals/paper.png"))
        let paper=NativeModalPaperView();paper.prepare(assets:assets)
        XCTAssertTrue(paper.image === original)
        let expected=try XCTUnwrap(NativeModalPaperView.closePaper(original))
        XCTAssertEqual(paper.closeMaterial?.pngData(),expected.pngData())
        paper.fit(in:CGRect(x:0,y:0,width:320,height:440));let count=paper.fitCount
        for _ in 0..<10{paper.fit(in:CGRect(x:0,y:0,width:320,height:440));XCTAssertTrue(paper.image === original)}
        XCTAssertEqual(paper.fitCount,count);XCTAssertEqual(paper.layer.cornerRadius,40)
        XCTAssertEqual(NativeModalPaperView.paths,["assets/modals/paper.png"])
    }
    func testPaperVariantsKeepAlphaDensityAndStableChoiceAcrossLayoutAndResume() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let folder=URL(fileURLWithPath:"/tmp/arcade-paper-20261106/renders")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        for path in NativeArcadeWorldModal.paperPaths {
            for density in [2,3] {
                let url=NativeTestResources.root.appendingPathComponent(path.replacingOccurrences(of:".png",with:"@\(density)x.png"))
                let image=try XCTUnwrap(UIImage(contentsOfFile:url.path)?.cgImage)
                XCTAssertEqual(image.width,390*density)
                XCTAssertEqual(image.height,544*density)
                XCTAssertTrue([CGImageAlphaInfo.last,.first,.premultipliedLast,.premultipliedFirst].contains(image.alphaInfo))
            }
        }
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let window=UIWindow(frame:CGRect(origin:.zero,size:size)),host=UIViewController()
            window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
            defer{window.isHidden=true}
            for mode in 0..<3 {for variant in NativeArcadeWorldModal.paperPaths.indices {
                weak var retired:NativeArcadeWorldModal?
                try autoreleasepool {
                    let modal=NativeArcadeWorldModal(frame:window.bounds,assets:assets,index:mode,paperVariant:variant)
                    retired=modal;host.view.addSubview(modal);modal.layoutIfNeeded()
                    let paper=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.paper") as? UIImageView)
                    let image=try XCTUnwrap(paper.image),rect=paper.frame
                    let close=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.close") as? JimiV9PlainButton)
                    let closeMaterial=try XCTUnwrap((paper as? NativeModalPaperView)?.closeMaterial)
                    XCTAssertNil(close.backgroundImage(for:.normal),"One joined paper plane replaces the separate Close patch")
                    XCTAssertEqual(closeMaterial.size,CGSize(width:96,height:96))
                    XCTAssertEqual(closeMaterial.scale,image.scale)
                    XCTAssertEqual(close.bounds.size,CGSize(width:52,height:52))
                    XCTAssertEqual(close.layer.cornerRadius,16)
                    XCTAssertEqual(modal.paperAssetPath,NativeArcadeWorldModal.paperPaths[variant])
                    XCTAssertEqual(paper.accessibilityValue,modal.paperAssetPath)
                    XCTAssertTrue(image === assets.image("assets/modals/paper.png"))
                    XCTAssertGreaterThan(paper.layer.contentsRect.width,0);XCTAssertLessThanOrEqual(paper.layer.contentsRect.width,1)
                    XCTAssertGreaterThan(paper.layer.contentsRect.height,0);XCTAssertLessThanOrEqual(paper.layer.contentsRect.height,1)
                    XCTAssertNotNil(paper.layer.mask);XCTAssertEqual(paper.layer.cornerRadius,40)
                    for _ in 0..<3 {
                        modal.setForeground(false);modal.setForeground(true);modal.setNeedsLayout();modal.layoutIfNeeded()
                        XCTAssertTrue(paper.image === image);XCTAssertEqual(paper.frame,rect)
                        XCTAssertTrue((paper as? NativeModalPaperView)?.closeMaterial === closeMaterial)
                        XCTAssertEqual(modal.paperAssetPath,NativeArcadeWorldModal.paperPaths[variant])
                    }
                    if mode == 0 {
                        let data=UIGraphicsImageRenderer(bounds:paper.bounds).pngData{paper.layer.render(in:$0.cgContext)}
                        try data.write(to:folder.appendingPathComponent("paper-\(variant)-\(Int(size.width)).png"))
                    }
                    modal.dispose();modal.removeFromSuperview()
                }
                XCTAssertNil(retired,"Paper must not retain a retired modal")
            }}
        }
    }
    private func wait(_ condition: () -> Bool) async throws {
        let end = Date().addingTimeInterval(4)
        while !condition(), Date() < end { try await Task.sleep(for: .milliseconds(20)) }
        XCTAssertTrue(condition())
    }
    private func descendant(_ view: UIView, id: String) -> UIView? {
        if view.accessibilityIdentifier == id { return view }
        return view.subviews.lazy.compactMap { self.descendant($0, id: id) }.first
    }
    func testModalArtworkSpeechIsSceneSpecificAndRequiresVisibleReadyOwner() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded();defer{window.isHidden=true}
        for (index,scene) in ["arena-modal-endurance","arena-modal-grill","arena-modal-slow"].enumerated() {
            let modal=NativeArcadeWorldModal(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),index:index)
            var cues:[String]=[];modal.onFeedback={cues.append($0)};host.view.addSubview(modal)
            modal.perform(NSSelectorFromString("speechTapped"));XCTAssertTrue(cues.isEmpty)
            modal.reveal();try await wait{modal.accessibilityValue == "ready"}
            modal.perform(NSSelectorFromString("speechTapped"));XCTAssertEqual(cues,["scene-speech:"+scene])
            modal.setForeground(false);modal.perform(NSSelectorFromString("speechTapped"));XCTAssertEqual(cues.count,1)
            modal.dispose();modal.perform(NSSelectorFromString("speechTapped"));XCTAssertEqual(cues.count,1)
        }
    }
    func testCloseStopsOwnSceneSpeechAndEmitsModalCloseOnce() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        let modal=NativeArcadeWorldModal(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),index:0)
        defer{modal.dispose();window.isHidden=true}
        var cues:[String]=[];modal.onFeedback={cues.append($0)}
        host.view.addSubview(modal);modal.reveal()
        try await wait{modal.accessibilityValue == "ready"}
        let close=try XCTUnwrap(descendant(modal,id:"native.arcade-world-modal.close") as? UIButton)
        close.sendActions(for:.touchUpInside);close.sendActions(for:.touchUpInside)
        XCTAssertEqual(cues,["scene-speech-stop:arena-modal-endurance","modal-close"])
        modal.dispose();close.sendActions(for:.touchUpInside)
        XCTAssertEqual(cues,["scene-speech-stop:arena-modal-endurance","modal-close"])
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
            XCTAssertEqual(exitStarts,1);XCTAssertEqual(completed,0);XCTAssertEqual(cues,["scene-speech-stop:arena-modal-endurance","cta","modal-exit"])
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
            XCTAssertEqual(completed,0);XCTAssertEqual(cues,["scene-speech-stop:arena-modal-endurance","cta","modal-exit"])
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
    func testClusteredCloudsBehindEachIllustrationMovePauseResumeAndRetireWithoutRetention() async throws {
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
                XCTAssertNil(descendant(modal,id:"native.arcade-world-modal.rear-clouds"))
                let clouds=stage.subviews.compactMap{$0 as? UIImageView}
                let expectedCount=6
                XCTAssertEqual(clouds.count,expectedCount);XCTAssertEqual(Set(clouds.map{$0.bounds.width}).count,expectedCount)
                for (ordinal,cloud) in clouds.enumerated() {
                    XCTAssertLessThanOrEqual(cloud.bounds.width,(art.bounds.width+20)*[272.0,188,248,166,184,180][ordinal]/390*1.48+0.001)
                }
                XCTAssertLessThan(stage.layer.zPosition,art.layer.zPosition)
                _ = try clouds.map { item -> CGRect in
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
                XCTAssertFalse(stage.isUserInteractionEnabled)
                let originalIdle=try XCTUnwrap(art.layer.animation(forKey:"arcade.modal.art.idle") as? CAKeyframeAnimation)
                XCTAssertEqual(originalIdle.duration,6.8)
                for value in try XCTUnwrap(originalIdle.values) {
                    XCTAssertEqual(try XCTUnwrap(value as? NSValue).caTransform3DValue.m41,0)
                }
                for cloud in clouds {
                    XCTAssertNotNil(cloud.image)
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
