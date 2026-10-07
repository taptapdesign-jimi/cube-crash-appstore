import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeSpecialDiceUnlockTests:XCTestCase {
    private final class Token:NativeMusicCancellation {var cancelled=false;func cancel(){cancelled=true}}
    private final class Clock:NativeMusicScheduler {
        struct Job {let token:Token,at:Double,callback:()->Void}
        var time=0.0,jobs:[Job]=[],history:[Job]=[]
        func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {let token=Token(),job=Job(token:token,at:time+seconds,callback:callback);jobs.append(job);history.append(job);return token}
        func advance(_ seconds:Double){let target=time+seconds;while let next=jobs.filter({!$0.token.cancelled && $0.at<=target}).min(by:{$0.at<$1.at}){jobs.removeAll{$0.token===next.token};time=next.at;next.callback()};time=target}
        var active:Int {jobs.filter{!$0.token.cancelled}.count}
    }
    private final class Resources:NativeRewardResources {
        var requested:[String]=[],released=0;var completion:((Bool)->Void)?
        func image(_ path:String,owner:Int)->UIImage?{UIImage()}
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){requested=paths;self.completion=completion}
        func release(_ owner:Int){released += 1}
        func finish(){let callback=completion;completion=nil;callback?(true)}
    }
    private func screen(_ clock:Clock,_ resources:Resources)->NativeSpecialDiceUnlockController {
        let screen=NativeSpecialDiceUnlockController(root:URL(fileURLWithPath:"/unused"),generation:9,resources:resources,scheduler:clock,reducedMotion:false,now:{clock.time});screen.prepareFilteredFrames={images,_,completion in completion(images)};screen.loadViewIfNeeded();screen.view.frame=CGRect(x:0,y:0,width:390,height:844);screen.view.layoutIfNeeded();screen.start();return screen
    }
    func testExactTwentyBackpackFramesAndSourceUnlockMoment() {
        let clock=Clock(),resources=Resources(),screen=screen(clock,resources);var unlocks:[String]=[],haptics:[String]=[]
        screen.onUnlock={unlocks.append($0)};screen.onHaptic={haptics.append($0)}
        XCTAssertEqual(resources.requested.count,21);XCTAssertEqual(resources.requested.last,"assets/shop/bush/flower.png")
        screen.activateHero();XCTAssertEqual(screen.phase,"preparing");resources.finish();screen.activateHero();screen.activateHero()
        clock.advance(0.99);XCTAssertTrue(unlocks.isEmpty);XCTAssertEqual(screen.phase,"opening")
        clock.advance(0.541);XCTAssertTrue(unlocks.isEmpty)
        clock.advance(0.0011);XCTAssertEqual(unlocks,["flower"]);XCTAssertEqual(screen.phase,"unlocked")
        XCTAssertEqual(haptics.filter{$0=="light"}.count,3);screen.dispose()
    }
    func testEarlyContinueRetiresPendingUnlockExactlyAsSourceAndSettlesOnce() {
        let clock=Clock(),resources=Resources(),screen=screen(clock,resources);resources.finish()
        var unlocks=0,outcomes=0;screen.onUnlock={_ in unlocks += 1};screen.onFinish={_ in outcomes += 1}
        screen.activateHero();clock.advance(1.22);screen.activateContinue();screen.activateContinue();clock.advance(3)
        XCTAssertEqual(unlocks,0);XCTAssertEqual(outcomes,1);XCTAssertEqual(screen.phase,"disposed")
        for job in clock.history {job.callback()};XCTAssertEqual(outcomes,1);XCTAssertEqual(unlocks,0)
    }
    func testBackgroundPreservesRemainingNativeFrameAndExitDeadlines() {
        let clock=Clock(),resources=Resources(),screen=screen(clock,resources);resources.finish()
        var unlocks=0,outcomes=0;screen.onUnlock={_ in unlocks += 1};screen.onFinish={_ in outcomes += 1}
        screen.activateHero();clock.advance(0.7);screen.setForeground(false);clock.advance(30)
        for job in clock.history {job.callback()};XCTAssertEqual(unlocks,0)
        screen.setForeground(true);clock.advance(0.84);XCTAssertEqual(unlocks,1);screen.activateContinue();clock.advance(0.4);screen.setForeground(false);clock.advance(20);XCTAssertEqual(outcomes,0)
        screen.setForeground(true);clock.advance(0.62);XCTAssertEqual(outcomes,1);XCTAssertEqual(clock.active,0)
    }
    func testFailedUnlockSaveCanRetryWithoutReplayingBackpackAndCommitsOnce() {
        enum Failure:Error {case save}
        let clock=Clock(),resources=Resources(),screen=screen(clock,resources);resources.finish();var attempts=0
        screen.onUnlock={_ in attempts += 1;if attempts==1 {throw Failure.save}}
        screen.activateHero();clock.advance(1.6);XCTAssertEqual(screen.phase,"save-failed")
        screen.activateHero();XCTAssertEqual(screen.phase,"unlocked");XCTAssertEqual(attempts,2)
        screen.activateHero();clock.advance(2);XCTAssertEqual(attempts,2);XCTAssertEqual(screen.phase,"disposed")
    }
    func testReplacementAndLateAssetPrepareCannotCommitOrReopenOldUnlock() {
        let clock=Clock(),resources=Resources(),screen=screen(clock,resources);var cancelled=0
        screen.onFinish={action in if case .cancelled=action {cancelled += 1}};screen.onUnlock={_ in XCTFail("Late old unlock")}
        screen.dispose();screen.dispose();resources.finish();clock.advance(20);screen.activateHero()
        XCTAssertEqual(screen.phase,"disposed");XCTAssertEqual(cancelled,1);XCTAssertEqual(resources.released,1);XCTAssertEqual(clock.active,0)
    }
    func testSourceFrameTimesAndShortHeightLayout() {
        XCTAssertEqual(NativeSpecialDiceUnlockPresentation.frameStartTimes.count,20)
        XCTAssertEqual(NativeSpecialDiceUnlockPresentation.frameStartTimes[16],0.736,accuracy:0.000001)
        XCTAssertEqual(NativeSpecialDiceUnlockPresentation.frameStartTimes[19],0.928,accuracy:0.000001)
        XCTAssertEqual(NativeSpecialDiceUnlockPresentation.frameDuration,0.992,accuracy:0.000001)
        let compact=NativeSpecialDiceUnlockPresentation.Layout(width:390,height:760),regular=NativeSpecialDiceUnlockPresentation.Layout(width:390,height:761)
        XCTAssertEqual(compact.title.minY,40);XCTAssertEqual(compact.hero.width,249.6,accuracy:0.000001);XCTAssertEqual(regular.hero.width,265.2,accuracy:0.000001)
        XCTAssertLessThan(compact.cta.maxY,760);XCTAssertEqual(compact.cta.height,64)
    }
}
