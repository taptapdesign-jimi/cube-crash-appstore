import Foundation

// PRIVATE: driven only by the already accepted GSAP-equivalent clock. No timer,
// display link, SKAction, gameplay completion or core mutation is installed.
final class NativeSharedSmokeRuntime {
    struct Puff {
        let id, burst: Int
        let radiusX, radiusY, rotation, scale, fillAlpha: Double
        let color: UInt32
        let sx, sy, dx, dy, birth, stagger, fadeIn, travel, hold, fadeOut, targetAlpha: Double
        let fadeInEase: String
        var finish: Double { birth + stagger + fadeIn + travel + hold + fadeOut }
        func pose(at time: Double) -> (x: Double, y: Double, alpha: Double) {
            let age = time - birth - stagger
            let p = sin(Self.unit((age - fadeIn) / travel) * .pi / 2)
            let alpha: Double
            if age < fadeIn {
                let q = Self.unit(age / fadeIn)
                alpha = targetAlpha * (fadeInEase == "sine.out" ? sin(q * .pi / 2) : 1 - pow(1 - q, 3))
            } else if age < fadeIn + travel + hold { alpha = targetAlpha }
            else { alpha = fadeOut == 0 ? 0 : targetAlpha * (1 - pow(Self.unit((age - fadeIn - travel - hold) / fadeOut), 2)) }
            return (sx + (dx - sx) * p, sy + (dy - sy) * p, alpha * fillAlpha)
        }
        private static func unit(_ x: Double) -> Double { min(1, max(0, x)) }
    }
    let recipe: NativeSharedSmokeRecipe
    let receipt: NativeSharedFxReceipt?
    let requestedCount, count, burstCount, perBurst: Int
    private(set) var puffs: [Puff] = []
    private(set) var releasedPuffIDs = Set<Int>()
    private(set) var retired = false, haloReleased = false
    let haloRadius, depth: Double
    private let birthClockMs: Double, random: () -> Double
    private let releaseActivity: (() -> Void)?
    private var nextBurst = 1
    private var releaseDelivered = false
    init(recipe: NativeSharedSmokeRecipe, hotFactor: Double, generation: UInt64,
         sequence: UInt64, gsapNowMs: Double, random: @escaping () -> Double,
         sourceOwnerID:String="",acquireActivity: (NativeSharedFxReceipt) -> (() -> Void)?) {
        self.recipe = recipe; self.random = random; birthClockMs = gsapNowMs
        // autoAdd attaches its captured activity before getFxHotFactor/count
        // draws. A replacement layer must never steal the old closure.
        if let label = recipe.activityLeaseLabel {
            let receipt = NativeSharedFxReceipt(kind: .smoke, generation: generation, sequence: sequence, label: label, tailMilliseconds: 100,sourceOwnerID:sourceOwnerID)
            self.receipt = receipt; releaseActivity = acquireActivity(receipt)
        } else { receipt = nil; releaseActivity = nil }
        let strength = max(0.4, recipe.strength)
        requestedCount = max(6, Int(((44 + random() * 14) * strength * recipe.countScale * hotFactor).rounded(.toNearestOrAwayFromZero)))
        count = min(requestedCount, recipe.maxParticles.map { max(6, $0) } ?? Int.max)
        burstCount = max(3, Int((recipe.bursts * hotFactor).rounded(.toNearestOrAwayFromZero)))
        perBurst = Int(ceil(Double(count) / Double(burstCount)))
        haloRadius = recipe.tileSize * (0.22 + 0.05 * strength) * recipe.haloScale
        depth = recipe.behind ? recipe.tileDepth - 0.001 : recipe.zIndex
        buildBurst(0, at: 0)
        if !recipe.deferFutureBursts {
            for index in 1..<burstCount { buildBurst(index, at: 0) }
            nextBurst = burstCount
        }
    }
    // gsapNowMs may remain unchanged while wall time advances in background.
    // Source deferred draws occur only when the actual GSAP-equivalent parent clock executes the
    // scheduled callback, preserving interleaving with other authored effects.
    func advance(gsapNowMs: Double) {
        guard !retired else { return }
        let seconds = max(0, (gsapNowMs - birthClockMs) / 1000)
        if recipe.ttl > 0, seconds >= recipe.ttl { retire(); return }
        while recipe.deferFutureBursts, nextBurst < burstCount,
              seconds >= Self.gsapTime(Double(nextBurst) * recipe.burstGap) {
            buildBurst(nextBurst, at: seconds)
            nextBurst += 1
        }
        for puff in puffs where seconds >= puff.finish { releasedPuffIDs.insert(puff.id) }
        if seconds >= 0.46 { haloReleased = true }
    }
    func sample(gsapNowMs: Double) -> [(Int, Double, Double, Double)] {
        let seconds = max(0, (gsapNowMs - birthClockMs) / 1000)
        return puffs.filter { !retired && !releasedPuffIDs.contains($0.id) }.map {
            let p = $0.pose(at: seconds); return ($0.id, p.x, p.y, p.alpha)
        }
    }
    func haloAlpha(gsapNowMs: Double) -> Double {
        guard !retired, !haloReleased else { return 0 }
        let t = max(0, (gsapNowMs - birthClockMs) / 1000)
        let root = t < 0.18 ? 0.22 * (1 - pow(1 - min(1, t / 0.08), 3)) : 0.22 * (1 - pow(min(1, max(0, (t - 0.18) / 0.28)), 3))
        return 0.10 * recipe.haloAlpha * root
    }
    // Tag cleanup, board exit and stale generation use the same idempotent
    // retirement; release the captured old lease, never a newly looked-up ID.
    func retire() {
        guard !retired else { return }; retired = true; haloReleased = true
        puffs.forEach { releasedPuffIDs.insert($0.id) }
        guard !releaseDelivered else { return }; releaseDelivered = true; releaseActivity?()
    }
    private func buildBurst(_ burst: Int, at birth: Double) {
        let r = recipe, size = r.tileSize, durationScale = min(2, max(0.2, r.durationScale))
        let base = max(6, (size * 0.051 * r.sizeScale).rounded(.toNearestOrAwayFromZero))
        let maximum = max(18, (size * 0.24 * r.sizeScale).rounded(.toNearestOrAwayFromZero))
        let inset = size * 0.02 * r.insetScale
        for i in 0..<perBurst {
            var radius = base + random() * (maximum - base)
            if r.sizeBoostChance > 0, random() < r.sizeBoostChance { radius *= r.sizeBoostScale }
            if random() < 0.1 { radius *= 1.1 + random() * 0.3 }
            radius = min(radius, min(maximum * 1.5, size * 0.18))
            let ellipse = random() < min(1, max(0, r.ellipseChance))
            let amin = min(1, max(0.35, r.ellipseAspectMin)), amax = min(2, max(1, r.ellipseAspectMax))
            let aspect = ellipse ? amin + random() * (amax - amin) : 1
            let fillAlpha = r.solidAlpha || r.cloudAlphaProfile ? r.baseAlpha : r.baseAlpha * (0.7 + random() * 0.6)
            let color = r.colors.flatMap { $0.isEmpty ? nil : $0[Int(floor(random() * Double($0.count)))] } ?? r.color
            let rotation = ellipse ? random() * .pi * 2 : 0
            var sx = 0.0, sy = 0.0, dx = 0.0, dy = 0.0
            if r.spawnShape == "organic-radial" {
                let a = random() * .pi * 2, sr = pow(random(), 1.35) * size * 0.62
                let ta = a + (random() - 0.5) * 1.35, d = size * (0.06 + random() * 0.4) * r.distanceScale
                let lateral = (random() - 0.5) * size * 0.16 * r.distanceScale
                sx = cos(a) * sr; sy = sin(a) * sr
                dx = sx + cos(ta) * d + cos(ta + .pi / 2) * lateral
                dy = sy + sin(ta) * d + sin(ta + .pi / 2) * lateral
            } else if r.spawnShape == "box" {
                sx = (random() - 0.5) * (size - inset * 2); sy = (random() - 0.5) * (size - inset * 2)
                let range = size * 0.34 * r.distanceScale * 0.8
                dx = sx + (random() - 0.5) * range * 2
                dy = sy + (random() - 0.5) * range * 2 - size * max(0, r.upwardBias) * (0.6 + random() * 0.8)
            } else {
                let side = (i + burst) % 4, along = random() * (size - inset * 2) - (size / 2 - inset)
                switch side { case 0: sx = along; sy = -size / 2 + inset; case 1: sx = size / 2 - inset; sy = along; case 2: sx = along; sy = size / 2 - inset; default: sx = -size / 2 + inset; sy = along }
                let normals = [(0.0, -1.0), (1.0, 0.0), (0.0, 1.0), (-1.0, 0.0)]
                let angle = atan2(normals[side].1, normals[side].0) + (random() - 0.5) * r.spread
                let d = size * 0.15 * r.distanceScale + random() * max(0, size * (0.34 - 0.15) * r.distanceScale)
                dx = sx + cos(angle) * d; dy = sy + sin(angle) * d
            }
            dx += (random() - 0.5) * size * 0.06 * r.distanceScale
            dy += (random() - 0.5) * size * 0.06 * r.distanceScale
            let fadeIn = Self.gsapTime(r.fadeInDuration.map { max(0.018, $0) } ?? (0.018 + random() * 0.022) * durationScale)
            let travel = Self.gsapTime((0.16 + random() * 0.12) * durationScale), hold = Self.gsapTime((0.02 + random() * 0.03) * durationScale)
            let fadeOut = r.instantFadeOut ? 0 : Self.gsapTime((0.08 + random() * 0.06) * durationScale)
            let scale = r.startScale ?? (0.65 + random() * 0.25) * max(0.7, r.sizeScale)
            let stagger = Self.gsapTime((r.deferFutureBursts ? 0 : Double(burst) * r.burstGap) + random() * 0.018)
            let radial = hypot(sx / max(1, size * 0.5), sy / max(1, size * 0.5)), center = 1 - min(1, radial / 1.25)
            let cloud = max(0.3, min(1, 0.34 + center * 0.64 + (random() - 0.5) * 0.16))
            let alpha = r.cloudAlphaProfile ? cloud * r.trailAlpha : r.trailAlpha
            puffs.append(.init(id: puffs.count, burst: burst, radiusX: radius, radiusY: radius * aspect, rotation: rotation, scale: scale, fillAlpha: fillAlpha, color: color, sx: sx, sy: sy, dx: dx, dy: dy, birth: birth, stagger: stagger, fadeIn: fadeIn, travel: travel, hold: hold, fadeOut: fadeOut, targetAlpha: alpha, fadeInEase: r.fadeInEase))
        }
    }
    // Original installed GSAP stores child starts/durations with _roundPrecise
    // (seven decimal places); binary 3*.035 must still fire at source .105.
    private static func gsapTime(_ value: Double) -> Double { (value * 10_000_000).rounded(.toNearestOrAwayFromZero) / 10_000_000 }
}
