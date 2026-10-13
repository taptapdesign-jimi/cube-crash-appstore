import XCTest
import UIKit
import ImageIO
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeRewardCardRenderingTests:XCTestCase {
    func testMountedRewardKeepsOriginalDensityAndLiveAntialiasedFaces() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let resources=JimiNativeWorldResources(root:root)
        let cardPath=NativeJourneyContent.cardAsset(board:1,score:1000,doubleDensity:true)
        let paths=[cardPath,"assets/animations/sand/zguzvano1.png","assets/animations/sand/zguzvano9.png"]
        let ready=expectation(description:"original reward pixels ready")
        resources.prepare(paths,owner:-50001,required:true){accepted in XCTAssertTrue(accepted);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
        let selected=try XCTUnwrap(resources.image("assets/animations/sand/zguzvano9.png",owner:-50001))
        let baseURL=root.appendingPathComponent("assets/animations/sand/zguzvano9.png")
        let baseSource=try XCTUnwrap(CGImageSourceCreateWithURL(baseURL as CFURL,nil))
        let original=try XCTUnwrap(CGImageSourceCreateImageAtIndex(baseSource,0,nil))
        XCTAssertEqual(selected.scale,2)
        XCTAssertGreaterThan(try XCTUnwrap(selected.cgImage).width,original.width)
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
        XCTAssertEqual(imageViews.count,2)
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
        XCTAssertEqual(front.width,resources.image(cardPath,owner:-50001)?.cgImage?.width)
        XCTAssertFalse(CATransform3DIsIdentity(faces[0].layer.transform),"Actual authored tilted face remains live")
        try await Task.sleep(for:.milliseconds(850))
        let screenshot=UIGraphicsImageRenderer(bounds:controller.view.bounds).image{_ in controller.view.drawHierarchy(in:controller.view.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:screenshot);attachment.name="New reward original artwork and transformed face";attachment.lifetime = .keepAlways;add(attachment)
    }
    func testActualRewardInterimShimmerAndUnlockedBurnVisualArtifacts() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let controller=NativeJourneyRewardController(root:root,board:1,score:1000,generation:2,reducedMotion:false,random:{0.37})
        controller.loadViewIfNeeded()
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first)
        let previousKey=scene.windows.first(where:{$0.isKeyWindow})
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:390,height:844);window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil;previousKey?.makeKey()}
        controller.view.layoutIfNeeded();controller.start()
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        // drawHierarchy captures UIView contents, not proof of the compositor's
        // animated effect intensity; presentation visibility is asserted separately.
        func capture(_ name:String) {
            let image=UIGraphicsImageRenderer(bounds:controller.view.bounds).image{_ in controller.view.drawHierarchy(in:controller.view.bounds,afterScreenUpdates:true)}
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
        let interimVisible=try await waitUntil {
            guard controller.phase=="interim" else{return false}
            return descendants(controller.view.layer).contains {layer in
                guard layer is CAGradientLayer,let surface=layer.superlayer,surface.name=="native.reward.interim-shimmer" else{return false}
                return (layer.presentation()?.opacity ?? 0)>0.4 && surface.mask?.contents != nil && visiblyMounted(surface)
            }
        }
        XCTAssertTrue(interimVisible,"Real interim shimmer must paint before reveal")
        capture("UIView hierarchy snapshot while interim shimmer presentation is active")
        controller.activate()
        let burn=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"})
        let burnVisible=try await waitUntil {burn.contents != nil && (burn.presentation()?.opacity ?? 0)>0.8}
        XCTAssertTrue(burnVisible,"Real filtered unlocked card burn must reach its visible peak")
        capture("UIView hierarchy snapshot while unlocked burn presentation is active")
        let unlocked=try await waitUntil {controller.phase=="unlocked" && (burn.presentation()?.opacity ?? 0)<0.05}
        XCTAssertTrue(unlocked)
        capture("UIView hierarchy snapshot of settled unlocked card")
    }

}
