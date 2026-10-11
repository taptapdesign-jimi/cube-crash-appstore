import XCTest
@testable import Stack_to_Six
final class NativeNoMovesCueOrderTests:XCTestCase {
    @MainActor func testLiteralOriginalShowCuePrefixBeforeAnyCloudDrawOrRoot()async throws {
        let file=Bundle(for:NativeNoMovesCueOrderTests.self).url(forResource:"NativeNoMovesCueOriginalGraph",withExtension:"json")!
        let json=try JSONSerialization.jsonObject(with:Data(contentsOf:file)) as! [String:Any]
        for row in json["rows"] as! [[String:Any]] {
            let events=row["events"] as! [[String:Any]]
            let prefix=try XCTUnwrap(events.first{($0["kind"] as? String)=="sound"})
            let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
            var seed:UInt32=127,draws=0,cues=0
            let owner=try NativeNoMovesSourceGraph(width:390,height:844,scheduler:NativeNoMovesValueScheduler(runtime),current:{true},random:{seed=seed &* 1664525 &+ 1013904223;draws += 1;return Double(seed)/4294967296},beforeClouds:{composition in
                XCTAssertEqual(draws,prefix["draws"] as? Int)
                XCTAssertEqual(composition.letters.count,prefix["mountedGlyphs"] as? Int)
                XCTAssertEqual(runtime.activeCount,8)
                XCTAssertFalse(runtime.hasSourceTickerDemand,"Eight original paused glyph bounces only")
                cues += 1
            })
            XCTAssertEqual(cues,1);XCTAssertEqual(draws,64);XCTAssertEqual(owner.clouds.count,5)
            owner.dispose();XCTAssertEqual(runtime.activeCount,0);runtime.dispose()
        }
    }
    @MainActor func testCapturedPrefixRetirementStopsBeforeCloudRNGAndRetiresAllGlyphRoots()async throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
        var current=true,draws=0,cues=0
        XCTAssertThrowsError(try NativeNoMovesSourceGraph(width:390,height:844,scheduler:NativeNoMovesValueScheduler(runtime),current:{current},random:{draws += 1;return 0.5},beforeClouds:{_ in cues += 1;current=false}))
        XCTAssertEqual(cues,1);XCTAssertEqual(draws,34);XCTAssertEqual(runtime.activeCount,0);runtime.dispose()
    }
    @MainActor func testStaleEntryEmitsNoCueAndConsumesNoVisualRandom()async throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
        var draws=0,cues=0
        XCTAssertThrowsError(try NativeNoMovesSourceGraph(width:390,height:844,scheduler:NativeNoMovesValueScheduler(runtime),current:{false},random:{draws += 1;return 0.5},beforeClouds:{_ in cues += 1}))
        XCTAssertEqual(draws,0);XCTAssertEqual(cues,0);XCTAssertEqual(runtime.activeCount,0);runtime.dispose()
    }
    @MainActor func testSourceOriginalFiveFullGraphsStillMatchAfterCueInsertion()async throws {
        let file=Bundle(for:NativeNoMovesCueOrderTests.self).url(forResource:"NativeNoMovesCueOriginalGraph",withExtension:"json")!
        let json=try JSONSerialization.jsonObject(with:Data(contentsOf:file)) as! [String:Any]
        for row in json["rows"] as! [[String:Any]] {
            let scenario=row["scenario"] as! String,runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
            var seed:UInt32=127,draws=0,exiting=false,exitWall:Double?
            let owner=try NativeNoMovesSourceGraph(width:390,height:844,scheduler:NativeNoMovesValueScheduler(runtime),current:{true},random:{seed=seed &* 1664525 &+ 1013904223;draws += 1;return Double(seed)/4294967296},beforeClouds:{_ in })
            for sample in row["samples"] as! [[String:Any]] {
                let wall=sample["wall"] as! Double
                if scenario=="globalPause" && wall==550{runtime.setGlobalPaused(true)}
                if scenario=="globalPause" && wall==1100{runtime.setGlobalPaused(false)}
                if scenario=="clearEarly" && wall==350{owner.dispose()}
                if !exiting && ((scenario=="earlyExit" && wall==350)||(scenario != "earlyExit" && scenario != "clearEarly" && wall==1500)) {exiting=true;exitWall=wall;owner.beginExit()}
                if let exitWall,wall>=exitWall+1190{owner.deliverExitFallback()}
                runtime.deliver(wallMilliseconds:wall)
                XCTAssertEqual(draws,sample["draws"] as! Int)
                XCTAssertEqual(owner.activeIDs,sample["order"] as! [UInt64])
                XCTAssertNotEqual(owner.disposed,sample["connected"] as! Bool)
                for(i,g)in (sample["glyphs"] as! [[String:Double]]).enumerated(){
                    let p=owner.glyphs[i]
                    for(field,value)in [("scale",p.scale),("alpha",p.alpha),("rx",p.rx),("ry",p.ry),("rz",p.rz),("z",p.z)] {XCTAssertEqual(value,g[field]!,accuracy:1e-9)}
                }
                for(i,g)in (sample["clouds"] as! [[String:Double]]).enumerated(){
                    let p=owner.cloudPoses[i],c=owner.clouds[i]
                    for(field,value)in [("x",p.x-c.x),("y",p.y-c.y),("scale",p.scale),("alpha",p.alpha)] {XCTAssertEqual(value,g[field]!,accuracy:1e-9)}
                }
            }
            owner.dispose();runtime.dispose();XCTAssertEqual(runtime.activeCount,0)
        }
    }
}
