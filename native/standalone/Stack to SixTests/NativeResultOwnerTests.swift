import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeResultOwnerTests:XCTestCase {
    func testCleanRegisterStartsOnceWithPrimaryCTAInsteadOfCounter() {
        let result=controller();var stops:[Int]=[];var cueTimes:[Double]=[]
        result.onMoment={kind,index,_ in if kind=="clean-score-stop" {stops.append(index);cueTimes.append(result.elapsed)}}
        result.loadViewIfNeeded();defer{result.dispose()}
        result.tick(0)
        XCTAssertTrue(stops.isEmpty)
        for frame in 1...396 {result.tick(Double(frame)/60)}
        XCTAssertTrue(stops.isEmpty)
        for frame in 397...420 {result.tick(Double(frame)/60)}
        XCTAssertEqual(stops,[0])
        XCTAssertEqual(cueTimes.first ?? 0,NativeResultPresentationPlan.cleanPrimaryCTAStart,accuracy:1.0/60+0.001)
        result.tick(7.1);XCTAssertEqual(stops,[0])
    }

    func testJourneyResultUsesWorldAndLocalUnitWhileArcadeKeepsRound() throws {
        func find(_ view:UIView)->UILabel? {
            if view.accessibilityIdentifier=="native.result.status" {return view as? UILabel}
            return view.subviews.lazy.compactMap{find($0)}.first
        }
        for (board,title) in [(2,"Forest 02 cleared"),(12,"Beach 02 cleared"),(22,"Area 02 cleared")] {
            let result=controller(board:board);result.loadViewIfNeeded()
            XCTAssertEqual(find(result.view)?.text,title);result.dispose()
        }
        let arcade=controller(mode:.arcade,board:2);arcade.loadViewIfNeeded()
        XCTAssertTrue(try XCTUnwrap(find(arcade.view)?.text).hasPrefix("Round "));arcade.dispose()
    }

    func testForestAmbienceFollowsActualResultMountPauseAndDisposeOnly() {
        for board in [1,11,21] {
            let result=controller(board:board)
            var events:[(Bool,Bool)]=[]
            result.onForestAmbience={events.append(($0,$1))}
            result.loadViewIfNeeded()
            if board==1 {
                XCTAssertTrue(events.last?.0 == true)
                result.setSuspended(true);XCTAssertTrue(events.last?.1 == true)
                result.setSuspended(false);XCTAssertTrue(events.last?.1 == false)
            } else {XCTAssertTrue(events.isEmpty)}
            result.dispose()
            XCTAssertFalse(events.last!.0)
            let count=events.count;result.dispose();result.setSuspended(false)
            XCTAssertEqual(events.count,count)
        }
    }

    func testForestCelebrationRetainsOriginalLeavesAndFourPausedFlightsBeforeCTA() async throws {
        let result=controller(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=result;window.makeKeyAndVisible();result.loadViewIfNeeded()
        defer {result.dispose();window.isHidden=true;window.rootViewController=nil}
        result.view.frame=window.bounds;result.view.layoutIfNeeded()
        let canvas=try XCTUnwrap(result.view.subviews.compactMap {$0 as? NativeResultConfettiCanvas}.first)
        XCTAssertEqual(canvas.plannedParticleCount,42)
        result.setSuspended(true)
        for _ in 0..<80 {
            if canvas.assetsReady {break}
            try await Task.sleep(nanoseconds:25_000_000)
        }
        XCTAssertTrue(canvas.assetsReady)
        result.setSuspended(false)
        func bees()->[UIView] {result.view.subviews.filter {$0.accessibilityIdentifier?.hasPrefix("native.result.forest.bee.")==true}}
        XCTAssertEqual(bees().count,4)
        result.tick(0)
        XCTAssertTrue(bees().allSatisfy {$0.isHidden})
        for frame in 1...60 {result.tick(Double(frame)/60)}
        XCTAssertEqual(Set(bees().map {$0.center.x}).count,4)
        XCTAssertEqual(Set(bees().map {$0.layer.zPosition}),Set([CGFloat(0.5),CGFloat(2)]))
        let renderer=UIGraphicsImageRenderer(bounds:result.view.bounds)
        try renderer.image {_ in result.view.drawHierarchy(in:result.view.bounds,afterScreenUpdates:true)}.pngData()?.write(to:URL(fileURLWithPath:"/tmp/forest-leaf-random-preview.png"))
        let positions=bees().map(\.center)
        result.setSuspended(true);result.tick(50)
        XCTAssertEqual(bees().map(\.center),positions)
        result.setSuspended(false);result.tick(50)
        for frame in 1...330 {result.tick(50+Double(frame)/60)}
        XCTAssertEqual(bees().count,4)
        XCTAssertTrue(bees().allSatisfy {$0.alpha==1},"Departure must fly out without fading")

        for frame in 331...336 {result.tick(50+Double(frame)/60)}
        result.tick(55.61)
        XCTAssertTrue(bees().isEmpty,"Bees must retire before the first CTA frame")
        XCTAssertEqual(button(in:result.view,id:"native.result.play-again")!.alpha,0)
        for frame in 337...340 {result.tick(50+Double(frame)/60)}
        XCTAssertTrue(bees().isEmpty)
        XCTAssertGreaterThan(result.elapsed,6.62)
        XCTAssertGreaterThan(button(in:result.view,id:"native.result.play-again")!.alpha,0)
        result.dispose();result.dispose()
        XCTAssertTrue(bees().isEmpty)
    }

    func testForestBeesContinuouslyHoverOnCurvedRoutesWithOpaqueOffscreenDeparture() {
        for viewport in [CGSize(width:390,height:844),CGSize(width:320,height:568)] {
            func plans(_ seed:UInt32)->[NativeResultForestBees.Plan] {
                var rng=seed
                return NativeResultForestBees.plans(viewport:viewport,random:{rng=1664525 &* rng &+ 1013904223;return Double(rng)/4294967296})
            }
            let first=plans(17),second=plans(39)
            XCTAssertEqual(first.count,4)
            XCTAssertNotEqual(first[0].phase,second[0].phase)
            XCTAssertLessThan(NativeResultForestBees.departureTime,NativeResultPresentationPlan.cleanPrimaryCTAStart)
            for (index,plan) in first.enumerated() {
                if index>0 && index<4 {XCTAssertGreaterThan(plan.anchor.y-first[index-1].anchor.y,80)}
                let entry=plan.moves[0]
                XCTAssertTrue(entry.enters)
                XCTAssertGreaterThan(entry.start,0)
                if index>0 {XCTAssertGreaterThan(entry.start-first[index-1].moves[0].start,0.2)}
                let origin=plan.sample(entry.start).point
                switch index%4 {
                case 0:XCTAssertLessThan(origin.x,-100)
                case 1:XCTAssertGreaterThan(origin.x,viewport.width+100)
                case 2:XCTAssertGreaterThan(origin.y,viewport.height+100)
                default:XCTAssertLessThan(origin.y,-100)
                }
                XCTAssertGreaterThan(plan.renderedScale(entry.start),plan.renderedScale(5.5))
                XCTAssertNotEqual(plan.anchor.x,viewport.width/2)
                for frame in 1...18 {
                    let pose=plan.sample(entry.start+entry.duration+Double(frame)/60)
                    XCTAssertFalse(pose.moving)
                    XCTAssertLessThanOrEqual(abs(pose.point.x-plan.anchor.x),40.01)
                    XCTAssertLessThanOrEqual(abs(pose.point.y-plan.anchor.y),80.01)
                    XCTAssertEqual(pose.behind,plan.startsBehind)
                }
                XCTAssertGreaterThanOrEqual(plan.moves.count,index<4 ? 4:3)
                for (moveIndex,move) in plan.moves.enumerated() {
                    XCTAssertLessThan(move.start+move.duration,NativeResultForestBees.departureTime)
                    XCTAssertNotEqual(move.control1.y,move.from.y+(move.to.y-move.from.y)*0.25)
                    if moveIndex>0 {
                        let previous=plan.moves[moveIndex-1]
                        XCTAssertLessThanOrEqual(move.start-previous.start-previous.duration,1.01)
                    }
                }
                let exit=plan.moves.last!
                XCTAssertTrue(exit.exits)
                let endpoint=plan.sample(exit.start+exit.duration).point
                XCTAssertTrue(endpoint.x < -100 || endpoint.x > viewport.width+100)
                for frame in 0..<396 {
                    let pose=plan.sample(Double(frame)/60)
                    XCTAssertTrue(pose.point.x.isFinite && pose.point.y.isFinite)
                    if plan.startsBehind {XCTAssertTrue(pose.behind)}
                }
            }
        }
    }

    func testSharedModalCTAPaintsHardEdgeAndSoftShadowWithoutDuplicatingLayers()throws {
        let root=Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
        let artwork=JimiV9Artwork(resourceRoot:root)
        for primary in [true,false] {
            let button=JimiV9PlainButton(type:.custom)
            button.frame=CGRect(x:0,y:0,width:249,height:64);button.setTitle(primary ? "Continue":"Exit",for:.normal)
            button.applyModalCTA(artwork:artwork,primary:primary);button.layoutIfNeeded()
            let layerCount=button.layer.sublayers?.count
            button.applyModalCTA(artwork:artwork,primary:primary);button.layoutIfNeeded()
            XCTAssertEqual(button.layer.sublayers?.count,layerCount)
            XCTAssertEqual(button.layer.cornerRadius,32);XCTAssertEqual(button.titleLabel?.font.pointSize,28)
            XCTAssertEqual(button.titleLabel?.shadowOffset.height,primary ? 2:0)
            let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=false
            let image=UIGraphicsImageRenderer(size:CGSize(width:337,height:152),format:format).image {
                $0.cgContext.translateBy(x:44,y:44);button.layer.render(in:$0.cgContext)
            }
            let cg=try XCTUnwrap(image.cgImage),data=cg.dataProvider!.data! as Data
            func alpha(_ x:Int,_ y:Int)->UInt8 {data[y*cg.bytesPerRow+x*4+3]}
            XCTAssertEqual(alpha(168,112),255,"PWA's solid8px edge remains opaque")
            XCTAssertGreaterThan(alpha(168,125),0,"PWA's second soft shadow must actually paint")
            XCTAssertLessThan(alpha(168,125),70)
            try image.pngData()?.write(to:URL(fileURLWithPath:primary ? "/tmp/native-modal-primary-cta.png":"/tmp/native-modal-secondary-cta.png"))
        }
    }

    func testZeroScaleFilledStarsRetainImageBoundsAcrossInitialRelayout() {
        let result=controller(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=result;window.makeKeyAndVisible();result.loadViewIfNeeded()
        defer {result.dispose();window.isHidden=true;window.rootViewController=nil}
        result.view.frame=window.bounds
        result.view.setNeedsLayout();result.view.layoutIfNeeded()
        func find(_ root:UIView,_ id:String)->UIView? {
            if root.accessibilityIdentifier==id{return root}
            return root.subviews.compactMap{find($0,id)}.first
        }
        for index in 0..<3 {
            let gold=find(result.view,"native.result.star.filled.\(index)") as! UIImageView
            XCTAssertNotNil(gold.image);XCTAssertGreaterThan(gold.bounds.width,0)
            XCTAssertGreaterThan(gold.bounds.height,0);XCTAssertEqual(gold.transform.a,0)
        }
        result.tick(0);for index in 1...30 {result.tick(Double(index)/10)}
        result.view.setNeedsLayout();result.view.layoutIfNeeded()
        for index in 0..<3 {XCTAssertGreaterThan(find(result.view,"native.result.star.filled.\(index)")!.bounds.width,0)}
        let primary=button(in:result.view,id:"native.result.play-again")!
        let secondary=button(in:result.view,id:"native.result.exit")!
        XCTAssertEqual(primary.layer.shadowOffset,CGSize(width:0,height:8))
        XCTAssertEqual(secondary.backgroundColor,.white);XCTAssertEqual(secondary.layer.borderWidth,1)
    }
    func testCleanScoreUsesPlainIntegerWithoutGroupingSeparator() {
        let root=Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
        let state=NativeBoardState(tiles:[],mode:.journey,board:1,score:1234)
        let result=NativeResultController(root:root,state:state,clean:true,combo:0,efficiency:0,finalScore:1234)
        result.loadViewIfNeeded();defer {result.dispose()}
        result.tick(0);for index in 1...80 {result.tick(Double(index)/10)}
        func find(_ root:UIView)->UILabel? {
            if root.accessibilityIdentifier=="native.result.score" {return root as? UILabel}
            return root.subviews.compactMap{find($0)}.first
        }
        XCTAssertEqual(find(result.view)?.text,"1234")
    }
    private func controller(clean:Bool=true,mode:NativeRunMode = .journey,board:Int=1,headlineRandom:Double=0)->NativeResultController {
        let root=Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!
        let state=NativeBoardState(tiles:[],mode:mode,board:board,score:100)
        return NativeResultController(root:root,state:state,clean:clean,combo:50,efficiency:500,finalScore:650,headlineRandom:headlineRandom)
    }
    func testResultPrimaryAndExitEmitDistinctAcceptedActionCues() throws {
        for (id,cue) in [("native.result.play-again","cta"),("native.result.exit","back")] {
            let result=controller(clean:false),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            window.rootViewController=result;window.makeKeyAndVisible();result.loadViewIfNeeded()
            defer{result.dispose();window.isHidden=true;window.rootViewController=nil}
            result.tick(0);for index in 1...20 {result.tick(Double(index)/10)}
            var cues:[String]=[];result.onMoment={kind,_,_ in cues.append(kind)}
            let action=try XCTUnwrap(button(in:result.view,id:id))
            action.sendActions(for:.touchUpInside);action.sendActions(for:.touchUpInside)
            XCTAssertEqual(cues,[cue])
        }
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
        XCTAssertEqual(primary.bounds.size,CGSize(width:249,height:64))
        XCTAssertEqual(secondary.bounds.size,CGSize(width:249,height:64))
        XCTAssertEqual(primary.layer.cornerRadius,32);XCTAssertEqual(secondary.layer.cornerRadius,32)
        XCTAssertEqual((primary as! JimiV9PlainButton).cartoonBounceLayoutView.center.x,195);XCTAssertEqual((secondary as! JimiV9PlainButton).cartoonBounceLayoutView.center.y-(primary as! JimiV9PlainButton).cartoonBounceLayoutView.center.y,80)
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
        XCTAssertEqual(primary.bounds.size,CGSize(width:249,height:64));XCTAssertFalse(primary.isUserInteractionEnabled)
        XCTAssertEqual(primary.layer.cornerRadius,32)
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
