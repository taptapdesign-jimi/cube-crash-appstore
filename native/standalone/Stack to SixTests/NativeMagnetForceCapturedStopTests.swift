import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeMagnetForceCapturedStopTests:XCTestCase {
 func testActualMutedPullProducesOneKnownSilenceReceiptAndNoInventedVoice()throws {
  let t=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused")),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:false,transport:t)
  defer{a.dispose()};XCTAssertNil(a.captureMagnetPullCleanup(generation:1))
  for (index,variant) in ["magnet","honey","bottle","spaceship"].enumerated() {
   a.specialMoment(variant:variant,moment:"pull",receipt:UInt64(index+1),generation:1)
   guard case .silence?=a.captureMagnetPullCleanup(generation:1) else{return XCTFail("Actual suppressed cue must own silence: "+variant)}
   XCTAssertNil(a.captureMagnetPullCleanup(generation:1));XCTAssertEqual(t.scheduledVoiceCount,0)
  }
  a.specialMoment(variant:"spaceship",moment:"pull",receipt:5,generation:1);a.beginGeneration(2)
  XCTAssertNil(a.captureMagnetPullCleanup(generation:2));XCTAssertNil(a.captureMagnetPullCleanup(generation:1))
 }
 func testSpaceshipPullUsesV9CoreForceGainAndCapturedCleanupWithoutStoppingNewerVoices()throws {
  let t=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused")),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
  defer{a.dispose()};a.specialMoment(variant:"spaceship",moment:"pull",receipt:1,generation:1)
  XCTAssertEqual(try XCTUnwrap(t.scheduledGain(for:"magnet-pull-force-boiing")),0.6,accuracy:1e-10)
  XCTAssertEqual(t.scheduledVoiceCount,5)
  guard case .voice(let old)?=a.captureMagnetPullCleanup(generation:1) else{return XCTFail("Spaceship must capture the actual authored Force voices")}
  XCTAssertNil(a.captureMagnetPullCleanup(generation:1))
  a.specialMoment(variant:"spaceship",moment:"pull",receipt:2,generation:1)
  old();XCTAssertEqual(t.scheduledVoiceCount,5,"Old cleanup cannot stop the newer pull")
  guard case .voice(let current)?=a.captureMagnetPullCleanup(generation:1) else{return XCTFail("New pull must own its own captured voices")}
  current();XCTAssertEqual(t.scheduledVoiceCount,0)
 }
 func testActualNativeTransportStopsOnlyCapturedForceAndFoundationPreservingUnrelatedFamily()throws {
  let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused")),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport)
  defer{owner.dispose()};owner.specialMoment(variant:"magnet",moment:"pull",receipt:1,generation:1)
  let stop=try XCTUnwrap(owner.captureMagnetPullStop(generation:1));XCTAssertNil(owner.captureMagnetPullStop(generation:1))
  transport.play(.init(source:"assets/sound/CTA/cta squishy.wav",voice:"unrelated-cta",gain:0.5))
  XCTAssertEqual(transport.scheduledVoiceCount,6);stop();XCTAssertEqual(transport.scheduledVoiceCount,1)
  XCTAssertEqual(transport.scheduledGain(for:"unrelated-cta"),0.5);stop();XCTAssertEqual(transport.scheduledVoiceCount,1)
 }
 func testOldSameGenerationStopCannotStopNewPullObjectsOrReplacementFoundation()throws {
  let t=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused")),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
  defer{a.dispose()};a.specialMoment(variant:"magnet",moment:"pull",receipt:1,generation:1);let old=try XCTUnwrap(a.captureMagnetPullStop(generation:1))
  a.specialMoment(variant:"magnet",moment:"pull",receipt:2,generation:1);let current=try XCTUnwrap(a.captureMagnetPullStop(generation:1))
  old();XCTAssertEqual(t.scheduledVoiceCount,5);current();XCTAssertEqual(t.scheduledVoiceCount,0)
 }
 func testHoneyBottleStopKeepsAuthoredPullLayersAndCorrectForceGain()throws {
  for (variant,gain,pull) in [("honey",0.36,"honeyPull"),("bottle",0.24,"bottlePull")] {
   let t=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused")),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
   defer{a.dispose()};a.specialMoment(variant:variant,moment:"pull",receipt:1,generation:1)
   XCTAssertEqual(try XCTUnwrap(t.scheduledGain(for:"magnet-pull-force-boiing")),gain,accuracy:1e-10)
   let stop=try XCTUnwrap(a.captureMagnetPullStop(generation:1));stop()
   XCTAssertEqual(t.scheduledVoiceCount,NativeAuthoredAudioCatalog.groups[pull]?.count)
   for cue in NativeAuthoredAudioCatalog.groups[pull] ?? [] {XCTAssertNotNil(t.scheduledGain(for:cue.voice))}
  }
 }
 func testStaleRepeatMuteGenerationAndBackgroundNeverReturnAnotherPullCapture()throws {
  let t=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/unused")),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
  defer{a.dispose()};a.specialMoment(variant:"magnet",moment:"pull",receipt:2,generation:1)
  a.specialMoment(variant:"magnet",moment:"pull",receipt:1,generation:1);XCTAssertNotNil(a.captureMagnetPullStop(generation:1))
  a.setEnabled(false);a.specialMoment(variant:"magnet",moment:"pull",receipt:3,generation:1);a.setEnabled(true)
  XCTAssertNil(a.captureMagnetPullStop(generation:1));XCTAssertEqual(t.scheduledVoiceCount,0)
  a.specialMoment(variant:"magnet",moment:"pull",receipt:4,generation:1);a.beginGeneration(2)
  XCTAssertNil(a.captureMagnetPullStop(generation:1));XCTAssertNil(a.captureMagnetPullStop(generation:2))
  a.specialMoment(variant:"magnet",moment:"pull",receipt:1,generation:2);a.setForeground(false)
  XCTAssertNil(a.captureMagnetPullStop(generation:2));XCTAssertEqual(t.scheduledVoiceCount,0)
 }
 @MainActor private final class ReentrantTransport:NativeGameplayAudioTransport {
  @MainActor final class Voice {}
  var voices:[String:Voice]=[:],afterCapture:(()->Void)?,stops=0
  func play(_ cue:NativeAudioCue){voices[cue.voice]=Voice()}
  func captureFade(_ ids:Set<String>)->((Double)->Void)? {
   let captured=ids.compactMap{id in voices[id].map{(id,$0)}}
   let callback=afterCapture;afterCapture=nil;callback?()
   return{[weak self] p in guard let self,p>=1 else{return};for(id,voice)in captured where self.voices[id] === voice {self.voices.removeValue(forKey:id)}}
  }
  func stopAll(){stops+=1;voices=[:]}
  func dispose(){stopAll()}
 }
 func testCaptureProviderReentrantCurrentCueCannotHaveItsCacheOverwrittenByOldCallback()throws {
  let t=ReentrantTransport(),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
  defer{a.dispose()};t.afterCapture={a.specialMoment(variant:"magnet",moment:"pull",receipt:2,generation:1)}
  a.specialMoment(variant:"magnet",moment:"pull",receipt:1,generation:1)
  XCTAssertEqual(t.voices.count,5);let current=try XCTUnwrap(a.captureMagnetPullStop(generation:1));current()
  XCTAssertTrue(t.voices.isEmpty);XCTAssertEqual(t.stops,0);XCTAssertNil(a.captureMagnetPullStop(generation:1))
 }
}

@MainActor private final class BottlePriorityAuditTransport:NativeGameplayAudioTransport {
 var played:[NativeAudioCue]=[],prepared:[[String]]=[]
 func play(_ cue:NativeAudioCue){played.append(cue)}
 func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {prepared.append(sources);return true}
 func stopAll(){}
 func dispose(){}
}
extension NativeMagnetForceCapturedStopTests {
 func testPresentBottleWarmsOnlyCrackOnceAndPrioritizesItWithoutChangingLayers()throws {
  let t=BottlePriorityAuditTransport(),a=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t)
  defer{a.dispose()}
  let tile=NativeTile(id:"bottle",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"bottle")
  let state=NativeBoardState(tiles:[tile])
  a.prepareBottleOnBoard(.init(tiles:[]));XCTAssertTrue(t.prepared.isEmpty)
  a.prepareBottleOnBoard(state);a.prepareBottleOnBoard(state)
  XCTAssertEqual(t.prepared,[["assets/sound/Wild and special kockice/bottle/glass crack.wav"]]);XCTAssertTrue(t.played.isEmpty)
  a.specialMoment(variant:"bottle",moment:"pull",index:4,receipt:1,generation:1)
  XCTAssertEqual(t.played.first?.voice,"bottle-pull-merge-glass-crack")
  let expected=(NativeAuthoredAudioCatalog.groups["bottleForce"] ?? [])+(NativeAuthoredAudioCatalog.groups["bottlePull"] ?? [])
  XCTAssertEqual(t.played.count,8);XCTAssertEqual(Set(t.played.map(\.voice)),Set(expected.map(\.voice)))
  for cue in expected {XCTAssertEqual(t.played.first(where:{$0.voice==cue.voice})?.gain,cue.gain)}
  a.setEnabled(false);a.prepareBottleOnBoard(state);XCTAssertEqual(t.prepared.count,1)
  a.setEnabled(true);a.prepareBottleOnBoard(state);XCTAssertEqual(t.prepared.count,2)
  a.setForeground(false);a.prepareBottleOnBoard(state);XCTAssertEqual(t.prepared.count,2)
  a.setForeground(true);a.prepareBottleOnBoard(state);XCTAssertEqual(t.prepared.count,3)
  a.beginGeneration(2);a.prepareBottleOnBoard(state);XCTAssertEqual(t.prepared.count,3)
  a.prepareBottleOnBoard(.init(tiles:[tile],generation:2));XCTAssertEqual(t.prepared.count,4)
  a.dispose();a.prepareBottleOnBoard(.init(tiles:[tile],generation:2));XCTAssertEqual(t.prepared.count,4)
 }
}
