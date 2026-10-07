import SpriteKit
import UIKit

/// Presentation identities match special-dice-registry.ts. Gameplay kind is
/// supplied by the engine; this registry never infers rules from artwork.
struct NativeDiceArtwork {
    let path: String
    var size = CGSize(width: 128, height: 128)
    var anchor = CGPoint(x: 0.5, y: 0.5)
    var idleSheet: NativeDiceSheet? = nil

    static func definition(kind: String, variant: String?, regularSkin: Int = 0) -> Self {
        if let variant, let skin = variants[variant] { return skin }
        switch kind {
        case "wild", "wild-star", "star":
            return Self(path: "assets/wild.png", idleSheet: .star)
        case "wild-juice", "juice":
            return Self(path: "assets/wild-juice.png", idleSheet: .juice)
        case "wild-magnet", "magnet":
            return Self(path: "assets/wild-magnet.png", size: CGSize(width: 122.88, height: 122.88))
        case "wild-tnt", "tnt": return Self(path: "assets/shop/explosion pack/tnt.png")
        default:
            let suffix = regularSkin % 4 == 0 ? "" : String(regularSkin % 4 + 1)
            return Self(path: "assets/tile_numbers\(suffix).png")
        }
    }

    static let variants: [String: Self] = [
        "fish": Self(path: "assets/shop/fish/fish.png"),
        "kanta": Self(path: "assets/shop/kanta/04.png", size: CGSize(width: 128 * 128 / 171, height: 128)),
        "bee": Self(path: "assets/shop/bee/bee1.png"),
        "laser-gun": Self(path: "assets/shop/gun/right gun.png", size: CGSize(width: 184.32, height: 184.32)),
        "spaceship": Self(path: "assets/shop/spaceship/spaceship.png", size: CGSize(width: 147.456, height: 147.456)),
        "bottle": Self(path: "assets/shop/bottle/glass bottle.png"),
        "honey": Self(path: "assets/shop/honey/honey.png"),
        "flower": Self(path: "assets/shop/bush/flower.png"),
        "barell": Self(path: "assets/shop/barell/barell-static.png", size: CGSize(width: 160.2, height: 207.9),
                       anchor: CGPoint(x: 0.5, y: 1 - 221.0 / 351.0), idleSheet: .barrel),
        "mushroom": Self(path: "assets/shop/mushroom/mushroom.png", idleSheet: .mushroom),
        "robo-cube": Self(path: "assets/shop/robo/robo-cube1.png", idleSheet: .robo),
        "cubero": Self(path: "assets/shop/cubero/cubero.png", size: CGSize(width: 170, height: 128)),
        "beach-ball": Self(path: "assets/shop/ball/ball.png", idleSheet: .ball)
    ]
}

/// Existing immutable WebP atlases retain the exact authored animation frames.
/// SKTexture rects are bottom-left coordinates; source atlases are top-left.
struct NativeDiceSheet {
    let path: String
    let atlas: CGSize
    let cell: CGSize
    let columns: Int
    let frameCount: Int
    let cycle: TimeInterval
    let anchor: CGPoint
    var activeDuration: TimeInterval? = nil
    var activeLoops = 1
    var restingDuration: TimeInterval = 0
    var displayScale: CGFloat = 1
    var offsetY: CGFloat = 0
    var animateDuringDrag = false

    func frame(at elapsed: TimeInterval) -> Int {
        let sequence = cycle * Double(activeLoops) + restingDuration
        let time = max(0, elapsed).truncatingRemainder(dividingBy: sequence)
        if time >= cycle * Double(activeLoops) { return 0 }
        let local = time.truncatingRemainder(dividingBy: cycle)
        let active = activeDuration ?? cycle
        if local >= active { return 0 }
        return min(frameCount - 1, Int(floor(local / active * Double(frameCount))))
    }

    static let star = Self(path: "assets/shop/star/star-pixi-sheet.webp", atlas: CGSize(width: 4077, height: 735),
        cell: CGSize(width: 151, height: 147), columns: 27, frameCount: 120, cycle: 2,
        anchor: CGPoint(x: 75.5 / 151, y: 1 - 86.39 / 147), animateDuringDrag: true)
    static let juice = Self(path: "assets/shop/juice/juice-pixi-sheet.webp", atlas: CGSize(width: 3999, height: 561),
        cell: CGSize(width: 129, height: 187), columns: 31, frameCount: 84, cycle: 2,
        anchor: CGPoint(x: 67.326 / 129, y: 1 - 119.38 / 187), activeDuration: 1.4, animateDuringDrag: true)
    static let mushroom = Self(path: "assets/shop/mushroom/mushroom-pixi-sheet.webp", atlas: CGSize(width: 3990, height: 608),
        cell: CGSize(width: 133, height: 152), columns: 30, frameCount: 120, cycle: 2,
        anchor: CGPoint(x: 69.0 / 133, y: 1 - 86.0 / 152))
    static let robo = Self(path: "assets/shop/robo/robo-pixi-sheet.webp", atlas: CGSize(width: 4077, height: 1032),
        cell: CGSize(width: 151, height: 172), columns: 27, frameCount: 144, cycle: 2.4,
        anchor: CGPoint(x: 79.5 / 151, y: 1 - 104.5 / 172))
    static let ball = Self(path: "assets/shop/ball/ball-pixi-sheet.webp", atlas: CGSize(width: 4048, height: 840),
        cell: CGSize(width: 176, height: 210), columns: 23, frameCount: 84, cycle: 1.4,
        anchor: CGPoint(x: 88.5 / 176, y: 1 - 149.65 / 210), offsetY: -56)
    static let barrel = Self(path: "assets/shop/barell/barell-pixi-sheet.webp", atlas: CGSize(width: 2430, height: 2106),
        cell: CGSize(width: 270, height: 351), columns: 9, frameCount: 54, cycle: 0.821428571,
        anchor: CGPoint(x: 0.5, y: 1 - 221.0 / 351), activeLoops: 2, restingDuration: 1,
        displayScale: 115.2 / 194)
}

@MainActor
final class NativeBoardTextures {
    private let root: URL
    private var textures: [String: SKTexture] = [:]
    private var logicalSizes: [String: CGSize] = [:]
    private var sheets: [String: [SKTexture]] = [:]
    private var waiting: [String: [([SKTexture]) -> Void]] = [:]
    private var generation = 0
    private var disposed = false
    private var phaseScheduler=NativeArtworkPhaseScheduler()
    private let io = DispatchQueue(label: "com.taptapdesign.stacktosix.native-board-art", qos: .userInitiated)

    init(root: URL) { self.root = root }

    func reserveIdlePhase(group:String,cycle:TimeInterval)->(id:Int,running:Bool) {
        let now=(CACurrentMediaTime()*1000).rounded(.down)
        let id=phaseScheduler.reserve(group:group,cycleMilliseconds:cycle*1000,now:now)
        return (id,phaseScheduler.entry(id)?.started==true)
    }
    func advanceIdlePhase(_ id:Int)->Bool {phaseScheduler.advance(id,now:(CACurrentMediaTime()*1000).rounded(.down))}
    func advanceIdlePhases() {phaseScheduler.advancePending(now:(CACurrentMediaTime()*1000).rounded(.down))}
    func releaseIdlePhase(_ id:Int) {phaseScheduler.release(id)}

    func texture(_ path: String, densityAware: Bool = true) -> SKTexture? {
        guard !disposed else { return nil }
        if let texture = textures[path] { return texture }
        let url = root.appendingPathComponent(path)
        var candidates: [(URL, CGFloat)] = [(url,1)]
        if densityAware {
            let density = min(3, max(1, Int(UIScreen.main.scale.rounded(.up))))
            if density > 1 {
                candidates = stride(from: density, through: 2, by: -1).map { scale in
                    (url.deletingLastPathComponent().appendingPathComponent(url.deletingPathExtension().lastPathComponent + "@\(scale)x." + url.pathExtension),CGFloat(scale))
                } + candidates
            }
        }
        for (candidate, density) in candidates {
            if let image = UIImage(contentsOfFile: candidate.path) {
                let texture = SKTexture(image: image)
                texture.filteringMode = .linear
                textures[path] = texture
                logicalSizes[path] = CGSize(width: image.size.width / density,height: image.size.height / density)
                return texture
            }
        }
        NSLog("[NATIVE_BOARD_ART] Missing image %@", path)
        return nil
    }

    func logicalSize(_ path: String) -> CGSize? {
        if let size = logicalSizes[path] { return size }
        _ = texture(path)
        return logicalSizes[path]
    }

    /// One serial decoder, one source per eligible family. No future variants
    /// are warmed. Disposed/stale completions cannot repopulate the cache.
    func prepare(_ spec: NativeDiceSheet, completion: @escaping ([SKTexture]) -> Void) {
        guard !disposed else { return }
        if let frames = sheets[spec.path] { completion(frames); return }
        if waiting[spec.path] != nil { waiting[spec.path, default: []].append(completion); return }
        waiting[spec.path] = [completion]
        let token = generation
        let url = root.appendingPathComponent(spec.path)
        io.async { [weak self] in
            let image = UIImage(contentsOfFile: url.path)
            DispatchQueue.main.async { [weak self] in
                guard let self, !self.disposed, token == self.generation else { return }
                let callbacks = self.waiting.removeValue(forKey: spec.path) ?? []
                guard let image, let cgImage = image.cgImage,
                      cgImage.width == Int(spec.atlas.width), cgImage.height == Int(spec.atlas.height) else {
                    NSLog("[NATIVE_BOARD_ART] Missing/invalid atlas %@", spec.path)
                    callbacks.forEach { $0([]) }
                    return
                }
                let source = SKTexture(cgImage: cgImage)
                source.filteringMode = .linear
                let frames = (0..<spec.frameCount).map { index -> SKTexture in
                    let x = CGFloat(index % spec.columns) * spec.cell.width / spec.atlas.width
                    let y = 1 - CGFloat(index / spec.columns + 1) * spec.cell.height / spec.atlas.height
                    let frame = SKTexture(rect: CGRect(x: x, y: y, width: spec.cell.width / spec.atlas.width,
                                                      height: spec.cell.height / spec.atlas.height), in: source)
                    frame.filteringMode = .linear
                    return frame
                }
                self.sheets[spec.path] = frames
                callbacks.forEach { $0(frames) }
            }
        }
    }

    func purgeUnused(retaining paths: Set<String>) {
        guard waiting.isEmpty else { return }
        textures = textures.filter { paths.contains($0.key) }
        logicalSizes = logicalSizes.filter { paths.contains($0.key) }
        sheets = sheets.filter { paths.contains($0.key) }
    }

    func invalidatePendingPreparation() {
        guard !disposed else { return }
        generation += 1; waiting.removeAll()
    }

    func dispose() {
        guard !disposed else { return }
        disposed = true
        generation += 1
        waiting.removeAll(); sheets.removeAll(); textures.removeAll(); logicalSizes.removeAll()
        phaseScheduler.dispose()
    }
}
