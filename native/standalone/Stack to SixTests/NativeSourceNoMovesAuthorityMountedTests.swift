import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceNoMovesAuthorityMountedTests:XCTestCase {
    @MainActor private final class Fixture {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let context:NativeGameplaySourceContext,game:NativeGameplayViewController
        init(){context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5});let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:4)]));engine.stagedSourceNoMoves=true
            game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root);game.sourceContext=context;game.sourceSmallStackPresentationEnabled=true;game.loadViewIfNeeded();game.view.frame = .init(x:0,y:0,width:390,height:844);game.boardScene?.layout(size:game.view.bounds.size,insets:.zero,animateEntry:false)
        }
        func bindings(authority:NativeSourceNoMovesRuntimeAuthority?=nil)->NativeSourceNoMovesSceneBindings {
            .init(runtimeAuthority:authority,visibleShowCue:{_,_ in},admitted:{[weak self] gen in self?.game.engine.state.generation==gen},refreshRuntime:{},ordinaryCallerReady:{_,_ in false},levelEndPreflight:{nil},stopIdleAndIdleSmoke:{},restartIdle:{},persistStuckState:{},resetHint:{},terminalFields:{_,_ in},queueGuardRelease:{_ in},scheduleGSAPRecheck:{_,_ in},exitFailure:{})
        }
        func authority()->NativeSourceNoMovesRuntimeAuthority {
            .init(isCurrent:{[weak game] in game?.sourceScope?.current==true},capture:{[weak game] in
                guard let game,let scene=game.boardScene,let node=scene.sourceNativeTileNode("a"),node.sourceContactNodeAlive,let canvas=node.parent else{return nil}
                let observation=NativeSourceNodeRuntimeObservation(node:node,canvas:canvas,generation:game.engine.state.generation,lookup:{[weak scene] in scene?.sourceNativeTileNode($0)},current:{[weak game] in game?.sourceScope?.current==true},sourceCell:{.init(column:0,row:0)})
                guard let model=game.engine.state.tiles.first,let observed=observation.read(model) else{return nil}
                var state=game.engine.state;state.tiles=[observed.tile]
                var row=NativeNoMovesTileRuntime();row.eventMode=observed.eventMode=="none" ? .none:observed.eventMode=="passive" ? .passive:.normal
                // Bounded idle regular-only fixture. Production marker endpoints
                // remain missing; these explicit test capabilities are not admission.
                return .init(state:state,tiles:["a":row],wildContinuationPending:false,gameplayTransactionActive:false,livingDragActive:false,endgameGuardActive:false,nonFinalMergeSixGuardActive:false,freshResult:NativeSourceEndgameChecker.check(state:state,runtime:["a":row]),capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
            })
        }
        func install(_ bindings:NativeSourceNoMovesSceneBindings,clear:@escaping()->Void={})->Bool {
            guard let scene=game.boardScene else{return false};scene.sourceNoMovesPresentationEnabled=true
            return scene.configureSourceNoMoves(bindings:bindings,showText:{_,_ in},beginTextExit:{_,reply in reply(false)},clearText:clear,confirmedBoardExit:{_,reply in reply(false)})
        }
        func dispose(){game.dispose();context.dispose();service.dispose()}
    }
    func testActualSceneAuthorityRequiresOptInAndMandatoryCapturedProvider()throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene)
        XCTAssertFalse(scene.sourceNoMovesRuntimeAuthorityEnabled);XCTAssertTrue(f.install(f.bindings()));XCTAssertNil(f.game.engine.sourceNoMovesRuntimeAuthority)
        scene.retireSourceNoMoves();scene.sourceNoMovesRuntimeAuthorityEnabled=true
        XCTAssertFalse(f.install(f.bindings()));XCTAssertNil(f.game.engine.sourceNoMovesRuntimeAuthority)
        let owner=f.authority();XCTAssertTrue(f.install(f.bindings(authority:owner)));XCTAssertNotNil(f.game.engine.sourceNoMovesRuntimeAuthority)
        guard case .candidate=f.game.engine.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail("genuine physical fixture")}
    }
    func testActualCapturedNodeParentLossRefusesBeforeCandidateWithoutFakeDestroyedMarker()throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene);scene.sourceNoMovesRuntimeAuthorityEnabled=true
        XCTAssertTrue(f.install(f.bindings(authority:f.authority())))
        let node=try XCTUnwrap(scene.sourceNativeTileNode("a"));node.removeFromParent()
        XCTAssertEqual(f.game.engine.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-check-error"));XCTAssertFalse(scene.sourceNoMovesCandidateActive)
    }
    func testRetiringAUnhooksBeforeClearAndPreservesReentrantSameSceneC()throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene);scene.sourceNoMovesRuntimeAuthorityEnabled=true
        let a=f.authority(),c=f.authority();var reentered=false;var capturedC:NativeSourceNoMovesRuntimeAuthority?
        XCTAssertTrue(f.install(f.bindings(authority:a),clear:{reentered=true;XCTAssertTrue(f.install(f.bindings(authority:c)));capturedC=f.game.engine.sourceNoMovesRuntimeAuthority}))
        scene.retireSourceNoMoves();XCTAssertTrue(reentered);XCTAssertTrue(f.game.engine.sourceNoMovesRuntimeAuthority === capturedC);XCTAssertNotNil(capturedC)
    }
    func testSceneDisposeRetiresOnlyItsOwnPublishedAuthorityAndCannotReinstall()throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene);scene.sourceNoMovesRuntimeAuthorityEnabled=true
        XCTAssertTrue(f.install(f.bindings(authority:f.authority()),clear:{XCTAssertFalse(f.install(f.bindings(authority:f.authority())))}))
        scene.dispose();XCTAssertNil(f.game.engine.sourceNoMovesRuntimeAuthority)
    }
    func testExternalCurrentReplacementDoesNotOverwriteIndependentCoreProviderC()throws {
        let f=Fixture();defer{f.dispose()};let scene=try XCTUnwrap(f.game.boardScene);scene.sourceNoMovesRuntimeAuthorityEnabled=true
        let c=f.authority(),a=NativeSourceNoMovesRuntimeAuthority(isCurrent:{f.game.engine.sourceNoMovesRuntimeAuthority=c;return true},capture:{XCTFail("obsolete A");return nil})
        XCTAssertFalse(f.install(f.bindings(authority:a)));XCTAssertTrue(f.game.engine.sourceNoMovesRuntimeAuthority === c)
        scene.retireSourceNoMoves();XCTAssertTrue(f.game.engine.sourceNoMovesRuntimeAuthority === c)
    }

}
