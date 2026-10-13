import XCTest
import SpriteKit
@testable import Stack_to_Six

@MainActor final class NativeDragHoverCadenceTests:XCTestCase {
    func testSpecialOverlapRankingAndReleaseGracePreservePWALimits() {
        let targets:[NativeRegularDropTarget.Candidate]=[
            .init(id:"left",bounds:.init(x:0,y:0,width:100,height:100),pointerBounds:.init(x:0,y:0,width:100,height:100)),
            .init(id:"right",bounds:.init(x:110,y:0,width:100,height:100),pointerBounds:.init(x:110,y:0,width:100,height:100))]
        func pick(_ x:CGFloat,_ y:CGFloat=0,_ pointer:CGPoint?=nil,_ policy:NativeSpecialDropTarget.Policy = .direct)->String? {
            NativeSpecialDropTarget.pick(source:.init(x:x,y:y,width:100,height:100),center:.init(x:x+50,y:y+50),candidates:targets,pointer:pointer,tileSize:100,policy:policy)
        }
        XCTAssertEqual(pick(-95),"left","Five percent of destination area is sufficient")
        XCTAssertNil(pick(-96),"Below five percent contact must not select")
        XCTAssertEqual(pick(80),"right","Largest overlap wins")
        XCTAssertEqual(pick(-200,0,.init(x:105,y:50)),"left","Release pointer has ten percent grace")
        XCTAssertNil(pick(-200,0,.init(x:105,y:50),.barrel),"Barrel excludes pointer and center fallback")
        XCTAssertEqual(pick(0,145,nil,.magnet),"left","Magnet retains authored nearby hover field")
        XCTAssertNil(pick(0,151,nil,.magnet))
        XCTAssertEqual(pick(-65,0,.init(x:-15,y:50),.magnet),"left","Magnet release fallback admits72percent center radius")
        XCTAssertNil(pick(-73,0,.init(x:-23,y:50),.magnet))
    }
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
