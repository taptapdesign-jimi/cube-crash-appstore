import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceNoMovesResultMountedTests:XCTestCase {
    private func confirmed()throws->(NativeGameplayEngine,NativeSourceNoMovesCompletedReceipt,NativeResolution) {
        let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4),.init(id:"b",cell:.init(column:1,row:0),value:3)]))
        engine.stagedSourceNoMoves=true
        guard case .candidate(let p)=engine.beginSourceNoMoves(origin:.levelEnd)else{throw NSError(domain:"candidate",code:1)}
        _=engine.deliverSourceNoMovesWait(plan:p,generation:1)
        _=engine.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited)
        _=engine.acquireSourceNoMovesLock(plan:p,generation:1)
        let result=engine.finishSourceNoMovesBoardExit(plan:p,generation:1)
        return(engine,try XCTUnwrap(engine.completedSourceNoMovesReceipt),result.resolution)
    }
    func testAcceptedActualCoreExitReceiptMountsOneResultWithoutSecondTextOrBoardExitOrCue()async throws {
        let (engine,receipt,resolution)=try confirmed()
        let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
        game.view.frame=window.bounds;game.view.layoutIfNeeded()
        var moments:[String]=[],commits=0
        let owner=NativeResultOwner(gameplay:game,root:NativeTestResources.root,resolution:resolution,commit:{_ in commits += 1},restart:{},continueArcade:{},exit:{},sourceNoMovesReceipt:receipt)
        owner.onMoment={kind,_,_ in moments.append(kind)}
        defer{owner.dispose();game.dispose();window.isHidden=true;window.rootViewController=nil}
        owner.present();owner.present()
        let until=Date().addingTimeInterval(2)
        while game.presentedViewController==nil && Date()<until {try? await Task.sleep(nanoseconds:10_000_000)}
        XCTAssertTrue(game.presentedViewController is NativeResultController)
        XCTAssertEqual(commits,1)
        XCTAssertFalse(moments.contains("no-moves"))
        let scene=try XCTUnwrap(game.boardScene)
        XCTAssertFalse(scene.sourceNativeTileNode("a")?.action(forKey:"board-exit") != nil)
        XCTAssertFalse(scene.sourceNativeTileNode("b")?.action(forKey:"board-exit") != nil)
        XCTAssertTrue(game.view.subviews.filter{$0.accessibilityIdentifier=="native.no-moves.source-graph"}.isEmpty)
    }
    func testRestartMakesCapturedHandledReceiptUnableToMountResultOrCommit()throws {
        let (engine,receipt,resolution)=try confirmed()
        engine.restart(state:.init(tiles:[],generation:2))
        let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        var commits=0
        let owner=NativeResultOwner(gameplay:game,root:NativeTestResources.root,resolution:resolution,commit:{_ in commits += 1},restart:{},continueArcade:{},exit:{},sourceNoMovesReceipt:receipt)
        owner.present();XCTAssertNil(game.presentedViewController);XCTAssertEqual(commits,0)
        owner.dispose();game.dispose()
    }
}
