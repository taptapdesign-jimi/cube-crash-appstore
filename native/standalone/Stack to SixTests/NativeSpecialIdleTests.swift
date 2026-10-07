import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeSpecialIdleTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    func testBottleRetainsExecutedSourceRepeatGapAndGroundedPivot() throws {
        XCTAssertEqual(NativeBottleIdleMotion.duration,7.32)
        for cycle in [0.0,7.32,21.96] {
            let peak=NativeBottleIdleMotion.sample(seconds:cycle+1.8)
            XCTAssertEqual(peak.y,-3,accuracy:1e-8);XCTAssertEqual(peak.rotation,-4.8 * .pi/180,accuracy:1e-8)
            let second=NativeBottleIdleMotion.sample(seconds:cycle+5.4)
            XCTAssertEqual(second.y,2,accuracy:1e-8)
            XCTAssertEqual(NativeBottleIdleMotion.sample(seconds:cycle+7.25).rotation,0,accuracy:1e-8)
        }
        let textures=NativeBoardTextures(root:root),die=NativeDiceNode(id:"bottle-idle",value:6,kind:"wild-magnet",variant:"bottle",depth:1,locked:false,textures:textures)
        defer {die.dispose();textures.dispose()}
        let art=try XCTUnwrap(die.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        XCTAssertEqual(art.anchorPoint,CGPoint(x:0.5,y:0));XCTAssertEqual(art.position.y,-64)
        die.tick(1.8,suspended:false,viewportCenter:195)
        XCTAssertEqual(art.position.y,-61,accuracy:1e-8)
        die.setDragging(true);XCTAssertEqual(art.anchorPoint,CGPoint(x:0.5,y:0.5));XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.zRotation,0)
        die.setDragging(false);XCTAssertEqual(art.position.y,-64)
        die.tick(0.9,suspended:false,viewportCenter:195);let pose=art.position
        die.tick(4,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,pose)
    }
    func testSpaceshipHasNineBoundedParticlesAndHoverFollowsOriginalClock() throws {
        XCTAssertEqual(NativeSpaceshipIdleMotion.duration,4.52)
        for cycle in [0.0,4.52,22.6] {
            let a=NativeSpaceshipIdleMotion.sample(seconds:cycle+1.1),b=NativeSpaceshipIdleMotion.sample(seconds:cycle+3.3)
            XCTAssertEqual(a.x,-5,accuracy:1e-8);XCTAssertEqual(a.y,-3,accuracy:1e-8);XCTAssertEqual(a.rotation,-.pi/12,accuracy:1e-8)
            XCTAssertEqual(b.x,5,accuracy:1e-8);XCTAssertEqual(b.y,3,accuracy:1e-8)
            XCTAssertEqual(NativeSpaceshipIdleMotion.sample(seconds:cycle+4.46).x,0,accuracy:1e-8)
        }
        let particles=NativeSpaceshipDiceIdle()
        XCTAssertEqual(particles.children.count,9);XCTAssertTrue(particles.children.allSatisfy {$0.children.count==2})
        particles.paint(seconds:0.7);XCTAssertTrue(particles.children.contains {$0.alpha>0})
        particles.dispose();XCTAssertTrue(particles.children.isEmpty)
        let textures=NativeBoardTextures(root:root),die=NativeDiceNode(id:"spaceship-idle",value:6,kind:"wild-magnet",variant:"spaceship",depth:1,locked:false,textures:textures)
        defer {die.dispose();textures.dispose()}
        die.tick(1.1,suspended:false,viewportCenter:195)
        let host=try XCTUnwrap(die.visual.children.first {$0.children.contains {$0.name=="native-spaceship-engine"}})
        XCTAssertEqual(host.position,CGPoint(x:-5,y:3));XCTAssertEqual(host.zRotation,.pi/12,accuracy:1e-8)
        let carrier=die.detachedArtworkCarrier();XCTAssertFalse(carrier.children.isEmpty)
        die.setDragging(true);die.tick(2.2,suspended:false,viewportCenter:195)
        XCTAssertEqual(host.position.x,5,accuracy:1e-8,"Source keeps hover below the pointer-owned outer translation")
        let held=host.position;die.tick(10,suspended:true,viewportCenter:195);XCTAssertEqual(host.position,held)
    }
}
