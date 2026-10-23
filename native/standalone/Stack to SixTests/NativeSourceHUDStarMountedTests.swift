import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceHUDStarMountedTests:XCTestCase {
    @MainActor private final class Fixture {
        let engine:NativeGameplayEngine,service:NativeSourceAnimationClockService,scene:SKScene,view:SKView
        let timeouts=NativeSourceAppTimeoutOwner()
        var wall=0.0,seed:UInt32=1,acquires=0,releases=0,arrivals=0,retired=0,launches=0,current=true
        var arrivalSizes:[Double]=[]
        var owner:NativeSourceHUDStarPresentation?
        init(count:Int=3,sourceFrameTransportEnabled:Bool=false,combo:Int?=nil,archetype:NativeWildArchetype = .star,variant:String?=nil,finalMerge:Bool=true) {
            var star=NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:archetype,variant:variant);star.starOrbitCount=count
            var state=NativeBoardState(tiles:[star,.init(id:"d",cell:.init(column:1,row:0),value:2)])
            if !finalMerge {state.tiles.append(.init(id:"other",cell:.init(column:2,row:0),value:1))}
            state.combo=combo ?? 0
            engine=NativeGameplayEngine(state:state)
            engine.comboHUDCoinRewardsEnabled=combo != nil
            XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            engine.sourceHUDStarJobsEnabled=true
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:sourceFrameTransportEnabled)
            scene=SKScene(size:.init(width:390,height:844));view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.ignoresSiblingOrder=false;view.presentScene(scene);view.isPaused=true
        }
        func mount(_ prepared:NativeSourceHUDStarTexturePreparation.Prepared)->Bool {
            owner=NativeSourceHUDStarPresentation(stage:scene,viewportHeight:844,texture:prepared.texture,pixelSize:prepared.pixelSize,selectedAssetsReady:prepared.current,service:service,timeouts:timeouts,engine:engine,bindings:.init(current:{[weak self] in self?.current==true},random:{[unowned self] in self.seed=self.seed &* 1664525 &+ 1013904223;return Double(self.seed)/4294967296},acquireCadence:{[unowned self] in self.acquires += 1;return{self.releases += 1}},onArrival:{[unowned self] result,size in XCTAssertTrue(result.accepted);self.arrivalSizes.append(size);self.arrivals += 1},onRetired:{[unowned self] _ in self.retired += 1},onTntCoinLaunch:{[unowned self] in self.launches += 1}))
            return owner?.start(receiptIDs:engine.pendingHUDStars.map(\.id),screenOrigin:.init(x:195,y:430),hudTarget:.init(x:37,y:76))==true
        }
        func deliver(_ wall:Double){self.wall=wall;service.deliver(wallMilliseconds:wall)}
        func dispose(){owner?.dispose();owner=nil;timeouts.cancelAll();service.dispose();view.presentScene(nil)}
    }
    private func prepare(_ owner:NativeSourceHUDStarTexturePreparation)async throws->NativeSourceHUDStarTexturePreparation.Prepared {
        let ready=expectation(description:"Original coin-hud decode + actual SKTexture preload")
        var receipt:NativeSourceHUDStarTexturePreparation.Prepared?
        owner.prepare(root:NativeTestResources.root,current:{true}){receipt=$0;ready.fulfill()}
        await fulfillment(of:[ready],timeout:20)
        return try XCTUnwrap(receipt)
    }
    func testFinalMountedCoinsUseNormalFlightSpeedAndCreditOnce() async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures)
        let final=Fixture(finalMerge:true),normal=Fixture(finalMerge:false)
        defer{final.dispose();normal.dispose();textures.dispose()}
        XCTAssertTrue(final.engine.pendingHUDStars.allSatisfy(\.isFinalMerge))
        XCTAssertTrue(final.mount(prepared));XCTAssertTrue(normal.mount(prepared))
        let score=final.engine.state.score
        for ms in stride(from:0.0,through:3000,by:10) {
            final.deliver(ms);normal.deliver(ms)
            XCTAssertEqual(final.arrivals,normal.arrivals,"Final coins share the normal arrival clock")
            let a=final.owner?.mountedContainer?.children ?? [],b=normal.owner?.mountedContainer?.children ?? []
            XCTAssertEqual(a.count,b.count)
            for (x,y) in zip(a,b) {
                XCTAssertEqual(x.position.x,y.position.x,accuracy:0.001)
                XCTAssertEqual(x.position.y,y.position.y,accuracy:0.001)
            }
        }
        XCTAssertEqual(final.arrivals,3);XCTAssertEqual(final.engine.state.score,score+300)
        XCTAssertTrue(final.engine.pendingHUDStars.isEmpty)
        final.deliver(8000);XCTAssertEqual(final.arrivals,3)
    }
    func testArrivalCarriesActualFlightSizeBeforeCommonTrophyShrink() async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture()
        defer{f.dispose();textures.dispose()}
        XCTAssertTrue(f.mount(prepared))
        let expected=try XCTUnwrap(f.owner?.mountedContainer).children.compactMap{$0 as? SKSpriteNode}.map {
            NativeSourceHUDStarPlan.relativeCoinSize(Double($0.frame.width),enlargement:1.2)
        }.sorted()
        XCTAssertEqual(expected.count,3);XCTAssertGreaterThan(expected.last!-expected.first!,0.8)
        for ms in stride(from:0.0,through:8000,by:10){f.deliver(ms)}
        XCTAssertEqual(f.arrivals,3);XCTAssertEqual(f.arrivalSizes.count,3)
        // SpriteKit frame bounds quantize to float;0.0001 fraction is under0.004pt.
        for (actual,size) in zip(f.arrivalSizes.sorted(),expected){XCTAssertEqual(actual,size,accuracy:0.0001)}
        f.owner?.dispose();f.deliver(9000);XCTAssertEqual(f.arrivalSizes.count,3,"Retired flights cannot replay coin contact")
    }

    func testAllTntFamiliesSoundOnlyOnFirstVisibleCoinFrameAndCancelSilently()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures)
        defer{textures.dispose()}
        for variant in [nil,"flower","barell","laser-gun","beach-ball"] as [String?] {
            let f=Fixture(combo:24,archetype:.tnt,variant:variant)
            XCTAssertTrue(f.mount(prepared));XCTAssertEqual(f.launches,0)
            for ms in stride(from:0.0,through:5000,by:10){f.deliver(ms)}
            XCTAssertEqual(f.launches,1,"\(variant ?? "tnt") must sound once for the batch")
            XCTAssertEqual(f.arrivals,7);f.dispose()
            let cancelled=Fixture(combo:24,archetype:.tnt,variant:variant)
            XCTAssertTrue(cancelled.mount(prepared));cancelled.owner?.dispose();cancelled.deliver(1000)
            XCTAssertEqual(cancelled.launches,0);cancelled.dispose()
        }
        let star=Fixture(combo:24);XCTAssertTrue(star.mount(prepared));star.deliver(100)
        XCTAssertEqual(star.launches,0);star.dispose()
    }

    func testSevenComboCoinsMountArriveExactlyOnceAndDispose()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture(combo:24,finalMerge:false)
        defer{f.dispose();textures.dispose()}
        let score=f.engine.state.score
        XCTAssertTrue(f.mount(prepared));XCTAssertEqual(f.owner?.mountedContainer?.children.count,7)
        for ms in stride(from:0.0,through:100,by:10){f.deliver(ms)}
        let sprites=try XCTUnwrap(f.owner?.mountedContainer).children
        XCTAssertEqual(sprites.filter{$0.alpha>0}.count,2,"The first compact pair launches while later pairs remain at source")
        XCTAssertEqual(sprites.filter{$0.alpha==0}.count,5)
        for ms in stride(from:110.0,through:8000,by:10){f.deliver(ms)}
        XCTAssertEqual(f.arrivals,7);XCTAssertEqual(f.engine.state.score,score+700)
        XCTAssertTrue(f.engine.pendingHUDStars.isEmpty)
        f.owner?.dispose();XCTAssertTrue(f.engine.sourceHUDStarJobs.isEmpty)
        XCTAssertEqual(f.releases,1)
    }
    func testOriginalTextureMountedProtectedStagePathAndGenuine98ArrivalOnce()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture();defer{f.dispose();textures.dispose()}
        let coin=try XCTUnwrap(UIImage(contentsOfFile:NativeTestResources.root.appendingPathComponent("assets/hud/coin-hud.png").path))
        XCTAssertEqual(prepared.pixelSize,coin.size,"HUD flights must prepare the requested coin artwork")
        let score=f.engine.state.score;XCTAssertTrue(f.mount(prepared));let container=try XCTUnwrap(f.owner?.mountedContainer)
        XCTAssertTrue(container.parent === f.scene);XCTAssertEqual(container.zPosition,999999);XCTAssertEqual(container.children.count,3)
        for child in container.children {let sprite=try XCTUnwrap(child as? SKSpriteNode);XCTAssertTrue(sprite.texture === prepared.texture);XCTAssertEqual(sprite.anchorPoint,.init(x:0.5,y:0.5))}
        for ms in stride(from:0.0,through:350,by:10){f.deliver(ms)}
        XCTAssertEqual(container.children.count,3)
        for node in container.children {
            let sprite=try XCTUnwrap(node as? SKSpriteNode)
            XCTAssertTrue(sprite.position.x.isFinite && sprite.position.y.isFinite)
            XCTAssertGreaterThan(sprite.xScale*prepared.pixelSize.width,34)
        }
        XCTAssertEqual(f.arrivals,0,"Larger staggered coins must still be visible at350ms")
        for ms in stride(from:360.0,through:5000,by:10){f.deliver(ms)}
        XCTAssertEqual(f.arrivals,3);XCTAssertEqual(f.engine.state.score,score+300);XCTAssertTrue(f.engine.pendingHUDStars.isEmpty)
        XCTAssertEqual(f.owner?.pendingJobCount,1);XCTAssertEqual(f.releases,0) // wall is independent of this manually delivered Source phase.
        f.deliver(5200);XCTAssertEqual(f.arrivals,3);XCTAssertEqual(f.engine.state.score,score+300)
    }
    func testActualAppRAFTransportPaintsEvery60HzFlightSampleWithoutAlternatingFrozenFrames()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures)
        let f=Fixture(count:1,sourceFrameTransportEnabled:true,finalMerge:false)
        defer{f.dispose();textures.dispose()}
        XCTAssertEqual(f.service.source60HzRenderDemandCount,0)
        XCTAssertTrue(f.mount(prepared))
        XCTAssertEqual(f.service.source60HzRenderDemandCount,1)
        XCTAssertEqual(f.service.sourceTransportFrameRateRange?.minimum,60)
        let container=try XCTUnwrap(f.owner?.mountedContainer)
        let sprite=try XCTUnwrap(container.children.first as? SKSpriteNode)
        var previous:CGPoint?,changed=0
        for frame in 0...42 {
            f.deliver(Double(frame)*1000/60)
            guard frame>=12 else{continue}
            if let previous {
                XCTAssertNotEqual(sprite.position,previous,"APP RAF must paint each 60 Hz delivery, not every other renderer frame")
                changed += 1
            }
            previous=sprite.position
        }
        XCTAssertEqual(changed,30)
        XCTAssertTrue(sprite.parent === container)
        XCTAssertEqual(f.arrivals,0)
        XCTAssertEqual(f.acquires,1)
        XCTAssertEqual(f.releases,0)
        XCTAssertEqual(f.service.displayLinkCreationCount,1)
        f.owner?.dispose()
        XCTAssertEqual(f.releases,1)
        XCTAssertEqual(f.service.source60HzRenderDemandCount,0)
        XCTAssertTrue(f.engine.pendingHUDStars.isEmpty)
    }
    func testGlobalPauseWallCleanupDiscardsNoRewardAndReleasesAfterRealJobThen120()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture();defer{f.dispose();textures.dispose()}
        let score=f.engine.state.score;XCTAssertTrue(f.mount(prepared));XCTAssertTrue(f.service.setSourceGlobalPaused(true))
        f.deliver(650);XCTAssertEqual(f.arrivals,0);XCTAssertEqual(f.engine.pendingHUDStars.count,3)
        f.engine.cancelForBackground();XCTAssertEqual(f.engine.state.score,score);XCTAssertEqual(f.engine.pendingHUDStars.count,3)
        let wall=expectation(description:"Actual independent job wall + empty container120")
        DispatchQueue.main.asyncAfter(deadline:.now()+5){wall.fulfill()};await fulfillment(of:[wall],timeout:6)
        XCTAssertEqual(f.arrivals,0);XCTAssertEqual(f.engine.state.score,score);XCTAssertTrue(f.engine.pendingHUDStars.isEmpty)
        XCTAssertEqual(f.retired,1);XCTAssertEqual(f.releases,1);XCTAssertNil(f.owner?.mountedContainer)
        XCTAssertEqual(f.service.source60HzRenderDemandCount,0)
    }
    func testExplicitDisposalAndLateSourceDeliveryNeverAwardOrAffectNewGeneration()async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture();defer{f.dispose();textures.dispose()}
        XCTAssertTrue(f.mount(prepared));f.deliver(300);f.owner?.dispose();f.engine.restart(state:.init(tiles:[]))
        let state=f.engine.state;f.deliver(5200);XCTAssertEqual(f.engine.state,state);XCTAssertEqual(f.arrivals,0)
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
        var animatedSprites=0
        scene.enumerateChildNodes(withName:"//source-hud-star:*") {node,_ in
            guard let sprite=node as? SKSpriteNode else{return}
            XCTAssertTrue(prepared.coinAnimations.contains{animation in animation.frames.contains{$0 === sprite.texture}})
            animatedSprites+=1
        }
        XCTAssertEqual(animatedSprites,3)
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

    func testSixSharedSVGVariantsAnimateOnExistingClockAndReleaseWithFlight() async throws {
        let textures=NativeSourceHUDStarTexturePreparation(),prepared=try await prepare(textures),f=Fixture()
        defer{f.dispose();textures.dispose()}
        XCTAssertEqual(prepared.coinAnimations.map{ $0.frames.count },[30,30,30,120,120,120])
        for animation in prepared.coinAnimations {
            XCTAssertTrue(animation.texture(at:0) === animation.texture(at:animation.duration))
            XCTAssertFalse(animation.texture(at:0) === animation.texture(at:1.0/60))
        }
        var choices=0
        f.owner=NativeSourceHUDStarPresentation(stage:f.scene,viewportHeight:844,texture:prepared.texture,
            pixelSize:prepared.pixelSize,selectedAssetsReady:true,service:f.service,timeouts:f.timeouts,engine:f.engine,
            bindings:.init(current:{f.current},random:{0.5},acquireCadence:{ {} },
                onArrival:{_,_ in f.arrivals+=1},onRetired:{_ in}),coinAnimations:prepared.coinAnimations,
            selectCoinVariant:{defer{choices+=1};return choices})
        XCTAssertTrue(f.owner!.start(receiptIDs:f.engine.pendingHUDStars.map(\.id),screenOrigin:.init(x:195,y:430),hudTarget:.init(x:37,y:76)))
        XCTAssertEqual(choices,3)
        let container=try XCTUnwrap(f.owner?.mountedContainer)
        let sprites=container.children.compactMap{$0 as? SKSpriteNode}
        XCTAssertEqual(sprites.count,3)
        for (index,sprite) in sprites.enumerated(){XCTAssertTrue(sprite.texture === prepared.coinAnimations[index].frames[0])}
        let first=try XCTUnwrap(sprites.first),initial=first.texture
        for ms in stride(from:0.0,through:350,by:10){f.deliver(ms)}
        XCTAssertFalse(first.texture === initial)
        let paused=first.texture
        XCTAssertTrue(f.service.setSourceGlobalPaused(true));f.deliver(450)
        XCTAssertTrue(first.texture === paused)
        XCTAssertTrue(f.service.setSourceGlobalPaused(false))
        for ms in stride(from:460.0,through:5200,by:10){f.deliver(ms)}
        XCTAssertEqual(f.arrivals,3);XCTAssertEqual(choices,3)
        f.owner?.dispose();f.owner?.dispose();f.deliver(6000)
        XCTAssertTrue(container.children.isEmpty);XCTAssertTrue(f.engine.sourceHUDStarJobs.isEmpty)
    }

}
