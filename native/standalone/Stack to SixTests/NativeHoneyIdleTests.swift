import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor
final class NativeHoneyIdleTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    func testThreeSourceOrbitAndDragProfilesMatchActualControllerClockAndRNG() {
        var rng:UInt32=17,draws=0
        func roll()->Double {draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296}
        var runtime=NativeHoneyIdleMotion.Runtime(profiles:NativeHoneyIdleMotion.make(random:roll))
        XCTAssertEqual(draws,78)
        _=runtime.paint(seconds:0,force:true,random:roll);_=runtime.paint(seconds:0,force:true,random:roll)
        let gold:[Int:(Double,Double,Double,Int,Bool)]=[
            30:(-48.867017209684164,-23.47341045660497,1.1190453544255747,7,false),
            90:(-61.636748355997064,-3.195202692125893,1.445521725165181,1,true),
            300:(-26.049884979338977,-39.36946369494929,1.0920965549093562,6,false),
            599:(-45.756343591643024,-0.23605380146833468,1.1786915457122746,1,false),
            900:(-19.627497601614984,-39.886919418196314,1.1346021208377182,1,false),
            1200:(-27.73394469451015,39.018079139279216,1.2997334327968246,4,true)]
        for frame in 0...1200 {
            if frame==60 {runtime.setDragging(true)}
            if frame>=60,frame<240,frame%2==0 {runtime.updateDrag(offsetX:Double(frame-60)*1.2,offsetY:sin(Double(frame)/18)*24,velocityX:0.09,velocityY:-0.04)}
            if frame==240 {runtime.setDragging(false)}
            if frame==450 {runtime.setDragging(true)}
            if frame>=450,frame<600,frame%3==0 {runtime.updateDrag(offsetX:sin(Double(frame)/15)*80,offsetY:Double(frame-450)*0.6,velocityX:-0.35,velocityY:0.19)}
            if frame==600 {runtime.setDragging(false)}
            _=runtime.paint(seconds:Double(frame)/60,random:roll)
            if let expected=gold[frame] {
                let pose=runtime.bees[0].pose
                XCTAssertEqual(pose.x,expected.0,accuracy:1e-9);XCTAssertEqual(pose.y,expected.1,accuracy:1e-9)
                XCTAssertEqual(pose.scale*runtime.profiles[0].sizeScale,expected.2,accuracy:1e-9)
                XCTAssertEqual(pose.asset,expected.3);XCTAssertEqual(pose.front,expected.4)
            }
        }
        XCTAssertEqual(draws,84,"Three captured reentry phases per completed drag")
    }
    func testNativeOwnerRetainsThreeOriginalSpritesAndCountershiftsImmediately() throws {
        let textures=NativeBoardTextures(root:root),owner=NativeHoneyDiceIdle(textures:textures,random:{0.5})
        defer {owner.dispose();textures.dispose()}
        XCTAssertTrue(owner.assetReady);XCTAssertTrue(owner.hasActiveMotion)
        func bees()->[SKSpriteNode] {owner.children.flatMap {$0.children.compactMap {$0 as? SKSpriteNode}}.sorted {$0.name!<$1.name!}}
        XCTAssertEqual(bees().count,3);owner.tick(0.5)
        let sprites=bees(),old=sprites.map(\.position)
        owner.setDragging(true)
        owner.updateDrag(offset:CGPoint(x:60,y:-30),velocity:CGPoint(x:0.09,y:0.04))
        for index in sprites.indices {
            // SpriteKit stores the rendered coordinates at Float32 precision.
            XCTAssertEqual(sprites[index].position.x,old[index].x-60,accuracy:1e-5)
            XCTAssertEqual(sprites[index].position.y,old[index].y-30,accuracy:1e-5)
            XCTAssertNotNil(sprites[index].texture)
        }
        owner.tick(0.05);XCTAssertEqual(bees().count,3)
        owner.setDragging(false);owner.tick(0.05);XCTAssertEqual(bees().count,3)
        owner.dispose();owner.dispose();XCTAssertTrue(owner.children.isEmpty);XCTAssertFalse(owner.hasActiveMotion)
        owner.tick(1);XCTAssertTrue(owner.children.isEmpty)
    }
    func testMissingCapturedHoneyResourceFailsClosedWithoutIdleClock() {
        let textures=NativeBoardTextures(root:URL(fileURLWithPath:"/not-native-assets")),owner=NativeHoneyDiceIdle(textures:textures,random:{0.5})
        defer {owner.dispose();textures.dispose()}
        XCTAssertFalse(owner.assetReady);XCTAssertFalse(owner.hasActiveMotion)
        owner.tick(10);XCTAssertTrue(owner.children.allSatisfy {$0.children.isEmpty})
    }
}
