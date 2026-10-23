import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceMagnetFallbackCallerTests:XCTestCase {
    @MainActor private final class Fixture {
        let engine:NativeGameplayEngine,plan:NativeSpecialMovePlan
        let service:NativeSourceAnimationClockService,tasks:NativeSourceMicrotaskAdapters,fifo=NativeSourceMicrotaskFIFO()
        let frameScope:NativeSourceMicrotaskFIFO.Scope,textures:NativeBoardTextures,canvas=SKNode()
        let timeline:NativeSourceOuterTimelineAdapter
        var nodes:[String:NativeDiceNode]=[:],caller:NativeSourceMagnetFallbackCaller?
        var wall=0.0,closed=false,acquisitions=0,releases=0,completions:[NativeSourceMagnetFallbackCaller.Completion]=[],completionInCheckpoint=false
        init(root:URL)throws {
            let state=NativeBoardState(tiles:[.init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.magnet),.init(id:"d",cell:.init(column:1,row:0),value:2),.init(id:"a",cell:.init(column:2,row:0),value:1),.init(id:"b",cell:.init(column:3,row:0),value:3)])
            engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0,count:300));engine.sourceMagnetFallbacksEnabled=true
            XCTAssertTrue(engine.beginDrag(tileID:"m"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            plan=try XCTUnwrap(engine.pendingSpecial)
            XCTAssertTrue(engine.prepareMagnetRespawn(transactionID:plan.id).accepted)
            let count=try XCTUnwrap(engine.pendingMagnetRespawn).replacements.count
            for i in 0..<count{XCTAssertTrue(engine.commitMagnetReplacement(transactionID:plan.id,index:i).accepted)}
            XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
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
                publish:{_,_ in},acquireFrames:{[weak self] _,_ in guard let self else{return nil};self.acquisitions+=1;return{[weak self] in self?.releases+=1}}))
            caller=owner
            XCTAssertTrue(tasks.inputTask {XCTAssertTrue(owner.start(transactionID:plan.id,generation:1,count:2,finished:{[weak self] result in guard let self else{return};self.completionInCheckpoint=self.fifo.isInsideCheckpoint;self.completions.append(result)}))})
        }
        func deliver(_ end:Int) {while wall<Double(end){wall+=10;service.deliver(wallMilliseconds:wall)}}
        func dispose(){guard !closed else{return};closed=true;caller?.retire();caller=nil;for node in nodes.values{node.dispose()};nodes=[:];timeline.dispose();textures.dispose();frameScope.dispose();fifo.dispose();service.dispose()}
        isolated deinit {dispose()}
    }
    private func root()throws->URL{try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))}
    func testActualTwoFreshObjectsRawFacesAndSourceTimelineArrivalsOpenSequentiallyThenPromiseCompletes()throws {
        let f=try Fixture(root:root());defer{f.dispose()};f.start()
        XCTAssertEqual(f.nodes.count,1);XCTAssertEqual(f.acquisitions,1);XCTAssertEqual(f.releases,0)
        let first=try XCTUnwrap(f.nodes.values.first)
        XCTAssertEqual(first.sourceValue,3);XCTAssertFalse(first.sourceLocked)
        XCTAssertEqual(first.sourcePendingStackFrameCount,1)
        XCTAssertEqual(first.sourceLocalScale.x,0);XCTAssertTrue(first.sourceAppSpawnOwnsOuterScale)
        f.deliver(10);XCTAssertEqual(first.sourceLocalScale.x,0)
        f.deliver(550);XCTAssertEqual(f.nodes.count,1);XCTAssertTrue(f.completions.isEmpty)
        f.deliver(570);XCTAssertEqual(f.nodes.count,2);XCTAssertEqual(f.releases,1);XCTAssertEqual(f.acquisitions,2)
        f.deliver(1130);XCTAssertTrue(f.completions.isEmpty)
        f.deliver(1140);XCTAssertEqual(f.completions,[.completed]);XCTAssertTrue(f.completionInCheckpoint)
        XCTAssertEqual(f.releases,2);XCTAssertEqual(f.nodes.values.map(\.sourceValue),[3,3])
        XCTAssertTrue(f.nodes.values.allSatisfy{$0.sourcePendingStackFrameCount==0 && $0.sourcePipNodes.count==3})
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testActualPickupRemovesSourceChildrenAndCompletesAwaitOnNextRootFlushWithoutInterruptingOpen()throws {
        let f=try Fixture(root:root());defer{f.dispose()};f.start();f.deliver(140)
        let first=try XCTUnwrap(f.nodes.values.first)
        _=f.tasks.inputTask{XCTAssertTrue(first.beginSourcePickup())}
        XCTAssertEqual(f.nodes.count,1);XCTAssertEqual(f.releases,0);XCTAssertTrue(f.completions.isEmpty)
        f.deliver(150)
        XCTAssertEqual(f.releases,1);XCTAssertEqual(f.nodes.count,2)
        XCTAssertTrue(f.completions.isEmpty);XCTAssertEqual(first.sourceValue,3)
        f.deliver(720);XCTAssertEqual(f.completions,[.completed]);XCTAssertEqual(f.releases,2)
    }
    func testCapturedNodeDestructionCancelsOnceAndCannotSpawnAnotherOrRestoreTheRemovedObject()throws {
        let f=try Fixture(root:root());defer{f.dispose()};f.start();f.deliver(80)
        let first=try XCTUnwrap(f.nodes.values.first),id=first.tileID
        _=f.tasks.inputTask{first.dispose()}
        XCTAssertEqual(f.completions,[.cancelled]);XCTAssertEqual(f.releases,1)
        XCTAssertNil(first.parent);XCTAssertEqual(f.engine.state.tiles.first{$0.id==id}?.value,3)
        f.deliver(800);XCTAssertEqual(f.nodes.count,1);XCTAssertEqual(f.completions,[.cancelled]);XCTAssertEqual(f.releases,1)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testRetainedResourceAdmissionRequiresEveryOriginalIdentityAndRefusesDisposedOwner()throws {
        let textures=NativeBoardTextures(root:try root());defer{textures.dispose()}
        XCTAssertFalse(textures.sourceRetainedRegularOpenTexturesReady)
        XCTAssertNotNil(textures.texture("assets/tile.png",densityAware:false))
        XCTAssertNotNil(textures.texture("assets/shadow.png",densityAware:false))
        XCTAssertFalse(textures.sourceRetainedRegularOpenTexturesReady)
        for skin in NativeRegularStackLayout.Skin.allCases {XCTAssertNotNil(textures.texture(String(skin.rawValue.dropFirst(2)),densityAware:false))}
        XCTAssertTrue(textures.sourceRetainedRegularOpenTexturesReady)
        textures.dispose();XCTAssertFalse(textures.sourceRetainedRegularOpenTexturesReady)
    }
    func testFrameAcquisitionReentryCannotPublishLateRootOrDoubleRelease()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()};var current=true,releases=0,finishes=0
        var owner:NativeSourceAppSpawnBounceOwner!
        owner=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:{current},readRotation:{0},paintScale:{_ in},paintRotation:{_ in},ensureFullOpacity:{},random:{0.9},acquireFrames:{current=false;owner.interrupt();return{releases+=1}},finished:{_ in finishes+=1}))
        XCTAssertFalse(owner.start());XCTAssertEqual(releases,1);XCTAssertEqual(finishes,1);XCTAssertEqual(service.activeParticipantCount,0)
        service.deliver(wallMilliseconds:100);XCTAssertEqual(releases,1);XCTAssertEqual(finishes,1)
    }
}
