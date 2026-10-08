import XCTest
@testable import Stack_to_Six

nonisolated final class NativeWildMeterDropAudioTests:XCTestCase {
    @MainActor private final class Transport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[],stops:[Set<String>]=[];var globalStops=0
        func play(_ cue:NativeAudioCue){cues.append(cue)}
        func stopVoices(_ ids:Set<String>){stops.append(ids)}
        func stopAll(){globalStops += 1}
        func dispose(){stopAll()}
    }
    @MainActor
    func testCarrierLayersKeepOriginalFamilyAndCapturedStopExcludesOtherCues() async {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer {owner.dispose()}
        let stopBackpack=owner.beginMeterCarrierAudio(arcade:false,id:"first",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,2)
        XCTAssertEqual(transport.cues.map(\.gain),[0.576,0.18]);XCTAssertEqual(transport.cues.map(\.rate),[1.4,2.1])
        XCTAssertEqual(transport.cues.map(\.delay),[0,0.2])
        let backpackIDs=Set(transport.cues.map(\.voice))
        let stopCrate=owner.beginMeterCarrierAudio(arcade:true,id:"second",receipt:2,generation:1)
        let crate=Array(transport.cues.dropFirst(2))
        XCTAssertEqual(crate.count,4);XCTAssertEqual(crate.map(\.gain),[0.25536,0.19152,0.12768,0.22344])
        XCTAssertEqual(crate.map(\.delay),[0,0.3,0.6,0.8]);XCTAssertTrue(crate.allSatisfy{$0.rate==1.4})
        owner.specialMoment(variant:"fish",moment:"landing",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.last?.source,"assets/sound/sfx/bag drop.wav")
        stopBackpack();stopBackpack()
        XCTAssertEqual(transport.stops,[backpackIDs]);XCTAssertEqual(transport.globalStops,0)
        stopCrate();XCTAssertEqual(transport.stops.count,2)
        XCTAssertFalse(transport.stops.last?.contains("wild-special-landing") ?? true)
    }
    @MainActor
    func testMuteBackgroundAndOldCaptureNeverReplayOrStopReplacement() async {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:false,transport:transport)
        defer {owner.dispose()}
        _=owner.beginMeterCarrierAudio(arcade:false,id:"off",receipt:1,generation:1)
        owner.setEnabled(true)
        _=owner.beginMeterCarrierAudio(arcade:false,id:"off",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,0)
        let old=owner.beginMeterCarrierAudio(arcade:false,id:"old",receipt:2,generation:1)
        owner.beginGeneration(2)
        let current=owner.beginMeterCarrierAudio(arcade:false,id:"current",receipt:1,generation:2)
        old();XCTAssertEqual(transport.stops.count,0)
        owner.setForeground(false)
        let count=transport.cues.count
        _=owner.beginMeterCarrierAudio(arcade:true,id:"hidden",receipt:2,generation:2)
        owner.setForeground(true)
        _=owner.beginMeterCarrierAudio(arcade:true,id:"hidden",receipt:2,generation:2)
        XCTAssertEqual(transport.cues.count,count)
        current();XCTAssertEqual(transport.stops.count,1)
    }
}
