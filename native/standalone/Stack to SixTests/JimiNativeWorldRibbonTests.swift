import XCTest
import UIKit
import WebKit
@testable import Stack_to_Six

@MainActor
private final class RibbonActionSpy:JimiNativeWorldTransport {
    var actionReply:(@MainActor @Sendable(Result<Any,Error>)->Void)?
    func call(_ body:String,arguments:[String:Any],completion:@escaping @MainActor @Sendable(Result<Any,Error>)->Void) {
        if body.contains("requestNativeWorldAction") {actionReply = completion} else {completion(.success(true))}
    }
}
@MainActor
final class JimiNativeWorldRibbonTests:XCTestCase {
    private func snapshot(new:Bool,revision:Int)->[String:Any] {
        ["version":1,"worldID":1,"requestID":"1","routeGeneration":1,"stateRevision":revision,"title":"Forest","contentHeight":1500,"mainFrame":["x":0,"y":100,"width":390,"height":300],"mainParts":[],"units":[["id":"board-2","boardID":2,"frame":["x":30,"y":400,"width":150,"height":200],"cardArt":"assets/colelctibles/Forest/common/02.png","locked":false,"interim":false,"newRibbon":new,"stars":0,"allowedActions":["openCard","play"],"stats":[],"parts":[["asset":"assets/colelctibles/Forest/common/02.png","role":"card","x":20,"y":10,"width":90,"height":133,"rotation":0,"opacity":1,"zIndex":2]]]]]
    }
    private func find(_ view:UIView,_ id:String)->UIView? {if view.accessibilityIdentifier == id {return view};return view.subviews.lazy.compactMap {self.find($0,id)}.first}
    private func attach(_ view:UIView,name:String) {
        view.layoutIfNeeded()
        let image = UIGraphicsImageRenderer(size:view.bounds.size).image {context in view.layer.render(in:context.cgContext)}
        let attachment = XCTAttachment(image:image);attachment.name = name;attachment.lifetime = .keepAlways;add(attachment)
    }
    func testAcceptedViewedReceiptPreservesNewOnLargePhysicalFrontOnlyUntilReturn() async throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A",UIApplication.shared.applicationState == .active else {throw XCTSkip("Active isolated QA Simulator only")}
        let root = NativeTestResources.root,spy = RibbonActionSpy()
        let host = JimiNativeWorldHost(web:WKWebView(frame:.zero),artwork:JimiV9Artwork(resourceRoot:root),transport:spy)
        let container = UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        let controller=UIViewController(),window=UIWindow(frame:container.bounds)
        window.rootViewController=controller;controller.view.addSubview(container);window.makeKeyAndVisible()
        defer {host.dispose();window.isHidden=true}
        XCTAssertTrue(host.prepare(snapshot(new:true,revision:1),in:container))
        let world = try XCTUnwrap(host.worldView)
        let prepared = expectation(description:"Visible original ribbon prepared");world.prepare {prepared.fulfill()};await fulfillment(of:[prepared],timeout:5)
        let small = try XCTUnwrap(find(world,"native.world.ribbon"))
        XCTAssertEqual(small.frame.minY,0,accuracy:0.001)
        XCTAssertEqual(small.frame.maxX,try XCTUnwrap(small.superview).bounds.width,accuracy:0.001)
        let entered = expectation(description:"World enter completes");host.enter(terminal:false) {entered.fulfill()};await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        attach(container,name:"Original Forest 02 — small NEW top aligned")
        let unitButton = try XCTUnwrap(find(world,"native.world.card.2") as? UIButton)
        unitButton.sendActions(for:.touchUpInside)
        let reply = try XCTUnwrap(spy.actionReply)
        reply(.success(["accepted":true,"snapshot":snapshot(new:false,revision:2)]))
        let modal = try XCTUnwrap(find(world,"native.world.card.modal"))
        let large = try XCTUnwrap(find(modal,"native.world.ribbon"))
        let front = try XCTUnwrap(large.superview as? UIImageView)
        XCTAssertFalse(front.layer.isDoubleSided)
        XCTAssertEqual(large.frame.minY,0,accuracy:0.001)
        XCTAssertEqual(large.frame.maxX,front.bounds.width,accuracy:0.001)
        XCTAssertEqual(large.frame.width,front.bounds.width*0.5904,accuracy:0.001)
        XCTAssertEqual(world.snapshot.units[0].newRibbon,false,"Only canonical receipt owns viewed state")
        let faded=Date().addingTimeInterval(3)
        while small.superview != nil,Date()<faded {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(small.superview,"Canonical source clears its ribbon after the finite fade; accepted physical clone retains it")
        XCTAssertFalse((large.layer.animationKeys() ?? []).contains("world.shimmer"))
        try await Task.sleep(nanoseconds:650_000_000)
        let physicalCard = try XCTUnwrap(modal as? JimiNativeWorldCardView)
        physicalCard.tapToFlip();try await Task.sleep(nanoseconds:550_000_000)
        attach(front,name:"Original Forest 02 — actual large front artwork and NEW")
        let closed = expectation(description:"Return flip and card landing complete")
        XCTAssertTrue(large.superview === front,"NEW survives entry and the entire open presentation")
        world.closeCard {closed.fulfill()}
        XCTAssertTrue(large.superview === front,"Return keeps the ribbon attached through its fade")
        let fade=try XCTUnwrap(large.layer.animation(forKey:"ribbon.motion") as? CAAnimationGroup)
        XCTAssertEqual(fade.duration,0.24)
        XCTAssertEqual(large.layer.opacity,0)
        await fulfillment(of:[closed],timeout:5)
        XCTAssertNil(modal.superview);XCTAssertNil(find(world,"native.world.ribbon"))
        XCTAssertFalse(world.hasActiveCard)
    }
    func testNativeViewedProjectionClearsRetainedWorldAndModalReopen() async throws {
        var viewed=false
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{[self] _,_,generation in
            var value=snapshot(new:!viewed,revision:viewed ? 2:1)
            value["routeGeneration"]=generation
            return value
        },markViewed:{_ in viewed=true},makeGameplay:{_,_ in UIViewController()},flush:{})
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true}
        try await Task.sleep(for:.seconds(1));app.navigate(.hub)
        try await Task.sleep(for:.seconds(1.6));app.navigate(.world(1))
        let deadline=Date().addingTimeInterval(8)
        while app.world?.isReadyForInput != true,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(app.world?.isReadyForInput == true)
        let button=try XCTUnwrap(find(app.view,"native.world.card.2") as? UIButton)
        button.sendActions(for:.touchUpInside)
        XCTAssertTrue(viewed)
        let modal=try XCTUnwrap(find(app.view,"native.world.card.modal") as? JimiNativeWorldCardView)
        XCTAssertNotNil(find(modal,"native.world.ribbon"),"First presentation retains its NEW artwork")
        try await Task.sleep(for:.seconds(0.8))
        let close=try XCTUnwrap(find(modal,"native.world.card.close") as? UIButton)
        close.sendActions(for:.touchUpInside)
        let returned=Date().addingTimeInterval(6)
        while app.world?.hasActiveCard == true,Date()<returned {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertFalse(app.world?.hasActiveCard == true)
        XCTAssertNil(find(app.view,"native.world.ribbon"))
        button.sendActions(for:.touchUpInside)
        XCTAssertNotNil(find(app.view,"native.world.card.modal"))
        XCTAssertNil(find(app.view,"native.world.ribbon"),"Retained World cannot replay the viewed ribbon")
    }

}
