import UIKit

/// Preserved Honey bees follow their own exact finite routes and spacing.
@MainActor
final class NativeHoneyFinalePresentation: NativeFinitePresentation {
    private let plans: [NativeHoneyFinaleMotion.Plan]
    private var images: [UIImageView] = [],offsets: [CGPoint]
    private let glyphs: NativeSplashGlyphField
    private var emittedPost = false
    init(resourceRoot: URL,viewport: CGSize,random: @escaping () -> Double = { Double.random(in: 0..<1) }) {
        plans = NativeHoneyFinaleMotion.make(viewport: viewport,random: random)
        offsets = Array(repeating: .zero,count: plans.count)
        let artwork = JimiV9Artwork(resourceRoot: resourceRoot)
        glyphs = NativeSplashGlyphField(artwork: artwork,text: "BUZZING!",
            colors: [UIColor(red: 1,green: 193.0/255,blue: 79.0/255,alpha: 1),UIColor(red: 208.0/255,green: 120.0/255,blue: 77.0/255,alpha: 1)],splitIndex: 4,random: random)
        super.init(viewport: viewport,duration: 3.16)
        clipsToBounds = true; accessibilityIdentifier = "native-honey-finale"
        for plan in plans {
            let image = UIImageView(image: artwork.image("assets/shop/honey/bee\(plan.assetIndex).png",densityAware: true))
            image.contentMode = .scaleAspectFit; image.bounds = CGRect(x: 0,y: 0,width: plan.size.rounded(),height: plan.size.rounded())
            image.alpha = 0; addSubview(image); images.append(image)
        }
        addSubview(glyphs)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() { super.layoutSubviews(); glyphs.frame = bounds }
    override func paint(seconds: TimeInterval) {
        if !emittedPost { emittedPost = true; onCue?("post",0) }
        let poses = plans.map { $0.sample(seconds: seconds) }
        NativeHoneyFinaleMotion.relax(plans: plans,poses: poses,offsets: &offsets)
        for (index,pose) in poses.enumerated() {
            let offset = offsets[index]
            images[index].layer.position = CGPoint(x: pose.point.x+(offset.x*100).rounded()/100,y: pose.point.y+(offset.y*100).rounded()/100)
            images[index].transform = CGAffineTransform(rotationAngle: pose.rotation * .pi/180).scaledBy(x: pose.scale,y: pose.scale)
            images[index].alpha = pose.alpha
        }
        glyphs.paint(seconds: seconds)
    }
}
