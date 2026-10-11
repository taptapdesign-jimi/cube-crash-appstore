import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeMeterDeferredDiceTests:XCTestCase {
 private var root:URL {NativeTestResources.root}
 private var selections:[(String,String?)] {[("wild",nil),("wild-juice",nil),("wild-magnet",nil),("wild-tnt",nil)]+NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype.rawValue,$0.id)}}
 func testAllOriginalSelectionsPaintStaticWithoutAllocatingIdleBeforeActualLanding()async throws {
  let textures=NativeBoardTextures(root:root);defer{textures.dispose()}
  let scene=SKScene(size:.init(width:390,height:844)),view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
  defer{view.presentScene(nil)}
  XCTAssertEqual(selections.count,17)
  for (kind,variant) in selections {
   let node=NativeDiceNode(id:"deferred:\(variant ?? kind)",value:6,kind:kind,variant:variant,depth:1,locked:false,textures:textures,deferSourceIdle:true)
   scene.addChild(node);node.isHidden=true;node.alpha=0
   XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertFalse(node.hasAnimatedArtwork)
   node.tick(5,suspended:false,viewportCenter:195);node.prepareFishMediaPhase();node.setFishMediaReady(true)
   XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertNil(node.fishFrame(in:scene,visible:true))
   XCTAssertFalse(node.hasPresentationActions)
   // A real external selected preparation is independent and cannot clear the
   // Source defer flag. There is no warmup-completion shortcut to landing.
   node.isHidden=false;node.alpha=1;node.setSourceIdleDeferred(false)
   XCTAssertFalse(node.sourceIdleDeferred)
   if ["kanta","mushroom","spaceship","honey","fish"].contains(variant ?? "") {XCTAssertGreaterThan(node.sourceIdleOwnerCount,0,variant ?? kind)}
   if ["bee","cubero","bottle"].contains(variant ?? "") {XCTAssertTrue(node.hasAnimatedArtwork)}
   node.dispose();XCTAssertEqual(node.sourceIdleOwnerCount,0)
  }
 }
 func testMountedBorrowedHolderUsesSameNodeBeforeCoreAdoptsActualIdentity()async throws {
  typealias Owner=NativeMeterHiddenOpenOwner<NativeDiceNode>
  let textures=NativeBoardTextures(root:root);defer{textures.dispose()}
  let scene=SKScene(size:.init(width:390,height:844)),view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene);defer{view.presentScene(nil)}
  let tiles=(0..<45).map{NativeTile(id:"holder:\($0)",cell:.init(column:$0%5,row:$0/5),value:0,locked:true)}
  let core=NativeGameplayEngine(state:.init(tiles:tiles,wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star,variant:"cubero")})
  core.stagedMeterDrops=true;core.stagedMeterOpen=true;XCTAssertTrue(core.claimMeterReward().accepted)
  let request=try XCTUnwrap(core.pendingMeterOpen),holderID=try XCTUnwrap(request.expectedHolderID)
  let node=NativeDiceNode(id:holderID,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures);scene.addChild(node)
  var epoch=1
  let lease=Owner.Lease(node:node,id:node.tileID,isOwned:{epoch==1},holder:{.init(id:node.tileID,value:node.value,locked:node.locked,destroyed:node.parent==nil,wildSpecial:node.kind.hasPrefix("wild") ? node.kind:nil)},retire:{guard epoch==1 else{return};node.dispose()})
  let owner=Owner(hooks:.init(readGrid:{_ in lease},createPlaceholder:{_ in XCTFail("Existing locked zero must be reused");return nil},unlockAndBind:{lease in lease.node.update(value:0,kind:"regular",variant:nil,depth:1,locked:false)},resetNormal:{_ in},deferIdle:{lease,active in lease.node.setSourceIdleDeferred(active)},setCoreValue:{lease,kind in lease.node.update(value:6,kind:kind,variant:nil,depth:1,locked:false)},applyVariant:{lease,selection in lease.node.update(value:6,kind:selection.special,variant:selection.variant,depth:1,locked:false)},hide:{lease in lease.node.isHidden=true;lease.node.alpha=0},activateIdle:{lease in lease.node.resumeIdleAfterLanding()},enqueue:{done in Task{@MainActor in done()}},generationCurrent:{$0.generation==core.state.generation}))
  let capture=Owner.Capture(id:request.id,generation:request.generation,spawnToken:request.spawnToken,column:request.tile.cell.column,row:request.tile.cell.row)
  let delivered=expectation(description:"actual async hidden-node creation");var outcomes=0
  XCTAssertTrue(owner.open(capture:capture,selection:.init(special:"wild",variant:"cubero")){outcome in
   outcomes+=1;guard case .created(let actual,let reused)=outcome else{XCTFail("Actual creation refused");delivered.fulfill();return}
   XCTAssertTrue(reused);XCTAssertTrue(actual.node === node);XCTAssertEqual(actual.id,holderID)
   XCTAssertNil(node.variant);XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.sourceIdleOwnerCount,0)
   let result=core.completeMeterOpen(id:request.id,generation:request.generation,receipt:.created(tileID:actual.id),prepareCommitted:{tile in XCTAssertTrue(owner.prepareCommitted(capture:capture,tileID:tile.id))})
   XCTAssertTrue(result.accepted);delivered.fulfill()
  })
  XCTAssertEqual(outcomes,0);await fulfillment(of:[delivered],timeout:2)
  XCTAssertEqual(outcomes,1);XCTAssertEqual(core.state.tile(at:request.tile.cell)?.id,holderID);XCTAssertEqual(node.variant,"cubero")
  XCTAssertTrue(node.parent === scene);XCTAssertEqual(owner.retainedNodeIDs,[holderID]);XCTAssertTrue(node.sourceIdleDeferred)
  XCTAssertFalse(owner.landed(capture:capture,allowsSourceIdle:false));XCTAssertFalse(node.hasAnimatedArtwork)
  node.isHidden=false;node.alpha=1;XCTAssertTrue(owner.landed(capture:capture,allowsSourceIdle:true));XCTAssertTrue(node.hasAnimatedArtwork)
  // Only real board adoption releases the captured retention; the node remains.
  owner.releaseToScene(capture);XCTAssertTrue(node.parent === scene);XCTAssertTrue(owner.retainedNodeIDs.isEmpty)
  epoch+=1;owner.dispose();XCTAssertTrue(node.parent === scene);node.dispose()
 }
 func testDeferralInvalidatesLateAtlasAndDisposedNodeCannotResumePhase()async throws {
  let textures=NativeBoardTextures(root:root);defer{textures.dispose()}
  let scene=SKScene(size:.init(width:390,height:844)),node=NativeDiceNode(id:"atlas",value:6,kind:"wild",variant:"robo-cube",depth:1,locked:false,textures:textures)
  scene.addChild(node);node.setSourceIdleDeferred(true)
  let atlas=expectation(description:"actual preserved atlas prepared")
  textures.prepare(.robo){_ in atlas.fulfill()};await fulfillment(of:[atlas],timeout:5)
  XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertFalse(node.hasAnimatedArtwork)
  node.dispose();node.setSourceIdleDeferred(false);node.prepareFishMediaPhase();node.tick(1,suspended:false,viewportCenter:195)
  XCTAssertEqual(node.sourceIdleOwnerCount,0);XCTAssertFalse(node.hasAnimatedArtwork);XCTAssertNil(node.parent)
 }
 func testDefaultExistingNodeAdmissionIsUnchangedAndDeferredVariantReplacementAllocatesNoOwner() {
  let textures=NativeBoardTextures(root:root);defer{textures.dispose()}
  let baseline=NativeDiceNode(id:"accepted",value:6,kind:"wild",variant:"cubero",depth:1,locked:false,textures:textures)
  XCTAssertFalse(baseline.sourceIdleDeferred);XCTAssertTrue(baseline.hasAnimatedArtwork)
  baseline.setSourceIdleDeferred(true)
  for (kind,variant) in selections {baseline.update(value:6,kind:kind,variant:variant,depth:1,locked:false);XCTAssertTrue(baseline.sourceIdleDeferred);XCTAssertEqual(baseline.sourceIdleOwnerCount,0);XCTAssertFalse(baseline.hasAnimatedArtwork)}
  baseline.dispose()
 }
}
