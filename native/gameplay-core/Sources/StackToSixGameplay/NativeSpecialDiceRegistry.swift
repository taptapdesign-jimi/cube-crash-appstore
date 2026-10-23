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
        Variant("baloon", .juice, "assets/shop/baloon/baloon.png", ratio: 0.30),
        Variant("fish", .star, "assets/shop/fish/fish.png"),
        Variant("kanta", .star, "assets/shop/kanta/04.png"),
        Variant("bee", .star, "assets/shop/bee/bee1@2x.png"),
        Variant("bloob-ball", .tnt, "assets/shop/bloog ball/bloob-ball@2x.png", ratio: 0.7),
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
    /// Mirrors NativeBackpackCatalog world membership. Arcade-only originals use
    /// the existing neutral Area55 celebration, not the current round number.
    public static func celebrationWorld(for tile:NativeTile)->String? {
        guard tile.isWild else{return nil}
        if let variant=tile.variant {
            switch variant {
            case "bee","flower","honey","mushroom","barell":return "forest"
            case "baloon","fish","beach-ball","bottle":return "beach"
            case "bloob-ball","kanta","robo-cube","spaceship","laser-gun","cubero":return "area55"
            default:return nil
            }
        }
        switch tile.gameplayArchetype {
        case .star:return "forest"
        case .juice:return "beach"
        case .magnet,.tnt:return "area55"
        case nil:return nil
        }
    }
    public static func celebrationWorld(source:NativeTile,destination:NativeTile)->String? {
        let owner=finale(source:source,destination:destination,gameplay:true)
        return [source,destination].first(where:{$0.gameplayArchetype==owner && $0.isWild}).flatMap{celebrationWorld(for:$0)}
    }
    public static func usesBarrelFlow(_ variant:String?)->Bool {variant == "barell" || variant == "bloob-ball"}
    public static func compatibleVariant(_ id: String, core: NativeWildArchetype) -> Variant? {
        guard let variant = variants[id] else { return nil }
        if variant.archetype == core { return variant }
        if id == "bloob-ball" && core == .star { return variant } // Preserve historical saved Bloob identity.
        if id == "beach-ball" && (core == .juice || core == .magnet) { return variant }
        return nil
    }
    /// Admission uses the canonical gameplay identity, including historical
    /// Beach Ball saves, rather than treating authored artwork as a new rule.
    public static func admits(_ tile: NativeTile, as archetype: NativeWildArchetype) -> Bool {
        guard tile.isWild, tile.gameplayArchetype == archetype else { return false }
        guard let variant = tile.variant else { return true }
        return variants[variant]?.archetype == archetype &&
            tile.archetype.map { compatibleVariant(variant, core: $0) != nil } == true
    }
    public static func finale(source: NativeTile, destination: NativeTile, gameplay: Bool = false) -> NativeWildArchetype? {
        let types = [source, destination].compactMap { tile -> NativeWildArchetype? in
            if gameplay { return tile.gameplayArchetype }
            return tile.variant.flatMap { variants[$0]?.visualFinale } ?? tile.gameplayArchetype
        }
        return [NativeWildArchetype.tnt, .magnet, .juice, .star].first { types.contains($0) }
    }
}
