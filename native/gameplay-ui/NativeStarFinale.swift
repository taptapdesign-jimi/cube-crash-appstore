import SpriteKit

/// One finite SpriteKit screen-blend renderer for the source core Star field.
/// UIKit glyphs sample this same clock, with no independent presentation timer.
@MainActor
final class NativeStarFinale: SKNode {
    var onGlyphClock: ((TimeInterval,Bool) -> Void)?
    let duration: TimeInterval
    private let particles: [(SKSpriteNode,NativeStarBurstMotion.Plan)]
    private let viewport: CGSize
    private var retired = Set<Int>(),disposed = false
    init(textures: NativeBoardTextures,viewport: CGSize,random: () -> Double = { Double.random(in: 0..<1) }) {
        self.viewport = viewport
        let plans = NativeStarBurstMotion.make(viewport: viewport,random: random)
        duration = max(2.15,max(1.2,(plans.map(\.end).max() ?? 0)+0.45)+0.05)
        let texture = textures.texture("assets/small-star.png")
        particles = plans.map { plan in
            let sprite = SKSpriteNode(texture: texture)
            let dimensions = texture?.size() ?? CGSize(width: 1,height: 1),ratio = plan.size/max(1,max(dimensions.width,dimensions.height))
            sprite.size = CGSize(width: dimensions.width*ratio,height: dimensions.height*ratio)
            sprite.blendMode = .screen; sprite.alpha = 0
            return (sprite,plan)
        }
        super.init(); name = "native-core-star-finale"
        particles.forEach { addChild($0.0) }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private var completion: (() -> Void)?
    func play(completion: @escaping () -> Void) {
        guard !disposed,self.completion == nil else { return }
        self.completion = completion
        run(.sequence([.customAction(withDuration: duration) { [weak self] _,elapsed in self?.paint(seconds: Double(elapsed)) },
            .run { [weak self] in guard let self,!self.disposed else { return }; self.dispose() }]),withKey: "star-field")
    }
    private func paint(seconds: TimeInterval) {
        guard !disposed else { return }
        onGlyphClock?(seconds,false)
        for (index,particle) in particles.enumerated() where !retired.contains(index) {
            let (sprite,plan) = particle
            if seconds >= plan.end { sprite.alpha = 0; retired.insert(index); continue }
            let pose = plan.sample(seconds: seconds)
            sprite.position = CGPoint(x: pose.point.x,y: viewport.height-pose.point.y)
            sprite.setScale(pose.scale); sprite.alpha = pose.alpha; sprite.zRotation = -pose.rotation * .pi/180
        }
    }
    func dispose() {
        guard !disposed else { return }; disposed = true
        removeAllActions(); removeFromParent(); onGlyphClock?(duration,true); onGlyphClock = nil
        removeAllChildren()
        let finished = completion; completion = nil; finished?()
    }
}
