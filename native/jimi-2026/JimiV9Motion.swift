import Foundation

/// Pure immutable v9 recipes, not an animation owner. A controller samples a
/// Track into its own CAKeyframes and owns cancellation/completion/input.
enum JimiV9Motion {
    enum Part { case hero, logo, shard, ctaContainer, cta, navigation, fixedShadow }

    enum Ease {
        case linear, powerIn(Int), powerOut(Int), backIn(Double), backOut(Double)
        case cubicBezier(Double, Double, Double, Double)

        func value(_ progress: Double) -> Double {
            let t = min(1, max(0, progress))
            switch self {
            case .linear: return t
            // GSAP power2 is cubic, power3 is quartic.
            case .powerIn(let power): return pow(t, Double(power + 1))
            case .powerOut(let power): return 1 - pow(1-t, Double(power + 1))
            case .backIn(let s): return t*t*((s+1)*t-s)
            case .backOut(let s):
                let u = t-1
                return 1 + u*u*((s+1)*u+s)
            case .cubicBezier(let x1, let y1, let x2, let y2):
                if t == 0 || t == 1 { return t }
                func cubic(_ u: Double, _ a: Double, _ b: Double) -> Double {
                    let v = 1-u
                    return 3*v*v*u*a + 3*v*u*u*b + u*u*u
                }
                var low = 0.0
                var high = 1.0
                // Monotone authored x curves; solve x(u)=time, not y(time).
                for _ in 0..<40 {
                    let middle = (low+high)/2
                    if cubic(middle, x1, x2) < t { low = middle } else { high = middle }
                }
                return cubic((low+high)/2, y1, y2)
            }
        }
    }

    struct Pose {
        var scaleX = 1.0
        var scaleY = 1.0
        var x = 0.0
        var y = 0.0
        var opacity = 1.0

        static func scale(_ value: Double, y: Double = 0, opacity: Double = 1) -> Pose {
            Pose(scaleX: value, scaleY: value, y: y, opacity: opacity)
        }

        func interpolated(to other: Pose, progress: Double) -> Pose {
            func blend(_ a: Double, _ b: Double) -> Double { a + (b-a)*progress }
            return Pose(scaleX: blend(scaleX, other.scaleX), scaleY: blend(scaleY, other.scaleY),
                        x: blend(x, other.x), y: blend(y, other.y), opacity: blend(opacity, other.opacity))
        }
    }

    struct Tween {
        let begin: Double
        let duration: Double
        let from: Pose
        let to: Pose
        let ease: Ease
    }

    struct Track {
        let tweens: [Tween]
        var anchorX = 0.5
        var anchorY = 0.5
        var duration: Double { tweens.map { $0.begin + $0.duration }.max() ?? 0 }

        func pose(at seconds: Double) -> Pose {
            guard let first = tweens.first else { return Pose() }
            var result = first.from
            for tween in tweens {
                if seconds < tween.begin { return result }
                if seconds < tween.begin + tween.duration {
                    return tween.from.interpolated(to: tween.to,
                        progress: tween.ease.value((seconds-tween.begin)/tween.duration))
                }
                result = tween.to
            }
            return result
        }
    }

    struct SampledTrack {
        let duration: Double
        let poses: [Pose]
        // nil preserves CA's existing evenly-spaced path, including zero-time tracks.
        let keyTimes: [Double]?
    }

    /// Keep authored samples at their original seconds. A shorter finite route
    /// animation can retain its terminal pose until its siblings retire without
    /// stretching a curve, adding motion, or extending the route completion gate.
    static func sampledTrack(_ track: Track, holdUntil: Double? = nil) -> SampledTrack {
        let samples = max(2, Int(ceil(track.duration * 240)))
        var poses = (0...samples).map { track.pose(at: Double($0) * track.duration / Double(samples)) }
        guard track.duration > 0, let heldDuration = holdUntil, heldDuration > track.duration else {
            return SampledTrack(duration: track.duration, poses: poses, keyTimes: nil)
        }
        var times = (0...samples).map { Double($0) * track.duration / Double(samples) / heldDuration }
        poses.append(poses.last!)
        times.append(1)
        return SampledTrack(duration: heldDuration, poses: poses, keyTimes: times)
    }

    static let homeEnterEase = Ease.cubicBezier(0.175, 0.885, 0.32, 1.275)
    static let homeExitEase = Ease.cubicBezier(0.60, -0.28, 0.735, 0.045)
    static let sliderDuration = 0.4
    static let sliderEase = Ease.powerOut(2)
    static let navigationSelectionDuration = 0.38
    static let navigationActiveSizeEase = Ease.powerOut(3)
    static let navigationInactiveSizeEase = Ease.powerOut(2)
    static let navigationOffsetEase = Ease.powerOut(3)
    static let navigationActiveY = -12.0
    static let heroSelectionDelay = 0.24
    static let dragThreshold = 100.0
    static let flickThresholdPointsPerMillisecond = 0.35
    static let edgeResistance = 0.1
    static let edgeLimitFraction = 0.03

    // slider-manager.ts@v9:322–340,943–969. The legacy 3% constant is
    // not used in that actual drag path; do not introduce an extra clamp.
    static func sliderDragDisplacement(selectedSlide: Int, distance: Double) -> Double {
        let edge = (selectedSlide == 0 && distance > 0) || (selectedSlide == 2 && distance < 0)
        return distance * (edge ? edgeResistance : 1)
    }

    static func sliderDragDestination(selectedSlide: Int, distance: Double, velocityPointsPerMillisecond: Double) -> Int {
        guard abs(distance) > dragThreshold || abs(velocityPointsPerMillisecond) >= flickThresholdPointsPerMillisecond else {
            return selectedSlide
        }
        let signal = distance != 0 ? distance : velocityPointsPerMillisecond
        return min(2, max(0, selectedSlide + (signal > 0 ? -1 : 1)))
    }

    /// The view exposes a neutral wrapper outside authored banner rotation.
    /// First World tick starts all reveals; independent World delays remain.
    static func hubBanner(worldID: Int, enter: Bool, width: Double, firstWorldStart: Double = 0.08,
                          reducedMotion: Bool = false) -> Track {
        guard !reducedMotion else { return one(delay: 0, duration: 0, from: Pose(), to: Pose(), ease: .linear) }
        let tucked = Pose(x: (worldID == 3 ? 0.64 : -0.64)*width)
        let delay = worldID == 2 ? 0.11 : worldID == 3 ? 0.22 : 0
        return enter
            ? one(delay: firstWorldStart+delay, duration: 0.72, from: tucked, to: Pose(), ease: .cubicBezier(0.2,0.88,0.32,1.08))
            : one(delay: 0, duration: 0.32, from: Pose(), to: tucked, ease: .cubicBezier(0.56,-0.22,0.78,0.34))
    }

    /// journey-boards-manager.ts@v9:10296–10345 and Hub Back's embedded
    /// NAV exit: collapse upward to the top-center pivot, not the World's
    /// downward/shallow exit. Incoming recipes are intentionally unchanged.
    static func journeyNavigationExit(reducedMotion: Bool = false) -> Track {
        let track = one(delay: 0, duration: reducedMotion ? 0.16 : 0.48,
                        from: .scale(1), to: .scale(0.04, y: -10, opacity: 0),
                        ease: reducedMotion ? .powerIn(1) : .backIn(1.25))
        return Track(tweens: track.tweens, anchorY: 0)
    }

    // animations.ts:312–318,1402–1593; cta-system.ts:38–49,244–263.
    static func homeEnter(_ part: Part) -> Track {
        switch part {
        case .navigation, .fixedShadow:
            return one(delay: 0, duration: 0.43, from: .scale(0), to: .scale(1), ease: homeEnterEase)
        case .hero, .logo, .shard:
            return one(delay: 0.045, duration: 0.65, from: .scale(0), to: .scale(1), ease: homeEnterEase)
        case .ctaContainer:
            return one(delay: 0.095, duration: 0.65, from: .scale(0), to: .scale(1), ease: homeEnterEase)
        case .cta:
            return one(delay: 0.095, duration: 0.34, from: .scale(0, y: 18, opacity: 0),
                       to: .scale(1), ease: .backOut(1.8))
        }
    }

    // animations.ts:563–724 + homepage-hero-motion.ts. No opacity fade on
    // shells; only the registered CTA visual has its own authored alpha tail.
    static func homeExit(_ part: Part, reducedMotion: Bool = false) -> Track {
        switch part {
        case .hero:
            let inflate = reducedMotion ? 0.15 : 0.18
            let collapse = reducedMotion ? 0.28 : 0.336
            let peak = Pose(scaleX: 1.18, scaleY: 1.15)
            return Track(tweens: [
                Tween(begin: 0, duration: inflate, from: .scale(1), to: peak, ease: .powerIn(2)),
                Tween(begin: inflate, duration: collapse, from: peak, to: .scale(0), ease: .backIn(1.7)),
            ], anchorY: 0.54)
        case .cta:
            return one(delay: 0.18, duration: 0.31, from: .scale(1),
                       to: .scale(0, y: 18, opacity: 0), ease: .backIn(1.75))
        case .ctaContainer:
            return one(delay: 0.18, duration: 0.46, from: .scale(1), to: .scale(0), ease: homeExitEase)
        case .logo, .shard:
            return one(delay: 0.21, duration: 0.46, from: .scale(1), to: .scale(0), ease: homeExitEase)
        case .navigation, .fixedShadow:
            return one(delay: 0.24, duration: 0.46, from: .scale(1), to: .scale(0), ease: homeExitEase)
        }
    }

    // slider-manager.ts:182–248, invoked only for accepted slide selection.
    static let selectedHeroBounce = Track(tweens: [
        Tween(begin: 0.24, duration: 0.18, from: .scale(1), to: .scale(1.065), ease: .backOut(1.55)),
        Tween(begin: 0.42, duration: 0.135, from: .scale(1.065), to: .scale(0.975), ease: .powerOut(2)),
        Tween(begin: 0.555, duration: 0.255, from: .scale(0.975), to: .scale(1), ease: .backOut(1.35)),
    ], anchorY: 0.65)

    // nav-icon-bounce.ts:4–11,75–93. Parent may combine this visual track
    // with the separate 380ms size/offset selection track on its outer shell.
    static let navigationTapBounce = Track(tweens: [
        Tween(begin: 0, duration: 0.077, from: .scale(1), to: .scale(0.92),
              ease: .cubicBezier(0.34, 1.56, 0.64, 1)),
        Tween(begin: 0.077, duration: 0.077, from: .scale(0.92), to: .scale(1.06),
              ease: .cubicBezier(0.34, 1.56, 0.64, 1)),
        Tween(begin: 0.154, duration: 0.066, from: .scale(1.06), to: .scale(1),
              ease: .cubicBezier(0.34, 1.56, 0.64, 1)),
    ])

    private static func one(delay: Double, duration: Double, from: Pose, to: Pose, ease: Ease) -> Track {
        Track(tweens: [Tween(begin: delay, duration: duration, from: from, to: to, ease: ease)])
    }
}
