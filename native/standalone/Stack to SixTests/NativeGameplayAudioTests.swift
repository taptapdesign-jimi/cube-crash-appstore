import XCTest
import UIKit
import AVFAudio
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeGameplayAudioTests:XCTestCase {
    func testArcadeHomeThreeChoicesNeverRepeatAndRemainIndependentFromModalHistory() {
        for first in 0..<3 {
            var roll=(Double(first)+0.1)/3;var cues:[NativeAudioCue]=[],tails:[Transport]=[]
            let main=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{let tail=Transport();tail.onPlay={cues.append($0)};tails.append(tail);return tail},random:{roll})
            owner.routeFeedback("home-arcade-character-tap",receipt:1,generation:1)
            XCTAssertTrue(cues.last!.source.hasSuffix("arcade-0\(first+1).wav"))
            owner.routeFeedback("home-arcade-character-tap",receipt:1,generation:1)
            owner.routeFeedback("home-arcade-character-tap",receipt:2,generation:99)
            XCTAssertEqual(cues.count,1)
            for receipt in 2...12 {
                roll=receipt%2 == 0 ? 0:0.99
                owner.routeFeedback("home-arcade-character-tap",receipt:UInt64(receipt),generation:1)
                XCTAssertNotEqual(cues[cues.count-1].source,cues[cues.count-2].source)
                XCTAssertEqual(tails[tails.count-2].disposals,1)
            }
            XCTAssertEqual(main.cues.count,12,"Nala once per accepted contact")
            XCTAssertTrue(main.cues.allSatisfy{$0.voice.hasPrefix("native-home-nala-")})
            XCTAssertTrue(main.cues.allSatisfy{$0.gain==0.42},"Nala retains the original mix")
            XCTAssertTrue(cues.allSatisfy{$0.gain==0.72 && $0.rate==1 && $0.stopAfter==nil})
            for cue in cues {XCTAssertTrue(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent(cue.source).path))}
            let previous=cues.last!.source;owner.stop();owner.beginGeneration(7)
            owner.routeFeedback("high-score-modal-speech",receipt:1,generation:7)
            owner.routeFeedback("home-arcade-character-tap",receipt:2,generation:7)
            XCTAssertNotEqual(cues.last?.source,previous)
            owner.dispose()
        }
    }
    func testArcadeHomeSpeechSettingsGatesReplacementAndActualEnd() {
        let main=Transport(),first=Transport(),second=Transport();var starts=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{starts += 1;if starts==2 {XCTAssertEqual(first.disposals,1)};return starts==1 ? first:second},random:{0})
        owner.routeFeedback("home-journey-character-tap",receipt:1,generation:1)
        let human=main.cues.first{$0.voice.hasPrefix("native-home-human-")}!
        owner.routeFeedback("home-arcade-character-tap",receipt:2,generation:1)
        XCTAssertEqual(main.stopped,[human.voice]);XCTAssertEqual(main.stops,0)
        let stale=first.finishes[first.cues[0].voice]!
        owner.routeFeedback("home-arcade-character-tap",receipt:3,generation:1);stale(.ended)
        XCTAssertEqual(second.disposals,0)
        owner.stop();owner.beginGeneration(7);XCTAssertEqual(second.disposals,0)
        second.finish(second.cues[0].voice,.ended);XCTAssertEqual(second.disposals,1)
        owner.dispose()
        for boundary in 0..<6 {
            let tail=Transport(),subject=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{0})
            subject.routeFeedback("home-arcade-character-tap",receipt:1,generation:1)
            switch boundary {
            case 0:subject.setEnabled(false);subject.routeFeedback("home-arcade-character-tap",receipt:2,generation:1);subject.setEnabled(true);subject.routeFeedback("home-arcade-character-tap",receipt:2,generation:1)
            case 1:subject.setForeground(false);subject.routeFeedback("home-arcade-character-tap",receipt:2,generation:1);subject.setForeground(true);subject.routeFeedback("home-arcade-character-tap",receipt:2,generation:1)
            case 2:NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
            case 3:NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)
            case 4:tail.finish(tail.cues[0].voice,.unavailable)
            default:subject.dispose()
            }
            subject.routeFeedback("home-arcade-character-tap",receipt:1,generation:1)
            XCTAssertEqual(tail.cues.count,1);XCTAssertEqual(tail.disposals,1);subject.dispose()
        }
    }
    func testScoreComboExactPoolsExcludePreviousAndKeepIndependentHistoryAcrossGenerations() {
        for (kind,prefix) in [("high-score-modal-speech","high-score"),("combo-modal-speech","combo")] {
            for first in 0..<3 {
                var roll=(Double(first)+0.1)/3;var played:[NativeAudioCue]=[]
                let subject=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{let t=Transport();t.onPlay={played.append($0)};return t},random:{roll})
                subject.routeFeedback(kind,receipt:1,generation:1)
                XCTAssertEqual(played.last?.source,"assets/sound/SPEECH/\(prefix)-0\(first+1).wav")
                subject.routeFeedback(kind,receipt:1,generation:1);subject.routeFeedback(kind,receipt:2,generation:99);XCTAssertEqual(played.count,1)
                for opening in 2...15 {
                    roll=opening%2 == 0 ? 0:0.99
                    subject.routeFeedback(kind,receipt:UInt64(opening),generation:1)
                    XCTAssertNotEqual(played[played.count-1].source,played[played.count-2].source)
                    XCTAssertTrue(played.last!.source.contains("/\(prefix)-"))
                }
                let previous=played.last!.source
                subject.stop();subject.beginGeneration(7);subject.routeFeedback(kind,receipt:1,generation:7)
                XCTAssertNotEqual(played.last?.source,previous)
                XCTAssertTrue(played.allSatisfy{$0.gain==0.72 && $0.rate==1 && $0.stopAfter==nil})
                for cue in played {XCTAssertTrue(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent(cue.source).path))}
                subject.dispose()
            }
        }
        var sources:[String]=[]
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{let t=Transport();t.onPlay={sources.append($0.source)};return t},random:{0})
        owner.routeFeedback("high-score-modal-speech",receipt:1,generation:1)
        owner.routeFeedback("combo-modal-speech",receipt:2,generation:1)
        owner.routeFeedback("high-score-modal-speech",receipt:3,generation:1)
        XCTAssertEqual(sources.map{URL(fileURLWithPath:$0).lastPathComponent},["high-score-01.wav","combo-01.wav","high-score-02.wav"])
        owner.setEnabled(false);owner.routeFeedback("high-score-modal-speech",receipt:4,generation:1)
        owner.setEnabled(true);owner.routeFeedback("high-score-modal-speech",receipt:4,generation:1);XCTAssertEqual(sources.count,3)
        owner.routeFeedback("high-score-modal-speech",receipt:5,generation:1)
        XCTAssertTrue(sources.last!.hasSuffix("high-score-01.wav"));owner.dispose()
    }
    func testScoreSpeechRetiresExistingCharacterVoicesAndNextModalBeforePlaybackWithoutStoppingSFX() {
        let main=Transport(),world=Transport(),arcade=Transport(),round=Transport(),first=Transport(),second=Transport();var starts=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,arcadeTailFactory:{arcade},roundWonTailFactory:{round},worldTailFactory:{world},navigationSpeechFactory:{starts += 1;if starts==2 {XCTAssertEqual(first.disposals,1)};return starts==1 ? first:second},random:{0.35})
        owner.routeFeedback("home-journey-character-tap",receipt:1,generation:1)
        let human=main.cues.first{$0.voice.hasPrefix("native-home-human-")}!
        owner.routeFeedback("world-hub-forest",receipt:2,generation:1)
        owner.routeFeedback("arcade-island-endurance",receipt:3,generation:1)
        owner.roundWon(receipt:4,generation:1)
        owner.routeFeedback("high-score-modal-speech",receipt:5,generation:1)
        XCTAssertEqual(world.disposals,1);XCTAssertEqual(arcade.disposals,1);XCTAssertEqual(round.disposals,1)
        XCTAssertEqual(main.stopped,[human.voice]);XCTAssertEqual(main.stops,0)
        let stale=first.finishes[first.cues[0].voice]!
        owner.routeFeedback("combo-modal-speech",receipt:6,generation:1);stale(.ended)
        XCTAssertEqual(second.disposals,0);XCTAssertEqual(owner.activeNavigationSpeechCount,1)
        second.finish(second.cues[0].voice,.ended);XCTAssertEqual(second.disposals,1);owner.dispose()
    }
    func testLaterCharacterContactsRetireScoreSpeechAndHardStopsNeverReplayIt() {
        for next in ["world-hub-forest","arcade-island-endurance","home-journey-character-tap","collection-icon-speech","home-settings-character-tap","round-won"] {
            let tail=Transport();var calls=0
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),arcadeTailFactory:{Transport()},roundWonTailFactory:{Transport()},worldTailFactory:{Transport()},navigationSpeechFactory:{calls += 1;return calls==1 ? tail:Transport()})
            owner.routeFeedback("high-score-modal-speech",receipt:1,generation:1)
            if next=="round-won" {owner.roundWon(receipt:2,generation:1)}else{owner.routeFeedback(next,receipt:2,generation:1)}
            XCTAssertEqual(tail.disposals,1);owner.dispose()
        }
        for kind in ["high-score-modal-speech","combo-modal-speech"] {for boundary in 0..<6 {
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail})
            owner.routeFeedback(kind,receipt:1,generation:1)
            switch boundary {
            case 0:owner.setEnabled(false);owner.setEnabled(true)
            case 1:owner.setForeground(false);owner.setForeground(true)
            case 2:NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
            case 3:NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)
            case 4:tail.finish(tail.cues[0].voice,.unavailable)
            default:owner.dispose()
            }
            owner.routeFeedback(kind,receipt:1,generation:1)
            XCTAssertEqual(tail.cues.count,1);XCTAssertEqual(tail.disposals,1);owner.dispose()
        }}
    }
    func testWorldHubThirteenPoolSelectionsConsumeDuplicateMutedAndStaleContacts() {
        for (kind,world,prefix) in [("world-hub-forest",1,"forest-"),("world-hub-space",3,"space-"),("world-hub-beach",2,"beach-")] {
            let count=world == 1 ? 5:4
            for choice in 0..<count {
                let tail=Transport(),main=Transport()
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,worldTailFactory:{tail},random:{(Double(choice)+0.1)/Double(count)})
                owner.routeFeedback(kind,receipt:1,generation:1)
                let expected=NativeAuthoredAudioCatalog.groups["worldSpeech-\(world)-\(choice)"]!.first!
                XCTAssertEqual(tail.cues,[expected]);XCTAssertTrue(main.cues.isEmpty)
                if world == 1,choice == 4 {XCTAssertEqual(expected.source,"assets/sound/SPEECH/world hub /whats wit hthe bees.mp3") }
                else {XCTAssertTrue(URL(fileURLWithPath:expected.source).lastPathComponent.hasPrefix(prefix))}
                XCTAssertTrue(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent(expected.source).path))
                XCTAssertEqual(expected.rate,1);XCTAssertEqual(expected.delay,0);XCTAssertNil(expected.stopAfter)
                owner.routeFeedback(kind,receipt:1,generation:1)
                owner.routeFeedback(kind,receipt:2,generation:99)
                XCTAssertEqual(tail.cues.count,1)
                owner.setEnabled(false);owner.routeFeedback(kind,receipt:2,generation:1)
                owner.setEnabled(true);owner.routeFeedback(kind,receipt:2,generation:1)
                owner.setForeground(false);owner.routeFeedback(kind,receipt:3,generation:1)
                owner.setForeground(true);owner.routeFeedback(kind,receipt:3,generation:1)
                XCTAssertEqual(tail.cues.count,1);XCTAssertEqual(tail.disposals,1)
                owner.dispose()
            }
        }
    }
    func testWorldHubSpeechSurvivesWorldPlayAndReleasesOnActualEnd() {
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),worldTailFactory:{tail},random:{0})
        owner.routeFeedback("world-hub-forest",receipt:1,generation:1)
        owner.routeFeedback("cta",receipt:2,generation:1);owner.stop();owner.beginGeneration(7)
        XCTAssertEqual(owner.activeWorldTailCount,1);XCTAssertEqual(tail.disposals,0)
        let stale=tail.finishes[tail.cues[0].voice]!
        tail.finish(tail.cues[0].voice,.ended);stale(.stopped)
        XCTAssertEqual(owner.activeWorldTailCount,0);XCTAssertEqual(tail.disposals,1)
        owner.dispose();XCTAssertEqual(tail.disposals,1)
    }
    func testWorldHubSpeechReplacementAndHardBoundaries() {
        let first=Transport(),second=Transport();var count=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),worldTailFactory:{count += 1;return count == 1 ? first:second})
        owner.routeFeedback("world-hub-forest",receipt:1,generation:1);let stale=first.finishes[first.cues[0].voice]!
        owner.routeFeedback("world-hub-beach",receipt:2,generation:1)
        XCTAssertEqual(first.disposals,1);stale(.ended);XCTAssertEqual(second.disposals,0)
        second.finish(second.cues[0].voice,.unavailable);XCTAssertEqual(second.disposals,1);owner.dispose()
        for boundary in 0..<5 {
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),worldTailFactory:{tail})
            owner.routeFeedback("world-hub-space",receipt:1,generation:1)
            switch boundary {
            case 0:owner.setEnabled(false);owner.setEnabled(true)
            case 1:owner.setForeground(false);owner.setForeground(true)
            case 2:NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
            case 3:NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)
            default:owner.dispose()
            }
            XCTAssertEqual(owner.activeWorldTailCount,0);XCTAssertEqual(tail.disposals,1)
            owner.routeFeedback("world-hub-space",receipt:1,generation:1);XCTAssertEqual(tail.cues.count,1)
            owner.dispose();XCTAssertEqual(tail.disposals,1)
        }
    }
    func testBoardClearedNalaAndRoundWonVoicePlayTogetherAndMuteTogether() {
        for sample in [0.0,0.4,0.99] {
            let main=Transport(),human=Transport(),dog=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,
                arcadeTailFactory:{dog},roundWonTailFactory:{human},random:{sample})
            owner.roundWon(receipt:1,generation:1)
            owner.resultMoment("arcade-thumb",index:1,receipt:2,generation:1)
            XCTAssertEqual(human.cues.count,1);XCTAssertEqual(human.disposals,0)
            XCTAssertEqual(dog.cues.count,1);XCTAssertTrue(dog.cues[0].source.contains("nala"))
            XCTAssertEqual(dog.cues[0].gain,0.42);XCTAssertEqual(dog.disposals,0)
            owner.resultMoment("arcade-thumb",index:1,receipt:2,generation:1)
            XCTAssertEqual(dog.cues.count,1)
            owner.setEnabled(false)
            XCTAssertEqual(human.disposals,1);XCTAssertEqual(dog.disposals,1)
            owner.dispose()
        }
    }

    func testRoundWonAllTenSelectionsAndNaturalTailAcrossResultGeneration() {
        for choice in 0..<10 {
            let tail=Transport(),main=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,roundWonTailFactory:{tail},random:{(Double(choice)+0.1)/10})
            owner.roundWon(receipt:1,generation:1)
            let expected=NativeAuthoredAudioCatalog.groups["roundWon\(choice)"]!.first!
            XCTAssertEqual(tail.cues,[expected]);XCTAssertNil(expected.stopAfter)
            XCTAssertTrue(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent(expected.source).path))
            owner.roundWon(receipt:1,generation:1);owner.roundWon(receipt:2,generation:99)
            XCTAssertEqual(tail.cues.count,1)
            owner.stop();owner.beginGeneration(7)
            owner.resultMoment("clean-applause",receipt:1,generation:7)
            owner.resultMoment("arcade-thumb",receipt:2,generation:7)
            XCTAssertEqual(owner.activeRoundWonTailCount,1);XCTAssertEqual(tail.disposals,0)
            let stale=tail.finishes[expected.voice]!
            tail.finish(expected.voice,.ended);stale(.stopped)
            XCTAssertEqual(owner.activeRoundWonTailCount,0);XCTAssertEqual(tail.disposals,1)
            owner.dispose();XCTAssertEqual(tail.disposals,1)
        }
    }
    func testRoundWonHardBoundariesAndMutedContactNeverReplay() {
        for boundary in 0..<6 {
            let tail=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),roundWonTailFactory:{tail},random:{0})
            owner.roundWon(receipt:1,generation:1)
            switch boundary {
            case 0:owner.setEnabled(false);owner.setEnabled(true)
            case 1:owner.setForeground(false);owner.setForeground(true)
            case 2:NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
            case 3:NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)
            case 4:tail.finish(tail.cues[0].voice,.unavailable)
            default:owner.dispose()
            }
            XCTAssertEqual(owner.activeRoundWonTailCount,0);XCTAssertEqual(tail.disposals,1)
            owner.roundWon(receipt:1,generation:1);XCTAssertEqual(tail.cues.count,1)
            owner.dispose();XCTAssertEqual(tail.disposals,1)
        }
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:false,transport:Transport(),roundWonTailFactory:{tail})
        owner.roundWon(receipt:1,generation:1);owner.setEnabled(true);owner.roundWon(receipt:1,generation:1)
        XCTAssertTrue(tail.cues.isEmpty);owner.dispose()
    }
    func testRoundWonReplacementIgnoresOldCompletion() {
        let first=Transport(),second=Transport();var count=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),roundWonTailFactory:{count += 1;return count == 1 ? first:second})
        owner.roundWon(receipt:1,generation:1);let stale=first.finishes[first.cues[0].voice]!
        owner.roundWon(receipt:2,generation:1);XCTAssertEqual(first.disposals,1)
        stale(.ended);XCTAssertEqual(owner.activeRoundWonTailCount,1);XCTAssertEqual(second.disposals,0)
        second.finish(second.cues[0].voice,.ended);XCTAssertEqual(second.disposals,1)
        owner.dispose()
    }
    func testBaloonHappyPeoplePlaysOnceAtMergeWithRequestedGain() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        let event=NativeGameplayEvent(.merged,value:6,archetype:.juice,variant:"baloon")
        owner.onGameplayEvent(event,generation:1,receipt:1)
        let mini=transport.cues.filter{$0.voice=="native-baloon-mini2"}
        XCTAssertEqual(mini.count,1)
        XCTAssertEqual(mini.first?.source,"assets/sound/Wild and special kockice/juice/mini2.mp3")
        XCTAssertEqual(mini.first?.gain,NativeAuthoredAudioCatalog.groups["juice-straw"]?.first?.gain)
        XCTAssertEqual(mini.first?.gain,0.39);XCTAssertEqual(mini.first?.delay,0)
        let happy=transport.cues.filter{$0.source.hasSuffix("/happy people.wav")}
        XCTAssertEqual(happy.count,1);XCTAssertEqual(happy.first?.gain,0.546)
        XCTAssertEqual(happy.first?.delay,0);XCTAssertNil(happy.first?.stopAfter)
        let flight=transport.cues.filter{$0.source.hasSuffix("/baloni zvuk.wav")}
        XCTAssertEqual(flight.count,1);XCTAssertEqual(flight.first?.gain,0.72);XCTAssertEqual(flight.first?.delay,1)
        let count=transport.cues.count
        owner.onGameplayEvent(event,generation:1,receipt:1);XCTAssertEqual(transport.cues.count,count)
        owner.setEnabled(false);owner.onGameplayEvent(event,generation:1,receipt:2)
        owner.setEnabled(true);owner.onGameplayEvent(event,generation:1,receipt:2)
        XCTAssertEqual(transport.cues.count,count)
        owner.specialMoment(variant:"baloon",moment:"start",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.filter{$0.source.hasSuffix("/happy people.wav")}.count,1)
        XCTAssertEqual(transport.cues.filter{$0.source.hasSuffix("/baloni zvuk.wav")}.count,1)
        owner.onGameplayEvent(.init(.merged,value:6,archetype:.juice),generation:1,receipt:4)
        XCTAssertEqual(transport.cues.filter{$0.source.hasSuffix("/happy people.wav")}.count,1)
    }
    func testBaloonSequenceEnvelopeAndSuppressedContactNeverReplays() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.specialMoment(variant:"baloon",moment:"start",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,4)
        let hiss=transport.cues.first{$0.source.hasSuffix("/hiss.wav")}!
        XCTAssertEqual(hiss.gain,0.144);XCTAssertEqual(hiss.stopAfter,2.2);XCTAssertEqual(hiss.fadeOut,1.2)
        XCTAssertEqual(transport.cues.first{$0.source.hasSuffix("/baloni.wav")}?.gain,0.18)
        XCTAssertNil(transport.cues.first{$0.source.hasSuffix("/baloni zvuk.wav")})
        XCTAssertEqual(hiss.delay,0)
        XCTAssertEqual(hiss.delay,transport.cues.first{$0.voice == "native-baloon-pop"}?.delay)
        XCTAssertEqual((hiss.stopAfter ?? 0)-hiss.fadeOut,1,accuracy:0.000001)
        XCTAssertEqual(transport.cues.filter{$0.voice.hasPrefix("native-baloon-flight")}.map(\.delay),[0.3])
        owner.specialMoment(variant:"baloon",moment:"start",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,4)
        owner.setEnabled(false);owner.specialMoment(variant:"baloon",moment:"start",receipt:2,generation:1)
        owner.setEnabled(true);owner.specialMoment(variant:"baloon",moment:"start",receipt:2,generation:1)
        owner.specialMoment(variant:"baloon",moment:"start",receipt:3,generation:0)
        XCTAssertEqual(transport.cues.count,4)
    }
    func testModalAirAndHeroCharactersUseSelectedSourcesNaturalVoicesAndSettingsGate() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport,random:{0})
        defer{owner.dispose()}
        owner.routeFeedback("exit-modal",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.contains{$0.source=="assets/sound/UI /modal/modal enter.wav"})
        XCTAssertEqual(transport.cues.filter{$0.source=="assets/sound/cjelina flip/menu flip.wav"}.count,1)
        owner.routeFeedback("modal-close",receipt:2,generation:1)
        let air=transport.cues.filter{$0.source=="assets/sound/cjelina flip/menu flip.wav"}
        XCTAssertEqual(air.count,2);XCTAssertEqual(Set(air.map(\.voice)).count,2)
        XCTAssertTrue(transport.cues.contains{$0.source=="assets/sound/UI /tap effect back i close.wav"})
        XCTAssertTrue(air.allSatisfy{$0.stopAfter==nil})
        owner.routeFeedback("home-character-tap",receipt:3,generation:1)
        XCTAssertTrue(transport.cues.contains{$0.source=="assets/sound/logo transitions/smile.wav"})
        XCTAssertTrue(transport.cues.contains{$0.source=="assets/sound/logo transitions/nala1.wav"})
        let count=transport.cues.count
        owner.setEnabled(false);owner.routeFeedback("modal-open",receipt:4,generation:1)
        owner.setEnabled(true);owner.routeFeedback("modal-open",receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,count)
    }
    func testHomeSpeechSelectionReplacesOnlyHumanAndConsumesSuppressedContacts() {
        for (kind,choices) in [("home-journey-character-tap",["smile","lets-go","come-here-look-at-this","treasure"]) ] {
            for (index,choice) in choices.enumerated() {
                let transport=Transport()
                let roll=(Double(index)+0.1)/Double(choices.count)
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport,random:{roll})
                owner.routeFeedback(kind,receipt:1,generation:1)
                XCTAssertEqual(transport.cues.count,2)
                let human=transport.cues.filter{$0.voice.hasPrefix("native-home-human-")}
                XCTAssertEqual(human.count,1)
                XCTAssertEqual(human.first?.source,choice == "smile" ? "assets/sound/logo transitions/smile.wav" : "assets/sound/SPEECH/\(choice).\(choice == "treasure" ? "mp3":"wav")")
                XCTAssertEqual(transport.cues.filter{$0.voice.hasPrefix("native-home-nala-")}.count,1)
                XCTAssertTrue(transport.cues.allSatisfy{$0.stopAfter == nil && $0.rate == 1 && $0.delay == 0})
                owner.routeFeedback(kind,receipt:1,generation:1);XCTAssertEqual(transport.cues.count,2)
                owner.setEnabled(false);owner.routeFeedback(kind,receipt:2,generation:1)
                owner.setEnabled(true);owner.routeFeedback(kind,receipt:2,generation:1)
                XCTAssertEqual(transport.cues.count,2)
                owner.setForeground(false);owner.routeFeedback(kind,receipt:3,generation:1)
                owner.setForeground(true);owner.routeFeedback(kind,receipt:3,generation:1)
                XCTAssertEqual(transport.cues.count,2)
                owner.dispose();owner.routeFeedback(kind,receipt:4,generation:1)
                XCTAssertEqual(transport.cues.count,2)
            }
        }
    }
    func testArcadeIslandSpeechMappingConsumesDuplicateMutedAndStaleContacts() {
        for choice in 0..<3 {
            for (id,file) in [("endurance","arcade-endurance"),("pureDice","arcade-lucky-drop"),("slowBurn","arcade-slow-burn")] {
                let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),arcadeTailFactory:{transport},random:{(Double(choice)+0.1)/3})
                defer{owner.dispose()}
                let kind="arcade-island-"+id
                owner.routeFeedback(kind,receipt:1,generation:1)
                XCTAssertEqual(transport.cues.count,2)
                XCTAssertEqual(transport.cues.first?.source,id == "slowBurn" && choice == 2 ? "assets/sound/SPEECH/my tea.mp3":"assets/sound/SPEECH/\(file).wav")
                XCTAssertEqual(transport.cues.first?.gain,0.72);XCTAssertEqual(transport.cues.first?.delay,0)
                XCTAssertNil(transport.cues.first?.stopAfter)
                XCTAssertEqual(transport.cues.last?.source,"assets/sound/logo transitions/nala\(choice+1).wav")
                XCTAssertEqual(transport.cues.last?.delay,1);XCTAssertEqual(transport.cues.last?.gain,0.42)
                XCTAssertNil(transport.cues.last?.stopAfter)
                owner.routeFeedback(kind,receipt:1,generation:1)
                owner.setEnabled(false);owner.routeFeedback(kind,receipt:2,generation:1)
                owner.setEnabled(true);owner.routeFeedback(kind,receipt:2,generation:1)
                owner.routeFeedback(kind,receipt:3,generation:0)
                XCTAssertEqual(transport.cues.count,2)
            }
        }
    }
    func testArcadeTailSurvivesPlayStageAndReleasesAfterBothNaturalEnds() {
        let main=Transport(),tail=Transport()
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,arcadeTailFactory:{tail},random:{0.99})
        owner.routeFeedback("arcade-island-slowBurn",receipt:1,generation:1)
        XCTAssertEqual(tail.cues.count,2)
        owner.routeFeedback("cta",receipt:2,generation:1)
        owner.stop();owner.beginGeneration(7)
        owner.resultMoment("arcade-digit",receipt:1,generation:7)
        XCTAssertTrue(main.cues.contains {$0.voice.contains("digit")})
        XCTAssertEqual(tail.stops,0);XCTAssertEqual(tail.disposals,0)
        tail.finish(tail.cues[0].voice,.ended)
        XCTAssertEqual(owner.activeArcadeTailCount,1)
        tail.finish(tail.cues[1].voice,.ended)
        XCTAssertEqual(owner.activeArcadeTailCount,0);XCTAssertEqual(tail.disposals,1)
        owner.dispose();XCTAssertEqual(tail.disposals,1)
    }
    func testArcadeTailHardBoundariesReleaseAndNeverReplay() {
        for boundary in 0..<5 {
            let tail=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),arcadeTailFactory:{tail})
            owner.routeFeedback("arcade-island-endurance",receipt:1,generation:1)
            switch boundary {
            case 0:owner.setEnabled(false);owner.setEnabled(true)
            case 1:owner.setForeground(false);owner.setForeground(true)
            case 2:NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
            case 3:NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)
            default:owner.dispose()
            }
            XCTAssertEqual(owner.activeArcadeTailCount,0);XCTAssertEqual(tail.disposals,1)
            owner.routeFeedback("arcade-island-endurance",receipt:1,generation:1)
            XCTAssertEqual(tail.cues.count,2)
            owner.dispose();XCTAssertEqual(tail.disposals,1)
        }
    }
    func testArcadeThumbAddsMatchingCharacterWithoutReplacingWhoosh() {
        for choice in 0..<3 {
            for puppy in [false,true] {
                let transport=Transport(),tail=Transport()
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport,arcadeTailFactory:{tail},random:{(Double(choice)+0.1)/3})
                owner.resultMoment("arcade-thumb",index:puppy ? 1:0,receipt:1,generation:1)
                XCTAssertEqual(transport.cues.count,1);XCTAssertEqual(tail.cues.count,1)
                XCTAssertEqual(tail.cues.first?.source,"assets/sound/logo transitions/"+(puppy ? "nala\(choice+1)":"smile")+".wav")
                XCTAssertEqual(tail.cues.first?.gain,puppy ? 0.42:0.72)
                XCTAssertEqual(transport.cues.last?.voice,"arcade-stage-clear-thumb-whoosh")
                owner.resultMoment("arcade-thumb",index:puppy ? 1:0,receipt:1,generation:1)
                owner.stop();owner.beginGeneration(7)
                XCTAssertEqual(tail.disposals,0)
                tail.finish(tail.cues[0].voice,.ended)
                XCTAssertEqual(tail.disposals,1)
                owner.setEnabled(false);owner.resultMoment("arcade-thumb",index:1,receipt:2,generation:7)
                owner.setEnabled(true);owner.resultMoment("arcade-thumb",index:1,receipt:2,generation:7)
                XCTAssertEqual(transport.cues.count,1);XCTAssertEqual(tail.cues.count,1)
                owner.dispose()
            }
        }
    }
    func testSettingsThreeAndCollectionSevenSpeechChoicesUseOneSelectedFile() {
        for (kind,groups) in [("home-settings-character-tap",["homeSettingsSpeech","settingsSpeech0","settingsSpeech1"]),("collection-icon-speech",(0..<7).map{"collectionSpeech\($0)"})] {
            for choice in groups.indices {
                let main=Transport(),tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{tail},random:{(Double(choice)+0.1)/Double(groups.count)})
                owner.routeFeedback(kind,receipt:1,generation:1)
                let cue=NativeAuthoredAudioCatalog.groups[groups[choice]]!.first!
                XCTAssertEqual(tail.cues,[cue]);XCTAssertTrue(main.cues.isEmpty)
                XCTAssertTrue(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent(cue.source).path))
                XCTAssertEqual(cue.gain,0.72);XCTAssertEqual(cue.rate,1);XCTAssertNil(cue.stopAfter)
                owner.routeFeedback(kind,receipt:1,generation:1);owner.routeFeedback(kind,receipt:2,generation:99)
                owner.stop();owner.beginGeneration(7)
                XCTAssertEqual(tail.cues.count,1);XCTAssertEqual(tail.disposals,0)
                tail.finish(cue.voice,.ended);XCTAssertEqual(tail.disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
                owner.dispose()
            }
        }
    }
    func testNavigationSpeechHardStopsConsumeSuppressedContactsAndNeverReplay() {
        for kind in ["home-settings-character-tap","collection-icon-speech"] {
            for boundary in 0..<6 {
                let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail})
                owner.routeFeedback(kind,receipt:1,generation:1)
                switch boundary {
                case 0:owner.setEnabled(false);owner.routeFeedback(kind,receipt:2,generation:1);owner.setEnabled(true);owner.routeFeedback(kind,receipt:2,generation:1)
                case 1:owner.setForeground(false);owner.routeFeedback(kind,receipt:2,generation:1);owner.setForeground(true);owner.routeFeedback(kind,receipt:2,generation:1)
                case 2:NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
                case 3:NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)
                case 4:tail.finish(tail.cues[0].voice,.unavailable)
                default:owner.dispose()
                }
                XCTAssertEqual(tail.cues.count,1);XCTAssertEqual(tail.disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
                owner.dispose()
            }
        }
    }
    func testSettingsToCollectionSpeechReplacesOnlyOwnedTailAndRejectsOldEnd() {
        let first=Transport(),second=Transport(),main=Transport();var count=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{count += 1;return count == 1 ? first:second})
        owner.routeFeedback("home-settings-character-tap",receipt:1,generation:1)
        let stale=first.finishes[first.cues[0].voice]!
        owner.routeFeedback("collection-icon-speech",receipt:2,generation:1)
        XCTAssertEqual(first.disposals,1);stale(.ended);XCTAssertEqual(second.disposals,0)
        XCTAssertEqual(main.stops,0);second.finish(second.cues[0].voice,.ended)
        XCTAssertEqual(second.disposals,1);owner.dispose()
    }
    func testSettingsEntrySpeechUsesOriginalOnceAndConsumesSuppressedContact() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{transport},random:{0})
        defer{owner.dispose()}
        owner.routeFeedback("home-settings-character-tap",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,1)
        XCTAssertEqual(transport.cues.first?.source,"assets/sound/SPEECH/settings guy.mp3")
        XCTAssertEqual(transport.cues.first?.gain,0.72)
        XCTAssertNil(transport.cues.first?.stopAfter)
        owner.routeFeedback("home-settings-character-tap",receipt:1,generation:1)
        owner.setEnabled(false);owner.routeFeedback("home-settings-character-tap",receipt:2,generation:1)
        owner.setEnabled(true);owner.routeFeedback("home-settings-character-tap",receipt:2,generation:1)
        owner.routeFeedback("home-settings-character-tap",receipt:3,generation:0)
        XCTAssertEqual(transport.cues.count,1)
        owner.setForeground(false);owner.routeFeedback("home-settings-character-tap",receipt:3,generation:1)
        owner.setForeground(true);owner.routeFeedback("home-settings-character-tap",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,1)
    }
    func testHomeArtAndCTAEmitOneCharacterContactBeforeActivation() {
        for index in 0..<3 {
            for useCTA in [false,true] {
                let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
                home.selectSlide(index,animated:false)
                var contacts:[String]=[]
                home.onHeroContact={contacts.append("character")}
                home.onActivate={contacts.append("activate-\($0)")}
                let button=useCTA ? home.ctaView : home.heroView as! UIButton
                button.sendActions(for:.touchUpInside)
                XCTAssertEqual(contacts,["character","activate-\(index)"])
                home.stopHeroIdle()
            }
        }
    }
    private final class Transport:NativeGameplayAudioTransport {
        var onPlay:((NativeAudioCue)->Void)?
        var cues:[NativeAudioCue]=[];var stops=0;var disposals=0;var stopped:Set<String>=[]
        var finishes:[String:(NativeAudioCompletion)->Void]=[:]
        var fadeValues:[Double]=[]
        func captureFade(_ ids:Set<String>)->((Double)->Void)? { { [weak self] value in self?.fadeValues.append(value) } }
        func play(_ cue:NativeAudioCue) {cues.append(cue);onPlay?(cue)}
        func play(_ cue:NativeAudioCue,onFinished:@escaping (NativeAudioCompletion)->Void){if let old=finishes.removeValue(forKey:cue.voice){old(.stopped)};play(cue);finishes[cue.voice]=onFinished}
        func finish(_ id:String,_ reason:NativeAudioCompletion){finishes.removeValue(forKey:id)?(reason)}
        func stopVoices(_ ids:Set<String>) {stopped.formUnion(ids);for id in ids {finish(id,.stopped)}}
        func stopAll() {stops += 1;let callbacks=Array(finishes.values);finishes.removeAll();callbacks.forEach{$0(.stopped)}}
        func dispose() {disposals += 1;stopAll()}
    }
    func testDeveloperRewardCloseStopsOnlyRewardVoices() {
        final class ScopedTransport:NativeGameplayAudioTransport {
            var stopped:Set<String>=[];var allStops=0
            func play(_ cue:NativeAudioCue) {}
            func stopVoices(_ ids:Set<String>) {stopped.formUnion(ids)}
            func stopAll(){allStops+=1}
            func dispose(){}
        }
        let transport=ScopedTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.stopRewardPreviewSounds()
        XCTAssertEqual(transport.stopped,["journey-new-card-intro","journey-new-card-crumble","journey-new-card-enter-0","journey-new-card-opening-puff"])
        XCTAssertEqual(transport.allStops,0)
    }
    func testRevealTailSurvivesCollectRouteAndGenerationThenReleases() {
        let main=Transport(),tail=Transport()
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,rewardTailFactory:{tail})
        defer{owner.dispose()}
        owner.resultMoment("new-card-reveal",receipt:1,generation:1)
        XCTAssertEqual(owner.activeRewardTailCount,1)
        owner.stopRewardPreviewSounds();owner.routeFeedback("cta",receipt:2,generation:1)
        owner.stop();owner.beginGeneration(7)
        XCTAssertEqual(tail.disposals,0);XCTAssertEqual(tail.stops,0)
        owner.resultMoment("new-card-reveal",receipt:3,generation:7)
        XCTAssertEqual(tail.cues.count,2,"An active reveal package cannot be replaced or accumulated")
        tail.finish("journey-new-card-reveal",.ended)
        XCTAssertEqual(owner.activeRewardTailCount,1,"Longer card reveal layer must retain its tail")
        tail.finish("journey-new-card-reveal-layer",.ended)
        XCTAssertEqual(owner.activeRewardTailCount,0);XCTAssertEqual(tail.disposals,1)
        owner.dispose();XCTAssertEqual(tail.disposals,1)
    }
    func testCompletedRevealTailReleasesItsTransportReference() {
        weak var released:Transport?
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),rewardTailFactory:{
            let tail=Transport();released=tail;return tail
        })
        defer{owner.dispose()}
        owner.resultMoment("new-card-reveal",receipt:1,generation:1)
        XCTAssertNotNil(released)
        released?.finish("journey-new-card-reveal",.ended)
        XCTAssertNotNil(released)
        released?.finish("journey-new-card-reveal-layer",.ended)
        XCTAssertNil(released)
    }
    func testRevealTailHonorsMuteBackgroundAndOwnerDisposal() {
        for action in 0..<3 {
            let main=Transport(),tail=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,rewardTailFactory:{tail})
            owner.resultMoment("new-card-reveal",receipt:1,generation:1)
            if action==0 {owner.setEnabled(false)}else if action==1 {owner.setForeground(false)}else{owner.dispose()}
            XCTAssertEqual(owner.activeRewardTailCount,0);XCTAssertEqual(tail.disposals,1)
            owner.dispose()
        }
    }
    func testRewardRevealUsesLatestTwentyPercentRaisedMix() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport,rewardTailFactory:{transport})
        defer{owner.dispose()}
        owner.resultMoment("new-card-happy",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
        owner.resultMoment("new-card-reveal",receipt:2,generation:1)
        XCTAssertEqual(transport.cues.count,2)
        XCTAssertEqual(transport.cues.first?.source,"assets/sound/card reveal/new reward.wav")
        XCTAssertEqual(transport.cues.map(\.source),["assets/sound/card reveal/new reward.wav","assets/sound/card reveal/card reveal.wav"])
        XCTAssertEqual(transport.cues.map(\.gain),[0.2484,0.4968])
        owner.setEnabled(false)
        owner.resultMoment("new-card-reveal",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,2)
    }
    func testUnlockedCardEnterLayersSelectedPoofsOnceAndObeysMute() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.resultMoment("new-card-unlocked-enter",receipt:1,generation:1)
        owner.resultMoment("new-card-unlocked-enter",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.map(\.source),["assets/sound/card reveal/max poof.wav"])
        owner.resultMoment("new-card-opening-puff",receipt:2,generation:1)
        owner.resultMoment("new-card-opening-puff",receipt:2,generation:1)
        XCTAssertEqual(transport.cues.map(\.source),["assets/sound/card reveal/max poof.wav","assets/sound/card reveal/puf.wav"])
        XCTAssertEqual(transport.cues.map(\.gain),[0.23184,0.2898])
        for kind in ["new-card-intro","new-card-crumble"] {
            owner.resultMoment(kind,receipt:UInt64(transport.cues.count+10),generation:1)
            XCTAssertEqual(transport.cues.last?.gain,0.2898)
        }
        XCTAssertEqual(Set(transport.cues.map(\.voice)).count,4)
        owner.setEnabled(false);owner.resultMoment("new-card-opening-puff",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,4)
    }
    func testHUDIconTapUsesSameNavigationPackageAndSettingsReceiptGate() {
        let nav=Transport(),hud=Transport()
        let a=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:nav,random:{0})
        let b=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:hud,random:{0})
        defer{a.dispose();b.dispose()}
        a.routeFeedback("tab",receipt:1,generation:1)
        b.routeFeedback("hud-icon-tap",receipt:1,generation:1)
        XCTAssertFalse(nav.cues.isEmpty)
        XCTAssertEqual(nav.cues.map(\.source),hud.cues.map(\.source))
        XCTAssertEqual(nav.cues.map(\.gain),hud.cues.map(\.gain))
        let count=hud.cues.count
        b.routeFeedback("hud-icon-tap",receipt:1,generation:1)
        b.setEnabled(false);b.routeFeedback("hud-icon-tap",receipt:2,generation:1)
        b.setEnabled(true);b.routeFeedback("hud-icon-tap",receipt:2,generation:1)
        XCTAssertEqual(hud.cues.count,count)
    }
    func testHUDCoinGainTracksCapturedSizeFromFiveToTwentyFivePercentAndKeepsAdmission() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer{owner.dispose()}
        for (i,pair) in [(0.0,0.63),(0.5,0.69),(1.0,0.75),(-1.0,0.63),(2.0,0.75),(Double.nan,0.63)].enumerated() {
            owner.specialMoment(variant:"coin",moment:"hud-star-arrived",coinSizeFraction:pair.0,receipt:UInt64(i+1),generation:1)
            XCTAssertEqual(transport.cues.last!.gain,pair.1,accuracy:0.000001)
            XCTAssertEqual(transport.cues.last!.source,"assets/sound/coins/hud coin.wav")
        }
        let count=transport.cues.count
        owner.specialMoment(variant:"coin",moment:"hud-star-arrived",coinSizeFraction:1,receipt:6,generation:1)
        owner.setEnabled(false)
        owner.specialMoment(variant:"coin",moment:"hud-star-arrived",coinSizeFraction:1,receipt:7,generation:1)
        owner.setEnabled(true)
        owner.specialMoment(variant:"coin",moment:"hud-star-arrived",coinSizeFraction:1,receipt:7,generation:1)
        XCTAssertEqual(transport.cues.count,count,"Repeat and Sounds-OFF receipts cannot replay at a new size")
        XCTAssertEqual(NativeSourceHUDStarPlan.relativeCoinSize(34.5,enlargement:1.2),0,accuracy:0.000001)
        XCTAssertEqual(NativeSourceHUDStarPlan.relativeCoinSize(68.7,enlargement:1.2),1,accuracy:0.000001)
        XCTAssertEqual(NativeSourceHUDStarPlan.relativeCoinSize(43),0.5,accuracy:0.000001)
    }

    func testCoinContactsAndFinalScoreUseSelectedFilesOnceAndRespectSettings() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.specialMoment(variant:"star",moment:"hud-star-arrived",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.map(\.source),["assets/sound/coins/hud coin.wav"])
        XCTAssertEqual(transport.cues.last?.gain,0.63)
        owner.specialMoment(variant:"star",moment:"hud-star-arrived",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,1)
        owner.specialMoment(variant:"tnt",moment:"tnt-coin-launch",receipt:2,generation:1)
        XCTAssertEqual(transport.cues.last?.source,"assets/sound/coins/tnt coin.wav")
        XCTAssertEqual(transport.cues.last?.gain,0.12)
        for index in 0..<3 {owner.resultMoment("clean-score-stop",index:index,receipt:UInt64(index+1),generation:1)}
        XCTAssertEqual(transport.cues.filter{$0.source.hasSuffix("final score.wav")}.count,3)
        XCTAssertEqual(transport.cues.last?.gain,0.84)
        owner.setEnabled(false)
        owner.specialMoment(variant:"tnt",moment:"tnt-coin-launch",receipt:3,generation:1)
        owner.resultMoment("clean-score-stop",receipt:4,generation:1)
        owner.setEnabled(true)
        owner.specialMoment(variant:"tnt",moment:"tnt-coin-launch",receipt:3,generation:1)
        owner.resultMoment("clean-score-stop",receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,5)
    }

    func testConsecutiveCoinContactsOwnIndependentNaturalTails() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer{owner.dispose()}
        for receipt in 1...4 {
            owner.specialMoment(variant:"tnt",moment:receipt<3 ? "hud-star-arrived":"tnt-coin-launch",receipt:UInt64(receipt),generation:1)
        }
        XCTAssertEqual(Set(transport.cues.map(\.voice)).count,4)
        XCTAssertTrue(transport.cues.allSatisfy{$0.stopAfter == nil && $0.fadeOut == 0})
        XCTAssertEqual(transport.stops,0)
        XCTAssertTrue(transport.cues.filter{$0.source.hasSuffix("/tnt coin.wav")}.allSatisfy{$0.gain == 0.12})
    }

    func testCTAUsesHomeIconSoundAndCloseBackUseSelectedTapOnce() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer{owner.dispose()}
        XCTAssertEqual(NativeAuthoredAudioCatalog.groups["cta"]?.count,1)
        XCTAssertEqual(NativeAuthoredAudioCatalog.groups["cta"]?.first?.source,"assets/sound/CTA/cta-splat.wav")
        XCTAssertEqual(NativeAuthoredAudioCatalog.groups["cta"]?.first?.gain,0.3)
        XCTAssertEqual(NativeAuthoredAudioCatalog.groups["back"]?.count,1)
        XCTAssertEqual(NativeAuthoredAudioCatalog.groups["back"]?.first?.source,"assets/sound/UI /tap effect back i close.wav")
        for (index,pair) in [("cta","tab"),("tab","tab"),("back","back"),("close","back"),("exit-modal","exitModal")].enumerated() {
            transport.cues=[]
            let receipt=UInt64(index+1)
            owner.routeFeedback(pair.0,receipt:receipt,generation:1)
            let layers=pair.0 == "exit-modal" ? transport.cues.filter{$0.source=="assets/sound/cjelina flip/menu flip.wav"}:[]
            XCTAssertEqual(layers.count,pair.0 == "exit-modal" ? 1:0)
            XCTAssertEqual(transport.cues.filter{!layers.contains($0)},NativeAuthoredAudioCatalog.groups[pair.1])
            let count=transport.cues.count
            owner.routeFeedback(pair.0,receipt:receipt,generation:1)
            XCTAssertEqual(transport.cues.count,count)
        }
        transport.cues=[];owner.setEnabled(false)
        owner.routeFeedback("cta",receipt:6,generation:1);owner.routeFeedback("back",receipt:7,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
    }

    func testForegroundRecoversMissingInterruptionEndWithoutReplayingContacts() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer{owner.dispose()}
        NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])
        owner.studioIntro(character:"lik-game",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertTrue(transport.cues.isEmpty)
        owner.studioIntro(character:"lik-game",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
        owner.studioIntro(character:"lik-game",receipt:2,generation:1)
        XCTAssertEqual(transport.cues.first{$0.voice=="native-studio-smile"}?.gain,0.882)
        owner.setEnabled(false)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        let count=transport.cues.count
        owner.studioIntro(character:"lik-game",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,count)
    }
    func testSFXActivatesIndependentlyAndRetriesAfterFailureBackgroundAndReset() {
        var activations=0,activationSucceeds=false
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"),activateSession:{activations += 1;return activationSucceeds})
        defer{transport.dispose()}
        let cue=NativeAudioCue(source:"assets/sound/bibis.wav",voice:"activation",gain:0.3)
        var result:NativeAudioCompletion?
        transport.play(cue){result=$0}
        XCTAssertEqual(result,.unavailable);XCTAssertEqual(activations,1)
        activationSucceeds=true
        transport.play(cue);transport.play(cue)
        XCTAssertEqual(activations,2)
        transport.setSelectedPreparationForeground(false);transport.setSelectedPreparationForeground(true)
        transport.play(cue);XCTAssertEqual(activations,3)
        transport.setSelectedPreparationEnabled(false);transport.setSelectedPreparationEnabled(true)
        transport.play(cue);XCTAssertEqual(activations,4)
    }
    func testJourneyEmittedFlipEventsUseAuthoredFamiliesAndBoardExitHasThreeTimedLayers() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
        defer{owner.dispose()}
        for (index,pair) in [("card-entry-flip","flip"),("card-manual-flip","manualFlip"),("card-return-flip","returnFlip")].enumerated() {
            transport.cues=[]
            owner.routeFeedback(pair.0,receipt:UInt64(index+1),generation:1)
            XCTAssertEqual(transport.cues,NativeAuthoredAudioCatalog.groups[pair.1])
        }
        transport.cues=[]
        owner.routeFeedback("board-exit",receipt:4,generation:1,duration:0.78)
        XCTAssertEqual(transport.cues.count,3)
        XCTAssertEqual(transport.cues.map(\.source),NativeAuthoredAudioCatalog.groups["boardExit"]!.map(\.source))
        XCTAssertTrue(transport.cues.allSatisfy{$0.stopAfter==0.78 && $0.fadeOut==0.05})
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
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"),activateSession:{true})
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
    func testKiteFlightStartsAtMergeSixOnceWithNaturalFourSecondTail() throws {
        let path="assets/sound/Wild and special kockice/kite/kite lfight.wav"
        let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(path))
        XCTAssertEqual(Double(file.length)/file.processingFormat.sampleRate,4,accuracy:0.00001)
        XCTAssertTrue(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"kite")!.contains("./"+path))
        for boundary in 0..<4 {
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
            if boundary==1 {owner.setEnabled(false)}
            if boundary==2 {owner.setForeground(false)}
            if boundary==3 {owner.beginGeneration(2)}
            let event=NativeGameplayEvent(.merged,value:6,archetype:.star,variant:"kite")
            owner.onGameplayEvent(event,generation:1,receipt:1)
            owner.onGameplayEvent(event,generation:1,receipt:1)
            let cues=transport.cues.filter{$0.source==path}
            XCTAssertEqual(cues.count,boundary==0 ? 1:0)
            if let cue=cues.first {
                XCTAssertEqual(cue.voice,"kite-flight");XCTAssertEqual(cue.delay,0)
                XCTAssertEqual(cue.rate,1);XCTAssertEqual(cue.gain,0.6)
                XCTAssertNil(cue.stopAfter);XCTAssertEqual(cue.fadeOut,0)
                XCTAssertTrue(transport.cues.contains{$0.voice=="kite-merge"})
            }
            if boundary==1 || boundary==2 {
                owner.setEnabled(true);owner.setForeground(true)
                owner.onGameplayEvent(event,generation:1,receipt:1)
                XCTAssertFalse(transport.cues.contains{$0.source==path})
            }
            owner.dispose()
        }
    }
    func testKitePopReplacementIsPreparedOnceAndSuppressedBySettingsBackgroundAndGeneration() throws {
        let paths=["assets/sound/Wild and special kockice/ baloon/prvi pop.wav","assets/sound/Wild and special kockice/ baloon/baloon pop.wav","assets/sound/mini explozije/mini2.mp3"]
        let warmup=try XCTUnwrap(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"kite"))
        XCTAssertFalse(warmup.contains{$0.hasSuffix("hiss.wav")})
        for path in paths {
            XCTAssertTrue(warmup.contains("./"+path))
            let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(path))
            XCTAssertGreaterThan(file.length,0);XCTAssertEqual(file.processingFormat.sampleRate,48000)
        }
        for boundary in 0..<4 {
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
            if boundary==1 {owner.setEnabled(false)}
            if boundary==2 {owner.setForeground(false)}
            if boundary==3 {owner.beginGeneration(2)}
            let event=NativeGameplayEvent(.merged,value:6,archetype:.star,variant:"kite")
            owner.onGameplayEvent(event,generation:1,receipt:1)
            owner.onGameplayEvent(event,generation:1,receipt:1)
            for path in paths {XCTAssertEqual(transport.cues.filter{$0.source==path}.count,boundary==0 ? 1:0)}
            XCTAssertFalse(transport.cues.contains{$0.source.hasSuffix("hiss.wav")})
            owner.setEnabled(true);owner.setForeground(true)
            let count=transport.cues.count;owner.onGameplayEvent(event,generation:1,receipt:1)
            XCTAssertEqual(transport.cues.count,count,"Suppressed receipt never replays on return")
            owner.dispose()
        }
    }
    func testCuberoSuppliedMergeCuePlaysOnceAndObeysSettingsAndBackground() throws {
        let path="assets/sound/Wild and special kockice/cubero/haya.wav"
        let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(path))
        XCTAssertEqual(file.processingFormat.sampleRate,48000)
        XCTAssertEqual(Double(file.length)/file.processingFormat.sampleRate,1.450167,accuracy:0.00001)
        XCTAssertTrue(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"cubero")!.contains("./"+path))
        for boundary in 0..<3 {
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
            if boundary==1 {owner.setEnabled(false)}
            if boundary==2 {owner.setForeground(false)}
            let event=NativeGameplayEvent(.merged,value:6,archetype:.star,variant:"cubero")
            owner.onGameplayEvent(event,generation:1,receipt:1)
            owner.onGameplayEvent(event,generation:1,receipt:1)
            XCTAssertEqual(transport.cues.filter{$0.source==path}.count,boundary==0 ? 1:0)
            if boundary != 0 {
                owner.setEnabled(true);owner.setForeground(true)
                owner.onGameplayEvent(event,generation:1,receipt:1)
                XCTAssertFalse(transport.cues.contains{$0.source==path},"Suppressed committed cue never replays")
            }
            owner.dispose()
        }
    }
    func testKiteSuppliedMergeCuePlaysOnceAndObeysSettingsAndBackground() throws {
        let path="assets/sound/Wild and special kockice/kite/kite meerge.wav"
        let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(path))
        XCTAssertEqual(file.processingFormat.sampleRate,48000)
        XCTAssertEqual(Double(file.length)/file.processingFormat.sampleRate,1.182917,accuracy:0.00001)
        XCTAssertTrue(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"kite")!.contains("./"+path))
        for boundary in 0..<3 {
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
            if boundary==1 {owner.setEnabled(false)}
            if boundary==2 {owner.setForeground(false)}
            let event=NativeGameplayEvent(.merged,value:6,archetype:.star,variant:"kite")
            owner.onGameplayEvent(event,generation:1,receipt:1)
            owner.onGameplayEvent(event,generation:1,receipt:1)
            XCTAssertEqual(transport.cues.filter{$0.source==path}.count,boundary==0 ? 1:0)
            if boundary != 0 {
                owner.setEnabled(true);owner.setForeground(true)
                owner.onGameplayEvent(event,generation:1,receipt:1)
                XCTAssertFalse(transport.cues.contains{$0.source==path},"Suppressed committed cue never replays")
            }
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
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"),activateSession:{true});var reasons:[NativeAudioCompletion]=[]
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
        let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused"),activateSession:{true})
        transport.play(.init(source:"assets/sound/unavailable.wav",voice:"delayed",gain:0.2,delay:2))
        XCTAssertEqual(transport.scheduledVoiceCount,1);XCTAssertEqual(transport.openedFileCount,0)
        transport.stopAll();try await Task.sleep(for:.milliseconds(40))
        XCTAssertEqual(transport.scheduledVoiceCount,0);XCTAssertEqual(transport.openedFileCount,0)
        for index in 0..<40 {transport.play(.init(source:"assets/sound/unavailable.wav",voice:"voice\(index)",gain:0.2,delay:2))}
        XCTAssertEqual(transport.scheduledVoiceCount,32)
        transport.dispose();transport.dispose();XCTAssertEqual(transport.scheduledVoiceCount,0)
    }
}
