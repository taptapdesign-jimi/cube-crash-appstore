import UIKit

/// UIKit presentation only. The existing web settings/save owner supplies every
/// value and accepts mutations; this view never creates a preference store.
@MainActor
final class JimiNativeSettingsView: UIView {
    var onBack: (() -> Void)?
    var onDeveloperClose: (() -> Void)?
    var onPreference: ((String, Bool, Int) -> Void)?
    var onPrivacy: (() -> Void)?
    var onDeveloper: ((Int) -> Void)?
    var onDeveloperAction: ((NativeDeveloperAction, Int) -> Void)?
    private(set) var developerButtons: [JimiV9PlainButton] = []
    private let assets: JimiV9Artwork
    let header = JimiV9NavigationHeader(frame:.zero)
    let footer = UIView()
    let scroll = UIScrollView()
    let back = JimiV9PlainButton(type: .custom)
    let developer = JimiV9PlainButton(type: .custom)
    private let developerSummary = UILabel()
    let firstPlay = JimiV9PlainButton(type: .custom)
    private(set) var developerPanelVisible = false
    private(set) var rows: [UIView] = []
    private(set) var dividers: [UIView] = []
    private(set) var switches: [JimiNativeSettingsToggle] = []
    private var statuses: [UILabel] = []
    private var descriptions: [UILabel] = []
    private let title = UILabel()
    private let footerCopy = UILabel()
    private let privacy = JimiV9PlainButton(type: .custom)
    private(set) var presentationEpoch = -1
    private(set) var snapshot: [String: Any] = [:]
    private let keys = ["gameSoundsEnabled", "musicEnabled", "hapticsEnabled"]
    private let labels = ["Game sounds", "Music", "Vibration"]
    private let ink = UIColor(red: 153/255, green: 103/255, blue: 84/255, alpha: 1)
    private let accent = UIColor(red: 232/255, green: 116/255, blue: 74/255, alpha: 1)

    init(frame: CGRect, assets: JimiV9Artwork) {
        self.assets = assets
        super.init(frame: frame)
        accessibilityIdentifier = "native.settings"
        addSubview(header); addSubview(scroll); addSubview(footer)
        header.backgroundColor = UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.8)
        // Padding belongs to the rows, never to a clipping animation viewport.
        clipsToBounds = false; scroll.clipsToBounds = false
        scroll.alwaysBounceVertical = false
        scroll.showsVerticalScrollIndicator = false
        title.text = "Settings"; title.font = assets.font(size: 28); title.textColor = ink
        title.textAlignment = .center; header.addSubview(title)
        back.setImage(assets.image("assets/chevron-back.png"), for: .normal)
        back.imageView?.contentMode = .scaleAspectFit
        back.imageEdgeInsets = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        back.setTitleColor(ink, for: .normal)
        back.accessibilityLabel = "Go back to home"; back.accessibilityIdentifier = "native.settings.back"
        back.addTarget(self, action: #selector(goBack), for: .touchUpInside); header.addSubview(back)
        developer.setImage(assets.image("assets/nav/settings-nav.png"), for: .normal)
        developer.imageView?.contentMode = .scaleAspectFit
        developer.imageEdgeInsets = UIEdgeInsets(top: 9,left: 9,bottom: 9,right: 9)
        developer.accessibilityLabel = "Open developer tools"; developer.accessibilityIdentifier = "native.settings.developer"
        developer.addTarget(self, action: #selector(openDeveloper), for: .touchUpInside); header.addSubview(developer)
        developerSummary.numberOfLines = 0; developerSummary.font = assets.font(size: 20,weight: "Medium")
        developerSummary.textColor = ink; developerSummary.accessibilityIdentifier = "native.settings.developer.summary"
        developerSummary.isHidden = true; scroll.addSubview(developerSummary)
        firstPlay.titleLabel?.font = assets.font(size: 20,weight: "Medium"); firstPlay.setTitleColor(accent,for: .normal)
        firstPlay.accessibilityIdentifier = "native.settings.developer.first-play"
        firstPlay.addTarget(self,action: #selector(toggleFirstPlay),for: .touchUpInside)
        firstPlay.isHidden = true; scroll.addSubview(firstPlay);firstPlay.enableCartoonBounce()
        for action in NativeDeveloperAction.allCases {
            let button = JimiV9PlainButton(type: .custom)
            button.setTitle(action.title, for: .normal)
            button.titleLabel?.numberOfLines = 2; button.titleLabel?.textAlignment = .center
            let palette: (UInt32,UInt32)
            switch action {
            case .hide: palette = (0xAD8775,0x8D6E61)
            case .legendary: palette = (0xD6A13D,0xA87824)
            case .reset: palette = (0x735C4C,0x5A4639)
            case .newCard: palette = (0xF35F37,0xC64A2A)
            case .clean: palette = (0xE9A03A,0xBD7627)
            default: palette = (0xE8744A,0xC95E39)
            }
            styleDeveloperButton(button,fill: palette.0,depth: palette.1)
            button.tag = developerButtons.count
            button.accessibilityIdentifier = "native.settings.developer.\(action.rawValue)"
            button.addTarget(self, action: #selector(activateDeveloperAction(_:)), for: .touchUpInside)
            button.isHidden = true; scroll.addSubview(button);button.enableCartoonBounce(); developerButtons.append(button)
        }
        for i in keys.indices {
            let row = UIView(); scroll.addSubview(row); rows.append(row)
            let status = UILabel(); status.font = assets.font(size: 32, weight: "ExtraBold"); status.textColor = UIColor(red: 232/255, green: 116/255, blue: 74/255, alpha: 1)
            status.accessibilityIdentifier = "native.settings.status.\(keys[i])"
            row.addSubview(status); statuses.append(status)
            let label = UILabel(); label.text = labels[i]; label.font = assets.font(size: 20, weight: "Medium"); label.textColor = NativeTextPalette.subtitle
            row.addSubview(label); descriptions.append(label)
            let toggle = JimiNativeSettingsToggle(); toggle.tag = i; toggle.onTintColor = accent
            toggle.accessibilityLabel = labels[i]; toggle.accessibilityIdentifier = "native.settings.\(keys[i])"
            toggle.addTarget(self, action: #selector(changePreference(_:)), for: .valueChanged)
            row.addSubview(toggle); switches.append(toggle)
            if i < keys.count-1 {
                let divider = UIView(); divider.backgroundColor = ink.withAlphaComponent(0.08)
                scroll.addSubview(divider); dividers.append(divider)
            }
        }
        footerCopy.numberOfLines = 0; footerCopy.textAlignment = .center
        footerCopy.font = assets.font(size: 16); footerCopy.textColor = ink.withAlphaComponent(0.65)
        footerCopy.text = "Made with ❤️ in Croatia\nby Tap Tap Design\n\nVersion: 1.0"
        footer.addSubview(footerCopy)
        privacy.setTitle("Privacy Policy", for: .normal); privacy.titleLabel?.font = assets.font(size: 14)
        privacy.setTitleColor(ink, for: .normal); privacy.accessibilityIdentifier = "native.settings.privacy"
        privacy.addTarget(self, action: #selector(openPrivacy), for: .touchUpInside); footer.addSubview(privacy);privacy.enableCartoonBounce()
    }
    required init?(coder: NSCoder) { fatalError("Use init(frame:assets:)") }

    @discardableResult func apply(_ value: [String: Any]) -> Bool {
        guard let epoch = value["presentationEpoch"] as? Int, epoch >= 0,
              let sounds = value[keys[0]] as? Bool, let music = value[keys[1]] as? Bool,
              let haptics = value[keys[2]] as? Bool else { return false }
        let animateChanges = presentationEpoch == epoch && window != nil && !isHidden && !developerPanelVisible
        presentationEpoch = epoch; snapshot = value
        var changedStatuses: [UILabel] = []
        for (i, enabled) in [sounds, music, haptics].enumerated() {
            switches[i].setOn(enabled, animated: false)
            let text = enabled ? "ON" : "OFF"
            if statuses[i].text != text {
                if animateChanges && statuses[i].text != nil { changedStatuses.append(statuses[i]) }
                else { statuses[i].layer.removeAnimation(forKey: NativeHubBackpackFeedback.animationKey) }
                statuses[i].text = text
            }
        }
        developerSummary.attributedText = NSAttributedString(string: "DEV\nJourney card tools",attributes: [.font: assets.font(size: 18),.foregroundColor: NativeTextPalette.subtitle])
        let summary = NSMutableAttributedString(attributedString: developerSummary.attributedText!)
        summary.addAttributes([.font: assets.font(size: 28,weight: "ExtraBold"),.foregroundColor: accent],range: NSRange(location: 0,length: 3))
        developerSummary.attributedText = summary
        let firstPlayEnabled = value["firstPlayRequired"] as? Bool == true
        styleDeveloperButton(firstPlay,fill: firstPlayEnabled ? 0xF35F37 : 0xAD8775,depth: firstPlayEnabled ? 0xC64A2A : 0x8D6E61)
        firstPlay.setTitle("First Time Run \(value["firstPlayRequired"] as? Bool == true ? "ON" : "OFF")",for: .normal)
        setDeveloperPanelVisible(developerPanelVisible && value["developerToolsAvailable"] as? Bool == true)
        setNeedsLayout(); layoutIfNeeded()
        for label in changedStatuses {
            if UIAccessibility.isReduceMotionEnabled { label.layer.removeAnimation(forKey: NativeHubBackpackFeedback.animationKey) }
            else { NativeHubBackpackFeedback.play(on: label) }
        }
        return true
    }
    func setDeveloperPanelVisible(_ visible: Bool) {
        if visible { cancelStatusBounces() }
        developerPanelVisible = visible
        scroll.clipsToBounds = visible
        title.text = visible ? "Developer" : "Settings"
        developer.isHidden = visible || snapshot["developerToolsAvailable"] as? Bool != true
        developerSummary.isHidden = !visible
        firstPlay.isHidden = !visible
        for button in developerButtons { button.isHidden = !visible }
        for row in rows { row.isHidden = visible }
        for divider in dividers { divider.isHidden = visible }
        back.accessibilityLabel = visible ? "Back to settings" : "Go back to home"
        scroll.setContentOffset(.zero,animated: false)
        setNeedsLayout()
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        let top = safeAreaInsets.top
        let row=JimiV9NavigationHeader.RowLayout(bounds:bounds,safeAreaTop:top)
        let headerTop=row.top
        place(header, in: CGRect(x:0,y:0,width:bounds.width,height:headerTop+66))
        title.frame = row.titleFrame
        back.frame = row.buttonFrame(x:24)
        developer.frame = row.buttonFrame(x:bounds.width-68)
        let footerHeight: CGFloat = min(165, max(110,bounds.height*0.2))
        place(footer, in: CGRect(x: 24, y: bounds.height-safeAreaInsets.bottom-footerHeight, width: max(0,bounds.width-48), height: footerHeight))
        footerCopy.frame = CGRect(x: 0, y: 0, width: footer.bounds.width, height: footerHeight-40)
        privacy.setCartoonBounceFrame(CGRect(x: 0, y: footerHeight-44, width: footer.bounds.width, height: 44))
        scroll.frame = CGRect(x: 0, y: header.center.y+header.bounds.height/2, width: bounds.width, height: max(0,(footer.center.y-footer.bounds.height/2)-(header.center.y+header.bounds.height/2)))
        developerSummary.frame = CGRect(x: 24,y: 20,width: max(0,bounds.width-48),height: 64)
        let columns = bounds.width <= 374 ? 1 : 3
        let buttonWidth = max(0,(bounds.width-48-CGFloat(columns-1)*10)/CGFloat(columns))
        for (index,button) in developerButtons.enumerated() {
            button.titleLabel?.font = assets.font(size: columns == 1 ? 18 : 16,weight: "ExtraBold")
            button.setCartoonBounceFrame(CGRect(x: 24+CGFloat(index%columns)*(buttonWidth+10),y: 100+CGFloat(index/columns)*64,width: buttonWidth,height: 48))
            button.layer.shadowPath = UIBezierPath(roundedRect: button.bounds,cornerRadius: 18).cgPath
        }
        let firstPlayY = 100+CGFloat((developerButtons.count+columns-1)/columns)*64
        firstPlay.setCartoonBounceFrame(CGRect(x: 24,y: firstPlayY,width: max(0,bounds.width-48),height: 48))
        firstPlay.titleLabel?.font = assets.font(size: columns == 1 ? 18 : 16,weight: "ExtraBold")
        firstPlay.layer.shadowPath = UIBezierPath(roundedRect: firstPlay.bounds,cornerRadius: 18).cgPath
        for i in rows.indices {
            let rowWidth = max(0,scroll.bounds.width-48)
            place(rows[i], in: CGRect(x: 24, y: CGFloat(i)*126, width: rowWidth, height: 124))
            let statusWidth = min(max(0,rowWidth-83),ceil(statuses[i].sizeThatFits(CGSize(width: max(0,rowWidth-83),height: 36)).width))
            place(statuses[i], in: CGRect(x: 0, y: 31, width: statusWidth, height: 36))
            descriptions[i].frame = CGRect(x: 0, y: 67, width: max(0,rowWidth-83), height: 28)
            switches[i].frame = CGRect(x: max(0,rowWidth-67), y: 43, width: 67, height: 45)
            if i < dividers.count { place(dividers[i], in: CGRect(x: 24, y: CGFloat(i+1)*126-1, width: rowWidth, height: 2)) }
        }
        scroll.contentSize = CGSize(width: scroll.bounds.width, height: developerPanelVisible ? firstPlay.cartoonBounceFrame.maxY+32 : 378)
    }
    private func styleDeveloperButton(_ button: UIButton, fill: UInt32, depth: UInt32) {
        func color(_ value: UInt32) -> UIColor {
            UIColor(red: CGFloat((value >> 16) & 255)/255,green: CGFloat((value >> 8) & 255)/255,blue: CGFloat(value & 255)/255,alpha: 1)
        }
        button.setTitleColor(.white,for: .normal); button.backgroundColor = color(fill)
        button.layer.cornerRadius = 18; button.layer.shadowColor = color(depth).cgColor
        button.layer.shadowOpacity = 1; button.layer.shadowRadius = 0; button.layer.shadowOffset = CGSize(width: 0,height: 7)
    }
    // UIView.frame is undefined under a non-identity transform. The route owner
    // sets the final zero-scale model while CA paints the v10 exit; keep layout
    // independent from that model so each row retains its own collapse pivot.
    private func place(_ target: UIView, in rect: CGRect) {
        target.bounds = CGRect(origin: .zero, size: rect.size)
        target.center = CGPoint(x: rect.midX, y: rect.midY)
    }
    private func cancelStatusBounces() {
        for label in statuses { label.layer.removeAnimation(forKey: NativeHubBackpackFeedback.animationKey) }
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { cancelStatusBounces() }
    }
    override var isHidden: Bool {
        didSet { if isHidden { cancelStatusBounces() } }
    }
    func tracks(enter: Bool) -> [(UIView, JimiV9Motion.Track)] {
        if !enter { cancelStatusBounces() }
        var ordered: [UIView] = []
        for i in rows.indices { ordered.append(rows[i]); if i < dividers.count { ordered.append(dividers[i]) } }
        if enter { ordered.insert(header, at: 0); ordered.append(footer) }
        else { ordered.insert(footer, at: 0); ordered.reverse(); ordered.append(header) }
        return ordered.enumerated().map { i, target in
            let delay = enter ? (i == 0 ? 0 : 0.05+Double(i-1)*0.08) : Double(i)*0.04+(target === header ? 0.05 : 0)
            return (target, JimiV9Motion.Track(tweens: [JimiV9Motion.Tween(
                begin: UIAccessibility.isReduceMotionEnabled ? 0 : delay,
                duration: UIAccessibility.isReduceMotionEnabled ? 0.01 : (enter ? 0.5 : 0.34),
                from: .scale(enter ? 0 : 1, opacity: enter ? 0 : 1),
                to: .scale(enter ? 1 : 0, opacity: enter ? 1 : 0),
                ease: enter ? .backOut(1.7) : .backIn(1.7))]))
        }
    }
    @objc private func changePreference(_ sender: JimiNativeSettingsToggle) {
        guard keys.indices.contains(sender.tag) else { return }
        onPreference?(keys[sender.tag], sender.isOn, presentationEpoch)
    }
    @objc private func goBack() {
        NativeHubBackpackFeedback.play(on:back.imageView ?? back)
        if developerPanelVisible { onDeveloperClose?();setDeveloperPanelVisible(false) } else { onBack?() }
    }
    @objc private func openPrivacy() { onPrivacy?() }
    @objc private func openDeveloper() { NativeHubBackpackFeedback.play(on:developer.imageView ?? developer);onDeveloper?(presentationEpoch) }
    @objc private func activateDeveloperAction(_ sender: JimiV9PlainButton) {
        guard developerPanelVisible, snapshot["developerToolsAvailable"] as? Bool == true,
              NativeDeveloperAction.allCases.indices.contains(sender.tag) else { return }
        onDeveloperAction?(NativeDeveloperAction.allCases[sender.tag], presentationEpoch)
    }
    @objc private func toggleFirstPlay() {
        guard developerPanelVisible else{return}
        onPreference?("firstPlayRequired",snapshot["firstPlayRequired"] as? Bool != true,presentationEpoch)
    }
}

/// Native v10 centered paper modal; each transform has a separate lifecycle owner.
@MainActor
final class JimiNativePrivacyController: UIViewController {
    var onCloseRequested:(()->Void)?
    private let assets: JimiV9Artwork
    let card = UIView(), flip = JimiNativeModalTransformView(), idle = UIView(), paper = UIImageView()
    let copy = UITextView(), close = JimiV9PlainButton(type: .custom), backdrop = UIButton(type: .custom)
    private var closing = false
    private var modalDrag: JimiNativeModalDrag?
    init(assets: JimiV9Artwork) { self.assets = assets; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("Use init(assets:)") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        var camera = CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform = camera
        idle.layer.isDoubleSided = false
        backdrop.backgroundColor = JimiNativeModalV10.backdropColor
        backdrop.addTarget(self,action:#selector(closeSheet),for:.touchUpInside); view.addSubview(backdrop)
        card.alpha = 0;backdrop.alpha = 0
        view.addSubview(card);card.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper)
        card.layer.anchorPoint = CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint = CGPoint(x:0.5,y:0.46);idle.layer.anchorPoint = CGPoint(x:0.5,y:0.52)
        paper.image = assets.image("assets/modals/paper.png");paper.contentMode = .scaleToFill
        paper.layer.cornerRadius = 40;paper.clipsToBounds = true
        idle.layer.shadowColor = UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity = 0.8;idle.layer.shadowOffset = CGSize(width:0,height:13);idle.layer.shadowRadius = 16.8
        copy.backgroundColor = .clear; copy.isEditable = false;copy.isSelectable = true
        copy.textContainerInset = .zero;copy.textContainer.lineFragmentPadding = 0
        let ink = UIColor(red:173/255,green:134/255,blue:117/255,alpha:1)
        let orange = UIColor(red:232/255,green:116/255,blue:74/255,alpha:1)
        let content = NSMutableAttributedString()
        let titleStyle = NSMutableParagraphStyle();titleStyle.alignment = .center;titleStyle.paragraphSpacing = 20
        content.append(NSAttributedString(string:"Privacy Policy\n",attributes:[.font:assets.font(size:32,weight:"ExtraBold"),.foregroundColor:ink,.paragraphStyle:titleStyle]))
        content.addAttribute(.foregroundColor,value:orange,range:NSRange(location:0,length:7))
        let paragraphs = ["Stack to Six does not collect, transmit, sell, or share personal data.","Game progress and settings are stored only on your device.","The game does not use accounts, advertising, analytics, or in-app purchases.","Deleting the app removes its locally stored data.","Privacy questions can be directed to Tap Tap Design through the App Store support page.","Read Privacy Policy","Last updated: August 27, 2026"]
        for (i,text) in paragraphs.enumerated() {
            let style = NSMutableParagraphStyle();style.minimumLineHeight = 22.5;style.maximumLineHeight = 22.5;style.paragraphSpacing = 8
            var attrs: [NSAttributedString.Key:Any] = [.font:assets.font(size:i==6 ? 16 : 17,weight:"Medium"),.foregroundColor:i==6 ? ink.withAlphaComponent(0.72) : ink,.paragraphStyle:style]
            if i==5 { attrs[.link] = URL(string:"https://taptapdesign.com/stacktosix-privacy-policy/")! }
            content.append(NSAttributedString(string:text+(i==6 ? "" : "\n"),attributes:attrs))
        }
        copy.attributedText = content;copy.linkTextAttributes = [.foregroundColor:orange,.underlineStyle:NSUnderlineStyle.single.rawValue]
        idle.addSubview(copy)
        close.backgroundColor = UIColor(red:1,green:250/255,blue:244/255,alpha:1);close.layer.cornerRadius = 26
        close.setBackgroundImage(paper.image,for:.normal);close.clipsToBounds = true
        close.setImage(assets.image("assets/close-icon.png"),for:.normal);close.imageView?.contentMode = .scaleAspectFit;close.artworkOpacity = 0.8;close.enableArtworkTapFeedback()
        close.imageEdgeInsets = UIEdgeInsets(top:14,left:14,bottom:14,right:14)
        close.accessibilityLabel = "Close Privacy Policy";close.accessibilityIdentifier = "native.settings.privacy.close"
        close.addTarget(self,action:#selector(closeSheet),for:.touchUpInside);idle.addSubview(close)
        modalDrag = JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in guard let self else{return false};return !self.closing && self.card.layer.animation(forKey:"privacy-enter") == nil},onDismiss:{[weak self] in self?.closeSheet()})
        card.accessibilityIdentifier = "native.settings.privacy.paper"
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame = view.bounds
        let width = min(390,max(0,view.bounds.width-48)), textWidth = max(0,width-80)
        let wanted = copy.sizeThatFits(CGSize(width:textWidth,height:CGFloat.greatestFiniteMagnitude)).height+80
        let height = min(wanted,view.bounds.height-view.safeAreaInsets.top-view.safeAreaInsets.bottom-48)
        card.bounds = CGRect(x:0,y:0,width:width,height:height);card.center = CGPoint(x:view.bounds.midX,y:view.bounds.midY+height*0.05)
        flip.bounds = card.bounds;flip.center = CGPoint(x:width/2,y:height*0.46)
        idle.bounds = card.bounds;idle.center = CGPoint(x:width/2,y:height*0.52)
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds,bottomExtension:96)
        copy.frame = CGRect(x:40,y:40,width:textWidth,height:max(0,height-80))
        copy.isScrollEnabled = wanted>height
        close.frame = CGRect(x:width-42,y:-10,width:52,height:52)
    }
    private func pose(_ y:CGFloat,_ z:CGFloat,_ rx:CGFloat,_ ry:CGFloat,_ scale:CGFloat,_ rz:CGFloat = 0)->CATransform3D {
        var t = CATransform3DIdentity
        t = CATransform3DTranslate(t,0,y,z);t = CATransform3DRotate(t,rx * .pi/180,1,0,0)
        t = CATransform3DRotate(t,ry * .pi/180,0,1,0);t = CATransform3DRotate(t,rz * .pi/180,0,0,1)
        return CATransform3DScale(t,scale,scale,scale)
    }
    private func animate(_ target:UIView,poses:[CATransform3D],times:[NSNumber],key:String,duration:Double,repeats:Bool = false) {
        let a = CAKeyframeAnimation(keyPath:"transform");a.values = poses.map{NSValue(caTransform3D:$0)};a.keyTimes = times;a.duration = duration
        a.repeatCount = repeats ? .infinity : 0
        let timing = key == "privacy-exit" ? CAMediaTimingFunction(controlPoints:0.4,0,0.2,1) : (target === card ? CAMediaTimingFunction(controlPoints:0.22,1.18,0.36,1) : CAMediaTimingFunction(controlPoints:0.16,1,0.3,1))
        a.timingFunctions = Array(repeating:timing,count:max(0,poses.count-1));target.layer.add(a,forKey:key)
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated)
        guard !closing else{return}
        card.alpha = 1
        UIView.animate(withDuration:UIAccessibility.isReduceMotionEnabled ? 0.01 : 0.5){self.backdrop.alpha = 1}
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        animate(card,poses:[pose(88,0,0,0,0.72,-2),pose(-10,0,0,0,1.07,0.8),pose(4,0,0,0,0.98,-0.35),CATransform3DIdentity],times:[0,0.55,0.76,1],key:"privacy-enter",duration:0.65)
        animate(flip,poses:[pose(88,-180,17,-88,0.72),CATransform3DIdentity],times:[0,1],key:"privacy-enter",duration:0.65)
        let float = CAKeyframeAnimation(keyPath:"transform")
        float.values = [pose(0,0,0,0,1),pose(-3,3,0,0,1.003),pose(0,0,0,0,1),pose(-3.75,4,0,0,1.004),pose(0,0,0,0,1),pose(-4,8,0,0,1.015),pose(1,0,0,0,0.995),pose(-1,3,0,0,1.006),pose(0,0,0,0,1)].map{NSValue(caTransform3D:$0)}
        float.keyTimes = [0,0.18,0.38,0.58,0.76,0.84,0.89,0.94,1];float.duration = 6.8;float.repeatCount = .infinity;float.beginTime = CACurrentMediaTime()+0.65
        idle.layer.add(float,forKey:"privacy-idle")
    }
    @objc private func closeSheet() {
        guard !closing else{return};close.playArtworkTapFeedback();modalDrag?.cancel(preservePose:true);closing = true;view.isUserInteractionEnabled = false;onCloseRequested?()
        guard !UIAccessibility.isReduceMotionEnabled else{dismiss(animated:false);return}
        let releaseY = card.layer.presentation()?.transform.m42 ?? card.layer.transform.m42
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.dismiss(animated:false)}
        JimiNativeModalV10.exit(card,flip:false,releaseY:releaseY,releaseTilt:atan2(card.layer.transform.m12,card.layer.transform.m11)*180 / .pi,key:"privacy-exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"privacy-exit")
        let fade = CAKeyframeAnimation(keyPath:"opacity");fade.values = [1,1,0];fade.keyTimes = [0,0.18,1];fade.duration = 0.65
        fade.timingFunctions = Array(repeating:CAMediaTimingFunction(controlPoints:0.4,0,0.2,1),count:2)
        card.layer.opacity = 0;card.layer.add(fade,forKey:"privacy-exit-opacity");CATransaction.commit()
        UIView.animate(withDuration:0.5){self.backdrop.alpha = 0}
    }
    override func viewDidDisappear(_ animated:Bool) {
        super.viewDidDisappear(animated)
        modalDrag?.dispose();modalDrag = nil;onCloseRequested=nil
        for target in [card,flip,idle] {target.layer.removeAllAnimations()}
    }
}

/// Native rendition of the v10 51×31 pill and 27pt white knob.
/// Extra hit padding contains the authored finite bounce without scroll clipping.
@MainActor
final class JimiNativeSettingsToggle: UIControl {
    private let pill = UIView()
    private let knob = UIView()
    private(set) var isOn = false
    var onTintColor = UIColor(red: 232/255, green: 116/255, blue: 74/255, alpha: 1)
    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(pill); pill.addSubview(knob)
        pill.isUserInteractionEnabled = false
        pill.layer.cornerRadius = 15.5
        pill.layer.shadowColor = UIColor.black.cgColor
        pill.layer.shadowOpacity = 0.1; pill.layer.shadowOffset = CGSize(width: 0,height: 2); pill.layer.shadowRadius = 2
        knob.backgroundColor = .white; knob.layer.cornerRadius = 13.5
        knob.layer.shadowColor = UIColor.black.cgColor
        knob.layer.shadowOpacity = 0.2; knob.layer.shadowOffset = CGSize(width: 0,height: 2); knob.layer.shadowRadius = 2
        isAccessibilityElement = true; accessibilityTraits = .button
        addTarget(self, action: #selector(toggleValue), for: .touchUpInside)
        setOn(false, animated: false)
    }
    required init?(coder: NSCoder) { fatalError("Use init(frame:)") }
    override func layoutSubviews() {
        super.layoutSubviews()
        pill.bounds = CGRect(x: 0,y: 0,width: 51,height: 31)
        pill.center = CGPoint(x: bounds.midX,y: bounds.midY)
        knob.frame = CGRect(x: isOn ? 22 : 2,y: 2,width: 27,height: 27)
    }
    func setOn(_ value: Bool, animated: Bool) {
        isOn = value; accessibilityValue = value ? "On" : "Off"
        let update = {
            self.pill.backgroundColor = value ? self.onTintColor : UIColor(red: 223/255,green: 211/255,blue: 206/255,alpha: 1)
            self.knob.frame = CGRect(x: value ? 22 : 2,y: 2,width: 27,height: 27)
        }
        if animated && !UIAccessibility.isReduceMotionEnabled {
            UIView.animate(withDuration: 0.3,delay: 0,options: [.beginFromCurrentState,.allowUserInteraction],animations: update)
        } else { update() }
    }
    @objc private func toggleValue() {
        setOn(!isOn, animated: true)
        NativeHubBackpackFeedback.play(on:pill)
        sendActions(for: .valueChanged)
    }
    override func accessibilityActivate() -> Bool { toggleValue(); return true }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { pill.layer.removeAllAnimations(); knob.layer.removeAllAnimations() }
    }
}
