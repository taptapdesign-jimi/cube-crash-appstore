import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

nonisolated final class NativeSpecialMainBridgeTests:XCTestCase {
    @MainActor private final class Node {let id:String;var alive=true;init(_ id:String){self.id=id}}
    @MainActor private final class Fixture {
        let engine:NativeGameplayEngine,plan:NativeSpecialMovePlan,source=Node("src"),destination=Node("dst")
        var sourceCurrent=true,destinationCurrent=true,runCurrent=true,faceReady=true
        var trace:[String]=[],captured:NativeSourceSpecialMainCapture<Node>!
        var reenterRegister:(()->Void)?,reenterCancel:(()->Void)?,reenterCurrent:(()->Void)?,reenterNode:(()->Void)?,reenterCommit:(()->Void)?
        init(_ archetype:NativeWildArchetype = .magnet) throws {
            engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"src",cell:.init(column:0,row:0),value:6,archetype:archetype),.init(id:"dst",cell:.init(column:1,row:0),value:2),.init(id:"pull",cell:.init(column:0,row:1),value:3)]))
            engine.stagedTntActivation=true
            XCTAssertTrue(engine.beginDrag(tileID:"src"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            plan=try XCTUnwrap(engine.pendingSpecial)
            captured=NativeSourceSpecialMainCapture(plan:plan,source:source,destination:destination,hooks:.init(generationCurrent:{[unowned self] in let current=runCurrent && engine.state.generation==plan.generation;reenterCurrent?();return current},nodeCurrent:{[unowned self] node,id,_ in
                let current=id=="src" ? node === source && sourceCurrent && source.alive:node === destination && destinationCurrent && destination.alive;reenterNode?();return current
            },register:{[unowned self] in
                trace.append("register");let receipt=engine.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation);reenterRegister?();return receipt
            },commit:{[unowned self] receipt in trace.append("first-main");let result=engine.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted;reenterCommit?();return result},mainReady:{[unowned self] in faceReady},cancel:{[unowned self] receipt in trace.append("cancel-core");reenterCancel?();return engine.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation).accepted},removeCapturedPair:{[unowned self] src,dst in
                XCTAssertTrue(src === source);XCTAssertTrue(dst === destination);trace.append("remove-captured");source.alive=false;destination.alive=false
            },cleanupCapturedPull:{[unowned self] in trace.append("pull-cleanup")},releaseMainFramesAndIdle:{[unowned self] in trace.append("main100-idle")},releaseSpecialAndQueue:{[unowned self] in trace.append("special-queue")},publishCanceledState:{[unowned self] in trace.append("publish")},continueAfterMain:{[unowned self] in
                XCTAssertTrue(engine.sourceSpecialAbsorbMainEntered);trace.append("continue")
            },retireNativeRoots:{[unowned self] in trace.append("retire-roots")}))
        }
    }
    func testActualMainCompletionWaitsForIndependentFaceAndCannotResumeAfterCancellation()async throws {
        try await MainActor.run {
            let f=try Fixture(.tnt),id=UUID();f.faceReady=false
            XCTAssertTrue(f.captured.mainInstalled(id))
            XCTAssertFalse(f.captured.resumeDeliveredMain())
            XCTAssertFalse(f.captured.mainCompleted(id))
            XCTAssertEqual(f.captured.phase,.installed);XCTAssertEqual(f.trace,["register"])
            XCTAssertFalse(f.engine.sourceSpecialAbsorbMainEntered)
            f.faceReady=true
            XCTAssertTrue(f.captured.resumeDeliveredMain())
            XCTAssertEqual(f.trace,["register","first-main","continue"])
            XCTAssertFalse(f.captured.resumeDeliveredMain())
            let cancelled=try Fixture(.tnt),cancelID=UUID();cancelled.faceReady=false
            XCTAssertTrue(cancelled.captured.mainInstalled(cancelID))
            XCTAssertFalse(cancelled.captured.mainCompleted(cancelID))
            XCTAssertTrue(cancelled.captured.mainInterrupted(cancelID))
            let trace=cancelled.trace;cancelled.faceReady=true
            XCTAssertFalse(cancelled.captured.resumeDeliveredMain());XCTAssertEqual(cancelled.trace,trace)
            XCTAssertNil(cancelled.engine.pendingSpecial)
        }
    }
    func testHiddenSourceRemovedFromModelRetainsExactObjectsOnlyAfterActualCapture()async throws {
        try await MainActor.run {
            let f=try Fixture();XCTAssertNil(f.engine.state.tiles.first{$0.id=="src"});XCTAssertTrue(f.captured.retains(f.source,id:"src",generation:f.plan.generation))
            XCTAssertFalse(f.captured.retains(Node("src"),id:"src",generation:f.plan.generation));XCTAssertTrue(f.captured.retains(f.destination,id:"dst",generation:f.plan.generation))
            XCTAssertNil(f.engine.pendingSourceSpecialAbsorb);let id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));XCTAssertNotNil(f.engine.pendingSourceSpecialAbsorb)
            XCTAssertTrue(f.captured.mainCompleted(id));XCTAssertEqual(f.trace,["register","first-main","continue"])
            XCTAssertNil(f.engine.pendingMagnetRespawn);XCTAssertFalse(f.captured.mainInterrupted(id));XCTAssertFalse(f.captured.retains(f.source,id:"src",generation:f.plan.generation))
        }
    }
    func testActualInterruptRemovesOnlyCapturedPairAndReleasesDistinctOwnersOnce()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));f.reenterCancel={f.captured.mainInterrupted(id)}
            let before=f.engine.state;XCTAssertTrue(f.captured.mainInterrupted(id));XCTAssertFalse(f.captured.mainInterrupted(id));XCTAssertFalse(f.captured.mainCompleted(id))
            XCTAssertEqual(f.trace,["register","cancel-core","remove-captured","pull-cleanup","main100-idle","special-queue","publish","retire-roots"])
            XCTAssertEqual(f.engine.state.rngState,before.rngState);XCTAssertEqual(f.engine.state.moves,before.moves);XCTAssertNil(f.engine.pendingSpecial);XCTAssertEqual(f.engine.state.tiles.map(\.id),["pull"])
        }
    }
    func testParentLossIsExplicitInterruptButPauseHasNoSyntheticCallback()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));let before=f.engine.state
            // Global pause retains actual roots: no method called, no fake dt.
            XCTAssertEqual(f.engine.state,before);XCTAssertEqual(f.captured.phase,.installed);XCTAssertEqual(f.trace,["register"])
            f.sourceCurrent=false;f.captured.capturedObjectRetired();XCTAssertNil(f.engine.pendingSpecial);XCTAssertEqual(f.captured.phase,.interrupted)
        }
    }
    func testObsoleteNativeReplyDoesNotRemoveReplacementOrReleaseNewOwners()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));f.runCurrent=false
            f.engine.restart(state:.init(tiles:[.init(id:"dst",cell:.init(column:1,row:0),value:4)]));XCTAssertFalse(f.captured.mainInterrupted(id))
            XCTAssertEqual(f.trace,["register","retire-roots"]);XCTAssertTrue(f.source.alive);XCTAssertTrue(f.destination.alive);XCTAssertEqual(f.engine.state.tiles.first?.value,4)
        }
    }
    func testRegisterReentryDestructionStillConsumesRegisteredSameRunReceiptOnce()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();f.reenterRegister={f.sourceCurrent=false}
            XCTAssertFalse(f.captured.mainInstalled(id));XCTAssertNil(f.engine.pendingSpecial);XCTAssertEqual(f.trace.filter{$0=="cancel-core"}.count,1)
        }
    }
    func testTntFirstMainClosesCancellationBeforeActivationWithoutPullCleanup()async throws {
        try await MainActor.run {
            let f=try Fixture(.tnt),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));XCTAssertTrue(f.captured.mainCompleted(id));XCTAssertFalse(f.engine.specialActivationCommitted)
            XCTAssertFalse(f.captured.mainInterrupted(id));XCTAssertFalse(f.trace.contains("pull-cleanup"));XCTAssertTrue(f.engine.commitSpecialActivation(transactionID:f.plan.id).accepted)
        }
    }
    func testActualPullChildInterruptionPreservesRegistrationOrderOriginalPoseAndNoIdleRestart()async {
        await MainActor.run {
            var trace:[String]=[],flag=true;let nodes=[Node("a"),Node("b"),Node("destroyed")];nodes[2].alive=false
            let ids=nodes.map{_ in UUID()};var owner:NativeSourceSpecialPullCleanup<Node>!
            let children=nodes.enumerated().map{index,node in NativeSourceSpecialPullCleanup<Node>.Child(rootID:ids[index],node:node,alive:{node.alive},restoreOriginal:{trace.append("restore:"+node.id)},killActualRoot:{trace.append("kill:"+node.id);owner.childInterrupted(ids[index])})}
            owner=NativeSourceSpecialPullCleanup(children:children,hooks:.init(runCurrent:{true},releasePull100:{trace.append("pull100")},stopCurrentForce:{trace.append("force-stop")},pullFlagIsSet:{flag},resetPullFlagAndQueue:{flag=false;trace.append("pull-queue")},clearCapturedCleanupPointer:{trace.append("clear-pointer")}))
            owner.cleanupAll();owner.cleanupAll()
            XCTAssertEqual(trace,["pull100","force-stop","kill:a","restore:a","kill:b","restore:b","kill:destroyed","pull-queue","clear-pointer"]);XCTAssertFalse(flag)
        }
    }
    func testCommittedPullPreservesSoundAndNeverRestoresFromLaterChildKill()async {
        await MainActor.run {
            let node=Node("a"),id=UUID();var restored=0,stopped=0;var owner:NativeSourceSpecialPullCleanup<Node>!
            owner=NativeSourceSpecialPullCleanup(children:[.init(rootID:id,node:node,alive:{true},restoreOriginal:{restored+=1},killActualRoot:{owner.childInterrupted(id)})],hooks:.init(runCurrent:{true},releasePull100:{},stopCurrentForce:{stopped+=1},pullFlagIsSet:{false},resetPullFlagAndQueue:{XCTFail("not set")},clearCapturedCleanupPointer:{}))
            owner.markMergeStarted();owner.cleanupAll(preserveCommittedPullSound:true);XCTAssertEqual(restored,0);XCTAssertEqual(stopped,0)
            XCTAssertEqual(NativeSourceMagnetForceStop.voiceIDs.count,5);XCTAssertFalse(NativeSourceMagnetForceStop.voiceIDs.contains("honey-pull-merge-primary"));XCTAssertFalse(NativeSourceMagnetForceStop.voiceIDs.contains("clean-board-cta-bounce-primary"))
        }
    }
    private struct OriginalAudio:Decodable {struct Row:Decodable {let enabled:Bool,stops:[String],timerClears:Int};let audioRows:[Row]}
    func testNativeScopedStopMatchesOriginalSourceEvenWhenSoundsOff()async throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceStopQueueOracle",withExtension:"json") ?? Bundle(for:Self.self).url(forResource:"SourceStopQueueOracle",withExtension:"json",subdirectory:"Resources")),source=try JSONDecoder().decode(OriginalAudio.self,from:Data(contentsOf:url))
        await MainActor.run {for row in source.audioRows {XCTAssertEqual(Set(row.stops),NativeSourceMagnetForceStop.voiceIDs);XCTAssertEqual(row.timerClears,1)};XCTAssertEqual(source.audioRows.count,6)}
    }
    private struct OriginalPull:Decodable {
        struct Target:Decodable {let id:String,destroyed:Bool};struct Row:Decodable {let targets:[Target],frameRelease:Int,idleRelease:Int,pullRelease:Int,stopped:Int,queued:Int,bindings:Int};let rows:[Row]
    }
    func testCapturedCleanupCallbacksMatchOriginal32ActualGsapCases()async throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceSpecialPullInterruptOracle",withExtension:"json") ?? Bundle(for:Self.self).url(forResource:"SourceSpecialPullInterruptOracle",withExtension:"json",subdirectory:"Resources")),source=try JSONDecoder().decode(OriginalPull.self,from:Data(contentsOf:url))
        await MainActor.run {
            XCTAssertEqual(source.rows.count,32)
            for row in source.rows {
                var pullReleased=0,stopped=0,queues=0,bindings=0,flag=true;var owner:NativeSourceSpecialPullCleanup<Node>!
                let nodes=row.targets.map{t in let node=Node(t.id);node.alive = !t.destroyed;return node},ids=nodes.map{_ in UUID()}
                let children=nodes.enumerated().map{index,node in NativeSourceSpecialPullCleanup<Node>.Child(rootID:ids[index],node:node,alive:{node.alive},restoreOriginal:{bindings+=1},killActualRoot:{owner.childInterrupted(ids[index])})}
                owner=NativeSourceSpecialPullCleanup(children:children,hooks:.init(runCurrent:{true},releasePull100:{pullReleased+=1},stopCurrentForce:{stopped+=1},pullFlagIsSet:{flag},resetPullFlagAndQueue:{flag=false;queues+=1},clearCapturedCleanupPointer:{}))
                owner.cleanupAll();queues+=1 // separate Source releaseSpecial request, not Core claim
                XCTAssertEqual(pullReleased,row.pullRelease);XCTAssertEqual(stopped,row.stopped);XCTAssertEqual(queues,row.queued);XCTAssertEqual(bindings,row.bindings)
            }
        }
    }
}

extension NativeSpecialMainBridgeTests {
    func testRegisterHookRetirementDoesNotReinstallButCleansLateAcceptedReceiptOnce()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();f.reenterRegister={f.captured.capturedObjectRetired()}
            XCTAssertFalse(f.captured.mainInstalled(id));XCTAssertEqual(f.captured.phase,.retired);XCTAssertNil(f.engine.pendingSpecial)
            XCTAssertEqual(f.trace.filter{$0=="cancel-core"}.count,1);XCTAssertEqual(f.trace.filter{$0=="retire-roots"}.count,1)
            XCTAssertFalse(f.captured.mainInstalled(UUID()));XCTAssertFalse(f.captured.mainCompleted(id));XCTAssertFalse(f.captured.isCurrent)
        }
    }
    func testCurrentPredicateThatRetiresThenReturnsTrueCannotEnterOrCommitMain()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));f.reenterNode={f.captured.retireObsolete()}
            XCTAssertFalse(f.captured.mainCompleted(id));XCTAssertEqual(f.captured.phase,.retired);XCTAssertFalse(f.engine.sourceSpecialAbsorbMainEntered)
            XCTAssertFalse(f.trace.contains("first-main"));XCTAssertFalse(f.trace.contains("continue"))
            let before=try Fixture();before.reenterCurrent={before.captured.retireObsolete()};XCTAssertFalse(before.captured.mainInstalled(UUID()));XCTAssertNil(before.engine.pendingSourceSpecialAbsorb)
        }
    }
    func testAcceptedCommitThatRetiresCannotRunLaterFamilyContinuation()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));f.reenterCommit={f.captured.retireObsolete()}
            XCTAssertFalse(f.captured.mainCompleted(id));XCTAssertTrue(f.engine.sourceSpecialAbsorbMainEntered);XCTAssertEqual(f.captured.phase,.retired)
            XCTAssertFalse(f.trace.contains("continue"));XCTAssertFalse(f.captured.mainInterrupted(id));XCTAssertEqual(f.trace.filter{$0=="retire-roots"}.count,1)
        }
    }
    func testPullAliveGetterReentryRetiresBeforeRestoration()async {
        await MainActor.run {
            let node=Node("a"),id=UUID();var restored=0,stopped=0,queued=0;var owner:NativeSourceSpecialPullCleanup<Node>!
            owner=NativeSourceSpecialPullCleanup(children:[.init(rootID:id,node:node,alive:{owner.retireObsolete();return true},restoreOriginal:{restored+=1},killActualRoot:{owner.childInterrupted(id)})],hooks:.init(runCurrent:{true},releasePull100:{},stopCurrentForce:{stopped+=1},pullFlagIsSet:{true},resetPullFlagAndQueue:{queued+=1},clearCapturedCleanupPointer:{}))
            owner.childInterrupted(id);XCTAssertTrue(owner.retired);XCTAssertEqual(restored,0);owner.cleanupAll();XCTAssertEqual(stopped,0);XCTAssertEqual(queued,0)
        }
    }
    func testPullRunPredicateRetirementCannotStopReplacementForceOrQueue()async {
        await MainActor.run {
            let node=Node("a"),id=UUID();var restored=0,stopped=0,queued=0,cleared=0;var owner:NativeSourceSpecialPullCleanup<Node>!
            owner=NativeSourceSpecialPullCleanup(children:[.init(rootID:id,node:node,alive:{true},restoreOriginal:{restored+=1},killActualRoot:{owner.childInterrupted(id)})],hooks:.init(runCurrent:{owner.retireObsolete();return true},releasePull100:{},stopCurrentForce:{stopped+=1},pullFlagIsSet:{true},resetPullFlagAndQueue:{queued+=1},clearCapturedCleanupPointer:{cleared+=1}))
            owner.cleanupAll();XCTAssertTrue(owner.retired);XCTAssertEqual(restored,0);XCTAssertEqual(stopped,0);XCTAssertEqual(queued,0);XCTAssertEqual(cleared,0)
        }
    }
}

extension NativeSpecialMainBridgeTests {
    func testCoreCancelRejectedAfterReentrantRestartHasNoCapturedSideEffects()async throws {
        try await MainActor.run {
            let f=try Fixture(),id=UUID();XCTAssertTrue(f.captured.mainInstalled(id));f.reenterCancel={f.engine.restart(state:.init(tiles:[.init(id:"dst",cell:.init(column:1,row:0),value:4)]))}
            XCTAssertFalse(f.captured.mainInterrupted(id));XCTAssertFalse(f.captured.mainInterrupted(id));XCTAssertEqual(f.trace,["register","cancel-core","retire-roots"])
            XCTAssertEqual(f.engine.state.tiles.first?.value,4);XCTAssertTrue(f.source.alive);XCTAssertTrue(f.destination.alive)
        }
    }
}
