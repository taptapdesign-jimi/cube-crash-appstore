import XCTest
import WebKit

/// Creates only a new named WebsiteDataStore on the dedicated Simulator.
/// Its binary receipts let the native reader be validated against actual WebKit
/// persistence, rather than a manually invented database/origin format.
@MainActor final class NativeLegacyStorageProducerTests:XCTestCase {
    func testNamedProfileProducesOriginalOriginAndForeignOriginStorage() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A",
              Bundle.main.bundleIdentifier == "com.taptapdesign.stacktosix.native" else {throw XCTSkip("Dedicated Native QA Simulator only")}
        guard ProcessInfo.processInfo.environment["CC_NATIVE_QA_LEGACY_STORAGE_PRODUCER"] == "1" else {throw XCTSkip("Explicit isolated disk producer only")}
        guard #available(iOS 17.0,*) else {throw XCTSkip("Named test store requires iOS17")}
        let identifier=UUID(),store=WKWebsiteDataStore(forIdentifier:identifier)
        XCTAssertEqual(store.identifier,identifier)
        let handler=PageHandler(),configuration=WKWebViewConfiguration()
        configuration.websiteDataStore=store
        configuration.setURLSchemeHandler(handler,forURLScheme:"app")
        let navigation=NavigationReceipt()
        var web:WKWebView?=WKWebView(frame:.zero,configuration:configuration)
        web?.navigationDelegate=navigation
        for host in ["localhost","foreign.invalid"] {
            let loaded=expectation(description:"Named fixture \(host)")
            navigation.loaded=loaded
            web?.load(URLRequest(url:URL(string:"app://\(host)/__native_storage_fixture__.html")!))
            await fulfillment(of:[loaded],timeout:15)
            let receipt=try await web!.evaluateJavaScript("""
            (()=>{const data={cc_first_play_tutorial_done:'true',cc_first_play_tutorial_force_next:'false',cc_settings:'{"gameSoundsEnabled":false,"musicEnabled":false,"hapticsEnabled":false}',native_qa_unicode:'Čćž 😀\\u0000尾'};for(const [key,value] of Object.entries(data)) localStorage.setItem(key,value);return JSON.stringify({origin:location.origin,storage:data});})()
            """)
            let text=try XCTUnwrap(receipt as? String)
            let attachment=XCTAttachment(data:Data(text.utf8),uniformTypeIdentifier:"public.json")
            attachment.name="native-legacy-producer-\(host)";attachment.lifetime = .keepAlways;add(attachment)
        }
        web?.navigationDelegate=nil;web?.stopLoading();web=nil
        // WebKit's own deferred SQLite commit precedes bounded disk capture.
        try await Task.sleep(nanoseconds:1_500_000_000)
        let library=try FileManager.default.url(for:.libraryDirectory,in:.userDomainMask,appropriateFor:nil,create:false)
        let roots=["WebKit/WebsiteDataStore", "WebKit/com.taptapdesign.stacktosix.native/WebsiteDataStore"].map {
            library.appendingPathComponent($0,isDirectory:true).appendingPathComponent(identifier.uuidString.lowercased(),isDirectory:true)
        }.filter {FileManager.default.fileExists(atPath:$0.path)}
        XCTAssertEqual(roots.count,1,"Named store must have one exact runtime root")
        let root=try XCTUnwrap(roots.first)
        var files:[[String:String]]=[]
        let enumerator=try XCTUnwrap(FileManager.default.enumerator(at:root,includingPropertiesForKeys:[.isRegularFileKey]))
        while let url=enumerator.nextObject() as? URL {
            guard try url.resourceValues(forKeys:[.isRegularFileKey]).isRegularFile == true else {continue}
            let path=String(url.path.dropFirst(root.path.count+1))
            guard path.hasPrefix("Origins/") || path.hasPrefix("LocalStorage/") else {continue}
            files.append(["path":path,"base64":try Data(contentsOf:url).base64EncodedString()])
        }
        XCTAssertEqual(files.filter{$0["path"]?.hasSuffix("/origin")==true}.count,2)
        XCTAssertEqual(files.filter{$0["path"]?.hasSuffix("localstorage.sqlite3")==true}.count,2)
        let data=try JSONSerialization.data(withJSONObject:["identifier":identifier.uuidString,"files":files],options:[.sortedKeys])
        let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json")
        attachment.name="native-legacy-storage-disk-producer";attachment.lifetime = .keepAlways;add(attachment)
        // Test-owned named store is retained as evidence. Default profile is
        // never opened/read/removed; no application save or PWA data is touched.
    }
    private final class NavigationReceipt:NSObject,WKNavigationDelegate {
        var loaded:XCTestExpectation?
        func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){loaded?.fulfill();loaded=nil}
    }
    private final class PageHandler:NSObject,WKURLSchemeHandler {
        func webView(_ webView:WKWebView,start task:WKURLSchemeTask) {
            guard let url=task.request.url,url.path == "/__native_storage_fixture__.html",["localhost","foreign.invalid"].contains(url.host ?? "") else {task.didFailWithError(URLError(.unsupportedURL));return}
            let data=Data("<!doctype html><meta charset=utf-8><title>Named Native QA storage producer</title>".utf8)
            task.didReceive(URLResponse(url:url,mimeType:"text/html",expectedContentLength:data.count,textEncodingName:"utf-8"));task.didReceive(data);task.didFinish()
        }
        func webView(_ webView:WKWebView,stop task:WKURLSchemeTask){}
    }
}
