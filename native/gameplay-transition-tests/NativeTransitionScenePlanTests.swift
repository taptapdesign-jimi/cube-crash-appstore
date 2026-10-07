import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeTransitionScenePlanTests:XCTestCase {
    func testOriginalEntryKeyframesAndTerrainDriftAcross1446ActualGsapPoses() throws {
        for row in NativeTransitionSceneOracle.rows {
            let theme=NativeBoardTransitionPlan.Theme(rawValue:row.theme)!
            let variation=NativeTransitionSceneGeometry.Variation(frontDirection:row.dir,walkerDirection:-row.dir)
            let viewport=CGSize(width:row.width,height:row.height)
            let layers=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation)
            let plan=try NativeTransitionScenePlan(theme:theme,layers:layers,viewportWidth:row.width,viewportHeight:row.height,variation:variation,random:{0.37})
            let pose=try XCTUnwrap(plan.pose(key:row.key,seconds:row.seconds))
            let actual=[pose.x,pose.y,pose.sx,pose.sy,min(1,max(0,pose.opacity)),pose.rotation]
            for (a,b) in zip(actual,row.pose){XCTAssertEqual(a,b,accuracy:0.0001,"\(row.theme) \(row.key) @\(row.seconds)")}
        }
    }
    func testAuthoredSceneExitRetainsOpaqueCoverBeyondEveryVisualLayer() throws {
        for theme in NativeBoardTransitionPlan.Theme.allCases {
            let viewport=CGSize(width:390,height:844),variation=NativeTransitionSceneGeometry.Variation()
            let layers=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation)
            let plan=try NativeTransitionScenePlan(theme:theme,layers:layers,viewportWidth:390,viewportHeight:844,variation:variation,random:{0.37})
            XCTAssertEqual(plan.exitAt,theme == .area55 ? 2.681:1.75,accuracy:0.0000001)
            XCTAssertEqual(plan.exitDuration,theme == .forest ? 2.031:theme == .beach ? 1.581:1.516,accuracy:0.0000001)
            for layer in layers where !layer.definition.key.hasPrefix("robo-fighter") && !layer.definition.key.hasPrefix("robo-beam") {
                XCTAssertEqual(plan.pose(key:layer.definition.key,seconds:plan.exitAt+plan.exitDuration)?.opacity,0)
            }
        }
    }
    func testOriginalAmbientOwnersAndSharedShoreCaptureAcross618ActualSourcePoses() throws {
        var checked=0
        for row in NativeTransitionAmbientOracle.rows {
            let theme:NativeBoardTransitionPlan.Theme=row.key.hasPrefix("robo") ? .area55:.beach
            let variation=NativeTransitionSceneGeometry.Variation(beachSwapped:row.swapped)
            let viewport=CGSize(width:row.width,height:row.width==834 ? 1194:844)
            let index=NativeTransitionThemeLayers.enterOrder(theme).firstIndex(of:row.key)!
            let start=0.05+Double(index)*0.042525+0.4914
            let seconds=row.key.contains("shore") || row.key.contains("castle") ? 0.64645+row.age:start+row.age
            let exit:[String:Double]=["beach-bottle":2.3,"beach-ball":2.7,"beach-sea-1":2.45,"beach-sea-2":2.55,"beach-sea-3":2.98,"beach-shore-1":2.7,"beach-castle":2.75,"beach-shore-2":3.03]
            guard seconds<(exit[row.key] ?? 4) else{continue}
            let layers=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation)
            let plan=try NativeTransitionScenePlan(theme:theme,layers:layers,viewportWidth:row.width,viewportHeight:viewport.height,variation:variation,random:{0.37})
            let p=try XCTUnwrap(plan.pose(key:row.key,seconds:seconds))
            for (a,b) in zip([p.x,p.y,p.sx,p.sy,p.rotation],row.pose){XCTAssertEqual(a,b,accuracy:0.0001,"\(row.key) @\(row.age)")}
            checked += 1
        }
        XCTAssertEqual(checked,618)
    }
    func testOriginalCapturedExitCallbacksAcross1050ActualGsapPoses() throws {
        for row in NativeTransitionExitOracle.rows {
            let theme=NativeBoardTransitionPlan.Theme(rawValue:row.theme)!
            let variation=NativeTransitionSceneGeometry.Variation(beachSwapped:row.swapped,frontDirection:row.swapped ? -1:1,walkerDirection:row.swapped ? 1:-1)
            let viewport=CGSize(width:row.width,height:row.height)
            let layers=NativeTransitionSceneGeometry.layers(theme:theme,viewport:viewport,variation:variation)
            let plan=try NativeTransitionScenePlan(theme:theme,layers:layers,viewportWidth:row.width,viewportHeight:row.height,variation:variation,random:{0.37})
            let p=try XCTUnwrap(plan.pose(key:row.key,seconds:row.seconds))
            for (a,b) in zip([p.x,p.y,p.sx,p.sy,min(1,max(0,p.opacity)),p.rotation],row.pose){XCTAssertEqual(a,b,accuracy:0.0001,"\(row.theme) \(row.key) @\(row.seconds)")}
        }
    }
    func testOriginalRandomExitOrderAndComparatorDrawCountAcross128Seeds() {
        for row in NativeTransitionOrderOracle.rows {
            var state=row.seed,draws=0
            func random()->Double {draws += 1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296}
            XCTAssertEqual(NativeTransitionScenePlan.authoredSort(["pine1","pine3","pine5"],random:random),row.rear)
            XCTAssertEqual(NativeTransitionScenePlan.authoredSort(["fence-left","fence-right"],random:random),row.fence)
            XCTAssertEqual(draws,row.draws)
        }
    }
}
