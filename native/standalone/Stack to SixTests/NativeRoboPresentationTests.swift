import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeRoboPresentationTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    func testThirtyNeonPlansAndLiveGravityMatchExecutedOriginalGSAP() throws {
        var rng:UInt32=17,draws=0
        func roll()->Double {draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296}
        let size=CGSize(width:390,height:844),plan=NativeRoboFinaleMotion.make(viewport:size,aspects:[180.0/184,180.0/152,180.0/176,180.0/204],random:roll)
        XCTAssertEqual(draws,3472);XCTAssertEqual(plan.neons.count,30)
        XCTAssertEqual(plan.neons.filter {$0.asset==0}.count,5)
        XCTAssertEqual(Set(plan.neons.map(\.exitOrder)),Set(0..<30))
        let first=try XCTUnwrap(plan.neons.first)
        XCTAssertEqual(first.asset,2);XCTAssertEqual(first.exitOrder,19)
        XCTAssertEqual(first.origin.x,69.6147907683067,accuracy:1e-9);XCTAssertEqual(first.origin.y,615.4033784940802,accuracy:1e-9)
        var runtime=NativeRoboFinaleMotion.Runtime(plan,viewport:size),exitFrame:Int?
        let gold:[Int:[Double]]=[45:[74.19887057722748,610.2915073057295,7.1854598685664275,1.0345236925224381,0.9599659471543384],60:[62.26583563045604,620.1012253297511,9.680253793566427,0.9421796204033467,0.814854358025682],90:[63.623712212502014,618.4078325841785,14.669842318566428,1.023150243057066,0.9420934482713983],103:[81.84190691196791,613.0313869312707,16.831997593566427,1.027256837091808,0.948546644157314],126:[104.75408204446825,650.70904433903,21.492575375437415,1.1017735962426658,0.9990535142253122]]
        for index in 0...150 {
            let time=Double(index)/60,poses=runtime.sample(seconds:time,viewport:size,random:roll)
            if exitFrame==nil,time>=2.006 {exitFrame=NativeRoboFinaleMotion.selectExitFrame(current:NativeRoboFinaleMotion.frameIndex(seconds:time),previous:nil,random:roll())}
            if let expected=gold[index],let p=poses.first {for (actual,wanted) in zip([p.x,p.y,p.rotation,p.scale,p.alpha],expected) {XCTAssertEqual(actual,wanted,accuracy:0.002)}}
        }
        XCTAssertEqual(draws,3533);XCTAssertEqual(exitFrame,6)
    }
    func testHeadUsesSourceSmearsAndNonRepeatingExitFrame() {
        let size=CGSize(width:390,height:844),drift = -20.58749087154865
        let pose=NativeRoboFinaleMotion.head(viewport:size,drift:drift,seconds:0.5,exitFrame:nil)
        XCTAssertEqual(pose.x,192.529501,accuracy:0.000001);XCTAssertEqual(pose.y,560.8,accuracy:0.000001);XCTAssertEqual(pose.rotation,-0.05,accuracy:0.000001)
        XCTAssertEqual(NativeRoboFinaleMotion.frameIndex(seconds:0.723),0);XCTAssertEqual(NativeRoboFinaleMotion.frameIndex(seconds:0.724),1)
        for previous in 0..<12 {for value in [0.0,0.5,1.0] {let frame=NativeRoboFinaleMotion.selectExitFrame(current:10,previous:previous,random:value);XCTAssertNotEqual(frame,10);XCTAssertNotEqual(frame,previous)}}
    }
    func testTwelveOriginalHeadFramesAndThirtyNeonsFinishOnceAfterActualMotion() throws {
        let owner=NativeRoboFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),previousExitFrame:0,random:{0.5})
        XCTAssertTrue(owner.assetReady)
        let images=owner.subviews.compactMap {$0 as? UIImageView},head=try XCTUnwrap(images.first {$0.layer.zPosition==10000})
        XCTAssertEqual(images.count,31);XCTAssertTrue(images.allSatisfy {$0.image != nil || $0 === head})
        var receipts:[Bool]=[],frames:[Int]=[],haptics=0
        owner.onFinished={receipts.append($0)};owner.onExitFrameSelected={frames.append($0)};owner.onHaptic={_ in haptics+=1}
        for index in 0...152 {
            let time=Double(index)/60;owner.paint(seconds:time)
            if index==105 {XCTAssertEqual(head.bounds.height/head.bounds.width,294.0/256,accuracy:0.000001)}
        }
        XCTAssertEqual(receipts,[true]);XCTAssertEqual(frames.count,1);XCTAssertNotEqual(frames.first,0);XCTAssertNotEqual(frames.first,10)
        XCTAssertEqual(haptics,6);XCTAssertTrue(head.isHidden)
        owner.dispose();XCTAssertEqual(receipts,[true]);XCTAssertFalse(owner.hasActiveClock)
    }
    func testLateMotionStartKeepsReceiptUntilItsRealClockEndAndBackgroundDispose() {
        let owner=NativeRoboFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{0.5})
        var receipts:[Bool]=[];owner.onFinished={receipts.append($0)}
        owner.paint(seconds:0);owner.paint(seconds:1);owner.paint(seconds:1.72);owner.paint(seconds:2.51)
        XCTAssertTrue(receipts.isEmpty,"A delayed source750ms callback owns a full continuous motion timeline")
        owner.paint(seconds:2.68);XCTAssertEqual(receipts,[true]);owner.dispose()
        let suspended=NativeRoboFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844))
        var cancelled=0;suspended.onFinished={ok in XCTAssertFalse(ok);cancelled+=1};suspended.setSuspended(true);suspended.start()
        XCTAssertTrue(suspended.hasActiveClock);suspended.dispose();suspended.dispose();XCTAssertEqual(cancelled,1);XCTAssertFalse(suspended.hasActiveClock)
    }
    func testRoboDividerAndDeferredExitDrawsPreserveSourceGlyphOwnership() throws {
        var draws=0
        let field=NativeSplashGlyphField(artwork:JimiV9Artwork(resourceRoot:root),text:"BIBI - RIBI",colors:[.brown],splitIndex:0,deferExitRotationCapture:true,random:{draws+=1;return 0.5})
        XCTAssertEqual(draws,46)
        field.captureExitRotations(random:{draws+=1;return 0.5});XCTAssertEqual(draws,57)
        field.captureExitRotations(random:{draws+=1;return 0.5});XCTAssertEqual(draws,57)
        field.frame=CGRect(x:0,y:0,width:390,height:844);field.layoutIfNeeded()
        let labels=try XCTUnwrap(field.subviews.first).subviews.compactMap {$0 as? UILabel},divider=try XCTUnwrap(labels.firstIndex {$0.text=="-"})
        let prior=labels[divider-1],glyph=labels[divider],next=labels[divider+1]
        XCTAssertEqual(glyph.center.x-glyph.bounds.width/2-prior.center.x-prior.bounds.width/2,3,accuracy:0.000001)
        XCTAssertEqual(next.center.x-next.bounds.width/2-glyph.center.x-glyph.bounds.width/2,2.8,accuracy:0.000001)
    }
}
