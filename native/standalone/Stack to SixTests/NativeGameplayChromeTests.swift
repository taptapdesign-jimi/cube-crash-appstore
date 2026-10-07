import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeGameplayChromeTests:XCTestCase {
    private struct Sample:Decodable {
        let width:Double,height:Double,safeTop:Double,hudTop:Double,valueRowY:Double,meter:[Double]
    }
    func testPlacementMatchesExecutedOriginalOwnersAcrossViewportFamilies() throws {
        let samples=try JSONDecoder().decode([Sample].self,from:Data(NativeGameplayChromeSourceOracle.json.utf8))
        XCTAssertEqual(samples.count,35)
        for sample in samples {
            let plan=NativeGameplayChromePlan.make(viewport:CGSize(width:sample.width,height:sample.height),safeTop:sample.safeTop)
            XCTAssertEqual(plan.hudTop,sample.hudTop,accuracy:1e-8)
            XCTAssertEqual(plan.valueRowY,sample.valueRowY,accuracy:1e-8)
            for (actual,expected) in zip([plan.meterRect.minX,plan.meterRect.minY,plan.meterRect.width,plan.meterRect.height],sample.meter) {
                XCTAssertEqual(actual,expected,accuracy:1e-8)
            }
        }
        XCTAssertEqual(NativeGameplayChromePlan.visibleMeterRatio(-1),0)
        XCTAssertEqual(NativeGameplayChromePlan.visibleMeterRatio(2),1)
        XCTAssertEqual(NativeGameplayChromePlan.visibleMeterRatio(.nan),0)
    }
    func testConnectedSceneUsesTopWildMeterAndArcadeOnlyRound() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        for mode in [NativeRunMode.arcade,.journey] {
            let state=NativeBoardState(columns:5,rows:9,tiles:[NativeTile(id:"one",cell:NativeCell(column:0,row:0),value:1),NativeTile(id:"two",cell:NativeCell(column:1,row:0),value:2)],mode:mode,wildMeter:0.35)
            let engine=NativeGameplayEngine(state:state)
            let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844))
            defer {scene.dispose()}
            scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
            let round=try XCTUnwrap(scene.childNode(withName:"native-game-round-indicator"))
            XCTAssertEqual(round.isHidden,mode == .journey)
            XCTAssertEqual(round.position,CGPoint(x:195,y:43))
            let track=try XCTUnwrap(scene.childNode(withName:"//native-game-wild-meter-track") as? SKShapeNode)
            let expected=NativeGameplayChromePlan.make(viewport:scene.size,safeTop:47)
            XCTAssertEqual(track.position,expected.meterRect.origin)
            XCTAssertEqual(track.path?.boundingBoxOfPath.size,expected.meterRect.size)
            scene.enumerateChildNodes(withName:"//*") {node,_ in
                if let label=node as? SKLabelNode {XCTAssertFalse(label.text?.contains("MOVES") == true)}
            }
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),view=SKView(frame:window.bounds)
            let surface=UIView(frame:window.bounds),paper=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:root))
            paper.frame=surface.bounds;surface.addSubview(paper);surface.addSubview(view)
            view.backgroundColor = .clear;view.allowsTransparency=true
            controller.view=surface;window.rootViewController=controller;window.makeKeyAndVisible();view.presentScene(scene)
            try await Task.sleep(nanoseconds:100_000_000)
            let image=UIGraphicsImageRenderer(bounds:surface.bounds).image{_ in surface.drawHierarchy(in:surface.bounds,afterScreenUpdates:true)}
            let attachment=XCTAttachment(image:image);attachment.name="Native gameplay HUD \(mode.rawValue)";attachment.lifetime = .keepAlways;add(attachment)
            view.presentScene(nil);window.isHidden=true
        }
    }
    func testRoundIsHiddenBeforeFirstAnimatedPaintAndInactiveModeRetiresMotion() throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let round=NativeRoundIndicator(font:JimiV9Artwork(resourceRoot:root).font(size:18,weight:"SemiBold"))
        round.synchronize(round:1,arcade:true,viewport:CGSize(width:390,height:844),alpha:1)
        round.enter(animated:true)
        let painted=try XCTUnwrap(round.children.first)
        XCTAssertEqual(painted.alpha,0);XCTAssertEqual(painted.position.y,-72)
        round.enter(animated:false)
        XCTAssertEqual(painted.alpha,0,"Routine state synchronization cannot reveal the Round ahead of its entry")
        XCTAssertTrue(round.hasAnimatedPresentation)
        round.synchronize(round:1,arcade:false,viewport:CGSize(width:390,height:844),alpha:1)
        XCTAssertTrue(round.isHidden);XCTAssertFalse(round.hasAnimatedPresentation)
        round.synchronize(round:2,arcade:true,viewport:CGSize(width:390,height:844),alpha:1)
        XCTAssertTrue(round.hasAnimatedPresentation)
        round.enter(animated:false)
        XCTAssertTrue(round.hasAnimatedPresentation,"Value bounce survives routine synchronization")
        round.cancelExit();XCTAssertFalse(round.hasAnimatedPresentation)
    }
}
