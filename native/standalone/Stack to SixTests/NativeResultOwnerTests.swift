import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeResultOwnerTests:XCTestCase {
    func testCleanBoardTitleSpeechUsesTheDisplayedSelectionOnceAtTitleEntry() {
        for index in [0,73,113] {
            let result=controller(board:12,headlineRandom:(Double(index)+0.5)/Double(NativeResultHeadlines.clean.count))
            var events:[(String,Int,Double)]=[]
            result.onMoment={kind,selected,_ in if kind.hasPrefix("clean-title") {events.append((kind,selected,result.elapsed))}}
            result.loadViewIfNeeded()
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=result;window.makeKeyAndVisible()
            XCTAssertEqual(events.map{$0.0},["clean-title-prepare"])
            result.tick(0);result.tick(0.1);result.tick(0.2)
            XCTAssertFalse(events.contains{$0.0=="clean-title"})
            result.tick(0.23);result.tick(0.33);result.tick(0.43)
            let spoken=events.filter{$0.0=="clean-title"}
            XCTAssertEqual(spoken.count,1);XCTAssertEqual(spoken.first?.1,index)
            XCTAssertGreaterThanOrEqual(spoken.first?.2 ?? 0,0.22)
            let label=findUILabels(result.view).first{$0.attributedText?.string==NativeResultHeadlines.clean[index]}
            XCTAssertNotNil(label,"The spoken index is the actual displayed title")
            result.setSuspended(true);result.tick(20);result.setSuspended(false);result.tick(21);result.tick(21.1)
            XCTAssertEqual(events.filter{$0.0=="clean-title"}.count,1)
            result.dispose();result.tick(22);window.isHidden=true;window.rootViewController=nil
        }
        let failed=controller(clean:false);var voices=0
        failed.onMoment={kind,_,_ in if kind.hasPrefix("clean-title"){voices+=1}}
        failed.loadViewIfNeeded();failed.tick(0);for frame in 1...40 {failed.tick(Double(frame)/60)}
        XCTAssertEqual(voices,0);failed.dispose()
    }
    private func findUILabels(_ view:UIView)->[UILabel] {
        (view as? UILabel).map{[$0]} ?? view.subviews.flatMap{findUILabels($0)}
    }
    func testOnlyTutorialJourneyContinueUsesPreparedReturnInsteadOfNextUnit()async throws {
        for tutorialRun in [true,false] {
            var state=NativeBoardState(tiles:[],mode:.journey,board:11)
            if tutorialRun {var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true;state.tutorial=tutorial}
            let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root)
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
            var exits=0,next=0,preparations=0
            let owner=NativeResultOwner(gameplay:game,root:NativeTestResources.root,resolution:NativeResolution(.complete,reason:"clean"),commit:{_ in},restart:{},continueArcade:{},exit:{exits+=1},continueJourney:{next+=1})
            owner.prepareExit={done in preparations+=1;done(true)}
            owner.present()
            let modal=try XCTUnwrap(game.presentedViewController as? NativeResultController)
            modal.tick(0);for frame in 1...600 {modal.tick(Double(frame)/60)}
            modal.onAction?(.nextJourney)
            for frame in 601...720 {modal.tick(Double(frame)/60)}
            let deadline=Date().addingTimeInterval(2)
            while exits+next==0 && Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
            XCTAssertEqual(exits,tutorialRun ? 1:0);XCTAssertEqual(next,tutorialRun ? 0:1)
            XCTAssertEqual(preparations,tutorialRun ? 1:0)
            owner.dispose();game.dispose();window.isHidden=true
        }
    }

    func testPreparedResultStaysQuietUntilVisibleHandoffAndRetires() {
        let state=NativeBoardState(tiles:[],mode:.journey,board:12)
        var commits=0,cues=0
        var result:NativeResultController?=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:0,efficiency:500,finalScore:1000,arcadeCelebrationPresented:true)
        weak var retired=result
        result?.onCommit={commits+=1};result?.onMoment={_,_,_ in cues+=1}
        result?.prepareForHandoff(viewport:CGSize(width:390,height:844))
        let start=result?.elapsed
        result?.tick(100);result?.tick(110)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        result?.tick(120)
        XCTAssertEqual(result?.elapsed,start);XCTAssertEqual(commits,0);XCTAssertEqual(cues,0)
        result?.admitPreparedHandoff()
        XCTAssertEqual(commits,1);XCTAssertGreaterThan(cues,0)
        XCTAssertEqual(result?.elapsed,NativeResultPresentationPlan.cleanAfterClearedStart)
        result?.dispose();result?.dispose();result=nil;XCTAssertNil(retired)
    }

    func testClearedKeepsItsVisibleExitUntilSuccessorIsReadyThenCompletesOnce() {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let cleared=NativeArcadeRoundPresentation(resourceRoot:NativeTestResources.root,clearedRound:1,nextRound:2,boardClearedOnly:true)
        cleared.frame=window.bounds;host.view.addSubview(cleared)
        var ready=false,finished=0;cleared.permitsBoardClearedExit={ready};cleared.onFinished={if $0{finished+=1}}
        cleared.start();cleared.advanceFrame(timestamp:100);cleared.advanceFrame(timestamp:110)
        XCTAssertEqual(finished,0);XCTAssertNotNil(cleared.superview)
        XCTAssertLessThan(cleared.elapsed,cleared.duration-0.29)
        ready=true;cleared.advanceFrame(timestamp:110.31)
        XCTAssertEqual(finished,1);XCTAssertNil(cleared.superview)
        cleared.advanceFrame(timestamp:120);XCTAssertEqual(finished,1)
    }

    func testArcadeReachedExitKeepsGreyStarsVisibleThenAnimatesThemOut() throws {
        func find(_ view:UIView,_ id:String)->UIView? {
            if view.accessibilityIdentifier==id{return view}
            return view.subviews.lazy.compactMap{find($0,id)}.first
        }
        let thresholds=NativeJourneyContent.starThresholds(board:2)
        for score in [1500,thresholds.two,thresholds.three] {
            let state=NativeBoardState(tiles:[],mode:.arcade,board:2,stage:2,score:score)
            let result=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:0,efficiency:0,finalScore:score,arcadeReached:true)
            result.loadViewIfNeeded();defer{result.dispose()}
            result.tick(0)
            for frame in 1...480 {result.tick(Double(frame)/60)}
            let earned=NativeJourneyContent.earnedStars(score:score,board:2)
            let grey=try (0..<3).map{try XCTUnwrap(find(result.view,"native.result.star.empty.\($0)"))}
            let before=grey.map(\.alpha)
            result.close(completion:{})
            result.tick(8+1.0/60)
            for index in 0..<3 {XCTAssertEqual(grey[index].alpha,before[index],accuracy:0.001,"Exit must not instantly hide a grey star")}
            for frame in 482...496 {result.tick(Double(frame)/60)}
            for index in earned..<3 {
                XCTAssertGreaterThan(grey[index].alpha,0)
                XCTAssertNotEqual(grey[index].transform,.identity)
            }
            for frame in 497...535 {result.tick(Double(frame)/60)}
            for index in earned..<3 {XCTAssertEqual(grey[index].alpha,0)}
        }
    }

    func testPostClearedCleanResultStartsWithReadableHeroWithoutBlankAnticipation() throws {
        let state=NativeBoardState(tiles:[],mode:.journey,board:2)
        let result=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:0,efficiency:500,finalScore:1000,arcadeCelebrationPresented:true)
        result.loadViewIfNeeded()
        defer{result.dispose()}
        XCTAssertEqual(result.elapsed,NativeResultPresentationPlan.cleanAfterClearedStart)
        let pose=NativeResultPresentationPlan.sample(seconds:result.elapsed,clean:true,baseScore:0,combo:0,efficiency:500)
        XCTAssertGreaterThan(pose.hero.opacity,0.1)
        XCTAssertGreaterThan(pose.title.opacity,0)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=result;window.makeKeyAndVisible()
        defer{window.isHidden=true}
        result.view.frame=window.bounds;result.view.setNeedsLayout();result.view.layoutIfNeeded()
        let image=UIGraphicsImageRenderer(size:window.bounds.size).image {result.view.layer.render(in:$0.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-clean-immediate-first-frame.png"))
    }

    func testInterimRewardResultSkipsInvisibleOpeningAfterClearedOwnerRetires() {
        let state=NativeBoardState(tiles:[],mode:.journey,board:21)
        let result=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:0,efficiency:500,finalScore:1000,interimJourney:true,arcadeCelebrationPresented:false)
        result.loadViewIfNeeded();defer{result.dispose()}
        XCTAssertEqual(result.elapsed,NativeResultPresentationPlan.cleanAfterClearedStart)
        let pose=NativeResultPresentationPlan.sample(seconds:result.elapsed,clean:true,baseScore:0,combo:0,efficiency:500)
        XCTAssertGreaterThan(pose.hero.opacity,0.1);XCTAssertGreaterThan(pose.title.opacity,0)
    }

    func testFasterCleanCounterAudioWindowsAndFinalScoreRemainSynchronized() {
        let state=NativeBoardState(tiles:[],mode:.journey,board:1,score:1500)
        let result=NativeResultController(root:NativeTestResources.root,state:state,clean:true,combo:725,efficiency:500,finalScore:2725)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=result;window.makeKeyAndVisible()
        defer{result.dispose();window.isHidden=true;window.rootViewController=nil}
        var counters:[(String,Double,Double)]=[]
        result.onMoment={kind,_,duration in if kind=="clean-count" || kind=="clean-bonus" {counters.append((kind,result.elapsed,duration ?? -1))}}
        result.view.frame=window.bounds;result.view.layoutIfNeeded();result.tick(0)
        for frame in 1...720 {result.tick(Double(frame)/120)}
        XCTAssertEqual(counters.count,3)
        for (event,start) in zip(counters,[0.47,NativeResultPresentationPlan.cleanComboStart,NativeResultPresentationPlan.cleanEfficiencyStart]) {
            XCTAssertEqual(event.1,start,accuracy:1.0/120+0.001)
            XCTAssertGreaterThan(event.2,0);XCTAssertLessThanOrEqual(event.2,1.2+0.000001)
        }
        XCTAssertEqual(counters.first!.2,1.2,accuracy:0.000001)
        let complete=NativeResultPresentationPlan.sample(seconds:5.3,clean:true,baseScore:1500,combo:725,efficiency:500)
        XCTAssertEqual(complete.displayedScore,2725);XCTAssertEqual(complete.displayedCombo,0);XCTAssertEqual(complete.displayedEfficiency,0)
        XCTAssertEqual(6.62-NativeResultPresentationPlan.cleanPrimaryCTAStart,1.23,accuracy:0.001)
    }
    func testCleanRegisterStartsOnceWithPrimaryCTAInsteadOfCounter() {
        let result=controller();var stops:[Int]=[];var cueTimes:[Double]=[]
        result.onMoment={kind,index,_ in if kind=="clean-score-stop" {stops.append(index);cueTimes.append(result.elapsed)}}
        result.loadViewIfNeeded();defer{result.dispose()}
        result.tick(0)
        XCTAssertTrue(stops.isEmpty)
        let beforeFrame=Int(floor(NativeResultPresentationPlan.cleanPrimaryCTAStart*60))
        for frame in 1...beforeFrame {result.tick(Double(frame)/60)}
        XCTAssertTrue(stops.isEmpty)
        for frame in (beforeFrame+1)...(beforeFrame+24) {result.tick(Double(frame)/60)}
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
        var timestamp=50.0
        func advance(to target:Double) {
            while result.elapsed<target-0.000001 {
                timestamp+=min(1.0/120,target-result.elapsed)
                result.tick(timestamp)
            }
        }
        advance(to:NativeResultForestBees.departureTime-0.01)
        XCTAssertEqual(bees().count,4)
        XCTAssertTrue(bees().allSatisfy {$0.alpha==1},"Departure must fly out without fading")
        advance(to:NativeResultForestBees.departureTime+0.001)
        XCTAssertTrue(bees().isEmpty,"Bees must retire before the first CTA frame")
        XCTAssertEqual(button(in:result.view,id:"native.result.play-again")!.alpha,0)
        advance(to:NativeResultPresentationPlan.cleanPrimaryCTAStart+0.06)
        XCTAssertTrue(bees().isEmpty)
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

    func testCleanAndFailButtonsMatchHomeDimensionsAtPhoneWidths() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for width in [CGFloat(320),390,430] {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:width,height:844))
            let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
            let home=JimiV9HomeView(frame:window.bounds,assets:artwork)
            host.view.addSubview(home);home.layoutIfNeeded()
            let expected=home.ctaView.bounds.size
            for clean in [false,true] {
                let result=NativeResultController(root:NativeTestResources.root,state:NativeBoardState(tiles:[],mode:.journey,board:1),clean:clean,combo:0,efficiency:0,finalScore:0)
                window.rootViewController=result;result.view.frame=window.bounds;result.view.layoutIfNeeded()
                result.tick(0)
                for frame in 1...720 {result.tick(Double(frame)/60)}
                func actions(_ view:UIView)->[JimiV9PlainButton] {
                    (view as? JimiV9PlainButton).map{[$0]} ?? view.subviews.flatMap{actions($0)}
                }
                let buttons=actions(result.view).filter{["Play Again","Exit"].contains($0.title(for:.normal) ?? "")}
                XCTAssertEqual(buttons.count,2)
                for button in buttons {
                    XCTAssertEqual(button.bounds.width,expected.width,accuracy:0.001)
                    XCTAssertEqual(button.bounds.height,expected.height,accuracy:0.001)
                    XCTAssertEqual(button.titleLabel?.font.pointSize,28)
                }
                if width==390 {
                    let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
                    try image.pngData()?.write(to:URL(fileURLWithPath:clean ? "/tmp/cta-result-home-clean.png":"/tmp/cta-result-home-fail.png"))
                }
                result.dispose()
            }
            window.isHidden=true;window.rootViewController=nil
        }
    }
    func testSharedPrimarySculptedCTAIsStableDistinctAndUpdatesLiveTitles() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        var images:[Data]=[]
        for (index,id) in ["native.world.card.play","native.arcade.play","native.result.play-again","native.tutorial.got-it"].enumerated() {
            let button=JimiV9PlainButton(frame:CGRect(x:50,y:CGFloat(100+index*130),width:249,height:64))
            button.accessibilityIdentifier=id;button.setTitle("Continue",for:.normal)
            host.view.addSubview(button);button.applyModalCTA(artwork:artwork)
            button.bounds=CGRect(origin:.zero,size:button.primaryCTASize(maxWidth:300));button.layoutIfNeeded()
            let count=button.subviews.count
            button.applyModalCTA(artwork:artwork);button.layoutIfNeeded()
            XCTAssertEqual(button.subviews.count,count,"Reapplying never duplicates surfaces")
            XCTAssertEqual(button.bounds.height,80.64)
            XCTAssertEqual(button.titleLabel?.font.pointSize,28)
            XCTAssertEqual(button.titleLabel!.center.y,37.52,accuracy:0.01)
            XCTAssertNil(button.backgroundImage(for:.normal))
            XCTAssertFalse(button.layer.sublayers?.contains{$0.name=="native.cta.shimmer"} ?? false)
            XCTAssertTrue(button.point(inside:CGPoint(x:124,y:32),with:nil))
            let format=UIGraphicsImageRendererFormat();format.scale=1
            func snapshot()->Data {UIGraphicsImageRenderer(size:button.bounds.size,format:format).image{button.layer.render(in:$0.cgContext)}.pngData()!}
            let first=snapshot();button.setNeedsLayout();button.layoutIfNeeded();XCTAssertEqual(first,snapshot())
            images.append(first)
            button.setTitle("Play Again",for:.normal);button.bounds=CGRect(origin:.zero,size:button.primaryCTASize(maxWidth:300));button.layoutIfNeeded()
            XCTAssertEqual(button.attributedTitle(for:.normal)?.string,"Play Again")
            for label in button.subviews.compactMap({$0 as? UILabel}) {XCTAssertEqual(label.attributedText?.string,"Play Again")}
            XCTAssertEqual(button.accessibilityIdentifier,id)
        }
        XCTAssertEqual(Set(images).count,4,"Same title/material still has a subtle distinct contour per role")
        let image=UIGraphicsImageRenderer(size:window.bounds.size).image{_ in host.view.drawHierarchy(in:host.view.bounds,afterScreenUpdates:true)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-shared-sculpted-ctas.png"))
    }

    func testMainCTASizesMatchJourneyTextPaddingAndJourneyCardKeepsItsWidth() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let font=artwork.font(size:28,weight:"ExtraBold")
        let reference=("Journey" as NSString).size(withAttributes:[.font:font]).width/(176*1.05)
        for text in ["Journey","Arcade","Settings","Play","Continue","Play Again","Got it!","Restart"] {
            let button=JimiV9PlainButton(type:.custom);button.setTitle(text,for:.normal);button.applyModalCTA(artwork:artwork)
            let size=button.primaryCTASize(maxWidth:400)
            XCTAssertEqual(size.height,80.64)
            XCTAssertEqual((text as NSString).size(withAttributes:[.font:font]).width/size.width,reference,accuracy:0.0001)
        }
    }

    func testPrimaryCTASmoothSilhouetteAndTextAtDisplayDensity() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;host.view.backgroundColor=UIColor(red:0.98,green:0.95,blue:0.9,alpha:1)
        window.makeKeyAndVisible();defer{window.isHidden=true;window.rootViewController=nil}
        for (index,title) in ["Restart","Journey","Settings"].enumerated() {
            let button=JimiV9PlainButton(frame:CGRect(x:50,y:150+CGFloat(index)*150,width:249,height:72))
            button.setTitle(title,for:.normal);button.accessibilityIdentifier="native.qa.cta.\(title)"
            host.view.addSubview(button);button.applyModalCTA(artwork:artwork)
            button.bounds=CGRect(origin:.zero,size:button.primaryCTASize(maxWidth:300))
            button.center=CGPoint(x:195,y:186+CGFloat(index)*150);button.layoutIfNeeded()
            let face=try XCTUnwrap(button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
            for surface in [face]+button.subviews.compactMap({$0 as? UILabel}) {
                XCTAssertEqual(surface.contentScaleFactor,window.screen.scale*2)
                XCTAssertFalse(surface.layer.shouldRasterize,"No low-density flattened parent cache")
            }
            let format=UIGraphicsImageRendererFormat();format.scale=window.screen.scale;format.opaque=false
            let image=UIGraphicsImageRenderer(size:face.bounds.size,format:format).image{face.layer.render(in:$0.cgContext)}
            let cg=try XCTUnwrap(image.cgImage),w=cg.width,h=cg.height
            var pixels=[UInt8](repeating:0,count:w*h*4)
            let partial=pixels.withUnsafeMutableBytes { bytes -> Int in
                let context=CGContext(data:bytes.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,
                    space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                context.draw(cg,in:CGRect(x:0,y:0,width:CGFloat(w),height:CGFloat(h)))
                let data=bytes.bindMemory(to:UInt8.self)
                return (w/4..<w*3/4).filter { x in
                    (0..<Int(5*window.screen.scale)).contains { y in
                        let alpha=data[(y*w+x)*4+3];return alpha>8 && alpha<247
                    }
                }.count
            }
            print("[CTA edge coverage] \(title): \(partial)/\(w/2) columns, displayScale=\(window.screen.scale)")
            XCTAssertGreaterThan(partial,w/5,"Shallow upper curve retains fractional edge coverage instead of opaque steps")
            if index==1 {button.transform=CGAffineTransform(rotationAngle:0.015).scaledBy(x:1.025,y:1.025)}
        }
        let snapshot=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try snapshot.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-cta-antialiasing.png"))
    }

    func testSharedCTARestylesSecondaryAndRemovalWithoutRetainingPaint() async throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let button=JimiV9PlainButton(frame:CGRect(x:0,y:0,width:249,height:64))
        weak var face:UIView?
        autoreleasepool {
            button.setTitle("Continue",for:.normal);button.applyModalCTA(artwork:artwork);button.layoutIfNeeded()
            face=button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"}
            XCTAssertNotNil(face)
            button.applyModalCTA(artwork:artwork,primary:false);button.layoutIfNeeded()
            XCTAssertTrue(face === button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
            if let face {
                let image=UIGraphicsImageRenderer(size:face.bounds.size).image{face.layer.render(in:$0.cgContext)}
                let cg=image.cgImage!,w=cg.width,h=cg.height
                var pixels=[UInt8](repeating:0,count:w*h*4)
                pixels.withUnsafeMutableBytes { bytes in
                    let context=CGContext(data:bytes.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,
                        space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.draw(cg,in:CGRect(x:0,y:0,width:w,height:h))
                    let data=bytes.bindMemory(to:UInt8.self),center=(h/3*w+w/2)*4
                    XCTAssertGreaterThanOrEqual(data[center],250)
                    XCTAssertGreaterThanOrEqual(data[center+1],250)
                    XCTAssertGreaterThanOrEqual(data[center+2],250,"Secondary front core is white")
                }
            }
            XCTAssertEqual(button.backgroundColor,.clear);XCTAssertEqual(button.layer.shadowOpacity,0)
            XCTAssertEqual(button.subviews.filter{$0.accessibilityIdentifier=="native.cta.title-inner-outline"}.count,0)
            button.setTitle("Exit Game",for:.normal);button.layoutIfNeeded()
            XCTAssertEqual(button.attributedTitle(for:.normal)?.string,"Exit Game")
            XCTAssertEqual(button.titleLabel!.center.y,button.bounds.midY-4.8+2,accuracy:0.01)
            button.applyModalCTA(artwork:artwork);button.removeModalCTAPaint();button.removeModalCTAPaint()
        }
        CATransaction.flush();try await Task.sleep(nanoseconds:30_000_000)
        XCTAssertNil(face)
        XCTAssertFalse(button.subviews.contains{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
        XCTAssertNil(button.attributedTitle(for:.normal));XCTAssertEqual(button.layer.shadowOpacity,0)
    }

    func testSharedCTAPaintReleasesAcrossHiddenBackgroundAndReopen() async throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for _ in 0..<5 {
            weak var released:JimiV9PlainButton?,releasedFace:UIView?
            autoreleasepool {
                let button=JimiV9PlainButton(frame:CGRect(x:0,y:0,width:226,height:64))
                button.setTitle("Continue",for:.normal);button.applyModalCTA(artwork:artwork,primary:false);button.layoutIfNeeded()
                released=button;releasedFace=button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"}
                button.isHidden=true;button.isHidden=false;button.isEnabled=false;button.isEnabled=true
                NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
                NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
                XCTAssertNil(releasedFace?.layer.animationKeys(),"Static paint creates no recurring work")
            }
            CATransaction.flush();try await Task.sleep(nanoseconds:30_000_000)
            XCTAssertNil(released);XCTAssertNil(releasedFace)
        }
    }
    func testModalCTAIdleFloatsIndependentlyAndStopsWhenHiddenOrBackgrounded() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
        defer {window.isHidden=true}
        for primary in [true,false] {
            let button=JimiV9PlainButton(frame:CGRect(x:82,y:250,width:226,height:72))
            button.setTitle(primary ? "Play":"Exit",for:.normal)
            host.view.addSubview(button);button.applyModalCTA(artwork:artwork,primary:primary)
            let key=JimiV9PlainButton.modalIdleKey
            let idle=try XCTUnwrap(button.layer.animation(forKey:key) as? CAKeyframeAnimation)
            XCTAssertEqual(idle.keyPath,"sublayerTransform")
            XCTAssertEqual(idle.repeatCount,.infinity)
            XCTAssertTrue(CATransform3DIsIdentity(button.layer.transform))
            func degrees(_ transform:CATransform3D)->CGFloat {atan2(transform.m12,transform.m11)*180 / .pi}
            let resting=degrees(button.layer.sublayerTransform)
            XCTAssertGreaterThanOrEqual(abs(resting),0)
            XCTAssertLessThanOrEqual(abs(resting),1.6+0.001)
            let poses=try XCTUnwrap(idle.values as? [NSValue]).map{$0.caTransform3DValue}
            XCTAssertEqual(poses.count,3)
            XCTAssertEqual(degrees(poses[0]),resting,accuracy:0.001)
            XCTAssertEqual(degrees(poses[2]),resting,accuracy:0.001)
            XCTAssertLessThanOrEqual(abs(degrees(poses[1])),3.001)
            button.isHidden=true;XCTAssertNil(button.layer.animation(forKey:key))
            XCTAssertEqual(degrees(button.layer.sublayerTransform),resting,accuracy:0.001)
            button.isHidden=false;XCTAssertNotNil(button.layer.animation(forKey:key))
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            XCTAssertNil(button.layer.animation(forKey:key))
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            XCTAssertNotNil(button.layer.animation(forKey:key))
            button.removeModalCTAPaint();XCTAssertNil(button.layer.animation(forKey:key))
            XCTAssertTrue(CATransform3DIsIdentity(button.layer.sublayerTransform))
            button.applyModalCTA(artwork:artwork,primary:primary)
            XCTAssertEqual(button.layer.animationKeys()?.filter{$0==key}.count,1)
            XCTAssertEqual(degrees(button.layer.sublayerTransform),resting,accuracy:0.001)
            button.removeFromSuperview();XCTAssertNil(button.layer.animation(forKey:key))
        }
    }

    @MainActor func testStackedCTAContentHasBoundedSubtleIdleAcrossRelayoutOrForeground() throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
        defer {window.isHidden=true}
        let buttons=[JimiV9PlainButton(type:.custom),JimiV9PlainButton(type:.custom)]
        for (index,button) in buttons.enumerated() {
            button.frame=CGRect(x:70,y:250+index*88,width:249,height:80)
            button.setTitle(index == 0 ? "Play Again":"Exit",for:.normal)
            host.view.addSubview(button);button.applyModalCTA(artwork:artwork,primary:index == 0)
            button.setPairedModalCTA();button.layoutIfNeeded()
        }
        let rest=buttons.map{$0.layer.sublayerTransform}
        for _ in 0..<3 {
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            for (index,button) in buttons.enumerated() {
                button.setNeedsLayout();button.layoutIfNeeded()
                let idle=try XCTUnwrap(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey) as? CAKeyframeAnimation)
                let poses=try XCTUnwrap(idle.values as? [NSValue]).map{$0.caTransform3DValue}
                XCTAssertEqual(poses.count,3)
                XCTAssertGreaterThan(poses[1].m42,0)
                XCTAssertLessThanOrEqual(poses[1].m42,1.2)
                XCTAssertLessThanOrEqual(abs(poses[1].m41),1.8)
                XCTAssertLessThanOrEqual(hypot(poses[1].m11,poses[1].m12),1.0091)
                XCTAssertTrue(CATransform3DEqualToTransform(button.layer.sublayerTransform,rest[index]))
                XCTAssertEqual(button.layer.sublayerTransform.m42,0)
            }
            XCTAssertEqual(buttons[1].frame.minY-buttons[0].frame.maxY,8)
        }
        for button in buttons {
            button.setModalCTAIdleSuspended(true);XCTAssertNil(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey))
            button.layoutIfNeeded();XCTAssertNil(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey))
            button.setModalCTAIdleSuspended(false);XCTAssertNotNil(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey))
            button.isHidden=true;XCTAssertNil(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey))
            button.isHidden=false;XCTAssertNotNil(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey))
            button.removeFromSuperview();XCTAssertNil(button.layer.animation(forKey:JimiV9PlainButton.modalIdleKey))
        }
    }

    @MainActor func testRestoredOrangeShimmerUsesWideFullHeightSweepAndRetires() throws {
        let root=try XCTUnwrap(Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle"))
        let artwork=JimiV9Artwork(resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        let button=JimiV9PlainButton(frame:CGRect(x:60,y:200,width:240,height:80));button.setTitle("Continue",for:.normal)
        host.view.addSubview(button);button.applyModalCTA(artwork:artwork);button.layoutIfNeeded()
        let face=try XCTUnwrap(button.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
        let shimmer=try XCTUnwrap(face.layer.sublayers?.first{$0.name==NativeCTAShimmer.animationKey})
        XCTAssertNotNil(face.layer.mask,"Sweep must respect the actual sculpted silhouette")
        XCTAssertNotNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        let band=try XCTUnwrap(shimmer.mask)
        XCTAssertEqual(band.bounds.width,button.bounds.width*1.62,accuracy:0.001)
        XCTAssertGreaterThan(band.bounds.height,button.bounds.height*3)
        button.isHidden=true;XCTAssertNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        button.isHidden=false;XCTAssertNotNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertNotNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        button.isEnabled=false;XCTAssertNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        button.isEnabled=true;XCTAssertNotNil(shimmer.animation(forKey:NativeCTAShimmer.animationKey))
        button.applyModalCTA(artwork:artwork,primary:false)
        XCTAssertFalse(face.layer.sublayers?.contains{$0.name==NativeCTAShimmer.animationKey} ?? false)
        button.applyModalCTA(artwork:artwork);button.layoutIfNeeded()
        let renewed=try XCTUnwrap(face.layer.sublayers?.first{$0.name==NativeCTAShimmer.animationKey})
        button.removeFromSuperview();XCTAssertNil(renewed.animation(forKey:NativeCTAShimmer.animationKey))
    }
    @MainActor func testHomeSculptedStyleKeepsOneVisibleShimmerAcrossSlides() async throws {
        let artwork=JimiV9Artwork(resourceRoot:Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),vc=UIViewController()
        window.rootViewController=vc;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        let home=JimiV9HomeView(frame:vc.view.bounds,assets:artwork);vc.view.addSubview(home);home.layoutIfNeeded()
        func activeCount(_ view:UIView)->Int {
            let own=view.layer.sublayers?.filter{$0.name=="native.cta.shimmer" && $0.animation(forKey:"native.cta.shimmer") != nil}.count ?? 0
            return own+view.subviews.reduce(0){$0+activeCount($1)}
        }
        XCTAssertEqual(activeCount(home),1,"Only the visible Home CTA owns its finite shimmer cycle")
        XCTAssertNil(home.ctaView.backgroundImage(for:.normal),"The treatment is native vector paint, not a PNG")
        XCTAssertNotNil(home.ctaView.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
        home.selectSlide(2,animated:false)
        let settingsSize=home.ctaView.bounds.size
        let referenceWidth=try XCTUnwrap(home.ctaView as? JimiV9PlainButton).primaryCTASize(maxWidth:342).width
        XCTAssertEqual(settingsSize.width,min(342,referenceWidth*1.10)*0.96,accuracy:0.001,"Add 5% of reference width to each side without scaling the text")
        XCTAssertGreaterThan(settingsSize.width,176)
        XCTAssertEqual(settingsSize.height,80.64*0.96)
        for slide in 0...2 {
            home.selectSlide(slide,animated:false)
            XCTAssertEqual(home.ctaView.bounds.size,settingsSize,"Every Home CTA keeps the Settings width")
            let pose=home.ctaView.layer.sublayerTransform
            let tilt=atan2(pose.m12,pose.m11)*180 / CGFloat.pi
            XCTAssertGreaterThanOrEqual(abs(tilt),0)
            XCTAssertLessThanOrEqual(abs(tilt),1.6+0.001,"The Home CTA has a stable slight lean while its idle shell floats")
        }
        home.selectSlide(0,animated:false)
        XCTAssertEqual(home.ctaView.titleLabel?.font.pointSize,28)
        home.ctaView.layoutIfNeeded()
        XCTAssertEqual(home.ctaView.titleLabel!.center.y,home.ctaView.bounds.midY-4.8+2,accuracy:0.01,"Title centers in the lit face, excluding lower depth")
        XCTAssertEqual(home.ctaView.titleLabel?.layer.shadowOpacity,0,"No separate layer shadow owner")
        XCTAssertNil(home.ctaView.attributedTitle(for:.normal)?.attribute(.strokeWidth,at:0,effectiveRange:nil),"Live glyphs have no thickening stroke")
        XCTAssertFalse(home.ctaView.subviews.contains{$0.accessibilityIdentifier=="native.cta.title-outline" || $0.accessibilityIdentifier=="native.cta.title-inner-outline"},"Clean live glyphs must not acquire outline layers that bridge lowercase i")
        XCTAssertEqual(home.ctaView.accessibilityLabel ?? home.ctaView.title(for:.normal),"Journey")
        try await Task.sleep(nanoseconds:100_000_000)
        let puffy=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try puffy.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-home-puffy-trial.png"))
        home.selectSlide(1,animated:false);XCTAssertEqual(activeCount(home),1)
        XCTAssertNil(home.ctaView.backgroundImage(for:.normal),"Other Home CTAs keep the accepted treatment")
        XCTAssertNotNil(home.ctaView.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
        try await Task.sleep(nanoseconds:2_050_000_000)
        let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-cta-shimmer-home.png"))
        XCTAssertEqual(activeCount(home),1,"Visible slide renews only one shimmer")
        home.isHidden=true;XCTAssertEqual(activeCount(home),0)
        home.isHidden=false;XCTAssertEqual(activeCount(home),1)
    }

    @MainActor func testHomeCTAIdleHasIndependentDirectionAndSharedVisibilityLifetime() async throws {
        let artwork=JimiV9Artwork(resourceRoot:Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),vc=UIViewController()
        window.rootViewController=vc;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        var home:JimiV9HomeView?=JimiV9HomeView(frame:vc.view.bounds,assets:artwork)
        weak var released=home
        vc.view.addSubview(home!);home!.layoutIfNeeded()
        for index in 0..<3 {
            home!.selectSlide(index,animated:false);home!.startHeroIdle()
            let shell=home!.ctaIdleView,button=home!.ctaView
            let drift=try XCTUnwrap(shell.layer.animation(forKey:"native-home-cta-idle") as? CAKeyframeAnimation)
            let hero=try XCTUnwrap(home!.heroImages[index].layer.animation(forKey:"native-hero-idle") as? CAKeyframeAnimation)
            XCTAssertGreaterThan(drift.duration,hero.duration*1.12)
            let peak=try XCTUnwrap((drift.values?[1] as? NSValue)?.caTransform3DValue)
            let heroPeak=try XCTUnwrap((hero.values?[1] as? NSValue)?.caTransform3DValue)
            XCTAssertGreaterThan(peak.m42,0);XCTAssertLessThan(heroPeak.m42,0)
            XCTAssertNil(button.layer.animation(forKey:"native-home-cta-idle"))
            button.sendActions(for:.touchDown)
            XCTAssertNotNil(button.superview?.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
            XCTAssertNotNil(button.superview?.superview?.layer.animation(forKey:"cta-press"))
            XCTAssertNotNil(shell.layer.animation(forKey:"native-home-cta-idle"))
            home!.pauseHeroIdle();XCTAssertEqual(shell.layer.speed,0)
            let offset=shell.layer.timeOffset
            try await Task.sleep(nanoseconds:20_000_000)
            XCTAssertEqual(shell.layer.timeOffset,offset)
            home!.startHeroIdle();XCTAssertEqual(shell.layer.speed,1)
            XCTAssertEqual(shell.layer.animation(forKey:"native-home-cta-idle")?.duration,drift.duration)
            home!.stopHeroIdle(preservePaintedPose:true)
            XCTAssertNil(shell.layer.animation(forKey:"native-home-cta-idle"))
            home!.startHeroIdle();home!.isHidden=true
            XCTAssertNil(shell.layer.animation(forKey:"native-home-cta-idle"))
            home!.isHidden=false
        }
        home!.stopHeroIdle();home!.removeFromSuperview();home=nil
        CATransaction.flush();try await Task.sleep(nanoseconds:30_000_000)
        XCTAssertNil(released)
    }

    @MainActor func testHomeLogoIdleContinuesAcrossSlidesAndSharesPauseAndExit() async throws {
        let artwork=JimiV9Artwork(resourceRoot:Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),vc=UIViewController()
        window.rootViewController=vc;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        let home=JimiV9HomeView(frame:vc.view.bounds,assets:artwork);vc.view.addSubview(home);home.layoutIfNeeded()
        home.startHeroIdle()
        let layer=home.logoIdleView.layer
        let original=try XCTUnwrap(layer.animation(forKey:"native-home-logo-idle") as? CAKeyframeAnimation)
        XCTAssertGreaterThanOrEqual(original.duration,5.4);XCTAssertLessThanOrEqual(original.duration,6.4)
        XCTAssertNil(home.logoImageView.layer.animation(forKey:"native-home-logo-idle"),"Logo route transform remains separate")
        for index in 0..<3 {
            home.selectSlide(index,animated:false)
            XCTAssertEqual(layer.animation(forKey:"native-home-logo-idle")?.beginTime,original.beginTime,"Slide selection never restarts logo")
            home.startHeroIdle()
            XCTAssertEqual(layer.animation(forKey:"native-home-logo-idle")?.beginTime,original.beginTime)
            home.pauseHeroIdle(preserveLogoIdle:true);XCTAssertEqual(layer.speed,1,"Slider drag preserves continuous logo")
            home.pauseHeroIdle();XCTAssertEqual(layer.speed,0)
            let offset=layer.timeOffset;try await Task.sleep(nanoseconds:20_000_000)
            XCTAssertEqual(layer.timeOffset,offset)
            home.startHeroIdle();XCTAssertEqual(layer.speed,1)
        }
        home.stopHeroIdle(preservePaintedPose:true);XCTAssertNil(layer.animation(forKey:"native-home-logo-idle"))
        home.startHeroIdle();home.isHidden=true;XCTAssertNil(layer.animation(forKey:"native-home-logo-idle"))
        home.isHidden=false;home.startHeroIdle();home.removeFromSuperview()
        XCTAssertNil(layer.animation(forKey:"native-home-logo-idle"))
        home.stopHeroIdle();home.stopHeroIdle()
    }

    @MainActor func testHomeShardsDriftIndependentlyPreserveMirrorAndShareLogoLifetime() async throws {
        let artwork=JimiV9Artwork(resourceRoot:Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),vc=UIViewController()
        window.rootViewController=vc;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        let home=JimiV9HomeView(frame:vc.view.bounds,assets:artwork);vc.view.addSubview(home);home.layoutIfNeeded()
        home.startHeroIdle()
        let layers=try home.shardViews.map{try XCTUnwrap($0.subviews.first?.layer)}
        let animations=try layers.map{try XCTUnwrap($0.animation(forKey:"native-home-shard-idle") as? CAKeyframeAnimation)}
        XCTAssertEqual(Set(animations.map{$0.duration}).count,4)
        for (index,animation) in animations.enumerated() {
            XCTAssertNil(home.shardViews[index].layer.animation(forKey:"native-home-shard-idle"),"Route shell remains separate")
            let poses=try XCTUnwrap(animation.values as? [NSValue]).map{$0.caTransform3DValue}
            XCTAssertEqual(poses.count,3)
            for pose in poses {if index==3 {XCTAssertLessThan(pose.m11,0)}else{XCTAssertGreaterThan(pose.m11,0)}}
            XCTAssertEqual(poses[0].m11,index==3 ? -1:1)
            XCTAssertNotEqual(poses[1].m41,0);XCTAssertNotEqual(poses[1].m42,0)
            let scale=hypot(poses[1].m11,poses[1].m12)
            XCTAssertGreaterThanOrEqual(scale,0.96);XCTAssertLessThanOrEqual(scale,0.98)
            XCTAssertEqual(abs(poses[2].m11),1,"Gentle scale-down returns to original size")
        }
        home.pauseHeroIdle(preserveLogoIdle:true)
        XCTAssertTrue(layers.allSatisfy{$0.speed==1})
        home.selectSlide(1,animated:false);home.startHeroIdle()
        for (index,layer) in layers.enumerated(){XCTAssertEqual(layer.animation(forKey:"native-home-shard-idle")?.beginTime,animations[index].beginTime)}
        home.pauseHeroIdle();XCTAssertTrue(layers.allSatisfy{$0.speed==0})
        let offsets=layers.map{$0.timeOffset};try await Task.sleep(nanoseconds:20_000_000)
        XCTAssertEqual(layers.map{$0.timeOffset},offsets)
        home.startHeroIdle();XCTAssertTrue(layers.allSatisfy{$0.speed==1})
        home.stopHeroIdle();home.stopHeroIdle()
        for (index,layer) in layers.enumerated(){XCTAssertNil(layer.animation(forKey:"native-home-shard-idle"));XCTAssertEqual(layer.transform.m11,index==3 ? -1:1)}
        home.startHeroIdle();home.isHidden=true
        XCTAssertTrue(layers.allSatisfy{$0.animation(forKey:"native-home-shard-idle")==nil})
        home.isHidden=false;home.startHeroIdle();home.removeFromSuperview()
        XCTAssertTrue(layers.allSatisfy{$0.animation(forKey:"native-home-shard-idle")==nil})
    }

    @MainActor func testHomeBottomNavigationIdleKeepsFixedHitsAndIndependentTapBounce() async throws {
        let artwork=JimiV9Artwork(resourceRoot:Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")!)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),vc=UIViewController()
        window.rootViewController=vc;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        let home=JimiV9HomeView(frame:vc.view.bounds,assets:artwork);vc.view.addSubview(home);home.layoutIfNeeded();home.startHeroIdle()
        let shells=try home.navigationIconViews.map{try XCTUnwrap($0.superview)}
        let animations=try shells.map{try XCTUnwrap($0.layer.animation(forKey:"native-home-nav-idle") as? CAKeyframeAnimation)}
        XCTAssertEqual(Set(animations.map{$0.duration}).count,3)
        for animation in animations {
            let poses=try XCTUnwrap(animation.values as? [NSValue])
            let peak=poses[1].caTransform3DValue
            XCTAssertLessThanOrEqual(peak.m42,-4,"Every icon must visibly lift, even at the smallest captured random amplitude")
            XCTAssertGreaterThanOrEqual(peak.m42,-7)
            XCTAssertGreaterThanOrEqual(abs(peak.m41),1.5)
        }
        var requests:[Int]=[];home.onSlideSelected={requests.append($0)}
        for index in 0..<3 {
            let button=home.navigationButtonViews[index],image=home.navigationIconViews[index]
            XCTAssertFalse(shells[index].isUserInteractionEnabled)
            let point=button.convert(CGPoint(x:button.bounds.midX,y:button.bounds.midY),to:window)
            XCTAssertTrue(window.hitTest(point,with:nil) === button,"Idle shell cannot intercept the fixed button target")
            button.sendActions(for:.touchUpInside)
            NativeHubBackpackFeedback.play(on:image)
            XCTAssertNotNil(image.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
            XCTAssertNotNil(shells[index].layer.animation(forKey:"native-home-nav-idle"))
            XCTAssertNil(button.layer.animation(forKey:"native-home-nav-idle"))
        }
        XCTAssertEqual(requests,[0,1,2])
        home.pauseHeroIdle(preserveLogoIdle:true);XCTAssertTrue(shells.allSatisfy{$0.layer.speed==1})
        home.selectSlide(1,animated:false);home.startHeroIdle()
        for (index,shell) in shells.enumerated(){XCTAssertEqual(shell.layer.animation(forKey:"native-home-nav-idle")?.beginTime,animations[index].beginTime)}
        home.pauseHeroIdle();XCTAssertTrue(shells.allSatisfy{$0.layer.speed==0})
        let offsets=shells.map{$0.layer.timeOffset};try await Task.sleep(nanoseconds:20_000_000)
        XCTAssertEqual(shells.map{$0.layer.timeOffset},offsets)
        home.startHeroIdle();XCTAssertTrue(shells.allSatisfy{$0.layer.speed==1})
        home.isHidden=true;XCTAssertTrue(shells.allSatisfy{$0.layer.animation(forKey:"native-home-nav-idle")==nil})
        home.isHidden=false;home.startHeroIdle();home.removeFromSuperview()
        XCTAssertTrue(shells.allSatisfy{$0.layer.animation(forKey:"native-home-nav-idle")==nil})
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
        XCTAssertEqual(primary.layer.shadowOpacity,0,"Shared sculpted wall replaces the old external hard shadow")
        XCTAssertEqual(secondary.backgroundColor,.clear);XCTAssertEqual(secondary.layer.borderWidth,0)
        XCTAssertNotNil(secondary.subviews.first{$0.accessibilityIdentifier=="native.cta.sculpted-face"})
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
        let homeSize=JimiV9PlainButton.homeCTASize(maxWidth:342,font:primary.titleLabel!.font)
        XCTAssertEqual(primary.bounds.height,homeSize.height);XCTAssertEqual(primary.bounds.width,homeSize.width)
        XCTAssertEqual(secondary.bounds.size,CGSize(width:primary.bounds.width,height:homeSize.height))
        for glyph in secondary.subviews where glyph.accessibilityIdentifier=="native.cta.title-outline" || glyph.accessibilityIdentifier=="native.cta.title-inner-outline" {XCTAssertTrue(glyph.isHidden)}
        let ink=secondary.attributedTitle(for:.normal)?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor
        XCTAssertEqual(ink,UIColor(red:189/255,green:160/255,blue:142/255,alpha:1))
        XCTAssertNil(secondary.titleLabel?.shadowColor);XCTAssertEqual(secondary.titleLabel?.layer.shadowOpacity,0)
        for painted in secondary.subviews where painted.accessibilityIdentifier?.hasPrefix("native.cta.") == true {
            XCTAssertEqual(painted.contentScaleFactor,window.screen.scale*2)
            XCTAssertFalse(painted.layer.shouldRasterize)
        }
        XCTAssertEqual(primary.layer.cornerRadius,homeSize.height/2);XCTAssertEqual(secondary.layer.cornerRadius,homeSize.height/2)
        XCTAssertEqual((primary as! JimiV9PlainButton).cartoonBounceLayoutView.center.x,195);XCTAssertEqual((secondary as! JimiV9PlainButton).cartoonBounceLayoutView.center.y-(primary as! JimiV9PlainButton).cartoonBounceLayoutView.center.y,homeSize.height+12,accuracy:0.001)
        XCTAssertEqual(primary.transform.a,0)
        result.tick(0)
        for index in 1...80 {result.tick(Double(index)/10)}
        let restingCenter=primary.center,restingBounds=primary.bounds
        result.view.setNeedsLayout();result.view.layoutIfNeeded()
        XCTAssertEqual(primary.center,restingCenter);XCTAssertEqual(primary.bounds,restingBounds)
        XCTAssertEqual(primary.transform.a,1);XCTAssertTrue(primary.isUserInteractionEnabled)
        attach(result.view,name:"Native Clean Board authored result")
        let creamPreview=UIGraphicsImageRenderer(bounds:result.view.bounds).image{_ in result.view.drawHierarchy(in:result.view.bounds,afterScreenUpdates:true)}
        try? creamPreview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-secondary-cream.png"))
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
        let homeSize=JimiV9PlainButton.homeCTASize(maxWidth:342,font:primary.titleLabel!.font)
        XCTAssertEqual(primary.bounds.height,homeSize.height);XCTAssertEqual(primary.bounds.width,homeSize.width);XCTAssertFalse(primary.isUserInteractionEnabled)
        XCTAssertEqual(primary.layer.cornerRadius,homeSize.height/2)
        XCTAssertEqual(button(in:result.view,id:"native.result.exit")?.bounds.width,primary.bounds.width)
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
