import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeBaloonPresentationTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testOriginalSVGTracksAndAtlasUseAuthoredLowerRightBirth() throws {
        let resources = try NativeBaloonResources.load(root: root)
        XCTAssertEqual(resources.frames.count, 32)
        XCTAssertEqual(resources.duration, 1.0200413, accuracy: 0.0000001)
        XCTAssertEqual(resources.translation.sample(0), [405, 440])
        XCTAssertEqual(resources.rotation.sample(0), [-5])
        XCTAssertEqual(resources.scale.sample(0), [0.84, 0.84])
        XCTAssertEqual(resources.cells.sample(0), [0, 0])
        XCTAssertEqual(resources.cells.sample(1), [-320, -1600])
        XCTAssertEqual(resources.frames[0].width, 320)
        XCTAssertEqual(resources.frames[0].bitsPerPixel,32)
        XCTAssertEqual(resources.frames[0].dataProvider?.data.map{CFDataGetLength($0)},320*320*4)
        let artwork = JimiV9Artwork(resourceRoot: root), origin = CGPoint(x: 120, y: 380)
        let owner = NativeBaloonFinalePresentation(viewport: CGSize(width: 390, height: 844), origin: origin, resources: resources, artwork: artwork, random: { 0.5 })
        owner.paint(seconds: 0)
        let hero = try XCTUnwrap(owner.subviews.last)
        XCTAssertEqual(hero.layer.position, origin)
        XCTAssertEqual(hero.layer.anchorPoint.x, 140.0 / 320, accuracy: 0.000001)
        owner.dispose()
    }
    func testOriginalSVGMirrorsBirthAndFlightTowardBoardInteriorAtEveryEdge() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        let viewport=CGSize(width:390,height:844)
        for x:CGFloat in [30,195,360] {for y:CGFloat in [100,422,740] {
            let origin=CGPoint(x:x,y:y)
            let owner=NativeBaloonFinalePresentation(viewport:viewport,origin:origin,resources:resources,artwork:artwork,random:{0.5})
            defer{owner.dispose()}
            owner.paint(seconds:0)
            let hero=try XCTUnwrap(owner.subviews.last)
            XCTAssertEqual(hero.layer.position,origin)
            let inwardFacing=CGPoint(x:195-x,y:422-y)
            if inwardFacing != .zero {
                // Check the actual rendered SVG thrust, independently of its
                // flight transform. Original right-hand jet pushes local -X.
                let thrust=CGPoint(x:-1,y:0).applying(hero.transform)
                XCTAssertGreaterThan(thrust.x*inwardFacing.x+thrust.y*inwardFacing.y,0)
                XCTAssertEqual(hero.transform.a*hero.transform.d-hero.transform.b*hero.transform.c < 0,x<195)
            }
            // Inverse smoothstep of0.6, so the original main leg is sampled.
            var lo=0.0,hi=1.0
            for _ in 0..<40 {let mid=(lo+hi)/2;if mid*mid*(3-2*mid)<0.6 {lo=mid}else{hi=mid}}
            owner.paint(seconds:resources.duration*1.22*(lo+hi)/2)
            if inwardFacing != .zero {
                let thrust=CGPoint(x:-1,y:0).applying(hero.transform)
                XCTAssertGreaterThan(thrust.x*inwardFacing.x+thrust.y*inwardFacing.y,0)
                if inwardFacing.x != 0 {XCTAssertGreaterThan(thrust.x*inwardFacing.x,0)}
                if inwardFacing.y != 0 {XCTAssertGreaterThan(thrust.y*inwardFacing.y,0)}
            }
            let leg=resources.translation.sample(0.6)
            let expected=CGPoint(x:CGFloat(leg[0]-405)*0.52,y:CGFloat(leg[1]-440)*0.52).applying(owner.heroDirection)
            XCTAssertEqual(hero.layer.position.x,origin.x+expected.x,accuracy:0.001)
            XCTAssertEqual(hero.layer.position.y,origin.y+expected.y,accuracy:0.001)
            let inward=CGPoint(x:195-x,y:422-y)
            if inward != .zero {
                XCTAssertGreaterThan(expected.x*inward.x+expected.y*inward.y,0)
                XCTAssertEqual(expected.x*inward.y-expected.y*inward.x,0,accuracy:0.01)
            }
            XCTAssertEqual(owner.flightSnapshot.count,24)
        }}
    }
    func testTwentyFourBalloonsHaveVariedFlightsCollideRiseTiltAndRetireOnce() throws {
        let resources = try NativeBaloonResources.load(root: root), artwork = JimiV9Artwork(resourceRoot: root)
        weak var weakOwner: NativeBaloonFinalePresentation?
        var completions = 0
        autoreleasepool {
            let owner = NativeBaloonFinalePresentation(viewport: CGSize(width: 390, height: 844), origin: CGPoint(x: 200, y: 400), resources: resources, artwork: artwork, random: { 0.5 })
            weakOwner = owner; XCTAssertTrue(owner.assetReady)
            let window = UIWindow(frame: owner.bounds), controller = UIViewController()
            window.rootViewController = controller; window.makeKeyAndVisible(); controller.view.addSubview(owner)
            owner.onFinished = { _ in completions += 1 }; owner.start()
            XCTAssertTrue(owner.hasActiveClock)
            XCTAssertEqual(owner.flightSnapshot.count, 24)
            let widths=owner.flightSnapshot.map(\.width),speeds=owner.flightSnapshot.map(\.riseSpeed)
            XCTAssertGreaterThan(try! XCTUnwrap(widths.max()) / (try! XCTUnwrap(widths.min())),2)
            XCTAssertGreaterThan((speeds.max() ?? 0)-(speeds.min() ?? 0),60)
            XCTAssertEqual(Set(owner.flightSnapshot.map(\.depth)).count,24)
            XCTAssertEqual(owner.flightSnapshot.filter{$0.birth<0.36}.count,8)
            for (index,color) in NativeBaloonFinalePresentation.colors.enumerated() { XCTAssertEqual(owner.flightSnapshot.filter { $0.color == color }.count,index == 4 ? 4:5) }
            XCTAssertEqual(Set(owner.flightSnapshot.map(\.birth)).count, 24)
            XCTAssertTrue(owner.flightSnapshot.allSatisfy { $0.point.y > 844 })
            for frame in 0...648 {
                owner.paint(seconds: Double(frame) / 120)
                if frame%20==0 {
                    for image in owner.subviews.compactMap({$0 as? UIImageView}) where !image.isHidden {
                        XCTAssertLessThanOrEqual(abs(atan2(image.transform.b,image.transform.a)),20 * .pi / 180 + 0.00001)
                    }
                }
            }
            XCTAssertGreaterThan(owner.collisionCount, 0)
            XCTAssertTrue(owner.flightSnapshot.allSatisfy { $0.point.y + $0.height < 0 })
            let snapshot = owner.flightSnapshot.map(\.point)
            owner.dispose(); owner.dispose(); owner.paint(seconds: 0)
            XCTAssertFalse(owner.hasActiveClock); XCTAssertNil(owner.superview)
            XCTAssertEqual(owner.flightSnapshot.map(\.point), snapshot)
            window.isHidden = true
        }
        XCTAssertEqual(completions, 1); XCTAssertNil(weakOwner)
    }
    func testIndependentBroadArcsAndRepeatedGentleSqueezeStayDeterministic() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        var seed:UInt64=63291
        func random()->Double {seed=seed &* 6364136223846793005 &+ 1;return Double(seed >> 11)/Double(UInt64(1)<<53)}
        let owner=NativeBaloonFinalePresentation(viewport:CGSize(width:390,height:844),origin:CGPoint(x:210,y:430),resources:resources,artwork:artwork,random:random)
        defer{owner.dispose()}
        let plans=owner.flightSnapshot
        XCTAssertEqual(Set(plans.map(\.arcCount)),Set([2,3,4]))
        XCTAssertEqual(Set(plans.map(\.squeezeCount)),Set([2,3,4]))
        XCTAssertGreaterThan((plans.map(\.travelDuration).max() ?? 0)-(plans.map(\.travelDuration).min() ?? 0),0.75)
        var xs=Array(repeating:[CGFloat](),count:24),scales=xs,verticalSpeeds=xs
        for frame in 0...648 {
            owner.paint(seconds:Double(frame)/120)
            let bodies=owner.flightSnapshot
            let images=owner.subviews.compactMap{$0 as? UIImageView}
            for i in bodies.indices where !images[i].isHidden && bodies[i].point.y<844 && bodies[i].point.y>0 {
                xs[i].append(bodies[i].point.x)
                scales[i].append(hypot(images[i].transform.c,images[i].transform.d))
                verticalSpeeds[i].append(abs(bodies[i].velocity.y))
                XCTAssertLessThanOrEqual(abs(bodies[i].contactOffset),24.00001)
            }
        }
        for i in plans.indices {
            XCTAssertGreaterThan((xs[i].max() ?? 0)-(xs[i].min() ?? 0),75,"Broad visible arcs for balloon \(i)")
            XCTAssertGreaterThan((scales[i].max() ?? 0)-(scales[i].min() ?? 0),0.045,"Repeated squeeze remains visible in mid-flight")
            XCTAssertGreaterThan((verticalSpeeds[i].max() ?? 0)-(verticalSpeeds[i].min() ?? 0),35)
            var changes=0,previousSign=0
            for j in 1..<scales[i].count {
                let delta=scales[i][j]-scales[i][j-1]
                guard abs(delta)>0.00001 else{continue}
                let sign=delta>0 ? 1:-1
                if previousSign != 0 && sign != previousSign {changes+=1};previousSign=sign
            }
            XCTAssertGreaterThanOrEqual(changes,2,"Stretch and squeeze repeat during visible flight")
        }
        owner.paint(seconds:1.8);let first=owner.flightSnapshot.map(\.point)
        owner.paint(seconds:0.4);owner.paint(seconds:1.8)
        XCTAssertEqual(owner.flightSnapshot.map(\.point),first,"Seeking never rerolls motion or leaves collision residue")
    }

    func testFirstTwoBatchesKeepOriginalFasterFlightAndHundredPointPockets() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        let owner=NativeBaloonFinalePresentation(viewport:CGSize(width:390,height:844),origin:CGPoint(x:210,y:430),resources:resources,artwork:artwork,random:{0.5})
        defer{owner.dispose()}
        let plans=owner.flightSnapshot
        for i in 0..<16 {
            let wave=i/8,stagger=Double((i*7)%8)/8*0.28
            let oldBirth=i == 0 ? 0:[0.0,0.40,0.90][wave]+stagger+0.08
            let draw=(Double((i*13)%24)+0.5)/24
            XCTAssertEqual(plans[i].travelDuration,min(5.25-oldBirth,2.65+draw*1.65)/1.3,accuracy:0.000001)
            let baseline=844+plans[i].height*0.65+CGFloat((i*47)%110)+21
            XCTAssertEqual(plans[i].launch.y-baseline,CGFloat(wave+(i%8)/4)*100,accuracy:0.000001)
        }
        XCTAssertLessThan(plans[0..<8].map(\.birth).max() ?? 0,plans[8..<16].map(\.birth).min() ?? 0)
        XCTAssertLessThan(plans[8..<16].map(\.birth).max() ?? 0,plans[16..<24].map(\.birth).min() ?? 0)
        owner.paint(seconds:0.65)
        XCTAssertEqual(owner.flightSnapshot.filter{$0.birth<=0.65}.count,8)
        owner.paint(seconds:1.4)
        XCTAssertEqual(owner.flightSnapshot.filter{$0.birth<=1.4}.count,16)
        owner.paint(seconds:5.4)
        XCTAssertTrue(owner.flightSnapshot.allSatisfy{$0.point.y+$0.height<0})
    }

    func testFinalBatchHasThirtyPercentViewportGridAndFifteenPercentFasterTravelOnly() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        for viewport in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            let owner=NativeBaloonFinalePresentation(viewport:viewport,origin:.zero,resources:resources,artwork:artwork,random:{0.5})
            defer{owner.dispose()}
            let plans=owner.flightSnapshot
            for i in 0..<24 {
                let wave=i/8,stagger=Double((i*7)%8)/8*0.28
                let originalBirth=i == 0 ? 0:[0.0,0.4,0.9][wave]+stagger+0.08
                let durationDraw=(Double((i*13)%24)+0.5)/24
                let previous=min(5.25-originalBirth,2.65+durationDraw*1.65)/1.30
                XCTAssertEqual(plans[i].travelDuration,previous/(wave == 2 ? 1.15:1),accuracy:1e-10)
                if wave == 2 {
                    XCTAssertEqual(plans[i].launch.x,viewport.width*(0.2+0.3*CGFloat((i-16)%3)),accuracy:1e-6)
                    XCTAssertEqual(plans[i].launch.y-plans[16].launch.y,CGFloat((i-16)/3)*viewport.height*0.3,accuracy:1e-6)
                } else {XCTAssertEqual(plans[i].launchArcOffset,0)}
            }
            owner.paint(seconds:5.4);XCTAssertTrue(owner.flightSnapshot.allSatisfy{$0.point.y+$0.height<0})
        }
    }

    func testBalooneyCaptionUsesReferenceColorsAndSharedFiniteGlyphMotion() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        let owner=NativeBaloonFinalePresentation(viewport:CGSize(width:390,height:844),origin:CGPoint(x:210,y:430),resources:resources,artwork:artwork,random:{0.5})
        defer{owner.dispose()}
        owner.paint(seconds:0.75)
        let caption=try XCTUnwrap(owner.subviews.first{$0.accessibilityIdentifier == "native-baloon-caption"})
        func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap{($0 as? UILabel).map{[$0]} ?? labels($0)}}
        let letters=labels(caption)
        XCTAssertEqual(letters.compactMap(\.text).joined(),"BALOONEY")
        XCTAssertEqual(caption.frame,owner.bounds)
        XCTAssertFalse(caption.isUserInteractionEnabled)
        let reference:[(CGFloat,CGFloat,CGFloat)]=[(252,176,208),(252,176,208),(138,195,247),(138,195,247),
            (176,227,166),(176,227,166),(252,187,135),(252,187,135)]
        XCTAssertEqual(letters.count,reference.count)
        for (label,color) in zip(letters,reference) {
            var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
            XCTAssertTrue(try XCTUnwrap(label.textColor).getRed(&r,green:&g,blue:&b,alpha:&a))
            XCTAssertEqual(r,color.0/255,accuracy:0.000001);XCTAssertEqual(g,color.1/255,accuracy:0.000001)
            XCTAssertEqual(b,color.2/255,accuracy:0.000001);XCTAssertEqual(a,1)
        }
        XCTAssertTrue(letters.contains{$0.alpha>0})
        let rendered=UIGraphicsImageRenderer(size:owner.bounds.size).image{owner.layer.render(in:$0.cgContext)}
        try rendered.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("baloony-caption-review.png"))
        owner.paint(seconds:3);XCTAssertTrue(letters.allSatisfy{$0.alpha == 0})
        owner.paint(seconds:0.75);XCTAssertTrue(letters.contains{$0.alpha>0})
    }

    func testBaloonUsesJuiceIdentityAndOnlyRequestedPalettes() throws {
        XCTAssertEqual(NativeSpecialDiceRegistry.variants["baloon"]?.archetype, .juice)
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:"baloon"))
        XCTAssertEqual(NativeDragTrailStyle.resolve(core: .juice, variant: "baloon").colors, [0xF4E2CD, 0x95D0F9, 0x5BB6F9])
        XCTAssertEqual(NativeWildMergeSixShardProfile.make(archetype: .juice, variant: "baloon")?.colors, [0x8DCCF9, 0x47A5EC])
        let tile = NativeDiceNode(id: "balloon", value: 6, kind: "wild-juice", variant: "baloon", depth: 1, locked: false, textures: NativeBoardTextures(root: root))
        tile.tick(0.75, suspended: false, viewportCenter: 195)
        let floating = try XCTUnwrap(tile.childNode(withName: "die-visual")?.children.compactMap { $0 as? SKSpriteNode }.first { $0.texture != nil && $0.zPosition == 0 })
        XCTAssertGreaterThan(floating.position.y, 0)
        tile.setDragging(true); XCTAssertEqual(floating.position, .zero)
        tile.dispose()
        let holder=NativeDiceNode(id:"reused",value:0,kind:"regular",variant:nil,depth:1,locked:false,textures:NativeBoardTextures(root:root))
        holder.update(value:6,kind:"wild-juice",variant:"baloon",depth:1,locked:false)
        holder.tick(0.2,suspended:false,viewportCenter:195)
        XCTAssertNil(holder.childNode(withName:"//baloon-ground-shadow"))
        holder.update(value:2,kind:"regular",variant:nil,depth:1,locked:false)
        XCTAssertNil(holder.childNode(withName:"//baloon-ground-shadow"));holder.dispose()
    }
    func testActualControllerAdmitsBaloonAndCleansItsForegroundOnDispose() async throws {
        let tile=NativeTile(id:"baloon",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"baloon")
        let engine=NativeGameplayEngine(state:.init(tiles:[tile,.init(id:"regular",cell:.init(column:1,row:0),value:4)],mode:.arcade))
        let game=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        game.loadViewIfNeeded()
        let scene=try XCTUnwrap(game.boardScene)
        let deadline=Date().addingTimeInterval(10)
        while scene.authoredFinalePresentationReady?("baloon") != true && Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(scene.authoredFinalePresentationReady?("baloon")==true)
        var finished=0
        XCTAssertTrue(scene.onAuthoredFinale?("baloon",CGPoint(x:130,y:350),engine.state.generation,{finished+=1})==true)
        let owner=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeBaloonFinalePresentation}.first)
        XCTAssertTrue(owner.hasActiveClock)
        game.dispose();game.dispose()
        XCTAssertNil(owner.superview);XCTAssertFalse(owner.hasActiveClock);XCTAssertEqual(finished,1)
        window.isHidden=true
    }
    func testSelectedPreparationRetiresCancelledRepliesAndRestartsAfterSuspend() async throws {
        let owner=NativeSelectedUIKitFinaleArtworkOwner(root:root,generation:1,current:{true})
        owner.prepare(variant:"baloon");owner.setSuspended(true);owner.setSuspended(false);owner.prepare(variant:"baloon")
        let deadline=Date().addingTimeInterval(10)
        while owner.baloonResources==nil && Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNotNil(owner.baloonResources)
        owner.retain(variants:[]);XCTAssertNil(owner.baloonResources)
        owner.prepare(variant:"baloon");owner.dispose();owner.dispose()
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertNil(owner.baloonResources);XCTAssertTrue(owner.selected.isEmpty)
    }

    func testRenderedFlightReviewFrames() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        let owner=NativeBaloonFinalePresentation(viewport:CGSize(width:390,height:844),origin:CGPoint(x:270,y:550),resources:resources,artwork:artwork,random:{0.5})
        owner.backgroundColor=UIColor(red:0.96,green:0.91,blue:0.85,alpha:1)
        for (index,time) in [0.0,0.35,1.8,2.4,3.1].enumerated() {
            owner.paint(seconds:time)
            let image=UIGraphicsImageRenderer(size:owner.bounds.size).image{owner.layer.render(in:$0.cgContext)}
            let attachment=XCTAttachment(image:image);attachment.name="Baloon flight \(time)s";attachment.lifetime = .keepAlways;add(attachment)
            try image.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("baloon-review-\(index).png"))
        }
        owner.dispose()
    }

    func testHeroCrossfadesDecodedFramesAndRiseGainsSpeedAfterGentleEntry() throws {
        let resources=try NativeBaloonResources.load(root:root),artwork=JimiV9Artwork(resourceRoot:root)
        let owner=NativeBaloonFinalePresentation(viewport:CGSize(width:390,height:844),origin:CGPoint(x:210,y:430),resources:resources,artwork:artwork,random:{0.5})
        owner.paint(seconds:0.20/1.30)
        let early=abs(owner.flightSnapshot[0].velocity.y)
        let openingHero=try XCTUnwrap(owner.subviews.last)
        XCTAssertEqual(openingHero.layer.sublayers?[1].opacity,0,"Long opening hold must not reveal a second knot")
        let target=resources.cells.times[1]-0.003
        var low=0.0,high=1.0
        for _ in 0..<40 {let mid=(low+high)/2;if mid*mid*(3-2*mid)<target {low=mid}else{high=mid}}
        owner.paint(seconds:(low+high)/2*resources.duration*1.22)
        let hero=try XCTUnwrap(owner.subviews.last),layers=try XCTUnwrap(hero.layer.sublayers)
        XCTAssertEqual(layers.count,3)
        XCTAssertGreaterThan(layers[1].opacity,0);XCTAssertLessThan(layers[1].opacity,1)
        XCTAssertNotNil(layers[0].contents);XCTAssertNotNil(layers[1].contents)
        owner.paint(seconds:1.4/1.30)
        XCTAssertGreaterThan(abs(owner.flightSnapshot[0].velocity.y),early*2)
        let visible=owner.flightSnapshot.filter{$0.birth<1.4}.map(\.point.y)
        XCTAssertGreaterThan((visible.max() ?? 0)-(visible.min() ?? 0),140)
        owner.dispose()
    }

}
