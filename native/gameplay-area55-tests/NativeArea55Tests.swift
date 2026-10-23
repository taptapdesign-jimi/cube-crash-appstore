import XCTest
import UIKit
@testable import Stack_to_Six

private struct Area55OracleEnvelope: Decodable {
    struct Exit: Decodable { let width,height,lane,seconds,x,y,rotation,scaleX,scaleY: Double }
    struct Laser: Decodable { let width,height,x,y,scale,stageX,offscreen: Double; let left: Bool }
    struct Scatter: Decodable { let id: String; let roll,x,y,driftX,startRotation: Double; let curveX: [Double] }
    struct Pull: Decodable { let progress,value: Double }
    struct Timing: Decodable { let id: String; let travelStartAt,travelSeconds,arrivalAt: Double }
    let exit: [Exit],laser: [Laser],scatter: [Scatter],pull: [Pull],timing: [Timing]
}

@MainActor
final class NativeArea55Tests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testGeometryMatches217ActualTypeScriptSourceOracleCases() throws {
        let oracle = try JSONDecoder().decode(Area55OracleEnvelope.self,from: NativeArea55Oracle.data)
        XCTAssertEqual(oracle.exit.count+oracle.laser.count+oracle.scatter.count+oracle.pull.count+oracle.timing.count,217)
        for row in oracle.exit {
            let pose = NativeArea55Motion.exitPose(seconds: row.seconds,lane: row.lane,viewport: CGSize(width: row.width,height: row.height))
            XCTAssertEqual(pose.x,row.x,accuracy: 1e-9); XCTAssertEqual(pose.y,row.y,accuracy: 1e-9)
            XCTAssertEqual(pose.rotation,row.rotation,accuracy: 1e-9); XCTAssertEqual(pose.sx,row.scaleX,accuracy: 1e-9); XCTAssertEqual(pose.sy,row.scaleY,accuracy: 1e-9)
        }
        for row in oracle.laser {
            let layout = NativeArea55Motion.laserLayout(origin: CGPoint(x: row.x,y: row.y),viewport: CGSize(width: row.width,height: row.height),scale: row.scale)
            XCTAssertEqual(layout.left,row.left); XCTAssertEqual(layout.x,row.stageX,accuracy: 1e-9); XCTAssertEqual(layout.offscreen,row.offscreen,accuracy: 1e-9)
        }
        for row in oracle.scatter {
            let plan = try XCTUnwrap(NativeArea55Motion.debris.first { $0.id == row.id }),scatter = NativeArea55Motion.scatter(plan,random: { row.roll })
            XCTAssertEqual(scatter.x,row.x,accuracy: 1e-9); XCTAssertEqual(scatter.y,row.y,accuracy: 1e-9)
            XCTAssertEqual(scatter.c1,row.curveX[0],accuracy: 1e-9); XCTAssertEqual(scatter.c2,row.curveX[1],accuracy: 1e-9)
            XCTAssertEqual(scatter.drift,row.driftX,accuracy: 1e-9); XCTAssertEqual(scatter.rotation,row.startRotation,accuracy: 1e-9)
        }
        for row in oracle.pull { XCTAssertEqual(NativeArea55Motion.magnetic(row.progress),row.value,accuracy: 1e-12) }
        for row in oracle.timing {
            let plan = try XCTUnwrap(NativeArea55Motion.debris.first { $0.id == row.id })
            XCTAssertEqual(plan.delay,row.travelStartAt,accuracy: 1e-12); XCTAssertEqual(1.95+plan.order*0.04,row.travelSeconds,accuracy: 1e-12); XCTAssertEqual(plan.arrival,row.arrivalAt,accuracy: 1e-12)
        }
    }
    func testSourceAssetsAndExactBoundedDurations() {
        let laser = NativeLaserGunFinalePresentation(resourceRoot: root,viewport: .init(width: 390,height: 844),origin: .init(x: 150,y: 410),generation: 10,random: { 0.5 })
        let ship = NativeSpaceshipFinalePresentation(resourceRoot: root,viewport: .init(width: 390,height: 844),origin: .init(x: 150,y: 410),generation: 10,random: { 0.5 })
        XCTAssertTrue(laser.assetReady); XCTAssertTrue(ship.assetReady)
        XCTAssertEqual(laser.duration,0.7382,accuracy: 1e-12); XCTAssertEqual(ship.duration,3.8)
        let field=ship.subviews.compactMap{$0 as? NativeSplashGlyphField}.first
        let letters=field?.subviews.first?.subviews.compactMap{$0 as? UILabel} ?? []
        XCTAssertEqual(letters.compactMap(\.text).joined(),"WOOMBUU")
        XCTAssertTrue(letters.allSatisfy{$0.textColor.withAlphaComponent(1)==UIColor.white && $0.textColor.cgColor.alpha>=0.8 && $0.subviews.count==4})
        XCTAssertEqual(NativeArea55Motion.debris.count,25)
        XCTAssertEqual(NativeArea55Motion.debris.map(\.arrival).max()!+0.01,2.62,accuracy: 1e-12)
        XCTAssertEqual(NativeArea55Motion.additionalSideDebris.count,21)
        XCTAssertTrue(NativeArea55Motion.additionalSideDebris.allSatisfy{$0.value==0 && (24...76).contains($0.x) && $0.y>=62 && $0.arrival<2.62})
        for roll in [0.0,0.5,0.999] {
            let starts=NativeArea55Motion.additionalSideDebris.map{NativeArea55Motion.scatter($0,random:{roll})}
            XCTAssertTrue(starts.allSatisfy{$0.x>=8 && $0.x<=92 && $0.y>=62})
            XCTAssertTrue(starts.allSatisfy{$0.x<30 || $0.x>70})
            XCTAssertGreaterThan(starts.filter{$0.y<100}.count,10)
            XCTAssertGreaterThan(Set(starts.map(\.x)).count,4)
        }
        let extras=NativeArea55Motion.additionalSideDebris
        XCTAssertEqual(extras.filter{$0.spin != 0}.count,9)
        XCTAssertGreaterThan(Set(extras.map(\.size)).count,10)
        XCTAssertTrue(extras.contains{$0.size<45})
        laser.dispose(); ship.dispose()
    }
    func testSpaceshipRetiresBeamAndDebrisAndRevivesSameOwnersOnBackwardSample() {
        let ship = NativeSpaceshipFinalePresentation(resourceRoot: root,viewport: .init(width: 390,height: 844),origin: .zero,generation: 1,random: { 0.5 })
        ship.layoutIfNeeded(); ship.paint(seconds: 0.5)
        let beam = ship.subviews.first { $0.layer.zPosition == 2 }
        XCTAssertNotNil(beam); XCTAssertEqual(ship.subviews.filter { $0.layer.zPosition < 5 && $0 !== beam }.count,46)
        ship.paint(seconds: 3); XCTAssertNil(beam?.superview)
        let hidden = ship.subviews.filter { $0.layer.zPosition < 5 }
        XCTAssertTrue(hidden.allSatisfy(\.isHidden)); let count = hidden.count
        ship.paint(seconds: 3.5); XCTAssertEqual(ship.subviews.filter { $0.layer.zPosition < 5 }.count,count)
        ship.paint(seconds: 0.5); XCTAssertTrue(beam?.superview === ship)
        XCTAssertTrue(hidden.allSatisfy{!$0.isHidden}); ship.dispose()
    }
    func testSideIntakeSharesOriginalPullAndStartsOffscreenWithoutFade() throws {
        let ship=NativeSpaceshipFinalePresentation(resourceRoot:root,viewport:.init(width:390,height:844),origin:.zero,generation:1,random:{0.5})
        defer{ship.dispose()};ship.layoutIfNeeded()
        ship.paint(seconds:0)
        let movers=ship.subviews.filter{$0.layer.zPosition<5 && $0.layer.zPosition != 2}
        let extras=Array(movers.suffix(21))
        XCTAssertEqual(extras.count,21);XCTAssertTrue(extras.allSatisfy{!$0.isHidden})
        for (i,plan) in NativeArea55Motion.additionalSideDebris.enumerated() {
            XCTAssertEqual(plan.delay,0)
            XCTAssertEqual(plan.travelDuration,1.95+plan.order*0.04)
            ship.paint(seconds:0)
            let mover=extras[i],visual=try XCTUnwrap(mover.subviews.first)
            XCTAssertFalse(mover.isHidden);XCTAssertEqual(mover.alpha,1)
            let rect=visual.convert(visual.bounds,to:ship)
            XCTAssertTrue(rect.maxX<0 || rect.minX>390)
            let start=mover.center.x
            ship.paint(seconds:0.001)
            XCTAssertLessThan(abs(mover.center.x-start),2)
            ship.paint(seconds:plan.travelDuration*0.65-0.25)
            XCTAssertTrue((0...390).contains(mover.center.x));XCTAssertEqual(mover.alpha,1)
        }
        ship.paint(seconds:2.62);XCTAssertTrue(extras.allSatisfy(\.isHidden))
        ship.paint(seconds:0);XCTAssertTrue(extras.allSatisfy{!$0.isHidden})
    }
    func testSemanticCuesAndCancellationReceiptsAreExactlyOnce() {
        let ship = NativeSpaceshipFinalePresentation(resourceRoot: root,viewport: .init(width: 390,height: 844),origin: .zero,generation: 4,random: { 0.5 })
        var cues: [String] = [],receipts: [Bool] = []
        ship.onCue = { name,_ in cues.append(name) }; ship.onFinished = { receipts.append($0) }
        ship.layoutIfNeeded(); ship.paint(seconds: 0); ship.paint(seconds: 0.4); ship.paint(seconds: 3); ship.paint(seconds: 3.5); ship.paint(seconds: 0.4)
        XCTAssertEqual(cues,["spaceship-start","spaceship-beam","spaceship-exit"])
        ship.dispose(); ship.dispose(); XCTAssertEqual(receipts,[false]); XCTAssertNil(ship.onCue)
    }
    func testAddedSideDebrisBorrowPreparedImagesRenderAndRelease()async throws {
        let resources=NativeSelectedUIKitFinaleArtworkOwner(root:root,generation:7,current:{true})
        defer{resources.dispose()}
        resources.prepare(variant:"spaceship")
        for _ in 0..<600 {
            if resources.readyFamilies.contains("spaceship"){break}
            try await Task.sleep(for:.milliseconds(20))
        }
        XCTAssertTrue(resources.readyFamilies.contains("spaceship"))
        weak var released:NativeSpaceshipFinalePresentation?
        try autoreleasepool {
            var owner:NativeSpaceshipFinalePresentation?=NativeSpaceshipFinalePresentation(resourceRoot:root,
                viewport:CGSize(width:390,height:844),origin:CGPoint(x:195,y:422),generation:7,
                preparedArtwork:resources.artwork,random:{0.5})
            released=owner
            let ship=try XCTUnwrap(owner)
            XCTAssertTrue(ship.assetReady);XCTAssertEqual(resources.artwork.imageFileLoadCount,0)
            ship.layoutIfNeeded();ship.paint(seconds:1.1)
            let shot=UIGraphicsImageRenderer(bounds:ship.bounds).image {context in
                UIColor(red:0.97,green:0.93,blue:0.87,alpha:1).setFill();context.fill(ship.bounds)
                ship.layer.render(in:context.cgContext)
            }
            let path=FileManager.default.temporaryDirectory.appendingPathComponent("woombuu-side-1.1.png")
            try shot.pngData()?.write(to:path);print("[WoombuuSnapshot] \(path.path)")
            ship.dispose();owner=nil
        }
        XCTAssertNil(released)
    }
    func testLaserFinalHasOnlyOneGunAndGlyphFieldWithNoInventedTargetsOrBeam() {
        let laser = NativeLaserGunFinalePresentation(resourceRoot: root,viewport: .init(width: 390,height: 844),origin: .init(x: 195,y: 410),generation: 2,random: { 0.5 })
        laser.layoutIfNeeded(); XCTAssertEqual(laser.subviews.count,2)
        let gun = laser.subviews.first { $0.layer.zPosition == 1 }!
        laser.paint(seconds: 0); XCTAssertTrue(gun.isHidden)
        laser.paint(seconds: 0.3182); XCTAssertFalse(gun.isHidden); XCTAssertEqual(gun.alpha,1,accuracy: 1e-5)
        laser.paint(seconds: 0.7382); XCTAssertTrue(gun.isHidden); laser.dispose()
    }
}
