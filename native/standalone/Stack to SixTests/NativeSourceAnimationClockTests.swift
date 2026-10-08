import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeSourceAnimationClockV5Tests:XCTestCase {
    private final class Participant:NativeSourceAnimationParticipant {
        var values:[Double]=[],onAdvance:((Double)->Void)?
        func advanceSourceAnimation(seconds:Double){values.append(seconds);onAdvance?(seconds)}
    }
    private final class Carrier:NativeFinitePresentation {
        var values:[Double]=[]
        override func paint(seconds:TimeInterval){values.append(seconds)}
    }
    func testActualDisplayLinkServesTwoWeakRawParticipantsAndStopsAtFiniteUnionEnd()async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000),a=Participant(),b=Participant()
        let complete=expectation(description:"both actual finite carrier receipts");complete.expectedFulfillmentCount=2
        var finished=0
        let first=service.register(participant:a,duration:0.065,domain:.nativeRaw){success in XCTAssertTrue(success);finished += 1;complete.fulfill()}
        let second=service.register(participant:b,duration:0.095,domain:.nativeRaw){success in XCTAssertTrue(success);finished += 1;complete.fulfill()}
        XCTAssertNotNil(first);XCTAssertNotNil(second);XCTAssertEqual(service.displayLinkCreationCount,1)
        await fulfillment(of:[complete],timeout:2)
        XCTAssertEqual(a.values.first,0);XCTAssertEqual(b.values.first,0);XCTAssertGreaterThan(a.values.count,1);XCTAssertGreaterThan(b.values.count,1)
        XCTAssertEqual(finished,2);XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
        first?.cancel();second?.cancel();service.dispose();XCTAssertEqual(finished,2)
    }
    func testExplicitElapsedDomainsKeepRawHitchAndIndependentSourceDefaultLagAndPause() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),raw=Participant(),source=Participant()
        _=service.register(participant:raw,duration:5,domain:.nativeRaw){_ in}
        _=service.register(participant:source,duration:5,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in}
        service.deliver(wallMilliseconds:100);service.deliver(wallMilliseconds:1100)
        XCTAssertEqual(raw.values,[0,1]);XCTAssertEqual(source.values.count,2);XCTAssertEqual(source.values[1],0.133,accuracy:1e-12)
        service.setSourceGlobalPaused(true);service.deliver(wallMilliseconds:1200)
        XCTAssertEqual(raw.values.last!,1.1,accuracy:1e-12);XCTAssertEqual(source.values.count,2)
        service.setSourceGlobalPaused(false);service.deliver(wallMilliseconds:1216)
        XCTAssertEqual(source.values.last!,0.149,accuracy:1e-12);XCTAssertEqual(raw.values.last!,1.116,accuracy:1e-12)
        XCTAssertEqual(service.displayLinkCreationCount,1);service.dispose()
    }
    func testWeakDeallocationRetiresCapturedReceiptExactlyOnceWithoutOwnerRetention() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0);var owner:Participant?=Participant(),calls=0
        weak var weakOwner=owner
        let lease=service.register(participant:owner!,duration:1,domain:.sourceGSAP(.timeline),wallMilliseconds:0){success in XCTAssertFalse(success);calls += 1}
        owner=nil;XCTAssertNil(weakOwner);service.deliver(wallMilliseconds:16)
        XCTAssertEqual(calls,1);XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
        lease?.cancel();service.dispose();XCTAssertEqual(calls,1)
    }
    func testReentrantDisposeRejectsNewRegistrationAndCannotRestartReplacementLink() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),old=Participant(),replacement=Participant();var oldCalls=0,rejected=false
        _=service.register(participant:old,duration:1,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in
            oldCalls += 1
            rejected=service.register(participant:replacement,duration:1,domain:.nativeRaw){_ in XCTFail("unadmitted replacement callback")}==nil
        }
        service.dispose();service.dispose()
        XCTAssertTrue(rejected);XCTAssertEqual(oldCalls,1);XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock);XCTAssertEqual(service.displayLinkCreationCount,1)
    }
    func testCompletionCanAppendReplacementWithoutParallelClockOrObsoleteCancellation() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),old=Participant(),new=Participant();var replacement:NativeSourceAnimationClockService.Lease?,calls=0
        let oldLease=service.register(participant:old,duration:0.02,domain:.nativeRaw){success in
            XCTAssertTrue(success);calls += 1
            replacement=service.register(participant:new,duration:1,domain:.nativeRaw){_ in}
        }
        service.deliver(wallMilliseconds:10);service.deliver(wallMilliseconds:40)
        XCTAssertEqual(calls,1);XCTAssertTrue(replacement?.active==true);XCTAssertEqual(service.displayLinkCreationCount,1)
        oldLease?.cancel();XCTAssertTrue(replacement?.active==true);XCTAssertEqual(calls,1)
        service.dispose();XCTAssertFalse(service.hasActiveClock)
    }
    func testRawPauseForegroundUsesFirstZeroDeltaBaselineAndSourceRemainsExplicit() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),raw=Participant()
        let lease=service.register(participant:raw,duration:5,domain:.nativeRaw){_ in}
        service.deliver(wallMilliseconds:100);service.deliver(wallMilliseconds:116)
        lease?.setSuspended(true);XCTAssertFalse(service.hasActiveClock)
        lease?.setSuspended(false);service.deliver(wallMilliseconds:5000)
        XCTAssertEqual(raw.values.last!,0.016,accuracy:1e-12)
        service.deliver(wallMilliseconds:5016);XCTAssertEqual(raw.values.last!,0.032,accuracy:1e-12)
        service.dispose()
    }
    func testActualFiniteUIKitCarrierRetainsCoveredPauseAcrossForegroundAndFinishesOnce()async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:240,height:400)),root=UIViewController();window.rootViewController=root;window.makeKeyAndVisible()
        let carrier=Carrier(viewport:window.bounds.size,duration:0.06);carrier.configureAnimationDelivery(service)
        root.view.addSubview(carrier)
        let finished=expectation(description:"actual finite UIKit completion");var calls=0
        carrier.onFinished={success in XCTAssertTrue(success);calls += 1;finished.fulfill()};carrier.start()
        XCTAssertEqual(carrier.values.first,0);XCTAssertEqual(service.displayLinkCreationCount,1)
        carrier.setSuspended(true)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertFalse(service.hasActiveClock);XCTAssertTrue(carrier.hasActiveClock);XCTAssertEqual(calls,0)
        carrier.setSuspended(false)
        await fulfillment(of:[finished],timeout:2)
        XCTAssertEqual(calls,1);XCTAssertNil(carrier.superview);XCTAssertFalse(carrier.hasActiveClock);XCTAssertFalse(service.hasActiveClock)
        carrier.dispose();service.dispose();window.isHidden=true;XCTAssertEqual(calls,1)
    }
    func testCoveredCarrierDeallocationRetiresReceiptWithoutARecurringCallback() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
        var carrier:Carrier?=Carrier(viewport:CGSize(width:240,height:400),duration:1)
        weak var weakCarrier=carrier
        var calls=0
        carrier!.configureAnimationDelivery(service)
        carrier!.onFinished={success in XCTAssertFalse(success);calls += 1}
        carrier!.setSuspended(true);carrier!.start()
        XCTAssertFalse(service.hasActiveClock);XCTAssertEqual(service.activeParticipantCount,1)
        carrier=nil
        XCTAssertNil(weakCarrier);XCTAssertEqual(calls,1)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
        service.dispose();XCTAssertEqual(calls,1)
    }
    func testServiceDeallocationInvalidatesRunLoopTransportAndRetiresCapturedReceipt() {
        var service:NativeSourceAnimationClockService?=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
        weak var weakService=service
        let participant=Participant();var calls=0
        let lease=service!.register(participant:participant,duration:1,domain:.nativeRaw){success in
            XCTAssertFalse(success);calls += 1
        }
        XCTAssertTrue(service!.hasActiveClock)
        service=nil
        XCTAssertNil(weakService);XCTAssertEqual(calls,1);XCTAssertFalse(lease?.active ?? true)
        lease?.cancel();XCTAssertEqual(calls,1)
    }
    func testActualSourceMappedUIKitCarrierFinishesFromCanonicalUnionWithoutSceneTick()async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:240,height:400)),root=UIViewController()
        window.rootViewController=root;window.makeKeyAndVisible()
        let carrier=Carrier(viewport:window.bounds.size,duration:0.08)
        carrier.configureAnimationDelivery(service,domain:.sourceGSAP(.timeline));root.view.addSubview(carrier)
        let finished=expectation(description:"real source mapped display-link completion");var calls=0
        carrier.onFinished={success in XCTAssertTrue(success);calls += 1;finished.fulfill()};carrier.start()
        XCTAssertEqual(carrier.values,[0]);XCTAssertEqual(service.displayLinkCreationCount,1)
        await fulfillment(of:[finished],timeout:2)
        XCTAssertEqual(calls,1);XCTAssertEqual(carrier.values.last!,0.08,accuracy:1e-12)
        XCTAssertGreaterThan(carrier.values.count,1);XCTAssertNil(carrier.superview)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
        carrier.dispose();service.dispose();window.isHidden=true;XCTAssertEqual(calls,1)
    }
    func testCarrierNilCompletionSuppressesCapturedCallbackAndReplacementRemainsAuthoritative() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0)
        let suppressed=Carrier(viewport:CGSize(width:100,height:100),duration:1);suppressed.configureAnimationDelivery(service)
        var oldCalls=0,newCalls=0
        suppressed.onFinished={_ in oldCalls += 1};suppressed.start();suppressed.onFinished=nil;suppressed.dispose()
        XCTAssertEqual(oldCalls,0);XCTAssertEqual(service.activeParticipantCount,0)
        var replacement:Carrier?=Carrier(viewport:CGSize(width:100,height:100),duration:1)
        replacement!.configureAnimationDelivery(service);replacement!.onFinished={_ in oldCalls += 1};replacement!.start()
        replacement!.onFinished={success in XCTAssertFalse(success);newCalls += 1}
        replacement=nil
        XCTAssertEqual(oldCalls,0);XCTAssertEqual(newCalls,1);XCTAssertEqual(service.activeParticipantCount,0)
        service.dispose();XCTAssertEqual(newCalls,1)
    }
    func testBackgroundNoRAFPauseStopsUnionAndResumeNoTickUsesOriginalThirtyThreeMillisecondHitch() {
        // gsap-delivery-oracle.json pauseForegroundNoTick: source100→pause,
        // no ticker callback at1100, resume→first1116 delivery advances33ms.
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),source=Participant()
        _=service.register(participant:source,duration:2,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in}
        service.deliver(wallMilliseconds:100);XCTAssertEqual(source.values,[0.1])
        service.setSourceGlobalPaused(true);service.setSourceForeground(false);XCTAssertFalse(service.hasActiveClock)
        service.setSourceForeground(true);service.setSourceGlobalPaused(false);XCTAssertTrue(service.hasActiveClock)
        service.deliver(wallMilliseconds:1116)
        XCTAssertEqual(source.values,[0.1,0.133]);XCTAssertEqual(service.displayLinkCreationCount,2)
        service.dispose()
    }
    func testActualBackgroundNoRAFPauseStopsLinkAndFirstPostHitchDisplayCallbackAdvancesThirtyThreeMilliseconds()async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000),source=Participant()
        let paused=expectation(description:"first real source delivery then global pause"),resumed=expectation(description:"first real delivery after no-ticker hitch")
        var first:Double?,lease:NativeSourceAnimationClockService.Lease?
        source.onAdvance={seconds in
            if first==nil {first=seconds;service.setSourceGlobalPaused(true);service.setSourceForeground(false);paused.fulfill()}
            else {XCTAssertEqual(seconds-first!,0.033,accuracy:1e-7);lease?.cancel();resumed.fulfill()}
        }
        lease=service.register(participant:source,duration:2,domain:.sourceGSAP(.timeline)){_ in}
        await fulfillment(of:[paused],timeout:2)
        XCTAssertFalse(service.hasActiveClock);XCTAssertEqual(service.activeParticipantCount,1)
        // This test deliberately creates the original >500ms NO-TICK hitch.
        // One test callback resumes; it is not a production recurring clock.
        DispatchQueue.main.asyncAfter(deadline:.now()+0.55){service.setSourceForeground(true);service.setSourceGlobalPaused(false)}
        await fulfillment(of:[resumed],timeout:2)
        XCTAssertFalse(service.hasActiveClock);XCTAssertEqual(service.activeParticipantCount,0)
        service.dispose()
    }
    func testSourceIntegerMillisecondQuantizationDoesNotChangeRawFrameTimestampPrecision() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0.999),source=Participant(),raw=Participant()
        _=service.register(participant:source,duration:2,domain:.sourceGSAP(.timeline),wallMilliseconds:0.999){_ in}
        _=service.register(participant:raw,duration:2,domain:.nativeRaw){_ in}
        service.deliver(wallMilliseconds:100.875,rawFrameMilliseconds:100.875)
        service.deliver(wallMilliseconds:100.999,rawFrameMilliseconds:100.999)
        service.deliver(wallMilliseconds:116.95,rawFrameMilliseconds:116.95)
        XCTAssertEqual(source.values,[0.1,0.116]);XCTAssertEqual(raw.values[1],0.000124,accuracy:1e-12)
        XCTAssertEqual(raw.values[2],0.016075,accuracy:1e-12);service.dispose()
    }
    func testForegroundGlobalPauseKeepsSourceTickerAfterFiniteRawModalRetires() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),source=Participant(),modal=Participant();var modalEnds=0
        _=service.register(participant:source,duration:5,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in}
        _=service.register(participant:modal,duration:0.2,domain:.nativeRaw){success in XCTAssertTrue(success);modalEnds += 1}
        service.deliver(wallMilliseconds:100);service.setSourceGlobalPaused(true)
        for wall in stride(from:116.0,through:1092,by:16){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(modalEnds,1);XCTAssertEqual(source.values,[0.1]);XCTAssertTrue(service.hasActiveClock)
        XCTAssertEqual(service.activeParticipantCount,1);XCTAssertEqual(service.sourceTickerSeconds,1.092,accuracy:1e-12)
        service.setSourceGlobalPaused(false);service.deliver(wallMilliseconds:1116)
        // Literal v9 original RAF last1092→resume1100→first1116 is24ms.
        XCTAssertEqual(source.values,[0.1,0.124]);XCTAssertEqual(service.displayLinkCreationCount,1);service.dispose()
    }
    func testTerminalResumeReceiptLeavesSourceGlobalPausedAndTransportDistinct() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),source=Participant()
        _=service.register(participant:source,duration:5,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in}
        service.deliver(wallMilliseconds:100);service.setSourceGlobalPaused(true)
        service.deliver(wallMilliseconds:1100)
        XCTAssertFalse(service.setSourceGlobalPaused(false,terminalSuspended:true));service.deliver(wallMilliseconds:1116)
        XCTAssertEqual(source.values,[0.1]);XCTAssertEqual(service.sourceTickerSeconds,0.149,accuracy:1e-12)
        XCTAssertTrue(service.hasActiveClock);service.setSourceForeground(false);XCTAssertFalse(service.hasActiveClock);service.dispose()
    }
    func testIndividualSourceChildPauseDoesNotInventForegroundTickerDemand() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),source=Participant()
        let lease=service.register(participant:source,duration:1,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in}
        service.setSourceGlobalPaused(true);XCTAssertTrue(service.hasActiveClock)
        lease?.setSuspended(true);XCTAssertFalse(service.hasActiveClock)
        lease?.setSuspended(false);XCTAssertTrue(service.hasActiveClock)
        service.dispose();XCTAssertFalse(service.hasActiveClock)
    }
    func testLiteralV9PauseResumeSixScheduledRAFLifecycleTraces()throws {
        struct Receipt:Decodable{let op:String,wall:Double,ticker:Double,root:Double,x:Double,pixiActive:Bool,starts:Int,stops:Int}
        struct Row:Decodable{let mode:String,events:[Receipt]}
        struct Oracle:Decodable{let rows:[Row]}
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"literal-game-pause-oracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url));XCTAssertEqual(oracle.rows.count,6)
        for row in oracle.rows {
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),source=Participant(),modal=Participant()
            _=service.register(participant:source,duration:5,domain:.sourceGSAP(.defaultLazyTween),wallMilliseconds:0){_ in}
            var starts=0,stops=0,pixiActive=true,modalEnds=0
            if row.mode=="foregroundModalRawEnds"{_=service.register(participant:modal,duration:0.2,domain:.nativeRaw){_ in modalEnds += 1}}
            for event in row.events {
                switch event.op {
                case "sourceRAF":service.deliver(wallMilliseconds:event.wall)
                case "literalPause":
                    service.setSourceGlobalPaused(true);pixiActive=false;stops += 1
                    if row.mode.hasPrefix("background"){service.setSourceForeground(false);XCTAssertFalse(service.hasActiveClock)}
                case "literalResume":service.setSourceGlobalPaused(false);pixiActive=true;starts += 1
                case "literalResumeWithoutRAF":service.setSourceForeground(true);service.setSourceGlobalPaused(false);pixiActive=true;starts += 1
                case "literalTerminalResumeBlocked":XCTAssertFalse(service.setSourceGlobalPaused(false,terminalSuspended:true))
                case "nativeRawModalEndedIndependent":XCTAssertEqual(modalEnds,1);XCTAssertTrue(service.hasActiveClock)
                default:XCTFail("unknown original receipt")
                }
                XCTAssertEqual(service.sourceTickerSeconds,event.ticker,accuracy:1e-12,row.mode+" "+event.op)
                XCTAssertEqual(service.sourceAnimationSeconds,event.root,accuracy:1e-12,row.mode+" "+event.op)
                let x=((source.values.last ?? 0)/5*1e6).rounded()/1e6
                XCTAssertEqual(x,event.x,accuracy:1e-12,row.mode+" "+event.op)
                XCTAssertEqual(starts,event.starts);XCTAssertEqual(stops,event.stops);XCTAssertEqual(pixiActive,event.pixiActive)
            }
            service.dispose()
        }
    }
    func testComputedSourceDurationNormalizesAtAdmissionAndCompletesAtExactEightyThreeHundredths() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),source=Participant(),raw=Participant()
        let computed=[0.01,0.1,0.38,0.34].reduce(0,+)
        XCTAssertGreaterThan(computed,0.83);var sourceCompletions=0,rawCompletions=0
        _=service.register(participant:source,duration:computed,domain:.sourceGSAP(.timeline),wallMilliseconds:0){success in XCTAssertTrue(success);sourceCompletions += 1}
        _=service.register(participant:raw,duration:computed,domain:.nativeRaw){success in XCTAssertTrue(success);rawCompletions += 1}
        service.deliver(wallMilliseconds:0);service.deliver(wallMilliseconds:400);service.deliver(wallMilliseconds:830)
        XCTAssertEqual(sourceCompletions,1);XCTAssertEqual(source.values.last!,0.83,accuracy:1e-12)
        // Existing raw accumulator uses .4+.43, whose exact IEEE result equals
        // computed. It legitimately completes on this frame; only Source
        // clamps to canonical .83. Preserve both domain arithmetic receipts.
        XCTAssertEqual(rawCompletions,1);XCTAssertEqual(raw.values.last!,computed)
        XCTAssertGreaterThan(raw.values.last!,0.83)
        XCTAssertNotEqual(raw.values.last!.bitPattern,source.values.last!.bitPattern)
        service.deliver(wallMilliseconds:840);XCTAssertEqual(sourceCompletions,1);XCTAssertEqual(rawCompletions,1)
        service.dispose()
    }
    func testSourceComputedDelayBirthUsesOriginalRoundPreciseBoundary() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),owner=Participant();var completions=0
        let delay=0.01+0.1+0.38+0.34
        _=service.register(participant:owner,duration:0,domain:.sourceGSAP(.eagerTween),delay:delay,wallMilliseconds:0){success in XCTAssertTrue(success);completions += 1}
        service.deliver(wallMilliseconds:400);service.deliver(wallMilliseconds:830)
        XCTAssertEqual(completions,1);XCTAssertEqual(owner.values,[0]);service.deliver(wallMilliseconds:840)
        XCTAssertEqual(completions,1);service.dispose()
    }
    func testActualDefaultSourceClockReadsEpochDateWallWhileRawRemainsFrameTimestampDomain()async {
        var samples:[Double]=[]
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000,sourceWallMillisecondsNow:{
            let wall=Date().timeIntervalSince1970*1000;samples.append(wall);return wall
        }),source=Participant(),raw=Participant()
        let completed=expectation(description:"actual epoch source plus raw frame participants");completed.expectedFulfillmentCount=2
        _=service.register(participant:source,duration:0.07,domain:.sourceGSAP(.timeline)){success in XCTAssertTrue(success);completed.fulfill()}
        _=service.register(participant:raw,duration:0.09,domain:.nativeRaw){success in XCTAssertTrue(success);completed.fulfill()}
        await fulfillment(of:[completed],timeout:2)
        XCTAssertGreaterThan(samples.count,2);XCTAssertTrue(samples.allSatisfy{$0>1e12})
        XCTAssertEqual(raw.values.first,0);XCTAssertEqual(source.values.last!,0.07,accuracy:1e-12)
        XCTAssertEqual(service.displayLinkCreationCount,1);XCTAssertFalse(service.hasActiveClock);service.dispose()
    }
    func testDefaultSourceWakeUsesInjectedEpochWallAndSourceClockAdjustmentKeepsRawFrameDomainIndependent() {
        var wall=1_700_000_000_100.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:1_700_000_000_000,sourceWallMillisecondsNow:{wall}),source=Participant(),raw=Participant()
        _=service.register(participant:source,duration:1,domain:.sourceGSAP(.timeline)){_ in}
        _=service.register(participant:raw,duration:1,domain:.nativeRaw){_ in}
        service.deliver(wallMilliseconds:wall,rawFrameMilliseconds:100)
        wall -= 10;service.deliver(wallMilliseconds:wall,rawFrameMilliseconds:116)
        XCTAssertEqual(source.values.last!,0.033,accuracy:1e-12) // Original negative Date.now delta adjustedLag33.
        XCTAssertEqual(raw.values,[0,0.016]);service.dispose()
    }
    func testUnmappedInfinitePhaseCarrierCannotSilentlyEnterSourceGSAPDomain() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),owner=Participant()
        XCTAssertNil(service.register(participant:owner,duration:.infinity,domain:.sourceGSAP(.timeline),wallMilliseconds:0){_ in})
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
        let retainedExisting=service.register(participant:owner,duration:.infinity,domain:.nativeRaw){_ in}
        XCTAssertNotNil(retainedExisting);retainedExisting?.cancel();XCTAssertFalse(service.hasActiveClock);service.dispose()
    }
}
