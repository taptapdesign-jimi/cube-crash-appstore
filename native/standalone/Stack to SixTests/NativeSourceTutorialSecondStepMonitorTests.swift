import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceTutorialSecondStepMonitorTests:XCTestCase {
    func testNativeFourthDropAdmissionStartsSheetImmediatelyThenWaitsActualLanding()async throws {
        let f=try Fixture();defer{f.dispose()};let node=f.targets[0]
        var dropping=true,activated=0,prepared=0,entered:(()->Void)?
        let monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{nil},nodeCurrent:{$0 === node},dropping:{_ in dropping},activate:{_ in activated+=1;return true},
            transitionSheet:{entered=$0;return true},prepare:{_ in prepared+=1;return true},sheetDelayMilliseconds:0))
        defer{monitor.dispose()};XCTAssertTrue(monitor.start())
        XCTAssertTrue(monitor.activateDroppingWild(node));XCTAssertFalse(monitor.activateDroppingWild(node))
        XCTAssertEqual(activated,1);XCTAssertEqual(monitor.phase,.sheetTransition)
        XCTAssertFalse(f.timeouts.pendingReceipts.contains{$0.sourceID=="tutorial-fourth-sheet900"})
        try XCTUnwrap(entered)();XCTAssertEqual(prepared,0);XCTAssertEqual(monitor.phase,.waitingForDrop)
        dropping=false;try await Task.sleep(for:.milliseconds(110))
        XCTAssertEqual(prepared,1);XCTAssertEqual(monitor.phase,.prepared)
    }
    func testNativeFourthImmediateDropInterruptedDuringActivationCannotEnterSheet()throws {
        let f=try Fixture();defer{f.dispose()};var sheets=0
        var monitor:NativeSourceTutorialFourthStepMonitor!
        monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{nil},nodeCurrent:{_ in true},dropping:{_ in true},activate:{_ in monitor.dispose();return true},
            transitionSheet:{_ in sheets+=1;return true},prepare:{_ in XCTFail("retired prepare");return false},sheetDelayMilliseconds:0))
        XCTAssertTrue(monitor.start());XCTAssertFalse(monitor.activateDroppingWild(f.targets[0]))
        XCTAssertEqual(sheets,0);XCTAssertEqual(monitor.phase,.retired)
    }
    func testNativeFourthFirstContactEntersWhileImpactSettlesAndKeepsInputPreparationDeferred()async throws {
        let f=try Fixture();defer{f.dispose()};let node=f.targets[0]
        var dropping=true,sheets=0,prepared=0,entered:(()->Void)?
        let monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{nil},nodeCurrent:{$0 === node},dropping:{_ in dropping},activate:{_ in true},
            transitionSheet:{sheets+=1;entered=$0;return true},prepare:{_ in prepared+=1;return true},
            sheetDelayMilliseconds:0,waitForLandingBeforeSheet:true))
        defer{monitor.dispose()};XCTAssertTrue(monitor.start());XCTAssertTrue(monitor.activateDroppingWild(node))
        XCTAssertFalse(monitor.contactWild(f.targets[1]));XCTAssertEqual(sheets,0)
        XCTAssertTrue(monitor.contactWild(node));XCTAssertEqual(sheets,1);XCTAssertTrue(dropping)
        XCTAssertFalse(monitor.contactWild(node));try XCTUnwrap(entered)();XCTAssertEqual(prepared,0)
        dropping=false;try await Task.sleep(for:.milliseconds(110));XCTAssertEqual(prepared,1)
        XCTAssertFalse(monitor.landedWild(node));XCTAssertEqual(sheets,1)
    }
    func testNativeFourthWaitsForExactLandingAndRetirementCancelsOwnedWork()throws {
        let f=try Fixture();defer{f.dispose()}
        let node=f.targets[0];var dropping=true,sheets=0,prepared=0;var entered:(()->Void)?
        let monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{nil},nodeCurrent:{$0 === node},dropping:{_ in dropping},activate:{_ in true},
            transitionSheet:{sheets+=1;entered=$0;return true},prepare:{_ in prepared+=1;return true},
            sheetDelayMilliseconds:0,waitForLandingBeforeSheet:true))
        XCTAssertTrue(monitor.start());XCTAssertTrue(monitor.activateDroppingWild(node))
        XCTAssertEqual(monitor.phase,.waitingForLanding);XCTAssertEqual(sheets,0)
        XCTAssertFalse(monitor.landedWild(node));dropping=false
        XCTAssertFalse(monitor.landedWild(f.targets[1]));XCTAssertEqual(sheets,0)
        XCTAssertTrue(monitor.landedWild(node));XCTAssertEqual(sheets,1);XCTAssertEqual(prepared,0)
        XCTAssertFalse(monitor.landedWild(node));try XCTUnwrap(entered)()
        XCTAssertEqual(prepared,1);XCTAssertEqual(monitor.phase,.prepared)
        monitor.dispose();monitor.dispose();try XCTUnwrap(entered)()
        XCTAssertFalse(monitor.landedWild(node));XCTAssertEqual(prepared,1)
        XCTAssertFalse(f.timeouts.pendingReceipts.contains{$0.sourceID.hasPrefix("tutorial-fourth-")})
    }
    @MainActor private final class Fixture {
        var wall=0.0,current=true,activated=0,hasSix=false
        let fifo=NativeSourceMicrotaskFIFO(),timeouts=NativeSourceAppTimeoutOwner()
        var service:NativeSourceAnimationClockService!,construction:NativeSourceInitialBoardConstruction!,intro:NativeSourceTutorialIntroOwner!,monitor:NativeSourceTutorialSecondStepMonitor!
        var scene:NativeBoardScene!,driver:NativeSourceOuterTimelineAdapter!
        var targets:[NativeDiceNode]=[]
        init()throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo);timeouts.sourceMicrotaskTasks=tasks
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
            construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.make(root:NativeTestResources.root,service:service,mode:.arcade,board:1,tutorialDemo:true,random:{0.25}))
            let state=try XCTUnwrap(construction.recipe?.state)
            scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844),sourceInitialConstruction:construction)
            driver=NativeSourceOuterTimelineAdapter(service:service);scene.sourceOuterTimelineDriver=driver
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0));deliver(16)
            let capturedState=state,cells=NativeTutorialRules.guidedCells(columns:capturedState.columns,rows:capturedState.rows)
            targets=try [cells.three,cells.two].map{try XCTUnwrap(construction.nodes[try XCTUnwrap(state.tile(at:$0)).id])}
            intro=try XCTUnwrap(NativeSourceTutorialIntroOwner(service:service,timeouts:timeouts,generation:state.generation,current:{[weak self] in self?.current==true},sheet:{_ in},pointer:{_ in},reveal:{},focus:{}))
            intro.restorePointer();for t in stride(from:32.0,through:600,by:16){deliver(t)}
            XCTAssertTrue(targets[0].forceSourceTutorialInitialValue(5));XCTAssertTrue(targets[1].forceSourceTutorialInitialValue(1))
            monitor=try XCTUnwrap(NativeSourceTutorialSecondStepMonitor(service:service,timeouts:timeouts,generation:state.generation,five:targets[0],one:targets[1],parent:construction.canvas,current:{[weak self] in self?.current==true},hasUnlockedSix:{[weak self] in self?.hasSix==true},nodeCurrent:{[weak self] node in self?.construction.nodes[node.tileID] === node},pointerExit:{[weak self] callback in self?.intro.popOutPointer(completed:callback)==true},sheetExit:{[weak self] callback in self?.intro.exitSheet(completed:callback)==true},activate:{[weak self] in self?.activated+=1;return true}))
        }
        func deliver(_ ms:Double){wall=ms;service.deliver(wallMilliseconds:ms)}
        func finishRoots(){for t in stride(from:608.0,through:1400,by:16){deliver(t)}}
        func dispose(){monitor.dispose();intro.dispose();timeouts.cancelAll();scene.dispose();construction.dispose();driver.dispose();service.dispose();fifo.dispose()}
    }
    func testNativeSecondSheetStaysVisibleUntilReadyAndNextStartsOnExactExitCompletion()async throws {
        let f=try Fixture();defer{f.dispose()};var ready=false,activations=0
        var pointer:(()->Void)?,sheet:(()->Void)?
        let monitor=try XCTUnwrap(NativeSourceTutorialSecondStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            five:f.targets[0],one:f.targets[1],parent:f.construction.canvas,current:{f.current},hasUnlockedSix:{true},nodeCurrent:{_ in true},
            pointerExit:{pointer=$0;return true},sheetExit:{sheet=$0;return true},activate:{activations+=1;return true},
            readyToExit:{ready},activationDelayMilliseconds:0))
        defer{monitor.dispose()};XCTAssertTrue(monitor.start())
        try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(monitor.phase,.polling);XCTAssertNil(pointer)
        ready=true;try await Task.sleep(for:.milliseconds(70));XCTAssertEqual(monitor.phase,.pointerExit)
        try XCTUnwrap(pointer)();XCTAssertEqual(monitor.phase,.sheetExit);XCTAssertEqual(activations,0)
        try XCTUnwrap(sheet)();XCTAssertEqual(activations,1);XCTAssertEqual(monitor.phase,.finished)
        XCTAssertFalse(f.timeouts.pendingReceipts.contains{$0.sourceID=="tutorial-second-activate90"})
        try XCTUnwrap(sheet)();XCTAssertEqual(activations,1)
    }

    func testUnlockedSixCompletesWithoutInteractionThroughActualExitsAndSeparateWall90()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.monitor.start());XCTAssertFalse(f.monitor.start())
        _=f.service.setSourceGlobalPaused(true);f.hasSix=true
        try await Task.sleep(for:.milliseconds(70));XCTAssertEqual(f.monitor.phase,.pointerExit);XCTAssertEqual(f.activated,0)
        f.finishRoots();XCTAssertEqual(f.monitor.phase,.pointerExit)
        _=f.service.setSourceGlobalPaused(false)
        for t in stride(from:1408.0,through:2200,by:16){f.deliver(t)}
        XCTAssertEqual(f.monitor.phase,.activationWait);XCTAssertEqual(f.activated,0)
        f.service.setSourceForeground(false);try await Task.sleep(for:.milliseconds(130))
        XCTAssertEqual(f.monitor.phase,.finished);XCTAssertEqual(f.activated,1)
    }
    func testChangedPairRequiresCapturedInteractionAndIntactPairNeverCompletes()async throws {
        let f=try Fixture();defer{f.dispose()};XCTAssertTrue(f.monitor.start())
        f.monitor.pointerDown(f.targets[0]);try await Task.sleep(for:.milliseconds(70));XCTAssertEqual(f.monitor.phase,.polling)
        XCTAssertTrue(f.targets[0].forceSourceTutorialInitialValue(4))
        try await Task.sleep(for:.milliseconds(70));XCTAssertEqual(f.monitor.phase,.pointerExit)
    }
    func testUnrelatedInteractionCannotCompleteChangedPairAndRetirementKeepsOtherTimer()async throws {
        let f=try Fixture();defer{f.dispose()};var unrelated=0
        _=f.timeouts.schedule(sourceID:"another-owner",generation:1,delayMilliseconds:180,elapsed:{unrelated+=1})
        XCTAssertTrue(f.monitor.start())
        let other=try XCTUnwrap(f.construction.nodes.values.first{node in !f.targets.contains(where:{$0 === node})})
        f.monitor.pointerDown(other);XCTAssertTrue(f.targets[0].forceSourceTutorialInitialValue(4))
        try await Task.sleep(for:.milliseconds(70));XCTAssertEqual(f.monitor.phase,.polling)
        f.current=false;f.monitor.dispose();f.finishRoots();try await Task.sleep(for:.milliseconds(160))
        XCTAssertEqual(f.monitor.phase,.retired);XCTAssertEqual(f.activated,0);XCTAssertEqual(unrelated,1)
    }
    func testFourthActualWall120Then900RequiresSheetCompletionAndDrop80()async throws {
        let f=try Fixture();defer{f.dispose()}
        var candidate:NativeDiceNode?,dropping=true,activated=0,prepared=0,sheet:(()->Void)?
        let node=f.targets[0]
        let monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{candidate},nodeCurrent:{$0 === node && $0.sourceContactNodeAlive},dropping:{_ in dropping},
            activate:{captured in XCTAssertTrue(captured === node);activated+=1;return true},
            transitionSheet:{sheet=$0;return true},prepare:{captured in XCTAssertTrue(captured === node);prepared+=1;return true}))
        defer{monitor.dispose()};XCTAssertTrue(monitor.start());XCTAssertFalse(monitor.start())
        try await Task.sleep(for:.milliseconds(150));XCTAssertEqual(monitor.phase,.polling);XCTAssertEqual(activated,0)
        candidate=node;f.service.setSourceGlobalPaused(true)
        try await Task.sleep(for:.milliseconds(150));XCTAssertEqual(monitor.phase,.sheetDelay);XCTAssertEqual(activated,1)
        XCTAssertEqual(prepared,0);XCTAssertNil(sheet)
        try await Task.sleep(for:.milliseconds(980));XCTAssertEqual(monitor.phase,.sheetTransition);XCTAssertEqual(prepared,0)
        let entered=try XCTUnwrap(sheet);entered();XCTAssertEqual(monitor.phase,.waitingForDrop)
        try await Task.sleep(for:.milliseconds(110));XCTAssertEqual(prepared,0)
        dropping=false;try await Task.sleep(for:.milliseconds(110))
        XCTAssertEqual(monitor.phase,.prepared);XCTAssertEqual(prepared,1)
        entered();try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(prepared,1)
    }
    func testFourthSourceFiveSecondEscapeUsesCapturedWildAndCannotPrepareRetiredOwner()async throws {
        let f=try Fixture();defer{f.dispose()};let node=f.targets[0]
        var now=0.0,prepared=0,sheet:(()->Void)?
        let monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{node},nodeCurrent:{$0 === node},dropping:{_ in true},activate:{_ in true},
            transitionSheet:{sheet=$0;return true},prepare:{_ in prepared+=1;return true},wallNow:{now}))
        defer{monitor.dispose()};XCTAssertTrue(monitor.start())
        try await Task.sleep(for:.milliseconds(1120));let entered=try XCTUnwrap(sheet);entered()
        now=4999;try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(prepared,0)
        now=5000;try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(prepared,1);XCTAssertEqual(monitor.phase,.prepared)
        monitor.dispose();entered();XCTAssertEqual(prepared,1)
    }
    func testFourthRetirementDuringActivationCancelsOnlyOwnPendingWork()async throws {
        let f=try Fixture();defer{f.dispose()};var activated=0,sheet=0,other=0
        var monitor:NativeSourceTutorialFourthStepMonitor!
        monitor=try XCTUnwrap(NativeSourceTutorialFourthStepMonitor(service:f.service,timeouts:f.timeouts,generation:1,
            current:{f.current},findWild:{f.targets[0]},nodeCurrent:{_ in true},dropping:{_ in true},
            activate:{_ in activated+=1;monitor.dispose();return true},transitionSheet:{_ in sheet+=1;return true},prepare:{_ in XCTFail("retired prepare");return false}))
        defer{monitor.dispose()};_=f.timeouts.schedule(sourceID:"another-fourth-owner",generation:1,delayMilliseconds:180,elapsed:{other+=1})
        XCTAssertTrue(monitor.start());try await Task.sleep(for:.milliseconds(240))
        XCTAssertEqual(monitor.phase,.retired);XCTAssertEqual(activated,1);XCTAssertEqual(sheet,0);XCTAssertEqual(other,1)
        XCTAssertFalse(f.timeouts.pendingReceipts.contains{$0.sourceID=="tutorial-fourth-sheet900"})
    }

    func testFourthWildFramesPreserveSourceNestedRAFOrder()throws {
        let f=try Fixture();defer{f.dispose()};var events:[String]=[]
        let owner=try XCTUnwrap(NativeSourceTutorialFourthWildFrames(service:f.service,generation:1,current:{f.current},
            commitFields:{events.append("fields");return true},paintFace:{events.append("face");return true},startHalo:{events.append("halo");return true}))
        defer{owner.dispose()};XCTAssertTrue(owner.start());XCTAssertFalse(owner.start())
        XCTAssertEqual(events,["fields"]);XCTAssertEqual(owner.pendingFrameCount,2)
        f.deliver(608);XCTAssertEqual(events,["fields","face","halo"]);XCTAssertEqual(owner.pendingFrameCount,1)
        f.deliver(624);XCTAssertEqual(events,["fields","face","halo","face"]);XCTAssertEqual(owner.pendingFrameCount,0)
    }
    func testFourthWildFramesRetirementFromHaloCancelsOnlyItsSecondFace()throws {
        let f=try Fixture();defer{f.dispose()};var faces=0,unrelated=0
        var owner:NativeSourceTutorialFourthWildFrames?
        owner=try XCTUnwrap(NativeSourceTutorialFourthWildFrames(service:f.service,generation:1,current:{f.current},
            commitFields:{true},paintFace:{faces+=1;return true},startHalo:{owner?.dispose();return true}))
        defer{owner?.dispose()};XCTAssertTrue(owner?.start()==true)
        let other=try XCTUnwrap(f.service.requestSourceAnimationFrame(ownerID:"unrelated-fourth",generation:1,callback:{unrelated+=1},onCancelled:{}))
        defer{other.cancel()};f.deliver(608);f.deliver(624)
        XCTAssertEqual(faces,1);XCTAssertEqual(unrelated,1);XCTAssertEqual(owner?.pendingFrameCount,0)
    }
    func testFourthFocusUsesSource280SineAndNoMathForLockedAndAllowedNodes()throws {
        let f=try Fixture();defer{f.dispose()};var draws=0
        let owner=NativeSourceTutorialFocusOwner(service:f.service,random:{draws+=1;return 0.5},current:{f.current})
        defer{owner.dispose()};let ordinary=f.targets[0],locked=f.targets[1]
        locked.update(value:1,kind:"regular",variant:nil,depth:1,locked:true)
        ordinary.alpha=0.8;locked.alpha=0.8
        XCTAssertTrue(owner.focusFourth(ordinary,focused:false));XCTAssertTrue(owner.focusFourth(locked,focused:false))
        XCTAssertEqual(draws,0);XCTAssertEqual(ordinary.sourceEventMode,"none");XCTAssertEqual(locked.sourceEventMode,"none")
        for t in stride(from:608.0,through:944,by:16){f.deliver(t)}
        XCTAssertEqual(ordinary.alpha,0.35,accuracy:0.001);XCTAssertEqual(locked.alpha,0.07,accuracy:0.001)
        ordinary.isHidden=true;XCTAssertTrue(owner.focusFourth(ordinary,focused:true))
        XCTAssertFalse(ordinary.isHidden);XCTAssertEqual(ordinary.alpha,1);XCTAssertEqual(ordinary.sourceEventMode,"static")
        XCTAssertEqual(draws,0);XCTAssertEqual(owner.activeRootCount,0)
        f.current=false;XCTAssertFalse(owner.focusFourth(ordinary,focused:false));f.deliver(960)
        XCTAssertEqual(ordinary.alpha,1);XCTAssertEqual(owner.activeRootCount,0)
    }
    func testFourthPointerReselectsAfterWall180AndMissingTargetRetriesWall420()async throws {
        let f=try Fixture();defer{f.dispose()};var selections=0,painted=0
        let owner=try XCTUnwrap(NativeSourceTutorialFourthPointerOwner(service:f.service,timeouts:f.timeouts,generation:1,current:{f.current},select:{
            selections+=1
            return selections==1 ? .init(from:CGRect(x:50,y:100,width:64,height:64),to:CGRect(x:220,y:300,width:64,height:64)):nil
        },fingertip:.zero,paint:{_ in painted+=1}))
        defer{owner.dispose()};XCTAssertTrue(owner.start());XCTAssertFalse(owner.start());XCTAssertEqual(selections,1);XCTAssertEqual(painted,0)
        for time in stride(from:608.0,through:1800,by:16){f.deliver(time)}
        XCTAssertGreaterThan(painted,1);XCTAssertEqual(selections,1)
        XCTAssertTrue(f.timeouts.pendingReceipts.contains{$0.sourceID=="tutorial-fourth-pointer180"})
        f.service.setSourceGlobalPaused(true)
        try await Task.sleep(for:.milliseconds(230));XCTAssertEqual(selections,2)
        XCTAssertTrue(f.timeouts.pendingReceipts.contains{$0.sourceID=="tutorial-fourth-pointer420"})
        try await Task.sleep(for:.milliseconds(480));XCTAssertEqual(selections,3)
        var unrelated=0
        _=f.timeouts.schedule(sourceID:"unrelated-fourth-pointer",generation:1,delayMilliseconds:80,elapsed:{unrelated+=1})
        owner.dispose();try await Task.sleep(for:.milliseconds(480))
        XCTAssertEqual(selections,3);XCTAssertEqual(unrelated,1)
        XCTAssertFalse(f.timeouts.pendingReceipts.contains{$0.sourceID.hasPrefix("tutorial-fourth-pointer")})
    }
    func testFourthPointerMatchesLiteralOriginalFunctionAndActualGSAPSamples()throws {
        struct Rect:Decodable{let left,top,width,height:Double;var cg:CGRect{.init(x:left,y:top,width:width,height:height)}}
        struct Point:Decodable{let x,y:Double}
        struct Sample:Decodable{let time,x,y,alpha,scale,rotation:Double}
        struct Case:Decodable{let from,to:Rect;let fingertip:Point;let duration:Double;let samples:[Sample]}
        let json = """
[{"from":{"left":70,"top":150,"width":60,"height":60},"to":{"left":220,"top":300,"width":60,"height":80},"fingertip":{"x":18,"y":24},"duration":1.02,"samples":[{"time":0,"x":0,"y":0,"alpha":0,"scale":0.9,"rotation":-8},{"time":0.04,"x":98,"y":156,"alpha":0.83125,"scale":0.983125,"rotation":-8},{"time":0.08,"x":98,"y":156,"alpha":1.1,"scale":1.01,"rotation":-8},{"time":0.159,"x":98,"y":156,"alpha":1.00007,"scale":1.000007,"rotation":-8},{"time":0.16,"x":98,"y":156,"alpha":1,"scale":1,"rotation":-8},{"time":0.31,"x":115.559834,"y":174.730489,"alpha":1,"scale":0.992976,"rotation":-7.180541},{"time":0.47,"x":173,"y":236,"alpha":1,"scale":0.97,"rotation":-4.5},{"time":0.779,"x":247.99922,"y":315.999168,"alpha":1,"scale":0.94,"rotation":-1.000036},{"time":0.78,"x":248,"y":316,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.82,"x":248,"y":316,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.86,"x":248,"y":316,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.9,"x":248,"y":316,"alpha":0.92388,"scale":0.93391,"rotation":-1},{"time":0.94,"x":248,"y":316,"alpha":0.707107,"scale":0.916569,"rotation":-1},{"time":1.02,"x":248,"y":316,"alpha":0,"scale":0.86,"rotation":-1}]},{"from":{"left":70,"top":150,"width":60,"height":60},"to":{"left":5,"top":160,"width":90,"height":52},"fingertip":{"x":18,"y":24},"duration":1.02,"samples":[{"time":0,"x":0,"y":0,"alpha":0,"scale":0.9,"rotation":-8},{"time":0.04,"x":98,"y":156,"alpha":0.83125,"scale":0.983125,"rotation":-8},{"time":0.08,"x":98,"y":156,"alpha":1.1,"scale":1.01,"rotation":-8},{"time":0.159,"x":98,"y":156,"alpha":1.00007,"scale":1.000007,"rotation":-8},{"time":0.16,"x":98,"y":156,"alpha":1,"scale":1,"rotation":-8},{"time":0.31,"x":92.146722,"y":156.702393,"alpha":1,"scale":0.992976,"rotation":-8.468262},{"time":0.47,"x":73,"y":159,"alpha":1,"scale":0.97,"rotation":-10},{"time":0.779,"x":48.00026,"y":161.999969,"alpha":1,"scale":0.94,"rotation":-11.999979},{"time":0.78,"x":48,"y":162,"alpha":1,"scale":0.94,"rotation":-12},{"time":0.82,"x":48,"y":162,"alpha":1,"scale":0.94,"rotation":-12},{"time":0.86,"x":48,"y":162,"alpha":1,"scale":0.94,"rotation":-12},{"time":0.9,"x":48,"y":162,"alpha":0.92388,"scale":0.93391,"rotation":-12},{"time":0.94,"x":48,"y":162,"alpha":0.707107,"scale":0.916569,"rotation":-12},{"time":1.02,"x":48,"y":162,"alpha":0,"scale":0.86,"rotation":-12}]},{"from":{"left":70,"top":150,"width":60,"height":60},"to":{"left":70,"top":420,"width":60,"height":60},"fingertip":{"x":18,"y":24},"duration":1.02,"samples":[{"time":0,"x":0,"y":0,"alpha":0,"scale":0.9,"rotation":-8},{"time":0.04,"x":98,"y":156,"alpha":0.83125,"scale":0.983125,"rotation":-8},{"time":0.08,"x":98,"y":156,"alpha":1.1,"scale":1.01,"rotation":-8},{"time":0.159,"x":98,"y":156,"alpha":1.00007,"scale":1.000007,"rotation":-8},{"time":0.16,"x":98,"y":156,"alpha":1,"scale":1,"rotation":-8},{"time":0.31,"x":98,"y":187.6077,"alpha":1,"scale":0.992976,"rotation":-7.180541},{"time":0.47,"x":98,"y":291,"alpha":1,"scale":0.97,"rotation":-4.5},{"time":0.779,"x":98,"y":425.998595,"alpha":1,"scale":0.94,"rotation":-1.000036},{"time":0.78,"x":98,"y":426,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.82,"x":98,"y":426,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.86,"x":98,"y":426,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.9,"x":98,"y":426,"alpha":0.92388,"scale":0.93391,"rotation":-1},{"time":0.94,"x":98,"y":426,"alpha":0.707107,"scale":0.916569,"rotation":-1},{"time":1.02,"x":98,"y":426,"alpha":0,"scale":0.86,"rotation":-1}]},{"from":{"left":70,"top":150,"width":60,"height":60},"to":{"left":70,"top":10,"width":60,"height":60},"fingertip":{"x":18,"y":24},"duration":1.02,"samples":[{"time":0,"x":0,"y":0,"alpha":0,"scale":0.9,"rotation":-8},{"time":0.04,"x":98,"y":156,"alpha":0.83125,"scale":0.983125,"rotation":-8},{"time":0.08,"x":98,"y":156,"alpha":1.1,"scale":1.01,"rotation":-8},{"time":0.159,"x":98,"y":156,"alpha":1.00007,"scale":1.000007,"rotation":-8},{"time":0.16,"x":98,"y":156,"alpha":1,"scale":1,"rotation":-8},{"time":0.31,"x":98,"y":139.61082199999998,"alpha":1,"scale":0.992976,"rotation":-7.180541},{"time":0.47,"x":98,"y":86,"alpha":1,"scale":0.97,"rotation":-4.5},{"time":0.779,"x":98,"y":16.00072800000001,"alpha":1,"scale":0.94,"rotation":-1.000036},{"time":0.78,"x":98,"y":16,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.82,"x":98,"y":16,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.86,"x":98,"y":16,"alpha":1,"scale":0.94,"rotation":-1},{"time":0.9,"x":98,"y":16,"alpha":0.92388,"scale":0.93391,"rotation":-1},{"time":0.94,"x":98,"y":16,"alpha":0.707107,"scale":0.916569,"rotation":-1},{"time":1.02,"x":98,"y":16,"alpha":0,"scale":0.86,"rotation":-1}]}]
"""
        let cases=try JSONDecoder().decode([Case].self,from:Data(json.utf8));XCTAssertEqual(cases.count,4)
        for c in cases {
            XCTAssertEqual(c.duration,NativeSourceTutorialFourthPointerPlan.duration,accuracy:1e-9)
            let plan=NativeSourceTutorialFourthPointerPlan(from:c.from.cg,to:c.to.cg)
            for sample in c.samples {
                // Original lazy .set has not painted at zero; the separate
                // actual-owner test requires zero synchronous paint calls.
                if sample.time==0 {XCTAssertEqual(sample.x,0);XCTAssertEqual(sample.y,0);continue}
                let pose=try XCTUnwrap(plan.pose(seconds:sample.time,fingertip:.init(x:c.fingertip.x,y:c.fingertip.y)))
                XCTAssertEqual(pose.position.x,sample.x,accuracy:1e-6);XCTAssertEqual(pose.position.y,sample.y,accuracy:1e-6)
                XCTAssertEqual(pose.alpha,sample.alpha,accuracy:1e-6);XCTAssertEqual(pose.scale,sample.scale,accuracy:1e-6)
                XCTAssertEqual(pose.rotation,sample.rotation,accuracy:1e-6)
            }
        }
    }
    func testFourthCompletion60UsesWallDuringPauseAndCompletesExactlyOnce()async throws {
        let f=try Fixture();defer{f.dispose()};var done=false,completed=0,polls=0
        let monitor=try XCTUnwrap(NativeSourceTutorialFourthCompletionMonitor(service:f.service,timeouts:f.timeouts,generation:1,current:{f.current},
            isComplete:{polls+=1;return done},complete:{completed+=1}))
        defer{monitor.dispose()};XCTAssertTrue(monitor.start());XCTAssertFalse(monitor.start())
        f.service.setSourceGlobalPaused(true);try await Task.sleep(for:.milliseconds(90))
        XCTAssertGreaterThanOrEqual(polls,1);XCTAssertEqual(completed,0);done=true
        try await Task.sleep(for:.milliseconds(90));XCTAssertEqual(completed,1);XCTAssertEqual(monitor.phase,.completing)
        let capturedPolls=polls;try await Task.sleep(for:.milliseconds(100));XCTAssertEqual(polls,capturedPolls);XCTAssertEqual(completed,1)
    }
    func testFourthCompletionRetirementInsidePredicateCannotExitOrCancelOtherTimer()async throws {
        let f=try Fixture();defer{f.dispose()};var monitor:NativeSourceTutorialFourthCompletionMonitor?,completed=0,unrelated=0
        monitor=try XCTUnwrap(NativeSourceTutorialFourthCompletionMonitor(service:f.service,timeouts:f.timeouts,generation:1,current:{f.current},
            isComplete:{monitor?.dispose();return true},complete:{completed+=1}))
        defer{monitor?.dispose()};_=f.timeouts.schedule(sourceID:"unrelated-fourth-completion",generation:1,delayMilliseconds:90,elapsed:{unrelated+=1})
        XCTAssertTrue(monitor?.start()==true);try await Task.sleep(for:.milliseconds(130))
        XCTAssertEqual(monitor?.phase,.retired);XCTAssertEqual(completed,0);XCTAssertEqual(unrelated,1)
    }
}
