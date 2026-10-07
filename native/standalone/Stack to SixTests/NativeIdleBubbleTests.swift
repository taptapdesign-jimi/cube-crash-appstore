import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeIdleBubbleTests:XCTestCase {
    private struct Frame:Decodable {let time:Double,frame:Int,draws:Int,bubbles:[Bubble]}
    private struct Bubble:Decodable {let id:Int,x:Double,y:Double,scaleX:Double,scaleY:Double,alpha:Double,tint:UInt32}
    private struct Fixture:Decodable {let family:String,seed:UInt32,frames:[Frame]}
    private func family(_ name:String)->NativeIdleBubbleMotion.Family {
        switch name {case "honey":return .honey;case "bottle":return .bottle;case "fish":return .fish;case "beach-ball":return .beachBall;default:return .juice}
    }
    func testVisibleProducerMatchesUnmodifiedV9OriginalGSAPThroughPickupAndStalledFrames() throws {
        let fixtures=try JSONDecoder().decode([Fixture].self,from:Data(NativeIdleBubbleSourceOracle.json.utf8))
        XCTAssertEqual(fixtures.count,15)
        for fixture in fixtures {
            var rng=fixture.seed,draws=0
            let runtime=NativeIdleBubbleMotion.Runtime(family:family(fixture.family),random:{draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296})
            let samples=Dictionary(uniqueKeysWithValues:fixture.frames.map {($0.frame,$0)})
            var last=0.0
            for index in 0...1200 {
                let time=Double(index)/60+(index>=120 ? 0.37:0)+(index>=360 ? 0.41:0)+(index>=850 ? 0.29:0)
                runtime.advance(time-last);last=time
                if index==240 || index==720 {runtime.stopForPointer()}
                if index==270 || index==750 {runtime.restartAfterLanding()}
                XCTAssertLessThanOrEqual(runtime.bubbles.count,6)
                guard let sample=samples[index] else {continue}
                XCTAssertEqual(draws,sample.draws,"Original producer/RNG source \(fixture.family),frame\(index)")
                XCTAssertEqual(runtime.bubbles.count,sample.bubbles.count)
                for (native,gold) in zip(runtime.bubbles,sample.bubbles) {
                    let pose=native.plan.sample(seconds:runtime.elapsed-native.born)
                    XCTAssertEqual(native.id,gold.id);XCTAssertEqual(pose.tint,gold.tint)
                    // Actual GSAP rounds numeric pose properties to six digits.
                    XCTAssertEqual(pose.x,gold.x,accuracy:3e-5);XCTAssertEqual(pose.y,gold.y,accuracy:3e-5)
                    XCTAssertEqual(pose.scaleX,gold.scaleX,accuracy:3e-5);XCTAssertEqual(pose.scaleY,gold.scaleY,accuracy:3e-5)
                    XCTAssertEqual(pose.alpha,gold.alpha,accuracy:3e-5)
                }
            }
        }
    }
    func testNativeRawArchetypeNamesSelectOriginalFizzFamiliesAndCustomBranchesStayExcluded() {
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:nil),.juice)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"juice",variant:nil),.juice)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild",variant:"fish"),.fish)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-magnet",variant:"bottle"),.bottle)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-magnet",variant:"honey"),.honey)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-tnt",variant:"beach-ball"),.beachBall)
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:"mushroom"))
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:"robo-cube"))
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-tnt",variant:nil))
    }

    func testVectorCarriersStayBoundedAndReuseTheSameNativeNodes() throws {
        var rng=UInt32(17)
        let field=NativeIdleBubbleField(family:.bottle,random:{rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296})
        let owner=SKNode();owner.addChild(field)
        let carriers=Set(field.children.map(ObjectIdentifier.init)),vectors=Set(field.children.flatMap(\.children).map(ObjectIdentifier.init))
        XCTAssertEqual(carriers.count,6);XCTAssertEqual(vectors.count,18)
        for _ in 0..<2400 {field.tick(1/60);XCTAssertLessThanOrEqual(field.activeCount,6)}
        XCTAssertEqual(Set(field.children.map(ObjectIdentifier.init)),carriers)
        XCTAssertEqual(Set(field.children.flatMap(\.children).map(ObjectIdentifier.init)),vectors)
        field.stopForPointer();XCTAssertFalse(field.isRunning);XCTAssertEqual(field.activeCount,0)
        XCTAssertTrue(field.children.allSatisfy(\.isHidden))
        field.tick(5);XCTAssertEqual(field.activeCount,0,"Pointer stop cannot create a new hidden producer")
        field.restartAfterLanding();XCTAssertTrue(field.isRunning);XCTAssertEqual(field.activeCount,1)
        field.dispose();field.dispose();field.tick(1);field.restartAfterLanding()
        XCTAssertNil(field.parent);XCTAssertTrue(field.children.isEmpty);XCTAssertFalse(field.isRunning)
    }
    func testNativePointerStopsFizzUntilActualV9ReturnTimelineFinishes() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let bottle=NativeTile(id:"bottle",cell:NativeCell(column:0,row:0),value:0,archetype:.magnet,variant:"bottle")
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[bottle,NativeTile(id:"a",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b",cell:NativeCell(column:2,row:0),value:1)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844));scene.layout(size:scene.size,insets:.zero)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let node=try XCTUnwrap(scene.childNode(withName:"//native-die-bottle") as? NativeDiceNode)
        let field=try XCTUnwrap(node.visual.children.compactMap {$0 as? NativeIdleBubbleField}.first)
        XCTAssertTrue(field.isRunning)
        let returned=expectation(description:"Original0.18 position plus appended0.105 recovery actually completed")
        let resourceWakeup=node.onResourceReady
        var completed=0
        node.onResourceReady={resourceWakeup?();if field.isRunning {completed+=1;returned.fulfill()}}
        let point=scene.boardGeometry!.center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertFalse(field.isRunning);XCTAssertEqual(field.activeCount,0)
        let started=CACurrentMediaTime()
        XCTAssertEqual(scene.finishDrag(at:point,now:1)?.accepted,false)
        XCTAssertFalse(field.isRunning,"Pointer-up alone cannot restart the source producer")
        await fulfillment(of:[returned],timeout:3)
        XCTAssertGreaterThanOrEqual(CACurrentMediaTime()-started,0.265)
        XCTAssertEqual(completed,1);XCTAssertTrue(field.isRunning)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertFalse(field.isRunning)
        XCTAssertEqual(scene.finishDrag(at:point,now:2)?.accepted,false)
        XCTAssertTrue(scene.beginDrag(at:point),"Second accepted pickup interrupts the previous landing owner")
        try await Task.sleep(for:.milliseconds(350))
        XCTAssertFalse(field.isRunning);XCTAssertEqual(completed,1,"Interrupted landing cannot replay an old producer")
    }

}
