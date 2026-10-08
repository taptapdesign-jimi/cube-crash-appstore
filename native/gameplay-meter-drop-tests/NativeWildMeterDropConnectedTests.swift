import XCTest
import SpriteKit
import ImageIO
@testable import Stack_to_Six
@testable import StackToSixGameplay

nonisolated final class NativeWildMeterDropConnectedTests:XCTestCase {
    @MainActor private final class Clock {
        final class Phase:NativeSourceAnimationParticipant {
            let advance:(Double)->Void
            init(_ advance:@escaping(Double)->Void){self.advance=advance}
            func advanceSourceAnimation(seconds:Double){advance(seconds)}
        }
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
        var parts:[Int:Phase]=[:],sequence=0,wall=0.0
        var births:[Double]=[]
        func attach(_ duration:Double,_ advance:@escaping(Double)->Void,_ done:@escaping(Bool)->Void)->NativeWildMeterDropSceneOwner.MotionLease? {
            sequence+=1;let id=sequence,part=Phase(advance);parts[id]=part;births.append(runtime.animationSeconds)
            guard let lease=runtime.attach(participant:part,family:.timeline,duration:duration,cleanup:{[weak self] success in self?.parts.removeValue(forKey:id);done(success)})else{return nil}
            return .init(cancel:{lease.cancel()},suspend:{lease.setSuspended($0)})
        }
        func advance(to target:Double){while wall+16<target {wall+=16;runtime.deliver(wallMilliseconds:wall)};wall=target;runtime.deliver(wallMilliseconds:wall)}
    }
    @MainActor private func assetsRoot()->URL {
        #if os(macOS)
        URL(fileURLWithPath:"/Users/user/cube-crash/native/standalone/Stack to Six/NativeAssets.bundle")
        #else
        Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle") ?? Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        #endif
    }
    @MainActor private final class Session {
        let engine:NativeGameplayEngine,drop:NativeMeterDropReservation,capture:NativeWildMeterDropRuntime.Capture
        let stage=SKScene(size:CGSize(width:390,height:844)),board=SKNode(),tile:SKSpriteNode
        let catalog:NativeWildMeterDropResources,timeouts=NativeSourceAppTimeoutOwner(),clock=Clock()
        var owner:NativeWildMeterDropSceneOwner!
        var current=true,renderEpoch:UInt64=1
        var receipts:[NativeWildMeterDropRuntime.Event]=[],coreReceipts:[NativeMeterDropReceipt]=[]
        var activityBegins=0,activityEnds=0,audioBegins=0,audioStops=0,masks=0,unmasks=0
        init(root:URL,ready:@escaping()->Void)throws {
            engine=NativeGameplayEngine(state:NativeBoardState(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:2),NativeTile(id:"b",cell:.init(column:1,row:0),value:3)],wildMeter:1.25),
                recordedRandomChoices:[0,0,0],rewardPicker:{_,_ in NativeWildRewardChoice(.star,variant:"cubero")})
            engine.stagedMeterDrops=true;engine.stagedOrdinaryMoves=true;engine.stagedDirectWildMoves=true
            XCTAssertTrue(engine.claimMeterReward().accepted)
            drop=try XCTUnwrap(engine.meterDropReservations.values.first)
            capture = .init(id:drop.id,generation:drop.generation,epoch:9)
            let source=try XCTUnwrap(CGImageSourceCreateWithURL(root.appendingPathComponent("assets/shop/cubero/cubero.png") as CFURL,nil))
            let image=try XCTUnwrap(CGImageSourceCreateImageAtIndex(source,0,nil))
            tile=SKSpriteNode(texture:SKTexture(cgImage:image));tile.name="borrowed-original-cubero"
            tile.size=CGSize(width:170,height:128);tile.position=CGPoint(x:164,y:500);tile.setScale(0.4);tile.alpha=0
            catalog=NativeWildMeterDropResources(root:root)
            stage.addChild(board);board.addChild(tile)
            let plan=NativeWildMeterDropPlan(arcade:false,viewport:.init(x:390,y:844),tileSize:128,target:.init(x:164,y:344),
                parentWorld:.init(a:0.4,d:0.4,tx:98.4,ty:206.4),originalRotation:0,originalZIndex:17,
                usesUniformDropScale:NativeWildMeterDropPlan.sourceUsesUniformDropScale(variant:"cubero"),random:{0.5})
            owner=NativeWildMeterDropSceneOwner(capture:capture,tile:tile,stage:stage,arcade:false,resources:catalog,timeouts:timeouts,
                attach:{[weak clock] duration,advance,done in clock?.attach(duration,advance,done)},wallNow:{ProcessInfo.processInfo.systemUptime*1000},
                renderEpoch:{[weak self] in self?.renderEpoch ?? 0},isCurrent:{[weak self] in self?.current == true},
                stagePoint:{CGPoint(x:$0.x,y:844-$0.y)},makePlan:{plan},makeHandoff:{[weak self] plan in
                    guard let self else{return nil}
                    return NativeWildMeterDropNodeHandoff(tile:self.tile,stage:self.stage,capture:self.capture,
                        sourceParentVisualScale:plan.visualScale,stagePoint:{CGPoint(x:$0.x,y:844-$0.y)},isCurrent:{[weak self] c,n in self?.current == true && c==self?.capture && n===self?.tile})
                })
            owner.onBeginActivity={ [weak self] in self?.activityBegins+=1;return{[weak self] in self?.activityEnds+=1} }
            owner.onBeginAudio={ [weak self] in self?.audioBegins+=1;return{[weak self] in self?.audioStops+=1} }
            owner.onBeginDividerMask={ [weak self] in self?.masks+=1;return{[weak self] in self?.unmasks+=1} }
            owner.onReceipt={ [weak self] event in
                guard let self else{return};self.receipts.append(event)
                let r:NativeMeterDropReceipt?
                switch event {case .activityBegin100:r = .assetsPrepared
                case .tileRevealed:r = .revealed;case .impact:r = .impact
                case .restoreBoardFallback:r = .boardFallbackRestored
                case .dropPromiseCompleted:r = .dropPromiseCompleted
                case .selectedWarmupCompleted:r = .selectedWarmupCompleted
                case .handoffLock(false):r = .wallHandoffUnlocked
                default:r=nil}
                if let r {self.coreReceipts.append(r);XCTAssertTrue(self.engine.applyMeterDropReceipt(id:self.drop.id,generation:self.drop.generation,receipt:r).accepted)}
                if event == .activityBegin100 {ready()}
                if event == .mediumHaptic {
                    XCTAssertEqual(self.tile.position,CGPoint(x:164,y:500),"Actual source target must paint before haptic/onImpact")
                    XCTAssertEqual(self.tile.xScale,CGFloat(Float(Double(CGFloat(Float(0.4)))*0.76)))
                }
            }
            owner.onFailure={XCTFail($0)}
        }
        func dispose(){owner.dispose();clock.runtime.dispose();timeouts.cancelAll();catalog.dispose();stage.removeAllChildren()}
    }
    @MainActor func testHiddenSelectedOriginalNodeIsBorrowedAndRendererTicksCannotDriveSourceTravel() async throws {
        let ready=expectation(description:"original carrier textures ready"),s=try Session(root:assetsRoot()){ready.fulfill()}
        defer{s.dispose()}
        let texture=try XCTUnwrap(s.tile.texture),identity=ObjectIdentifier(s.tile)
        XCTAssertEqual(s.tile.alpha,0);XCTAssertTrue(s.tile.parent===s.board)
        s.owner.selectedWarmupCompleted(s.capture);s.owner.start()
        await fulfillment(of:[ready],timeout:10)
        XCTAssertTrue(s.owner.presentationMounted);XCTAssertTrue(s.tile.parent===s.stage)
        for epoch in 2...30 {s.renderEpoch=UInt64(epoch);s.owner.painted(epoch:UInt64(epoch),onscreen:true,includesReplacement:true)}
        XCTAssertFalse(s.receipts.contains(.tileRevealed),"Scene15/30 render receipts are not animation delivery")
        XCTAssertEqual(s.tile.alpha,0);XCTAssertFalse(s.engine.beginDrag(tileID:s.drop.tileID))
        XCTAssertTrue(s.engine.beginDrag(tileID:"a"));s.engine.cancelDrag()
        s.clock.advance(to:506)
        XCTAssertEqual(ObjectIdentifier(s.tile),identity);XCTAssertTrue(s.tile.texture===texture)
        XCTAssertEqual(s.tile.xScale,s.tile.yScale,"Cubero uses original uniform dimension predicate")
        XCTAssertEqual(s.coreReceipts.filter{$0 == .selectedWarmupCompleted}.count,1)
    }
    @MainActor func testActualRootImpactCaptureWarmDestinationAndIndependentWall140DuringPause() async throws {
        let ready=expectation(description:"ready"),s=try Session(root:assetsRoot()){ready.fulfill()};defer{s.dispose()}
        s.owner.start();s.owner.selectedWarmupCompleted(s.capture)
        await fulfillment(of:[ready],timeout:10)
        s.clock.advance(to:1400);s.clock.advance(to:1410)
        XCTAssertEqual(s.clock.births.count,2);XCTAssertEqual(s.clock.births[1],1.41,accuracy:1e-9)
        s.clock.advance(to:1850)
        XCTAssertTrue(s.owner.restored);XCTAssertTrue(s.tile.parent===s.board)
        XCTAssertEqual(s.engine.state.wildSpawnCount,1);XCTAssertTrue(s.engine.sourceMeterHandoffInProgress)
        XCTAssertFalse(s.engine.beginDrag(tileID:s.drop.tileID));XCTAssertTrue(s.engine.beginDrag(tileID:"a"))
        XCTAssertTrue(s.engine.drop(target:s.drop.cell).accepted,"Warm handoff permits destination but not pickup")
        s.clock.runtime.setGlobalPaused(true)
        let target=s.tile.position
        let elapsed=expectation(description:"source140 app timeout survives animation pause")
        DispatchQueue.main.asyncAfter(deadline:.now()+0.22){elapsed.fulfill()}
        await fulfillment(of:[elapsed],timeout:1)
        XCTAssertFalse(s.engine.sourceMeterHandoffInProgress);XCTAssertEqual(s.tile.position,target)
        XCTAssertEqual(s.activityBegins,1);XCTAssertEqual(s.activityEnds,1)
        XCTAssertEqual(s.audioBegins,1);XCTAssertEqual(s.audioStops,1)
        XCTAssertEqual(s.masks,1);XCTAssertEqual(s.unmasks,1)
    }
    @MainActor func testPurePauseRetainsAcceptedFlightAndExplicitInterruptionKillsItsCapturedRootsOnce() async throws {
        let ready=expectation(description:"ready"),s=try Session(root:assetsRoot()){ready.fulfill()};defer{s.dispose()}
        s.owner.start();await fulfillment(of:[ready],timeout:10);s.clock.advance(to:750)
        let pose=s.tile.position,scale=s.tile.xScale
        s.clock.runtime.setGlobalPaused(true);s.clock.advance(to:1100)
        XCTAssertEqual(s.tile.position,pose);XCTAssertEqual(s.tile.xScale,scale)
        XCTAssertEqual(s.activityEnds,0);XCTAssertFalse(s.owner.restored)
        s.owner.interruptAcceptedAnimation();s.owner.interruptAcceptedAnimation()
        XCTAssertTrue(s.owner.restored);XCTAssertTrue(s.tile.parent===s.board)
        XCTAssertEqual(s.activityEnds,1);XCTAssertEqual(s.audioStops,1);XCTAssertEqual(s.clock.runtime.activeCount,0)
        XCTAssertFalse(s.receipts.contains(.landed));XCTAssertEqual(s.receipts.filter{$0 == .dropPromiseCompleted}.count,1)
        s.clock.runtime.setGlobalPaused(false);s.clock.advance(to:2400)
        XCTAssertFalse(s.receipts.contains(.impact),"Killed pre-impact root cannot later create a new impact phase")
    }
    @MainActor func testObsoleteGenerationCannotWarmRevealOrReparentAReplacementAndDisposalClosesCapturedOwners() async throws {
        let ready=expectation(description:"ready"),s=try Session(root:assetsRoot()){ready.fulfill()};defer{s.dispose()}
        s.owner.start();await fulfillment(of:[ready],timeout:10);s.clock.advance(to:650)
        s.current=false;let count=s.receipts.count
        let replacement=SKSpriteNode();replacement.name="new-generation";s.board.addChild(replacement)
        s.owner.dispose();s.owner.selectedWarmupCompleted(s.capture);s.clock.advance(to:2200)
        XCTAssertEqual(s.receipts.count,count);XCTAssertTrue(replacement.parent===s.board)
        XCTAssertEqual(replacement.alpha,1);XCTAssertEqual(s.audioStops,1);XCTAssertEqual(s.activityEnds,1);XCTAssertEqual(s.unmasks,1)
    }
}
