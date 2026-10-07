import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeAppPaperTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    func testCanonicalPaperRetainsSourceTextureScaleTintAndGradientDuringRelayout() throws {
        let paper=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:root))
        XCTAssertFalse(paper.isUserInteractionEnabled)
        XCTAssertEqual(paper.subviews.count,2)
        let texture=try XCTUnwrap(paper.subviews.first as? UIImageView)
        XCTAssertNotNil(texture.image);XCTAssertEqual(texture.contentMode,.scaleToFill)
        let gradient=try XCTUnwrap(paper.layer.sublayers?.first as? CAGradientLayer)
        XCTAssertEqual(gradient.locations,[0,0.6,1])
        XCTAssertEqual(gradient.colors?.count,3)
        for size in [CGSize(width:390,height:844),CGSize(width:844,height:390)] {
            paper.frame=CGRect(origin:.zero,size:size);paper.setNeedsLayout();paper.layoutIfNeeded()
            XCTAssertEqual(gradient.frame,paper.bounds)
            for child in paper.subviews {XCTAssertEqual(child.frame,paper.bounds)}
            XCTAssertTrue(gradient.animationKeys()?.isEmpty ?? true)
        }
        var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
        XCTAssertTrue(try XCTUnwrap(paper.subviews.last?.backgroundColor).getRed(&r,green:&g,blue:&b,alpha:&a))
        XCTAssertEqual(r,243.0/255,accuracy:1e-8);XCTAssertEqual(g,238.0/255,accuracy:1e-8)
        XCTAssertEqual(b,232.0/255,accuracy:1e-8);XCTAssertEqual(a,0.4,accuracy:1e-8)
    }
    func testActualGameplayKeepsOneFixedPaperAcrossPreparedEntryAndCanvasMotion() throws {
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:1),NativeTile(id:"b",cell:NativeCell(column:1,row:0),value:2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        var release:(()->Void)?,requests=0
        controller.beforeInitialBoardEntry={callback in requests+=1;release=callback}
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer {controller.dispose();window.isHidden=true}
        controller.view.frame=window.bounds;controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let paper=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? NativeAppPaperSurface}.first)
        let renderer=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? SKView}.first)
        XCTAssertEqual(requests,1);XCTAssertTrue(renderer.isHidden)
        XCTAssertTrue(controller.view.subviews.first === paper)
        try XCTUnwrap(release)()
        controller.view.layoutIfNeeded();paper.layoutIfNeeded()
        XCTAssertFalse(renderer.isHidden)
        XCTAssertEqual(controller.view.subviews.filter{$0 is NativeAppPaperSurface}.count,1)
        let frame=paper.frame,canvas=try XCTUnwrap(controller.boardScene?.childNode(withName:"native-gameplay-canvas"))
        canvas.position=CGPoint(x:4,y:-3)
        controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        XCTAssertEqual(paper.frame,frame);XCTAssertEqual(paper.transform,.identity)
        let image=UIGraphicsImageRenderer(bounds:controller.view.bounds).image{_ in controller.view.drawHierarchy(in:controller.view.bounds,afterScreenUpdates:true)}
        let attachment=XCTAttachment(image:image);attachment.name="Native canonical gameplay paper after entry";attachment.lifetime = .keepAlways;add(attachment)
    }
}
