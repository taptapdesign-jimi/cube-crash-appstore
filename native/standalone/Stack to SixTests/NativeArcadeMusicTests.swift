import XCTest
@testable import Stack_to_Six

@MainActor
final class NativeArcadeMusicTests:XCTestCase {
    private final class Transport:NativeSoundtrackTransport {
        struct Command {let id:String,op:String,body:[String:Any]}
        var commands:[Command]=[];var position=1.1
        func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void) {
            commands.append(Command(id:id,op:op,body:body));replyHandler(["position":position,"duration":49.399658],nil)
        }
    }
    private final class Job:NativeMusicCancellation {
        let duration:Double;let callback:()->Void;var cancelled=false
        init(_ duration:Double,_ callback:@escaping ()->Void) {self.duration=duration;self.callback=callback}
        func cancel() {cancelled=true}
        func fireEvenIfCancelled() {callback()}
    }
    private final class Scheduler:NativeMusicScheduler {
        var jobs:[Job]=[]
        func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {let job=Job(seconds,callback);jobs.append(job);return job}
    }
    func testFirstMergeWaitsForActualNextBarAndInheritsNativePhase() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:9)
        XCTAssertEqual(transport.commands.first{$0.op=="play"}?.body["source"] as? String,"./assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-calm-01.wav")
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.528)
        XCTAssertEqual(transport.commands.last?.body["duration"] as? Double,1.25)
        owner.committedMerge6(generation:9);owner.committedMerge6(generation:9)
        XCTAssertEqual(scheduler.jobs.count,1)
        XCTAssertEqual(scheduler.jobs[0].duration,((NativeArcadeMusicOwner.barSeconds-1.1)*1000).rounded()/1000,accuracy:0.000001)
        transport.position=2.058;scheduler.jobs[0].fireEvenIfCancelled()
        let active=transport.commands.last{$0.op=="play" && $0.id.hasSuffix("active")}
        XCTAssertEqual(active?.body["position"] as? Double,2.058)
        XCTAssertTrue(transport.commands.contains{$0.id.hasSuffix("active") && $0.op=="volume" && $0.body["volume"] as? Double==0.594 && $0.body["duration"] as? Double==NativeArcadeMusicOwner.barCrossfadeSeconds})
        owner.dispose()
    }
    func testMusicOffRejectsStaleBarAndDisposeDoesNotRestartVoice() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:1);owner.committedMerge6(generation:1)
        let pending=scheduler.jobs[0];owner.apply(enabled:false)
        XCTAssertTrue(pending.cancelled);let count=transport.commands.count;pending.fireEvenIfCancelled()
        XCTAssertEqual(transport.commands.count,count)
        owner.dispose();owner.dispose();owner.apply(enabled:true);owner.enterRound(generation:2)
        XCTAssertEqual(transport.commands.count,count)
    }
    func testPromotionIntentSurvivesBackgroundWithoutLatePlay() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:1);owner.committedMerge6(generation:1);let pending=scheduler.jobs[0]
        owner.setForeground(false);let count=transport.commands.count;pending.fireEvenIfCancelled()
        XCTAssertEqual(transport.commands.count,count)
        owner.setForeground(true)
        XCTAssertTrue(transport.commands.contains{$0.op=="play" && $0.id.hasSuffix("active")})
        owner.dispose()
    }
    func testSaxStopDuringBackgroundRetainsStableRestoreWithoutPlayingHiddenMusic() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:7);owner.setResultMix(generation:7);let release=owner.beginResultHook(generation:7)
        owner.setForeground(false);let hiddenCount=transport.commands.count;release();release();XCTAssertEqual(transport.commands.count,hiddenCount)
        owner.setForeground(true);XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.528)
        let completed=transport.commands.count;release();XCTAssertEqual(transport.commands.count,completed)
        let old=owner.beginResultHook(generation:7);owner.apply(enabled:false);owner.apply(enabled:true)
        let afterOn=transport.commands.count;old();XCTAssertEqual(transport.commands.count,afterOn)
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.528);owner.dispose()
    }
    func testResultMixCancelsPromotionAndOldResultReleaseCannotOwnNewRound() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:1);owner.committedMerge6(generation:1);let pending=scheduler.jobs[0]
        owner.setResultMix(generation:1)
        XCTAssertTrue(pending.cancelled)
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.10)
        let count=transport.commands.count;pending.fireEvenIfCancelled();XCTAssertEqual(transport.commands.count,count)
        let release=owner.beginResultHook(generation:1);owner.enterRound(generation:2)
        let nextCount=transport.commands.count;release();XCTAssertEqual(transport.commands.count,nextCount)
        owner.dispose()
    }
}
