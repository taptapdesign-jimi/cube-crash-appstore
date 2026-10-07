import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeThemedTransitionPlanTests:XCTestCase {
    private final class Random {
        var state:UInt32,draws=0
        init(_ seed:UInt32){state=seed}
        func next()->Double{draws += 1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296}
    }
    func testOriginalCloudGeometryRandomConsumptionAndActualGsapPopInAcross36Scenes() {
        for fixture in NativeThemedCloudOracle.records {
            let rng=Random(fixture.seed),theme=NativeBoardTransitionPlan.Theme(rawValue:fixture.theme)!
            let plans=NativeTransitionCloudPlan.make(theme:theme,width:fixture.width,random:rng.next)
            XCTAssertEqual(plans.count,theme == .beach ? 6:8);XCTAssertEqual(rng.draws,fixture.draws)
            for (p,e) in zip(plans,fixture.plans) {
                let values=[Double(p.asset),Double(p.depth),p.width,p.height,p.xPercent,p.yPercent,p.baseScale,p.rotation,p.bounceAmount,p.bounceSpeed,p.windDuration,p.driftDistance,p.initialY,p.enterDelay]
                for (a,b) in zip(values,e){XCTAssertEqual(a,b,accuracy:0.00000001)}
            }
            for e in fixture.samples {
                let p=plans[Int(e[0])].sample(seconds:e[1]);XCTAssertEqual(p.scaleX,e[2],accuracy:0.000001);XCTAssertEqual(p.opacity,e[3],accuracy:0.000001)
            }
        }
    }
    func testAuthoredThemeGeometryPhoneTabletAndVariationAreNativeResponsive() {
        let viewport=CGSize(width:390,height:844),scene=NativeTransitionSceneGeometry.sceneFrame(viewport:viewport)
        XCTAssertEqual(scene.height,491.36,accuracy:0.000001);XCTAssertEqual(scene.minY,404.64,accuracy:0.000001)
        let forest=NativeTransitionSceneGeometry.layers(theme:.forest,viewport:viewport,variation:.init())
        XCTAssertEqual(forest.count,10);let mountain=forest.first {$0.definition.key=="mountain"}!
        XCTAssertEqual(mountain.width,390);XCTAssertEqual(mountain.height,328);XCTAssertEqual(mountain.bottom,142)
        let normal=NativeTransitionSceneGeometry.layers(theme:.beach,viewport:viewport,variation:.init())
        let swapped=NativeTransitionSceneGeometry.layers(theme:.beach,viewport:viewport,variation:.init(beachSwapped:true))
        XCTAssertEqual(normal.first {$0.definition.key=="beach-bottle"}!.left,366.6,accuracy:0.000001)
        XCTAssertEqual(swapped.first {$0.definition.key=="beach-bottle"}!.left,23.4,accuracy:0.000001)
        XCTAssertEqual(swapped.first {$0.definition.key=="beach-castle"}!.left,94.8,accuracy:0.000001)
        XCTAssertEqual(normal.first {$0.definition.key=="beach-ball"}!.width,193.7)
        XCTAssertEqual(normal.first {$0.definition.key=="beach-sea-3"}!.width,1014)
        let tablet=CGSize(width:834,height:1194),ipadScene=NativeTransitionSceneGeometry.sceneFrame(viewport:tablet)
        XCTAssertEqual(ipadScene.height,500);XCTAssertEqual(ipadScene.minY,770)
        let hills=NativeTransitionSceneGeometry.layers(theme:.forest,viewport:tablet,variation:.init())
        XCTAssertEqual(hills.first {$0.definition.key=="mountain"}!.bottom,140)
        XCTAssertEqual(hills.first {$0.definition.key=="hill2"}!.bottom,13)
        XCTAssertEqual(hills.first {$0.definition.key=="hill1"}!.bottom,70)
        let robo=NativeTransitionSceneGeometry.layers(theme:.area55,viewport:viewport,variation:.init(frontDirection:-1,walkerDirection:1))
        XCTAssertEqual(robo.count,13);XCTAssertEqual(robo.first {$0.definition.key=="robo-front"}!.left,327.6,accuracy:0.000001)
        XCTAssertEqual(robo.first {$0.definition.key=="robo-walker"}!.left,78)
        XCTAssertEqual(robo.first {$0.definition.key=="robo-fence-static-left"}!.bottom,331.00278032,accuracy:0.000001)
    }
}
