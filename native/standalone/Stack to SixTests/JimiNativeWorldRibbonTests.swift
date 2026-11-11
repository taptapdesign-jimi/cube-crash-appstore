import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class JimiNativeWorldRibbonTests:XCTestCase {
    private func snapshot(new:Bool,revision:Int)->[String:Any] {
        ["version":1,"worldID":1,"requestID":"1","routeGeneration":1,"stateRevision":revision,"title":"Forest","contentHeight":1500,"mainFrame":["x":0,"y":100,"width":390,"height":300],"mainParts":[],"units":[["id":"board-2","boardID":2,"frame":["x":30,"y":400,"width":150,"height":200],"cardArt":"assets/colelctibles/Forest/common/02.png","locked":false,"interim":false,"newRibbon":new,"stars":0,"allowedActions":["openCard","play"],"stats":[],"parts":[["asset":"assets/colelctibles/Forest/common/02.png","role":"card","x":20,"y":10,"width":90,"height":133,"rotation":0,"opacity":1,"zIndex":2]]]]]
    }
    private func find(_ view:UIView,_ id:String)->UIView? {if view.accessibilityIdentifier == id {return view};return view.subviews.lazy.compactMap {self.find($0,id)}.first}
    func testLegacyNewFlagNeverPaintsJourneyOrInfoModalDecoration() async throws {
        let world=try XCTUnwrap(JimiNativeWorldView(snapshot:snapshot(new:true,revision:1),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root)))
        world.frame=CGRect(x:0,y:0,width:390,height:844)
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first)
        let previous=scene.windows.first{$0.isKeyWindow},window=UIWindow(windowScene:scene),controller=UIViewController()
        window.frame=world.frame;window.rootViewController=controller;controller.view.addSubview(world);window.makeKeyAndVisible();world.layoutIfNeeded()
        defer{world.cleanup();window.isHidden=true;window.rootViewController=nil;previous?.makeKey()}
        let prepared=expectation(description:"World resources prepared");world.prepare{prepared.fulfill()};await fulfillment(of:[prepared],timeout:10)
        let entered=expectation(description:"World visible");world.enter{entered.fulfill()};await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        XCTAssertNotNil(find(world,"native.world.part.2.card"))
        XCTAssertNil(find(world,"native.world.ribbon"))
        for revision in 2...3 {
            world.openCard(boardID:2)
            let modal=try XCTUnwrap(find(world,"native.world.card.modal") as? JimiNativeWorldCardView)
            XCTAssertNil(find(modal,"native.world.ribbon"))
            let deadline=Date().addingTimeInterval(5)
            while !modal.acceptsCardPan,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(modal.acceptsCardPan)
            let returned=expectation(description:"Original card returned");world.closeCard{returned.fulfill()};await fulfillment(of:[returned],timeout:5)
            world.reconcile(snapshot(new:revision==3,revision:revision))
            XCTAssertNil(find(world,"native.world.ribbon"))
        }
    }
}
