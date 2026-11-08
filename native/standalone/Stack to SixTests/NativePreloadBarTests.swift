import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativePreloadBarTests:XCTestCase {
    func testLiveStackAndSixGainTakeOverEntryFromPaintedEdgeAndKeepLatestProgress() throws {
        for pad in [false,true] {for restart in [false,true] {for fillAge in [-0.10,0.15,0.65] {
            var wall=0.0
            let scene=SKScene(size:CGSize(width:390,height:844)),stage=SKNode()
            scene.addChild(stage)
            let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall}),timeouts=NativeSourceAppTimeoutOwner()
            let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:343.2,isPad:pad,sourceOrigin:CGPoint(x:24,y:144),preloadDividerRoot:NativeTestResources.root,sourceToNative:{CGPoint(x:$0.x,y:844-$0.y)},nativeToSource:{CGPoint(x:$0.x,y:844-$0.y)},smokeDisabled:{true},current:{true},visualRandom:{0.5})
            defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
            owner.setProgress(0.4,animated:false);owner.primeBoardEntry(restart:restart);owner.beginBoardEntry(restart:restart)
            let bar=try XCTUnwrap(scene.children.first{$0.name=="native-preload-bar"})
            let ribbon=try XCTUnwrap(bar.children.first{$0 is SKCropNode})
            let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
            let elapsed=NativePreloadBarPresentation.holderEntryDuration(restart:restart)+fillAge
            owner.paintPreloadBoardEntry(elapsed)
            let edge=try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue
            let mask=try XCTUnwrap(paint.shader?.uniformNamed("u_reveal")).floatValue
            owner.setProgress(0.5,animated:true)
            XCTAssertEqual(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,edge,accuracy:0.001,"Handoff must capture the painted edge without flashing restored charge")
            XCTAssertEqual(try XCTUnwrap(paint.shader?.uniformNamed("u_reveal")).floatValue,mask,"Live gain retains the holder mask")
            for ms in stride(from:10.0,through:100.0,by:10){wall=ms;service.deliver(wallMilliseconds:wall)}
            XCTAssertGreaterThan(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,edge,"A fast stack must grow the red edge before entry advances")
            owner.setProgress(0.72,animated:true)
            for ms in stride(from:110.0,through:1800.0,by:10){wall=ms;service.deliver(wallMilliseconds:wall)}
            XCTAssertEqual(owner.fillPose.width,343.2*0.72,accuracy:0.001)
            XCTAssertEqual(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,Float(343.2*0.72),accuracy:0.001,"Entry must not mask a rapid follow-up six gain")
            owner.paintPreloadBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true,restart:restart))
            XCTAssertEqual(owner.fillPose.width,343.2*0.72,accuracy:0.001,"Late entry completion cannot restore old charge")
            XCTAssertEqual(service.activeParticipantCount,0)
        }}}
    }
    private func mount(_ bar:NativePreloadBarPresentation)->(UIWindow,SKView,SKScene){
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        let view=SKView(frame:window.bounds);host.view.addSubview(view)
        let scene=SKScene(size:window.bounds.size);scene.scaleMode = .resizeFill
        scene.addChild(bar.container);bar.container.position=CGPoint(x:24,y:700);view.presentScene(scene)
        return (window,view,scene)
    }
    func testMountedEntryUnrollsInPlaceAfterDividerAndStopsItsDemand() throws {
        let bar=NativePreloadBarPresentation(reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        var demands:[Bool]=[];bar.onMotionChanged={demands.append($0)}
        bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:180,maximum:343.2)
        bar.primeBoardEntry();XCTAssertTrue(bar.container.isHidden)
        bar.beginBoardEntry()
        let ribbon=try XCTUnwrap(bar.container.children.first{$0 is SKCropNode})
        let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
        let duration=NativePreloadBarPresentation.chromeDuration(entering:true)
        var reveal:Float=0
        for elapsed in stride(from:0.0,through:duration+0.02,by:0.01){
            bar.paintBoardEntry(elapsed)
            XCTAssertEqual(ribbon.position,.zero,"Entry must not compete with mask through vertical motion")
            XCTAssertEqual(ribbon.xScale,1);XCTAssertEqual(ribbon.yScale,1)
            let edge=try XCTUnwrap(paint.shader?.uniformNamed("u_reveal")).floatValue
            if elapsed<JimiV9ArchedNavigationTitle.elementDuration{XCTAssertEqual(edge,0)}
            XCTAssertGreaterThanOrEqual(edge,reveal);reveal=edge
        }
        XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(demands,[true,false])
        let frozen=ribbon.position;bar.paintBoardEntry(duration+10);XCTAssertEqual(ribbon.position,frozen)
        XCTAssertFalse(bar.container.hasActions())
    }
    func testHolderFinishesBeforeRestoredLiquidStartsOnPhoneTabletAndRestart() throws {
        for pad in [false,true] {for restart in [false,true] {
            let bar=NativePreloadBarPresentation(isPad:pad,reducedMotion:{false}),mounted=mount(bar)
            defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:343.2,barHeight:10)
            bar.setNativeFill(left:0,width:240,maximum:343.2)
            bar.primeBoardEntry(restart:restart);bar.beginBoardEntry(restart:restart)
            let ribbon=try XCTUnwrap(bar.container.children.first{$0 is SKCropNode})
            let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
            let maskEnd=NativePreloadBarPresentation.holderEntryDuration(restart:restart)
            for elapsed in stride(from:0.0,through:maskEnd,by:0.01) {
                bar.paintBoardEntry(elapsed)
                XCTAssertEqual(bar.liquidFillFraction,0)
                XCTAssertEqual(paint.shader?.uniformNamed("u_visible")?.floatValue,0)
                XCTAssertFalse(bar.smokeAdmitted)
            }
            func capture(_ name:String) throws {
                guard !pad,!restart else{return}
                let texture=try XCTUnwrap(mounted.1.texture(from:bar.container))
                let attachment=XCTAttachment(image:UIImage(cgImage:texture.cgImage()))
                attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
            }
            bar.paintBoardEntry(maskEnd)
            try capture("holder-complete-liquid-empty")
            XCTAssertEqual(bar.lifecycleReveal,1)
            XCTAssertEqual(bar.liquidFillFraction,0)
            bar.paintBoardEntry(maskEnd+NativePreloadBarPresentation.entryFillTravelDuration/2)
            XCTAssertEqual(bar.lifecycleReveal,1)
            XCTAssertGreaterThan(bar.liquidFillFraction,0);XCTAssertLessThan(bar.liquidFillFraction,1)
            XCTAssertLessThan(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,240)
            try capture("holder-complete-liquid-filling")
            let fraction=bar.liquidFillFraction
            _=bar.beginBoardExit(restart:restart);bar.paintBoardExit(0)
            XCTAssertEqual(bar.liquidFillFraction,fraction,"Interrupted fill cannot flash full on exit")
            bar.cancelBoardExit();bar.beginBoardEntry(restart:restart)
            bar.paintBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true,restart:restart))
            XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.liquidFillFraction,1)
            XCTAssertEqual(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,240,accuracy:0.001)
        }}
    }

    func testEntryLiquidUsesSlightlyStrongerGameplayEdgeBounceAndSettles() throws {
        let bar=NativePreloadBarPresentation(reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:240,maximum:343.2)
        bar.beginBoardEntry()
        let onset=NativePreloadBarPresentation.holderEntryDuration()
        let ordinary=NativeWildMeterGainPlan(maximum:343.2,initial:0,ratio:240/343.2,isPad:false)
        var peak=0.0,recoil=2.0
        for step in 0...200 {
            let t=Double(step)/200
            bar.paintBoardEntry(onset+t*NativePreloadBarPresentation.entryFillDuration)
            XCTAssertEqual(bar.lifecycleReveal,1)
            peak=max(peak,bar.liquidFillFraction)
            if t>NativePreloadBarPresentation.entryFillTravelDuration/NativePreloadBarPresentation.entryFillDuration {recoil=min(recoil,bar.liquidFillFraction)}
        }
        XCTAssertGreaterThan(peak,1.05,"Entry boing slightly exceeds ordinary five-percent overshoot")
        XCTAssertLessThanOrEqual(peak,1.061)
        XCTAssertLessThan(recoil,1,"Edge recoils before settling")
        XCTAssertEqual(bar.liquidFillFraction,1)
        XCTAssertEqual(ordinary.width(seconds:ordinary.firstDuration),252,accuracy:0.001,"In-game bounce remains unchanged")
    }

    func testInitialLiquidEmitsStrongerBubblesDuringWholeSweepAndThenStops() throws {
        for (ratio,disabled) in [(0.65,false),(0.0,false),(0.65,true)] {
            var wall=0.0,randomCursor=0.1
            let scene=SKScene(size:CGSize(width:390,height:844)),stage=SKNode()
            scene.backgroundColor=UIColor(red:0.97,green:0.94,blue:0.9,alpha:1)
            scene.addChild(stage)
            let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall}),timeouts=NativeSourceAppTimeoutOwner()
            let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:343.2,isPad:false,sourceOrigin:CGPoint(x:24,y:144),preloadDividerRoot:NativeTestResources.root,sourceToNative:{CGPoint(x:$0.x,y:844-$0.y)},nativeToSource:{CGPoint(x:$0.x,y:844-$0.y)},smokeDisabled:{disabled},current:{true},visualRandom:{randomCursor=(randomCursor+0.61803398875).truncatingRemainder(dividingBy:1);return randomCursor})
            defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
            owner.setProgress(ratio,animated:false)
            let canonical=owner.fillPose
            owner.primeBoardEntry();owner.beginBoardEntry()
            let end=NativePreloadBarPresentation.chromeDuration(entering:true)
            let onset=NativePreloadBarPresentation.holderEntryDuration()
            owner.paintPreloadBoardEntry(onset)
            XCTAssertEqual(owner.activeSmokeCount,0,"Holder-only reveal emits nothing")
            let expected = ratio>0 && !disabled && !UIAccessibility.isReduceMotionEnabled
            wall=(onset+0.12)*1000;owner.paintPreloadBoardEntry(onset+0.12);service.deliver(wallMilliseconds:wall)
            let firstCount=owner.activeSmokeCount
            if expected {XCTAssertGreaterThan(firstCount,0)} else {XCTAssertEqual(firstCount,0)}
            owner.paintPreloadBoardEntry(onset+0.12)
            XCTAssertEqual(owner.activeSmokeCount,firstCount,"Same animation sample cannot emit twice")
            for elapsed in stride(from:onset+0.16,through:end,by:0.04){
                wall=elapsed*1000;owner.paintPreloadBoardEntry(elapsed);service.deliver(wallMilliseconds:wall)
            }
            owner.paintPreloadBoardEntry(end)
            let count=owner.activeSmokeCount
            if expected {XCTAssertGreaterThan(count,6,"Stronger particles continue across the sweep")}
            XCTAssertLessThanOrEqual(count,2*Int(NativePreloadBarPresentation.entryFillDuration/NativeWildMeterHUDPresentation.entryBubbleInterval))
            owner.paintPreloadBoardEntry(end+1);XCTAssertEqual(owner.activeSmokeCount,count,"Settled bar must stop emitting")
            let births=Dictionary(uniqueKeysWithValues:stage.children.filter{$0.name=="wild-meter-smoke"}.map{(ObjectIdentifier($0),$0.position)})
            let finishedAt=wall
            for ms in stride(from:finishedAt+10,through:finishedAt+300,by:10){wall=ms;service.deliver(wallMilliseconds:wall)}
            let bubbles=stage.children.compactMap{$0 as? SKShapeNode}.filter{$0.name=="wild-meter-smoke"}
            if expected {
                XCTAssertTrue(bubbles.contains{$0.alpha>0})
                for bubble in bubbles {if let birth=births[ObjectIdentifier(bubble)] {XCTAssertGreaterThan(bubble.position.y,birth.y)}}
                let texture=try XCTUnwrap(view.texture(from:scene))
                let attachment=XCTAttachment(image:UIImage(cgImage:texture.cgImage()))
                attachment.name="entry-red-bubbles-during-sweep";attachment.lifetime = .keepAlways;add(attachment)
            }
            for ms in stride(from:finishedAt+310,through:finishedAt+2000,by:10){wall=ms;service.deliver(wallMilliseconds:wall)}
            XCTAssertEqual(owner.activeSmokeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
            XCTAssertEqual(owner.fillPose.left,canonical.left);XCTAssertEqual(owner.fillPose.width,canonical.width)
            owner.dispose();owner.dispose();owner.paintPreloadBoardEntry(end)
            XCTAssertTrue(stage.children.allSatisfy{$0.name != "wild-meter-smoke"})
        }
    }

    func testInitialRedSweepMatchesActualHolderMaskPaceBeforeBoing() throws {
        for pad in [false,true] {
            let bar=NativePreloadBarPresentation(isPad:pad,reducedMotion:{false}),mounted=mount(bar)
            defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:240,maximum:343.2)
            bar.beginBoardEntry()
            let travel=NativePreloadBarPresentation.entryFillTravelDuration
            let maskEnd=NativePreloadBarPresentation.holderEntryDuration()
            let fractions=[0.25,0.5,0.75]
            let mask=fractions.map{fraction in
                bar.paintBoardEntry(maskEnd-travel+travel*fraction);return bar.lifecycleReveal
            }
            let plan=NativeWildMeterGainPlan(maximum:343.2,initial:0,ratio:240/343.2,isPad:pad,overshootScale:1.2)
            let peak=plan.width(seconds:plan.firstDuration)/240
            for (fraction,reveal) in zip(fractions,mask) {
                bar.paintBoardEntry(maskEnd+travel*fraction)
                XCTAssertEqual(bar.lifecycleReveal,1)
                XCTAssertEqual(bar.liquidFillFraction/peak,reveal,accuracy:0.000001,"Red growth must follow the actual holder's pace")
            }
            bar.paintBoardEntry(maskEnd+travel)
            XCTAssertEqual(bar.liquidFillFraction,peak,accuracy:0.000001)
            bar.paintBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true))
            XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.liquidFillFraction,1)
        }
    }

    func testExitRetractsRedImmediatelyAndHolderStartsOneHundredMillisecondsLater() throws {
        for pad in [false,true] {for restart in [false,true] {
            let bar=NativePreloadBarPresentation(isPad:pad,reducedMotion:{false}),mounted=mount(bar)
            defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:240,maximum:343.2)
            bar.beginBoardEntry(restart:restart)
            bar.paintBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true,restart:restart))
            let duration=bar.beginBoardExit(restart:restart)
            bar.paintBoardExit(0.05)
            XCTAssertEqual(bar.lifecycleReveal,1,"Holder must remain full during red lead")
            XCTAssertLessThan(bar.liquidFillFraction,1,"Red starts retracting immediately")
            bar.paintBoardExit(NativePreloadBarPresentation.exitLiquidLead)
            XCTAssertEqual(bar.lifecycleReveal,1)
            bar.paintBoardExit(NativePreloadBarPresentation.exitLiquidLead+0.04)
            XCTAssertLessThan(bar.lifecycleReveal,1,"Holder follows at100ms")
            bar.paintBoardExit(duration)
            XCTAssertEqual(bar.phase,.gone);XCTAssertEqual(bar.lifecycleReveal,0)
        }}
    }

    func testMountedDividerWaitsHiddenThenBouncesWithMaskReveal() throws {
        for pad in [false,true] {
        let bar=NativePreloadBarPresentation(isPad:pad,dividerResourceRoot:NativeTestResources.root,reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.primeBoardEntry();bar.beginBoardEntry()
        let divider=try XCTUnwrap(bar.container.childNode(withName:"//native-preload-divider"))
        let motion=try XCTUnwrap(divider.parent)
        let onset=JimiV9ArchedNavigationTitle.elementDuration
        for elapsed in [0.0,onset/2,onset] {
            bar.paintBoardEntry(elapsed)
            XCTAssertEqual(motion.alpha,0);XCTAssertEqual(motion.position.y,-16,accuracy:0.0001)
            XCTAssertEqual(bar.lifecycleReveal,0)
        }
        bar.paintBoardEntry(onset+0.02)
        XCTAssertGreaterThan(bar.lifecycleReveal,0);XCTAssertGreaterThan(motion.alpha,0)
        XCTAssertLessThan(motion.alpha,1);XCTAssertGreaterThan(motion.position.y,-16)
        let travel=NativePreloadBarPresentation.holderEntryDuration()-onset
        var highest=0.0,lowestAfterLift=0.0
        for step in 1...100 {
            bar.paintBoardEntry(onset+travel*Double(step)/100)
            let y=Double(motion.position.y)
            highest=max(highest,y)
            if highest>2 {lowestAfterLift=min(lowestAfterLift,y)}
        }
        XCTAssertGreaterThan(highest,4,"Entry needs a clearly visible spring overshoot")
        XCTAssertLessThan(lowestAfterLift,-0.5,"Spring must rebound before settling")
        bar.paintBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true))
        XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(motion.position,.zero);XCTAssertEqual(motion.alpha,1)
    }

    }

    func testRestartMasksInPlaceAndKeepsDividerAcrossBothDirections() throws {
        for pad in [false,true] {
        let bar=NativePreloadBarPresentation(isPad:pad,dividerResourceRoot:NativeTestResources.root,reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:180,maximum:343.2)
        let ribbon=try XCTUnwrap(bar.container.children.first{$0 is SKCropNode})
        let divider=try XCTUnwrap(bar.container.childNode(withName:"//native-preload-divider"))
        let dividerRoot=try XCTUnwrap(divider.parent)
        let exit=bar.beginBoardExit(restart:true)
        var previous=1.0
        for time in stride(from:0.0,through:exit+0.01,by:0.01) {
            bar.paintBoardExit(time)
            XCTAssertLessThanOrEqual(bar.lifecycleReveal,previous);previous=bar.lifecycleReveal
            XCTAssertEqual(ribbon.position,.zero);XCTAssertEqual(ribbon.xScale,1);XCTAssertEqual(ribbon.yScale,1)
            XCTAssertEqual(dividerRoot.position,.zero);XCTAssertEqual(dividerRoot.xScale,1);XCTAssertEqual(dividerRoot.alpha,1)
            XCTAssertFalse(divider.isHidden)
        }
        XCTAssertEqual(bar.phase,.gone);XCTAssertEqual(bar.lifecycleReveal,0)
        bar.primeBoardEntry(restart:true)
        XCTAssertFalse(bar.container.isHidden,"Incoming first paint already contains the fixed divider")
        XCTAssertFalse(divider.isHidden);XCTAssertEqual(dividerRoot.alpha,1)
        XCTAssertEqual(dividerRoot.position,.zero);XCTAssertTrue(ribbon.isHidden)
        bar.beginBoardEntry(restart:true)
        bar.paintBoardEntry(0.01);XCTAssertGreaterThan(bar.lifecycleReveal,0,"Restart's settled divider must not introduce the normal entry hold")
        previous=bar.lifecycleReveal
        let enter=NativePreloadBarPresentation.chromeDuration(entering:true,restart:true)
        for time in stride(from:0.02,through:enter+0.01,by:0.01) {
            bar.paintBoardEntry(time)
            XCTAssertGreaterThanOrEqual(bar.lifecycleReveal,previous);previous=bar.lifecycleReveal
            XCTAssertEqual(ribbon.position,.zero);XCTAssertEqual(dividerRoot.position.x,0);XCTAssertEqual(dividerRoot.alpha,1)
            XCTAssertEqual(dividerRoot.position,.zero);XCTAssertEqual(dividerRoot.xScale,1)
        }
        XCTAssertEqual(dividerRoot.position,.zero)
        XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.lifecycleReveal,1);XCTAssertFalse(bar.container.hasActions())
    }

    }

    func testInterruptedExitCancelAndRepeatedDisposeRetireActualNodes() throws {
        weak var retired:NativePreloadBarPresentation?
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));defer{window.isHidden=true}
        try autoreleasepool {
            let bar=NativePreloadBarPresentation(reducedMotion:{false});retired=bar
            let mounted=mount(bar);defer{mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:200,maximum:343.2)
            bar.primeBoardEntry();bar.beginBoardEntry();bar.paintBoardEntry(0.45)
            let before=bar.lifecycleReveal,duration=bar.beginBoardExit()
            XCTAssertEqual(bar.lifecycleReveal,before,accuracy:0.000001)
            bar.paintBoardExit(duration/2);XCTAssertLessThan(bar.lifecycleReveal,before)
            bar.cancelBoardExit();XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.lifecycleReveal,1)
            let second=bar.beginBoardExit();bar.paintBoardExit(second)
            XCTAssertEqual(bar.phase,.gone);XCTAssertFalse(bar.smokeAdmitted)
            bar.dispose();bar.dispose();XCTAssertNil(bar.container.parent)
            bar.beginBoardEntry();XCTAssertNil(bar.container.parent)
        }
        XCTAssertNil(retired)
    }
    func testGradientBirthColorsFollowLocalCoordinatesAndTabletArchKeepsCentre() throws {
        for pad in [false,true] {
            let bar=NativePreloadBarPresentation(isPad:pad,reducedMotion:{false}),mounted=mount(bar)
            defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:340,barHeight:14)
            for (u,expected) in [(0.0,[234.0,139,87]),(0.5,[232.5,127.5,80.5]),(1.0,[231.0,116,74])] {
                let point=bar.smokePoint(atX:340*u,in:mounted.2),color=bar.smokeColor(point,in:mounted.2)
                var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0;color.getRed(&r,green:&g,blue:&b,alpha:&a)
                for (actual,want) in zip([r,g,b],expected){XCTAssertEqual(Double(actual)*255,want,accuracy:0.0001)}
                XCTAssertEqual(a,0.5)
            }
            if pad {
                XCTAssertEqual(bar.barCenterY,-5)
                let a=bar.smokeCurveOffset(bar.smokePoint(atX:0,in:mounted.2),in:mounted.2)
                let b=bar.smokeCurveOffset(bar.smokePoint(atX:170,in:mounted.2),in:mounted.2)
                XCTAssertGreaterThan(a.y,7);XCTAssertEqual(b,.zero)
            }
        }
    }
    func testReducedMotionUsesFiniteFadeAndSettlesAfterResize() throws {
        let bar=NativePreloadBarPresentation(reducedMotion:{true}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.primeBoardEntry();bar.beginBoardEntry()
        let duration=NativePreloadBarPresentation.chromeDuration(entering:true,reduced:true)
        bar.paintBoardEntry(duration/2);bar.resize(maximum:350,barHeight:10)
        bar.paintBoardEntry(duration);XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.lifecycleReveal,1)
        let exit=bar.beginBoardExit();bar.paintBoardExit(exit);XCTAssertEqual(bar.phase,.gone)
    }
    func testProductionPhoneHUDArtworkFitsSmallReferenceAndWideScreens() throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            let state=NativeBoardFactory.make(mode:.journey,board:2)
            let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:size)
            defer{scene.dispose()}
            scene.layout(size:size,insets:.init(top:size.width==320 ? 20:47,left:0,bottom:34,right:0))
            for name in ["native-game-close","native-game-help","native-game-score-art","native-game-combo-art"] {
                let node=try XCTUnwrap(scene.childNode(withName:"//"+name)),parent=try XCTUnwrap(node.parent)
                let f=node.frame,a=scene.convert(CGPoint(x:f.minX,y:f.minY),from:parent),b=scene.convert(CGPoint(x:f.maxX,y:f.maxY),from:parent)
                XCTAssertGreaterThanOrEqual(min(a.x,b.x),0,"HUD artwork must fit at \(size.width): \(name)")
                XCTAssertLessThanOrEqual(max(a.x,b.x),size.width,"HUD artwork must fit at \(size.width): \(name)")
            }
        }
    }

    func testMiniTabletBridgeKeepsMainMeterOriginWithoutChangingCanonicalPadFlag() throws {
        let scene=SKScene(size:CGSize(width:744,height:1133)),canvas=SKNode(),stage=SKNode()
        scene.addChild(canvas);canvas.addChild(stage)
        let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let timeouts=NativeSourceAppTimeoutOwner()
        let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:500,isPad:false,sourceOrigin:CGPoint(x:40,y:900),barHeight:14,preloadDividerRoot:NativeTestResources.root,sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
        defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
        let surface=try XCTUnwrap(scene.childNode(withName:"//native-preload-bar"))
        XCTAssertEqual(surface.position,CGPoint(x:40,y:900))
        let divider=try XCTUnwrap(surface.childNode(withName:"//native-preload-divider") as? SKSpriteNode)
        XCTAssertNotNil(divider.texture);XCTAssertFalse(divider.isHidden)
        owner.resize(maximum:540,sourceOrigin:CGPoint(x:50,y:850),barHeight:14)
        XCTAssertEqual(surface.position,CGPoint(x:50,y:850))
        XCTAssertEqual(canvas.children.filter{$0.name=="native-preload-bar"}.count,1)
        owner.dispose();owner.dispose();XCTAssertNil(surface.parent)
        XCTAssertEqual(timeouts.pendingCount,0);XCTAssertEqual(service.activeParticipantCount,0)
    }

    func testRestartPrimeKeepsDividerVisibleWhenSourceOwnerSynchronizesFirstFrame() throws {
        let scene=SKScene(size:CGSize(width:390,height:844)),stage=SKNode()
        scene.addChild(stage)
        let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),timeouts=NativeSourceAppTimeoutOwner()
        let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:343.2,isPad:false,sourceOrigin:CGPoint(x:24,y:700),preloadDividerRoot:NativeTestResources.root,sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
        defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
        owner.primeBoardEntry(restart:true);owner.synchronizePreloadSurfaceVisibility()
        let surface=try XCTUnwrap(scene.childNode(withName:"//native-preload-bar"))
        let divider=try XCTUnwrap(surface.childNode(withName:"//native-preload-divider")),motion=try XCTUnwrap(divider.parent)
        let ribbon=try XCTUnwrap(surface.children.first{$0 is SKCropNode})
        XCTAssertFalse(surface.isHidden);XCTAssertFalse(divider.isHidden);XCTAssertTrue(ribbon.isHidden)
        XCTAssertEqual(motion.position,.zero);XCTAssertEqual(motion.alpha,1)
        owner.beginBoardEntry(restart:true)
        for time in [0.0,0.10,0.25,0.50,1.0] {
            owner.paintPreloadBoardEntry(time);owner.synchronizePreloadSurfaceVisibility()
            XCTAssertFalse(surface.isHidden);XCTAssertFalse(divider.isHidden)
            XCTAssertEqual(motion.position,.zero);XCTAssertEqual(motion.alpha,1)
            XCTAssertEqual(motion.xScale,1);XCTAssertEqual(motion.yScale,1)
        }
        owner.primeBoardEntry();owner.synchronizePreloadSurfaceVisibility()
        XCTAssertTrue(surface.isHidden,"Ordinary fresh entry still owns its full divider bounce")
    }

    func testPhoneSizedBootstrapRelayoutUsesCurrentTabletOriginAndWidth() throws {
        for size in [CGSize(width:744,height:1133),CGSize(width:820,height:1180),CGSize(width:1032,height:1376)] {
            let scene=SKScene(size:CGSize(width:390,height:844)),stage=SKNode()
            scene.addChild(stage)
            let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),timeouts=NativeSourceAppTimeoutOwner()
            let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:343.2,isPad:false,sourceOrigin:CGPoint(x:24,y:700),preloadDividerRoot:NativeTestResources.root,sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
            defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
            scene.size=size;view.frame=CGRect(origin:.zero,size:size)
            let grid=NativeBoardGeometry(columns:7,rows:8,viewport:size,safeInsets:.init(top:24,left:0,bottom:20,right:0))
            let width=7*NativeBoardGeometry.tile*grid.scale+6*NativeBoardGeometry.gap*grid.scale
            let chrome=NativeGameplayChromePlan.make(viewport:size,safeTop:24,boardBounds:CGRect(x:grid.origin.x,y:0,width:width,height:0))
            let origin=CGPoint(x:chrome.meterRect.minX,y:chrome.meterRect.maxY)
            // Even a relayout that retains the same logical span must refresh
            // phone ribbon geometry before the canonical width catches up.
            owner.resize(maximum:343.2,sourceOrigin:origin,barHeight:10)
            let surface=try XCTUnwrap(scene.childNode(withName:"//native-preload-bar"))
            let ribbon=try XCTUnwrap(surface.children.first{$0 is SKCropNode})
            let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
            XCTAssertEqual(paint.shader?.uniformNamed("u_radius")?.floatValue ?? 0,5,accuracy:0.001)
            owner.resize(maximum:width,sourceOrigin:origin,barHeight:chrome.meterRect.height)
            owner.synchronizePreloadSurfaceVisibility()
            XCTAssertEqual(surface.position.x,origin.x,accuracy:0.001)
            XCTAssertEqual(surface.position.y,origin.y,accuracy:0.001,"A late tablet layout must retire the phone Y recipe")
            XCTAssertEqual(paint.shader?.uniformNamed("u_width")?.floatValue ?? 0,Float(width),accuracy:0.001)
            XCTAssertGreaterThan(paint.shader?.uniformNamed("u_arch")?.floatValue ?? 0,0)
            let boardTop=grid.origin.y+(8*NativeBoardGeometry.tile+7*NativeBoardGeometry.gap)*grid.scale
            XCTAssertGreaterThan(origin.y-5-chrome.meterRect.height/2,boardTop)
            let divider=try XCTUnwrap(surface.childNode(withName:"//native-preload-divider") as? SKSpriteNode)
            XCTAssertGreaterThanOrEqual(divider.size.width,size.width)
        }
    }

}
