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
    func testSequentialContactsHaveSourceMinimumGapAndCompleteAfterLastGunExit() {
        let presentation = owner(); XCTAssertTrue(presentation.assetReady)
        var contacts: [Int] = [],times: [Double] = [],finished: [Bool] = [],complete = 0,current = 0.0
        presentation.onImpact = { index,id in XCTAssertEqual(id,"target-\(index)"); contacts.append(index); times.append(current); return true }
        presentation.onImpactsComplete = { complete += 1 }
        presentation.onFinished = { finished.append($0) }
        presentation.layoutIfNeeded()
        for frame in 0...900 { current = Double(frame)/60; presentation.paint(seconds:current) }
        XCTAssertEqual(contacts,[0,1,2,3]); XCTAssertEqual(complete,1); XCTAssertEqual(finished,[true])
        XCTAssertTrue(times[0] >= 0.621+0.3+0.095)
        for pair in zip(times.dropFirst(),times) { XCTAssertGreaterThanOrEqual(pair.0-pair.1,0.3+0.325+0.3+0.095-0.154) }
        XCTAssertNil(presentation.onImpact); XCTAssertNil(presentation.onImpactsComplete); XCTAssertFalse(presentation.hasActiveClock)
        presentation.dispose(); XCTAssertEqual(finished,[true])
    }
    func testLargeFrameStallCannotBatchShotsOrSkipFrameSixPaint() {
        let presentation = owner(); var contacts: [Int] = [],beams: [Int] = []
        presentation.onImpact = { index,_ in contacts.append(index); return true }
        presentation.onCue = { name,index in if name == "laser-gun-beam" { beams.append(index) } }
        presentation.layoutIfNeeded()
        for t in [0.0,0.016,0.032,10,10.016,10.032,20] { presentation.paint(seconds:t) }
        XCTAssertTrue(beams.isEmpty); XCTAssertTrue(contacts.isEmpty)
        presentation.paint(seconds:20.016); XCTAssertEqual(beams,[0]); XCTAssertTrue(contacts.isEmpty)
        presentation.paint(seconds:30); XCTAssertEqual(contacts,[0])
        presentation.paint(seconds:100); XCTAssertEqual(contacts,[0]); XCTAssertEqual(beams,[0])
        presentation.dispose()
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
