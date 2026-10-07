import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeJourneyDecorIntegrationTests:XCTestCase {
    private final class Resources:NativeJourneyBottomDecorResourcePreparing {
        var decodedBytes=0,requests:[(UIImage?)->Void]=[]
        func prepare(path:String,completion:@escaping(UIImage?)->Void){requests.append(completion)}
        func cancelPendingPreparation(){}
        func release(){decodedBytes=0}
        func finish(_ index:Int){
            let image=UIGraphicsImageRenderer(size:CGSize(width:2,height:1)).image{_ in UIColor.white.setFill();UIBezierPath(rect:CGRect(x:0,y:0,width:2,height:1)).fill()}
            decodedBytes=32;requests[index](image)
        }
    }
    private func controller(_ resources:Resources)->NativeGameplayViewController {
        let tile=NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:1)
        let controller=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root)
        controller.journeyDecorCatalog=NativeJourneyBottomDecorCatalog();controller.journeyDecorResources={_ in resources}
        return controller
    }
    private func mount(_ controller:NativeGameplayViewController)->UIWindow {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        controller.view.frame=window.bounds;controller.view.setNeedsLayout();controller.view.layoutIfNeeded();return window
    }
    func testThemedAdmissionStartsBeforeDecodeAndRevealsOnePreparedFooterBelowCanvas() throws {
        let resources=Resources(),controller=controller(resources);var release:(()->Void)?,entries=0
        controller.beforeInitialBoardEntry={release=$0};controller.onBoardEntry={_,_ in entries += 1}
        let window=mount(controller);defer{controller.dispose();window.isHidden=true}
        XCTAssertNotNil(release,"Selected artwork preparation cannot delay themed first motion")
        let renderer=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? SKView}.first)
        XCTAssertNil(renderer.scene);XCTAssertTrue(renderer.isHidden);XCTAssertEqual(resources.requests.count,1)
        release?();XCTAssertNil(renderer.scene);XCTAssertEqual(entries,0)
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let footer=try XCTUnwrap(controller.journeyBottomDecor)
        XCTAssertTrue(footer.isPrepared);XCTAssertEqual(footer.phase,.entering);XCTAssertNotNil(renderer.scene);XCTAssertEqual(entries,1)
        XCTAssertTrue(controller.view.subviews.first is NativeAppPaperSurface)
        XCTAssertTrue(controller.view.subviews[1] === footer);XCTAssertTrue(controller.view.subviews[2] === renderer)
        release?();controller.view.layoutIfNeeded();XCTAssertEqual(entries,1)
    }
    func testBackgroundCancellationRetainsEntryBarrierUntilFreshForegroundReply() throws {
        let resources=Resources(),controller=controller(resources);controller.beforeInitialBoardEntry={_ in}
        let window=mount(controller);defer{controller.dispose();window.isHidden=true}
        var replies:[Bool]=[];controller.prepareBoardEntryArtwork{replies.append($0)}
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertTrue(replies.isEmpty);resources.finish(0);XCTAssertTrue(replies.isEmpty)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(resources.requests.count,2);resources.finish(0);XCTAssertTrue(replies.isEmpty)
        resources.finish(1);XCTAssertEqual(replies,[true]);XCTAssertTrue(try XCTUnwrap(controller.journeyBottomDecor).isPrepared)
    }
    func testGenerationReplacementRetiresOldBarrierAndIgnoresItsLateReply() throws {
        let resources=Resources(),controller=controller(resources);controller.beforeInitialBoardEntry={_ in}
        let window=mount(controller);defer{controller.dispose();window.isHidden=true}
        let old=try XCTUnwrap(controller.journeyBottomDecor);var replies:[Bool]=[],next:[Bool]=[]
        controller.prepareBoardEntryArtwork{replies.append($0)}
        var state=controller.engine.state;state.generation=2;state.board=13;controller.engine.restart(state:state)
        controller.refreshFromEngine();XCTAssertEqual(replies,[false]);XCTAssertEqual(old.phase,.disposed)
        controller.prepareBoardEntryArtwork{next.append($0)};resources.finish(0);XCTAssertTrue(next.isEmpty)
        resources.finish(1);XCTAssertEqual(next,[true]);XCTAssertEqual(controller.journeyBottomDecor?.board,13)
        controller.dispose();XCTAssertFalse(old.hasActiveClock)
    }
    func testPreparedArtworkAdmissionDoesNotDependOnAnimatedWaveNotification() throws {
        let resources=Resources(),controller=controller(resources),window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        // The optional animation/audio wave callback is absent on reduced-motion
        // admission. The controller's real prepared-frame boundary still enters.
        controller.boardScene?.onBoardEntry=nil
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        XCTAssertEqual(controller.journeyBottomDecor?.phase,.entering)
    }
    func testJourneyRetryWithoutThemedWaveEntersOnlyItsFreshPreparedFooter() throws {
        let resources=Resources(),controller=controller(resources),window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let old=try XCTUnwrap(controller.journeyBottomDecor)
        var state=controller.engine.state;state.generation=2;controller.engine.restart(state:state)
        controller.refreshFromEngine()
        XCTAssertEqual(old.phase,.disposed);XCTAssertEqual(controller.journeyBottomDecor?.phase,.unprepared)
        resources.finish(1);XCTAssertEqual(controller.journeyBottomDecor?.phase,.entering)
        controller.refreshFromEngine();XCTAssertEqual(resources.requests.count,2)
    }
    func testCoveredBoardExitExplicitlyRunsFooterAndAwaitsBothActualComponents() async throws {
        let resources=Resources(),controller=controller(resources),window=mount(controller)
        defer{controller.dispose();window.isHidden=true}
        resources.finish(0);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let footer=try XCTUnwrap(controller.journeyBottomDecor);footer.paint(seconds:0.62,generation:1)
        controller.setSuspended(true);XCTAssertFalse(footer.hasActiveClock)
        let done=expectation(description:"Board and original .44 footer exit both settle");var replies:[Bool]=[]
        controller.animateBoardExit {success in
            replies.append(success);XCTAssertTrue(success);XCTAssertEqual(footer.phase,.hidden);XCTAssertFalse(footer.hasActiveClock);done.fulfill()
        }
        XCTAssertEqual(footer.phase,.exiting);XCTAssertTrue(footer.hasActiveClock);XCTAssertTrue(replies.isEmpty)
        await fulfillment(of:[done],timeout:4);XCTAssertEqual(replies,[true])
    }
}
