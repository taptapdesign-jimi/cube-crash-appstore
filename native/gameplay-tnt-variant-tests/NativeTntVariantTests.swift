import XCTest
import UIKit
import SpriteKit
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
    func testBallRetainsOriginalRandomDrawsAndFlightPathsWithRequestedSizeAndImpactTreatment() {
        for fixture in NativeTntVariantOracle.balls {
            let random=Random(fixture.seed),plan=NativeBeachBallPlanning.ball(width:fixture.width,height:fixture.height,random:random.next)
            var actual=plan.oracleValues,expected=fixture.values
            actual.remove(at:3);expected.remove(at:3) // User changed size distribution only.
            compare(actual,expected);XCTAssertEqual(random.draws,fixture.draws)
            for sample in fixture.samples {
                let pose=NativeBeachBallPlanning.pose(plan,time:sample[0])
                // GSAP rounds tween start times and scalar output; positional
                // samples agree within one thousandth of an original point.
                XCTAssertEqual(pose.x,sample[1],accuracy:0.001)
                XCTAssertEqual(pose.y,sample[2],accuracy:0.001)
                XCTAssertEqual(pose.rotation,sample[5],accuracy:0.00001)
            }
        }
    }
    func testBallStaysRoundUntilFloorContactThenSquashesAndRecovers() {
        let plan=NativeBeachBallPlanning.ball(width:390,height:844,random:{0.5})
        let impact=plan.duration*0.52
        for time in stride(from:0.0,to:impact,by:1.0/120) {
            let pose=NativeBeachBallPlanning.pose(plan,time:time)
            XCTAssertEqual(pose.scaleX,plan.scale,accuracy:1e-10)
            XCTAssertEqual(pose.scaleY,plan.scale,accuracy:1e-10)
        }
        let compressed=NativeBeachBallPlanning.pose(plan,time:impact+0.0149)
        XCTAssertEqual(compressed.y,plan.floorY,accuracy:1e-8)
        XCTAssertGreaterThan(compressed.scaleX,plan.scale)
        XCTAssertLessThan(compressed.scaleY,plan.scale)
        let rebound=NativeBeachBallPlanning.pose(plan,time:impact+0.070)
        XCTAssertLessThan(rebound.y,plan.floorY)
        XCTAssertLessThan(rebound.scaleX,plan.scale)
        XCTAssertGreaterThan(rebound.scaleY,plan.scale)
        let recovered=NativeBeachBallPlanning.pose(plan,time:impact+0.17)
        XCTAssertEqual(recovered.scaleX,plan.scale,accuracy:1e-10)
        XCTAssertEqual(recovered.scaleY,plan.scale,accuracy:1e-10)
    }
    func testBallLargeSizeBucketIsLimitedToTwentyPercent() {
        let small=NativeBeachBallPlanning.ball(width:390,height:844,random:{0.2})
        let large=NativeBeachBallPlanning.ball(width:390,height:844,random:{0.199})
        XCTAssertLessThan(small.scale,large.scale)
        for roll in [0.2,0.4,0.6,0.99] {
            var draw=0
            let plan=NativeBeachBallPlanning.ball(width:390,height:844,random:{draw += 1;return draw==2 ? roll:0.5})
            XCTAssertLessThan(plan.scale,0.3)
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
    func testCombinedTntPipsMatchOriginalRenderedShapesForEveryFace() throws {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let preview=SKView(frame:CGRect(x:0,y:0,width:192,height:192));host.view.addSubview(preview)
        let scene=SKScene(size:CGSize(width:192,height:192));scene.backgroundColor = .clear
        preview.presentScene(scene);preview.isPaused=true
        let maps=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
        func pixels(_ node:SKNode)throws->Data {
            scene.removeAllChildren();node.position=CGPoint(x:96,y:96);node.setScale(3);scene.addChild(node)
            let image=try XCTUnwrap(preview.texture(from:scene,crop:CGRect(origin:.zero,size:scene.size))).cgImage()
            let bytes=UnsafeMutablePointer<UInt8>.allocate(capacity:192*192*4);defer{bytes.deallocate()}
            bytes.initialize(repeating:0,count:192*192*4)
            let context=try XCTUnwrap(CGContext(data:bytes,width:192,height:192,bitsPerComponent:8,bytesPerRow:192*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(image,in:CGRect(x:0,y:0,width:192,height:192))
            return Data(bytes:bytes,count:192*192*4)
        }
        for value in 1...6 {
            let original=SKNode()
            for index in maps[value]! {
                let x=CGFloat(index%3-1)*15,y = -CGFloat(index/3-1)*15
                let pip=SKShapeNode(rect:CGRect(x:x-3.75,y:y-3.75,width:7.5,height:7.5),cornerRadius:2.2)
                pip.fillColor=UIColor(red:129.0/255,green:90.0/255,blue:66.0/255,alpha:0.9);pip.strokeColor = .clear;original.addChild(pip)
            }
            let combined=NativeTntFinale.makeDiePips(value:value)
            let before=try pixels(original),after=try pixels(combined)
            XCTAssertTrue(before.contains{$0>0},"fixture must render visible art")
            // Same disjoint paths/material at3x must preserve raster output.
            let differences=zip(before,after).filter{$0 != $1}
            XCTAssertEqual(differences.count,0,"face \(value), max channel delta \(differences.map{abs(Int($0.0)-Int($0.1))}.max() ?? 0)")
            XCTAssertEqual(combined.children.count,0)
        }
        preview.presentScene(nil)
    }
    func testFinishedVariantParticlesStopWritingAndBackwardSeekRestoresVisiblePose() throws {
        for variant in [NativeTntVariantPresentation.Variant.flower,.barell] {
            let owner=NativeTntVariantPresentation(resourceRoot:resourceRoot(),variant:variant,viewport:CGSize(width:390,height:844),random:{0.5})
            let reference=NativeTntVariantPresentation(resourceRoot:resourceRoot(),variant:variant,viewport:CGSize(width:390,height:844),random:{0.5})
            let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(owner);host.view.addSubview(reference)
            defer{owner.dispose();owner.dispose();reference.dispose();window.isHidden=true}
            owner.layoutIfNeeded();reference.layoutIfNeeded()
            // Fully retired objects must neither recompute nor overwrite pose.
            owner.paint(seconds:4)
            let particles=owner.subviews.filter{!($0 is NativeSplashGlyphField)}
            XCTAssertFalse(particles.isEmpty)
            for view in particles {
                XCTAssertEqual(view.alpha,0,accuracy:0.000001)
                view.center=CGPoint(x:123,y:456);view.transform=CGAffineTransform(rotationAngle:0.123)
            }
            owner.paint(seconds:4.1);owner.paint(seconds:4.2)
            for view in particles {
                XCTAssertEqual(view.center,CGPoint(x:123,y:456));XCTAssertEqual(view.transform,CGAffineTransform(rotationAngle:0.123))
                XCTAssertEqual(view.alpha,0,accuracy:0.000001)
            }
            // Backward seek revives exactly the same visible authored sample.
            for time in [0.5,1.1,1.9,2.3] {
                owner.paint(seconds:time);reference.paint(seconds:time)
                for (actual,expected) in zip(owner.subviews,reference.subviews) where !(actual is NativeSplashGlyphField) {
                    XCTAssertEqual(actual.alpha,expected.alpha,accuracy:0.000001)
                    if expected.alpha>0 {
                        XCTAssertEqual(actual.center,expected.center);XCTAssertEqual(actual.transform,expected.transform)
                        XCTAssertEqual(actual.layer.zPosition,expected.layer.zPosition)
                    }
                }
            }
        }
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
