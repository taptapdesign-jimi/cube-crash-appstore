import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeResultArea55FlybysTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testAll7272KeyframesAndRandomDrawCountsMatchActualTypeScript() throws {
        struct Row: Decodable { let width,height: Double; let depth: String; let seed: UInt32; let roll: Double?; let draws: Int; let startEdge,endEdge: String; let samples: [[Double]] }
        let rows = try JSONDecoder().decode([Row].self,from:NativeResultArea55FlybysOracle.data)
        XCTAssertEqual(rows.count,36); XCTAssertEqual(rows.reduce(0){$0+$1.samples.count},7272)
        for row in rows {
            var seed = row.seed,draws = 0
            let p = NativeResultArea55FlightPlan.make(depth:row.depth == "behind" ? .behind : .front,viewport:.init(width:row.width,height:row.height),random:{
                draws += 1; if let roll = row.roll { return roll }; seed = seed &* 1664525 &+ 1013904223; return Double(seed)/4294967296
            })
            XCTAssertEqual(draws,row.draws); XCTAssertEqual(p.startEdge,row.startEdge); XCTAssertEqual(p.endEdge,row.endEdge)
            XCTAssertNotEqual(p.startEdge,p.endEdge); XCTAssertEqual(p.keyframes.count,202)
            for (index,rowPose) in row.samples.enumerated() {
                let pose = p.keyframes[index]
                for (actual,source) in zip([pose.x,pose.y,pose.rotation,pose.scale,pose.opacity],rowPose.dropFirst()) { XCTAssertEqual(actual,source,accuracy:1e-10) }
            }
            let time = (100.5/201)*6.7,a = p.keyframes[100],b = p.keyframes[101],middle = p.sample(seconds:time)
            XCTAssertEqual(middle.x,(a.x+b.x)/2,accuracy:1e-10); XCTAssertEqual(middle.rotation,(a.rotation+b.rotation)/2,accuracy:1e-10)
        }
    }
    @MainActor private final class Resources: NativeResultConfettiResources {
        let bitmap: UIImage?
        var prepared: [String] = [],releases = 0,imageReads = 0,completion: ((Bool) -> Void)?
        init(root: URL) { bitmap = UIImage(contentsOfFile:root.appendingPathComponent(String(NativeResultArea55Flybys.asset.dropFirst(2))).path) }
        func image(_ path: String,owner: Int) -> UIImage? { imageReads += 1; return bitmap }
        func prepare(_ paths: [String],owner: Int,required: Bool,completion: @escaping (Bool) -> Void) { prepared += paths; self.completion = completion }
        func release(_ owner: Int) { releases += 1 }
    }
    func testParentClockLayerOrderForegroundAndExact6700msRetirement() throws {
        let resources = Resources(root:root); XCTAssertNotNil(resources.bitmap)
        let overlay = UIView(frame:.init(x:0,y:0,width:390,height:844)),content = UIView(); overlay.addSubview(content)
        let owner = NativeResultArea55Flybys(root:root,viewport:overlay.bounds.size,generation:31,resources:resources,reducedMotion:false,random:{0.5})
        var finished = 0; owner.onFinished = { finished += 1 }; owner.mount(overlay:overlay,content:content)
        XCTAssertEqual(resources.prepared,[NativeResultArea55Flybys.asset]); XCTAssertEqual(owner.shipCount,2)
        resources.completion?(true); XCTAssertTrue(owner.assetsReady)
        let behind = try XCTUnwrap(overlay.subviews.first{$0.layer.zPosition == 0}),front = try XCTUnwrap(overlay.subviews.first{$0.layer.zPosition == 2})
        XCTAssertTrue(overlay.subviews[1] === content); XCTAssertEqual(content.layer.zPosition,1)
        XCTAssertEqual(behind.bounds.width,62); XCTAssertEqual(front.bounds.width,74); XCTAssertEqual(behind.alpha,0.7,accuracy:1e-6); XCTAssertEqual(front.alpha,0.9,accuracy:1e-6)
        owner.paint(seconds:2,generation:31); let accepted = behind.center
        owner.paint(seconds:6,generation:30); XCTAssertEqual(behind.center,accepted)
        owner.setForeground(false); owner.paint(seconds:6,generation:31); XCTAssertEqual(behind.center,accepted)
        owner.setForeground(true); owner.paint(seconds:3,generation:31); XCTAssertNotEqual(behind.center,accepted)
        owner.paint(seconds:6.699,generation:31); XCTAssertEqual(owner.shipCount,2); XCTAssertEqual(finished,0)
        owner.paint(seconds:6.7,generation:31); XCTAssertTrue(owner.disposed); XCTAssertEqual(owner.shipCount,0); XCTAssertEqual(finished,1); XCTAssertEqual(resources.releases,1)
        owner.paint(seconds:10,generation:31); owner.dispose(); XCTAssertEqual(finished,1); XCTAssertEqual(resources.releases,1)
    }
    func testLatePreparationAfterDisposeCannotReadOrMountOriginalAsset() {
        let resources = Resources(root:root),overlay = UIView(),content = UIView(); overlay.addSubview(content)
        let owner = NativeResultArea55Flybys(root:root,viewport:.init(width:390,height:844),generation:32,resources:resources,reducedMotion:false,random:{0.5})
        owner.dispose(); resources.completion?(true); owner.mount(overlay:overlay,content:content)
        XCTAssertFalse(owner.assetsReady); XCTAssertEqual(resources.imageReads,0); XCTAssertEqual(resources.releases,1); XCTAssertEqual(owner.shipCount,0)
    }
    func testReducedMotionCreatesNoShipOrResourceAndFailureReleasesOnce() {
        let resources = Resources(root:root)
        let reduced = NativeResultArea55Flybys(root:root,viewport:.init(width:390,height:844),generation:33,resources:resources,reducedMotion:true)
        XCTAssertEqual(reduced.shipCount,0); XCTAssertTrue(resources.prepared.isEmpty); reduced.dispose(); XCTAssertEqual(resources.releases,0)
        let failed = NativeResultArea55Flybys(root:root,viewport:.init(width:390,height:844),generation:34,resources:resources,reducedMotion:false)
        var failures = 0; failed.onAssetFailure = { failures += 1 }; resources.completion?(false)
        XCTAssertEqual(failures,1); XCTAssertTrue(failed.disposed); XCTAssertEqual(resources.releases,1); failed.dispose(); XCTAssertEqual(resources.releases,1)
    }
}
