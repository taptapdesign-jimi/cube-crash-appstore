import Foundation

/// Separate Arcade rule sets share the existing merge engine and Journey unlocks.
public enum NativeArcadeVariant: String, Codable, CaseIterable, Sendable {
    case endurance, pureDice, slowBurn
    public var title: String { switch self { case .endurance: return "Endurance"; case .pureDice: return "One Lucky Drop"; case .slowBurn: return "Slow Burn" } }
    public var meterMultiplier: Double { switch self { case .endurance: return 1; case .pureDice: return 0.4; case .slowBurn: return 0.5 } }
    /// Only initial openings are biased; refills and rounds five onward retain normal rules.
    public func initialSmallValueBias(round: Int) -> Double {
        guard self == .pureDice, (1...4).contains(round) else { return 0 }
        return [0.80, 0.65, 0.50, 0.35][round-1]
    }
}
