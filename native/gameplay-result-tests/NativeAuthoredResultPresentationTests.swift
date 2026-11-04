import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeAuthoredResultPresentationTests:XCTestCase {
    private final class Random {
        var state:UInt32,draws=0
        init(_ seed:UInt32){state=seed}
        func next()->Double {draws += 1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296}
    }
    private func compare(_ actual:[Double],_ expected:[Double],file:StaticString=#filePath,line:UInt=#line) {
        XCTAssertEqual(actual.count,expected.count,file:file,line:line)
        for (a,b) in zip(actual,expected){XCTAssertEqual(a,b,accuracy:0.0000001,file:file,line:line)}
    }
    func testAllThemesMatchIndependentExecutedSourcePlansRandomConsumptionAnd4584Poses() {
        for fixture in NativeResultConfettiOracle.records {
            let rng=Random(fixture.seed)
            if fixture.kind=="area55" {
                let plans=NativeResultConfettiPlan.area(width:fixture.width,height:fixture.height,random:rng.next)
                XCTAssertEqual(plans.count,300)
                for (p,e) in zip(plans,fixture.plans){compare([p.birth,p.startX,p.startY,p.endX,p.endY,p.width,p.height,p.radius,p.rotation,Double(p.color)],e)}
                for e in fixture.samples {let p=plans[Int(e[0])].sample(seconds:e[1]);XCTAssertTrue(p.visible);compare([p.x,p.y,p.opacity,p.scale,p.rotation,p.skewX,p.imageScaleX,p.imageScaleY],Array(e.dropFirst(2)))}
            } else if fixture.kind=="forest" {
                let plans=NativeResultConfettiPlan.forest(width:fixture.width,height:fixture.height,random:rng.next)
                XCTAssertEqual(plans.count,42)
                for (p,e) in zip(plans,fixture.plans){let m=p.motion;compare([m.birth,m.lifetime,m.birthX,m.birthY,m.velocityX,m.velocityY,m.gravity,m.flutter,m.spin,m.scale,m.peakOpacity,p.width,p.height,Double(p.asset)],e)}
                for e in fixture.samples {let p=plans[Int(e[0])].motion.sample(seconds:e[1]);XCTAssertTrue(p.visible);compare([p.x,p.y,p.opacity,p.scale,p.rotation,p.skewX,p.imageScaleX,p.imageScaleY],Array(e.dropFirst(2)))}
                XCTAssertEqual(plans.map {$0.motion.birth+$0.motion.lifetime}.max()!,9.8,accuracy:0.0000001)
            } else {
                let plans=NativeResultConfettiPlan.beach(width:fixture.width,height:fixture.height,random:rng.next)
                XCTAssertEqual(plans.count,40)
                // User-approved opacity replacement; keep the independent
                // source oracle for every travel/scale and RNG component.
                let levels=[0.2,0.3,0.4,0.5,0.6]
                func beachOpacity(_ original:Double)->Double {
                    levels[min(4,max(0,Int(((original/0.8-0.2)/0.5)*5)))]
                }
                for (p,e) in zip(plans,fixture.plans){var expected=e;expected[10]=beachOpacity(e[10]);compare([p.birth,p.lifetime,p.startX,p.startY,p.rise,p.direction,p.weave,p.cycles,p.size,p.scale,p.opacity,Double(p.asset)],expected)}
                for e in fixture.samples {let index=Int(e[0]),p=plans[index].sample(seconds:e[1]);XCTAssertTrue(p.visible);var expected=Array(e.dropFirst(2));expected[2] *= beachOpacity(fixture.plans[index][10])/fixture.plans[index][10];compare([p.x,p.y,p.opacity,p.scale,p.rotation,p.skewX,p.imageScaleX,p.imageScaleY],expected)}
                for level in levels {XCTAssertEqual(plans.filter{abs($0.opacity-level)<0.000001}.count,8)}
                XCTAssertEqual(plans.last!.birth+plans.last!.lifetime,9.8,accuracy:0.0000001)
            }
            XCTAssertEqual(rng.draws,fixture.draws,"\(fixture.kind) original RNG consumption")
        }
    }
    func testResultLayoutPreservesOriginalNestedSpacingsAndCta64PixelCarrier() {
        let clean=NativeResultPresentationPlan.layout(viewport:CGSize(width:390,height:844),clean:true,titleHeight:40)
        XCTAssertEqual(clean.starSize,78);XCTAssertEqual(clean.title.minY-clean.hero.maxY,48)
        XCTAssertEqual(clean.scoreLabel.minY-clean.title.maxY,16);XCTAssertEqual(clean.score.minY-clean.scoreLabel.maxY,16)
        XCTAssertEqual(clean.status.minY-clean.score.maxY,8);XCTAssertEqual(clean.status.height,52)
        XCTAssertEqual(clean.primary.height,64);XCTAssertEqual(clean.secondary.minY-clean.primary.maxY,16)
        XCTAssertEqual(clean.primary.minY-clean.card.maxY,18)
        XCTAssertEqual(clean.star(1).minY,clean.hero.minY-16)
        let fail=NativeResultPresentationPlan.layout(viewport:CGSize(width:430,height:932),clean:false,titleHeight:112)
        XCTAssertEqual(fail.title.minY-fail.hero.maxY,64);XCTAssertEqual(fail.status.minY-fail.title.maxY,12)
        XCTAssertEqual(fail.title.height,112);XCTAssertEqual(fail.primary.height,64)
    }
    func testSourceCountersBonusHandoffsAndCompletedPoses() {
        XCTAssertEqual(NativeResultPresentationPlan.counterDuration(from:0,to:100),0.8)
        XCTAssertEqual(NativeResultPresentationPlan.counterDuration(from:0,to:500),1)
        XCTAssertEqual(NativeResultPresentationPlan.counterDuration(from:0,to:1200),1.5)
        XCTAssertEqual(NativeResultPresentationPlan.counter(from:0,to:1000,age:0.75),875)
        let initial=NativeResultPresentationPlan.sample(seconds:0,clean:true,baseScore:1000,combo:225,efficiency:500)
        XCTAssertEqual(initial.hero.scale,0);XCTAssertEqual(initial.displayedScore,0);XCTAssertEqual(initial.primary.y,18)
        let complete=NativeResultPresentationPlan.sample(seconds:8,clean:true,baseScore:1000,combo:225,efficiency:500)
        XCTAssertEqual(complete.displayedScore,1725);XCTAssertEqual(complete.combo.opacity,0);XCTAssertEqual(complete.efficiency.opacity,0)
        XCTAssertEqual(complete.status.opacity,1);XCTAssertEqual(complete.displayedCombo,0);XCTAssertEqual(complete.primary.scale,1)
        let failed=NativeResultPresentationPlan.sample(seconds:0,clean:false,baseScore:10,combo:0,efficiency:0)
        XCTAssertEqual(failed.hero.scale,0.7);XCTAssertEqual(failed.title.scale,0.75);XCTAssertEqual(failed.status.scale,0.82)
        XCTAssertEqual(Set(NativeResultHeadlines.clean).count,110);XCTAssertEqual(NativeResultHeadlines.fail.count,94)
    }
    func testAuthoredExitKeepsStarsUncompoundedAndClickedCtaFirst() {
        let first=NativeResultExitPlan.cleanStar(seconds:0.02,index:2,earned:3,capturedScale:1.1)
        let last=NativeResultExitPlan.cleanStar(seconds:0.02,index:0,earned:3,capturedScale:0.9)
        XCTAssertGreaterThan(first.scale,1.1);XCTAssertEqual(last.scale,0.9)
        XCTAssertEqual(NativeResultExitPlan.cleanStar(seconds:0.64,index:0,earned:3,capturedScale:1.2).opacity,0)
        let clean=NativeResultExitPlan.clean(seconds:0.3,earned:3,path:.journeyReturn,clickedPrimary:false)
        XCTAssertEqual(clean.hero.scale,1);XCTAssertEqual(clean.card.scale,1)
        XCTAssertNotEqual(clean.primary.scale,clean.secondary.scale)
        XCTAssertEqual(clean.completionSeconds,1,accuracy:0.000001)
        let done=NativeResultExitPlan.clean(seconds:1,earned:3,path:.journeyReturn,clickedPrimary:false)
        XCTAssertEqual(done.paperOpacity,0);XCTAssertEqual(done.card.opacity,0)
        let fail=NativeResultExitPlan.failed(seconds:1,clickedPrimary:true)
        XCTAssertEqual(fail.paperOpacity,0);XCTAssertEqual(fail.card.opacity,0);XCTAssertEqual(fail.hero.scale,0)
        XCTAssertEqual(fail.completionSeconds,1)
    }
    private final class Resources:NativeResultConfettiResources {
        var completion:((Bool)->Void)?,releases=0,prepared:[String]=[]
        func image(_ path:String,owner:Int)->UIImage?{UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{_ in UIColor.white.setFill();UIBezierPath(rect:CGRect(x:0,y:0,width:2,height:2)).fill()}}
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){prepared=paths;self.completion=completion}
        func release(_ owner:Int){releases += 1}
    }
    func testCanvasFiniteBoundaryAndStaleBackgroundDisposeCannotRestorePreparedResources() {
        let resources=Resources(),owner=NativeResultConfettiCanvas(root:URL(fileURLWithPath:"/unused"),theme:.beach,viewport:CGSize(width:390,height:844),generation:9,resources:resources,random:{0.5})
        XCTAssertEqual(owner.plannedParticleCount,40);XCTAssertEqual(resources.prepared.count,6)
        resources.completion?(true);XCTAssertTrue(owner.assetsReady)
        var completed=0;owner.onFinished={completed += 1}
        let initialActive=owner.activeParticleCount;owner.paint(seconds:1,generation:8);XCTAssertEqual(owner.activeParticleCount,initialActive)
        owner.setForeground(false);owner.paint(seconds:10,generation:9);XCTAssertEqual(completed,0)
        owner.setForeground(true);owner.paint(seconds:9.79,generation:9);XCTAssertEqual(completed,0)
        owner.paint(seconds:9.8,generation:9);XCTAssertEqual(completed,1);XCTAssertEqual(owner.plannedParticleCount,0);XCTAssertEqual(resources.releases,1)
        resources.completion?(true);owner.paint(seconds:12,generation:9);owner.dispose();owner.dispose()
        XCTAssertEqual(completed,1);XCTAssertEqual(resources.releases,1)
        let stale=Resources(),disposed=NativeResultConfettiCanvas(root:URL(fileURLWithPath:"/unused"),theme:.forest,viewport:CGSize(width:390,height:844),generation:10,resources:stale,random:{0.5})
        disposed.dispose();stale.completion?(true);XCTAssertFalse(disposed.assetsReady);XCTAssertEqual(disposed.plannedParticleCount,0);XCTAssertEqual(stale.releases,1)
    }
    func testArcadeCoinsBorrowHUDSizeAndFanButDecelerateAtTop() {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let rng=Random(19),coins=NativeResultConfettiPlan.arcade(width:size.width,height:size.height,random:rng.next)
            XCTAssertEqual(coins.count,24)
            XCTAssertEqual(Set(coins.map(\.asset)),Set(0..<6))
            for index in 1..<coins.count {XCTAssertEqual(coins[index].birth-coins[index-1].birth,1.0/3.6,accuracy:0.000001)}
            for coin in coins {
                let scale=NativeSourceHUDStarPlan.coinEnlargement(for:size)/1.20
                XCTAssertGreaterThanOrEqual(coin.size,48*scale)
                XCTAssertLessThanOrEqual(coin.size,115.2*scale)
                XCTAssertLessThanOrEqual(coin.birth+coin.lifetime,NativeResultConfettiPlan.maximumRuntime)
                let start=coin.sample(seconds:coin.birth),end=coin.sample(seconds:coin.birth+coin.lifetime)
                XCTAssertGreaterThan(start.y,Double(size.height));XCTAssertLessThan(end.y,0)
                var previous=start.y
                for sample in 1..<100 {
                    let pose=coin.sample(seconds:coin.birth+coin.lifetime*Double(sample)/100)
                    XCTAssertLessThan(pose.y,previous);previous=pose.y
                    if pose.y<=0 {XCTAssertEqual(pose.scale,0.5)}
                }
                let y80=coin.sample(seconds:coin.birth+coin.lifetime*0.80).y
                let y85=coin.sample(seconds:coin.birth+coin.lifetime*0.85).y
                let y90=coin.sample(seconds:coin.birth+coin.lifetime*0.90).y
                let y95=coin.sample(seconds:coin.birth+coin.lifetime*0.95).y
                XCTAssertGreaterThan(y80-y85,y90-y95,"No final trophy acceleration")
                XCTAssertFalse(end.visible)
                XCTAssertEqual(start.scale,1);XCTAssertEqual(end.scale,0.5)
                XCTAssertGreaterThan(coin.sample(seconds:coin.birth+coin.lifetime/2).scale,0.5)
                XCTAssertLessThan(coin.sample(seconds:coin.birth+coin.lifetime/2).scale,1)
                XCTAssertLessThan(end.y+coin.size*0.72,0)
                XCTAssertEqual(coin.sample(seconds:coin.birth+coin.lifetime*0.99).opacity,1)
            }
            XCTAssertLessThanOrEqual(coins.map(\.size).max()!/coins.map(\.size).min()!,2.4)
        }
    }
    func testArcadeCanvasSharesClockAndRetiresLayersResourcesAndLatePreparation() {
        let resources=Resources(),host=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        var canvas:NativeResultConfettiCanvas?=NativeResultConfettiCanvas(root:URL(fileURLWithPath:"/unused"),
            theme:.arcade,viewport:host.bounds.size,generation:7,resources:resources,reducedMotion:false,random:{0.5})
        weak var released=canvas
        host.addSubview(canvas!)
        resources.completion?(true)
        XCTAssertEqual(resources.prepared.count,6);XCTAssertEqual(canvas!.arcadeCoinLayerCount,24);XCTAssertEqual(canvas!.arcadeRearCoinLayerCount,10)
        canvas!.paint(seconds:1,generation:7);let active=canvas!.activeParticleCount
        canvas!.setForeground(false);canvas!.paint(seconds:9.8,generation:7)
        XCTAssertEqual(canvas!.activeParticleCount,active);XCTAssertEqual(resources.releases,0)
        canvas!.setForeground(true);canvas!.paint(seconds:9.8,generation:8)
        XCTAssertEqual(resources.releases,0)
        canvas!.paint(seconds:9.8,generation:7)
        XCTAssertEqual(resources.releases,1);XCTAssertEqual(canvas!.arcadeCoinLayerCount,0);XCTAssertEqual(canvas!.arcadeRearCoinLayerCount,0)
        XCTAssertEqual(host.subviews.count,1)
        resources.completion?(true);canvas!.dispose();canvas!.dispose()
        XCTAssertEqual(resources.releases,1);canvas!.removeFromSuperview();canvas=nil;XCTAssertNil(released)
        let reduced=Resources(),quiet=NativeResultConfettiCanvas(root:URL(fileURLWithPath:"/unused"),
            theme:.arcade,viewport:host.bounds.size,generation:8,resources:reduced,reducedMotion:true,random:{0.5})
        reduced.completion?(true);XCTAssertEqual(reduced.prepared.count,0)
        XCTAssertEqual(quiet.arcadeCoinLayerCount,0)
        quiet.dispose();reduced.completion?(true);XCTAssertEqual(quiet.arcadeCoinLayerCount,0)
        XCTAssertEqual(reduced.releases,1)
    }

    func testArcadeCoinFieldHasBoundedMassWeightedCollisionsAndSharedTime() {
        typealias Coin=NativeResultConfettiPlan.Coin
        let small=Coin(birth:0,lifetime:3,size:20,spin:0,phase:0,
            points:[CGPoint(x:100,y:500),CGPoint(x:180,y:-80)],viewportHeight:500,asset:0)
        let large=Coin(birth:0,lifetime:3,size:60,spin:0,phase:0,
            points:[CGPoint(x:180,y:500),CGPoint(x:100,y:-80)],viewportHeight:500,asset:1)
        var field=NativeResultConfettiPlan.CoinField(coins:[small,large])
        for frame in 0...90 {field.advance(to:Double(frame)/60)}
        XCTAssertGreaterThan(field.collisionCount,0)
        let a=field.pose(0),b=field.pose(1)
        XCTAssertGreaterThan(abs(a.x-small.sample(seconds:field.elapsed).x),abs(b.x-large.sample(seconds:field.elapsed).x))
        XCTAssertNotEqual(a.rotation,0)
        for pose in [a,b] {XCTAssertTrue(pose.x.isFinite && pose.y.isFinite && pose.rotation.isFinite)}
        let held=field.elapsed;field.advance(to:held-1);XCTAssertEqual(field.elapsed,held)
        field.advance(to:100);XCTAssertEqual(field.elapsed,NativeResultConfettiPlan.maximumRuntime,accuracy:0.000001)
        XCTAssertFalse(field.pose(0).visible)
        XCTAssertFalse(NativeResultConfettiCanvas.assets(.arcade).contains{$0.contains("board transition")})
    }

    func testArcadeBirthAndExitUseFullWidthInsteadOfCentralEmitter() {
        for roll in [0.0,1.0] {
            let coins=NativeResultConfettiPlan.arcade(width:390,height:844,random:{roll})
            for coin in coins {
                if roll==0 {XCTAssertLessThanOrEqual(coin.points.first!.x,coin.size/2+5.001)}
                else {XCTAssertGreaterThanOrEqual(coin.points.first!.x,390-coin.size/2-5.001)}
                XCTAssertEqual(coin.points.last!.x,coin.size/2+roll*(390-coin.size),accuracy:0.000001)
            }
        }
    }

}
