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
