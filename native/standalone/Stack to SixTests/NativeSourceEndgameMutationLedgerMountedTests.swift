import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceEndgameMutationLedgerMountedTests:XCTestCase {
 @MainActor private final class DateBox {var value:Double=1000}
 @MainActor private final class Fixture {
    let date=DateBox(),service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,game:NativeGameplayViewController,window:UIWindow
    init(enabled:Bool)throws {
        service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let captured=date;context=NativeGameplaySourceContext(service:service,sourceDateMilliseconds:{captured.value})
        game=NativeGameplayViewController(engine:NativeGameplayEngine(state:.init(tiles:[.init(id:"s",cell:.init(column:0,row:0),value:1),.init(id:"d",cell:.init(column:1,row:0),value:1),.init(id:"o",cell:.init(column:2,row:0),value:5)])),resourceRoot:NativeTestResources.root)
        game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true;game.sourceEndgameMutationLedgerEnabled=enabled
        window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible();game.view.layoutIfNeeded()
        let scene=try XCTUnwrap(game.boardScene);scene.layout(size:window.bounds.size,insets:.init(top:1,left:0,bottom:0,right:0),animateEntry:false)
    }
    func drop()throws {
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry),a=geometry.center(row:0,column:0),b=geometry.center(row:0,column:1)
        XCTAssertTrue(scene.beginDrag(at:a));service.deliver(wallMilliseconds:25);scene.moveDrag(to:b,now:0.025);XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:b,now:0.025)).accepted)
    }
    func dispose(){game.dispose();context.dispose();service.dispose();window.isHidden=true;window.rootViewController=nil}
 }
 func testActualOptInVCBindsBeforeHandoffAndActualSameNodeMainReleaseWritesSecondDate()throws {
    let f=try Fixture(enabled:true);defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene)
    XCTAssertTrue(scene.sourceEndgameMutationLedgerAdmissionOpen);XCTAssertEqual(f.context.endgameMutations.snapshot.sequence,0)
    f.date.value=1111;try f.drop();XCTAssertEqual(f.context.endgameMutations.snapshot.lastMutationAt,1111);XCTAssertEqual(f.context.endgameMutations.snapshot.sequence,1)
    f.date.value=2222;f.service.deliver(wallMilliseconds:105);XCTAssertEqual(f.context.endgameMutations.snapshot.lastMutationAt,2222);XCTAssertEqual(f.context.endgameMutations.snapshot.sequence,2)
    XCTAssertFalse(f.context.endgameMutations.allFourWritersConnected)
 }
 func testRawDefaultDoesNotWriteDateOrPublishLedgerCoverage()throws {
    let f=try Fixture(enabled:false);defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene)
    XCTAssertFalse(scene.sourceEndgameMutationLedgerAdmissionOpen);try f.drop();f.service.deliver(wallMilliseconds:105)
    XCTAssertEqual(f.context.endgameMutations.snapshot.sequence,0);XCTAssertEqual(f.context.endgameMutations.snapshot.lastMutationAt,0)
 }
 func testActualScopeRetirementDuringMainKeepsLastDateAndCannotBindAnOldScene()throws {
    let f=try Fixture(enabled:true);defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene),old=try XCTUnwrap(f.game.sourceScope)
    try f.drop();let before=f.context.endgameMutations.snapshot;f.date.value=3000
    let replacement=try XCTUnwrap(f.context.beginScene(retire:{}));XCTAssertFalse(old.current);XCTAssertTrue(replacement.current)
    f.service.deliver(wallMilliseconds:105);XCTAssertEqual(f.context.endgameMutations.snapshot,before);XCTAssertFalse(scene.sourceEndgameMutationLedgerAdmissionOpen)
    XCTAssertFalse(scene.configureSourceEndgameMutationLedger(scope:old))
 }
}
