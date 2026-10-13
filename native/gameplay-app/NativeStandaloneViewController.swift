import UIKit
import StackToSixNativeState

/// Native application root. Archived hybrid shell is not a runtime fallback.
/// Normal storyboard launches own the complete native gameplay graph.
@MainActor final class NativeStandaloneViewController:UIViewController {
    private var bootstrap:NativeBootstrap?
    private var resourceRoot:URL?
    private var store:NativeSaveStore?
    private let sourceTransportEnabled:Bool
    private let sourceFreshTutorialEnabled:Bool
    private let sourceOrdinaryPresentationEnabled:Bool
    private let sourceDirectPresentationEnabled:Bool
    private let sourceFreshOrdinaryEnabled:Bool
    private let sourceOrdinaryResumeEnabled:Bool
    private let sourceMagnetPresentationEnabled:Bool
    private let sourceOrdinaryEndgamePresentationEnabled:Bool
    private let sourceTntPresentationEnabled:Bool
    private let completeNativeGameplayEnabled:Bool
    private let sourceVisualRandom:()->Double
    private(set) var sourceRuntime:NativeSourceApplicationRuntime?
    private let diagnosticsArguments:[String]?
    private let diagnosticsPreference:Bool?
    private let diagnosticsDirectory:URL?
    private(set) var diagnostics:NativeDiagnosticsCapture?
    private(set) var disposed=false
    override var prefersStatusBarHidden:Bool {true}
    init(resourceRoot:URL?=nil,store:NativeSaveStore?=nil,diagnosticsArguments:[String]?=nil,diagnosticsPreference:Bool?=nil,diagnosticsDirectory:URL?=nil,sourceTransportEnabled:Bool=false,sourceFreshTutorialEnabled:Bool=false,sourceOrdinaryPresentationEnabled:Bool=false,sourceDirectPresentationEnabled:Bool=false,sourceFreshOrdinaryEnabled:Bool=false,sourceOrdinaryResumeEnabled:Bool=false,sourceMagnetPresentationEnabled:Bool=false,sourceTntPresentationEnabled:Bool=false,sourceOrdinaryEndgamePresentationEnabled:Bool=false,sourceVisualRandom:@escaping()->Double={Double.random(in:0..<1)},completeNativeGameplayEnabled:Bool=false) {
        self.resourceRoot=resourceRoot;self.store=store;self.sourceVisualRandom=sourceVisualRandom
        self.completeNativeGameplayEnabled=completeNativeGameplayEnabled
        self.sourceTransportEnabled=completeNativeGameplayEnabled || sourceTransportEnabled || sourceFreshTutorialEnabled || sourceFreshOrdinaryEnabled || sourceOrdinaryResumeEnabled
        self.sourceFreshTutorialEnabled=completeNativeGameplayEnabled || sourceFreshTutorialEnabled
        self.sourceOrdinaryPresentationEnabled=completeNativeGameplayEnabled || sourceOrdinaryPresentationEnabled
        self.sourceDirectPresentationEnabled=completeNativeGameplayEnabled || sourceDirectPresentationEnabled
        self.sourceFreshOrdinaryEnabled=completeNativeGameplayEnabled || sourceFreshOrdinaryEnabled
        self.sourceOrdinaryResumeEnabled=completeNativeGameplayEnabled || sourceOrdinaryResumeEnabled
        self.sourceMagnetPresentationEnabled=completeNativeGameplayEnabled || sourceMagnetPresentationEnabled
        self.sourceOrdinaryEndgamePresentationEnabled=completeNativeGameplayEnabled || sourceOrdinaryEndgamePresentationEnabled
        self.sourceTntPresentationEnabled=completeNativeGameplayEnabled || sourceTntPresentationEnabled
        self.diagnosticsArguments=diagnosticsArguments;self.diagnosticsPreference=diagnosticsPreference;self.diagnosticsDirectory=diagnosticsDirectory
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder:NSCoder){
        // Hosted unit fixtures acquire their own exact app transport. The
        // separately launched UI app uses the same defaults as ordinary play.
        #if DEBUG
        let hostedUnitTests=NSClassFromString("XCTestCase") != nil || NSClassFromString("XCTest.XCTestCase") != nil
        #else
        let hostedUnitTests=false
        #endif
        let nativeGameplay = !hostedUnitTests
        completeNativeGameplayEnabled=nativeGameplay
        sourceVisualRandom={Double.random(in:0..<1)}
        sourceFreshOrdinaryEnabled=nativeGameplay
        sourceOrdinaryResumeEnabled=nativeGameplay
        sourceMagnetPresentationEnabled=nativeGameplay
        sourceTntPresentationEnabled=nativeGameplay;sourceOrdinaryEndgamePresentationEnabled=nativeGameplay
        sourceTransportEnabled=nativeGameplay;sourceFreshTutorialEnabled=nativeGameplay
        sourceOrdinaryPresentationEnabled=nativeGameplay;sourceDirectPresentationEnabled=nativeGameplay
        diagnosticsArguments=nil;diagnosticsPreference=nil;diagnosticsDirectory=nil;super.init(coder:coder)
    }
    override func loadView() {
        let root=UIView();root.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        view=root
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        guard !disposed,Bundle.main.bundleIdentifier=="com.taptapdesign.stacktosix.native" else{return}
        startDiagnosticsIfRequested()
        do {
            if sourceOrdinaryEndgamePresentationEnabled && (!sourceTransportEnabled || !sourceOrdinaryPresentationEnabled || !(sourceFreshOrdinaryEnabled || sourceOrdinaryResumeEnabled)) {
                throw NativeSaveError.invalidState(["source-ordinary-endgame-dependencies-unavailable"])
            }
            if sourceTntPresentationEnabled && (!sourceTransportEnabled || !sourceOrdinaryPresentationEnabled || !sourceDirectPresentationEnabled || !(sourceFreshOrdinaryEnabled || sourceOrdinaryResumeEnabled)) {
                throw NativeSaveError.invalidState(["source-tnt-root-dependencies-unavailable"])
            }
            if sourceTransportEnabled {
                guard let runtime=NativeSourceApplicationRuntime.acquire(visualRandom:sourceVisualRandom) else {
                    throw NSError(domain:"StackToSixNative",code:2,userInfo:[NSLocalizedDescriptionKey:"Native animation transport is busy"])
                }
                sourceRuntime=runtime
            }
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
            let owner=try NativeBootstrap(root:root,store:store,sourceContext:sourceRuntime?.context)
            if sourceFreshTutorialEnabled {
                owner.sourceInitialFreshStartupEnabled=true;owner.sourceBoardEntryEnabled=true
                owner.sourceTutorialActivationEnabled=true;owner.sourceTutorialIntroEnabled=true
                owner.sourceTutorialHUDEnabled=true;owner.sourceTutorialFirstStepMonitorEnabled=true
                owner.sourceTutorialSubsequentPresentationEnabled=true
                owner.sourceTutorialEarnedMeterEnabled=true;owner.sourceLogicalMathRandomEnabled=true
                owner.sourceSpecialIdlePresentationEnabled=true
                owner.sourceOrdinaryPresentationEnabled=sourceOrdinaryPresentationEnabled
                owner.sourceDirectPresentationEnabled=sourceDirectPresentationEnabled
            }
            if sourceFreshOrdinaryEnabled || sourceOrdinaryResumeEnabled {
                owner.sourceFreshOrdinaryPresentationEnabled=true
                owner.sourceInitialFreshStartupEnabled=true;owner.sourceBoardEntryEnabled=true
                owner.sourceLogicalMathRandomEnabled=true;owner.sourceSpecialIdlePresentationEnabled=true
                owner.sourceOrdinaryPresentationEnabled=sourceOrdinaryPresentationEnabled
                owner.sourceDirectPresentationEnabled=sourceDirectPresentationEnabled
                owner.sourceMagnetPresentationEnabled=sourceMagnetPresentationEnabled
                owner.sourceOrdinaryEndgamePresentationEnabled=sourceOrdinaryEndgamePresentationEnabled
                owner.sourceTntPresentationEnabled=sourceTntPresentationEnabled
                owner.sourceRestoredOrdinaryPresentationEnabled=sourceOrdinaryResumeEnabled
                owner.sourceInitialRegularResumeEnabled=sourceOrdinaryResumeEnabled
                owner.sourceInitialWildResumeEnabled=sourceOrdinaryResumeEnabled
            }
            owner.completeNativeGameplayEnabled=completeNativeGameplayEnabled
            owner.sourceCanonicalGameplaySaveEnabled=completeNativeGameplayEnabled
            owner.sourceWildShimmerPresentationEnabled=completeNativeGameplayEnabled
            bootstrap=owner;owner.start(in:self)
        } catch {
            sourceRuntime?.dispose();sourceRuntime=nil
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
        sourceRuntime?.dispose();sourceRuntime=nil
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
            var payload:[String:Any] = ["thermalState":thermal,"lowPowerMode":process.isLowPowerModeEnabled,
                "batteryPercent":device.batteryLevel>=0 ? Int((device.batteryLevel*100).rounded()):-1,
                "batteryState":device.batteryState.rawValue,
                "brightnessPercent":self?.view.window.map{Int(($0.screen.brightness*100).rounded())} ?? -1,
                "activeProcessorCount":process.activeProcessorCount,"systemUptimeSeconds":Int(process.systemUptime),
                "appVersion":Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "unknown",
                "appBuild":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "unknown",
                "product":Bundle.main.bundleIdentifier ?? "unknown","performanceDiagnosticsEnabled":performanceEnabled,
                "nativeThermalTelemetryEnabled":true,
                "nativeRoute":self?.bootstrap?.diagnosticRoute ?? "unmounted"]
            if performanceEnabled {
                payload["renderResources"]=NativeDiagnosticsRenderCensus.capture(root:self?.viewIfLoaded)
            }
            return payload
        })
        diagnostics=owner;owner.start(foreground:UIApplication.shared.applicationState == .active)
    }
}

#if DEBUG && targetEnvironment(simulator)
/// Actual OS Source-entry proof is admitted only with an isolated QA profile.
/// Release and ordinary icon launches retain the current migration checkpoint.
enum NativeSimulatorSourceQA {
    static func admittedOrdinary(environment:[String:String],bundleIdentifier:String?)->Bool {
        environment["CC_NATIVE_QA_SOURCE_ORDINARY"]=="1" && admitted(environment:environment,bundleIdentifier:bundleIdentifier)
    }
    static func admittedDirect(environment:[String:String],bundleIdentifier:String?)->Bool {
        environment["CC_NATIVE_QA_SOURCE_DIRECT"]=="1" && admittedOrdinary(environment:environment,bundleIdentifier:bundleIdentifier)
    }
    static func admitted(environment:[String:String],bundleIdentifier:String?)->Bool {
        environment["CC_NATIVE_QA_SOURCE_FRESH_TUTORIAL"]=="1" &&
        NativeSimulatorQAProfile.directory(environment:environment,bundleIdentifier:bundleIdentifier,
            temporaryDirectory:FileManager.default.temporaryDirectory) != nil
    }
}
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
