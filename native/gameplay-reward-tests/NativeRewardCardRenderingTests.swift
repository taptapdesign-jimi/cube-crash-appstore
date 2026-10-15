import XCTest
import UIKit
import ImageIO
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeRewardCardRenderingTests:XCTestCase {
    func testMountedGameplayRewardKeepsTheSameWindowAnchoredPaper() throws {
        for size in [CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[]))
            let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
            let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first),previous=scene.windows.first{$0.isKeyWindow}
            let window=UIWindow(windowScene:scene);window.frame=CGRect(origin:.zero,size:size);window.rootViewController=game;window.makeKeyAndVisible()
            defer{game.dispose();window.isHidden=true;window.rootViewController=nil;previous?.makeKey()}
            game.view.frame=window.bounds;game.view.layoutIfNeeded()
            let paper=try XCTUnwrap(game.view.subviews.first as? NativeAppPaperSurface);paper.layoutIfNeeded()
            let rect=paper.convert(paper.bounds,to:window)
            let format=UIGraphicsImageRendererFormat();format.scale=1
            func pixels()->Data? {UIGraphicsImageRenderer(bounds:paper.bounds,format:format).image{paper.layer.render(in:$0.cgContext)}.pngData()}
            let before=try XCTUnwrap(pixels())
            let reward=NativeJourneyRewardController(root:NativeTestResources.root,board:1,score:1000,generation:90);reward.useGameplayPaper();reward.setRewardActionsAdmitted(false)
            game.addChild(reward);reward.view.frame=game.view.bounds;game.view.addSubview(reward.view);reward.didMove(toParent:game);reward.view.layoutIfNeeded()
            defer{reward.dispose();reward.willMove(toParent:nil);reward.view.removeFromSuperview();reward.removeFromParent()}
            XCTAssertTrue(reward.view.subviews.first?.isHidden == true);XCTAssertFalse(reward.view.isOpaque);XCTAssertEqual(reward.view.backgroundColor,.clear)
            XCTAssertTrue(game.view.subviews.first === paper);XCTAssertEqual(rect,paper.convert(paper.bounds,to:window));XCTAssertEqual(before,try XCTUnwrap(pixels()))
            XCTAssertEqual(paper.bounds.size,size)
        }
    }
    func testNewRewardUsesExactCanonicalGamePaperIncludingLowerExtension() throws {
        let root=NativeTestResources.root
        let controller=NativeJourneyRewardController(root:root,board:1,score:1000,generation:90)
        controller.loadViewIfNeeded();defer{controller.dispose()}
        controller.view.frame=CGRect(x:0,y:0,width:390,height:844);controller.view.layoutIfNeeded()
        let actual=try XCTUnwrap(controller.view.subviews.first as? NativeAppPaperSurface)
        let reference=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:root))
        reference.frame=actual.frame;actual.layoutIfNeeded();reference.layoutIfNeeded()
        let texture=try XCTUnwrap(actual.subviews.first as? UIImageView)
        XCTAssertEqual(texture.frame.height,actual.bounds.height+64);XCTAssertEqual(texture.contentMode,.scaleToFill)
        func pixels(_ view:UIView)->Data? {
            let format=UIGraphicsImageRendererFormat();format.scale=1
            return UIGraphicsImageRenderer(bounds:view.bounds,format:format).image{view.layer.render(in:$0.cgContext)}.pngData()
        }
        XCTAssertEqual(pixels(actual),pixels(reference),"Reward paper must match canonical gameplay paper pixel for pixel")
    }
    func testMountedRewardKeepsOriginalDensityAndLiveAntialiasedFaces() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let resources=JimiNativeWorldResources(root:root)
        let cardPath=NativeJourneyContent.cardAsset(board:1,score:1000,doubleDensity:true)
        let controller=NativeJourneyRewardController(root:root,board:1,score:1000,generation:1,resources:resources,reducedMotion:true,random:{0.37})
        controller.prepareFilteredFrames={images,_,completion in completion(images)}
        controller.loadViewIfNeeded()
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first)
        let previousKey=scene.windows.first(where:{$0.isKeyWindow})
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:390,height:844);window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil;previousKey?.makeKey()}
        // Preparation uses its admitted main-actor adoption, even for cached art.
        func artworkReady(_ view:UIView)->Bool {
            if let image=view as? UIImageView,image.image?.cgImage != nil,image.layer.minificationFilter == .trilinear {return true}
            return view.subviews.contains{artworkReady($0)}
        }
        for _ in 0..<100 {
            controller.view.layoutIfNeeded()
            if artworkReady(controller.view) {break}
            try await Task.sleep(for:.milliseconds(10))
        }
        let hero=try XCTUnwrap(controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"})
        let pose=try XCTUnwrap(hero.subviews.first)
        let faces=pose.subviews
        XCTAssertEqual(faces.count,2)
        let imageViews=faces.compactMap{$0.subviews.first?.subviews.first as? UIImageView}
        XCTAssertEqual(imageViews.count,1)
        for face in faces+faces.flatMap(\.subviews) {
            XCTAssertTrue(face.layer.allowsEdgeAntialiasing)
            XCTAssertFalse(face.layer.shouldRasterize)
            XCTAssertEqual(face.layer.contentsScale,window.screen.scale)
        }
        for image in imageViews {
            XCTAssertNotNil(image.image?.cgImage)
            XCTAssertTrue(image.layer.allowsEdgeAntialiasing)
            XCTAssertEqual(image.layer.minificationFilter,.trilinear)
            XCTAssertFalse(image.layer.shouldRasterize)
        }
        let front=try XCTUnwrap(imageViews.last?.image?.cgImage)
        XCTAssertEqual(front.width,JimiV9Artwork(resourceRoot:root).image(cardPath)?.cgImage?.width)
        XCTAssertFalse(CATransform3DIsIdentity(faces[0].layer.transform),"Actual authored tilted face remains live")
        try await Task.sleep(for:.milliseconds(1100))
        let screenshot=UIGraphicsImageRenderer(bounds:controller.view.bounds).image{_ in controller.view.drawHierarchy(in:controller.view.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:screenshot);attachment.name="New reward original artwork and transformed face";attachment.lifetime = .keepAlways;add(attachment)
    }
    func testActualMagicCardDelayedUnlockedEntry() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let controller=NativeJourneyRewardController(root:root,board:1,score:1000,generation:2,reducedMotion:false,random:{0.37})
        controller.loadViewIfNeeded()
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first)
        let previousKey=scene.windows.first(where:{$0.isKeyWindow})
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:390,height:844);window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil;previousKey?.makeKey()}
        controller.view.layoutIfNeeded();controller.start()
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        // Sample the real presentation tree, so the exit snapshot retains
        // animated SVG contents instead of its already-hidden model endpoint.
        func capture(_ name:String) {
            let image=UIGraphicsImageRenderer(bounds:controller.view.bounds).image{context in (controller.view.layer.presentation() ?? controller.view.layer).render(in:context.cgContext)}
            let attachment=XCTAttachment(image:image);attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
        }
        func waitUntil(_ condition:()->Bool) async throws -> Bool {
            let deadline=ProcessInfo.processInfo.systemUptime+6
            while ProcessInfo.processInfo.systemUptime<deadline {
                if condition() {return true}
                try await Task.sleep(for:.milliseconds(10))
            };return false
        }
        func visiblyMounted(_ layer:CALayer)->Bool {
            var current:CALayer?=layer
            while let node=current {
                if node.isHidden || (node.presentation()?.opacity ?? node.opacity)<0.5 {return false}
                current=node.superlayer
            };return true
        }
        let interimVisible=try await waitUntil {controller.phase=="interim"}
        XCTAssertTrue(interimVisible,"Real SVG opening must reach its stable open card")
        let magic=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.magic-card"})
        XCTAssertEqual(descendants(magic).filter{$0.contents != nil}.count,9)
        XCTAssertTrue(descendants(magic).allSatisfy{($0.animationKeys() ?? []).isEmpty})
        XCTAssertTrue(visiblyMounted(magic))
        capture("Native SVG fully open card waiting for click")
        controller.activate()
        XCTAssertTrue(descendants(magic).contains{!($0.animationKeys() ?? []).isEmpty})
        try await Task.sleep(for:.milliseconds(55))
        let lastImage=try XCTUnwrap(descendants(magic).last{$0.contents != nil})
        XCTAssertGreaterThan(lastImage.presentation()?.opacity ?? 0,0.9,"SVG exit carrier remains visible during unlocked entry")
        let unlockedFace=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"}?.superlayer?.superlayer)
        XCTAssertEqual(unlockedFace.presentation()?.opacity ?? 1,0,accuracy:0.001,"Unlocked stays hidden through the requested300ms delay")
        controller.setForeground(false)
        let marker=URL(fileURLWithPath:NSTemporaryDirectory()).appendingPathComponent("magic-card-overlap-ready")
        try Data("ready".utf8).write(to:marker)
        defer{try? FileManager.default.removeItem(at:marker)}
        // A host simctl screenshot captures the real compositor, including SVG
        // animations that UIKit/layer.render omit from their model snapshot.
        try await Task.sleep(for:.seconds(6))
        controller.setForeground(true)
        try await Task.sleep(for:.milliseconds(280))
        XCTAssertGreaterThan(unlockedFace.presentation()?.opacity ?? 0,0.9)
        let burn=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"})
        let burnVisible=try await waitUntil {burn.contents != nil && (burn.presentation()?.opacity ?? 0)>0.8}
        XCTAssertTrue(burnVisible,"Real filtered unlocked card burn must reach its visible peak")
        capture("UIView hierarchy snapshot while unlocked burn presentation is active")
        let unlocked=try await waitUntil {controller.phase=="unlocked" && (burn.presentation()?.opacity ?? 0)<0.05}
        XCTAssertTrue(unlocked)
        capture("UIView hierarchy snapshot of settled unlocked card")
    }

}
