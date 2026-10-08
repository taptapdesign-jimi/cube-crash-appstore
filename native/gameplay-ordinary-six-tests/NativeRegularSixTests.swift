import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeRegularSixTests:XCTestCase {
    private final class Random {
        var seed:UInt32,draws=0
        init(_ value:UInt32){seed=value}
        func next()->Double {draws += 1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296}
    }
    func testOriginalTsGeometryRandomConsumptionAndActualGsapAcross36RestedAndCapturedShakeScenarios() {
        for row in NativeRegularSixSourceOracle.records {
            let random=Random(row.seed)
            let shards=NativeRegularSixShardPlan(patternIndex:row.pattern,reduced:row.reduced,random:random.next)
            XCTAssertEqual(random.draws,row.shardDraws);XCTAssertEqual(shards.shards.count,row.shards.count)
            for(p,q)in zip(shards.shards,row.shards){XCTAssertEqual(p.rotation,q.rotation,accuracy:1e-10);XCTAssertEqual(p.points.count,q.points.count);for(a,b)in zip(p.points,q.points){XCTAssertEqual(a,b,accuracy:1e-10)}}
            let smoke=NativeRegularSixSmokePlan(tileSize:row.size,reduced:row.reduced,hotFactor:row.hot,random:random.next)
            XCTAssertEqual(random.draws-row.shardDraws,row.smokeDraws);XCTAssertEqual(smoke.puffs.count,row.puffs.count)
            for(p,q)in zip(smoke.puffs,row.puffs){for(a,b)in zip([p.radiusX,p.radiusY,p.rotation,p.scale,p.sx,p.sy],[q.radiusX,q.radiusY,q.rotation,q.scale,q.sx,q.sy]){XCTAssertEqual(a,b,accuracy:1e-10)}}
            let shake=NativeRegularSixShakePlan(multiplier:5,initialCanvas:.init(x:row.initialShake[0],y:row.initialShake[1]),initialIndicator:.init(x:row.initialShake[2],y:row.initialShake[3]),initialBottomDecor:.init(x:row.initialShake[4],y:row.initialShake[5]),random:random.next),multiplier=NativeRegularSixMultiplierMotion()
            XCTAssertEqual(random.draws,row.draws)
            for sample in row.samples {
                for(p,q)in zip(shards.shards,sample.shards){let s=p.sample(seconds:sample.seconds);for(a,b)in zip([s.x,s.y,s.alpha],q){XCTAssertEqual(a,b,accuracy:0.0001)}}
                for(p,q)in zip(smoke.puffs,sample.puffs){let s=p.sample(seconds:sample.seconds);for(a,b)in zip([s.x,s.y,s.alpha],q){XCTAssertEqual(a,b,accuracy:0.0001)}}
                XCTAssertEqual(smoke.haloAlpha(seconds:sample.seconds),sample.halo,accuracy:0.0001)
                let s=shake.sample(seconds:sample.seconds),indicator=shake.indicator(seconds:sample.seconds),decor=shake.bottomDecor(seconds:sample.seconds)
                for(a,b)in zip([s.x,s.y,indicator.x,indicator.y,decor.x,decor.y],sample.shake){XCTAssertEqual(a,b,accuracy:0.0001)}
                let m=multiplier.sample(seconds:sample.seconds)
                for(a,b)in zip([m.scale,m.alpha,m.rotation],sample.multiplier){XCTAssertEqual(a,b,accuracy:0.0001)}
            }
        }
    }
    func testOriginalContactHeroActualGsapAndSingleVisualRandomDraw() {
        for row in NativeRegularSixSourceOracle.heroes {
            let random=Random(row.seed),plan=NativeRegularSixHeroMotion(initialScale:row.initialScale,random:random.next)
            XCTAssertEqual(random.draws,row.draws)
            for sample in row.samples {XCTAssertEqual(plan.sample(seconds:sample[0]),sample[1],accuracy:0.000001);XCTAssertEqual(plan.sample(seconds:sample[0],startingScale:row.initialScaleY),sample[2],accuracy:0.000001)}
        }
    }
    func testAppLivedPatternAndSharedRapidSmokeCadencePreserveThermalEnvelope() {
        let cadence=NativeRegularSixFxCadence()
        XCTAssertEqual((0..<7).map{_ in cadence.nextPattern()},[0,1,2,0,1,2,0])
        XCTAssertEqual(cadence.hotFactor(nowMilliseconds:1000,reducedBoardFx:false),1)
        XCTAssertEqual(cadence.hotFactor(nowMilliseconds:1000,reducedBoardFx:false),0.55)
        XCTAssertEqual(cadence.hotFactor(nowMilliseconds:1160,reducedBoardFx:false),0.775)
        XCTAssertEqual(cadence.hotFactor(nowMilliseconds:1320,reducedBoardFx:true),0.775*0.58)
        XCTAssertEqual(cadence.hotFactor(nowMilliseconds:1640,reducedBoardFx:true),0.58)
    }
    func testNativeCarrierKeepsUncappedMultiplierAndRetiresStaleGenerationOnce() throws {
        var generation:UInt64=4,finished:[Bool]=[],receipts=0
        let owner=try NativeRegularSixSpritePresentation(origin:CGPoint(x:190,y:400),tileSize:70,destinationDepth:43,combinedDepth:12,generation:4,reduced:false,hotFactor:1,patternIndex:0,isCurrent:{$0==generation},random:{0.4})
        func renderedTexts(_ node:SKNode)->[String] {
            let own=node.name.flatMap{$0.hasPrefix("native-regular-six-multiplier:") ? String($0.dropFirst("native-regular-six-multiplier:".count)):nil}.map{[$0]} ?? []
            return own+node.children.flatMap{renderedTexts($0)}
        }
        XCTAssertEqual(renderedTexts(owner),["×12"])
        let sprite=try XCTUnwrap(owner.multiplierLayer.children.compactMap{$0 as? SKSpriteNode}.first)
        XCTAssertNotNil(sprite.texture)
        let rendered=try NativeRegularSixMultiplierGlyph.render(depth:12,displayScale:3)
        let attributes=rendered.caption.attributes(at:0,effectiveRange:nil)
        let font=try XCTUnwrap(attributes[.font] as? UIFont),stroke=try XCTUnwrap(attributes[.strokeWidth] as? NSNumber)
        let style=try XCTUnwrap(NativeRegularSixSourceOracle.records.first{$0.size==128}).multiplierStyle
        XCTAssertEqual(Double(font.pointSize),style[0]);XCTAssertEqual(stroke.doubleValue,-100*style[1]/style[0],accuracy:1e-10)
        XCTAssertEqual([Double(owner.shardLayer.zPosition),Double(owner.smokeLayer.zPosition),Double(owner.multiplierLayer.zPosition)],NativeRegularSixSourceOracle.records[0].depths)
        owner.onFinished={finished.append($0)};owner.onShake={_,_ in receipts += 1}
        owner.paint(seconds:0.017);XCTAssertEqual(receipts,1)
        generation=5;owner.paint(seconds:0.153);owner.paint(seconds:0.249);owner.dispose()
        XCTAssertEqual(receipts,1);XCTAssertEqual(finished,[false]);XCTAssertFalse(owner.hasActiveClock)
        XCTAssertEqual(owner.shards.shards.count,12);XCTAssertGreaterThan(owner.smoke.puffs.count,40)
    }
    func testNewShakeCapturesEverySurfaceAndRetiresOnlyPreviousShakeCallback() throws {
        let canvas=SKNode(),captured=NativeRegularSixSpritePresentation.ShakeReceipt(canvas:CGPoint(x:-1.3,y:2.8),indicator:CGPoint(x:-0.7,y:1.1),bottomDecor:CGPoint(x:-0.4,y:0.5))
        let owner=try NativeRegularSixSpritePresentation(origin:.zero,tileSize:64,destinationDepth:9,combinedDepth:5,generation:1,reduced:false,hotFactor:1,patternIndex:0,initialShake:captured,isCurrent:{_ in true},random:{0.4})
        var receipts:[NativeRegularSixSpritePresentation.ShakeReceipt]=[]
        owner.onShake={pose,_ in receipts.append(pose)};owner.mount(in:canvas)
        XCTAssertEqual(receipts[0].canvas,captured.canvas);XCTAssertEqual(receipts[0].indicator,captured.indicator);XCTAssertEqual(receipts[0].bottomDecor,captured.bottomDecor)
        owner.paint(seconds:0.153);let puff=owner.smokeLayer.children[1],previous=puff.position,count=receipts.count
        owner.detachShake();owner.paint(seconds:0.249)
        XCTAssertEqual(receipts.count,count);XCTAssertNotEqual(puff.position,previous);XCTAssertTrue(owner.parent===canvas);XCTAssertTrue(owner.hasActiveClock)
        owner.dispose();XCTAssertEqual(receipts.count,count);XCTAssertFalse(owner.hasActiveClock)
    }
    func testActualFiniteClockPausesDetachedAndDisposesWithoutLateShake() throws {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController()
        window.rootViewController=controller;window.makeKeyAndVisible()
        let spriteView=SKView(frame:window.bounds),scene=SKScene(size:window.bounds.size)
        spriteView.ignoresSiblingOrder=false;controller.view.addSubview(spriteView);spriteView.presentScene(scene)
        let owner=try NativeRegularSixSpritePresentation(origin:CGPoint(x:180,y:400),tileSize:64,destinationDepth:12,combinedDepth:4,generation:1,reduced:true,hotFactor:0.55,patternIndex:2,isCurrent:{_ in true},random:{0.5})
        var receipts=0,finished:[Bool]=[]
        owner.onShake={_,_ in receipts += 1};owner.onFinished={finished.append($0)};owner.mount(in:scene);owner.setSuspended(true)
        let pausedCount=receipts;RunLoop.main.run(until:Date().addingTimeInterval(0.08));XCTAssertEqual(receipts,pausedCount)
        owner.dispose();let disposedCount=receipts;owner.paint(seconds:0.2);owner.dispose()
        XCTAssertEqual(receipts,disposedCount);XCTAssertEqual(finished,[false]);XCTAssertFalse(owner.hasActiveClock);XCTAssertNil(owner.parent)
        spriteView.presentScene(nil);window.isHidden=true
    }
}
