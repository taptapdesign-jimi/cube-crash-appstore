import XCTest
import UIKit
import SpriteKit
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
    func testActualDefaultSourceWallClockKeepsDateNowMillisecondResolution() async {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:floor(Date().timeIntervalSince1970*1000))
        let participant=Participant(),advanced=expectation(description:"actual Source wall callback")
        var fulfilled=false
        participant.onAdvance={seconds in
            // Date.now-backed elapsed time is in whole milliseconds. The native
            // raw frame timestamp remains its separate high-resolution domain.
            let milliseconds=seconds*1000
            XCTAssertEqual(milliseconds,milliseconds.rounded(),accuracy:1e-6)
            if seconds>0,!fulfilled {fulfilled=true;advanced.fulfill()}
        }
        let lease=service.register(participant:participant,duration:0.2,domain:.sourceGSAP(.timeline)){_ in}
        XCTAssertNotNil(lease)
        await fulfillment(of:[advanced],timeout:2)
        lease?.cancel();participant.onAdvance=nil;service.dispose()
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

    func testFizzProducerSharedRootMatchesExecutedOriginalBottleHoneyDrawBoundaries() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        defer{service.dispose()}
        var seed:UInt32=1,draws=0,arrivals:[String]=[]
        func random()->Double {seed=seed &* 1664525 &+ 1013904223;draws+=1;return Double(seed)/4294967296}
        let bottle=NativeSourceFizzProducerClock(service:service,family:.bottle,random:random,current:{true},paintable:{true}){_ in arrivals.append("bottle:\(service.sourceAnimationSeconds):\(draws-11)")}
        let honey=NativeSourceFizzProducerClock(service:service,family:.honey,random:random,current:{true},paintable:{true}){_ in arrivals.append("honey:\(service.sourceAnimationSeconds):\(draws-12)")}
        defer{bottle.dispose();honey.dispose()}
        XCTAssertTrue(bottle.start());XCTAssertTrue(honey.start())
        for time in [300.0,500,800,1100,1400,1700,2000]{service.deliver(wallMilliseconds:time)}
        XCTAssertEqual(arrivals,["bottle:0.0:0","honey:0.0:12","bottle:0.5:25","honey:0.5:37","bottle:1.1:50","honey:1.4:62","bottle:1.7:75"])
        XCTAssertEqual(draws,87);XCTAssertEqual(bottle.activeRootCount,1);XCTAssertEqual(honey.activeRootCount,1)
    }
    func testFizzProducerRegistersBubbleCompositionBeforeDrawingDelayAndRejectsRetiredCallback() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        defer{service.dispose()}
        var draws=0,current=true,emitted=0,composition:[String]=[]
        let clock=NativeSourceFizzProducerClock(service:service,family:.bottle,random:{draws+=1;composition.append("draw");return 0.5},current:{current},paintable:{true}){plan in
            emitted+=1;composition.append("bubble roots");XCTAssertEqual(plan.nextDelay,0)
        }
        XCTAssertTrue(clock.start());XCTAssertEqual(draws,12)
        XCTAssertEqual(Array(composition.suffix(2)),["bubble roots","draw"])
        current=false;service.deliver(wallMilliseconds:500)
        XCTAssertEqual(draws,12);XCTAssertEqual(emitted,1);XCTAssertEqual(clock.activeRootCount,0)
    }
    func testFizzProducerUnpaintablePrefixDrawsOnlyDelayAndVisibilityRetainsCapturedPlayhead() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        defer{service.dispose()}
        var draws=0,paintable=false,emitted=0
        let clock=NativeSourceFizzProducerClock(service:service,family:.bottle,random:{draws+=1;return 0.5},current:{true},paintable:{paintable}){_ in emitted+=1}
        defer{clock.dispose()}
        XCTAssertTrue(clock.start());XCTAssertEqual(draws,1);XCTAssertEqual(emitted,0)
        service.deliver(wallMilliseconds:200);clock.setVisible(false)
        service.deliver(wallMilliseconds:500);XCTAssertEqual(draws,1)
        paintable=true;clock.setVisible(true)
        service.deliver(wallMilliseconds:700);XCTAssertEqual(draws,1)
        service.deliver(wallMilliseconds:750);XCTAssertEqual(draws,13);XCTAssertEqual(emitted,1)
    }

    func testTypedBottleRepeatKeepsOriginalPhaseAcrossLateArrivalsAndCapturedSuspension() throws {
        let fifo=NativeSourceMicrotaskFIFO();let tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        defer{service.dispose();fifo.dispose()}
        let owner=Participant();var cleanups=0
        let lease=try XCTUnwrap(service.registerBottleIdleRepeat(participant:owner){_ in cleanups+=1})
        for ms in stride(from:400.0,through:7200,by:400){service.deliver(wallMilliseconds:ms)}
        service.deliver(wallMilliseconds:7400)
        XCTAssertEqual(owner.values.last,7.4);XCTAssertTrue(lease.active)
        let pose=NativeBottleIdleMotion.sample(seconds:try XCTUnwrap(owner.values.last))
        XCTAssertEqual(pose.y+125,124.985402,accuracy:3e-5)
        XCTAssertEqual(pose.rotation+0.17,0.169592,accuracy:3e-5)
        lease.setSuspended(true);service.deliver(wallMilliseconds:7800)
        XCTAssertEqual(owner.values.last,7.4)
        lease.setSuspended(false);service.deliver(wallMilliseconds:8200)
        XCTAssertEqual(owner.values.last,7.8,"Resume retains captured repeat playhead, no new root origin")
        lease.cancel();lease.cancel();XCTAssertEqual(cleanups,1);XCTAssertFalse(lease.active)
    }

    func testBottleSpriteHostMatchesExecutedOriginalPivotAndAllRepeatedPosesThenRestoresBase() throws {
        struct Sample:Decodable {let seconds,x,y,rotation,anchorX,anchorY:Double}
        let gold=try JSONDecoder().decode([Sample].self,from:Data(#"[{"seconds":0,"x":55,"y":125,"rotation":0.17,"anchorX":0.5,"anchorY":1},{"seconds":0.45,"x":55,"y":124.56066,"rotation":0.157731,"anchorX":0.5,"anchorY":1},{"seconds":1.8,"x":55,"y":122,"rotation":0.086224,"anchorX":0.5,"anchorY":1},{"seconds":3.6,"x":55,"y":124.5,"rotation":0.17,"anchorX":0.5,"anchorY":1},{"seconds":5.4,"x":55,"y":127,"rotation":0.253776,"anchorX":0.5,"anchorY":1},{"seconds":7.2,"x":55,"y":125,"rotation":0.17,"anchorX":0.5,"anchorY":1},{"seconds":7.26,"x":55,"y":125,"rotation":0.17,"anchorX":0.5,"anchorY":1},{"seconds":7.32,"x":55,"y":125,"rotation":0.17,"anchorX":0.5,"anchorY":1},{"seconds":7.4,"x":55,"y":124.985402,"rotation":0.169592,"anchorX":0.5,"anchorY":1},{"seconds":8,"x":55,"y":124.06191,"rotation":0.143804,"anchorX":0.5,"anchorY":1},{"seconds":14.64,"x":55,"y":125,"rotation":0.17,"anchorX":0.5,"anchorY":1},{"seconds":14.9,"x":55,"y":124.848191,"rotation":0.165761,"anchorX":0.5,"anchorY":1}]"#.utf8))
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        defer{service.dispose();fifo.dispose()}
        let host=SKSpriteNode();host.size = .init(width:200,height:140/0.9);host.xScale=0.8;host.yScale=0.9
        host.position = .init(x:23,y:-41);host.zRotation = -0.17;host.anchorPoint = .init(x:0.3,y:0.6)
        let savedPosition=host.position,savedAnchor=host.anchorPoint,savedRotation=host.zRotation,savedScale=CGPoint(x:host.xScale,y:host.yScale)
        let owner=try XCTUnwrap(NativeSourceBottleIdlePresentation(host:host,service:service,current:{true}));defer{owner.dispose()}
        XCTAssertTrue(owner.start());var wall=0.0
        for sample in gold {
            let target=sample.seconds*1000
            while target-wall>400 {wall+=400;service.deliver(wallMilliseconds:wall)}
            if target>wall {wall=target;service.deliver(wallMilliseconds:wall)}
            XCTAssertEqual(host.position.x,sample.x,accuracy:3e-5);XCTAssertEqual(-host.position.y,sample.y,accuracy:3e-5)
            XCTAssertEqual(-host.zRotation,sample.rotation,accuracy:3e-5)
            XCTAssertEqual(host.anchorPoint.x,sample.anchorX,accuracy:1e-6);XCTAssertEqual(1-host.anchorPoint.y,sample.anchorY,accuracy:1e-6)
        }
        owner.dispose();owner.dispose();XCTAssertEqual(host.position,savedPosition);XCTAssertEqual(host.anchorPoint,savedAnchor)
        XCTAssertEqual(host.zRotation,savedRotation);XCTAssertEqual(host.xScale,savedScale.x);XCTAssertEqual(host.yScale,savedScale.y)
    }

    func testStaleBottleHostOwnerCannotRestoreOrPaintForeignPose()throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo);defer{service.dispose();fifo.dispose()}
        let host=SKSpriteNode();host.size = .init(width:160,height:140)
        var owns=true
        let owner=try XCTUnwrap(NativeSourceBottleIdlePresentation(host:host,service:service,current:{owns}))
        XCTAssertTrue(owner.start())
        host.position = .init(x:99,y:201);host.anchorPoint = .init(x:0.2,y:0.3);host.zRotation=0.42
        let foreignPosition=host.position,foreignAnchor=host.anchorPoint,foreignRotation=host.zRotation
        owns=false;service.deliver(wallMilliseconds:400);owner.dispose()
        XCTAssertEqual(host.position,foreignPosition);XCTAssertEqual(host.anchorPoint,foreignAnchor);XCTAssertEqual(host.zRotation,foreignRotation)
        XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testHoneySourceClockMatchesExecutedOriginal33PosesAndThreeReentryMathDraws()throws {
        // Executed untouched Honey controller/real GSAP oracle; direct elapsed
        // delivery compares motion, not APP Scene/texture/cohort admission.
        let gold=try JSONDecoder().decode([[[Double]]].self,from:Data(#"[[[23.25295985441028,46.795174751068124,0,1.3424008524056793e-14,1.3424008524056793e-14,3,1],[0.7049504487465048,-64.08648122426362,0,1.1043668197867162e-14,1.1043668197867162e-14,3,1],[-50.89278088273551,27.655929570394164,0,1.192527367139386e-14,1.192527367139386e-14,4,1]],[[23.25295985441028,46.795174751068124,0,1.3738454171196179e-14,1.3738454171196179e-14,3,1],[0.7049504487465048,-64.08648122426362,0,1.1043668197867162e-14,1.1043668197867162e-14,3,1],[-50.89278088273551,27.655929570394164,0,1.220461276673157e-14,1.220461276673157e-14,4,1]],[[22.000156360215033,47.243015054846836,0.025650021830136926,7.3924495455530925,7.3924495455530925,3,1],[-0.9737188655539738,-64.69231458143894,0,1.1140765824567911e-14,1.1140765824567911e-14,3,1],[-51.90240233059922,26.77846982933557,0,1.2403613768135217e-14,1.2403613768135217e-14,4,1]],[[19.64184466758933,48.57757454725342,0.13428263739002583,34.35178166230338,34.35178166230338,3,1],[-4.888454273750237,-65.77431270006176,0,1.1184850420299483e-14,1.1184850420299483e-14,3,1],[-54.63794686351944,24.162061466804253,0,1.2331504256124375e-14,1.2331504256124375e-14,4,1]],[[16.89674826783832,50.315877420272365,0.2940364838016271,61.14647253556706,61.14647253556706,3,1],[-11.888812743231775,-65.1482721326889,0.06966896265448154,14.515622654088334,14.515622654088334,3,1],[-58.52139313682289,20.18290826103534,0,1.1985315718819366e-14,1.1985315718819366e-14,4,1]],[[3.953058583397447,51.82334768360527,0.773298023036431,67.60239708833079,67.60239708833079,3,1],[-29.329620930081568,-53.67399420383594,0.5200329998891465,50.98166772639026,50.98166772639026,7,1],[-64.46706078538834,10.07539068713958,0.37413551121683664,55.96526082497007,55.96526082497007,5,1]],[[-19.96827389936103,48.30705293284584,1,68.38312713895833,68.38312713895833,4,1],[-54.903879837435284,-14.179332614732045,1,48.20911116141228,48.20911116141228,7,0],[-63.758064638505836,-4.682869859617527,1,53.92616551444981,53.92616551444981,5,0]],[[-47.06905692845073,35.54016264374606,1,69.60546500049747,69.60546500049747,5,1],[-54.62686207831579,36.539220215230905,1,50.993745871283245,50.993745871283245,6,1],[-52.96838732789479,-18.976536962861015,1,54.94928529160512,54.94928529160512,2,0]],[[-53.98945904206364,-2.19698188047036,1,68.21618532965928,68.21618532965928,2,0],[7.9166313252102265,55.943799829219884,1,52.27172837772932,52.27172837772932,1,1],[-29.796604867901546,-33.21432030479786,1,53.41273347283182,53.41273347283182,2,0]],[[-73.98945904206364,7.80301811952964,1,68.21618532965928,68.21618532965928,2,0],[-12.083368674789774,65.94379982921988,1,52.27172837772932,52.27172837772932,1,1],[-49.79660486790155,-23.21432030479786,1,53.41273347283182,53.41273347283182,2,0]],[[-46.324757626811476,-6.6198999017356135,1,62.89891067367321,62.89891067367321,2,0],[2.323772597484263,28.09784561890304,1,59.50832536415856,59.50832536415856,2,1],[-30.150492786283174,-9.654421919265856,1,55.46673376716886,55.46673376716886,1,0]],[[-38.98745348521628,-24.67367325869443,1,66.69655281807495,66.69655281807495,1,0],[31.859463782478908,3.974396830283552,1,65.82583326144722,65.82583326144722,2,1],[-20.89156835257919,-21.10158587586456,1,55.8732389391635,55.8732389391635,1,0]],[[-39.2723185012264,-31.7366531073896,1,63.368978224086284,63.368978224086284,6,0],[37.531655604755336,-23.33982653063697,1,61.54367558271182,61.54367558271182,4,1],[-0.37953624650008055,-41.488600095981695,1,54.10685519473593,54.10685519473593,6,0]],[[-32.83298016089677,-33.72542654395893,1,65.31411283322878,65.31411283322878,6,0],[31.916542491587066,-40.89080521474382,1,58.10224005356645,58.10224005356645,3,0],[17.831285364460634,-45.95463810624741,1,56.82289229770017,56.82289229770017,6,0]],[[-24.936313689756542,-34.09968089512466,1,64.89749724771328,64.89749724771328,6,0],[23.016113325616935,-54.34495519525025,1,52.29476159527721,52.29476159527721,7,0],[31.484118685039927,-38.739009667497655,1,53.1821106847529,53.1821106847529,7,0]],[[-15.197225236191807,-36.25528012487501,1,63.886025245726465,63.886025245726465,6,0],[22.499243342518998,-65.83469825561653,1,54.613006518532735,54.613006518532735,7,0],[38.94773356840762,-33.88793835914635,1,57.19226054011589,57.19226054011589,7,0]],[[-11.88652888997364,-32.403017071268316,1,66.4182656232443,66.4182656232443,6,0],[16.3636282700144,-70.76612942810758,1,52.67889953964495,52.67889953964495,7,0],[41.98233390884402,-28.155836314311912,1,53.02548365041846,53.02548365041846,7,0]],[[-16.0026549159499,-24.170329960898606,1,69.47335453974344,69.47335453974344,6,1],[7.282900182200565,-66.12956086006868,1,53.218442245835874,53.218442245835874,7,0],[41.83463883307417,-21.572140299985467,1,56.77186872616616,56.77186872616616,7,0]],[[-19.66164699919951,-24.418023187785053,1,79.40911190767628,79.40911190767628,6,1],[-1.7330149224857339,-60.537707460780986,1,53.815513013294904,53.815513013294904,7,0],[40.853609387668506,-16.505208514782204,1,53.65242285414959,53.65242285414959,7,0]],[[-20.367847897360548,-20.56202952945394,1,74.76933933116366,74.76933933116366,6,1],[-2.3050514627585463,-58.54897183018229,1,51.94427840708907,51.94427840708907,7,0],[42.06581280457379,-14.488336335743146,1,55.68926430311094,55.68926430311094,7,0]],[[-19.05265898688743,-18.15565991281662,1,80.75327647524192,80.75327647524192,6,1],[5.0484844685121555,-57.56754007818189,1,62.4020961855187,62.4020961855187,7,1],[44.2799464104179,-17.238400662879066,1,54.795354552683925,54.795354552683925,7,0]],[[-27.571237000486995,-16.001062875484845,1,75.83746764835824,75.83746764835824,6,1],[4.765723648045931,-61.05660832305171,1,60.677067708102726,60.677067708102726,7,1],[45.78515114829087,-23.423689881971345,1,54.33248520927057,54.33248520927057,7,0]],[[-27.571237000486995,-16.001062875484845,1,75.83746764835824,75.83746764835824,6,1],[4.765723648045931,-61.05660832305171,1,60.677067708102726,60.677067708102726,7,1],[45.78515114829087,-23.423689881971345,1,54.33248520927057,54.33248520927057,7,0]],[[-27.571237000486995,-16.001062875484845,1,75.83746764835824,75.83746764835824,6,1],[4.765723648045931,-61.05660832305171,1,60.677067708102726,60.677067708102726,7,1],[45.78515114829087,-23.423689881971345,1,54.33248520927057,54.33248520927057,7,0]],[[-27.973017944170078,-17.147734394510476,1,74.23741265834825,74.23741265834825,6,1],[11.43678556785437,-66.77114058788322,1,59.303529578849975,59.303529578849975,7,0],[47.58286888291061,-23.911951570666265,1,55.4578476126305,55.4578476126305,7,0]],[[-27.973017944170078,-17.147734394510476,1,74.23741265834825,74.23741265834825,6,1],[11.43678556785437,-66.77114058788322,1,59.303529578849975,59.303529578849975,7,0],[47.58286888291061,-23.911951570666265,1,55.4578476126305,55.4578476126305,7,0]],[[-27.973017944170078,-17.147734394510476,1,74.23741265834825,74.23741265834825,6,1],[11.43678556785437,-66.77114058788322,1,59.303529578849975,59.303529578849975,7,0],[47.58286888291061,-23.911951570666265,1,55.4578476126305,55.4578476126305,7,0]],[[-30.784592118146183,-31.266952948751122,1,72.42786771244478,72.42786771244478,6,0],[6.925754129490875,-67.541131249356,1,59.47002239630133,59.47002239630133,7,0],[45.21753080918412,-28.058059314627247,1,56.07600503811636,56.07600503811636,7,1]],[[-28.40378403438756,-33.60304953125936,1,67.26954903023466,67.26954903023466,6,0],[5.0476109659483885,-59.26936745105295,1,52.781143260832174,52.781143260832174,7,0],[39.06011637588617,-16.962966386798,1,54.6008462581026,54.6008462581026,7,1]],[[-23.16630932297115,-32.982483338849384,1,63.298411539154365,63.298411539154365,6,0],[-2.723024700039697,-53.06694081891274,1,52.53731002162697,52.53731002162697,7,0],[36.96928800102223,-7.425025053909715,1,59.87559826705563,59.87559826705563,3,1]],[[-15.6928028675523,-32.44381810625731,1,63.091843658512246,63.091843658512246,6,0],[-0.27897742421590754,-51.81674908253941,1,49.460640055879935,49.460640055879935,7,0],[29.16850020651768,-1.5422405857973505,1,56.45501727661114,56.45501727661114,3,1]],[[-13.192088111275913,-24.385430919260184,1,58.24869181286955,58.24869181286955,6,0],[0.052974510821749546,-49.08347419854226,1,51.647319220573216,51.647319220573216,7,1],[24.115986934467095,1.662361108935915,1,60.839121883246506,60.839121883246506,3,1]],[[-7.528502994173859,-19.807778137517538,1,62.17382484040367,62.17382484040367,6,0],[0.2577476252715074,-42.13317293400941,1,54.33338454483781,54.33338454483781,7,1],[21.488505052906525,-3.795525264267516,1,57.39108986156631,57.39108986156631,3,1]]]"#.utf8))
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        defer{service.dispose();fifo.dispose()}
        var seed:UInt32=1,draws=0,paints=0
        let owner=try XCTUnwrap(NativeSourceHoneyIdleClock(service:service,random:{
            draws+=1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296
        },current:{true},paintable:{true},paint:{_ in paints+=1}))
        defer{owner.dispose()}
        XCTAssertEqual(draws,78);XCTAssertTrue(owner.start());XCTAssertEqual(paints,1)
        var sample=0
        func check(){
            let poses=owner.poses
            for index in poses.indices {
                let expected=gold[sample][index],pose=poses[index]
                XCTAssertEqual(pose.x,expected[0],accuracy:1e-5);XCTAssertEqual(pose.y,expected[1],accuracy:1e-5)
                XCTAssertEqual(pose.alpha,expected[2],accuracy:1e-6)
                let size=128*0.435456*owner.sizeScales[index]*pose.scale
                XCTAssertEqual(abs(size),expected[3],accuracy:1e-5);XCTAssertEqual(abs(size),expected[4],accuracy:1e-5)
                XCTAssertEqual(pose.asset,Int(expected[5]));XCTAssertEqual(pose.front,expected[6]==1)
            }
            sample+=1
        }
        check();owner.assetCohortDidCommit();check()
        for time in [0.016,0.05,0.1,0.25,0.5,0.8,1.2]{owner.advanceSourceAnimation(seconds:time);check()}
        owner.setDragging(true);owner.updateDragMotion(offset:.init(x:20,y:-10),velocity:.init(x:0.2,y:0.04));check()
        for index in 1...120 {owner.advanceSourceAnimation(seconds:1.2+Double(index)/60);if index%10==0 {check()}}
        owner.setDragging(false)
        for index in 1...60 {owner.advanceSourceAnimation(seconds:3.2+Double(index)/60);if index<=5 || index%10==0 {check()}}
        XCTAssertEqual(sample,33);XCTAssertEqual(draws,81);XCTAssertEqual(service.activeParticipantCount,1)
        owner.dispose();XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testHoneyActualCachedResourceCohortRunsAfterRootAndExistingFIFOObserverWithoutPreload()throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        var uploads=0
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,_ in uploads+=1})
        defer{textures.dispose()}
        for index in 1...7 {XCTAssertNotNil(textures.texture("assets/shop/honey/bee\(index)@2x.png",densityAware:false))}
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks;defer{service.dispose();fifo.dispose()}
        let owner=try XCTUnwrap(NativeSourceHoneyIdlePresentation(textures:textures,use2x:true,service:service,random:{0.5},current:{true},paintable:{true}))
        defer{owner.dispose()}
        XCTAssertFalse(owner.start(textures:textures,assetTasks:tasks));XCTAssertEqual(service.activeParticipantCount,0)
        let observer=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        defer{observer.dispose()}
        var observed=false
        XCTAssertTrue(tasks.inputTask{
            XCTAssertTrue(owner.start(textures:textures,assetTasks:tasks))
            XCTAssertFalse(owner.cohortCommitted);XCTAssertEqual(service.activeParticipantCount,1)
            XCTAssertEqual(fifo.pendingCount,7)
            XCTAssertTrue(observer.enqueue{observed=true;XCTAssertFalse(owner.cohortCommitted)})
        })
        XCTAssertTrue(observed);XCTAssertTrue(owner.cohortCommitted);XCTAssertEqual(uploads,0)
        XCTAssertEqual(owner.sprites.count,3);XCTAssertFalse(owner.start())
        XCTAssertEqual(service.activeParticipantCount,1)
        for frame in 1...120 {
            service.deliver(wallMilliseconds:Double(frame)*1000/60)
            for index in owner.sprites.indices {
                let sprite=owner.sprites[index],expected=CGFloat(128*0.435456*owner.sizeScales[index])*abs(sprite.xScale)
                XCTAssertEqual(sprite.size.width,expected,accuracy:1e-5)
                XCTAssertEqual(sprite.size.height,expected,accuracy:1e-5)
                XCTAssertLessThan(sprite.size.width,100)
            }
        }
    }
    func testHoneyActualMissingResourceCohortKeepsRunningRootAndSameThreeSprites()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let uploaded=expectation(description:"actual missing Honey decoded upload")
        var finish:(@Sendable()->Void)?
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,done in finish=done;uploaded.fulfill()})
        defer{textures.dispose()}
        for index in 1...7 where index != 3 {XCTAssertNotNil(textures.texture("assets/shop/honey/bee\(index)@2x.png",densityAware:false))}
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks;defer{service.dispose();fifo.dispose()}
        let owner=try XCTUnwrap(NativeSourceHoneyIdlePresentation(textures:textures,use2x:true,service:service,random:{0.5},current:{true},paintable:{true}))
        defer{owner.dispose()}
        XCTAssertTrue(tasks.inputTask{XCTAssertTrue(owner.start(textures:textures,assetTasks:tasks))})
        let identities=owner.sprites.map(ObjectIdentifier.init)
        await fulfillment(of:[uploaded],timeout:3)
        XCTAssertFalse(owner.cohortCommitted);XCTAssertEqual(service.activeParticipantCount,1)
        let initial=owner.sprites.map(\.position)
        service.deliver(wallMilliseconds:400)
        let before=owner.sprites.map(\.position)
        XCTAssertNotEqual(before,initial)
        finish?()
        let committed=expectation(description:"actual asset FIFO cohort")
        Task{@MainActor in
            for _ in 0..<100 where !owner.cohortCommitted {try? await Task.sleep(nanoseconds:10_000_000)}
            if owner.cohortCommitted {committed.fulfill()}
        }
        await fulfillment(of:[committed],timeout:3)
        XCTAssertEqual(owner.sprites.map(ObjectIdentifier.init),identities)
        XCTAssertEqual(service.activeParticipantCount,1);XCTAssertEqual(owner.sprites.map(\.position),before)
        XCTAssertNotNil(textures.sourceCachedTexture(candidates:["assets/shop/honey/bee3@2x.png"]))
    }
    func testHoneyActualLateUploadCannotPaintForeignCarriersAfterDisposal()async throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let uploaded=expectation(description:"actual held Honey upload")
        var finish:(@Sendable()->Void)?
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,done in finish=done;uploaded.fulfill()})
        defer{textures.dispose()}
        for index in 1...7 where index != 3 {XCTAssertNotNil(textures.texture("assets/shop/honey/bee\(index)@2x.png",densityAware:false))}
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks;defer{service.dispose();fifo.dispose()}
        let owner=try XCTUnwrap(NativeSourceHoneyIdlePresentation(textures:textures,use2x:true,service:service,random:{0.5},current:{true},paintable:{true}))
        XCTAssertTrue(tasks.inputTask{XCTAssertTrue(owner.start(textures:textures,assetTasks:tasks))})
        await fulfillment(of:[uploaded],timeout:3)
        let held=owner.sprites,foreign=SKNode()
        owner.dispose()
        for sprite in held {foreign.addChild(sprite);sprite.position = .init(x:999,y:222);sprite.setScale(1);sprite.size = .init(width:315,height:123)}
        finish?()
        let delivered=expectation(description:"held upload actually returned to provider")
        Task{@MainActor in
            for _ in 0..<100 where textures.sourceCachedTexture(candidates:["assets/shop/honey/bee3@2x.png"])==nil {try? await Task.sleep(nanoseconds:10_000_000)}
            if textures.sourceCachedTexture(candidates:["assets/shop/honey/bee3@2x.png"]) != nil {delivered.fulfill()}
        }
        await fulfillment(of:[delivered],timeout:3)
        XCTAssertFalse(owner.cohortCommitted);XCTAssertEqual(service.activeParticipantCount,0)
        for sprite in held {XCTAssertTrue(sprite.parent === foreign);XCTAssertEqual(sprite.position,.init(x:999,y:222));XCTAssertEqual(sprite.size,.init(width:315,height:123))}
    }
    func testHoneyRendererKeepsThreeCarriersAndAuthoredSizeAcrossLargeDecodedCohort()throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo);defer{service.dispose();fifo.dispose()}
        let host=SKNode()
        let owner=try XCTUnwrap(NativeSourceHoneyIdlePresentation(cachedTextures:Array(repeating:nil,count:7),service:service,random:{0.5},current:{true},paintable:{true}))
        host.addChild(owner);XCTAssertTrue(owner.start())
        let carriers=owner.sprites.map(ObjectIdentifier.init)
        XCTAssertEqual(carriers.count,3);XCTAssertEqual(service.activeParticipantCount,1)
        XCTAssertTrue(owner.sprites.allSatisfy{$0.color.cgColor.alpha==0 && $0.alpha==0})
        let image=UIGraphicsImageRenderer(size:.init(width:800,height:600)).image{context in UIColor.red.setFill();context.fill(.init(x:0,y:0,width:800,height:600))}
        let decoded=SKTexture(image:image)
        XCTAssertTrue(owner.commitAssetCohort(Array(repeating:decoded,count:7)))
        XCTAssertFalse(owner.commitAssetCohort(Array(repeating:nil,count:7)))
        XCTAssertEqual(owner.sprites.map(ObjectIdentifier.init),carriers)
        XCTAssertTrue(owner.sprites.allSatisfy{$0.texture === decoded})
        for sprite in owner.sprites {XCTAssertEqual(sprite.size.width,CGFloat(128*0.435456)*abs(sprite.xScale),accuracy:1e-5);XCTAssertEqual(sprite.size.height,sprite.size.width,accuracy:1e-5)}
        owner.setDragging(true);service.deliver(wallMilliseconds:400)
        let positions=owner.sprites.map(\.position)
        owner.updateDrag(offset:.init(x:20,y:-10),velocity:.init(x:0.2,y:0.04))
        for index in owner.sprites.indices {
            XCTAssertEqual(owner.sprites[index].position.x,positions[index].x-20,accuracy:1e-5)
            XCTAssertEqual(owner.sprites[index].position.y,positions[index].y-10,accuracy:1e-5)
        }
        owner.dispose();owner.dispose();XCTAssertTrue(host.children.isEmpty)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(owner.sprites.count,0)
    }
    func testHoneyRetiredRendererCannotPublishLateCohortIntoCapturedForeignSprite()throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo);defer{service.dispose();fifo.dispose()}
        var owns=true
        let owner=try XCTUnwrap(NativeSourceHoneyIdlePresentation(cachedTextures:Array(repeating:nil,count:7),service:service,random:{0.5},current:{owns},paintable:{true}))
        XCTAssertTrue(owner.start());let captured=try XCTUnwrap(owner.sprites.first)
        owns=false;captured.position = .init(x:999,y:222)
        XCTAssertFalse(owner.commitAssetCohort(Array(repeating:nil,count:7)))
        service.deliver(wallMilliseconds:400)
        XCTAssertEqual(captured.position,.init(x:999,y:222));XCTAssertEqual(service.activeParticipantCount,0)
        owner.dispose();XCTAssertEqual(captured.position,.init(x:999,y:222))
    }
    func testHoneyActualSourceRootContinuesChaseDuringDraggingAndVisibilityAloneSuspends()throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo);defer{service.dispose();fifo.dispose()}
        var paints=0,owns=true
        let owner=try XCTUnwrap(NativeSourceHoneyIdleClock(service:service,random:{0.5},current:{owns},paintable:{true},paint:{_ in paints+=1}))
        XCTAssertTrue(owner.start());owner.assetCohortDidCommit();owner.setDragging(true)
        service.deliver(wallMilliseconds:400);let active=paints
        XCTAssertGreaterThan(active,2)
        owner.setVisible(false);service.deliver(wallMilliseconds:800);XCTAssertEqual(paints,active)
        owner.setVisible(true);service.deliver(wallMilliseconds:1200);XCTAssertGreaterThan(paints,active)
        let before=paints;owns=false;owner.assetCohortDidCommit();owner.advanceSourceAnimation(seconds:1.2)
        XCTAssertTrue(owner.disposed);XCTAssertEqual(paints,before);XCTAssertEqual(service.activeParticipantCount,0)
    }

}
