import XCTest
import UIKit
import AVFAudio
@testable import Stack_to_Six

@MainActor
final class NativeArcadeMusicTests:XCTestCase {
    private final class Transport:NativeSoundtrackTransport {
        struct Command {let id:String,op:String,body:[String:Any]}
        var commands:[Command]=[];var position=1.1
        var deferPlay=false
        var playReply:((Any?,String?)->Void)?
        func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void) {
            commands.append(Command(id:id,op:op,body:body))
            if op=="play",deferPlay {playReply=replyHandler;return}
            replyHandler(["position":position,"duration":49.399658],nil)
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
    func testOutgoingThemeIsReleasedOnlyAfterIncomingPlaybackSucceeds() {
        let transport=Transport(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:Scheduler())
        defer{owner.dispose()}
        transport.deferPlay=true;var readiness:[Double]=[]
        owner.onPlaybackReady={readiness.append($0)}
        owner.enterRound(generation:1);XCTAssertTrue(readiness.isEmpty)
        transport.playReply?([:],nil)
        XCTAssertEqual(readiness,[1.25]);XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.11)
        owner.apply(enabled:false);owner.apply(enabled:true)
        let pending=transport.playReply;owner.leave();pending?([:],nil)
        XCTAssertEqual(readiness.count,1,"Retired entry cannot release another route's music")
    }
    func testForegroundRecoversMissingInterruptionEndForCurrentArcadeLayer() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        defer{owner.dispose()}
        owner.enterRound(generation:7)
        NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let count=transport.commands.count
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(transport.commands.dropFirst(count).contains{$0.op=="resume"})
        owner.apply(enabled:false)
        let muted=transport.commands.count
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.count,muted)
    }
    func testEveryMergeKeepsOneGameplayThemeAndRoundResumePreservesItsClock() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        defer{owner.dispose()}
        owner.enterRound(generation:9)
        let play=transport.commands.first{$0.op=="play"}!
        XCTAssertEqual(play.body["source"] as? String,NativeSoundtrackRouteOwner.gameplaySource)
        XCTAssertEqual(play.body["loopStart"] as? Double,NativeSoundtrackRouteOwner.gameplayLoopStart)
        XCTAssertEqual(play.body["loopEnd"] as? Double,NativeSoundtrackRouteOwner.gameplayLoopEnd)
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.11)
        let count=transport.commands.count
        for _ in 0..<20 {owner.committedMerge6(generation:9)}
        XCTAssertEqual(transport.commands.count,count);XCTAssertTrue(scheduler.jobs.isEmpty)
        owner.enterRound(generation:10)
        XCTAssertEqual(transport.commands.filter{$0.op=="play"}.count,1)
        XCTAssertTrue(transport.commands.contains{$0.op=="resume"})
        owner.apply(enabled:false);let muted=transport.commands.count
        owner.committedMerge6(generation:10);owner.setForeground(false);owner.setForeground(true)
        XCTAssertEqual(transport.commands.count,muted)
        owner.apply(enabled:true)
        XCTAssertEqual(transport.commands.last{$0.op=="play"}?.body["source"] as? String,NativeSoundtrackRouteOwner.gameplaySource)
    }
    func testPendingLeaveCannotDisposeReenteredRoundAndDisposalRevokesRecovery() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:1);owner.leave()
        let pending=scheduler.jobs[0];owner.enterRound(generation:2)
        XCTAssertTrue(pending.cancelled);let count=transport.commands.count;pending.fireEvenIfCancelled()
        XCTAssertEqual(transport.commands.count,count)
        owner.dispose();let disposed=transport.commands.count
        owner.dispose();owner.apply(enabled:true);owner.enterRound(generation:3);owner.setForeground(true)
        XCTAssertEqual(transport.commands.count,disposed)
    }
    func testBackgroundDuringLeaveReleasesOtherwiseOrphanedVoice() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        defer{owner.dispose()}
        owner.enterRound(generation:1);owner.leave();owner.setForeground(false)
        XCTAssertEqual(transport.commands.last?.op,"dispose")
        let count=transport.commands.count;owner.setForeground(true)
        XCTAssertEqual(transport.commands.count,count)
    }
    func testSaxStopDuringBackgroundRetainsStableRestoreWithoutPlayingHiddenMusic() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        owner.enterRound(generation:7);owner.setResultMix(generation:7);let release=owner.beginResultHook(generation:7)
        owner.setForeground(false);let hiddenCount=transport.commands.count;release();release();XCTAssertEqual(transport.commands.count,hiddenCount)
        owner.setForeground(true);XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.11)
        let completed=transport.commands.count;release();XCTAssertEqual(transport.commands.count,completed)
        let old=owner.beginResultHook(generation:7);owner.apply(enabled:false);owner.apply(enabled:true)
        let afterOn=transport.commands.count;old();XCTAssertEqual(transport.commands.count,afterOn)
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.11);owner.dispose()
    }
    func testResultAndOldReleaseCannotOwnNewRound() {
        let transport=Transport(),scheduler=Scheduler(),owner=NativeArcadeMusicOwner(transport:transport,scheduler:scheduler)
        defer{owner.dispose()}
        owner.enterRound(generation:1);owner.setResultMix(generation:1)
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0.07)
        let release=owner.beginResultHook(generation:1)
        XCTAssertEqual(transport.commands.last?.body["volume"] as? Double,0)
        owner.enterRound(generation:2);let count=transport.commands.count;release()
        XCTAssertEqual(transport.commands.count,count)
    }
}
