import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetFallbackFrameLifetimeTests:XCTestCase {
    @MainActor private final class Time {var wall=0.0}
    @MainActor private final class Fixture {
        let time=Time()
        let engine:NativeGameplayEngine,plan:NativeSpecialMovePlan
        let service:NativeSourceAnimationClockService,tasks:NativeSourceMicrotaskAdapters,fifo=NativeSourceMicrotaskFIFO()
        let frameScope:NativeSourceMicrotaskFIFO.Scope,textures:NativeBoardTextures,canvas=SKNode()
        let timeline:NativeSourceOuterTimelineAdapter
        var nodes:[String:NativeDiceNode]=[:],caller:NativeSourceMagnetFallbackCaller?
        var wall:Double {get{time.wall}set{time.wall=newValue}}
        var closed=false,acquisitions=0,releases=0,completions:[NativeSourceMagnetFallbackCaller.Completion]=[],completionInCheckpoint=false
        init(root:URL)throws {
            let state=NativeBoardState(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.magnet),.init(id:"d",cell:.init(column:1,row:0),value:2),.init(id:"a",cell:.init(column:2,row:0),value:1),.init(id:"b",cell:.init(column:3,row:0),value:3)])
            engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0,count:300));engine.sourceMagnetFallbacksEnabled=true
            XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            plan=try XCTUnwrap(engine.pendingSpecial)
            XCTAssertTrue(engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
            let count=try XCTUnwrap(engine.pendingMagnetRespawn).replacements.count
            for i in 0..<count{XCTAssertTrue(engine.commitMagnetReplacement(transactionID:plan.id,index:i).accepted)}
            XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[time] in time.wall},sourceFrameTransportEnabled:true)
            tasks=NativeSourceMicrotaskAdapters(fifo:fifo);service.sourceMicrotaskTasks=tasks
            frameScope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
            textures=NativeBoardTextures(root:root);timeline=NativeSourceOuterTimelineAdapter(service:service)
            for path in ["assets/tile.png","assets/shadow.png"]+NativeRegularStackLayout.Skin.allCases.map({String($0.rawValue.dropFirst(2))}) {XCTAssertNotNil(textures.texture(path,densityAware:false))}
        }
        func start() {
            let owner=NativeSourceMagnetFallbackCaller(engine:engine,service:service,hooks:.init(
                current:{[weak self] in self?.closed==false},resourcesReady:{[textures] in textures.sourceRetainedRegularOpenTexturesReady},random:{0.9},
                enqueue:{[frameScope] in frameScope.enqueue($0)},removeHolder:{[weak self] id in self?.nodes.removeValue(forKey:id)?.dispose()},
                construct:{[weak self] open,rotation in
                    guard let self,let holder=open.holder else{return nil}
                    if !open.createdHolder{return self.nodes[holder.id]}
                    let node=NativeDiceNode(id:holder.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:self.textures)
                    self.canvas.addChild(node);self.nodes[holder.id]=node
                    guard let rotation,node.prepareSourceInitialHolder(rotation:rotation,generation:1) else{return nil}
                    node.installSourceOuterDriver(self.timeline,generation:1,geometryScale:1)
                    _=self.service.requestSourceAnimationFrame(ownerID:"fixture-constructor",generation:1,callback:{[weak node] in node?.flushSourceInitialHolderVisuals()})
                    return node
                },owns:{[weak self] node,open in guard let self else{return false};return self.nodes[node.tileID] === node && node.parent === self.canvas && node.sourceContactNodeAlive && self.engine.state.tile(at:open.cell)?.id==node.tileID},
                publish:{_,_ in},acquireFrames:{[weak self] _,_ in guard let self else{return nil};self.acquisitions+=1;return{[weak self] in self?.releases+=1}},frameCurrent:{[weak self] node,open in
                    guard let self else{return false}
                    return !self.closed && self.engine.state.generation==open.generation && self.nodes[node.tileID] === node && node.parent === self.canvas && node.sourceGeneration==open.generation && node.sourceContactNodeAlive
                }))
            caller=owner
            XCTAssertTrue(tasks.inputTask {XCTAssertTrue(owner.start(transactionID:plan.id,generation:1,count:2,finished:{[weak self] result in guard let self else{return};self.completionInCheckpoint=self.fifo.isInsideCheckpoint;self.completions.append(result)}))})
        }
        func deliver(_ end:Int) {while wall<Double(end){wall+=10;service.deliver(wallMilliseconds:wall)}}
        func dispose(){guard !closed else{return};closed=true;caller?.retire();caller=nil;for node in nodes.values{node.dispose()};nodes=[:];timeline.dispose();textures.dispose();frameScope.dispose();fifo.dispose();service.dispose()}
        isolated deinit {dispose()}
    }
    private func root()throws->URL{try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))}
    func testFirstAndLastFallbackNodesRemainFaceReadyAfterActualSequentialArrivalsAndNextCoreMerge()throws {
        let f=try Fixture(root:root());defer{f.dispose()};f.start();f.deliver(1200)
        XCTAssertEqual(f.completions,[.completed]);XCTAssertTrue(f.completionInCheckpoint)
        XCTAssertNil(f.engine.pendingSourceMagnetFallback);XCTAssertNil(f.engine.pendingSourceMagnetFallbackOpen)
        XCTAssertEqual(f.nodes.count,2)
        for node in f.nodes.values {XCTAssertTrue(node.sourceMergeSixFaceReady(service:f.service));XCTAssertTrue(node.sourcePhysicalMarkersCovered)}
        let target=try XCTUnwrap(f.nodes.values.first)
        let source=try XCTUnwrap(f.engine.state.tiles.first(where:{$0.id != target.tileID && !$0.locked && $0.value==1}))
        XCTAssertTrue(f.engine.beginDrag(tileID:source.id))
        let result=f.engine.drop(target:try XCTUnwrap(f.engine.state.tiles.first(where:{$0.id==target.tileID})).cell)
        XCTAssertTrue(result.accepted);let model=try XCTUnwrap(f.engine.state.tiles.first(where:{$0.id==target.tileID}))
        XCTAssertEqual(model.value,4)
        XCTAssertTrue(target.queueSourceStackValue(model.value,addStack:1,service:f.service,random:{0.9},current:{[weak f,weak target] in
            guard let f,let target else{return false};return !f.closed && f.nodes[target.tileID] === target && target.parent === f.canvas
        }))
        f.deliver(1210);XCTAssertEqual(target.sourceValue,4);XCTAssertEqual(target.sourceStackDepth,2)
        XCTAssertTrue(target.sourceMergeSixFaceReady(service:f.service));XCTAssertEqual(target.sourcePendingStackFrameCount,0)
    }
}
