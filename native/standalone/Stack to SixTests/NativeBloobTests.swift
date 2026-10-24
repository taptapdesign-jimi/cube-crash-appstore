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
    func testArchivedHoverPopulationAndGravityAreFinite() {
        var state:UInt64=123
        let motion=NativeBloobFinaleMotion(viewport:.init(width:390,height:844),random:{state=state &* 6364136223846793005 &+ 1;return Double(state>>11)/Double(UInt64.max>>11)})
        XCTAssertEqual(motion.balls.count,22);XCTAssertEqual(motion.shards.count,29)
        XCTAssertGreaterThan(Set(motion.balls.map{Int($0.size)}).count,6)
        XCTAssertTrue(motion.balls.contains{$0.baseRotation>180})
        XCTAssertEqual(motion.balls.prefix(14).filter{$0.sizeMultiplier>=1.4 && $0.sizeMultiplier<=1.6}.count,7)
        XCTAssertEqual(motion.balls.filter{$0.sizeMultiplier==1}.count,7)
        let added=Array(motion.balls.suffix(8))
        XCTAssertTrue(added.allSatisfy{$0.sizeMultiplier==1.5})
        XCTAssertGreaterThan(Set(added.map{Int($0.x*1000)}).count,6)
        XCTAssertGreaterThan(Set(added.map{Int($0.size)}).count,4)
        XCTAssertTrue(motion.shards.allSatisfy{$0.sizeMultiplier==0.8})
        let originalX=[0.25,0.76,0.47,0.20,0.79,0.36,0.65,0.51,0.15,0.88,0.42,0.67,0.24,0.82]
        let originalY=[0.76,0.69,0.56,0.43,0.31,0.20,0.86,0.40,0.60,0.49,0.33,0.16,0.88,0.80]
        for i in 0..<14 {
            XCTAssertEqual(motion.balls[i].y,0.5+(originalY[i]-0.5)*0.8,accuracy:0.000001)
            XCTAssertLessThanOrEqual(abs(motion.balls[i].x-originalX[i]),0.035)
        }
        let xs=motion.balls.map(\.x)
        XCTAssertGreaterThan((xs.max() ?? 0)-(xs.min() ?? 0),0.65)
        for i in motion.balls.indices {
            let p=motion.balls[i],a=motion.ballPose(i,seconds:p.fallStart),b=motion.ballPose(i,seconds:p.fallStart+0.7)
            XCTAssertGreaterThan(b.center.y,a.center.y)
            XCTAssertTrue(motion.ballPose(i,seconds:motion.duration).hidden)
        }
        let original=NativeBloobBallArt.idlePose(seconds:0.8),new=NativeBloobArt.idlePose(seconds:0.4)
        XCTAssertEqual(new.x,original.x*1.4,accuracy:0.000001)
        XCTAssertEqual(new.y,14-original.y*1.15,accuracy:0.000001)
    }
    func testActualSelectedPreparationFinaleReceiptsAndRelease()async throws {
        XCTAssertFalse(NativeBloobFinalePresentation.assets.contains{$0.hasSuffix("bloob animation.svg") || $0==NativeBloobArt.splashPath})
        let selected=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:9,current:{true})
        selected.prepare(variant:"bloob")
        let deadline=Date().addingTimeInterval(20)
        while !selected.readyFamilies.contains("bloob"),Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(selected.readyFamilies.contains("bloob"))
        var state:UInt64=123
        var cues:[String]=[]
        weak var weakFinale:NativeBloobFinalePresentation?
        autoreleasepool {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.isHidden=false
            let owner=NativeBloobFinalePresentation(resourceRoot:NativeTestResources.root,viewport:window.bounds.size,preparedArtwork:selected.artwork,random:{state=state &* 6364136223846793005 &+ 1;return Double(state>>11)/Double(UInt64.max>>11)})
            weakFinale=owner;window.addSubview(owner);XCTAssertTrue(owner.assetReady)
            owner.onCue={moment,_ in cues.append(moment)}
            owner.paint(seconds:0);owner.paint(seconds:owner.motion.reverseStart-0.01)
            let regular=owner.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-bloob-regular-")==true}
            let reverse=owner.subviews.filter{$0.accessibilityIdentifier?.hasPrefix("native-bloob-reverse-")==true}
            XCTAssertEqual(regular.count,22);XCTAssertEqual(reverse.count,5)
            let capturedRandom=state
            var forwardFrames=0,reverseFrames=0
            var lastPhase:[Int:Double]=[:]
            for step in 1...30 {
                let time=Double(step)*0.06;owner.paint(seconds:time)
                for (i,ball) in regular.enumerated() where !ball.isHidden {
                    let plan=owner.motion.balls[i]
                    let phase=plan.playbackRoute!.seconds(at:time*plan.playbackRate+plan.playbackPhase)
                    let frame=NativeBloobArt.frame(seconds:phase)
                    XCTAssertEqual(ball.layer.contentsRect,CGRect(x:Double(frame%8)/8,y:Double(frame/8)/5,width:1.0/8,height:0.2))
                    if let previous=lastPhase[i] {
                        if phase>previous {forwardFrames+=1}else if phase<previous {reverseFrames+=1}
                    }
                    lastPhase[i]=phase
                }
            }
            XCTAssertGreaterThan(forwardFrames,20);XCTAssertGreaterThan(reverseFrames,20)
            XCTAssertEqual(state,capturedRandom)
            owner.paint(seconds:owner.motion.reverseStart-0.01)
            XCTAssertTrue(regular.allSatisfy{$0.subviews.isEmpty && $0.layer.contents != nil})
            XCTAssertTrue(reverse.allSatisfy{$0.subviews.first?.isHidden==true && $0.layer.contents != nil})
            owner.paint(seconds:owner.motion.reverseAnimationStart(0)+0.08)
            XCTAssertFalse(reverse[0].subviews.first?.isHidden ?? true)
            XCTAssertTrue(reverse.dropFirst().allSatisfy{$0.subviews.first?.isHidden==true})
            owner.paint(seconds:(owner.motion.reverseBalls.map(\.fallStart).max() ?? 0)+0.01)
            XCTAssertTrue(regular.allSatisfy{$0.layer.contents != nil})
            XCTAssertTrue(reverse.allSatisfy{$0.subviews.first?.isHidden==false && $0.layer.contents==nil})
            owner.paint(seconds:owner.motion.reverseStart-0.01)
            XCTAssertTrue(reverse.allSatisfy{$0.subviews.first?.isHidden==true && $0.layer.contents != nil})
            XCTAssertNil(selected.artwork.preparedBloobSplash)
            XCTAssertNotNil(selected.artwork.preparedBloobReverse)
            XCTAssertFalse(owner.subviews.contains{$0 is NativeBloobSplashSVGView})
            XCTAssertEqual(owner.subviews.compactMap{$0 as? UIImageView}.count,29)
            let image=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
            try? image.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("native-bloob-finale.png"))
            owner.paint(seconds:owner.motion.reverseStart+0.82)
            let burst=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
            try? burst.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("native-bloob-reverse-finale.png"))
            owner.paint(seconds:owner.duration);owner.paint(seconds:owner.duration);owner.paint(seconds:0)
            XCTAssertEqual(cues.filter{$0=="rise"}.count,1);XCTAssertFalse(cues.contains("burst"))
            let glyphs=try? XCTUnwrap(owner.subviews.compactMap{$0 as? NativeSplashGlyphField}.first)
            let letters=glyphs?.subviews.first?.subviews.compactMap{$0 as? UILabel} ?? []
            XCTAssertEqual(letters.compactMap(\.text).joined(),"BLOOB")
            XCTAssertTrue(letters.allSatisfy{$0.textColor.withAlphaComponent(1)==UIColor.white && $0.subviews.count==4})
            let clock=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
            owner.configureAnimationDelivery(clock)
            owner.start();owner.setSuspended(true)
            func nested(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap{nested($0)}}
            let nestedViews=nested(owner)
            let nestedTransforms=nestedViews.map{NSValue(cgAffineTransform:$0.transform)}
            let held=owner.subviews.map{ $0.center }
            clock.deliver(wallMilliseconds:1000)
            XCTAssertEqual(owner.subviews.map{$0.center},held)
            XCTAssertEqual(nestedViews.map{NSValue(cgAffineTransform:$0.transform)},nestedTransforms)
            owner.setSuspended(false);clock.deliver(wallMilliseconds:1016);clock.deliver(wallMilliseconds:1200)
            XCTAssertNotEqual(nestedViews.map{NSValue(cgAffineTransform:$0.transform)},nestedTransforms)
            clock.dispose()
            owner.dispose();owner.dispose();XCTAssertNil(owner.onCue)
            window.isHidden=true
        }
        selected.dispose();XCTAssertNil(selected.artwork.preparedBloobSplash);XCTAssertNil(selected.artwork.preparedBloobReverse);try await Task.sleep(for:.milliseconds(50));XCTAssertNil(weakFinale)
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
    func testSelectedModalUsesOriginalSVGSpeed()async throws {
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
        var forward=0,backward=0
        for i in 91...690 {
            let before=node.authoredArtworkReceipt.elapsed
            scene.update(Double(i)/60)
            let step=node.authoredArtworkReceipt.elapsed-before
            XCTAssertLessThanOrEqual(abs(step),1.0/60+0.000001)
            XCTAssertEqual(node.authoredArtworkReceipt.frame,NativeBloobArt.frame(seconds:node.authoredArtworkReceipt.elapsed))
            if step>0.0001 {forward+=1};if step < -0.0001 {backward+=1}
        }
        XCTAssertGreaterThan(forward,100);XCTAssertGreaterThan(backward,100)
        preview.setActive(false);let held=node.authoredArtworkReceipt.elapsed
        scene.update(15);XCTAssertEqual(node.authoredArtworkReceipt.elapsed,held)
        preview.setActive(true);preview.isPaused=true;scene.update(16)
        XCTAssertEqual(node.authoredArtworkReceipt.elapsed,held)
        scene.update(16+1.0/60)
        XCTAssertLessThanOrEqual(abs(node.authoredArtworkReceipt.elapsed-held),1.0/60+0.000001)
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
               !candidate.isHidden,candidate.texture != nil,abs(candidate.size.width-153.6)<0.01 && abs(candidate.size.height-153.6)<0.01 {found=candidate;break}
            try await Task.sleep(for:.milliseconds(20))
        }
        let art=try XCTUnwrap(found,"SpriteKit artwork sizes: \(die.visual.children.compactMap { ($0 as? SKSpriteNode)?.size })")
        XCTAssertEqual(art.size.width,153.6,accuracy:0.01);XCTAssertEqual(art.size.height,153.6,accuracy:0.01)
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
        let held=art.position,heldTime=die.authoredArtworkReceipt.elapsed
        die.tick(1,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,held)
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
        XCTAssertEqual(motion.reverseBalls.count,5)
        XCTAssertEqual(motion.reverseStart,motion.shards.map(\.fallStart).min())
        XCTAssertTrue(motion.reverseBalls.allSatisfy{$0.sizeMultiplier==1.4 && $0.settled<$0.fallStart})
        for i in motion.reverseBalls.indices {
            XCTAssertGreaterThanOrEqual(motion.reverseBalls[i].fallStart,motion.reverseStart)
            if i>0 {XCTAssertGreaterThanOrEqual(motion.reverseBalls[i].fallStart-motion.reverseBalls[i-1].fallStart,0.16)}
            let start=motion.reverseAnimationStart(i)
            XCTAssertEqual(motion.reverseBalls[i].fallStart-start,0.12,accuracy:0.000001)
            XCTAssertEqual(motion.popStart(i),start+NativeBloobReverseArt.burstOffset)
            XCTAssertFalse(motion.reversePose(i,seconds:start+0.82).hidden)
            XCTAssertTrue(motion.reversePose(i,seconds:start+NativeBloobReverseArt.duration).hidden)
            XCTAssertGreaterThanOrEqual(motion.duration,start+NativeBloobReverseArt.duration)
        }
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
        XCTAssertEqual(transport.cues.count,2)
        owner.setEnabled(false);owner.specialMoment(variant:"bloob",moment:"rise",receipt:2,generation:1)
        owner.setEnabled(true);owner.setForeground(false)
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,2);XCTAssertGreaterThanOrEqual(transport.stops,2)
        owner.setForeground(true);owner.beginGeneration(2)
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,2)
        owner.specialMoment(variant:"bloob",moment:"rise",receipt:5,generation:2)
        XCTAssertEqual(transport.cues.count,4)
    }
    func testExactAudioGainsAndDelayedSequence() {
        let merge=NativeBloobAudio.cues("merge"),rise=NativeBloobAudio.cues("rise")
        XCTAssertEqual(merge.map(\.gain),[0.504,0.6])
        XCTAssertFalse(NativeBloobAudio.sources.contains{$0.hasSuffix("bibice.wav") || $0.hasSuffix("ufo movement.wav")})
        XCTAssertEqual(rise.map(\.gain),[0.84,0.45])
        XCTAssertEqual(rise.map(\.delay),[0,0.4])
        XCTAssertTrue(Set(NativeBloobAudio.sources.map{"./"+$0}).isSubset(of:Set(NativeMeterSelectedAudioCatalog.sources(special:"wild",variant:"bloob") ?? [])))
    }
}
