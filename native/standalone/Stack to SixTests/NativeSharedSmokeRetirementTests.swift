import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeSharedSmokeRetirementTests:XCTestCase {
    func testScopeAcquisitionRetiringRendererRejectsBeforeHotRandomAndPuffRoots() {
        for grouped in [false,true] {
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
            runtime.setGlobalPaused(true)
            var draws=0,releases=0,acquisitions=0
            let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{draws += 1;return 0.5})
            let renderer=NativeSharedSmokeRootRenderer(session:session,scheduler:NativeSharedSmokeValueRootScheduler(runtime:runtime),sourceClockNow:{0})
            let canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
            var recipe=NativeSharedSmokeRecipe();recipe.groupedOwner=grouped;recipe.activityLeaseLabel="regular-merge6-smoke"
            let rejected=renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:{_ in
                acquisitions += 1;renderer.dispose();return{releases += 1}
            })
            XCTAssertNil(rejected);XCTAssertEqual(acquisitions,1);XCTAssertEqual(releases,1)
            XCTAssertEqual(draws,0);XCTAssertEqual(session.pool.activeCount,0)
            XCTAssertEqual(runtime.activeCount,0,"No paused grouped body or child tail survives rejected construction")
            XCTAssertEqual(renderer.activeOwnerCount,0);XCTAssertEqual(canvas.children.count,1)
            XCTAssertTrue(canvas.children[0] === tile)
            XCTAssertNil(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:{_ in XCTFail("Terminal renderer cannot reacquire");return nil}))
            XCTAssertEqual(draws,0);renderer.dispose();runtime.dispose();XCTAssertEqual(releases,1)
        }
    }
    func testNormalTagCleanupRetainsSourceTailButTerminalRendererCancelsItWhilePaused()throws {
        for grouped in [false,true] {
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
            runtime.setGlobalPaused(true)
            let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{0.5})
            let renderer=NativeSharedSmokeRootRenderer(session:session,scheduler:NativeSharedSmokeValueRootScheduler(runtime:runtime),sourceClockNow:{0})
            let canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
            var recipe=NativeSharedSmokeRecipe();recipe.groupedOwner=grouped;recipe.fxTag="A";recipe.maxParticles=6;recipe.activityLeaseLabel="regular-merge6-smoke"
            var release=0,finished=0
            let a=try XCTUnwrap(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:{_ in return{release += 1}}))
            let prior=a.onFinished;a.onFinished={success in prior?(success);finished += 1;XCTAssertFalse(success)}
            renderer.cleanup(tag:"A")
            XCTAssertEqual(finished,1);XCTAssertEqual(release,1)
            XCTAssertEqual(renderer.activeOwnerCount,0);XCTAssertEqual(session.pool.activeCount,0)
            XCTAssertGreaterThan(runtime.activeCount,0,"Literal empty timeline survives ordinary cleanup until next source traversal")
            renderer.dispose();renderer.dispose()
            XCTAssertEqual(runtime.activeCount,0,"Authoritative renderer cleanup also owns retired tails")
            XCTAssertEqual(release,1);XCTAssertEqual(finished,1);runtime.dispose()
        }
    }
    func testRetiredTailDrainsOnActualSourceTraversalWithoutRetainingItsCarrier()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{0.5})
        let renderer=NativeSharedSmokeRootRenderer(session:session,scheduler:NativeSharedSmokeValueRootScheduler(runtime:runtime),sourceClockNow:{runtime.animationSeconds*1000})
        let canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        var recipe=NativeSharedSmokeRecipe();recipe.fxTag="A";recipe.maxParticles=6
        var a:NativeSharedSmokeRootSpritePresentation?=try XCTUnwrap(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:{_ in nil}))
        weak var captured=a
        renderer.cleanup(tag:"A");a=nil
        XCTAssertNotNil(captured,"Bounded retention exists only for the original linked tail")
        runtime.deliver(wallMilliseconds:17)
        XCTAssertEqual(runtime.activeCount,0);XCTAssertNil(captured)
        XCTAssertEqual(session.pool.activeCount,0);renderer.dispose();runtime.dispose()
    }
    func testRetiringOldGenerationDoesNotCancelNewGenerationRootsOrPooledArtwork()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0);runtime.setGlobalPaused(true)
        let session=NativeSharedSmokeRootSession(appOriginMilliseconds:0,visualRandom:{0.5})
        let renderer=NativeSharedSmokeRootRenderer(session:session,scheduler:NativeSharedSmokeValueRootScheduler(runtime:runtime),sourceClockNow:{0})
        let canvas=SKNode(),tile=SKNode();canvas.addChild(tile)
        var recipe=NativeSharedSmokeRecipe();recipe.fxTag="A";recipe.maxParticles=6
        _=try XCTUnwrap(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:1,origin:.zero,renderScale:1,monotonicMilliseconds:1000,reduced:false,current:{_ in true},acquireActivity:{_ in nil}))
        renderer.cleanup(tag:"A");recipe.fxTag="C"
        let c=try XCTUnwrap(renderer.admit(recipe:recipe,canvas:canvas,tile:tile,generation:2,origin:.zero,renderScale:1,monotonicMilliseconds:1100,reduced:false,current:{_ in true},acquireActivity:{_ in nil}))
        let roots=c.activeRootCount,nodes=c.layer.children.map(ObjectIdentifier.init)
        renderer.retire(generation:1)
        XCTAssertEqual(runtime.activeCount,roots);XCTAssertFalse(c.disposed)
        XCTAssertEqual(c.layer.children.map(ObjectIdentifier.init),nodes)
        XCTAssertTrue(c.layer.parent === canvas)
        renderer.dispose();XCTAssertEqual(runtime.activeCount,0);XCTAssertEqual(session.pool.activeCount,0);runtime.dispose()
    }
}
