import UIKit

/// Source splash-text-overlay.ts glyph owner sampled by its finale's clock.
/// Every letter keeps its original font, per-letter size, palette and 3D pose.
@MainActor
final class NativeSplashGlyphField: UIView {
    private struct Glyph { let label: UILabel; let index: Int; let bounce: CGFloat; var exitRotation: CGFloat; let splitLabels: [UILabel]; let glowLabels:[UILabel] }
    private var glyphs: [Glyph] = []
    private let container = UIView()
    let exitStart: TimeInterval
    let duration: TimeInterval
    private let roboNameplate:Bool
    private let compactLaser: Bool
    private var exitRotationsCaptured:Bool
    init(artwork: JimiV9Artwork,text: String,colors: [UIColor],splitIndex: Double,
         letterColors: [UIColor]? = nil,letterOpacityRange: ClosedRange<Double>? = nil,compactLaser: Bool = false,neonGlow: Bool = false,deferExitRotationCapture:Bool = false,
         random: () -> Double = { Double.random(in: 0..<1) }) {
        let letters = Array(text)
        roboNameplate = text == "BIBI - RIBI"
        self.compactLaser = compactLaser
        exitRotationsCaptured = !deferExitRotationCapture
        exitStart = compactLaser ? .infinity : 0.3+Double(max(0,letters.count-1))*0.05+0.54
        duration = compactLaser ? 0.04+Double(max(0,letters.count-1))*0.025+0.28 : exitStart+Double(max(0,letters.count-1))*0.06+0.60+0.05
        super.init(frame: .zero)
        isUserInteractionEnabled = false; backgroundColor = .clear
        container.backgroundColor = .clear; addSubview(container)
        container.transform = CGAffineTransform(rotationAngle: CGFloat(random()-0.5)*30 * .pi/180)
        var perspective = CATransform3DIdentity; perspective.m34 = -1/1000
        container.layer.sublayerTransform = perspective
        let buckets: [[Double]] = [[92,98,104],[66,72,80],[30,36,44,50],[66,72,80],[92,98,104],[30,36,44,50],[66,72,80],[30,36,44,50],[92,98,104]]
        let offset = min(buckets.count-1,max(0,Int(random()*Double(buckets.count))))
        var sizes: [CGFloat] = []
        for index in letters.indices {
            let bucket = buckets[(index+offset)%buckets.count]
            let base = bucket[min(bucket.count-1,max(0,Int(random()*Double(bucket.count))))]
            sizes.append(CGFloat((max(index == 0 ? 75 : 28,base+random()*10-5)*10).rounded()/10))
        }
        for (index,character) in letters.enumerated() {
            let label = UILabel(); label.text = String(character); label.font = artwork.font(size: sizes[index],weight: "ExtraBold")
            let opacityRange = letterOpacityRange ?? 0.8...1.0
            let opacity = (min(1,max(0,opacityRange.lowerBound+(opacityRange.upperBound-opacityRange.lowerBound)*random()))*100).rounded()/100
            let palette = colors.isEmpty ? [UIColor.white] : colors
            let color = letterColors.flatMap { index < $0.count ? $0[index] : nil } ?? palette[min(palette.count-1,Double(index) < splitIndex ? 0 : 1)]
            label.textColor = color.withAlphaComponent(opacity)
            var splitLabels: [UILabel] = []
            if letterColors == nil,splitIndex.rounded(.down) == Double(index),splitIndex != splitIndex.rounded(.down),palette.count > 1 {
                label.textColor = .clear
                for side in 0..<2 {
                    let half = UILabel(); half.text = label.text; half.font = label.font; half.textAlignment = .center
                    half.textColor = palette[side].withAlphaComponent(opacity); half.backgroundColor = .clear
                    half.layer.mask = CAShapeLayer(); label.addSubview(half); splitLabels.append(half)
                }
            }
            var glowLabels:[UILabel] = []
            if neonGlow {
                let layers:[(CGFloat,UIColor,Float)]=[
                    (6,UIColor(red:240.0/255,green:1,blue:1,alpha:1),0.98),
                    (14,UIColor(red:153.0/255,green:252.0/255,blue:1,alpha:1),0.95),
                    (30,UIColor(red:88.0/255,green:238.0/255,blue:250.0/255,alpha:1),0.82),
                    (48,UIColor(red:6.0/255,green:244.0/255,blue:1,alpha:1),0.62)]
                for (radius,color,opacity) in layers.reversed() {
                    let glow=UILabel();glow.text=label.text;glow.font=label.font;glow.textAlignment = .center;glow.textColor=label.textColor
                    glow.layer.shadowColor=color.cgColor;glow.layer.shadowOpacity=opacity;glow.layer.shadowRadius=radius;glow.layer.shadowOffset = .zero
                    glow.backgroundColor = .clear;glow.isUserInteractionEnabled=false;label.addSubview(glow);glowLabels.append(glow)
                }
            }
            label.textAlignment = .center; label.backgroundColor = .clear; label.layer.isDoubleSided = false
            label.alpha = 0; container.addSubview(label)
            glyphs.append(Glyph(label: label,index: index,bounce: 1.02+CGFloat(random())*0.06,exitRotation: deferExitRotationCapture ? 12:CGFloat(12+random()*8),splitLabels: splitLabels,glowLabels:glowLabels))
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() {
        super.layoutSubviews()
        let widths = glyphs.map { ($0.label.text! as NSString).size(withAttributes: [.font: $0.label.font as Any]).width }
        let before:[CGFloat]=glyphs.map {glyph in glyph.index==0 ? 0:roboNameplate && glyph.label.text=="-" ? 3:-4.2}
        let after:[CGFloat]=glyphs.map {glyph in roboNameplate && glyph.label.text=="-" ? 7:0}
        let total = widths.reduce(0,+)+before.reduce(0,+)+after.reduce(0,+)
        let height = glyphs.map { $0.label.font.lineHeight }.max() ?? 0
        container.bounds = CGRect(x: 0,y: 0,width: total,height: height); container.center = CGPoint(x: bounds.midX,y: bounds.midY)
        var x: CGFloat = 0
        for (index,glyph) in glyphs.enumerated() {
            x += before[index]
            glyph.label.bounds = CGRect(x: 0,y: 0,width: widths[index],height: height)
            glyph.label.center = CGPoint(x: x+widths[index]/2,y: height/2)
            glyph.glowLabels.forEach {$0.frame = glyph.label.bounds}
            for (side,half) in glyph.splitLabels.enumerated() {
                half.frame = glyph.label.bounds
                (half.layer.mask as? CAShapeLayer)?.path = CGPath(rect: CGRect(x: CGFloat(side)*widths[index]/2,y: 0,width: widths[index]/2,height: height),transform: nil)
            }
            x += widths[index]+after[index]
        }
    }
    func captureExitRotations(random:()->Double) {
        guard !exitRotationsCaptured else {return};exitRotationsCaptured=true
        for index in glyphs.indices {glyphs[index].exitRotation=CGFloat(12+random()*8)}
    }
    func paint(seconds: TimeInterval) {
        CATransaction.begin(); CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }
        for glyph in glyphs {
            let enter = compactLaser ? 0.04+Double(glyph.index)*0.025 : 0.3+Double(glyph.index)*0.05
            let firstDuration = compactLaser ? 0.16 : 0.3
            let settleDuration = compactLaser ? 0.06 : 0.12
            let settleEnd = firstDuration+settleDuration,finalEnd = firstDuration+settleDuration*2
            let local = seconds-enter
            var scale: CGFloat = 0,alpha: CGFloat = 0,rx: CGFloat = 0,ry: CGFloat = 0,rz: CGFloat = 0,z: CGFloat = 0
            if local >= 0 && local < firstDuration {
                let p = NativeBoardMotion.Ease.backOut(2).sample(CGFloat(local/firstDuration))
                scale = 1.2*p; alpha = p; rx = -5*p; z = 20*p
            } else if local >= firstDuration && local < settleEnd {
                let p = NativeBoardMotion.Ease.power2Out.sample(CGFloat((local-firstDuration)/settleDuration))
                scale = 1.2-0.25*p; alpha = 1; rx = -5*(1-p); z = 20*(1-p)
            } else if local >= settleEnd && local < finalEnd {
                scale = 0.95+0.05*NativeBoardMotion.Ease.backOut(1.5).sample(CGFloat((local-settleEnd)/settleDuration)); alpha = 1
            } else if local >= finalEnd {
                scale = idleScale(glyph,time: min(seconds,exitStart)-enter-finalEnd); alpha = 1
            }
            let exit = seconds-exitStart-Double(glyph.index)*0.06
            if seconds >= exitStart {
                let held = idleScale(glyph,time: exitStart-enter-0.54)
                scale = held; alpha = 1
                if exit >= 0 && exit < 0.19 {
                    let p = NativeBoardMotion.Ease.power2Out.sample(CGFloat(exit/0.19))
                    scale = held+(1.1-held)*p; z = 30*p
                } else if exit >= 0.19 {
                    let p = NativeBoardMotion.Ease.power2In.sample(CGFloat(min(1,(exit-0.19)/0.41)))
                    scale = 1.1*(1-p); alpha = 1-p; rz = glyph.exitRotation*p; rx = 45*p; ry = 30*p; z = 30-130*p
                }
            }
            var transform = CATransform3DMakeTranslation(0,0,z)
            transform = CATransform3DRotate(transform,rz * .pi/180,0,0,1)
            transform = CATransform3DRotate(transform,ry * .pi/180,0,1,0)
            transform = CATransform3DRotate(transform,rx * .pi/180,1,0,0)
            glyph.label.layer.transform = CATransform3DScale(transform,scale,scale,1)
            glyph.label.alpha = min(1,max(0,alpha))
        }
    }
    private func idleScale(_ glyph: Glyph,time: TimeInterval) -> CGFloat {
        let phase = max(0,time).truncatingRemainder(dividingBy: 0.7)/0.35, p = phase <= 1 ? phase : 2-phase
        func elasticOut(_ t: Double) -> Double { t == 0 ? 0 : t == 1 ? 1 : pow(2,-10*t)*sin((t-0.05)*(.pi*2/0.2))+1 }
        let eased = p < 0.5 ? (1-elasticOut(1-p*2))/2 : 0.5+elasticOut((p-0.5)*2)/2
        return 1+(glyph.bounce-1)*CGFloat(eased)
    }
}
