import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeTntVariantTests: XCTestCase {
    private final class Random {
        var value:UInt32;var draws=0
        init(_ seed:UInt32){value=seed}
        func next()->Double{draws += 1;value=value &* 1664525 &+ 1013904223;return Double(value)/4294967296}
    }
    private func compare(_ actual:[Double],_ expected:[Double],accuracy:Double=0.00000001,file:StaticString=#filePath,line:UInt=#line) {
        XCTAssertEqual(actual.count,expected.count,file:file,line:line)
        for index in actual.indices { XCTAssertEqual(actual[index],expected[index],accuracy:accuracy,"field \(index)",file:file,line:line) }
    }
    private func values(_ plan:NativeTntFinale.DiePlan)->[Double] {
        [Double(plan.value),plan.size,plan.depth,plan.angle,plan.distance,plan.curve,plan.startX,plan.startY,plan.startRotation,plan.rotationTravel,plan.startScale,plan.peakScale,plan.endScale,plan.delay,plan.duration]
    }
    func testFlowerMatches216IndependentSourceParticlesIncludingEntropyAndDepth() {
        for fixture in NativeTntVariantOracle.flowers {
            let random=Random(fixture.seed),plans=NativeTntVariantPlanning.flowers(random:random.next)
            XCTAssertEqual(plans.count,fixture.plans.count);XCTAssertEqual(random.draws,fixture.draws)
            for (index,plan) in plans.enumerated() {
                var actual=plan.oracleValues;actual[3]=atan2(sin(plan.angle),cos(plan.angle));compare(actual,fixture.plans[index])
                XCTAssertEqual(NativeTntVariantPlanning.flowerPose(plan,time:plan.delay+plan.duration*0.279).depth,plan.depth)
                XCTAssertEqual(NativeTntVariantPlanning.flowerPose(plan,time:plan.delay+plan.duration*0.281).depth,8.5)
                XCTAssertEqual(NativeTntVariantPlanning.flowerPose(plan,time:plan.delay+plan.duration).alpha,0,accuracy:0.000001)
            }
        }
    }
    func testBarrelMatches256CollisionAwareWoodAndDicePathsAndShuffleDraws() {
        for fixture in NativeTntVariantOracle.barrels {
            let random=Random(fixture.seed),wood=NativeTntFinale.makeDiePlans(random:random.next)
            let dice=NativeTntVariantPlanning.barrelDice(wood:wood,random:random.next)
            let order=NativeTntVariantPlanning.woodSourceOrder(random:random.next)
            XCTAssertEqual(random.draws,fixture.draws);XCTAssertEqual(order,fixture.order)
            for index in wood.indices { compare(values(wood[index]),fixture.wood[index]);compare(values(dice[index]),fixture.dice[index]) }
        }
    }
    func testBallMatchesOriginalRandomPlansAnd72ActualGSAPPlayheadSamples() {
        for fixture in NativeTntVariantOracle.balls {
            let random=Random(fixture.seed),plan=NativeBeachBallPlanning.ball(width:fixture.width,height:fixture.height,random:random.next)
            compare(plan.oracleValues,fixture.values);XCTAssertEqual(random.draws,fixture.draws)
            for sample in fixture.samples {
                let pose=NativeBeachBallPlanning.pose(plan,time:sample[0])
                // GSAP rounds tween start times and scalar output; positional
                // samples agree within one thousandth of an original point.
                XCTAssertEqual(pose.x,sample[1],accuracy:0.001)
                XCTAssertEqual(pose.y,sample[2],accuracy:0.001)
                compare([pose.scaleX,pose.scaleY,pose.rotation],Array(sample[3...5]),accuracy:0.00001)
            }
        }
    }
    private func resourceRoot()->URL {
        NativeTestResources.root
    }
    func testFlowerAndBarrelCommitAndSequenceReceiptsAreSeparateAndExactlyOnce() {
        for variant in [NativeTntVariantPresentation.Variant.flower,.barell] {
            let owner=NativeTntVariantPresentation(resourceRoot:resourceRoot(),variant:variant,viewport:CGSize(width:390,height:844),random:{0.5})
            var frame6=0,sequences=0,cues:[String]=[]
            owner.onSprite6Entered={frame6 += 1};owner.onVisualSequenceComplete={sequences += 1};owner.onCue={name,_ in cues.append(name)}
            owner.paint(seconds:0.50);XCTAssertEqual(frame6,0)
            owner.paint(seconds:0.51);owner.paint(seconds:0.52);XCTAssertEqual(frame6,1);XCTAssertEqual(sequences,0)
            owner.paint(seconds:1.6);owner.paint(seconds:2);owner.paint(seconds:3);XCTAssertEqual(sequences,1)
            XCTAssertEqual(cues,variant == .flower ? ["leaves","spark"]:["smoke"])
            owner.dispose();owner.paint(seconds:4);XCTAssertEqual(frame6,1);XCTAssertEqual(sequences,1)
        }
    }
    func testBallReleaseAtStartAndFiniteCompletionCancelWithoutLateReceipts() {
        let owner=NativeBeachBallPresentation(resourceRoot:resourceRoot(),viewport:CGSize(width:390,height:844),random:{0.5})
        var releases=0,sequences=0,finished:[Bool]=[]
        owner.onGameplayReady={releases += 1};owner.onVisualSequenceComplete={sequences += 1};owner.onFinished={finished.append($0)}
        owner.paint(seconds:0);owner.paint(seconds:0);XCTAssertEqual(releases,1)
        for frame in 1...312 { owner.paint(seconds:Double(frame)/60) }
        XCTAssertEqual(sequences,1);XCTAssertEqual(finished,[true])
        owner.dispose();owner.paint(seconds:10);XCTAssertEqual(releases,1);XCTAssertEqual(sequences,1)
        let cancelled=NativeBeachBallPresentation(resourceRoot:resourceRoot(),viewport:CGSize(width:390,height:844),random:{0.5})
        cancelled.onGameplayReady={ XCTFail("disposed owner cannot release gameplay") }
        cancelled.dispose();cancelled.paint(seconds:1)
    }
    func testSelectedVariantArtworkFamiliesPreserveOriginalFilesAndBoundedInventory() {
        XCTAssertEqual(NativeTntVariantPresentation.assets(.flower).count,15)
        XCTAssertEqual(NativeTntVariantPresentation.assets(.barell).count,19)
        XCTAssertEqual(NativeBeachBallPresentation.assets.count,6)
        for asset in NativeTntVariantPresentation.assets(.flower)+NativeTntVariantPresentation.assets(.barell)+NativeBeachBallPresentation.assets {
            XCTAssertTrue(FileManager.default.fileExists(atPath:resourceRoot().appendingPathComponent(asset).path),asset)
        }
    }
}
