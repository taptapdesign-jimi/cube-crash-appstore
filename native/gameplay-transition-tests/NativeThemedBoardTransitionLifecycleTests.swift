import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeThemedBoardTransitionLifecycleTests:XCTestCase {
    private final class Resources:NativeBoardTransitionResources {
        var prepared:[Int:[String]]=[:],pending:[(Bool)->Void]=[],released:[Int]=[]
        lazy var pixel:UIImage=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{_ in UIColor.white.setFill();UIBezierPath(rect:CGRect(x:0,y:0,width:2,height:2)).fill()}
        func image(_ path:String,owner:Int)->UIImage? {pixel}
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){prepared[owner]=paths;pending.append(completion)}
        func release(_ owner:Int){released.append(owner)}
        func accept(){while !pending.isEmpty{let callback=pending.removeFirst();callback(true)}}
    }
    private func make(board:Int,resources:Resources,generation:UInt64=9)->NativeThemedBoardTransitionController {
        NativeThemedBoardTransitionController(root:URL(fileURLWithPath:"/unused"),board:board,viewport:CGSize(width:390,height:844),generation:generation,resources:resources,font:.systemFont(ofSize:166),random:{0.37})
    }
    func testEachAuthoredSceneRetainsOpaquePaperUntilExplicitPreparedBoardRelease() {
        for (board,end) in [(1,3.781),(11,3.331),(21,4.197)] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            var exits=0,audio:[Bool]=[],cues:[String]=[],haptics:[String]=[],music:[(String,Double,Double)]=[]
            owner.onMusicPhase={music.append(($0,$1,$2))}
            owner.onSceneExit={generation in XCTAssertEqual(generation,9);exits += 1;XCTAssertTrue(owner.retainsOpaqueCover);XCTAssertEqual(music.last?.0,"complete")}
            owner.onAudioCleanup={audio.append($0)};owner.onCue={cues.append("\($0):\($1)")};owner.onHaptic={haptics.append($0)}
            owner.start();owner.start();XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
            owner.releaseCover(generation:9);XCTAssertTrue(resources.released.isEmpty)
            resources.accept();XCTAssertTrue(owner.assetsReady);XCTAssertTrue(owner.hasActiveClock)
            XCTAssertEqual(resources.prepared.values.flatMap{$0}.count,owner.selectedAssetCount+1)
            owner.paint(seconds:end-0.01,generation:9);XCTAssertEqual(exits,0)
            owner.paint(seconds:end,generation:9);XCTAssertEqual(exits,1);XCTAssertFalse(owner.hasActiveClock)
            XCTAssertEqual(music.map{$0.0},["begin","hold","exit","complete"])
            XCTAssertEqual(music.map{$0.1},[0.62,0.5,0.2,0.33])
            let enter=board==21 ? 2.35:1.35,exitAt=board==21 ? 2.681:1.75
            XCTAssertEqual(music[0].2,enter,accuracy:0.000001)
            XCTAssertEqual(music[1].2,exitAt-enter,accuracy:0.000001)
            XCTAssertEqual(music[2].2,end-exitAt,accuracy:0.000001)
            XCTAssertEqual(music[3].2,0.32,accuracy:0.000001)
            XCTAssertEqual(resources.released.count,1);XCTAssertEqual(audio,[false]);XCTAssertEqual(haptics,["light","light","light","light"])
            XCTAssertTrue(cues.contains("digit:0"));XCTAssertTrue(cues.contains("digit:1"))
            if board==21 {XCTAssertEqual(cues,["area55-start:0","area55-beam:1","digit:0","digit:1","area55-beam:2"])}
            owner.paint(seconds:20,generation:9);owner.releaseCover(generation:8)
            XCTAssertTrue(owner.retainsOpaqueCover);XCTAssertEqual(exits,1);XCTAssertEqual(resources.released.count,1)
            XCTAssertEqual(music.count,4)
            owner.releaseCover(generation:9);owner.dispose();XCTAssertFalse(owner.retainsOpaqueCover)
            XCTAssertEqual(resources.released.count,2);XCTAssertEqual(Set(resources.released).count,2);XCTAssertEqual(audio,[false])
        }
    }
    func testColdBackgroundPreparationWaitsAndStaleOrDisposedClockCannotEmitContacts() {
        let resources=Resources(),owner=make(board:1,resources:resources)
        var exits=0,cues=0,audio:[Bool]=[];owner.onSceneExit={_ in exits += 1};owner.onCue={_,_ in cues += 1};owner.onAudioCleanup={audio.append($0)}
        owner.start();owner.setForeground(false);resources.accept()
        XCTAssertTrue(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
        owner.paint(seconds:20,generation:9);XCTAssertEqual(exits,0);XCTAssertEqual(cues,0)
        owner.setForeground(true);XCTAssertTrue(owner.hasActiveClock)
        owner.paint(seconds:20,generation:8);XCTAssertEqual(exits,0);XCTAssertEqual(cues,0)
        owner.paint(seconds:0.7,generation:9);XCTAssertGreaterThan(cues,0)
        let contacts=cues,cleanup=owner.captureCleanup();cleanup();cleanup()
        owner.setForeground(true);owner.paint(seconds:20,generation:9)
        XCTAssertFalse(owner.hasActiveClock);XCTAssertEqual(exits,0);XCTAssertEqual(cues,contacts);XCTAssertEqual(audio,[true]);XCTAssertEqual(resources.released.count,2)
    }
    func testDisposedLateAssetsAndFailedRequiredAssetsNeverStartReducedScene() {
        let resources=Resources(),owner=make(board:21,resources:resources);var exits=0
        owner.onSceneExit={_ in exits += 1};owner.start();owner.dispose();resources.accept()
        XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock);XCTAssertEqual(exits,0);XCTAssertEqual(resources.released.count,2)
        let failed=Resources(),blocked=make(board:11,resources:failed);var failures=0
        blocked.onAssetFailure={failures += 1};blocked.onSceneExit={_ in XCTFail("Missing authored scene cannot enter gameplay")}
        blocked.start();failed.pending.removeFirst()(false)
        XCTAssertEqual(failures,1);XCTAssertFalse(blocked.assetsReady);XCTAssertFalse(blocked.hasActiveClock)
        blocked.paint(seconds:10,generation:9);blocked.dispose()
    }
    func testBeachSideSequenceAlternatesWithoutRerollAndRoboDirectionKeepsOppositeWalker() {
        let owner=NativeThemedTransitionVariationOwner();var draws=0
        func random()->Double{draws += 1;return 0.1}
        XCTAssertTrue(owner.next(theme:.beach,random:random).beachSwapped)
        XCTAssertFalse(owner.next(theme:.beach,random:random).beachSwapped)
        XCTAssertTrue(owner.next(theme:.beach,random:random).beachSwapped);XCTAssertEqual(draws,1)
        let robo=owner.next(theme:.area55,random:random);XCTAssertEqual(robo.frontDirection,1);XCTAssertEqual(robo.walkerDirection,-1);XCTAssertEqual(draws,2)
    }
    func testColdJourneyEntryCannotExposeFlatOpaqueCoverBeforePaperTexture(){
        for board in [1,11,21] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            owner.start()
            XCTAssertFalse(owner.view.isOpaque)
            XCTAssertEqual(owner.view.backgroundColor,.clear)
            let cover=owner.view.subviews.first
            XCTAssertTrue(cover?.isHidden == true)
            XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
            resources.pending.removeFirst()(true)
            XCTAssertTrue(owner.view.isOpaque);XCTAssertFalse(cover?.isHidden ?? true)
            XCTAssertNotNil(cover?.subviews.compactMap{$0 as? UIImageView}.first?.image)
            XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
            resources.accept();XCTAssertTrue(owner.assetsReady);owner.dispose()
        }
    }
    func testFailedOrDisposedPendingPaperCannotRevealEmptyCover(){
        let resources=Resources(),owner=make(board:1,resources:resources)
        owner.start();resources.pending.removeFirst()(false)
        XCTAssertFalse(owner.view.isOpaque);XCTAssertTrue(owner.view.subviews.first?.isHidden == true)
        owner.dispose()
        let late=Resources(),disposed=make(board:11,resources:late)
        disposed.start();disposed.dispose();late.accept()
        XCTAssertFalse(disposed.view.isOpaque);XCTAssertTrue(disposed.view.subviews.first?.isHidden == true)
    }

}
