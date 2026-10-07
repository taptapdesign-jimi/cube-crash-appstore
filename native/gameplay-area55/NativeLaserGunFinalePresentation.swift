import UIKit

/// The authored final-pair / zero-target LaserGun fake-out. No beams or bonus targets are fabricated.
@MainActor
final class NativeLaserGunFinalePresentation: NativeFinitePresentation {
    let generation: UInt64
    let assetReady: Bool
    private let gun = UIView(),orientation = UIView(),image = UIImageView()
    private let frames: [UIImage]
    private let activeScale: Double
    private let origin: CGPoint
    private let glyphs: NativeSplashGlyphField
    private var bitmapIndex = -1
    // tnt-animation's onFireReady at .04 × LASERGUN_TIMING_SCALE (.455).
    static let handoffDelay = 0.0182
    init(resourceRoot: URL,viewport: CGSize,origin: CGPoint,generation: UInt64,
         random: () -> Double = { Double.random(in: 0..<1) }) {
        self.generation = generation; self.origin = origin
        let artwork = JimiV9Artwork(resourceRoot: resourceRoot)
        frames = (1...3).compactMap { artwork.image("assets/shop/gun/lasergun\($0)@2x.png") }
        assetReady = origin.x.isFinite && origin.y.isFinite && viewport.width > 0 && viewport.height > 0 && frames.count == 3 && FileManager.default.fileExists(atPath: resourceRoot.appendingPathComponent("assets/fonts/Baloo2-ExtraBold.ttf").path)
        var scales = [1.0,0.875,0.75]
        for i in stride(from: scales.count-1,through: 1,by: -1) {
            let j = min(i,max(0,Int(random()*Double(i+1)))); scales.swapAt(i,j)
        }
        activeScale = scales[0]
        glyphs = NativeSplashGlyphField(artwork: artwork,text: "ZAPED OUT",
            colors: [UIColor(red: 243/255,green: 166/255,blue: 84/255,alpha: 1),UIColor(red: 238/255,green: 147/255,blue: 67/255,alpha: 1)],
            splitIndex: 6,compactLaser: true,random: random)
        super.init(viewport: viewport,duration: Self.handoffDelay+0.72)
        clipsToBounds = true
        addSubview(gun); gun.addSubview(orientation); orientation.addSubview(image); addSubview(glyphs)
        image.contentMode = .scaleAspectFit; image.layer.anchorPoint = CGPoint(x: 0.24,y: 0.32)
        gun.layer.zPosition = 1; glyphs.layer.zPosition = 2
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func start() { guard assetReady else { dispose(); return }; super.start() }
    override func layoutSubviews() {
        super.layoutSubviews()
        let layout = NativeArea55Motion.laserLayout(origin: origin,viewport: bounds.size,scale: activeScale)
        let size = CGSize(width: layout.width,height: layout.width*183/200)
        gun.bounds = CGRect(origin: .zero,size: size); orientation.bounds = gun.bounds
        orientation.center = CGPoint(x: size.width/2,y: size.height/2)
        image.bounds = gun.bounds; image.layer.position = CGPoint(x: size.width*0.24,y: size.height*0.32)
        orientation.transform = layout.left ? CGAffineTransform(rotationAngle: .pi/4).scaledBy(x: -1,y: 1) : .identity
        glyphs.frame = bounds; glyphs.layoutIfNeeded()
    }
    override func paint(seconds: TimeInterval) {
        let layout = NativeArea55Motion.laserLayout(origin: origin,viewport: bounds.size,scale: activeScale)
        let t = max(0,seconds-Self.handoffDelay)
        let entry = Double(NativeBoardMotion.Ease.backOut(2.35).sample(CGFloat(min(1,t/0.30))))
        let exit = pow(NativeArea55Motion.clamp((t-0.395)/0.325),3)
        let x = t < 0.395 ? layout.offscreen*(1-entry) : layout.offscreen*exit
        let scale = 0.65+(activeScale-0.65)*entry
        gun.center = CGPoint(x: layout.x+x,y: layout.y)
        gun.transform = CGAffineTransform(rotationAngle: layout.left ? 0 : -8 * .pi/180).scaledBy(x: scale,y: scale)
        gun.alpha = CGFloat(t < 0.395 ? NativeArea55Motion.clamp(entry) : 1-exit)
        gun.isHidden = seconds < Self.handoffDelay || t >= 0.72
        let frame = t < 0.19 ? 0 : t < 0.245 ? 1 : t < 0.34 ? 2 : t < 0.395 ? 1 : 0
        if frame != bitmapIndex && frames.indices.contains(frame) { image.image = frames[frame]; bitmapIndex = frame }
        let p = NativeArea55Motion.clamp((t-0.06)/0.24)
        let amplitude = 1.05,period = 0.30,shift = period/(2 * .pi)*asin(1/amplitude)
        let elastic = p == 0 ? 0 : p == 1 ? 1 : amplitude*pow(2,-10*p)*sin((p-shift)*2 * .pi/period)+1
        image.transform = CGAffineTransform(scaleX: 0.88+0.12*elastic,y: 0.88+0.12*elastic)
        glyphs.paint(seconds: seconds)
    }
}
