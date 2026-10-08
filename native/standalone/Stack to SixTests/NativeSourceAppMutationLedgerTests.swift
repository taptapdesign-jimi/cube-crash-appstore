import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

nonisolated final class NativeSourceAppMutationLedgerTests:XCTestCase {
    @MainActor func engine(_ generation:UInt64=1)->NativeGameplayEngine {
        NativeGameplayEngine(state:.init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:1)],generation:generation))
    }
    @MainActor func write(_ e:NativeGameplayEngine,_ writer:NativeSourceMeterMutationLedger.Writer,_ now:Int64)->Bool {
        e.recordSourceMeterBoardMutation(writer,generation:e.state.generation,sourceDateMilliseconds:now)
    }
    @MainActor func testAllFourActualWriterStatesCarryIntoFreshCoreWithoutAdditionalDateWrite()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),lease=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(write(a,.regularHandoffBegan(4),100));XCTAssertTrue(write(a,.regularHandoffReleased(4),140))
        XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(8),150));XCTAssertTrue(write(a,.checkLevelEndSignatureObserved(.init(activeEntries:[])),190))
        lease.captureBeforeRetirement();let captured=try XCTUnwrap(owner.snapshot),c=engine(10)
        XCTAssertEqual(captured.lastMutationDateMilliseconds,190);XCTAssertNotNil(owner.bind(c))
        XCTAssertEqual(c.sourceMeterLastBoardMutationDateMilliseconds,190)
        XCTAssertEqual(c.sourceMeterMutationSnapshot.generation,10)
        XCTAssertFalse(write(c,.regularHandoffBegan(4),500));XCTAssertFalse(write(c,.mergeSixSpawnOwnerAllocated(8),500))
        XCTAssertFalse(write(c,.checkLevelEndSignatureObserved(.init(activeEntries:[])),500))
        XCTAssertEqual(c.sourceMeterLastBoardMutationDateMilliseconds,190)
    }
    @MainActor func testNewRunClearsTransientHandoffsButPreservesTokenCounterDateAndSignature()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),lease=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(write(a,.regularHandoffBegan(7),100));XCTAssertEqual(a.sourceMeterMutationSnapshot.activeRegularHandoffs,[7])
        lease.captureBeforeRetirement();let c=engine(2);XCTAssertNotNil(owner.bind(c))
        XCTAssertTrue(c.sourceMeterMutationSnapshot.activeRegularHandoffs.isEmpty)
        XCTAssertFalse(write(c,.regularHandoffReleased(7),120));XCTAssertFalse(write(c,.regularHandoffBegan(7),120))
        XCTAssertTrue(write(c,.regularHandoffBegan(8),140));XCTAssertEqual(c.sourceMeterLastBoardMutationDateMilliseconds,140)
    }
    @MainActor func testFreshAlreadyWrittenCoreRefusesLateAdoptionAndKeepsBothHistories()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),lease=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(9),123));lease.captureBeforeRetirement()
        let late=engine(20);XCTAssertTrue(write(late,.mergeSixSpawnOwnerAllocated(1),456))
        XCTAssertNil(owner.bind(late));XCTAssertEqual(late.sourceMeterLastBoardMutationDateMilliseconds,456)
        XCTAssertEqual(owner.snapshot?.lastMutationDateMilliseconds,123)
        let c=engine(21);XCTAssertNotNil(owner.bind(c));XCTAssertEqual(c.sourceMeterLastBoardMutationDateMilliseconds,123)
    }
    @MainActor func testInitialAlreadyAdoptedCoreAlsoRefusesBeforeFirstOwnedWriter()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine()
        XCTAssertTrue(a.adoptSourceMeterMutationSnapshot(.init(generation:1),generation:1))
        XCTAssertNil(owner.bind(a));XCTAssertNil(owner.snapshot)
    }
    @MainActor func testSameActualCoreRebindKeepsGenuineRestartAndNeverAdoptsOverIt()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),lease=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(5),100));a.restart(state:a.state)
        lease.captureBeforeRetirement();let replacement=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(replacement.owns(a));XCTAssertEqual(a.sourceMeterLastBoardMutationDateMilliseconds,100)
        XCTAssertEqual(owner.snapshot?.generation,a.state.generation)
        XCTAssertFalse(write(a,.mergeSixSpawnOwnerAllocated(5),120));XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(6),140))
    }
    @MainActor func testSameCoreRetirementCallbackGenuineWriterRemainsAuthoritativeOnIdentityRebind()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),lease=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(write(a,.regularHandoffBegan(1),100));lease.captureBeforeRetirement()
        XCTAssertTrue(write(a,.regularHandoffReleased(1),200))
        XCTAssertNotNil(owner.bind(a));XCTAssertEqual(a.sourceMeterLastBoardMutationDateMilliseconds,200)
        XCTAssertEqual(owner.snapshot?.lastMutationDateMilliseconds,200)
    }
    @MainActor func testObsoleteLeaseCannotOverwriteFreshCWithLateOldWriterOrDuplicateRetirement()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),aLease=try XCTUnwrap(owner.bind(a))
        XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(3),100));aLease.captureBeforeRetirement()
        let c=engine(2),cLease=try XCTUnwrap(owner.bind(c));XCTAssertTrue(write(c,.mergeSixSpawnOwnerAllocated(4),200))
        XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(5),999));aLease.captureBeforeRetirement();cLease.captureBeforeRetirement()
        XCTAssertEqual(owner.snapshot?.lastMutationDateMilliseconds,200)
    }
    @MainActor func testBindingRetainsActualCoreUntilSynchronousCaptureAndThenReleasesIt()async throws {
        let owner=NativeSourceAppMutationLedger();var a:NativeGameplayEngine?=engine();weak var observed=a
        let lease=try XCTUnwrap(owner.bind(try XCTUnwrap(a)));XCTAssertTrue(write(try XCTUnwrap(a),.mergeSixSpawnOwnerAllocated(1),321))
        a=nil;XCTAssertNotNil(observed);lease.captureBeforeRetirement();XCTAssertNil(observed)
        XCTAssertEqual(owner.snapshot?.lastMutationDateMilliseconds,321)
    }
    @MainActor func testActiveOrDisposedLedgerCannotBindAnotherEngineWithoutActualRetirement()async throws {
        let owner=NativeSourceAppMutationLedger(),a=engine(),lease=try XCTUnwrap(owner.bind(a))
        XCTAssertNil(owner.bind(engine(2)));XCTAssertTrue(lease.owns(a))
        XCTAssertTrue(write(a,.mergeSixSpawnOwnerAllocated(1),123));owner.dispose();owner.dispose()
        XCTAssertFalse(lease.owns(a));XCTAssertEqual(owner.snapshot?.lastMutationDateMilliseconds,123)
        XCTAssertNil(owner.bind(engine(3)))
    }
}
