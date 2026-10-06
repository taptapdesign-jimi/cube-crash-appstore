import Foundation

/// Pure recipes against immutable production-benchmark-v9; no UIKit/app/device:
/// swiftc native/jimi-2026/JimiV9Motion.swift scripts/qa/JimiV9MotionChecks.swift -o /tmp/jimi-v9-motion-checks
/// /tmp/jimi-v9-motion-checks
/// Cancellation, rendered alpha and input ownership require controller tests.
/// This executable deliberately does not fabricate a lifecycle to "prove" them.
@main
enum JimiV9MotionChecks {
    private static var assertions = 0

    private static func near(_ actual: Double, _ expected: Double, _ name: String, tolerance: Double = 1e-9) {
        assertions += 1
        guard actual.isFinite, abs(actual - expected) <= tolerance else {
            fatalError("FAIL \(name): actual=\(actual), expected=\(expected)")
        }
    }

    private static func pose(_ actual: JimiV9Motion.Pose, _ expected: JimiV9Motion.Pose, _ name: String) {
        near(actual.scaleX, expected.scaleX, name + ".scaleX")
        near(actual.scaleY, expected.scaleY, name + ".scaleY")
        near(actual.x, expected.x, name + ".x")
        near(actual.y, expected.y, name + ".y")
        near(actual.opacity, expected.opacity, name + ".opacity")
    }

    private static func cubic(_ u: Double, _ a: Double, _ b: Double) -> Double {
        let v = 1 - u
        return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u
    }

    static func main() {
        // GSAP power2 means t^3, NOT t^2. Independently match the exact
        // polynomials in v9 homepage-hero-motion.ts's keyframe representation.
        for index in 0...100 {
            let t = Double(index) / 100
            near(JimiV9Motion.Ease.powerIn(2).value(t), t * t * t, "power2.in")
            near(JimiV9Motion.Ease.powerOut(2).value(t), 1 - pow(1 - t, 3), "power2.out")
            near(JimiV9Motion.Ease.powerOut(3).value(t), 1 - pow(1 - t, 4), "power3.out")
            near(JimiV9Motion.Ease.backIn(1.7).value(t), 2.7 * t * t * t - 1.7 * t * t, "back.in(1.7)")
            near(JimiV9Motion.Ease.backOut(1.8).value(t), 1 + 2.8 * pow(t - 1, 3) + 1.8 * pow(t - 1, 2), "back.out(1.8)")
        }
        // Feed x(u), expect y(u): detects incorrect y(time) evaluation without
        // copying the production inverse solver into the test.
        for (name, x1, y1, x2, y2) in [
            ("home-enter", 0.175, 0.885, 0.32, 1.275),
            ("home-exit", 0.60, -0.28, 0.735, 0.045),
            ("nav-bounce", 0.34, 1.56, 0.64, 1.0),
        ] {
            let ease = JimiV9Motion.Ease.cubicBezier(x1, y1, x2, y2)
            for index in 0...100 {
                let u = Double(index) / 100
                near(ease.value(cubic(u, x1, x2)), cubic(u, y1, y2), name)
            }
            near(ease.value(-1), 0, name + ".before")
            near(ease.value(2), 1, name + ".after")
        }

        // animations.ts: 0/45/95ms admission and 430/650ms CSS shells;
        // cta-system.ts: registered CTA 340ms enter / 310ms exit.
        let parts: [(String, JimiV9Motion.Part, Double, Double, Double, Double)] = [
            ("hero", .hero, 0.045, 0.65, 0, 0.516),
            ("logo", .logo, 0.045, 0.65, 0.21, 0.46),
            ("shard", .shard, 0.045, 0.65, 0.21, 0.46),
            ("cta-container", .ctaContainer, 0.095, 0.65, 0.18, 0.46),
            ("cta", .cta, 0.095, 0.34, 0.18, 0.31),
            ("navigation", .navigation, 0, 0.43, 0.24, 0.46),
            ("fixed-shadow", .fixedShadow, 0, 0.43, 0.24, 0.46),
        ]
        for (name, part, enterDelay, enterDuration, exitDelay, exitDuration) in parts {
            let enter = JimiV9Motion.homeEnter(part)
            let exit = JimiV9Motion.homeExit(part)
            near(enter.tweens[0].begin, enterDelay, name + ".enter-delay")
            near(enter.duration, enterDelay + enterDuration, name + ".enter-end")
            near(exit.tweens[0].begin, exitDelay, name + ".exit-delay")
            near(exit.duration, exitDelay + exitDuration, name + ".exit-end")
            pose(enter.pose(at: -1), name == "cta" ? .scale(0, y: 18, opacity: 0) : .scale(0), name + ".initial")
            pose(enter.pose(at: enter.duration + 10), .scale(1), name + ".settled")
            pose(exit.pose(at: -1), .scale(1), name + ".exit-initial")
            pose(exit.pose(at: exit.duration + 10), name == "cta" ? .scale(0, y: 18, opacity: 0) : .scale(0), name + ".exit-final")
            for index in 0...100 {
                let t = Double(index) / 100
                if name != "cta" {
                    // No invented shell fade: only the CTA owns authored alpha.
                    near(enter.pose(at: enter.duration * t).opacity, 1, name + ".enter-alpha")
                    near(exit.pose(at: exit.duration * t).opacity, 1, name + ".exit-alpha")
                }
                let before = enter.pose(at: enter.duration * t)
                _ = enter.pose(at: enter.duration + 1)
                pose(enter.pose(at: enter.duration * t), before, name + ".repeatable")
            }
        }

        for reduced in [false, true] {
            let hero = JimiV9Motion.homeExit(.hero, reducedMotion: reduced)
            let inflate = reduced ? 0.15 : 0.18
            let collapse = reduced ? 0.28 : 0.336
            near(hero.duration, inflate + collapse, "hero-duration")
            near(hero.anchorY, 0.54, "hero-anchor")
            near(hero.tweens[1].begin, inflate, "no-dwell")
            pose(hero.pose(at: inflate), .init(scaleX: 1.18, scaleY: 1.15), "hero-asymmetric-peak")
            let half = hero.pose(at: inflate / 2)
            near(half.scaleX, 1 + 0.18 * 0.125, "hero-inflate-curve-x")
            near(half.scaleY, 1 + 0.15 * 0.125, "hero-inflate-curve-y")
        }
        let selected = JimiV9Motion.selectedHeroBounce
        near(selected.duration, 0.81, "selected-hero-duration")
        near(selected.anchorY, 0.65, "selected-hero-anchor")
        near(selected.pose(at: 0.239).scaleX, 1, "selected-hero-delay")
        near(selected.pose(at: 0.42).scaleX, 1.065, "selected-hero-pop")
        near(selected.pose(at: 0.555).scaleX, 0.975, "selected-hero-settle-start")
        pose(selected.pose(at: 1), .scale(1), "selected-hero-end")
        let nav = JimiV9Motion.navigationTapBounce
        near(nav.duration, 0.22, "nav-bounce-duration")
        near(nav.pose(at: 0.077).scaleX, 0.92, "nav-squeeze")
        near(nav.pose(at: 0.154).scaleX, 1.06, "nav-pop")
        pose(nav.pose(at: 1), .scale(1), "nav-end")
        near(JimiV9Motion.sliderDuration, 0.4, "slider-duration")
        near(JimiV9Motion.navigationSelectionDuration, 0.38, "nav-selection-duration")
        near(JimiV9Motion.navigationActiveY, -12, "nav-active-y")
        near(JimiV9Motion.dragThreshold, 100, "drag-threshold")
        near(JimiV9Motion.flickThresholdPointsPerMillisecond, 0.35, "flick-threshold")
        near(JimiV9Motion.edgeResistance, 0.1, "edge-resistance")
        near(JimiV9Motion.edgeLimitFraction, 0.03, "edge-limit")
        near(JimiV9Motion.sliderDragDisplacement(selectedSlide: 0, distance: 200), 20, "left-edge-resists-without-3pct-clamp")
        near(JimiV9Motion.sliderDragDisplacement(selectedSlide: 2, distance: -200), -20, "right-edge-resists-without-3pct-clamp")
        near(JimiV9Motion.sliderDragDisplacement(selectedSlide: 1, distance: 200), 200, "middle-free-drag")
        near(JimiV9Motion.sliderDragDisplacement(selectedSlide: 0, distance: -200), -200, "left-inward-free-drag")
        for (slide, distance, velocity, expected) in [
            (1, 100.0, 0.0, 1), (1, -100.0, 0.0, 1),
            (1, 100.001, 0.0, 0), (1, -100.001, 0.0, 2),
            (1, 10.0, 0.349, 1), (1, 10.0, 0.35, 0),
            (1, -10.0, -0.35, 2), (1, 0.0, 0.35, 0),
            (1, 0.0, -0.35, 2), (1, 10.0, -1.0, 0),
            (0, 200.0, 1.0, 0), (2, -200.0, -1.0, 2),
        ] {
            near(Double(JimiV9Motion.sliderDragDestination(selectedSlide: slide, distance: distance,
                                                          velocityPointsPerMillisecond: velocity)),
                 Double(expected), "drag-destination-\(slide)-\(distance)-\(velocity)")
        }
        for (world, delay, direction) in [(1, 0.0, -1.0), (3, 0.22, 1.0), (2, 0.11, -1.0)] {
            let enter = JimiV9Motion.hubBanner(worldID: world, enter: true, width: 200)
            let exit = JimiV9Motion.hubBanner(worldID: world, enter: false, width: 200)
            near(enter.tweens[0].begin, 0.08 + delay, "banner-world-\(world)-delay")
            near(enter.duration, 0.08 + delay + 0.72, "banner-enter-end")
            pose(enter.pose(at: -1), .init(x: direction * 128), "banner-enter-tucked")
            pose(enter.pose(at: 2), .init(), "banner-enter-neutral-wrapper")
            near(exit.duration, 0.32, "banner-exit-duration")
            pose(exit.pose(at: -1), .init(), "banner-exit-initial")
            pose(exit.pose(at: 2), .init(x: direction * 128), "banner-exit-tucked")
            let reduced = JimiV9Motion.hubBanner(worldID: world, enter: true, width: 200, reducedMotion: true)
            near(reduced.duration, 0, "banner-reduced-duration")
            pose(reduced.pose(at: 1), .init(), "banner-reduced-neutral")
        }
        for reduced in [false, true] {
            let exit = JimiV9Motion.journeyNavigationExit(reducedMotion: reduced)
            near(exit.anchorX, 0.5, "journey-nav-exit-anchor-x")
            near(exit.anchorY, 0, "journey-nav-exit-top-pivot")
            near(exit.tweens[0].begin, 0, "journey-nav-exit-immediate")
            near(exit.duration, reduced ? 0.16 : 0.48, "journey-nav-exit-duration")
            pose(exit.pose(at: 0), .scale(1), "journey-nav-exit-start")
            pose(exit.pose(at: 1), .scale(0.04, y: -10, opacity: 0), "journey-nav-exit-terminal")
            for index in 0...100 {
                let t = Double(index)/100
                let ease = reduced ? t*t : t*t*(2.25*t-1.25)
                pose(exit.pose(at: exit.duration*t),
                     .scale(1-0.96*ease, y: -10*ease, opacity: 1-ease), "journey-nav-exit-v9-curve")
            }
        }
        // Finite co-retirement preserves each original sample's wall-clock
        // second and pose. Only a duplicate terminal keyframe may be appended.
        let routeTracks = parts.map { JimiV9Motion.homeEnter($0.1) }
            + parts.map { JimiV9Motion.homeExit($0.1) }
            + [JimiV9Motion.journeyNavigationExit(), JimiV9Motion.journeyNavigationExit(reducedMotion: true)]
        let routeEnd = routeTracks.map { $0.duration }.max()!
        for track in routeTracks {
            let baseline = JimiV9Motion.sampledTrack(track)
            let held = JimiV9Motion.sampledTrack(track, holdUntil: routeEnd)
            let samples = max(2, Int(ceil(track.duration * 240)))
            near(baseline.duration, track.duration, "sampled-baseline-duration")
            near(baseline.keyTimes == nil ? 1 : 0, 1, "sampled-baseline-implicit-times")
            near(Double(baseline.poses.count), Double(samples + 1), "sampled-baseline-count")
            near(held.duration, routeEnd, "held-existing-route-end")
            for index in 0...samples {
                let seconds = Double(index) * track.duration / Double(samples)
                pose(baseline.poses[index], track.pose(at: seconds), "baseline-authored-sample")
                pose(held.poses[index], baseline.poses[index], "held-same-authored-pose")
                if let times = held.keyTimes {
                    near(times[index] * held.duration, seconds, "held-same-authored-seconds")
                    if index > 0 {
                        near(times[index] > times[index - 1] ? 1 : 0, 1, "held-strict-key-order")
                    }
                }
            }
            pose(held.poses.last!, baseline.poses.last!, "held-original-terminal-pose")
            if track.duration < routeEnd {
                near(Double(held.poses.count), Double(baseline.poses.count + 1), "held-one-terminal-duplicate")
                near(held.keyTimes!.last!, 1, "held-normalized-end")
                near(held.keyTimes!.dropLast().last!, track.duration / routeEnd, "held-motion-end-before-retirement")
            } else {
                near(held.keyTimes == nil ? 1 : 0, 1, "longest-route-unchanged")
            }
            let shorter = JimiV9Motion.sampledTrack(track, holdUntil: track.duration / 2)
            near(shorter.duration, track.duration, "never-shorten-track")
            near(shorter.keyTimes == nil ? 1 : 0, 1, "shorter-hold-implicit-times")
        }
        for zero in [JimiV9Motion.Track(tweens: []),
                     JimiV9Motion.hubBanner(worldID: 1, enter: true, width: 200, reducedMotion: true)] {
            let sampled = JimiV9Motion.sampledTrack(zero, holdUntil: routeEnd)
            near(sampled.duration, 0, "zero-duration-not-held")
            near(sampled.keyTimes == nil ? 1 : 0, 1, "zero-duration-no-duplicate-key-times")
            near(Double(sampled.poses.count), 3, "zero-duration-existing-samples")
            for value in sampled.poses { pose(value, zero.pose(at: 0), "zero-duration-pose") }
        }
        print("PASS Jimi v9 pure motion recipes: \(assertions) assertions. No controller cancellation, UIKit pixels or fluidity claim.")
    }
}
