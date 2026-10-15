import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeCuberoPresentationTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    func testActualCrateDropKeepsSVGBodyDuringFlightAndLanding() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("cubero-crate-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"three-a",cell:.init(column:1,row:4),value:3),.init(id:"three-b",cell:.init(column:2,row:4),value:3),.init(id:"one",cell:.init(column:1,row:3),value:1),.init(id:"five",cell:.init(column:3,row:3),value:5)],mode:.arcade,wildMeter:0.95,wildSpawnCount:2)
        seed.arcadeRunSavedAt=Date().timeIntervalSince1970;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ condition:()->Bool) async throws {
            let end=Date().addingTimeInterval(25)
            while !condition() {guard Date()<end else{throw CancellationError()};try await Task.sleep(for:.milliseconds(10))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first),scene=try XCTUnwrap(game.boardScene)
        try await wait{!game.engine.hasUnsavableSourceGameplayState && game.beforeSourceGameplayAdmission==nil}
        let a=try XCTUnwrap(scene.sourceNativeTileNode("three-a")),b=try XCTUnwrap(scene.sourceNativeTileNode("three-b"))
        let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        var carrier:NativeDiceNode?
        try await wait {
            guard let tile=game.engine.state.tiles.first(where:{$0.variant=="cubero"}),let node=scene.sourceNativeTileNode(tile.id) else{return false}
            carrier=node;return !node.isHidden && node.alpha>0.1 && node.sourceIdleDeferred
        }
        let node=try XCTUnwrap(carrier)
        let svg=node.visual.children.compactMap{$0 as? SKSpriteNode}.first{!$0.isHidden && $0.texture != nil && $0.size.height>180}
        print("[CUBERO_CRATE] deferred=\(node.sourceIdleDeferred) svg=\(svg != nil) outer=\(node.xScale),\(node.yScale) bodies=\(node.visual.children.compactMap{($0 as? SKSpriteNode).map{"\($0.size):hidden=\($0.isHidden)"}})")
        XCTAssertNotNil(svg,"Crate must show the correctly proportioned SVG rather than the old squashed PNG")
        try await wait{!node.sourceIdleDeferred && game.engine.meterDropReservations.isEmpty}
        XCTAssertTrue(scene.sourceNativeTileNode(node.tileID) === node)
        XCTAssertNil(game.sourcePresentationFailure)
    }
    func testActualRestoredBoardStartsSVGAfterEntry() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("cubero-restored-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.arcadeRun = .init(tiles:[.init(id:"cubero",cell:.init(column:2,row:4),value:6,archetype:.star,variant:"cubero"),.init(id:"one",cell:.init(column:1,row:3),value:1),.init(id:"five",cell:.init(column:3,row:3),value:5)],mode:.arcade)
        seed.arcadeRunSavedAt=Date().timeIntervalSince1970;try store.save(seed)
        let host=NativeStandaloneViewController(resourceRoot:root,store:store,completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func wait(_ condition:()->Bool) async throws {
            let end=Date().addingTimeInterval(25)
            while !condition() {guard Date()<end else{throw CancellationError()};try await Task.sleep(for:.milliseconds(20))}
        }
        try await wait{!app.home.isHidden};app.navigate(.gameplay,interrupt:true)
        try await wait{app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let node=try XCTUnwrap(game.boardScene?.sourceNativeTileNode("cubero"))
        print("[CUBERO_SVG] restored entryComplete=true deferred=\(node.sourceIdleDeferred) owners=\(node.sourceIdleOwnerCount) path=\(node.sourceWildSkinAssetPath ?? "none")")
        XCTAssertFalse(node.sourceIdleDeferred,"Actual restored Cubero never releases the Source idle gate")
        guard !node.sourceIdleDeferred else{return}
        try await wait{node.visual.children.compactMap{$0 as? SKSpriteNode}.contains{!$0.isHidden && $0.size.height>180}}
        let art=try XCTUnwrap(node.visual.children.compactMap{$0 as? SKSpriteNode}.first{!$0.isHidden && $0.size.height>180})
        let initial=art.position
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertNotEqual(art.position,initial,"Mounted SVG must actually animate")
        let scene=try XCTUnwrap(game.boardScene)
        let from=scene.convert(node.position,from:try XCTUnwrap(node.parent))
        XCTAssertTrue(scene.beginDrag(at:from))
        let draggingTexture=art.texture,draggingPose=art.position
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertFalse(art.isHidden,"Source pickup must retain SVG")
        XCTAssertFalse(art.texture === draggingTexture,"SVG frames must continue during Source drag")
        XCTAssertNotEqual(art.position,draggingPose,"SVG hop must continue during Source drag")
        scene.cancelDrag(pointerCancelled:true)
        XCTAssertNil(game.sourcePresentationFailure)
    }
    func testCapturedClothPlansAndWavesMatchExecutedOriginalGSAP() throws {
        var rng:UInt32=17,draws=0
        let plans=NativeCuberoFinaleMotion.make(viewport:CGSize(width:390,height:844),random:{draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296})
        XCTAssertEqual(draws,596);XCTAssertEqual(plans.count,14)
        let plan=try XCTUnwrap(plans.first),b=plan.burst,w=plan.wave
        XCTAssertEqual(b.birth,CGPoint(x:289,y:391));XCTAssertEqual(b.size,58)
        XCTAssertEqual(b.delay,0.015567724546417595,accuracy:1e-12)
        XCTAssertEqual(b.launch,0.11082306739187334,accuracy:1e-12)
        XCTAssertEqual(b.travel,1.476821682379581,accuracy:1e-12)
        XCTAssertEqual(w.repeats,4);XCTAssertEqual(w.duration,0.26564723702240733,accuracy:1e-12)
        let gold:[(Double,[Double],[Double])]=[
            (0.1,[10.348952,-2.581716,0.834269,0.599098,138.474289],[0,1,1,0,0]),
            (0.5,[79.459722,-36.891213,1.012046,0.786357,139.442591],[0.71634,0.994432,1.004541,-0.236633,0.154849]),
            (1,[393.27971,-97.855431,1.001498,0.502977,138.200344],[0.735994,0.994279,1.004666,-0.243125,0.159098]),
            (1.5,[614.240841,-178.644511,0.758558,0.013772,144.834768],[7.893537,0.938639,1.050038,-2.607518,1.706323])]
        for (time,expectedBurst,expectedWave) in gold {
            let p=b.sample(seconds:time),v=w.sample(seconds:time)
            let actualBurst=[Double(p.point.x-b.birth.x),Double(p.point.y-b.birth.y),Double(p.scale),Double(p.alpha),Double(p.rotation)]
            let actualWave=[Double(v.skew),Double(v.scaleX),Double(v.scaleY),Double(v.rotation),Double(v.x)]
            for index in actualBurst.indices {XCTAssertEqual(actualBurst[index],expectedBurst[index],accuracy:0.001);XCTAssertEqual(actualWave[index],expectedWave[index],accuracy:0.001)}
        }
        XCTAssertEqual(max(1.2,(plans.map(\.end).max() ?? 0)+0.45),3.17623220735736,accuracy:1e-12)
        XCTAssertEqual(b.sample(seconds:b.end).alpha,0)
    }
    func testSVGAuthoredFramesAndBounceBoundaries() throws {
        XCTAssertEqual(NativeCuberoIdleMotion.duration,1.153846153846,accuracy:0.000000001)
        let svg=try String(contentsOf:root.appendingPathComponent(NativeCuberoIdleMotion.sourcePath),encoding:.utf8)
        XCTAssertTrue(svg.contains("dur=\"1.8s\""))
        XCTAssertTrue(svg.contains("values=\"0 0;0 7;0 -55;0 -65;0 0;0 8;0 0\""))
        let atlas=try XCTUnwrap(NativeCuberoSVGAtlas.decode(root.appendingPathComponent(NativeCuberoIdleMotion.sourcePath)))
        XCTAssertEqual(atlas.width,3360);XCTAssertEqual(atlas.height,540)
        let first=try XCTUnwrap(atlas.cropping(to:CGRect(x:0,y:0,width:480,height:540)))
        let preview=XCTAttachment(image:UIImage(cgImage:first));preview.name="Cubero SVG first pose";preview.lifetime = .keepAlways;add(preview)
        let gold:[(Double,CGFloat)]=[(0,0),(0.12,7),(0.4,-55),(0.52,-65),(0.82,0),(0.9,8),(1,0)]
        for (t,y) in gold {XCTAssertEqual(NativeCuberoIdleMotion.sample(seconds:t*NativeCuberoIdleMotion.duration).y,y,accuracy:0.00001)}
        let order=[0,1,2,3,4,3,2,1,5,6]
        for (index,t) in NativeCuberoIdleMotion.frameTimes.dropLast().enumerated() {
            XCTAssertEqual(NativeDiceSheet.cubero.frame(at:(t+0.001)*NativeCuberoIdleMotion.duration),order[index])
        }
        XCTAssertEqual(NativeDiceSheet.cubero.frame(at:NativeCuberoIdleMotion.duration),0)
        XCTAssertNil(NativeCuberoSVGAtlas.decode(URL(fileURLWithPath:"/missing-cubero.svg")))
    }
    func testOriginalClothsHaveIndependentFlagPivotsAndFiniteCleanup() throws {
        let owner=NativeCuberoFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{0.5})
        XCTAssertTrue(owner.assetReady)
        let cloths=owner.subviews.filter {$0.layer.zPosition==2}
        XCTAssertEqual(cloths.count,14)
        XCTAssertTrue(cloths.allSatisfy {$0.subviews.count==1 && ($0.subviews.first as? UIImageView)?.image != nil})
        XCTAssertTrue(cloths.allSatisfy {$0.subviews.first?.layer.anchorPoint==CGPoint(x:0.22,y:0.5)})
        var finished=0,haptics=0
        owner.onFinished={_ in finished+=1};owner.onHaptic={_ in haptics+=1}
        owner.paint(seconds:0.5);XCTAssertTrue(cloths.contains {$0.alpha>0})
        owner.paint(seconds:1.7);owner.paint(seconds:1.7);XCTAssertEqual(haptics,13)
        owner.setSuspended(true);owner.start();XCTAssertTrue(owner.hasActiveClock)
        owner.dispose();owner.dispose();XCTAssertEqual(finished,1);XCTAssertFalse(owner.hasActiveClock)
        owner.paint(seconds:2);XCTAssertEqual(haptics,13)
    }
    func testActualSVGIdleUsesSharedFramesAndContinuesDuringPickup() async throws {
        let textures=NativeBoardTextures(root:root)
        let loaded=expectation(description:"selected SVG decoded")
        var frames:[SKTexture]=[]
        textures.prepare(.cubero) {frames=$0;loaded.fulfill()}
        await fulfillment(of:[loaded],timeout:10)
        XCTAssertEqual(frames.count,7)
        let cached=expectation(description:"shared SVG frames")
        textures.prepare(.cubero) {again in
            XCTAssertEqual(again.count,7)
            for (a,b) in zip(frames,again) {XCTAssertTrue(a === b)}
            cached.fulfill()
        }
        await fulfillment(of:[cached],timeout:1)
        let die=NativeDiceNode(id:"cubero-svg",value:6,kind:"wild-star",variant:"cubero",depth:1,locked:false,textures:textures)
        defer {die.dispose();textures.dispose()}
        let host=SKNode();host.addChild(die)
        let art=try XCTUnwrap(die.visual.children.compactMap {$0 as? SKSpriteNode}.first(where:{!$0.isHidden && $0.texture != nil && $0.size.height>180}))
        XCTAssertEqual(art.position.y,-64,accuracy:0.00001)
        XCTAssertEqual(art.xScale,1.3248,accuracy:0.00001)
        XCTAssertEqual(art.size.width,480*128/360.5*1.3248,accuracy:0.0001)
        die.tick(0.4,suspended:false,viewportCenter:195)
        XCTAssertEqual(art.size.width,480*128/360.5*art.xScale,accuracy:0.0001)
        // Setting size while squashed must not accumulate a new base size.
        for _ in 0..<4 {die.tick(0.01,suspended:false,viewportCenter:195);XCTAssertEqual(art.size.width,480*128/360.5*art.xScale,accuracy:0.0001)}
        XCTAssertEqual(die.dragContactBounds.width,170,accuracy:0.0001)
        XCTAssertEqual(die.dragContactBounds.height,128,accuracy:0.0001)
        let beforePickup=art.texture,poseBeforePickup=art.position
        die.setDragging(true)
        XCTAssertEqual(die.dragContactBounds.width,170*1.08,accuracy:0.0001)
        XCTAssertEqual(die.dragContactBounds.height,128*1.08,accuracy:0.0001)
        XCTAssertTrue(art.texture === beforePickup);XCTAssertEqual(art.position,poseBeforePickup)
        die.tick(0.25,suspended:false,viewportCenter:195)
        XCTAssertFalse(art.isHidden);XCTAssertFalse(art.texture === beforePickup)
        XCTAssertNotEqual(art.position,poseBeforePickup)
        let heldTexture=art.texture,heldPose=art.position
        die.setDragging(false)
        XCTAssertTrue(art.texture === heldTexture);XCTAssertEqual(art.position,heldPose)
        let held=art.position;die.tick(0.5,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,held)
        // A late decode after disposal cannot publish a new scene's frames.
        let retired=NativeBoardTextures(root:root),done=expectation(description:"retired")
        retired.prepare(.cubero) {_ in XCTFail("retired decoder published")}
        retired.dispose()
        DispatchQueue.main.asyncAfter(deadline:.now()+0.1){done.fulfill()}
        await fulfillment(of:[done],timeout:2)
    }
    func testMissingAssetLeaseCannotStartOrPaint() {
        let owner=NativeCuberoFinalePresentation(resourceRoot:URL(fileURLWithPath:"/not-a-native-asset-bundle"),viewport:CGSize(width:390,height:844))
        XCTAssertFalse(owner.assetReady)
        var finished:[Bool]=[];owner.onFinished={finished.append($0)}
        owner.start();owner.start();XCTAssertEqual(finished,[false]);XCTAssertFalse(owner.hasActiveClock)
    }
}
