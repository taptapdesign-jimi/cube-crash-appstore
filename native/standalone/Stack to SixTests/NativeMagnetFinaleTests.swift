import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeMagnetFinaleTests:XCTestCase {
    func testActualMagnetCaptionRetainsSixtyHzThroughLongerTailAndCancellation(){
        let runtime=NativeSourceFrameRuntime();runtime.attach(rendererID:1,nowMs:0,configuredFPS:60)
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let owner=NativeMagnetFinalePresentation(textures:textures,viewport:.init(width:390,height:844),random:{0.5})
        let receipt=runtime.begin(.init(kind:.magnetFinale,generation:1,id:"swoop"))
        owner.play{runtime.end(receipt)}
        runtime.frame(nowMs:1500,configuredFPS:60)
        XCTAssertGreaterThan(owner.duration,1.5);XCTAssertEqual(runtime.snapshot.maxFPS,60)
        owner.dispose();XCTAssertEqual(runtime.snapshot.activityLeaseCount,0)
        runtime.frame(nowMs:1680,configuredFPS:60);XCTAssertEqual(runtime.snapshot.maxFPS,15)
        runtime.stop();textures.dispose()
    }
    func testImmediateOriginalClockAndScreenSpritesDoNotWaitForShadowPreparation()async throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let scene=SKScene(size:.init(width:390,height:844))
        let owner=NativeMagnetFinalePresentation(textures:textures,viewport:scene.size,random:{0.5})
        scene.addChild(owner);defer{owner.dispose();textures.dispose()}
        var finished=0,retired=0
        owner.onGlyphClock={_,done in if done{retired+=1}}
        owner.play{finished+=1}
        XCTAssertTrue(owner.assetReady);XCTAssertTrue(owner.hasActiveClock)
        let sprites=owner.children.compactMap{$0 as? SKSpriteNode}
        XCTAssertEqual(sprites.count,16);XCTAssertTrue(sprites.allSatisfy{$0.blendMode == .screen})
        owner.paint(seconds:0.22)
        let before=sprites.map{($0.position,$0.xScale,$0.alpha)}
        try await Task.sleep(for:.milliseconds(250))
        for(index,sprite) in sprites.enumerated(){
            XCTAssertEqual(sprite.position,before[index].0);XCTAssertEqual(sprite.xScale,before[index].1);XCTAssertEqual(sprite.alpha,before[index].2)
        }
        owner.dispose();owner.dispose();XCTAssertEqual(finished,1);XCTAssertEqual(retired,1)
        XCTAssertFalse(owner.hasActiveClock);XCTAssertNil(owner.parent);XCTAssertTrue(owner.children.isEmpty)
    }
    func testDisposedFieldCannotBeRepopulatedByLateShadowPreparation()async {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let owner=NativeMagnetFinalePresentation(textures:textures,viewport:.init(width:390,height:844),random:{0.5})
        var finished=0
        owner.play{finished+=1};owner.dispose()
        try? await Task.sleep(for:.milliseconds(250))
        XCTAssertEqual(finished,1);XCTAssertFalse(owner.hasActiveClock);XCTAssertTrue(owner.children.isEmpty)
        owner.paint(seconds:1);XCTAssertEqual(finished,1);textures.dispose()
    }
    func testInitialGlyphRetirementCannotCreateDetachedClock() {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let owner=NativeMagnetFinalePresentation(textures:textures,viewport:.init(width:390,height:844),random:{0.5})
        var finished=0
        owner.onGlyphClock={_,done in if !done{owner.dispose()}}
        owner.play{finished+=1}
        XCTAssertEqual(finished,1);XCTAssertFalse(owner.hasActiveClock);XCTAssertTrue(owner.children.isEmpty)
        textures.dispose()
    }
    func testActualControllerUsesOriginalWhiteSwoopAndRetiresItsGlyphOverlay()throws {
        let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2)])),resourceRoot:NativeTestResources.root)
        game.loadViewIfNeeded();defer{game.dispose()}
        let scene=try XCTUnwrap(game.boardScene)
        scene.onSplashGlyphClock?("magnet","original-swoop",0,false)
        let field=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeSplashGlyphField}.first)
        func labels(_ view:UIView)->[UILabel]{view.subviews.flatMap{($0 as? UILabel).map{[$0]} ?? labels($0)}}
        let glyphs=labels(field)
        XCTAssertEqual(glyphs.compactMap(\.text).joined(),"SWOOP")
        for glyph in glyphs {
            var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0
            XCTAssertTrue(glyph.textColor.getRed(&red,green:&green,blue:&blue,alpha:&alpha))
            XCTAssertEqual(red,1);XCTAssertEqual(green,1);XCTAssertEqual(blue,1)
        }
        scene.onSplashGlyphClock?("magnet","original-swoop",1,true)
        XCTAssertNil(field.superview)
    }
}
