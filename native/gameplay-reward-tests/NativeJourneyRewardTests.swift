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
