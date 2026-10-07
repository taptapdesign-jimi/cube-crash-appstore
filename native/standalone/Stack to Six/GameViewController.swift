//
//  GameViewController.swift
//  Stack to Six
//
//  Created by jimi on 25.10.2025..
//

import UIKit
import WebKit
import UniformTypeIdentifiers
import AVFAudio
import StackToSixNativeState
final class LocalFileSchemeHandler: NSObject, WKURLSchemeHandler {
    private var activeTasks = Set<ObjectIdentifier>()
    private let activeTasksLock = NSLock()
    private let ioQueue = DispatchQueue(label: "com.taptapdesign.stacktosix.local-file-loader", qos: .userInitiated, attributes: .concurrent)
    private let fileCache: NSCache<NSString, NSData> = {
        let cache = NSCache<NSString, NSData>()
        // WKWebView and Pixi already retain encoded/decoded asset copies. Keep
        // this raw response cache deliberately small so it cannot amplify iOS
        // memory pressure and trigger WebGL texture backing-store eviction.
        cache.totalCostLimit = 16 * 1024 * 1024
        cache.countLimit = 96
        return cache
    }()

    func purgeCachedFiles() {
        fileCache.removeAllObjects()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let taskId = ObjectIdentifier(urlSchemeTask)
        markTask(taskId, active: true)

        guard let url = urlSchemeTask.request.url else {
            fail(urlSchemeTask, taskId: taskId, error: URLError(.badURL))
            return
        }

        guard let resolved = resolveFileURL(for: url) else {
            fail(urlSchemeTask, taskId: taskId, error: URLError(.fileDoesNotExist))
            return
        }

        if let cached = fileCache.object(forKey: resolved.cacheKey as NSString) {
            finish(urlSchemeTask, taskId: taskId, requestURL: url, fileURL: resolved.fileURL, data: cached as Data)
            return
        }

        ioQueue.async { [weak self] in
            guard let self else { return }
            guard self.isTaskActive(taskId) else { return }

            do {
                let data = try Data(contentsOf: resolved.fileURL, options: [.mappedIfSafe])
                self.fileCache.setObject(data as NSData, forKey: resolved.cacheKey as NSString, cost: data.count)
                self.finish(urlSchemeTask, taskId: taskId, requestURL: url, fileURL: resolved.fileURL, data: data)
            } catch {
                print("❌ Local asset read failed: \(resolved.relativePath) -> \(resolved.fileURL.path) | \(error.localizedDescription)")
                self.fail(urlSchemeTask, taskId: taskId, error: error)
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        markTask(ObjectIdentifier(urlSchemeTask), active: false)
    }

    private func resolveFileURL(for url: URL) -> (fileURL: URL, relativePath: String, cacheKey: String)? {
        let rawPath = url.path(percentEncoded: false)
        let requestedPath = rawPath == "/" ? "/index.html" : rawPath
        let relativePath = requestedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !relativePath.contains("..") else {
            print("❌ Blocked unsafe local asset path: \(relativePath)")
            return nil
        }

        guard let webBundleRoot = Bundle.main.url(forResource: "Web", withExtension: "bundle") else {
            print("❌ Missing Web.bundle")
            return nil
        }

        let fileURL = webBundleRoot.appendingPathComponent(relativePath, isDirectory: false)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("❌ Local asset missing: \(relativePath) -> \(fileURL.path)")
            return nil
        }

        return (fileURL, relativePath, relativePath)
    }

    private func finish(_ task: WKURLSchemeTask, taskId: ObjectIdentifier, requestURL: URL, fileURL: URL, data: Data) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.isTaskActive(taskId) else { return }
            let response = HTTPURLResponse(
                url: requestURL,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": Self.mimeType(for: fileURL),
                    "Content-Length": String(data.count),
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "Access-Control-Allow-Origin": "*"
                ]
            ) ?? URLResponse(
                url: requestURL,
                mimeType: Self.mimeType(for: fileURL),
                expectedContentLength: data.count,
                textEncodingName: nil
            )

            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
            self.markTask(taskId, active: false)
        }
    }

    private func fail(_ task: WKURLSchemeTask, taskId: ObjectIdentifier, error: Error) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.isTaskActive(taskId) else { return }
            task.didFailWithError(error)
            self.markTask(taskId, active: false)
        }
    }

    private func markTask(_ taskId: ObjectIdentifier, active: Bool) {
        activeTasksLock.lock()
        if active { activeTasks.insert(taskId) } else { activeTasks.remove(taskId) }
        activeTasksLock.unlock()
    }

    private func isTaskActive(_ taskId: ObjectIdentifier) -> Bool {
        activeTasksLock.lock()
        let active = activeTasks.contains(taskId)
        activeTasksLock.unlock()
        return active
    }

    private static func mimeType(for fileURL: URL) -> String {
        switch fileURL.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        default:
            return UTType(filenameExtension: fileURL.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}

class GameViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    
    var webView: WKWebView!
    private let localFileSchemeHandler = LocalFileSchemeHandler()
    private var launchPaperBackgroundView: UIImageView?
    private var didAttemptInitialWebFocus = false
    private var thermalSampleTimer: Timer?
    private var thermalObservers: [NSObjectProtocol] = []
    private var thermalSampleFileHandle: FileHandle?
    private var thermalPersistedSampleCount = 0
    private var thermalSampleSequence = 0
    private var didReportThermalPersistenceLimit = false
    private var didReportThermalPersistenceFailure = false
    private var audioLifecycleObservers: [NSObjectProtocol] = []
    private let audioLifecycleQueue = DispatchQueue(
        label: "com.taptapdesign.stacktosix.audio-lifecycle",
        qos: .userInitiated
    )
    private var audioActivationInFlight = false
    private var audioActivationSequence = 0
    private var audioForegroundEpoch = 0
    private var pendingAudioActivationReason: String?
    private var pendingAudioActivationNeedsCategory = false
    private var pendingAudioActivationForegroundEpoch = 0
    private var pendingAudioActivationRequestedAtMs: Int64?
    private var lastMemoryWarningAt: TimeInterval?
    private lazy var impactFeedbackGenerators: [String: UIImpactFeedbackGenerator] = [
        "light": UIImpactFeedbackGenerator(style: .light),
        "medium": UIImpactFeedbackGenerator(style: .medium),
        "heavy": UIImpactFeedbackGenerator(style: .heavy),
        "rigid": UIImpactFeedbackGenerator(style: .rigid),
        "soft": UIImpactFeedbackGenerator(style: .soft)
    ]
    private lazy var selectionFeedbackGenerator = UISelectionFeedbackGenerator()
    private lazy var notificationFeedbackGenerator = UINotificationFeedbackGenerator()
    private var hapticImpactRequestCount = 0
    private var hapticSelectionRequestCount = 0
    private var hapticNotificationRequestCount = 0
    private var hapticSuppressedRequestCount = 0
    private static let webContentIncidentKey = "cc.lastWebContentTermination"
    private static let thermalSampleInterval: TimeInterval = 5
    private static let thermalSampleFileLimit = 720
    private static let thermalSampleSessionLimit = 8
    private static var performanceDiagnosticsEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--cc-performance-diagnostics")
            || UserDefaults.standard.bool(forKey: "cc.performanceDiagnostics")
    }
    private static var passiveAudioIsolationEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--cc-passive-audio-isolation")
    }
    private static var passiveSpecialSheetsIsolationEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--cc-passive-special-sheets-isolation")
    }
    private static var passivePixiCadenceIsolationEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--cc-passive-pixi-cadence-isolation")
    }
    private static var passivePixiResolutionIsolationEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--cc-passive-pixi-resolution-isolation")
    }
    private static var nativeThermalTelemetryEnabled: Bool {
        performanceDiagnosticsEnabled
            || ProcessInfo.processInfo.arguments.contains("--cc-native-thermal-telemetry")
            || passiveAudioIsolationEnabled
            || passiveSpecialSheetsIsolationEnabled
            || passivePixiCadenceIsolationEnabled
            || passivePixiResolutionIsolationEnabled
    }
    private static var hapticIsolationEnabled: Bool {
        performanceDiagnosticsEnabled
            && ProcessInfo.processInfo.arguments.contains("--cc-thermal-haptics-isolated")
    }
    
    private var jimiHomeHub: JimiHomeHubController?
    private var jimiMusic: JimiNativeMusic?
    private var nativeBootstrap: NativeBootstrap?
    private static var nativeGameplayEnabled: Bool {
        #if DEBUG && targetEnvironment(simulator)
        return Bundle.main.bundleIdentifier == "com.taptapdesign.stacktosix.native"
            && ProcessInfo.processInfo.arguments.contains("--native-gameplay")
            && ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A"
        #else
        return false
        #endif
    }
    private static var jimiHomeHubEnabled: Bool {
        Bundle.main.bundleIdentifier == "com.taptapdesign.stacktosix.native"
    }
    private static var jimiNativeForestEnabled: Bool {
        // User authorized the separate Native iPhone preview on 2026-10-06.
        // Simulator keeps its isolated A/B opt-in; release remains gated.
        #if DEBUG
        #if targetEnvironment(simulator)
        return jimiHomeHubEnabled
            && ProcessInfo.processInfo.arguments.contains("--jimi-native-forest")
            && ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A"
        #else
        return jimiHomeHubEnabled
        #endif
        #else
        return false
        #endif
    }

    private static var jimiNativeWorldsEnabled: Bool {
        // User authorized all three Native Debug Worlds on iPhone on 2026-10-06.
        #if DEBUG
        #if targetEnvironment(simulator)
        return jimiHomeHubEnabled
            && ProcessInfo.processInfo.arguments.contains("--jimi-native-worlds")
            && ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A"
        #else
        return jimiHomeHubEnabled
        #endif
        #else
        return false
        #endif
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if Self.nativeGameplayEnabled {
            replaceSpriteKitRootViewIfNeeded()
            installLaunchPaperBackground()
            do {
                guard let root = Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle") else {
                    throw NSError(domain:"StackToSixNative",code:1,userInfo:[NSLocalizedDescriptionKey:"Native artwork is missing"])
                }
                var qaStore:NativeSaveStore?
                #if DEBUG && targetEnvironment(simulator)
                // Explicit isolated UI-QA profile. Never replaces/migrates the
                // normal Native profile and is unreachable on physical builds.
                if ProcessInfo.processInfo.arguments.contains("--native-qa-fresh-profile") {
                    let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-ui-qa-\(UUID().uuidString)")
                    let store=NativeSaveStore(directory:directory)
                    try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
                    qaStore=store
                }
                #endif
                let bootstrap = try NativeBootstrap(root:root,store:qaStore)
                nativeBootstrap = bootstrap; bootstrap.start(in:self)
            } catch {
                let label = UILabel(frame:view.bounds.insetBy(dx:24,dy:80))
                label.numberOfLines = 0;label.textAlignment = .center;label.textColor = .systemRed
                label.text = error.localizedDescription;view.addSubview(label)
            }
            return
        }
        if let previous = UserDefaults.standard.string(forKey: Self.webContentIncidentKey) {
            print("[CC_WEB_CONTENT_INCIDENT] previous \(previous)")
        }

        replaceSpriteKitRootViewIfNeeded()
        installLaunchPaperBackground()
        
        // Setup WKWebView
        setupWebView()
        if Self.jimiHomeHubEnabled, let webView,
           let root = Bundle.main.resourceURL?.appendingPathComponent("Web.bundle") {
            let controller = JimiHomeHubController(web: webView, resourceRoot: root)
            jimiHomeHub = controller
            addChild(controller)
            controller.view.frame = view.bounds
            controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.addSubview(controller.view)
            controller.didMove(toParent: self)
        }

        installNativeAudioLifecycle()
        
        // Load the game HTML
        loadGame()

        if Self.nativeThermalTelemetryEnabled {
            startNativeThermalTelemetry()
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // One initial appearance only: never take focus back on foreground,
        // navigation completion, or dismissal of another native controller.
        guard !didAttemptInitialWebFocus else { return }
        didAttemptInitialWebFocus = true
        guard !Self.useDevServer,
              UIApplication.shared.applicationState != .background,
              let window = view.window, window.isKeyWindow,
              let webView, webView.window === window,
              presentedViewController == nil,
              webView.canBecomeFirstResponder else {
            if Self.performanceDiagnosticsEnabled {
                print("[CC_NATIVE_INITIAL_FOCUS] skipped initial appearance")
            }
            return
        }
        // Public WKWebView focus performs cold UIKit responder initialization
        // beneath launch presentation instead of on the first game tap.
        let started = ProcessInfo.processInfo.systemUptime
        let accepted = webView.becomeFirstResponder()
        if Self.performanceDiagnosticsEnabled {
            let elapsedMs = (ProcessInfo.processInfo.systemUptime - started) * 1000
            print("[CC_NATIVE_INITIAL_FOCUS] accepted=\(accepted) durationMs=\(elapsedMs)")
        }
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        lastMemoryWarningAt = Date().timeIntervalSince1970
        logNativeThermalSample(reason: "memory-warning")
        webView?.evaluateJavaScript("window.__ccHandleNativeMemoryWarning?.()") { _, error in
            if let error {
                print("[CC_NATIVE_MEMORY] JavaScript snapshot failed: \(error.localizedDescription)")
            }
        }
        localFileSchemeHandler.purgeCachedFiles()
        webView?.configuration.websiteDataStore.removeData(
            ofTypes: [WKWebsiteDataTypeMemoryCache],
            modifiedSince: Date.distantPast,
            completionHandler: {}
        )
    }

    private static func thermalStateName(_ state: ProcessInfo.ThermalState) -> String {
        switch state {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "unknown"
        }
    }

    private func logNativeThermalSample(reason: String) {
        let processInfo = ProcessInfo.processInfo
        thermalSampleSequence += 1
        let batteryLevel = UIDevice.current.batteryLevel
        let batteryPercent = batteryLevel >= 0 ? Int((batteryLevel * 100).rounded()) : -1
        let payload: [String: Any] = [
            "reason": reason,
            "wall": Int((Date().timeIntervalSince1970 * 1000).rounded()),
            "persistenceAvailable": thermalSampleFileHandle != nil && thermalPersistedSampleCount < Self.thermalSampleFileLimit,
            "thermalState": Self.thermalStateName(processInfo.thermalState),
            "lowPowerMode": processInfo.isLowPowerModeEnabled,
            "batteryPercent": batteryPercent,
            "batteryState": UIDevice.current.batteryState.rawValue,
            "brightnessPercent": Int(((view.window?.screen.brightness ?? UIScreen.main.brightness) * 100).rounded()),
            "activeProcessorCount": processInfo.activeProcessorCount,
            "systemUptimeSeconds": Int(processInfo.systemUptime.rounded()),
            "sequence": thermalSampleSequence,
            "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
            "appBuild": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
            "performanceDiagnosticsEnabled": Self.performanceDiagnosticsEnabled,
            "passiveAudioIsolationEnabled": Self.passiveAudioIsolationEnabled,
            "passiveSpecialSheetsIsolationEnabled": Self.passiveSpecialSheetsIsolationEnabled,
            "passivePixiCadenceIsolationEnabled": Self.passivePixiCadenceIsolationEnabled,
            "passivePixiResolutionIsolationEnabled": Self.passivePixiResolutionIsolationEnabled,
            "nativeThermalTelemetryEnabled": Self.nativeThermalTelemetryEnabled,
            "hapticIsolationEnabled": Self.hapticIsolationEnabled,
            "hapticImpactRequests": hapticImpactRequestCount,
            "hapticSelectionRequests": hapticSelectionRequestCount,
            "hapticNotificationRequests": hapticNotificationRequestCount,
            "hapticSuppressedRequests": hapticSuppressedRequestCount
        ]
        guard
            let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
            let json = String(data: data, encoding: .utf8)
        else { return }
        print("[CC_NATIVE_THERMAL] \(json)")
        jimiMusic?.traceState("existing-telemetry:\(reason)")
        persistNativeThermalSample(json)
        if ProcessInfo.processInfo.arguments.contains("--cc-thermal-isolation") {
            webView?.evaluateJavaScript("window.__ccNativeThermalSample = \(json)") { _, _ in }
        }
    }

    private func prepareNativeThermalPersistence() {
        guard thermalSampleFileHandle == nil else { return }
        let fileManager = FileManager.default
        do {
            let cachesRoot = try fileManager.url(
                for: .cachesDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let directory = cachesRoot.appendingPathComponent("CCNativeThermal", isDirectory: true)
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

            let existingSessions = try fileManager.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: [.contentModificationDateKey],
                options: [.skipsHiddenFiles]
            )
                .filter { $0.pathExtension == "jsonl" }
                .sorted { lhs, rhs in
                    let lhsDate = (try? lhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                    let rhsDate = (try? rhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                    return lhsDate > rhsDate
                }
            for staleURL in existingSessions.dropFirst(Self.thermalSampleSessionLimit - 1) {
                try? fileManager.removeItem(at: staleURL)
            }

            let startedAtMilliseconds = Int((Date().timeIntervalSince1970 * 1000).rounded())
            let processIdentifier = ProcessInfo.processInfo.processIdentifier
            let fileURL = directory.appendingPathComponent(
                "thermal-\(startedAtMilliseconds)-\(processIdentifier).jsonl",
                isDirectory: false
            )
            guard fileManager.createFile(atPath: fileURL.path, contents: nil) else {
                throw CocoaError(.fileWriteUnknown)
            }
            thermalSampleFileHandle = try FileHandle(forWritingTo: fileURL)
            thermalPersistedSampleCount = 0
            thermalSampleSequence = 0
            didReportThermalPersistenceLimit = false
            print("[CC_NATIVE_THERMAL_FILE] \(fileURL.lastPathComponent)")
        } catch {
            reportThermalPersistenceFailure(error)
        }
    }

    private func persistNativeThermalSample(_ json: String) {
        guard thermalPersistedSampleCount < Self.thermalSampleFileLimit else {
            if !didReportThermalPersistenceLimit {
                didReportThermalPersistenceLimit = true
                print("[CC_NATIVE_THERMAL_FILE] sample limit reached \(Self.thermalSampleFileLimit)")
            }
            return
        }
        guard let data = "\(json)\n".data(using: .utf8),
              let thermalSampleFileHandle else { return }
        do {
            try thermalSampleFileHandle.write(contentsOf: data)
            thermalPersistedSampleCount += 1
        } catch {
            reportThermalPersistenceFailure(error)
            closeNativeThermalPersistence()
        }
    }

    private func reportThermalPersistenceFailure(_ error: Error) {
        guard !didReportThermalPersistenceFailure else { return }
        didReportThermalPersistenceFailure = true
        print("[CC_NATIVE_THERMAL_FILE] unavailable \(error.localizedDescription)")
    }

    private func closeNativeThermalPersistence() {
        do {
            try thermalSampleFileHandle?.close()
        } catch {
            reportThermalPersistenceFailure(error)
        }
        thermalSampleFileHandle = nil
    }

    private func startThermalSampleTimer() {
        thermalSampleTimer?.invalidate()
        thermalSampleTimer = Timer.scheduledTimer(withTimeInterval: Self.thermalSampleInterval, repeats: true) { [weak self] _ in
            self?.logNativeThermalSample(reason: "interval")
        }
        thermalSampleTimer?.tolerance = 0.5
    }

    private func stopThermalSampleTimer() {
        thermalSampleTimer?.invalidate()
        thermalSampleTimer = nil
    }

    private func startNativeThermalTelemetry() {
        guard thermalObservers.isEmpty else { return }
        UIDevice.current.isBatteryMonitoringEnabled = true
        prepareNativeThermalPersistence()
        let center = NotificationCenter.default
        thermalObservers = [
            center.addObserver(
                forName: ProcessInfo.thermalStateDidChangeNotification,
                object: ProcessInfo.processInfo,
                queue: .main
            ) { [weak self] _ in
                self?.logNativeThermalSample(reason: "thermal-state-change")
            },
            center.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.logNativeThermalSample(reason: "app-active")
                self?.startThermalSampleTimer()
            },
            center.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.logNativeThermalSample(reason: "app-background")
                self?.stopThermalSampleTimer()
            }
        ]
        logNativeThermalSample(reason: "telemetry-start")
        startThermalSampleTimer()
    }

    private func stopNativeThermalTelemetry() {
        stopThermalSampleTimer()
        let center = NotificationCenter.default
        thermalObservers.forEach { center.removeObserver($0) }
        thermalObservers.removeAll()
        closeNativeThermalPersistence()
        UIDevice.current.isBatteryMonitoringEnabled = false
    }

    private func installNativeAudioLifecycle() {
        guard audioLifecycleObservers.isEmpty else { return }
        let center = NotificationCenter.default
        audioLifecycleObservers = [
            center.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard let self else { return }
                self.audioForegroundEpoch += 1
                self.activateNativeAudioAndNotifyWeb(
                    reason: "app-active",
                    foregroundEpoch: self.audioForegroundEpoch
                )
            },
            center.addObserver(
                forName: AVAudioSession.interruptionNotification,
                object: AVAudioSession.sharedInstance(),
                queue: .main
            ) { [weak self] notification in
                guard
                    let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                    AVAudioSession.InterruptionType(rawValue: rawType) == .ended
                else { return }
                self?.activateNativeAudioAndNotifyWeb(reason: "interruption-ended")
            },
            center.addObserver(
                forName: AVAudioSession.mediaServicesWereResetNotification,
                object: AVAudioSession.sharedInstance(),
                queue: .main
            ) { [weak self] _ in
                self?.activateNativeAudioAndNotifyWeb(reason: "media-services-reset", configureCategory: true)
            }
        ]
        activateNativeAudioAndNotifyWeb(reason: "startup", configureCategory: true)
    }

    private func activateNativeAudioAndNotifyWeb(
        reason: String,
        configureCategory: Bool = false,
        foregroundEpoch: Int? = nil,
        requestedAtMs: Int64? = nil
    ) {
        guard UIApplication.shared.applicationState != .background else { return }
        dispatchPrecondition(condition: .onQueue(.main))
        let activationForegroundEpoch = foregroundEpoch ?? audioForegroundEpoch
        let activationRequestedAtMs = requestedAtMs ?? Int64(
            (Date().timeIntervalSince1970 * 1000).rounded()
        )

        // AVAudioSession activation and route inspection can synchronously
        // block UIKit for close to a second on a physical iPhone. During the
        // board entrance that freezes every Pixi tween, which then appears to
        // snap forward when the main run loop resumes. Coalesce notifications
        // on main, but perform the blocking session work on a serial queue.
        if audioActivationInFlight {
            pendingAudioActivationReason = reason
            pendingAudioActivationNeedsCategory = pendingAudioActivationNeedsCategory || configureCategory
            pendingAudioActivationForegroundEpoch = max(
                pendingAudioActivationForegroundEpoch,
                activationForegroundEpoch
            )
            pendingAudioActivationRequestedAtMs = activationRequestedAtMs
            return
        }
        audioActivationInFlight = true
        audioActivationSequence += 1
        let activationSequence = audioActivationSequence
        if Self.performanceDiagnosticsEnabled {
            print("[CC_SOUNDTRACK_FG] native-request sequence=\(activationSequence) foregroundEpoch=\(activationForegroundEpoch) reason=\(reason) appState=\(UIApplication.shared.applicationState.rawValue)")
        }

        let category: AVAudioSession.Category = jimiMusic == nil ? .soloAmbient : JimiNativeMusic.sessionCategory
        audioLifecycleQueue.async { [weak self] in
            guard let self else { return }
            let session = AVAudioSession.sharedInstance()
            let started = ProcessInfo.processInfo.systemUptime
            var activationError: Error?
            do {
                if configureCategory {
                    try session.setCategory(category, mode: .default, options: [])
                }
                try session.setActive(true)
            } catch {
                activationError = error
            }
            let elapsedMs = (ProcessInfo.processInfo.systemUptime - started) * 1000

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.audioActivationInFlight = false
                let activationCompletedAtMs = Int64((Date().timeIntervalSince1970 * 1000).rounded())

                if let activationError {
                    print("[CC_NATIVE_AUDIO] activation-failed sequence=\(activationSequence) reason=\(reason) durationMs=\(Int(elapsedMs.rounded())) error=\(activationError.localizedDescription)")
                } else {
                    print("[CC_NATIVE_AUDIO] active sequence=\(activationSequence) reason=\(reason) durationMs=\(Int(elapsedMs.rounded())) appState=\(UIApplication.shared.applicationState.rawValue)")
                    self.notifyWebOfNativeAudioActivation(
                        reason: reason,
                        activationSequence: activationSequence,
                        foregroundEpoch: activationForegroundEpoch,
                        requestedAtMs: activationRequestedAtMs,
                        completedAtMs: activationCompletedAtMs
                    )
                }

                let pendingReason = self.pendingAudioActivationReason
                let pendingConfigure = self.pendingAudioActivationNeedsCategory
                let pendingForegroundEpoch = self.pendingAudioActivationForegroundEpoch
                let pendingRequestedAtMs = self.pendingAudioActivationRequestedAtMs
                self.pendingAudioActivationReason = nil
                self.pendingAudioActivationNeedsCategory = false
                self.pendingAudioActivationForegroundEpoch = 0
                self.pendingAudioActivationRequestedAtMs = nil
                // didBecomeActive and interruption-ended commonly arrive as
                // one burst. A successful setActive already satisfies that
                // burst, so do not issue a second sequence/source rebind.
                // Category/media-service recovery remains authoritative, and
                // a failed activation may consume the queued retry.
                let shouldRunPending = pendingReason != nil && (
                    activationError != nil ||
                    pendingConfigure ||
                    pendingReason == "media-services-reset"
                )
                if shouldRunPending, let pendingReason {
                    self.activateNativeAudioAndNotifyWeb(
                        reason: pendingReason,
                        configureCategory: pendingConfigure || (activationError != nil && configureCategory),
                        foregroundEpoch: pendingForegroundEpoch,
                        requestedAtMs: pendingRequestedAtMs
                    )
                } else if
                    activationError == nil,
                    let pendingReason,
                    pendingForegroundEpoch > activationForegroundEpoch,
                    let pendingRequestedAtMs
                {
                    // The completed setActive already made the session usable,
                    // but a newer didBecomeActive occurred while it was in
                    // flight. Publish a fresh receipt for that foreground so
                    // JS does not discard the only event as pre-background.
                    self.audioActivationSequence += 1
                    self.notifyWebOfNativeAudioActivation(
                        reason: pendingReason,
                        activationSequence: self.audioActivationSequence,
                        foregroundEpoch: pendingForegroundEpoch,
                        requestedAtMs: pendingRequestedAtMs,
                        completedAtMs: Int64((Date().timeIntervalSince1970 * 1000).rounded())
                    )
                }
            }
        }
    }

    private func notifyWebOfNativeAudioActivation(
        reason: String,
        activationSequence: Int,
        foregroundEpoch: Int,
        requestedAtMs: Int64,
        completedAtMs: Int64
    ) {
        dispatchPrecondition(condition: .onQueue(.main))
        let appState = UIApplication.shared.applicationState
        guard appState == .active else {
            if Self.performanceDiagnosticsEnabled {
                print("[CC_SOUNDTRACK_FG] native-dispatch-skipped sequence=\(activationSequence) foregroundEpoch=\(foregroundEpoch) reason=\(reason) appState=\(appState.rawValue)")
            }
            return
        }
        guard
            let encodedReason = try? JSONEncoder().encode(reason),
            let reasonJSON = String(data: encodedReason, encoding: .utf8)
        else { return }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('cc:native-audio-active',{detail:{reason:\(reasonJSON),activationSequence:\(activationSequence),foregroundEpoch:\(foregroundEpoch),activationRequestedAtMs:\(requestedAtMs),activationCompletedAtMs:\(completedAtMs)}}))"
        ) { _, error in
            if Self.performanceDiagnosticsEnabled {
                if let error {
                    print("[CC_SOUNDTRACK_FG] web-notify-failed sequence=\(activationSequence) foregroundEpoch=\(foregroundEpoch) reason=\(reason) error=\(error.localizedDescription)")
                } else {
                    print("[CC_SOUNDTRACK_FG] web-notify-complete sequence=\(activationSequence) foregroundEpoch=\(foregroundEpoch) reason=\(reason)")
                }
            }
        }
    }

    private func stopNativeAudioLifecycle() {
        let center = NotificationCenter.default
        audioLifecycleObservers.forEach { center.removeObserver($0) }
        audioLifecycleObservers.removeAll()
    }

    private func replaceSpriteKitRootViewIfNeeded() {
        let rootViewClassName = NSStringFromClass(type(of: view))
        guard rootViewClassName.contains("SKView") else { return }

        let replacementView = UIView(frame: view.frame)
        replacementView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        replacementView.backgroundColor = UIColor(red: 243/255.0, green: 238/255.0, blue: 232/255.0, alpha: 1.0)
        view = replacementView
        print("✅ Replaced SpriteKit root view with UIKit container for WKWebView")
    }

    private func installLaunchPaperBackground() {
        guard launchPaperBackgroundView == nil else { return }

        let imageView = UIImageView(image: UIImage(named: "LaunchPaper"))
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleToFill
        imageView.alpha = 0.6
        imageView.isUserInteractionEnabled = false
        view.insertSubview(imageView, at: 0)
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: view.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        launchPaperBackgroundView = imageView
        print("✅ Native launch paper background installed behind WKWebView")
    }
    
    func setupWebView() {
        let webConfiguration = WKWebViewConfiguration()
        
        // Allow inline media playback
        webConfiguration.allowsInlineMediaPlayback = true
        webConfiguration.mediaTypesRequiringUserActionForPlayback = []
        
        // Setup preferences
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        webConfiguration.defaultWebpagePreferences = preferences
        // The game has no editable text. CSS user-select alone still lets UIKit
        // run tap-and-a-half selection and cold edit-menu/DataDetectors work
        // during dice gestures (physical trace 2026-09-17). Disable that native
        // text interaction through the public API before creating the WebView.
        // Revisit this policy if an editable text field is added to the game.
        webConfiguration.preferences.isTextInteractionEnabled = false
        if !Self.useDevServer {
            webConfiguration.setURLSchemeHandler(localFileSchemeHandler, forURLScheme: "app")
        }
        
        // Setup haptic feedback bridge with multiple handlers
        let userContentController = WKUserContentController()
        if Self.jimiHomeHubEnabled,
           let root = Bundle.main.resourceURL?.appendingPathComponent("Web.bundle") {
            let music = JimiNativeMusic(root: root)
            jimiMusic = music
            userContentController.addScriptMessageHandler(music, contentWorld: .page, name: "jimiMusic")
            NSLog("[JIMI_NATIVE_MUSIC] bridge-installed")
        }
        if Self.jimiHomeHubEnabled {
            userContentController.add(self, name: "jimiHomeHub")
            userContentController.addUserScript(WKUserScript(source: "window.__jimiNativeHomeHubEnabled = true; window.__jimiNativeEndRunEnabled = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            if Self.jimiNativeWorldsEnabled {
                userContentController.addUserScript(WKUserScript(source: "window.__jimiNativeWorldsEnabled = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            }
            if Self.jimiNativeForestEnabled {
                userContentController.addUserScript(WKUserScript(source: "window.__jimiNativeForestEnabled = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            }
        }

        userContentController.add(self, name: "hapticImpact")
        userContentController.add(self, name: "hapticSelection")
        userContentController.add(self, name: "hapticNotification")
        if Self.performanceDiagnosticsEnabled {
            userContentController.add(self, name: "consoleLog")
            userContentController.addUserScript(Self.makePerformanceDiagnosticsFlagScript())
        }
        if Self.passiveAudioIsolationEnabled {
            userContentController.addUserScript(Self.makePassiveAudioIsolationFlagScript())
        }
        if Self.passiveSpecialSheetsIsolationEnabled {
            userContentController.addUserScript(Self.makePassiveSpecialSheetsIsolationFlagScript())
        }
        if Self.passivePixiCadenceIsolationEnabled {
            userContentController.addUserScript(Self.makePassivePixiCadenceIsolationFlagScript())
        }
        if Self.passivePixiResolutionIsolationEnabled {
            userContentController.addUserScript(Self.makePassivePixiResolutionIsolationFlagScript())
        }
        #if DEBUG && targetEnvironment(simulator)
        // Temporary Jimi-only attribution harness, never a physical build.
        if ProcessInfo.processInfo.arguments.contains("--jimi-qa-route-control"),
           ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A",
           let url = Bundle.main.url(forResource: "jimi-route-control", withExtension: "js", subdirectory: "Web.bundle"),
           let script = try? String(contentsOf: url, encoding: .utf8) {
            userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        #endif
        webConfiguration.userContentController = userContentController
        
        // Create web view
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        #if DEBUG && targetEnvironment(simulator)
        // Opt-in inspection of the bundled simulator build; never enabled on
        // physical devices or in Release by this diagnostic path.
        if Self.performanceDiagnosticsEnabled {
            webView.isInspectable = true
        }
        #endif
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        
        // Disable scrolling in webview
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        
        // Make webview respect safe areas
        webView.scrollView.contentInset = UIEdgeInsets.zero
        webView.scrollView.scrollIndicatorInsets = UIEdgeInsets.zero
        
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private static let useDevServer = false
    private static let devWrapperBuild = "bundled-wrapper-stack-to-six-webbundle-20260710"
    private static let devServerURL = ""

    func loadGame() {
        if Self.useDevServer {
            let reloadToken = Int(Date().timeIntervalSince1970 * 1000)
            let separator = Self.devServerURL.contains("?") ? "&" : "?"
            let devURLString = "\(Self.devServerURL)\(separator)nativeReloadToken=\(reloadToken)"
            guard let gameURL = URL(string: devURLString) else {
                assertionFailure("Invalid dev server URL: \(devURLString)")
                return
            }
            var request = URLRequest(url: gameURL)
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            request.timeoutInterval = 60
            runDevServerPreflight(request: request)
            clearDevWebViewData {
                self.webView.load(request)
            }
            print("✅ Loading native dev server version [\(Self.devWrapperBuild)] from \(devURLString)")
            return
        }

        guard Bundle.main.url(forResource: "Web", withExtension: "bundle")?.appendingPathComponent("index.html") != nil else {
            assertionFailure("Missing Web.bundle/index.html. Run a production web build and include Web.bundle before running.")
            return
        }

        let gameURL = URL(string: "app://localhost/index.html")!
        webView.load(URLRequest(url: gameURL))
        print("✅ Loading bundled local version from app://localhost/index.html")
    }

    private func clearDevWebViewData(completion: @escaping () -> Void) {
        let dataStore = WKWebsiteDataStore.default()
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.removeData(ofTypes: dataTypes, modifiedSince: Date(timeIntervalSince1970: 0)) {
            print("🧹 Cleared WKWebView website data before native dev load")
            DispatchQueue.main.async {
                completion()
            }
        }
    }

    private func runDevServerPreflight(request: URLRequest) {
        guard Self.useDevServer, let url = request.url else { return }

        var preflightRequest = URLRequest(url: url)
        preflightRequest.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        preflightRequest.timeoutInterval = 8

        URLSession.shared.dataTask(with: preflightRequest) { data, response, error in
            if let error {
                print("❌ Native dev preflight failed: \(error.localizedDescription)")
                return
            }

            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            let byteCount = data?.count ?? 0
            let preview = data.flatMap { String(data: $0.prefix(80), encoding: .utf8) } ?? ""
            print("✅ Native dev preflight succeeded: status=\(statusCode) bytes=\(byteCount) preview=\(preview)")
        }.resume()
    }
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }
    
    override var prefersStatusBarHidden: Bool {
        return true
    }
    
    private static func makePerformanceDiagnosticsFlagScript() -> WKUserScript {
        let thermalIsolation = ProcessInfo.processInfo.arguments.contains("--cc-thermal-isolation")
        #if DEBUG && targetEnvironment(simulator)
        let uiObservationScript = ProcessInfo.processInfo.arguments.contains("--cc-ui-test-observations")
            ? """
              window.__ccFastStackDiagnostics = true;
              let observationTimer = 0;
              window.addEventListener('pointerup', function() {
                clearTimeout(observationTimer);
                observationTimer = setTimeout(function() {
                  const entry = window.__ccFastStackTrace?.at(-1);
                  window.webkit.messageHandlers.consoleLog.postMessage({
                    level: 'info', message: '[CC_UI_OBSERVATION] ' + JSON.stringify(entry || {missing: true})
                  });
                }, 1000);
              }, {passive: true});
              """ : ""
        #else
        let uiObservationScript = ""
        #endif
        let source = """
        (function() {
          window.__ccPerformanceDiagnostics = true;
          window.__ccThermalIsolation = \(thermalIsolation ? "true" : "false");
          \(uiObservationScript)
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    }


    private static func makePassiveAudioIsolationFlagScript() -> WKUserScript {
        let source = """
        (function() {
          window.__ccThermalAudioIsolationAvailable = true;
          window.__ccThermalAudioSuppressedOnLaunch = true;
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    }


    private static func makePassiveSpecialSheetsIsolationFlagScript() -> WKUserScript {
        let source = """
        (function() {
          window.__ccThermalAudioIsolationAvailable = true;
          window.__ccThermalAudioSuppressedOnLaunch = true;
          window.__ccThermalSpecialSheetsSuppressedOnLaunch = true;
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    }


    private static func makePassivePixiCadenceIsolationFlagScript() -> WKUserScript {
        let source = """
        (function() {
          window.__ccThermalPixiActiveFpsCap = 30;
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    }

    private static func makePassivePixiResolutionIsolationFlagScript() -> WKUserScript {
        let source = """
        (function() {
          window.__ccThermalPixiResolutionCap = 1;
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    }

    // MARK: - WKNavigationDelegate

    private static func isTrustedGameURL(_ url: URL) -> Bool {
        if !useDevServer {
            return url.scheme == "app" && url.host == "localhost"
        }

        guard
            let configuredURL = URL(string: devServerURL),
            url.scheme == configuredURL.scheme,
            url.host == configuredURL.host,
            url.port == configuredURL.port
        else {
            return false
        }
        return true
    }

    private static func isExternalHTTPSURL(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https"
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if Self.isTrustedGameURL(url) {
            decisionHandler(.allow)
            return
        }

        let isExplicitExternalLink = navigationAction.navigationType == .linkActivated
            || navigationAction.targetFrame == nil
        if isExplicitExternalLink && Self.isExternalHTTPSURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        } else {
            print("⛔️ Blocked untrusted WebView navigation: \(url.absoluteString)")
        }
        decisionHandler(.cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // Keep one bounded record even without a console attached. This public
        // callback reports termination, not whether the OS used jetsam.
        let payload: [String: Any] = [
            "at": Date().timeIntervalSince1970,
            "nativePID": ProcessInfo.processInfo.processIdentifier,
            "url": String((webView.url?.absoluteString ?? "<unknown>").prefix(512)),
            "version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
            "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
            "thermalState": Self.thermalStateName(ProcessInfo.processInfo.thermalState),
            "lastMemoryWarningAt": lastMemoryWarningAt ?? -1
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let record = String(data: data, encoding: .utf8) else { return }
        UserDefaults.standard.set(record, forKey: Self.webContentIncidentKey)
        print("[CC_WEB_CONTENT_INCIDENT] terminated \(record)")
        // Do not hide the incident with an automatic reload or alter save state.
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("🌐 WebView didStart navigation: \(webView.url?.absoluteString ?? "<pending>")")
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        print("🌐 WebView didCommit navigation: \(webView.url?.absoluteString ?? "<unknown>")")
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("❌ WebView error: \(error.localizedDescription)")
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print(Self.useDevServer ? "✅ WebView finished loading dev server version" : "✅ WebView finished loading bundled local version")
    }

    // MARK: - WKScriptMessageHandler (Haptic Feedback)
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "jimiHomeHub", let event = message.body as? [String: Any] {
            jimiHomeHub?.receive(event)
            return
        }

        if message.name == "consoleLog" {
            let body = message.body as? [String: Any]
            let level = body?["level"] as? String ?? "log"
            let text = body?["message"] as? String ?? ""
            print("🧪 JS console[\(level)]: \(text)")
            // Retain diagnostic phase/frame receipts when the Wi-Fi console drops.
            // Reuse the bounded thermal file and existing cadence; no new timer.
            if Self.nativeThermalTelemetryEnabled,
               text.utf8.count <= 32_768,
               ["[CC_THERMAL_ISOLATION]", "[CC_SOAK]"].contains(where: { text.hasPrefix($0) }),
               let data = try? JSONSerialization.data(withJSONObject: [
                   "source": "web", "wall": Int((Date().timeIntervalSince1970 * 1000).rounded()),
                   "systemUptimeSeconds": ProcessInfo.processInfo.systemUptime, "message": text
               ], options: [.sortedKeys]),
               let json = String(data: data, encoding: .utf8) {
                persistNativeThermalSample(json)
            }
            return
        }

        // Parse haptic parameters from message body
        let body = message.body as? [String: Any]
        let style = body?["style"] as? String ?? "medium"
        
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if message.name == "hapticImpact" {
                self.hapticImpactRequestCount += 1
                if Self.hapticIsolationEnabled {
                    self.hapticSuppressedRequestCount += 1
                    return
                }
                let generator = self.impactFeedbackGenerators[style]
                    ?? self.impactFeedbackGenerators["medium"]!
                generator.impactOccurred()
            } else if message.name == "hapticSelection" {
                self.hapticSelectionRequestCount += 1
                if Self.hapticIsolationEnabled {
                    self.hapticSuppressedRequestCount += 1
                    return
                }
                self.selectionFeedbackGenerator.selectionChanged()
            } else if message.name == "hapticNotification" {
                self.hapticNotificationRequestCount += 1
                if Self.hapticIsolationEnabled {
                    self.hapticSuppressedRequestCount += 1
                    return
                }
                let notifType: UINotificationFeedbackGenerator.FeedbackType
                switch style {
                case "success":
                    notifType = .success
                case "warning":
                    notifType = .warning
                case "error":
                    notifType = .error
                default:
                    notifType = .success
                }
                self.notificationFeedbackGenerator.notificationOccurred(notifType)
            }
        }
    }
    
    // MARK: - WKUIDelegate

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else {
            return nil
        }

        if Self.isTrustedGameURL(url) {
            webView.load(navigationAction.request)
        } else if Self.isExternalHTTPSURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        } else {
            print("⛔️ Blocked untrusted new-window request: \(url.absoluteString)")
        }
        return nil
    }

    deinit {
        let retiringMusic = jimiMusic
        Task { @MainActor in retiringMusic?.dispose() }
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "jimiMusic", contentWorld: .page)

        stopNativeAudioLifecycle()
        stopNativeThermalTelemetry()
        let controller = webView?.configuration.userContentController
        controller?.removeScriptMessageHandler(forName: "hapticImpact")
        controller?.removeScriptMessageHandler(forName: "hapticSelection")
        controller?.removeScriptMessageHandler(forName: "hapticNotification")
        if Self.performanceDiagnosticsEnabled {
            controller?.removeScriptMessageHandler(forName: "consoleLog")
        }
    }
}
