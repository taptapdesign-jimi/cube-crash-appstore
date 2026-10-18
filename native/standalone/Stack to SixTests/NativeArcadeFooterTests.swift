import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeArcadeFooterTests:XCTestCase {
    func testFooterNamesEachArcadeVariantAndTracksCurrentRound() throws {
        for variant in NativeArcadeVariant.allCases {
            let footer=NativeRoundIndicator(font:.systemFont(ofSize:18,weight:.semibold))
            footer.synchronize(round:1,arcade:true,viewport:.init(width:390,height:844),alpha:1,variant:variant)
            let label=try XCTUnwrap(footer.childNode(withName:"//native-game-round-label") as? SKLabelNode)
            XCTAssertEqual(label.text,"\(variant.title) - 01")
            XCTAssertFalse(footer.isHidden)
            footer.synchronize(round:12,arcade:true,viewport:.init(width:390,height:844),alpha:1,variant:variant)
            XCTAssertEqual(label.text,"\(variant.title) - 12")
        }
    }
    func testJourneyKeepsArcadeFooterHidden() {
        let footer=NativeRoundIndicator(font:.systemFont(ofSize:18,weight:.semibold))
        footer.synchronize(round:3,arcade:false,viewport:.init(width:390,height:844),alpha:1,variant:.slowBurn)
        XCTAssertTrue(footer.isHidden)
    }
}
