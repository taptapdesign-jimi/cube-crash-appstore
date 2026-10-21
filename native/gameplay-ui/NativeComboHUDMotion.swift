import SpriteKit
import UIKit

/// One artwork child, sampled by the existing visible Scene clock. No actions,
/// random draws, timers, input locks or gameplay state belong to this owner.
@MainActor
final class NativeComboHUDMotion {
    static let atlasPath = "assets/hud/combo-action-native.png"
    private weak var artwork: SKSpriteNode?
    private var frames: [SKTexture] = []
    private var paintedFrame: Int?
    private var frame: Double = 0
    private var transitionStart: Double = 0
    private var transitionElapsed: Double = 0
    private var transitioning = false
    private static let settledFrames: [Double] = [0, 60, 100]
    private static let canvasSide: CGFloat = 28 * 336 / 216
    private var tier = 0
    private var generation: UInt64?
    private var phase: Double = 0
    private static let kicks: [Double] = [0, -0.65, 1, -1, 0.4, -0.85, 0.8, -0.35, 1, -0.9, 0.55, 0]

    init(artwork: SKSpriteNode) { self.artwork = artwork }

    /// One preuploaded sheet; borrowed UV slices never decode during playback.
    func configure(atlas: SKTexture?) {
        guard frames.isEmpty, let atlas else { return }
        frames = (0..<108).map { index in
            let texture = SKTexture(rect: CGRect(x: Double(index % 12) / 12,
                y: Double(8 - index / 12) / 9, width: 1.0 / 12, height: 1.0 / 9), in: atlas)
            texture.filteringMode = .linear
            return texture
        }
        paintFrame()
    }

    var usesAuthoredFrames: Bool { !frames.isEmpty }
    var displayedFrame: Int { Int(frame.rounded()) }
    var isTransitioning: Bool { transitioning }

    func layoutArtwork(fallbackSize: CGSize) {
        artwork?.size = frames.isEmpty ? fallbackSize : CGSize(width: Self.canvasSide, height: Self.canvasSide)
    }

    func synchronize(combo: Int, generation: UInt64) {
        let next = combo >= 10 ? 2 : combo >= 5 ? 1 : 0
        let replacement = self.generation != generation
        if tier != next || replacement {
            if replacement || next == 0 { phase = 0 }
            // Restored/generation-replaced boards start at their canonical pose.
            // Rapid tier increases continue from the currently painted frame.
            transitioning = !replacement && next > tier && !frames.isEmpty && !UIAccessibility.isReduceMotionEnabled
            transitionStart = frame; transitionElapsed = 0
            if !transitioning { frame = Self.settledFrames[next] }
        }
        tier = next; self.generation = generation
        paintFrame()
        paint(reducedMotion: UIAccessibility.isReduceMotionEnabled)
    }

    func advance(delta: Double, visible: Bool, reducedMotion: Bool) {
        guard visible, tier > 0 else { return }
        if reducedMotion {
            transitioning = false; frame = Self.settledFrames[tier]
        } else if transitioning {
            transitionElapsed += min(0.05, max(0, delta))
            let target = Self.settledFrames[tier]
            let duration = max(0.18, (target - transitionStart) / 90)
            let progress = min(1, transitionElapsed / duration)
            frame = transitionStart + (target - transitionStart) * progress
            transitioning = progress < 1
        }
        paintFrame()
        if !reducedMotion {
            let period = tier == 2 ? 0.26 : 0.42
            phase = (phase + min(0.05, max(0, delta)) / period).truncatingRemainder(dividingBy: 1)
        }
        paint(reducedMotion: reducedMotion)
    }

    func stop() {
        tier = 0; generation = nil; phase = 0
        // Exit retires motion without flashing a bolt back to wood.
        // The next canonical synchronize owns any artwork reset.
        transitioning = false; transitionElapsed = 0
        paint(reducedMotion: true)
    }

    func dispose() {
        stop()
        artwork?.texture = nil
        frames.removeAll()
        paintedFrame = nil
    }

    private func paintFrame() {
        guard !frames.isEmpty else { return }
        let index = min(frames.count - 1, max(0, displayedFrame))
        guard paintedFrame != index else { return }
        artwork?.texture = frames[index]
        paintedFrame = index
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
