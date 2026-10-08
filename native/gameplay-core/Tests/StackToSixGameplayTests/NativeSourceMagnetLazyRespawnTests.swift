import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceMagnetLazyRespawnTests:XCTestCase {
 private struct Oracle:Decodable {let cases:[Row]}
 private struct Cell:Decodable {let c:Int,r:Int;var native:NativeCell{.init(column:c,row:r)}}
 private struct Row:Decodable {let rows:Int,count:Int,seed:Int,cells:[Cell],reserved:[Cell],values:[Int],prepareDraws:Int,reserveDraws:Int,survivor:Int,totalDraws:Int}
 private final class Stream {var draws=0;let seed:Int;init(_ seed:Int){self.seed=seed};func next()->Double{defer{draws+=1};return Double((draws*17+seed)%97)/97}}
 private func fixture(_ rows:Int=5,count:Int=2,seed:Int=3,lazy:Bool=true)throws->(NativeGameplayEngine,NativeSpecialMovePlan,Stream,NativeSourceMathRandomStream) {
  let stream=Stream(seed),math=NativeSourceMathRandomStream(draw:stream.next)
  let tiles:[NativeTile]=[.init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.magnet),.init(id:"d",cell:.init(column:1,row:0),value:2)] + (0..<count).map{.init(id:"p\($0)",cell:.init(column:($0+2)%5,row:($0+2)/5),value:1)}
  let engine=NativeGameplayEngine(state:.init(columns:5,rows:rows,tiles:tiles,board:10),sourceMathRandom:math)
  engine.sourceMagnetLazyRespawnEnabled=lazy
  XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
  let p=try XCTUnwrap(engine.pendingSpecial),receipt=try XCTUnwrap(engine.registerSourceSpecialAbsorbOwner(transactionID:p.id,generation:p.generation))
  XCTAssertTrue(engine.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:p.generation).accepted)
  XCTAssertEqual(stream.draws,0)
  return(engine,p,stream,math)
 }
 private func settle(_ e:NativeGameplayEngine,_ p:NativeSpecialMovePlan)throws {
  let plan=try XCTUnwrap(e.pendingSourceMagnetLazyRespawn)
  for slot in plan.slots {
   let opening=try XCTUnwrap(e.beginSourceMagnetLazyOpen(transactionID:p.id,generation:p.generation,index:slot.index,sourceCurrent:{true}))
   let holder=try XCTUnwrap(opening.holder)
   XCTAssertEqual(holder.value,0);XCTAssertTrue(holder.locked)
   XCTAssertTrue(e.commitSourceMagnetLazyOpenValue(openID:opening.id,generation:p.generation,sourceCurrent:{true}).accepted)
   XCTAssertTrue(e.finishSourceMagnetLazyOpen(openID:opening.id,generation:p.generation,verifiedTileID:holder.id,sourceCurrent:{true}))
  }
 }
 func testExecutedOriginalSelectionAndSurvivorDrawSlot16Cases()throws {
  let url=try XCTUnwrap(Bundle.module.url(forResource:"SourceLazyMagnetOrder",withExtension:"json"))
  let rows=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url)).cases
  XCTAssertEqual(rows.count,16)
  for r in rows {
   let(e,p,s,math)=try fixture(r.rows,count:r.count,seed:r.seed)
   let before=e.state
   XCTAssertTrue(e.prepareSourceMagnetLazyRespawn(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
   let plan=try XCTUnwrap(e.pendingSourceMagnetLazyRespawn)
   XCTAssertEqual(plan.slots.map(\.cell),r.cells.map(\.native));XCTAssertEqual(plan.reserved,r.reserved.map(\.native));XCTAssertEqual(plan.slots.map(\.forcedValue),r.values)
   XCTAssertEqual(s.draws,r.prepareDraws)
   XCTAssertNil(e.pendingMagnetRespawn);XCTAssertEqual(e.state.tile(at:p.destination.cell)?.value,6)
   XCTAssertFalse(e.commitSpecialBoard(transactionID:p.id).accepted)
   try settle(e,p)
   let fill=try XCTUnwrap(e.prepareSourceMagnetLazyReserveFill(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
   XCTAssertEqual(fill.holders.count,r.reserveDraws)
   XCTAssertNil(e.prepareSourceMagnetLazySurvivor(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
   for (i,tile) in fill.holders.enumerated() {
    _=math.next() // External genuine constructor slot; adapter SDK connects actual Node writer separately.
    XCTAssertTrue(e.commitSourceMagnetLazyReserve(transactionID:p.id,generation:p.generation,index:i,sourceCurrent:{true}).accepted)
    XCTAssertEqual(e.state.tile(at:tile.cell)?.id,tile.id)
   }
   let conversion=try XCTUnwrap(e.prepareSourceMagnetLazySurvivor(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
   XCTAssertEqual(conversion.survivor.value,r.survivor);XCTAssertEqual(s.draws,r.totalDraws)
   XCTAssertEqual(conversion.survivor.id,p.destination.id)
   let oldIndex=try XCTUnwrap(e.state.tiles.firstIndex{$0.id==p.destination.id})
   XCTAssertTrue(e.commitSourceMagnetLazySurvivorValue(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
   XCTAssertTrue(e.state.tiles[oldIndex].resolutionOwned)
   XCTAssertFalse(e.commitSpecialBoard(transactionID:p.id).accepted)
   XCTAssertTrue(e.releaseSourceMagnetLazySurvivorResolution(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
   XCTAssertFalse(e.state.tiles[oldIndex].resolutionOwned)
   XCTAssertTrue(e.commitSpecialBoard(transactionID:p.id).accepted)
   XCTAssertEqual(e.state.tiles[oldIndex].id,p.destination.id);XCTAssertEqual(e.state.tiles[oldIndex].value,r.survivor)
   XCTAssertEqual(e.state.moves,before.moves-1);XCTAssertEqual(s.draws,r.totalDraws)
   XCTAssertNil(e.pendingSourceMagnetLazyRespawn)
  }
 }
 func testActualZeroHolderAllocationIsDeferredAndExactOldReceiptsCannotMutateC()throws {
  let(e,p,s,_)=try fixture()
  XCTAssertTrue(e.prepareSourceMagnetLazyRespawn(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
  let plan=try XCTUnwrap(e.pendingSourceMagnetLazyRespawn),before=e.state,draws=s.draws
  XCTAssertTrue(plan.slots.allSatisfy{e.state.tile(at:$0.cell)==nil})
  let open=try XCTUnwrap(e.beginSourceMagnetLazyOpen(transactionID:p.id,generation:p.generation,index:0,sourceCurrent:{true}))
  XCTAssertEqual(e.state.tile(at:plan.slots[0].cell)?.value,0);XCTAssertEqual(s.draws,draws)
  XCTAssertFalse(e.finishSourceMagnetLazyOpen(openID:open.id,generation:p.generation,verifiedTileID:open.holder?.id,sourceCurrent:{true}))
  XCTAssertNil(e.beginSourceMagnetLazyOpen(transactionID:p.id,generation:p.generation,index:0,sourceCurrent:{true}))
  XCTAssertEqual(e.state.moves,before.moves);XCTAssertEqual(e.state.score,before.score)
  e.restart(state:.init(tiles:[.init(id:"C",cell:plan.slots[0].cell,value:4)]))
  let replacement=e.state
  XCTAssertFalse(e.commitSourceMagnetLazyOpenValue(openID:open.id,generation:p.generation,sourceCurrent:{true}).accepted)
  XCTAssertNil(e.prepareSourceMagnetLazySurvivor(transactionID:p.id,generation:p.generation,sourceCurrent:{true}))
  XCTAssertEqual(e.state,replacement);XCTAssertEqual(s.draws,draws)
 }
 func testSourceOptInRequiresRealMainAndOneSharedMathWhileRawEagerRemainsUnchanged()throws {
  let(e,p,s,_)=try fixture(lazy:false),before=e.state
  XCTAssertFalse(e.prepareSourceMagnetLazyRespawn(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
  XCTAssertEqual(e.state,before);XCTAssertEqual(s.draws,0)
  XCTAssertTrue(e.prepareMagnetRespawn(transactionID:p.id).accepted);XCTAssertNotNil(e.pendingMagnetRespawn)
  let(raw,rawPlan,_,_)=try fixture()
  XCTAssertFalse(raw.prepareMagnetRespawn(transactionID:rawPlan.id).accepted)
  XCTAssertFalse(raw.prepareSourceMagnetLazyRespawn(transactionID:rawPlan.id,generation:rawPlan.generation,sourceCurrent:{false}).accepted)
  XCTAssertNil(raw.pendingSourceMagnetLazyRespawn)
 }
 func testReentrantScopeRetirementBeforeDrawHasNoModelOrRandomSideEffects()throws {
  let(e,p,s,_)=try fixture(),old=e.state
  XCTAssertFalse(e.prepareSourceMagnetLazyRespawn(transactionID:p.id,generation:p.generation,sourceCurrent:{e.sourceMagnetLazyRespawnEnabled=false;return true}).accepted)
  XCTAssertEqual(e.state,old);XCTAssertEqual(s.draws,0)
 }
 func testSourceCurrentReentryCannotDoubleAssignCapturedOpenOrReleaseNewOperation()throws {
  let(e,p,_,_)=try fixture()
  XCTAssertTrue(e.prepareSourceMagnetLazyRespawn(transactionID:p.id,generation:p.generation,sourceCurrent:{true}).accepted)
  let open=try XCTUnwrap(e.beginSourceMagnetLazyOpen(transactionID:p.id,generation:p.generation,index:0,sourceCurrent:{true}))
  var callbacks=0
  let result=e.commitSourceMagnetLazyOpenValue(openID:open.id,generation:p.generation,sourceCurrent:{
   callbacks+=1
   XCTAssertFalse(e.commitSourceMagnetLazyOpenValue(openID:open.id,generation:p.generation,sourceCurrent:{XCTFail("reentrant operation queried another producer");return true}).accepted)
   return true
  })
  XCTAssertTrue(result.accepted);XCTAssertEqual(callbacks,1);XCTAssertEqual(result.events.filter{$0.kind == .spawned}.count,1)
  XCTAssertFalse(e.commitSourceMagnetLazyOpenValue(openID:open.id,generation:p.generation,sourceCurrent:{true}).accepted)
 }

}
