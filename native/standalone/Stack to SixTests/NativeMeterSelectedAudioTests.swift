import XCTest
import AVFAudio
@testable import Stack_to_Six

@MainActor final class NativeMeterSelectedAudioTests:XCTestCase {
 nonisolated private final class ControlLog:@unchecked Sendable {
  private let lock=NSLock()
  private var entries:[String]=[]
  func append(_ value:String){lock.withLock{entries.append(value)}}
  var values:[String]{lock.withLock{entries}}
 }
 func testLoopConfigurationIsQueueOwnedAndResetForNextOneShot()async {
  let log=ControlLog(),queue=DispatchQueue(label:"native-coconut-loop-test")
  let file=NativeSelectedAudioFile(source:"assets/sound/selected.wav",bytes:4,duration:0.02,queue:queue,
   operations:.init(start:{_,_,_ in log.append("start");return true},stop:{log.append("stop")},gain:{_,duration in log.append("fade:\(duration)")},reset:{true},looping:{log.append("loop:\($0)")}))
  let first=NativeSelectedAudioFile.ControlLease(),started=expectation(description:"loop starts")
  file.start(first,rate:1,gain:0.3,looping:true,completion:{_,_ in},started:{ok in XCTAssertTrue(ok);started.fulfill()})
  await fulfillment(of:[started],timeout:2);file.fadeOut(duration:0.25,lease:first)
  let stopped=expectation(description:"loop stops");file.stop(first){_ in stopped.fulfill()};await fulfillment(of:[stopped],timeout:2)
  let second=NativeSelectedAudioFile.ControlLease(),again=expectation(description:"one shot starts")
  file.start(second,rate:1,gain:0.3,completion:{_,_ in},started:{ok in XCTAssertTrue(ok);again.fulfill()});await fulfillment(of:[again],timeout:2)
  XCTAssertEqual(log.values.filter{$0.hasPrefix("loop:")},["loop:true","loop:false"])
  let done=expectation(description:"cleanup");file.stop(second){_ in done.fulfill()};await fulfillment(of:[done],timeout:2)
 }
 func testRetiredQueuedStartBehindPreparationCannotReachAudioOperations()async {
  let queue=DispatchQueue(label:"native-test-blocked-selected-audio"),gate=DispatchSemaphore(value:0),log=ControlLog()
  queue.async{gate.wait()}
  let file=NativeSelectedAudioFile(source:"assets/sound/selected.wav",bytes:4,duration:2,queue:queue,
   operations:.init(start:{_,_,_ in log.append("start");return true},stop:{log.append("stop")},gain:{_,_ in log.append("gain")},reset:{log.append("reset");return true}))
  let lease=NativeSelectedAudioFile.ControlLease(),retired=expectation(description:"Exact retired queue receipt")
  file.start(lease,rate:1.3,gain:0.23,completion:{_,_ in XCTFail("No queued cancelled voice can end")},started:{success in XCTAssertFalse(success)})
  file.stop(lease){success in XCTAssertTrue(success);retired.fulfill()}
  gate.signal();await fulfillment(of:[retired],timeout:2)
  XCTAssertTrue(log.values.isEmpty);XCTAssertFalse(lease.current)
 }
 func testClaimedAudioStartStopsItsExactLeaseBeforeRecyclingAndRejectsLateGains()async {
  let queue=DispatchQueue(label:"native-test-claimed-selected-audio"),gate=DispatchSemaphore(value:0),log=ControlLog()
  let entered=expectation(description:"Worker claimed start"),retired=expectation(description:"Worker stopped exact voice"),reset=expectation(description:"Same queue reset")
  let file=NativeSelectedAudioFile(source:"assets/sound/selected.wav",bytes:4,duration:2,queue:queue,
   operations:.init(start:{rate,gain,_ in log.append("start:\(rate):\(gain)");entered.fulfill();gate.wait();return true},stop:{log.append("stop")},gain:{_,_ in log.append("gain")},reset:{log.append("reset");return true}))
  let lease=NativeSelectedAudioFile.ControlLease()
  file.start(lease,rate:1.3,gain:0.23,completion:{_,_ in},started:{success in XCTAssertFalse(success)})
  await fulfillment(of:[entered],timeout:2)
  file.stop(lease){success in XCTAssertTrue(success);retired.fulfill()}
  file.setGain(0.8,lease:lease);file.fadeOut(duration:0.12,lease:lease)
  gate.signal();await fulfillment(of:[retired],timeout:2)
  file.reset{success in XCTAssertTrue(success);reset.fulfill()}
  await fulfillment(of:[reset],timeout:2)
  XCTAssertEqual(log.values,["start:1.3:0.23","stop","reset"])
 }
 func testWorkerCoalescesGainAndOldStopCannotDisposeReplacementLease()async {
  let queue=DispatchQueue(label:"native-test-ordered-selected-audio"),gate=DispatchSemaphore(value:0),log=ControlLog()
  let file=NativeSelectedAudioFile(source:"assets/sound/selected.wav",bytes:4,duration:2,queue:queue,
   operations:.init(start:{_,_,_ in log.append("start");return true},stop:{log.append("stop")},gain:{gain,_ in log.append("gain:\(gain)")},reset:{true}))
  let old=NativeSelectedAudioFile.ControlLease(),first=expectation(description:"First started"),stopped=expectation(description:"First stopped")
  file.start(old,rate:1,gain:0.2,completion:{_,_ in},started:{success in XCTAssertTrue(success);first.fulfill()})
  await fulfillment(of:[first],timeout:2);file.stop(old){_ in stopped.fulfill()};await fulfillment(of:[stopped],timeout:2)
  let current=NativeSelectedAudioFile.ControlLease(),second=expectation(description:"Replacement started"),late=expectation(description:"Old stop refused")
  file.start(current,rate:1,gain:0.2,completion:{_,_ in},started:{success in XCTAssertTrue(success);second.fulfill()})
  await fulfillment(of:[second],timeout:2)
  queue.async{gate.wait()};file.setGain(0.4,lease:current);file.setGain(0.8,lease:current)
  file.stop(old){success in XCTAssertFalse(success);late.fulfill()}
  gate.signal();await fulfillment(of:[late],timeout:2)
  XCTAssertEqual(log.values,["start","stop","start","gain:0.8"]);XCTAssertTrue(current.current)
  let done=expectation(description:"Replacement cleanup");file.stop(current){_ in done.fulfill()};await fulfillment(of:[done],timeout:2)
 }
 func testExactVoiceCancellationPreservesCoalescedLiveConsumerAndRejectsUnownedDecode() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var reply:Cache.Completion?,outcomes:[String:Cache.Outcome]=[:]
  let owner=Cache(load:{_,done in reply=done})
  _=owner.prepare(sources:["a"],requestID:"old",generation:1){outcomes["old"]=$0}
  _=owner.prepare(sources:["a"],requestID:"live",generation:1){outcomes["live"]=$0}
  owner.cancel(requestID:"old");reply?(.init(asset:"actual",bytes:4))
  XCTAssertEqual(outcomes["old"],.retired);XCTAssertEqual(outcomes["live"],.settled(unavailable:[]))
  XCTAssertEqual(owner.take("a"),"actual")
  _=owner.prepare(sources:["b"],requestID:"stopped",generation:1){outcomes["stopped"]=$0}
  owner.cancel(requestID:"stopped");reply?(.init(asset:"orphan",bytes:4))
  XCTAssertEqual(outcomes["stopped"],.retired);XCTAssertEqual(owner.preparedCount,0)
 }
 func testStoppedQueuedVoiceNeverStartsItsDecode() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var sources:[String]=[],reply:Cache.Completion?,retired:[Cache.Outcome]=[]
  let owner=Cache(concurrency:1,load:{source,done in sources.append(source);reply=done})
  _=owner.prepare(sources:["active"],requestID:"active",generation:1)
  _=owner.prepare(sources:["queued"],requestID:"stopped",generation:1){retired.append($0)}
  owner.cancel(requestID:"stopped");reply?(.init(asset:"active",bytes:1))
  XCTAssertEqual(sources,["active"]);XCTAssertEqual(retired,[.retired]);XCTAssertEqual(owner.maximumActive,1)
 }
 func testColdTransportUsesSelectedQueueAndReplacementStopRejectsLateCompletion()async throws {
  typealias Cache=NativeSelectedAudioPreparation<NativeSelectedAudioFile>
  var replies:[Cache.Completion]=[],sources:[String]=[],ended:[NativeAudioCompletion]=[]
  let preparation=Cache(concurrency:2,load:{source,done in sources.append(source);replies.append(done)})
  let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/missing"),preparation:preparation)
  let cue=NativeAudioCue(source:"assets/sound/selected-original.wav",voice:"same",gain:0.37,rate:1.2)
  transport.play(cue){ended.append($0)}
  for _ in 0..<10 where replies.isEmpty {await Task.yield()}
  XCTAssertEqual(sources,[cue.source]);XCTAssertEqual(transport.openedFileCount,0);XCTAssertTrue(ended.isEmpty)
  transport.play(cue){ended.append($0)}
  for _ in 0..<10 {await Task.yield()}
  XCTAssertEqual(ended,[.stopped]);XCTAssertEqual(transport.scheduledVoiceCount,1)
  transport.stopAll();replies[0](nil)
  XCTAssertEqual(ended,[.stopped,.stopped]);XCTAssertEqual(transport.scheduledVoiceCount,0)
  transport.dispose()
 }
 func testPreparedTransportHitTransfersPlayerWithoutSelectedReload()async throws {
  typealias Cache=NativeSelectedAudioPreparation<NativeSelectedAudioFile>
  let source="assets/sound/merge 6/woosh.mp3"
  let file=try XCTUnwrap(NativeSelectedAudioFile.decode(root:NativeTestResources.root,source:source))
  var loads=0
  let preparation=Cache(load:{_,done in loads+=1;done(.init(asset:file,bytes:file.estimatedDecodedBytes))})
  XCTAssertTrue(preparation.prepare(sources:[source],requestID:"prewarm",generation:1))
  let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root,preparation:preparation)
  transport.play(.init(source:source,voice:"prepared",gain:0.23,rate:1.2))
  let deadline=Date().addingTimeInterval(2)
  while transport.openedFileCount==0,Date()<deadline {try await Task.sleep(for:.milliseconds(5))}
  XCTAssertEqual(loads,1);XCTAssertEqual(preparation.preparedCount,0)
  XCTAssertEqual(transport.openedFileCount,1);XCTAssertEqual(transport.scheduledGain(for:"prepared"),0.23)
  transport.dispose()
 }
 func testColdTransportSettingsBackgroundAndDisposeRetirePendingVoiceOnce()async throws {
  typealias Cache=NativeSelectedAudioPreparation<NativeSelectedAudioFile>
  for boundary in 0..<3 {
   var reply:Cache.Completion?,ended:[NativeAudioCompletion]=[]
   let preparation=Cache(load:{_,done in reply=done})
   let transport=NativeAVGameplayAudioTransport(root:URL(fileURLWithPath:"/missing"),preparation:preparation)
   transport.play(.init(source:"assets/sound/exact.wav",voice:"pending",gain:0.2)){ended.append($0)}
   for _ in 0..<10 where reply==nil {await Task.yield()}
   XCTAssertNotNil(reply)
   if boundary==0 {transport.setSelectedPreparationEnabled(false)}
   else if boundary==1 {transport.setSelectedPreparationForeground(false)}
   else {transport.dispose()}
   reply?(nil)
   XCTAssertEqual(ended,[.stopped]);XCTAssertEqual(transport.openedFileCount,0);XCTAssertEqual(transport.scheduledVoiceCount,0)
   transport.setSelectedPreparationEnabled(true);transport.setSelectedPreparationForeground(true)
   XCTAssertEqual(ended,[.stopped]);transport.dispose()
  }
 }
 func testSameCueReusesReturnedPlayerAndOldDelegateCannotRetireNewVoice()async throws {
  typealias Cache=NativeSelectedAudioPreparation<NativeSelectedAudioFile>
  let source="assets/sound/merge 6/woosh.mp3"
  let file=try XCTUnwrap(NativeSelectedAudioFile.decode(root:NativeTestResources.root,source:source))
  var loads=0,endings:[NativeAudioCompletion]=[]
  let preparation=Cache(recycle:{loaded,done in loaded.asset.reset{success in done(success ? loaded:nil)}},load:{_,done in loads+=1;done(.init(asset:file,bytes:file.estimatedDecodedBytes))})
  let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root,preparation:preparation)
  let cue=NativeAudioCue(source:source,voice:"reused",gain:0.23,stopAfter:20)
  transport.play(cue){endings.append($0)}
  let startDeadline=Date().addingTimeInterval(2)
  while transport.openedFileCount==0,Date()<startDeadline {try await Task.sleep(for:.milliseconds(5))}
  let oldDelegate=try XCTUnwrap(transport.capturedCompletionReceipt(for:cue.voice))
  transport.stopVoices([cue.voice])
  let returnedDeadline=Date().addingTimeInterval(2)
  while preparation.preparedCount==0,Date()<returnedDeadline {try await Task.sleep(for:.milliseconds(5))}
  XCTAssertEqual(preparation.preparedCount,1)
  transport.play(cue){endings.append($0)}
  let replacementDeadline=Date().addingTimeInterval(2)
  while transport.openedFileCount==0,Date()<replacementDeadline {try await Task.sleep(for:.milliseconds(5))}
  XCTAssertEqual(loads,1);XCTAssertEqual(transport.openedFileCount,1)
  oldDelegate(true,nil)
  for _ in 0..<10 {await Task.yield()}
  XCTAssertEqual(endings,[.stopped]);XCTAssertEqual(transport.scheduledVoiceCount,1)
  transport.dispose();XCTAssertEqual(endings,[.stopped,.stopped])
 }
 func testReturnedIdlePreparationUsesSameBudgetAndRejectsLateLifecycleReceipts() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var returns:[Cache.Completion]=[]
  let owner=Cache(concurrency:2,budgetBytes:8,recycle:{_,done in returns.append(done)},load:{_,_ in})
  owner.returnIdle(.init(asset:"old",bytes:4),source:"a",generation:1)
  owner.setForeground(false);returns[0](.init(asset:"late",bytes:4));XCTAssertEqual(owner.preparedCount,0)
  owner.setForeground(true)
  owner.returnIdle(.init(asset:"off",bytes:4),source:"a",generation:1)
  owner.setEnabled(false);returns[1](.init(asset:"late-off",bytes:4));XCTAssertEqual(owner.preparedCount,0)
  owner.setEnabled(true)
  owner.returnIdle(.init(asset:"first",bytes:6),source:"a",generation:1);returns[2](.init(asset:"first",bytes:6))
  owner.returnIdle(.init(asset:"second",bytes:6),source:"b",generation:1);returns[3](.init(asset:"second",bytes:6))
  XCTAssertEqual(owner.preparedBytes,6);XCTAssertNil(owner.take("a"));XCTAssertEqual(owner.take("b"),"second")
  owner.returnIdle(.init(asset:"stale-generation",bytes:4),source:"a",generation:1);owner.beginGeneration(2)
  returns[4](.init(asset:"stale-generation",bytes:4));XCTAssertEqual(owner.preparedCount,0)
 }
 func testEncodedTraversalNeverCreatesPendingVoiceOrDecode() {
  typealias Cache=NativeSelectedAudioPreparation<NativeSelectedAudioFile>
  var loads=0,endings:[NativeAudioCompletion]=[]
  let preparation=Cache(load:{_,_ in loads+=1})
  let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root,preparation:preparation)
  transport.play(.init(source:"assets/sound/%2e%2e/%2e%2e/AGENTS.md",voice:"invalid",gain:0.2)){endings.append($0)}
  XCTAssertEqual(endings,[.unavailable]);XCTAssertEqual(loads,0);XCTAssertEqual(transport.scheduledVoiceCount,0);transport.dispose()
 }
 func testPreparationErrorCallbackCannotStopReentrantReplacementVoice()async throws {
  typealias Cache=NativeSelectedAudioPreparation<NativeSelectedAudioFile>
  var replies:[String:Cache.Completion]=[:],old:[NativeAudioCompletion]=[],replacement:[NativeAudioCompletion]=[]
  let preparation=Cache(load:{source,done in replies[source]=done})
  let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root,preparation:preparation)
  transport.onError={_ in
   transport.onError=nil
   transport.play(.init(source:"assets/sound/replacement.wav",voice:"same",gain:0.2)){replacement.append($0)}
  }
  transport.play(.init(source:"assets/sound/failed.wav",voice:"same",gain:0.2)){old.append($0)}
  for _ in 0..<10 where replies["assets/sound/failed.wav"]==nil {await Task.yield()}
  try XCTUnwrap(replies["assets/sound/failed.wav"])(nil)
  for _ in 0..<10 where replies["assets/sound/replacement.wav"]==nil {await Task.yield()}
  XCTAssertEqual(old,[.stopped]);XCTAssertTrue(replacement.isEmpty)
  XCTAssertEqual(transport.scheduledVoiceCount,1);XCTAssertNotNil(replies["assets/sound/replacement.wav"])
  transport.dispose();XCTAssertEqual(replacement,[.stopped])
 }
 private struct Gold:Decodable {let rows:[Row]}
 private struct Row:Decodable {let id:String?,special:String,sources:[String]}
 func testCatalogMatchesSeventeenExecutedOriginalFamilyPreloadMethods()throws {
  let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SelectedAudioSourceOracle",withExtension:"json"))
  let rows=try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url)).rows
  XCTAssertEqual(rows.count,17)
  for row in rows {XCTAssertEqual(NativeMeterSelectedAudioCatalog.sources(special:row.special,variant:row.id),row.sources)}
  XCTAssertEqual(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"cubero"),["./assets/sound/Wild and special kockice/cubero/haya.wav"])
  XCTAssertEqual(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"mushroom"),[])
  XCTAssertNil(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"unknown"))
 }
 func testCoalescingUsesBoundedActualCompletionAndBorrowConsumesPreparedMedia() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var loaders:[String:Cache.Completion]=[:],outcomes:[String:Cache.Outcome]=[:]
  let owner=Cache(concurrency:2,load:{source,done in loaders[source]=done})
  XCTAssertTrue(owner.prepare(sources:["a","a","b","c"],requestID:"first",generation:1){outcomes["first"]=$0})
  XCTAssertTrue(owner.prepare(sources:["a"],requestID:"second",generation:1){outcomes["second"]=$0})
  XCTAssertEqual(Set(loaders.keys),["a","b"]);XCTAssertTrue(outcomes.isEmpty)
  loaders["a"]?(.init(asset:"a prepared",bytes:4));XCTAssertEqual(outcomes["second"],.settled(unavailable:[]))
  XCTAssertNotNil(loaders["c"]);loaders["b"]?(.init(asset:"b prepared",bytes:4));loaders["c"]?(.init(asset:"c prepared",bytes:4))
  XCTAssertEqual(outcomes["first"],.settled(unavailable:[]));XCTAssertEqual(owner.maximumActive,2)
  XCTAssertEqual(owner.take("a"),"a prepared");XCTAssertNil(owner.take("a"));XCTAssertEqual(owner.preparedBytes,8)
  loaders["a"]?(.init(asset:"duplicate",bytes:999));XCTAssertEqual(owner.preparedBytes,8)
 }
 func testSettingsAndBackgroundRetirePendingWorkWithoutReplayOrVoice() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var callbacks:[Cache.Completion]=[],outcomes:[Cache.Outcome]=[]
  let owner=Cache(load:{_,done in callbacks.append(done)})
  XCTAssertTrue(owner.prepare(sources:["a"],requestID:"a",generation:1){outcomes.append($0)})
  owner.setEnabled(false);XCTAssertEqual(outcomes,[.retired]);callbacks[0](.init(asset:"stale",bytes:1));XCTAssertNil(owner.take("a"))
  owner.setEnabled(true);XCTAssertEqual(callbacks.count,1)
  XCTAssertTrue(owner.prepare(sources:["b"],requestID:"b",generation:1){outcomes.append($0)})
  owner.setForeground(false);XCTAssertEqual(outcomes,[.retired,.retired]);callbacks[1](.init(asset:"stale",bytes:1))
  XCTAssertFalse(owner.prepare(sources:["c"],requestID:"c",generation:1));owner.setForeground(true)
  XCTAssertEqual(callbacks.count,2);XCTAssertNil(owner.take("b"));XCTAssertEqual(owner.preparedBytes,0)
 }
 func testOldGenerationCannotPopulateOrSettleReplacementSameSource() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var callbacks:[Cache.Completion]=[],old:[Cache.Outcome]=[],new:[Cache.Outcome]=[]
  let owner=Cache(load:{_,done in callbacks.append(done)})
  _=owner.prepare(sources:["a"],requestID:"old",generation:1){old.append($0)};owner.beginGeneration(2)
  _=owner.prepare(sources:["a"],requestID:"new",generation:2){new.append($0)}
  callbacks[0](.init(asset:"old",bytes:3));XCTAssertEqual(old,[.retired]);XCTAssertTrue(new.isEmpty);XCTAssertNil(owner.take("a"))
  callbacks[1](.init(asset:"new",bytes:3));XCTAssertEqual(new,[.settled(unavailable:[])]);XCTAssertEqual(owner.take("a"),"new")
 }
 func testReentrantDisposeRetiresRemainingCoalescedConsumersOnce() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var reply:Cache.Completion?,a:[Cache.Outcome]=[],b:[Cache.Outcome]=[]
  let owner=Cache(load:{_,done in reply=done})
  _=owner.prepare(sources:["x"],requestID:"a",generation:1){a.append($0);owner.dispose()}
  _=owner.prepare(sources:["x"],requestID:"b",generation:1){b.append($0)}
  reply?(.init(asset:"prepared",bytes:1));XCTAssertEqual(a,[.settled(unavailable:[])]);XCTAssertEqual(b,[.retired])
  reply?(.init(asset:"duplicate",bytes:1));XCTAssertEqual(a.count,1);XCTAssertEqual(b.count,1);XCTAssertEqual(owner.preparedBytes,0)
 }
 func testSelectedFamilyBudgetRejectsExcessAndOnlyEvictsFormerIdleEntries() {
  typealias Cache=NativeSelectedAudioPreparation<String>
  var replies:[String:Cache.Completion]=[:],results:[Cache.Outcome]=[]
  let owner=Cache(budgetBytes:10,load:{source,done in replies[source]=done})
  _=owner.prepare(sources:["a","b"],requestID:"first",generation:1){results.append($0)}
  replies["a"]?(.init(asset:"a",bytes:6));replies["b"]?(.init(asset:"b",bytes:6))
  XCTAssertEqual(results,[.settled(unavailable:["b"])]);XCTAssertEqual(owner.preparedBytes,6)
  _=owner.prepare(sources:["next"],requestID:"next",generation:1){results.append($0)}
  replies["next"]?(.init(asset:"next",bytes:6));XCTAssertEqual(owner.preparedBytes,6);XCTAssertNil(owner.take("a"));XCTAssertEqual(owner.take("next"),"next")
 }
 func testNinetyOriginalAudioFilesValidateWithoutPretendingNativePreparation()throws {
  let root=NativeTestResources.root
  let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SelectedAudioSourceOracle",withExtension:"json"))
  let rows=try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url)).rows
  let selected=Set(rows.flatMap(\.sources));XCTAssertEqual(selected.count,90)
  for source in selected.sorted() {
   let metadata=try XCTUnwrap(NativeSelectedAudioFile.inspect(root:root,source:source),source)
   let player=try AVAudioPlayer(contentsOf:root.appendingPathComponent(metadata.relativePath))
   XCTAssertFalse(player.isPlaying,source);XCTAssertEqual(player.currentTime,0,accuracy:1e-9)
   XCTAssertGreaterThan(player.duration,0);XCTAssertGreaterThan(metadata.estimatedDecodedBytes,0)
   // Platform output availability is deliberately NOT inferred from file
   // metadata or a player constructor. The iOS test separately requires actual
   // default prepareToPlay success under the existing app session.
  }
 }
 func testEncodedOriginalPathsDecodeButTraversalAndMissingFilesCannotPrepare() {
  let root=NativeTestResources.root
  XCTAssertNil(NativeSelectedAudioFile.decode(root:root,source:"assets/sound/%2e%2e/%2e%2e/AGENTS.md"))
  XCTAssertNil(NativeSelectedAudioFile.decode(root:root,source:"assets/sound/missing.wav"))
  XCTAssertNil(NativeSelectedAudioFile.decode(root:root,source:"/etc/hosts"))
 }
 func testActualSerialNativeMissingDecodeSettlesUnavailableWithoutPreparedAsset()async throws {
  let owner=NativeSelectedAudioNativePreparation.make(root:NativeTestResources.root)
  var outcomes:[NativeSelectedAudioPreparation<NativeSelectedAudioFile>.Outcome]=[]
  XCTAssertTrue(owner.prepare(sources:["assets/sound/missing-original-native-preload.wav"],requestID:"actual-missing",generation:1){outcomes.append($0)})
  let deadline=Date().addingTimeInterval(3)
  while outcomes.isEmpty,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
  XCTAssertEqual(outcomes,[.settled(unavailable:["assets/sound/missing-original-native-preload.wav"])])
  XCTAssertEqual(owner.preparedCount,0);XCTAssertNil(owner.take("assets/sound/missing-original-native-preload.wav"));owner.dispose()
 }

}
