import XCTest
import UIKit
import AVFAudio
@testable import Stack_to_Six

@MainActor
final class NativeBoardTransitionMusicTests:XCTestCase {
    private final class Transport:NativeSoundtrackTransport {
        struct Command {let op:String,body:[String:Any]}
        var commands:[Command]=[],callbacks:[(Any?,String?)->Void]=[]
        func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void){XCTAssertEqual(id,"soundtrack-native-main");commands.append(.init(op:op,body:body));if body["replyOnFadeFinished"] as? Bool==true{callbacks.append(replyHandler)}else{replyHandler(["playing":true],nil)}}
    }
    private func make(_ transport:Transport)->NativeSoundtrackRouteOwner {NativeSoundtrackRouteOwner(root:URL(fileURLWithPath:"/unused"),transport:transport,isApplicationActive:{true})}
    func testSourceThreePhaseMixUsesOneThemeAndActualFadeReceiptForSoftTailThenGameplayLift() {
        for row in NativeTransitionMusicOracle.rows {
        let transport=Transport(),owner=make(transport);owner.setMenu();transport.commands.removeAll()
        owner.boardTransitionPhase("begin",ratio:0.62,duration:row.phases[0].duration,generation:9)
        owner.boardTransitionPhase("hold",ratio:0.5,duration:row.phases[1].duration,generation:9)
        owner.boardTransitionPhase("exit",ratio:0.2,duration:row.phases[2].duration-0.32,generation:9)
        XCTAssertEqual(transport.commands.map(\.op),["volume","volume","volume"])
        for (command,expected) in zip(transport.commands,row.phases) {
            XCTAssertEqual(command.body["volume"] as! Double,expected.gain,accuracy:0.00000001,row.theme)
            XCTAssertEqual(command.body["duration"] as! Double,expected.duration,accuracy:0.00000001,row.theme)
        }
        XCTAssertEqual(transport.callbacks.count,1)
        owner.boardTransitionPhase("complete",ratio:0.33,duration:0.32,generation:9)
        owner.setJourneyGameplay();XCTAssertEqual(transport.commands.count,3);XCTAssertTrue(owner.hasBoardTransitionEnvelope)
        transport.callbacks.removeFirst()([:],nil)
        XCTAssertEqual(transport.commands.last!.body["volume"] as! Double,row.phases[3].gain,accuracy:0.00000001)
        XCTAssertEqual(transport.commands.last!.body["duration"] as! Double,row.phases[3].duration)
        XCTAssertTrue(owner.hasBoardTransitionEnvelope)
        transport.callbacks.removeFirst()([:],nil);XCTAssertFalse(owner.hasBoardTransitionEnvelope);owner.dispose()
        }
    }
    func testCancelledStaleAndMutedTailReceiptsCannotRestoreAnotherRoute() {
        let transport=Transport(),owner=make(transport);owner.setMenu()
        owner.boardTransitionPhase("begin",ratio:0.62,duration:2.35,generation:9)
        owner.boardTransitionPhase("exit",ratio:0.2,duration:1.516,generation:9)
        let stale=transport.callbacks.removeFirst();owner.setMenu();let count=transport.commands.count
        stale([:],nil);owner.boardTransitionPhase("complete",ratio:0.33,duration:0.32,generation:9)
        XCTAssertEqual(transport.commands.count,count)
        owner.boardTransitionPhase("begin",ratio:0.62,duration:1.35,generation:10)
        owner.boardTransitionPhase("exit",ratio:0.2,duration:1.581,generation:10)
        let muted=transport.callbacks.removeFirst();owner.apply(enabled:false);let offCount=transport.commands.count
        muted([:],nil);XCTAssertEqual(transport.commands.count,offCount);XCTAssertFalse(owner.hasBoardTransitionEnvelope)
        owner.dispose()
    }
    func testSourceBackgroundRetiresEnvelopeAt33PercentAndDoesNotReplayOldPhase() {
        let transport=Transport(),owner=make(transport);owner.setMenu()
        owner.boardTransitionPhase("begin",ratio:0.62,duration:1.35,generation:9)
        owner.boardTransitionPhase("exit",ratio:0.2,duration:2.031,generation:9)
        let stale=transport.callbacks.removeFirst()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertFalse(owner.hasBoardTransitionEnvelope);let count=transport.commands.count
        stale([:],nil);owner.boardTransitionPhase("complete",ratio:0.33,duration:0.32,generation:9)
        XCTAssertEqual(transport.commands.count,count)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(transport.commands.suffix(2).map(\.op),["resume","volume"])
        XCTAssertEqual(transport.commands.last!.body["volume"] as! Double,0.19074,accuracy:0.00000001)
        XCTAssertEqual(transport.commands.last!.body["duration"] as! Double,0.42)
        owner.dispose()
    }
    func testActualNativeTransportDeferredFadeReplyCompletesOnceAndReplacementCancels() async throws {
        let root=FileManager.default.temporaryDirectory.appendingPathComponent("native-transition-music-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:root)}
        let relative="assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav",url=root.appendingPathComponent(relative)
        try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
        let format=try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate:48000,channels:1))
        do {let file=try AVAudioFile(forWriting:url,settings:format.settings),buffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:format,frameCapacity:48000));buffer.frameLength=48000
            memset(buffer.floatChannelData![0],0,48000*MemoryLayout<Float>.size);try file.write(from:buffer)}
        try AVAudioSession.sharedInstance().setCategory(JimiNativeMusic.sessionCategory);try AVAudioSession.sharedInstance().setActive(true)
        let transport=JimiNativeMusic(root:root)
        defer{transport.dispose()}
        var playError:String?
        transport.perform(id:"soundtrack-native-main",op:"play",body:["source":relative,"volume":0.2,"position":0,"loop":true,"loopStart":0,"loopEnd":1]){_,error in playError=error}
        XCTAssertNil(playError)
        let ended=expectation(description:"Existing native voice fade-end receipt"),cancelled=expectation(description:"Replacement retires previous fade")
        var callbacks=0
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":0.1,"duration":0.04,"replyOnFadeFinished":true]){_,error in XCTAssertNil(error);callbacks += 1;ended.fulfill()}
        XCTAssertEqual(callbacks,0)
        await fulfillment(of:[ended],timeout:1.5);XCTAssertEqual(callbacks,1)
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":0.2,"duration":1,"replyOnFadeFinished":true]){_,error in XCTAssertEqual(error,"Native fade cancelled");callbacks += 1;cancelled.fulfill()}
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":0.15,"duration":0]){_,error in XCTAssertNil(error)}
        await fulfillment(of:[cancelled],timeout:1.5);XCTAssertEqual(callbacks,2)
    }
}
