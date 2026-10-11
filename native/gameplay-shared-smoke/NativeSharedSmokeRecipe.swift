import Foundation

// PRIVATE: captured authored smokeBubblesAtTile inputs, not gameplay decisions.
struct NativeSharedSmokeRecipe: Codable {
    var tileSize = 128.0, strength = 1.0
    var behind = false, sizeScale = 1.0, distanceScale = 1.0, countScale = 1.0, insetScale = 1.0, ttl = 1.0
    var blendMode = "add", baseAlpha = 1.0, color: UInt32 = 0xffffff, colors: [UInt32]? = nil, haloColor: UInt32? = nil
    var startScale: Double? = nil, sizeBoostChance = 0.0, sizeBoostScale = 1.0
    var instantFadeOut = false, solidAlpha = false, cloudAlphaProfile = false, deferFutureBursts = false
    var upwardBias = 0.0, durationScale = 1.0, spawnShape = "box"
    var ellipseChance = 0.35, ellipseAspectMin = 0.85, ellipseAspectMax = 1.15
    var groupedOwner = false, zIndex = 9990.0, tileDepth = 0.0
    var fxTag: String? = nil, activityLeaseLabel: String? = nil
    var maxParticles: Int? = nil, bursts = 5.0, burstGap = 0.035, spread = 0.9
    var fadeInDuration: Double? = nil, fadeInEase = "power2.out", trailAlpha = 0.95, haloScale = 1.0, haloAlpha = 1.0
}

struct NativeSharedFxReceipt: Hashable, Codable {
    enum Kind: String, Codable { case smoke, shards }
    let kind: Kind, generation: UInt64, sequence: UInt64
    let label: String, tailMilliseconds: Int
    var sourceOwnerID:String=""
    var invocationID:String{sourceOwnerID.isEmpty ? String(sequence) : sourceOwnerID+"/"+String(sequence)}
}

// Inject this existing app-lived service. A renderer must not create a second
// hot-factor history or consume the counter when a missing/stale call bails out.
struct NativeSharedSmokeHotCadence {
    private var lastBurstMs = 0.0
    mutating func consume(nowMs: Double, reduced: Bool) -> Double {
        let delta = nowMs - lastBurstMs
        lastBurstMs = nowMs
        let thermal = reduced ? 0.58 : 1.0
        return (delta >= 320 ? 1 : 0.55 + delta / 320 * 0.45) * thermal
    }
}
