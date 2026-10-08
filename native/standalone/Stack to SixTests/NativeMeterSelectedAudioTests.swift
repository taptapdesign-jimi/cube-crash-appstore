import XCTest
import AVFAudio
@testable import Stack_to_Six

@MainActor final class NativeMeterSelectedAudioTests:XCTestCase {
 private struct Gold:Decodable {let rows:[Row]}
 private struct Row:Decodable {let id:String?,special:String,sources:[String]}
 func testCatalogMatchesSeventeenExecutedOriginalFamilyPreloadMethods()throws {
  let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SelectedAudioSourceOracle",withExtension:"json"))
  let rows=try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url)).rows
  XCTAssertEqual(rows.count,17)
  for row in rows {XCTAssertEqual(NativeMeterSelectedAudioCatalog.sources(special:row.special,variant:row.id),row.sources)}
  XCTAssertEqual(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"cubero"),[])
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
