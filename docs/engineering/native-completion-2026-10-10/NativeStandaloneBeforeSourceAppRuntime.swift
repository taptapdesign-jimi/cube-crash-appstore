import UIKit
import StackToSixNativeState

/// Native application root. Archived hybrid shell is not a runtime fallback.
/// Storyboard admission remains separate from this connected, testable root.
@MainActor final class NativeStandaloneViewController:UIViewController {
    private var bootstrap:NativeBootstrap?
    private var resourceRoot:URL?
    private var store:NativeSaveStore?
    private let diagnosticsArguments:[String]?
    private let diagnosticsPreference:Bool?
    private let diagnosticsDirectory:URL?
    private(set) var diagnostics:NativeDiagnosticsCapture?
    private(set) var disposed=false
    init(resourceRoot:URL?=nil,store:NativeSaveStore?=nil,diagnosticsArguments:[String]?=nil,diagnosticsPreference:Bool?=nil,diagnosticsDirectory:URL?=nil) {
        self.resourceRoot=resourceRoot;self.store=store
        self.diagnosticsArguments=diagnosticsArguments;self.diagnosticsPreference=diagnosticsPreference;self.diagnosticsDirectory=diagnosticsDirectory
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder:NSCoder){diagnosticsArguments=nil;diagnosticsPreference=nil;diagnosticsDirectory=nil;super.init(coder:coder)}
    override func loadView() {
        let root=UIView();root.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        view=root
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        guard !disposed,Bundle.main.bundleIdentifier=="com.taptapdesign.stacktosix.native" else{return}
        startDiagnosticsIfRequested()
        do {
            guard let root=resourceRoot ?? Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle") else {
                throw NSError(domain:"StackToSixNative",code:1,userInfo:[NSLocalizedDescriptionKey:"Native artwork is missing"])
            }
            #if DEBUG && targetEnvironment(simulator)
            if store==nil,let directory=NativeSimulatorQAProfile.directory(
                environment:ProcessInfo.processInfo.environment,
                bundleIdentifier:Bundle.main.bundleIdentifier,
                temporaryDirectory:FileManager.default.temporaryDirectory) {
                store=try NativeSimulatorQAProfile.prepare(directory:directory)
            }
            #endif
            let owner=try NativeBootstrap(root:root,store:store)
            bootstrap=owner;owner.start(in:self)
        } catch {
            let label=UILabel();label.numberOfLines=0;label.textAlignment = .center
            label.textColor = .systemRed;label.text=error.localizedDescription
            label.frame=view.bounds.insetBy(dx:24,dy:80);label.autoresizingMask=[.flexibleWidth,.flexibleHeight]
            view.addSubview(label)
        }
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        diagnostics?.dispose();diagnostics=nil
        bootstrap?.dispose();bootstrap=nil;store=nil;resourceRoot=nil
    }
    isolated deinit {dispose()}
    private func startDiagnosticsIfRequested() {
        let arguments=diagnosticsArguments ?? ProcessInfo.processInfo.arguments
        let preference=diagnosticsPreference ?? UserDefaults.standard.bool(forKey:"cc.performanceDiagnostics")
        guard NativeDiagnosticsCapture.admitted(arguments:arguments,
            bundleIdentifier:Bundle.main.bundleIdentifier,
            preferenceEnabled:preference) else{return}
        let performanceEnabled=preference || arguments.contains("--cc-performance-diagnostics")
        guard let directory=diagnosticsDirectory ?? FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask).first?.appendingPathComponent("NativeOnlyDiagnostics",isDirectory:true) else{return}
        let owner=NativeDiagnosticsCapture(directory:directory,snapshot:{[weak self] in
            let process=ProcessInfo.processInfo,device=UIDevice.current
            let thermal:String
            switch process.thermalState {
            case .nominal:thermal="nominal"
            case .fair:thermal="fair"
            case .serious:thermal="serious"
            case .critical:thermal="critical"
            @unknown default:thermal="unknown"
            }
            return ["thermalState":thermal,"lowPowerMode":process.isLowPowerModeEnabled,
                "batteryPercent":device.batteryLevel>=0 ? Int((device.batteryLevel*100).rounded()):-1,
                "batteryState":device.batteryState.rawValue,
                "brightnessPercent":self?.view.window.map{Int(($0.screen.brightness*100).rounded())} ?? -1,
                "activeProcessorCount":process.activeProcessorCount,"systemUptimeSeconds":Int(process.systemUptime),
                "appVersion":Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "unknown",
                "appBuild":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "unknown",
                "product":Bundle.main.bundleIdentifier ?? "unknown","performanceDiagnosticsEnabled":performanceEnabled,
                "nativeThermalTelemetryEnabled":true]
        })
        diagnostics=owner;owner.start(foreground:UIApplication.shared.applicationState == .active)
    }
}

#if DEBUG && targetEnvironment(simulator)
/// Stable isolated QA profile across OS launches. No normal profile fallback,
/// migration or reset is permitted by this private Simulator capability.
enum NativeSimulatorQAProfile {
    static func directory(environment:[String:String],bundleIdentifier:String?,temporaryDirectory:URL)->URL? {
        guard bundleIdentifier=="com.taptapdesign.stacktosix.native",
            environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A",
            let raw=environment["CC_NATIVE_QA_PROFILE_ID"],let id=UUID(uuidString:raw) else{return nil}
        return temporaryDirectory.appendingPathComponent("native-process-qa-\(id.uuidString)",isDirectory:true)
    }
    static func prepare(directory:URL)throws->NativeSaveStore {
        let store=NativeSaveStore(directory:directory)
        if try store.load()==nil {
            try store.save(NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false)))
        }
        return store
    }
}
#endif
