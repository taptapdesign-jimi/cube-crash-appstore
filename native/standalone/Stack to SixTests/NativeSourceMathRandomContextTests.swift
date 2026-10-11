import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six
@MainActor final class NativeSourceMathRandomContextTests:XCTestCase {
 private func board(_ seed:UInt64=123)->NativeBoardState {.init(tiles:[.init(id:"six",cell:.init(column:0,row:0),value:6),.init(id:"other",cell:.init(column:4,row:8),value:6)],mode:.journey,board:7,stage:7,rngState:seed)}
 func testActualAppContextFXAndCanonicalCoreBorrowOneFunctionIdentityAndActualDrawOrder()throws {
  var draws=0;let values=[0.1,0.4,0.8]
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{defer{draws+=1};return values[draws]})
  defer{context.dispose();service.dispose()}
  let engine=NativeGameplayEngine(state:board(),sourceMathRandom:context.mathRandom)
  let scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{}))
  XCTAssertTrue(scope.specialIdle.sourceMathRandom === context.mathRandom);XCTAssertTrue(scope.mathRandom === context.mathRandom);XCTAssertTrue(engine.sourceMathRandom === scope.mathRandom)
  XCTAssertEqual(scope.smokeSession.nextVisualRandom(),0.1)
  let result=engine.repairLingeringRegularSix(tileID:"six",generation:1,revision:0)
  XCTAssertTrue(result.accepted);XCTAssertEqual(result.events.first{$0.kind == .spawned}?.value,3)
  XCTAssertEqual(context.smokeSession.nextVisualRandom(),0.8);XCTAssertEqual(draws,3);XCTAssertEqual(engine.state.rngState,123)
 }
 func testActualScopeReplacementDoesNotResetOrForkAppMathFunction()throws {
  var draws=0;let values=[0.1,0.6,0.9]
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{defer{draws+=1};return values[draws]})
  defer{context.dispose();service.dispose()}
  let a=NativeGameplayEngine(state:board(),sourceMathRandom:context.mathRandom)
  let old=try XCTUnwrap(context.beginScene(engine:a,retire:{}))
  XCTAssertEqual(old.smokeSession.nextVisualRandom(),0.1)
  let b=NativeGameplayEngine(state:board(999),sourceMathRandom:context.mathRandom)
  let next=try XCTUnwrap(context.beginScene(engine:b,retire:{}))
  XCTAssertFalse(old.current);XCTAssertTrue(next.current);XCTAssertTrue(old.mathRandom === next.mathRandom)
  XCTAssertTrue(b.repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  XCTAssertEqual(next.smokeSession.nextVisualRandom(),0.9);XCTAssertEqual(draws,3);XCTAssertEqual(b.state.rngState,999)
 }
 func testDefaultRawEngineDoesNotBorrowAppStreamOrChangeExistingContextDraws() {
  var draws=0
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{draws+=1;return 0.3})
  defer{context.dispose();service.dispose()}
  let raw=NativeGameplayEngine(state:board(),recordedRandomChoices:[0.99])
  XCTAssertNil(raw.sourceMathRandom);XCTAssertTrue(raw.repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  XCTAssertEqual(draws,0);XCTAssertEqual(raw.state.activeTiles.first{$0.value != 6}?.value,5)
  XCTAssertEqual(context.smokeSession.nextVisualRandom(),0.3);XCTAssertEqual(draws,1)
 }
 func testOriginalFunctionBindingDoesNotRetainContextScopeOrEngineAcrossActualRetirement()throws {
  var draws=0;var retired=0
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
  defer{service.dispose()}
  var context:NativeGameplaySourceContext?=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{draws+=1;return 0.4})
  weak var weakContext=context
  let stream=try XCTUnwrap(context?.mathRandom)
  var engine:NativeGameplayEngine?=NativeGameplayEngine(state:board(),sourceMathRandom:stream)
  weak var weakEngine=engine
  var scope:NativeGameplaySourceContext.Scope?=context?.beginScene(engine:engine,retire:{retired+=1})
  weak var weakScope=scope
  XCTAssertTrue(scope?.mathRandom === stream);XCTAssertEqual(draws,0)
  scope=nil // actual APP retains the accepted Scope until Context destruction
  XCTAssertNotNil(weakScope)
  context=nil
  XCTAssertNil(weakContext);XCTAssertNil(weakScope);XCTAssertEqual(retired,1)
  XCTAssertNotNil(weakEngine);XCTAssertTrue(try XCTUnwrap(engine).repairLingeringRegularSix(tileID:"six",generation:1,revision:0).accepted)
  XCTAssertEqual(draws,1);XCTAssertEqual(stream.next(),0.4);XCTAssertEqual(draws,2)
  engine=nil
  XCTAssertNil(weakEngine);XCTAssertEqual(retired,1)
  XCTAssertEqual(stream.next(),0.4);XCTAssertEqual(draws,3)
 }

}
