import XCTest
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
