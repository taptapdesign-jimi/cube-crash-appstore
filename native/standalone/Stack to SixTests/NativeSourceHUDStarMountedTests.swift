import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceHUDStarMountedTests:XCTestCase {
    @MainActor private final class Fixture {
        let engine:NativeGameplayEngine,service:NativeSourceAnimationClockService,scene:SKScene,view:SKView
        let timeouts=NativeSourceAppTimeoutOwner()
        var wall=0.0,seed:UInt32=1,acquires=0,releases=0,arrivals=0,retired=0,current=true
        var owner:NativeSourceHUDStarPresentation?
        init(count:Int=3) {
            var star=NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star);star.starOrbitCount=count
            engine=NativeGameplayEngine(state:.init(tiles:[star,.init(id:"d",cell:.init(column:1,row:0),value:2)]))
            XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            engine.sourceHUDStarJobsEnabled=true
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
            scene=SKScene(size:.init(width:390,height:844));view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.ignoresSiblingOrder=false;view.presentScene(scene);view.isPaused=true
        }
        func mount(_ prepared:NativeSourceHUDStarTexturePreparation.Prepared)->Bool {
            owner=NativeSourceHUDStarPresentation(stage:scene,viewportHeight:844,texture:prepared.texture,pixelSize:prepared.pixelSize,selectedAssetsReady:prepared.current,service:service,timeouts:timeouts,engine:engine,bindings:.init(current:{[weak self] in self?.current==true},random:{[unowned self] in self.seed=self.seed &* 1664525 &+ 1013904223;return Double(self.seed)/4294967296},acquireCadence:{[unowned self] in self.acquires += 1;return{self.releases += 1}},onArrival:{[unowned self] result in XCTAssertTrue(result.accepted);self.arrivals += 1},onRetired:{[unowned self] _ in self.retired += 1}))
            return owner?.start(receiptIDs:engine.pendingHUDStars.map(\.id),screenOrigin:.init(x:195,y:430),hudTarget:.init(x:37,y:76))==true
        }
        func deliver(_ wall:Double){self.wall=wall;service.deliver(wallMilliseconds:wall)}
        func dispose(){owner?.dispose();owner=nil;timeouts.cancelAll();service.dispose();view.presentScene(nil)}
    }
    private func prepare(_ owner:NativeSourceHUDStarTexturePreparation)async throws->NativeSourceHUDStarTexturePreparation.Prepared {
        let ready=expectation(description:"Original small-star decode + actual SKTexture preload")
        var receipt:NativeSourceHUDStarTexturePreparation.Prepared?
        owner.prepare(root:NativeTestResources.root,current:{true}){receipt=$0;ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
        return try XCTUnwrap(receipt)
    }
    func testOriginalTextureMountedProtectedStagePathAndGenuine98ArrivalOnce()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture();defer{f.dispose();textures.dispose()}
        let score=f.engine.state.score;XCTAssertTrue(f.mount(prepared));let container=try XCTUnwrap(f.owner?.mountedContainer)
        XCTAssertTrue(container.parent === f.scene);XCTAssertEqual(container.zPosition,999999);XCTAssertEqual(container.children.count,3)
        for child in container.children {let sprite=try XCTUnwrap(child as? SKSpriteNode);XCTAssertTrue(sprite.texture === prepared.texture);XCTAssertEqual(sprite.anchorPoint,.init(x:0.5,y:0.5))}
        for ms in stride(from:0.0,through:350,by:10){f.deliver(ms)}
        let sourceURL=try XCTUnwrap(Bundle(for:NativeSourceHUDStarPlanTests.self).url(forResource:"NativeSourceHUDStarSourceOracle",withExtension:"json"))
        let rows=try JSONDecoder().decode([NativeSourceHUDStarPlanTests.Row].self,from:Data(contentsOf:sourceURL))
        let source=try XCTUnwrap(rows.first{$0.seed==1 && $0.count==3}?.samples?.first{$0.wall==350})
        let ids=f.engine.sourceHUDStarJobs[0].receiptIDs
        for reference in source.children {
            let sprite=try XCTUnwrap(container.children.first{$0.name=="source-hud-star:"+ids[reference.ordinal]} as? SKSpriteNode)
            // Source logical positions are projected through SpriteKit's Float
            // backend; compare subpixel geometry, not a replacement trajectory.
            XCTAssertEqual(sprite.position.x,reference.x,accuracy:0.0001)
            XCTAssertEqual(844-sprite.position.y,reference.y,accuracy:0.0001)
            XCTAssertEqual(sprite.xScale*prepared.pixelSize.width,reference.scale*64,accuracy:0.0001)
            XCTAssertEqual(-sprite.zRotation,reference.rotation,accuracy:0.000001)
        }
        for ms in stride(from:360.0,through:1800,by:10){f.deliver(ms)}
        XCTAssertEqual(f.arrivals,3);XCTAssertEqual(f.engine.state.score,score+300);XCTAssertTrue(f.engine.pendingHUDStars.isEmpty)
        XCTAssertEqual(f.owner?.pendingJobCount,1);XCTAssertEqual(f.releases,0) // wall is independent of this manually delivered Source phase.
        f.deliver(2000);XCTAssertEqual(f.arrivals,3);XCTAssertEqual(f.engine.state.score,score+300)
    }
    func testGlobalPauseWallCleanupDiscardsNoRewardAndReleasesAfterRealJobThen120()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture();defer{f.dispose();textures.dispose()}
        let score=f.engine.state.score;XCTAssertTrue(f.mount(prepared));XCTAssertTrue(f.service.setSourceGlobalPaused(true))
        f.deliver(650);XCTAssertEqual(f.arrivals,0);XCTAssertEqual(f.engine.pendingHUDStars.count,3)
        f.engine.cancelForBackground();XCTAssertEqual(f.engine.state.score,score);XCTAssertEqual(f.engine.pendingHUDStars.count,3)
        let wall=expectation(description:"Actual independent job wall + empty container120")
        DispatchQueue.main.asyncAfter(deadline:.now()+2){wall.fulfill()};await fulfillment(of:[wall],timeout:3)
        XCTAssertEqual(f.arrivals,0);XCTAssertEqual(f.engine.state.score,score);XCTAssertTrue(f.engine.pendingHUDStars.isEmpty)
        XCTAssertEqual(f.retired,1);XCTAssertEqual(f.releases,1);XCTAssertNil(f.owner?.mountedContainer)
    }
    func testExplicitDisposalAndLateSourceDeliveryNeverAwardOrAffectNewGeneration()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture();defer{f.dispose();textures.dispose()}
        XCTAssertTrue(f.mount(prepared));f.deliver(300);f.owner?.dispose();f.engine.restart(state:.init(tiles:[]))
        let state=f.engine.state;f.deliver(3000);XCTAssertEqual(f.engine.state,state);XCTAssertEqual(f.arrivals,0)
        XCTAssertTrue(f.scene.children.isEmpty);XCTAssertTrue(f.engine.sourceHUDStarJobs.isEmpty)
    }
    func testAppTextureCacheOriginalIdentityAndDisposeReentryRejectsLaterWaiter()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures)
        var first:NativeSourceHUDStarTexturePreparation.Prepared?
        textures.prepare(root:NativeTestResources.root,current:{true}){first=$0};XCTAssertTrue(first === prepared)
        var calls=0;let callback=expectation(description:"Captured cached predicate disposal once")
        textures.prepare(root:NativeTestResources.root,current:{textures.dispose();return true}){receipt in calls += 1;XCTAssertNil(receipt);callback.fulfill()}
        await fulfillment(of:[callback],timeout:1);XCTAssertEqual(calls,1);XCTAssertFalse(prepared.current)
    }
    func testActualSceneConfigureGenuineEarnedCallAndPauseResumeDoesNotRecreateRoots()async throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true),context=NativeGameplaySourceContext(service:service,visualRandom:{0.5})
        let scope=try XCTUnwrap(context.beginScene(retire:{})),prepared=try await prepare(scope.hudStarTextures)
        var star=NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star);star.starOrbitCount=3
        let engine=NativeGameplayEngine(state:.init(tiles:[star,.init(id:"d",cell:.init(column:1,row:0),value:2)]))
        XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844)),view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.ignoresSiblingOrder=false;view.presentScene(scene);view.isPaused=true
        defer{scene.dispose();context.dispose();service.dispose();view.presentScene(nil)}
        scene.sourceHUDStarJobsPresentationEnabled=true
        XCTAssertTrue(scene.configureSourceHUDStarJobs(scope:scope,prepared:prepared,capture:{_ in .init(screenOrigin:.init(x:195,y:430),hudTarget:.init(x:37,y:76))},hudFeedback:{_ in}))
        XCTAssertTrue(scene.startSourceHUDStarJobs(ids:engine.pendingHUDStars.map(\.id)));XCTAssertEqual(engine.sourceHUDStarJobs.count,1)
        let participants=service.activeParticipantCount;scene.setSuspended(true);scene.setSuspended(false);view.isPaused=true
        XCTAssertEqual(service.activeParticipantCount,participants);XCTAssertEqual(engine.sourceHUDStarJobs.count,1)
        scene.retireSourceHUDStarJobs();XCTAssertTrue(engine.sourceHUDStarJobs.isEmpty);XCTAssertTrue(engine.pendingHUDStars.isEmpty)
    }
    func testStandardTntBonusParticleSelectionUsesActualCachedTextureAndOneSharedDraw()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture()
        defer{f.dispose();textures.dispose()}
        var draws=0
        let selected=try XCTUnwrap(textures.selectStandardTntBonusParticle(random:{draws+=1;return 0.99},current:{true}))
        XCTAssertTrue(selected === prepared);XCTAssertEqual(draws,1)
        XCTAssertTrue(f.mount(selected));XCTAssertTrue(f.owner?.acceptsParticle(selected)==true)
        XCTAssertNil(textures.selectStandardTntBonusParticle(random:{XCTFail("Unadmitted caller must not draw");return 0},current:{false}))
    }
    func testStandardTntParticleSelectionTextureRetirementReentryCannotPublishAReplacement()async throws {
        let textures=NativeSourceHUDStarTexturePreparation();_=try await prepare(textures);defer{textures.dispose()}
        var draws=0
        XCTAssertNil(textures.selectStandardTntBonusParticle(random:{draws+=1;textures.dispose();return 0.4},current:{true}))
        XCTAssertEqual(draws,1)
    }

}
