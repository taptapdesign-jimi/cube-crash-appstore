import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeHUDCloseTests:XCTestCase {
    func testTypographicPlacementMatchesExecutedV9BrowserFontAdvanceAndAuthoredAsset() throws {
        let root=NativeTestResources.root,artwork=JimiV9Artwork(resourceRoot:root),texture=SKTexture(image:try XCTUnwrap(artwork.image("assets/close-icon.png")))
        let close=NativeHUDCloseNode(texture:texture,stageFont:artwork.font(size:16))
        // Actual immutable-v9 lblStyle/Text measured with original Pixi and
        // loaded Baloo2-Bold16 in Chrome: Stage.advance41.231964111328125.
        XCTAssertEqual(close.stageAdvance,41.231964111328125,accuracy:0.0001)
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:834,height:1194)] {
            let row=NativeGameplayChromePlan.make(viewport:size,safeTop:47).valueRowY
            close.layout(valueRowY:row)
            XCTAssertEqual(close.position.x,44.61598205566406,accuracy:0.0001);XCTAssertEqual(close.position.y,row)
            XCTAssertTrue(close.hitRect.contains(CGPoint(x:1,y:row+35.9)))
            XCTAssertTrue(close.hitRect.contains(CGPoint(x:102,y:row-31.9)))
            XCTAssertFalse(close.hitRect.contains(CGPoint(x:105,y:row)))
            XCTAssertFalse(close.hitRect.contains(CGPoint(x:1,y:row+36.1)))
            XCTAssertFalse(close.hitRect.contains(CGPoint(x:1,y:row-32.1)))
        }
        XCTAssertEqual(close.icon.size,CGSize(width:24,height:24));XCTAssertEqual(close.icon.alpha,0.8,accuracy:0.000001)
        XCTAssertEqual(close.ring.lineWidth,2);XCTAssertEqual(close.ring.lineCap,.butt);XCTAssertEqual(close.ring.lineJoin,.miter);XCTAssertEqual(close.ring.miterLimit,10)
        var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0
        XCTAssertTrue(close.ring.strokeColor.getRed(&red,green:&green,blue:&blue,alpha:&alpha))
        // SpriteKit stores alpha/color channels at Float32 precision.
        for (actual,source) in zip([red,green,blue,alpha],[232.0/255,212.0/255,199.0/255,1]) {XCTAssertEqual(actual,source,accuracy:0.000001)}
    }
    func testActualSceneUsesLiveCircleWithinCanonicalCanvas() throws {
        let tile=NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:1)
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        defer{scene.dispose()}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
        let close=try XCTUnwrap(scene.childNode(withName:"//native-game-close") as? NativeHUDCloseNode)
        XCTAssertEqual(close.position.y,NativeGameplayChromePlan.make(viewport:scene.size,safeTop:47).valueRowY)
        XCTAssertEqual(close.children.count,2);XCTAssertEqual(close.parent?.parent?.name,"native-gameplay-canvas")
    }
}
