import StackToSixGameplay

/// One random draw per committed reward; count, round and history never force Arcade identity.
public enum NativeWildRewardPolicy {
    public static let mushroomProbability=0.05
    // Explicit user trial2026-10-21. Keep enabled until the user requests removal.
    // First special drop of a NEW Endurance run only; no save/schema mutation.
    static let enduranceBaloonFirstDropTrialEnabled = true
    public static func choose(state:NativeBoardState,roll:Double,plainStarUnlocked:Bool,mushroomUnlocked:Bool=false,unlockedJourneyDice:Set<String>=[],allowEnduranceTrial:Bool=true,nextRoll:()->Double) -> NativeWildRewardChoice? {
        if state.mode == .arcade,state.tutorial?.done == false {
            return NativeTutorialRules.arcadeReward(roll:roll)
        }
        if state.mode == .journey {
            // Before this marker existed, Unit6's very first committed drop
            // was always Mushroom. Preserve that evidence in legacy saves.
            let introduced=(state.forestMushroomIntroduced ?? (state.wildSpawnCount>0)) || state.lastWildDropType == .juice || state.tiles.contains{$0.variant=="mushroom"}
            guard let reward=NativeJourneyContent.reward(board:state.board,wildSpawnCount:state.wildSpawnCount,roll:roll,previous:state.lastWildDropType,mushroomIntroduced:introduced,unlockedDice:unlockedJourneyDice,introducedDice:state.earnedJourneyDice,beachBallDropCount:state.completedBeachBallDrops) else {return nil}
            return NativeWildRewardChoice(reward.archetype,variant:reward.variant)
        }
        if allowEnduranceTrial,enduranceBaloonFirstDropTrialEnabled,state.effectiveArcadeVariant == .endurance,
           state.board == 1,state.wildSpawnCount == 0 {return .init(.juice,variant:"baloon")}
        // Actual Journey discoveries, shared with Box, own Arcade admission.
        // Legacy unlock flags remain in this API for saved/caller compatibility.
        var pool=NativeArcadeBoxContent.rewards(unlockedJourneyDice:unlockedJourneyDice)
        let draw=bound(roll)
        if let mushroom=pool.first(where:{$0.variant=="mushroom"}) {
            if draw < mushroomProbability {return mushroom}
            pool.removeAll{$0.variant=="mushroom"}
            let remaining=(draw-mushroomProbability)/(1-mushroomProbability)
            return pool[min(pool.count-1,Int(remaining*Double(pool.count)))]
        }
        return pool[min(pool.count-1,Int(draw*Double(pool.count)))]
    }
    private static func bound(_ value:Double)->Double {value.isFinite ? max(0,min(1-Double.ulpOfOne,value)) : 0}
}
