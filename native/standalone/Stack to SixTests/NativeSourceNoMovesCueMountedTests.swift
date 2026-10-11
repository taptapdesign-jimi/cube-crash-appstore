import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeSourceNoMovesCueMountedTests:XCTestCase {
    private var root:URL {NativeTestResources.root}
    private func prepare(_ owner:NativeSourceNoMovesUIKitCoordinator)async {
        let e=expectation(description:"Selected original clouds and font")
        owner.prepare{XCTAssertTrue($0);e.fulfill()};await fulfillment(of:[e],timeout:5)
    }
    func testRealMountedGlyphsEmitCueAtDraw34BeforeAnyCloudAndKeepExistingSoundSettingsOwner()async throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),host=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        var draws=0,cues=0
        let owner=NativeSourceNoMovesUIKitCoordinator(host:host,root:root,service:service,current:{$0==7},random:{draws += 1;return 0.5},fallback:{_,_ in {}},onVisibleShow:{generation,token in
            XCTAssertEqual(generation,7);XCTAssertEqual(token,12);XCTAssertEqual(draws,34)
            let node=host.subviews.compactMap{$0 as? NativeNoMovesSourcePresentation}.first
            XCTAssertEqual(node?.glyphViews.count,8);XCTAssertEqual(node?.cloudViews.count,0)
            cues += 1
        })
        await prepare(owner);XCTAssertTrue(owner.show(generation:7,receipt:12))
        XCTAssertEqual(cues,1);XCTAssertEqual(draws,64);XCTAssertEqual(owner.presentation?.cloudViews.count,5)
        owner.dispose();XCTAssertTrue(host.subviews.isEmpty);XCTAssertEqual(service.activeParticipantCount,0);service.dispose()
    }
    func testCueReentryClearsCapturedPartialNodeBeforeCloudRNGWithoutRevivingIt()async throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),host=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        var draws=0,cues=0,owner:NativeSourceNoMovesUIKitCoordinator!
        owner=NativeSourceNoMovesUIKitCoordinator(host:host,root:root,service:service,current:{_ in true},random:{draws += 1;return 0.5},fallback:{_,_ in {}},onVisibleShow:{_,_ in cues += 1;owner.clear()})
        await prepare(owner);XCTAssertFalse(owner.show(generation:1,receipt:1))
        XCTAssertEqual(cues,1);XCTAssertEqual(draws,34);XCTAssertNil(owner.presentation)
        XCTAssertTrue(host.subviews.isEmpty);XCTAssertEqual(service.activeParticipantCount,0)
        owner.dispose();service.dispose()
    }
    func testCueReentryReplacingPartialNodeRetainsReplacementGraphAndOwnEpoch()async throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),host=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        var draws=0,seen:[UInt64]=[],owner:NativeSourceNoMovesUIKitCoordinator!
        owner=NativeSourceNoMovesUIKitCoordinator(host:host,root:root,service:service,current:{_ in true},random:{draws += 1;return 0.5},fallback:{_,_ in {}},onVisibleShow:{_,token in
            seen.append(token)
            if token==1 {XCTAssertTrue(owner.show(generation:1,receipt:2))}
        })
        await prepare(owner);XCTAssertFalse(owner.show(generation:1,receipt:1))
        let replacement=try XCTUnwrap(owner.presentation)
        XCTAssertEqual(seen,[1,2]);XCTAssertEqual(draws,98)
        XCTAssertFalse(replacement.disposed);XCTAssertTrue(replacement.superview === host)
        XCTAssertEqual(host.subviews.count,1);XCTAssertEqual(replacement.graph.activeIDs.count,19)
        XCTAssertEqual(service.activeParticipantCount,19)
        owner.dispose();XCTAssertEqual(service.activeParticipantCount,0);service.dispose()
    }
    func testMissingSelectedOriginalResourcesOrDisposedHostNeverEmitCue() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),host=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        var cues=0,draws=0
        let owner=NativeSourceNoMovesUIKitCoordinator(host:host,root:root,service:service,current:{_ in true},random:{draws += 1;return 0.5},fallback:{_,_ in {}},onVisibleShow:{_,_ in cues += 1})
        XCTAssertFalse(owner.show(generation:1,receipt:1));owner.dispose()
        XCTAssertFalse(owner.show(generation:1,receipt:1));XCTAssertEqual(cues,0);XCTAssertEqual(draws,0)
        service.dispose()
    }
}

@MainActor final class NativeSourceNoMovesCueAudioTests:XCTestCase {
    private final class Transport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[];var stops=0
        func play(_ cue:NativeAudioCue){cues.append(cue)}
        func stopAll(){stops += 1}
        func dispose(){stopAll()}
    }
    func testCapturedOriginalCueUsesExistingVoiceGainAndConsumesNoVisualRandom() {
        let transport=Transport();var randomCalls=0
        let audio=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport,random:{randomCalls += 1;return 0.5})
        audio.beginGeneration(7)
        audio.resultMoment("no-moves",receipt:1,generation:7)
        XCTAssertEqual(transport.cues.count,1)
        XCTAssertEqual(transport.cues.first?.source,"assets/sound/grandpa - no moves left.mp3")
        XCTAssertEqual(transport.cues.first?.voice,"no-moves-grandpa")
        XCTAssertEqual(transport.cues.first?.gain,0.42);XCTAssertEqual(randomCalls,0)
        audio.resultMoment("no-moves",receipt:1,generation:7)
        XCTAssertEqual(transport.cues.count,1);audio.dispose()
    }
    func testMuteBackgroundAndStaleGenerationConsumeOrRejectCueWithoutForegroundReplay() {
        let transport=Transport(),audio=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:false,transport:transport)
        audio.beginGeneration(7);audio.resultMoment("no-moves",receipt:1,generation:7)
        audio.setEnabled(true);audio.resultMoment("no-moves",receipt:1,generation:7)
        audio.setForeground(false);audio.resultMoment("no-moves",receipt:2,generation:7)
        audio.setForeground(true);audio.resultMoment("no-moves",receipt:2,generation:7)
        audio.resultMoment("no-moves",receipt:3,generation:6)
        XCTAssertTrue(transport.cues.isEmpty)
        audio.resultMoment("no-moves",receipt:3,generation:7)
        XCTAssertEqual(transport.cues.count,1);audio.dispose()
    }
}
