import XCTest
import UIKit
import WebKit
@testable import Stack_to_Six

@MainActor
final class JimiNativeWorldReturnPreparationTests:XCTestCase {
    private var root:URL {NativeTestResources.root}
    private func snapshot(asset:String = "assets/close-icon.png")->[String:Any] {
        ["version":1,"worldID":1,"requestID":"7","routeGeneration":2,"stateRevision":1,"title":"Forest","contentHeight":1500,
         "mainFrame":["x":0,"y":100,"width":390,"height":300],"mainParts":[],
         "units":[["id":"board-1","boardID":1,"frame":["x":30,"y":400,"width":150,"height":200],"cardArt":asset,"locked":false,"interim":false,"stars":0,"allowedActions":["openCard","play"],"stats":[],"parts":[["asset":asset,"role":"card","x":20,"y":10,"width":90,"height":133,"rotation":0,"opacity":1,"zIndex":2]]]]]
    }
    private func runtime(_ web:WKWebView,current:Bool = true) async throws {
        web.loadHTMLString("<html><body></body></html>",baseURL:nil)
        for _ in 0..<100 {
            if !web.isLoading {break};try await Task.sleep(nanoseconds:10_000_000)
        }
        _ = try await web.evaluateJavaScript("window.returnAcks=[];window.returnValidations=[];window.__jimiNativeHomeHubRuntime={isNativeWorldReturnPreparationCurrent:(...a)=>{returnValidations.push(a);return \(current ? "true" : "false")},ackNativeWorldReturnPrepared:(...a)=>{returnAcks.push(a);return true},suspendFeedback:()=>{},cancel:()=>{}}")
    }
    private func gate() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only")
        #endif
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A",UIApplication.shared.applicationState == .active else {throw XCTSkip("Active isolated QA Simulator only")}
    }
    func testParkedReturnAcknowledgesOnlyAfterHiddenResourceAndPoseReadiness() async throws {
        try gate();let web = WKWebView(frame:.zero);try await runtime(web)
        let controller = JimiHomeHubController(web:web,resourceRoot:root)
        controller.loadViewIfNeeded();controller.view.frame = CGRect(x:0,y:0,width:390,height:844)
        defer {controller.dispose()}
        controller.receive(["kind":"prepare-world-return","terminalToken":91,"worldSnapshot":snapshot()])
        var count = 0
        for _ in 0..<100 {
            count = (try await web.evaluateJavaScript("returnAcks.length") as? Int) ?? 0
            if count == 1 {break};try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertEqual(count,1)
        let args = try await web.evaluateJavaScript("returnAcks[0]") as? [Int]
        XCTAssertEqual(args,[91,2,1,1])
        let world = try XCTUnwrap(controller.view.subviews.compactMap {$0 as? JimiNativeWorldView}.first)
        XCTAssertTrue(world.isHidden);XCTAssertFalse(world.isReadyForInput);XCTAssertFalse(world.isUserInteractionEnabled)
        XCTAssertFalse(world.preparationHasMissingResources)
        XCTAssertTrue(web.accessibilityElementsHidden == false,"Hidden preparation must preserve web gameplay coverage")
    }
    func testStaleReturnReceiptAndMissingArtworkNeverAcknowledge() async throws {
        try gate()
        for current in [false,true] {
            let web = WKWebView(frame:.zero);try await runtime(web,current:current)
            let controller = JimiHomeHubController(web:web,resourceRoot:root)
            defer {controller.dispose()}
            controller.loadViewIfNeeded();controller.view.frame = CGRect(x:0,y:0,width:390,height:844)
            controller.receive(["kind":"prepare-world-return","terminalToken":91,"worldSnapshot":snapshot(asset:current ? "assets/does-not-exist.png" : "assets/close-icon.png")])
            try await Task.sleep(nanoseconds:300_000_000)
            let count = try await web.evaluateJavaScript("returnAcks.length") as? Int
            XCTAssertEqual(count,0)
        }
    }
    func testHiddenPreparationBackgroundRetiresWebLeaseAndForegroundRecreatesIt() async throws {
        try gate();let web = WKWebView(frame:.zero);try await runtime(web)
        _ = try await web.evaluateJavaScript("window.pendingLease=true;window.retiredLeases=0;window.renewedTokens=[];window.delayedValidation=null;__jimiNativeHomeHubRuntime.isNativeWorldReturnPreparationCurrent=()=>new Promise(resolve=>delayedValidation=resolve);__jimiNativeHomeHubRuntime.suspendFeedback=()=>{pendingLease=false;retiredLeases++};__jimiNativeHomeHubRuntime.prepareNativeWorldReturn=(token)=>{renewedTokens.push(token);pendingLease=true;return true};void 0")
        let controller = JimiHomeHubController(web:web,resourceRoot:root)
        controller.loadViewIfNeeded();controller.view.frame = CGRect(x:0,y:0,width:390,height:844)
        defer {controller.dispose()}
        controller.receive(["kind":"prepare-world-return","terminalToken":91,"worldSnapshot":snapshot()])
        for _ in 0..<100 {
            if (try await web.evaluateJavaScript("typeof delayedValidation === 'function'") as? Bool) == true {break}
            try await Task.sleep(nanoseconds:10_000_000)
        }
        controller.suspend()
        _ = try await web.evaluateJavaScript("delayedValidation(true)")
        try await Task.sleep(nanoseconds:50_000_000)
        let retired = try await web.evaluateJavaScript("retiredLeases") as? Int
        let oldAcks = try await web.evaluateJavaScript("returnAcks.length") as? Int
        XCTAssertEqual(retired,1);XCTAssertEqual(oldAcks,0,"Late validation cannot acknowledge the retired foreground owner")
        controller.resume()
        let renewed = try await web.evaluateJavaScript("renewedTokens") as? [Int]
        XCTAssertEqual(renewed,[91])
        _ = try await web.evaluateJavaScript("__jimiNativeHomeHubRuntime.isNativeWorldReturnPreparationCurrent=()=>pendingLease;void 0")
        controller.receive(["kind":"prepare-world-return","terminalToken":91,"worldSnapshot":snapshot()])
        var acknowledgements = 0
        for _ in 0..<100 {
            acknowledgements = (try await web.evaluateJavaScript("returnAcks.length") as? Int) ?? 0
            if acknowledgements == 1 {break};try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertEqual(acknowledgements,1,"Fresh foreground lease may acknowledge hidden preparation")
    }

}
