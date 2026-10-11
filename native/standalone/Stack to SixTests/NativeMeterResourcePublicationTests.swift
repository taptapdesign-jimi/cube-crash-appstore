import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeMeterResourcePublicationTests:XCTestCase {
    private func warm(_ owner:NativeWildMeterDropResources)async throws {
        let ready=expectation(description:"actual originals decoded and preloaded")
        owner.prepare(arcade:false,capture:.init(id:"warm",generation:1,epoch:1)){result in
            if case .failure(let failure)=result{XCTFail("original preload failed: \(failure)")};ready.fulfill()
        }
        await fulfillment(of:[ready],timeout:8)
    }
    func testImmutablePublicationSurvivesRepeatedChecksAndCanceledBorrowerButRejectsAnotherReadyOwner()async throws {
        let first=NativeWildMeterDropResources(root:NativeTestResources.root),second=NativeWildMeterDropResources(root:NativeTestResources.root)
        defer{first.dispose();second.dispose()}
        try await warm(first);try await warm(second)
        let receipt=try XCTUnwrap(first.sourceSynchronousPreparationReceipt()),other=try XCTUnwrap(second.sourceSynchronousPreparationReceipt())
        for _ in 0..<4096 {XCTAssertTrue(first.sourceSynchronousPreparationIsCurrent(receipt))}
        XCTAssertFalse(first.sourceSynchronousPreparationIsCurrent(other));XCTAssertFalse(second.sourceSynchronousPreparationIsCurrent(receipt))
        var original:[String:SKTexture]=[:],later:[String:SKTexture]=[:]
        let request=first.prepare(arcade:false,capture:.init(id:"retained",generation:2,epoch:1)){if case .success(let textures)=$0{original=textures}else{XCTFail("retained publication refused")}}
        first.cancel(request)
        first.prepare(arcade:false,capture:.init(id:"later",generation:3,epoch:1)){if case .success(let textures)=$0{later=textures}else{XCTFail("cancel retired shared assets")}}
        XCTAssertEqual(original.count,20);XCTAssertEqual(later.count,20)
        for path in NativeWildMeterDropPlan.backpackSources {XCTAssertTrue(original[path] === later[path])}
        XCTAssertEqual(first.loadCount,1);XCTAssertTrue(first.sourceSynchronousPreparationIsCurrent(receipt))
        first.dispose();XCTAssertFalse(first.sourceSynchronousPreparationIsCurrent(receipt))
        XCTAssertTrue(second.sourceSynchronousPreparationIsCurrent(other),"Retiring one resource publication cannot retire another")
    }
    func testCanceledColdBorrowerDoesNotPublishBeforePreloadOrRetireLaterSharedPublication()async throws {
        let preloadReached=expectation(description:"actual decoded originals reached preload")
        var complete:(@MainActor @Sendable ()->Void)?
        let owner=NativeWildMeterDropResources(root:NativeTestResources.root,preload:{textures,done in
            XCTAssertEqual(textures.count,30);complete=done;preloadReached.fulfill()
        })
        defer{owner.dispose()}
        var outcomes:[NativeWildMeterDropResources.Failure]=[]
        let request=owner.prepare(arcade:false,capture:.init(id:"cold",generation:1,epoch:1)){if case .failure(let failure)=$0{outcomes.append(failure)}else{XCTFail("canceled borrower received success")}}
        await fulfillment(of:[preloadReached],timeout:8)
        XCTAssertNil(owner.sourceSynchronousPreparationReceipt());owner.cancel(request)
        XCTAssertEqual(outcomes,[.retired]);try XCTUnwrap(complete)()
        try await warm(owner)
        let receipt=try XCTUnwrap(owner.sourceSynchronousPreparationReceipt())
        XCTAssertTrue(owner.sourceSynchronousPreparationIsCurrent(receipt));XCTAssertEqual(outcomes,[.retired]);XCTAssertEqual(owner.loadCount,1)
    }
    func testPreloadCompletionAfterReentrantDisposalCannotIssueReceipt()async throws {
        let preloadReached=expectation(description:"actual pending preload")
        var complete:(@MainActor @Sendable ()->Void)?
        let owner=NativeWildMeterDropResources(root:NativeTestResources.root,preload:{_,done in complete=done;preloadReached.fulfill()})
        var retired=0
        owner.prepare(arcade:true,capture:.init(id:"dispose",generation:1,epoch:1)){result in
            if case .failure(.retired)=result{retired+=1;owner.dispose()}else{XCTFail("retired preload received success")}
        }
        await fulfillment(of:[preloadReached],timeout:8)
        owner.dispose();try XCTUnwrap(complete)()
        await Task.yield()
        XCTAssertEqual(retired,1);XCTAssertNil(owner.sourceSynchronousPreparationReceipt());XCTAssertEqual(owner.decodedBytes,0)
    }
}
