import XCTest
import AVFAudio
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeMeterSelectedAudioHostTests:XCTestCase {
 private func until(_ predicate:()->Bool) async throws {
  let deadline=CACurrentMediaTime()+4
  while !predicate(),CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(10))}
  XCTAssertTrue(predicate(),"Actual native selected preload receipt")
 }
 func testActualNativeSelectedPlayerPreparationAndSameTransportBorrowStartNoPreloadVoice() async throws {
  let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root);defer{transport.dispose()}
  let sources=try XCTUnwrap(NativeMeterSelectedAudioCatalog.sources(special:"wild-magnet",variant:nil))
  XCTAssertTrue(transport.prepareSelectedSources(Array(sources.prefix(1)),capture:"captured-meter",generation:3))
  try await until{transport.preparedSourceCount==1}
  XCTAssertEqual(transport.scheduledVoiceCount,0);XCTAssertEqual(transport.openedFileCount,0)
  let source=try XCTUnwrap(NativeSelectedAudioFile.canonicalPath(sources[0]))
  transport.play(NativeAudioCue(source:source,voice:"prepared-original",gain:0))
  try await until{transport.openedFileCount==1}
  XCTAssertEqual(transport.preparedSourceCount,0,"Existing voice actually consumes the prepared player")
  XCTAssertEqual(transport.scheduledVoiceCount,1);transport.stopAll();XCTAssertEqual(transport.scheduledVoiceCount,0)
 }
 func testActualNinetyOriginalFilesPrepareUnderExistingNativeSessionWithoutPlaying()throws {
  let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SelectedAudioSourceOracle",withExtension:"json"))
  struct Gold:Decodable {let rows:[Row]};struct Row:Decodable {let sources:[String]}
  let sources=Set(try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url)).rows.flatMap(\.sources));XCTAssertEqual(sources.count,90)
  for source in sources.sorted() {
   let file=try XCTUnwrap(NativeSelectedAudioFile.decode(root:NativeTestResources.root,source:source),source)
   XCTAssertFalse(file.player.isPlaying,source);XCTAssertEqual(file.player.currentTime,0,accuracy:1e-9)
   XCTAssertGreaterThan(file.estimatedDecodedBytes,0)
  }
 }
 func testNativeOwnerGuardsSelectedFamilyPreparationAcrossSettingsGenerationAndForeground() {
  @MainActor final class Recording:NativeGameplayAudioTransport {
   var calls:[[String]]=[];var voices=0;var enabled:[Bool]=[],foreground:[Bool]=[]
   func play(_ cue:NativeAudioCue){voices+=1}
   func stopAll(){}
   func dispose(){}
   func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {calls.append(sources);return true}
   func setSelectedPreparationEnabled(_ value:Bool){enabled.append(value)}
   func setSelectedPreparationForeground(_ value:Bool){foreground.append(value)}
  }
  let sink=Recording(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:sink);defer{owner.dispose()}
  owner.beginGeneration(9)
  XCTAssertFalse(owner.prepareSelectedSpecial(special:"wild-tnt",variant:"flower",capture:"old",generation:8))
  XCTAssertTrue(owner.prepareSelectedSpecial(special:"wild-tnt",variant:"flower",capture:"actual",generation:9))
  XCTAssertEqual(sink.calls.first,NativeMeterSelectedAudioCatalog.sources(special:"wild-tnt",variant:"flower"))
  owner.setEnabled(false);XCTAssertFalse(owner.prepareSelectedSpecial(special:"wild",variant:nil,capture:"muted",generation:9))
  owner.setEnabled(true);XCTAssertEqual(sink.calls.count,1)
  owner.setForeground(false);XCTAssertFalse(owner.prepareSelectedSpecial(special:"wild",variant:nil,capture:"hidden",generation:9))
  owner.setForeground(true);XCTAssertEqual(sink.calls.count,1);XCTAssertEqual(sink.voices,0)
  owner.dispose();XCTAssertFalse(owner.prepareSelectedSpecial(special:"wild",variant:nil,capture:"disposed",generation:9));XCTAssertEqual(sink.calls.count,1)
 }
}
