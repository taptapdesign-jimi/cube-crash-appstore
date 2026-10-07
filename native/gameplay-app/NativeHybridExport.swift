import UIKit
import WebKit
import StackToSixNativeState

/// One-time transport for the old hybrid profile in THIS Native application's sandbox.
/// The blank exporter uses the original app://localhost origin and default WebKit profile.
/// It never boots Web.bundle/game JavaScript and never edits/removes source localStorage.
/// After the native atomic save succeeds, normal launches need no WebKit instance.
@MainActor
final class NativeHybridExport: NSObject, WKNavigationDelegate {
    enum ExportError: LocalizedError {
        case wrongProduct, alreadyRunning, emptyExport, invalidPayload, navigationRejected, timedOut
        var errorDescription: String? {
            switch self {
            case .wrongProduct:return "Native save import belongs to the separate Native application."
            case .alreadyRunning:return "Native save import is already running."
            case .emptyExport:return "The original Native profile was not found at its expected origin. Existing data was preserved."
            case .invalidPayload:return "The original Native save could not be read coherently. Existing data was preserved."
            case .navigationRejected:return "Native save import rejected an unexpected origin."
            case .timedOut:return "Reading the original Native profile timed out. Existing data was preserved."
            }
        }
    }
    private static let product="com.taptapdesign.stacktosix.native"
    nonisolated private static let exportURL=URL(string:"app://localhost/__native_profile_export__.html")!
    private var web:WKWebView?
    private var completion:((Result<Data,Error>)->Void)?
    private var timeout:Task<Void,Never>?
    private var generation=0
    private let blankHandler=BlankExportHandler()

    func export(completion:@escaping (Result<Data,Error>)->Void) {
        guard Bundle.main.bundleIdentifier==Self.product else {completion(.failure(ExportError.wrongProduct));return}
        guard self.completion==nil else {completion(.failure(ExportError.alreadyRunning));return}
        generation+=1;let epoch=generation;self.completion=completion
        let configuration=WKWebViewConfiguration()
        configuration.websiteDataStore=WKWebsiteDataStore.default()
        configuration.setURLSchemeHandler(blankHandler,forURLScheme:"app")
        configuration.preferences.javaScriptCanOpenWindowsAutomatically=false
        let web=WKWebView(frame:.zero,configuration:configuration)
        web.navigationDelegate=self;self.web=web
        let timeout=Task { @MainActor [weak self] in
            do {try await Task.sleep(nanoseconds:12_000_000_000)} catch {return}
            guard let self,self.generation==epoch else {return}
            self.finish(.failure(ExportError.timedOut))
        }
        self.timeout=timeout
        web.load(URLRequest(url:Self.exportURL))
    }
    func importInto(_ store:NativeSaveStore,completion:@escaping (Result<NativeSaveEnvelope,Error>)->Void) {
        export { result in
            switch result {
            case .failure(let error):completion(.failure(error))
            case .success(let data):
                do {
                    let envelope=try NativeHybridImporter.importExport(data)
                    try store.save(envelope)
                    completion(.success(envelope))
                } catch {completion(.failure(error))}
            }
        }
    }
    func cancel() {finish(.failure(CancellationError()))}
    private func finish(_ result:Result<Data,Error>) {
        guard let completion else {return}
        self.completion=nil;generation+=1;timeout?.cancel();timeout=nil
        web?.navigationDelegate=nil;web?.stopLoading();web?.removeFromSuperview();web=nil
        completion(result)
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy)->Void) {
        guard navigationAction.request.url==Self.exportURL,navigationAction.targetFrame?.isMainFrame != false else {
            decisionHandler(.cancel);finish(.failure(ExportError.navigationRejected));return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) {
        guard webView===web,webView.url==Self.exportURL else {finish(.failure(ExportError.navigationRejected));return}
        let epoch=generation
        let script="""
        (() => {
          if (location.protocol !== 'app:' || location.host !== 'localhost') throw new Error('wrong origin');
          const exact = new Set(['cc_settings','cc_board_stats_v1','cc_arcade_stats_v1','cc_arcade_run_state_v1',
            'cc_arcade_pending_round_v1','journey_boards_state','journey_viewed_boards',
            'journey_highest_unlocked_board_id','journey_last_opened_board_id','journey_current_run_state',
            'cc_special_dice_unlocked_flower','cc_special_dice_unlocked_juice','cc_board_completed','cc_first_play_tutorial_done','cc_first_play_tutorial_force_next','cc_saved_game']);
          const storage = {};
          for (let i=0;i<localStorage.length;i++) {
            const key=localStorage.key(i);
            if (exact.has(key) || /^cc_saved_game_board_\\d+$/.test(key) || /^cc_journey_completed_board_\\d+$/.test(key)) {
              storage[key]=localStorage.getItem(key);
            }
          }
          return JSON.stringify({product:'com.taptapdesign.stacktosix.native',storage});
        })()
        """
        webView.evaluateJavaScript(script) { [weak self] value,error in
            guard let self,self.generation==epoch else {return}
            if let error {self.finish(.failure(error));return}
            guard let json=value as? String,let data=json.data(using:.utf8),let root=try? JSONSerialization.jsonObject(with:data) as? [String:Any],let storage=root["storage"] as? [String:String],!storage.isEmpty else {self.finish(.failure(ExportError.emptyExport));return}
            // An unscoped pre-board save has no reliable mode identity here. Do not discard it
            // by creating an empty native profile; require its canonical migration owner first.
            if storage["cc_saved_game"] != nil && !storage.keys.contains(where:{$0.hasPrefix("cc_saved_game_board_") || $0=="cc_arcade_run_state_v1"}) {
                self.finish(.failure(ExportError.invalidPayload));return
            }
            self.finish(.success(data))
        }
    }
    func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error) {finish(.failure(error))}
    func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error) {finish(.failure(error))}
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) {finish(.failure(ExportError.invalidPayload))}

    /// Only the one blank document is served. There is no resource tree or web app loader.
    private final class BlankExportHandler:NSObject,WKURLSchemeHandler {
        func webView(_ webView:WKWebView,start urlSchemeTask:WKURLSchemeTask) {
            guard urlSchemeTask.request.url==NativeHybridExport.exportURL else {
                urlSchemeTask.didFailWithError(ExportError.navigationRejected);return
            }
            let data=Data("<!doctype html><meta charset=utf-8><title>Native profile import</title>".utf8)
            urlSchemeTask.didReceive(URLResponse(url:NativeHybridExport.exportURL,mimeType:"text/html",expectedContentLength:data.count,textEncodingName:"utf-8"))
            urlSchemeTask.didReceive(data);urlSchemeTask.didFinish()
        }
        func webView(_ webView:WKWebView,stop urlSchemeTask:WKURLSchemeTask) {}
    }
}
