import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeRegularSixSharedLayersTests:XCTestCase {
    @MainActor private final class Wall:NativeRegularSixWallScheduling {
        var captured:[String:()->Void]=[:]
        func schedule(generation:UInt64,id:String,delayMilliseconds:Int,elapsed:@escaping()->Void)->NativeSharedSmokeRootCancellation {
            XCTAssertEqual(delayMilliseconds,1000);captured[id]=elapsed
            return .init{[weak self] _ in self?.captured.removeValue(forKey:id)}
        }
        func fire(){let callbacks=captured;captured.removeAll();for key in callbacks.keys.sorted(){callbacks[key]?()}}
    }
    @MainActor private final class Fixture {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),wall=Wall(),canvas=SKNode(),tile=SKNode()
        var current=true,draws=0,seed:UInt32=123,now=1000.0
        var onAcquire:((NativeSharedFxReceipt)->Void)?
        var receipts:[NativeSharedFxReceipt]=[],released:[String:Int]=[:]
        lazy var session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{[unowned self] in seed=seed &* 1664525 &+ 1013904223;draws += 1;return Double(seed)/4294967296})
        lazy var resources=NativeRegularSixSharedResources(smoke:session)
        lazy var scheduler=NativeSharedSmokeValueRootScheduler(runtime:runtime)
        lazy var renderer=NativeSharedSmokeRootRenderer(session:session,scheduler:scheduler,sourceClockNow:{[unowned self] in runtime.animationSeconds*1000})
        lazy var context=NativeRegularSixSharedContext(resources:resources,scheduler:scheduler,wall:wall,smokeRenderer:renderer,monotonicNow:{[unowned self] in now},current:{[weak self] _ in self?.current==true},acquire:{[weak self] receipt in
            self?.receipts.append(receipt);self?.onAcquire?(receipt)
            return{[weak self] in self?.released[receipt.invocationID,default:0] += 1}
        })
        init(){canvas.addChild(tile)}
        func make()->NativeRegularSixSharedLayers {try! .init(context:context,canvas:canvas,tile:tile,origin:CGPoint(x:80,y:90),tileSize:96,destinationDepth:43,generation:1,reduced:false)}
        func advance(to ms:Int){for time in stride(from:0,through:ms,by:10){runtime.deliver(wallMilliseconds:Double(time))}}
        func dispose(){context.dispose();renderer.dispose();runtime.dispose()}
    }
    func testRealCapturedPoolsDepthAndIndependentSourceReceipts(){
        let f=Fixture(),owner=f.make();defer{f.dispose()}
        XCTAssertEqual(owner.shardCount,12);XCTAssertEqual(f.resources.cachedPatterns,1)
        XCTAssertEqual(Double(owner.shardLayer.zPosition),Double(Float(43)))
        XCTAssertEqual(owner.shardLayer.position,CGPoint(x:80,y:90));XCTAssertEqual(owner.shardLayer.xScale,0.75)
        XCTAssertTrue(owner.shardLayer.parent === f.canvas)
        XCTAssertEqual(f.canvas.children.filter{$0.zPosition==9990}.count,1)
        XCTAssertEqual(f.receipts.map(\.label),["regular-merge6-shards","regular-merge6-smoke"])
        XCTAssertNotEqual(f.receipts[0].invocationID,f.receipts[1].invocationID)
        XCTAssertEqual(f.receipts.map(\.tailMilliseconds),[100,100])
        XCTAssertEqual(owner.shardLayer.children[0].alpha,CGFloat(Float(NativeSharedSmokeSpritePresentation.sourcePackedAlpha(0.85))))
        XCTAssertNil(owner.shardLayer.action(forKey:"source-regular-six-finite"))
    }
    func testWallCleanupDuringGlobalPauseLeavesCommonSmokeOnItsActualAnimationClock(){
        let f=Fixture(),owner=f.make();defer{f.dispose()}
        f.advance(to:900)
        XCTAssertEqual(f.resources.activeShards,12)
        XCTAssertEqual(owner.shardLayer.children.count,12)
        XCTAssertTrue(f.released.isEmpty)
        f.runtime.setGlobalPaused(true);f.wall.fire()
        XCTAssertEqual(f.resources.activeShards,0);XCTAssertNil(owner.shardLayer.parent)
        XCTAssertEqual(f.renderer.activeOwnerCount,1)
        XCTAssertEqual(f.context.activeOwnerCount,1)
        XCTAssertEqual(f.released[f.receipts[0].invocationID],1)
        XCTAssertNil(f.released[f.receipts[1].invocationID])
        f.runtime.deliver(wallMilliseconds:1100);f.runtime.setGlobalPaused(false)
        f.runtime.deliver(wallMilliseconds:1200)
        XCTAssertEqual(f.renderer.activeOwnerCount,0);XCTAssertEqual(f.context.activeOwnerCount,0)
        XCTAssertEqual(f.released[f.receipts[1].invocationID],1)
    }
    func testCapturedOldWallCannotStealReplacementPooledShaders(){
        let f=Fixture();defer{f.dispose()}
        let old=f.make(),oldCallbacks=Array(f.wall.captured.values)
        old.dispose()
        // Cycle all three app patterns, then reuse the original selected pool.
        let b=f.make(),c=f.make();b.dispose();c.dispose()
        let replacement=f.make(),node=replacement.shardLayer.children[0]
        let releases=f.released
        oldCallbacks.forEach{$0()}
        XCTAssertEqual(f.resources.activeShards,12)
        XCTAssertTrue(node.parent === replacement.shardLayer)
        XCTAssertEqual(f.released,releases)
        XCTAssertEqual(f.resources.cachedPatterns,3)
    }
    func testServiceDisposalDrainsResourcesAndCapturedScopesExactlyOnce(){
        let f=Fixture(),owner=f.make();defer{f.dispose()}
        f.runtime.dispose()
        XCTAssertEqual(owner.shardCount,0);XCTAssertEqual(f.resources.activeShards,0)
        XCTAssertEqual(f.session.pool.activeCount,0)
        XCTAssertEqual(f.context.activeOwnerCount,0);XCTAssertTrue(f.wall.captured.isEmpty)
        XCTAssertTrue(f.receipts.allSatisfy{f.released[$0.invocationID]==1})
        owner.dispose();f.wall.fire()
        XCTAssertTrue(f.receipts.allSatisfy{f.released[$0.invocationID]==1})
    }
    func testRejectedGenerationAcquiresNoHotRandomPatternPoolOrActivity(){
        let f=Fixture();defer{f.dispose()};f.current=false
        XCTAssertThrowsError(try NativeRegularSixSharedLayers(context:f.context,canvas:f.canvas,tile:f.tile,origin:.zero,tileSize:128,destinationDepth:43,generation:1,reduced:false))
        XCTAssertEqual(f.draws,0);XCTAssertEqual(f.resources.cachedPatterns,0)
        XCTAssertTrue(f.receipts.isEmpty);XCTAssertEqual(f.runtime.activeCount,0)
        XCTAssertEqual(f.session.nextRegularSixPattern(),0)
    }
    // Requires the private bounded carrier patch; tests actual constructor
    // injection rather than merely calling the arithmetic smoke planner.
    func testOptInCarrierReplacesOldSmokeRNGSlotAndDoesNotOwnSourceLayerRetirement()throws{
        let f=Fixture();defer{f.dispose()}
        let slot=NativeRegularSixSharedSlot(context:f.context,canvas:f.canvas,tile:f.tile)
        var legacyDraws=0
        let carrier=try NativeRegularSixSpritePresentation(origin:CGPoint(x:80,y:90),tileSize:96,destinationDepth:43,combinedDepth:5,generation:1,reduced:false,hotFactor:0.1,patternIndex:2,isCurrent:{_ in true},random:{legacyDraws += 1;return 0.1},sourceSlot:slot)
        XCTAssertEqual(legacyDraws,0,"Source exact slot shares session stream; no second legacy smoke plan")
        XCTAssertTrue(carrier.shardLayer.children.isEmpty);XCTAssertTrue(carrier.smokeLayer.children.isEmpty)
        XCTAssertEqual(f.resources.activeShards,12);XCTAssertEqual(f.renderer.activeOwnerCount,1)
        XCTAssertEqual(f.context.activeOwnerCount,1)
        f.runtime.setGlobalPaused(true);carrier.paint(seconds:1)
        XCTAssertEqual(f.renderer.activeOwnerCount,1,"nativeRaw paint cannot settle GSAP smoke")
        carrier.dispose()
        XCTAssertEqual(f.context.activeOwnerCount,0);XCTAssertEqual(f.resources.activeShards,0)
        XCTAssertEqual(f.session.pool.activeCount,0)
    }
    func testActualNativeRawCarrierCompletionDoesNotCancelPausedSourceSmoke()async throws{
        let f=Fixture();defer{f.dispose()}
        let host=SKView(frame:CGRect(x:0,y:0,width:240,height:300)),scene=SKScene(size:CGSize(width:240,height:300))
        scene.addChild(f.canvas)
        let window=UIWindow(frame:host.frame),controller=UIViewController()
        window.rootViewController=controller;controller.view.addSubview(host);window.isHidden=false
        host.presentScene(scene)
        defer{host.presentScene(nil);window.isHidden=true}
        let carrier=try NativeRegularSixSpritePresentation(origin:CGPoint(x:80,y:90),tileSize:96,destinationDepth:43,combinedDepth:5,generation:1,reduced:false,hotFactor:1,patternIndex:0,isCurrent:{_ in true},random:{0.5},sourceSlot:.init(context:f.context,canvas:f.canvas,tile:f.tile))
        f.runtime.setGlobalPaused(true)
        let completed=expectation(description:"actual existing nativeRaw SKAction carrier completion")
        carrier.onFinished={success in XCTAssertTrue(success);completed.fulfill()}
        carrier.mount(in:f.canvas)
        await fulfillment(of:[completed],timeout:4)
        XCTAssertEqual(f.renderer.activeOwnerCount,1)
        XCTAssertEqual(f.context.activeOwnerCount,1)
        XCTAssertEqual(f.resources.activeShards,12,"manual wall scheduler has not delivered; Source shards remain captured")
        f.wall.fire()
        XCTAssertEqual(f.resources.activeShards,0);XCTAssertEqual(f.renderer.activeOwnerCount,1)
    }

    func testShardActivityAcquisitionReentryClosesAdmissionBeforeResourcesRandomOrRetention(){
        let f=Fixture();defer{f.dispose()}
        f.onAcquire={[weak f] receipt in if receipt.kind == .shards{f?.context.dispose()}}
        XCTAssertThrowsError(try NativeRegularSixSharedLayers(context:f.context,canvas:f.canvas,tile:f.tile,origin:.zero,tileSize:128,destinationDepth:43,generation:1,reduced:false))
        XCTAssertFalse(f.context.canAdmit);XCTAssertEqual(f.context.activeOwnerCount,0)
        XCTAssertEqual(f.resources.activeShards,0);XCTAssertEqual(f.session.pool.activeCount,0)
        XCTAssertEqual(f.renderer.activeOwnerCount,0);XCTAssertEqual(f.runtime.activeCount,0)
        XCTAssertEqual(f.draws,0);XCTAssertTrue(f.wall.captured.isEmpty)
        XCTAssertEqual(f.receipts.count,1);XCTAssertEqual(f.released[f.receipts[0].invocationID],1)
    }
    func testCommonSmokeActivityAcquisitionReentryClosesBothCapturedComponents(){
        let f=Fixture();defer{f.dispose()}
        var capturedShardDraws=0
        f.onAcquire={[weak f] receipt in if receipt.kind == .smoke{capturedShardDraws=f?.draws ?? -1;f?.context.dispose()}}
        XCTAssertThrowsError(try NativeRegularSixSharedLayers(context:f.context,canvas:f.canvas,tile:f.tile,origin:.zero,tileSize:128,destinationDepth:43,generation:1,reduced:false))
        XCTAssertFalse(f.context.canAdmit);XCTAssertEqual(f.context.activeOwnerCount,0)
        XCTAssertEqual(f.resources.activeShards,0);XCTAssertEqual(f.session.pool.activeCount,0)
        XCTAssertEqual(f.renderer.activeOwnerCount,0);XCTAssertEqual(f.runtime.activeCount,0)
        XCTAssertTrue(f.wall.captured.isEmpty)
        XCTAssertEqual(f.draws,capturedShardDraws,"Rejected smoke must not consume hot/visual RNG after its activity acquisition")
        XCTAssertEqual(f.receipts.map(\.kind),[.shards,.smoke])
        XCTAssertTrue(f.receipts.allSatisfy{f.released[$0.invocationID]==1})
        f.context.dispose();f.wall.fire()
        XCTAssertTrue(f.receipts.allSatisfy{f.released[$0.invocationID]==1})
    }

}
