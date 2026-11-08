import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeHUDTransitionTests:XCTestCase {
    func testScoreGlyphsFollowHeaderArcAndKeepArrivalScaleOwner() throws {
        for width:CGFloat in [390,820] {
            let score=NativeArchedHUDScore()
            score.fontName=UIFont.boldSystemFont(ofSize:18).fontName
            score.position=CGPoint(x:width*0.32,y:50)
            score.text="4.648";score.followHeader(width:width)
            let glyphs=try score.children.map{try XCTUnwrap($0 as? SKLabelNode)}
            XCTAssertEqual(glyphs.map{$0.text ?? ""}.joined(),"4.648")
            XCTAssertGreaterThan(score.frame.width,0)
            for glyph in glyphs {
                let x=score.position.x+glyph.position.x
                XCTAssertEqual(glyph.zRotation,-JimiV9NavigationHeader.tangentAngle(at:x,width:width),accuracy:0.000001)
            }
            XCTAssertLessThan(try XCTUnwrap(glyphs.last).position.y,try XCTUnwrap(glyphs.first).position.y)
            XCTAssertGreaterThan(try XCTUnwrap(glyphs.last).zRotation,try XCTUnwrap(glyphs.first).zRotation)
            score.setScale(1.2);score.followHeader(width:width)
            XCTAssertEqual(score.xScale,1.2,accuracy:0.000001)
            XCTAssertTrue(score.children[0] === glyphs[0],"Settled updates reuse glyphs during coin feedback")
            score.text="100.000.000"
            XCTAssertEqual(score.children.count,11)
            score.text="0";XCTAssertEqual(score.children.count,1)
        }
    }

    func testTabletArcadeRoundPillKeepsPhoneVisibleBottomGap() {
        let font=UIFont.systemFont(ofSize:18,weight:.semibold)
        let indicator=NativeRoundIndicator(font:font)
        let phone=CGSize(width:390,height:844),tablet=CGSize(width:820,height:1180)
        let base=CGPoint(x:195,y:43)
        let phoneCenter=indicator.restCenter(base,viewport:phone,arcade:true)
        let tabletCenter=indicator.restCenter(base,viewport:tablet,arcade:true)
        let height=font.lineHeight+10
        XCTAssertEqual(phoneCenter,base)
        XCTAssertEqual(phoneCenter.y-height/2,tabletCenter.y-height*1.4/2,accuracy:0.000001)
        XCTAssertEqual(indicator.restCenter(base,viewport:tablet,arcade:false),base)
    }

    private func oracle(_ name:String)throws->Any {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:name,withExtension:"json"))
        return try JSONSerialization.jsonObject(with:Data(contentsOf:url))
    }

    func testLiteralOriginalGSAPDropRiseAndInterruptedDropPoses()throws {
        let rows=try XCTUnwrap(oracle("NativeHUDTransitionSourceOracle") as? [[Double]])
        XCTAssertEqual(rows.count,4209)
        for row in rows {
            let pose=row[0]==0 ? NativeHUDTransitionMotion.drop(at:row[2])
                :NativeHUDTransitionMotion.rise(at:row[2],top:row[1],from:.init(offset:row[5],alpha:row[6]))
            // Original GSAP stores generic tween values with six decimal places.
            XCTAssertEqual(pose.offset,row[3],accuracy:0.000001)
            XCTAssertEqual(pose.alpha,row[4],accuracy:0.000001)
        }
    }

    func testLiteralOriginalMidpointArbitrationAndNestedRAFDecisions()throws {
        let cases=try XCTUnwrap(oracle("NativeHUDRevealSourceOracle") as? [[String:Any]])
        XCTAssertEqual(cases.count,8)
        for row in cases {
            var owner=NativeHUDEntryReveal()
            let receipt=owner.begin(generation:1,tileCount:try XCTUnwrap(row["count"] as? Int))
            var drops=0
            for event in try XCTUnwrap(row["events"] as? [[Any]]) {
                switch try XCTUnwrap(event[0] as? String) {
                case "midpoint":owner.midpoint(receipt)
                case "tile":owner.tileCompleted(receipt)
                case "frame":if owner.renderedCallback(receipt){drops+=1}
                case "stale-half":owner.midpoint(receipt);owner.tileCompleted(receipt)
                default:XCTFail("Unexpected original source event")
                }
                XCTAssertEqual(drops,try XCTUnwrap(event[2] as? Int))
            }
        }
    }

    func testOrdinaryHUDStartsOnFirstUpdateBeforeDiceFinishAndHoldsDuringSuspension()throws {
        for size in [CGSize(width:390,height:844),CGSize(width:744,height:1133),CGSize(width:820,height:1180)] {
        let scene=makeScene(size:size,count:40)
        let window=UIWindow(frame:CGRect(origin:.zero,size:size)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);scene.dispose();window.isHidden=true}
        renderer.isPaused=true
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:true)
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        XCTAssertEqual(hud.children.filter{$0.name?.hasPrefix("preload-navigation-hud-")==true}.count,4)
        var revealed=0;scene.onHUDDrop={_ in revealed+=1}
        window.makeKeyAndVisible();renderer.presentScene(scene)
        let clock=ProcessInfo.processInfo.systemUptime
        scene.setSuspended(true);scene.update(clock)
        XCTAssertTrue(scene.isHUDRevealPending);XCTAssertEqual(revealed,0)
        scene.setSuspended(false);scene.update(clock+0.016)
        XCTAssertFalse(scene.isHUDRevealPending);XCTAssertEqual(revealed,1)
        XCTAssertFalse(scene.isBoardEntryComplete,"HUD must not wait for the tile wave")
        XCTAssertNotNil(scene.childNode(withName:"//native-game-hud")?.action(forKey:"hud-enter"))
        scene.update(clock+0.032);scene.update(clock+0.048)
        XCTAssertEqual(revealed,1,"Original midpoint cannot replay the admitted first-frame HUD")
    }
    }

    func testRestartChromeFinishesAtItsOwnFastSpeedBeforeBoardExit()async throws {
        let scene=makeScene(count:40)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);scene.dispose();window.isHidden=true}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:false)
        window.makeKeyAndVisible();renderer.presentScene(scene)
        var boardDone=false,chromeCalls=0
        let chrome=expectation(description:"Fast independent chrome deadline"),board=expectation(description:"Original slower tile wave")
        scene.animateExit(restartChrome:true,chromeCompletion:{success in
            XCTAssertTrue(success);chromeCalls+=1;XCTAssertFalse(boardDone)
            XCTAssertTrue((0..<40).contains{scene.sourceNativeTileNode("hud-fixture-\($0)")?.action(forKey:"board-exit") != nil})
            chrome.fulfill()
        }){success in XCTAssertTrue(success);boardDone=true;board.fulfill()}
        await fulfillment(of:[chrome,board],timeout:4)
        XCTAssertEqual(chromeCalls,1)
    }

    func testInterruptedFastChromeReceiptCancelsOnceOnSceneDisposal() {
        let scene=makeScene(count:40)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);window.isHidden=true}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:false)
        window.makeKeyAndVisible();renderer.presentScene(scene)
        var chromeResults:[Bool]=[],boardResults:[Bool]=[]
        scene.animateExit(restartChrome:true,chromeCompletion:{chromeResults.append($0)}){boardResults.append($0)}
        scene.dispose();scene.dispose()
        XCTAssertEqual(chromeResults,[false]);XCTAssertEqual(boardResults,[false])
    }

    func testActualExitRetiresEarlyHUDEntryAndPreservesCapturedPose()async throws {
        let scene=makeScene()
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);scene.dispose();window.isHidden=true}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:true)
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        let interrupted=expectation(description:"Early parallel HUD entry interrupted")
        scene.onHUDDrop={_ in
            hud.run(.sequence([.wait(forDuration:0.65),.run{renderer.isPaused=true;interrupted.fulfill()}]),withKey:"drop-interruption-observer")
        }
        window.makeKeyAndVisible();renderer.presentScene(scene)
        await fulfillment(of:[interrupted],timeout:5)
        XCTAssertNotNil(hud.action(forKey:"hud-enter"))
        let start=hud.position,alpha=hud.alpha
        let completed=expectation(description:"Captured native exit completes")
        scene.animateExit{success in XCTAssertTrue(success);completed.fulfill()}
        XCTAssertNil(hud.action(forKey:"hud-enter"))
        XCTAssertEqual(hud.position,start);XCTAssertEqual(hud.alpha,alpha)
        renderer.isPaused=false
        await fulfillment(of:[completed],timeout:4)
        let groups=hud.children.filter{$0.name?.hasPrefix("preload-navigation-hud-")==true}
        XCTAssertEqual(groups.count,4)
        XCTAssertEqual(hud.position,start,"Gameplay HUD carrier stays at rest while its four groups exit")
        for group in groups {XCTAssertEqual(group.alpha,0,accuracy:0.000001)}
    }

    func testRestartRevealsOnFirstFrameFromBelowAndExitsDownWithFixedCloseAndBag()async throws {
        try await exerciseRestartChrome(size:CGSize(width:390,height:844))
    }
    func testTabletRestartUsesSameTwoGroupsWithoutMovingCloseOrBag()async throws {
        try await exerciseRestartChrome(size:CGSize(width:744,height:1133))
    }
    private func exerciseRestartChrome(size:CGSize)async throws {
        let scene=makeScene(size:size);scene.replaysRestartChrome=true
        let window=UIWindow(frame:CGRect(origin:.zero,size:size)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);scene.dispose();window.isHidden=true}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:true)
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        let groups=try (0..<4).map{try XCTUnwrap(hud.childNode(withName:"preload-navigation-hud-\($0)"))}
        func displacement(_ group:SKNode)->CGFloat {
            let bounds=group.children.reduce(CGRect.null){$0.union($1.frame)}
            let anchor=CGPoint(x:bounds.midX,y:bounds.midY)
            return group.convert(anchor,to:hud).y-anchor.y
        }
        var revealed=0,entryMinimum=[CGFloat](repeating:0,count:4),exitMinimum=entryMinimum
        let entered=expectation(description:"One finite first-frame Restart HUD enter")
        scene.onHUDDrop={_ in
            revealed+=1
            hud.run(.sequence([.customAction(withDuration:1.1){_,_ in
                for i in [0,2] {entryMinimum[i]=min(entryMinimum[i],displacement(groups[i]))}
                for i in [1,3] {XCTAssertEqual(groups[i].position,.zero);XCTAssertEqual(groups[i].alpha,1)}
            },.run{entered.fulfill()}]),withKey:"restart-entry-observer")
        }
        window.makeKeyAndVisible();renderer.presentScene(scene)
        await fulfillment(of:[entered],timeout:4)
        XCTAssertEqual(revealed,1,"Original midpoint may not replay Restart HUD")
        XCTAssertFalse(scene.isHUDRevealPending)
        for i in [0,2] {XCTAssertLessThan(entryMinimum[i],-1)}
        let completed=expectation(description:"Restart exit joins actual board and HUD owners")
        scene.animateExit(restartChrome:true){success in XCTAssertTrue(success);completed.fulfill()}
        hud.run(.customAction(withDuration:2){_,_ in
            for i in [0,2] {exitMinimum[i]=min(exitMinimum[i],displacement(groups[i]))}
            for i in [1,3] {XCTAssertEqual(groups[i].position,.zero);XCTAssertEqual(groups[i].alpha,1)}
        },withKey:"restart-exit-observer")
        await fulfillment(of:[completed],timeout:4)
        for i in [0,2] {XCTAssertLessThan(exitMinimum[i],-1)}
        for i in [0,2] {XCTAssertEqual(groups[i].alpha,0,accuracy:0.000001)}
    }

    private func makeScene(size:CGSize=CGSize(width:390,height:844),count:Int=1)->NativeBoardScene {
        let tiles=(0..<count).map{NativeTile(id:count==1 ? "hud-fixture":"hud-fixture-\($0)",cell:NativeCell(column:$0%5,row:$0/5),value:1)}
        return NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:tiles)),resourceRoot:NativeTestResources.root,size:size)
    }
}
