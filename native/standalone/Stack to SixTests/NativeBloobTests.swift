import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeBloobTests:XCTestCase {
    func testIdentityProgressionAndLegacyStarFieldSurviveSave()throws {
        let definition=try XCTUnwrap(NativeSpecialDiceRegistry.variants["bloob"])
        XCTAssertEqual(definition.archetype,.star)
        XCTAssertEqual(NativeStarDropCountPolicy.effectiveCount(variant:"bloob",savedCount:3),1)
        XCTAssertEqual(NativeJourneyContent.introductionID(board:26),"bloob-ball")
        XCTAssertEqual(NativeJourneyContent.introductionID(board:27),"bloob")
        XCTAssertFalse(NativeJourneyContent.rewardPool(board:25).contains("bloob-ball"))
        XCTAssertFalse(NativeJourneyContent.rewardPool(board:26).contains("bloob"))
        let tile=NativeTile(id:"bloob-save",cell:.init(column:0,row:0),value:0,archetype:.star,variant:"bloob")
        XCTAssertEqual(try JSONDecoder().decode(NativeTile.self,from:JSONEncoder().encode(tile)),tile)
        XCTAssertEqual(NativeDragTrailStyle.resolve(core:.star,variant:"bloob").colors,[0xDAFCEF,0xA5F8ED,0x6CDDE8,0x57C8DA])
        XCTAssertEqual(NativeWildMergeSixShardProfile.make(archetype:.star,variant:"bloob")?.colors,[0xA5F8ED,0x67D7E5])
    }
    func testBloobShardReductionPreservesRandomConsumption()throws {
        let reduced=try XCTUnwrap(NativeWildMergeSixShardProfile.make(archetype:.star,variant:"bloob"))
        var original=reduced;original.retainedFraction=1
        for pattern in original.patterns.indices {
            var reducedDraws=0,originalDraws=0,acquired=0,registered=0
            let full=try NativeWildMergeSixShardPlan(profile:original,pattern:pattern,random:{originalDraws+=1;return 0.5},current:{true},acquire:{_ in},materialize:{_,_ in},register:{_,_ in})
            let small=try NativeWildMergeSixShardPlan(profile:reduced,pattern:pattern,random:{reducedDraws+=1;return 0.5},current:{true},acquire:{_ in acquired+=1},materialize:{_,_ in},register:{_,_ in registered+=1})
            XCTAssertEqual(reducedDraws,originalDraws)
            XCTAssertEqual(small.shards.count,max(1,Int((Double(full.shards.count)*0.15).rounded())))
            XCTAssertEqual(acquired,small.shards.count);XCTAssertEqual(registered,small.shards.count)
        }
    }
    func testHeroArtworkBoostIsContinuousAndBurstStaysSynchronized() {
        XCTAssertEqual(NativeBloobFinaleMotion.heroArtworkClock(0.5),0.85,accuracy:0.000001)
        XCTAssertEqual(NativeBloobFinaleMotion.heroArtworkClock(1),2.22,accuracy:0.000001)
        XCTAssertEqual(NativeBloobFinaleMotion.heroArtworkClock(1.2),2.8925,accuracy:0.000001)
        XCTAssertEqual(NativeBloobFinaleMotion.heroReverseSeconds(NativeBloobFinaleMotion.scatterStart),NativeBloobReverseArt.burstOffset,accuracy:0.000001)
    }
    func testExperimentalOrdinaryEscapesAreVariedFiniteAndFullyOffscreen() {
        var state:UInt64=8257
        let size=CGSize(width:390,height:844),origin=CGPoint(x:40,y:700)
        let motion=NativeBloobFinaleMotion(viewport:size,origin:origin,random:{state=state &* 6364136223846793005 &+ 1;return Double(state>>11)/Double(UInt64.max>>11)})
        XCTAssertEqual(motion.reverseBalls.count,67);XCTAssertEqual(motion.fakeDice.count,24)
        XCTAssertEqual(motion.heroSize,320)
        XCTAssertEqual(motion.reversePose(0,seconds:0).center,origin)
        XCTAssertEqual(motion.reversePose(0,seconds:motion.reverseStart+0.1).scale,1.5,accuracy:0.000001)
        XCTAssertEqual(NativeBloobFinaleMotion.scatterStart,motion.popStart(0))
        let children=Array(motion.reverseBalls.dropFirst())
        XCTAssertEqual(Set(children.map(\.asset)),Set(0..<5))
        XCTAssertTrue(children.contains{$0.size<48});XCTAssertTrue(children.contains{$0.size>150})
        var edges=Set<String>()
        for i in 1..<motion.reverseBalls.count {
            XCTAssertTrue(motion.reversePose(i,seconds:NativeBloobFinaleMotion.scatterStart-0.001).hidden)
            XCTAssertFalse(motion.reversePose(i,seconds:NativeBloobFinaleMotion.scatterStart+0.01).hidden)
            XCTAssertFalse(motion.reverseAnimationStart(i).isFinite)
            let exit=motion.exitTimes[i],pose=motion.reversePose(i,seconds:exit)
            let radius=motion.reverseBalls[i].size*0.86+4
            XCTAssertTrue(pose.hidden)
            XCTAssertTrue(pose.center.x+radius<0 || pose.center.y+radius<0 || pose.center.x-radius>size.width || pose.center.y-radius>size.height)
            XCTAssertFalse(motion.reversePose(i,seconds:exit-0.001).hidden)
            XCTAssertTrue(motion.reversePose(i,seconds:motion.duration).hidden)
            if pose.center.x<0 {edges.insert("left")};if pose.center.x>size.width {edges.insert("right")}
            if pose.center.y<0 {edges.insert("top")};if pose.center.y>size.height {edges.insert("bottom")}
        }
        XCTAssertEqual(edges,Set(["left","right","top","bottom"]))
    }
    func testFakeDiceStayHiddenUntilInstantBurstReveal() {
        let motion=NativeBloobFinaleMotion(viewport:CGSize(width:390,height:844),random:{0.5})
        for i in motion.fakeDice.indices {
            for t in stride(from:0.0,to:NativeBloobFinaleMotion.scatterStart,by:0.01) {
                XCTAssertTrue(motion.fakeDiePose(i,seconds:t).hidden)
                XCTAssertEqual(motion.fakeDiePose(i,seconds:t).alpha,0)
            }
            XCTAssertEqual(motion.fakeDiePose(i,seconds:NativeBloobFinaleMotion.heroReverseStart).alpha,0)
            XCTAssertEqual(motion.fakeDiePose(i,seconds:NativeBloobFinaleMotion.scatterStart-0.001).alpha,0)
            XCTAssertEqual(motion.fakeDiePose(i,seconds:NativeBloobFinaleMotion.scatterStart).alpha,1)
        }
    }
    func testDecorativeDiceOnlyEmitAtBurstAndEscapeIndependently() {
        var state:UInt64=727
        let motion=NativeBloobFinaleMotion(viewport:CGSize(width:390,height:844),random:{state=state &* 6364136223846793005 &+ 1;return Double(state>>11)/Double(UInt64.max>>11)})
        XCTAssertEqual(motion.fakeDice.count,24)
        for (i,die) in motion.fakeDice.enumerated() {
            XCTAssertTrue((1...6).contains(die.value))
            let emitted=motion.fakeDiePose(i,seconds:NativeBloobFinaleMotion.scatterStart)
            XCTAssertFalse(emitted.hidden);XCTAssertEqual(emitted.alpha,1)
            XCTAssertLessThan(hypot(emitted.center.x-motion.heroDestination.x,emitted.center.y-motion.heroDestination.y),40)
            let exit=motion.fakeDiePose(i,seconds:die.exit)
            let radius=die.flight.size*0.86+4
            XCTAssertTrue(exit.hidden)
            XCTAssertTrue(exit.center.x+radius<0 || exit.center.y+radius<0 || exit.center.x-radius>390 || exit.center.y-radius>844)
            XCTAssertTrue(motion.fakeDiePose(i,seconds:motion.duration).hidden)
            XCTAssertFalse(motion.reverseBalls.dropFirst().contains{$0.x==die.flight.x && $0.y==die.flight.y && $0.bendX==die.flight.bendX})
        }
    }
    func testScatterLastExitIsOneSecondLaterAndSpritesKeepMovingUntilExit() {
        let motion=NativeBloobFinaleMotion(viewport:CGSize(width:390,height:844),random:{0.5})
        let burst=NativeBloobFinaleMotion.scatterStart
        XCTAssertEqual(motion.duration-burst,motion.originalScatterDuration+1,accuracy:0.000001)
        let oldEnd=burst+motion.originalScatterDuration
        let time=oldEnd+0.5
        let movingBalls=motion.reverseBalls.indices.dropFirst().filter{motion.exitTimes[$0]>time}
        let movingDice=motion.fakeDice.indices.filter{motion.fakeDice[$0].exit>time}
        XCTAssertFalse(movingBalls.isEmpty && movingDice.isEmpty)
        for i in movingBalls {
            XCTAssertFalse(motion.reversePose(i,seconds:time).hidden)
            XCTAssertNotEqual(motion.reversePose(i,seconds:time).center,motion.reversePose(i,seconds:time+0.01).center)
        }
        for i in movingDice {
            XCTAssertFalse(motion.fakeDiePose(i,seconds:time).hidden)
            XCTAssertNotEqual(motion.fakeDiePose(i,seconds:time).center,motion.fakeDiePose(i,seconds:time+0.01).center)
        }
        XCTAssertEqual(motion.exitTimes[0],NativeBloobFinaleMotion.heroEventTime(NativeBloobReverseArt.duration))
    }
    func testAllOutgoingBlobsUseBoundedLateSquashStretch() {
        var seed:UInt64=727
        let motion=NativeBloobFinaleMotion(viewport:CGSize(width:390,height:844),random:{seed=seed &* 6364136223846793005 &+ 1;return Double(seed>>11)/Double(UInt64.max>>11)})
        XCTAssertEqual(NativeBloobFinaleMotion.fakeDieFlightSpeed,1.2)
        let burst=NativeBloobFinaleMotion.scatterStart
        for i in motion.reverseBalls.indices.dropFirst() {
            let duration=motion.exitTimes[i]-burst
            func shape(_ u:Double)->CGSize {motion.stretch(i,seconds:burst+duration*u)}
            XCTAssertEqual(shape(0.5).width,0.8,accuracy:0.000001)
            XCTAssertEqual(shape(0.5).height,1.2,accuracy:0.000001)
            XCTAssertEqual(shape(0.65).width,1.2,accuracy:0.000001)
            XCTAssertEqual(shape(0.65).height,0.8,accuracy:0.000001)
            for u in [0.0,0.25,0.4,0.8,0.9,1.0] {
                XCTAssertEqual(shape(u).width,1,accuracy:0.000001)
                XCTAssertEqual(shape(u).height,1,accuracy:0.000001)
            }
            for step in 0...1000 {
                let stretch=shape(Double(step)/1000)
                XCTAssertGreaterThanOrEqual(stretch.width,0.8);XCTAssertLessThanOrEqual(stretch.width,1.2)
                XCTAssertGreaterThanOrEqual(stretch.height,0.8);XCTAssertLessThanOrEqual(stretch.height,1.2)
                let extent=motion.reverseBalls[i].size*0.5*hypot(stretch.width,stretch.height)
                XCTAssertLessThan(extent,motion.reverseBalls[i].size*0.86+4)
            }
        }
        XCTAssertEqual(motion.stretch(0,seconds:burst*0.5),CGSize(width:1,height:1))
    }
    func testExtendedHeroAndCameraShakeAreFiniteAndBounded() {
        let motion=NativeBloobFinaleMotion(viewport:CGSize(width:390,height:844),random:{0.5})
        let burst=NativeBloobFinaleMotion.scatterStart,start=burst-1.2
        XCTAssertEqual(motion.heroShakeOffset(seconds:start-0.001),.zero)
        XCTAssertEqual(motion.heroShakeOffset(seconds:burst),.zero)
        var left=false,right=false,up=false,down=false
        for i in 0..<1200 {
            let p=motion.heroShakeOffset(seconds:start+Double(i)/1000)
            XCTAssertLessThanOrEqual(hypot(p.x,p.y),motion.heroSize*0.05+0.000001)
            left = left || p.x < -5;right = right || p.x>5;up = up || p.y < -5;down = down || p.y>5
            let camera=motion.screenShakeOffset(seconds:start+Double(i)/1000)
            XCTAssertLessThanOrEqual(hypot(camera.x,camera.y),9.000001)
        }
        XCTAssertTrue(left && right && up && down)
        XCTAssertEqual(motion.screenShakeOffset(seconds:burst),.zero)
        let originalBurst=0.52+NativeBloobReverseArt.burstOffset/(1.7*1.6)
        XCTAssertEqual(burst-originalBurst,1,accuracy:0.000001)
        XCTAssertEqual(NativeBloobFinaleMotion.heroReverseSeconds(1),0,accuracy:0.000001)
        let earlier=NativeBloobFinaleMotion.heroArtworkClock(0.9)-NativeBloobFinaleMotion.heroArtworkClock(0.8)
        let later=NativeBloobFinaleMotion.heroArtworkClock(1.5)-NativeBloobFinaleMotion.heroArtworkClock(1.4)
        XCTAssertGreaterThan(later,earlier)
    }
    func testScreenShakeBindingRestoresWithoutAccumulation() {
        let view=UIView();let original=CGAffineTransform(rotationAngle:0.1).scaledBy(x:0.9,y:0.95).translatedBy(x:4,y:7)
        view.transform=original
        var binding:NativeBloobScreenShakeBinding?=NativeBloobScreenShakeBinding(view:view)
        weak var released=binding
        for i in 0..<100 {binding?.paint(CGPoint(x:sin(Double(i))*7,y:cos(Double(i))*8))}
        binding?.paint(.zero)
        XCTAssertEqual(view.transform.tx,original.tx,accuracy:0.000001);XCTAssertEqual(view.transform.ty,original.ty,accuracy:0.000001)
        XCTAssertEqual(view.transform.a,original.a);XCTAssertEqual(view.transform.d,original.d)
        binding?.paint(CGPoint(x:7,y:9));binding?.dispose();binding?.dispose();binding=nil
        XCTAssertNil(released)
        XCTAssertEqual(view.transform.tx,original.tx,accuracy:0.000001);XCTAssertEqual(view.transform.ty,original.ty,accuracy:0.000001)
    }
    func testStandardGridReactionVibratesThenSpringsHomeAndDisposes()throws {
        let plan=try XCTUnwrap(NativeShortWildBoardBlastPlan.make(rests:[CGPoint(x:100,y:80)],center:.zero,tileSize:128,random:{0.5},dateMilliseconds:{nil},current:{true},held:false)?.first)
        let burst=NativeBloobFinaleMotion.scatterStart,start=NativeBloobFinaleMotion.boardReactionStart
        func offset(_ t:Double)->CGPoint {NativeBloobFinaleMotion.boardReactionOffset(plan:plan,phase:0.7,seconds:t)}
        XCTAssertEqual(offset(0),.zero);XCTAssertEqual(offset(start),.zero)
        XCTAssertGreaterThan(hypot(offset(burst-0.1).x,offset(burst-0.1).y),50)
        XCTAssertNotEqual(offset(burst-0.1),offset(burst-0.09))
        XCTAssertEqual(offset(burst).x,offset(burst-0.000001).x,accuracy:0.001)
        XCTAssertEqual(offset(burst+plan.returnDuration),.zero)
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let die=NativeDiceNode(id:"grid-logical-position",value:3,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
        defer{die.dispose();textures.dispose()}
        die.position=CGPoint(x:80,y:120);let originalPosition=die.position,originalScale=die.xScale
        let dieSurface=die.bloobBoardReactionSurface();dieSurface.position=offset(burst-0.1)
        XCTAssertEqual(die.position,originalPosition);XCTAssertEqual(die.xScale,originalScale)
        XCTAssertTrue(die.visual.parent === dieSurface);XCTAssertTrue(dieSurface.parent === die)
        dieSurface.position = .zero
        let surface=SKNode();var current=true
        let binding=NativeBloobBoardReactionBinding(entries:[.init(surface:surface,plan:plan,phase:0.7,current:{current})])
        binding.paint(seconds:burst-0.1);XCTAssertNotEqual(surface.position,.zero)
        binding.reset();XCTAssertEqual(surface.position,.zero)
        binding.paint(seconds:burst-0.1);current=false;binding.paint(seconds:burst-0.09);XCTAssertEqual(surface.position,.zero)
        current=true;binding.paint(seconds:burst-0.1);binding.dispose();binding.dispose();XCTAssertEqual(surface.position,.zero)
        binding.paint(seconds:burst-0.1);XCTAssertEqual(surface.position,.zero)
    }
    func testBoardRotationIsPerDieSlowSignedAndNeverInitiallyFlat() {
        var directions=Set<Bool>(),angles=Set<Int>()
        for i in 0..<100 {
            let plan=NativeBloobArt.BoardRotation(seed:UInt64(i))
            XCTAssertGreaterThanOrEqual(plan.initialAngle,20 * .pi/180)
            XCTAssertLessThan(plan.initialAngle,340 * .pi/180)
            XCTAssertTrue((6...10).contains(abs(plan.radiansPerSecond)*180 / .pi))
            XCTAssertEqual(plan.angle(seconds:10)-plan.angle(seconds:0),plan.radiansPerSecond*10,accuracy:0.000001)
            directions.insert(plan.radiansPerSecond>0);angles.insert(Int(plan.initialAngle*1000))
        }
        XCTAssertEqual(directions,Set([true,false]));XCTAssertGreaterThan(angles.count,90)
    }
    func testDeferredDropFaceAndLandedArtworkKeepSameInitialAngle()async throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let board=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:[])),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        let die=NativeDiceNode(id:"bloob-drop-angle",value:6,kind:"wild",variant:"bloob",depth:1,locked:false,textures:textures,deferSourceIdle:true)
        board.addChild(die);defer{die.dispose();textures.dispose();board.dispose()}
        let expected=NativeBloobArt.BoardRotation(seed:"bloob-drop-angle".utf8.reduce(UInt64(5381)){($0 &* 33) &+ UInt64($1)}).initialAngle
        let face=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.first{!$0.isHidden && $0.texture != nil})
        XCTAssertEqual(Double(face.zRotation),expected,accuracy:0.000001)
        die.tick(1,suspended:false,viewportCenter:195)
        XCTAssertEqual(Double(face.zRotation),expected,accuracy:0.000001)
        die.setSourceIdleDeferred(false)
        let deadline=Date().addingTimeInterval(15)
        while !die.authoredArtworkReceipt.running,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        let artwork=try XCTUnwrap(die.visual.children.compactMap{$0 as? SKSpriteNode}.last{!$0.isHidden && $0.texture != nil})
        XCTAssertEqual(Double(artwork.zRotation),expected,accuracy:0.000001)
        die.setDragging(true);XCTAssertEqual(Double(artwork.zRotation),expected,accuracy:0.000001)
        die.setDragging(false);XCTAssertEqual(Double(artwork.zRotation),expected,accuracy:0.000001)
        XCTAssertEqual(artwork.position,.zero,"First landed SVG must match the drop face position")
        XCTAssertEqual(artwork.size.width,128,accuracy:0.001)
        let logicalPosition=die.position
        var previous=artwork.position
        for _ in 0..<24 {
            die.tick(1.0/60,suspended:false,viewportCenter:195)
            XCTAssertLessThan(hypot(artwork.position.x-previous.x,artwork.position.y-previous.y),3,"No one-frame jump into floating")
            XCTAssertEqual(die.position,logicalPosition)
            previous=artwork.position
        }
        XCTAssertEqual(artwork.size.width,184.32,accuracy:0.001)
        let held=artwork.position
        die.tick(1,suspended:true,viewportCenter:195);XCTAssertEqual(artwork.position,held)

    }
    func testSelectedBloobUsesOnlyOriginalPixelsAndMetadata()async throws {
        let selected=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:9,current:{true})
        selected.prepare(variant:"bloob");selected.setSuspended(true)
        try await Task.sleep(for:.milliseconds(50))
        selected.setSuspended(false);selected.prepare(variant:"bloob")
        let deadline=Date().addingTimeInterval(20)
        while !selected.readyFamilies.contains("bloob"),Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(selected.readyFamilies.contains("bloob"))
        XCTAssertNotNil(selected.artwork.preparedBloobReverse)
        XCTAssertEqual(selected.artwork.preparedImageCount,3)
        selected.retain(variants:[]);XCTAssertNil(selected.artwork.preparedBloobReverse)
        selected.dispose()
    }
    func testActualSelectedPreparationFinaleReceiptsAndRelease()async throws {
        let selected=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:9,current:{true})
        selected.prepare(variant:"bloob")
        let deadline=Date().addingTimeInterval(20)
        while !selected.readyFamilies.contains("bloob"),Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(selected.readyFamilies.contains("bloob"))
        weak var released:NativeBloobFinalePresentation?
        weak var escapedDie:UIView?,escapedBall:UIView?
        autoreleasepool {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.isHidden=false
            let owner=NativeBloobFinalePresentation(resourceRoot:NativeTestResources.root,viewport:window.bounds.size,origin:CGPoint(x:60,y:700),preparedArtwork:selected.artwork,random:{0.5})
            released=owner;let stage=UIView(frame:window.bounds);window.addSubview(stage);stage.addSubview(owner);owner.bindScreenShake(to:stage);XCTAssertTrue(owner.assetReady)
            owner.paint(seconds:NativeBloobFinaleMotion.scatterStart*0.75)
            let hero=owner.subviews.first{$0.accessibilityIdentifier=="native-bloob-hero"}
            XCTAssertNotNil(hero)
            let reverse=hero?.subviews.compactMap{$0 as? NativeBloobReverseView}.first
            let glow=reverse?.layer.sublayers?.filter{$0.name=="native-bloob-blue-glow"} ?? []
            XCTAssertEqual(glow.count,4);XCTAssertTrue(glow.allSatisfy{$0.opacity>0 && $0.contents != nil})
            for (layer,recipe) in zip(glow,NativeSplashGlyphField.neonGlowLayers.reversed()) {
                XCTAssertEqual(layer.shadowRadius,recipe.0);XCTAssertEqual(layer.shadowColor,recipe.1.cgColor)
                XCTAssertEqual(layer.shadowOpacity,recipe.2)
            }
            let png=UIGraphicsImageRenderer(bounds:owner.bounds).image{owner.layer.render(in:$0.cgContext)}.pngData()
            try? png?.write(to:URL(fileURLWithPath:"/tmp/bloob-blue-glow.png"))
            func ordinary()->[UIView] {owner.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-bloob-ordinary-")==true}}
            XCTAssertEqual(ordinary().count,66);XCTAssertTrue(ordinary().allSatisfy{$0.subviews.isEmpty})
            func dice()->[UIView] {owner.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-bloob-fake-die-")==true}}
            XCTAssertEqual(dice().count,24)
            for t in [0.0,NativeBloobFinaleMotion.heroReverseStart,NativeBloobFinaleMotion.scatterStart-0.001] {
                owner.paint(seconds:t);XCTAssertTrue(dice().allSatisfy{$0.isHidden && $0.alpha==0})
            }
            owner.paint(seconds:NativeBloobFinaleMotion.scatterStart)
            XCTAssertEqual(stage.transform.tx,0,accuracy:0.000001);XCTAssertEqual(stage.transform.ty,0,accuracy:0.000001)
            XCTAssertTrue(glow.allSatisfy{$0.opacity==0})
            XCTAssertTrue(dice().allSatisfy{!$0.isHidden && $0.alpha==1})
            let dieTime=NativeBloobFinaleMotion.scatterStart+(owner.motion.fakeDice[0].exit-NativeBloobFinaleMotion.scatterStart)*0.5
            owner.paint(seconds:dieTime)
            for die in dice() where !die.isHidden {
                let t=die.transform
                XCTAssertEqual(hypot(t.a,t.b),hypot(t.c,t.d),accuracy:0.000001,"Fake dice retain uniform scale")
            }
            escapedDie=dice().first
            owner.paint(seconds:owner.duration);XCTAssertTrue(dice().isEmpty);XCTAssertNil(escapedDie?.superview)
            owner.paint(seconds:0);XCTAssertEqual(dice().count,24)
            owner.paint(seconds:NativeBloobFinaleMotion.scatterStart+0.02)
            XCTAssertTrue(ordinary().allSatisfy{!$0.isHidden && $0.layer.contents != nil})
            let index=1,exit=owner.motion.exitTimes[index]
            escapedBall=ordinary().first{$0.accessibilityIdentifier=="native-bloob-ordinary-1"}
            owner.paint(seconds:exit+0.001)
            XCTAssertNil(escapedBall?.superview,"Escaped sprite must be detached,not merely hidden")
            owner.paint(seconds:owner.duration);XCTAssertTrue(ordinary().isEmpty)
            owner.paint(seconds:NativeBloobFinaleMotion.scatterStart+0.02)
            XCTAssertEqual(ordinary().count,66)
            let clock=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
            owner.configureAnimationDelivery(clock);owner.start();owner.setSuspended(true)
            let held=ordinary().map(\.center);clock.deliver(wallMilliseconds:1000)
            XCTAssertEqual(ordinary().map(\.center),held)
            clock.dispose();owner.dispose();owner.dispose();XCTAssertTrue(ordinary().isEmpty)
            XCTAssertNil(owner.onCue);window.isHidden=true
        }
        // UIKit's transient transform/autorelease references drain at this boundary.
        XCTAssertNil(escapedDie);XCTAssertNil(escapedBall)
        selected.dispose();try await Task.sleep(for:.milliseconds(50));XCTAssertNil(released)
    }
    func testModalPeriodicBoostPreservesContinuousPhase() {
        XCTAssertEqual(NativeBloobArt.modalArtworkTime(2),2,accuracy:0.000001)
        XCTAssertEqual(NativeBloobArt.modalArtworkTime(2.5),2.85,accuracy:0.000001)
        XCTAssertEqual(NativeBloobArt.modalArtworkTime(3),3.7,accuracy:0.000001)
        XCTAssertEqual(NativeBloobArt.modalArtworkTime(3.5),4.2,accuracy:0.000001)
        XCTAssertEqual(NativeBloobArt.modalArtworkTime(4),4.7,accuracy:0.000001)
        XCTAssertEqual(NativeBloobArt.modalArtworkTime(4.5),5.55,accuracy:0.000001)
    }
    func testModalMixedDirectionRouteIsContinuousUnitSpeedAndCapturedOnce() {
        var draws=0
        var low=NativeBloobArt.Playback(random:{draws+=1;return 0.1})
        var high=NativeBloobArt.Playback(random:{0.9})
        XCTAssertEqual(draws,15)
        var positive=0,negative=0,different=0
        for _ in 0..<2400 {
            let before=low.seconds,next=low.advance(1.0/60),other=high.advance(1.0/60)
            let step=next-before
            XCTAssertLessThanOrEqual(abs(step),1.0/60+0.000001)
            XCTAssertGreaterThanOrEqual(next,0);XCTAssertLessThanOrEqual(next,NativeBloobArt.Playback.cycle)
            if step>0.0001 {positive+=1};if step < -0.0001 {negative+=1}
            if abs(next-other)>0.01 {different+=1}
        }
        XCTAssertGreaterThan(positive,500);XCTAssertGreaterThan(negative,500);XCTAssertGreaterThan(different,500)
        XCTAssertEqual(draws,15)
        let held=low.seconds;XCTAssertEqual(low.advance(0),held);XCTAssertEqual(low.advance(.nan),held)
        var original=NativeBloobArt.Playback(random:{0.5})
        for _ in 0..<60 {_=original.advance(1.0/60)}
        XCTAssertEqual(original.seconds,1,accuracy:0.000001)
        let route=NativeBloobArt.PlaybackRoute(seed:42)
        XCTAssertEqual(NativeBloobArt.frame(seconds:route.seconds(at:NativeBloobArt.PlaybackRoute.cycle)),39)
        let sample=route.seconds(at:3.7)
        _=route.seconds(at:20);XCTAssertEqual(route.seconds(at:3.7),sample)
    }
    func testSelectedModalUsesAcceptedPeriodicSVGSpeed()async throws {
        let item=try XCTUnwrap(NativeBackpackCatalog.area.first{$0.id=="bloob"})
        let preview=NativeBackpackDicePreview(die:item,root:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(preview)
        defer{preview.dispose();window.isHidden=true;window.rootViewController=nil}
        preview.frame=CGRect(x:0,y:0,width:342,height:380)
        preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
        let deadline=Date().addingTimeInterval(12)
        while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(preview.ready);preview.layoutArtwork();preview.setActive(true);preview.isPaused=true
        let node=try XCTUnwrap(preview.dieNode),scene=try XCTUnwrap(preview.scene)
        for i in 0...30 {scene.update(Double(i)/60)}
        let before=node.authoredArtworkReceipt.elapsed
        for i in 31...90 {scene.update(Double(i)/60)}
        XCTAssertEqual(node.authoredArtworkReceipt.elapsed-before,1,accuracy:0.000001)
        XCTAssertEqual(node.authoredArtworkReceipt.frame,NativeBloobArt.frame(seconds:node.authoredArtworkReceipt.elapsed))
        var forward=0,backward=0,boosted=0,normal=0
        for i in 91...690 {
            let before=node.authoredArtworkReceipt.elapsed
            scene.update(Double(i)/60)
            let step=node.authoredArtworkReceipt.elapsed-before
            XCTAssertLessThanOrEqual(abs(step),1.7/60+0.000001)
            if abs(step)>1.3/60 {boosted+=1}else if abs(step)>0.95/60 {normal+=1}
            XCTAssertEqual(node.authoredArtworkReceipt.frame,NativeBloobArt.frame(seconds:node.authoredArtworkReceipt.elapsed))
            if step>0.0001 {forward+=1};if step < -0.0001 {backward+=1}
        }
        XCTAssertGreaterThan(forward,100);XCTAssertGreaterThan(backward,100)
        XCTAssertGreaterThan(boosted,100);XCTAssertGreaterThan(normal,100)
        preview.setActive(false);let held=node.authoredArtworkReceipt.elapsed
        scene.update(15);XCTAssertEqual(node.authoredArtworkReceipt.elapsed,held)
        preview.setActive(true);preview.isPaused=true;scene.update(16)
        XCTAssertEqual(node.authoredArtworkReceipt.elapsed,held)
        scene.update(16+1.0/60)
        XCTAssertLessThanOrEqual(abs(node.authoredArtworkReceipt.elapsed-held),1.7/60+0.000001)
    }
    func testActualBoardArtworkFloatsBothAxesAndSuspends()async throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let board=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:[])),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        let die=NativeDiceNode(id:"bloob-idle",value:6,kind:"wild",variant:"bloob",depth:1,locked:false,textures:textures)
        board.addChild(die);defer{die.dispose();textures.dispose();board.dispose()}
        var found:SKSpriteNode?
        for _ in 0..<600 {
            die.tick(1.0/60,suspended:false,viewportCenter:195)
            if let candidate=die.visual.children.compactMap({$0 as? SKSpriteNode}).last,
               !candidate.isHidden,candidate.texture != nil,abs(candidate.size.width-184.32)<0.01 && abs(candidate.size.height-184.32)<0.01 {found=candidate;break}
            try await Task.sleep(for:.milliseconds(20))
        }
        let art=try XCTUnwrap(found,"SpriteKit artwork sizes: \(die.visual.children.compactMap { ($0 as? SKSpriteNode)?.size })")
        XCTAssertEqual(art.size.width,184.32,accuracy:0.01);XCTAssertEqual(art.size.height,184.32,accuracy:0.01)
        XCTAssertNotEqual(art.zRotation,0)
        let firstAngle=art.zRotation
        var xs:[CGFloat]=[],ys:[CGFloat]=[],forward=0,backward=0
        for _ in 0..<180 {
            let before=die.authoredArtworkReceipt.elapsed
            die.tick(1.0/60,suspended:false,viewportCenter:195)
            let change=die.authoredArtworkReceipt.elapsed-before
            if change>0.0001 {forward+=1};if change < -0.0001 {backward+=1}
            XCTAssertEqual(die.authoredArtworkReceipt.frame,NativeBloobArt.frame(seconds:die.authoredArtworkReceipt.elapsed))
            xs.append(art.position.x);ys.append(art.position.y)
        }
        XCTAssertGreaterThan(forward,20);XCTAssertGreaterThan(backward,20)
        XCTAssertGreaterThan((xs.max() ?? 0)-(xs.min() ?? 0),15)
        XCTAssertGreaterThan((ys.max() ?? 0)-(ys.min() ?? 0),24)
        let angleChange=atan2(sin(art.zRotation-firstAngle),cos(art.zRotation-firstAngle))
        XCTAssertTrue((17.9...30.1).contains(abs(angleChange)*180 / .pi))
        let heldAngle=art.zRotation
        let held=art.position,heldTime=die.authoredArtworkReceipt.elapsed
        die.tick(1,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,held);XCTAssertEqual(art.zRotation,heldAngle)
        XCTAssertEqual(die.authoredArtworkReceipt.elapsed,heldTime)
    }
    func testOriginalSplashTracksMoveCharactersFluidAndRespectTransformOrder()throws {
        let scene=try XCTUnwrap(NativeBloobSplashScene.decode(NativeTestResources.root.appendingPathComponent(NativeBloobArt.splashPath)))
        XCTAssertEqual(scene.animationCount,88);XCTAssertEqual(scene.images.count,14)
        let node=NativeBloobSplashScene.Node(imageID:nil,rect:.zero,
            base:[.init(kind:"scale",values:[0.52]),.init(kind:"translate",values:[-31.5,-31.5])],opacity:1,tracks:[],children:[])
        let origin=CGPoint.zero.applying(node.transform(seconds:0))
        XCTAssertEqual(origin.x,-16.38,accuracy:0.000001);XCTAssertEqual(origin.y,-16.38,accuracy:0.000001)
        let pivot=NativeBloobSplashScene.Operation(kind:"rotate",values:[90,350,455]).transform
        let point=CGPoint(x:351,y:455).applying(pivot)
        XCTAssertEqual(point.x,350,accuracy:0.000001);XCTAssertEqual(point.y,456,accuracy:0.000001)
        let negative=NativeBloobSplashScene.Track(kind:"translate",values:[[0,0],[10,20]],times:[0,1],splines:[],duration:2,begin:-1)
        XCTAssertEqual(negative.sample(0),[5,10]);XCTAssertEqual(negative.sample(1),[0,0])
        let spline=NativeBloobSplashScene.Track(kind:"scale",values:[[0],[1]],times:[0,1],splines:[[0.42,0,0.58,1]],duration:1,begin:0)
        XCTAssertEqual(try XCTUnwrap(spline.sample(0.5)?.first),0.5,accuracy:0.000001)
        weak var released:UIView?
        autoreleasepool {
            let view=NativeBloobSplashSVGView(scene:scene);released=view
            func all(_ v:UIView)->[UIView] {[v]+v.subviews.flatMap{all($0)}}
            let nodes=all(view)
            let images=nodes.compactMap{$0 as? UIImageView}
            XCTAssertGreaterThan(images.count,14)
            func origins()->[String:CGPoint] {
                var result:[String:CGPoint]=[:]
                for image in images {
                    let id=image.accessibilityIdentifier ?? ""
                    if result[id]==nil {result[id]=image.convert(.zero,to:view)}
                }
                return result
            }
            view.paint(seconds:0);let first=origins()
            view.paint(seconds:0.18);let second=origins()
            for name in ["LfootL","LfootR","Rcore","stream","pool"] {
                let key="native-bloob-splash-"+name
                XCTAssertNotNil(first[key],name)
                if let a=first[key],let b=second[key] {XCTAssertGreaterThan(hypot(b.x-a.x,b.y-a.y),0.1,name)}
            }
            let before=nodes.map{NSValue(cgAffineTransform:$0.transform)}
            view.paint(seconds:0.18)
            XCTAssertEqual(nodes.map{NSValue(cgAffineTransform:$0.transform)},before)
            for (index,t) in [0.0,0.18,0.4,0.65].enumerated() {
                view.paint(seconds:t)
                let image=UIGraphicsImageRenderer(bounds:view.bounds).image{view.layer.render(in:$0.cgContext)}
                try? image.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("native-bloob-splash-\(index).png"))
            }
            view.dispose();view.dispose();XCTAssertTrue(view.subviews.isEmpty)
            view.paint(seconds:1);XCTAssertTrue(view.subviews.isEmpty)
        }
        XCTAssertNil(released)
    }
    func testReverseUsesOriginalAtlasAndAuthoredCollapseDropletBurstOnce()throws {
        let root=NativeTestResources.root
        let recipe=try XCTUnwrap(NativeBloobReverseArt.decode(root.appendingPathComponent(NativeBloobReverseArt.path)))
        XCTAssertEqual(recipe.drops.count,20)
        XCTAssertEqual(recipe.drops.map(\.frame),Array(0..<10)+Array(0..<10))
        let regex=try NSRegularExpression(pattern:"data:image/webp;base64,[A-Za-z0-9+/=]+")
        func originals(_ path:String)throws->[String] {
            let text=try String(contentsOf:root.appendingPathComponent(path))
            return regex.matches(in:text,range:NSRange(text.startIndex...,in:text)).compactMap{Range($0.range,in:text).map{String(text[$0])}}
        }
        let frames=try originals(NativeBloobArt.path)
        XCTAssertEqual(frames.count,40);XCTAssertEqual(try originals(NativeBloobReverseArt.path),frames)
        let prepared=try XCTUnwrap(NativeSelectedFinaleRaster.decode(root:root,candidates:[NativeBloobReverseArt.path]))
        XCTAssertEqual(prepared.image.width,1);XCTAssertEqual(prepared.image.height,1);XCTAssertNotNil(prepared.bloobReverse)
        let atlas=try XCTUnwrap(NativeBloobArt.decode(root.appendingPathComponent(NativeBloobArt.path)))
        weak var released:NativeBloobReverseView?
        autoreleasepool {
            let view=NativeBloobReverseView(recipe:recipe,atlas:atlas);released=view
            let layers=view.layer.sublayers ?? []
            XCTAssertEqual(layers.count,21)
            view.paint(seconds:0,bodyFrame:11)
            XCTAssertEqual(layers.first?.opacity,1);XCTAssertTrue(layers.dropFirst().allSatisfy{$0.opacity==0})
            XCTAssertEqual(layers.first?.contentsRect,CGRect(x:3.0/8,y:0.2,width:1.0/8,height:0.2))
            view.paint(seconds:0.4,bodyFrame:20)
            XCTAssertLessThan(layers[0].affineTransform().a,1)
            view.paint(seconds:0.82,bodyFrame:25)
            XCTAssertEqual(layers[0].opacity,0)
            XCTAssertTrue(layers.dropFirst().contains{$0.opacity>0 && $0.position != CGPoint(x:320,y:320)})
            for (i,t) in [0.0,0.4,0.82,1.02].enumerated() {
                view.paint(seconds:t,bodyFrame:NativeBloobArt.frame(seconds:t*1.5))
                let image=UIGraphicsImageRenderer(bounds:view.bounds).image{view.layer.render(in:$0.cgContext)}
                try? image.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("native-bloob-reverse-\(i).png"))
            }
            view.paint(seconds:NativeBloobReverseArt.duration+10,bodyFrame:0)
            XCTAssertTrue(layers.allSatisfy{$0.opacity==0})
            view.paint(seconds:0,bodyFrame:0);XCTAssertEqual(layers[0].opacity,1)
            view.dispose();view.dispose();XCTAssertTrue(layers.allSatisfy{$0.contents==nil})
            view.paint(seconds:0.82,bodyFrame:0);XCTAssertTrue(view.layer.sublayers?.isEmpty ?? true)
        }
        XCTAssertNil(released)
        let motion=NativeBloobFinaleMotion(viewport:CGSize(width:390,height:844),random:{0.5})
        XCTAssertEqual(motion.popStart(0),NativeBloobFinaleMotion.scatterStart)
        XCTAssertFalse(motion.reversePose(0,seconds:motion.reverseStart+0.2).hidden)
        XCTAssertTrue(motion.reversePose(0,seconds:motion.exitTimes[0]).hidden)
        XCTAssertTrue(motion.reverseBalls.indices.dropFirst().allSatisfy{!motion.reverseAnimationStart($0).isFinite})
    }
    private final class AudioTransport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[],stops=0
        func play(_ cue:NativeAudioCue){cues.append(cue)}
        func stopAll(){stops+=1}
        func dispose(){stopAll()}
    }
    func testActualAudioOwnerRejectsDuplicateOffBackgroundAndStaleGeneration() {
        let transport=AudioTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:1,generation:1)
        XCTAssertEqual(transport.cues,NativeBloobAudio.cues("rise"))
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,1)
        owner.setEnabled(false);owner.specialMoment(variant:"bloob",moment:"rise",receipt:2,generation:1)
        owner.setEnabled(true);owner.setForeground(false)
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,1);XCTAssertGreaterThanOrEqual(transport.stops,2)
        owner.setForeground(true);owner.beginGeneration(2)
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,1)
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:5,generation:2)
        XCTAssertEqual(transport.cues.count,2)
    }
    func testRepeatedBluubSourceGetsIndependentNaturalTailVoices() {
        let transport=AudioTransport()
        let owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport,random:{0})
        defer{owner.dispose()}
        let tile=NativeTile(id:"bloob-audio",cell:.init(column:0,row:0),value:0,archetype:.star,variant:"bloob")
        owner.onGameplayEvent(.init(.merged,value:6),source:tile,generation:1,receipt:1)
        owner.onGameplayEvent(.init(.merged,value:6),source:tile,generation:1,receipt:2)
        let voices=transport.cues.filter{$0.source.hasSuffix("/bluub1.wav")}
        XCTAssertEqual(voices.count,2);XCTAssertEqual(Set(voices.map(\.voice)).count,2)
        XCTAssertTrue(voices.allSatisfy{$0.delay==0 && $0.stopAfter==nil && $0.fadeOut==0 && !$0.looping})
        XCTAssertEqual(transport.stops,0)
    }
    func testBluubPoolSelectsExactlyOneOriginalDelayedVoice() {
        for index in 0..<4 {
            let cues=NativeBloobAudio.cues("bluub",index:index)
            XCTAssertEqual(cues.count,1)
            XCTAssertTrue(cues[0].source.hasSuffix("/bluub\(index+1).wav"))
            XCTAssertEqual(cues[0].delay,0);XCTAssertEqual(cues[0].gain,0.9509359154766681,accuracy:0.000001)
            XCTAssertNil(cues[0].stopAfter);XCTAssertEqual(cues[0].fadeOut,0);XCTAssertFalse(cues[0].looping)
            XCTAssertTrue(NativeBloobAudio.sources.contains(cues[0].source))
        }
    }
    func testExactAudioGainsAndDelayedSequence() {
        let merge=NativeBloobAudio.cues("merge"),rise=NativeBloobAudio.cues("rise")
        XCTAssertEqual(merge.map(\.gain),[0.504,0.84])
        XCTAssertEqual(merge.map(\.delay),[1.6,0])
        XCTAssertTrue(NativeBloobAudio.cues("pop").isEmpty)
        XCTAssertFalse(NativeBloobAudio.sources.contains{$0.hasSuffix("djeca.wav")})
        XCTAssertFalse(NativeBloobAudio.sources.contains{$0.hasSuffix("bibice.wav") || $0.hasSuffix("ufo movement.wav")})
        XCTAssertEqual(rise.map(\.gain),[0.45])
        XCTAssertEqual(rise.map(\.delay),[0.4])
        XCTAssertTrue(Set(NativeBloobAudio.sources.map{"./"+$0}).isSubset(of:Set(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"bloob") ?? [])))
    }
}
