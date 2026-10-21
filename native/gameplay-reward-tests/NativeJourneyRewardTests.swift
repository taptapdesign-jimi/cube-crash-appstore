import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeJourneyRewardTests:XCTestCase {
    func testExplicitCompletionAwardOwnsRewardRarityInsteadOfStatisticalHighScore() {
        for board in [1,11,21] {for (score,stars,rarity) in [(1000,3,"legendary"),(999999,1,"common")] {
            let clock=Clock(),resources=Resources()
            let controller=NativeJourneyRewardController(root:NativeTestResources.root,board:board,
                score:score,generation:77,awardedStars:stars,resources:resources,scheduler:clock)
            controller.prepareMagicCard={_,_,_ in}
            controller.loadViewIfNeeded()
            XCTAssertTrue(resources.requested.contains{$0.contains("/\(rarity)/")})
            XCTAssertFalse(resources.requested.contains{$0.contains("/\(rarity == "legendary" ? "common":"legendary")/")})
            controller.dispose(notify:false)
        }}
    }
    func testDetachedMagicPreparationDoesNotPlayAndDisposedWaiterCannotAdmit() throws {
        let controller=NativeJourneyRewardController(root:NativeTestResources.root,board:1,score:1000,generation:77)
        var finish:((NativeMagicCardSource.Node?)->Void)?
        controller.prepareMagicCard={_,_,completion in finish=completion}
        controller.loadViewIfNeeded()
        var admitted=0
        controller.whenMagicCardPrepared {admitted += 1}
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        finish?(source)
        XCTAssertEqual(admitted,1);XCTAssertNil(controller.parent);XCTAssertNil(controller.view.window)
        XCTAssertNotEqual(controller.phase,"opening")
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let magic=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.magic-card"})
        XCTAssertTrue(descendants(magic).allSatisfy{($0.animationKeys() ?? []).isEmpty})
        controller.dispose();controller.whenMagicCardPrepared {admitted += 1};finish?(source)
        XCTAssertEqual(admitted,1)
    }
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
        let screen=NativeJourneyRewardController(root:URL(fileURLWithPath:"/unused"),board:11,score:1000,generation:77,resources:resources,scheduler:clock,reducedMotion:reduced,random:{0.37},now:{clock.time});screen.prepareMagicCard={_,lease,completion in completion(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:lease))};screen.prepareFilteredFrames={images,_,completion in completion(images)};screen.loadViewIfNeeded();screen.view.frame=CGRect(x:0,y:0,width:390,height:844);screen.view.layoutIfNeeded();return screen
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
        resources.finish();controller.start();controller.activate();clock.advance(3)
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
    func testAuthoredSVGOpeningHoldsWithParentIdleAndClickStartsBothFaces() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();XCTAssertEqual(controller.phase,"opening")
        clock.advance(0.7)
        XCTAssertEqual(controller.phase,"opening")
        clock.advance(NativeMagicCardSource.hold)
        XCTAssertEqual(controller.phase,"interim");XCTAssertEqual(clock.activeCount,0)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let layers=descendants(controller.view.layer),magic=layers.first{$0.name=="native.reward.magic-card"}!
        XCTAssertEqual(descendants(magic).filter{$0.contents != nil}.count,9)
        XCTAssertTrue(descendants(magic).allSatisfy{($0.animationKeys() ?? []).isEmpty})
        let rotor=magic.superlayer!,pose=rotor.superlayer!.superlayer!
        for layer in [pose,rotor] {
            let idle=layer.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation
            XCTAssertEqual(idle?.duration,3);XCTAssertEqual(idle?.repeatCount,.infinity)
            let values=idle?.values as? [NSValue]
            XCTAssertTrue(CATransform3DEqualToTransform(values!.first!.caTransform3DValue,values!.last!.caTransform3DValue))
        }
        controller.setForeground(false);XCTAssertEqual(controller.view.layer.speed,0)
        controller.setForeground(true);XCTAssertEqual(controller.view.layer.speed,1)
        XCTAssertFalse(layers.contains{$0.name=="native.reward.interim-shimmer" || $0.name=="native.reward.interim-burn"})
        clock.advance(30);XCTAssertEqual(clock.activeCount,0);XCTAssertEqual(controller.phase,"interim")
        controller.activate();XCTAssertEqual(controller.phase,"revealing")
        XCTAssertEqual(rotor.animation(forKey:"reward.transform.0.0")?.repeatCount,0)
        XCTAssertTrue(descendants(magic).contains{!($0.animationKeys() ?? []).isEmpty})
        let unlockedBurn=layers.first{$0.name=="native.reward.unlocked-burn"}!
        let unlocked=unlockedBurn.superlayer!.superlayer!
        XCTAssertEqual(unlocked.opacity,1);XCTAssertNotNil(unlocked.animation(forKey:"reward.transform.0.3"))
        controller.dispose();XCTAssertNil(magic.sublayers);XCTAssertEqual(clock.activeCount,0)
        XCTAssertTrue((pose.animationKeys() ?? []).isEmpty);XCTAssertTrue((rotor.animationKeys() ?? []).isEmpty)
    }
    func testReducedMotionSettledInterimHasNoIdleOrRecurringWork() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources,reduced:true)
        resources.finish();controller.start();clock.advance(1)
        XCTAssertEqual(controller.phase,"interim");XCTAssertEqual(clock.activeCount,0)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let magic=descendants(controller.view.layer).first{$0.name=="native.reward.magic-card"}!
        XCTAssertNil(magic.superlayer!.animation(forKey:"reward.transform.0.0"))
        controller.dispose()
    }
    func testOpeningPauseAndLateSVGPreparationAreOwnedByRewardLifetime() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();clock.advance(0.8);controller.activate();controller.activate()
        controller.setForeground(false);clock.advance(10);XCTAssertEqual(controller.phase,"opening");XCTAssertEqual(clock.activeCount,0)
        controller.setForeground(true);clock.advance(0.6);XCTAssertEqual(controller.phase,"revealing")
        controller.activate();clock.advance(2);XCTAssertEqual(controller.phase,"disposed")
        for job in clock.history {job.callback()};XCTAssertEqual(clock.activeCount,0)
    }
    func testUnlockedRevealDoesNotRestartItsBurnBeforePeak() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();clock.advance(2.1);controller.activate();clock.advance(0.68)
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
        // Native progression swaps the first two authored cards in each World;
        // keep the immutable PWA oracle, applying only the Native order here.
        var nativeNames=NativeRewardOracleFixtures.names
        for start in [0,10,20] {nativeNames.swapAt(start,start+1)}
        XCTAssertEqual(NativeRewardPresentation.names,nativeNames)
        for board in 1...30 {XCTAssertEqual(NativeRewardPresentation.name(board:board),nativeNames[board-1])}
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
    func testEarlyVisibleRewardCannotRevealUntilCanonicalActionsAreAdmitted() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources);resources.finish()
        controller.setRewardActionsAdmitted(false);controller.start();controller.activate()
        clock.advance(2);XCTAssertEqual(controller.phase,"interim")
        controller.setRewardActionsAdmitted(true);controller.activate();XCTAssertEqual(controller.phase,"revealing")
        controller.dispose()
    }
    func testSVGStartsImmediatelyWithoutWaitingForUnlockedArtworkOrFilters() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        controller.start();XCTAssertEqual(controller.phase,"opening")
        XCTAssertTrue(resources.reads.isEmpty,"Unlocked artwork is still cold")
        clock.advance(NativeMagicCardSource.hold);XCTAssertEqual(controller.phase,"interim")
        controller.dispose()
    }
    func testImmediateMountOnlyPreparesSelectedArtAndLayoutNeverStartsColdDecode() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        XCTAssertEqual(view.phase,"mounted");XCTAssertTrue(resources.reads.isEmpty)
        XCTAssertEqual(resources.requested.filter{$0.contains("zguzvano")}.count,0)
        XCTAssertEqual(resources.requested.filter{$0.contains("colelctibles")}.count,2)
        resources.finish();let reads=resources.reads.count
        view.view.setNeedsLayout();view.view.layoutIfNeeded();XCTAssertEqual(resources.reads.count,reads)
        view.dispose();XCTAssertEqual(resources.releases.count,1)
    }
    func testOpeningCrumbsAtTwentyPercentPuffAtFiftyAndDisposeCancels() {
        for reduced in [false,true] {
            let clock=Clock(),resources=Resources(),view=screen(clock,resources,reduced:reduced);resources.finish()
            var moments:[(String,Double)]=[]
            view.onSoundMoment={kind,_,_ in moments.append((kind,clock.time))}
            view.start()
            let duration=reduced ? 0.16:NativeMagicCardSource.hold
            clock.advance(duration*0.20-0.001)
            XCTAssertFalse(moments.contains{$0.0=="new-card-intro" || $0.0=="new-card-crumble"})
            clock.advance(0.0011)
            XCTAssertEqual(moments.first{$0.0=="new-card-intro"}?.1 ?? -1,duration*0.20,accuracy:0.00001)
            XCTAssertEqual(moments.first{$0.0=="new-card-crumble"}?.1 ?? -1,duration*0.20,accuracy:0.00001)
            clock.advance(duration*0.30-0.0002)
            XCTAssertFalse(moments.contains{$0.0=="new-card-opening-puff"})
            clock.advance(0.0002)
            XCTAssertEqual(moments.first{$0.0=="new-card-opening-puff"}?.1 ?? -1,duration*0.50,accuracy:0.00001)
            view.dispose();let count=moments.count
            for job in clock.history {job.callback()}
            XCTAssertEqual(moments.count,count)
        }
    }

    func testEarlyTapCannotSkipOpeningOrQueueInvisibleCollect() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources);resources.finish()
        var outcomes:[NativeJourneyRewardController.Action]=[],sounds:[String]=[]
        view.onFinish={outcomes.append($0)};view.onSoundMoment={kind,_,_ in sounds.append(kind)}
        view.start();view.activate();view.activate();XCTAssertEqual(view.phase,"opening")
        clock.advance(3);XCTAssertEqual(outcomes.count,0);XCTAssertEqual(view.phase,"unlocked")
        view.activate();clock.advance(1);XCTAssertEqual(outcomes.count,1);XCTAssertEqual(view.phase,"disposed")
        XCTAssertTrue(sounds.contains("new-card-crumble"));XCTAssertEqual(sounds.filter{$0=="new-card-reveal"}.count,1);XCTAssertEqual(sounds.filter{$0=="new-card-unlocked-enter"}.count,1)
        XCTAssertEqual(sounds.filter{$0=="modal-open"}.count,1);XCTAssertEqual(sounds.filter{$0=="modal-exit"}.count,1)
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
        view.setForeground(true);XCTAssertEqual(view.phase,"revealing");clock.advance(3)
        XCTAssertEqual(reveals,1);XCTAssertEqual(outcomes,0);view.activate();clock.advance(1);XCTAssertEqual(outcomes,1)
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
        view.start();clock.advance(2.1);view.activate();view.activate();clock.advance(0.2);view.setForeground(false)
        let old=clock.history;clock.advance(20);for job in old {job.callback()};XCTAssertEqual(view.phase,"revealing");XCTAssertEqual(outcomes,0)
        view.setForeground(true);clock.advance(0.68);XCTAssertEqual(view.phase,"exiting")
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
        let clock=Clock(),resources=Resources(),view=screen(clock,resources,reduced:true);resources.finish();view.start();view.activate();clock.advance(1.6)
        XCTAssertEqual(view.phase,"unlocked");XCTAssertEqual(clock.activeCount,0);view.dispose()
        let secondClock=Clock(),secondResources=Resources(),second=screen(secondClock,secondResources);secondResources.finish();second.start();second.activate();secondClock.advance(40)
        XCTAssertLessThanOrEqual(secondClock.activeCount,2);second.setForeground(false);XCTAssertEqual(secondClock.activeCount,0);second.dispose();secondClock.advance(20);XCTAssertEqual(secondClock.activeCount,0)
    }
}
