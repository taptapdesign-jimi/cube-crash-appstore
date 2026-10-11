import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeSourceBoardEntryMountedTests:XCTestCase {
    @MainActor private final class State {
        var wall=0.0,current=true,draws=0,acquired=0,released=0,sounds=0,stops=0,half=0,haptics=0,bg=0,depths:[Bool]=[],finished:[NativeSourceBoardEntryOwner.Completion]=[]
    }
    @MainActor private final class Fixture {
        let state=State(),service:NativeSourceAnimationClockService,driver:NativeSourceOuterTimelineAdapter,timeouts=NativeSourceAppTimeoutOwner(),parent=SKNode(),nodes:[NativeDiceNode]
        var owner:NativeSourceBoardEntryOwner?
        init() {
            let state=state
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{state.wall},sourceFrameTransportEnabled:true)
            driver=NativeSourceOuterTimelineAdapter(service:service)
            let textures=NativeBoardTextures(root:NativeTestResources.root)
            nodes=(0..<3).map{i in NativeDiceNode(id:"tile-\(i)",value:[3,0,2][i],kind:"regular",variant:nil,depth:1,locked:i != 0,textures:textures)}
            for (i,node) in nodes.enumerated(){parent.addChild(node);node.position=CGPoint(x:Double(i*148+64)*0.5,y:500-32);node.zRotation = -CGFloat(Double(i)*0.01);node.installSourceOuterDriver(driver,generation:1,geometryScale:0.5)}
        }
        func install(acquire:(()->Void)?=nil,sound:(()->Void)?=nil)throws {
            let state=state
            let captures=nodes.enumerated().map{i,node in NativeSourceBoardEntryOwner.Capture(node:node,parent:parent,generation:1,sourcePosition:.init(x:i*148+64,y:64),nativePosition:node.position,sourceRotation:Double(i)*0.01,geometryScale:0.5,locked:node.locked,value:node.value)}
            owner=try XCTUnwrap(NativeSourceBoardEntryOwner(service:service,captures:captures,generation:1,timeouts:timeouts,random:{let a=[0.12,0.74,0.19,0.81,0.43];defer{state.draws+=1};return a[state.draws%5]},current:{state.current},acquireFrames:{state.acquired+=1;acquire?();var done=false;return {guard !done else{return};done=true;state.released+=1}},sound:{duration in XCTAssertEqual(duration,0.646,accuracy:1e-12);state.sounds+=1;sound?();var done=false;return{guard !done else{return};done=true;state.stops+=1}},half:{state.half+=1},haptic:{state.haptics+=1},syncZ:{_,entry in state.depths.append(entry)},drawBG:{state.bg+=1},finished:{state.finished.append($0)}))
        }
        func deliver(_ ms:Double){state.wall=ms;service.deliver(wallMilliseconds:ms)}
        func dispose(){owner?.dispose();owner=nil;timeouts.cancelAll();for node in nodes{node.dispose()};driver.dispose();service.dispose()}
    }
    func testActualOneParentAndDelayedCallsCompleteWithTypedProvenanceAndCapturedStopOnce()throws {
        let f=Fixture();defer{f.dispose()};try f.install();let source=try XCTUnwrap(f.owner)
        XCTAssertTrue(source.start(groupedHaptics:true));XCTAssertEqual(f.state.draws,5);XCTAssertEqual(f.state.acquired,1);XCTAssertEqual(f.state.sounds,1);XCTAssertEqual(f.state.depths,[true,true,true]);XCTAssertEqual(f.timeouts.pendingCount,1)
        XCTAssertTrue(f.nodes.allSatisfy{$0.sourceBoardEntryBinding==source.id});XCTAssertEqual(f.nodes[0].sourceLocalScale.x,0,accuracy:1e-6)
        for time in stride(from:16.0,through:800,by:16){f.deliver(time)}
        XCTAssertEqual(f.state.finished.map(\.outcome),[.normal]);XCTAssertEqual(f.state.finished.first?.id,source.id);XCTAssertEqual(f.state.half,1);XCTAssertEqual(f.state.haptics,1);XCTAssertEqual(f.state.released,1);XCTAssertEqual(f.state.stops,1);XCTAssertEqual(f.state.bg,1);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertEqual(source.pendingCallCount,0)
        XCTAssertEqual(f.state.depths.filter{!$0}.count,3)
        for (i,node) in f.nodes.enumerated(){XCTAssertEqual(node.position.x,Double(i*148+64)*0.5,accuracy:2e-5);XCTAssertEqual(node.sourceLocalScale.x,1,accuracy:1e-6);XCTAssertNil(node.sourceBoardEntryBinding)}
        source.dispose();f.deliver(900);XCTAssertEqual(f.state.finished.count,1);XCTAssertEqual(f.state.stops,1)
    }
    func testActualCanonicalTransportMatchesOriginal570FrameOracleNormalSleepingCase()throws {
        struct Oracle:Decodable{let cases:[Case]};struct Case:Decodable{let awake:Bool,scenario:String,samples:[Sample]};struct Sample:Decodable{let wall:Double,settled:Bool,tiles:[Pose]};struct Pose:Decodable{let x:Double,y:Double,rotation:Double,scale:Double,alpha:Double}
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceBoardEntryTickerV9Oracle",withExtension:"json")),oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url)),row=try XCTUnwrap(oracle.cases.first{!$0.awake && $0.scenario=="normal"})
        let f=Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true))
        for sample in row.samples {
            f.deliver(sample.wall)
            for (node,pose) in zip(f.nodes,sample.tiles){XCTAssertEqual(node.position.x,pose.x*0.5,accuracy:2e-5);XCTAssertEqual(node.position.y,500-pose.y*0.5,accuracy:2e-5);XCTAssertEqual(node.zRotation,-pose.rotation,accuracy:1e-6);XCTAssertEqual(node.sourceLocalScale.x,pose.scale,accuracy:1e-6);XCTAssertEqual(node.alpha,pose.alpha,accuracy:1e-6)}
            XCTAssertEqual(!f.state.finished.isEmpty,sample.settled,"actual Source completion at wall \(sample.wall)")
        }
    }
    func testActualWallWatchdogForcesOriginalSettleWhileForegroundTimelineIsPaused()async throws {
        let f=Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true));f.deliver(16);f.service.setSourceGlobalPaused(true);f.deliver(400)
        XCTAssertTrue(f.state.finished.isEmpty);XCTAssertEqual(f.state.half,0)
        try await Task.sleep(for:.milliseconds(1350))
        XCTAssertEqual(f.state.finished.map(\.outcome),[.forced]);XCTAssertEqual(f.state.released,1);XCTAssertEqual(f.state.stops,1);XCTAssertEqual(f.timeouts.pendingCount,0)
        XCTAssertEqual(f.nodes[0].alpha,1,accuracy:1e-6);XCTAssertEqual(f.nodes[1].alpha,0.25,accuracy:1e-6);XCTAssertEqual(f.nodes[2].alpha,0,accuracy:1e-6);XCTAssertTrue(f.nodes.allSatisfy{abs($0.sourceLocalScale.x-1)<0.000001})
    }
    func testActualAbortSettlesOnlyCapturedContainersAndCancelsEveryFutureCallback()throws {
        let f=Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true));f.deliver(173);f.owner?.abort()
        XCTAssertEqual(f.state.finished.map(\.outcome),[.aborted]);XCTAssertEqual(f.state.bg,0);XCTAssertEqual(f.state.stops,1);XCTAssertEqual(f.state.released,1);XCTAssertEqual(f.timeouts.pendingCount,0)
        let position=f.nodes[0].position,half=f.state.half;f.deliver(800);XCTAssertEqual(f.nodes[0].position,position);XCTAssertEqual(f.state.half,half);XCTAssertEqual(f.state.finished.count,1)
    }
    func testRouteScopeRetirementPreservesActualPaintWithoutManufacturingCompletion()throws {
        let f=Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true));f.deliver(173)
        let scale=f.nodes[0].sourceLocalScale,position=f.nodes[0].position;f.state.current=false;f.owner?.retire()
        XCTAssertEqual(f.state.finished.map(\.outcome),[.retired]);XCTAssertEqual(f.nodes[0].sourceLocalScale,scale);XCTAssertEqual(f.nodes[0].position,position);XCTAssertNil(f.nodes[0].sourceBoardEntryBinding);XCTAssertEqual(f.state.bg,0);XCTAssertEqual(f.state.stops,1);XCTAssertEqual(f.timeouts.pendingCount,0)
        f.deliver(900);XCTAssertEqual(f.nodes[0].position,position)
    }
    func testAcquireCallbackRetirementConsumesLateReleaseWithoutMountingAnyParent()throws {
        let f=Fixture();defer{f.dispose()};try f.install(acquire:{[weak f] in f?.owner?.dispose()})
        XCTAssertFalse(try XCTUnwrap(f.owner).start(groupedHaptics:true));XCTAssertEqual(f.state.draws,5);XCTAssertEqual(f.state.released,1);XCTAssertEqual(f.state.sounds,0);XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertTrue(f.nodes.allSatisfy{$0.sourceBoardEntryBinding==nil})
    }
    func testSoundCallbackRetirementStopsReturnedOldSoundWithoutLeavingTimersOrNodesBound()throws {
        let f=Fixture();defer{f.dispose()};try f.install(sound:{[weak f] in f?.owner?.dispose()})
        XCTAssertFalse(try XCTUnwrap(f.owner).start(groupedHaptics:true));XCTAssertEqual(f.state.released,1);XCTAssertEqual(f.state.stops,1);XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.timeouts.pendingCount,0);XCTAssertTrue(f.nodes.allSatisfy{$0.sourceBoardEntryBinding==nil})
    }
    func testActualOwnerDeallocationRetiresWeakClockRootsAndCapturedSound()throws {
        let f=Fixture();defer{f.dispose()};try f.install();weak var old=f.owner;XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true));f.owner=nil
        XCTAssertNil(old);XCTAssertEqual(f.state.finished.map(\.outcome),[.retired]);XCTAssertEqual(f.state.stops,1);XCTAssertEqual(f.state.released,1);XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
    }
    func testDestroyedCapturedLeafCannotBePaintedButOriginalParentCompletionStillResolves()throws {
        let f=Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true));f.nodes[1].dispose();let painted=f.nodes[1].position
        for time in stride(from:16.0,through:800,by:16){f.deliver(time)}
        XCTAssertEqual(f.nodes[1].position,painted);XCTAssertEqual(f.state.finished.map(\.outcome),[.normal]);XCTAssertEqual(f.state.half,1);XCTAssertEqual(f.state.stops,1)
    }
    func testReparentedCapturedNodeReleasesOnlyItsOldBindingWithoutPaintingNewParent()throws {
        let f=Fixture();defer{f.dispose()};try f.install();XCTAssertTrue(try XCTUnwrap(f.owner).start(groupedHaptics:true));f.deliver(160)
        let node=f.nodes[0],newParent=SKNode(),position=node.position,scale=node.sourceLocalScale
        node.removeFromParent();newParent.addChild(node);f.owner?.retire()
        XCTAssertEqual(node.position,position);XCTAssertEqual(node.sourceLocalScale,scale);XCTAssertNil(node.sourceBoardEntryBinding)
        let replacement=UUID();XCTAssertTrue(node.beginSourceBoardEntryPaint(id:replacement));f.owner?.dispose()
        XCTAssertEqual(node.sourceBoardEntryBinding,replacement);node.endSourceBoardEntryPaint(id:replacement)
    }

}
