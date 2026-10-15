import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeArea55BeamPulseTests:XCTestCase {
    func testOriginalArea55ArtworkHasLiveBeamPulsesInEveryUnit() async throws {
        XCTAssertFalse(UIAccessibility.isReduceMotionEnabled)
        let provider=try NativeWorldLayouts()
        let raw=try provider.snapshot(world:3,width:390,height:844,generation:1,revision:0,progression:NativeProgressionState())
        let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        let paper=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        paper.frame=controller.view.bounds;controller.view.addSubview(paper)
        world.frame=controller.view.bounds;controller.view.addSubview(world);world.layoutIfNeeded()
        defer{world.cleanup();window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}
        let prepared=expectation(description:"original Area55 artwork prepared")
        world.prepare{prepared.fulfill()};await fulfillment(of:[prepared],timeout:10)
        let entered=expectation(description:"original Area55 entered")
        world.enter{entered.fulfill()};await fulfillment(of:[entered],timeout:10);world.finishPresentationAdmission()
        for unit in world.snapshot.units {
            let part=try XCTUnwrap(unit.parts.first{$0.role == "beam"})
            let center=unit.frame.minY+part.frame.midY
            world.scrollView.contentOffset=CGPoint(x:0,y:max(0,min(world.scrollView.contentSize.height-844,center-422)))
            world.scrollViewDidScroll(world.scrollView)
            let deadline=ProcessInfo.processInfo.systemUptime+5
            while find(world,"native.world.part.\(unit.boardID).beam")?.layer.animation(forKey:"world.idle.beam") == nil,ProcessInfo.processInfo.systemUptime<deadline {try await Task.sleep(for:.milliseconds(20))}
            let beam=try XCTUnwrap(find(world,"native.world.part.\(unit.boardID).beam"))
            XCTAssertNotNil(beam.layer.animation(forKey:"world.idle.beam"),"Original Unit \(unit.boardID)")
            XCTAssertFalse(beam.isHidden)
            if unit.boardID == 21 {
                var minimum:Float=1,maximum:Float=0
                var dim:XCTAttachment?,bright:XCTAttachment?
                for index in 0..<120 {
                    try await Task.sleep(for:.milliseconds(50))
                    let opacity=try XCTUnwrap(beam.layer.presentation()).opacity
                    if opacity<minimum {minimum=opacity;if index%4 == 0 {dim=XCTAttachment(image:UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:false)})}}
                    if opacity>maximum {maximum=opacity;if index%4 == 0 {bright=XCTAttachment(image:UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:false)})}}
                }
                print("ORIGINAL AREA55 BEAM opacity minimum=\(minimum) maximum=\(maximum) frame=\(beam.convert(beam.bounds,to:window))")
                XCTAssertLessThan(minimum,0.23);XCTAssertGreaterThan(maximum,0.96)
                XCTAssertGreaterThan(maximum-minimum,0.65,"Original artwork must render a substantial fade range")
                for (name,attachment) in [("Area55 beam dim",dim),("Area55 beam bright",bright)] {if let attachment {attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)}}
            }
        }
    }
    private func find(_ view:UIView,_ id:String)->UIView? {
        if view.accessibilityIdentifier == id {return view}
        return view.subviews.lazy.compactMap{self.find($0,id)}.first
    }
    func testMountedBeamUsesOnlyOpacityRetainsRhythmOnRefreshAndStopsWhenCovered() async throws {
        let provider=try NativeWorldLayouts()
        func fixture(_ revision:Int) throws -> [String:Any] {
            var value=try provider.snapshot(world:3,width:390,height:844,generation:1,revision:revision,progression:NativeProgressionState())
            var units=try XCTUnwrap(value["units"] as? [[String:Any]])
            for index in units.indices {
                let parts=try XCTUnwrap(units[index]["parts"] as? [[String:Any]])
                let profile=try XCTUnwrap(parts.first{$0["role"] as? String == "beam"}?["beamIdle"])
                units[index]["frame"]=["x":30,"y":200+index*240,"width":150,"height":200]
                units[index]["parts"]=[["asset":"assets/journey assets/robo/robo world/alien beam.png","role":"beam","x":20,"y":10,"width":54,"height":100,"rotation":0,"opacity":1,"zIndex":5,"beamIdle":profile]]
            }
            value["units"]=units;value["mainParts"]=[];value["ambientPlans"]=[]
            value["mainFrame"]=["x":0,"y":0,"width":390,"height":100];value["contentHeight"]=3000
            return value
        }
        let world=try XCTUnwrap(JimiNativeWorldView(snapshot:fixture(0),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let controller=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        world.frame=controller.view.bounds;controller.view.addSubview(world);world.layoutIfNeeded()
        defer{world.cleanup();window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}
        let prepared=expectation(description:"selected visible beam resources")
        world.prepare{prepared.fulfill()};await fulfillment(of:[prepared],timeout:5)
        let entered=expectation(description:"actual Unit enter")
        world.enter{entered.fulfill()};await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        let beam=try XCTUnwrap(find(world,"native.world.part.21.beam"))
        let animation=try XCTUnwrap(beam.layer.animation(forKey:"world.idle.beam") as? CAKeyframeAnimation)
        XCTAssertEqual(animation.keyPath,"opacity");XCTAssertEqual(animation.values as? [Double],[0.2,1.0,0.2])
        XCTAssertEqual(animation.keyTimes?.count,3);XCTAssertEqual(animation.timingFunctions?.count,2)
        XCTAssertEqual(beam.layer.animationKeys(),["world.idle.beam"])
        let bytes=world.decodedArtworkBytes
        world.reconcile(try fixture(1))
        XCTAssertTrue(find(world,"native.world.part.21.beam") === beam,"Refresh must not rebuild beam artwork")
        XCTAssertEqual(world.decodedArtworkBytes,bytes)
        let refreshed=try XCTUnwrap(beam.layer.animation(forKey:"world.idle.beam"))
        XCTAssertEqual(refreshed.duration,animation.duration);XCTAssertEqual(refreshed.timeOffset,animation.timeOffset)
        var samples:[Float]=[]
        for _ in 0..<150 {
            try await Task.sleep(for:.milliseconds(20))
            if let opacity=beam.layer.presentation()?.opacity {samples.append(opacity)}
        }
        XCTAssertGreaterThan(samples.count,120)
        XCTAssertGreaterThan((samples.max() ?? 0)-(samples.min() ?? 0),0.1,"Mounted beam must visibly pulse")
        XCTAssertTrue(samples.allSatisfy{$0>=0.199 && $0<=1.001})
        world.scrollView.contentOffset=CGPoint(x:0,y:600);world.scrollViewDidScroll(world.scrollView)
        XCTAssertNil(beam.layer.animation(forKey:"world.idle.beam"),"Offscreen beam owns no animation")
        world.scrollView.contentOffset = .zero;world.scrollViewDidScroll(world.scrollView)
        let deadline=ProcessInfo.processInfo.systemUptime+5
        while find(world,"native.world.part.21.beam")?.layer.animation(forKey:"world.idle.beam") == nil,ProcessInfo.processInfo.systemUptime<deadline {
            try await Task.sleep(for:.milliseconds(10))
        }
        let returnedBeam=try XCTUnwrap(find(world,"native.world.part.21.beam"))
        XCTAssertNotNil(returnedBeam.layer.animation(forKey:"world.idle.beam"))
        let returnedAnimation=try XCTUnwrap(returnedBeam.layer.animation(forKey:"world.idle.beam"))
        XCTAssertEqual(returnedAnimation.duration,animation.duration);XCTAssertEqual(returnedAnimation.timeOffset,animation.timeOffset)
        XCTAssertNil(beam.layer.animation(forKey:"world.idle.beam"),"Evicted beam's animation cannot survive on a retained old view")
        world.setActive(false);XCTAssertNil(returnedBeam.layer.animation(forKey:"world.idle.beam"))
        world.setActive(true);XCTAssertNotNil(returnedBeam.layer.animation(forKey:"world.idle.beam"))
        world.park();XCTAssertNil(returnedBeam.layer.animation(forKey:"world.idle.beam"))
        world.cleanup();world.cleanup();XCTAssertNil(returnedBeam.layer.animation(forKey:"world.idle.beam"))
    }
}
