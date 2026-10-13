import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceSchedulingDiagnosticsTests:XCTestCase {
    func testSceneDragProbeDefaultsOffAndCannotMoveHeldNodeOrChangeAuthority()throws {
        let defaults=UserDefaults.standard,key="cc.performanceDiagnostics",previous=defaults.object(forKey:key)
        defaults.set(false,forKey:key)
        defer{if let previous {defaults.set(previous,forKey:key)}else{defaults.removeObject(forKey:key)}}
        let state=NativeBoardState(tiles:[.init(id:"held",cell:.init(column:0,row:0),value:1)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        defer{scene.dispose()}
        scene.layout(size:scene.size,insets:.zero)
        let geometry=try XCTUnwrap(scene.boardGeometry),node=try XCTUnwrap(scene.sourceNativeTileNode("held"))
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        scene.moveDrag(to:.init(x:node.position.x+12,y:node.position.y+6))
        let position=node.position,canonical=scene.engine.state
        scene.update(10);scene.didFinishUpdate()
        XCTAssertTrue(scene.sourceDragInputDiagnosticSnapshot().isEmpty)
        XCTAssertEqual(node.position,position);XCTAssertEqual(scene.engine.state,canonical)
    }
    func testSceneDragProbeMeasuresActualFrameGapsAndPostPaintDriftWithoutCorrectingIt()throws {
        let defaults=UserDefaults.standard,key="cc.performanceDiagnostics",previous=defaults.object(forKey:key)
        defaults.set(true,forKey:key)
        defer{if let previous {defaults.set(previous,forKey:key)}else{defaults.removeObject(forKey:key)}}
        let state=NativeBoardState(tiles:[.init(id:"held",cell:.init(column:0,row:0),value:1)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        defer{scene.dispose()}
        scene.layout(size:scene.size,insets:.zero)
        let geometry=try XCTUnwrap(scene.boardGeometry),node=try XCTUnwrap(scene.sourceNativeTileNode("held"))
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)))
        scene.moveDrag(to:.init(x:node.position.x+12,y:node.position.y+6))
        let painted=node.position,canonical=scene.engine.state
        scene.update(10);scene.didFinishUpdate()
        node.position = .init(x:painted.x+3,y:painted.y+4)
        let changed=node.position
        scene.update(10.016);scene.didFinishUpdate();scene.update(10.056)
        let snapshot=scene.sourceDragInputDiagnosticSnapshot()
        XCTAssertEqual(snapshot["sceneGaps"],2);XCTAssertEqual(snapshot["sceneOver20Ms"],1);XCTAssertEqual(snapshot["sceneOver30Ms"],1)
        XCTAssertEqual(try XCTUnwrap(snapshot["sceneGapWorstMs"]),40,accuracy:0.001)
        XCTAssertEqual(snapshot["heldPositionChecks"],2);XCTAssertEqual(snapshot["heldPositionMismatches"],1)
        XCTAssertEqual(try XCTUnwrap(snapshot["heldPositionErrorWorstPoints"]),5,accuracy:0.001)
        XCTAssertEqual(node.position,changed,"Probe records actual displacement without correcting gameplay presentation")
        XCTAssertEqual(scene.engine.state,canonical)
        scene.cancelDrag();scene.didFinishUpdate()
        XCTAssertEqual(scene.sourceDragInputDiagnosticSnapshot()["heldPositionChecks"],2,"Retired held-node receipt cannot keep sampling")
    }
    private final class TimedParticipant:NativeSourceAnimationParticipant {
        let paint:()->Void
        init(_ paint:@escaping()->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint()}
    }
    private final class TimedTicker:NativeSourceTickerParticipant {
        let paint:()->Void
        init(_ paint:@escaping()->Void){self.paint=paint}
        func advanceSourceTicker(seconds:Double,deltaMilliseconds:Double,frame:UInt64){paint()}
    }
    func testDefaultOffAttributionDoesNotReadClockForRealRootRawOrTickerParticipants() {
        var reads=0,calls=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true,
            diagnosticMillisecondsNow:{reads+=1;return 0})
        defer{service.dispose()}
        let root=TimedParticipant{calls+=1},raw=TimedParticipant{calls+=1},ticker=TimedTicker{calls+=1}
        let rootLease=service.register(participant:root,duration:1,domain:.sourceGSAP(.timeline)){_ in}
        let rawLease=service.register(participant:raw,duration:1,domain:.nativeRaw){_ in}
        let tickerLease=service.registerSourceTickerListener(ownerID:"off",generation:1,participant:ticker){}
        service.deliver(wallMilliseconds:40)
        XCTAssertGreaterThan(calls,0);XCTAssertEqual(reads,0)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(snapshot.rootHighWater,0);XCTAssertEqual(snapshot.slowestParticipantOwner,"none")
        rootLease?.cancel();rawLease?.cancel();tickerLease?.cancel()
    }
    func testAttributionIdentifiesActualRootRawAndTickerCostsAndRetiresAcrossGenerations() {
        var now=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        defer{service.dispose()};service.enableSchedulingDiagnostics()
        let root=TimedParticipant{now+=2},raw=TimedParticipant{now+=3},ticker=TimedTicker{now+=4}
        for generation in 1...4 {
            let rootLease=service.register(participant:root,duration:1,domain:.sourceGSAP(.timeline)){_ in}
            let rawLease=service.register(participant:raw,duration:1,domain:.nativeRaw){_ in}
            let tickerLease=service.registerSourceTickerListener(ownerID:"ticker-\(generation)",generation:UInt64(generation),participant:ticker){}
            _=service.takeSchedulingDiagnostics()
            service.deliver(wallMilliseconds:Double(generation)*40)
            let snapshot=service.takeSchedulingDiagnostics()
            XCTAssertEqual(snapshot.worstRootMilliseconds,2);XCTAssertEqual(snapshot.worstRawMilliseconds,3)
            XCTAssertEqual(snapshot.worstTickerListenerMilliseconds,4)
            XCTAssertEqual(snapshot.slowestParticipantOwner,"ticker-\(generation)")
            XCTAssertEqual(snapshot.slowestParticipantPhase,"source-ticker-listener")
            XCTAssertEqual(snapshot.rootHighWater,1);XCTAssertEqual(snapshot.rawHighWater,1);XCTAssertEqual(snapshot.tickerListenerHighWater,1)
            rootLease?.cancel();rawLease?.cancel();tickerLease?.cancel()
            XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(service.sourceTickerListenerCount,0)
        }
    }
    func testAttributionSeparatesRAFPaintFromItsExactMicrotaskCheckpointAndPreservesOrder()throws {
        var now=0.0,trace:[String]=[]
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        defer{service.dispose();scope.dispose();fifo.dispose()}
        service.sourceMicrotaskTasks=tasks;service.enableSchedulingDiagnostics()
        let label=String(repeating:"x",count:300)
        _=service.requestSourceAnimationFrame(ownerID:label,generation:1,callback:{
            trace.append("A");now+=5
            XCTAssertTrue(scope.enqueue{trace.append("microtask-A");now+=7})
        })
        _=service.requestSourceAnimationFrame(ownerID:"B",generation:1,callback:{trace.append("B");now+=1})
        service.deliver(wallMilliseconds:40)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(trace,["A","microtask-A","B"])
        XCTAssertEqual(snapshot.worstRAFMilliseconds,5);XCTAssertEqual(snapshot.worstMicrotaskMilliseconds,7)
        XCTAssertEqual(snapshot.slowestParticipantPhase,"microtask-boundary")
        XCTAssertEqual(snapshot.slowestParticipantOwner,String(label.prefix(120)))
        XCTAssertEqual(snapshot.rafHighWater,2);XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        let reset=service.takeSchedulingDiagnostics()
        XCTAssertEqual(reset.slowestParticipantOwner,"none");XCTAssertEqual(reset.worstMicrotaskMilliseconds,0)
    }
    func testWorstDeliveryTotalsUseOneFrameAndIdentifyActualFIFOReaction()throws {
        var now=0.0,trace:[String]=[]
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{
            if fifo.isInsideCheckpoint {now+=2};return true
        }))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        defer{service.dispose();scope.dispose();fifo.dispose()}
        service.sourceMicrotaskTasks=tasks;service.enableSchedulingDiagnostics()
        _=service.requestSourceAnimationFrame(ownerID:"producer",generation:1,callback:{
            trace.append("paint");now+=5
            XCTAssertTrue(scope.enqueue(owner:"actual reaction owner"){trace.append("reaction");now+=7})
        })
        service.deliver(wallMilliseconds:40)
        // A subsequent faster frame cannot contribute its maxima to the first.
        _=service.requestSourceAnimationFrame(ownerID:"later",generation:1,callback:{now+=1})
        service.deliver(wallMilliseconds:80)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(trace,["paint","reaction"])
        XCTAssertEqual(snapshot.worstDeliveryMilliseconds,14)
        XCTAssertEqual(snapshot.worstFrameRAFTotalMilliseconds,5)
        XCTAssertEqual(snapshot.worstFrameFIFOValidationMilliseconds,2)
        XCTAssertEqual(snapshot.worstFrameFIFOReactionMilliseconds,7)
        XCTAssertEqual(snapshot.worstFrameFIFOJobCount,1)
        XCTAssertEqual(snapshot.worstFrameOtherMilliseconds,0)
        XCTAssertEqual(snapshot.slowestReactionMilliseconds,7)
        XCTAssertEqual(snapshot.slowestReactionOwner,"actual_reaction_owner")
    }
    func testWorstDeliveryReportsCumulativeRootsAndCompletionCleanup() {
        var now=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        defer{service.dispose()};service.enableSchedulingDiagnostics()
        let a=TimedParticipant{now+=2},b=TimedParticipant{now+=3}
        let first=service.register(participant:a,duration:0.04,domain:.sourceGSAP(.timeline)){_ in now+=4}
        let second=service.register(participant:b,duration:1,domain:.sourceGSAP(.timeline)){_ in}
        _=service.takeSchedulingDiagnostics();now=0
        service.deliver(wallMilliseconds:40)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(snapshot.worstFrameRootTotalMilliseconds,5)
        XCTAssertEqual(snapshot.worstFrameRootCleanupMilliseconds,4)
        XCTAssertEqual(snapshot.worstFrameRootCount,2)
        XCTAssertEqual(snapshot.worstFrameTickerTotalMilliseconds,9)
        XCTAssertEqual(snapshot.worstDeliveryMilliseconds,9)
        XCTAssertEqual(snapshot.worstFrameOtherMilliseconds,0)
        XCTAssertFalse(first?.active ?? true);second?.cancel()
    }
    func testFIFOAttributionIsOffByDefaultAndPreservesNestedReactionAndCancellationOrder()throws {
        var now=0.0,reads=0,trace:[Int]=[],reports:[NativeSourceMicrotaskFIFO.CheckpointDiagnostics]=[]
        let fifo=NativeSourceMicrotaskFIFO()
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
        let retired=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
        defer{fifo.dispose()}
        fifo.performTask(.inputTask){XCTAssertTrue(scope.enqueue{trace.append(0)})}
        XCTAssertEqual(reads,0)
        fifo.diagnosticMillisecondsNow={reads+=1;return now}
        fifo.onDiagnosticCheckpoint={reports.append($0)}
        fifo.performTask(.inputTask){
            XCTAssertTrue(scope.enqueue(owner:"first"){
                trace.append(1);now+=3
                XCTAssertTrue(scope.enqueue(owner:"nested"){trace.append(3);now+=2})
                retired.dispose()
            })
            XCTAssertTrue(retired.enqueue{XCTFail("Retired reaction must never execute")})
            XCTAssertTrue(scope.enqueue(owner:"second"){trace.append(2);now+=1})
        }
        XCTAssertEqual(trace,[0,1,2,3]);XCTAssertEqual(fifo.pendingCount,0)
        XCTAssertEqual(reports.count,1);XCTAssertEqual(reports.first?.jobs,4)
        XCTAssertEqual(reports.first?.reactionMilliseconds,6)
        XCTAssertEqual(reports.first?.slowestReactionOwner,"first")
        XCTAssertGreaterThan(reads,0)
    }
    func testRetiringOldServiceDoesNotClearReplacementDiagnosticOwnerOnSharedFIFO()throws {
        var now=0.0
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
        var old:NativeSourceAnimationClockService?=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        old?.sourceMicrotaskTasks=tasks;old?.enableSchedulingDiagnostics()
        let replacement=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        replacement.sourceMicrotaskTasks=tasks;replacement.enableSchedulingDiagnostics()
        defer{replacement.dispose();scope.dispose();fifo.dispose()}
        old?.dispose();old=nil
        XCTAssertTrue(fifo.diagnosticsEnabled)
        _=replacement.requestSourceAnimationFrame(ownerID:"current",generation:2,callback:{
            XCTAssertTrue(scope.enqueue(owner:"current-reaction"){now+=7})
        })
        replacement.deliver(wallMilliseconds:40)
        let snapshot=replacement.takeSchedulingDiagnostics()
        XCTAssertEqual(snapshot.worstFrameFIFOReactionMilliseconds,7)
        XCTAssertEqual(snapshot.slowestReactionOwner,"current-reaction")
        replacement.dispose()
        XCTAssertFalse(fifo.diagnosticsEnabled)
    }
    func testReplacingDiagnosticOwnerInsideCheckpointDoesNotReportOldJobsToNewOwner()throws {
        var oldNow=0.0,newNow=1000.0,newClockReads=0,trace:[Int]=[]
        var oldReports:[NativeSourceMicrotaskFIFO.CheckpointDiagnostics]=[],newReports:[NativeSourceMicrotaskFIFO.CheckpointDiagnostics]=[]
        let fifo=NativeSourceMicrotaskFIFO(),oldOwner=UUID(),newOwner=UUID()
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{true}))
        defer{scope.dispose();fifo.dispose()}
        fifo.installDiagnostics(owner:oldOwner,clock:{oldNow},report:{oldReports.append($0)})
        fifo.performTask(.inputTask){
            XCTAssertTrue(scope.enqueue(owner:"old-job"){
                trace.append(1);oldNow+=3
                fifo.installDiagnostics(owner:newOwner,clock:{newClockReads+=1;return newNow},report:{newReports.append($0)})
            })
            XCTAssertTrue(scope.enqueue(owner:"same-checkpoint-job"){trace.append(2);oldNow+=2})
        }
        XCTAssertEqual(trace,[1,2]);XCTAssertTrue(oldReports.isEmpty);XCTAssertTrue(newReports.isEmpty)
        XCTAssertEqual(newClockReads,0,"A captured old checkpoint cannot sample its replacement clock")
        fifo.performTask(.inputTask){XCTAssertTrue(scope.enqueue(owner:"new-job"){trace.append(3);newNow+=5})}
        XCTAssertEqual(trace,[1,2,3]);XCTAssertEqual(newReports.count,1)
        XCTAssertEqual(newReports.first?.jobs,1);XCTAssertEqual(newReports.first?.reactionMilliseconds,5)
        XCTAssertEqual(newReports.first?.slowestReactionOwner,"new-job")
    }
    func testDiagnosticsRemainOffUntilEnabledAndDoNotChangeSourceCallbackOrder() {
        var reads=0,now=10.0,order:[Int]=[]
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,
            diagnosticMillisecondsNow:{reads+=1;return now})
        defer{service.dispose()}
        _=service.requestSourceAnimationFrame(ownerID:"a",generation:1,callback:{order.append(1)})
        service.deliver(wallMilliseconds:10)
        XCTAssertEqual(reads,0);XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0)
        service.enableSchedulingDiagnostics()
        _=service.requestSourceAnimationFrame(ownerID:"b",generation:1,callback:{order.append(2);now+=0.75})
        _=service.requestSourceAnimationFrame(ownerID:"c",generation:1,callback:{order.append(3)})
        service.deliver(wallMilliseconds:20)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(order,[1,2,3]);XCTAssertEqual(snapshot.deliveries,1)
        XCTAssertEqual(snapshot.worstDeliveryMilliseconds,0.75,accuracy:1e-8)
        XCTAssertEqual(service.pendingSourceAnimationFrameCount,0)
        XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0)
    }
    func testSourceDeliveryGapResetsAcrossForegroundAndIdleDemand() {
        var now=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        defer{service.dispose()};service.enableSchedulingDiagnostics()
        func queue(){_=service.requestSourceAnimationFrame(ownerID:"sample",generation:1,callback:{})}
        queue();service.deliver(wallMilliseconds:0)
        now=1000;queue();service.deliver(wallMilliseconds:1000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().worstGapMilliseconds,0,"An idle link restart must not be called an active frame stall")
        queue();service.setSourceForeground(false);now=2000;service.deliver(wallMilliseconds:2000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0)
        service.setSourceForeground(true);now=3000;service.deliver(wallMilliseconds:3000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().worstGapMilliseconds,0)
    }
    func testContinuousSourceDemandRecordsActualGapAndStopsAfterDisposal() {
        var now=10.0,calls=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceFrameTransportEnabled:true,diagnosticMillisecondsNow:{now})
        service.enableSchedulingDiagnostics()
        func queue(){_=service.requestSourceAnimationFrame(ownerID:"next",generation:1,callback:{calls+=1;queue()})}
        queue();service.deliver(wallMilliseconds:10)
        now=60;service.deliver(wallMilliseconds:60)
        let snapshot=service.takeSchedulingDiagnostics()
        XCTAssertEqual(snapshot.deliveries,2);XCTAssertEqual(snapshot.worstGapMilliseconds,50)
        XCTAssertEqual(calls,2);XCTAssertEqual(service.pendingSourceAnimationFrameCount,1)
        service.dispose();now=1000;service.deliver(wallMilliseconds:1000)
        XCTAssertEqual(service.takeSchedulingDiagnostics().deliveries,0);XCTAssertEqual(calls,2)
    }
    func testRenderAggregatesDetectPaintBunchingAndTouchLatencyWithoutIntervalAlias() {
        var metrics=NativeSourceDragRenderDiagnostics()
        metrics.rendered(at:0,dragging:true)
        metrics.painted(at:10,touchMilliseconds:4);metrics.rendered(at:12,dragging:true)
        metrics.painted(at:15,touchMilliseconds:14);metrics.painted(at:16,touchMilliseconds:15)
        metrics.rendered(at:20,dragging:true)
        XCTAssertEqual(metrics.rendersWithoutPaint,1);XCTAssertEqual(metrics.rendersOnePaint,1)
        XCTAssertEqual(metrics.rendersMultiplePaints,1);XCTAssertEqual(metrics.worstPaintAgeMilliseconds,4)
        XCTAssertEqual(metrics.worstQueuedTouchAgeMilliseconds,6)
        metrics.resetInterval();metrics.rendered(at:30,dragging:true)
        XCTAssertEqual(metrics.rendersWithoutPaint,1);XCTAssertEqual(metrics.rendersMultiplePaints,0)
        metrics.retireDrag();metrics.rendered(at:1000,dragging:false)
        metrics.rendered(at:1010,dragging:true)
        XCTAssertEqual(metrics.worstPaintAgeMilliseconds,14,"Old drag ages must not leak into a successor drag")
    }
}
