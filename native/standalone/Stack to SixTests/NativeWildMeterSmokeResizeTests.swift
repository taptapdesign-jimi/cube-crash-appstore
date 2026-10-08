import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeWildMeterSmokeResizeTests:XCTestCase {
    @MainActor private final class Wall:NativeWildMeterSmokeWallDriving {
        var now=0,next=0,epoch=0,callback:(()->Void)?
        func start(_ delivery:@escaping()->Void)->(()->Void)?{
            epoch+=1;let captured=epoch;next=now+100;callback=delivery
            return {[weak self] in if self?.epoch==captured{self?.callback=nil}}
        }
        func deliver(_ milliseconds:Int){now=milliseconds;if callback != nil,now>=next{next+=100;callback?()}}
    }
    @MainActor private final class Resources:NativeWildMeterSmokeResources {
        struct Circle{let radius:Double;var pose:NativeWildMeterSmokePlan.Pose}
        var circles:[UInt64:Circle]=[:],created=0,destroyed=0,onCreate:(()->Void)?,onDestroy:(()->Void)?
        func create(id:UInt64,x:Double,y:Double,radius:Double){circles[id] = .init(radius:radius,pose:.init(x:x,y:y,alpha:1));created+=1;onCreate?()}
        func paint(id:UInt64,_ pose:NativeWildMeterSmokePlan.Pose){circles[id]?.pose=pose}
        func destroy(id:UInt64){if circles.removeValue(forKey:id) != nil{destroyed+=1;onDestroy?()}}
    }
    func testActualUnionServiceFullSourceLoaderSmokeAndResizeTraces() throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"smoke-resize-oracle",withExtension:"json"))
        let packet=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        let scenarios=packet["scenarios"] as! [[Any]],allRows=packet["rows"] as! [[String:Any]]
        XCTAssertEqual(scenarios.count,16);XCTAssertEqual(allRows.count,2576)
        for scenario in scenarios {
            let name=scenario[0] as! String,actions=scenario[1] as! [[Any]],rows=allRows.filter{$0["name"] as! String==name}
            // This is the original MANUAL numeric-root context, not wall wake:
            // exporter startTime(anim) captures LAST delivered Source time.
            // Actual Date/RAF awake/sleeping transport is tested separately.
            var now=0.0,hud:NativeWildMeterHUDOwner!,disabled=false,draws=0,bounce=0.0
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
            let driver=NativeWildMeterSourceDriver(service:service),wall=Wall(),resources=Resources()
            let smoke=NativeWildMeterSmokeOwner(driver:driver,wall:wall,resources:resources,geometry:{.init(x:24,y:52,left:hud.left,width:hud.width,fillAlive:true,parentAttached:true)},disabled:{disabled},current:{true},random:{draws+=1;return Double((draws*37)%997)/997})
            hud=NativeWildMeterHUDOwner(driver:driver,maximum:200,initialWidth:0,isPad:name.hasSuffix("-ipad"),draw:{_ in},drawBounce:{bounce=$0},stopSmoke:{smoke.stopSmoke()},stopEmission:{smoke.stopEmission()},startSmoke:{smoke.startEmission()})
            hud.setWidth(200,drawTrack:{_ in})
            for row in rows {
                let tick=row["tick"] as! Int,eventWall=Double(row["wall"] as! Int);wall.now=Int(eventWall)
                for action in actions where action[0] as! Int==tick {
                    let kind=action[1] as! String,value=action.count>2 ? action[2] as! Double:0
                    switch kind {
                    case "gain","reset":hud.setProgress(value,animated:kind=="gain")
                    case "consume":hud.consume(value)
                    case "resize":hud.setWidth(value,drawTrack:{_ in})
                    case "pause":service.setSourceGlobalPaused(true)
                    case "resume":service.setSourceGlobalPaused(false)
                    case "disable":disabled=true
                    case "stop":smoke.stopSmoke()
                    default:XCTFail("Unknown source action")
                    }
                }
                wall.deliver(Int(eventWall));now=eventWall;if tick>0{service.deliver(wallMilliseconds:now)}
                let label="\(name)/\(tick)"
                XCTAssertEqual(hud.width,row["width"] as! Double,accuracy:1e-10,label)
                XCTAssertEqual(hud.left,row["left"] as! Double,accuracy:1e-10,label)
                XCTAssertEqual(bounce,row["bounce"] as! Double,accuracy:1e-10,label)
                XCTAssertEqual(draws,row["draw"] as! Int,label)
                XCTAssertEqual(hud.consumeActive,row["active"] as! Bool,label)
                XCTAssertEqual(hud.pendingRatio,row["pending"] as? Double,label)
                XCTAssertEqual(hud.queuedRatios,row["queue"] as! [Double],label)
                XCTAssertEqual(smoke.isEmitting ? 1:0,row["intervals"] as! Int,label)
                let circles=resources.circles.sorted{$0.key<$1.key}.map{$0.value},expected=row["bubbles"] as! [[String:Double]]
                XCTAssertEqual(circles.count,expected.count,label)
                for (circle,exp)in zip(circles,expected){
                    XCTAssertEqual(circle.radius,exp["radius"]!,accuracy:1e-12,label)
                    XCTAssertEqual(circle.pose.x,exp["x"]!,accuracy:1e-10,label)
                    XCTAssertEqual(circle.pose.y,exp["y"]!,accuracy:1e-10,label)
                    XCTAssertEqual(circle.pose.alpha,exp["alpha"]!,accuracy:1e-10,label)
                }
            }
            hud.dispose();smoke.dispose();service.dispose()
            XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
            XCTAssertEqual(resources.created,resources.destroyed);XCTAssertNil(wall.callback)
        }
    }
    func testCircleAcquisitionReentrantTerminalRejectsBeforeRemainingRNGOrRoots() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let wall=Wall(),resources=Resources();var smoke:NativeWildMeterSmokeOwner!,draws=0
        smoke=NativeWildMeterSmokeOwner(driver:NativeWildMeterSourceDriver(service:service),wall:wall,resources:resources,geometry:{.init(x:24,y:52,left:0,width:100,fillAlive:true,parentAttached:true)},disabled:{false},current:{true},random:{draws+=1;return 0.5})
        resources.onCreate={smoke.dispose()};smoke.startEmission();wall.deliver(100)
        XCTAssertEqual(draws,3);XCTAssertEqual(resources.created,resources.destroyed)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertNil(wall.callback);service.dispose()
    }
    func testOldCleanupPreservesReentrantNewBubbleAndZeroWidthSkipsAllRNG() {
        var now=0.0,draws=0,width=100.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let wall=Wall(),resources=Resources();var smoke:NativeWildMeterSmokeOwner!
        smoke=NativeWildMeterSmokeOwner(driver:NativeWildMeterSourceDriver(service:service),wall:wall,resources:resources,geometry:{.init(x:24,y:52,left:0,width:width,fillAlive:true,parentAttached:true)},disabled:{false},current:{true},random:{draws+=1;return 0.5})
        smoke.startEmission();wall.deliver(100);XCTAssertEqual(draws,6)
        var reentered=false
        resources.onDestroy={if !reentered{reentered=true;smoke.startEmission();wall.deliver(200)}}
        smoke.stopSmoke();XCTAssertEqual(smoke.activeBubbleCount,1);XCTAssertEqual(resources.circles.count,1)
        width=0;wall.deliver(300);XCTAssertEqual(draws,12)
        now=500;service.deliver(wallMilliseconds:now)
        XCTAssertEqual(smoke.activeBubbleCount,1);smoke.dispose();service.dispose()
        XCTAssertEqual(resources.created,resources.destroyed);XCTAssertNil(wall.callback)
    }
    func testActualExistingTimeoutEmissionContinuesThroughSourcePauseAndDisposesOnce() async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        service.setSourceGlobalPaused(true)
        let timeouts=NativeSourceAppTimeoutOwner(),wall=NativeWildMeterSmokeWallDriver(timeouts:timeouts,generation:9),resources=Resources()
        let delivered=expectation(description:"two actual independent wall callbacks");delivered.expectedFulfillmentCount=2
        resources.onCreate={delivered.fulfill()}
        let smoke=NativeWildMeterSmokeOwner(driver:NativeWildMeterSourceDriver(service:service),wall:wall,resources:resources,geometry:{.init(x:24,y:52,left:0,width:100,fillAlive:true,parentAttached:true)},disabled:{false},current:{true},random:{0.5})
        smoke.startEmission();await fulfillment(of:[delivered],timeout:1)
        XCTAssertGreaterThanOrEqual(resources.created,2);XCTAssertEqual(smoke.activeBubbleCount,resources.created)
        XCTAssertEqual(service.sourceAnimationSeconds,0)
        XCTAssertEqual(timeouts.pendingCount,1)
        smoke.dispose();smoke.dispose();service.dispose()
        XCTAssertEqual(timeouts.pendingCount,0);XCTAssertEqual(resources.created,resources.destroyed)
        XCTAssertFalse(service.hasActiveClock)
    }
    func testActualSpriteKitSiblingSmokeOriginalCircleDepthAndSourceProjection() async throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        service.setSourceGlobalPaused(true)
        let stage=SKNode(),timeouts=NativeSourceAppTimeoutOwner()
        let presentation=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:200,isPad:false,sourceOrigin:.init(x:24,y:52),sourceToNative:{.init(x:$0.x,y:844-$0.y)},nativeToSource:{.init(x:$0.x,y:844-$0.y)},smokeDisabled:{false},current:{true},visualRandom:{0.5})
        presentation.setProgress(0.5,animated:false)
        // Ordinary animated gain starts wall emission before any Source frame.
        presentation.setProgress(0.8,animated:true)
        let delivered=expectation(description:"actual original sibling bubble")
        timeouts.schedule(sourceID:"fixture-observe",generation:1,delayMilliseconds:125,elapsed:{delivered.fulfill()})
        await fulfillment(of:[delivered],timeout:1)
        let bubble=try XCTUnwrap(stage.children.first{$0.name=="wild-meter-smoke"} as? SKShapeNode)
        XCTAssertTrue(bubble.parent === stage);XCTAssertFalse(bubble.parent === presentation.container)
        XCTAssertEqual(bubble.zPosition,2000);XCTAssertEqual(bubble.alpha,1)
        XCTAssertEqual(bubble.position.x,74,accuracy:1e-6);XCTAssertEqual(bubble.position.y,787,accuracy:1e-6)
        let radius=2.5+pow(0.5,1.7)*3
        XCTAssertEqual(Double(try XCTUnwrap(bubble.path).boundingBox.width),radius*2,accuracy:1e-6)
        presentation.resize(maximum:280,sourceOrigin:.init(x:24,y:60))
        XCTAssertEqual(presentation.fillPose.width,0);XCTAssertEqual(presentation.container.position.y,784)
        presentation.dispose();service.dispose();XCTAssertTrue(stage.children.isEmpty);XCTAssertEqual(timeouts.pendingCount,0)
    }
    func testTerminalFinalPaintCannotRestartSpringAndReentrantResizePreservesNewProgress() {
        var now=0.0,owner:NativeWildMeterHUDOwner!,disposeOnFinal=false
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let driver=NativeWildMeterSourceDriver(service:service)
        owner=NativeWildMeterHUDOwner(driver:driver,maximum:200,initialWidth:200,isPad:false,draw:{_ in
            if disposeOnFinal && now>=830 {owner.dispose()}
        },drawBounce:{_ in},stopSmoke:{},stopEmission:{},startSmoke:{})
        owner.consume(0.5);disposeOnFinal=true
        for n in 1...83 {now=Double(n*10);service.deliver(wallMilliseconds:now)}
        XCTAssertEqual(service.activeParticipantCount,0,"Terminal final paint must not admit the completion spring")
        owner.setProgress(0.8,animated:true);XCTAssertEqual(service.activeParticipantCount,0)
        disposeOnFinal=false
        let replacement=NativeWildMeterHUDOwner(driver:driver,maximum:200,initialWidth:20,isPad:false,draw:{_ in},drawBounce:{_ in},stopSmoke:{},stopEmission:{},startSmoke:{})
        replacement.setWidth(300,drawTrack:{_ in replacement.setProgress(0.7,animated:false)})
        XCTAssertEqual(replacement.width,210,"Old resize final paint must not overwrite reentrant new progress")
        replacement.dispose();service.dispose()
    }

    @MainActor private final class RawModal:NativeSourceAnimationParticipant {
        var delivered=0
        func advanceSourceAnimation(seconds:Double){delivered+=1}
    }
    func testActualDateRAFSourceWakeAndAlreadyRunningUnionTransportContexts() throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"wake-context-oracle",withExtension:"json"))
        let packet=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        let traces=packet["traces"] as! [[String:Any]];XCTAssertEqual(traces.count,4)
        for trace in traces {
            let sleeping=trace["sleeping"] as! Bool,paused=trace["pause"] as! Bool
            var now=0.0,draws=0,hud:NativeWildMeterHUDOwner!,bounce=0.0
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
            let modal=RawModal()
            // Honest independently-owned Raw modal transport; NOT a source
            // renderer/activity lease or a fake permanent source participant.
            let raw = sleeping ? nil:service.register(participant:modal,duration:2,domain:.nativeRaw,cleanup:{_ in})
            let wall=Wall(),resources=Resources(),driver=NativeWildMeterSourceDriver(service:service)
            let smoke=NativeWildMeterSmokeOwner(driver:driver,wall:wall,resources:resources,geometry:{.init(x:24,y:52,left:hud.left,width:hud.width,fillAlive:true,parentAttached:true)},disabled:{false},current:{true},random:{draws+=1;return Double((draws*37)%997)/997})
            hud=NativeWildMeterHUDOwner(driver:driver,maximum:200,initialWidth:0,isPad:false,draw:{_ in},drawBounce:{bounce=$0},stopSmoke:{smoke.stopSmoke()},stopEmission:{smoke.stopEmission()},startSmoke:{smoke.startEmission()})
            hud.setWidth(200,drawTrack:{_ in});hud.setProgress(0.2,animated:false)
            now=10;wall.now=10;hud.setProgress(0.8,animated:true)
            XCTAssertEqual(service.sourceAnimationSeconds,sleeping ? 0.01:0,accuracy:1e-12)
            var previous=10
            for row in trace["rows"] as! [[String:Any]] {
                let at=row["wall"] as! Int
                for milliseconds in (previous+1)...at {
                    now=Double(milliseconds)
                    if paused,milliseconds==200{service.setSourceGlobalPaused(true)}
                    if paused,milliseconds==700{service.setSourceGlobalPaused(false)}
                    wall.deliver(milliseconds)
                }
                service.deliver(wallMilliseconds:now);previous=at
                XCTAssertEqual(service.sourceAnimationSeconds,row["animation"] as! Double,accuracy:1e-10)
                XCTAssertEqual(hud.width,row["width"] as! Double,accuracy:1e-10)
                XCTAssertEqual(hud.left,row["left"] as! Double,accuracy:1e-10)
                XCTAssertEqual(bounce,row["bounce"] as! Double,accuracy:1e-10)
                XCTAssertEqual(draws,row["draw"] as! Int)
                let circles=resources.circles.sorted{$0.key<$1.key}.map{$0.value},expected=row["bubbles"] as! [[String:Double]]
                XCTAssertEqual(circles.count,expected.count)
                for(circle,exp)in zip(circles,expected){
                    XCTAssertEqual(circle.pose.x,exp["x"]!,accuracy:1e-10);XCTAssertEqual(circle.pose.y,exp["y"]!,accuracy:1e-10)
                    XCTAssertEqual(circle.pose.alpha,exp["alpha"]!,accuracy:1e-10);XCTAssertEqual(circle.radius,exp["radius"]!,accuracy:1e-12)
                }
            }
            hud.dispose();smoke.dispose();raw?.cancel();service.dispose()
            XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
            XCTAssertEqual(resources.created,resources.destroyed)
        }
    }

}
