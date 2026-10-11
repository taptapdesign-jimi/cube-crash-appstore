import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeSharedVectorSpritePoolTests:XCTestCase {
    func testActualPolygonPoolPreservesCapturedLeaseResetAndInheritedBlend()throws {
        let pool=NativeSharedVectorSpritePool()
        XCTAssertEqual(pool.prewarm(to:76),76)
        let first=pool.acquire(),path=CGMutablePath()
        path.move(to:CGPoint(x:-11,y:7));path.addLine(to:CGPoint(x:13,y:3));path.addLine(to:CGPoint(x:4,y:-15));path.closeSubpath()
        first.node.path=path;first.node.fillColor = .brown;first.node.blendMode = .add
        XCTAssertEqual(try XCTUnwrap(first.node.path).boundingBoxOfPath,path.boundingBoxOfPath)
        first.node.position=CGPoint(x:21,y:33);first.node.zRotation=0.7;first.node.setScale(2);first.node.alpha=0.4
        pool.release(first)
        let next=pool.acquire()
        XCTAssertTrue(next.node === first.node);XCTAssertNotEqual(next.sequence,first.sequence)
        XCTAssertNil(next.node.path);XCTAssertEqual(next.node.fillColor.cgColor.alpha,0)
        XCTAssertEqual(next.node.position,.zero);XCTAssertEqual(next.node.zRotation,0)
        XCTAssertEqual(next.node.xScale,1);XCTAssertEqual(next.node.alpha,1);XCTAssertEqual(next.node.blendMode,.add)
        pool.release(first);XCTAssertTrue(pool.isCurrent(next));XCTAssertEqual(pool.activeCount,1)
        pool.release(next);XCTAssertEqual(pool.activeCount,0)
    }
    func testExistingPolygonPoolLimitAndEvictionRemainOneHundredFifty(){
        let pool=NativeSharedVectorSpritePool(),leases=(0..<160).map{_ in pool.acquire()}
        XCTAssertEqual(pool.activeCount,160)
        leases.forEach(pool.release)
        XCTAssertEqual(pool.poolSize,150);XCTAssertEqual(pool.retainedNodeCount,150);XCTAssertEqual(pool.activeCount,0)
        XCTAssertEqual(pool.prewarm(to:200),150)
    }
}
