import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeMushroomPresentationTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private func captured()->([NativeMushroomGrowthMotion.Plan],[NativeMushroomSporeMotion.Plan],Int) {
        var rng:UInt32=17,draws=0
        func roll()->Double {draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296}
        let size=CGSize(width:390,height:844)
        var growth=(0..<4).map {NativeMushroomGrowthMotion.make(index:$0,viewport:size,aspect:1,random:roll)}
        let pollen=NativeMushroomSporeMotion.make(viewport:size,random:roll)
        growth += (4..<21).map {NativeMushroomGrowthMotion.make(index:$0,viewport:size,aspect:1,random:roll)}
        return (growth,pollen,draws)
    }
    func testTwentyOnePileSlotsRetainExecutedGSAPOverlapAndReverseExit() throws {
        let (growth,pollen,draws)=captured()
        XCTAssertEqual(draws,1466);XCTAssertEqual(growth.count,21);XCTAssertEqual(pollen.count,72)
        let first=try XCTUnwrap(growth.first),last=try XCTUnwrap(growth.last)
        XCTAssertEqual(first.x,-31.07926181964576,accuracy:1e-9);XCTAssertEqual(first.width,168.8188000768423,accuracy:1e-9)
        XCTAssertEqual(first.depth,94);XCTAssertEqual(last.depth,37)
        XCTAssertEqual(first.end,1.9107274,accuracy:0.000001,"GSAP shared timeline .34 rise extends its overlapping .21 scale track")
        XCTAssertLessThan(last.end,first.end)
        let gold:[(Double,[Double])]=[(0.1,[914.259066,-0.266641,1.099339,192.453376,148.560640]),(0.2,[914.774980,-0.248153,1,167.859712,170.097408]),(0.5,[914.774980,-0.248153,1,168.818688,168.818688]),(1.85,[925.206398,-0.230991,1,169.043712,144.115968])]
        for (time,expected) in gold {
            let pose=first.sample(seconds:time),actual=[pose.y,pose.rotation,pose.alpha,pose.scaleX*first.width,pose.scaleY*first.width]
            for index in actual.indices {XCTAssertEqual(actual[index],expected[index],accuracy:0.001)}
        }
        XCTAssertFalse(first.sample(seconds:first.end).visible)
    }
    func testSeventyTwoIndependentSporeRoutesMatchSourceFirstArrivalClock() throws {
        let (_,plans,_)=captured(),plan=try XCTUnwrap(plans.first)
        XCTAssertEqual(plan.originX,91.00420731813647,accuracy:1e-9);XCTAssertEqual(plan.targetY,445.83153798883467,accuracy:1e-9)
        XCTAssertEqual(plan.radius,3.3599933522939684,accuracy:1e-9);XCTAssertEqual(plan.birthDelay,0.5322514864771316,accuracy:1e-9)
        XCTAssertEqual(plan.depth,140);XCTAssertEqual(Set(plans.map(\.depth)),Set([140.0,88,68,49,30]))
        var runtime=NativeMushroomSporeMotion.Runtime(plan)
        let expected:[Int:[Double]]=[60:[108.71417035577194,708.2877232749777,0.40364261641154353,0.9586009955401626],90:[89.00214376932364,626.8924491685253,0.6352930411870495,1.140237839285214],180:[109.7636190166469,445.83153798883467,0.4743761191107065,1.0732575416623846]]
        var arrival:Double?
        for index in 0...240 {
            let pose=runtime.sample(seconds:Double(index)/60-0.055,viewport:CGSize(width:390,height:844))
            if let gold=expected[index] {for (actual,wanted) in zip([pose.x,pose.y,pose.alpha,pose.scale],gold) {XCTAssertEqual(actual,wanted,accuracy:1e-8)}}
            if let time=runtime.arrivalStartTime {if let arrival {XCTAssertEqual(time,arrival)} else {arrival=time}}
        }
        XCTAssertNotNil(arrival);XCTAssertTrue(runtime.finished)
        XCTAssertTrue(plans.allSatisfy {$0.originY>=844*0.7 && $0.originY<=844})
    }
    func testNativePollenAndOriginalGrowthImagesHaveCapturedDepthAndFiniteLifetime() throws {
        let owner=NativeMushroomFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{0.5})
        XCTAssertTrue(owner.assetReady)
        let mushrooms=owner.subviews.compactMap {$0 as? UIImageView},spores=owner.subviews.filter {$0.layer.sublayers?.count==3}
        XCTAssertEqual(mushrooms.count,21);XCTAssertEqual(spores.count,72)
        XCTAssertTrue(mushrooms.allSatisfy {$0.image != nil && $0.layer.anchorPoint==CGPoint(x:0.5,y:1)})
        var finished:[Bool]=[],haptics=0
        owner.onFinished={finished.append($0)};owner.onHaptic={_ in haptics+=1}
        for index in 0...330 {owner.paint(seconds:Double(index)/60)}
        XCTAssertEqual(finished,[true]);XCTAssertEqual(haptics,11)
        XCTAssertTrue(mushrooms.allSatisfy {$0.isHidden});XCTAssertTrue(spores.allSatisfy {$0.isHidden})
        owner.dispose();XCTAssertEqual(finished,[true]);XCTAssertFalse(owner.hasActiveClock)
    }
    func testThreeReusableIdleSmokePuffsHaveSourceCyclesAndPause() throws {
        let pose=NativeMushroomDiceSmoke.sample(index:0,seconds:0.11)
        XCTAssertEqual(pose.x,-11,accuracy:0.000001);XCTAssertEqual(pose.y,7.25,accuracy:0.000001);XCTAssertEqual(pose.alpha,0.225,accuracy:0.000001)
        XCTAssertEqual(pose.scaleX,0.7025,accuracy:0.000001)
        let node=NativeMushroomDiceSmoke();XCTAssertEqual(node.children.count,3)
        node.tick(0.11);let positions=node.children.map(\.position)
        node.setDragging(true);node.tick(0.5);XCTAssertTrue(node.isHidden);XCTAssertEqual(node.children.map(\.position),positions)
        node.setDragging(false);node.tick(0.11);XCTAssertFalse(node.isHidden);XCTAssertNotEqual(node.children.map(\.position),positions)
        node.dispose();node.dispose();XCTAssertEqual(node.children.count,0);XCTAssertFalse(node.hasActions())
    }
    func testIncompleteMushroomAssetLeaseFailsClosedWithoutClockOrCue() {
        let owner=NativeMushroomFinalePresentation(resourceRoot:URL(fileURLWithPath:"/not-native-assets"),viewport:CGSize(width:390,height:844))
        XCTAssertFalse(owner.assetReady);var receipt:[Bool]=[]
        owner.onFinished={receipt.append($0)};owner.start();owner.start();owner.dispose()
        XCTAssertEqual(receipt,[false]);XCTAssertFalse(owner.hasActiveClock)
    }
}
