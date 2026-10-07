import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeCuberoPresentationTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    func testCapturedClothPlansAndWavesMatchExecutedOriginalGSAP() throws {
        var rng:UInt32=17,draws=0
        let plans=NativeCuberoFinaleMotion.make(viewport:CGSize(width:390,height:844),random:{draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296})
        XCTAssertEqual(draws,596);XCTAssertEqual(plans.count,14)
        let plan=try XCTUnwrap(plans.first),b=plan.burst,w=plan.wave
        XCTAssertEqual(b.birth,CGPoint(x:289,y:391));XCTAssertEqual(b.size,58)
        XCTAssertEqual(b.delay,0.015567724546417595,accuracy:1e-12)
        XCTAssertEqual(b.launch,0.11082306739187334,accuracy:1e-12)
        XCTAssertEqual(b.travel,1.476821682379581,accuracy:1e-12)
        XCTAssertEqual(w.repeats,4);XCTAssertEqual(w.duration,0.26564723702240733,accuracy:1e-12)
        let gold:[(Double,[Double],[Double])]=[
            (0.1,[10.348952,-2.581716,0.834269,0.599098,138.474289],[0,1,1,0,0]),
            (0.5,[79.459722,-36.891213,1.012046,0.786357,139.442591],[0.71634,0.994432,1.004541,-0.236633,0.154849]),
            (1,[393.27971,-97.855431,1.001498,0.502977,138.200344],[0.735994,0.994279,1.004666,-0.243125,0.159098]),
            (1.5,[614.240841,-178.644511,0.758558,0.013772,144.834768],[7.893537,0.938639,1.050038,-2.607518,1.706323])]
        for (time,expectedBurst,expectedWave) in gold {
            let p=b.sample(seconds:time),v=w.sample(seconds:time)
            let actualBurst=[Double(p.point.x-b.birth.x),Double(p.point.y-b.birth.y),Double(p.scale),Double(p.alpha),Double(p.rotation)]
            let actualWave=[Double(v.skew),Double(v.scaleX),Double(v.scaleY),Double(v.rotation),Double(v.x)]
            for index in actualBurst.indices {XCTAssertEqual(actualBurst[index],expectedBurst[index],accuracy:0.001);XCTAssertEqual(actualWave[index],expectedWave[index],accuracy:0.001)}
        }
        XCTAssertEqual(max(1.2,(plans.map(\.end).max() ?? 0)+0.45),3.17623220735736,accuracy:1e-12)
        XCTAssertEqual(b.sample(seconds:b.end).alpha,0)
    }
    func testIdleHopPreservesFiveSourceSegmentsAndRepeatBoundary() {
        let gold:[(Double,CGFloat,CGFloat,CGFloat)]=[(0,0,0,0),(0.14,-1,-0.5,-0.0225),(0.28,-2,-1,-0.045),(0.32,-1.125,-0.125,-0.031875),(0.50,0.5,-0.5,0.0075),(0.64,2,-1,0.045),(0.68,1.125,-0.125,0.031875),(0.72,1,0,0.03),(0.8,1-sin(.pi/4),0,0.03*(1-sin(.pi/4))),(0.88,0,0,0)]
        for (time,x,y,rotation) in gold {
            let p=NativeCuberoIdleMotion.sample(seconds:time)
            XCTAssertEqual(p.x,x,accuracy:0.000001);XCTAssertEqual(p.y,y,accuracy:0.000001);XCTAssertEqual(p.rotation,rotation,accuracy:0.000001)
        }
        XCTAssertEqual(NativeCuberoIdleMotion.duration,1)
        for time in [0.90,0.96,1.0,7.94] {let p=NativeCuberoIdleMotion.sample(seconds:time);XCTAssertEqual(p.x,0,accuracy:0.000001);XCTAssertEqual(p.y,0,accuracy:0.000001);XCTAssertEqual(p.rotation,0,accuracy:0.000001)}
        let next=NativeCuberoIdleMotion.sample(seconds:12.14)
        XCTAssertEqual(next.x,-1,accuracy:0.000001)
    }
    func testOriginalClothsHaveIndependentFlagPivotsAndFiniteCleanup() throws {
        let owner=NativeCuberoFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{0.5})
        XCTAssertTrue(owner.assetReady)
        let cloths=owner.subviews.filter {$0.layer.zPosition==2}
        XCTAssertEqual(cloths.count,14)
        XCTAssertTrue(cloths.allSatisfy {$0.subviews.count==1 && ($0.subviews.first as? UIImageView)?.image != nil})
        XCTAssertTrue(cloths.allSatisfy {$0.subviews.first?.layer.anchorPoint==CGPoint(x:0.22,y:0.5)})
        var finished=0,haptics=0
        owner.onFinished={_ in finished+=1};owner.onHaptic={_ in haptics+=1}
        owner.paint(seconds:0.5);XCTAssertTrue(cloths.contains {$0.alpha>0})
        owner.paint(seconds:1.7);owner.paint(seconds:1.7);XCTAssertEqual(haptics,13)
        owner.setSuspended(true);owner.start();XCTAssertTrue(owner.hasActiveClock)
        owner.dispose();owner.dispose();XCTAssertEqual(finished,1);XCTAssertFalse(owner.hasActiveClock)
        owner.paint(seconds:2);XCTAssertEqual(haptics,13)
    }
    func testActualDicePickupSettlesAndReleaseRestartsCuberoHop() throws {
        let textures=NativeBoardTextures(root:root)
        let die=NativeDiceNode(id:"cubero-idle",value:6,kind:"wild-star",variant:"cubero",depth:1,locked:false,textures:textures)
        defer {die.dispose();textures.dispose()}
        let art=try XCTUnwrap(die.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        die.tick(0.14,suspended:false,viewportCenter:195)
        XCTAssertEqual(art.position.x,-1,accuracy:0.000001);XCTAssertEqual(art.position.y,0.5,accuracy:0.000001)
        die.setDragging(true);XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.zRotation,0)
        die.tick(0.5,suspended:false,viewportCenter:195);XCTAssertEqual(art.position,.zero)
        die.setDragging(false);die.tick(0.14,suspended:false,viewportCenter:195)
        XCTAssertEqual(art.position.x,-1,accuracy:0.000001)
        let held=art.position;die.tick(0.5,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,held)
    }
    func testMissingAssetLeaseCannotStartOrPaint() {
        let owner=NativeCuberoFinalePresentation(resourceRoot:URL(fileURLWithPath:"/not-a-native-asset-bundle"),viewport:CGSize(width:390,height:844))
        XCTAssertFalse(owner.assetReady)
        var finished:[Bool]=[];owner.onFinished={finished.append($0)}
        owner.start();owner.start();XCTAssertEqual(finished,[false]);XCTAssertFalse(owner.hasActiveClock)
    }
}
