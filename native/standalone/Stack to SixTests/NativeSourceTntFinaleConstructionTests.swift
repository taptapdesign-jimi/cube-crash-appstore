import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceTntFinaleConstructionTests:XCTestCase {
    func testActualUIKitGlyphConsumesCapturedPlanWithoutSecondCtorEntropy()throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        var draws=0
        let plan=try XCTUnwrap(NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{draws+=1;return 0.2},current:{true}))
        XCTAssertEqual(draws,18)
        let color=UIColor(red:241.0/255,green:132.0/255,blue:83.0/255,alpha:1)
        let field=NativeSplashGlyphField(artwork:JimiV9Artwork(resourceRoot:root),text:"BOOM",colors:[color,color],splitIndex:0,
            deferExitRotationCapture:true,sourcePlan:plan,random:{draws+=1;return 0.8})
        let labels=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
        XCTAssertEqual(labels.count,4);XCTAssertEqual(draws,18)
        for (index,label) in labels.enumerated() {
            XCTAssertEqual(label.font.pointSize,CGFloat(plan.sizes[index]),accuracy:0.0001)
            XCTAssertEqual(label.textColor.cgColor.alpha,CGFloat(plan.opacities[index]),accuracy:0.0001)
        }
        XCTAssertTrue(field.captureSourceExitRotations(random:{draws+=1;return 0.2},current:{true}))
        XCTAssertEqual(draws,22)
        XCTAssertTrue(field.captureSourceExitRotations(random:{draws+=1;return 0.2},current:{true}));XCTAssertEqual(draws,22)
    }
    func testGenuineCtorThenDeferredBounceExitAndVisibleSequenceBeforeParentTail()throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),textures=NativeBoardTextures(root:root)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var draws=0,state:UInt32=7,glyphs:NativeSplashGlyphField?
        let random:()->Double={draws+=1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296}
        let construction=try XCTUnwrap(NativeTntFinale.captureSourceConstruction(textures:textures,current:{true},random:random,prepareGlyphs:{
            guard let plan=NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:random,current:{true}) else{return false}
            glyphs=NativeSplashGlyphField(artwork:JimiV9Artwork(resourceRoot:root),text:"BOOM",colors:[.orange],splitIndex:0,
                deferExitRotationCapture:true,sourcePlan:plan)
            return true
        }))
        XCTAssertEqual(draws,282,"Actual DOM glyph18, authored sixteen-die plans240, per-frame initial24; no eager bounce/exit")
        let owner=NativeTntFinale(textures:textures,fontName:"Helvetica",viewport:.init(width:390,height:844),showsTitle:false,
            sourceConstruction:construction,sourceRandom:random,random:{XCTFail("Source cannot draw hidden Raw title or fallback entropy");return 0.5})
        XCTAssertEqual(draws,282)
        var frameSix=0,sequence=0,complete=0
        owner.onGlyphClock={time,finished in
            guard !finished,let glyphs else{return}
            if time>=glyphs.exitStart {XCTAssertTrue(glyphs.captureSourceExitRotations(random:random,current:{true}))}
            glyphs.paint(seconds:time)
        }
        XCTAssertTrue(owner.playSource(service:service,current:{true},frameSix:{frameSix+=1},sequenceComplete:{sequence+=1},completion:{complete+=1}))
        for wall in stride(from:10.0,through:400.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(draws,282);XCTAssertEqual(frameSix,0)
        service.deliver(wallMilliseconds:415);XCTAssertEqual(draws,284)
        for wall in stride(from:420.0,through:520.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,1);XCTAssertEqual(sequence,0)
        for wall in stride(from:530.0,through:1000.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(draws,310)
        for wall in stride(from:1010.0,through:1760.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(sequence,1);XCTAssertEqual(complete,0,"Real visible sequence cannot wait for independent4.2s debris tail")
        for wall in stride(from:1770.0,through:4300.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(draws,310);XCTAssertEqual(sequence,1);XCTAssertEqual(complete,1)
    }
    func testConstructorResourceRetirementStopsAfterRealDrawWithoutAllocatingFinale() {
        let textures=NativeBoardTextures(root:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"))
        var draws=0
        let construction=NativeTntFinale.captureSourceConstruction(textures:textures,current:{true},random:{draws+=1;textures.dispose();return 0.2},prepareGlyphs:{true})
        XCTAssertNil(construction);XCTAssertEqual(draws,1)
    }
}
