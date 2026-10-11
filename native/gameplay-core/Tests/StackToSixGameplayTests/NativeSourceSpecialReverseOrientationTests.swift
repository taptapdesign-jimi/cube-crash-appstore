import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceSpecialReverseOrientationTests:XCTestCase {
 func testReverseSpecialNeedsActualFirstFaceAndWildWildRemainsSourceBlocked()throws {
  let specials:[(NativeWildArchetype,String?)]=[(.magnet,nil),(.tnt,nil)]+NativeSpecialDiceRegistry.variants.values.filter{$0.archetype == .magnet || $0.archetype == .tnt}.map{($0.archetype,Optional($0.id))}
  for (core,variant) in specials {
   for sourceWild in [false,true] {
    let source=NativeTile(id:"s",cell:.init(column:0,row:0),value:sourceWild ? 6:2,stackDepth:2,archetype:sourceWild ? .star:nil)
    let destination=NativeTile(id:"d",cell:.init(column:1,row:0),value:6,stackDepth:3,archetype:core,variant:variant)
    let stream=NativeSourceMathRandomStream(draw:{0.5})
    let e=NativeGameplayEngine(state:.init(tiles:[source,destination,.init(id:"other",cell:.init(column:2,row:0),value:1)],score:123),sourceMathRandom:stream)
    e.sourceMagnetMain80Enabled=core == .magnet;e.sourceTntMain80Enabled=core == .tnt;e.stagedTntActivation=core == .tnt
    e.laserViewportWidth=390;e.laserTargetX={Double($0.cell.column)*60}
    XCTAssertTrue(e.beginDrag(tileID:source.id));let dropped=e.drop(target:destination.cell)
    if sourceWild {XCTAssertFalse(dropped.accepted);XCTAssertEqual(dropped.resolution.reason,"illegal_drop");XCTAssertNil(e.pendingSpecial);continue}
    XCTAssertTrue(dropped.accepted,(variant ?? core.rawValue)+":"+String(describing:dropped.resolution))
    let plan=try XCTUnwrap(e.pendingSpecial),before=e.state
    let prepared=try XCTUnwrap(e.state.tiles.first{$0.id==destination.id})
    XCTAssertEqual(prepared.variant,variant);XCTAssertEqual(prepared.value,6);XCTAssertEqual(prepared.stackDepth,4)
    XCTAssertTrue(prepared.visible);XCTAssertTrue(prepared.sourceWildStateCleared);XCTAssertFalse(prepared.isWild)
    let receipt=try XCTUnwrap(e.prepareSourceSpecialWildDestinationFace(transactionID:plan.id,generation:plan.generation))
    let main=try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation))
    XCTAssertFalse(e.commitSourceSpecialAbsorbMain(receiptID:main.id,generation:main.generation).accepted)
    XCTAssertTrue(e.commitSourceSpecialWildDestinationFace(receiptID:receipt.face.id,generation:plan.generation).accepted)
    XCTAssertEqual(e.state.rngState,before.rngState);XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score)
    XCTAssertTrue(e.state.tiles.first{$0.id==destination.id}?.sourceResidualWildPresence == true)
    XCTAssertFalse(e.commitSourceSpecialWildDestinationFace(receiptID:receipt.face.id,generation:plan.generation).accepted)
    XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:main.id,generation:main.generation).accepted)
   }
  }
 }
}
