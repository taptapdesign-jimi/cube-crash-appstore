import UIKit
import QuartzCore

/// Native owner of arcade-stage-clear-modal.ts. One finite display clock owns
/// glyph transforms, authored shakes and thumb motion. Progression belongs to
/// the caller's throwing receipt, committed before the first Round frame.
@MainActor
final class NativeArcadeRoundPresentation: UIView {
    enum Cue { case celebrationStarted, thumbWhoosh, heavyHaptic, roundShown, digitEntered(Int), digitExitStarted, finished }
    var onNextRoundPresented: (() throws -> Void)?
    var onFinished: ((Bool) -> Void)?
    var onCue: ((Cue) -> Void)?
    static let headlines = ["Sweet Win","Nice Move","Nice Job","Clean Hit","Smooth","Wild","Magic","Legend","Nailed It","Done","Nice","Sweet","Awesome","Congrats","Rock On","Fantastic"]
    private let artwork: JimiV9Artwork
    private let clearedRound: Int
    private let nextRound: Int
    private let continuationOnly: Bool
    private let clearCard = UIView()
    private let nextCard = UIView()
    private let stage = UIView()
    private let thumb = UIImageView()
    private let shadow = NativeArcadeThumbShadow()
    private var titleGlyphs: [UILabel] = [], subtitleGlyphs: [UILabel] = [], roundGlyphs: [UILabel] = [], digits: [UILabel] = []
    private var exitAngles: [CGFloat] = [], digitAngles: [CGFloat] = []
    private var titleFactors: [CGFloat] = []
    private let headline: String
    private var displayLink: CADisplayLink?
    private let clockTarget = NativeArcadeDisplayTarget()
    private var lastTime: CFTimeInterval?
    private var elapsed: TimeInterval = 0
    private var started = false, disposed = false, paused = false
    private var roundReceiptWritten = false
    private var sentThumbWhoosh = false, sentThumbArrival = false, sentDigitExit = false
    private var enteredDigits = Set<Int>()
    private var observations: [NSObjectProtocol] = []
    private var thumbRest = CGPoint.zero

    private var titleEnterEnd: TimeInterval { Double(max(0,titleGlyphs.count-1))*0.02+0.44 }
    private var subtitleEnterEnd: TimeInterval { titleEnterEnd+Double(max(0,subtitleGlyphs.count-1))*0.02+0.44 }
    private var clearReady: TimeInterval { max(0.48,subtitleEnterEnd) }
    private var clearExitStart: TimeInterval { clearReady+1.5 }
    private var roundStart: TimeInterval {
        continuationOnly ? 0 : clearExitStart+max(0.30,Double(max(0,titleGlyphs.count+subtitleGlyphs.count-1))*0.012+0.30)
    }
    private var roundEnterEnd: TimeInterval { max(Double(max(0,roundGlyphs.count-1))*0.02+0.44,Double(max(0,digits.count-1))*0.3+0.75) }
    private var roundExitStart: TimeInterval { roundStart+roundEnterEnd+0.3 }
    var duration: TimeInterval { roundExitStart+max(Double(max(0,roundGlyphs.count-1))*0.012+0.30,Double(max(0,digits.count-1))*0.4+0.45) }

    init(resourceRoot: URL,clearedRound: Int,nextRound: Int,continuationOnly: Bool = false,
         random: () -> Double = { Double.random(in: 0..<1) }) {
        artwork = JimiV9Artwork(resourceRoot: resourceRoot)
        self.clearedRound = max(1,clearedRound); self.nextRound = max(1,nextRound); self.continuationOnly = continuationOnly
        headline = Self.headlines[min(Self.headlines.count-1,max(0,Int(random()*Double(Self.headlines.count))))]
        super.init(frame: .zero)
        isUserInteractionEnabled = false; clipsToBounds = true; backgroundColor = .clear
        accessibilityIdentifier = "native-arcade-round-presentation"
        addSubview(stage); stage.addSubview(clearCard); stage.addSubview(nextCard)
        titleGlyphs = glyphs(headline,color: UIColor(red: 239.0/255,green: 116.0/255,blue: 77.0/255,alpha: 1),parent: clearCard)
        subtitleGlyphs = glyphs("Round \(String(format: "%02d",self.clearedRound)) complete",color: .init(red: 181.0/255,green: 138.0/255,blue: 120.0/255,alpha: 1),parent: clearCard)
        roundGlyphs = glyphs("Round",color: .init(red: 181.0/255,green: 138.0/255,blue: 120.0/255,alpha: 1),parent: nextCard)
        digits = glyphs(String(format: "%02d",self.nextRound),color: .init(red: 231.0/255,green: 116.0/255,blue: 73.0/255,alpha: 1),parent: nextCard)
        for character in headline { titleFactors.append(character == " " ? 1 : CGFloat((85+random()*30).rounded())/100) }
        exitAngles = (titleGlyphs+subtitleGlyphs+roundGlyphs).indices.map { CGFloat(($0 % 2 == 0 ? 1 : -1)*(12+random()*8)) }
        digitAngles = digits.indices.map { CGFloat(-8+random()*16)*($0 % 2 == 0 ? 1 : -1) }
        thumb.image = artwork.image("assets/thumbs-up@2x.png",densityAware: false)
        thumb.contentMode = .scaleAspectFit; clearCard.addSubview(shadow); clearCard.addSubview(thumb)
        thumb.layer.anchorPoint = CGPoint(x: 0.5,y: 0.74)
        clockTarget.owner = self
        observations = [
            NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,object: nil,queue: .main) { [weak self] _ in MainActor.assumeIsolated { self?.setSuspended(true) } },
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,object: nil,queue: .main) { [weak self] _ in MainActor.assumeIsolated { self?.setSuspended(false) } }
        ]
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func glyphs(_ text: String,color: UIColor,parent: UIView) -> [UILabel] {
        text.map { character in
            let label = UILabel(); label.text = character == " " ? "\u{00a0}" : String(character)
            label.textColor = color; label.textAlignment = .center; label.backgroundColor = .clear
            label.layer.isDoubleSided = false; label.alpha = 0; parent.addSubview(label); return label
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let top = max(118,safeAreaInsets.top+96), bottom = max(112,safeAreaInsets.bottom+92)
        stage.frame = CGRect(x: 0,y: top,width: bounds.width,height: max(1,bounds.height-top-bottom))
        let compact = bounds.height <= 720,cardWidth = min(bounds.width*0.84,440)
        let titleSize = compact ? min(76,max(58,bounds.width*0.12)) : min(86,max(65,bounds.width*0.14))
        let subtitleSize = min(34,max(24,bounds.width*0.054))
        let thumbSize = compact ? min(bounds.width*0.46,230) : min(bounds.width*0.58,300)
        let subtitleMargin: CGFloat = compact ? 10 : 16
        let thumbMargin: CGFloat = compact ? 16 : min(40,max(22,bounds.height*0.044))
        let titleHeight = layoutGlyphs(titleGlyphs,font: artwork.font(size: titleSize,weight: "ExtraBold"),factors: titleFactors,
                                     width: cardWidth,lineHeight: titleSize*0.95,spacing: -2,gap: 0)
        let subtitleHeight = layoutGlyphs(subtitleGlyphs,font: artwork.font(size: subtitleSize),width: cardWidth,
                                        lineHeight: subtitleSize*1.05,spacing: 0,gap: 0)
        for label in subtitleGlyphs { label.center.y += titleHeight+subtitleMargin }
        let cardHeight = titleHeight+subtitleMargin+subtitleHeight+thumbMargin+thumbSize
        clearCard.bounds = CGRect(x: 0,y: 0,width: cardWidth,height: cardHeight)
        clearCard.center = CGPoint(x: stage.bounds.midX,y: stage.bounds.midY-(compact ? 18 : 24))
        // CSS thumb-wrap translateY(24px) affects artwork without changing flex layout.
        let thumbTop = titleHeight+subtitleMargin+subtitleHeight+thumbMargin+24
        thumb.bounds = CGRect(x: 0,y: 0,width: thumbSize,height: thumbSize)
        thumbRest = CGPoint(x: cardWidth/2,y: thumbTop+thumbSize*0.74); thumb.layer.position = thumbRest
        shadow.frame = CGRect(x: (cardWidth-thumbSize*0.74)/2,y: thumbTop+thumbSize+70-thumbSize*0.15,
                              width: thumbSize*0.74,height: thumbSize*0.15)
        let digitSize = compact ? min(276,max(168,bounds.width*0.49)) : min(332,max(190,bounds.width*0.56))
        let labelHeight = layoutGlyphs(roundGlyphs,font: artwork.font(size: subtitleSize),width: cardWidth,
                                      lineHeight: subtitleSize*1.05,spacing: 0,gap: 1)
        _ = layoutGlyphs(digits,font: artwork.font(size: digitSize,weight: "ExtraBold"),width: cardWidth,
                         lineHeight: digitSize,spacing: -4,gap: 0,wrap: false)
        for label in digits { label.center.y += labelHeight+8-20 }
        nextCard.bounds = CGRect(x: 0,y: 0,width: cardWidth,height: labelHeight+8+digitSize)
        nextCard.center = CGPoint(x: stage.bounds.midX,y: stage.bounds.midY)
        if started { paint(elapsed) }
    }

    @discardableResult
    private func layoutGlyphs(_ labels: [UILabel],font: UIFont,factors: [CGFloat] = [],width: CGFloat,lineHeight: CGFloat,
                              spacing: CGFloat,gap: CGFloat,wrap: Bool = true) -> CGFloat {
        var rows: [[(UILabel,CGFloat)]] = [[]], rowWidth: CGFloat = 0
        for (index,label) in labels.enumerated() {
            label.font = font.withSize(font.pointSize*(factors.indices.contains(index) ? factors[index] : 1))
            let glyphWidth = (label.text! as NSString).size(withAttributes: [.font: label.font as Any]).width
            let before = index == 0 || label.text == "\u{00a0}" ? 0 : spacing
            let itemWidth = glyphWidth+before+gap
            if wrap && rowWidth+itemWidth > width && !rows[rows.count-1].isEmpty { rows.append([]); rowWidth = 0 }
            rows[rows.count-1].append((label,glyphWidth)); rowWidth += itemWidth
        }
        for (rowIndex,row) in rows.enumerated() {
            let fullWidth = row.enumerated().reduce(CGFloat.zero) { result,item in
                result+item.element.1+(item.offset == 0 || item.element.0.text == "\u{00a0}" ? 0 : spacing)+gap
            }
            var x = (width-fullWidth)/2
            for (index,item) in row.enumerated() {
                let label = item.0
                x += index == 0 || label.text == "\u{00a0}" ? 0 : spacing
                label.bounds = CGRect(x: 0,y: 0,width: item.1,height: max(lineHeight,label.font.lineHeight))
                label.center = CGPoint(x: x+item.1/2,y: CGFloat(rowIndex)*lineHeight+lineHeight/2)
                x += item.1+gap
            }
        }
        return CGFloat(rows.count)*lineHeight
    }

    func start() {
        guard !started,!disposed else { return }
        started = true; elapsed = 0; lastTime = nil; layoutIfNeeded()
        if continuationOnly { guard commitRoundReceipt() else { return } }
        else { onCue?(.heavyHaptic); onCue?(.celebrationStarted) }
        paint(0)
        let link = CADisplayLink(target: clockTarget,selector: #selector(NativeArcadeDisplayTarget.tick(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 30,maximum: 60,preferred: 60)
        link.add(to: .main,forMode: .common); displayLink = link
        link.isPaused = paused || window == nil
    }

    fileprivate func tick(_ link: CADisplayLink) {
        guard started,!disposed,!paused,window != nil else { lastTime = nil; return }
        if let lastTime { elapsed += max(0,link.timestamp-lastTime) }
        lastTime = link.timestamp
        paint(elapsed)
        if !disposed && elapsed >= duration { finish(completed: true) }
    }
    override func didMoveToWindow() {
        super.didMoveToWindow(); lastTime = nil
        displayLink?.isPaused = paused || window == nil
    }
    func setSuspended(_ value: Bool) { paused = value; lastTime = nil; displayLink?.isPaused = value || window == nil }

    private func commitRoundReceipt() -> Bool {
        guard !roundReceiptWritten,!disposed else { return !disposed }
        do { try onNextRoundPresented?(); roundReceiptWritten = true; onCue?(.roundShown); return !disposed }
        catch { finish(completed: false); return false }
    }

    private struct Pose {
        var scale: CGFloat = 1, alpha: CGFloat = 1, rotation: CGFloat = 0, rotationX: CGFloat = 0, rotationY: CGFloat = 0, z: CGFloat = 0
        static let hidden = Pose(scale: 0,alpha: 0)
        @MainActor func apply(_ view: UIView) {
            var transform = CATransform3DMakeTranslation(0,0,z)
            transform = CATransform3DRotate(transform,rotation * .pi/180,0,0,1)
            transform = CATransform3DRotate(transform,rotationY * .pi/180,0,1,0)
            transform = CATransform3DRotate(transform,rotationX * .pi/180,1,0,0)
            transform = CATransform3DScale(transform,scale,scale,1)
            view.layer.transform = transform; view.alpha = max(0,min(1,alpha))
        }
    }
    private static func entry(_ local: TimeInterval,digit: Bool = false,rotation: CGFloat = 0) -> Pose {
        guard local >= 0 else { return .hidden }
        let grow = digit ? 0.4 : 0.24,settle = digit ? 0.15 : 0.1,rebound = digit ? 0.2 : 0.1
        if local < grow {
            let p = NativeBoardMotion.Ease.backOut(2).sample(CGFloat(local/grow))
            return Pose(scale: 1.2*p,alpha: p,rotation: rotation,rotationX: -5*p,z: 20*p)
        }
        if local < grow+settle {
            let p = NativeBoardMotion.Ease.power2Out.sample(CGFloat((local-grow)/settle))
            return Pose(scale: 1.2-0.25*p,rotation: rotation,rotationX: -5*(1-p),z: 20*(1-p))
        }
        if local < grow+settle+rebound {
            let p = NativeBoardMotion.Ease.backOut(1.5).sample(CGFloat((local-grow-settle)/rebound))
            return Pose(scale: 0.95+0.05*p,rotation: rotation)
        }
        return Pose(rotation: rotation)
    }
    private static func exit(_ local: TimeInterval,index: Int,rotation: CGFloat,digit: Bool = false,startRotation: CGFloat = 0) -> Pose {
        let grow = digit ? 0.15 : 0.13,collapse = digit ? 0.3 : 0.17
        guard local >= 0 else { return Pose(rotation: startRotation) }
        if local < grow {
            let p = NativeBoardMotion.Ease.power2Out.sample(CGFloat(local/grow))
            return Pose(scale: 1+0.1*p,rotation: startRotation,z: 30*p)
        }
        let p = NativeBoardMotion.Ease.power2In.sample(CGFloat(min(1,(local-grow)/collapse)))
        return Pose(scale: 1.1*(1-p),alpha: 1-p,rotation: startRotation+(rotation-startRotation)*p,
                    rotationX: (index % 2 == 0 ? 45 : -45)*p,rotationY: (index % 2 == 0 ? 30 : -30)*p,z: 30-130*p)
    }

    private func paint(_ time: TimeInterval) {
        guard !disposed else { return }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }
        if time < roundStart && !continuationOnly {
            nextCard.isHidden = true; clearCard.isHidden = false
            if time >= 0.06 && !sentThumbWhoosh { sentThumbWhoosh = true; onCue?(.thumbWhoosh) }
            if time >= 0.48 && !sentThumbArrival { sentThumbArrival = true; onCue?(.heavyHaptic) }
            for (index,label) in titleGlyphs.enumerated() {
                let pose = time < clearExitStart ? Self.entry(time-Double(index)*0.02)
                    : Self.exit(time-clearExitStart-Double(index)*0.012,index: index,rotation: exitAngles[index])
                pose.apply(label)
            }
            for (index,label) in subtitleGlyphs.enumerated() {
                let combined = index+titleGlyphs.count
                let pose = time < clearExitStart ? Self.entry(time-titleEnterEnd-Double(index)*0.02)
                    : Self.exit(time-clearExitStart-Double(combined)*0.012,index: combined,rotation: exitAngles[combined])
                pose.apply(label)
            }
            paintThumb(time)
            shake(clearCard,time: time-0.48,thumbArrival: true)
        } else {
            guard roundReceiptWritten || commitRoundReceipt() else { return }
            clearCard.isHidden = true; nextCard.isHidden = false
            for (index,label) in roundGlyphs.enumerated() {
                let pose = time < roundExitStart ? Self.entry(time-roundStart-Double(index)*0.02)
                    : Self.exit(time-roundExitStart-Double(index)*0.012,index: index,
                                rotation: exitAngles[titleGlyphs.count+subtitleGlyphs.count+index])
                pose.apply(label)
            }
            var latestDigitStart: TimeInterval?
            for (index,digit) in digits.enumerated() {
                let start = roundStart+Double(index)*0.3
                if time >= start {
                    latestDigitStart = start
                    if !enteredDigits.contains(index) { enteredDigits.insert(index); onCue?(.digitEntered(index)) }
                }
                let pose = time < roundExitStart ? Self.entry(time-start,digit: true,rotation: digitAngles[index])
                    : Self.exit(time-roundExitStart-Double(index)*0.4,index: index,rotation: index % 2 == 0 ? 15 : -15,
                                digit: true,startRotation: digitAngles[index])
                pose.apply(digit)
            }
            if time >= roundExitStart && !sentDigitExit { sentDigitExit = true; onCue?(.digitExitStarted) }
            shake(stage,time: latestDigitStart.map { time-$0 } ?? -1,thumbArrival: false)
        }
    }

    private func paintThumb(_ time: TimeInterval) {
        var pose = Pose.hidden, y: CGFloat = -24
        var shadowAlpha: CGFloat = 0, shadowX: CGFloat = 0.68, shadowY: CGFloat = 0.72
        if time >= 0.06 {
            let p = NativeBoardMotion.Ease.backOut(2.05).sample(CGFloat(min(1,(time-0.06)/0.42)))
            pose = Pose(scale: p,alpha: p,rotation: -8*(1-p)); y = -24*(1-p)
        }
        if time >= 0.08 {
            let p = NativeBoardMotion.Ease.power2Out.sample(CGFloat(min(1,(time-0.08)/0.24)))
            shadowAlpha = p; shadowX = 0.68+0.32*p; shadowY = 0.72+0.28*p
        }
        if time >= 0.48 && time < 0.74 {
            let local = time-0.48
            pose.scale = local < 0.08 ? 1+0.14*NativeBoardMotion.Ease.power2Out.sample(CGFloat(local/0.08))
                : 1.14-0.14*NativeBoardMotion.Ease.backOut(2.2).sample(CGFloat((local-0.08)/0.18))
        }
        if time >= clearReady && time < clearExitStart {
            let phase = (time-clearReady).truncatingRemainder(dividingBy: 1.64)/0.82
            let progress = NativeBoardMotion.Ease.sineInOut.sample(CGFloat(phase <= 1 ? phase : 2-phase))
            y = -8*progress; pose.rotation = 2.5*progress
        }
        if time >= clearExitStart {
            let idlePhase = (clearExitStart-clearReady).truncatingRemainder(dividingBy: 1.64)/0.82
            let held = NativeBoardMotion.Ease.sineInOut.sample(CGFloat(idlePhase <= 1 ? idlePhase : 2-idlePhase))
            let p = NativeBoardMotion.Ease.backIn(1.8).sample(CGFloat(min(1,max(0,time-clearExitStart-0.02)/0.28)))
            y = -8*held+(28+8*held)*p
            pose = Pose(scale: 1-p,alpha: 1-p,rotation: 2.5*held+(9-2.5*held)*p)
            let fade = NativeBoardMotion.Ease.power2In.sample(CGFloat(min(1,max(0,time-clearExitStart-0.04)/0.18)))
            shadowAlpha = 1-fade; shadowX = 1-0.38*fade; shadowY = shadowX
        }
        pose.apply(thumb); thumb.layer.position = CGPoint(x: thumbRest.x,y: thumbRest.y+y)
        shadow.alpha = max(0,min(1,shadowAlpha)); shadow.transform = CGAffineTransform(scaleX: shadowX,y: shadowY)
    }

    private func shake(_ view: UIView,time: TimeInterval,thumbArrival: Bool) {
        let poses: [(CGFloat,CGFloat,CGFloat,Double)] = thumbArrival
            ? [(-14,5,-2.8,0.055),(13,-4,2.6,0.055),(-10,3,-2,0.05),(8,-2,1.6,0.05),(-5,1.5,-1,0.045),(3,-1,0.6,0.045),(0,0,0,0.12)]
            : [(-18,7,-0.6,0.05),(16,-6,0.6,0.055),(-13,5,-0.45,0.05),(10,-4,0.35,0.05),(-7,3,-0.25,0.045),(5,-2,0.18,0.045),(-3,1,-0.1,0.04),(0,0,0,0.14)]
        guard time >= 0 else { view.transform = .identity; return }
        var passed: TimeInterval = 0, previous: (CGFloat,CGFloat,CGFloat) = (0,0,0)
        for (index,pose) in poses.enumerated() {
            if time <= passed+pose.3 {
                let ease: NativeBoardMotion.Ease = index == 0 ? .power2Out : index == poses.count-1 ? .backOut(thumbArrival ? 2.4 : 2.2) : .power2InOut
                let p = ease.sample(CGFloat((time-passed)/pose.3))
                let x = previous.0+(pose.0-previous.0)*p,y = previous.1+(pose.1-previous.1)*p,rotation = previous.2+(pose.2-previous.2)*p
                view.transform = CGAffineTransform(translationX: x,y: y).rotated(by: rotation * .pi/180); return
            }
            passed += pose.3; previous = (pose.0,pose.1,pose.2)
        }
        view.transform = .identity
    }

    private func finish(completed: Bool) {
        guard !disposed else { return }
        disposed = true; displayLink?.invalidate(); displayLink = nil; clockTarget.owner = nil
        observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        onCue?(.finished)
        let completion = onFinished; onFinished = nil; onNextRoundPresented = nil; onCue = nil
        removeFromSuperview(); completion?(completed)
    }
    func dispose() { finish(completed: false) }
}

@MainActor
private final class NativeArcadeDisplayTarget: NSObject {
    weak var owner: NativeArcadeRoundPresentation?
    @objc func tick(_ link: CADisplayLink) { owner?.tick(link) }
}

private final class NativeArcadeThumbShadow: UIView {
    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext(),let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: [UIColor(red: 185.0/255,green: 105.0/255,blue: 62.0/255,alpha: 0.32).cgColor,
                     UIColor(red: 185.0/255,green: 105.0/255,blue: 62.0/255,alpha: 0.16).cgColor,
                     UIColor(red: 185.0/255,green: 105.0/255,blue: 62.0/255,alpha: 0).cgColor] as CFArray,
            locations: [0,0.46,0.78]) else { return }
        context.translateBy(x: rect.midX,y: rect.midY); context.scaleBy(x: rect.width/2,y: rect.height/2)
        context.drawRadialGradient(gradient,startCenter: .zero,startRadius: 0,endCenter: .zero,endRadius: 1,options: [.drawsAfterEndLocation])
    }
}
