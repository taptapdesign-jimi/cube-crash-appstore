import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeTransitionScenePlanTests:XCTestCase {
    func testOriginalEntryPosesExceptUserRetunedArea55TerrainAndFences() throws {
        for row in NativeTransitionSceneOracle.rows {
            // User2026-10-29 explicitly retunes these five entry owners below.
            if row.theme=="area55",row.key.hasPrefix("robo-ground-") || row.key.hasPrefix("robo-fence") {continue}
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
    func testArea55TerrainAndFencesHaveGentleContinuousEntranceAndRestrainedBounce() throws {
        for width in [320.0,390,834] {
            let variation=NativeTransitionSceneGeometry.Variation(),viewport=CGSize(width:width,height:844)
            let layers=NativeTransitionSceneGeometry.layers(theme:.area55,viewport:viewport,variation:variation)
            let plan=try NativeTransitionScenePlan(theme:.area55,layers:layers,viewportWidth:width,viewportHeight:844,variation:variation,random:{0.37})
            for (index,key) in NativeTransitionThemeLayers.enterOrder(.area55).enumerated() where key.hasPrefix("robo-ground-") || key.hasPrefix("robo-fence") {
                let ground=key.hasPrefix("robo-ground-"),start=ground ? 0.05+Double(index)*0.042525:0.62+Double(max(0,index-2))*0.042525
                let rise=ground ? 0.48:0.40,settle=ground ? 0.80:0.70,peak=ground ? 1.012:1.025
                let early=try XCTUnwrap(plan.pose(key:key,seconds:start+rise*0.25))
                XCTAssertLessThan(abs(early.sx),0.2,"Initial growth eases in rather than snapping to full size")
                XCTAssertLessThan(early.opacity,0.2)
                for fps in [60.0,120] {
                    var previous=try XCTUnwrap(plan.pose(key:key,seconds:start))
                    for frame in 1...Int(ceil(settle*fps)) {
                        let pose=try XCTUnwrap(plan.pose(key:key,seconds:start+Double(frame)/fps))
                        XCTAssertLessThanOrEqual(abs(pose.sx),peak+0.000001)
                        XCTAssertLessThan(abs(pose.sx-previous.sx),0.07,"No abrupt scale step at entry/rebound boundaries")
                        XCTAssertLessThan(abs(pose.rotation-previous.rotation),0.4)
                        previous=pose
                    }
                }
                let rest=try XCTUnwrap(plan.pose(key:key,seconds:start+settle))
                XCTAssertEqual(abs(rest.sx),1,accuracy:0.000001);XCTAssertEqual(rest.sy,1,accuracy:0.000001)
                XCTAssertEqual(rest.opacity,1);XCTAssertEqual(rest.sx<0,key=="robo-fence-static-right")
                if ground {
                    let before=try XCTUnwrap(plan.pose(key:key,seconds:start+settle-0.000001))
                    XCTAssertEqual(before.x,rest.x,accuracy:0.001,"Terrain drift starts continuously after the softer settle")
                }
            }
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
            let start=0.05+Double(index)*0.042525+(row.key.hasPrefix("robo-ground-") ? 0.80:0.4914)
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
            // Terrain drift begins after its newly lengthened settle. Exit still
            // captures that live x; all other original exit channels stay exact.
            let offset=row.key.hasPrefix("robo-ground-") ? 1:0
            for (a,b) in zip([p.x,p.y,p.sx,p.sy,min(1,max(0,p.opacity)),p.rotation].dropFirst(offset),row.pose.dropFirst(offset)){XCTAssertEqual(a,b,accuracy:0.0001,"\(row.theme) \(row.key) @\(row.seconds)")}
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
