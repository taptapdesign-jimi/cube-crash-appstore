import XCTest
@testable import Stack_to_Six
nonisolated final class NativeMeterSelectedWarmupTests:XCTestCase {
 private typealias Warmup=NativeMeterSelectedFinaleWarmup<Int>
 private struct Row:Decodable {let id:String?;let special:String;let preOpenTntPaths:[String];let preOpenDOMPaths:[String];let committedJuicePaths:[String]}
 private struct Oracle:Decodable {let rows:[Row]}
 @MainActor func testLiteralSelected17SourcePlansPreservePreferredFallbackAndNoUnselectedFamilies()throws {
  let url=try XCTUnwrap(Bundle(for:NativeMeterSelectedWarmupTests.self).url(forResource:"SelectedWarmupOracle",withExtension:"json")),o=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url));XCTAssertEqual(o.rows.count,17)
  for r in o.rows {let p=try XCTUnwrap(NativeMeterSelectedWarmupCatalog.plan(special:r.special,variant:r.id));XCTAssertEqual(p.preOpen.map{$0.candidates[0]},r.preOpenTntPaths+r.preOpenDOMPaths);XCTAssertEqual(p.committed.map{$0.candidates[0]},r.committedJuicePaths)
   for a in p.preOpen.prefix(r.preOpenTntPaths.count) where a.candidates[0].contains("@2x.png") {XCTAssertEqual(a.candidates,[a.candidates[0],a.candidates[0].replacingOccurrences(of:"@2x.png",with:".png")])}
  };XCTAssertNil(NativeMeterSelectedWarmupCatalog.plan(special:"wild",variant:"unregistered"))
 }
 @MainActor func testBeforeOpenStartsButReadyRequiresActualSelectedGroupsAndCommit()throws {
  let p=try XCTUnwrap(NativeMeterSelectedWarmupCatalog.plan(special:"wild-tnt",variant:"flower")),c=Warmup.Capture(token:1,generation:7,selection:p.selection)
  var callbacks:[(Int?)->Void]=[],outcomes:[Warmup.Outcome]=[],audio:[String]=[]
  let o=Warmup(load:{_,done in callbacks.append(done)});o.onPrepareSelectedAudio={_,id in audio.append(id)}
  XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{true}));XCTAssertEqual(callbacks.count,4);o.whenSelectedSettled(capture:c){outcomes.append($0)};XCTAssertTrue(outcomes.isEmpty)
  XCTAssertTrue(o.committed(capture:c,tileID:"hidden-flower"));XCTAssertEqual(audio,["hidden-flower"])
  var i=0;while i<callbacks.count {callbacks[i](i);i+=1};XCTAssertEqual(outcomes,[.settled(unavailable:[])]);XCTAssertEqual(callbacks.count,15);XCTAssertEqual(o.maximumActive,4)
 }
 @MainActor func testCanceledCoalescedWaiterDoesNotKillSelectedCurrentConsumer()throws {
  let p=try XCTUnwrap(NativeMeterSelectedWarmupCatalog.plan(special:"wild-tnt",variant:"beach-ball")),a=Warmup.Capture(token:1,generation:1,selection:p.selection),b=Warmup.Capture(token:2,generation:1,selection:p.selection)
  var callbacks:[(Int?)->Void]=[],ar:[Warmup.Outcome]=[],br:[Warmup.Outcome]=[];let o=Warmup(load:{_,done in callbacks.append(done)})
  for c in [a,b] {XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{true}));XCTAssertTrue(o.committed(capture:c,tileID:"tile"))};o.whenSelectedSettled(capture:a){ar.append($0)};o.whenSelectedSettled(capture:b){br.append($0)};o.cancel(a)
  var i=0;while i<callbacks.count {callbacks[i](i);i+=1};XCTAssertEqual(callbacks.count,6);XCTAssertEqual(ar,[.retired]);XCTAssertEqual(br,[.settled(unavailable:[])])
 }
 @MainActor func testFailureSettlesPromiseAndNextSelectedAttemptRetries() {
  let p=NativeMeterSelectedWarmupPlan(selection:"test",preOpen:[],committed:[.init(["original.png"])])
  var count=0,outcomes:[Warmup.Outcome]=[];let o=Warmup(load:{_,done in count+=1;done(count==1 ? nil:7)})
  for token:UInt64 in [1,2] {let c=Warmup.Capture(token:token,generation:1,selection:"test");XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{true}));XCTAssertTrue(o.committed(capture:c,tileID:"tile"));o.whenSelectedSettled(capture:c){outcomes.append($0)}}
  XCTAssertEqual(outcomes,[.settled(unavailable:["original.png"]),.settled(unavailable:[])]);XCTAssertEqual(count,2)
 }
 @MainActor func testObsoleteCaptureSkipsQueuedLoadsAudioAndReady() {
  let p=NativeMeterSelectedWarmupPlan(selection:"test",preOpen:[],committed:(1...8).map{.init(["\($0).png"])}),c=Warmup.Capture(token:1,generation:1,selection:"test")
  var current=true,callbacks:[(Int?)->Void]=[],outcomes:[Warmup.Outcome]=[],audio=0;let o=Warmup(load:{_,done in callbacks.append(done)});o.onPrepareSelectedAudio={_,_ in audio+=1}
  XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{current}));XCTAssertTrue(o.committed(capture:c,tileID:"actual"));o.whenSelectedSettled(capture:c){outcomes.append($0)};current=false;XCTAssertFalse(o.committed(capture:c,tileID:"old"));for done in callbacks {done(1)}
  XCTAssertEqual(callbacks.count,4);XCTAssertEqual(audio,1);XCTAssertEqual(outcomes,[.retired])
 }
 @MainActor func testWarmCacheCannotInferSuccessfulOpenOrCompleteBeforeCommit() {
  let p=NativeMeterSelectedWarmupPlan(selection:"test",preOpen:[.init(["original.png"])],committed:[]),a=Warmup.Capture(token:1,generation:1,selection:"test"),b=Warmup.Capture(token:2,generation:1,selection:"test")
  var outcomes:[Warmup.Outcome]=[],count=0;let o=Warmup(load:{_,done in count+=1;done(7)})
  XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:a,isCurrent:{true}));XCTAssertTrue(o.committed(capture:a,tileID:"a"));o.whenSelectedSettled(capture:a){outcomes.append($0)}
  XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:b,isCurrent:{true}));o.whenSelectedSettled(capture:b){outcomes.append($0)};XCTAssertEqual(outcomes.count,1);XCTAssertTrue(o.committed(capture:b,tileID:"b"));XCTAssertEqual(outcomes.count,2);XCTAssertEqual(count,1)
 }
 @MainActor func testDuplicateLoaderReplyAndReentrantDisposeStayCapturedOnce() {
  let p=NativeMeterSelectedWarmupPlan(selection:"test",preOpen:[],committed:[.init(["original.png"])]),a=Warmup.Capture(token:1,generation:1,selection:"test"),b=Warmup.Capture(token:2,generation:1,selection:"test")
  var reply:((Int?)->Void)?,ar:[Warmup.Outcome]=[],br:[Warmup.Outcome]=[];let o=Warmup(load:{_,done in reply=done})
  for c in [a,b] {XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{true}));XCTAssertTrue(o.committed(capture:c,tileID:"tile"))};o.whenSelectedSettled(capture:a){ar.append($0);o.dispose()};o.whenSelectedSettled(capture:b){br.append($0)}
  reply?(7);reply?(7);XCTAssertEqual(ar,[.settled(unavailable:[])]);XCTAssertEqual(br,[.retired])
 }

 @MainActor func testPreOpenTntCancellationRetiresBorrowerButKeepsFiniteSourceCacheFill() {
  let p=NativeMeterSelectedWarmupPlan(selection:"test",preOpen:(1...8).map{.init(["\($0).png"])},committed:[]),c=Warmup.Capture(token:1,generation:1,selection:"test")
  var current=true,callbacks:[(Int?)->Void]=[],outcomes:[Warmup.Outcome]=[]
  let o=Warmup(load:{_,done in callbacks.append(done)});XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{current}));o.whenSelectedSettled(capture:c){outcomes.append($0)}
  current=false;o.cancel(c);var i=0;while i<callbacks.count {callbacks[i](i);i+=1}
  XCTAssertEqual(callbacks.count,8);XCTAssertEqual(outcomes,[.retired]);XCTAssertEqual(o.maximumActive,4)
 }

 @MainActor func testBackgroundTextureInterestIsNotCapturedOwnerRetirement() {
  let p=NativeMeterSelectedWarmupPlan(selection:"test",preOpen:[],committed:(1...8).map{.init(["\($0).png"])}),c=Warmup.Capture(token:1,generation:1,selection:"test")
  var callbacks:[(Int?)->Void]=[],outcomes:[Warmup.Outcome]=[],foreground=true
  let o=Warmup(load:{_,done in callbacks.append(done)})
  XCTAssertTrue(o.beginBeforeOpen(plan:p,capture:c,isCurrent:{true}))
  XCTAssertTrue(o.committed(capture:c,tileID:"same-live-tile",texturesCurrent:{foreground}));o.whenSelectedSettled(capture:c){outcomes.append($0)}
  foreground=false;for callback in callbacks {callback(1)}
  XCTAssertEqual(callbacks.count,4)
  XCTAssertEqual(outcomes,[.settled(unavailable:["5.png","6.png","7.png","8.png"])])
 }
}
