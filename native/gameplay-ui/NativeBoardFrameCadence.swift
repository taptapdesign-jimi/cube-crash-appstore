import Foundation

/// Literal mobile frame-controller policy. Caller supplies existing ticker or
/// callback timestamps; this owner creates no listener, timer, or frame loop.
final class NativeBoardFrameCadence {
    nonisolated struct Snapshot:Equatable,Codable {
        let active:Bool,maxFPS:Int,activeUntil:Double,activityLeaseCount:Int,settledMotionLeaseCount:Int,sleeping:Bool
    }
    final class Lease:Hashable {
        enum Kind {case activity,settled}
        let label:String
        fileprivate let kind:Kind,releaseTailMs:Double
        fileprivate var released=false
        fileprivate init(label:String,kind:Kind,releaseTailMs:Double=0) {self.label=label;self.kind=kind;self.releaseTailMs=releaseTailMs}
        static func ==(lhs:Lease,rhs:Lease)->Bool {lhs === rhs}
        func hash(into hasher:inout Hasher){hasher.combine(ObjectIdentifier(self))}
    }
    static let activityTailMs=300.0,directManipulationReleaseTailMs=250.0,defaultReleaseTailMs=180.0
    let isMobileRuntime:Bool
    private var tickerID:UInt64?,targetFPS=0,activeUntil=0.0
    private var activityLeases:Set<Lease>=[],settledLeases:Set<Lease>=[]
    private var directManipulation:Lease?,diagnosticActiveCap:Int?
    init(isMobileRuntime:Bool=true){self.isMobileRuntime=isMobileRuntime}
    var snapshot:Snapshot {.init(active:tickerID != nil,maxFPS:tickerID == nil ? 0:targetFPS,activeUntil:activeUntil,activityLeaseCount:activityLeases.count,settledMotionLeaseCount:settledLeases.count,sleeping:false)}
    /// Initial attach preserves early leases. Only a real replacement retires
    /// old leases; repeated start on the same ticker recomputes its cap.
    func start(tickerID:UInt64?,nowMs:Double) {
        guard isMobileRuntime,let tickerID else{return}
        if self.tickerID == tickerID {apply(nowMs:nowMs);return}
        if self.tickerID != nil {stop(nowMs:nowMs)}
        self.tickerID=tickerID;apply(nowMs:nowMs)
    }
    func advance(nowMs:Double){apply(nowMs:nowMs)}
    func markActivity(nowMs:Double,durationMs:Double=activityTailMs) {
        guard tickerID != nil else{return}
        activeUntil=max(activeUntil,nowMs+max(0,durationMs));apply(nowMs:nowMs)
    }
    @discardableResult func acquireActivity(label:String="anonymous",releaseTailMs:Double=defaultReleaseTailMs,nowMs:Double)->Lease {
        let lease=Lease(label:label,kind:.activity,releaseTailMs:releaseTailMs)
        activityLeases.insert(lease);apply(nowMs:nowMs);return lease
    }
    @discardableResult func acquireSettled(label:String="settled-motion",nowMs:Double)->Lease {
        let lease=Lease(label:label,kind:.settled);settledLeases.insert(lease);apply(nowMs:nowMs);return lease
    }
    func release(_ lease:Lease,nowMs:Double) {
        guard !lease.released else{return};lease.released=true
        switch lease.kind {
        case .activity:
            // Old activity completion cannot extend a replacement's tail.
            guard activityLeases.remove(lease) != nil else{return}
            activeUntil=max(activeUntil,nowMs+max(0,lease.releaseTailMs))
        case .settled:
            // The source settled closure applies cadence even after its old
            // token was retired. Preserve that distinct source behavior.
            settledLeases.remove(lease)
        }
        apply(nowMs:nowMs)
    }
    func beginDirectManipulation(nowMs:Double) {
        guard tickerID != nil,directManipulation == nil else{return}
        directManipulation=acquireActivity(label:"direct-manipulation",releaseTailMs:Self.directManipulationReleaseTailMs,nowMs:nowMs)
    }
    func endDirectManipulation(nowMs:Double) {
        let lease=directManipulation;directManipulation=nil
        if let lease {release(lease,nowMs:nowMs)}
    }
    func visibilityChanged(hidden:Bool,nowMs:Double) {
        if hidden {endDirectManipulation(nowMs:nowMs)}
        apply(nowMs:nowMs)
    }
    /// QA-only source flag; assigning it does not create an extra apply/tick.
    func setDiagnosticActiveCap(_ cap:Int?){diagnosticActiveCap=cap}
    func stop(nowMs:Double) {
        endDirectManipulation(nowMs:nowMs)
        tickerID=nil;targetFPS=0;activeUntil=0;activityLeases.removeAll();settledLeases.removeAll()
    }
    private func apply(nowMs:Double) {
        guard tickerID != nil else{return}
        targetFPS = !activityLeases.isEmpty || nowMs<activeUntil ? (diagnosticActiveCap == 30 ? 30:60):(!settledLeases.isEmpty ? 30:15)
    }
}

/// Existing source ticker remains visible at15/30/60. Lifecycle suspension
/// belongs to its existing renderer; this adapter installs no separate clock.
enum NativeBoardFrameCadenceDelivery {
    struct Decision:Equatable {
        let sourceMaxFPS:Int,preferredFramesPerSecond:Int?,isPaused:Bool
    }
    static func decide(_ source:NativeBoardFrameCadence.Snapshot,foreground:Bool)->Decision {
        guard source.active else{return .init(sourceMaxFPS:0,preferredFramesPerSecond:nil,isPaused:true)}
        return .init(sourceMaxFPS:source.maxFPS,preferredFramesPerSecond:source.maxFPS,isPaused:!foreground)
    }
}
