import Foundation

/// Captured callback owner, driven by the existing animation clock, independent
/// app/wall timeout delivery, and an actual onscreen render receipt. No timer,
/// display link, UIKit observer, renderer or gameplay resolver lives here.
final class NativeWildMeterDropRuntime {
    nonisolated struct Capture: Hashable, Sendable { let id: String; let generation: UInt64; let epoch: UInt64 }
    nonisolated enum Event: Equatable {
        case activityBegin100, activityEnd100
        case dividerMask(Bool), carrierSoundBegin(arcade: Bool), carrierSoundStop(arcade: Bool)
        case carrierReleased, tileRevealed, impact, mediumHaptic
        case restoreBoardFallback, handoffLock(Bool), landed, dropPromiseCompleted
        case selectedWarmupCompleted, spawnCompleted, foregroundReleased, retired
    }
    let capture: Capture
    let plan: NativeWildMeterDropPlan
    var onEvent: ((Event) -> Void)?
    private(set) var assetReady=false,retired=false,restored=false,foregroundReleased=false
    private(set) var selectedWarmupReady=false,spawnCompleted=false
    private(set) var handoffPending=false
    private var origin: Double?,impactStart: Double?,handoffDeadline: Double?
    private var activityHeld=false,carrierHeld=false,dropCompleted=false,tileRevealed=false
    private var handoffPaintAfter: UInt64?

    init(capture: Capture,plan: NativeWildMeterDropPlan) {self.capture=capture;self.plan=plan}
    var hasSourceSaveBlock: Bool { !retired && (!spawnCompleted || handoffPending) }
    var isTileInputLegal: Bool { !retired && restored && !handoffPending && selectedWarmupReady }
    var needsForegroundPaint: Bool { !retired && restored && !foregroundReleased }

    /// Source acquires100 ONLY after awaited carrier assets. Concurrent preload
    /// is owned outside this object; late readiness after retirement is rejected.
    func assetsPrepared(_ receipt: Capture,animationSeconds: Double) {
        guard matches(receipt),!assetReady else {return}
        assetReady=true;origin=animationSeconds;activityHeld=true;carrierHeld=true
        emit(.activityBegin100);emit(.dividerMask(true));emit(.carrierSoundBegin(arcade:plan.arcade))
    }
    /// Existing global animation/SK action clock. It must remain frozen during
    /// Source pause. Actual travel callback delivery captures a new impact root.
    @discardableResult
    func advance(_ receipt: Capture,animationSeconds: Double,wallMilliseconds: Double,renderEpoch: UInt64) -> NativeWildMeterDropPlan.Frame? {
        guard matches(receipt),assetReady,let origin else {return nil}
        let elapsed=max(0,animationSeconds-origin)
        if !tileRevealed,elapsed>=NativeWildMeterDropPlan.revealTime {tileRevealed=true;emit(.tileRevealed)}
        if carrierHeld,elapsed>=NativeWildMeterDropPlan.carrierCleanupTime {releaseCarrier()}
        if impactStart==nil,elapsed>=NativeWildMeterDropPlan.travelStart+NativeWildMeterDropPlan.travelDuration {
            impactStart=elapsed;emit(.mediumHaptic);emit(.impact)
        }
        if !restored,let impactStart,elapsed>=impactStart+NativeWildMeterDropPlan.impactDuration-1e-8 {
            restore(wallMilliseconds:wallMilliseconds,renderEpoch:renderEpoch,interrupted:false)
        }
        advanceWall(receipt,wallMilliseconds:wallMilliseconds)
        var frame=plan.sample(seconds:elapsed,impactStart:impactStart,restored:restored,wallHandoffPending:handoffPending)
        frame.tile.interactive=isTileInputLegal
        return frame
    }
    /// The literal140ms setTimeout is wall/app time, not an animation duration.
    /// Existing app timeout transport invokes this during animation pause too.
    func advanceWall(_ receipt:Capture,wallMilliseconds:Double) {
        guard matches(receipt),handoffPending,let deadline=handoffDeadline,wallMilliseconds>=deadline else {return}
        handoffPending=false;handoffDeadline=nil;emit(.handoffLock(false))
    }
    func selectedWarmupCompleted(_ receipt:Capture) {
        guard matches(receipt),!selectedWarmupReady else {return}
        selectedWarmupReady=true;emit(.selectedWarmupCompleted);finishSpawnIfReady()
    }
    /// Matching onscreen paint after restoration; an already-started frame or
    /// offscreen texture render cannot retire the last visible fallback.
    func painted(_ receipt:Capture,renderEpoch:UInt64,onscreen:Bool,includesReplacement:Bool) {
        guard matches(receipt),restored,!foregroundReleased,onscreen,includesReplacement,
              let captured=handoffPaintAfter,renderEpoch>captured else {return}
        foregroundReleased=true;handoffPaintAfter=nil;emit(.foregroundReleased)
    }
    /// Literal finish()/restoreTile interruption. This is an explicit kill,
    /// never called by pure pause/background. It restores the original parent
    /// and creates the same140ms lock; Source does not invoke onLanded here.
    func interrupt(_ receipt:Capture,wallMilliseconds:Double,renderEpoch:UInt64) {
        guard matches(receipt),assetReady,!dropCompleted else {return}
        releaseCarrier();releaseForeground()
        restore(wallMilliseconds:wallMilliseconds,renderEpoch:renderEpoch,interrupted:true)
    }
    /// Scene/generation retirement discards late native receipts. The caller
    /// owns authoritative engine restart/cancel; this object never mutates it.
    func dispose() {
        guard !retired else {return}
        releaseCarrier();releaseForeground();releaseActivity()
        retired=true;handoffDeadline=nil;handoffPaintAfter=nil;emit(.retired);onEvent=nil
    }
    private func matches(_ receipt:Capture)->Bool { !retired && receipt==capture }
    private func restore(wallMilliseconds:Double,renderEpoch:UInt64,interrupted:Bool) {
        guard !dropCompleted else {return}
        restored=true;handoffPending=true;handoffDeadline=wallMilliseconds+NativeWildMeterDropPlan.handoffMilliseconds
        handoffPaintAfter=renderEpoch
        emit(.restoreBoardFallback);emit(.handoffLock(true))
        if !interrupted {emit(.landed)}
        dropCompleted=true;releaseActivity();emit(.dropPromiseCompleted);finishSpawnIfReady()
    }
    private func finishSpawnIfReady() {
        guard dropCompleted,selectedWarmupReady,!spawnCompleted else {return}
        spawnCompleted=true;emit(.spawnCompleted)
    }
    private func releaseActivity() {if activityHeld {activityHeld=false;emit(.activityEnd100)}}
    private func releaseCarrier() {
        guard carrierHeld else {return}
        carrierHeld=false;emit(.carrierSoundStop(arcade:plan.arcade));emit(.dividerMask(false));emit(.carrierReleased)
    }
    private func releaseForeground() {
        guard !foregroundReleased else {return}
        foregroundReleased=true;handoffPaintAfter=nil;emit(.foregroundReleased)
    }
    private func emit(_ event:Event) {onEvent?(event)}
}
