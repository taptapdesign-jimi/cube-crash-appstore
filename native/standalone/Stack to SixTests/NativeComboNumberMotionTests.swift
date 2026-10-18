import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeComboNumberMotionTests: XCTestCase {
    private func expected(from: Double, peak: Double, time: Double) -> Double {
        let rise=max(0.08,0.16-(from-1)*0.06),start=max(0,rise-0.01)
        func inflate(_ t:Double)->Double {
            let x=t-1
            return 1+4*x*x*x+3*x*x
        }
        if time<start {return from+(peak-from)*inflate(time/rise)}
        let top=from+(peak-from)*inflate(start/rise)
        let t=min(1,(time-start)/2.1)
        return top+(1-top)*(1-pow(1-t,3))
    }
    func testAuthoredStackAndSixBalloonOverlapAndFiniteReturn() {
        for (kind,peak) in [(NativeComboNumberMotion.Kind.stack,1.76),(.mergeSix,2.5)] {
            let label=SKLabelNode(),motion=NativeComboNumberMotion(number:label)
            motion.bump(kind:kind,combo:1,generation:1,reducedMotion:false)
            XCTAssertTrue(motion.advance(delta:0.10,visible:true,reducedMotion:false))
            XCTAssertEqual(Double(label.xScale),expected(from:1,peak:peak,time:0.10),accuracy:0.000001)
            motion.advance(delta:0.06,visible:true,reducedMotion:false)
            XCTAssertEqual(Double(label.xScale),expected(from:1,peak:peak,time:0.16),accuracy:0.000001)
            motion.advance(delta:2.1,visible:true,reducedMotion:false)
            XCTAssertFalse(motion.isActive);XCTAssertEqual(label.xScale,1)
            XCTAssertFalse(motion.advance(delta:1,visible:true,reducedMotion:false))
        }
    }
    func testRetriggerUsesCurrentScaleComboBonusAndCap() {
        let label=SKLabelNode(),motion=NativeComboNumberMotion(number:label)
        motion.bump(kind:.stack,combo:1,generation:5,reducedMotion:false)
        motion.advance(delta:0.08,visible:true,reducedMotion:false)
        let current=Double(label.xScale)
        motion.bump(kind:.mergeSix,combo:10,generation:5,reducedMotion:false)
        XCTAssertEqual(Double(label.xScale),current)
        motion.advance(delta:0.04,visible:true,reducedMotion:false)
        XCTAssertEqual(Double(label.xScale),expected(from:current,peak:3,time:0.04),accuracy:0.000001)
        motion.stop()
        motion.bump(kind:.mergeSix,combo:100,generation:5,reducedMotion:false)
        motion.advance(delta:0.10,visible:true,reducedMotion:false)
        XCTAssertEqual(Double(label.xScale),expected(from:1,peak:3.2,time:0.10),accuracy:0.000001)
    }
    func testPauseReducedMotionGenerationStopAndLostCombo() {
        let label=SKLabelNode(),motion=NativeComboNumberMotion(number:label)
        motion.bump(kind:.stack,combo:3,generation:4,reducedMotion:false)
        motion.advance(delta:0.1,visible:true,reducedMotion:false)
        let held=label.xScale
        XCTAssertFalse(motion.advance(delta:30,visible:false,reducedMotion:false));XCTAssertEqual(label.xScale,held)
        motion.synchronize(combo:0,generation:4,reducedMotion:false)
        motion.advance(delta:0.15,visible:true,reducedMotion:false)
        XCTAssertEqual(Double(label.xScale),Double(held)+(1-Double(held))*Double(NativeBoardMotion.Ease.elasticOut(1,0.9).sample(CGFloat(0.15/1.4))),accuracy:0.000001)
        motion.advance(delta:1.25,visible:true,reducedMotion:false)
        XCTAssertEqual(label.xScale,1);XCTAssertFalse(motion.isActive)
        motion.bump(kind:.stack,combo:1,generation:4,reducedMotion:false)
        motion.advance(delta:0.1,visible:true,reducedMotion:false)
        motion.synchronize(combo:2,generation:5,reducedMotion:false)
        XCTAssertEqual(label.xScale,1);XCTAssertFalse(motion.isActive)
        motion.bump(kind:.stack,combo:2,generation:5,reducedMotion:true)
        XCTAssertFalse(motion.isActive);XCTAssertEqual(label.xScale,1)
        motion.bump(kind:.stack,combo:2,generation:5,reducedMotion:false)
        motion.advance(delta:0.1,visible:true,reducedMotion:true)
        XCTAssertFalse(motion.isActive);XCTAssertEqual(label.xScale,1)
    }
    func testNumberIsWeakAndOwnerHasNoActionsOrInvalidDeltaWork() {
        var label:SKLabelNode?=SKLabelNode();weak var weakLabel=label
        let motion=NativeComboNumberMotion(number:label!)
        motion.bump(kind:.stack,combo:1,generation:1,reducedMotion:false)
        XCTAssertFalse(motion.advance(delta:.infinity,visible:true,reducedMotion:false))
        XCTAssertEqual(label?.xScale,1);XCTAssertFalse(label!.hasActions())
        label=nil;XCTAssertNil(weakLabel)
        motion.advance(delta:3,visible:true,reducedMotion:false)
        XCTAssertFalse(motion.isActive)
        motion.stop();XCTAssertFalse(motion.isActive)
    }

    private func wait(_ description:String,_ predicate:()->Bool) async throws {
        let end=Date().addingTimeInterval(30)
        while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(predicate(),description)
        if !predicate(){throw CancellationError()}
    }
    func testMountedSourceStackAndOrdinarySixAnimateOnlyNumberAndKeepRightEdgeSafe() async throws {
        for width:CGFloat in [320,390] {for value in [1,3] {
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("combo-motion-"+UUID().uuidString)
            let store=NativeSaveStore(directory:directory)
            var save=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
            save.progression.firstPlayTutorialComplete=true
            save.arcadeRun = .init(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:value),.init(id:"b",cell:.init(column:1,row:0),value:value),.init(id:"other",cell:.init(column:4,row:8),value:2)],mode:.arcade,board:3,stage:3,generation:9,moves:37)
            save.arcadeRunSavedAt=Date().timeIntervalSince1970;try store.save(save)
            let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
            let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
            let window=UIWindow(frame:CGRect(x:0,y:0,width:width,height:844));window.rootViewController=host;window.makeKeyAndVisible();host.loadViewIfNeeded()
            defer {host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
            let app=try XCTUnwrap(host.children.first as? NativeAppController)
            try await wait("Home ready"){!app.home.isHidden}
            app.navigate(.gameplay,interrupt:true)
            var game:NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
            try await wait("Actual source board admitted"){game?.boardScene?.isBoardEntryComplete==true && game?.beforeSourceGameplayAdmission==nil && game?.engine.hasUnsavableSourceGameplayState==false}
            let gameplay=try XCTUnwrap(game),scene=try XCTUnwrap(gameplay.boardScene)
            let number=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-value") as? SKLabelNode)
            let icon=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-image"))
            let iconScale=CGPoint(x:icon.xScale,y:icon.yScale)
            let source=try XCTUnwrap(scene.sourceNativeTileNode("a")),target=try XCTUnwrap(scene.sourceNativeTileNode("b"))
            let from=scene.convert(source.position,from:try XCTUnwrap(source.parent)),to=scene.convert(target.position,from:try XCTUnwrap(target.parent))
            XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
            if !UIAccessibility.isReduceMotionEnabled {
                try await wait("Number balloons on existing mounted Scene clock"){number.xScale>1.1}
                XCTAssertGreaterThan(number.xScale,1)
                XCTAssertLessThanOrEqual(number.frame.maxX,scene.size.width-12+0.01)
                XCTAssertFalse(number.hasActions())
                XCTAssertTrue(scene.childNode(withName:"//native-game-combo-image") === icon)
                XCTAssertEqual(CGPoint(x:icon.xScale,y:icon.yScale),iconScale)
                try await wait("Finite number deflates on existing mounted Scene clock"){abs(number.xScale-1)<0.001}
            }
            XCTAssertLessThanOrEqual(number.frame.maxX,scene.size.width-12+0.01)
            XCTAssertNil(gameplay.engine.state.terminal)
            XCTAssertEqual(gameplay.engine.state.effectiveArcadeVariant,.endurance)
        }}
    }
}
