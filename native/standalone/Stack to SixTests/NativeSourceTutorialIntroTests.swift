import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialIntroTests:XCTestCase {
    @MainActor private final class Fixture {
        var wall=0.0,current=true,sheet:[Double]=[],pointer:[NativeSourceTutorialIntroOwner.PointerPose]=[],reveals=0,focuses=0
        let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        var service:NativeSourceAnimationClockService!,owner:NativeSourceTutorialIntroOwner!
        init(immediate:Bool=false,nativeMotion:Bool=false)throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo);timeouts.sourceMicrotaskTasks=tasks
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true)
            service.sourceMicrotaskTasks=tasks
            owner=try XCTUnwrap(NativeSourceTutorialIntroOwner(service:service,timeouts:timeouts,generation:1,immediateSheet:immediate,nativeSheetMotion:nativeMotion,current:{[weak self] in self?.current==true},sheet:{[weak self] in self?.sheet.append($0)},pointer:{[weak self] in self?.pointer.append($0)},reveal:{[weak self] in self?.reveals+=1},focus:{[weak self] in self?.focuses+=1}))
        }
        func deliver(_ value:Double){wall=value;service.deliver(wallMilliseconds:value)}
        func dispose(){owner.dispose();timeouts.cancelAll();service.dispose();fifo.dispose()}
    }
    func testEarlySecondAndSpecialPaperRequireEntryAndRealPreparationBeforeCTA()throws {
        let f=try Fixture();defer{f.dispose()}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,
            immediateSheet:true,deferInitialPointer:true,current:{f.current}))
        let button=try XCTUnwrap(overlay.subviews.flatMap{$0.subviews.flatMap{[$0]+$0.subviews}}.compactMap{$0 as? UIButton}.first{$0.accessibilityIdentifier=="native.tutorial.got-it"})
        for t in stride(from:16.0,through:1000,by:16){f.deliver(t)}
        XCTAssertTrue(overlay.transitionSourceSheetToSecondStep(from:nil,to:nil,preparationReady:false,entered:{}))
        for t in stride(from:1008.0,through:2400,by:16){f.deliver(t)}
        XCTAssertFalse(button.isEnabled,"Early paper never releases the first-merge preparation barrier")
        overlay.admitSourceSecondStepInteraction();XCTAssertTrue(button.isEnabled)
        XCTAssertTrue(overlay.showSpecialBar(interactionReady:false,entered:{}))
        overlay.admitSpecialBarInteraction();XCTAssertFalse(button.isEnabled,"Preparation alone still waits for real paper entry")
        for t in stride(from:2408.0,through:3400,by:16){f.deliver(t)}
        XCTAssertTrue(button.isEnabled)
    }
    func testSharedNativeSpringOvershootsReturnsAndRetiresOnExistingClock()throws {
        let f=try Fixture(immediate:true,nativeMotion:true);defer{f.dispose()}
        XCTAssertTrue(f.owner.start())
        XCTAssertGreaterThan(NativeTutorialSheetMotion.progress(0.15),0.8)
        XCTAssertGreaterThan(NativeTutorialSheetMotion.progress(0.3),0.2)
        XCTAssertGreaterThanOrEqual(NativeTutorialSheetMotion.progress(0.5),-0.05)
        for time in stride(from:16.0,through:900,by:16){f.deliver(time)}
        XCTAssertLessThan(f.sheet.min() ?? 1,-0.04)
        XCTAssertGreaterThanOrEqual(f.sheet.min() ?? -1,-0.25)
        XCTAssertTrue(f.sheet.contains{$0>0 && $0<0.01},"spring returns past rest before settling")
        XCTAssertEqual(try XCTUnwrap(f.sheet.last),0,accuracy:1e-9)
        var completed=0
        XCTAssertTrue(f.owner.enterSheet{completed+=1})
        f.owner.dispose();for time in stride(from:816.0,through:1800,by:16){f.deliver(time)}
        XCTAssertEqual(completed,0)
    }
    func testNativeSheetStartsAtActivationWithout800msWait()throws {
        let f=try Fixture(immediate:true);defer{f.dispose()}
        XCTAssertTrue(f.owner.start());XCTAssertTrue(f.owner.sheetStarted)
        XCTAssertFalse(f.owner.pointerStarted)
        XCTAssertEqual(f.timeouts.pendingReceipts.map(\.sourceID),["tutorial-pointer400"])
        f.deliver(16);f.deliver(32)
        XCTAssertLessThan(try XCTUnwrap(f.sheet.last),1)
        f.owner.dispose();XCTAssertEqual(f.timeouts.pendingCount,0)
    }
    func testFastNativeStepExitCannotBeOverwrittenByDelayedHandEntrance()async throws {
        let f=try Fixture(immediate:true,nativeMotion:true);defer{f.dispose()}
        XCTAssertTrue(f.owner.start());var completed=0
        XCTAssertTrue(f.owner.popOutPointer{completed+=1})
        // No APP frames until the old wall400 callback would have fired.
        try await Task.sleep(for:.milliseconds(450))
        for time in stride(from:16.0,through:600,by:16){f.deliver(time)}
        XCTAssertEqual(completed,1);XCTAssertEqual(f.reveals,0)
        XCTAssertEqual(f.owner.pendingTimerCount,0)
    }
    func testEarlyPaperCanEnterBeforePreparedTargetsWithoutStartingHand()throws {
        let f=try Fixture();defer{f.dispose()}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,
            immediateSheet:true,deferInitialPointer:true,current:{f.current}))
        for time in stride(from:16.0,through:600,by:16){f.deliver(time)}
        let intro=try XCTUnwrap(overlay.sourceIntroOwner)
        XCTAssertTrue(intro.sheetStarted);XCTAssertFalse(intro.pointerStarted)
        XCTAssertFalse(overlay.sourcePointerVisible);XCTAssertLessThan(overlay.sourceSheetTranslation,overlay.sourceSheetHeight)
        overlay.updateTargets(from:.init(x:80,y:240),to:.init(x:200,y:340));overlay.restorePointer()
        XCTAssertTrue(intro.pointerStarted);XCTAssertTrue(overlay.sourcePointerVisible)
    }
    func testIndependentWall800SheetAndWall1200PointerWhileGSAPPaused()async throws {
        let f=try Fixture();defer{f.dispose()};_=f.service.setSourceGlobalPaused(true)
        XCTAssertTrue(f.owner.start());XCTAssertFalse(f.owner.start())
        XCTAssertEqual(f.timeouts.pendingReceipts.map(\.sourceID),["tutorial-pointer1200","tutorial-sheet800"])
        XCTAssertEqual(f.sheet,[1]);XCTAssertEqual(f.pointer,[.init(alpha:0,scale:0,rotation:-8)])
        try await Task.sleep(for:.milliseconds(900))
        XCTAssertTrue(f.owner.sheetStarted);XCTAssertFalse(f.owner.pointerStarted);XCTAssertEqual(f.owner.pendingTimerCount,1)
        try await Task.sleep(for:.milliseconds(400))
        XCTAssertTrue(f.owner.pointerStarted);XCTAssertEqual(f.reveals,1);XCTAssertEqual(f.sheet,[1]);XCTAssertEqual(f.owner.pendingTimerCount,0)
        // APP RAF focus is independent of paused GSAP.
        f.deliver(16);XCTAssertEqual(f.focuses,1);XCTAssertEqual(f.sheet,[1])
        _=f.service.setSourceGlobalPaused(false)
        for time in stride(from:32.0,through:800,by:16){f.deliver(time)}
        XCTAssertEqual(try XCTUnwrap(f.sheet.last),0,accuracy:1e-9)
        XCTAssertEqual(try XCTUnwrap(f.pointer.last).scale,1,accuracy:1e-9)
        XCTAssertEqual(try XCTUnwrap(f.pointer.last).rotation,0,accuracy:1e-9)
        XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testDisposalCancelsBothTimersAndNeverReveals()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.owner.start());f.owner.dispose();f.owner.dispose()
        XCTAssertEqual(f.timeouts.pendingCount,0);try await Task.sleep(for:.milliseconds(1300));f.deliver(1400)
        XCTAssertEqual(f.reveals,0);XCTAssertEqual(f.focuses,0);XCTAssertEqual(f.sheet,[1]);XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testReplacementDuringRevealCannotCreateLateImageRootOrFocusRAF()async throws {
        let f=try Fixture();defer{f.dispose()}
        f.owner.dispose()
        f.owner=try XCTUnwrap(NativeSourceTutorialIntroOwner(service:f.service,timeouts:f.timeouts,generation:2,current:{f.current},sheet:{f.sheet.append($0)},pointer:{f.pointer.append($0)},reveal:{f.current=false;f.owner.dispose()},focus:{f.focuses+=1}))
        XCTAssertTrue(f.owner.start());try await Task.sleep(for:.milliseconds(1300));f.deliver(1400)
        XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.focuses,0);XCTAssertEqual(f.timeouts.pendingCount,0)
    }
    func testHiddenBackgroundRetainsIntroUntilRealForegroundRAF()async throws {
        let f=try Fixture();defer{f.dispose()};f.service.setSourceForeground(false);XCTAssertTrue(f.owner.start())
        try await Task.sleep(for:.milliseconds(1300))
        XCTAssertTrue(f.owner.sheetStarted);XCTAssertTrue(f.owner.pointerStarted);XCTAssertEqual(f.focuses,0);XCTAssertEqual(f.sheet,[1])
        f.service.setSourceForeground(true)
        for time in stride(from:16.0,through:800,by:16){f.deliver(time)}
        XCTAssertEqual(f.focuses,1);XCTAssertEqual(try XCTUnwrap(f.sheet.last),0,accuracy:1e-9)
    }
    func testMountedOverlayKeepsOffscreenSheetOnResizeAndRetiresForStepReplacement()async throws {
        let f=try Fixture();defer{f.dispose()}
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true;previous?.makeKeyAndVisible()}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);host.view.addSubview(overlay);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:CGPoint(x:100,y:300),to:CGPoint(x:260,y:500),service:f.service,timeouts:f.timeouts,boardGeneration:1,current:{f.current}))
        XCTAssertEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight);XCTAssertFalse(overlay.sourcePointerVisible)
        overlay.frame=CGRect(x:0,y:0,width:430,height:932);overlay.setNeedsLayout();overlay.layoutIfNeeded()
        XCTAssertEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight)
        XCTAssertEqual(overlay.sourcePointerAlpha,0)
        let captured=overlay.sourceSheetTranslation
        overlay.show(step:2,from:CGPoint(x:80,y:200),to:CGPoint(x:280,y:400))
        XCTAssertEqual(try XCTUnwrap(overlay.sourceSheetExitStart),Double(captured),accuracy:1e-6)
        XCTAssertNil(overlay.sourceIntroOwner);XCTAssertEqual(f.timeouts.pendingCount,0)
        try await Task.sleep(for:.milliseconds(1300));XCTAssertEqual(f.service.activeParticipantCount,0)
    }
    func testLiteralPointerPopChannelBoundariesAndSheetOvershoot() {
        XCTAssertEqual(NativeSourceTutorialIntroOwner.pointerPose(0),.init(alpha:0,scale:0,rotation:-8))
        let a=NativeSourceTutorialIntroOwner.pointerPose(0.22),b=NativeSourceTutorialIntroOwner.pointerPose(0.33),c=NativeSourceTutorialIntroOwner.pointerPose(0.49)
        XCTAssertEqual(a.alpha,1,accuracy:1e-9);XCTAssertEqual(a.scale,1.14,accuracy:1e-9);XCTAssertEqual(a.rotation,2,accuracy:1e-9)
        XCTAssertEqual(b.scale,0.94,accuracy:1e-9);XCTAssertEqual(b.rotation,-2,accuracy:1e-9)
        XCTAssertEqual(c.scale,1,accuracy:1e-9);XCTAssertEqual(c.rotation,0,accuracy:1e-9)
        XCTAssertLessThan(NativeSourceTutorialIntroOwner.sheetProgress(0.3),0)
    }
    func testActualAPPHintRepeatsBeyondFiniteCyclePausesAndCancelsOnHide()throws {
        let f=try Fixture();defer{f.dispose()};var values:[Double]=[]
        XCTAssertTrue(f.owner.startGuidedHint{values.append($0)})
        for time in stride(from:16.0,through:5200,by:16){f.deliver(time)}
        XCTAssertGreaterThan(values.count,100);XCTAssertEqual(f.service.activeParticipantCount,1)
        let before=values.count;_=f.service.setSourceGlobalPaused(true)
        for time in stride(from:5216.0,through:6000,by:16){f.deliver(time)}
        XCTAssertEqual(values.count,before)
        _=f.service.setSourceGlobalPaused(false);f.deliver(6016);XCTAssertGreaterThan(values.count,before)
        f.owner.cancelPointer();XCTAssertEqual(f.service.activeParticipantCount,0)
        let stopped=values.count;f.deliver(6032);XCTAssertEqual(values.count,stopped)
    }
    func testCapturedCurrentRetirementReleasesHintOnNextActualFrame()throws {
        let f=try Fixture();defer{f.dispose()};var values:[Double]=[]
        XCTAssertTrue(f.owner.startGuidedHint{values.append($0)});f.deliver(16)
        let old=values.count;f.current=false;f.deliver(32)
        XCTAssertEqual(values.count,old);XCTAssertEqual(f.service.activeParticipantCount,0)
        XCTAssertFalse(f.owner.startGuidedHint{_ in XCTFail("retired hint")})
    }
    func testHintKeepsYoyoAndRepeatDelayBoundaries() {
        for (seconds,expected) in [(0.0,0.0),(0.59,0.5),(1.18,1.0),(1.24,1.0),(1.3,1.0),(1.89,0.5),(2.48,0.0),(2.54,0.0),(2.6,0.0),(5.2,0.0)] {
            XCTAssertEqual(NativeSourceTutorialIntroOwner.hintProgress(seconds),expected,accuracy:1e-9)
        }
    }

    func testOriginalGSAPRecipesMatchAll1039NumericChannels()throws {
        struct Pop:Decodable{let seconds:Double,alpha:Double,scale:Double,rotation:Double}
        struct Scalar:Decodable{let seconds:Double,progress:Double}
        struct Oracle:Decodable{let popSamples:[Pop],sheetSamples:[Scalar],hintSamples:[Scalar]}
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceTutorialIntroV9Oracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url))
        for sample in oracle.popSamples {
            let pose=NativeSourceTutorialIntroOwner.pointerPose(sample.seconds)
            XCTAssertEqual(pose.alpha,sample.alpha,accuracy:1e-6);XCTAssertEqual(pose.scale,sample.scale,accuracy:1e-6);XCTAssertEqual(pose.rotation,sample.rotation,accuracy:1e-6)
        }
        for sample in oracle.sheetSamples{XCTAssertEqual(NativeSourceTutorialIntroOwner.sheetProgress(sample.seconds),sample.progress,accuracy:1e-6)}
        for sample in oracle.hintSamples{XCTAssertEqual(NativeSourceTutorialIntroOwner.hintProgress(sample.seconds),sample.progress,accuracy:1e-6)}
    }

    func testActualOverlayViewportRastersRetainSheetAndSourcePointer()async throws {
        let f=try Fixture();defer{f.dispose()};f.service.setSourceForeground(false)
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:CGPoint(x:100,y:300),to:CGPoint(x:260,y:500),service:f.service,timeouts:f.timeouts,boardGeneration:1,current:{f.current}))
        try await Task.sleep(for:.milliseconds(1300));f.service.setSourceForeground(true)
        for time in stride(from:16.0,through:800,by:16){f.deliver(time)}
        for size in [CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            overlay.frame=CGRect(origin:.zero,size:size);overlay.setNeedsLayout();overlay.layoutIfNeeded()
            XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
            XCTAssertTrue(overlay.sourcePointerVisible);XCTAssertFalse(overlay.sourceHintUsesCoreAnimation)
            let image=UIGraphicsImageRenderer(size:size).image{context in
                UIColor(red:1,green:247/255,blue:239/255,alpha:1).setFill();context.fill(CGRect(origin:.zero,size:size))
                overlay.layer.render(in:context.cgContext)
            }
            let attachment=XCTAttachment(image:image);attachment.name="Source tutorial intro \(Int(size.width))x\(Int(size.height))";attachment.lifetime = .keepAlways;add(attachment)
        }
        overlay.dispose();XCTAssertEqual(f.service.activeParticipantCount,0);XCTAssertEqual(f.timeouts.pendingCount,0)
    }

    func testSpecialBarToClearKeepsPaperVisibleAndRetiresContentTransition()throws {
        let f=try Fixture(immediate:true);defer{f.dispose()}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,immediateSheet:true,current:{f.current}))
        for _ in 0..<60{f.deliver(f.wall+16)}
        let intro=try XCTUnwrap(overlay.sourceIntroOwner);XCTAssertTrue(intro.exitSheet{})
        for _ in 0..<25{f.deliver(f.wall+16)}
        XCTAssertTrue(overlay.showSpecialBar(entered:{}));for _ in 0..<60{f.deliver(f.wall+16)}
        var completed=0;XCTAssertTrue(overlay.replaceSpecialBarWithClear{completed+=1})
        for _ in 0..<35 {
            f.deliver(f.wall+16)
            XCTAssertFalse(overlay.isHidden);XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
            XCTAssertGreaterThanOrEqual(overlay.sourceSheetSurfaceFrame.maxY,overlay.bounds.maxY)
        }
        XCTAssertEqual(completed,1);XCTAssertFalse(overlay.specialBarVisible)
        XCTAssertTrue(overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UILabel}.contains{$0.text=="Clear the stage"})
    }

    func testMergeRetainsFirstStackHeightWhenTemporarySafeAreaDisappears() {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=window.bounds;host.view.addSubview(overlay);overlay.show(step:1,from:nil,to:nil,initial:true)
        overlay.setNeedsLayout();overlay.layoutIfNeeded();let first=overlay.sourceSheetHeight
        overlay.removeFromSuperview();overlay.show(step:2,from:nil,to:nil,initial:true);overlay.setNeedsLayout();overlay.layoutIfNeeded()
        XCTAssertEqual(overlay.sourceSheetHeight,first,accuracy:1e-6)
        XCTAssertTrue(overlay.showSpecialBar(entered:{}));overlay.setNeedsLayout();overlay.layoutIfNeeded()
        XCTAssertEqual(overlay.sourceSheetHeight,first,accuracy:1e-6)
    }

    func testEveryTutorialSheetIncludingSpecialBarUsesIdenticalSizeAndFitsCopyAndCTA()throws {
        for width in [390.0,430.0] {
            let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
            overlay.frame=CGRect(x:0,y:0,width:width,height:width==390 ? 844:932)
            var heights:[CGFloat]=[]
            for step in 1...5 {
                overlay.show(step:step,from:nil,to:nil,initial:true)
                overlay.setNeedsLayout();overlay.layoutIfNeeded();heights.append(overlay.sourceSheetHeight)
                let labels=overlay.subviews.flatMap{$0.subviews}.compactMap{$0 as? UILabel}
                for label in labels {
                    if label === labels.first {
                        // Baloo's nominal line box exceeds its visible capital ink.
                        // Titles stay on one line within the authored heading slot.
                        XCTAssertLessThanOrEqual(label.attributedText?.size().width ?? 0,label.bounds.width)
                        XCTAssertLessThanOrEqual(label.font.capHeight,label.bounds.height)
                    } else {
                        XCTAssertEqual(label.numberOfLines,2)
                        XCTAssertLessThanOrEqual(label.sizeThatFits(CGSize(width:label.bounds.width,height:.greatestFiniteMagnitude)).height,label.bounds.height+1)
                    }
                }
            }
            XCTAssertTrue(overlay.showSpecialBar(entered:{}));overlay.setNeedsLayout();overlay.layoutIfNeeded()
            heights.append(overlay.sourceSheetHeight)
            for height in heights {XCTAssertEqual(height,try XCTUnwrap(heights.first),accuracy:1e-6)}
            XCTAssertLessThanOrEqual(overlay.sourceSheetHeight,260,"compact layout must not regain excess bottom padding")
            let image=UIGraphicsImageRenderer(bounds:overlay.bounds).image{context in
                UIColor(red:1,green:247/255,blue:239/255,alpha:1).setFill();context.fill(overlay.bounds)
                overlay.layer.render(in:context.cgContext)
            }
            try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/native-tutorial-special-bar-shared-\(Int(width)).png"))
        }
    }

    func testEveryTeachingSheetUsesOneContinuousEnterAndExitWithoutHiddenPause()throws {
        let f=try Fixture(immediate:true);defer{f.dispose()}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        func tick(_ frames:Int){for _ in 0..<frames{f.deliver(f.wall+16)}}
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,immediateSheet:true,current:{f.current}))
        tick(56);XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
        let intro=try XCTUnwrap(overlay.sourceIntroOwner)
        for step in [2,3,4] {
            var exited=false;XCTAssertTrue(intro.exitSheet{exited=true})
            tick(12);XCTAssertFalse(exited);XCTAssertGreaterThan(overlay.sourceSheetTranslation,0)
            tick(10);XCTAssertTrue(exited)
            var entered=false
            switch step {
            case 2:XCTAssertTrue(overlay.transitionSourceSheetToSecondStep(from:nil,to:nil,entered:{entered=true}))
            case 3:XCTAssertTrue(overlay.transitionSourceSheetToThirdStep(entered:{entered=true}))
            default:XCTAssertTrue(overlay.transitionSourceSheetToFourthStep(entered:{entered=true}))
            }
            XCTAssertEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight,accuracy:1e-6)
            tick(4)
            XCTAssertLessThan(overlay.sourceSheetTranslation,overlay.sourceSheetHeight,"next enter starts now instead of waiting for another hidden exit")
            XCTAssertGreaterThan(overlay.sourceSheetTranslation,0,"no instant snap to visible sheet")
            XCTAssertFalse(entered)
            tick(52);XCTAssertTrue(entered);XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:1e-6)
        }
        var thirdExited=false;XCTAssertTrue(overlay.exitSourceThirdSheetForWild{thirdExited=true})
        tick(20);XCTAssertTrue(thirdExited,"Clear uses the same .28s exit as every other sheet")
    }

    func testMountedTeachingSheetsKeepPaintedBottomBelowViewportDuringEveryBounce()throws {
        let f=try Fixture(immediate:true);defer{f.dispose()}
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root)
        overlay.frame=window.bounds;host.view.addSubview(overlay)
        defer{overlay.dispose();window.isHidden=true}
        var sawOvershoot=false
        func tick(_ frames:Int){for _ in 0..<frames{
            f.deliver(f.wall+16)
            let surface=overlay.sourceSheetSurfaceFrame
            XCTAssertGreaterThanOrEqual(surface.maxY,overlay.bounds.maxY,"painted bottom remains attached throughout motion")
            XCTAssertEqual(surface.width,overlay.bounds.width,accuracy:1e-6)
            if overlay.sourceSheetTranslation<0{sawOvershoot=true}
        }}
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,immediateSheet:true,current:{f.current}))
        tick(56)
        let intro=try XCTUnwrap(overlay.sourceIntroOwner)
        for step in [2,3,4] {
            XCTAssertTrue(intro.exitSheet{});tick(22)
            switch step {
            case 2:XCTAssertTrue(overlay.transitionSourceSheetToSecondStep(from:nil,to:nil,entered:{}))
            case 3:XCTAssertTrue(overlay.transitionSourceSheetToThirdStep(entered:{}))
            default:XCTAssertTrue(overlay.transitionSourceSheetToFourthStep(entered:{}))
            }
            tick(56)
        }
        XCTAssertTrue(intro.exitSheet{});tick(22)
        XCTAssertTrue(overlay.showSpecialBar(entered:{}));tick(56)
        XCTAssertTrue(overlay.hideSpecialBar(completed:{}));tick(22)
        XCTAssertTrue(sawOvershoot,"test captures the authored backOut upward bounce")
    }

    func testFourthActualOverlayUsesCapturedDimAndSheetCompletion()throws {
        let f=try Fixture();defer{f.dispose()}
        let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,immediateSheet:true,current:{f.current}))
        XCTAssertTrue(overlay.activateSourceFourthStepDim());var entered=0
        XCTAssertTrue(overlay.transitionSourceSheetToFourthStep(entered:{entered+=1}))
        XCTAssertEqual(entered,0)
        for time in stride(from:16.0,through:1000,by:16){f.deliver(time)}
        XCTAssertEqual(entered,1);XCTAssertEqual(overlay.sourceSheetTranslation,0,accuracy:0.001)
        XCTAssertEqual(overlay.sourceDimAlpha,0.08,accuracy:0.001)
        XCTAssertTrue(overlay.transitionSourceSheetToFourthStep(entered:{entered+=1}))
        overlay.dispose();for time in stride(from:1008.0,through:2000,by:16){f.deliver(time)}
        XCTAssertEqual(entered,1);XCTAssertEqual(f.timeouts.pendingCount,0)
    }
    func testFourthExitWaitsForActualPointerAndSheetRootsAndRetiresPointerRepeat()throws {
        let f=try Fixture();defer{f.dispose()};let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose()}
        overlay.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:f.timeouts,boardGeneration:1,immediateSheet:true,current:{f.current}))
        var entered=0;XCTAssertTrue(overlay.transitionSourceSheetToFourthStep(entered:{entered+=1}))
        for time in stride(from:16.0,through:800,by:16){f.deliver(time)};XCTAssertEqual(entered,1)
        var selections=0
        XCTAssertTrue(overlay.startSourceFourthPointer(service:f.service,timeouts:f.timeouts,boardGeneration:1,current:{f.current},select:{selections+=1;return .init(from:.init(x:50,y:100,width:64,height:64),to:.init(x:220,y:300,width:64,height:64))}))
        XCTAssertEqual(selections,1,"Accessibility must borrow the visible pointer's selection, never consume another shared draw")
        let source=try XCTUnwrap(overlay.subviews.first{$0.accessibilityIdentifier=="native.tutorial.drag-source"})
        let target=try XCTUnwrap(overlay.subviews.first{$0.accessibilityIdentifier=="native.tutorial.drag-target"})
        XCTAssertEqual(source.frame,CGRect(x:50,y:100,width:64,height:64))
        XCTAssertEqual(target.frame,CGRect(x:220,y:300,width:64,height:64))
        XCTAssertFalse(source.isUserInteractionEnabled);XCTAssertFalse(target.isUserInteractionEnabled)
        var exited=0;XCTAssertTrue(overlay.exitSourceFourthStep(completed:{exited+=1}));XCTAssertEqual(exited,0)
        XCTAssertNil(source.superview);XCTAssertNil(target.superview)
        for time in stride(from:816.0,through:976,by:16){f.deliver(time)};XCTAssertEqual(exited,0)
        for time in stride(from:992.0,through:1600,by:16){f.deliver(time)}
        XCTAssertEqual(exited,1);XCTAssertFalse(overlay.sourcePointerVisible)
        XCTAssertEqual(overlay.sourceSheetTranslation,overlay.sourceSheetHeight,accuracy:0.001)
        XCTAssertFalse(f.timeouts.pendingReceipts.contains{$0.sourceID.hasPrefix("tutorial-fourth-pointer")})
    }
}
