import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeDragHoverCadenceTests:XCTestCase {
    func testHighRatePointerSamplesLimitGeometryWorkButReleaseAlwaysReadsLiveTarget() {
        var cadence=NativeDragHoverCadence(),calls=0
        for sample in 0..<120 {
            let result=cadence.pick(sourceID:"held",generation:1,revision:2,
                nowMs:Double(sample)*1000/120,force:false){calls+=1;return "hover"}
            XCTAssertEqual(result,"hover")
        }
        XCTAssertEqual(calls,40,"v9 24ms hover cadence, independent of pointer delivery rate")
        XCTAssertEqual(cadence.pick(sourceID:"held",generation:1,revision:2,nowMs:992,force:true){calls+=1;return "release"},"release")
        XCTAssertEqual(calls,41,"Release bypasses the cached hover even inside the same24ms window")
    }
    func testNilResultCachesAndNewDragOrRevisionCannotReuseOldTarget() {
        var cadence=NativeDragHoverCadence(),calls=0
        func pick(_ source:String="a",_ generation:UInt64=1,_ revision:UInt64=1,_ now:Double=10)->String? {
            cadence.pick(sourceID:source,generation:generation,revision:revision,nowMs:now,force:false){calls+=1;return nil}
        }
        XCTAssertNil(pick());XCTAssertNil(pick());XCTAssertEqual(calls,1)
        _=pick("b");_=pick("b",2);_=pick("b",2,2);_=pick("b",2,2,9)
        XCTAssertEqual(calls,5)
        cadence.reset();_=pick("b",2,2,9);XCTAssertEqual(calls,6)
    }
    func testActualRecursiveTargetGeometryWorkMatchesUncachedOracleAtEveryRefresh() {
        let source=SKNode(),targets=(0..<45).map{index in
            let node=SKNode();node.position=CGPoint(x:CGFloat(index%5)*70,y:CGFloat(index/5)*70)
            for child in 0..<12 {
                let sprite=SKSpriteNode(color:.white,size:.init(width:60,height:60))
                sprite.position=CGPoint(x:0,y:CGFloat(child)*2);node.addChild(sprite)
            }
            return node
        }
        source.addChild(SKSpriteNode(color:.white,size:.init(width:60,height:60)))
        var cadence=NativeDragHoverCadence(),calls=0
        func resolve()->String? {
            calls+=1
            return NativeRegularDropTarget.pick(source:source.calculateAccumulatedFrame(),
                candidates:targets.enumerated().map{.init(id:String($0.offset),bounds:$0.element.calculateAccumulatedFrame(),pointerBounds:$0.element.frame)},
                pointer:nil,tileSize:60)
        }
        let before=CACurrentMediaTime()
        for _ in 0..<120 {_=resolve()}
        let baseline=(CACurrentMediaTime()-before)*1000;calls=0
        let after=CACurrentMediaTime()
        for sample in 0..<120 {
            let actual=cadence.pick(sourceID:"held",generation:1,revision:1,nowMs:Double(sample)*1000/120,force:false,resolve:resolve)
            XCTAssertEqual(actual,"0")
        }
        let optimized=(CACurrentMediaTime()-after)*1000
        XCTAssertEqual(calls,40)
        print("[NativeDragGeometryCost]120pointerSamples targets45 descendants540 uncachedMs=\(baseline) v9CadenceMs=\(optimized) geometryPasses=\(calls)")
    }
}
