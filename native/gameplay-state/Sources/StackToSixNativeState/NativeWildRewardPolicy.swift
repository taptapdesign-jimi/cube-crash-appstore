import StackToSixGameplay

/// Exact committed meter-reward policy from decideWildType + variant/Beach slot owners.
/// Additional random draws are requested only at the same source decision boundaries.
public enum NativeWildRewardPolicy {
    public static func choose(state:NativeBoardState,roll:Double,nextRoll:()->Double) -> NativeWildRewardChoice? {
        let board = state.board,count = state.wildSpawnCount
        if state.mode == .journey && ((1...10).contains(board) || (21...30).contains(board)) {
            guard let reward = NativeJourneyContent.reward(board:board,wildSpawnCount:count,roll:roll,previous:state.lastWildDropType) else {return nil}
            return NativeWildRewardChoice(reward.archetype,variant:reward.variant)
        }
        if state.mode == .arcade && board == 1 && count == 0 {return NativeWildRewardChoice(.magnet)}
        let intro = state.mode == .journey && board == 11
        let bounded = bound(roll)
        var core:NativeWildArchetype
        if intro {core = count > 0 && (state.lastWildDropType == .star || bounded < 0.60) ? .juice : .star}
        else {
            let preferred:NativeWildArchetype = bounded < 0.5 ? .star : bounded < 0.6667 ? .juice : bounded < 0.8334 ? .magnet : .tnt
            let allowed = allowedTypes(board:board)
            core = allowed.contains(preferred) ? preferred : allowed[0]
            if core == state.lastWildDropType && state.wildDropTypeStreak >= 2 {
                let alternatives = NativeWildArchetype.allCases.compactMap { type -> NativeWildArchetype? in
                    let filtered = allowed.contains(type) ? type : allowed[0]
                    return filtered == core ? nil : filtered
                }.reduce(into:[NativeWildArchetype]()) {if !$0.contains($1) {$0.append($1)}}
                if !alternatives.isEmpty {core = alternatives[min(alternatives.count-1,Int(bound(nextRoll())*Double(alternatives.count)))]}
            }
        }
        if intro {return NativeWildRewardChoice(core,variant:core == .star ? "fish" : nil)}
        if state.mode == .journey && (12...20).contains(board) {
            // decideWildType ran first (including any streak draw); Beach then overrides it
            // with its independent weighted slot. At an exact edge EPSILON selects next slot.
            let slotRoll = board == 12 && count == 0 ? nil : bound(nextRoll())
            let slot = slotRoll.map {value in (0..<5).first {value+Double.ulpOfOne < Double($0+1)*0.2} ?? 4} ?? 1
            switch slot {
            case 0:return NativeWildRewardChoice(.star,variant:"fish")
            case 1:return NativeWildRewardChoice(.juice)
            case 2:return NativeWildRewardChoice(.tnt,variant:"beach-ball")
            case 3:return NativeWildRewardChoice(.magnet,variant:"bottle")
            default:return NativeWildRewardChoice(.star)
            }
        }
        if state.mode == .arcade && board <= 1 {
            // Registry's authored order is Ball/Bottle/Barrel. First Arcade Magnet skips
            // index zero, leaving Bottle at count1 and Barrel at count2, as in source.
            if count == 1 {return NativeWildRewardChoice(.magnet,variant:"bottle")}
            if count == 2 {return NativeWildRewardChoice(.tnt,variant:"barell")}
        }
        return NativeWildRewardChoice(core)
    }
    private static func bound(_ value:Double)->Double {value.isFinite ? max(0,min(1-Double.ulpOfOne,value)) : 0}
    private static func allowedTypes(board:Int)->[NativeWildArchetype] {
        if (11...20).contains(board) {return [.star,.juice]}
        if (1...10).contains(board) || (21...30).contains(board) {
            return NativeJourneyContent.rewardPool(board:board).compactMap {name -> NativeWildArchetype? in
                switch name {case "wild-star":return .star;case "wild-juice":return .juice;case "tnt":return .tnt;default:return NativeSpecialDiceRegistry.variants[name]?.archetype}
            }.reduce(into:[]) {if !$0.contains($1) {$0.append($1)}}
        }
        return [.star,.juice,.magnet,.tnt]
    }
}
