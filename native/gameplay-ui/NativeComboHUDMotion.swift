import SpriteKit
import UIKit

/// One artwork child, sampled by the existing visible Scene clock. No actions,
/// random draws, timers, input locks or gameplay state belong to this owner.
@MainActor
final class NativeComboHUDMotion {
    private weak var artwork: SKSpriteNode?
    private var tier = 0
    private var generation: UInt64?
    private var phase: Double = 0
    private static let kicks: [Double] = [0, -0.65, 1, -1, 0.4, -0.85, 0.8, -0.35, 1, -0.9, 0.55, 0]

    init(artwork: SKSpriteNode) { self.artwork = artwork }

    func synchronize(combo: Int, generation: UInt64) {
        let next = combo >= 10 ? 2 : combo >= 5 ? 1 : 0
        if tier != next || self.generation != generation { phase = 0 }
        tier = next; self.generation = generation
        paint(reducedMotion: UIAccessibility.isReduceMotionEnabled)
    }

    func advance(delta: Double, visible: Bool, reducedMotion: Bool) {
        guard visible, tier > 0 else { return }
        if !reducedMotion {
            let period = tier == 2 ? 0.26 : 0.42
            phase = (phase + min(0.05, max(0, delta)) / period).truncatingRemainder(dividingBy: 1)
        }
        paint(reducedMotion: reducedMotion)
    }

    func stop() {
        tier = 0; generation = nil; phase = 0
        paint(reducedMotion: true)
    }

    private func paint(reducedMotion: Bool) {
        guard let artwork else { return }
        let moving = tier > 0 && !reducedMotion
        let cursor = phase * Double(Self.kicks.count - 1)
        let index = min(Self.kicks.count - 2, Int(cursor))
        let fraction = cursor - Double(index)
        let kick = moving ? Self.kicks[index] + (Self.kicks[index + 1] - Self.kicks[index]) * fraction : 0
        let jitter = tier == 2 ? 1.4 : 0.65
        artwork.zRotation = CGFloat(kick * .pi / 12) // bounded to +/-15 degrees
        artwork.position = moving ? CGPoint(x: kick * jitter, y: sin(phase * .pi * 10) * jitter * 0.65) : .zero
        let scale = tier == 2 ? 1.12 + (moving ? abs(kick) * 0.025 : 0) : 1
        artwork.setScale(CGFloat(scale))
    }
}
