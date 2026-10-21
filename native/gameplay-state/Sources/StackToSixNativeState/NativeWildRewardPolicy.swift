import StackToSixGameplay

/// One random draw per committed reward; count, round and history never force Arcade identity.
public enum NativeWildRewardPolicy {
    // Explicit user trial2026-10-21. Keep enabled until the user requests removal.
    // First special drop of a NEW Endurance run only; no save/schema mutation.
    static let enduranceBaloonFirstDropTrialEnabled = true
    public static func choose(state:NativeBoardState,roll:Double,plainStarUnlocked:Bool,nextRoll:()->Double) -> NativeWildRewardChoice? {
        if state.mode == .journey {
            guard let reward=NativeJourneyContent.reward(board:state.board,wildSpawnCount:state.wildSpawnCount,roll:roll,previous:state.lastWildDropType) else {return nil}
            return NativeWildRewardChoice(reward.archetype,variant:reward.variant)
        }
        if enduranceBaloonFirstDropTrialEnabled,state.effectiveArcadeVariant == .endurance,
           state.board == 1,state.wildSpawnCount == 0 {return .init(.juice,variant:"baloon")}
        // Keep the existing Arcade identities, but make the former introductory
        // variants eligible randomly instead of assigning them to numbered drops.
        var pool:[NativeWildRewardChoice]=[.init(.juice),.init(.juice,variant:"baloon"),.init(.magnet),.init(.tnt)]
        if plainStarUnlocked {pool.insert(.init(.star),at:0)}
        if state.effectiveArcadeVariant != .pureDice {
            pool += [.init(.magnet,variant:"bottle"),.init(.star,variant:"cubero"),.init(.tnt,variant:"barell")]
        }
        return pool[min(pool.count-1,Int(bound(roll)*Double(pool.count)))]
    }
    private static func bound(_ value:Double)->Double {value.isFinite ? max(0,min(1-Double.ulpOfOne,value)) : 0}
}
