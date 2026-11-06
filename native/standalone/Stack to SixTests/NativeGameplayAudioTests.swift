import XCTest
import UIKit
import AVFAudio
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeGameplayAudioTests:XCTestCase {
    func testSVGLogoContactPlanUsesExplicitPoofPufAndFiniteWoodenSpringLayers() {
        let cues=NativeGameplayAudioOwner.studioLogoMotionCues
        XCTAssertEqual(cues.count,17);XCTAssertEqual(Set(cues.map(\.voice)).count,17)
        XCTAssertEqual(Set(cues.map(\.delay)).count,11)
        XCTAssertTrue(cues.contains{$0.source=="assets/sound/card reveal/poof.wav" && $0.delay==NativeGameplayAudioOwner.studioLogoMoment(0.84)})
        XCTAssertTrue(cues.contains{$0.source=="assets/sound/card reveal/puf.wav" && $0.delay==NativeGameplayAudioOwner.studioLogoMoment(3.56)})
        XCTAssertFalse(cues.contains{$0.source.localizedCaseInsensitiveContains("boing")})
        let swings=NativeGameplayAudioOwner.studioLogoSwingContacts
        XCTAssertEqual(swings.count,7)
        XCTAssertEqual(Set(swings.map{$0.cue.source}),Set([1,3,4].map{"assets/sound/crate and backpack animaitons/crate/crate \($0).wav"}))
        XCTAssertTrue(swings.allSatisfy{$0.cue.delay>=NativeStudioIntroView.presentsEntryStart && $0.cue.delay<NativeStudioIntroView.characterExitTime-0.10+0.65})
        XCTAssertGreaterThan(swings[0].cue.gain,swings[5].cue.gain)

        XCTAssertTrue(cues.contains{$0.source=="assets/sound/merge 6/wood.wav"})
        XCTAssertTrue(cues.contains{$0.voice=="native-studio-logo-fall-crate2" && $0.gain==0.54})
        XCTAssertTrue(cues.contains{$0.voice=="native-studio-logo-exit-crate3" && $0.gain==0.54})
        XCTAssertTrue(cues.allSatisfy{!$0.looping && $0.gain>0 && $0.gain<=0.85})
        XCTAssertTrue(cues.allSatisfy{$0.delay+($0.stopAfter ?? 0)<NativeStudioIntroView.duration})
    }
    func testSVGLogoVisualEventsPlayImmediatelyAndMuteDuplicateAndStopRemainOwned() {
        let main=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:false,transport:main)
        owner.studioLogoMotion(event:.fall,receipt:1,generation:1);XCTAssertTrue(main.cues.isEmpty)
        owner.setEnabled(true);owner.studioLogoMotion(event:.fall,receipt:1,generation:1)
        XCTAssertTrue(main.cues.isEmpty)
        owner.studioLogoMotion(event:.prepare,receipt:2,generation:1);XCTAssertTrue(main.cues.isEmpty)
        owner.studioLogoMotion(event:.fall,receipt:3,generation:1);XCTAssertEqual(main.cues.count,2)
        owner.studioLogoMotion(event:.fall,receipt:3,generation:1);XCTAssertEqual(main.cues.count,2)
        owner.studioLogoMotion(event:.landing,receipt:4,generation:1);XCTAssertEqual(main.cues.count,4)
        owner.studioLogoMotion(event:.exitSmoke,receipt:5,generation:1);XCTAssertEqual(main.cues.count,6)
        XCTAssertTrue(main.cues.contains{$0.voice=="native-studio-logo-exitSmoke-wood" && abs($0.gain-0.273*NativeGameplayAudioOwner.studioLogoGainScale)<0.000001})
        owner.studioLogoMotion(event:.exit,receipt:6,generation:1);XCTAssertEqual(main.cues.count,8)
        XCTAssertTrue(main.cues.allSatisfy{$0.delay==0})
        owner.studioLogoMotion(event:.stop,receipt:7,generation:1)
        XCTAssertEqual(main.stopped,Set(NativeGameplayAudioOwner.studioLogoMotionCues.map(\.voice)))
        owner.setForeground(false);owner.studioLogoMotion(event:.exit,receipt:8,generation:1)
        XCTAssertEqual(main.cues.count,8);owner.dispose();owner.dispose()
    }
    func testRecordedSceneRegistryMatchesEveryCompiledLineAndPlayableWAV()throws {
        let path="assets/sound/SPEECH/Jimbo voice compilation/seperated jjimbo voices/manifest.json"
        let manifest=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent(path))) as! [String:Any]
        let supplementPath="assets/sound/SPEECH/Jimbo voice compilation/bloob-bucket-v1/manifest.json"
        let supplement=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent(supplementPath))) as! [String:Any]
        let leashPath="assets/sound/SPEECH/Jimbo voice compilation/lik-lajna-voice-v1/manifest.json"
        let leash=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent(leashPath))) as! [String:Any]
        let journeyPath="assets/sound/SPEECH/Jimbo voice compilation/journey-cards-v1/manifest.json"
        let journey=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent(journeyPath))) as! [String:Any]
        let reward=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent("assets/sound/card reveal/reward-voices-v1/manifest.json"))) as! [String:Any]
        let clips=(manifest["clips"] as! [[String:Any]])+(supplement["clips"] as! [[String:Any]])+(leash["clips"] as! [[String:Any]])+(journey["clips"] as! [[String:Any]])+(reward["clips"] as! [[String:Any]])
        let replacementPath="assets/sound/SPEECH/settings-arcade-voices-v1/manifest.json"
        let replacement=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent(replacementPath))) as! [String:Any]
        let settingsPath="assets/sound/SPEECH/settings-voices-v2/manifest.json"
        let settings=try JSONSerialization.jsonObject(with:Data(contentsOf:NativeTestResources.root.appendingPathComponent(settingsPath))) as! [String:Any]
        let activeOverrides=(replacement["activeSources"] as! [String:[String]]).merging(settings["activeSources"] as! [String:[String]]){_,new in new}
        XCTAssertEqual((settings["clips"] as! [[String:Any]]).count,5)
        for name in ["005-little-tweak.wav","006-stacked-up.wav","007-nailed-it.wav","008-just-right.wav"] {
            XCTAssertFalse(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent("assets/sound/SPEECH/settings-arcade-voices-v1/"+name).path),"Explicitly deleted old Settings take must not be packaged")
        }
        XCTAssertEqual((replacement["clips"] as! [[String:Any]]).count,6)
        XCTAssertEqual(clips.count,176);XCTAssertEqual(NativeRecordedSceneSpeech.sources.count,46)
        XCTAssertEqual(NativeRecordedSceneSpeech.sources.values.reduce(0){$0+$1.count},182)
        XCTAssertEqual(NativeRecordedSceneSpeech.scene(forDie:"kanta"),"dice-detail-kanta")
        XCTAssertEqual(NativeRecordedSceneSpeech.sources["dice-detail-kanta"]?.count,4)
        for scene in NativeRecordedSceneSpeech.sources.keys.sorted() {
            let expected=activeOverrides[scene] ?? clips.filter{$0["sceneId"] as? String == scene}.map{clip -> String in
                let source=clip["source"] as! String
                if source.hasPrefix("assets/sound/card reveal/reward-voices-v1/") {return source.replacingOccurrences(of:"reward-voices-v1/",with:"reward-voices-v1/plus3db-v1/")}
                if source.hasSuffix("journey-cards-v1/012-stage-06.wav") {return source.replacingOccurrences(of:"journey-cards-v1/",with:"journey-cards-v1/wonder-extra2db-v1/")}
                if source.hasSuffix("journey-cards-v1/013-stage-07.wav") {return source.replacingOccurrences(of:"journey-cards-v1/",with:"journey-cards-v1/plus3db-v1/")}
                return source
            }
            XCTAssertEqual(NativeRecordedSceneSpeech.sources[scene],expected)
            for (index,source) in expected.enumerated() {
                let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(source))
                XCTAssertEqual(file.fileFormat.sampleRate,48000);XCTAssertEqual(file.fileFormat.channelCount,1);XCTAssertGreaterThan(file.length,0)
                let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{(Double(index)+0.1)/Double(expected.count)})
                owner.routeFeedback("scene-speech:"+scene,receipt:1,generation:1)
                XCTAssertEqual(tail.cues.first?.source,source);XCTAssertEqual(tail.cues.first?.gain,NativeRecordedSceneSpeech.fullGainSpeechSources.contains(source) ? 1.0:NativeRecordedSceneSpeech.boostedSpeechSources.contains(source) ? 0.72*pow(10,2.0/20):0.72);XCTAssertEqual(tail.cues.first?.rate,1)
                XCTAssertEqual(tail.cues.first?.delay,scene.hasPrefix("intro-") ? 1.0:0)
                owner.dispose();XCTAssertEqual(tail.disposals,1)
            }
        }
        XCTAssertEqual(NativeRecordedSceneSpeech.scene(forDie:"bee"),"dice-detail")
    }
    func testCuratedSettingsAndArcadePoolsNeverSelectRetiredOrLegacyLines() {
        let old="assets/sound/SPEECH/Jimbo voice compilation/seperated jjimbo voices/"
        let new="assets/sound/SPEECH/settings-arcade-voices-v1/"
        let pools:[(String,[String],Bool)] = [
            ("home-settings-character-tap",["001-little-tweak.wav","002-stacked-up.wav","003-nailed-it.wav","004-just-right.wav","005-set-it-up.wav"].map{"assets/sound/SPEECH/settings-voices-v2/"+$0},false),
            ("arcade-island-pureDice",["001-sandwich.wav","002-lunch.wav","003-one-bite.wav","004-save-a-bite.wav"].map{new+$0}+["0054-arena-grill-02.wav","0056-arena-grill-04.wav","0057-arena-grill-05.wav"].map{old+$0},true),
            ("arcade-island-slowBurn",["009-mind-my-tea.wav","010-reading-here.wav"].map{new+$0}+["0061-arena-slow-01.wav","0062-arena-slow-02.wav","0063-arena-slow-03.wav"].map{old+$0},true),
            ("scene-speech:arena-modal-grill",[old+"0059-arena-modal-grill-02.wav"]+["001-sandwich.wav","002-lunch.wav","003-one-bite.wav","004-save-a-bite.wav"].map{new+$0},false),
            ("scene-speech:arena-modal-slow",["009-mind-my-tea.wav","010-reading-here.wav"].map{new+$0},false),
        ]
        for (event,expected,island) in pools {
            var heard=Set<String>()
            // Dense draws include the upper end where old legacy choices used to live.
            for index in 0..<100 {
                let main=Transport(),tail=Transport()
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,arcadeTailFactory:{tail},navigationSpeechFactory:{tail},random:{Double(index)/100})
                owner.routeFeedback(event,receipt:1,generation:1)
                let human=tail.cues.filter{!$0.voice.contains("dog")}
                XCTAssertEqual(human.count,1,event)
                if let source=human.first?.source {XCTAssertTrue(expected.contains(source),source);heard.insert(source)}
                XCTAssertEqual(tail.cues.filter{$0.voice.contains("dog")}.count,island ? 1:0)
                owner.dispose();XCTAssertEqual(tail.disposals,1)
            }
            XCTAssertEqual(heard,Set(expected),event)
        }
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),arcadeTailFactory:{tail},navigationSpeechFactory:{tail})
        owner.routeFeedback("home-settings-character-tap",receipt:1,generation:1)
        XCTAssertTrue(tail.cues.isEmpty) // An unavailable curated registry stays silent.
        owner.routeFeedback("arcade-island-pureDice",receipt:2,generation:1)
        XCTAssertEqual(tail.cues.count,1);XCTAssertTrue(tail.cues[0].voice.contains("dog"))
        owner.dispose()
    }
    func testActualArcadeIslandTapPlaysNewSpeechWhileModalOpensWithoutAnotherArtTap() async throws {
        func descendants(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap{descendants($0)}}
        for (worldID,file) in [(3,"001-sandwich.wav"),(2,"009-mind-my-tea.wav")] {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),arcadeTailFactory:{tail},navigationSpeechFactory:{Transport()},random:{0})
            let hub=NativeArcadeHubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            host.view.addSubview(hub);hub.layoutIfNeeded();hub.present();hub.finishEntering()
            var receipt:UInt64=0,events:[String]=[]
            hub.onFeedback={event in events.append(event);receipt += 1;owner.routeFeedback(event,receipt:receipt,generation:1)}
            let button=try XCTUnwrap(descendants(hub).first{$0.accessibilityIdentifier=="native.hub.world.\(worldID)"} as? UIButton)
            button.sendActions(for:.touchUpInside)
            let human=tail.cues.filter{!$0.voice.contains("dog")}
            XCTAssertEqual(human.map(\.source),["assets/sound/SPEECH/settings-arcade-voices-v1/"+file])
            XCTAssertEqual(human.first?.delay,0)
            XCTAssertNotNil(descendants(hub).first{$0.accessibilityIdentifier=="native.arcade-world-modal.art"})
            button.sendActions(for:.touchUpInside)
            try await Task.sleep(for:.milliseconds(500))
            XCTAssertEqual(tail.cues.filter{!$0.voice.contains("dog")}.count,1,"Opening the sheet must not duplicate the accepted island speech")
            XCTAssertFalse(events.contains{$0.hasPrefix("scene-speech:")},"No extra modal-art tap required")
            XCTAssertEqual(owner.activeArcadeTailCount,1,"Modal entry preserves the selected audible island package")
            hub.hide();owner.dispose();window.isHidden=true
        }
    }
    func testWonderLegendaryLineHasExactlyTwoMoreDecibelsAndKeepsTheOtherHint()throws {
        let path="assets/sound/SPEECH/Jimbo voice compilation/journey-cards-v1/"
        func rms(_ source:String)throws->Double {
            let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(path+source))
            let buffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:file.processingFormat,frameCapacity:AVAudioFrameCount(file.length)))
            try file.read(into:buffer)
            let samples=try XCTUnwrap(buffer.floatChannelData)[0],count=Int(buffer.frameLength)
            XCTAssertEqual(count,172560)
            var squares=0.0,peak=0.0
            for i in 0..<count {let value=Double(samples[i]);squares+=value*value;peak=max(peak,abs(value))}
            XCTAssertLessThan(peak,1)
            return sqrt(squares/Double(count))
        }
        XCTAssertEqual(NativeRecordedSceneSpeech.fullGainSpeechSources,[path+"wonder-extra2db-v1/012-stage-06.wav"])
        let prior=try rms("plus3db-v1/012-stage-06.wav"),current=try rms("wonder-extra2db-v1/012-stage-06.wav")
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{let pool=NativeRecordedSceneSpeech.sources["journey-stage-open"]!;let index=pool.firstIndex(of:path+"wonder-extra2db-v1/012-stage-06.wav")!;return (Double(index)+0.1)/Double(pool.count)})
        owner.routeFeedback("journey-stage-speech:0",receipt:1,generation:1)
        let selected=try XCTUnwrap(tail.cues.first)
        XCTAssertEqual(selected.source,path+"wonder-extra2db-v1/012-stage-06.wav");XCTAssertEqual(selected.gain,1)
        XCTAssertEqual(20*log10(current*selected.gain/(prior*0.72*pow(10,2.0/20))),2,accuracy:0.001)
        XCTAssertTrue(NativeRecordedSceneSpeech.legendaryHintSpeechSources.contains(path+"plus3db-v1/013-stage-07.wav"))
        owner.dispose()
    }
    func testJourneyStageSpeechUsesOnlyStarEligibleVariantsAndAdmitsOnce()throws {
        let all=try XCTUnwrap(NativeRecordedSceneSpeech.sources["journey-stage-open"])
        XCTAssertEqual(all.count,7);XCTAssertEqual(NativeRecordedSceneSpeech.incompleteStageSpeechSources.count,3)
        for stars in [0,2,3] {
            let eligible=all.filter{stars<3 || !NativeRecordedSceneSpeech.incompleteStageSpeechSources.contains($0)}
            XCTAssertEqual(eligible.count,stars==3 ? 4:7)
            for index in eligible.indices {
                let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{(Double(index)+0.1)/Double(eligible.count)})
                owner.routeFeedback("journey-stage-speech:\(stars)",receipt:1,generation:1)
                owner.routeFeedback("journey-stage-speech:\(stars)",receipt:1,generation:1)
                XCTAssertEqual(tail.cues.map(\.source),[eligible[index]])
                XCTAssertEqual(tail.cues.first?.gain,NativeRecordedSceneSpeech.fullGainSpeechSources.contains(eligible[index]) ? 1.0:NativeRecordedSceneSpeech.boostedSpeechSources.contains(eligible[index]) ? 0.72*pow(10,2.0/20):0.72);owner.dispose()
            }
        }
        var draws=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:false,transport:Transport(),random:{draws+=1;return 0})
        owner.routeFeedback("journey-stage-speech:0",receipt:1,generation:1);owner.setEnabled(true)
        for (index,invalid) in ["-1","4","unknown"].enumerated(){owner.routeFeedback("journey-stage-speech:"+invalid,receipt:UInt64(index+2),generation:1)}
        XCTAssertEqual(draws,0);owner.dispose()
    }
    func testOneStarStageUsesSixtyPercentLegendaryHintsWithoutImmediateRepeats()throws {
        let hints=NativeRecordedSceneSpeech.legendaryHintSpeechSources
        XCTAssertEqual(hints.count,2)
        for bucket in 0..<10 {
            var draw=0
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{
                defer{draw+=1};return draw%3==0 ? (Double(bucket)+0.5)/10:(draw%3==1 ? 0:0.999)
            })
            for receipt in 1...4 {owner.routeFeedback("journey-stage-speech:1",receipt:UInt64(receipt),generation:1)}
            XCTAssertEqual(tail.cues.count,4)
            XCTAssertTrue(tail.cues.allSatisfy{hints.contains($0.source)==(bucket<6)},"Six of ten equally sized draw buckets select the two hints")
            for cue in tail.cues {XCTAssertEqual(20*log10(cue.gain/0.72),NativeRecordedSceneSpeech.fullGainSpeechSources.contains(cue.source) ? 20*log10(1/0.72):NativeRecordedSceneSpeech.boostedSpeechSources.contains(cue.source) ? 2:0,accuracy:0.000001);XCTAssertLessThanOrEqual(cue.gain,1)}
            XCTAssertTrue(zip(tail.cues,tail.cues.dropFirst()).allSatisfy{$0.source != $1.source})
            owner.dispose()
        }
    }
    func testModalNalaHalfChanceUsesEveryExistingVocalAndPreservesHumanSpeech()throws {
        let count=try XCTUnwrap(NativeAuthoredAudioCatalog.nalaGroupCounts["modalNala"])
        XCTAssertEqual(count,12)
        let sources=Set((0..<count).compactMap{NativeAuthoredAudioCatalog.groups["modalNala"+String($0)]?.first?.source})
        let existing=Set(["studioNala","failNala"].flatMap{prefix in (0..<(NativeAuthoredAudioCatalog.nalaGroupCounts[prefix] ?? 0)).compactMap{NativeAuthoredAudioCatalog.groups[prefix+String($0)]?.first?.source}})
        XCTAssertEqual(sources,existing)
        for event in ["scene-speech:dice-detail-kanta","scene-speech:dice-detail","journey-stage-speech:0","journey-stage-speech:3"] {
            for bucket in 0..<10 {
                for index in 0..<count {
                    var draw=0
                    let main=Transport(),tail=Transport()
                    let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{tail},random:{
                        defer{draw+=1}
                        return draw==0 ? 0:(draw==1 ? (Double(bucket)+0.5)/10:(Double(index)+0.1)/Double(count))
                    })
                    owner.routeFeedback(event,receipt:1,generation:1)
                    owner.routeFeedback(event,receipt:1,generation:1)
                    XCTAssertEqual(tail.cues.count,1)
                    let dogs=main.cues.filter{$0.voice=="native-modal-nala"}
                    XCTAssertEqual(dogs.count,bucket<5 ? 1:0)
                    if bucket<5 {
                        XCTAssertEqual(dogs.first?.source,NativeAuthoredAudioCatalog.groups["modalNala"+String(index)]?.first?.source)
                        XCTAssertEqual(dogs.first?.gain,0.42);XCTAssertEqual(dogs.first?.rate,1);XCTAssertEqual(dogs.first?.delay,0)
                    }
                    owner.dispose()
                }
            }
        }
    }
    func testModalNalaDoesNotDrawForRejectedOrUnrelatedSpeechAndStopsWithOwner() {
        var draws=0
        let main=Transport(),tail=Transport()
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:false,transport:main,navigationSpeechFactory:{tail},random:{draws+=1;return 0})
        owner.routeFeedback("scene-speech:dice-detail-kanta",receipt:1,generation:1)
        XCTAssertEqual(draws,0);owner.setEnabled(true)
        for (i,event) in ["scene-speech:missing","journey-stage-speech:4"].enumerated(){owner.routeFeedback(event,receipt:UInt64(i+2),generation:1)}
        XCTAssertEqual(draws,0)
        owner.routeFeedback("scene-speech:journey-card-common",receipt:4,generation:1)
        XCTAssertFalse(main.cues.contains{$0.voice=="native-modal-nala"})
        owner.routeFeedback("scene-speech:dice-detail-kanta",receipt:5,generation:1)
        owner.routeFeedback("scene-speech:dice-detail-kanta",receipt:6,generation:1)
        let dogs=main.cues.filter{$0.voice=="native-modal-nala"}
        XCTAssertEqual(dogs.count,2);XCTAssertNotEqual(dogs.first?.source,dogs.last?.source)
        owner.setForeground(false);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
        let before=main.cues.count,randomBefore=draws
        owner.routeFeedback("journey-stage-speech:0",receipt:7,generation:1)
        XCTAssertEqual(main.cues.count,before);XCTAssertEqual(draws,randomBefore)
        owner.setForeground(true);XCTAssertEqual(main.cues.count,before)
        owner.dispose();XCTAssertEqual(main.disposals,1)
    }
    func testOnlyFiveRequestedAdditionalLinesReceiveTwoDecibelLift()throws {
        let requested:Set<String>=["008-stage-02.wav","010-stage-04.wav","011-stage-05.wav","0127-dice-detail-bloob-ball-01.wav","0129-dice-detail-bloob-ball-03.wav"]
        XCTAssertEqual(Set(NativeRecordedSceneSpeech.boostedSpeechSources.subtracting(NativeRecordedSceneSpeech.legendaryHintSpeechSources).map{URL(fileURLWithPath:$0).lastPathComponent}),requested)
        for (scene,sources) in NativeRecordedSceneSpeech.sources {
            for (index,source) in sources.enumerated() where requested.contains(URL(fileURLWithPath:source).lastPathComponent) {
                let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{(Double(index)+0.1)/Double(sources.count)})
                owner.routeFeedback("scene-speech:"+scene,receipt:1,generation:1)
                let cue=try XCTUnwrap(tail.cues.first)
                XCTAssertEqual(cue.source,source)
                XCTAssertEqual(20*log10(cue.gain/0.72),2,accuracy:0.000001)
                XCTAssertEqual(cue.delay,0);XCTAssertEqual(cue.rate,1)
                owner.dispose()
            }
        }
    }
    func testIntroCompanionVocalsWaitWhileFoleyKeepsItsContactTime()throws {
        for character in ["lik-pas-SVG","pas-novine","lik-speceraj"] {
            let main=Transport(),tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{tail},random:{0})
            owner.studioIntro(character:character,receipt:1,generation:1)
            XCTAssertEqual(tail.cues.first?.delay,1.0)
            let nala=try XCTUnwrap(main.cues.first{$0.voice.contains("nala")})
            XCTAssertEqual(nala.delay,1.0)
            if character == "lik-speceraj" {XCTAssertEqual(main.cues.first{$0.source.hasSuffix("paperbag.wav")}?.delay,0)}
            owner.setForeground(false)
            XCTAssertEqual(tail.disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
            let count=main.cues.count;owner.setForeground(true)
            XCTAssertEqual(main.cues.count,count,"Background cancellation must never replay the intro vocal")
            owner.dispose()
        }
        let main=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main)
        owner.studioIntro(character:"lik-laptop",receipt:1,generation:1)
        XCTAssertEqual(main.cues.first{$0.source.hasSuffix("smile.wav")}?.delay,1.0)
        XCTAssertEqual(main.cues.first{$0.source.hasSuffix("chair.wav")}?.delay,0)
        owner.dispose()
        let snoring=Transport(),sleeper=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:snoring)
        sleeper.studioIntro(character:"lik-kauc",receipt:1,generation:1)
        XCTAssertEqual(snoring.cues.first{$0.source.hasSuffix("sleepy2.wav")}?.delay,0.5)
        XCTAssertEqual(try XCTUnwrap(snoring.cues.first{$0.source.hasSuffix("sleepy1.wav")}).delay,1.94,accuracy:0.000001)
        sleeper.setForeground(false)
        let count=snoring.cues.count;sleeper.setForeground(true)
        XCTAssertEqual(snoring.cues.count,count,"Canceled snoring does not replay after foreground")
        sleeper.dispose()
    }
    func testGuitarIntroSpeechStartsAtOneSecondAndCancelsWithIntroRetirement()throws {
        for name in ["guitar1","guitar2"] {
            let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent("assets/sound/logo transitions/\(name).wav"))
            XCTAssertEqual(Double(file.length)/file.fileFormat.sampleRate,2.88,accuracy:0.001)
        }
        for index in 0..<2 {
            let main=Transport(),tail=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{tail},random:{(Double(index)+0.1)/2})
            owner.studioIntro(character:"lik-gitara",receipt:1,generation:1)
            owner.studioIntro(character:"lik-gitara",receipt:1,generation:1)
            let speech=try XCTUnwrap(tail.cues.first)
            XCTAssertEqual(tail.cues.count,1)
            XCTAssertEqual(speech.source,NativeRecordedSceneSpeech.sources["intro-lik-gitara"]?[index])
            XCTAssertEqual(speech.delay,1.0);XCTAssertEqual(speech.gain,0.72);XCTAssertEqual(speech.rate,1);XCTAssertNil(speech.stopAfter)
            let guitar=try XCTUnwrap(main.cues.first{$0.voice.hasPrefix("native-studio-guitar")})
            XCTAssertEqual(main.cues.count,1);XCTAssertEqual(guitar.delay,0)
            XCTAssertEqual(20*log10(guitar.gain/0.42),-3,accuracy:0.000001);XCTAssertEqual(guitar.rate,1)
            let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(guitar.source))
            XCTAssertEqual(Double(file.length)/file.fileFormat.sampleRate,2.88,accuracy:0.001)
            XCTAssertEqual(Double(file.length)/file.fileFormat.sampleRate-speech.delay,1.88,accuracy:0.001)
            owner.stop();XCTAssertEqual(tail.disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
            owner.dispose();XCTAssertEqual(tail.disposals,1)
        }
    }
    func testLeashIntroLaughUsesCorrectSceneAndKeepsNalaWithoutSecondHuman()throws {
        let main=Transport(),tail=Transport()
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{tail},random:{0.999})
        owner.studioIntro(character:"lik-pas-SVG",receipt:1,generation:1)
        let source="assets/sound/SPEECH/Jimbo voice compilation/lik-lajna-voice-v1/001-leash-laugh.wav"
        XCTAssertEqual(tail.cues.map(\.source),[source]);XCTAssertEqual(tail.cues.first?.gain,0.72)
        XCTAssertTrue(main.cues.contains{$0.voice.contains("nala")})
        XCTAssertFalse(main.cues.contains{$0.source.hasSuffix("smile.wav")})
        let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(source))
        XCTAssertLessThan(Double(file.length)/file.fileFormat.sampleRate,NativeStudioIntroView.duration)
        owner.setForeground(false);XCTAssertEqual(tail.disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
        owner.dispose()
    }
    func testMountedBoxDetailClosesAndReleasesUIWhileItsSpeechFinishes()async throws {
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{0})
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[],includesArcade:true,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        var receipt:UInt64=0
        controller.onFeedback={[weak owner] kind in guard let owner else{return};receipt += 1;owner.routeFeedback(kind,receipt:receipt,generation:owner.generation)}
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{controller.dispose();owner.dispose();host.dismiss(animated:false);window.isHidden=true}
        host.present(controller,animated:false)
        var deadline=Date().addingTimeInterval(5)
        while !controller.view.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(controller.view.isUserInteractionEnabled)
        controller.screen?.onDie?(NativeBackpackCatalog.arcade.first{$0.id=="baloon"}!)
        var detail:NativeBackpackDetail?=try XCTUnwrap(controller.detail)
        weak var retiredDetail=detail
        deadline=Date().addingTimeInterval(5)
        while detail?.card.isUserInteractionEnabled != true,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(detail?.card.isUserInteractionEnabled,true);XCTAssertEqual(owner.activeNavigationSpeechCount,1)
        detail?.close.sendActions(for:.touchUpInside)
        deadline=Date().addingTimeInterval(5)
        while controller.detail != nil,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(controller.detail);XCTAssertEqual(owner.activeNavigationSpeechCount,1);XCTAssertEqual(tail.disposals,0)
        detail=nil
        deadline=Date().addingTimeInterval(5)
        while retiredDetail != nil,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(retiredDetail,"Speech must not retain the dismissed detail controller")
        controller.dispose();owner.stop()
        XCTAssertEqual(owner.activeNavigationSpeechCount,1);XCTAssertEqual(tail.disposals,0)
        tail.finish("native-scene-jimbo",.ended)
        XCTAssertEqual(owner.activeNavigationSpeechCount,0);XCTAssertEqual(tail.disposals,1)
    }
    func testDiceSpeechSurvivesModalCloseAndRouteRetirementThenCleansAtActualEnd() {
        let main=Transport();var tails:[Transport]=[]
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{let t=Transport();tails.append(t);return t},random:{0})
        owner.routeFeedback("scene-speech:dice-detail-baloon",receipt:1,generation:1)
        let first=tails[0],late=first.finishes["native-scene-jimbo"]!
        owner.routeFeedback("modal-close",receipt:2,generation:1)
        owner.routeFeedback("modal-exit",receipt:3,generation:1)
        owner.stop();owner.beginGeneration(3)
        XCTAssertEqual(owner.activeNavigationSpeechCount,1);XCTAssertEqual(first.disposals,0)
        first.finish("native-scene-jimbo",.ended)
        XCTAssertEqual(owner.activeNavigationSpeechCount,0);XCTAssertEqual(first.disposals,1)
        late(.ended);XCTAssertEqual(first.disposals,1)
        owner.routeFeedback("scene-speech:dice-detail-tnt",receipt:1,generation:3)
        let second=tails[1],old=second.finishes["native-scene-jimbo"]!
        owner.routeFeedback("scene-speech:dice-detail-baloon",receipt:2,generation:3)
        XCTAssertEqual(second.disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,1)
        old(.ended);XCTAssertEqual(owner.activeNavigationSpeechCount,1)
        owner.setEnabled(false);XCTAssertEqual(tails[2].disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
        owner.setEnabled(true);owner.routeFeedback("scene-speech:dice-detail-kanta",receipt:3,generation:3)
        owner.setForeground(false);XCTAssertEqual(tails[3].disposals,1);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
        owner.setForeground(true);XCTAssertEqual(owner.activeNavigationSpeechCount,0);owner.dispose()
    }
    func testRecordedSceneAdmissionNonrepeatCloseAndOldCompletionAreBounded() {
        let main=Transport();var tails:[Transport]=[],draws=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:false,transport:main,navigationSpeechFactory:{let t=Transport();tails.append(t);return t},random:{draws+=1;return 0})
        let scene="dice-detail-fish"
        owner.routeFeedback("scene-speech:"+scene,receipt:1,generation:1);owner.setEnabled(true)
        owner.routeFeedback("scene-speech:"+scene,receipt:1,generation:1);XCTAssertEqual(draws,0)
        owner.routeFeedback("scene-speech:"+scene,receipt:2,generation:1);let first=tails[0],late=first.finishes["native-scene-jimbo"]!
        owner.routeFeedback("scene-speech:"+scene,receipt:3,generation:1)
        XCTAssertNotEqual(first.cues[0].source,tails[1].cues[0].source);XCTAssertEqual(first.disposals,1)
        late(.ended);XCTAssertEqual(owner.activeNavigationSpeechCount,1)
        owner.routeFeedback("scene-speech-stop:dice-detail-bottle",receipt:4,generation:1);XCTAssertEqual(owner.activeNavigationSpeechCount,1)
        owner.routeFeedback("scene-speech-stop:"+scene,receipt:5,generation:1);XCTAssertEqual(owner.activeNavigationSpeechCount,0);XCTAssertEqual(tails[1].disposals,1)
        owner.routeFeedback("scene-speech:"+scene,receipt:6,generation:1);owner.stop();XCTAssertEqual(owner.activeNavigationSpeechCount,1);XCTAssertEqual(tails[2].disposals,0)
        owner.routeFeedback("scene-speech:"+scene,receipt:7,generation:1);XCTAssertEqual(tails.count,3)
        owner.routeFeedback("scene-speech:"+scene,receipt:8,generation:2);owner.setForeground(false);XCTAssertEqual(owner.activeNavigationSpeechCount,0)
        owner.setForeground(true);XCTAssertEqual(owner.activeNavigationSpeechCount,0);owner.dispose()
    }
    func testRecordedHomeAndIntroRetainNalaAndActionCuesWithoutOldHumanOverlap() {
        let main=Transport();var tails:[Transport]=[]
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:main,navigationSpeechFactory:{let t=Transport();tails.append(t);return t},random:{0})
        owner.routeFeedback("home-journey-character-tap",receipt:1,generation:1)
        XCTAssertTrue(tails[0].cues[0].source.contains("home-journey"));XCTAssertEqual(main.cues.filter{$0.voice.hasPrefix("native-home-nala")}.count,1)
        XCTAssertFalse(main.cues.contains{$0.voice=="native-home-human"})
        main.cues.removeAll();owner.studioIntro(character:"lik-speceraj",receipt:1,generation:1)
        XCTAssertTrue(tails.last!.cues[0].source.contains("intro-lik-speceraj"));XCTAssertTrue(main.cues.contains{$0.source.contains("paperbag")});XCTAssertFalse(main.cues.contains{$0.source.hasSuffix("smile.wav")})
        XCTAssertTrue(main.cues.contains{$0.voice.contains("nala")});owner.setEnabled(false);XCTAssertEqual(owner.activeNavigationSpeechCount,0);owner.dispose()
    }
    func testRecordedArcadeKeepsBothVoicesUntilNaturalCompletion() {
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),arcadeTailFactory:{tail},random:{0})
        owner.routeFeedback("arcade-island-pureDice",receipt:1,generation:1)
        XCTAssertEqual(tail.cues.count,2);XCTAssertTrue(tail.cues.contains{NativeRecordedSceneSpeech.sources["arena-grill"]!.contains($0.source)});XCTAssertTrue(tail.cues.contains{$0.voice.contains("dog")})
        owner.stop();XCTAssertEqual(owner.activeArcadeTailCount,1)
        for cue in tail.cues {tail.finish(cue.voice,.ended)}
        XCTAssertEqual(owner.activeArcadeTailCount,0);XCTAssertEqual(tail.disposals,1);owner.dispose()
    }
    func testNalaPoolsKeepAllNewSourcesAtDogGainWithUnhappyExcludedFromPositiveContexts()throws {
        let positive=["homeCharacter","studioNala","arcadeIslandDog","arcadeThumbDog"]
        var newSources=Set<String>()
        for prefix in positive+["failNala"] {
            let count=try XCTUnwrap(NativeAuthoredAudioCatalog.nalaGroupCounts[prefix])
            XCTAssertEqual(count,prefix == "failNala" ? 5:11)
            for index in 0..<count {
                let cue=try XCTUnwrap(NativeAuthoredAudioCatalog.groups[prefix+String(index)]?.last)
                XCTAssertEqual(cue.gain,0.42);XCTAssertEqual(cue.rate,1);XCTAssertNil(cue.stopAfter)
                XCTAssertEqual(cue.delay,prefix == "arcadeIslandDog" ? 1:0)
                if prefix != "failNala" {XCTAssertFalse(cue.source.contains("nesretna"))}
                if cue.source.contains("/SPEECH/Nala/"){newSources.insert(cue.source)}
                XCTAssertTrue(FileManager.default.fileExists(atPath:NativeTestResources.root.appendingPathComponent(cue.source).path))
            }
        }
        XCTAssertEqual(newSources.count,9)
    }
    func testEveryNalaPlaybackDerivativePreservesPCMFramesWithOnlyDeclaredGain()throws {
        let names=["nala laje","nala laje 2","nala prica cvili","nala cvili prica 2","nala lajavo prica","nala lajavo prica 2","nala dahce cvili","nala dahce cvili 2","nala nesretna"]
        for name in names {
            let path="assets/sound/SPEECH/Nala/",sourceURL=NativeTestResources.root.appendingPathComponent(path+name+".wav")
            let source=try AVAudioFile(forReading:sourceURL),playback=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(path+"playback-v1/"+name+".wav"))
            XCTAssertEqual(source.length,playback.length);XCTAssertEqual(playback.fileFormat.sampleRate,48000);XCTAssertEqual(playback.fileFormat.channelCount,2)
            XCTAssertEqual(Double(playback.length)/48000,2.88,accuracy:0.000001)
            let a=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:source.processingFormat,frameCapacity:AVAudioFrameCount(source.length))),b=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:playback.processingFormat,frameCapacity:AVAudioFrameCount(playback.length)))
            try source.read(into:a);try playback.read(into:b)
            let x=try XCTUnwrap(a.floatChannelData),y=try XCTUnwrap(b.floatChannelData)
            var peak=0.0,outputPeak=0.0
            for channel in 0..<2 {for frame in 0..<Int(a.frameLength){peak=max(peak,abs(Double(x[channel][frame])));outputPeak=max(outputPeak,abs(Double(y[channel][frame])))}}
            let scale=Double(Int((32768*pow(10,-1/20.0)).rounded()))/32768/peak
            var maxError=0.0
            for channel in 0..<2 {for frame in 0..<Int(a.frameLength){maxError=max(maxError,abs(Double(y[channel][frame])-Double(x[channel][frame])*scale))}}
            XCTAssertLessThanOrEqual(maxError,0.00004)
            XCTAssertEqual(20*log10(outputPeak),-1,accuracy:0.001)
        }
    }
    func testNalaIntroRotationUsesOnlyAdmittedContactsAndKeepsHistoryAcrossGenerations() {
        let main=Transport();var draws=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:false,transport:main,random:{draws+=1;return 0})
        defer{owner.dispose()}
        owner.studioIntro(character:"lik-pas-SVG",receipt:1,generation:1);owner.setEnabled(true)
        owner.studioIntro(character:"lik-pas-SVG",receipt:1,generation:1);XCTAssertEqual(draws,0)
        owner.studioIntro(character:"lik-pas-SVG",receipt:2,generation:1);XCTAssertEqual(draws,1)
        owner.setEnabled(false);owner.studioIntro(character:"pas-novine",receipt:3,generation:1)
        owner.setEnabled(true);owner.studioIntro(character:"pas-novine",receipt:3,generation:1)
        owner.setForeground(false);owner.studioIntro(character:"lik-speceraj",receipt:4,generation:1)
        owner.setForeground(true);owner.studioIntro(character:"lik-speceraj",receipt:4,generation:1);XCTAssertEqual(draws,1)
        owner.beginGeneration(2);owner.studioIntro(character:"lik-pas-SVG",receipt:5,generation:1);XCTAssertEqual(draws,1)
        owner.studioIntro(character:"lik-speceraj",receipt:1,generation:2);XCTAssertEqual(draws,2)
        let dog=main.cues.filter{$0.voice=="native-studio-nala"};XCTAssertEqual(dog.count,2);XCTAssertNotEqual(dog[0].source,dog[1].source)
        owner.studioIntro(character:"lik-game",receipt:2,generation:2);XCTAssertEqual(draws,2,"No Nala added to dog-free intros")
    }
    func testFailNalaRotatesAtExistingSaxContactAndStopsWithResultSettingsAndBackground() {
        let main=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,random:{0})
        defer{owner.dispose()}
        owner.resultMoment("fail-sax",receipt:1,generation:1)
        let first=main.cues.filter{$0.voice=="native-fail-nala"};XCTAssertEqual(first.count,1);XCTAssertTrue(first[0].source.contains("nesretna"));XCTAssertEqual(first[0].gain,0.42)
        XCTAssertTrue(main.cues.contains{$0.voice=="fail-screen-saxophone"})
        owner.resultMoment("fail-sax",receipt:1,generation:1);XCTAssertEqual(main.cues.filter{$0.voice=="native-fail-nala"}.count,1)
        owner.setEnabled(false);owner.resultMoment("fail-sax",receipt:2,generation:1);owner.setEnabled(true);owner.resultMoment("fail-sax",receipt:2,generation:1)
        XCTAssertEqual(main.cues.filter{$0.voice=="native-fail-nala"}.count,1)
        owner.beginGeneration(2);owner.resultMoment("fail-sax",receipt:1,generation:2)
        let voices=main.cues.filter{$0.voice=="native-fail-nala"};XCTAssertEqual(voices.count,2);XCTAssertNotEqual(voices[0].source,voices[1].source)
        let stops=main.stops;owner.setForeground(false);XCTAssertGreaterThan(main.stops,stops)
        owner.setForeground(true);owner.resultMoment("fail-sax",receipt:1,generation:2);XCTAssertEqual(main.cues.filter{$0.voice=="native-fail-nala"}.count,2)
    }
    func testFailBoardTitleVoiceExactMappingsAndPackagedPCM()throws {
        XCTAssertEqual(NativeFailBoardTitleVoice.entries.map(\.title),NativeResultHeadlines.fail)
        XCTAssertEqual(NativeFailBoardTitleVoice.entries.count,94)
        XCTAssertTrue(Set(["You Died!","Miss Click?","You Almost!","Wrong Spot!"]).isDisjoint(with:NativeResultHeadlines.fail))
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        defer{owner.dispose()}
        for (index,entry) in NativeFailBoardTitleVoice.entries.enumerated() {
            owner.resultMoment("fail-title",index:index,receipt:UInt64(index+1),generation:1)
            let cue=try XCTUnwrap(transport.cues.last)
            XCTAssertEqual(cue.source,entry.source);XCTAssertEqual(cue.voice,"native-fail-title")
            XCTAssertEqual(cue.gain,0.9064262964918004);XCTAssertEqual(cue.rate,1)
            XCTAssertEqual(cue.delay,0);XCTAssertNil(cue.stopAfter)
            let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(entry.source))
            XCTAssertEqual(file.fileFormat.sampleRate,48000);XCTAssertEqual(file.fileFormat.channelCount,1)
            XCTAssertGreaterThan(Double(file.length)/48000,0.3);XCTAssertLessThan(Double(file.length)/48000,2)
            XCTAssertTrue(entry.source.contains("/titles-v1/"))
            let boostedReference=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(entry.source.replacingOccurrences(of:"/titles-v1/",with:"/titles-v2-plus4db/")))
            XCTAssertEqual(file.length,boostedReference.length)
            let actual=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:file.processingFormat,frameCapacity:AVAudioFrameCount(file.length)))
            let boostedBuffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:boostedReference.processingFormat,frameCapacity:AVAudioFrameCount(boostedReference.length)))
            try file.read(into:actual);try boostedReference.read(into:boostedBuffer)
            let a=try XCTUnwrap(actual.floatChannelData)[0],b=try XCTUnwrap(boostedBuffer.floatChannelData)[0]
            var selectedEnergy=0.0,boostedEnergy=0.0,peak=0.0
            for frame in 0..<Int(file.length) {
                selectedEnergy+=Double(a[frame])*Double(a[frame]);boostedEnergy+=Double(b[frame])*Double(b[frame])
                peak=max(peak,abs(Double(a[frame])))
            }
            XCTAssertEqual(10*log10(selectedEnergy/boostedEnergy),-4,accuracy:0.001)
            XCTAssertLessThanOrEqual(peak,pow(10,-0.1/20)+0.00004)
        }
        XCTAssertEqual(transport.cues.count,94)
        XCTAssertNil(NativeFailBoardTitleVoice.cue(index:-1));XCTAssertNil(NativeFailBoardTitleVoice.cue(index:94))
    }
    func testFailBoardTitleVoiceSelectedPreparationAndLifecycleGuards()throws {
        final class SelectedTransport:NativeGameplayAudioTransport {
            var cues:[NativeAudioCue]=[],prepared:[[String]]=[];var stops=0
            func play(_ cue:NativeAudioCue){cues.append(cue)}
            func stopAll(){stops+=1}
            func dispose(){}
            func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {prepared.append(sources);return true}
        }
        let transport=SelectedTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        owner.resultMoment("fail-title-prepare",index:10,receipt:1,generation:1)
        XCTAssertEqual(transport.prepared,[[NativeFailBoardTitleVoice.entries[10].source]])
        XCTAssertTrue(transport.cues.isEmpty)
        owner.resultMoment("fail-title",index:10,receipt:2,generation:1)
        owner.resultMoment("fail-title",index:11,receipt:2,generation:1)
        owner.resultMoment("fail-title",index:11,receipt:3,generation:99)
        XCTAssertEqual(transport.cues.count,1)
        owner.setEnabled(false)
        owner.resultMoment("fail-title",index:11,receipt:3,generation:1)
        owner.setEnabled(true);owner.resultMoment("fail-title",index:11,receipt:3,generation:1)
        owner.setForeground(false);owner.resultMoment("fail-title",index:12,receipt:4,generation:1)
        owner.setForeground(true);owner.resultMoment("fail-title",index:12,receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,1)
        owner.beginGeneration(2);owner.resultMoment("fail-title",index:0,receipt:5,generation:1)
        owner.resultMoment("fail-title",index:93,receipt:1,generation:2)
        XCTAssertEqual(transport.cues.last?.source,NativeFailBoardTitleVoice.entries[93].source)
        owner.dispose();owner.resultMoment("fail-title",index:0,receipt:2,generation:2)
        XCTAssertEqual(transport.cues.count,2);XCTAssertGreaterThan(transport.stops,0)
    }
    func testCleanBoardTitleVoiceExactMappingsAndPackagedPCM()throws {
        XCTAssertEqual(NativeCleanBoardTitleVoice.entries.map(\.title),NativeResultHeadlines.clean)
        XCTAssertFalse(NativeCleanBoardTitleVoice.entries.isEmpty)
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        defer{owner.dispose()}
        for (index,entry) in NativeCleanBoardTitleVoice.entries.enumerated() {
            let count=transport.cues.count
            owner.resultMoment("clean-title",index:index,receipt:UInt64(index+1),generation:1)
            guard let source=entry.source else {
                XCTAssertEqual(transport.cues.count,count,"A title awaiting its exact recording stays silent")
                XCTAssertNil(NativeCleanBoardTitleVoice.cue(index:index));continue
            }
            let cue=try XCTUnwrap(transport.cues.last)
            XCTAssertEqual(cue.source,entry.source);XCTAssertEqual(cue.voice,"native-clean-title")
            XCTAssertEqual(20 * log10(cue.gain / 0.72),2,accuracy:0.000001);XCTAssertLessThanOrEqual(cue.gain,1)
            XCTAssertEqual(cue.rate,1);XCTAssertEqual(cue.delay,0);XCTAssertNil(cue.stopAfter)
            let file=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(source))
            XCTAssertEqual(file.fileFormat.sampleRate,48000);XCTAssertEqual(file.fileFormat.channelCount,1)
            let seconds=Double(file.length)/file.fileFormat.sampleRate
            XCTAssertGreaterThan(seconds,0.3);XCTAssertLessThan(seconds,2)
            XCTAssertTrue(source.contains("/clean booard title voice/+4db/"))
            let original=try AVAudioFile(forReading:NativeTestResources.root.appendingPathComponent(source.replacingOccurrences(of:"/+4db/",with:"/")))
            XCTAssertEqual(file.length,original.length)
            let actual=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:file.processingFormat,frameCapacity:AVAudioFrameCount(file.length)))
            let baseline=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:original.processingFormat,frameCapacity:AVAudioFrameCount(original.length)))
            try file.read(into:actual);try original.read(into:baseline)
            let a=try XCTUnwrap(actual.floatChannelData)[0],b=try XCTUnwrap(baseline.floatChannelData)[0]
            var actualEnergy=0.0,baseEnergy=0.0,peak=0.0
            for frame in 0..<Int(actual.frameLength) {
                let x=Double(a[frame]),y=Double(b[frame])
                actualEnergy+=x*x;baseEnergy+=y*y;peak=max(peak,abs(x))
            }
            let addedDb=10 * log10(actualEnergy/baseEnergy)
            XCTAssertGreaterThan(addedDb,0);XCTAssertLessThanOrEqual(addedDb,4.001)
            XCTAssertLessThanOrEqual(peak,pow(10,-0.3/20)+0.00004)
            XCTAssertLessThan(peak,1,"Amplified speech must retain every sample without clipping")
        }
        XCTAssertEqual(transport.cues.count,NativeCleanBoardTitleVoice.entries.compactMap(\.source).count)
        XCTAssertNil(NativeCleanBoardTitleVoice.cue(index:-1));XCTAssertNil(NativeCleanBoardTitleVoice.cue(index:NativeCleanBoardTitleVoice.entries.count))
    }
    func testCleanBoardTitleVoiceSelectedPreparationAndLifecycleGuards()throws {
        final class SelectedTransport:NativeGameplayAudioTransport {
            var cues:[NativeAudioCue]=[],prepared:[[String]]=[];var stops=0
            func play(_ cue:NativeAudioCue){cues.append(cue)}
            func stopAll(){stops+=1}
            func dispose(){}
            func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {prepared.append(sources);return true}
        }
        let transport=SelectedTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        owner.resultMoment("clean-title-prepare",index:73,receipt:1,generation:1)
        XCTAssertEqual(transport.prepared,[[try XCTUnwrap(NativeCleanBoardTitleVoice.entries[73].source)]])
        XCTAssertTrue(transport.cues.isEmpty,"Preparation never plays or loads the whole title pool")
        owner.resultMoment("clean-title",index:73,receipt:2,generation:1)
        owner.resultMoment("clean-title",index:74,receipt:2,generation:1)
        owner.resultMoment("clean-title",index:74,receipt:3,generation:99)
        XCTAssertEqual(transport.cues.count,1)
        owner.setEnabled(false);let stops=transport.stops
        owner.resultMoment("clean-title",index:74,receipt:3,generation:1)
        owner.setEnabled(true);owner.resultMoment("clean-title",index:74,receipt:3,generation:1)
        owner.setForeground(false);owner.resultMoment("clean-title",index:74,receipt:4,generation:1)
        owner.setForeground(true);owner.resultMoment("clean-title",index:74,receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,1);XCTAssertGreaterThan(transport.stops,stops)
        owner.beginGeneration(2);owner.resultMoment("clean-title",index:0,receipt:5,generation:1)
        let lastVoiced=try XCTUnwrap(NativeCleanBoardTitleVoice.entries.lastIndex(where:{$0.source != nil}))
        owner.resultMoment("clean-title",index:lastVoiced,receipt:1,generation:2)
        XCTAssertEqual(transport.cues.last?.source,NativeCleanBoardTitleVoice.entries[lastVoiced].source)
        owner.dispose();owner.resultMoment("clean-title",index:0,receipt:2,generation:2)
        XCTAssertEqual(transport.cues.count,2)
    }
    func testArcadeHomeRemainingTwoChoicesNeverRepeatAndRemainIndependentFromModalHistory() {
        for first in 0..<2 {
            var roll=(Double(first)+0.1)/2;var cues:[NativeAudioCue]=[],tails:[Transport]=[]
            let main=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,navigationSpeechFactory:{let tail=Transport();tail.onPlay={cues.append($0)};tails.append(tail);return tail},random:{roll})
            owner.routeFeedback("home-arcade-character-tap",receipt:1,generation:1)
            XCTAssertTrue(cues.last!.source.hasSuffix("arcade-0\(first+2).wav"))
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
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,navigationSpeechFactory:{starts += 1;if starts==2 {XCTAssertEqual(first.disposals,1)};return starts==1 ? first:second},random:{0})
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
            let tail=Transport(),subject=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),navigationSpeechFactory:{tail},random:{0})
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
                let subject=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),navigationSpeechFactory:{let t=Transport();t.onPlay={played.append($0)};return t},random:{roll})
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
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),navigationSpeechFactory:{let t=Transport();t.onPlay={sources.append($0.source)};return t},random:{0})
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
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,arcadeTailFactory:{arcade},roundWonTailFactory:{round},worldTailFactory:{world},navigationSpeechFactory:{starts += 1;if starts==2 {XCTAssertEqual(first.disposals,1)};return starts==1 ? first:second},random:{0.35})
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
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:["home-settings":NativeRecordedSceneSpeech.sources["home-settings"]!],enabled:true,transport:Transport(),arcadeTailFactory:{Transport()},roundWonTailFactory:{Transport()},worldTailFactory:{Transport()},navigationSpeechFactory:{calls += 1;return calls==1 ? tail:Transport()})
            owner.routeFeedback("high-score-modal-speech",receipt:1,generation:1)
            if next=="round-won" {owner.roundWon(receipt:2,generation:1)}else{owner.routeFeedback(next,receipt:2,generation:1)}
            XCTAssertEqual(tail.disposals,1);owner.dispose()
        }
        for kind in ["high-score-modal-speech","combo-modal-speech"] {for boundary in 0..<6 {
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),navigationSpeechFactory:{tail})
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
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,worldTailFactory:{tail},random:{(Double(choice)+0.1)/Double(count)})
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
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),worldTailFactory:{tail},random:{0})
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
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),worldTailFactory:{count += 1;return count == 1 ? first:second})
        owner.routeFeedback("world-hub-forest",receipt:1,generation:1);let stale=first.finishes[first.cues[0].voice]!
        owner.routeFeedback("world-hub-beach",receipt:2,generation:1)
        XCTAssertEqual(first.disposals,1);stale(.ended);XCTAssertEqual(second.disposals,0)
        second.finish(second.cues[0].voice,.unavailable);XCTAssertEqual(second.disposals,1);owner.dispose()
        for boundary in 0..<5 {
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),worldTailFactory:{tail})
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
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,
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
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,roundWonTailFactory:{tail},random:{(Double(choice)+0.1)/10})
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
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),roundWonTailFactory:{tail},random:{0})
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
        let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:false,transport:Transport(),roundWonTailFactory:{tail})
        owner.roundWon(receipt:1,generation:1);owner.setEnabled(true);owner.roundWon(receipt:1,generation:1)
        XCTAssertTrue(tail.cues.isEmpty);owner.dispose()
    }
    func testRoundWonReplacementIgnoresOldCompletion() {
        let first=Transport(),second=Transport();var count=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),roundWonTailFactory:{count += 1;return count == 1 ? first:second})
        owner.roundWon(receipt:1,generation:1);let stale=first.finishes[first.cues[0].voice]!
        owner.roundWon(receipt:2,generation:1);XCTAssertEqual(first.disposals,1)
        stale(.ended);XCTAssertEqual(owner.activeRoundWonTailCount,1);XCTAssertEqual(second.disposals,0)
        second.finish(second.cues[0].voice,.ended);XCTAssertEqual(second.disposals,1)
        owner.dispose()
    }
    func testBaloonHappyPeoplePlaysOnceAtMergeWithRequestedGain() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport,random:{0})
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
    func testRetiredBuddySpeechCannotBeSelectedOrPreparedFromTheActiveCatalog() {
        let retired:Set<String>=["assets/sound/SPEECH/treasure.mp3","assets/sound/SPEECH/arcade-01.wav"]
        XCTAssertNil(NativeAuthoredAudioCatalog.groups["homeSpeech-treasure"])
        XCTAssertNil(NativeAuthoredAudioCatalog.groups["arcade-01"])
        XCTAssertTrue(retired.isDisjoint(with:NativeAuthoredAudioCatalog.groups.values.flatMap{$0}.map(\.source)))
        for roll in [0.0,0.2,0.5,0.8,0.999] {
            let main=Transport(),tail=Transport()
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,navigationSpeechFactory:{tail},random:{roll})
            for receipt in 1...24 {
                owner.routeFeedback(receipt%2 == 0 ? "home-journey-character-tap":"home-arcade-character-tap",receipt:UInt64(receipt),generation:1)
            }
            XCTAssertTrue(retired.isDisjoint(with:(main.cues+tail.cues).map(\.source)))
            XCTAssertEqual(tail.cues.count,12,"Every Arcade contact still speaks a surviving line")
            XCTAssertEqual(main.cues.filter{$0.voice.hasPrefix("native-home-human-")}.count,12,"Every Journey contact retains a human cue")
            owner.dispose()
        }
    }

    func testHomeSpeechSelectionReplacesOnlyHumanAndConsumesSuppressedContacts() {
        for (kind,choices) in [("home-journey-character-tap",["smile","lets-go","come-here-look-at-this"]) ] {
            for (index,choice) in choices.enumerated() {
                let transport=Transport()
                let roll=(Double(index)+0.1)/Double(choices.count)
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport,random:{roll})
                owner.routeFeedback(kind,receipt:1,generation:1)
                XCTAssertEqual(transport.cues.count,2)
                let human=transport.cues.filter{$0.voice.hasPrefix("native-home-human-")}
                XCTAssertEqual(human.count,1)
                XCTAssertEqual(human.first?.source,choice == "smile" ? "assets/sound/logo transitions/smile.wav" : "assets/sound/SPEECH/\(choice).wav")
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
        for choice in 0..<11 {
            for (id,file) in [("endurance","arcade-endurance"),("pureDice","arcade-lucky-drop"),("slowBurn","arcade-slow-burn")] {
                let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:["arena-grill":NativeRecordedSceneSpeech.sources["arena-grill"]!,"arena-slow":NativeRecordedSceneSpeech.sources["arena-slow"]!],enabled:true,transport:Transport(),arcadeTailFactory:{transport},random:{(Double(choice)+0.1)/11})
                defer{owner.dispose()}
                let kind="arcade-island-"+id
                owner.routeFeedback(kind,receipt:1,generation:1)
                XCTAssertEqual(transport.cues.count,2)
                let human=transport.cues.first{!$0.voice.contains("dog")}
                let dog=transport.cues.first{$0.voice.contains("dog")}
                let expected=id == "pureDice" ? NativeRecordedSceneSpeech.sources["arena-grill"]![Int((Double(choice)+0.1)/11*7)]:id == "slowBurn" ? NativeRecordedSceneSpeech.sources["arena-slow"]![Int((Double(choice)+0.1)/11*5)]:"assets/sound/SPEECH/\(file).wav"
                XCTAssertEqual(human?.source,expected)
                XCTAssertEqual(human?.gain,0.72);XCTAssertEqual(human?.delay,0)
                XCTAssertNil(human?.stopAfter)
                XCTAssertEqual(dog?.source,NativeAuthoredAudioCatalog.groups["arcadeIslandDog\(choice)"]?.first?.source)
                XCTAssertEqual(dog?.delay,1);XCTAssertEqual(dog?.gain,0.42)
                XCTAssertNil(dog?.stopAfter)
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
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:["arena-slow":NativeRecordedSceneSpeech.sources["arena-slow"]!],enabled:true,transport:main,arcadeTailFactory:{tail},random:{0.99})
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
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),arcadeTailFactory:{tail})
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
        for choice in 0..<11 {
            for puppy in [false,true] {
                let transport=Transport(),tail=Transport()
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport,arcadeTailFactory:{tail},random:{(Double(choice)+0.1)/11})
                owner.resultMoment("arcade-thumb",index:puppy ? 1:0,receipt:1,generation:1)
                XCTAssertEqual(transport.cues.count,1);XCTAssertEqual(tail.cues.count,1)
                XCTAssertEqual(tail.cues.first?.source,puppy ? NativeAuthoredAudioCatalog.groups["arcadeThumbDog\(choice)"]?.first?.source:"assets/sound/logo transitions/smile.wav")
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
    func testCollectionSevenSpeechChoicesUseOneSelectedFile() {
        for (kind,groups) in [("collection-icon-speech",(0..<7).map{"collectionSpeech\($0)"})] {
            for choice in groups.indices {
                let main=Transport(),tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,navigationSpeechFactory:{tail},random:{(Double(choice)+0.1)/Double(groups.count)})
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
    func testSettingsEntrySpeechUsesCurrentTowerLineOnceAndConsumesSuppressedContact() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),navigationSpeechFactory:{transport},random:{0})
        defer{owner.dispose()}
        owner.routeFeedback("home-settings-character-tap",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,1)
        XCTAssertEqual(transport.cues.first?.source,NativeRecordedSceneSpeech.sources["home-settings"]!.first!)
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
    func testSingleModalCTAEntryIsSilentAndPairsUseHalfPreviousGain() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.routeFeedback("modal-cta-enter",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
        owner.routeFeedback("paired-modal-cta-enter",receipt:2,generation:1)
        owner.routeFeedback("paired-cta-enter",receipt:3,generation:1)
        owner.resultMoment("clean-cta",receipt:1,generation:1)
        owner.resultMoment("fail-cta",index:1,receipt:2,generation:1)
        XCTAssertEqual(transport.cues.count,5)
        for cue in transport.cues {XCTAssertEqual(cue.source,"assets/sound/Clean board/boinb.wav");XCTAssertEqual(cue.gain,0.18,accuracy:0.000001)}
        XCTAssertEqual(Array(transport.cues[1...2].map(\.delay)),[0,0.18])
        owner.setEnabled(false);owner.routeFeedback("paired-modal-cta-enter",receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,5)
    }
    func testDeveloperCleanCloseStopsResultVoicesAndSettlesSaxHookOnlyOnce() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        defer{owner.dispose()}
        var releases=0
        owner.resultMoment("clean-sax",receipt:1,generation:1,onFinished:{releases+=1})
        owner.resultMoment("clean-count",receipt:2,generation:1,duration:1.2)
        owner.resultMoment("clean-score-stop",receipt:3,generation:1)
        owner.stopCleanResultPreviewSounds();owner.stopCleanResultPreviewSounds()
        XCTAssertEqual(releases,1)
        XCTAssertTrue(transport.stopped.isSuperset(of:["clean-board-saxophone-happy","clean-board-money-count","clean-board-fast-points-main-count","clean-board-bonus-count","clean-board-final-score","native-clean-title"]))
        XCTAssertFalse(transport.stopped.contains("journey-new-card-intro"))
        XCTAssertEqual(transport.stops,0)
    }
    func testDeveloperRewardCloseStopsOnlyRewardVoices() {
        final class ScopedTransport:NativeGameplayAudioTransport {
            var stopped:Set<String>=[];var allStops=0
            func play(_ cue:NativeAudioCue) {}
            func stopVoices(_ ids:Set<String>) {stopped.formUnion(ids)}
            func stopAll(){allStops+=1}
            func dispose(){}
        }
        let transport=ScopedTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.stopRewardPreviewSounds()
        XCTAssertEqual(transport.stopped,["journey-new-card-intro","journey-new-card-crumble","journey-new-card-enter-0","journey-new-card-opening-puff"])
        XCTAssertEqual(transport.allStops,0)
    }
    func testRewardSpeechPoolsIncludeEveryLineAndEveryNalaVocal() throws {
        for rarity in 0...1 {
            let scene=rarity==1 ? "reward-legendary":"reward-common"
            let lines=try XCTUnwrap(NativeRecordedSceneSpeech.sources[scene])
            XCTAssertEqual(lines.count,4)
            for line in 0..<4 {for dog in 0..<12 {
                var draw=0
                let tail=Transport()
                let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),rewardTailFactory:{tail},random:{
                    defer{draw+=1};return draw==0 ? (Double(line)+0.1)/4:(Double(dog)+0.1)/12
                })
                owner.resultMoment("new-card-unlock-speech",index:rarity,receipt:1,generation:1)
                owner.resultMoment("new-card-unlock-speech",index:rarity,receipt:1,generation:1)
                XCTAssertEqual(tail.cues.map(\.source),[lines[line],NativeAuthoredAudioCatalog.groups["modalNala"+String(dog)]!.first!.source])
                XCTAssertEqual(tail.cues.map(\.gain),[0.72,0.42])
                XCTAssertTrue(tail.cues.allSatisfy{$0.stopAfter == nil && $0.fadeOut==0 && $0.rate==1 && $0.delay==0})
                tail.finish("native-reward-jimbo",.ended);XCTAssertEqual(owner.activeRewardSpeechCount,1)
                tail.finish("native-reward-nala",.ended);XCTAssertEqual(owner.activeRewardSpeechCount,0)
                XCTAssertEqual(tail.disposals,1);owner.dispose()
            }}
        }
    }
    func testRewardSpeechQueuesUnlockUntilNaturalInterimEndAndSurvivesCollect() throws {
        for line in 0..<4 {
            let tail=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),rewardTailFactory:{tail},random:{(Double(line)+0.1)/4})
            owner.resultMoment("new-card-interim-speech",receipt:1,generation:1)
            XCTAssertEqual(tail.cues.map(\.source),[NativeRecordedSceneSpeech.sources["reward-interim"]![line]])
            owner.resultMoment("new-card-unlock-speech",index:1,receipt:2,generation:1)
            XCTAssertEqual(tail.cues.count,1,"Rapid tap must not replace or overlap interim")
            owner.stopRewardPreviewSounds();owner.stop();owner.beginGeneration(7)
            XCTAssertEqual(tail.disposals,0)
            tail.finish("native-reward-jimbo",.ended)
            XCTAssertEqual(tail.cues.count,3);XCTAssertEqual(owner.activeRewardSpeechCount,1)
            XCTAssertTrue(NativeRecordedSceneSpeech.sources["reward-legendary"]!.contains(tail.cues[1].source))
            tail.finish("native-reward-nala",.ended);XCTAssertEqual(owner.activeRewardSpeechCount,1)
            tail.finish("native-reward-jimbo",.ended);XCTAssertEqual(tail.disposals,1)
            owner.dispose()
        }
    }
    func testRewardSpeechReplacementNonrepeatFullStopAndLateCompletion() throws {
        var tails:[Transport]=[],draws=0
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),rewardTailFactory:{let t=Transport();tails.append(t);return t},random:{draws+=1;return 0})
        owner.resultMoment("new-card-interim-speech",receipt:1,generation:1)
        let stale=tails[0].finishes["native-reward-jimbo"]!
        owner.resultMoment("new-card-interim-speech",receipt:2,generation:1)
        XCTAssertNotEqual(tails[0].cues[0].source,tails[1].cues[0].source);XCTAssertEqual(tails[0].disposals,1)
        owner.resultMoment("new-card-unlock-speech",receipt:3,generation:1)
        stale(.ended);XCTAssertEqual(tails[1].cues.count,1)
        owner.setEnabled(false);XCTAssertEqual(owner.activeRewardSpeechCount,0);XCTAssertEqual(tails[1].disposals,1)
        let before=draws
        owner.resultMoment("new-card-interim-speech",receipt:4,generation:1);owner.setEnabled(true)
        owner.resultMoment("new-card-interim-speech",receipt:4,generation:1);XCTAssertEqual(draws,before)
        owner.dispose()
        for action in 0..<4 {
            let tail=Transport(),o=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),rewardTailFactory:{tail})
            o.resultMoment("new-card-interim-speech",receipt:1,generation:1)
            o.resultMoment("new-card-unlock-speech",receipt:2,generation:1)
            let late=tail.finishes["native-reward-jimbo"]!
            if action==0 {o.setForeground(false)}
            else if action==1 {NotificationCenter.default.post(name:AVAudioSession.interruptionNotification,object:nil,userInfo:[AVAudioSessionInterruptionTypeKey:AVAudioSession.InterruptionType.began.rawValue])}
            else if action==2 {NotificationCenter.default.post(name:AVAudioSession.mediaServicesWereResetNotification,object:nil)}
            else{o.dispose()}
            late(.ended);XCTAssertEqual(tail.cues.count,1);XCTAssertEqual(tail.disposals,1);XCTAssertEqual(o.activeRewardSpeechCount,0)
            o.setForeground(true);XCTAssertEqual(tail.cues.count,1);o.dispose()
        }
        weak var released:Transport?
        let o=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:Transport(),rewardTailFactory:{let t=Transport();released=t;return t})
        o.resultMoment("new-card-interim-speech",receipt:1,generation:1)
        released?.finish("native-reward-jimbo",.ended);XCTAssertNil(released);o.dispose()
    }
    func testRevealTailSurvivesCollectRouteAndGenerationThenReleases() {
        let main=Transport(),tail=Transport()
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,rewardTailFactory:{tail})
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
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:Transport(),rewardTailFactory:{
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
            let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:main,rewardTailFactory:{tail})
            owner.resultMoment("new-card-reveal",receipt:1,generation:1)
            if action==0 {owner.setEnabled(false)}else if action==1 {owner.setForeground(false)}else{owner.dispose()}
            XCTAssertEqual(owner.activeRewardTailCount,0);XCTAssertEqual(tail.disposals,1)
            owner.dispose()
        }
    }
    func testRewardRevealUsesLatestTwentyPercentRaisedMix() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport,rewardTailFactory:{transport})
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
        let a=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:nav,random:{0})
        let b=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:hud,random:{0})
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
    func testRewardCollectUsesExactUnitContactAndInfoCardReturnOnceThroughSemanticGate() {
        let reference=Transport(),unit=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:reference)
        unit.routeFeedback("card-tap",receipt:1,generation:1)
        unit.routeFeedback("card-return-flip",receipt:2,generation:1)
        let expected=reference.cues
        XCTAssertEqual(expected.count,4)
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
        defer{unit.dispose();owner.dispose()}
        var finished=0
        owner.resultMoment("new-card-collect",receipt:1,generation:1,onFinished:{finished+=1})
        XCTAssertEqual(transport.cues,expected,"Original source/gain/rate/delay/voice match Unit contact plus info return")
        XCTAssertEqual(transport.cues.filter{$0.source.hasSuffix("klik plop.wav")}.count,1)
        XCTAssertEqual(transport.cues.filter{$0.source.hasSuffix("menu flip.wav")}.count,1)
        owner.resultMoment("new-card-collect",receipt:1,generation:1,onFinished:{finished+=1})
        XCTAssertEqual(transport.cues,expected,"Duplicate receipt cannot replay accepted collect")
        owner.setEnabled(false)
        owner.resultMoment("new-card-collect",receipt:2,generation:1)
        owner.setEnabled(true)
        owner.resultMoment("new-card-collect",receipt:2,generation:1)
        XCTAssertEqual(transport.cues,expected,"Muted contact is consumed, never deferred")
        owner.setForeground(false);owner.resultMoment("new-card-collect",receipt:3,generation:1)
        owner.setForeground(true);owner.resultMoment("new-card-collect",receipt:3,generation:1)
        owner.resultMoment("new-card-collect",receipt:4,generation:0)
        XCTAssertEqual(transport.cues,expected,"Background and stale generations stay silent")
        owner.resultMoment("new-card-collect",receipt:4,generation:1)
        XCTAssertEqual(transport.cues,expected+expected)
        XCTAssertEqual(finished,2)
    }
    func testJourneyEmittedFlipEventsUseAuthoredFamiliesAndBoardExitHasThreeTimedLayers() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
        owner.specialMoment(variant:"kanta",moment:"walking",receipt:1,generation:1)
        let fade=owner.captureSpecialFade(variant:"kanta",generation:1)!
        fade(-1);fade(2);XCTAssertEqual(transport.fadeValues,[0,1])
        owner.setForeground(false);fade(0.5);XCTAssertEqual(transport.fadeValues,[0,1])
        owner.setForeground(true);owner.beginGeneration(2);fade(0.5);XCTAssertEqual(transport.fadeValues,[0,1])
        owner.setEnabled(false);XCTAssertNil(owner.captureSpecialFade(variant:"kanta",generation:2));owner.dispose()
    }
    func testSpecialIdentitySelectsAuthoredFamilyAndPreservesFishMidpoint() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport,random:{0})
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
            let owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport,random:{randomCalls += 1;return roll})
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
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:false,transport:transport)
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport)
        owner.beginGeneration(8);owner.specialMoment(variant:"flower",moment:"spark",receipt:1,generation:1)
        XCTAssertTrue(transport.cues.isEmpty)
        owner.specialMoment(variant:"flower",moment:"spark",receipt:1,generation:8);XCTAssertFalse(transport.cues.isEmpty)
        let count=transport.cues.count;owner.stop()
        owner.specialMoment(variant:"flower",moment:"leaves",receipt:2,generation:8);XCTAssertEqual(transport.cues.count,count)
        owner.dispose();owner.dispose();owner.beginGeneration(20);owner.routeFeedback("cta",receipt:1,generation:20)
        XCTAssertEqual(transport.disposals,1);XCTAssertEqual(transport.cues.count,count)
    }
    func testCleanCountingSoundsMatchFasterVisualWindowAndRetainSettingsGuards() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,sceneSpeech:[:],enabled:true,transport:transport)
        defer{owner.dispose()}
        for (index,kind) in ["clean-count","clean-bonus","clean-bonus"].enumerated() {
            owner.resultMoment(kind,receipt:UInt64(index+1),generation:1,duration:0.92)
        }
        XCTAssertEqual(transport.cues.count,6)
        for cue in transport.cues {
            XCTAssertEqual(cue.rate,1.25,accuracy:0.000001)
            XCTAssertEqual(cue.stopAfter,0.92)
            XCTAssertEqual(cue.fadeOut,0.096,accuracy:0.000001)
        }
        owner.setEnabled(false);owner.resultMoment("clean-bonus",receipt:4,generation:1,duration:0.92)
        XCTAssertEqual(transport.cues.count,6)
        owner.setEnabled(true);owner.setForeground(false)
        owner.resultMoment("clean-count",receipt:5,generation:1,duration:0.92)
        XCTAssertEqual(transport.cues.count,6)
    }
    func testNoMovesUsesVisibleResultMomentAndResultsStayDistinct() {
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport,random:{0.99})
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
        let owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport,random:{rolls.isEmpty ? 0 : rolls.removeFirst()})
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
            let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport,random:{0})
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport,random:{0.99})
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
        let transport=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),sceneSpeech:[:],enabled:true,transport:transport);var releases=0
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
