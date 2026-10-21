import XCTest
import UIKit
import SpriteKit
import QuartzCore
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeComboHUDMotionTests: XCTestCase {
    func testAuthoredSVGTransitionsHoldCanonicalTiersAndRetireOnReplacement() throws {
        let artwork = SKSpriteNode()
        let motion = NativeComboHUDMotion(artwork: artwork)
        let image = try XCTUnwrap(UIImage(contentsOfFile:NativeTestResources.root.appendingPathComponent(NativeComboHUDMotion.atlasPath).path))
        XCTAssertEqual(image.size,CGSize(width:1536,height:1152))
        motion.configure(atlas:SKTexture(image:image))
        motion.layoutArtwork(fallbackSize:CGSize(width:28,height:28))
        XCTAssertEqual(artwork.size.height,28*336/216,accuracy:0.001)
        motion.synchronize(combo:0,generation:1)
        XCTAssertEqual(motion.displayedFrame,0)
        motion.synchronize(combo:5,generation:1)
        XCTAssertTrue(motion.isTransitioning)
        for _ in 0..<12 {motion.advance(delta:1.0/60,visible:true,reducedMotion:false)}
        let intermediate=motion.displayedFrame
        XCTAssertGreaterThan(intermediate,0);XCTAssertLessThan(intermediate,60)
        let texture=artwork.texture
        motion.advance(delta:5,visible:false,reducedMotion:false)
        XCTAssertEqual(motion.displayedFrame,intermediate);XCTAssertTrue(artwork.texture === texture)
        motion.synchronize(combo:6,generation:1)
        XCTAssertEqual(motion.displayedFrame,intermediate,"Repeated synchronization cannot restart transition")
        motion.synchronize(combo:10,generation:1)
        XCTAssertEqual(motion.displayedFrame,intermediate,"Rapid tier increase continues current painted frame")
        for _ in 0..<120 {motion.advance(delta:1.0/60,visible:true,reducedMotion:false)}
        XCTAssertEqual(motion.displayedFrame,100);XCTAssertFalse(motion.isTransitioning)
        for _ in 0..<180 {motion.advance(delta:1.0/60,visible:true,reducedMotion:false)}
        XCTAssertEqual(motion.displayedFrame,100,"SVG must not loop back to wood")
        motion.synchronize(combo:0,generation:1)
        XCTAssertEqual(motion.displayedFrame,0)
        motion.synchronize(combo:5,generation:2)
        XCTAssertEqual(motion.displayedFrame,60);XCTAssertFalse(motion.isTransitioning)
        motion.synchronize(combo:10,generation:2)
        motion.advance(delta:0.01,visible:true,reducedMotion:true)
        XCTAssertEqual(motion.displayedFrame,100);XCTAssertFalse(motion.isTransitioning)
        let finalTexture=artwork.texture
        motion.stop()
        XCTAssertTrue(artwork.texture === finalTexture,"Exit cannot flash settled bolt back to wood")
        motion.synchronize(combo:10,generation:2)
        motion.dispose();motion.dispose()
        XCTAssertNil(artwork.texture);XCTAssertFalse(motion.usesAuthoredFrames)
    }
    private func state(combo:Int,mode:NativeRunMode = .journey)->NativeBoardState {
        .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),
                     .init(id:"b",cell:.init(column:1,row:0),value:1),
                     .init(id:"c",cell:.init(column:2,row:0),value:3)],mode:mode,combo:combo)
    }
    func testBoundedTiersReducedMotionAndRetirementDoNotOwnActionsOrRetainArtwork() {
        var artwork:SKSpriteNode?=SKSpriteNode()
        weak var weakArt=artwork
        let motion=NativeComboHUDMotion(artwork:artwork!)
        for combo in [0,4,5,9,10,20] {
            motion.synchronize(combo:combo,generation:1)
            var minimum:CGFloat=0,maximum:CGFloat=0
            for _ in 0..<120 {
                motion.advance(delta:1.0/120,visible:true,reducedMotion:false)
                let art=artwork!;minimum=min(minimum,art.zRotation);maximum=max(maximum,art.zRotation)
                XCTAssertLessThanOrEqual(abs(art.zRotation),.pi/12+0.00001)
                XCTAssertEqual(art.xScale,art.yScale)
                XCTAssertFalse(art.hasActions())
                if combo<5 {XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.xScale,1)}
                else if combo<10 {XCTAssertEqual(art.xScale,1)}
                else {XCTAssertGreaterThanOrEqual(art.xScale,1.12);XCTAssertLessThanOrEqual(art.xScale,1.145)}
            }
            if combo>=5 {XCTAssertLessThan(minimum,-0.15);XCTAssertGreaterThan(maximum,0.15)}
        }
        let frozen=artwork!.position,angle=artwork!.zRotation
        motion.advance(delta:100,visible:false,reducedMotion:false)
        XCTAssertEqual(artwork!.position,frozen);XCTAssertEqual(artwork!.zRotation,angle)
        motion.advance(delta:1,visible:true,reducedMotion:true)
        XCTAssertEqual(artwork!.position,.zero);XCTAssertEqual(artwork!.zRotation,0);XCTAssertEqual(artwork!.xScale,1.12,accuracy:0.00001)
        motion.stop();motion.stop();motion.advance(delta:1,visible:true,reducedMotion:false)
        XCTAssertEqual(artwork!.xScale,1);XCTAssertEqual(artwork!.zRotation,0)
        artwork=nil;XCTAssertNil(weakArt)
    }
    func testMountedExtraAndMegaPaintPauseResumeAndKeepTapTransformIndependent() async throws {
        for (mode,combo) in [(NativeRunMode.journey,5),(.arcade,10)] {
            let engine=NativeGameplayEngine(state:state(combo:combo,mode:mode))
            let controller=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
            defer {controller.dispose();window.isHidden=true;window.rootViewController=nil}
            controller.view.layoutIfNeeded()
            let scene=try XCTUnwrap(controller.boardScene)
            scene.layout(size:scene.size,insets:.zero,animateEntry:false)
            let carrier=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-art"))
            let art=try XCTUnwrap(carrier.childNode(withName:"native-game-combo-image") as? SKSpriteNode)
            var angles=Set<Int>()
            for _ in 0..<20 {try await Task.sleep(for:.milliseconds(20));angles.insert(Int(art.zRotation*1000))}
            XCTAssertGreaterThan(angles.count,3,"Actual visible Scene must paint the motion")
            if combo>=10 {XCTAssertGreaterThan(art.xScale,1.1)} else {XCTAssertEqual(art.xScale,1)}
            XCTAssertEqual(carrier.xScale,1)
            let snapshot=UIGraphicsImageRenderer(bounds:controller.view.bounds).image { _ in
                controller.view.drawHierarchy(in:controller.view.bounds,afterScreenUpdates:true)
            }
            let attachment=XCTAttachment(image:snapshot)
            attachment.name="combo-svg-tier-\(combo)";attachment.lifetime = .keepAlways;add(attachment)
            let before=engine.state
            controller.setSuspended(true)
            let frozen=art.position,angle=art.zRotation,scale=art.xScale
            try await Task.sleep(for:.milliseconds(100))
            XCTAssertEqual(art.position,frozen);XCTAssertEqual(art.zRotation,angle);XCTAssertEqual(art.xScale,scale)
            controller.setSuspended(false)
            try await Task.sleep(for:.milliseconds(60))
            XCTAssertEqual(engine.state,before,"Decorative motion cannot change gameplay")
            var requests=0
            scene.onComboRequest={requests += 1;controller.setSuspended(true)}
            XCTAssertTrue(scene.handleHUDContact(at:carrier.convert(.zero,to:scene)))
            XCTAssertEqual(requests,1)
            let tapFrozen=art.position,tapAngle=art.zRotation
            var bouncePainted=false
            for _ in 0..<30 {
                try await Task.sleep(for:.milliseconds(20))
                if abs(carrier.xScale-1)>0.005 {bouncePainted=true}
                XCTAssertEqual(art.position,tapFrozen);XCTAssertEqual(art.zRotation,tapAngle)
            }
            XCTAssertTrue(bouncePainted);XCTAssertEqual(carrier.xScale,1,accuracy:0.0001)
            XCTAssertFalse(scene.hasActiveHUDTapFeedback)
            controller.setSuspended(false)
            scene.animateExit{_ in}
            XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.zRotation,0);XCTAssertEqual(art.xScale,1)
            controller.dispose();controller.dispose()
            XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.xScale,1)
        }
    }
    func testCanonicalExpiryRestoresOrdinaryArtworkAndNeutralPoseWithoutAnotherMove() async throws {
        let engine=NativeGameplayEngine(state:state(combo:4))
        XCTAssertTrue(engine.beginDrag(tileID:"a"))
        let old=CACurrentMediaTime()-20
        XCTAssertTrue(engine.drop(target:.init(column:1,row:0),now:old).accepted)
        XCTAssertEqual(engine.state.combo,5)
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        scene.layout(size:scene.size,insets:.zero)
        defer {scene.dispose()}
        let art=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-image") as? SKSpriteNode)
        let bonus=engine.state.earnedComboBonus,score=engine.state.score,tiles=engine.state.tiles
        scene.update(CACurrentMediaTime())
        XCTAssertEqual(engine.state.combo,0)
        XCTAssertEqual((scene.childNode(withName:"//native-game-combo-value") as? SKLabelNode)?.text,"0")
        XCTAssertEqual(art.position,.zero);XCTAssertEqual(art.zRotation,0);XCTAssertEqual(art.xScale,1)
        XCTAssertEqual(engine.state.earnedComboBonus,bonus);XCTAssertEqual(engine.state.score,score);XCTAssertEqual(engine.state.tiles,tiles)
    }
}
