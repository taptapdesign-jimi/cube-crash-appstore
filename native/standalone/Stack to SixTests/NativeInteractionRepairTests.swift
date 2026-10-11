import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
private final class RepairPan: UIPanGestureRecognizer {
    var phase: UIGestureRecognizer.State = .possible
    var offset = CGPoint.zero
    var speed = CGPoint.zero
    override var state: UIGestureRecognizer.State { get { phase } set { phase = newValue } }
    override func translation(in view: UIView?) -> CGPoint { offset }
    override func setTranslation(_ translation: CGPoint, in view: UIView?) { offset = translation }
    override func velocity(in view: UIView?) -> CGPoint { speed }
}

@MainActor
final class NativeInteractionRepairTests: XCTestCase {
    override func setUpWithError() throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A" else { throw XCTSkip("Dedicated QA Simulator only") }
    }
    func testSelectionInstallsOriginalMotionForTrackAndNavigationAndSuspendsTogether() throws {
        let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let hub=JimiV9HubView(frame:home.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let motion=NativeRouteMotion(home:home,hub:hub)
        home.layoutIfNeeded();let old=home.sliderTrack.layer.position.x
        motion.selectSlide(2) {}
        let a=try XCTUnwrap(home.sliderTrack.layer.animation(forKey:"native-slide-selection") as? CAKeyframeAnimation)
        XCTAssertEqual(a.duration,0.4);let values=try XCTUnwrap(a.values as? [Double])
        XCTAssertEqual(values.first,Double(old));XCTAssertEqual(values.last,Double(home.sliderTrack.layer.position.x))
        XCTAssertEqual(values[40],Double(old)+(Double(home.sliderTrack.layer.position.x)-Double(old))*0.875,accuracy:1e-8)
        for target in home.navigationLayoutTargets {XCTAssertEqual(target.view.layer.animation(forKey:"native-slide-selection")?.duration,0.38)}
        motion.suspend();XCTAssertEqual(home.sliderTrack.layer.speed,0)
        for target in home.navigationLayoutTargets {XCTAssertEqual(target.view.layer.speed,0)}
        motion.resume();XCTAssertEqual(home.sliderTrack.layer.speed,1)
        motion.cancel();motion.cancel()
        XCTAssertNil(home.sliderTrack.layer.animation(forKey:"native-slide-selection"))
        for target in home.navigationLayoutTargets {XCTAssertNil(target.view.layer.animation(forKey:"native-slide-selection"));XCTAssertEqual(target.view.layer.speed,1)}
    }
    func testReplacementStartsAtPaintedPoseAndCannotCompleteRetiredHero() async throws {
        let controller=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let home=JimiV9HomeView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let hub=JimiV9HubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        controller.view=home;window.rootViewController=controller;window.makeKeyAndVisible()
        let motion=NativeRouteMotion(home:home,hub:hub);defer {motion.cancel();window.isHidden=true}
        var retired=0,current=0;home.layoutIfNeeded();motion.selectSlide(1) {retired += 1}
        try await Task.sleep(nanoseconds:100_000_000)
        let painted=try XCTUnwrap(home.sliderTrack.layer.presentation()).position.x
        motion.selectSlide(2) {current += 1}
        let a=try XCTUnwrap(home.sliderTrack.layer.animation(forKey:"native-slide-selection") as? CAKeyframeAnimation)
        let values=try XCTUnwrap(a.values as? [Double]);XCTAssertEqual(try XCTUnwrap(values.first),Double(painted),accuracy:3)
        try await Task.sleep(nanoseconds:1_000_000_000)
        XCTAssertEqual(retired,0);XCTAssertEqual(current,1)
    }
    func testActualPanHandlerRetiresSelectionAndUsesSameSlideMotionOnRelease() async throws {
        let controller=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let home=JimiV9HomeView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let hub=JimiV9HubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        controller.view=home;window.rootViewController=controller;window.makeKeyAndVisible()
        let motion=NativeRouteMotion(home:home,hub:hub);defer {motion.cancel();window.isHidden=true}
        home.onPanBegan={motion.cancel();home.pauseHeroIdle();return true}
        home.onPanEnded={index,_ in motion.selectSlide(index) {}}
        home.layoutIfNeeded();motion.selectSlide(1) {}
        try await Task.sleep(nanoseconds:100_000_000)
        let painted=try XCTUnwrap(home.sliderTrack.layer.presentation()).position.x
        let pan=RepairPan();pan.phase = .began;pan.offset=CGPoint(x:-18,y:0)
        home.perform(NSSelectorFromString("pan:"),with:pan)
        XCTAssertNil(home.sliderTrack.layer.animation(forKey:"native-slide-selection"))
        XCTAssertEqual(home.sliderTrack.layer.position.x,painted,accuracy:3)
        pan.phase = .changed;pan.offset=CGPoint(x:-110,y:0)
        home.perform(NSSelectorFromString("pan:"),with:pan)
        XCTAssertEqual(home.sliderTrack.layer.position.x,painted-110,accuracy:3)
        let released=home.sliderTrack.layer.position.x
        pan.phase = .ended;pan.speed=CGPoint(x:-500,y:0)
        home.perform(NSSelectorFromString("pan:"),with:pan)
        XCTAssertEqual(home.selectedSlide,2)
        let track=try XCTUnwrap(home.sliderTrack.layer.animation(forKey:"native-slide-selection") as? CAKeyframeAnimation)
        XCTAssertEqual(track.duration,0.4)
        let values=try XCTUnwrap(track.values as? [Double]);XCTAssertEqual(try XCTUnwrap(values.first),Double(released),accuracy:3)
        // A fast gesture may deliver its entire travel at recognition and then
        // an immediate zero-translation/zero-velocity release. Do not lose it.
        pan.phase = .began;pan.offset=CGPoint(x:120,y:0)
        home.perform(NSSelectorFromString("pan:"),with:pan)
        pan.phase = .ended;pan.speed = .zero
        home.perform(NSSelectorFromString("pan:"),with:pan)
        XCTAssertEqual(home.selectedSlide,1)

    }
    func testRouteExitKeepsPaintedHeroBounceWhileRetiringSliderLayout() async throws {
        let controller=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let home=JimiV9HomeView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let hub=JimiV9HubView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        controller.view=home;window.rootViewController=controller;window.makeKeyAndVisible()
        let motion=NativeRouteMotion(home:home,hub:hub);defer {motion.cancel();window.isHidden=true}
        home.layoutIfNeeded();motion.selectSlide(1) {}
        try await Task.sleep(nanoseconds:360_000_000)
        let painted=try XCTUnwrap(home.heroView.layer.presentation()).transform.m11
        motion.cancelSelectionLayout()
        XCTAssertNil(home.sliderTrack.layer.animation(forKey:"native-slide-selection"))
        XCTAssertNotNil(home.heroView.layer.animation(forKey:"native-route"))
        let entries=motion.homeTracks(enter:false)
        let hero=try XCTUnwrap(entries.first {$0.0 === home.heroView})
        XCTAssertEqual(try XCTUnwrap(hero.1.tweens.first).from.scaleX,Double(painted),accuracy:0.003)
        motion.animate(entries) {}
    }
    private func scene(_ sourceValue:Int,_ targetValue:Int)->NativeBoardScene {
        let tiles=[NativeTile(id:"source",cell:.init(column:0,row:0),value:sourceValue),NativeTile(id:"target",cell:.init(column:1,row:0),value:targetValue)]
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles)),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0));return scene
    }
    func testFastReleaseWithoutMoveAcceptsStackAndMergeOutsideStrictCell() throws {
        for (a,b) in [(1,2),(3,3)] {
            let scene=scene(a,b);defer {scene.dispose()}
            let g=try XCTUnwrap(scene.boardGeometry),start=g.center(row:0,column:0),center=g.center(row:0,column:1)
            let release=CGPoint(x:center.x+g.tileSize*0.58,y:center.y)
            XCTAssertNil(g.cell(at:release));XCTAssertTrue(scene.beginDrag(at:start))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:release,now:1)).accepted)
            XCTAssertNil(scene.finishDrag(at:release,now:1))
        }
    }
    func testFastReleaseSupersedesOldMoveAndKeepsInvalidTargetsRejected() throws {
        let scene=scene(4,3);defer {scene.dispose()};let g=try XCTUnwrap(scene.boardGeometry)
        XCTAssertTrue(scene.beginDrag(at:g.center(row:0,column:0)))
        scene.moveDrag(to:g.center(row:0,column:1))
        XCTAssertFalse(try XCTUnwrap(scene.finishDrag(at:g.center(row:0,column:1),now:1)).accepted)
        XCTAssertEqual(scene.engine.state.tiles.map(\.value),[4,3])
        XCTAssertTrue(scene.beginDrag(at:g.center(row:0,column:0)))
        scene.cancelDrag();scene.setSuspended(true);XCTAssertNil(scene.finishDrag(at:g.center(row:0,column:1),now:2))
    }
    func testOrdinaryPipsUseOneSharedTextureInsteadOfLiveShapeNodes() throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        defer {textures.dispose()}
        let a=textures.pipTexture(),b=textures.pipTexture();XCTAssertTrue(a===b)
        let node=NativeDiceNode(id:"a",value:6,kind:"regular",variant:nil,depth:1,locked:false,textures:textures)
        let pipRoot=try XCTUnwrap(node.visual.children.first {$0.zPosition==1})
        XCTAssertEqual(pipRoot.children.count,6);XCTAssertTrue(pipRoot.children.allSatisfy {$0 is SKSpriteNode})
        for pip in pipRoot.children {XCTAssertTrue((pip as? SKSpriteNode)?.texture===a)}
        node.dispose()
    }
}
