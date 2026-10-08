import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeHUDTransitionTests:XCTestCase {
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

    func testActualSceneDefersRevealToTwoFutureUpdatesAndHoldsDuringSuspension()async throws {
        let scene=makeScene()
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);scene.dispose();window.isHidden=true}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:true)
        let midpoint=try XCTUnwrap(scene.action(forKey:"hud-midpoint"))
        let reached=expectation(description:"Actual source midpoint callback ran")
        scene.removeAction(forKey:"hud-midpoint")
        // Wrap the actual captured action solely to freeze its renderer after
        // its callback. Neither the duration nor original callback is replaced.
        scene.run(.sequence([midpoint,.run{renderer.isPaused=true;reached.fulfill()}]),withKey:"midpoint-observer")
        var revealed=0
        scene.onHUDDrop={_ in revealed+=1}
        window.makeKeyAndVisible();renderer.presentScene(scene)
        await fulfillment(of:[reached],timeout:4)
        XCTAssertTrue(scene.isHUDRevealPending);XCTAssertEqual(revealed,0)
        let clock=ProcessInfo.processInfo.systemUptime
        scene.setSuspended(true);scene.update(clock)
        XCTAssertTrue(scene.isHUDRevealPending);XCTAssertEqual(revealed,0)
        scene.setSuspended(false)
        scene.update(clock+0.016)
        XCTAssertTrue(scene.isHUDRevealPending);XCTAssertEqual(revealed,0)
        scene.update(clock+0.032)
        XCTAssertFalse(scene.isHUDRevealPending);XCTAssertEqual(revealed,1)
        scene.update(clock+0.048);XCTAssertEqual(revealed,1)
    }

    func testActualExitRetiresDropAfterWaveAndPreservesCapturedPose()async throws {
        let scene=makeScene()
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller
        defer{renderer.presentScene(nil);scene.dispose();window.isHidden=true}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0),animateEntry:true)
        let hud=try XCTUnwrap(scene.childNode(withName:"//native-game-hud"))
        let interrupted=expectation(description:"Late HUD drop interrupted after board wave")
        scene.onHUDDrop={_ in
            hud.run(.sequence([.wait(forDuration:0.65),.run{renderer.isPaused=true;interrupted.fulfill()}]),withKey:"drop-interruption-observer")
        }
        window.makeKeyAndVisible();renderer.presentScene(scene)
        await fulfillment(of:[interrupted],timeout:5)
        XCTAssertNotNil(hud.action(forKey:"hud-enter"))
        XCTAssertNil(scene.childNode(withName:"//native-die-hud-fixture")?.action(forKey:"entry"))
        let start=hud.position,alpha=hud.alpha
        let completed=expectation(description:"Captured native exit completes")
        scene.animateExit{success in XCTAssertTrue(success);completed.fulfill()}
        XCTAssertNil(hud.action(forKey:"hud-enter"))
        XCTAssertEqual(hud.position,start);XCTAssertEqual(hud.alpha,alpha)
        renderer.isPaused=false
        await fulfillment(of:[completed],timeout:4)
        XCTAssertEqual(hud.position.y,NativeGameplayChromePlan.make(viewport:scene.size,safeTop:47).hudTop*3,accuracy:0.000001)
        XCTAssertEqual(hud.alpha,0,accuracy:0.000001)
    }

    private func makeScene()->NativeBoardScene {
        let tile=NativeTile(id:"hud-fixture",cell:NativeCell(column:0,row:0),value:1)
        return NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
    }
}
