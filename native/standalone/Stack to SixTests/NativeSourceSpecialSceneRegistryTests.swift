import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six
nonisolated final class NativeSourceSpecialSceneRegistryTests:XCTestCase {
 @MainActor func testActualSceneAcceptedOrdinaryContactWritesAppCounterOnceBeforeEffects()throws {
  let context=NativeGameplaySourceContext(),engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),.init(id:"c",cell:.init(column:2,row:0),value:1)]))
  let scene=NativeBoardScene(engine:engine,resourceRoot:try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")),size:.init(width:390,height:844))
  let scope=try XCTUnwrap(context.beginScene{[weak scene] in scene?.retireSourceAnimationBindings()});defer{scene.dispose();context.dispose()}
  XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope));scene.layout(size:scene.size,insets:.zero)
  let geometry=try XCTUnwrap(scene.boardGeometry)
  XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)));scene.moveDrag(to:geometry.center(row:0,column:1),now:0)
  XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:0)).accepted)
  XCTAssertEqual(context.contactMutations.revision,1)
  scene.synchronize();XCTAssertEqual(context.contactMutations.revision,1,"model synchronization is not another Source accepted contact")
  XCTAssertNil(scope.registries.snapshot(isWild:false)?.special)
 }
 @MainActor func testCapturedTntRequiresBothActualGameplayAndVisualReceiptsAndCStaysOwned()throws {
  let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{0}),scope=session.beginScope(epoch:1);scope.bindParentCurrent{true}
  let mutation=NativeSourceContactMutationOwner(),owner=NativeSourceSpecialSceneTransactionOwner(scope:scope,mutations:mutation,current:{true},guardReleased:{})
  XCTAssertTrue(owner.mount())
  let e=NativeGameplayEngine(state:.init(tiles:[.init(id:"w",cell:.init(column:0,row:0),value:6,archetype:.tnt),.init(id:"a",cell:.init(column:1,row:0),value:2),.init(id:"b",cell:.init(column:2,row:0),value:1)]),recordedRandomChoices:Array(repeating:0,count:80));e.stagedTntActivation=true
  e.sourceSpecialContactHook=NativeSourceSpecialContactHook{src,dst,kind in owner.claim(source:src,destination:dst,kind:kind,generation:e.state.generation)}
  defer{owner.retire();session.dispose()}
  XCTAssertTrue(e.beginDrag(tileID:"w"));let result=e.drop(target:.init(column:1,row:0)),plan=try XCTUnwrap(e.pendingSpecial)
  XCTAssertTrue(owner.acceptedContact(result,direct:nil,special:plan));XCTAssertEqual(mutation.revision,1)
  owner.boardCommitted(id:plan.id,generation:plan.generation)
  XCTAssertEqual(scope.snapshot(isWild:false)?.special?.phase,.visualTail)
  owner.tntGameplayComplete(id:plan.id,generation:plan.generation);XCTAssertNotNil(scope.snapshot(isWild:false)?.special)
  owner.tntVisualComplete(id:plan.id,generation:plan.generation);XCTAssertNil(scope.snapshot(isWild:false)?.special)
  let lease=try XCTUnwrap(owner.claim(source:plan.source,destination:plan.destination,kind:.juice,generation:plan.generation));XCTAssertTrue(lease.isCurrent())
  let next=scope.snapshot(isWild:false)?.special?.token
  owner.tntVisualComplete(id:plan.id,generation:plan.generation);owner.tntGameplayComplete(id:plan.id,generation:plan.generation)
  XCTAssertEqual(scope.snapshot(isWild:false)?.special?.token,next)
 }
}
