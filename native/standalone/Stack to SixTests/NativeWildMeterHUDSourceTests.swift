import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeWildMeterHUDSourceTests: XCTestCase {
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
        XCTAssertEqual(NativeWildMeterHUDPresentation.tutorialPulseScale(0.3),1.04,accuracy:1e-9)
        XCTAssertEqual(NativeWildMeterHUDPresentation.tutorialPulseScale(0.6),1,accuracy:1e-9)
        hud.setProgress(0.6,animated:false)
        let fillWidth=hud.fillPose.width,track=hud.background.path!,fillPath=hud.fill.path!
        hud.startTutorialPulse();hud.startTutorialPulse()
        if !hud.tutorialPulseRunning{return} // System Reduce Motion legitimately admits no pulse.
        XCTAssertEqual(hud.container.xScale,0.97,accuracy:1e-6)
        wall=16;service.deliver(wallMilliseconds:wall)
        wall=150;service.deliver(wallMilliseconds:wall)
        XCTAssertGreaterThan(hud.container.xScale,0.97)
        XCTAssertGreaterThan(hud.container.yScale,1.02)
        XCTAssertGreaterThan(hud.fill.xScale,1.4);XCTAssertGreaterThan(hud.fill.yScale,1.1)
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
