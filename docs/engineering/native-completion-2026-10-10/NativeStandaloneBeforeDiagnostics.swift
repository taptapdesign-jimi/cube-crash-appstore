import UIKit
import StackToSixNativeState

/// Native application root. Archived hybrid shell is not a runtime fallback.
/// Storyboard admission remains separate from this connected, testable root.
@MainActor final class NativeStandaloneViewController:UIViewController {
    private var bootstrap:NativeBootstrap?
    private var resourceRoot:URL?
    private var store:NativeSaveStore?
    private(set) var disposed=false
    init(resourceRoot:URL?=nil,store:NativeSaveStore?=nil) {
        self.resourceRoot=resourceRoot;self.store=store
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder:NSCoder){super.init(coder:coder)}
    override func loadView() {
        let root=UIView();root.backgroundColor=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        view=root
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        guard !disposed,Bundle.main.bundleIdentifier=="com.taptapdesign.stacktosix.native" else{return}
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
        bootstrap?.dispose();bootstrap=nil;store=nil;resourceRoot=nil
    }
    isolated deinit {dispose()}
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
