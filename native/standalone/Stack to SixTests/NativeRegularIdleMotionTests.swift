import XCTest
@testable import Stack_to_Six
@MainActor
final class NativeRegularIdleMotionTests:XCTestCase {
    func testActualImmutableV9IdleGSAPPosesAcrossBothRandomVariants()throws {
        let path=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeRegularIdlePoseOracle",withExtension:"json"))
        let rows=try JSONDecoder().decode([[Double]].self,from:Data(contentsOf:path))
        XCTAssertEqual(rows.count,1042)
        for row in rows {
            let pose=NativeRegularIdleMotion(variantDraw:row[0],directionDraw:row[0],tiltDraw:row[0]).sample(row[1])
            XCTAssertEqual(Double(pose.x),row[2],accuracy:0.000001)
            XCTAssertEqual(Double(pose.y),row[3],accuracy:0.000001)
            XCTAssertEqual(Double(pose.rotation),row[4],accuracy:0.000001)
        }
    }
}
