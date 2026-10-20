import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// Native Settings DEV commands are admitted by the app
/// route owner; the panel itself has no save or gameplay authority.
enum NativeDeveloperAction: String, CaseIterable {
    case show, hide, legendary, reset, newCard = "new-card", clean = "clean-board", lastMerge = "last-merge"
    var title: String {
        switch self {
        case .show: return "Show Card"
        case .hide: return "Hide Card"
        case .legendary: return "Legendary Card"
        case .reset: return "Reset Stage"
        case .newCard: return "New Card"
        case .clean: return "Clean Stage"
        case .lastMerge: return "LAST MERGE"
        }
    }
}

/// Static, scrollable picker with one explicit commit; no polling or media.
@MainActor
final class NativeDeveloperPicker: UIViewController {
    struct Choice { let title: String; let value: String }
    private let choices: [Choice], multiple: Bool, artwork: JimiV9Artwork
    private var selected: Set<String> = []
    private let card = UIView(), scroll = UIScrollView(), heading = UILabel()
    private let confirm = JimiV9PlainButton(type: .custom), cancel = JimiV9PlainButton(type: .custom)
    private var buttons: [JimiV9PlainButton] = []
    private var resolved = false
    var onSelect: ((Set<String>) -> Void)?
    init(root: URL, title: String, choices: [Choice], multiple: Bool) {
        self.choices = choices; self.multiple = multiple; artwork = JimiV9Artwork(resourceRoot: root)
        super.init(nibName: nil, bundle: nil); heading.text = title; modalPresentationStyle = .overFullScreen
    }
    required init?(coder: NSCoder) { fatalError("Use Developer picker initializer") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = UIColor.black.withAlphaComponent(0.45)
        card.backgroundColor = NativeAppPaperSurface.base; card.layer.cornerRadius = 24
        view.addSubview(card); card.addSubview(scroll); card.addSubview(heading)
        heading.font = artwork.font(size: 24, weight: "ExtraBold"); heading.textAlignment = .center
        heading.textColor = UIColor(red: 173/255, green: 135/255, blue: 117/255, alpha: 1)
        for (index, choice) in choices.enumerated() {
            let button = JimiV9PlainButton(type: .custom)
            button.tag = index; button.setTitle(choice.title, for: .normal)
            button.titleLabel?.font = artwork.font(size: 16, weight: "Medium")
            button.layer.cornerRadius = 12; button.layer.borderWidth = 1
            button.accessibilityIdentifier = "native.developer.choice.\(choice.value)"
            button.addTarget(self, action: #selector(selectChoice(_:)), for: .touchUpInside)
            scroll.addSubview(button); buttons.append(button)
        }
        confirm.setTitle("OK", for: .normal); cancel.setTitle("Cancel", for: .normal)
        for button in [confirm, cancel] {
            button.titleLabel?.font = artwork.font(size: 18, weight: "Medium"); card.addSubview(button)
            button.layer.cornerRadius = 12; button.backgroundColor = UIColor.white.withAlphaComponent(0.7)
            button.setTitleColor(heading.textColor, for: .normal)
        }
        confirm.accessibilityIdentifier = "native.developer.confirm"
        cancel.accessibilityIdentifier = "native.developer.cancel"
        confirm.addTarget(self, action: #selector(commit), for: .touchUpInside)
        cancel.addTarget(self, action: #selector(close), for: .touchUpInside); paint()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let height = min(600, view.bounds.height-view.safeAreaInsets.top-view.safeAreaInsets.bottom-32)
        card.frame = CGRect(x: 24, y: max(view.safeAreaInsets.top+16,(view.bounds.height-height)/2), width: view.bounds.width-48, height: height)
        heading.frame = CGRect(x: 16, y: 16, width: card.bounds.width-32, height: 40)
        scroll.frame = CGRect(x: 16, y: 72, width: card.bounds.width-32, height: height-152)
        let width = (scroll.bounds.width-8)/2
        for (index, button) in buttons.enumerated() {
            button.frame = CGRect(x: CGFloat(index%2)*(width+8), y: CGFloat(index/2)*52, width: width, height: 44)
        }
        scroll.contentSize = CGSize(width: scroll.bounds.width, height: CGFloat((buttons.count+1)/2)*52)
        confirm.frame = CGRect(x: 16,y: height-64,width: width,height: 48)
        cancel.frame = CGRect(x: 24+width,y: height-64,width: width,height: 48)
    }
    @objc private func selectChoice(_ sender: JimiV9PlainButton) {
        guard !resolved, choices.indices.contains(sender.tag) else { return }
        let value = choices[sender.tag].value
        if selected.contains(value) { selected.remove(value) }
        else { if !multiple { selected.removeAll() }; selected.insert(value) }
        paint()
    }
    private func paint() {
        let orange = UIColor(red: 232/255,green: 116/255,blue: 74/255,alpha: 1)
        for (index,button) in buttons.enumerated() {
            let active = selected.contains(choices[index].value)
            button.backgroundColor = active ? orange : UIColor.white.withAlphaComponent(0.6)
            button.setTitleColor(active ? .white : heading.textColor, for: .normal)
            button.layer.borderColor = (active ? orange : heading.textColor!).cgColor
            button.accessibilityTraits = active ? [.button,.selected] : [.button]
        }
        confirm.isEnabled = !selected.isEmpty; confirm.alpha = confirm.isEnabled ? 1 : 0.4
    }
    @objc private func commit() {
        guard !resolved, !selected.isEmpty else { return }; resolved = true
        let callback = onSelect, values = selected; onSelect = nil
        dismiss(animated: false) { callback?(values) }
    }
    @objc private func close() { dispose() }
    func dispose() { guard !resolved else { return }; resolved = true; onSelect = nil; dismiss(animated: false) }
}

/// An isolated Native profile hosts LAST MERGE through the shipping gameplay
/// assembly. Closing destroys the entire preview and its temporary save.
@MainActor
final class NativeDeveloperGameplayHost: UIViewController {
    let bootstrap: NativeBootstrap
    private let directory: URL, board: Int
    private let close = JimiV9PlainButton(type: .custom)
    private var closed = false
    init(bootstrap: NativeBootstrap, directory: URL, board: Int) {
        self.bootstrap = bootstrap; self.directory = directory; self.board = board
        super.init(nibName: nil, bundle: nil); modalPresentationStyle = .fullScreen
    }
    required init?(coder: NSCoder) { fatalError("Use Developer gameplay initializer") }
    override func viewDidLoad() {
        super.viewDidLoad(); bootstrap.start(in: self); bootstrap.launchDeveloperBoard(board)
        close.setTitle("Close DEV", for: .normal); close.setTitleColor(.white, for: .normal)
        close.backgroundColor = UIColor(red: 232/255,green: 116/255,blue: 74/255,alpha: 1); close.layer.cornerRadius = 12
        close.accessibilityIdentifier = "native.developer.close-gameplay"
        close.addTarget(self, action: #selector(finish), for: .touchUpInside); view.addSubview(close)
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews(); close.frame = CGRect(x: view.bounds.width-124, y: view.safeAreaInsets.top+8, width: 112, height: 40)
        view.bringSubviewToFront(close)
    }
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed { cleanup() }
    }
    @objc func finish() {
        guard !closed else { return }; cleanup(); dismiss(animated: false)
    }
    private func cleanup() {
        guard !closed else { return }; closed = true; bootstrap.dispose()
        try? FileManager.default.removeItem(at: directory)
    }
}

/// Developer previews can always be closed, including failed resource loads.
/// The underlying authored screen keeps its existing lifecycle ownership.
@MainActor
final class NativeDeveloperPreviewHost: UIViewController {
    private let preview: UIViewController
    private var release: (() -> Void)?
    private let close = JimiV9PlainButton(type: .custom)
    private var closed = false
    init(preview: UIViewController, release: @escaping () -> Void) {
        self.preview = preview; self.release = release
        super.init(nibName: nil,bundle: nil); modalPresentationStyle = .overFullScreen
    }
    required init?(coder: NSCoder) { fatalError("Use Developer preview initializer") }
    override func viewDidLoad() {
        super.viewDidLoad(); addChild(preview); preview.view.frame = view.bounds
        preview.view.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        view.addSubview(preview.view); preview.didMove(toParent: self)
        close.setTitle("Close DEV",for: .normal); close.setTitleColor(.white,for: .normal)
        close.backgroundColor = UIColor(red: 232/255,green: 116/255,blue: 74/255,alpha: 1); close.layer.cornerRadius = 12
        close.accessibilityIdentifier = "native.developer.close-preview"
        close.addTarget(self,action: #selector(finish),for: .touchUpInside); view.addSubview(close)
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews(); close.frame = CGRect(x: view.bounds.width-124,y: view.safeAreaInsets.top+8,width: 112,height: 40)
    }
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated); if isBeingDismissed { cleanup() }
    }
    @objc func finish() { guard !closed else { return }; cleanup(); dismiss(animated: false) }
    private func cleanup() {
        guard !closed else { return }; closed = true
        let callback = release; release = nil; callback?()
        preview.willMove(toParent: nil); preview.view.removeFromSuperview(); preview.removeFromParent()
    }
}
