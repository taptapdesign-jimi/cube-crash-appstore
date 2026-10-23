import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeBloobBallTests:XCTestCase {
    func testSelectedOriginalSVGDecodeAndJourneyIntroduction()throws {
        let root=NativeTestResources.root
        let idle=try XCTUnwrap(NativeBloobBallArt.decode(root.appendingPathComponent(NativeBloobBallArt.idlePath)))
        let finale=try XCTUnwrap(NativeBloobBallArt.decode(root.appendingPathComponent(NativeBloobBallArt.finalePath)))
        let floating=try XCTUnwrap(NativeBloobBallArt.decode(root.appendingPathComponent(NativeBloobBallArt.floatingPath)))
        XCTAssertEqual(floating.width,2048);XCTAssertEqual(floating.height,1280)
        XCTAssertEqual(idle.width,2048);XCTAssertEqual(idle.height,1024)
        XCTAssertEqual(finale.width,1920);XCTAssertEqual(finale.height,1280)
        XCTAssertNotNil(NativeMeterSelectedWarmupCatalog.plan(special:"wild",variant:"bloob-ball"))
        XCTAssertEqual(NativeJourneyContent.introductionID(board:27),"bloob-ball")
        XCTAssertFalse(NativeJourneyContent.rewardPool(board:26).contains("bloob-ball"))
        XCTAssertTrue(NativeJourneyContent.rewardPool(board:30).contains("bloob-ball"))
        XCTAssertEqual(NativeBackpackCatalog.area.last?.id,"bloob-ball")
        XCTAssertEqual(NativeBackpackCatalog.area.last?.board,27)
        XCTAssertEqual(NativeSpecialDiceRegistry.variants["bloob-ball"]?.archetype,.star)
        XCTAssertEqual(NativeDiceArtwork.definition(kind:"wild",variant:"bloob-ball").idleSheet?.frameCount,32)
        XCTAssertNil(NativeBloobBallArt.decode(URL(fileURLWithPath:"/missing.svg")))
    }
    func testMergeAnchoredReceiptsAreOnceEachEvenOnSkippedFramesAndDispose()async throws {
        let root=NativeTestResources.root,artwork=JimiV9Artwork(resourceRoot:root)
        for path in NativeBloobBallFinalePresentation.assets {
            let ready=expectation(description:path)
            artwork.prepareImage(path,densityAware:false){image in XCTAssertNotNil(image);ready.fulfill()}
            await fulfillment(of:[ready],timeout:20)
        }
        weak var weakOwner:NativeBloobBallFinalePresentation?
        try autoreleasepool {
        var owner:NativeBloobBallFinalePresentation?=NativeBloobBallFinalePresentation(resourceRoot:root,viewport:.init(width:390,height:844),origin:CGPoint(x:121,y:432),preparedArtwork:artwork)
        weakOwner=owner
        XCTAssertTrue(try XCTUnwrap(owner).assetReady)
        let field=try XCTUnwrap(owner?.subviews.compactMap{$0 as? NativeSplashGlyphField}.first)
        let letters=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
        XCTAssertEqual(letters.compactMap(\.text).joined(),"BLOOOB!")
        XCTAssertTrue(letters.allSatisfy{$0.textColor.withAlphaComponent(1)==UIColor.white && $0.textColor.cgColor.alpha>=0.8 && $0.subviews.count==4})
        var coins:[Int]=[],cues:[String]=[]
        owner?.onExplosion={i,p in coins.append(i);XCTAssertEqual(p.x,182.5,accuracy:0.00001);XCTAssertEqual(p.y,338.4,accuracy:0.00001)}
        owner?.onCue={m,_ in cues.append(m)}
        owner?.paint(seconds:0.1);XCTAssertEqual(coins,[])
        let travelling=try XCTUnwrap(owner?.subviews.first)
        XCTAssertEqual(travelling.bounds.width,224)
        XCTAssertEqual(travelling.layer.contentsRect,CGRect(x:0,y:0,width:1.0/3,height:0.5))
        XCTAssertGreaterThan(travelling.layer.position.x,121)
        XCTAssertLessThan(travelling.layer.position.y,432)
        for t in [0.1,0.4,0.6,0.84] {
            owner?.paint(seconds:t)
            XCTAssertEqual(hypot(travelling.transform.a,travelling.transform.b),1,accuracy:1e-9)
            XCTAssertEqual(hypot(travelling.transform.c,travelling.transform.d),1,accuracy:1e-9)
        }
        XCTAssertFalse(cues.contains("burst"))
        owner?.paint(seconds:NativeBloobBallFinalePresentation.flightDuration-0.001)
        XCTAssertFalse(cues.contains("burst"))
        owner?.paint(seconds:NativeBloobBallFinalePresentation.flightDuration)
        XCTAssertFalse(cues.contains("burst"))
        owner?.paint(seconds:NativeBloobBallFinalePresentation.burstTime-0.001)
        XCTAssertFalse(cues.contains("burst"))
        owner?.paint(seconds:NativeBloobBallFinalePresentation.burstTime)
        XCTAssertEqual(cues.filter{$0=="burst"}.count,1);XCTAssertTrue(coins.isEmpty)
        owner?.paint(seconds:NativeBloobBallFinalePresentation.explosionDuration-0.001);XCTAssertEqual(coins,[])
        owner?.paint(seconds:NativeBloobBallFinalePresentation.explosionDuration);XCTAssertEqual(coins,[0,1,2,3,4,5])
        let firstPop=try XCTUnwrap(owner?.motion.popStart(0))
        let blue=try XCTUnwrap(owner?.subviews[1])
        owner?.paint(seconds:firstPop+0.07)
        XCTAssertFalse(blue.isHidden)
        let beforePopSize=hypot(blue.transform.a,blue.transform.b)
        owner?.paint(seconds:firstPop+0.13)
        XCTAssertGreaterThan(hypot(blue.transform.a,blue.transform.b),beforePopSize)
        owner?.paint(seconds:firstPop+0.141);XCTAssertTrue(blue.isHidden)
        owner?.paint(seconds:4);owner?.paint(seconds:4)
        XCTAssertEqual(cues.filter{$0=="pop"}.count,3)
        XCTAssertEqual(coins,[0,1,2,3,4,5]);XCTAssertEqual(cues.filter{$0=="rise"}.count,1)
        XCTAssertEqual(cues.filter{$0=="burst"}.count,1)
        for time in [1.4,2.9] {
            owner?.paint(seconds:time)
            if let owner {
                owner.layoutIfNeeded()
                let shot=UIGraphicsImageRenderer(bounds:owner.bounds).image {context in
                    UIColor(red:0.97,green:0.93,blue:0.87,alpha:1).setFill();context.fill(owner.bounds)
                    owner.layer.render(in:context.cgContext)
                }
                let path=FileManager.default.temporaryDirectory.appendingPathComponent("bloob-float-\(time).png")
                try shot.pngData()?.write(to:path);print("[BloobFloatSnapshot] \(path.path)")
            }
        }
        XCTAssertEqual(coins.count,6,"Snapshot backward sampling cannot duplicate explosion receipts")
        owner?.dispose();owner?.dispose();owner?.paint(seconds:10);XCTAssertEqual(coins.count,6)
        owner=nil
        }
        XCTAssertNil(weakOwner)
        artwork.retireImagePreparation()
    }
    func testCapturedScatterHalfRiseBurstsGentleTiltAndGravity() {
        var state:UInt32=37,calls=0
        let motion=NativeBloobBallFinaleMotion(viewport:.init(width:390,height:844),random:{
            calls+=1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296
        })
        let capturedCalls=calls
        XCTAssertEqual(motion.shards.filter(\.debris).count,10)
        XCTAssertTrue((motion.balls+motion.shards).allSatisfy{(0...90).contains($0.baseRotation)})
        XCTAssertEqual(Set((motion.balls+motion.shards).map(\.mirrored)),[true,false])
        XCTAssertTrue(motion.shards.contains{$0.y<0.2})
        XCTAssertTrue(motion.shards.contains{$0.y>0.8})
        let top=motion.shards.filter(\.earlyExit),normal=motion.shards.filter{!$0.earlyExit}
        XCTAssertEqual(top.count,3)
        XCTAssertEqual(Set(top.map(\.y)),Set(motion.shards.sorted{$0.y<$1.y}.prefix(3).map(\.y)))
        XCTAssertLessThan(top.map(\.fallStart).max() ?? 99,normal.map(\.fallStart).min() ?? 0)
        XCTAssertEqual(motion.balls.filter(\.earlyExit).count,2)
        XCTAssertTrue(motion.balls.filter(\.earlyExit).allSatisfy{abs($0.y-0.5)<0.1})
        XCTAssertEqual(motion.shards.count,48)
        XCTAssertEqual(Set(motion.shards.map(\.asset)),Set(0..<7))
        XCTAssertEqual(Set(motion.shards.map{$0.x}).count,48)
        XCTAssertTrue(motion.shards.allSatisfy{$0.x>0.035 && $0.x<0.965 && $0.y>0.025 && $0.y<0.90})
        XCTAssertTrue(motion.shards.contains{$0.y<0.10})
        XCTAssertTrue(motion.shards.allSatisfy{$0.tiltAmplitude>=14 && $0.tiltAmplitude<24})
        var signs=Set<Int>()
        for p in motion.balls+motion.shards {
            signs.insert(p.tilt(0.01)>p.tilt(0) ? 1:-1)
            for i in 0...600 {XCTAssertLessThanOrEqual(abs(p.tilt(Double(i)/120)),24)}
        }
        XCTAssertEqual(signs,[-1,1])
        XCTAssertEqual(motion.balls.count,8)
        XCTAssertEqual(Set(motion.balls.map(\.playbackRate)).count,8)
        XCTAssertEqual(Set(motion.balls.map(\.playbackPhase)).count,8)
        XCTAssertEqual(Set(motion.balls.map(\.front)),[false,true])
        for (i,p) in motion.balls.enumerated() {
            XCTAssertTrue((57.6...138).contains(p.size))
            XCTAssertTrue((1.3...2.8).contains(p.playbackRate))
            XCTAssertEqual(motion.ballPose(i,seconds:p.fallStart+0.3).alpha,1)
            XCTAssertGreaterThan(motion.ballPose(i,seconds:p.fallStart+0.6).center.y,
                motion.ballPose(i,seconds:p.fallStart+0.3).center.y)
            XCTAssertTrue(motion.ballPose(i,seconds:motion.duration).hidden)
        }
        for (i,p) in motion.shards.enumerated() {
            let a=motion.shardPose(i,seconds:p.fallStart+0.2).center.y
            let b=motion.shardPose(i,seconds:p.fallStart+0.4).center.y
            let c=motion.shardPose(i,seconds:p.fallStart+0.6).center.y
            XCTAssertEqual(c-2*b+a,p.gravity*0.04,accuracy:1e-7)
            XCTAssertGreaterThan(c,b)
            for step in 0...100 {
                let sample=motion.shardPose(i,seconds:p.fallStart+Double(step)/100*2)
                if !sample.hidden {XCTAssertEqual(sample.alpha,1,"No fade out during gravity fall")}
                if sample.hidden {XCTAssertGreaterThan(sample.center.y-p.size,844)}
            }
            let before=motion.shardPose(i,seconds:p.fallStart-0.00001).center.y
            let after=motion.shardPose(i,seconds:p.fallStart+0.00001).center.y
            XCTAssertLessThan(abs(after-before),0.001)
            XCTAssertTrue(motion.shardPose(i,seconds:motion.duration).hidden)
        }
        XCTAssertEqual(calls,capturedCalls,"Sampling cannot reroll a live profile")
        let other=NativeBloobBallFinaleMotion(viewport:.init(width:390,height:844),random:{0.85})
        XCTAssertNotEqual(motion.shards.map(\.x),other.shards.map(\.x))
    }
    func testFlightAlwaysDepartsTowardOppositeQuadrant() {
        for x in [CGFloat(80),310] {for y in [CGFloat(180),650] {
            let end=NativeBloobBallFinalePresentation.burstPoint(origin:CGPoint(x:x,y:y),viewport:CGSize(width:390,height:844))
            XCTAssertEqual(end.x>x,x<195)
            XCTAssertEqual(end.y>y,y<422)
            XCTAssertEqual(abs(end.x-x),abs((x<195 ? 326:64)-x)*0.3,accuracy:0.00001)
            XCTAssertEqual(abs(end.y-y),abs((y<422 ? 724:120)-y)*0.3,accuracy:0.00001)
        }}
    }
    func testBloobCoinScatterHasIndependentOrganicDepartureAndTiming() {
        let origin=CGPoint(x:195,y:440),target=CGPoint(x:275,y:80)
        var end=0.0
        let plans=(0..<6).map {i in
            var previous=0.0
            return NativeSourceHUDStarPlan.construct(ordinal:0,sizes:[56,42,30],origin:origin,target:target,
                textureWidth:128,previousArrival:&previous,random:{0.42})
                .readableCoin(ordinal:i,previousEnd:&end)
                .bloobScatter(ordinal:i,origin:origin)
        }
        XCTAssertTrue(plans.allSatisfy{$0.points.first==origin && $0.points.last==target})
        XCTAssertEqual(Set(plans.map(\.delay)).count,6)
        XCTAssertEqual(Set(plans.map(\.duration)).count,6)
        XCTAssertGreaterThan((plans.map(\.duration).max() ?? 0)/(plans.map(\.duration).min() ?? 1),1.3)
        XCTAssertGreaterThan((plans.map(\.delay).max() ?? 0)-(plans.map(\.delay).min() ?? 0),0.15)
        let departures=plans.map{atan2($0.points[2].y-origin.y,$0.points[2].x-origin.x)}
        XCTAssertGreaterThan(Set(departures.map{Int($0*4)}).count,3)
        XCTAssertTrue(plans.allSatisfy{$0.delay<0.481 && $0.points.allSatisfy{$0.x.isFinite && $0.y.isFinite}})
        let spread=plans.map{$0.points[16]}
        let separation=spread.flatMap {a in spread.map{b in hypot(a.x-b.x,a.y-b.y)}}.max() ?? 0
        XCTAssertGreaterThan(separation,80)
    }
    func testBoardIdleFloatsWithoutSquashAndPausesWhileCollectionKeepsOriginalPose()async throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let board=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:[])),
            resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let die=NativeDiceNode(id:"bloob-idle-scope",value:6,kind:"wild",variant:"bloob-ball",depth:1,locked:false,textures:textures)
        board.addChild(die)
        defer{die.dispose();textures.dispose();board.dispose()}
        var found:SKSpriteNode?
        for _ in 0..<600 {
            let candidate=die.visual.children.compactMap{$0 as? SKSpriteNode}.last
            if let candidate,!candidate.isHidden,candidate.texture != nil,candidate.size==CGSize(width:128,height:128) {found=candidate}
            if found != nil{break};try await Task.sleep(for:.milliseconds(20))
        }
        let art=try XCTUnwrap(found)
        var highest:CGFloat=0,lowest:CGFloat=0
        for _ in 0..<200 {
            die.tick(1.0/60,suspended:false,viewportCenter:195)
            XCTAssertEqual(art.xScale,1);XCTAssertEqual(art.yScale,1)
            highest=max(highest,art.position.y);lowest=min(lowest,art.position.y)
        }
        XCTAssertGreaterThan(highest,10);XCTAssertLessThan(lowest,-12)
        let held=art.position;die.tick(1,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,held)
        let collection=SKScene(size:board.size)
        die.removeFromParent();collection.addChild(die);die.tick(0.2,suspended:false,viewportCenter:195)
        XCTAssertNotEqual(art.xScale,1,"Only the board flattens authored breathing")
    }
    func testPreBurstShakeAcceleratesWithoutRandomnessOrResidualOffset() {
        func samples(_ start:Double)->[Double] {
            (0...240).map{NativeBloobBallFinalePresentation.preBurstShake(seconds:start+Double($0)/1200).x}
        }
        func crossings(_ values:[Double])->Int {
            zip(values,values.dropFirst()).filter{$0*$1<0}.count
        }
        let early=samples(0),late=samples(0.6)
        XCTAssertGreaterThan(crossings(late),crossings(early))
        XCTAssertGreaterThan(late.map(abs).max() ?? 0,(early.map(abs).max() ?? 0)*2)
        XCTAssertLessThanOrEqual(late.map(abs).max() ?? 0,6)
        XCTAssertEqual(NativeBloobBallFinalePresentation.preBurstShake(seconds:0),.zero)
        XCTAssertEqual(NativeBloobBallFinalePresentation.preBurstShake(seconds:NativeBloobBallFinalePresentation.burstTime),.zero)
    }
    private final class AudioTransport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[],stops=0
        func play(_ cue:NativeAudioCue){cues.append(cue)}
        func stopAll(){stops+=1}
        func dispose(){stopAll()}
    }
    func testActualAudioOwnerGatesRepeatedBurstSettingsBackgroundAndGeneration() {
        let transport=AudioTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:0,receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,5)
        XCTAssertTrue(transport.cues.last?.source.hasSuffix("juice/mini2.mp3")==true)
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:0,receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,5)
        owner.setEnabled(false);owner.specialMoment(variant:"bloob-ball",moment:"burst",index:1,receipt:2,generation:1)
        owner.setEnabled(true);owner.setForeground(false);owner.specialMoment(variant:"bloob-ball",moment:"rise",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,5);XCTAssertGreaterThanOrEqual(transport.stops,2)
        owner.setForeground(true);owner.beginGeneration(2)
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:2,receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,5)
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:2,receipt:4,generation:2)
        XCTAssertEqual(transport.cues.count,10)
    }
    func testRequestedAudioMixAndUniqueBurstVoices() {
        XCTAssertEqual(NativeBloobBallFinalePresentation.svgPlaybackRate,4.0)
        XCTAssertEqual(NativeBloobBallFinalePresentation.floatingShardCount,48)
        XCTAssertEqual(NativeBloobBallAudio.cues("pop").map(\.source),["assets/sound/CTA/poping.wav"])
        XCTAssertTrue(NativeBloobBallAudio.sources.contains("assets/sound/CTA/poping.wav"))
        XCTAssertEqual(NativeBloobBallAudio.cues("merge").map(\.gain),[0.4284])
        XCTAssertEqual(NativeBloobBallAudio.cues("rise").map(\.gain),[0.18,0.6,0.6,0.18])
        XCTAssertFalse(NativeBloobBallAudio.cues("merge").contains{$0.source.hasSuffix("juice/mini2.mp3")})
        XCTAssertTrue(NativeBloobBallAudio.cues("burst").contains{$0.source.hasSuffix("juice/mini2.mp3") && $0.gain==0.39})
        XCTAssertEqual(NativeBloobBallAudio.cues("merge").first?.delay,0)
        XCTAssertTrue(NativeBloobBallAudio.cues("rise").first?.source.hasSuffix("radio break.wav")==true)
        XCTAssertEqual(NativeBloobBallAudio.cues("rise").first?.delay,0)
        XCTAssertEqual(NativeBloobBallAudio.cues("burst").first{$0.source.hasSuffix("crash.wav")}?.gain,0.3)
        let mergeBeam=NativeBloobBallAudio.cues("merge").last
        XCTAssertTrue(mergeBeam?.source.hasSuffix("gun/beam1.wav")==true)
        XCTAssertEqual(mergeBeam?.delay,0)
        XCTAssertTrue(NativeBloobBallAudio.sources.contains(mergeBeam?.source ?? ""))
        XCTAssertEqual(Set(NativeBloobBallAudio.cues("merge").map(\.voice)).count,1)
        let voices=(0..<6).flatMap{NativeBloobBallAudio.cues("burst",index:$0).map(\.voice)}
        XCTAssertEqual(Set(voices).count,30)
    }
}
