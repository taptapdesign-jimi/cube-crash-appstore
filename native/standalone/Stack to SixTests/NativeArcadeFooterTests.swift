import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeArcadeFooterTests:XCTestCase {
    func testRoundPaperUsesTutorialCaptionAndReusesTextureAcrossSettledUpdates() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let footer=NativeRoundIndicator(font:assets.font(size:18,weight:"SemiBold"),artwork:assets)
        let paper=try XCTUnwrap(footer.childNode(withName:"//native-game-round-paper") as? SKSpriteNode)
        footer.synchronize(round:4,arcade:false,viewport:.init(width:390,height:844),alpha:1)
        XCTAssertNil(paper.texture,"Hidden Journey chrome does not prepare paper")
        let output=URL(fileURLWithPath:"/tmp/round-paper/renders")
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180),CGSize(width:390,height:844)] {
            footer.synchronize(round:4,arcade:true,viewport:size,alpha:1)
            let first=try XCTUnwrap(paper.texture)
            XCTAssertEqual(paper.alpha,0.63,accuracy:0.000001);XCTAssertEqual(footer.alpha,1)
            let label=try XCTUnwrap(footer.childNode(withName:"//native-game-round-label") as? SKLabelNode)
            XCTAssertEqual(label.alpha,1)
            var actualR:CGFloat=0,actualG:CGFloat=0,actualB:CGFloat=0,actualA:CGFloat=0
            var expectedR:CGFloat=0,expectedG:CGFloat=0,expectedB:CGFloat=0,expectedA:CGFloat=0
            XCTAssertTrue(label.fontColor?.getRed(&actualR,green:&actualG,blue:&actualB,alpha:&actualA)==true)
            NativeTextPalette.modalTitle.getRed(&expectedR,green:&expectedG,blue:&expectedB,alpha:&expectedA)
            for (actual,expected) in zip([actualR,actualG,actualB,actualA],[expectedR,expectedG,expectedB,expectedA]) {XCTAssertEqual(actual,expected,accuracy:0.00001)}
            XCTAssertEqual(label.attributedText?.string,"Endurance - 04")
            let copy=try XCTUnwrap(label.attributedText)
            let font=try XCTUnwrap(copy.attribute(.font,at:0,effectiveRange:nil) as? UIFont)
            XCTAssertEqual(font.fontName,assets.font(size:17,weight:"ExtraBold").fontName)
            XCTAssertEqual(font.pointSize,17*(size.width==820 ? 1.4:1),accuracy:0.001)
            XCTAssertEqual(copy.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor,NativeTextPalette.modalTitle)
            XCTAssertEqual(copy.attribute(.foregroundColor,at:copy.length-1,effectiveRange:nil) as? UIColor,UIColor(red:231/255,green:116/255,blue:73/255,alpha:1))
            footer.synchronize(round:4,arcade:true,viewport:size,alpha:1)
            XCTAssertTrue(paper.texture === first,"Same-size synchronization must not rasterize paper again")
            let scene=SKScene(size:.init(width:size.width,height:130));scene.backgroundColor=NativeAppPaperSurface.base
            let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
            footer.removeFromParent();scene.addChild(footer);footer.position=CGPoint(x:scene.size.width/2,y:65);footer.enter(animated:false)
            let texture=try XCTUnwrap(view.texture(from:scene))
            try UIImage(cgImage:texture.cgImage()).pngData()?.write(to:output.appendingPathComponent("footer-\(Int(size.width)).png"))
            view.presentScene(nil);footer.removeFromParent()
        }
        let first=footer.beginSourceBackpackDividerMask(),second=footer.beginSourceBackpackDividerMask()
        XCTAssertTrue(footer.sourceDividerLinesHidden);first();XCTAssertTrue(footer.sourceDividerLinesHidden)
        second();XCTAssertFalse(footer.sourceDividerLinesHidden)
        footer.synchronize(round:4,arcade:false,viewport:.init(width:390,height:844),alpha:1)
        XCTAssertTrue(footer.isHidden);XCTAssertFalse(footer.hasAnimatedPresentation)
    }
    func testFooterNamesEachArcadeVariantAndTracksCurrentRound() throws {
        for variant in NativeArcadeVariant.allCases {
            let footer=NativeRoundIndicator(font:.systemFont(ofSize:18,weight:.semibold))
            footer.synchronize(round:1,arcade:true,viewport:.init(width:390,height:844),alpha:1,variant:variant)
            let label=try XCTUnwrap(footer.childNode(withName:"//native-game-round-label") as? SKLabelNode)
            XCTAssertEqual(label.attributedText?.string,"\(variant.title) - 01")
            XCTAssertFalse(footer.isHidden)
            footer.synchronize(round:12,arcade:true,viewport:.init(width:390,height:844),alpha:1,variant:variant)
            XCTAssertEqual(label.attributedText?.string,"\(variant.title) - 12")
        }
    }
    func testJourneyKeepsArcadeFooterHidden() {
        let footer=NativeRoundIndicator(font:.systemFont(ofSize:18,weight:.semibold))
        footer.synchronize(round:3,arcade:false,viewport:.init(width:390,height:844),alpha:1,variant:.slowBurn)
        XCTAssertTrue(footer.isHidden)
    }
}
