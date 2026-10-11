import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeSourceBoardEntryAudioTests:XCTestCase {
 private final class Transport:NativeGameplayAudioTransport {
  var cues:[NativeAudioCue]=[],stopped:[Set<String>]=[],allStops=0,onPlay:(()->Void)?
  func play(_ cue:NativeAudioCue){cues.append(cue);onPlay?()}
  func stopVoices(_ ids:Set<String>){stopped.append(ids)}
  func stopAll(){allStops+=1}
  func dispose(){stopAll()}
 }
 private let ids:Set<String>=["board-popin-setting-up","board-popin-plump","board-popin-setting-up2","board-popin-cubes"]
 func testOriginalFourLayersUseCapturedDurationAndSelectiveStopWithoutMath()throws {
  let t=Transport();var draws=0;let owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t,random:{draws+=1;return 0.5});defer{owner.dispose()}
  let stop=try XCTUnwrap(owner.startSourceBoardEntrySound(duration:0.83,receipt:1,generation:1))
  XCTAssertEqual(Set(t.cues.map(\.voice)),ids);XCTAssertEqual(t.cues.map(\.gain),[0.3,0.42,0.42,0.24]);XCTAssertTrue(t.cues.allSatisfy{$0.stopAfter==0.83 && $0.fadeOut==0.05});XCTAssertEqual(draws,0)
  stop();stop();XCTAssertEqual(t.stopped,[ids,ids]);XCTAssertEqual(t.allStops,0)
 }
 func testStaleStopCannotCancelSuccessorOrGenericBoardExit()throws {
  let t=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t);defer{owner.dispose()}
  let old=try XCTUnwrap(owner.startSourceBoardEntrySound(duration:1,receipt:1,generation:1));let current=try XCTUnwrap(owner.startSourceBoardEntrySound(duration:1,receipt:2,generation:1));let count=t.stopped.count
  old();XCTAssertEqual(t.stopped.count,count);current();XCTAssertEqual(t.stopped.count,count+1)
  let retired=try XCTUnwrap(owner.startSourceBoardEntrySound(duration:1,receipt:3,generation:1));owner.routeFeedback("board-exit",receipt:1,generation:1,duration:1);let after=t.stopped.count;retired();XCTAssertEqual(t.stopped.count,after)
 }
 func testSettingsOffConsumesReceiptAndGenerationRetiresCapturedClosure()throws {
  let t=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:false,transport:t);defer{owner.dispose()}
  let off=try XCTUnwrap(owner.startSourceBoardEntrySound(duration:0.02,receipt:1,generation:1));XCTAssertTrue(t.cues.isEmpty);owner.setEnabled(true);XCTAssertNil(owner.startSourceBoardEntrySound(duration:0.02,receipt:1,generation:1));let newer=try XCTUnwrap(owner.startSourceBoardEntrySound(duration:0.02,receipt:2,generation:1));XCTAssertTrue(t.cues.allSatisfy{$0.fadeOut==0.02})
  owner.beginGeneration(2);let count=t.stopped.count;off();newer();XCTAssertEqual(t.stopped.count,count);XCTAssertNil(owner.startSourceBoardEntrySound(duration:1,receipt:3,generation:1))
 }
 func testReentrantPlayRetirementRefusesOldRemainingLayers() {
  let t=Transport(),owner=NativeGameplayAudioOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:t);defer{owner.dispose()}
  t.onPlay={owner.beginGeneration(2)}
  XCTAssertNil(owner.startSourceBoardEntrySound(duration:1,receipt:1,generation:1));XCTAssertEqual(t.cues.count,1)
 }
}
