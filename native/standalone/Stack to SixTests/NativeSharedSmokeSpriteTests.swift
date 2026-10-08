import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeSharedSmokeSpriteTests:XCTestCase {
    private struct Node:Decodable{let id:Int;let created,rx,ry,fill,rotation,scale,x,y,alpha:Double;let color:UInt32;let active:Bool}
    private struct Sample:Decodable{let seconds:Double;let draws:Int;let nodes:[Node]}
    private struct Row:Decodable{let name:String;let hot,depth:Double;let seed:UInt32;let recipe:NativeSharedSmokeRecipe;let samples:[Sample];let clockTimes:[Double]}
    private struct Packed:Decodable{let fill,groupAlpha:Double;let byte:Int}
    private struct Gold:Decodable{let rows:[Row];let packed:[Packed]}
    private final class Random {
        var seed:UInt32,draws=0
        init(_ seed:UInt32){self.seed=seed}
        func next()->Double{draws += 1;seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296}
    }
    private func gold()throws->Gold{
        let path=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"shared-smoke-sdk-oracle",withExtension:"json"))
        return try JSONDecoder().decode(Gold.self,from:Data(contentsOf:path))
    }
    func testSelectedCallerRecipeFactoriesMatchImmutableOriginalOptionsAndTwoCallerDraws()throws{
        for row in try gold().rows{
            let actual:NativeSharedSmokeRecipe
            switch row.name{
            case "stack":actual=NativeSharedSmokeRecipes.regularStack(tileDepth:43,reduced:false)
            case "stackReduced":actual=NativeSharedSmokeRecipes.regularStack(tileDepth:43,reduced:true)
            case "regular6":actual=NativeSharedSmokeRecipes.regularSix(tileDepth:43,reduced:false)
            case "regular6Reduced":actual=NativeSharedSmokeRecipes.regularSix(tileDepth:43,reduced:true)
            case "special","magnet":var count=0;actual=NativeSharedSmokeRecipes.specialMain(tileDepth:43,magnet:row.name=="magnet",random:{count += 1;return count==1 ? 0.44:(0.83-0.75)/0.3});XCTAssertEqual(count,2)
            case "laser":actual=NativeSharedSmokeRecipes.laserPrimary(tileDepth:43)
            case "tnt":actual=NativeSharedSmokeRecipes.targetImpact(tileDepth:43,profile:.ordinary)
            case "ball":actual=NativeSharedSmokeRecipes.targetImpact(tileDepth:43,profile:.beachBall)
            case "laserImpact":actual=NativeSharedSmokeRecipes.targetImpact(tileDepth:43,profile:.laserGun)
            case "wildLanding":actual=NativeSharedSmokeRecipes.wildMeterLanding(tileDepth:43)
            case "idle":actual=NativeSharedSmokeRecipes.regularIdle(tileDepth:43)
            case "altWild":actual=NativeSharedSmokeRecipes.alternateWild(tileDepth:43)
            default:XCTFail(row.name);continue
            }
            var expected=row.recipe;expected.fxTag=actual.fxTag // Oracle adds a synthetic cancellation tag only for untagged calls.
            let encoder=JSONEncoder(),a=try JSONSerialization.jsonObject(with:encoder.encode(actual)) as! [String:Any],b=try JSONSerialization.jsonObject(with:encoder.encode(expected)) as! [String:Any]
            XCTAssertEqual(Set(a.keys),Set(b.keys),row.name)
            for key in a.keys{if let x=a[key] as? NSNumber,let y=b[key] as? NSNumber{XCTAssertEqual(x.doubleValue,y.doubleValue,accuracy:1e-12,row.name+"/"+key)}else{XCTAssertEqual(a[key] as? NSObject,b[key] as? NSObject,row.name+"/"+key)}}
        }
    }
    func testActualSourceGeometryOpaquePaintAndLazyDrawsAcrossThirteenAuthoredProfiles()throws{
        let fixture=try gold();XCTAssertEqual(fixture.rows.count,13)
        // SpriteKit stores zPosition as Float32. Original source depth remains
        // a strict Double oracle; compare the backend's independently derived
        // IEEE754 representation exactly, then prove behind ordering survives.
        // /tmp/native-shared-smoke-draft/sprite-depth-float32-proof.json captures
        // Python struct.pack/unpack independently for ordinary and Wild depths.
        for sourceTileDepth in [0.0,1,43,12001]{let node=SKNode(),tile=SKNode();node.zPosition=sourceTileDepth-0.001;tile.zPosition=sourceTileDepth;XCTAssertEqual(node.zPosition,CGFloat(Float(sourceTileDepth-0.001)));XCTAssertLessThan(node.zPosition,tile.zPosition)}
        for row in fixture.rows{
            let canvas=SKNode(),tile=SKNode(),pool=NativeSharedSmokeSpritePool(),random=Random(row.seed)
            tile.zPosition=row.recipe.tileDepth
            canvas.addChild(tile)
            let owner=try NativeSharedSmokeSpritePresentation(recipe:row.recipe,hotFactor:row.hot,generation:3,sequence:1,gsapNowMs:0,origin:CGPoint(x:17,y:23),renderScale:0.5,pool:pool,isCurrent:{$0==3},random:random.next,acquireActivity:{_ in {}})
            try owner.mount(in:canvas,before:tile)
            XCTAssertEqual(owner.runtime.depth,row.depth,accuracy:1e-12)
            XCTAssertEqual(owner.layer.zPosition,CGFloat(Float(row.depth)))
            if row.recipe.behind{XCTAssertLessThan(owner.layer.zPosition,tile.zPosition);XCTAssertLessThan(try XCTUnwrap(canvas.children.firstIndex(where:{$0===owner.layer})),try XCTUnwrap(canvas.children.firstIndex(where:{$0===tile})))}
            let haloID=row.recipe.deferFutureBursts ? owner.runtime.perBurst : owner.runtime.perBurst*owner.runtime.burstCount
            for seconds in row.clockTimes{
                owner.advance(gsapNowMs:seconds*1000);owner.paint(gsapNowMs:seconds*1000)
                guard let sample=row.samples.first(where:{$0.seconds==seconds}) else{continue}
                XCTAssertEqual(random.draws,sample.draws,row.name)
                let sourcePuffs=sample.nodes.filter{$0.id != haloID}
                for(index,source)in sourcePuffs.enumerated(){
                    guard source.active else{XCTAssertNil(owner.puffNodes[index]);continue}
                    let node=try XCTUnwrap(owner.puffNodes[index],row.name),path=try XCTUnwrap(node.path)
                    XCTAssertEqual(path.boundingBoxOfPath.width,source.rx*2,accuracy:1e-8)
                    XCTAssertEqual(path.boundingBoxOfPath.height,source.ry*2,accuracy:1e-8)
                    XCTAssertEqual(node.position.x,source.x,accuracy:0.00002)
                    XCTAssertEqual(node.position.y,-source.y,accuracy:0.00002)
                    XCTAssertEqual(node.zRotation,-source.rotation,accuracy:0.000001)
                    XCTAssertEqual(node.xScale,source.scale,accuracy:0.000001)
                    let packed=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(source.alpha*source.fill)
                    XCTAssertEqual(node.alpha,packed,accuracy:0.0000001)
                    XCTAssertEqual(node.blendMode,row.recipe.blendMode=="add" ? .add:.alpha)
                    XCTAssertFalse(node.hasActions())
                }
                XCTAssertFalse(owner.hasInstalledClock)
            }
            owner.dispose();XCTAssertEqual(pool.activeCount,0);XCTAssertLessThanOrEqual(pool.poolSize,150)
        }
    }
    func testOpaqueVectorAlphaUsesActualOriginalPixiPackAttributesIncludingWrap()throws{
        for row in try gold().packed{
            XCTAssertEqual(NativeSharedSmokeSpritePresentation.sourcePackedAlpha(row.fill*row.groupAlpha),CGFloat(row.byte)/255,accuracy:1e-12)
        }
        // Parent fades need a subsequent shader bridge, not double multiplication.
        let canvas=SKNode();canvas.alpha=0.5;var recipe=NativeSharedSmokeRecipe();recipe.activityLeaseLabel="regular-merge6-smoke"
        let owner=try NativeSharedSmokeSpritePresentation(recipe:recipe,hotFactor:1,generation:1,sequence:1,gsapNowMs:0,origin:.zero,renderScale:1,pool:NativeSharedSmokeSpritePool(),isCurrent:{_ in true},random:{0.4},acquireActivity:{_ in {}})
        XCTAssertThrowsError(try owner.mount(in:canvas));XCTAssertTrue(owner.disposed)
    }
    func testActualSpriteVectorPoolRetains150AndRejectsObsoleteSameNodeLease(){
        let pool=NativeSharedSmokeSpritePool();XCTAssertEqual(pool.prewarm(to:76),76);XCTAssertEqual(pool.retainedNodeCount,76)
        let old=pool.acquire();old.node.path=CGPath(ellipseIn:CGRect(x:-9,y:-7,width:18,height:14),transform:nil);old.node.blendMode = .add
        old.node.position=CGPoint(x:41,y:32);old.node.setScale(3);old.node.zRotation=2;old.node.alpha=0.2
        pool.release(old);let replacement=pool.acquire()
        XCTAssertTrue(old.node===replacement.node);XCTAssertNotEqual(old.sequence,replacement.sequence)
        XCTAssertNil(replacement.node.path);XCTAssertEqual(replacement.node.position,.zero);XCTAssertEqual(replacement.node.xScale,1);XCTAssertEqual(replacement.node.zRotation,0);XCTAssertEqual(replacement.node.alpha,1)
        XCTAssertEqual(replacement.node.blendMode,.add)
        pool.release(old);XCTAssertTrue(pool.isCurrent(replacement));XCTAssertEqual(pool.activeCount,1)
        let many=(0..<160).map{_ in pool.acquire()};many.forEach(pool.release);pool.release(replacement)
        XCTAssertEqual(pool.poolSize,150);XCTAssertEqual(pool.retainedNodeCount,150);XCTAssertEqual(pool.activeCount,0)
        XCTAssertEqual(pool.prewarm(to:200),150)
    }
    func testConnectedSourceScopesRetireOnceWithWallVsGSAPPauseAndGenerationChange()throws{
        let frame=NativeSourceFrameRuntime();frame.attach(rendererID:1,nowMs:0,configuredFPS:60)
        var generation:UInt64=4,released=0
        let acquire:(NativeSharedFxReceipt)->(()->Void)?={receipt in
            guard let kind=NativeSourceFrameRuntime.Kind(rawValue:receipt.label) else{return nil}
            let captured=frame.begin(.init(kind:kind,generation:receipt.generation,id:receipt.invocationID))
            return{released += 1;frame.end(captured)}
        }
        let shards=NativeSharedShardCleanup(generation:4,sequence:1,label:"regular-merge6-shards",wallNowMs:0,ttlSeconds:1,acquire:{acquire($0)!})
        var recipe=NativeSharedSmokeRecipe();recipe.activityLeaseLabel="regular-merge6-smoke"
        let canvas=SKNode(),pool=NativeSharedSmokeSpritePool()
        let owner=try NativeSharedSmokeSpritePresentation(recipe:recipe,hotFactor:1,generation:4,sequence:2,gsapNowMs:0,origin:.zero,renderScale:1,pool:pool,isCurrent:{$0==generation},random:{0.42},acquireActivity:acquire)
        try owner.mount(in:canvas)
        owner.advance(gsapNowMs:250);owner.paint(gsapNowMs:250)
        frame.receiveCallbackTime(1000);shards.advance(wallNowMs:1000)
        XCTAssertEqual(released,1);XCTAssertFalse(owner.disposed);XCTAssertTrue(owner.layer.parent===canvas)
        generation=5;frame.receiveCallbackTime(1020);owner.advance(gsapNowMs:250)
        XCTAssertEqual(released,2);XCTAssertEqual(pool.activeCount,0);XCTAssertNil(owner.layer.parent)
        owner.dispose();shards.retire();XCTAssertEqual(released,2)
    }
    func testRendererBailoutPaintAndRepeatedTagCleanupConsumeNoExtraRNGOrUnlabeledActivity()throws{
        let pool=NativeSharedSmokeSpritePool(),renderer=NativeSharedSmokeSpriteRenderer(pool:pool),canvas=SKNode(),tile=SKNode()
        canvas.addChild(tile);var hotCalls=0,activity=0;let random=Random(127)
        var recipe=NativeSharedSmokeRecipe();recipe.fxTag="stack-smoke"
        func admit(_ board:SKNode?)->NativeSharedSmokeSpritePresentation?{
            renderer.admit(recipe:recipe,board:board,tile:tile,generation:1,gsapNowMs:0,sourceElapsedMs:1000,origin:.zero,renderScale:1,reducedBoardFx:false,isCurrent:{_ in true},random:random.next,consumeHotFactor:{_,_ in hotCalls += 1;return 1},acquireActivity:{_ in activity += 1;return{}})
        }
        XCTAssertNil(admit(nil));XCTAssertEqual(random.draws,0);XCTAssertEqual(hotCalls,0)
        let owner=try XCTUnwrap(admit(canvas));let draws=random.draws
        renderer.paint(gsapNowMs:17);renderer.paint(gsapNowMs:17);XCTAssertEqual(random.draws,draws);XCTAssertEqual(activity,0);XCTAssertEqual(hotCalls,1)
        renderer.cleanup(tag:"stack-smoke");renderer.cleanup(tag:"stack-smoke");XCTAssertTrue(owner.disposed);XCTAssertEqual(pool.activeCount,0);XCTAssertEqual(renderer.activeOwnerCount,0)
    }
    func testActualSKViewVectorSnapshotAndDisposeInstallNoClock()throws{
        let window=UIWindow(frame:CGRect(x:0,y:0,width:240,height:240)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        let view=SKView(frame:window.bounds);view.ignoresSiblingOrder=false;host.view.addSubview(view)
        let scene=SKScene(size:window.bounds.size);scene.backgroundColor = .clear
        let canvas=SKNode();scene.addChild(canvas);view.presentScene(scene)
        var recipe=NativeSharedSmokeRecipe();recipe.blendMode="normal";recipe.cloudAlphaProfile=true
        let owner=try NativeSharedSmokeSpritePresentation(recipe:recipe,hotFactor:1,generation:1,sequence:1,gsapNowMs:0,origin:CGPoint(x:120,y:120),renderScale:1,pool:NativeSharedSmokeSpritePool(),isCurrent:{_ in true},random:Random(127).next,acquireActivity:{_ in nil})
        try owner.mount(in:canvas);owner.advance(gsapNowMs:105);owner.paint(gsapNowMs:105)
        let texture=try XCTUnwrap(view.texture(from:canvas,crop:window.bounds));let image=texture.cgImage()
        XCTAssertGreaterThan(image.width,0);XCTAssertGreaterThan(image.height,0)
        let data=try XCTUnwrap(image.dataProvider?.data),bytes=CFDataGetBytePtr(data)!
        XCTAssertTrue((0..<CFDataGetLength(data)).contains{bytes[$0] != 0})
        XCTAssertFalse(owner.layer.hasActions());XCTAssertTrue(owner.layer.children.allSatisfy{!$0.hasActions()})
        let attachment=XCTAttachment(image:UIImage(cgImage:image));attachment.name="private-authored-vector-smoke-105ms";attachment.lifetime = .keepAlways;add(attachment)
        owner.dispose();XCTAssertNil(owner.layer.parent);view.presentScene(nil);window.isHidden=true
    }
}
