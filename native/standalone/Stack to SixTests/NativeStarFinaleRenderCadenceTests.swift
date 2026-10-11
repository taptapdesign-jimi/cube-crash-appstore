import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeStarFinaleRenderCadenceTests:XCTestCase {
    func testActualFinaleRetainsSixtyHzBeyondMergeParticlesAndRetiresOnCancellation() {
        let runtime=NativeSourceFrameRuntime();runtime.attach(rendererID:1,nowMs:0,configuredFPS:60)
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let owner=NativeStarFinale(textures:textures,viewport:.init(width:390,height:844),random:{0.25})
        let stage=SKNode();stage.addChild(owner)
        let receipt=runtime.begin(.init(kind:.starFinale,generation:1,id:"actual-star"))
        var completions=0
        owner.play {runtime.end(receipt);completions+=1}
        runtime.frame(nowMs:1500,configuredFPS:60)
        XCTAssertGreaterThan(owner.duration,1.5)
        XCTAssertEqual(runtime.snapshot.maxFPS,60,"The live Star finale outlasts its one-second smoke and shards")
        XCTAssertEqual(runtime.snapshot.activityLeaseCount,1)
        XCTAssertTrue(NativeBoardFrameCadenceDelivery.decide(runtime.snapshot,foreground:false).isPaused)
        owner.dispose();owner.dispose()
        XCTAssertEqual(completions,1);XCTAssertEqual(runtime.snapshot.activityLeaseCount,0)
        runtime.frame(nowMs:1700,configuredFPS:60)
        XCTAssertEqual(runtime.snapshot.maxFPS,15)
        runtime.stop();textures.dispose()
    }
    func testOldFinaleDisposalCannotRetireReplacementGenerationCadence() {
        let runtime=NativeSourceFrameRuntime();runtime.attach(rendererID:1,nowMs:0,configuredFPS:60)
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let owner=NativeStarFinale(textures:textures,viewport:.init(width:390,height:844),random:{0.25})
        let old=runtime.begin(.init(kind:.starFinale,generation:1,id:"star"))
        owner.play {runtime.end(old)}
        runtime.stop();runtime.attach(rendererID:2,nowMs:500,configuredFPS:60)
        let replacement=runtime.begin(.init(kind:.starFinale,generation:2,id:"star"))
        owner.dispose()
        XCTAssertEqual(runtime.snapshot.activityLeaseCount,1);XCTAssertEqual(runtime.snapshot.maxFPS,60)
        runtime.end(replacement);runtime.frame(nowMs:700,configuredFPS:60)
        XCTAssertEqual(runtime.snapshot.activityLeaseCount,0);XCTAssertEqual(runtime.snapshot.maxFPS,15)
        runtime.stop();textures.dispose()
    }
}
