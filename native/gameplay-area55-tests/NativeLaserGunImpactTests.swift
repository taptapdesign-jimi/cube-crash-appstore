import XCTest
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeLaserGunImpactTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    private func owner(_ count: Int = 4) -> NativeLaserGunImpactPresentation {
        NativeLaserGunImpactPresentation(resourceRoot:root,viewport:.init(width:390,height:844),targets:(0..<count).map{NativeLaserVisualTarget(tileID:"target-\($0)",point:.init(x:120+Double($0)*40,y:260+Double($0)*110),shooter:$0 % 2 == 0 ? .right : .left)},generation:9,random:{0.5})
    }
    func testRestoredZapCaptionUsesImpactClockAndWhiteGlowLettersRender() throws {
        let p=owner(1);defer{p.dispose()};p.layoutIfNeeded()
        let field=try XCTUnwrap(p.subviews.compactMap{$0 as? NativeSplashGlyphField}.first)
        let letters=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
        XCTAssertEqual(letters.compactMap(\.text).joined(),"ZAP - ZAP")
        p.paint(seconds:0);p.paint(seconds:0.016);p.paint(seconds:0.032)
        XCTAssertTrue(letters.allSatisfy{$0.alpha==0})
        for f in 3...72 {p.paint(seconds:Double(f)/60)}
        XCTAssertTrue(letters.contains{$0.alpha>0})
        let canvas=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        canvas.backgroundColor=UIColor(red:0.97,green:0.94,blue:0.89,alpha:1)
        canvas.addSubview(p)
        let art=JimiV9Artwork(resourceRoot:root)
        for (i,text) in ["BLOOOB!","CLAAANK!"].enumerated() {
            let g=NativeSplashGlyphField.clankStyle(artwork:art,text:text,random:{0.5})
            g.frame=CGRect(x:0,y:CGFloat(i)*230,width:390,height:230)
            canvas.addSubview(g);g.layoutIfNeeded();g.paint(seconds:0.9)
            let labels=try XCTUnwrap(g.subviews.first).subviews.compactMap{$0 as? UILabel}
            XCTAssertTrue(labels.allSatisfy{$0.textColor.withAlphaComponent(1)==UIColor.white && $0.textColor.cgColor.alpha<1 && $0.subviews.count==4})
        }
        let png=UIGraphicsImageRenderer(bounds:canvas.bounds).image{canvas.layer.render(in:$0.cgContext)}.pngData()
        try XCTUnwrap(png).write(to:FileManager.default.temporaryDirectory.appendingPathComponent("caption-white-zap.png"))
        p.paint(seconds:10);XCTAssertFalse(p.hasActiveClock)
    }
    func testSelectedLaserPreparesGlowBeforeContactAndReusesItWithoutFileReads() async throws {
        let selected=NativeSelectedUIKitFinaleArtworkOwner(root:root,generation:9,current:{true})
        defer{selected.dispose()}
        selected.prepare(variant:"laser-gun")
        let deadline=Date().addingTimeInterval(10)
        while selected.laserResources==nil,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        let resources=try XCTUnwrap(selected.laserResources)
        XCTAssertTrue(resources.assetReady);XCTAssertTrue(selected.readyFamilies.contains("laser-gun"))
        let coldBegin=CACurrentMediaTime()
        let legacy=NativeLaserGunResources(resourceRoot:root,preparedArtwork:selected.artwork)
        print("[LaserPreparation] former synchronous glow ms=\((CACurrentMediaTime()-coldBegin)*1000)")
        XCTAssertEqual(resources.leftBeam?.pngData(),legacy.leftBeam?.pngData())
        XCTAssertEqual(resources.rightBeam?.pngData(),legacy.rightBeam?.pngData())
        let reads=selected.artwork.imageFileLoadCount,prepared=selected.artwork.preparedImageCount
        XCTAssertEqual(reads,0);XCTAssertEqual(prepared,8)
        let begin=CACurrentMediaTime()
        for _ in 0..<5 {
            selected.prepare(variant:"laser-gun")
            XCTAssertTrue(selected.laserResources === resources)
            let p=NativeLaserGunImpactPresentation(resources:resources,viewport:.init(width:390,height:844),
                targets:[.init(tileID:"target",point:.init(x:120,y:260),shooter:.right)],generation:9)
            XCTAssertTrue(p.assetReady);p.dispose()
        }
        print("[LaserPreparation] five warm constructors ms=\((CACurrentMediaTime()-begin)*1000)")
        XCTAssertEqual(selected.artwork.imageFileLoadCount,reads)
        XCTAssertEqual(selected.artwork.preparedImageCount,prepared)
        selected.retain(variants:[]);XCTAssertNil(selected.laserResources)
    }
    func testSelectedLaserSuspensionRetirementAndWeakRelease() async throws {
        var selected:NativeSelectedUIKitFinaleArtworkOwner?=NativeSelectedUIKitFinaleArtworkOwner(root:root,generation:9,current:{true})
        weak var weakOwner=selected
        selected?.prepare(variant:"laser-gun");selected?.setSuspended(true)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertNil(selected?.laserResources)
        selected?.setSuspended(false);selected?.prepare(variant:"laser-gun")
        let deadline=Date().addingTimeInterval(10)
        while selected?.laserResources==nil,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertNotNil(selected?.laserResources)
        selected?.retain(variants:[]);selected?.prepare(variant:"laser-gun")
        selected?.dispose();selected?.dispose();selected=nil
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertNil(weakOwner)
    }
    func testSequentialContactsHaveSourceMinimumGapAndCompleteAfterLastGunExit() {
        let presentation = owner(); XCTAssertTrue(presentation.assetReady)
        var contacts: [Int] = [],times: [Double] = [],finished: [Bool] = [],complete = 0,current = 0.0
        presentation.onImpact = { index,id in XCTAssertEqual(id,"target-\(index)"); contacts.append(index); times.append(current); return true }
        presentation.onImpactsComplete = { complete += 1 }
        presentation.onFinished = { finished.append($0) }
        presentation.layoutIfNeeded()
        for frame in 0...900 { current = Double(frame)/60; presentation.paint(seconds:current) }
        XCTAssertEqual(contacts,[0,1,2,3]); XCTAssertEqual(complete,1); XCTAssertEqual(finished,[true])
        XCTAssertGreaterThan(times[0],0.15+0.095);XCTAssertLessThan(times[0],0.45)
        for pair in zip(times.dropFirst(),times) { XCTAssertGreaterThanOrEqual(pair.0-pair.1,0.3+0.325+0.3+0.095-0.154) }
        XCTAssertNil(presentation.onImpact); XCTAssertNil(presentation.onImpactsComplete); XCTAssertFalse(presentation.hasActiveClock)
        presentation.dispose(); XCTAssertEqual(finished,[true])
    }
    func testLargeFrameStallCannotBatchShotsOrSkipFrameSixPaint() {
        let presentation = owner(); var contacts: [Int] = [],beams: [Int] = []
        presentation.onImpact = { index,_ in contacts.append(index); return true }
        presentation.onCue = { name,index in if name == "laser-gun-beam" { beams.append(index) } }
        presentation.layoutIfNeeded()
        for t in [0.0,0.016,0.032,10] { presentation.paint(seconds:t) }
        XCTAssertTrue(beams.isEmpty); XCTAssertTrue(contacts.isEmpty)
        presentation.paint(seconds:10.016); XCTAssertEqual(beams,[0]); XCTAssertTrue(contacts.isEmpty)
        presentation.paint(seconds:20); XCTAssertEqual(contacts,[0])
        presentation.paint(seconds:100); XCTAssertEqual(contacts,[0]); XCTAssertEqual(beams,[0])
        presentation.dispose()
    }
    func testFirstBeamLeavesDuringEntryAndTracksActualMovingMuzzleAtBothFrameRates() throws {
        let resources=NativeLaserGunResources(resourceRoot:root)
        for fps in [60,120] {for side in [NativeLaserShooter.left,.right] {
            let target=CGPoint(x:side == .left ? 280:110,y:360)
            let p=NativeLaserGunImpactPresentation(resources:resources,viewport:.init(width:390,height:844),
                targets:[.init(tileID:"target",point:target,shooter:side)],generation:9,random:{0.5})
            defer{p.dispose()};p.layoutIfNeeded()
            var prepareAt:Double?,beamAt:Double?,now=0.0
            p.onCue={name,_ in
                if name=="laser-gun-prepare" {prepareAt=now}
                if name=="laser-gun-beam" {beamAt=now}
            }
            for frame in 0...fps/3 {
                now=Double(frame)/Double(fps);p.paint(seconds:now)
                guard beamAt != nil else{continue}
                let gun=try XCTUnwrap(p.subviews.first{$0.layer.zPosition == (side == .right ? 5:4)})
                let aim=gun.subviews[0].subviews[0],beam=try XCTUnwrap(p.subviews.first{$0.layer.zPosition==3})
                let muzzle=aim.convert(CGPoint(x:aim.bounds.width*0.24+0.5,y:aim.bounds.height*0.32+0.5),to:p)
                XCTAssertEqual(beam.layer.position.x,muzzle.x,accuracy:0.00001)
                XCTAssertEqual(beam.layer.position.y,muzzle.y,accuracy:0.00001)
                let angle=atan2(target.y-muzzle.y,target.x-muzzle.x)
                XCTAssertEqual(atan2(beam.transform.b,beam.transform.a),angle,accuracy:0.00001)
                XCTAssertFalse(beam.isHidden);XCTAssertFalse(gun.isHidden)
                break
            }
            let lead=try XCTUnwrap(beamAt)-XCTUnwrap(prepareAt)
            XCTAssertGreaterThanOrEqual(lead,0.325*0.9);XCTAssertLessThan(lead,0.325*0.9+1/Double(fps)+0.00001)
            XCTAssertLessThan(lead,0.325,"Beam must leave before the entry animation finishes")
        }}
    }
    func testAnalyticBarrelIsActualUIKitMarkerAndAimsAtImmutableTarget() {
        let presentation = owner(1); presentation.layoutIfNeeded()
        for t in [0.0,0.016,0.032,0.357,0.373,0.389,0.7] { presentation.paint(seconds:t) }
        let gun = presentation.subviews.first{$0.layer.zPosition == 5}!,aim = gun.subviews[0].subviews[0]
        let actual = aim.convert(CGPoint(x:aim.bounds.width*0.24+0.5,y:aim.bounds.height*0.32+0.5),to:presentation)
        let beam = presentation.subviews.first{$0.layer.zPosition == 3}!
        XCTAssertEqual(actual.x,beam.layer.position.x,accuracy:0.00001); XCTAssertEqual(actual.y,beam.layer.position.y,accuracy:0.00001)
        let pose = NativeLaserGunGeometry.solve(side:.right,target:.init(x:120,y:260),viewport:.init(width:390,height:844),scale:0.875,nominalY:844*0.63)
        let axis = NativeLaserGunGeometry.marker(.init(x:0.72,y:0.58),side:.right,center:pose.center,width:pose.width,scale:pose.scale,aim:pose.aim)
        let dx = Double(pose.barrel.x-axis.x),dy = Double(pose.barrel.y-axis.y)
        XCTAssertLessThanOrEqual(abs(dx*(260-Double(pose.barrel.y))-dy*(120-Double(pose.barrel.x)))/hypot(dx,dy),0.05)
        XCTAssertGreaterThanOrEqual(hypot(Double(pose.barrel.x)-120,Double(pose.barrel.y)-260),150-0.1)
        presentation.dispose()
    }
    func testRejectedContactDisposesOnceWithoutAdvancingLaterReservedIDs() {
        let presentation = owner(); var contacts = 0,finished: [Bool] = []
        presentation.onImpact = { _,_ in contacts += 1; return false }; presentation.onFinished = { finished.append($0) }
        presentation.layoutIfNeeded()
        for frame in 0...180 { presentation.paint(seconds:Double(frame)/60); if !finished.isEmpty { break } }
        XCTAssertEqual(contacts,1); XCTAssertEqual(finished,[false]); XCTAssertNil(presentation.onImpact)
        presentation.dispose(); XCTAssertEqual(finished,[false])
    }
}
