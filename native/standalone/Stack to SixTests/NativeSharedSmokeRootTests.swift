import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeSharedSmokeRootTests:XCTestCase {
    private final class Random {
        var seed:UInt32=127,draws=0
        func next()->Double{draws += 1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296}
    }
    private struct Gold:Decodable{let version:String,rows:[Row]}
    private struct Row:Decodable{let name:String,recipe:NativeSharedSmokeRecipe,samples:[Sample]}
    private struct Sample:Decodable{let wall:Double,draws:Int,layers:[Layer]}
    private struct Layer:Decodable{let tag:String,puffs:[Puff]}
    private struct Puff:Decodable{let x,y,alpha,fill,rx,ry,scale,rotation:Double}
    private final class RawModal:NativeSourceAnimationParticipant {
        var last=0.0
        func advanceSourceAnimation(seconds:Double){last=seconds}
    }
    private func fixture()throws->Gold{
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"shared-smoke-global-root-oracle",withExtension:"json"))
        return try JSONDecoder().decode(Gold.self,from:Data(contentsOf:url))
    }
    private func owner(_ recipe:NativeSharedSmokeRecipe,canvas:SKNode,tile:SKNode,pool:NativeSharedSmokeSpritePool,
                       runtime:NativeSourceAnimationRuntime,random:Random,current:@escaping(UInt64)->Bool={_ in true},
                       acquire:@escaping(NativeSharedFxReceipt)->(()->Void)?={_ in nil})throws->NativeSharedSmokeRootSpritePresentation{
        try NativeSharedSmokeRootSpritePresentation(recipe:recipe,generation:1,sequence:1,sourceOwnerID:"test-scene",canvas:canvas,tile:tile,origin:.zero,renderScale:1,pool:pool,scheduler:NativeSharedSmokeValueRootScheduler(runtime:runtime),sourceClockNowMilliseconds:{runtime.animationSeconds*1000},isCurrent:current,random:random.next,consumeHotFactor:{1},acquireActivity:acquire)
    }
    func testActualGlobalRootsAcrossNineAuthoredProfilesMatchOriginalSourcePosePoolAndDrawBoundaries()throws{
        let gold=try fixture();XCTAssertEqual(gold.version,"3.13.0");XCTAssertEqual(gold.rows.count,9)
        for row in gold.rows {
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random()
            canvas.addChild(tile);_=pool.prewarm(to:76)
            var recipe=row.recipe;recipe.fxTag="A"
            let a=try owner(recipe,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random)
            var b:NativeSharedSmokeRootSpritePresentation?
            for sample in row.samples {
                if sample.wall==30{recipe.fxTag="B";b=try owner(recipe,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random)}
                runtime.deliver(wallMilliseconds:sample.wall)
                XCTAssertEqual(random.draws,sample.draws,row.name+"/"+String(sample.wall))
                for source in sample.layers {
                    let carrier=source.tag=="A" ? a:try XCTUnwrap(b)
                    XCTAssertNotNil(carrier.layer.parent,row.name)
                    XCTAssertEqual(carrier.layer.children.count,source.puffs.count,row.name)
                    for(node,source)in zip(carrier.layer.children,source.puffs){
                        let shape=try XCTUnwrap(node as? SKShapeNode),path=try XCTUnwrap(shape.path)
                        // Pure 135,913-check oracle already requires source
                        // Doubles <=1e-9. SpriteKit backend stores these scalar
                        // properties as Float32: derive its representation,
                        // rather than relax the source oracle itself.
                        XCTAssertEqual(shape.position.x,CGFloat(Float(source.x)),row.name)
                        XCTAssertEqual(shape.position.y,CGFloat(Float(-source.y)),row.name)
                        XCTAssertEqual(shape.xScale,CGFloat(Float(source.scale)),row.name)
                        XCTAssertEqual(shape.zRotation,CGFloat(Float(-source.rotation)),row.name)
                        let packed=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(source.alpha*source.fill)
                        XCTAssertEqual(shape.alpha,CGFloat(Float(packed)),row.name)
                        XCTAssertEqual(path.boundingBoxOfPath.width,source.rx*2,accuracy:1e-10,row.name)
                        XCTAssertEqual(path.boundingBoxOfPath.height,source.ry*2,accuracy:1e-10,row.name)
                        XCTAssertFalse(shape.hasActions())
                    }
                }
            }
            a.dispose();b?.dispose();runtime.dispose();XCTAssertEqual(pool.activeCount,0)
        }
    }
    func testUnlabelledSmokeAcquiresNoActivityAndLabeledTTLReleasesCapturedScopeAfterResources()throws{
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random()
        canvas.addChild(tile);var labelCalls=0,releases=0
        var unlabeled=NativeSharedSmokeRecipe();unlabeled.maxParticles=6;unlabeled.activityLeaseLabel=""
        let u=try owner(unlabeled,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random,acquire:{_ in labelCalls += 1;return nil})
        XCTAssertEqual(labelCalls,0);u.dispose();runtime.deliver(wallMilliseconds:17)
        var labeled=unlabeled;labeled.activityLeaseLabel="regular-merge6-smoke"
        let l=try owner(labeled,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random,acquire:{receipt in
            labelCalls += 1;XCTAssertEqual(receipt.tailMilliseconds,100);XCTAssertEqual(receipt.sourceOwnerID,"test-scene")
            return{releases += 1;XCTAssertEqual(pool.activeCount,0)}
        })
        runtime.deliver(wallMilliseconds:400);runtime.deliver(wallMilliseconds:800);runtime.deliver(wallMilliseconds:1017)
        XCTAssertTrue(l.disposed);XCTAssertEqual(labelCalls,1);XCTAssertEqual(releases,1)
        l.dispose();runtime.dispose();XCTAssertEqual(releases,1)
    }
    func testCapturedOldRootCleanupCannotStealNewPooledPresentationAtSameGeneration()throws{
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random()
        canvas.addChild(tile);_=pool.prewarm(to:76)
        var recipe=NativeSharedSmokeRecipe();recipe.maxParticles=6;recipe.groupedOwner=true
        let a=try owner(recipe,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random)
        runtime.deliver(wallMilliseconds:80);a.dispose()
        let c=try owner(recipe,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random)
        let ids=c.layer.children.map(ObjectIdentifier.init),count=pool.activeCount
        runtime.deliver(wallMilliseconds:105)
        XCTAssertEqual(c.layer.children.map(ObjectIdentifier.init),ids);XCTAssertEqual(pool.activeCount,count)
        XCTAssertFalse(c.disposed);XCTAssertEqual(a.activeNodeCount,0)
        c.dispose();runtime.dispose();XCTAssertEqual(pool.activeCount,0)
    }
    func testCoveredDeallocatedOwnerReleasesResourcesAndCapturedReceiptWithoutFutureDelivery()throws{
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random()
        canvas.addChild(tile);var recipe=NativeSharedSmokeRecipe();recipe.activityLeaseLabel="special-merge6-smoke";recipe.maxParticles=6
        var releases=0,completions=0
        var value:NativeSharedSmokeRootSpritePresentation?=try owner(recipe,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random,acquire:{_ in return{releases += 1}})
        value?.onFinished={success in XCTAssertFalse(success);completions += 1}
        runtime.setGlobalPaused(true);weak var weakValue=value;value=nil
        XCTAssertNil(weakValue);XCTAssertEqual(releases,1);XCTAssertEqual(completions,1);XCTAssertEqual(pool.activeCount,0);XCTAssertEqual(runtime.activeCount,0)
    }
    func testSourceGlobalPauseKeepsSameUnionAfterRawModalEndsWithoutAdvancingSmoke()throws{
        var wall=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random(),modal=RawModal();canvas.addChild(tile)
        var recipe=NativeSharedSmokeRecipe();recipe.maxParticles=6;recipe.ttl=1
        let value=try NativeSharedSmokeRootSpritePresentation(recipe:recipe,generation:1,sequence:1,sourceOwnerID:"paused",canvas:canvas,tile:tile,origin:.zero,renderScale:1,pool:pool,scheduler:NativeSharedSmokeClockRootScheduler(service:service),sourceClockNowMilliseconds:{service.sourceAnimationSeconds*1000},isCurrent:{_ in true},random:random.next,consumeHotFactor:{1},acquireActivity:{_ in nil})
        service.deliver(wallMilliseconds:100,rawFrameMilliseconds:0)
        let positions=value.layer.children.map(\.position)
        service.setSourceGlobalPaused(true)
        var rawDone=0
        let raw=try XCTUnwrap(service.register(participant:modal,duration:0.308,domain:.nativeRaw,cleanup:{_ in rawDone += 1}))
        service.deliver(wallMilliseconds:117,rawFrameMilliseconds:0)
        wall=425;service.deliver(wallMilliseconds:wall,rawFrameMilliseconds:308)
        XCTAssertFalse(raw.active);XCTAssertEqual(rawDone,1);XCTAssertTrue(service.hasActiveClock)
        XCTAssertEqual(service.displayLinkCreationCount,1);XCTAssertEqual(value.layer.children.map(\.position),positions)
        service.setSourceForeground(false);XCTAssertFalse(service.hasActiveClock)
        value.dispose();service.dispose();XCTAssertEqual(pool.activeCount,0)
    }
    func testAppSessionSharesPoolAndHotAcrossScenesWithoutCollidingGenerationOneScopes()throws{
        var wall=0.0;let random=Random()
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:1000,visualRandom:random.next);session.prewarm()
        let a=session.makeRenderer(service:service),b=session.makeRenderer(service:service)
        let canvasA=SKNode(),canvasB=SKNode(),tileA=SKNode(),tileB=SKNode();canvasA.addChild(tileA);canvasB.addChild(tileB)
        var recipe=NativeSharedSmokeRecipe();recipe.maxParticles=6;recipe.activityLeaseLabel="regular-merge6-smoke"
        var receipts:[NativeSharedFxReceipt]=[],releases=0
        let acquire:(NativeSharedFxReceipt)->(()->Void)?={receipts.append($0);return{releases += 1}}
        let first=try XCTUnwrap(a.admit(recipe:recipe,canvas:canvasA,tile:tileA,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:acquire))
        wall=30;let second=try XCTUnwrap(b.admit(recipe:recipe,canvas:canvasB,tile:tileB,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1030,reduced:false,current:{_ in true},acquireActivity:acquire))
        XCTAssertEqual(receipts.count,2);XCTAssertNotEqual(receipts[0].invocationID,receipts[1].invocationID)
        XCTAssertEqual(session.nextRegularSixPattern(),0);XCTAssertEqual(session.nextRegularSixPattern(),1);XCTAssertEqual(session.nextRegularSixPattern(),2);XCTAssertEqual(session.nextRegularSixPattern(),0)
        a.retire(generation:1);XCTAssertTrue(first.disposed);XCTAssertFalse(second.disposed);XCTAssertEqual(b.activeOwnerCount,1)
        b.dispose();service.dispose();XCTAssertEqual(releases,2);XCTAssertEqual(session.pool.activeCount,0)
        XCTAssertEqual(session.consumeHot(monotonicMilliseconds:1350,reduced:false),1)
    }
    func testClosedServiceStopsActualPoolOwnersAndShaderDeferredAdmissionConsumesNoRNG()throws{
        var wall=0.0;let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let random=Random(),canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:random.next),renderer=session.makeRenderer(service:service)
        var recipe=NativeSharedSmokeRecipe();recipe.maxParticles=6;recipe.activityLeaseLabel="special-merge6-smoke"
        var acquired=0,released=0
        let acquire:(NativeSharedFxReceipt)->(()->Void)?={_ in acquired += 1;return{released += 1}}
        recipe.deferFutureBursts=true
        XCTAssertNil(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:0,reduced:false,current:{_ in true},acquireActivity:acquire))
        recipe.deferFutureBursts=false;canvas.alpha=0.5
        XCTAssertNil(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:0,reduced:false,current:{_ in true},acquireActivity:acquire))
        XCTAssertEqual(random.draws,0);XCTAssertEqual(acquired,0);XCTAssertEqual(session.pool.activeCount,0)
        canvas.alpha=1;let value=try XCTUnwrap(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:acquire))
        wall=17;service.deliver(wallMilliseconds:wall);service.setSourceGlobalPaused(true);service.dispose()
        XCTAssertTrue(value.disposed);XCTAssertEqual(released,1);XCTAssertEqual(session.pool.activeCount,0);XCTAssertEqual(renderer.activeOwnerCount,0)
    }
    func testActualVectorCarrierRasterizesAuthoredSmokeAndRetiresAllFiniteRoots()throws{
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),scene=SKScene(size:CGSize(width:256,height:256)),canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random()
        scene.backgroundColor = .black;scene.addChild(canvas);canvas.position=CGPoint(x:128,y:128);canvas.addChild(tile)
        var recipe=NativeSharedSmokeRecipes.regularStack(tileDepth:43,reduced:false);recipe.maxParticles=6
        let value=try owner(recipe,canvas:canvas,tile:tile,pool:pool,runtime:runtime,random:random)
        runtime.deliver(wallMilliseconds:80)
        let view=SKView(frame:CGRect(x:0,y:0,width:256,height:256));view.presentScene(scene)
        let texture=try XCTUnwrap(view.texture(from:scene)),image=UIImage(cgImage:texture.cgImage())
        XCTAssertNotNil(image.pngData());XCTAssertGreaterThan(value.activeNodeCount,0)
        let attachment=XCTAttachment(image:image);attachment.name="Source immediate vector smoke native root projection";attachment.lifetime = .keepAlways;add(attachment)
        runtime.deliver(wallMilliseconds:470);runtime.deliver(wallMilliseconds:550);runtime.deliver(wallMilliseconds:616)
        XCTAssertTrue(value.disposed);XCTAssertEqual(pool.activeCount,0);XCTAssertEqual(runtime.activeCount,0)
        view.presentScene(nil)
    }
}
