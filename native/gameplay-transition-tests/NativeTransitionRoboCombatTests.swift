import XCTest
import CoreGraphics
@testable import Stack_to_Six

@MainActor
final class NativeTransitionRoboCombatTests: XCTestCase {
    private struct Row: Decodable {
        let width,height,sceneY,sceneH: Double
        let seed: UInt32
        let roll: Double?
        let draws: Int
        let swap,capture,end: Double
        let samples: [Sample]
    }
    private struct Sample: Decodable { let t: Double; let left,right,hit,final: [Double]; let depths: [Int] }
    func testOriginalTypeScriptFlightHoverBeamAndActiveExitCallbacks() throws {
        let rows = try JSONDecoder().decode([Row].self,from:NativeTransitionRoboCombatOracle.data)
        XCTAssertEqual(rows.count,15); XCTAssertEqual(rows.reduce(0){$0+$1.samples.count},435)
        for row in rows {
            var seed = row.seed,draws = 0
            let plan = NativeTransitionRoboCombatPlan(viewport:CGSize(width:row.width,height:row.height),sceneFrame:CGRect(x:0,y:row.sceneY,width:row.width,height:row.sceneH),random:{
                draws += 1
                if let roll = row.roll { return roll }
                seed = seed &* 1664525 &+ 1013904223
                return Double(seed)/4294967296
            })
            XCTAssertEqual(draws,row.draws); XCTAssertEqual(draws,75)
            XCTAssertEqual(plan.swapTime,row.swap,accuracy:1e-10)
            XCTAssertEqual(plan.captureTime,row.capture,accuracy:1e-10)
            XCTAssertEqual(plan.duration,row.end,accuracy:1e-10)
            for sample in row.samples {
                for (side,source) in [(NativeTransitionRoboCombatPlan.Side.left,sample.left),(.right,sample.right)] {
                    let p = plan.fighter(side:side,seconds:sample.t),o = p.outer,i = p.inner
                    XCTAssertEqual(p.depth,sample.depths[side == .left ? 0:1])
                    let values = [o.x,o.y,o.scale,o.rotation,o.opacity,o.hoverX,o.hoverY,o.skewX,i.x,i.y,i.skewX]
                    for (actual,expected) in zip(values,source) { XCTAssertEqual(actual,expected,accuracy:1e-8,"\(row.width)/\(row.seed) \(side) at \(sample.t)") }
                }
                for (key,source) in [("robo-beam-hit",sample.hit),("robo-beam-final",sample.final)] {
                    let b = try XCTUnwrap(plan.beam(key:key,seconds:sample.t))
                    // Hidden pre-entry beam transforms have no presentation
                    // effect; compare all authored geometry whenever visible.
                    if b.opacity > 0 || source[5] > 0 {
                        let values = [b.anchorX,b.anchorY,b.scaleX,b.scaleY,b.rotation,b.opacity]
                        for (actual,expected) in zip(values,source) { XCTAssertEqual(actual,expected,accuracy:1e-8,"\(key) at \(sample.t)") }
                    } else { XCTAssertEqual(b.opacity,source[5],accuracy:1e-8) }
                }
            }
        }
    }
    func testAtomicNumberDepthSwapAndFrozenNestedHoverAtSourceCapture() {
        let plan = NativeTransitionRoboCombatPlan(viewport:CGSize(width:390,height:844),sceneFrame:CGRect(x:0,y:404.64,width:390,height:491.36),random:{0.5})
        XCTAssertEqual(plan.fighter(side:.left,seconds:plan.swapTime-0.001).depth,9)
        XCTAssertEqual(plan.fighter(side:.right,seconds:plan.swapTime-0.001).depth,11)
        XCTAssertEqual(plan.fighter(side:.left,seconds:plan.swapTime).depth,11)
        XCTAssertEqual(plan.fighter(side:.right,seconds:plan.swapTime).depth,9)
        let capturedLeft = plan.fighter(side:.left,seconds:plan.captureTime),capturedRight = plan.fighter(side:.right,seconds:plan.captureTime)
        let departingLeft = plan.fighter(side:.left,seconds:plan.captureTime+0.2),departingRight = plan.fighter(side:.right,seconds:plan.captureTime+0.2)
        XCTAssertEqual(departingLeft.outer.hoverX,capturedLeft.outer.hoverX)
        XCTAssertEqual(departingLeft.outer.hoverY,capturedLeft.outer.hoverY)
        XCTAssertEqual(departingLeft.outer.skewX,capturedLeft.outer.skewX)
        XCTAssertEqual(departingRight.inner.x,capturedRight.inner.x)
        XCTAssertEqual(departingRight.inner.y,capturedRight.inner.y)
        XCTAssertEqual(departingRight.inner.skewX,capturedRight.inner.skewX)
        XCTAssertNotEqual(departingRight.outer.x,capturedRight.outer.x)
        XCTAssertNotEqual(departingLeft.outer.x,capturedLeft.outer.x)
    }
    func testFiniteAdmissionOnlyAuthoredTwoBeamsAndIndependentRightStart() throws {
        let plan = NativeTransitionRoboCombatPlan(viewport:CGSize(width:390,height:844),sceneFrame:CGRect(x:0,y:404.64,width:390,height:491.36),random:{0.5})
        XCTAssertEqual(plan.cues.map(\.seconds),[0.20,2.12]); XCTAssertEqual(plan.cues.map(\.index),[1,2])
        XCTAssertNil(plan.beam(key:"robo-beam-right",seconds:1)); XCTAssertNil(plan.beam(key:"robo-beam-after",seconds:1))
        XCTAssertEqual(plan.fighter(side:.right,seconds:0.199).outer.opacity,0)
        XCTAssertEqual(plan.fighter(side:.right,seconds:0.199).outer.rotation,0)
        XCTAssertEqual(plan.fighter(side:.right,seconds:0.20).outer.opacity,1)
        let hit = try XCTUnwrap(plan.beam(key:"robo-beam-hit",seconds:0.20)),final = try XCTUnwrap(plan.beam(key:"robo-beam-final",seconds:2.12))
        XCTAssertEqual(hit.depth,29); XCTAssertEqual(final.depth,29)
        XCTAssertEqual(hit.originX,0.88); XCTAssertEqual(hit.originY,0.75)
        XCTAssertGreaterThan(hit.scaleY,0); XCTAssertLessThan(final.scaleY,0)
        XCTAssertGreaterThan(try XCTUnwrap(plan.beam(key:"robo-beam-final",seconds:plan.exitStart-0.001)).opacity,0)
        XCTAssertEqual(plan.beam(key:"robo-beam-final",seconds:plan.exitStart)?.opacity,0)
        XCTAssertEqual(plan.beam(key:"robo-beam-final",seconds:plan.exitStart+0.001)?.opacity,0)
        XCTAssertEqual(plan.fighter(side:.left,seconds:plan.duration).outer.opacity,0)
        XCTAssertEqual(plan.fighter(side:.right,seconds:plan.duration).outer.opacity,0)
        XCTAssertEqual(plan.beam(key:"robo-beam-final",seconds:plan.duration)?.opacity,0)
    }
}
