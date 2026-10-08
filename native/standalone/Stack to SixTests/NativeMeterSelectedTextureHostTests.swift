import XCTest
import UIKit
import SpriteKit
@testable import Stack_to_Six

/// Actual canonical texture host mounted in SKView. The injected transport only
/// holds/replays the native preload receipt; image decoding/cache are real.
@MainActor final class NativeMeterSelectedTextureHostTests:XCTestCase {
    @MainActor private final class Mount {
        let textures:NativeBoardTextures
        let window:UIWindow
        let view:SKView
        let scene:SKScene
        init(preload:NativeBoardTextures.SelectedFinalePreload?=nil) {
            let root=NativeTestResources.root
            if let preload {textures=NativeBoardTextures(root:root,selectedFinalePreload:preload)}
            else {textures=NativeBoardTextures(root:root)}
            window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            view=SKView(frame:window.bounds);scene=SKScene(size:window.bounds.size)
            let controller=UIViewController();controller.view=view
            window.rootViewController=controller;window.makeKeyAndVisible();view.presentScene(scene)
        }
        func dispose() {textures.dispose();view.presentScene(nil);window.isHidden=true}
    }
    @MainActor private final class Uploads {
        var receipts:[@Sendable()->Void]=[]
        var textures:[[SKTexture]]=[]
        func preload(_ textures:[SKTexture],done:@escaping @Sendable()->Void) {
            self.textures.append(textures);receipts.append(done)
        }
    }
    private var asset:NativeMeterWarmupAsset {
        NativeMeterWarmupAsset(["assets/shop/juice/bubbles pack/bubble1.png"])
    }
    private func until(_ predicate:()->Bool) async throws {
        let deadline=CACurrentMediaTime()+3
        while !predicate(),CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(predicate(),"Bounded wait for the actual decoder/preload receipt")
    }
    func testActualMountedNativeUploadReturnsCanonicalOriginalTextureOnce() async throws {
        let mount=Mount();defer{mount.dispose()}
        var results:[SKTexture?]=[]
        mount.textures.prepareSelectedFinaleAsset(asset){results.append($0)}
        try await until{results.count==1}
        let texture=try XCTUnwrap(results[0])
        XCTAssertTrue(texture === mount.textures.texture(asset.candidates[0],densityAware:false))
        let sprite=SKSpriteNode(texture:texture);sprite.position=CGPoint(x:195,y:422);mount.scene.addChild(sprite)
        XCTAssertTrue(sprite.texture === texture);XCTAssertGreaterThan(texture.size().width,0)
    }
    func testCachedUploadInvalidationAndDisposalSettleNilOnceBeforeLateReceipt() async throws {
        for dispose in [false,true] {
            let uploads=Uploads(),mount=Mount(preload:uploads.preload);defer{mount.dispose()}
            _=try XCTUnwrap(mount.textures.texture(asset.candidates[0],densityAware:false))
            var results:[SKTexture?]=[]
            mount.textures.prepareSelectedFinaleAsset(asset){results.append($0)}
            XCTAssertEqual(uploads.receipts.count,1);XCTAssertTrue(results.isEmpty)
            if dispose {mount.textures.dispose()} else {mount.textures.invalidatePendingPreparation()}
            XCTAssertEqual(results.count,1);XCTAssertNil(results[0])
            uploads.receipts[0]();uploads.receipts[0]()
            // Ordered actor turn after the stale upload Tasks, not a fabricated
            // timer-driven asset success.
            await Task.yield();await Task.yield()
            XCTAssertEqual(results.count,1);XCTAssertNil(results[0])
        }
    }
    func testDecodedUploadCannotStealReplacementRequestAfterInvalidate() async throws {
        let uploads=Uploads(),mount=Mount(preload:uploads.preload);defer{mount.dispose()}
        var old:[SKTexture?]=[],new:[SKTexture?]=[]
        mount.textures.prepareSelectedFinaleAsset(asset){old.append($0)}
        try await until{uploads.receipts.count==1}
        mount.textures.invalidatePendingPreparation()
        XCTAssertEqual(old.count,1);XCTAssertNil(old[0])
        mount.textures.prepareSelectedFinaleAsset(asset){new.append($0)}
        try await until{uploads.receipts.count==2}
        uploads.receipts[0]();await Task.yield();await Task.yield()
        XCTAssertEqual(old.count,1);XCTAssertTrue(new.isEmpty)
        uploads.receipts[1]();try await until{new.count==1}
        XCTAssertNotNil(new[0]);XCTAssertTrue(new[0] === uploads.textures[1][0])
        uploads.receipts[0]();uploads.receipts[1]();await Task.yield();await Task.yield()
        XCTAssertEqual(old.count,1);XCTAssertEqual(new.count,1)
    }
    func testCachedAndDecodedCoalescedConsumersDisposeReentrantlyWithoutStaleSuccess() async throws {
        for cached in [false,true] {
            let uploads=Uploads(),mount=Mount(preload:uploads.preload);defer{mount.dispose()}
            if cached {_=try XCTUnwrap(mount.textures.texture(asset.candidates[0],densityAware:false))}
            var first:[SKTexture?]=[],second:[SKTexture?]=[],third:[SKTexture?]=[]
            mount.textures.prepareSelectedFinaleAsset(asset){texture in
                first.append(texture);mount.textures.dispose()
            }
            mount.textures.prepareSelectedFinaleAsset(asset){second.append($0)}
            mount.textures.prepareSelectedFinaleAsset(asset){third.append($0)}
            try await until{uploads.receipts.count==1}
            uploads.receipts[0]();try await until{first.count==1 && second.count==1 && third.count==1}
            XCTAssertNotNil(first[0]);XCTAssertNil(second[0]);XCTAssertNil(third[0])
            uploads.receipts[0]();await Task.yield();await Task.yield()
            XCTAssertEqual(first.count,1);XCTAssertEqual(second.count,1);XCTAssertEqual(third.count,1)
            XCTAssertNil(mount.textures.texture(asset.candidates[0],densityAware:false))
        }
    }
    func testReentrantInvalidationKeepsNewGenerationRequestAndRetiresOldConsumers() async throws {
        let uploads=Uploads(),mount=Mount(preload:uploads.preload);defer{mount.dispose()}
        var oldFirst:[SKTexture?]=[],oldSecond:[SKTexture?]=[],replacement:[SKTexture?]=[]
        mount.textures.prepareSelectedFinaleAsset(asset){texture in
            oldFirst.append(texture);mount.textures.invalidatePendingPreparation()
            mount.textures.prepareSelectedFinaleAsset(self.asset){replacement.append($0)}
        }
        mount.textures.prepareSelectedFinaleAsset(asset){oldSecond.append($0)}
        try await until{uploads.receipts.count==1}
        uploads.receipts[0]();try await until{uploads.receipts.count==2}
        XCTAssertEqual(oldFirst.count,1);XCTAssertNotNil(oldFirst[0])
        XCTAssertEqual(oldSecond.count,1);XCTAssertNil(oldSecond[0]);XCTAssertTrue(replacement.isEmpty)
        uploads.receipts[0]();await Task.yield();await Task.yield();XCTAssertTrue(replacement.isEmpty)
        uploads.receipts[1]();try await until{replacement.count==1};XCTAssertNotNil(replacement[0])
    }
    func testDisposeDuringActualDecodeCancelsAllConsumersWithoutUploadOrResurrection() async throws {
        let uploads=Uploads(),mount=Mount(preload:uploads.preload);defer{mount.dispose()}
        var results:[SKTexture?]=[]
        mount.textures.prepareSelectedFinaleAsset(asset){results.append($0)}
        mount.textures.prepareSelectedFinaleAsset(asset){results.append($0)}
        mount.textures.dispose()
        XCTAssertEqual(results.count,2);XCTAssertTrue(results.allSatisfy{$0==nil})
        // A separate request after disposal settles nil; an obsolete decode cannot
        // create an upload or refill the canonical cache in subsequent actor turns.
        mount.textures.prepareSelectedFinaleAsset(asset){results.append($0)}
        try await Task.sleep(for:.milliseconds(60))
        XCTAssertEqual(results.count,3);XCTAssertTrue(results.allSatisfy{$0==nil})
        XCTAssertTrue(uploads.receipts.isEmpty)
        XCTAssertNil(mount.textures.texture(asset.candidates[0],densityAware:false))
    }
}
