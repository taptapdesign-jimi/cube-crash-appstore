import SpriteKit

/// Original core Juice emission and prop routes share one live SpriteKit clock.
/// Each admitted bubble starts at its real birth; score/model decisions stay
/// with the captured transaction owner outside this finite renderer.
@MainActor
final class NativeJuiceFinale: SKNode {
    var onGlyphClock: ((TimeInterval,Bool) -> Void)?
    var onCue: ((String,Int) -> Void)?
    var onGameplayReady: (() -> Void)?
    let assetReady: Bool
    let maximumDuration: TimeInterval = 5.4
    private let viewport: CGSize,random: () -> Double
    private let bubbleTextures: [SKTexture]
    private let freePool: [SKSpriteNode]
    private var active: [Int:(NativeJuiceBubbleMotion,TimeInterval)] = [:]
    private let props: [(SKSpriteNode,NativeJuicePropMotion)]
    private var textBubbles: [(SKSpriteNode,NativeTextBubbleMotion.Player)]
    private var scheduler = NativeJuiceBirthScheduler()
    private var completedProps = Set<Int>(),launchedProps = Set<Int>()
    private var tickCount = 1,started = false,disposed = false,introPlayed = false,released = false
    private var completion: (() -> Void)?
    private var lastSeconds: TimeInterval = 0
    var spawnedBubbleCount: Int { scheduler.spawned }
    var activeBubbleCount: Int { active.count }
    var hasActiveClock: Bool { action(forKey: "juice-field") != nil }
    init(textures: NativeBoardTextures,viewport: CGSize,random: @escaping () -> Double = { Double.random(in: 0..<1) }) {
        self.viewport = viewport; self.random = random
        let loaded = NativeJuiceBubbleMotion.sources.compactMap { textures.texture($0) }
        bubbleTextures = loaded
        let textPlans = NativeTextBubbleMotion.make(viewport: viewport,random: random)
        textBubbles = textPlans.map { plan in
            let path = "assets/animations/bubble\(plan.index%8+1).png",texture = textures.texture(path),sprite = SKSpriteNode(texture: texture)
            let dimensions = textures.logicalSize(path) ?? CGSize(width: 1,height: 1),ratio = plan.size/max(1,max(dimensions.width,dimensions.height))
            sprite.size = CGSize(width: dimensions.width*ratio,height: dimensions.height*ratio)
            sprite.blendMode = .screen; sprite.alpha = 0; sprite.zPosition = 100
            return (sprite,NativeTextBubbleMotion.Player(plan))
        }
        props = NativeJuicePropMotion.make(viewport: viewport,random: random).map { plan in
            let path = "assets/shop/juice/\(plan.prop.asset).png",texture = textures.texture(path),sprite = SKSpriteNode(texture: texture)
            let dimensions = textures.logicalSize(path) ?? CGSize(width: 1,height: 1)
            sprite.size = CGSize(width: plan.size,height: dimensions.height*plan.size/max(1,dimensions.width))
            sprite.position = CGPoint(x: plan.startX,y: viewport.height-plan.startY); sprite.zPosition = plan.depth
            return (sprite,plan)
        }
        freePool = (0..<34).map { _ in let sprite = SKSpriteNode(); sprite.isHidden = true; return sprite }
        assetReady = loaded.count == 8 && props.allSatisfy { $0.0.texture != nil } && textBubbles.allSatisfy { $0.0.texture != nil }
        super.init(); name = "native-core-juice-finale"
        freePool.forEach(addChild); props.forEach { addChild($0.0) }; textBubbles.forEach { addChild($0.0) }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func play(completion: @escaping () -> Void) {
        guard !started,!disposed,assetReady else { completion(); return }
        started = true; self.completion = completion
        onCue?("bubble",0)
        for _ in 0..<9 { admit(seconds: 0) }
        paint(seconds: 0)
        run(.sequence([.customAction(withDuration: maximumDuration) { [weak self] _,time in self?.paint(seconds: Double(time)) },
            .run { [weak self] in self?.dispose() }]),withKey: "juice-field")
    }
    private func admit(seconds: TimeInterval) {
        guard let index = freePool.indices.first(where: { active[$0] == nil }) else { return }
        let plan = NativeJuiceBubbleMotion.make(viewport: viewport,random: random),sprite = freePool[index]
        sprite.texture = bubbleTextures[plan.assetIndex]; sprite.size = bubbleTextures[plan.assetIndex].size()
        sprite.isHidden = false; sprite.alpha = plan.alpha; sprite.setScale(plan.scale)
        sprite.position = CGPoint(x: plan.start.x,y: viewport.height-plan.start.y)
        active[index] = (plan,seconds)
    }
    func paint(seconds: TimeInterval) {
        guard started,!disposed else { return }; lastSeconds = seconds; tickCount += 1
        onGlyphClock?(seconds,false)
        for index in Array(active.keys) {
            guard let (plan,birth) = active[index] else { continue }
            if seconds >= birth+plan.duration { active.removeValue(forKey: index); freePool[index].isHidden = true; continue }
            let pose = plan.sample(seconds: seconds-birth),sprite = freePool[index]
            sprite.position = CGPoint(x: pose.point.x,y: viewport.height-pose.point.y); sprite.setScale(pose.scale)
        }
        for index in textBubbles.indices {
            let pose = textBubbles[index].1.sample(seconds: seconds),sprite = textBubbles[index].0
            sprite.position = CGPoint(x: pose.x,y: viewport.height-pose.y); sprite.setScale(pose.scale); sprite.alpha = pose.alpha
        }
        for (index,prop) in props.enumerated() where !completedProps.contains(index) {
            let (sprite,plan) = prop
            if seconds >= plan.delay && !launchedProps.contains(index) { launchedProps.insert(index); onCue?(plan.prop.rawValue,0) }
            if seconds >= plan.delay+plan.duration { completedProps.insert(index); sprite.removeFromParent(); continue }
            let pose = plan.sample(progress: CGFloat((seconds-plan.delay)/plan.duration))
            sprite.position = CGPoint(x: pose.point.x,y: viewport.height-pose.point.y); sprite.zRotation = -pose.rotation
        }
        // The source intro is tied to the same alternating spawn ticker.
        if tickCount%2 == 0 && seconds >= 0.8 && !introPlayed { introPlayed = true; onCue?("introBubble",0) }
        if !released && seconds >= 1.86 { released = true; let ready = onGameplayReady; onGameplayReady = nil; ready?() }
        let births = scheduler.tick(seconds: seconds,activeCount: active.count)
        for _ in 0..<births { admit(seconds: seconds) }
        if tickCount%5 == 0 && seconds > 0.0005 {
            for index in active.keys { let sprite = freePool[index],y = viewport.height-sprite.position.y; sprite.isHidden = y < -50 || y > viewport.height+50 }
            for (index,prop) in props.enumerated() where !completedProps.contains(index) {
                let y = viewport.height-prop.0.position.y; prop.0.isHidden = y < -50 || y > viewport.height+50
            }
        }
        if (scheduler.lastPhaseEnded && active.isEmpty && completedProps.count == props.count && seconds >= 2.15)
            || seconds >= 3.9 && !scheduler.lastPhaseEnded || seconds >= maximumDuration { dispose() }
    }
    func dispose() {
        guard !disposed else { return }; disposed = true
        removeAllActions(); removeFromParent(); removeAllChildren(); active.removeAll()
        onGlyphClock?(lastSeconds,true); onGlyphClock = nil; onCue = nil; onGameplayReady = nil
        let completed = completion; completion = nil; completed?()
    }
}
