import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetNormalCallerTests:XCTestCase {
 @MainActor private final class Time {var wall=0.0}
 @MainActor private final class Fixture {
  let engine:NativeGameplayEngine,plan:NativeSpecialMovePlan,service:NativeSourceAnimationClockService,tasks:NativeSourceMicrotaskAdapters,fifo=NativeSourceMicrotaskFIFO()
  let scope:NativeSourceMicrotaskFIFO.Scope,textures:NativeBoardTextures,canvas=SKNode(),timeline:NativeSourceOuterTimelineAdapter,time=Time()
  var queue:[Int:(Double,()->Void,()->Void)]=[:],sequence=0,nodes:[String:NativeDiceNode]=[:],caller:NativeSourceMagnetNormalCaller?
  var closed=false,acquired=0,released=0,verified:[Double]=[],outcomes:[NativeSourceMagnetRespawnOwner.Completion]=[],checkpoint=false
  init(root:URL)throws {
   let state=NativeBoardState(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.magnet),.init(id:"d",cell:.init(column:1,row:0),value:2),.init(id:"a",cell:.init(column:2,row:0),value:1),.init(id:"b",cell:.init(column:3,row:0),value:3)])
   engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0,count:300))
   XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
   plan=try XCTUnwrap(engine.pendingSpecial);XCTAssertTrue(engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[time] in time.wall},sourceFrameTransportEnabled:true)
   tasks=NativeSourceMicrotaskAdapters(fifo:fifo);service.sourceMicrotaskTasks=tasks
   scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
   textures=NativeBoardTextures(root:root);timeline=NativeSourceOuterTimelineAdapter(service:service)
   for path in ["assets/tile.png","assets/shadow.png"]+NativeRegularStackLayout.Skin.allCases.map({String($0.rawValue.dropFirst(2))}){XCTAssertNotNil(textures.texture(path,densityAware:false))}
  }
  func start(){
   let owner=NativeSourceMagnetNormalCaller(engine:engine,service:service,hooks:.init(current:{[weak self] in self?.closed==false},resourcesReady:{[textures] in textures.sourceRetainedRegularOpenTexturesReady},random:{0.9},
    schedule:{[weak self] ms,elapsed,cancelled in
     guard let self else{return nil};self.sequence+=1;let id=self.sequence;self.queue[id]=(self.time.wall+Double(ms),elapsed,cancelled)
     return{[weak self] in guard let self,let item=self.queue.removeValue(forKey:id) else{return};item.2()}
    },enqueue:{[scope] in scope.enqueue($0)},construct:{[weak self] tile,rotation in
     guard let self else{return nil};let node=NativeDiceNode(id:tile.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:self.textures)
     self.canvas.addChild(node);self.nodes[tile.id]=node
     guard node.prepareSourceInitialHolder(rotation:rotation,generation:1) else{return nil}
     node.installSourceOuterDriver(self.timeline,generation:1,geometryScale:1)
     _=self.service.requestSourceAnimationFrame(ownerID:"normal-constructor",generation:1,callback:{[weak node] in node?.flushSourceInitialHolderVisuals()})
     return node
    },owns:{[weak self] node,tile in guard let self else{return false};return self.nodes[tile.id] === node && node.parent === self.canvas && node.sourceContactNodeAlive},publish:{_,_ in},
    verify:{[weak self] cell in
     guard let self,let tile=self.engine.state.tile(at:cell),let node=self.nodes[tile.id] else{return false}
     self.verified.append(self.time.wall);return !node.sourceLocked && node.sourceValue>0
    },acquireFrames:{[weak self] _,_ in guard let self else{return nil};self.acquired+=1;return{[weak self] in self?.released+=1}},finished:{[weak self] outcome in
     guard let self else{return};self.checkpoint=self.fifo.isInsideCheckpoint;self.outcomes.append(outcome)
    }))
   caller=owner;XCTAssertTrue(tasks.inputTask{XCTAssertTrue(owner.start(transactionID:plan.id,generation:1))})
  }
  func deliver(_ end:Int){
   while time.wall<Double(end){time.wall+=10;service.deliver(wallMilliseconds:time.wall)
    while let id=queue.filter({$0.value.0<=time.wall}).min(by:{$0.value.0==$1.value.0 ? $0.key<$1.key:$0.value.0<$1.value.0})?.key{
     let item=queue.removeValue(forKey:id)!;tasks.timeoutCallback{item.1()}()
    }
   }
  }
  func dispose(){guard !closed else{return};closed=true;caller?.retire();caller=nil;queue=[:];nodes.values.forEach{$0.dispose()};nodes=[:];timeline.dispose();textures.dispose();scope.dispose();fifo.dispose();service.dispose()}
  isolated deinit {dispose()}
 }
 private func root()throws->URL{try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))}
 func testActualOpenObjectsAwaitSourceArrivalsThenWallVerificationAndPromiseJoin()throws {
  let f=try Fixture(root:root());defer{f.dispose()};f.start()
  XCTAssertEqual(f.nodes.count,0);f.deliver(50);XCTAssertEqual(f.nodes.count,1)
  f.deliver(200);XCTAssertEqual(f.nodes.count,2);XCTAssertEqual(f.acquired,2)
  f.deliver(600);XCTAssertEqual(f.released,0);XCTAssertTrue(f.outcomes.isEmpty)
  f.deliver(620);XCTAssertEqual(f.released,1);XCTAssertTrue(f.verified.isEmpty)
  f.deliver(670);XCTAssertEqual(f.verified,[670]);XCTAssertTrue(f.outcomes.isEmpty)
  f.deliver(820);XCTAssertEqual(f.verified,[670,820]);XCTAssertEqual(f.outcomes,[.completed(successes:2)]);XCTAssertTrue(f.checkpoint)
  XCTAssertEqual(f.released,2);XCTAssertEqual(f.service.activeParticipantCount,0)
  XCTAssertTrue(f.nodes.values.allSatisfy{$0.sourceValue>0 && !$0.sourceLocked && $0.sourcePendingStackFrameCount==0})
 }
 func testFreshReplacementStartsHiddenAndGrowsWithoutTouchingNeighbours()throws {
  let f=try Fixture(root:root());defer{f.dispose()};f.start();f.deliver(50)
  let first=try XCTUnwrap(f.nodes.values.first)
  XCTAssertEqual(first.sourceLocalScale.x,0)
  XCTAssertTrue(first.sourceAppSpawnOwnsOuterScale)
  f.deliver(60);XCTAssertEqual(first.sourceLocalScale.x,0)
  f.deliver(100);XCTAssertGreaterThan(first.sourceLocalScale.x,0);XCTAssertLessThan(first.sourceLocalScale.x,1)
  f.caller?.retire()
  XCTAssertEqual(first.sourceLocalScale.x,1)
  XCTAssertFalse(first.sourceAppSpawnOwnsOuterScale)
  XCTAssertNil(first.sourcePendingFreshFaceEntryID)
 }
 func testDestroyedCapturedObjectCancelsActualArrivalAndCannotPublishLaterSlots()throws {
  let f=try Fixture(root:root());defer{f.dispose()};f.start();f.deliver(80)
  let first=try XCTUnwrap(f.nodes.values.first);_=f.tasks.inputTask{first.dispose()}
  XCTAssertEqual(f.outcomes,[.cancelled]);XCTAssertEqual(f.released,1);XCTAssertTrue(f.queue.isEmpty)
  f.deliver(1000);XCTAssertEqual(f.nodes.count,1);XCTAssertEqual(f.outcomes,[.cancelled]);XCTAssertTrue(f.verified.isEmpty)
  XCTAssertEqual(f.service.activeParticipantCount,0)
 }
 func testGlobalSourcePauseKeepsWallCascadeButVerificationWaitsActualResumeArrival()throws {
  let f=try Fixture(root:root());defer{f.dispose()};f.start();f.deliver(100)
  f.service.setSourceGlobalPaused(true);f.deliver(1000)
  XCTAssertEqual(f.nodes.count,2);XCTAssertEqual(f.released,0);XCTAssertTrue(f.verified.isEmpty)
  f.service.setSourceGlobalPaused(false);f.deliver(1500)
  XCTAssertEqual(f.released,0);XCTAssertTrue(f.outcomes.isEmpty)
  f.deliver(1520);XCTAssertEqual(f.released,1);XCTAssertTrue(f.outcomes.isEmpty)
  f.deliver(1620);XCTAssertEqual(f.released,2);XCTAssertEqual(f.verified.count,2);XCTAssertEqual(f.outcomes,[.completed(successes:2)])
 }
}
