import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeJourneyRewardTests:XCTestCase {
    func testRewardTitleAndSubtitleReuseNavigationRiseAlphaAndDisposeStagger() throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        controller.start()
        let heading=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? UILabel}.first{$0.text=="New Reward"})
        let subtitle=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? UILabel}.first{$0.text=="Tap the card to reveal"})
        XCTAssertEqual(controller.phase,"entering")
        let glyphs=heading.subviews.compactMap{$0 as? UILabel}
        XCTAssertEqual(glyphs.compactMap(\.text).joined(),"New Reward")
        let first=try XCTUnwrap(glyphs.first?.layer.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation)
        let navigation=JimiV9Motion.sampledTrack(JimiV9Motion.navigationCaption(entering:true,reducedMotion:false))
        assertNavigationCaption(first,on:try XCTUnwrap(glyphs.first?.layer),delay:0,navigation:navigation)
        let second=try XCTUnwrap(glyphs[1].layer.animation(forKey:"reward.transform.\(NativeJourneyRewardController.titleLetterStagger)") as? CAKeyframeAnimation)
        XCTAssertEqual(second.beginTime-first.beginTime,NativeJourneyRewardController.titleLetterStagger,accuracy:0.00001)
        let subtitleDelay=controller.initialSubtitleEntryDelay
        let sub=try XCTUnwrap(subtitle.layer.animation(forKey:"reward.transform.\(subtitleDelay)") as? CAKeyframeAnimation)
        assertNavigationCaption(sub,on:subtitle.layer,delay:subtitleDelay,navigation:navigation)
        let wholeHeading=first.duration+Double(glyphs.count-1)*NativeJourneyRewardController.titleLetterStagger
        XCTAssertEqual(sub.beginTime-first.beginTime,wholeHeading*0.9,accuracy:0.025)
        controller.setForeground(false);clock.advance(1);XCTAssertEqual(controller.phase,"entering")
        controller.setForeground(true);clock.advance(0.159);XCTAssertEqual(controller.phase,"entering")
        clock.advance(0.002);XCTAssertEqual(controller.phase,"opening")
        controller.dispose();XCTAssertEqual(clock.activeCount,0)
        XCTAssertTrue(glyphs.allSatisfy{($0.layer.animationKeys() ?? []).isEmpty})
    }
    func testSVGClickAnticipationAndVisibleExitHandOffToCardThenNavigationCaptions() throws {
        for stars in [1,3] {for reduced in [false,true] {
            let clock=Clock(),resources=Resources(),controller=screen(clock,resources,reduced:reduced,stars:stars)
            defer{controller.dispose()}
            resources.finish();controller.start();clock.advance(3)
            XCTAssertEqual(controller.phase,"interim")
            func tree(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{tree($0)}}
            let layers=tree(controller.view.layer)
            let magic=try XCTUnwrap(layers.first{$0.name=="native.reward.magic-card"})
            let interim=try XCTUnwrap(layers.first{$0.name=="native.reward.interim-spatial"})
            let face=try XCTUnwrap(layers.first{$0.name=="native.reward.unlocked-spatial"})
            let labels=controller.view.subviews.compactMap{$0 as? UILabel}
            let heading=try XCTUnwrap(labels.first{$0.text=="New Reward"})
            let subtitle=try XCTUnwrap(labels.first{$0.text=="Tap the card to reveal"})
            var entryMoments=0;controller.onSoundMoment={kind,_,_ in if kind=="new-card-unlocked-enter" {entryMoments+=1}}
            let start=clock.time;controller.activate()
            let cardDelay=reduced ? 0.16*0.9:NativeJourneyRewardController.unlockedArtworkEntryDelay
            let cardDuration=reduced ? 0.16:NativeRewardMotion.cardEnterDuration
            let headingDelay=cardDelay+cardDuration*0.5
            let titleDuration=JimiV9Motion.navigationCaption(entering:true,reducedMotion:reduced).duration+(reduced ? 0:Double((stars==3 ? "Legendary!":"Common").count-1)*NativeJourneyRewardController.titleLetterStagger)
            let subtitleDelay=headingDelay+titleDuration*0.9
            let anticipation=reduced ? 0:NativeJourneyRewardController.svgExitAnticipation
            if !reduced {
                XCTAssertEqual(cardDelay-anticipation,0.9*(NativeMagicCardSource.visibleExitEnd-NativeMagicCardSource.hold)*NativeJourneyRewardController.svgExitTimeScale,accuracy:0.000001)
                XCTAssertLessThan(cardDelay,0.4,"The authored blank SVG loop tail must not delay the visible card")
                let contact=try XCTUnwrap(interim.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation)
                let contactValues=try XCTUnwrap(contact.values as? [NSValue])
                let recipe=JimiV9Motion.worldHubElementExit().tweens[0]
                XCTAssertEqual(contact.duration,recipe.duration,accuracy:0.000001)
                XCTAssertEqual(Double(contactValues.last!.caTransform3DValue.m11),recipe.to.scaleX,accuracy:0.000001)
                XCTAssertEqual(Double(contactValues.last!.caTransform3DValue.m22),recipe.to.scaleY,accuracy:0.000001)
                XCTAssertTrue(tree(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
                clock.advance(anticipation-0.001)
                XCTAssertTrue(tree(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
                clock.advance(0.0011)
                XCTAssertTrue(tree(magic).contains{($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})},"Authored SVG exit begins at the anticipation completion")
            }
            let card=try XCTUnwrap(face.animation(forKey:"reward.transform.\(cardDelay)") as? CAKeyframeAnimation)
            let titleLayer:CALayer
            if reduced {titleLayer=heading.layer}else{titleLayer=try XCTUnwrap(heading.subviews.first?.layer)}
            let title=try XCTUnwrap(titleLayer.animation(forKey:"reward.transform.\(headingDelay)") as? CAKeyframeAnimation)
            let caption=try XCTUnwrap(subtitle.layer.animation(forKey:"reward.transform.\(subtitleDelay)") as? CAKeyframeAnimation)
            XCTAssertTrue(face.superlayer === interim.superlayer,"Card and exiting SVG have independent sibling carriers")
            XCTAssertEqual(title.beginTime-card.beginTime,cardDuration*0.5,accuracy:0.025)
            XCTAssertEqual(caption.beginTime-title.beginTime,titleDuration*0.9,accuracy:0.025)
            let navigation=JimiV9Motion.sampledTrack(JimiV9Motion.navigationCaption(entering:true,reducedMotion:reduced))
            assertNavigationCaption(title,on:titleLayer,delay:headingDelay,navigation:navigation)
            assertNavigationCaption(caption,on:subtitle.layer,delay:subtitleDelay,navigation:navigation)
            if reduced {
                XCTAssertTrue(heading.subviews.allSatisfy{($0.layer.animationKeys() ?? []).isEmpty},"Reduced Motion keeps one delayed title fade without a letter wave")
                XCTAssertEqual((title.values as? [NSValue])?.first?.caTransform3DValue.m42,0)
            }
            clock.advance(start+cardDelay-clock.time-0.0001);XCTAssertEqual(entryMoments,0)
            clock.advance(0.0002);XCTAssertEqual(entryMoments,1)
            clock.advance(start+controller.revealCompletionDelay-clock.time-0.0001)
            XCTAssertEqual(controller.phase,"revealing")
            clock.advance(0.0002);XCTAssertEqual(controller.phase,"unlocked")
            XCTAssertEqual(entryMoments,1)
        }}
    }
    func testDelayedSVGExitPreservesRemainingAnticipationAndRejectsRetiredCallbacks() throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();clock.advance(3)
        let start=clock.time;controller.activate()
        func tree(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{tree($0)}}
        let magic=try XCTUnwrap(tree(controller.view.layer).first{$0.name=="native.reward.magic-card"})
        let delayed=try XCTUnwrap(clock.jobs.first{abs($0.at-start-NativeJourneyRewardController.svgExitAnticipation)<0.000001})
        clock.advance(0.05);controller.setForeground(false)
        delayed.callback();clock.advance(10)
        XCTAssertTrue(tree(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
        XCTAssertEqual(controller.phase,"revealing")
        controller.setForeground(true)
        clock.advance(NativeJourneyRewardController.svgExitAnticipation-0.05-0.0001)
        XCTAssertTrue(tree(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
        clock.advance(0.0002)
        XCTAssertTrue(tree(magic).contains{($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
        controller.dispose();for job in clock.history {job.callback()}
        XCTAssertEqual(controller.phase,"disposed");XCTAssertEqual(clock.activeCount,0)
        XCTAssertTrue((magic.sublayers ?? []).isEmpty)
    }
    func testCommonSkipsAllUnlockedShimmerBurnPreparationButKeepsInterimSVGEffects() {
        for stars in [1,2] {
            let clock=Clock(),resources=Resources(),controller=screen(clock,resources,stars:stars)
            defer{controller.dispose()}
            resources.suppliedImage=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{context in UIColor.white.setFill();context.fill(CGRect(x:0,y:0,width:2,height:2))}
            var filters=0,faces=0
            controller.prepareFilteredFrames={images,_,done in filters+=1;done(images)}
            controller.prepareFaceEffects={_,_,done in faces+=1;done(NativeMagicCardSource.Node("g",[:]))}
            func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
            func passes()->[CALayer] {descendants(controller.view.layer).filter{$0.mask?.animation(forKey:"native.reward.magic-card.sheen") != nil}}
            resources.finish();controller.start();clock.advance(0.16);clock.advance(NativeMagicCardSource.fullyOpenAt+0.01)
            XCTAssertEqual(passes().count,1,"Common reward still retains the original interim SVG shimmer")
            XCTAssertTrue(descendants(controller.view.layer).contains{$0.name=="native.reward.magic-card.burn"},"Interim SVG burn is preserved")
            clock.advance(3);controller.activate();clock.advance(3)
            XCTAssertEqual(controller.phase,"unlocked");XCTAssertEqual(filters,0);XCTAssertEqual(faces,0)
            XCTAssertTrue(passes().isEmpty)
            XCTAssertFalse(descendants(controller.view.layer).contains{$0.name=="native.reward.magic-card.burn"})
            let glow=descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"}
            XCTAssertNil(glow?.contents);XCTAssertTrue((glow?.animationKeys() ?? []).isEmpty)
            controller.setForeground(false);clock.advance(5);controller.setForeground(true);clock.advance(1)
            XCTAssertTrue(passes().isEmpty);XCTAssertEqual(filters,0);XCTAssertEqual(faces,0)
            controller.activate();controller.dispose();clock.advance(10)
            XCTAssertEqual(clock.activeCount,0);XCTAssertEqual(controller.phase,"disposed")
        }
    }

    func testEffectsStartAtInterimArrivalAndUnlockedBounceEndAndCollectUsesStaggeredHomeExit() throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources,stars:3)
        defer {controller.dispose()}
        let image=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{context in UIColor.white.setFill();context.fill(CGRect(x:0,y:0,width:2,height:2))}
        resources.suppliedImage=image
        var prepared=0
        controller.prepareFaceEffects={image,_,completion in
            prepared+=1
            let root=NativeMagicCardSource.Node("g",[:]),face=NativeMagicCardSource.Node("image",["width":"360","height":"533"])
            face.image=image;face.sheenImage=image;root.children=[face];completion(root)
        }
        resources.finish();XCTAssertEqual(prepared,1,"Prepare selected face before reveal")
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        func passes()->[CAAnimation] {descendants(controller.view.layer).compactMap{$0.mask?.animation(forKey:"native.reward.magic-card.sheen")}}
        controller.start();clock.advance(0.16);clock.advance(NativeMagicCardSource.fullyOpenAt-0.001)
        XCTAssertTrue(passes().isEmpty)
        clock.advance(0.002);XCTAssertEqual(passes().count,1,"SVG effect starts at arrival")
        clock.advance(2);controller.activate();XCTAssertTrue(passes().isEmpty)
        clock.advance(NativeJourneyRewardController.unlockedArtworkEntryDelay+NativeRewardMotion.cardEnterDuration-0.001);XCTAssertTrue(passes().isEmpty)
        controller.setForeground(false);clock.advance(5);XCTAssertTrue(passes().isEmpty)
        controller.setForeground(true);clock.advance(0.002)
        XCTAssertEqual(passes().count,1,"Unlocked effect starts at the selected card entry completion")
        clock.advance(1);controller.activate();XCTAssertEqual(controller.phase,"exiting");XCTAssertTrue(passes().isEmpty)
        let exits=descendants(controller.view.layer).compactMap{layer -> CAKeyframeAnimation? in
            guard layer.name != "native.reward.collect-rotor",let key=layer.animationKeys()?.first(where:{$0.hasPrefix("reward.transform.")}),let animation=layer.animation(forKey:key) as? CAKeyframeAnimation,[NativeRewardMotion.collectExitTimeScale,NativeRewardMotion.collectCardExitTimeScale].contains(where:{abs(animation.duration-JimiV9Motion.homeExit(.hero).duration*$0)<0.00001}) else{return nil}
            return animation
        }.sorted{$0.beginTime<$1.beginTime}
        XCTAssertEqual(exits.count,3)
        if let values=exits.last?.values as? [NSValue] {
            let scales=values.map{$0.caTransform3DValue.m11}
            XCTAssertEqual(scales.first,1);XCTAssertEqual(scales.last,0)
            for index in 1..<scales.count {XCTAssertLessThan(scales[index],scales[index-1],"Card must shrink from the first sample, without an anticipation plateau")}
        }
        if exits.count==3 {
            XCTAssertEqual(exits[1].beginTime-exits[0].beginTime,0.08,accuracy:0.01)
            XCTAssertGreaterThan(exits[2].beginTime,exits[1].beginTime,"Text exits before the card finishes its contact bounce")
            let values=try XCTUnwrap(exits[2].values as? [NSValue])
            for (index,value) in values.enumerated() {
                let progress=Double(index)/Double(values.count-1)
                XCTAssertEqual(value.caTransform3DValue.m11,NativeRewardMotion.collectCardExitScale(progress:progress),accuracy:0.000001)
            }
        }
    }

    func testMountedCollectRelayoutKeepsCardAndTextBoundsAndVisibleStagger() async throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer {controller.dispose();window.isHidden=true;window.rootViewController=nil}
        resources.finish();controller.start();clock.advance(0.16);clock.advance(3);controller.activate();clock.advance(3)
        try await Task.sleep(for:.milliseconds(1250))
        controller.view.layoutIfNeeded()
        let heading=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? UILabel}.first{$0.text=="Common"})
        let subtitle=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? UILabel}.first{$0.attributedText?.string.hasPrefix("Unlocked")==true})
        let hero=try XCTUnwrap(controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"})
        let pose=try XCTUnwrap(hero.subviews.first)
        let targets=[pose,heading,subtitle],bounds=targets.map(\.bounds)
        controller.activate();XCTAssertEqual(controller.phase,"exiting")
        for _ in 0..<3 {controller.view.setNeedsLayout();controller.view.layoutIfNeeded()}
        print("[RewardCollect] relayout bounds before=\(bounds) after=\(targets.map(\.bounds))")
        for (index,target) in targets.enumerated(){XCTAssertEqual(target.bounds,bounds[index],"Collect layout cannot resize a zero-scale model")}
        try await Task.sleep(for:.milliseconds(40))
        for label in [heading,subtitle] {
            let presentation=try XCTUnwrap(label.layer.presentation())
            print("[RewardCollect] label=\(label.text ?? "") scale=\(presentation.transform.m11) opacity=\(presentation.opacity) bounds=\(presentation.bounds)")
            XCTAssertGreaterThan(presentation.transform.m11,0.9,"Delayed text remains visible at its held size")
            XCTAssertGreaterThan(presentation.opacity,0.9)
        }
    }

    func testColdFaceEffectsHoldRevealAndLateCompletionCannotRestartCollectOrDisposedOwner() throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources,stars:3)
        let image=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{context in UIColor.white.setFill();context.fill(CGRect(x:0,y:0,width:2,height:2))}
        resources.suppliedImage=image
        var finish:((NativeMagicCardSource.Node)->Void)?
        controller.prepareFaceEffects={_,_,completion in finish=completion}
        resources.finish();controller.start();clock.advance(0.16);clock.advance(3);controller.activate()
        XCTAssertEqual(controller.phase,"awaiting-artwork")
        let root=NativeMagicCardSource.Node("g",[:]),face=NativeMagicCardSource.Node("image",["width":"360","height":"533"])
        face.image=image.cgImage;face.sheenImage=image.cgImage;root.children=[face]
        controller.setForeground(false);finish?(root);clock.advance(4)
        XCTAssertEqual(controller.phase,"awaiting-artwork")
        controller.setForeground(true);XCTAssertEqual(controller.phase,"revealing")
        clock.advance(3);controller.activate();XCTAssertEqual(controller.phase,"exiting")
        controller.dispose();finish?(root);XCTAssertEqual(controller.phase,"disposed")
    }

    func testCommonAndLegendaryUnlockedCardsUseStrongBounceInAndRetire() throws {
        for stars in [1,3] {for reduced in [false,true] {
            let clock=Clock(),resources=Resources()
            let controller=NativeJourneyRewardController(root:NativeTestResources.root,board:11,score:1000,generation:77,awardedStars:stars,resources:resources,scheduler:clock,reducedMotion:reduced,random:{0.37},now:{clock.time})
            controller.prepareMagicCard={_,lease,completion in completion(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:lease))}
            controller.prepareFilteredFrames={images,_,completion in completion(images)}
            controller.loadViewIfNeeded();controller.view.frame=CGRect(x:0,y:0,width:390,height:844);controller.view.layoutIfNeeded()
            var speech:[(String,Int,Double)]=[]
            controller.onSoundMoment={kind,index,_ in if kind.hasSuffix("-speech") {speech.append((kind,index,clock.time))}}
            resources.finish();controller.start();clock.advance(0.16);controller.start();clock.advance(3);controller.activate();controller.activate()
            XCTAssertEqual(speech.map{$0.0},["new-card-interim-speech"])
            let cardDelay=reduced ? 0.16*0.9:NativeJourneyRewardController.unlockedArtworkEntryDelay
            clock.advance(cardDelay-0.001);XCTAssertEqual(speech.count,1)
            clock.advance(0.0011)
            XCTAssertEqual(speech.map{$0.0},["new-card-interim-speech","new-card-unlock-speech"])
            XCTAssertEqual(speech.last?.1,stars==3 ? 1:0)
            XCTAssertEqual(speech.last!.2,3.16+cardDelay,accuracy:0.00001)
            func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
            let burn=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"})
            let face=try XCTUnwrap(burn.superlayer?.superlayer)
            let animation=try XCTUnwrap(face.animation(forKey:"reward.transform.\(cardDelay)") as? CAKeyframeAnimation)
            let values=try XCTUnwrap(animation.values as? [NSValue])
            func scale(_ value:NSValue)->Double {let t=value.caTransform3DValue;return sqrt(t.m11*t.m11+t.m12*t.m12+t.m13*t.m13)}
            XCTAssertEqual(animation.duration,reduced ? 0.16:0.6,accuracy:0.000001)
            XCTAssertEqual(scale(values.first!),0,accuracy:0.000001)
            XCTAssertEqual(scale(values.last!),1.17,accuracy:0.000001)
            let scales=values.map(scale)
            if reduced {XCTAssertLessThanOrEqual(scales.max()!,1.170001)}
            else {
                XCTAssertGreaterThan(scales.max()!,1.17*1.12)
                XCTAssertLessThanOrEqual(scales.max()!,1.17*1.125001)
                XCTAssertEqual(NativeRewardMotion.cardEnterProgress(0.42),1.125,accuracy:0.000001)
                XCTAssertEqual(NativeRewardMotion.cardRestBounceProgress(0.42),1.125,accuracy:0.000001)
                XCTAssertEqual(NativeRewardMotion.cardEnterProgress(0.65),0.9,accuracy:0.000001)
                XCTAssertEqual(NativeRewardMotion.cardEnterProgress(0.81),1.08,accuracy:0.000001)
                for index in values.indices {
                    let expected=NativeRewardMotion.cardEnterProgress(Double(index)/Double(values.count-1))*1.17
                    XCTAssertEqual(scales[index],expected,accuracy:0.000001)
                }
            }
            controller.setForeground(false);XCTAssertEqual(controller.view.layer.speed,0)
            controller.setForeground(true);XCTAssertEqual(controller.view.layer.speed,1)
            controller.dispose();controller.dispose()
            XCTAssertTrue((face.animationKeys() ?? []).isEmpty);XCTAssertEqual(clock.activeCount,0)
        }}
    }
    func testExplicitCompletionAwardOwnsRewardRarityInsteadOfStatisticalHighScore() {
        for board in [1,11,21] {for (score,stars,rarity) in [(1000,3,"legendary"),(999999,1,"common")] {
            let clock=Clock(),resources=Resources()
            let controller=NativeJourneyRewardController(root:NativeTestResources.root,board:board,
                score:score,generation:77,awardedStars:stars,resources:resources,scheduler:clock)
            controller.prepareMagicCard={_,_,_ in}
            controller.loadViewIfNeeded()
            XCTAssertTrue(resources.requested.contains{$0.contains("/\(rarity)/")})
            XCTAssertFalse(resources.requested.contains{$0.contains("/\(rarity == "legendary" ? "common":"legendary")/")})
            controller.dispose(notify:false)
        }}
    }
    func testDetachedMagicPreparationDoesNotPlayAndDisposedWaiterCannotAdmit() throws {
        let controller=NativeJourneyRewardController(root:NativeTestResources.root,board:1,score:1000,generation:77)
        var finish:((NativeMagicCardSource.Node?)->Void)?
        controller.prepareMagicCard={_,_,completion in finish=completion}
        controller.loadViewIfNeeded()
        var admitted=0
        controller.whenMagicCardPrepared {admitted += 1}
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        finish?(source)
        XCTAssertEqual(admitted,1);XCTAssertNil(controller.parent);XCTAssertNil(controller.view.window)
        XCTAssertNotEqual(controller.phase,"opening")
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let magic=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.magic-card"})
        XCTAssertTrue(descendants(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
        controller.dispose();controller.whenMagicCardPrepared {admitted += 1};finish?(source)
        XCTAssertEqual(admitted,1)
    }
    private func assertNavigationCaption(_ motion:CAKeyframeAnimation,on layer:CALayer,delay:Double,navigation:JimiV9Motion.SampledTrack,file:StaticString=#filePath,line:UInt=#line) {
        guard let values=motion.values as? [NSValue],
              let alpha=layer.animation(forKey:"reward.opacity.\(delay)") as? CAKeyframeAnimation,
              let alphas=alpha.values as? [NSNumber] else {XCTFail("Missing paired navigation transform/opacity",file:file,line:line);return}
        XCTAssertEqual(motion.duration,navigation.duration,accuracy:0.000001,file:file,line:line)
        XCTAssertEqual(values.count,navigation.poses.count,file:file,line:line)
        XCTAssertEqual(alphas.count,navigation.poses.count,file:file,line:line)
        for (index,pose) in navigation.poses.enumerated() where index<values.count && index<alphas.count {
            XCTAssertEqual(Double(values[index].caTransform3DValue.m11),pose.scaleX,accuracy:0.000001,file:file,line:line)
            XCTAssertEqual(Double(values[index].caTransform3DValue.m22),pose.scaleY,accuracy:0.000001,file:file,line:line)
            XCTAssertEqual(Double(values[index].caTransform3DValue.m42),pose.y,accuracy:0.000001,file:file,line:line)
            XCTAssertEqual(alphas[index].doubleValue,pose.opacity,accuracy:0.000001,file:file,line:line)
        }
        XCTAssertEqual(alphas.first?.doubleValue ?? -1,0,accuracy:0.000000000001,file:file,line:line)
        XCTAssertEqual(alphas.last?.doubleValue ?? -1,1,accuracy:0.000000000001,file:file,line:line)
    }
    private final class Token:NativeMusicCancellation {var cancelled=false;func cancel(){cancelled=true}}
    private final class Clock:NativeMusicScheduler {
        struct Job {let token:Token,at:Double,callback:()->Void}
        var time=0.0,jobs:[Job]=[],history:[Job]=[]
        func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {let token=Token(),job=Job(token:token,at:time+seconds,callback:callback);jobs.append(job);history.append(job);return token}
        func advance(_ seconds:Double){let target=time+seconds;while let next=jobs.filter({!$0.token.cancelled && $0.at<=target}).min(by:{$0.at<$1.at}) {jobs.removeAll{$0.token===next.token};time=next.at;next.callback()};time=target}
        var activeCount:Int {jobs.filter{!$0.token.cancelled}.count}
    }
    private final class Resources:NativeRewardResources {
        var requested:[String]=[],reads:[String]=[],releases:[Int]=[]
        var suppliedImage:UIImage?
        var completion:((Bool)->Void)?
        func image(_ path:String,owner:Int)->UIImage? {reads.append(path);return suppliedImage ?? UIImage()}
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){requested=paths;self.completion=completion}
        func release(_ owner:Int){releases.append(owner)}
        func finish(){let callback=completion;completion=nil;callback?(true)}
    }
    private func screen(_ clock:Clock,_ resources:Resources,reduced:Bool=false,stars:Int?=nil,root:URL=URL(fileURLWithPath:"/unused"))->NativeJourneyRewardController {
        let screen=NativeJourneyRewardController(root:root,board:11,score:1000,generation:77,awardedStars:stars,resources:resources,scheduler:clock,reducedMotion:reduced,random:{0.37},now:{clock.time});screen.prepareMagicCard={_,lease,completion in completion(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:lease))};screen.prepareFilteredFrames={images,_,completion in completion(images)};screen.loadViewIfNeeded();screen.view.frame=CGRect(x:0,y:0,width:390,height:844);screen.view.layoutIfNeeded();return screen
    }
    func testInterimAndUnlockedHaveNoFloorShadowAndUnlockedBurnHasNoSweep() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources,stars:3)
        let hero=controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"}!
        let pose=hero.layer.sublayers!.first{$0.name=="native.reward.card-pose"}!
        XCTAssertTrue(pose.superlayer === hero.layer)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        XCTAssertFalse(descendants(hero.layer).contains{$0.name=="native.reward.floor-shadow"},"Interim has no separate floor shadow")
        let burn=descendants(hero.layer).first{$0.name=="native.reward.unlocked-burn"}!
        XCTAssertTrue((burn.sublayers ?? []).isEmpty)
        let carrier=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image {context in
            UIColor(red:0.4,green:0.2,blue:0.1,alpha:1).setFill();context.fill(CGRect(x:0,y:0,width:1,height:2))
        }
        controller.prepareFilteredFrames={images,_,completion in
            var prepared=images;for path in images.keys where path.contains("colelctibles") {prepared[path+"#burn"]=carrier};completion(prepared)
        }
        resources.finish();controller.start();clock.advance(0.16);controller.activate();clock.advance(NativeMagicCardSource.hold+controller.revealCompletionDelay+0.001)
        controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        XCTAssertEqual(controller.phase,"unlocked")
        XCTAssertFalse(descendants(hero.layer).contains{$0.name=="native.reward.floor-shadow"},"Unlocked card has no separate floor shadow")
        XCTAssertNotNil(burn.contents)
        let pulse=burn.animation(forKey:"reward.opacity.0.0") as? CAKeyframeAnimation
        XCTAssertNotNil(pulse);XCTAssertEqual(pulse?.duration ?? 0,0.5,accuracy:0.000001)
        XCTAssertEqual(pulse?.keyTimes,[0,0.56,1].map{NSNumber(value:$0)})
        XCTAssertEqual(pulse?.values as? [Int],[0,1,0])
        XCTAssertNil(burn.animation(forKey:"transform"))
        controller.dispose();XCTAssertTrue((burn.animationKeys() ?? []).isEmpty)
    }
    func testAuthoredSVGOpeningHoldsWithParentIdleAndClickStartsBothFaces() throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();clock.advance(0.16);XCTAssertEqual(controller.phase,"opening")
        clock.advance(0.7)
        XCTAssertEqual(controller.phase,"opening")
        clock.advance(NativeMagicCardSource.hold)
        XCTAssertEqual(controller.phase,"interim");XCTAssertEqual(clock.activeCount,0)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let layers=descendants(controller.view.layer),magic=layers.first{$0.name=="native.reward.magic-card"}!
        XCTAssertEqual(descendants(magic).filter{($0.name ?? "").hasPrefix("magic.image.")}.count,9)
        XCTAssertTrue(descendants(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
        let rotor=magic.superlayer!,pose=rotor.superlayer!.superlayer!
        for layer in [pose,rotor] {
            let idle=layer.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation
            XCTAssertEqual(idle?.duration,3);XCTAssertEqual(idle?.repeatCount,.infinity)
            let values=idle?.values as? [NSValue]
            XCTAssertTrue(CATransform3DEqualToTransform(values!.first!.caTransform3DValue,values!.last!.caTransform3DValue))
        }
        controller.setForeground(false);XCTAssertEqual(controller.view.layer.speed,0)
        controller.setForeground(true);XCTAssertEqual(controller.view.layer.speed,1)
        XCTAssertFalse(layers.contains{$0.name=="native.reward.interim-shimmer" || $0.name=="native.reward.interim-burn"})
        clock.advance(30);XCTAssertEqual(clock.activeCount,0);XCTAssertEqual(controller.phase,"interim")
        controller.activate();XCTAssertEqual(controller.phase,"revealing")
        XCTAssertEqual(rotor.animation(forKey:"reward.transform.0.0")?.repeatCount,0)
        XCTAssertTrue(descendants(magic).allSatisfy{!($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})},"Click first grows the interim carrier; SVG exit has not started")
        clock.advance(NativeJourneyRewardController.svgExitAnticipation)
        XCTAssertTrue(descendants(magic).contains{($0.animationKeys() ?? []).contains(where:{$0.hasPrefix("magic.")})})
        let unlockedBurn=layers.first{$0.name=="native.reward.unlocked-burn"}!
        let unlocked=unlockedBurn.superlayer!.superlayer!
        XCTAssertTrue(unlocked is CATransformLayer);XCTAssertEqual(unlocked.opacity,1)
        XCTAssertNotNil(unlocked.animation(forKey:"reward.transform.\(NativeJourneyRewardController.unlockedArtworkEntryDelay)"))
        XCTAssertNil(unlocked.animation(forKey:"reward.opacity.\(NativeJourneyRewardController.unlockedArtworkEntryDelay)"),"Spatial owner must not flatten its3D subtree to apply opacity")
        let front=try XCTUnwrap(descendants(controller.view.layer).first{$0.name=="native.reward.card-front"})
        XCTAssertNotNil(front.animation(forKey:"reward.opacity.\(NativeJourneyRewardController.unlockedArtworkEntryDelay)"),"The paint leaf owns the exact delayed reveal opacity")
        controller.dispose();XCTAssertNil(magic.sublayers);XCTAssertEqual(clock.activeCount,0)
        XCTAssertTrue((pose.animationKeys() ?? []).isEmpty);XCTAssertTrue((rotor.animationKeys() ?? []).isEmpty)
    }
    func testReducedMotionSettledInterimHasNoIdleOrRecurringWork() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources,reduced:true)
        resources.finish();controller.start();clock.advance(0.16);clock.advance(1)
        XCTAssertEqual(controller.phase,"interim");XCTAssertEqual(clock.activeCount,0)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let magic=descendants(controller.view.layer).first{$0.name=="native.reward.magic-card"}!
        XCTAssertNil(magic.superlayer!.animation(forKey:"reward.transform.0.0"))
        controller.dispose()
    }
    func testOpeningPauseAndLateSVGPreparationAreOwnedByRewardLifetime()throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        resources.finish();controller.start();clock.advance(0.16);clock.advance(0.8);controller.activate();controller.activate()
        controller.setForeground(false);clock.advance(10);XCTAssertEqual(controller.phase,"opening");XCTAssertEqual(clock.activeCount,0)
        controller.setForeground(true);clock.advance(0.8);XCTAssertEqual(controller.phase,"revealing")
        controller.activate();clock.advance(controller.revealCompletionDelay+0.001);XCTAssertEqual(controller.phase,"exiting")
        let collectDeadline=try XCTUnwrap(clock.jobs.filter{!$0.token.cancelled}.map(\.at).max())
        clock.advance(collectDeadline-clock.time+0.001);XCTAssertEqual(controller.phase,"disposed")
        for job in clock.history {job.callback()};XCTAssertEqual(clock.activeCount,0)
    }
    func testUnlockedRevealDoesNotRestartItsBurnBeforePeak() throws {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources,stars:3)
        resources.finish();controller.start();clock.advance(0.16);clock.advance(2.1);controller.activate();clock.advance(1.2)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let burn=descendants(controller.view.layer).first{$0.name=="native.reward.unlocked-burn"}!
        let first=try XCTUnwrap(burn.animation(forKey:"reward.opacity.0.0")).beginTime
        clock.advance(controller.revealCompletionDelay-1.2+0.001)
        XCTAssertEqual(controller.phase,"unlocked")
        XCTAssertEqual(try XCTUnwrap(burn.animation(forKey:"reward.opacity.0.0")).beginTime,first)
        controller.dispose()
    }
    func testOffMainSelectedBurnCarrierChangesColorAndPreservesTransparentPixels() async {
        let bytes:[UInt8]=[102,51,26,255,0,0,0,0,102,51,26,255,0,0,0,0]
        let provider=CGDataProvider(data:Data(bytes) as CFData)!
        let source=CGImage(width:2,height:2,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:8,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedLast.rawValue),provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent)!
        let image=UIImage(cgImage:source,scale:1,orientation:.up)
        let ready=expectation(description:"selected burn prepared")
        let path="./assets/colelctibles/Forest/common/1@2x.png"
        NativeRewardFilteredFrames.prepare([path:image],lease:NativeRewardPreparationLease()) {prepared in
            guard let output=prepared[path+"#burn"]?.cgImage,let input=image.cgImage else {XCTFail("Burn carrier missing");ready.fulfill();return}
            func pixels(_ cg:CGImage)->[UInt8] {
                var bytes=[UInt8](repeating:0,count:16)
                bytes.withUnsafeMutableBytes {storage in
                    let context=CGContext(data:storage.baseAddress,width:2,height:2,bitsPerComponent:8,bytesPerRow:8,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.interpolationQuality = .none;context.draw(cg,in:CGRect(x:0,y:0,width:2,height:2))
                };return bytes
            }
            let original=pixels(input),burn=pixels(output)
            XCTAssertGreaterThan(burn[0],original[0]);XCTAssertEqual(burn[3],original[3]);XCTAssertEqual(original[3],255);XCTAssertEqual(original[7],0);XCTAssertEqual(burn[7],original[7])
            ready.fulfill()
        }
        await fulfillment(of:[ready],timeout:3)
    }
    func testCanonicalTSOracleProfilesGesturesAndCopy() {
        for (draws,expected) in NativeRewardOracleFixtures.profiles {
            var index=0;let value=NativeRewardPresentation.Tilt(random:{defer{index += 1};return draws[index]})
            let actual=[value.interimZ,value.interimX,value.interimY,value.interimExitZ,value.interimExitX,value.interimExitY,value.entryZ,value.entryX,value.entryY,value.restZ,value.restX,value.restY,value.exitZ,value.exitX,value.exitY]
            XCTAssertEqual(actual.count,expected.count);for (a,b) in zip(actual,expected) {XCTAssertEqual(a,b,accuracy:0.0000001)};XCTAssertEqual(index,draws.count)
        }
        for (input,angle,collect) in NativeRewardOracleFixtures.inputs {
            XCTAssertEqual(NativeRewardPresentation.dragTilt(start:input[0],deltaX:input[1],width:input[2]),angle,accuracy:0.0000001)
            XCTAssertEqual(NativeRewardPresentation.collectDrag(deltaX:input[1],deltaY:input[3],cardHeight:input[4]),collect)
        }
        // Native card slots and display names follow the current authored art.
        // The historical PWA oracle remains immutable for its motion/math checks.
        let nativeNames=[
            "Weee - Beee","Star Is Out","Flower Day","Honey Splat","Dreamy","Shroomy","Pooof","CHAAARGE!","Flying Tent","Winner",
            "Fresh Juice","Fishy","Bouncy Day","Bottle Tips","Castle Ruins","Bonkers","Looky Here","Fly Away","The Letter","Life Saver",
            "Bibi - Ribi","The Bloob","Woombuu","Zap - Zap","Beam Up","Peekaboo","Hello, Goo!","Transport","Bloob Spill","Take Over"
        ]
        XCTAssertEqual(NativeRewardPresentation.names,nativeNames)
        for board in 1...30 {XCTAssertEqual(NativeRewardPresentation.name(board:board),nativeNames[board-1])}
    }
    func testComponentExitRetainsAuthoredAnglesAtZeroScaleAndCorrectCSSRotationOrder() {
        let start=NativeRewardMotion.pose(scaleX:1.3806,scaleY:1.3455,y:40,z:3,x:-2,ry:2.5)
        let end=NativeRewardMotion.pose(scale:0,y:40,z:6,x:-7,ry:6,depth:-188)
        let middle=start.interpolated(to:end,progress:0.5)
        XCTAssertEqual(middle.scaleX,0.6903,accuracy:0.000001)
        XCTAssertEqual(middle.rotationZ,4.5);XCTAssertEqual(middle.rotationX,-4.5);XCTAssertEqual(middle.rotationY,4.25);XCTAssertEqual(middle.depth,-94)
        // The endpoint still owns angular/depth data when its final matrix
        // has zero visible scale; matrix interpolation cannot recover these.
        XCTAssertEqual(end.rotationX,-7);XCTAssertEqual(end.rotationY,6)
        var reference=CATransform3DIdentity;reference.m34 = -1/1050
        reference=CATransform3DTranslate(reference,0,40,-94)
        reference=CATransform3DRotate(reference,4.5 * .pi/180,0,0,1)
        reference=CATransform3DRotate(reference,4.25 * .pi/180,0,1,0)
        reference=CATransform3DRotate(reference,-4.5 * .pi/180,1,0,0)
        reference=CATransform3DScale(reference,0.6903,0.67275,1)
        XCTAssertTrue(CATransform3DEqualToTransform(middle.transform,reference))
    }
    func testLegendaryReflectionMatchesIndependentCanonicalFoilOwnerIncludingBackAndWrap() {
        for fixture in NativeRewardFoilOracle.states {
            let state=NativeRewardFoilPlanning.reflection(fixture[0])
            XCTAssertEqual(state.opacity,fixture[1],accuracy:0.000001)
            XCTAssertEqual(state.gold,fixture[2],accuracy:0.000001)
            XCTAssertEqual(state.rainbow,fixture[3],accuracy:0.000001)
        }
        XCTAssertEqual(NativeRewardFoilPlanning.reflection(.nan).opacity,0)
        XCTAssertEqual(NativeRewardMotion.cubic(0.5,0.42,0,0.58,1),0.5,accuracy:0.000001)
    }
    func testEarlyVisibleRewardCannotRevealUntilCanonicalActionsAreAdmitted() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources);resources.finish()
        controller.setRewardActionsAdmitted(false);controller.start();clock.advance(0.16);controller.activate()
        clock.advance(2);XCTAssertEqual(controller.phase,"interim")
        controller.setRewardActionsAdmitted(true);controller.activate();XCTAssertEqual(controller.phase,"revealing")
        controller.dispose()
    }
    func testSVGStartsImmediatelyWithoutWaitingForUnlockedArtworkOrFilters() {
        let clock=Clock(),resources=Resources(),controller=screen(clock,resources)
        controller.start();clock.advance(0.16);XCTAssertEqual(controller.phase,"opening")
        let hero=controller.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"}!
        let pose=hero.layer.sublayers!.first{$0.name=="native.reward.card-pose"}!
        let bounce=pose.animation(forKey:"reward.transform.\(NativeMagicCardSource.fullyOpenAt)") as? CAKeyframeAnimation
        XCTAssertEqual(bounce?.duration,0.6)
        let scales=(bounce?.values as? [NSValue] ?? []).map{value in let t=value.caTransform3DValue;return sqrt(t.m11*t.m11+t.m12*t.m12+t.m13*t.m13)}
        XCTAssertEqual(scales.first,1);XCTAssertEqual(scales.last,1)
        XCTAssertLessThan(NativeMagicCardSource.fullyOpenAt+0.6,NativeMagicCardSource.hold)
        for index in scales.indices {
            let progress=Double(index)/Double(scales.count-1)
            XCTAssertEqual(scales[index],NativeRewardMotion.cardRestBounceProgress(progress),accuracy:0.000001)
            if progress>=0.42 {XCTAssertEqual(scales[index],NativeRewardMotion.cardEnterProgress(progress),accuracy:0.000001)}
        }
        XCTAssertGreaterThan(scales.max() ?? 0,1.12)
        XCTAssertLessThanOrEqual(scales.max() ?? 0,1.125001)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let magic=descendants(pose).first{$0.name=="native.reward.magic-card"}!
        let cardScale=magic.sublayers!.first!.sublayers!.first!.sublayers!.first!
        XCTAssertNil(cardScale.animation(forKey:"magic.transform"),"SVG must not multiply the common parent spring by its authored scale bounce")
        XCTAssertTrue(CATransform3DIsIdentity(cardScale.transform))
        XCTAssertTrue(resources.reads.isEmpty,"Unlocked artwork is still cold")
        clock.advance(NativeMagicCardSource.hold);XCTAssertEqual(controller.phase,"interim")
        controller.dispose()
    }
    func testImmediateMountOnlyPreparesSelectedArtAndLayoutNeverStartsColdDecode() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        XCTAssertEqual(view.phase,"mounted");XCTAssertTrue(resources.reads.isEmpty)
        XCTAssertEqual(resources.requested.filter{$0.contains("zguzvano")}.count,0)
        XCTAssertEqual(resources.requested.filter{$0.contains("colelctibles")}.count,3)
        XCTAssertTrue(resources.requested.contains(NativeJourneyRewardController.collectBackAssetPath),"Only the selected World-return backside joins its two selected face densities")
        resources.finish();let reads=resources.reads.count
        view.view.setNeedsLayout();view.view.layoutIfNeeded();XCTAssertEqual(resources.reads.count,reads)
        view.dispose();XCTAssertEqual(resources.releases.count,1)
    }
    func testOpeningCrumbsAtTwentyPercentPuffAtFiftyAndDisposeCancels() {
        for reduced in [false,true] {
            let clock=Clock(),resources=Resources(),view=screen(clock,resources,reduced:reduced);resources.finish()
            var moments:[(String,Double)]=[]
            view.onSoundMoment={kind,_,_ in moments.append((kind,clock.time))}
            view.start();clock.advance(0.16)
            let duration=reduced ? 0.16:NativeMagicCardSource.hold
            clock.advance(duration*0.20-0.001)
            XCTAssertFalse(moments.contains{$0.0=="new-card-intro" || $0.0=="new-card-crumble"})
            clock.advance(0.0011)
            XCTAssertEqual(moments.first{$0.0=="new-card-intro"}?.1 ?? -1,0.16+duration*0.20,accuracy:0.00001)
            XCTAssertEqual(moments.first{$0.0=="new-card-crumble"}?.1 ?? -1,0.16+duration*0.20,accuracy:0.00001)
            clock.advance(duration*0.30-0.0002)
            XCTAssertFalse(moments.contains{$0.0=="new-card-opening-puff"})
            clock.advance(0.0002)
            XCTAssertEqual(moments.first{$0.0=="new-card-opening-puff"}?.1 ?? -1,0.16+duration*0.50,accuracy:0.00001)
            view.dispose();let count=moments.count
            for job in clock.history {job.callback()}
            XCTAssertEqual(moments.count,count)
        }
    }

    func testInterimArrivalUsesUnlockedShakeBeforeSettleAndOrderedEntrySurvivesBackground()throws {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources);resources.finish()
        defer{view.dispose()}
        var reveals=0;view.onSoundMoment={kind,_,_ in if kind=="new-card-reveal" {reveals += 1}}
        view.start();clock.advance(0.16);view.activate();clock.advance(NativeMagicCardSource.fullyOpenAt-0.001)
        XCTAssertNil(view.view.layer.animation(forKey:"reward.transform.0.0"))
        clock.advance(0.0011)
        let shake=try XCTUnwrap(view.view.layer.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation)
        XCTAssertEqual(shake.duration,0.42);XCTAssertEqual(shake.repeatCount,0)
        let shakeValues=try XCTUnwrap(shake.values as? [NSValue]);XCTAssertEqual(shakeValues[1].caTransform3DValue.m41,22)
        XCTAssertEqual(view.phase,"opening");XCTAssertEqual(reveals,0)
        view.activate();view.activate();XCTAssertEqual(reveals,0)
        view.setForeground(false);clock.advance(10);XCTAssertEqual(view.phase,"opening")
        view.setForeground(true);clock.advance(NativeMagicCardSource.hold-NativeMagicCardSource.fullyOpenAt-0.0002);XCTAssertEqual(reveals,0)
        clock.advance(0.0002);XCTAssertEqual(view.phase,"revealing");XCTAssertEqual(reveals,1)
        let labels=view.view.subviews.compactMap{$0 as? UILabel}
        let subtitle=try XCTUnwrap(labels.first{($0.text ?? "").hasPrefix("Unlocked ")})
        let heading=try XCTUnwrap(labels.first{["Common","Legendary!"].contains($0.text ?? "")})
        let first=try XCTUnwrap(heading.subviews.first?.layer.animation(forKey:"reward.transform.\(NativeJourneyRewardController.unlockedHeadingEntryDelay)"))
        let second=try XCTUnwrap(subtitle.layer.animation(forKey:"reward.transform.\(view.subtitleEntryDelay)"))
        func tree(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{tree($0)}}
        let face=try XCTUnwrap(tree(view.view.layer).first{$0.name=="native.reward.unlocked-spatial"})
        let third=try XCTUnwrap(face.animation(forKey:"reward.transform.\(NativeJourneyRewardController.unlockedArtworkEntryDelay)"))
        let a=heading.subviews.first!.layer.convertTime(first.beginTime,to:nil),b=subtitle.layer.convertTime(second.beginTime,to:nil),c=face.convertTime(third.beginTime,to:nil)
        XCTAssertEqual(a-c,NativeRewardMotion.cardEnterDuration*0.5,accuracy:0.025)
        XCTAssertEqual(b-a,(JimiV9Motion.navigationCaption(entering:true,reducedMotion:false).duration+Double((heading.text ?? "").count-1)*NativeJourneyRewardController.titleLetterStagger)*0.9,accuracy:0.025)
        XCTAssertEqual(third.duration,NativeRewardMotion.cardEnterDuration)
        clock.advance(view.revealCompletionDelay-0.001);XCTAssertEqual(view.phase,"revealing")
        clock.advance(0.003);XCTAssertEqual(view.phase,"unlocked")
        view.dispose();XCTAssertEqual(clock.activeCount,0);XCTAssertNil(view.view.layer.animationKeys())
    }
    func testEarlyTapCannotSkipOpeningOrQueueInvisibleCollect() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources);resources.finish()
        var outcomes:[NativeJourneyRewardController.Action]=[],sounds:[String]=[]
        view.onFinish={outcomes.append($0)};view.onSoundMoment={kind,_,_ in sounds.append(kind)}
        view.start();clock.advance(0.16);view.activate();view.activate();XCTAssertEqual(view.phase,"opening")
        clock.advance(NativeMagicCardSource.hold+view.revealCompletionDelay+0.001);XCTAssertEqual(outcomes.count,0);XCTAssertEqual(view.phase,"unlocked")
        view.activate();clock.advance(2);XCTAssertEqual(outcomes.count,1);XCTAssertEqual(view.phase,"disposed")
        XCTAssertTrue(sounds.contains("new-card-crumble"));XCTAssertEqual(sounds.filter{$0=="new-card-reveal"}.count,1);XCTAssertEqual(sounds.filter{$0=="new-card-unlocked-enter"}.count,1)
        XCTAssertEqual(sounds.filter{$0=="modal-open"}.count,1);XCTAssertEqual(sounds.filter{$0=="new-card-collect"}.count,1)
        XCTAssertFalse(sounds.contains("modal-exit"));XCTAssertFalse(sounds.contains("cta"))
        view.activate();view.dispose();for job in clock.history {job.callback()};XCTAssertEqual(outcomes.count,1);XCTAssertEqual(clock.activeCount,0)
    }
    func testColdEarlyRevealWaitsForRequiredArtworkAndKeepsSecondTapWithoutInvisibleCollect() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        var outcomes=0,reveals=0
        view.onFinish={_ in outcomes += 1};view.onSoundMoment={kind,_,_ in if kind=="new-card-reveal" {reveals += 1}}
        view.start();clock.advance(0.16);view.activate();view.activate();clock.advance(4)
        XCTAssertEqual(view.phase,"awaiting-artwork");XCTAssertEqual(outcomes,0);XCTAssertEqual(reveals,0)
        view.setForeground(false);resources.finish();clock.advance(10)
        XCTAssertEqual(view.phase,"awaiting-artwork");XCTAssertEqual(reveals,0)
        view.setForeground(true);XCTAssertEqual(view.phase,"revealing");clock.advance(3)
        XCTAssertEqual(reveals,1);XCTAssertEqual(outcomes,0);view.activate();clock.advance(2);XCTAssertEqual(outcomes,1)
    }
    func testRejectedRequiredArtworkCannotRevealOrCollect() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        var outcomes=0,failures=0;view.onFinish={_ in outcomes += 1};view.onAssetFailure={_ in failures += 1}
        view.start();clock.advance(0.16);view.activate();resources.completion?(false);resources.completion=nil
        view.activate();clock.advance(20)
        XCTAssertEqual(view.phase,"asset-failed");XCTAssertEqual(outcomes,0);XCTAssertEqual(failures,1)
        view.dispose();XCTAssertEqual(outcomes,1)
    }
    func testCollectTurnsToWorldBackThenMainArtworkAndRetiresAcrossBackground()throws {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        defer{view.dispose()}
        resources.finish();view.start();clock.advance(0.16);clock.advance(3);view.activate();clock.advance(3)
        XCTAssertEqual(view.phase,"unlocked")
        func tree(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{tree($0)}}
        let layers=tree(view.view.layer)
        let rotor=try XCTUnwrap(layers.first{$0.name=="native.reward.collect-rotor"})
        XCTAssertTrue(rotor is CATransformLayer)
        let back=try XCTUnwrap(layers.first{$0.name=="native.reward.collect-back"})
        XCTAssertFalse(back.isDoubleSided);XCTAssertEqual(back.transform.m11,-NativeRewardPresentation.unlockedArtworkScale,accuracy:0.00001)
        XCTAssertTrue(resources.requested.contains("assets/colelctibles/cardflip@22.png"))
        var sounds:[String]=[],outcomes=0
        view.onSoundMoment={kind,_,_ in sounds.append(kind)};view.onFinish={_ in outcomes+=1}
        view.activate();view.activate()
        XCTAssertEqual(sounds,["new-card-collect"]);XCTAssertEqual(view.phase,"exiting")
        let flip=try XCTUnwrap(rotor.animation(forKey:"reward.transform.0.4") as? CAKeyframeAnimation)
        let samples=try XCTUnwrap(flip.values as? [NSValue])
        XCTAssertEqual(samples.count,201);XCTAssertEqual(flip.duration,NativeRewardMotion.collectFlipDuration(forExitDuration:JimiV9Motion.homeExit(.hero).duration)*2)
        XCTAssertEqual(samples.first!.caTransform3DValue.m11,1,accuracy:0.00001)
        XCTAssertEqual(samples[100].caTransform3DValue.m11,-1,accuracy:0.00001)
        XCTAssertEqual(samples.last!.caTransform3DValue.m11,1,accuracy:0.00001)
        for index in 1...100 {
            let previous=NativeRewardMotion.collectFlipAngle(progress:Double(index-1)/100)
            let angle=NativeRewardMotion.collectFlipAngle(progress:Double(index)/100)
            XCTAssertGreaterThanOrEqual(angle,previous);XCTAssertLessThanOrEqual(angle,.pi)
        }
        XCTAssertEqual(NativeRewardMotion.collectFlipAngle(progress:0),0)
        XCTAssertEqual(NativeRewardMotion.collectFlipAngle(progress:0.5),.pi/2,accuracy:0.000001)
        XCTAssertEqual(NativeRewardMotion.collectFlipAngle(progress:1),.pi,accuracy:0.000001)
        clock.advance(0.1);view.setForeground(false);clock.advance(10)
        XCTAssertEqual(outcomes,0);XCTAssertEqual(view.phase,"exiting")
        view.setForeground(true);clock.advance(2)
        XCTAssertEqual(outcomes,1);XCTAssertEqual(sounds.filter{$0=="new-card-collect"}.count,1)
        view.dispose();view.dispose();XCTAssertTrue((rotor.animationKeys() ?? []).isEmpty)
        XCTAssertNil(back.contents);XCTAssertEqual(clock.activeCount,0)
    }
    func testRepeatedPhoneAndTabletCollectOverlapsFlipsWithSlowerExit()throws {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for reduced in [false,true] {
                // Independent openings share a deterministic random source so
                // both directions and the boundary draw are exercised in order.
                var draw=0.0,draws=0
                for value in [0.0,0.99,0.49,0.5] {
                    let clock=Clock(),resources=Resources()
                    let view=NativeJourneyRewardController(root:NativeTestResources.root,board:11,score:1000,generation:77,awardedStars:3,resources:resources,scheduler:clock,reducedMotion:reduced,random:{draws+=1;return draw},now:{clock.time})
                    view.prepareMagicCard={_,lease,done in done(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:lease))}
                    view.prepareFilteredFrames={images,_,done in done(images)}
                    let window=UIWindow(frame:CGRect(origin:.zero,size:size));window.rootViewController=view;window.makeKeyAndVisible()
                    defer{view.dispose();window.isHidden=true;window.rootViewController=nil}
                    view.loadViewIfNeeded();view.view.frame=window.bounds;view.view.layoutIfNeeded()
                    resources.finish();view.start();clock.advance(0.16);clock.advance(3);view.activate();clock.advance(3)
                    XCTAssertEqual(view.phase,"unlocked")
                    func tree(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{tree($0)}}
                    let rotor=try XCTUnwrap(tree(view.view.layer).first{$0.name=="native.reward.collect-rotor"})
                    draw=value;let before=draws
                    var outcomes=0;view.onFinish={_ in outcomes+=1}
                    view.activate();view.activate()
                    XCTAssertEqual(draws-before,reduced ? 0:1,"Duplicate collect must not redraw direction")
                    if reduced {
                        XCTAssertNil(rotor.animation(forKey:"reward.transform.0.4"))
                    } else {
                        let animation=try XCTUnwrap(rotor.animation(forKey:"reward.transform.0.4") as? CAKeyframeAnimation)
                        let samples=try XCTUnwrap(animation.values as? [NSValue])
                        let start=samples[0].caTransform3DValue
                        XCTAssertEqual(samples.count,201)
                        for index in 0...200 {
                            let progress=Double(index)/100
                            let angle=(value<0.5 ? -1.0:1.0)*(NativeRewardMotion.collectFlipAngle(progress:progress)+NativeRewardMotion.collectFlipAngle(progress:progress-1))
                            let expected=CATransform3DRotate(start,angle,0,1,0)
                            XCTAssertTrue(CATransform3DEqualToTransform(samples[index].caTransform3DValue,expected))
                        }
                        XCTAssertEqual(animation.duration,NativeRewardMotion.collectFlipDuration(forExitDuration:JimiV9Motion.homeExit(.hero).duration)*2)
                        let pose=try XCTUnwrap(tree(view.view.layer).first{$0.name=="native.reward.card-pose"})
                        let key=try XCTUnwrap(pose.animationKeys()?.first{$0.hasPrefix("reward.transform.")})
                        let collapse=try XCTUnwrap(pose.animation(forKey:key) as? CAKeyframeAnimation)
                        XCTAssertEqual(collapse.beginTime,animation.beginTime+animation.duration/2,accuracy:0.000001,"Visible card shrink starts exactly with the return turn")
                        XCTAssertEqual(collapse.fillMode,.backwards)
                        XCTAssertEqual(collapse.duration,JimiV9Motion.homeExit(.hero).duration*NativeRewardMotion.collectCardExitTimeScale)
                        let halfwayThroughReturn=(animation.duration/4)/collapse.duration
                        XCTAssertLessThan(NativeRewardMotion.collectCardExitScale(progress:halfwayThroughReturn),0.85,"Card must be visibly smaller before return flip completes")
                    }
                    view.setForeground(false);clock.advance(10);XCTAssertEqual(outcomes,0)
                    view.setForeground(true);clock.advance(2);XCTAssertEqual(outcomes,1)
                    XCTAssertEqual(draws-before,reduced ? 0:1,"Resume retains the accepted direction")
                    view.dispose();XCTAssertEqual(clock.activeCount,0);XCTAssertTrue((rotor.animationKeys() ?? []).isEmpty)
                }
            }
        }
    }
    func testCollectHandsOffAtVisibleExitEndWithoutExtraBlankDelay()throws {
        for reduced in [false,true] {
            let clock=Clock(),resources=Resources(),view=screen(clock,resources,reduced:reduced);resources.finish()
            defer{view.dispose()}
            var outcomes=0;view.onFinish={_ in outcomes+=1}
            view.start();clock.advance(0.16);clock.advance(3);view.activate();clock.advance(3)
            XCTAssertEqual(view.phase,"unlocked");view.activate()
            func tree(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{tree($0)}}
            let fade=try XCTUnwrap(view.view.layer.animationKeys()?.compactMap{view.view.layer.animation(forKey:$0) as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
            if !reduced {
                let ends=tree(view.view.layer).flatMap{layer in
                    (layer.animationKeys() ?? []).compactMap {key -> Double? in
                        guard let animation=layer.animation(forKey:key) as? CAKeyframeAnimation,animation.keyPath=="transform",animation.repeatCount==0 else{return nil}
                        return layer.convertTime(animation.beginTime+animation.duration,to:view.view.layer)
                    }
                }
                XCTAssertEqual(fade.beginTime,try XCTUnwrap(ends.max()),accuracy:0.00001,"No blank hold after the last actual transform/shake")
            }
            let expected=reduced ? 0.24:1.2096
            let deadline=try XCTUnwrap(clock.jobs.filter{!$0.token.cancelled}.map(\.at).max())
            XCTAssertEqual(deadline-clock.time,expected,accuracy:0.00001)
            clock.advance(expected-0.001);XCTAssertEqual(outcomes,0)
            clock.advance(0.002);XCTAssertEqual(outcomes,1);XCTAssertEqual(clock.activeCount,0)
            clock.advance(5);XCTAssertEqual(outcomes,1)
        }
    }
    func testBackgroundPreservesRemainingRevealAndCollectDeadlinesWithoutDuplicateMoments() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources);resources.finish()
        var outcomes=0,reveals=0;view.onFinish={_ in outcomes += 1};view.onSoundMoment={kind,_,_ in if kind=="new-card-reveal" {reveals += 1}}
        view.start();clock.advance(0.16);clock.advance(2.1);view.activate();view.activate();clock.advance(0.2);view.setForeground(false)
        let old=clock.history;clock.advance(20);for job in old {job.callback()};XCTAssertEqual(view.phase,"revealing");XCTAssertEqual(outcomes,0)
        view.setForeground(true);clock.advance(view.revealCompletionDelay-0.2+0.001);XCTAssertEqual(view.phase,"exiting")
        clock.advance(0.1);view.setForeground(false);clock.advance(10);XCTAssertEqual(outcomes,0)
        view.setForeground(true);clock.advance(2);XCTAssertEqual(outcomes,1);XCTAssertEqual(reveals,1)
    }
    func testReplacementSettlesAndLatePreparationNeverReopensDisposedScreen() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources)
        var cancelled=0;view.onFinish={action in if case .cancelled=action {cancelled += 1}}
        view.start();clock.advance(0.16);view.dispose();view.dispose();resources.finish();clock.advance(20)
        XCTAssertEqual(cancelled,1);XCTAssertTrue(resources.reads.isEmpty);XCTAssertEqual(clock.activeCount,0)
    }
    func testRewardCoachPaperEntersTogetherAndRetiresOnCollect()throws {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources,root:NativeTestResources.root)
        defer{view.dispose()}
        resources.finish();view.start();clock.advance(0.16);clock.advance(3);view.activate();clock.advance(view.revealCompletionDelay+0.001)
        XCTAssertEqual(view.phase,"unlocked")
        let firstCoachAt=try XCTUnwrap(clock.jobs.filter{!$0.token.cancelled}.map(\.at).min())
        clock.advance(firstCoachAt-clock.time+0.001)
        let coach=try XCTUnwrap(view.view.subviews.compactMap{$0 as? UILabel}.first{$0.accessibilityIdentifier=="native.reward.coach-copy"})
        XCTAssertEqual(coach.text,"Tap to collect");XCTAssertTrue(coach.isAccessibilityElement)
        let paper=try XCTUnwrap(coach.subviews.first{$0.accessibilityIdentifier=="native.reward.coach-paper"} as? NativeSettingsPaperSurface)
        XCTAssertNotNil(paper.subviews.compactMap{$0 as? UIImageView}.first?.image)
        XCTAssertEqual(paper.cornerRadius,12);XCTAssertEqual(paper.layer.borderWidth,0);XCTAssertEqual(paper.bounds,coach.bounds)
        XCTAssertFalse(paper.outline.isEmpty);XCTAssertNotNil(coach.layer.shadowPath)
        let caption=try XCTUnwrap(coach.subviews.compactMap{$0 as? UILabel}.first)
        XCTAssertEqual(caption.attributedText?.string,"Tap to collect")
        XCTAssertEqual(coach.bounds.height,48);XCTAssertLessThanOrEqual(coach.bounds.width,184)
        let hero=try XCTUnwrap(view.view.subviews.first{$0.accessibilityIdentifier=="native.reward.card"})
        XCTAssertGreaterThan(coach.layer.zPosition,hero.layer.zPosition)
        XCTAssertEqual(coach.frame.maxY,view.view.bounds.height-40,accuracy:0.001)
        XCTAssertEqual(coach.frame.midX,view.view.bounds.midX,accuracy:0.001)
        XCTAssertNil(coach.layer.animation(forKey:"reward.position.0.0"))
        let opacity=try XCTUnwrap(coach.layer.animation(forKey:"reward.opacity.0.0") as? CAKeyframeAnimation)
        let transform=try XCTUnwrap(coach.layer.animation(forKey:"reward.transform.0.0") as? CAKeyframeAnimation)
        let values=try XCTUnwrap(opacity.values as? [NSNumber])
        let poses=try XCTUnwrap(transform.values as? [NSValue])
        XCTAssertEqual(values.first?.doubleValue,0);XCTAssertEqual(values.last?.doubleValue,0)
        XCTAssertEqual(poses.first?.caTransform3DValue.m42,18)
        XCTAssertTrue(poses.contains{$0.caTransform3DValue.m42<0 && $0.caTransform3DValue.m11>1})
        XCTAssertTrue(caption.layer.animationKeys()?.isEmpty ?? true,"One whole container owns entry")
        clock.advance(2.1)
        let idle=try XCTUnwrap(coach.layer.animation(forKey:"native.reward.coach.card-idle") as? CAKeyframeAnimation)
        XCTAssertTrue(idle.isAdditive);XCTAssertEqual(idle.duration,6.8)
        XCTAssertEqual(coach.frame.maxY,view.view.bounds.height-40,accuracy:0.001)
        let originalAlpha=coach.alpha;coach.alpha=1
        let previewSize=CGSize(width:coach.bounds.width+24,height:coach.bounds.height+24)
        let preview=UIGraphicsImageRenderer(size:previewSize).image{context in
            UIColor(red:243/255,green:238/255,blue:232/255,alpha:1).setFill()
            context.fill(CGRect(origin:.zero,size:previewSize))
            context.cgContext.translateBy(x:12,y:12);coach.layer.render(in:context.cgContext)
        }
        try preview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/reward-paper-coach-preview.png"))
        coach.alpha=originalAlpha
        view.setForeground(false);XCTAssertEqual(view.view.layer.speed,0);clock.advance(10)
        view.setForeground(true);view.activate()
        XCTAssertEqual(view.phase,"exiting")
        XCTAssertNotNil(coach.layer.animation(forKey:"reward.opacity.0.0"))
        view.dispose();XCTAssertTrue((coach.layer.animationKeys() ?? []).isEmpty)
        XCTAssertEqual(clock.activeCount,0)
    }
    func testVisibleIdleBoundedAndReducedMotionSuppressesCoachLoops() {
        let clock=Clock(),resources=Resources(),view=screen(clock,resources,reduced:true);resources.finish();view.start();clock.advance(0.16);view.activate();clock.advance(1.6)
        XCTAssertEqual(view.phase,"unlocked");XCTAssertEqual(clock.activeCount,0);view.dispose()
        let secondClock=Clock(),secondResources=Resources(),second=screen(secondClock,secondResources);secondResources.finish();second.start();second.activate();secondClock.advance(40)
        XCTAssertLessThanOrEqual(secondClock.activeCount,2);second.setForeground(false);XCTAssertEqual(secondClock.activeCount,0);second.dispose();secondClock.advance(20);XCTAssertEqual(secondClock.activeCount,0)
    }
}
