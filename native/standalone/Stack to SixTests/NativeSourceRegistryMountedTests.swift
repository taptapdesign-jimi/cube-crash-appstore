import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceRegistryMountedTests:XCTestCase {
    @MainActor private final class Fixture {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let canvas=SKNode(),textures:NativeBoardTextures,node:NativeDiceNode,outer:NativeSourceOuterTimelineAdapter
        var installed:NativeDiceNode?
        init(){
            textures=NativeBoardTextures(root:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"))
            node=NativeDiceNode(id:"a",value:2,kind:"regular",variant:nil,depth:2,locked:false,textures:textures)
            outer=NativeSourceOuterTimelineAdapter(service:service);canvas.addChild(node)
            node.installSourceOuterDriver(outer,generation:1,geometryScale:0.5);installed=node
        }
        func observer(current:@escaping()->Bool={true},cell:@escaping()->NativeCell?={.init(column:0,row:0)})->NativeSourceNodeRuntimeObservation {
            .init(node:node,canvas:canvas,generation:1,lookup:{[weak self] _ in self?.installed},current:current,sourceCell:cell)
        }
        var model:NativeTile {.init(id:"a",cell:.init(column:0,row:0),value:2,stackDepth:2)}
        func dispose(){node.dispose();outer.dispose();service.dispose();textures.dispose()}
    }
    func testActualHiddenNodeRemainsSameObjectVisibleAlphaAndEventModeAreLiteral() throws {
        let f=Fixture();defer{f.dispose()};f.node.isHidden=true;f.node.alpha=0;f.node.sourceEventMode="passive"
        let observed=try XCTUnwrap(f.observer().read(f.model))
        XCTAssertFalse(observed.tile.visible);XCTAssertEqual(observed.tile.alpha,0);XCTAssertEqual(observed.eventMode,"passive")
        XCTAssertEqual(observed.tile.stackDepth,2);XCTAssertTrue(f.installed === f.node);XCTAssertFalse(observed.tile.pendingRemoval)
    }
    func testActualPendingSourceFaceReadsOldDepthUntilActualServiceRaf() throws {
        let f=Fixture();defer{f.dispose()};let observer=f.observer()
        XCTAssertTrue(f.node.queueSourceStackValue(5,addStack:1,service:f.service,random:{0.5},current:{true}))
        var logical=f.model;logical.value=5;logical.stackDepth=3
        let before=try XCTUnwrap(observer.read(logical));XCTAssertEqual(before.tile.value,5);XCTAssertEqual(before.tile.stackDepth,2);XCTAssertEqual(before.pendingStackFrames,1)
        f.service.deliver(wallMilliseconds:16)
        let after=try XCTUnwrap(observer.read(logical));XCTAssertEqual(after.tile.stackDepth,3);XCTAssertEqual(after.pendingStackFrames,0)
    }
    func testActualLookupReplacementAndParentLossNeverSynthesizesDestroyedNode() throws {
        let f=Fixture();defer{f.dispose()};let observer=f.observer()
        let c=NativeDiceNode(id:"a",value:2,kind:"regular",variant:nil,depth:2,locked:false,textures:f.textures)
        defer{c.dispose()};f.canvas.addChild(c);f.installed=c
        XCTAssertNil(observer.read(f.model));f.installed=f.node;f.node.removeFromParent();XCTAssertNil(observer.read(f.model))
    }
    func testMissingActualGridIdentityRefusesRatherThanBorrowingCoreOrPaint() throws {
        let f=Fixture();defer{f.dispose()}
        let observation=NativeSourceNodeRuntimeObservation(node:f.node,canvas:f.canvas,generation:1,
            lookup:{[weak f] _ in f?.installed},current:{true})
        f.node.position = .init(x:64,y:-64)
        XCTAssertNil(observation.read(f.model))
        XCTAssertFalse(f.node.bindSourceGridCell(f.model.cell,generation:1),"An unadmitted holder cannot acquire coverage through an observer")
    }
    func testPhysicalWildSemanticFieldsDoNotBorrowCoreFlags() throws {
        let f=Fixture();defer{f.dispose()}
        var stale=f.model;stale.sourceWildStateCleared=true;stale.sourceResidualWildPresence=true
        stale.merge6CleanupOwned=true;stale.nonFinalMerge6=true
        let observed=try XCTUnwrap(f.observer().read(stale))
        XCTAssertFalse(observed.tile.sourceWildStateCleared)
        XCTAssertFalse(observed.tile.sourceResidualWildPresence)
        XCTAssertFalse(observed.tile.merge6CleanupOwned)
        XCTAssertFalse(observed.tile.nonFinalMerge6)
        XCTAssertFalse(observed.tile.isWild)
    }
    func testReentrantCellGetterDisposalAndCurrentRetirementRejectsCapturedRead() throws {
        let f=Fixture();defer{f.dispose()}
        var observer:NativeSourceNodeRuntimeObservation!
        observer=f.observer(current:{true},cell:{observer.retire();return .init(column:0,row:0)})
        XCTAssertNil(observer.read(f.model))
        let next=f.observer(current:{f.node.dispose();return true});XCTAssertNil(next.read(f.model))
    }
    func testAppContextSharesOneRegistryAndReentrantReplacementRejectsOldClaim() throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,sourceDateMilliseconds:{100})
        var c:NativeGameplaySourceContext.Scope?
        let a=try XCTUnwrap(context.beginScene {c=context.beginScene {}})
        a.registries.endpointMounted(.specialContactCommitRelease);let token=try XCTUnwrap(a.registries.claimSpecial(kind:.star))
        XCTAssertNil(context.beginScene {});let replacement=try XCTUnwrap(c)
        XCTAssertFalse(a.registries.current);XCTAssertTrue(replacement.registries.current)
        XCTAssertEqual(replacement.registries.snapshot(isWild:false)?.special?.token,token)
        XCTAssertNil(a.registries.claimSpecial(kind:.tnt))
        XCTAssertTrue(a.registries.releaseSpecial(token:token));replacement.registries.endpointMounted(.specialContactCommitRelease)
        XCTAssertEqual(replacement.registries.claimSpecial(kind:.tnt),token+1)
        context.dispose();service.dispose()
    }
    func testScopeRetirementReleasesOnlyCapturedMagnetGuardAndClocksCannotExpireCurrentCount() throws {
        var now=100.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,sourceDateMilliseconds:{now})
        let a=try XCTUnwrap(context.beginScene {})
        a.registries.endpointMounted(.magnetGuardBeginFinally);let old=try XCTUnwrap(a.registries.beginMagnetGuard())
        service.deliver(wallMilliseconds:100000)
        XCTAssertEqual(a.registries.snapshot(isWild:false)?.endgameGuard.count,1,"Animation transport cannot expire an owned Source guard")
        let c=try XCTUnwrap(context.beginScene {})
        XCTAssertEqual(c.registries.snapshot(isWild:false)?.endgameGuard.count,0,"KING destructive Scene retirement releases its own captured guard")
        c.registries.endpointMounted(.magnetGuardBeginFinally);let current=try XCTUnwrap(c.registries.beginMagnetGuard())
        now=100000;service.deliver(wallMilliseconds:200000)
        XCTAssertEqual(c.registries.snapshot(isWild:false)?.endgameGuard.count,1,"Source count remains owned beyond advertised Date TTL")
        XCTAssertFalse(a.registries.releaseMagnetGuard(old,ownsLifecycle:true))
        XCTAssertEqual(c.registries.snapshot(isWild:false)?.endgameGuard.count,1,"Obsolete A cannot release C's captured identity")
        XCTAssertFalse(c.registries.releaseMagnetGuard(current,ownsLifecycle:false))
        XCTAssertTrue(c.registries.releaseMagnetGuard(current,ownsLifecycle:true));XCTAssertFalse(c.registries.releaseMagnetGuard(current,ownsLifecycle:true))
        XCTAssertEqual(c.registries.snapshot(isWild:false)?.endgameGuard.active,false)
        context.dispose();XCTAssertNil(c.registries.snapshot(isWild:false));service.dispose()
    }
    func testAppDisposalRetireCallbackCannotAdmitReplacementRegistryScope() throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0),context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0)
        var attempted=false
        let a=try XCTUnwrap(context.beginScene {attempted=true;XCTAssertNil(context.beginScene {})})
        context.dispose();XCTAssertTrue(attempted);XCTAssertFalse(a.registries.current)
        XCTAssertNil(a.registries.snapshot(isWild:false));service.dispose()
    }
}
