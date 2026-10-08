import XCTest
import UIKit
import CoreText
@testable import Stack_to_Six

@MainActor
final class NativeNoMovesSourceGraphTests:XCTestCase {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        var values:[Double]=[]
        func advanceSourceAnimation(seconds:Double){values.append(seconds)}
    }
    func testEightAtomicPausedRootsCreateNoTransientDisplayLinksAndRetainLinkedSlots()throws {
        var wall=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let participants=(0..<8).map{_ in Participant()}
        let bounces=try participants.map{try XCTUnwrap(service.register(participant:$0,duration:1e10,domain:.sourceGSAP(.timeline),initiallySuspended:true,cleanup:{_ in}))}
        XCTAssertEqual(service.activeParticipantCount,8)
        XCTAssertEqual(service.displayLinkCreationCount,0);XCTAssertFalse(service.hasActiveClock)
        let entry=Participant()
        _=try XCTUnwrap(service.register(participant:entry,duration:0.54,domain:.sourceGSAP(.timeline),delay:0.2,cleanup:{success in if success{bounces[0].setSuspended(false)}}))
        XCTAssertEqual(service.displayLinkCreationCount,1)
        wall=210;service.deliver(wallMilliseconds:wall);wall=750;service.deliver(wallMilliseconds:wall)
        // >500ms uses exact Source smoothing. Continue via bounded small gaps.
        for t in stride(from:760,through:1300,by:10){wall=Double(t);service.deliver(wallMilliseconds:wall)}
        XCTAssertTrue(participants[0].values.count>0);XCTAssertTrue(participants.dropFirst().allSatisfy{$0.values.isEmpty})
        XCTAssertEqual(service.displayLinkCreationCount,1,"Resuming original root does not reinsert or wake another union transport")
        service.dispose();XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock)
    }
    func testSourcePlayZeroShiftsSuspendedBirthAtActualEntryReceiptWithoutReinsertion()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
        let a=Participant(),b=Participant(),entry=Participant();var order:[UInt64]=[]
        runtime.onVisit={order.append($0)}
        let ra=try XCTUnwrap(runtime.attach(participant:a,family:.timeline,duration:1e10,initiallySuspended:true,cleanup:{_ in}))
        let rb=try XCTUnwrap(runtime.attach(participant:b,family:.timeline,duration:1e10,initiallySuspended:true,cleanup:{_ in}))
        _=runtime.attach(participant:entry,family:.timeline,duration:0.54,delay:0.21,cleanup:{success in if success{ra.setSuspended(false);rb.setSuspended(false)}})
        for t in stride(from:0,through:750,by:10){runtime.deliver(wallMilliseconds:Double(t))}
        XCTAssertTrue(a.values.isEmpty);XCTAssertTrue(b.values.isEmpty)
        order.removeAll();runtime.deliver(wallMilliseconds:760)
        XCTAssertEqual(order,[ra.receiptID,rb.receiptID]);XCTAssertEqual(a.values,[0.01]);XCTAssertEqual(b.values,[0.01])
        runtime.dispose();XCTAssertEqual(runtime.activeCount,0)
    }
    func testActualRasterCarrierUsesOriginalResourcesAndStopsCapturedSourceRootsOnDisposal()throws {
        let assetRoot=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let fontURL=assetRoot.appendingPathComponent("assets/fonts/Baloo2-ExtraBold.ttf")
        if UIFont(name:"Baloo2-ExtraBold",size:32)==nil{CTFontManagerRegisterFontsForURL(fontURL as CFURL,.process,nil)}
        let font=try XCTUnwrap(UIFont(name:"Baloo2-ExtraBold",size:32))
        let images=try NativeNoMovesCloudPlan.paths.map{try XCTUnwrap(UIImage(contentsOfFile:assetRoot.appendingPathComponent($0).path))}
        var wall=0.0,draws=0,fallbacks=0,finished=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall})
        let view=try NativeNoMovesSourcePresentation(font:font,images:images,viewport:CGSize(width:390,height:844),generation:1,service:service,current:{_ in true},random:{draws += 1;return 0.5},scheduleExitFallback:{_ in fallbacks += 1;return{fallbacks -= 1}})
        view.onExitFinished={success in XCTAssertFalse(success);finished += 1}
        XCTAssertEqual(draws,64);XCTAssertEqual(view.glyphViews.count,8);XCTAssertEqual(view.cloudViews.count,5)
        XCTAssertEqual(view.glyphViews[0].font.fontName,"Baloo2-ExtraBold")
        XCTAssertEqual(service.activeParticipantCount,19);XCTAssertEqual(service.displayLinkCreationCount,1)
        for t in stride(from:0,through:900,by:10){wall=Double(t);service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(view.glyphViews[0].alpha,1);XCTAssertGreaterThan(view.graph.glyphs[0].scale,0)
        XCTAssertNotNil(view.cloudViews[0].image)
        view.beginExit();XCTAssertEqual(fallbacks,1);XCTAssertEqual(draws,72)
        view.dispose();view.dispose();XCTAssertEqual(finished,1);XCTAssertEqual(fallbacks,0)
        XCTAssertTrue(view.glyphViews.isEmpty);XCTAssertTrue(view.cloudViews.isEmpty)
        XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock);service.dispose()
    }
    func testPausedExitFallbackIsOnceCapturedAndDoesNotDrainReplacementSourceRoots()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),scheduler=NativeNoMovesValueScheduler(runtime)
        var oldFinished=0
        let a=try NativeNoMovesSourceGraph(width:390,height:844,scheduler:scheduler,current:{true},random:{0.5})
        a.onFinished={success in XCTAssertTrue(success);oldFinished += 1}
        for t in stride(from:0,through:900,by:10){runtime.deliver(wallMilliseconds:Double(t))}
        runtime.setGlobalPaused(true);a.beginExit()
        let b=try NativeNoMovesSourceGraph(width:390,height:844,scheduler:scheduler,current:{true},random:{0.5})
        let captured=b.activeIDs
        a.deliverExitFallback();a.deliverExitFallback()
        XCTAssertEqual(oldFinished,1);XCTAssertEqual(runtime.activeCount,captured.count)
        XCTAssertEqual(b.activeIDs,captured);XCTAssertFalse(b.disposed)
        b.dispose();runtime.dispose();XCTAssertEqual(runtime.activeCount,0)
    }
    func testFallbackSchedulingReentryRevokesPausedRootsAndLateCapturedCancellationOnce()throws {
        for synchronousCompletion in [false,true] {
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),scheduler=NativeNoMovesValueScheduler(runtime)
            var current=true,canceled=0,finished=0
            let a=try NativeNoMovesSourceGraph(width:390,height:844,scheduler:scheduler,current:{current},random:{0.5},scheduleExitFallback:{complete in
                if synchronousCompletion{complete()}else{current=false}
                return{canceled += 1}
            })
            a.onFinished={success in XCTAssertEqual(success,synchronousCompletion);finished += 1}
            runtime.setGlobalPaused(true);a.beginExit()
            XCTAssertTrue(a.disposed);XCTAssertEqual(runtime.activeCount,0)
            XCTAssertEqual(canceled,1,"Scheduler returns captured cancellation after reentrant completion/retirement")
            XCTAssertEqual(finished,1);a.deliverExitFallback();a.dispose()
            XCTAssertEqual(canceled,1);XCTAssertEqual(finished,1);runtime.dispose()
        }
    }
    func testDefaultNativeRawArithmeticAndBaselineRemainUnchangedByAtomicSourceOption()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let old=Participant(),explicit=Participant(),duration=0.4+0.43
        var complete=0
        _=try XCTUnwrap(service.register(participant:old,duration:duration,domain:.nativeRaw,cleanup:{success in XCTAssertTrue(success);complete += 1}))
        _=try XCTUnwrap(service.register(participant:explicit,duration:duration,domain:.nativeRaw,initiallySuspended:false,cleanup:{success in XCTAssertTrue(success);complete += 1}))
        service.deliver(wallMilliseconds:0,rawFrameMilliseconds:1000)
        service.deliver(wallMilliseconds:0,rawFrameMilliseconds:1400)
        service.deliver(wallMilliseconds:0,rawFrameMilliseconds:1830)
        XCTAssertEqual(old.values,explicit.values);XCTAssertEqual(old.values.last?.bitPattern,duration.bitPattern)
        XCTAssertEqual(complete,2);XCTAssertEqual(service.activeParticipantCount,0);XCTAssertFalse(service.hasActiveClock);service.dispose()
    }

    func testStaleSourceCallbackBoundariesRetireAllPausedAndRunnableCapturedRoots()throws {
        for boundary in ["textDelay","cloudDelay","cloudExitPaint","entryComplete"] {
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
            var admitted=true,finished=0,peakChecks=0
            var owner:NativeNoMovesSourceGraph?
            owner=try .init(width:390,height:844,scheduler:NativeNoMovesValueScheduler(runtime),current:{
                if boundary=="entryComplete",runtime.animationSeconds>=0.74,owner?.glyphs[0].scale==1 {
                    peakChecks += 1;if peakChecks==2{admitted=false}
                }
                return admitted
            },random:{0.5})
            let a=try XCTUnwrap(owner)
            a.onFinished={success in XCTAssertFalse(success);XCTAssertTrue(a.disposed);XCTAssertTrue(a.activeIDs.isEmpty);finished += 1}
            runtime.onVisit={id in
                if (boundary=="textDelay" && id==19)||(boundary=="cloudDelay" && id==10)||(boundary=="cloudExitPaint" && id==28 && runtime.animationSeconds>=0.45){admitted=false}
            }
            for t in stride(from:0,through:900,by:10){runtime.deliver(wallMilliseconds:Double(t))}
            XCTAssertTrue(a.disposed,boundary);XCTAssertEqual(finished,1,boundary);XCTAssertEqual(runtime.activeCount,0,boundary)
            let before=a.activeIDs;a.beginExit();a.deliverExitFallback();XCTAssertEqual(a.activeIDs,before)
            if boundary=="entryComplete"{XCTAssertEqual(peakChecks,2,"Postpaint validates once, actual entry completion rejects bounce resume")}
            owner=nil;runtime.dispose()
        }
    }
    func testNodePaintAndPredicateReentryCannotMutateOrPublishAfterTerminalSeal()throws {
        for boundary in ["glyphPaint","cloudPaint","currentPredicate"] {
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
            var admitted=true,trigger=false,painted=0,finished=0
            var owner:NativeNoMovesSourceGraph?
            owner=try .init(width:390,height:844,scheduler:NativeNoMovesValueScheduler(runtime),current:{
                if trigger{trigger=false;owner?.dispose()}
                return admitted
            },random:{0.5})
            let a=try XCTUnwrap(owner)
            a.onFinished={success in XCTAssertFalse(success);XCTAssertTrue(a.disposed);XCTAssertTrue(a.activeIDs.isEmpty);finished += 1;a.beginExit()}
            if boundary=="glyphPaint"{a.onGlyph={_,_ in painted += 1;a.dispose()}}
            if boundary=="cloudPaint"{a.onCloud={_,_ in painted += 1;admitted=false}}
            if boundary=="currentPredicate"{a.onGlyph={_,_ in painted += 1};a.onCloud={_,_ in painted += 1};trigger=true}
            for t in stride(from:0,through:900,by:10){runtime.deliver(wallMilliseconds:Double(t))}
            XCTAssertEqual(painted,boundary=="currentPredicate" ? 0:1,boundary)
            XCTAssertTrue(a.disposed);XCTAssertEqual(finished,1);XCTAssertEqual(runtime.activeCount,0)
            owner=nil;runtime.dispose()
        }
    }
    func testNaturalExitReadySealsOldGraphBeforeReplacementCallback()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),scheduler=NativeNoMovesValueScheduler(runtime)
        let a=try NativeNoMovesSourceGraph(width:390,height:844,scheduler:scheduler,current:{true},random:{0.5})
        var c:NativeNoMovesSourceGraph?,finished=0,oldPaints=0
        a.onGlyph={_,_ in oldPaints += 1}
        a.onFinished={success in
            XCTAssertTrue(success);XCTAssertTrue(a.disposed);XCTAssertTrue(a.activeIDs.isEmpty)
            c=try! .init(width:390,height:844,scheduler:scheduler,current:{true},random:{0.5});finished += 1
            a.beginExit();a.deliverExitFallback()
        }
        for t in stride(from:0,through:400,by:10){runtime.deliver(wallMilliseconds:Double(t))}
        a.beginExit()
        for t in stride(from:410,through:1500,by:10){runtime.deliver(wallMilliseconds:Double(t))}
        let replacement=try XCTUnwrap(c),capturedIDs=replacement.activeIDs,painted=oldPaints
        XCTAssertEqual(finished,1);XCTAssertEqual(runtime.activeCount,capturedIDs.count)
        a.dispose();a.deliverExitFallback();XCTAssertEqual(replacement.activeIDs,capturedIDs)
        XCTAssertEqual(oldPaints,painted);XCTAssertFalse(replacement.disposed)
        replacement.dispose();runtime.dispose();XCTAssertEqual(runtime.activeCount,0)
    }

}
