import XCTest
import UIKit
import AVFAudio
@testable import Stack_to_Six

@MainActor
final class NativeSoundtrackRouteTests:XCTestCase {
    func testOverallThemeReductionSurvivesRoutesResultHookAndForegroundRecovery() {
        let transport=Transport()
        let owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true})
        defer{owner.dispose()}
        owner.setMenu()
        XCTAssertEqual(transport.volumes.last!,0.578*0.8*0.7,accuracy:0.00000001)
        owner.setJourneyGameplay()
        XCTAssertEqual(transport.volumes.last!,0.11,accuracy:0.00000001)
        let release=owner.beginResultHook()
        XCTAssertEqual(transport.volumes.last!,0)
        release()
        XCTAssertEqual(transport.volumes.last!,0.578*0.8*0.7,accuracy:0.00000001)
        owner.setJourneyGameplay()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.volumes.last!,0.11,accuracy:0.00000001)
        owner.apply(enabled:false);owner.apply(enabled:true)
        XCTAssertEqual(transport.volumes.last!,0.11,accuracy:0.00000001)
    }
    func testMusicOffAndDisposalRevokeForegroundRecovery() {
        let transport = Transport()
        let owner = NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport)
        owner.apply(enabled:false)
        let count = transport.commands.count
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.count,count)
        XCTAssertEqual(transport.commands.last,"dispose")
        owner.dispose()
        let disposedCount = transport.commands.count
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.count,disposedCount)
    }
    func testBackgroundRetiresCurrentVoiceWithoutNewAllocation() {
        let transport = Transport()
        let owner = NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(transport.commands,["pause"])
        owner.setMenu();owner.setJourneyGameplay()
        XCTAssertEqual(transport.commands,["pause"])
        owner.dispose()
    }
    func testJourneyUsesNewLoopAndMenuRestoresOriginalFileAndPhase() {
        let transport=Transport(),owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true})
        defer{owner.dispose()}
        owner.setMenu();owner.setJourneyGameplay()
        XCTAssertEqual(transport.plays.last?["source"] as? String,NativeSoundtrackRouteOwner.gameplaySource)
        XCTAssertEqual(transport.plays.last?["loopStart"] as? Double,195122.0/48000)
        XCTAssertEqual(transport.plays.last?["loopEnd"] as? Double,3317074.0/48000)
        owner.setMenu()
        XCTAssertTrue((transport.plays.last?["source"] as? String)?.contains("SIx-theme-runtime") == true)
        XCTAssertEqual(transport.plays.last?["position"] as? Double,12.5)
        owner.setJourneyGameplay();XCTAssertEqual(transport.plays.last?["position"] as? Double,12.5)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.suffix(2),["resume","volume"])
        owner.apply(enabled:false);owner.apply(enabled:true)
        XCTAssertEqual(transport.plays.last?["source"] as? String,NativeSoundtrackRouteOwner.gameplaySource)
    }
    func testPackagedGameplayFileWrapsOnNativeAudioClock() async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let file=try AVAudioFile(forReading:root.appendingPathComponent(NativeSoundtrackRouteOwner.gameplaySource))
        XCTAssertEqual(file.processingFormat.sampleRate,48000)
        XCTAssertEqual(file.length,3317074)
        let transport=JimiNativeMusic(root:root)
        defer{transport.dispose()}
        var failure:String?
        transport.perform(id:"soundtrack-test-gameplay",op:"play",body:["source":NativeSoundtrackRouteOwner.gameplaySource,
            "volume":0,"position":NativeSoundtrackRouteOwner.gameplayLoopEnd-0.08,"loop":true,
            "loopStart":NativeSoundtrackRouteOwner.gameplayLoopStart,"loopEnd":NativeSoundtrackRouteOwner.gameplayLoopEnd]){_,error in failure=error}
        XCTAssertNil(failure)
        try await Task.sleep(for:.milliseconds(250))
        var position:Double=0
        transport.perform(id:"soundtrack-test-gameplay",op:"state",body:[:]){value,error in
            XCTAssertNil(error);position=(value as? [String:Any])?["position"] as? Double ?? 0
        }
        XCTAssertGreaterThanOrEqual(position,NativeSoundtrackRouteOwner.gameplayLoopStart)
        XCTAssertLessThan(position,NativeSoundtrackRouteOwner.gameplayLoopStart+1)
    }
    func testJourneyAndReturnRequestOverlapWithoutDisposingTheAudibleFile() {
        let transport=Transport(),owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true})
        defer{owner.dispose()}
        owner.setMenu();let start=transport.commands.count
        owner.setJourneyGameplay();owner.setMenu()
        XCTAssertFalse(transport.commands.dropFirst(start).contains("dispose"))
        XCTAssertEqual(transport.plays.suffix(2).compactMap{$0["crossfadeDuration"] as? Double},[1.25,1.25])
    }
    func testArcadeKeepsMenuThroughAnnouncementUntilIncomingReadinessAndRejectsStaleFade() {
        let transport=Transport(),owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true})
        defer{owner.dispose()}
        owner.setMenu();let start=transport.commands.count
        owner.setArcadeGameplay()
        XCTAssertEqual(transport.commands.count,start,"NN admission must not pause the audible theme")
        transport.deferFade=true;owner.arcadePlaybackReady(duration:1.25)
        XCTAssertEqual(transport.commands.last,"volume");XCTAssertFalse(transport.commands.contains("pause"))
        let stale=transport.fadeReplies.removeFirst();owner.setMenu();let returned=transport.commands.count
        stale([:],nil);XCTAssertEqual(transport.commands.count,returned)
        owner.setArcadeGameplay();owner.arcadePlaybackReady(duration:1.25)
        transport.fadeReplies.removeFirst()([:],nil)
        XCTAssertEqual(transport.commands.last,"pause")
        owner.setMenu();XCTAssertEqual(transport.commands.suffix(2),["resume","volume"])
    }
    func testNativeSourceCrossfadeKeepsOutgoingLiveThenRetiresItAndCancelsOnBackground() async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let transport=JimiNativeMusic(root:root),id="soundtrack-test-handoff"
        defer{transport.dispose()}
        let menu="assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav"
        func play(_ source:String,_ duration:Double) {
            transport.perform(id:id,op:"play",body:["source":source,"volume":0.11,"position":3,"loop":true,"crossfadeDuration":duration]){_,error in XCTAssertNil(error)}
        }
        func state(_ voice:String)->[String:Any] {
            var result:[String:Any]=[:]
            transport.perform(id:voice,op:"state",body:[:]){value,error in XCTAssertNil(error);result=value as? [String:Any] ?? [:]}
            return result
        }
        play(menu,0);play(NativeSoundtrackRouteOwner.gameplaySource,0.12)
        XCTAssertEqual(state(id+"-outgoing")["playing"] as? Bool,true)
        XCTAssertGreaterThan(state(id+"-outgoing")["gain"] as? Double ?? 0,0)
        XCTAssertEqual(state(id)["playing"] as? Bool,true)
        try await Task.sleep(for:.milliseconds(240))
        XCTAssertEqual((state(id+"-outgoing")["duration"] as? NSNumber)?.doubleValue,0)
        XCTAssertEqual(state(id)["gain"] as? Double ?? 0,0.11,accuracy:0.0001)
        // Rapid reversal retains at most the current incoming and one outgoing.
        play(menu,0.5);play(NativeSoundtrackRouteOwner.gameplaySource,0.5);play(menu,0.5)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual((state(id+"-outgoing")["duration"] as? NSNumber)?.doubleValue,0)
        XCTAssertEqual(state(id)["playing"] as? Bool,false)
        transport.perform(id:id,op:"dispose",body:[:]){_,error in XCTAssertNil(error)}
        XCTAssertEqual((state(id)["duration"] as? NSNumber)?.doubleValue,0)
    }
    func testTransientActivationFailureRecoversCurrentRouteWithoutFatalSurface() async throws {
        let transport=Transport();var attempts=0;var errors:[String]=[]
        let owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true},activateSession:{
            attempts += 1
            if attempts == 1 {throw NSError(domain:"com.apple.coreaudio.avfaudio",code:2003329396)}
        })
        defer{owner.dispose()};owner.onError={errors.append($0)}
        owner.setJourneyGameplay()
        XCTAssertEqual(errors.count,1);XCTAssertTrue(transport.plays.isEmpty)
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertEqual(attempts,2)
        XCTAssertEqual(transport.plays.last?["source"] as? String,NativeSoundtrackRouteOwner.gameplaySource)
    }
    func testTransportStartFailureRetriesWithoutDuplicateVoiceAndDisposalReleasesTimer() async throws {
        let transport=Transport();transport.failedStarts=1
        let owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true},activateSession:{})
        owner.setMenu();XCTAssertEqual(transport.plays.count,1)
        try await Task.sleep(for:.milliseconds(250));XCTAssertEqual(transport.plays.count,2)
        transport.failedStarts=1;owner.setJourneyGameplay()
        owner.dispose();let disposed=transport.commands.count
        try await Task.sleep(for:.milliseconds(250));XCTAssertEqual(transport.commands.count,disposed)
    }
    func testPersistentActivationFailureHasFiniteBudgetAndBackgroundRevokesPendingRetry() async throws {
        let transport=Transport();var attempts=0
        let owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true},activateSession:{
            attempts += 1;throw NSError(domain:"com.apple.coreaudio.avfaudio",code:2003329396)
        })
        defer{owner.dispose()};owner.setMenu()
        try await Task.sleep(for:.seconds(2))
        XCTAssertEqual(attempts,4,"Initial attempt plus three bounded retries")
        try await Task.sleep(for:.milliseconds(200));XCTAssertEqual(attempts,4)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let background=attempts
        try await Task.sleep(for:.milliseconds(250));XCTAssertEqual(attempts,background)
        XCTAssertTrue(transport.plays.isEmpty)
    }
    func testInterruptionBlocksRoutePlaybackUntilForegroundAndMusicOffCancelsRecovery() async throws {
        let transport=Transport();var fail=false;var attempts=0
        let owner=NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true},activateSession:{
            attempts += 1;if fail {throw NSError(domain:"test",code:1)}
        })
        defer{owner.dispose()};owner.setMenu()
        NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
        let paused=transport.commands.count;owner.setJourneyGameplay()
        XCTAssertEqual(transport.commands.count,paused)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.plays.last?["source"] as? String,NativeSoundtrackRouteOwner.gameplaySource)
        fail=true;owner.setMenu();owner.apply(enabled:false)
        let disabled=attempts
        try await Task.sleep(for:.milliseconds(250));XCTAssertEqual(attempts,disabled)
    }
    private final class Transport:NativeSoundtrackTransport {
        var commands:[String] = []
        var volumes:[Double] = []
        var plays:[[String:Any]]=[]
        var failedStarts=0
        var deferFade=false
        var fadeReplies:[(Any?,String?)->Void]=[]
        func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void) {
            XCTAssertEqual(id,"soundtrack-native-main")
            if let volume=body["volume"] as? Double {volumes.append(volume)}
            if op=="play" {plays.append(body)}
            commands.append(op)
            if (op == "play" || op == "resume"),failedStarts>0 {failedStarts -= 1;replyHandler(nil,"Transient engine start failure");return}
            if deferFade,body["replyOnFadeFinished"] as? Bool==true {fadeReplies.append(replyHandler);return}
            replyHandler(["position":12.5],nil)
        }
    }
}
