import XCTest
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeTntFuseSparkleTests:XCTestCase {
    func testOriginalPwaRecipeAtKnownDraws() {
        let p=NativeTntFuseSparkles.Plan.make(random:{0.5})
        XCTAssertEqual(p.width,9.9,accuracy:1e-9);XCTAssertEqual(p.height,13.2,accuracy:1e-9)
        XCTAssertEqual(p.color,0xF5B6A6);XCTAssertEqual(p.duration,0.45,accuracy:1e-9)
        XCTAssertEqual(p.start.x,-7.68,accuracy:1e-9);XCTAssertEqual(p.start.y,0,accuracy:1e-9)
        XCTAssertEqual(p.end.x,-13.44,accuracy:1e-9);XCTAssertEqual(p.turn,0)
    }
    func testBoundedCarriersHideResumeStaleGenerationAndTwoIndependentOwners()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var current=true
        let a=NativeTntFuseSparkles(service:service,current:{current},random:{0.99})
        let b=NativeTntFuseSparkles(service:service,current:{true},random:{0.5})
        defer{a.dispose();b.dispose();service.dispose()}
        let parent=SKNode();parent.addChild(a);parent.addChild(b)
        let carriers=a.children.map(ObjectIdentifier.init)
        XCTAssertTrue(a.start());XCTAssertFalse(a.start());XCTAssertTrue(b.start())
        XCTAssertEqual(service.activeParticipantCount,2);XCTAssertEqual(a.activeCount,3)
        XCTAssertEqual(a.position.x,38.4,accuracy:1e-5);XCTAssertEqual(a.position.y,48)
        for frame in 1...2400 {
            service.deliver(wallMilliseconds:Double(frame)*1000/60)
            XCTAssertLessThanOrEqual(a.activeCount,9);XCTAssertLessThanOrEqual(b.activeCount,9)
            XCTAssertEqual(service.activeParticipantCount,2)
        }
        XCTAssertGreaterThan(a.emissionCount,100);XCTAssertEqual(a.children.map(ObjectIdentifier.init),carriers)
        a.setVisible(false);let emitted=a.emissionCount
        service.deliver(wallMilliseconds:40100)
        XCTAssertEqual(a.activeCount,0);XCTAssertEqual(a.emissionCount,emitted);XCTAssertTrue(a.isHidden)
        a.setVisible(true)
        for frame in 1...30 {service.deliver(wallMilliseconds:40100+Double(frame)*1000/60)}
        XCTAssertGreaterThan(a.emissionCount,emitted)
        current=false;service.deliver(wallMilliseconds:40700)
        XCTAssertNil(a.parent);XCTAssertTrue(a.children.isEmpty);XCTAssertEqual(service.activeParticipantCount,1)
        let live=b.emissionCount
        for frame in 1...30 {service.deliver(wallMilliseconds:40700+Double(frame)*1000/60)}
        XCTAssertGreaterThan(b.emissionCount,live)
        b.dispose();b.dispose();XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testShardLifetimeUsesFullAppClockAcrossLateFramesAndGlobalPause() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let field=NativeTntFuseSparkles(service:service,current:{true},random:{0.5})
        defer{field.dispose();service.dispose()}
        XCTAssertTrue(field.start());service.deliver(wallMilliseconds:225)
        XCTAssertEqual(field.activeCount,6)
        service.deliver(wallMilliseconds:450)
        XCTAssertEqual(field.activeCount,6,"The original450ms shards retire even when an emission frame overshoots200ms")
        let count=field.emissionCount
        XCTAssertTrue(service.setSourceGlobalPaused(true));service.deliver(wallMilliseconds:900)
        XCTAssertEqual(field.emissionCount,count)
        XCTAssertTrue(service.setSourceGlobalPaused(false));service.deliver(wallMilliseconds:916)
        XCTAssertEqual(field.emissionCount,count)
    }
    func testVariantTntSkinsCannotAcquireOgFuseOwner() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
        let textures=NativeBoardTextures(root:NativeTestResources.root),parent=SKNode()
        defer{textures.dispose();service.dispose()}
        for variant in ["barell","flower","laser-gun","beach-ball"] {
            let die=NativeDiceNode(id:variant,value:6,kind:"wild-tnt",variant:variant,depth:1,locked:false,textures:textures)
            parent.addChild(die)
            XCTAssertFalse(die.beginSourceTntFuse(service:service,current:{true},paintable:{true}))
            XCTAssertNil(die.visual.childNode(withName:"native-og-tnt-fuse-sparkles"));die.dispose()
        }
        XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testActualSavedNativeTntRouteMountsOnceAndPointerAndScopeRetireExactOwner()async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("tnt-fuse-"+UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var save=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        save.progression.firstPlayTutorialComplete=true
        save.arcadeRun = .init(tiles:[.init(id:"tnt",cell:.init(column:0,row:0),value:6,archetype:.tnt),.init(id:"second",cell:.init(column:2,row:0),value:6,archetype:.tnt),.init(id:"other",cell:.init(column:4,row:8),value:2)],mode:.arcade,board:1,stage:1,generation:9,score:123)
        try store.save(save)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
        bootstrap.sourceSpecialIdlePresentationEnabled=true
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
        let deadline=Date().addingTimeInterval(15)
        while Date()<deadline {
            if let game=app.children.first as? NativeGameplayViewController,let scene=game.boardScene,
               ((scene.sourceNativeTileNode("tnt")?.visual.childNode(withName:"native-og-tnt-fuse-sparkles") as? NativeTntFuseSparkles)?.emissionCount ?? 0) > 0 {break}
            try await Task.sleep(for:.milliseconds(20))
        }
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene)
        let a=try XCTUnwrap(scene.sourceNativeTileNode("tnt")),b=try XCTUnwrap(scene.sourceNativeTileNode("second"))
        let field=try XCTUnwrap(a.visual.childNode(withName:"native-og-tnt-fuse-sparkles") as? NativeTntFuseSparkles)
        let second=try XCTUnwrap(b.visual.childNode(withName:"native-og-tnt-fuse-sparkles") as? NativeTntFuseSparkles)
        XCTAssertTrue(a.beginSourceTntFuse(service:service,current:{true},paintable:{true}))
        XCTAssertTrue(a.visual.childNode(withName:"native-og-tnt-fuse-sparkles") === field)
        XCTAssertEqual(a.visual.children.filter{$0 is NativeTntFuseSparkles}.count,1)
        let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:image);attachment.name="OG-TNT-fuse-two-live-Native";attachment.lifetime = .keepAlways;add(attachment)
        XCTAssertNil(game.sourcePresentationFailure);XCTAssertEqual(game.engine.state.score,123)
        a.setDragging(true);XCTAssertEqual(field.activeCount,0);XCTAssertTrue(field.isHidden)
        a.setDragging(false);XCTAssertFalse(field.isHidden)
        let scope=try XCTUnwrap(game.sourceScope)
        scope.specialIdle.retire(a)
        XCTAssertNil(field.parent);XCTAssertTrue(field.children.isEmpty);XCTAssertNotNil(second.parent)
        scope.specialIdle.dispose();XCTAssertNil(second.parent)
    }
}
