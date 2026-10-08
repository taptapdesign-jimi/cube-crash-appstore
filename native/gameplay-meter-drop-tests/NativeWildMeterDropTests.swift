import XCTest
@testable import Stack_to_Six

nonisolated final class NativeWildMeterDropTests: XCTestCase {
    private struct Oracle:Decodable {var records:[Scenario]}
    private struct Scenario:Decodable {
        var arcade:Bool,special:Bool,viewport:Viewport,parentMatrix:NativeWildMeterDropPlan.Affine
        var tileSize:Double,target:NativeWildMeterDropPlan.Point,originalRotation:Double,originalZIndex:Double
        var seedInitial:UInt32,randomCountAtMount:Int,draws:Int,rows:[Row]
    }
    private struct Viewport:Decodable {var width:Double,height:Double}
    private struct Row:Decodable {var time:Double,tile:Tile,carrier:Carrier}
    private struct Tile:Decodable {var x:Double,y:Double,scaleX:Double,scaleY:Double,rotation:Double,opacity:Double;var visible:Bool,stageParent:Bool,dropping:Bool,handoff:Bool,interactive:Bool}
    private struct Carrier:Decodable {var x:Double,y:Double,scaleX:Double,scaleY:Double,rotation:Double,opacity:Double;var frame:String,released:Bool}
    @MainActor
    func testLiteralV9ActualGSAPGeometryAndFrames() async throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"drop-oracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url))
        XCTAssertEqual(oracle.records.count,12)
        var checked=0
        for r in oracle.records {
            var seed=r.seedInitial,draws=0
            let plan=NativeWildMeterDropPlan(arcade:r.arcade,viewport:.init(x:r.viewport.width,y:r.viewport.height),tileSize:r.tileSize,
                target:r.target,parentWorld:r.parentMatrix,originalRotation:r.originalRotation,originalZIndex:r.originalZIndex,
                usesUniformDropScale:r.special,random:{draws+=1;seed=seed &* 1_664_525 &+ 1_013_904_223;return Double(seed)/4_294_967_296})
            XCTAssertEqual(draws,r.draws);XCTAssertEqual(draws,r.randomCountAtMount)
            for row in r.rows {
                let frame=plan.sample(seconds:row.time,impactStart:row.time>=1.405 ? 1.405:nil,
                    restored:row.time>=1.835,wallHandoffPending:row.time<1.975)
                let actual=[frame.tile.pose.point.x,frame.tile.pose.point.y,frame.tile.pose.scaleX,frame.tile.pose.scaleY,frame.tile.pose.rotation,frame.tile.pose.opacity,
                    frame.carrier.pose.point.x,frame.carrier.pose.point.y,frame.carrier.pose.scaleX,frame.carrier.pose.scaleY,frame.carrier.pose.rotation,frame.carrier.pose.opacity]
                let expected=[row.tile.x,row.tile.y,row.tile.scaleX,row.tile.scaleY,row.tile.rotation,row.tile.opacity,
                    row.carrier.x,row.carrier.y,row.carrier.scaleX,row.carrier.scaleY,row.carrier.rotation,row.carrier.opacity]
                for i in actual.indices {XCTAssertEqual(actual[i],expected[i],accuracy:0.000000001,"\(r.arcade)/\(r.special)/\(r.viewport.width) t=\(row.time) field\(i)")}
                XCTAssertEqual(frame.tile.visible,row.tile.visible);XCTAssertEqual(frame.tile.stageParent,row.tile.stageParent)
                XCTAssertEqual(frame.tile.dropping,row.tile.dropping);XCTAssertEqual(frame.tile.handoff,row.tile.handoff)
                XCTAssertEqual(frame.tile.interactive,row.tile.interactive);XCTAssertEqual(frame.carrier.source,row.carrier.frame)
                XCTAssertEqual(frame.carrier.released,row.carrier.released);checked+=1
            }
        }
        XCTAssertEqual(checked,2100)
    }
    @MainActor
    func testLiteralRegistryDimensionsDecideUniformScaleNotNativeBounds() async throws {
        struct Record:Decodable {let id:String?,uniform:Bool}
        struct Registry:Decodable {let records:[Record]}
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"variant-scale-oracle",withExtension:"json"))
        let oracle=try JSONDecoder().decode(Registry.self,from:Data(contentsOf:url))
        XCTAssertEqual(oracle.records.count,30)
        for row in oracle.records {XCTAssertEqual(NativeWildMeterDropPlan.sourceUsesUniformDropScale(variant:row.id),row.uniform,"\(row.id ?? "core")")}
    }
    @MainActor
    private func runtime()->NativeWildMeterDropRuntime {
        NativeWildMeterDropRuntime(capture:.init(id:"drop:1",generation:7,epoch:19),plan:
            NativeWildMeterDropPlan(arcade:false,viewport:.init(x:390,y:844),tileSize:128,target:.init(x:256,y:384),
                parentWorld:.init(a:0.55,d:0.55,tx:24,ty:106),originalRotation:0.17,originalZIndex:17,
                usesUniformDropScale:false,random:{0.5}))
    }
    @MainActor
    func testActualImpactAllocationAndWallHandoffHaveDifferentClockOwners() async {
        let owner=runtime(),c=owner.capture;var events:[NativeWildMeterDropRuntime.Event]=[];owner.onEvent={events.append($0)}
        owner.assetsPrepared(c,animationSeconds:4)
        owner.selectedWarmupCompleted(c)
        _=owner.advance(c,animationSeconds:4.5,wallMilliseconds:9000,renderEpoch:7)
        let paused=owner.advance(c,animationSeconds:4.5,wallMilliseconds:9800,renderEpoch:8)
        XCTAssertEqual(paused?.tile.dropping,true);XCTAssertFalse(events.contains(.impact));XCTAssertTrue(owner.hasSourceSaveBlock)
        // A delayed real travel callback allocates impact at5.6, not ideal5.405.
        _=owner.advance(c,animationSeconds:5.6,wallMilliseconds:10000,renderEpoch:9)
        XCTAssertEqual(events.filter{$0 == .impact}.count,1)
        _=owner.advance(c,animationSeconds:6.0,wallMilliseconds:10400,renderEpoch:10)
        XCTAssertFalse(owner.restored)
        _=owner.advance(c,animationSeconds:6.03,wallMilliseconds:10430,renderEpoch:11)
        XCTAssertTrue(owner.restored);XCTAssertTrue(owner.spawnCompleted);XCTAssertTrue(owner.hasSourceSaveBlock)
        let landed=events.firstIndex(of:.landed),end=events.firstIndex(of:.activityEnd100)
        XCTAssertNotNil(landed);XCTAssertNotNil(end)
        if let landed,let end {XCTAssertLessThan(landed,end)}
        owner.advanceWall(c,wallMilliseconds:10569.999);XCTAssertFalse(owner.isTileInputLegal)
        owner.advanceWall(c,wallMilliseconds:10570);XCTAssertTrue(owner.isTileInputLegal);XCTAssertFalse(owner.hasSourceSaveBlock)
        owner.advanceWall(c,wallMilliseconds:12000)
        XCTAssertEqual(events.filter{$0 == .handoffLock(false)}.count,1)
        XCTAssertEqual(events.filter{$0 == .activityEnd100}.count,1)
    }
    @MainActor
    func testSelectedWarmupAndFutureVisiblePaintCannotBeReplacedByVisualDuration() async {
        let owner=runtime(),c=owner.capture;owner.assetsPrepared(c,animationSeconds:0)
        _=owner.advance(c,animationSeconds:1.405,wallMilliseconds:1405,renderEpoch:4)
        _=owner.advance(c,animationSeconds:1.835,wallMilliseconds:1835,renderEpoch:5)
        XCTAssertTrue(owner.restored);XCTAssertFalse(owner.spawnCompleted)
        owner.advanceWall(c,wallMilliseconds:1975)
        XCTAssertTrue(owner.hasSourceSaveBlock);XCTAssertFalse(owner.isTileInputLegal,"Source queue remains held until selected finale readiness")
        let held=owner.advance(c,animationSeconds:1.835,wallMilliseconds:1975,renderEpoch:5)
        XCTAssertFalse(held?.tile.interactive ?? true,"Wall release alone must not bypass selected warmup")
        owner.painted(c,renderEpoch:5,onscreen:true,includesReplacement:true)
        owner.painted(c,renderEpoch:6,onscreen:false,includesReplacement:true)
        owner.painted(c,renderEpoch:6,onscreen:true,includesReplacement:false)
        XCTAssertFalse(owner.foregroundReleased)
        owner.selectedWarmupCompleted(c);XCTAssertTrue(owner.spawnCompleted);XCTAssertTrue(owner.isTileInputLegal)
        owner.painted(c,renderEpoch:6,onscreen:true,includesReplacement:true)
        XCTAssertTrue(owner.foregroundReleased)
    }
    @MainActor
    func testExplicitKillRetiresOnceAndLateGenerationReceiptsDoNothing() async {
        let owner=runtime(),c=owner.capture;var events:[NativeWildMeterDropRuntime.Event]=[];owner.onEvent={events.append($0)}
        owner.assetsPrepared(c,animationSeconds:0)
        owner.interrupt(c,wallMilliseconds:200,renderEpoch:1);owner.interrupt(c,wallMilliseconds:201,renderEpoch:2)
        XCTAssertTrue(owner.restored);XCTAssertFalse(events.contains(.landed))
        XCTAssertEqual(events.filter{$0 == .activityEnd100}.count,1)
        let count=events.count,wrong=NativeWildMeterDropRuntime.Capture(id:c.id,generation:8,epoch:c.epoch)
        owner.assetsPrepared(wrong,animationSeconds:9);owner.selectedWarmupCompleted(wrong)
        owner.advanceWall(wrong,wallMilliseconds:999);owner.painted(wrong,renderEpoch:99,onscreen:true,includesReplacement:true)
        XCTAssertEqual(events.count,count)
        owner.dispose();owner.dispose();let disposedCount=events.count
        owner.assetsPrepared(c,animationSeconds:9);owner.selectedWarmupCompleted(c)
        XCTAssertNil(owner.advance(c,animationSeconds:9,wallMilliseconds:9999,renderEpoch:99))
        XCTAssertEqual(events.count,disposedCount)
    }
}
