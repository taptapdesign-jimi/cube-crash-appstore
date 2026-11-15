import StackToSixGameplay

/// Shared Box membership. Discovery order is presentation-only; one ordinary
/// Arcade draw selects from these same eligible identities in stable catalog order.
public enum NativeArcadeBoxContent {
    public static let baseIDs=["cubero","baloon","tnt","wild-magnet"]
    public static var journeyIDs:[String] {(1...30).compactMap{NativeJourneyContent.introductionID(board:$0)}}
    public static func orderedIDs(_ progression:NativeProgressionState)->[String] {
        baseIDs+progression.journeyDiceUnlockOrder
    }
    public static func rewards(unlockedJourneyDice:Set<String>)->[NativeWildRewardChoice] {
        (baseIDs+journeyIDs.filter{unlockedJourneyDice.contains($0)}).compactMap {id in
            NativeJourneyContent.reward(named:id).map{.init($0.archetype,variant:$0.variant)}
        }
    }
}
