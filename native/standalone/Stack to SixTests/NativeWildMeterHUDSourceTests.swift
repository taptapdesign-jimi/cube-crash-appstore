import XCTest
import SpriteKit
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeWildMeterHUDSourceTests: XCTestCase {
    func testTutorialSpecialBurnSharesJourneyStarEnvelope() {
        for (fraction,alpha) in [(0.0,0.0),(0.09,0.16),(0.18,0.32),(0.35,0.4655),(0.52,0.611),(0.82,0.26),(1.0,0.0)] {
            XCTAssertEqual(NativeStarBurnTiming.burnAlpha(fraction:fraction),alpha,accuracy:0.000001)
        }
        XCTAssertEqual(NativeStarBurnTiming.burnAlpha(fraction:-1),0)
        XCTAssertEqual(NativeStarBurnTiming.burnAlpha(fraction:2),0)
    }
    func testTutorialSpecialBurnUsesLiveTextureMaskAndRetiresAcrossVisibilityAndDrag()throws {
        var wall=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let textures=NativeBoardTextures(root:NativeTestResources.root),scene=SKScene(size:CGSize(width:390,height:844))
        let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
        let die=NativeDiceNode(id:"tutorial-burn",value:6,kind:"wild",variant:nil,depth:1,locked:false,textures:textures)
        scene.addChild(die);die.position=CGPoint(x:150,y:250)
        for child in die.visual.children {child.isHidden=true}
        let image=UIGraphicsImageRenderer(size:CGSize(width:20,height:30)).image{context in
            UIColor.white.setFill();context.fill(CGRect(x:3,y:4,width:14,height:22))
        }
        let body=SKSpriteNode(texture:SKTexture(image:image));body.size=CGSize(width:20,height:30);body.anchorPoint=CGPoint(x:0.2,y:0.8)
        die.visual.addChild(body)
        defer{die.dispose();textures.dispose();service.dispose();view.presentScene(nil)}
        die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:true)
        XCTAssertTrue(die.tutorialSpecialBurnActive);XCTAssertEqual(die.tutorialSpecialBurnNodeCount,1)
        let overlay=try XCTUnwrap(body.childNode(withName:"tutorial-special-burn") as? SKSpriteNode)
        XCTAssertTrue(overlay.texture === body.texture);XCTAssertEqual(overlay.size,body.size);XCTAssertEqual(overlay.anchorPoint,body.anchorPoint)
        XCTAssertEqual(overlay.blendMode,.screen);XCTAssertEqual(overlay.colorBlendFactor,1)
        var maximumAlpha:CGFloat=0
        for ms in stride(from:16.0,through:3100,by:16){wall=ms;service.deliver(wallMilliseconds:wall);maximumAlpha=max(maximumAlpha,overlay.alpha)}
        XCTAssertGreaterThan(maximumAlpha,0.45);XCTAssertLessThanOrEqual(maximumAlpha,CGFloat(0.611*0.86)+0.00001)
        body.texture=SKTexture(image:image);body.size=CGSize(width:32,height:18);body.anchorPoint=CGPoint(x:0.8,y:0.3)
        die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:true)
        XCTAssertTrue(overlay.texture === body.texture);XCTAssertEqual(overlay.size,body.size);XCTAssertEqual(overlay.anchorPoint,body.anchorPoint)
        XCTAssertEqual(overlay.position,.zero)
        let carrier=die.detachedArtworkCarrier()
        XCTAssertNil(carrier.childNode(withName:"//tutorial-special-burn"),"Transient tutorial light must not be captured into an absorb/finale")
        die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:false)
        XCTAssertFalse(die.tutorialSpecialBurnActive);XCTAssertEqual(die.tutorialSpecialBurnNodeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
        for ms in stride(from:3120.0,through:6000,by:16){wall=ms;service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(die.tutorialSpecialBurnNodeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
        die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:true)
        XCTAssertEqual(die.tutorialSpecialBurnNodeCount,1)
        die.setDragging(true);XCTAssertFalse(die.tutorialSpecialBurnActive);XCTAssertEqual(die.tutorialSpecialBurnNodeCount,0)
        die.setDragging(false);die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:true)
        XCTAssertEqual(die.tutorialSpecialBurnNodeCount,1)
        die.isHidden=true;die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:true)
        XCTAssertEqual(die.tutorialSpecialBurnNodeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
        die.isHidden=false;die.reconcileTutorialSpecialBurn(service:service,enabled:true,canvasPaintable:true)
        die.reconcileTutorialSpecialBurn(service:service,enabled:false,canvasPaintable:true)
        XCTAssertEqual(die.tutorialSpecialBurnNodeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
        die.dispose();die.dispose();XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testDenserBubbleCompanionsPreservePrimaryRecipeAndShareAnimationLifetime() throws {
        try XCTSkipIf(UIAccessibility.isReduceMotionEnabled,"The existing tutorial pulse respects Reduce Motion")
        var phoneRadius:CGFloat=0,phoneDraws=0,phonePosition=CGPoint.zero
        for pad in [false,true] {
            var wall=0.0,draws=0
            let scene=SKScene(size:CGSize(width:pad ? 820:390,height:220)),stage=SKNode()
            scene.addChild(stage)
            let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall}),timeouts=NativeSourceAppTimeoutOwner()
            let hud=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:200,isPad:pad,sourceOrigin:.init(x:12,y:50),sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{draws+=1;return 0.5})
            defer{hud.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
            hud.setProgress(0.6,animated:false);hud.startTutorialPulse()
            for ms in [16.0,316,332,450] {wall=ms;service.deliver(wallMilliseconds:wall)}
            let bubbles=stage.children.compactMap{$0 as? SKShapeNode}.filter{$0.name=="wild-meter-smoke"}
            XCTAssertEqual(hud.activeSmokeCount,1,"Tablet detail must not create additional logical emissions")
            XCTAssertEqual(bubbles.count,pad ? 3:2)
            XCTAssertTrue(bubbles.allSatisfy{hud.ownsSmoke($0) && !$0.isHidden && $0.alpha>0})
            let primary=try XCTUnwrap(bubbles.first)
            let radius=try XCTUnwrap(primary.path).boundingBox.width/2
            if pad {
                XCTAssertEqual(radius,phoneRadius*1.3,accuracy:0.0001)
                XCTAssertEqual(draws,phoneDraws,"Tablet visual density must preserve shared Source RNG")
                XCTAssertEqual(primary.position.x,phonePosition.x,accuracy:0.0001)
                XCTAssertEqual(primary.position.y,phonePosition.y,accuracy:0.0001)
                XCTAssertEqual(primary.fillColor.cgColor.alpha,0.6,accuracy:0.0001)
                let companion=bubbles[1],initialOffset=CGPoint(x:companion.position.x-primary.position.x,y:companion.position.y-primary.position.y)
                XCTAssertGreaterThan(try XCTUnwrap(companion.path).boundingBox.width/2,phoneRadius)
                XCTAssertGreaterThan(abs(initialOffset.x),phoneRadius)
                wall=550;service.deliver(wallMilliseconds:wall)
                XCTAssertNotEqual(companion.position.y-primary.position.y,initialOffset.y,"Companion follows a distinct local flight using the shared pose")
                let before=bubbles.map(\.position)
                hud.setCanvasShakeOffset(.init(x:7,y:-4))
                for (bubble,position) in zip(bubbles,before) {
                    XCTAssertEqual(bubble.position.x,position.x-7,accuracy:0.0001)
                    XCTAssertEqual(bubble.position.y,position.y+4,accuracy:0.0001)
                }
            } else {
                phoneRadius=radius;phoneDraws=draws;phonePosition=primary.position
                XCTAssertEqual(primary.fillColor.cgColor.alpha,0.5,accuracy:0.0001)
            }
            hud.stopTutorialPulse();hud.stopTutorialPulse()
            XCTAssertEqual(hud.activeSmokeCount,0);XCTAssertEqual(service.activeParticipantCount,0)
            XCTAssertFalse(stage.children.contains{$0.name=="wild-meter-smoke"})
            hud.dispose();hud.dispose()
        }
    }
    func testRenderedSolidOrangeSurvivesResizeAndRefill() throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let timeouts=NativeSourceAppTimeoutOwner(),scene=SKScene(size:CGSize(width:440,height:40))
        let view=SKView(frame:CGRect(x:0,y:0,width:440,height:40));view.presentScene(scene)
        let hud=NativeWildMeterHUDPresentation(hudStage:scene,service:service,timeouts:timeouts,generation:1,maximum:200,isPad:false,sourceOrigin:.init(x:0,y:20),sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
        defer{hud.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
        func pixels(_ width:Int)throws->[UInt8] {
            let texture=try XCTUnwrap(view.texture(from:hud.fill,crop:CGRect(x:0,y:-10,width:width,height:10)))
            var bytes=[UInt8](repeating:0,count:width*10*4)
            try bytes.withUnsafeMutableBytes { storage in
                let context=try XCTUnwrap(CGContext(data:storage.baseAddress,width:width,height:10,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
                context.draw(texture.cgImage(),in:CGRect(x:0,y:0,width:width,height:10))
            }
            return bytes
        }
        for width in [200,400] {
            hud.resize(maximum:Double(width),sourceOrigin:.init(x:0,y:20))
            for ratio in [0.25,0.5,0.75,1.0] {
                hud.setProgress(ratio,animated:false)
                let data=try pixels(width)
                func green(_ fraction:Double)->Double {Double(data[(5*width+Int(Double(width)*fraction))*4+1])}
                XCTAssertEqual(green(0.1),116,accuracy:3)
                XCTAssertEqual(green(ratio-0.05),green(0.1),accuracy:3)
                XCTAssertEqual(Int(data[(5*width+Int(Double(width)*0.1))*4+3]),255)
            }
            hud.consume(0.25,reducedMotion:true)
            let data=try pixels(width)
            XCTAssertEqual(Double(data[(5*width+Int(Double(width)*0.2))*4+1]),116,accuracy:3)
        }
    }
    func testGameplayFillAndFullCompletionStayOnHorizontalBaseline() throws {
        var wall=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let timeouts=NativeSourceAppTimeoutOwner(),stage=SKNode()
        let hud=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:200,isPad:false,sourceOrigin:.init(x:12,y:34),sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
        defer{hud.dispose();timeouts.cancelAll();service.dispose()}
        let bounce=try XCTUnwrap(hud.container.childNode(withName:"//wildMeterFillBounceLayer"))
        for ratio in [0.4,1.0] {
            hud.setProgress(ratio,animated:true)
            for _ in 0..<150 {wall+=10;service.deliver(wallMilliseconds:wall);XCTAssertEqual(bounce.position.y,0,accuracy:1e-9)}
            XCTAssertEqual(hud.fillPose.width,200*ratio,accuracy:1e-6)
        }
        hud.consume(0.25,reducedMotion:false)
        for _ in 0..<200 {wall+=10;service.deliver(wallMilliseconds:wall);XCTAssertEqual(bounce.position.y,0,accuracy:1e-9)}
        XCTAssertEqual(hud.fillPose.width,50,accuracy:1e-6)
    }
    func testTutorialPulseCyclesJoinContinuouslyAndStopRestoresCapturedPose() {
        var wall=0.0,current=true
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let timeouts=NativeSourceAppTimeoutOwner(),stage=SKNode()
        let hud=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:200,isPad:false,sourceOrigin:.init(x:12,y:34),sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{current},visualRandom:{0.5})
        defer{hud.dispose();timeouts.cancelAll();service.dispose()}
        hud.container.xScale=0.97;hud.container.yScale=1.02
        let position=hud.container.position,fillPosition=hud.fill.position
        XCTAssertEqual(NativeWildMeterHUDPresentation.tutorialPulseScale(0),1,accuracy:1e-9)
        XCTAssertEqual(NativeWildMeterHUDPresentation.tutorialPulseScale(NativeWildMeterHUDPresentation.tutorialPulseDuration/2),1.03,accuracy:1e-9)
        XCTAssertEqual(NativeWildMeterHUDPresentation.tutorialPulseScale(NativeWildMeterHUDPresentation.tutorialPulseDuration),1,accuracy:1e-9)
        hud.setProgress(0.6,animated:false)
        let fillWidth=hud.fillPose.width,track=hud.background.path!,fillPath=hud.fill.path!
        hud.startTutorialPulse();hud.startTutorialPulse()
        if !hud.tutorialPulseRunning{return} // System Reduce Motion legitimately admits no pulse.
        XCTAssertEqual(hud.container.xScale,0.97,accuracy:1e-6)
        wall=16;service.deliver(wallMilliseconds:wall)
        wall=150;service.deliver(wallMilliseconds:wall)
        XCTAssertGreaterThan(hud.container.xScale,0.97)
        XCTAssertGreaterThan(hud.container.yScale,1.02)
        XCTAssertGreaterThan(hud.fill.xScale,1);XCTAssertLessThan(hud.fill.xScale,1.04);XCTAssertGreaterThan(hud.fill.yScale,1);XCTAssertLessThan(hud.fill.yScale,1.01)
        XCTAssertEqual(hud.activeSmokeCount,0)
        wall=316;service.deliver(wallMilliseconds:wall)
        XCTAssertEqual(hud.activeSmokeCount,1,"original meter bubble appears after300ms even with normal tutorial emission frozen")
        XCTAssertEqual(hud.background.path!,track);XCTAssertEqual(hud.fill.path!,fillPath)
        XCTAssertEqual(hud.container.position.x+100*hud.container.xScale,position.x+100*0.97,accuracy:1e-5)
        XCTAssertEqual(hud.fillPose.width,fillWidth,accuracy:1e-6)
        for milliseconds in stride(from:332.0,through:1800,by:16) {wall=milliseconds;service.deliver(wallMilliseconds:wall)}
        XCTAssertTrue(hud.tutorialPulseRunning)
        hud.stopTutorialPulse();hud.stopTutorialPulse()
        XCTAssertFalse(hud.tutorialPulseRunning);XCTAssertEqual(hud.container.position,position)
        XCTAssertEqual(hud.container.xScale,0.97,accuracy:1e-6);XCTAssertEqual(hud.container.yScale,1.02,accuracy:1e-6)
        XCTAssertEqual(hud.background.path!.boundingBox.height,10,accuracy:1e-6)
        XCTAssertEqual(hud.fill.path!.boundingBox.width,fillWidth,accuracy:1e-6)
        XCTAssertEqual(hud.fill.position,fillPosition)
        XCTAssertEqual(hud.fill.xScale,1,accuracy:1e-6);XCTAssertEqual(hud.fill.yScale,1,accuracy:1e-6)
        XCTAssertEqual(hud.activeSmokeCount,0)
        XCTAssertEqual(service.activeParticipantCount,0)
        current=false;hud.startTutorialPulse();XCTAssertFalse(hud.tutorialPulseRunning)
        wall=2000;service.deliver(wallMilliseconds:wall)
        XCTAssertEqual(hud.container.position,position)
    }
    func testActualUnionServiceMatchesTenOriginalGainAndSpringTraces() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "gain-oracle", withExtension: "json"))
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let rows = fixture["rows"] as! [[String: Any]]
        let groups = Dictionary(grouping: rows) { ($0["name"] as! String) + String($0["ipad"] as! Bool) }
        XCTAssertEqual(groups.count, 10)
        for (name, samples) in groups {
            let first = samples[0]
            var now = 0.0, width = first["start"] as! Double, bounce = 0.0
            let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: { now })
            let driver = NativeWildMeterSourceDriver(service: service)
            let owner = NativeWildMeterGainOwner(driver: driver, initialWidth: width, drawWidth: { width = $0 }, drawBounce: { bounce = $0 }, startSmoke: {}, stopEmission: {})
            owner.setProgress(first["ratio"] as! Double, animated: true, maximum: 200, isPad: first["ipad"] as! Bool)
            for sample in samples {
                now = (sample["t"] as! Double) * 1000
                if now > 0 { service.deliver(wallMilliseconds: now) }
                XCTAssertEqual(width, sample["width"] as! Double, accuracy: 0.00025, "width \(name) @\(now)")
                XCTAssertEqual(bounce, sample["y"] as! Double, accuracy: 0.00025, "bounce \(name) @\(now)")
            }
            owner.dispose(); service.dispose()
            XCTAssertEqual(service.activeParticipantCount, 0)
        }
    }
    func testActualUnionServiceMatchesSevenOriginalConsumptionQueueAndResetTraces() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "consumption-oracle", withExtension: "json"))
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let groups = Dictionary(grouping: fixture["rows"] as! [[String: Any]]) { $0["scenario"] as! String }
        XCTAssertEqual(groups.count, 7)
        for (name, samples) in groups {
            let first = samples[0]
            var now = 0.0, events:[String] = []
            var pose = NativeWildMeterConsumptionPlan.Pose(left: 0, width: first["startWidth"] as! Double)
            let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: { now })
            let driver = NativeWildMeterSourceDriver(service: service)
            let owner = NativeWildMeterConsumptionOwner(driver: driver, maximum: 200, initialWidth: pose.width,
                draw: { pose = $0 }, stopSmoke: {events.append("stop")}, stopEmission: {events.append("stop-emission")}, startSmoke: {events.append("smoke")}, bounce: {events.append("bounce")})
            owner.consume(first["ratio"] as! Double, reducedMotion: name == "reduced")
            for sample in samples {
                let t = sample["t"] as! Double, n = Int((t * 100).rounded())
                // Original fixture changes happen before delivery at this tick.
                if name == "late-credit" && n == 35 { owner.acceptProgress(0.7, animated: true) }
                if name == "queued" && n == 20 { owner.consume(0.4) }
                if name == "queued" && n == 30 { owner.acceptProgress(0.6, animated: true) }
                if name == "reset" && n == 35 { owner.acceptProgress(0.1, animated: false) }
                now = Double(n * 10)
                if n > 0 { service.deliver(wallMilliseconds: now) }
                XCTAssertEqual(pose.left, sample["left"] as! Double, accuracy: 0.00025, "left \(name) @\(now)")
                XCTAssertEqual(pose.width, sample["width"] as! Double, accuracy: 0.00025, "width \(name) @\(now)")
                XCTAssertEqual(owner.active, sample["active"] as! Bool)
                XCTAssertEqual(owner.queue, sample["queue"] as! [Double])
                XCTAssertEqual(owner.pending, sample["pending"] as? Double)
                XCTAssertEqual(events, sample["events"] as! [String])
            }
            owner.dispose(); service.dispose(); XCTAssertFalse(service.hasActiveClock)
        }
    }
    func testComposedGainConsumeAndQueuedAwardsMatchActualOriginalRootGraph() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "composed-oracle", withExtension: "json"))
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let groups = Dictionary(grouping: fixture["rows"] as! [[String: Any]]) { $0["name"] as! String }
        let actions = Dictionary(uniqueKeysWithValues: (fixture["scenarios"] as! [[Any]]).map { ($0[0] as! String, $0[1] as! [[Any]]) })
        XCTAssertEqual(groups.count, 5)
        for (name, samples) in groups {
            var now = 0.0, pose = NativeWildMeterConsumptionPlan.Pose(left: 0, width: 80), bounce = 0.0
            let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: { now })
            let driver = NativeWildMeterSourceDriver(service: service)
            let owner = NativeWildMeterHUDOwner(driver: driver, maximum: 200, initialWidth: 80, isPad: false,
                draw: { pose = $0 }, drawBounce: { bounce = $0 }, stopSmoke: {}, stopEmission: {}, startSmoke: {})
            for sample in samples {
                let n = sample["n"] as! Int
                for action in actions[name]! where (action[0] as! Int) == n {
                    let kind = action[1] as! String, ratio = action[2] as! Double
                    if kind == "gain" || kind == "reset" { owner.setProgress(ratio, animated: kind == "gain") }
                    else { owner.consume(ratio, reducedMotion: kind == "reduced") }
                }
                now = Double(n * 10)
                if n > 0 { service.deliver(wallMilliseconds: now) }
                XCTAssertEqual(pose.left, sample["left"] as! Double, accuracy: 0.00025, "left \(name) @\(now)")
                XCTAssertEqual(pose.width, sample["width"] as! Double, accuracy: 0.00025, "width \(name) @\(now)")
                XCTAssertEqual(bounce, sample["y"] as! Double, accuracy: 0.00025, "bounce \(name) @\(now)")
                XCTAssertEqual(owner.consumeActive, sample["active"] as! Bool)
                XCTAssertEqual(owner.queuedRatios, sample["queue"] as! [Double])
                XCTAssertEqual(owner.pendingRatio, sample["pending"] as? Double)
            }
            owner.dispose(); service.dispose(); XCTAssertFalse(service.hasActiveClock)
        }
    }
    func testRefillSmokeFactorySeesSourceClearedFillBeforeRefillPaint() {
        var now = 0.0, pose = NativeWildMeterConsumptionPlan.Pose(left:0,width:200)
        var smokePose:NativeWildMeterConsumptionPlan.Pose?
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let owner = NativeWildMeterConsumptionOwner(driver:NativeWildMeterSourceDriver(service:service),maximum:200,initialWidth:200,
            draw:{pose=$0},stopSmoke:{},stopEmission:{},startSmoke:{smokePose=pose},bounce:{})
        owner.consume(0.5)
        for n in 1...50 {now=Double(n*10);service.deliver(wallMilliseconds:now)}
        XCTAssertEqual(smokePose?.left,0);XCTAssertEqual(smokePose?.width,0)
        XCTAssertGreaterThan(pose.width,0)
        owner.dispose();service.dispose()
    }
    func testResetCancelsCapturedGainAndSpringWithoutRetiringOtherOwner() {
        var now = 0.0, width = 20.0, bounce = 0.0, interruptions = 0
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: { now })
        let driver = NativeWildMeterSourceDriver(service: service)
        let unrelated = driver.start(duration: 2, paint: { _ in }, completed: {}, interrupted: { interruptions += 1 })
        let owner = NativeWildMeterGainOwner(driver: driver, initialWidth: width, drawWidth: { width = $0 }, drawBounce: { bounce = $0 }, startSmoke: {}, stopEmission: {})
        owner.setProgress(0.5, animated: true, maximum: 200, isPad: false)
        now = 100; service.deliver(wallMilliseconds: now)
        XCTAssertNotEqual(bounce, 0)
        owner.setProgress(0.1, animated: false, maximum: 200, isPad: false)
        XCTAssertEqual(width, 20); XCTAssertEqual(bounce, 0)
        now = 200; service.deliver(wallMilliseconds: now)
        XCTAssertEqual(width, 20); XCTAssertEqual(bounce, 0); XCTAssertEqual(interruptions, 0)
        owner.dispose(); unrelated?(); service.dispose(); XCTAssertEqual(interruptions, 1)
    }
    func testActualFiniteDriverDisposeInterruptsOnceAndLeavesNoRecurringClock() {
        let service = NativeSourceAnimationClockService(wallOriginMilliseconds: 0, sourceWallMillisecondsNow: { 0 })
        let driver = NativeWildMeterSourceDriver(service: service)
        var completed = 0, interrupted = 0
        let cancel = driver.start(duration: 1, paint: { _ in }, completed: { completed += 1 }, interrupted: { interrupted += 1 })
        XCTAssertNotNil(cancel); service.dispose(); cancel?(); cancel?()
        XCTAssertEqual(completed, 0); XCTAssertEqual(interrupted, 1); XCTAssertFalse(service.hasActiveClock)
    }
}
