import XCTest
import UIKit
import SpriteKit
import QuartzCore
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeComboHUDMotionTests: XCTestCase {
    func testHUDCountingSharesCleanBoardCurveAndRetargetsPaintedValue() {
        var counter=NativeHUDNumberCounter()
        counter.synchronize(100,generation:1,animated:true)
        XCTAssertEqual(counter.value,100)
        counter.synchronize(1100,generation:1,animated:true)
        counter.advance(delta:0.2,visible:true,reducedMotion:false)
        XCTAssertEqual(counter.value,NativeResultPresentationPlan.counter(from:100,to:1100,age:0.2,duration:NativeResultPresentationPlan.cleanCounterDuration(from:100,to:1100)))
        let painted=counter.value
        counter.synchronize(2100,generation:1,animated:true)
        XCTAssertEqual(counter.value,painted)
        counter.synchronize(2100,generation:1,animated:true)
        counter.advance(delta:0.1,visible:true,reducedMotion:false)
        XCTAssertEqual(counter.value,NativeResultPresentationPlan.counter(from:painted,to:2100,age:0.1,duration:NativeResultPresentationPlan.cleanCounterDuration(from:painted,to:2100)))
        counter.advance(delta:2,visible:true,reducedMotion:false)
        XCTAssertEqual(counter.value,2100);XCTAssertFalse(counter.active)
    }
    func testHUDCountingRetiresOnHiddenReducedMotionReplacementAndExpiry() {
        for reason in 0..<6 {
            var counter=NativeHUDNumberCounter()
            counter.synchronize(10,generation:1,animated:true)
            counter.synchronize(1000,generation:1,animated:true)
            counter.advance(delta:0.1,visible:true,reducedMotion:false)
            switch reason {
            case 0:counter.advance(delta:0,visible:false,reducedMotion:false)
            case 1:counter.advance(delta:0,visible:true,reducedMotion:true)
            case 2:counter.synchronize(22,generation:2,animated:true)
            case 3:counter.synchronize(0,generation:1,animated:true)
            case 4:counter.synchronize(1000,generation:1,animated:false)
            default:counter.settle();counter.settle()
            }
            let expected=reason==2 ? 22:reason==3 ? 0:1000
            XCTAssertEqual(counter.value,expected);XCTAssertFalse(counter.active)
            counter.advance(delta:10,visible:true,reducedMotion:false)
            XCTAssertEqual(counter.value,expected)
        }
    }
    func testMountedHUDCountsCommittedScoreAndSettlesOnSuspend() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("hud-count-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var save=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        save.progression.firstPlayTutorialComplete=true
        save.arcadeRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:3),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"other",cell:.init(column:4,row:8),value:2)],mode:.arcade,board:3,stage:3,generation:9,moves:37)
        save.arcadeRunSavedAt=Date().timeIntervalSince1970;try store.save(save)
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
        defer {host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        func wait(_ predicate:()->Bool) async throws {
            let end=Date().addingTimeInterval(25)
            while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(10))}
            XCTAssertTrue(predicate());if !predicate(){throw CancellationError()}
        }
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        var game:NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        try await wait{game?.boardScene?.isBoardEntryComplete==true && game?.beforeSourceGameplayAdmission==nil && game?.engine.hasUnsavableSourceGameplayState==false}
        let gameplay=try XCTUnwrap(game),scene=try XCTUnwrap(gameplay.boardScene)
        let score=try XCTUnwrap(scene.childNode(withName:"//native-game-score-value") as? NativeArchedHUDScore)
        let combo=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-value") as? SKLabelNode)
        let initialScore=gameplay.engine.state.score
        let source=try XCTUnwrap(scene.sourceNativeTileNode("a")),target=try XCTUnwrap(scene.sourceNativeTileNode("b"))
        let from=scene.convert(source.position,from:try XCTUnwrap(source.parent)),to=scene.convert(target.position,from:try XCTUnwrap(target.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await wait{gameplay.engine.state.score>initialScore}
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertNotEqual(score.text,NativeScoreDisplay.text(gameplay.engine.state.score),"Actual coin arrival starts count rather than jumping")
            try await wait{score.text != NativeScoreDisplay.text(initialScore)}
        }
        let attachment=XCTAttachment(image:UIGraphicsImageRenderer(bounds:gameplay.view.bounds).image {_ in
            gameplay.view.drawHierarchy(in:gameplay.view.bounds,afterScreenUpdates:true)
        });attachment.name="hud-clean-board-counting";attachment.lifetime = .keepAlways;add(attachment)
        gameplay.setSuspended(true)
        XCTAssertEqual(score.text,NativeScoreDisplay.text(gameplay.engine.state.score))
        XCTAssertEqual(combo.text,NativeComboDisplay.text(gameplay.engine.state.combo))
        let painted=score.text
        try await Task.sleep(for:.milliseconds(80));XCTAssertEqual(score.text,painted)
        gameplay.setSuspended(false)
    }
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
