import XCTest
import AVFAudio
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeJourneyAmbientTests:XCTestCase {
    private final class Transport:NativeAmbientLoopTransport {
        struct Command {let op:String,id:String;var source:String?;var gain:Double?;var duration:Double?}
        var commands:[Command]=[]
        func start(id:String,source:String,gain:Double){commands.append(.init(op:"start",id:id,source:source,gain:gain))}
        func gain(id:String,to value:Double,duration:Double){commands.append(.init(op:"gain",id:id,gain:value,duration:duration))}
        func pause(id:String){commands.append(.init(op:"pause",id:id))}
        func resume(id:String,gain:Double){commands.append(.init(op:"resume",id:id,gain:gain))}
        func stop(id:String){commands.append(.init(op:"stop",id:id))}
        func dispose(){commands.append(.init(op:"dispose",id:"all"))}
    }
    private final class Job:NativeMusicCancellation {
        let duration:Double,callback:()->Void;var cancelled=false
        init(_ duration:Double,_ callback:@escaping ()->Void){self.duration=duration;self.callback=callback}
        func cancel(){cancelled=true}
    }
    private final class Scheduler:NativeMusicScheduler {
        var jobs:[Job]=[]
        func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation{let job=Job(seconds,callback);jobs.append(job);return job}
    }
    func testBackpackContinuationKeepsEveryWorldVoiceGainAndDeadlineWithoutRestart() {
        for world in 1...3 {
            let transport=Transport(),scheduler=Scheduler()
            var time=100.0
            let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler,now:{time})
            owner.setRoute(.world(world),generation:1)
            let commands=transport.commands.count,jobs=scheduler.jobs.count
            time=102;owner.continueCurrentRoute(generation:2)
            time=104;owner.continueCurrentRoute(generation:3)
            XCTAssertEqual(transport.commands.count,commands,"Backpack and return must not start/stop/retune any voice")
            XCTAssertEqual(scheduler.jobs.count,jobs,"Collection visit must not extend existing World fade deadline")
            XCTAssertTrue(scheduler.jobs.allSatisfy{!$0.cancelled})
            owner.setRoute(.none,generation:4)
            XCTAssertTrue(transport.commands.contains{$0.op=="stop"})
            owner.dispose()
        }
    }

    func testUFOVisiblePassDeduplicatesFadesAndRejectsStaleExitAndOtherRoutes() {
        let transport=Transport(),scheduler=Scheduler()
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler)
        defer{owner.dispose()}
        let id=NativeJourneyAmbientOwner.spaceship
        owner.setSpaceshipVisible(true)
        XCTAssertFalse(transport.commands.contains{$0.id==id})
        owner.setRoute(.world(3),generation:1)
        owner.setSpaceshipVisible(true);owner.setSpaceshipVisible(true)
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="start"}.count,1)
        XCTAssertEqual(transport.commands.last?.duration,0.25)
        XCTAssertEqual(transport.commands.last?.gain,0.35)
        owner.setSpaceshipVisible(false)
        XCTAssertEqual(transport.commands.last?.duration ?? 0,0.3,accuracy:0.001)
        let old=scheduler.jobs.last!
        owner.setSpaceshipVisible(true)
        let count=transport.commands.count;old.callback()
        XCTAssertTrue(old.cancelled);XCTAssertEqual(transport.commands.count,count)
        owner.setForeground(false);owner.setSpaceshipVisible(false);owner.setForeground(true)
        XCTAssertFalse(transport.commands.contains{$0.id==id && $0.op=="resume"})
        owner.setSpaceshipVisible(true);owner.setEnabled(false)
        XCTAssertEqual(transport.commands.last{$0.id==id}?.op,"stop")
        owner.setEnabled(true)
        owner.beginJourneyTransition(board:21,generation:2)
        let before=transport.commands.count;owner.setSpaceshipVisible(true)
        XCTAssertEqual(transport.commands.count,before)
    }
    func testShipVisibilityUsesCurrentBoundsOpacityAndScrolledViewport() throws {
        let frames=(0...120).map {index -> JimiNativeWorldAmbient.Frame in
            .init(time:Double(index)/30,x:CGFloat(index)*5-100,y:200,width:50,height:30,rotation:0,opacity:1,asset:"ship",behind:false)
        }
        let plan=JimiNativeWorldAmbient.Plan(id:0,worldID:3,duration:4,frames:frames,assets:["ship"],visualBounds:CGRect(x:-100,y:200,width:650,height:30))
        let viewport=CGRect(x:0,y:100,width:390,height:700)
        XCTAssertFalse(plan.shipVisible(at:0,viewport:viewport,scale:1))
        XCTAssertTrue(plan.shipVisible(at:1,viewport:viewport,scale:1))
        XCTAssertFalse(plan.shipVisible(at:3.9,viewport:viewport,scale:1))
        XCTAssertFalse(plan.shipVisible(at:1,viewport:viewport.offsetBy(dx:0,dy:400),scale:1))
        XCTAssertFalse(plan.shipVisible(at:1,viewport:CGRect(x:0,y:240,width:390,height:600),scale:1),"Header occlusion must be silent")
        XCTAssertEqual(try XCTUnwrap(plan.nextShipVisibilityBoundary(after:0,viewport:viewport,scale:1)),1.0/3,accuracy:0.001)
        XCTAssertEqual(try XCTUnwrap(plan.nextShipVisibilityBoundary(after:1,viewport:viewport,scale:1)),490.0/150,accuracy:0.001)
    }
    func testMountedShipVisibilityAggregatesBothShipsAndCancelsOnScrollParkCleanup() async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let content=UIView(frame:CGRect(x:0,y:0,width:390,height:844)),resources=JimiNativeWorldResources(root:root)
        let asset="./assets/journey assets/robo/ship1@2x.png"
        let frames=(0...60).map {index -> JimiNativeWorldAmbient.Frame in
            .init(time:Double(index)/30,x:CGFloat(index)*10-100,y:300,width:50,height:30,rotation:0,opacity:1,asset:asset,behind:false)
        }
        let plans=(0...1).map{JimiNativeWorldAmbient.Plan(id:$0,worldID:3,duration:2,frames:frames,assets:[asset],visualBounds:CGRect(x:-100,y:300,width:650,height:30))}
        let owner=JimiNativeWorldAmbient(plans:plans,content:content,resources:resources)
        defer{owner.cleanup();resources.cleanup()}
        let ready=expectation(description:"Ship resources")
        owner.prepareVisible(viewport:content.bounds,scale:1){ok in XCTAssertTrue(ok);ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
        var reports:[Bool]=[];let entered=expectation(description:"Actual visible crossing")
        owner.onShipVisibility={value in reports.append(value);if reports.count==1 {XCTAssertTrue(value);entered.fulfill()}}
        owner.update(enabled:true,viewport:content.bounds,scale:1)
        XCTAssertTrue(reports.isEmpty,"Trajectory overlap alone must not emit audio")
        await fulfillment(of:[entered],timeout:2)
        XCTAssertEqual(reports,[true],"Two overlapping ships share one receipt")
        owner.update(enabled:true,viewport:content.bounds.offsetBy(dx:0,dy:500),scale:1)
        XCTAssertEqual(reports,[true,false])
        owner.update(enabled:true,viewport:content.bounds,scale:1)
        try await Task.sleep(for:.milliseconds(80))
        XCTAssertEqual(reports,[true,false,true])
        owner.update(enabled:false,viewport:content.bounds,scale:1)
        XCTAssertEqual(reports.last,false)
        let count=reports.count;owner.cleanup()
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertEqual(reports.count,count);XCTAssertEqual(owner.layerCount,0)
    }
    func testActualUFOFilePlaysOnceAndDoesNotLoopOrReplayAfterExhaustedResume()throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let engine=AVAudioEngine(),format=try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate:48000,channels:2))
        try engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:480)
        let transport=NativeFileAmbientLoopTransport(root:root,engine:engine)
        defer{transport.dispose()}
        var errors:[String]=[];transport.onError={errors.append($0)}
        let id=NativeJourneyAmbientOwner.spaceship
        transport.start(id:id,source:"assets/sound/Board transitions/Area 55/ufo movement.wav",gain:1)
        XCTAssertTrue(errors.isEmpty)
        let buffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:format,frameCapacity:480))
        var first:Float=0,tail:Float=0
        for block in 0..<1000 {
            XCTAssertEqual(try engine.renderOffline(480,to:buffer),.success)
            let samples=try XCTUnwrap(buffer.floatChannelData)
            for channel in 0..<2 {for index in 0..<Int(buffer.frameLength) {
                let value=abs(samples[channel][index]);if block<456 {first=max(first,value)}else{tail=max(tail,value)}
            }}
        }
        XCTAssertGreaterThan(first,0.01);XCTAssertLessThan(tail,0.000001)
        transport.pause(id:id);transport.resume(id:id,gain:1)
        // Exhausted one-shot remains stopped; resuming it must not queue a new segment.
        XCTAssertFalse(engine.isRunning)
    }
    func testArea55LoopIsContinuousAcrossWorldAndEveryBoardAndReleasesOutsideWorld() {
        let transport=Transport(),scheduler=Scheduler()
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler)
        let id=NativeJourneyAmbientOwner.area55
        owner.setRoute(.world(3),generation:1)
        XCTAssertEqual(transport.commands.first{$0.id==id && $0.op=="start"}?.source,"assets/sound/worlds/Area55/area55-ambient-loop-v1.wav")
        XCTAssertEqual(transport.commands.first{$0.id==id && $0.op=="start"}?.gain,0.36)
        for board in 21...30 {
            owner.beginJourneyTransition(board:board,generation:UInt64(board))
            owner.setRoute(.gameplay(.journey,board),generation:UInt64(board))
        }
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="start"}.count,1)
        XCTAssertFalse(transport.commands.contains{$0.id==id && $0.op=="stop"})
        owner.setForeground(false);owner.setForeground(true)
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="resume"}.count,1)
        XCTAssertEqual(transport.commands.last{$0.id==id && $0.op=="resume"}?.gain,0.36)
        owner.setEnabled(false);owner.setEnabled(true)
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="start"}.count,2)
        owner.beginJourneyTransition(board:11,generation:31)
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="stop"}.count,2)
        owner.setRoute(.gameplay(.arcade,21),generation:32)
        owner.setRoute(.world(1),generation:33)
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="start"}.count,2)
        owner.beginJourneyTransition(board:21,generation:34)
        XCTAssertEqual(transport.commands.filter{$0.id==id && $0.op=="start"}.count,3)
        owner.dispose();let count=transport.commands.count
        owner.beginJourneyTransition(board:22,generation:35)
        XCTAssertEqual(transport.commands.count,count)
    }
    func testActualForestTransportRecoversStoppedEngineOnRepeatedResume() async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let engine=AVAudioEngine(),format=try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate:48000,channels:2))
        try engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:480)
        let transport=NativeFileAmbientLoopTransport(root:root,engine:engine)
        defer{transport.dispose()}
        var errors:[String]=[];transport.onError={errors.append($0)}
        let id=NativeJourneyAmbientOwner.gameplay
        transport.start(id:id,source:"assets/sound/worlds/Forest/gameplay/forest-gameplay-sound.wav",gain:0.54)
        let buffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:format,frameCapacity:480))
        for cycle in 0..<3 {
            var peak:Float=0
            for block in 0..<100 {
                if block%10==0 {await Task.yield()}
                XCTAssertEqual(try engine.renderOffline(480,to:buffer),.success)
                let samples=try XCTUnwrap(buffer.floatChannelData)
                for channel in 0..<2 {for index in 0..<Int(buffer.frameLength) {peak=max(peak,abs(samples[channel][index]))}}
            }
            XCTAssertGreaterThan(peak,0.00001,"Forest ambient audible after recovery \(cycle)")
            if cycle==0 {
                engine.stop()
                NotificationCenter.default.post(name:.AVAudioEngineConfigurationChange,object:engine)
                XCTAssertTrue(engine.isRunning,"Configuration reset recovers the requested live voice")
            }else{
                transport.pause(id:id);transport.pause(id:id)
                NotificationCenter.default.post(name:.AVAudioEngineConfigurationChange,object:engine)
                XCTAssertFalse(engine.isRunning,"A paused/background voice must remain silent")
            }
            transport.resume(id:id,gain:0.54)
            XCTAssertTrue(engine.isRunning)
        }
        XCTAssertTrue(errors.isEmpty,errors.joined(separator:","))
    }
    func testArea55SeamlessDerivedFileIsAdmittedAndRendersAcrossTwoLoopBoundaries() async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let source="assets/sound/worlds/Area55/area55-ambient-loop-v1.wav"
        let file=try AVAudioFile(forReading:root.appendingPathComponent(source))
        XCTAssertEqual(Double(file.length)/file.processingFormat.sampleRate,9.5,accuracy:0.001)
        let engine=AVAudioEngine(),format=try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate:48000,channels:2))
        try engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:480)
        let transport=NativeFileAmbientLoopTransport(root:root,engine:engine)
        defer{transport.dispose()}
        var errors:[String]=[];transport.onError={errors.append($0)}
        transport.start(id:NativeJourneyAmbientOwner.area55,source:source,gain:1)
        XCTAssertTrue(errors.isEmpty,"\(errors)")
        let buffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:format,frameCapacity:480))
        var peaks=[Float](repeating:0,count:3)
        for block in 0..<2000 {
            if block%50==0 {await Task.yield()}
            XCTAssertEqual(try engine.renderOffline(480,to:buffer),.success)
            let samples=try XCTUnwrap(buffer.floatChannelData)
            for channel in 0..<2 {for index in 0..<Int(buffer.frameLength) {
                let value=abs(samples[channel][index])
                let cycle=min(2,block/950);peaks[cycle]=max(peaks[cycle],value)
            }}
        }
        for peak in peaks {XCTAssertGreaterThan(peak,0.01)}
    }
    func testActualGullFileRenderingHasSilentGapBeforeSecondCall()throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let engine=AVAudioEngine(),format=try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate:48000,channels:2))
        try engine.enableManualRenderingMode(.offline,format:format,maximumFrameCount:480)
        let transport=NativeFileAmbientLoopTransport(root:root,engine:engine)
        defer{transport.dispose()}
        var errors:[String]=[];transport.onError={errors.append($0)}
        transport.start(id:NativeJourneyAmbientOwner.gull,source:"assets/sound/Board transitions/Beach/galeb.wav",gain:0.36)
        XCTAssertTrue(errors.isEmpty,"\(errors)")
        let buffer=try XCTUnwrap(AVAudioPCMBuffer(pcmFormat:format,frameCapacity:480))
        var first:Float=0,gap:Float=0,second:Float=0
        for block in 0..<2252 {
            XCTAssertEqual(try engine.renderOffline(480,to:buffer),.success)
            let samples=try XCTUnwrap(buffer.floatChannelData)
            for channel in 0..<2 {for index in 0..<Int(buffer.frameLength) {
                let peak=abs(samples[channel][index])
                if block<376 {first=max(first,peak)}
                else if block<1876 {gap=max(gap,peak)}
                else {second=max(second,peak)}
            }}
        }
        XCTAssertGreaterThan(first,0.01);XCTAssertLessThanOrEqual(first,0.361)
        XCTAssertLessThan(gap,0.000001,"All15 seconds between calls must be silent")
        XCTAssertGreaterThan(second,0.01);XCTAssertLessThanOrEqual(second,0.361)
    }
    func testGullSampleClockGapAndResumePreserveFifteenSecondsOfSilence() {
        let timing=NativeAmbientLoopTiming(fileDuration:3.76,gap:15)
        XCTAssertEqual(timing.duration,18.76,accuracy:0.000001)
        XCTAssertEqual(timing.segment(from:0).offset,0)
        XCTAssertEqual(timing.segment(from:0).delay,0)
        XCTAssertEqual(timing.segment(from:2).offset,2)
        XCTAssertEqual(timing.segment(from:3.76).delay,15,accuracy:0.000001)
        XCTAssertEqual(timing.segment(from:8.76).delay,10,accuracy:0.000001)
        XCTAssertEqual(timing.segment(from:18.76).delay,0,accuracy:0.000001)
        XCTAssertEqual(timing.segment(from:18.76).offset,0,accuracy:0.000001)
        let sea=NativeAmbientLoopTiming(fileDuration:30,gap:0)
        XCTAssertEqual(sea.segment(from:35).offset,5)
        XCTAssertEqual(sea.segment(from:35).delay,0)
    }
    func testBeachLoopsKeepExactGainsAcrossWorldTransitionAndEveryBeachBoard() {
        let transport=Transport(),scheduler=Scheduler()
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler)
        defer{owner.dispose()}
        let ids=[NativeJourneyAmbientOwner.beach,NativeJourneyAmbientOwner.gull]
        owner.setRoute(.world(2),generation:2)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="start"}.map(\.gain),[0.28,0.36])
        for board in 11...20 {
            owner.beginJourneyTransition(board:board,generation:UInt64(board))
            owner.setRoute(.gameplay(.journey,board),generation:UInt64(board))
        }
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="start"}.count,2)
        XCTAssertFalse(transport.commands.contains{ids.contains($0.id) && $0.op=="stop"})
        owner.beginJourneyTransition(board:21,generation:21)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="stop"}.count,2)
        let count=transport.commands.filter{ids.contains($0.id) && $0.op=="start"}.count
        owner.setRoute(.gameplay(.arcade,12),generation:22)
        owner.setRoute(.world(3),generation:23)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="start"}.count,count)
    }
    func testBeachTransitionColdEntryPauseSettingsAndExitReleaseExactLoops() {
        let transport=Transport(),scheduler=Scheduler()
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler)
        let ids=[NativeJourneyAmbientOwner.beach,NativeJourneyAmbientOwner.gull]
        owner.beginJourneyTransition(board:11,generation:1)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="start"}.count,2)
        owner.setForeground(false);owner.setForeground(true)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="resume"}.count,2)
        owner.setEnabled(false)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="stop"}.count,2)
        owner.setEnabled(true)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="start"}.count,4)
        owner.setRoute(.hub,generation:2)
        XCTAssertEqual(transport.commands.filter{ids.contains($0.id) && $0.op=="stop"}.count,4)
        owner.dispose();let count=transport.commands.count
        owner.beginJourneyTransition(board:12,generation:3)
        XCTAssertEqual(transport.commands.count,count)
    }
    func testForestResultBeesUseTwentyPercentGainAndOwnedPauseMuteRouteCleanup() {
        let transport=Transport(),scheduler=Scheduler()
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler)
        let id=NativeJourneyAmbientOwner.resultBees
        owner.setRoute(.gameplay(.journey,3),generation:3)
        owner.setForestResult(active:true,suspended:false,generation:2)
        XCTAssertFalse(transport.commands.contains {$0.id==id})
        owner.setForestResult(active:true,suspended:false,generation:3)
        owner.setForestResult(active:true,suspended:false,generation:3)
        XCTAssertEqual(transport.commands.filter {$0.id==id && $0.op=="start"}.count,1)
        XCTAssertEqual(transport.commands.first {$0.id==id && $0.op=="start"}?.gain,0.20)
        owner.setForestResult(active:true,suspended:true,generation:3)
        XCTAssertEqual(transport.commands.last?.op,"pause")
        owner.setForeground(false);owner.setForeground(true)
        XCTAssertFalse(transport.commands.contains {$0.id==id && $0.op=="resume"})
        owner.setForestResult(active:true,suspended:false,generation:3)
        XCTAssertEqual(transport.commands.last?.op,"resume")
        owner.setEnabled(false);XCTAssertEqual(transport.commands.last?.op,"stop")
        owner.setEnabled(true)
        XCTAssertEqual(transport.commands.filter {$0.id==id && $0.op=="start"}.count,2)
        owner.setForestResult(active:false,suspended:false,generation:3)
        XCTAssertEqual(transport.commands.last?.id,id);XCTAssertEqual(transport.commands.last?.op,"stop")
        owner.setRoute(.gameplay(.journey,11),generation:4)
        let count=transport.commands.count
        owner.setForestResult(active:true,suspended:false,generation:4)
        XCTAssertEqual(transport.commands.count,count)
        owner.dispose();owner.dispose()
    }
    func testWorldHoldHasOneDeadlineAndForestUsesExactAuthoredLayerGains() {
        let transport=Transport(),scheduler=Scheduler();var time=100.0
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler,now:{time})
        owner.setRoute(.hub,generation:1);owner.setRoute(.world(1),generation:2)
        XCTAssertEqual(transport.commands.first{$0.op=="start"}?.gain,0.45)
        XCTAssertEqual(transport.commands.first{$0.op=="gain" && $0.id==NativeJourneyAmbientOwner.worlds}?.gain,0.135)
        XCTAssertEqual(transport.commands.filter{$0.op=="start" && $0.id != NativeJourneyAmbientOwner.worlds}.map(\.gain),[0.612,0.612])
        XCTAssertEqual(scheduler.jobs.count,1);XCTAssertEqual(scheduler.jobs[0].duration,5)
        time=103;owner.setRoute(.world(1),generation:2);XCTAssertEqual(scheduler.jobs.count,1)
        time=105;scheduler.jobs[0].callback()
        XCTAssertEqual(transport.commands.last?.duration,1)
        time=106;scheduler.jobs.last?.callback();XCTAssertEqual(transport.commands.last?.op,"stop")
        owner.dispose()
    }
    func testGameplayHandoffAndCleanResidualOwnTheirDifferentFades() {
        let transport=Transport(),scheduler=Scheduler();var time=100.0
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler,now:{time})
        owner.setRoute(.world(1),generation:2);owner.setRoute(.gameplay(.journey,3),generation:3)
        XCTAssertEqual(transport.commands.filter{$0.op=="gain"}.map(\.duration),[1.5,1.5])
        XCTAssertEqual(transport.commands.last?.gain,0.54)
        time=103;owner.cleanResidualFinished(generation:2)
        XCTAssertEqual(transport.commands.last?.op,"start")
        owner.cleanResidualFinished(generation:3)
        XCTAssertEqual(transport.commands.last?.duration,2)
        owner.dispose()
    }
    func testForestContinueReacquiresAmbientBeforeAndAfterResidualFadeCompletes() {
        for fadeCompleted in [false,true] {
            let transport=Transport(),scheduler=Scheduler();var time=100.0
            let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler,now:{time})
            defer {owner.dispose()}
            let id=NativeJourneyAmbientOwner.gameplay
            owner.setRoute(.gameplay(.journey,2),generation:3)
            owner.cleanResidualFinished(generation:3)
            let oldFade=scheduler.jobs.last!
            if fadeCompleted {time=102;oldFade.callback()}
            owner.beginJourneyTransition(board:3,generation:3)
            XCTAssertEqual(transport.commands.last?.id,id)
            XCTAssertEqual(transport.commands.last?.gain,0.54)
            XCTAssertEqual(transport.commands.last?.op,fadeCompleted ? "start":"gain")
            let count=transport.commands.count
            time=104;oldFade.callback()
            XCTAssertEqual(transport.commands.count,count,"Old board completion cannot stop the new board")
            owner.setForeground(false);owner.setForeground(true)
            XCTAssertEqual(transport.commands.last?.op,"resume")
            XCTAssertEqual(transport.commands.last?.id,id,"No expired residual deadline may retire the new board on foreground")
            XCTAssertEqual(transport.commands.last?.gain,0.54)
        }
    }
    func testBackgroundKeepsAbsoluteDeadlineAndResumesCurrentFileVoicesOnly() {
        let transport=Transport(),scheduler=Scheduler();var time=100.0
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler,now:{time})
        owner.setRoute(.world(1),generation:2);let old=scheduler.jobs[0]
        owner.setForeground(false);let count=transport.commands.count;old.callback();XCTAssertEqual(transport.commands.count,count)
        time=109;owner.setForeground(true)
        XCTAssertFalse(transport.commands.contains{$0.op=="resume" && $0.id==NativeJourneyAmbientOwner.worlds})
        XCTAssertEqual(transport.commands.filter{$0.op=="resume"}.count,2)
        XCTAssertEqual(transport.commands.filter{$0.op=="start"}.count,3,"Foreground must retain old file positions")
        owner.dispose()
    }
    func testUnmuteRestoresCurrentVisibleLoopsWithoutExtendingWorldDeadline() {
        let transport=Transport(),scheduler=Scheduler();var time=100.0
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler,now:{time})
        owner.setRoute(.world(1),generation:2);owner.setEnabled(false);time=104;owner.setEnabled(true)
        XCTAssertEqual(transport.commands.filter{$0.op=="start" && $0.id==NativeJourneyAmbientOwner.bees}.count,2)
        let starts=transport.commands.filter{$0.op=="start"}.count
        owner.setRoute(.world(1),generation:2);XCTAssertEqual(transport.commands.filter{$0.op=="start"}.count,starts)
        owner.setEnabled(false);time=109;owner.setEnabled(true)
        XCTAssertTrue(transport.commands.contains{$0.op=="stop" && $0.id==NativeJourneyAmbientOwner.worlds})
        owner.setForeground(false);let count=transport.commands.filter{$0.op=="resume" && $0.id==NativeJourneyAmbientOwner.worlds}.count
        owner.setForeground(true);XCTAssertEqual(transport.commands.filter{$0.op=="resume" && $0.id==NativeJourneyAmbientOwner.worlds}.count,count)
        owner.dispose()
    }
    func testMuteDisposeAndModeIsolationRejectOldLoopCallbacks() {
        let transport=Transport(),scheduler=Scheduler()
        let owner=NativeJourneyAmbientOwner(root:URL(fileURLWithPath:"/unused"),enabled:true,transport:transport,scheduler:scheduler)
        owner.setRoute(.world(1),generation:2);let old=scheduler.jobs[0]
        owner.setEnabled(false);owner.setEnabled(true);let count=transport.commands.count;old.callback();XCTAssertEqual(transport.commands.count,count)
        owner.setRoute(.gameplay(.arcade,1),generation:3)
        XCTAssertFalse(transport.commands.contains{$0.id==NativeJourneyAmbientOwner.gameplay && $0.op=="start"})
        owner.dispose();owner.dispose();let ended=transport.commands.count;owner.setRoute(.world(1),generation:4);old.callback()
        XCTAssertEqual(transport.commands.count,ended)
    }
}
