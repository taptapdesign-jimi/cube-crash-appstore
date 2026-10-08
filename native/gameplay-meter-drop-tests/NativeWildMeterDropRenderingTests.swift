import XCTest
import SpriteKit
import ImageIO
@testable import Stack_to_Six

nonisolated final class NativeWildMeterDropRenderingTests:XCTestCase {
    private let capture=NativeWildMeterDropRuntime.Capture(id:"actual-native-node",generation:7,epoch:3)
    private var root:URL {
        #if os(macOS)
        URL(fileURLWithPath:"/Users/user/cube-crash/native/standalone/Stack to Six/NativeAssets.bundle")
        #else
        Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")
            ?? Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        #endif
    }
    @MainActor
    func testOriginal30PreloadCoalescesSelectedBorrowersAndCanceledCaptureCannotReceiveSuccess() async throws {
        var finish:(@MainActor @Sendable ()->Void)?
        let decoded=expectation(description:"original textures decoded once")
        let catalog=NativeWildMeterDropResources(root:root,preload:{textures,done in
            XCTAssertEqual(textures.count,30);finish=done;decoded.fulfill()
        })
        defer{catalog.dispose()}
        var first:[Result<[String:SKTexture],NativeWildMeterDropResources.Failure>]=[],second:[Result<[String:SKTexture],NativeWildMeterDropResources.Failure>]=[]
        let request=catalog.prepare(arcade:false,capture:capture){first.append($0)}
        _=catalog.prepare(arcade:true,capture:capture){second.append($0)}
        catalog.cancel(request);catalog.cancel(request)
        await fulfillment(of:[decoded],timeout:5)
        XCTAssertEqual(catalog.loadCount,1);XCTAssertEqual(first.count,1);XCTAssertTrue(second.isEmpty)
        if case .failure(.retired)=first[0] {}else{XCTFail("Canceled capture must not become ready")}
        XCTAssertGreaterThan(catalog.decodedBytes,17_000_000)
        finish?();await Task.yield();await Task.yield()
        let crate=try XCTUnwrap(second.first).get();XCTAssertEqual(crate.count,10)
        XCTAssertEqual(crate[NativeWildMeterDropPlan.crateSources[0]]?.size(),CGSize(width:290,height:403))
        var backpack:[String:SKTexture]?
        _=catalog.prepare(arcade:false,capture:capture){backpack=try? $0.get()}
        XCTAssertEqual(backpack?.count,20);XCTAssertEqual(catalog.loadCount,1)
        XCTAssertEqual(backpack?[NativeWildMeterDropPlan.backpackSources[0]]?.size(),CGSize(width:379,height:438))
    }
    @MainActor
    func testUnavailableOriginalArtworkFailsAdmissionAndDisposedWaiterCompletesOnce() async {
        let done=expectation(description:"missing original data fails")
        let catalog=NativeWildMeterDropResources(root:URL(fileURLWithPath:"/missing-original-assets"))
        _=catalog.prepare(arcade:false,capture:capture){result in
            if case let .failure(.missingOriginal(paths))=result {XCTAssertEqual(paths.count,30)}else{XCTFail("No fallback textures")}
            done.fulfill()
        }
        await fulfillment(of:[done],timeout:5);catalog.dispose()
        var retired=0
        _=catalog.prepare(arcade:false,capture:capture){result in if case .failure(.retired)=result {retired+=1}}
        XCTAssertEqual(retired,1)
    }
    @MainActor
    func testSameNodeRestoresNativeGridScaleAndDoesNotRewindIdleOrReplaceArtwork() async throws {
        let stage=SKNode(),board=SKNode(),tile=SKNode();stage.addChild(board);board.addChild(tile)
        board.setScale(1.2);board.zRotation=0.1
        tile.position=CGPoint(x:24,y:40);tile.setScale(0.37);tile.zRotation=0.2;tile.zPosition=17;tile.alpha=0;tile.isHidden=true
        let original=ObjectIdentifier(tile),originalX=tile.xScale,originalY=tile.yScale,originalRotation=tile.zRotation
        let capturedWorldScale=tile.xScale*board.xScale // uniform parent rotations preserve this authored size
        var current=true
        let handoff=try XCTUnwrap(NativeWildMeterDropNodeHandoff(tile:tile,stage:stage,capture:capture,
            sourceParentVisualScale:0.444,stagePoint:{CGPoint(x:$0.x,y:900-$0.y)},isCurrent:{_,_ in current}))
        var pose=NativeWildMeterDropPlan.TilePose(pose:.init(point:.init(x:120,y:250),scaleX:0.33744,scaleY:0.444,rotation:0.05,opacity:1),
            visible:true,stageParent:true,dropping:true,handoff:false,interactive:false)
        XCTAssertTrue(handoff.apply(pose));XCTAssertTrue(tile.parent===stage)
        XCTAssertEqual(tile.position,CGPoint(x:120,y:650));XCTAssertEqual(tile.xScale,CGFloat(Float(0.33744*capturedWorldScale/0.444)))
        XCTAssertEqual(tile.zPosition,2_100_001);XCTAssertEqual(ObjectIdentifier(tile),original)
        pose.stageParent=false;pose.dropping=false;pose.handoff=true
        XCTAssertTrue(handoff.apply(pose));XCTAssertTrue(tile.parent===board)
        XCTAssertEqual(tile.position,CGPoint(x:24,y:40));XCTAssertEqual(tile.xScale,originalX)
        XCTAssertEqual(tile.yScale,originalY);XCTAssertEqual(tile.zRotation,originalRotation);XCTAssertEqual(tile.zPosition,17)
        tile.xScale=0.42;let actualIdleScale=tile.xScale // actual backend idle now owns its next painted scale
        tile.alpha=0.2;tile.isHidden=true
        XCTAssertTrue(handoff.apply(pose));XCTAssertEqual(tile.xScale,actualIdleScale)
        XCTAssertEqual(tile.alpha,CGFloat(Float(0.2)));XCTAssertTrue(tile.isHidden,"Late wall receipt must not reveal a tile consumed by a new owner")
        current=false;pose.stageParent=true
        XCTAssertFalse(handoff.apply(pose));XCTAssertTrue(tile.parent===board)
        handoff.dispose();handoff.dispose();XCTAssertFalse(handoff.apply(pose))
    }
    @MainActor
    func testCarrierNeedsSelectedOriginalTexturesAndRestoresSameTileBeforeLandedReceipt() async throws {
        let image=try XCTUnwrap(CGImageSourceCreateWithURL(root.appendingPathComponent("assets/animations/backpack/backpack-1.png") as CFURL,nil))
        let cg=try XCTUnwrap(CGImageSourceCreateImageAtIndex(image,0,nil)),texture=SKTexture(cgImage:cg)
        let plan=NativeWildMeterDropPlan(arcade:false,viewport:.init(x:390,y:844),tileSize:128,target:.init(x:128,y:256),
            parentWorld:.init(a:0.37,d:0.37),originalRotation:0,originalZIndex:1,usesUniformDropScale:false,random:{0.25})
        XCTAssertThrowsError(try NativeWildMeterDropPresentation(plan:plan,capture:capture,preparedTextures:[:],stagePoint:{CGPoint(x:$0.x,y:844-$0.y)}))
        let textures=Dictionary(uniqueKeysWithValues:NativeWildMeterDropPlan.backpackSources.map{($0,texture)})
        let carrier=try NativeWildMeterDropPresentation(plan:plan,capture:capture,preparedTextures:textures,stagePoint:{CGPoint(x:$0.x,y:844-$0.y)})
        defer{carrier.dispose()}
        var restored=false,landed=0
        carrier.onTilePose={if !$0.stageParent {restored=true}}
        carrier.onEvent={if $0 == .landed {XCTAssertTrue(restored);landed+=1}}
        carrier.prepared(animationSeconds:0);carrier.selectedWarmupCompleted()
        carrier.advance(animationSeconds:1.405,wallMilliseconds:1405,renderEpoch:1)
        carrier.advance(animationSeconds:1.835,wallMilliseconds:1835,renderEpoch:2)
        XCTAssertEqual(landed,1)
        carrier.painted(renderEpoch:2,onscreen:true,includesReplacement:true);XCTAssertFalse(carrier.runtime.foregroundReleased)
        carrier.painted(renderEpoch:3,onscreen:true,includesReplacement:true);XCTAssertTrue(carrier.runtime.foregroundReleased)
    }
    @MainActor
    func testActualNativeTexturePreloadCallbackAndReentrantDisposalCannotReadyNextWaiter() async throws {
        let completed=expectation(description:"real SpriteKit preload completes")
        let native=NativeWildMeterDropResources(root:root)
        var textures:[String:SKTexture]?
        _=native.prepare(arcade:true,capture:capture){result in textures=try? result.get();completed.fulfill()}
        await fulfillment(of:[completed],timeout:10)
        XCTAssertEqual(textures?.count,10);XCTAssertEqual(native.loadCount,1);native.dispose()

        let decoded=expectation(description:"finite source30 decode for reentrant waiters")
        var finish:(@MainActor @Sendable ()->Void)?
        let reentrant=NativeWildMeterDropResources(root:root,preload:{_,done in finish=done;decoded.fulfill()})
        var ready=0,retired=0
        let callback:(Result<[String:SKTexture],NativeWildMeterDropResources.Failure>)->Void={result in
            switch result {case .success:ready+=1;reentrant.dispose()
            case .failure(.retired):retired+=1
            default:XCTFail("Original resources must exist")}
        }
        _=reentrant.prepare(arcade:true,capture:capture,completion:callback)
        _=reentrant.prepare(arcade:false,capture:capture,completion:callback)
        await fulfillment(of:[decoded],timeout:5)
        finish?();await Task.yield();await Task.yield()
        XCTAssertEqual(ready,1);XCTAssertEqual(retired,1);XCTAssertEqual(reentrant.decodedBytes,0)
    }

}
