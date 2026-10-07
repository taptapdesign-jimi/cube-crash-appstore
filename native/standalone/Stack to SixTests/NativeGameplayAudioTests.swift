import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeGameplayAudioTests:XCTestCase {
    private final class Transport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[];var stops=0;var disposals=0
        var finishes:[String:(NativeAudioCompletion)->Void]=[:]
        var fadeValues:[Double]=[]
        func captureFade(_ ids:Set<String>)->((Double)->Void)? { { [weak self] value in self?.fadeValues.append(value) } }
        func play(_ cue:NativeAudioCue) {cues.append(cue)}
        func play(_ cue:NativeAudioCue,onFinished:@escaping (NativeAudioCompletion)->Void){if let old=finishes.removeValue(forKey:cue.voice){old(.stopped)};play(cue);finishes[cue.voice]=onFinished}
        func finish(_ id:String,_ reason:NativeAudioCompletion){finishes.removeValue(forKey:id)?(reason)}
        func stopAll() {stops += 1;let callbacks=Array(finishes.values);finishes.removeAll();callbacks.forEach{$0(.stopped)}}
        func dispose() {disposals += 1;stopAll()}
    }
    private func tile(_ archetype:NativeWildArchetype?=nil,variant:String?=nil)->NativeTile {
        NativeTile(id:"source",cell:.init(column:0,row:0),value:archetype == nil ? 3 : 6,archetype:archetype,variant:variant)
    }
    func testOrdinaryLayersPreserveSourceGainRateAndCrashCut() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        owner.onGameplayEvent(.init(.merged,value:4),generation:1,receipt:1)
        XCTAssertEqual(transport.cues.map(\.source),["assets/sound/merge 6/wood.wav","assets/sound/merge 6/stack.mp3"])
        XCTAssertEqual(transport.cues[0].gain,0.2304,accuracy:0.000001);XCTAssertEqual(transport.cues[0].rate,1.5)
        transport.cues.removeAll();owner.onGameplayEvent(.init(.merged,value:6),source:tile(),destination:tile(),generation:1,receipt:2)
        XCTAssertEqual(transport.cues.count,4)
        let crash=transport.cues.first{$0.voice=="regular-merge6-crash"}!
        XCTAssertEqual(crash.stopAfter,0.892);XCTAssertEqual(crash.fadeOut,0.12)
        owner.dispose()
    }
    func testOrdinarySixAudioBelongsToContactAndNotItsDelayedCounterCommit() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        owner.onGameplayEvent(.init(.ordinarySixReserved,tileIDs:["a","b"],value:6,reason:"six-1"),generation:1,receipt:1)
        XCTAssertEqual(transport.cues.count,4)
        owner.onGameplayEvent(.init(.merged,tileIDs:["a","b"],value:6,reason:"six-1"),generation:1,receipt:2)
        XCTAssertEqual(transport.cues.count,4)
        owner.setEnabled(false)
        owner.onGameplayEvent(.init(.ordinarySixReserved,tileIDs:["c","d"],value:6,reason:"six-2"),generation:1,receipt:3)
        owner.setEnabled(true)
        owner.onGameplayEvent(.init(.merged,tileIDs:["c","d"],value:6,reason:"six-2"),generation:1,receipt:4)
        XCTAssertEqual(transport.cues.count,4)
        owner.beginGeneration(2)
        owner.onGameplayEvent(.init(.ordinarySixReserved,value:6,reason:"six-3"),generation:2,receipt:1)
        XCTAssertEqual(transport.cues.count,8)
        owner.onGameplayEvent(.init(.merged,value:6,reason:"six-3"),generation:1,receipt:5)
        XCTAssertEqual(transport.cues.count,8);owner.dispose()
    }
    func testLaserPreparationAndBeamKeepActualShotScopedVoicesInsteadOfReplacingShotZero() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        for index in 0..<4 {
            owner.specialMoment(variant:"laser-gun",moment:"prepare",index:index,receipt:UInt64(index*2+1),generation:1)
            owner.specialMoment(variant:"laser-gun",moment:"beam",index:index,receipt:UInt64(index*2+2),generation:1)
        }
        XCTAssertEqual(transport.cues.count,12);XCTAssertEqual(Set(transport.cues.map(\.voice)).count,12)
        XCTAssertTrue(transport.cues.contains{$0.voice=="laser-gun-stage-preparation-3"})
        XCTAssertTrue(transport.cues.contains{$0.voice=="laser-gun-beam-3-beam1"})
        XCTAssertTrue(transport.cues.contains{$0.voice=="laser-gun-beam-3-beam2"})
        owner.dispose()
    }
    func testKantaFadeCapturesOnlyOriginalNativeVoiceIdentitiesAndDeferredGains() {
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"))
        transport.play(NativeAudioCue(source:"assets/sound/bibis.wav",voice:"kanta-merge6-bibis",gain:0.30))
        transport.play(NativeAudioCue(source:"assets/sound/walking.wav",voice:"kanta-walking-1",gain:0.18))
        let fade=transport.captureFade(["kanta-merge6-bibis","kanta-walking-1"])!
        fade(0.5)
        XCTAssertEqual(transport.scheduledGain(for:"kanta-merge6-bibis")!,0.15,accuracy:0.000001)
        XCTAssertEqual(transport.scheduledGain(for:"kanta-walking-1")!,0.09,accuracy:0.000001)
        // A later committed Kanta replaces bibis; the original finale's
        // captured fade can retire its walking, but must leave new bibis.
        transport.play(NativeAudioCue(source:"assets/sound/bibis.wav",voice:"kanta-merge6-bibis",gain:0.30))
        fade(1)
        XCTAssertEqual(transport.scheduledVoiceCount,1)
        XCTAssertEqual(transport.scheduledGain(for:"kanta-merge6-bibis")!,0.30,accuracy:0.000001)
        XCTAssertEqual(transport.openedFileCount,0);transport.dispose()
    }
    func testKantaCapturedFadeClampsProgressAndRejectsMutedBackgroundOrReplacedGeneration() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        owner.specialMoment(variant:"kanta",moment:"walking",receipt:1,generation:1)
        let fade=owner.captureSpecialFade(variant:"kanta",generation:1)!
        fade(-1);fade(2);XCTAssertEqual(transport.fadeValues,[0,1])
        owner.setForeground(false);fade(0.5);XCTAssertEqual(transport.fadeValues,[0,1])
        owner.setForeground(true);owner.beginGeneration(2);fade(0.5);XCTAssertEqual(transport.fadeValues,[0,1])
        owner.setEnabled(false);XCTAssertNil(owner.captureSpecialFade(variant:"kanta",generation:2));owner.dispose()
    }
    func testSpecialIdentitySelectsAuthoredFamilyAndPreservesFishMidpoint() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,random:{0})
        owner.onGameplayEvent(.init(.merged,value:6,archetype:.star,variant:"fish"),source:tile(.star,variant:"fish"),destination:tile(),generation:1,receipt:1)
        XCTAssertTrue(transport.cues.contains{$0.source.hasSuffix("fish0.wav")})
        XCTAssertEqual(transport.cues.first{$0.source.hasSuffix("fish2.wav")}?.delay,1.8)
        XCTAssertFalse(transport.cues.contains{$0.voice=="wild-star-merge6-magic"})
        transport.cues.removeAll()
        owner.onGameplayEvent(.init(.merged,value:6,archetype:.magnet,variant:"honey"),source:tile(.magnet,variant:"honey"),destination:tile(),generation:1,receipt:2)
        XCTAssertTrue(transport.cues.contains{$0.source.contains("honey/")})
        XCTAssertEqual(transport.cues.first{$0.voice=="regular-merge6-primary"}?.gain,0.195)
        owner.dispose()
    }
    func testAllFourCoreStarVariantsChosenOnceAtCommittedContact() {
        for (index,roll) in [0.01,0.26,0.51,0.76].enumerated() {
            let transport=Transport();var randomCalls=0
            let owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,random:{randomCalls += 1;return roll})
            owner.onGameplayEvent(.init(.merged,value:6,archetype:.star),source:tile(.star),destination:tile(),generation:1,receipt:1)
            owner.onGameplayEvent(.init(.merged,value:6,archetype:.star),source:tile(.star),destination:tile(),generation:1,receipt:1)
            XCTAssertEqual(randomCalls,1)
            XCTAssertEqual(transport.cues,NativeAuthoredAudioCatalog.groups["poof"]!+NativeAuthoredAudioCatalog.groups["star\(index)"]!)
            owner.dispose()
        }
    }
    func testMuteConsumesReceiptAndForegroundDoesNotReplayOldTransients() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:false,transport:transport)
        owner.routeFeedback("cta",receipt:1,generation:1);owner.setEnabled(true)
        owner.routeFeedback("cta",receipt:1,generation:1);XCTAssertTrue(transport.cues.isEmpty)
        owner.routeFeedback("tab",receipt:2,generation:1);XCTAssertEqual(transport.cues.count,2)
        owner.setForeground(false);let count=transport.cues.count
        owner.resultMoment("fail-sax",receipt:1,generation:1);owner.setForeground(true)
        owner.resultMoment("fail-sax",receipt:1,generation:1);XCTAssertEqual(transport.cues.count,count)
        owner.setEnabled(false);owner.setEnabled(true);owner.setEnabled(false);XCTAssertGreaterThanOrEqual(transport.stops,3)
        owner.dispose()
    }
    func testGenerationStopAndDisposeRejectStaleVisualCallbacks() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        owner.beginGeneration(8);owner.specialMoment(variant:"flower",moment:"spark",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
        owner.specialMoment(variant:"flower",moment:"spark",receipt:1,generation:8);XCTAssertFalse(transport.cues.isEmpty)
        let count=transport.cues.count;owner.stop()
        owner.specialMoment(variant:"flower",moment:"leaves",receipt:2,generation:8);XCTAssertEqual(transport.cues.count,count)
        owner.dispose();owner.dispose();owner.beginGeneration(20);owner.routeFeedback("cta",receipt:1,generation:20)
        XCTAssertEqual(transport.disposals,1);XCTAssertEqual(transport.cues.count,count)
    }
    func testNoMovesUsesVisibleResultMomentAndResultsStayDistinct() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,random:{0.99})
        owner.onGameplayEvent(.init(.noMovesCandidate),generation:1,receipt:1);XCTAssertTrue(transport.cues.isEmpty)
        owner.resultMoment("no-moves",receipt:1,generation:1)
        let noMoves=transport.cues.map(\.source);transport.cues.removeAll()
        owner.resultMoment("fail-sax",receipt:2,generation:1)
        XCTAssertNotEqual(noMoves,transport.cues.map(\.source))
        XCTAssertTrue(transport.cues.contains{$0.source.hasSuffix("six fail.wav")})
        transport.cues.removeAll();owner.resultMoment("clean-star",index:2,receipt:3,generation:1)
        XCTAssertTrue(transport.cues.contains{$0.source.hasSuffix("harp3.wav")});owner.dispose()
    }
    func testTntUsesUniqueAuthoredPoolWithSlotSpecificGainAndKantaIndependentChoices() {
        let transport=Transport();var rolls=[0.01,0.01,0.01,0.01,0.01,0.75,0.76,0.25]
        let owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,random:{rolls.isEmpty ? 0 : rolls.removeFirst()})
        owner.onGameplayEvent(.init(.merged,value:6,archetype:.tnt),source:tile(.tnt),destination:tile(),generation:1,receipt:1)
        transport.cues.removeAll()
        for index in 0..<4 {owner.specialMoment(variant:"tnt",moment:"impact",index:index,receipt:UInt64(index+1),generation:1)}
        XCTAssertEqual(Set(transport.cues.map(\.source)).count,4)
        XCTAssertEqual(transport.cues[0].gain,0.144,accuracy:0.000001) // mini2 at first-slot half gain
        XCTAssertEqual(transport.cues[3].gain,0.15,accuracy:0.000001) // mini5 independent quiet gain
        transport.cues.removeAll()
        owner.specialMoment(variant:"kanta",moment:"exit",receipt:5,generation:1)
        owner.specialMoment(variant:"kanta",moment:"exit",receipt:6,generation:1)
        XCTAssertNotEqual(transport.cues[0].voice,transport.cues[1].voice)
        XCTAssertNotEqual(transport.cues[0].source,transport.cues[1].source)
        XCTAssertEqual(transport.cues[0].gain,0.273,accuracy:0.000001)
        XCTAssertEqual(transport.cues[1].gain,0.2184,accuracy:0.000001)
        owner.dispose()
    }
    func testSharedTntPoolPreservesEachVariantAndLaserFinalChangedCubeLayers() {
        for variant in ["flower","beach-ball","barell","laser-gun"] {
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,random:{0})
            owner.onGameplayEvent(.init(.merged,value:6,archetype:.tnt,variant:variant),source:tile(.tnt,variant:variant),destination:tile(),generation:1,receipt:1)
            transport.cues.removeAll()
            for index in 0..<4 {owner.specialMoment(variant:variant,moment:"impact",index:index,receipt:UInt64(index+1),generation:1)}
            let impacts=transport.cues.filter{$0.voice.hasPrefix("core-tnt-bonus-impact-")}
            XCTAssertEqual(impacts.count,4);XCTAssertEqual(Set(impacts.map(\.source)).count,4)
            if variant=="laser-gun" {XCTAssertGreaterThan(transport.cues.count,4)}else{XCTAssertEqual(transport.cues.count,4)}
            owner.dispose()
        }
    }
    func testCleanStarOrderRotatesAnOtherwiseIdenticalNextResult() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,random:{0.99})
        func result(_ base:UInt64)->[String] {
            owner.resultMoment("clean-applause",receipt:base,generation:1);transport.cues.removeAll()
            for index in 0..<3 {owner.resultMoment("clean-star",index:index,receipt:base+UInt64(index+1),generation:1)}
            let result=transport.cues.filter{$0.source.contains("/harp")}.map(\.source);transport.cues.removeAll();return result
        }
        let first=result(1),second=result(5)
        XCTAssertEqual(Set(first).count,3);XCTAssertEqual(Set(first),Set(second));XCTAssertNotEqual(first,second)
        owner.dispose()
    }
    func testResultHookOnlyFollowsAuthoredSaxAndEveryRetirementReleasesExactlyOnce() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport);var releases=0
        owner.resultMoment("clean-sax",receipt:1,generation:1,onFinished:{releases += 1})
        owner.resultMoment("clean-applause",receipt:2,generation:1)
        XCTAssertEqual(releases,0);XCTAssertEqual(Set(transport.finishes.keys),["clean-board-saxophone-happy"])
        let ended=transport.finishes["clean-board-saxophone-happy"]!;transport.finish("clean-board-saxophone-happy",.ended);ended(.stopped);XCTAssertEqual(releases,1)
        owner.resultMoment("fail-sax",receipt:3,generation:1,onFinished:{releases += 1});owner.setForeground(false);XCTAssertEqual(releases,2)
        owner.setForeground(true);owner.resultMoment("fail-sax",receipt:4,generation:1,onFinished:{releases += 1});owner.setEnabled(false);XCTAssertEqual(releases,3)
        owner.resultMoment("fail-sax",receipt:5,generation:1,onFinished:{releases += 1});XCTAssertEqual(releases,4)
        owner.dispose();XCTAssertEqual(releases,4)
    }
    func testNativeSaxReceiptEndsForUnavailableAndCancelledDeferredVoice() async throws {
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"));var reasons:[NativeAudioCompletion]=[]
        transport.play(.init(source:"assets/sound/missing.wav",voice:"unavailable",gain:0.1)){reasons.append($0)}
        try await Task.sleep(for:.milliseconds(50));XCTAssertEqual(reasons,[.unavailable])
        transport.play(.init(source:"assets/sound/missing.wav",voice:"delayed",gain:0.1,delay:2)){reasons.append($0)}
        transport.stopAll();transport.stopAll();try await Task.sleep(for:.milliseconds(50));XCTAssertEqual(reasons,[.unavailable,.stopped]);transport.dispose()
    }
    func testNativeActualFiniteVoiceCompletionIsSingleAndDoesNotUseVisualTimer() async throws {
        let root=FileManager.default.temporaryDirectory.appendingPathComponent("NativeAudioEnd-\(UUID().uuidString)"),folder=root.appendingPathComponent("assets/sound")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:root)}
        var wav=Data("RIFF".utf8)
        func little<T:FixedWidthInteger>(_ value:T){var bits=value.littleEndian;wav.append(Data(bytes:&bits,count:MemoryLayout<T>.size))}
        little(UInt32(36+640));wav.append(Data("WAVEfmt ".utf8));little(UInt32(16));little(UInt16(1));little(UInt16(1));little(UInt32(8000));little(UInt32(16000));little(UInt16(2));little(UInt16(16));wav.append(Data("data".utf8));little(UInt32(640));wav.append(Data(repeating:0,count:640))
        try wav.write(to:folder.appendingPathComponent("finite.wav"));let transport=NativeAVGameplayAudioTransport(root:root);var endings:[NativeAudioCompletion]=[]
        let ended=expectation(description:"Actual native file-end receipt")
        transport.play(.init(source:"assets/sound/finite.wav",voice:"authored-end",gain:0.1)){endings.append($0);ended.fulfill()}
        await fulfillment(of:[ended],timeout:1.5)
        XCTAssertEqual(endings,[.ended]);XCTAssertEqual(transport.scheduledVoiceCount,0)
        transport.stopAll();transport.dispose();XCTAssertEqual(endings,[.ended])
    }
    func testNativeTransportCancelsDeferredFileOpenAndBoundsPendingVoices() async throws {
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"))
        transport.play(.init(source:"assets/sound/unavailable.wav",voice:"delayed",gain:0.2,delay:2))
        XCTAssertEqual(transport.scheduledVoiceCount,1);XCTAssertEqual(transport.openedFileCount,0)
        transport.stopAll();try await Task.sleep(for:.milliseconds(40))
        XCTAssertEqual(transport.scheduledVoiceCount,0);XCTAssertEqual(transport.openedFileCount,0)
        for index in 0..<40 {transport.play(.init(source:"assets/sound/unavailable.wav",voice:"voice\(index)",gain:0.2,delay:2))}
        XCTAssertEqual(transport.scheduledVoiceCount,32)
        transport.dispose();transport.dispose();XCTAssertEqual(transport.scheduledVoiceCount,0)
    }
}
