import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeJourneyRewardTests:XCTestCase {
    private final class Token:NativeMusicCancellation {var cancelled=false;func cancel(){cancelled=true}}
    private final class Clock:NativeMusicScheduler {
        struct Job {let token:Token,at:Double,callback:()->Void}
        var time=0.0,jobs:[Job]=[],history:[Job]=[]
        func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {let token=Token(),job=Job(token:token,at:time+seconds,callback:callback);jobs.append(job);history.append(job);return token}
        func advance(_ seconds:Double){let target=time+seconds;while let next=jobs.filter({!$0.token.cancelled && $0.at<=target}).min(by:{$0.at<$1.at}) {jobs.removeAll{$0.token===next.token};time=next.at;next.callback()};time=target}
        var activeCount:Int {jobs.filter{!$0.token.cancelled}.count}
    }
    private final class Resources:NativeRewardResources {
        var requested:[String]=[],reads:[String]=[],releases:[Int]=[]
        var completion:((Bool)->Void)?
        func image(_ path:String,owner:Int)->UIImage? {reads.append(path);return UIImage()}
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){requested=paths;self.completion=completion}
        func release(_ owner:Int){releases.append(owner)}
        func finish(){let callback=completion;completion=nil;callback?(true)}
    }
    private func screen(_ clock:Clock,_ resources:Resources,reduced:Bool=false)->NativeJourneyRewardController {
        let screen=NativeJourneyRewardController(root:URL(fileURLWithPath:"/unused"),board:11,score:1000,generation:77,resources:resources,scheduler:clock,reducedMotion:reduced,random:{0.37},now:{clock.time});screen.prepareFilteredFrames={images,_,completion in completion(images)};screen.loadViewIfNeeded();screen.view.frame=CGRect(x:0,y:0,width:390,height:844);screen.view.layoutIfNeeded();return screen
    }
    func testInterimAndUnlockedHaveNoFloorShadowAndUnlockedBurnHasNoSweep() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        let hero=controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"}!
        let pose=hero.layer.sublayers!.first{$0.name=="native.reward.card-pose"}!
        XCTAssertTrue(pose.superlayer === hero.layer)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        XCTAssertFalse(descendants(hero.layer).contains{$0.name=="native.reward.floor-shadow"},"Interim has no separate floor shadow")
        let burn=descendants(hero.layer).first{$0.name=="native.reward.unlocked-burn"}!
        XCTAssertTrue((burn.sublayers ?? []).isEmpty)
        let carrier=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image {context in
            UIColor(red:0.4,green:0.2,blue:0.1,alpha:1).setFill();context.fill(CGRect(x:0,y:0,width:1,height:2))
        }
        controller.prepareFilteredFrames={images,_,completion in
            var prepared=images;for path in images.keys where path.contains("colelctibles") {prepared[path+"#burn"]=carrier};completion(prepared)
        }
        resources.finish();controller.start();controller.activate();clock.advance(1.1)
        controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        XCTAssertEqual(controller.phase,"unlocked")
        XCTAssertFalse(descendants(hero.layer).contains{$0.name=="native.reward.floor-shadow"},"Unlocked card has no separate floor shadow")
        XCTAssertNotNil(burn.contents)
        let pulse=burn.animation(forKey:"reward.opacity.0.0") as? CAKeyframeAnimation
        XCTAssertNotNil(pulse);XCTAssertEqual(pulse?.duration ?? 0,0.5,accuracy:0.000001)
        XCTAssertEqual(pulse?.keyTimes,[0,0.56,1].map{NSNumber(value:$0)})
        XCTAssertEqual(pulse?.values as? [Int],[0,1,0])
        XCTAssertNil(burn.animation(forKey:"transform"))
        controller.dispose();XCTAssertTrue((burn.animationKeys() ?? []).isEmpty)
    }
    func testInterimSelectedArtworkHasFaceGlowAboveImageAndAlignedShimmerMask() async {
        final class ArtworkResources:NativeRewardResources {
            let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
            func image(_ path:String,owner:Int)->UIImage? {assets.image(path)}
            func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping(Bool)->Void) {completion(paths.allSatisfy{assets.image($0) != nil})}
            func release(_ owner:Int) {}
        }
        let clock=Clock(),resources=ArtworkResources(),ready=expectation(description:"real selected carriers")
        let controller=NativeJourneyRewardController(root:NativeTestResources.root,board:11,score:1000,generation:77,resources:resources,scheduler:clock,reducedMotion:false,random:{0.37},now:{clock.time})
        controller.prepareFilteredFrames={images,lease,completion in NativeRewardFilteredFrames.prepare(images,lease:lease) {frames in completion(frames);ready.fulfill()}}
        controller.loadViewIfNeeded();controller.view.frame=CGRect(x:0,y:0,width:390,height:844)
        await fulfillment(of:[ready],timeout:10)
        controller.view.setNeedsLayout();controller.view.layoutIfNeeded();controller.start();clock.advance(1.7)
        let hero=controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"}!
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let layers=descendants(hero.layer),burn=layers.first{$0.name=="native.reward.interim-burn"}!,light=layers.first{$0.name=="native.reward.interim-shimmer"}!
        let image=burn.superlayer!.sublayers!.first{$0 !== burn && $0 !== light}!
        XCTAssertNotNil(burn.contents);XCTAssertGreaterThan(burn.zPosition,image.zPosition);XCTAssertGreaterThan(light.zPosition,burn.zPosition)
        XCTAssertEqual(burn.bounds,image.bounds);XCTAssertEqual(burn.position,image.position)
        XCTAssertTrue(CATransform3DEqualToTransform(burn.transform,image.transform))
        let mask=light.mask!;XCTAssertEqual(mask.frame.width,light.bounds.width*1.2,accuracy:0.000001)
        XCTAssertEqual(mask.frame.height,light.bounds.height*1.2,accuracy:0.000001)
        XCTAssertEqual(mask.frame.midX,light.bounds.midX);XCTAssertEqual(mask.frame.midY,light.bounds.midY)
        let maskContents=try! XCTUnwrap(mask.contents)
        let selectedMask=try! XCTUnwrap(resources.image("assets/animations/sand/zguzvano9.png",owner:0)?.cgImage)
        XCTAssertTrue((maskContents as! CGImage) === selectedMask)
        XCTAssertEqual(light.contentsScale,max(1,controller.view.traitCollection.displayScale));XCTAssertEqual(mask.contentsScale,light.contentsScale)
        clock.advance(3);let pulse=burn.animation(forKey:"reward.opacity.0.0") as? CAKeyframeAnimation
        XCTAssertEqual(pulse?.duration,0.5);XCTAssertEqual(pulse?.keyTimes,[0,0.56,1].map{NSNumber(value:$0)})
        controller.setForeground(false);XCTAssertEqual(controller.view.layer.speed,0);XCTAssertEqual(clock.activeCount,0)
        controller.setForeground(true);XCTAssertEqual(controller.view.layer.speed,1)
        controller.dispose();XCTAssertNil(burn.animationKeys());XCTAssertNil(burn.contents);XCTAssertNil(light.mask);XCTAssertNil(light.sublayers?.first?.animationKeys());XCTAssertEqual(clock.activeCount,0)
    }
    func testIdleGlowWaits150MillisecondsAndResumesItsOwnedBounceAfterBackground() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();clock.advance(4.39)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let burn=descendants(controller.view.layer).first{$0.name=="native.reward.interim-burn"}!
        burn.removeAllAnimations();clock.advance(0.11)
        XCTAssertNil(burn.animation(forKey:"reward.opacity.0.0"),"Sweep starts before the authored delayed face pulse")
        controller.setForeground(false);clock.advance(10)
        XCTAssertNil(burn.animation(forKey:"reward.opacity.0.0"));XCTAssertEqual(clock.activeCount,0)
        controller.setForeground(true);clock.advance(0.06)
        let pulse=burn.animation(forKey:"reward.opacity.0.0") as? CAKeyframeAnimation
        XCTAssertEqual(pulse?.duration,0.5)
        let bounce=burn.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation
        XCTAssertEqual(bounce?.duration,0.32)
        let transforms=(bounce?.values as? [NSValue])!.map{$0.caTransform3DValue}
        XCTAssertEqual(transforms.first!.m11,1.2,accuracy:0.000001);XCTAssertEqual(transforms.last!.m11,1.2,accuracy:0.000001)
        XCTAssertGreaterThan(transforms.map{$0.m11}.max()!,1.2*1.055,"Authored back.out(2) retains its overshoot")
        controller.dispose();XCTAssertEqual(clock.activeCount,0);XCTAssertNil(burn.animationKeys())
    }
    func testDisplaySizedShimmerUsesSoftTransparentEdgesAndRetiredPreparationCannotPublish() async {
        let retired=NativeRewardPreparationLease();retired.cancel()
        NativeRewardFilteredFrames.prepareShimmer(size:CGSize(width:80,height:120),displayScale:3,lease:retired) {_ in XCTFail("Retired reward may not publish a texture")}
        for scale in [CGFloat(1),CGFloat(3)] {
            let ready=expectation(description:"display-sized softened sweep")
            NativeRewardFilteredFrames.prepareShimmer(size:CGSize(width:80,height:120),displayScale:scale,lease:NativeRewardPreparationLease()) {output in
                guard let image=output else{XCTFail("Sweep preparation failed");ready.fulfill();return}
                XCTAssertEqual(image.width,Int(80*scale));XCTAssertEqual(image.height,Int(120*scale))
                var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
                bytes.withUnsafeMutableBytes {storage in
                    let bitmap=CGContext(data:storage.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                    bitmap.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
                }
                func alpha(_ x:Int,_ y:Int)->UInt8 {bytes[(y*image.width+x)*4+3]}
                let middle=alpha(image.width/2,image.height/2)
                XCTAssertGreaterThan(middle,125);XCTAssertLessThanOrEqual(middle,134)
                XCTAssertLessThan(alpha(image.width/2,0),middle,"CSS blur softens the horizontal crop boundary")
                XCTAssertLessThan(alpha(0,image.height/2),5)
                ready.fulfill()
            }
            await fulfillment(of:[ready],timeout:5)
        }
    }
    func testUnlockedRevealDoesNotRestartItsBurnBeforePeak() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();controller.activate();clock.advance(0.63)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let burn=descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"}!
        let first=burn.animation(forKey:"reward.opacity.0.0")!.beginTime
        clock.advance(0.2)
        XCTAssertEqual(controller.phase,"unlocked")
        XCTAssertEqual(burn.animation(forKey:"reward.opacity.0.0")!.beginTime,first)
        controller.dispose()
    }
    func testOffMainSelectedBurnCarrierChangesColorAndPreservesTransparentPixels() async {
        let bytes:[UInt8]=[102,51,26,255,0,0,0,0,102,51,26,255,0,0,0,0]
        let provider=CGDataProvider(data:Data(bytes) as CFData)!
        let source=CGImage(width:2,height:2,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:8,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedLast.rawValue),provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent)!
        let image=UIImage(cgImage:source,scale:1,orientation:.up)
        let ready=expectation(description:"selected burn prepared")
        let path="./assets/colelctibles/Forest/common/1@2x.png"
        NativeRewardFilteredFrames.prepare([path:image],lease:NativeRewardPreparationLease()) {prepared in
            guard let output=prepared[path+"#burn"]?.cgImage,let input=image.cgImage else {XCTFail("Burn carrier missing");ready.fulfill();return}
            func pixels(_ cg:CGImage)->[UInt8] {
                var bytes=[UInt8](repeating:0,count:16)
                bytes.withUnsafeMutableBytes {storage in
                    let context=CGContext(data:storage.baseAddress,width:2,height:2,bitsPerComponent:8,bytesPerRow:8,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.interpolationQuality = .none;context.draw(cg,in:CGRect(x:0,y:0,width:2,height:2))
                };return bytes
            }
            let original=pixels(input),burn=pixels(output)
            XCTAssertGreaterThan(burn[0],original[0]);XCTAssertEqual(burn[3],original[3]);XCTAssertEqual(original[3],255);XCTAssertEqual(original[7],0);XCTAssertEqual(burn[7],original[7])
            ready.fulfill()
        }
        await fulfillment(of:[ready],timeout:3)
    }
    func testCanonicalTSOracleProfilesGesturesAndCopy() {
        for (draws,expected) in NativeRewardOracleFixtures.profiles {
            var index=0;let value=NativeRewardPresentation.Tilt(random:{defer{index += 1};return draws[index]})
            let actual=[value.interimZ,value.interimX,value.interimY,value.interimExitZ,value.interimExitX,value.interimExitY,value.entryZ,value.entryX,value.entryY,value.restZ,value.restX,value.restY,value.exitZ,value.exitX,value.exitY]
            XCTAssertEqual(actual.count,expected.count);for (a,b) in zip(actual,expected) {XCTAssertEqual(a,b,accuracy:0.0000001)};XCTAssertEqual(index,draws.count)
        }
        for (input,angle,collect) in NativeRewardOracleFixtures.inputs {
            XCTAssertEqual(NativeRewardPresentation.dragTilt(start:input[0],deltaX:input[1],width:input[2]),angle,accuracy:0.0000001)
            XCTAssertEqual(NativeRewardPresentation.collectDrag(deltaX:input[1],deltaY:input[3],cardHeight:input[4]),collect)
        }
        XCTAssertEqual(NativeRewardPresentation.names,NativeRewardOracleFixtures.names)
    }
    func testMixedRevealSmokeMatches576IndependentSourceParticlesAndRandomConsumption() {
        for (seed,width,height,expectedCalls,expected) in NativeRewardSmokeOracle.cases {
            var state=seed,calls=0
            let plan=NativeRewardSmokePlan(width:width,height:height,random:{calls += 1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296})
            XCTAssertEqual(calls,expectedCalls);XCTAssertEqual(plan.particles.count,expected.count)
            for (actual,reference) in zip(plan.particles,expected) {for (a,b) in zip(actual.oracleValues,reference) {XCTAssertEqual(a,b,accuracy:0.0000001)}}
        }
    }
    func testComponentExitRetainsAuthoredAnglesAtZeroScaleAndCorrectCSSRotationOrder() {
        let start=NativeRewardMotion.pose(scaleX:1.3806,scaleY:1.3455,y:40,z:3,x:-2,ry:2.5)
        let end=NativeRewardMotion.pose(scale:0,y:40,z:6,x:-7,ry:6,depth:-188)
        let middle=start.interpolated(to:end,progress:0.5)
        XCTAssertEqual(middle.scaleX,0.6903,accuracy:0.000001)
        XCTAssertEqual(middle.rotationZ,4.5);XCTAssertEqual(middle.rotationX,-4.5);XCTAssertEqual(middle.rotationY,4.25);XCTAssertEqual(middle.depth,-94)
        // The endpoint still owns angular/depth data when its final matrix
        // has zero visible scale; matrix interpolation cannot recover these.
        XCTAssertEqual(end.rotationX,-7);XCTAssertEqual(end.rotationY,6)
        var reference=CATransform3DIdentity;reference.m34 = -1/1050
        reference=CATransform3DTranslate(reference,0,40,-94)
        reference=CATransform3DRotate(reference,4.5 * .pi/180,0,0,1)
        reference=CATransform3DRotate(reference,4.25 * .pi/180,0,1,0)
        reference=CATransform3DRotate(reference,-4.5 * .pi/180,1,0,0)
        reference=CATransform3DScale(reference,0.6903,0.67275,1)
        XCTAssertTrue(CATransform3DEqualToTransform(middle.transform,reference))
    }
    func testLegendaryReflectionMatchesIndependentCanonicalFoilOwnerIncludingBackAndWrap() {
        for fixture in NativeRewardFoilOracle.states {
            let state=NativeRewardFoilPlanning.reflection(fixture[0])
            XCTAssertEqual(state.opacity,fixture[1],accuracy:0.000001)
            XCTAssertEqual(state.gold,fixture[2],accuracy:0.000001)
            XCTAssertEqual(state.rainbow,fixture[3],accuracy:0.000001)
        }
        XCTAssertEqual(NativeRewardFoilPlanning.reflection(.nan).opacity,0)
        XCTAssertEqual(NativeRewardMotion.cubic(0.5,0.42,0,0.58,1),0.5,accuracy:0.000001)
    }
    func testImmediateMountOnlyPreparesSelectedArtAndLayoutNeverStartsColdDecode() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        XCTAssertEqual(view.phase,"mounted");XCTAssertTrue(resources.reads.isEmpty)
        XCTAssertEqual(resources.requested.filter{$0.contains("zguzvano")}.count,9)
        XCTAssertEqual(resources.requested.filter{$0.contains("colelctibles")}.count,2)
        resources.finish();let reads=resources.reads.count
        view.view.setNeedsLayout();view.view.layoutIfNeeded();XCTAssertEqual(resources.reads.count,reads)
        view.dispose();XCTAssertEqual(resources.releases.count,1)
    }
    func testEarlyRevealRapidSecondTapCollectsExactlyOnceAndRetiresEnterCrumble() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources);resources.finish()
        var outcomes:[NativeJourneyRewardController.Action]=[],sounds:[String]=[]
        view.onFinish={outcomes.append($0)};view.onSoundMoment={kind,_,_ in sounds.append(kind)}
        view.start();view.activate();view.activate();XCTAssertEqual(view.phase,"revealing")
        clock.advance(2);XCTAssertEqual(outcomes.count,1);XCTAssertEqual(view.phase,"disposed")
        XCTAssertFalse(sounds.contains("new-card-crumble"));XCTAssertEqual(sounds.filter{$0=="new-card-reveal"}.count,1)
        view.activate();view.dispose();for job in clock.history {job.callback()};XCTAssertEqual(outcomes.count,1);XCTAssertEqual(clock.activeCount,0)
    }
    func testColdEarlyRevealWaitsForRequiredArtworkAndKeepsSecondTapWithoutInvisibleCollect() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        var outcomes=0,reveals=0
        view.onFinish={_ in outcomes += 1};view.onSoundMoment={kind,_,_ in if kind=="new-card-reveal" {reveals += 1}}
        view.start();view.activate();view.activate();clock.advance(4)
        XCTAssertEqual(view.phase,"awaiting-artwork");XCTAssertEqual(outcomes,0);XCTAssertEqual(reveals,0)
        view.setForeground(false);resources.finish();clock.advance(10)
        XCTAssertEqual(view.phase,"awaiting-artwork");XCTAssertEqual(reveals,0)
        view.setForeground(true);XCTAssertEqual(view.phase,"revealing");clock.advance(2)
        XCTAssertEqual(reveals,1);XCTAssertEqual(outcomes,1)
    }
    func testRejectedRequiredArtworkCannotRevealOrCollect() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        var outcomes=0,failures=0;view.onFinish={_ in outcomes += 1};view.onAssetFailure={_ in failures += 1}
        view.start();view.activate();resources.completion?(false);resources.completion=nil
        view.activate();clock.advance(20)
        XCTAssertEqual(view.phase,"asset-failed");XCTAssertEqual(outcomes,0);XCTAssertEqual(failures,1)
        view.dispose();XCTAssertEqual(outcomes,1)
    }
    func testBackgroundPreservesRemainingRevealAndCollectDeadlinesWithoutDuplicateMoments() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources);resources.finish()
        var outcomes=0,reveals=0;view.onFinish={_ in outcomes += 1};view.onSoundMoment={kind,_,_ in if kind=="new-card-reveal" {reveals += 1}}
        view.start();view.activate();view.activate();clock.advance(0.2);view.setForeground(false)
        let old=clock.history;clock.advance(20);for job in old {job.callback()};XCTAssertEqual(view.phase,"revealing");XCTAssertEqual(outcomes,0)
        view.setForeground(true);clock.advance(0.62);XCTAssertEqual(view.phase,"exiting")
        clock.advance(0.1);view.setForeground(false);clock.advance(10);XCTAssertEqual(outcomes,0)
        view.setForeground(true);clock.advance(0.33);XCTAssertEqual(outcomes,1);XCTAssertEqual(reveals,1)
    }
    func testReplacementSettlesAndLatePreparationNeverReopensDisposedScreen() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        var cancelled=0;view.onFinish={action in if case .cancelled=action {cancelled += 1}}
        view.start();view.dispose();view.dispose();resources.finish();clock.advance(20)
        XCTAssertEqual(cancelled,1);XCTAssertTrue(resources.reads.isEmpty);XCTAssertEqual(clock.activeCount,0)
    }
    func testVisibleIdleBoundedAndReducedMotionSuppressesCoachLoops() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources,reduced:true);resources.finish();view.start();view.activate();clock.advance(1)
        XCTAssertEqual(view.phase,"unlocked");XCTAssertEqual(clock.activeCount,0);view.dispose()
        let secondClock=Clock(),secondResources=Resources(),second=screen(secondClock,secondResources);secondResources.finish();second.start();second.activate();secondClock.advance(40)
        XCTAssertLessThanOrEqual(secondClock.activeCount,2);second.setForeground(false);XCTAssertEqual(secondClock.activeCount,0);second.dispose();secondClock.advance(20);XCTAssertEqual(secondClock.activeCount,0)
    }
}
