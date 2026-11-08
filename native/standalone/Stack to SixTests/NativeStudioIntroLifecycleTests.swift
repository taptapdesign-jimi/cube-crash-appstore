import XCTest
import UIKit
import QuartzCore
import ImageIO
@testable import Stack_to_Six

@MainActor final class NativeStudioIntroLifecycleTests:XCTestCase {
    private func intro(gate:((@escaping ()->Void)->Void)?=nil)->NativeStudioIntroView {
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("lik-nogomet",1.1),decodedPublicationGate:gate)
        view.frame = .init(x:0,y:0,width:390,height:844);view.layoutIfNeeded();return view
    }
    private func wait(timeout:Double=20,_ condition:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(timeout)
        while !condition(){guard Date()<deadline else{XCTFail("Authored intro preparation or rendered presentation did not complete");throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
    }
    private func mount()->(UIViewController,UIWindow,UIWindow?) {
        let prior=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        return(controller,window,prior)
    }
    /// Read the render-tree contents, never the model image or a readiness counter.
    private func presentationPixels(_ view:NativeStudioIntroView)->Data? {
        guard let carrier=view.animatedCharacterLayer.superlayer?.presentation(),carrier.opacity>0.9,
              let contents=view.animatedCharacterLayer.presentation()?.contents,
              CFGetTypeID(contents as CFTypeRef)==CGImage.typeID,
              let context=CGContext(data:nil,width:32,height:32,bitsPerComponent:8,bytesPerRow:128,
                  space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue),
              let bytes=context.data else{return nil}
        let image=contents as! CGImage
        context.draw(image,in:CGRect(x:0,y:0,width:32,height:32))
        return Data(bytes:bytes,count:4096)
    }
    private func originalDurations(_ character:NativeStudioIntroView.Character)throws->[Double] {
        let url=NativeTestResources.root.appendingPathComponent(character.motionAssetPath)
        let source=try XCTUnwrap(CGImageSourceCreateWithURL(url as CFURL,nil))
        return try (0..<CGImageSourceGetCount(source)).map {index in
            let properties=try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(source,index,nil) as? [CFString:Any])
            let webp=try XCTUnwrap(properties[kCGImagePropertyWebPDictionary] as? [CFString:Any])
            return try XCTUnwrap((webp[kCGImagePropertyWebPUnclampedDelayTime] ?? webp[kCGImagePropertyWebPDelayTime]) as? NSNumber).doubleValue
        }
    }
    private func assertReleased(_ view:NativeStudioIntroView,file:StaticString=#filePath,line:UInt=#line) {
        XCTAssertEqual(view.preparedFrameCount,0,file:file,line:line)
        XCTAssertEqual(view.preparedDecodedBytes,0,file:file,line:line)
        XCTAssertTrue(view.preparedFrameDurations.isEmpty,file:file,line:line)
        XCTAssertNil(view.animatedCharacterLayer.animation(forKey:NativeStudioIntroView.frameAnimationKey),file:file,line:line)
        XCTAssertNil(view.animatedCharacterLayer.contents,file:file,line:line)
        XCTAssertNil(view.displayedFallbackImage,file:file,line:line)
        XCTAssertTrue(view.terminalCompositionHidden,file:file,line:line)
        for glyph in view.presentsGlyphs {
            XCTAssertNil(glyph.layer.animation(forKey:"native-studio-presents"),file:file,line:line)
            XCTAssertEqual(glyph.layer.opacity,0,file:file,line:line)
        }
    }
    func testLogoBounceEntryUsesSharedHomeRecipeThenOriginalExit() {
        XCTAssertEqual(NativeStudioIntroView.duration,4.33,accuracy:0.000001)
        XCTAssertGreaterThan(NativeStudioIntroView.logoMotionSpeed,0.70)
        XCTAssertEqual(NativeStudioIntroView.characterExitTime+0.65-(NativeStudioIntroView.logoStartDelay+NativeStudioIntroView.logoDuration),0.08,accuracy:0.000001)
        XCTAssertLessThan(NativeStudioIntroView.characterExitTime+0.65,NativeStudioIntroView.duration)
        let track=JimiV9Motion.homeEnter(.logo)
        XCTAssertEqual(NativeStudioIntroView.logoEntryDuration,track.duration)
        for index in 0...100 {
            let time=track.duration*Double(index)/100
            XCTAssertEqual(NativeStudioIntroView.scale(at:time,character:false),track.pose(at:time).scaleX,accuracy:0.000001)
        }
        XCTAssertGreaterThan((0...100).map{NativeStudioIntroView.scale(at:Double($0)/100*track.duration,character:false)}.max() ?? 0,1.05)
        XCTAssertEqual(NativeStudioIntroView.scale(at:1,character:false),1)
        XCTAssertEqual(NativeStudioIntroView.scale(at:NativeStudioIntroView.logoExitStart,character:false),1)
        XCTAssertEqual(NativeStudioIntroView.scale(at:NativeStudioIntroView.duration,character:false),0,accuracy:0.000001)
        for index in 0...100 {
            let scale=NativeStudioIntroView.scale(at:Double(index)/100*0.16,character:false,reducedMotion:true)
            XCTAssertGreaterThanOrEqual(scale,0);XCTAssertLessThanOrEqual(scale,1)
        }
    }
    func testPresentsExitsPerLetterAndPlaqueFinishesBeforeCharacter() {
        let start=NativeStudioIntroView.characterExitTime
        XCTAssertEqual(NativeStudioIntroView.presentsPose(at:start+0.31,index:0).alpha,0,accuracy:0.000001)
        XCTAssertGreaterThan(NativeStudioIntroView.presentsPose(at:start+0.31,index:7).alpha,0.9)
        for i in 0..<8 {XCTAssertEqual(NativeStudioIntroView.presentsPose(at:start+0.66,index:i).alpha,0,accuracy:0.000001)}
        XCTAssertEqual(NativeStudioIntroView.scale(at:NativeStudioIntroView.logoDuration,character:false),0,accuracy:0.000001)
        XCTAssertGreaterThan(NativeStudioIntroView.scale(at:NativeStudioIntroView.logoDuration,character:true),0)
        for source in [0.24,0.52,0.84,0.95,2.5,2.96,3.2,3.56,3.8,4.0] {
            let time=NativeStudioIntroView.logoTime(forSource:source)
            XCTAssertEqual(NativeStudioIntroView.logoSourceTime(at:time),source,accuracy:0.000001)
            if source<=3.56 {
                let old=(source-NativeStudioIntroView.logoSourceLead)/NativeStudioIntroView.logoMotionSpeed+(source>2.96 ? NativeStudioIntroView.logoExtraHold:0)
                XCTAssertEqual(time,old,accuracy:0.000001)
            }
        }
    }
    func testDropLogoKeepsFiniteShimmerAndParentPauseAndCleanup()async throws {
        let(controller,window,prior)=mount(),view=intro()
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.start{};try await wait{view.timelineStarted}
        let unit=try XCTUnwrap(view.subviews.first)
        let drop=try XCTUnwrap(unit.subviews.first{$0.accessibilityIdentifier=="native.studio-intro.drop-logo"})
        func layers(_ root:CALayer)->[CALayer] {
            [root]+(root.sublayers ?? []).flatMap(layers)+(root.mask.map{layers($0)} ?? [])
        }
        let owned=layers(drop.layer)
        let animations=owned.flatMap{layer in (layer.animationKeys() ?? []).compactMap{layer.animation(forKey:$0)}}
        XCTAssertEqual(animations.filter{abs($0.duration-NativeStudioIntroView.logoDuration)<0.000001}.count,21)
        XCTAssertTrue(owned.contains{$0.animation(forKey:"native-studio-drop-shimmer") != nil})
        XCTAssertTrue(animations.allSatisfy{$0.repeatCount==0})
        let caption=try XCTUnwrap(unit.subviews.first{$0.accessibilityLabel=="PRESENTS"})
        XCTAssertNotNil(caption.layer.animation(forKey:"native-studio-presents-follow"))

        XCTAssertTrue(unit.subviews.compactMap{$0 as? UIImageView}.allSatisfy{$0.isHidden})
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(unit.layer.speed,0)
        let parked=unit.layer.timeOffset
        try await Task.sleep(for:.milliseconds(120))
        XCTAssertEqual(unit.layer.timeOffset,parked)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(unit.layer.speed,1)
        view.dispose();view.dispose()
        XCTAssertTrue(owned.allSatisfy{($0.animationKeys() ?? []).isEmpty})
        XCTAssertNil(drop.superview)
    }
    func testReducedMotionOmitsOnlyTheNewLogoFloat()async throws {
        let(controller,window,prior)=mount()
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:.init("lik-nogomet",1.1),reducedMotion:true)
        view.frame=window.bounds;controller.view.addSubview(view);view.layoutIfNeeded()
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.start{};try await wait{view.timelineStarted}
        let unit=try XCTUnwrap(view.subviews.first)
        XCTAssertNotNil(unit.layer.animation(forKey:"native-studio-intro"))
        for image in unit.subviews.compactMap({$0 as? UIImageView}){XCTAssertNil(image.layer.animation(forKey:NativeStudioIntroView.logoIdleKey))}
    }

    func testPresentsUsesArcadeLetterEntryStretchedByExactlyOneSecond()async throws {
        XCTAssertEqual(NativeStudioIntroView.presentsEntryDuration,1.58,accuracy:0.000001)
        XCTAssertEqual(NativeStudioIntroView.presentsEntryStart,NativeStudioIntroView.logoTime(forSource:0.95),accuracy:0.000001)
        let stretch=(1.58-7*0.12)/0.44
        for index in 0..<8 {for local in [-0.1,0,0.12,0.24,0.34,0.44,0.7] {
            let actual=NativeStudioIntroView.presentsPose(at:NativeStudioIntroView.presentsEntryStart+Double(index)*0.12+local*stretch,index:index)
            let reference=NativeArcadeRoundPresentation.entry(local,overshoot:1.32,dip:0.90)
            XCTAssertEqual(actual.scale,reference.scale,accuracy:0.000001)
            XCTAssertEqual(actual.alpha,reference.alpha,accuracy:0.000001)
            XCTAssertEqual(actual.rotationX,reference.rotationX,accuracy:0.000001)
            XCTAssertEqual(actual.z,reference.z,accuracy:0.000001)
        }}
        let(controller,window,prior)=mount(),view=intro()
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        XCTAssertEqual(view.presentsGlyphs.compactMap(\.text).joined(),"PRESENTS")
        XCTAssertTrue(view.presentsGlyphs.allSatisfy{$0.layer.opacity==0})
        view.start{}
        try await wait{view.timelineStarted}
        XCTAssertTrue(view.presentsGlyphs.allSatisfy{$0.layer.animation(forKey:"native-studio-presents") != nil})
        try await Task.sleep(for:.milliseconds(500))
        XCTAssertTrue(view.presentsGlyphs.allSatisfy{($0.layer.presentation()?.opacity ?? 0)==0},"Anticipation remains blank after the logo settles")
        try await Task.sleep(for:.milliseconds(650))
        let first=try XCTUnwrap(view.presentsGlyphs.first?.layer.presentation())
        let last=try XCTUnwrap(view.presentsGlyphs.last?.layer.presentation())
        XCTAssertGreaterThan(first.opacity,last.opacity,"Real mounted letters must reveal in order")
        view.dispose();view.dispose();assertReleased(view)
    }
    func testCompleteDecodedLoopStartsOnceAndTerminalModelCannotFlashAfterHandoff()async throws {
        let(controller,window,prior)=mount(),view=intro();var cues=0,handoffs=0
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.onCharacterCue={_ in cues+=1}
        view.start{handoffs+=1;XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)}
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(cues,0)
        XCTAssertTrue(view.subviews.allSatisfy{$0.layer.opacity==0})
        try await wait{view.timelineStarted}
        XCTAssertEqual(view.selectedMotionSource,"animated-webp-predecoded");XCTAssertEqual(cues,1)
        XCTAssertEqual(view.preparedFrameCount,try originalDurations(view.character).count)
        let unit=try XCTUnwrap(view.subviews.first)
        XCTAssertEqual(unit.layer.transform.m11,0)
        let sheen=try XCTUnwrap(unit.subviews.compactMap{$0 as? UIImageView}.first{$0.layer.mask != nil})
        let rows=try XCTUnwrap(sheen.layer.mask?.sublayers)
        XCTAssertEqual(rows.count,2)
        XCTAssertTrue(rows.allSatisfy{$0.masksToBounds})
        XCTAssertEqual(rows[0].frame.maxY,rows[1].frame.minY,accuracy:0.001)
        let bands=try rows.map{try XCTUnwrap($0.sublayers?.first)}
        if let drop=unit.subviews.first(where:{$0.accessibilityIdentifier=="native.studio-intro.drop-logo"}) {
            func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap(descendants)}
            let sequence=try XCTUnwrap(descendants(drop.layer).compactMap{$0.animation(forKey:"native-studio-drop-shimmer") as? CAAnimationGroup}.first)
            let passes=try XCTUnwrap(sequence.animations)
            XCTAssertEqual(passes.count,2)
            XCTAssertEqual(passes[0].duration,1.05);XCTAssertEqual(passes[1].duration,1.05)
            XCTAssertEqual(passes[1].beginTime-passes[0].beginTime,1.15,accuracy:0.01)
            XCTAssertTrue(bands.allSatisfy{$0.animation(forKey:"native-studio-sheen")==nil},"Hidden fallback sheen has no animation owner")
        } else {
            let passes=try bands.map{try XCTUnwrap($0.animation(forKey:"native-studio-sheen") as? CAAnimationGroup)}
            XCTAssertEqual(passes[0].duration,1.05);XCTAssertEqual(passes[1].duration,1.05)
            XCTAssertEqual(passes[1].beginTime-passes[0].beginTime,1.15,accuracy:0.01)
        }
        func capture(_ name:String)throws {
            let image=UIGraphicsImageRenderer(bounds:view.bounds).image{_ in
                XCTAssertTrue(view.drawHierarchy(in:view.bounds,afterScreenUpdates:true))
            }
            try XCTUnwrap(image.pngData()).write(to:URL(fileURLWithPath:"/tmp/"+name+".png"))
        }
        try await Task.sleep(for:.milliseconds(1150))
        if !unit.subviews.contains(where:{$0.accessibilityIdentifier=="native.studio-intro.drop-logo"}) {
            XCTAssertGreaterThan(try XCTUnwrap(bands[0].presentation()).opacity,0.9)
            XCTAssertLessThan(try XCTUnwrap(bands[1].presentation()).opacity,0.01)
        }
        try capture("native-studio-sheen-tap-tap")
        try await Task.sleep(for:.milliseconds(1150))
        if !unit.subviews.contains(where:{$0.accessibilityIdentifier=="native.studio-intro.drop-logo"}) {
            XCTAssertLessThan(try XCTUnwrap(bands[0].presentation()).opacity,0.01)
            XCTAssertGreaterThan(try XCTUnwrap(bands[1].presentation()).opacity,0.9)
        }
        try capture("native-studio-sheen-design")
        view.start{XCTFail("Repeated start cannot replace the original handoff")}
        view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(handoffs,1);XCTAssertTrue(view.isRetired);assertReleased(view)
        XCTAssertTrue(bands.allSatisfy{($0.animationKeys() ?? []).isEmpty})
        view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(cues,1);XCTAssertEqual(handoffs,1)
    }
    private func assertCenteredCharacterExit(_ view:NativeStudioIntroView)throws {
        let layer=try XCTUnwrap(view.animatedCharacterLayer.superlayer)
        let group=try XCTUnwrap(layer.animation(forKey:"native-studio-intro") as? CAAnimationGroup)
        let track=try XCTUnwrap(group.animations?.first as? CAKeyframeAnimation)
        let values=try XCTUnwrap(track.values as? [NSValue])
        let rest=view.character.scale,anchor=layer.anchorPoint,bounds=layer.bounds
        let localCenter=CGPoint(x:(0.5-anchor.x)*bounds.width,y:(0.5-anchor.y)*bounds.height)
        let restingCenter=CGPoint(x:layer.position.x+localCenter.x*rest,y:layer.position.y+localCenter.y*rest)
        var sawOvershoot=false,sawCollapse=false
        for (index,value) in values.enumerated() {
            let seconds=group.duration*Double(index)/Double(values.count-1),t=value.caTransform3DValue
            XCTAssertEqual(t.m11,NativeStudioIntroView.scale(at:seconds,character:true,rest:Double(rest)),accuracy:0.000001,view.character.key)
            XCTAssertEqual(t.m11,t.m22,accuracy:0.000001)
            if seconds<NativeStudioIntroView.characterExitTime {
                XCTAssertEqual(t.m41,0);XCTAssertEqual(t.m42,0,"Original entry and idle stay unchanged")
            } else {
                let center=CGPoint(x:layer.position.x+localCenter.x*t.m11+t.m41,y:layer.position.y+localCenter.y*t.m22+t.m42)
                XCTAssertEqual(center.x,restingCenter.x,accuracy:0.0001,view.character.key)
                XCTAssertEqual(center.y,restingCenter.y,accuracy:0.0001,view.character.key)
                sawOvershoot = sawOvershoot || t.m11>rest
                sawCollapse = sawCollapse || t.m11<rest*0.01
            }
        }
        XCTAssertTrue(sawOvershoot);XCTAssertTrue(sawCollapse)
    }
    func testAllMountedProductionSelectionsUsePreparedPixelsOriginalTimingAndBoundedMemory()async throws {
        XCTAssertEqual(NativeStudioIntroView.characters.count,10)
        let(controller,window,prior)=mount()
        defer{window.isHidden=true;prior?.makeKeyAndVisible()}
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for character in NativeStudioIntroView.characters {
                // Exact production initializer used by NativeAppController.
                let view=NativeStudioIntroView(root:NativeTestResources.root,character:character)
                view.frame=CGRect(origin:.zero,size:size);controller.view.addSubview(view);view.layoutIfNeeded()
                var cues=0;view.onCharacterCue={_ in cues+=1};view.start{}
                defer{view.dispose()}
                try await wait{view.timelineStarted}
                try assertCenteredCharacterExit(view)
                let durations=try originalDurations(character)
                XCTAssertEqual(view.preparedFrameCount,durations.count,character.key)
                XCTAssertEqual(view.preparedFrameDurations,durations,character.key)
                XCTAssertEqual(view.selectedMotionSource,"animated-webp-predecoded",character.key);XCTAssertEqual(cues,1)
                let animation=try XCTUnwrap(view.animatedCharacterLayer.animation(forKey:NativeStudioIntroView.frameAnimationKey) as? CAKeyframeAnimation)
                XCTAssertEqual(animation.calculationMode,.discrete)
                let total=durations.reduce(0,+)
                XCTAssertEqual(animation.duration,total,accuracy:0.000001)
                let images=try XCTUnwrap(animation.values as? [CGImage])
                XCTAssertEqual(images.count,durations.count+1)
                XCTAssertEqual(animation.keyTimes?.count,images.count)
                var elapsed=0.0
                for (index,delay) in durations.enumerated(){
                    XCTAssertEqual(try XCTUnwrap(animation.keyTimes?[index]).doubleValue,elapsed/total,accuracy:0.000001)
                    elapsed+=delay
                    XCTAssertEqual(images[index].bitsPerPixel,32)
                    XCTAssertNotNil(images[index].dataProvider?.data,"Prepared bitmap pixels must be materialized")
                }
                XCTAssertEqual(animation.keyTimes?.last,1)
                let decodedBytes=images.prefix(durations.count).reduce(0){$0+$1.bytesPerRow*$1.height}
                XCTAssertEqual(view.preparedDecodedBytes,decodedBytes)
                XCTAssertGreaterThan(decodedBytes,0)
                XCTAssertLessThanOrEqual(decodedBytes,NativeStudioIntroView.preparedMemoryBudgetBytes)
                try await wait(timeout:2){self.presentationPixels(view) != nil}
                let first=try XCTUnwrap(presentationPixels(view),character.key)
                try await wait(timeout:2){self.presentationPixels(view).map{$0 != first} ?? false}
                print("[NativeStudioIntroProof] character=\(character.key) prepared=\(durations.count) bytes=\(decodedBytes) duration=\(total) preparation=\(view.preparationDuration) renderedPixelsChanged=true")
                view.dispose();assertReleased(view)
            }
        }
    }
    func testRenderedLeashExitKeepsRestingCenter()throws {
        let(controller,window,prior)=mount()
        defer{window.isHidden=true;prior?.makeKeyAndVisible()}
        let character=try XCTUnwrap(NativeStudioIntroView.characters.first{$0.key == "lik-pas-SVG"})
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:character)
        view.frame=controller.view.bounds;controller.view.addSubview(view);view.layoutIfNeeded()
        defer{view.dispose()}
        let done=expectation(description:"Rendered center through leash exit")
        view.start{}
        DispatchQueue.main.asyncAfter(deadline:.now()+1.5) {
            do {
                XCTAssertTrue(view.timelineStarted)
                let carrier=try XCTUnwrap(view.animatedCharacterLayer.superlayer)
                let group=try XCTUnwrap(carrier.animation(forKey:"native-studio-intro")?.copy() as? CAAnimationGroup)
                let center=CGPoint(x:carrier.position.x,y:carrier.position.y+carrier.bounds.height*character.scale/2)
                // Scrub the attached CA track with an explicit nonzero epoch.
                carrier.speed=0;carrier.beginTime=0;group.beginTime=0.000001
                carrier.add(group,forKey:"native-studio-intro")
                self.captureLeashExit(view,carrier:carrier,center:center,index:0,done:done)
            } catch {XCTFail("\(error)");done.fulfill()}
        }
        wait(for:[done],timeout:20)
    }
    private func captureLeashExit(_ view:NativeStudioIntroView,carrier:CALayer,center:CGPoint,index:Int,done:XCTestExpectation) {
        let names=["rest","inflate","collapse"],offsets=[0.0,0.25,0.54]
        carrier.timeOffset=NativeStudioIntroView.characterExitTime+offsets[index]+0.000001
        CATransaction.flush()
        DispatchQueue.main.asyncAfter(deadline:.now()+0.1) {
            do {
                let rendered=try XCTUnwrap(carrier.presentation()),t=rendered.transform
                let painted=CGPoint(x:rendered.position.x+(0.5-rendered.anchorPoint.x)*rendered.bounds.width*t.m11+t.m41,
                                    y:rendered.position.y+(0.5-rendered.anchorPoint.y)*rendered.bounds.height*t.m22+t.m42)
                XCTAssertEqual(painted.x,center.x,accuracy:0.1,names[index])
                XCTAssertEqual(painted.y,center.y,accuracy:0.1,names[index])
                let image=UIGraphicsImageRenderer(bounds:view.bounds).image{_ in
                    XCTAssertTrue(view.drawHierarchy(in:view.bounds,afterScreenUpdates:true))
                }
                let url=URL(fileURLWithPath:"/tmp/native-intro-center-20261108/leash-"+names[index]+".png")
                try XCTUnwrap(image.pngData()).write(to:url)
                if index<2 {self.captureLeashExit(view,carrier:carrier,center:center,index:index+1,done:done)}else{done.fulfill()}
            } catch {XCTFail("\(error)");done.fulfill()}
        }
    }
    private func exerciseStudioLeashReplacement(_ mounted:(NativeStudioIntroView)->Void)async throws {
        let character=try XCTUnwrap(NativeStudioIntroView.characters.first{$0.key == "lik-pas-SVG"})
        XCTAssertEqual(character.motionAssetPath,"assets/logo addons/native/lik-lajna-v1.webp")
        let(controller,window,prior)=mount()
        defer{window.isHidden=true;prior?.makeKeyAndVisible()}
        let view=NativeStudioIntroView(root:NativeTestResources.root,character:character)
        mounted(view)
        defer{view.dispose()}
        var cues:[String]=[],handoffs=0
        do {
            view.frame=controller.view.bounds;controller.view.addSubview(view);view.layoutIfNeeded()
            XCTAssertEqual(view.displayedFallbackImage?.size,CGSize(width:369,height:510))
            view.onCharacterCue={cues.append($0)};view.start{handoffs+=1}
            try await wait{view.timelineStarted}
            XCTAssertEqual(view.preparedFrameCount,62)
            XCTAssertEqual(view.preparedFramePixelSize,CGSize(width:369,height:510))
            XCTAssertEqual(view.preparedDecodedBytes,369*510*4*62)
            XCTAssertEqual(view.preparedFrameDurations.reduce(0,+),2.667,accuracy:0.000001)
            XCTAssertEqual(cues,["lik-pas-SVG"])
            try await wait(timeout:2){self.presentationPixels(view) != nil}
            let first=try XCTUnwrap(presentationPixels(view))
            try await wait(timeout:2){self.presentationPixels(view).map{$0 != first} ?? false}
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            try await Task.sleep(for:.milliseconds(70))
            let paused=try XCTUnwrap(presentationPixels(view))
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertEqual(presentationPixels(view),paused)
            let image=UIGraphicsImageRenderer(bounds:view.bounds).image{_ in
                XCTAssertTrue(view.drawHierarchy(in:view.bounds,afterScreenUpdates:true))
            }
            let captureURL=URL(fileURLWithPath:"/tmp/native-leash-v1/mounted.png")
            try FileManager.default.createDirectory(at:captureURL.deletingLastPathComponent(),withIntermediateDirectories:true)
            try XCTUnwrap(image.pngData()).write(to:captureURL)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            try await wait(timeout:2){self.presentationPixels(view).map{$0 != paused} ?? false}
            try await wait(timeout:7){handoffs==1}
            XCTAssertEqual(cues,["lik-pas-SVG"]);assertReleased(view)
            view.dispose();view.dispose();assertReleased(view)
        }
    }
    func testStudioLeashReplacementKeepsNativeResolutionTimingPauseAndReleasesAtHandoff()async throws {
        weak var released:NativeStudioIntroView?
        // Return from the async playback scope before measuring object lifetime;
        // the compiler can retain a do-block local across suspension points.
        try await exerciseStudioLeashReplacement{released=$0}
        try await wait(timeout:2){released == nil}
    }
    func testDisposalBeforePreparedLoopPublicationRejectsPixelsCueAndHomeHandoff()async throws {
        var publications:[()->Void]=[],cues=0
        let view=intro(gate:{publications.append($0)})
        view.onCharacterCue={_ in cues+=1};view.start{XCTFail("Disposed intro cannot reveal Home")}
        try await wait{publications.count==1};view.dispose();publications.removeFirst()()
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(cues,0);assertReleased(view)
    }
    func testBackgroundDuringPreparationRejectsStaleLoopAndPublishesOnlyResumedOwner()async throws {
        var publications:[()->Void]=[],cues=0
        let view=intro(gate:{publications.append($0)});defer{view.dispose()}
        view.onCharacterCue={_ in cues+=1};view.start{}
        try await wait{publications.count==1}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait{publications.count==2}
        publications.removeFirst()()
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(view.preparedFrameCount,0);XCTAssertEqual(cues,0)
        publications.removeFirst()()
        XCTAssertTrue(view.timelineStarted);XCTAssertGreaterThan(view.preparedFrameCount,1);XCTAssertEqual(cues,1)
        try await Task.sleep(for:.milliseconds(100));XCTAssertTrue(publications.isEmpty,"Playback must not schedule further decoding publications")
    }
    func testBackgroundPausesMountedFramePhaseAndResumeKeepsPreparedLoopAndOneCue()async throws {
        let(controller,window,prior)=mount(),view=intro();var cues=0,handoffs=0
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.onCharacterCue={_ in cues+=1};view.start{handoffs+=1}
        try await wait{view.timelineStarted}
        try await wait(timeout:2){self.presentationPixels(view) != nil}
        let layer=view.animatedCharacterLayer,count=view.preparedFrameCount,bytes=view.preparedDecodedBytes
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let paused=layer.convertTime(CACurrentMediaTime(),from:nil)
        try await Task.sleep(for:.milliseconds(70))
        let pixels=try XCTUnwrap(presentationPixels(view))
        try await Task.sleep(for:.milliseconds(200))
        XCTAssertEqual(layer.convertTime(CACurrentMediaTime(),from:nil),paused,accuracy:0.0001)
        XCTAssertEqual(presentationPixels(view),pixels)
        XCTAssertEqual(handoffs,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(layer.convertTime(CACurrentMediaTime(),from:nil),paused,accuracy:0.03)
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertGreaterThan(layer.convertTime(CACurrentMediaTime(),from:nil),paused+0.1)
        XCTAssertEqual(view.preparedFrameCount,count);XCTAssertEqual(view.preparedDecodedBytes,bytes);XCTAssertEqual(cues,1)
        try await wait(timeout:2){self.presentationPixels(view).map{$0 != pixels} ?? false}
    }
    func testMalformedTruncatedAndCompositedSourcesUseFiniteStaticFallbackAndNaturalHandoff()async throws {
        let relative="assets/logo addons/optimized/lik-nogomet-mobile.webp"
        let original=try Data(contentsOf:NativeTestResources.root.appendingPathComponent(relative))
        var composited=original,offset=12,foundFrame=false
        // Walk RIFF chunks to alter only the first authentic frame's blending flag.
        while offset+8<=composited.count {
            let length=(0..<4).reduce(0){$0 | Int(composited[offset+4+$1]) << (8*$1)}
            guard length<=composited.count-offset-8 else{break}
            if composited.subdata(in:offset..<offset+4)==Data("ANMF".utf8),length>=16 {
                composited[offset+8+15] &= 0xfd;foundFrame=true;break
            }
            offset+=8+length+(length & 1)
        }
        XCTAssertTrue(foundFrame)
        let cases:[(String,Data)]=[("malformed",Data("invalid WebP".utf8)),
            ("truncated",Data(original.prefix(80))),("unsupported-compositing",composited)]
        let(controller,window,prior)=mount()
        defer{window.isHidden=true;prior?.makeKeyAndVisible()}
        for (name,bytes) in cases {
            let root=FileManager.default.temporaryDirectory.appendingPathComponent("native-intro-invalid-\(UUID().uuidString)",isDirectory:true)
            try FileManager.default.createDirectory(at:root.appendingPathComponent("assets/logo addons/optimized"),withIntermediateDirectories:true)
            defer{try? FileManager.default.removeItem(at:root)}
            for path in ["assets/logo addons/taplogo.png","assets/logo addons/lik-nogomet.png"] {
                try FileManager.default.copyItem(at:NativeTestResources.root.appendingPathComponent(path),to:root.appendingPathComponent(path))
            }
            try bytes.write(to:root.appendingPathComponent(relative))
            let view=NativeStudioIntroView(root:root,character:.init("lik-nogomet",1.1))
            view.frame=controller.view.bounds;controller.view.addSubview(view);view.layoutIfNeeded()
            defer{view.dispose()}
            var cues=0,handoffs=0
            view.onCharacterCue={_ in cues+=1}
            view.start{handoffs+=1;XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)}
            try await wait{view.timelineStarted}
            XCTAssertEqual(view.selectedMotionSource,"static-fallback-unavailable",name)
            XCTAssertEqual(view.preparedFrameCount,0,name);XCTAssertEqual(view.preparedDecodedBytes,0,name)
            XCTAssertNil(view.animatedCharacterLayer.animation(forKey:NativeStudioIntroView.frameAnimationKey),name)
            XCTAssertEqual(cues,1,name);XCTAssertEqual(handoffs,0,name)
            try await wait(timeout:2){self.presentationPixels(view) != nil}
            try await wait(timeout:7){handoffs==1}
            XCTAssertEqual(cues,1,name);assertReleased(view)
            view.animationDidStop(CAAnimation(),finished:true);XCTAssertEqual(handoffs,1,name)
            print("[NativeStudioIntroFallbackProof] case=\(name) preparation=\(view.preparationDuration) naturalHandoff=1")
        }
    }
    func testAppSwitchAtOneSecondRecoversHomeEvenWhenSystemDropsIntroAnimations()async throws {
        let(controller,window,prior)=mount(),view=intro(),homepage=UIView();var handoffs=0,cues=0
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.onCharacterCue={_ in cues+=1}
        view.start{
            handoffs+=1;XCTAssertTrue(view.isRetired);XCTAssertNil(view.superview)
            homepage.frame=controller.view.bounds;controller.view.addSubview(homepage)
        }
        try await wait{view.timelineStarted}
        try await Task.sleep(for:.seconds(1))
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didEnterBackgroundNotification,object:nil)
        // Reproduce the system losing the finite compositor completion while
        // retaining the hidden model pose. No finished=true receipt follows.
        view.subviews.forEach{$0.layer.removeAllAnimations()}
        view.animationDidStop(CAAnimation(),finished:false)
        XCTAssertEqual(handoffs,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(handoffs,1);XCTAssertTrue(homepage.superview === controller.view)
        assertReleased(view)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        view.animationDidStop(CAAnimation(),finished:true)
        XCTAssertEqual(handoffs,1);XCTAssertEqual(cues,1)
    }
    func testAppSwitchBeforeDecodePublicationRetiresStartupAndRejectsLatePixels()async throws {
        var publications:[()->Void]=[],handoffs=0,cues=0
        let view=intro(gate:{publications.append($0)})
        view.onCharacterCue={_ in cues+=1};view.start{handoffs+=1}
        try await wait{publications.count==1}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didEnterBackgroundNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(handoffs,1);assertReleased(view)
        publications.removeFirst()()
        XCTAssertFalse(view.timelineStarted);XCTAssertEqual(cues,0);XCTAssertEqual(handoffs,1)
    }
    func testMountedPreparedMediaCompletesNaturalExitOnceBeforeHomepageEnters()async throws {
        let(controller,window,prior)=mount(),view=intro(),homepage=UIView();var handoffs=0
        controller.view.addSubview(view)
        defer{view.dispose();window.isHidden=true;prior?.makeKeyAndVisible()}
        view.start{
            handoffs+=1;XCTAssertTrue(view.terminalCompositionHidden);XCTAssertNil(view.superview)
            homepage.frame=controller.view.bounds;controller.view.addSubview(homepage)
        }
        try await wait{view.timelineStarted}
        try await wait(timeout:2){self.presentationPixels(view) != nil}
        XCTAssertEqual(handoffs,0);XCTAssertNil(homepage.superview)
        try await wait(timeout:7){handoffs==1}
        XCTAssertTrue(view.isRetired);assertReleased(view)
        XCTAssertTrue(homepage.superview === controller.view)
        try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(handoffs,1)
    }
}
