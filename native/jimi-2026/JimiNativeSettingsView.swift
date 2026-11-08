import UIKit
import CoreText

/// Static original-paper crop and lightly nicked silhouette, renewed only per visit.
@MainActor
private final class NativeSettingsPaperSurface:UIView {
    private let texture:UIImageView
    private let edgeMask=CAShapeLayer()
    private var crop:CGFloat=0.5,mirrored=false,seed:UInt64=1
    var circularCorners=false {didSet{if circularCorners != oldValue {setNeedsLayout()}}}
    var cornerRadius:CGFloat=22 {didSet{if cornerRadius != oldValue {setNeedsLayout()}}}
    private(set) var outline:CGPath=CGMutablePath()
    init(image:UIImage?){texture=UIImageView(image:image);super.init(frame:.zero);isUserInteractionEnabled=false;addSubview(texture);layer.mask=edgeMask}
    required init?(coder:NSCoder){fatalError("Original paper initializer")}
    func renew(crop:CGFloat,mirrored:Bool,seed:UInt64){self.crop=crop;self.mirrored=mirrored;self.seed=seed;setNeedsLayout()}
    override func layoutSubviews(){
        super.layoutSubviews();guard bounds.width>0,bounds.height>0 else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        let size=texture.image?.size ?? CGSize(width:390,height:525)
        let scale=max(bounds.width/max(1,size.width),bounds.height/max(1,size.height))
        texture.bounds=CGRect(x:0,y:0,width:size.width*scale,height:size.height*scale)
        texture.center=CGPoint(x:bounds.midX,y:texture.bounds.height/2-(texture.bounds.height-bounds.height)*crop)
        texture.transform=mirrored ? CGAffineTransform(scaleX:-1,y:1):.identity
        var state=seed
        func random()->CGFloat {state=state &* 6364136223846793005 &+ 1442695040888963407;return CGFloat(state>>40)/CGFloat(1<<24)}
        let w=bounds.width,h=bounds.height,r=min(cornerRadius,min(w,h)/2),path=UIBezierPath()
        func side(from start:CGPoint,to end:CGPoint,inward:CGPoint,count:Int){
            let dx=end.x-start.x,dy=end.y-start.y,length=hypot(dx,dy)
            guard length>0 else{return}
            for slot in 0..<count {
                let t=(CGFloat(slot)+0.35+random()*0.3)/CGFloat(count)
                let half=min(3.4,1.4+random()*2)/length,depth=0.55+random()*1.45
                let before=CGPoint(x:start.x+dx*max(0,t-half),y:start.y+dy*max(0,t-half))
                let tip=CGPoint(x:start.x+dx*t+inward.x*depth,y:start.y+dy*t+inward.y*depth)
                let after=CGPoint(x:start.x+dx*min(1,t+half),y:start.y+dy*min(1,t+half))
                path.addLine(to:before);path.addQuadCurve(to:tip,controlPoint:CGPoint(x:(before.x+tip.x)/2,y:(before.y+tip.y)/2));path.addLine(to:after)
            }
            path.addLine(to:end)
        }
        path.move(to:CGPoint(x:r,y:0));side(from:CGPoint(x:r,y:0),to:CGPoint(x:w-r,y:0),inward:CGPoint(x:0,y:1),count:8)
        if circularCorners {path.addCurve(to:CGPoint(x:w,y:r),controlPoint1:CGPoint(x:w-r+r*0.55228475,y:0),controlPoint2:CGPoint(x:w,y:r-r*0.55228475))}
        else {path.addQuadCurve(to:CGPoint(x:w,y:r),controlPoint:CGPoint(x:w,y:0))}
        side(from:CGPoint(x:w,y:r),to:CGPoint(x:w,y:h-r),inward:CGPoint(x:-1,y:0),count:3)
        if circularCorners {path.addCurve(to:CGPoint(x:w-r,y:h),controlPoint1:CGPoint(x:w,y:h-r+r*0.55228475),controlPoint2:CGPoint(x:w-r+r*0.55228475,y:h))}
        else {path.addQuadCurve(to:CGPoint(x:w-r,y:h),controlPoint:CGPoint(x:w,y:h))}
        side(from:CGPoint(x:w-r,y:h),to:CGPoint(x:r,y:h),inward:CGPoint(x:0,y:-1),count:8)
        if circularCorners {path.addCurve(to:CGPoint(x:0,y:h-r),controlPoint1:CGPoint(x:r-r*0.55228475,y:h),controlPoint2:CGPoint(x:0,y:h-r+r*0.55228475))}
        else {path.addQuadCurve(to:CGPoint(x:0,y:h-r),controlPoint:CGPoint(x:0,y:h))}
        side(from:CGPoint(x:0,y:h-r),to:CGPoint(x:0,y:r),inward:CGPoint(x:1,y:0),count:3)
        if circularCorners {path.addCurve(to:CGPoint(x:r,y:0),controlPoint1:CGPoint(x:0,y:r-r*0.55228475),controlPoint2:CGPoint(x:r-r*0.55228475,y:0))}
        else {path.addQuadCurve(to:CGPoint(x:r,y:0),controlPoint:.zero)};path.close()
        outline=path.cgPath;edgeMask.frame=bounds;edgeMask.path=outline
        CATransaction.commit()
    }
}

/// UIKit presentation only. The existing web settings/save owner supplies every
/// value and accepts mutations; this view never creates a preference store.
@MainActor
final class JimiNativeSettingsView: UIView, UIGestureRecognizerDelegate, UIScrollViewDelegate {
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
    private var papers: [NativeSettingsPaperSurface] = []
    private var icons: [UIImageView] = []
    private var rowSurfaces:[UIView]=[]
    private var rowTilts:[CGFloat]=[0,0,0]
    private var idleAdmitted=false,idleForeground=true
    private let idleDirections=(0..<3).map{_ in CGPoint(x:CGFloat.random(in:-6...6),y:CGFloat.random(in:4...8))}
    private let idleTilts=(0..<3).map{_ in CGFloat.random(in:-1.4...1.4)}
    private let idlePhases=(0..<3).map{_ in Double.random(in:0.35...0.65)}
    private let idleDurations=(0..<3).map{_ in Double.random(in:3.4...4.6)}
    private let title = JimiV9ArchedNavigationTitle()
    private let footerCopy = UILabel()
    private let privacy = JimiV9PlainButton(type: .custom)
    private(set) var presentationEpoch = -1
    private(set) var snapshot: [String: Any] = [:]
    private let keys = ["gameSoundsEnabled", "musicEnabled", "hapticsEnabled"]
    private let labels = ["Sounds", "Music", "Vibration"]
    private static let iconOpacityKey="native.settings.icon-opacity"
    private let ink = UIColor(red: 153/255, green: 103/255, blue: 84/255, alpha: 1)
    private let accent = UIColor(red: 232/255, green: 116/255, blue: 74/255, alpha: 1)

    init(frame: CGRect, assets: JimiV9Artwork) {
        self.assets = assets
        super.init(frame: frame)
        accessibilityIdentifier = "native.settings"
        addSubview(scroll); addSubview(footer); addSubview(header)
        header.backgroundColor = UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.8)
        header.setHomeDividerImage(assets.image("assets/home-shadow.png"))
        header.setBackgroundImage(assets.image("assets/nav/nav-bg.png",densityAware:true),opacity:0.5)
        // Padding belongs to the rows, never to a clipping animation viewport.
        clipsToBounds = false; scroll.clipsToBounds = false
        scroll.delegate = self
        scroll.alwaysBounceVertical = false
        scroll.showsVerticalScrollIndicator = false
        title.text = "Settings"; title.font = assets.font(size: 28); title.textColor = NativeTextPalette.navigationTitle
        title.textAlignment = .center; header.addSubview(title)
        back.setImage(assets.image("assets/chevron-back.png",densityAware:true), for: .normal)
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
        developerSummary.numberOfLines = 0; developerSummary.font = assets.font(size: 18,weight: "Medium")
        developerSummary.textColor = ink; developerSummary.accessibilityIdentifier = "native.settings.developer.summary"
        developerSummary.isHidden = true; scroll.addSubview(developerSummary)
        firstPlay.titleLabel?.font = assets.font(size: 18,weight: "Medium"); firstPlay.setTitleColor(accent,for: .normal)
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
            case .clean,.arcadeClean,.beachClean,.area55Clean: palette = (0xE9A03A,0xBD7627)
            default: palette = (0xE8744A,0xC95E39)
            }
            styleDeveloperButton(button,fill: palette.0,depth: palette.1)
            button.tag = developerButtons.count
            button.accessibilityIdentifier = "native.settings.developer.\(action.rawValue)"
            button.addTarget(self, action: #selector(activateDeveloperAction(_:)), for: .touchUpInside)
            button.isHidden = true; scroll.addSubview(button);button.enableCartoonBounce(); developerButtons.append(button)
        }
        for i in keys.indices {
            let row = UIView(); row.tag = i; scroll.addSubview(row); rows.append(row)
            // Static tilted surface is separate from the existing route scale carrier.
            let surface=UIView();surface.accessibilityIdentifier="native.settings.row.surface"
            row.addSubview(surface);rowSurfaces.append(surface)
            let paper=NativeSettingsPaperSurface(image:assets.image("assets/modals/paper.png",densityAware:true))
            paper.alpha=0.8
            surface.addSubview(paper);papers.append(paper)
            surface.layer.shadowColor=UIColor(red:0.68,green:0.40,blue:0.20,alpha:1).cgColor
            surface.layer.shadowOpacity=0.18;surface.layer.shadowRadius=6;surface.layer.shadowOffset=CGSize(width:0,height:4)
            let icon=UIImageView(image:assets.image("assets/nav/\(["zvucnik","gitara","telefon"][i]).png",densityAware:true))
            icon.contentMode = .scaleAspectFit;surface.addSubview(icon);icons.append(icon)
            let tap = UITapGestureRecognizer(target:self,action:#selector(tapPreferenceRow(_:)))
            tap.delegate = self; tap.cancelsTouchesInView = false; row.addGestureRecognizer(tap)
            let status = UILabel(); status.font = assets.font(size: 32, weight: "ExtraBold"); status.textColor = UIColor(red: 232/255, green: 116/255, blue: 74/255, alpha: 1)
            status.accessibilityIdentifier = "native.settings.status.\(keys[i])"
            surface.addSubview(status); statuses.append(status)
            let label = UILabel(); label.text = labels[i]; label.font = assets.font(size: 18, weight: "Medium"); label.textColor = NativeTextPalette.subtitle
            label.adjustsFontSizeToFitWidth=true;label.minimumScaleFactor=0.75
            surface.addSubview(label); descriptions.append(label)
            let toggle = JimiNativeSettingsToggle(); toggle.tag = i
            toggle.accessibilityLabel = labels[i]; toggle.accessibilityIdentifier = "native.settings.\(keys[i])"
            toggle.addTarget(self, action: #selector(changePreference(_:)), for: .valueChanged)
            surface.addSubview(toggle); switches.append(toggle)
            if i < keys.count-1 {
                let divider = UIView(); divider.backgroundColor = .clear
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
            updateIconOpacity(at:i,enabled:enabled,animated:animateChanges)
            let text = enabled ? "ON" : "OFF"
            if statuses[i].text != text {
                if animateChanges && statuses[i].text != nil { changedStatuses.append(statuses[i]) }
                else { statuses[i].layer.removeAnimation(forKey: NativeHubBackpackFeedback.animationKey) }
                statuses[i].text = text
                statuses[i].textColor = enabled ? accent : UIColor(red:199/255,green:161/255,blue:135/255,alpha:1)
            }
        }
        developerSummary.attributedText = NSAttributedString(string: "DEV\nJourney & Intro tools",attributes: [.font: assets.font(size: 18),.foregroundColor: NativeTextPalette.subtitle])
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
        updateCardIdle()
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
    func scrollViewDidScroll(_ scrollView:UIScrollView) {
        header.updateBackgroundForScroll(scrollView)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let top = safeAreaInsets.top
        let tablet=NativeTabletLayout.applies(bounds.size)
        let contentScale:CGFloat=tablet ? 1.40:1
        let contentWidth=NativeTabletLayout.settingsWidth(bounds.size)
        let row=JimiV9NavigationHeader.RowLayout(bounds:bounds,safeAreaTop:top)
        place(header, in: CGRect(x:0,y:0,width:bounds.width,height:row.headerHeight()))
        NativeTabletLayout.labelFont(title,size:row.titleFontSize)
        title.frame = row.titleFrame(for:title)
        back.frame = row.buttonFrame(x:24,visibleInset:13)
        back.imageEdgeInsets=row.iconInsets(UIEdgeInsets(top:10,left:10,bottom:10,right:10),imageHeight:24,inkCenterY:0.5104166666666666)
        // Original gear paints through46/48of its26pt inset image box.
        developer.frame = row.buttonFrame(x:bounds.width-68,visibleInset:9+26*2/48)
        developer.imageEdgeInsets=row.iconInsets(UIEdgeInsets(top:9,left:9,bottom:9,right:9),imageHeight:26,inkCenterY:0.4791666666666667)
        header.applyCurve(to:title,icons:[back,developer])
        // The original24pt chevron paints from x3 inside its10pt inset.
        // Tablet rows share the Backpack grid's32pt inner content inset.
        let bodyInset:CGFloat=tablet ? 32*contentScale:back.frame.minX+back.imageEdgeInsets.left+3
        let footerHeight: CGFloat = min(165, max(110,bounds.height*0.2))*contentScale
        NativeTabletLayout.labelFont(footerCopy,size:16*contentScale)
        NativeTabletLayout.buttonFont(privacy,size:14*contentScale)
        place(footer, in: CGRect(x:(bounds.width-contentWidth)/2+bodyInset,y:bounds.height-safeAreaInsets.bottom-footerHeight,width:max(0,contentWidth-bodyInset*2), height: footerHeight))
        footerCopy.frame = CGRect(x: 0, y: 0, width: footer.bounds.width, height: footerHeight-40*contentScale)
        privacy.setCartoonBounceFrame(CGRect(x: 0, y: footerHeight-44*contentScale, width: footer.bounds.width, height: 44*contentScale))
        header.updateBackgroundForScroll(scroll)
        scroll.frame = CGRect(x:(bounds.width-contentWidth)/2,y:header.center.y+header.bounds.height/2,width:contentWidth, height: max(0,(footer.center.y-footer.bounds.height/2)-(header.center.y+header.bounds.height/2)))
        developerSummary.frame = CGRect(x: 24,y: 20,width: max(0,contentWidth-48),height: 64)
        let columns = contentWidth <= 374 ? 1 : 3
        let buttonWidth = max(0,(contentWidth-48-CGFloat(columns-1)*10)/CGFloat(columns))
        for (index,button) in developerButtons.enumerated() {
            button.titleLabel?.font = assets.font(size: columns == 1 ? 18 : 16,weight: "ExtraBold")
            button.setCartoonBounceFrame(CGRect(x: 24+CGFloat(index%columns)*(buttonWidth+10),y: 100+CGFloat(index/columns)*64,width: buttonWidth,height: 48))
            button.layer.shadowPath = UIBezierPath(roundedRect: button.bounds,cornerRadius: 18).cgPath
        }
        let firstPlayY = 100+CGFloat((developerButtons.count+columns-1)/columns)*64
        firstPlay.setCartoonBounceFrame(CGRect(x: 24,y: firstPlayY,width: max(0,contentWidth-48),height: 48))
        firstPlay.titleLabel?.font = assets.font(size: columns == 1 ? 18 : 16,weight: "ExtraBold")
        firstPlay.layer.shadowPath = UIBezierPath(roundedRect: firstPlay.bounds,cornerRadius: 18).cgPath
        // Align the paper to the original PNG ink edges, not the control hit boxes.
        // Chevron ink begins35/216 across its24pt image;gear ends2/48 before its26pt edge.
        let paperLeft=back.frame.minX+back.imageEdgeInsets.left+24*35/216*row.iconScale
        let paperRight=developer.frame.maxX-developer.imageEdgeInsets.right-26*2/48*row.iconScale
        let inset=paperLeft-scroll.frame.minX
        let rowWidth=max(0,paperRight-paperLeft)
        let padding:CGFloat=tablet ? 64:32
        let compact = !tablet && rowWidth<280
        let iconCanvas:CGFloat=compact ? 48:64*contentScale
        // Strong-alpha left bounds of the original density-aware nav artwork.
        let iconInkLeft:[CGFloat]=[29/160,39/160,26/160]
        let copyX=padding+iconCanvas*108/160+(compact ? 10:16)+(tablet ? 16:0)
        let copyWidth=max(0,rowWidth-padding-51*contentScale-12-copyX)
        let rowHeight=110*contentScale
        var nextPaintedY:CGFloat=80
        for i in rows.indices {
            NativeTabletLayout.labelFont(statuses[i],size:32)
            NativeTabletLayout.labelFont(descriptions[i],size:18*contentScale)
            descriptions[i].attributedText=NativeModalTypography.attributedSubtitle(labels[i],font:assets.font(size:18*contentScale,weight:"Medium"),alignment:.left)
            // The whole content starts an additional80pt below its previous origin.
            // Paper and icon share the existing row's finite route animation.
            let angle=rowTilts[i] * .pi/180
            let paintedHeight=abs(rowHeight*cos(angle))+abs(rowWidth*sin(angle))
            place(rows[i],in:CGRect(x:inset,y:nextPaintedY+(paintedHeight-rowHeight)/2,width:rowWidth,height:rowHeight))
            place(rowSurfaces[i],in:rows[i].bounds)
            papers[i].frame=rowSurfaces[i].bounds
            let cardCornerRadius=NativeTabletLayout.settingsPaperCornerRadius(bounds.size)
            papers[i].circularCorners=tablet;papers[i].cornerRadius=cardCornerRadius;papers[i].setNeedsLayout();papers[i].layoutIfNeeded()
            rowSurfaces[i].layer.shadowPath=papers[i].outline
            nextPaintedY += paintedHeight+16
            icons[i].frame=CGRect(x:padding-iconCanvas*iconInkLeft[i],y:(rows[i].bounds.height-iconCanvas)/2,width:iconCanvas,height:iconCanvas)
            descriptions[i].numberOfLines=1
            let statusHeight=ceil(statuses[i].font.lineHeight)
            let descriptionHeight=ceil(18*contentScale*1.3)*CGFloat(descriptions[i].numberOfLines)
            // Halve the visible glyph gap, including the fonts' internal leading.
            // Merely halving the2pt frame gap leaves almost all whitespace intact.
            func ink(_ text:String,_ font:UIFont)->CGRect {
                CTLineGetBoundsWithOptions(CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[.font:font])),.useGlyphPathBounds)
            }
            let statusInk=ink(statuses[i].text ?? "ON",statuses[i].font)
            let descriptionInk=ink(labels[i],descriptions[i].font)
            let statusBaseline=(statusHeight-statuses[i].font.lineHeight)/2+statuses[i].font.ascender
            let descriptionBaseline=(descriptionHeight-descriptions[i].font.lineHeight)/2+descriptions[i].font.ascender
            let previousGlyphGap=statusHeight+2+descriptionBaseline-descriptionInk.maxY-statusBaseline+statusInk.minY
            let copyGap=4-max(0,previousGlyphGap)*0.5
            let copyTop=(rows[i].bounds.height-statusHeight-copyGap-descriptionHeight)/2
            let statusWidth=min(copyWidth,ceil(statuses[i].sizeThatFits(CGSize(width:copyWidth,height:statusHeight)).width))
            place(statuses[i],in:CGRect(x:copyX,y:copyTop,width:statusWidth,height:statusHeight))
            descriptions[i].frame=CGRect(x:copyX,y:copyTop+statusHeight+copyGap,width:copyWidth,height:descriptionHeight)
            switches[i].presentationScale=contentScale
            switches[i].frame=CGRect(x:max(0,rowWidth-padding-59*contentScale),y:32.5*contentScale,width:67*contentScale,height:45*contentScale)
            if i<dividers.count {place(dividers[i],in:CGRect(x:inset,y:nextPaintedY-8,width:rowWidth,height:2*contentScale))}
        }
        scroll.contentSize=CGSize(width:scroll.bounds.width,height:developerPanelVisible ? firstPlay.cartoonBounceFrame.maxY+32:nextPaintedY)
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
    private func updateIconOpacity(at index:Int,enabled:Bool,animated:Bool) {
        let icon=icons[index],target:CGFloat=enabled ? 1:0.5
        guard animated else{icon.layer.removeAnimation(forKey:Self.iconOpacityKey);icon.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey);icon.alpha=target;return}
        guard abs(icon.alpha-target)>0.001 else{return}
        let from=icon.layer.presentation()?.opacity ?? Float(icon.alpha)
        icon.layer.removeAnimation(forKey:Self.iconOpacityKey)
        CATransaction.begin();CATransaction.setDisableActions(true);icon.alpha=target;CATransaction.commit()
        guard !UIAccessibility.isReduceMotionEnabled else{icon.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey);return}
        let epoch=CACurrentMediaTime()
        NativeHubBackpackFeedback.play(on:icon,beginTime:epoch,preservingTransform:true)
        let fade=CABasicAnimation(keyPath:"opacity");fade.fromValue=from;fade.toValue=Float(target)
        fade.beginTime=icon.layer.convertTime(epoch+0.080,from:nil)
        fade.duration=0.14;fade.fillMode = .backwards;fade.timingFunction=CAMediaTimingFunction(name:.easeInEaseOut)
        icon.layer.add(fade,forKey:Self.iconOpacityKey)
    }
    private func cancelStatusBounces() {
        for label in statuses { label.layer.removeAnimation(forKey: NativeHubBackpackFeedback.animationKey) }
        for surface in rowSurfaces { surface.layer.removeAnimation(forKey: NativeHubBackpackFeedback.animationKey) }
        for icon in icons {icon.layer.removeAnimation(forKey:Self.iconOpacityKey);icon.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}
    }
    private func playCardFeedback(at index:Int) {
        guard rowSurfaces.indices.contains(index),window != nil,!isHidden,!developerPanelVisible,
              !UIAccessibility.isReduceMotionEnabled else{return}
        let layer=rowSurfaces[index].layer,base=rowSurfaces[index].layer.transform
        let painted=layer.presentation()?.transform ?? base
        layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)
        let motion=CAKeyframeAnimation(keyPath:"transform")
        let strength:CGFloat=0.35
        motion.values=NativeHUDTapMotion.poses.enumerated().map { i,pose in
            if i==0 {return NSValue(caTransform3D:painted)}
            let translated=CATransform3DTranslate(base,0,CGFloat(pose.offset)*strength,0)
            return NSValue(caTransform3D:CATransform3DScale(translated,1+(CGFloat(pose.x)-1)*strength,1+(CGFloat(pose.y)-1)*strength,1))
        }
        motion.keyTimes=NativeHUDTapMotion.phases.map{NSNumber(value:$0)}
        motion.duration=NativeHUDTapMotion.duration
        motion.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:NativeHUDTapMotion.poses.count-1)
        layer.add(motion,forKey:NativeHubBackpackFeedback.animationKey)
    }
    func setIdleActive(_ active:Bool){idleAdmitted=active;updateCardIdle()}
    func setIdleForeground(_ foreground:Bool) {
        guard idleForeground != foreground else{return}
        idleForeground=foreground
        if !foreground {for icon in icons {icon.layer.removeAnimation(forKey:Self.iconOpacityKey);icon.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}}
        for row in rows {
            guard let motion=row.layer.animation(forKey:JimiV9PlainButton.modalIdleKey)?.copy() as? CAAnimation else{continue}
            let now=row.layer.convertTime(CACurrentMediaTime(),from:nil)
            if foreground {motion.speed=1;motion.beginTime=now}
            else {motion.timeOffset=(motion.timeOffset+max(0,now-motion.beginTime)).truncatingRemainder(dividingBy:motion.duration);motion.speed=0;motion.beginTime=0}
            row.layer.add(motion,forKey:JimiV9PlainButton.modalIdleKey)
        }
        if foreground {updateCardIdle()}
    }
    private func updateCardIdle() {
        let visible=idleAdmitted && window != nil && !isHidden && !developerPanelVisible && !UIAccessibility.isReduceMotionEnabled
        for (i,row) in rows.enumerated() {
            guard visible else{row.layer.removeAnimation(forKey:JimiV9PlainButton.modalIdleKey);continue}
            guard idleForeground,row.layer.animation(forKey:JimiV9PlainButton.modalIdleKey)==nil else{continue}
            let motion=JimiV9PlainButton.gentleIdle(direction:idleDirections[i],tilt:idleTilts[i],phase:idlePhases[i],duration:idleDurations[i])
            motion.beginTime=row.layer.convertTime(CACurrentMediaTime(),from:nil)
            row.layer.add(motion,forKey:JimiV9PlainButton.modalIdleKey)
        }
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { cancelStatusBounces();idleAdmitted=false }
        updateCardIdle()
    }
    override var isHidden: Bool {
        didSet { if isHidden { cancelStatusBounces();idleAdmitted=false };updateCardIdle() }
    }
    func tracks(enter: Bool) -> [(UIView, JimiV9Motion.Track)] {
        setIdleActive(false)
        if enter {
            // Disjoint bands guarantee different poses; sample once per admitted visit.
            rowTilts=[CGFloat.random(in:-2 ... -1),CGFloat.random(in:-0.5 ... 0.5),CGFloat.random(in:1 ... 2)].shuffled().map{$0 * (NativeTabletLayout.applies(bounds.size) ? 0.5:1)}
            let cropBands:[CGFloat]=[CGFloat.random(in:0.08...0.23),CGFloat.random(in:0.40...0.59),CGFloat.random(in:0.77...0.92)].shuffled()
            for i in rowSurfaces.indices {
                papers[i].renew(crop:cropBands[i],mirrored:Bool.random(),seed:UInt64.random(in:1...UInt64.max))
                rowSurfaces[i].transform=CGAffineTransform(rotationAngle:rowTilts[i] * .pi/180)
            }
            setNeedsLayout();layoutIfNeeded()
        }
        if !enter { cancelStatusBounces() }
        var ordered: [UIView] = []
        for i in rows.indices { ordered.append(rows[i]); if i < dividers.count { ordered.append(dividers[i]) } }
        if enter { ordered.insert(header, at: 0); ordered.append(footer) }
        else { ordered.insert(footer, at: 0); ordered.reverse(); ordered.append(header) }
        return ordered.enumerated().map { i, target in
            let delay = enter ? (i == 0 ? 0 : 0.05+Double(i-1)*0.08) : Double(i)*0.04+(target === header ? 0.05 : 0)
            if !enter,!UIAccessibility.isReduceMotionEnabled,target !== header {
                // Same visible anticipation/collapse as Arcade; the existing
                // content receipt owns reveal, without an artificial wait.
                return (target,JimiV9Motion.worldHubElementExit(begin:delay))
            }
            return (target, JimiV9Motion.Track(tweens: [JimiV9Motion.Tween(
                begin: UIAccessibility.isReduceMotionEnabled ? 0 : delay,
                duration: UIAccessibility.isReduceMotionEnabled ? 0.01 : (enter ? 0.5 : 0.34),
                from: .scale(enter ? 0 : 1, opacity: enter ? 0 : 1),
                to: .scale(enter ? 1 : 0, opacity: enter ? 1 : 0),
                ease: enter ? .backOut(1.7) : .backIn(1.7))]))
        }
    }
    func gestureRecognizer(_ gestureRecognizer:UIGestureRecognizer,shouldReceive touch:UITouch)->Bool {
        // The existing toggle consumes its own tap; the row handles only the
        // label and empty space, without competing with scroll gestures.
        var target=touch.view
        while let view=target,view !== gestureRecognizer.view {
            if view is UIControl {return false}
            target=view.superview
        }
        return true
    }
    @objc private func tapPreferenceRow(_ sender:UITapGestureRecognizer) {
        guard sender.state == .ended,let index=sender.view?.tag,
              switches.indices.contains(index),!developerPanelVisible,
              switches[index].isEnabled,switches[index].isUserInteractionEnabled else {return}
        switches[index].sendActions(for:.touchUpInside)
    }
    @objc private func changePreference(_ sender: JimiNativeSettingsToggle) {
        guard keys.indices.contains(sender.tag) else { return }
        playCardFeedback(at:sender.tag)
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
    private let restTilt=JimiNativeModalTransformView()
    private let restTiltDegrees=JimiNativeModalV10.restTiltDegrees()
    private let assets: JimiV9Artwork
    let card = UIView(), flip = JimiNativeModalTransformView(), idle = UIView(), paper = NativeModalPaperView()
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
        view.addSubview(card);card.addSubview(flip);flip.addSubview(restTilt);restTilt.addSubview(idle);idle.addSubview(paper)
        restTilt.layer.transform=CATransform3DMakeRotation(restTiltDegrees * .pi/180,0,0,1)
        card.layer.anchorPoint = CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint = CGPoint(x:0.5,y:0.46);idle.layer.anchorPoint = CGPoint(x:0.5,y:0.52)
        paper.prepare(assets:assets)
        idle.layer.shadowColor = UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity = 0.8;idle.layer.shadowOffset = CGSize(width:0,height:13);idle.layer.shadowRadius = 16.8
        copy.backgroundColor = .clear; copy.isEditable = false;copy.isSelectable = true
        copy.textContainerInset = .zero;copy.textContainer.lineFragmentPadding = 0
        let ink = UIColor(red:173/255,green:134/255,blue:117/255,alpha:1)
        let orange = UIColor(red:232/255,green:116/255,blue:74/255,alpha:1)
        let content = NSMutableAttributedString()
        let titleStyle = NSMutableParagraphStyle();titleStyle.alignment = .center;titleStyle.paragraphSpacing = 20
        content.append(NSAttributedString(string:"Privacy Policy\n",attributes:[.font:assets.font(size:32,weight:"ExtraBold"),.foregroundColor:NativeTextPalette.modalTitle,.paragraphStyle:titleStyle]))
        let paragraphs = ["Stack to Six does not collect, transmit, sell, or share personal data.","Game progress and settings are stored only on your device.","The game does not use accounts, advertising, analytics, or in-app purchases.","Deleting the app removes its locally stored data.","Privacy questions can be directed to Tap Tap Design through the App Store support page.","Read Privacy Policy","Last updated: August 27, 2026"]
        for (i,text) in paragraphs.enumerated() {
            let style = NSMutableParagraphStyle();style.minimumLineHeight = 22.5;style.maximumLineHeight = 22.5;style.paragraphSpacing = 8
            var attrs: [NSAttributedString.Key:Any] = [.font:assets.font(size:i==6 ? 16 : 17,weight:"Medium"),.foregroundColor:i==6 ? ink.withAlphaComponent(0.72) : ink,.paragraphStyle:style]
            if i==5 { attrs[.link] = URL(string:"https://taptapdesign.com/stacktosix-privacy-policy/")! }
            content.append(NSAttributedString(string:text+(i==6 ? "" : "\n"),attributes:attrs))
        }
        copy.attributedText = content;copy.linkTextAttributes = [.foregroundColor:orange,.underlineStyle:NSUnderlineStyle.single.rawValue]
        idle.addSubview(copy)
        close.backgroundColor = UIColor(red:1,green:250/255,blue:244/255,alpha:1);close.layer.cornerRadius = 16
        close.setBackgroundImage(paper.closeMaterial,for:.normal);close.clipsToBounds = true
        close.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal);close.imageView?.contentMode = .scaleAspectFit;close.artworkOpacity = 0.8;close.enableArtworkTapFeedback(wholeControl:true)
        close.imageEdgeInsets = UIEdgeInsets(top:14,left:14,bottom:14,right:14)
        close.accessibilityLabel = "Close Privacy Policy";close.accessibilityIdentifier = "native.settings.privacy.close"
        close.addTarget(self,action:#selector(closeSheet),for:.touchUpInside);idle.addSubview(close)
        modalDrag = JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in guard let self else{return false};return !self.closing && self.card.layer.animation(forKey:"privacy-enter") == nil},onDismiss:{[weak self] in self?.closeSheet()})
        card.accessibilityIdentifier = "native.settings.privacy.paper"
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame = view.bounds
        let modalBounds=NativeTabletLayout.modalBounds(in:view,card:card)
        let modalSafeInsets=NativeTabletLayout.modalSafeInsets(in:view)
        if let source=copy.attributedText {
            let text=NSMutableAttributedString(attributedString:source)
            let titleRange=(text.string as NSString).range(of:"Privacy Policy\n")
            let titleSize=NativeTabletLayout.modalTitleSize(view.bounds.size,phone:32)
            if titleRange.location != NSNotFound,let current=text.attribute(.font,at:titleRange.location,effectiveRange:nil) as? UIFont,abs(current.pointSize-titleSize)>0.001 {
                text.addAttribute(.font,value:assets.font(size:titleSize,weight:"ExtraBold"),range:titleRange)
                copy.attributedText=text
            }
        }
        let width = min(390,max(0,modalBounds.width-48)), textWidth = max(0,width-80)
        let wanted = copy.sizeThatFits(CGSize(width:textWidth,height:CGFloat.greatestFiniteMagnitude)).height+80
        let height = min(wanted,modalBounds.height-modalSafeInsets.top-modalSafeInsets.bottom-48)
        card.bounds = CGRect(x:0,y:0,width:width,height:height);card.center = CGPoint(x:modalBounds.midX,y:modalBounds.midY+height*0.05)
        flip.bounds = card.bounds;flip.center = CGPoint(x:width/2,y:height*0.46)
        restTilt.bounds=card.bounds;restTilt.center=CGPoint(x:width/2,y:height/2)
        idle.bounds = card.bounds;idle.center = CGPoint(x:width/2,y:height*0.52)
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds,bottomExtension:96)
        copy.frame = CGRect(x:40,y:40,width:textWidth,height:max(0,height-80))
        copy.isScrollEnabled = wanted>height
        JimiNativeModalV10.layoutClose(close,frame:CGRect(x:width-42,y:-10,width:52,height:52),modalTilt:restTiltDegrees)
    }
    private func pose(_ y:CGFloat,_ z:CGFloat,_ rx:CGFloat,_ ry:CGFloat,_ scale:CGFloat,_ rz:CGFloat = 0)->CATransform3D {
        var t = CATransform3DIdentity
        t = CATransform3DTranslate(t,0,y,z);t = CATransform3DRotate(t,rx * .pi/180,1,0,0)
        t = CATransform3DRotate(t,ry * .pi/180,0,1,0);t = CATransform3DRotate(t,rz * .pi/180,0,0,1)
        return CATransform3DScale(t,scale,scale,scale)
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated)
        guard !closing else{return}
        card.alpha = 1
        UIView.animate(withDuration:UIAccessibility.isReduceMotionEnabled ? 0.01 : 0.5){self.backdrop.alpha = 1}
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        let paperEpoch=CACurrentMediaTime()
        JimiNativeModalV10.enterClose(close,beginTime:paperEpoch)
        JimiNativeModalV10.enter(card:card,flip:flip,key:"privacy-enter",beginTime:paperEpoch)
        let float = CAKeyframeAnimation(keyPath:"transform")
        float.values = [pose(0,0,0,0,1),pose(-3,3,0,0,1.003),pose(0,0,0,0,1),pose(-3.75,4,0,0,1.004),pose(0,0,0,0,1),pose(-4,8,0,0,1.015),pose(1,0,0,0,0.995),pose(-1,3,0,0,1.006),pose(0,0,0,0,1)].map{NSValue(caTransform3D:$0)}
        float.keyTimes = [0,0.18,0.38,0.58,0.76,0.84,0.89,0.94,1];float.duration = 6.8;float.repeatCount = .infinity;float.beginTime = idle.layer.convertTime(paperEpoch,from:nil)+JimiNativeModalV10.paperEnterDuration
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
        for target in [card,flip,idle,close] {target.layer.removeAllAnimations()}
    }
}

/// Native rendition of the v10 51×31 pill and 27pt white knob.
/// Extra hit padding contains the authored finite bounce without scroll clipping.
@MainActor
final class JimiNativeSettingsToggle: UIControl {
    private let pill = UIView()
    private let knob = UIView()
    private let trackGradient=CAGradientLayer()
    private let knobGradient=CAGradientLayer()
    private(set) var isOn = false
    var presentationScale:CGFloat=1 {
        didSet {if presentationScale != oldValue {setNeedsLayout()}}
    }
    private func knobFrame(on:Bool)->CGRect {
        CGRect(x:(on ? 22:2)*presentationScale,y:2*presentationScale,width:27*presentationScale,height:27*presentationScale)
    }
    var onTintColor = UIColor(red: 1, green: 105/255, blue: 40/255, alpha: 1)
    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(pill); pill.addSubview(knob)
        trackGradient.startPoint=CGPoint(x:0,y:0);trackGradient.endPoint=CGPoint(x:1,y:1)
        pill.layer.insertSublayer(trackGradient,at:0)
        knobGradient.colors=[UIColor(red:1,green:253/255,blue:244/255,alpha:1).cgColor,UIColor(red:246/255,green:234/255,blue:216/255,alpha:1).cgColor]
        knob.layer.insertSublayer(knobGradient,at:0)
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
        pill.bounds = CGRect(x:0,y:0,width:51*presentationScale,height:31*presentationScale)
        pill.layer.cornerRadius=15.5*presentationScale
        pill.layer.shadowOffset=CGSize(width:0,height:2*presentationScale);pill.layer.shadowRadius=2*presentationScale
        knob.layer.cornerRadius=13.5*presentationScale
        knob.layer.shadowOffset=CGSize(width:0,height:2*presentationScale);knob.layer.shadowRadius=2*presentationScale
        pill.center = CGPoint(x: bounds.midX,y: bounds.midY)
        knob.frame=knobFrame(on:isOn)
        CATransaction.begin();CATransaction.setDisableActions(true)
        trackGradient.frame=pill.bounds;trackGradient.cornerRadius=pill.layer.cornerRadius
        knobGradient.frame=knob.bounds;knobGradient.cornerRadius=knob.layer.cornerRadius
        CATransaction.commit()
    }
    func setOn(_ value: Bool, animated: Bool) {
        isOn = value; accessibilityValue = value ? "On" : "Off"
        let update = {
            let off=UIColor(red:225/255,green:204/255,blue:184/255,alpha:1)
            self.pill.backgroundColor = value ? self.onTintColor : off
            CATransaction.begin();CATransaction.setDisableActions(true)
            self.trackGradient.colors=value ? [UIColor(red:1,green:128/255,blue:62/255,alpha:1).cgColor,self.onTintColor.cgColor] : [UIColor(red:218/255,green:194/255,blue:174/255,alpha:1).cgColor,off.cgColor]
            CATransaction.commit()
            self.knob.frame=self.knobFrame(on:value)
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
