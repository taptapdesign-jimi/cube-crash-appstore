import XCTest
import UIKit
import ImageIO
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeRewardCardRenderingTests:XCTestCase {
    func testMountedGameplayRewardOwnsOpaquePaperMatchingGameplayViewport() throws {
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
            let reward=NativeJourneyRewardController(root:NativeTestResources.root,board:1,score:1000,generation:engine.state.generation);reward.setRewardActionsAdmitted(false)
            game.mountJourneyRewardController(reward,generation:engine.state.generation);reward.view.layoutIfNeeded()
            defer{reward.dispose();reward.willMove(toParent:nil);reward.view.removeFromSuperview();reward.removeFromParent()}
            let rewardPaper=try XCTUnwrap(reward.view.subviews.first as? NativeAppPaperSurface)
            XCTAssertFalse(rewardPaper.isHidden);XCTAssertTrue(reward.view.isOpaque);XCTAssertEqual(reward.view.backgroundColor?.cgColor.alpha,1)
            XCTAssertTrue(reward.parent === game);XCTAssertTrue(reward.view.window === window)
            let rewardPixels=UIGraphicsImageRenderer(bounds:rewardPaper.bounds,format:format).image{rewardPaper.layer.render(in:$0.cgContext)}.pngData()
            XCTAssertEqual(before,rewardPixels,"Separate reward screen preserves the canonical paper appearance")
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
        XCTAssertEqual(texture.frame.height,actual.bounds.height+24,accuracy:0.000001);XCTAssertEqual(texture.contentMode,.scaleAspectFill)
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
        let imageViews=faces.flatMap{$0.subviews.flatMap(\.subviews)}.compactMap{$0 as? UIImageView}.filter{$0.accessibilityIdentifier=="native.reward.card-front"}
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
    func testMountedCommonUnlockHasOriginalArtWithoutShimmerOrBurn() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let controller=NativeJourneyRewardController(root:root,board:1,score:1000,generation:2,awardedStars:1,reducedMotion:false,random:{0.37})
        var filters=0,faces=0
        controller.prepareFilteredFrames={images,lease,done in filters+=1;NativeRewardFilteredFrames.prepare(images,lease:lease,completion:done)}
        controller.prepareFaceEffects={image,lease,done in faces+=1;NativeRewardFilteredFrames.prepareFaceEffects(image,lease:lease,completion:done)}
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}
        controller.view.layoutIfNeeded();controller.start()
        let deadline=ProcessInfo.processInfo.systemUptime+15
        while controller.phase != "interim",ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(controller.phase,"interim")
        controller.activate()
        while controller.phase != "unlocked",ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(controller.phase,"unlocked");XCTAssertEqual(filters,0);XCTAssertEqual(faces,0)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let layers=descendants(controller.view.layer)
        XCTAssertFalse(layers.contains{$0.name=="native.reward.magic-card.sheen" || $0.name=="native.reward.magic-card.burn"})
        let glow=layers.first{$0.name=="native.reward.unlocked-burn"}
        XCTAssertNil(glow?.contents);XCTAssertTrue((glow?.animationKeys() ?? []).isEmpty)
        XCTAssertNotNil(controller.view.subviews.compactMap{$0 as? UILabel}.first{$0.text=="Common"})
        let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/common-no-effects/common.png"))
        let attachment=XCTAttachment(image:image);attachment.name="Common-without-shimmer-or-burn";attachment.lifetime = .keepAlways;add(attachment)
    }

    func testActualLegendaryMagicCardDelayedUnlockedEntry() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let controller=NativeJourneyRewardController(root:root,board:1,score:1000,generation:2,awardedStars:3,reducedMotion:false,random:{0.37})
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
        let authoredImages=descendants(magic).filter{($0.name ?? "").hasPrefix("magic.image.") && $0.contents != nil}
        XCTAssertEqual(authoredImages.count,9,"SVG image roles: \(authoredImages.compactMap(\.name))")
        XCTAssertTrue(descendants(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})},"Authored SVG tracks hold while its separate shimmer/burn continues")
        XCTAssertTrue(visiblyMounted(magic))
        capture("Native SVG fully open card waiting for click")
        controller.activate()
        XCTAssertTrue(descendants(magic).contains{!($0.animationKeys() ?? []).isEmpty})
        try await Task.sleep(for:.milliseconds(55))
        let lastImage=try XCTUnwrap(descendants(magic).last{($0.name ?? "").hasPrefix("magic.image.") && $0.contents != nil})
        XCTAssertGreaterThan(lastImage.presentation()?.opacity ?? 0,0.9,"SVG exit carrier remains visible during unlocked entry")
        let unlockedFace=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.card-front"})
        XCTAssertEqual(unlockedFace.presentation()?.opacity ?? 1,0,accuracy:0.001,"Unlocked stays hidden through the requested540ms delay")
        controller.setForeground(false)
        let marker=URL(fileURLWithPath:NSTemporaryDirectory()).appendingPathComponent("magic-card-overlap-ready")
        try Data("ready".utf8).write(to:marker)
        defer{try? FileManager.default.removeItem(at:marker)}
        // A host simctl screenshot captures the real compositor, including SVG
        // animations that UIKit/layer.render omit from their model snapshot.
        try await Task.sleep(for:.seconds(6))
        controller.setForeground(true)
        let unlockedVisible=try await waitUntil{(unlockedFace.presentation()?.opacity ?? 0)>0.9}
        XCTAssertTrue(unlockedVisible,"The queued settle and ordered entry must expose the full-density front after resume")
        let burn=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"})
        let burnVisible=try await waitUntil {burn.contents != nil && (burn.presentation()?.opacity ?? 0)>0.8}
        XCTAssertTrue(burnVisible,"Real filtered unlocked card burn must reach its visible peak")
        capture("UIView hierarchy snapshot while unlocked burn presentation is active")
        let unlocked=try await waitUntil {controller.phase=="unlocked" && (burn.presentation()?.opacity ?? 0)<0.05}
        XCTAssertTrue(unlocked)
        capture("UIView hierarchy snapshot of settled unlocked card")
    }

    func testMountedHelloGooLegendaryKeepsOriginalResolutionAndTransparentBurnGap()async throws {
        let root=NativeTestResources.root
        let controller=NativeJourneyRewardController(root:root,board:27,score:100000,generation:27,awardedStars:3,reducedMotion:false,random:{0.37})
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first)
        let prior=scene.windows.first(where:{$0.isKeyWindow})
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:390,height:844);window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        func wait(_ condition:()->Bool)async throws {
            let deadline=ProcessInfo.processInfo.systemUptime+20
            while !condition(),ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(condition())
        }
        func tree(_ layer:CALayer)->[CALayer] {
            [layer]+(layer.sublayers ?? []).flatMap{tree($0)}+(layer.mask.map{tree($0)} ?? [])
        }
        func image(_ contents:Any?)->CGImage? {
            guard let contents,CFGetTypeID(contents as CFTypeRef)==CGImage.typeID else{return nil}
            return contents as! CGImage
        }
        func maxAlpha(_ image:CGImage)throws->UInt8 {
            let context=try XCTUnwrap(CGContext(data:nil,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
            let bytes=try XCTUnwrap(context.data).assumingMemoryBound(to:UInt8.self)
            var maximum:UInt8=0
            for offset in stride(from:3,to:image.width*image.height*4,by:4) {maximum=max(maximum,bytes[offset])}
            return maximum
        }
        controller.view.layoutIfNeeded();controller.start()
        try await wait{controller.phase=="interim"};controller.activate()
        try await wait{controller.phase=="unlocked"}
        let hero=try XCTUnwrap(controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"})
        try await wait{tree(hero.layer).contains{$0.name=="native.reward.magic-card.burn"}}
        let layers=tree(hero.layer)
        for name in ["native.reward.card-pose","native.reward.unlocked-spatial","native.reward.collect-rotor"] {
            let spatial=try XCTUnwrap(layers.first{$0.name==name})
            XCTAssertTrue(spatial is CATransformLayer,"Every spatial stage must preserve the original photo through its3D ancestors")
            XCTAssertEqual(spatial.opacity,1,"Visibility belongs outside the spatial chain or on final paint leaves")
            XCTAssertFalse((spatial.animationKeys() ?? []).contains{$0.hasPrefix("reward.opacity")})
        }
        XCTAssertFalse(hero.layer is CATransformLayer);XCTAssertTrue(CATransform3DIsIdentity(hero.layer.transform))
        func imageViews(_ view:UIView)->[UIImageView] {(view as? UIImageView).map{[$0]} ?? view.subviews.flatMap{imageViews($0)}}
        let front=try XCTUnwrap(imageViews(hero).first{$0.accessibilityIdentifier=="native.reward.card-front"}?.image?.cgImage)
        XCTAssertEqual(front.width,1032)
        let back=try XCTUnwrap(imageViews(hero).first{$0.accessibilityIdentifier=="native.reward.collect-back"})
        XCTAssertEqual(back.image?.cgImage?.width,1032);XCTAssertEqual(back.image?.cgImage?.height,1528)
        XCTAssertFalse(back.layer.isDoubleSided)
        let original=try XCTUnwrap(JimiV9Artwork(resourceRoot:root).image(NativeJourneyContent.cardAsset(board:27,stars:3,doubleDensity:true))?.cgImage)
        XCTAssertEqual(front.width,original.width);XCTAssertEqual(front.height,original.height)
        let foil=try XCTUnwrap(layers.first{$0.mask != nil && ($0.sublayers ?? []).contains{$0 is CAGradientLayer}})
        let foilMask=try XCTUnwrap(image(foil.mask?.contents))
        XCTAssertTrue(foilMask === front,"Foil clips with the exact original-density front image")
        let burn=try XCTUnwrap(layers.first{$0.name=="native.reward.magic-card.burn"})
        let burnMask=try XCTUnwrap(image(burn.mask?.contents))
        XCTAssertTrue(burnMask === front,"Burn clips its low-frequency light field with the original-density artwork")
        for layer in layers {
            XCTAssertEqual(layer.contentsScale,window.screen.scale,accuracy:0.001,layer.name ?? "reward descendant/mask")
            XCTAssertFalse(layer.shouldRasterize,layer.name ?? "reward descendant/mask")
        }
        try await wait{burn.animation(forKey:"native.reward.magic-card.burn") != nil}
        let group=try XCTUnwrap(burn.animation(forKey:"native.reward.magic-card.burn") as? CAAnimationGroup)
        let sequence=try XCTUnwrap(group.animations?.first as? CAKeyframeAnimation)
        let frames=try XCTUnwrap(sequence.values).compactMap{image($0)}
        XCTAssertEqual(frames.count,31)
        XCTAssertEqual(try maxAlpha(try XCTUnwrap(frames.first)),0)
        XCTAssertEqual(try maxAlpha(try XCTUnwrap(frames.last)),0)
        var peakAlpha:UInt8=0
        for frame in frames {
            let alpha=try maxAlpha(frame);peakAlpha=max(peakAlpha,alpha)
            XCTAssertLessThan(alpha,255,"Burn frames must never contain an opaque downsampled photograph")
        }
        XCTAssertGreaterThan(peakAlpha,0,"The authored burn light remains visible during its active interval")
        // Use the real repeat clock, preserving the normal shimmer/foil motion.
        try await wait{
            let phase=(burn.convertTime(CACurrentMediaTime(),from:nil)-group.beginTime).truncatingRemainder(dividingBy:group.duration)
            return phase>1.2 && phase<2.7
        }
        if let visible=image(burn.presentation()?.contents) {XCTAssertEqual(try maxAlpha(visible),0,"The repeat gap must expose the high-resolution front")}
        let folder=URL(fileURLWithPath:"/tmp/reward-card-high-quality",isDirectory:true)
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let format=UIGraphicsImageRendererFormat();format.scale=3;format.opaque=false
        let screenshot=UIGraphicsImageRenderer(bounds:window.bounds,format:format).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try XCTUnwrap(screenshot.pngData()).write(to:folder.appendingPathComponent("hello-goo-legendary-unlocked-gap-3x.png"))
        let attachment=XCTAttachment(image:screenshot);attachment.name="Hello Goo Legendary original-resolution quiet burn gap 3x";attachment.lifetime = .keepAlways;add(attachment)
        // Diagnostic A/B only: reproduce the old low-resolution photo overlay
        // at the exact frozen pose; this is not a historical before-build image.
        let cardPose=try XCTUnwrap(layers.first{$0.name=="native.reward.card-pose"})
        try await wait{abs((cardPose.animation(forKey:"reward.transform.0.0")?.duration ?? 0)-2.1)<0.001}
        let coachedFront=try XCTUnwrap(imageViews(hero).first{$0.accessibilityIdentifier=="native.reward.card-front"})
        XCTAssertTrue(coachedFront.image?.cgImage === front,"Hand coach must keep the exact original-density photo")
        XCTAssertTrue(cardPose is CATransformLayer)
        XCTAssertFalse(coachedFront.layer.shouldRasterize,"Coach must never replace the photo with a flattened animated snapshot")
        controller.setForeground(false)
        let frozenAfter=UIGraphicsImageRenderer(bounds:window.bounds,format:format).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try XCTUnwrap(frozenAfter.pngData()).write(to:folder.appendingPathComponent("hello-goo-frozen-after-3x.png"))
        let previousContents=burn.contents,previousAnimation=burn.animation(forKey:"native.reward.magic-card.burn")
        defer{
            CATransaction.begin();CATransaction.setDisableActions(true);burn.contents=previousContents
            if let previousAnimation {burn.add(previousAnimation,forKey:"native.reward.magic-card.burn")}
            CATransaction.commit();controller.setForeground(true)
        }
        let lowResolution=try XCTUnwrap(CGContext(data:nil,width:360,height:533,bitsPerComponent:8,bytesPerRow:360*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
        lowResolution.draw(front,in:CGRect(x:0,y:0,width:360,height:533))
        let oldOverlay=try XCTUnwrap(lowResolution.makeImage())
        CATransaction.begin();CATransaction.setDisableActions(true)
        burn.removeAnimation(forKey:"native.reward.magic-card.burn");burn.contents=oldOverlay
        CATransaction.commit()
        let simulatedBefore=UIGraphicsImageRenderer(bounds:window.bounds,format:format).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try XCTUnwrap(simulatedBefore.pngData()).write(to:folder.appendingPathComponent("hello-goo-frozen-simulated-old-lowres-overlay-3x.png"))
        let diagnostic=XCTAttachment(image:simulatedBefore);diagnostic.name="Diagnostic simulated old 360px photo overlay at same frozen pose";diagnostic.lifetime = .keepAlways;add(diagnostic)
    }

}
