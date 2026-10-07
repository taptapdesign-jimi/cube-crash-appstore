import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeBoardTransitionAudioTests:XCTestCase {
    private final class Transport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[],stopped:[Set<String>]=[]
        func play(_ cue:NativeAudioCue){cues.append(cue)}
        func stopVoices(_ ids:Set<String>){stopped.append(ids)}
        func stopAll(){}
        func dispose(){}
    }
    func testDigitEnterUsesBoardIdentitiesAndExitAccentWithAuthoredGain() {
        let t=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
        owner.transitionMoment("digit",index:0,receipt:1,generation:1)
        owner.transitionMoment("digit",index:1,receipt:2,generation:1)
        XCTAssertEqual(t.cues.map(\.voice),["board-transition-first-digit","board-transition-exit","board-transition-second-digit"])
        XCTAssertEqual(t.cues.map(\.source),["assets/sound/NN tranzicije/bum bum zvuk.wav","assets/sound/NN tranzicije/exit.wav","assets/sound/NN tranzicije/bum bum 2.wav"])
        XCTAssertTrue(t.cues.allSatisfy{$0.gain==0.42 && $0.rate==1 && $0.delay==0})
        owner.dispose()
    }
    func testActualBeamLayersRetainShotAndSequenceIdentityAndAbortCancelsPendingFly2() {
        let t=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
        owner.transitionMoment("area55-start",receipt:1,generation:1)
        owner.transitionMoment("area55-beam",index:1,receipt:2,generation:1)
        owner.transitionMoment("area55-beam",index:2,receipt:3,generation:1)
        owner.transitionMoment("digit",receipt:4,generation:1)
        let beams=t.cues.filter{$0.voice.contains("-beam-")}
        XCTAssertEqual(beams.count,6);XCTAssertEqual(Set(beams.map(\.voice)).count,6)
        XCTAssertEqual(beams.map(\.gain),[0.3,0.3,0.09,0.3,0.3,0.09])
        XCTAssertEqual(t.cues.first{$0.voice.contains("fly2")}?.delay,3)
        owner.finishTransition(generation:1,aborted:false)
        XCTAssertEqual(t.stopped.last,["board-transition-first-digit","board-transition-exit"])
        owner.finishTransition(generation:1,aborted:true)
        XCTAssertTrue(t.stopped.last!.contains{$0.contains("fly2")})
        XCTAssertTrue(Set(beams.map(\.voice)).isSubset(of:t.stopped.last!))
        owner.transitionMoment("area55-start",receipt:5,generation:1)
        owner.transitionMoment("area55-beam",index:1,receipt:6,generation:1)
        XCTAssertTrue(t.cues.contains{$0.voice=="board-transition-area55-beam-1-2-gun-beam1"})
        XCTAssertFalse(t.cues.contains{$0.voice=="board-transition-area55-beam-2-2-gun-beam1"})
        owner.dispose()
    }
    func testMuteBackgroundStaleAndDuplicateContactsNeverReplay() {
        let t=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:false,transport:t)
        owner.transitionMoment("digit",receipt:1,generation:1);owner.setEnabled(true)
        owner.transitionMoment("digit",receipt:1,generation:1)
        owner.setForeground(false);owner.transitionMoment("forest-start",receipt:2,generation:1)
        owner.setForeground(true);owner.transitionMoment("forest-start",receipt:2,generation:1)
        owner.beginGeneration(2);owner.transitionMoment("digit",receipt:3,generation:1)
        XCTAssertTrue(t.cues.isEmpty)
        owner.transitionMoment("forest-start",receipt:1,generation:2)
        XCTAssertEqual(t.cues,NativeAuthoredAudioCatalog.groups["forestTransition"])
        owner.dispose();owner.transitionMoment("digit",receipt:2,generation:2)
        XCTAssertEqual(t.cues.count,2)
    }
}
