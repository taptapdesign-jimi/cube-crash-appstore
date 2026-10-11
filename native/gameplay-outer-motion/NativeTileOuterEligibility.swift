import Foundation

// PRIVATE proposal only: no renderer, timer, Codable state, or admission hook.
struct NativeTileOuterEligibility {
    enum GridMembership { case unchecked, sameIdentity, missingOrDifferentIdentity }
    struct Owners {
        var mergeImpact = false
        var pickupScale = false
        var snapBack = false
        var isBeingSpawned = false
        var wildSpawnDropping = false
        var pendingRemoval = false
        var beingRemoved = false
        var cleanupQueued = false
        var skipIdleScaleReset = false
        var competes: Bool {
            mergeImpact || pickupScale || snapBack || isBeingSpawned ||
            wildSpawnDropping || pendingRemoval || beingRemoved ||
            cleanupQueued || skipIdleScaleReset
        }
    }
    var destroyed = false
    var visible = true
    var locked = false
    var value = 1
    var variant: String?
    var eventMode: String?
    var gridMembership: GridMembership = .sameIdentity
    var idleTimelinePresent = false
    var activeIdle = false
    var owners = Owners()

    // Source refresh list does not inspect alpha or unrelated inner actions.
    var isListed: Bool {
        guard !destroyed, visible, !locked, value > 0, variant != "kanta" else { return false }
        if let eventMode, !eventMode.isEmpty, eventMode != "static" { return false }
        if case .missingOrDifferentIdentity = gridMembership { return false }
        return true
    }
    var canBeginOuterIdle: Bool {
        isListed && !idleTimelinePresent && !activeIdle && !owners.competes
    }
    var canRestoreCanonicalIdlePose: Bool { !destroyed && !owners.skipIdleScaleReset }
}

// Matching receipt is retained by the actual bounded presentation owner.
// NativeTileOuterEligibility does not manage cancellation or install a clock.
struct NativeTileOuterReceipt: Hashable {
    enum Kind: Hashable { case idle, mergeImpact, pickupScale, snapBack }
    let id: UUID
    let tileID: String
    let generation: UInt64
    let kind: Kind
}
