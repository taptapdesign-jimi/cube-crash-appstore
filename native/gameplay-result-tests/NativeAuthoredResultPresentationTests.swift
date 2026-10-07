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
                for (p,e) in zip(plans,fixture.plans){compare([p.birth,p.lifetime,p.startX,p.startY,p.rise,p.direction,p.weave,p.cycles,p.size,p.scale,p.opacity,Double(p.asset)],e)}
                for e in fixture.samples {let p=plans[Int(e[0])].sample(seconds:e[1]);XCTAssertTrue(p.visible);compare([p.x,p.y,p.opacity,p.scale,p.rotation,p.skewX,p.imageScaleX,p.imageScaleY],Array(e.dropFirst(2)))}
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
        XCTAssertEqual(Set(NativeResultHeadlines.clean).count,114);XCTAssertEqual(NativeResultHeadlines.fail.count,98)
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
}
