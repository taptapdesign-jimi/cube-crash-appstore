import Foundation
import StackToSixGameplay

public struct NativeWildReward: Equatable, Sendable {
    public let archetype: NativeWildArchetype
    public let variant: String?
    public init(_ archetype: NativeWildArchetype, variant: String? = nil) { self.archetype = archetype; self.variant = variant }
}
public enum NativeJourneyContent {
    /// Journey LEVEL ranking for completion stars, v1 (2026-10-21).
    /// Global across all three Worlds by local Unit 01...10. Calibrated from
    /// Forest paired-combo experiments, explicitly adopted globally by user.
    /// See docs/engineering/JOURNEY_LEVEL_STAR_RANKING.md before retuning.
    public static let starRankingVersion = 1
    public struct StarThresholds: Equatable, Sendable {
        public let two: Int
        public let three: Int
    }
    private static let levelStarThresholds: [StarThresholds] = [
        .init(two:14500,three:35000), .init(two:19500,three:48000),
        .init(two:25500,three:62500), .init(two:15500,three:37000),
        .init(two:20000,three:48000), .init(two:16000,three:38000),
        .init(two:22000,three:54000), .init(two:21000,three:52000),
        .init(two:21000,three:52000), .init(two:21500,three:52000)
    ]
    public static func starThresholds(board:Int)->StarThresholds {
        levelStarThresholds[(max(1,board)-1)%10]
    }
    public static func smallValueBias(board: Int) -> Double { let stage = (max(1,board)-1)%10+1; return stage <= 3 ? 0.75 : stage <= 6 ? 0.4 : 0 }
    /// The caller supplies this completed attempt's final score, already including
    /// combo and efficiency. No additional combo requirement or double counting.
    public static func earnedStars(score: Int, board: Int, completed:Bool=true) -> Int {
        guard completed,(1...30).contains(board),score>=0 else {return 0}
        let thresholds=starThresholds(board:board)
        return score < thresholds.two ? 1 : score < thresholds.three ? 2 : 3
    }
    /// Frozen pre-v1 rule, exclusively for preserving awards in old saves.
    static func legacyEarnedStars(score:Int,board:Int)->Int {
        guard score>0 else{return 0}
        let stage = (max(1,board)-1)%10+1
        let two = stage <= 3 ? 2500 : stage <= 6 ? 3000 : 3500
        let three = stage <= 3 ? 6500 : stage <= 6 ? 8000 : 9500
        return score < two ? 1 : score < three ? 2 : 3
    }
    // Titles belong to authored artwork, never to its current progression slot.
    // Keep this identity resolver shared by artwork, reveal copy and accessibility.
    private static let cardArtNumbers = [[3,1,9,4,5,6,7,8,2,10], [2,1,3,4,6,5,7,9,8,10], [1,4,3,2,5,6,7,8,9,10]]
    private static let cardNamesByArt = [
        ["Star Is Out","Flying Tent","Weee - Beee","Honey Splat","Dreamy","Shroomy","Kaboom","Break Out","Final Gate","Winner"],
        ["Fishy","Fresh Juice","Bouncy Day","Bottle Tips","Bonkers","Castle Ruins","Looky Here","The Letter","Playtime","Life Saver"],
        ["Bibi - Ribi","Zap - Zap","Woombuu","The Bloob","Beam Up","Bloob Spill","Team Party","Transport","Fixer Upper","Take Over"]
    ]
    private static func cardIdentity(board:Int)->(world:Int,art:Int) {
        let safe = (1...30).contains(board) ? board : 1
        let world = (safe-1)/10, stage = (safe-1)%10
        return (world,cardArtNumbers[world][stage])
    }
    public static func cardName(board:Int)->String {
        let identity=cardIdentity(board:board)
        return cardNamesByArt[identity.world][identity.art-1]
    }
    public static func cardAsset(board: Int, score: Int, doubleDensity: Bool = false) -> String {
        cardAsset(board:board,stars:earnedStars(score:score,board:board),doubleDensity:doubleDensity)
    }
    /// Persisted best stars choose collection art independently of future tuning.
    public static func cardAsset(board: Int, stars: Int, doubleDensity: Bool = false) -> String {
        let safe = (1...30).contains(board) ? board : 1
        let identity=cardIdentity(board:safe)
        let rarity = stars >= 3 ? "legendary" : "common"
        let number = String(format: "%02d",identity.art)
        return "./assets/colelctibles/\(["Forest","beach","Area55"][identity.world])/\(rarity)/\(number)\(rarity == "legendary" ? "-gold" : "")\(doubleDensity ? "@2x" : "").png"
    }
    public static func rewardPool(board: Int) -> [String] {
        switch board {
        case 1: return ["bee"]
        case 2: return ["wild-star","bee"]
        case 3: return ["wild-star","bee","flower"]
        case 4...5: return ["wild-star","bee","flower","honey"]
        case 6: return ["wild-star","bee","flower","honey","mushroom"]
        case 7...10: return ["wild-star","bee","flower","honey","mushroom","barell"]
        case 11: return ["wild-juice"]
        case 12: return ["fish","wild-juice"]
        case 13: return ["fish","wild-juice","beach-ball"]
        case 14...15: return ["fish","wild-juice","beach-ball","bottle"]
        case 16...20: return ["fish","wild-juice","beach-ball","bottle","coconut"]
        case 21: return ["robo-cube"]
        case 22: return ["kanta","robo-cube"]
        case 23: return ["kanta","robo-cube","spaceship"]
        case 24...25: return ["kanta","robo-cube","spaceship","laser-gun"]
        case 26: return ["kanta","robo-cube","spaceship","laser-gun","bloob-ball"]
        case 27...30: return ["kanta","robo-cube","spaceship","laser-gun","bloob-ball","bloob"]
        default: return []
        }
    }
    /// Full authored World membership; profile discoveries never cross Worlds.
    public static func worldRewardPool(board:Int)->[String] {
        guard (1...30).contains(board) else{return []}
        return rewardPool(board:((board-1)/10)*10+10)
    }
    /// Forward progression retains its pool; replay also admits landed discoveries.
    public static func availableRewardPool(board:Int,unlockedDice:Set<String>)->[String] {
        let eligible=Set(rewardPool(board:board)).union(unlockedDice)
        return worldRewardPool(board:board).filter{eligible.contains($0)}
    }
    /// The die introduced by this Unit, derived from the authored cumulative pool.
    public static func introductionID(board:Int)->String? {
        guard (1...30).contains(board) else{return nil}
        let prior=(board-1)%10 == 0 ? []:rewardPool(board:board-1)
        return rewardPool(board:board).first{!prior.contains($0)}
    }
    public static func unlockReward(board: Int) -> NativeWildReward? {
        guard (1...30).contains(board) else { return nil }
        let prior = (board-1)%10 == 0 ? [] : rewardPool(board:board-1)
        guard let name = rewardPool(board:board).first(where:{!prior.contains($0)}) else { return nil }
        return reward(named:name)
    }
    public static func reward(board: Int, wildSpawnCount: Int, roll: Double, previous: NativeWildArchetype? = nil,mushroomIntroduced:Bool=false,unlockedDice:Set<String>=[],introducedDice:Set<String>?=nil) -> NativeWildReward? {
        var pool = availableRewardPool(board:board,unlockedDice:unlockedDice)
        guard !pool.isEmpty else { return nil }
        var bounded = roll.isFinite ? max(0,min(1-Double.ulpOfOne,roll)) : 0
        var mushroomProbability=NativeWildRewardPolicy.mushroomProbability
        // Uniform first-appearance slot: 1/3 now, 1/2 if still absent on
        // drop two, then guaranteed. Reuse the same draw for the other pool.
        // Legacy runs retain evidence of their former first-drop guarantee.
        if let id=introductionID(board:board),id != "mushroom",
           !(introducedDice?.contains(id) ?? (wildSpawnCount>0)) {
            let chance=1/Double(max(1,3-wildSpawnCount))
            if bounded<chance {return reward(named:id)}
            pool.removeAll{$0==id}
            guard !pool.isEmpty else{return reward(named:id)}
            bounded=(bounded-chance)/(1-chance)
            // Preserve Mushroom's 5% absolute weight on non-forced drops.
            mushroomProbability=min(1,mushroomProbability/(1-chance))
        }
        if board==6,!mushroomIntroduced {
            // Uniform introduction slot among the first three earned drops:
            //1/3 now,1/2 if still absent next time, guaranteed on the third.
            let chance=1/Double(max(1,3-wildSpawnCount))
            if bounded<chance {return reward(named:"mushroom")}
            let others=pool.filter{$0 != "mushroom"}
            let adjusted=(bounded-chance)/(1-chance)
            return reward(named:others[min(others.count-1,Int(adjusted*Double(others.count)))])
        }
        if pool.contains("mushroom") {
            let probability=mushroomProbability
            if bounded<probability {return reward(named:"mushroom")}
            let others=pool.filter{$0 != "mushroom"}
            guard !others.isEmpty else{return reward(named:"mushroom")}
            let adjusted=(bounded-probability)/(1-probability)
            return reward(named:others[min(others.count-1,Int(adjusted*Double(others.count)))])
        }
        let name = pool[min(pool.count-1,Int(bounded*Double(pool.count)))]
        return reward(named:name)
    }
    private static func reward(named name:String) -> NativeWildReward? {
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
