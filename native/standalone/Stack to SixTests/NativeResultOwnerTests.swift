import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeResultOwnerTests:XCTestCase {
    private func controller(clean:Bool=true,mode:NativeRunMode = .journey,board:Int=1,headlineRandom:Double=0)->NativeResultController {
        let root=Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
        let state=NativeBoardState(tiles:[],mode:mode,board:board,score:100)
        return NativeResultController(root:root,state:state,clean:clean,combo:50,efficiency:500,finalScore:650,headlineRandom:headlineRandom)
    }
    func testResultCommitsOnceBeforeActionsAndBackgroundFreezesClock() {
        let result=controller();var commits=0;var actions=0
        result.onCommit={commits += 1};result.onAction={_ in actions += 1}
        result.loadViewIfNeeded()
        XCTAssertEqual(commits,1)
        result.tick(0);result.tick(0.05)
        let painted=result.elapsed
        result.setSuspended(true);result.tick(10)
        XCTAssertEqual(result.elapsed,painted)
        result.setSuspended(false);result.tick(11);result.tick(11.05)
        XCTAssertEqual(commits,1)
        let cta=button(in:result.view,id:"native.result.play-again")!
        XCTAssertFalse(cta.isUserInteractionEnabled)
        XCTAssertEqual(actions,0)
        result.dispose()
    }
    func testFailedDurableCommitCannotPublishActionOrRetryEveryFrame() {
        let result=controller(clean:false);var attempts=0
        result.onCommit={attempts += 1;throw FixtureFailure.disk}
        result.loadViewIfNeeded();result.tick(0)
        for index in 1...30 {result.tick(Double(index)/60)}
        XCTAssertEqual(attempts,1)
        XCTAssertFalse(button(in:result.view,id:"native.result.exit")!.isUserInteractionEnabled)
        result.dispose()
    }
    func testArcadeNeverCommitsFromResultClockOrCancelledOwner() {
        let result=controller(mode:.arcade);var receipts=0;var next=0
        result.onCommit={receipts += 1};result.onAction={if case .nextRound=$0 {next += 1}}
        result.loadViewIfNeeded();result.tick(0)
        for index in 1...100 {result.tick(Double(index)/60)}
        XCTAssertEqual(receipts,0)
        result.dispose()
        for index in 101...320 {result.tick(Double(index)/60)}
        XCTAssertEqual(receipts,0);XCTAssertEqual(next,0)
    }
    func testCleanResultRelayoutPreservesZeroScaleEntryAndOutsideCardCTA() {
        let result=controller();let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        defer {result.dispose();window.isHidden=true;window.rootViewController=nil;previousWindow?.makeKeyAndVisible()}
        window.rootViewController=result;window.makeKeyAndVisible();result.loadViewIfNeeded()
        result.view.frame=window.bounds;result.view.setNeedsLayout();result.view.layoutIfNeeded()
        let primary=button(in:result.view,id:"native.result.play-again")!
        let secondary=button(in:result.view,id:"native.result.exit")!
        XCTAssertEqual(primary.bounds.size,CGSize(width:310,height:64))
        XCTAssertEqual(secondary.bounds.size,CGSize(width:310,height:64))
        XCTAssertEqual(primary.center.x,195);XCTAssertEqual(secondary.center.y-primary.center.y,80)
        XCTAssertEqual(primary.transform.a,0)
        result.tick(0)
        for index in 1...80 {result.tick(Double(index)/10)}
        let restingCenter=primary.center,restingBounds=primary.bounds
        result.view.setNeedsLayout();result.view.layoutIfNeeded()
        XCTAssertEqual(primary.center,restingCenter);XCTAssertEqual(primary.bounds,restingBounds)
        XCTAssertEqual(primary.transform.a,1);XCTAssertTrue(primary.isUserInteractionEnabled)
        attach(result.view,name:"Native Clean Board authored result")
        result.close(completion:{})
        for index in 81...90 {result.tick(Double(index)/10)}
        result.view.setNeedsLayout();result.view.layoutIfNeeded()
        XCTAssertEqual(primary.center,restingCenter);XCTAssertEqual(primary.bounds,restingBounds)
        result.dispose();window.isHidden=true;window.rootViewController=nil
    }
    func testFailedResultUsesAuthoredNativePresentationWithoutEarlyCTA() {
        let index=NativeResultHeadlines.fail.firstIndex(of:"Barely Missed!")!
        let result=controller(clean:false,headlineRandom:(Double(index)+0.5)/Double(NativeResultHeadlines.fail.count))
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        defer {result.dispose();window.isHidden=true;window.rootViewController=nil;previousWindow?.makeKeyAndVisible()}
        window.rootViewController=result;window.makeKeyAndVisible();result.loadViewIfNeeded()
        result.view.frame=window.bounds;result.view.setNeedsLayout();result.view.layoutIfNeeded()
        let primary=button(in:result.view,id:"native.result.play-again")!
        XCTAssertEqual(primary.bounds.size,CGSize(width:310,height:64));XCTAssertFalse(primary.isUserInteractionEnabled)
        result.tick(0)
        for index in 1...15 {result.tick(Double(index)/10)}
        XCTAssertTrue(primary.isUserInteractionEnabled)
        attach(result.view,name:"Native Fail authored result")
        result.dispose();window.isHidden=true;window.rootViewController=nil
    }
    func testArea55ResultActuallyConnectsSelectedShipsToItsPausedClock() async throws {
        let result=controller(board:21),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let previousWindow=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        defer {result.dispose();window.isHidden=true;window.rootViewController=nil;previousWindow?.makeKeyAndVisible()}
        window.rootViewController=result;window.makeKeyAndVisible();result.view.frame=window.bounds;result.view.layoutIfNeeded()
        if UIAccessibility.isReduceMotionEnabled {return}
        let deadline=Date().addingTimeInterval(2)
        func ships()->[UIImageView] {result.view.subviews.compactMap{$0 as? UIImageView}.filter{$0.layer.zPosition == 2 || $0.bounds.width == 62}}
        while ships().count != 2 || ships().contains(where:{$0.image == nil}) {
            guard Date()<deadline else {XCTFail("The selected original Area55 ships were not prepared and mounted");return}
            try await Task.sleep(nanoseconds:20_000_000)
        }
        result.tick(0);for index in 1...20 {result.tick(Double(index)/10)}
        let front=try XCTUnwrap(ships().first{$0.layer.zPosition == 2}),center=front.center
        attach(result.view,name:"Native Area55 result with authored ship layers")
        result.setSuspended(true);result.tick(50);XCTAssertEqual(front.center,center)
        result.dispose();XCTAssertNil(front.superview);XCTAssertNil(front.image)
    }
    func testDisposingPendingResultExitReleasesItsContinuationWithoutCallingIt() {
        let result=controller();result.loadViewIfNeeded()
        var payload:NSObject?=NSObject(),receipts=0
        weak var captured=payload
        result.close { [payload] in receipts+=1;_ = payload }
        payload=nil;XCTAssertNotNil(captured)
        result.dispose();XCTAssertNil(captured)
        result.tick(100);result.tick(101);XCTAssertEqual(receipts,0)
    }
    func testCleanReturnRetainsPaperUntilPreparedAndRejectsBackgroundPreparationReceipt() {
        let result=controller();result.loadViewIfNeeded()
        var callbacks:[(Bool)->Void]=[],closed=0
        result.close(prepareDestination:{callbacks.append($0)}) {closed += 1}
        result.tick(0);XCTAssertTrue(callbacks.isEmpty)
        result.tick(0.1);XCTAssertEqual(callbacks.count,1)
        for index in 2...30 {result.tick(Double(index)/10)}
        XCTAssertEqual(result.view.alpha,1);XCTAssertEqual(closed,0)
        result.setSuspended(true);callbacks[0](true)
        result.setSuspended(false);result.tick(4);result.tick(4.1)
        XCTAssertEqual(callbacks.count,2);callbacks[0](true)
        result.tick(4.2);XCTAssertEqual(result.view.alpha,1)
        callbacks[1](true);result.tick(4.3);result.tick(4.37)
        XCTAssertGreaterThan(result.view.alpha,0);XCTAssertLessThan(result.view.alpha,1)
        XCTAssertEqual(closed,0);result.dispose()
        callbacks[1](true);XCTAssertEqual(closed,0)
    }
    func testFailReturnUsesCollapsePaperFadeAfterReadinessWithoutCleanStaticTail() {
        let result=controller(clean:false);result.loadViewIfNeeded()
        var ready:((Bool)->Void)?
        result.close(prepareDestination:{ready=$0},completion:{})
        result.tick(0);result.tick(0.1)
        for index in 2...20 {result.tick(Double(index)/10)}
        XCTAssertEqual(result.elapsed,0.74,accuracy:0.000001)
        XCTAssertEqual(result.view.alpha,1)
        ready?(true);result.tick(2.07)
        XCTAssertLessThan(result.view.alpha,1);XCTAssertGreaterThan(result.view.alpha,0)
        result.dispose()
    }
    private func attach(_ view:UIView,name:String) {
        let image=UIGraphicsImageRenderer(bounds:view.bounds).image{_ in view.drawHierarchy(in:view.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:image);attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
    }
    private func button(in view:UIView,id:String)->UIButton? {
        if let button=view as? UIButton,button.accessibilityIdentifier==id {return button}
        return view.subviews.lazy.compactMap{self.button(in:$0,id:id)}.first
    }
}
private enum FixtureFailure:Error {case disk}
