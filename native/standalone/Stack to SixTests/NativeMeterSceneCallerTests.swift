import XCTest
import SpriteKit
@testable import Stack_to_Six
@testable import StackToSixGameplay

nonisolated final class NativeMeterSceneCallerTests:XCTestCase {
    @MainActor private final class RenderScene:SKScene {
        var receipt:(()->Void)?
        override func didFinishUpdate(){receipt?()}
    }
    @MainActor private final class Wall {var value=0.0}
    @MainActor private final class Fixture {
        let engine:NativeGameplayEngine,textures:NativeBoardTextures,resources:NativeWildMeterDropResources
        let service:NativeSourceAnimationClockService,timeouts=NativeSourceAppTimeoutOwner()
        let scene=RenderScene(size:.init(width:390,height:844)),canvas=SKNode(),view=SKView(frame:.init(x:0,y:0,width:390,height:844))
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let sourceWall:Wall
        var onRendered:(()->Void)?,onReleased:(()->Void)?
        var capturedPaintEpochs:[UInt64]=[]
        var skinPrefixes:[String]=[]
        var caller:NativeMeterSceneCaller!,nodes:[String:NativeDiceNode]=[:],wall=0.0,epoch:UInt64=0
        var current=true,results:[NativeGameplayEvent.Kind]=[],activity=0,releases=0,audio=0,stops=0,masks=0,unmasks=0
        var onResult:((NativeGameplayEvent)->Void)?
        var startedDropIDs:[String]=[]
        init(root:URL,sourceConstructor:Bool=false){
            engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),recordedRandomChoices:Array(repeating:0,count:100),rewardPicker:{_,_ in .init(.star,variant:"cubero")})
            engine.stagedMeterOpen=true;engine.stagedMeterDrops=true
            textures=NativeBoardTextures(root:root);resources=NativeWildMeterDropResources(root:root)
            // Shared injected wall freezes during async assets: actual displaylink cannot
            // advance accepted roots. Tests explicitly deliver the same service.
            let clockWall=Wall();sourceWall=clockWall
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{clockWall.value},sourceFrameTransportEnabled:sourceConstructor)
            if sourceConstructor {service.setSourceForeground(false)}
            scene.addChild(canvas);let vc=UIViewController();vc.view=view;window.rootViewController=vc;window.makeKeyAndVisible();view.presentScene(scene)
            caller=NativeMeterSceneCaller(engine:engine,textures:textures,resources:resources,timeouts:timeouts,service:service,stage:canvas,hooks:.init(
                current:{[weak self] in self?.current==true},viewport:{.init(width:390,height:844)},renderEpoch:{[weak self] in self?.epoch ?? 0},node:{[weak self] in self?.nodes[$0]},install:{[weak self] node,_ in self?.nodes[node.tileID]=node},retire:{[weak self] id,node in
                    guard let self,self.nodes[id] === node else{return};self.nodes.removeValue(forKey:id);node.dispose()
                },cellPose:{_ in (.init(x:164,y:500),0.4)},enqueue:{action in DispatchQueue.main.async{action()}},sourceActivity:{[weak self] _,_ in self?.activity+=1;return{[weak self] in self?.releases+=1}},carrierAudio:{[weak self] _,_,_ in self?.audio+=1;return{[weak self] in self?.stops+=1}},dividerMask:{[weak self] in self?.masks+=1;return{[weak self] in self?.unmasks+=1}},selectedAudio:{[weak self] tile,_ in
                    guard let self else{return};XCTAssertEqual(self.engine.state.wildMeter,1.25);XCTAssertEqual(self.nodes[tile.id]?.variant,"cubero");XCTAssertTrue(self.nodes[tile.id]?.sourceIdleDeferred==true)
                },texturesCurrent:{true},onImpact:{_,_ in},onHaptic:{},idleAdmitted:{_ in},ownershipReleased:{[weak self] in self?.onReleased?()},fault:{XCTFail($0)},consume:{[weak self] result,_ in
                    guard let self else{return};self.caller.receive(result);for event in result.events{self.results.append(event.kind);self.onResult?(event)}
                },onDropStarted:{[weak self] node in
                    guard let self else{return}
                    XCTAssertTrue(self.caller.sourceTutorialWildDropping(node))
                    XCTAssertFalse(self.results.contains(.meterDropLanded))
                    self.startedDropIDs.append(node.tileID)
                },sourceSkin:sourceConstructor ? {[weak self] node in self?.skinPrefixes.append(node.kind+":"+(node.variant ?? "core"));return true}:nil),random:{0.5},wallNow:{ProcessInfo.processInfo.systemUptime*1000},sourcePromiseBookkeeping:sourceConstructor)
            scene.receipt={[weak self] in
                guard let self else{return};self.epoch &+= 1
                self.caller.painted(epoch:self.epoch,onscreen:self.view.window != nil && !self.view.isHidden && !self.view.isPaused,contains:{[weak self] node in
                    guard let self else{return false};let included=self.nodes[node.tileID] === node && node.parent === self.canvas && !node.isHidden && node.alpha>0
                    if included{self.capturedPaintEpochs.append(self.epoch)};return included
                });self.onRendered?()
            }
        }
        func start(){let result=engine.claimMeterReward();XCTAssertTrue(result.accepted);caller.receive(result)}
        func advance(to target:Double){while wall+16<target{wall+=16;sourceWall.value=wall;service.deliver(wallMilliseconds:wall)};wall=target;sourceWall.value=wall;service.deliver(wallMilliseconds:wall)}
        func dispose(){current=false;caller.dispose();scene.receipt=nil;onRendered=nil;onReleased=nil;service.dispose();timeouts.cancelAll();resources.dispose();textures.dispose();nodes.values.forEach{$0.dispose()};nodes.removeAll();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
    }
    @MainActor private func root()->URL {Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle") ?? Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    @MainActor func testActualSourceMeterConstructorUsesSelectedRawFaceBeforeCarrierLanding()async throws {
        let ready=expectation(description:"actual selected constructor preparation")
        let f=Fixture(root:root(),sourceConstructor:true);defer{f.dispose()}
        f.onResult={if $0.kind == .meterDropPrepared{ready.fulfill()}}
        f.start();await fulfillment(of:[ready],timeout:10)
        let drop=try XCTUnwrap(f.engine.meterDropReservations.values.first),node=try XCTUnwrap(f.nodes[drop.tileID])
        XCTAssertEqual(f.skinPrefixes,["wild:core","wild:cubero"])
        XCTAssertEqual(f.startedDropIDs,[node.tileID],"Exactly one callback at actual mounted drop admission, before landing")
        XCTAssertEqual(f.caller.captureSourceDropActiveCount(),1,"Actual awaited assets acquired the original global drop writer")
        XCTAssertTrue(node.sourceOpenedWildConstructorCurrent);XCTAssertEqual(node.kind,"wild");XCTAssertEqual(node.variant,"cubero")
        XCTAssertEqual(node.value,6);XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.alpha,0)
        f.service.setSourceForeground(true);f.advance(to:32)
        XCTAssertFalse(node.sourceOpenedWildFacePending);XCTAssertTrue(node.sourceOpenedWildFaceCurrent)
        let face=try XCTUnwrap(NativeDiceArtwork.sourceWildSkinDefinition(kind:"wild",variant:"cubero"))
        XCTAssertTrue(node.sourcePaintedNumbersTexture === f.textures.sourceCachedTexture(candidates:[face.path]))
        XCTAssertEqual(f.engine.state.wildSpawnCount,0);XCTAssertEqual(f.engine.state.wildMeter,0.25)
        XCTAssertFalse(f.results.contains(.meterDropLanded))
        f.advance(to:3000)
        let settled=expectation(description:"Source promise continuations")
        DispatchQueue.main.async{DispatchQueue.main.async{settled.fulfill()}}
        await fulfillment(of:[settled],timeout:2)
        XCTAssertTrue(f.results.contains(.meterDropCompleted));XCTAssertFalse(node.sourceIdleDeferred)
        XCTAssertTrue(node.sourceOpenedWildFaceCurrent);XCTAssertEqual(f.engine.state.wildSpawnCount,1)
        XCTAssertEqual(f.caller.captureSourceDropActiveCount(),0,"Actual travel completion releases the writer independently of paint/handoff")
    }
    @MainActor func testActualHiddenNodeSelectedBeforeChargeAndRealScenePaintReleasesCapturedCarrier()async throws {
        let ready=expectation(description:"actual assets and100 scope"),completed=expectation(description:"real Core bookkeeping"),unlocked=expectation(description:"independent wall140")
        let f=Fixture(root:root());defer{f.dispose()}
        f.onResult={event in if event.kind == .meterDropPrepared{ready.fulfill()};if event.kind == .meterDropCompleted{completed.fulfill()};if event.kind == .meterDropHandoffUnlocked{unlocked.fulfill()}}
        f.start();await fulfillment(of:[ready],timeout:10)
        let drop=try XCTUnwrap(f.engine.meterDropReservations.values.first),node=try XCTUnwrap(f.nodes[drop.tileID])
        XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(node.alpha,0);XCTAssertEqual(f.engine.state.wildMeter,0.25)
        let identity=ObjectIdentifier(node);XCTAssertEqual(f.caller.retainedNodeIDs,[drop.tileID]);XCTAssertEqual(f.activity,1)
        let painted=expectation(description:"real onscreen fallback rendered");var delivered=false
        f.onReleased={if !delivered{delivered=true;painted.fulfill()}}
        f.advance(to:2000);await fulfillment(of:[completed,unlocked],timeout:10)
        // The mounted SKScene delivers actual didFinishUpdate epochs; no manual
        // includesReplacement=true receipt or guessed renderer completion here.
        await fulfillment(of:[painted],timeout:2)
        XCTAssertFalse(f.capturedPaintEpochs.isEmpty,"Actual didFinishUpdate contained the restored same Node before release")
        XCTAssertTrue(f.caller.retainedNodeIDs.isEmpty)
        XCTAssertEqual(ObjectIdentifier(try XCTUnwrap(f.nodes[drop.tileID])),identity)
        XCTAssertTrue(node.parent === f.canvas);XCTAssertFalse(node.sourceIdleDeferred)
        XCTAssertEqual(f.engine.state.wildSpawnCount,1);XCTAssertFalse(f.engine.sourceMeterHandoffInProgress)
        XCTAssertEqual(f.activity,f.releases);XCTAssertEqual(f.audio,f.stops);XCTAssertEqual(f.masks,f.unmasks)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    @MainActor func testActualSourcePauseDoesNotInventLandedWhileSourceWallAndRendererStayIndependent()async throws {
        let ready=expectation(description:"assets"),f=Fixture(root:root());defer{f.dispose()}
        f.onResult={if $0.kind == .meterDropPrepared{ready.fulfill()}}
        f.start();await fulfillment(of:[ready],timeout:10)
        let drop=try XCTUnwrap(f.engine.meterDropReservations.values.first),node=try XCTUnwrap(f.nodes[drop.tileID])
        XCTAssertTrue(f.caller.sourceTutorialWildDropping(node))
        f.advance(to:1000);let pose=node.position
        f.service.setSourceGlobalPaused(true);f.advance(to:2000)
        XCTAssertEqual(node.position,pose);XCTAssertTrue(node.sourceIdleDeferred)
        XCTAssertTrue(f.caller.sourceTutorialWildDropping(node))
        XCTAssertFalse(f.results.contains(.meterDropLanded));XCTAssertEqual(f.engine.state.wildSpawnCount,0)
        XCTAssertEqual(f.activity,1);XCTAssertEqual(f.releases,0)
        f.service.setSourceGlobalPaused(false);f.advance(to:3000)
        XCTAssertTrue(f.results.contains(.meterDropCompleted));XCTAssertFalse(node.sourceIdleDeferred)
        XCTAssertFalse(f.caller.sourceTutorialWildDropping(node))
    }
    @MainActor func testActualOldHiddenNodeRetirementPreservesSameIDReplacementAndKillsOnlyCapturedRoots()async throws {
        let ready=expectation(description:"assets"),f=Fixture(root:root());defer{f.dispose()}
        f.onResult={if $0.kind == .meterDropPrepared{ready.fulfill()}}
        f.start();await fulfillment(of:[ready],timeout:10)
        let drop=try XCTUnwrap(f.engine.meterDropReservations.values.first),old=try XCTUnwrap(f.nodes[drop.tileID])
        let replacement=NativeDiceNode(id:old.tileID,value:4,kind:"regular",variant:nil,depth:1,locked:false,textures:f.textures)
        f.nodes[old.tileID]=replacement;f.canvas.addChild(replacement)
        f.caller.bind(replacement,cell:drop.cell,generation:drop.generation)
        XCTAssertFalse(f.caller.sourceTutorialWildDropping(old))
        XCTAssertFalse(f.caller.sourceTutorialWildDropping(replacement))
        f.caller.remove(old)
        XCTAssertTrue(f.nodes[old.tileID] === replacement);XCTAssertTrue(replacement.parent === f.canvas)
        XCTAssertFalse(replacement.sourceIdleDeferred);XCTAssertEqual(f.service.activeParticipantCount,0)
        XCTAssertEqual(f.activity,f.releases);XCTAssertEqual(f.audio,f.stops);f.advance(to:3000)
        XCTAssertFalse(f.results.contains(.meterDropCompleted));XCTAssertEqual(f.engine.state.wildSpawnCount,0)
    }
    @MainActor func testExplicitCarrierInterruptUsesRealFinallyIdleFallbackAndIndependentWallRelease()async throws {
        let ready=expectation(description:"assets"),completed=expectation(description:"finally bookkeeping"),unlocked=expectation(description:"wall140")
        let f=Fixture(root:root());defer{f.dispose()}
        f.onResult={event in if event.kind == .meterDropPrepared{ready.fulfill()};if event.kind == .meterDropCompleted{completed.fulfill()};if event.kind == .meterDropHandoffUnlocked{unlocked.fulfill()}}
        f.start();await fulfillment(of:[ready],timeout:10)
        let drop=try XCTUnwrap(f.engine.meterDropReservations.values.first),node=try XCTUnwrap(f.nodes[drop.tileID])
        f.advance(to:800);XCTAssertTrue(node.sourceIdleDeferred)
        f.caller.interruptAcceptedAnimation(id:drop.id)
        await fulfillment(of:[completed,unlocked],timeout:10)
        XCTAssertTrue(node.parent === f.canvas);XCTAssertFalse(node.sourceIdleDeferred)
        XCTAssertFalse(f.results.contains(.meterDropImpact),"Interruption never manufactures contact")
        XCTAssertEqual(f.engine.state.wildSpawnCount,1);XCTAssertEqual(f.activity,f.releases)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }

}
