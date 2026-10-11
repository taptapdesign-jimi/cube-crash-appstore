import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceCanonicalSaveMountedTests:XCTestCase {
    typealias Owner=NativeSourceCanonicalSaveOwner<NativeBoardState>
    @MainActor private final class Fixture {
        var now=0.0
        let service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,game:NativeGameplayViewController
        init() {
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5})
            let e=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1),.init(id:"b",cell:.init(column:1,row:0),value:2),.init(id:"c",cell:.init(column:2,row:0),value:4)]))
            game=NativeGameplayViewController(engine:e,resourceRoot:NativeTestResources.root)
            game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true;game.loadViewIfNeeded()
            game.view.frame=CGRect(x:0,y:0,width:390,height:844)
            game.boardScene?.layout(size:game.view.bounds.size,insets:.init(top:47,left:0,bottom:34,right:0),animateEntry:false)
        }
        func dispose(){game.dispose();context.dispose();service.dispose()}
        func hooks(scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,observe:@escaping(Owner.CaptureRequest)->Void={_ in},write:@escaping(NativeBoardState)->Bool,wallObserved:@escaping(Int)->Void={_ in})->Owner.Hooks {
            .init(current:{scope.current},capture:{[weak game] request in
                observe(request);guard let game else{return nil};let state=game.engine.state
                return .init(state:state,guardFields:.init(runMode:state.mode.rawValue,skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,gameplayTransientBusy:false,freshArcadeEntryAuthorized:false),missingOwners:[],nativeCoherent:!game.engine.hasUnsavableSourceGameplayState)
            },stillMatches:{[weak game] in game?.engine.state==$0},write:write,wall:{ms,elapsed in wallObserved(ms);return scene.scheduleSourceCanonicalSaveWall(milliseconds:ms,generation:scene.engine.state.generation,elapsed:elapsed)})
        }
    }
    func testActualSceneWall400ContinuesUnderGlobalPauseAndReadsCurrentBoardAtDelivery()async throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene),scope=try XCTUnwrap(f.game.sourceScope)
        let done=expectation(description:"actual source wall400 write"),b=try XCTUnwrap(scope.installCanonicalSave(hooks:f.hooks(scope:scope,scene:scene,write:{state in XCTAssertEqual(state,f.game.engine.state);done.fulfill();return true})))
        XCTAssertTrue(scene.configureSourceCanonicalSave(scope:scope,binding:b));f.game.setSuspended(true)
        XCTAssertEqual(b.wildQueueFinallySave(milliseconds:400),.scheduled(400));XCTAssertEqual(b.wildQueueFinallySave(milliseconds:600),.missingOwners)
        await fulfillment(of:[done],timeout:2);XCTAssertTrue(b.current)
    }
    func testActualAcceptedSubSixContactSchedules1200BeforeMainWithoutEarlySaveAndVetoesPausedTransient()async throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene),scope=try XCTUnwrap(f.game.sourceScope),geometry=try XCTUnwrap(scene.boardGeometry)
        var writes=0,wall:[Int]=[];let delivered=expectation(description:"actual contact1200 capture")
        let b=try XCTUnwrap(scope.installCanonicalSave(hooks:f.hooks(scope:scope,scene:scene,observe:{request in if case .save=request{delivered.fulfill()}},write:{_ in writes+=1;return true},wallObserved:{wall.append($0)})))
        XCTAssertTrue(scene.configureSourceCanonicalSave(scope:scope,binding:b))
        XCTAssertTrue(scene.beginDrag(at:geometry.center(row:0,column:0)));f.service.deliver(wallMilliseconds:25)
        scene.moveDrag(to:geometry.center(row:0,column:1),now:0.025)
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:0.025)).accepted)
        XCTAssertEqual(wall,[1200]);XCTAssertEqual(writes,0);XCTAssertNotNil(f.game.engine.pendingOrdinaryStack)
        f.game.setSuspended(true);await fulfillment(of:[delivered],timeout:2.5)
        XCTAssertEqual(writes,0);XCTAssertNotNil(f.game.engine.pendingOrdinaryStack)
        // Exact Source global pause retained the real absorb. No fake save at80.
    }
    func testScopeReplacementRetiresOldWallReceiptAndOldBindingCannotEraseCurrentC()async throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene),scope=try XCTUnwrap(f.game.sourceScope)
        var oldWrites=0;let done=expectation(description:"C wall400")
        let a=try XCTUnwrap(scope.installCanonicalSave(hooks:f.hooks(scope:scope,scene:scene,write:{_ in oldWrites+=1;return true})))
        XCTAssertTrue(scene.configureSourceCanonicalSave(scope:scope,binding:a));_ = a.notify(.wildQueueFinally)
        let c=try XCTUnwrap(scope.installCanonicalSave(hooks:f.hooks(scope:scope,scene:scene,write:{_ in done.fulfill();return true})))
        XCTAssertTrue(scene.configureSourceCanonicalSave(scope:scope,binding:c));a.retire();_ = c.notify(.wildQueueFinally)
        await fulfillment(of:[done],timeout:2);XCTAssertEqual(oldWrites,0);XCTAssertTrue(c.current)
    }
    func testActualSceneDisposalSealsCanonicalOnlyEndpointBeforeExternalCancelReentry()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        let scope=try XCTUnwrap(context.beginScene{}),state=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        defer{scene.dispose();context.dispose();service.dispose()};var binding:Owner.Binding!,cancelCount=0
        let hooks=Owner.Hooks(current:{scope.current},capture:{_ in .init(state:state,guardFields:.init(runMode:"journey",skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,gameplayTransientBusy:false,freshArcadeEntryAuthorized:false),missingOwners:[],nativeCoherent:true)},stillMatches:{$0==state},write:{_ in XCTFail("disposed receipt");return false},wall:{_,_ in return{cancelCount+=1;XCTAssertFalse(scene.sourceAnimationBindingAdmissionOpen);XCTAssertFalse(scene.configureSourceCanonicalSave(scope:scope,binding:binding))}})
        binding=try XCTUnwrap(scope.installCanonicalSave(hooks:hooks));XCTAssertTrue(scene.configureSourceCanonicalSave(scope:scope,binding:binding));_ = binding.notify(.wildQueueFinally)
        scene.dispose();XCTAssertEqual(cancelCount,1);XCTAssertFalse(binding.current)
    }
    func testSaveSpecialQueryExpiresOnlyActualSpecialAndRetainsCapturedInputUntilItsOwnRelease()throws {
        var now=0.0,dates=0
        let session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{dates+=1;return now}),scope=session.beginScope(epoch:1)
        scope.bindParentCurrent{true};XCTAssertNil(scope.specialActiveForSave());scope.endpointMounted(.specialContactCommitRelease)
        let token=try XCTUnwrap(scope.claimSpecial(kind:.star));XCTAssertTrue(try XCTUnwrap(scope.specialActiveForSave()))
        now=15001;let before=dates;XCTAssertFalse(try XCTUnwrap(scope.specialActiveForSave()));XCTAssertEqual(dates,before+1)
        XCTAssertEqual(session.retainedSpecialInputCaptureCount,1,"save query never releases the separate captured input lease")
        _=scope.releaseSpecial(token:token);XCTAssertEqual(session.retainedSpecialInputCaptureCount,0);session.dispose()
    }
    func testSaveSpecialQueryCannotPublishAfterSourceDateReentrantScopeReplacement()throws {
        var replace=false,c:NativeGameplaySourceRegistrySession.Scope?,session:NativeGameplaySourceRegistrySession!
        session=NativeGameplaySourceRegistrySession(sourceDateMilliseconds:{if replace{replace=false;c=session.beginScope(epoch:2);c?.bindParentCurrent{true}};return 50})
        let a=session.beginScope(epoch:1);a.bindParentCurrent{true};a.endpointMounted(.specialContactCommitRelease)
        replace=true;XCTAssertNil(a.specialActiveForSave());XCTAssertFalse(a.current);XCTAssertTrue(try XCTUnwrap(c).current);session.dispose()
    }
}
