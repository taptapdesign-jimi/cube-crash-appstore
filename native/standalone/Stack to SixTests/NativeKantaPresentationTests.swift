import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeKantaPresentationTests: XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    // Recorded by executing the original TypeScript RAF owner with the same
    // seeded LCG; these are independent source poses, not Swift snapshots.
    func testFourRobotElevenCanThreePilePosesMatchOriginalSource() {
        let cases:[(UInt32,Double,[Double])]=[
(1,0.75,[-5.69,207.83,1,1,-1.16,1,-138.92,223.22,1,1,-2.08,1,259.85,242.56,1,1,-1.8,1,-429.25,275.53,0.854,0.854,12.55,1,-28.77,206.89,1.1919,1.1919,-33.1,1,-32.34,212.3,1,1,4.05,1,37.85,222.94,1,1,-2.28,1,107.41,224.14,1,1,15.64,1,-117.34,247.95,1,1,-17.41,1,-57.15,202.93,1,1,10.63,1,22.41,282.03,1,1,-3.47,1,80.05,108.53,1.1622,1.1379,50.29,1,122.85,261.11,1,1,17.63,1,-75.59,294.56,1,1,-10.47,1,-1.12,180.35,1.1647,1.0071,18.38,1,-105.05,346.02,1.0001,1.0001,0,1,0,367.36,1.0001,1.0001,0,1,105.05,346.02,1.0001,1.0001,0,1]),
(17,1.72,[-421.04,209.41,1,1,-2.16,0,460.36,222.81,1,1,7,0,-292.06,236.95,1,1,-7.59,1,174.19,263.25,1,1,-2.75,1,0,484.23,1.2,1.2,-12.85,0,-3.69,332.52,1.1982,1.1982,-13.61,1,70.2,486.99,1.2,1.2,-9.38,0,85.05,115.68,1.1959,1.0174,24.87,1,-101.4,496.67,1.2,1.2,-18,0,2.42,148.87,1.186,1.186,-20.06,1,0.94,179.35,1.1526,1.1526,-35.59,1,124.2,500.82,1.2,1.2,11,0,-70.2,493.91,1.2,1.2,17,0,0,511.89,1.2,1.2,-11,0,101.4,521.57,1.2,1.2,3,0,-104.37,313.94,1.0588,0.9618,0,1,0.63,336.83,1.0588,0.9618,0,1,105.63,313.94,1.0588,0.9618,0,1]),
(32,2.18,[-421.04,207.72,1,1,-5.97,0,460.36,224.84,1,1,5.79,0,-421.04,239.75,1,1,-6.23,0,460.36,268.64,1,1,4.89,0,70.2,484.23,1.2,1.2,-13.93,0,-101.4,488.38,1.2,1.2,8.47,0,101.4,486.99,1.2,1.2,-2.33,0,-70.2,484.23,1.2,1.2,13.27,0,127.92,496.67,1.2,1.2,-18,0,-122.95,502.21,1.2,1.2,10,0,39,487.59,1.2,1.2,-4,0,0,500.82,1.2,1.2,11,0,0,493.91,1.2,1.2,17,0,0,511.89,1.2,1.2,-11,0,-39,521.57,1.2,1.2,3,0,-105,787.68,1,1,0,0,0,787.68,1,1,0,0,105,787.68,1,1,0,0])
]
        for (seed,time,expected) in cases {
            var state=seed
            let motion=NativeKantaFinaleMotion.make(viewport:CGSize(width:390,height:844),random:{
                state=1664525 &* state &+ 1013904223;return Double(state)/4294967296
            })
            XCTAssertEqual(motion.robots.count,4);XCTAssertEqual(motion.cans.count,11);XCTAssertEqual(motion.composites.count,3)
            let poses=motion.robots.indices.map {motion.robotPose($0,seconds:time)}+motion.cans.indices.map {motion.canPose($0,seconds:time)}+motion.composites.indices.map {motion.compositePose($0,seconds:time)}
            let actual=poses.flatMap {[$0.x,$0.y,$0.scaleX,$0.scaleY,$0.rotation,$0.alpha]}
            XCTAssertEqual(actual.count,expected.count)
            for index in actual.indices {XCTAssertEqual(actual[index],expected[index],accuracy:0.000001,"seed\(seed) time\(time) scalar\(index)")}
            let starts=motion.cans.map(\.pickupStart).sorted()
            for pair in zip(starts,starts.dropFirst()) {XCTAssertGreaterThanOrEqual(pair.1-pair.0,0.11-0.000001)}
            XCTAssertLessThanOrEqual((starts.last ?? 0)+NativeKantaFinaleMotion.pickupDuration,2.16+0.000001)
        }
    }
    func testLocalIdleHasThreeReusableBubblesAndDragSettlesOwnedArtwork() {
        let textures=NativeBoardTextures(root:root)
        let idle=NativeKantaDiceIdle(textures:textures,size:CGSize(width:95.81286549707602,height:128),random:{0.5})
        XCTAssertTrue(idle.assetReady);XCTAssertEqual(idle.bubblePoolCount,3)
        for _ in 0..<1800 {idle.tick(1.0/60,globalX:40,viewportCenter:195);XCTAssertLessThanOrEqual(idle.activeBubbleCount,3)}
        idle.setDragging(true);XCTAssertEqual(idle.activeBubbleCount,0)
        for _ in 0..<120 {idle.tick(1.0/60,globalX:350,viewportCenter:195)}
        XCTAssertEqual(idle.activeBubbleCount,0)
        idle.setDragging(false)
        for _ in 0..<30 {idle.tick(1.0/60,globalX:350,viewportCenter:195)}
        XCTAssertGreaterThan(idle.activeBubbleCount,0)
        idle.dispose();idle.tick(1,globalX:40,viewportCenter:195);XCTAssertEqual(idle.bubblePoolCount,0)
        textures.dispose()
    }
    func testFiniteKantaReceiptsFadeAndDisposedClockStayOnce() async {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController()
        window.rootViewController=controller;window.makeKeyAndVisible()
        let owner=NativeKantaFinalePresentation(resourceRoot:root,viewport:window.bounds.size,random:{0.5})
        controller.view.addSubview(owner)
        defer {owner.dispose();window.isHidden=true}
        XCTAssertTrue(owner.assetReady);XCTAssertEqual(owner.subviews.compactMap {$0 as? UIImageView}.count,18)
        var walking=0,exits=Set<Int>(),finishes=0,fade=[Double]()
        let finished=expectation(description:"Kanta source exits and inherited glyph cleanup finish once")
        owner.onCue={cue,index in if cue=="walking" {walking+=1;owner.onAudioFade={fade.append($0)}} else {XCTAssertEqual(cue,"exit");exits.insert(index)}}
        owner.onFinished={success in XCTAssertTrue(success);finishes+=1;finished.fulfill()}
        owner.start();owner.start();XCTAssertEqual(walking,1)
        await fulfillment(of:[finished],timeout:5)
        XCTAssertEqual(exits,Set(0..<14));XCTAssertEqual(finishes,1);XCTAssertFalse(owner.hasActiveClock)
        XCTAssertEqual(fade.last ?? -1,1,accuracy:0.000001)
        for pair in zip(fade,fade.dropFirst()) {XCTAssertLessThanOrEqual(pair.0,pair.1)}
        owner.dispose();owner.paint(seconds:4);XCTAssertEqual(finishes,1);XCTAssertNil(owner.superview)
    }
    func testDisposedCoveredKantaCannotReplayCueOrRetainClock() {
        let owner=NativeKantaFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{0.5})
        var finishes=0,cues=0
        owner.onCue={_,_ in cues+=1};owner.onFinished={success in XCTAssertFalse(success);finishes+=1}
        owner.setSuspended(true);owner.start();XCTAssertTrue(owner.hasActiveClock)
        owner.dispose();owner.setSuspended(false);owner.start();owner.paint(seconds:3)
        XCTAssertEqual(cues,1);XCTAssertEqual(finishes,1);XCTAssertFalse(owner.hasActiveClock)
    }

    func testAbsorbCarrierPreservesAuthoredCanArtworkWithoutAnotherIdleOwner() {
        let textures=NativeBoardTextures(root:root),die=NativeDiceNode(id:"k",value:6,kind:"wild-star",variant:"kanta",depth:1,locked:false,textures:textures)
        defer {die.dispose();textures.dispose()}
        die.setDragging(true)
        let carrier=die.detachedArtworkCarrier()
        func descendants(_ node:SKNode)->[SKNode] {[node]+node.children.flatMap {descendants($0)}}
        XCTAssertFalse(descendants(carrier).contains {$0 is NativeKantaDiceIdle})
        let sprites=descendants(carrier).compactMap {$0 as? SKSpriteNode}.filter {!$0.isHidden && $0.texture != nil}
        XCTAssertGreaterThanOrEqual(sprites.count,2,"Both original front/rear images stay in the finite absorb carrier")
        XCTAssertTrue(descendants(carrier).allSatisfy {!$0.hasActions()})
        die.dispose();XCTAssertTrue(sprites.allSatisfy {$0.texture != nil},"Detached immutable textures remain valid through the80ms absorb")
        carrier.removeAllChildren()
    }
}
