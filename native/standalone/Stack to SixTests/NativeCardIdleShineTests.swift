import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeCardIdleShineTests:XCTestCase {
    private func mount()throws->(UIWindow,UIImageView,UIWindow?) {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first),prior=scene.windows.first{$0.isKeyWindow}
        let window=UIWindow(windowScene:scene);window.frame=CGRect(x:0,y:0,width:390,height:844)
        let controller=UIViewController();window.rootViewController=controller;window.makeKeyAndVisible()
        let front=UIImageView(image:JimiV9Artwork(resourceRoot:NativeTestResources.root).image("assets/colelctibles/Area55/legendary/03-gold@2x.png"))
        front.frame=CGRect(x:35,y:150,width:320,height:474);controller.view.addSubview(front)
        return(window,front,prior)
    }
    func testExactRewardRecipeVisibleOnlyOnIllustratedFaceAndCancelReleasesPixels()async throws {
        let (window,front,prior)=try mount();defer{window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        let shine=NativeCardIdleShine(front:front,reducedMotion:{false});defer{shine.dispose()}
        shine.layout();XCTAssertNil(shine.layer.superlayer);XCTAssertEqual(shine.decodedBytes,0)
        shine.setVisible(true)
        let deadline=ProcessInfo.processInfo.systemUptime+10
        while shine.decodedBytes==0,ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertGreaterThan(shine.decodedBytes,0);XCTAssertLessThanOrEqual(shine.decodedBytes,7*1024*1024)
        XCTAssertTrue(shine.layer.superlayer === front.layer);XCTAssertEqual(shine.layer.opacity,0.72)
        let pass=try XCTUnwrap(shine.band.animation(forKey:"modal.card.idle-shine") as? CAAnimationGroup)
        XCTAssertEqual(pass.duration,3);XCTAssertEqual(pass.repeatCount,.infinity);XCTAssertNil(pass.delegate)
        let sweep=try XCTUnwrap(pass.animations?.first as? CABasicAnimation)
        XCTAssertEqual(sweep.duration,1.05);XCTAssertEqual(sweep.fromValue as? CGFloat,-front.bounds.width*0.26)
        XCTAssertEqual(sweep.toValue as? CGFloat,front.bounds.width*1.26)
        shine.setVisible(true);XCTAssertEqual(shine.band.animationKeys(),["modal.card.idle-shine"])
        shine.setVisible(false);XCTAssertNil(shine.layer.contents);XCTAssertNil(shine.layer.superlayer);XCTAssertNil(shine.band.animationKeys());XCTAssertEqual(shine.decodedBytes,0)
        shine.dispose();shine.dispose();XCTAssertNil(shine.layer.mask)
    }
    func testLatePreparationCannotReviveHiddenDisposedOrReplacedImageAndWeakOwnersRelease()throws {
        let (window,front,prior)=try mount();defer{window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        let image=try XCTUnwrap(front.image?.cgImage)
        var callbacks:[(@MainActor @Sendable (CGImage?)->Void)]=[],tokens:[NativeCardShineLease]=[]
        var shine:NativeCardIdleShine?=NativeCardIdleShine(front:front,prepare:{_,token,done in tokens.append(token);callbacks.append(done)},reducedMotion:{false})
        weak var weakShine=shine
        shine?.setVisible(true);shine?.setVisible(false)
        XCTAssertTrue(tokens[0].cancelled);callbacks[0](image);XCTAssertEqual(shine?.decodedBytes,0)
        shine?.setVisible(true);XCTAssertEqual(callbacks.count,2)
        let replacement=try XCTUnwrap(JimiV9Artwork(resourceRoot:NativeTestResources.root).image("assets/colelctibles/Area55/legendary/07-gold@2x.png")?.cgImage)
        XCTAssertFalse(replacement === image)
        front.image=UIImage(cgImage:replacement,scale:2,orientation:.up);shine?.layout()
        XCTAssertEqual(callbacks.count,3);XCTAssertTrue(tokens[1].cancelled)
        callbacks[1](image);XCTAssertEqual(shine?.decodedBytes,0)
        callbacks[2](replacement);XCTAssertGreaterThan(shine?.decodedBytes ?? 0,0)
        shine?.dispose();shine=nil;XCTAssertNil(weakShine)
        callbacks.forEach{$0(image)};XCTAssertTrue(tokens.allSatisfy(\.cancelled))
        XCTAssertFalse(front.layer.sublayers?.contains{$0.name=="modal.card.idle-shine"} ?? false)
        var requests=0
        let reduced=NativeCardIdleShine(front:front,prepare:{_,_,_ in requests+=1},reducedMotion:{true})
        reduced.setVisible(true);XCTAssertEqual(requests,0);reduced.dispose()
    }
    func testActualWorldEffectsFrontAdmissionBackgroundAndCleanupReleaseShine()async throws {
        guard !UIAccessibility.isReduceMotionEnabled else{throw XCTSkip("Motion is disabled")}
        let (window,front,prior)=try mount();defer{window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        let overlay=try XCTUnwrap(window.rootViewController?.view),resources=JimiNativeWorldResources(root:NativeTestResources.root)
        var effects:JimiNativeWorldCardEffects?=JimiNativeWorldCardEffects(front:front,impact:front,overlay:overlay,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),resources:resources,boardID:3,rarity:"legendary")
        weak var weakEffects=effects
        defer{effects?.cleanup();resources.cleanup()}
        effects?.present(frontFacing:false)
        func shine()->CALayer? {front.layer.sublayers?.first{$0.name=="modal.card.idle-shine"}}
        XCTAssertNil(shine());effects?.present(frontFacing:true)
        let deadline=ProcessInfo.processInfo.systemUptime+10
        while shine()?.contents==nil,ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNotNil(shine()?.contents)
        effects?.setActive(false);XCTAssertNil(shine())
        effects?.setActive(true)
        effects?.present(frontFacing:false);XCTAssertNil(shine())
        effects?.present(frontFacing:true)
        effects?.cancel();XCTAssertNil(shine())
        effects?.present(frontFacing:true)
        weak var retiredLayer=shine(),retiredBand=shine()?.mask
        effects?.cleanup();effects?.cleanup();effects=nil
        XCTAssertNil(weakEffects)
        CATransaction.flush()
        let releaseDeadline=ProcessInfo.processInfo.systemUptime+2
        while (retiredLayer != nil || retiredBand != nil),ProcessInfo.processInfo.systemUptime<releaseDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(retiredLayer);XCTAssertNil(retiredBand);XCTAssertNil(shine())
    }
    func testRepeatedRealPreparationDisposalReleasesOwnerLayersAndPixels()async throws {
        let (window,front,prior)=try mount();defer{window.isHidden=true;window.rootViewController=nil;prior?.makeKeyAndVisible()}
        for _ in 0..<8 {
            var shine:NativeCardIdleShine?=NativeCardIdleShine(front:front,reducedMotion:{false})
            weak var owner=shine;weak var layer=shine?.layer;weak var band=shine?.band
            shine?.setVisible(true)
            let deadline=ProcessInfo.processInfo.systemUptime+5
            while shine?.decodedBytes==0,ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(10))}
            XCTAssertGreaterThan(shine?.decodedBytes ?? 0,0)
            shine?.setVisible(false);XCTAssertEqual(shine?.decodedBytes,0)
            shine?.setVisible(true);shine?.dispose();shine=nil
            // Retired worker may drain its one immutable image; callback is weak.
            CATransaction.flush()
            let releaseDeadline=ProcessInfo.processInfo.systemUptime+2
            while (layer != nil || band != nil),ProcessInfo.processInfo.systemUptime<releaseDeadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertNil(owner);XCTAssertNil(layer);XCTAssertNil(band)
        }
        XCTAssertFalse(front.layer.sublayers?.contains{$0.name=="modal.card.idle-shine"} ?? false)
    }
}
