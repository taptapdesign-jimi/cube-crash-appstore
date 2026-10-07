import Foundation
import StackToSixGameplay

public struct NativeWildReward: Equatable, Sendable {
    public let archetype: NativeWildArchetype
    public let variant: String?
    public init(_ archetype: NativeWildArchetype, variant: String? = nil) { self.archetype = archetype; self.variant = variant }
}
public enum NativeJourneyContent {
    public static func smallValueBias(board: Int) -> Double { let stage = (max(1,board)-1)%10+1; return stage <= 3 ? 0.75 : stage <= 6 ? 0.4 : 0 }
    public static func earnedStars(score: Int, board: Int) -> Int {
        guard score > 0 else { return 0 }
        let stage = (max(1,board)-1)%10+1
        let two = stage <= 3 ? 2500 : stage <= 6 ? 3000 : 3500
        let three = stage <= 3 ? 6500 : stage <= 6 ? 8000 : 9500
        return score < two ? 1 : score < three ? 2 : 3
    }
    public static func cardAsset(board: Int, score: Int, doubleDensity: Bool = false) -> String {
        let safe = (1...30).contains(board) ? board : 1
        let world = (safe-1)/10, stage = (safe-1)%10
        let maps = [[1,3,9,4,5,6,7,8,2,10], [1,2,3,4,6,5,7,9,8,10], [4,1,3,2,5,6,7,8,9,10]]
        let rarity = earnedStars(score: score, board: safe) == 3 ? "legendary" : "common"
        let number = String(format: "%02d",maps[world][stage])
        return "./assets/colelctibles/\(["Forest","beach","Area55"][world])/\(rarity)/\(number)\(rarity == "legendary" ? "-gold" : "")\(doubleDensity ? "@2x" : "").png"
    }
    public static func rewardPool(board: Int) -> [String] {
        switch board {
        case 1: return ["wild-star"]
        case 2: return ["wild-star","bee"]
        case 3: return ["wild-star","bee","flower"]
        case 4...5: return ["wild-star","bee","flower","honey"]
        case 6: return ["wild-star","bee","flower","honey","mushroom"]
        case 7...10: return ["wild-star","bee","flower","honey","mushroom","tnt","barell"]
        case 11: return ["fish","wild-juice"]
        case 12...20: return ["fish","wild-juice","beach-ball","bottle","wild-star"]
        case 21: return ["wild-star","kanta"]
        case 22: return ["wild-star","kanta","robo-cube"]
        case 23: return ["wild-star","kanta","robo-cube","spaceship"]
        case 24...30: return ["wild-star","kanta","robo-cube","spaceship","laser-gun"]
        default: return []
        }
    }
    public static func reward(board: Int, wildSpawnCount: Int, roll: Double, previous: NativeWildArchetype? = nil) -> NativeWildReward? {
        let pool = rewardPool(board: board)
        guard !pool.isEmpty else { return nil }
        let bounded = roll.isFinite ? max(0,min(1-Double.ulpOfOne,roll)) : 0
        let intro: [Int:String] = [1:"wild-star",2:"bee",3:"flower",4:"honey",6:"mushroom",7:"barell",11:"fish",12:"wild-juice",21:"kanta",22:"robo-cube",23:"spaceship",24:"laser-gun"]
        let name: String
        if max(0,wildSpawnCount) == 0 && board <= 24 { name = intro[board] ?? pool[0] }
        else if board == 11 {
            // journey-world-intro-wild: theme alternates after each core Star reward.
            name = previous == .star || bounded < 0.60 ? "wild-juice" : "fish"
        } else { name = pool[min(pool.count-1,Int(bounded*Double(pool.count)))] }
        switch name {
        case "wild-star": return NativeWildReward(.star)
        case "wild-juice": return NativeWildReward(.juice)
        case "tnt": return NativeWildReward(.tnt)
        default:
            guard let definition = NativeSpecialDiceRegistry.variants[name] else { return nil }
            return NativeWildReward(definition.archetype, variant:name)
        }
    }
}
