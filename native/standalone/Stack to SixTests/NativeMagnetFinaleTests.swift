import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeMagnetFinaleTests:XCTestCase {
    func testWarmOriginalFinaleRepeatedConstructionCost()async throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        defer{textures.dispose()}
        let originals=NativeMagnetFinalePresentation.assets.compactMap{textures.texture($0)}
        XCTAssertEqual(originals.count,8)
        await withCheckedContinuation{(done:CheckedContinuation<Void,Never>) in
            SKTexture.preload(originals){done.resume()}
        }
        let readbackStart=CACurrentMediaTime()
        let oldInputs=originals.map{$0.cgImage()}
        NSLog("[OG_MAGNET_LOCAL_COST] originalEightReadbacksMs=%.2f",(CACurrentMediaTime()-readbackStart)*1000)
        let retained=try XCTUnwrap(textures.sourceMagnetBoltRasterInputs())
        for (old,image) in zip(oldInputs,retained) {
            XCTAssertEqual(image.width,old.width);XCTAssertEqual(image.height,old.height)
            let a=try XCTUnwrap(NativeSelectedFinaleRaster.materialize(old)?.dataProvider?.data)
            let b=try XCTUnwrap(NativeSelectedFinaleRaster.materialize(image)?.dataProvider?.data)
            XCTAssertEqual(a as Data,b as Data,"Retained original pixels must match the former texture readback")
        }
        for iteration in 0..<3 {
            let start=CACurrentMediaTime()
            let owner=NativeMagnetFinalePresentation(textures:textures,viewport:.init(width:390,height:844),random:{0.5})
            let constructed=CACurrentMediaTime()
            owner.play{}
            let played=CACurrentMediaTime()
            NSLog("[OG_MAGNET_LOCAL_COST] iteration=%d initMs=%.2f playMs=%.2f",iteration,(constructed-start)*1000,(played-constructed)*1000)
            XCTAssertTrue(owner.assetReady);XCTAssertEqual(owner.children.count,16)
            let repeated=try XCTUnwrap(textures.sourceMagnetBoltRasterInputs())
            XCTAssertTrue(zip(retained,repeated).allSatisfy{pair in pair.0 === pair.1},"Repeated finales borrow the same eight CPU sources")
            owner.dispose()
        }
        textures.purgeUnused(retaining:[])
        XCTAssertNil(textures.sourceMagnetBoltRasterInputs())
        _=NativeMagnetFinalePresentation.assets.compactMap{textures.texture($0)}
        XCTAssertEqual(textures.sourceMagnetBoltRasterInputs()?.count,8)
        textures.dispose();XCTAssertNil(textures.sourceMagnetBoltRasterInputs())
    }
    func testSelectedBoltRasterAdoptionRejectsStaleUploadsAndDisposal()async throws {
        @MainActor final class Uploads {
            var receipts:[@Sendable()->Void]=[]
            var preload:NativeBoardTextures.SelectedFinalePreload {{[self] _,done in receipts.append(done)}}
        }
        let uploads=Uploads(),textures=NativeBoardTextures(root:NativeTestResources.root,selectedFinalePreload:uploads.preload)
        defer{textures.dispose()}
        func until(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(5)
            while !predicate(){guard Date()<deadline else{throw NSError(domain:"MagnetRasterUpload",code:1)};try await Task.sleep(for:.milliseconds(10))}
        }
        var old=0,new=0
        for path in NativeMagnetFinalePresentation.assets {textures.prepareSelectedFinaleAsset(.init([path])){image in XCTAssertNil(image);old+=1}}
        try await until{uploads.receipts.count==8}
        XCTAssertNil(textures.sourceMagnetBoltRasterInputs())
        textures.invalidatePendingPreparation();XCTAssertEqual(old,8)
        for path in NativeMagnetFinalePresentation.assets {textures.prepareSelectedFinaleAsset(.init([path])){image in XCTAssertNotNil(image);new+=1}}
        try await until{uploads.receipts.count==16}
        for callback in uploads.receipts.prefix(8) {callback()}
        await Task.yield();await Task.yield()
        XCTAssertNil(textures.sourceMagnetBoltRasterInputs());XCTAssertEqual(new,0)
        for callback in uploads.receipts.suffix(8) {callback()}
        try await until{new==8}
        let retained=try XCTUnwrap(textures.sourceMagnetBoltRasterInputs())
        XCTAssertEqual(retained.count,8)
        let owner=NativeMagnetFinalePresentation(textures:textures,viewport:.init(width:390,height:844),random:{0.5})
        XCTAssertTrue(owner.assetReady);owner.play{};owner.dispose()
        textures.dispose()
        for callback in uploads.receipts {callback()}
        await Task.yield();await Task.yield()
        XCTAssertEqual(new,8);XCTAssertEqual(old,8);XCTAssertNil(textures.sourceMagnetBoltRasterInputs())
    }
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
    func testActualControllerUsesOriginalOrangeSwoopAndRetiresItsGlyphOverlay()throws {
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
            XCTAssertEqual(red,1,accuracy:0.000001)
            XCTAssertEqual(green,148.0/255,accuracy:0.000001)
            XCTAssertEqual(blue,114.0/255,accuracy:0.000001)
        }
        scene.onSplashGlyphClock?("magnet","original-swoop",1,true)
        XCTAssertNil(field.superview)
    }
}
