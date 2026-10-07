import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeJuicePresentationTests: XCTestCase {
    func testIndependentJuicePartsMatchExecutedOriginalSourcePlans() {
        let plans = NativeJuicePropMotion.make(viewport: CGSize(width: 390,height: 844),random: { 0.5 })
        XCTAssertEqual(plans.map(\.prop),[.cup,.lid,.straw])
        let x: [CGFloat] = [101.4,292.2,195],delays = [0.02,0.53,0.275],durations = [1.93,2.85,2.39]
        let midX: [CGFloat] = [109.13336982292748,300.2308071238093,208.85562093274504],midY: [CGFloat] = [430.5666,444.155,407.441]
        for (index,plan) in plans.enumerated() {
            XCTAssertEqual(plan.startX,x[index],accuracy: 0.000001)
            XCTAssertEqual(plan.delay,delays[index],accuracy: 0.000001); XCTAssertEqual(plan.duration,durations[index],accuracy: 0.000001)
            let midpoint = plan.sample(progress: 0.5)
            XCTAssertEqual(midpoint.point.x,midX[index],accuracy: 0.000001); XCTAssertEqual(midpoint.point.y,midY[index],accuracy: 0.000001)
            XCTAssertLessThanOrEqual(plan.delay+plan.duration,3.45)
            var previousY = CGFloat.infinity
            for step in 0...100 {
                let point = plan.sample(progress: CGFloat(step)/100).point
                XCTAssertLessThanOrEqual(point.y,previousY)
                XCTAssertGreaterThanOrEqual(point.x,plan.horizontalMargin-0.001)
                XCTAssertLessThanOrEqual(point.x,390-plan.horizontalMargin+0.001)
                previousY = point.y
            }
        }
    }
    func testEveryJuiceBubbleRouteMatchesExecutedOriginalBodyAndKeepsItsBirthClock() {
        let plan = NativeJuiceBubbleMotion.make(viewport: CGSize(width: 390,height: 844),random: {0.5})
        XCTAssertEqual(plan.assetIndex,6); XCTAssertEqual(plan.start,CGPoint(x:195,y:886.2))
        XCTAssertEqual(plan.duration,1.6,accuracy:0.000001)
        XCTAssertEqual(plan.scale,0.21083125,accuracy:0.000001); XCTAssertEqual(plan.finalScale,0.2484796875,accuracy:0.000001)
        let x: [CGFloat] = [195,249.6,144.768,237.588,161.148,195]
        let y: [CGFloat] = [886.2,700.098,493.318,265.86,59.08,-147.7]
        for index in plan.path.indices {
            XCTAssertEqual(plan.path[index].x,x[index],accuracy:0.000001)
            XCTAssertEqual(plan.path[index].y,y[index],accuracy:0.000001)
        }
        XCTAssertEqual(plan.sample(seconds:0).point,plan.start)
        XCTAssertEqual(plan.sample(seconds:plan.duration).point.y,-147.7,accuracy:0.000001)
    }
    func testOverlappingTextBubbleTracksMatchExecutedGSAPAtActualFrames() {
        let plans = NativeTextBubbleMotion.make(viewport: CGSize(width:390,height:844),random:{0.5})
        XCTAssertEqual(plans.count,14); XCTAssertEqual(plans[0].birth,CGPoint(x:250,y:473)); XCTAssertEqual(plans[0].size,85)
        var player = NativeTextBubbleMotion.Player(plans[0])
        // Independent installed-GSAP source execution in 5ms steps. The reset
        // between bursts and the preceding pop genuinely overlap in source.
        let expected: [Int:(CGFloat,CGFloat,CGFloat)] = [
            30:(473,1.01,0.74),80:(386,1.01,0.65),112:(371,1.008289,0.49421),
            120:(371,1.114817,0.207322),124:(473,1.000883,0.684712),132:(473,0.999928,0.709287),
            140:(459.738532,0.9999,0.689899),160:(410.190216,0.9999,0.614798),
            180:(393.83,1.009252,0.544475),188:(473,0.3,0)]
        for step in 0...188 {
            let pose = player.sample(seconds:Double(step)*0.005)
            if let golden = expected[step] {
                XCTAssertEqual(pose.y,golden.0,accuracy:0.000001); XCTAssertEqual(pose.scale,golden.1,accuracy:0.000001)
                XCTAssertEqual(pose.alpha,golden.2,accuracy:0.000001)
            }
        }
    }
    func testFiniteJuiceRendererEmitsAllSourceBubblesAndReleasesExactlyOnce() {
        let root = Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let textures = NativeBoardTextures(root:root),scene = SKScene(size:CGSize(width:390,height:844))
        let owner = NativeJuiceFinale(textures:textures,viewport:scene.size,random:{0.5});scene.addChild(owner)
        XCTAssertTrue(owner.assetReady)
        var completed = 0,released = 0,retiredGlyphs = 0,cues:[String] = []
        owner.onCue = {cue,_ in cues.append(cue)}; owner.onGameplayReady = {released += 1}
        owner.onGlyphClock = {_,finished in if finished {retiredGlyphs += 1}}
        owner.play {completed += 1}; XCTAssertEqual(owner.activeBubbleCount,9)
        var largestPool = 9
        for step in 1...330 {
            owner.paint(seconds:Double(step)/60); largestPool = max(largestPool,owner.activeBubbleCount)
            if step == 111 { XCTAssertEqual(released,0) }
            if step == 112 { XCTAssertEqual(released,1); XCTAssertEqual(completed,0) }
        }
        XCTAssertEqual(owner.spawnedBubbleCount,66); XCTAssertLessThanOrEqual(largestPool,34)
        XCTAssertEqual(Set(cues),Set(["bubble","introBubble","cup","lid","straw"]))
        XCTAssertEqual(completed,1); XCTAssertEqual(released,1); XCTAssertEqual(retiredGlyphs,1)
        XCTAssertNil(owner.parent); XCTAssertFalse(owner.hasActiveClock); XCTAssertTrue(owner.children.isEmpty)
        owner.dispose(); owner.paint(seconds:6); XCTAssertEqual(completed,1); XCTAssertEqual(cues.count,5)
        textures.dispose()
    }
    func testJuiceDisposedBeforeReleaseCannotCallStaleGameplayReadiness() {
        let root = Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),textures = NativeBoardTextures(root:root)
        let owner = NativeJuiceFinale(textures:textures,viewport:CGSize(width:390,height:844),random:{0.5})
        var releases = 0,finishes = 0; owner.onGameplayReady = {releases += 1}; owner.play {finishes += 1}
        owner.paint(seconds:0.5);owner.dispose();owner.paint(seconds:2);owner.dispose()
        XCTAssertEqual(releases,0);XCTAssertEqual(finishes,1);XCTAssertFalse(owner.hasActiveClock)
        textures.dispose()
    }
    func testFiniteUIKitOwnerDisposedFromInitialReadinessCannotCreateDetachedClock() {
        let owner = DisposeOnInitialPaint(viewport:CGSize(width:390,height:844),duration:1)
        var finished = 0; owner.onFinished = {_ in finished += 1}; owner.start()
        XCTAssertEqual(finished,1);XCTAssertFalse(owner.hasActiveClock);owner.start();owner.dispose();XCTAssertEqual(finished,1)
    }
}

@MainActor
private final class DisposeOnInitialPaint: NativeFinitePresentation {
    override func paint(seconds: TimeInterval) { dispose() }
}
