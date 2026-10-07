import Foundation

/// Exact identity map from src/modules/special-dice-registry.ts. Artwork names never decide gameplay.
public enum NativeSpecialDiceRegistry {
    public struct Variant: Equatable, Sendable {
        public let id: String
        public let archetype: NativeWildArchetype
        public let visualFinale: NativeWildArchetype
        public let texture: String
        public let inputReleaseRatio: Double
        public var releaseAfterGameplay: Bool { archetype == .magnet || archetype == .tnt }
        public init(_ id: String, _ archetype: NativeWildArchetype, _ texture: String, visualFinale: NativeWildArchetype? = nil, ratio: Double = 0.25) { self.id = id; self.archetype = archetype; self.visualFinale = visualFinale ?? archetype; self.texture = texture; self.inputReleaseRatio = ratio }
    }
    public static let variants: [String: Variant] = Dictionary(uniqueKeysWithValues: [
        Variant("fish", .star, "assets/shop/fish/fish.png"),
        Variant("kanta", .star, "assets/shop/kanta/04.png"),
        Variant("bee", .star, "assets/shop/bee/bee1@2x.png"),
        Variant("laser-gun", .tnt, "assets/shop/gun/right gun@2x.png", ratio: 0.7),
        Variant("spaceship", .magnet, "assets/shop/spaceship/spaceship@2x.png"),
        Variant("bottle", .magnet, "assets/shop/bottle/glass bottle@2x.png"),
        Variant("honey", .magnet, "assets/shop/honey/honey.png"),
        Variant("flower", .tnt, "assets/shop/bush/flower.png", ratio: 0.7),
        Variant("barell", .tnt, "assets/shop/barell/barell-static.png", ratio: 0.7),
        Variant("mushroom", .juice, "assets/shop/mushroom/mushroom.png", ratio: 0.30),
        Variant("robo-cube", .juice, "assets/shop/robo/robo-cube1.png", ratio: 0.30),
        Variant("cubero", .star, "assets/shop/cubero/cubero.png"),
        Variant("beach-ball", .tnt, "assets/shop/ball/ball.png", visualFinale: .juice, ratio: 0.30)
    ].map { ($0.id, $0) })
    public static func compatibleVariant(_ id: String, core: NativeWildArchetype) -> Variant? {
        guard let variant = variants[id] else { return nil }
        if variant.archetype == core { return variant }
        if id == "beach-ball" && (core == .juice || core == .magnet) { return variant }
        return nil
    }
    public static func finale(source: NativeTile, destination: NativeTile, gameplay: Bool = false) -> NativeWildArchetype? {
        let types = [source, destination].compactMap { tile -> NativeWildArchetype? in
            if gameplay { return tile.gameplayArchetype }
            return tile.variant.flatMap { variants[$0]?.visualFinale } ?? tile.gameplayArchetype
        }
        return [NativeWildArchetype.tnt, .magnet, .juice, .star].first { types.contains($0) }
    }
}
