import Foundation

/// Value/receipt bridge for original cleanupAllPullAnimations only. It neither
/// plans nor advances pull motion. All child roots/poses come from the actual
/// selected pull owner; public raw SKAction pull is not admitted by this class.
@MainActor final class NativeSourceSpecialPullCleanup<Node:AnyObject> {
    struct Child {
        let rootID:UUID,node:Node
        let alive:()->Bool
        /// Full captured original x/y/rotation/scaleX/scaleY + marker cleanup,
        /// unlock, z sync, static input/binding and original grid membership.
        let restoreOriginal:()->Void
        let killActualRoot:()->Void
    }
    struct Hooks {
        let runCurrent:()->Bool
        let releasePull100:()->Void
        let stopCurrentForce:()->Void
        let pullFlagIsSet:()->Bool
        let resetPullFlagAndQueue:()->Void
        let clearCapturedCleanupPointer:()->Void
    }
    private let hooks:Hooks
    private var children:[UUID:Child]
    private let childOrder:[UUID]
    private var interrupted=Set<UUID>()
    private(set) var cleaned=false
    private(set) var retired=false
    private(set) var mergeStarted=false
    init(children:[Child],hooks:Hooks) {
        precondition(Set(children.map(\.rootID)).count==children.count)
        self.children=Dictionary(uniqueKeysWithValues:children.map{($0.rootID,$0)});self.childOrder=children.map(\.rootID);self.hooks=hooks
    }
    /// Genuine tryMergePulledTiles entry, not count/time/input permission.
    func markMergeStarted(){guard !retired else{return};mergeStarted=true}
    func childInterrupted(_ rootID:UUID) {
        guard !retired,!mergeStarted,!interrupted.contains(rootID),let child=children[rootID] else{return}
        interrupted.insert(rootID)
        let current=hooks.runCurrent();guard !retired,!mergeStarted,current else{return}
        let living=child.alive();guard !retired,!mergeStarted,living,children[rootID] != nil else{return}
        let stillCurrent=hooks.runCurrent();guard !retired,!mergeStarted,stillCurrent else{return}
        child.restoreOriginal() // DOES NOT start idle/shimmer/media again
    }
    func cleanupAll(preserveCommittedPullSound:Bool=false) {
        guard !cleaned,!retired else{return};cleaned=true
        hooks.releasePull100();guard !retired else{return}
        let current=hooks.runCurrent();guard !retired else{return}
        if current,!preserveCommittedPullSound {hooks.stopCurrentForce()}
        guard !retired else{return}
        // Keep entries while cancel invokes genuine child onInterrupt. An owner
        // that suppresses that callback must expose its explicit finalizer; do
        // not silently substitute a geometry-center pose here.
        let captured=childOrder.compactMap{children[$0]}
        for child in captured {guard !retired else{return};child.killActualRoot()}
        children.removeAll()
        let run=hooks.runCurrent();guard !retired else{return}
        if run {
            let flag=hooks.pullFlagIsSet();guard !retired else{return}
            let stillRun=hooks.runCurrent();guard !retired else{return}
            if flag,stillRun {hooks.resetPullFlagAndQueue()}
        }
        guard !retired else{return};hooks.clearCapturedCleanupPointer()
    }
    func retireObsolete(){
        guard !retired else{return};retired=true
        let captured=childOrder.compactMap{children[$0]};children.removeAll()
        for child in captured {child.killActualRoot()}
    }
    // Swift6.3.3 generic ARC destroyer optimizer workaround; hot code stays -O.
    @_optimize(none) deinit {}

}

/// stopMagnetPullForceSounds = stopRegularMerge6Sounds + its authored accent.
/// Existing transport cancels pending starts/stops/fades for these SAME IDs;
/// Bottle/Honey pull secondary, unrelated SFX/music remain outside this set.
enum NativeSourceMagnetForceStop {
    static let voiceIDs:Set<String>=["regular-merge6-primary","regular-merge6-crash","regular-merge6-boom","regular-merge6-stack","magnet-pull-force-boiing"]
}
