import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeStarPresentationTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testCoreStarPlannerMatchesExecutedOriginalSourceDrawOrder() throws {
        let plans = NativeStarBurstMotion.make(viewport: CGSize(width: 390,height: 844),random: { 0.5 })
        XCTAssertEqual(plans.count,26)
        let first = try XCTUnwrap(plans.first)
        XCTAssertEqual(first.birth,CGPoint(x: 266,y: 422)); XCTAssertEqual(first.size,47)
        XCTAssertEqual(first.delay,0.025,accuracy: 0.000001)
        XCTAssertEqual(first.launch,0.05,accuracy: 0.000001); XCTAssertEqual(first.travel,0.67,accuracy: 0.000001)
        XCTAssertEqual(first.poses[1].scale,1.177,accuracy: 0.000001)
        XCTAssertEqual(first.poses[2].point.x,114.1088,accuracy: 0.000001)
        XCTAssertEqual(first.poses[2].point.y,-43,accuracy: 0.000001)
        XCTAssertEqual(first.poses[3].point.x,258.9392,accuracy: 0.000001)
        XCTAssertEqual(first.poses[3].point.y,26.875,accuracy: 0.000001)
        XCTAssertEqual(first.poses[4].point.x,518.0595522919716,accuracy: 0.000001)
        XCTAssertEqual(first.poses[4].alpha,0.3479,accuracy: 0.000001)
        XCTAssertEqual(first.poses[5].point.x,676.8752520838252,accuracy: 0.000001)
        XCTAssertEqual(plans.last?.delay ?? 0,1.325,accuracy: 0.000001)
        XCTAssertEqual(first.sample(seconds: first.end).alpha,0)
    }
    func testNativeScreenBlendAndCleanupOwnAllTwentySixParticles() {
        let textures = NativeBoardTextures(root: root)
        let finale = NativeStarFinale(textures: textures,viewport: CGSize(width: 390,height: 844),random: { 0.5 })
        XCTAssertEqual(finale.children.count,26)
        XCTAssertTrue(finale.children.allSatisfy { ($0 as? SKSpriteNode)?.blendMode == .screen })
        XCTAssertEqual(finale.duration,2.545,accuracy: 0.000001)
        var cleanups = 0
        finale.onGlyphClock = { _,finished in if finished { cleanups += 1 } }
        finale.dispose(); finale.dispose()
        XCTAssertEqual(cleanups,1); XCTAssertEqual(finale.children.count,0)
        XCTAssertFalse(finale.hasActions())
        textures.dispose()
    }
    func testFractionalGlyphPaletteUsesComplementaryOriginalFontMasks() throws {
        let field = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: root),text: "M",colors: [.red,.blue],splitIndex: 0.5,
            letterOpacityRange: 1...1,random: { 0.5 })
        field.frame = CGRect(x: 0,y: 0,width: 390,height: 844); field.layoutIfNeeded()
        let container = try XCTUnwrap(field.subviews.first),letter = try XCTUnwrap(container.subviews.first as? UILabel)
        XCTAssertEqual(letter.textColor,.clear)
        let halves = letter.subviews.compactMap { $0 as? UILabel }
        XCTAssertEqual(halves.count,2); XCTAssertEqual(halves.map(\.text),["M","M"])
        XCTAssertEqual(halves[0].textColor,.red); XCTAssertEqual(halves[1].textColor,.blue)
        let left = try XCTUnwrap((halves[0].layer.mask as? CAShapeLayer)?.path?.boundingBox)
        let right = try XCTUnwrap((halves[1].layer.mask as? CAShapeLayer)?.path?.boundingBox)
        XCTAssertEqual(left.maxX,right.minX,accuracy: 0.000001)
        XCTAssertEqual(left.width+right.width,letter.bounds.width,accuracy: 0.000001)
        XCTAssertEqual(halves[0].font,letter.font); XCTAssertEqual(halves[1].font,letter.font)
    }
    func testCompactLaserGlyphHasAuthoredFastEnterAndKeepsIdleUntilOwnerCleanup() throws {
        let field = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: root),text: "Z",colors: [.orange],splitIndex: 0,
            compactLaser: true,random: { 0.5 })
        field.frame = CGRect(x: 0,y: 0,width: 390,height: 844); field.layoutIfNeeded()
        let letter = try XCTUnwrap(field.subviews.first?.subviews.first as? UILabel)
        field.paint(seconds: 0.04); XCTAssertEqual(letter.alpha,0)
        field.paint(seconds: 0.20); XCTAssertEqual(letter.alpha,1); XCTAssertEqual(letter.layer.transform.m11,1.2,accuracy: 0.000001)
        field.paint(seconds: 10)
        XCTAssertEqual(letter.alpha,1); XCTAssertGreaterThan(letter.layer.transform.m11,0.9)
        XCTAssertTrue(field.exitStart.isInfinite)
    }
}
